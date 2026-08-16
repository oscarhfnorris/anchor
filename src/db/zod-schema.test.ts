/**
 * The validation barrel.
 *
 * Two things are worth testing here. First, what the columns already say — drizzle-zod derives
 * enums, nullability, defaults and boolean mode from the table, so those need no restating and the
 * tests prove they are genuinely covered. Second, what the columns *cannot* say: drizzle-zod does
 * not read CHECK constraints, so numeric ranges are refined by hand from the same `BOUNDS` the
 * constraints are built from, and that is the part that could silently rot.
 */
import { describe, expect, it } from 'vitest';

import { BOUNDS } from './schema';
import { alarmWithDaysSchema, zodSchemas } from './zod-schema';

const NOW = 1_700_000_000_000;

describe('derived from the columns, never restated', () => {
  it('takes the enum from text({ enum })', () => {
    const insert = zodSchemas.tables.tags.insertSchema;
    expect(insert.safeParse({ uid: '04a2b3c4', role: 'wake', createdAt: NOW, updatedAt: NOW }).success).toBe(false);
    expect(insert.safeParse({ uid: '04a2b3c4', role: 'morning', createdAt: NOW, updatedAt: NOW }).success).toBe(true);
  });

  it('takes nullability from notNull()', () => {
    const select = zodSchemas.tables.tags.selectSchema;
    const row = { id: 1, uid: null, role: 'morning', placeId: null, label: null, createdAt: NOW, updatedAt: NOW };
    expect(select.safeParse(row).success).toBe(false);
  });

  it('takes boolean mode from the column', () => {
    const select = zodSchemas.tables.alarms.selectSchema;
    const row = { id: 1, kind: 'wake', hour: 7, minute: 0, enabled: 'yes', createdAt: NOW, updatedAt: NOW };
    expect(select.safeParse(row).success).toBe(false);
  });

  it('makes a defaulted column optional on insert', () => {
    const insert = zodSchemas.tables.appSettings.insertSchema;
    expect(insert.safeParse({ id: 1, updatedAt: NOW }).success).toBe(true);
  });

  it('leaves an update partial, so a patch need not restate every field', () => {
    const update = zodSchemas.tables.alarms.updateSchema;
    expect(update.safeParse({ enabled: true, updatedAt: NOW }).success).toBe(true);
  });
});

describe('refined by hand, because CHECK constraints are not derived', () => {
  it('bounds the hour on both insert and select', () => {
    const bad = { id: 1, kind: 'wake', hour: BOUNDS.hour.max + 1, minute: 0, enabled: true, createdAt: NOW, updatedAt: NOW };
    expect(zodSchemas.tables.alarms.selectSchema.safeParse(bad).success).toBe(false);
    expect(zodSchemas.tables.alarms.insertSchema.safeParse(bad).success).toBe(false);
  });

  it('bounds the minute', () => {
    const bad = { kind: 'wake', hour: 7, minute: BOUNDS.minute.max + 1, createdAt: NOW, updatedAt: NOW };
    expect(zodSchemas.tables.alarms.insertSchema.safeParse(bad).success).toBe(false);
  });

  it('keeps app_settings a singleton', () => {
    expect(zodSchemas.tables.appSettings.insertSchema.safeParse({ id: 2, updatedAt: NOW }).success).toBe(false);
  });

  it('refuses a re-arm delay below the floor where crossing a room is impossible (D18)', () => {
    const insert = zodSchemas.tables.appSettings.insertSchema;
    expect(insert.safeParse({ id: 1, rearmSeconds: BOUNDS.rearmSecondsMin - 1, updatedAt: NOW }).success).toBe(false);
    expect(insert.safeParse({ id: 1, rearmSeconds: BOUNDS.rearmSecondsMin, updatedAt: NOW }).success).toBe(true);
  });
});

describe('tag UIDs (D1)', () => {
  const insert = zodSchemas.tables.tags.insertSchema;
  const base = { role: 'morning' as const, createdAt: NOW, updatedAt: NOW };

  it('accepts a normalised lowercase hex UID', () => {
    expect(insert.safeParse({ ...base, uid: '04a2b3c4' }).success).toBe(true);
  });

  it('refuses an empty UID, which must never match anything', () => {
    expect(insert.safeParse({ ...base, uid: '' }).success).toBe(false);
  });

  it('refuses a UID that skipped normalisation, so it cannot match itself later', () => {
    for (const uid of ['04:A2:B3:C4', '04A2B3C4', '04-a2-b3-c4', 'nothex']) {
      expect(insert.safeParse({ ...base, uid }).success).toBe(false);
    }
  });
});

describe('an alarm and its weekdays', () => {
  const base = { kind: 'wake' as const, hour: 7, minute: 0, enabled: true };

  it('accepts a normal selection', () => {
    expect(alarmWithDaysSchema.safeParse({ ...base, weekdays: [1, 2, 3, 4, 5] }).success).toBe(true);
  });

  it('refuses an empty selection, which could never fire', () => {
    expect(alarmWithDaysSchema.safeParse({ ...base, weekdays: [] }).success).toBe(false);
  });

  it('refuses duplicates — a rule no table constraint can express', () => {
    expect(alarmWithDaysSchema.safeParse({ ...base, weekdays: [1, 1] }).success).toBe(false);
  });

  it('refuses a weekday outside 0-6, catching the bridge 1-7 convention at the edge', () => {
    expect(alarmWithDaysSchema.safeParse({ ...base, weekdays: [7] }).success).toBe(false);
  });
});

describe('occurrences', () => {
  it('refuses an outcome outside the recorded set', () => {
    const insert = zodSchemas.tables.occurrences.insertSchema;
    expect(insert.safeParse({ alarmId: 1, dueAt: NOW, createdAt: NOW, outcome: 'snoozed' }).success).toBe(false);
    expect(insert.safeParse({ alarmId: 1, dueAt: NOW, createdAt: NOW }).success).toBe(true);
  });
});
