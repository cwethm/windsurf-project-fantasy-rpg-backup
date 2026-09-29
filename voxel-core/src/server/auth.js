/**
 * Account authentication.
 *
 * PBKDF2-HMAC-SHA256 with a per-account random salt, compared in constant
 * time. The iteration count and algorithm are stored alongside the hash so
 * existing accounts keep working when the parameters are raised later.
 */

import { randomBytes, randomUUID, pbkdf2, timingSafeEqual } from 'node:crypto';

/** OWASP's current guidance for PBKDF2-HMAC-SHA256. */
export const DEFAULT_ITERATIONS = 600_000;
export const KEY_LENGTH = 32;
export const DIGEST = 'sha256';

/**
 * Derive a key from a password.
 * @param {string} password
 * @param {string} salt hex encoded
 * @param {number} iterations
 * @param {string} digest
 * @returns {Promise<Buffer>}
 */
export function deriveKey(password, salt, iterations = DEFAULT_ITERATIONS, digest = DIGEST) {
  return new Promise((resolve, reject) => {
    pbkdf2(password, Buffer.from(salt, 'hex'), iterations, KEY_LENGTH, digest, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/**
 * Create a new account record.
 * @param {string} username
 * @param {string} password
 * @param {{ iterations?: number }} [options]
 */
export async function createAccount(username, password, { iterations = DEFAULT_ITERATIONS } = {}) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, iterations);
  return {
    id: randomUUID(),
    username,
    salt,
    iterations,
    digest: DIGEST,
    hash: key.toString('hex'),
    createdAt: Date.now(),
    lastLoginAt: null,
  };
}

/**
 * Verify a password against a stored account.
 * @param {object} account
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(account, password) {
  if (!account?.hash || !account?.salt) return false;
  const key = await deriveKey(
    password,
    account.salt,
    account.iterations ?? DEFAULT_ITERATIONS,
    account.digest ?? DIGEST,
  );
  const stored = Buffer.from(account.hash, 'hex');
  if (stored.length !== key.length) return false;
  return timingSafeEqual(stored, key);
}

/**
 * Authenticate, creating the account on first sight when `allowRegister` is on.
 *
 * Failure reasons are deliberately vague: telling a caller which half of the
 * pair was wrong hands them a username oracle.
 *
 * @param {{
 *   store: import('../storage/game-store.js').GameStore,
 *   username: string,
 *   password: string,
 *   allowRegister?: boolean,
 *   iterations?: number,
 * }} params
 * @returns {Promise<{ ok: boolean, reason?: string, account?: object, created?: boolean }>}
 */
export async function authenticate({ store, username, password, allowRegister = false, iterations }) {
  const existing = store.getAccount(username);

  if (!existing) {
    if (!allowRegister) return { ok: false, reason: 'invalid username or password' };
    const account = await createAccount(username, password, { iterations });
    account.lastLoginAt = Date.now();
    store.putAccount(account);
    return { ok: true, account, created: true };
  }

  if (!(await verifyPassword(existing, password))) {
    return { ok: false, reason: 'invalid username or password' };
  }
  existing.lastLoginAt = Date.now();
  store.putAccount(existing);
  return { ok: true, account: existing, created: false };
}
