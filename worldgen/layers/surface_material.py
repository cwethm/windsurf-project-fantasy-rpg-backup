"""
Surface material generation layer.
Applies biome-specific surface and sub-surface blocks.
"""

from typing import Dict, Any
from ..noise import NoiseGenerator
from ..coords import WorldSeed
from ..models.chunk_context import ChunkContext, ChunkGenerationResult, BiomeType


class SurfaceMaterialLayer:
    """Applies surface materials based on biome and climate."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("surface_material")
        self.noise = NoiseGenerator(self.seed)
        
        # Surface block mappings by biome
        self.surface_blocks = {
            BiomeType.OCEAN: (6, 7),      # WATER surface, SAND bottom
            BiomeType.BEACH: (7, 7),      # SAND surface, SAND sub-surface
            BiomeType.PLAINS: (1, 2),     # GRASS surface, DIRT sub-surface
            BiomeType.FOREST: (1, 2),     # GRASS surface, DIRT sub-surface
            BiomeType.CONIFER_FOREST: (1, 2),  # GRASS surface, DIRT sub-surface
            BiomeType.RAINFOREST: (1, 2), # GRASS surface, DIRT sub-surface
            BiomeType.SAVANNA: (1, 2),    # GRASS surface, DIRT sub-surface
            BiomeType.DESERT: (7, 7),     # SAND surface, SAND sub-surface
            BiomeType.TUNDRA: (3, 3),     # STONE/SNOW surface, STONE sub-surface
            BiomeType.ALPINE: (3, 3),     # STONE surface, STONE sub-surface
            BiomeType.MARSH: (2, 2),      # DIRT surface, DIRT sub-surface
            BiomeType.RIVER: (6, 7),      # WATER surface, SAND bottom
            BiomeType.LAKE: (6, 7),       # WATER surface, SAND bottom
        }
        
        # Special decorative blocks
        self.decorative_blocks = {
            BiomeType.FOREST: [5, 18, 19],     # LEAVES, flowers
            BiomeType.CONIFER_FOREST: [5],     # LEAVES
            BiomeType.RAINFOREST: [5, 18, 19], # LEAVES, flowers
            BiomeType.PLAINS: [18, 19],        # Flowers
            BiomeType.DESERT: [7],             # SAND variations
            BiomeType.TUNDRA: [3],             # Stone/snow
            BiomeType.MARSH: [2],              # DIRT variations
        }
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Apply surface materials to the chunk."""
        chunk_size = context.chunk_size
        biome_map = result.metadata.get('biome_map')
        heightmap = result.metadata.get('heightmap')
        
        if not biome_map or not heightmap:
            return
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                biome = biome_map[x][z]
                surface_height = heightmap[x][z]
                
                # Get surface blocks for this biome
                primary_biome = biome.primary_biome
                surface_block, sub_surface_block = self.surface_blocks.get(
                    primary_biome, (1, 2)  # Default to GRASS/DIRT
                )
                
                # Handle biome blending
                if biome.secondary_biome and biome.blend_factor > 0:
                    secondary_surface, secondary_sub = self.surface_blocks.get(
                        biome.secondary_biome, (1, 2)
                    )
                    
                    # Blend blocks based on blend factor
                    if self.noise.noise_2d(x * 0.3, z * 0.3) < biome.blend_factor:
                        surface_block = secondary_surface
                        sub_surface_block = secondary_sub
                
                # Apply surface blocks
                for y in range(surface_height, -1, -1):
                    block_index = x + z * chunk_size + y * chunk_size * chunk_size
                    
                    if y == surface_height:
                        if surface_block == 6:  # WATER
                            sea_level = 32
                            if surface_height < sea_level:
                                result.blocks[block_index] = surface_block
                            else:
                                result.blocks[block_index] = 1  # GRASS
                        else:
                            result.blocks[block_index] = surface_block
                    
                    elif y >= surface_height - 2:
                        result.blocks[block_index] = sub_surface_block
                    else:
                        break  # Below sub-surface, nothing to change
                
                # Decorative props placed at surface_y+1 (correct position, outside loop)
                if surface_block != 6 and self._should_place_decoration(x, z, biome):
                    decorative = self._get_decorative_block(biome)
                    if decorative:
                        dec_y = surface_height + 1
                        if dec_y < context.chunk_height:
                            result.props.append({
                                'type': 'surface_decor',
                                'block_id': decorative,
                                'x': x,
                                'y': dec_y,
                                'z': z,
                                'collidable': False
                            })
        
        # Store surface data for other layers
        result.metadata['surface_blocks'] = self.surface_blocks
        result.metadata['decorative_blocks'] = self.decorative_blocks
    
    def _should_place_decoration(self, x: int, z: int, biome) -> bool:
        """Determine if a decorative block should be placed."""
        # Use noise for natural-looking distribution
        decoration_chance = self.noise.fractal_noise_2d(
            x * 0.1, z * 0.1,
            octaves=2, persistence=0.5
        )
        
        # Different biomes have different decoration densities
        density_map = {
            BiomeType.FOREST: 0.15,
            BiomeType.CONIFER_FOREST: 0.12,
            BiomeType.RAINFOREST: 0.20,
            BiomeType.PLAINS: 0.05,
            BiomeType.DESERT: 0.02,
            BiomeType.TUNDRA: 0.01,
            BiomeType.MARSH: 0.08,
        }
        
        threshold = density_map.get(biome.primary_biome, 0.05)
        return decoration_chance > (1.0 - threshold)
    
    def _get_decorative_block(self, biome) -> int:
        """Get a decorative block for the biome."""
        decorative_list = self.decorative_blocks.get(biome.primary_biome, [])
        if not decorative_list:
            return 0
        
        # Weighted selection
        if biome.primary_biome == BiomeType.FOREST:
            # More leaves than flowers
            return 5 if self.noise.noise_2d(biome.blend_factor * 10, 0) > 0.3 else 18
        elif biome.primary_biome == BiomeType.PLAINS:
            # Random flowers
            return 18 if self.noise.noise_2d(0, biome.blend_factor * 10) > 0.5 else 19
        else:
            # Random from list
            idx = int(abs(self.noise.noise_2d(biome.blend_factor * 5, 0)) * len(decorative_list))
            return decorative_list[min(idx, len(decorative_list) - 1)]


class SoilCompositionLayer:
    """Generates soil composition and depth variations."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("soil_composition")
        self.noise = NoiseGenerator(self.seed)
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Apply soil composition variations."""
        chunk_size = context.chunk_size
        heightmap = result.metadata.get('heightmap')
        biome_map = result.metadata.get('biome_map')
        
        if not heightmap or not biome_map:
            return
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                surface_height = heightmap[x][z]
                biome = biome_map[x][z]
                
                # Soil depth varies by biome and noise
                base_depth = self._get_soil_depth(biome)
                depth_variation = self.noise.noise_2d(x * 0.2, z * 0.2) * 0.5 + 0.5
                soil_depth = int(base_depth * depth_variation)
                
                # Apply soil layers
                for y in range(surface_height - 1, max(0, surface_height - soil_depth - 3), -1):
                    block_index = x + z * chunk_size + y * chunk_size * chunk_size
                    
                    if result.blocks[block_index] == 2:  # DIRT
                        # Vary dirt type based on depth and biome
                        if y < surface_height - soil_depth:
                            result.blocks[block_index] = 3  # STONE (transition)
                        elif biome.primary_biome == BiomeType.DESERT:
                            result.blocks[block_index] = 7  # SANDSTONE (later)
                        elif biome.primary_biome == BiomeType.MARSH:
                            # Clay in marshes
                            if self.noise.noise_2d(x * 0.5, z * 0.5) > 0.3:
                                result.blocks[block_index] = 8  # CLAY (later)
    
    def _get_soil_depth(self, biome) -> float:
        """Get base soil depth for biome."""
        depth_map = {
            BiomeType.PLAINS: 3.0,
            BiomeType.FOREST: 2.5,
            BiomeType.CONIFER_FOREST: 2.0,
            BiomeType.RAINFOREST: 1.5,  # Thin soil in rainforest
            BiomeType.DESERT: 5.0,      # Deep sand
            BiomeType.TUNDRA: 1.0,      # Thin soil
            BiomeType.ALPINE: 0.5,      # Very thin
            BiomeType.MARSH: 4.0,       # Deep sediment
        }
        return depth_map.get(biome.primary_biome, 2.0)
