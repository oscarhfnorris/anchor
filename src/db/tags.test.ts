/**
 * Tag deletion, and what it disables (D27).
 *
 * The deletion half of the invariant is the one worth exercising against real rows: a check only at
 * creation would let it lapse the moment a tag is removed, leaving an enabled alarm with nothing
 * that can silence it — and nobody would find out until it rang.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb, type TestDb } from '../__tests__/db';
import { enableAlarm } from './alarms';
import { alarms, tags } from './schema';
import { deleteTag, readRegistry } from './tags';

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

describe('D27 — deleting a tag disables what it leaves unclearable', () => {
  let ctx: TestDb;

  beforeEach(async () => {
    ctx = createTestDb();
    await seedAlarm(ctx, 'wake');
    await seedAlarm(ctx, 'dock');
    return () => ctx.close();
  });

  it('disables the alarm when its last clearing tag is deleted', async () => {
    await seedTag(ctx, '04a2b3c4', 'morning');
    await enableAlarm(ctx.db, 'wake', NOW);

    expect(await deleteTag(ctx.db, '04a2b3c4', NOW)).toEqual(['wake']);
    expect(await isEnabled(ctx, 'wake')).toBe(false);
  });

  it('leaves the alarm enabled while any other tag of that role remains (D31)', async () => {
    await seedTag(ctx, '04a2b3c4', 'morning');
    await seedTag(ctx, '04ffee11', 'morning');
    await enableAlarm(ctx.db, 'wake', NOW);

    expect(await deleteTag(ctx.db, '04a2b3c4', NOW)).toEqual([]);
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

  it('reports every tag as portable until places exist (D34)', async () => {
    await seedTag(ctx, '04a2b3c4', 'morning');
    expect(await readRegistry(ctx.db)).toEqual([
      { uid: '04a2b3c4', role: 'morning', portable: true },
    ]);
  });

  it('rejects a second tag with the same UID, so one tag is one row (D1)', async () => {
    await seedTag(ctx, '04a2b3c4', 'morning');
    await expect(seedTag(ctx, '04a2b3c4', 'morning')).rejects.toThrow(/UNIQUE/i);
  });
});
