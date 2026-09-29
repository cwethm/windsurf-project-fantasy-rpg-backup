/**
 * Connection session.
 *
 * Owns one client's lifecycle: authenticate, join, stream chunks, apply
 * validated actions, save and leave. A session talks to the socket through two
 * injected functions, so the whole message pipeline is testable without a real
 * WebSocket.
 */

import { EVENTS } from '../core/event-bus.js';
import { S2C, encode, decode, validate, UNAUTHENTICATED_TYPES, PROTOCOL_VERSION } from '../net/protocol.js';
import { RateLimiter } from '../net/rate-limiter.js';
import { chunkDelta } from '../net/interest.js';
import { parseChunkKey } from '../world/coords.js';

let nextSessionId = 1;

export class Session {
  /**
   * @param {{
   *   server: import('./game-server.js').GameServer,
   *   send: (text: string) => void,
   *   close: (code?: number, reason?: string) => void,
   *   remoteAddress?: string,
   * }} config
   */
  constructor({ server, send, close, remoteAddress = 'unknown' }) {
    this.id = `s${nextSessionId++}`;
    this.server = server;
    this._send = send;
    this._close = close;
    this.remoteAddress = remoteAddress;
    this.authenticated = false;
    /** @type {import('../game/player.js').Player|null} */
    this.player = null;
    this.account = null;
    this.limiter = new RateLimiter(server.options.rateLimits);
    this.lastMoveAt = Date.now();
    this.closed = false;
  }

  /**
   * @param {string} type
   * @param {object} [payload]
   */
  send(type, payload = {}) {
    if (this.closed) return;
    this._send(encode(type, payload));
  }

  /** @param {string} reason */
  close(reason = 'closed') {
    if (this.closed) return;
    this.closed = true;
    this._close(1000, reason);
  }

  /** Send the pre-login greeting. */
  greet() {
    this.send(S2C.WELCOME, {
      protocol: PROTOCOL_VERSION,
      seed: this.server.world.generator.seed.raw,
      allowRegister: this.server.options.allowRegister,
      constants: this.server.clientConstants(),
    });
  }

  /**
   * Entry point for every inbound frame.
   * @param {string|Uint8Array} raw
   */
  async handleRaw(raw) {
    const decoded = decode(raw);
    if (!decoded.ok) {
      this.send(S2C.ERROR, { reason: decoded.reason });
      return;
    }
    const msg = decoded.message;

    if (!this.limiter.check(msg.t).ok) {
      this.send(S2C.ERROR, { reason: 'slow down', type: msg.t });
      return;
    }
    if (!this.authenticated && !UNAUTHENTICATED_TYPES.has(msg.t)) {
      this.send(S2C.ERROR, { reason: 'not authenticated', type: msg.t });
      return;
    }
    const check = validate(msg);
    if (!check.ok) {
      this.send(S2C.ERROR, { reason: check.reason, type: msg.t });
      return;
    }

    try {
      await this.server.handlers.dispatch(msg.t, this, msg);
    } catch (err) {
      this.server.logger.error?.(`[session ${this.id}] handler for "${msg.t}" failed:`, err);
      this.send(S2C.ERROR, { reason: 'internal error', type: msg.t });
    }
  }

  // ------------------------------------------------------------------ join

  /**
   * Attach an authenticated player and push the initial world view.
   * @param {import('../game/player.js').Player} player
   */
  async join(player) {
    this.player = player;
    this.authenticated = true;

    this.send(S2C.LOGIN_OK, {
      id: player.id,
      username: player.username,
      position: player.position,
    });
    this.syncChunks();
    this.send(S2C.SELF_STATE, player.toSelfState());
    this.sendGroundItems();

    for (const other of this.server.sessions.values()) {
      if (other === this || !other.player) continue;
      this.send(S2C.PLAYER_JOIN, other.player.toNetworkState());
    }
    this.server.broadcastNear(player.position, S2C.PLAYER_JOIN, player.toNetworkState(), {
      exclude: this,
    });
    this.server.bus.emit(EVENTS.PLAYER_JOINED, { playerId: player.id, username: player.username });
  }

  /**
   * Send any chunks that entered the player's interest radius and drop those
   * that left it.
   */
  syncChunks() {
    if (!this.player) return { sent: 0, removed: 0 };
    const { add, remove } = chunkDelta({
      position: this.player.position,
      loaded: this.player.loadedChunks,
      viewDistance: this.player.viewDistance,
    });

    let sent = 0;
    for (const { chunkX, chunkZ, key } of add.slice(0, this.server.options.chunksPerUpdate)) {
      const chunk = this.server.world.getChunk(chunkX, chunkZ);
      this.send(S2C.CHUNK, chunk.toWire());
      this.player.loadedChunks.add(key);
      sent += 1;
    }
    for (const key of remove) {
      this.player.loadedChunks.delete(key);
      const { chunkX, chunkZ } = parseChunkKey(key);
      this.send(S2C.CHUNK_UNLOAD, { chunkX, chunkZ });
    }
    return { sent, removed: remove.length };
  }

  /** Push the ground items inside the player's interest radius. */
  sendGroundItems() {
    if (!this.player) return;
    const radius = this.player.viewDistance * 16;
    const items = this.server.groundItems.near(this.player.position, radius);
    this.send(S2C.GROUND_ITEMS, { items });
  }

  /** Push the owning client's full state (inventory, stats, equipment). */
  sendSelfState() {
    if (this.player) this.send(S2C.SELF_STATE, this.player.toSelfState());
  }

  /** Reply to an action with a uniform result envelope. */
  reply(action, result) {
    this.send(S2C.ACTION_RESULT, {
      action,
      ok: result?.ok !== false,
      reason: result?.reason ?? null,
      detail: result?.ok === false ? null : result ?? null,
    });
  }
}
