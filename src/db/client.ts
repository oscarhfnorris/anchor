/**
 * The on-device database handle.
 *
 * `PRAGMA foreign_keys = ON` is set on every connection. SQLite ships with foreign keys *disabled*,
 * and Drizzle does not enable them, so a schema full of correct FK declarations otherwise enforces
 * nothing at all — silently. The test harness sets the same pragma (test/db.ts); if the two ever
 * disagree, violations pass locally and fail on device.
 *
 * SQLite holds intent (§12). It is the single durable source of truth; AlarmKit's scheduled alarms
 * and the App Group mirror are derived from it and are never read to decide what should be true.
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

export const DATABASE_NAME = 'anchor.db';

const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: false });
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite);
