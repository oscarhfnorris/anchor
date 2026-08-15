/**
 * The settings freeze (D7, D21).
 *
 * Settings are frozen within an hour either side of an alarm firing. Without it, bedtime moves an
 * hour later at 22:29 — the decision to stay up gets made by the person who is already staying up,
 * which is the one moment they should not be trusted with it.
 *
 * The freeze covers session duration and grace as well as alarm times (D21): those are equally
 * edit-in-the-moment settings, and shortening a session at 01:00 would end it early — a clean bypass
 * through a setting that is not an "alarm time".
 *
 * It is deliberately **not** a blanket freeze whenever a session is open. Changing anything means
 * walking to the phone, which is what the app wanted anyway.
 */
import { nextOccurrence, type Schedule } from './schedule';

export const FREEZE_WINDOW_MS = 60 * 60 * 1000;

export interface FrozenResult {
  frozen: boolean;
  /** When the freeze lifts, so the UI can say *why* rather than just refusing. */
  until?: number;
}

/**
 * Whether settings are frozen at `now`, given every enabled schedule.
 *
 * Checks the previous occurrence as well as the next, because the hour *after* an alarm is inside
 * the window too — that is when a half-awake user would otherwise turn tomorrow's alarm off.
 */
export function isFrozen(schedules: readonly Schedule[], now: number): FrozenResult {
  for (const schedule of schedules) {
    const next = nextOccurrence(schedule, now);
    if (next !== null && next - now <= FREEZE_WINDOW_MS) {
      return { frozen: true, until: next + FREEZE_WINDOW_MS };
    }
    const previous = nextOccurrence(schedule, now - 2 * FREEZE_WINDOW_MS);
    if (previous !== null && previous <= now && now - previous <= FREEZE_WINDOW_MS) {
      return { frozen: true, until: previous + FREEZE_WINDOW_MS };
    }
  }
  return { frozen: false };
}
