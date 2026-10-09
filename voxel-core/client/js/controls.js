/**
 * Input and local movement prediction.
 *
 * Keyboard/mouse state is collected here and turned into a velocity, then run
 * through the *shared* `stepPhysics` helper the server uses to validate moves.
 * Predicting with the same code keeps the client and the authority in
 * agreement, so corrections are rare.
 */

import {
  WALK_SPEED,
  RUN_SPEED,
  JUMP_VELOCITY,
  PLAYER_EYE_HEIGHT,
} from '/src/core/constants.js';
import { stepPhysics } from '/src/world/physics.js';

const MAX_PITCH = Math.PI / 2 - 0.01;
const LOOK_SENSITIVITY = 0.0022;
/** Largest physics step; longer frames are split so tunnelling is impossible. */
const MAX_STEP = 1 / 30;

export class Controls {
  /**
   * @param {{
   *   canvas: HTMLCanvasElement,
   *   world: import('./world-view.js').ClientWorld,
   *   onAction: (action: string, detail?: object) => void,
   *   isTyping: () => boolean,
   * }} config
   */
  constructor({ canvas, world, onAction, isTyping }) {
    this.canvas = canvas;
    this.world = world;
    this.onAction = onAction;
    this.isTyping = isTyping ?? (() => false);

    this.position = { x: 0, y: 40, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.animation = 'idle';
    this.speed = 0;

    this.keys = new Set();
    this.locked = false;
    this.mouseHeld = { left: false, right: false };

    this._bind();
  }

  _bind() {
    this.canvas.addEventListener('click', () => {
      if (!this.locked) this.canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        this.keys.clear();
        this.mouseHeld.left = false;
        this.mouseHeld.right = false;
      }
    });

    document.addEventListener('mousemove', (event) => {
      if (!this.locked) return;
      this.yaw -= event.movementX * LOOK_SENSITIVITY;
      this.pitch -= event.movementY * LOOK_SENSITIVITY;
      this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
      this.yaw = wrapAngle(this.yaw);
    });

    document.addEventListener('keydown', (event) => {
      if (this.isTyping() || isEditable(event.target)) return;
      this.keys.add(event.code);
      this._handleActionKey(event);
    });

    document.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });

    this.canvas.addEventListener('mousedown', (event) => {
      if (!this.locked) return;
      event.preventDefault();
      if (event.button === 0) {
        this.mouseHeld.left = true;
        this.onAction('harvest_start');
      } else if (event.button === 2) {
        this.mouseHeld.right = true;
        this.onAction('use');
      }
    });

    this.canvas.addEventListener('mouseup', (event) => {
      if (event.button === 0) {
        this.mouseHeld.left = false;
        this.onAction('harvest_stop');
      }
      if (event.button === 2) this.mouseHeld.right = false;
    });

    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    this.canvas.addEventListener('wheel', (event) => {
      if (!this.locked) return;
      event.preventDefault();
      this.onAction('cycle_slot', { delta: Math.sign(event.deltaY) });
    }, { passive: false });
  }

  _handleActionKey(event) {
    const digit = /^Digit([1-9])$/.exec(event.code);
    if (digit) {
      this.onAction('select_slot', { slot: Number(digit[1]) - 1 });
      return;
    }
    const actions = {
      KeyE: 'interact',
      KeyC: 'toggle_crosshair',
      KeyV: 'toggle_view',
      KeyQ: 'drop',
      KeyT: 'chat',
      KeyR: 'sort',
      KeyI: 'toggle_inventory',
      Tab: 'toggle_inventory',
      Escape: 'cancel',
    };
    const action = actions[event.code];
    if (action) {
      if (action === 'chat' || event.code === 'Tab') event.preventDefault();
      if (event.repeat && action === 'toggle_inventory') return;
      this.onAction(action);
    }
  }

  /** Camera-relative input direction, normalised. */
  _wishDirection() {
    let forward = 0;
    let strafe = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 1;

    const length = Math.hypot(forward, strafe);
    if (length === 0) return { x: 0, z: 0 };

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // -Z is forward in three.js camera space.
    return {
      x: (-sin * forward + cos * strafe) / length,
      z: (-cos * forward - sin * strafe) / length,
    };
  }

  /**
   * Advance local simulation by `dt` seconds.
   * @param {number} dt
   */
  update(dt) {
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const maxSpeed = running ? RUN_SPEED : WALK_SPEED;
    const wish = this.locked ? this._wishDirection() : { x: 0, z: 0 };

    this.velocity.x = wish.x * maxSpeed;
    this.velocity.z = wish.z * maxSpeed;

    if (this.onGround && this.locked && this.keys.has('Space')) {
      this.velocity.y = JUMP_VELOCITY;
      this.onGround = false;
    }

    // Do not simulate into terrain that has not arrived yet.
    if (!this.world.hasChunkAt(this.position.x, this.position.z)) {
      this.velocity.y = 0;
      this.animation = 'idle';
      this.speed = 0;
      return;
    }

    let remaining = Math.min(dt, 0.25);
    let result = { position: this.position, velocity: this.velocity, onGround: this.onGround };
    while (remaining > 0) {
      const step = Math.min(MAX_STEP, remaining);
      remaining -= step;
      result = stepPhysics(
        { position: result.position, velocity: result.velocity },
        { dt: step, isSolid: this.world.isSolid },
      );
    }

    this.position = result.position;
    this.velocity = result.velocity;
    this.onGround = result.onGround;

    this.speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.animation = !this.onGround
      ? 'fall'
      : this.speed < 0.1
        ? 'idle'
        : running
          ? 'run'
          : 'walk';
  }

  /** Eye position used for raycasting and the camera. */
  eyePosition() {
    return {
      x: this.position.x,
      y: this.position.y + PLAYER_EYE_HEIGHT,
      z: this.position.z,
    };
  }

  /** Teleport (used on login and on server corrections). */
  setPosition(position) {
    this.position = { x: position.x, y: position.y, z: position.z };
    this.velocity = { x: 0, y: 0, z: 0 };
  }
}

/** Keep an angle within [-PI, PI] so it always passes protocol validation. */
export function wrapAngle(angle) {
  const wrapped = (angle + Math.PI) % (Math.PI * 2);
  return (wrapped < 0 ? wrapped + Math.PI * 2 : wrapped) - Math.PI;
}

/** True when a key event is aimed at a text field rather than the game. */
export function isEditable(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}
