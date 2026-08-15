/**
 * The `core/` vocabulary — the shared shape every behaviour rule is expressed in.
 *
 * `core/` is pure TypeScript and imports nothing from `expo-*`, `react-native` or `react`. That is
 * not a style preference: it is the testability strategy (§15) and the only part of the app an
 * Android port would reuse rather than rewrite. An ESLint zone rule enforces it as a hard error.
 *
 * The reducer never acts. It is handed everything it needs in `Context` and returns a description
 * of what should happen; something outside `core/` performs it. That inversion is why nothing here
 * needs mocking, why a scenario can be asserted as a complete trace, and why the night simulator
 * costs almost nothing.
 *
 * Phase 0 defines the vocabulary only. The reducers arrive in build step 3.
 */

/** Which feature a rule belongs to. The two are siblings, never a pipeline (D10). */
export type Feature = 'dock' | 'wake';

/** A tag's role. Global to the tag and never per-place (D22). */
export type TagRole = 'dock' | 'morning';

/**
 * Why an alarm stopped without being satisfied. Recorded rather than inferred, because the whole
 * point of the occurrence log is that a night which went wrong can be explained afterwards (D25).
 */
export type StandDownReason =
  | 'confirmedExit'
  | 'escapeHatch'
  | 'gaveUp'
  | 'supersededByWakeClear';

/** Why a scan was refused. Always surfaced to the user — see the note on `rejectScan` below. */
export type ScanRejection =
  | 'wrongRole'
  | 'unknownTag'
  | 'notEnoughSteps'
  | 'nothingAlerting';

/**
 * Alarm lifecycle. `docked` and `gracing` are dock-only; the wake reducer never enters them.
 */
export type AlarmState =
  | { kind: 'idle' }
  | { kind: 'armed'; dueAt: number }
  | { kind: 'alerting'; firstRangAt: number; rearmCount: number }
  | { kind: 'cleared'; at: number }
  | { kind: 'stoodDown'; at: number; reason: StandDownReason }
  | { kind: 'docked'; sessionStartedAt: number; sessionEndsAt: number }
  | { kind: 'gracing'; startedAt: number; soundsAt: number };

/** Corroborated presence. `unknown` is never treated as `away` (D4). */
export type Presence = 'inside' | 'away' | 'unknown';

/** Beacon proximity. Uncertainty here biases to silence, unlike everywhere else (§6). */
export type Proximity = 'near' | 'far' | 'unknown';

export type Event =
  | { kind: 'tick' }
  | { kind: 'alarmFired' }
  | { kind: 'stopPressed' }
  | { kind: 'tagScanned'; uid: string }
  | { kind: 'presenceChanged'; presence: Presence; corroborated: boolean }
  | { kind: 'proximityChanged'; proximity: Proximity }
  | { kind: 'bluetoothChanged'; enabled: boolean }
  | { kind: 'escapeHatchUsed' };

export type Effect =
  | { kind: 'scheduleAlarm'; at: number }
  | { kind: 'cancelAlarm' }
  | { kind: 'startGrace'; soundsAt: number }
  | { kind: 'acceptScan' }
  | { kind: 'rejectScan'; reason: ScanRejection; stepsShort?: number }
  | { kind: 'openSession'; endsAt: number }
  | { kind: 'closeSession'; reason: StandDownReason | 'durationElapsed' | 'wakeCleared' }
  | { kind: 'recordOccurrence'; firedAt?: number; clearedAt?: number }
  | { kind: 'notify'; message: string };

/**
 * Everything the reducer is allowed to know. No ambient clock, no I/O, no imports — a trace is
 * reproducible precisely because every input arrives here.
 *
 * `stepsSinceAlertStart` is the one field with a subtlety: the count is relative to when the alarm
 * first rang, which lives in state, so the caller reads `alertingSince`, queries the pedometer for
 * that window, and passes the answer in. The reducer never asks a question.
 */
export interface Context {
  now: number;
  presence: Presence;
  proximity: Proximity;
  bluetoothEnabled: boolean;
  isCharging: boolean;
  stepsSinceAlertStart: number | null;
  stepThreshold: number;
  registeredUids: readonly { uid: string; role: TagRole; portable: boolean }[];
}

export interface Transition {
  state: AlarmState;
  effects: Effect[];
}

/** The one shape every rule in `core/` takes. Pure, synchronous, total. */
export type Reducer = (state: AlarmState, event: Event, ctx: Context) => Transition;
