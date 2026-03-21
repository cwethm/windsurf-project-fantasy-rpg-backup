"""
Unit tests for Passive Mob Following System
Tests follow state, interaction, and movement behavior
"""
import unittest
import asyncio
import sys
import os
import math
from unittest.mock import Mock, AsyncMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server import MobManager, Mob, Player, MESSAGE_TYPES, VoxelServer


class TestMobFollowMethods(unittest.TestCase):
    """Test cases for Mob follow methods"""
    
    def test_follow_sets_state_and_target(self):
        """Test follow() method sets correct state and target"""
        mob = Mob("test_mob", "sheep", 0, 50, 0)
        player_id = "player1"
        
        mob.follow(player_id)
        
        self.assertEqual(mob.follow_target_id, player_id)
        self.assertEqual(mob.state, 'following')
        
    def test_unfollow_clears_target(self):
        """Test unfollow() clears follow target"""
        mob = Mob("test_mob", "sheep", 0, 50, 0)
        mob.follow("player1")
        
        mob.unfollow()
        
        self.assertIsNone(mob.follow_target_id)
        self.assertEqual(mob.state, 'idle')
        
    def test_is_passive_returns_true_for_zero_damage(self):
        """Test is_passive() identifies passive mobs"""
        passive_mob = Mob("passive", "deer", 0, 50, 0)
        hostile_mob = Mob("hostile", "zombie", 0, 50, 0)
        
        self.assertTrue(passive_mob.is_passive())
        self.assertFalse(hostile_mob.is_passive())
        
    def test_passive_mob_types(self):
        """Test all passive mob types are correctly identified"""
        passive_types = ['deer', 'sheep', 'cow', 'rabbit', 'chicken']
        
        for mob_type in passive_types:
            with self.subTest(mob_type=mob_type):
                mob = Mob(f"test_{mob_type}", mob_type, 0, 0, 0)
                self.assertTrue(mob.is_passive(), f"{mob_type} should be passive")
                self.assertEqual(mob.damage, 0)
                
    def test_hostile_mob_types(self):
        """Test hostile mobs are not passive"""
        hostile_types = ['zombie', 'skeleton', 'goblin', 'spider', 'troll']
        
        for mob_type in hostile_types:
            with self.subTest(mob_type=mob_type):
                mob = Mob(f"test_{mob_type}", mob_type, 0, 0, 0)
                self.assertFalse(mob.is_passive(), f"{mob_type} should be hostile")
                self.assertGreater(mob.damage, 0)
                
    def test_follow_distance_initialized(self):
        """Test follow distance is properly initialized"""
        mob = Mob("test", "sheep", 0, 0, 0)
        self.assertEqual(mob.follow_distance, 3.0)
        
    def test_to_dict_includes_follow_target(self):
        """Test serialization includes follow target"""
        mob = Mob("test", "sheep", 0, 50, 0)
        mob.follow("player1")
        
        mob_dict = mob.to_dict()
        
        self.assertIn('followTargetId', mob_dict)
        self.assertEqual(mob_dict['followTargetId'], "player1")


class TestMobFollowBehavior(unittest.IsolatedAsyncioTestCase):
    """Test cases for mob following AI behavior"""
    
    async def asyncSetUp(self):
        """Set up async test fixtures"""
        self.manager = MobManager()
        self.server = Mock()
        self.server.broadcast = AsyncMock()
        
    async def test_passive_mob_follows_player(self):
        """Test passive mob moves toward follow target"""
        mob = Mob("sheep1", "sheep", 0, 50, 0)
        mob.follow("player1")
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        player.position = [10.0, 50.0, 0.0]  # 10 blocks away
        player.is_dead = False
        players = {'player1': player}
        
        initial_x = mob.position[0]
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Mob should have moved toward player (positive X direction)
        self.assertGreater(mob.position[0], initial_x)
        self.assertEqual(mob.state, 'following')
        
    async def test_passive_mob_stops_when_close(self):
        """Test passive mob stops moving when within follow distance"""
        mob = Mob("sheep1", "sheep", 0, 50, 0)
        mob.follow("player1")
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        player.position = [2.0, 50.0, 0.0]  # Within follow distance (3.0)
        player.is_dead = False
        players = {'player1': player}
        
        initial_pos = mob.position.copy()
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Mob should stay in place (close enough)
        self.assertEqual(mob.state, 'following')
        
    async def test_passive_mob_unfollows_when_player_dies(self):
        """Test mob stops following when player dies"""
        mob = Mob("sheep1", "sheep", 0, 50, 0)
        mob.follow("player1")
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        player.position = [10.0, 50.0, 0.0]
        player.is_dead = True  # Dead player
        players = {'player1': player}
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Mob should stop following
        self.assertIsNone(mob.follow_target_id)
        self.assertEqual(mob.state, 'idle')
        
    async def test_passive_mob_unfollows_when_player_disconnects(self):
        """Test mob stops following when player disconnects"""
        mob = Mob("sheep1", "sheep", 0, 50, 0)
        mob.follow("player1")
        self.manager.mobs[mob.id] = mob
        
        players = {}  # Player disconnected
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Mob should stop following
        self.assertIsNone(mob.follow_target_id)
        self.assertEqual(mob.state, 'idle')
        
    async def test_passive_mob_without_follow_stays_idle(self):
        """Test passive mob stays idle when not following"""
        mob = Mob("sheep1", "sheep", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        player.position = [5.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Mob should stay idle (not following anyone)
        self.assertEqual(mob.state, 'idle')
        self.assertIsNone(mob.follow_target_id)
        
    async def test_hostile_mob_ignores_follow_command(self):
        """Test hostile mobs don't enter follow state"""
        mob = Mob("zombie1", "zombie", 0, 50, 0)
        mob.follow("player1")  # Try to make hostile mob follow
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        player.position = [5.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Hostile mob should chase, not follow
        self.assertEqual(mob.state, 'chasing')
        
    async def test_following_mob_broadcasts_movement(self):
        """Test following mob broadcasts position updates"""
        mob = Mob("sheep1", "sheep", 0, 50, 0)
        mob.follow("player1")
        mob.last_broadcast_time = 0.0
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        player.position = [10.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        current_time = 1.0
        
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Should have broadcast movement
        self.server.broadcast.assert_called()
        call_args = self.server.broadcast.call_args
        self.assertEqual(call_args[0][0], MESSAGE_TYPES['MOB_MOVE'])
        self.assertEqual(call_args[0][1]['followTargetId'], 'player1')


class TestMobInteractionHandler(unittest.IsolatedAsyncioTestCase):
    """Test cases for server-side mob interaction"""
    
    async def asyncSetUp(self):
        """Set up async test fixtures"""
        self.manager = MobManager()
        self.server = Mock()
        self.server.broadcast = AsyncMock()
        self.server.send_to_client = AsyncMock()
        self.server.mob_manager = self.manager
        self.server.players = {}
        
    async def test_interaction_makes_passive_mob_follow(self):
        """Test right-clicking passive mob makes it follow"""
        mob = Mob("sheep1", "sheep", 5, 50, 5)
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        player.position = [5.0, 50.0, 5.0]  # Close to mob
        self.server.players = {'player1': player}
        
        game_server = VoxelServer()
        game_server.mob_manager = self.manager
        game_server.players = self.server.players
        game_server.broadcast = self.server.broadcast
        game_server.send_to_client = self.server.send_to_client
        
        await game_server.handle_mob_interact('player1', {'mobId': mob.id})
        
        # Mob should now be following
        self.assertEqual(mob.follow_target_id, 'player1')
        self.assertEqual(mob.state, 'following')
        
    async def test_interaction_toggles_follow_off(self):
        """Test clicking already-following mob stops following"""
        mob = Mob("sheep1", "sheep", 5, 50, 5)
        mob.follow("player1")
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        player.position = [5.0, 50.0, 5.0]
        self.server.players = {'player1': player}
        
        game_server = VoxelServer()
        game_server.mob_manager = self.manager
        game_server.players = self.server.players
        game_server.broadcast = self.server.broadcast
        game_server.send_to_client = self.server.send_to_client
        
        await game_server.handle_mob_interact('player1', {'mobId': mob.id})
        
        # Mob should stop following
        self.assertIsNone(mob.follow_target_id)
        self.assertEqual(mob.state, 'idle')
        
    async def test_interaction_ignores_hostile_mobs(self):
        """Test right-clicking hostile mob doesn't make it follow"""
        mob = Mob("zombie1", "zombie", 5, 50, 5)
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        player.position = [5.0, 50.0, 5.0]
        self.server.players = {'player1': player}
        
        game_server = VoxelServer()
        game_server.mob_manager = self.manager
        game_server.players = self.server.players
        game_server.broadcast = self.server.broadcast
        game_server.send_to_client = self.server.send_to_client
        
        await game_server.handle_mob_interact('player1', {'mobId': mob.id})
        
        # Hostile mob should not follow
        self.assertIsNone(mob.follow_target_id)
        self.assertNotEqual(mob.state, 'following')
        
    async def test_interaction_respects_distance(self):
        """Test interaction fails if player too far away"""
        mob = Mob("sheep1", "sheep", 20, 50, 20)
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        player.position = [0.0, 50.0, 0.0]  # Too far (>6 blocks)
        self.server.players = {'player1': player}
        
        game_server = VoxelServer()
        game_server.mob_manager = self.manager
        game_server.players = self.server.players
        game_server.broadcast = self.server.broadcast
        game_server.send_to_client = self.server.send_to_client
        
        await game_server.handle_mob_interact('player1', {'mobId': mob.id})
        
        # Mob should not follow (too far)
        self.assertIsNone(mob.follow_target_id)


if __name__ == '__main__':
    unittest.main()
