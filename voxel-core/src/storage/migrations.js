/**
 * Schema versioning and migrations.
 *
 * The schema *will* change, so versioning exists from day one. Every save file
 * carries a `schemaVersion`; loading runs each migration whose `to` version is
 * newer than the file, in order. Migrations are pure functions from one
 * snapshot shape to the next.
 */

/** Bump this whenever a migration is added. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * @typedef {object} Migration
 * @property {number} to resulting schema version
 * @property {string} description why the shape changed
 * @property {(data: object) => object} migrate
 */

/**
 * Ordered migration list. Append only; never edit a released migration.
 * @type {Migration[]}
 */
export const MIGRATIONS = [
  {
    to: 1,
    description: 'initial schema: worlds, players and accounts',
    migrate(data) {
      return {
        ...data,
        accounts: data.accounts ?? {},
        players: data.players ?? {},
        world: data.world ?? { chunks: [], regrowth: [] },
        groundItems: data.groundItems ?? [],
        meta: { seed: null, createdAt: Date.now(), ...(data.meta ?? {}) },
      };
    },
  },
];

/**
 * Bring a snapshot up to `CURRENT_SCHEMA_VERSION`.
 * @param {object} data raw snapshot, possibly from an older build
 * @returns {{ data: object, applied: string[] }}
 */
export function migrate(data) {
  const applied = [];
  let current = data ?? {};
  let version = Number.isInteger(current.schemaVersion) ? current.schemaVersion : 0;

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `save was written by a newer build (schema ${version} > ${CURRENT_SCHEMA_VERSION}); refusing to downgrade`,
    );
  }

  for (const migration of MIGRATIONS) {
    if (migration.to <= version) continue;
    current = migration.migrate(current);
    version = migration.to;
    applied.push(`${migration.to}: ${migration.description}`);
  }

  current.schemaVersion = CURRENT_SCHEMA_VERSION;
  return { data: current, applied };
}

/** An empty, current-version snapshot. */
export function emptySnapshot(seed = null) {
  const { data } = migrate({ meta: { seed } });
  return data;
}
