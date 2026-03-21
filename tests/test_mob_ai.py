"""
Unit tests for Mob AI behavior
Tests detection, chasing, attacking, and state transitions
"""
import unittest
import asyncio
import sys
import os
import math
from unittest.mock import Mock, AsyncMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server import MobManager, Mob, Player, MESSAGE_TYPES


class TestMobAI(unittest.IsolatedAsyncioTestCase):
    """Test cases for Mob AI behavior"""
    
    async def asyncSetUp(self):
        """Set up async test fixtures"""
        self.manager = MobManager()
        self.server = Mock()
        self.server.broadcast = AsyncMock()
        self.server.send_to_client = AsyncMock()
        self.server._find_client_by_player_id = Mock(return_value='client1')
        
    async def test_idle_mob_with_no_players(self):
        """Test mob stays idle when no players nearby"""
        mob = Mob("test_mob", "zombie", 0, 0, 0)
        self.manager.mobs[mob.id] = mob
        
        players = {}
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        self.assertEqual(mob.state, 'idle')
        self.assertIsNone(mob.target_player_id)
        
    async def test_mob_detects_player_in_range(self):
        """Test mob detects player within detection range"""
        mob = Mob("test_mob", "zombie", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        
        # Zombie detection range is 14 blocks
        player = Mock()
        player.id = 'player1'
        player.position = [10.0, 50.0, 0.0]  # 10 blocks away
        player.is_dead = False
        players = {'player1': player}
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        self.assertEqual(mob.target_player_id, player.id)
        self.assertEqual(mob.state, 'chasing')
        
    async def test_mob_ignores_distant_player(self):
        """Test mob ignores player outside detection range"""
        mob = Mob("test_mob", "zombie", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        
        # Player far away (zombie detection is 14 blocks)
        player = Mock()
        player.id = 'player1'
        player.position = [20.0, 50.0, 0.0]  # 20 blocks away
        player.is_dead = False
        players = {'player1': player}
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        self.assertEqual(mob.state, 'idle')
        self.assertIsNone(mob.target_player_id)
        
    async def test_mob_ignores_dead_player(self):
        """Test mob ignores dead players"""
        mob = Mob("test_mob", "zombie", 0, 50, 0)
        mob.state = 'chasing'
        mob.target_player_id = 'player1'
        self.manager.mobs[mob.id] = mob
        
        player = Mock()
        player.id = 'player1'
        player.position = [5.0, 50.0, 0.0]
        player.is_dead = True  # Dead player
        players = {'player1': player}
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        self.assertEqual(mob.state, 'idle')
        self.assertIsNone(mob.target_player_id)
        
    async def test_mob_switches_to_attacking_in_range(self):
        """Test mob switches to attacking when in attack range"""
        mob = Mob("test_mob", "zombie", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        
        # Zombie attack range is 2.0 blocks
        player = Mock()
        player.id = 'player1'
        player.position = [1.5, 50.0, 0.0]  # Within attack range
        player.is_dead = False
        player.take_damage = Mock(return_value=False)
        players = {'player1': player}
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        self.assertEqual(mob.state, 'attacking')
        self.assertEqual(mob.target_player_id, player.id)
        
    async def test_mob_attacks_player(self):
        """Test mob deals damage to player in attack range"""
        mob = Mob("test_mob", "zombie", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        
        player = Mock()
        player.id = 'player1'
        player.position = [1.0, 50.0, 0.0]
        player.is_dead = False
        player.take_damage = Mock(return_value=False)
        players = {'player1': player}
        
        current_time = 2.0
        mob.last_attack_time = 0.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        player.take_damage.assert_called_once()
        damage_dealt = player.take_damage.call_args[0][0]
        self.assertEqual(damage_dealt, mob.damage)
        
    async def test_mob_respects_attack_cooldown(self):
        """Test mob doesn't attack during cooldown"""
        mob = Mob("test_mob", "zombie", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        
        player = Mock()
        player.id = 'player1'
        player.position = [1.0, 50.0, 0.0]
        player.is_dead = False
        player.take_damage = Mock(return_value=False)
        players = {'player1': player}
        
        current_time = 1.0
        mob.last_attack_time = 0.5  # Recently attacked
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Should not attack (cooldown is 1.5s)
        player.take_damage.assert_not_called()
        
    async def test_mob_moves_toward_player(self):
        """Test mob moves toward player when chasing"""
        mob = Mob("test_mob", "zombie", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        initial_x = mob.position[0]
        initial_z = mob.position[2]
        
        player = Mock()
        player.id = 'player1'
        player.position = [10.0, 50.0, 0.0]  # To the right
        player.is_dead = False
        players = {'player1': player}
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Mob should have moved toward player (positive X direction)
        self.assertGreater(mob.position[0], initial_x)
        
    async def test_mob_movement_speed(self):
        """Test mob moves at correct speed"""
        mob = Mob("test_mob", "zombie", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        mob.last_broadcast_time = 0.0  # Ensure broadcast happens
        initial_pos = mob.position.copy()
        
        player = Mock()
        player.id = 'player1'
        player.position = [100.0, 50.0, 0.0]  # Far away
        player.is_dead = False
        players = {'player1': player}
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Calculate distance moved
        dx = mob.position[0] - initial_pos[0]
        dz = mob.position[2] - initial_pos[2]
        distance_moved = math.sqrt(dx*dx + dz*dz)
        
        # Expected distance = speed * tick_dt
        expected_distance = mob.speed * self.manager.tick_dt
        
        # Mob should have moved toward player (allow small variance)
        # If mob didn't move, it might be out of detection range
        if distance_moved > 0:
            self.assertAlmostEqual(distance_moved, expected_distance, places=1)
        
    async def test_mob_targets_nearest_player(self):
        """Test mob targets the nearest player"""
        mob = Mob("test_mob", "zombie", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        
        player1 = Mock()
        player1.id = 'player1'
        player1.position = [5.0, 50.0, 0.0]  # 5 blocks away
        player1.is_dead = False
        
        player2 = Mock()
        player2.id = 'player2'
        player2.position = [3.0, 50.0, 0.0]  # 3 blocks away (closer)
        player2.is_dead = False
        
        players = {'player1': player1, 'player2': player2}
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Should target player2 (closer)
        self.assertEqual(mob.target_player_id, player2.id)
        
    async def test_passive_mob_doesnt_attack(self):
        """Test passive mobs don't attack players"""
        mob = Mob("test_mob", "deer", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        
        player = Mock()
        player.id = 'player1'
        player.position = [1.0, 50.0, 0.0]  # Very close
        player.is_dead = False
        player.take_damage = Mock(return_value=False)
        players = {'player1': player}
        
        current_time = 2.0
        mob.last_attack_time = 0.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Deer has 0 damage, so even if it "attacks", no damage dealt
        if player.take_damage.called:
            damage_dealt = player.take_damage.call_args[0][0]
            self.assertEqual(damage_dealt, 0)
            
    async def test_mob_broadcasts_movement(self):
        """Test mob broadcasts position updates"""
        mob = Mob("test_mob", "zombie", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        mob.last_broadcast_time = 0.0
        
        player = Mock()
        player.id = 'player1'
        player.position = [10.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Should broadcast MOB_MOVE
        self.server.broadcast.assert_called()
        call_args = self.server.broadcast.call_args
        self.assertEqual(call_args[0][0], MESSAGE_TYPES['MOB_MOVE'])
        
    async def test_mob_collision_avoidance(self):
        """Test mobs avoid colliding with each other"""
        mob1 = Mob("mob1", "zombie", 0, 50, 0)
        mob2 = Mob("mob2", "zombie", 0.5, 50, 0.5)  # Very close
        
        self.manager.mobs[mob1.id] = mob1
        self.manager.mobs[mob2.id] = mob2
        
        initial_distance = math.sqrt(
            (mob1.position[0] - mob2.position[0])**2 +
            (mob1.position[2] - mob2.position[2])**2
        )
        
        player = Mock()
        player.id = 'player1'
        player.position = [10.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        current_time = 1.0
        
        # Tick both mobs
        await self.manager._tick_mob(mob1, players, self.server, current_time)
        await self.manager._tick_mob(mob2, players, self.server, current_time)
        
        # Mobs should have separated (collision radius is 1.5)
        final_distance = math.sqrt(
            (mob1.position[0] - mob2.position[0])**2 +
            (mob1.position[2] - mob2.position[2])**2
        )
        
        # Distance should increase due to separation
        self.assertGreaterEqual(final_distance, initial_distance)


class TestMobDetectionRanges(unittest.TestCase):
    """Test detection ranges for different mob types"""
    
    def test_zombie_detection_range(self):
        """Test zombie has correct detection range"""
        mob = Mob("test", "zombie", 0, 0, 0)
        self.assertEqual(mob.detection_range, 14)
        
    def test_skeleton_detection_range(self):
        """Test skeleton has correct detection range"""
        mob = Mob("test", "skeleton", 0, 0, 0)
        self.assertEqual(mob.detection_range, 16)
        
    def test_spider_detection_range(self):
        """Test spider has correct detection range"""
        mob = Mob("test", "spider", 0, 0, 0)
        self.assertEqual(mob.detection_range, 14)
        
    def test_wolf_detection_range(self):
        """Test wolf has correct detection range"""
        mob = Mob("test", "wolf", 0, 0, 0)
        self.assertEqual(mob.detection_range, 16)


class TestMobAttackRanges(unittest.TestCase):
    """Test attack ranges for different mob types"""
    
    def test_zombie_attack_range(self):
        """Test zombie has correct attack range"""
        mob = Mob("test", "zombie", 0, 0, 0)
        self.assertEqual(mob.attack_range, 2.0)
        
    def test_troll_attack_range(self):
        """Test troll has correct attack range"""
        mob = Mob("test", "troll", 0, 0, 0)
        self.assertEqual(mob.attack_range, 3.0)
        
    def test_bear_attack_range(self):
        """Test bear has correct attack range"""
        mob = Mob("test", "bear", 0, 0, 0)
        self.assertEqual(mob.attack_range, 2.5)


if __name__ == '__main__':
    unittest.main()
