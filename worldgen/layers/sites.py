"""
Site generation layer.
Generates villages, ruins, lairs, and other points of interest.
"""

import math
import random
from typing import Dict, Any, List, Tuple
from ..noise import NoiseGenerator
from ..coords import WorldSeed
from ..models.chunk_context import ChunkContext, ChunkGenerationResult, RegionRecord, SiteRecord, SiteType, BiomeType
from ..placement.prefab_library import PrefabLibrary
from ..placement.room_assembler import RoomAssembler


class SiteGenerationLayer:
    """Generates sites and structures in the world."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("sites")
        self.noise = NoiseGenerator(self.seed)
        self.site_noise = NoiseGenerator(self.seed + 1000)
        self.prefab_library = PrefabLibrary()
        self.room_assembler = RoomAssembler(self.prefab_library)
        
        # Site requirements by type
        self.site_requirements = {
            SiteType.VILLAGE: {
                'min_biome_suitability': 0.6,
                'preferred_biomes': [BiomeType.PLAINS, BiomeType.FOREST, BiomeType.SAVANNA],
                'avoid_biomes': [BiomeType.DESERT, BiomeType.TUNDRA, BiomeType.MARSH],
                'min_distance': 50,  # From other villages
                'size_range': (20, 40),
                'population_range': (50, 200)
            },
            SiteType.HAMLET: {
                'min_biome_suitability': 0.4,
                'preferred_biomes': [BiomeType.PLAINS, BiomeType.FOREST, BiomeType.CONIFER_FOREST],
                'avoid_biomes': [BiomeType.DESERT, BiomeType.OCEAN],
                'min_distance': 30,
                'size_range': (10, 20),
                'population_range': (10, 50)
            },
            SiteType.RUINS: {
                'min_biome_suitability': 0.2,
                'preferred_biomes': 'all',  # Can appear anywhere
                'avoid_biomes': [BiomeType.OCEAN],
                'min_distance': 40,
                'size_range': (15, 35),
                'population_range': (0, 0)  # Uninhabited
            },
            SiteType.FORT: {
                'min_biome_suitability': 0.3,
                'preferred_biomes': [BiomeType.PLAINS, BiomeType.ALPINE, BiomeType.TUNDRA],
                'avoid_biomes': [BiomeType.MARSH, BiomeType.DESERT],
                'min_distance': 60,
                'size_range': (25, 45),
                'population_range': (20, 100)
            },
            SiteType.LAIR: {
                'min_biome_suitability': 0.1,
                'preferred_biomes': [BiomeType.FOREST, BiomeType.MARSH, BiomeType.ALPINE, BiomeType.DESERT],
                'avoid_biomes': [BiomeType.PLAINS, BiomeType.OCEAN],
                'min_distance': 30,
                'size_range': (10, 25),
                'population_range': (0, 0)  # Monster lairs
            },
            SiteType.MINE: {
                'min_biome_suitability': 0.3,
                'preferred_biomes': [BiomeType.ALPINE, BiomeType.FOREST, BiomeType.PLAINS],
                'avoid_biomes': [BiomeType.OCEAN, BiomeType.MARSH],
                'min_distance': 40,
                'size_range': (15, 30),
                'population_range': (5, 30)
            },
            SiteType.MONASTERY: {
                'min_biome_suitability': 0.4,
                'preferred_biomes': [BiomeType.ALPINE, BiomeType.FOREST, BiomeType.PLAINS],
                'avoid_biomes': [BiomeType.DESERT, BiomeType.MARSH],
                'min_distance': 50,
                'size_range': (20, 35),
                'population_range': (10, 50)
            }
        }
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Apply site generation to the chunk."""
        # Check if this chunk should contain a site
        site = self._determine_site_for_chunk(context)
        
        if site:
            # Generate the site
            self._generate_site(context, result, site)
            
            # Add to metadata
            result.metadata['site'] = site
    
    def _determine_site_for_chunk(self, context: ChunkContext) -> SiteRecord:
        """Determine if a site should be placed in this chunk."""
        # Guarantee a starter settlement at origin for predictable new-player spawn.
        if context.chunk_x == 0 and context.chunk_z == 0:
            site_type = SiteType.VILLAGE
            return SiteRecord(
                site_id=f"{site_type.value}_starter_0_0",
                site_type=site_type,
                world_seed=context.world_seed,
                x=8,
                y=0,
                z=8,
                region_x=context.region_x,
                region_z=context.region_z,
                faction=self._determine_faction(site_type, context),
                prosperity=0.7,
                security=0.7,
                population_estimate=120,
                economy_tags=self._generate_economy_tags(site_type),
                trade_links=[],
                pressures=[],
                population_roles=self._generate_population_roles(site_type),
                radius=30,
            )

        # Use region-level site data
        region_key = (context.region_x, context.region_z)
        
        # This would be pre-calculated at region level
        # For now, use simple noise-based determination
        site_noise = self.site_noise.fractal_noise_2d(
            context.chunk_x * 0.1, context.chunk_z * 0.1,
            octaves=2, persistence=0.7
        )
        
        # Check if this chunk should have a site
        if site_noise > 0.45:  # ~15% chance based on noise distribution
            # Determine site type based on biome
            biome = context.biome.primary_biome
            
            # Weighted selection of site types
            possible_sites = self._get_possible_sites_for_biome(biome)
            
            if possible_sites:
                site_type = random.choice(possible_sites)
                
                # Create site record
                site_id = f"{site_type.value}_{context.chunk_x}_{context.chunk_z}"
                
                return SiteRecord(
                    site_id=site_id,
                    site_type=site_type,
                    world_seed=context.world_seed,
                    x=context.chunk_x * 16 + 8,  # Center of chunk
                    y=0,  # Will be set based on terrain
                    z=context.chunk_z * 16 + 8,
                    region_x=context.region_x,
                    region_z=context.region_z,
                    faction=self._determine_faction(site_type, context),
                    prosperity=random.uniform(0.3, 0.8),
                    security=random.uniform(0.2, 0.9),
                    population_estimate=random.randint(
                        *self.site_requirements[site_type]['population_range']
                    ),
                    economy_tags=self._generate_economy_tags(site_type),
                    trade_links=[],
                    pressures=self._generate_pressures(site_type),
                    population_roles=self._generate_population_roles(site_type),
                    radius=random.randint(*self.site_requirements[site_type]['size_range'])
                )
        
        return None
    
    def _get_possible_sites_for_biome(self, biome: BiomeType) -> List[SiteType]:
        """Get possible site types for a biome."""
        biome_sites = {
            BiomeType.PLAINS: [SiteType.VILLAGE, SiteType.HAMLET, SiteType.FORT, SiteType.RUINS],
            BiomeType.FOREST: [SiteType.HAMLET, SiteType.RUINS, SiteType.LAIR, SiteType.MONASTERY],
            BiomeType.CONIFER_FOREST: [SiteType.HAMLET, SiteType.LAIR, SiteType.MONASTERY],
            BiomeType.DESERT: [SiteType.RUINS, SiteType.LAIR, SiteType.MINE],
            BiomeType.TUNDRA: [SiteType.HAMLET, SiteType.FORT, SiteType.RUINS],
            BiomeType.ALPINE: [SiteType.FORT, SiteType.MONASTERY, SiteType.MINE, SiteType.RUINS],
            BiomeType.MARSH: [SiteType.RUINS, SiteType.LAIR],
            BiomeType.SAVANNA: [SiteType.VILLAGE, SiteType.HAMLET, SiteType.RUINS],
        }
        
        return biome_sites.get(biome, [SiteType.RUINS])
    
    def _determine_faction(self, site_type: SiteType, context) -> str:
        """Determine the faction controlling a site."""
        # Simple faction assignment based on site type and location
        factions = ['river_union', 'mountain_clans', 'forest_folk', 'desert_nomads', 'north_kingdom']
        
        # Use deterministic selection
        faction_noise = self.noise.noise_2d(context.chunk_x * 0.5, context.chunk_z * 0.5)
        faction_index = int(abs(faction_noise) * len(factions))
        
        return factions[faction_index]
    
    def _generate_economy_tags(self, site_type: SiteType) -> List[str]:
        """Generate economy tags for a site."""
        economy_map = {
            SiteType.VILLAGE: ['farming', 'trade', 'crafting'],
            SiteType.HAMLET: ['farming', 'hunting', 'gathering'],
            SiteType.FORT: ['military', 'trade', 'mining'],
            SiteType.MINE: ['mining', 'smelting'],
            SiteType.MONASTERY: ['religious', 'scribes', 'herbs'],
            SiteType.RUINS: ['salvage', 'exploration'],
            SiteType.LAIR: ['danger', 'monster_parts'],
        }
        
        return economy_map.get(site_type, [])
    
    def _generate_pressures(self, site_type: SiteType) -> List[str]:
        """Generate current problems/threats."""
        all_pressures = ['monster_raids', 'bandit_activity', 'disease', 'food_shortage', 
                        'political_tension', 'trade_disruption', 'mysterious_disappearances']
        
        # Ruins and lairs have different pressures
        if site_type == SiteType.RUINS:
            return ['cursed', 'haunted', 'structurally_unsound']
        elif site_type == SiteType.LAIR:
            return ['monster_territory', 'dangerous']
        
        # Other sites get 1-2 random pressures
        num_pressures = random.randint(0, 2)
        return random.sample(all_pressures, num_pressures)
    
    def _generate_population_roles(self, site_type: SiteType) -> List[str]:
        """Generate population roles for a site."""
        role_map = {
            SiteType.VILLAGE: ['farmers', 'merchant', 'blacksmith', 'elder', 'guard'],
            SiteType.HAMLET: ['farmers', 'hunter', 'healer', 'elder'],
            SiteType.FORT: ['soldier', 'commander', 'blacksmith', 'merchant'],
            SiteType.MINE: ['miner', 'foreman', 'merchant', 'guard'],
            SiteType.MONASTERY: ['monk', 'scribe', 'herbalist', 'abbot'],
            SiteType.RUINS: [],
            SiteType.LAIR: [],
        }
        
        return role_map.get(site_type, [])
    
    def _generate_site(self, context: ChunkContext, result: ChunkGenerationResult, site: SiteRecord):
        """Generate the actual site structures."""
        # Get terrain height at site location
        heightmap = result.metadata.get('heightmap')
        if not heightmap:
            return
        
        # Site is at chunk center
        site_x = 8
        site_z = 8
        site_y = heightmap[site_x][site_z] + 1
        
        # Update site Y position
        site.y = site_y

        if self._generate_from_prefab(context, result, site_x, site_y, site_z, site):
            return
        
        # Generate based on site type
        if site.site_type == SiteType.VILLAGE:
            self._generate_village(site_x, site_y, site_z, site, result)
        elif site.site_type == SiteType.RUINS:
            self._generate_ruins(site_x, site_y, site_z, site, result)
        elif site.site_type == SiteType.FORT:
            self._generate_fort(site_x, site_y, site_z, site, result)
        elif site.site_type == SiteType.LAIR:
            self._generate_lair(site_x, site_y, site_z, site, result)
        else:
            # Simple structure for other types
            self._generate_simple_structure(site_x, site_y, site_z, site, result)

    def _generate_from_prefab(
        self,
        context: ChunkContext,
        result: ChunkGenerationResult,
        x: int,
        y: int,
        z: int,
        site: SiteRecord,
    ) -> bool:
        site_type_name = site.site_type.value
        seed_key = f"{context.world_seed}:{context.chunk_x}:{context.chunk_z}:{site.site_id}:{site_type_name}"
        prefab_id = self.prefab_library.choose_site_prefab_id(site_type_name, seed_key)
        if not prefab_id:
            return False

        schematic = self.prefab_library.get_schematic(prefab_id)
        if not schematic:
            return False

        if not self._place_schematic(result, x, y, z, schematic):
            return False

        site.structures.append({
            'type': 'prefab',
            'prefab_id': prefab_id,
            'site_type': site_type_name,
            'chunk_x': context.chunk_x,
            'chunk_z': context.chunk_z,
        })

        room_assembly = schematic.get('room_assembly')
        if isinstance(room_assembly, dict):
            room_seed_key = f"{seed_key}:room_assembly"
            room_placements = self.room_assembler.assemble(
                result=result,
                anchor_x=x,
                anchor_y=y,
                anchor_z=z,
                room_assembly=room_assembly,
                seed_key=room_seed_key,
                place_schematic=self._place_schematic,
            )
            if room_placements:
                site.structures.append({
                    'type': 'room_assembly',
                    'prefab_id': prefab_id,
                    'rooms': room_placements,
                })

        self._add_site_spawn_marker(site_type_name, x, y, z, site, result, prefab_id)
        return True

    def _place_schematic(self, result: ChunkGenerationResult, x: int, y: int, z: int, schematic: Dict[str, Any]) -> bool:
        origin = schematic.get('origin', [0, 0, 0])
        blocks = schematic.get('blocks', [])

        if not isinstance(origin, list) or len(origin) != 3 or not isinstance(blocks, list):
            return False

        try:
            ox, oy, oz = int(origin[0]), int(origin[1]), int(origin[2])
        except (TypeError, ValueError):
            return False

        base_x = x - ox
        base_y = y - oy
        base_z = z - oz
        chunk_size = 16
        chunk_height = 64
        placed_any = False

        for block in blocks:
            if not isinstance(block, dict):
                continue

            try:
                bx = int(block.get('x', 0))
                by = int(block.get('y', 0))
                bz = int(block.get('z', 0))
                block_id = int(block.get('id', 0))
            except (TypeError, ValueError):
                continue

            world_x = base_x + bx
            world_y = base_y + by
            world_z = base_z + bz

            if not (0 <= world_x < chunk_size and 0 <= world_y < chunk_height and 0 <= world_z < chunk_size):
                continue

            if block_id == 0:
                continue

            block_idx = world_x + world_z * chunk_size + world_y * chunk_size * chunk_size
            result.blocks[block_idx] = block_id
            placed_any = True

        return placed_any

    def _add_site_spawn_marker(
        self,
        site_type: str,
        x: int,
        y: int,
        z: int,
        site: SiteRecord,
        result: ChunkGenerationResult,
        prefab_id: str,
    ):
        if site_type == 'village':
            result.spawn_markers.append({
                'type': 'village',
                'site_id': site.site_id,
                'x': x,
                'y': y,
                'z': z,
                'npc_types': site.population_roles,
                'faction': site.faction,
                'prefab_id': prefab_id,
            })
            return

        if site_type == 'fort':
            result.spawn_markers.append({
                'type': 'fort',
                'site_id': site.site_id,
                'x': x,
                'y': y,
                'z': z,
                'npc_types': site.population_roles,
                'faction': site.faction,
                'prefab_id': prefab_id,
            })
            return

        if site_type == 'ruins':
            loot_tier = self._get_ruins_loot_tier(prefab_id)
            result.spawn_markers.append({
                'type': 'ruins',
                'site_id': site.site_id,
                'x': x,
                'y': y,
                'z': z,
                'loot_tier': loot_tier,
                'monster_type': 'undead',
                'prefab_id': prefab_id,
            })
            return

        if site_type == 'lair':
            result.spawn_markers.append({
                'type': 'lair',
                'site_id': site.site_id,
                'x': x,
                'y': y - 1,
                'z': z,
                'monster_type': self._get_lair_monster_type(site),
                'spawn_count': random.randint(3, 8),
                'prefab_id': prefab_id,
            })
    
    def _generate_village(self, x: int, y: int, z: int, site: SiteRecord, result: ChunkGenerationResult):
        """Generate a village with multiple buildings."""
        chunk_size = 16
        
        # Central well
        well_x, well_z = x, z
        for dy in range(3):
            if y - dy >= 0:
                block_idx = well_x + well_z * chunk_size + (y - dy) * chunk_size * chunk_size
                if dy == 0:
                    result.blocks[block_idx] = 6  # WATER
                else:
                    result.blocks[block_idx] = 3  # STONE
        
        # Generate houses around well
        num_houses = min(5, site.radius // 8)
        for i in range(num_houses):
            angle = (i / num_houses) * 2 * math.pi
            house_x = int(x + math.cos(angle) * 5)
            house_z = int(z + math.sin(angle) * 5)
            
            if 0 <= house_x < chunk_size and 0 <= house_z < chunk_size:
                self._generate_house(house_x, y, house_z, result)
        
        # Add to spawn markers for NPCs
        result.spawn_markers.append({
            'type': 'village',
            'site_id': site.site_id,
            'x': x,
            'y': y,
            'z': z,
            'npc_types': site.population_roles,
            'faction': site.faction
        })
    
    def _generate_house(self, x: int, y: int, z: int, result: ChunkGenerationResult):
        """Generate a simple house."""
        chunk_size = 16
        chunk_height = 64
        
        # Foundation (3x3)
        for dx in range(-1, 2):
            for dz in range(-1, 2):
                for dy in range(2):
                    world_x = x + dx
                    world_y = y + dy
                    world_z = z + dz
                    
                    if (0 <= world_x < chunk_size and 0 <= world_y < chunk_height and 
                        0 <= world_z < chunk_size):
                        block_idx = world_x + world_z * chunk_size + world_y * chunk_size * chunk_size
                        
                        if dy == 0:
                            result.blocks[block_idx] = 30  # COBBLESTONE (foundation)
                        else:
                            result.blocks[block_idx] = 4  # WOOD (walls)
        
        # Roof
        for dx in range(-2, 3):
            for dz in range(-2, 3):
                if abs(dx) + abs(dz) <= 2:
                    world_x = x + dx
                    world_y = y + 2
                    world_z = z + dz
                    
                    if (0 <= world_x < chunk_size and 0 <= world_y < chunk_height and 
                        0 <= world_z < chunk_size):
                        block_idx = world_x + world_z * chunk_size + world_y * chunk_size * chunk_size
                        result.blocks[block_idx] = 21  # PLANKS (roof)
    
    def _generate_ruins(self, x: int, y: int, z: int, site: SiteRecord, result: ChunkGenerationResult):
        """Generate ruined structures."""
        chunk_size = 16
        
        # Crumbled walls
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            wall_x = int(x + math.cos(rad) * 4)
            wall_z = int(z + math.sin(rad) * 4)
            
            if 0 <= wall_x < chunk_size and 0 <= wall_z < chunk_size:
                # Partial walls
                wall_height = random.randint(1, 3)
                for dy in range(wall_height):
                    if y + dy < 64:
                        block_idx = wall_x + wall_z * chunk_size + (y + dy) * chunk_size * chunk_size
                        if random.random() > 0.3:  # Some sections missing
                            result.blocks[block_idx] = 30  # COBBLESTONE
        
        # Add spawn marker for monsters/loot
        result.spawn_markers.append({
            'type': 'ruins',
            'site_id': site.site_id,
            'x': x,
            'y': y,
            'z': z,
            'loot_tier': self._get_ruins_loot_tier('procedural_ruins'),
            'monster_type': 'undead'
        })

    def _get_ruins_loot_tier(self, prefab_id: str) -> str:
        if prefab_id == 'ruins_sinkhole_spire':
            return 'ancient_relic'
        if prefab_id == 'ruins_gatehouse':
            return 'ancient_guarded'
        return 'ancient_common'
    
    def _generate_fort(self, x: int, y: int, z: int, site: SiteRecord, result: ChunkGenerationResult):
        """Generate a fort with walls and towers."""
        chunk_size = 16
        
        # Outer walls (square)
        wall_size = 6
        for dx in range(-wall_size, wall_size + 1):
            for dz in range(-wall_size, wall_size + 1):
                if abs(dx) == wall_size or abs(dz) == wall_size:
                    world_x = x + dx
                    world_z = z + dz
                    
                    if 0 <= world_x < chunk_size and 0 <= world_z < chunk_size:
                        # Wall
                        for wy in range(4):
                            if y + wy < 64:
                                block_idx = world_x + world_z * chunk_size + (y + wy) * chunk_size * chunk_size
                                result.blocks[block_idx] = 30  # COBBLESTONE
        
        # Central keep
        for dx in range(-2, 3):
            for dz in range(-2, 3):
                for dy in range(6):
                    world_x = x + dx
                    world_y = y + dy
                    world_z = z + dz
                    
                    if (0 <= world_x < chunk_size and 0 <= world_y < 64 and 
                        0 <= world_z < chunk_size):
                        block_idx = world_x + world_z * chunk_size + world_y * chunk_size * chunk_size
                        result.blocks[block_idx] = 30  # STONE
        
        # Add spawn markers
        result.spawn_markers.append({
            'type': 'fort',
            'site_id': site.site_id,
            'x': x,
            'y': y,
            'z': z,
            'npc_types': site.population_roles,
            'faction': site.faction
        })
    
    def _generate_lair(self, x: int, y: int, z: int, site: SiteRecord, result: ChunkGenerationResult):
        """Generate a monster lair."""
        chunk_size = 16
        
        # Cave entrance
        for dy in range(3):
            for dx in range(-2, 3):
                for dz in range(-2, 3):
                    world_x = x + dx
                    world_y = y - dy
                    world_z = z + dz
                    
                    if (0 <= world_x < chunk_size and 0 <= world_y < 64 and 
                        0 <= world_z < chunk_size):
                        block_idx = world_x + world_z * chunk_size + world_y * chunk_size * chunk_size
                        
                        if dy == 0 and abs(dx) <= 1 and abs(dz) <= 1:
                            result.blocks[block_idx] = 0  # AIR (entrance)
                        elif dy > 0:
                            result.blocks[block_idx] = 3  # STONE
        
        # Add spawn marker for monsters
        result.spawn_markers.append({
            'type': 'lair',
            'site_id': site.site_id,
            'x': x,
            'y': y - 1,
            'z': z,
            'monster_type': self._get_lair_monster_type(site),
            'spawn_count': random.randint(3, 8)
        })
    
    def _generate_simple_structure(self, x: int, y: int, z: int, site: SiteRecord, result: ChunkGenerationResult):
        """Generate a simple structure for minor sites."""
        chunk_size = 16
        
        # Simple 2x2 structure
        for dx in range(-1, 2):
            for dz in range(-1, 2):
                if abs(dx) <= 1 and abs(dz) <= 1:
                    world_x = x + dx
                    world_z = z + dz
                    
                    if 0 <= world_x < chunk_size and 0 <= world_z < chunk_size:
                        # Foundation
                        block_idx = world_x + world_z * chunk_size + y * chunk_size * chunk_size
                        result.blocks[block_idx] = 30  # COBBLESTONE
                        
                        # Walls
                        if y + 1 < 64:
                            block_idx = world_x + world_z * chunk_size + (y + 1) * chunk_size * chunk_size
                            result.blocks[block_idx] = 4  # WOOD
    
    def _get_lair_monster_type(self, site: SiteRecord) -> str:
        """Get monster type for lair based on biome."""
        # This would be more sophisticated
        monster_types = ['goblins', 'wolves', 'bandits', 'spiders', 'undead']
        return random.choice(monster_types)
