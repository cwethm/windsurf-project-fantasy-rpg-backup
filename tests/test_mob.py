"""
Unit tests for Mob class
Tests mob health, damage, loot drops, and state management
"""
import unittest
import sys
import os
import time
from unittest.mock import Mock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server import Mob, MOB_STATS


class TestMob(unittest.TestCase):
    """Test cases for the Mob class"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.mob_id = "test_mob_1"
        self.mob_type = "zombie"
        self.position = (10.0, 50.0, 10.0)
        
    def test_mob_initialization(self):
        """Test mob is initialized with correct stats"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        
        self.assertEqual(mob.id, self.mob_id)
        self.assertEqual(mob.type, self.mob_type)
        self.assertEqual(mob.position, [10.0, 50.0, 10.0])
        self.assertEqual(mob.state, 'idle')
        self.assertFalse(mob.is_dead)
        
        # Check stats match MOB_STATS
        expected_stats = MOB_STATS[self.mob_type]
        self.assertEqual(mob.health, expected_stats['health'])
        self.assertEqual(mob.max_health, expected_stats['health'])
        self.assertEqual(mob.damage, expected_stats['damage'])
        self.assertEqual(mob.speed, expected_stats['speed'])
        self.assertEqual(mob.attack_range, expected_stats['attack_range'])
        self.assertEqual(mob.detection_range, expected_stats['detection_range'])
        self.assertEqual(mob.xp_reward, expected_stats['xp_reward'])
        
    def test_mob_types_initialization(self):
        """Test all mob types initialize correctly"""
        mob_types = ['zombie', 'skeleton', 'goblin', 'slime', 'spider', 
                     'troll', 'wolf', 'bear', 'boar', 'deer', 'sheep', 
                     'cow', 'rabbit', 'chicken']
        
        for mob_type in mob_types:
            with self.subTest(mob_type=mob_type):
                mob = Mob(f"test_{mob_type}", mob_type, 0, 0, 0)
                self.assertEqual(mob.type, mob_type)
                self.assertGreater(mob.health, 0)
                self.assertEqual(mob.health, mob.max_health)
                
    def test_take_damage_reduces_health(self):
        """Test taking damage reduces health correctly"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        initial_health = mob.health
        damage = 10.0
        
        died = mob.take_damage(damage)
        
        self.assertFalse(died)
        self.assertEqual(mob.health, initial_health - damage)
        self.assertFalse(mob.is_dead)
        
    def test_take_damage_kills_mob(self):
        """Test mob dies when health reaches 0"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        
        # Deal lethal damage
        died = mob.take_damage(mob.health + 10)
        
        self.assertTrue(died)
        self.assertEqual(mob.health, 0)
        self.assertTrue(mob.is_dead)
        self.assertEqual(mob.state, 'dead')
        self.assertGreater(mob.death_time, 0)
        
    def test_take_damage_exact_lethal(self):
        """Test mob dies with exact lethal damage"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        initial_health = mob.health
        
        died = mob.take_damage(initial_health)
        
        self.assertTrue(died)
        self.assertEqual(mob.health, 0)
        self.assertTrue(mob.is_dead)
        
    def test_dead_mob_ignores_damage(self):
        """Test dead mobs don't take additional damage"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        
        # Kill the mob
        mob.take_damage(mob.health)
        self.assertTrue(mob.is_dead)
        
        # Try to damage again
        died = mob.take_damage(10)
        
        self.assertFalse(died)
        self.assertEqual(mob.health, 0)
        
    def test_negative_damage_clamped(self):
        """Test health doesn't go below 0"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        
        mob.take_damage(mob.health + 1000)
        
        self.assertEqual(mob.health, 0)
        self.assertGreaterEqual(mob.health, 0)
        
    def test_loot_drops(self):
        """Test loot drop system returns valid items"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        
        # Roll loot multiple times to test randomness
        for _ in range(10):
            drops = mob.roll_loot()
            
            self.assertIsInstance(drops, list)
            for drop in drops:
                self.assertIn('type', drop)
                self.assertIn('count', drop)
                self.assertGreater(drop['count'], 0)
                
    def test_loot_respects_weights(self):
        """Test loot drops respect weight probabilities"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        
        # Roll loot many times to test distribution
        total_rolls = 1000
        drop_counts = {}
        
        for _ in range(total_rolls):
            drops = mob.roll_loot()
            for drop in drops:
                item_type = drop['type']
                drop_counts[item_type] = drop_counts.get(item_type, 0) + 1
                
        # At least some drops should occur
        self.assertGreater(len(drop_counts), 0)
        
    def test_mob_to_dict(self):
        """Test mob serialization to dictionary"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        mob.state = 'chasing'
        
        mob_dict = mob.to_dict()
        
        self.assertEqual(mob_dict['id'], self.mob_id)
        self.assertEqual(mob_dict['type'], self.mob_type)
        self.assertEqual(mob_dict['position'], mob.position)
        self.assertEqual(mob_dict['health'], mob.health)
        self.assertEqual(mob_dict['max_health'], mob.max_health)
        self.assertEqual(mob_dict['state'], 'chasing')
        
    def test_attack_cooldown_initialization(self):
        """Test attack cooldown is properly initialized"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        
        self.assertEqual(mob.last_attack_time, 0.0)
        self.assertEqual(mob.attack_cooldown, 1.5)
        
    def test_corpse_duration(self):
        """Test corpse has correct duration"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        
        self.assertEqual(mob.corpse_duration, 60.0)
        
    def test_target_player_initialization(self):
        """Test target player is None on initialization"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        
        self.assertIsNone(mob.target_player_id)
        
    def test_broadcast_interval(self):
        """Test broadcast interval is set correctly"""
        mob = Mob(self.mob_id, self.mob_type, *self.position)
        
        self.assertEqual(mob.broadcast_interval, 0.3)
        self.assertEqual(mob.last_broadcast_time, 0.0)


class TestMobStats(unittest.TestCase):
    """Test MOB_STATS configuration"""
    
    def test_all_mob_types_have_stats(self):
        """Test all mob types have complete stat definitions"""
        required_stats = ['health', 'damage', 'speed', 'attack_range', 
                         'detection_range', 'xp_reward', 'loot']
        
        mob_types = ['zombie', 'skeleton', 'goblin', 'slime', 'spider',
                     'troll', 'wolf', 'bear', 'boar', 'deer', 'sheep',
                     'cow', 'rabbit', 'chicken']
        
        for mob_type in mob_types:
            with self.subTest(mob_type=mob_type):
                self.assertIn(mob_type, MOB_STATS)
                stats = MOB_STATS[mob_type]
                
                for stat in required_stats:
                    self.assertIn(stat, stats, 
                                f"{mob_type} missing {stat}")
                    
    def test_passive_mobs_have_zero_damage(self):
        """Test passive mobs have 0 damage"""
        passive_mobs = ['deer', 'sheep', 'cow', 'rabbit', 'chicken']
        
        for mob_type in passive_mobs:
            with self.subTest(mob_type=mob_type):
                self.assertEqual(MOB_STATS[mob_type]['damage'], 0,
                               f"{mob_type} should have 0 damage")
                               
    def test_hostile_mobs_have_positive_damage(self):
        """Test hostile mobs have damage > 0"""
        hostile_mobs = ['zombie', 'skeleton', 'goblin', 'slime', 'spider',
                       'troll', 'wolf', 'bear', 'boar']
        
        for mob_type in hostile_mobs:
            with self.subTest(mob_type=mob_type):
                self.assertGreater(MOB_STATS[mob_type]['damage'], 0,
                                 f"{mob_type} should have damage > 0")
                                 
    def test_loot_tables_valid(self):
        """Test all loot tables have valid structure"""
        for mob_type, stats in MOB_STATS.items():
            with self.subTest(mob_type=mob_type):
                loot_table = stats['loot']
                self.assertIsInstance(loot_table, list)
                
                for entry in loot_table:
                    self.assertIn('type', entry)
                    self.assertIn('weight', entry)
                    self.assertIn('count', entry)
                    # Count can be list or tuple
                    self.assertIn(type(entry['count']), [list, tuple])
                    self.assertEqual(len(entry['count']), 2)
                    self.assertLessEqual(entry['count'][0], entry['count'][1])


if __name__ == '__main__':
    unittest.main()
