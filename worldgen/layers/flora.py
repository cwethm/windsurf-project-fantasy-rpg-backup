"""
Flora generation layer.
Generates trees, bushes, grass patches, and other vegetation.
"""

import math
from typing import Dict, Any, List, Tuple
from ..noise import NoiseGenerator
from ..coords import WorldSeed
from ..models.chunk_context import ChunkContext, ChunkGenerationResult, BiomeType


class FloraGenerationLayer:
    """Generates flora based on biome and environmental conditions."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("flora")
        self.noise = NoiseGenerator(self.seed)
        
        # Tree types by biome
        self.tree_types = {
            BiomeType.FOREST: {
                'trees': [
                    {'type': 'oak', 'height': (5, 8), 'density': 0.6},
                    {'type': 'birch', 'height': (6, 9), 'density': 0.3},
                    {'type': 'maple', 'height': (7, 10), 'density': 0.1}
                ]
            },
            BiomeType.CONIFER_FOREST: {
                'trees': [
                    {'type': 'pine', 'height': (8, 12), 'density': 0.7},
                    {'type': 'spruce', 'height': (10, 15), 'density': 0.2},
                    {'type': 'fir', 'height': (7, 11), 'density': 0.1}
                ]
            },
            BiomeType.RAINFOREST: {
                'trees': [
                    {'type': 'jungle', 'height': (10, 15), 'density': 0.5},
                    {'type': 'palm', 'height': (8, 12), 'density': 0.3},
                    {'type': 'rubber', 'height': (12, 18), 'density': 0.2}
                ]
            },
            BiomeType.PLAINS: {
                'trees': [
                    {'type': 'oak', 'height': (4, 6), 'density': 0.1}  # Sparse trees
                ]
            },
            BiomeType.SAVANNA: {
                'trees': [
                    {'type': 'acacia', 'height': (6, 9), 'density': 0.2},
                    {'type': 'baobab', 'height': (8, 10), 'density': 0.05}
                ]
            },
            BiomeType.MARSH: {
                'trees': [
                    {'type': 'willow', 'height': (6, 8), 'density': 0.2},
                    {'type': 'cypress', 'height': (8, 12), 'density': 0.1}
                ]
            }
        }
        
        # Ground cover types - using shared constants for block IDs
        from shared.constants import BLOCK_TYPES
        
        self.ground_cover = {
            BiomeType.FOREST: [
                {'type': 'grass', 'block_id': BLOCK_TYPES['GRASS'], 'density': 0.8},
                {'type': 'fern', 'block_id': BLOCK_TYPES['FLOWERS'], 'density': 0.3},
                {'type': 'mushroom', 'block_id': BLOCK_TYPES['MUSHROOM_CLUSTER'], 'density': 0.1},
                {'type': 'herb_shrub', 'block_id': BLOCK_TYPES['HERB_SHRUB'], 'density': 0.2}
            ],
            BiomeType.PLAINS: [
                {'type': 'grass', 'block_id': BLOCK_TYPES['GRASS'], 'density': 0.9},
                {'type': 'flower', 'block_id': BLOCK_TYPES['FLOWERS'], 'density': 0.2},
                {'type': 'tall_grass', 'block_id': BLOCK_TYPES['TALL_GRASS'], 'density': 0.3},
                {'type': 'berry_bush', 'block_id': BLOCK_TYPES['BERRY_BUSH'], 'density': 0.1}
            ],
            BiomeType.DESERT: [
                {'type': 'dead_grass', 'block_id': BLOCK_TYPES['SAND'], 'density': 0.1},
                {'type': 'desert_shrub', 'block_id': BLOCK_TYPES['THORN_BUSH'], 'density': 0.05}
            ],
            BiomeType.TUNDRA: [
                {'type': 'lichen', 'block_id': BLOCK_TYPES['STONE'], 'density': 0.2},
                {'type': 'moss', 'block_id': BLOCK_TYPES['STONE'], 'density': 0.1}
            ],
            BiomeType.MARSH: [
                {'type': 'reeds', 'block_id': BLOCK_TYPES['REED_BED'], 'density': 0.6},
                {'type': 'moss', 'block_id': BLOCK_TYPES['GRASS'], 'density': 0.4}
            ]
        }
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate flora in the chunk."""
        chunk_size = context.chunk_size
        heightmap = result.metadata.get('heightmap')
        biome_map = result.metadata.get('biome_map')
        
        if not heightmap or not biome_map:
            return
        
        # Generate trees first (they affect placement of other flora)
        self._generate_trees(context, result)
        
        # Generate ground cover
        self._generate_ground_cover(context, result)
        
        # Generate vegetation clusters
        self._generate_vegetation_clusters(context, result)
    
    def _generate_trees(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate trees based on biome."""
        chunk_size = context.chunk_size
        heightmap = result.metadata['heightmap']
        biome_map = result.metadata['biome_map']
        
        # Tree placement noise (larger scale for natural clustering)
        tree_noise = self.noise.fractal_noise_2d(
            context.chunk_x * 0.1, context.chunk_z * 0.1,
            octaves=3, persistence=0.6
        )
        
        # Determine if this chunk should have trees
        biome_counts = {}
        for row in biome_map:
            for biome in row:
                biome_counts[biome.primary_biome] = biome_counts.get(biome.primary_biome, 0) + 1
        
        if not biome_counts:
            return
        
        dominant_biome = max(biome_counts, key=biome_counts.get)
        tree_config = self.tree_types.get(dominant_biome)
        
        if not tree_config:
            return
        
        # Generate tree positions
        for tree_type in tree_config['trees']:
            num_trees = int(tree_type['density'] * 10 * (0.5 + tree_noise))
            
            for _ in range(num_trees):
                # Find a good position
                attempts = 10
                while attempts > 0:
                    x = int(abs(self.noise.noise_2d(context.chunk_x * 10 + _, 0)) * chunk_size)
                    z = int(abs(self.noise.noise_2d(context.chunk_z * 10 + _, 100)) * chunk_size)
                    
                    # Check biome at this position
                    if x < chunk_size and z < chunk_size:
                        local_biome = biome_map[x][z]
                        if local_biome.primary_biome == dominant_biome:
                            surface_y = heightmap[x][z]
                            
                            # Check spacing from other trees
                            if self._check_tree_spacing(x, z, result):
                                # Generate the tree
                                self._generate_tree(
                                    x, surface_y + 1, z,
                                    tree_type['type'],
                                    tree_type['height'],
                                    result
                                )
                                break
                    
                    attempts -= 1
    
    def _generate_tree(self, x: int, y: int, z: int, tree_type: str, 
                      height_range: Tuple[int, int], result: ChunkGenerationResult):
        """Generate a single tree."""
        chunk_size = 16
        chunk_height = 64
        
        # Random height within range
        height = height_range[0] + int(
            abs(self.noise.noise_2d(x * 10, z * 10)) * 
            (height_range[1] - height_range[0])
        )
        
        # Generate trunk
        for h in range(height):
            if y + h < chunk_height:
                block_index = x + z * chunk_size + (y + h) * chunk_size * chunk_size
                result.blocks[block_index] = 4  # WOOD
        
        # Generate leaves (simple sphere shape)
        leaf_start = y + height - 3
        leaf_radius = 2 if tree_type in ['pine', 'spruce', 'fir'] else 3
        
        for lx in range(-leaf_radius, leaf_radius + 1):
            for lz in range(-leaf_radius, leaf_radius + 1):
                for ly in range(-2, 3):
                    world_x = x + lx
                    world_y = leaf_start + ly
                    world_z = z + lz
                    
                    # Check bounds
                    if (0 <= world_x < chunk_size and 0 <= world_z < chunk_size and 
                        0 <= world_y < chunk_height):
                        
                        # Distance from trunk
                        dist = math.sqrt(lx*lx + lz*lz + ly*ly*0.7)
                        
                        if dist <= leaf_radius:
                            block_index = world_x + world_z * chunk_size + world_y * chunk_size * chunk_size
                            
                            # Don't replace trunk
                            if result.blocks[block_index] != 4:
                                result.blocks[block_index] = 5  # LEAVES
        
        # Add to props list for client-side rendering
        result.props.append({
            'type': 'tree',
            'tree_type': tree_type,
            'x': x,
            'y': y,
            'z': z,
            'height': height
        })
    
    def _check_tree_spacing(self, x: int, z: int, result: ChunkGenerationResult) -> bool:
        """Check if there's enough space for a tree."""
        # Check existing trees in props
        min_spacing = 3
        
        for prop in result.props:
            if prop['type'] == 'tree':
                dist = math.sqrt((x - prop['x'])**2 + (z - prop['z'])**2)
                if dist < min_spacing:
                    return False
        
        return True
    
    def _generate_ground_cover(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate ground cover vegetation."""
        chunk_size = context.chunk_size
        heightmap = result.metadata['heightmap']
        biome_map = result.metadata['biome_map']
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                biome = biome_map[x][z]
                surface_y = heightmap[x][z]
                
                # Get ground cover for this biome
                cover_types = self.ground_cover.get(biome.primary_biome)
                if not cover_types:
                    continue
                
                for cover in cover_types:
                    # Use noise for natural distribution
                    noise_val = self.noise.fractal_noise_2d(
                        x * 0.3, z * 0.3,
                        octaves=2, persistence=0.4
                    )
                    
                    if noise_val > (1.0 - cover['density']):
                        place_y = surface_y + 1
                        if place_y < context.chunk_height:
                            block_index = x + z * chunk_size + place_y * chunk_size * chunk_size
                            if result.blocks[block_index] == 0:  # AIR
                                # Decorative ground cover → prop, not solid block
                                result.props.append({
                                    'type': cover['type'],
                                    'block_id': cover['block_id'],
                                    'x': x,
                                    'y': place_y,
                                    'z': z,
                                    'collidable': False
                                })
    
    def _generate_vegetation_clusters(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate clustered vegetation (flowers, mushrooms, etc.)."""
        chunk_size = context.chunk_size
        heightmap = result.metadata['heightmap']
        biome_map = result.metadata['biome_map']
        
        # Cluster centers using cellular noise
        for x in range(0, chunk_size, 4):
            for z in range(0, chunk_size, 4):
                # Determine cluster type based on biome
                local_biome = biome_map[x][z]
                
                cluster_type = self._get_cluster_type(local_biome)
                if not cluster_type:
                    continue
                
                # Check if this should be a cluster
                cluster_noise = self.noise.noise_2d(x * 0.2, z * 0.2)
                if cluster_noise > 0.6:
                    # Generate cluster as props, not solid blocks
                    self._generate_cluster(
                        x, z, heightmap[x][z] + 1,
                        cluster_type, result
                    )
    
    def _get_cluster_type(self, biome) -> Dict:
        """Get cluster type for biome."""
        cluster_types = {
            BiomeType.FOREST: {'type': 'mushroom_cluster', 'block_id': 19, 'radius': 2},
            BiomeType.PLAINS: {'type': 'flower_patch', 'block_id': 18, 'radius': 3},
            BiomeType.MARSH: {'type': 'reed_patch', 'block_id': 2, 'radius': 2},
            BiomeType.CONIFER_FOREST: {'type': 'pine_needles', 'block_id': 5, 'radius': 2},
        }
        return cluster_types.get(biome.primary_biome)
    
    def _generate_cluster(self, cx: int, cz: int, y: int, cluster_type: Dict, 
                         result: ChunkGenerationResult):
        """Generate a vegetation cluster."""
        chunk_size = 16
        chunk_height = 64
        radius = cluster_type['radius']
        
        for x in range(max(0, cx - radius), min(chunk_size, cx + radius)):
            for z in range(max(0, cz - radius), min(chunk_size, cz + radius)):
                dist = math.sqrt((x - cx)**2 + (z - cz)**2)
                
                if dist <= radius:
                    # Falloff from center
                    if self.noise.noise_2d(x * 0.5, z * 0.5) > dist / radius:
                        if y < chunk_height:
                            block_index = x + z * chunk_size + y * chunk_size * chunk_size
                            if result.blocks[block_index] == 0:  # AIR
                                # Decorative cluster → prop, not solid block
                                result.props.append({
                                    'type': cluster_type['type'],
                                    'block_id': cluster_type['block_id'],
                                    'x': x,
                                    'y': y,
                                    'z': z,
                                    'collidable': False
                                })


class AquaticFloraLayer:
    """Generates underwater and water-edge plants."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("aquatic_flora")
        self.noise = NoiseGenerator(self.seed)
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate aquatic flora."""
        chunk_size = context.chunk_size
        heightmap = result.metadata.get('heightmap')
        biome_map = result.metadata.get('biome_map')
        
        if not heightmap or not biome_map:
            return
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                biome = biome_map[x][z]
                
                # Check for water
                for y in range(context.chunk_height):
                    block_index = x + z * chunk_size + y * chunk_size * chunk_size
                    
                    if result.blocks[block_index] == 6:  # WATER
                        # Check below water
                        if y > 0:
                            below_index = x + z * chunk_size + (y - 1) * chunk_size * chunk_size
                            below_block = result.blocks[below_index]
                            
                            # Place aquatic plants as props (non-collidable)
                            if below_block in [1, 2, 7]:  # GRASS, DIRT, SAND
                                if self._should_place_aquatic_plant(x, z, biome):
                                    result.props.append({
                                        'type': 'seaweed',
                                        'block_id': 19,
                                        'x': x,
                                        'y': y,
                                        'z': z,
                                        'collidable': False
                                    })
                        break
