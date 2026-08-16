/**
 * Tag persistence.
 *
 * Validates with the barrel's schemas in both directions, like every other repository here.
 *
 * What a tag *means* — which role clears which alarm, whether deleting one leaves an alarm
 * unclearable — is policy and lives in `core/registry.ts`. This module asks and applies.
 */
import { eq } from 'drizzle-orm';

import { alarmsLeftUnclearable, type AlarmKind } from '../../core/registry';
import { normaliseUid, type RegisteredTag } from '../../core/tags';
import { disableAlarm, enabledKinds } from './alarms';
import { tags, zodSchemas, type TagRole } from '../schema';
import type { AnySqliteDb } from '../types';

const tagRow = zodSchemas.tables.tags.selectSchema;
const tagInsert = zodSchemas.tables.tags.insertSchema;

/** Every registered tag, in the shape `core/` expects. */
export async function readRegistry(db: AnySqliteDb): Promise<RegisteredTag[]> {
  const rows = await db.select().from(tags);
  return rows.map((row: unknown) => {
    const tag = tagRow.parse(row);
    // A null place means portable (D34). Phase 2 gives fixed tags a place; until then every tag is
    // portable, which is why the step gate is universal in Phase 1.
    return { uid: tag.uid, role: tag.role, portable: tag.placeId === null };
  });
}

/**
 * Register a tag.
 *
 * The UID is normalised before validation, because a scan arrives however the reader formatted it
 * and the stored form is what every later comparison uses (D1). The insert schema then refuses
 * anything that is not normalised hex, so a value that skipped this path cannot reach the table.
 */
export async function createTag(
  db: AnySqliteDb,
  input: { uid: string; role: TagRole; label?: string | null },
  now: number,
): Promise<void> {
  const values = tagInsert.parse({
    ...input,
    uid: normaliseUid(input.uid),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(tags).values(values);
}

/**
 * Delete a tag, disabling any alarm it leaves with nothing to clear it (D27).
 *
 * Returns what was disabled so the caller can say *why* an alarm switched off. An alarm that
 * silently stops being enabled is the same silent failure D25 exists to prevent, arriving through
 * the settings screen rather than the bridge.
 */
export async function deleteTag(db: AnySqliteDb, uid: string, now: number): Promise<AlarmKind[]> {
  const normalised = normaliseUid(uid);
  const doomed = alarmsLeftUnclearable(normalised, await readRegistry(db), await enabledKinds(db));
  await db.delete(tags).where(eq(tags.uid, normalised));
  for (const kind of doomed) await disableAlarm(db, kind, now);
  return doomed;
}
