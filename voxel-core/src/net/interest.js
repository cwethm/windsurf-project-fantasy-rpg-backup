/**
 * Interest management.
 *
 * A player is only told about the chunks, players and ground items near them.
 * This keeps bandwidth proportional to what is visible rather than to world
 * size, and it is the single place to tune "how much does each client see".
 */

import { blockToChunk, chunkKey, chunkDistance, chunksInRadius } from '../world/coords.js';

/**
 * Work out which chunks a player should gain and lose this update.
 *
 * @param {{
 *   position: { x: number, z: number },
 *   loaded: Set<string>,
 *   viewDistance: number,
 * }} params
 * @returns {{ add: { chunkX: number, chunkZ: number, key: string }[], remove: string[] }}
 */
export function chunkDelta({ position, loaded, viewDistance }) {
  const centerX = blockToChunk(Math.floor(position.x));
  const centerZ = blockToChunk(Math.floor(position.z));

  const wanted = new Set();
  const add = [];
  for (const { chunkX, chunkZ } of chunksInRadius(centerX, centerZ, viewDistance)) {
    const key = chunkKey(chunkX, chunkZ);
    wanted.add(key);
    if (!loaded.has(key)) add.push({ chunkX, chunkZ, key });
  }

  // One chunk of hysteresis so a player walking a border does not thrash.
  const remove = [];
  for (const key of loaded) {
    if (wanted.has(key)) continue;
    const [x, z] = key.split(',').map(Number);
    if (chunkDistance(x, z, centerX, centerZ) > viewDistance + 1) remove.push(key);
  }
  return { add, remove };
}

/**
 * Is a world position inside a player's interest radius?
 * @param {{ x: number, z: number }} position
 * @param {{ x: number, z: number }} origin
 * @param {number} viewDistance in chunks
 */
export function isInInterest(position, origin, viewDistance) {
  const a = { x: blockToChunk(Math.floor(position.x)), z: blockToChunk(Math.floor(position.z)) };
  const b = { x: blockToChunk(Math.floor(origin.x)), z: blockToChunk(Math.floor(origin.z)) };
  return chunkDistance(a.x, a.z, b.x, b.z) <= viewDistance;
}

/**
 * Select the sessions that should receive an event at a world position.
 *
 * @param {Iterable<{ player: { position: object, viewDistance: number } }>} sessions
 * @param {{ x: number, z: number }} position
 * @param {{ exclude?: object }} [options]
 */
export function sessionsNear(sessions, position, { exclude = null } = {}) {
  const out = [];
  for (const session of sessions) {
    if (session === exclude || !session.player) continue;
    if (isInInterest(position, session.player.position, session.player.viewDistance)) {
      out.push(session);
    }
  }
  return out;
}
