/**
 * The test database harness.
 *
 * SQLite has no shared server, so a fresh in-memory database per test is the isolation model — no
 * container, no ports, no cross-test state, and vitest's file-level parallelism costs nothing.
 *
 * The trick that keeps thousands of tests cheap: migrating per test would dominate the runtime, so
 * we migrate **once** into a template, snapshot it with `db.serialize()`, and restore that buffer
 * per test. Restoring becomes a memcpy rather than a migration run.
 *
 *     migrate once  →  serialize()          →  Buffer
 *     per test      →  new Database(buffer) →  isolated db, already migrated
 *
 * Note `new Database(buffer)` and not `Database.deserialize()` — better-sqlite3 has no such static.
 * The plan asserted otherwise from recall until Phase 0 checked it.
 *
 * `PRAGMA foreign_keys = ON` is set on every restored connection, matching src/db/client.ts. It is
 * per-connection state and does not travel inside the snapshot, so setting it only on the template
 * would leave every test running with foreign keys silently off — violations passing here and
 * failing on device.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

let template: Buffer | undefined;

function buildTemplate(): Buffer {
  const seed = new Database(':memory:');
  migrate(drizzle(seed), { migrationsFolder: './src/db/migrations' });
  const snapshot = seed.serialize();
  seed.close();
  return snapshot;
}

export interface TestDb {
  db: ReturnType<typeof drizzle>;
  sqlite: Database.Database;
  close: () => void;
}

/** A migrated, isolated database. Call it in each test; never share one between tests. */
export function createTestDb(): TestDb {
  template ??= buildTemplate();
  const sqlite = new Database(template);
  sqlite.pragma('foreign_keys = ON');
  return {
    db: drizzle(sqlite),
    sqlite,
    close: () => sqlite.close(),
  };
}
