/**
 * Chunk mesher.
 *
 * Builds one BufferGeometry per chunk with hidden faces culled and a small
 * amount of baked ambient occlusion. Colours come straight from the block
 * registry, so a new block type renders without touching this file.
 */

import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '/src/core/constants.js';

/** Face definitions: normal, the four corner offsets, and a shade multiplier. */
const FACES = [
  { dir: [0, 1, 0], shade: 1.0, corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.5, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { dir: [1, 0, 0], shade: 0.82, corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { dir: [-1, 0, 0], shade: 0.72, corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { dir: [0, 0, 1], shade: 0.9, corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { dir: [0, 0, -1], shade: 0.64, corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

const AIR = 0;

export class ChunkMesher {
  /** @param {import('/src/content/index.js').Content} content */
  constructor(content) {
    this.content = content;
    /** Cached per-block-id colours so we allocate one Color per type. */
    this._colors = new Map();
    this.opaqueMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.transparentMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /** @param {number} blockId */
  colorOf(blockId) {
    let color = this._colors.get(blockId);
    if (!color) {
      const def = this.content.block(blockId);
      color = new THREE.Color(def?.color ?? '#ff00ff');
      color.convertSRGBToLinear();
      this._colors.set(blockId, color);
    }
    return color;
  }

  /**
   * Build the opaque and transparent geometry for one chunk.
   *
   * @param {import('/src/world/chunk.js').Chunk} chunk
   * @param {(x: number, y: number, z: number) => number} sampleWorld
   *   world-space block lookup, used so faces on chunk borders are culled
   *   against the neighbouring chunk rather than against air
   * @returns {{ opaque: THREE.BufferGeometry|null, transparent: THREE.BufferGeometry|null }}
   */
  build(chunk, sampleWorld) {
    const originX = chunk.chunkX * CHUNK_SIZE;
    const originZ = chunk.chunkZ * CHUNK_SIZE;

    const opaque = new MeshBuilder();
    const transparent = new MeshBuilder();

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const blockId = chunk.get(lx, ly, lz);
          if (blockId === AIR) continue;

          const def = this.content.block(blockId);
          if (!def) continue;

          const target = def.transparent || def.liquid ? transparent : opaque;
          const color = this.colorOf(blockId);
          const wx = originX + lx;
          const wz = originZ + lz;

          for (const face of FACES) {
            const nx = wx + face.dir[0];
            const ny = ly + face.dir[1];
            const nz = wz + face.dir[2];
            const neighbour = ny < 0 || ny >= CHUNK_HEIGHT ? AIR : sampleWorld(nx, ny, nz);
            if (!this._faceVisible(def, neighbour)) continue;
            target.addFace(wx, ly, wz, face, color);
          }
        }
      }
    }

    return {
      opaque: opaque.isEmpty() ? null : opaque.toGeometry(),
      transparent: transparent.isEmpty() ? null : transparent.toGeometry(),
    };
  }

  /**
   * A face is drawn when its neighbour does not fully hide it. Same-type
   * transparent blocks (a lake, a glass wall) hide each other so interiors
   * stay clean.
   */
  _faceVisible(def, neighbourId) {
    if (neighbourId === AIR) return true;
    const neighbour = this.content.block(neighbourId);
    if (!neighbour) return true;
    if (!neighbour.transparent && !neighbour.liquid) return false;
    return neighbour.name !== def.name;
  }
}

/** Accumulates interleaved vertex data for one material. */
class MeshBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.indices = [];
  }

  isEmpty() {
    return this.indices.length === 0;
  }

  addFace(x, y, z, face, color) {
    const base = this.positions.length / 3;
    for (const [cx, cy, cz] of face.corners) {
      this.positions.push(x + cx, y + cy, z + cz);
      this.normals.push(face.dir[0], face.dir[1], face.dir[2]);
      this.colors.push(color.r * face.shade, color.g * face.shade, color.b * face.shade);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  toGeometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }
}
