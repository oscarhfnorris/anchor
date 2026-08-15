/**
 * The wake alarm (Feature B).
 *
 * Fires at its scheduled time wherever the phone is, and is cleared only by scanning a morning tag
 * — which lives outside the bedroom, because the alarm's job is to get you out of it.
 *
 * **It never gives up** (D5). An alarm you can outlast is an alarm you learn to outlast, so pressing
 * Stop re-arms rather than dismissing, and the delay shortens each time (D18) so stalling gets
 * progressively worse rather than staying comfortable. The floor stops it becoming unsatisfiable:
 * below roughly ten seconds you cannot cross a room before it fires again.
 *
 * The only ways out are the tag and the escape hatch (D20). Phase 2 adds a third — a confirmed exit
 * from the active place — which is why `stoodDown` already carries a reason.
 *
 * Pure and total: every input arrives in `Context`, and the return value describes what should
 * happen rather than doing it.
 */
import { matchesRole, findTag, type RegisteredTag } from '../tags';
import type { AlarmState, Context, Effect, Event, Transition } from '../types';

/** Re-arm delays in order, shortening then holding at the floor (D18). */
export const REARM_DELAYS_SECONDS = [20, 15, 10] as const;

/** The delay before the nth re-arm. Holds at the floor rather than shrinking to nothing. */
export function rearmDelaySeconds(rearmCount: number): number {
  const index = Math.min(rearmCount, REARM_DELAYS_SECONDS.length - 1);
  return REARM_DELAYS_SECONDS[index];
}

const stay = (state: AlarmState, ...effects: Effect[]): Transition => ({ state, effects });

/**
 * Whether the step gate is satisfied (D35).
 *
 * `null` steps means the pedometer is unavailable or unauthorised. The gate is then **skipped**
 * rather than failed — refusing the right tag because a permission is missing would leave an alarm
 * nothing can clear — but it emits a notice, because §11 requires that it never silently accepts a
 * scan it should have refused.
 */
function stepGate(ctx: Context): { satisfied: boolean; short?: number; unverified?: boolean } {
  if (ctx.stepsSinceAlertStart === null) return { satisfied: true, unverified: true };
  const short = ctx.stepThreshold - ctx.stepsSinceAlertStart;
  return short > 0 ? { satisfied: false, short } : { satisfied: true };
}

function handleScan(state: AlarmState, uid: string, ctx: Context): Transition {
  if (state.kind !== 'alerting') {
    return stay(state, { kind: 'rejectScan', reason: 'nothingAlerting' });
  }

  const registered: readonly RegisteredTag[] = ctx.registeredUids;
  if (!matchesRole(uid, 'morning', registered)) {
    // Distinguish "that is the dock tag" from "I have never seen this tag" so the user, standing
    // there half asleep holding a physical object, is told which mistake they made.
    const known = findTag(uid, registered);
    return stay(state, {
      kind: 'rejectScan',
      reason: known ? 'wrongRole' : 'unknownTag',
    });
  }

  const gate = stepGate(ctx);
  if (!gate.satisfied) {
    return stay(state, { kind: 'rejectScan', reason: 'notEnoughSteps', stepsShort: gate.short });
  }

  const effects: Effect[] = [
    { kind: 'cancelAlarm' },
    { kind: 'acceptScan' },
    { kind: 'recordOccurrence', clearedAt: ctx.now },
  ];
  if (gate.unverified) {
    effects.push({
      kind: 'notify',
      message: 'Step count unavailable, so the walk could not be verified.',
    });
  }
  return { state: { kind: 'cleared', at: ctx.now }, effects };
}

/**
 * The wake alarm's transition function.
 *
 * Unknown or inapplicable events return the state unchanged with no effects rather than throwing —
 * a reducer that can crash on an unexpected event is a reducer that can leave an alarm ringing with
 * no way to stop it.
 */
export function reduce(state: AlarmState, event: Event, ctx: Context): Transition {
  switch (event.kind) {
    case 'alarmFired':
      // Re-entering `alerting` on a repeat fire would reset `firstRangAt`, which the step count is
      // measured from — stalling would then earn a fresh allowance every re-arm.
      if (state.kind === 'alerting') return stay(state);
      return {
        state: { kind: 'alerting', firstRangAt: ctx.now, rearmCount: 0 },
        effects: [{ kind: 'recordOccurrence', firedAt: ctx.now }],
      };

    case 'stopPressed': {
      if (state.kind !== 'alerting') return stay(state);
      const delay = rearmDelaySeconds(state.rearmCount);
      return {
        // firstRangAt is deliberately preserved: the step gate measures from the first ring, so
        // pressing Stop repeatedly cannot reset the walk you still owe.
        state: { ...state, rearmCount: state.rearmCount + 1 },
        effects: [{ kind: 'scheduleAlarm', at: ctx.now + delay * 1000 }],
      };
    }

    case 'tagScanned':
      return handleScan(state, event.uid, ctx);

    case 'escapeHatchUsed':
      // Always available and never refused (D20). An app that can trap its user is worse than one
      // that can be cheated, and a hard cap would reinstate exactly the trap it exists to remove.
      if (state.kind === 'cleared' || state.kind === 'idle') return stay(state);
      return {
        state: { kind: 'stoodDown', at: ctx.now, reason: 'escapeHatch' },
        effects: [{ kind: 'cancelAlarm' }, { kind: 'recordOccurrence', clearedAt: ctx.now }],
      };

    // Phase 1 has no location or Bluetooth. These arrive with Phase 2 and Phase 4; ignoring them
    // now keeps the wake reducer honest about what it actually knows.
    case 'presenceChanged':
    case 'proximityChanged':
    case 'bluetoothChanged':
    case 'tick':
      return stay(state);
  }
}
