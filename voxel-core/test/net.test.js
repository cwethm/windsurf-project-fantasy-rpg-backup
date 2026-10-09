import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

import { createContent, BLOCK_IDS } from '../src/content/index.js';
import { EventBus } from '../src/core/event-bus.js';
import { WorldGenerator } from '../src/world/generator.js';
import { World } from '../src/world/world.js';
import { Chunk, rleEncode, rleDecode } from '../src/world/chunk.js';
import { CHUNK_VOLUME } from '../src/core/constants.js';
import { entityBox } from '../src/entity/hitbox.js';
import {
  C2S,
  S2C,
  decode,
  encode,
  validate,
  isBlockPosition,
  isVector3,
  USERNAME_PATTERN,
  MAX_MESSAGE_BYTES,
} from '../src/net/protocol.js';
import { TokenBucket, RateLimiter } from '../src/net/rate-limiter.js';
import { chunkDelta, isInInterest } from '../src/net/interest.js';
import { MemoryStore } from '../src/storage/stores.js';
import { GameStore } from '../src/storage/game-store.js';
import { createAccount, verifyPassword, authenticate } from '../src/server/auth.js';
import { resolveWithinRoot } from '../src/server/static-server.js';
import { GameServer } from '../src/server/game-server.js';

const content = createContent();

// Keep authentication tests fast: the production default is intentionally slow.
const TEST_ITERATIONS = 1_000;

// ---------------------------------------------------------------- protocol

test('decode rejects malformed frames without throwing', () => {
  assert.equal(decode('not json').ok, false);
  assert.equal(decode('[1,2,3]').ok, false);
  assert.equal(decode('{"x":1}').reason, 'missing message type');
  assert.equal(decode('x'.repeat(MAX_MESSAGE_BYTES + 1)).reason, 'message too large');
  assert.equal(decode(encode(C2S.PING)).message.t, C2S.PING);
});

test('decode accepts binary frames', () => {
  const bytes = new TextEncoder().encode(encode(C2S.PING, { time: 5 }));
  const result = decode(bytes);
  assert.equal(result.ok, true);
  assert.equal(result.message.time, 5);
});

test('credentials are constrained', () => {
  assert.ok(USERNAME_PATTERN.test('player_1'));
  assert.ok(!USERNAME_PATTERN.test('ab'));
  assert.ok(!USERNAME_PATTERN.test('bad name'));

  assert.equal(validate({ t: C2S.LOGIN, username: 'ok_name', password: 'secret1' }).ok, true);
  assert.equal(validate({ t: C2S.LOGIN, username: 'ok_name', password: 'x' }).ok, false);
  assert.equal(validate({ t: C2S.LOGIN, username: '!!', password: 'secret1' }).ok, false);
});

test('position payloads are validated', () => {
  assert.ok(isVector3({ x: 1, y: 2, z: 3 }));
  assert.ok(!isVector3({ x: 1, y: NaN, z: 3 }));
  assert.ok(isBlockPosition({ x: 1, y: 2, z: 3 }));
  assert.ok(!isBlockPosition({ x: 1.5, y: 2, z: 3 }));
  assert.ok(!isBlockPosition({ x: 1, y: -1, z: 3 }));

  assert.equal(validate({ t: C2S.MOVE, position: { x: 0, y: 0, z: 0 } }).ok, true);
  assert.equal(validate({ t: C2S.MOVE, position: { x: 0, y: Infinity, z: 0 } }).ok, false);
  assert.equal(validate({ t: C2S.MOVE, position: { x: 0, y: 0, z: 0 }, pitch: 99 }).ok, false);
});

test('unknown message types are rejected', () => {
  assert.equal(validate({ t: 'drop_table_users' }).ok, false);
});

test('inventory and container payloads are validated', () => {
  assert.equal(validate({ t: C2S.MOVE_ITEM, from: 0, to: 1 }).ok, true);
  assert.equal(validate({ t: C2S.MOVE_ITEM, from: 0.5, to: 1 }).ok, false);
  assert.equal(validate({ t: C2S.TRANSFER_ITEM, slot: 0, direction: 'to_container' }).ok, true);
  assert.equal(validate({ t: C2S.TRANSFER_ITEM, slot: 0, direction: 'sideways' }).ok, false);
  assert.equal(validate({ t: C2S.PICKUP_ITEM, id: 'gi_1' }).ok, true);
  assert.equal(validate({ t: C2S.TRASH_ITEM, slot: 3 }).ok, true);
  assert.equal(validate({ t: C2S.TRASH_ITEM, slot: 'three' }).ok, false);
  assert.equal(validate({ t: C2S.LOCK_SLOT, slot: 3 }).ok, true);
  assert.equal(validate({ t: C2S.CHAT, text: '   ' }).ok, false);
  assert.equal(validate({ t: C2S.EQUIP, slot: 2 }).ok, true);
  assert.equal(validate({ t: C2S.EQUIP, slot: '2' }).ok, false);
  assert.equal(validate({ t: C2S.UNEQUIP, equipSlot: 'head', to: 4 }).ok, true);
  assert.equal(validate({ t: C2S.UNEQUIP, equipSlot: 'head' }).ok, true);
  assert.equal(validate({ t: C2S.UNEQUIP, equipSlot: '' }).ok, false);
  assert.equal(validate({ t: C2S.UNEQUIP, equipSlot: 'head', to: 1.5 }).ok, false);
  assert.equal(validate({ t: C2S.TRANSFER_ITEM, slot: 0, direction: 'to_player', to: 3 }).ok, true);
  assert.equal(validate({ t: C2S.TRANSFER_ITEM, slot: 0, direction: 'to_player', to: 'x' }).ok, false);
});

// ------------------------------------------------------------ rate limiter

test('token buckets refill over time', () => {
  const bucket = new TokenBucket({ capacity: 2, refillPerSecond: 1, now: 0 });
  assert.ok(bucket.take(1, 0));
  assert.ok(bucket.take(1, 0));
  assert.ok(!bucket.take(1, 0));
  assert.ok(bucket.take(1, 1_000));
});

test('rate limiter charges both the global and the per-action budget', () => {
  const limiter = new RateLimiter(
    {
      global: { capacity: 100, refillPerSecond: 0 },
      chat: { capacity: 2, refillPerSecond: 0 },
    },
    0,
  );
  assert.ok(limiter.check('chat', 0).ok);
  assert.ok(limiter.check('chat', 0).ok);
  const denied = limiter.check('chat', 0);
  assert.equal(denied.ok, false);
  assert.equal(denied.budget, 'chat');
  // Unbudgeted types still pass once the global bucket has room.
  assert.ok(limiter.check('ping', 0).ok);
});

// ------------------------------------------------------- interest handling

test('chunk delta adds what is near and removes only what is well past', () => {
  const loaded = new Set();
  const first = chunkDelta({ position: { x: 0, z: 0 }, loaded, viewDistance: 1 });
  assert.equal(first.add.length, 9);
  for (const entry of first.add) loaded.add(entry.key);

  const same = chunkDelta({ position: { x: 0, z: 0 }, loaded, viewDistance: 1 });
  assert.equal(same.add.length, 0);
  assert.equal(same.remove.length, 0);

  // One chunk of hysteresis: stepping one chunk over keeps the old ring.
  const nudged = chunkDelta({ position: { x: 16, z: 0 }, loaded, viewDistance: 1 });
  assert.equal(nudged.remove.length, 0);

  const far = chunkDelta({ position: { x: 160, z: 0 }, loaded, viewDistance: 1 });
  assert.equal(far.remove.length, 9);
});

test('interest radius uses chunk distance', () => {
  assert.ok(isInInterest({ x: 30, z: 0 }, { x: 0, z: 0 }, 2));
  assert.ok(!isInInterest({ x: 300, z: 0 }, { x: 0, z: 0 }, 2));
});

// ------------------------------------------------------------ chunk on wire

test('run-length encoding round-trips a chunk', () => {
  const blocks = new Uint16Array(CHUNK_VOLUME);
  blocks.fill(3, 0, 100);
  blocks.fill(7, 100, 150);
  const pairs = rleEncode(blocks);
  assert.ok(pairs.length < 10);
  assert.deepEqual(rleDecode(pairs, CHUNK_VOLUME), blocks);
});

test('chunks survive the wire format including tile entities', () => {
  const chunk = new Chunk(2, -3);
  chunk.set(1, 2, 3, BLOCK_IDS.STONE);
  chunk.setTileEntity(1, 2, 3, { kind: 'toggle', on: true });

  const restored = Chunk.fromWire(JSON.parse(JSON.stringify(chunk.toWire())));
  assert.equal(restored.chunkX, 2);
  assert.equal(restored.get(1, 2, 3), BLOCK_IDS.STONE);
  assert.equal(restored.getTileEntity(1, 2, 3).on, true);
});

// -------------------------------------------------------------------- auth

test('passwords are salted, hashed and verified in constant time', async () => {
  const account = await createAccount('tester', 'correct horse', { iterations: TEST_ITERATIONS });
  assert.notEqual(account.hash, 'correct horse');
  assert.equal(account.salt.length, 32);
  assert.ok(await verifyPassword(account, 'correct horse'));
  assert.ok(!(await verifyPassword(account, 'Correct horse')));
  assert.ok(!(await verifyPassword({}, 'anything')));
});

test('two accounts with the same password get different hashes', async () => {
  const a = await createAccount('a', 'same-password', { iterations: TEST_ITERATIONS });
  const b = await createAccount('b', 'same-password', { iterations: TEST_ITERATIONS });
  assert.notEqual(a.hash, b.hash);
  assert.notEqual(a.salt, b.salt);
});

async function makeStore(seed = 'net-test') {
  const store = new GameStore({ store: new MemoryStore(), seed, autosaveIntervalMs: 0 });
  await store.init();
  return store;
}

test('authenticate registers on demand and refuses wrong passwords', async () => {
  const store = await makeStore();
  const denied = await authenticate({ store, username: 'nobody', password: 'secret1' });
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /invalid username or password/);

  const created = await authenticate({
    store,
    username: 'somebody',
    password: 'secret1',
    allowRegister: true,
    iterations: TEST_ITERATIONS,
  });
  assert.equal(created.ok, true);
  assert.equal(created.created, true);

  const again = await authenticate({ store, username: 'somebody', password: 'secret1' });
  assert.equal(again.ok, true);
  assert.equal(again.created, false);
  assert.equal(again.account.id, created.account.id);

  const wrong = await authenticate({ store, username: 'somebody', password: 'secret2' });
  assert.equal(wrong.ok, false);
});

test('account lookup is case-insensitive on the username key', async () => {
  const store = await makeStore();
  await authenticate({
    store,
    username: 'MixedCase',
    password: 'secret1',
    allowRegister: true,
    iterations: TEST_ITERATIONS,
  });
  assert.ok(store.getAccount('mixedcase'));
});

// ----------------------------------------------------------- static server

test('static paths cannot escape their root', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'voxel-static-'));
  await fs.writeFile(path.join(root, 'index.html'), '<html></html>');
  try {
    assert.ok(await resolveWithinRoot(root, '/index.html'));
    assert.equal(await resolveWithinRoot(root, '/../../etc/passwd'), null);
    assert.equal(await resolveWithinRoot(root, '/%2e%2e/%2e%2e/etc/passwd'), null);
    assert.equal(await resolveWithinRoot(root, '/missing.html'), null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('symlinks pointing outside the root are refused', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'voxel-static-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'voxel-outside-'));
  await fs.writeFile(path.join(outside, 'secret.txt'), 'top secret');
  await fs.symlink(path.join(outside, 'secret.txt'), path.join(root, 'link.txt'));
  try {
    assert.equal(await resolveWithinRoot(root, '/link.txt'), null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------- game server

/** A fake transport that records everything the server sends. */
function fakeTransport() {
  const sent = [];
  let closed = null;
  return {
    sent,
    get closed() {
      return closed;
    },
    transport: {
      send: (text) => sent.push(JSON.parse(text)),
      close: (code, reason) => {
        closed = { code, reason };
      },
      remoteAddress: '127.0.0.1',
    },
    /** Messages of a given type, newest last. */
    ofType(type) {
      return sent.filter((msg) => msg.t === type);
    },
    last(type) {
      return this.ofType(type).at(-1);
    },
  };
}

function flatWorld(bus) {
  const generator = new WorldGenerator({ seed: 'server-test', content });
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

async function makeServer(options = {}) {
  const bus = new EventBus();
  const store = await makeStore('server-test');
  const server = await GameServer.create({
    content,
    world: flatWorld(bus),
    store,
    bus,
    seed: 'server-test',
    logger: { info() {}, warn() {}, error() {} },
    options: { viewDistance: 1, tickIntervalMs: 0, ...options },
  });
  return { server, store, bus };
}

async function connectAndLogin(server, username = 'player_one') {
  const client = fakeTransport();
  const session = server.addSession(client.transport);
  await session.handleRaw(encode(C2S.REGISTER, { username, password: 'secret1' }));
  return { client, session };
}

test('a fresh connection is greeted with protocol details', async () => {
  const { server } = await makeServer();
  const client = fakeTransport();
  server.addSession(client.transport);
  const welcome = client.last(S2C.WELCOME);
  assert.equal(welcome.protocol, 1);
  assert.equal(welcome.seed, 'server-test');
  assert.equal(welcome.constants.CHUNK_SIZE, 16);
});

test('unauthenticated clients cannot act', async () => {
  const { server } = await makeServer();
  const client = fakeTransport();
  const session = server.addSession(client.transport);
  await session.handleRaw(encode(C2S.MOVE, { position: { x: 0, y: 20, z: 0 } }));
  assert.match(client.last(S2C.ERROR).reason, /not authenticated/);
  assert.equal(session.player, null);
});

test('registering joins the world and streams chunks', async () => {
  const { server } = await makeServer();
  const { client, session } = await connectAndLogin(server);

  assert.ok(session.authenticated);
  assert.equal(client.last(S2C.LOGIN_OK).username, 'player_one');
  assert.ok(client.ofType(S2C.CHUNK).length >= 9);
  assert.ok(client.last(S2C.SELF_STATE).inventory);
  assert.equal(client.last(S2C.SELF_STATE).stats.health > 0, true);
});

test('new players receive starting items', async () => {
  const { server } = await makeServer();
  const { session } = await connectAndLogin(server);
  assert.equal(session.player.inventory.countOf('wooden_pickaxe'), 1);
  assert.equal(session.player.inventory.countOf('bread'), 5);
});

test('logging in again restores the saved player', async () => {
  const { server } = await makeServer();
  const { session } = await connectAndLogin(server);
  session.player.inventory.add('coal', 12);
  session.player.position = { x: 4.5, y: 12, z: 4.5 };
  await server.removeSession(session);

  const second = fakeTransport();
  const resumed = server.addSession(second.transport);
  await resumed.handleRaw(encode(C2S.LOGIN, { username: 'player_one', password: 'secret1' }));
  assert.equal(resumed.player.inventory.countOf('coal'), 12);
  assert.deepEqual(resumed.player.position, { x: 4.5, y: 12, z: 4.5 });
});

test('a second login for the same account displaces the first', async () => {
  const { server } = await makeServer();
  const { client: firstClient, session: first } = await connectAndLogin(server);

  const second = fakeTransport();
  const other = server.addSession(second.transport);
  await other.handleRaw(encode(C2S.LOGIN, { username: 'player_one', password: 'secret1' }));

  assert.match(firstClient.last(S2C.ERROR).reason, /another location/);
  assert.equal(first.closed, true);
  assert.ok(other.authenticated);
  assert.equal(server.sessionsByPlayer.size, 1);
});

test('bad credentials never reveal which half was wrong', async () => {
  const { server } = await makeServer();
  await connectAndLogin(server);

  const client = fakeTransport();
  const session = server.addSession(client.transport);
  await session.handleRaw(encode(C2S.LOGIN, { username: 'player_one', password: 'wrongpass' }));
  const first = client.last(S2C.ERROR).reason;
  await session.handleRaw(encode(C2S.LOGIN, { username: 'ghost_user', password: 'wrongpass' }));
  assert.equal(client.last(S2C.ERROR).reason, first);
});

test('movement is validated and impossible moves are corrected', async () => {
  const { server } = await makeServer();
  const { client, session } = await connectAndLogin(server);
  const start = { ...session.player.position };

  await session.handleRaw(encode(C2S.MOVE, { position: { x: 900, y: start.y, z: 900 } }));
  const correction = client.last(S2C.PLAYER_STATE);
  assert.ok(correction.correction);
  assert.deepEqual(session.player.position, start);

  await session.handleRaw(
    encode(C2S.MOVE, { position: { x: start.x + 0.2, y: start.y, z: start.z }, yaw: 1 }),
  );
  assert.equal(session.player.position.x, start.x + 0.2);
  assert.equal(session.player.yaw, 1);
});

test('walking streams new chunks and drops distant ones', async () => {
  const { server } = await makeServer();
  const { client, session } = await connectAndLogin(server);
  const before = client.ofType(S2C.CHUNK).length;

  session.player.position = { x: 200.5, y: 12, z: 200.5 };
  const { sent, removed } = session.syncChunks();
  assert.ok(sent > 0);
  assert.ok(removed > 0);
  assert.ok(client.ofType(S2C.CHUNK).length > before);
  assert.ok(client.ofType(S2C.CHUNK_UNLOAD).length > 0);
});

test('rate limiting rejects a flood of build actions', async () => {
  const { server } = await makeServer();
  const { client, session } = await connectAndLogin(server);
  const target = { x: 0, y: 9, z: 0 };

  let limited = false;
  for (let i = 0; i < 60; i++) {
    await session.handleRaw(encode(C2S.INTERACT, { target }));
    if (client.last(S2C.ERROR)?.reason === 'slow down') {
      limited = true;
      break;
    }
  }
  assert.ok(limited);
});

test('harvest and place round-trip through the protocol', async () => {
  const { server } = await makeServer();
  const { client, session } = await connectAndLogin(server);
  const player = session.player;
  player.position = { x: 0.5, y: 10, z: 0.5 };
  player.pitch = -Math.PI / 2;
  const target = { x: 0, y: 9, z: 0 };

  await session.handleRaw(encode(C2S.BEGIN_HARVEST, { target }));
  const begun = client.last(S2C.ACTION_RESULT);
  assert.equal(begun.ok, true);
  assert.ok(begun.detail.seconds > 0);

  // Too early: the server refuses until the mining time has elapsed.
  await session.handleRaw(encode(C2S.HARVEST, { target }));
  assert.equal(client.last(S2C.ACTION_RESULT).ok, false);
  assert.equal(server.world.getBlock(0, 9, 0), BLOCK_IDS.GRASS);
});

test('block updates are broadcast to nearby players only', async () => {
  const { server } = await makeServer();
  const { session: near } = await connectAndLogin(server, 'near_player');
  const { client: farClient, session: far } = await connectAndLogin(server, 'far_player');
  far.player.position = { x: 5000.5, y: 12, z: 5000.5 };

  const nearClient = fakeTransport();
  const observer = server.addSession(nearClient.transport);
  observer.player = near.player;

  server.world.setBlock(1, 10, 1, BLOCK_IDS.PLANKS, { source: 'test' });
  assert.ok(nearClient.ofType(S2C.BLOCK_UPDATE).length > 0);
  assert.equal(farClient.ofType(S2C.BLOCK_UPDATE).length, 0);
});

test('chat is broadcast to everyone', async () => {
  const { server } = await makeServer();
  const { session } = await connectAndLogin(server, 'chatter');
  const { client: listener } = await connectAndLogin(server, 'listener');

  await session.handleRaw(encode(C2S.CHAT, { text: 'hello world' }));
  assert.equal(listener.last(S2C.CHAT).text, 'hello world');
  assert.equal(listener.last(S2C.CHAT).from, 'chatter');
});

test('dropping and picking items up moves them through the world', async () => {
  const { server } = await makeServer();
  const { client, session } = await connectAndLogin(server);
  session.player.inventory.setSlot(0, { item: 'coal', count: 4 });

  await session.handleRaw(encode(C2S.DROP_ITEM, { slot: 0, count: 4 }));
  const dropped = client.last(S2C.ACTION_RESULT);
  assert.equal(dropped.ok, true);
  assert.equal(session.player.inventory.countOf('coal'), 0);

  await session.handleRaw(encode(C2S.PICKUP_ITEM, { id: dropped.detail.entity.id }));
  assert.equal(session.player.inventory.countOf('coal'), 4);
});

test('the world tick expires buffs, regrowth and ground items', async () => {
  const { server } = await makeServer();
  const { session } = await connectAndLogin(server);
  session.player.character.applyBuff({ id: 'temp', stat: 'attack', magnitude: 1, duration: 1 }, 0);
  server.groundItems.spawn({ x: 0, y: 10, z: 0, item: 'coal', now: 0 });

  const result = server.tick(1_000_000);
  assert.equal(result.despawned, 1);
  assert.ok(!session.player.character.hasBuff('temp'));
});

test('disconnecting saves the player and tells the others', async () => {
  const { server, store } = await makeServer();
  const { session } = await connectAndLogin(server);
  const { client: watcher } = await connectAndLogin(server, 'watcher');
  session.player.inventory.add('stick', 3);

  await server.removeSession(session);
  assert.equal(store.getPlayer(session.player.id).inventory.slots.some((s) => s?.item === 'stick'), true);
  assert.ok(watcher.ofType(S2C.PLAYER_LEAVE).length > 0);
  assert.equal(server.sessions.has(session.id), false);
});

test('the server refuses connections past its player cap', async () => {
  const { server } = await makeServer({ maxPlayers: 1 });
  await connectAndLogin(server);
  const client = fakeTransport();
  server.addSession(client.transport);
  assert.match(client.last(S2C.ERROR).reason, /server full/);
});

test('shutting down persists the world and disconnects everyone', async () => {
  const { server, store } = await makeServer();
  const { session } = await connectAndLogin(server);
  server.world.setBlock(3, 10, 3, BLOCK_IDS.PLANKS, { source: 'test' });

  await server.stop();
  assert.equal(server.sessions.size, 0);
  assert.equal(session.closed, true);
  assert.ok(store.getWorldState().chunks.length > 0);
});

test('trashing destroys a stack but never a protected item', async () => {
  const { server } = await makeServer();
  const { client, session } = await connectAndLogin(server);
  const protectedItem = content.items.all().find((def) => def.trashable === false);
  assert.ok(protectedItem, 'expected at least one non-trashable item to exist');

  session.player.inventory.setSlot(0, { item: 'coal', count: 5 });
  await session.handleRaw(encode(C2S.TRASH_ITEM, { slot: 0 }));
  assert.equal(client.last(S2C.ACTION_RESULT).ok, true);
  assert.equal(session.player.inventory.countOf('coal'), 0);

  session.player.inventory.setSlot(1, { item: protectedItem.id, count: 1 });
  await session.handleRaw(encode(C2S.TRASH_ITEM, { slot: 1 }));
  assert.equal(client.last(S2C.ACTION_RESULT).ok, false);
  assert.equal(session.player.inventory.countOf(protectedItem.id), 1);
});

test('locking a slot survives a round trip to the client', async () => {
  const { server } = await makeServer();
  const { client, session } = await connectAndLogin(server);

  await session.handleRaw(encode(C2S.LOCK_SLOT, { slot: 2 }));
  assert.equal(client.last(S2C.ACTION_RESULT).ok, true);
  assert.deepEqual(client.last(S2C.SELF_STATE).inventory.lockedSlots, [2]);

  await session.handleRaw(encode(C2S.LOCK_SLOT, { slot: 2 }));
  assert.deepEqual(client.last(S2C.SELF_STATE).inventory.lockedSlots, []);

  await session.handleRaw(encode(C2S.LOCK_SLOT, { slot: 9999 }));
  assert.equal(client.last(S2C.ACTION_RESULT).ok, false);
});

test('equip and unequip verbs move items and broadcast the new look', async () => {
  const { server } = await makeServer();
  const { client, session } = await connectAndLogin(server);
  const { client: watcher } = await connectAndLogin(server, 'player_two');
  const slot = session.player.inventory.slots.findIndex((stack) => stack?.item === 'wooden_pickaxe');

  await session.handleRaw(encode(C2S.EQUIP, { slot }));
  assert.equal(client.last(S2C.ACTION_RESULT).ok, true);
  assert.equal(client.last(S2C.SELF_STATE).equipmentSlots.main_hand.item, 'wooden_pickaxe');
  assert.equal(client.last(S2C.SELF_STATE).inventory.slots[slot], null);
  assert.equal(watcher.last(S2C.PLAYER_UPDATE).equipment.main_hand, 'wooden_pickaxe');

  await session.handleRaw(encode(C2S.UNEQUIP, { equipSlot: 'main_hand', to: 20 }));
  assert.equal(client.last(S2C.ACTION_RESULT).ok, true);
  assert.equal(client.last(S2C.SELF_STATE).inventory.slots[20].item, 'wooden_pickaxe');
  assert.equal(client.last(S2C.SELF_STATE).equipmentSlots.main_hand, null);

  await session.handleRaw(encode(C2S.UNEQUIP, { equipSlot: 'main_hand' }));
  assert.equal(client.last(S2C.ACTION_RESULT).reason, 'nothing equipped');
});

test('attack and interact_entity messages need a sane entity id', () => {
  assert.equal(validate({ t: C2S.ATTACK, entity: 'en_1' }).ok, true);
  assert.equal(validate({ t: C2S.ATTACK }).ok, false);
  assert.equal(validate({ t: C2S.INTERACT_ENTITY, entity: 'x'.repeat(65) }).ok, false);
  assert.equal(validate({ t: C2S.INTERACT_ENTITY, entity: 7 }).ok, false);
});

test('entities stream to nearby sessions as add, update and remove', async () => {
  const { server } = await makeServer({ spawnEntities: false });
  const { client, session } = await connectAndLogin(server);
  const { x, y, z } = session.player.position;
  const cow = server.entities.spawn('cow', { x: x + 3, y, z });
  server.tickEntities(Date.now());
  const added = client.last(S2C.ENTITY_ADD).entities;
  assert.equal(added.length, 1);
  assert.equal(added[0].id, cow.id);
  assert.equal(added[0].def, 'cow');
  assert.equal(typeof added[0].seed, 'number');

  server.entities.damage(cow.id, 1);
  server.tickEntities(Date.now());
  assert.equal(client.last(S2C.ENTITY_UPDATE).entities[0].health, cow.health);

  server.entities.remove(cow.id);
  server.tickEntities(Date.now());
  assert.deepEqual(client.last(S2C.ENTITY_REMOVE).ids, [cow.id]);
});

function aimAt(player, entity) {
  const box = entityBox(entity);
  const eye = player.eyePosition;
  const dx = (box.min.x + box.max.x) / 2 - eye.x;
  const dy = (box.min.y + box.max.y) / 2 - eye.y;
  const dz = (box.min.z + box.max.z) / 2 - eye.z;
  player.yaw = Math.atan2(-dx, -dz);
  player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}

test('click-to-hit respects reach and cooldown, and kills leave a butcherable corpse', async () => {
  const { server } = await makeServer({ spawnEntities: false });
  const { client, session } = await connectAndLogin(server);
  const { client: watcher } = await connectAndLogin(server, 'player_two');
  const { x, y, z } = session.player.position;
  const far = server.entities.spawn('cow', { x: x + 12, y, z });
  const cow = server.entities.spawn('sheep', { x: x + 1.5, y, z });

  await session.handleRaw(encode(C2S.ATTACK, { entity: far.id }));
  assert.equal(client.last(S2C.ACTION_RESULT).reason, 'out of reach');
  await session.handleRaw(encode(C2S.ATTACK, { entity: 'en_missing' }));
  assert.equal(client.last(S2C.ACTION_RESULT).reason, 'nothing to attack');

  aimAt(session.player, cow);
  session.player.yaw += Math.PI;
  await session.handleRaw(encode(C2S.ATTACK, { entity: cow.id }));
  assert.equal(client.last(S2C.ACTION_RESULT).reason, 'not looking at it');

  aimAt(session.player, cow);
  await session.handleRaw(encode(C2S.ATTACK, { entity: cow.id }));
  assert.equal(client.last(S2C.ACTION_RESULT).ok, true);
  assert.equal(client.last(S2C.ACTION_RESULT).detail.damage, 1);
  assert.equal(watcher.last(S2C.ENTITY_ACTION).action, 'hurt');
  await session.handleRaw(encode(C2S.ATTACK, { entity: cow.id }));
  assert.equal(client.last(S2C.ACTION_RESULT).reason, 'attack cooling down');

  await session.handleRaw(encode(C2S.INTERACT_ENTITY, { entity: cow.id }));
  assert.match(client.last(S2C.ACTION_RESULT).reason, /ignores you/);

  while (cow.state === 'alive') {
    session.lastAttackAt = 0;
    await session.handleRaw(encode(C2S.ATTACK, { entity: cow.id }));
  }
  assert.equal(client.last(S2C.ACTION_RESULT).detail.killed, true);
  assert.equal(watcher.last(S2C.ENTITY_ACTION).action, 'die');

  await session.handleRaw(encode(C2S.INTERACT_ENTITY, { entity: cow.id }));
  const result = client.last(S2C.ACTION_RESULT);
  assert.equal(result.ok, true);
  assert.equal(result.detail.name, 'Sheep');
  assert.ok(result.detail.drops.some((d) => d.item === 'bone'));
  assert.ok(session.player.inventory.countOf('bone') >= 1);
  assert.equal(server.entities.get(cow.id), null);
  assert.ok(client.last(S2C.ENTITY_REMOVE).ids.includes(cow.id));
});
