/**
 * Engine-wide constants.
 *
 * Everything here is deliberately plain data so both the Node server and the
 * browser client can import this module unchanged.
 */

/** Chunk footprint in blocks along X and Z. */
export const CHUNK_SIZE = 16;

/** Chunk height in blocks along Y. */
export const CHUNK_HEIGHT = 64;

/** Number of blocks stored per chunk. */
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;

/** Region footprint in chunks, used to bucket persistence files. */
export const REGION_SIZE_CHUNKS = 16;

/** Y level used as the nominal sea/water surface. */
export const SEA_LEVEL = 30;

/** Default streaming radius, in chunks, around each player. */
export const DEFAULT_VIEW_DISTANCE = 4;

/** Maximum distance, in blocks, a player may interact at. */
export const MAX_REACH = 5;

/** Player collision box, in blocks. */
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.62;

/** Movement tuning shared by client prediction and server validation. */
export const GRAVITY = -24;
export const WALK_SPEED = 4.5;
export const RUN_SPEED = 7.0;
export const JUMP_VELOCITY = 8.4;
export const TERMINAL_VELOCITY = -60;

/**
 * Speed cap the server uses when validating movement, expressed as a multiple
 * of RUN_SPEED. Generous enough to absorb latency, tight enough to catch
 * teleport-style cheating.
 */
export const MOVE_SPEED_TOLERANCE = 2.5;

/** Inventory layout. */
export const QUICKBAR_SLOTS = 9;
export const INVENTORY_SLOTS = 36;

/** How long a dropped item survives before despawning, in seconds. */
export const GROUND_ITEM_TTL = 300;

/** How long the harvesting player has exclusive pickup rights, in seconds. */
export const GROUND_ITEM_OWNER_WINDOW = 15;
