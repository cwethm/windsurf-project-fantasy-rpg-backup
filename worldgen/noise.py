"""
Noise generation utilities for terrain and climate.
Provides various noise functions for deterministic generation.
"""

import math
import random
from typing import Tuple


class NoiseGenerator:
    """Base noise generator using improved Perlin-like algorithm."""
    
    def __init__(self, seed: int):
        self.seed = seed
        random.seed(seed)
        # Generate permutation table
        self.permutation = list(range(256))
        random.shuffle(self.permutation)
        self.permutation = self.permutation + self.permutation  # Duplicate for overflow
    
    def fade(self, t: float) -> float:
        """Smoothing function."""
        return t * t * t * (t * (t * 6 - 15) + 10)
    
    def lerp(self, a: float, b: float, t: float) -> float:
        """Linear interpolation."""
        return a + t * (b - a)
    
    def grad(self, hash_val: int, x: float, y: float, z: float = 0) -> float:
        """Gradient function."""
        h = hash_val & 15
        u = x if h < 8 else y
        v = y if h < 4 else (x if h == 12 or h == 14 else z)
        return (u if (h & 1) == 0 else -u) + (v if (h & 2) == 0 else -v)
    
    def noise_2d(self, x: float, y: float) -> float:
        """Generate 2D Perlin-like noise."""
        # Find unit cube that contains point
        X = math.floor(x) & 255
        Y = math.floor(y) & 255
        
        # Find relative x, y, z in cube
        x -= math.floor(x)
        y -= math.floor(y)
        
        # Compute fade curves
        u = self.fade(x)
        v = self.fade(y)
        
        # Hash coordinates of the cube corners
        A = self.permutation[X] + Y
        AA = self.permutation[A]
        AB = self.permutation[A + 1]
        B = self.permutation[X + 1] + Y
        BA = self.permutation[B]
        BB = self.permutation[B + 1]
        
        # Add blended results from corners
        return self.lerp(
            self.lerp(
                self.grad(self.permutation[AA], x, y),
                self.grad(self.permutation[BA], x - 1, y),
                u
            ),
            self.lerp(
                self.grad(self.permutation[AB], x, y - 1),
                self.grad(self.permutation[BB], x - 1, y - 1),
                u
            ),
            v
        )
    
    def noise_3d(self, x: float, y: float, z: float) -> float:
        """Generate 3D Perlin-like noise."""
        # Find unit cube that contains point
        X = math.floor(x) & 255
        Y = math.floor(y) & 255
        Z = math.floor(z) & 255
        
        # Find relative x, y, z in cube
        x -= math.floor(x)
        y -= math.floor(y)
        z -= math.floor(z)
        
        # Compute fade curves
        u = self.fade(x)
        v = self.fade(y)
        w = self.fade(z)
        
        # Hash coordinates
        A = self.permutation[X] + Y
        AA = self.permutation[A] + Z
        AB = self.permutation[A + 1] + Z
        B = self.permutation[X + 1] + Y
        BA = self.permutation[B] + Z
        BB = self.permutation[B + 1] + Z
        
        # Add blended results
        return self.lerp(
            self.lerp(
                self.lerp(
                    self.grad(self.permutation[AA], x, y, z),
                    self.grad(self.permutation[BA], x - 1, y, z),
                    u
                ),
                self.lerp(
                    self.grad(self.permutation[AB], x, y - 1, z),
                    self.grad(self.permutation[BB], x - 1, y - 1, z),
                    u
                ),
                v
            ),
            self.lerp(
                self.lerp(
                    self.grad(self.permutation[AA + 1], x, y, z - 1),
                    self.grad(self.permutation[BA + 1], x - 1, y, z - 1),
                    u
                ),
                self.lerp(
                    self.grad(self.permutation[AB + 1], x, y - 1, z - 1),
                    self.grad(self.permutation[BB + 1], x - 1, y - 1, z - 1),
                    u
                ),
                v
            ),
            w
        )
    
    def fractal_noise_2d(self, x: float, y: float, octaves: int = 4, 
                         persistence: float = 0.5, lacunarity: float = 2.0) -> float:
        """Generate fractal (FBM) noise."""
        value = 0.0
        amplitude = 1.0
        frequency = 1.0
        max_value = 0.0
        
        for _ in range(octaves):
            value += self.noise_2d(x * frequency, y * frequency) * amplitude
            max_value += amplitude
            amplitude *= persistence
            frequency *= lacunarity
        
        return value / max_value
    
    def ridged_noise_2d(self, x: float, y: float, octaves: int = 4) -> float:
        """Generate ridged noise for mountain ranges."""
        value = 0.0
        amplitude = 1.0
        frequency = 1.0
        
        for _ in range(octaves):
            n = abs(self.noise_2d(x * frequency, y * frequency))
            n = 1.0 - n
            value += n * amplitude
            amplitude *= 0.5
            frequency *= 2.0
        
        return value
    
    def cellular_noise_2d(self, x: float, y: float, cell_size: float = 10.0) -> float:
        """GenerateWorley-like cellular noise for biome patterns."""
        # Cell coordinates
        cell_x = math.floor(x / cell_size)
        cell_y = math.floor(y / cell_size)
        
        # Position within cell
        local_x = (x / cell_size) - cell_x
        local_y = (y / cell_size) - cell_y
        
        # Find distances to nearby cell points
        min_dist = 1.0
        
        for i in range(-1, 2):
            for j in range(-1, 2):
                # Random point in neighboring cell
                neighbor_x = cell_x + i
                neighbor_y = cell_y + j
                
                # Deterministic random point within cell
                random.seed(self.seed + neighbor_x * 10000 + neighbor_y)
                point_x = random.random()
                point_y = random.random()
                
                # Distance to point
                dx = local_x - (point_x + i)
                dy = local_y - (point_y + j)
                dist = math.sqrt(dx * dx + dy * dy)
                
                min_dist = min(min_dist, dist)
        
        return min_dist
