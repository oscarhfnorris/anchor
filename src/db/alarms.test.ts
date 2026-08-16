/**
 * Enabling an alarm, against the real schema (D27).
 *
 * The rule itself is tested without a database in `src/core/registry.test.ts`. What these add is
 * that the rows actually move — a verdict nobody writes down is not an invariant.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb, type TestDb } from '../__tests__/db';
import { enableAlarm, hasClearingTag } from './alarms';
import { alarms, tags } from './schema';

const NOW = 1_700_000_000_000;

async function seedAlarm(ctx: TestDb, kind: 'wake' | 'dock') {
  await ctx.db
    .insert(alarms)
    .values({ kind, hour: 7, minute: 0, enabled: false, createdAt: NOW, updatedAt: NOW });
}

async function seedTag(ctx: TestDb, uid: string, role: 'dock' | 'morning') {
  await ctx.db.insert(tags).values({ uid, role, createdAt: NOW, updatedAt: NOW });
}

const isEnabled = async (ctx: TestDb, kind: 'wake' | 'dock') => {
  const rows = await ctx.db.select().from(alarms).where(eq(alarms.kind, kind));
  return rows[0]?.enabled;
};

describe('D27 — an alarm cannot be enabled with nothing to clear it', () => {
  let ctx: TestDb;

  beforeEach(async () => {
    ctx = createTestDb();
    await seedAlarm(ctx, 'wake');
    await seedAlarm(ctx, 'dock');
    return () => ctx.close();
  });

  it('refuses to enable the wake alarm with no morning tag', async () => {
    expect(await enableAlarm(ctx.db, 'wake', NOW)).toEqual({ ok: false, reason: 'noClearingTag' });
    expect(await isEnabled(ctx, 'wake')).toBe(false);
  });

  it('enables once a morning tag exists', async () => {
    await seedTag(ctx, '04a2b3c4', 'morning');
    expect(await enableAlarm(ctx.db, 'wake', NOW)).toEqual({ ok: true });
    expect(await isEnabled(ctx, 'wake')).toBe(true);
  });

  it('does not accept a dock tag as clearing the wake alarm', async () => {
    await seedTag(ctx, 'deadbeef', 'dock');
    expect(await hasClearingTag(ctx.db, 'wake')).toBe(false);
    expect(await enableAlarm(ctx.db, 'wake', NOW)).toEqual({ ok: false, reason: 'noClearingTag' });
  });
});
