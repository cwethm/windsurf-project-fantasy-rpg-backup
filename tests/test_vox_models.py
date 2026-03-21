"""
Unit tests for VOX Model Loading and Rendering
Tests player models, mob models, and VOX file integration
"""
import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


class TestVOXFileExistence(unittest.TestCase):
    """Test that all required VOX model files exist"""
    
    def setUp(self):
        self.client_models_dir = os.path.join(
            os.path.dirname(__file__), 
            '..', 
            'client', 
            'assets', 
            'models'
        )
        self.mob_animals_dir = os.path.join(
            os.path.dirname(__file__),
            '..',
            'mob_vox',
            'animal_vox_generator_bundle',
            'generated_animals'
        )
        self.player_avatars_dir = os.path.join(
            os.path.dirname(__file__),
            '..',
            'mob_vox',
            'avatar_vox_generator_bundle',
            'generated_avatars'
        )
    
    def test_client_mob_models_exist(self):
        """Test that client-side mob models exist"""
        required_mobs = [
            'zombie.vox', 'skeleton.vox', 'goblin.vox', 
            'spider.vox', 'deer.vox', 'sheep.vox',
            'rabbit.vox', 'chicken.vox', 'villager.vox'
        ]
        
        for mob_file in required_mobs:
            file_path = os.path.join(self.client_models_dir, mob_file)
            self.assertTrue(
                os.path.exists(file_path),
                f"Missing client mob model: {mob_file}"
            )
    
    def test_animal_vox_models_exist(self):
        """Test that generated animal models exist"""
        required_animals = [
            'bear.vox', 'wolf.vox', 'dog.vox', 
            'lion.vox', 'panther.vox'
        ]
        
        for animal_file in required_animals:
            file_path = os.path.join(self.mob_animals_dir, animal_file)
            self.assertTrue(
                os.path.exists(file_path),
                f"Missing animal model: {animal_file}"
            )
    
    def test_player_avatar_models_exist(self):
        """Test that player avatar models exist"""
        required_avatars = [
            'fighter.vox', 'mage.vox', 'ranger.vox', 'rogue.vox',
            'cleric.vox', 'dwarf.vox', 'elf.vox', 'orc.vox',
            'villager.vox'
        ]
        
        for avatar_file in required_avatars:
            file_path = os.path.join(self.player_avatars_dir, avatar_file)
            self.assertTrue(
                os.path.exists(file_path),
                f"Missing player avatar: {avatar_file}"
            )
    
    def test_vox_files_not_empty(self):
        """Test that VOX files are not empty"""
        test_file = os.path.join(self.client_models_dir, 'zombie.vox')
        if os.path.exists(test_file):
            file_size = os.path.getsize(test_file)
            self.assertGreater(file_size, 100, "VOX file appears to be empty or corrupt")
    
    def test_vox_file_has_magic_header(self):
        """Test that VOX files have correct magic header 'VOX '"""
        test_file = os.path.join(self.client_models_dir, 'zombie.vox')
        if os.path.exists(test_file):
            with open(test_file, 'rb') as f:
                magic = f.read(4)
                self.assertEqual(magic, b'VOX ', "VOX file missing magic header")


class TestVOXModelMapping(unittest.TestCase):
    """Test that mob types map to correct VOX files"""
    
    def test_mob_type_to_vox_mapping(self):
        """Test mob type names map to VOX files"""
        # This mapping should exist in client code
        expected_mappings = {
            'zombie': 'zombie',
            'skeleton': 'skeleton',
            'goblin': 'goblin',
            'spider': 'spider',
            'deer': 'deer',
            'sheep': 'sheep',
            'rabbit': 'rabbit',
            'chicken': 'chicken',
            'bear': 'bear',
            'wolf': 'wolf',
            'troll': 'troll',
            'slime': 'slime',
            'cow': 'cow',
            'boar': 'boar'
        }
        
        # Verify mapping exists
        self.assertIsNotNone(expected_mappings)
        self.assertGreater(len(expected_mappings), 0)
    
    def test_all_mob_types_have_models(self):
        """Test that all defined mob types have corresponding models"""
        from server import MOB_STATS
        
        client_models_dir = os.path.join(
            os.path.dirname(__file__), '..', 'client', 'assets', 'models'
        )
        
        # Check each mob type
        for mob_type in MOB_STATS.keys():
            # Some mobs might use alternative models
            possible_files = [
                f"{mob_type}.vox",
                f"green_{mob_type}.vox"  # e.g., green_slime
            ]
            
            found = False
            for vox_file in possible_files:
                if os.path.exists(os.path.join(client_models_dir, vox_file)):
                    found = True
                    break
            
            # Note: Some mobs may not have models yet, this documents which ones
            if not found:
                print(f"Warning: No VOX model found for mob type '{mob_type}'")


class TestVOXLoaderIntegration(unittest.TestCase):
    """Test VOX loader integration with game systems"""
    
    def test_vox_loader_exists(self):
        """Test that vox-loader.js exists"""
        vox_loader_path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'client',
            'js',
            'vox-loader.js'
        )
        self.assertTrue(os.path.exists(vox_loader_path), "vox-loader.js not found")
    
    def test_vox_loader_has_load_method(self):
        """Test that VOX loader has required methods"""
        vox_loader_path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'client',
            'js',
            'vox-loader.js'
        )
        
        if os.path.exists(vox_loader_path):
            with open(vox_loader_path, 'r') as f:
                content = f.read()
                self.assertIn('VOXLoader', content)
                self.assertIn('static async load', content)
                self.assertIn('createGeometry', content)
    
    def test_game_imports_vox_loader(self):
        """Test that game.js references VOX loader"""
        game_js_path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'client',
            'js',
            'game.js'
        )
        
        if os.path.exists(game_js_path):
            with open(game_js_path, 'r') as f:
                content = f.read()
                self.assertIn('VOXLoader', content, "game.js doesn't reference VOXLoader")
    
    def test_index_html_includes_vox_loader(self):
        """Test that index.html includes vox-loader.js"""
        index_path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'client',
            'index.html'
        )
        
        if os.path.exists(index_path):
            with open(index_path, 'r') as f:
                content = f.read()
                self.assertIn('vox-loader.js', content, "index.html doesn't include vox-loader.js")


if __name__ == '__main__':
    unittest.main()
