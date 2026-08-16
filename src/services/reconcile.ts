/**
 * Making the OS match what the database intends.
 *
 * SQLite holds intent; AlarmKit's alarms are derived from it and are never read to decide what
 * should be true (§12). Nothing enlists an OS alarm in a database transaction, so the design is
 * reconciliation rather than transaction: write intent first, then make reality follow, and repair
 * the gap on every launch and foreground.
 *
 * Lives outside `db/` and outside `core/` because it is neither. `core/` decides what should exist
 * and cannot touch a platform API; `db/` stores rows and knows nothing about alarms. This is the
 * one place that holds both, which is exactly why it is small and does no deciding of its own.
 *
 * **It runs blind by choice.** `listScheduled()` on the real bridge reports what the bridge wrote to
 * App Group storage, not what AlarmKit holds — a second mirror, not the truth — so an empty answer
 * means "unknown", never "nothing is scheduled". Re-issuing the desired set is therefore the safe
 * path: re-scheduling a known id overwrites rather than duplicating, so doing it every time is
 * harmless, and doing it blind is honest about what can be known.
 */
import type { AlarmEngine } from '../alarm/types';
import { horizon, type Schedule } from '../core/schedule';
import { occurrenceAlarmId, reissueAll, type OccurrenceRow } from '../core/occurrences';
import { readAlarms, weekdaysFor } from '../db/repositories/alarms';
import {
  materialise,
  readMissed,
  readOccurrences,
  readPending,
} from '../db/repositories/occurrences';
import type { AnySqliteDb } from '../db/types';
import type { Weekday } from '../db/schema';

export interface ReconcileReport {
  /** Occurrences created to keep the horizon full. */
  materialised: number;
  /** Alarms handed to the OS. */
  scheduled: number;
  /** Past-due occurrences that never fired — the thing the user must be told about (D25). */
  missed: OccurrenceRow[];
}

/**
 * Bring stored intent and the OS into agreement, and report what was missed while away.
 *
 * Idempotent: running it twice is harmless, which is what lets it run on every launch and every
 * foreground without anyone reasoning about whether it is safe to.
 */
export async function reconcile(
  db: AnySqliteDb,
  engine: AlarmEngine,
  now: number,
): Promise<ReconcileReport> {
  const alarms = await readAlarms(db);
  let materialised = 0;

  for (const alarm of alarms) {
    if (!alarm.enabled) continue;

    const weekdays = (await weekdaysFor(db, alarm.id)) as Weekday[];
    const schedule: Schedule = { hour: alarm.hour, minute: alarm.minute, weekdays };

    // A horizon rather than one occurrence: one-shot scheduling means the app must run to create
    // the next row, so a phone that is off overnight would miss tonight *and* never schedule
    // tomorrow — dead until someone happens to open the app.
    const wanted = horizon(schedule, now);
    const known = new Set((await readOccurrences(db, alarm.id)).map((o) => o.dueAt));
    const missing = wanted.filter((at) => !known.has(at));

    if (missing.length > 0) {
      // Intent is written before the OS is told, so a crash in between is recoverable: the next
      // reconcile sees an intent with no alarm and repairs it. The reverse order loses the intent.
      await materialise(db, alarm.id, missing, now);
      materialised += missing.length;
    }
  }

  const pending = await readPending(db, now);
  const plan = reissueAll(pending, now);
  for (const { id, at } of plan.schedule) await engine.schedule(id, at);

  return { materialised, scheduled: plan.schedule.length, missed: await readMissed(db, now) };
}

/** The engine id for an occurrence, so callers can cancel one without knowing the format. */
export { occurrenceAlarmId };
