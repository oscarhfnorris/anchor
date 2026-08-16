/**
 * Reconciliation, end to end through a real database and a fake engine.
 *
 * This is the first test that exercises `core/`, `db/` and the platform seam together. The unit
 * tests prove each decides correctly; these prove the three actually meet — which is where the app
 * previously had a gap: the reducer emitted `recordOccurrence`, the miss query read `fired_at`, and
 * nothing joined them.
 *
 * The scenarios are the ones that happen to a real phone: a first launch, a launch after a night
 * powered off, and being opened twice in a row.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb, type TestDb } from '../__tests__/db';
import { FakeAlarmEngine } from '../alarm/engine.fake';
import { occurrenceAlarmId } from '../core/occurrences';
import { enableAlarm } from '../db/repositories/alarms';
import { readOccurrences, recordFired } from '../db/repositories/occurrences';
import { alarmDays, alarms, tags } from '../db/schema';
import { reconcile } from './reconcile';

const local = (s: string) => new Date(s).getTime();
const MONDAY_0600 = local('2026-03-09T06:00:00');

async function seed(ctx: TestDb, enabled = true) {
  const now = MONDAY_0600;
  await ctx.db
    .insert(alarms)
    .values({ id: 1, kind: 'wake', hour: 7, minute: 0, createdAt: now, updatedAt: now });
  await ctx.db
    .insert(alarmDays)
    .values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ alarmId: 1, weekday })));
  if (enabled) {
    await ctx.db.insert(tags).values({ uid: '04a2b3c4', role: 'morning', createdAt: now, updatedAt: now });
    await enableAlarm(ctx.db, 'wake', now);
  }
}

describe('reconcile', () => {
  let ctx: TestDb;
  let engine: FakeAlarmEngine;

  beforeEach(() => {
    ctx = createTestDb();
    engine = new FakeAlarmEngine();
    return () => ctx.close();
  });

  it('materialises a horizon and hands it to the OS on a first launch', async () => {
    await seed(ctx);

    const report = await reconcile(ctx.db, engine, MONDAY_0600);

    expect(report.materialised).toBe(3);
    expect(report.scheduled).toBe(3);
    expect(engine.peek()[0]).toEqual({
      id: occurrenceAlarmId(1),
      at: local('2026-03-09T07:00:00'),
    });
  });

  it('is idempotent — a second launch creates nothing new', async () => {
    await seed(ctx);
    await reconcile(ctx.db, engine, MONDAY_0600);

    const second = await reconcile(ctx.db, engine, MONDAY_0600);

    expect(second.materialised).toBe(0);
    expect(await readOccurrences(ctx.db, 1)).toHaveLength(3);
  });

  it('ignores a disabled alarm', async () => {
    await seed(ctx, false);

    const report = await reconcile(ctx.db, engine, MONDAY_0600);

    expect(report.materialised).toBe(0);
    expect(engine.peek()).toEqual([]);
  });

  describe('the night the phone was off', () => {
    it('reports every alarm that passed unfired, not just the last', async () => {
      await seed(ctx);
      await reconcile(ctx.db, engine, MONDAY_0600);

      // Two days pass with the app never running. Both mornings are due and neither recorded a
      // firing — misses accumulate rather than the newest hiding the older one.
      const report = await reconcile(ctx.db, engine, local('2026-03-10T09:00:00'));

      expect(report.missed.map((o) => o.dueAt)).toEqual([
        local('2026-03-09T07:00:00'),
        local('2026-03-10T07:00:00'),
      ]);
      // And the horizon is topped back up rather than left short by the outage.
      expect(report.materialised).toBeGreaterThan(0);
    });

    it('says nothing was missed when the alarm did fire', async () => {
      await seed(ctx);
      await reconcile(ctx.db, engine, MONDAY_0600);
      const [first] = await readOccurrences(ctx.db, 1);
      await recordFired(ctx.db, first!.id, local('2026-03-09T07:00:00'));

      // Checked before the next morning is due, so the only resolved occurrence is the one that
      // fired — otherwise this would be asserting that a genuinely missed alarm is not reported.
      const report = await reconcile(ctx.db, engine, local('2026-03-09T09:00:00'));

      expect(report.missed).toEqual([]);
    });
  });

  it('re-issues blind rather than trusting the bridge to report OS state', async () => {
    await seed(ctx);
    // A bridge that cannot enumerate at all must not stop reconciliation working.
    const blind = new FakeAlarmEngine({ supportsListing: false });

    const report = await reconcile(ctx.db, blind, MONDAY_0600);

    expect(report.scheduled).toBe(3);
    expect(blind.peek()).toHaveLength(3);
  });
});
