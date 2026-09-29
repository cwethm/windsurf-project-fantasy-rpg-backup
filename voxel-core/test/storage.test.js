import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MemoryStore,
  JsonFileStore,
  GameStore,
  migrate,
  emptySnapshot,
  loadSnapshot,
  CURRENT_SCHEMA_VERSION,
  Store,
} from '../src/storage/index.js';
import { createContent, BLOCK_IDS } from '../src/content/index.js';
import { WorldGenerator } from '../src/world/generator.js';
import { World } from '../src/world/world.js';

const content = createContent();

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'voxel-core-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('migrate upgrades legacy snapshots and fills defaults', () => {
  const { data, applied } = migrate({});
  assert.equal(data.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(data.accounts, {});
  assert.deepEqual(data.players, {});
  assert.deepEqual(data.world, { chunks: [], regrowth: [] });
  assert.deepEqual(data.groundItems, []);
  assert.ok(applied.length >= 1);
});

test('migrate is a no-op on a current snapshot', () => {
  const snapshot = emptySnapshot('seed');
  const { data, applied } = migrate(snapshot);
  assert.equal(applied.length, 0);
  assert.equal(data.meta.seed, 'seed');
});

test('migrate refuses to downgrade a newer save', () => {
  assert.throws(
    () => migrate({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    /newer build/,
  );
});

test('Store base class rejects unimplemented backends', async () => {
  const store = new Store();
  await assert.rejects(() => store.load(), /must be implemented/);
  await assert.rejects(() => store.save({}), /must be implemented/);
  await store.close();
});

test('MemoryStore isolates snapshots by cloning', async () => {
  const store = new MemoryStore();
  assert.equal(await store.load(), null);
  const snapshot = emptySnapshot('s');
  await store.save(snapshot);
  const loaded = await store.load();
  loaded.accounts.tampered = true;
  assert.equal(store.snapshot.accounts.tampered, undefined);
  assert.equal(store.saveCount, 1);
});

test('loadSnapshot creates an empty world when the store is empty', async () => {
  const { snapshot, created } = await loadSnapshot(new MemoryStore(), 'fresh');
  assert.equal(created, true);
  assert.equal(snapshot.schemaVersion, CURRENT_SCHEMA_VERSION);
});

test('JsonFileStore writes atomically and keeps a backup', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'nested', 'world.json');
    const store = new JsonFileStore(file, { pretty: true });
    assert.equal(await store.load(), null);

    await store.save(emptySnapshot('one'));
    const first = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(first.meta.seed, 'one');

    await store.save({ ...first, meta: { ...first.meta, seed: 'two' } });
    const second = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(second.meta.seed, 'two');
    const backup = JSON.parse(await readFile(`${file}.bak`, 'utf8'));
    assert.equal(backup.meta.seed, 'one', 'previous save is retained as .bak');

    await store.close();
  });
});

test('JsonFileStore falls back to the backup when the primary is corrupt', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'world.json');
    const store = new JsonFileStore(file);
    await store.save(emptySnapshot('good'));
    await store.save(emptySnapshot('newer'));

    await writeFile(file, '{ this is not json', 'utf8');
    const recovered = await store.load();
    assert.equal(recovered.meta.seed, 'good');

    await rm(`${file}.bak`);
    await assert.rejects(() => store.load(), /corrupt and no usable backup/);
  });
});

test('JsonFileStore serialises concurrent saves', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'world.json');
    const store = new JsonFileStore(file);
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => store.save({ ...emptySnapshot('s'), tick: i })),
    );
    const final = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(final.tick, 7);
    assert.equal(store.saveCount, 8);
    await store.close();
  });
});

test('GameStore stores accounts, players and world state', async () => {
  const store = new MemoryStore();
  const game = await new GameStore({ store, seed: 'persist', logger: silentLogger() }).init();

  assert.equal(game.getAccount('nobody'), null);
  game.putAccount({ username: 'Alice', passwordHash: 'x', salt: 'y' });
  assert.equal(game.getAccount('alice').username, 'Alice', 'lookup is case-insensitive');
  assert.equal(game.accountCount, 1);

  game.putPlayer({ id: 'p1', position: { x: 1, y: 2, z: 3 } });
  assert.deepEqual(game.getPlayer('p1').position, { x: 1, y: 2, z: 3 });
  assert.equal(game.allPlayers().length, 1);
  assert.equal(game.getPlayer('missing'), null);

  game.putWorldState({ chunks: [{ chunkX: 0, chunkZ: 0, blocks: {}, tileEntities: {} }], regrowth: [] });
  game.putGroundItems([{ id: 'g1', item: 'bread', count: 1 }]);

  assert.equal(await game.flush(), true);
  assert.equal(await game.flush(), false, 'a clean snapshot is not rewritten');
  assert.equal(await game.flush({ force: true }), true);

  const reloaded = await new GameStore({ store, seed: 'persist', logger: silentLogger() }).init();
  assert.equal(reloaded.getAccount('alice').username, 'Alice');
  assert.equal(reloaded.getWorldState().chunks.length, 1);
  assert.equal(reloaded.getGroundItems()[0].item, 'bread');
});

test('GameStore refuses to open a save made with a different seed', async () => {
  const store = new MemoryStore();
  await (await new GameStore({ store, seed: 'first', logger: silentLogger() }).init()).flush();
  await assert.rejects(
    () => new GameStore({ store, seed: 'second', logger: silentLogger() }).init(),
    /seed mismatch/,
  );
});

test('GameStore accessors require init()', () => {
  const game = new GameStore({ store: new MemoryStore(), logger: silentLogger() });
  assert.throws(() => game.getPlayer('x'), /init\(\) must be awaited/);
});

test('GameStore collect hook runs before every flush', async () => {
  const store = new MemoryStore();
  const game = await new GameStore({ store, seed: 's', logger: silentLogger() }).init();
  let collects = 0;
  game.onCollect(() => {
    collects += 1;
    game.putGroundItems([{ id: `g${collects}` }]);
  });
  await game.flush({ force: true });
  await game.flush({ force: true });
  assert.equal(collects, 2);
  assert.equal(store.snapshot.groundItems[0].id, 'g2');
});

test('autosave writes on an interval and shutdown writes once more', async () => {
  const store = new MemoryStore();
  const game = await new GameStore({
    store,
    seed: 's',
    autosaveIntervalMs: 10,
    logger: silentLogger(),
  }).init();

  game.putPlayer({ id: 'p1' });
  game.startAutosave();
  await new Promise((resolve) => setTimeout(resolve, 45));
  game.stopAutosave();
  const afterAutosave = store.saveCount;
  assert.ok(afterAutosave >= 1, `expected at least one autosave, got ${afterAutosave}`);

  await game.shutdown();
  assert.equal(store.saveCount, afterAutosave + 1, 'shutdown forces a final save');
});

test('world diffs survive a full save/load cycle', async () => {
  const store = new MemoryStore();
  const seed = 'round-trip';

  const first = await new GameStore({ store, seed, logger: silentLogger() }).init();
  const worldA = new World({ generator: new WorldGenerator({ seed, content }), content });
  worldA.importState(first.getWorldState());
  const y = worldA.heightAt(12, 12) + 1;
  worldA.setBlock(12, y, 12, BLOCK_IDS.CHEST, { source: 'place' });
  worldA.setTileEntity(12, y, 12, { kind: 'container', slots: [{ item: 'coal', count: 5 }] });
  first.onCollect(() => first.putWorldState(worldA.exportState()));
  await first.flush({ force: true });

  const second = await new GameStore({ store, seed, logger: silentLogger() }).init();
  const worldB = new World({ generator: new WorldGenerator({ seed, content }), content });
  worldB.importState(second.getWorldState());
  assert.equal(worldB.getBlock(12, y, 12), BLOCK_IDS.CHEST);
  assert.deepEqual(worldB.getTileEntity(12, y, 12).slots, [{ item: 'coal', count: 5 }]);

  // Only modified chunks are stored, not the whole world.
  assert.equal(second.getWorldState().chunks.length, 1);
});

function silentLogger() {
  return { info() {}, warn() {}, error() {} };
}
