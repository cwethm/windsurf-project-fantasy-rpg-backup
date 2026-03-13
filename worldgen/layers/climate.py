"""
Climate generation layer.
Generates temperature, humidity, and other climate parameters.
"""

import math
from typing import Dict, Any
from ..noise import NoiseGenerator
from ..coords import WorldSeed
from ..models.chunk_context import ChunkContext, ChunkGenerationResult, ClimateSample


class ClimateLayer:
    """Generates climate data using noise patterns."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("climate")
        
        # Different noise generators for climate components
        self.temperature_noise = NoiseGenerator(self.seed)
        self.humidity_noise = NoiseGenerator(self.seed + 1)
        self.pressure_noise = NoiseGenerator(self.seed + 2)
        self.current_noise = NoiseGenerator(self.seed + 3)
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate climate data for the chunk."""
        chunk_size = context.chunk_size
        
        # Generate climate maps
        temp_map = self._generate_temperature_map(context)
        humidity_map = self._generate_humidity_map(context)
        pressure_map = self._generate_pressure_map(context)
        
        # Combine into climate samples
        climate_map = []
        for x in range(chunk_size):
            climate_row = []
            for z in range(chunk_size):
                climate = ClimateSample(
                    temperature=temp_map[x][z],
                    humidity=humidity_map[x][z],
                    drainage=self._calculate_drainage(temp_map[x][z], humidity_map[x][z]),
                    elevation=0.5  # Will be updated after terrain generation
                )
                climate_row.append(climate)
            climate_map.append(climate_row)
        
        # Store climate data
        result.metadata['climate_map'] = climate_map
        
        # Update context with averaged climate
        context.climate = self._average_climate(climate_map)
    
    def _generate_temperature_map(self, context: ChunkContext) -> list:
        """Generate temperature map."""
        chunk_size = context.chunk_size
        temp_map = [[0.0 for _ in range(chunk_size)] for _ in range(chunk_size)]
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                world_x = context.chunk_x * chunk_size + x
                world_z = context.chunk_z * chunk_size + z
                
                # Base temperature from latitude (Z coordinate)
                latitude_factor = 1.0 - abs(world_z * 0.0001)  # Warmer at equator
                
                # Altitude cooling
                altitude_factor = 1.0
                if 'heightmap' in context.__dict__:
                    # Will be updated after terrain generation
                    pass
                
                # Large-scale temperature patterns
                large_scale = self.temperature_noise.fractal_noise_2d(
                    world_x * 0.02, world_z * 0.02,
                    octaves=3, persistence=0.7
                )
                
                # Local variations
                local = self.temperature_noise.fractal_noise_2d(
                    world_x * 0.08, world_z * 0.08,
                    octaves=2, persistence=0.5
                )
                
                # Ocean influence (if near water)
                ocean_influence = self._get_ocean_influence(world_x, world_z)
                
                # Combine factors
                temperature = (
                    latitude_factor * 0.4 +
                    large_scale * 0.3 +
                    local * 0.2 +
                    ocean_influence * 0.1
                )
                
                # Normalize to 0-1
                temperature = max(0.0, min(1.0, temperature))
                temp_map[x][z] = temperature
        
        return temp_map
    
    def _generate_humidity_map(self, context: ChunkContext) -> list:
        """Generate humidity map."""
        chunk_size = context.chunk_size
        humidity_map = [[0.0 for _ in range(chunk_size)] for _ in range(chunk_size)]
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                world_x = context.chunk_x * chunk_size + x
                world_z = context.chunk_z * chunk_size + z
                
                # Large-scale humidity patterns
                large_scale = self.humidity_noise.fractal_noise_2d(
                    world_x * 0.018, world_z * 0.018,
                    octaves=4, persistence=0.6
                )
                
                # Local humidity
                local = self.humidity_noise.fractal_noise_2d(
                    world_x * 0.07, world_z * 0.07,
                    octaves=2, persistence=0.4
                )
                
                # Proximity to water increases humidity
                water_proximity = self._get_water_proximity(world_x, world_z)
                
                # Temperature affects humidity (warmer air holds more moisture)
                temp_factor = 0.5  # Will be updated after temp generation
                
                # Combine factors
                humidity = (
                    large_scale * 0.4 +
                    local * 0.2 +
                    water_proximity * 0.3 +
                    temp_factor * 0.1
                )
                
                # Normalize to 0-1
                humidity = max(0.0, min(1.0, humidity))
                humidity_map[x][z] = humidity
        
        return humidity_map
    
    def _generate_pressure_map(self, context: ChunkContext) -> list:
        """Generate atmospheric pressure map."""
        chunk_size = context.chunk_size
        pressure_map = [[0.0 for _ in range(chunk_size)] for _ in range(chunk_size)]
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                world_x = context.chunk_x * chunk_size + x
                world_z = context.chunk_z * chunk_size + z
                
                # Pressure systems (high and low pressure areas)
                pressure = self.pressure_noise.fractal_noise_2d(
                    world_x * 0.015, world_z * 0.015,
                    octaves=2, persistence=0.8
                )
                
                # Normalize to 0-1
                pressure = (pressure + 1.0) * 0.5
                pressure_map[x][z] = pressure
        
        return pressure_map
    
    def _calculate_drainage(self, temperature: float, humidity: float) -> float:
        """Calculate drainage based on temperature and humidity."""
        # Hot and wet = poor drainage (swamps)
        # Cold and wet = moderate drainage
        # Hot and dry = excellent drainage
        # Cold and dry = good drainage
        
        if temperature > 0.7 and humidity > 0.7:
            return 0.2  # Poor drainage
        elif temperature > 0.7 and humidity < 0.3:
            return 0.9  # Excellent drainage
        elif temperature < 0.3 and humidity > 0.7:
            return 0.5  # Moderate drainage
        else:
            return 0.7  # Good drainage
    
    def _get_ocean_influence(self, x: int, z: int) -> float:
        """Get ocean temperature influence (placeholder)."""
        # Later: check distance to ocean biomes
        return 0.0
    
    def _get_water_proximity(self, x: int, z: int) -> float:
        """Get proximity to water bodies (placeholder)."""
        # Later: check distance to rivers, lakes, oceans
        noise = NoiseGenerator(self.seed + 100)
        proximity = noise.noise_2d(x * 0.01, z * 0.01)
        return (proximity + 1.0) * 0.5
    
    def _average_climate(self, climate_map) -> ClimateSample:
        """Average climate across the chunk."""
        chunk_size = len(climate_map)
        
        avg_temp = sum(cell.temperature for row in climate_map for cell in row) / (chunk_size * chunk_size)
        avg_humidity = sum(cell.humidity for row in climate_map for cell in row) / (chunk_size * chunk_size)
        avg_drainage = sum(cell.drainage for row in climate_map for cell in row) / (chunk_size * chunk_size)
        avg_elevation = sum(cell.elevation for row in climate_map for cell in row) / (chunk_size * chunk_size)
        
        return ClimateSample(
            temperature=avg_temp,
            humidity=avg_humidity,
            drainage=avg_drainage,
            elevation=avg_elevation
        )
