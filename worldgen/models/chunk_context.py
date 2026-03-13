"""
Data models for world generation context and results.
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum


class BiomeType(Enum):
    """Biome types based on ecological conditions."""
    OCEAN = "ocean"
    BEACH = "beach"
    PLAINS = "plains"
    FOREST = "forest"
    CONIFER_FOREST = "conifer_forest"
    RAINFOREST = "rainforest"
    SAVANNA = "savanna"
    DESERT = "desert"
    TUNDRA = "tundra"
    ALPINE = "alpine"
    MARSH = "marsh"
    RIVER = "river"
    LAKE = "lake"


class SiteType(Enum):
    """Types of sites that can be generated."""
    VILLAGE = "village"
    HAMLET = "hamlet"
    TOWN = "town"
    FORT = "fort"
    CASTLE = "castle"
    MONASTERY = "monastery"
    MINE = "mine"
    LUMBER_CAMP = "lumber_camp"
    RUINS = "ruins"
    LAIR = "lair"
    SHRINE = "shrine"
    CARAVAN_CAMP = "caravan_camp"


@dataclass
class ClimateSample:
    """Climate data for a location."""
    temperature: float  # 0.0 (cold) to 1.0 (hot)
    humidity: float     # 0.0 (dry) to 1.0 (wet)
    drainage: float     # 0.0 (poor) to 1.0 (excellent)
    elevation: float    # 0.0 (sea level) to 1.0 (mountain peak)


@dataclass
class BiomeSample:
    """Biome data for a location."""
    primary_biome: BiomeType
    secondary_biome: Optional[BiomeType] = None
    blend_factor: float = 0.0  # 0.0 = pure primary, 1.0 = pure secondary
    fertility: float = 0.5     # 0.0 (barren) to 1.0 (fertile)
    density: float = 0.5       # 0.0 (sparse) to 1.0 (dense)


@dataclass
class ChunkContext:
    """Context data for chunk generation."""
    world_seed: str
    chunk_x: int
    chunk_z: int
    region_x: int
    region_z: int
    
    # Climate data (sampled or interpolated)
    climate: ClimateSample
    
    # Biome data
    biome: BiomeSample
    
    # Nearby sites (from region data)
    nearby_sites: List['SiteRecord'] = None
    
    # Faction influence (0.0 to 1.0 for each faction)
    faction_influence: Dict[str, float] = None
    
    # Generation parameters
    chunk_size: int = 16
    chunk_height: int = 64
    
    def __post_init__(self):
        if self.nearby_sites is None:
            self.nearby_sites = []
        if self.faction_influence is None:
            self.faction_influence = {}


@dataclass
class ChunkGenerationResult:
    """Results from chunk generation."""
    # Block data (flat array: x + z * chunk_size + y * chunk_size * chunk_size)
    blocks: List[int]
    
    # Metadata for various systems
    metadata: Dict[str, Any]
    
    # Spawn markers for entities
    spawn_markers: List[Dict[str, Any]]
    
    # Props (decorations)
    props: List[Dict[str, Any]]
    
    # NPC habitat information
    npc_habitats: List[Dict[str, Any]]
    
    # Resource locations
    resource_nodes: List[Dict[str, Any]]


@dataclass
class RegionRecord:
    """Data for a region (multiple chunks)."""
    region_x: int
    region_z: int
    world_seed: str
    
    # Base characteristics
    base_biome: BiomeType
    elevation_bias: float    # -1.0 (low) to 1.0 (high)
    rainfall: float          # 0.0 (dry) to 1.0 (wet)
    temperature: float       # 0.0 (cold) to 1.0 (hot)
    
    # Ecological factors
    forest_density: float    # 0.0 to 1.0
    fertility: float         # 0.0 to 1.0
    danger_level: float      # 0.0 to 1.0
    
    # Settlement potential
    settlement_suitability: float  # 0.0 to 1.0
    water_access: bool            # Has major water source
    
    # Sites in this region
    sites: List['SiteRecord']
    
    # Faction control
    dominant_faction: Optional[str] = None
    faction_control: Dict[str, float] = None
    
    def __post_init__(self):
        if self.sites is None:
            self.sites = []
        if self.faction_control is None:
            self.faction_control = {}


@dataclass
class SiteRecord:
    """Record of a generated site."""
    site_id: str
    site_type: SiteType
    world_seed: str
    
    # Location
    x: int
    y: int
    z: int
    region_x: int
    region_z: int
    
    # Site characteristics
    faction: Optional[str] = None
    prosperity: float = 0.5        # 0.0 (ruined) to 1.0 (thriving)
    security: float = 0.5          # 0.0 (lawless) to 1.0 (secure)
    population_estimate: int = 50
    
    # Economic data
    economy_tags: List[str] = None
    trade_links: List[str] = None
    
    # Social data
    pressures: List[str] = None     # Current problems/threats
    population_roles: List[str] = None
    
    # Generation data
    radius: int = 32                # Influence radius in blocks
    structures: List[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.economy_tags is None:
            self.economy_tags = []
        if self.trade_links is None:
            self.trade_links = []
        if self.pressures is None:
            self.pressures = []
        if self.population_roles is None:
            self.population_roles = []
        if self.structures is None:
            self.structures = []


@dataclass
class SpawnRule:
    """Rule for spawning entities."""
    rule_id: str
    entity_type: str
    
    # Habitat requirements
    required_biomes: List[BiomeType]
    preferred_biomes: List[BiomeType]
    avoided_biomes: List[BiomeType]
    
    # Location preferences
    prefers_near: List[str] = None    # e.g., ["grass", "water", "forest"]
    avoids_near: List[str] = None     # e.g., ["castle", "lair"]
    
    # Time factors
    time_weights: Dict[str, float] = None  # e.g., {"day": 1.0, "night": 0.2}
    
    # Spawn parameters
    group_size: Tuple[int, int] = (1, 1)   # min, max
    rarity: float = 0.5                     # 0.0 to 1.0
    spawn_distance: float = 2.0             # Minimum distance from player
    
    # Environmental factors
    min_elevation: float = 0.0
    max_elevation: float = 1.0
    min_moisture: float = 0.0
    max_moisture: float = 1.0
    
    # Social factors
    faction_requirements: Dict[str, float] = None
    danger_level: Tuple[float, float] = (0.0, 1.0)
    
    def __post_init__(self):
        if self.prefers_near is None:
            self.prefers_near = []
        if self.avoids_near is None:
            self.avoids_near = []
        if self.time_weights is None:
            self.time_weights = {"day": 1.0, "night": 1.0}
        if self.faction_requirements is None:
            self.faction_requirements = {}


@dataclass
class BiomeDef:
    """Definition of a biome's properties."""
    biome_type: BiomeType
    
    # Climate requirements
    temp_range: Tuple[float, float]
    humidity_range: Tuple[float, float]
    elevation_range: Tuple[float, float]
    
    # Visual properties
    surface_block: int
    sub_surface_block: int
    decorative_blocks: List[int]
    
    # Ecological properties
    fertility: float
    density: float
    water_sources: List[str]
    
    # Resources
    common_resources: List[str]
    rare_resources: List[str]
    
    # Wildlife
    common_fauna: List[str]
    rare_fauna: List[str]
    
    # Transitions to other biomes
    transitions: Dict[BiomeType, float] = None  # biome -> blend factor
    
    def __post_init__(self):
        if self.transitions is None:
            self.transitions = {}
