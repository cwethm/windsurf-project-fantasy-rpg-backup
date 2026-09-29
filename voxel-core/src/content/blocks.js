/**
 * Block definitions.
 *
 * Blocks are data. Nothing in the engine switches on a block id: behaviour is
 * derived from the flags below plus handlers registered against `interaction`
 * ids. Adding a block type is a single entry in `BLOCK_DEFINITIONS`.
 *
 * Definition fields
 * -----------------
 *  id            numeric id stored in chunk arrays (0-65535)
 *  name          stable string key used by content, saves and the protocol
 *  solid         blocks movement and stops raycasts
 *  transparent   render hint: neighbouring faces are not culled
 *  liquid        swimmable, not walkable
 *  replaceable   placing a block here overwrites it (air, grass tufts, water)
 *  hardness      base seconds to harvest by hand; null = unbreakable
 *  toolClass     tool family that speeds up harvesting (null = any)
 *  minToolTier   tier required to yield drops at all (0 = none required)
 *  light         light level emitted, 0-15
 *  interactable  has an `INTERACT` handler (door, chest, torch...)
 *  tileEntity    tile-entity kind stored alongside the block, or null
 *  drops         loot table name consulted on harvest
 *  regrow        `{ into, seconds }` respawn rule, or null
 *  color         base colour the reference client meshes with
 */

import { Registry } from '../core/registry.js';

/** Tool families. Items declare `toolClass`, blocks declare a preferred one. */
export const TOOL_CLASSES = {
  HAND: 'hand',
  PICKAXE: 'pickaxe',
  AXE: 'axe',
  SHOVEL: 'shovel',
  SHEARS: 'shears',
};

/** Convenience numeric ids so engine code can spell out air/water readably. */
export const BLOCK_IDS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  LOG: 4,
  LEAVES: 5,
  WATER: 6,
  SAND: 7,
  CHEST: 8,
  COAL_ORE: 10,
  IRON_ORE: 11,
  FLOWERS: 18,
  TALL_GRASS: 19,
  PLANKS: 21,
  COBBLESTONE: 30,
  GLASS: 32,
  TORCH: 50,
  DOOR: 51,
};

const defaults = {
  solid: true,
  transparent: false,
  liquid: false,
  replaceable: false,
  hardness: 1.0,
  toolClass: null,
  minToolTier: 0,
  light: 0,
  interactable: false,
  tileEntity: null,
  drops: null,
  regrow: null,
  color: 0x888888,
};

/** @param {object} def */
function block(def) {
  return { ...defaults, ...def };
}

export const BLOCK_DEFINITIONS = [
  block({
    id: BLOCK_IDS.AIR,
    name: 'air',
    solid: false,
    transparent: true,
    replaceable: true,
    hardness: null,
    color: 0x000000,
  }),
  block({
    id: BLOCK_IDS.GRASS,
    name: 'grass',
    hardness: 0.6,
    toolClass: TOOL_CLASSES.SHOVEL,
    drops: 'grass',
    color: 0x5aa02c,
  }),
  block({
    id: BLOCK_IDS.DIRT,
    name: 'dirt',
    hardness: 0.5,
    toolClass: TOOL_CLASSES.SHOVEL,
    drops: 'dirt',
    color: 0x8b5a2b,
  }),
  block({
    id: BLOCK_IDS.STONE,
    name: 'stone',
    hardness: 1.5,
    toolClass: TOOL_CLASSES.PICKAXE,
    minToolTier: 1,
    drops: 'stone',
    color: 0x7f7f7f,
  }),
  block({
    id: BLOCK_IDS.LOG,
    name: 'log',
    hardness: 2.0,
    toolClass: TOOL_CLASSES.AXE,
    drops: 'log',
    regrow: { into: BLOCK_IDS.LOG, seconds: 600 },
    color: 0x6b4423,
  }),
  block({
    id: BLOCK_IDS.LEAVES,
    name: 'leaves',
    transparent: true,
    hardness: 0.2,
    drops: 'leaves',
    color: 0x3f7f2f,
  }),
  block({
    id: BLOCK_IDS.WATER,
    name: 'water',
    solid: false,
    transparent: true,
    liquid: true,
    replaceable: true,
    hardness: null,
    color: 0x2f6fbf,
  }),
  block({
    id: BLOCK_IDS.SAND,
    name: 'sand',
    hardness: 0.5,
    toolClass: TOOL_CLASSES.SHOVEL,
    drops: 'sand',
    color: 0xd9cB8f,
  }),
  block({
    id: BLOCK_IDS.CHEST,
    name: 'chest',
    hardness: 2.5,
    toolClass: TOOL_CLASSES.AXE,
    interactable: true,
    tileEntity: 'container',
    drops: 'chest',
    color: 0xa1671f,
  }),
  block({
    id: BLOCK_IDS.COAL_ORE,
    name: 'coal_ore',
    hardness: 3.0,
    toolClass: TOOL_CLASSES.PICKAXE,
    minToolTier: 1,
    drops: 'coal_ore',
    regrow: { into: BLOCK_IDS.COAL_ORE, seconds: 1800 },
    color: 0x4a4a4a,
  }),
  block({
    id: BLOCK_IDS.IRON_ORE,
    name: 'iron_ore',
    hardness: 3.5,
    toolClass: TOOL_CLASSES.PICKAXE,
    minToolTier: 2,
    drops: 'iron_ore',
    regrow: { into: BLOCK_IDS.IRON_ORE, seconds: 3600 },
    color: 0xb9846a,
  }),
  block({
    id: BLOCK_IDS.FLOWERS,
    name: 'flowers',
    solid: false,
    transparent: true,
    replaceable: true,
    hardness: 0.05,
    drops: 'flowers',
    regrow: { into: BLOCK_IDS.FLOWERS, seconds: 300 },
    color: 0xe05b8a,
  }),
  block({
    id: BLOCK_IDS.TALL_GRASS,
    name: 'tall_grass',
    solid: false,
    transparent: true,
    replaceable: true,
    hardness: 0.05,
    drops: 'tall_grass',
    regrow: { into: BLOCK_IDS.TALL_GRASS, seconds: 180 },
    color: 0x74b03a,
  }),
  block({
    id: BLOCK_IDS.PLANKS,
    name: 'planks',
    hardness: 1.8,
    toolClass: TOOL_CLASSES.AXE,
    drops: 'planks',
    color: 0xb58b53,
  }),
  block({
    id: BLOCK_IDS.COBBLESTONE,
    name: 'cobblestone',
    hardness: 2.0,
    toolClass: TOOL_CLASSES.PICKAXE,
    minToolTier: 1,
    drops: 'cobblestone',
    color: 0x6e6e6e,
  }),
  block({
    id: BLOCK_IDS.GLASS,
    name: 'glass',
    transparent: true,
    hardness: 0.4,
    drops: null,
    color: 0xcfe8ef,
  }),
  block({
    id: BLOCK_IDS.TORCH,
    name: 'torch',
    solid: false,
    transparent: true,
    hardness: 0.05,
    light: 14,
    interactable: true,
    tileEntity: 'toggle',
    drops: 'torch',
    color: 0xffd27f,
  }),
  block({
    id: BLOCK_IDS.DOOR,
    name: 'door',
    hardness: 1.5,
    toolClass: TOOL_CLASSES.AXE,
    interactable: true,
    tileEntity: 'toggle',
    drops: 'door',
    color: 0x8a6033,
  }),
];

/**
 * Build a block registry. Callers may append their own definitions before
 * freezing, which is the supported extension point for downstream games.
 * @param {object[]} [extraDefinitions]
 * @returns {Registry}
 */
export function createBlockRegistry(extraDefinitions = []) {
  const registry = new Registry('block', {
    validate(def) {
      if (typeof def.id !== 'number' || !Number.isInteger(def.id) || def.id < 0 || def.id > 65535) {
        throw new TypeError(`block "${def.name}" needs an integer id in 0..65535`);
      }
      if (typeof def.name !== 'string' || !def.name) {
        throw new TypeError(`block ${def.id} needs a non-empty name`);
      }
      if (def.light < 0 || def.light > 15) {
        throw new RangeError(`block "${def.name}" light must be 0..15`);
      }
    },
  });
  registry.registerAll(BLOCK_DEFINITIONS.map((def) => block(def)));
  registry.registerAll(extraDefinitions.map((def) => block(def)));
  return registry;
}
