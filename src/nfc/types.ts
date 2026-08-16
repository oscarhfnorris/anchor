/**
 * The NFC seam.
 *
 * Reading a tag is the one input the whole premise rests on, so it hides behind an interface for the
 * same reason the alarm engine does: `core/` must stay pure, and the flow must be exercisable
 * without a reader.
 *
 * **This one is not split by platform.** `react-native-nfc-manager` covers iOS and Android, so there
 * is no `.ios.ts` here — the library is already the abstraction. `alarm/` is split because AlarmKit
 * is iOS-only and nothing hides it.
 *
 * Shaped against the library's real surface rather than an imagined one: `start()`, then
 * `requestTechnology()`, then `getTag()` returning a tag whose `id` is the hardware UID, then
 * `cancelTechnologyRequest()`. We want only `id` — never the NDEF payload (D1), which is the whole
 * point of using the UID.
 */

/** Why a read did not produce a UID. Each maps to something a user can act on. */
export type ScanFailure =
  | 'unavailable' // no NFC hardware, or it is switched off
  | 'unauthorised' // permission refused
  | 'cancelled' // the user dismissed the system sheet
  | 'unreadable'; // a tag was present but yielded no usable UID

export type ScanResult =
  | { ok: true; uid: string }
  | { ok: false; reason: ScanFailure };

export interface NfcReader {
  /** Whether this device can read tags at all. False on a simulator, which has no radio. */
  isAvailable(): Promise<boolean>;

  /**
   * Wait for a tag and return its hardware UID.
   *
   * Returns a result rather than throwing, because every failure here is an ordinary state the UI
   * must render — and an exception on the scan path is one refactor away from being swallowed into
   * a successful dismissal, which is the one outcome that must never happen (D1).
   */
  scan(): Promise<ScanResult>;

  /** Abandon an in-flight scan. Safe to call when none is running. */
  cancel(): Promise<void>;
}
