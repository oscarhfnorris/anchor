/**
 * The occurrence lifecycle — the watchdog that makes a silent failure visible.
 *
 * The worst thing this app can do is not ring and not say so (D25). Detection has to be
 * retrospective (D29): if the bridge fails, nothing is running at the time to record it, so a miss
 * is inferred on launch from a row that is past due with no `fired_at`.
 *
 * That only works if rows exist *ahead* of time, which is why a horizon is materialised. One would
 * be tempting and wrong: one-shot scheduling means the app must run to create the next row, so a
 * phone that is off overnight would miss tonight *and* never schedule tomorrow — a silent cascade
 * where the alarm stays dead until the app happens to be opened.
 *
 * Pure functions over plain data. Persisting the result is the caller's job.
 */
import { horizon, type Schedule } from './schedule';

/** The subset of a stored occurrence these rules need. */
export interface OccurrenceRow {
  id: number;
  dueAt: number;
  firedAt: number | null;
  clearedAt: number | null;
}

/** Default horizon: enough margin for a phone that is off overnight, not enough to become noise. */
export const HORIZON_COUNT = 3;

/**
 * Occurrences that should exist but do not, given what is already stored.
 *
 * Idempotent by construction — an instant already present is never proposed again, which is what
 * lets reconcile run on every launch and foreground without duplicating rows.
 */
export function missingOccurrences(
  schedule: Schedule,
  existing: readonly OccurrenceRow[],
  now: number,
  count = HORIZON_COUNT,
): number[] {
  const known = new Set(existing.map((o) => o.dueAt));
  return horizon(schedule, now, count).filter((at) => !known.has(at));
}

/**
 * Occurrences that were missed: past due, never fired, not resolved.
 *
 * Bounded by `now` deliberately. Without that, every unresolved *future* row in the horizon would
 * report as a miss the moment it was created, and the home screen would cry wolf every launch.
 */
export function missedOccurrences(
  existing: readonly OccurrenceRow[],
  now: number,
): OccurrenceRow[] {
  return existing.filter((o) => o.dueAt < now && o.firedAt === null && o.clearedAt === null);
}

/**
 * Unresolved future occurrences, which are the ones an edit invalidates.
 *
 * Changing 07:00 to 07:30 with a horizon already materialised would otherwise leave the old instants
 * scheduled and the new time purely cosmetic — the user would have changed the alarm and the alarm
 * would not have changed. A timezone change invalidates the same set, because `due_at` is an
 * absolute instant while the schedule is wall-clock (D23).
 */
export function invalidatedByChange(
  existing: readonly OccurrenceRow[],
  now: number,
): OccurrenceRow[] {
  return existing.filter((o) => o.dueAt >= now && o.firedAt === null);
}

/**
 * What reconciliation should ask the OS to do.
 *
 * Compares unresolved future occurrences against what the engine actually holds. Not occurrences
 * against alarms — one alarm has many occurrences over its life; the comparable set is small and
 * exact, which is what makes this idempotent.
 *
 * **Compares ids, never instants.** The bridge can only report which alarm ids exist, not when it
 * thinks each fires. That is sufficient because an edit or timezone change invalidates the affected
 * future occurrences and creates new rows with new ids, so a moved time arrives as a different id
 * rather than the same id at a new instant.
 */
export interface ReconcilePlan {
  schedule: { id: string; at: number }[];
  cancel: string[];
}

export const occurrenceAlarmId = (occurrenceId: number): string => `occurrence:${occurrenceId}`;

export function reconcile(
  desired: readonly OccurrenceRow[],
  heldIds: readonly string[],
  now: number,
): ReconcilePlan {
  const wanted = new Map<string, number>();
  for (const o of desired) {
    if (o.dueAt >= now && o.firedAt === null && o.clearedAt === null) {
      wanted.set(occurrenceAlarmId(o.id), o.dueAt);
    }
  }
  const held = new Set(heldIds);

  const schedule = [...wanted]
    .filter(([id]) => !held.has(id))
    .map(([id, at]) => ({ id, at }));
  const cancel = [...held].filter((id) => !wanted.has(id));
  return { schedule, cancel };
}

/**
 * Re-issue the whole desired set without reading platform state back.
 *
 * Named a fallback when written, but with `expo-alarm-kit` it is the **primary** strategy: that
 * bridge's `getAllAlarms()` lists what the bridge wrote to App Group storage, not what AlarmKit
 * holds, so comparing against it compares two mirrors rather than intent against reality.
 *
 * Correct because re-scheduling a known id overwrites rather than duplicating, so idempotence
 * survives without ever reading state back. Its cost is real and unavoidable here: an alarm the app
 * does not know about can never be detected or cleaned up.
 */
export function reissueAll(desired: readonly OccurrenceRow[], now: number): ReconcilePlan {
  return { schedule: reconcile(desired, [], now).schedule, cancel: [] };
}
