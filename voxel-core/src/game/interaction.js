/**
 * Interaction framework.
 *
 * Every world-facing player action funnels through the same three steps:
 *
 *   1. resolve a target (raycast from the eye, with proximity fallback)
 *   2. validate it (reach, line of sight, tool, cooldown)
 *   3. dispatch a handler looked up by data, not by a branch
 *
 * `INTERACT`, `HARVEST` and `PLACE` are the three classes worth separating.
 * Anything else a game needs (talk to NPC, till soil, read a sign) is a new
 * handler registration, not a new code path.
 */

import { MAX_REACH, PLAYER_WIDTH, PLAYER_HEIGHT } from '../core/constants.js';
import { EVENTS } from '../core/event-bus.js';
import { HandlerRegistry } from '../core/registry.js';
import { raycast, directionFromAngles, distanceToBlockCenter } from '../world/raycast.js';
import { CONTAINER_KIND, openContainer } from './containers.js';

/** The three interaction classes. */
export const INTERACTION = {
  INTERACT: 'interact',
  HARVEST: 'harvest',
  PLACE: 'place',
};

/** Tile-entity kind for simple on/off blocks (doors, torches, levers). */
export const TOGGLE_KIND = 'toggle';

/**
 * Seconds needed to harvest a block with a given tool.
 *
 * Right tool class halves the time per tier; wrong class is slow but never
 * impossible, matching the "hardness + tool class" rule.
 *
 * @param {object} blockDef
 * @param {{ toolClass?: string|null, toolTier?: number }} [tool]
 * @returns {number|null} null when the block cannot be harvested at all
 */
export function computeHarvestSeconds(blockDef, tool = {}) {
  if (!blockDef || blockDef.hardness === null) return null;
  const matches = blockDef.toolClass === null || blockDef.toolClass === (tool.toolClass ?? null);
  const tier = matches ? Math.max(0, tool.toolTier ?? 0) : 0;
  const speed = 1 + tier * 1.5;
  const penalty = matches ? 1 : 2.5;
  return Math.max(0.05, (blockDef.hardness * penalty) / speed);
}

/**
 * Axis-aligned overlap test between a player box and a unit block cell.
 * @param {{ x: number, y: number, z: number }} position feet position
 * @param {number} bx @param {number} by @param {number} bz
 */
export function playerOccupies(position, bx, by, bz) {
  const half = PLAYER_WIDTH / 2;
  return (
    position.x + half > bx &&
    position.x - half < bx + 1 &&
    position.y + PLAYER_HEIGHT > by &&
    position.y < by + 1 &&
    position.z + half > bz &&
    position.z - half < bz + 1
  );
}

export class InteractionSystem {
  /**
   * @param {{
   *   world: import('../world/world.js').World,
   *   content: import('../content/index.js').Content,
   *   bus?: import('../core/event-bus.js').EventBus,
   *   groundItems?: import('./ground-items.js').GroundItemManager|null,
   *   reach?: number,
   *   collectDrops?: boolean,
   * }} config
   */
  constructor({ world, content, bus = null, groundItems = null, reach = MAX_REACH, collectDrops = false }) {
    this.world = world;
    this.content = content;
    this.bus = bus ?? world.bus;
    this.groundItems = groundItems;
    this.reach = reach;
    /** When true, harvest drops go straight into the harvester's inventory. */
    this.collectDrops = collectDrops;

    /** Handlers keyed by block name, then by tile-entity kind. */
    this.interactHandlers = new HandlerRegistry('interact');
    /** Handlers for the interaction classes themselves. */
    this.classHandlers = new HandlerRegistry('interaction class');
    /** Per-player in-progress harvests, keyed by player id. */
    this._harvesting = new Map();

    this._registerDefaultHandlers();
  }

  _registerDefaultHandlers() {
    this.classHandlers.register(INTERACTION.INTERACT, (player, params) =>
      this.interact(player, params.target, params));
    this.classHandlers.register(INTERACTION.HARVEST, (player, params) =>
      this.harvest(player, params.target, params));
    this.classHandlers.register(INTERACTION.PLACE, (player, params) => this.place(player, params, params));

    this.interactHandlers.register(CONTAINER_KIND, (player, target) => {
      const handle = openContainer({
        world: this.world,
        content: this.content,
        x: target.x,
        y: target.y,
        z: target.z,
      });
      if (!handle) return { ok: false, reason: 'not a container' };
      player.openContainer = handle.position;
      return { ok: true, action: 'open-container', container: handle };
    });

    this.interactHandlers.register(TOGGLE_KIND, (player, target) => {
      const data = this.world.ensureTileEntity(target.x, target.y, target.z, () => ({
        kind: TOGGLE_KIND,
        on: false,
      }));
      const next = { ...data, on: !data.on };
      this.world.setTileEntity(target.x, target.y, target.z, next, {
        source: 'interact',
        actorId: player.id,
      });
      return { ok: true, action: 'toggle', state: next };
    });
  }

  /**
   * Register a custom interaction handler.
   * @param {string} key block name or tile-entity kind
   * @param {(player: object, target: object, system: InteractionSystem) => object} handler
   */
  registerInteraction(key, handler) {
    this.interactHandlers.register(key, handler);
    return this;
  }

  /**
   * Register a new interaction class reachable through `perform`.
   * @param {string} kind
   * @param {(player: object, params: object, system: InteractionSystem) => object} handler
   */
  registerClass(kind, handler) {
    this.classHandlers.register(kind, handler);
    return this;
  }

  // ------------------------------------------------------- target resolution

  /**
   * Raycast from a player's eyes.
   *
   * @param {import('./player.js').Player} player
   * @param {{ maxDistance?: number, solidOnly?: boolean }} [options]
   * @returns {object|null} `{ x, y, z, block, blockDef, normal, adjacent, distance, proximity }`
   */
  resolveTarget(player, { maxDistance = this.reach, solidOnly = false } = {}) {
    const origin = player.eyePosition;
    const direction = directionFromAngles(player.yaw, player.pitch);
    const hit = raycast({
      origin,
      direction,
      maxDistance,
      getBlock: (x, y, z) => this.world.getBlock(x, y, z),
      isHit: solidOnly
        ? (blockId) => this.content.isSolid(blockId)
        : (blockId) => blockId !== 0 && !this.content.block(blockId)?.liquid,
    });
    if (!hit) return null;

    return {
      ...hit,
      blockDef: this.content.block(hit.block),
      proximity: distanceToBlockCenter(origin, hit.x, hit.y, hit.z),
    };
  }

  /**
   * Shared validation for every interaction class. The server calls this even
   * when the client claims a target, because clients lie.
   *
   * @param {import('./player.js').Player} player
   * @param {{ x: number, y: number, z: number }} target
   * @param {{ reach?: number, requireLineOfSight?: boolean }} [options]
   */
  validateTarget(player, target, { reach = this.reach, requireLineOfSight = true } = {}) {
    if (!target || !Number.isInteger(target.x) || !Number.isInteger(target.y) || !Number.isInteger(target.z)) {
      return { ok: false, reason: 'invalid target' };
    }
    const eye = player.eyePosition;
    const distance = distanceToBlockCenter(eye, target.x, target.y, target.z);
    // Half a block of slack so corner-on targets at max reach still work.
    if (distance > reach + 0.87) return { ok: false, reason: 'out of reach' };

    if (requireLineOfSight) {
      const seen = this.resolveTarget(player, { maxDistance: reach + 1 });
      if (!seen || seen.x !== target.x || seen.y !== target.y || seen.z !== target.z) {
        return { ok: false, reason: 'no line of sight' };
      }
    }
    return { ok: true, distance };
  }

  // -------------------------------------------------------------- INTERACT

  /**
   * Use a block without destroying it: open a chest, toggle a door.
   * @param {import('./player.js').Player} player
   * @param {{ x: number, y: number, z: number }} target
   * @param {object} [options]
   */
  interact(player, target, options = {}) {
    const valid = this.validateTarget(player, target, options);
    if (!valid.ok) return valid;

    const blockDef = this.world.getBlockDef(target.x, target.y, target.z);
    if (!blockDef?.interactable) return { ok: false, reason: 'nothing to interact with' };

    const key = this.interactHandlers.has(blockDef.name) ? blockDef.name : blockDef.tileEntity;
    const handler = this.interactHandlers.get(key);
    if (!handler) return { ok: false, reason: `no handler for "${blockDef.name}"` };

    const result = handler(player, { ...target, blockDef }, this);
    if (result?.ok !== false) {
      this.bus.emit(EVENTS.INTERACTION, {
        kind: INTERACTION.INTERACT,
        playerId: player.id,
        target: { x: target.x, y: target.y, z: target.z },
        block: blockDef.name,
      });
    }
    return result ?? { ok: true };
  }

  // --------------------------------------------------------------- HARVEST

  /**
   * Begin (or restart) mining a block. Returns the time the player must spend.
   * @param {import('./player.js').Player} player
   * @param {{ x: number, y: number, z: number }} target
   * @param {{ now?: number }} [options]
   */
  beginHarvest(player, target, { now = Date.now(), ...options } = {}) {
    const valid = this.validateTarget(player, target, options);
    if (!valid.ok) return valid;

    const blockDef = this.world.getBlockDef(target.x, target.y, target.z);
    const seconds = computeHarvestSeconds(blockDef, player.toolContext());
    if (seconds === null) return { ok: false, reason: `${blockDef?.name ?? 'block'} cannot be harvested` };

    this._harvesting.set(player.id, {
      x: target.x,
      y: target.y,
      z: target.z,
      startedAt: now,
      seconds,
    });
    return { ok: true, seconds, startedAt: now };
  }

  /** Forget a player's mining progress (they looked away or disconnected). */
  cancelHarvest(playerId) {
    return this._harvesting.delete(playerId);
  }

  /**
   * Complete a harvest: break the block, roll drops, damage the tool and
   * schedule regrowth.
   *
   * @param {import('./player.js').Player} player
   * @param {{ x: number, y: number, z: number }} target
   * @param {{ now?: number, force?: boolean }} [options]
   */
  harvest(player, target, { now = Date.now(), force = false, ...options } = {}) {
    const valid = this.validateTarget(player, target, options);
    if (!valid.ok) return valid;

    const blockDef = this.world.getBlockDef(target.x, target.y, target.z);
    if (!blockDef || blockDef.hardness === null) {
      return { ok: false, reason: `${blockDef?.name ?? 'block'} cannot be harvested` };
    }

    if (!force) {
      const progress = this._harvesting.get(player.id);
      const matches =
        progress && progress.x === target.x && progress.y === target.y && progress.z === target.z;
      if (!matches) {
        const started = this.beginHarvest(player, target, { now, ...options });
        return started.ok
          ? { ok: false, reason: 'harvest in progress', seconds: started.seconds }
          : started;
      }
      // 50 ms of latency slack so a punctual client is never rejected.
      if (now - progress.startedAt + 50 < progress.seconds * 1000) {
        return {
          ok: false,
          reason: 'harvest in progress',
          remaining: progress.seconds - (now - progress.startedAt) / 1000,
        };
      }
    }
    this._harvesting.delete(player.id);

    const tool = player.toolContext();
    const rng = this.world.randomAt(target.x, target.y, target.z, Math.floor(now / 1000));
    const drops = this.content.rollBlockDrops(blockDef.id, rng, tool);

    // Spill a container's contents before the block that held them vanishes.
    let spilled = [];
    if (blockDef.tileEntity === CONTAINER_KIND && this.groundItems) {
      const handle = openContainer({
        world: this.world,
        content: this.content,
        x: target.x,
        y: target.y,
        z: target.z,
      });
      if (handle) {
        spilled = handle.inventory.slots.filter(Boolean).map((slot) => ({ ...slot }));
        handle.inventory.slots.fill(null);
        handle.save();
      }
    }

    this.world.setBlock(target.x, target.y, target.z, 0, {
      source: 'harvest',
      actorId: player.id,
    });

    if (blockDef.regrow) {
      this.world.scheduleRegrowth(
        target.x,
        target.y,
        target.z,
        blockDef.regrow.into,
        now + blockDef.regrow.seconds * 1000,
      );
    }

    const awarded = this._awardDrops(player, [...drops, ...spilled], target, now);
    const toolSlot = player.toolSlot();
    const toolResult = toolSlot ? player.equipment.damage(toolSlot, 1) : null;

    this.bus.emit(EVENTS.INTERACTION, {
      kind: INTERACTION.HARVEST,
      playerId: player.id,
      target: { x: target.x, y: target.y, z: target.z },
      block: blockDef.name,
      drops: awarded,
    });

    return { ok: true, block: blockDef.name, drops: awarded, toolBroke: toolResult?.broken ?? false };
  }

  /**
   * Give drops to the harvester, falling back to ground items when the
   * inventory is full (or when `collectDrops` is off).
   */
  _awardDrops(player, drops, target, now) {
    const awarded = [];
    for (const drop of drops) {
      let remaining = drop.count;
      if (this.collectDrops) {
        const result = player.inventory.add(drop.item, drop.count, drop.meta ?? null);
        remaining = result.remaining;
        if (result.added > 0) awarded.push({ item: drop.item, count: result.added, to: 'inventory' });
      }
      if (remaining > 0 && this.groundItems) {
        this.groundItems.spawn({
          x: target.x + 0.5,
          y: target.y + 0.5,
          z: target.z + 0.5,
          item: drop.item,
          count: remaining,
          meta: drop.meta ?? null,
          ownerId: player.id,
          now,
        });
        awarded.push({ item: drop.item, count: remaining, to: 'ground' });
      } else if (remaining > 0) {
        // No ground-item manager configured: report the loss rather than
        // discarding it silently.
        awarded.push({ item: drop.item, count: remaining, to: 'lost' });
      }
    }
    return awarded;
  }

  // ----------------------------------------------------------------- PLACE

  /**
   * Place a block from an inventory slot.
   *
   * @param {import('./player.js').Player} player
   * @param {{
   *   slot?: number,
   *   target: { x: number, y: number, z: number },
   *   occupants?: { x: number, y: number, z: number }[],
   * }} params
   */
  place(player, { slot = null, target, occupants = [] } = {}, options = {}) {
    const index = slot ?? player.inventory.selectedSlot;
    const stack = player.inventory.getSlot(index);
    if (!stack) return { ok: false, reason: 'nothing to place' };

    const itemDef = this.content.items.get(stack.item);
    if (!itemDef?.placeable) return { ok: false, reason: `${itemDef?.name ?? stack.item} is not placeable` };

    const valid = this.validatePlacement(player, target, itemDef.placeable, occupants, options);
    if (!valid.ok) return valid;

    const blockId = this.content.blockId(itemDef.placeable);
    this.world.setBlock(target.x, target.y, target.z, blockId, {
      source: 'place',
      actorId: player.id,
    });

    const blockDef = this.content.block(blockId);
    if (blockDef.tileEntity === CONTAINER_KIND) {
      openContainer({ world: this.world, content: this.content, ...target });
    }

    player.inventory.removeFromSlot(index, 1);

    this.bus.emit(EVENTS.INTERACTION, {
      kind: INTERACTION.PLACE,
      playerId: player.id,
      target: { ...target },
      block: blockDef.name,
    });
    return { ok: true, block: blockDef.name };
  }

  /**
   * Placement rules: in reach, target replaceable, supported if required, and
   * never inside a player.
   */
  validatePlacement(player, target, blockName, occupants = [], options = {}) {
    if (!target || !Number.isInteger(target.x) || !Number.isInteger(target.y) || !Number.isInteger(target.z)) {
      return { ok: false, reason: 'invalid target' };
    }
    const reach = options.reach ?? this.reach;
    const eye = player.eyePosition;
    if (distanceToBlockCenter(eye, target.x, target.y, target.z) > reach + 0.87) {
      return { ok: false, reason: 'out of reach' };
    }
    if (!this.world.isReplaceable(target.x, target.y, target.z)) {
      return { ok: false, reason: 'space is occupied' };
    }

    const blockDef = this.content.blockByName(blockName);
    if (!blockDef) return { ok: false, reason: `unknown block "${blockName}"` };
    if (blockDef.support === 'below' && !this.world.isSolid(target.x, target.y - 1, target.z)) {
      return { ok: false, reason: `${blockDef.name} needs solid ground` };
    }

    if (blockDef.solid) {
      const bodies = [player.position, ...occupants];
      for (const body of bodies) {
        if (playerOccupies(body, target.x, target.y, target.z)) {
          return { ok: false, reason: 'a player is standing there' };
        }
      }
    }
    return { ok: true };
  }

  // -------------------------------------------------------------- dispatch

  /**
   * Single entry point used by the network layer. New interaction classes are
   * added with `registerClass`, not with another branch here.
   * @param {string} kind one of `INTERACTION`
   * @param {import('./player.js').Player} player
   * @param {object} params
   */
  perform(kind, player, params = {}) {
    return this.classHandlers.dispatch(kind, player, params, this);
  }
}
