/**
 * Alarm and tag persistence, and the invariant that binds them.
 *
 * **An enabled alarm always has a way to be cleared** (D27). Enabling one with no registered tag
 * would end the first night with an alarm nothing can silence, and the deletion half matters just
 * as much: removing the last tag of a role must disable the alarm that depends on it, or the
 * invariant holds only at creation and quietly lapses afterwards.
 *
 * Takes a database handle rather than importing the device one, so the same code runs under
 * `better-sqlite3` in tests (§15).
 */
import { and, eq } from 'drizzle-orm';

import type { AnySqliteDb } from './settings';
import { alarmDays, alarms, tags, type Alarm } from './schema';

/** Which tag role clears which alarm. The dock alarm is cleared by the dock tag, and so on. */
const CLEARING_ROLE = { dock: 'dock', wake: 'morning' } as const;

export type AlarmKind = keyof typeof CLEARING_ROLE;

export async function tagsForRole(db: AnySqliteDb, role: 'dock' | 'morning') {
  return db.select().from(tags).where(eq(tags.role, role));
}

/** Whether `kind` has at least one tag that could clear it. */
export async function hasClearingTag(db: AnySqliteDb, kind: AlarmKind): Promise<boolean> {
  const rows = await tagsForRole(db, CLEARING_ROLE[kind]);
  return rows.length > 0;
}

export type EnableResult = { ok: true } | { ok: false; reason: 'noClearingTag' };

/**
 * Enable an alarm, refusing when nothing could clear it (D27).
 *
 * Refusing loudly here is the whole point: the alternative is an alarm that rings forever on the
 * first night with only the escape hatch as a way out, which teaches the user to reach for the
 * escape hatch.
 */
export async function enableAlarm(db: AnySqliteDb, kind: AlarmKind, now: number): Promise<EnableResult> {
  if (!(await hasClearingTag(db, kind))) return { ok: false, reason: 'noClearingTag' };
  await db.update(alarms).set({ enabled: true, updatedAt: now }).where(eq(alarms.kind, kind));
  return { ok: true };
}

export async function disableAlarm(db: AnySqliteDb, kind: AlarmKind, now: number): Promise<void> {
  await db.update(alarms).set({ enabled: false, updatedAt: now }).where(eq(alarms.kind, kind));
}

/**
 * Delete a tag, disabling any alarm that can no longer be cleared (D27).
 *
 * Returns the alarms it disabled so the caller can tell the user *why* their alarm switched off —
 * an alarm that silently stops being enabled is the same silent failure D25 exists to prevent,
 * arriving through the settings screen instead of the bridge.
 */
export async function deleteTag(db: AnySqliteDb, uid: string, now: number): Promise<AlarmKind[]> {
  await db.delete(tags).where(eq(tags.uid, uid));

  const disabled: AlarmKind[] = [];
  for (const kind of Object.keys(CLEARING_ROLE) as AlarmKind[]) {
    if (await hasClearingTag(db, kind)) continue;
    const rows = (await db
      .select()
      .from(alarms)
      .where(and(eq(alarms.kind, kind), eq(alarms.enabled, true)))) as Alarm[];
    if (rows.length === 0) continue;
    await disableAlarm(db, kind, now);
    disabled.push(kind);
  }
  return disabled;
}

/** The active weekdays for an alarm, as `Weekday` values. */
export async function weekdaysFor(db: AnySqliteDb, alarmId: number): Promise<number[]> {
  const rows = await db.select().from(alarmDays).where(eq(alarmDays.alarmId, alarmId));
  return rows.map((r: { weekday: number }) => r.weekday).sort();
}
