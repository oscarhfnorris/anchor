/**
 * The clearing-tag invariant (D27), against the real schema.
 *
 * The deletion half is the one worth testing hardest. A check only at creation would let the
 * invariant lapse the moment a tag is removed, leaving an enabled alarm with nothing that can
 * silence it — and nobody would find out until it rang.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb, type TestDb } from '../__tests__/db';
import { deleteTag, enableAlarm, hasClearingTag } from './alarms';
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

describe('D27 — an enabled alarm always has a way to be cleared', () => {
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

  it('disables the alarm when its last clearing tag is deleted', async () => {
    await seedTag(ctx, '04a2b3c4', 'morning');
    await enableAlarm(ctx.db, 'wake', NOW);

    const disabled = await deleteTag(ctx.db, '04a2b3c4', NOW);

    expect(disabled).toEqual(['wake']);
    expect(await isEnabled(ctx, 'wake')).toBe(false);
  });

  it('leaves the alarm enabled while any other tag of that role remains (D31)', async () => {
    await seedTag(ctx, '04a2b3c4', 'morning');
    await seedTag(ctx, '04ffee11', 'morning');
    await enableAlarm(ctx.db, 'wake', NOW);

    const disabled = await deleteTag(ctx.db, '04a2b3c4', NOW);

    expect(disabled).toEqual([]);
    expect(await isEnabled(ctx, 'wake')).toBe(true);
  });

  it('does not touch the other feature when a tag is deleted (D10)', async () => {
    await seedTag(ctx, '04a2b3c4', 'morning');
    await seedTag(ctx, 'deadbeef', 'dock');
    await enableAlarm(ctx.db, 'wake', NOW);
    await enableAlarm(ctx.db, 'dock', NOW);

    await deleteTag(ctx.db, '04a2b3c4', NOW);

    expect(await isEnabled(ctx, 'wake')).toBe(false);
    expect(await isEnabled(ctx, 'dock')).toBe(true);
  });

  it('rejects a second tag with the same UID, so one tag is one row (D1)', async () => {
    await seedTag(ctx, '04a2b3c4', 'morning');
    await expect(seedTag(ctx, '04a2b3c4', 'morning')).rejects.toThrow(/UNIQUE/i);
  });
});
