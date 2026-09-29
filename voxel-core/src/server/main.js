/**
 * Server entry point.
 *
 * Wires the static file server, the WebSocket transport and the authoritative
 * `GameServer` together, then installs graceful-shutdown handlers so a SIGINT
 * always produces a clean save.
 *
 * Usage: `npm start` (see `config()` for the environment variables).
 */

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { createContent } from '../content/index.js';
import { GameStore } from '../storage/game-store.js';
import { JsonFileStore } from '../storage/stores.js';
import { MAX_MESSAGE_BYTES } from '../net/protocol.js';
import { GameServer } from './game-server.js';
import { createStaticServer } from './static-server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..', '..');

/** Read configuration from the environment, with sane defaults. */
export function config(env = process.env) {
  return {
    port: Number(env.PORT ?? 8080),
    host: env.HOST ?? '0.0.0.0',
    seed: env.WORLD_SEED ?? 'voxel-core',
    savePath: env.SAVE_PATH ?? path.join(packageRoot, 'data', 'world.json'),
    autosaveIntervalMs: Number(env.AUTOSAVE_MS ?? 60_000),
    viewDistance: Number(env.VIEW_DISTANCE ?? 4),
    allowRegister: env.ALLOW_REGISTER !== 'false',
    maxPlayers: Number(env.MAX_PLAYERS ?? 32),
  };
}

/**
 * Boot the whole stack.
 * @param {ReturnType<typeof config>} [options]
 */
export async function main(options = config()) {
  const content = createContent().freeze();

  const store = new GameStore({
    store: new JsonFileStore(options.savePath),
    seed: options.seed,
    autosaveIntervalMs: options.autosaveIntervalMs,
  });
  await store.init();

  const game = await GameServer.create({
    content,
    store,
    seed: options.seed,
    options: {
      viewDistance: options.viewDistance,
      allowRegister: options.allowRegister,
      maxPlayers: options.maxPlayers,
    },
  });

  const http = createStaticServer({
    mounts: [
      { prefix: '/vendor/three', root: path.join(packageRoot, 'node_modules', 'three', 'build') },
      { prefix: '/src', root: path.join(packageRoot, 'src') },
      { prefix: '', root: path.join(packageRoot, 'client') },
    ],
  });

  const wss = new WebSocketServer({ server: http, maxPayload: MAX_MESSAGE_BYTES });
  wss.on('connection', (socket, request) => {
    const session = game.addSession({
      send: (text) => {
        if (socket.readyState === socket.OPEN) socket.send(text);
      },
      close: (code, reason) => socket.close(code, reason),
      remoteAddress: request.socket.remoteAddress ?? 'unknown',
    });

    socket.on('message', (data) => {
      session.handleRaw(typeof data === 'string' ? data : data.toString('utf8'));
    });
    socket.on('close', () => {
      game.removeSession(session).catch((err) => console.error('[server] cleanup failed:', err));
    });
    socket.on('error', (err) => console.error('[server] socket error:', err.message));
  });

  game.start();
  await new Promise((resolve) => http.listen(options.port, options.host, resolve));
  console.info(`[server] listening on http://${options.host}:${options.port} (seed "${options.seed}")`);

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`[server] ${signal} received, saving...`);
    try {
      await game.stop();
      wss.close();
      await new Promise((resolve) => http.close(resolve));
      console.info('[server] shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('[server] shutdown failed:', err);
      process.exit(1);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return { game, http, wss, store, shutdown };
}

// Only auto-start when executed directly, so tests can import this module.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('[server] failed to start:', err);
    process.exit(1);
  });
}
