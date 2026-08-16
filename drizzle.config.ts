/**
 * Drizzle Kit configuration.
 *
 * `driver: 'expo'` makes `drizzle-kit generate` emit the migration bundle that `useMigrations`
 * expects on device. There is no `db:push` against a device, so the SQL is generated and committed
 * every time rather than applied live.
 */
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema/tables.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
