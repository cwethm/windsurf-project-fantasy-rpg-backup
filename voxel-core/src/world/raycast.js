/**
 * Voxel raycasting.
 *
 * Amanatides & Woo grid traversal: walk the ray cell by cell instead of
 * sampling at fixed steps, so nothing is ever missed or hit twice. The same
 * function backs the client's crosshair highlight and the server's reach
 * validation, which is what keeps the two in agreement.
 */

import { CHUNK_HEIGHT } from '../core/constants.js';

/**
 * @typedef {object} RaycastHit
 * @property {number} x hit block X
 * @property {number} y hit block Y
 * @property {number} z hit block Z
 * @property {number} block block id that was hit
 * @property {{ x: number, y: number, z: number }} normal face normal pointing
 *   back towards the ray origin
 * @property {{ x: number, y: number, z: number }} adjacent the empty block
 *   against the hit face; where a placement would go
 * @property {number} distance distance travelled along the ray
 */

/**
 * Cast a ray through the voxel grid.
 *
 * @param {{
 *   origin: { x: number, y: number, z: number },
 *   direction: { x: number, y: number, z: number },
 *   maxDistance?: number,
 *   getBlock: (x: number, y: number, z: number) => number,
 *   isHit?: (blockId: number, x: number, y: number, z: number) => boolean,
 * }} params
 * @returns {RaycastHit|null}
 */
export function raycast({ origin, direction, maxDistance = 5, getBlock, isHit }) {
  const dirLength = Math.hypot(direction.x, direction.y, direction.z);
  if (dirLength === 0 || !Number.isFinite(dirLength)) return null;

  const dx = direction.x / dirLength;
  const dy = direction.y / dirLength;
  const dz = direction.z / dirLength;
  const hitTest = isHit ?? ((blockId) => blockId !== 0);

  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const stepZ = Math.sign(dz);

  // Distance along the ray to the next grid boundary on each axis.
  const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dy);
  const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / dz);

  const boundary = (pos, cell, step) => {
    if (step > 0) return cell + 1 - pos;
    if (step < 0) return pos - cell;
    return Infinity;
  };

  let tMaxX = stepX === 0 ? Infinity : boundary(origin.x, x, stepX) * tDeltaX;
  let tMaxY = stepY === 0 ? Infinity : boundary(origin.y, y, stepY) * tDeltaY;
  let tMaxZ = stepZ === 0 ? Infinity : boundary(origin.z, z, stepZ) * tDeltaZ;

  let normal = { x: 0, y: 0, z: 0 };
  let distance = 0;

  // The block the ray starts inside counts as a hit (standing in a bush).
  if (y >= 0 && y < CHUNK_HEIGHT) {
    const startBlock = getBlock(x, y, z);
    if (hitTest(startBlock, x, y, z)) {
      return {
        x, y, z,
        block: startBlock,
        normal,
        adjacent: { x, y, z },
        distance: 0,
      };
    }
  }

  while (distance <= maxDistance) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      distance = tMaxX;
      tMaxX += tDeltaX;
      normal = { x: -stepX, y: 0, z: 0 };
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      distance = tMaxY;
      tMaxY += tDeltaY;
      normal = { x: 0, y: -stepY, z: 0 };
    } else {
      z += stepZ;
      distance = tMaxZ;
      tMaxZ += tDeltaZ;
      normal = { x: 0, y: 0, z: -stepZ };
    }

    if (distance > maxDistance) break;
    if (y < 0 || y >= CHUNK_HEIGHT) {
      // Leaving vertically can only mean "nothing more to hit" when the ray
      // is also heading away from the world.
      if ((y < 0 && stepY <= 0) || (y >= CHUNK_HEIGHT && stepY >= 0)) break;
      continue;
    }

    const blockId = getBlock(x, y, z);
    if (hitTest(blockId, x, y, z)) {
      return {
        x, y, z,
        block: blockId,
        normal,
        adjacent: { x: x + normal.x, y: y + normal.y, z: z + normal.z },
        distance,
      };
    }
  }

  return null;
}

/**
 * Build a direction vector from yaw/pitch in radians.
 *
 * Yaw 0 looks down -Z (the Three.js default camera forward), yaw increases
 * counter-clockwise, pitch is positive looking up.
 */
export function directionFromAngles(yaw, pitch) {
  const cosPitch = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cosPitch,
  };
}

/**
 * Squared distance between a point and the centre of a block. Used for the
 * proximity half of "raycast + proximity" target selection.
 */
export function distanceToBlockCenter(point, blockX, blockY, blockZ) {
  const dx = point.x - (blockX + 0.5);
  const dy = point.y - (blockY + 0.5);
  const dz = point.z - (blockZ + 0.5);
  return Math.hypot(dx, dy, dz);
}
