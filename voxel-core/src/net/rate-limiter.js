/**
 * Rate limiting.
 *
 * A token bucket per connection, plus per-action buckets for the expensive
 * verbs. The server never trusts a client's pace any more than it trusts its
 * claimed position.
 */

export class TokenBucket {
  /**
   * @param {{ capacity: number, refillPerSecond: number, now?: number }} config
   */
  constructor({ capacity, refillPerSecond, now = Date.now() }) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.tokens = capacity;
    this.updatedAt = now;
  }

  /**
   * Try to spend tokens.
   * @param {number} [cost]
   * @param {number} [now]
   * @returns {boolean} false when the caller is over budget
   */
  take(cost = 1, now = Date.now()) {
    const elapsed = Math.max(0, now - this.updatedAt) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    this.updatedAt = now;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}

/** Default budgets, in (capacity, refill per second) pairs. */
export const DEFAULT_LIMITS = {
  global: { capacity: 120, refillPerSecond: 60 },
  move: { capacity: 40, refillPerSecond: 30 },
  build: { capacity: 20, refillPerSecond: 8 },
  inventory: { capacity: 30, refillPerSecond: 10 },
  chat: { capacity: 5, refillPerSecond: 0.5 },
  auth: { capacity: 5, refillPerSecond: 0.2 },
};

/** Which budget each message type draws from. */
export const ACTION_BUDGETS = {
  login: 'auth',
  register: 'auth',
  move: 'move',
  begin_harvest: 'build',
  harvest: 'build',
  place: 'build',
  interact: 'build',
  use_item: 'build',
  move_item: 'inventory',
  split_item: 'inventory',
  drop_item: 'inventory',
  pickup_item: 'inventory',
  transfer_item: 'inventory',
  trash_item: 'inventory',
  lock_slot: 'inventory',
  sort_inventory: 'inventory',
  equip: 'inventory',
  unequip: 'inventory',
  chat: 'chat',
};

export class RateLimiter {
  /**
   * @param {Record<string, { capacity: number, refillPerSecond: number }>} [limits]
   * @param {number} [now]
   */
  constructor(limits = DEFAULT_LIMITS, now = Date.now()) {
    this.limits = limits;
    /** @type {Map<string, TokenBucket>} */
    this.buckets = new Map();
    for (const [name, config] of Object.entries(limits)) {
      this.buckets.set(name, new TokenBucket({ ...config, now }));
    }
  }

  /**
   * Charge a message against its budget and the global budget.
   * @param {string} messageType
   * @param {number} [now]
   * @returns {{ ok: boolean, budget?: string }}
   */
  check(messageType, now = Date.now()) {
    const global = this.buckets.get('global');
    if (global && !global.take(1, now)) return { ok: false, budget: 'global' };

    const budgetName = ACTION_BUDGETS[messageType];
    if (!budgetName) return { ok: true };
    const bucket = this.buckets.get(budgetName);
    if (bucket && !bucket.take(1, now)) return { ok: false, budget: budgetName };
    return { ok: true };
  }
}
