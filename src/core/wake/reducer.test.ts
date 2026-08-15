/**
 * The wake alarm's behaviour rules (D2, D5, D18, D20, D25, D31, D35).
 *
 * Each test names the decision it covers, because §5's decision table is the checklist (D37) and a
 * rule without a test here is unfinished rather than merely untested.
 *
 * Assertions cover the emitted effects as well as the next state. Asserting state alone passes
 * happily while the alarm silently never gets rescheduled — which is the failure that matters.
 */
import { describe, expect, it } from 'vitest';

import type { AlarmState, Context } from '../types';
import { reduce, rearmDelaySeconds, REARM_DELAYS_SECONDS } from './reducer';

const MORNING = { uid: '04a2b3c4', role: 'morning' as const, portable: true };
const DOCK = { uid: 'deadbeef', role: 'dock' as const, portable: false };

function context(overrides: Partial<Context> = {}): Context {
  return {
    now: 1_000_000,
    presence: 'unknown',
    proximity: 'unknown',
    bluetoothEnabled: true,
    isCharging: false,
    stepsSinceAlertStart: 100,
    stepThreshold: 15,
    registeredUids: [MORNING, DOCK],
    ...overrides,
  };
}

const alerting = (over: Partial<Extract<AlarmState, { kind: 'alerting' }>> = {}): AlarmState => ({
  kind: 'alerting',
  firstRangAt: 1_000_000,
  rearmCount: 0,
  ...over,
});

describe('firing', () => {
  it('records that it actually fired (D25)', () => {
    const next = reduce({ kind: 'armed', dueAt: 0 }, { kind: 'alarmFired' }, context());
    expect(next.state.kind).toBe('alerting');
    expect(next.effects).toContainEqual({ kind: 'recordOccurrence', firedAt: 1_000_000 });
  });

  it('does not reset firstRangAt when it fires again while already alerting', () => {
    const state = alerting({ firstRangAt: 500 });
    const next = reduce(state, { kind: 'alarmFired' }, context());
    expect(next.state).toEqual(state);
    expect(next.effects).toEqual([]);
  });
});

describe('re-arm on Stop (D2, D5, D18)', () => {
  it('reschedules rather than dismissing', () => {
    const next = reduce(alerting(), { kind: 'stopPressed' }, context());
    expect(next.state.kind).toBe('alerting');
    expect(next.effects).toEqual([{ kind: 'scheduleAlarm', at: 1_000_000 + 20_000 }]);
  });

  it('shortens the delay with each cycle, then holds at the floor (D18)', () => {
    expect(REARM_DELAYS_SECONDS).toEqual([20, 15, 10]);
    expect(rearmDelaySeconds(0)).toBe(20);
    expect(rearmDelaySeconds(1)).toBe(15);
    expect(rearmDelaySeconds(2)).toBe(10);
    expect(rearmDelaySeconds(9)).toBe(10);
  });

  it('never falls below the floor, so crossing a room stays possible (D18)', () => {
    for (let n = 0; n < 50; n++) expect(rearmDelaySeconds(n)).toBeGreaterThanOrEqual(10);
  });

  it('preserves firstRangAt across re-arms so stalling earns no fresh step allowance (D35)', () => {
    let state: AlarmState = alerting({ firstRangAt: 42 });
    for (let i = 0; i < 3; i++) state = reduce(state, { kind: 'stopPressed' }, context()).state;
    expect(state).toMatchObject({ kind: 'alerting', firstRangAt: 42, rearmCount: 3 });
  });

  it('never gives up on its own (D5)', () => {
    let state: AlarmState = alerting();
    for (let i = 0; i < 200; i++) state = reduce(state, { kind: 'stopPressed' }, context()).state;
    expect(state.kind).toBe('alerting');
  });
});

describe('clearing by tag (D31, D22)', () => {
  it('accepts any registered morning tag', () => {
    const next = reduce(alerting(), { kind: 'tagScanned', uid: MORNING.uid }, context());
    expect(next.state.kind).toBe('cleared');
    expect(next.effects).toContainEqual({ kind: 'cancelAlarm' });
    expect(next.effects).toContainEqual({ kind: 'acceptScan' });
  });

  it('rejects the dock tag as wrongRole, not unknownTag', () => {
    const next = reduce(alerting(), { kind: 'tagScanned', uid: DOCK.uid }, context());
    expect(next.state.kind).toBe('alerting');
    expect(next.effects).toEqual([{ kind: 'rejectScan', reason: 'wrongRole' }]);
  });

  it('rejects a tag it has never seen as unknownTag', () => {
    const next = reduce(alerting(), { kind: 'tagScanned', uid: '00000000' }, context());
    expect(next.effects).toEqual([{ kind: 'rejectScan', reason: 'unknownTag' }]);
  });

  it('never accepts an empty or unreadable UID', () => {
    for (const uid of ['', 'garbled', '  ']) {
      const next = reduce(alerting(), { kind: 'tagScanned', uid }, context());
      expect(next.state.kind).toBe('alerting');
    }
  });

  it('rejects a scan when nothing is alerting', () => {
    const next = reduce({ kind: 'idle' }, { kind: 'tagScanned', uid: MORNING.uid }, context());
    expect(next.effects).toEqual([{ kind: 'rejectScan', reason: 'nothingAlerting' }]);
  });
});

describe('the step gate (D35)', () => {
  it('refuses a correct tag until the walk is done, and says how many steps short', () => {
    const next = reduce(
      alerting(),
      { kind: 'tagScanned', uid: MORNING.uid },
      context({ stepsSinceAlertStart: 4 }),
    );
    expect(next.state.kind).toBe('alerting');
    expect(next.effects).toEqual([
      { kind: 'rejectScan', reason: 'notEnoughSteps', stepsShort: 11 },
    ]);
  });

  it('accepts once the threshold is reached exactly', () => {
    const next = reduce(
      alerting(),
      { kind: 'tagScanned', uid: MORNING.uid },
      context({ stepsSinceAlertStart: 15 }),
    );
    expect(next.state.kind).toBe('cleared');
  });

  it('skips the gate when the pedometer is unavailable, but says so rather than silently accepting', () => {
    const next = reduce(
      alerting(),
      { kind: 'tagScanned', uid: MORNING.uid },
      context({ stepsSinceAlertStart: null }),
    );
    expect(next.state.kind).toBe('cleared');
    expect(next.effects).toContainEqual(
      expect.objectContaining({ kind: 'notify' }),
    );
  });
});

describe('the escape hatch (D20)', () => {
  it('cancels a ringing alarm outright', () => {
    const next = reduce(alerting(), { kind: 'escapeHatchUsed' }, context());
    expect(next.state).toMatchObject({ kind: 'stoodDown', reason: 'escapeHatch' });
    expect(next.effects).toContainEqual({ kind: 'cancelAlarm' });
  });

  it('is never refused, however many times it is used', () => {
    for (let i = 0; i < 20; i++) {
      const next = reduce(alerting({ rearmCount: i }), { kind: 'escapeHatchUsed' }, context());
      expect(next.state.kind).toBe('stoodDown');
    }
  });

  it('records the occurrence so overuse is visible in history', () => {
    const next = reduce(alerting(), { kind: 'escapeHatchUsed' }, context());
    expect(next.effects).toContainEqual({ kind: 'recordOccurrence', clearedAt: 1_000_000 });
  });
});

describe('independence from the dock feature (D10)', () => {
  it('ignores presence, proximity and bluetooth in Phase 1', () => {
    for (const event of [
      { kind: 'presenceChanged', presence: 'away', corroborated: true },
      { kind: 'proximityChanged', proximity: 'far' },
      { kind: 'bluetoothChanged', enabled: false },
      { kind: 'tick' },
    ] as const) {
      const next = reduce(alerting(), event, context());
      expect(next.state.kind).toBe('alerting');
      expect(next.effects).toEqual([]);
    }
  });
});
