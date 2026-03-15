"""
Climate generation layer.
Generates temperature, humidity, and other climate parameters.
"""

import math
from typing import Dict, Any, List
from ..noise import NoiseGenerator
from ..coords import WorldSeed
from ..models.chunk_context import ChunkContext, ChunkGenerationResult, ClimateSample


class ClimateLayer:
    """Generates climate data using noise patterns."""
    
    # Climate generation constants
    LATITUDE_SCALE = 0.0001
    TEMP_LARGE_SCALE = 0.02
    TEMP_LOCAL_SCALE = 0.08
    HUMIDITY_LARGE_SCALE = 0.018
    HUMIDITY_LOCAL_SCALE = 0.07
    PRESSURE_SCALE = 0.015
    WATER_PROXIMITY_SCALE = 0.01
    
    # Weight factors for temperature calculation
    LATITUDE_WEIGHT = 0.4
    TEMP_LARGE_WEIGHT = 0.3
    TEMP_LOCAL_WEIGHT = 0.2
    OCEAN_WEIGHT = 0.1
    
    # Weight factors for humidity calculation
    HUMIDITY_LARGE_WEIGHT = 0.4
    HUMIDITY_LOCAL_WEIGHT = 0.2
    WATER_PROXIMITY_WEIGHT = 0.3
    TEMP_HUMIDITY_WEIGHT = 0.1
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("climate")
        
        # Different noise generators for climate components
        self.temperature_noise = NoiseGenerator(self.seed)
        self.humidity_noise = NoiseGenerator(self.seed + 1)
        self.pressure_noise = NoiseGenerator(self.seed + 2)
        self.current_noise = NoiseGenerator(self.seed + 3)
        self.water_proximity_noise = NoiseGenerator(self.seed + 100)
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate climate data for the chunk."""
        chunk_size = context.chunk_size
        
        # Validate chunk size
        if chunk_size <= 0:
            raise ValueError(f"Invalid chunk_size: {chunk_size}")
        
        # Generate climate maps
        temp_map = self._generate_temperature_map(context)
        humidity_map = self._generate_humidity_map(context, temp_map)
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
    
    def _generate_temperature_map(self, context: ChunkContext) -> List[List[float]]:
        """Generate temperature map."""
        chunk_size = context.chunk_size
        temp_map = [[0.0 for _ in range(chunk_size)] for _ in range(chunk_size)]
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                world_x = context.chunk_x * chunk_size + x
                world_z = context.chunk_z * chunk_size + z
                
                # Base temperature from latitude (Z coordinate)
                latitude_factor = 1.0 - abs(world_z * self.LATITUDE_SCALE)
                
                # Large-scale temperature patterns
                large_scale = self.temperature_noise.fractal_noise_2d(
                    world_x * self.TEMP_LARGE_SCALE, world_z * self.TEMP_LARGE_SCALE,
                    octaves=3, persistence=0.7
                )
                
                # Local variations
                local = self.temperature_noise.fractal_noise_2d(
                    world_x * self.TEMP_LOCAL_SCALE, world_z * self.TEMP_LOCAL_SCALE,
                    octaves=2, persistence=0.5
                )
                
                # Ocean influence (if near water)
                ocean_influence = self._get_ocean_influence(world_x, world_z)
                
                # Combine factors
                temperature = (
                    latitude_factor * self.LATITUDE_WEIGHT +
                    large_scale * self.TEMP_LARGE_WEIGHT +
                    local * self.TEMP_LOCAL_WEIGHT +
                    ocean_influence * self.OCEAN_WEIGHT
                )
                
                # Normalize to 0-1
                temperature = max(0.0, min(1.0, temperature))
                temp_map[x][z] = temperature
        
        return temp_map
    
    def _generate_humidity_map(self, context: ChunkContext, temp_map: List[List[float]]) -> List[List[float]]:
        """Generate humidity map."""
        chunk_size = context.chunk_size
        humidity_map = [[0.0 for _ in range(chunk_size)] for _ in range(chunk_size)]
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                world_x = context.chunk_x * chunk_size + x
                world_z = context.chunk_z * chunk_size + z
                
                # Large-scale humidity patterns
                large_scale = self.humidity_noise.fractal_noise_2d(
                    world_x * self.HUMIDITY_LARGE_SCALE, world_z * self.HUMIDITY_LARGE_SCALE,
                    octaves=4, persistence=0.6
                )
                
                # Local humidity
                local = self.humidity_noise.fractal_noise_2d(
                    world_x * self.HUMIDITY_LOCAL_SCALE, world_z * self.HUMIDITY_LOCAL_SCALE,
                    octaves=2, persistence=0.4
                )
                
                # Proximity to water increases humidity
                water_proximity = self._get_water_proximity(world_x, world_z)
                
                # Temperature affects humidity (warmer air holds more moisture)
                temp_factor = temp_map[x][z]
                
                # Combine factors
                humidity = (
                    large_scale * self.HUMIDITY_LARGE_WEIGHT +
                    local * self.HUMIDITY_LOCAL_WEIGHT +
                    water_proximity * self.WATER_PROXIMITY_WEIGHT +
                    temp_factor * self.TEMP_HUMIDITY_WEIGHT
                )
                
                # Normalize to 0-1
                humidity = max(0.0, min(1.0, humidity))
                humidity_map[x][z] = humidity
        
        return humidity_map
    
    def _generate_pressure_map(self, context: ChunkContext) -> List[List[float]]:
        """Generate atmospheric pressure map."""
        chunk_size = context.chunk_size
        pressure_map = [[0.0 for _ in range(chunk_size)] for _ in range(chunk_size)]
        
        for x in range(chunk_size):
            for z in range(chunk_size):
                world_x = context.chunk_x * chunk_size + x
                world_z = context.chunk_z * chunk_size + z
                
                # Pressure systems (high and low pressure areas)
                pressure = self.pressure_noise.fractal_noise_2d(
                    world_x * self.PRESSURE_SCALE, world_z * self.PRESSURE_SCALE,
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
        proximity = self.water_proximity_noise.noise_2d(x * self.WATER_PROXIMITY_SCALE, z * self.WATER_PROXIMITY_SCALE)
        return (proximity + 1.0) * 0.5
    
    def _average_climate(self, climate_map: List[List[ClimateSample]]) -> ClimateSample:
        """Average climate across the chunk."""
        chunk_size = len(climate_map)
        
        if chunk_size == 0:
            raise ValueError("Cannot average empty climate map")
        
        # Calculate all averages in a single loop for efficiency
        total_temp = 0.0
        total_humidity = 0.0
        total_drainage = 0.0
        total_elevation = 0.0
        cell_count = 0
        
        for row in climate_map:
            for cell in row:
                total_temp += cell.temperature
                total_humidity += cell.humidity
                total_drainage += cell.drainage
                total_elevation += cell.elevation
                cell_count += 1
        
        return ClimateSample(
            temperature=total_temp / cell_count,
            humidity=total_humidity / cell_count,
            drainage=total_drainage / cell_count,
            elevation=total_elevation / cell_count
        )
