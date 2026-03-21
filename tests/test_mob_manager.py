"""
Unit tests for MobManager class
Tests mob spawning, despawning, and manager state
"""
import unittest
import asyncio
import sys
import os
import math
from unittest.mock import Mock, AsyncMock, patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server import MobManager, Mob, Player, World, MESSAGE_TYPES


class TestMobManager(unittest.TestCase):
    """Test cases for MobManager class"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.manager = MobManager()
        
    def test_initialization(self):
        """Test MobManager initializes with correct defaults"""
        self.assertEqual(len(self.manager.mobs), 0)
        self.assertEqual(self.manager.max_mobs, 60)
        self.assertEqual(self.manager.spawn_dist_min, 20.0)
        self.assertEqual(self.manager.spawn_dist_max, 40.0)
        self.assertEqual(self.manager.despawn_dist, 70.0)
        self.assertEqual(self.manager.spawn_interval, 8.0)
        self.assertEqual(self.manager.tick_dt, 0.35)
        
    def test_new_id_generation(self):
        """Test unique mob ID generation"""
        id1 = self.manager._new_id()
        id2 = self.manager._new_id()
        id3 = self.manager._new_id()
        
        self.assertEqual(id1, "mob_1")
        self.assertEqual(id2, "mob_2")
        self.assertEqual(id3, "mob_3")
        self.assertNotEqual(id1, id2)
        self.assertNotEqual(id2, id3)
        
    def test_find_spawn_pos_no_players(self):
        """Test spawn position returns None with no players"""
        players = {}
        world = Mock()
        
        result = self.manager._find_spawn_pos(players, world)
        
        self.assertIsNone(result)
        
    def test_find_spawn_pos_with_player(self):
        """Test spawn position is within correct distance from player"""
        player = Mock()
        player.position = [0.0, 50.0, 0.0]
        players = {'player1': player}
        
        world = Mock()
        world.get_block = Mock(return_value=1)  # Solid ground
        
        result = self.manager._find_spawn_pos(players, world)
        
        if result:
            sx, sy, sz, mob_type = result
            
            # Check distance from player
            dx = sx - player.position[0]
            dz = sz - player.position[2]
            distance = math.sqrt(dx*dx + dz*dz)
            
            self.assertGreaterEqual(distance, self.manager.spawn_dist_min)
            self.assertLessEqual(distance, self.manager.spawn_dist_max)
            self.assertIn(mob_type, self.manager.COMMON_TYPES + self.manager.RARE_TYPES)
            
    def test_spawn_type_distribution(self):
        """Test mob type selection follows common/rare distribution"""
        player = Mock()
        player.position = [0.0, 50.0, 0.0]
        players = {'player1': player}
        
        world = Mock()
        world.get_block = Mock(return_value=1)
        
        common_count = 0
        rare_count = 0
        total_spawns = 100
        
        for _ in range(total_spawns):
            result = self.manager._find_spawn_pos(players, world)
            if result:
                _, _, _, mob_type = result
                if mob_type in self.manager.COMMON_TYPES:
                    common_count += 1
                elif mob_type in self.manager.RARE_TYPES:
                    rare_count += 1
                    
        # Rare mobs should be ~5% (allow some variance)
        if common_count + rare_count > 0:
            rare_percentage = rare_count / (common_count + rare_count)
            self.assertLess(rare_percentage, 0.15)  # Less than 15%
            
    def test_mob_manager_respects_max_mobs(self):
        """Test manager doesn't exceed max mob count"""
        # Add mobs up to the limit
        for i in range(self.manager.max_mobs):
            mob = Mob(f"mob_{i}", "zombie", 0, 0, 0)
            self.manager.mobs[mob.id] = mob
            
        self.assertEqual(len(self.manager.mobs), self.manager.max_mobs)
        
    def test_common_and_rare_types_defined(self):
        """Test common and rare mob types are properly defined"""
        self.assertGreater(len(self.manager.COMMON_TYPES), 0)
        self.assertGreater(len(self.manager.RARE_TYPES), 0)
        
        # No overlap between common and rare
        common_set = set(self.manager.COMMON_TYPES)
        rare_set = set(self.manager.RARE_TYPES)
        self.assertEqual(len(common_set & rare_set), 0)


class TestMobManagerAsync(unittest.IsolatedAsyncioTestCase):
    """Async test cases for MobManager"""
    
    async def asyncSetUp(self):
        """Set up async test fixtures"""
        self.manager = MobManager()
        self.server = Mock()
        self.server.broadcast = AsyncMock()
        self.server.send_to_client = AsyncMock()
        self.server._find_client_by_player_id = Mock(return_value='client1')
        
    async def test_update_spawns_mob(self):
        """Test update spawns mobs when conditions are met"""
        player = Mock()
        player.id = 'player1'
        player.position = [0.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        world = Mock()
        world.get_block = Mock(return_value=1)
        
        current_time = 10.0
        self.manager.last_spawn_time = 0.0
        
        await self.manager.update(players, world, self.server, current_time)
        
        # Should have spawned a mob
        self.assertGreater(len(self.manager.mobs), 0)
        self.server.broadcast.assert_called()
        
    async def test_update_respects_spawn_interval(self):
        """Test spawning respects time interval"""
        player = Mock()
        player.position = [0.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        world = Mock()
        world.get_block = Mock(return_value=1)
        
        current_time = 5.0
        self.manager.last_spawn_time = 0.0
        
        # First update - should spawn
        await self.manager.update(players, world, self.server, current_time)
        first_spawn_count = len(self.manager.mobs)
        
        # Second update too soon - should not spawn
        current_time = 6.0  # Only 1 second later
        await self.manager.update(players, world, self.server, current_time)
        
        self.assertEqual(len(self.manager.mobs), first_spawn_count)
        
    async def test_update_respects_max_mobs(self):
        """Test update doesn't spawn beyond max_mobs"""
        player = Mock()
        player.position = [0.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        world = Mock()
        world.get_block = Mock(return_value=1)
        
        # Fill to max
        for i in range(self.manager.max_mobs):
            mob = Mob(f"mob_{i}", "zombie", 0, 0, 0)
            self.manager.mobs[mob.id] = mob
            
        current_time = 100.0
        self.manager.last_spawn_time = 0.0
        
        await self.manager.update(players, world, self.server, current_time)
        
        # Should not exceed max
        self.assertEqual(len(self.manager.mobs), self.manager.max_mobs)
        
    async def test_corpse_despawn_after_duration(self):
        """Test dead mobs despawn after corpse duration"""
        player = Mock()
        player.position = [0.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        world = Mock()
        
        # Create dead mob
        mob = Mob("dead_mob", "zombie", 0, 0, 0)
        mob.is_dead = True
        mob.death_time = 0.0
        mob.corpse_duration = 60.0
        self.manager.mobs[mob.id] = mob
        
        # Update before corpse expires
        current_time = 30.0
        await self.manager.update(players, world, self.server, current_time)
        self.assertIn(mob.id, self.manager.mobs)
        
        # Update after corpse expires
        current_time = 61.0
        await self.manager.update(players, world, self.server, current_time)
        self.assertNotIn(mob.id, self.manager.mobs)
        
    async def test_distant_mobs_despawn(self):
        """Test mobs despawn when too far from all players"""
        player = Mock()
        player.position = [0.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        world = Mock()
        
        # Create mob far away
        mob = Mob("distant_mob", "zombie", 100.0, 50.0, 100.0)
        self.manager.mobs[mob.id] = mob
        
        current_time = 10.0
        await self.manager.update(players, world, self.server, current_time)
        
        # Mob should be despawned (distance > 70)
        self.assertNotIn(mob.id, self.manager.mobs)
        
    async def test_nearby_mobs_dont_despawn(self):
        """Test mobs within despawn distance stay active"""
        player = Mock()
        player.position = [0.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        world = Mock()
        
        # Create mob nearby
        mob = Mob("nearby_mob", "zombie", 30.0, 50.0, 30.0)
        self.manager.mobs[mob.id] = mob
        
        current_time = 10.0
        await self.manager.update(players, world, self.server, current_time)
        
        # Mob should still exist
        self.assertIn(mob.id, self.manager.mobs)
        
    async def test_handle_mob_damaged(self):
        """Test mob damage handling"""
        mob = Mob("test_mob", "zombie", 0, 0, 0)
        self.manager.mobs[mob.id] = mob
        initial_health = mob.health
        
        damage = 10.0
        attacker_id = 'player1'
        
        died = await self.manager.handle_mob_damaged(
            mob.id, damage, attacker_id, self.server
        )
        
        self.assertFalse(died)
        self.assertEqual(mob.health, initial_health - damage)
        self.server.send_to_client.assert_called()
        self.server.broadcast.assert_called()
        
    async def test_handle_mob_damaged_kills_mob(self):
        """Test mob death through damage"""
        mob = Mob("test_mob", "zombie", 0, 0, 0)
        self.manager.mobs[mob.id] = mob
        
        damage = mob.health + 10
        attacker_id = 'player1'
        
        # Mock player for XP reward
        player = Mock()
        player.give_experience = Mock(return_value=False)
        self.server.players = {attacker_id: player}
        
        world = Mock()
        world.spawn_item_entity = Mock()
        self.server.world = world
        
        died = await self.manager.handle_mob_damaged(
            mob.id, damage, attacker_id, self.server
        )
        
        self.assertTrue(died)
        self.assertTrue(mob.is_dead)
        self.assertEqual(mob.state, 'dead')
        
    async def test_handle_mob_damaged_nonexistent_mob(self):
        """Test damaging non-existent mob returns False"""
        died = await self.manager.handle_mob_damaged(
            "fake_mob", 10.0, 'player1', self.server
        )
        
        self.assertFalse(died)


if __name__ == '__main__':
    unittest.main()
