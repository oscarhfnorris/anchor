/**
 * The single barrel for database validation and types.
 *
 * Everything that needs to know the shape of a row imports from here: Zod schemas for validating at
 * a boundary, and the types inferred from those same schemas so validation and types cannot drift
 * apart. `schema.ts` stays the Drizzle table definitions and nothing else.
 *
 * **Why Zod when the tables already carry CHECK constraints.** The constraints are the last line and
 * they stay — a bad row must never reach disk. But SQLite enforces them by throwing
 * `CHECK constraint failed: alarms_hour`, which is a fine thing to find in a log and a useless thing
 * to show a person at 07:00. Zod refuses earlier, at the edge, with a reason the UI can render, and
 * refuses things SQL cannot express at all — that a UID is lowercase hex, or that a weekday list has
 * no duplicates.
 *
 * The schemas here are deliberately *stricter* than the columns. Widening one to make a call site
 * compile is how the two ends drift.
 */
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

import { alarmDays, alarms, appSettings, occurrences, tags } from './schema';

/**
 * A tag UID as stored: lowercase hex, separators already stripped.
 *
 * Identity is the hardware UID (D1) and comparison is on the normalised form, so storing anything
 * else would mean a tag that never matches itself. `core/tags.ts` does the normalising; this refuses
 * to persist a value that skipped it.
 */
const uid = z
  .string()
  .min(1, 'A tag must have a UID — an empty read never matches')
  .regex(/^[0-9a-f]+$/, 'UIDs are stored as normalised lowercase hex');

/** 0 = Sunday, matching `Date#getDay` and `core/schedule.ts`. The bridge's 1–7 is converted at the seam. */
const weekday = z.number().int().min(0).max(6);

/** Unix epoch milliseconds, UTC. Wall-clock times are hour/minute integers instead (D23). */
const instant = z.number().int().nonnegative();

export const zodSchemas = {
  enums: {
    /** A tag's role. Global to the tag, never per-place (D22). */
    tagRole: z.enum(['dock', 'morning']),
    /** Which feature an alarm belongs to. The two are independent (D10). */
    alarmKind: z.enum(['dock', 'wake']),
    /** How an occurrence ended. `missed` is inferred lazily on launch, never written live (D29). */
    occurrenceOutcome: z.enum(['cleared', 'escapeHatch', 'confirmedExit', 'gaveUp', 'missed']),
    weekday,
    uid,
    instant,
  },

  tables: {
    appSettings: {
      insertSchema: createInsertSchema(appSettings, {
        id: z.literal(1, 'app_settings is a singleton'),
        // `.optional()` is load-bearing: overriding a column in drizzle-zod replaces its generated
        // schema entirely, which discards the optionality a database default would have given it.
        // Without it these become required on insert and the defaults can never apply.
        stepThreshold: z.number().int().min(0).optional(),
        rearmSeconds: z
          .number()
          .int()
          .min(10, 'Below ten seconds you cannot cross a room (D18)')
          .optional(),
        updatedAt: instant,
      }),
      updateSchema: createUpdateSchema(appSettings),
      selectSchema: createSelectSchema(appSettings),
    },

    tags: {
      insertSchema: createInsertSchema(tags, {
        uid,
        label: z.string().trim().min(1).max(60).nullish(),
        createdAt: instant,
        updatedAt: instant,
      }),
      updateSchema: createUpdateSchema(tags, { uid }),
      selectSchema: createSelectSchema(tags),
    },

    alarms: {
      insertSchema: createInsertSchema(alarms, {
        hour: z.number().int().min(0).max(23),
        minute: z.number().int().min(0).max(59),
        createdAt: instant,
        updatedAt: instant,
      }),
      updateSchema: createUpdateSchema(alarms, {
        hour: z.number().int().min(0).max(23),
        minute: z.number().int().min(0).max(59),
      }),
      selectSchema: createSelectSchema(alarms),
    },

    alarmDays: {
      insertSchema: createInsertSchema(alarmDays, { weekday }),
      updateSchema: createUpdateSchema(alarmDays, { weekday }),
      selectSchema: createSelectSchema(alarmDays),
    },

    occurrences: {
      insertSchema: createInsertSchema(occurrences, {
        dueAt: instant,
        firedAt: instant.nullish(),
        clearedAt: instant.nullish(),
        createdAt: instant,
      }),
      updateSchema: createUpdateSchema(occurrences),
      selectSchema: createSelectSchema(occurrences),
    },
  },
} as const;

/**
 * A whole alarm as the UI edits it: the row plus its active weekdays.
 *
 * Weekdays live in their own table (rows, not a bitmask), so nothing in the table schemas can say
 * "at least one day, no duplicates". This is where that rule lives, and it is a real one — a
 * schedule with no active day never fires, and `nextOccurrence` returns null rather than guessing.
 */
export const alarmWithDaysSchema = z.object({
  kind: zodSchemas.enums.alarmKind,
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  enabled: z.boolean(),
  weekdays: z
    .array(weekday)
    .min(1, 'An alarm with no active day can never fire')
    .refine((days) => new Set(days).size === days.length, 'Duplicate weekday'),
});

export type AppSettings = z.infer<typeof zodSchemas.tables.appSettings.selectSchema>;
export type NewAppSettings = z.infer<typeof zodSchemas.tables.appSettings.insertSchema>;
export type Tag = z.infer<typeof zodSchemas.tables.tags.selectSchema>;
export type NewTag = z.infer<typeof zodSchemas.tables.tags.insertSchema>;
export type Alarm = z.infer<typeof zodSchemas.tables.alarms.selectSchema>;
export type NewAlarm = z.infer<typeof zodSchemas.tables.alarms.insertSchema>;
export type AlarmDay = z.infer<typeof zodSchemas.tables.alarmDays.selectSchema>;
export type Occurrence = z.infer<typeof zodSchemas.tables.occurrences.selectSchema>;
export type NewOccurrence = z.infer<typeof zodSchemas.tables.occurrences.insertSchema>;
export type AlarmWithDays = z.infer<typeof alarmWithDaysSchema>;

export type TagRole = z.infer<typeof zodSchemas.enums.tagRole>;
export type AlarmKind = z.infer<typeof zodSchemas.enums.alarmKind>;
export type OccurrenceOutcome = z.infer<typeof zodSchemas.enums.occurrenceOutcome>;
export type Weekday = z.infer<typeof zodSchemas.enums.weekday>;
