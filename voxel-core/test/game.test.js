import test from 'node:test';
import assert from 'node:assert/strict';

import { createContent, BLOCK_IDS } from '../src/content/index.js';
import { EventBus, EVENTS } from '../src/core/event-bus.js';
import { WorldGenerator } from '../src/world/generator.js';
import { World } from '../src/world/world.js';
import { directionFromAngles } from '../src/world/raycast.js';
import { Inventory, metaEquals } from '../src/game/inventory.js';
import { Equipment } from '../src/game/equipment.js';
import { Character, STACKING } from '../src/game/character.js';
import { Player } from '../src/game/player.js';
import { GroundItemManager } from '../src/game/ground-items.js';
import {
  openContainer,
  createContainerData,
  transferStack,
  spillContainer,
} from '../src/game/containers.js';
import {
  InteractionSystem,
  INTERACTION,
  computeHarvestSeconds,
  playerOccupies,
} from '../src/game/interaction.js';
import { ItemUseSystem } from '../src/game/item-use.js';

const content = createContent();

function makeInventory(options = {}) {
  return new Inventory({ content, ...options });
}

/**
 * A tiny flat world: solid stone up to y=9, air above. Predictable geometry
 * makes reach/placement assertions exact.
 */
function makeFlatWorld(bus = new EventBus()) {
  const generator = new WorldGenerator({ seed: 'game-test', content });
  generator.layers = [
    {
      name: 'flat',
      generate(chunk) {
        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            for (let y = 0; y <= 9; y++) chunk.set(x, y, z, BLOCK_IDS.STONE);
            chunk.set(x, 9, z, BLOCK_IDS.GRASS);
          }
        }
      },
    },
  ];
  return new World({ generator, content, bus });
}

function makePlayer(bus, overrides = {}) {
  return new Player({
    id: 'p1',
    username: 'tester',
    content,
    bus,
    position: { x: 0.5, y: 10, z: 0.5 },
    ...overrides,
  });
}

// --------------------------------------------------------------- inventory

test('inventory fills partial stacks before empty slots', () => {
  const inv = makeInventory();
  inv.add('dirt', 60);
  const result = inv.add('dirt', 10);
  assert.equal(result.added, 10);
  assert.equal(result.remaining, 0);
  assert.equal(inv.slots[0].count, 64);
  assert.equal(inv.slots[1].count, 6);
});

test('inventory reports what it could not fit', () => {
  const inv = makeInventory({ size: 1, quickbarSize: 0 });
  const result = inv.add('dirt', 100);
  assert.equal(result.added, 64);
  assert.equal(result.remaining, 36);
});

test('inventory refuses unknown items', () => {
  const inv = makeInventory();
  assert.throws(() => inv.add('unobtanium', 1), /unknown item/);
});

test('stacks with different metadata never merge', () => {
  assert.ok(metaEquals({ durability: 5 }, { durability: 5 }));
  assert.ok(!metaEquals({ durability: 5 }, { durability: 4 }));
  assert.ok(metaEquals(null, null));

  const inv = makeInventory();
  inv.add('bread', 1, { baked: true });
  inv.add('bread', 1, { baked: false });
  assert.equal(inv.slots[0].count, 1);
  assert.equal(inv.slots[1].count, 1);
});

test('moving onto a compatible stack merges up to the max stack size', () => {
  const inv = makeInventory();
  inv.setSlot(0, { item: 'dirt', count: 60 });
  inv.setSlot(1, { item: 'dirt', count: 10 });
  assert.ok(inv.move(1, 0));
  assert.equal(inv.slots[0].count, 64);
  assert.equal(inv.slots[1].count, 6);
});

test('moving onto an incompatible stack swaps', () => {
  const inv = makeInventory();
  inv.setSlot(0, { item: 'dirt', count: 5 });
  inv.setSlot(1, { item: 'stone', count: 3 });
  assert.ok(inv.move(0, 1));
  assert.equal(inv.slots[0].item, 'stone');
  assert.equal(inv.slots[1].item, 'dirt');
});

test('locked slots resist moves and sorting', () => {
  const inv = makeInventory();
  inv.setSlot(10, { item: 'stone', count: 1 });
  inv.toggleLock(10);
  assert.ok(!inv.move(10, 11));
  inv.setSlot(20, { item: 'dirt', count: 1 });
  inv.sort();
  assert.equal(inv.slots[10].item, 'stone');
});

test('split halves a stack into a free slot', () => {
  const inv = makeInventory();
  inv.setSlot(0, { item: 'dirt', count: 9 });
  assert.ok(inv.split(0));
  assert.equal(inv.slots[0].count, 4);
  assert.equal(inv.slots[1].count, 5);
});

test('compact merges loose partial stacks', () => {
  const inv = makeInventory();
  inv.setSlot(0, { item: 'dirt', count: 10 });
  inv.setSlot(5, { item: 'dirt', count: 20 });
  inv.setSlot(9, { item: 'dirt', count: 30 });
  assert.ok(inv.compact() >= 1);
  assert.equal(inv.countOf('dirt'), 60);
  assert.equal(inv.slots[0].count, 60);
});

test('trash refuses items flagged as indestructible', () => {
  const inv = makeInventory();
  inv.add('tome_of_masonry', 1);
  const result = inv.trash(0);
  assert.equal(result.ok, false);
  assert.match(result.reason, /cannot be destroyed/);
});

test('canFit accounts for partial stacks and free slots', () => {
  const inv = makeInventory({ size: 2, quickbarSize: 0 });
  inv.setSlot(0, { item: 'dirt', count: 60 });
  assert.ok(inv.canFit('dirt', 68));
  assert.ok(!inv.canFit('dirt', 69));
});

test('inventory round-trips through JSON and drops removed content', () => {
  const inv = makeInventory();
  inv.add('dirt', 5);
  inv.toggleLock(3);
  const json = inv.toJSON();
  json.slots[1] = { item: 'removed_in_v2', count: 1 };

  const restored = makeInventory().loadJSON(json);
  assert.equal(restored.countOf('dirt'), 5);
  assert.equal(restored.slots[1], null);
  assert.ok(restored.lockedSlots.has(3));
});

// --------------------------------------------------------------- equipment

test('equipping validates the declared slot', () => {
  const equipment = new Equipment({ content });
  assert.equal(equipment.equip({ item: 'leather_cap' }).ok, true);
  assert.equal(equipment.get('head').item, 'leather_cap');

  const wrong = equipment.equip({ item: 'leather_cap' }, 'chest');
  assert.equal(wrong.ok, false);
  assert.match(wrong.reason, /does not fit/);

  const notEquippable = equipment.equip({ item: 'dirt' });
  assert.equal(notEquippable.ok, false);
});

test('equipping returns what it replaced', () => {
  const equipment = new Equipment({ content });
  equipment.equip({ item: 'wooden_pickaxe' });
  const result = equipment.equip({ item: 'stone_pickaxe' });
  assert.equal(result.replaced.item, 'wooden_pickaxe');
  assert.equal(equipment.mainHand.id, 'stone_pickaxe');
});

test('equipped items start at full durability and break at zero', () => {
  const bus = new EventBus();
  let broke = null;
  bus.on(EVENTS.ITEM_BROKE, (payload) => { broke = payload; });

  const equipment = new Equipment({ content, bus, ownerId: 'p1' });
  equipment.equip({ item: 'wooden_pickaxe' });
  assert.equal(equipment.get('main_hand').meta.durability, 60);

  assert.equal(equipment.damage('main_hand', 59).remaining, 1);
  const final = equipment.damage('main_hand', 1);
  assert.equal(final.broken, true);
  assert.equal(equipment.get('main_hand'), null);
  assert.equal(broke.item, 'wooden_pickaxe');
});

test('stats aggregate across every equipped item', () => {
  const equipment = new Equipment({ content });
  equipment.equip({ item: 'leather_cap' });
  equipment.equip({ item: 'leather_tunic' });
  equipment.equip({ item: 'wooden_shield' });
  const stats = equipment.aggregateStats();
  assert.equal(stats.defense, 6);
  assert.equal(stats.health, 2);
});

test('equipment exposes a visual payload for other clients', () => {
  const equipment = new Equipment({ content });
  equipment.equip({ item: 'leather_cap' });
  const visual = equipment.toVisual();
  assert.equal(visual.head, 'leather_cap');
  assert.equal(visual.chest, null);
});

// --------------------------------------------------------------- character

test('derived stats combine base, equipment and buffs', () => {
  const equipment = new Equipment({ content });
  equipment.equip({ item: 'leather_tunic' });
  const character = new Character({ content, equipment });

  assert.equal(character.getStat('defense'), 3);
  assert.equal(character.maxHealth, 22);

  const now = 1_000_000;
  character.applyBuff({ id: 'fortify', stat: 'defense', magnitude: 5, duration: 10 }, now);
  assert.equal(character.getStat('defense', now), 8);
  assert.equal(character.getStat('defense', now + 11_000), 3);
});

test('buff stacking rules behave differently', () => {
  const now = 1_000;
  const replace = new Character({ content });
  replace.applyBuff({ id: 'b', stat: 'attack', magnitude: 2, duration: 10 }, now);
  replace.applyBuff({ id: 'b', stat: 'attack', magnitude: 2, duration: 10 }, now);
  assert.equal(replace.getStat('attack', now), 1 + 2);

  const stack = new Character({ content });
  stack.applyBuff({ id: 'b', stat: 'attack', magnitude: 2, duration: 10, stacking: STACKING.STACK }, now);
  stack.applyBuff({ id: 'b', stat: 'attack', magnitude: 2, duration: 10, stacking: STACKING.STACK }, now);
  assert.equal(stack.getStat('attack', now), 1 + 4);

  const extend = new Character({ content });
  extend.applyBuff({ id: 'b', stat: 'attack', magnitude: 2, duration: 10, stacking: STACKING.EXTEND }, now);
  extend.applyBuff({ id: 'b', stat: 'attack', magnitude: 2, duration: 10, stacking: STACKING.EXTEND }, now);
  assert.equal(extend.buffs.get('b').expiresAt, now + 20_000);
});

test('expired buffs are cleaned up and announced', () => {
  const bus = new EventBus();
  let expired = 0;
  bus.on(EVENTS.BUFF_EXPIRED, () => { expired += 1; });

  const character = new Character({ content, bus });
  character.applyBuff({ id: 'short', stat: 'attack', magnitude: 1, duration: 1 }, 0);
  character.applyBuff({ id: 'long', stat: 'attack', magnitude: 1, duration: 100 }, 0);
  assert.equal(character.expireBuffs(5_000), 1);
  assert.equal(expired, 1);
  assert.ok(character.hasBuff('long'));
});

test('health is clamped to the derived maximum', () => {
  const character = new Character({ content });
  character.changeHealth(100);
  assert.equal(character.health, character.maxHealth);
  character.changeHealth(-1000);
  assert.equal(character.health, 0);
  assert.equal(character.isAlive, false);
});

test('experience rolls over into levels', () => {
  const character = new Character({ content });
  character.addExperience(50);
  assert.equal(character.level, 2);
  character.addExperience(74);
  assert.equal(character.level, 2);
  character.addExperience(1);
  assert.equal(character.level, 3);
});

test('knowledge is learned once', () => {
  const character = new Character({ content });
  assert.equal(character.learn('masonry'), true);
  assert.equal(character.learn('masonry'), false);
  assert.ok(character.knows('masonry'));
});

test('character persistence drops buffs that expired while offline', () => {
  const character = new Character({ content });
  character.applyBuff({ id: 'gone', stat: 'attack', magnitude: 1, duration: 10 }, 0);
  character.applyBuff({ id: 'kept', stat: 'attack', magnitude: 1, duration: 10_000 }, 0);
  const json = character.toJSON();

  const restored = new Character({ content }).loadJSON(json, 60_000);
  assert.ok(!restored.hasBuff('gone'));
  assert.ok(restored.hasBuff('kept'));
});

// ------------------------------------------------------------ ground items

test('ground items reserve drops for their owner then open up', () => {
  const manager = new GroundItemManager({ content });
  const bus = new EventBus();
  const owner = makePlayer(bus);
  const other = makePlayer(bus, { id: 'p2' });
  const now = 10_000;

  const entity = manager.spawn({ x: 0.5, y: 10, z: 0.5, item: 'dirt', count: 3, ownerId: 'p1', now });
  const denied = manager.pickup(entity.id, other, { now });
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /another player/);

  const allowed = manager.pickup(entity.id, owner, { now });
  assert.equal(allowed.ok, true);
  assert.equal(owner.inventory.countOf('dirt'), 3);
  assert.equal(manager.size, 0);
});

test('ground items respect reach and despawn on a timer', () => {
  const manager = new GroundItemManager({ content, ttlSeconds: 10 });
  const player = makePlayer(new EventBus());
  const entity = manager.spawn({ x: 50, y: 10, z: 50, item: 'dirt', now: 0 });
  assert.match(manager.pickup(entity.id, player, { now: 0 }).reason, /out of reach/);

  assert.equal(manager.tick(5_000).length, 0);
  assert.equal(manager.tick(10_000).length, 1);
  assert.equal(manager.size, 0);
});

test('ground items round-trip and skip already-expired entries', () => {
  const manager = new GroundItemManager({ content, ttlSeconds: 10 });
  manager.spawn({ x: 0, y: 0, z: 0, item: 'dirt', now: 0 });
  const json = manager.toJSON();
  const restored = new GroundItemManager({ content }).loadJSON(json, 0);
  assert.equal(restored.size, 1);
  assert.equal(new GroundItemManager({ content }).loadJSON(json, 60_000).size, 0);
});

// -------------------------------------------------------------- containers

test('containers persist their contents through the tile entity', () => {
  const world = makeFlatWorld();
  world.setBlock(2, 10, 2, BLOCK_IDS.CHEST);

  const handle = openContainer({ world, content, x: 2, y: 10, z: 2 });
  handle.inventory.add('coal', 5);
  handle.save();

  const reopened = openContainer({ world, content, x: 2, y: 10, z: 2 });
  assert.equal(reopened.inventory.countOf('coal'), 5);
});

test('containers fill from a loot table on first open only', () => {
  const world = makeFlatWorld();
  world.setBlock(3, 10, 3, BLOCK_IDS.CHEST);
  world.setTileEntity(3, 10, 3, createContainerData({ loot: 'starter_chest' }));

  const handle = openContainer({ world, content, x: 3, y: 10, z: 3 });
  const total = handle.inventory.slots.filter(Boolean).length;
  assert.ok(total > 0);

  const reopened = openContainer({ world, content, x: 3, y: 10, z: 3 });
  assert.equal(reopened.inventory.slots.filter(Boolean).length, total);
  assert.equal(reopened.data.loot, null);
});

test('opening a non-container returns null', () => {
  const world = makeFlatWorld();
  assert.equal(openContainer({ world, content, x: 0, y: 9, z: 0 }), null);
});

test('transferStack moves between inventories and stops when full', () => {
  const world = makeFlatWorld();
  world.setBlock(4, 10, 4, BLOCK_IDS.CHEST);
  const handle = openContainer({ world, content, x: 4, y: 10, z: 4 });
  const player = makePlayer(new EventBus());
  player.inventory.add('coal', 10);

  const moved = transferStack(player.inventory, 0, handle.inventory, 4);
  assert.equal(moved.moved, 4);
  assert.equal(player.inventory.countOf('coal'), 6);
  assert.equal(handle.inventory.countOf('coal'), 4);

  const tiny = new Inventory({ content, size: 1, quickbarSize: 0 });
  tiny.add('dirt', 64);
  assert.equal(transferStack(handle.inventory, 0, tiny).ok, false);
});

test('spillContainer drops everything into the world', () => {
  const world = makeFlatWorld();
  const groundItems = new GroundItemManager({ content });
  world.setBlock(5, 10, 5, BLOCK_IDS.CHEST);
  const handle = openContainer({ world, content, x: 5, y: 10, z: 5 });
  handle.inventory.add('coal', 3);
  handle.inventory.add('stick', 2);

  const dropped = spillContainer(handle, groundItems);
  assert.equal(dropped.length, 2);
  assert.equal(groundItems.size, 2);
  assert.equal(handle.inventory.countOf('coal'), 0);
});

// ------------------------------------------------------------- interaction

test('harvest time scales with hardness and tool tier', () => {
  const stone = content.blockByName('stone');
  const byHand = computeHarvestSeconds(stone, { toolClass: null, toolTier: 0 });
  const byPick = computeHarvestSeconds(stone, { toolClass: 'pickaxe', toolTier: 2 });
  assert.ok(byPick < byHand);
  assert.equal(computeHarvestSeconds(content.blockByName('air')), null);
  assert.equal(computeHarvestSeconds(content.blockByName('water')), null);
});

test('playerOccupies detects the cell a player stands in', () => {
  assert.ok(playerOccupies({ x: 0.5, y: 10, z: 0.5 }, 0, 10, 0));
  assert.ok(playerOccupies({ x: 0.5, y: 10, z: 0.5 }, 0, 11, 0));
  assert.ok(!playerOccupies({ x: 0.5, y: 10, z: 0.5 }, 0, 12, 0));
  assert.ok(!playerOccupies({ x: 0.5, y: 10, z: 0.5 }, 3, 10, 0));
});

function makeInteractionFixture({ collectDrops = true } = {}) {
  const bus = new EventBus();
  const world = makeFlatWorld(bus);
  const groundItems = new GroundItemManager({ content, bus });
  const interactions = new InteractionSystem({ world, content, bus, groundItems, collectDrops });
  const items = new ItemUseSystem({ content, interactions, bus });
  const player = makePlayer(bus);
  // Look straight down at the block under the player's feet.
  player.pitch = -Math.PI / 2;
  return { bus, world, groundItems, interactions, items, player };
}

test('resolveTarget finds the block the player is looking at', () => {
  const { interactions, player } = makeInteractionFixture();
  const target = interactions.resolveTarget(player);
  assert.deepEqual({ x: target.x, y: target.y, z: target.z }, { x: 0, y: 9, z: 0 });
  assert.equal(target.blockDef.name, 'grass');
  assert.ok(target.proximity > 0);
});

test('directionFromAngles agrees with the resolved target', () => {
  const { interactions, player } = makeInteractionFixture();
  const direction = directionFromAngles(player.yaw, player.pitch);
  assert.ok(direction.y < -0.99);
  assert.ok(interactions.resolveTarget(player));
});

test('interactions out of reach are rejected', () => {
  const { interactions, player } = makeInteractionFixture();
  const result = interactions.harvest(player, { x: 0, y: 9, z: 40 }, { force: true });
  assert.equal(result.ok, false);
  assert.match(result.reason, /out of reach/);
});

test('interactions without line of sight are rejected', () => {
  const { interactions, player } = makeInteractionFixture();
  const result = interactions.harvest(player, { x: 0, y: 7, z: 0 }, { force: true });
  assert.equal(result.ok, false);
  assert.match(result.reason, /line of sight/);
});

test('harvest requires the mining time to elapse', () => {
  const { interactions, player } = makeInteractionFixture();
  const target = { x: 0, y: 9, z: 0 };

  const started = interactions.harvest(player, target, { now: 0 });
  assert.equal(started.ok, false);
  assert.match(started.reason, /in progress/);

  const tooSoon = interactions.harvest(player, target, { now: 10 });
  assert.equal(tooSoon.ok, false);

  const done = interactions.harvest(player, target, { now: 5_000 });
  assert.equal(done.ok, true);
  assert.equal(done.block, 'grass');
});

test('harvest breaks the block, yields loot and schedules regrowth', () => {
  const { world, interactions, player } = makeInteractionFixture();
  const events = [];
  world.bus.on(EVENTS.INTERACTION, (payload) => events.push(payload));

  const result = interactions.harvest(player, { x: 0, y: 9, z: 0 }, { force: true });
  assert.equal(result.ok, true);
  assert.equal(world.getBlock(0, 9, 0), 0);
  assert.ok(player.inventory.countOf('dirt') >= 1);
  assert.equal(events.at(-1).kind, INTERACTION.HARVEST);
});

test('harvest drops fall to the ground when the inventory is full', () => {
  const { interactions, groundItems, player } = makeInteractionFixture();
  for (let i = 0; i < player.inventory.size; i++) {
    player.inventory.setSlot(i, { item: 'stone', count: 64 });
  }
  const result = interactions.harvest(player, { x: 0, y: 9, z: 0 }, { force: true });
  assert.equal(result.ok, true);
  assert.ok(groundItems.size >= 1);
  assert.ok(result.drops.some((drop) => drop.to === 'ground'));
});

test('loot requirements gate drops on the tool used', () => {
  const { world, interactions, player } = makeInteractionFixture();
  world.setBlock(0, 10, 0, BLOCK_IDS.STONE);
  player.position = { x: 0.5, y: 11, z: 0.5 };

  const barehanded = interactions.harvest(player, { x: 0, y: 10, z: 0 }, { force: true });
  assert.equal(barehanded.ok, true);
  assert.equal(player.inventory.countOf('cobblestone'), 0);

  world.setBlock(0, 10, 0, BLOCK_IDS.STONE);
  player.equipment.equip({ item: 'stone_pickaxe' });
  const withTool = interactions.harvest(player, { x: 0, y: 10, z: 0 }, { force: true });
  assert.equal(withTool.ok, true);
  assert.equal(player.inventory.countOf('cobblestone'), 1);
});

test('harvesting spends tool durability', () => {
  const { interactions, player } = makeInteractionFixture();
  player.equipment.equip({ item: 'wooden_pickaxe' });
  interactions.harvest(player, { x: 0, y: 9, z: 0 }, { force: true });
  assert.equal(player.equipment.get('main_hand').meta.durability, 59);
});

test('unbreakable blocks cannot be harvested', () => {
  const { world, interactions, player } = makeInteractionFixture();
  world.setBlock(0, 10, 0, BLOCK_IDS.WATER);
  player.position = { x: 0.5, y: 11, z: 0.5 };
  const result = interactions.harvest(player, { x: 0, y: 10, z: 0 }, { force: true });
  assert.equal(result.ok, false);
});

test('breaking a chest spills its contents', () => {
  const { world, interactions, groundItems, player } = makeInteractionFixture();
  world.setBlock(0, 10, 0, BLOCK_IDS.CHEST);
  const handle = openContainer({ world, content, x: 0, y: 10, z: 0 });
  handle.inventory.add('coal', 7);
  handle.save();

  player.position = { x: 0.5, y: 11, z: 0.5 };
  for (let i = 0; i < player.inventory.size; i++) {
    player.inventory.setSlot(i, { item: 'stone', count: 64 });
  }
  const result = interactions.harvest(player, { x: 0, y: 10, z: 0 }, { force: true });
  assert.equal(result.ok, true);
  assert.ok([...groundItems.items.values()].some((entity) => entity.item === 'coal'));
});

test('placement rules reject occupied space, unsupported blocks and players', () => {
  const { world, interactions, player } = makeInteractionFixture();
  player.inventory.setSlot(0, { item: 'stone', count: 5 });

  assert.match(interactions.place(player, { target: { x: 0, y: 9, z: 0 } }).reason, /occupied/);
  assert.match(
    interactions.place(player, { target: { x: 0, y: 10, z: 0 } }).reason,
    /standing there/,
  );

  player.inventory.setSlot(0, { item: 'torch', count: 5 });
  assert.match(
    interactions.validatePlacement(player, { x: 0, y: 12, z: 0 }, 'torch').reason,
    /solid ground/,
  );
});

test('placing consumes the item and writes the block', () => {
  const { world, interactions, player } = makeInteractionFixture();
  player.position = { x: 0.5, y: 10, z: 2.5 };
  player.inventory.setSlot(0, { item: 'stone', count: 5 });

  const result = interactions.place(player, { target: { x: 0, y: 10, z: 0 } });
  assert.equal(result.ok, true);
  assert.equal(world.getBlock(0, 10, 0), BLOCK_IDS.STONE);
  assert.equal(player.inventory.countOf('stone'), 4);
});

test('non-placeable items are refused', () => {
  const { interactions, player } = makeInteractionFixture();
  player.inventory.setSlot(0, { item: 'bread', count: 1 });
  const result = interactions.place(player, { target: { x: 0, y: 10, z: 0 } });
  assert.equal(result.ok, false);
  assert.match(result.reason, /not placeable/);
});

test('interact toggles a door and opens a chest', () => {
  const { world, interactions, player } = makeInteractionFixture();
  world.setBlock(0, 10, 0, BLOCK_IDS.DOOR);
  player.position = { x: 0.5, y: 11, z: 0.5 };

  const toggled = interactions.interact(player, { x: 0, y: 10, z: 0 });
  assert.equal(toggled.ok, true);
  assert.equal(toggled.state.on, true);
  assert.equal(interactions.interact(player, { x: 0, y: 10, z: 0 }).state.on, false);

  world.setBlock(0, 10, 0, BLOCK_IDS.CHEST);
  const opened = interactions.interact(player, { x: 0, y: 10, z: 0 });
  assert.equal(opened.action, 'open-container');
  assert.deepEqual(player.openContainer, { x: 0, y: 10, z: 0 });
});

test('interacting with a plain block does nothing', () => {
  const { interactions, player } = makeInteractionFixture();
  const result = interactions.interact(player, { x: 0, y: 9, z: 0 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /nothing to interact/);
});

test('custom interactions are registered, not branched', () => {
  const { interactions, player, world } = makeInteractionFixture();
  world.setBlock(0, 10, 0, BLOCK_IDS.DOOR);
  player.position = { x: 0.5, y: 11, z: 0.5 };

  interactions.registerInteraction('door', () => ({ ok: true, action: 'custom' }));
  assert.equal(interactions.interact(player, { x: 0, y: 10, z: 0 }).action, 'custom');
});

test('perform routes each interaction class', () => {
  const { interactions, player } = makeInteractionFixture();
  player.inventory.setSlot(0, { item: 'stone', count: 1 });
  player.position = { x: 0.5, y: 10, z: 2.5 };

  assert.equal(interactions.perform(INTERACTION.PLACE, player, { target: { x: 0, y: 10, z: 0 } }).ok, true);
  assert.equal(interactions.perform('nonsense', player, {}).ok, false);
});

// ---------------------------------------------------------------- item use

test('consumables heal, restore energy and apply buffs', () => {
  const { items, player } = makeInteractionFixture();
  player.character.changeHealth(-10);
  player.character.changeEnergy(-50);
  player.inventory.setSlot(0, { item: 'healing_potion', count: 2 });

  const result = items.use(player, { slot: 0, now: 0 });
  assert.equal(result.ok, true);
  assert.equal(player.character.health, 20);
  assert.ok(player.character.hasBuff('regeneration'));
  assert.equal(player.inventory.countOf('healing_potion'), 1);
});

test('learnable items grant knowledge once', () => {
  const { items, player } = makeInteractionFixture();
  player.inventory.setSlot(0, { item: 'tome_of_masonry', count: 1 });
  assert.equal(items.use(player, { slot: 0 }).ok, true);
  assert.ok(player.character.knows('masonry'));

  player.inventory.setSlot(0, { item: 'tome_of_masonry', count: 1 });
  const again = items.use(player, { slot: 0 });
  assert.equal(again.ok, false);
  assert.match(again.reason, /already known/);
});

test('using an equippable item moves it into its slot', () => {
  const { items, player } = makeInteractionFixture();
  player.inventory.setSlot(0, { item: 'wooden_pickaxe', count: 1 });
  const result = items.use(player, { slot: 0 });
  assert.equal(result.ok, true);
  assert.equal(player.equipment.mainHand.id, 'wooden_pickaxe');
  assert.equal(player.inventory.getSlot(0), null);
});

test('equipping swaps the previously equipped item back into the slot', () => {
  const { items, player } = makeInteractionFixture();
  player.equipment.equip({ item: 'wooden_pickaxe' });
  player.inventory.setSlot(0, { item: 'stone_pickaxe', count: 1 });

  items.use(player, { slot: 0 });
  assert.equal(player.equipment.mainHand.id, 'stone_pickaxe');
  assert.equal(player.inventory.getSlot(0).item, 'wooden_pickaxe');
});

test('using a placeable item routes to block placement', () => {
  const { items, world, player } = makeInteractionFixture();
  player.position = { x: 0.5, y: 10, z: 2.5 };
  player.inventory.setSlot(0, { item: 'planks', count: 3 });

  const result = items.use(player, { slot: 0, target: { x: 0, y: 10, z: 0 } });
  assert.equal(result.ok, true);
  assert.equal(world.getBlock(0, 10, 0), BLOCK_IDS.PLANKS);
  assert.equal(player.inventory.countOf('planks'), 2);
});

test('using an item with no action reports that nothing happens', () => {
  const { items, player } = makeInteractionFixture();
  player.inventory.setSlot(0, { item: 'coal', count: 1 });
  const result = items.use(player, { slot: 0 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /nothing happens/);
});

test('using an empty slot is refused', () => {
  const { items, player } = makeInteractionFixture();
  assert.match(items.use(player, { slot: 5 }).reason, /empty hand/);
});

test('item use emits a single canonical event', () => {
  const { items, bus, player } = makeInteractionFixture();
  const used = [];
  bus.on(EVENTS.ITEM_USED, (payload) => used.push(payload));
  player.inventory.setSlot(0, { item: 'bread', count: 1 });
  items.use(player, { slot: 0 });
  assert.equal(used.length, 1);
  assert.equal(used[0].item, 'bread');
});

test('custom use actions are registered, not branched', () => {
  const { items, player } = makeInteractionFixture();
  items.registerAction('consume', () => ({ ok: true, action: 'custom-consume' }));
  player.inventory.setSlot(0, { item: 'bread', count: 1 });
  assert.equal(items.use(player, { slot: 0 }).action, 'custom-consume');
});

// ------------------------------------------------------------------ player

test('player bundles inventory, equipment and character state', () => {
  const player = makePlayer(new EventBus());
  player.inventory.setSlot(0, { item: 'wooden_axe', count: 1 });
  player.inventory.selectSlot(0);
  assert.equal(player.heldItem().id, 'wooden_axe');
  assert.equal(player.toolContext().toolClass, 'axe');

  player.equipment.equip({ item: 'stone_pickaxe' });
  assert.equal(player.toolContext().toolClass, 'pickaxe');
  assert.equal(player.toolSlot(), 'main_hand');
});

test('player state round-trips through JSON', () => {
  const player = makePlayer(new EventBus());
  player.inventory.add('coal', 4);
  player.equipment.equip({ item: 'leather_cap' });
  player.character.learn('masonry');
  player.character.addExperience(10);
  player.position = { x: 12.5, y: 33, z: -4.5 };

  const restored = makePlayer(new EventBus()).loadJSON(player.toJSON());
  assert.deepEqual(restored.position, { x: 12.5, y: 33, z: -4.5 });
  assert.equal(restored.inventory.countOf('coal'), 4);
  assert.equal(restored.equipment.get('head').item, 'leather_cap');
  assert.ok(restored.character.knows('masonry'));
  assert.equal(restored.character.experience, 10);
});

test('network state exposes only what other clients need', () => {
  const player = makePlayer(new EventBus());
  player.equipment.equip({ item: 'leather_cap' });
  const state = player.toNetworkState();
  assert.equal(state.equipment.head, 'leather_cap');
  assert.equal(state.inventory, undefined);

  const self = player.toSelfState();
  assert.ok(self.inventory);
  assert.ok(self.stats.defense >= 1);
});

test('Player equip/unequip between inventory and equipment', async (t) => {
  await t.test('equipping swaps the replaced item into the vacated slot', () => {
    const player = makePlayer(new EventBus());
    player.inventory.setSlot(3, { item: 'wooden_pickaxe', count: 1 });
    player.inventory.setSlot(4, { item: 'wooden_axe', count: 1 });

    assert.equal(player.equipFromSlot(3).ok, true);
    assert.equal(player.equipment.get('main_hand').item, 'wooden_pickaxe');
    assert.equal(player.inventory.getSlot(3), null);

    const swap = player.equipFromSlot(4);
    assert.equal(swap.ok, true);
    assert.equal(swap.replaced.item, 'wooden_pickaxe');
    assert.equal(player.equipment.get('main_hand').item, 'wooden_axe');
    assert.equal(player.inventory.getSlot(4).item, 'wooden_pickaxe');
  });

  await t.test('refuses empty, locked and non-equippable slots', () => {
    const player = makePlayer(new EventBus());
    player.inventory.setSlot(0, { item: 'bread', count: 2 });
    player.inventory.setSlot(1, { item: 'leather_cap', count: 1 });
    player.inventory.toggleLock(1);

    assert.equal(player.equipFromSlot(5).reason, 'empty slot');
    assert.match(player.equipFromSlot(0).reason, /not equippable/);
    assert.equal(player.equipFromSlot(1).reason, 'slot is locked');
    assert.equal(player.equipment.get('head'), null);
  });

  await t.test('unequip prefers the requested free slot, else any free slot', () => {
    const player = makePlayer(new EventBus());
    player.inventory.setSlot(0, { item: 'leather_cap', count: 1 });
    player.equipFromSlot(0);

    assert.equal(player.unequipToInventory('head', 12).ok, true);
    assert.equal(player.inventory.getSlot(12).item, 'leather_cap');
    assert.equal(player.inventory.getSlot(12).meta.durability, 80);

    player.equipFromSlot(12);
    player.inventory.setSlot(5, { item: 'bread', count: 1 });
    assert.equal(player.unequipToInventory('head', 5).ok, true);
    assert.equal(player.inventory.getSlot(5).item, 'bread');
    assert.equal(player.inventory.countOf('leather_cap'), 1);
  });

  await t.test('unequip fails when the inventory is full', () => {
    const player = makePlayer(new EventBus());
    player.inventory.setSlot(0, { item: 'wooden_shield', count: 1 });
    player.equipFromSlot(0);
    for (let i = 0; i < player.inventory.size; i++) player.inventory.setSlot(i, { item: 'wooden_axe', count: 1 });

    assert.equal(player.unequipToInventory('off_hand').reason, 'inventory full');
    assert.equal(player.equipment.get('off_hand').item, 'wooden_shield');
    assert.equal(player.unequipToInventory('head').reason, 'nothing equipped');
  });
});
