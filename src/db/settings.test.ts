/**
 * Co-located tests for the settings accessors.
 *
 * These exist as much to prove the driver-agnostic shape as to test the two functions: they run the
 * real `src/db/settings.ts` against `better-sqlite3`, which is only possible because it takes a
 * handle rather than importing the device database. If someone "simplifies" that back to a direct
 * `./client` import, this file stops compiling — which is the point.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { createTestDb, type TestDb } from '../__tests__/db';
import { readSettings, touchSettings, SINGLETON_ID } from './settings';

describe('app settings', () => {
  let ctx: TestDb;

  beforeEach(() => {
    ctx = createTestDb();
    return () => ctx.close();
  });

  it('returns undefined before anything is written', async () => {
    expect(await readSettings(ctx.db)).toBeUndefined();
  });

  it('writes and reads back the same instant', async () => {
    const written = await touchSettings(ctx.db, 1_700_000_000_000);
    const read = await readSettings(ctx.db);
    expect(read?.updatedAt).toBe(written);
    expect(read?.id).toBe(SINGLETON_ID);
  });

  it('updates in place rather than inserting a second row', async () => {
    await touchSettings(ctx.db, 1);
    await touchSettings(ctx.db, 2);
    const read = await readSettings(ctx.db);
    expect(read?.updatedAt).toBe(2);
  });

  it('seeds the documented defaults on first write', async () => {
    await touchSettings(ctx.db, 1);
    const read = await readSettings(ctx.db);
    expect(read?.stepThreshold).toBe(15);
    expect(read?.rearmSeconds).toBe(20);
  });
});
