/**
 * Block targeting.
 *
 * Resolves which block the player is focused on. The primary method is the
 * shared voxel raycast (the same routine the server validates with); when the
 * ray misses — or when the crosshair is hidden and the player is not aiming at
 * anything — a proximity pass picks the nearest eligible block in front of the
 * player instead. That keeps "what am I about to interact with" well defined
 * whether or not a crosshair is drawn.
 */

import { raycast, directionFromAngles, distanceToBlockCenter } from '/src/world/raycast.js';
import { MAX_REACH } from '/src/core/constants.js';

/** How far the proximity fallback searches, in blocks. */
const PROXIMITY_RADIUS = 3;
/** Minimum cosine between the view direction and the candidate block. */
const PROXIMITY_MIN_FACING = 0.35;

export class TargetResolver {
  /**
   * @param {import('./world-view.js').ClientWorld} world
   * @param {import('/src/content/index.js').Content} content
   */
  constructor(world, content) {
    this.world = world;
    this.content = content;
    this.reach = MAX_REACH;
  }

  /**
   * @param {{ x: number, y: number, z: number }} eye
   * @param {number} yaw
   * @param {number} pitch
   * @param {{ proximityFallback?: boolean }} [options]
   * @returns {{
   *   x: number, y: number, z: number,
   *   block: number, blockName: string, def: object,
   *   adjacent: {x: number, y: number, z: number}|null,
   *   distance: number, via: 'ray'|'proximity',
   * }|null}
   */
  resolve(eye, yaw, pitch, { proximityFallback = true } = {}) {
    const direction = directionFromAngles(yaw, pitch);

    const hit = raycast({
      origin: eye,
      direction,
      maxDistance: this.reach,
      getBlock: this.world.getBlock,
      isHit: (blockId) => this._isTargetable(blockId),
    });

    if (hit) return this._describe(hit.x, hit.y, hit.z, hit.adjacent, hit.distance, 'ray');
    if (!proximityFallback) return null;

    const near = this._nearest(eye, direction);
    return near ? this._describe(near.x, near.y, near.z, null, near.distance, 'proximity') : null;
  }

  /** Blocks worth focusing: anything that is not air and not pass-through. */
  _isTargetable(blockId) {
    if (blockId === 0) return false;
    const def = this.content.block(blockId);
    if (!def) return false;
    return def.solid || def.interactable || def.replaceable === false;
  }

  /**
   * Nearest targetable block to the eye, restricted to the forward hemisphere
   * so the player never focuses something behind them.
   */
  _nearest(eye, direction) {
    const cx = Math.floor(eye.x);
    const cy = Math.floor(eye.y);
    const cz = Math.floor(eye.z);

    let best = null;
    for (let dy = -PROXIMITY_RADIUS; dy <= PROXIMITY_RADIUS; dy++) {
      for (let dz = -PROXIMITY_RADIUS; dz <= PROXIMITY_RADIUS; dz++) {
        for (let dx = -PROXIMITY_RADIUS; dx <= PROXIMITY_RADIUS; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          const z = cz + dz;
          if (!this._isTargetable(this.world.getBlock(x, y, z))) continue;

          const distance = distanceToBlockCenter(eye, x, y, z);
          if (distance > this.reach) continue;
          if (best && distance >= best.distance) continue;

          const toBlock = {
            x: x + 0.5 - eye.x,
            y: y + 0.5 - eye.y,
            z: z + 0.5 - eye.z,
          };
          const length = Math.hypot(toBlock.x, toBlock.y, toBlock.z) || 1;
          const facing =
            (toBlock.x * direction.x + toBlock.y * direction.y + toBlock.z * direction.z) / length;
          if (facing < PROXIMITY_MIN_FACING) continue;

          best = { x, y, z, distance };
        }
      }
    }
    return best;
  }

  _describe(x, y, z, adjacent, distance, via) {
    const block = this.world.getBlock(x, y, z);
    const def = this.content.block(block);
    return {
      x,
      y,
      z,
      block,
      blockName: def?.name ?? 'unknown',
      def,
      adjacent: adjacent ?? null,
      distance,
      via,
    };
  }
}
