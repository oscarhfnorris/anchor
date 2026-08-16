/**
 * The database schema.
 *
 * SQLite holds **intent** (§12): what alarms and occurrences *should* exist. It is the single
 * durable source of truth. AlarmKit's scheduled alarms and the App Group mirror are derived from it
 * and are never read to decide what should be true.
 *
 * Phase 1 adds tags, alarms and occurrences. Places, beacons and sessions arrive with the phases
 * that use them — a table with no code behind it is a decision made too early.
 *
 * **Tables only.** Row types and validation live in `zod-schema.ts`, so there is one place to import
 * from and no chance of a Zod schema and a hand-written type drifting apart.
 *
 * Instants are unix epoch milliseconds in UTC. Wall-clock schedules are stored as separate
 * hour/minute integers when they arrive (D23) — never as instants, which is how alarm apps drift by
 * an hour twice a year.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';


/**
 * A literal number inside a `sql` template.
 *
 * Interpolating a plain number produces a **bound parameter**, so the CHECK is generated as
 * `between ? and ?` — which is not a constraint at all, and the migration applies without complaint.
 * `sql.raw` emits the digits. Safe here because these are our own constants, never user input.
 */
const lit = (n: number) => sql.raw(String(n));

/**
 * Bounds that appear in two places by necessity.
 *
 * drizzle-zod derives everything a *column* can express — enums, nullability, defaults, boolean mode
 * — so those are never restated. It does **not** read CHECK constraints, and SQLite has no type
 * meaning "0 to 23", so a range has to be written as a CHECK here and as a Zod refinement there.
 *
 * Declaring the numbers once and using them in both is what stops that duplication drifting: change
 * the bound and both the constraint and the validation move together.
 */
export const BOUNDS = {
  hour: { min: 0, max: 23 },
  minute: { min: 0, max: 59 },
  weekday: { min: 0, max: 6 },
  rearmSecondsMin: 10, // D18: below ~10s you cannot cross a room before it fires again

  settingsSingletonId: 1,
} as const;

export const appSettings = sqliteTable(
  'app_settings',
  {
    id: integer('id').primaryKey(),
    stepThreshold: integer('step_threshold').notNull().default(15),
    rearmSeconds: integer('rearm_seconds').notNull().default(20),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [check('app_settings_singleton', sql`${t.id} = ${lit(BOUNDS.settingsSingletonId)}`)],
);



/**
 * Registered tags. `uid` is the natural key and is unique, so one physical tag is one row (D1).
 *
 * `role` lives here rather than in a junction because a tag has exactly one job everywhere (D22).
 * A junction would permit dock-here and morning-there, and since matching is by role that tag would
 * then clear the morning alarm while lying on the dock beside the bed.
 *
 * `place_id` is null until Phase 2 and means portable (D34) — it records where a tag is stuck, for
 * setup and the per-place capability check, and never affects whether a scan matches.
 */
export const tags = sqliteTable(
  'tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uid: text('uid').notNull().unique(),
    role: text('role', { enum: ['dock', 'morning'] }).notNull(),
    placeId: integer('place_id'),
    label: text('label'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('tags_role_idx').on(t.role)],
);

/**
 * One row per feature. `kind` is unique because there is exactly one dock alarm and one wake alarm.
 *
 * Time is stored as wall-clock hour/minute, never as an instant (D23): 07:00 must stay 07:00 across
 * a DST boundary, and storing the instant is how alarm apps drift by an hour twice a year.
 */
export const alarms = sqliteTable(
  'alarms',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind', { enum: ['dock', 'wake'] }).notNull().unique(),
    hour: integer('hour').notNull(),
    minute: integer('minute').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    check('alarms_hour', sql`${t.hour} between ${lit(BOUNDS.hour.min)} and ${lit(BOUNDS.hour.max)}`),
    check('alarms_minute', sql`${t.minute} between ${lit(BOUNDS.minute.min)} and ${lit(BOUNDS.minute.max)}`),
  ],
);

/** Active weekdays as rows, not a bitmask — queryable, readable in a dump, and in first normal form. */
export const alarmDays = sqliteTable(
  'alarm_days',
  {
    alarmId: integer('alarm_id')
      .notNull()
      .references(() => alarms.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.alarmId, t.weekday] }),
    check(
      'alarm_days_weekday',
      sql`${t.weekday} between ${lit(BOUNDS.weekday.min)} and ${lit(BOUNDS.weekday.max)}`,
    ),
  ],
);

/**
 * One row per scheduled firing, and its outcome.
 *
 * **Whether an alarm actually fired is the single most important thing this app records** (D25). The
 * worst failure is silent: a broken bridge means no alarm and no warning, and the user simply
 * oversleeps with no indication why. Detection is retrospective (D29) — on launch, any occurrence
 * past due with no `fired_at` is a miss — because if the bridge fails, nothing is running at the
 * time to notice.
 *
 * Rows are never deleted once resolved. They are the history, and the only evidence when a night
 * goes wrong.
 */
export const occurrences = sqliteTable(
  'occurrences',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    alarmId: integer('alarm_id')
      .notNull()
      .references(() => alarms.id, { onDelete: 'cascade' }),
    dueAt: integer('due_at').notNull(),
    firedAt: integer('fired_at'),
    clearedAt: integer('cleared_at'),
    outcome: text('outcome', {
      enum: ['cleared', 'escapeHatch', 'confirmedExit', 'gaveUp', 'missed'],
    }),
    placeId: integer('place_id'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    // Makes reconcile idempotent — re-running cannot double-insert the same firing.
    unique('occurrences_alarm_due').on(t.alarmId, t.dueAt),
    index('occurrences_alarm_idx').on(t.alarmId),
    // The D29 miss query, which runs on every launch.
    index('occurrences_unfired_idx').on(t.dueAt).where(sql`fired_at is null`),
  ],
);
