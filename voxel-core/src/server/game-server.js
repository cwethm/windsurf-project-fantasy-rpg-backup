/**
 * Authoritative game server.
 *
 * Owns the world, the connected sessions and the gameplay systems, and routes
 * every validated client message to a registered handler. There is no switch
 * over message types here either: `handlers` is a registry, so a downstream
 * game adds verbs without forking this file.
 */

import { EventBus, EVENTS } from '../core/event-bus.js';
import { HandlerRegistry } from '../core/registry.js';
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  MAX_REACH,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_EYE_HEIGHT,
  GRAVITY,
  WALK_SPEED,
  RUN_SPEED,
  JUMP_VELOCITY,
  MOVE_SPEED_TOLERANCE,
  DEFAULT_VIEW_DISTANCE,
  QUICKBAR_SLOTS,
  INVENTORY_SLOTS,
} from '../core/constants.js';
import { createContent } from '../content/index.js';
import { WorldGenerator } from '../world/generator.js';
import { World } from '../world/world.js';
import { validateMove, resolveSpawnY } from '../world/physics.js';
import { Player } from '../game/player.js';
import { GroundItemManager } from '../game/ground-items.js';
import { InteractionSystem, INTERACTION } from '../game/interaction.js';
import { ItemUseSystem } from '../game/item-use.js';
import { openContainer, transferStack } from '../game/containers.js';
import { C2S, S2C } from '../net/protocol.js';
import { sessionsNear } from '../net/interest.js';
import { Session } from './session.js';
import { authenticate } from './auth.js';

export const DEFAULT_SERVER_OPTIONS = {
  allowRegister: true,
  viewDistance: DEFAULT_VIEW_DISTANCE,
  chunksPerUpdate: 12,
  tickIntervalMs: 1000,
  maxPlayers: 32,
  collectDrops: true,
  rateLimits: undefined,
  /** Item ids granted to brand-new players. */
  startingItems: { wooden_pickaxe: 1, wooden_axe: 1, bread: 5, torch: 16 },
};

export class GameServer {
  /**
   * @param {{
   *   content?: import('../content/index.js').Content,
   *   world?: World,
   *   store: import('../storage/game-store.js').GameStore,
   *   seed?: string|number,
   *   bus?: EventBus,
   *   logger?: object,
   *   options?: Partial<typeof DEFAULT_SERVER_OPTIONS>,
   * }} config
   */
  constructor({ content, world, store, seed = 'voxel-core', bus, logger = console, options = {} }) {
    this.bus = bus ?? new EventBus();
    this.logger = logger;
    this.options = { ...DEFAULT_SERVER_OPTIONS, ...options };
    this.content = content ?? createContent();
    this.store = store;

    this.world =
      world ??
      new World({
        generator: new WorldGenerator({ seed: store?.worldSeed ?? seed, content: this.content }),
        content: this.content,
        bus: this.bus,
      });

    this.groundItems = new GroundItemManager({ content: this.content, bus: this.bus });
    this.interactions = new InteractionSystem({
      world: this.world,
      content: this.content,
      bus: this.bus,
      groundItems: this.groundItems,
      collectDrops: this.options.collectDrops,
    });
    this.items = new ItemUseSystem({ content: this.content, interactions: this.interactions, bus: this.bus });

    /** @type {Map<string, Session>} */
    this.sessions = new Map();
    /** @type {Map<string, Session>} player id -> session */
    this.sessionsByPlayer = new Map();
    this.handlers = new HandlerRegistry('message');
    this._tickTimer = null;

    this._registerHandlers();
    this._subscribeToWorld();
  }

  /**
   * Build a server with its persistence restored.
   * @param {object} config
   */
  static async create(config) {
    const server = new GameServer(config);
    server.restore();
    return server;
  }

  /** Load persisted world and ground-item state into memory. */
  restore() {
    if (!this.store?.snapshot) return this;
    this.world.importState(this.store.getWorldState());
    this.groundItems.loadJSON(this.store.getGroundItems());
    this.store.onCollect(() => this.collectState());
    return this;
  }

  /** Copy live state into the store, ready for a flush. */
  collectState() {
    if (!this.store?.snapshot) return;
    this.store.putWorldState(this.world.exportState());
    this.store.putGroundItems(this.groundItems.toJSON());
    for (const session of this.sessions.values()) {
      if (session.player) this.store.putPlayer(session.player.toJSON());
    }
  }

  /** Tuning values the client mirrors for prediction. */
  clientConstants() {
    return {
      CHUNK_SIZE,
      CHUNK_HEIGHT,
      MAX_REACH,
      PLAYER_WIDTH,
      PLAYER_HEIGHT,
      PLAYER_EYE_HEIGHT,
      GRAVITY,
      WALK_SPEED,
      RUN_SPEED,
      JUMP_VELOCITY,
      QUICKBAR_SLOTS,
      INVENTORY_SLOTS,
      viewDistance: this.options.viewDistance,
    };
  }

  // -------------------------------------------------------------- sessions

  /**
   * Register a new connection.
   * @param {{ send: Function, close: Function, remoteAddress?: string }} transport
   */
  addSession(transport) {
    const session = new Session({ server: this, ...transport });
    if (this.sessions.size >= this.options.maxPlayers) {
      session.send(S2C.ERROR, { reason: 'server full' });
      session.close('server full');
      return session;
    }
    this.sessions.set(session.id, session);
    session.greet();
    return session;
  }

  /**
   * Tear a session down, saving the player first.
   * @param {Session} session
   */
  async removeSession(session) {
    if (!this.sessions.delete(session.id)) return;
    const player = session.player;
    if (!player) return;

    this.sessionsByPlayer.delete(player.id);
    this.interactions.cancelHarvest(player.id);
    this.store?.putPlayer(player.toJSON());
    this.broadcast(S2C.PLAYER_LEAVE, { id: player.id, username: player.username }, { exclude: session });
    this.bus.emit(EVENTS.PLAYER_LEFT, { playerId: player.id });
    await this.store?.flush().catch((err) => this.logger.error?.('[server] save on leave failed:', err));
  }

  /** Send to every session, optionally excluding one. */
  broadcast(type, payload, { exclude = null } = {}) {
    for (const session of this.sessions.values()) {
      if (session === exclude || !session.player) continue;
      session.send(type, payload);
    }
  }

  /** Send only to sessions whose player is near a world position. */
  broadcastNear(position, type, payload, { exclude = null } = {}) {
    for (const session of sessionsNear(this.sessions.values(), position, { exclude })) {
      session.send(type, payload);
    }
  }

  _subscribeToWorld() {
    this.bus.on(EVENTS.BLOCK_CHANGED, (event) => {
      this.broadcastNear({ x: event.x, z: event.z }, S2C.BLOCK_UPDATE, {
        x: event.x,
        y: event.y,
        z: event.z,
        block: event.block,
      });
    });
    this.bus.on(EVENTS.TILE_ENTITY_CHANGED, (event) => {
      // Container contents are private to whoever has it open; only the
      // presence and simple state are broadcast.
      const data = event.data ? { kind: event.data.kind, on: event.data.on ?? null } : null;
      this.broadcastNear({ x: event.x, z: event.z }, S2C.TILE_ENTITY_UPDATE, {
        x: event.x,
        y: event.y,
        z: event.z,
        data,
      });
    });
  }

  // -------------------------------------------------------------- handlers

  _registerHandlers() {
    const h = this.handlers;

    h.register(C2S.PING, (session, msg) => session.send(S2C.PONG, { time: msg.time ?? null }));
    h.register(C2S.LOGIN, (session, msg) => this._handleLogin(session, msg, false));
    h.register(C2S.REGISTER, (session, msg) => this._handleLogin(session, msg, true));
    h.register(C2S.MOVE, (session, msg) => this._handleMove(session, msg));
    h.register(C2S.SELECT_SLOT, (session, msg) => {
      session.player.inventory.selectSlot(msg.slot);
      this.broadcastNear(session.player.position, S2C.PLAYER_UPDATE, session.player.toNetworkState(), {
        exclude: session,
      });
    });

    h.register(C2S.BEGIN_HARVEST, (session, msg) => {
      const result = this.interactions.beginHarvest(session.player, msg.target);
      session.reply(C2S.BEGIN_HARVEST, result);
    });
    h.register(C2S.HARVEST, (session, msg) => {
      const result = this.interactions.perform(INTERACTION.HARVEST, session.player, { target: msg.target });
      session.reply(C2S.HARVEST, result);
      if (result.ok) session.sendSelfState();
    });
    h.register(C2S.PLACE, (session, msg) => {
      const result = this.interactions.perform(INTERACTION.PLACE, session.player, {
        target: msg.target,
        slot: msg.slot ?? null,
        occupants: this._occupantsNear(msg.target, session),
      });
      session.reply(C2S.PLACE, result);
      if (result.ok) session.sendSelfState();
    });
    h.register(C2S.INTERACT, (session, msg) => {
      const result = this.interactions.perform(INTERACTION.INTERACT, session.player, { target: msg.target });
      session.reply(C2S.INTERACT, result);
      if (result?.container) this._sendContainer(session, result.container);
    });
    h.register(C2S.USE_ITEM, (session, msg) => {
      const result = this.items.use(session.player, {
        slot: msg.slot ?? null,
        target: msg.target ?? null,
        occupants: msg.target ? this._occupantsNear(msg.target, session) : [],
      });
      session.reply(C2S.USE_ITEM, result);
      if (result.ok) session.sendSelfState();
    });

    h.register(C2S.MOVE_ITEM, (session, msg) => {
      const moved = session.player.inventory.move(msg.from, msg.to, msg.count ?? null);
      session.reply(C2S.MOVE_ITEM, { ok: moved, reason: moved ? null : 'move refused' });
      session.sendSelfState();
    });
    h.register(C2S.SPLIT_ITEM, (session, msg) => {
      const split = session.player.inventory.split(msg.slot, msg.count ?? null);
      session.reply(C2S.SPLIT_ITEM, { ok: split, reason: split ? null : 'split refused' });
      session.sendSelfState();
    });
    h.register(C2S.TRASH_ITEM, (session, msg) => {
      const result = session.player.inventory.trash(msg.slot, msg.count ?? null);
      session.reply(C2S.TRASH_ITEM, result);
      if (result.ok) session.sendSelfState();
    });
    h.register(C2S.LOCK_SLOT, (session, msg) => {
      const toggled = session.player.inventory.toggleLock(msg.slot);
      session.reply(C2S.LOCK_SLOT, { ok: toggled, reason: toggled ? null : 'invalid slot' });
      if (toggled) session.sendSelfState();
    });
    h.register(C2S.SORT_INVENTORY, (session) => {
      session.player.inventory.sort();
      session.sendSelfState();
    });
    h.register(C2S.DROP_ITEM, (session, msg) => this._handleDrop(session, msg));
    h.register(C2S.PICKUP_ITEM, (session, msg) => {
      const result = this.groundItems.pickup(msg.id, session.player);
      session.reply(C2S.PICKUP_ITEM, result);
      if (result.ok) {
        session.sendSelfState();
        this.broadcastNear(session.player.position, S2C.GROUND_ITEMS, {
          removed: result.fullyTaken ? [msg.id] : [],
        });
      }
    });
    h.register(C2S.TRANSFER_ITEM, (session, msg) => this._handleTransfer(session, msg));
    h.register(C2S.CLOSE_CONTAINER, (session) => {
      session.player.openContainer = null;
      session.reply(C2S.CLOSE_CONTAINER, { ok: true });
    });

    h.register(C2S.CHAT, (session, msg) => {
      this.broadcast(S2C.CHAT, {
        from: session.player.username,
        text: msg.text.slice(0, 256),
        at: Date.now(),
      });
    });
  }

  async _handleLogin(session, msg, isRegister) {
    if (session.authenticated) {
      session.send(S2C.ERROR, { reason: 'already logged in' });
      return;
    }
    const result = await authenticate({
      store: this.store,
      username: msg.username,
      password: msg.password,
      allowRegister: isRegister && this.options.allowRegister,
    });
    if (!result.ok) {
      session.send(S2C.ERROR, { reason: result.reason, type: msg.t });
      return;
    }

    const existing = this.sessionsByPlayer.get(result.account.id);
    if (existing) {
      existing.send(S2C.ERROR, { reason: 'logged in from another location' });
      existing.close('replaced');
      await this.removeSession(existing);
    }

    const player = this._loadPlayer(result.account);
    this.sessionsByPlayer.set(player.id, session);
    await session.join(player);
  }

  /** Restore a player's record, or spawn a fresh one at the surface. */
  _loadPlayer(account) {
    const player = new Player({
      id: account.id,
      username: account.username,
      content: this.content,
      bus: this.bus,
      viewDistance: this.options.viewDistance,
    });
    const record = this.store?.getPlayer(account.id);
    if (record) {
      player.loadJSON(record);
    } else {
      const spawn = this.world.surfacePosition(0, 0);
      const isSolid = (x, y, z) => this.world.isSolid(x, y, z);
      player.position = { ...spawn, y: resolveSpawnY(isSolid, spawn.x, spawn.z, spawn.y) };
      for (const [item, count] of Object.entries(this.options.startingItems ?? {})) {
        player.inventory.add(item, count);
      }
      this.store?.putPlayer(player.toJSON());
    }
    return player;
  }

  _handleMove(session, msg) {
    const player = session.player;
    const now = Date.now();
    const elapsed = Math.min(1, Math.max(0.001, (now - session.lastMoveAt) / 1000));
    session.lastMoveAt = now;

    const check = validateMove(
      player.position,
      msg.position,
      elapsed,
      player.maxSpeed(now) * MOVE_SPEED_TOLERANCE,
      (x, y, z) => this.world.isSolid(x, y, z),
    );
    if (!check.ok) {
      // Snap the client back rather than trusting the claim.
      session.send(S2C.PLAYER_STATE, { position: player.position, correction: check.reason });
      return;
    }

    player.position = { ...msg.position };
    player.yaw = msg.yaw ?? player.yaw;
    player.pitch = msg.pitch ?? player.pitch;
    player.animation = typeof msg.animation === 'string' ? msg.animation.slice(0, 16) : player.animation;
    player.lastSeenAt = now;

    session.syncChunks();
    this.broadcastNear(player.position, S2C.PLAYER_UPDATE, player.toNetworkState(), { exclude: session });
    this.bus.emit(EVENTS.PLAYER_MOVED, { playerId: player.id, position: player.position });
  }

  _handleDrop(session, msg) {
    const player = session.player;
    const taken = player.inventory.removeFromSlot(msg.slot, msg.count ?? 1);
    if (!taken) {
      session.reply(C2S.DROP_ITEM, { ok: false, reason: 'empty slot' });
      return;
    }
    const entity = this.groundItems.spawn({
      x: player.position.x,
      y: player.position.y + 1,
      z: player.position.z,
      item: taken.item,
      count: taken.count,
      meta: taken.meta ?? null,
      ownerId: player.id,
    });
    session.reply(C2S.DROP_ITEM, { ok: true, entity });
    session.sendSelfState();
    this.broadcastNear(player.position, S2C.GROUND_ITEMS, { items: [entity] });
  }

  _handleTransfer(session, msg) {
    const player = session.player;
    const open = player.openContainer;
    if (!open) {
      session.reply(C2S.TRANSFER_ITEM, { ok: false, reason: 'no container open' });
      return;
    }
    const valid = this.interactions.validateTarget(player, open, { requireLineOfSight: false });
    if (!valid.ok) {
      player.openContainer = null;
      session.reply(C2S.TRANSFER_ITEM, valid);
      return;
    }
    const handle = openContainer({ world: this.world, content: this.content, ...open });
    if (!handle) {
      player.openContainer = null;
      session.reply(C2S.TRANSFER_ITEM, { ok: false, reason: 'container is gone' });
      return;
    }

    const result =
      msg.direction === 'to_container'
        ? transferStack(player.inventory, msg.slot, handle.inventory, msg.count ?? null)
        : transferStack(handle.inventory, msg.slot, player.inventory, msg.count ?? null);
    if (result.ok) handle.save();

    session.reply(C2S.TRANSFER_ITEM, result);
    session.sendSelfState();
    this._sendContainer(session, handle);
  }

  _sendContainer(session, handle) {
    session.send(S2C.CONTAINER, {
      position: handle.position,
      slots: handle.inventory.toJSON().slots,
    });
  }

  /** Positions of other players near a block, for placement validation. */
  _occupantsNear(target, exclude) {
    const out = [];
    for (const session of this.sessions.values()) {
      if (session === exclude || !session.player) continue;
      const p = session.player.position;
      if (Math.abs(p.x - target.x) < 3 && Math.abs(p.y - target.y) < 4 && Math.abs(p.z - target.z) < 3) {
        out.push(p);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ tick

  /**
   * Scheduled world tick: regrowth, ground-item despawn and buff expiry.
   * @param {number} [now]
   */
  tick(now = Date.now()) {
    const regrew = this.world.tick(now);
    const despawned = this.groundItems.tick(now);
    for (const session of this.sessions.values()) {
      if (!session.player) continue;
      if (session.player.character.expireBuffs(now) > 0) session.sendSelfState();
    }
    if (despawned.length > 0) this.broadcast(S2C.GROUND_ITEMS, { removed: despawned });
    if (regrew > 0 || despawned.length > 0) this.store?.markDirty();
    return { regrew, despawned: despawned.length };
  }

  /** Start the world tick. */
  start() {
    if (this._tickTimer) return this;
    this._tickTimer = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        this.logger.error?.('[server] tick failed:', err);
      }
    }, this.options.tickIntervalMs);
    this._tickTimer.unref?.();
    this.store?.startAutosave();
    return this;
  }

  /** Stop ticking, disconnect everyone and write a final save. */
  async stop() {
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
    for (const session of [...this.sessions.values()]) {
      session.send(S2C.ERROR, { reason: 'server shutting down' });
      session.close('shutdown');
      await this.removeSession(session);
    }
    await this.store?.shutdown();
  }
}
