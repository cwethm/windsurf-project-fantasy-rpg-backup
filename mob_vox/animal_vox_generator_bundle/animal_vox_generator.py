#!/usr/bin/env python3
"""
Parametric voxel animal generator for MagicaVoxel .vox output.

This script generates low-poly quadruped creatures from reusable body plans,
modular features, and palette skins. It is meant as a practical starter asset
pipeline for code-driven projects where species variation matters more than
hand-authoring every model.

Features:
- Generates actual MagicaVoxel .vox files (VOX 150)
- Deterministic species presets (dog, wolf, lion, panther)
- Modular options for ears, tail, mane, muzzle, paws, and markings
- Also exports a JSON occupancy dump for engine-side debugging/import

Usage:
    python animal_vox_generator.py --list-presets
    python animal_vox_generator.py --preset dog --out ./out
    python animal_vox_generator.py --preset lion --scale 2 --out ./out
    python animal_vox_generator.py --preset wolf --json --out ./out

The generated model coordinates are in a single static object inside a
32x32x32 voxel volume by default.
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
# MagicaVoxel expects 255 palette entries after the reserved index 0.
# We'll fill unused entries with opaque black.
DEFAULT_PALETTE: List[RGBA] = [(0, 0, 0, 0)] + [(0, 0, 0, 255)] * 255


def make_palette(overrides: Dict[int, RGBA]) -> List[RGBA]:
    palette = DEFAULT_PALETTE.copy()
    for index, rgba in overrides.items():
        if not 1 <= index <= 255:
            raise ValueError(f"Palette index {index} out of range")
        palette[index] = rgba
    return palette


PALETTE_INDICES = {
    "fur_base": 1,
    "fur_dark": 2,
    "fur_light": 3,
    "nose": 4,
    "eye": 5,
    "mane": 6,
    "paw": 7,
    "inner_ear": 8,
    "claw": 9,
    "marking": 10,
}


SKINS: Dict[str, List[RGBA]] = {
    "dog_brown": make_palette(
        {
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
        }
    ),
    "wolf_gray": make_palette(
        {
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
        }
    ),
    "lion_tawny": make_palette(
        {
            1: (184, 150, 84, 255),
            2: (140, 108, 56, 255),
            3: (224, 195, 132, 255),
            4: (48, 36, 28, 255),
            5: (8, 8, 8, 255),
            6: (110, 72, 36, 255),
            7: (240, 226, 212, 255),
            8: (218, 170, 156, 255),
            9: (250, 250, 250, 255),
            10: (230, 210, 160, 255),
        }
    ),
    "panther_black": make_palette(
        {
            1: (42, 42, 48, 255),
            2: (22, 22, 26, 255),
            3: (92, 92, 102, 255),
            4: (28, 20, 20, 255),
            5: (12, 12, 12, 255),
            6: (54, 54, 60, 255),
            7: (225, 225, 225, 255),
            8: (190, 130, 130, 255),
            9: (250, 250, 250, 255),
            10: (88, 88, 96, 255),
        }
    ),
    "bear_brown": make_palette(
        {
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
        }
    ),
}


# -------------------------
# Geometry primitives
# -------------------------
class VoxelModel:
    def __init__(self, size: Vec3 = DEFAULT_SIZE, palette: Optional[List[RGBA]] = None):
        self.size = size
        self.palette = palette or SKINS["dog_brown"]
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

    def hollow_box(self, x1: int, y1: int, z1: int, x2: int, y2: int, z2: int, color: int) -> None:
        for x in range(min(x1, x2), max(x1, x2) + 1):
            for y in range(min(y1, y2), max(y1, y2) + 1):
                for z in range(min(z1, z2), max(z1, z2) + 1):
                    if x in (x1, x2) or y in (y1, y2) or z in (z1, z2):
                        self.set_voxel(x, y, z, color)

    def fill_ellipsoid(self, center: Tuple[float, float, float], radii: Tuple[float, float, float], color: int) -> None:
        cx, cy, cz = center
        rx, ry, rz = radii
        min_x, max_x = max(0, int(math.floor(cx - rx))), min(self.size[0] - 1, int(math.ceil(cx + rx)))
        min_y, max_y = max(0, int(math.floor(cy - ry))), min(self.size[1] - 1, int(math.ceil(cy + ry)))
        min_z, max_z = max(0, int(math.floor(cz - rz))), min(self.size[2] - 1, int(math.ceil(cz + rz)))
        for x in range(min_x, max_x + 1):
            for y in range(min_y, max_y + 1):
                for z in range(min_z, max_z + 1):
                    nx = ((x - cx) / rx) if rx else 0
                    ny = ((y - cy) / ry) if ry else 0
                    nz = ((z - cz) / rz) if rz else 0
                    if nx * nx + ny * ny + nz * nz <= 1.0:
                        self.set_voxel(x, y, z, color)

    def remove_ellipsoid(self, center: Tuple[float, float, float], radii: Tuple[float, float, float]) -> None:
        cx, cy, cz = center
        rx, ry, rz = radii
        to_remove = []
        for (x, y, z), _ in self.voxels.items():
            nx = ((x - cx) / rx) if rx else 0
            ny = ((y - cy) / ry) if ry else 0
            nz = ((z - cz) / rz) if rz else 0
            if nx * nx + ny * ny + nz * nz <= 1.0:
                to_remove.append((x, y, z))
        for key in to_remove:
            self.voxels.pop(key, None)

    def add_line(self, start: Vec3, end: Vec3, color: int, thickness: int = 1) -> None:
        x1, y1, z1 = start
        x2, y2, z2 = end
        steps = max(abs(x2 - x1), abs(y2 - y1), abs(z2 - z1), 1)
        for i in range(steps + 1):
            t = i / steps
            x = round(x1 + (x2 - x1) * t)
            y = round(y1 + (y2 - y1) * t)
            z = round(z1 + (z2 - z1) * t)
            self.fill_box(x - thickness + 1, y - thickness + 1, z - thickness + 1,
                          x + thickness - 1, y + thickness - 1, z + thickness - 1, color)

    def mirror_x(self, axis_x: int, source_points: Iterable[Vec3], color: int) -> None:
        for x, y, z in source_points:
            mx = axis_x + (axis_x - x)
            self.set_voxel(mx, y, z, color)

    def to_vox_bytes(self) -> bytes:
        voxels = [(x, y, z, c) for (x, y, z), c in sorted(self.voxels.items())]
        sx, sy, sz = self.size

        size_chunk = _chunk(
            b"SIZE",
            struct.pack("<iii", sx, sy, sz),
            b"",
        )

        xyzi_content = struct.pack("<i", len(voxels)) + b"".join(
            struct.pack("<BBBB", x, y, z, c) for x, y, z, c in voxels
        )
        xyzi_chunk = _chunk(b"XYZI", xyzi_content, b"")

        rgba_bytes = b"".join(struct.pack("<BBBB", *rgba) for rgba in self.palette[1:256])
        rgba_chunk = _chunk(b"RGBA", rgba_bytes, b"")

        children = size_chunk + xyzi_chunk + rgba_chunk
        main_chunk = _chunk(b"MAIN", b"", children)
        return b"VOX " + struct.pack("<I", VOX_VERSION) + main_chunk

    def to_json_dict(self) -> dict:
        return {
            "size": list(self.size),
            "voxels": [
                {"x": x, "y": y, "z": z, "color": c}
                for (x, y, z), c in sorted(self.voxels.items())
            ],
        }



def _chunk(chunk_id: bytes, content: bytes, children: bytes) -> bytes:
    return chunk_id + struct.pack("<II", len(content), len(children)) + content + children


# -------------------------
# Species configuration
# -------------------------
@dataclass
class AnimalSpec:
    family: str  # canine, feline
    name: str
    skin: str
    body_length: int = 12
    body_height: int = 5
    body_width: int = 4
    chest_bulge: int = 1
    rump_bulge: int = 1
    leg_height: int = 5
    leg_thickness: int = 2
    neck_length: int = 2
    head_length: int = 5
    head_height: int = 4
    head_width: int = 4
    muzzle_length: int = 2
    ear_type: str = "pointed"  # pointed, floppy, rounded
    tail_type: str = "straight"  # straight, bushy, tufted, curled
    tail_length: int = 7
    mane: bool = False
    markings: str = "none"  # none, socks, muzzle, backstripe
    eye_glow: bool = False
    scale: int = 1


PRESETS: Dict[str, AnimalSpec] = {
    "dog": AnimalSpec(
        family="canine",
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
    "wolf": AnimalSpec(
        family="canine",
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
    "lion": AnimalSpec(
        family="feline",
        name="lion",
        skin="lion_tawny",
        body_length=14,
        body_height=6,
        body_width=5,
        chest_bulge=2,
        rump_bulge=1,
        leg_height=6,
        leg_thickness=2,
        neck_length=2,
        head_length=5,
        head_height=4,
        head_width=4,
        muzzle_length=2,
        ear_type="rounded",
        tail_type="tufted",
        tail_length=9,
        mane=True,
        markings="none",
    ),
    "panther": AnimalSpec(
        family="feline",
        name="panther",
        skin="panther_black",
        body_length=14,
        body_height=5,
        body_width=4,
        chest_bulge=1,
        rump_bulge=1,
        leg_height=6,
        leg_thickness=2,
        neck_length=2,
        head_length=5,
        head_height=4,
        head_width=4,
        muzzle_length=2,
        ear_type="rounded",
        tail_type="straight",
        tail_length=10,
        mane=False,
        markings="backstripe",
        eye_glow=False,
    ),
    "bear": AnimalSpec(
        family="ursine",
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
# Generator
# -------------------------
class AnimalGenerator:
    def __init__(self, size: Vec3 = DEFAULT_SIZE):
        self.size = size

    def generate(self, spec: AnimalSpec) -> VoxelModel:
        model = VoxelModel(size=self.size, palette=SKINS[spec.skin])
        scale = max(1, spec.scale)

        # Anchor body inside the volume with a small margin.
        ground_y = 4 * scale
        body_x1 = 8 * scale
        body_x2 = body_x1 + spec.body_length * scale - 1
        body_z_center = self.size[2] // 2
        body_half_w = max(1, (spec.body_width * scale) // 2)
        body_y1 = ground_y + spec.leg_height * scale
        body_y2 = body_y1 + spec.body_height * scale - 1

        base = PALETTE_INDICES["fur_base"]
        dark = PALETTE_INDICES["fur_dark"]
        light = PALETTE_INDICES["fur_light"]
        nose = PALETTE_INDICES["nose"]
        eye = PALETTE_INDICES["eye"]
        mane = PALETTE_INDICES["mane"]
        paw = PALETTE_INDICES["paw"]
        inner_ear = PALETTE_INDICES["inner_ear"]
        marking = PALETTE_INDICES["marking"]

        # Body and torso shape.
        model.fill_ellipsoid(
            center=((body_x1 + body_x2) / 2, (body_y1 + body_y2) / 2, body_z_center),
            radii=(spec.body_length * scale / 2.05, spec.body_height * scale / 2.1, max(1.6, body_half_w + 0.3)),
            color=base,
        )
        # Chest and rump shaping.
        if spec.chest_bulge:
            model.fill_ellipsoid(
                center=(body_x1 + 3 * scale, body_y1 + spec.body_height * scale / 2, body_z_center),
                radii=(2.2 * scale, 2.0 * scale + spec.chest_bulge, body_half_w + 0.5),
                color=light,
            )
        if spec.rump_bulge:
            model.fill_ellipsoid(
                center=(body_x2 - 2 * scale, body_y1 + spec.body_height * scale / 2, body_z_center),
                radii=(2.4 * scale, 2.0 * scale + spec.rump_bulge, body_half_w + 0.5),
                color=base,
            )

        # Belly carve to keep the silhouette readable.
        model.remove_ellipsoid(
            center=((body_x1 + body_x2) / 2, body_y1 + 1 * scale, body_z_center),
            radii=(spec.body_length * scale / 3, 1.2 * scale, max(1.2, body_half_w - 0.2)),
        )

        # Legs.
        leg_x_positions = [body_x1 + 2 * scale, body_x1 + 5 * scale, body_x2 - 5 * scale, body_x2 - 2 * scale]
        leg_z_offsets = [-body_half_w + 1, body_half_w - 1]
        # front two then back two
        fore_x = leg_x_positions[:2]
        hind_x = leg_x_positions[2:]
        for x in (fore_x[0], hind_x[0]):
            for z in leg_z_offsets:
                self._add_leg(model, x, ground_y, body_y1, body_z_center + z, spec, base, paw)
        for x in (fore_x[1], hind_x[1]):
            for z in leg_z_offsets:
                self._add_leg(model, x, ground_y, body_y1, body_z_center + z, spec, dark, paw)

        # Neck and head.
        neck_start_x = body_x1 - spec.neck_length * scale
        neck_end_x = body_x1 + scale
        neck_mid_y = body_y2 - 1 * scale
        for step in range(max(1, spec.neck_length * scale)):
            x = neck_start_x + step
            y = neck_mid_y + step // max(1, scale)
            model.fill_box(x, y - scale + 1, body_z_center - body_half_w + 1,
                          x, y + scale - 1, body_z_center + body_half_w - 1, base)

        head_x1 = neck_start_x - spec.head_length * scale + 1
        head_x2 = neck_start_x
        head_y1 = body_y2 - spec.head_height * scale + 1
        head_y2 = body_y2
        head_half_w = max(1, (spec.head_width * scale) // 2)
        model.fill_ellipsoid(
            center=((head_x1 + head_x2) / 2, (head_y1 + head_y2) / 2, body_z_center),
            radii=(spec.head_length * scale / 2.2, spec.head_height * scale / 2.2, max(1.4, head_half_w + 0.2)),
            color=base,
        )

        # Muzzle.
        muzzle_x1 = head_x1 - spec.muzzle_length * scale
        muzzle_x2 = head_x1 + scale
        muzzle_half_w = max(1, head_half_w - 1)
        model.fill_box(muzzle_x1, head_y1 + scale, body_z_center - muzzle_half_w,
                      muzzle_x2, head_y1 + 2 * scale, body_z_center + muzzle_half_w, light)
        model.set_voxel(muzzle_x1, head_y1 + int(1.5 * scale), body_z_center, nose)

        # Eyes.
        eye_y = head_y2 - max(1, scale)
        model.set_voxel(head_x1 + 1 * scale, eye_y, body_z_center - head_half_w + 1, eye)
        model.set_voxel(head_x1 + 1 * scale, eye_y, body_z_center + head_half_w - 1, eye)

        # Ears.
        self._add_ears(model, head_x2 - scale, head_y2 + 1, body_z_center, head_half_w, spec, base, inner_ear)

        # Tail.
        self._add_tail(model, body_x2 + 1, body_y2 - scale, body_z_center, spec, base, dark, mane)

        # Mane.
        if spec.mane:
            model.fill_ellipsoid(
                center=(neck_start_x + scale, body_y2, body_z_center),
                radii=(2.7 * scale, 2.6 * scale, head_half_w + 1.2),
                color=mane,
            )
            model.remove_ellipsoid(
                center=(head_x1 - 0.5 * scale, head_y1 + 1.5 * scale, body_z_center),
                radii=(1.6 * scale, 1.6 * scale, head_half_w + 1),
            )

        # Markings.
        self._add_markings(model, spec, body_x1, body_x2, body_y1, body_y2, body_z_center, body_half_w, marking, light)

        return model

    def _add_leg(self, model: VoxelModel, x: int, ground_y: int, body_y1: int, z: int,
                 spec: AnimalSpec, leg_color: int, paw_color: int) -> None:
        t = max(1, spec.leg_thickness * spec.scale // 2)
        model.fill_box(x - t + 1, ground_y + 1, z - t + 1, x + t - 1, body_y1, z + t - 1, leg_color)
        model.fill_box(x - t, ground_y, z - t, x + t - 1, ground_y, z + t - 1, paw_color)

    def _add_ears(self, model: VoxelModel, x: int, y: int, zc: int, half_w: int,
                  spec: AnimalSpec, base: int, inner_ear: int) -> None:
        scale = spec.scale
        ear_zs = [zc - half_w + 1, zc + half_w - 1]
        for ez in ear_zs:
            if spec.ear_type == "pointed":
                model.add_line((x, y, ez), (x - scale, y + 2 * scale, ez), base, thickness=1)
                model.set_voxel(x - scale, y + scale, ez, inner_ear)
            elif spec.ear_type == "floppy":
                model.add_line((x, y + scale, ez), (x, y - scale, ez), base, thickness=1)
                model.add_line((x, y - scale, ez), (x - scale, y - scale - 1, ez), base, thickness=1)
            else:  # rounded
                model.fill_ellipsoid((x, y + scale, ez), (1.1 * scale, 1.0 * scale, 1.0 * scale), base)
                model.set_voxel(x, y + scale, ez, inner_ear)

    def _add_tail(self, model: VoxelModel, x: int, y: int, z: int, spec: AnimalSpec,
                  base: int, dark: int, mane: int) -> None:
        scale = spec.scale
        length = spec.tail_length * scale
        if spec.tail_type == "curled":
            points = [
                (x, y, z),
                (x + length // 3, y + scale, z),
                (x + 2 * length // 3, y + 2 * scale, z + scale // 2),
                (x + length, y + scale, z),
            ]
        elif spec.tail_type == "bushy":
            points = [(x, y, z), (x + length, y - scale, z)]
        elif spec.tail_type == "tufted":
            points = [(x, y, z), (x + length, y - scale, z)]
        elif spec.tail_type == "stub":
            points = [(x, y, z), (x + min(length, 2 * scale), y, z)]
        else:
            points = [(x, y, z), (x + length, y, z)]

        for a, b in zip(points, points[1:]):
            model.add_line(a, b, base, thickness=1)
        if spec.tail_type == "bushy":
            model.fill_ellipsoid(points[-1], (1.4 * scale, 1.1 * scale, 1.1 * scale), dark)
        if spec.tail_type == "tufted":
            model.fill_ellipsoid(points[-1], (1.2 * scale, 1.1 * scale, 1.1 * scale), mane)

    def _add_markings(self, model: VoxelModel, spec: AnimalSpec, body_x1: int, body_x2: int,
                      body_y1: int, body_y2: int, zc: int, body_half_w: int,
                      marking: int, light: int) -> None:
        scale = spec.scale
        if spec.markings == "socks":
            for (x, y, z), color in list(model.voxels.items()):
                if y <= 5 * scale and color in (PALETTE_INDICES["fur_base"], PALETTE_INDICES["fur_dark"]):
                    model.voxels[(x, y, z)] = PALETTE_INDICES["fur_light"]
        elif spec.markings == "muzzle":
            for (x, y, z), color in list(model.voxels.items()):
                if x < body_x1 - 1 * scale and color == PALETTE_INDICES["fur_base"]:
                    model.voxels[(x, y, z)] = light
        elif spec.markings == "backstripe":
            model.fill_box(body_x1 + 2 * scale, body_y2, zc - 1, body_x2 - scale, body_y2, zc + 1, marking)


# -------------------------
# CLI and export
# -------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate quadruped voxel creatures as .vox files")
    parser.add_argument("--preset", choices=sorted(PRESETS.keys()), help="Species preset to generate")
    parser.add_argument("--list-presets", action="store_true", help="List available presets")
    parser.add_argument("--out", default="./out", help="Output directory")
    parser.add_argument("--json", action="store_true", help="Also write JSON occupancy dump")
    parser.add_argument("--scale", type=int, default=None, help="Override preset scale")
    parser.add_argument("--all", action="store_true", help="Generate all presets")
    return parser.parse_args()


def write_outputs(model: VoxelModel, name: str, out_dir: Path, write_json: bool = False) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    vox_path = out_dir / f"{name}.vox"
    vox_path.write_bytes(model.to_vox_bytes())
    if write_json:
        (out_dir / f"{name}.json").write_text(json.dumps(model.to_json_dict(), indent=2))



def main() -> None:
    args = parse_args()
    if args.list_presets:
        for name in sorted(PRESETS.keys()):
            spec = PRESETS[name]
            print(f"{name}: family={spec.family}, skin={spec.skin}, mane={spec.mane}, tail={spec.tail_type}")
        return

    if not args.preset and not args.all:
        raise SystemExit("Choose --preset <name> or --all")

    generator = AnimalGenerator()
    out_dir = Path(args.out)

    names = sorted(PRESETS.keys()) if args.all else [args.preset]
    for name in names:
        spec = PRESETS[name]
        if args.scale is not None:
            spec = AnimalSpec(**{**spec.__dict__, "scale": args.scale})
        model = generator.generate(spec)
        write_outputs(model, spec.name, out_dir, write_json=args.json)
        print(f"Wrote {spec.name}.vox to {out_dir}")


if __name__ == "__main__":
    main()
