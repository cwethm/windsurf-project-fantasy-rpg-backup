/**
 * Authoritative voxel world.
 *
 * Chunks are regenerated from the seed on demand and a *diff* of player edits
 * is replayed over the top. Only the diff is ever persisted, so a world's save
 * size tracks how much players changed rather than how far they walked.
 *
 * Every mutation goes through `setBlock` / `setTileEntity`, which emit events
 * on the shared bus. Broadcasting, persistence and regrowth all subscribe
 * rather than being called directly.
 */

import { CHUNK_HEIGHT } from '../core/constants.js';
import { EVENTS, EventBus } from '../core/event-bus.js';
import { Random } from '../core/rng.js';
import { Chunk } from './chunk.js';
import {
  blockKey,
  parseBlockKey,
  blockToChunk,
  blockToLocal,
  chunkKey,
  parseChunkKey,
  isValidY,
} from './coords.js';

export class World {
  /**
   * @param {{
   *   generator: import('./generator.js').WorldGenerator,
   *   content: import('../content/index.js').Content,
   *   bus?: EventBus,
   * }} config
   */
  constructor({ generator, content, bus }) {
    this.generator = generator;
    this.content = content;
    this.bus = bus ?? new EventBus();

    /** @type {Map<string, Chunk>} loaded chunks by "x,z" */
    this.chunks = new Map();
    /** @type {Map<string, Map<string, number>>} chunk key -> local block key -> block id */
    this.diffs = new Map();
    /** @type {Map<string, Map<string, object>>} chunk key -> local block key -> tile entity */
    this.tileEntityDiffs = new Map();
    /** @type {Set<string>} chunk keys whose diff changed since the last save */
    this.dirtyChunks = new Set();
    /** @type {{ x: number, y: number, z: number, block: number, dueAt: number }[]} */
    this.regrowthQueue = [];
  }

  // ----------------------------------------------------------------- chunks

  /**
   * Fetch a chunk, generating and applying its diff if it is not resident.
   * @param {number} chunkX
   * @param {number} chunkZ
   * @returns {Chunk}
   */
  getChunk(chunkX, chunkZ) {
    const key = chunkKey(chunkX, chunkZ);
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;

    chunk = this.generator.generateChunk(chunkX, chunkZ);
    this._applyDiff(chunk);
    this.chunks.set(key, chunk);
    this.bus.emit(EVENTS.CHUNK_LOADED, { chunkX, chunkZ, chunk });
    return chunk;
  }

  /** @param {number} chunkX @param {number} chunkZ */
  isLoaded(chunkX, chunkZ) {
    return this.chunks.has(chunkKey(chunkX, chunkZ));
  }

  /**
   * Evict a chunk from memory. Edits survive because they live in the diff,
   * not in the chunk.
   * @param {number} chunkX
   * @param {number} chunkZ
   */
  unloadChunk(chunkX, chunkZ) {
    const key = chunkKey(chunkX, chunkZ);
    if (!this.chunks.delete(key)) return false;
    this.bus.emit(EVENTS.CHUNK_UNLOADED, { chunkX, chunkZ });
    return true;
  }

  /**
   * Unload every resident chunk that no key in `keepKeys` refers to.
   * @param {Set<string>} keepKeys chunk keys to retain
   * @returns {number} number of chunks unloaded
   */
  unloadChunksExcept(keepKeys) {
    let unloaded = 0;
    for (const key of [...this.chunks.keys()]) {
      if (keepKeys.has(key)) continue;
      const { chunkX, chunkZ } = parseChunkKey(key);
      if (this.unloadChunk(chunkX, chunkZ)) unloaded += 1;
    }
    return unloaded;
  }

  _applyDiff(chunk) {
    const blocks = this.diffs.get(chunk.key);
    if (blocks) {
      for (const [key, blockId] of blocks) {
        const { x, y, z } = parseBlockKey(key);
        chunk.set(x, y, z, blockId);
      }
      chunk.dirty = true;
    }
    const tileEntities = this.tileEntityDiffs.get(chunk.key);
    if (tileEntities) {
      for (const [key, data] of tileEntities) {
        chunk.tileEntities.set(key, structuredClone(data));
      }
      chunk.dirty = true;
    }
  }

  // ----------------------------------------------------------------- blocks

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number} block id; air for out-of-bounds Y
   */
  getBlock(x, y, z) {
    if (!isValidY(y)) return 0;
    const chunk = this.getChunk(blockToChunk(x), blockToChunk(z));
    return chunk.get(blockToLocal(x), y, blockToLocal(z));
  }

  /** @returns {object|undefined} the block definition at a position */
  getBlockDef(x, y, z) {
    return this.content.block(this.getBlock(x, y, z));
  }

  /** Is the block at this position solid (blocks movement and raycasts)? */
  isSolid(x, y, z) {
    return this.content.isSolid(this.getBlock(x, y, z));
  }

  /** Can a placement overwrite the block at this position? */
  isReplaceable(x, y, z) {
    return this.content.isReplaceable(this.getBlock(x, y, z));
  }

  /**
   * Set a block. This is the single write path for terrain.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} blockId
   * @param {{ source?: string, actorId?: string|null }} [meta] free-form
   *   provenance forwarded to subscribers (e.g. 'harvest', 'place', 'regrow')
   * @returns {boolean} true when the world changed
   */
  setBlock(x, y, z, blockId, meta = {}) {
    if (!isValidY(y)) return false;
    if (!this.content.blocks.has(blockId)) {
      throw new Error(`setBlock called with unknown block id ${blockId}`);
    }

    const chunkX = blockToChunk(x);
    const chunkZ = blockToChunk(z);
    const chunk = this.getChunk(chunkX, chunkZ);
    const lx = blockToLocal(x);
    const lz = blockToLocal(z);
    const previous = chunk.get(lx, y, lz);
    if (previous === blockId) return false;

    chunk.set(lx, y, lz, blockId);
    chunk.dirty = true;
    this._recordDiff(chunk.key, lx, y, lz, blockId);

    // A block that no longer exists cannot keep its tile entity.
    const previousDef = this.content.block(previous);
    const nextDef = this.content.block(blockId);
    if (previousDef?.tileEntity && previousDef.tileEntity !== nextDef?.tileEntity) {
      this.setTileEntity(x, y, z, null, { source: 'block-replaced' });
    }

    this.bus.emit(EVENTS.BLOCK_CHANGED, {
      x,
      y,
      z,
      chunkX,
      chunkZ,
      block: blockId,
      previous,
      source: meta.source ?? 'unknown',
      actorId: meta.actorId ?? null,
    });
    return true;
  }

  _recordDiff(key, lx, y, lz, blockId) {
    let blocks = this.diffs.get(key);
    if (!blocks) {
      blocks = new Map();
      this.diffs.set(key, blocks);
    }
    blocks.set(blockKey(lx, y, lz), blockId);
    this.dirtyChunks.add(key);
  }

  // ---------------------------------------------------------- tile entities

  /**
   * Tile-entity data attached to a block (container contents, door state...).
   * @returns {object|null}
   */
  getTileEntity(x, y, z) {
    if (!isValidY(y)) return null;
    const chunk = this.getChunk(blockToChunk(x), blockToChunk(z));
    return chunk.getTileEntity(blockToLocal(x), y, blockToLocal(z));
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {object|null} data pass null to clear
   * @param {{ source?: string, actorId?: string|null }} [meta]
   */
  setTileEntity(x, y, z, data, meta = {}) {
    if (!isValidY(y)) return false;
    const chunkX = blockToChunk(x);
    const chunkZ = blockToChunk(z);
    const chunk = this.getChunk(chunkX, chunkZ);
    const lx = blockToLocal(x);
    const lz = blockToLocal(z);
    chunk.setTileEntity(lx, y, lz, data);
    chunk.dirty = true;

    let entities = this.tileEntityDiffs.get(chunk.key);
    if (!entities) {
      entities = new Map();
      this.tileEntityDiffs.set(chunk.key, entities);
    }
    const key = blockKey(lx, y, lz);
    if (data === null || data === undefined) entities.delete(key);
    else entities.set(key, structuredClone(data));
    this.dirtyChunks.add(chunk.key);

    this.bus.emit(EVENTS.TILE_ENTITY_CHANGED, {
      x,
      y,
      z,
      chunkX,
      chunkZ,
      data: data ?? null,
      source: meta.source ?? 'unknown',
      actorId: meta.actorId ?? null,
    });
    return true;
  }

  /**
   * Fetch a tile entity, creating it from the block definition's declared kind
   * when the block has one but no state yet.
   * @param {number} x @param {number} y @param {number} z
   * @param {() => object} factory
   */
  ensureTileEntity(x, y, z, factory) {
    const existing = this.getTileEntity(x, y, z);
    if (existing) return existing;
    const created = factory();
    this.setTileEntity(x, y, z, created, { source: 'ensure' });
    return this.getTileEntity(x, y, z);
  }

  // --------------------------------------------------------------- surfaces

  /**
   * Highest non-air Y at a column within the loaded/generated world.
   * @returns {number} -1 when the column is entirely air
   */
  heightAt(x, z) {
    const chunk = this.getChunk(blockToChunk(x), blockToChunk(z));
    return chunk.heightAt(blockToLocal(x), blockToLocal(z));
  }

  /**
   * A position a player can safely be placed at above a column.
   * @returns {{ x: number, y: number, z: number }}
   */
  surfacePosition(x, z) {
    const top = this.heightAt(x, z);
    const y = Math.min(CHUNK_HEIGHT - 2, Math.max(top + 1, 1));
    return { x: x + 0.5, y, z: z + 0.5 };
  }

  // --------------------------------------------------------------- regrowth

  /**
   * Queue a harvested node to come back later. Cheap now, and the hook that
   * later enables crops and cultivation.
   * @param {number} x @param {number} y @param {number} z
   * @param {number} blockId block to restore
   * @param {number} dueAt epoch milliseconds
   */
  scheduleRegrowth(x, y, z, blockId, dueAt) {
    this.regrowthQueue.push({ x, y, z, block: blockId, dueAt });
    this.bus.emit(EVENTS.REGROWTH_SCHEDULED, { x, y, z, block: blockId, dueAt });
  }

  /**
   * Advance timed world state. Call from the server's scheduled tick.
   * @param {number} now epoch milliseconds
   * @returns {number} number of nodes that regrew
   */
  tick(now = Date.now()) {
    if (this.regrowthQueue.length === 0) return 0;
    const pending = [];
    let regrew = 0;
    for (const entry of this.regrowthQueue) {
      if (entry.dueAt > now) {
        pending.push(entry);
        continue;
      }
      // Only regrow into empty space; a player may have built here meanwhile.
      if (this.getBlock(entry.x, entry.y, entry.z) === 0) {
        this.setBlock(entry.x, entry.y, entry.z, entry.block, { source: 'regrow' });
        this.bus.emit(EVENTS.REGROWTH_COMPLETED, entry);
        regrew += 1;
      }
    }
    this.regrowthQueue = pending;
    return regrew;
  }

  // ------------------------------------------------------------ persistence

  /**
   * Snapshot the world's persistent state: chunk diffs, tile entities and the
   * regrowth queue. Pristine chunks are intentionally absent.
   */
  exportState() {
    const chunks = [];
    const keys = new Set([...this.diffs.keys(), ...this.tileEntityDiffs.keys()]);
    for (const key of keys) {
      const { chunkX, chunkZ } = parseChunkKey(key);
      chunks.push({
        chunkX,
        chunkZ,
        blocks: Object.fromEntries(this.diffs.get(key) ?? []),
        tileEntities: Object.fromEntries(this.tileEntityDiffs.get(key) ?? []),
      });
    }
    return { chunks, regrowth: this.regrowthQueue.map((entry) => ({ ...entry })) };
  }

  /**
   * Restore a snapshot produced by `exportState`. Must be called before chunks
   * are first requested, or already-resident chunks will not see the diff.
   * @param {{ chunks?: object[], regrowth?: object[] }} state
   */
  importState(state) {
    if (!state) return;
    for (const record of state.chunks ?? []) {
      const key = chunkKey(record.chunkX, record.chunkZ);
      const blocks = new Map(Object.entries(record.blocks ?? {}).map(([k, v]) => [k, Number(v)]));
      if (blocks.size > 0) this.diffs.set(key, blocks);
      const entities = new Map(Object.entries(record.tileEntities ?? {}));
      if (entities.size > 0) this.tileEntityDiffs.set(key, entities);

      // Re-apply to any chunk that is already resident.
      const chunk = this.chunks.get(key);
      if (chunk) this._applyDiff(chunk);
    }
    this.regrowthQueue = (state.regrowth ?? []).map((entry) => ({ ...entry }));
    this.dirtyChunks.clear();
  }

  /** Chunk keys whose diffs changed since the last `clearDirty()`. */
  takeDirtyChunkKeys() {
    const keys = [...this.dirtyChunks];
    this.dirtyChunks.clear();
    return keys;
  }

  /** Deterministic RNG for a world position, used for drops and jitter. */
  randomAt(x, y, z, salt = 0) {
    return new Random(this.generator.seed.value ^ (x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ salt);
  }
}
