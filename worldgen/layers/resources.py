"""
Resource distribution layer.
Generates ore veins, surface resources, and biome-specific resources.
"""

import math
from typing import Dict, Any, List, Tuple
from ..noise import NoiseGenerator
from ..coords import WorldSeed
from ..models.chunk_context import ChunkContext, ChunkGenerationResult, BiomeType


class ResourceDistributionLayer:
    """Generates resource nodes and veins."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("resource_distribution")
        self.noise = NoiseGenerator(self.seed)
        
        # Import shared constants for block IDs
        from shared.constants import BLOCK_TYPES
        
        # Ore distribution parameters (depth, rarity, size)
        self.ore_types = {
            'coal': {
                'min_depth': 5, 'max_depth': 64,
                'rarity': 0.3, 'vein_size': 8,
                'block_id': BLOCK_TYPES['COAL_ORE'],
                'biomes': 'all'
            },
            'iron': {
                'min_depth': 10, 'max_depth': 64,
                'rarity': 0.2, 'vein_size': 6,
                'block_id': BLOCK_TYPES['IRON_ORE'],
                'biomes': 'all'
            },
            'gold': {
                'min_depth': 20, 'max_depth': 64,
                'rarity': 0.1, 'vein_size': 4,
                'block_id': BLOCK_TYPES['GOLD_ORE'],
                'biomes': ['desert', 'savanna', 'plains']
            },
            'diamond': {
                'min_depth': 30, 'max_depth': 64,
                'rarity': 0.05, 'vein_size': 3,
                'block_id': BLOCK_TYPES['DIAMOND_ORE'],
                'biomes': ['alpine', 'tundra']
            },
            # New ore types
            'copper': {
                'min_depth': 8, 'max_depth': 50,
                'rarity': 0.25, 'vein_size': 7,
                'block_id': BLOCK_TYPES['COPPER_VEIN'],
                'biomes': 'all'
            },
            'tin': {
                'min_depth': 12, 'max_depth': 55,
                'rarity': 0.2, 'vein_size': 6,
                'block_id': BLOCK_TYPES['TIN_VEIN'],
                'biomes': ['forest', 'plains', 'hills']
            },
            'silver': {
                'min_depth': 15, 'max_depth': 45,
                'rarity': 0.12, 'vein_size': 4,
                'block_id': BLOCK_TYPES['SILVER_VEIN'],
                'biomes': ['mountains', 'alpine', 'tundra']
            },
            'gem': {
                'min_depth': 25, 'max_depth': 60,
                'rarity': 0.03, 'vein_size': 2,
                'block_id': BLOCK_TYPES['GEM_SEAM'],
                'biomes': ['mountains', 'caves', 'deep_underground']
            },
        }
        
        # Surface resources by biome
        self.surface_resources = {
            BiomeType.FOREST: {
                'resources': [
                    {'type': 'oak_log', 'block_id': BLOCK_TYPES['OAK_LOG'], 'rarity': 0.6},
                    {'type': 'berry_bush', 'block_id': BLOCK_TYPES['BERRY_BUSH'], 'rarity': 0.2},
                    {'type': 'herb_shrub', 'block_id': BLOCK_TYPES['HERB_SHRUB'], 'rarity': 0.1},
                    {'type': 'flint_nodule', 'block_id': BLOCK_TYPES['FLINT_NODULE'], 'rarity': 0.05}
                ]
            },
            BiomeType.CONIFER_FOREST: {
                'resources': [
                    {'type': 'pine_log', 'block_id': BLOCK_TYPES['PINE_LOG'], 'rarity': 0.7},
                    {'type': 'pine_cone', 'block_id': BLOCK_TYPES['TALL_GRASS'], 'rarity': 0.3},
                    {'type': 'resin', 'block_id': BLOCK_TYPES['OAK_LOG'], 'rarity': 0.1}
                ]
            },
            BiomeType.DESERT: {
                'resources': [
                    {'type': 'thorn_bush', 'block_id': BLOCK_TYPES['THORN_BUSH'], 'rarity': 0.3},
                    {'type': 'dead_wood', 'block_id': BLOCK_TYPES['OAK_LOG'], 'rarity': 0.1},
                    {'type': 'clay_deposit', 'block_id': BLOCK_TYPES['CLAY_DEPOSIT'], 'rarity': 0.15}
                ]
            },
            BiomeType.PLAINS: {
                'resources': [
                    {'type': 'wheat', 'block_id': BLOCK_TYPES['TALL_GRASS'], 'rarity': 0.3},
                    {'type': 'herb_shrub', 'block_id': BLOCK_TYPES['HERB_SHRUB'], 'rarity': 0.2},
                    {'type': 'flowers', 'block_id': BLOCK_TYPES['FLOWERS'], 'rarity': 0.1},
                    {'type': 'clay_deposit', 'block_id': BLOCK_TYPES['CLAY_DEPOSIT'], 'rarity': 0.08}
                ]
            },
            BiomeType.MARSH: {
                'resources': [
                    {'type': 'reed_bed', 'block_id': BLOCK_TYPES['REED_BED'], 'rarity': 0.5},
                    {'type': 'peat', 'block_id': BLOCK_TYPES['DIRT'], 'rarity': 0.3},
                    {'type': 'clay_deposit', 'block_id': BLOCK_TYPES['CLAY_DEPOSIT'], 'rarity': 0.2}
                ]
            },
            BiomeType.RAINFOREST: {
                'resources': [
                    {'type': 'birch_log', 'block_id': BLOCK_TYPES['BIRCH_LOG'], 'rarity': 0.5},
                    {'type': 'mushroom_cluster', 'block_id': BLOCK_TYPES['MUSHROOM_CLUSTER'], 'rarity': 0.3},
                    {'type': 'herb_shrub', 'block_id': BLOCK_TYPES['HERB_SHRUB'], 'rarity': 0.2}
                ]
            },
            BiomeType.TUNDRA: {
                'resources': [
                    {'type': 'salt_deposit', 'block_id': BLOCK_TYPES['SALT_DEPOSIT'], 'rarity': 0.2},
                    {'type': 'flint_nodule', 'block_id': BLOCK_TYPES['FLINT_NODULE'], 'rarity': 0.15}
                ]
            },
        }
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate resources in the chunk."""
        chunk_size = context.chunk_size
        heightmap = result.metadata.get('heightmap')
        biome_map = result.metadata.get('biome_map')
        
        if not heightmap or not biome_map:
            return
        
        # Generate underground resources
        self._generate_ores(context, result)
        
        # Generate surface resources
        self._generate_surface_resources(context, result)
        
        # Generate biome-specific rare resources
        self._generate_rare_resources(context, result)
    
    def _generate_ores(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate underground ore veins."""
        chunk_size = context.chunk_size
        chunk_height = context.chunk_height
        
        for ore_name, ore_params in self.ore_types.items():
            # Check if this ore should appear in this biome
            if ore_params['biomes'] != 'all':
                # TODO: Check biome compatibility
                pass
            
            # Generate ore veins using cellular noise
            for x in range(chunk_size):
                for z in range(chunk_size):
                    # Get surface height for reference
                    surface_y = result.metadata['heightmap'][x][z]
                    
                    for y in range(ore_params['min_depth'], min(ore_params['max_depth'], chunk_height)):
                        # Use 3D noise for vein distribution
                        noise_val = self.noise.noise_3d(
                            x * 0.1, y * 0.1, z * 0.1
                        )
                        
                        # Check if we're in an ore vein
                        if noise_val > (1.0 - ore_params['rarity']):
                            # Check distance to surface
                            if y < surface_y - 3:  # Don't place too close to surface
                                block_index = x + z * chunk_size + y * chunk_size * chunk_size
                                
                                # Only replace stone
                                if result.blocks[block_index] == 3:  # STONE
                                    result.blocks[block_index] = ore_params['block_id']
                                    
                                    # Add to resource nodes list
                                    result.resource_nodes.append({
                                        'type': ore_name,
                                        'x': x,
                                        'y': y,
                                        'z': z,
                                        'block_id': ore_params['block_id']
                                    })
    
    def _generate_surface_resources(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate surface resources based on biome."""
        chunk_size = context.chunk_size
        heightmap = result.metadata['heightmap']
        biome_map = result.metadata['biome_map']
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                biome = biome_map[x][z]
                surface_y = heightmap[x][z]
                
                # Get resources for this biome
                biome_resources = self.surface_resources.get(biome.primary_biome)
                if not biome_resources:
                    continue
                
                for resource in biome_resources['resources']:
                    # Use noise for natural distribution
                    noise_val = self.noise.fractal_noise_2d(
                        x * 0.2, z * 0.2,
                        octaves=2, persistence=0.5
                    )
                    
                    if noise_val > (1.0 - resource['rarity']):
                        # Place resource on or near surface
                        place_y = surface_y + 1
                        
                        if place_y < context.chunk_height:
                            block_index = x + z * chunk_size + place_y * chunk_size * chunk_size
                            
                            # Only place in air
                            if result.blocks[block_index] == 0:  # AIR
                                if resource['type'] != 'frog':  # Skip entities for now
                                    result.blocks[block_index] = resource['block_id']
                                    
                                    # Add to resource nodes
                                    result.resource_nodes.append({
                                        'type': resource['type'],
                                        'x': x,
                                        'y': place_y,
                                        'z': z,
                                        'block_id': resource['block_id'],
                                        'surface': True
                                    })
    
    def _generate_rare_resources(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate rare biome-specific resources."""
        chunk_size = context.chunk_size
        heightmap = result.metadata['heightmap']
        biome_map = result.metadata['biome_map']
        
        # Rare resource locations (using larger scale noise)
        rare_noise = self.noise.fractal_noise_2d(
            context.chunk_x * 0.05, context.chunk_z * 0.05,
            octaves=3, persistence=0.7
        )
        
        # Check if this chunk has a rare resource
        if rare_noise > 0.85:  # 15% chance
            # Find dominant biome
            biome_counts = {}
            for row in biome_map:
                for biome in row:
                    biome_counts[biome.primary_biome] = biome_counts.get(biome.primary_biome, 0) + 1
            
            dominant_biome = max(biome_counts, key=biome_counts.get)
            
            # Place rare resource based on biome
            rare_resource = self._get_rare_resource(dominant_biome)
            if rare_resource:
                # Find a good spot
                for _ in range(10):  # Try 10 times
                    x = int(abs(self.noise.noise_2d(context.chunk_x * 10, _)) * chunk_size)
                    z = int(abs(self.noise.noise_2d(context.chunk_z * 10, _ + 100)) * chunk_size)
                    y = heightmap[x][z] + 1
                    
                    if y < context.chunk_height:
                        block_index = x + z * chunk_size + y * chunk_size * chunk_size
                        
                        if result.blocks[block_index] == 0:  # AIR
                            result.blocks[block_index] = rare_resource['block_id']
                            
                            result.resource_nodes.append({
                                'type': rare_resource['type'],
                                'rare': True,
                                'x': x,
                                'y': y,
                                'z': z,
                                'block_id': rare_resource['block_id']
                            })
                            break
    
    def _get_rare_resource(self, biome: BiomeType) -> Dict:
        """Get a rare resource for the biome."""
        rare_resources = {
            BiomeType.FOREST: {'type': 'ancient_wood', 'block_id': 4},
            BiomeType.CONIFER_FOREST: {'type': 'crystal_pine', 'block_id': 5},
            BiomeType.DESERT: {'type': 'desert_rose', 'block_id': 19},
            BiomeType.PLAINS: {'type': 'sunflower', 'block_id': 18},
            BiomeType.MARSH: {'type': 'lotus', 'block_id': 19},
            BiomeType.ALPINE: {'type': 'mountain_rose', 'block_id': 19},
            BiomeType.TUNDRA: {'type': 'ice_crystal', 'block_id': 3},
        }
        return rare_resources.get(biome)


class UndergroundFeaturesLayer:
    """Generates caves, underground lakes, and special features."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("underground_features")
        self.noise = NoiseGenerator(self.seed)
        self.cave_noise = NoiseGenerator(self.seed + 1000)
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate underground features."""
        # Simple cave generation using 3D noise
        chunk_size = context.chunk_size
        chunk_height = context.chunk_height
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                for y in range(5, chunk_height - 10):  # Don't cave too high or too low
                    # 3D noise for cave generation
                    cave_val = self.cave_noise.noise_3d(
                        x * 0.1, y * 0.1, z * 0.1
                    )
                    
                    # Create caves where noise is high
                    if cave_val > 0.7:
                        block_index = x + z * chunk_size + y * chunk_size * chunk_size
                        
                        # Carve out caves
                        if result.blocks[block_index] != 6:  # Don't remove water
                            result.blocks[block_index] = 0  # AIR
                            
                            # Add cave markers for mob spawning
                            result.spawn_markers.append({
                                'type': 'cave',
                                'x': x,
                                'y': y,
                                'z': z,
                                'light_level': 0
                            })
        
        # Underground lakes
        if self.noise.noise_2d(context.chunk_x * 0.3, context.chunk_z * 0.3) > 0.7:
            self._create_underground_lake(context, result)
    
    def _create_underground_lake(self, context: ChunkContext, result: ChunkGenerationResult):
        """Create an underground lake."""
        chunk_size = context.chunk_size
        lake_y = 15 + int(abs(self.noise.noise_2d(context.chunk_x, context.chunk_z)) * 10)
        lake_radius = 3 + int(abs(self.noise.noise_2d(context.chunk_x + 100, context.chunk_z)) * 3)
        
        # Center of chunk
        center_x = chunk_size // 2
        center_z = chunk_size // 2
        
        for x in range(max(0, center_x - lake_radius), min(chunk_size, center_x + lake_radius)):
            for z in range(max(0, center_z - lake_radius), min(chunk_size, center_z + lake_radius)):
                dist = math.sqrt((x - center_x)**2 + (z - center_z)**2)
                
                if dist < lake_radius:
                    for y in range(lake_y - 2, lake_y + 2):
                        if y < context.chunk_height:
                            block_index = x + z * chunk_size + y * chunk_size * chunk_size
                            
                            if y < lake_y:
                                result.blocks[block_index] = 3  # Stone floor
                            else:
                                result.blocks[block_index] = 6  # Water
