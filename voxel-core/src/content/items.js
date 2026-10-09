/**
 * Item definitions.
 *
 * Like blocks, items are pure data. The `use` descriptor names an action that
 * the item-use dispatcher resolves to a handler, so "eat bread", "learn a
 * recipe", "light a torch" and "place a block" all travel the same path.
 *
 * Definition fields
 * -----------------
 *  id           stable string key (used in saves and on the wire)
 *  name         display name
 *  maxStack     stack ceiling; 1 means unstackable
 *  placeable    block name this item becomes when placed, or null
 *  equipSlot    equipment slot name, or null
 *  durability   max durability for equippable/tool items, or null
 *  toolClass    tool family, or null
 *  toolTier     tool tier used against `block.minToolTier`
 *  stats        flat stat contributions while equipped
 *  use          `{ action, ... }` descriptor consumed by the use dispatcher
 *  trashable    false for quest-like items that must not be deleted
 */

import { Registry } from '../core/registry.js';
import { TOOL_CLASSES } from './blocks.js';

/** Actions understood by the default item-use dispatcher. */
export const USE_ACTIONS = {
  CONSUME: 'consume',
  LEARN: 'learn',
  TOGGLE: 'toggle',
  PLACE: 'place',
  EQUIP: 'equip',
  NONE: 'none',
};

const defaults = {
  maxStack: 64,
  placeable: null,
  equipSlot: null,
  durability: null,
  toolClass: null,
  toolTier: 0,
  stats: null,
  use: { action: USE_ACTIONS.NONE },
  trashable: true,
};

/** @param {object} def */
function item(def) {
  return { ...defaults, ...def };
}

/** Block-backed items share one shape; this keeps the table readable. */
function blockItem(id, name, blockName, extra = {}) {
  return item({
    id,
    name,
    placeable: blockName,
    use: { action: USE_ACTIONS.PLACE, block: blockName },
    ...extra,
  });
}

export const ITEM_DEFINITIONS = [
  blockItem('dirt', 'Dirt', 'dirt'),
  blockItem('grass', 'Grass Block', 'grass'),
  blockItem('stone', 'Stone', 'stone'),
  blockItem('cobblestone', 'Cobblestone', 'cobblestone'),
  blockItem('sand', 'Sand', 'sand'),
  blockItem('log', 'Log', 'log'),
  blockItem('planks', 'Planks', 'planks'),
  blockItem('leaves', 'Leaves', 'leaves'),
  blockItem('glass', 'Glass', 'glass'),
  blockItem('chest', 'Chest', 'chest'),
  blockItem('door', 'Door', 'door', { maxStack: 16 }),
  blockItem('torch', 'Torch', 'torch', { maxStack: 32 }),
  blockItem('flowers', 'Flowers', 'flowers'),
  blockItem('tall_grass', 'Tall Grass', 'tall_grass'),

  item({ id: 'coal', name: 'Coal', maxStack: 64 }),
  item({ id: 'iron_ore', name: 'Iron Ore', maxStack: 64 }),
  item({ id: 'stick', name: 'Stick', maxStack: 64 }),
  item({ id: 'seeds', name: 'Seeds', maxStack: 64 }),

  item({
    id: 'bread',
    name: 'Bread',
    maxStack: 16,
    use: {
      action: USE_ACTIONS.CONSUME,
      heal: 4,
      energy: 20,
    },
  }),
  item({
    id: 'healing_potion',
    name: 'Healing Potion',
    maxStack: 8,
    use: {
      action: USE_ACTIONS.CONSUME,
      heal: 10,
      buffs: [{ id: 'regeneration', stat: 'health_regen', magnitude: 1, duration: 30 }],
    },
  }),
  item({
    id: 'swiftness_tonic',
    name: 'Swiftness Tonic',
    maxStack: 8,
    use: {
      action: USE_ACTIONS.CONSUME,
      buffs: [{ id: 'swiftness', stat: 'move_speed', magnitude: 1.5, duration: 60 }],
    },
  }),
  item({
    id: 'tome_of_masonry',
    name: 'Tome of Masonry',
    maxStack: 1,
    trashable: false,
    use: { action: USE_ACTIONS.LEARN, knowledge: 'masonry' },
  }),

  item({
    id: 'wooden_pickaxe',
    name: 'Wooden Pickaxe',
    maxStack: 1,
    equipSlot: 'main_hand',
    durability: 60,
    toolClass: TOOL_CLASSES.PICKAXE,
    toolTier: 1,
    stats: { attack: 2 },
    use: { action: USE_ACTIONS.EQUIP },
  }),
  item({
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    maxStack: 1,
    equipSlot: 'main_hand',
    durability: 130,
    toolClass: TOOL_CLASSES.PICKAXE,
    toolTier: 2,
    stats: { attack: 3 },
    use: { action: USE_ACTIONS.EQUIP },
  }),
  item({
    id: 'wooden_axe',
    name: 'Wooden Axe',
    maxStack: 1,
    equipSlot: 'main_hand',
    durability: 60,
    toolClass: TOOL_CLASSES.AXE,
    toolTier: 1,
    stats: { attack: 3 },
    use: { action: USE_ACTIONS.EQUIP },
  }),
  item({
    id: 'wooden_shovel',
    name: 'Wooden Shovel',
    maxStack: 1,
    equipSlot: 'main_hand',
    durability: 60,
    toolClass: TOOL_CLASSES.SHOVEL,
    toolTier: 1,
    stats: { attack: 1 },
    use: { action: USE_ACTIONS.EQUIP },
  }),
  item({
    id: 'leather_cap',
    name: 'Leather Cap',
    maxStack: 1,
    equipSlot: 'head',
    durability: 80,
    stats: { defense: 1 },
    use: { action: USE_ACTIONS.EQUIP },
  }),
  item({
    id: 'leather_tunic',
    name: 'Leather Tunic',
    maxStack: 1,
    equipSlot: 'chest',
    durability: 110,
    stats: { defense: 3, health: 2 },
    use: { action: USE_ACTIONS.EQUIP },
  }),
  item({
    id: 'wooden_shield',
    name: 'Wooden Shield',
    maxStack: 1,
    equipSlot: 'off_hand',
    durability: 100,
    stats: { defense: 2 },
    use: { action: USE_ACTIONS.EQUIP },
  }),
  item({
    id: 'flint_knife',
    name: 'Flint Knife',
    maxStack: 1,
    equipSlot: 'main_hand',
    durability: 60,
    toolClass: TOOL_CLASSES.KNIFE,
    toolTier: 1,
    stats: { attack: 1 },
    use: { action: USE_ACTIONS.EQUIP },
  }),
  item({ id: 'raw_beef', name: 'Raw Beef', maxStack: 32 }),
  item({ id: 'raw_mutton', name: 'Raw Mutton', maxStack: 32 }),
  item({ id: 'raw_venison', name: 'Raw Venison', maxStack: 32 }),
  item({ id: 'hide', name: 'Hide', maxStack: 16 }),
  item({ id: 'wool', name: 'Wool', maxStack: 64 }),
  item({ id: 'bone', name: 'Bone', maxStack: 64 }),
  item({ id: 'horn', name: 'Horn', maxStack: 16 }),
  item({ id: 'antler', name: 'Antler', maxStack: 16 }),
  // Ruined results of unskilled butchering: kept as items so players can see
  // what went wrong, but nothing consumes them.
  item({ id: 'mangled_meat', name: 'Mangled Meat', maxStack: 32 }),
  item({ id: 'tattered_hide', name: 'Tattered Hide', maxStack: 16 }),
  item({ id: 'matted_wool', name: 'Matted Wool', maxStack: 64 }),
  item({ id: 'bone_shards', name: 'Bone Shards', maxStack: 64 }),
];

/**
 * Build an item registry.
 * @param {object[]} [extraDefinitions]
 * @returns {Registry}
 */
export function createItemRegistry(extraDefinitions = []) {
  const registry = new Registry('item', {
    validate(def) {
      if (typeof def.id !== 'string' || !def.id) {
        throw new TypeError('item definitions need a non-empty string id');
      }
      if (!Number.isInteger(def.maxStack) || def.maxStack < 1) {
        throw new TypeError(`item "${def.id}" needs maxStack >= 1`);
      }
      if (def.durability !== null && def.maxStack !== 1) {
        throw new TypeError(`item "${def.id}" has durability so maxStack must be 1`);
      }
    },
  });
  registry.registerAll(ITEM_DEFINITIONS.map((def) => item(def)));
  registry.registerAll(extraDefinitions.map((def) => item(def)));
  return registry;
}
