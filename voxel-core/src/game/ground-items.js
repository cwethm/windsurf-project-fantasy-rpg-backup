/**
 * Ground items.
 *
 * Dropped or harvested stacks become short-lived world entities. The harvester
 * gets an exclusive pickup window so a bystander cannot snipe their drops, and
 * everything despawns on a timer so a long-running world does not accumulate
 * junk forever.
 */

import { GROUND_ITEM_TTL, GROUND_ITEM_OWNER_WINDOW } from '../core/constants.js';
import { EVENTS } from '../core/event-bus.js';

let nextId = 1;

export class GroundItemManager {
  /**
   * @param {{
   *   content: import('../content/index.js').Content,
   *   bus?: import('../core/event-bus.js').EventBus,
   *   ttlSeconds?: number,
   *   ownerWindowSeconds?: number,
   * }} config
   */
  constructor({ content, bus = null, ttlSeconds = GROUND_ITEM_TTL, ownerWindowSeconds = GROUND_ITEM_OWNER_WINDOW }) {
    this.content = content;
    this.bus = bus;
    this.ttlSeconds = ttlSeconds;
    this.ownerWindowSeconds = ownerWindowSeconds;
    /** @type {Map<string, object>} */
    this.items = new Map();
  }

  /**
   * Drop a stack into the world.
   * @param {{
   *   x: number, y: number, z: number,
   *   item: string, count?: number, meta?: object|null,
   *   ownerId?: string|null,
   *   now?: number,
   * }} spec
   */
  spawn({ x, y, z, item, count = 1, meta = null, ownerId = null, now = Date.now() }) {
    if (!this.content.items.has(item)) throw new Error(`cannot drop unknown item "${item}"`);
    const entity = {
      id: `gi_${nextId++}`,
      x,
      y,
      z,
      item,
      count,
      meta: meta ? structuredClone(meta) : null,
      ownerId,
      ownerUntil: ownerId ? now + this.ownerWindowSeconds * 1000 : 0,
      despawnAt: now + this.ttlSeconds * 1000,
    };
    this.items.set(entity.id, entity);
    this.bus?.emit(EVENTS.ITEM_DROPPED, { entity });
    return entity;
  }

  /** @param {string} id */
  get(id) {
    return this.items.get(id) ?? null;
  }

  /**
   * Items within `radius` blocks of a position.
   * @param {{ x: number, y: number, z: number }} position
   * @param {number} radius
   */
  near(position, radius) {
    const result = [];
    const radiusSq = radius * radius;
    for (const entity of this.items.values()) {
      const dx = entity.x - position.x;
      const dy = entity.y - position.y;
      const dz = entity.z - position.z;
      if (dx * dx + dy * dy + dz * dz <= radiusSq) result.push(entity);
    }
    return result;
  }

  /**
   * Attempt a pickup. Respects the owner window, reach and inventory space.
   * @param {string} entityId
   * @param {import('./player.js').Player} player
   * @param {{ reach?: number, now?: number }} [options]
   * @returns {{ ok: boolean, reason?: string, picked?: object }}
   */
  pickup(entityId, player, { reach = 3, now = Date.now() } = {}) {
    const entity = this.items.get(entityId);
    if (!entity) return { ok: false, reason: 'item no longer exists' };

    const dx = entity.x - player.position.x;
    const dy = entity.y - player.position.y;
    const dz = entity.z - player.position.z;
    if (Math.hypot(dx, dy, dz) > reach) return { ok: false, reason: 'out of reach' };

    if (entity.ownerId && entity.ownerId !== player.id && entity.ownerUntil > now) {
      return { ok: false, reason: 'reserved for another player' };
    }

    const { added, remaining } = player.inventory.add(entity.item, entity.count, entity.meta);
    if (added === 0) return { ok: false, reason: 'inventory full' };

    if (remaining > 0) {
      entity.count = remaining;
    } else {
      this.items.delete(entityId);
    }
    this.bus?.emit(EVENTS.ITEM_PICKED_UP, { entity, playerId: player.id, count: added });
    return { ok: true, picked: { item: entity.item, count: added }, fullyTaken: remaining === 0 };
  }

  /**
   * Remove expired entities.
   * @param {number} [now]
   * @returns {string[]} ids that despawned
   */
  tick(now = Date.now()) {
    const removed = [];
    for (const [id, entity] of this.items) {
      if (entity.despawnAt <= now) {
        this.items.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }

  get size() {
    return this.items.size;
  }

  toJSON() {
    return [...this.items.values()].map((entity) => ({ ...entity }));
  }

  /** @param {object[]} json @param {number} [now] */
  loadJSON(json, now = Date.now()) {
    this.items.clear();
    for (const entity of json ?? []) {
      if (!this.content.items.has(entity.item)) continue;
      if (entity.despawnAt <= now) continue;
      this.items.set(entity.id, { ...entity });
      const numericId = Number(String(entity.id).replace('gi_', ''));
      if (Number.isFinite(numericId) && numericId >= nextId) nextId = numericId + 1;
    }
    return this;
  }
}
