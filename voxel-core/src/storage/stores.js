/**
 * Storage backends.
 *
 * A backend only has to move one JSON-serialisable snapshot in and out. That
 * keeps the rest of the engine storage-agnostic: swapping the bundled JSON
 * file store for SQLite or Postgres means implementing two methods.
 */

import { mkdir, readFile, rename, writeFile, copyFile, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

import { emptySnapshot, migrate } from './migrations.js';

/**
 * Backend contract.
 * @abstract
 */
export class Store {
  /** @returns {Promise<object|null>} raw snapshot, or null when empty */
  async load() {
    throw new Error('Store.load() must be implemented');
  }

  /** @param {object} _snapshot @returns {Promise<void>} */
  async save(_snapshot) {
    throw new Error('Store.save() must be implemented');
  }

  /** Release any resources. */
  async close() {}
}

/** In-memory backend. Used by tests and for ephemeral servers. */
export class MemoryStore extends Store {
  /** @param {object|null} [initial] */
  constructor(initial = null) {
    super();
    this.snapshot = initial ? structuredClone(initial) : null;
    this.saveCount = 0;
  }

  async load() {
    return this.snapshot ? structuredClone(this.snapshot) : null;
  }

  async save(snapshot) {
    this.snapshot = structuredClone(snapshot);
    this.saveCount += 1;
  }
}

/**
 * JSON file backend with atomic writes.
 *
 * Writes go to a temporary file and are renamed into place, so a crash mid-save
 * leaves the previous save intact rather than a truncated file. The previous
 * save is also kept as `<file>.bak`.
 */
export class JsonFileStore extends Store {
  /**
   * @param {string} filePath
   * @param {{ pretty?: boolean }} [options]
   */
  constructor(filePath, { pretty = false } = {}) {
    super();
    this.filePath = filePath;
    this.pretty = pretty;
    this.saveCount = 0;
    /** @type {Promise<void>} serialises concurrent saves */
    this._writeChain = Promise.resolve();
  }

  async load() {
    try {
      const text = await readFile(this.filePath, 'utf8');
      return JSON.parse(text);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      if (err instanceof SyntaxError) {
        // A corrupt primary file should not lose the whole world.
        try {
          const backup = await readFile(`${this.filePath}.bak`, 'utf8');
          return JSON.parse(backup);
        } catch {
          throw new Error(`save file ${this.filePath} is corrupt and no usable backup exists`);
        }
      }
      throw err;
    }
  }

  async save(snapshot) {
    // Chain writes so overlapping autosaves cannot interleave into the temp
    // file and produce a corrupt rename.
    this._writeChain = this._writeChain.then(() => this._write(snapshot), () => this._write(snapshot));
    return this._writeChain;
  }

  async _write(snapshot) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    const text = this.pretty ? JSON.stringify(snapshot, null, 2) : JSON.stringify(snapshot);
    await writeFile(tmpPath, text, 'utf8');

    try {
      await copyFile(this.filePath, `${this.filePath}.bak`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    await rename(tmpPath, this.filePath);
    this.saveCount += 1;
  }

  async close() {
    await this._writeChain;
    try {
      await unlink(`${this.filePath}.tmp`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

/**
 * Load a snapshot through a backend and migrate it to the current schema.
 * @param {Store} store
 * @param {string|number|null} seed used when the store is empty
 * @returns {Promise<{ snapshot: object, applied: string[], created: boolean }>}
 */
export async function loadSnapshot(store, seed = null) {
  const raw = await store.load();
  if (!raw) {
    return { snapshot: emptySnapshot(seed), applied: [], created: true };
  }
  const { data, applied } = migrate(raw);
  return { snapshot: data, applied, created: false };
}
