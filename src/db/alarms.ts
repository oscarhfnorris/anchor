/**
 * Alarm persistence.
 *
 * Every function validates with the barrel's schemas — `selectSchema` on the way out, `insertSchema`
 * or `updateSchema` on the way in — the same way each tRPC procedure in a server app validates its
 * own input rather than trusting the caller.
 *
 * Parsing on read is not paranoia about the disk. Rows outlive versions: a database restored from an
 * iCloud backup of an older build, or one left by a half-applied migration, hands back a value
 * TypeScript will believe. Here that would mean an alarm that quietly does not fire.
 *
 * Whether an alarm *may* be enabled is policy and lives in `core/registry.ts`; this module asks for
 * the verdict and applies it.
 */
import { eq } from 'drizzle-orm';

import { canEnable, hasClearingTag as hasClearingTagFor, type AlarmKind, type EnableVerdict } from '../core/registry';
import { alarmDays, alarms, zodSchemas, type Alarm, type Weekday } from './schema';
import { readRegistry } from './tags';
import type { AnySqliteDb } from './types';

const alarmRow = zodSchemas.tables.alarms.selectSchema;
const alarmDayRow = zodSchemas.tables.alarmDays.selectSchema;
const alarmUpdate = zodSchemas.tables.alarms.updateSchema;

/** Every alarm, parsed. The hour and minute here decide when it fires. */
export async function readAlarms(db: AnySqliteDb): Promise<Alarm[]> {
  const rows = await db.select().from(alarms);
  return rows.map((row: unknown) => alarmRow.parse(row));
}

export async function enabledKinds(db: AnySqliteDb): Promise<AlarmKind[]> {
  return (await readAlarms(db)).filter((a) => a.enabled).map((a) => a.kind);
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
  await setEnabled(db, kind, true, now);
  return verdict;
}

export async function disableAlarm(db: AnySqliteDb, kind: AlarmKind, now: number): Promise<void> {
  await setEnabled(db, kind, false, now);
}

async function setEnabled(db: AnySqliteDb, kind: AlarmKind, enabled: boolean, now: number) {
  const patch = alarmUpdate.parse({ enabled, updatedAt: now });
  await db.update(alarms).set(patch).where(eq(alarms.kind, kind));
}

/** Change an alarm's wall-clock time. Refused before it reaches the CHECK, with a readable reason. */
export async function setAlarmTime(
  db: AnySqliteDb,
  kind: AlarmKind,
  hour: number,
  minute: number,
  now: number,
): Promise<void> {
  const patch = alarmUpdate.parse({ hour, minute, updatedAt: now });
  await db.update(alarms).set(patch).where(eq(alarms.kind, kind));
}

/** The active weekdays for an alarm, ascending. */
export async function weekdaysFor(db: AnySqliteDb, alarmId: number): Promise<Weekday[]> {
  const rows = await db.select().from(alarmDays).where(eq(alarmDays.alarmId, alarmId));
  return rows
    .map((row: unknown) => alarmDayRow.parse(row).weekday as Weekday)
    .sort((a: Weekday, b: Weekday) => a - b);
}
