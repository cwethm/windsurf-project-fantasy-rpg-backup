# Worldgen Content Pipeline

This folder is the contributor-facing content pipeline for authored world-generation assets.

## Goals
- Let human contributors add worldgen content without editing Python code.
- Keep data deterministic and safe for procedural placement.
- Support authored VOX assets, building schematics, and room schematics.

## Folder Layout
- `prefabs/` - site-level prefab manifests (what can spawn for each site type).
- `schematics/` - block-level placed structures consumed by worldgen.
- `schemas/` - JSON schema references for contributor files.
- `templates/` - starter templates for creating new content.
- `vox_assets/` - VOX source files and metadata manifests.

## Content Types

### 1) Site Prefab Manifest
- File: `prefabs/site_prefabs.json`
- Purpose: map site type (`village`, `fort`, `ruins`, `lair`, etc.) to weighted schematic IDs.
- Used by: `worldgen/placement/prefab_library.py`.

### 2) Schematic Files
- File pattern: `schematics/<prefab_id>.json`
- Purpose: define placed blocks and anchor origin for worldgen placement.
- Required fields:
  - `id` (string)
  - `origin` ([x, y, z]) local anchor in schematic coordinates
  - `blocks` (list of `{x, y, z, id}`)
- Optional fields:
  - `category`, `site_types`, `size`, `tags`, `metadata`

### 3) VOX Asset Manifests
- Purpose: track authored `.vox` files used by structures, props, and decor.
- Recommended location: `vox_assets/<asset_name>.json`
- Include source author, license, scale, and usage tags.

## Authoring Rules
- Keep block IDs aligned with server constants.
- Keep schematic bounds compact and centered around `origin`.
- Use `id: 0` only when needed for explicit clear operations in future systems.
- Prefer metadata tags (`biome`, `faction`, `rarity`) over hardcoding logic in Python.

## Validation
Run from repo root:

```bash
python3 tools/validate_prefabs.py
```

The validator checks manifest structure and basic schematic correctness.

## Integration Path
- Site selection: `worldgen/layers/sites.py` chooses site type.
- Prefab selection: `PrefabLibrary.choose_site_prefab_id` picks deterministic prefab ID.
- Placement: schematic blocks are stamped into chunk block arrays.
- Fallback: if missing/invalid data, legacy procedural site generation still runs.
