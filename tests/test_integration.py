"""
Integration tests for Mob-Player interactions
Tests complete scenarios involving mobs, players, and the world
"""
import unittest
import asyncio
import sys
import os
import math
from unittest.mock import Mock, AsyncMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server import MobManager, Mob, Player, World, MESSAGE_TYPES, Inventory


class TestMobPlayerIntegration(unittest.IsolatedAsyncioTestCase):
    """Integration tests for mob-player combat scenarios"""
    
    async def asyncSetUp(self):
        """Set up integration test fixtures"""
        self.manager = MobManager()
        self.server = Mock()
        self.server.broadcast = AsyncMock()
        self.server.send_to_client = AsyncMock()
        self.server._find_client_by_player_id = Mock(return_value='client1')
        self.server.handle_player_death = AsyncMock()
        
        # Create mock world
        self.world = Mock()
        self.world.spawn_item_entity = Mock()
        self.server.world = self.world
        
    async def test_complete_combat_scenario(self):
        """Test complete combat from detection to kill"""
        # Create mob
        mob = Mob("combat_mob", "zombie", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        
        # Create player
        player = Player('TestPlayer', 'player1')
        player.position = [5.0, 50.0, 0.0]  # Within detection range
        player.is_dead = False
        players = {'player1': player}
        self.server.players = players
        
        current_time = 1.0
        
        # Tick 1: Mob detects and starts chasing
        await self.manager._tick_mob(mob, players, self.server, current_time)
        self.assertEqual(mob.state, 'chasing')
        self.assertEqual(mob.target_player_id, player.id)
        
        # Move player closer to attack range
        player.position = [1.5, 50.0, 0.0]
        current_time = 3.0
        
        # Tick 2: Mob attacks
        await self.manager._tick_mob(mob, players, self.server, current_time)
        self.assertEqual(mob.state, 'attacking')
        self.assertLess(player.health, player.max_health)
        
        # Kill the mob
        initial_xp = player.experience
        damage = mob.health
        died = await self.manager.handle_mob_damaged(mob.id, damage, player.id, self.server)
        
        self.assertTrue(died)
        self.assertTrue(mob.is_dead)
        self.assertEqual(player.experience, initial_xp + mob.xp_reward)
        
    async def test_mob_kills_player(self):
        """Test scenario where mob kills player"""
        mob = Mob("killer_mob", "troll", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        player.health = 15  # Low health
        player.position = [1.0, 50.0, 0.0]  # In attack range
        player.is_dead = False
        players = {'player1': player}
        self.server.players = players
        
        current_time = 2.0
        mob.last_attack_time = 0.0
        
        # Mob attacks (troll does 20 damage)
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Player should be dead
        self.assertTrue(player.is_dead)
        self.server.handle_player_death.assert_called_once_with(player.id)
        
    async def test_multiple_mobs_attack_player(self):
        """Test multiple mobs attacking same player"""
        # Create 3 mobs
        mob1 = Mob("mob1", "zombie", 2, 50, 0)
        mob2 = Mob("mob2", "zombie", -2, 50, 0)
        mob3 = Mob("mob3", "skeleton", 0, 50, 2)
        
        self.manager.mobs[mob1.id] = mob1
        self.manager.mobs[mob2.id] = mob2
        self.manager.mobs[mob3.id] = mob3
        
        player = Player('TestPlayer', 'player1')
        player.position = [0.0, 50.0, 0.0]
        player.is_dead = False
        initial_health = player.health
        players = {'player1': player}
        self.server.players = players
        
        current_time = 2.0
        for mob in [mob1, mob2, mob3]:
            mob.last_attack_time = 0.0
            
        # All mobs should attack
        await self.manager._tick_mob(mob1, players, self.server, current_time)
        await self.manager._tick_mob(mob2, players, self.server, current_time)
        await self.manager._tick_mob(mob3, players, self.server, current_time)
        
        # Player should have taken damage from at least some mobs
        # (some might not be in attack range depending on exact positioning)
        self.assertLess(player.health, initial_health)
        
    async def test_player_kills_mob_gets_loot_and_xp(self):
        """Test player receives loot and XP when killing mob"""
        player = Player('TestPlayer', 'player1')
        player.position = [0.0, 50.0, 0.0]
        player.is_dead = False
        
        # Equip weapon to avoid durability issues
        player.equipped_weapon = {
            'type': 100,
            'damage': 10,
            'durability': 100
        }
        
        mob = Mob('mob1', 'zombie', 5, 50, 5)
        self.manager.mobs[mob.id] = mob
        
        initial_xp = player.experience
        
        # Kill the mob
        await self.manager.handle_mob_damaged(mob.id, 100, player.id, self.server)
        
        # Player should have gained XP
        self.assertGreater(player.experience, initial_xp)
        
        # Check loot spawned
        self.world.spawn_item_entity.assert_called()
        
    async def test_mob_switches_target_to_closer_player(self):
        """Test mob switches to closer player"""
        mob = Mob("switch_mob", "zombie", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        
        player1 = Player('Player1', 'player1')
        player1.position = [10.0, 50.0, 0.0]
        player1.is_dead = False
        
        player2 = Player('Player2', 'player2')
        player2.position = [15.0, 50.0, 0.0]
        player2.is_dead = False
        
        players = {'player1': player1, 'player2': player2}
        
        current_time = 1.0
        
        # Initial tick - should target player1 (closer)
        await self.manager._tick_mob(mob, players, self.server, current_time)
        self.assertEqual(mob.target_player_id, player1.id)
        
        # Player2 moves closer
        player2.position = [3.0, 50.0, 0.0]
        current_time = 2.0
        
        # Should switch to player2
        await self.manager._tick_mob(mob, players, self.server, current_time)
        self.assertEqual(mob.target_player_id, player2.id)
        
    async def test_mob_loses_aggro_when_player_dies(self):
        """Test mob returns to idle when target player dies"""
        mob = Mob("aggro_mob", "zombie", 0, 50, 0)
        mob.state = 'chasing'
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        player.position = [5.0, 50.0, 0.0]
        player.is_dead = False
        mob.target_player_id = player.id
        
        players = {'player1': player}
        
        # Player dies
        player.is_dead = True
        
        current_time = 1.0
        await self.manager._tick_mob(mob, players, self.server, current_time)
        
        # Mob should return to idle
        self.assertEqual(mob.state, 'idle')
        self.assertIsNone(mob.target_player_id)
        
    async def test_spawn_and_despawn_lifecycle(self):
        """Test complete mob lifecycle from spawn to despawn"""
        player = Player('TestPlayer', 'player1')
        player.position = [0.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        self.world.get_block = Mock(return_value=1)
        
        # Spawn mob
        current_time = 10.0
        self.manager.last_spawn_time = 0.0
        
        await self.manager.update(players, self.world, self.server, current_time)
        
        # Should have spawned
        self.assertGreater(len(self.manager.mobs), 0)
        mob_id = list(self.manager.mobs.keys())[0]
        
        # Move player far away
        player.position = [100.0, 50.0, 100.0]
        current_time = 20.0
        
        await self.manager.update(players, self.world, self.server, current_time)
        
        # Mob should despawn
        self.assertNotIn(mob_id, self.manager.mobs)
        
    async def test_corpse_persistence_after_death(self):
        """Test mob corpse persists for correct duration"""
        mob = Mob("corpse_mob", "zombie", 0, 50, 0)
        self.manager.mobs[mob.id] = mob
        
        player = Player('TestPlayer', 'player1')
        players = {'player1': player}
        self.server.players = players
        
        # Kill mob
        await self.manager.handle_mob_damaged(mob.id, mob.health, player.id, self.server)
        
        self.assertTrue(mob.is_dead)
        initial_death_time = mob.death_time
        
        # Update before corpse expires (30 seconds)
        current_time = initial_death_time + 30
        await self.manager.update(players, self.world, self.server, current_time)
        
        # Corpse should still exist
        self.assertIn(mob.id, self.manager.mobs)
        
        # Update after corpse expires (65 seconds)
        current_time = initial_death_time + 65
        await self.manager.update(players, self.world, self.server, current_time)
        
        # Corpse should be removed
        self.assertNotIn(mob.id, self.manager.mobs)


class TestMobSpawningIntegration(unittest.IsolatedAsyncioTestCase):
    """Integration tests for mob spawning mechanics"""
    
    async def asyncSetUp(self):
        """Set up spawning test fixtures"""
        self.manager = MobManager()
        self.server = Mock()
        self.server.broadcast = AsyncMock()
        self.world = Mock()
        self.world.get_block = Mock(return_value=1)
        
    async def test_no_spawn_without_players(self):
        """Test mobs don't spawn when no players online"""
        players = {}
        current_time = 10.0
        self.manager.last_spawn_time = 0.0
        
        await self.manager.update(players, self.world, self.server, current_time)
        
        self.assertEqual(len(self.manager.mobs), 0)
        
    async def test_spawn_rate_with_player(self):
        """Test mobs spawn at correct rate with player online"""
        player = Player('TestPlayer', 'player1')
        player.position = [0.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        spawn_count = 0
        current_time = 0.0
        
        # Simulate 40 seconds (should spawn ~5 mobs at 8s intervals)
        for i in range(40):
            current_time = float(i)
            initial_count = len(self.manager.mobs)
            await self.manager.update(players, self.world, self.server, current_time)
            if len(self.manager.mobs) > initial_count:
                spawn_count += 1
                
        # Should have spawned approximately 5 mobs (40s / 8s interval)
        self.assertGreaterEqual(spawn_count, 4)
        self.assertLessEqual(spawn_count, 6)
        
    async def test_max_mob_cap_enforced(self):
        """Test spawning stops at max mob cap"""
        player = Player('TestPlayer', 'player1')
        player.position = [0.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        # Fill to near max (leave room for 1 spawn)
        for i in range(self.manager.max_mobs - 1):
            mob = Mob(f"mob_{i}", "zombie", 10, 50, 10)
            self.manager.mobs[mob.id] = mob
            
        current_time = 10.0
        self.manager.last_spawn_time = 0.0
        
        # Try to spawn - may or may not succeed depending on spawn position
        await self.manager.update(players, self.world, self.server, current_time)
        
        # Should not exceed max
        self.assertLessEqual(len(self.manager.mobs), self.manager.max_mobs)


class TestMobCollisionIntegration(unittest.IsolatedAsyncioTestCase):
    """Integration tests for mob collision and separation"""
    
    async def asyncSetUp(self):
        """Set up collision test fixtures"""
        self.manager = MobManager()
        self.server = Mock()
        self.server.broadcast = AsyncMock()
        
    async def test_mob_separation_prevents_stacking(self):
        """Test multiple mobs separate when too close"""
        # Create 5 mobs at same position
        mobs = []
        for i in range(5):
            mob = Mob(f"mob_{i}", "zombie", 0, 50, 0)
            self.manager.mobs[mob.id] = mob
            mobs.append(mob)
            
        player = Player('TestPlayer', 'player1')
        player.position = [10.0, 50.0, 0.0]
        player.is_dead = False
        players = {'player1': player}
        
        # Tick all mobs multiple times
        for _ in range(10):
            current_time = 1.0
            for mob in mobs:
                await self.manager._tick_mob(mob, players, self.server, current_time)
                
        # Check that mobs have separated
        positions = [(m.position[0], m.position[2]) for m in mobs]
        
        # No two mobs should be at exact same position
        unique_positions = set(positions)
        self.assertGreater(len(unique_positions), 1)


if __name__ == '__main__':
    unittest.main()
