/**
 * Minimal synchronous event bus.
 *
 * Every system that mutates shared state (world edits, inventory changes,
 * interactions) publishes here instead of calling collaborators directly. That
 * keeps new features additive: subscribe, don't edit the pipeline.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._handlers = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void} unsubscribe function
   */
  on(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`handler for "${event}" must be a function`);
    }
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to the next occurrence of an event only.
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void} unsubscribe function
   */
  once(event, handler) {
    const wrapped = (payload) => {
      this.off(event, wrapped);
      handler(payload);
    };
    return this.on(event, wrapped);
  }

  /**
   * Unsubscribe a handler.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    const set = this._handlers.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this._handlers.delete(event);
  }

  /**
   * Publish an event. Handler errors are isolated so one bad subscriber cannot
   * abort a world edit that already happened.
   * @param {string} event
   * @param {*} payload
   */
  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[EventBus] handler for "${event}" threw:`, err);
      }
    }
  }

  /** @param {string} event */
  listenerCount(event) {
    return this._handlers.get(event)?.size ?? 0;
  }

  /** Remove every handler, optionally only for one event. */
  clear(event) {
    if (event === undefined) this._handlers.clear();
    else this._handlers.delete(event);
  }
}

/**
 * Canonical event names. Systems should import these rather than typing
 * strings, so renames stay mechanical.
 */
export const EVENTS = {
  BLOCK_CHANGED: 'world:block-changed',
  CHUNK_LOADED: 'world:chunk-loaded',
  CHUNK_UNLOADED: 'world:chunk-unloaded',
  TILE_ENTITY_CHANGED: 'world:tile-entity-changed',
  REGROWTH_SCHEDULED: 'world:regrowth-scheduled',
  REGROWTH_COMPLETED: 'world:regrowth-completed',

  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  PLAYER_MOVED: 'player:moved',

  INVENTORY_CHANGED: 'inventory:changed',
  EQUIPMENT_CHANGED: 'equipment:changed',
  STATS_CHANGED: 'character:stats-changed',
  BUFF_APPLIED: 'character:buff-applied',
  BUFF_EXPIRED: 'character:buff-expired',
  KNOWLEDGE_LEARNED: 'character:knowledge-learned',

  ITEM_USED: 'item:used',
  ITEM_DROPPED: 'item:dropped',
  ITEM_PICKED_UP: 'item:picked-up',
  ITEM_BROKE: 'item:broke',

  INTERACTION: 'interaction:performed',

  ENTITY_SPAWNED: 'entity:spawned',
  ENTITY_DAMAGED: 'entity:damaged',
  ENTITY_DIED: 'entity:died',
  ENTITY_HARVESTED: 'entity:harvested',
  ENTITY_DESPAWNED: 'entity:despawned',
};
