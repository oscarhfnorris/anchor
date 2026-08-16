/**
 * Occurrence persistence (D25, D29).
 *
 * This is the half that was missing: the reducer emitted `recordOccurrence` and the miss query read
 * `fired_at`, with nothing between them. The tests that matter are the ones about *absence* — a row
 * that was never written, and a row that was written but never fired.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb, type TestDb } from '../../__tests__/db';
import { alarms } from '../schema';
import {
  invalidateFuture,
  materialise,
  readMissed,
  readOccurrences,
  readPending,
  recordCleared,
  recordFired,
} from './occurrences';

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

describe('occurrences', () => {
  let ctx: TestDb;

  beforeEach(async () => {
    ctx = createTestDb();
    await ctx.db
      .insert(alarms)
      .values({ id: 1, kind: 'wake', hour: 7, minute: 0, createdAt: NOW, updatedAt: NOW });
    return () => ctx.close();
  });

  it('materialises a horizon ahead of time', async () => {
    await materialise(ctx.db, 1, [NOW + HOUR, NOW + 2 * HOUR], NOW);
    expect(await readOccurrences(ctx.db, 1)).toHaveLength(2);
  });

  it('cannot create two rows for the same firing, however many times reconcile runs', async () => {
    await materialise(ctx.db, 1, [NOW + HOUR], NOW);
    await materialise(ctx.db, 1, [NOW + HOUR], NOW);
    expect(await readOccurrences(ctx.db, 1)).toHaveLength(1);
  });

  it('records that an alarm rang', async () => {
    await materialise(ctx.db, 1, [NOW], NOW);
    const [o] = await readOccurrences(ctx.db, 1);
    await recordFired(ctx.db, o!.id, NOW + 1000);
    expect((await readOccurrences(ctx.db, 1))[0]?.firedAt).toBe(NOW + 1000);
  });

  it('records how it ended', async () => {
    await materialise(ctx.db, 1, [NOW], NOW);
    const [o] = await readOccurrences(ctx.db, 1);
    await recordCleared(ctx.db, o!.id, NOW + 2000, 'cleared');
    expect((await readOccurrences(ctx.db, 1))[0]?.clearedAt).toBe(NOW + 2000);
  });

  describe('D25/D29 — the silent failure this exists to catch', () => {
    it('reports a past-due occurrence that never fired', async () => {
      await materialise(ctx.db, 1, [NOW - HOUR], NOW - 2 * HOUR);
      expect(await readMissed(ctx.db, NOW)).toHaveLength(1);
    });

    it('does not report one that fired', async () => {
      await materialise(ctx.db, 1, [NOW - HOUR], NOW - 2 * HOUR);
      const [o] = await readOccurrences(ctx.db, 1);
      await recordFired(ctx.db, o!.id, NOW - HOUR);
      expect(await readMissed(ctx.db, NOW)).toEqual([]);
    });

    it('does not report a future one, which would cry wolf on every launch', async () => {
      await materialise(ctx.db, 1, [NOW + HOUR], NOW);
      expect(await readMissed(ctx.db, NOW)).toEqual([]);
    });

    it('does not report one resolved without firing, such as an escape hatch', async () => {
      await materialise(ctx.db, 1, [NOW - HOUR], NOW - 2 * HOUR);
      const [o] = await readOccurrences(ctx.db, 1);
      await recordCleared(ctx.db, o!.id, NOW - HOUR, 'escapeHatch');
      expect(await readMissed(ctx.db, NOW)).toEqual([]);
    });
  });

  describe('invalidation on edit', () => {
    it('removes unresolved future rows so a new time is not merely cosmetic', async () => {
      await materialise(ctx.db, 1, [NOW + HOUR, NOW + 2 * HOUR], NOW);
      expect(await invalidateFuture(ctx.db, 1, NOW)).toBe(2);
      expect(await readPending(ctx.db, NOW)).toEqual([]);
    });

    it('never touches history — resolved rows are the only evidence of a bad night', async () => {
      await materialise(ctx.db, 1, [NOW - HOUR], NOW - 2 * HOUR);
      const [o] = await readOccurrences(ctx.db, 1);
      await recordFired(ctx.db, o!.id, NOW - HOUR);

      await invalidateFuture(ctx.db, 1, NOW);

      expect(await readOccurrences(ctx.db, 1)).toHaveLength(1);
    });

    it('leaves another alarm alone (D10)', async () => {
      await ctx.db
        .insert(alarms)
        .values({ id: 2, kind: 'dock', hour: 22, minute: 30, createdAt: NOW, updatedAt: NOW });
      await materialise(ctx.db, 1, [NOW + HOUR], NOW);
      await materialise(ctx.db, 2, [NOW + HOUR], NOW);

      await invalidateFuture(ctx.db, 1, NOW);

      expect(await readOccurrences(ctx.db, 2)).toHaveLength(1);
    });
  });
});
