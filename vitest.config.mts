/**
 * Vitest configuration.
 *
 * Node environment, no jsdom: `core/` is pure logic and the database tests run against
 * `better-sqlite3`, so nothing in this suite needs a browser-shaped runtime. Adding one would slow
 * every run to serve tests that do not exist.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Schedules are wall-clock local (D23), so the DST tests need a fixed zone to be deterministic.
    // Without this they pass or fail depending on where the machine is.
    env: { TZ: 'Europe/London' },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
