/**
 * Coordinate conversions between block, chunk and region space.
 *
 * All helpers use floor division so negative coordinates behave correctly;
 * JavaScript's `%` and `/` do not, and getting this wrong is the classic
 * source of "the world tears along x = 0" bugs.
 */

import { CHUNK_SIZE, CHUNK_HEIGHT, REGION_SIZE_CHUNKS } from '../core/constants.js';

/** @param {number} blockCoord */
export function blockToChunk(blockCoord) {
  return Math.floor(blockCoord / CHUNK_SIZE);
}

/** @param {number} blockCoord */
export function blockToLocal(blockCoord) {
  return ((blockCoord % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}

/** @param {number} chunkCoord */
export function chunkToBlock(chunkCoord) {
  return chunkCoord * CHUNK_SIZE;
}

/** @param {number} chunkCoord */
export function chunkToRegion(chunkCoord) {
  return Math.floor(chunkCoord / REGION_SIZE_CHUNKS);
}

/**
 * Stable string key for a chunk, used by maps and save files.
 * @param {number} chunkX
 * @param {number} chunkZ
 */
export function chunkKey(chunkX, chunkZ) {
  return `${chunkX},${chunkZ}`;
}

/**
 * Parse a chunk key back into coordinates.
 * @param {string} key
 * @returns {{ chunkX: number, chunkZ: number }}
 */
export function parseChunkKey(key) {
  const [x, z] = key.split(',');
  return { chunkX: Number(x), chunkZ: Number(z) };
}

/** Stable string key for a region file. */
export function regionKey(regionX, regionZ) {
  return `r.${regionX}.${regionZ}`;
}

/** Stable string key for a block position. */
export function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

/** @param {string} key */
export function parseBlockKey(key) {
  const [x, y, z] = key.split(',');
  return { x: Number(x), y: Number(y), z: Number(z) };
}

/**
 * Index into a chunk's flat block array.
 * Layout is y-major so vertical columns are contiguous-ish and meshing walks
 * X/Z planes cheaply.
 * @param {number} localX 0..CHUNK_SIZE-1
 * @param {number} y 0..CHUNK_HEIGHT-1
 * @param {number} localZ 0..CHUNK_SIZE-1
 */
export function blockIndex(localX, y, localZ) {
  return y * CHUNK_SIZE * CHUNK_SIZE + localZ * CHUNK_SIZE + localX;
}

/** Is a Y coordinate inside the world's vertical bounds? */
export function isValidY(y) {
  return Number.isInteger(y) && y >= 0 && y < CHUNK_HEIGHT;
}

/**
 * Chebyshev distance in chunks, the natural metric for square view distances.
 */
export function chunkDistance(ax, az, bx, bz) {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

/**
 * Every chunk coordinate within `radius` of a centre chunk, nearest first so
 * streaming prioritises what the player is standing on.
 * @param {number} centerX
 * @param {number} centerZ
 * @param {number} radius
 * @returns {{ chunkX: number, chunkZ: number }[]}
 */
export function chunksInRadius(centerX, centerZ, radius) {
  const out = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      out.push({ chunkX: centerX + dx, chunkZ: centerZ + dz });
    }
  }
  out.sort(
    (a, b) =>
      chunkDistance(a.chunkX, a.chunkZ, centerX, centerZ) -
      chunkDistance(b.chunkX, b.chunkZ, centerX, centerZ),
  );
  return out;
}

export { CHUNK_SIZE, CHUNK_HEIGHT, REGION_SIZE_CHUNKS };
