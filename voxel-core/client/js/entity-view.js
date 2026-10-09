/**
 * Procedural low-poly entity views.
 *
 * Each entity is rebuilt on the client from its definition's form code plus
 * the individual's seed and scale, so the server never streams geometry. A
 * body-plan builder turns resolved features into a rig of pivot groups (bones)
 * and boxes; a body-plan animator drives those bones from the entity's
 * animation state (idle, walk, run, graze, dead).
 *
 * Adding a body plan is one entry in BUILDERS and one in ANIMATORS.
 */

import * as THREE from 'three';
import { Random } from '/src/core/rng.js';
import { resolveForm, formDimensions } from '/src/entity/form-code.js';

const U = 1 / 16;
const HORN = 0xd9cfb3;
const HOOF = 0x2b2420;

const lerp = (a, b, t) => a + (b - a) * t;

function lerpAngle(from, to, t) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

/** Helper that tracks materials so hurt-flash and disposal reach every box. */
class RigBuilder {
  constructor() {
    this.materials = [];
  }

  material(color) {
    const material = new THREE.MeshLambertMaterial({ color });
    this.materials.push(material);
    return material;
  }

  /**
   * A box in 1/16 units. `offset` moves the geometry relative to its parent
   * pivot, so pivots stay at joints.
   */
  box(parent, [w, h, d], color, offset = [0, 0, 0]) {
    const geometry = new THREE.BoxGeometry(Math.max(w, 0.2) * U, Math.max(h, 0.2) * U, Math.max(d, 0.2) * U);
    geometry.translate(offset[0] * U, offset[1] * U, offset[2] * U);
    const mesh = new THREE.Mesh(geometry, typeof color === 'object' ? color : this.material(color));
    parent.add(mesh);
    return mesh;
  }

  pivot(parent, [x, y, z]) {
    const group = new THREE.Group();
    group.position.set(x * U, y * U, z * U);
    parent.add(group);
    return group;
  }
}

/** Darken a hex colour. */
function shade(color, amount) {
  return new THREE.Color(color).multiplyScalar(amount).getHex();
}

/**
 * Large quadruped (Q). Faces -Z; the root origin is between the feet.
 * @returns {Record<string, THREE.Object3D>} bones
 */
function buildQuadruped(rig, root, f, rng) {
  const p = (op, key, fallback = 0) => f[op]?.params[key] ?? fallback;
  const pattern = f.pt ?? { words: ['solid'], colors: [] };
  const base = pattern.colors[0] ?? 0x8a6a4a;
  const accent = pattern.colors[1] ?? shade(base, 0.6);
  const fleece = p('fl', 'D');

  const bodyL = p('bd', 'L');
  const bodyW = p('bd', 'W');
  const bodyH = p('bd', 'H');
  const legL = p('lg', 'L');
  const legT = p('lg', 'T');
  const bodyY = legL + bodyH / 2 + fleece;

  const bones = { root };
  const body = rig.pivot(root, [0, bodyY, 0]);
  bones.body = body;
  const coat = fleece > 0 ? rig.material(base) : null;
  rig.box(body, [bodyW, bodyH, bodyL], fleece > 0 ? shade(base, 0.85) : base);
  if (coat) rig.box(body, [bodyW + fleece * 2, bodyH + fleece * 2, bodyL + fleece], coat);

  const style = pattern.words[0];
  const sideX = bodyW / 2 + fleece + 0.15;
  if (style === 'patch' || style === 'spot') {
    const count = style === 'patch' ? 4 : 9;
    for (let i = 0; i < count; i++) {
      const size = style === 'patch' ? rng.range(3, 5) : rng.range(1, 1.6);
      const side = i % 2 === 0 ? 1 : -1;
      const z = rng.range(-bodyL / 2 + size / 2, bodyL / 2 - size / 2);
      const y = rng.range(-bodyH / 2 + size / 2, bodyH / 2 - size / 2);
      rig.box(body, [0.3, size, size * rng.range(0.8, 1.4)], accent, [side * sideX, y, z]);
    }
    if (style === 'patch') rig.box(body, [rng.range(3, bodyW), 0.3, rng.range(3, 6)], accent, [0, bodyH / 2 + 0.15, rng.range(-3, 3)]);
  } else if (style === 'stripe') {
    for (let z = -bodyL / 2 + 1.5; z < bodyL / 2; z += 3) {
      rig.box(body, [bodyW + fleece * 2 + 0.3, bodyH * 0.8, 0.8], accent, [0, bodyH * 0.1, z]);
    }
  }

  const legMat = rig.material(fleece > 0 ? shade(accent, 1) : base);
  const hoofMat = rig.material(HOOF);
  const hipX = bodyW / 2 - legT / 2;
  const hipZ = bodyL / 2 - legT / 2 - 0.5;
  for (const [name, sx, sz] of [['leg_fl', 1, -1], ['leg_fr', -1, -1], ['leg_bl', 1, 1], ['leg_br', -1, 1]]) {
    const leg = rig.pivot(root, [sx * hipX, legL, sz * hipZ]);
    rig.box(leg, [legT, legL - 1, legT], legMat, [0, -(legL - 1) / 2, 0]);
    rig.box(leg, [legT + 0.2, 1, legT + 0.2], hoofMat, [0, -legL + 0.5, 0]);
    bones[name] = leg;
  }

  if (f.ud) rig.box(body, [3, 1.5, 3], 0xe8a0a8, [0, -bodyH / 2 - 0.6, bodyL / 2 - 4]);

  const neckL = p('nk', 'L');
  const neckA = (p('nk', 'A') * Math.PI) / 180;
  const neck = rig.pivot(body, [0, bodyH * 0.25, -bodyL / 2 + 1]);
  neck.rotation.x = neckA;
  neck.userData.rest = neckA;
  const neckT = Math.min(bodyW, p('hd', 'W') + 1);
  if (neckL > 0) rig.box(neck, [neckT, neckT, neckL + 1], fleece > 0 ? coat : base, [0, 0, -neckL / 2]);
  if (f.mn) rig.box(neck, [1.2, p('mn', 'L'), neckL + 1], shade(accent, 0.8), [0, neckT / 2 + p('mn', 'L') / 2 - 0.5, -neckL / 2]);
  bones.neck = neck;

  const headL = p('hd', 'L');
  const headW = p('hd', 'W');
  const headH = p('hd', 'H');
  const head = rig.pivot(neck, [0, 0, -neckL]);
  head.rotation.x = -neckA * 0.75;
  head.userData.rest = head.rotation.x;
  rig.box(head, [headW, headH, headL], base, [0, 0, -headL / 2]);
  if (f.sn) rig.box(head, [headW * 0.8, headH * 0.6, p('sn', 'L')], shade(base, 0.8), [0, -headH * 0.2, -headL - p('sn', 'L') / 2]);
  const eyeMat = rig.material(0x111111);
  for (const sx of [1, -1]) rig.box(head, [0.4, 0.8, 0.8], eyeMat, [sx * (headW / 2 + 0.1), headH * 0.15, -headL * 0.6]);
  bones.head = head;

  if (f.ea) {
    const earL = p('ea', 'L');
    for (const sx of [1, -1]) {
      const ear = rig.pivot(head, [sx * (headW / 2), headH / 2 - 0.5, -headL * 0.15]);
      ear.rotation.z = sx * -0.9;
      rig.box(ear, [0.6, earL, 1.2], shade(base, 0.9), [0, earL / 2, 0]);
    }
  }
  if (f.hn) {
    const hornMat = rig.material(HORN);
    const count = Math.max(1, p('hn', 'n', 2));
    const length = p('hn', 'L');
    const curl = p('hn', 'C');
    for (let i = 0; i < count; i++) {
      const sx = count === 1 ? 0 : i % 2 === 0 ? 1 : -1;
      const horn = rig.pivot(head, [sx * (headW / 2 - 0.5), headH / 2, -headL * 0.25]);
      horn.rotation.z = sx * -1.1;
      horn.rotation.x = -0.3 - curl * 0.4;
      rig.box(horn, [0.8, length, 0.8], hornMat, [0, length / 2, 0]);
    }
  }
  if (f.an) {
    const antlerMat = rig.material(shade(HORN, 0.85));
    const length = p('an', 'L');
    const tines = Math.max(1, p('an', 'n', 3));
    for (const sx of [1, -1]) {
      const beam = rig.pivot(head, [sx * (headW / 2 - 0.6), headH / 2, -headL * 0.3]);
      beam.rotation.z = sx * -0.5;
      beam.rotation.x = 0.35;
      rig.box(beam, [0.6, length, 0.6], antlerMat, [0, length / 2, 0]);
      for (let t = 0; t < tines; t++) {
        const tine = rig.pivot(beam, [0, (length * (t + 1)) / (tines + 1), 0]);
        tine.rotation.x = -0.9;
        tine.rotation.z = sx * rng.range(-0.3, 0.3);
        rig.box(tine, [0.5, length * 0.35, 0.5], antlerMat, [0, (length * 0.35) / 2, 0]);
      }
    }
  }

  if (f.tl) {
    const tail = rig.pivot(body, [0, bodyH / 2 - 0.5, bodyL / 2]);
    tail.rotation.x = 0.35;
    rig.box(tail, [p('tl', 'T', 1), p('tl', 'L'), p('tl', 'T', 1)], fleece > 0 ? coat : shade(base, 0.9), [0, -p('tl', 'L') / 2, 0]);
    bones.tail = tail;
  }
  return bones;
}

/** Procedural quadruped motion: diagonal-pair gait, grazing, tail sway. */
function animateQuadruped(view, dt) {
  const { bones, anim } = view;
  const moving = anim === 'walk' || anim === 'run';
  const cadence = anim === 'run' ? 12 : 6.5;
  view.phase += dt * (moving ? cadence : 1.5);
  const amp = moving ? (anim === 'run' ? 0.85 : 0.5) : 0;
  const swing = Math.sin(view.phase) * amp;
  bones.leg_fl.rotation.x = lerp(bones.leg_fl.rotation.x, swing, 0.4);
  bones.leg_br.rotation.x = lerp(bones.leg_br.rotation.x, swing, 0.4);
  bones.leg_fr.rotation.x = lerp(bones.leg_fr.rotation.x, -swing, 0.4);
  bones.leg_bl.rotation.x = lerp(bones.leg_bl.rotation.x, -swing, 0.4);

  const bob = moving ? Math.abs(Math.sin(view.phase)) * (anim === 'run' ? 0.06 : 0.03) : Math.sin(view.phase) * 0.008;
  bones.body.position.y = bones.body.userData.restY + bob;

  const neckRest = bones.neck.userData.rest;
  const grazing = anim === 'graze';
  const neckTarget = grazing ? -0.9 + Math.sin(view.phase * 3) * 0.06 : neckRest + (moving ? Math.sin(view.phase * 2) * 0.05 : 0);
  bones.neck.rotation.x = lerp(bones.neck.rotation.x, neckTarget, 1 - Math.exp(-5 * dt));

  if (bones.tail) bones.tail.rotation.z = Math.sin(view.phase * (moving ? 1 : 2.5)) * 0.35;
}

const BUILDERS = { Q: buildQuadruped };
const ANIMATORS = { Q: animateQuadruped };

export class EntityView {
  /**
   * @param {object} state network state from the server
   * @param {object} def entity definition from shared content
   */
  constructor(state, def) {
    this.id = state.id;
    this.def = def;
    const resolved = resolveForm(def.form, { seed: state.seed, scale: state.scale });
    this.plan = resolved.plan;
    this.dims = formDimensions(resolved);

    this.root = new THREE.Group();
    this.root.name = `entity:${state.id}`;
    this.rig = new THREE.Group();
    this.root.add(this.rig);
    this.builder = new RigBuilder();
    this.bones = BUILDERS[this.plan](this.builder, this.rig, resolved.features, new Random(state.seed));
    this.bones.body.userData.restY = this.bones.body.position.y;

    this.phase = new Random(state.seed).range(0, Math.PI * 2);
    this.anim = 'idle';
    this.state = 'alive';
    this.flash = 0;
    this.deathTilt = 0;
    this.target = { position: new THREE.Vector3(), yaw: 0 };
    this.applyState(state, true);
  }

  /** Server position, used for picking so the crosshair matches server reach checks. */
  get position() {
    return this.target.position;
  }

  applyState(state, snap = false) {
    this.target.position.set(state.position.x, state.position.y, state.position.z);
    this.target.yaw = state.yaw ?? this.target.yaw;
    this.anim = state.anim ?? this.anim;
    this.state = state.state ?? this.state;
    this.health = state.health;
    this.maxHealth = state.maxHealth;
    if (snap) {
      this.root.position.copy(this.target.position);
      this.root.rotation.y = this.target.yaw;
    }
  }

  /** @param {string} action */
  playAction(action) {
    if (action === 'hurt' || action === 'die') this.flash = 0.25;
  }

  update(dt) {
    const blend = 1 - Math.exp(-10 * dt);
    this.root.position.lerp(this.target.position, blend);
    this.root.rotation.y = lerpAngle(this.root.rotation.y, this.target.yaw, blend);

    if (this.state === 'corpse') {
      this.deathTilt = Math.min(1, this.deathTilt + dt * 2.5);
      this.rig.rotation.z = (Math.PI / 2) * this.deathTilt;
      this.rig.position.y = (this.dims.width / 2) * this.deathTilt;
    } else {
      ANIMATORS[this.plan](this, dt);
    }

    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    const glow = this.flash > 0 ? 0.6 : 0;
    for (const material of this.builder.materials) material.emissive.setRGB(glow, 0, 0);
  }

  dispose() {
    this.root.traverse((object) => object.isMesh && object.geometry.dispose());
    for (const material of this.builder.materials) material.dispose();
  }
}
