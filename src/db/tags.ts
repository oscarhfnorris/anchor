/**
 * Tag persistence.
 *
 * Reads and writes rows in the `tags` table. What a tag *means* — which role clears which alarm,
 * whether deleting one leaves an alarm unclearable — is policy and lives in `core/registry.ts`.
 * This module asks for the verdict and applies it.
 */
import { eq } from 'drizzle-orm';

import { alarmsLeftUnclearable, type AlarmKind } from '../core/registry';
import type { RegisteredTag } from '../core/tags';
import { disableAlarm, enabledKinds } from './alarms';
import { tags } from './schema';
import type { AnySqliteDb } from './types';

/** Every registered tag, in the shape `core/` expects. */
export async function readRegistry(db: AnySqliteDb): Promise<RegisteredTag[]> {
  const rows = await db.select().from(tags);
  return rows.map((r: { uid: string; role: 'dock' | 'morning'; placeId: number | null }) => ({
    uid: r.uid,
    role: r.role,
    // Null place means portable (D34). Phase 2 gives fixed tags a place; until then every tag is
    // portable, which is why the step gate is universal in Phase 1.
    portable: r.placeId === null,
  }));
}

/**
 * Delete a tag, disabling any alarm it leaves with nothing to clear it (D27).
 *
 * Returns what was disabled so the caller can say *why* an alarm switched off. An alarm that
 * silently stops being enabled is the same silent failure D25 exists to prevent, arriving through
 * the settings screen rather than the bridge.
 */
export async function deleteTag(db: AnySqliteDb, uid: string, now: number): Promise<AlarmKind[]> {
  const doomed = alarmsLeftUnclearable(uid, await readRegistry(db), await enabledKinds(db));
  await db.delete(tags).where(eq(tags.uid, uid));
  for (const kind of doomed) await disableAlarm(db, kind, now);
  return doomed;
}
