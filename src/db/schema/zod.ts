/**
 * The single barrel for database validation and types.
 *
 * **Only what the columns cannot say themselves is written here.** drizzle-zod derives enums from
 * `text({ enum })`, nullability from `.notNull()`, optionality from `.default()` and boolean mode
 * from the column — none of that is restated, and restating it is how the two drift. What it does
 * not derive is CHECK constraints, so numeric ranges are refined below using `BOUNDS` from
 * `schema.ts`, which is also what the constraints themselves are built from.
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

import type { Weekday } from '../../core/schedule';
import type { AlarmKind, TagRole } from '../../core/types';
import { alarmDays, alarms, appSettings, BOUNDS, occurrences, tags } from './tables';

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
const weekday = z.number().int().min(BOUNDS.weekday.min).max(BOUNDS.weekday.max);

/** Unix epoch milliseconds, UTC. Wall-clock times are hour/minute integers instead (D23). */
const instant = z.number().int().nonnegative();

const hour = z.number().int().min(BOUNDS.hour.min).max(BOUNDS.hour.max);
const minute = z.number().int().min(BOUNDS.minute.min).max(BOUNDS.minute.max);

export const zodSchemas = {
  // tagRole is global to the tag, never per-place (D22). alarmKind's two features are independent
  // (D10). An occurrence's `missed` outcome is inferred lazily on launch, never written live (D29).
  enums: {
    tagRole: z.enum(['dock', 'morning']),
    alarmKind: z.enum(['dock', 'wake']),
    occurrenceOutcome: z.enum(['cleared', 'escapeHatch', 'confirmedExit', 'gaveUp', 'missed']),
    weekday,
    uid,
    instant,
  },

  tables: {
    appSettings: {
      insertSchema: createInsertSchema(appSettings, {
        id: z.literal(BOUNDS.settingsSingletonId, 'app_settings is a singleton'),
        // `.optional()` is load-bearing: overriding a column in drizzle-zod replaces its generated
        // schema entirely, which discards the optionality a database default would have given it.
        // Without it these become required on insert and the defaults can never apply.
        stepThreshold: z.number().int().min(0).optional(),
        rearmSeconds: z
          .number()
          .int()
          .min(BOUNDS.rearmSecondsMin, 'Below ten seconds you cannot cross a room (D18)')
          .optional(),
        updatedAt: instant,
      }),
      updateSchema: createUpdateSchema(appSettings),
      selectSchema: createSelectSchema(appSettings, {
        id: z.literal(BOUNDS.settingsSingletonId),
        stepThreshold: z.number().int().min(0),
        rearmSeconds: z.number().int().min(BOUNDS.rearmSecondsMin),
      }),
    },

    tags: {
      insertSchema: createInsertSchema(tags, {
        uid,
        label: z.string().trim().min(1).max(60).nullish(),
        createdAt: instant,
        updatedAt: instant,
      }),
      updateSchema: createUpdateSchema(tags, { uid: uid.optional() }),
      selectSchema: createSelectSchema(tags, { uid }),
    },

    alarms: {
      insertSchema: createInsertSchema(alarms, { hour, minute, createdAt: instant, updatedAt: instant }),
      // Optional, because an update carries only the fields being changed. Overriding a column
      // replaces its generated schema wholesale, and the generated one was already optional — the
      // same trap as the defaults above, and it surfaces as "expected number, received undefined"
      // on a patch that never mentioned the field.
      updateSchema: createUpdateSchema(alarms, {
        hour: hour.optional(),
        minute: minute.optional(),
      }),
      // The select schema carries the same bounds as the insert one. `createSelectSchema` derives
      // fields from column *types* and knows nothing about CHECK constraints, so without these it
      // would accept hour 25 — and parsing on read would prove nothing (see parse.ts).
      selectSchema: createSelectSchema(alarms, { hour, minute }),
    },

    alarmDays: {
      insertSchema: createInsertSchema(alarmDays, { weekday }),
      updateSchema: createUpdateSchema(alarmDays, { weekday: weekday.optional() }),
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
  hour,
  minute,
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

/**
 * The vocabulary is owned by `core/`, not redefined here.
 *
 * These were briefly declared in both places. They were structurally identical, so TypeScript
 * accepted assignments between them and the duplication was invisible — until someone added a role
 * in one place and the other silently disagreed. `core/` cannot import from `db/` (the purity rule),
 * so the definition has to live there and this layer derives from it.
 *
 * The assertions below are the guard: if a Zod enum stops covering exactly the union `core/`
 * declares, this file stops compiling.
 */
export type { AlarmKind, TagRole, Weekday };
export type OccurrenceOutcome = z.infer<typeof zodSchemas.enums.occurrenceOutcome>;

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _tagRoleMatchesCore: Exact<z.infer<typeof zodSchemas.enums.tagRole>, TagRole> = true;
const _alarmKindMatchesCore: Exact<z.infer<typeof zodSchemas.enums.alarmKind>, AlarmKind> = true;
void _tagRoleMatchesCore;
void _alarmKindMatchesCore;
