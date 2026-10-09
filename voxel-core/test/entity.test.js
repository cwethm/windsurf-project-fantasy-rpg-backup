import test from 'node:test';
import assert from 'node:assert/strict';
import { createContent, BLOCK_IDS } from '../src/content/index.js';
import { EventBus, EVENTS } from '../src/core/event-bus.js';
import { Random } from '../src/core/rng.js';
import { WorldGenerator } from '../src/world/generator.js';
import { World } from '../src/world/world.js';
import { rollLootTable, lootEntry } from '../src/content/loot.js';
import {
  parseFormCode,
  isValidFormCode,
  resolveForm,
  formDimensions,
  entityBox,
  rayBoxDistance,
  distanceToBox,
  pickEntity,
  EntityManager,
  Spawner,
  grazerBrain,
} from '../src/entity/index.js';

const content = createContent();

function flatWorld(bus = new EventBus()) {
  const generator = new WorldGenerator({ seed: 'entity-test', content });
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
  const world = new World({ generator, content, bus });
  for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) world.getChunk(cx, cz);
  return world;
}

// ------------------------------------------------------------- form codes

test('parseFormCode reads plan, numeric params, counts, jitter, flags and styles', () => {
  const parsed = parseFormCode('Q|bd:L14~2W8H9|lg:L7T3|hd:L5W4H4|hn:2L3C1|ud|pt:patch,F2EEE6,3a2a20');
  assert.equal(parsed.plan, 'Q');
  const byOp = Object.fromEntries(parsed.features.map((f) => [f.op, f]));
  assert.deepEqual(byOp.bd.params.L, { value: 14, jitter: 2 });
  assert.equal(byOp.hn.params.n.value, 2);
  assert.equal(byOp.hn.params.C.value, 1);
  assert.deepEqual(byOp.ud.params, {});
  assert.deepEqual(byOp.pt.words, ['patch']);
  assert.deepEqual(byOp.pt.colors, ['F2EEE6', '3A2A20']);
});

test('parseFormCode rejects unknown plans, features, params and missing required features', () => {
  assert.throws(() => parseFormCode('Z|bd:L1'), /unknown body plan/);
  assert.throws(() => parseFormCode('Q|bd:L1|lg:L1|hd:L1|zz:L1'), /unknown form feature/);
  assert.throws(() => parseFormCode('Q|bd:Q1|lg:L1|hd:L1'), /no param "Q"/);
  assert.throws(() => parseFormCode('Q|bd:L1x|lg:L1|hd:L1'), /malformed/);
  assert.throws(() => parseFormCode('Q|bd:L1|hd:L1'), /requires feature "lg"/);
  assert.throws(() => parseFormCode('Q|bd:L1|bd:L2|lg:L1|hd:L1'), /appears twice/);
  assert.throws(() => parseFormCode('Q|bd|lg|hd|pt:plaid'), /does not understand/);
  assert.equal(isValidFormCode('Q|bd|lg|hd'), true);
  assert.equal(isValidFormCode(''), false);
});

test('resolveForm fills defaults, scales lengths, keeps counts and is seed-deterministic', () => {
  const code = 'Q|bd:L14~3|lg|hd|hn:2L3';
  const a = resolveForm(code, { seed: 42, scale: 2 });
  const b = resolveForm(code, { seed: 42, scale: 2 });
  const c = resolveForm(code, { seed: 43, scale: 2 });
  assert.deepEqual(a, b);
  assert.notEqual(a.features.bd.params.L, c.features.bd.params.L);
  assert.ok(a.features.bd.params.L >= 22 && a.features.bd.params.L <= 34);
  assert.equal(a.features.lg.params.L, 14, 'default leg length 7 doubled');
  assert.equal(a.features.hn.params.n, 2, 'counts are not scaled');
});

test('formDimensions grows with scale and every registered entity resolves', () => {
  for (const def of content.entities.all()) {
    const small = formDimensions(resolveForm(def.form, { seed: 1, scale: 0.8 }));
    const large = formDimensions(resolveForm(def.form, { seed: 1, scale: 1.2 }));
    assert.ok(large.height > small.height, def.id);
    assert.ok(small.width >= 0.3 && large.width <= 0.95, def.id);
    assert.ok(small.eyeHeight <= small.height, def.id);
  }
});

test('content rejects entities with bad form codes or missing loot tables', () => {
  assert.throws(() => createContent({ entities: [{ id: 'blob', name: 'Blob', form: 'Q|bd' }] }), /invalid form code/);
  assert.throws(
    () => createContent({ entities: [{ id: 'blob', name: 'Blob', form: 'Q|bd|lg|hd', harvest: 'nope' }] }),
    /unknown loot table/,
  );
  assert.throws(() => createContent({ spawnRules: [{ id: 'x', entity: 'ghost' }] }), /unknown entity/);
  assert.throws(() => createContent({ spawnRules: [{ id: 'x', entity: 'cow', biomes: ['moon'] }] }), /unknown biome/);
});

// ------------------------------------------------------------------ hitbox

test('entity boxes support ray picking and reach distance', () => {
  const entity = { position: { x: 0, y: 10, z: -5 }, dims: { width: 0.6, height: 1.2, length: 1.4 } };
  const box = entityBox(entity);
  assert.equal(box.max.y, 11.2);
  const hit = rayBoxDistance({ x: 0, y: 10.5, z: 0 }, { x: 0, y: 0, z: -1 }, box, 10);
  assert.ok(Math.abs(hit - 4.3) < 1e-9);
  assert.equal(rayBoxDistance({ x: 0, y: 10.5, z: 0 }, { x: 0, y: 0, z: 1 }, box, 10), null);
  assert.equal(distanceToBox({ x: 0, y: 10.5, z: -5 }, box), 0);
  const far = { position: { x: 0, y: 10, z: -9 }, dims: entity.dims };
  assert.equal(pickEntity({ x: 0, y: 10.5, z: 0 }, { x: 0, y: 0, z: -1 }, [far, entity], 10).entity, entity);
});

// ---------------------------------------------------------- entity manager

test('EntityManager spawns individuals with rolled size and form-derived dims', () => {
  const bus = new EventBus();
  const spawned = [];
  bus.on(EVENTS.ENTITY_SPAWNED, (e) => spawned.push(e));
  const manager = new EntityManager({ content, world: flatWorld(bus), bus, seed: 'm' });
  const cow = manager.spawn('cow', { x: 0.5, y: 10, z: 0.5 });
  assert.equal(cow.state, 'alive');
  assert.ok(cow.scale >= 0.9 && cow.scale <= 1.1);
  assert.ok(cow.dims.height > 0.8);
  assert.equal(spawned.length, 1);
  assert.equal(manager.near({ x: 0, z: 0 }, 2).length, 1);
  assert.equal(manager.near({ x: 50, z: 0 }, 2).length, 0);
  assert.equal(manager.toNetworkState(cow).def, 'cow');
});

test('grazers wander inside their territory and stay on the ground', () => {
  const manager = new EntityManager({ content, world: flatWorld(), seed: 'walk' });
  const cow = manager.spawn('cow', { x: 0.5, y: 10, z: 0.5 });
  let now = 0;
  let moved = false;
  for (let i = 0; i < 600; i++) {
    now += 100;
    manager.tick(0.1, { now });
    if (Math.hypot(cow.position.x - 0.5, cow.position.z - 0.5) > 0.5) moved = true;
  }
  assert.ok(moved, 'cow should have wandered');
  assert.ok(Math.hypot(cow.position.x - cow.home.x, cow.position.z - cow.home.z) <= cow.def.traits.territory + 2);
  assert.ok(Math.abs(cow.position.y - 10) < 0.05, `cow at y=${cow.position.y}`);
});

test('grazerBrain flees away from a threat and calms down afterwards', () => {
  const def = content.entities.get('deer');
  const entity = { def, position: { x: 0, y: 10, z: 0 }, home: { x: 0, z: 0 }, threat: { x: 3, z: 0, until: 1000 }, intent: null };
  grazerBrain(entity, { now: 0, rng: new Random(1) });
  assert.equal(entity.intent.mode, 'flee');
  assert.ok(entity.intent.target.x < 0, 'runs directly away');
  assert.ok(entity.intent.speed > def.stats.speed);
  grazerBrain(entity, { now: 2000, rng: new Random(1) });
  assert.equal(entity.threat, null);
  assert.notEqual(entity.intent.mode, 'flee');
});

test('damage kills into a corpse, which rots after its timer', () => {
  const bus = new EventBus();
  const died = [];
  bus.on(EVENTS.ENTITY_DIED, (e) => died.push(e));
  const manager = new EntityManager({ content, world: flatWorld(bus), bus, seed: 'kill' });
  const sheep = manager.spawn('sheep', { x: 0.5, y: 10, z: 0.5 }, { now: 0 });
  const first = manager.damage(sheep.id, 1, { from: { x: 2, z: 0 }, now: 0 });
  assert.equal(first.killed, false);
  assert.ok(sheep.threat, 'being hit makes it flee');
  let result;
  for (let i = 0; i < 20 && sheep.state === 'alive'; i++) result = manager.damage(sheep.id, 1, { now: 0 });
  assert.equal(result.killed, true);
  assert.equal(sheep.state, 'corpse');
  assert.equal(died.length, 1);
  assert.equal(manager.damage(sheep.id, 1).reason, 'already dead');

  manager.tick(0.1, { now: 1000 });
  assert.ok(manager.get(sheep.id), 'corpse lingers');
  const { removed } = manager.tick(0.1, { now: sheep.def.corpse * 1000 + 1 });
  assert.deepEqual(removed, [sheep.id]);
});

test('entities far from every player despawn', () => {
  const manager = new EntityManager({ content, world: flatWorld(), seed: 'far' });
  const near = manager.spawn('cow', { x: 0.5, y: 10, z: 0.5 });
  const far = manager.spawn('cow', { x: 30.5, y: 10, z: 0.5 });
  manager.tick(0.1, { now: 1, keepNear: [{ x: 0, z: 0 }], despawnRadius: 20 });
  assert.ok(manager.get(near.id));
  assert.equal(manager.get(far.id), null);
});

test('butchering a corpse removes it and needs a knife and skill for full yield', () => {
  const manager = new EntityManager({ content, world: flatWorld(), seed: 'butcher' });
  const kill = () => {
    const cow = manager.spawn('cow', { x: 0.5, y: 10, z: 0.5 });
    manager.damage(cow.id, 1000, { now: 0 });
    return cow;
  };
  const live = manager.spawn('cow', { x: 0.5, y: 10, z: 0.5 });
  assert.equal(manager.butcher(live.id, {}).reason, 'not a corpse');

  const skilled = kill();
  const result = manager.butcher(skilled.id, { toolClass: 'knife', toolTier: 1, knowledge: ['butchery'] }, { now: 0 });
  assert.equal(result.ok, true);
  const items = Object.fromEntries(result.drops.map((d) => [d.item, d.count]));
  assert.ok(items.raw_beef >= 2);
  assert.equal(items.hide, 1);
  assert.ok(items.bone >= 1);
  assert.equal(manager.get(skilled.id), null);

  let ruined = 0;
  let real = 0;
  for (let i = 0; i < 200; i++) {
    const cow = kill();
    const drops = manager.butcher(cow.id, {}, { now: i * 1000 }).drops;
    for (const d of drops) {
      if (d.item === 'mangled_meat' || d.item === 'tattered_hide') ruined++;
      if (d.item === 'raw_beef' || d.item === 'hide') real++;
      assert.ok(d.item !== 'raw_beef' || d.count <= 3);
    }
    assert.ok(drops.some((d) => d.item === 'bone'), 'bones need no tool');
  }
  assert.ok(ruined > 100, `bare-handed butchering mostly ruins meat (${ruined})`);
  assert.ok(real > 0 && real < 60, `a little real meat still comes through (${real})`);
});

// ------------------------------------------------------------- loot rules

test('gated loot entries fall back to rare real drops or ruined items', () => {
  const table = {
    id: 't',
    mode: 'all',
    entries: [lootEntry({ item: 'hide', requires: { toolClass: 'knife' }, unskilled: 0.1, ruined: 'tattered_hide', ruinedChance: 0.5 })],
  };
  const rng = new Random(9);
  const counts = { hide: 0, tattered_hide: 0, none: 0 };
  for (let i = 0; i < 4000; i++) {
    const drops = rollLootTable(table, rng, {});
    if (drops.length === 0) counts.none++;
    else counts[drops[0].item]++;
  }
  assert.ok(counts.hide > 300 && counts.hide < 500, `real ~10%: ${counts.hide}`);
  assert.ok(counts.tattered_hide > 1800 && counts.tattered_hide < 2200, `ruined ~50%: ${counts.tattered_hide}`);
  assert.deepEqual(rollLootTable(table, rng, { toolClass: 'knife' }), [{ item: 'hide', count: 1 }]);

  const strict = { id: 's', mode: 'all', entries: [lootEntry({ item: 'hide', requires: { toolClass: 'knife' }, unskilled: 0 })] };
  for (let i = 0; i < 200; i++) assert.deepEqual(rollLootTable(strict, rng, {}), []);
});

// ----------------------------------------------------------------- spawner

test('spawner places groups from matching rules and respects the local cap', () => {
  const world = flatWorld();
  const manager = new EntityManager({ content, world, seed: 'spawn' });
  const spawner = new Spawner({ content, world, entities: manager, seed: 's', options: { cap: 5, radius: 24, minDistance: 8, intervalMs: 0 } });
  const rules = spawner.rulesAt(4, 4);
  assert.ok(rules.every((r) => r.surface.includes('grass')));

  const forced = spawner.spawnGroup(content.spawnRules.get('meadow_sheep'), 4, 4, 0);
  assert.ok(forced.length >= 3 && forced.length <= 5);
  for (const sheep of forced) assert.ok(Math.abs(sheep.position.y - 10) < 1e-9);

  let now = 0;
  for (let i = 0; i < 50; i++) spawner.tick([{ x: 0, z: 0 }], (now += 1000));
  assert.ok(manager.aliveNear({ x: 0, z: 0 }, 24).length <= 5 + 5, 'cap stops spawning once reached');
});

test('spawner skips columns with no matching biome or surface', () => {
  const world = flatWorld();
  const manager = new EntityManager({ content, world, seed: 'none' });
  const rockOnly = createContent({});
  const spawner = new Spawner({ content: rockOnly, world, entities: manager });
  world.setBlock(4, 9, 4, BLOCK_IDS.STONE);
  assert.deepEqual(spawner.rulesAt(4, 4), []);
});
