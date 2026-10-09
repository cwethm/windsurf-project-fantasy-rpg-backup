/**
 * Player actor.
 *
 * Bundles the three per-player systems (inventory, equipment, character) with
 * transform state. The server owns instances of this; tests construct them
 * directly, which is why nothing here knows about sockets.
 */

import {
  PLAYER_EYE_HEIGHT,
  WALK_SPEED,
  DEFAULT_VIEW_DISTANCE,
} from '../core/constants.js';
import { Inventory } from './inventory.js';
import { Equipment } from './equipment.js';
import { Character } from './character.js';

export class Player {
  /**
   * @param {{
   *   id: string,
   *   username: string,
   *   content: import('../content/index.js').Content,
   *   bus?: import('../core/event-bus.js').EventBus,
   *   position?: { x: number, y: number, z: number },
   *   viewDistance?: number,
   * }} config
   */
  constructor({ id, username, content, bus = null, position = { x: 0, y: 40, z: 0 }, viewDistance = DEFAULT_VIEW_DISTANCE }) {
    this.id = id;
    this.username = username;
    this.content = content;
    this.bus = bus;

    this.position = { ...position };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    /** Animation state other clients render: idle | walk | run | jump. */
    this.animation = 'idle';
    this.viewDistance = viewDistance;

    this.inventory = new Inventory({ content, bus, ownerId: id });
    this.equipment = new Equipment({ content, bus, ownerId: id });
    this.character = new Character({ content, equipment: this.equipment, bus, ownerId: id });

    /** Chunk keys already sent to this player's client. */
    this.loadedChunks = new Set();
    /** Position of the open container, or null. */
    this.openContainer = null;
    this.lastSeenAt = Date.now();
  }

  /** Eye position, the origin for interaction raycasts. */
  get eyePosition() {
    return { x: this.position.x, y: this.position.y + PLAYER_EYE_HEIGHT, z: this.position.z };
  }

  /** The stack in the selected quickbar slot, or null. */
  heldStack() {
    return this.inventory.getSelected();
  }

  /** Definition of the held item, or null. */
  heldItem() {
    const stack = this.heldStack();
    return stack ? this.content.items.get(stack.item) ?? null : null;
  }

  /**
   * Tool context used by harvesting and loot requirements. The main hand wins;
   * otherwise the held quickbar item is treated as the tool, which lets a
   * player mine with a pickaxe they have not formally equipped.
   */
  toolContext() {
    const tool = this.equipment.mainHand ?? this.heldItem();
    return {
      toolClass: tool?.toolClass ?? null,
      toolTier: tool?.toolTier ?? 0,
      knowledge: this.character.knowledge,
    };
  }

  /** Which equipment slot, if any, is currently acting as the tool. */
  toolSlot() {
    return this.equipment.mainHand ? 'main_hand' : null;
  }

  /**
   * Equip the item in an inventory slot. Whatever the equipment slot held goes
   * back into the inventory, into the vacated slot when the stack was a single
   * item.
   * @param {number} index
   * @returns {{ ok: boolean, reason?: string, slot?: string, replaced?: object|null }}
   */
  equipFromSlot(index) {
    const inventory = this.inventory;
    const stack = inventory.getSlot(index);
    if (!stack) return { ok: false, reason: 'empty slot' };
    if (inventory.lockedSlots.has(index)) return { ok: false, reason: 'slot is locked' };

    const definition = this.content.items.get(stack.item);
    if (!definition?.equipSlot) {
      return { ok: false, reason: `${definition?.name ?? stack.item} is not equippable` };
    }
    const current = this.equipment.get(definition.equipSlot);
    if (current && stack.count > 1 && !this._hasRoomFor(current)) {
      return { ok: false, reason: 'inventory full' };
    }

    const single = stack.meta ? { item: stack.item, meta: stack.meta } : { item: stack.item };
    const result = this.equipment.equip(single, definition.equipSlot);
    if (!result.ok) return result;

    const replaced = result.replaced ?? null;
    if (stack.count === 1) {
      inventory.setSlot(index, replaced ? { ...replaced, count: 1 } : null);
    } else {
      inventory.removeFromSlot(index, 1);
      if (replaced) inventory.add(replaced.item, 1, replaced.meta ?? null);
    }
    return { ok: true, slot: definition.equipSlot, replaced };
  }

  /**
   * Move an equipped item back into the inventory: into `toIndex` when that
   * slot is free, otherwise wherever it fits.
   * @param {string} slotName
   * @param {number|null} [toIndex]
   * @returns {{ ok: boolean, reason?: string, item?: string }}
   */
  unequipToInventory(slotName, toIndex = null) {
    const inventory = this.inventory;
    const equipped = this.equipment.get(slotName);
    if (!equipped) return { ok: false, reason: 'nothing equipped' };

    const targetFree =
      toIndex !== null &&
      inventory.isValidSlot(toIndex) &&
      inventory.getSlot(toIndex) === null &&
      !inventory.lockedSlots.has(toIndex);
    if (!targetFree && !this._hasRoomFor(equipped)) {
      return { ok: false, reason: 'inventory full' };
    }

    this.equipment.unequip(slotName);
    if (targetFree) inventory.setSlot(toIndex, { ...equipped, count: 1 });
    else inventory.add(equipped.item, 1, equipped.meta ?? null);
    return { ok: true, item: equipped.item };
  }

  /**
   * Can one of `stack` be added to the inventory? Stacks carrying metadata
   * only merge with identical metadata, so they are only guaranteed a free slot.
   * @param {{ item: string, meta?: object }} stack
   */
  _hasRoomFor(stack) {
    if (stack.meta) return this.inventory.freeSlots > 0;
    return this.inventory.canFit(stack.item, 1);
  }

  /** Current movement speed cap, including buffs. */
  maxSpeed(now = Date.now()) {
    return WALK_SPEED * this.character.getStat('move_speed', now);
  }

  /** Compact state broadcast to other players. */
  toNetworkState() {
    return {
      id: this.id,
      username: this.username,
      position: { ...this.position },
      yaw: this.yaw,
      pitch: this.pitch,
      animation: this.animation,
      equipment: this.equipment.toVisual(),
      held: this.heldStack()?.item ?? null,
    };
  }

  /** Full state sent to the owning client. */
  toSelfState(now = Date.now()) {
    return {
      ...this.toNetworkState(),
      health: this.character.health,
      maxHealth: this.character.maxHealth,
      energy: this.character.energy,
      level: this.character.level,
      experience: this.character.experience,
      stats: this.character.getStats(now),
      inventory: this.inventory.toJSON(),
      equipmentSlots: this.equipment.toJSON(),
      buffs: [...this.character.buffs.values()],
      knowledge: [...this.character.knowledge],
    };
  }

  /** Persistent record. */
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      position: { ...this.position },
      yaw: this.yaw,
      pitch: this.pitch,
      inventory: this.inventory.toJSON(),
      equipment: this.equipment.toJSON(),
      character: this.character.toJSON(),
      savedAt: Date.now(),
    };
  }

  /** @param {object} record @param {number} [now] */
  loadJSON(record, now = Date.now()) {
    if (!record) return this;
    if (record.position) this.position = { ...record.position };
    this.yaw = record.yaw ?? 0;
    this.pitch = record.pitch ?? 0;
    this.inventory.loadJSON(record.inventory);
    this.equipment.loadJSON(record.equipment);
    this.character.loadJSON(record.character, now);
    return this;
  }
}
