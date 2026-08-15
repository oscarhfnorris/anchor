/**
 * Proves the harness itself, which every later phase depends on.
 *
 * Phase 0 has no behaviour to test, but an empty suite is not a passing one — `vitest --run` exits
 * non-zero when it finds no test files. Rather than paper over that with `--passWithNoTests`, the
 * one thing Phase 0 genuinely can verify is the harness: that migrations apply, that foreign keys
 * are actually on, that Drizzle round-trips, and that the singleton CHECK bites.
 *
 * The foreign-keys assertion is the one that earns its place. The pragma is per-connection and is
 * not carried inside the serialized snapshot, so it is exactly the kind of thing that would be set
 * once on the template, silently lost on every restore, and only discovered on device.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { appSettings } from './schema';
import { createTestDb, type TestDb } from '../__tests__/db';

describe('test database harness', () => {
  let ctx: TestDb;

  beforeEach(() => {
    ctx = createTestDb();
    return () => ctx.close();
  });

  it('restores an already-migrated database', () => {
    const tables = ctx.sqlite
      .prepare("select name from sqlite_master where type = 'table'")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain('app_settings');
  });

  it('has foreign keys enabled on every restored connection', () => {
    expect(ctx.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('round-trips a write through Drizzle', async () => {
    await ctx.db.insert(appSettings).values({ id: 1, updatedAt: 1_700_000_000_000 });
    const rows = await ctx.db.select().from(appSettings).where(eq(appSettings.id, 1));
    expect(rows[0]?.updatedAt).toBe(1_700_000_000_000);
  });

  it('applies the schema defaults', async () => {
    await ctx.db.insert(appSettings).values({ id: 1, updatedAt: 1 });
    const rows = await ctx.db.select().from(appSettings);
    expect(rows[0]?.stepThreshold).toBe(15);
    expect(rows[0]?.rearmSeconds).toBe(20);
  });

  it('rejects a second settings row via the singleton CHECK', async () => {
    await ctx.db.insert(appSettings).values({ id: 1, updatedAt: 1 });
    await expect(ctx.db.insert(appSettings).values({ id: 2, updatedAt: 2 })).rejects.toThrow(
      /CHECK constraint failed/i,
    );
  });

  it('isolates databases between tests', async () => {
    const rows = await ctx.db.select().from(appSettings);
    expect(rows).toHaveLength(0);
  });
});
