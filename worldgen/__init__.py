"""
World generation package for the voxel MMO.
Provides layered, deterministic world generation with biomes, resources, and sites.
"""

from .world_generator import WorldGenerator, ChunkGenerator, RegionGenerator
from .coords import WorldSeed, WorldCoords
from .noise import NoiseGenerator
from .models.chunk_context import (
    ChunkContext, ChunkGenerationResult, RegionRecord, SiteRecord,
    SpawnRule, BiomeDef, BiomeType, SiteType, ClimateSample, BiomeSample
)

__all__ = [
    'WorldGenerator', 'ChunkGenerator', 'RegionGenerator',
    'WorldSeed', 'WorldCoords', 'NoiseGenerator',
    'ChunkContext', 'ChunkGenerationResult', 'RegionRecord', 'SiteRecord',
    'SpawnRule', 'BiomeDef', 'BiomeType', 'SiteType', 'ClimateSample', 'BiomeSample'
]
