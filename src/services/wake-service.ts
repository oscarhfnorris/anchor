/**
 * The wake alarm's use cases — where the reducer, the database and the platform meet.
 *
 * **The state is rebuilt from storage on every call, never held in memory.** iOS launches the app
 * fresh when an alarm is dismissed, so a Stop press usually arrives in a new process. Anything kept
 * in a variable between events is lost: `rearmCount` would reset, so the delay would never shorten
 * (D18), and `firstRangAt` would reset, so the step gate would restart and stalling would earn a
 * fresh allowance on every press (D35). Both failures are silent, and both reward exactly what the
 * app exists to prevent.
 *
 * So `alerting` is derived: the unresolved occurrence that has fired is the alarm that is ringing,
 * `firstRangAt` is its `fired_at`, and `rearmCount` is how many Stop presses are recorded against
 * it. Nothing to keep in step by hand.
 *
 * This module performs effects; it never decides. Every branch on a rule belongs in `core/`.
 */
import type { AlarmEngine } from '../alarm/types';
import type { NfcReader } from '../nfc/types';
import { occurrenceAlarmId, type OccurrenceRow } from '../core/occurrences';
import type { AlarmState, Context, Effect, Event } from '../core/types';
import { reduce } from '../core/wake/reducer';
import { readAlarms } from '../db/repositories/alarms';
import {
  appendEvent,
  countEvents,
  readOccurrences,
  recordCleared,
  recordFired,
} from '../db/repositories/occurrences';
import { readRegistry } from '../db/repositories/tags';
import { readSettings } from '../db/repositories/settings';
import type { AnySqliteDb } from '../db/types';

export interface WakeDeps {
  db: AnySqliteDb;
  engine: AlarmEngine;
  /** Steps taken since an instant. Null when the pedometer is unavailable or unauthorised (D35). */
  stepsSince: (from: number) => Promise<number | null>;
  /** Reads a tag's hardware UID. Only the UID — never the payload (D1). */
  reader: NfcReader;
}

/** The occurrence id encoded in an engine alarm id, or undefined if it is not one of ours. */
export function occurrenceIdFrom(alarmId: string): number | undefined {
  const match = /^occurrence:(\d+)$/.exec(alarmId);
  return match ? Number(match[1]) : undefined;
}

/**
 * Which occurrence the OS just rang, taken from the launch payload.
 *
 * Authoritative, where inferring from "the latest due" is a guess. iOS hands back the id of the
 * alarm that launched the app, and that id is ours — so use it when it is there and fall back only
 * when the app was opened some other way.
 */
export async function firedOccurrenceId(engine: AlarmEngine): Promise<number | undefined> {
  const payload = await engine.consumeLaunchPayload();
  return payload ? occurrenceIdFrom(payload.alarmId) : undefined;
}

/** The occurrence currently ringing, if any: fired, not yet resolved. */
async function alertingOccurrence(
  db: AnySqliteDb,
  alarmId: number,
): Promise<OccurrenceRow | undefined> {
  const rows = await readOccurrences(db, alarmId);
  return rows.find((o) => o.firedAt !== null && o.clearedAt === null);
}

/** Rebuild the reducer's state from what is stored. Never from memory — see the note above. */
export async function currentState(db: AnySqliteDb, alarmId: number): Promise<AlarmState> {
  const alerting = await alertingOccurrence(db, alarmId);
  if (!alerting) return { kind: 'idle' };
  return {
    kind: 'alerting',
    firstRangAt: alerting.firedAt!,
    rearmCount: await countEvents(db, alerting.id, 'stopPressed'),
  };
}

async function buildContext(deps: WakeDeps, state: AlarmState, now: number): Promise<Context> {
  const settings = await readSettings(deps.db);
  return {
    now,
    presence: 'unknown',
    proximity: 'unknown',
    bluetoothEnabled: true,
    isCharging: false,
    // Measured from the first ring, which lives in state — so the caller asks, and the reducer is
    // handed the answer rather than reaching for it.
    stepsSinceAlertStart:
      state.kind === 'alerting' ? await deps.stepsSince(state.firstRangAt) : null,
    stepThreshold: settings?.stepThreshold ?? 15,
    registeredUids: await readRegistry(deps.db),
  };
}

/** Carry out what the reducer asked for. Ordering follows §12: intent is written before the OS. */
async function perform(
  deps: WakeDeps,
  event: Event,
  effects: readonly Effect[],
  occurrence: OccurrenceRow | undefined,
  now: number,
): Promise<void> {
  // The log records what *happened*, taken from the event itself. Inferring it from an effect would
  // mean a future rule that reschedules for some other reason silently logs a Stop press — and
  // rearmCount is derived by counting those, so the delay would shorten for the wrong reason.
  if (occurrence && event.kind === 'stopPressed') {
    await appendEvent(deps.db, occurrence.id, 'stopPressed', now);
  }

  for (const effect of effects) {
    switch (effect.kind) {
      case 'recordOccurrence':
        if (!occurrence) break;
        if (effect.firedAt !== undefined) {
          await recordFired(deps.db, occurrence.id, effect.firedAt);
          await appendEvent(deps.db, occurrence.id, 'fired', effect.firedAt);
        }
        if (effect.clearedAt !== undefined) {
          await recordCleared(deps.db, occurrence.id, effect.clearedAt, 'cleared');
        }
        break;

      case 'scheduleAlarm':
        // No occurrence means nothing to re-arm against; scheduling under a made-up id would leave
        // an alarm the app can never find or cancel.
        if (occurrence) await deps.engine.schedule(occurrenceAlarmId(occurrence.id), effect.at);
        break;

      case 'cancelAlarm':
        if (occurrence) await deps.engine.cancel(occurrenceAlarmId(occurrence.id));
        break;

      case 'rejectScan':
        if (occurrence) await appendEvent(deps.db, occurrence.id, 'scanRejected', now);
        break;

      // Nothing to persist: the caller renders these.
      case 'acceptScan':
      case 'notify':
        break;

      // Dock-only, and unreachable from the wake reducer. Listed so a new effect cannot be added
      // without this switch failing to compile.
      case 'startGrace':
      case 'openSession':
      case 'closeSession':
        break;
    }
  }
}

export interface WakeOutcome {
  state: AlarmState;
  effects: Effect[];
}

/**
 * Apply one event to the wake alarm.
 *
 * Reads state from storage, asks `core/` what should happen, performs it, and returns both so the
 * caller can render the result. Safe to call from a cold launch, which is the normal case.
 */
export async function dispatch(
  deps: WakeDeps,
  event: Event,
  now: number,
  /** The occurrence the OS says rang, when the app was launched by an alarm. */
  firedId?: number,
): Promise<WakeOutcome> {
  const alarm = (await readAlarms(deps.db)).find((a) => a.kind === 'wake');
  if (!alarm) return { state: { kind: 'idle' }, effects: [] };

  const state = await currentState(deps.db, alarm.id);
  const ctx = await buildContext(deps, state, now);

  // The occurrence being rung is the **latest** due one, not the earliest. Picking the earliest
  // would mark a night the phone was off as having fired — erasing a genuine miss (D25) and
  // recording today's ring against the wrong morning.
  const all = await readOccurrences(deps.db, alarm.id);
  const occurrence =
    (firedId !== undefined ? all.find((o) => o.id === firedId) : undefined) ??
    (await alertingOccurrence(deps.db, alarm.id)) ??
    all
      .filter((o) => o.firedAt === null && o.clearedAt === null && o.dueAt <= now)
      .sort((a, b) => b.dueAt - a.dueAt)[0];

  const { state: next, effects } = reduce(state, event, ctx);
  await perform(deps, event, effects, occurrence, now);
  return { state: next, effects };
}

/**
 * Read a tag and let it try to clear the alarm.
 *
 * The whole Phase 1 gesture, in one place. A failed read becomes a rejected scan rather than an
 * exception, because an exception on this path is one refactor away from being swallowed into a
 * successful dismissal — the one outcome that must never happen (D1).
 */
export async function scanToClear(deps: WakeDeps, now: number): Promise<WakeOutcome> {
  const result = await deps.reader.scan();
  if (!result.ok) {
    const state = await currentState(deps.db, (await readAlarms(deps.db))[0]?.id ?? 0);
    return { state, effects: [{ kind: 'rejectScan', reason: 'unknownTag' }] };
  }
  return dispatch(deps, { kind: 'tagScanned', uid: result.uid }, now);
}
