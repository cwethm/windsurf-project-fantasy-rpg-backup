/**
 * Content bundle.
 *
 * One object that owns the block, item and loot registries plus the derived
 * lookups every system needs (block name -> id, block id -> item that places
 * it). Systems take a `Content` instance instead of importing registries
 * directly, which keeps them testable with custom content.
 */

import { createBlockRegistry, BLOCK_IDS, TOOL_CLASSES } from './blocks.js';
import { createItemRegistry, USE_ACTIONS } from './items.js';
import { createLootRegistry, rollLootTable } from './loot.js';

export { BLOCK_IDS, TOOL_CLASSES, USE_ACTIONS, rollLootTable };

export class Content {
  /**
   * @param {{ blocks?: object[], items?: object[], loot?: object[] }} [extra]
   */
  constructor(extra = {}) {
    this.blocks = createBlockRegistry(extra.blocks ?? []);
    this.items = createItemRegistry(extra.items ?? []);
    this.loot = createLootRegistry(extra.loot ?? []);
    this._rebuildIndexes();
  }

  _rebuildIndexes() {
    /** @type {Map<number, object>} block id -> item definition that places it */
    this._itemForBlock = new Map();
    for (const itemDef of this.items.all()) {
      if (!itemDef.placeable) continue;
      const blockDef = this.blocks.getByName(itemDef.placeable);
      if (!blockDef) {
        throw new Error(`item "${itemDef.id}" places unknown block "${itemDef.placeable}"`);
      }
      if (!this._itemForBlock.has(blockDef.id)) {
        this._itemForBlock.set(blockDef.id, itemDef);
      }
    }
    for (const blockDef of this.blocks.all()) {
      if (blockDef.drops && !this.loot.has(blockDef.drops)) {
        throw new Error(`block "${blockDef.name}" references unknown loot table "${blockDef.drops}"`);
      }
    }
    for (const table of this.loot.all()) {
      for (const lootEntry of table.entries) {
        if (!this.items.has(lootEntry.item)) {
          throw new Error(`loot table "${table.id}" drops unknown item "${lootEntry.item}"`);
        }
      }
    }
  }

  /** Freeze every registry once content loading is finished. */
  freeze() {
    this.blocks.freeze();
    this.items.freeze();
    this.loot.freeze();
    return this;
  }

  /** @param {number} id */
  block(id) {
    return this.blocks.get(id);
  }

  /** @param {string} name */
  blockByName(name) {
    return this.blocks.getByName(name);
  }

  /**
   * Resolve a block name to its numeric id.
   * @param {string} name
   * @returns {number}
   */
  blockId(name) {
    const def = this.blocks.getByName(name);
    if (!def) throw new Error(`Unknown block name: ${name}`);
    return def.id;
  }

  /** @param {string} id */
  item(id) {
    return this.items.get(id);
  }

  /**
   * The item a block yields when it needs a "pick this up" representation.
   * @param {number} blockId
   */
  itemForBlock(blockId) {
    return this._itemForBlock.get(blockId) ?? null;
  }

  /** @param {number} blockId */
  isSolid(blockId) {
    return this.blocks.get(blockId)?.solid ?? false;
  }

  /** @param {number} blockId */
  isReplaceable(blockId) {
    return this.blocks.get(blockId)?.replaceable ?? false;
  }

  /**
   * Roll the loot table attached to a block.
   * @param {number} blockId
   * @param {import('../core/rng.js').Random} rng
   * @param {object} [context]
   */
  rollBlockDrops(blockId, rng, context = {}) {
    const blockDef = this.blocks.get(blockId);
    if (!blockDef?.drops) return [];
    return rollLootTable(this.loot.get(blockDef.drops), rng, context);
  }
}

/**
 * Create the default content bundle.
 * @param {{ blocks?: object[], items?: object[], loot?: object[] }} [extra]
 */
export function createContent(extra = {}) {
  return new Content(extra);
}
