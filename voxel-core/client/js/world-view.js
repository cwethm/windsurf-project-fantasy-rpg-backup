/**
 * Client-side mirror of the world.
 *
 * Holds the chunks the server has streamed and exposes the same
 * `getBlock` / `isSolid` surface the shared physics and raycast helpers
 * expect, so movement prediction and block targeting run the exact code the
 * server runs.
 */

import { Chunk } from '/src/world/chunk.js';
import { chunkKey, blockToChunk, blockToLocal, blockIndex } from '/src/world/coords.js';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '/src/core/constants.js';

export class ClientWorld {
  /** @param {import('/src/content/index.js').Content} content */
  constructor(content) {
    this.content = content;
    /** @type {Map<string, Chunk>} */
    this.chunks = new Map();
    /** @type {Set<string>} chunk keys whose mesh is stale */
    this.dirty = new Set();
    this.isSolid = this.isSolid.bind(this);
    this.getBlock = this.getBlock.bind(this);
  }

  /** @param {ReturnType<Chunk['toWire']>} wire */
  loadChunk(wire) {
    const chunk = Chunk.fromWire(wire);
    const key = chunkKey(chunk.chunkX, chunk.chunkZ);
    this.chunks.set(key, chunk);
    this.dirty.add(key);
    this._markNeighbours(chunk.chunkX, chunk.chunkZ);
    return chunk;
  }

  /**
   * @param {number} chunkX
   * @param {number} chunkZ
   */
  unloadChunk(chunkX, chunkZ) {
    const key = chunkKey(chunkX, chunkZ);
    this.chunks.delete(key);
    this.dirty.delete(key);
    return key;
  }

  /** @param {number} x @param {number} y @param {number} z */
  getBlock(x, y, z) {
    const by = Math.floor(y);
    if (by < 0 || by >= CHUNK_HEIGHT) return 0;
    const chunk = this.chunks.get(chunkKey(blockToChunk(x), blockToChunk(z)));
    if (!chunk) return 0;
    return chunk.blocks[blockIndex(blockToLocal(x), by, blockToLocal(z))];
  }

  /** @param {number} x @param {number} y @param {number} z */
  setBlock(x, y, z, blockId) {
    const by = Math.floor(y);
    if (by < 0 || by >= CHUNK_HEIGHT) return false;
    const chunkX = blockToChunk(x);
    const chunkZ = blockToChunk(z);
    const localX = blockToLocal(x);
    const localZ = blockToLocal(z);
    const key = chunkKey(chunkX, chunkZ);
    const chunk = this.chunks.get(key);
    if (!chunk) return false;
    chunk.blocks[blockIndex(localX, by, localZ)] = blockId;
    this.dirty.add(key);
    // A block on a chunk border changes the neighbour's face culling too.
    if (localX === 0 || localX === CHUNK_SIZE - 1 || localZ === 0 || localZ === CHUNK_SIZE - 1) {
      this._markNeighbours(chunkX, chunkZ);
    }
    return true;
  }

  /** @param {number} x @param {number} y @param {number} z */
  isSolid(x, y, z) {
    return this.content.isSolid(this.getBlock(x, y, z));
  }

  /** True when a chunk covering this column has been received. */
  hasChunkAt(x, z) {
    return this.chunks.has(chunkKey(blockToChunk(x), blockToChunk(z)));
  }

  /** @param {{x: number, y: number, z: number}} position @param {object|null} data */
  setTileEntity({ x, y, z }, data) {
    const chunk = this.chunks.get(chunkKey(blockToChunk(x), blockToChunk(z)));
    if (!chunk) return false;
    chunk.setTileEntity(blockToLocal(x), y, blockToLocal(z), data);
    return true;
  }

  _markNeighbours(chunkX, chunkZ) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = chunkKey(chunkX + dx, chunkZ + dz);
      if (this.chunks.has(key)) this.dirty.add(key);
    }
  }

  /** Take (and clear) the set of chunk keys needing a remesh. */
  takeDirty() {
    const keys = [...this.dirty];
    this.dirty.clear();
    return keys;
  }
}
