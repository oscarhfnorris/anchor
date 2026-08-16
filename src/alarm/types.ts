/**
 * The platform seam.
 *
 * The only interface behind which alarm-scheduling platform code hides. iOS resolves to
 * `engine.ios.ts` and Android to `engine.android.ts` via React Native's extension resolution — no DI
 * framework. Nothing else may import AlarmKit, and no `Platform.OS` check belongs outside this
 * folder.
 *
 * **Shaped against the real bridge, not an imagined one.** `expo-alarm-kit`'s surface was read
 * before this was written, because coding to a remembered API would bake an unchecked assumption
 * into the architecture. The shapes here mirror what a bridge can actually provide:
 *
 * - `listScheduled` returns **ids only**. The bridge's `getAllAlarms()` cannot report the instant
 *   each alarm is set for, so reconciliation compares which alarms exist and never when they fire.
 *   That is sufficient because an edit invalidates its future occurrences and creates new rows with
 *   new ids (§12) — a moved time is a different id, not the same id at a new instant.
 * - `configure` exists because the bridge needs an App Group identifier before anything else works,
 *   and getting it wrong fails at runtime rather than at build.
 * - `consumeLaunchPayload` is how the app learns it was launched by an alarm being dismissed. That
 *   is the whole re-arm mechanism (D2): the OS launches us, JS runs, and we decide whether the
 *   alarm was satisfied. If it proves slow or unreliable, the fallback is a native intent — which is
 *   what build step 5's spike is for.
 */

export type AuthorisationState = 'granted' | 'denied' | 'notDetermined';

/** What the OS hands back when an alarm launched the app. */
export interface LaunchPayload {
  alarmId: string;
  payload: string | null;
}

export interface AlarmEngine {
  /** Must succeed before anything else. Returns false when the App Group is not reachable. */
  configure(): Promise<boolean>;

  /**
   * Schedule a one-shot alarm at an instant, under an id we choose.
   *
   * Re-scheduling a known id must overwrite rather than duplicate — that is what keeps reconcile
   * idempotent.
   */
  schedule(id: string, at: number): Promise<void>;

  cancel(id: string): Promise<void>;

  /**
   * The ids the OS is currently holding. Reconciliation's whole premise (§12).
   *
   * Ids, not instants: see the note above. A bridge that cannot enumerate at all should throw
   * `UnsupportedError`, which tells reconcile to fall back to re-issuing the desired set blind.
   */
  listScheduled(): Promise<string[]>;

  authorisation(): Promise<AuthorisationState>;
  requestAuthorisation(): Promise<AuthorisationState>;

  /**
   * The payload if an alarm launched this app, cleared once read.
   *
   * Reading it must be destructive, or a cold launch would re-process the same dismissal every time
   * the app foregrounds and re-arm would fire repeatedly.
   */
  consumeLaunchPayload(): Promise<LaunchPayload | null>;
}

/** Thrown where a platform bridge cannot support a capability at all. */
export class UnsupportedError extends Error {
  constructor(what: string) {
    super(`${what} is not supported by this platform bridge`);
    this.name = 'UnsupportedError';
  }
}

/**
 * The bridge numbers weekdays 1–7; `Date#getDay` and `core/schedule.ts` use 0–6.
 *
 * Converting at the seam rather than anywhere else keeps `core/` in one convention. An off-by-one
 * here would fire every alarm a day late, which is silent and would read as "the alarm didn't go
 * off" rather than as a bug.
 */
export const toBridgeWeekday = (weekday: number): number => weekday + 1;
export const fromBridgeWeekday = (weekday: number): number => weekday - 1;
