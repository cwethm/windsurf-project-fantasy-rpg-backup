/**
 * Voxel player avatar.
 *
 * A blocky humanoid built from boxes with a procedural walk cycle. Used for
 * both remote players and the local player's own body, so first person and
 * third person share one rig. The camera mounts on `head`.
 */

import * as THREE from 'three';
import { PLAYER_HEIGHT, PLAYER_EYE_HEIGHT } from '/src/core/constants.js';

/** Proportions, in world units, of a 1.8 m tall figure. */
const SCALE = PLAYER_HEIGHT / 1.8;
const PART = {
  head: { size: [0.5, 0.5, 0.5], pivot: [0, 1.65, 0] },
  torso: { size: [0.55, 0.7, 0.3], pivot: [0, 1.05, 0] },
  armLeft: { size: [0.2, 0.65, 0.2], pivot: [0.38, 1.35, 0] },
  armRight: { size: [0.2, 0.65, 0.2], pivot: [-0.38, 1.35, 0] },
  legLeft: { size: [0.22, 0.7, 0.22], pivot: [0.15, 0.7, 0] },
  legRight: { size: [0.22, 0.7, 0.22], pivot: [-0.15, 0.7, 0] },
};

const SKIN = 0xe0ac69;
const SHIRT = 0x3f7fbf;
const PANTS = 0x394b59;

/** Deterministic per-player tint so avatars are distinguishable. */
function tintFor(id) {
  let hash = 0;
  for (let i = 0; i < String(id).length; i++) {
    hash = (hash * 31 + String(id).charCodeAt(i)) >>> 0;
  }
  return new THREE.Color().setHSL((hash % 360) / 360, 0.45, 0.55);
}

export class PlayerAvatar {
  /**
   * @param {{ id: string, username?: string, showNameplate?: boolean }} options
   */
  constructor({ id, username = '', showNameplate = true }) {
    this.id = id;
    this.username = username;

    this.root = new THREE.Group();
    this.root.name = `avatar:${id}`;

    /** Yaw is applied to the body; pitch only to the head. */
    this.body = new THREE.Group();
    this.root.add(this.body);

    const tint = tintFor(id);
    const shirt = new THREE.Color(SHIRT).lerp(tint, 0.6);
    const pants = new THREE.Color(PANTS).lerp(tint, 0.3);

    this.parts = {
      head: this._makePart(PART.head, SKIN),
      torso: this._makePart(PART.torso, shirt),
      armLeft: this._makePart(PART.armLeft, shirt, 'top'),
      armRight: this._makePart(PART.armRight, shirt, 'top'),
      legLeft: this._makePart(PART.legLeft, pants, 'top'),
      legRight: this._makePart(PART.legRight, pants, 'top'),
    };
    for (const part of Object.values(this.parts)) this.body.add(part);

    /** Empty the held item mesh is parented to. */
    this.handAnchor = new THREE.Group();
    this.handAnchor.position.set(0, -0.62 * SCALE, -0.1 * SCALE);
    this.parts.armRight.add(this.handAnchor);
    /** @type {THREE.Object3D|null} */
    this.heldMesh = null;
    this.heldItem = null;

    // The camera mount. Placed so its world height is exactly
    // PLAYER_EYE_HEIGHT — the same origin the shared raycast uses — otherwise
    // the crosshair and the highlighted block would disagree.
    this.eye = new THREE.Object3D();
    this.eye.position.set(0, PLAYER_EYE_HEIGHT - PART.head.pivot[1] * SCALE, 0);
    this.parts.head.add(this.eye);

    this.nameplate = showNameplate && username ? makeNameplate(username) : null;
    if (this.nameplate) {
      this.nameplate.position.set(0, 2.15 * SCALE, 0);
      this.root.add(this.nameplate);
    }

    this.phase = 0;
    this.animation = 'idle';
    /** Smoothed remote position, so other players do not teleport each frame. */
    this.target = { position: new THREE.Vector3(), yaw: 0, pitch: 0, valid: false };
  }

  /**
   * Box mesh whose geometry is offset so the group's origin is the joint.
   * `anchor: 'top'` pivots limbs at the shoulder/hip rather than the centre.
   */
  _makePart({ size, pivot }, color, anchor = 'center') {
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(size[0] * SCALE, size[1] * SCALE, size[2] * SCALE);
    if (anchor === 'top') geometry.translate(0, (-size[1] / 2) * SCALE, 0);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }));
    mesh.castShadow = true;
    group.add(mesh);
    group.userData.mesh = mesh;
    group.position.set(pivot[0] * SCALE, pivot[1] * SCALE, pivot[2] * SCALE);
    return group;
  }

  /**
   * Hide the head box so a first-person camera is not inside it. Only the mesh
   * is hidden, never the head group, because the camera hangs off it.
   */
  setFirstPerson(firstPerson) {
    this.parts.head.userData.mesh.visible = !firstPerson;
    if (this.nameplate) this.nameplate.visible = !firstPerson;
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    this.root.visible = visible;
  }

  /**
   * Show a small cube in the right hand for the held item.
   * @param {string|null} item item id, or null for an empty hand
   * @param {(item: string) => number|string} colorFor
   */
  setHeldItem(item, colorFor) {
    if (item === this.heldItem) return;
    this.heldItem = item;
    if (this.heldMesh) {
      this.handAnchor.remove(this.heldMesh);
      this.heldMesh.geometry.dispose();
      this.heldMesh.material.dispose();
      this.heldMesh = null;
    }
    if (!item) return;
    const geometry = new THREE.BoxGeometry(0.24 * SCALE, 0.24 * SCALE, 0.24 * SCALE);
    const material = new THREE.MeshLambertMaterial({ color: colorFor(item) });
    this.heldMesh = new THREE.Mesh(geometry, material);
    this.handAnchor.add(this.heldMesh);
  }

  /**
   * Snap or interpolate towards a network state.
   * @param {{ position: object, yaw: number, pitch: number, animation?: string }} state
   * @param {boolean} [snap]
   */
  applyState(state, snap = false) {
    this.target.position.set(state.position.x, state.position.y, state.position.z);
    this.target.yaw = state.yaw ?? 0;
    this.target.pitch = state.pitch ?? 0;
    this.target.valid = true;
    this.animation = state.animation ?? this.animation;
    if (snap) {
      this.root.position.copy(this.target.position);
      this.body.rotation.y = this.target.yaw;
      this.parts.head.rotation.x = this.target.pitch;
    }
  }

  /** Set the transform directly; used for the locally simulated player. */
  setTransform(position, yaw, pitch) {
    this.root.position.set(position.x, position.y, position.z);
    this.body.rotation.y = yaw;
    this.parts.head.rotation.x = pitch;
  }

  /**
   * Advance the walk cycle and (for remote avatars) smooth towards the last
   * received state.
   *
   * @param {number} dt seconds
   * @param {{ interpolate?: boolean, speed?: number }} [options]
   */
  update(dt, { interpolate = true, speed = null } = {}) {
    if (interpolate && this.target.valid) {
      const blend = 1 - Math.exp(-12 * dt);
      this.root.position.lerp(this.target.position, blend);
      this.body.rotation.y = lerpAngle(this.body.rotation.y, this.target.yaw, blend);
      this.parts.head.rotation.x = lerpAngle(this.parts.head.rotation.x, this.target.pitch, blend);
    }

    const moving = this.animation === 'walk' || this.animation === 'run';
    const cadence = this.animation === 'run' ? 11 : 7;
    const stride = this.animation === 'run' ? 1.1 : 0.75;

    if (moving) {
      this.phase += dt * cadence * (speed ? Math.max(0.35, speed / 4.5) : 1);
    } else {
      // Ease the swing back to neutral instead of snapping.
      this.phase += dt * 2.2;
    }

    const swing = moving ? Math.sin(this.phase) * stride : Math.sin(this.phase) * 0.06;
    this.parts.legLeft.rotation.x = swing;
    this.parts.legRight.rotation.x = -swing;
    this.parts.armLeft.rotation.x = -swing * 0.8;
    this.parts.armRight.rotation.x = swing * 0.8;

    // Only the torso bobs: the head carries the camera, and moving it would
    // shift the view origin away from the one used for targeting.
    const bob = moving ? Math.abs(Math.sin(this.phase)) * 0.045 : 0;
    this.parts.torso.position.y = PART.torso.pivot[1] * SCALE + bob;

    if (this.animation === 'fall') {
      this.parts.armLeft.rotation.x = -2.2;
      this.parts.armRight.rotation.x = -2.2;
    }
    if (this.nameplate) this.nameplate.quaternion.copy(cameraFacing);
  }

  /** Release GPU resources. */
  dispose() {
    this.root.traverse((object) => {
      if (object.isMesh || object.isSprite) {
        object.geometry?.dispose?.();
        object.material?.map?.dispose?.();
        object.material?.dispose?.();
      }
    });
  }
}

/** Shared billboard orientation, refreshed once per frame by the renderer. */
const cameraFacing = new THREE.Quaternion();

/** @param {THREE.Camera} camera */
export function updateBillboards(camera) {
  camera.getWorldQuaternion(cameraFacing);
}

/** Canvas-texture nameplate. */
function makeNameplate(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 16), canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.25),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  sprite.renderOrder = 10;
  return sprite;
}

/** Shortest-path angular interpolation. */
function lerpAngle(from, to, t) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}
