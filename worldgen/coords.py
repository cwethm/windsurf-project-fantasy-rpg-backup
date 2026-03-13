"""
World generation coordinate and seed utilities.
Provides deterministic coordinate-based calculations.
"""

import hashlib
import math
from typing import Tuple


class WorldSeed:
    """Manages world seed and derived sub-seeds."""
    
    def __init__(self, base_seed: str):
        self.base_seed = base_seed
        self.seed_hash = int(hashlib.md5(base_seed.encode()).hexdigest(), 16)
    
    def get_layer_seed(self, layer_name: str) -> int:
        """Get a deterministic seed for a specific generation layer."""
        combined = f"{self.base_seed}:{layer_name}"
        return int(hashlib.md5(combined.encode()).hexdigest(), 16)
    
    def get_chunk_seed(self, chunk_x: int, chunk_z: int) -> int:
        """Get a deterministic seed for a specific chunk."""
        combined = f"{self.base_seed}:chunk:{chunk_x}:{chunk_z}"
        return int(hashlib.md5(combined.encode()).hexdigest(), 16)
    
    def get_region_seed(self, region_x: int, region_z: int) -> int:
        """Get a deterministic seed for a specific region."""
        combined = f"{self.base_seed}:region:{region_x}:{region_z}"
        return int(hashlib.md5(combined.encode()).hexdigest(), 16)


class WorldCoords:
    """Coordinate conversion utilities."""
    
    # Region size in chunks (e.g., 16x16 chunks = 256x256 blocks)
    REGION_SIZE_CHUNKS = 16
    
    # Chunk size in blocks
    CHUNK_SIZE = 16
    
    @staticmethod
    def chunk_to_region(chunk_coord: int) -> int:
        """Convert chunk coordinate to region coordinate."""
        return math.floor(chunk_coord / WorldCoords.REGION_SIZE_CHUNKS)
    
    @staticmethod
    def block_to_chunk(block_coord: int) -> int:
        """Convert block coordinate to chunk coordinate."""
        return math.floor(block_coord / WorldCoords.CHUNK_SIZE)
    
    @staticmethod
    def block_to_local(block_coord: int) -> int:
        """Convert block coordinate to local chunk coordinate."""
        return block_coord % WorldCoords.CHUNK_SIZE
    
    @staticmethod
    def get_region_bounds(region_x: int, region_z: int) -> Tuple[int, int, int, int]:
        """Get the block bounds of a region."""
        chunks_start_x = region_x * WorldCoords.REGION_SIZE_CHUNKS
        chunks_start_z = region_z * WorldCoords.REGION_SIZE_CHUNKS
        blocks_start_x = chunks_start_x * WorldCoords.CHUNK_SIZE
        blocks_start_z = chunks_start_z * WorldCoords.CHUNK_SIZE
        
        size_blocks = WorldCoords.REGION_SIZE_CHUNKS * WorldCoords.CHUNK_SIZE
        
        return (
            blocks_start_x,
            blocks_start_z,
            blocks_start_x + size_blocks,
            blocks_start_z + size_blocks
        )
