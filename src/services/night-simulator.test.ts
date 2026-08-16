/**
 * Golden traces — whole nights, asserted as complete sequences.
 *
 * §15 names the scenarios that matter and requires each be asserted as a *complete* trace of states
 * and effects rather than a handful of spot checks. The difference is the point: a spot assertion
 * passes while the alarm silently stops being rescheduled somewhere else in the night.
 *
 * **A trace written now must still pass unchanged after Phase 4.** That is D36 expressed as a test:
 * if adding places or sessions alters what the wake alarm does on an ordinary night, the layering
 * leaked, and this file says so immediately. Re-recording a trace is how that protection quietly
 * disappears, so it needs a stated reason every time.
 *
 * Tags are pinned as portable explicitly, because in Phase 1 every tag is portable and the step gate
 * is universal — a trace that left it implicit would break when Phase 2 makes tags fixable.
 */
import { describe, expect, it } from 'vitest';

import type { Step } from './night-simulator';
import { effectsOf, finalState, renderTrace, runNight } from './night-simulator';

const MORNING = { uid: '04a2b3c4', role: 'morning' as const, portable: true };
const DOCK = { uid: 'deadbeef', role: 'dock' as const, portable: true };
const STARTED_AT = new Date('2026-03-09T07:00:00').getTime();

const night = (script: Step[], world = {}) =>
  runNight(script, {
    startedAt: STARTED_AT,
    initial: { kind: 'armed', dueAt: STARTED_AT },
    world: { registeredUids: [MORNING, DOCK], ...world },
  });

describe('a good morning', () => {
  it('rings, you walk to the tag, it clears', () => {
    const frames = night([
      { at: 0, event: { kind: 'alarmFired' }, note: 'wakes you' },
      { at: 1, event: { kind: 'stopPressed' }, note: 'you press Stop from bed' },
      { at: 2, event: { kind: 'tagScanned', uid: MORNING.uid }, world: { stepsSinceAlertStart: 3 }, note: 'reaching from bed' },
      { at: 4, event: { kind: 'tagScanned', uid: MORNING.uid }, world: { stepsSinceAlertStart: 22 }, note: 'after actually walking' },
    ]);

    expect(renderTrace(frames)).toBe(
      [
        '   0m  alarmFired       → alerting   [recordOccurrence] (wakes you)',
        '   1m  stopPressed      → alerting   [scheduleAlarm] (you press Stop from bed)',
        '   2m  tagScanned       → alerting   [rejectScan] (reaching from bed)',
        '   4m  tagScanned       → cleared    [cancelAlarm, acceptScan, recordOccurrence] (after actually walking)',
      ].join('\n'),
    );
  });
});

describe('the tag is lost', () => {
  it('never gives up, and only the escape hatch ends it', () => {
    const script: Step[] = [{ at: 0, event: { kind: 'alarmFired' } }];
    for (let i = 1; i <= 12; i++) script.push({ at: i, event: { kind: 'stopPressed' } });
    script.push({ at: 13, event: { kind: 'escapeHatchUsed' }, note: 'the tag is gone' });

    const frames = night(script);

    // Twelve Stop presses, twelve reschedules — it never stands down on its own (D5).
    expect(effectsOf(frames).filter((e) => e.kind === 'scheduleAlarm')).toHaveLength(12);
    expect(finalState(frames)).toMatchObject({ kind: 'stoodDown', reason: 'escapeHatch' });
  });

  it('shortens the delay each time, then holds at the floor (D18)', () => {
    const script: Step[] = [{ at: 0, event: { kind: 'alarmFired' } }];
    for (let i = 1; i <= 5; i++) script.push({ at: i, event: { kind: 'stopPressed' } });

    const gaps = effectsOf(night(script))
      .filter((e): e is Extract<typeof e, { kind: 'scheduleAlarm' }> => e.kind === 'scheduleAlarm')
      .map((e, i) => (e.at - (STARTED_AT + (i + 1) * 60_000)) / 1000);

    expect(gaps).toEqual([20, 15, 10, 10, 10]);
  });
});

describe('the wrong tag', () => {
  it('tells you which mistake you made, and keeps ringing', () => {
    const frames = night([
      { at: 0, event: { kind: 'alarmFired' } },
      { at: 1, event: { kind: 'tagScanned', uid: DOCK.uid }, world: { stepsSinceAlertStart: 40 }, note: 'the dock tag' },
      { at: 2, event: { kind: 'tagScanned', uid: 'ffffffff' }, note: 'a stranger' },
      { at: 3, event: { kind: 'tagScanned', uid: '' }, note: 'a failed read' },
    ]);

    expect(effectsOf(frames).filter((e) => e.kind === 'rejectScan')).toEqual([
      { kind: 'rejectScan', reason: 'wrongRole' },
      { kind: 'rejectScan', reason: 'unknownTag' },
      { kind: 'rejectScan', reason: 'unknownTag' },
    ]);
    expect(finalState(frames).kind).toBe('alerting');
  });
});

describe('the pedometer is unavailable', () => {
  it('accepts the tag rather than trapping you, and says the walk was unverified', () => {
    const frames = night([
      { at: 0, event: { kind: 'alarmFired' } },
      { at: 1, event: { kind: 'tagScanned', uid: MORNING.uid }, world: { stepsSinceAlertStart: null } },
    ]);

    expect(finalState(frames).kind).toBe('cleared');
    expect(effectsOf(frames).some((e) => e.kind === 'notify')).toBe(true);
  });
});

describe('the phone restarts mid-night', () => {
  it('resumes from the rehydrated alerting state without losing the walk already owed', () => {
    // A cold launch rebuilds `alerting` from stored state; firstRangAt is what survives, and the
    // step gate measures from it. If a restart reset it, restarting would buy a fresh allowance.
    const frames = runNight(
      [
        { at: 6, event: { kind: 'tagScanned', uid: MORNING.uid }, world: { stepsSinceAlertStart: 4 }, note: 'still has not walked' },
        { at: 8, event: { kind: 'tagScanned', uid: MORNING.uid }, world: { stepsSinceAlertStart: 19 } },
      ],
      {
        startedAt: STARTED_AT,
        initial: { kind: 'alerting', firstRangAt: STARTED_AT, rearmCount: 3 },
        world: { registeredUids: [MORNING] },
      },
    );

    expect(effectsOf(frames)[0]).toEqual({
      kind: 'rejectScan',
      reason: 'notEnoughSteps',
      stepsShort: 11,
    });
    expect(finalState(frames).kind).toBe('cleared');
  });
});

describe('nothing is ringing', () => {
  it('refuses a scan rather than pretending it cleared something', () => {
    const frames = runNight([{ at: 0, event: { kind: 'tagScanned', uid: MORNING.uid } }], {
      startedAt: STARTED_AT,
      initial: { kind: 'idle' },
      world: { registeredUids: [MORNING] },
    });

    expect(effectsOf(frames)).toEqual([{ kind: 'rejectScan', reason: 'nothingAlerting' }]);
  });
});
