/**
 * WebSocket client.
 *
 * Imports the protocol module the server validates against, so message shapes
 * can never drift between the two halves. Delivery is a simple typed
 * subscription: `net.on(S2C.CHUNK, fn)`.
 */

import { C2S, S2C, encode, decode, PROTOCOL_VERSION } from '/src/net/protocol.js';

export { C2S, S2C };

const RECONNECT_DELAY_MS = 2000;

export class NetClient {
  /** @param {{ url?: string }} [options] */
  constructor({ url } = {}) {
    this.url = url ?? defaultUrl();
    /** @type {WebSocket|null} */
    this.socket = null;
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
    this.connected = false;
    this.constants = null;
    this.seed = null;
    this.allowRegister = false;
    this._shouldReconnect = true;
    this._reconnectTimer = null;
  }

  /**
   * Subscribe to a server message type. Returns an unsubscribe function.
   * @param {string} type
   * @param {(payload: object) => void} handler
   */
  on(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
    return () => this.listeners.get(type)?.delete(handler);
  }

  _emit(type, payload) {
    for (const handler of this.listeners.get(type) ?? []) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[net] handler for "${type}" failed`, err);
      }
    }
  }

  /** Open the socket. Resolves once the server greeting arrives. */
  connect() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;

      const offWelcome = this.on(S2C.WELCOME, (payload) => {
        offWelcome();
        this.constants = payload.constants ?? null;
        this.seed = payload.seed ?? null;
        this.allowRegister = payload.allowRegister ?? false;
        if (payload.protocol !== PROTOCOL_VERSION) {
          reject(new Error(`protocol mismatch: server ${payload.protocol}, client ${PROTOCOL_VERSION}`));
          return;
        }
        resolve(payload);
      });

      socket.addEventListener('open', () => {
        this.connected = true;
        this._emit('open', {});
      });

      socket.addEventListener('message', (event) => {
        const result = decode(event.data);
        if (!result.ok) {
          console.warn('[net] dropped frame:', result.reason);
          return;
        }
        this._emit(result.message.t, result.message);
      });

      socket.addEventListener('close', () => {
        this.connected = false;
        this._emit('close', {});
        if (this._shouldReconnect) this._scheduleReconnect();
        reject(new Error('connection closed'));
      });

      socket.addEventListener('error', () => {
        this._emit('neterror', {});
      });
    });
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect().catch(() => {});
    }, RECONNECT_DELAY_MS);
  }

  /** Stop reconnect attempts and close the socket. */
  disconnect() {
    this._shouldReconnect = false;
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this.socket?.close();
  }

  /**
   * @param {string} type
   * @param {object} [payload]
   */
  send(type, payload = {}) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(encode(type, payload));
    return true;
  }

  /**
   * Send credentials and wait for the matching reply.
   * @param {{ username: string, password: string, register?: boolean }} credentials
   */
  login({ username, password, register = false }) {
    return new Promise((resolve, reject) => {
      const offOk = this.on(S2C.LOGIN_OK, (payload) => {
        offOk();
        offErr();
        resolve(payload);
      });
      const offErr = this.on(S2C.ERROR, (payload) => {
        offOk();
        offErr();
        reject(new Error(payload.reason ?? 'login failed'));
      });
      this.send(register ? C2S.REGISTER : C2S.LOGIN, { username, password });
    });
  }
}

/** Derive the WebSocket URL from the page origin. */
export function defaultUrl() {
  const protocol = globalThis.location?.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = globalThis.location?.host ?? 'localhost:8080';
  return `${protocol}//${host}`;
}
