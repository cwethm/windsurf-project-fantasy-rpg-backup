#!/usr/bin/env python3
"""
Parametric humanoid voxel avatar generator.

Creates MagicaVoxel .vox files and optional JSON occupancy dumps for
customizable player/NPC avatars.

Features:
- body proportion controls (height, shoulder width, arm/leg length, body mass)
- skin tone palettes
- hair styles/colors
- beard options
- clothing layers (shirt, trousers, robe, cloak, boots, gloves, belts)
- species-ish morphology tweaks (human, elf, dwarf, orc) as presets
- starter presets for common classes/roles

Usage:
  python3 avatar_vox_generator.py --list-presets
  python3 avatar_vox_generator.py --preset villager --out ./out
  python3 avatar_vox_generator.py --preset ranger --json --out ./out
  python3 avatar_vox_generator.py --all --out ./out
"""
from __future__ import annotations

import argparse
import json
import math
import os
import struct
import zipfile
from dataclasses import dataclass, asdict, field, replace
from typing import Dict, Iterable, List, Optional, Tuple

Vec3 = Tuple[int, int, int]
RGBA = Tuple[int, int, int, int]

SIZE_X = 32
SIZE_Y = 48
SIZE_Z = 32


# ---------- VOX writer ----------

def _chunk(tag: bytes, content: bytes = b"", children: bytes = b"") -> bytes:
    return tag + struct.pack("<II", len(content), len(children)) + content + children


def write_vox(path: str, size: Tuple[int, int, int], voxels: List[Tuple[int, int, int, int]], palette: List[RGBA]) -> None:
    sx, sy, sz = size
    size_chunk = _chunk(b"SIZE", struct.pack("<III", sx, sy, sz))
    xyzi = struct.pack("<I", len(voxels)) + b"".join(struct.pack("<BBBB", x, y, z, c) for x, y, z, c in voxels)
    xyzi_chunk = _chunk(b"XYZI", xyzi)

    pal = bytearray()
    pal += b"\x00\x00\x00\x00"  # ignored color 0
    for i in range(1, 256):
        if i - 1 < len(palette):
            r, g, b, a = palette[i - 1]
        else:
            r, g, b, a = (0, 0, 0, 0)
        pal += struct.pack("<BBBB", r, g, b, a)
    rgba_chunk = _chunk(b"RGBA", bytes(pal))

    main = _chunk(b"MAIN", b"", size_chunk + xyzi_chunk + rgba_chunk)
    with open(path, "wb") as f:
        f.write(b"VOX ")
        f.write(struct.pack("<I", 150))
        f.write(main)


# ---------- utility grid ----------

class VoxelGrid:
    def __init__(self, sx: int = SIZE_X, sy: int = SIZE_Y, sz: int = SIZE_Z):
        self.sx = sx
        self.sy = sy
        self.sz = sz
        self.data: Dict[Vec3, int] = {}

    def set(self, x: int, y: int, z: int, color: int) -> None:
        if 0 <= x < self.sx and 0 <= y < self.sy and 0 <= z < self.sz and color > 0:
            self.data[(x, y, z)] = color

    def get(self, x: int, y: int, z: int) -> int:
        return self.data.get((x, y, z), 0)

    def fill_box(self, x0: int, y0: int, z0: int, x1: int, y1: int, z1: int, color: int, hollow: bool = False) -> None:
        xa, xb = sorted((x0, x1))
        ya, yb = sorted((y0, y1))
        za, zb = sorted((z0, z1))
        for x in range(xa, xb + 1):
            for y in range(ya, yb + 1):
                for z in range(za, zb + 1):
                    if hollow and xa < x < xb and ya < y < yb and za < z < zb:
                        continue
                    self.set(x, y, z, color)

    def fill_ellipsoid(self, cx: int, cy: int, cz: int, rx: int, ry: int, rz: int, color: int) -> None:
        rx = max(rx, 1)
        ry = max(ry, 1)
        rz = max(rz, 1)
        for x in range(cx - rx, cx + rx + 1):
            for y in range(cy - ry, cy + ry + 1):
                for z in range(cz - rz, cz + rz + 1):
                    dx = (x - cx) / rx
                    dy = (y - cy) / ry
                    dz = (z - cz) / rz
                    if dx * dx + dy * dy + dz * dz <= 1.0:
                        self.set(x, y, z, color)

    def carve_box(self, x0: int, y0: int, z0: int, x1: int, y1: int, z1: int) -> None:
        xa, xb = sorted((x0, x1))
        ya, yb = sorted((y0, y1))
        za, zb = sorted((z0, z1))
        for x in range(xa, xb + 1):
            for y in range(ya, yb + 1):
                for z in range(za, zb + 1):
                    self.data.pop((x, y, z), None)

    def mirrored_set(self, x: int, y: int, z: int, mid_x: int, color: int) -> None:
        self.set(x, y, z, color)
        self.set(mid_x - (x - mid_x), y, z, color)

    def voxels(self) -> List[Tuple[int, int, int, int]]:
        return [(x, y, z, c) for (x, y, z), c in sorted(self.data.items())]


# ---------- palettes ----------

PALETTE_BASE: List[RGBA] = [
    (255, 214, 170, 255),  # 1 light skin
    (226, 181, 139, 255),  # 2 tan skin
    (171, 126, 92, 255),   # 3 brown skin
    (107, 72, 50, 255),    # 4 deep skin
    (49, 31, 20, 255),     # 5 darkest skin / shadow brown
    (34, 34, 39, 255),     # 6 black hair
    (92, 63, 40, 255),     # 7 brown hair
    (186, 144, 79, 255),   # 8 blonde hair
    (148, 53, 36, 255),    # 9 auburn hair
    (197, 197, 205, 255),  # 10 white hair
    (80, 95, 140, 255),    # 11 blue cloth
    (131, 51, 52, 255),    # 12 red cloth
    (64, 110, 72, 255),    # 13 green cloth
    (124, 96, 60, 255),    # 14 brown cloth
    (160, 136, 98, 255),   # 15 tan cloth
    (102, 70, 123, 255),   # 16 purple cloth
    (122, 122, 128, 255),  # 17 steel
    (184, 184, 189, 255),  # 18 bright steel
    (120, 88, 45, 255),    # 19 leather dark
    (164, 118, 62, 255),   # 20 leather light
    (92, 56, 29, 255),     # 21 wood dark
    (146, 100, 54, 255),   # 22 wood light
    (255, 230, 116, 255),  # 23 gold
    (85, 198, 220, 255),   # 24 arcane cyan
    (146, 214, 119, 255),  # 25 nature green
    (220, 152, 71, 255),   # 26 orange accent
    (200, 90, 150, 255),   # 27 pink accent
    (55, 58, 70, 255),     # 28 dark fabric
    (220, 220, 230, 255),  # 29 pale cloth
    (65, 38, 98, 255),     # 30 deep purple
]

SKIN_TONES = {"light": 1, "tan": 2, "brown": 3, "deep": 4, "dark": 5}
HAIR_COLORS = {"black": 6, "brown": 7, "blonde": 8, "auburn": 9, "white": 10}
CLOTH_COLORS = {
    "blue": 11, "red": 12, "green": 13, "brown": 14, "tan": 15,
    "purple": 16, "dark": 28, "pale": 29, "deep_purple": 30, "orange": 26,
    "pink": 27,
}
MATERIAL_COLORS = {"steel": 17, "bright_steel": 18, "leather": 19, "leather_light": 20, "wood": 21, "wood_light": 22, "gold": 23, "arcane": 24, "nature": 25}


# ---------- avatar description ----------

@dataclass
class ClothingSpec:
    shirt: Optional[str] = "blue"
    trousers: Optional[str] = "brown"
    boots: Optional[str] = "leather"
    gloves: Optional[str] = None
    belt: Optional[str] = "leather"
    robe: Optional[str] = None
    cloak: Optional[str] = None
    hood: Optional[str] = None
    armor: Optional[str] = None   # leather, chain, plate, scale
    shoulder_pads: bool = False


@dataclass
class Morphology:
    total_height: int = 34
    head_height: int = 7
    head_width: int = 6
    shoulder_width: int = 8
    torso_depth: int = 4
    arm_length: int = 12
    leg_length: int = 14
    arm_thickness: int = 2
    leg_thickness: int = 2
    hip_width: int = 6
    neck_height: int = 1
    hand_size: int = 1
    foot_length: int = 2
    body_mass: int = 0   # widens torso/limbs slightly
    ear_points: int = 0  # elf-like
    jaw_width: int = 0   # +1 for orc/dwarf bulk


@dataclass
class AvatarSpec:
    name: str
    morphology: Morphology = field(default_factory=Morphology)
    skin_tone: str = "tan"
    hair_color: str = "brown"
    hair_style: str = "short"
    beard_style: str = "none"
    eye_color: int = 24
    clothing: ClothingSpec = field(default_factory=ClothingSpec)
    species_tag: str = "human"
    gender_presentation: str = "neutral"
    extras: Dict[str, bool] = field(default_factory=dict)  # satchel, tabard, pauldron, staff, etc.


PRESETS: Dict[str, AvatarSpec] = {
    "villager": AvatarSpec(name="villager"),
    "ranger": AvatarSpec(
        name="ranger",
        skin_tone="tan",
        hair_color="brown",
        hair_style="ponytail",
        clothing=ClothingSpec(shirt="green", trousers="brown", boots="leather", belt="leather", cloak="green"),
        extras={"quiver": True, "bracers": True},
    ),
    "mage": AvatarSpec(
        name="mage",
        skin_tone="light",
        hair_color="white",
        hair_style="long",
        clothing=ClothingSpec(shirt="pale", trousers="deep_purple", boots="dark", belt="leather", robe="deep_purple", hood="purple"),
        extras={"staff": True, "amulet": True},
    ),
    "cleric": AvatarSpec(
        name="cleric",
        skin_tone="brown",
        hair_color="black",
        hair_style="bun",
        clothing=ClothingSpec(shirt="pale", trousers="tan", boots="brown", robe="red", cloak="pale"),
        extras={"holy_symbol": True, "mace": True},
    ),
    "fighter": AvatarSpec(
        name="fighter",
        skin_tone="deep",
        hair_color="black",
        hair_style="short",
        beard_style="short",
        morphology=Morphology(shoulder_width=10, torso_depth=5, arm_length=12, leg_length=14, body_mass=1, jaw_width=1),
        clothing=ClothingSpec(shirt="red", trousers="brown", boots="leather", armor="plate", belt="leather", gloves="leather", shoulder_pads=True),
        extras={"sword": True, "shield": True},
    ),
    "rogue": AvatarSpec(
        name="rogue",
        skin_tone="tan",
        hair_color="auburn",
        hair_style="short",
        clothing=ClothingSpec(shirt="dark", trousers="dark", boots="leather", belt="leather", hood="dark", armor="leather"),
        extras={"dagger": True, "satchel": True},
    ),
    "elf": AvatarSpec(
        name="elf",
        species_tag="elf",
        skin_tone="light",
        hair_color="blonde",
        hair_style="long",
        morphology=Morphology(total_height=36, head_height=7, head_width=5, shoulder_width=7, torso_depth=4, arm_length=13, leg_length=16, arm_thickness=2, leg_thickness=2, hip_width=5, ear_points=2),
        clothing=ClothingSpec(shirt="green", trousers="tan", boots="leather", cloak="green"),
        extras={"bow": True},
    ),
    "dwarf": AvatarSpec(
        name="dwarf",
        species_tag="dwarf",
        skin_tone="deep",
        hair_color="brown",
        hair_style="braid",
        beard_style="long",
        morphology=Morphology(total_height=28, head_height=7, head_width=7, shoulder_width=11, torso_depth=5, arm_length=9, leg_length=10, arm_thickness=3, leg_thickness=3, hip_width=8, body_mass=2, jaw_width=1),
        clothing=ClothingSpec(shirt="blue", trousers="brown", boots="leather", armor="chain", belt="leather"),
        extras={"hammer": True},
    ),
    "orc": AvatarSpec(
        name="orc",
        species_tag="orc",
        skin_tone="brown",
        hair_color="black",
        hair_style="mohawk",
        morphology=Morphology(total_height=35, head_height=7, head_width=7, shoulder_width=11, torso_depth=5, arm_length=12, leg_length=14, arm_thickness=3, leg_thickness=3, hip_width=7, body_mass=2, jaw_width=2),
        clothing=ClothingSpec(shirt="brown", trousers="dark", boots="leather", armor="scale", belt="leather"),
        extras={"axe": True, "pauldron_single": True},
    ),
}


# ---------- generator ----------

class AvatarGenerator:
    def __init__(self):
        self.palette = PALETTE_BASE
        self.mid_x = SIZE_X // 2
        self.mid_z = SIZE_Z // 2

    def generate(self, spec: AvatarSpec) -> Tuple[VoxelGrid, dict]:
        g = VoxelGrid()
        m = spec.morphology

        y0 = 1
        foot_y = y0
        leg_top = foot_y + m.leg_length - 1
        torso_bottom = leg_top + 1
        torso_top = torso_bottom + (m.total_height - m.leg_length - m.head_height - m.neck_height - 1)
        neck_y = torso_top + 1
        head_bottom = neck_y + m.neck_height
        head_top = head_bottom + m.head_height - 1

        anchor = {
            "foot_y": foot_y,
            "leg_top": leg_top,
            "torso_bottom": torso_bottom,
            "torso_top": torso_top,
            "head_bottom": head_bottom,
            "head_top": head_top,
            "cx": self.mid_x,
            "cz": self.mid_z,
        }

        skin = SKIN_TONES.get(spec.skin_tone, 2)
        hair = HAIR_COLORS.get(spec.hair_color, 7)

        self._build_legs(g, m, spec, anchor, skin)
        self._build_torso(g, m, spec, anchor, skin)
        self._build_arms(g, m, spec, anchor, skin)
        self._build_head(g, m, spec, anchor, skin, hair)
        self._apply_clothing(g, m, spec, anchor)
        self._apply_extras(g, m, spec, anchor)

        meta = {
            "name": spec.name,
            "species_tag": spec.species_tag,
            "skin_tone": spec.skin_tone,
            "hair_color": spec.hair_color,
            "hair_style": spec.hair_style,
            "beard_style": spec.beard_style,
            "morphology": asdict(spec.morphology),
            "clothing": asdict(spec.clothing),
            "extras": spec.extras,
            "anchors": anchor,
            "attachment_points": self._attachment_points(m, anchor),
        }
        return g, meta

    def _build_legs(self, g: VoxelGrid, m: Morphology, spec: AvatarSpec, a: dict, skin: int) -> None:
        gap = 1 if m.hip_width <= 6 else 2
        half = max(1, m.leg_thickness // 2)
        left_cx = self.mid_x - gap - half
        right_cx = self.mid_x + gap + half
        rz = max(1, m.leg_thickness // 2)
        # feet
        for cx in (left_cx, right_cx):
            g.fill_box(cx - half, a["foot_y"], self.mid_z - rz, cx + half, a["foot_y"] + 1, self.mid_z + rz + m.foot_length - 1, skin)
            g.fill_box(cx - half, a["foot_y"] + 2, self.mid_z - rz, cx + half, a["leg_top"], self.mid_z + rz, skin)

    def _build_torso(self, g: VoxelGrid, m: Morphology, spec: AvatarSpec, a: dict, skin: int) -> None:
        sx = m.shoulder_width // 2 + m.body_mass
        sz = m.torso_depth // 2 + (1 if m.body_mass > 1 else 0)
        hip = m.hip_width // 2 + m.body_mass
        # lower torso / hips
        for y in range(a["torso_bottom"], a["torso_bottom"] + 3):
            rx = hip if y < a["torso_bottom"] + 2 else max(hip, sx - 1)
            g.fill_box(self.mid_x - rx, y, self.mid_z - sz, self.mid_x + rx, y, self.mid_z + sz, skin)
        # upper torso/chest
        for y in range(a["torso_bottom"] + 3, a["torso_top"] + 1):
            rx = sx
            extra = 1 if y >= a["torso_top"] - 1 and m.body_mass > 0 else 0
            g.fill_box(self.mid_x - rx - extra, y, self.mid_z - sz, self.mid_x + rx + extra, y, self.mid_z + sz, skin)
        # neck
        g.fill_box(self.mid_x - 1, a["torso_top"] + 1, self.mid_z - 1, self.mid_x + 1, a["torso_top"] + m.neck_height, self.mid_z + 1, skin)

    def _build_arms(self, g: VoxelGrid, m: Morphology, spec: AvatarSpec, a: dict, skin: int) -> None:
        shoulder_y = a["torso_top"] - 1
        half_th = max(1, m.arm_thickness // 2)
        torso_half = m.shoulder_width // 2 + m.body_mass
        left_x = self.mid_x - torso_half - half_th - 1
        right_x = self.mid_x + torso_half + half_th + 1
        arm_z0 = self.mid_z - half_th
        arm_z1 = self.mid_z + half_th
        hand_y = max(a["torso_bottom"] + 1, shoulder_y - m.arm_length)
        for x in range(left_x - half_th, left_x + half_th + 1):
            g.fill_box(x, hand_y, arm_z0, x, shoulder_y, arm_z1, skin)
        for x in range(right_x - half_th, right_x + half_th + 1):
            g.fill_box(x, hand_y, arm_z0, x, shoulder_y, arm_z1, skin)
        # simple hands
        for x in range(left_x - half_th, left_x + half_th + 1):
            g.fill_box(x, hand_y - m.hand_size, arm_z0, x, hand_y - 1, arm_z1, skin)
        for x in range(right_x - half_th, right_x + half_th + 1):
            g.fill_box(x, hand_y - m.hand_size, arm_z0, x, hand_y - 1, arm_z1, skin)

    def _build_head(self, g: VoxelGrid, m: Morphology, spec: AvatarSpec, a: dict, skin: int, hair: int) -> None:
        rx = m.head_width // 2
        rz = max(2, (m.head_width - 1) // 2)
        ry = max(3, m.head_height // 2)
        cy = a["head_bottom"] + ry
        g.fill_ellipsoid(self.mid_x, cy, self.mid_z, rx, ry, rz, skin)
        # jaw bulk
        if m.jaw_width > 0:
            g.fill_box(self.mid_x - rx - m.jaw_width, a["head_bottom"] + 1, self.mid_z - rz, self.mid_x + rx + m.jaw_width, a["head_bottom"] + 2, self.mid_z + rz, skin)
        # face carve for flatter front
        g.carve_box(self.mid_x - 1, a["head_bottom"] + 1, self.mid_z + rz, self.mid_x + 1, a["head_top"] - 1, self.mid_z + rz)
        # nose / face plane
        g.fill_box(self.mid_x - 1, a["head_bottom"] + 2, self.mid_z + rz - 1, self.mid_x + 1, a["head_top"] - 2, self.mid_z + rz - 1, skin)
        # eyes
        eye_y = a["head_top"] - 3
        g.set(self.mid_x - 2, eye_y, self.mid_z + rz - 1, spec.eye_color)
        g.set(self.mid_x + 2, eye_y, self.mid_z + rz - 1, spec.eye_color)
        # ears
        ear_y = a["head_top"] - 2
        g.set(self.mid_x - rx - 1, ear_y, self.mid_z, skin)
        g.set(self.mid_x + rx + 1, ear_y, self.mid_z, skin)
        for i in range(m.ear_points):
            g.set(self.mid_x - rx - 1, ear_y + 1 + i, self.mid_z, skin)
            g.set(self.mid_x + rx + 1, ear_y + 1 + i, self.mid_z, skin)
        # hair styles
        self._add_hair(g, spec, a, hair, rx, rz)
        self._add_beard(g, spec, a, hair, rx, rz)

    def _add_hair(self, g: VoxelGrid, spec: AvatarSpec, a: dict, color: int, rx: int, rz: int) -> None:
        top = a["head_top"]
        base = a["head_top"] - 1
        style = spec.hair_style
        # top cap
        g.fill_box(self.mid_x - rx, base, self.mid_z - rz, self.mid_x + rx, top, self.mid_z + rz - 1, color)
        # fringe
        g.fill_box(self.mid_x - rx + 1, a["head_top"] - 3, self.mid_z + rz - 1, self.mid_x + rx - 1, a["head_top"] - 2, self.mid_z + rz - 1, color)
        if style == "bald":
            # remove most hair
            for k in list(g.data.keys()):
                x, y, z = k
                if base <= y <= top and self.mid_x - rx <= x <= self.mid_x + rx and self.mid_z - rz <= z <= self.mid_z + rz:
                    if g.data[k] == color:
                        del g.data[k]
            return
        if style == "short":
            return
        if style == "long":
            g.fill_box(self.mid_x - rx, a["head_bottom"] + 1, self.mid_z - rz, self.mid_x + rx, a["head_top"] - 1, self.mid_z - rz, color)
        elif style == "ponytail":
            g.fill_box(self.mid_x - 1, a["head_bottom"], self.mid_z - rz - 1, self.mid_x + 1, a["head_bottom"] + 5, self.mid_z - rz - 1, color)
        elif style == "bun":
            g.fill_ellipsoid(self.mid_x, top + 1, self.mid_z - rz, 2, 2, 2, color)
        elif style == "braid":
            g.fill_box(self.mid_x, a["head_bottom"], self.mid_z - rz - 1, self.mid_x, a["head_bottom"] + 5, self.mid_z - rz - 1, color)
            for y in range(a["head_bottom"], a["head_bottom"] + 6, 2):
                g.set(self.mid_x - 1, y, self.mid_z - rz - 1, color)
                g.set(self.mid_x + 1, y + 1, self.mid_z - rz - 1, color)
        elif style == "mohawk":
            for y in range(a["head_bottom"] + 1, top + 2):
                g.set(self.mid_x, y, self.mid_z, color)
                g.set(self.mid_x, y, self.mid_z - 1, color)
        elif style == "afro":
            g.fill_ellipsoid(self.mid_x, a["head_top"] - 1, self.mid_z, rx + 2, 4, rz + 2, color)

    def _add_beard(self, g: VoxelGrid, spec: AvatarSpec, a: dict, color: int, rx: int, rz: int) -> None:
        beard = spec.beard_style
        if beard == "none":
            return
        chin_y = a["head_bottom"]
        front_z = self.mid_z + rz - 1
        if beard in ("short", "goatee"):
            g.fill_box(self.mid_x - 2, chin_y, front_z, self.mid_x + 2, chin_y + 1, front_z, color)
            if beard == "goatee":
                g.fill_box(self.mid_x, chin_y - 2, front_z, self.mid_x, chin_y, front_z, color)
        elif beard == "long":
            g.fill_box(self.mid_x - 2, chin_y - 5, front_z, self.mid_x + 2, chin_y + 1, front_z, color)
            g.fill_box(self.mid_x - 1, chin_y - 7, front_z, self.mid_x + 1, chin_y - 6, front_z, color)

    def _apply_clothing(self, g: VoxelGrid, m: Morphology, spec: AvatarSpec, a: dict) -> None:
        c = spec.clothing
        torso_half = m.shoulder_width // 2 + m.body_mass
        hip_half = m.hip_width // 2 + m.body_mass
        depth = m.torso_depth // 2 + (1 if m.body_mass > 1 else 0)
        if c.shirt:
            col = CLOTH_COLORS[c.shirt]
            g.fill_box(self.mid_x - torso_half, a["torso_bottom"] + 2, self.mid_z - depth, self.mid_x + torso_half, a["torso_top"], self.mid_z + depth, col)
        if c.trousers:
            col = CLOTH_COLORS[c.trousers]
            g.fill_box(self.mid_x - hip_half, a["torso_bottom"], self.mid_z - depth, self.mid_x + hip_half, a["torso_bottom"] + 2, self.mid_z + depth, col)
            # leg wraps
            gap = 1 if m.hip_width <= 6 else 2
            half = max(1, m.leg_thickness // 2)
            rz = max(1, m.leg_thickness // 2)
            for cx in (self.mid_x - gap - half, self.mid_x + gap + half):
                g.fill_box(cx - half, a["foot_y"] + 2, self.mid_z - rz, cx + half, a["leg_top"] - 2, self.mid_z + rz, col)
        if c.boots:
            col = MATERIAL_COLORS.get(c.boots, CLOTH_COLORS.get(c.boots, 19))
            gap = 1 if m.hip_width <= 6 else 2
            half = max(1, m.leg_thickness // 2)
            rz = max(1, m.leg_thickness // 2)
            for cx in (self.mid_x - gap - half, self.mid_x + gap + half):
                g.fill_box(cx - half, a["foot_y"], self.mid_z - rz, cx + half, a["foot_y"] + 2, self.mid_z + rz + m.foot_length - 1, col)
        if c.gloves:
            col = MATERIAL_COLORS.get(c.gloves, CLOTH_COLORS.get(c.gloves, 19))
            shoulder_y = a["torso_top"] - 1
            hand_y = max(a["torso_bottom"] + 1, shoulder_y - m.arm_length)
            half_th = max(1, m.arm_thickness // 2)
            torso_half = m.shoulder_width // 2 + m.body_mass
            for cx in (self.mid_x - torso_half - half_th - 1, self.mid_x + torso_half + half_th + 1):
                g.fill_box(cx - half_th, hand_y - m.hand_size, self.mid_z - half_th, cx + half_th, hand_y + 1, self.mid_z + half_th, col)
        if c.belt:
            col = MATERIAL_COLORS.get(c.belt, 19)
            g.fill_box(self.mid_x - hip_half - 1, a["torso_bottom"] + 2, self.mid_z - depth - 1, self.mid_x + hip_half + 1, a["torso_bottom"] + 2, self.mid_z + depth + 1, col)
        if c.robe:
            col = CLOTH_COLORS[c.robe]
            g.fill_box(self.mid_x - torso_half - 1, a["torso_bottom"] + 1, self.mid_z - depth - 1, self.mid_x + torso_half + 1, a["torso_top"], self.mid_z + depth + 1, col)
            g.fill_box(self.mid_x - hip_half - 2, a["foot_y"] + 2, self.mid_z - depth - 1, self.mid_x + hip_half + 2, a["torso_bottom"] + 1, self.mid_z + depth + 1, col)
            # front split for legs visibility
            g.carve_box(self.mid_x - 1, a["foot_y"] + 2, self.mid_z + depth + 1, self.mid_x + 1, a["torso_bottom"], self.mid_z + depth + 1)
        if c.cloak:
            col = CLOTH_COLORS[c.cloak]
            g.fill_box(self.mid_x - torso_half - 1, a["torso_bottom"] + 2, self.mid_z - depth - 2, self.mid_x + torso_half + 1, a["torso_top"], self.mid_z - depth - 2, col)
            g.fill_box(self.mid_x - torso_half - 2, a["torso_bottom"] - 1, self.mid_z - depth - 2, self.mid_x + torso_half + 2, a["torso_bottom"] + 1, self.mid_z - depth - 2, col)
        if c.hood:
            col = CLOTH_COLORS[c.hood]
            rx = m.head_width // 2 + 1
            rz = max(2, (m.head_width - 1) // 2) + 1
            g.fill_box(self.mid_x - rx, a["head_bottom"], self.mid_z - rz, self.mid_x + rx, a["head_top"], self.mid_z + rz - 1, col, hollow=True)
        if c.armor:
            if c.armor == "leather":
                col = 19
                g.fill_box(self.mid_x - torso_half - 1, a["torso_bottom"] + 2, self.mid_z - depth - 1, self.mid_x + torso_half + 1, a["torso_top"], self.mid_z + depth + 1, col, hollow=True)
            elif c.armor == "chain":
                col = 17
                g.fill_box(self.mid_x - torso_half - 1, a["torso_bottom"] + 2, self.mid_z - depth - 1, self.mid_x + torso_half + 1, a["torso_top"], self.mid_z + depth + 1, col, hollow=True)
                g.fill_box(self.mid_x - hip_half - 1, a["torso_bottom"], self.mid_z - depth - 1, self.mid_x + hip_half + 1, a["torso_bottom"] + 1, self.mid_z + depth + 1, col)
            elif c.armor == "plate":
                col = 18
                g.fill_box(self.mid_x - torso_half - 1, a["torso_bottom"] + 2, self.mid_z - depth - 1, self.mid_x + torso_half + 1, a["torso_top"], self.mid_z + depth + 1, col)
                g.fill_box(self.mid_x - hip_half - 1, a["torso_bottom"] + 2, self.mid_z - depth - 1, self.mid_x + hip_half + 1, a["torso_bottom"] + 3, self.mid_z + depth + 1, col)
                g.fill_box(self.mid_x - 3, a["head_bottom"] + 1, self.mid_z - 3, self.mid_x + 3, a["head_top"], self.mid_z + 2, col, hollow=True)
            elif c.armor == "scale":
                col = 17
                for y in range(a["torso_bottom"] + 2, a["torso_top"] + 1):
                    offset = y % 2
                    for x in range(self.mid_x - torso_half - 1, self.mid_x + torso_half + 2, 2):
                        g.set(x + offset, y, self.mid_z + depth + 1, col)
                        g.set(x + offset, y, self.mid_z - depth - 1, col)
                        g.set(x + offset, y, self.mid_z, col)
        if c.shoulder_pads or spec.extras.get("pauldron_single"):
            col = 18 if c.armor in ("plate", "chain") else 19
            y = a["torso_top"] - 1
            width = torso_half + 2
            if c.shoulder_pads:
                g.fill_box(self.mid_x - width - 1, y, self.mid_z - depth - 1, self.mid_x - width + 1, y + 1, self.mid_z + depth + 1, col)
                g.fill_box(self.mid_x + width - 1, y, self.mid_z - depth - 1, self.mid_x + width + 1, y + 1, self.mid_z + depth + 1, col)
            elif spec.extras.get("pauldron_single"):
                g.fill_box(self.mid_x - width - 1, y, self.mid_z - depth - 1, self.mid_x - width + 1, y + 1, self.mid_z + depth + 1, col)

    def _apply_extras(self, g: VoxelGrid, m: Morphology, spec: AvatarSpec, a: dict) -> None:
        # satchel / quiver
        if spec.extras.get("satchel"):
            g.fill_box(self.mid_x + m.shoulder_width // 2 + 2, a["torso_bottom"] + 1, self.mid_z - 1, self.mid_x + m.shoulder_width // 2 + 4, a["torso_bottom"] + 5, self.mid_z + 1, 19)
        if spec.extras.get("quiver"):
            g.fill_box(self.mid_x - 1, a["torso_bottom"] + 3, self.mid_z - 5, self.mid_x + 1, a["torso_top"] - 1, self.mid_z - 3, 19)
            for y in range(a["torso_top"] - 1, a["torso_top"] + 3):
                g.set(self.mid_x, y, self.mid_z - 4, 22)
        if spec.extras.get("amulet"):
            g.set(self.mid_x, a["torso_top"], self.mid_z + 3, 23)
        if spec.extras.get("holy_symbol"):
            g.set(self.mid_x, a["torso_top"] - 1, self.mid_z + 3, 23)
            g.set(self.mid_x, a["torso_top"] - 2, self.mid_z + 3, 23)
            g.set(self.mid_x - 1, a["torso_top"] - 1, self.mid_z + 3, 23)
            g.set(self.mid_x + 1, a["torso_top"] - 1, self.mid_z + 3, 23)
        # weapons / tools simple silhouettes in right hand
        shoulder_y = a["torso_top"] - 1
        hand_y = max(a["torso_bottom"] + 1, shoulder_y - m.arm_length) - 1
        right_hand_x = self.mid_x + (m.shoulder_width // 2 + m.body_mass + max(1, m.arm_thickness // 2) + 1)
        if spec.extras.get("staff"):
            g.fill_box(right_hand_x + 2, hand_y - 2, self.mid_z, right_hand_x + 2, hand_y + 13, self.mid_z, 22)
            g.set(right_hand_x + 2, hand_y + 14, self.mid_z, 24)
        if spec.extras.get("mace"):
            g.fill_box(right_hand_x + 2, hand_y - 1, self.mid_z, right_hand_x + 2, hand_y + 8, self.mid_z, 22)
            g.fill_ellipsoid(right_hand_x + 2, hand_y + 10, self.mid_z, 2, 2, 2, 17)
        if spec.extras.get("sword"):
            g.fill_box(right_hand_x + 2, hand_y - 1, self.mid_z, right_hand_x + 2, hand_y + 9, self.mid_z, 18)
            g.fill_box(right_hand_x + 1, hand_y - 1, self.mid_z, right_hand_x + 3, hand_y - 1, self.mid_z, 23)
            g.fill_box(right_hand_x + 2, hand_y - 3, self.mid_z, right_hand_x + 2, hand_y - 2, self.mid_z, 19)
        if spec.extras.get("axe"):
            g.fill_box(right_hand_x + 2, hand_y - 1, self.mid_z, right_hand_x + 2, hand_y + 8, self.mid_z, 22)
            g.fill_box(right_hand_x + 2, hand_y + 7, self.mid_z, right_hand_x + 4, hand_y + 10, self.mid_z, 17)
        if spec.extras.get("hammer"):
            g.fill_box(right_hand_x + 2, hand_y - 1, self.mid_z, right_hand_x + 2, hand_y + 7, self.mid_z, 22)
            g.fill_box(right_hand_x + 1, hand_y + 7, self.mid_z, right_hand_x + 4, hand_y + 9, self.mid_z, 17)
        if spec.extras.get("dagger"):
            g.fill_box(right_hand_x + 1, hand_y - 2, self.mid_z, right_hand_x + 1, hand_y + 2, self.mid_z, 18)
            g.set(right_hand_x + 1, hand_y - 3, self.mid_z, 23)
        if spec.extras.get("bow"):
            bow_x = right_hand_x + 2
            for dy in range(0, 12):
                y = hand_y + dy
                z = self.mid_z + max(-2, min(2, (dy - 6) // 2))
                g.set(bow_x, y, z, 22)
            g.fill_box(bow_x, hand_y + 2, self.mid_z, bow_x, hand_y + 10, self.mid_z, 19)
        if spec.extras.get("shield"):
            left_x = self.mid_x - (m.shoulder_width // 2 + m.body_mass + max(1, m.arm_thickness // 2) + 3)
            g.fill_box(left_x - 1, a["torso_bottom"] + 1, self.mid_z - 1, left_x + 1, a["torso_top"] - 1, self.mid_z + 2, 18)
        if spec.extras.get("bracers"):
            y = a["torso_bottom"] + 2
            lx = self.mid_x - (m.shoulder_width // 2 + max(1, m.arm_thickness // 2) + 1)
            rx = self.mid_x + (m.shoulder_width // 2 + max(1, m.arm_thickness // 2) + 1)
            for cx in (lx, rx):
                g.fill_box(cx - 1, y, self.mid_z - 1, cx + 1, y + 2, self.mid_z + 1, 19)

    def _attachment_points(self, m: Morphology, a: dict) -> dict:
        torso_half = m.shoulder_width // 2 + m.body_mass
        return {
            "head_top": [self.mid_x, a["head_top"] + 1, self.mid_z],
            "back": [self.mid_x, a["torso_top"] - 1, self.mid_z - (m.torso_depth // 2 + 2)],
            "right_hand": [self.mid_x + torso_half + max(1, m.arm_thickness // 2) + 1, max(a["torso_bottom"] + 1, a["torso_top"] - 1 - m.arm_length), self.mid_z],
            "left_hand": [self.mid_x - torso_half - max(1, m.arm_thickness // 2) - 1, max(a["torso_bottom"] + 1, a["torso_top"] - 1 - m.arm_length), self.mid_z],
            "waist_front": [self.mid_x, a["torso_bottom"] + 2, self.mid_z + (m.torso_depth // 2 + 1)],
            "waist_back": [self.mid_x, a["torso_bottom"] + 2, self.mid_z - (m.torso_depth // 2 + 1)],
        }


# ---------- CLI ----------

def clone_preset(name: str) -> AvatarSpec:
    base = PRESETS[name]
    return AvatarSpec(
        name=base.name,
        morphology=replace(base.morphology),
        skin_tone=base.skin_tone,
        hair_color=base.hair_color,
        hair_style=base.hair_style,
        beard_style=base.beard_style,
        eye_color=base.eye_color,
        clothing=replace(base.clothing),
        species_tag=base.species_tag,
        gender_presentation=base.gender_presentation,
        extras=dict(base.extras),
    )


def export_avatar(spec: AvatarSpec, out_dir: str, write_json: bool) -> Tuple[str, Optional[str]]:
    gen = AvatarGenerator()
    grid, meta = gen.generate(spec)
    os.makedirs(out_dir, exist_ok=True)
    vox_path = os.path.join(out_dir, f"{spec.name}.vox")
    write_vox(vox_path, (SIZE_X, SIZE_Y, SIZE_Z), grid.voxels(), gen.palette)
    json_path = None
    if write_json:
        json_path = os.path.join(out_dir, f"{spec.name}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump({"meta": meta, "voxels": grid.voxels()}, f, indent=2)
    return vox_path, json_path


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate customizable humanoid voxel avatars.")
    ap.add_argument("--list-presets", action="store_true")
    ap.add_argument("--preset", choices=sorted(PRESETS.keys()))
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--out", default="./generated_avatars")
    ap.add_argument("--json", action="store_true")

    # override knobs
    ap.add_argument("--name")
    ap.add_argument("--skin-tone", choices=sorted(SKIN_TONES.keys()))
    ap.add_argument("--hair-color", choices=sorted(HAIR_COLORS.keys()))
    ap.add_argument("--hair-style", choices=["bald", "short", "long", "ponytail", "bun", "braid", "mohawk", "afro"])
    ap.add_argument("--beard-style", choices=["none", "short", "goatee", "long"])
    ap.add_argument("--height", type=int)
    ap.add_argument("--shoulders", type=int)
    ap.add_argument("--torso-depth", type=int)
    ap.add_argument("--arm-length", type=int)
    ap.add_argument("--leg-length", type=int)
    ap.add_argument("--body-mass", type=int)
    ap.add_argument("--ear-points", type=int)
    args = ap.parse_args()

    if args.list_presets:
        print("Available presets:")
        for name in sorted(PRESETS):
            print(f"  - {name}")
        return

    specs: List[AvatarSpec] = []
    if args.all:
        specs = [clone_preset(k) for k in sorted(PRESETS)]
    elif args.preset:
        specs = [clone_preset(args.preset)]
    else:
        ap.error("Choose --preset NAME, --all, or --list-presets")

    for spec in specs:
        if args.name:
            spec.name = args.name
        if args.skin_tone:
            spec.skin_tone = args.skin_tone
        if args.hair_color:
            spec.hair_color = args.hair_color
        if args.hair_style:
            spec.hair_style = args.hair_style
        if args.beard_style:
            spec.beard_style = args.beard_style
        if args.height:
            spec.morphology.total_height = args.height
        if args.shoulders:
            spec.morphology.shoulder_width = args.shoulders
        if args.torso_depth:
            spec.morphology.torso_depth = args.torso_depth
        if args.arm_length:
            spec.morphology.arm_length = args.arm_length
        if args.leg_length:
            spec.morphology.leg_length = args.leg_length
        if args.body_mass is not None:
            spec.morphology.body_mass = args.body_mass
        if args.ear_points is not None:
            spec.morphology.ear_points = args.ear_points
        vox_path, json_path = export_avatar(spec, args.out, args.json)
        print(f"wrote {vox_path}")
        if json_path:
            print(f"wrote {json_path}")


if __name__ == "__main__":
    main()
