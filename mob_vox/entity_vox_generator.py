#!/usr/bin/env python3
"""
Unified Entity Voxel Generator for Voxel MMO - Refactored

Generates voxel models for multiple entity families based on morphological types:
- Biped (zombie, skeleton, goblin, troll)
- Quadruped (wolf, deer, sheep, cow, boar, bear)
- Blob (slime)
- Arachnid (spider)
- Avian (chicken)
- Hopper (rabbit)

Usage:
    python entity_vox_generator.py --family biped --preset zombie --out ./generated
    python entity_vox_generator.py --family quadruped --preset wolf --out ./generated
    python entity_vox_generator.py --family blob --preset green_slime --out ./generated
    python entity_vox_generator.py --list-all
"""
from __future__ import annotations

import argparse
import json
import math
import os
import struct
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

Vec3 = Tuple[int, int, int]
ColorIndex = int
RGBA = Tuple[int, int, int, int]

VOX_VERSION = 150
DEFAULT_SIZE = (32, 32, 32)


# -------------------------
# Palette handling
# -------------------------
def make_palette(color_map: Dict[int, RGBA]) -> List[RGBA]:
    """Convert a color map to a full 256-entry palette."""
    palette: List[RGBA] = [(0, 0, 0, 0)] + [(0, 0, 0, 255)] * 255
    for idx, color in color_map.items():
        if 1 <= idx <= 255:
            palette[idx] = color
    return palette


# Color indices for different parts
PART_COLORS = {
    "skin": 1,
    "clothing_primary": 2,
    "clothing_secondary": 3,
    "clothing_dark": 4,
    "armor": 5,
    "bone": 6,
    "leather": 7,
    "metal": 8,
    "fur": 9,
    "wool": 10,
    "scales": 11,
    "slime_body": 12,
    "slime_core": 13,
    "chitin": 14,
    "feathers": 15,
    "horn": 16,
    "tusk": 17,
    "beak": 18,
}

# -------------------------
# Palettes for different families
# -------------------------
BIPED_SKINS: Dict[str, List[RGBA]] = {
    "zombie_rotting": make_palette({
        PART_COLORS["skin"]: (120, 100, 80, 255),
        PART_COLORS["bone"]: (200, 190, 170, 255),
        PART_COLORS["clothing_primary"]: (60, 50, 40, 255),
        PART_COLORS["clothing_secondary"]: (40, 35, 30, 255),
        PART_COLORS["clothing_dark"]: (20, 20, 20, 255),
        PART_COLORS["armor"]: (80, 80, 90, 255),
    }),
    "skeleton_bone": make_palette({
        PART_COLORS["bone"]: (240, 230, 200, 255),
        PART_COLORS["armor"]: (100, 100, 120, 255),
        PART_COLORS["metal"]: (150, 150, 170, 255),
        PART_COLORS["clothing_dark"]: (40, 40, 40, 255),
    }),
    "goblin_green": make_palette({
        PART_COLORS["skin"]: (90, 120, 60, 255),
        PART_COLORS["leather"]: (101, 67, 33, 255),
        PART_COLORS["metal"]: (120, 120, 130, 255),
        PART_COLORS["clothing_primary"]: (60, 80, 40, 255),
    }),
    "troll_gray": make_palette({
        PART_COLORS["skin"]: (110, 110, 115, 255),
        PART_COLORS["bone"]: (200, 190, 180, 255),
        PART_COLORS["armor"]: (80, 80, 90, 255),
        PART_COLORS["clothing_dark"]: (40, 40, 45, 255),
    }),
    "villager_tan": make_palette({
        PART_COLORS["skin"]: (210, 180, 140, 255),
        PART_COLORS["clothing_primary"]: (139, 90, 43, 255),
        PART_COLORS["clothing_secondary"]: (101, 67, 33, 255),
        PART_COLORS["clothing_dark"]: (61, 43, 31, 255),
        PART_COLORS["leather"]: (101, 67, 33, 255),
    }),
}

QUADRUPED_SKINS: Dict[str, List[RGBA]] = {
    "wolf_gray": make_palette({
        1: (110, 118, 125, 255),
        2: (72, 78, 84, 255),
        3: (190, 195, 198, 255),
        4: (26, 26, 26, 255),
        5: (8, 8, 8, 255),
        6: (140, 140, 145, 255),
        7: (235, 235, 235, 255),
        8: (210, 160, 160, 255),
        9: (250, 250, 250, 255),
        10: (230, 230, 230, 255),
    }),
    "deer_brown": make_palette({
        1: (139, 90, 43, 255),
        2: (101, 67, 33, 255),
        3: (181, 130, 90, 255),
        4: (61, 43, 31, 255),
        5: (31, 25, 15, 255),
        6: (160, 120, 80, 255),
        7: (210, 180, 140, 255),
        8: (200, 180, 160, 255),
        16: (245, 245, 220, 255),  # horns
    }),
    "sheep_white": make_palette({
        1: (240, 240, 240, 255),
        2: (220, 220, 220, 255),
        3: (250, 250, 250, 255),
        4: (180, 180, 180, 255),
        5: (160, 160, 160, 255),
        6: (200, 180, 160, 255),  # skin
        7: (100, 90, 80, 255),    # horns
    }),
    "cow_black_white": make_palette({
        1: (40, 40, 40, 255),
        2: (240, 240, 240, 255),
        3: (200, 200, 200, 255),
        4: (20, 20, 20, 255),
        5: (100, 90, 80, 255),    # horns
        6: (180, 160, 140, 255),  # skin
    }),
    "boar_brown": make_palette({
        1: (101, 67, 33, 255),
        2: (61, 43, 31, 255),
        3: (139, 90, 43, 255),
        4: (31, 25, 15, 255),
        5: (15, 10, 5, 255),
        6: (82, 54, 31, 255),
        7: (214, 181, 131, 255),
        17: (245, 245, 220, 255),  # tusks
    }),
    "bear_brown": make_palette({
        1: (101, 67, 33, 255),
        2: (61, 43, 31, 255),
        3: (139, 90, 43, 255),
        4: (31, 25, 15, 255),
        5: (15, 10, 5, 255),
        6: (82, 54, 31, 255),
        7: (214, 181, 131, 255),
        8: (181, 130, 90, 255),
    }),
}

BLOB_SKINS: Dict[str, List[RGBA]] = {
    "green_slime": make_palette({
        PART_COLORS["slime_body"]: (100, 200, 100, 255),
        PART_COLORS["slime_core"]: (50, 150, 50, 255),
        3: (150, 250, 150, 255),
    }),
    "toxic_slime": make_palette({
        PART_COLORS["slime_body"]: (150, 255, 150, 255),
        PART_COLORS["slime_core"]: (100, 200, 100, 255),
        3: (200, 255, 200, 255),
    }),
}

ARACHNID_SKINS: Dict[str, List[RGBA]] = {
    "spider_black": make_palette({
        1: (40, 40, 45, 255),
        2: (20, 20, 25, 255),
        3: (80, 80, 90, 255),
        4: (200, 200, 210, 255),
    }),
}

AVIAN_SKINS: Dict[str, List[RGBA]] = {
    "chicken_white": make_palette({
        1: (240, 240, 230, 255),
        2: (220, 220, 210, 255),
        3: (250, 250, 240, 255),
        15: (255, 200, 100, 255),  # beak
        4: (200, 100, 100, 255),   # comb/wattles
    }),
}

HOPPER_SKINS: Dict[str, List[RGBA]] = {
    "rabbit_brown": make_palette({
        1: (180, 140, 100, 255),
        2: (140, 100, 60, 255),
        3: (220, 180, 140, 255),
        4: (240, 240, 230, 255),  # tail
    }),
}


# -------------------------
# Entity specifications
# -------------------------
@dataclass
class EntitySpec:
    """Base specification for all entity types."""
    family: str
    name: str
    skin: str
    scale: int = 1
    
    # Metadata for game engine
    attachment_points: Dict[str, Vec3] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    bbox: Tuple[int, int, int] = field(default_factory=lambda: (10, 20, 10))
    eye_height: int = 15


@dataclass
class BipedSpec(EntitySpec):
    """Specification for biped entities (zombie, skeleton, goblin, troll)."""
    height: int = 20
    shoulder_width: int = 6
    torso_depth: int = 3
    arm_length: int = 7
    leg_length: int = 9
    body_mass: int = 2
    posture_slouch: float = 0.0  # 0 = upright, 1 = fully slouched
    limb_thickness: int = 2
    head_size: int = 4
    has_clothing: bool = True
    has_armor: bool = False
    weapon_type: str = "none"
    asymmetry: float = 0.0  # For zombies


@dataclass
class QuadrupedSpec(EntitySpec):
    """Specification for quadruped entities."""
    subfamily: str = "canid"  # canid, ungulate, stocky
    body_length: int = 12
    body_height: int = 5
    body_width: int = 4
    chest_depth: int = 0
    leg_height: int = 5
    leg_thickness: int = 2
    neck_length: int = 2
    head_length: int = 5
    head_height: int = 4
    head_width: int = 4
    muzzle_length: int = 2
    ear_type: str = "pointed"
    tail_type: str = "straight"
    tail_length: int = 6
    has_horns: bool = False
    has_antlers: bool = False
    has_wool: bool = False
    has_tusks: bool = False


@dataclass
class BlobSpec(EntitySpec):
    """Specification for blob entities."""
    radius: int = 4
    vertical_squash: float = 1.0
    wobble_asymmetry: float = 0.0
    has_core: bool = True
    has_eyes: bool = True
    has_spikes: bool = False
    translucency: bool = False


@dataclass
class ArachnidSpec(EntitySpec):
    """Specification for arachnid entities."""
    abdomen_size: int = 4
    thorax_size: int = 3
    leg_length: int = 6
    leg_spread: int = 8
    fang_length: int = 2
    has_eye_cluster: bool = True
    has_hair: bool = False


@dataclass
class AvianSpec(EntitySpec):
    """Specification for avian entities."""
    torso_size: int = 4
    neck_length: int = 2
    beak_type: str = "conical"
    leg_length: int = 3
    tail_feathers: bool = True
    has_comb: bool = True
    has_wattles: bool = True


@dataclass
class HopperSpec(EntitySpec):
    """Specification for hopping entities."""
    body_size: int = 3
    hind_leg_length: int = 5
    fore_leg_length: int = 2
    ear_type: str = "long"
    ear_length: int = 3
    tail_type: str = "bobtail"


# -------------------------
# Presets for each family
# -------------------------
BIPED_PRESETS: Dict[str, BipedSpec] = {
    "zombie": BipedSpec(
        family="biped",
        name="zombie",
        skin="zombie_rotting",
        height=20,
        shoulder_width=7,
        body_mass=3,
        posture_slouch=0.3,
        limb_thickness=3,
        asymmetry=0.4,
        has_clothing=True,
        bbox=(14, 20, 14),
        eye_height=16,
    ),
    "skeleton": BipedSpec(
        family="biped",
        name="skeleton",
        skin="skeleton_bone",
        height=20,
        shoulder_width=5,
        body_mass=1,
        posture_slouch=0.0,
        limb_thickness=1,
        has_clothing=False,
        bbox=(10, 20, 10),
        eye_height=17,
    ),
    "goblin": BipedSpec(
        family="biped",
        name="goblin",
        skin="goblin_green",
        height=14,
        shoulder_width=4,
        body_mass=1,
        posture_slouch=0.4,
        limb_thickness=2,
        head_size=5,
        has_clothing=True,
        bbox=(8, 14, 8),
        eye_height=12,
    ),
    "troll": BipedSpec(
        family="biped",
        name="troll",
        skin="troll_gray",
        height=28,
        shoulder_width=10,
        body_mass=5,
        posture_slouch=0.5,
        limb_thickness=4,
        head_size=7,
        arm_length=10,
        has_clothing=False,
        bbox=(20, 28, 20),
        eye_height=22,
    ),
    "villager": BipedSpec(
        family="biped",
        name="villager",
        skin="villager_tan",
        height=20,
        shoulder_width=6,
        body_mass=2,
        posture_slouch=0.0,
        limb_thickness=2,
        head_size=4,
        has_clothing=True,
        bbox=(12, 20, 12),
        eye_height=16,
    ),
}

QUADRUPED_PRESETS: Dict[str, QuadrupedSpec] = {
    "wolf": QuadrupedSpec(
        family="quadruped",
        name="wolf",
        skin="wolf_gray",
        subfamily="canid",
        body_length=14,
        body_height=5,
        body_width=4,
        chest_depth=1,
        leg_height=6,
        leg_thickness=2,
        neck_length=2,
        head_length=5,
        muzzle_length=3,
        ear_type="pointed",
        tail_type="bushy",
        tail_length=8,
        bbox=(18, 8, 10),
        eye_height=7,
    ),
    "deer": QuadrupedSpec(
        family="quadruped",
        name="deer",
        skin="deer_brown",
        subfamily="ungulate",
        body_length=16,
        body_height=8,
        body_width=4,
        chest_depth=0,
        leg_height=8,
        leg_thickness=2,
        neck_length=4,
        head_length=4,
        muzzle_length=2,
        ear_type="rounded",
        tail_type="short",
        tail_length=3,
        has_antlers=True,
        bbox=(20, 12, 8),
        eye_height=10,
    ),
    "sheep": QuadrupedSpec(
        family="quadruped",
        name="sheep",
        skin="sheep_white",
        subfamily="ungulate",
        body_length=12,
        body_height=6,
        body_width=6,
        chest_depth=0,
        leg_height=4,
        leg_thickness=2,
        neck_length=2,
        head_length=3,
        muzzle_length=1,
        ear_type="rounded",
        tail_type="short",
        tail_length=2,
        has_wool=True,
        bbox=(14, 10, 14),
        eye_height=8,
    ),
    "cow": QuadrupedSpec(
        family="quadruped",
        name="cow",
        skin="cow_black_white",
        subfamily="ungulate",
        body_length=18,
        body_height=10,
        body_width=8,
        chest_depth=2,
        leg_height=6,
        leg_thickness=3,
        neck_length=3,
        head_length=5,
        muzzle_length=2,
        ear_type="rounded",
        tail_type="long",
        tail_length=5,
        has_horns=True,
        bbox=(22, 14, 12),
        eye_height=12,
    ),
    "boar": QuadrupedSpec(
        family="quadruped",
        name="boar",
        skin="boar_brown",
        subfamily="stocky",
        body_length=12,
        body_height=6,
        body_width=6,
        chest_depth=3,
        leg_height=4,
        leg_thickness=3,
        neck_length=2,
        head_length=5,
        muzzle_length=3,
        ear_type="pointed",
        tail_type="short",
        tail_length=2,
        has_tusks=True,
        bbox=(14, 8, 12),
        eye_height=6,
    ),
    "bear": QuadrupedSpec(
        family="quadruped",
        name="bear",
        skin="bear_brown",
        subfamily="stocky",
        body_length=16,
        body_height=8,
        body_width=6,
        chest_depth=3,
        leg_height=5,
        leg_thickness=3,
        neck_length=1,
        head_length=6,
        muzzle_length=2,
        ear_type="rounded",
        tail_type="stub",
        tail_length=2,
        bbox=(18, 10, 10),
        eye_height=9,
    ),
}

BLOB_PRESETS: Dict[str, BlobSpec] = {
    "green_slime": BlobSpec(
        family="blob",
        name="green_slime",
        skin="green_slime",
        radius=4,
        vertical_squash=0.9,
        has_core=True,
        has_eyes=True,
        bbox=(8, 6, 8),
        eye_height=4,
    ),
    "toxic_slime": BlobSpec(
        family="blob",
        name="toxic_slime",
        skin="toxic_slime",
        radius=5,
        vertical_squash=0.85,
        has_core=True,
        has_eyes=True,
        bbox=(10, 8, 10),
        eye_height=5,
    ),
}

ARACHNID_PRESETS: Dict[str, ArachnidSpec] = {
    "spider": ArachnidSpec(
        family="arachnid",
        name="spider",
        skin="spider_black",
        abdomen_size=4,
        thorax_size=3,
        leg_length=6,
        leg_spread=10,
        fang_length=2,
        has_eye_cluster=True,
        bbox=(16, 4, 16),
        eye_height=3,
    ),
}

AVIAN_PRESETS: Dict[str, AvianSpec] = {
    "chicken": AvianSpec(
        family="avian",
        name="chicken",
        skin="chicken_white",
        torso_size=4,
        neck_length=2,
        beak_type="conical",
        leg_length=3,
        tail_feathers=True,
        has_comb=True,
        has_wattles=True,
        bbox=(6, 6, 6),
        eye_height=5,
    ),
}

HOPPER_PRESETS: Dict[str, HopperSpec] = {
    "rabbit": HopperSpec(
        family="hopper",
        name="rabbit",
        skin="rabbit_brown",
        body_size=3,
        hind_leg_length=5,
        fore_leg_length=2,
        ear_type="long",
        ear_length=3,
        tail_type="bobtail",
        bbox=(6, 8, 6),
        eye_height=5,
    ),
}


# -------------------------
# Geometry primitives
# -------------------------
class VoxelModel:
    def __init__(self, size: Vec3 = DEFAULT_SIZE, palette: Optional[List[RGBA]] = None):
        self.size = size
        self.palette = palette or BIPED_SKINS["zombie_rotting"]
        self.voxels: Dict[Vec3, ColorIndex] = {}

    def set_voxel(self, x: int, y: int, z: int, color: int) -> None:
        sx, sy, sz = self.size
        if 0 <= x < sx and 0 <= y < sy and 0 <= z < sz and color > 0:
            self.voxels[(x, y, z)] = color

    def fill_box(self, x1: int, y1: int, z1: int, x2: int, y2: int, z2: int, color: int) -> None:
        for x in range(min(x1, x2), max(x1, x2) + 1):
            for y in range(min(y1, y2), max(y1, y2) + 1):
                for z in range(min(z1, z2), max(z1, z2) + 1):
                    self.set_voxel(x, y, z, color)

    def fill_ellipsoid(self, center: Vec3, radius: Vec3, color: int) -> None:
        cx, cy, cz = center
        rx, ry, rz = radius
        for x in range(int(cx - rx), int(cx + rx) + 1):
            for y in range(int(cy - ry), int(cy + ry) + 1):
                for z in range(int(cz - rz), int(cz + rz) + 1):
                    if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1:
                        self.set_voxel(x, y, z, color)

    def add_line(self, start: Vec3, end: Vec3, color: int, thickness: int = 1) -> None:
        """Add a thick line between two points using 3D Bresenham algorithm."""
        x1, y1, z1 = start
        x2, y2, z2 = end
        
        points = []
        dx = abs(x2 - x1)
        dy = abs(y2 - y1)
        dz = abs(z2 - z1)
        sx = 1 if x1 < x2 else -1
        sy = 1 if y1 < y2 else -1
        sz = 1 if z1 < z2 else -1
        
        # Determine driving axis
        if dx >= dy and dx >= dz:
            # X is driving axis
            err_y = 2 * dy - dx
            err_z = 2 * dz - dx
            while x1 != x2:
                points.append((x1, y1, z1))
                if err_y > 0:
                    y1 += sy
                    err_y -= 2 * dx
                if err_z > 0:
                    z1 += sz
                    err_z -= 2 * dx
                err_y += 2 * dy
                err_z += 2 * dz
                x1 += sx
        elif dy >= dx and dy >= dz:
            # Y is driving axis
            err_x = 2 * dx - dy
            err_z = 2 * dz - dy
            while y1 != y2:
                points.append((x1, y1, z1))
                if err_x > 0:
                    x1 += sx
                    err_x -= 2 * dy
                if err_z > 0:
                    z1 += sz
                    err_z -= 2 * dy
                err_x += 2 * dx
                err_z += 2 * dz
                y1 += sy
        else:
            # Z is driving axis
            err_x = 2 * dx - dz
            err_y = 2 * dy - dz
            while z1 != z2:
                points.append((x1, y1, z1))
                if err_x > 0:
                    x1 += sx
                    err_x -= 2 * dz
                if err_y > 0:
                    y1 += sy
                    err_y -= 2 * dz
                err_x += 2 * dx
                err_y += 2 * dy
                z1 += sz
        
        # Add final point
        points.append((x1, y1, z1))
        
        # Thicken the line
        for px, py, pz in points:
            for dx in range(-thickness//2, thickness//2 + 1):
                for dy in range(-thickness//2, thickness//2 + 1):
                    for dz in range(-thickness//2, thickness//2 + 1):
                        self.set_voxel(px + dx, py + dy, pz + dz, color)


# -------------------------
# Generators for each family
# -------------------------
class BipedGenerator:
    def generate(self, spec: BipedSpec) -> VoxelModel:
        model = VoxelModel(palette=BIPED_SKINS[spec.skin])
        scale = spec.scale
        
        # Center the model
        cx, cy, cz = 16, 10, 16
        
        # Apply slouch to posture
        slouch_offset = int(spec.posture_slouch * 4 * scale)
        
        # Build body parts
        self._build_torso(model, cx, cy, cz, spec, scale)
        self._build_head(model, cx, cy + spec.height//2 * scale - slouch_offset, cz, spec, scale)
        self._build_arms(model, cx, cy, cz, spec, scale)
        self._build_legs(model, cx, cy - spec.leg_length * scale, cz, spec, scale)
        
        # Add asymmetry for zombies
        if spec.asymmetry > 0:
            self._add_asymmetry(model, cx, cy, cz, spec, scale)
        
        return model
    
    def _build_torso(self, model: VoxelModel, x: int, y: int, z: int, spec: BipedSpec, scale: int):
        w = spec.shoulder_width * scale
        d = spec.torso_depth * scale
        h = spec.height // 2 * scale
        
        if spec.has_armor:
            model.fill_box(x - w//2, y, z - d//2, x + w//2, y + h, z + d//2, PART_COLORS["armor"])
        elif spec.has_clothing:
            model.fill_box(x - w//2, y, z - d//2, x + w//2, y + h, z + d//2, PART_COLORS["clothing_primary"])
        else:
            # Just body/skin
            model.fill_box(x - w//2, y, z - d//2, x + w//2, y + h, z + d//2, PART_COLORS["skin"])
    
    def _build_head(self, model: VoxelModel, x: int, y: int, z: int, spec: BipedSpec, scale: int):
        head_size = spec.head_size * scale
        
        if spec.skin == "skeleton_bone":
            # Skull shape
            model.fill_ellipsoid((x, y, z), (head_size//2, head_size//2, head_size//2), PART_COLORS["bone"])
            # Eye sockets
            model.set_voxel(x - 1, y, z - head_size//2 + 1, 0)
            model.set_voxel(x + 1, y, z - head_size//2 + 1, 0)
        else:
            # Normal head
            model.fill_ellipsoid((x, y, z), (head_size//2, head_size//2, head_size//2), PART_COLORS["skin"])
    
    def _build_arms(self, model: VoxelModel, x: int, y: int, z: int, spec: BipedSpec, scale: int):
        t = spec.limb_thickness * scale
        arm_y = y + spec.height // 3 * scale
        
        # Left arm
        if spec.skin == "skeleton_bone":
            model.add_line((x - spec.shoulder_width * scale, arm_y, z), 
                          (x - spec.shoulder_width * scale - spec.arm_length * scale, y, z), 
                          PART_COLORS["bone"], t)
        else:
            model.fill_box(x - spec.shoulder_width * scale, arm_y, z - t,
                          x - spec.shoulder_width * scale + t, y + spec.arm_length * scale, 
                          z + t, PART_COLORS["skin"])
        
        # Right arm
        if spec.skin == "skeleton_bone":
            model.add_line((x + spec.shoulder_width * scale, arm_y, z), 
                          (x + spec.shoulder_width * scale + spec.arm_length * scale, y, z), 
                          PART_COLORS["bone"], t)
        else:
            model.fill_box(x + spec.shoulder_width * scale - t, arm_y, z - t,
                          x + spec.shoulder_width * scale, y + spec.arm_length * scale,
                          z + t, PART_COLORS["skin"])
    
    def _build_legs(self, model: VoxelModel, x: int, y: int, z: int, spec: BipedSpec, scale: int):
        t = spec.limb_thickness * scale
        
        if spec.skin == "skeleton_bone":
            # Skeleton legs
            model.add_line((x - 2 * scale, y, z), 
                          (x - 2 * scale, y - spec.leg_length * scale, z), 
                          PART_COLORS["bone"], t)
            model.add_line((x + 2 * scale, y, z), 
                          (x + 2 * scale, y - spec.leg_length * scale, z), 
                          PART_COLORS["bone"], t)
        else:
            # Normal legs
            model.fill_box(x - 2 * scale, y, z - 2 * scale,
                          x, y + spec.leg_length * scale, z + 2 * scale, 
                          PART_COLORS["clothing_primary"] if spec.has_clothing else PART_COLORS["skin"])
            model.fill_box(x, y, z - 2 * scale,
                          x + 2 * scale, y + spec.leg_length * scale, z + 2 * scale, 
                          PART_COLORS["clothing_primary"] if spec.has_clothing else PART_COLORS["skin"])
    
    def _add_asymmetry(self, model: VoxelModel, x: int, y: int, z: int, spec: BipedSpec, scale: int):
        # Add some asymmetrical damage/decay for zombies
        import random
        random.seed(42)  # Fixed seed for consistent results
        
        for _ in range(int(10 * spec.asymmetry)):
            hole_x = x + int((random.random() - 0.5) * spec.shoulder_width * scale)
            hole_y = y + int(random.random() * spec.height * scale)
            hole_z = z + int((random.random() - 0.5) * spec.torso_depth * scale)
            model.set_voxel(hole_x, hole_y, hole_z, 0)


class QuadrupedGenerator:
    def generate(self, spec: QuadrupedSpec) -> VoxelModel:
        model = VoxelModel(palette=QUADRUPED_SKINS[spec.skin])
        scale = spec.scale
        
        # Center the model
        cx, cy, cz = 16, 10, 16
        
        # Body
        body_x = cx - spec.body_length * scale // 2
        body_y = cy
        body_z = cz - spec.body_width * scale // 2
        
        self._build_body(model, body_x, body_y, body_z, spec, scale)
        self._build_legs(model, body_x, body_y, body_z, spec, scale)
        self._build_neck_and_head(model, cx + spec.body_length * scale // 2, body_y, cz, spec, scale)
        self._add_tail(model, body_x, body_y, cz, spec, scale)
        
        # Add special features
        if spec.has_horns or spec.has_antlers:
            self._add_horns(model, cx + spec.body_length * scale // 2, body_y, cz, spec, scale)
        if spec.has_wool:
            self._add_wool(model, body_x, body_y, body_z, spec, scale)
        if spec.has_tusks:
            self._add_tusks(model, cx + spec.body_length * scale // 2, body_y, cz, spec, scale)
        
        return model
    
    def _build_body(self, model: VoxelModel, x: int, y: int, z: int, spec: QuadrupedSpec, scale: int):
        # Adjust body shape based on subfamily
        if spec.subfamily == "ungulate":
            # Longer, leaner body
            model.fill_box(x, y, z, 
                          x + spec.body_length * scale,
                          y + spec.body_height * scale,
                          z + spec.body_width * scale, 1)
        elif spec.subfamily == "stocky":
            # Heavier, broader body
            model.fill_box(x, y - 2 * scale, z, 
                          x + spec.body_length * scale,
                          y + spec.body_height * scale - 2 * scale,
                          z + spec.body_width * scale, 1)
            # Chest bulge
            chest_x = x + spec.body_length * scale // 3
            model.fill_ellipsoid((chest_x, y + spec.body_height * scale // 2, z + spec.body_width * scale // 2),
                                (spec.chest_depth * scale, spec.body_height * scale // 2, spec.body_width * scale // 2),
                                2)
        else:  # canid
            # Standard canid body
            model.fill_box(x, y, z, 
                          x + spec.body_length * scale,
                          y + spec.body_height * scale,
                          z + spec.body_width * scale, 1)
    
    def _build_legs(self, model: VoxelModel, x: int, y: int, z: int, spec: QuadrupedSpec, scale: int):
        leg_positions = [
            (x + spec.body_length * scale // 4, "front_left"),
            (x + spec.body_length * scale // 4, "front_right"),
            (x + 3 * spec.body_length * scale // 4, "back_left"),
            (x + 3 * spec.body_length * scale // 4, "back_right"),
        ]
        
        for leg_x, _ in leg_positions:
            # Left or right offset
            if "left" in _:
                leg_z = z
            else:
                leg_z = z + (spec.body_width - spec.leg_thickness) * scale
            
            # Leg pillar
            model.fill_box(leg_x, y - spec.leg_height * scale, leg_z,
                          leg_x + spec.leg_thickness * scale, y, 
                          leg_z + spec.leg_thickness * scale, 1)
    
    def _build_neck_and_head(self, model: VoxelModel, x: int, y: int, z: int, spec: QuadrupedSpec, scale: int):
        # Neck
        neck_start_x = x - spec.neck_length * scale
        neck_y = y + spec.body_height * scale // 2
        
        model.fill_box(neck_start_x, neck_y, z - spec.head_width * scale // 2,
                      x, neck_y + spec.head_height * scale // 2,
                      z + spec.head_width * scale // 2, 1)
        
        # Head
        head_x = neck_start_x - spec.head_length * scale // 2
        head_y = neck_y + spec.head_height * scale // 2
        
        model.fill_box(head_x, head_y, z - spec.head_width * scale // 2,
                      head_x + spec.head_length * scale, 
                      head_y + spec.head_height * scale,
                      z + spec.head_width * scale // 2, 1)
        
        # Muzzle
        muzzle_x = head_x - spec.muzzle_length * scale
        muzzle_z = z
        model.fill_box(muzzle_x, head_y + spec.head_height * scale // 3,
                      muzzle_z - spec.leg_thickness * scale // 2,
                      head_x, head_y + 2 * spec.head_height * scale // 3,
                      muzzle_z + spec.leg_thickness * scale // 2, 1)
        
        # Ears
        if spec.ear_type == "pointed":
            model.set_voxel(head_x + spec.head_length * scale - 1 * scale, 
                           head_y + spec.head_height * scale, 
                           z - spec.head_width * scale // 2 - 1 * scale, 1)
            model.set_voxel(head_x + spec.head_length * scale - 1 * scale, 
                           head_y + spec.head_height * scale, 
                           z + spec.head_width * scale // 2 + 1 * scale, 1)
        elif spec.ear_type == "floppy":
            model.add_line((head_x + spec.head_length * scale - 1 * scale, 
                           head_y + spec.head_height * scale, 
                           z - spec.head_width * scale // 2),
                          (head_x + spec.head_length * scale - 1 * scale, 
                           head_y + spec.head_height * scale - 2 * scale, 
                           z - spec.head_width * scale // 2 - 2 * scale), 1, 1)
            model.add_line((head_x + spec.head_length * scale - 1 * scale, 
                           head_y + spec.head_height * scale, 
                           z + spec.head_width * scale // 2),
                          (head_x + spec.head_length * scale - 1 * scale, 
                           head_y + spec.head_height * scale - 2 * scale, 
                           z + spec.head_width * scale // 2 + 2 * scale), 1, 1)
    
    def _add_tail(self, model: VoxelModel, x: int, y: int, z: int, spec: QuadrupedSpec, scale: int):
        tail_x = x + spec.body_length * scale
        tail_y = y + spec.body_height * scale // 2
        
        if spec.tail_type == "bushy":
            points = [(tail_x, tail_y, z), (tail_x + spec.tail_length * scale, tail_y - scale, z)]
            for a, b in zip(points, points[1:]):
                model.add_line(a, b, 1, thickness=1)
            # Bushy end
            model.fill_ellipsoid(points[-1], (2 * scale, 1.5 * scale, 1.5 * scale), 2)
        elif spec.tail_type == "short":
            model.add_line((tail_x, tail_y, z), (tail_x + spec.tail_length * scale, tail_y, z), 1, 1)
        else:
            model.add_line((tail_x, tail_y, z), (tail_x + spec.tail_length * scale, tail_y, z), 1, 1)
    
    def _add_horns(self, model: VoxelModel, x: int, y: int, z: int, spec: QuadrupedSpec, scale: int):
        # Add horns to the head
        head_x = x - spec.neck_length * scale - spec.head_length * scale // 2
        head_y = y + spec.body_height * scale // 2 + spec.head_height * scale // 2
        
        if spec.has_antlers:
            # Deer antlers - branched
            model.add_line((head_x, head_y, z - 2 * scale), 
                          (head_x - 2 * scale, head_y + 3 * scale, z - 3 * scale), 
                          PART_COLORS["horn"], 1)
            model.add_line((head_x, head_y, z + 2 * scale), 
                          (head_x - 2 * scale, head_y + 3 * scale, z + 3 * scale), 
                          PART_COLORS["horn"], 1)
        else:
            # Cow horns - simple
            model.add_line((head_x, head_y, z - 2 * scale), 
                          (head_x - 1 * scale, head_y + 2 * scale, z - 2 * scale), 
                          PART_COLORS["horn"], 1)
            model.add_line((head_x, head_y, z + 2 * scale), 
                          (head_x - 1 * scale, head_y + 2 * scale, z + 2 * scale), 
                          PART_COLORS["horn"], 1)
    
    def _add_wool(self, model: VoxelModel, x: int, y: int, z: int, spec: QuadrupedSpec, scale: int):
        # Add wool layer around the body
        model.fill_box(x - 1 * scale, y - 1 * scale, z - 1 * scale,
                      x + spec.body_length * scale + 1 * scale,
                      y + spec.body_height * scale + 1 * scale,
                      z + spec.body_width * scale + 1 * scale, 
                      PART_COLORS["wool"])
    
    def _add_tusks(self, model: VoxelModel, x: int, y: int, z: int, spec: QuadrupedSpec, scale: int):
        # Add tusks to boar's muzzle
        muzzle_x = x - spec.neck_length * scale - spec.head_length * scale - spec.muzzle_length * scale
        muzzle_y = y + spec.body_height * scale // 2 + spec.head_height * scale // 3
        
        model.add_line((muzzle_x, muzzle_y, z - 1 * scale), 
                      (muzzle_x - 2 * scale, muzzle_y, z - 1 * scale), 
                      PART_COLORS["tusk"], 1)
        model.add_line((muzzle_x, muzzle_y, z + 1 * scale), 
                      (muzzle_x - 2 * scale, muzzle_y, z + 1 * scale), 
                      PART_COLORS["tusk"], 1)


class BlobGenerator:
    def generate(self, spec: BlobSpec) -> VoxelModel:
        model = VoxelModel(palette=BLOB_SKINS[spec.skin])
        scale = spec.scale
        
        # Center the model
        cx, cy, cz = 16, 10, 16
        
        # Main body (squashed sphere)
        radius_x = spec.radius * scale
        radius_y = int(radius_x * spec.vertical_squash)
        radius_z = radius_x
        
        model.fill_ellipsoid((cx, cy, cz), (radius_x, radius_y, radius_z), PART_COLORS["slime_body"])
        
        # Add asymmetry for wobble effect
        if spec.wobble_asymmetry > 0:
            import random
            random.seed(42)
            for _ in range(int(5 * spec.wobble_asymmetry)):
                offset_x = int((random.random() - 0.5) * 2 * scale)
                offset_y = int((random.random() - 0.5) * 2 * scale)
                offset_z = int((random.random() - 0.5) * 2 * scale)
                model.set_voxel(cx + offset_x, cy + offset_y, cz + offset_z, PART_COLORS["slime_body"])
        
        # Core
        if spec.has_core:
            core_radius = max(1, radius_x // 2)
            model.fill_ellipsoid((cx, cy, cz), (core_radius, core_radius, core_radius), PART_COLORS["slime_core"])
        
        # Eyes
        if spec.has_eyes:
            eye_y = cy + radius_y // 2
            model.set_voxel(cx - 2 * scale, eye_y, cz - radius_z + 1, PART_COLORS["slime_body"])
            model.set_voxel(cx + 2 * scale, eye_y, cz - radius_z + 1, PART_COLORS["slime_body"])
        
        # Spikes
        if spec.has_spikes:
            for angle in range(0, 360, 45):
                spike_x = cx + int(radius_x * math.cos(math.radians(angle)))
                spike_z = cz + int(radius_z * math.sin(math.radians(angle)))
                model.add_line((spike_x, cy, spike_z), (spike_x, cy + 3 * scale, spike_z), 
                              PART_COLORS["slime_body"], 1)
        
        return model


class ArachnidGenerator:
    def generate(self, spec: ArachnidSpec) -> VoxelModel:
        model = VoxelModel(palette=ARACHNID_SKINS[spec.skin])
        scale = spec.scale
        
        # Center the model
        cx, cy, cz = 16, 10, 16
        
        # Body (thorax + abdomen)
        thorax_x = cx - spec.thorax_size * scale // 2
        thorax_y = cy
        thorax_z = cz - spec.thorax_size * scale // 2
        
        # Thorax
        model.fill_box(thorax_x, thorax_y, thorax_z,
                      thorax_x + spec.thorax_size * scale,
                      thorax_y + spec.thorax_size * scale,
                      thorax_z + spec.thorax_size * scale, 1)
        
        # Abdomen
        abdomen_x = cx + spec.thorax_size * scale // 2
        model.fill_ellipsoid((abdomen_x + spec.abdomen_size * scale // 2, thorax_y, cz),
                            (spec.abdomen_size * scale // 2, spec.abdomen_size * scale // 2, spec.abdomen_size * scale // 2),
                            2)
        
        # Legs (8 legs)
        leg_base_y = thorax_y + spec.thorax_size * scale // 2
        for side in [-1, 1]:
            for i in range(4):
                leg_offset = i * spec.thorax_size * scale // 4
                leg_x = thorax_x + leg_offset
                leg_z = cz + side * (spec.thorax_size * scale // 2)
                
                # Create leg arc
                mid_x = leg_x + side * spec.leg_spread * scale // 2
                end_x = leg_x + side * spec.leg_spread * scale
                end_y = leg_base_y + spec.leg_length * scale
                
                model.add_line((leg_x, leg_base_y, leg_z), 
                              (mid_x, leg_base_y + spec.leg_length * scale // 2, leg_z), 
                              1, 1)
                model.add_line((mid_x, leg_base_y + spec.leg_length * scale // 2, leg_z), 
                              (end_x, end_y, leg_z), 
                              1, 1)
        
        # Fangs
        fang_x = thorax_x - spec.fang_length * scale
        model.add_line((fang_x, thorax_y + spec.thorax_size * scale // 2, cz - 1 * scale), 
                      (fang_x - spec.fang_length * scale, thorax_y + spec.thorax_size * scale // 2, cz - 1 * scale), 
                      3, 1)
        model.add_line((fang_x, thorax_y + spec.thorax_size * scale // 2, cz + 1 * scale), 
                      (fang_x - spec.fang_length * scale, thorax_y + spec.thorax_size * scale // 2, cz + 1 * scale), 
                      3, 1)
        
        # Eye cluster
        if spec.has_eye_cluster:
            for dx in [-1, 0, 1]:
                for dz in [-1, 1]:
                    model.set_voxel(fang_x, thorax_y + spec.thorax_size * scale, cz + dx, 4)
        
        return model


class AvianGenerator:
    def generate(self, spec: AvianSpec) -> VoxelModel:
        model = VoxelModel(palette=AVIAN_SKINS[spec.skin])
        scale = spec.scale
        
        # Center the model
        cx, cy, cz = 16, 10, 16
        
        # Body
        body_x = cx - spec.torso_size * scale // 2
        body_y = cy
        body_z = cz - spec.torso_size * scale // 2
        
        model.fill_ellipsoid((cx, body_y, cz), 
                            (spec.torso_size * scale // 2, spec.torso_size * scale // 2, spec.torso_size * scale // 2),
                            1)
        
        # Neck
        neck_y = body_y + spec.torso_size * scale // 2
        model.fill_box(cx - scale, neck_y, cz - scale,
                      cx + scale, neck_y + spec.neck_length * scale, cz + scale, 1)
        
        # Head
        head_y = neck_y + spec.neck_length * scale
        model.fill_ellipsoid((cx, head_y, cz), (2 * scale, 2 * scale, 2 * scale), 1)
        
        # Beak
        model.fill_box(cx - 2 * scale, head_y, cz - scale,
                      cx - 4 * scale, head_y + scale, cz + scale, PART_COLORS["beak"])
        
        # Legs
        leg_y = body_y - spec.leg_length * scale
        model.fill_box(cx - scale, leg_y, cz - scale,
                      cx, body_y, cz, 1)
        model.fill_box(cx, leg_y, cz - scale,
                      cx + scale, body_y, cz, 1)
        
        # Comb
        if spec.has_comb:
            for dx in [-1, 0, 1]:
                model.set_voxel(cx + dx, head_y + 2 * scale, cz, PART_COLORS["feathers"])
        
        # Wattles
        if spec.has_wattles:
            model.set_voxel(cx - 2 * scale, head_y, cz, PART_COLORS["feathers"])
            model.set_voxel(cx + 2 * scale, head_y, cz, PART_COLORS["feathers"])
        
        # Tail feathers
        if spec.tail_feathers:
            tail_x = cx + spec.torso_size * scale // 2
            for dz in [-2, -1, 0, 1, 2]:
                model.add_line((tail_x, body_y, cz + dz), 
                              (tail_x + 3 * scale, body_y - dz, cz + dz), 
                              PART_COLORS["feathers"], 1)
        
        return model


class HopperGenerator:
    def generate(self, spec: HopperSpec) -> VoxelModel:
        model = VoxelModel(palette=HOPPER_SKINS[spec.skin])
        scale = spec.scale
        
        # Center the model
        cx, cy, cz = 16, 10, 16
        
        # Body
        body_size = spec.body_size * scale
        model.fill_ellipsoid((cx, cy, cz), 
                            (body_size, body_size, body_size),
                            1)
        
        # Head
        head_y = cy + body_size
        model.fill_ellipsoid((cx, head_y, cz), 
                            (body_size // 2, body_size // 2, body_size // 2),
                            1)
        
        # Hind legs (powerful)
        hind_leg_y = cy - spec.hind_leg_length * scale
        model.fill_box(cx - body_size, hind_leg_y, cz - body_size,
                      cx - body_size + scale, cy, cz, 1)
        model.fill_box(cx + body_size - scale, hind_leg_y, cz - body_size,
                      cx + body_size, cy, cz, 1)
        
        # Fore legs (shorter)
        fore_leg_y = cy - spec.fore_leg_length * scale
        model.fill_box(cx - body_size, fore_leg_y, cz + body_size - scale,
                      cx - body_size + scale, cy, cz + body_size, 1)
        model.fill_box(cx + body_size - scale, fore_leg_y, cz + body_size - scale,
                      cx + body_size, cy, cz + body_size, 1)
        
        # Ears
        if spec.ear_type == "long":
            ear_y = head_y + spec.ear_length * scale
            model.add_line((cx - body_size, head_y, cz - body_size), 
                          (cx - body_size - scale, ear_y, cz - body_size - scale), 
                          1, 1)
            model.add_line((cx + body_size, head_y, cz - body_size), 
                          (cx + body_size + scale, ear_y, cz - body_size - scale), 
                          1, 1)
        
        # Tail
        if spec.tail_type == "bobtail":
            model.set_voxel(cx, cy, cz + body_size, PART_COLORS["fur"])
        
        return model


# -------------------------
# Main generator interface
# -------------------------
class EntityVoxGenerator:
    def __init__(self, size: Vec3 = DEFAULT_SIZE):
        self.size = size
        self.biped_gen = BipedGenerator()
        self.quadruped_gen = QuadrupedGenerator()
        self.blob_gen = BlobGenerator()
        self.arachnid_gen = ArachnidGenerator()
        self.avian_gen = AvianGenerator()
        self.hopper_gen = HopperGenerator()
    
    def generate(self, family: str, preset_name: str) -> Tuple[VoxelModel, EntitySpec]:
        """Generate an entity model based on family and preset."""
        if family == "biped":
            if preset_name not in BIPED_PRESETS:
                raise ValueError(f"Unknown biped preset: {preset_name}")
            spec = BIPED_PRESETS[preset_name]
            model = self.biped_gen.generate(spec)
        
        elif family == "quadruped":
            if preset_name not in QUADRUPED_PRESETS:
                raise ValueError(f"Unknown quadruped preset: {preset_name}")
            spec = QUADRUPED_PRESETS[preset_name]
            model = self.quadruped_gen.generate(spec)
        
        elif family == "blob":
            if preset_name not in BLOB_PRESETS:
                raise ValueError(f"Unknown blob preset: {preset_name}")
            spec = BLOB_PRESETS[preset_name]
            model = self.blob_gen.generate(spec)
        
        elif family == "arachnid":
            if preset_name not in ARACHNID_PRESETS:
                raise ValueError(f"Unknown arachnid preset: {preset_name}")
            spec = ARACHNID_PRESETS[preset_name]
            model = self.arachnid_gen.generate(spec)
        
        elif family == "avian":
            if preset_name not in AVIAN_PRESETS:
                raise ValueError(f"Unknown avian preset: {preset_name}")
            spec = AVIAN_PRESETS[preset_name]
            model = self.avian_gen.generate(spec)
        
        elif family == "hopper":
            if preset_name not in HOPPER_PRESETS:
                raise ValueError(f"Unknown hopper preset: {preset_name}")
            spec = HOPPER_PRESETS[preset_name]
            model = self.hopper_gen.generate(spec)
        
        else:
            raise ValueError(f"Unknown entity family: {family}")
        
        return model, spec
    
    def save_vox(self, model: VoxelModel, filepath: Path) -> None:
        """Export model as MagicaVoxel .vox file."""
        # Convert voxels to coordinate list
        voxels = []
        for (x, y, z), color_idx in model.voxels.items():
            voxels.append((x, y, z, color_idx))
        
        # Calculate chunk size
        num_voxels = len(voxels)
        chunk_size = 4 + num_voxels * 4
        
        # Build VOX chunks
        chunks = []
        
        # MAIN chunk
        main_data = b''
        
        # SIZE chunk (content size: 12, child size: 0)
        sx, sy, sz = model.size
        size_chunk = b'SIZE' + struct.pack('<I', 12) + struct.pack('<I', 0) + struct.pack('<iii', sx, sy, sz)
        main_data += size_chunk
        
        # XYZI chunk (voxel data) (child size: 0)
        xyzi_chunk = b'XYZI' + struct.pack('<I', chunk_size) + struct.pack('<I', 0) + struct.pack('<I', num_voxels)
        for x, y, z, color in voxels:
            xyzi_chunk += bytes([x, y, z, color])
        main_data += xyzi_chunk
        
        # RGBA chunk (palette) (child size: 0)
        rgba_chunk = b'RGBA' + struct.pack('<I', 1024) + struct.pack('<I', 0)
        for r, g, b, a in model.palette:
            rgba_chunk += bytes([b, g, r, a])  # BGRA order for MagicaVoxel
        main_data += rgba_chunk
        
        # Wrap in MAIN chunk (content size: 0, child size: len(main_data))
        main_chunk = b'MAIN' + struct.pack('<I', 0) + struct.pack('<I', len(main_data)) + main_data
        
        # File header
        header = b'VOX ' + struct.pack('<I', VOX_VERSION)
        
        # Write file
        with open(filepath, 'wb') as f:
            f.write(header + main_chunk)
    
    def save_json(self, model: VoxelModel, filepath: Path, spec: EntitySpec) -> None:
        """Export model as JSON for debugging."""
        data = {
            'size': model.size,
            'palette': model.palette,
            'voxels': [{'pos': list(pos), 'color': color} for pos, color in model.voxels.items()],
            'metadata': {
                'family': spec.family,
                'preset': spec.name,
                'scale': spec.scale,
                'bbox': spec.bbox,
                'eye_height': spec.eye_height,
                'attachment_points': spec.attachment_points,
                'tags': spec.tags,
            }
        }
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)


# -------------------------
# Command line interface
# -------------------------
def main():
    parser = argparse.ArgumentParser(description='Generate voxel entity models')
    parser.add_argument('--family', choices=['biped', 'quadruped', 'blob', 'arachnid', 'avian', 'hopper'], 
                       help='Entity family to generate')
    parser.add_argument('--preset', help='Preset to generate')
    parser.add_argument('--out', default='./generated_entities', help='Output directory')
    parser.add_argument('--json', action='store_true', help='Also export JSON')
    parser.add_argument('--scale', type=int, help='Override preset scale')
    parser.add_argument('--list-all', action='store_true', help='List all available presets')
    parser.add_argument('--list-family', help='List presets for a specific family')
    
    args = parser.parse_args()
    
    if args.list_all:
        print("Available presets:")
        for family, presets in [
            ("biped", BIPED_PRESETS),
            ("quadruped", QUADRUPED_PRESETS),
            ("blob", BLOB_PRESETS),
            ("arachnid", ARACHNID_PRESETS),
            ("avian", AVIAN_PRESETS),
            ("hopper", HOPPER_PRESETS),
        ]:
            print(f"\n{family.upper()}:")
            for name in sorted(presets.keys()):
                spec = presets[name]
                print(f"  {name}: family={spec.family}, skin={spec.skin}, scale={spec.scale}, bbox={spec.bbox}")
        return
    
    if args.list_family:
        families = {
            'biped': BIPED_PRESETS,
            'quadruped': QUADRUPED_PRESETS,
            'blob': BLOB_PRESETS,
            'arachnid': ARACHNID_PRESETS,
            'avian': AVIAN_PRESETS,
            'hopper': HOPPER_PRESETS,
        }
        if args.list_family in families:
            print(f"{args.list_family.upper()} presets:")
            for name in sorted(families[args.list_family].keys()):
                print(f"  {name}")
        else:
            print(f"Unknown family: {args.list_family}")
        return
    
    if not args.family or not args.preset:
        parser.error("Must specify --family and --preset")
    
    # Create output directory
    out_dir = Path(args.out)
    out_dir.mkdir(exist_ok=True)
    
    # Generate model
    generator = EntityVoxGenerator()
    model, spec = generator.generate(args.family, args.preset)
    
    # Override scale if specified
    if args.scale:
        spec.scale = args.scale
    
    # Save files
    vox_path = out_dir / f"{args.preset}.vox"
    generator.save_vox(model, vox_path)
    print(f"Wrote {args.preset}.vox to {out_dir}")
    
    if args.json:
        json_path = out_dir / f"{args.preset}.json"
        generator.save_json(model, json_path, spec)
        print(f"Wrote {args.preset}.json to {out_dir}")


if __name__ == "__main__":
    main()
