/**
 * The database schema.
 *
 * Phase 0 defines `app_settings` only. It is the §12 singleton that every later phase needs, so it
 * is not a throwaway table to migrate away from, and its `CHECK (id = 1)` gives the harness a real
 * constraint to prove rather than a decorative one. The rest of §12 arrives with the phases that
 * use it.
 *
 * Instants are unix epoch milliseconds in UTC. Wall-clock schedules are stored as separate
 * hour/minute integers when they arrive (D23) — never as instants, which is how alarm apps drift by
 * an hour twice a year.
 */
import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

export const appSettings = sqliteTable(
  'app_settings',
  {
    id: integer('id').primaryKey(),
    stepThreshold: integer('step_threshold').notNull().default(15),
    rearmSeconds: integer('rearm_seconds').notNull().default(20),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [check('app_settings_singleton', sql`${t.id} = 1`)],
);

export type AppSettings = typeof appSettings.$inferSelect;
export type NewAppSettings = typeof appSettings.$inferInsert;
