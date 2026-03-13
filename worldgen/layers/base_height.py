"""
Base terrain height generation layer.
Generates elevation, slope, and basic landform features.
"""

import math
from typing import Dict, Any
from ..noise import NoiseGenerator
from ..coords import WorldSeed
from ..models.chunk_context import ChunkContext, ChunkGenerationResult


class BaseHeightLayer:
    """Generates base terrain height using multi-layered noise."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("base_height")
        self.noise = NoiseGenerator(self.seed)
        
        # Different noise generators for different terrain features
        self.continent_noise = NoiseGenerator(self.seed + 1)
        self.mountain_noise = NoiseGenerator(self.seed + 2)
        self.hill_noise = NoiseGenerator(self.seed + 3)
        self.detail_noise = NoiseGenerator(self.seed + 4)
        self.ridge_noise = NoiseGenerator(self.seed + 5)
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Apply terrain height to chunk."""
        chunk_size = context.chunk_size
        chunk_height = context.chunk_height
        
        # Generate heightmap for this chunk
        heightmap = self._generate_heightmap(context)
        
        # Apply heights to block data
        for x in range(chunk_size):
            for z in range(chunk_size):
                world_x = context.chunk_x * chunk_size + x
                world_z = context.chunk_z * chunk_size + z
                
                base_height = heightmap[x][z]
                
                # Fill from bottom up to base height
                for y in range(chunk_height):
                    block_index = x + z * chunk_size + y * chunk_size * chunk_size
                    
                    if y < base_height:
                        # Determine block type based on depth
                        result.blocks[block_index] = self._get_block_type(y, base_height, context)
                    else:
                        result.blocks[block_index] = 0  # AIR
        
        # Store heightmap in metadata
        result.metadata['heightmap'] = heightmap
        result.metadata['base_elevation'] = sum(sum(row) for row in heightmap) / (chunk_size * chunk_size)
        
        # Update climate elevation data
        if 'climate_map' in result.metadata:
            for x in range(chunk_size):
                for z in range(chunk_size):
                    result.metadata['climate_map'][x][z].elevation = heightmap[x][z] / context.chunk_height
    
    def _generate_heightmap(self, context: ChunkContext) -> list:
        """Generate a heightmap for the chunk."""
        chunk_size = context.chunk_size
        heightmap = [[0 for _ in range(chunk_size)] for _ in range(chunk_size)]
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                world_x = context.chunk_x * chunk_size + x
                world_z = context.chunk_z * chunk_size + z
                
                # Continent-scale shape (large rolling features, ~512 block scale)
                continent = self.continent_noise.fractal_noise_2d(
                    world_x * 0.008, world_z * 0.008,
                    octaves=4, persistence=0.6
                )
                
                # Mountain ranges (only in high-continent areas)
                mountains = self.mountain_noise.ridged_noise_2d(
                    world_x * 0.02, world_z * 0.02,
                    octaves=5
                )
                
                # Gentle rolling hills (~64 block scale, LOW amplitude for walkability)
                hills = self.hill_noise.fractal_noise_2d(
                    world_x * 0.03, world_z * 0.03,
                    octaves=3, persistence=0.4
                )
                
                # Combine: macro shape only — detail noise removed from height.
                # Detail/micro-variation is expressed in material/prop layers, not elevation.
                elevation = 0.18 + continent * 0.20   # base land floor + gentle continent
                
                # Mountains: only where continent is high (rare)
                if continent > 0.4:
                    mountain_factor = min(1.0, mountains * 1.2)
                    elevation += mountain_factor * 0.25
                
                # Gentle hills — max ~4 blocks variation over 64-block span
                elevation += hills * 0.10
                
                # Never go below sea level at spawn
                elevation = max(0.06, elevation)
                
                # Apply climate influence
                if context.climate:
                    elevation *= self._get_elevation_modifier(context.climate)
                
                # Convert to block height (0 to chunk_height)
                # Base sea level at 32, max height at 60
                height = 32 + elevation * 28
                height = max(0, min(context.chunk_height - 1, int(height)))
                
                heightmap[x][z] = height
        
        # Post-process: smooth adjacent steps so most walkable terrain has ≤1 block diffs.
        # Mountain zones (continent-driven high elevations) keep their ruggedness naturally
        # because their height differences are already encoded in the macro shape.
        heightmap = self._smooth_heightmap(heightmap, context.chunk_size)
        
        return heightmap
    
    def _smooth_heightmap(self, heightmap: list, chunk_size: int) -> list:
        """Clamp adjacent height differences to ≤1 for walkable terrain."""
        changed = True
        passes = 0
        while changed and passes < 3:
            changed = False
            passes += 1
            for x in range(chunk_size):
                for z in range(chunk_size):
                    h = heightmap[x][z]
                    for nx, nz in ((x+1, z), (x-1, z), (x, z+1), (x, z-1)):
                        if 0 <= nx < chunk_size and 0 <= nz < chunk_size:
                            nh = heightmap[nx][nz]
                            if h - nh > 1:
                                heightmap[x][z] = nh + 1
                                h = heightmap[x][z]
                                changed = True
                            elif nh - h > 1:
                                heightmap[nx][nz] = h + 1
                                changed = True
        return heightmap
    
    def _get_elevation_modifier(self, climate) -> float:
        """Get elevation modifier based on climate."""
        # Hot and wet areas tend to be lower (swamps, wetlands)
        # Cold areas can be higher (mountains)
        # Dry areas have varied elevation
        
        modifier = 1.0
        
        if climate.temperature > 0.7 and climate.humidity > 0.7:
            # Hot and wet = lower elevation
            modifier *= 0.7
        elif climate.temperature < 0.3:
            # Cold = can be higher
            modifier *= 1.2
        elif climate.humidity < 0.2:
            # Dry = varied elevation
            modifier *= 1.1
        
        return modifier
    
    def _get_block_type(self, y: int, surface_y: int, context: ChunkContext) -> int:
        """Get block type based on depth and context."""
        depth = surface_y - y
        
        # Surface blocks
        if depth == 0:
            # Based on biome - use default if not set yet
            if context.biome and context.biome.primary_biome:
                biome_value = context.biome.primary_biome.value
            else:
                biome_value = "plains"  # Default biome
            
            if biome_value in ["ocean", "beach", "river", "lake"]:
                return 6  # WATER (if below sea level) or SAND
            elif biome_value == "desert":
                return 7  # SAND
            elif biome_value in ["plains", "savanna"]:
                return 1  # GRASS
            elif biome_value in ["forest", "conifer_forest", "rainforest"]:
                return 1  # GRASS
            elif biome_value in ["tundra", "alpine"]:
                return 3  # STONE or SNOW (later)
            elif biome_value == "marsh":
                return 2  # DIRT
            else:
                return 1  # Default to GRASS
        
        # Sub-surface layers
        elif depth <= 3:
            if context.biome and context.biome.primary_biome:
                biome_value = context.biome.primary_biome.value
                if biome_value in ["desert", "beach"]:
                    return 7  # SAND
                else:
                    return 2  # DIRT
            else:
                return 2  # Default to DIRT
        
        # Stone layers
        elif depth <= 10:
            return 3  # STONE
        
        # Deep stone
        else:
            return 3  # STONE


class SlopeLayer:
    """Calculates slope and roughness for terrain."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("slope")
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Calculate slope from heightmap."""
        heightmap = result.metadata.get('heightmap')
        if not heightmap:
            return
        
        chunk_size = context.chunk_size
        slopemap = [[0.0 for _ in range(chunk_size)] for _ in range(chunk_size)]
        
        for x in range(1, chunk_size - 1):
            for z in range(1, chunk_size - 1):
                # Calculate height differences with neighbors
                h = heightmap[x][z]
                h_n = heightmap[x][z - 1]
                h_s = heightmap[x][z + 1]
                h_e = heightmap[x + 1][z]
                h_w = heightmap[x - 1][z]
                
                # Calculate gradient
                grad_x = (h_e - h_w) * 0.5
                grad_z = (h_s - h_n) * 0.5
                
                # Slope magnitude
                slope = math.sqrt(grad_x * grad_x + grad_z * grad_z)
                slopemap[x][z] = slope
        
        # Store slope data
        result.metadata['slopemap'] = slopemap
        result.metadata['max_slope'] = max(max(row) for row in slopemap)
        result.metadata['avg_slope'] = sum(sum(row) for row in slopemap) / (chunk_size * chunk_size)
