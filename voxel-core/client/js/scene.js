/**
 * Scene management.
 *
 * Owns the three.js renderer, the chunk meshes, remote avatars, ground items
 * and the block highlight. Everything it draws is driven by `ClientWorld`
 * state, so the renderer never talks to the network directly.
 */

import * as THREE from 'three';
import { CHUNK_SIZE } from '/src/core/constants.js';
import { chunkKey } from '/src/world/coords.js';
import { PlayerAvatar, updateBillboards } from './player-avatar.js';
import { ChunkMesher } from './chunk-mesher.js';
import { EntityView } from './entity-view.js';

const SKY_COLOR = 0x8fc0e8;
/** Chunks remeshed per frame; keeps a burst of arrivals from stalling input. */
const REMESH_BUDGET = 2;

export class SceneView {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./world-view.js').ClientWorld} world
   * @param {import('/src/content/index.js').Content} content
   */
  constructor(canvas, world, content) {
    this.world = world;
    this.content = content;
    this.mesher = new ChunkMesher(content);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
    this.renderer.setClearColor(SKY_COLOR);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, CHUNK_SIZE * 2, CHUNK_SIZE * 6);

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(40, 80, 25);
    this.scene.add(sun);

    /** @type {Map<string, {opaque: THREE.Mesh|null, transparent: THREE.Mesh|null}>} */
    this.chunkMeshes = new Map();
    /** @type {Map<string, PlayerAvatar>} */
    this.avatars = new Map();
    /** @type {Map<string, THREE.Mesh>} */
    this.groundItems = new Map();
    /** @type {Map<string, EntityView>} */
    this.entities = new Map();

    this.highlight = makeHighlight();
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.groundItemGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);

    this.resize();
    globalThis.addEventListener('resize', () => this.resize());
  }

  resize() {
    const width = globalThis.innerWidth;
    const height = globalThis.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Set the fog/far plane to match the server's view distance. */
  setViewDistance(chunks) {
    const far = Math.max(2, chunks) * CHUNK_SIZE;
    this.scene.fog.near = far * 0.55;
    this.scene.fog.far = far;
    this.camera.far = far + CHUNK_SIZE * 2;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ chunk mesh

  /** Rebuild at most `REMESH_BUDGET` dirty chunks. */
  remeshDirty() {
    const keys = this.world.takeDirty();
    const deferred = keys.slice(REMESH_BUDGET);
    for (const key of keys.slice(0, REMESH_BUDGET)) this._remesh(key);
    for (const key of deferred) this.world.dirty.add(key);
    return keys.length - deferred.length;
  }

  _remesh(key) {
    const chunk = this.world.chunks.get(key);
    if (!chunk) {
      this.removeChunk(key);
      return;
    }
    const built = this.mesher.build(chunk, this.world.getBlock);
    const existing = this.chunkMeshes.get(key) ?? { opaque: null, transparent: null };

    existing.opaque = this._swap(existing.opaque, built.opaque, this.mesher.opaqueMaterial);
    existing.transparent = this._swap(existing.transparent, built.transparent, this.mesher.transparentMaterial);
    this.chunkMeshes.set(key, existing);
  }

  _swap(mesh, geometry, material) {
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    if (!geometry) return null;
    const next = new THREE.Mesh(geometry, material);
    next.frustumCulled = true;
    this.scene.add(next);
    return next;
  }

  /** @param {string} key */
  removeChunk(key) {
    const meshes = this.chunkMeshes.get(key);
    if (!meshes) return;
    for (const mesh of [meshes.opaque, meshes.transparent]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.chunkMeshes.delete(key);
  }

  /** @param {number} chunkX @param {number} chunkZ */
  removeChunkAt(chunkX, chunkZ) {
    this.removeChunk(chunkKey(chunkX, chunkZ));
  }

  // -------------------------------------------------------------- avatars

  /**
   * @param {{ id: string, username?: string }} state
   * @param {{ local?: boolean }} [options]
   */
  addAvatar(state, { local = false } = {}) {
    const existing = this.avatars.get(state.id);
    if (existing) return existing;
    const avatar = new PlayerAvatar({
      id: state.id,
      username: state.username ?? '',
      showNameplate: !local,
    });
    avatar.applyState(state, true);
    this.scene.add(avatar.root);
    this.avatars.set(state.id, avatar);
    return avatar;
  }

  /** @param {string} id */
  removeAvatar(id) {
    const avatar = this.avatars.get(id);
    if (!avatar) return;
    this.scene.remove(avatar.root);
    avatar.dispose();
    this.avatars.delete(id);
  }

  /** @param {object} state */
  updateAvatar(state) {
    this.avatars.get(state.id)?.applyState(state);
  }

  // ------------------------------------------------------------- entities

  /** @param {object[]} states */
  addEntities(states = []) {
    for (const state of states) {
      const existing = this.entities.get(state.id);
      if (existing) {
        existing.applyState(state, true);
        continue;
      }
      const def = this.content.entities.get(state.def);
      if (!def) continue;
      const view = new EntityView(state, def);
      this.scene.add(view.root);
      this.entities.set(state.id, view);
    }
  }

  /** @param {object[]} states */
  updateEntities(states = []) {
    for (const state of states) {
      const view = this.entities.get(state.id);
      if (view) view.applyState(state);
      else this.addEntities([state]);
    }
  }

  /** @param {string[]} ids */
  removeEntities(ids = []) {
    for (const id of ids) {
      const view = this.entities.get(id);
      if (!view) continue;
      this.scene.remove(view.root);
      view.dispose();
      this.entities.delete(id);
    }
  }

  /** @param {{ id: string, action: string }} payload */
  entityAction({ id, action }) {
    this.entities.get(id)?.playAction(action);
  }

  // --------------------------------------------------------- ground items

  /** @param {Array<object>} items */
  addGroundItems(items = []) {
    for (const entity of items) {
      let mesh = this.groundItems.get(entity.id);
      if (!mesh) {
        const color = new THREE.Color(this.colorForItem(entity.item));
        mesh = new THREE.Mesh(this.groundItemGeometry, new THREE.MeshLambertMaterial({ color }));
        this.scene.add(mesh);
        this.groundItems.set(entity.id, mesh);
      }
      mesh.position.set(entity.x, entity.y + 0.25, entity.z);
      mesh.userData.spawnY = entity.y + 0.25;
    }
  }

  /** @param {string[]} ids */
  removeGroundItems(ids = []) {
    for (const id of ids) {
      const mesh = this.groundItems.get(id);
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.material.dispose();
      this.groundItems.delete(id);
    }
  }

  /** @param {string} itemId */
  colorForItem(itemId) {
    const def = this.content.item(itemId);
    if (def?.placeable) {
      const block = this.content.blockByName(def.placeable);
      if (block?.color) return block.color;
    }
    return def?.color ?? '#c8ccd2';
  }

  // ------------------------------------------------------------ highlight

  /** @param {{x: number, y: number, z: number}|null} position */
  setHighlight(position) {
    if (!position) {
      this.highlight.visible = false;
      return;
    }
    this.highlight.visible = true;
    this.highlight.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5);
  }

  // ----------------------------------------------------------------- loop

  /**
   * @param {number} dt
   * @param {{ localId: string|null, localSpeed: number }} context
   */
  update(dt, { localId = null, localSpeed = 0 } = {}) {
    updateBillboards(this.camera);
    for (const [id, avatar] of this.avatars) {
      avatar.update(dt, { interpolate: id !== localId, speed: id === localId ? localSpeed : null });
    }
    for (const view of this.entities.values()) view.update(dt);
    const spin = performance.now() / 1000;
    for (const mesh of this.groundItems.values()) {
      mesh.rotation.y = spin;
      mesh.position.y = mesh.userData.spawnY + Math.sin(spin * 2) * 0.06;
    }
    this.remeshDirty();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

/** Wireframe cube drawn around the focused block. */
function makeHighlight() {
  const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
  const edges = new THREE.EdgesGeometry(box);
  box.dispose();
  return new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x101010, transparent: true, opacity: 0.6 }),
  );
}
