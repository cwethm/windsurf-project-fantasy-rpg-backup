/**
 * Deterministic pseudo random numbers.
 *
 * World generation must be reproducible: the same seed and the same
 * coordinates must always produce the same result, independent of the order in
 * which chunks are visited. Everything here is therefore stateless hashing
 * plus a small explicit-state generator, never a shared global `Math.random`.
 */

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

/**
 * Hash an arbitrary string into an unsigned 32-bit integer (FNV-1a).
 * @param {string} str
 * @returns {number}
 */
export function hashString(str) {
  let h = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

/**
 * Mix a 32-bit integer so neighbouring inputs produce unrelated outputs.
 * @param {number} x
 * @returns {number} unsigned 32-bit integer
 */
export function hashInt(x) {
  let h = x | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Hash a seed plus an arbitrary number of integer coordinates.
 * @param {number} seed
 * @param {...number} coords
 * @returns {number} unsigned 32-bit integer
 */
export function hashCoords(seed, ...coords) {
  let h = seed >>> 0;
  for (const c of coords) {
    h = hashInt((h ^ (c | 0)) + 0x9e3779b9);
  }
  return h >>> 0;
}

/**
 * Deterministic float in [0, 1) for a seed + coordinate tuple.
 * @param {number} seed
 * @param {...number} coords
 */
export function randomAt(seed, ...coords) {
  return hashCoords(seed, ...coords) / 4294967296;
}

/**
 * Small, fast, explicitly-seeded PRNG (mulberry32).
 *
 * Use one instance per generation unit (per chunk, per structure) so parallel
 * or out-of-order generation still yields identical worlds.
 */
export class Random {
  /** @param {number|string} seed */
  constructor(seed) {
    this.seed = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this._state = this.seed;
  }

  /** @returns {number} float in [0, 1) */
  next() {
    this._state = (this._state + 0x6d2b79f5) >>> 0;
    let t = this._state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * @param {number} min inclusive
   * @param {number} max exclusive
   * @returns {number} float in [min, max)
   */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /**
   * @param {number} min inclusive
   * @param {number} max inclusive
   * @returns {number} integer in [min, max]
   */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** @param {number} probability chance in [0, 1] of returning true */
  chance(probability) {
    return this.next() < probability;
  }

  /**
   * @template T
   * @param {T[]} items
   * @returns {T|undefined}
   */
  pick(items) {
    if (!items.length) return undefined;
    return items[this.int(0, items.length - 1)];
  }

  /**
   * Weighted pick. Entries must expose a numeric `weight`.
   * @template {{ weight?: number }} T
   * @param {T[]} entries
   * @returns {T|undefined}
   */
  pickWeighted(entries) {
    let total = 0;
    for (const entry of entries) total += entry.weight ?? 1;
    if (total <= 0) return undefined;
    let roll = this.next() * total;
    for (const entry of entries) {
      roll -= entry.weight ?? 1;
      if (roll < 0) return entry;
    }
    return entries[entries.length - 1];
  }

  /** Restart the sequence from the original seed. */
  reset() {
    this._state = this.seed;
    return this;
  }
}

/**
 * World seed holder that derives stable sub-seeds.
 *
 * Each generation layer gets its own seed so adding a layer never shifts the
 * output of existing layers.
 */
export class WorldSeed {
  /** @param {string|number} seed */
  constructor(seed) {
    this.raw = String(seed);
    this.value = typeof seed === 'number' ? seed >>> 0 : hashString(this.raw);
    /** @type {Map<string, number>} */
    this._layerSeeds = new Map();
  }

  /**
   * Stable seed for a named generation layer.
   * @param {string} layer
   */
  layer(layer) {
    let cached = this._layerSeeds.get(layer);
    if (cached === undefined) {
      cached = hashString(`${this.raw}:${layer}`);
      this._layerSeeds.set(layer, cached);
    }
    return cached;
  }

  /**
   * Stable seed for one chunk of one layer.
   * @param {string} layer
   * @param {number} chunkX
   * @param {number} chunkZ
   */
  chunk(layer, chunkX, chunkZ) {
    return hashCoords(this.layer(layer), chunkX, chunkZ);
  }

  /** A `Random` scoped to one chunk of one layer. */
  chunkRandom(layer, chunkX, chunkZ) {
    return new Random(this.chunk(layer, chunkX, chunkZ));
  }
}
