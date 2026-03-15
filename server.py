#!/usr/bin/env python3
"""
3D Voxel MMO Server
"""

import asyncio
import json
import logging
import math
import random
import time
import uuid
import websockets
from typing import Dict, Any, List, Tuple, Optional
from database import Database
from worldgen.world_generator import WorldGenerator
from shared.constants import BLOCK_TYPES, ITEM_TYPES, ITEM_NAMES, ITEM_MAX_STACK, MESSAGE_TYPES, CHUNK_SIZE, CHUNK_HEIGHT

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Anti-cheat constants
MAX_MOVE_SPEED = 10.0  # Maximum blocks per second
MINING_COOLDOWN = 0.1  # Minimum time between block breaks (seconds)
PLACING_COOLDOWN = 0.1  # Minimum time between block places (seconds)
MAX_REACH_DISTANCE = 6.0  # Maximum distance to interact with blocks

# Constants imported from shared/constants.py

# Crafting recipes
CRAFTING_RECIPES = {
    'wooden_pickaxe': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 3},
            {'type': ITEM_TYPES['STICK'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['WOODEN_PICKAXE'], 'count': 1}
    },
    'stone_pickaxe': {
        'ingredients': [
            {'type': ITEM_TYPES['STONE'], 'count': 3},
            {'type': ITEM_TYPES['STICK'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['STONE_PICKAXE'], 'count': 1}
    },
    'iron_pickaxe': {
        'ingredients': [
            {'type': ITEM_TYPES['IRON_INGOT'], 'count': 3},
            {'type': ITEM_TYPES['STICK'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['IRON_PICKAXE'], 'count': 1}
    },
    'wooden_sword': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 2},
            {'type': ITEM_TYPES['STICK'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['WOODEN_SWORD'], 'count': 1}
    },
    'stone_sword': {
        'ingredients': [
            {'type': ITEM_TYPES['STONE'], 'count': 2},
            {'type': ITEM_TYPES['STICK'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['STONE_SWORD'], 'count': 1}
    },
    'iron_sword': {
        'ingredients': [
            {'type': ITEM_TYPES['IRON_INGOT'], 'count': 2},
            {'type': ITEM_TYPES['STICK'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['IRON_SWORD'], 'count': 1}
    },
    'sticks': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['STICK'], 'count': 4}
    },
    'sticks_from_log': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD_LOG'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['STICK'], 'count': 4}
    },
    'planks': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['PLANKS'], 'count': 4}
    },
    'planks_from_log': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD_LOG'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['PLANKS'], 'count': 4}
    },
    'crafting_table': {
        'ingredients': [
            {'type': ITEM_TYPES['PLANKS'], 'count': 4}
        ],
        'result': {'type': ITEM_TYPES['CRAFTING_TABLE'], 'count': 1}
    },
    'furnace': {
        'ingredients': [
            {'type': ITEM_TYPES['COBBLESTONE'], 'count': 8}
        ],
        'result': {'type': ITEM_TYPES['FURNACE'], 'count': 1}
    },
    'chest': {
        'ingredients': [
            {'type': ITEM_TYPES['PLANKS'], 'count': 8}
        ],
        'result': {'type': ITEM_TYPES['CHEST'], 'count': 1}
    },
    # Basic tools
    'knife': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 1},
            {'type': ITEM_TYPES['STICK'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['KNIFE'], 'count': 1}
    },
    'hatchet': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 2},
            {'type': ITEM_TYPES['STICK'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['HATCHET'], 'count': 1}
    },
    'shovel': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 1},
            {'type': ITEM_TYPES['STICK'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['SHOVEL'], 'count': 1}
    },
    'sickle': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 2},
            {'type': ITEM_TYPES['STICK'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['SICKLE'], 'count': 1}
    },
    'hammer': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 3},
            {'type': ITEM_TYPES['STICK'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['HAMMER'], 'count': 1}
    },
    'fishing_rod': {
        'ingredients': [
            {'type': ITEM_TYPES['STICK'], 'count': 3},
            {'type': ITEM_TYPES['THREAD'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['FISHING_ROD'], 'count': 1}
    },
    'skinning_knife': {
        'ingredients': [
            {'type': ITEM_TYPES['FLINT'], 'count': 1},
            {'type': ITEM_TYPES['STICK'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['SKINNING_KNIFE'], 'count': 1}
    },
    'shears': {
        'ingredients': [
            {'type': ITEM_TYPES['IRON_INGOT'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['SHEARS'], 'count': 1}
    },
    # Plant processing
    'fiber_bundle': {
        'ingredients': [
            {'type': ITEM_TYPES['GRASS_FIBER'], 'count': 3},
            {'type': ITEM_TYPES['REED'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['FIBER_BUNDLE'], 'count': 1}
    },
    'thread': {
        'ingredients': [
            {'type': ITEM_TYPES['FIBER_BUNDLE'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['THREAD'], 'count': 3}
    },
    'twine': {
        'ingredients': [
            {'type': ITEM_TYPES['GRASS_FIBER'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['TWINE'], 'count': 1}
    },
    'rope': {
        'ingredients': [
            {'type': ITEM_TYPES['TWINE'], 'count': 3},
            {'type': ITEM_TYPES['SINEW'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['ROPE'], 'count': 1}
    },
    'cloth_bolt': {
        'ingredients': [
            {'type': ITEM_TYPES['THREAD'], 'count': 4},
            {'type': ITEM_TYPES['WOOL_BUNDLE'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['CLOTH_BOLT'], 'count': 1}
    },
    'paper': {
        'ingredients': [
            {'type': ITEM_TYPES['PULP'], 'count': 3}
        ],
        'result': {'type': ITEM_TYPES['PAPER'], 'count': 1}
    },
    'herbal_paste': {
        'ingredients': [
            {'type': ITEM_TYPES['HERB'], 'count': 2},
            {'type': ITEM_TYPES['MORTAR'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['HERBAL_PASTE'], 'count': 1}
    },
    'dried_herbs': {
        'ingredients': [
            {'type': ITEM_TYPES['HERB'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['DRIED_HERBS'], 'count': 1}
    },
    # Animal processing
    'cured_hide': {
        'ingredients': [
            {'type': ITEM_TYPES['HIDE'], 'count': 1},
            {'type': ITEM_TYPES['SALT'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['CURED_HIDE'], 'count': 1}
    },
    'leather': {
        'ingredients': [
            {'type': ITEM_TYPES['CURED_HIDE'], 'count': 1},
            {'type': ITEM_TYPES['FAT'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['LEATHER'], 'count': 1}
    },
    'bone_needle': {
        'ingredients': [
            {'type': ITEM_TYPES['BONE'], 'count': 1},
            {'type': ITEM_TYPES['KNIFE'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['BONE_NEEDLE'], 'count': 1}
    },
    'glue': {
        'ingredients': [
            {'type': ITEM_TYPES['BONE'], 'count': 2},
            {'type': ITEM_TYPES['WATER'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['GLUE'], 'count': 1}
    },
    'tallow': {
        'ingredients': [
            {'type': ITEM_TYPES['FAT'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['TALLOW'], 'count': 1}
    },
    'parchment': {
        'ingredients': [
            {'type': ITEM_TYPES['HIDE'], 'count': 1},
            {'type': ITEM_TYPES['GLUE'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['PARCHMENT'], 'count': 1}
    },
    # Stone processing
    'cut_stone': {
        'ingredients': [
            {'type': ITEM_TYPES['STONE'], 'count': 1},
            {'type': ITEM_TYPES['HAMMER'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['CUT_STONE'], 'count': 1}
    },
    'stone_brick': {
        'ingredients': [
            {'type': ITEM_TYPES['CUT_STONE'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['STONE_BRICK'], 'count': 1}
    },
    'ceramic': {
        'ingredients': [
            {'type': ITEM_TYPES['CLAY'], 'count': 2},
            {'type': ITEM_TYPES['WATER'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['CERAMIC'], 'count': 1}
    },
    'pottery': {
        'ingredients': [
            {'type': ITEM_TYPES['CERAMIC'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['POTTERY'], 'count': 1}
    },
    'glass_vial': {
        'ingredients': [
            {'type': ITEM_TYPES['GLASS'], 'count': 1},
            {'type': ITEM_TYPES['HAMMER'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['GLASS_VIAL'], 'count': 1}
    },
    'mortar': {
        'ingredients': [
            {'type': ITEM_TYPES['STONE'], 'count': 3}
        ],
        'result': {'type': ITEM_TYPES['MORTAR'], 'count': 1}
    },
    # Metal processing
    'metal_wire': {
        'ingredients': [
            {'type': ITEM_TYPES['COPPER_INGOT'], 'count': 1},
            {'type': ITEM_TYPES['HAMMER'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['METAL_WIRE'], 'count': 2}
    },
    'metal_band': {
        'ingredients': [
            {'type': ITEM_TYPES['IRON_INGOT'], 'count': 1},
            {'type': ITEM_TYPES['HAMMER'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['METAL_BAND'], 'count': 1}
    },
    'nails': {
        'ingredients': [
            {'type': ITEM_TYPES['IRON_INGOT'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['NAILS'], 'count': 4}
    },
    'rivets': {
        'ingredients': [
            {'type': ITEM_TYPES['IRON_INGOT'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['RIVETS'], 'count': 3}
    },
    'chain_links': {
        'ingredients': [
            {'type': ITEM_TYPES['METAL_WIRE'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['CHAIN_LINKS'], 'count': 1}
    },
    'bronze_ingot': {
        'ingredients': [
            {'type': ITEM_TYPES['COPPER_INGOT'], 'count': 2},
            {'type': ITEM_TYPES['TIN_INGOT'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['BRONZE_INGOT'], 'count': 3}
    },
    # Wood processing
    'pole': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['POLE'], 'count': 1}
    },
    'carved_wood': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 1},
            {'type': ITEM_TYPES['KNIFE'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['CARVED_WOOD'], 'count': 1}
    },
    'charcoal': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['CHARCOAL'], 'count': 1}
    },
    # Food recipes
    'roasted_meat': {
        'ingredients': [
            {'type': ITEM_TYPES['MEAT'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['ROASTED_MEAT'], 'count': 1}
    },
    'jerky': {
        'ingredients': [
            {'type': ITEM_TYPES['MEAT'], 'count': 1},
            {'type': ITEM_TYPES['SALT'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['JERKY'], 'count': 1}
    },
    'mushroom_soup': {
        'ingredients': [
            {'type': ITEM_TYPES['MUSHROOM'], 'count': 3},
            {'type': ITEM_TYPES['POTTERY'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['MUSHROOM_SOUP'], 'count': 1}
    },
    'porridge': {
        'ingredients': [
            {'type': ITEM_TYPES['FLOUR'], 'count': 2},
            {'type': ITEM_TYPES['WATER'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['PORRIDGE'], 'count': 1}
    },
    'herb_tea': {
        'ingredients': [
            {'type': ITEM_TYPES['DRIED_HERBS'], 'count': 1},
            {'type': ITEM_TYPES['WATER'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['HERB_TEA'], 'count': 1}
    },
    'stew': {
        'ingredients': [
            {'type': ITEM_TYPES['MEAT'], 'count': 2},
            {'type': ITEM_TYPES['ROOTS'], 'count': 2},
            {'type': ITEM_TYPES['POTTERY'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['STEW'], 'count': 1}
    },
    'bread': {
        'ingredients': [
            {'type': ITEM_TYPES['FLOUR'], 'count': 3},
            {'type': ITEM_TYPES['WATER'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['BREAD'], 'count': 1}
    },
    'berry_mash': {
        'ingredients': [
            {'type': ITEM_TYPES['BERRIES'], 'count': 3}
        ],
        'result': {'type': ITEM_TYPES['BERRY_MASH'], 'count': 1}
    },
    # Workstations
    'campfire': {
        'ingredients': [
            {'type': ITEM_TYPES['STONE'], 'count': 4},
            {'type': ITEM_TYPES['WOOD'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['CAMPFIRE'], 'count': 1}
    },
    'tanning_rack': {
        'ingredients': [
            {'type': ITEM_TYPES['POLE'], 'count': 4},
            {'type': ITEM_TYPES['TWINE'], 'count': 3}
        ],
        'result': {'type': ITEM_TYPES['TANNING_RACK'], 'count': 1}
    },
    'carpentry_bench': {
        'ingredients': [
            {'type': ITEM_TYPES['PLANKS'], 'count': 4},
            {'type': ITEM_TYPES['POLE'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['CARPENTRY_BENCH'], 'count': 1}
    },
    'loom': {
        'ingredients': [
            {'type': ITEM_TYPES['POLE'], 'count': 4},
            {'type': ITEM_TYPES['TWINE'], 'count': 4}
        ],
        'result': {'type': ITEM_TYPES['LOOM'], 'count': 1}
    },
    'spinning_wheel': {
        'ingredients': [
            {'type': ITEM_TYPES['WOOD'], 'count': 3},
            {'type': ITEM_TYPES['TWINE'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['SPINNING_WHEEL'], 'count': 1}
    },
    'mason_table': {
        'ingredients': [
            {'type': ITEM_TYPES['CUT_STONE'], 'count': 4}
        ],
        'result': {'type': ITEM_TYPES['MASON_TABLE'], 'count': 1}
    },
    'forge': {
        'ingredients': [
            {'type': ITEM_TYPES['STONE_BRICK'], 'count': 8},
            {'type': ITEM_TYPES['METAL_BAND'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['FORGE'], 'count': 1}
    },
    'anvil': {
        'ingredients': [
            {'type': ITEM_TYPES['IRON_INGOT'], 'count': 5}
        ],
        'result': {'type': ITEM_TYPES['ANVIL'], 'count': 1}
    },
    'smelter': {
        'ingredients': [
            {'type': ITEM_TYPES['STONE_BRICK'], 'count': 6},
            {'type': ITEM_TYPES['CHARCOAL'], 'count': 4}
        ],
        'result': {'type': ITEM_TYPES['SMELTER'], 'count': 1}
    },
    'alchemy_table': {
        'ingredients': [
            {'type': ITEM_TYPES['CARVED_WOOD'], 'count': 2},
            {'type': ITEM_TYPES['GLASS_VIAL'], 'count': 3}
        ],
        'result': {'type': ITEM_TYPES['ALCHEMY_TABLE'], 'count': 1}
    },
    'enchanting_altar': {
        'ingredients': [
            {'type': ITEM_TYPES['STONE_BRICK'], 'count': 4},
            {'type': ITEM_TYPES['GEM_SEAM'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['ENCHANTING_ALTAR'], 'count': 1}
    },
    'tailor_bench': {
        'ingredients': [
            {'type': ITEM_TYPES['POLE'], 'count': 2},
            {'type': ITEM_TYPES['CLOTH_BOLT'], 'count': 2}
        ],
        'result': {'type': ITEM_TYPES['TAILOR_BENCH'], 'count': 1}
    },
    'leatherworker_bench': {
        'ingredients': [
            {'type': ITEM_TYPES['POLE'], 'count': 2},
            {'type': ITEM_TYPES['LEATHER'], 'count': 3}
        ],
        'result': {'type': ITEM_TYPES['LEATHERWORKER_BENCH'], 'count': 1}
    },
    'fletching_bench': {
        'ingredients': [
            {'type': ITEM_TYPES['CARVED_WOOD'], 'count': 2},
            {'type': ITEM_TYPES['KNIFE'], 'count': 1}
        ],
        'result': {'type': ITEM_TYPES['FLETCHING_BENCH'], 'count': 1}
    }
}

BLOCK_SIZE = 1
GRAVITY = -9.81
PLAYER_SPEED = 5
JUMP_FORCE = 8
INTERACTION_RANGE = 5

# Anti-cheat constants
MAX_SPEED = 20.0  # Maximum blocks per second
MAX_REACH_DISTANCE = 6.0  # Maximum block interaction distance
MINING_COOLDOWN = 0.1  # Seconds between block breaks
PLACING_COOLDOWN = 0.1  # Seconds between block placements
ITEM_LOCK_TIMEOUT = 420  # 7 minutes in seconds

# Block hardness (seconds to mine with bare hands)
BLOCK_HARDNESS = {
    BLOCK_TYPES['GRASS']: 0.6,
    BLOCK_TYPES['DIRT']: 0.5,
    BLOCK_TYPES['STONE']: 3.0,
    BLOCK_TYPES['WOOD']: 1.5,
    BLOCK_TYPES['LEAVES']: 0.3,
    BLOCK_TYPES['SAND']: 0.5,
    BLOCK_TYPES['CHEST']: 2.5,
}

# Block to item mapping
BLOCK_DROPS = {
    BLOCK_TYPES['GRASS']: ITEM_TYPES['GRASS'],
    BLOCK_TYPES['DIRT']: ITEM_TYPES['DIRT'],
    BLOCK_TYPES['STONE']: ITEM_TYPES['COBBLESTONE'],
    BLOCK_TYPES['WOOD']: ITEM_TYPES['WOOD'],
    BLOCK_TYPES['LEAVES']: ITEM_TYPES['LEAVES'],
    BLOCK_TYPES['SAND']: ITEM_TYPES['SAND'],
    BLOCK_TYPES['CHEST']: ITEM_TYPES['CHEST'],
    BLOCK_TYPES['LOG']: ITEM_TYPES['LOG'],
    BLOCK_TYPES['PLANKS']: ITEM_TYPES['PLANKS'],
    BLOCK_TYPES['COBBLESTONE']: ITEM_TYPES['COBBLESTONE'],
    BLOCK_TYPES['BRICK']: ITEM_TYPES['BRICK'],
    BLOCK_TYPES['GLASS']: ITEM_TYPES['GLASS'],
    BLOCK_TYPES['WOOL']: ITEM_TYPES['WOOL'],
    BLOCK_TYPES['CRAFTING_TABLE']: ITEM_TYPES['CRAFTING_TABLE'],
    BLOCK_TYPES['COAL_ORE']: ITEM_TYPES['COAL'],
    BLOCK_TYPES['IRON_ORE']: ITEM_TYPES['IRON_ORE'],
    BLOCK_TYPES['GOLD_ORE']: ITEM_TYPES['GOLD_ORE'],
    BLOCK_TYPES['DIAMOND_ORE']: ITEM_TYPES['DIAMOND'],
    # New material source blocks
    BLOCK_TYPES['OAK_LOG']: ITEM_TYPES['WOOD_LOG'],
    BLOCK_TYPES['PINE_LOG']: ITEM_TYPES['WOOD_LOG'],
    BLOCK_TYPES['BIRCH_LOG']: ITEM_TYPES['WOOD_LOG'],
    BLOCK_TYPES['OAK_LEAVES']: ITEM_TYPES['LEAVES'],
    BLOCK_TYPES['PINE_LEAVES']: ITEM_TYPES['LEAVES'],
    BLOCK_TYPES['BIRCH_LEAVES']: ITEM_TYPES['LEAVES'],
    BLOCK_TYPES['BERRY_BUSH']: ITEM_TYPES['BERRIES'],
    BLOCK_TYPES['THORN_BUSH']: ITEM_TYPES['BRANCH'],
    BLOCK_TYPES['HERB_SHRUB']: ITEM_TYPES['HERB'],
    BLOCK_TYPES['MUSHROOM_CLUSTER']: ITEM_TYPES['MUSHROOM'],
    BLOCK_TYPES['REED_BED']: ITEM_TYPES['REED'],
    BLOCK_TYPES['FLINT_NODULE']: ITEM_TYPES['FLINT'],
    BLOCK_TYPES['CLAY_DEPOSIT']: ITEM_TYPES['CLAY'],
    BLOCK_TYPES['SALT_DEPOSIT']: ITEM_TYPES['SALT'],
    BLOCK_TYPES['COPPER_VEIN']: ITEM_TYPES['COPPER_ORE'],
    BLOCK_TYPES['TIN_VEIN']: ITEM_TYPES['TIN_ORE'],
    BLOCK_TYPES['SILVER_VEIN']: ITEM_TYPES['SILVER_ORE'],
    BLOCK_TYPES['GEM_SEAM']: ITEM_TYPES['DIAMOND'],
    # Workstations drop themselves
    BLOCK_TYPES['CAMPFIRE']: ITEM_TYPES['CAMPFIRE'],
    BLOCK_TYPES['TANNING_RACK']: ITEM_TYPES['TANNING_RACK'],
    BLOCK_TYPES['CARPENTRY_BENCH']: ITEM_TYPES['CARPENTRY_BENCH'],
    BLOCK_TYPES['LOOM']: ITEM_TYPES['LOOM'],
    BLOCK_TYPES['SPINNING_WHEEL']: ITEM_TYPES['SPINNING_WHEEL'],
    BLOCK_TYPES['MASON_TABLE']: ITEM_TYPES['MASON_TABLE'],
    BLOCK_TYPES['FORGE']: ITEM_TYPES['FORGE'],
    BLOCK_TYPES['ANVIL']: ITEM_TYPES['ANVIL'],
    BLOCK_TYPES['SMELTER']: ITEM_TYPES['SMELTER'],
    BLOCK_TYPES['ALCHEMY_TABLE']: ITEM_TYPES['ALCHEMY_TABLE'],
    BLOCK_TYPES['ENCHANTING_ALTAR']: ITEM_TYPES['ENCHANTING_ALTAR'],
    BLOCK_TYPES['TAILOR_BENCH']: ITEM_TYPES['TAILOR_BENCH'],
    BLOCK_TYPES['LEATHERWORKER_BENCH']: ITEM_TYPES['LEATHERWORKER_BENCH'],
    BLOCK_TYPES['FLETCHING_BENCH']: ITEM_TYPES['FLETCHING_BENCH'],
}

# Mob stats table
MOB_STATS = {
    'zombie':   {'health': 50,  'damage': 8,  'speed': 2.0, 'attack_range': 2.0, 'detection_range': 14.0, 'xp_reward': 20,
                 'loot': [{'type': ITEM_TYPES['DIRT'], 'weight': 60, 'count': (1,2)},
                           {'type': ITEM_TYPES['WOOD'], 'weight': 30, 'count': (1,2)}]},
    'skeleton': {'health': 35,  'damage': 12, 'speed': 2.5, 'attack_range': 1.5, 'detection_range': 16.0, 'xp_reward': 25,
                 'loot': [{'type': ITEM_TYPES['STONE'], 'weight': 70, 'count': (1,3)},
                           {'type': ITEM_TYPES['STICK'], 'weight': 40, 'count': (1,2)}]},
    'goblin':   {'health': 25,  'damage': 6,  'speed': 3.5, 'attack_range': 1.5, 'detection_range': 10.0, 'xp_reward': 15,
                 'loot': [{'type': ITEM_TYPES['STONE'], 'weight': 50, 'count': (1,2)},
                           {'type': ITEM_TYPES['COAL'],  'weight': 30, 'count': (1,3)}]},
    'slime':    {'health': 60,  'damage': 5,  'speed': 1.5, 'attack_range': 1.5, 'detection_range': 8.0,  'xp_reward': 10,
                 'loot': []},
    'spider':   {'health': 40,  'damage': 10, 'speed': 4.0, 'attack_range': 1.8, 'detection_range': 14.0, 'xp_reward': 22,
                 'loot': [{'type': ITEM_TYPES['STICK'], 'weight': 60, 'count': (1,2)}]},
    'troll':    {'health': 150, 'damage': 20, 'speed': 1.0, 'attack_range': 3.0, 'detection_range': 10.0, 'xp_reward': 60,
                 'loot': [{'type': ITEM_TYPES['STONE'],      'weight': 90, 'count': (3,8)},
                           {'type': ITEM_TYPES['IRON_INGOT'], 'weight': 40, 'count': (1,3)},
                           {'type': ITEM_TYPES['GOLD_INGOT'], 'weight': 15, 'count': (1,2)}]},
    # Animal mobs - passive or defensive
    'deer':     {'health': 30,  'damage': 0,  'speed': 5.0, 'attack_range': 0, 'detection_range': 12.0, 'xp_reward': 15,
                 'loot': [{'type': ITEM_TYPES['MEAT'],       'weight': 80, 'count': (1,3)},
                           {'type': ITEM_TYPES['HIDE'],        'weight': 60, 'count': (1,2)},
                           {'type': ITEM_TYPES['BONE'],        'weight': 40, 'count': (1,2)}]},
    'boar':     {'health': 40,  'damage': 8,  'speed': 4.0, 'attack_range': 1.5, 'detection_range': 8.0, 'xp_reward': 20,
                 'loot': [{'type': ITEM_TYPES['MEAT'],       'weight': 90, 'count': (2,4)},
                           {'type': ITEM_TYPES['HIDE'],        'weight': 50, 'count': (1,2)},
                           {'type': ITEM_TYPES['TEETH'],       'weight': 30, 'count': (1,3)}]},
    'sheep':    {'health': 25,  'damage': 0,  'speed': 3.5, 'attack_range': 0, 'detection_range': 8.0, 'xp_reward': 10,
                 'loot': [{'type': ITEM_TYPES['WOOL_BUNDLE'], 'weight': 100, 'count': (1,3)},
                           {'type': ITEM_TYPES['MEAT'],        'weight': 60, 'count': (1,2)}]},
    'cow':      {'health': 60,  'damage': 0,  'speed': 2.5, 'attack_range': 0, 'detection_range': 6.0, 'xp_reward': 25,
                 'loot': [{'type': ITEM_TYPES['MEAT'],        'weight': 90, 'count': (3,6)},
                           {'type': ITEM_TYPES['HIDE'],        'weight': 80, 'count': (2,3)},
                           {'type': ITEM_TYPES['BONE'],        'weight': 50, 'count': (2,4)}]},
    'rabbit':   {'health': 15,  'damage': 0,  'speed': 6.0, 'attack_range': 0, 'detection_range': 10.0, 'xp_reward': 8,
                 'loot': [{'type': ITEM_TYPES['MEAT'],        'weight': 70, 'count': (1,1)},
                           {'type': ITEM_TYPES['FUR'],         'weight': 60, 'count': (1,2)},
                           {'type': ITEM_TYPES['BONE'],        'weight': 20, 'count': (1,2)}]},
    'wolf':     {'health': 50,  'damage': 12, 'speed': 4.5, 'attack_range': 2.0, 'detection_range': 16.0, 'xp_reward': 30,
                 'loot': [{'type': ITEM_TYPES['MEAT'],        'weight': 70, 'count': (2,3)},
                           {'type': ITEM_TYPES['FUR'],         'weight': 80, 'count': (1,2)},
                           {'type': ITEM_TYPES['TEETH'],       'weight': 50, 'count': (1,2)}]},
    'bear':     {'health': 120, 'damage': 18, 'speed': 3.0, 'attack_range': 2.5, 'detection_range': 12.0, 'xp_reward': 50,
                 'loot': [{'type': ITEM_TYPES['MEAT'],        'weight': 90, 'count': (4,8)},
                           {'type': ITEM_TYPES['FUR'],         'weight': 70, 'count': (2,3)},
                           {'type': ITEM_TYPES['CLAWS'],       'weight': 60, 'count': (2,4)},
                           {'type': ITEM_TYPES['FAT'],         'weight': 40, 'count': (1,3)}]},
    'chicken':  {'health': 10,  'damage': 0,  'speed': 4.0, 'attack_range': 0, 'detection_range': 6.0, 'xp_reward': 5,
                 'loot': [{'type': ITEM_TYPES['MEAT'],        'weight': 60, 'count': (1,1)},
                           {'type': ITEM_TYPES['FEATHERS'],    'weight': 80, 'count': (2,4)},
                           {'type': ITEM_TYPES['EGGS'],        'weight': 30, 'count': (1,2)}]},
}

class Player:
    def __init__(self, username: str, player_id: str):
        self.id = player_id
        self.username = username
        self.position = [0.0, 80.0, 0.0]  # Start above ground
        self.velocity = [0.0, 0.0, 0.0]
        self.rotation = [0.0, 0.0]  # yaw, pitch
        self.inventory = Inventory()
        self.health = 100
        self.max_health = 100
        self.last_damage_time = 0
        self.damage_cooldown = 1.0  # 1 second between damage
        self.equipped_weapon = None
        self.equipped_armor = {
            'helmet': None,
            'chestplate': None,
            'leggings': None,
            'boots': None
        }
        self.item_lock_enabled = True  # Players can toggle this
        self.on_ground = False  # Track if player is on ground
        
        # RPG stats
        self.mana = 50
        self.max_mana = 50
        self.experience = 0
        self.level = 1
        self.experience_to_next_level = 100
        
        # Anti-cheat tracking
        self.last_position = self.position.copy()
        self.last_move_time = time.time()
        self.last_block_break_time = 0
        self.last_block_place_time = 0
        self.speed_violations = 0
    
    def take_damage(self, damage: float, attacker_id: str = None) -> bool:
        """Apply damage to player, returns True if player died"""
        current_time = time.time()
        if current_time - self.last_damage_time < self.damage_cooldown:
            return False
        
        # Calculate armor reduction
        total_protection = 0
        for armor_piece in self.equipped_armor.values():
            if armor_piece:
                # Armor reduces damage by a percentage based on protection value
                total_protection += armor_piece.get('protection', 0)
        
        armor_reduction = min(0.8, total_protection * 0.04)  # Max 80% reduction
        actual_damage = damage * (1 - armor_reduction)
        
        old_health = self.health
        self.health = max(0, self.health - actual_damage)
        self.last_damage_time = current_time
        
        # Log damage details
        attacker_name = "Unknown"
        if attacker_id:
            if attacker_id in self.world.players:
                attacker_name = self.world.players[attacker_id].username
            else:
                # Check if it's a mob
                for mob in self.world.mobs.values():
                    if mob.id == attacker_id:
                        attacker_name = mob.type
                        break
        
        logger.info(f"PLAYER DAMAGE: {self.username} took {actual_damage:.1f} damage (raw: {damage:.1f}) "
                   f"from {attacker_name}. HP: {old_health:.1f} → {self.health:.1f}. "
                   f"Armor reduction: {armor_reduction*100:.1f}%")
        
        return self.health <= 0
    
    def heal(self, amount: float):
        """Heal the player"""
        self.health = min(self.max_health, self.health + amount)
    
    def get_attack_damage(self) -> float:
        """Get the player's attack damage based on equipped weapon"""
        if self.equipped_weapon:
            return self.equipped_weapon.get('damage', 1)
        return 1  # Fist damage
    
    def equip_item(self, item: Dict[str, Any], slot: str):
        """Equip an item in the appropriate slot"""
        item_type = item.get('type')
        
        # Check if it's a weapon
        if 100 <= item_type < 110:  # Sword range
            self.equipped_weapon = {
                'type': item_type,
                'damage': item.get('damage', 4),
                'durability': item.get('durability', 100)
            }
            return True
        
        # Check if it's armor
        armor_slots = {
            200: 'helmet', 201: 'chestplate', 202: 'leggings', 203: 'boots',  # Leather
            210: 'helmet', 211: 'chestplate', 212: 'leggings', 213: 'boots',  # Iron
            220: 'helmet', 221: 'chestplate', 222: 'leggings', 223: 'boots'   # Diamond
        }
        
        if item_type in armor_slots:
            armor_slot = armor_slots[item_type]
            self.equipped_armor[armor_slot] = {
                'type': item_type,
                'protection': item.get('protection', 1),
                'durability': item.get('durability', 100)
            }
            return True
        
        return False
    
    def give_experience(self, amount: int):
        """Give experience to player, handle level ups"""
        self.experience += amount
        leveled_up = False
        
        # Check for level up
        while self.experience >= self.experience_to_next_level:
            self.experience -= self.experience_to_next_level
            self.level += 1
            self.experience_to_next_level = int(self.experience_to_next_level * 1.5)
            self.max_health += 10
            self.health = self.max_health  # Full heal on level up
            self.max_mana += 10
            self.mana = self.max_mana  # Full mana on level up
            leveled_up = True
        
        return leveled_up
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert player to dictionary for network transmission"""
        return {
            'id': self.id,
            'username': self.username,
            'position': self.position,
            'rotation': self.rotation,
            'health': self.health,
            'max_health': self.max_health,
            'mana': self.mana,
            'max_mana': self.max_mana,
            'experience': self.experience,
            'level': self.level,
            'experience_to_next_level': self.experience_to_next_level
        }

class Inventory:
    def __init__(self, size: int = 36):
        self.slots = [None] * size  # slots 0-8 = quickbar, 9-35 = main inventory
        self.selected_slot = 0
    
    def add_item(self, item_type: int, count: int = 1) -> int:
        """Add items, returns number that couldn't be added"""
        remaining = count
        max_stack = ITEM_MAX_STACK.get(item_type, 64)
        
        # First try to stack with existing items
        for i, slot in enumerate(self.slots):
            if remaining <= 0:
                break
            if slot and slot['type'] == item_type and slot['count'] < max_stack:
                can_add = min(remaining, max_stack - slot['count'])
                self.slots[i]['count'] += can_add
                remaining -= can_add
        
        # Then try empty slots
        for i, slot in enumerate(self.slots):
            if remaining <= 0:
                break
            if slot is None:
                to_add = min(remaining, max_stack)
                self.slots[i] = {'type': item_type, 'count': to_add}
                remaining -= to_add
        
        return remaining
    
    def remove_item(self, slot_index: int, count: int = 1) -> Optional[dict]:
        """Remove items from a slot, returns what was removed"""
        if slot_index < 0 or slot_index >= len(self.slots):
            return None
        slot = self.slots[slot_index]
        if not slot:
            return None
        
        removed_count = min(count, slot['count'])
        removed = {'type': slot['type'], 'count': removed_count}
        slot['count'] -= removed_count
        if slot['count'] <= 0:
            self.slots[slot_index] = None
        return removed
    
    def get_selected_item(self) -> Optional[dict]:
        """Get the item in the selected quickbar slot"""
        if self.selected_slot < len(self.slots):
            return self.slots[self.selected_slot]
        return None
    
    def swap_slots(self, from_idx: int, to_idx: int):
        """Swap two inventory slots"""
        if (0 <= from_idx < len(self.slots) and 0 <= to_idx < len(self.slots)):
            self.slots[from_idx], self.slots[to_idx] = self.slots[to_idx], self.slots[from_idx]
    
    def to_dict(self):
        return {
            'slots': self.slots,
            'selectedSlot': self.selected_slot
        }


class Container:
    """A container in the world (e.g., chest) that holds items"""
    def __init__(self, x: int, y: int, z: int, size: int = 27):
        self.x = x
        self.y = y
        self.z = z
        self.size = size
        self.slots = [None] * size
    
    def add_loot(self, item_type: int, count: int = 1):
        """Add loot to a random empty slot"""
        empty = [i for i, s in enumerate(self.slots) if s is None]
        if empty:
            idx = random.choice(empty)
            self.slots[idx] = {'type': item_type, 'count': count}
    
    def to_dict(self):
        return {
            'x': self.x, 'y': self.y, 'z': self.z,
            'size': self.size,
            'slots': self.slots
        }

class World:
    def __init__(self, db=None, world_generator=None):
        self.chunks = {}
        self.containers = {}  # position string -> Container
        self.item_entities = {}  # position string -> {type, harvester_id, spawn_time}
        self.db = db
        self.world_generator = world_generator
        self.generate_initial_world()
    
    def generate_initial_world(self):
        """Generate some initial chunks around spawn"""
        for x in range(-2, 3):
            for z in range(-2, 3):
                self.generate_chunk(x, z)
    
    def generate_chunk(self, chunk_x: int, chunk_z: int) -> List[int]:
        """Generate a chunk using the new layered world generation system."""
        result = self.world_generator.generate_chunk(chunk_x, chunk_z)
        
        # Worldgen block IDs already match shared/constants.py BLOCK_TYPES.
        # No conversion needed - just store and return directly.
        chunk_key = f"{chunk_x},{chunk_z}"
        self.chunks[chunk_key] = result.blocks
        return result.blocks
    
    def get_chunk(self, chunk_x: int, chunk_z: int) -> List[int]:
        chunk_key = f"{chunk_x},{chunk_z}"
        if chunk_key not in self.chunks:
            # Try to load from database first
            if self.db:
                loaded_chunk = self.db.load_chunk(chunk_x, chunk_z)
                if loaded_chunk:
                    self.chunks[chunk_key] = loaded_chunk
                    return loaded_chunk
            # Generate new chunk if not found in database
            return self.generate_chunk(chunk_x, chunk_z)
        return self.chunks[chunk_key]
    
    def get_block(self, x: int, y: int, z: int) -> int:
        if y < 0 or y >= CHUNK_HEIGHT:
            return BLOCK_TYPES['AIR']
        
        chunk_x = x // CHUNK_SIZE
        chunk_z = z // CHUNK_SIZE
        local_x = x % CHUNK_SIZE
        local_z = z % CHUNK_SIZE
        
        chunk = self.get_chunk(chunk_x, chunk_z)
        index = self.get_block_index(local_x, y, local_z)
        return chunk[index]
    
    def set_block(self, x: int, y: int, z: int, block_type: int) -> bool:
        """Set a block at the given position"""
        if y < 0 or y >= CHUNK_HEIGHT:
            return False

        chunk_x = x // CHUNK_SIZE
        chunk_z = z // CHUNK_SIZE
        chunk_key = f"{chunk_x},{chunk_z}"

        if chunk_key not in self.chunks:
            return False

        chunk = self.chunks[chunk_key]
        local_x = x % CHUNK_SIZE
        local_z = z % CHUNK_SIZE

        index = self.get_block_index(local_x, y, local_z)
        chunk[index] = block_type
        return True
    
    def spawn_item_entity(self, x: float, y: float, z: float, item_type: int, harvester_id: str = None, count: int = 1):
        """Register an item entity with timestamp"""
        key = f"{int(x)},{int(y)},{int(z)}"
        self.item_entities[key] = {
            'type': item_type,
            'harvester_id': harvester_id,
            'count': count,
            'spawn_time': time.time()
        }
    
    def can_collect_item(self, x: int, y: int, z: int, collector_id: str) -> bool:
        """Check if a player can collect an item"""
        key = f"{x},{y},{z}"
        entity = self.item_entities.get(key)
        if not entity:
            return True  # No entity, free to collect
        
        # Check timeout
        if time.time() - entity['spawn_time'] > ITEM_LOCK_TIMEOUT:
            return True  # Lock expired
        
        # Check harvester
        return entity['harvester_id'] is None or entity['harvester_id'] == collector_id
    
    def remove_item_entity(self, x: int, y: int, z: int):
        """Remove an item entity"""
        key = f"{x},{y},{z}"
        self.item_entities.pop(key, None)
    
    def get_block_index(self, x: int, y: int, z: int) -> int:
        return y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x

class VoxelServer:
    def __init__(self):
        self.clients: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.players: Dict[str, Player] = {}
        self.sessions: Dict[str, str] = {}  # client_id -> session_id
        self.db = Database()
        self.world_generator = WorldGenerator("fantasy_rpg_world")  # Use deterministic seed
        self.world = World(self.db, self.world_generator)
        self.running = True
        self.last_save_time = time.time()
        self.save_interval = 300  # Save every 5 minutes
        self.chunk_load_distance = 4  # Load chunks within this distance
        self.chunk_unload_distance = 6  # Unload chunks beyond this distance
        self.player_chunk_positions = {}  # Track player positions for chunk management
        self.client_loaded_chunks: Dict[str, set] = {}  # client_id -> set of (cx,cz) sent
        self.mob_manager = MobManager()
        
        # NPC and quest system
        self.npcs: Dict[str, NPC] = {}
        self.quests: Dict[str, Quest] = {}
        self.player_quests: Dict[str, List[str]] = {}  # player_id -> list of quest_ids
        
        # Initialize NPCs and quests
        self.initialize_npcs()
        self.initialize_quests()
    
    def initialize_npcs(self):
        """Initialize NPCs in the world"""
        # Create some sample NPCs
        npc1 = NPC("npc_blacksmith", "Blacksmith", [10.0, 34.0, 10.0], "blacksmith")
        npc1.dialogue_tree = {
            'default': {
                'text': "Welcome to my forge! I can teach you how to craft powerful weapons and armor.",
                'options': [
                    {'text': 'Tell me about crafting.', 'next': 'crafting'},
                    {'text': 'Give me a quest.', 'next': 'quest'},
                    {'text': 'Goodbye.', 'next': 'exit'}
                ]
            },
            'crafting': {
                'text': "Crafting requires materials. Gather resources from the world, then use the crafting panel (press C).",
                'options': [
                    {'text': 'What materials do I need?', 'next': 'materials'},
                    {'text': 'Back', 'next': 'default'}
                ]
            },
            'materials': {
                'text': "Wood comes from trees, stone from mountains, and metals from ore. Use your pickaxe to mine!",
                'options': [
                    {'text': 'Thanks!', 'next': 'default'}
                ]
            },
            'quest': {
                'text': "I need someone to gather materials for me. Bring me 10 iron ingots and I'll reward you.",
                'options': [
                    {'text': 'Accept quest', 'action': 'accept_quest', 'quest_id': 'gather_iron'},
                    {'text': 'Maybe later', 'next': 'default'}
                ]
            }
        }
        
        npc2 = NPC("npc_merchant", "Merchant", [-10.0, 34.0, -10.0], "merchant")
        npc2.dialogue_tree = {
            'default': {
                'text': "Greetings, traveler! I trade in rare goods and offer quests for the adventurous.",
                'options': [
                    {'text': 'What do you have for sale?', 'next': 'trade'},
                    {'text': 'Any work available?', 'next': 'quests'},
                    {'text': 'Farewell.', 'next': 'exit'}
                ]
            },
            'trade': {
                'text': "I'm looking for diamonds and rare ores. Bring me what you find and I'll pay well!",
                'options': [
                    {'text': 'I\'ll keep that in mind.', 'next': 'default'}
                ]
            },
            'quests': {
                'text': "I need someone to deliver a package to the blacksmith. It's urgent!",
                'options': [
                    {'text': 'I\'ll deliver it.', 'action': 'accept_quest', 'quest_id': 'delivery_quest'},
                    {'text': 'Not right now.', 'next': 'default'}
                ]
            }
        }
        
        self.npcs[npc1.id] = npc1
        self.npcs[npc2.id] = npc2
    
    def initialize_quests(self):
        """Initialize available quests"""
        # Gather quest
        quest1 = Quest("gather_iron", "Iron Gathering", "Bring 10 iron ingots to the blacksmith")
        quest1.type = "gather"
        quest1.requirements = [
            {'type': 'item', 'item_type': 302, 'count': 10}  # 10 iron ingots
        ]
        quest1.rewards = [
            {'type': 'item', 'item_type': 304, 'count': 2},  # 2 diamonds
            {'type': 'experience', 'amount': 100}
        ]
        quest1.completion_text = "Excellent! These iron ingots will help me craft many fine weapons. Here's your reward!"
        
        # Delivery quest
        quest2 = Quest("delivery_quest", "Package Delivery", "Deliver a package to the blacksmith")
        quest2.type = "deliver"
        quest2.requirements = [
            {'type': 'item', 'item_type': 305, 'count': 1}  # Special package item
        ]
        quest2.rewards = [
            {'type': 'item', 'item_type': 301, 'count': 20},  # 20 coal
            {'type': 'experience', 'amount': 50}
        ]
        quest2.completion_text = "Thank you for delivering this! The merchant sends his regards."
        
        self.quests[quest1.id] = quest1
        self.quests[quest2.id] = quest2
    
    async def handle_client(self, websocket):
        """Handle individual client connection"""
        client_id = str(uuid.uuid4())
        logger.info(f"Client connected: {client_id}")
        
        self.clients[client_id] = websocket
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.handle_message(client_id, data)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON from client {client_id}")
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.handle_disconnect(client_id)
    
    async def handle_disconnect(self, client_id: str):
        """Handle client disconnection"""
        logger.info(f"Client disconnected: {client_id}")
        
        # Remove player from game
        if client_id in self.players:
            player = self.players[client_id]
            
            # Save player data
            self.db.save_player(
                client_id,
                player.username,
                {'x': player.position[0], 'y': player.position[1], 'z': player.position[2]},
                player.inventory.to_dict(),
                player.health
            )
            
            # Notify other players (avoid recursion)
            message = json.dumps({
                'type': MESSAGE_TYPES['PLAYER_LEAVE'],
                'data': {'playerId': client_id}
            })
            for cid, websocket in self.clients.items():
                if cid != client_id:
                    try:
                        await websocket.send(message)
                    except websockets.exceptions.ConnectionClosed:
                        # Mark for cleanup but don't call handle_disconnect to avoid recursion
                        pass
            
            # Remove player
            del self.players[client_id]
        
        # Remove websocket
        if client_id in self.clients:
            del self.clients[client_id]
        
        # Clean up chunk tracking
        if client_id in self.client_loaded_chunks:
            del self.client_loaded_chunks[client_id]
        
        # Remove session
        if client_id in self.sessions:
            session_id = self.sessions[client_id]
            self.db.delete_session(session_id)
            del self.sessions[client_id]
    
    async def handle_register(self, client_id: str, data: Dict[str, Any]) -> bool:
        """Handle user registration"""
        username = data.get('username', '').strip().lower()
        password = data.get('password', '')
        email = data.get('email', '').strip() or None
        
        # Validate input
        if len(username) < 3 or len(username) > 20:
            await self.send_to_client(client_id, 'error', {
                'message': 'Username must be between 3 and 20 characters'
            })
            return False
        
        if len(password) < 6:
            await self.send_to_client(client_id, 'error', {
                'message': 'Password must be at least 6 characters'
            })
            return False
        
        # Create user
        user_id = self.db.create_user(username, password, email)
        if not user_id:
            await self.send_to_client(client_id, 'error', {
                'message': 'Username already exists'
            })
            return False
        
        # Create session
        session_id = self.db.create_session(user_id)
        if not session_id:
            await self.send_to_client(client_id, 'error', {
                'message': 'Failed to create session'
            })
            return False
        
        # Store session with client
        self.clients[client_id].session_id = session_id
        
        await self.send_to_client(client_id, 'auth_success', {
            'session_id': session_id,
            'user_id': user_id,
            'username': username
        })
        
        logger.info(f"User {username} registered successfully")
        return True
    
    async def handle_login(self, client_id: str, data: Dict[str, Any]) -> bool:
        """Handle user login"""
        username = data.get('username', '').strip().lower()
        password = data.get('password', '')
        
        # Authenticate user
        user = self.db.authenticate_user(username, password)
        if not user:
            await self.send_to_client(client_id, 'error', {
                'message': 'Invalid username or password'
            })
            return False
        
        # Check if banned
        if user.get('is_banned'):
            await self.send_to_client(client_id, 'error', {
                'message': f'Account banned: {user.get("ban_reason", "No reason provided")}'
            })
            return False
        
        # Create session
        session_id = self.db.create_session(user['id'])
        if not session_id:
            await self.send_to_client(client_id, 'error', {
                'message': 'Failed to create session'
            })
            return False
        
        # Store session with client
        self.clients[client_id].session_id = session_id
        
        await self.send_to_client(client_id, 'auth_success', {
            'session_id': session_id,
            'user_id': user['id'],
            'username': user['username']
        })
        
        logger.info(f"User {username} logged in successfully")
        return True
    
    async def handle_logout(self, client_id: str):
        """Handle user logout"""
        websocket = self.clients.get(client_id)
        if websocket and hasattr(websocket, 'session_id'):
            session_id = websocket.session_id
            self.db.revoke_session(session_id)
            delattr(websocket, 'session_id')
            logger.info(f"Client {client_id} logged out")
    
    async def handle_message(self, client_id: str, message: Dict[str, Any]):
        """Handle incoming message from client"""
        message_type = message.get('type')
        data = message.get('data', {})
        
        # Handle authentication messages
        if message_type == MESSAGE_TYPES['REGISTER']:
            await self.handle_register(client_id, data)
            return
        elif message_type == MESSAGE_TYPES['LOGIN']:
            await self.handle_login(client_id, data)
            return
        elif message_type == MESSAGE_TYPES['LOGOUT']:
            await self.handle_logout(client_id)
            return
        
        # Check if authenticated for other messages
        websocket = self.clients.get(client_id)
        if not websocket or not hasattr(websocket, 'session_id'):
            await self.send_to_client(client_id, 'error', {
                'message': 'Not authenticated'
            })
            return
        
        # Validate session
        session_data = self.db.validate_session(websocket.session_id)
        if not session_data:
            await self.send_to_client(client_id, 'error', {
                'message': 'Session expired'
            })
            await self.handle_logout(client_id)
            return
        
        # Handle game messages
        if message_type == MESSAGE_TYPES['JOIN']:
            await self.handle_join(client_id, data)
        elif message_type == MESSAGE_TYPES['MOVE']:
            await self.handle_move(client_id, data)
        elif message_type == MESSAGE_TYPES['JUMP']:
            await self.handle_jump(client_id)
        elif message_type == MESSAGE_TYPES['PLACE_BLOCK']:
            await self.handle_place_block(client_id, data)
        elif message_type == MESSAGE_TYPES['BREAK_BLOCK']:
            await self.handle_break_block(client_id, data)
        elif message_type == MESSAGE_TYPES['INTERACT']:
            await self.handle_interact(client_id, data)
        elif message_type == MESSAGE_TYPES['OPEN_CONTAINER']:
            await self.handle_open_container(client_id, data)
        elif message_type == MESSAGE_TYPES['CLOSE_CONTAINER']:
            await self.handle_close_container(client_id, data)
        elif message_type == MESSAGE_TYPES['MOVE_ITEM']:
            await self.handle_move_item(client_id, data)
        elif message_type == MESSAGE_TYPES['SELECT_QUICKBAR']:
            await self.handle_select_quickbar(client_id, data)
        elif message_type == MESSAGE_TYPES['COLLECT_ITEM']:
            await self.handle_collect_item(client_id, data)
        elif message_type == MESSAGE_TYPES['TOGGLE_ITEM_LOCK']:
            await self.handle_toggle_item_lock(client_id, data)
        elif message_type == MESSAGE_TYPES['NPC_INTERACT']:
            await self.handle_npc_interact(client_id, data)
        elif message_type == MESSAGE_TYPES['COMBAT_HIT']:
            await self.handle_combat_hit(client_id, data)
        elif message_type == MESSAGE_TYPES['EQUIP_ITEM']:
            await self.handle_equip_item(client_id, data)
        elif message_type == MESSAGE_TYPES['UNEQUIP_ITEM']:
            await self.handle_unequip_item(client_id, data)
        elif message_type == MESSAGE_TYPES['DROP_ITEM']:
            await self.handle_drop_item(client_id, data)
        elif message_type == MESSAGE_TYPES['CRAFT_ITEM']:
            await self.handle_craft_item(client_id, data)
    
    async def handle_collect_item(self, client_id: str, data: Dict[str, Any]):
        """Handle collecting an item entity"""
        player = self.players.get(client_id)
        if not player:
            return
        
        position = data.get('position')
        if not position:
            return
        
        if not self.world.can_collect_item(
            int(position['x']), 
            int(position['y']), 
            int(position['z']), 
            client_id
        ):
            return
        
        # Add item to inventory (server-side)
        item_type = data.get('type')
        if item_type:
            player.inventory.add_item(item_type, 1)
            await self.send_to_client(client_id, MESSAGE_TYPES['INVENTORY_UPDATE'],
                player.inventory.to_dict())
            
            # Check quest progress
            await self.handle_quest_progress(client_id, {})
            
            # Remove the entity
            self.world.remove_item_entity(
                int(position['x']), 
                int(position['y']), 
                int(position['z'])
            )
            
            # Broadcast to all clients to remove the visual entity
            await self.broadcast(MESSAGE_TYPES['REMOVE_ITEM_ENTITY'], {
                'x': position['x'],
                'y': position['y'],
                'z': position['z']
            })
    
    async def handle_toggle_item_lock(self, client_id: str, data: Dict[str, Any]):
        """Toggle item lock for player"""
        player = self.players.get(client_id)
        if not player:
            return
        
        player.item_lock_enabled = not player.item_lock_enabled
        
        await self.send_to_client(client_id, MESSAGE_TYPES['ITEM_LOCK_STATUS'], {
            'enabled': player.item_lock_enabled
        })
        
        status = "enabled" if player.item_lock_enabled else "disabled"
        await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
            'message': f'Item lock {status}'
        })
    
    async def handle_chat_message(self, client_id: str, data: Dict[str, Any]):
        """Handle chat messages from players"""
        player = self.players.get(client_id)
        if not player:
            return
        
        message = data.get('message', '')
        if not message:
            return
        
        # Broadcast chat message to all players
        await self.broadcast(MESSAGE_TYPES['CHAT_MESSAGE'], {
            'username': player.username,
            'message': message
        })
    
    async def handle_drop_item(self, client_id: str, data: Dict[str, Any]):
        """Handle player dropping items from inventory"""
        player = self.players.get(client_id)
        if not player:
            return
        
        slot = data.get('slot')
        count = data.get('count', 1)
        
        if slot is None or slot < 0 or slot >= len(player.inventory.slots):
            return
        
        item_slot = player.inventory.slots[slot]
        if not item_slot:
            return
        
        # Check if player has enough items
        if item_slot['count'] < count:
            count = item_slot['count']
        
        # Remove from inventory
        item_slot['count'] -= count
        if item_slot['count'] <= 0:
            player.inventory.slots[slot] = None
        
        # Spawn item entity at player position
        item_type = item_slot['type']
        pos = player.position
        self.world.spawn_item_entity(
            int(pos[0]), int(pos[1]), int(pos[2]),
            item_type, client_id, count
        )
        
        # Broadcast spawn
        await self.broadcast(MESSAGE_TYPES['SPAWN_ITEM_ENTITY'], {
            'x': pos[0],
            'y': pos[1],
            'z': pos[2],
            'type': item_type,
            'harvester_id': client_id,
            'count': count
        })
        
        # Update inventory
        await self.send_to_client(client_id, MESSAGE_TYPES['INVENTORY_UPDATE'],
            player.inventory.to_dict())
    
    async def handle_craft_item(self, client_id: str, data: Dict[str, Any]):
        """Handle crafting requests"""
        player = self.players.get(client_id)
        if not player:
            return
        
        recipe_id = data.get('recipe')
        if not recipe_id or recipe_id not in CRAFTING_RECIPES:
            return
        
        recipe = CRAFTING_RECIPES[recipe_id]
        
        # Check if player has all required ingredients
        can_craft = True
        for ingredient in recipe['ingredients']:
            item_type = ingredient['type']
            required_count = ingredient['count']
            
            # Count items in inventory
            available_count = 0
            for slot in player.inventory.slots:
                if slot and slot['type'] == item_type:
                    available_count += slot['count']
            
            if available_count < required_count:
                can_craft = False
                break
        
        if not can_craft:
            await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
                'message': 'Not enough materials to craft this item!'
            })
            return
        
        # Remove ingredients from inventory
        for ingredient in recipe['ingredients']:
            item_type = ingredient['type']
            required_count = ingredient['count']
            
            remaining = required_count
            for slot in player.inventory.slots:
                if slot and slot['type'] == item_type and remaining > 0:
                    remove_count = min(slot['count'], remaining)
                    slot['count'] -= remove_count
                    remaining -= remove_count
                    
                    if slot['count'] <= 0:
                        slot['type'] = None
                        slot['count'] = 0
                        slot = None
        
        # Add crafted items to inventory
        result_type = recipe['result']['type']
        result_count = recipe['result']['count']
        remaining = result_count
        
        while remaining > 0:
            added = player.inventory.add_item(result_type, remaining)
            remaining -= (result_count - added)
        
        # Update inventory
        await self.send_to_client(client_id, MESSAGE_TYPES['INVENTORY_UPDATE'],
            player.inventory.to_dict())
        
        # Send success message
        item_name = ITEM_NAMES.get(result_type, f'Item {result_type}')
        await self.send_to_client(client_id, MESSAGE_TYPES['CRAFT_ITEM'], {
            'success': True,
            'itemName': item_name,
            'count': result_count
        })
    
    async def handle_join(self, client_id: str, data: Dict[str, Any]):
        """Handle player joining"""
        username = data.get('username', f'Player_{client_id[:8]}')
        
        # Try to load existing player data
        player_data = self.db.load_player(client_id)
        
        if player_data:
            # Load existing player
            player = Player(username, client_id)
            player.position = [
                float(player_data['position']['x']),
                float(player_data['position']['y']),
                float(player_data['position']['z'])
            ]
            player.health = player_data['health']
            # Load inventory
            for item in player_data['inventory']:
                player.inventory.add_item(item['type'], item['count'])
            logger.info(f"Loaded existing player {username} at {player.position}")
        else:
            # Create new player
            player = Player(username, client_id)
            
            # Find a good spawn position above ground
            spawn_x = 0
            spawn_z = 0
            spawn_y = 100  # Start high
            
            # Find ground level at spawn position
            for y in range(100, 0, -1):
                if self.world.get_block(spawn_x, y, spawn_z) != BLOCK_TYPES['AIR']:
                    spawn_y = y + 2  # Spawn 2 blocks above ground
                    break
            
            player.position = [float(spawn_x), float(spawn_y), float(spawn_z)]
            
            # Give starter items
            player.inventory.add_item(ITEM_TYPES['WOODEN_PICKAXE'], 1)
            player.inventory.add_item(ITEM_TYPES['WOODEN_SWORD'], 1)
            player.inventory.add_item(ITEM_TYPES['WOOD'], 32)
            player.inventory.add_item(ITEM_TYPES['PLANKS'], 32)
            player.inventory.add_item(ITEM_TYPES['COBBLESTONE'], 32)
            player.inventory.add_item(ITEM_TYPES['STONE'], 32)
            player.inventory.add_item(ITEM_TYPES['DIRT'], 16)
            player.inventory.add_item(ITEM_TYPES['GLASS'], 8)
            player.inventory.add_item(ITEM_TYPES['STICK'], 16)
            
            logger.info(f"Created new player {username} at {player.position}")
        
        self.players[client_id] = player
        
        # Send initial chunks around player AFTER setting position
        await self.send_initial_chunks(client_id)
        
        # Send NPCs to client
        logger.info(f"Sending {len(self.npcs)} NPCs to client {client_id}")
        for npc_id, npc in self.npcs.items():
            logger.info(f"Sending NPC {npc_id}: {npc.name} at {npc.position}")
            await self.send_to_client(client_id, MESSAGE_TYPES['NPC_SPAWN'], {
                'npc_id': npc_id,
                'name': npc.name,
                'position': npc.position,
                'type': npc.type,
                'rotation': npc.rotation
            })
        
        # Send inventory
        await self.send_to_client(client_id, MESSAGE_TYPES['INVENTORY_UPDATE'],
            player.inventory.to_dict())
        
        # Send player stats
        await self.send_to_client(client_id, MESSAGE_TYPES['PLAYER_STATS'], {
            'health': player.health,
            'max_health': player.max_health,
            'mana': player.mana,
            'max_mana': player.max_mana,
            'experience': player.experience,
            'level': player.level,
            'experience_to_next_level': player.experience_to_next_level
        })
        
        # Send equipment state so client panel is populated on login
        await self.send_to_client(client_id, MESSAGE_TYPES['EQUIPMENT_UPDATE'], {
            'equipped_weapon': player.equipped_weapon,
            'equipped_armor': player.equipped_armor
        })
        
        # Notify other players
        await self.broadcast(MESSAGE_TYPES['PLAYER_JOIN'], {
            'playerId': client_id,
            'username': player.username,
            'position': player.position
        }, exclude_client=client_id)
        
        # Send current game state
        players_data = []
        for p in self.players.values():
            player_data = {
                'id': p.id,
                'username': p.username,
                'position': p.position
            }
            # Include stats for the joining player
            if p.id == client_id:
                player_data.update({
                    'health': p.health,
                    'max_health': p.max_health,
                    'mana': p.mana,
                    'max_mana': p.max_mana,
                    'experience': p.experience,
                    'level': p.level,
                    'experience_to_next_level': p.experience_to_next_level
                })
            players_data.append(player_data)
        
        await self.send_to_client(client_id, MESSAGE_TYPES['GAME_STATE'], {
            'playerId': client_id,
            'players': players_data
        })
        
        logger.info(f"Player {username} joined the game at position {player.position}")
    
    async def handle_move(self, client_id: str, data: Dict[str, Any]):
        """Handle player movement"""
        player = self.players.get(client_id)
        if not player:
            return
        
        new_position = data.get('position', player.position)
        new_velocity = data.get('velocity', player.velocity)
        
        # Validate position data
        if not isinstance(new_position, (list, tuple)) or len(new_position) != 3:
            logger.warning(f"Invalid position format from {client_id}: {new_position}")
            return
        
        # Validate velocity data
        if not isinstance(new_velocity, (list, tuple)) or len(new_velocity) != 3:
            logger.warning(f"Invalid velocity format from {client_id}: {new_velocity}")
            return
        
        # Check for NaN or infinite values
        try:
            if any(not math.isfinite(v) for v in new_position):
                logger.warning(f"Non-finite position values from {client_id}: {new_position}")
                return
            if any(not math.isfinite(v) for v in new_velocity):
                logger.warning(f"Non-finite velocity values from {client_id}: {new_velocity}")
                return
        except (TypeError, ValueError):
            logger.warning(f"Invalid numeric values from {client_id}")
            return
        
        # Validate movement
        if not self.validate_movement(player, new_position):
            # Send correction back to player
            await self.send_to_client(client_id, MESSAGE_TYPES['PLAYER_MOVE'], {
                'playerId': client_id,
                'position': player.position,
                'velocity': player.velocity
            })
            return
        
        old_chunk_x = int(player.position[0] // CHUNK_SIZE)
        old_chunk_z = int(player.position[2] // CHUNK_SIZE)
        
        player.position = new_position
        player.velocity = data.get('velocity', player.velocity)
        
        new_chunk_x = int(player.position[0] // CHUNK_SIZE)
        new_chunk_z = int(player.position[2] // CHUNK_SIZE)
        
        # Stream new chunks when crossing a chunk boundary
        if new_chunk_x != old_chunk_x or new_chunk_z != old_chunk_z:
            await self.stream_chunks_to_player(client_id)
        
        await self.broadcast(MESSAGE_TYPES['PLAYER_MOVE'], {
            'playerId': client_id,
            'position': player.position,
            'velocity': player.velocity
        }, exclude_client=client_id)
    
    async def handle_jump(self, client_id: str):
        """Handle player jump"""
        player = self.players.get(client_id)
        if not player:
            return
        
        if player.on_ground:
            player.velocity[1] = 15.0  # Jump force
            player.on_ground = False
    
    async def handle_place_block(self, client_id: str, data: Dict[str, Any]):
        """Handle block placement"""
        player = self.players.get(client_id)
        if not player:
            return
        
        position = data.get('position', {})
        block_type = data.get('blockType', BLOCK_TYPES['GRASS'])
        
        # Validate position data
        if not position or 'x' not in position or 'y' not in position or 'z' not in position:
            logger.warning(f"Invalid position data from {client_id}: {position}")
            return
        
        try:
            x, y, z = int(position['x']), int(position['y']), int(position['z'])
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid coordinate values from {client_id}: {e}")
            return
        
        # Validate block type
        if not isinstance(block_type, int) or block_type < 0:
            logger.warning(f"Invalid block type from {client_id}: {block_type}")
            return
        
        # Anti-cheat validation
        if not self.validate_block_interaction(player, position):
            return
        
        if not self.can_place_block(player):
            return
        
        success = self.world.set_block(x, y, z, block_type)
        
        if success:
            await self.broadcast(MESSAGE_TYPES['WORLD_UPDATE'], {
                'action': 'place',
                'position': position,
                'blockType': block_type
            })
    
    async def handle_break_block(self, client_id: str, data: Dict[str, Any]):
        """Handle block breaking"""
        player = self.players.get(client_id)
        if not player:
            return
        
        position = data.get('position', {})
        
        # Validate position data
        if not position or 'x' not in position or 'y' not in position or 'z' not in position:
            logger.warning(f"Invalid position data from {client_id}: {position}")
            return
        
        try:
            x, y, z = int(position['x']), int(position['y']), int(position['z'])
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid coordinate values from {client_id}: {e}")
            return
        
        # Anti-cheat validation
        if not self.validate_block_interaction(player, position):
            return
        
        if not self.can_break_block(player):
            return
        
        logger.info(f"Player {client_id} breaking block at {position}")
        block_type = self.world.get_block(x, y, z)
        logger.info(f"Block type at position: {block_type}")
        
        success = self.world.set_block(x, y, z, BLOCK_TYPES['AIR'])
        
        if success and block_type != BLOCK_TYPES['AIR']:
            # Spawn item entity for the block
            item_type = BLOCK_DROPS.get(block_type)
            if item_type:
                logger.info(f"Spawning item entity type {item_type} at {position}")
                player = self.players.get(client_id)
                harvester_id = client_id if player and player.item_lock_enabled else None
                self.world.spawn_item_entity(x, y, z, item_type, harvester_id)
                await self.broadcast(MESSAGE_TYPES['SPAWN_ITEM_ENTITY'], {
                    'x': position['x'],
                    'y': position['y'],
                    'z': position['z'],
                    'type': item_type,
                    'harvester_id': harvester_id
                })
            
            await self.broadcast(MESSAGE_TYPES['WORLD_UPDATE'], {
                'action': 'break',
                'position': position,
                'blockType': block_type
            })
    
    async def handle_interact(self, client_id: str, data: Dict[str, Any]):
        """Handle entity interaction"""
        logger.info(f"Player {client_id} interacting with: {data}")
    
    async def handle_open_container(self, client_id: str, data: Dict[str, Any]):
        """Handle opening a container (chest)"""
        x, y, z = int(data['x']), int(data['y']), int(data['z'])
        container_key = f"{x},{y},{z}"
        container = self.world.containers.get(container_key)
        if container:
            await self.send_to_client(client_id, MESSAGE_TYPES['CONTAINER_DATA'], {
                'x': x, 'y': y, 'z': z,
                'slots': container.slots,
                'size': container.size
            })
            logger.info(f"Player {client_id} opened container at ({x},{y},{z})")
    
    async def handle_close_container(self, client_id: str, data: Dict[str, Any]):
        """Handle closing a container"""
        logger.info(f"Player {client_id} closed container")
    
    async def handle_move_item(self, client_id: str, data: Dict[str, Any]):
        """Handle moving items between inventory/container slots"""
        player = self.players.get(client_id)
        if not player:
            return
        
        source = data.get('source')       # 'inventory' or 'container'
        dest = data.get('dest')            # 'inventory' or 'container'
        from_slot = data.get('fromSlot')
        to_slot = data.get('toSlot')
        container_pos = data.get('containerPos')  # {x,y,z} if container involved
        
        # Get source and dest slot lists
        src_slots = None
        dst_slots = None
        
        if source == 'inventory':
            src_slots = player.inventory.slots
        elif source == 'container' and container_pos:
            key = f"{container_pos['x']},{container_pos['y']},{container_pos['z']}"
            container = self.world.containers.get(key)
            if container:
                src_slots = container.slots
        
        if dest == 'inventory':
            dst_slots = player.inventory.slots
        elif dest == 'container' and container_pos:
            key = f"{container_pos['x']},{container_pos['y']},{container_pos['z']}"
            container = self.world.containers.get(key)
            if container:
                dst_slots = container.slots
        
        if src_slots is not None and dst_slots is not None:
            if 0 <= from_slot < len(src_slots) and 0 <= to_slot < len(dst_slots):
                # Swap the items
                src_slots[from_slot], dst_slots[to_slot] = dst_slots[to_slot], src_slots[from_slot]
                
                # Send updated inventory
                await self.send_to_client(client_id, MESSAGE_TYPES['INVENTORY_UPDATE'], 
                    player.inventory.to_dict())
                
                # Send updated container if involved
                if container_pos:
                    key = f"{container_pos['x']},{container_pos['y']},{container_pos['z']}"
                    container = self.world.containers.get(key)
                    if container:
                        await self.send_to_client(client_id, MESSAGE_TYPES['CONTAINER_DATA'], {
                            'x': container_pos['x'], 'y': container_pos['y'], 'z': container_pos['z'],
                            'slots': container.slots,
                            'size': container.size
                        })
    
    async def handle_select_quickbar(self, client_id: str, data: Dict[str, Any]):
        """Handle quickbar slot selection"""
        player = self.players.get(client_id)
        if not player:
            return
        slot = data.get('slot', 0)
        if 0 <= slot <= 8:
            player.inventory.selected_slot = slot
    
    async def handle_toggle_item_lock(self, client_id: str, data: Dict[str, Any]):
        """Handle toggling item lock on/off"""
        player = self.players.get(client_id)
        if not player:
            return
        
        player.item_lock_enabled = not player.item_lock_enabled
        await self.send_to_client(client_id, MESSAGE_TYPES['ITEM_LOCK_STATUS'], {
            'enabled': player.item_lock_enabled
        })
        
        logger.info(f"Player {client_id} item lock: {'ON' if player.item_lock_enabled else 'OFF'}")
    
    async def handle_chat_message(self, client_id: str, data: Dict[str, Any]):
        """Handle chat messages"""
        player = self.players.get(client_id)
        if not player:
            return
        
        message = data.get('message', '').strip()
        if not message:
            return
        
        # Limit message length
        if len(message) > 200:
            await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
                'message': 'Message too long (max 200 characters)'
            })
            return
        
        # Check for commands
        if message.startswith('/'):
            await self.handle_chat_command(client_id, message)
            return
        
        # Broadcast chat message
        await self.broadcast(MESSAGE_TYPES['CHAT_MESSAGE'], {
            'player_id': client_id,
            'username': player.username,
            'message': message
        })
        
        logger.info(f"Chat - {player.username}: {message}")
    
    async def handle_chat_command(self, client_id: str, command: str):
        """Handle chat commands"""
        player = self.players.get(client_id)
        if not player:
            return
        
        parts = command.split(' ')
        cmd = parts[0].lower()
        
        if cmd == '/help':
            help_text = (
                "Commands:\n"
                "/help - Show this help\n"
                "/whisper <player> <message> - Send private message\n"
                "/who - List online players\n"
                "/msg <player> <message> - Alias for whisper"
            )
            await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
                'message': help_text
            })
        
        elif cmd in ['/whisper', '/msg', '/w']:
            if len(parts) < 3:
                await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
                    'message': 'Usage: /whisper <player> <message>'
                })
                return
            
            target_username = parts[1].lower()
            whisper_message = ' '.join(parts[2:])
            
            # Find target player
            target_player = None
            target_id = None
            for pid, p in self.players.items():
                if p.username.lower() == target_username:
                    target_player = p
                    target_id = pid
                    break
            
            if not target_player:
                await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
                    'message': f'Player "{target_username}" not found'
                })
                return
            
            # Send whisper to both players
            whisper_data = {
                'from_player': player.username,
                'to_player': target_player.username,
                'message': whisper_message
            }
            
            await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_WHISPER'], {
                **whisper_data,
                'direction': 'sent'
            })
            
            await self.send_to_client(target_id, MESSAGE_TYPES['CHAT_WHISPER'], {
                **whisper_data,
                'direction': 'received'
            })
            
            logger.info(f"Whisper - {player.username} -> {target_player.username}: {whisper_message}")
        
        elif cmd == '/who':
            players_list = "Online players:\n" + '\n'.join([p.username for p in self.players.values()])
            await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
                'message': players_list
            })
        
        else:
            await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
                'message': f'Unknown command: {cmd}. Type /help for commands.'
            })
    
    async def handle_drop_item(self, client_id: str, data: Dict[str, Any]):
        """Handle dropping items from inventory"""
        player = self.players.get(client_id)
        if not player:
            return
        
        slot = data.get('slot', 0)
        count = data.get('count', 1)
        
        # Validate slot
        if slot < 0 or slot >= len(player.inventory.slots):
            return
        
        item = player.inventory.slots[slot]
        if not item or item['count'] < count:
            return
        
        # Get player position
        px, py, pz = int(player.position[0]), int(player.position[1]), int(player.position[2])
        
        # Spawn item entity at player position
        self.world.spawn_item_entity(px, py, pz, item['type'], None, count)
        
        # Broadcast spawn
        await self.broadcast(MESSAGE_TYPES['SPAWN_ITEM_ENTITY'], {
            'x': px,
            'y': py,
            'z': pz,
            'type': item['type'],
            'count': count,
            'harvester_id': None
        })
        
        # Remove from inventory
        if item['count'] == count:
            player.inventory.slots[slot] = None
        else:
            player.inventory.slots[slot]['count'] -= count
        
        # Update client
        await self.send_to_client(client_id, MESSAGE_TYPES['INVENTORY_UPDATE'],
            player.inventory.to_dict())
        
        logger.info(f"Player {player.username} dropped {count}x item {item['type']} at ({px}, {py}, {pz})")
    
    async def handle_craft_item(self, client_id: str, data: Dict[str, Any]):
        """Handle crafting requests"""
        player = self.players.get(client_id)
        if not player:
            return
        
        recipe_id = data.get('recipe')
        if not recipe_id:
            await self.send_to_client(client_id, MESSAGE_TYPES['CRAFT_ITEM'], {
                'success': False,
                'reason': 'Invalid recipe'
            })
            return
        
        # Look up recipe by ID
        recipe = CRAFTING_RECIPES.get(recipe_id)
        if not recipe:
            await self.send_to_client(client_id, MESSAGE_TYPES['CRAFT_ITEM'], {
                'success': False,
                'reason': 'Recipe not found'
            })
            return
        
        # Check if player has all required ingredients
        for ingredient in recipe.get('ingredients', []):
            required_type = ingredient.get('type')
            required_count = int(ingredient.get('count', 1))
            
            # Count items in inventory
            available_count = 0
            for slot in player.inventory.slots:
                if slot and slot.get('type') == required_type:
                    available_count += int(slot.get('count', 1))
            
            if available_count < required_count:
                await self.send_to_client(client_id, MESSAGE_TYPES['CRAFT_ITEM'], {
                    'success': False,
                    'reason': f'Not enough materials'
                })
                return
        
        # Remove ingredients from inventory
        for ingredient in recipe.get('ingredients', []):
            required_type = ingredient.get('type')
            required_count = int(ingredient.get('count', 1))
            
            remaining = required_count
            for i, slot in enumerate(player.inventory.slots):
                if slot and slot.get('type') == required_type and remaining > 0:
                    slot_count = int(slot.get('count', 1))
                    take = min(slot_count, remaining)
                    
                    if slot_count == take:
                        player.inventory.slots[i] = None
                    else:
                        player.inventory.slots[i]['count'] = slot_count - take
                    
                    remaining -= take
        
        # Add crafted item to inventory
        result = recipe.get('result', {})
        result_type = result.get('type')
        result_count = int(result.get('count', 1))
        
        if not result_type:
            await self.send_to_client(client_id, MESSAGE_TYPES['CRAFT_ITEM'], {
                'success': False,
                'reason': 'Invalid recipe result'
            })
            return
        
        # Find empty slot or add to existing stack
        added = 0
        for slot in player.inventory.slots:
            if slot and slot.get('type') == result_type and added < result_count:
                # Add to existing stack (assuming max stack size of 64)
                current = int(slot.get('count', 1))
                can_add = min(64 - current, result_count - added)
                slot['count'] = current + can_add
                added += can_add
        
        # Add to empty slots if needed
        for i, slot in enumerate(player.inventory.slots):
            if slot is None and added < result_count:
                player.inventory.slots[i] = {
                    'type': result_type,
                    'count': min(64, result_count - added)
                }
                added += player.inventory.slots[i]['count']
        
        # Update client inventory
        await self.send_to_client(client_id, MESSAGE_TYPES['INVENTORY_UPDATE'],
            player.inventory.to_dict())
        
        # Send success message
        await self.send_to_client(client_id, MESSAGE_TYPES['CRAFT_ITEM'], {
            'success': True,
            'itemName': str(result_type),  # Could map to names
            'count': result_count
        })
        
        logger.info(f"Player {player.username} crafted {result_count}x item {result_type}")
    
    async def handle_combat_hit(self, attacker_id: str, data: Dict[str, Any]):
        """Handle combat hit — player attacking another player or a mob."""
        attacker = self.players.get(attacker_id)
        if not attacker:
            return
        
        target_id = data.get('target_id')
        
        # Check if target is a mob
        mob = self.mob_manager.mobs.get(target_id)
        if mob:
            damage = attacker.get_attack_damage()
            await self.mob_manager.handle_mob_damaged(target_id, damage, attacker_id, self)
            return
        
        target = self.players.get(target_id)
        if not target:
            return
        
        # Check distance (max 4 blocks for combat)
        dx = attacker.position[0] - target.position[0]
        dy = attacker.position[1] - target.position[1]
        dz = attacker.position[2] - target.position[2]
        distance = math.sqrt(dx*dx + dy*dy + dz*dz)
        
        if distance > 4.0:
            return  # Too far away
        
        # Calculate damage
        damage = attacker.get_attack_damage()
        
        # Apply damage to target
        died = target.take_damage(damage, attacker_id)
        
        # Send damage notification to target
        await self.send_to_client(target_id, MESSAGE_TYPES['PLAYER_DAMAGE'], {
            'damage': damage,
            'attacker': attacker.username,
            'health': target.health,
            'max_health': target.max_health
        })
        
        # Send hit confirmation to attacker
        await self.send_to_client(attacker_id, MESSAGE_TYPES['COMBAT_HIT'], {
            'target_id': target_id,
            'damage': damage,
            'target_health': target.health
        })
        
        # Broadcast health update
        await self.broadcast(MESSAGE_TYPES['PLAYER_UPDATE'], {
            'player_id': target_id,
            'health': target.health
        })
        
        if died:
            # Player died
            await self.handle_player_death(target_id, attacker_id)
        
        logger.info(f"Combat: {attacker.username} hit {target.username} for {damage} damage")
    
    async def handle_player_death(self, victim_id: str, killer_id: str = None):
        """Handle player death"""
        victim = self.players.get(victim_id)
        if not victim:
            return
        
        killer = self.players.get(killer_id) if killer_id else None
        
        # Reset health
        victim.health = victim.max_health
        
        # Drop inventory (optional - could keep some items)
        for i, item in enumerate(victim.inventory.slots):
            if item:
                # Spawn item entity at player position
                self.world.spawn_item_entity(
                    int(victim.position[0]),
                    int(victim.position[1]),
                    int(victim.position[2]),
                    item['type'],
                    None,
                    item.get('count', 1)
                )
                
                # Broadcast spawn
                await self.broadcast(MESSAGE_TYPES['SPAWN_ITEM_ENTITY'], {
                    'x': victim.position[0],
                    'y': victim.position[1],
                    'z': victim.position[2],
                    'type': item['type'],
                    'count': item.get('count', 1),
                    'harvester_id': None
                })
                
                victim.inventory.slots[i] = None
        
        # Clear inventory
        await self.send_to_client(victim_id, MESSAGE_TYPES['INVENTORY_UPDATE'],
            victim.inventory.to_dict())
        
        # Respawn player at spawn point
        victim.position = [0.0, 80.0, 0.0]
        victim.velocity = [0.0, 0.0, 0.0]
        
        # Send death message
        death_msg = f"{victim.username} died"
        if killer:
            death_msg += f" (killed by {killer.username})"
        
        await self.broadcast(MESSAGE_TYPES['CHAT_SYSTEM'], {
            'message': death_msg
        })
        
        # Send respawn notification
        await self.send_to_client(victim_id, MESSAGE_TYPES['PLAYER_DEATH'], {
            'respawn_position': victim.position
        })
        
        logger.info(f"Player {victim.username} died")
    
    async def handle_equip_item(self, client_id: str, data: Dict[str, Any]):
        """Handle equipping items"""
        player = self.players.get(client_id)
        if not player:
            return
        
        slot = data.get('slot')
        if slot is None or not isinstance(slot, int) or slot < 0 or slot >= len(player.inventory.slots):
            return
        
        item = player.inventory.slots[slot]
        if not item:
            return
        
        # Try to equip the item
        if player.equip_item(item, data.get('equipment_slot')):
            # Remove from inventory if equipped
            player.inventory.slots[slot] = None
            
            # Update inventory
            await self.send_to_client(client_id, MESSAGE_TYPES['INVENTORY_UPDATE'],
                player.inventory.to_dict())
            
            # Send equipment update
            await self.send_to_client(client_id, MESSAGE_TYPES['EQUIPMENT_UPDATE'], {
                'equipped_weapon': player.equipped_weapon,
                'equipped_armor': player.equipped_armor
            })
            
            logger.info(f"Player {player.username} equipped item type {item['type']}")
    
    async def handle_unequip_item(self, client_id: str, data: Dict[str, Any]):
        """Move an equipped item back to inventory."""
        player = self.players.get(client_id)
        if not player:
            return
        slot_name = data.get('slot', '')
        item = None
        if slot_name == 'weapon':
            item = player.equipped_weapon
            player.equipped_weapon = None
        elif slot_name in player.equipped_armor:
            item = player.equipped_armor.get(slot_name)
            player.equipped_armor[slot_name] = None
        if item:
            player.inventory.add_item(item['type'], item.get('count', 1))
            await self.send_to_client(client_id, MESSAGE_TYPES['INVENTORY_UPDATE'],
                player.inventory.to_dict())
            await self.send_to_client(client_id, MESSAGE_TYPES['EQUIPMENT_UPDATE'], {
                'equipped_weapon': player.equipped_weapon,
                'equipped_armor': player.equipped_armor
            })
            logger.info(f"Player {player.username} unequipped {slot_name}")

    async def handle_give_items(self, client_id: str, data: Dict[str, Any]):
        """Give player specific materials for testing"""
        player = self.players.get(client_id)
        if not player:
            return
        
        material = data.get('material', 'all').lower()
        amount = data.get('amount', 64)
        
        # Material kits for testing
        material_kits = {
            'wood': [
                {'type': 4, 'count': amount},    # Wood
                {'type': 21, 'count': amount},   # Planks
                {'type': 300, 'count': amount},  # Sticks
            ],
            'stone': [
                {'type': 3, 'count': amount},    # Stone
                {'type': 30, 'count': amount},   # Cobblestone
                {'type': 300, 'count': amount},  # Sticks
            ],
            'iron': [
                {'type': 11, 'count': amount},   # Iron Ore
                {'type': 302, 'count': amount},  # Iron Ingots
                {'type': 300, 'count': amount},  # Sticks
            ],
            'gold': [
                {'type': 12, 'count': amount},   # Gold Ore
                {'type': 303, 'count': amount},  # Gold Ingots
                {'type': 300, 'count': amount},  # Sticks
            ],
            'diamond': [
                {'type': 13, 'count': amount},   # Diamond Ore
                {'type': 304, 'count': amount},  # Diamonds
                {'type': 300, 'count': amount},  # Sticks
            ],
            'tools': [
                {'type': 300, 'count': amount},  # Sticks
                {'type': 3, 'count': amount},    # Stone
                {'type': 302, 'count': amount},  # Iron Ingots
                {'type': 304, 'count': amount},  # Diamonds
            ],
            'weapons': [
                {'type': 300, 'count': amount},  # Sticks
                {'type': 302, 'count': amount},  # Iron Ingots
                {'type': 303, 'count': amount},  # Gold Ingots
                {'type': 304, 'count': amount},  # Diamonds
            ],
            'armor': [
                {'type': 302, 'count': amount},  # Iron Ingots
                {'type': 304, 'count': amount},  # Diamonds
                {'type': 301, 'count': amount},  # Coal (for leather alternative)
            ],
            'all': [
                {'type': 300, 'count': amount},  # Sticks
                {'type': 301, 'count': amount},  # Coal
                {'type': 302, 'count': amount},  # Iron Ingots
                {'type': 303, 'count': amount},  # Gold Ingots
                {'type': 304, 'count': amount},  # Diamonds
                {'type': 3, 'count': amount},    # Stone
                {'type': 4, 'count': amount},    # Wood
                {'type': 21, 'count': amount},   # Planks
                {'type': 30, 'count': amount},   # Cobblestone
                {'type': 10, 'count': amount},   # Coal Ore
                {'type': 11, 'count': amount},   # Iron Ore
                {'type': 12, 'count': amount},   # Gold Ore
                {'type': 13, 'count': amount},   # Diamond Ore
            ]
        }
        
        # Get the requested kit
        items_to_give = material_kits.get(material, material_kits['all'])
        
        # Add items to inventory
        for item in items_to_give:
            player.inventory.add_item(item['type'], item['count'])
        
        # Update client inventory
        await self.send_to_client(client_id, MESSAGE_TYPES['INVENTORY_UPDATE'],
            player.inventory.to_dict())
        
        # Send confirmation
        await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
            'message': f'Given {material} kit with {amount} of each material!'
        })
        
        logger.info(f"Player {player.username} received {material} kit")
    
    async def handle_npc_interact(self, client_id: str, data: Dict[str, Any]):
        """Handle player interacting with NPC"""
        npc_id = data.get('npc_id')
        if not npc_id or npc_id not in self.npcs:
            return
        
        npc = self.npcs[npc_id]
        player = self.players.get(client_id)
        if not player:
            return
        
        # Get dialogue for this player
        dialogue = npc.get_dialogue(client_id)
        
        # Send dialogue to client
        await self.send_to_client(client_id, MESSAGE_TYPES['NPC_DIALOGUE'], {
            'npc_id': npc_id,
            'npc_name': npc.name,
            'dialogue': dialogue
        })
    
    async def handle_npc_dialogue(self, client_id: str, data: Dict[str, Any]):
        """Handle player dialogue selection"""
        npc_id = data.get('npc_id')
        option_index = data.get('option_index')
        
        if not npc_id or npc_id not in self.npcs:
            return
        
        npc = self.npcs[npc_id]
        current_dialogue = npc.get_dialogue(client_id)
        
        if 'options' in current_dialogue and option_index < len(current_dialogue['options']):
            option = current_dialogue['options'][option_index]
            
            # Check for special actions
            if 'action' in option:
                if option['action'] == 'accept_quest' and 'quest_id' in option:
                    await self.handle_quest_accept(client_id, {'quest_id': option['quest_id']})
            
            # Navigate to next dialogue
            if 'next' in option:
                if option['next'] == 'exit':
                    # End dialogue
                    return
                elif option['next'] in npc.dialogue_tree:
                    npc.set_dialogue(client_id, npc.dialogue_tree[option['next']])
                    # Send new dialogue
                    await self.handle_npc_interact(client_id, {'npc_id': npc_id})
    
    async def handle_quest_accept(self, client_id: str, data: Dict[str, Any]):
        """Handle player accepting a quest"""
        quest_id = data.get('quest_id')
        if not quest_id or quest_id not in self.quests:
            return
        
        player = self.players.get(client_id)
        if not player:
            return
        
        # Check if player already has this quest
        if client_id not in self.player_quests:
            self.player_quests[client_id] = []
        
        if quest_id in self.player_quests[client_id]:
            await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
                'message': 'You already have this quest!'
            })
            return
        
        # Add quest to player's active quests
        self.player_quests[client_id].append(quest_id)
        
        quest = self.quests[quest_id]
        await self.send_to_client(client_id, MESSAGE_TYPES['QUEST_ACCEPT'], {
            'quest_id': quest_id,
            'quest': {
                'name': quest.name,
                'description': quest.description,
                'type': quest.type,
                'requirements': quest.requirements
            }
        })
        
        await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
            'message': f'Quest accepted: {quest.name}'
        })
    
    async def handle_quest_progress(self, client_id: str, data: Dict[str, Any]):
        """Check and update quest progress"""
        player = self.players.get(client_id)
        if not player or client_id not in self.player_quests:
            return
        
        # Check all active quests
        for quest_id in self.player_quests[client_id]:
            if quest_id in self.quests:
                quest = self.quests[quest_id]
                if quest.check_completion(player):
                    # Quest completed!
                    await self.handle_quest_complete(client_id, {'quest_id': quest_id})
    
    async def handle_quest_complete(self, client_id: str, data: Dict[str, Any]):
        """Handle completing a quest"""
        quest_id = data.get('quest_id')
        if not quest_id or quest_id not in self.quests:
            return
        
        player = self.players.get(client_id)
        if not player:
            return
        
        quest = self.quests[quest_id]
        
        # Remove quest from active quests
        if client_id in self.player_quests and quest_id in self.player_quests[client_id]:
            self.player_quests[client_id].remove(quest_id)
        
        # Give rewards
        quest.give_reward(player)
        
        # Check if player leveled up
        for reward in quest.rewards:
            if reward['type'] == 'experience':
                if player.give_experience(reward['amount']):
                    # Player leveled up!
                    await self.send_to_client(client_id, MESSAGE_TYPES['PLAYER_LEVEL_UP'], {
                        'level': player.level
                    })
                    await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
                        'message': f'LEVEL UP! You are now level {player.level}!'
                    })
                break
        
        # Update inventory and stats
        await self.send_to_client(client_id, MESSAGE_TYPES['INVENTORY_UPDATE'],
            player.inventory.to_dict())
        
        await self.send_to_client(client_id, MESSAGE_TYPES['PLAYER_STATS'], {
            'health': player.health,
            'max_health': player.max_health,
            'mana': player.mana,
            'max_mana': player.max_mana,
            'experience': player.experience,
            'level': player.level,
            'experience_to_next_level': player.experience_to_next_level
        })
        
        # Send completion message
        await self.send_to_client(client_id, MESSAGE_TYPES['QUEST_COMPLETE'], {
            'quest_id': quest_id,
            'completion_text': quest.completion_text
        })
        
        await self.send_to_client(client_id, MESSAGE_TYPES['CHAT_SYSTEM'], {
            'message': f'Quest completed: {quest.name}'
        })
    
    async def send_initial_chunks(self, client_id: str):
        """Send initial chunks around player spawn"""
        player = self.players.get(client_id)
        if not player:
            return
        
        chunk_x = int(player.position[0] // CHUNK_SIZE)
        chunk_z = int(player.position[2] // CHUNK_SIZE)
        
        logger.info(f"Sending chunks around player at {player.position}, chunk center: ({chunk_x}, {chunk_z})")
        
        # Track which chunks this client has received
        if client_id not in self.client_loaded_chunks:
            self.client_loaded_chunks[client_id] = set()
        
        # Send initial 7x7 chunk area around player
        send_radius = 3
        for x in range(-send_radius, send_radius + 1):
            for z in range(-send_radius, send_radius + 1):
                cx, cz = chunk_x + x, chunk_z + z
                chunk = self.world.get_chunk(cx, cz)
                await self.send_to_client(client_id, MESSAGE_TYPES['CHUNK_DATA'], {
                    'chunkX': cx,
                    'chunkZ': cz,
                    'data': chunk
                })
                self.client_loaded_chunks[client_id].add((cx, cz))
        
        logger.info(f"Sent {(send_radius*2+1)**2} initial chunks to client {client_id}")
    
    async def send_to_client(self, client_id: str, message_type: str, data: Dict[str, Any]):
        """Send message to specific client"""
        if client_id in self.clients:
            websocket = self.clients[client_id]
            message = json.dumps({'type': message_type, 'data': data})
            try:
                await websocket.send(message)
            except websockets.exceptions.ConnectionClosed:
                await self.handle_disconnect(client_id)
    
    async def broadcast(self, message_type: str, data: Dict[str, Any], exclude_client: str = None):
        """Broadcast message to all connected clients"""
        message = json.dumps({'type': message_type, 'data': data})
        disconnected_clients = []
        
        for client_id, websocket in self.clients.items():
            if client_id != exclude_client:
                try:
                    await websocket.send(message)
                except websockets.exceptions.ConnectionClosed:
                    disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            await self.handle_disconnect(client_id)
    
    def save_world(self):
        """Save all world data to database"""
        logger.info("Saving world state...")
        start_time = time.time()
        
        # Save all loaded chunks
        chunks_saved = 0
        for chunk_key, chunk_data in self.world.chunks.items():
            chunk_x, chunk_z = map(int, chunk_key.split(','))
            self.db.save_chunk(chunk_x, chunk_z, chunk_data)
            chunks_saved += 1
        
        # Save item entities
        entities = []
        for key, entity in self.world.item_entities.items():
            x, y, z = map(float, key.split(','))
            entities.append({
                'position': {'x': x, 'y': y, 'z': z},
                'type': entity['type'],
                'harvester_id': entity.get('harvester_id'),
                'spawn_time': entity.get('spawn_time', time.time())
            })
        self.db.save_item_entities(entities)
        
        # Save all online players
        for player_id, player in self.players.items():
            self.db.save_player(
                player_id,
                player.username,
                {'x': player.position[0], 'y': player.position[1], 'z': player.position[2]},
                player.inventory.to_dict(),
                player.health
            )
        
        elapsed = time.time() - start_time
        logger.info(f"World saved in {elapsed:.2f}s: {chunks_saved} chunks, {len(entities)} entities, {len(self.players)} players")
        self.last_save_time = time.time()
    
    def load_world(self):
        """Load world data from database"""
        logger.info("Loading world state...")
        start_time = time.time()
        
        # Load item entities
        entities = self.db.load_item_entities()
        for entity in entities:
            pos = entity['position']
            self.world.spawn_item_entity(
                pos['x'], pos['y'], pos['z'],
                entity['type'],
                entity.get('harvester_id')
            )
        
        elapsed = time.time() - start_time
        logger.info(f"World loaded in {elapsed:.2f}s: {len(entities)} entities")
    
    async def stream_chunks_to_player(self, client_id: str):
        """Send any chunks the player is missing within load distance."""
        player = self.players.get(client_id)
        if not player:
            return
        chunk_x = int(player.position[0] // CHUNK_SIZE)
        chunk_z = int(player.position[2] // CHUNK_SIZE)
        loaded = self.client_loaded_chunks.get(client_id, set())
        send_radius = self.chunk_load_distance
        for dx in range(-send_radius, send_radius + 1):
            for dz in range(-send_radius, send_radius + 1):
                cx, cz = chunk_x + dx, chunk_z + dz
                if (cx, cz) not in loaded:
                    chunk = self.world.get_chunk(cx, cz)
                    await self.send_to_client(client_id, MESSAGE_TYPES['CHUNK_DATA'], {
                        'chunkX': cx, 'chunkZ': cz, 'data': chunk
                    })
                    loaded.add((cx, cz))
        self.client_loaded_chunks[client_id] = loaded

    def update_chunk_loading(self):
        """Update chunk loading based on player positions"""
        current_player_chunks = {}
        
        # Calculate which chunks each player is in
        for player_id, player in self.players.items():
            chunk_x = int(player.position[0] // CHUNK_SIZE)
            chunk_z = int(player.position[2] // CHUNK_SIZE)
            current_player_chunks[player_id] = (chunk_x, chunk_z)
        
        # Determine which chunks should be loaded
        required_chunks = set()
        for chunk_x, chunk_z in current_player_chunks.values():
            for dx in range(-self.chunk_load_distance, self.chunk_load_distance + 1):
                for dz in range(-self.chunk_load_distance, self.chunk_load_distance + 1):
                    required_chunks.add((chunk_x + dx, chunk_z + dz))
        
        # Load required chunks that aren't loaded
        for chunk_x, chunk_z in required_chunks:
            chunk_key = f"{chunk_x},{chunk_z}"
            if chunk_key not in self.world.chunks:
                self.world.get_chunk(chunk_x, chunk_z)  # This will load from DB or generate
        
        # Unload chunks that are too far from all players
        chunks_to_unload = []
        for chunk_key in self.world.chunks:
            chunk_x, chunk_z = map(int, chunk_key.split(','))
            
            # Check distance from all players
            should_unload = True
            for player_chunk_x, player_chunk_z in current_player_chunks.values():
                dist = max(abs(chunk_x - player_chunk_x), abs(chunk_z - player_chunk_z))
                if dist <= self.chunk_unload_distance:
                    should_unload = False
                    break
            
            if should_unload:
                chunks_to_unload.append(chunk_key)
        
        # Unload distant chunks (save them first)
        for chunk_key in chunks_to_unload:
            chunk_x, chunk_z = map(int, chunk_key.split(','))
            chunk_data = self.world.chunks[chunk_key]
            self.db.save_chunk(chunk_x, chunk_z, chunk_data)
            del self.world.chunks[chunk_key]
        
        if chunks_to_unload:
            logger.info(f"Unloaded {len(chunks_to_unload)} distant chunks")
        
        self.player_chunk_positions = current_player_chunks
    
    def validate_movement(self, player: Player, new_position: List[float]) -> bool:
        """Validate if player movement is within acceptable limits"""
        current_time = time.time()
        time_delta = current_time - player.last_move_time
        
        if time_delta <= 0:
            return False
        
        # Calculate distance moved
        dx = new_position[0] - player.last_position[0]
        dy = new_position[1] - player.last_position[1]
        dz = new_position[2] - player.last_position[2]
        distance = math.sqrt(dx*dx + dy*dy + dz*dz)
        
        # Calculate speed (blocks per second)
        speed = distance / time_delta
        
        # Check if speed is within limits
        max_speed = MAX_SPEED if player.on_ground else MAX_SPEED * 1.5  # Allow 50% more speed in air
        if speed > max_speed:
            logger.warning(f"Player {player.username} speed violation: {speed:.2f} blocks/s (max: {max_speed:.1f})")
            player.speed_violations += 1
            
            # Kick player after too many violations
            if player.speed_violations > 10:
                logger.warning(f"Kicking player {player.username} for excessive speed violations")
                return False
        else:
            # Reset violations on valid movement
            player.speed_violations = max(0, player.speed_violations - 1)
        
        # Update last position and time
        player.last_position = new_position.copy()
        player.last_move_time = current_time
        
        return True
    
    def validate_block_interaction(self, player: Player, block_position) -> bool:
        """Validate if player can interact with a block at the given position"""
        # Handle both dict and list positions
        if isinstance(block_position, dict):
            x = block_position.get('x', 0)
            y = block_position.get('y', 0)
            z = block_position.get('z', 0)
        else:
            x, y, z = block_position
        
        # Calculate distance from player to block
        dx = x - player.position[0]
        dy = y - player.position[1]
        dz = z - player.position[2]
        distance = math.sqrt(dx*dx + dy*dy + dz*dz)
        
        if distance > MAX_REACH_DISTANCE:
            logger.warning(f"Player {player.username} tried to interact with block too far away: {distance:.2f} blocks")
            return False
        
        return True
    
    def validate_mining_speed(self, player: Player) -> bool:
        """Validate if player is mining at a reasonable speed"""
        current_time = time.time()
        if current_time - player.last_block_break_time < MINING_COOLDOWN:
            return False
        player.last_block_break_time = current_time
        return True
    
    def validate_placing_speed(self, player: Player) -> bool:
        """Validate if player is placing blocks at a reasonable speed"""
        current_time = time.time()
        if current_time - player.last_block_place_time < PLACING_COOLDOWN:
            return False
        player.last_block_place_time = current_time
        return True
    
    def can_break_block(self, player: Player) -> bool:
        """Check if player can break blocks (basic implementation)"""
        # For now, all players can break blocks
        # Can be extended with tool requirements, permissions, etc.
        return True
    
    def can_place_block(self, player: Player) -> bool:
        """Check if player can place blocks (basic implementation)"""
        # For now, all players can place blocks
        # Can be extended with item requirements, permissions, etc.
        return True
    
    async def mob_update_loop(self):
        """Mob AI tick loop — runs at ~3 Hz."""
        while self.running:
            await asyncio.sleep(0.35)
            if self.players:
                try:
                    await self.mob_manager.update(
                        self.players, self.world, self, time.time()
                    )
                except Exception as e:
                    logger.error(f"Mob update error: {e}")
    
    def _find_client_by_player_id(self, player_id: str) -> Optional[str]:
        """Return the client_id associated with a player_id."""
        for cid, player in self.players.items():
            if player.id == player_id:
                return cid
        return None
    
    async def update_loop(self):
        """Main server update loop"""
        last_cleanup_time = time.time()
        cleanup_interval = 60  # Cleanup every 60 seconds
        
        while self.running:
            # Update chunk loading
            self.update_chunk_loading()
            
            # Save world periodically
            if time.time() - self.last_save_time >= self.save_interval:
                self.save_world()
            
            # Cleanup old data periodically
            if time.time() - last_cleanup_time >= cleanup_interval:
                self.db.cleanup_expired_sessions()
                self.db.cleanup_old_item_entities(max_age_seconds=300)  # 5 minutes
                last_cleanup_time = time.time()
            
            # Wait before next update
            await asyncio.sleep(5)
    
    async def start(self):
        """Start the WebSocket server"""
        logger.info("Starting Voxel MMO Server...")
        
        # Load world state on startup
        self.load_world()
        
        # Start WebSocket server
        server = await websockets.serve(
            self.handle_client,
            "localhost",
            3001,
            ping_interval=20,
            ping_timeout=10
        )
        
        logger.info("WebSocket server running on ws://localhost:3001")
        logger.info("Server ready for connections!")
        
        # Start auto-save loop
        async def auto_save():
            while self.running:
                await asyncio.sleep(60)  # Check every minute
                if time.time() - self.last_save_time >= self.save_interval:
                    self.save_world()
        
        # Start background tasks
        asyncio.create_task(self.update_loop())
        asyncio.create_task(auto_save())
        asyncio.create_task(self.mob_update_loop())
        
        try:
            await server.wait_closed()
        except KeyboardInterrupt:
            logger.info("Server shutting down...")
            self.running = False
            # Save world before shutdown
            self.save_world()

class Mob:
    """A hostile monster in the world."""
    def __init__(self, mob_id: str, mob_type: str, x: float, y: float, z: float):
        self.id = mob_id
        self.type = mob_type
        stats = MOB_STATS.get(mob_type, MOB_STATS['zombie'])
        self.health = float(stats['health'])
        self.max_health = float(stats['health'])
        self.damage = stats['damage']
        self.speed = stats['speed']
        self.attack_range = stats['attack_range']
        self.detection_range = stats['detection_range']
        self.xp_reward = stats['xp_reward']
        self.loot_table = stats['loot']
        self.position = [float(x), float(y), float(z)]
        self.state = 'idle'
        self.target_player_id: Optional[str] = None
        self.last_attack_time = 0.0
        self.attack_cooldown = 1.5
        self.last_broadcast_time = 0.0
        self.broadcast_interval = 0.3

    def take_damage(self, damage: float) -> bool:
        self.health = max(0.0, self.health - damage)
        return self.health <= 0

    def roll_loot(self) -> List[Dict]:
        drops = []
        for entry in self.loot_table:
            if random.randint(1, 100) <= entry['weight']:
                count = random.randint(entry['count'][0], entry['count'][1])
                drops.append({'type': entry['type'], 'count': count})
        return drops

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'type': self.type,
            'position': self.position,
            'health': self.health,
            'max_health': self.max_health,
            'state': self.state,
        }


class MobManager:
    """Spawns and updates all mobs in the world."""

    COMMON_TYPES = ['zombie', 'goblin', 'skeleton', 'slime', 'spider', 'deer', 'sheep', 'rabbit', 'chicken']
    RARE_TYPES   = ['troll', 'wolf', 'bear', 'boar', 'cow']

    def __init__(self):
        self.mobs: Dict[str, Mob] = {}
        self._next_id = 1
        self.max_mobs = 60
        self.spawn_dist_min = 10.0
        self.spawn_dist_max = 28.0
        self.despawn_dist   = 52.0
        self.last_spawn_time = 0.0
        self.spawn_interval  = 8.0    # seconds between spawn attempts
        self.tick_dt         = 0.35   # matches mob_update_loop sleep

    def _new_id(self) -> str:
        mid = f"mob_{self._next_id}"
        self._next_id += 1
        return mid

    def _find_spawn_pos(self, players: Dict, world) -> Optional[Tuple]:
        if not players:
            return None
        player = random.choice(list(players.values()))
        for _ in range(12):
            angle = random.uniform(0, 2 * math.pi)
            dist  = random.uniform(self.spawn_dist_min, self.spawn_dist_max)
            sx = player.position[0] + math.cos(angle) * dist
            sz = player.position[2] + math.sin(angle) * dist
            sy = None
            for y in range(60, 20, -1):
                if world.get_block(int(sx), y, int(sz)) != 0:
                    sy = float(y + 1)
                    break
            if sy is not None and 22 < sy < 56:
                mob_type = (random.choice(self.RARE_TYPES)
                            if random.random() < 0.05
                            else random.choice(self.COMMON_TYPES))
                return sx, sy, sz, mob_type
        return None

    async def update(self, players: Dict, world, server, current_time: float):
        # Spawn
        if (current_time - self.last_spawn_time >= self.spawn_interval
                and len(self.mobs) < self.max_mobs):
            self.last_spawn_time = current_time
            spawn_data = self._find_spawn_pos(players, world)
            if spawn_data:
                sx, sy, sz, mob_type = spawn_data
                mob = Mob(self._new_id(), mob_type, sx, sy, sz)
                self.mobs[mob.id] = mob
                await server.broadcast(MESSAGE_TYPES['MOB_SPAWN'], mob.to_dict())

        # AI tick
        for mob_id in list(self.mobs.keys()):
            mob = self.mobs.get(mob_id)
            if mob is None or mob.health <= 0:
                continue
            await self._tick_mob(mob, players, server, current_time)

        # Despawn distant mobs
        if players:
            for mob_id in [
                m.id for m in self.mobs.values()
                if m.health > 0 and min(
                    math.sqrt((m.position[0]-p.position[0])**2 + (m.position[2]-p.position[2])**2)
                    for p in players.values()
                ) > self.despawn_dist
            ]:
                self.mobs.pop(mob_id, None)
                await server.broadcast(MESSAGE_TYPES['MOB_DESPAWN'], {'mobId': mob_id})

    async def _tick_mob(self, mob: Mob, players: Dict, server, current_time: float):
        # Find nearest player
        nearest_player = None
        nearest_dist = float('inf')
        for player in players.values():
            dx = player.position[0] - mob.position[0]
            dz = player.position[2] - mob.position[2]
            dist = math.sqrt(dx*dx + dz*dz)
            if dist < nearest_dist:
                nearest_dist = dist
                nearest_player = player

        moved = False
        if nearest_player is not None and nearest_dist <= mob.detection_range:
            mob.target_player_id = nearest_player.id
            if nearest_dist <= mob.attack_range:
                mob.state = 'attacking'
                if current_time - mob.last_attack_time >= mob.attack_cooldown:
                    mob.last_attack_time = current_time
                    died = nearest_player.take_damage(mob.damage, mob.id)
                    client_id = server._find_client_by_player_id(nearest_player.id)
                    if client_id:
                        await server.send_to_client(client_id, MESSAGE_TYPES['PLAYER_DAMAGE'], {
                            'damage': mob.damage,
                            'attacker': mob.type,
                            'health': nearest_player.health,
                            'max_health': nearest_player.max_health,
                        })
                    await server.broadcast(MESSAGE_TYPES['MOB_ATTACK'], {
                        'mobId': mob.id,
                        'targetId': nearest_player.id,
                        'damage': mob.damage,
                    })
                    if died:
                        await server.handle_player_death(nearest_player.id)
            else:
                mob.state = 'chasing'
                dx = nearest_player.position[0] - mob.position[0]
                dz = nearest_player.position[2] - mob.position[2]
                length = math.sqrt(dx*dx + dz*dz)
                if length > 0:
                    mob.position[0] += (dx / length) * mob.speed * self.tick_dt
                    mob.position[2] += (dz / length) * mob.speed * self.tick_dt
                moved = True
        else:
            mob.state = 'idle'
            mob.target_player_id = None

        if moved and current_time - mob.last_broadcast_time >= mob.broadcast_interval:
            mob.last_broadcast_time = current_time
            await server.broadcast(MESSAGE_TYPES['MOB_MOVE'], {
                'mobId': mob.id,
                'position': mob.position,
                'state': mob.state,
            })

    async def handle_mob_damaged(self, mob_id: str, damage: float,
                                  attacker_id: str, server) -> bool:
        mob = self.mobs.get(mob_id)
        if not mob:
            return False
        died = mob.take_damage(damage)
        # Send health update to all clients
        await server.broadcast(MESSAGE_TYPES['MOB_MOVE'], {
            'mobId': mob_id,
            'position': mob.position,
            'health': mob.health,
            'max_health': mob.max_health,
            'state': mob.state,
        })
        if died:
            await self._handle_mob_death(mob, attacker_id, server)
        return died

    async def _handle_mob_death(self, mob: Mob, killer_id: str, server):
        drops = mob.roll_loot()
        for drop in drops:
            server.world.spawn_item_entity(
                int(mob.position[0]), int(mob.position[1]), int(mob.position[2]),
                drop['type'], killer_id, drop['count']
            )
            await server.broadcast(MESSAGE_TYPES['SPAWN_ITEM_ENTITY'], {
                'x': mob.position[0], 'y': mob.position[1], 'z': mob.position[2],
                'type': drop['type'], 'count': drop['count'], 'harvester_id': killer_id,
            })
        if killer_id and killer_id in server.players:
            player = server.players[killer_id]
            leveled_up = player.give_experience(mob.xp_reward)
            if leveled_up:
                cid = server._find_client_by_player_id(killer_id)
                if cid:
                    await server.send_to_client(cid, MESSAGE_TYPES['PLAYER_LEVEL_UP'], {
                        'level': player.level,
                        'max_health': player.max_health,
                        'max_mana': player.max_mana,
                    })
        await server.broadcast(MESSAGE_TYPES['MOB_DESPAWN'], {'mobId': mob.id})
        self.mobs.pop(mob.id, None)
        logger.info(f"Mob {mob.id} ({mob.type}) died, dropped {len(drops)} items")


class NPC:
    """Non-Player Character with dialogue and quests"""
    def __init__(self, npc_id: str, name: str, position: List[float], npc_type: str = 'villager'):
        self.id = npc_id
        self.name = name
        self.position = position
        self.type = npc_type
        self.dialogue_tree = {}
        self.available_quests = []
        self.rotation = [0.0, 0.0]
        
    def get_dialogue(self, player_id: str) -> Dict[str, Any]:
        """Get appropriate dialogue for player"""
        # Simple dialogue system - can be expanded
        if player_id in self.dialogue_tree:
            return self.dialogue_tree[player_id]
        return {
            'text': f"Hello, traveler! I am {self.name}.",
            'options': [
                {'text': 'Tell me more.', 'next': 'more'},
                {'text': 'Goodbye.', 'next': 'exit'}
            ]
        }
    
    def set_dialogue(self, player_id: str, dialogue: Dict[str, Any]):
        """Set dialogue state for player"""
        self.dialogue_tree[player_id] = dialogue

class Quest:
    """Quest system for gather/craft/deliver tasks"""
    def __init__(self, quest_id: str, name: str, description: str):
        self.id = quest_id
        self.name = name
        self.description = description
        self.type = None  # 'gather', 'craft', 'deliver'
        self.requirements = []
        self.rewards = []
        self.completion_text = ""
        
    def check_completion(self, player) -> bool:
        """Check if player has completed quest requirements"""
        if self.type == 'gather':
            for req in self.requirements:
                if req['type'] == 'item':
                    # Check if player has enough items
                    count = 0
                    for slot in player.inventory.slots:
                        if slot and slot.get('type') == req['item_type']:
                            count += slot.get('count', 1)
                    if count < req['count']:
                        return False
        elif self.type == 'craft':
            # Check crafted items (would need tracking)
            pass
        elif self.type == 'deliver':
            # Check if player has the delivery item
            pass
        return True
    
    def give_reward(self, player):
        """Give quest rewards to player"""
        for reward in self.rewards:
            if reward['type'] == 'item':
                player.inventory.add_item(reward['item_type'], reward['count'])
            # Experience is handled by the caller

async def main():
    """Main entry point"""
    server = VoxelServer()
    await server.start()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped by user")
