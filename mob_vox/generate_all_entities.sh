#!/bin/bash

# Generate all entity models for the Voxel MMO using the new family structure

echo "Generating entity models..."

# Create output directory
mkdir -p ../client/assets/models

# Generate biped entities (zombie, skeleton, goblin, troll)
python entity_vox_generator.py --family biped --preset zombie --out ../client/assets/models --json
python entity_vox_generator.py --family biped --preset skeleton --out ../client/assets/models --json
python entity_vox_generator.py --family biped --preset goblin --out ../client/assets/models --json
python entity_vox_generator.py --family biped --preset troll --out ../client/assets/models --json

# Generate quadruped entities (wolf, deer, sheep, cow, boar, bear)
python entity_vox_generator.py --family quadruped --preset wolf --out ../client/assets/models --json
python entity_vox_generator.py --family quadruped --preset deer --out ../client/assets/models --json
python entity_vox_generator.py --family quadruped --preset sheep --out ../client/assets/models --json
python entity_vox_generator.py --family quadruped --preset cow --out ../client/assets/models --json
python entity_vox_generator.py --family quadruped --preset boar --out ../client/assets/models --json
python entity_vox_generator.py --family quadruped --preset bear --out ../client/assets/models --json

# Generate blob entities (slime)
python entity_vox_generator.py --family blob --preset green_slime --out ../client/assets/models --json
python entity_vox_generator.py --family blob --preset toxic_slime --out ../client/assets/models --json

# Generate arachnid entities (spider)
python entity_vox_generator.py --family arachnid --preset spider --out ../client/assets/models --json

# Generate avian entities (chicken)
python entity_vox_generator.py --family avian --preset chicken --out ../client/assets/models --json

# Generate hopper entities (rabbit)
python entity_vox_generator.py --family hopper --preset rabbit --out ../client/assets/models --json

echo "Done! Models generated in ../client/assets/models/"
