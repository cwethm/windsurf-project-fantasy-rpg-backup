import test from 'node:test';
import assert from 'node:assert/strict';

import { createContent, BLOCK_IDS } from '../src/content/index.js';
import { EventBus, EVENTS } from '../src/core/event-bus.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from '../src/core/constants.js';
import {
  blockToChunk,
  blockToLocal,
  chunkToRegion,
  chunkKey,
  parseChunkKey,
  blockIndex,
  chunksInRadius,
  chunkDistance,
  isValidY,
} from '../src/world/coords.js';
import { Noise } from '../src/world/noise.js';
import { Chunk } from '../src/world/chunk.js';
import { WorldGenerator } from '../src/world/generator.js';
import { World } from '../src/world/world.js';
import { raycast, directionFromAngles } from '../src/world/raycast.js';
import { collides, stepPhysics, resolveSpawnY, validateMove } from '../src/world/physics.js';

const content = createContent();

function makeWorld(seed = 'test-seed', bus = new EventBus()) {
  const generator = new WorldGenerator({ seed, content });
  return new World({ generator, content, bus });
}

test('coordinate helpers floor correctly across zero', () => {
  assert.equal(blockToChunk(0), 0);
  assert.equal(blockToChunk(15), 0);
  assert.equal(blockToChunk(16), 1);
  assert.equal(blockToChunk(-1), -1);
  assert.equal(blockToChunk(-16), -1);
  assert.equal(blockToChunk(-17), -2);

  assert.equal(blockToLocal(0), 0);
  assert.equal(blockToLocal(-1), 15);
  assert.equal(blockToLocal(-16), 0);
  assert.equal(blockToLocal(17), 1);

  assert.equal(chunkToRegion(-1), -1);
  assert.equal(chunkToRegion(16), 1);

  assert.deepEqual(parseChunkKey(chunkKey(-3, 7)), { chunkX: -3, chunkZ: 7 });
  assert.equal(isValidY(-1), false);
  assert.equal(isValidY(CHUNK_HEIGHT), false);
  assert.equal(isValidY(0), true);
});

test('block indexing is unique across the chunk volume', () => {
  const seen = new Set();
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const index = blockIndex(x, y, z);
        assert.ok(!seen.has(index), `duplicate index at ${x},${y},${z}`);
        seen.add(index);
      }
    }
  }
  assert.equal(seen.size, CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
});

test('chunksInRadius covers the square and is ordered nearest first', () => {
  const chunks = chunksInRadius(2, -2, 2);
  assert.equal(chunks.length, 25);
  assert.deepEqual(chunks[0], { chunkX: 2, chunkZ: -2 });
  let previous = -1;
  for (const c of chunks) {
    const d = chunkDistance(c.chunkX, c.chunkZ, 2, -2);
    assert.ok(d >= previous, 'chunk list must be sorted by distance');
    previous = d;
  }
});

test('noise is deterministic per seed and varies across seeds', () => {
  const a = new Noise(1234);
  const b = new Noise(1234);
  const c = new Noise(4321);
  assert.equal(a.noise2D(1.5, -2.25), b.noise2D(1.5, -2.25));
  assert.notEqual(a.noise2D(1.5, -2.25), c.noise2D(1.5, -2.25));
  assert.equal(a.noise3D(0.5, 1.5, 2.5), b.noise3D(0.5, 1.5, 2.5));

  for (let i = 0; i < 200; i++) {
    const v = a.fbm2D(i * 0.31, i * 0.17, { octaves: 4 });
    assert.ok(v >= -1.001 && v <= 1.001, `fbm out of range: ${v}`);
    const r = a.ridged2D(i * 0.31, i * 0.17, { octaves: 4 });
    assert.ok(r >= -0.001 && r <= 1.001, `ridged out of range: ${r}`);
  }
});

test('chunk get/set respects bounds and tracks revisions', () => {
  const chunk = new Chunk(0, 0);
  assert.equal(chunk.get(0, 0, 0), 0);
  assert.equal(chunk.set(0, 5, 0, BLOCK_IDS.STONE), true);
  assert.equal(chunk.get(0, 5, 0), BLOCK_IDS.STONE);
  assert.equal(chunk.revision, 1);
  assert.equal(chunk.set(0, 5, 0, BLOCK_IDS.STONE), false, 'no-op writes must not bump revision');
  assert.equal(chunk.revision, 1);

  assert.equal(chunk.set(-1, 5, 0, BLOCK_IDS.STONE), false);
  assert.equal(chunk.set(0, CHUNK_HEIGHT, 0, BLOCK_IDS.STONE), false);
  assert.equal(chunk.get(99, 5, 0), 0);
  assert.equal(chunk.heightAt(0, 0), 5);
  assert.equal(chunk.heightAt(1, 1), -1);
});

test('chunk survives a JSON round trip', () => {
  const chunk = new Chunk(3, -4);
  chunk.set(1, 2, 3, BLOCK_IDS.LOG);
  chunk.setTileEntity(1, 2, 3, { kind: 'container', slots: [] });
  const restored = Chunk.fromJSON(JSON.parse(JSON.stringify(chunk.toJSON())));
  assert.equal(restored.chunkX, 3);
  assert.equal(restored.chunkZ, -4);
  assert.equal(restored.get(1, 2, 3), BLOCK_IDS.LOG);
  assert.deepEqual(restored.getTileEntity(1, 2, 3), { kind: 'container', slots: [] });
});

test('same seed produces an identical world, different seeds do not', () => {
  const a = new WorldGenerator({ seed: 'alpha', content });
  const b = new WorldGenerator({ seed: 'alpha', content });
  const c = new WorldGenerator({ seed: 'beta', content });

  for (const [cx, cz] of [[0, 0], [5, -3], [-12, 41]]) {
    const chunkA = a.generateChunk(cx, cz);
    const chunkB = b.generateChunk(cx, cz);
    assert.deepEqual(Array.from(chunkA.blocks), Array.from(chunkB.blocks), `chunk ${cx},${cz} differs`);
  }

  const chunkA = a.generateChunk(0, 0);
  const chunkC = c.generateChunk(0, 0);
  assert.notDeepEqual(Array.from(chunkA.blocks), Array.from(chunkC.blocks));
});

test('generation is order independent', () => {
  const gen = new WorldGenerator({ seed: 'order', content });
  const direct = gen.generateChunk(4, 4);
  const afterNeighbours = new WorldGenerator({ seed: 'order', content });
  afterNeighbours.generateChunk(3, 3);
  afterNeighbours.generateChunk(5, 5);
  afterNeighbours.generateChunk(-100, 100);
  const later = afterNeighbours.generateChunk(4, 4);
  assert.deepEqual(Array.from(direct.blocks), Array.from(later.blocks));
});

test('generated terrain is plausible: solid ground, air above, water at sea level', () => {
  const gen = new WorldGenerator({ seed: 'terrain', content });
  const chunk = gen.generateChunk(0, 0);
  for (let lx = 0; lx < CHUNK_SIZE; lx += 4) {
    for (let lz = 0; lz < CHUNK_SIZE; lz += 4) {
      const top = chunk.heightAt(lx, lz);
      assert.ok(top >= 0, 'every column must have something in it');
      assert.equal(chunk.get(lx, 0, lz), BLOCK_IDS.STONE, 'bedrock layer must be solid');
      assert.equal(chunk.get(lx, CHUNK_HEIGHT - 1, lz), BLOCK_IDS.AIR);
      const height = gen.heightAt(lx, lz);
      if (height < SEA_LEVEL) {
        assert.equal(chunk.get(lx, SEA_LEVEL, lz), BLOCK_IDS.WATER, 'below sea level must flood');
      }
    }
  }
});

test('generator exposes deterministic height, biome and spawn helpers', () => {
  const gen = new WorldGenerator({ seed: 'helpers', content });
  assert.equal(gen.heightAt(10, 10), gen.heightAt(10, 10));
  const biome = gen.biomeAt(10, 10);
  assert.ok(biome && typeof biome.id === 'string');
  assert.ok(gen.spawnHeightAt(10, 10) > SEA_LEVEL);
  const climate = gen.climateAt(10, 10);
  assert.ok(climate.temperature >= 0 && climate.temperature <= 1);
  assert.ok(climate.moisture >= 0 && climate.moisture <= 1);
});

test('custom generation layers can be appended', () => {
  const gen = new WorldGenerator({ seed: 'layers', content });
  gen.addLayer({
    name: 'marker',
    generate(chunk, ctx) {
      chunk.set(0, CHUNK_HEIGHT - 2, 0, ctx.ids.glass);
    },
  });
  const chunk = gen.generateChunk(0, 0);
  assert.equal(chunk.get(0, CHUNK_HEIGHT - 2, 0), BLOCK_IDS.GLASS);
  assert.throws(() => gen.addLayer({ name: 'broken' }), /generate\(chunk, ctx\)/);
});

test('world edits persist through unload as diffs, not whole chunks', () => {
  const world = makeWorld('diffs');
  const y = world.heightAt(3, 3) + 1;
  assert.equal(world.setBlock(3, y, 3, BLOCK_IDS.PLANKS, { source: 'place' }), true);
  assert.equal(world.getBlock(3, y, 3), BLOCK_IDS.PLANKS);

  world.unloadChunk(0, 0);
  assert.equal(world.isLoaded(0, 0), false);
  assert.equal(world.getBlock(3, y, 3), BLOCK_IDS.PLANKS, 'diff must be replayed on reload');

  const state = world.exportState();
  assert.equal(state.chunks.length, 1);
  assert.equal(Object.keys(state.chunks[0].blocks).length, 1);
});

test('world state round trips into a fresh world', () => {
  const source = makeWorld('roundtrip');
  const y = source.heightAt(20, -20) + 1;
  source.setBlock(20, y, -20, BLOCK_IDS.CHEST, { source: 'place' });
  source.setTileEntity(20, y, -20, { kind: 'container', slots: [{ item: 'bread', count: 2 }] });
  source.scheduleRegrowth(1, 40, 1, BLOCK_IDS.FLOWERS, 12345);

  const state = JSON.parse(JSON.stringify(source.exportState()));
  const restored = makeWorld('roundtrip');
  restored.importState(state);

  assert.equal(restored.getBlock(20, y, -20), BLOCK_IDS.CHEST);
  assert.deepEqual(restored.getTileEntity(20, y, -20).slots, [{ item: 'bread', count: 2 }]);
  assert.equal(restored.regrowthQueue.length, 1);
});

test('world emits events for every mutation', () => {
  const bus = new EventBus();
  const world = makeWorld('events', bus);
  const changes = [];
  const tiles = [];
  bus.on(EVENTS.BLOCK_CHANGED, (e) => changes.push(e));
  bus.on(EVENTS.TILE_ENTITY_CHANGED, (e) => tiles.push(e));

  const y = world.heightAt(0, 0) + 1;
  world.setBlock(0, y, 0, BLOCK_IDS.TORCH, { source: 'place', actorId: 'p1' });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].block, BLOCK_IDS.TORCH);
  assert.equal(changes[0].previous, BLOCK_IDS.AIR);
  assert.equal(changes[0].actorId, 'p1');

  world.setTileEntity(0, y, 0, { kind: 'toggle', on: true });
  assert.equal(tiles.length, 1);
  assert.equal(tiles[0].data.on, true);

  // Replacing a tile-entity block clears its state automatically.
  world.setBlock(0, y, 0, BLOCK_IDS.AIR, { source: 'harvest' });
  assert.equal(world.getTileEntity(0, y, 0), null);
});

test('world rejects unknown block ids and out-of-range Y', () => {
  const world = makeWorld('validate');
  assert.throws(() => world.setBlock(0, 40, 0, 9999), /unknown block id/);
  assert.equal(world.setBlock(0, -1, 0, BLOCK_IDS.STONE), false);
  assert.equal(world.setBlock(0, CHUNK_HEIGHT, 0, BLOCK_IDS.STONE), false);
  assert.equal(world.getBlock(0, -5, 0), BLOCK_IDS.AIR);
});

test('regrowth restores harvested nodes only into empty space', () => {
  const world = makeWorld('regrow');
  const y = world.heightAt(8, 8) + 1;
  world.scheduleRegrowth(8, y, 8, BLOCK_IDS.FLOWERS, 1000);

  assert.equal(world.tick(999), 0, 'nothing is due yet');
  assert.equal(world.tick(1001), 1);
  assert.equal(world.getBlock(8, y, 8), BLOCK_IDS.FLOWERS);
  assert.equal(world.regrowthQueue.length, 0);

  world.setBlock(9, y, 9, BLOCK_IDS.PLANKS, { source: 'place' });
  world.scheduleRegrowth(9, y, 9, BLOCK_IDS.FLOWERS, 1000);
  assert.equal(world.tick(2000), 0, 'occupied space must not be overwritten');
  assert.equal(world.getBlock(9, y, 9), BLOCK_IDS.PLANKS);
});

test('unloadChunksExcept keeps only the requested chunks', () => {
  const world = makeWorld('unload');
  world.getChunk(0, 0);
  world.getChunk(1, 0);
  world.getChunk(2, 0);
  const unloaded = world.unloadChunksExcept(new Set([chunkKey(1, 0)]));
  assert.equal(unloaded, 2);
  assert.equal(world.isLoaded(1, 0), true);
  assert.equal(world.isLoaded(0, 0), false);
});

test('raycast finds the first solid block and the adjacent placement cell', () => {
  const solid = new Set(['5,10,0']);
  const getBlock = (x, y, z) => (solid.has(`${x},${y},${z}`) ? BLOCK_IDS.STONE : BLOCK_IDS.AIR);

  const hit = raycast({
    origin: { x: 0.5, y: 10.5, z: 0.5 },
    direction: { x: 1, y: 0, z: 0 },
    maxDistance: 10,
    getBlock,
  });
  assert.ok(hit);
  assert.deepEqual([hit.x, hit.y, hit.z], [5, 10, 0]);
  assert.deepEqual(hit.normal, { x: -1, y: 0, z: 0 });
  assert.deepEqual(hit.adjacent, { x: 4, y: 10, z: 0 });
  assert.ok(Math.abs(hit.distance - 4.5) < 1e-6);
});

test('raycast respects max distance and degenerate input', () => {
  const getBlock = (x) => (x === 5 ? BLOCK_IDS.STONE : BLOCK_IDS.AIR);
  const near = raycast({
    origin: { x: 0.5, y: 10.5, z: 0.5 },
    direction: { x: 1, y: 0, z: 0 },
    maxDistance: 3,
    getBlock,
  });
  assert.equal(near, null);
  assert.equal(
    raycast({ origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 0 }, getBlock }),
    null,
  );
});

test('raycast can filter what counts as a hit', () => {
  const getBlock = (x, y, z) => (z === -3 ? BLOCK_IDS.TALL_GRASS : BLOCK_IDS.AIR);
  const origin = { x: 0.5, y: 10.5, z: 0.5 };
  const direction = directionFromAngles(0, 0);

  const anything = raycast({ origin, direction, maxDistance: 8, getBlock });
  assert.equal(anything.block, BLOCK_IDS.TALL_GRASS);

  const solidOnly = raycast({
    origin,
    direction,
    maxDistance: 8,
    getBlock,
    isHit: (id) => content.isSolid(id),
  });
  assert.equal(solidOnly, null, 'non-solid blocks are skipped when filtered out');
});

test('directionFromAngles matches the Three.js camera convention', () => {
  const forward = directionFromAngles(0, 0);
  assert.ok(Math.abs(forward.x) < 1e-9);
  assert.ok(Math.abs(forward.z + 1) < 1e-9);

  const up = directionFromAngles(0, Math.PI / 2);
  assert.ok(Math.abs(up.y - 1) < 1e-9);

  const left = directionFromAngles(Math.PI / 2, 0);
  assert.ok(Math.abs(left.x + 1) < 1e-9);
});

test('raycast against the real world hits terrain', () => {
  const world = makeWorld('raycast-world');
  const top = world.heightAt(0, 0);
  const hit = raycast({
    origin: { x: 0.5, y: top + 5, z: 0.5 },
    direction: { x: 0, y: -1, z: 0 },
    maxDistance: 10,
    getBlock: (x, y, z) => world.getBlock(x, y, z),
    isHit: (id) => content.isSolid(id),
  });
  assert.ok(hit, 'a downward ray must hit the ground');
  assert.equal(content.isSolid(hit.block), true);
  // `heightAt` counts non-solid decoration such as tall grass, so the solid
  // surface sits at or below it.
  assert.ok(hit.y <= top && hit.y >= top - 1, `hit ${hit.y} vs column top ${top}`);
  assert.deepEqual(hit.normal, { x: 0, y: 1, z: 0 });
});

test('collision detects overlap with the player box', () => {
  const isSolid = (x, y, z) => y < 10;
  assert.equal(collides(isSolid, 0.5, 10, 0.5), false);
  assert.equal(collides(isSolid, 0.5, 9.5, 0.5), true);
  assert.equal(collides(() => false, 0.5, -1, 0.5), true, 'below the world is solid');
});

test('physics applies gravity, lands on ground and slides along walls', () => {
  const isSolid = (x, y) => y < 10;
  let state = { position: { x: 0.5, y: 14, z: 0.5 }, velocity: { x: 0, y: 0, z: 0 }, onGround: false };
  for (let i = 0; i < 200; i++) {
    state = stepPhysics(state, { dt: 1 / 60, isSolid });
    if (state.onGround) break;
  }
  assert.equal(state.onGround, true);
  assert.ok(state.position.y >= 10 && state.position.y < 10.01, `landed at ${state.position.y}`);
  assert.equal(state.velocity.y, 0);

  const wall = (x, y) => y < 10 || x >= 2;
  const sliding = stepPhysics(
    { position: { x: 1.6, y: 10, z: 0.5 }, velocity: { x: 30, z: 5, y: 0 }, onGround: true },
    { dt: 1 / 60, isSolid: wall },
  );
  assert.equal(sliding.velocity.x, 0, 'blocked axis stops');
  assert.equal(sliding.position.x, 1.6, 'blocked axis does not advance');
  assert.ok(sliding.position.z > 0.5, 'free axis keeps moving');
});

test('resolveSpawnY finds the first free slot above terrain', () => {
  const isSolid = (x, y) => y < 12;
  assert.equal(resolveSpawnY(isSolid, 0.5, 0.5, 1), 12);
});

test('move validation rejects speed hacks, teleports and clipping', () => {
  const isSolid = (x, y) => y < 10;
  const previous = { x: 0, y: 10, z: 0 };

  assert.equal(validateMove(previous, { x: 0.1, y: 10, z: 0.1 }, 0.05, 7, isSolid).ok, true);

  const fast = validateMove(previous, { x: 50, y: 10, z: 0 }, 0.05, 7, isSolid);
  assert.equal(fast.ok, false);
  assert.match(fast.reason, /too fast/);

  const climb = validateMove(previous, { x: 0, y: 40, z: 0 }, 0.05, 7, isSolid);
  assert.equal(climb.ok, false);
  assert.match(climb.reason, /climbed too fast/);

  const clip = validateMove(previous, { x: 0.1, y: 5, z: 0.1 }, 10, 7, isSolid);
  assert.equal(clip.ok, false);

  const nan = validateMove(previous, { x: Number.NaN, y: 10, z: 0 }, 1, 7, isSolid);
  assert.equal(nan.ok, false);
  assert.match(nan.reason, /non-finite/);

  const oob = validateMove(previous, { x: 0, y: CHUNK_HEIGHT + 5, z: 0 }, 100, 7, isSolid);
  assert.equal(oob.ok, false);
  assert.match(oob.reason, /bounds/);

  // Falling fast is legitimate.
  assert.equal(validateMove({ x: 0, y: 40, z: 0 }, { x: 0, y: 12, z: 0 }, 0.5, 7, isSolid).ok, true);
});
