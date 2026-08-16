/**
 * The tag registry's rules — which alarms may be enabled, and what a deletion breaks.
 *
 * This is policy, not persistence, so it lives in `core/`: it decides whether an alarm may be on,
 * which is a rule about when an alarm can fire and clear. `db/` reads the rows and writes the
 * result; it does not get to decide.
 *
 * Pure functions over plain data — the caller passes the tags it read, and gets back a verdict.
 */
import type { RegisteredTag } from './tags';
import type { TagRole } from './types';

/** Which feature an alarm belongs to. */
export type AlarmKind = 'dock' | 'wake';

/**
 * Which tag role clears which alarm.
 *
 * The dock alarm is cleared by the dock tag and the wake alarm by a morning tag, never the other
 * way round — if Tag A also cleared the morning alarm you would tap it while already standing at
 * the dock and go back to bed, which is the whole reason there are two (§2).
 */
export const CLEARING_ROLE: Record<AlarmKind, TagRole> = { dock: 'dock', wake: 'morning' };

export type EnableVerdict = { ok: true } | { ok: false; reason: 'noClearingTag' };

/** Whether any registered tag could clear this alarm. */
export function hasClearingTag(kind: AlarmKind, tags: readonly RegisteredTag[]): boolean {
  return tags.some((t) => t.role === CLEARING_ROLE[kind]);
}

/**
 * Whether an alarm may be enabled (D27).
 *
 * Refusing here is the point: enabling with nothing to clear it ends the first night with an alarm
 * that only the escape hatch can stop, which teaches the user to reach for the escape hatch.
 */
export function canEnable(kind: AlarmKind, tags: readonly RegisteredTag[]): EnableVerdict {
  return hasClearingTag(kind, tags) ? { ok: true } : { ok: false, reason: 'noClearingTag' };
}

/**
 * Which currently-enabled alarms must be switched off once `uid` is removed (D27).
 *
 * The deletion half matters as much as the creation check: the invariant is "an enabled alarm always
 * has a way to be cleared", not "we looked once when it was created". Returning the list lets the
 * caller tell the user *which* alarm switched off and why — an alarm that silently stops being
 * enabled is the same silent failure D25 exists to prevent, arriving through the settings screen.
 */
export function alarmsLeftUnclearable(
  removedUid: string,
  tags: readonly RegisteredTag[],
  enabled: readonly AlarmKind[],
): AlarmKind[] {
  const remaining = tags.filter((t) => t.uid !== removedUid);
  return enabled.filter((kind) => !hasClearingTag(kind, remaining));
}
