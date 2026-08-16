/**
 * The wake alarm end to end, across process death.
 *
 * The tests that earn this file are the restart ones. iOS launches the app fresh when an alarm is
 * dismissed, so a Stop press normally arrives in a *new process* — and every call below deliberately
 * goes through `dispatch`, which rebuilds state from storage each time, exactly as a cold launch
 * would. Nothing is carried in a variable between calls, because nothing can be.
 *
 * If state were held in memory these would still pass in a single-process test run while the real
 * app silently reset its re-arm delay and its step gate on every press.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb, type TestDb } from '../__tests__/db';
import { FakeAlarmEngine } from '../alarm/engine.fake';
import { enableAlarm } from '../db/repositories/alarms';
import { materialise, readEvents, readOccurrences } from '../db/repositories/occurrences';
import { alarmDays, alarms, tags } from '../db/schema';
import { currentState, dispatch, type WakeDeps } from './wake-service';

const DUE = new Date('2026-03-09T07:00:00').getTime();
const MIN = 60_000;
const MORNING = '04a2b3c4';

describe('the wake alarm across restarts', () => {
  let ctx: TestDb;
  let engine: FakeAlarmEngine;
  let steps: number | null;
  let deps: WakeDeps;

  beforeEach(async () => {
    ctx = createTestDb();
    engine = new FakeAlarmEngine();
    steps = 0;
    deps = { db: ctx.db, engine, stepsSince: async () => steps };

    await ctx.db
      .insert(alarms)
      .values({ id: 1, kind: 'wake', hour: 7, minute: 0, createdAt: DUE, updatedAt: DUE });
    await ctx.db.insert(alarmDays).values([1].map((weekday) => ({ alarmId: 1, weekday })));
    await ctx.db.insert(tags).values({ uid: MORNING, role: 'morning', createdAt: DUE, updatedAt: DUE });
    await enableAlarm(ctx.db, 'wake', DUE);
    await materialise(ctx.db, 1, [DUE], DUE - MIN);
    return () => ctx.close();
  });

  it('records the firing, so a miss can never be inferred for a night it rang', async () => {
    await dispatch(deps, { kind: 'alarmFired' }, DUE);

    const [o] = await readOccurrences(ctx.db, 1);
    expect(o?.firedAt).toBe(DUE);
    expect((await readEvents(ctx.db, o!.id)).map((e) => e.kind)).toEqual(['fired']);
  });

  it('rebuilds the alerting state from storage on a cold launch', async () => {
    await dispatch(deps, { kind: 'alarmFired' }, DUE);

    // Nothing carried over — this is what a fresh process sees.
    expect(await currentState(ctx.db, 1)).toEqual({
      kind: 'alerting',
      firstRangAt: DUE,
      rearmCount: 0,
    });
  });

  it('keeps shortening the re-arm delay across process deaths (D18)', async () => {
    await dispatch(deps, { kind: 'alarmFired' }, DUE);

    // Each press is a separate launch. If rearmCount lived in memory it would be 0 every time and
    // the delay would stay at 20s forever.
    await dispatch(deps, { kind: 'stopPressed' }, DUE + 1 * MIN);
    await dispatch(deps, { kind: 'stopPressed' }, DUE + 2 * MIN);
    await dispatch(deps, { kind: 'stopPressed' }, DUE + 3 * MIN);

    const scheduled = engine.calls.filter((c) => c.method === 'schedule');
    const delays = scheduled.map((c, i) => (c.at! - (DUE + (i + 1) * MIN)) / 1000);
    expect(delays).toEqual([20, 15, 10]);
  });

  it('does not let a restart buy a fresh step allowance (D35)', async () => {
    await dispatch(deps, { kind: 'alarmFired' }, DUE);
    await dispatch(deps, { kind: 'stopPressed' }, DUE + MIN);

    // Still in bed after the restart: the gate measures from the first ring, not from this launch.
    steps = 4;
    const rejected = await dispatch(deps, { kind: 'tagScanned', uid: MORNING }, DUE + 2 * MIN);
    expect(rejected.effects).toEqual([
      { kind: 'rejectScan', reason: 'notEnoughSteps', stepsShort: 11 },
    ]);

    steps = 20;
    const accepted = await dispatch(deps, { kind: 'tagScanned', uid: MORNING }, DUE + 3 * MIN);
    expect(accepted.state.kind).toBe('cleared');
  });

  it('resolves the occurrence when cleared, so the morning is not reported as missed', async () => {
    await dispatch(deps, { kind: 'alarmFired' }, DUE);
    steps = 30;
    await dispatch(deps, { kind: 'tagScanned', uid: MORNING }, DUE + 2 * MIN);

    const [o] = await readOccurrences(ctx.db, 1);
    expect(o?.clearedAt).toBe(DUE + 2 * MIN);
    expect(await currentState(ctx.db, 1)).toEqual({ kind: 'idle' });
  });

  it('cancels the OS alarm when it clears, leaving nothing to fire again', async () => {
    await dispatch(deps, { kind: 'alarmFired' }, DUE);
    await dispatch(deps, { kind: 'stopPressed' }, DUE + MIN);
    steps = 30;
    await dispatch(deps, { kind: 'tagScanned', uid: MORNING }, DUE + 2 * MIN);

    expect(engine.peek()).toEqual([]);
  });

  it('rings the morning that is actually due, not an older one it slept through (D25)', async () => {
    // Two nights powered off, then it rings today. Marking the oldest as fired would erase a real
    // miss and record today's ring against the wrong morning.
    const older = DUE - 2 * 24 * 60 * MIN;
    await materialise(ctx.db, 1, [older], older - MIN);

    await dispatch(deps, { kind: 'alarmFired' }, DUE);

    const rows = await readOccurrences(ctx.db, 1);
    expect(rows.find((o) => o.dueAt === DUE)?.firedAt).toBe(DUE);
    expect(rows.find((o) => o.dueAt === older)?.firedAt).toBeNull();
  });

  it('schedules nothing when there is no occurrence to re-arm against', async () => {
    // No occurrence has fired, so a stray Stop press must not create an alarm under an invented id
    // that nothing could ever find or cancel.
    await dispatch(deps, { kind: 'stopPressed' }, DUE);
    expect(engine.peek()).toEqual([]);
  });

  it('logs a Stop press from the event, not from the effect it produced', async () => {
    await dispatch(deps, { kind: 'alarmFired' }, DUE);
    await dispatch(deps, { kind: 'stopPressed' }, DUE + MIN);

    const [o] = await readOccurrences(ctx.db, 1);
    const kinds = (await readEvents(ctx.db, o!.id)).map((e) => e.kind);
    // Exactly one, and only because a Stop press happened — rearmCount is counted from these, so a
    // future rule that reschedules for another reason must not inflate it.
    expect(kinds.filter((k) => k === 'stopPressed')).toHaveLength(1);
  });

  it('leaves a full record of the night for D25', async () => {
    await dispatch(deps, { kind: 'alarmFired' }, DUE);
    await dispatch(deps, { kind: 'stopPressed' }, DUE + MIN);
    steps = 2;
    await dispatch(deps, { kind: 'tagScanned', uid: MORNING }, DUE + 2 * MIN);
    steps = 30;
    await dispatch(deps, { kind: 'tagScanned', uid: MORNING }, DUE + 3 * MIN);

    const [o] = await readOccurrences(ctx.db, 1);
    expect((await readEvents(ctx.db, o!.id)).map((e) => e.kind)).toEqual([
      'fired',
      'stopPressed',
      'scanRejected',
    ]);
  });
});
