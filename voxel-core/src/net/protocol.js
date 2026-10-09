/**
 * Wire protocol.
 *
 * Plain JSON with a `t` (type) field. The module is deliberately free of Node
 * built-ins so the browser client imports exactly the same definitions the
 * server validates against — one source of truth for message shapes.
 */

/** Client -> server message types. */
export const C2S = {
  LOGIN: 'login',
  REGISTER: 'register',
  MOVE: 'move',
  SELECT_SLOT: 'select_slot',
  BEGIN_HARVEST: 'begin_harvest',
  HARVEST: 'harvest',
  PLACE: 'place',
  INTERACT: 'interact',
  USE_ITEM: 'use_item',
  MOVE_ITEM: 'move_item',
  SPLIT_ITEM: 'split_item',
  DROP_ITEM: 'drop_item',
  PICKUP_ITEM: 'pickup_item',
  TRANSFER_ITEM: 'transfer_item',
  TRASH_ITEM: 'trash_item',
  LOCK_SLOT: 'lock_slot',
  CLOSE_CONTAINER: 'close_container',
  SORT_INVENTORY: 'sort_inventory',
  EQUIP: 'equip',
  UNEQUIP: 'unequip',
  ATTACK: 'attack',
  INTERACT_ENTITY: 'interact_entity',
  CHAT: 'chat',
  PING: 'ping',
};

/** Server -> client message types. */
export const S2C = {
  WELCOME: 'welcome',
  LOGIN_OK: 'login_ok',
  ERROR: 'error',
  CHUNK: 'chunk',
  CHUNK_UNLOAD: 'chunk_unload',
  BLOCK_UPDATE: 'block_update',
  TILE_ENTITY_UPDATE: 'tile_entity_update',
  PLAYER_STATE: 'player_state',
  PLAYER_JOIN: 'player_join',
  PLAYER_LEAVE: 'player_leave',
  PLAYER_UPDATE: 'player_update',
  SELF_STATE: 'self_state',
  INVENTORY: 'inventory',
  CONTAINER: 'container',
  GROUND_ITEMS: 'ground_items',
  ENTITY_ADD: 'entity_add',
  ENTITY_UPDATE: 'entity_update',
  ENTITY_REMOVE: 'entity_remove',
  ENTITY_ACTION: 'entity_action',
  ACTION_RESULT: 'action_result',
  CHAT: 'chat',
  PONG: 'pong',
};

/** Messages a client may send before it has authenticated. */
export const UNAUTHENTICATED_TYPES = new Set([C2S.LOGIN, C2S.REGISTER, C2S.PING]);

/** Protocol version; bumped whenever message shapes change incompatibly. */
export const PROTOCOL_VERSION = 1;

/** Hard cap on a single inbound frame, in bytes. */
export const MAX_MESSAGE_BYTES = 16 * 1024;

/**
 * Build a message object.
 * @param {string} type
 * @param {object} [payload]
 */
export function message(type, payload = {}) {
  return { t: type, ...payload };
}

/** Serialise a message for the socket. */
export function encode(type, payload = {}) {
  return JSON.stringify(message(type, payload));
}

/**
 * Parse and sanity-check an inbound frame.
 *
 * Returns a discriminated result rather than throwing, because a malformed
 * frame is an expected event on a public server, not an exception.
 *
 * @param {string|Uint8Array} raw
 * @returns {{ ok: true, message: object } | { ok: false, reason: string }}
 */
export function decode(raw) {
  const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
  if (text.length > MAX_MESSAGE_BYTES) return { ok: false, reason: 'message too large' };

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'malformed JSON' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'message must be an object' };
  }
  if (typeof parsed.t !== 'string') return { ok: false, reason: 'missing message type' };
  return { ok: true, message: parsed };
}

// ------------------------------------------------------------- field checks

/** Finite number within an inclusive range. */
export function isNumberInRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/** Integer block coordinate triple, with a sane world-space bound. */
export function isBlockPosition(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isInteger(value.x) &&
    Number.isInteger(value.y) &&
    Number.isInteger(value.z) &&
    Math.abs(value.x) <= 30_000_000 &&
    Math.abs(value.z) <= 30_000_000 &&
    value.y >= 0 &&
    value.y < 4096
  );
}

/** Floating-point position triple. */
export function isVector3(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
}

/** Usernames are the account key, so keep them conservative. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,16}$/;

/**
 * Validate credentials shared by login and register.
 * @param {object} msg
 */
export function validateCredentials(msg) {
  if (typeof msg.username !== 'string' || !USERNAME_PATTERN.test(msg.username)) {
    return { ok: false, reason: 'username must be 3-16 letters, digits, _ or -' };
  }
  if (typeof msg.password !== 'string' || msg.password.length < 6 || msg.password.length > 128) {
    return { ok: false, reason: 'password must be 6-128 characters' };
  }
  return { ok: true };
}

/**
 * Per-type payload validation. Anything the server later trusts must be
 * checked here first.
 *
 * @param {object} msg
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validate(msg) {
  switch (msg.t) {
    case C2S.LOGIN:
    case C2S.REGISTER:
      return validateCredentials(msg);

    case C2S.MOVE:
      if (!isVector3(msg.position)) return { ok: false, reason: 'invalid position' };
      if (!isNumberInRange(msg.yaw ?? 0, -Math.PI * 4, Math.PI * 4)) {
        return { ok: false, reason: 'invalid yaw' };
      }
      if (!isNumberInRange(msg.pitch ?? 0, -Math.PI, Math.PI)) {
        return { ok: false, reason: 'invalid pitch' };
      }
      return { ok: true };

    case C2S.SELECT_SLOT:
      return Number.isInteger(msg.slot) && msg.slot >= 0 && msg.slot < 64
        ? { ok: true }
        : { ok: false, reason: 'invalid slot' };

    case C2S.BEGIN_HARVEST:
    case C2S.HARVEST:
    case C2S.INTERACT:
      return isBlockPosition(msg.target) ? { ok: true } : { ok: false, reason: 'invalid target' };

    case C2S.PLACE:
      if (!isBlockPosition(msg.target)) return { ok: false, reason: 'invalid target' };
      if (msg.slot !== undefined && !Number.isInteger(msg.slot)) {
        return { ok: false, reason: 'invalid slot' };
      }
      return { ok: true };

    case C2S.USE_ITEM:
      if (msg.slot !== undefined && !Number.isInteger(msg.slot)) {
        return { ok: false, reason: 'invalid slot' };
      }
      if (msg.target !== undefined && msg.target !== null && !isBlockPosition(msg.target)) {
        return { ok: false, reason: 'invalid target' };
      }
      return { ok: true };

    case C2S.MOVE_ITEM:
      return Number.isInteger(msg.from) && Number.isInteger(msg.to)
        ? { ok: true }
        : { ok: false, reason: 'invalid slots' };

    case C2S.SPLIT_ITEM:
    case C2S.DROP_ITEM:
    case C2S.TRASH_ITEM:
    case C2S.LOCK_SLOT:
      return Number.isInteger(msg.slot) ? { ok: true } : { ok: false, reason: 'invalid slot' };

    case C2S.TRANSFER_ITEM:
      if (!Number.isInteger(msg.slot)) return { ok: false, reason: 'invalid slot' };
      if (msg.direction !== 'to_container' && msg.direction !== 'to_player') {
        return { ok: false, reason: 'invalid direction' };
      }
      if (msg.to !== undefined && msg.to !== null && !Number.isInteger(msg.to)) {
        return { ok: false, reason: 'invalid slot' };
      }
      return { ok: true };

    case C2S.EQUIP:
      return Number.isInteger(msg.slot) ? { ok: true } : { ok: false, reason: 'invalid slot' };

    case C2S.UNEQUIP:
      if (typeof msg.equipSlot !== 'string' || msg.equipSlot.length === 0 || msg.equipSlot.length > 32) {
        return { ok: false, reason: 'invalid equipment slot' };
      }
      if (msg.to !== undefined && msg.to !== null && !Number.isInteger(msg.to)) {
        return { ok: false, reason: 'invalid slot' };
      }
      return { ok: true };

    case C2S.ATTACK:
    case C2S.INTERACT_ENTITY:
      return typeof msg.entity === 'string' && msg.entity.length > 0 && msg.entity.length <= 64
        ? { ok: true }
        : { ok: false, reason: 'invalid entity id' };
    case C2S.PICKUP_ITEM:
      return typeof msg.id === 'string' && msg.id.length <= 64
        ? { ok: true }
        : { ok: false, reason: 'invalid item id' };

    case C2S.CHAT:
      return typeof msg.text === 'string' && msg.text.trim().length > 0 && msg.text.length <= 256
        ? { ok: true }
        : { ok: false, reason: 'invalid chat message' };

    case C2S.CLOSE_CONTAINER:
    case C2S.SORT_INVENTORY:
    case C2S.PING:
      return { ok: true };

    default:
      return { ok: false, reason: `unknown message type "${msg.t}"` };
  }
}
