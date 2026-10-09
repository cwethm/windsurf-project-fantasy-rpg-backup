/**
 * Client entry point.
 *
 * Wires login -> socket -> world -> renderer -> input. The interesting part is
 * how little game logic lives here: content definitions, physics, raycasting
 * and harvest timing are all imported from `/src`, the same modules the server
 * runs, so the client is a view over shared rules rather than a reimplementation.
 */

import { createContent } from '/src/content/index.js';
import { computeHarvestSeconds } from '/src/game/interaction.js';
import { PLAYER_EYE_HEIGHT } from '/src/core/constants.js';
import { NetClient, C2S, S2C } from './net.js';
import { ClientWorld } from './world-view.js';
import { SceneView } from './scene.js';
import { Controls } from './controls.js';
import { TargetResolver } from './targeting.js';
import { pickEntity } from '/src/entity/hitbox.js';
import { directionFromAngles } from '/src/world/raycast.js';
import { ATTACK_COOLDOWN_MS } from '/src/core/constants.js';
import { Hud } from './hud.js';
import { InventoryPanel } from './inventory-panel.js';

/** Movement updates per second sent to the server. */
const MOVE_HZ = 15;
/** Third-person camera distance. */
const THIRD_PERSON_DISTANCE = 4.5;

class Game {
  constructor() {
    this.content = createContent().freeze();
    this.world = new ClientWorld(this.content);
    this.net = new NetClient();
    this.hud = new Hud(this.content);
    this.targets = new TargetResolver(this.world, this.content);
    this.awaitingContainer = false;
    this.inventoryPanel = new InventoryPanel({
      content: this.content,
      colorFor: (item) => this.hud.colorForItem(item),
      send: (type, payload) => this.net.send(type, payload),
      onClose: (hadContainer) => {
        if (hadContainer) this.net.send(C2S.CLOSE_CONTAINER, {});
      },
    });

    this.canvas = document.getElementById('viewport');
    this.scene = new SceneView(this.canvas, this.world, this.content);

    this.controls = new Controls({
      canvas: this.canvas,
      world: this.world,
      onAction: (action, detail) => this.handleAction(action, detail),
      isTyping: () => this.hud.isTyping(),
    });

    this.selfId = null;
    this.selfState = null;
    this.inventory = null;
    this.focus = null;
    /** Entity under the crosshair, when it is nearer than any block. */
    this.entityFocus = null;
    this.nextAttackAt = 0;
    this.crosshairVisible = true;
    this.firstPerson = true;
    this.harvest = null;
    this.lastMoveSent = 0;
    this.lastFrame = performance.now();
    /** @type {import('./player-avatar.js').PlayerAvatar|null} */
    this.avatar = null;
  }

  // ----------------------------------------------------------------- setup

  async connect() {
    const welcome = await this.net.connect();
    if (welcome.constants?.viewDistance) {
      this.scene.setViewDistance(welcome.constants.viewDistance);
    }
    if (welcome.constants?.MAX_REACH) this.targets.reach = welcome.constants.MAX_REACH;
    this._bindMessages();
    return welcome;
  }

  _bindMessages() {
    const net = this.net;

    net.on(S2C.CHUNK, (payload) => this.world.loadChunk(payload));
    net.on(S2C.CHUNK_UNLOAD, ({ chunkX, chunkZ }) => {
      this.world.unloadChunk(chunkX, chunkZ);
      this.scene.removeChunkAt(chunkX, chunkZ);
    });

    net.on(S2C.BLOCK_UPDATE, ({ x, y, z, block }) => this.world.setBlock(x, y, z, block));
    net.on(S2C.TILE_ENTITY_UPDATE, ({ x, y, z, data }) => this.world.setTileEntity({ x, y, z }, data));

    net.on(S2C.SELF_STATE, (state) => this.applySelfState(state));
    net.on(S2C.PLAYER_STATE, (state) => {
      if (state.position) this.controls.setPosition(state.position);
      if (state.correction) this.hud.addChat(`Position corrected: ${state.correction}`);
    });

    net.on(S2C.PLAYER_JOIN, (state) => {
      if (state.id === this.selfId) return;
      const avatar = this.scene.addAvatar(state);
      avatar.setHeldItem(state.held ?? null, (item) => this.hud.colorForItem(item));
      this.hud.addChat(`${state.username} joined`);
    });
    net.on(S2C.PLAYER_LEAVE, ({ id, username }) => {
      this.scene.removeAvatar(id);
      if (username) this.hud.addChat(`${username} left`);
    });
    net.on(S2C.PLAYER_UPDATE, (state) => {
      if (state.id === this.selfId) return;
      if (!this.scene.avatars.has(state.id)) this.scene.addAvatar(state);
      else this.scene.updateAvatar(state);
      this.scene.avatars.get(state.id)?.setHeldItem(state.held, (item) => this.hud.colorForItem(item));
    });

    net.on(S2C.GROUND_ITEMS, ({ items, removed }) => {
      this.scene.addGroundItems(items ?? []);
      this.scene.removeGroundItems(removed ?? []);
    });

    net.on(S2C.ENTITY_ADD, ({ entities }) => this.scene.addEntities(entities));
    net.on(S2C.ENTITY_UPDATE, ({ entities }) => this.scene.updateEntities(entities));
    net.on(S2C.ENTITY_REMOVE, ({ ids }) => this.scene.removeEntities(ids));
    net.on(S2C.ENTITY_ACTION, (payload) => this.scene.entityAction(payload));

    net.on(S2C.CHAT, ({ from, text }) => this.hud.addChat(text, from));
    net.on(S2C.CONTAINER, ({ position, slots }) => {
      const container = { position, slots: slots ?? [] };
      if (this.awaitingContainer) {
        this.awaitingContainer = false;
        this.cancelHarvest();
        this.inventoryPanel.openContainer(container);
      } else {
        this.inventoryPanel.updateContainer(container);
      }
    });

    net.on(S2C.ACTION_RESULT, (result) => {
      if (result.action === C2S.INTERACT) this.awaitingContainer = result.detail?.action === 'open-container';
      if (result.action === C2S.INTERACT_ENTITY && result.ok) this.reportButchering(result.detail);
      if (result.ok !== false || !result.reason) return;
      if (result.action === C2S.ATTACK && result.reason === 'attack cooling down') return;
      if (this.inventoryPanel.isOpen) this.inventoryPanel.flash(result.reason);
      else this.hud.addChat(`${result.action}: ${result.reason}`);
    });
    net.on(S2C.ERROR, ({ reason }) => reason && this.hud.addChat(reason));
    net.on('close', () => this.hud.addChat('Disconnected — reconnecting…'));
  }

  /** @param {object} state */
  applySelfState(state) {
    this.selfState = state;
    this.inventory = state.inventory;
    this.hud.setVitals(state);
    this.hud.setInventory(state.inventory);
    this.inventoryPanel.setState(state);
    this.avatar?.setHeldItem(state.held, (item) => this.hud.colorForItem(item));
  }

  /** @param {{ id: string, username: string, position: object }} payload */
  start(payload) {
    this.selfId = payload.id;
    this.controls.setPosition(payload.position);

    this.avatar = this.scene.addAvatar(
      { id: payload.id, username: payload.username, position: payload.position, yaw: 0, pitch: 0 },
      { local: true },
    );
    this.setFirstPerson(true);

    this.hud.show();
    this.hud.setCrosshair(this.crosshairVisible);
    this.hud.bindChat((text) => this.net.send(C2S.CHAT, { text }));
    this.hud.addChat('Click to capture the mouse.');

    this.lastFrame = performance.now();
    requestAnimationFrame(() => this.loop());
  }

  // ---------------------------------------------------------------- camera

  /** @param {boolean} firstPerson */
  setFirstPerson(firstPerson) {
    this.firstPerson = firstPerson;
    this.avatar?.setFirstPerson(firstPerson);
    const parent = firstPerson ? this.avatar?.eye : this.scene.scene;
    if (!parent) return;
    parent.add(this.scene.camera);
    // The avatar's head already carries yaw and pitch, and three.js cameras
    // look down -Z, which is the same forward axis `directionFromAngles` uses.
    this.scene.camera.position.set(0, 0, 0);
    this.scene.camera.rotation.set(0, 0, 0);
  }

  _updateCamera() {
    if (this.firstPerson) return;
    const { position } = this.controls;
    const pitch = this.controls.pitch;
    const yaw = this.controls.yaw;
    const horizontal = Math.cos(pitch) * THIRD_PERSON_DISTANCE;
    this.scene.camera.position.set(
      position.x + Math.sin(yaw) * horizontal,
      position.y + PLAYER_EYE_HEIGHT + Math.sin(-pitch) * THIRD_PERSON_DISTANCE + 0.4,
      position.z + Math.cos(yaw) * horizontal,
    );
    this.scene.camera.lookAt(position.x, position.y + PLAYER_EYE_HEIGHT, position.z);
  }

  // --------------------------------------------------------------- actions

  /**
   * @param {string} action
   * @param {object} [detail]
   */
  handleAction(action, detail = {}) {
    const handler = ACTIONS[action];
    if (handler) handler(this, detail);
  }

  /** Slot currently selected in the quickbar. */
  selectedSlot() {
    return this.inventory?.selectedSlot ?? 0;
  }

  /** Stack in the selected quickbar slot, or null. */
  heldStack() {
    return this.inventory?.slots?.[this.selectedSlot()] ?? null;
  }

  /** Tool properties of the held item, for harvest-time estimation. */
  heldTool() {
    const stack = this.heldStack();
    const def = stack ? this.content.item(stack.item) : null;
    return { toolClass: def?.toolClass ?? null, toolTier: def?.toolTier ?? 0 };
  }

  /** Chat summary of what a corpse yielded. */
  reportButchering(detail) {
    const name = detail?.name?.toLowerCase() ?? 'carcass';
    const drops = detail?.drops ?? [];
    if (drops.length === 0) {
      this.hud.addChat(`You hack at the ${name} but get nothing useful.`);
      return;
    }
    const parts = drops.map((d) => `${d.count}× ${this.content.items.get(d.item)?.name ?? d.item}`);
    this.hud.addChat(`You butcher the ${name}: ${parts.join(', ')}`);
  }

  /** Left click on a living entity: hit it, client-side throttled to the server cooldown. */
  attack() {
    const now = performance.now();
    if (now < this.nextAttackAt || this.entityFocus?.view.state !== 'alive') return;
    this.nextAttackAt = now + ATTACK_COOLDOWN_MS;
    this.net.send(C2S.ATTACK, { entity: this.entityFocus.view.id });
  }

  /** Examine and butcher the focused corpse. */
  interactEntity() {
    this.net.send(C2S.INTERACT_ENTITY, { entity: this.entityFocus.view.id });
  }

  /** Nearest entity under the crosshair, if closer than the focused block. */
  _resolveEntityFocus() {
    const eye = this.controls.eyePosition();
    const hit = pickEntity(eye, directionFromAngles(this.controls.yaw, this.controls.pitch), this.scene.entities.values(), this.targets.reach);
    if (!hit || (this.focus?.via === 'ray' && this.focus.distance < hit.distance)) return null;
    return { view: hit.entity, distance: hit.distance };
  }

  beginHarvest() {
    if (this.entityFocus) {
      this.attack();
      return;
    }
    if (!this.focus) return;
    const seconds = computeHarvestSeconds(this.focus.def, this.heldTool());
    if (seconds === null) return;
    this.harvest = {
      x: this.focus.x,
      y: this.focus.y,
      z: this.focus.z,
      readyAt: performance.now() + seconds * 1000,
    };
    this.net.send(C2S.BEGIN_HARVEST, { target: { x: this.focus.x, y: this.focus.y, z: this.focus.z } });
  }

  cancelHarvest() {
    this.harvest = null;
  }

  /** Finish a harvest once the shared timing says it is due. */
  _tickHarvest() {
    if (!this.harvest) return;
    const stillAimed =
      this.focus &&
      this.focus.x === this.harvest.x &&
      this.focus.y === this.harvest.y &&
      this.focus.z === this.harvest.z;
    if (!stillAimed || !this.controls.mouseHeld.left) {
      this.cancelHarvest();
      return;
    }
    if (performance.now() < this.harvest.readyAt) return;

    const { x, y, z } = this.harvest;
    this.harvest = null;
    this.net.send(C2S.HARVEST, { target: { x, y, z } });
  }

  /**
   * Right click: place the held block against the focused face, otherwise use
   * the item on the target. The server decides which is legal; the client only
   * picks the more likely intent so the round trip is not wasted.
   */
  useHeld() {
    if (this.entityFocus?.view.state === 'corpse') {
      this.interactEntity();
      return;
    }
    if (!this.focus) {
      this.net.send(C2S.USE_ITEM, { slot: this.selectedSlot(), target: null });
      return;
    }
    const stack = this.heldStack();
    const def = stack ? this.content.item(stack.item) : null;
    const placement = this.focus.adjacent;

    if (def?.placeable && placement) {
      this.net.send(C2S.PLACE, { target: placement, slot: this.selectedSlot() });
      return;
    }
    this.net.send(C2S.USE_ITEM, {
      slot: this.selectedSlot(),
      target: { x: this.focus.x, y: this.focus.y, z: this.focus.z },
    });
  }

  // ------------------------------------------------------------------ loop

  loop() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    this.controls.update(dt);

    this.focus = this.targets.resolve(
      this.controls.eyePosition(),
      this.controls.yaw,
      this.controls.pitch,
      { proximityFallback: true },
    );
    this.entityFocus = this._resolveEntityFocus();
    if (this.entityFocus) {
      const { view, distance } = this.entityFocus;
      const label = view.state === 'corpse' ? `${view.def.name} carcass · E to butcher` : `${view.def.name} ${view.health}/${view.maxHealth}`;
      this.entityFocus.blockBehind = this.focus;
      this.focus = null;
      this.scene.setHighlight(null);
      this.hud.setFocus({ blockName: label, distance });
    } else {
      this.scene.setHighlight(this.focus);
      this.hud.setFocus(this.focus);
    }

    this._tickHarvest();

    this.avatar?.setTransform(this.controls.position, this.controls.yaw, this.controls.pitch);
    if (this.avatar) this.avatar.animation = this.controls.animation;
    this._updateCamera();

    this.scene.update(dt, { localId: this.selfId, localSpeed: this.controls.speed });
    this.scene.render();

    if (now - this.lastMoveSent >= 1000 / MOVE_HZ) {
      this.lastMoveSent = now;
      this.net.send(C2S.MOVE, {
        position: this.controls.position,
        yaw: this.controls.yaw,
        pitch: this.controls.pitch,
        animation: this.controls.animation,
      });
    }

    requestAnimationFrame(() => this.loop());
  }
}

/**
 * Input actions as a lookup table rather than a switch, mirroring the
 * data-plus-handler style the engine uses. Adding a keybind is one entry here
 * plus one in `controls.js`.
 */
const ACTIONS = {
  harvest_start: (game) => game.beginHarvest(),
  harvest_stop: (game) => game.cancelHarvest(),
  use: (game) => game.useHeld(),
  interact: (game) => {
    if (game.entityFocus?.view.state === 'corpse') {
      game.interactEntity();
      return;
    }
    const target = game.focus ?? game.entityFocus?.blockBehind;
    if (!target) return;
    game.net.send(C2S.INTERACT, { target: { x: target.x, y: target.y, z: target.z } });
  },
  select_slot: (game, { slot }) => {
    if (!game.inventory || slot >= game.inventory.quickbarSize) return;
    game.inventory.selectedSlot = slot;
    game.hud.setInventory(game.inventory);
    game.net.send(C2S.SELECT_SLOT, { slot });
  },
  cycle_slot: (game, { delta }) => {
    if (!game.inventory) return;
    const size = game.inventory.quickbarSize;
    const next = (game.inventory.selectedSlot + delta + size) % size;
    ACTIONS.select_slot(game, { slot: next });
  },
  drop: (game) => game.net.send(C2S.DROP_ITEM, { slot: game.selectedSlot(), count: 1 }),
  sort: (game) => game.net.send(C2S.SORT_INVENTORY, {}),
  toggle_crosshair: (game) => {
    game.crosshairVisible = !game.crosshairVisible;
    game.hud.setCrosshair(game.crosshairVisible);
  },
  toggle_view: (game) => game.setFirstPerson(!game.firstPerson),
  toggle_inventory: (game) => {
    game.cancelHarvest();
    game.inventoryPanel.toggle();
  },
  cancel: (game) => {
    game.cancelHarvest();
    if (game.inventoryPanel.isOpen) game.inventoryPanel.close();
    else game.net.send(C2S.CLOSE_CONTAINER, {});
  },
};

// ------------------------------------------------------------------- boot

const loginScreen = document.getElementById('login');
const form = document.getElementById('login-form');
const errorLine = document.getElementById('login-error');
const statusLine = document.getElementById('login-status');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');

const game = new Game();
let welcome = null;

game
  .connect()
  .then((payload) => {
    welcome = payload;
    statusLine.textContent = `Connected · world seed "${payload.seed}"`;
    registerButton.hidden = !payload.allowRegister;
  })
  .catch((err) => {
    statusLine.textContent = '';
    errorLine.textContent = `Cannot reach the server: ${err.message}`;
  });

/** @param {boolean} register */
async function submit(register) {
  if (!welcome) {
    errorLine.textContent = 'Still connecting…';
    return;
  }
  if (!form.reportValidity()) return;

  errorLine.textContent = '';
  loginButton.disabled = true;
  registerButton.disabled = true;

  try {
    const credentials = {
      username: form.username.value.trim(),
      password: form.password.value,
      register,
    };
    const result = await game.net.login(credentials);
    form.password.value = '';
    loginScreen.remove();
    game.start(result);
  } catch (err) {
    errorLine.textContent = err.message;
    loginButton.disabled = false;
    registerButton.disabled = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  submit(false);
});
registerButton.addEventListener('click', () => submit(true));
