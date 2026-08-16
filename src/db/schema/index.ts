/**
 * Everything that describes the shape of the data.
 *
 * `tables.ts` is the Drizzle definitions and the bounds their CHECK constraints are built from.
 * `zod.ts` derives validation and row types from those same tables. They are one concern split
 * across two files only because one is the database's view and the other is the program's, so this
 * barrel is what the rest of the app imports.
 *
 * Operations live a level up, in `db/`. Nothing here reads or writes.
 */
export * from './tables';
export * from './zod';
