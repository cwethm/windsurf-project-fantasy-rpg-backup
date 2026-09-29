/**
 * Game-level persistence facade.
 *
 * Owns the loaded snapshot and exposes typed accessors for the three record
 * families the core needs: accounts, players and the world. Autosave, save on
 * disconnect and graceful shutdown all funnel through `flush()`.
 */

import { CURRENT_SCHEMA_VERSION } from './migrations.js';
import { loadSnapshot } from './stores.js';

export class GameStore {
  /**
   * @param {{
   *   store: import('./stores.js').Store,
   *   seed?: string|number|null,
   *   autosaveIntervalMs?: number,
   *   logger?: { info: Function, warn: Function, error: Function },
   * }} config
   */
  constructor({ store, seed = null, autosaveIntervalMs = 60_000, logger = console }) {
    this.store = store;
    this.seed = seed;
    this.autosaveIntervalMs = autosaveIntervalMs;
    this.logger = logger;
    /** @type {object|null} */
    this.snapshot = null;
    this._autosaveTimer = null;
    this._dirty = false;
    /** @type {(() => void)|null} called before each flush to collect live state */
    this._collect = null;
  }

  /** Load and migrate the snapshot. Must be awaited before any accessor. */
  async init() {
    const { snapshot, applied, created } = await loadSnapshot(this.store, this.seed);
    this.snapshot = snapshot;
    if (created) {
      this.snapshot.meta.seed = this.seed;
      this._dirty = true;
    } else if (this.seed !== null && this.snapshot.meta.seed !== this.seed) {
      // Refusing here prevents silently regenerating a different world over
      // existing player edits.
      throw new Error(
        `world seed mismatch: save was created with "${this.snapshot.meta.seed}" but the server was started with "${this.seed}"`,
      );
    }
    if (applied.length) {
      this.logger.info?.(`[storage] migrated save to schema ${CURRENT_SCHEMA_VERSION}:`);
      for (const step of applied) this.logger.info?.(`  - ${step}`);
      this._dirty = true;
    }
    return this;
  }

  /** The seed recorded in the save file. */
  get worldSeed() {
    return this.snapshot?.meta?.seed ?? this.seed;
  }

  _requireLoaded() {
    if (!this.snapshot) throw new Error('GameStore.init() must be awaited before use');
  }

  // --------------------------------------------------------------- accounts

  /** @param {string} username */
  getAccount(username) {
    this._requireLoaded();
    return this.snapshot.accounts[username.toLowerCase()] ?? null;
  }

  /** @param {object} account must carry a `username` */
  putAccount(account) {
    this._requireLoaded();
    this.snapshot.accounts[account.username.toLowerCase()] = account;
    this._dirty = true;
    return account;
  }

  get accountCount() {
    this._requireLoaded();
    return Object.keys(this.snapshot.accounts).length;
  }

  // ---------------------------------------------------------------- players

  /** @param {string} playerId */
  getPlayer(playerId) {
    this._requireLoaded();
    return this.snapshot.players[playerId] ?? null;
  }

  /** @param {object} record must carry an `id` */
  putPlayer(record) {
    this._requireLoaded();
    this.snapshot.players[record.id] = record;
    this._dirty = true;
    return record;
  }

  /** @returns {object[]} */
  allPlayers() {
    this._requireLoaded();
    return Object.values(this.snapshot.players);
  }

  // ------------------------------------------------------------------ world

  /** @returns {{ chunks: object[], regrowth: object[] }} */
  getWorldState() {
    this._requireLoaded();
    return this.snapshot.world;
  }

  /** @param {{ chunks: object[], regrowth: object[] }} state */
  putWorldState(state) {
    this._requireLoaded();
    this.snapshot.world = state;
    this._dirty = true;
  }

  /** @returns {object[]} */
  getGroundItems() {
    this._requireLoaded();
    return this.snapshot.groundItems;
  }

  /** @param {object[]} items */
  putGroundItems(items) {
    this._requireLoaded();
    this.snapshot.groundItems = items;
    this._dirty = true;
  }

  // ------------------------------------------------------------------ flush

  /**
   * Register a callback that copies live in-memory state into the snapshot
   * right before it is written. The server uses this to capture the world diff
   * and connected players.
   * @param {() => void} collect
   */
  onCollect(collect) {
    this._collect = collect;
  }

  /** Mark the snapshot as needing a write. */
  markDirty() {
    this._dirty = true;
  }

  get dirty() {
    return this._dirty;
  }

  /**
   * Write the snapshot through the backend.
   * @param {{ force?: boolean }} [options]
   * @returns {Promise<boolean>} true when a write happened
   */
  async flush({ force = false } = {}) {
    this._requireLoaded();
    if (this._collect) this._collect();
    if (!this._dirty && !force) return false;
    this.snapshot.meta.savedAt = Date.now();
    await this.store.save(this.snapshot);
    this._dirty = false;
    return true;
  }

  /** Start the interval autosave. Safe to call twice. */
  startAutosave() {
    if (this._autosaveTimer || this.autosaveIntervalMs <= 0) return this;
    this._autosaveTimer = setInterval(() => {
      this.flush().catch((err) => this.logger.error?.('[storage] autosave failed:', err));
    }, this.autosaveIntervalMs);
    // Do not hold the event loop open just for autosave.
    this._autosaveTimer.unref?.();
    return this;
  }

  stopAutosave() {
    if (this._autosaveTimer) {
      clearInterval(this._autosaveTimer);
      this._autosaveTimer = null;
    }
    return this;
  }

  /** Stop autosaving, write one final time and close the backend. */
  async shutdown() {
    this.stopAutosave();
    await this.flush({ force: true });
    await this.store.close();
  }
}
