/**
 * Alarm and tag persistence.
 *
 * Reads rows, applies the verdict `core/registry.ts` returns, and writes the result. The rules
 * themselves — which role clears which alarm, whether an alarm may be enabled, what a deletion
 * breaks — are policy and live in `core/`, where they can be tested without a database.
 *
 * Takes a database handle rather than importing the device one, so the same code runs under
 * `better-sqlite3` in tests (§15).
 */
import { eq } from 'drizzle-orm';

import {
  alarmsLeftUnclearable,
  canEnable,
  hasClearingTag as hasClearingTagFor,
  type AlarmKind,
  type EnableVerdict,
} from '../core/registry';
import type { RegisteredTag } from '../core/tags';
import { alarmDays, alarms, tags } from './schema';
import type { AnySqliteDb } from './settings';

/** Every registered tag, in the shape `core/` expects. */
export async function readRegistry(db: AnySqliteDb): Promise<RegisteredTag[]> {
  const rows = await db.select().from(tags);
  return rows.map((r: { uid: string; role: 'dock' | 'morning'; placeId: number | null }) => ({
    uid: r.uid,
    role: r.role,
    portable: r.placeId === null,
  }));
}

export async function enabledKinds(db: AnySqliteDb): Promise<AlarmKind[]> {
  const rows = await db.select().from(alarms);
  return rows.filter((r: { enabled: boolean }) => r.enabled).map((r: { kind: AlarmKind }) => r.kind);
}

export async function hasClearingTag(db: AnySqliteDb, kind: AlarmKind): Promise<boolean> {
  return hasClearingTagFor(kind, await readRegistry(db));
}

/** Enable an alarm if `core/` allows it (D27). */
export async function enableAlarm(
  db: AnySqliteDb,
  kind: AlarmKind,
  now: number,
): Promise<EnableVerdict> {
  const verdict = canEnable(kind, await readRegistry(db));
  if (!verdict.ok) return verdict;
  await db.update(alarms).set({ enabled: true, updatedAt: now }).where(eq(alarms.kind, kind));
  return verdict;
}

export async function disableAlarm(db: AnySqliteDb, kind: AlarmKind, now: number): Promise<void> {
  await db.update(alarms).set({ enabled: false, updatedAt: now }).where(eq(alarms.kind, kind));
}

/**
 * Delete a tag, disabling any alarm it leaves unclearable (D27).
 *
 * Returns what it disabled so the caller can say why.
 */
export async function deleteTag(db: AnySqliteDb, uid: string, now: number): Promise<AlarmKind[]> {
  const doomed = alarmsLeftUnclearable(uid, await readRegistry(db), await enabledKinds(db));
  await db.delete(tags).where(eq(tags.uid, uid));
  for (const kind of doomed) await disableAlarm(db, kind, now);
  return doomed;
}

/** The active weekdays for an alarm. */
export async function weekdaysFor(db: AnySqliteDb, alarmId: number): Promise<number[]> {
  const rows = await db.select().from(alarmDays).where(eq(alarmDays.alarmId, alarmId));
  return rows.map((r: { weekday: number }) => r.weekday).sort();
}
