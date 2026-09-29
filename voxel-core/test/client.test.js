/**
 * Reference-client tests.
 *
 * The browser client imports shared engine modules by their served path, so
 * two things are worth guarding automatically:
 *
 *  1. every `/src/...` specifier the client uses resolves, and every name it
 *     imports is actually exported (a broken specifier only shows up as a
 *     blank screen otherwise);
 *  2. the DOM-free client modules — the world mirror and the block target
 *     resolver — behave.
 *
 * three.js-dependent modules are syntax-checked rather than imported, because
 * instantiating a WebGL renderer needs a browser.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const packageRoot = new URL('../', import.meta.url);
const clientJsDir = fileURLToPath(new URL('client/js/', packageRoot));

// Map "/src/..." onto the real files before any client module is imported.
register('./helpers/src-loader.js', import.meta.url, { data: { rootUrl: packageRoot.href } });

const { ClientWorld } = await import('../client/js/world-view.js');
const { TargetResolver } = await import('../client/js/targeting.js');
const { defaultUrl } = await import('../client/js/net.js');
const { wrapAngle } = await import('../client/js/controls.js');
const { ChunkMesher } = await import('../client/js/chunk-mesher.js');
const { createContent } = await import('../src/content/index.js');
const { Chunk } = await import('../src/world/chunk.js');
const { CHUNK_SIZE } = await import('../src/core/constants.js');

const content = createContent().freeze();

/** Solid floor of stone up to (excluding) `groundY`, grass on top. */
function flatChunk(chunkX, chunkZ, groundY = 8) {
  const chunk = new Chunk(chunkX, chunkZ);
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < groundY; y++) chunk.set(x, y, z, content.blockId('stone'));
      chunk.set(x, groundY, z, content.blockId('grass'));
    }
  }
  return chunk;
}

function flatWorld({ groundY = 8, radius = 1 } = {}) {
  const world = new ClientWorld(content);
  for (let cx = -radius; cx <= radius; cx++) {
    for (let cz = -radius; cz <= radius; cz++) {
      world.loadChunk(flatChunk(cx, cz, groundY).toWire());
    }
  }
  world.takeDirty();
  return world;
}

// ------------------------------------------------------------ import graph

test('client imports', async (t) => {
  const files = (await readdir(clientJsDir)).filter((name) => name.endsWith('.js'));
  assert.ok(files.length > 0, 'expected client modules');

  await t.test('every /src specifier resolves to a real module', async () => {
    for (const file of files) {
      const source = await readFile(path.join(clientJsDir, file), 'utf8');
      for (const specifier of source.matchAll(/from '(\/src\/[^']+)'/g)) {
        const target = fileURLToPath(new URL(`.${specifier[1]}`, packageRoot));
        assert.ok(existsSync(target), `${file} imports missing module ${specifier[1]}`);
      }
    }
  });

  await t.test('every imported name is exported by its module', async () => {
    const pattern = /import\s*\{([^}]+)\}\s*from\s*'(\/src\/[^']+)'/g;
    for (const file of files) {
      const source = await readFile(path.join(clientJsDir, file), 'utf8');
      for (const match of source.matchAll(pattern)) {
        const names = match[1]
          .split(',')
          .map((name) => name.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean);
        const module = await import(pathToFileURL(fileURLToPath(new URL(`.${match[2]}`, packageRoot))).href);
        for (const name of names) {
          assert.ok(name in module, `${file} imports "${name}" which ${match[2]} does not export`);
        }
      }
    }
  });

  await t.test('bare specifiers are covered by the page import map', async () => {
    const html = await readFile(fileURLToPath(new URL('client/index.html', packageRoot)), 'utf8');
    const importMap = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]);

    for (const file of files) {
      const source = await readFile(path.join(clientJsDir, file), 'utf8');
      for (const match of source.matchAll(/from '([^'./][^']*)'/g)) {
        const specifier = match[1];
        if (specifier.startsWith('/')) continue;
        assert.ok(
          importMap.imports[specifier],
          `${file} imports bare specifier "${specifier}" with no import-map entry`,
        );
      }
    }
  });
});

// -------------------------------------------------------------- ClientWorld

test('ClientWorld', async (t) => {
  await t.test('loads chunks from the wire format', () => {
    const world = flatWorld();
    assert.equal(world.getBlock(0, 8, 0), content.blockId('grass'));
    assert.equal(world.getBlock(0, 7, 0), content.blockId('stone'));
    assert.equal(world.getBlock(0, 9, 0), 0);
  });

  await t.test('reads across chunk borders with negative coordinates', () => {
    const world = flatWorld();
    assert.equal(world.getBlock(-1, 8, -1), content.blockId('grass'));
    assert.equal(world.getBlock(-16, 8, -16), content.blockId('grass'));
    assert.equal(world.getBlock(-17, 8, -17), 0, 'chunk -2,-2 was never streamed');
  });

  await t.test('returns air outside loaded chunks and outside the height range', () => {
    const world = flatWorld({ radius: 0 });
    assert.equal(world.getBlock(200, 8, 200), 0);
    assert.equal(world.getBlock(0, -1, 0), 0);
    assert.equal(world.getBlock(0, 10_000, 0), 0);
  });

  await t.test('isSolid matches the block registry', () => {
    const world = flatWorld();
    assert.equal(world.isSolid(0, 8, 0), true);
    assert.equal(world.isSolid(0, 9, 0), false);
  });

  await t.test('setBlock marks the chunk dirty', () => {
    const world = flatWorld();
    assert.equal(world.takeDirty().length, 0);
    world.setBlock(4, 9, 4, content.blockId('stone'));
    assert.deepEqual(world.takeDirty(), ['0,0']);
    assert.equal(world.getBlock(4, 9, 4), content.blockId('stone'));
  });

  await t.test('edits on a chunk border also dirty the neighbour', () => {
    const world = flatWorld();
    world.takeDirty();
    world.setBlock(0, 9, 0, content.blockId('stone'));
    const dirty = world.takeDirty().sort();
    assert.ok(dirty.includes('0,0'));
    assert.ok(dirty.includes('-1,0'));
    assert.ok(dirty.includes('0,-1'));
  });

  await t.test('setBlock refuses columns that have not been streamed', () => {
    const world = flatWorld({ radius: 0 });
    assert.equal(world.setBlock(500, 9, 500, 1), false);
  });

  await t.test('unloadChunk removes the chunk and its dirty flag', () => {
    const world = flatWorld();
    world.setBlock(4, 9, 4, content.blockId('stone'));
    world.unloadChunk(0, 0);
    assert.equal(world.chunks.has('0,0'), false);
    assert.equal(world.takeDirty().includes('0,0'), false);
    assert.equal(world.getBlock(4, 9, 4), 0);
  });

  await t.test('hasChunkAt reports streamed columns', () => {
    const world = flatWorld({ radius: 0 });
    assert.equal(world.hasChunkAt(3, 3), true);
    assert.equal(world.hasChunkAt(300, 300), false);
  });

  await t.test('tile entities round-trip through the chunk', () => {
    const world = flatWorld();
    assert.equal(world.setTileEntity({ x: 2, y: 9, z: 2 }, { kind: 'container' }), true);
    const chunk = world.chunks.get('0,0');
    assert.deepEqual(chunk.getTileEntity(2, 9, 2), { kind: 'container' });
    assert.equal(world.setTileEntity({ x: 900, y: 9, z: 900 }, { kind: 'container' }), false);
  });
});

// ------------------------------------------------------------ targeting

test('TargetResolver', async (t) => {
  /** Eye standing on the flat ground at the centre of chunk 0,0. */
  const eye = { x: 4.5, y: 10.62, z: 4.5 };

  await t.test('raycast finds the block being aimed at', () => {
    const world = flatWorld();
    const resolver = new TargetResolver(world, content);
    // Looking straight down at the grass underfoot.
    const focus = resolver.resolve(eye, 0, -Math.PI / 2);
    assert.ok(focus);
    assert.equal(focus.via, 'ray');
    assert.equal(focus.blockName, 'grass');
    assert.deepEqual({ x: focus.x, y: focus.y, z: focus.z }, { x: 4, y: 8, z: 4 });
  });

  await t.test('the hit exposes the adjacent cell a placement would occupy', () => {
    const world = flatWorld();
    const resolver = new TargetResolver(world, content);
    const focus = resolver.resolve(eye, 0, -Math.PI / 2);
    assert.deepEqual(focus.adjacent, { x: 4, y: 9, z: 4 });
  });

  await t.test('falls back to proximity when the ray misses', () => {
    const world = new ClientWorld(content);
    const chunk = new Chunk(0, 0);
    chunk.set(6, 10, 4, content.blockId('stone'));
    world.loadChunk(chunk.toWire());
    const resolver = new TargetResolver(world, content);

    const standing = { x: 4.5, y: 10.5, z: 4.5 };
    const aimedAside = -Math.PI / 2 + 0.6; // 0.6 rad off the block

    assert.equal(
      resolver.resolve(standing, aimedAside, 0, { proximityFallback: false }),
      null,
      'the ray should miss',
    );

    const focus = resolver.resolve(standing, aimedAside, 0, { proximityFallback: true });
    assert.ok(focus);
    assert.equal(focus.via, 'proximity');
    assert.deepEqual({ x: focus.x, y: focus.y, z: focus.z }, { x: 6, y: 10, z: 4 });
    assert.equal(focus.adjacent, null, 'proximity focus has no placement face');
  });

  await t.test('proximity can be disabled so only the ray counts', () => {
    const world = flatWorld();
    const resolver = new TargetResolver(world, content);
    const focus = resolver.resolve(eye, 0, Math.PI / 2 - 0.02, { proximityFallback: false });
    assert.equal(focus, null);
  });

  await t.test('nothing is focused when the player is far above the terrain', () => {
    const world = flatWorld();
    const resolver = new TargetResolver(world, content);
    const focus = resolver.resolve({ x: 4.5, y: 40, z: 4.5 }, 0, 0);
    assert.equal(focus, null);
  });

  await t.test('air and unloaded space are never targetable', () => {
    const world = flatWorld({ radius: 0 });
    const resolver = new TargetResolver(world, content);
    assert.equal(resolver._isTargetable(0), false);
    assert.equal(resolver.resolve({ x: 500.5, y: 40, z: 500.5 }, 0, -Math.PI / 2), null);
  });

  await t.test('reported distance never exceeds the configured reach', () => {
    const world = flatWorld();
    const resolver = new TargetResolver(world, content);
    resolver.reach = 2;
    const focus = resolver.resolve({ x: 4.5, y: 12, z: 4.5 }, 0, -Math.PI / 2);
    assert.equal(focus, null, 'ground is 3 blocks away, outside a reach of 2');
  });

  await t.test('proximity ignores blocks behind the player', () => {
    const world = new ClientWorld(content);
    const chunk = new Chunk(0, 0);
    chunk.set(0, 10, 4, content.blockId('stone'));
    world.loadChunk(chunk.toWire());
    const resolver = new TargetResolver(world, content);
    // Standing east of the block, looking east (+X) — the block is behind.
    const focus = resolver.resolve({ x: 3.5, y: 10.5, z: 4.5 }, -Math.PI / 2, 0);
    assert.equal(focus, null);
  });
});

// --------------------------------------------------------------- meshing

test('ChunkMesher', async (t) => {
  const mesher = new ChunkMesher(content);
  /** Four vertices per face; indices are six per face. */
  const facesIn = (geometry) => (geometry ? geometry.getIndex().count / 6 : 0);
  const air = () => 0;

  await t.test('an empty chunk produces no geometry at all', () => {
    const built = mesher.build(new Chunk(0, 0), air);
    assert.equal(built.opaque, null);
    assert.equal(built.transparent, null);
  });

  await t.test('an isolated block emits all six faces', () => {
    const chunk = new Chunk(0, 0);
    chunk.set(8, 10, 8, content.blockId('stone'));
    const built = mesher.build(chunk, air);
    assert.equal(facesIn(built.opaque), 6);
    assert.equal(built.transparent, null);
  });

  await t.test('touching faces between solid blocks are culled', () => {
    const world = new ClientWorld(content);
    const chunk = new Chunk(0, 0);
    chunk.set(8, 10, 8, content.blockId('stone'));
    chunk.set(9, 10, 8, content.blockId('stone'));
    world.loadChunk(chunk.toWire());
    const built = mesher.build(chunk, world.getBlock);
    assert.equal(facesIn(built.opaque), 10, 'two shared faces removed from twelve');
  });

  await t.test('faces are culled against blocks in the neighbouring chunk', () => {
    const world = new ClientWorld(content);
    const chunk = new Chunk(0, 0);
    chunk.set(0, 10, 0, content.blockId('stone'));
    const neighbour = new Chunk(-1, 0);
    neighbour.set(CHUNK_SIZE - 1, 10, 0, content.blockId('stone'));
    world.loadChunk(chunk.toWire());
    world.loadChunk(neighbour.toWire());
    const built = mesher.build(world.chunks.get('0,0'), world.getBlock);
    assert.equal(facesIn(built.opaque), 5, 'the -X face is hidden by the neighbour chunk');
  });

  await t.test('transparent and liquid blocks go into their own geometry', () => {
    const chunk = new Chunk(0, 0);
    chunk.set(8, 10, 8, content.blockId('stone'));
    chunk.set(8, 11, 8, content.blockId('water'));
    const built = mesher.build(chunk, air);
    assert.ok(built.opaque);
    assert.ok(built.transparent);
    // Stone keeps its top face because water does not hide it.
    assert.equal(facesIn(built.opaque), 6);
    assert.equal(facesIn(built.transparent), 6);
  });

  await t.test('neighbouring blocks of the same transparent type hide each other', () => {
    const world = new ClientWorld(content);
    const chunk = new Chunk(0, 0);
    chunk.set(8, 10, 8, content.blockId('glass'));
    chunk.set(9, 10, 8, content.blockId('glass'));
    world.loadChunk(chunk.toWire());
    const built = mesher.build(chunk, world.getBlock);
    assert.equal(facesIn(built.transparent), 10);
  });

  await t.test('colours come from the block registry and are cached', () => {
    const stone = mesher.colorOf(content.blockId('stone'));
    assert.equal(mesher.colorOf(content.blockId('stone')), stone, 'same Color instance reused');
    assert.notEqual(
      mesher.colorOf(content.blockId('grass')).getHexString(),
      stone.getHexString(),
    );
  });

  await t.test('geometry carries position, normal and colour attributes', () => {
    const chunk = new Chunk(0, 0);
    chunk.set(8, 10, 8, content.blockId('stone'));
    const { opaque } = mesher.build(chunk, air);
    assert.equal(opaque.getAttribute('position').count, 24);
    assert.equal(opaque.getAttribute('normal').count, 24);
    assert.equal(opaque.getAttribute('color').count, 24);
    assert.ok(opaque.boundingSphere);
  });
});

// ----------------------------------------------------------------- avatar

test('PlayerAvatar', async (t) => {
  const THREE = await import('three');
  const { PLAYER_EYE_HEIGHT } = await import('../src/core/constants.js');
  const { PlayerAvatar } = await import('../client/js/player-avatar.js');

  /** Nameplates need a canvas, so tests build avatars without one. */
  const makeAvatar = () => new PlayerAvatar({ id: 'p1', username: 'tester', showNameplate: false });

  await t.test('the camera mount sits at exactly the shared eye height', () => {
    const avatar = makeAvatar();
    avatar.setTransform({ x: 10, y: 20, z: 30 }, 0, 0);
    avatar.root.updateMatrixWorld(true);
    const eye = avatar.eye.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(eye.y - (20 + PLAYER_EYE_HEIGHT)) < 1e-6, `eye at ${eye.y}`);
    assert.ok(Math.abs(eye.x - 10) < 1e-6);
    assert.ok(Math.abs(eye.z - 30) < 1e-6);
  });

  await t.test('walking does not move the camera mount off eye height', () => {
    const avatar = makeAvatar();
    avatar.setTransform({ x: 0, y: 0, z: 0 }, 0, 0);
    avatar.animation = 'walk';
    for (let i = 0; i < 30; i++) avatar.update(1 / 30, { interpolate: false });
    avatar.root.updateMatrixWorld(true);
    const eye = avatar.eye.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(eye.y - PLAYER_EYE_HEIGHT) < 1e-6, `eye drifted to ${eye.y}`);
  });

  await t.test('first person hides the head mesh but keeps the mount attached', () => {
    const avatar = makeAvatar();
    avatar.setFirstPerson(true);
    assert.equal(avatar.parts.head.userData.mesh.visible, false);
    assert.equal(avatar.parts.head.visible, true);
    assert.equal(avatar.eye.parent, avatar.parts.head);
    avatar.setFirstPerson(false);
    assert.equal(avatar.parts.head.userData.mesh.visible, true);
  });

  await t.test('yaw turns the body and pitch only tilts the head', () => {
    const avatar = makeAvatar();
    avatar.setTransform({ x: 0, y: 0, z: 0 }, 1.2, -0.4);
    assert.equal(avatar.body.rotation.y, 1.2);
    assert.equal(avatar.parts.head.rotation.x, -0.4);
  });

  await t.test('the walk cycle swings the limbs, idle barely moves them', () => {
    const walker = makeAvatar();
    walker.animation = 'walk';
    for (let i = 0; i < 8; i++) walker.update(1 / 30, { interpolate: false });
    assert.ok(Math.abs(walker.parts.legLeft.rotation.x) > 0.1);
    assert.ok(
      Math.abs(walker.parts.legLeft.rotation.x + walker.parts.legRight.rotation.x) < 1e-9,
      'legs swing in opposition',
    );

    const idler = makeAvatar();
    idler.animation = 'idle';
    for (let i = 0; i < 8; i++) idler.update(1 / 30, { interpolate: false });
    assert.ok(Math.abs(idler.parts.legLeft.rotation.x) < 0.07);
  });

  await t.test('remote avatars interpolate towards the last received state', () => {
    const avatar = makeAvatar();
    avatar.setTransform({ x: 0, y: 0, z: 0 }, 0, 0);
    avatar.applyState({ position: { x: 10, y: 0, z: 0 }, yaw: 0, pitch: 0, animation: 'walk' });
    avatar.update(1 / 30, { interpolate: true });
    assert.ok(avatar.root.position.x > 0 && avatar.root.position.x < 10, 'moves part of the way');
    for (let i = 0; i < 120; i++) avatar.update(1 / 30, { interpolate: true });
    assert.ok(Math.abs(avatar.root.position.x - 10) < 0.01, 'converges on the target');
  });

  await t.test('held items attach to and detach from the hand', () => {
    const avatar = makeAvatar();
    avatar.setHeldItem('stone', () => '#888888');
    assert.ok(avatar.heldMesh);
    assert.equal(avatar.heldMesh.parent, avatar.handAnchor);
    avatar.setHeldItem(null, () => '#888888');
    assert.equal(avatar.heldMesh, null);
    assert.equal(avatar.handAnchor.children.length, 0);
  });
});

// --------------------------------------------------------------- utilities

test('client utilities', async (t) => {
  await t.test('wrapAngle keeps yaw inside the range the protocol validates', () => {
    for (const angle of [0, 7, -7, 100, -100]) {
      const wrapped = wrapAngle(angle);
      assert.ok(wrapped >= -Math.PI && wrapped <= Math.PI, `${angle} -> ${wrapped}`);
      assert.ok(Math.abs(Math.sin(wrapped) - Math.sin(angle)) < 1e-9);
      assert.ok(Math.abs(Math.cos(wrapped) - Math.cos(angle)) < 1e-9);
    }
  });

  await t.test('defaultUrl derives the socket URL from the page origin', () => {
    const original = globalThis.location;
    globalThis.location = { protocol: 'https:', host: 'example.test:443' };
    assert.equal(defaultUrl(), 'wss://example.test:443');
    globalThis.location = { protocol: 'http:', host: 'localhost:8080' };
    assert.equal(defaultUrl(), 'ws://localhost:8080');
    if (original === undefined) delete globalThis.location;
    else globalThis.location = original;
  });
});
