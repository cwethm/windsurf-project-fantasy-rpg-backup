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
 * `requires` may specify `toolClass`, `toolTier` and/or `knowledge`; entries
 * whose requirements are unmet are skipped, which is how "needs a pickaxe" and
 * "needs the masonry skill" conditional drops are expressed without code.
 */

import { Registry } from '../core/registry.js';
import { TOOL_CLASSES } from './blocks.js';

const entryDefaults = {
  min: 1,
  max: 1,
  weight: 1,
  chance: 1,
  requires: null,
};

function entry(def) {
  return { ...entryDefaults, ...def };
}

function simpleTable(id, itemId, extra = {}) {
  return {
    id,
    mode: 'all',
    rolls: 1,
    entries: [entry({ item: itemId, ...extra })],
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
      entry({ item: 'dirt' }),
      entry({ item: 'seeds', chance: 0.125 }),
    ],
  },
  {
    id: 'tall_grass',
    mode: 'all',
    rolls: 1,
    entries: [entry({ item: 'seeds', chance: 0.25 })],
  },
  {
    id: 'leaves',
    mode: 'all',
    rolls: 1,
    entries: [
      entry({ item: 'stick', chance: 0.2, min: 1, max: 2 }),
      entry({ item: 'leaves', chance: 1, requires: { toolClass: TOOL_CLASSES.SHEARS } }),
    ],
  },
  {
    id: 'stone',
    mode: 'all',
    rolls: 1,
    entries: [
      entry({ item: 'cobblestone', requires: { toolClass: TOOL_CLASSES.PICKAXE, toolTier: 1 } }),
    ],
  },
  {
    id: 'cobblestone',
    mode: 'all',
    rolls: 1,
    entries: [
      entry({ item: 'cobblestone', requires: { toolClass: TOOL_CLASSES.PICKAXE, toolTier: 1 } }),
    ],
  },
  {
    id: 'coal_ore',
    mode: 'all',
    rolls: 1,
    entries: [
      entry({
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
      entry({
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
      entry({ item: 'bread', weight: 5, min: 1, max: 3 }),
      entry({ item: 'stick', weight: 4, min: 2, max: 6 }),
      entry({ item: 'coal', weight: 3, min: 1, max: 4 }),
      entry({ item: 'wooden_pickaxe', weight: 2 }),
      entry({ item: 'leather_cap', weight: 1 }),
      entry({ item: 'healing_potion', weight: 1 }),
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
  const eligible = table.entries.filter((e) => meetsRequirements(e.requires, context));
  if (eligible.length === 0) return [];

  /** @type {Map<string, number>} */
  const totals = new Map();
  const award = (e) => {
    const count = e.min === e.max ? e.min : rng.int(e.min, e.max);
    if (count <= 0) return;
    totals.set(e.item, (totals.get(e.item) ?? 0) + count);
  };

  if (table.mode === 'weighted') {
    const rolls = Math.max(1, table.rolls ?? 1);
    for (let i = 0; i < rolls; i++) {
      const picked = rng.pickWeighted(eligible);
      if (picked && rng.chance(picked.chance)) award(picked);
    }
  } else {
    for (const e of eligible) {
      if (rng.chance(e.chance)) award(e);
    }
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
