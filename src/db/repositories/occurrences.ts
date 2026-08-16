/**
 * Occurrence persistence — the watchdog's storage.
 *
 * D25 calls whether an alarm actually fired the single most important thing this app records, and
 * until now nothing wrote it: the reducer emitted `recordOccurrence` and the miss query read
 * `fired_at`, with no path between them. This is that path.
 *
 * The rules about *which* occurrences should exist, which are missed, and what an edit invalidates
 * live in `core/occurrences.ts`. This reads and writes rows.
 */
import { and, eq, gte, isNull, lt } from 'drizzle-orm';

import type { OccurrenceRow } from '../../core/occurrences';
import { occurrences } from '../schema';
import { zodSchemas, type Occurrence, type OccurrenceOutcome } from '../schema';
import type { AnySqliteDb } from '../types';

const row = zodSchemas.tables.occurrences.selectSchema;
const insert = zodSchemas.tables.occurrences.insertSchema;

/** The shape `core/` reasons about, narrowed from the stored row. */
const toCore = (o: Occurrence): OccurrenceRow => ({
  id: o.id,
  dueAt: o.dueAt,
  firedAt: o.firedAt ?? null,
  clearedAt: o.clearedAt ?? null,
});

export async function readOccurrences(
  db: AnySqliteDb,
  alarmId: number,
): Promise<OccurrenceRow[]> {
  const rows = await db.select().from(occurrences).where(eq(occurrences.alarmId, alarmId));
  return rows.map((r: unknown) => toCore(row.parse(r)));
}

/**
 * Create the occurrences a horizon calls for.
 *
 * Idempotent by constraint as well as by caller: `(alarm_id, due_at)` is unique, so a double
 * reconcile cannot produce two rows for the same firing even if the caller asks twice.
 */
export async function materialise(
  db: AnySqliteDb,
  alarmId: number,
  dueAts: readonly number[],
  now: number,
): Promise<void> {
  for (const dueAt of dueAts) {
    const values = insert.parse({ alarmId, dueAt, createdAt: now });
    await db.insert(occurrences).values(values).onConflictDoNothing();
  }
}

/**
 * Record that an alarm rang.
 *
 * Written when the alarm fires rather than when it is cleared, because the whole point is to
 * distinguish "did not ring" from "rang and was dealt with". A row with no `fired_at` past its due
 * time is a miss (D29), and that inference only works if firing is recorded at the time.
 */
export async function recordFired(db: AnySqliteDb, id: number, at: number): Promise<void> {
  await db.update(occurrences).set({ firedAt: at }).where(eq(occurrences.id, id));
}

/** Record how an occurrence ended. */
export async function recordCleared(
  db: AnySqliteDb,
  id: number,
  at: number,
  outcome: OccurrenceOutcome,
): Promise<void> {
  await db.update(occurrences).set({ clearedAt: at, outcome }).where(eq(occurrences.id, id));
}

/**
 * Occurrences that were due, never fired and never cleared — inferred lazily (D29).
 *
 * Bounded by `now` in SQL rather than in memory, so a long history does not have to be loaded to
 * answer "did I oversleep". The partial index on `due_at where fired_at is null` serves this.
 */
export async function readMissed(db: AnySqliteDb, now: number): Promise<OccurrenceRow[]> {
  const rows = await db
    .select()
    .from(occurrences)
    .where(and(lt(occurrences.dueAt, now), isNull(occurrences.firedAt), isNull(occurrences.clearedAt)));
  return rows.map((r: unknown) => toCore(row.parse(r)));
}

/** Unresolved occurrences still in the future — what reconcile schedules and an edit invalidates. */
export async function readPending(db: AnySqliteDb, now: number): Promise<OccurrenceRow[]> {
  const rows = await db
    .select()
    .from(occurrences)
    .where(and(gte(occurrences.dueAt, now), isNull(occurrences.firedAt), isNull(occurrences.clearedAt)));
  return rows.map((r: unknown) => toCore(row.parse(r)));
}

/**
 * Delete unresolved future occurrences for an alarm.
 *
 * Used when an alarm is edited, disabled, or the timezone moves. Resolved rows are never touched —
 * they are the history, and the only evidence when a night went wrong.
 */
export async function invalidateFuture(
  db: AnySqliteDb,
  alarmId: number,
  now: number,
): Promise<number> {
  const doomed = await db
    .select()
    .from(occurrences)
    .where(
      and(
        eq(occurrences.alarmId, alarmId),
        gte(occurrences.dueAt, now),
        isNull(occurrences.firedAt),
      ),
    );
  for (const o of doomed as { id: number }[]) {
    await db.delete(occurrences).where(eq(occurrences.id, o.id));
  }
  return doomed.length;
}
