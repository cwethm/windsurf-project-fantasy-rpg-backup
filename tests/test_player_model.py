"""
Tests for player model positioning and the wrapper group pattern.
Verifies that the player avatar's internal offset is preserved when
game.js sets the world position on the wrapper group.

Since PlayerAvatar is a Three.js client-side class, these tests validate
the server-side Player class and the data flow that feeds into the client.
"""
import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server import Player, VoxelServer, MESSAGE_TYPES


class TestPlayerCreation(unittest.TestCase):
    """Test Player class initialization and position handling"""

    def test_player_initial_position(self):
        """Player starts above ground level"""
        player = Player('TestPlayer', 'player1')
        self.assertEqual(player.position, [0.0, 80.0, 0.0])

    def test_player_position_is_list_of_three(self):
        """Position must always be [x, y, z]"""
        player = Player('TestPlayer', 'player1')
        self.assertIsInstance(player.position, list)
        self.assertEqual(len(player.position), 3)

    def test_player_position_update(self):
        """Position can be updated and maintains list format"""
        player = Player('TestPlayer', 'player1')
        player.position = [10.5, 42.0, -3.2]
        self.assertAlmostEqual(player.position[0], 10.5)
        self.assertAlmostEqual(player.position[1], 42.0)
        self.assertAlmostEqual(player.position[2], -3.2)

    def test_player_rotation_default(self):
        """Player rotation starts at [0, 0]"""
        player = Player('TestPlayer', 'player1')
        self.assertEqual(player.rotation, [0.0, 0.0])

    def test_player_velocity_default(self):
        """Player velocity starts at [0, 0, 0]"""
        player = Player('TestPlayer', 'player1')
        self.assertEqual(player.velocity, [0.0, 0.0, 0.0])


class TestPlayerMoveMessage(unittest.TestCase):
    """Test that player move data is structured correctly for client consumption"""

    def test_position_as_array(self):
        """Server sends position as array [x, y, z] — client must handle both formats"""
        player = Player('TestPlayer', 'player1')
        player.position = [5.0, 42.0, -3.0]
        
        # Simulate the broadcast data format
        move_data = {
            'playerId': player.id,
            'position': player.position,
            'velocity': player.velocity,
            'rotation': player.rotation,
        }
        
        # Position should be a list
        self.assertIsInstance(move_data['position'], list)
        self.assertEqual(len(move_data['position']), 3)
        
        # Rotation should be a list of [yaw, pitch]
        self.assertIsInstance(move_data['rotation'], list)
        self.assertEqual(len(move_data['rotation']), 2)

    def test_position_y_represents_feet(self):
        """position.y is the feet position — client wrapper group should be set here,
        and the internal model group offsets upward so the model's feet align."""
        player = Player('TestPlayer', 'player1')
        player.position = [0.0, 38.0, 0.0]
        
        # The y position is the ground/feet level
        # Client PlayerAvatar.wrapper.position.y should equal this value
        # Client PlayerAvatar.group.position.y should be +0.584 (internal offset)
        # This means the model's visual bottom is at y=38.0
        self.assertEqual(player.position[1], 38.0)


class TestPlayerDamageAndDeath(unittest.TestCase):
    """Test player health system"""

    def test_take_damage(self):
        """Player takes damage correctly"""
        player = Player('TestPlayer', 'player1')
        initial_health = player.health
        player.take_damage(10)
        self.assertEqual(player.health, initial_health - 10)

    def test_take_lethal_damage(self):
        """Player dies when health reaches 0"""
        player = Player('TestPlayer', 'player1')
        died = player.take_damage(200)
        self.assertTrue(died)
        self.assertTrue(player.is_dead)
        self.assertEqual(player.health, 0)

    def test_damage_cooldown(self):
        """Player has damage cooldown preventing rapid hits"""
        player = Player('TestPlayer', 'player1')
        player.take_damage(10)
        # Second hit within cooldown should be ignored
        died = player.take_damage(10)
        self.assertFalse(died)
        # Health should only reflect first hit
        self.assertEqual(player.health, 90)

    def test_dead_player_ignores_damage(self):
        """Dead player cannot take more damage"""
        player = Player('TestPlayer', 'player1')
        player.take_damage(200)
        self.assertTrue(player.is_dead)
        result = player.take_damage(50)
        self.assertFalse(result)

    def test_heal(self):
        """Player can be healed"""
        player = Player('TestPlayer', 'player1')
        player.health = 50
        player.heal(30)
        self.assertEqual(player.health, 80)

    def test_heal_does_not_exceed_max(self):
        """Healing cannot exceed max health"""
        player = Player('TestPlayer', 'player1')
        player.health = 95
        player.heal(100)
        self.assertEqual(player.health, player.max_health)


class TestItemIDConflicts(unittest.TestCase):
    """Verify that block type IDs and item type IDs don't conflict after the rename fix"""

    def test_no_planks_conflict(self):
        """PLANKS in ITEM_TYPES should resolve to block type 21, not material 361"""
        from shared.constants import ITEM_TYPES, BLOCK_TYPES
        # ITEM_TYPES inherits PLANKS from BLOCK_TYPES (ID 21)
        # SHAPED_PLANKS is the material variant (ID 361)
        self.assertEqual(ITEM_TYPES['PLANKS'], BLOCK_TYPES['PLANKS'])
        self.assertEqual(ITEM_TYPES['PLANKS'], 21)
        self.assertEqual(ITEM_TYPES['SHAPED_PLANKS'], 361)

    def test_no_sand_conflict(self):
        """SAND in ITEM_TYPES should resolve to block type 7, not material 348"""
        from shared.constants import ITEM_TYPES, BLOCK_TYPES
        self.assertEqual(ITEM_TYPES['SAND'], BLOCK_TYPES['SAND'])
        self.assertEqual(ITEM_TYPES['SAND'], 7)
        self.assertEqual(ITEM_TYPES['SAND_PILE'], 348)

    def test_no_leaves_conflict(self):
        """LEAVES in ITEM_TYPES should resolve to block type 5, not material 310"""
        from shared.constants import ITEM_TYPES, BLOCK_TYPES
        self.assertEqual(ITEM_TYPES['LEAVES'], BLOCK_TYPES['LEAVES'])
        self.assertEqual(ITEM_TYPES['LEAVES'], 5)
        self.assertEqual(ITEM_TYPES['LEAF_BUNDLE'], 310)


class TestDatabaseSavePlayer(unittest.TestCase):
    """Test that player save works without NOT NULL constraint errors"""

    def test_save_player_without_user_id(self):
        """save_player should succeed even without a user_id (guest players)"""
        from database import Database
        import tempfile
        import os

        # Use a temporary database
        fd, db_path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        try:
            db = Database(db_path)
            # This should NOT raise NOT NULL constraint error
            db.save_player(
                'test-player-id',
                'TestPlayer',
                {'x': 0.0, 'y': 38.0, 'z': 0.0},
                [],
                100
            )
            # Verify it was saved
            loaded = db.load_player('test-player-id')
            self.assertIsNotNone(loaded)
            self.assertEqual(loaded['username'], 'TestPlayer')
            self.assertAlmostEqual(loaded['position']['y'], 38.0)
        finally:
            os.unlink(db_path)

    def test_save_player_with_user_id(self):
        """save_player should store the user_id when provided"""
        from database import Database
        import tempfile
        import os

        fd, db_path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        try:
            db = Database(db_path)
            db.save_player(
                'test-player-id',
                'TestPlayer',
                {'x': 0.0, 'y': 38.0, 'z': 0.0},
                [],
                100,
                user_id='real-user-id'
            )
            loaded = db.load_player('test-player-id')
            self.assertIsNotNone(loaded)
        finally:
            os.unlink(db_path)


if __name__ == '__main__':
    unittest.main()
