/**
 * Coordinate noise.
 *
 * A gradient-noise implementation whose permutation table is derived purely
 * from the seed (no `Math.random`), so a seed always reproduces the same
 * terrain on any machine and in any process.
 */

import { hashInt, hashString } from '../core/rng.js';

const PERM_SIZE = 256;

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + t * (b - a);
}

function grad2(hash, x, y) {
  // 8 evenly spaced gradient directions.
  switch (hash & 7) {
    case 0: return x + y;
    case 1: return x - y;
    case 2: return -x + y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
}

function grad3(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export class Noise {
  /** @param {number|string} seed */
  constructor(seed) {
    this.seed = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.perm = new Uint8Array(PERM_SIZE * 2);

    // Deterministic Fisher-Yates driven by the seed hash rather than a
    // stateful global RNG, so construction order never matters.
    const table = new Uint8Array(PERM_SIZE);
    for (let i = 0; i < PERM_SIZE; i++) table[i] = i;
    for (let i = PERM_SIZE - 1; i > 0; i--) {
      const j = hashInt(this.seed + i * 0x9e3779b9) % (i + 1);
      const tmp = table[i];
      table[i] = table[j];
      table[j] = tmp;
    }
    for (let i = 0; i < PERM_SIZE * 2; i++) this.perm[i] = table[i & (PERM_SIZE - 1)];
  }

  /**
   * 2D gradient noise.
   * @returns {number} roughly in [-1, 1]
   */
  noise2D(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = this.perm[this.perm[xi] + yi];
    const ab = this.perm[this.perm[xi] + yi + 1];
    const ba = this.perm[this.perm[xi + 1] + yi];
    const bb = this.perm[this.perm[xi + 1] + yi + 1];

    return lerp(
      lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u),
      lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u),
      v,
    );
  }

  /**
   * 3D gradient noise, used for caves and overhangs.
   * @returns {number} roughly in [-1, 1]
   */
  noise3D(x, y, z) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const a = this.perm[xi] + yi;
    const aa = this.perm[a] + zi;
    const ab = this.perm[a + 1] + zi;
    const b = this.perm[xi + 1] + yi;
    const ba = this.perm[b] + zi;
    const bb = this.perm[b + 1] + zi;

    return lerp(
      lerp(
        lerp(grad3(this.perm[aa], xf, yf, zf), grad3(this.perm[ba], xf - 1, yf, zf), u),
        lerp(grad3(this.perm[ab], xf, yf - 1, zf), grad3(this.perm[bb], xf - 1, yf - 1, zf), u),
        v,
      ),
      lerp(
        lerp(grad3(this.perm[aa + 1], xf, yf, zf - 1), grad3(this.perm[ba + 1], xf - 1, yf, zf - 1), u),
        lerp(grad3(this.perm[ab + 1], xf, yf - 1, zf - 1), grad3(this.perm[bb + 1], xf - 1, yf - 1, zf - 1), u),
        v,
      ),
      w,
    );
  }

  /**
   * Fractal Brownian motion: layered noise for natural looking terrain.
   * @returns {number} normalised to roughly [-1, 1]
   */
  fbm2D(x, y, { octaves = 4, persistence = 0.5, lacunarity = 2.0, frequency = 1.0 } = {}) {
    let value = 0;
    let amplitude = 1;
    let freq = frequency;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * freq, y * freq) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      freq *= lacunarity;
    }
    return maxValue === 0 ? 0 : value / maxValue;
  }

  /**
   * Ridged noise, useful for mountain spines.
   * @returns {number} normalised to roughly [0, 1]
   */
  ridged2D(x, y, { octaves = 4, persistence = 0.5, lacunarity = 2.0, frequency = 1.0 } = {}) {
    let value = 0;
    let amplitude = 1;
    let freq = frequency;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value += (1 - Math.abs(this.noise2D(x * freq, y * freq))) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      freq *= lacunarity;
    }
    return maxValue === 0 ? 0 : value / maxValue;
  }
}
