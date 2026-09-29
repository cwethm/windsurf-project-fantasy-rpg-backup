/**
 * Procedural world generator.
 *
 * Generation is a pipeline of named layers. Each layer receives the chunk plus
 * a context (height map, biome map, per-layer deterministic RNG) and mutates
 * blocks. Adding "rivers" or "villages" means appending a layer, not editing
 * the terrain loop.
 *
 * Determinism rules every layer must follow:
 *  - derive randomness from `ctx.rng` (seeded per layer *and* per chunk), or
 *    from `randomAt(seed, worldX, worldZ)` for per-column decisions;
 *  - never read neighbouring chunks, so chunks can be generated in any order.
 */

import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from '../core/constants.js';
import { WorldSeed, randomAt } from '../core/rng.js';
import { selectBiome } from '../content/biomes.js';
import { Noise } from './noise.js';
import { Chunk } from './chunk.js';
import { chunkToBlock } from './coords.js';

const BEDROCK_LAYERS = 1;

/** Map noise output in [-1, 1] to [0, 1]. */
function unit(n) {
  return (n + 1) * 0.5;
}

/**
 * Layer 1 — carve the solid terrain column for every (x, z) in the chunk.
 */
const terrainLayer = {
  name: 'terrain',
  generate(chunk, ctx) {
    const { ids, heightMap, biomeMap } = ctx;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const column = lz * CHUNK_SIZE + lx;
        const height = heightMap[column];
        const biomeDef = biomeMap[column];
        const surfaceId = ids[biomeDef.surface];
        const subsurfaceId = ids[biomeDef.subsurface];

        for (let y = 0; y <= height; y++) {
          let blockId;
          if (y < BEDROCK_LAYERS) blockId = ids.stone;
          else if (y === height) blockId = height < SEA_LEVEL ? ids.sand : surfaceId;
          else if (y > height - biomeDef.soilDepth) blockId = subsurfaceId;
          else blockId = ids.stone;
          chunk.set(lx, y, lz, blockId);
        }

        for (let y = height + 1; y <= SEA_LEVEL; y++) {
          chunk.set(lx, y, lz, ids.water);
        }
      }
    }
  },
};

/**
 * Layer 2 — carve caves with 3D noise, leaving the bedrock floor intact.
 */
const caveLayer = {
  name: 'caves',
  generate(chunk, ctx) {
    const { ids, heightMap, noise, worldX, worldZ, options } = ctx;
    const threshold = options.caveThreshold;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const column = lz * CHUNK_SIZE + lx;
        const top = Math.min(heightMap[column] - 2, CHUNK_HEIGHT - 1);
        for (let y = BEDROCK_LAYERS; y <= top; y++) {
          const density = noise.cave.noise3D(
            (worldX + lx) * 0.07,
            y * 0.12,
            (worldZ + lz) * 0.07,
          );
          if (density > threshold) chunk.set(lx, y, lz, ids.air);
        }
      }
    }
  },
};

/**
 * Layer 3 — scatter ores through stone by depth band.
 */
const oreLayer = {
  name: 'ores',
  generate(chunk, ctx) {
    const { ids, heightMap, rng, options } = ctx;
    for (const ore of options.ores) {
      const oreId = ids[ore.block];
      if (oreId === undefined) continue;
      const attempts = ore.attemptsPerChunk;
      for (let i = 0; i < attempts; i++) {
        const lx = rng.int(0, CHUNK_SIZE - 1);
        const lz = rng.int(0, CHUNK_SIZE - 1);
        const column = lz * CHUNK_SIZE + lx;
        const maxY = Math.min(ore.maxY, heightMap[column] - 1);
        if (maxY <= ore.minY) continue;
        const y = rng.int(ore.minY, maxY);
        if (chunk.get(lx, y, lz) !== ids.stone) continue;
        const veinSize = rng.int(ore.minVein, ore.maxVein);
        for (let v = 0; v < veinSize; v++) {
          const vx = lx + rng.int(-1, 1);
          const vy = y + rng.int(-1, 1);
          const vz = lz + rng.int(-1, 1);
          if (chunk.get(vx, vy, vz) === ids.stone) chunk.set(vx, vy, vz, oreId);
        }
      }
    }
  },
};

/**
 * Layer 4 — surface decoration: grass tufts, flowers and simple trees.
 */
const floraLayer = {
  name: 'flora',
  generate(chunk, ctx) {
    const { ids, heightMap, biomeMap, seed, worldX, worldZ } = ctx;
    const floraSeed = seed.layer('flora');
    const treeSeed = seed.layer('trees');

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const column = lz * CHUNK_SIZE + lx;
        const height = heightMap[column];
        const surfaceY = height + 1;
        if (height < SEA_LEVEL || surfaceY >= CHUNK_HEIGHT) continue;
        // Caves may have eaten the surface block from under the decoration.
        if (chunk.get(lx, height, lz) === ids.air) continue;
        if (chunk.get(lx, surfaceY, lz) !== ids.air) continue;

        const biomeDef = biomeMap[column];
        const gx = worldX + lx;
        const gz = worldZ + lz;

        if (randomAt(treeSeed, gx, gz) < biomeDef.treeChance) {
          plantTree(chunk, ids, lx, height, lz, treeSeed, gx, gz);
          continue;
        }

        let roll = randomAt(floraSeed, gx, gz);
        for (const flora of biomeDef.flora) {
          if (roll < flora.chance) {
            chunk.set(lx, surfaceY, lz, ids[flora.block]);
            break;
          }
          roll -= flora.chance;
        }
      }
    }
  },
};

/**
 * Trees are clipped at chunk borders rather than written into neighbours: a
 * layer that never touches adjacent chunks keeps generation order-independent.
 */
function plantTree(chunk, ids, lx, groundY, lz, treeSeed, gx, gz) {
  const trunkHeight = 4 + Math.floor(randomAt(treeSeed, gx, gz, 1) * 3);
  const topY = groundY + trunkHeight;
  if (topY + 1 >= CHUNK_HEIGHT) return;

  for (let y = groundY + 1; y <= topY; y++) {
    chunk.set(lx, y, lz, ids.log);
  }
  for (let dy = -1; dy <= 1; dy++) {
    const radius = dy === 1 ? 1 : 2;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx === 0 && dz === 0 && dy < 1) continue;
        if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
        const y = topY + dy;
        if (chunk.get(lx + dx, y, lz + dz) === ids.air) {
          chunk.set(lx + dx, y, lz + dz, ids.leaves);
        }
      }
    }
  }
  chunk.set(lx, topY + 1, lz, ids.leaves);
}

export const DEFAULT_LAYERS = [terrainLayer, caveLayer, oreLayer, floraLayer];

export const DEFAULT_GENERATOR_OPTIONS = {
  /** Terrain amplitude in blocks above the base level. */
  amplitude: 14,
  /** Y level that flat terrain settles at. */
  baseHeight: 32,
  /** Horizontal frequency of the main height noise. */
  terrainFrequency: 0.008,
  /** Frequency of the climate fields driving biome selection. */
  climateFrequency: 0.0025,
  /** Above this 3D noise value a block becomes a cave. */
  caveThreshold: 0.62,
  ores: [
    { block: 'coal_ore', attemptsPerChunk: 8, minY: 2, maxY: 45, minVein: 3, maxVein: 8 },
    { block: 'iron_ore', attemptsPerChunk: 5, minY: 2, maxY: 32, minVein: 2, maxVein: 5 },
  ],
};

export class WorldGenerator {
  /**
   * @param {{
   *   seed: string|number,
   *   content: import('../content/index.js').Content,
   *   layers?: object[],
   *   options?: object,
   * }} config
   */
  constructor({ seed, content, layers = DEFAULT_LAYERS, options = {} }) {
    this.seed = seed instanceof WorldSeed ? seed : new WorldSeed(seed);
    this.content = content;
    this.layers = [...layers];
    this.options = { ...DEFAULT_GENERATOR_OPTIONS, ...options };

    this.noise = {
      height: new Noise(this.seed.layer('height')),
      ridge: new Noise(this.seed.layer('ridge')),
      temperature: new Noise(this.seed.layer('temperature')),
      moisture: new Noise(this.seed.layer('moisture')),
      cave: new Noise(this.seed.layer('cave')),
    };

    // Resolve block names to ids once; layers then work with plain numbers.
    this.ids = {};
    for (const blockDef of content.blocks.all()) this.ids[blockDef.name] = blockDef.id;
    this._biomes = content.biomes.all();
  }

  /**
   * Append a generation layer. Layers run in registration order.
   * @param {{ name: string, generate: Function }} layer
   */
  addLayer(layer) {
    if (typeof layer?.generate !== 'function') {
      throw new TypeError('a generation layer needs a generate(chunk, ctx) function');
    }
    this.layers.push(layer);
    return this;
  }

  /**
   * Climate sample at a world column.
   * @param {number} worldX
   * @param {number} worldZ
   * @returns {{ temperature: number, moisture: number }}
   */
  climateAt(worldX, worldZ) {
    const f = this.options.climateFrequency;
    return {
      temperature: unit(this.noise.temperature.fbm2D(worldX * f, worldZ * f, { octaves: 3 })),
      moisture: unit(this.noise.moisture.fbm2D(worldX * f, worldZ * f, { octaves: 3 })),
    };
  }

  /**
   * Biome definition at a world column.
   * @param {number} worldX
   * @param {number} worldZ
   */
  biomeAt(worldX, worldZ) {
    const { temperature, moisture } = this.climateAt(worldX, worldZ);
    return selectBiome(this._biomes, temperature, moisture);
  }

  /**
   * Terrain surface height at a world column.
   * @param {number} worldX
   * @param {number} worldZ
   * @returns {number} Y index of the topmost terrain block
   */
  heightAt(worldX, worldZ, biomeDef = this.biomeAt(worldX, worldZ)) {
    const { amplitude, baseHeight, terrainFrequency: f } = this.options;
    const rolling = this.noise.height.fbm2D(worldX * f, worldZ * f, { octaves: 5 });
    const ridges = this.noise.ridge.ridged2D(worldX * f * 0.5, worldZ * f * 0.5, { octaves: 3 });
    const combined = rolling * 0.75 + (ridges - 0.5) * 0.5;
    const height =
      baseHeight + biomeDef.heightOffset + combined * amplitude * biomeDef.heightScale;
    return Math.max(BEDROCK_LAYERS, Math.min(CHUNK_HEIGHT - 2, Math.round(height)));
  }

  /**
   * A safe Y to place a player at for a world column: on top of terrain, above
   * the sea, never inside a block.
   */
  spawnHeightAt(worldX, worldZ) {
    return Math.max(this.heightAt(worldX, worldZ), SEA_LEVEL) + 1;
  }

  /**
   * Generate a pristine chunk. The result contains no player edits; the
   * `World` overlays those separately.
   * @param {number} chunkX
   * @param {number} chunkZ
   * @returns {Chunk}
   */
  generateChunk(chunkX, chunkZ) {
    const chunk = new Chunk(chunkX, chunkZ);
    const worldX = chunkToBlock(chunkX);
    const worldZ = chunkToBlock(chunkZ);

    const heightMap = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomeMap = new Array(CHUNK_SIZE * CHUNK_SIZE);
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const column = lz * CHUNK_SIZE + lx;
        const biomeDef = this.biomeAt(worldX + lx, worldZ + lz);
        biomeMap[column] = biomeDef;
        heightMap[column] = this.heightAt(worldX + lx, worldZ + lz, biomeDef);
      }
    }

    for (const layer of this.layers) {
      layer.generate(chunk, {
        generator: this,
        content: this.content,
        seed: this.seed,
        ids: this.ids,
        noise: this.noise,
        options: this.options,
        chunkX,
        chunkZ,
        worldX,
        worldZ,
        heightMap,
        biomeMap,
        rng: this.seed.chunkRandom(layer.name, chunkX, chunkZ),
      });
    }

    chunk.revision = 0;
    return chunk;
  }
}
