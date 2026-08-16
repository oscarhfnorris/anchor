/**
 * The fake engine, and reconciliation applied through it.
 *
 * This is where `core/occurrences.ts` and the platform seam meet: `core/` produces a plan, and this
 * proves the plan can actually be carried out against an engine with the same limitations the real
 * bridge has — ids only, no way to ask when the OS thinks an alarm fires.
 *
 * It proves the logic around the engine, never the engine. Whether AlarmKit really fires, and
 * whether launch-on-dismissal is quick enough to re-arm, is what build step 5's spike measures.
 */
import { describe, expect, it } from 'vitest';

import { occurrenceAlarmId, reconcile, reissueAll, type OccurrenceRow } from '../core/occurrences';
import { FakeAlarmEngine } from './engine.fake';
import { UnsupportedError } from './types';

const NOW = 1_700_000_000_000;
const row = (id: number, dueAt: number): OccurrenceRow => ({
  id,
  dueAt,
  firedAt: null,
  clearedAt: null,
});

/** Carry out a plan, the way the app's reconcile step will. */
async function apply(engine: FakeAlarmEngine, plan: { schedule: { id: string; at: number }[]; cancel: string[] }) {
  for (const id of plan.cancel) await engine.cancel(id);
  for (const { id, at } of plan.schedule) await engine.schedule(id, at);
}

describe('reconciliation through the engine', () => {
  it('schedules what intent wants and the OS does not hold', async () => {
    const engine = new FakeAlarmEngine();
    const desired = [row(1, NOW + 60_000)];

    await apply(engine, reconcile(desired, await engine.listScheduled(), NOW));

    expect(engine.peek()).toEqual([{ id: occurrenceAlarmId(1), at: NOW + 60_000 }]);
  });

  it('converges — a second pass asks the OS for nothing', async () => {
    const engine = new FakeAlarmEngine();
    const desired = [row(1, NOW + 60_000)];

    await apply(engine, reconcile(desired, await engine.listScheduled(), NOW));
    const before = engine.calls.length;
    const second = reconcile(desired, await engine.listScheduled(), NOW);

    expect(second).toEqual({ schedule: [], cancel: [] });
    await apply(engine, second);
    // One extra call: the listScheduled we just made. No schedule or cancel followed it.
    expect(engine.calls.length).toBe(before + 1);
  });

  it('cancels an alarm intent has dropped', async () => {
    const engine = new FakeAlarmEngine();
    await engine.schedule(occurrenceAlarmId(99), NOW + 60_000);

    await apply(engine, reconcile([], await engine.listScheduled(), NOW));

    expect(engine.peek()).toEqual([]);
  });

  it('replaces a rescheduled occurrence rather than leaving both', async () => {
    const engine = new FakeAlarmEngine();
    await engine.schedule(occurrenceAlarmId(1), NOW + 60_000);

    // An edit invalidates occurrence 1 and creates 2 at the new time.
    await apply(engine, reconcile([row(2, NOW + 120_000)], await engine.listScheduled(), NOW));

    expect(engine.peek()).toEqual([{ id: occurrenceAlarmId(2), at: NOW + 120_000 }]);
  });

  it('re-scheduling a known id overwrites rather than duplicating', async () => {
    const engine = new FakeAlarmEngine();
    await engine.schedule('a', NOW + 1000);
    await engine.schedule('a', NOW + 2000);
    expect(engine.peek()).toEqual([{ id: 'a', at: NOW + 2000 }]);
  });
});

describe('a bridge that cannot enumerate', () => {
  it('reports UnsupportedError rather than pretending to hold nothing', async () => {
    const engine = new FakeAlarmEngine({ supportsListing: false });
    await expect(engine.listScheduled()).rejects.toThrow(UnsupportedError);
  });

  it('still converges via the blind re-issue fallback', async () => {
    const engine = new FakeAlarmEngine({ supportsListing: false });
    const desired = [row(1, NOW + 60_000)];

    await apply(engine, reissueAll(desired, NOW));
    await apply(engine, reissueAll(desired, NOW));

    // Idempotent because re-scheduling a known id overwrites — the property the fallback rests on.
    expect(engine.peek()).toEqual([{ id: occurrenceAlarmId(1), at: NOW + 60_000 }]);
  });
});

describe('authorisation and launch', () => {
  it('reports a denied state rather than assuming granted', async () => {
    const engine = new FakeAlarmEngine({ authorisation: 'denied' });
    expect(await engine.authorisation()).toBe('denied');
    expect(await engine.requestAuthorisation()).toBe('denied');
  });

  it('consumes the launch payload once, so a foreground does not re-arm twice', async () => {
    const engine = new FakeAlarmEngine();
    engine.simulateLaunchFromAlarm(occurrenceAlarmId(1));

    expect(await engine.consumeLaunchPayload()).toEqual({
      alarmId: occurrenceAlarmId(1),
      payload: null,
    });
    expect(await engine.consumeLaunchPayload()).toBeNull();
  });
});
