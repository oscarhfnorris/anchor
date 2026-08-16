/**
 * Reads and writes for the `app_settings` singleton.
 *
 * These take the database handle as an argument rather than importing the device one. That is what
 * lets the same code run against `expo-sqlite` on device and `better-sqlite3` in tests — the whole
 * point of one schema driving both drivers (§15). Importing `./client` here would pull `expo-sqlite`
 * into every test that touches settings, and none of it would run in Node.
 */
import { eq } from 'drizzle-orm';

import { appSettings, zodSchemas, type AppSettings } from '../schema';
import type { AnySqliteDb } from '../types';

export const SINGLETON_ID = 1;

/**
 * The settings singleton, parsed on the way out.
 *
 * These values gate behaviour — `stepThreshold` decides whether a scan is accepted, `rearmSeconds`
 * how soon the alarm returns. A row from an older build with a missing or out-of-range value would
 * otherwise flow straight into `core/` and change what the alarm does, silently.
 */
export async function readSettings(db: AnySqliteDb): Promise<AppSettings | undefined> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.id, SINGLETON_ID));
  return rows[0] === undefined
    ? undefined
    : zodSchemas.tables.appSettings.selectSchema.parse(rows[0]);
}

/** Upserts the singleton with a fresh `updated_at`, and returns the instant written. */
export async function touchSettings(db: AnySqliteDb, now: number = Date.now()): Promise<number> {
  const values = zodSchemas.tables.appSettings.insertSchema.parse({ id: SINGLETON_ID, updatedAt: now });
  await db
    .insert(appSettings)
    .values(values)
    .onConflictDoUpdate({ target: appSettings.id, set: { updatedAt: now } });
  return now;
}
