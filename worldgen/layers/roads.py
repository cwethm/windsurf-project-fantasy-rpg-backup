"""
Road generation layer.
Generates roads between settlements and paths through the world.
"""

import math
from typing import Dict, Any, List, Tuple, Optional
from ..noise import NoiseGenerator
from ..coords import WorldSeed
from ..models.chunk_context import ChunkContext, ChunkGenerationResult, SiteRecord, SiteType


class RoadGenerationLayer:
    """Generates roads and paths connecting sites."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("roads")
        self.noise = NoiseGenerator(self.seed)
        
        # Road types and their properties
        self.road_types = {
            'main_road': {
                'width': 3,
                'surface_block': 30,  # COBBLESTONE
                'shoulder_block': 2,  # DIRT
                'priority': 1.0
            },
            'trade_route': {
                'width': 2,
                'surface_block': 2,  # DIRT
                'shoulder_block': 1,  # GRASS
                'priority': 0.7
            },
            'path': {
                'width': 1,
                'surface_block': 2,  # DIRT
                'shoulder_block': 1,  # GRASS
                'priority': 0.5
            }
        }
        
        # Site connection priorities
        self.site_priorities = {
            SiteType.TOWN: 3,
            SiteType.VILLAGE: 2,
            SiteType.FORT: 2,
            SiteType.HAMLET: 1,
            SiteType.MONASTERY: 1,
            SiteType.MINE: 1,
            SiteType.RUINS: 0.5
        }
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate roads in this chunk."""
        # Check for roads passing through this chunk
        roads = self._get_roads_for_chunk(context)
        
        for road in roads:
            self._generate_road(context, result, road)
        
        # Store road data for navigation
        result.metadata['roads'] = roads
    
    def _get_roads_for_chunk(self, context: ChunkContext) -> List[Dict]:
        """Get roads that pass through this chunk."""
        roads = []
        
        # This would be pre-calculated at region level
        # For now, check if this chunk connects nearby sites
        
        # Get nearby sites from context
        nearby_sites = context.nearby_sites
        if len(nearby_sites) < 2:
            return roads
        
        # Find road segments that pass through this chunk
        chunk_bounds = (
            context.chunk_x * 16,
            context.chunk_z * 16,
            (context.chunk_x + 1) * 16,
            (context.chunk_z + 1) * 16
        )
        
        # Check connections between sites
        for i, site1 in enumerate(nearby_sites):
            for site2 in nearby_sites[i+1:]:
                # Check if sites should be connected
                if self._should_connect_sites(site1, site2):
                    # Check if road passes through this chunk
                    road_segment = self._get_road_segment(site1, site2, chunk_bounds)
                    if road_segment:
                        roads.append(road_segment)
        
        return roads
    
    def _should_connect_sites(self, site1: SiteRecord, site2: SiteRecord) -> bool:
        """Determine if two sites should have a road between them."""
        # Calculate distance
        dist = math.sqrt((site1.x - site2.x)**2 + (site1.z - site2.z)**2)
        
        # Maximum road length
        max_road_length = 200
        
        if dist > max_road_length:
            return False
        
        # Check site priorities
        priority1 = self.site_priorities.get(site1.site_type, 0)
        priority2 = self.site_priorities.get(site2.site_type, 0)
        
        # Higher priority sites more likely to have roads
        connection_chance = (priority1 + priority2) / 10.0
        
        # Adjust for distance (closer sites more likely)
        distance_factor = 1.0 - (dist / max_road_length)
        connection_chance *= distance_factor
        
        # Use deterministic random
        noise_val = self.noise.noise_2d(
            (site1.x + site2.x) * 0.01,
            (site1.z + site2.z) * 0.01
        )
        
        return noise_val < connection_chance
    
    def _get_road_segment(self, site1: SiteRecord, site2: SiteRecord, 
                         chunk_bounds: Tuple[int, int, int, int]) -> Optional[Dict]:
        """Get road segment if it passes through the chunk."""
        # Simple line intersection check
        x1, z1 = site1.x, site1.z
        x2, z2 = site2.x, site2.z
        
        # Check if line segment intersects chunk
        # Using simple bounding box check for now
        min_x, min_z, max_x, max_z = chunk_bounds
        
        # Line bounding box
        line_min_x = min(x1, x2)
        line_max_x = max(x1, x2)
        line_min_z = min(z1, z2)
        line_max_z = max(z1, z2)
        
        # Check intersection
        if (line_max_x >= min_x and line_min_x <= max_x and
            line_max_z >= min_z and line_min_z <= max_z):
            
            # Determine road type based on site importance
            priority1 = self.site_priorities.get(site1.site_type, 0)
            priority2 = self.site_priorities.get(site2.site_type, 0)
            avg_priority = (priority1 + priority2) / 2
            
            if avg_priority >= 2.5:
                road_type = 'main_road'
            elif avg_priority >= 1.5:
                road_type = 'trade_route'
            else:
                road_type = 'path'
            
            return {
                'type': road_type,
                'start': (x1, z1),
                'end': (x2, z2),
                'sites': [site1.site_id, site2.site_id]
            }
        
        return None
    
    def _generate_road(self, context: ChunkContext, result: ChunkGenerationResult, road: Dict):
        """Generate a road segment in the chunk."""
        chunk_size = 16
        heightmap = result.metadata.get('heightmap')
        
        if not heightmap:
            return
        
        # Convert world coordinates to chunk coordinates
        start_x = road['start'][0] - context.chunk_x * 16
        start_z = road['start'][1] - context.chunk_z * 16
        end_x = road['end'][0] - context.chunk_x * 16
        end_z = road['end'][1] - context.chunk_z * 16
        
        # Get road properties
        road_type = self.road_types[road['type']]
        width = road_type['width']
        surface_block = road_type['surface_block']
        shoulder_block = road_type['shoulder_block']
        
        # Generate road path using line algorithm
        points = self._get_line_points(start_x, start_z, end_x, end_z)
        
        # Place road blocks
        for px, pz in points:
            if 0 <= px < chunk_size and 0 <= pz < chunk_size:
                surface_y = heightmap[int(px)][int(pz)]
                
                # Place road surface
                for dx in range(-width//2, width//2 + 1):
                    for dz in range(-width//2, width//2 + 1):
                        road_x = int(px + dx)
                        road_z = int(pz + dz)
                        
                        if 0 <= road_x < chunk_size and 0 <= road_z < chunk_size:
                            # Distance from center
                            dist = math.sqrt(dx*dx + dz*dz)
                            
                            if dist <= width/2:
                                # Road surface
                                for dy in range(2):  # Surface and one block below
                                    if surface_y + dy < 64:
                                        block_idx = (road_x + road_z * chunk_size + 
                                                   (surface_y + dy) * chunk_size * chunk_size)
                                        
                                        if dy == 0:
                                            result.blocks[block_idx] = surface_block
                                        else:
                                            result.blocks[block_idx] = surface_block
                            
                            elif dist <= width/2 + 1:
                                # Shoulder
                                if surface_y < 64:
                                    block_idx = road_x + road_z * chunk_size + surface_y * chunk_size * chunk_size
                                    result.blocks[block_idx] = shoulder_block
    
    def _get_line_points(self, x1: float, z1: float, x2: float, z2: float) -> List[Tuple[float, float]]:
        """Get points along a line using Bresenham's algorithm."""
        points = []
        
        # Convert to integers
        ix1, iz1 = int(x1), int(z1)
        ix2, iz2 = int(x2), int(z2)
        
        # Bresenham's line algorithm
        dx = abs(ix2 - ix1)
        dz = abs(iz2 - iz1)
        sx = 1 if ix1 < ix2 else -1
        sz = 1 if iz1 < iz2 else -1
        err = dx - dz
        
        x, z = ix1, iz1
        
        while True:
            points.append((x, z))
            
            if x == ix2 and z == iz2:
                break
            
            e2 = 2 * err
            if e2 > -dz:
                err -= dz
                x += sx
            if e2 < dx:
                err += dx
                z += sz
        
        return points


class TrailLayer:
    """Generates minor trails and paths not connected to sites."""
    
    def __init__(self, world_seed: WorldSeed):
        self.seed = world_seed.get_layer_seed("trails")
        self.noise = NoiseGenerator(self.seed)
    
    def apply(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate trails in the chunk."""
        chunk_size = 16
        heightmap = result.metadata.get('heightmap')
        
        if not heightmap:
            return
        
        # Generate trails based on terrain and biome
        trail_noise = self.noise.fractal_noise_2d(
            context.chunk_x * 0.2, context.chunk_z * 0.2,
            octaves=2, persistence=0.5
        )
        
        # Trails appear more commonly in certain biomes
        biome = context.biome.primary_biome
        trail_chance = self._get_trail_chance(biome)
        
        if trail_noise > (1.0 - trail_chance):
            # Generate a trail through the chunk
            self._generate_trail(context, result)
    
    def _get_trail_chance(self, biome) -> float:
        """Get trail generation chance for biome."""
        chances = {
            'forest': 0.3,
            'conifer_forest': 0.25,
            'plains': 0.2,
            'savanna': 0.15,
            'marsh': 0.1,
            'desert': 0.05,
            'tundra': 0.05,
            'alpine': 0.15,
        }
        return chances.get(biome.value, 0.1)
    
    def _generate_trail(self, context: ChunkContext, result: ChunkGenerationResult):
        """Generate a random trail through the chunk."""
        chunk_size = 16
        heightmap = result.metadata['heightmap']
        
        # Random trail direction
        angle = self.noise.noise_2d(context.chunk_x, context.chunk_z) * 2 * math.pi
        
        # Trail entry and exit points
        if abs(math.cos(angle)) > abs(math.sin(angle)):
            # Horizontal trail
            start_x = 0
            start_z = int(chunk_size / 2 + math.sin(angle) * chunk_size / 4)
            end_x = chunk_size - 1
            end_z = int(chunk_size / 2 - math.sin(angle) * chunk_size / 4)
        else:
            # Vertical trail
            start_x = int(chunk_size / 2 + math.cos(angle) * chunk_size / 4)
            start_z = 0
            end_x = int(chunk_size / 2 - math.cos(angle) * chunk_size / 4)
            end_z = chunk_size - 1
        
        # Generate trail path
        points = self._get_line_points(start_x, start_z, end_x, end_z)
        
        # Place trail blocks (narrow path)
        for px, pz in points:
            if 0 <= px < chunk_size and 0 <= pz < chunk_size:
                surface_y = heightmap[px][pz]
                
                # Trail surface (worn dirt)
                if surface_y < 64:
                    block_idx = px + pz * chunk_size + surface_y * chunk_size * chunk_size
                    result.blocks[block_idx] = 2  # DIRT
    
    def _get_line_points(self, x1: int, z1: int, x2: int, z2: int) -> List[Tuple[int, int]]:
        """Get points along a line using Bresenham's algorithm."""
        points = []
        
        dx = abs(x2 - x1)
        dz = abs(z2 - z1)
        sx = 1 if x1 < x2 else -1
        sz = 1 if z1 < z2 else -1
        err = dx - dz
        
        x, z = x1, z1
        
        while True:
            points.append((x, z))
            
            if x == x2 and z == z2:
                break
            
            e2 = 2 * err
            if e2 > -dz:
                err -= dz
                x += sx
            if e2 < dx:
                err += dx
                z += sz
        
        return points
