/**
 * Drive a whole night through the state machine in milliseconds.
 *
 * §15 calls this the highest-value testing investment in the project, and the reasoning is that no
 * CI runner can tap an NFC tag, walk away from a beacon or cross a geofence. The failure paths that
 * matter — a tag scanned too early, Stop pressed nine times, the phone restarted mid-night — would
 * otherwise only ever be exercised by living through them at 03:00.
 *
 * It costs almost nothing precisely because `core/` is a pure reducer: feed it `(state, event, ctx)`
 * and collect what comes back. That is the payoff for the purity rule, made concrete.
 *
 * **It is not a test framework.** It runs a script and returns a trace; asserting on that trace is
 * the caller's job. Keeping it dumb is what lets the same traces back both the unit tests and a dev
 * screen later.
 */
import type { AlarmState, Context, Effect, Event } from '../core/types';
import { reduce } from '../core/wake/reducer';

/**
 * One step of a scripted night: an event, optionally with the world changed first.
 *
 * `at` is minutes since the night began and advances the clock; it never goes backwards. `world`
 * changes apply from that step onward. `note` labels the beat, so a failing trace says which part
 * of the night broke rather than only which line.
 */
export interface Step {
  at: number;
  event: Event;
  world?: Partial<Context>;
  note?: string;
}

export interface Frame {
  at: number;
  note?: string;
  event: Event;
  state: AlarmState;
  effects: Effect[];
}

/** `startedAt` is the wall-clock instant the night begins from. */
export interface NightOptions {
  startedAt: number;
  initial?: AlarmState;
  world?: Partial<Context>;
}

const BASE: Omit<Context, 'now'> = {
  presence: 'unknown',
  proximity: 'unknown',
  bluetoothEnabled: true,
  isCharging: false,
  stepsSinceAlertStart: null,
  stepThreshold: 15,
  registeredUids: [],
};

/**
 * Run a scripted night and return every frame.
 *
 * The world is cumulative: a step that sets `stepsSinceAlertStart` leaves it set for later steps,
 * because that is how a night actually behaves — you do not un-walk.
 */
export function runNight(script: readonly Step[], options: NightOptions): Frame[] {
  let state: AlarmState = options.initial ?? { kind: 'idle' };
  let world: Omit<Context, 'now'> = { ...BASE, ...options.world };
  const frames: Frame[] = [];

  for (const step of script) {
    if (step.world) world = { ...world, ...step.world };
    const ctx: Context = { ...world, now: options.startedAt + step.at * 60_000 };
    const { state: next, effects } = reduce(state, step.event, ctx);
    frames.push({ at: step.at, note: step.note, event: step.event, state: next, effects });
    state = next;
  }

  return frames;
}

/** Every effect the night produced, in order — the usual thing to assert against. */
export const effectsOf = (frames: readonly Frame[]): Effect[] => frames.flatMap((f) => f.effects);

/** The state the night ended in. */
export const finalState = (frames: readonly Frame[]): AlarmState =>
  frames[frames.length - 1]!.state;

/**
 * A compact, diffable rendering of a night — the golden-trace format.
 *
 * Asserted as a whole string rather than field by field, so a change anywhere in the sequence shows
 * up as a diff of the night rather than as one failed expectation with no context around it.
 */
export function renderTrace(frames: readonly Frame[]): string {
  return frames
    .map((f) => {
      const effects = f.effects.map((e) => e.kind).join(', ') || '—';
      const label = f.note ? ` (${f.note})` : '';
      return `${String(f.at).padStart(4)}m  ${f.event.kind.padEnd(16)} → ${f.state.kind.padEnd(10)} [${effects}]${label}`;
    })
    .join('\n');
}
