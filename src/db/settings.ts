/**
 * Reads and writes for the `app_settings` singleton.
 *
 * These take the database handle as an argument rather than importing the device one. That is what
 * lets the same code run against `expo-sqlite` on device and `better-sqlite3` in tests — the whole
 * point of one schema driving both drivers (§15). Importing `./client` here would pull `expo-sqlite`
 * into every test that touches settings, and none of it would run in Node.
 */
import { eq } from 'drizzle-orm';

import type { AnySqliteDb } from './types';
import { appSettings } from './schema';
import type { AppSettings } from './zod-schema';

export const SINGLETON_ID = 1;

export async function readSettings(db: AnySqliteDb): Promise<AppSettings | undefined> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.id, SINGLETON_ID));
  return rows[0];
}

/** Upserts the singleton with a fresh `updated_at`, and returns the instant written. */
export async function touchSettings(db: AnySqliteDb, now: number = Date.now()): Promise<number> {
  await db
    .insert(appSettings)
    .values({ id: SINGLETON_ID, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.id, set: { updatedAt: now } });
  return now;
}
