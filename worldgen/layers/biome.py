"""
Biome generation layer.
Determines biomes based on climate parameters.
"""

import math
from typing import Dict, Any, List, Tuple
from ..noise import NoiseGenerator
from ..coords import WorldSeed
from ..models.chunk_context import ChunkContext, ChunkGenerationResult, BiomeSample, BiomeType, BiomeDef


class BiomeLayer:
    """Generates biomes from climate data."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("biome")
        self.noise = NoiseGenerator(self.seed)
        
        # Define biome rules
        self.biome_rules = self._create_biome_rules()
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate biome data from climate."""
        chunk_size = context.chunk_size
        climate_map = result.metadata.get('climate_map')
        
        if not climate_map:
            return
        
        # Generate biome map
        biome_map = []
        for x in range(chunk_size):
            biome_row = []
            for z in range(chunk_size):
                climate = climate_map[x][z]
                biome = self._determine_biome(climate, x, z)
                biome_row.append(biome)
            biome_map.append(biome_row)
        
        # Apply biome blending for smooth transitions
        biome_map = self._blend_biomes(biome_map)
        
        # Store biome data
        result.metadata['biome_map'] = biome_map
        
        # Update context with primary biome
        context.biome = self._get_dominant_biome(biome_map)
    
    def _create_biome_rules(self) -> Dict[BiomeType, BiomeDef]:
        """Create biome definitions with climate requirements."""
        rules = {}
        
        # Ocean
        rules[BiomeType.OCEAN] = BiomeDef(
            biome_type=BiomeType.OCEAN,
            temp_range=(0.0, 1.0),
            humidity_range=(0.5, 1.0),
            elevation_range=(0.0, 0.3),
            surface_block=6,  # WATER
            sub_surface_block=7,  # SAND
            decorative_blocks=[7],  # SAND
            fertility=0.0,
            density=0.0,
            water_sources=["ocean"],
            common_resources=["fish", "seaweed"],
            rare_resources=["pearl", "coral"],
            common_fauna=["fish", "dolphin"],
            rare_fauna=["shark", "whale"]
        )
        
        # Beach
        rules[BiomeType.BEACH] = BiomeDef(
            biome_type=BiomeType.BEACH,
            temp_range=(0.2, 0.9),
            humidity_range=(0.3, 0.8),
            elevation_range=(0.28, 0.35),
            surface_block=7,  # SAND
            sub_surface_block=7,  # SAND
            decorative_blocks=[7],  # SAND
            fertility=0.2,
            density=0.1,
            water_sources=["ocean"],
            common_resources=["sand", "shell"],
            rare_resources=["amber", "crab"],
            common_fauna=["crab", "seagull"],
            rare_fauna=["turtle"]
        )
        
        # Plains
        rules[BiomeType.PLAINS] = BiomeDef(
            biome_type=BiomeType.PLAINS,
            temp_range=(0.3, 0.8),
            humidity_range=(0.2, 0.7),
            elevation_range=(0.35, 0.55),
            surface_block=1,  # GRASS
            sub_surface_block=2,  # DIRT
            decorative_blocks=[18, 19],  # Flowers
            fertility=0.7,
            density=0.6,
            water_sources=["river", "lake"],
            common_resources=["wheat", "grass", "wild_herbs"],
            rare_resources=["deer_antler", "honey"],
            common_fauna=["deer", "rabbit", "cow"],
            rare_fauna=["horse", "bison"]
        )
        
        # Forest
        rules[BiomeType.FOREST] = BiomeDef(
            biome_type=BiomeType.FOREST,
            temp_range=(0.4, 0.7),
            humidity_range=(0.5, 0.8),
            elevation_range=(0.35, 0.6),
            surface_block=1,  # GRASS
            sub_surface_block=2,  # DIRT
            decorative_blocks=[5],  # LEAVES
            fertility=0.6,
            density=0.9,
            water_sources=["river", "lake"],
            common_resources=["wood", "berries", "mushrooms"],
            rare_resources=["rare_herbs", "bee_hive"],
            common_fauna=["deer", "wolf", "bird"],
            rare_fauna=["bear", "owl"]
        )
        
        # Conifer Forest
        rules[BiomeType.CONIFER_FOREST] = BiomeDef(
            biome_type=BiomeType.CONIFER_FOREST,
            temp_range=(0.1, 0.5),
            humidity_range=(0.3, 0.7),
            elevation_range=(0.4, 0.7),
            surface_block=1,  # GRASS
            sub_surface_block=2,  # DIRT
            decorative_blocks=[5],  # LEAVES
            fertility=0.4,
            density=0.8,
            water_sources=["river", "lake"],
            common_resources=["pine_wood", "pine_cone", "resin"],
            rare_resources=["rare_fur", "pine_nuts"],
            common_fauna=["moose", "wolf", "squirrel"],
            rare_fauna=["lynx", "wolverine"]
        )
        
        # Desert
        rules[BiomeType.DESERT] = BiomeDef(
            biome_type=BiomeType.DESERT,
            temp_range=(0.6, 1.0),
            humidity_range=(0.0, 0.3),
            elevation_range=(0.3, 0.6),
            surface_block=7,  # SAND
            sub_surface_block=7,  # SAND
            decorative_blocks=[7],  # SAND
            fertility=0.1,
            density=0.1,
            water_sources=["oasis"],
            common_resources=["sand", "cactus"],
            rare_resources=["desert_rose", "scorpion_venom"],
            common_fauna=["scorpion", "lizard"],
            rare_fauna=["camel", "vulture"]
        )
        
        # Tundra
        rules[BiomeType.TUNDRA] = BiomeDef(
            biome_type=BiomeType.TUNDRA,
            temp_range=(0.0, 0.3),
            humidity_range=(0.2, 0.6),
            elevation_range=(0.35, 0.5),
            surface_block=3,  # STONE (would be snow)
            sub_surface_block=2,  # DIRT
            decorative_blocks=[3],  # STONE
            fertility=0.2,
            density=0.2,
            water_sources=["frozen_lake"],
            common_resources=["ice", "lichen"],
            rare_resources=["mammoth_tusk", "frost_herb"],
            common_fauna=["seal", "arctic_fox"],
            rare_fauna=["polar_bear", "mammoth"]
        )
        
        # Alpine
        rules[BiomeType.ALPINE] = BiomeDef(
            biome_type=BiomeType.ALPINE,
            temp_range=(0.0, 0.4),
            humidity_range=(0.1, 0.5),
            elevation_range=(0.6, 1.0),
            surface_block=3,  # STONE
            sub_surface_block=3,  # STONE
            decorative_blocks=[3],  # STONE
            fertility=0.1,
            density=0.1,
            water_sources=["mountain_stream"],
            common_resources=["stone", "iron_ore"],
            rare_resources=["diamond", "eagle_feather"],
            common_fauna=["mountain_goat", "eagle"],
            rare_fauna=["griffin", "yeti"]
        )
        
        # Marsh
        rules[BiomeType.MARSH] = BiomeDef(
            biome_type=BiomeType.MARSH,
            temp_range=(0.3, 0.8),
            humidity_range=(0.7, 1.0),
            elevation_range=(0.25, 0.4),
            surface_block=2,  # DIRT
            sub_surface_block=2,  # DIRT
            decorative_blocks=[2],  # DIRT
            fertility=0.5,
            density=0.7,
            water_sources=["shallow_water"],
            common_resources=["reeds", "peat", "frog"],
            rare_resources=["rare_herb", "snake_skin"],
            common_fauna=["frog", "snake", "dragonfly"],
            rare_fauna=["alligator", "will_o_wisp"]
        )
        
        # Add transitions
        self._add_biome_transitions(rules)
        
        return rules
    
    def _add_biome_transitions(self, rules: Dict[BiomeType, BiomeDef]):
        """Add transition rules between biomes."""
        # Beach transitions
        rules[BiomeType.BEACH].transitions[BiomeType.OCEAN] = 0.5
        rules[BiomeType.BEACH].transitions[BiomeType.PLAINS] = 0.3
        
        # Forest transitions
        rules[BiomeType.FOREST].transitions[BiomeType.PLAINS] = 0.4
        rules[BiomeType.FOREST].transitions[BiomeType.CONIFER_FOREST] = 0.3
        rules[BiomeType.FOREST].transitions[BiomeType.RAINFOREST] = 0.3
        
        # Desert transitions
        rules[BiomeType.DESERT].transitions[BiomeType.PLAINS] = 0.4
        rules[BiomeType.DESERT].transitions[BiomeType.SAVANNA] = 0.3
        
        # Tundra transitions
        rules[BiomeType.TUNDRA].transitions[BiomeType.CONIFER_FOREST] = 0.4
        rules[BiomeType.TUNDRA].transitions[BiomeType.ALPINE] = 0.3
    
    def _determine_biome(self, climate, x: int, z: int) -> BiomeSample:
        """Determine biome from climate parameters."""
        # Add slight noise for variation
        temp_variation = self.noise.noise_2d(x * 0.1, z * 0.1) * 0.1
        humidity_variation = self.noise.noise_2d(x * 0.1 + 100, z * 0.1 + 100) * 0.1
        
        adjusted_temp = max(0, min(1, climate.temperature + temp_variation))
        adjusted_humidity = max(0, min(1, climate.humidity + humidity_variation))
        
        # Check each biome's requirements
        candidates = []
        
        for biome_type, biome_def in self.biome_rules.items():
            if (biome_def.temp_range[0] <= adjusted_temp <= biome_def.temp_range[1] and
                biome_def.humidity_range[0] <= adjusted_humidity <= biome_def.humidity_range[1] and
                biome_def.elevation_range[0] <= climate.elevation <= biome_def.elevation_range[1]):
                
                # Calculate how well this biome matches
                temp_match = 1.0 - abs(adjusted_temp - sum(biome_def.temp_range) / 2)
                humidity_match = 1.0 - abs(adjusted_humidity - sum(biome_def.humidity_range) / 2)
                elevation_match = 1.0 - abs(climate.elevation - sum(biome_def.elevation_range) / 2)
                
                score = (temp_match + humidity_match + elevation_match) / 3
                candidates.append((score, biome_type, biome_def))
        
        # Sort by score and pick the best
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            best_score, best_type, best_def = candidates[0]
            
            # Check for secondary biome (blending)
            secondary_biome = None
            blend_factor = 0.0
            
            if len(candidates) > 1:
                second_score, second_type, _ = candidates[1]
                if best_score - second_score < 0.2:  # Close match
                    secondary_biome = second_type
                    blend_factor = (best_score - second_score) * 5  # 0 to 1
            
            return BiomeSample(
                primary_biome=best_type,
                secondary_biome=secondary_biome,
                blend_factor=blend_factor,
                fertility=best_def.fertility,
                density=best_def.density
            )
        
        # Default to plains if nothing matches
        return BiomeSample(
            primary_biome=BiomeType.PLAINS,
            fertility=0.5,
            density=0.5
        )
    
    def _blend_biomes(self, biome_map: List[List[BiomeSample]]) -> List[List[BiomeSample]]:
        """Apply smoothing to biome transitions."""
        chunk_size = len(biome_map)
        blended_map = []
        
        for x in range(chunk_size):
            blended_row = []
            for z in range(chunk_size):
                current = biome_map[x][z]
                
                # Count neighboring biomes
                neighbors = {}
                for dx in [-1, 0, 1]:
                    for dz in [-1, 0, 1]:
                        if dx == 0 and dz == 0:
                            continue
                        nx, nz = x + dx, z + dz
                        if 0 <= nx < chunk_size and 0 <= nz < chunk_size:
                            neighbor = biome_map[nx][nz]
                            biome = neighbor.primary_biome
                            neighbors[biome] = neighbors.get(biome, 0) + 1
                
                # If surrounded by different biome, increase blend
                if neighbors:
                    most_common = max(neighbors.values())
                    if most_common >= 6:  # Mostly surrounded
                        if current.secondary_biome is None:
                            # Pick most common neighbor as secondary
                            secondary = max(neighbors, key=neighbors.get)
                            if secondary != current.primary_biome:
                                current.secondary_biome = secondary
                                current.blend_factor = 0.3
                
                blended_row.append(current)
            blended_map.append(blended_row)
        
        return blended_map
    
    def _get_dominant_biome(self, biome_map: List[List[BiomeSample]]) -> BiomeSample:
        """Get the dominant biome in the chunk."""
        biome_counts = {}
        fertility_sum = 0
        density_sum = 0
        total = 0
        
        for row in biome_map:
            for biome in row:
                key = biome.primary_biome
                biome_counts[key] = biome_counts.get(key, 0) + 1
                fertility_sum += biome.fertility
                density_sum += biome.density
                total += 1
        
        # Find most common biome
        dominant = max(biome_counts, key=biome_counts.get)
        
        return BiomeSample(
            primary_biome=dominant,
            fertility=fertility_sum / total,
            density=density_sum / total
        )
