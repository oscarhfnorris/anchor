/**
 * Tag identity and role matching.
 *
 * Identity is the **hardware UID**, never the NDEF payload (D1). A payload copies onto a spare
 * sticker kept by the bed, which defeats the entire premise of the app; a UID cannot be cloned onto
 * a cheap tag. Comparison is on normalised lowercase hex so that separator and case differences
 * between readers cannot cause a legitimate tag to be refused.
 *
 * A tag has exactly one role, everywhere (D22). Its place records where it is stuck and never
 * affects whether a scan matches — per-place roles would let one tag be dock at home and morning
 * elsewhere, and it would then clear the morning alarm while lying on the dock beside the bed.
 */
import type { TagRole } from './types';

/** A tag as the app knows it. `placeId === null` means portable — it belongs nowhere (D34). */
export interface RegisteredTag {
  uid: string;
  role: TagRole;
  portable: boolean;
}

/**
 * Lowercase hex with separators stripped. Readers differ on `:`/`-`/whitespace and on case, and a
 * mismatch there would refuse the user's own tag at 07:00 with no way to tell why.
 *
 * Anything that is not hex after stripping normalises to the empty string, so a garbled read can
 * never coincidentally equal a stored UID.
 */
export function normaliseUid(raw: string | null | undefined): string {
  if (!raw) return '';
  const stripped = raw.replace(/[\s:-]/g, '').toLowerCase();
  return /^[0-9a-f]+$/.test(stripped) ? stripped : '';
}

/**
 * Whether a scanned UID satisfies the given role.
 *
 * An empty or unreadable UID **never matches** (§11) — a failed read must not become a successful
 * dismissal, which is the difference between "the reader glitched" and "the alarm is off".
 *
 * Any registered tag of that role satisfies it (D31): a morning tag in each kitchen means whichever
 * you reach clears the alarm, and that is what makes multiple homes work with no other machinery.
 */
export function matchesRole(
  scannedUid: string | null | undefined,
  role: TagRole,
  registered: readonly RegisteredTag[],
): boolean {
  const uid = normaliseUid(scannedUid);
  if (!uid) return false;
  return registered.some((t) => t.role === role && normaliseUid(t.uid) === uid);
}

/** The registered tag for a UID, whatever its role — used to tell "wrong role" from "unknown". */
export function findTag(
  scannedUid: string | null | undefined,
  registered: readonly RegisteredTag[],
): RegisteredTag | undefined {
  const uid = normaliseUid(scannedUid);
  if (!uid) return undefined;
  return registered.find((t) => normaliseUid(t.uid) === uid);
}

/**
 * Whether a tag may be registered to `role`, given what is already registered.
 *
 * Rejects a UID already bound to the other role (D22). This is a plausible setup mistake rather than
 * an attack — two identical stickers, one stuck in each place — and it voids the premise silently,
 * so it is refused at registration where the user can still see what they are doing.
 */
export function canRegister(
  uid: string,
  role: TagRole,
  registered: readonly RegisteredTag[],
): { ok: true } | { ok: false; reason: 'invalidUid' | 'alreadyOtherRole' } {
  const normalised = normaliseUid(uid);
  if (!normalised) return { ok: false, reason: 'invalidUid' };
  const existing = findTag(normalised, registered);
  if (existing && existing.role !== role) return { ok: false, reason: 'alreadyOtherRole' };
  return { ok: true };
}
