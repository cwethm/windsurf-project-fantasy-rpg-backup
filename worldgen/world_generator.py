"""
Main world generator orchestrator.
Coordinates all generation layers and manages the overall generation process.
"""

from typing import Dict, List, Optional
from .coords import WorldSeed, WorldCoords
from .models.chunk_context import ChunkContext, ChunkGenerationResult, RegionRecord
from .layers.base_height import BaseHeightLayer, SlopeLayer
from .layers.climate import ClimateLayer
from .layers.biome import BiomeLayer
from .layers.surface_material import SurfaceMaterialLayer, SoilCompositionLayer
from .layers.resources import ResourceDistributionLayer, UndergroundFeaturesLayer
from .layers.flora import FloraGenerationLayer, AquaticFloraLayer
from .layers.sites import SiteGenerationLayer
from .layers.roads import RoadGenerationLayer, TrailLayer


class WorldGenerator:
    """Main world generator that coordinates all generation systems."""
    
    def __init__(self, world_seed: str):
        self.world_seed = WorldSeed(world_seed)
        self.regions = {}  # region_x,region_z -> RegionRecord
        
        # Initialize generation layers
        self.height_layer = BaseHeightLayer(self.world_seed)
        self.slope_layer = SlopeLayer(self.world_seed)
        self.climate_layer = ClimateLayer(self.world_seed)
        self.biome_layer = BiomeLayer(self.world_seed)
        
        # Surface and resource layers
        self.surface_layer = SurfaceMaterialLayer(self.world_seed)
        self.soil_layer = SoilCompositionLayer(self.world_seed)
        self.resource_layer = ResourceDistributionLayer(self.world_seed)
        self.underground_layer = UndergroundFeaturesLayer(self.world_seed)
        
        # Flora layers
        self.flora_layer = FloraGenerationLayer(self.world_seed)
        self.aquatic_flora_layer = AquaticFloraLayer(self.world_seed)
        
        # Site and road layers
        self.site_layer = SiteGenerationLayer(self.world_seed)
        self.road_layer = RoadGenerationLayer(self.world_seed)
        self.trail_layer = TrailLayer(self.world_seed)
    
    def generate_chunk(self, chunk_x: int, chunk_z: int) -> ChunkGenerationResult:
        """Generate a complete chunk using all layers."""
        # Validate chunk coordinates
        if not isinstance(chunk_x, int) or not isinstance(chunk_z, int):
            raise TypeError(f"Chunk coordinates must be integers: ({chunk_x}, {chunk_z})")
        
        # Calculate region coordinates
        region_x = WorldCoords.chunk_to_region(chunk_x)
        region_z = WorldCoords.chunk_to_region(chunk_z)
        
        # Ensure region exists
        self._ensure_region(region_x, region_z)
        region = self.regions[(region_x, region_z)]
        
        # Create context
        context = ChunkContext(
            world_seed=self.world_seed.base_seed,
            chunk_x=chunk_x,
            chunk_z=chunk_z,
            region_x=region_x,
            region_z=region_z,
            climate=None,  # Will be filled by climate layer
            biome=None,    # Will be filled by biome layer
            nearby_sites=region.sites,
            faction_influence=region.faction_control
        )
        
        # Create result container
        chunk_size = 16
        chunk_height = 64
        result = ChunkGenerationResult(
            blocks=[0] * (chunk_size * chunk_size * chunk_height),
            metadata={},
            spawn_markers=[],
            props=[],
            npc_habitats=[],
            resource_nodes=[]
        )
        
        # Apply layers in order
        # First generate climate
        self.climate_layer.apply(context, result)
        
        # Then terrain using climate
        self.height_layer.apply(context, result)
        self.slope_layer.apply(context, result)
        
        # Then biomes based on climate and terrain
        self.biome_layer.apply(context, result)
        
        # Surface materials based on biome
        self.surface_layer.apply(context, result)
        self.soil_layer.apply(context, result)
        
        # Underground features
        self.underground_layer.apply(context, result)
        
        # Resources (ores, surface resources)
        self.resource_layer.apply(context, result)
        
        # Flora (trees, plants)
        self.flora_layer.apply(context, result)
        self.aquatic_flora_layer.apply(context, result)
        
        # Sites and structures
        self.site_layer.apply(context, result)
        
        # Roads and trails
        self.road_layer.apply(context, result)
        self.trail_layer.apply(context, result)
        
        return result
    
    def _ensure_region(self, region_x: int, region_z: int):
        """Ensure region data exists for the given coordinates."""
        key = (region_x, region_z)
        if key not in self.regions:
            self.regions[key] = self._generate_region(region_x, region_z)
    
    def _generate_region(self, region_x: int, region_z: int) -> RegionRecord:
        """Generate region-level data."""
        # TODO: Implement proper region generation
        # For now, create a basic region
        
        return RegionRecord(
            region_x=region_x,
            region_z=region_z,
            world_seed=self.world_seed.base_seed,
            base_biome=None,  # Will be determined by climate
            elevation_bias=0.0,
            rainfall=0.5,
            temperature=0.5,
            forest_density=0.5,
            fertility=0.5,
            danger_level=0.3,
            settlement_suitability=0.5,
            water_access=False,
            sites=[],
            dominant_faction=None,
            faction_control={}
        )
    
    def get_region(self, region_x: int, region_z: int) -> Optional[RegionRecord]:
        """Get region data if it exists."""
        return self.regions.get((region_x, region_z))
    
    def save_region(self, region: RegionRecord):
        """Save region data (for persistence)."""
        self.regions[(region.region_x, region.region_z)] = region
        # TODO: Save to database


class ChunkGenerator:
    """Specialized generator for individual chunks."""
    
    def __init__(self, world_generator: WorldGenerator):
        self.world_generator = world_generator
    
    def generate_chunk_data(self, chunk_x: int, chunk_z: int) -> List[int]:
        """Generate just the block data for a chunk."""
        result = self.world_generator.generate_chunk(chunk_x, chunk_z)
        return result.blocks
    
    def generate_chunk_full(self, chunk_x: int, chunk_z: int) -> ChunkGenerationResult:
        """Generate full chunk data including metadata."""
        return self.world_generator.generate_chunk(chunk_x, chunk_z)


class RegionGenerator:
    """Generates region-level data and sites."""
    
    def __init__(self, world_generator: WorldGenerator):
        self.world_generator = world_generator
        self.region_seed = world_generator.world_seed.get_layer_seed("region")
    
    def generate_region_data(self, region_x: int, region_z: int) -> RegionRecord:
        """Generate complete region data."""
        # Get region bounds
        bounds = WorldCoords.get_region_bounds(region_x, region_z)
        min_x, min_z, max_x, max_z = bounds
        
        # Sample climate at region center
        center_x = (min_x + max_x) // 2
        center_z = (min_z + max_z) // 2
        
        # TODO: Generate proper region characteristics
        # For now, create basic region
        
        region = RegionRecord(
            region_x=region_x,
            region_z=region_z,
            world_seed=self.world_generator.world_seed.base_seed,
            base_biome=None,
            elevation_bias=0.0,
            rainfall=0.5,
            temperature=0.5,
            forest_density=0.5,
            fertility=0.5,
            danger_level=0.3,
            settlement_suitability=0.5,
            water_access=self._has_water_access(center_x, center_z),
            sites=[],
            dominant_faction=None,
            faction_control={}
        )
        
        # Generate sites for this region
        self._generate_sites(region)
        
        return region
    
    def _has_water_access(self, x: int, z: int) -> bool:
        """Check if region has water access."""
        # TODO: Check actual water bodies
        # For now, use noise to determine
        from .noise import NoiseGenerator
        noise = NoiseGenerator(self.region_seed)
        return noise.noise_2d(x * 0.001, z * 0.001) > 0.3
    
    def _generate_sites(self, region: RegionRecord):
        """Generate sites for a region."""
        # TODO: Implement site generation
        # For now, no sites
        pass
