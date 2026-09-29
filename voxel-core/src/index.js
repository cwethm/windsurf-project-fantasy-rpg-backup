/**
 * voxel-core — reusable building blocks for voxel multiplayer games.
 *
 * Browser-safe surface only: core primitives, content registries, world
 * generation, gameplay systems and the wire protocol. Server and storage
 * modules use Node built-ins and are reached through the `./server` and
 * `./storage` subpath exports.
 */

export * from './core/constants.js';
export { EventBus, EVENTS } from './core/event-bus.js';
export { Registry, HandlerRegistry } from './core/registry.js';
export { Random, WorldSeed, hashString, hashInt, hashCoords, randomAt } from './core/rng.js';

export { Content, createContent, BLOCK_IDS, TOOL_CLASSES, USE_ACTIONS } from './content/index.js';
export { BLOCK_DEFINITIONS, createBlockRegistry } from './content/blocks.js';
export { ITEM_DEFINITIONS, createItemRegistry } from './content/items.js';
export { LOOT_TABLES, createLootRegistry, rollLootTable } from './content/loot.js';
export { BIOME_DEFINITIONS, createBiomeRegistry, selectBiome } from './content/biomes.js';

export * from './world/index.js';
export * from './game/index.js';
export * from './net/index.js';
