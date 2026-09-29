/**
 * Generic definition registry.
 *
 * Blocks, items, interaction handlers and loot tables are all *data* looked up
 * through one of these. Adding content is a `register()` call, never a new
 * branch in a switch statement.
 */
export class Registry {
  /**
   * @param {string} name human readable registry name, used in error messages
   * @param {{ idKey?: string, validate?: (def: object) => void }} [options]
   */
  constructor(name, options = {}) {
    this.name = name;
    this.idKey = options.idKey ?? 'id';
    this.validate = options.validate ?? null;
    /** @type {Map<string|number, object>} */
    this._byId = new Map();
    /** @type {Map<string, object>} */
    this._byName = new Map();
    this.frozen = false;
  }

  /**
   * Register a definition. Definitions are frozen so a rogue system cannot
   * mutate shared content at runtime.
   * @param {object} definition must carry `id`, may carry `name`
   * @returns {object} the frozen definition
   */
  register(definition) {
    if (this.frozen) {
      throw new Error(`${this.name} registry is frozen; register before freeze()`);
    }
    if (!definition || typeof definition !== 'object') {
      throw new TypeError(`${this.name} definition must be an object`);
    }
    const id = definition[this.idKey];
    if (id === undefined || id === null) {
      throw new TypeError(`${this.name} definition is missing "${this.idKey}"`);
    }
    if (this._byId.has(id)) {
      throw new Error(`${this.name} already has a definition with ${this.idKey}=${id}`);
    }
    if (this.validate) this.validate(definition);

    const frozen = Object.freeze({ ...definition });
    this._byId.set(id, frozen);
    if (typeof frozen.name === 'string') {
      if (this._byName.has(frozen.name)) {
        throw new Error(`${this.name} already has a definition named "${frozen.name}"`);
      }
      this._byName.set(frozen.name, frozen);
    }
    return frozen;
  }

  /** Register many definitions at once. */
  registerAll(definitions) {
    return definitions.map((def) => this.register(def));
  }

  /**
   * Look up by id, returning `undefined` when unknown.
   * @param {string|number} id
   */
  get(id) {
    return this._byId.get(id);
  }

  /**
   * Look up by id, throwing when unknown. Use at trust boundaries where a
   * missing definition is a programming error rather than bad client input.
   * @param {string|number} id
   */
  require(id) {
    const def = this._byId.get(id);
    if (!def) throw new Error(`Unknown ${this.name} id: ${JSON.stringify(id)}`);
    return def;
  }

  /** @param {string} name */
  getByName(name) {
    return this._byName.get(name);
  }

  /** @param {string|number} id */
  has(id) {
    return this._byId.has(id);
  }

  /** @returns {object[]} every registered definition */
  all() {
    return [...this._byId.values()];
  }

  /** @returns {(string|number)[]} every registered id */
  ids() {
    return [...this._byId.keys()];
  }

  get size() {
    return this._byId.size;
  }

  /** Prevent further registration. Call once content loading is done. */
  freeze() {
    this.frozen = true;
    return this;
  }
}

/**
 * Registry of handler functions keyed by a type id, with an optional fallback.
 *
 * This is the "one dispatcher instead of many switch statements" primitive
 * behind item use and interactions.
 */
export class HandlerRegistry {
  /**
   * @param {string} name
   * @param {Function|null} [fallback] invoked when no handler matches
   */
  constructor(name, fallback = null) {
    this.name = name;
    this.fallback = fallback;
    /** @type {Map<string|number, Function>} */
    this._handlers = new Map();
  }

  /**
   * @param {string|number} key
   * @param {Function} handler
   */
  register(key, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`${this.name} handler for ${key} must be a function`);
    }
    this._handlers.set(key, handler);
    return this;
  }

  /** @param {string|number} key */
  get(key) {
    return this._handlers.get(key) ?? this.fallback ?? undefined;
  }

  /** @param {string|number} key */
  has(key) {
    return this._handlers.has(key);
  }

  /**
   * Resolve and invoke the handler for `key`.
   * @param {string|number} key
   * @param {...*} args
   */
  dispatch(key, ...args) {
    const handler = this.get(key);
    if (!handler) {
      return { ok: false, reason: `no ${this.name} handler for ${String(key)}` };
    }
    return handler(...args);
  }

  get size() {
    return this._handlers.size;
  }
}
