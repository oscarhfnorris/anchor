/**
 * Alarm persistence.
 *
 * Reads and writes rows in the `alarms` and `alarm_days` tables. Whether an alarm *may* be enabled
 * is policy and lives in `core/registry.ts`; this module asks for the verdict and applies it.
 */
import { eq } from 'drizzle-orm';

import { canEnable, hasClearingTag as hasClearingTagFor, type AlarmKind, type EnableVerdict } from '../core/registry';
import { alarmDays, alarms } from './schema';
import { readRegistry } from './tags';
import type { AnySqliteDb } from './types';

export async function enabledKinds(db: AnySqliteDb): Promise<AlarmKind[]> {
  const rows = await db.select().from(alarms);
  return rows.filter((r: { enabled: boolean }) => r.enabled).map((r: { kind: AlarmKind }) => r.kind);
}

export async function hasClearingTag(db: AnySqliteDb, kind: AlarmKind): Promise<boolean> {
  return hasClearingTagFor(kind, await readRegistry(db));
}

/** Enable an alarm if `core/` allows it — refused when nothing could clear it (D27). */
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

/** The active weekdays for an alarm, ascending. */
export async function weekdaysFor(db: AnySqliteDb, alarmId: number): Promise<number[]> {
  const rows = await db.select().from(alarmDays).where(eq(alarmDays.alarmId, alarmId));
  return rows.map((r: { weekday: number }) => r.weekday).sort((a: number, b: number) => a - b);
}
