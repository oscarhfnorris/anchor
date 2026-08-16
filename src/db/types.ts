/**
 * Types shared across the database layer.
 *
 * Kept out of `client.ts` deliberately: that module opens the device database as a side effect of
 * being imported, so anything pulling a type from it risks dragging `expo-sqlite` into a Node test.
 * A co-located `types.ts` is the house convention for exactly this.
 */
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

/**
 * Either driver's handle: `expo-sqlite` on device, `better-sqlite3` in tests.
 *
 * Repositories take this as an argument rather than importing the device handle, which is what makes
 * "one schema drives both drivers" true rather than merely claimed (§15).
 */
export type AnySqliteDb = BaseSQLiteDatabase<'sync' | 'async', unknown, Record<string, unknown>>;
