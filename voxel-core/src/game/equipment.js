/**
 * Equipment slots and derived stats.
 *
 * Equipping is validated against the item's declared `equipSlot`, and stats
 * are recomputed from scratch whenever the set changes: there is no
 * incremental bookkeeping to get out of sync.
 */

import { EVENTS } from '../core/event-bus.js';

/** Start small; adding a slot is one entry here plus item definitions. */
export const EQUIP_SLOTS = ['head', 'chest', 'legs', 'feet', 'main_hand', 'off_hand'];

export class Equipment {
  /**
   * @param {{
   *   content: import('../content/index.js').Content,
   *   slots?: string[],
   *   bus?: import('../core/event-bus.js').EventBus,
   *   ownerId?: string|null,
   * }} config
   */
  constructor({ content, slots = EQUIP_SLOTS, bus = null, ownerId = null }) {
    this.content = content;
    this.slotNames = [...slots];
    this.bus = bus;
    this.ownerId = ownerId;
    /** @type {Record<string, { item: string, meta?: object }|null>} */
    this.slots = Object.fromEntries(this.slotNames.map((name) => [name, null]));
  }

  _emit(reason, detail = {}) {
    this.bus?.emit(EVENTS.EQUIPMENT_CHANGED, { ownerId: this.ownerId, reason, ...detail });
  }

  /** @param {string} slotName */
  get(slotName) {
    return this.slots[slotName] ?? null;
  }

  /** The item definition currently in a slot, or null. */
  getDefinition(slotName) {
    const equipped = this.get(slotName);
    return equipped ? this.content.items.get(equipped.item) ?? null : null;
  }

  /** The item definition in the main hand; the tool used for harvesting. */
  get mainHand() {
    return this.getDefinition('main_hand');
  }

  /**
   * Equip a stack.
   * @param {{ item: string, meta?: object }} stack
   * @param {string|null} [slotName] defaults to the item's declared slot
   * @returns {{ ok: boolean, reason?: string, replaced?: object|null }}
   */
  equip(stack, slotName = null) {
    const definition = this.content.items.get(stack?.item);
    if (!definition) return { ok: false, reason: 'unknown item' };
    if (!definition.equipSlot) return { ok: false, reason: `${definition.name} is not equippable` };

    const target = slotName ?? definition.equipSlot;
    if (!this.slotNames.includes(target)) return { ok: false, reason: `no such slot "${target}"` };
    if (definition.equipSlot !== target) {
      return { ok: false, reason: `${definition.name} does not fit the ${target} slot` };
    }

    const replaced = this.slots[target];
    const equipped = { item: stack.item };
    if (stack.meta) equipped.meta = structuredClone(stack.meta);
    if (definition.durability !== null && equipped.meta?.durability === undefined) {
      equipped.meta = { ...(equipped.meta ?? {}), durability: definition.durability };
    }
    this.slots[target] = equipped;
    this._emit('equip', { slot: target, item: stack.item });
    return { ok: true, replaced };
  }

  /**
   * Remove whatever is in a slot.
   * @param {string} slotName
   * @returns {{ item: string, meta?: object }|null}
   */
  unequip(slotName) {
    const equipped = this.slots[slotName] ?? null;
    if (!equipped) return null;
    this.slots[slotName] = null;
    this._emit('unequip', { slot: slotName, item: equipped.item });
    return equipped;
  }

  /**
   * Spend durability on the item in a slot.
   * @param {string} slotName
   * @param {number} [amount]
   * @returns {{ changed: boolean, broken: boolean, remaining: number|null }}
   */
  damage(slotName, amount = 1) {
    const equipped = this.get(slotName);
    const definition = this.getDefinition(slotName);
    if (!equipped || !definition || definition.durability === null) {
      return { changed: false, broken: false, remaining: null };
    }
    const current = equipped.meta?.durability ?? definition.durability;
    const remaining = Math.max(0, current - amount);
    equipped.meta = { ...(equipped.meta ?? {}), durability: remaining };

    if (remaining === 0) {
      this.slots[slotName] = null;
      this._emit('broke', { slot: slotName, item: equipped.item });
      this.bus?.emit(EVENTS.ITEM_BROKE, { ownerId: this.ownerId, slot: slotName, item: equipped.item });
      return { changed: true, broken: true, remaining: 0 };
    }
    this._emit('damage', { slot: slotName, item: equipped.item, remaining });
    return { changed: true, broken: false, remaining };
  }

  /**
   * Sum every equipped item's flat stat contributions.
   * @returns {Record<string, number>}
   */
  aggregateStats() {
    /** @type {Record<string, number>} */
    const totals = {};
    for (const slotName of this.slotNames) {
      const definition = this.getDefinition(slotName);
      if (!definition?.stats) continue;
      for (const [stat, value] of Object.entries(definition.stats)) {
        totals[stat] = (totals[stat] ?? 0) + value;
      }
    }
    return totals;
  }

  /**
   * The compact shape other players need in order to render this character.
   * @returns {Record<string, string|null>}
   */
  toVisual() {
    return Object.fromEntries(this.slotNames.map((name) => [name, this.slots[name]?.item ?? null]));
  }

  toJSON() {
    return Object.fromEntries(
      this.slotNames.map((name) => [name, this.slots[name] ? { ...this.slots[name] } : null]),
    );
  }

  /** @param {object} json */
  loadJSON(json) {
    if (!json) return this;
    for (const name of this.slotNames) {
      const equipped = json[name];
      // Drop items that no longer exist in content rather than failing the load.
      this.slots[name] = equipped && this.content.items.has(equipped.item) ? { ...equipped } : null;
    }
    return this;
  }
}
