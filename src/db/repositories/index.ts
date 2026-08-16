/**
 * The data layer's entry points.
 *
 * In the standard mobile layering — UI → domain → data — repositories are what the rest of the app
 * is allowed to touch, and the data sources behind them (here, one SQLite database) stay private to
 * this folder. Nothing outside `db/` should import `client.ts` or a table directly.
 *
 * Each function validates with the schema barrel in both directions: `selectSchema` on the way out,
 * `insert`/`updateSchema` on the way in. Rows outlive versions, so a database restored from an older
 * build can hand back a value TypeScript would otherwise believe.
 *
 * Business rules are not here. Whether an alarm may be enabled, when it fires, what a deletion
 * breaks — that is the domain layer, in `core/`. These ask and apply.
 */
export * from './alarms';
export * from './occurrences';
export * from './settings';
export * from './tags';
