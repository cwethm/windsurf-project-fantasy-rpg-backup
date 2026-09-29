/**
 * Biome definitions.
 *
 * Biomes are selected by sampling temperature and moisture noise and finding
 * the first definition whose ranges contain the sample. Adding a biome is an
 * entry in this table; the generator has no biome-specific code.
 *
 * Definition fields
 * -----------------
 *  temperature   `[min, max]` band in 0..1
 *  moisture      `[min, max]` band in 0..1
 *  surface       block placed on the top layer
 *  subsurface    block placed in the few layers below the surface
 *  soilDepth     how many subsurface layers before stone
 *  heightScale   multiplies terrain amplitude
 *  heightOffset  added to the base terrain height
 *  flora         `[{ block, chance }]` decorations placed on the surface
 *  treeChance    per-column probability of a tree trunk
 */

import { Registry } from '../core/registry.js';

const defaults = {
  temperature: [0, 1],
  moisture: [0, 1],
  surface: 'grass',
  subsurface: 'dirt',
  soilDepth: 3,
  heightScale: 1,
  heightOffset: 0,
  flora: [],
  treeChance: 0,
};

function biome(def) {
  return { ...defaults, ...def };
}

export const BIOME_DEFINITIONS = [
  biome({
    id: 'desert',
    name: 'desert',
    temperature: [0.66, 1.01],
    moisture: [0, 0.33],
    surface: 'sand',
    subsurface: 'sand',
    soilDepth: 4,
    heightScale: 0.6,
    heightOffset: -1,
    flora: [],
    treeChance: 0,
  }),
  biome({
    id: 'savanna',
    name: 'savanna',
    temperature: [0.66, 1.01],
    moisture: [0.33, 1.01],
    heightScale: 0.8,
    flora: [{ block: 'tall_grass', chance: 0.12 }],
    treeChance: 0.004,
  }),
  biome({
    id: 'plains',
    name: 'plains',
    temperature: [0.33, 0.66],
    moisture: [0, 0.5],
    heightScale: 0.9,
    flora: [
      { block: 'tall_grass', chance: 0.18 },
      { block: 'flowers', chance: 0.04 },
    ],
    treeChance: 0.006,
  }),
  biome({
    id: 'forest',
    name: 'forest',
    temperature: [0.33, 0.66],
    moisture: [0.5, 1.01],
    heightScale: 1.1,
    flora: [
      { block: 'tall_grass', chance: 0.22 },
      { block: 'flowers', chance: 0.06 },
    ],
    treeChance: 0.03,
  }),
  biome({
    id: 'tundra',
    name: 'tundra',
    temperature: [0, 0.33],
    moisture: [0, 0.5],
    heightScale: 0.7,
    heightOffset: 1,
    flora: [{ block: 'tall_grass', chance: 0.05 }],
    treeChance: 0.002,
  }),
  biome({
    id: 'taiga',
    name: 'taiga',
    temperature: [0, 0.33],
    moisture: [0.5, 1.01],
    heightScale: 1.3,
    heightOffset: 2,
    flora: [{ block: 'tall_grass', chance: 0.08 }],
    treeChance: 0.02,
  }),
];

/** Fallback used when no band matches, so generation can never fail. */
export const DEFAULT_BIOME = BIOME_DEFINITIONS.find((b) => b.id === 'plains');

/**
 * Pick the biome for a climate sample.
 * @param {object[]} biomes
 * @param {number} temperature 0..1
 * @param {number} moisture 0..1
 */
export function selectBiome(biomes, temperature, moisture) {
  for (const def of biomes) {
    const [tMin, tMax] = def.temperature;
    const [mMin, mMax] = def.moisture;
    if (temperature >= tMin && temperature < tMax && moisture >= mMin && moisture < mMax) {
      return def;
    }
  }
  return biomes.find((b) => b.id === DEFAULT_BIOME.id) ?? biomes[0];
}

/**
 * Build a biome registry.
 * @param {object[]} [extraDefinitions]
 */
export function createBiomeRegistry(extraDefinitions = []) {
  const registry = new Registry('biome', {
    validate(def) {
      if (typeof def.id !== 'string' || !def.id) {
        throw new TypeError('biome definitions need a non-empty string id');
      }
      for (const band of ['temperature', 'moisture']) {
        const range = def[band];
        if (!Array.isArray(range) || range.length !== 2 || range[0] >= range[1]) {
          throw new TypeError(`biome "${def.id}" needs a [min, max] ${band} band`);
        }
      }
    },
  });
  registry.registerAll(BIOME_DEFINITIONS.map((def) => biome(def)));
  registry.registerAll(extraDefinitions.map((def) => biome(def)));
  return registry;
}
