/**
 * Slot-based inventory.
 *
 * A fixed grid of slots where the first `quickbarSize` entries are the
 * quickbar. Stacks are `{ item, count, meta? }`; `meta` carries per-instance
 * state such as durability, which is why two otherwise identical items only
 * merge when their metadata matches.
 */

import { INVENTORY_SLOTS, QUICKBAR_SLOTS } from '../core/constants.js';
import { EVENTS } from '../core/event-bus.js';

/** Deep equality for the small plain objects stored in stack metadata. */
export function metaEquals(a, b) {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'object' && av !== null) return metaEquals(av, bv);
    return av === bv;
  });
}

export class Inventory {
  /**
   * @param {{
   *   content: import('../content/index.js').Content,
   *   size?: number,
   *   quickbarSize?: number,
   *   bus?: import('../core/event-bus.js').EventBus,
   *   ownerId?: string|null,
   * }} config
   */
  constructor({ content, size = INVENTORY_SLOTS, quickbarSize = QUICKBAR_SLOTS, bus = null, ownerId = null }) {
    if (quickbarSize > size) throw new RangeError('quickbar cannot be larger than the inventory');
    this.content = content;
    this.size = size;
    this.quickbarSize = quickbarSize;
    this.bus = bus;
    this.ownerId = ownerId;
    /** @type {({ item: string, count: number, meta?: object }|null)[]} */
    this.slots = new Array(size).fill(null);
    /** @type {Set<number>} slots the player has locked against sorting/moving */
    this.lockedSlots = new Set();
    this.selectedSlot = 0;
  }

  _emit(reason, detail = {}) {
    this.bus?.emit(EVENTS.INVENTORY_CHANGED, { ownerId: this.ownerId, reason, ...detail });
  }

  /** @param {number} index */
  isValidSlot(index) {
    return Number.isInteger(index) && index >= 0 && index < this.size;
  }

  /** @param {number} index */
  getSlot(index) {
    return this.isValidSlot(index) ? this.slots[index] : null;
  }

  /** The stack in the currently selected quickbar slot. */
  getSelected() {
    return this.getSlot(this.selectedSlot);
  }

  /** @param {number} index */
  selectSlot(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.quickbarSize) return false;
    this.selectedSlot = index;
    return true;
  }

  /** @param {string} itemId */
  maxStackOf(itemId) {
    return this.content.items.get(itemId)?.maxStack ?? 1;
  }

  /**
   * Total count of an item across every slot.
   * @param {string} itemId
   */
  countOf(itemId) {
    return this.slots.reduce((sum, slot) => (slot?.item === itemId ? sum + slot.count : sum), 0);
  }

  /** @returns {number} number of empty slots */
  get freeSlots() {
    return this.slots.reduce((sum, slot) => (slot === null ? sum + 1 : sum), 0);
  }

  /**
   * Add an item stack, merging into partial stacks first and then filling
   * empty slots.
   * @param {string} itemId
   * @param {number} [count]
   * @param {object|null} [meta]
   * @returns {{ added: number, remaining: number }}
   */
  add(itemId, count = 1, meta = null) {
    const definition = this.content.items.get(itemId);
    if (!definition) throw new Error(`cannot add unknown item "${itemId}"`);
    if (!Number.isInteger(count) || count <= 0) return { added: 0, remaining: count };

    const maxStack = definition.maxStack;
    let remaining = count;

    if (maxStack > 1) {
      for (let i = 0; i < this.size && remaining > 0; i++) {
        const slot = this.slots[i];
        if (!slot || slot.item !== itemId || slot.count >= maxStack) continue;
        if (!metaEquals(slot.meta ?? null, meta)) continue;
        const room = maxStack - slot.count;
        const moved = Math.min(room, remaining);
        slot.count += moved;
        remaining -= moved;
      }
    }

    for (let i = 0; i < this.size && remaining > 0; i++) {
      if (this.slots[i] !== null) continue;
      const moved = Math.min(maxStack, remaining);
      this.slots[i] = meta ? { item: itemId, count: moved, meta: structuredClone(meta) } : { item: itemId, count: moved };
      remaining -= moved;
    }

    const added = count - remaining;
    if (added > 0) this._emit('add', { item: itemId, count: added });
    return { added, remaining };
  }

  /**
   * Remove up to `count` of an item from anywhere in the inventory.
   * @param {string} itemId
   * @param {number} [count]
   * @returns {number} how many were actually removed
   */
  remove(itemId, count = 1) {
    if (!Number.isInteger(count) || count <= 0) return 0;
    let remaining = count;
    for (let i = 0; i < this.size && remaining > 0; i++) {
      const slot = this.slots[i];
      if (!slot || slot.item !== itemId) continue;
      const taken = Math.min(slot.count, remaining);
      slot.count -= taken;
      remaining -= taken;
      if (slot.count === 0) this.slots[i] = null;
    }
    const removed = count - remaining;
    if (removed > 0) this._emit('remove', { item: itemId, count: removed });
    return removed;
  }

  /**
   * Remove from one specific slot.
   * @param {number} index
   * @param {number} [count]
   * @returns {{ item: string, count: number, meta?: object }|null} the taken stack
   */
  removeFromSlot(index, count = 1) {
    const slot = this.getSlot(index);
    if (!slot || count <= 0) return null;
    const taken = Math.min(slot.count, count);
    const result = { item: slot.item, count: taken };
    if (slot.meta) result.meta = structuredClone(slot.meta);
    slot.count -= taken;
    if (slot.count === 0) this.slots[index] = null;
    this._emit('remove', { item: result.item, count: taken, slot: index });
    return result;
  }

  /**
   * Place a stack directly into a slot, replacing whatever is there.
   * @param {number} index
   * @param {{ item: string, count: number, meta?: object }|null} stack
   */
  setSlot(index, stack) {
    if (!this.isValidSlot(index)) return false;
    if (stack && !this.content.items.has(stack.item)) {
      throw new Error(`cannot place unknown item "${stack.item}"`);
    }
    this.slots[index] = stack ? { ...stack } : null;
    this._emit('set', { slot: index });
    return true;
  }

  /**
   * Move or swap between two slots, merging when the stacks are compatible.
   * @param {number} from
   * @param {number} to
   * @param {number|null} [count] partial move; null moves the whole stack
   */
  move(from, to, count = null) {
    if (!this.isValidSlot(from) || !this.isValidSlot(to)) return false;
    if (from === to) return false;
    if (this.lockedSlots.has(from) || this.lockedSlots.has(to)) return false;

    const source = this.slots[from];
    if (!source) return false;
    const amount = count === null ? source.count : Math.min(count, source.count);
    if (amount <= 0) return false;

    const target = this.slots[to];
    if (target && target.item === source.item && metaEquals(target.meta ?? null, source.meta ?? null)) {
      const maxStack = this.maxStackOf(source.item);
      const room = maxStack - target.count;
      if (room <= 0) return false;
      const moved = Math.min(room, amount);
      target.count += moved;
      source.count -= moved;
      if (source.count === 0) this.slots[from] = null;
      this._emit('move', { from, to, count: moved });
      return true;
    }

    if (!target) {
      if (amount === source.count) {
        this.slots[to] = source;
        this.slots[from] = null;
      } else {
        const stack = { item: source.item, count: amount };
        if (source.meta) stack.meta = structuredClone(source.meta);
        this.slots[to] = stack;
        source.count -= amount;
      }
      this._emit('move', { from, to, count: amount });
      return true;
    }

    // Swapping only makes sense for whole stacks.
    if (amount !== source.count) return false;
    this.slots[from] = target;
    this.slots[to] = source;
    this._emit('swap', { from, to });
    return true;
  }

  /**
   * Split a stack into the first free slot.
   * @param {number} index
   * @param {number|null} [count] defaults to half, rounded up
   */
  split(index, count = null) {
    const slot = this.getSlot(index);
    if (!slot || slot.count < 2) return false;
    const target = this.slots.indexOf(null);
    if (target === -1) return false;
    const amount = count === null ? Math.ceil(slot.count / 2) : count;
    if (amount <= 0 || amount >= slot.count) return false;
    return this.move(index, target, amount);
  }

  /**
   * Merge loose partial stacks of the same item together.
   * @returns {number} number of merges performed
   */
  compact() {
    let merges = 0;
    for (let i = 0; i < this.size; i++) {
      const source = this.slots[i];
      if (!source || this.lockedSlots.has(i)) continue;
      const maxStack = this.maxStackOf(source.item);
      if (source.count >= maxStack) continue;
      for (let j = i + 1; j < this.size; j++) {
        const other = this.slots[j];
        if (!other || this.lockedSlots.has(j)) continue;
        if (other.item !== source.item) continue;
        if (!metaEquals(source.meta ?? null, other.meta ?? null)) continue;
        const room = maxStack - source.count;
        if (room <= 0) break;
        const moved = Math.min(room, other.count);
        source.count += moved;
        other.count -= moved;
        merges += 1;
        if (other.count === 0) this.slots[j] = null;
      }
    }
    if (merges > 0) this._emit('compact', { merges });
    return merges;
  }

  /**
   * Compact then sort by item id, leaving locked slots and the quickbar alone.
   */
  sort() {
    this.compact();
    const movable = [];
    for (let i = this.quickbarSize; i < this.size; i++) {
      if (this.lockedSlots.has(i)) continue;
      if (this.slots[i]) movable.push(this.slots[i]);
      this.slots[i] = null;
    }
    movable.sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : b.count - a.count));
    let cursor = 0;
    for (let i = this.quickbarSize; i < this.size && cursor < movable.length; i++) {
      if (this.lockedSlots.has(i)) continue;
      this.slots[i] = movable[cursor++];
    }
    this._emit('sort');
    return true;
  }

  /** Toggle a slot lock, which protects it from sort and move operations. */
  toggleLock(index) {
    if (!this.isValidSlot(index)) return false;
    if (this.lockedSlots.has(index)) this.lockedSlots.delete(index);
    else this.lockedSlots.add(index);
    this._emit('lock', { slot: index, locked: this.lockedSlots.has(index) });
    return true;
  }

  /**
   * Permanently delete a stack. Items flagged `trashable: false` are refused.
   * @param {number} index
   * @param {number|null} [count]
   */
  trash(index, count = null) {
    const slot = this.getSlot(index);
    if (!slot) return { ok: false, reason: 'empty slot' };
    if (this.lockedSlots.has(index)) return { ok: false, reason: 'slot is locked' };
    const definition = this.content.items.get(slot.item);
    if (definition && definition.trashable === false) {
      return { ok: false, reason: `${definition.name} cannot be destroyed` };
    }
    const removed = this.removeFromSlot(index, count === null ? slot.count : count);
    return { ok: true, removed };
  }

  /** Is there room for `count` of `itemId`? */
  canFit(itemId, count = 1) {
    const maxStack = this.maxStackOf(itemId);
    let room = this.freeSlots * maxStack;
    if (maxStack > 1) {
      for (const slot of this.slots) {
        if (slot?.item === itemId) room += maxStack - slot.count;
      }
    }
    return room >= count;
  }

  /** @returns {object} JSON-serialisable snapshot */
  toJSON() {
    return {
      size: this.size,
      quickbarSize: this.quickbarSize,
      selectedSlot: this.selectedSlot,
      lockedSlots: [...this.lockedSlots],
      slots: this.slots.map((slot) => (slot ? { ...slot } : null)),
    };
  }

  /** @param {object} json */
  loadJSON(json) {
    if (!json) return this;
    this.selectedSlot = json.selectedSlot ?? 0;
    this.lockedSlots = new Set(json.lockedSlots ?? []);
    this.slots = new Array(this.size).fill(null);
    (json.slots ?? []).forEach((slot, index) => {
      if (!slot || index >= this.size) return;
      // Content can change between releases; silently drop removed items
      // rather than refusing to load the player.
      if (!this.content.items.has(slot.item)) return;
      this.slots[index] = { ...slot };
    });
    return this;
  }
}
