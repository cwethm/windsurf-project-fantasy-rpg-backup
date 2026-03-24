"""Room module assembly for connector-driven interior generation."""

import random
from typing import Any, Callable, Dict, List, Tuple

from .prefab_library import PrefabLibrary


class RoomAssembler:
    """Assemble room schematics by matching connector sockets."""

    DIRECTION_VECTORS = {
        "north": (0, 0, -1),
        "south": (0, 0, 1),
        "east": (1, 0, 0),
        "west": (-1, 0, 0),
        "up": (0, 1, 0),
        "down": (0, -1, 0),
    }

    OPPOSITE_DIRECTIONS = {
        "north": "south",
        "south": "north",
        "east": "west",
        "west": "east",
        "up": "down",
        "down": "up",
    }

    def __init__(self, prefab_library: PrefabLibrary):
        self.prefab_library = prefab_library

    def assemble(
        self,
        result: Any,
        anchor_x: int,
        anchor_y: int,
        anchor_z: int,
        room_assembly: Dict[str, Any],
        seed_key: str,
        place_schematic: Callable[[Any, int, int, int, Dict[str, Any]], bool],
    ) -> List[Dict[str, Any]]:
        room_ids = room_assembly.get("room_ids", [])
        if not isinstance(room_ids, list):
            return []

        clean_room_ids = [room_id for room_id in room_ids if isinstance(room_id, str) and room_id]
        if not clean_room_ids:
            return []

        room_count = room_assembly.get("room_count", 1)
        try:
            room_count = int(room_count)
        except (TypeError, ValueError):
            room_count = 1
        room_count = max(1, min(room_count, 8))

        connector_types = self._get_allowed_connector_types(room_assembly)

        rng = random.Random(PrefabLibrary._stable_seed(seed_key))
        placements: List[Dict[str, Any]] = []
        open_connectors: List[Dict[str, Any]] = []

        start_room_id = room_assembly.get("start_room_id")
        if isinstance(start_room_id, str) and start_room_id in clean_room_ids:
            start_room = self._load_room(start_room_id)
        else:
            start_room = self._load_room(rng.choice(clean_room_ids))
        if not start_room:
            return []

        if not place_schematic(result, anchor_x, anchor_y, anchor_z, start_room):
            return []

        start_placement = self._build_placement(start_room, anchor_x, anchor_y, anchor_z)
        if not start_placement:
            return []

        placements.append(start_placement)
        open_connectors.extend(start_placement["connectors"])

        for _ in range(1, room_count):
            next_placement = self._place_next_room(
                result=result,
                clean_room_ids=clean_room_ids,
                open_connectors=open_connectors,
                rng=rng,
                allowed_connector_types=connector_types,
                place_schematic=place_schematic,
            )
            if not next_placement:
                break
            placements.append(next_placement)

        return [
            {
                "room_id": placement["room_id"],
                "x": placement["anchor"][0],
                "y": placement["anchor"][1],
                "z": placement["anchor"][2],
            }
            for placement in placements
        ]

    def _place_next_room(
        self,
        result: Any,
        clean_room_ids: List[str],
        open_connectors: List[Dict[str, Any]],
        rng: random.Random,
        allowed_connector_types: List[str],
        place_schematic: Callable[[Any, int, int, int, Dict[str, Any]], bool],
    ) -> Dict[str, Any]:
        if not open_connectors:
            return {}

        candidate_connectors = open_connectors[:]
        rng.shuffle(candidate_connectors)

        for connector in candidate_connectors:
            connector_type = connector.get("connector_type")
            if not isinstance(connector_type, str) or connector_type not in allowed_connector_types:
                continue

            outgoing_dir = connector["direction"]
            needed_dir = self.OPPOSITE_DIRECTIONS.get(outgoing_dir)
            if not needed_dir:
                continue

            candidate_room_ids = clean_room_ids[:]
            rng.shuffle(candidate_room_ids)
            for room_id in candidate_room_ids:
                room = self._load_room(room_id)
                if not room:
                    continue

                matching_connectors = self._matching_room_connectors(
                    room,
                    needed_dir,
                    connector_type,
                    allowed_connector_types,
                )
                if not matching_connectors:
                    continue

                rng.shuffle(matching_connectors)
                for room_connector in matching_connectors:
                    target_x, target_y, target_z = self._target_position_from_connector(connector)
                    anchor_x, anchor_y, anchor_z = self._anchor_from_room_connector(
                        room,
                        room_connector,
                        target_x,
                        target_y,
                        target_z,
                    )

                    if not place_schematic(result, anchor_x, anchor_y, anchor_z, room):
                        continue

                    placement = self._build_placement(room, anchor_x, anchor_y, anchor_z)
                    if not placement:
                        continue

                    self._remove_used_connector(open_connectors, connector)
                    for placed_connector in placement["connectors"]:
                        if self._connector_same_position(placed_connector, target_x, target_y, target_z):
                            continue
                        open_connectors.append(placed_connector)

                    return placement

        return {}

    def _load_room(self, room_id: str) -> Dict[str, Any]:
        room = self.prefab_library.get_schematic(room_id)
        if not room or room.get("category") != "room":
            return {}
        if not isinstance(room.get("connectors"), list):
            return {}
        return room

    @staticmethod
    def _get_allowed_connector_types(room_assembly: Dict[str, Any]) -> List[str]:
        connector_types = room_assembly.get("connector_types")
        if isinstance(connector_types, list):
            cleaned = [value for value in connector_types if isinstance(value, str) and value]
            if cleaned:
                return cleaned

        connector_type = room_assembly.get("connector_type", "door")
        if isinstance(connector_type, str) and connector_type:
            return [connector_type]
        return ["door"]

    def _matching_room_connectors(
        self,
        room: Dict[str, Any],
        direction: str,
        connector_type: str,
        allowed_connector_types: List[str],
    ) -> List[Dict[str, Any]]:
        candidates: List[Dict[str, Any]] = []
        for connector in room.get("connectors", []):
            if not isinstance(connector, dict):
                continue
            if connector.get("direction") != direction:
                continue
            if connector.get("connector_type") != connector_type:
                continue
            if connector_type not in allowed_connector_types:
                continue
            try:
                int(connector.get("x"))
                int(connector.get("y"))
                int(connector.get("z"))
            except (TypeError, ValueError):
                continue
            candidates.append(connector)
        return candidates

    def _build_placement(self, room: Dict[str, Any], anchor_x: int, anchor_y: int, anchor_z: int) -> Dict[str, Any]:
        origin = room.get("origin", [0, 0, 0])
        if not isinstance(origin, list) or len(origin) != 3:
            return {}

        try:
            ox, oy, oz = int(origin[0]), int(origin[1]), int(origin[2])
        except (TypeError, ValueError):
            return {}

        base_x = anchor_x - ox
        base_y = anchor_y - oy
        base_z = anchor_z - oz

        world_connectors = []
        for connector in room.get("connectors", []):
            if not isinstance(connector, dict):
                continue
            try:
                cx = int(connector.get("x"))
                cy = int(connector.get("y"))
                cz = int(connector.get("z"))
            except (TypeError, ValueError):
                continue
            direction = connector.get("direction")
            connector_type = connector.get("connector_type")
            if direction not in self.DIRECTION_VECTORS:
                continue
            if not isinstance(connector_type, str) or not connector_type:
                continue
            world_connectors.append(
                {
                    "x": base_x + cx,
                    "y": base_y + cy,
                    "z": base_z + cz,
                    "direction": direction,
                    "connector_type": connector_type,
                }
            )

        return {
            "room_id": room.get("id"),
            "anchor": (anchor_x, anchor_y, anchor_z),
            "connectors": world_connectors,
        }

    def _target_position_from_connector(self, connector: Dict[str, Any]) -> Tuple[int, int, int]:
        dx, dy, dz = self.DIRECTION_VECTORS[connector["direction"]]
        return connector["x"] + dx, connector["y"] + dy, connector["z"] + dz

    def _anchor_from_room_connector(
        self,
        room: Dict[str, Any],
        room_connector: Dict[str, Any],
        target_x: int,
        target_y: int,
        target_z: int,
    ) -> Tuple[int, int, int]:
        origin = room.get("origin", [0, 0, 0])
        ox, oy, oz = int(origin[0]), int(origin[1]), int(origin[2])
        rcx = int(room_connector["x"])
        rcy = int(room_connector["y"])
        rcz = int(room_connector["z"])

        base_x = target_x - rcx
        base_y = target_y - rcy
        base_z = target_z - rcz

        return base_x + ox, base_y + oy, base_z + oz

    @staticmethod
    def _remove_used_connector(open_connectors: List[Dict[str, Any]], used_connector: Dict[str, Any]):
        for i, connector in enumerate(open_connectors):
            if (
                connector.get("x") == used_connector.get("x")
                and connector.get("y") == used_connector.get("y")
                and connector.get("z") == used_connector.get("z")
                and connector.get("direction") == used_connector.get("direction")
                and connector.get("connector_type") == used_connector.get("connector_type")
            ):
                del open_connectors[i]
                return

    @staticmethod
    def _connector_same_position(connector: Dict[str, Any], x: int, y: int, z: int) -> bool:
        return connector.get("x") == x and connector.get("y") == y and connector.get("z") == z
