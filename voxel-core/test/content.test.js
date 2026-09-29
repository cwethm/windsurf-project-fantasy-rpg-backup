import test from 'node:test';
import assert from 'node:assert/strict';

import { createContent, BLOCK_IDS, TOOL_CLASSES, USE_ACTIONS } from '../src/content/index.js';
import { rollLootTable, meetsRequirements } from '../src/content/loot.js';
import { Random } from '../src/core/rng.js';

const content = createContent();

test('default content loads and cross-references resolve', () => {
  assert.ok(content.blocks.size > 10);
  assert.ok(content.items.size > 10);
  assert.ok(content.loot.size > 5);
  assert.equal(content.blockId('stone'), BLOCK_IDS.STONE);
  assert.equal(content.block(BLOCK_IDS.AIR).name, 'air');
  assert.throws(() => content.blockId('unobtainium'), /Unknown block name/);
});

test('block flags describe behaviour instead of code branches', () => {
  assert.equal(content.isSolid(BLOCK_IDS.AIR), false);
  assert.equal(content.isSolid(BLOCK_IDS.STONE), true);
  assert.equal(content.isReplaceable(BLOCK_IDS.WATER), true);
  assert.equal(content.isReplaceable(BLOCK_IDS.STONE), false);
  assert.equal(content.block(BLOCK_IDS.TORCH).light, 14);
  assert.equal(content.block(BLOCK_IDS.CHEST).interactable, true);
  assert.equal(content.block(BLOCK_IDS.CHEST).tileEntity, 'container');
  assert.equal(content.block(BLOCK_IDS.STONE).interactable, false);
  assert.equal(content.block(BLOCK_IDS.AIR).hardness, null);
});

test('placeable items map back to their block', () => {
  const stoneItem = content.itemForBlock(BLOCK_IDS.STONE);
  assert.equal(stoneItem.id, 'stone');
  assert.equal(stoneItem.use.action, USE_ACTIONS.PLACE);
  assert.equal(content.itemForBlock(BLOCK_IDS.AIR), null);
});

test('tools declare class and tier, equipment declares slots', () => {
  const pick = content.item('stone_pickaxe');
  assert.equal(pick.toolClass, TOOL_CLASSES.PICKAXE);
  assert.equal(pick.toolTier, 2);
  assert.equal(pick.maxStack, 1);
  assert.equal(pick.equipSlot, 'main_hand');
  assert.equal(content.item('leather_tunic').stats.defense, 3);
  assert.equal(content.item('bread').use.action, USE_ACTIONS.CONSUME);
  assert.equal(content.item('tome_of_masonry').use.action, USE_ACTIONS.LEARN);
  assert.equal(content.item('tome_of_masonry').trashable, false);
});

test('registry validation rejects malformed content', () => {
  assert.throws(() => createContent({ blocks: [{ id: 'x', name: 'bad' }] }), /integer id/);
  assert.throws(() => createContent({ blocks: [{ id: 900, name: 'bright', light: 99 }] }), /light must be/);
  assert.throws(() => createContent({ items: [{ id: 'bad', maxStack: 0 }] }), /maxStack/);
  assert.throws(
    () => createContent({ items: [{ id: 'bad', maxStack: 64, durability: 10 }] }),
    /maxStack must be 1/,
  );
  assert.throws(
    () => createContent({ items: [{ id: 'ghost', maxStack: 1, placeable: 'nope' }] }),
    /unknown block/,
  );
  assert.throws(
    () => createContent({ loot: [{ id: 'ghost', mode: 'all', entries: [{ item: 'nope', min: 1, max: 1, chance: 1, weight: 1 }] }] }),
    /unknown item/,
  );
});

test('content is extensible without touching engine code', () => {
  const extended = createContent({
    blocks: [{ id: 700, name: 'crystal', hardness: 4, toolClass: TOOL_CLASSES.PICKAXE, drops: 'crystal' }],
    items: [{ id: 'crystal_shard', name: 'Crystal Shard', maxStack: 32 }],
    loot: [{ id: 'crystal', mode: 'all', rolls: 1, entries: [{ item: 'crystal_shard', min: 2, max: 2, weight: 1, chance: 1, requires: null }] }],
  });
  const drops = extended.rollBlockDrops(700, new Random(1), { toolClass: TOOL_CLASSES.PICKAXE, toolTier: 2 });
  assert.deepEqual(drops, [{ item: 'crystal_shard', count: 2 }]);
});

test('loot requirements gate conditional drops', () => {
  assert.equal(meetsRequirements(null, {}), true);
  assert.equal(meetsRequirements({ toolClass: 'pickaxe' }, { toolClass: 'axe' }), false);
  assert.equal(meetsRequirements({ toolTier: 2 }, { toolTier: 1 }), false);
  assert.equal(meetsRequirements({ toolTier: 2 }, { toolTier: 2 }), true);
  assert.equal(meetsRequirements({ knowledge: 'masonry' }, { knowledge: new Set(['masonry']) }), true);
  assert.equal(meetsRequirements({ knowledge: 'masonry' }, { knowledge: [] }), false);
});

test('stone only drops for a sufficient pickaxe', () => {
  const byHand = content.rollBlockDrops(BLOCK_IDS.STONE, new Random(5), { toolClass: null, toolTier: 0 });
  assert.deepEqual(byHand, []);
  const withPick = content.rollBlockDrops(BLOCK_IDS.STONE, new Random(5), {
    toolClass: TOOL_CLASSES.PICKAXE,
    toolTier: 1,
  });
  assert.deepEqual(withPick, [{ item: 'cobblestone', count: 1 }]);
});

test('iron ore needs tier 2 while coal needs tier 1', () => {
  const ctx1 = { toolClass: TOOL_CLASSES.PICKAXE, toolTier: 1 };
  const ctx2 = { toolClass: TOOL_CLASSES.PICKAXE, toolTier: 2 };
  assert.deepEqual(content.rollBlockDrops(BLOCK_IDS.IRON_ORE, new Random(2), ctx1), []);
  assert.deepEqual(content.rollBlockDrops(BLOCK_IDS.IRON_ORE, new Random(2), ctx2), [
    { item: 'iron_ore', count: 1 },
  ]);
  const coal = content.rollBlockDrops(BLOCK_IDS.COAL_ORE, new Random(2), ctx1);
  assert.equal(coal.length, 1);
  assert.equal(coal[0].item, 'coal');
  assert.ok(coal[0].count >= 1 && coal[0].count <= 3);
});

test('loot rolls are deterministic for a given seed', () => {
  const table = content.loot.get('starter_chest');
  const a = rollLootTable(table, new Random(99));
  const b = rollLootTable(table, new Random(99));
  assert.deepEqual(a, b);
  assert.ok(a.length > 0 && a.length <= 3);
  const total = a.reduce((sum, s) => sum + s.count, 0);
  assert.ok(total > 0);
});

test('unknown or dropless blocks yield nothing', () => {
  assert.deepEqual(content.rollBlockDrops(BLOCK_IDS.AIR, new Random(1)), []);
  assert.deepEqual(content.rollBlockDrops(BLOCK_IDS.GLASS, new Random(1)), []);
  assert.deepEqual(content.rollBlockDrops(4242, new Random(1)), []);
  assert.deepEqual(rollLootTable(undefined, new Random(1)), []);
});
