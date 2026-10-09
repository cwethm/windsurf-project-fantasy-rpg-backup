/**
 * Entity definitions and spawn rules.
 *
 * Mobs, NPCs and other non-player entities are data, like blocks and items.
 * A definition names its body plan and form code (how it looks and how big its
 * hitbox is), its stats, the brain that drives it, the spawn rule that places
 * it, and the loot table its corpse yields when butchered.
 *
 * Entity fields
 * -------------
 *  id        stable key used on the wire
 *  name      display name
 *  kind      'mob' | 'npc'
 *  form      form code (see `src/entity/form-code.js`)
 *  traits    `{ size: [min, max], territory, timidity }`, rolled per individual
 *  stats     `{ health, speed, defense }`
 *  brain     brain id registered in `src/entity/brains.js`
 *  harvest   loot table rolled when the corpse is butchered
 *  corpse    seconds a corpse stays before rotting away
 *
 * Spawn rule fields
 * -----------------
 *  entity    entity id to spawn
 *  biomes    biome ids, or ['*'] for any
 *  surface   block names the group may stand on
 *  group     `[min, max]` individuals per spawn
 *  rarity    'common' | 'uncommon' | 'rare' | 'very_rare'
 */

import { Registry } from '../core/registry.js';
import { lootEntry } from './loot.js';
import { TOOL_CLASSES } from './blocks.js';

export const RARITY_WEIGHTS = Object.freeze({ common: 100, uncommon: 35, rare: 8, very_rare: 1.5 });

const entityDefaults = {
  kind: 'mob',
  traits: {},
  stats: {},
  brain: 'grazer',
  harvest: null,
  corpse: 300,
};

const statDefaults = { health: 10, speed: 2, defense: 0 };
const traitDefaults = { size: [1, 1], territory: 10, timidity: 1 };

function entity(def) {
  return {
    ...entityDefaults,
    ...def,
    stats: { ...statDefaults, ...def.stats },
    traits: { ...traitDefaults, ...def.traits },
  };
}

export const ENTITY_DEFINITIONS = [
  entity({
    id: 'cow',
    name: 'Cow',
    form: 'Q|bd:L14W8H8|lg:L7T3|nk:L3A15|hd:L5W4H4|sn:L2|hn:2L2C1|ea:2L2|tl:L7|ud|pt:patch,F2EEE6,3A2A20',
    traits: { size: [0.9, 1.1], territory: 10 },
    stats: { health: 10, speed: 1.6, defense: 0 },
    harvest: 'cow_carcass',
  }),
  entity({
    id: 'sheep',
    name: 'Sheep',
    form: 'Q|bd:L11W7H7~1|lg:L5T2|nk:L2A10|hd:L4W3H3|sn:L1|ea:2L2|tl:L2|fl:D2|pt:solid,EDEDE4,2B2B2B',
    traits: { size: [0.85, 1.05], territory: 8 },
    stats: { health: 8, speed: 1.5, defense: 0 },
    harvest: 'sheep_carcass',
  }),
  entity({
    id: 'deer',
    name: 'Deer',
    form: 'Q|bd:L12W5H6|lg:L10~1T2|nk:L5A50|hd:L4W3H3|sn:L2|an:3L7~2|ea:2L3|tl:L2|pt:spot,9C6B43,E8DCC4',
    traits: { size: [0.85, 1.1], territory: 16, timidity: 2.5 },
    stats: { health: 8, speed: 2.6, defense: 0 },
    harvest: 'deer_carcass',
  }),
];

const knife = { toolClass: TOOL_CLASSES.KNIFE };
const skinning = { toolClass: TOOL_CLASSES.KNIFE, knowledge: 'butchery' };

export const ENTITY_LOOT_TABLES = [
  {
    id: 'cow_carcass',
    mode: 'all',
    rolls: 1,
    entries: [
      lootEntry({ item: 'raw_beef', min: 2, max: 3, requires: knife, ruined: 'mangled_meat', ruinedChance: 0.8 }),
      lootEntry({ item: 'hide', requires: skinning, ruined: 'tattered_hide', ruinedChance: 0.7 }),
      lootEntry({ item: 'horn', chance: 0.5, requires: knife, ruined: 'bone_shards' }),
      lootEntry({ item: 'bone', min: 1, max: 2 }),
    ],
  },
  {
    id: 'sheep_carcass',
    mode: 'all',
    rolls: 1,
    entries: [
      lootEntry({ item: 'raw_mutton', min: 1, max: 2, requires: knife, ruined: 'mangled_meat', ruinedChance: 0.8 }),
      lootEntry({ item: 'wool', min: 1, max: 3, requires: knife, ruined: 'matted_wool', ruinedChance: 0.9 }),
      lootEntry({ item: 'hide', chance: 0.5, requires: skinning, ruined: 'tattered_hide' }),
      lootEntry({ item: 'bone', min: 1, max: 1 }),
    ],
  },
  {
    id: 'deer_carcass',
    mode: 'all',
    rolls: 1,
    entries: [
      lootEntry({ item: 'raw_venison', min: 1, max: 3, requires: knife, ruined: 'mangled_meat', ruinedChance: 0.8 }),
      lootEntry({ item: 'hide', requires: skinning, ruined: 'tattered_hide', ruinedChance: 0.7 }),
      lootEntry({ item: 'antler', chance: 0.6, requires: knife, ruined: 'bone_shards' }),
      lootEntry({ item: 'bone', min: 1, max: 2 }),
    ],
  },
];

const ruleDefaults = { biomes: ['*'], surface: ['grass'], group: [1, 1], rarity: 'common' };

function spawnRule(def) {
  return { ...ruleDefaults, ...def };
}

export const SPAWN_RULES = [
  spawnRule({ id: 'plains_cattle', entity: 'cow', biomes: ['plains', 'savanna'], group: [2, 4], rarity: 'common' }),
  spawnRule({ id: 'meadow_sheep', entity: 'sheep', biomes: ['plains', 'tundra'], group: [3, 5], rarity: 'common' }),
  spawnRule({ id: 'forest_deer', entity: 'deer', biomes: ['forest', 'taiga'], group: [1, 3], rarity: 'uncommon' }),
  spawnRule({ id: 'plains_deer', entity: 'deer', biomes: ['plains'], group: [1, 2], rarity: 'rare' }),
];

/** @param {object[]} [extra] */
export function createEntityRegistry(extra = []) {
  const registry = new Registry('entity', {
    validate(def) {
      if (typeof def.form !== 'string') throw new TypeError(`entity "${def.id}" needs a form code`);
    },
  });
  registry.registerAll(ENTITY_DEFINITIONS);
  registry.registerAll(extra.map(entity));
  return registry;
}

/** @param {object[]} [extra] */
export function createSpawnRuleRegistry(extra = []) {
  const registry = new Registry('spawn rule', {
    validate(def) {
      if (!(def.rarity in RARITY_WEIGHTS)) throw new RangeError(`spawn rule "${def.id}" has unknown rarity "${def.rarity}"`);
      if (def.group[0] > def.group[1]) throw new RangeError(`spawn rule "${def.id}" has group min > max`);
    },
  });
  registry.registerAll(SPAWN_RULES);
  registry.registerAll(extra.map(spawnRule));
  return registry;
}
