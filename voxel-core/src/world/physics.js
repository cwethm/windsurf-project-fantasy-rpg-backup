/**
 * Axis-aligned player physics.
 *
 * The same integrator runs on the client (for prediction) and on the server
 * (for validation), so both agree on where a player can be. Movement is
 * resolved one axis at a time, which gives clean wall sliding and avoids
 * tunnelling at normal speeds.
 */

import {
  GRAVITY,
  TERMINAL_VELOCITY,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  CHUNK_HEIGHT,
} from '../core/constants.js';

const EPSILON = 1e-4;

/**
 * Does the player's box, positioned at `(x, y, z)` (feet centre), overlap any
 * solid block?
 * @param {(x: number, y: number, z: number) => boolean} isSolid
 */
export function collides(isSolid, x, y, z, width = PLAYER_WIDTH, height = PLAYER_HEIGHT) {
  const half = width / 2;
  const minX = Math.floor(x - half + EPSILON);
  const maxX = Math.floor(x + half - EPSILON);
  const minY = Math.floor(y + EPSILON);
  const maxY = Math.floor(y + height - EPSILON);
  const minZ = Math.floor(z - half + EPSILON);
  const maxZ = Math.floor(z + half - EPSILON);

  for (let bx = minX; bx <= maxX; bx++) {
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        if (by < 0) return true;
        if (by >= CHUNK_HEIGHT) continue;
        if (isSolid(bx, by, bz)) return true;
      }
    }
  }
  return false;
}

/**
 * Integrate one physics step.
 *
 * @param {{
 *   position: { x: number, y: number, z: number },
 *   velocity: { x: number, y: number, z: number },
 *   onGround?: boolean,
 * }} state mutated in place is avoided; a new state is returned
 * @param {{
 *   dt: number,
 *   isSolid: (x: number, y: number, z: number) => boolean,
 *   gravity?: number,
 *   width?: number,
 *   height?: number,
 * }} options
 * @returns {{ position: object, velocity: object, onGround: boolean }}
 */
export function stepPhysics(state, { dt, isSolid, gravity = GRAVITY, width = PLAYER_WIDTH, height = PLAYER_HEIGHT }) {
  const position = { ...state.position };
  const velocity = { ...state.velocity };

  velocity.y = Math.max(TERMINAL_VELOCITY, velocity.y + gravity * dt);

  let onGround = false;

  // X axis
  if (velocity.x !== 0) {
    const nextX = position.x + velocity.x * dt;
    if (collides(isSolid, nextX, position.y, position.z, width, height)) {
      velocity.x = 0;
    } else {
      position.x = nextX;
    }
  }

  // Z axis
  if (velocity.z !== 0) {
    const nextZ = position.z + velocity.z * dt;
    if (collides(isSolid, position.x, position.y, nextZ, width, height)) {
      velocity.z = 0;
    } else {
      position.z = nextZ;
    }
  }

  // Y axis last, so landing is detected after horizontal motion resolved.
  if (velocity.y !== 0) {
    const nextY = position.y + velocity.y * dt;
    if (collides(isSolid, position.x, nextY, position.z, width, height)) {
      if (velocity.y < 0) {
        onGround = true;
        position.y = Math.floor(position.y) + EPSILON;
      }
      velocity.y = 0;
    } else {
      position.y = nextY;
    }
  }

  if (!onGround) {
    onGround = collides(isSolid, position.x, position.y - 2 * EPSILON, position.z, width, height);
  }

  return { position, velocity, onGround };
}

/**
 * Find the lowest Y at or above `startY` where the player box fits and is
 * supported. Used when spawning or teleporting so players never wake up inside
 * terrain.
 */
export function resolveSpawnY(isSolid, x, z, startY, width = PLAYER_WIDTH, height = PLAYER_HEIGHT) {
  for (let y = Math.max(1, Math.floor(startY)); y < CHUNK_HEIGHT - Math.ceil(height); y++) {
    if (!collides(isSolid, x, y, z, width, height)) return y;
  }
  return CHUNK_HEIGHT - Math.ceil(height) - 1;
}

/**
 * Validate a client-claimed position against the last accepted one.
 *
 * The server never trusts a position outright: a move is accepted only if it
 * is physically reachable in the elapsed time and does not end inside terrain.
 *
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateMove(previous, next, elapsedSeconds, maxSpeed, isSolid, options = {}) {
  const { width = PLAYER_WIDTH, height = PLAYER_HEIGHT, allowGrace = 0.5 } = options;

  for (const axis of ['x', 'y', 'z']) {
    if (!Number.isFinite(next[axis])) return { ok: false, reason: 'non-finite position' };
  }
  if (next.y < 0 || next.y > CHUNK_HEIGHT) return { ok: false, reason: 'out of world bounds' };

  const horizontal = Math.hypot(next.x - previous.x, next.z - previous.z);
  const budget = maxSpeed * Math.max(elapsedSeconds, 0) + allowGrace;
  if (horizontal > budget) return { ok: false, reason: 'moved too fast' };

  // Falling is unbounded downward (terminal velocity handles it) but upward
  // motion must respect the same budget as horizontal motion.
  const climb = next.y - previous.y;
  if (climb > budget) return { ok: false, reason: 'climbed too fast' };

  if (collides(isSolid, next.x, next.y, next.z, width, height)) {
    return { ok: false, reason: 'inside terrain' };
  }
  return { ok: true };
}
