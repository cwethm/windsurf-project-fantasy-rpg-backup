"""
Prefab and schematic loading helpers for data-driven worldgen content.
"""

import hashlib
import json
import os
import random
from typing import Any, Dict, List, Optional


class PrefabLibrary:
    """Loads site prefab manifests and schematic definitions from JSON files."""

    def __init__(self, root_dir: Optional[str] = None):
        placement_dir = os.path.dirname(__file__)
        default_root = os.path.normpath(os.path.join(placement_dir, "..", "content"))
        self.root_dir = root_dir or default_root
        self.prefab_manifest_path = os.path.join(self.root_dir, "prefabs", "site_prefabs.json")
        self.schematics_dir = os.path.join(self.root_dir, "schematics")

        self._manifest_cache: Optional[Dict[str, Any]] = None
        self._schematic_cache: Dict[str, Dict[str, Any]] = {}

    def _load_json_file(self, file_path: str) -> Optional[Dict[str, Any]]:
        if not os.path.exists(file_path):
            return None

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError):
            return None

        if not isinstance(data, dict):
            return None

        return data

    def get_manifest(self) -> Dict[str, Any]:
        if self._manifest_cache is None:
            self._manifest_cache = self._load_json_file(self.prefab_manifest_path) or {}
        return self._manifest_cache

    def get_site_prefab_entries(self, site_type: str) -> List[Dict[str, Any]]:
        manifest = self.get_manifest()
        site_prefabs = manifest.get("site_prefabs", {})
        entries = site_prefabs.get(site_type, [])
        if not isinstance(entries, list):
            return []

        cleaned: List[Dict[str, Any]] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            prefab_id = entry.get("prefab_id")
            if not isinstance(prefab_id, str) or not prefab_id:
                continue
            weight = entry.get("weight", 1)
            try:
                weight_int = int(weight)
            except (TypeError, ValueError):
                weight_int = 1
            cleaned.append({
                "prefab_id": prefab_id,
                "weight": max(1, weight_int),
                "tags": entry.get("tags", []),
            })

        return cleaned

    def choose_site_prefab_id(self, site_type: str, seed_key: str) -> Optional[str]:
        entries = self.get_site_prefab_entries(site_type)
        if not entries:
            return None

        weighted_ids: List[str] = []
        for entry in entries:
            weighted_ids.extend([entry["prefab_id"]] * entry["weight"])

        if not weighted_ids:
            return None

        stable_seed = self._stable_seed(seed_key)
        rng = random.Random(stable_seed)
        return rng.choice(weighted_ids)

    def get_schematic(self, prefab_id: str) -> Optional[Dict[str, Any]]:
        if prefab_id in self._schematic_cache:
            return self._schematic_cache[prefab_id]

        schematic_path = os.path.join(self.schematics_dir, f"{prefab_id}.json")
        schematic = self._load_json_file(schematic_path)
        if schematic is None:
            return None

        self._schematic_cache[prefab_id] = schematic
        return schematic

    @staticmethod
    def _stable_seed(seed_key: str) -> int:
        digest = hashlib.sha256(seed_key.encode("utf-8")).hexdigest()
        return int(digest[:16], 16)
