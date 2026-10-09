/**
 * Brains.
 *
 * A brain is a registered handler that looks at an entity and its
 * surroundings each AI tick and sets `entity.intent`: where to go, how fast,
 * and which animation to show. The entity manager turns intents into physics.
 * New behaviours are new registrations; the manager never branches on a mob.
 *
 * Intent shape: `{ mode, target: { x, z } | null, speed, anim, until }`.
 */

import { HandlerRegistry } from '../core/registry.js';

/** @type {HandlerRegistry} */
export const BRAINS = new HandlerRegistry('brain');

/** How long a fright lasts after being hit, in milliseconds. */
export const FLEE_MS = 6000;

/**
 * Grazing herbivore: idles and grazes, wanders inside its territory, and runs
 * from whoever last hurt it.
 * @param {object} entity
 * @param {{ now: number, rng: import('../core/rng.js').Random }} ctx
 */
export function grazerBrain(entity, { now, rng }) {
  const { stats, traits } = entity.def;
  const threat = entity.threat;
  if (threat && now < threat.until) {
    const dx = entity.position.x - threat.x;
    const dz = entity.position.z - threat.z;
    const length = Math.hypot(dx, dz) || 1;
    entity.intent = {
      mode: 'flee',
      target: { x: entity.position.x + (dx / length) * 8, z: entity.position.z + (dz / length) * 8 },
      speed: stats.speed * (1 + traits.timidity * 0.4),
      anim: 'run',
      until: threat.until,
    };
    return;
  }
  if (threat) entity.threat = null;

  const intent = entity.intent;
  const arrived =
    intent?.target && Math.hypot(intent.target.x - entity.position.x, intent.target.z - entity.position.z) < 0.6;
  if (intent && intent.mode !== 'flee' && now < intent.until && !arrived) return;

  if (rng.chance(0.45)) {
    const angle = rng.range(0, Math.PI * 2);
    const radius = rng.range(2, traits.territory);
    entity.intent = {
      mode: 'wander',
      target: { x: entity.home.x + Math.cos(angle) * radius, z: entity.home.z + Math.sin(angle) * radius },
      speed: stats.speed,
      anim: 'walk',
      until: now + rng.range(6000, 12000),
    };
  } else {
    entity.intent = {
      mode: 'idle',
      target: null,
      speed: 0,
      anim: rng.chance(0.5) ? 'graze' : 'idle',
      until: now + rng.range(2000, 6000),
    };
  }
}

BRAINS.register('grazer', grazerBrain);
