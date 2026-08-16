/**
 * The validation barrel.
 *
 * These test the rules Zod adds *over* the table constraints — the ones SQL cannot express, and the
 * ones whose failure message a person has to read. A CHECK constraint that rejects hour 25 is right
 * and stays; it just surfaces as `CHECK constraint failed: alarms_hour`, which is no use at 07:00.
 *
 * The point of the barrel is that types come from these same schemas, so a rule loosened here
 * loosens the type too and the drift is visible rather than silent.
 */
import { describe, expect, it } from 'vitest';

import { alarmWithDaysSchema, zodSchemas } from './zod-schema';

const NOW = 1_700_000_000_000;

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
    for (const uid of ['04:A2:B3:C4', '04A2B3C4', '04-a2-b3-c4']) {
      expect(insert.safeParse({ ...base, uid }).success).toBe(false);
    }
  });

  it('refuses a non-hex UID', () => {
    expect(insert.safeParse({ ...base, uid: 'nothex' }).success).toBe(false);
  });

  it('refuses a role that is not a tag role (D22)', () => {
    expect(insert.safeParse({ ...base, uid: '04a2b3c4', role: 'wake' }).success).toBe(false);
  });
});

describe('alarms', () => {
  const insert = zodSchemas.tables.alarms.insertSchema;
  const base = { kind: 'wake' as const, createdAt: NOW, updatedAt: NOW };

  it('accepts a valid wall-clock time', () => {
    expect(insert.safeParse({ ...base, hour: 7, minute: 0 }).success).toBe(true);
  });

  it('refuses an out-of-range hour or minute before SQLite has to', () => {
    expect(insert.safeParse({ ...base, hour: 24, minute: 0 }).success).toBe(false);
    expect(insert.safeParse({ ...base, hour: 7, minute: 60 }).success).toBe(false);
  });

  it('refuses a fractional hour, which the column type would silently accept', () => {
    expect(insert.safeParse({ ...base, hour: 7.5, minute: 0 }).success).toBe(false);
  });

  it('refuses a kind that is not a feature', () => {
    expect(insert.safeParse({ kind: 'morning', hour: 7, minute: 0, createdAt: NOW, updatedAt: NOW }).success).toBe(false);
  });
});

describe('app settings singleton', () => {
  const insert = zodSchemas.tables.appSettings.insertSchema;

  it('refuses any id but 1', () => {
    expect(insert.safeParse({ id: 2, updatedAt: NOW }).success).toBe(false);
  });

  it('refuses a re-arm delay below the floor where crossing a room is impossible (D18)', () => {
    expect(insert.safeParse({ id: 1, rearmSeconds: 3, updatedAt: NOW }).success).toBe(false);
    expect(insert.safeParse({ id: 1, rearmSeconds: 10, updatedAt: NOW }).success).toBe(true);
  });
});

describe('an alarm and its weekdays', () => {
  const base = { kind: 'wake' as const, hour: 7, minute: 0, enabled: true };

  it('accepts a normal weekday selection', () => {
    expect(alarmWithDaysSchema.safeParse({ ...base, weekdays: [1, 2, 3, 4, 5] }).success).toBe(true);
  });

  it('refuses an empty selection, which could never fire', () => {
    const result = alarmWithDaysSchema.safeParse({ ...base, weekdays: [] });
    expect(result.success).toBe(false);
  });

  it('refuses duplicate weekdays — a rule no table constraint can express', () => {
    expect(alarmWithDaysSchema.safeParse({ ...base, weekdays: [1, 1] }).success).toBe(false);
  });

  it('refuses a weekday outside 0-6, catching the bridge 1-7 convention at the edge', () => {
    expect(alarmWithDaysSchema.safeParse({ ...base, weekdays: [7] }).success).toBe(false);
  });
});

describe('occurrences', () => {
  const insert = zodSchemas.tables.occurrences.insertSchema;

  it('accepts an unresolved future occurrence', () => {
    const parsed = insert.safeParse({ alarmId: 1, dueAt: NOW, createdAt: NOW });
    expect(parsed.success).toBe(true);
  });

  it('refuses an outcome outside the recorded set', () => {
    const parsed = insert.safeParse({ alarmId: 1, dueAt: NOW, createdAt: NOW, outcome: 'snoozed' });
    expect(parsed.success).toBe(false);
  });
});
