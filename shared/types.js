// Shared types and constants - kept in sync with shared/constants.py
// Authoritative source of truth is shared/constants.py

export const BLOCK_TYPES = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WOOD: 4, LEAVES: 5,
  WATER: 6, SAND: 7, CHEST: 8,
  COAL_ORE: 10, IRON_ORE: 11, GOLD_ORE: 12, DIAMOND_ORE: 13,
  FLOWERS: 18, TALL_GRASS: 19,
  LOG: 20, PLANKS: 21,
  COBBLESTONE: 30, BRICK: 31, GLASS: 32,
  WOOL: 40, FURNACE: 41, CRAFTING_TABLE: 43,
};

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const BLOCK_SIZE = 1;
export const GRAVITY = -9.81;
export const PLAYER_SPEED = 5;
export const JUMP_FORCE = 8;
export const INTERACTION_RANGE = 5;
