#!/bin/bash
# Generate missing VOX models for the game

cd "$(dirname "$0")"

echo "Generating spider..."
python3 entity_vox_generator.py --family arachnid --preset spider --out ../client/assets/models --json

echo "Generating chicken..."
python3 entity_vox_generator.py --family avian --preset chicken --out ../client/assets/models --json

echo "Generating deer..."
python3 entity_vox_generator.py --family quadruped --preset deer --out ../client/assets/models --json

echo "Generating rabbit..."
python3 entity_vox_generator.py --family hopper --preset rabbit --out ../client/assets/models --json

echo "Generating skeleton..."
python3 entity_vox_generator.py --family biped --preset skeleton --out ../client/assets/models --json

echo "Done! Generated models:"
ls -lh ../client/assets/models/*.vox
