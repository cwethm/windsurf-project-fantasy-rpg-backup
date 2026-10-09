/**
 * Entity manager.
 *
 * Owns every non-player entity on the server: spawning, the AI and physics
 * step, damage, death into a corpse, butchering, and despawning. Entities are
 * plain objects so they serialise trivially; behaviour comes from the brain
 * registry and appearance/size from the definition's form code.
 */

import { EVENTS } from '../core/event-bus.js';
import { Random, hashCoords, hashString } from '../core/rng.js';
import { JUMP_VELOCITY, CORPSE_TTL } from '../core/constants.js';
import { stepPhysics } from '../world/physics.js';
import { blockToChunk } from '../world/coords.js';
import { rollLootTable } from '../content/loot.js';
import { resolveForm, formDimensions } from './form-code.js';
import { BRAINS } from './brains.js';

let nextId = 1;

export class EntityManager {
  /**
   * @param {{
   *   content: import('../content/index.js').Content,
   *   world: import('../world/world.js').World,
   *   bus?: import('../core/event-bus.js').EventBus,
   *   seed?: string|number,
   *   brains?: import('../core/registry.js').HandlerRegistry,
   * }} config
   */
  constructor({ content, world, bus = null, seed = 'entities', brains = BRAINS }) {
    this.content = content;
    this.world = world;
    this.bus = bus;
    this.brains = brains;
    this.seed = typeof seed === 'number' ? seed >>> 0 : hashString(String(seed));
    /** @type {Map<string, object>} */
    this.entities = new Map();
    for (const def of content.entities.all()) {
      if (!brains.has(def.brain)) throw new Error(`entity "${def.id}" uses unknown brain "${def.brain}"`);
    }
  }

  /**
   * @param {string} defId
   * @param {{ x: number, y: number, z: number }} position feet position
   * @param {{ seed?: number, now?: number }} [options]
   */
  spawn(defId, position, { seed, now = Date.now() } = {}) {
    const def = this.content.entities.require(defId);
    const id = `en_${nextId++}`;
    const individual = seed ?? hashCoords(this.seed, nextId, Math.floor(position.x), Math.floor(position.z));
    const rng = new Random(individual);
    const scale = rng.range(def.traits.size[0], def.traits.size[1]);
    const dims = formDimensions(resolveForm(def.form, { seed: individual, scale }));
    const health = Math.max(1, Math.round(def.stats.health * scale));
    const entity = {
      id,
      def,
      seed: individual,
      scale,
      dims,
      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },
      home: { x: position.x, z: position.z },
      yaw: rng.range(-Math.PI, Math.PI),
      onGround: false,
      health,
      maxHealth: health,
      state: 'alive',
      anim: 'idle',
      intent: null,
      threat: null,
      rng,
      corpseUntil: 0,
      harvested: false,
      version: 1,
      spawnedAt: now,
    };
    this.entities.set(id, entity);
    this.bus?.emit(EVENTS.ENTITY_SPAWNED, { id, def: def.id, position: { ...position } });
    return entity;
  }

  /** @param {string} id */
  get(id) {
    return this.entities.get(id) ?? null;
  }

  all() {
    return [...this.entities.values()];
  }

  /**
   * Entities whose position lies within `radius` blocks (horizontal) of a point.
   * @param {{ x: number, z: number }} position
   * @param {number} radius
   */
  near(position, radius) {
    const out = [];
    const r2 = radius * radius;
    for (const entity of this.entities.values()) {
      const dx = entity.position.x - position.x;
      const dz = entity.position.z - position.z;
      if (dx * dx + dz * dz <= r2) out.push(entity);
    }
    return out;
  }

  /** Living entities near a point. */
  aliveNear(position, radius) {
    return this.near(position, radius).filter((e) => e.state === 'alive');
  }

  /**
   * Apply damage. A living entity that reaches 0 health becomes a corpse.
   * @param {string} id
   * @param {number} amount
   * @param {{ attackerId?: string|null, from?: { x: number, z: number }|null, now?: number }} [source]
   * @returns {{ ok: boolean, reason?: string, damage?: number, health?: number, killed?: boolean }}
   */
  damage(id, amount, { attackerId = null, from = null, now = Date.now() } = {}) {
    const entity = this.entities.get(id);
    if (!entity) return { ok: false, reason: 'no such entity' };
    if (entity.state !== 'alive') return { ok: false, reason: 'already dead' };
    const damage = Math.max(1, Math.round(amount - entity.def.stats.defense));
    entity.health = Math.max(0, entity.health - damage);
    entity.version += 1;
    if (from) entity.threat = { x: from.x, z: from.z, id: attackerId, until: now + 6000 };
    entity.intent = null;
    this.bus?.emit(EVENTS.ENTITY_DAMAGED, { id, damage, health: entity.health, attackerId });

    if (entity.health > 0) return { ok: true, damage, health: entity.health, killed: false };

    entity.state = 'corpse';
    entity.anim = 'dead';
    entity.velocity = { x: 0, y: entity.velocity.y, z: 0 };
    entity.intent = null;
    entity.threat = null;
    entity.corpseUntil = now + (entity.def.corpse ?? CORPSE_TTL) * 1000;
    this.bus?.emit(EVENTS.ENTITY_DIED, { id, def: entity.def.id, attackerId, position: { ...entity.position } });
    return { ok: true, damage, health: 0, killed: true };
  }

  /**
   * Butcher a corpse: roll its harvest table with the harvester's tool and
   * knowledge, then remove it. Gated entries fall back to rare real drops or
   * ruined items (see `rollLootTable`).
   * @param {string} id
   * @param {object} context tool context from `Player.toolContext()`
   * @param {{ now?: number, harvesterId?: string|null }} [options]
   * @returns {{ ok: boolean, reason?: string, drops?: { item: string, count: number }[], position?: object }}
   */
  butcher(id, context, { now = Date.now(), harvesterId = null } = {}) {
    const entity = this.entities.get(id);
    if (!entity) return { ok: false, reason: 'no such entity' };
    if (entity.state !== 'corpse') return { ok: false, reason: 'not a corpse' };
    const table = entity.def.harvest ? this.content.loot.get(entity.def.harvest) : null;
    const rng = new Random(hashCoords(entity.seed, Math.floor(now / 1000)));
    const drops = rollLootTable(table, rng, context);
    this.entities.delete(id);
    this.bus?.emit(EVENTS.ENTITY_HARVESTED, { id, def: entity.def.id, harvesterId, drops });
    return { ok: true, drops, position: { ...entity.position } };
  }

  /**
   * Remove an entity outright.
   * @param {string} id
   * @param {string} [reason]
   */
  remove(id, reason = 'despawn') {
    const entity = this.entities.get(id);
    if (!entity) return false;
    this.entities.delete(id);
    this.bus?.emit(EVENTS.ENTITY_DESPAWNED, { id, def: entity.def.id, reason });
    return true;
  }

  /**
   * Advance AI and physics.
   * @param {number} dt seconds
   * @param {{ now?: number, keepNear?: { x: number, z: number }[], despawnRadius?: number }} [options]
   *   `keepNear` lists player positions; wild entities farther than
   *   `despawnRadius` from all of them are removed.
   * @returns {{ removed: string[] }}
   */
  tick(dt, { now = Date.now(), keepNear = null, despawnRadius = 96 } = {}) {
    const removed = [];
    const isSolid = (x, y, z) => this.world.isSolid(x, y, z);
    for (const entity of [...this.entities.values()]) {
      if (entity.state === 'corpse' && now >= entity.corpseUntil) {
        this.remove(entity.id, 'rotted');
        removed.push(entity.id);
        continue;
      }
      if (keepNear && !keepNear.some((p) => Math.hypot(p.x - entity.position.x, p.z - entity.position.z) <= despawnRadius)) {
        this.remove(entity.id, 'out_of_range');
        removed.push(entity.id);
        continue;
      }
      const cx = blockToChunk(Math.floor(entity.position.x));
      const cz = blockToChunk(Math.floor(entity.position.z));
      if (!this.world.isLoaded(cx, cz)) continue;
      this._step(entity, dt, now, isSolid);
    }
    return { removed };
  }

  _step(entity, dt, now, isSolid) {
    const before = { x: entity.position.x, y: entity.position.y, z: entity.position.z, yaw: entity.yaw, anim: entity.anim };
    let wantX = 0;
    let wantZ = 0;
    if (entity.state === 'alive') {
      this.brains.dispatch(entity.def.brain, entity, { now, rng: entity.rng, manager: this });
      const intent = entity.intent;
      if (intent?.target && intent.speed > 0) {
        const dx = intent.target.x - entity.position.x;
        const dz = intent.target.z - entity.position.z;
        const length = Math.hypot(dx, dz);
        if (length > 0.3) {
          wantX = (dx / length) * intent.speed;
          wantZ = (dz / length) * intent.speed;
          const targetYaw = Math.atan2(-wantX, -wantZ);
          const turn = Math.atan2(Math.sin(targetYaw - entity.yaw), Math.cos(targetYaw - entity.yaw));
          entity.yaw += Math.max(-6 * dt, Math.min(6 * dt, turn));
        }
      }
      entity.anim = wantX || wantZ ? intent.anim : intent?.anim === 'graze' ? 'graze' : 'idle';
    }

    entity.velocity.x = wantX;
    entity.velocity.z = wantZ;
    const result = stepPhysics(
      { position: entity.position, velocity: entity.velocity },
      { dt, isSolid, width: entity.dims.width, height: entity.dims.height },
    );
    const blocked = (wantX !== 0 && result.velocity.x === 0) || (wantZ !== 0 && result.velocity.z === 0);
    if (blocked && result.onGround) result.velocity.y = JUMP_VELOCITY * 0.9;
    entity.position = result.position;
    entity.velocity = result.velocity;
    entity.onGround = result.onGround;

    if (
      Math.abs(before.x - entity.position.x) > 0.01 ||
      Math.abs(before.y - entity.position.y) > 0.01 ||
      Math.abs(before.z - entity.position.z) > 0.01 ||
      Math.abs(before.yaw - entity.yaw) > 0.02 ||
      before.anim !== entity.anim
    ) {
      entity.version += 1;
    }
  }

  /** Compact state for clients; the form is rebuilt from `def` + `seed` + `scale`. */
  toNetworkState(entity) {
    return {
      id: entity.id,
      def: entity.def.id,
      seed: entity.seed,
      scale: entity.scale,
      position: { ...entity.position },
      yaw: entity.yaw,
      anim: entity.anim,
      state: entity.state,
      health: entity.health,
      maxHealth: entity.maxHealth,
    };
  }
}
