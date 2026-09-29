/**
 * Character state: vitals, buffs, knowledge and derived stats.
 *
 * Derived stats are always `base + equipment + buffs`, recomputed on demand.
 * Buffs are named effects with a duration and stacking rule, so "swiftness
 * potion" and "well fed" are the same mechanism with different data.
 */

import { EVENTS } from '../core/event-bus.js';

/** Stat names the core understands. Games may add their own freely. */
export const BASE_STATS = {
  health: 20,
  defense: 0,
  attack: 1,
  move_speed: 1,
  health_regen: 0,
};

/** How repeated applications of the same buff combine. */
export const STACKING = {
  /** Later application replaces the earlier one. */
  REPLACE: 'replace',
  /** Durations add up, magnitude unchanged. */
  EXTEND: 'extend',
  /** Magnitudes add up, duration refreshed. */
  STACK: 'stack',
};

export class Character {
  /**
   * @param {{
   *   content: import('../content/index.js').Content,
   *   equipment?: import('./equipment.js').Equipment,
   *   bus?: import('../core/event-bus.js').EventBus,
   *   ownerId?: string|null,
   *   baseStats?: Record<string, number>,
   * }} config
   */
  constructor({ content, equipment = null, bus = null, ownerId = null, baseStats = {} }) {
    this.content = content;
    this.equipment = equipment;
    this.bus = bus;
    this.ownerId = ownerId;
    this.baseStats = { ...BASE_STATS, ...baseStats };

    this.health = this.baseStats.health;
    this.energy = 100;
    this.maxEnergy = 100;
    this.level = 1;
    this.experience = 0;
    /** @type {Map<string, { id: string, stat: string, magnitude: number, expiresAt: number, stacking: string }>} */
    this.buffs = new Map();
    /** @type {Set<string>} learned recipes, skills and spells */
    this.knowledge = new Set();
  }

  // ----------------------------------------------------------------- vitals

  get maxHealth() {
    return this.getStat('health');
  }

  /** @param {number} amount positive heals, negative damages */
  changeHealth(amount) {
    const before = this.health;
    this.health = Math.max(0, Math.min(this.maxHealth, this.health + amount));
    if (this.health !== before) this._emitStats('health');
    return this.health;
  }

  get isAlive() {
    return this.health > 0;
  }

  /** @param {number} amount */
  changeEnergy(amount) {
    const before = this.energy;
    this.energy = Math.max(0, Math.min(this.maxEnergy, this.energy + amount));
    if (this.energy !== before) this._emitStats('energy');
    return this.energy;
  }

  /** @param {number} amount */
  addExperience(amount) {
    if (amount <= 0) return this.level;
    this.experience += amount;
    let levelled = false;
    while (this.experience >= this.experienceForNextLevel()) {
      this.experience -= this.experienceForNextLevel();
      this.level += 1;
      levelled = true;
    }
    if (levelled) this._emitStats('level');
    return this.level;
  }

  experienceForNextLevel() {
    return 50 + (this.level - 1) * 25;
  }

  // ------------------------------------------------------------------ buffs

  /**
   * Apply a buff or debuff.
   * @param {{ id: string, stat: string, magnitude: number, duration: number, stacking?: string }} buff
   * @param {number} [now] epoch milliseconds
   */
  applyBuff(buff, now = Date.now()) {
    const stacking = buff.stacking ?? STACKING.REPLACE;
    const existing = this.buffs.get(buff.id);
    let next;

    if (existing && stacking === STACKING.EXTEND) {
      next = { ...existing, expiresAt: Math.max(existing.expiresAt, now) + buff.duration * 1000 };
    } else if (existing && stacking === STACKING.STACK) {
      next = {
        ...existing,
        magnitude: existing.magnitude + buff.magnitude,
        expiresAt: now + buff.duration * 1000,
      };
    } else {
      next = {
        id: buff.id,
        stat: buff.stat,
        magnitude: buff.magnitude,
        stacking,
        expiresAt: now + buff.duration * 1000,
      };
    }

    this.buffs.set(buff.id, next);
    this.bus?.emit(EVENTS.BUFF_APPLIED, { ownerId: this.ownerId, buff: next });
    this._emitStats('buff');
    return next;
  }

  /** @param {string} buffId */
  removeBuff(buffId) {
    const buff = this.buffs.get(buffId);
    if (!buff) return false;
    this.buffs.delete(buffId);
    this.bus?.emit(EVENTS.BUFF_EXPIRED, { ownerId: this.ownerId, buff });
    this._emitStats('buff');
    return true;
  }

  /** @param {string} buffId */
  hasBuff(buffId) {
    return this.buffs.has(buffId);
  }

  /**
   * Drop expired buffs. Call from the server tick.
   * @param {number} [now]
   * @returns {number} number of buffs that expired
   */
  expireBuffs(now = Date.now()) {
    let expired = 0;
    for (const [id, buff] of [...this.buffs]) {
      if (buff.expiresAt > now) continue;
      this.buffs.delete(id);
      this.bus?.emit(EVENTS.BUFF_EXPIRED, { ownerId: this.ownerId, buff });
      expired += 1;
    }
    if (expired > 0) this._emitStats('buff-expiry');
    return expired;
  }

  // -------------------------------------------------------------- knowledge

  /**
   * Learn a recipe, skill or spell.
   * @param {string} id
   * @returns {boolean} false when it was already known
   */
  learn(id) {
    if (this.knowledge.has(id)) return false;
    this.knowledge.add(id);
    this.bus?.emit(EVENTS.KNOWLEDGE_LEARNED, { ownerId: this.ownerId, knowledge: id });
    return true;
  }

  /** @param {string} id */
  knows(id) {
    return this.knowledge.has(id);
  }

  // ----------------------------------------------------------- derived stats

  /**
   * Derived value of a stat: base + equipment + active buffs.
   * @param {string} stat
   * @param {number} [now]
   */
  getStat(stat, now = Date.now()) {
    let value = this.baseStats[stat] ?? 0;
    const equipStats = this.equipment?.aggregateStats() ?? {};
    value += equipStats[stat] ?? 0;
    for (const buff of this.buffs.values()) {
      if (buff.stat === stat && buff.expiresAt > now) value += buff.magnitude;
    }
    return value;
  }

  /** Every derived stat in one object, for sending to the client. */
  getStats(now = Date.now()) {
    const names = new Set([
      ...Object.keys(this.baseStats),
      ...Object.keys(this.equipment?.aggregateStats() ?? {}),
      ...[...this.buffs.values()].map((b) => b.stat),
    ]);
    return Object.fromEntries([...names].map((stat) => [stat, this.getStat(stat, now)]));
  }

  _emitStats(reason) {
    this.bus?.emit(EVENTS.STATS_CHANGED, { ownerId: this.ownerId, reason });
  }

  // ------------------------------------------------------------ persistence

  toJSON() {
    return {
      health: this.health,
      energy: this.energy,
      level: this.level,
      experience: this.experience,
      knowledge: [...this.knowledge],
      buffs: [...this.buffs.values()].map((buff) => ({ ...buff })),
    };
  }

  /**
   * Restore persisted state. Buffs keep their absolute expiry so a player who
   * logs back in after the duration elapsed does not get free uptime.
   * @param {object} json
   * @param {number} [now]
   */
  loadJSON(json, now = Date.now()) {
    if (!json) return this;
    this.health = json.health ?? this.health;
    this.energy = json.energy ?? this.energy;
    this.level = json.level ?? 1;
    this.experience = json.experience ?? 0;
    this.knowledge = new Set(json.knowledge ?? []);
    this.buffs = new Map(
      (json.buffs ?? [])
        .filter((buff) => buff.expiresAt > now)
        .map((buff) => [buff.id, { ...buff }]),
    );
    return this;
  }
}
