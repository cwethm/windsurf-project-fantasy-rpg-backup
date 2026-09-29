/**
 * Chunk storage.
 *
 * A chunk owns a flat `Uint16Array` of block ids plus a small map of tile
 * entities (block state that does not fit in 16 bits: container contents, open
 * or closed doors, lit torches).
 *
 * Chunks are *never* persisted whole. They are regenerated from the world seed
 * and replayed against a diff of player edits, which keeps save files
 * proportional to what players actually changed rather than to world size.
 */

import { CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_VOLUME } from '../core/constants.js';
import { blockIndex, chunkKey, blockKey, isValidY } from './coords.js';

export class Chunk {
  /**
   * @param {number} chunkX
   * @param {number} chunkZ
   * @param {Uint16Array} [blocks]
   */
  constructor(chunkX, chunkZ, blocks) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.key = chunkKey(chunkX, chunkZ);
    this.blocks = blocks ?? new Uint16Array(CHUNK_VOLUME);
    /** @type {Map<string, object>} local "x,y,z" -> tile entity data */
    this.tileEntities = new Map();
    /** Bumped on every edit so clients can cheaply detect staleness. */
    this.revision = 0;
    /** True once at least one player edit has been applied. */
    this.dirty = false;
  }

  /**
   * @param {number} localX
   * @param {number} y
   * @param {number} localZ
   * @returns {number} block id, 0 (air) when out of bounds
   */
  get(localX, y, localZ) {
    if (!isValidY(y) || localX < 0 || localX >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE) {
      return 0;
    }
    return this.blocks[blockIndex(localX, y, localZ)];
  }

  /**
   * @param {number} localX
   * @param {number} y
   * @param {number} localZ
   * @param {number} blockId
   * @returns {boolean} true when the chunk actually changed
   */
  set(localX, y, localZ, blockId) {
    if (!isValidY(y) || localX < 0 || localX >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE) {
      return false;
    }
    const index = blockIndex(localX, y, localZ);
    if (this.blocks[index] === blockId) return false;
    this.blocks[index] = blockId;
    this.revision += 1;
    return true;
  }

  /**
   * Highest non-air block in a column, or -1 when the column is empty.
   * @param {number} localX
   * @param {number} localZ
   */
  heightAt(localX, localZ) {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (this.blocks[blockIndex(localX, y, localZ)] !== 0) return y;
    }
    return -1;
  }

  /** @param {number} localX @param {number} y @param {number} localZ */
  getTileEntity(localX, y, localZ) {
    return this.tileEntities.get(blockKey(localX, y, localZ)) ?? null;
  }

  /**
   * @param {number} localX
   * @param {number} y
   * @param {number} localZ
   * @param {object|null} data passing null removes the tile entity
   */
  setTileEntity(localX, y, localZ, data) {
    const key = blockKey(localX, y, localZ);
    if (data === null || data === undefined) this.tileEntities.delete(key);
    else this.tileEntities.set(key, data);
    this.revision += 1;
  }

  /**
   * Serialise for the wire. Block data is sent as a plain array so it survives
   * `JSON.stringify`; callers that need bandwidth can swap in a binary codec
   * without touching the rest of the engine.
   */
  toJSON() {
    return {
      chunkX: this.chunkX,
      chunkZ: this.chunkZ,
      revision: this.revision,
      blocks: Array.from(this.blocks),
      tileEntities: Object.fromEntries(this.tileEntities),
    };
  }

  /** @param {ReturnType<Chunk['toJSON']>} json */
  static fromJSON(json) {
    const chunk = new Chunk(json.chunkX, json.chunkZ, Uint16Array.from(json.blocks));
    chunk.revision = json.revision ?? 0;
    for (const [key, value] of Object.entries(json.tileEntities ?? {})) {
      chunk.tileEntities.set(key, value);
    }
    return chunk;
  }

  /**
   * Serialise for the network. Voxel terrain is overwhelmingly runs of the
   * same block, so run-length encoding turns a 16 KiB array into a few hundred
   * numbers without needing a binary codec.
   */
  toWire() {
    return {
      chunkX: this.chunkX,
      chunkZ: this.chunkZ,
      revision: this.revision,
      rle: rleEncode(this.blocks),
      tileEntities: Object.fromEntries(this.tileEntities),
    };
  }

  /** @param {ReturnType<Chunk['toWire']>} json */
  static fromWire(json) {
    const chunk = new Chunk(json.chunkX, json.chunkZ, rleDecode(json.rle, CHUNK_VOLUME));
    chunk.revision = json.revision ?? 0;
    for (const [key, value] of Object.entries(json.tileEntities ?? {})) {
      chunk.tileEntities.set(key, value);
    }
    return chunk;
  }
}

/**
 * Run-length encode a block array into `[value, count, value, count, ...]`.
 * @param {ArrayLike<number>} blocks
 * @returns {number[]}
 */
export function rleEncode(blocks) {
  const out = [];
  if (blocks.length === 0) return out;
  let current = blocks[0];
  let run = 1;
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i] === current) {
      run += 1;
      continue;
    }
    out.push(current, run);
    current = blocks[i];
    run = 1;
  }
  out.push(current, run);
  return out;
}

/**
 * Inverse of `rleEncode`.
 * @param {number[]} pairs
 * @param {number} length expected output length
 * @returns {Uint16Array}
 */
export function rleDecode(pairs, length) {
  const out = new Uint16Array(length);
  let cursor = 0;
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const value = pairs[i];
    const run = pairs[i + 1];
    const end = Math.min(length, cursor + run);
    out.fill(value, cursor, end);
    cursor = end;
    if (cursor >= length) break;
  }
  return out;
}
