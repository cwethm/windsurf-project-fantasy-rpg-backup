#!/usr/bin/env python3
"""Validate worldgen prefab manifest and schematic files."""

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple


REPO_ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = REPO_ROOT / "worldgen" / "content"
PREFAB_MANIFEST = CONTENT_ROOT / "prefabs" / "site_prefabs.json"
SCHEMATICS_DIR = CONTENT_ROOT / "schematics"


class ValidationError(Exception):
    pass


def load_json(path: Path) -> Dict:
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError as exc:
        raise ValidationError(f"Missing file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValidationError(f"Invalid JSON in {path}: {exc}") from exc

    if not isinstance(data, dict):
        raise ValidationError(f"Top-level JSON object expected in {path}")
    return data


def validate_schematic(path: Path) -> List[str]:
    errors: List[str] = []
    data = load_json(path)

    schematic_id = data.get("id")
    if not isinstance(schematic_id, str) or not schematic_id:
        errors.append(f"{path}: 'id' must be non-empty string")

    origin = data.get("origin")
    if not isinstance(origin, list) or len(origin) != 3 or not all(isinstance(v, int) for v in origin):
        errors.append(f"{path}: 'origin' must be [int, int, int]")

    blocks = data.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        errors.append(f"{path}: 'blocks' must be a non-empty array")
    else:
        for i, block in enumerate(blocks):
            if not isinstance(block, dict):
                errors.append(f"{path}: blocks[{i}] must be object")
                continue
            for key in ("x", "y", "z", "id"):
                if key not in block:
                    errors.append(f"{path}: blocks[{i}] missing '{key}'")
                    continue
                if not isinstance(block[key], int):
                    errors.append(f"{path}: blocks[{i}].{key} must be int")
            if isinstance(block.get("id"), int) and block["id"] < 0:
                errors.append(f"{path}: blocks[{i}].id must be >= 0")

    return errors


def validate_room_schematic(path: Path) -> List[str]:
    errors: List[str] = []
    data = load_json(path)

    if data.get("category") != "room":
        errors.append(f"{path}: room schematic must set category='room'")

    connectors = data.get("connectors")
    if not isinstance(connectors, list) or not connectors:
        errors.append(f"{path}: room schematic requires non-empty 'connectors' array")
        return errors

    valid_directions = {"north", "south", "east", "west", "up", "down"}
    for i, connector in enumerate(connectors):
        if not isinstance(connector, dict):
            errors.append(f"{path}: connectors[{i}] must be object")
            continue

        for key in ("x", "y", "z", "direction", "connector_type"):
            if key not in connector:
                errors.append(f"{path}: connectors[{i}] missing '{key}'")

        for key in ("x", "y", "z"):
            if key in connector and not isinstance(connector[key], int):
                errors.append(f"{path}: connectors[{i}].{key} must be int")

        direction = connector.get("direction")
        if not isinstance(direction, str) or direction not in valid_directions:
            errors.append(f"{path}: connectors[{i}].direction invalid")

        connector_type = connector.get("connector_type")
        if not isinstance(connector_type, str) or not connector_type:
            errors.append(f"{path}: connectors[{i}].connector_type must be non-empty string")

    return errors


def extract_room_assembly_refs(path: Path) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    room_ids: List[str] = []

    data = load_json(path)
    room_assembly = data.get("room_assembly")
    if room_assembly is None:
        return errors, room_ids
    if not isinstance(room_assembly, dict):
        errors.append(f"{path}: room_assembly must be object")
        return errors, room_ids

    raw_room_ids = room_assembly.get("room_ids", [])
    if not isinstance(raw_room_ids, list) or not raw_room_ids:
        errors.append(f"{path}: room_assembly.room_ids must be a non-empty array")
    else:
        for i, room_id in enumerate(raw_room_ids):
            if not isinstance(room_id, str) or not room_id:
                errors.append(f"{path}: room_assembly.room_ids[{i}] must be non-empty string")
                continue
            room_ids.append(room_id)

    start_room_id = room_assembly.get("start_room_id")
    if start_room_id is not None:
        if not isinstance(start_room_id, str) or not start_room_id:
            errors.append(f"{path}: room_assembly.start_room_id must be non-empty string when provided")
        elif start_room_id not in room_ids:
            errors.append(f"{path}: room_assembly.start_room_id must be present in room_assembly.room_ids")

    room_count = room_assembly.get("room_count", 1)
    if not isinstance(room_count, int) or room_count < 1:
        errors.append(f"{path}: room_assembly.room_count must be int >= 1")

    connector_type = room_assembly.get("connector_type", "door")
    if not isinstance(connector_type, str) or not connector_type:
        errors.append(f"{path}: room_assembly.connector_type must be non-empty string")

    connector_types = room_assembly.get("connector_types")
    if connector_types is not None:
        if not isinstance(connector_types, list) or not connector_types:
            errors.append(f"{path}: room_assembly.connector_types must be non-empty array when provided")
        else:
            for i, value in enumerate(connector_types):
                if not isinstance(value, str) or not value:
                    errors.append(f"{path}: room_assembly.connector_types[{i}] must be non-empty string")

    return errors, room_ids


def validate_manifest(path: Path) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    referenced_ids: List[str] = []

    data = load_json(path)
    site_prefabs = data.get("site_prefabs")
    if not isinstance(site_prefabs, dict):
        errors.append(f"{path}: 'site_prefabs' must be object")
        return errors, referenced_ids

    for site_type, entries in site_prefabs.items():
        if not isinstance(site_type, str):
            errors.append(f"{path}: site type keys must be strings")
            continue
        if not isinstance(entries, list):
            errors.append(f"{path}: site_prefabs['{site_type}'] must be array")
            continue

        for i, entry in enumerate(entries):
            if not isinstance(entry, dict):
                errors.append(f"{path}: {site_type}[{i}] must be object")
                continue

            prefab_id = entry.get("prefab_id")
            if not isinstance(prefab_id, str) or not prefab_id:
                errors.append(f"{path}: {site_type}[{i}].prefab_id must be non-empty string")
            else:
                referenced_ids.append(prefab_id)

            weight = entry.get("weight", 1)
            if not isinstance(weight, int) or weight < 1:
                errors.append(f"{path}: {site_type}[{i}].weight must be int >= 1")

    return errors, referenced_ids


def main() -> int:
    errors: List[str] = []
    referenced_room_ids: List[str] = []

    manifest_errors, referenced_ids = validate_manifest(PREFAB_MANIFEST)
    errors.extend(manifest_errors)

    for prefab_id in sorted(set(referenced_ids)):
        schematic_path = SCHEMATICS_DIR / f"{prefab_id}.json"
        if not schematic_path.exists():
            errors.append(f"Missing schematic for prefab_id '{prefab_id}': {schematic_path}")
            continue
        errors.extend(validate_schematic(schematic_path))
        room_assembly_errors, room_ids = extract_room_assembly_refs(schematic_path)
        errors.extend(room_assembly_errors)
        referenced_room_ids.extend(room_ids)

    for room_id in sorted(set(referenced_room_ids)):
        room_path = SCHEMATICS_DIR / f"{room_id}.json"
        if not room_path.exists():
            errors.append(f"Missing room schematic for room_id '{room_id}': {room_path}")
            continue
        errors.extend(validate_schematic(room_path))
        errors.extend(validate_room_schematic(room_path))

    if not errors:
        print("Prefab validation passed.")
        return 0

    print("Prefab validation failed:")
    for error in errors:
        print(f"- {error}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
