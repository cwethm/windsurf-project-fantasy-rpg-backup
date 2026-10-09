/**
 * Entity hit volumes.
 *
 * Entities are hit-tested as axis-aligned boxes centred on their feet
 * position. The box uses the longer of length/width as its footprint so a
 * quadruped facing any direction is covered. Shared by the client (what the
 * crosshair is on) and the server (is the attack in reach).
 */

/**
 * @param {{ position: { x: number, y: number, z: number }, dims: { width: number, height: number, length: number } }} entity
 * @returns {{ min: { x: number, y: number, z: number }, max: { x: number, y: number, z: number } }}
 */
export function entityBox(entity) {
  const half = Math.max(entity.dims.width, entity.dims.length) / 2;
  const { x, y, z } = entity.position;
  return {
    min: { x: x - half, y, z: z - half },
    max: { x: x + half, y: y + entity.dims.height, z: z + half },
  };
}

/**
 * Slab-test a ray against a box.
 * @returns {number|null} distance along the (normalised) ray, or null on a miss
 */
export function rayBoxDistance(origin, direction, box, maxDistance = Infinity) {
  let near = 0;
  let far = maxDistance;
  for (const axis of ['x', 'y', 'z']) {
    const d = direction[axis];
    if (Math.abs(d) < 1e-9) {
      if (origin[axis] < box.min[axis] || origin[axis] > box.max[axis]) return null;
      continue;
    }
    let t1 = (box.min[axis] - origin[axis]) / d;
    let t2 = (box.max[axis] - origin[axis]) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near > far) return null;
  }
  return near;
}

/** Distance from a point to the closest point of a box (0 when inside). */
export function distanceToBox(point, box) {
  const dx = Math.max(box.min.x - point.x, 0, point.x - box.max.x);
  const dy = Math.max(box.min.y - point.y, 0, point.y - box.max.y);
  const dz = Math.max(box.min.z - point.z, 0, point.z - box.max.z);
  return Math.hypot(dx, dy, dz);
}

/**
 * Nearest entity under a ray.
 * @template {{ position: object, dims: object }} T
 * @param {{ x: number, y: number, z: number }} origin
 * @param {{ x: number, y: number, z: number }} direction
 * @param {Iterable<T>} entities
 * @param {number} maxDistance
 * @returns {{ entity: T, distance: number }|null}
 */
export function pickEntity(origin, direction, entities, maxDistance) {
  let best = null;
  for (const entity of entities) {
    const distance = rayBoxDistance(origin, direction, entityBox(entity), maxDistance);
    if (distance !== null && (!best || distance < best.distance)) best = { entity, distance };
  }
  return best;
}
