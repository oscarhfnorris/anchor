/**
 * Next-occurrence arithmetic, shared by both features.
 *
 * Schedules are **wall-clock local** (D23): 07:00 means 07:00 on the clock in the room, including
 * the day the clocks change. That is why an alarm is stored as hour/minute plus active weekdays and
 * resolved against local time here, rather than stored as an instant. Storing instants is precisely
 * how alarm apps drift by an hour twice a year.
 *
 * `core/` is pure but not timezone-free: it takes `now` as an argument and never reads a clock, yet
 * it must ask the host what local time *means*. `Date` is a language built-in rather than a platform
 * module, so using it here does not breach the purity rule — importing `expo-localization` would.
 */

/** 0 = Sunday, matching `Date#getDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Schedule {
  hour: number;
  minute: number;
  /** Active days. An empty set never fires. */
  weekdays: readonly Weekday[];
}

/**
 * The next instant this schedule fires at or after `from`.
 *
 * Returns `null` when no weekday is active — a schedule that can never fire is a real state (the
 * user unticked every day) and is reported rather than guessed at.
 *
 * Searches forward a day at a time and rebuilds the local time on each candidate date, so a DST
 * transition shifts the instant without shifting the wall-clock time. Eight days are enough to find
 * any weekly occurrence, with the extra day covering the "later today" case.
 */
export function nextOccurrence(schedule: Schedule, from: number): number | null {
  if (schedule.weekdays.length === 0) return null;
  const active = new Set<number>(schedule.weekdays);

  for (let offset = 0; offset <= 8; offset++) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(schedule.hour, schedule.minute, 0, 0);
    if (!active.has(candidate.getDay())) continue;
    const at = candidate.getTime();
    if (at >= from) return at;
  }
  return null;
}

/**
 * Occurrences to materialise ahead of now, oldest first.
 *
 * A horizon exists because one-shot scheduling means the app must run to create the next row: with
 * a horizon of one, a phone that is off overnight misses tonight *and* never schedules tomorrow,
 * and the alarm stays dead until the app happens to be opened. A few gives margin without letting
 * unresolved rows pile up into noise for the miss query (D29).
 */
export function horizon(schedule: Schedule, from: number, count = 3): number[] {
  const out: number[] = [];
  let cursor = from;
  for (let i = 0; i < count; i++) {
    const next = nextOccurrence(schedule, cursor);
    if (next === null) break;
    out.push(next);
    cursor = next + 60_000; // step past this one; minute resolution makes a minute enough
  }
  return out;
}
