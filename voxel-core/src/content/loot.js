/**
 * Loot tables.
 *
 * A loot table maps a harvest event to a list of item stacks. Tables are data:
 * `HARVEST` never special-cases a block, it just rolls `block.drops`.
 *
 * Table fields
 * ------------
 *  id       stable key referenced by `block.drops`
 *  mode     'all'      – evaluate every entry independently against `chance`
 *           'weighted' – draw `rolls` entries using entry weights
 *  rolls    number of weighted draws (weighted mode only)
 *  entries  `{ item, min, max, weight, chance, requires }`
 *
 * `requires` may specify `toolClass`, `toolTier` and/or `knowledge`, which is
 * how "needs a pickaxe" and "needs the masonry skill" conditional drops are
 * expressed without code. An entry whose requirements are unmet is not simply
 * skipped: it still drops the real item at `chance * unskilled`, and otherwise
 * may produce its `ruined` item (a botched result) at `chance * ruinedChance`.
 */

/** Default odds that a gated entry still drops for an unequipped, untrained harvester. */
export const DEFAULT_UNSKILLED_CHANCE = 0.05;

import { Registry } from '../core/registry.js';
import { TOOL_CLASSES } from './blocks.js';

const entryDefaults = {
  min: 1,
  max: 1,
  weight: 1,
  chance: 1,
  requires: null,
  unskilled: DEFAULT_UNSKILLED_CHANCE,
  ruined: null,
  ruinedChance: 0.5,
};

export function lootEntry(def) {
  return { ...entryDefaults, ...def };
}

function simpleTable(id, itemId, extra = {}) {
  return {
    id,
    mode: 'all',
    rolls: 1,
    entries: [lootEntry({ item: itemId, ...extra })],
  };
}

export const LOOT_TABLES = [
  simpleTable('dirt', 'dirt'),
  simpleTable('sand', 'sand'),
  simpleTable('log', 'log'),
  simpleTable('planks', 'planks'),
  simpleTable('chest', 'chest'),
  simpleTable('door', 'door'),
  simpleTable('torch', 'torch'),
  simpleTable('flowers', 'flowers'),
  {
    id: 'grass',
    mode: 'all',
    rolls: 1,
    entries: [
      lootEntry({ item: 'dirt' }),
      lootEntry({ item: 'seeds', chance: 0.125 }),
    ],
  },
  {
    id: 'tall_grass',
    mode: 'all',
    rolls: 1,
    entries: [lootEntry({ item: 'seeds', chance: 0.25 })],
  },
  {
    id: 'leaves',
    mode: 'all',
    rolls: 1,
    entries: [
      lootEntry({ item: 'stick', chance: 0.2, min: 1, max: 2 }),
      lootEntry({ item: 'leaves', chance: 1, requires: { toolClass: TOOL_CLASSES.SHEARS } }),
    ],
  },
  {
    id: 'stone',
    mode: 'all',
    rolls: 1,
    entries: [
      lootEntry({ item: 'cobblestone', requires: { toolClass: TOOL_CLASSES.PICKAXE, toolTier: 1 } }),
    ],
  },
  {
    id: 'cobblestone',
    mode: 'all',
    rolls: 1,
    entries: [
      lootEntry({ item: 'cobblestone', requires: { toolClass: TOOL_CLASSES.PICKAXE, toolTier: 1 } }),
    ],
  },
  {
    id: 'coal_ore',
    mode: 'all',
    rolls: 1,
    entries: [
      lootEntry({
        item: 'coal',
        min: 1,
        max: 3,
        requires: { toolClass: TOOL_CLASSES.PICKAXE, toolTier: 1 },
      }),
    ],
  },
  {
    id: 'iron_ore',
    mode: 'all',
    rolls: 1,
    entries: [
      lootEntry({
        item: 'iron_ore',
        requires: { toolClass: TOOL_CLASSES.PICKAXE, toolTier: 2 },
      }),
    ],
  },
  {
    id: 'starter_chest',
    mode: 'weighted',
    rolls: 3,
    entries: [
      lootEntry({ item: 'bread', weight: 5, min: 1, max: 3 }),
      lootEntry({ item: 'stick', weight: 4, min: 2, max: 6 }),
      lootEntry({ item: 'coal', weight: 3, min: 1, max: 4 }),
      lootEntry({ item: 'wooden_pickaxe', weight: 2 }),
      lootEntry({ item: 'leather_cap', weight: 1 }),
      lootEntry({ item: 'healing_potion', weight: 1 }),
      lootEntry({ item: 'flint_knife', weight: 2 }),
      lootEntry({ item: 'butchers_primer', weight: 1 }),
    ],
  },
];

/**
 * Does a harvest context satisfy an entry's requirements?
 * @param {object|null} requires
 * @param {{ toolClass?: string|null, toolTier?: number, knowledge?: Set<string>|string[] }} context
 */
export function meetsRequirements(requires, context = {}) {
  if (!requires) return true;
  if (requires.toolClass && requires.toolClass !== (context.toolClass ?? null)) return false;
  if (requires.toolTier && (context.toolTier ?? 0) < requires.toolTier) return false;
  if (requires.knowledge) {
    const known = context.knowledge;
    const has = known instanceof Set ? known.has(requires.knowledge) : Array.isArray(known) && known.includes(requires.knowledge);
    if (!has) return false;
  }
  return true;
}

/**
 * Roll a loot table into a list of `{ item, count }` stacks.
 * @param {object} table
 * @param {import('../core/rng.js').Random} rng
 * @param {object} [context] harvest context (`toolClass`, `toolTier`, `knowledge`)
 * @returns {{ item: string, count: number }[]}
 */
export function rollLootTable(table, rng, context = {}) {
  if (!table) return [];
  const candidates = [];
  for (const e of table.entries) {
    if (meetsRequirements(e.requires, context)) candidates.push({ entry: e, skilled: true });
    else if ((e.unskilled ?? DEFAULT_UNSKILLED_CHANCE) > 0 || e.ruined) candidates.push({ entry: e, skilled: false });
  }
  if (candidates.length === 0) return [];

  /** @type {Map<string, number>} */
  const totals = new Map();
  const award = (item, e) => {
    const count = e.min === e.max ? e.min : rng.int(e.min, e.max);
    if (count <= 0) return;
    totals.set(item, (totals.get(item) ?? 0) + count);
  };
  const resolve = ({ entry: e, skilled }) => {
    if (skilled) {
      if (rng.chance(e.chance)) award(e.item, e);
      return;
    }
    const roll = rng.next();
    const real = e.chance * (e.unskilled ?? DEFAULT_UNSKILLED_CHANCE);
    if (roll < real) award(e.item, e);
    else if (e.ruined && roll < real + e.chance * (e.ruinedChance ?? 0)) award(e.ruined, e);
  };

  if (table.mode === 'weighted') {
    const rolls = Math.max(1, table.rolls ?? 1);
    const weighted = candidates.map((c) => ({ ...c, weight: c.entry.weight }));
    for (let i = 0; i < rolls; i++) {
      const picked = rng.pickWeighted(weighted);
      if (picked) resolve(picked);
    }
  } else {
    for (const candidate of candidates) resolve(candidate);
  }

  return [...totals].map(([item, count]) => ({ item, count }));
}

/**
 * Build a loot registry.
 * @param {object[]} [extraTables]
 * @returns {Registry}
 */
export function createLootRegistry(extraTables = []) {
  const registry = new Registry('loot table', {
    validate(def) {
      if (!Array.isArray(def.entries)) {
        throw new TypeError(`loot table "${def.id}" needs an entries array`);
      }
      for (const e of def.entries) {
        if (typeof e.item !== 'string') {
          throw new TypeError(`loot table "${def.id}" has an entry without an item id`);
        }
        if (e.min > e.max) {
          throw new RangeError(`loot table "${def.id}" entry "${e.item}" has min > max`);
        }
      }
    },
  });
  registry.registerAll(LOOT_TABLES);
  registry.registerAll(extraTables);
  return registry;
}
