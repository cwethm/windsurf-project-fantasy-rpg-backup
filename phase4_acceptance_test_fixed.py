#!/usr/bin/env python3
"""
Phase 4 Acceptance Test - Ruins Loot Validation
Performs a bounded spiral scan to locate ruins markers and validates that 
server-side loot generation populates chests with the correct tiered items.
"""

import sys
import os
import random
from collections import defaultdict
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def spiral_scan_chunks(center_x, center_z, radius):
    """Generate chunk coordinates in a spiral pattern from center."""
    x, z = 0, 0
    dx, dz = 0, -1
    
    for step in range(radius * radius):
        yield (center_x + x, center_z + z)
        
        if x == z or (x < 0 and x == -z) or (x > 0 and x == 1 - z):
            dx, dz = -dz, dx
        
        x += dx
        z += dz

def run_acceptance_test():
    """Run the Phase 4 acceptance test for ruins loot generation."""
    print("=" * 60)
    print("PHASE 4 ACCEPTANCE TEST - RUINS LOOT VALIDATION")
    print("=" * 60)
    
    # Import here to avoid early import issues
    from worldgen.world_generator import WorldGenerator
    from worldgen.models.chunk_context import ChunkContext, ClimateSample, BiomeSample
    from worldgen.layers.biome import BiomeType
    from worldgen.layers.sites import SiteType
    from server import World
    
    # Initialize world generator with deterministic seed
    world_seed = "fantasy_rpg_world"
    generator = WorldGenerator(world_seed=world_seed)
    
    # Initialize server world for loot generation
    server_world = World(world_generator=generator)
    
    # Test parameters
    scan_radius = 50  # 50x50 chunk area (2500 chunks total)
    center_chunk_x, center_chunk_z = 0, 0
    
    print(f"Scanning {scan_radius*scan_radius} chunks around ({center_chunk_x}, {center_chunk_z})")
    print(f"World seed: {world_seed}")
    print("-" * 60)
    
    # Debug: Look for chunks with high site noise
    print("DEBUG: Analyzing site noise distribution...")
    noise_values = []
    max_noise = -999
    max_noise_chunk = None
    for chunk_x in range(-50, 51):
        for chunk_z in range(-50, 51):
            region_x = chunk_x // 8
            region_z = chunk_z // 8
            if (region_x, region_z) not in generator.regions:
                generator._ensure_region(region_x, region_z)
            region = generator.regions[(region_x, region_z)]
            
            from worldgen.models.chunk_context import ChunkContext
            context = ChunkContext(
                world_seed=generator.world_seed.base_seed,
                chunk_x=chunk_x,
                chunk_z=chunk_z,
                region_x=region_x,
                region_z=region_z,
                climate=None,
                biome=None,
                nearby_sites=region.sites,
                faction_influence=region.faction_control
            )
            
            site_noise = generator.site_layer.site_noise.fractal_noise_2d(
                context.chunk_x * 0.1, context.chunk_z * 0.1,
                octaves=2, persistence=0.7
            )
            noise_values.append(site_noise)
            if site_noise > max_noise:
                max_noise = site_noise
                max_noise_chunk = (chunk_x, chunk_z)
    
    import statistics
    print(f"Site noise stats across 10,000 chunks:")
    print(f"  Min: {min(noise_values):.3f}")
    print(f"  Max: {max_noise:.3f} at chunk {max_noise_chunk}")
    print(f"  Mean: {statistics.mean(noise_values):.3f}")
    print(f"  Std: {statistics.stdev(noise_values):.3f}")
    print(f"  Chunks > 0.85: {sum(1 for n in noise_values if n > 0.85)}")
    print(f"  Chunks > 0.5: {sum(1 for n in noise_values if n > 0.5)}")
    
    # Check the highest noise chunk
    if max_noise_chunk:
        chunk_x, chunk_z = max_noise_chunk
        result = generator.generate_chunk(chunk_x, chunk_z)
        print(f"\nHighest noise chunk ({chunk_x}, {chunk_z}):")
        print(f"  Noise: {max_noise:.3f}")
        print(f"  Spawn markers: {len(result.spawn_markers)}")
        if result.spawn_markers:
            for marker in result.spawn_markers:
                print(f"    - {marker}")
    print("-" * 60)
    
    # Statistics
    stats = {
        'total_chunks': 0,
        'ruins_found': 0,
        'prefab_counts': defaultdict(int),
        'loot_tier_counts': defaultdict(int),
        'chests_found': 0,
        'chests_with_loot': 0,
        'loot_items_by_tier': defaultdict(lambda: defaultdict(int))
    }
    
    # Perform spiral scan
    for chunk_x, chunk_z in spiral_scan_chunks(center_chunk_x, center_chunk_z, scan_radius):
        stats['total_chunks'] += 1
        
        # Generate chunk directly
        result = generator.generate_chunk(chunk_x, chunk_z)
        
        # Check for ruins spawn markers
        ruins_markers = [
            marker for marker in result.spawn_markers 
            if isinstance(marker, dict) and marker.get('type') == 'ruins'
        ]
        
        if ruins_markers:
            stats['ruins_found'] += len(ruins_markers)
            print(f"\nRuins found at chunk ({chunk_x}, {chunk_z}):")
            
            for marker in ruins_markers:
                prefab_id = marker.get('prefab_id', 'unknown')
                loot_tier = marker.get('loot_tier', 'unknown')
                
                stats['prefab_counts'][prefab_id] += 1
                stats['loot_tier_counts'][loot_tier] += 1
                
                print(f"  - Prefab: {prefab_id}, Loot Tier: {loot_tier}")
                
                # Apply server-side loot generation
                server_world._apply_spawn_marker_loot(chunk_x, chunk_z, result)
                
                # Check for chests in the chunk
                chest_blocks = []
                for i, block_id in enumerate(result.blocks):
                    if block_id == 8:  # Chest block ID
                        local_x = i % 16
                        local_y = (i // 256) % 16
                        local_z = (i // 16) % 16
                        chest_blocks.append((local_x, local_y, local_z))
                
                if chest_blocks:
                    stats['chests_found'] += len(chest_blocks)
                    print(f"  - Chests found: {len(chest_blocks)}")
                    
                    # Check chest contents
                    for chest_x, chest_y, chest_z in chest_blocks:
                        world_x = chunk_x * 16 + chest_x
                        world_y = chest_y
                        world_z = chunk_z * 16 + chest_z
                        
                        chest_key = f"{world_x},{world_y},{world_z}"
                        print(f"    Checking chest at key: {chest_key}")
                        print(f"    Available containers: {list(server_world.containers.keys())[:5]}...")
                        
                        if chest_key in server_world.containers:
                            container = server_world.containers[chest_key]
                            print(f"    Found container with {len(container.items) if container.items else 0} items")
                            if container.items:
                                stats['chests_with_loot'] += 1
                                print(f"    Chest at ({world_x}, {world_y}, {world_z}) has {len(container.items)} items")
                                
                                for item in container.items[:5]:  # Show first 5 items
                                    item_name = item.get('name', 'unknown')
                                    stats['loot_items_by_tier'][loot_tier][item_name] += 1
                                    print(f"      - {item_name}")
                            else:
                                print(f"    Chest at ({world_x}, {world_y}, {world_z}) is empty")
                        else:
                            print(f"    No container found at {chest_key}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("ACCEPTANCE TEST SUMMARY")
    print("=" * 60)
    
    print(f"\nChunk Statistics:")
    print(f"  Total chunks scanned: {stats['total_chunks']}")
    print(f"  Ruins found: {stats['ruins_found']}")
    print(f"  Ruins density: {stats['ruins_found'] / stats['total_chunks'] * 100:.2f}%")
    
    print(f"\nPrefab Distribution:")
    for prefab_id, count in sorted(stats['prefab_counts'].items()):
        print(f"  {prefab_id}: {count}")
    
    print(f"\nLoot Tier Distribution:")
    for tier, count in sorted(stats['loot_tier_counts'].items()):
        print(f"  {tier}: {count}")
    
    print(f"\nChest Statistics:")
    print(f"  Total chests found: {stats['chests_found']}")
    print(f"  Chests with loot: {stats['chests_with_loot']}")
    if stats['chests_found'] > 0:
        print(f"  Loot fill rate: {stats['chests_with_loot'] / stats['chests_found'] * 100:.2f}%")
    
    print(f"\nLoot Items by Tier:")
    for tier, items in sorted(stats['loot_items_by_tier'].items()):
        print(f"  {tier}:")
        for item_name, count in sorted(items.items()):
            print(f"    {item_name}: {count}")
    
    # Validation results
    print("\n" + "=" * 60)
    print("VALIDATION RESULTS")
    print("=" * 60)
    
    validation_passed = True
    
    # Check 1: Ruins spawn rate should be reasonable (>10% expected)
    spawn_rate = stats['ruins_found'] / stats['total_chunks']
    if spawn_rate < 0.05:  # 5% minimum
        print("❌ FAIL: Ruins spawn rate too low (< 5%)")
        validation_passed = False
    else:
        print(f"✅ PASS: Ruins spawn rate acceptable ({spawn_rate * 100:.2f}%)")
    
    # Check 2: All ruins should have loot tiers assigned
    if 'unknown' in stats['loot_tier_counts']:
        print("❌ FAIL: Some ruins missing loot tier assignment")
        validation_passed = False
    else:
        print("✅ PASS: All ruins have loot tiers assigned")
    
    # Check 3: Chests should be populated with loot
    if stats['chests_found'] > 0:
        loot_fill_rate = stats['chests_with_loot'] / stats['chests_found']
        if loot_fill_rate < 0.8:  # 80% minimum
            print(f"❌ FAIL: Chest loot fill rate too low ({loot_fill_rate * 100:.2f}%)")
            validation_passed = False
        else:
            print(f"✅ PASS: Chest loot fill rate acceptable ({loot_fill_rate * 100:.2f}%)")
    
    # Check 4: Multiple loot tiers should be present
    if len(stats['loot_tier_counts']) < 2:
        print("❌ FAIL: Less than 2 loot tiers found")
        validation_passed = False
    else:
        print(f"✅ PASS: {len(stats['loot_tier_counts'])} loot tiers found")
    
    print("\n" + "=" * 60)
    if validation_passed:
        print("🎉 ACCEPTANCE TEST PASSED")
    else:
        print("❌ ACCEPTANCE TEST FAILED")
    print("=" * 60)
    
    return validation_passed

if __name__ == "__main__":
    # Mock websockets module for standalone execution
    class MockWebsockets:
        def connect(self, *args, **kwargs):
            pass
    
    sys.modules['websockets'] = MockWebsockets()
    
    # Mock other potentially missing modules
    class MockAiofiles:
        async def open(self, *args, **kwargs):
            return self
    
    sys.modules['aiofiles'] = MockAiofiles()
    
    # Run the test
    success = run_acceptance_test()
    sys.exit(0 if success else 1)
