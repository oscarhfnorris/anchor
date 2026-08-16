/**
 * The schema's own constraints.
 *
 * Only rules the tables enforce belong here — defaults, CHECKs, uniqueness. The Zod layer refuses
 * the same things earlier and with a readable message (`zod-schema.test.ts`); these prove the last
 * line still holds, because a bad row must never reach disk even if it arrives from a path that
 * skipped validation.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb, type TestDb } from '../__tests__/db';
import { alarms, appSettings, occurrences } from './schema';

const NOW = 1_700_000_000_000;

describe('app_settings', () => {
  let ctx: TestDb;
  beforeEach(() => {
    ctx = createTestDb();
    return () => ctx.close();
  });

  it('applies the documented defaults', async () => {
    await ctx.db.insert(appSettings).values({ id: 1, updatedAt: NOW });
    const rows = await ctx.db.select().from(appSettings);
    expect(rows[0]?.stepThreshold).toBe(15);
    expect(rows[0]?.rearmSeconds).toBe(20);
  });

  it('rejects a second row via the singleton CHECK', async () => {
    await ctx.db.insert(appSettings).values({ id: 1, updatedAt: NOW });
    await expect(ctx.db.insert(appSettings).values({ id: 2, updatedAt: NOW })).rejects.toThrow(
      /CHECK constraint failed/i,
    );
  });
});

describe('alarms', () => {
  let ctx: TestDb;
  beforeEach(() => {
    ctx = createTestDb();
    return () => ctx.close();
  });

  it('rejects an out-of-range hour at the database, not only in Zod', async () => {
    await expect(
      ctx.db
        .insert(alarms)
        .values({ kind: 'wake', hour: 24, minute: 0, createdAt: NOW, updatedAt: NOW }),
    ).rejects.toThrow(/CHECK constraint failed/i);
  });

  it('allows only one alarm per feature (D10)', async () => {
    await ctx.db
      .insert(alarms)
      .values({ kind: 'wake', hour: 7, minute: 0, createdAt: NOW, updatedAt: NOW });
    await expect(
      ctx.db
        .insert(alarms)
        .values({ kind: 'wake', hour: 8, minute: 0, createdAt: NOW, updatedAt: NOW }),
    ).rejects.toThrow(/UNIQUE/i);
  });
});

describe('occurrences', () => {
  let ctx: TestDb;
  beforeEach(async () => {
    ctx = createTestDb();
    await ctx.db
      .insert(alarms)
      .values({ id: 1, kind: 'wake', hour: 7, minute: 0, createdAt: NOW, updatedAt: NOW });
    return () => ctx.close();
  });

  it('cannot hold two rows for the same firing, which keeps reconcile idempotent', async () => {
    await ctx.db.insert(occurrences).values({ alarmId: 1, dueAt: NOW, createdAt: NOW });
    await expect(
      ctx.db.insert(occurrences).values({ alarmId: 1, dueAt: NOW, createdAt: NOW }),
    ).rejects.toThrow(/UNIQUE/i);
  });

  it('refuses an occurrence for an alarm that does not exist', async () => {
    await expect(
      ctx.db.insert(occurrences).values({ alarmId: 999, dueAt: NOW, createdAt: NOW }),
    ).rejects.toThrow(/FOREIGN KEY/i);
  });
});
