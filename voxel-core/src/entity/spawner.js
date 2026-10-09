/**
 * Spawner.
 *
 * Periodically tops up the wildlife around each player from the spawn-rule
 * table: picks a loaded column at a comfortable distance, finds the rules that
 * match its biome and surface block, draws one weighted by rarity and places a
 * group there. Spawning is pure data lookup; no rule is special-cased.
 */

import { Random, hashString } from '../core/rng.js';
import { blockToChunk } from '../world/coords.js';
import { resolveSpawnY } from '../world/physics.js';
import { RARITY_WEIGHTS } from '../content/entities.js';

export const DEFAULT_SPAWN_OPTIONS = {
  /** Living entities allowed within `radius` of a player before spawning stops. */
  cap: 8,
  radius: 48,
  minDistance: 18,
  intervalMs: 4000,
  attempts: 4,
};

export class Spawner {
  /**
   * @param {{
   *   content: import('../content/index.js').Content,
   *   world: import('../world/world.js').World,
   *   entities: import('./entity-manager.js').EntityManager,
   *   seed?: string|number,
   *   options?: Partial<typeof DEFAULT_SPAWN_OPTIONS>,
   * }} config
   */
  constructor({ content, world, entities, seed = 'spawner', options = {} }) {
    this.content = content;
    this.world = world;
    this.entities = entities;
    this.options = { ...DEFAULT_SPAWN_OPTIONS, ...options };
    this.rng = new Random(typeof seed === 'number' ? seed : hashString(String(seed)));
    this._lastSpawnAt = 0;
  }

  /**
   * Spawn rules that may place something on a given column.
   * @param {number} x @param {number} z
   */
  rulesAt(x, z) {
    const biome = this.world.generator?.biomeAt?.(x, z)?.id ?? null;
    const top = this.world.heightAt(x, z);
    const surface = this.world.getBlockDef(x, top, z)?.name ?? null;
    return this.content.spawnRules
      .all()
      .filter((rule) => (rule.biomes.includes('*') || rule.biomes.includes(biome)) && rule.surface.includes(surface));
  }

  /**
   * Try to spawn around each player position.
   * @param {{ x: number, z: number }[]} players
   * @param {number} [now]
   * @returns {object[]} spawned entities
   */
  tick(players, now = Date.now()) {
    if (now - this._lastSpawnAt < this.options.intervalMs) return [];
    this._lastSpawnAt = now;
    const spawned = [];
    for (const player of players) {
      const room = this.options.cap - this.entities.aliveNear(player, this.options.radius).length;
      if (room <= 0) continue;
      for (let i = 0; i < this.options.attempts; i++) {
        const group = this._trySpawnNear(player, now, room);
        if (group.length > 0) {
          spawned.push(...group);
          break;
        }
      }
    }
    return spawned;
  }

  _trySpawnNear(player, now, room) {
    const { minDistance, radius } = this.options;
    const angle = this.rng.range(0, Math.PI * 2);
    const distance = this.rng.range(minDistance, radius);
    const x = Math.floor(player.x + Math.cos(angle) * distance);
    const z = Math.floor(player.z + Math.sin(angle) * distance);
    if (!this.world.isLoaded(blockToChunk(x), blockToChunk(z))) return [];

    const rules = this.rulesAt(x, z);
    if (rules.length === 0) return [];
    const rule = this.rng.pickWeighted(rules.map((r) => ({ rule: r, weight: RARITY_WEIGHTS[r.rarity] }))).rule;
    return this.spawnGroup(rule, x, z, now, room);
  }

  /**
   * Place one group for a rule around a column.
   * @param {object} rule
   * @param {number} x @param {number} z
   * @param {number} [now]
   * @param {number} [max] most members to place
   */
  spawnGroup(rule, x, z, now = Date.now(), max = Infinity) {
    const isSolid = (bx, by, bz) => this.world.isSolid(bx, by, bz);
    const count = Math.min(max, this.rng.int(rule.group[0], rule.group[1]));
    const out = [];
    for (let i = 0; i < count; i++) {
      const gx = x + this.rng.int(-3, 3);
      const gz = z + this.rng.int(-3, 3);
      if (!this.world.isLoaded(blockToChunk(gx), blockToChunk(gz))) continue;
      if (!this.rulesAt(gx, gz).includes(rule)) continue;
      const surface = this.world.surfacePosition(gx, gz);
      const y = resolveSpawnY(isSolid, surface.x, surface.z, surface.y);
      out.push(this.entities.spawn(rule.entity, { x: surface.x, y, z: surface.z }, { now }));
    }
    return out;
  }
}
