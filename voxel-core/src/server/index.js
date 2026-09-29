/**
 * Server-side public surface. These modules use Node built-ins and are not
 * importable from the browser.
 */

export {
  createAccount,
  verifyPassword,
  authenticate,
  deriveKey,
  DEFAULT_ITERATIONS,
} from './auth.js';
export { Session } from './session.js';
export { GameServer, DEFAULT_SERVER_OPTIONS } from './game-server.js';
export { createStaticServer, resolveWithinRoot } from './static-server.js';
export { main, config } from './main.js';
