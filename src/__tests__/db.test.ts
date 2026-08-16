/**
 * The test harness itself.
 *
 * Beside `db.ts` rather than in `src/db/`, because what these check is the harness — that restoring
 * a snapshot yields a migrated database, that the foreign-key pragma survives the restore, and that
 * tests cannot see each other's rows. None of that is a property of the schema.
 *
 * The foreign-keys case earns its place: the pragma is per-connection and is *not* carried inside
 * the serialized snapshot, so setting it once on the template would silently leave every test
 * running with foreign keys off — violations passing here and failing on device.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { appSettings } from '../db/schema';
import { createTestDb, type TestDb } from './db';

describe('the test database harness', () => {
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

  it('isolates databases between tests', async () => {
    const rows = await ctx.db.select().from(appSettings);
    expect(rows).toHaveLength(0);
  });
});
