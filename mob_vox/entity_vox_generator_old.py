#!/usr/bin/env python3
"""
Unified Entity Voxel Generator for Voxel MMO

Generates voxel models for multiple entity families:
- Humanoid (players, villagers, fighters, etc.)
- Undead (skeletons, zombies)
- Slime (blob creatures)
- Quadruped (four-legged animals)

Usage:
    python entity_vox_generator.py --family humanoid --preset fighter --out ./generated
    python entity_vox_generator.py --family undead --preset skeleton --out ./generated
    python entity_vox_generator.py --family slime --preset green_slime --out ./generated
    python entity_vox_generator.py --family quadruped --preset wolf --out ./generated
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
    "hair": 2,
    "clothing_primary": 3,
    "clothing_secondary": 4,
    "clothing_dark": 5,
    "armor": 6,
    "bone": 7,
    "leather": 8,
    "metal": 9,
    "slime_body": 10,
    "slime_core": 11,
    "slime_highlight": 12,
}

# -------------------------
# Palettes for different families
# -------------------------
HUMANOID_SKINS: Dict[str, List[RGBA]] = {
    "caucasian": make_palette({
        PART_COLORS["skin"]: (255, 220, 177, 255),
        PART_COLORS["hair"]: (60, 40, 30, 255),
        PART_COLORS["clothing_primary"]: (100, 100, 150, 255),
        PART_COLORS["clothing_secondary"]: (80, 80, 120, 255),
        PART_COLORS["clothing_dark"]: (40, 40, 60, 255),
        PART_COLORS["armor"]: (150, 150, 170, 255),
        PART_COLORS["leather"]: (139, 90, 43, 255),
        PART_COLORS["metal"]: (192, 192, 192, 255),
    }),
    "warrior": make_palette({
        PART_COLORS["skin"]: (200, 180, 140, 255),
        PART_COLORS["hair"]: (40, 30, 20, 255),
        PART_COLORS["clothing_primary"]: (80, 80, 100, 255),
        PART_COLORS["clothing_secondary"]: (60, 60, 80, 255),
        PART_COLORS["clothing_dark"]: (30, 30, 40, 255),
        PART_COLORS["armor"]: (120, 120, 140, 255),
        PART_COLORS["leather"]: (101, 67, 33, 255),
        PART_COLORS["metal"]: (160, 160, 180, 255),
    }),
}

UNDEAD_SKINS: Dict[str, List[RGBA]] = {
    "skeleton": make_palette({
        PART_COLORS["bone"]: (240, 230, 200, 255),
        PART_COLORS["armor"]: (100, 100, 120, 255),
        PART_COLORS["metal"]: (150, 150, 170, 255),
        PART_COLORS["clothing_dark"]: (40, 40, 40, 255),
    }),
    "zombie": make_palette({
        PART_COLORS["skin"]: (120, 100, 80, 255),
        PART_COLORS["bone"]: (200, 190, 170, 255),
        PART_COLORS["clothing_primary"]: (60, 50, 40, 255),
        PART_COLORS["clothing_secondary"]: (40, 35, 30, 255),
        PART_COLORS["clothing_dark"]: (20, 20, 20, 255),
        PART_COLORS["armor"]: (80, 80, 90, 255),
    }),
}

SLIME_SKINS: Dict[str, List[RGBA]] = {
    "green_slime": make_palette({
        PART_COLORS["slime_body"]: (100, 200, 100, 255),
        PART_COLORS["slime_core"]: (50, 150, 50, 255),
        PART_COLORS["slime_highlight"]: (150, 250, 150, 255),
    }),
    "toxic_slime": make_palette({
        PART_COLORS["slime_body"]: (150, 255, 150, 255),
        PART_COLORS["slime_core"]: (100, 200, 100, 255),
        PART_COLORS["slime_highlight"]: (200, 255, 200, 255),
    }),
    "frost_slime": make_palette({
        PART_COLORS["slime_body"]: (150, 200, 255, 255),
        PART_COLORS["slime_core"]: (100, 150, 200, 255),
        PART_COLORS["slime_highlight"]: (200, 230, 255, 255),
    }),
    "ember_slime": make_palette({
        PART_COLORS["slime_body"]: (255, 150, 100, 255),
        PART_COLORS["slime_core"]: (200, 100, 50, 255),
        PART_COLORS["slime_highlight"]: (255, 200, 150, 255),
    }),
}

QUADRUPED_SKINS: Dict[str, List[RGBA]] = {
    "dog_brown": make_palette({
        1: (140, 96, 64, 255),
        2: (96, 62, 40, 255),
        3: (188, 152, 116, 255),
        4: (32, 24, 24, 255),
        5: (12, 12, 12, 255),
        6: (120, 88, 60, 255),
        7: (230, 220, 210, 255),
        8: (200, 140, 130, 255),
        9: (240, 240, 240, 255),
        10: (245, 245, 245, 255),
    }),
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
    "bear_brown": make_palette({
        1: (101, 67, 33, 255),
        2: (61, 43, 31, 255),
        3: (139, 90, 43, 255),
        4: (31, 25, 15, 255),
        5: (15, 10, 5, 255),
        6: (82, 54, 31, 255),
        7: (214, 181, 131, 255),
        8: (181, 130, 90, 255),
        9: (241, 241, 241, 255),
        10: (131, 101, 61, 255),
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


@dataclass
class HumanoidSpec(EntitySpec):
    """Specification for humanoid entities."""
    height: int = 20
    shoulder_width: int = 6
    torso_depth: int = 3
    arm_length: int = 7
    leg_length: int = 9
    body_mass: int = 2
    hair_style: str = "short"  # short, long, bald
    clothing_type: str = "tunic"  # tunic, armor, robe
    has_armor: bool = False
    weapon_type: str = "none"  # none, sword, bow, staff


@dataclass
class UndeadSpec(EntitySpec):
    """Specification for undead entities."""
    undead_type: str = "skeleton"  # skeleton, zombie
    height: int = 20
    bone_thickness: int = 1
    rib_cage_width: int = 4
    has_armor: bool = False
    weapon_type: str = "none"
    decay_level: float = 0.0  # 0 = fresh, 1 = fully decayed
    missing_limbs: List[str] = field(default_factory=list)


@dataclass
class SlimeSpec(EntitySpec):
    """Specification for slime entities."""
    radius: int = 4
    vertical_squash: float = 1.0
    wobble_asymmetry: float = 0.0
    has_core: bool = True
    has_eyes: bool = True
    has_spikes: bool = False
    translucency: bool = False


@dataclass
class QuadrupedSpec(EntitySpec):
    """Specification for quadruped entities."""
    body_length: int = 12
    body_height: int = 5
    body_width: int = 4
    chest_bulge: int = 0
    rump_bulge: int = 0
    leg_height: int = 5
    leg_thickness: int = 2
    neck_length: int = 2
    head_length: int = 5
    head_height: int = 4
    head_width: int = 4
    muzzle_length: int = 2
    ear_type: str = "pointed"  # pointed, floppy, rounded, none
    tail_type: str = "straight"  # straight, bushy, tufted, curled, stub
    tail_length: int = 6
    mane: bool = False
    markings: str = "none"  # none, socks, muzzle, backstripe


# -------------------------
# Presets for each family
# -------------------------
HUMANOID_PRESETS: Dict[str, HumanoidSpec] = {
    "villager": HumanoidSpec(
        family="humanoid",
        name="villager",
        skin="caucasian",
        height=18,
        body_mass=2,
        hair_style="short",
        clothing_type="tunic",
        has_armor=False,
    ),
    "fighter": HumanoidSpec(
        family="humanoid",
        name="fighter",
        skin="warrior",
        height=20,
        shoulder_width=7,
        body_mass=3,
        hair_style="short",
        clothing_type="armor",
        has_armor=True,
        weapon_type="sword",
    ),
    "rogue": HumanoidSpec(
        family="humanoid",
        name="rogue",
        skin="caucasian",
        height=18,
        shoulder_width=5,
        body_mass=1,
        hair_style="long",
        clothing_type="tunic",
        has_armor=False,
        weapon_type="none",
    ),
    "mage": HumanoidSpec(
        family="humanoid",
        name="mage",
        skin="caucasian",
        height=19,
        shoulder_width=5,
        body_mass=1,
        hair_style="long",
        clothing_type="robe",
        has_armor=False,
        weapon_type="staff",
    ),
}

UNDEAD_PRESETS: Dict[str, UndeadSpec] = {
    "skeleton": UndeadSpec(
        family="undead",
        name="skeleton",
        skin="skeleton",
        undead_type="skeleton",
        height=20,
        bone_thickness=1,
        rib_cage_width=4,
        has_armor=False,
        weapon_type="none",
    ),
    "skeleton_archer": UndeadSpec(
        family="undead",
        name="skeleton_archer",
        skin="skeleton",
        undead_type="skeleton",
        height=20,
        bone_thickness=1,
        rib_cage_width=4,
        has_armor=False,
        weapon_type="bow",
    ),
    "skeleton_guard": UndeadSpec(
        family="undead",
        name="skeleton_guard",
        skin="skeleton",
        undead_type="skeleton",
        height=22,
        bone_thickness=2,
        rib_cage_width=5,
        has_armor=True,
        weapon_type="sword",
    ),
    "zombie": UndeadSpec(
        family="undead",
        name="zombie",
        skin="zombie",
        undead_type="zombie",
        height=20,
        decay_level=0.5,
        has_armor=False,
        weapon_type="none",
    ),
    "zombie_guard": UndeadSpec(
        family="undead",
        name="zombie_guard",
        skin="zombie",
        undead_type="zombie",
        height=21,
        decay_level=0.3,
        has_armor=True,
        weapon_type="sword",
    ),
}

SLIME_PRESETS: Dict[str, SlimeSpec] = {
    "green_slime": SlimeSpec(
        family="slime",
        name="green_slime",
        skin="green_slime",
        radius=4,
        vertical_squash=0.9,
        has_core=True,
        has_eyes=True,
    ),
    "toxic_slime": SlimeSpec(
        family="slime",
        name="toxic_slime",
        skin="toxic_slime",
        radius=5,
        vertical_squash=0.85,
        has_core=True,
        has_eyes=True,
    ),
    "frost_slime": SlimeSpec(
        family="slime",
        name="frost_slime",
        skin="frost_slime",
        radius=4,
        vertical_squash=1.1,
        has_core=True,
        has_eyes=False,
    ),
    "ember_slime": SlimeSpec(
        family="slime",
        name="ember_slime",
        skin="ember_slime",
        radius=4,
        vertical_squash=0.95,
        has_core=True,
        has_eyes=True,
        has_spikes=True,
    ),
}

QUADRUPED_PRESETS: Dict[str, QuadrupedSpec] = {
    "dog": QuadrupedSpec(
        family="quadruped",
        name="dog",
        skin="dog_brown",
        body_length=12,
        body_height=5,
        body_width=4,
        leg_height=5,
        leg_thickness=2,
        neck_length=2,
        head_length=5,
        head_height=4,
        head_width=4,
        muzzle_length=2,
        ear_type="floppy",
        tail_type="curled",
        tail_length=6,
        markings="socks",
    ),
    "wolf": QuadrupedSpec(
        family="quadruped",
        name="wolf",
        skin="wolf_gray",
        body_length=14,
        body_height=5,
        body_width=4,
        chest_bulge=1,
        leg_height=6,
        leg_thickness=2,
        neck_length=2,
        head_length=5,
        head_height=4,
        head_width=4,
        muzzle_length=3,
        ear_type="pointed",
        tail_type="bushy",
        tail_length=8,
        markings="muzzle",
    ),
    "bear": QuadrupedSpec(
        family="quadruped",
        name="bear",
        skin="bear_brown",
        body_length=16,
        body_height=8,
        body_width=6,
        chest_bulge=3,
        rump_bulge=2,
        leg_height=5,
        leg_thickness=3,
        neck_length=1,
        head_length=6,
        head_height=5,
        head_width=5,
        muzzle_length=2,
        ear_type="rounded",
        tail_type="stub",
        tail_length=2,
        markings="none",
        scale=1,
    ),
}


# -------------------------
# Geometry primitives
# -------------------------
class VoxelModel:
    def __init__(self, size: Vec3 = DEFAULT_SIZE, palette: Optional[List[RGBA]] = None):
        self.size = size
        self.palette = palette or HUMANOID_SKINS["caucasian"]
        self.voxels: Dict[Vec3, ColorIndex] = {}

    def set_voxel(self, x: int, y: int, z: int, color: int) -> None:
        sx, sy, sz = self.size
        if 0 <= x < sx and 0 <= y < sy and 0 <= z < sz and color > 0:
            self.voxels[(x, y, z)] = color

    def get_voxel(self, x: int, y: int, z: int) -> int:
        return self.voxels.get((x, y, z), 0)

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
        """Add a thick line between two points using Bresenham's algorithm."""
        x1, y1, z1 = start
        x2, y2, z2 = end
        
        points = []
        dx, dy, dz = abs(x2 - x1), abs(y2 - y1), abs(z2 - z1)
        sx, sy, sz = 1 if x1 < x2 else -1, 1 if y1 < y2 else -1, 1 if z1 < z2 else -1
        err1, err2 = dy - dz, dz - dx
        err3 = dx - dy
        
        while True:
            points.append((x1, y1, z1))
            if x1 == x2 and y1 == y2 and z1 == z2:
                break
            
            e3 = 2 * err3
            if e3 > -dx:
                err3 -= dx
                x1 += sx
            if e3 < dy:
                err3 += dy
                y1 += sy
        
        # Thicken the line
        for px, py, pz in points:
            for dx in range(-thickness//2, thickness//2 + 1):
                for dy in range(-thickness//2, thickness//2 + 1):
                    for dz in range(-thickness//2, thickness//2 + 1):
                        self.set_voxel(px + dx, py + dy, pz + dz, color)


# -------------------------
# Generators for each family
# -------------------------
class HumanoidGenerator:
    def generate(self, spec: HumanoidSpec) -> VoxelModel:
        model = VoxelModel(palette=HUMANOID_SKINS[spec.skin])
        scale = spec.scale
        
        # Center the model
        cx, cy, cz = 16, 10, 16
        
        # Build body parts
        self._build_torso(model, cx, cy, cz, spec, scale)
        self._build_head(model, cx, cy + spec.height//2 * scale, cz, spec, scale)
        self._build_arms(model, cx, cy, cz, spec, scale)
        self._build_legs(model, cx, cy - spec.leg_length * scale, cz, spec, scale)
        
        # Add equipment
        if spec.weapon_type != "none":
            self._add_weapon(model, cx, cy, cz, spec, scale)
        
        return model
    
    def _build_torso(self, model: VoxelModel, x: int, y: int, z: int, spec: HumanoidSpec, scale: int):
        w = spec.shoulder_width * scale
        d = spec.torso_depth * scale
        h = spec.height // 2 * scale
        
        if spec.clothing_type == "armor":
            model.fill_box(x - w//2, y, z - d//2, x + w//2, y + h, z + d//2, PART_COLORS["armor"])
        else:
            model.fill_box(x - w//2, y, z - d//2, x + w//2, y + h, z + d//2, PART_COLORS["clothing_primary"])
    
    def _build_head(self, model: VoxelModel, x: int, y: int, z: int, spec: HumanoidSpec, scale: int):
        head_size = 4 * scale
        model.fill_ellipsoid((x, y, z), (head_size//2, head_size//2, head_size//2), PART_COLORS["skin"])
        
        if spec.hair_style != "bald":
            hair_y = y + head_size//2
            model.fill_box(x - head_size//2, hair_y, z - head_size//2, 
                          x + head_size//2, hair_y + 2 * scale, z + head_size//2, PART_COLORS["hair"])
    
    def _build_arms(self, model: VoxelModel, x: int, y: int, z: int, spec: HumanoidSpec, scale: int):
        arm_y = y + spec.height // 3 * scale
        
        # Left arm
        model.fill_box(x - spec.shoulder_width * scale, arm_y, z - spec.torso_depth * scale,
                      x - spec.shoulder_width * scale + 2 * scale, arm_y + spec.arm_length * scale, 
                      z + spec.torso_depth * scale, PART_COLORS["skin"])
        
        # Right arm
        model.fill_box(x + spec.shoulder_width * scale - 2 * scale, arm_y, z - spec.torso_depth * scale,
                      x + spec.shoulder_width * scale, arm_y + spec.arm_length * scale,
                      z + spec.torso_depth * scale, PART_COLORS["skin"])
    
    def _build_legs(self, model: VoxelModel, x: int, y: int, z: int, spec: HumanoidSpec, scale: int):
        # Left leg
        model.fill_box(x - 2 * scale, y, z - 2 * scale,
                      x, y + spec.leg_length * scale, z + 2 * scale, PART_COLORS["clothing_primary"])
        
        # Right leg
        model.fill_box(x, y, z - 2 * scale,
                      x + 2 * scale, y + spec.leg_length * scale, z + 2 * scale, PART_COLORS["clothing_primary"])
    
    def _add_weapon(self, model: VoxelModel, x: int, y: int, z: int, spec: HumanoidSpec, scale: int):
        if spec.weapon_type == "sword":
            # Simple sword in right hand
            sword_x = x + spec.shoulder_width * scale
            sword_y = y + spec.height // 3 * scale
            model.add_line((sword_x, sword_y + 5 * scale, z), 
                          (sword_x, sword_y - 3 * scale, z), 
                          PART_COLORS["metal"], 2)


class UndeadGenerator:
    def generate(self, spec: UndeadSpec) -> VoxelModel:
        model = VoxelModel(palette=UNDEAD_SKINS[spec.skin])
        scale = spec.scale
        
        # Center the model
        cx, cy, cz = 16, 10, 16
        
        if spec.undead_type == "skeleton":
            self._build_skeleton(model, cx, cy, cz, spec, scale)
        else:
            self._build_zombie(model, cx, cy, cz, spec, scale)
        
        return model
    
    def _build_skeleton(self, model: VoxelModel, x: int, y: int, z: int, spec: UndeadSpec, scale: int):
        t = spec.bone_thickness * scale
        
        # Spine
        model.add_line((x, y, z), (x, y + spec.height * scale, z), PART_COLORS["bone"], t)
        
        # Rib cage
        for i in range(3):
            ry = y + spec.height // 2 * scale + i * 2 * scale
            model.add_line((x - spec.rib_cage_width * scale, ry, z), 
                          (x + spec.rib_cage_width * scale, ry, z), 
                          PART_COLORS["bone"], t)
        
        # Skull
        model.fill_ellipsoid((x, y + spec.height * scale, z), 
                            (3 * scale, 3 * scale, 3 * scale), PART_COLORS["bone"])
        
        # Arms (bones)
        if "left_arm" not in spec.missing_limbs:
            model.add_line((x, y + 2 * spec.height // 3 * scale, z), 
                          (x - 6 * scale, y, z), PART_COLORS["bone"], t)
        if "right_arm" not in spec.missing_limbs:
            model.add_line((x, y + 2 * spec.height // 3 * scale, z), 
                          (x + 6 * scale, y, z), PART_COLORS["bone"], t)
        
        # Legs (bones)
        model.add_line((x, y, z), (x - 3 * scale, y - spec.height // 2 * scale, z), PART_COLORS["bone"], t)
        model.add_line((x, y, z), (x + 3 * scale, y - spec.height // 2 * scale, z), PART_COLORS["bone"], t)
    
    def _build_zombie(self, model: VoxelModel, x: int, y: int, z: int, spec: UndeadSpec, scale: int):
        # Similar to humanoid but with decay effects
        w = 6 * scale
        d = 4 * scale
        h = spec.height // 2 * scale
        
        # Body (decayed clothing)
        model.fill_box(x - w//2, y, z - d//2, x + w//2, y + h, z + d//2, PART_COLORS["clothing_primary"])
        
        # Add decay holes
        if spec.decay_level > 0.3:
            for _ in range(int(5 * spec.decay_level)):
                hole_x = x + int((math.random() - 0.5) * w)
                hole_y = y + int(math.random() * h)
                hole_z = z + int((math.random() - 0.5) * d)
                model.set_voxel(hole_x, hole_y, hole_z, 0)
        
        # Head (exposed bone in places)
        head_y = y + spec.height // 2 * scale
        model.fill_ellipsoid((x, head_y, z), (4 * scale, 4 * scale, 4 * scale), PART_COLORS["skin"])
        
        if spec.decay_level > 0.5:
            # Exposed bone patches
            model.set_voxel(x, head_y + 2 * scale, z - 2 * scale, PART_COLORS["bone"])


class SlimeGenerator:
    def generate(self, spec: SlimeSpec) -> VoxelModel:
        model = VoxelModel(palette=SLIME_SKINS[spec.skin])
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
            offset = int(spec.wobble_asymmetry * scale)
            model.set_voxel(cx + offset, cy, cz, PART_COLORS["slime_body"])
            model.set_voxel(cx - offset, cy + 1, cz, PART_COLORS["slime_body"])
        
        # Core
        if spec.has_core:
            core_radius = max(1, radius_x // 2)
            model.fill_ellipsoid((cx, cy, cz), (core_radius, core_radius, core_radius), PART_COLORS["slime_core"])
        
        # Eyes
        if spec.has_eyes:
            eye_y = cy + radius_y // 2
            model.set_voxel(cx - 2 * scale, eye_y, cz - radius_z + 1, PART_COLORS["slime_highlight"])
            model.set_voxel(cx + 2 * scale, eye_y, cz - radius_z + 1, PART_COLORS["slime_highlight"])
        
        # Spikes
        if spec.has_spikes:
            for angle in range(0, 360, 45):
                spike_x = cx + int(radius_x * math.cos(math.radians(angle)))
                spike_z = cz + int(radius_z * math.sin(math.radians(angle)))
                model.add_line((spike_x, cy, spike_z), (spike_x, cy + 3 * scale, spike_z), 
                              PART_COLORS["slime_highlight"], 1)
        
        return model


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
        
        # Main body with chest and rump bulges
        self._build_body(model, body_x, body_y, body_z, spec, scale)
        
        # Legs
        self._build_legs(model, body_x, body_y, body_z, spec, scale)
        
        # Neck and head
        self._build_neck_and_head(model, cx + spec.body_length * scale // 2, body_y, cz, spec, scale)
        
        # Tail
        self._add_tail(model, body_x, body_y, cz, spec, scale)
        
        return model
    
    def _build_body(self, model: VoxelModel, x: int, y: int, z: int, spec: QuadrupedSpec, scale: int):
        # Main body
        model.fill_box(x, y, z, 
                      x + spec.body_length * scale,
                      y + spec.body_height * scale,
                      z + spec.body_width * scale, 1)
        
        # Chest bulge
        if spec.chest_bulge > 0:
            chest_x = x + spec.body_length * scale // 3
            model.fill_ellipsoid((chest_x, y + spec.body_height * scale // 2, z + spec.body_width * scale // 2),
                                (spec.chest_bulge * scale, spec.body_height * scale // 2, spec.body_width * scale // 2),
                                2)
        
        # Rump bulge
        if spec.rump_bulge > 0:
            rump_x = x + 2 * spec.body_length * scale // 3
            model.fill_ellipsoid((rump_x, y + spec.body_height * scale // 2, z + spec.body_width * scale // 2),
                                (spec.rump_bulge * scale, spec.body_height * scale // 2, spec.body_width * scale // 2),
                                2)
    
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
    
    def _add_tail(self, model: VoxelModel, x: int, y: int, z: int, spec: QuadrupedSpec, scale: int,
                  base: int = 1, dark: int = 2, mane: int = 3) -> None:
        scale = spec.scale
        length = spec.tail_length * scale
        tail_x = x + spec.body_length * scale
        tail_y = y + spec.body_height * scale // 2
        
        if spec.tail_type == "curled":
            points = [
                (tail_x, tail_y, z),
                (tail_x + length // 3, tail_y + scale, z),
                (tail_x + 2 * length // 3, tail_y + 2 * scale, z + scale // 2),
                (tail_x + length, tail_y + scale, z),
            ]
        elif spec.tail_type == "bushy":
            points = [(tail_x, tail_y, z), (tail_x + length, tail_y - scale, z)]
        elif spec.tail_type == "tufted":
            points = [(tail_x, tail_y, z), (tail_x + length, tail_y - scale, z)]
        elif spec.tail_type == "stub":
            points = [(tail_x, tail_y, z), (tail_x + min(length, 2 * scale), tail_y, z)]
        else:
            points = [(tail_x, tail_y, z), (tail_x + length, tail_y, z)]

        for a, b in zip(points, points[1:]):
            model.add_line(a, b, base, thickness=1)
        if spec.tail_type == "bushy":
            model.fill_ellipsoid(points[-1], (1.4 * scale, 1.1 * scale, 1.1 * scale), dark)
        if spec.tail_type == "tufted":
            model.fill_ellipsoid(points[-1], (1.2 * scale, 1.1 * scale, 1.1 * scale), mane)


# -------------------------
# Main generator interface
# -------------------------
class EntityVoxGenerator:
    def __init__(self, size: Vec3 = DEFAULT_SIZE):
        self.size = size
        self.humanoid_gen = HumanoidGenerator()
        self.undead_gen = UndeadGenerator()
        self.slime_gen = SlimeGenerator()
        self.quadruped_gen = QuadrupedGenerator()
    
    def generate(self, family: str, preset_name: str) -> VoxelModel:
        """Generate an entity model based on family and preset."""
        if family == "humanoid":
            if preset_name not in HUMANOID_PRESETS:
                raise ValueError(f"Unknown humanoid preset: {preset_name}")
            return self.humanoid_gen.generate(HUMANOID_PRESETS[preset_name])
        
        elif family == "undead":
            if preset_name not in UNDEAD_PRESETS:
                raise ValueError(f"Unknown undead preset: {preset_name}")
            return self.undead_gen.generate(UNDEAD_PRESETS[preset_name])
        
        elif family == "slime":
            if preset_name not in SLIME_PRESETS:
                raise ValueError(f"Unknown slime preset: {preset_name}")
            return self.slime_gen.generate(SLIME_PRESETS[preset_name])
        
        elif family == "quadruped":
            if preset_name not in QUADRUPED_PRESETS:
                raise ValueError(f"Unknown quadruped preset: {preset_name}")
            return self.quadruped_gen.generate(QUADRUPED_PRESETS[preset_name])
        
        else:
            raise ValueError(f"Unknown entity family: {family}")
    
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
        
        # SIZE chunk
        sx, sy, sz = model.size
        size_chunk = b'SIZE' + struct.pack('<I', 12) + struct.pack('<iii', sx, sy, sz)
        main_data += size_chunk
        
        # XYZI chunk (voxel data)
        xyzi_chunk = b'XYZI' + struct.pack('<I', chunk_size) + struct.pack('<I', num_voxels)
        for x, y, z, color in voxels:
            xyzi_chunk += bytes([x, y, z, color])
        main_data += xyzi_chunk
        
        # RGBA chunk (palette)
        rgba_chunk = b'RGBA' + struct.pack('<I', 1024)
        for r, g, b, a in model.palette:
            rgba_chunk += bytes([b, g, r, a])  # BGRA order for MagicaVoxel
        main_data += rgba_chunk
        
        # Wrap in MAIN chunk
        main_chunk = b'MAIN' + struct.pack('<I', len(main_data)) + main_data
        
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
    parser.add_argument('--family', choices=['humanoid', 'undead', 'slime', 'quadruped'], 
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
            ("humanoid", HUMANOID_PRESETS),
            ("undead", UNDEAD_PRESETS),
            ("slime", SLIME_PRESETS),
            ("quadruped", QUADRUPED_PRESETS),
        ]:
            print(f"\n{family.upper()}:")
            for name in sorted(presets.keys()):
                spec = presets[name]
                print(f"  {name}: family={spec.family}, skin={spec.skin}, scale={spec.scale}")
        return
    
    if args.list_family:
        families = {
            'humanoid': HUMANOID_PRESETS,
            'undead': UNDEAD_PRESETS,
            'slime': SLIME_PRESETS,
            'quadruped': QUADRUPED_PRESETS,
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
    model = generator.generate(args.family, args.preset)
    
    # Get the spec for metadata
    specs = {
        'humanoid': HUMANOID_PRESETS,
        'undead': UNDEAD_PRESETS,
        'slime': SLIME_PRESETS,
        'quadruped': QUADRUPED_PRESETS,
    }
    spec = specs[args.family][args.preset]
    
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
