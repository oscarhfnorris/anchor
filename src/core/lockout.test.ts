/**
 * The settings freeze (D7).
 *
 * The window is deliberately symmetric. Freezing only *before* the alarm would leave the hour after
 * it wide open, which is when a half-awake person turns tomorrow's alarm off — the same decision
 * D7 exists to take away from them.
 */
import { describe, expect, it } from 'vitest';

import { FREEZE_WINDOW_MS, isFrozen } from './lockout';
import type { Schedule } from './schedule';

const WAKE: Schedule = { hour: 7, minute: 0, weekdays: [0, 1, 2, 3, 4, 5, 6] };
const local = (s: string) => new Date(s).getTime();

describe('isFrozen', () => {
  it('is open well before the alarm', () => {
    expect(isFrozen([WAKE], local('2026-03-10T20:00:00')).frozen).toBe(false);
  });

  it('freezes within the hour before (D7)', () => {
    expect(isFrozen([WAKE], local('2026-03-10T06:30:00')).frozen).toBe(true);
  });

  it('freezes within the hour after, which is when tomorrow gets switched off', () => {
    expect(isFrozen([WAKE], local('2026-03-10T07:30:00')).frozen).toBe(true);
  });

  it('is open again once the window has passed', () => {
    expect(isFrozen([WAKE], local('2026-03-10T08:30:00')).frozen).toBe(false);
  });

  it('reports when the freeze lifts, so the UI can say why rather than just refusing', () => {
    const result = isFrozen([WAKE], local('2026-03-10T06:30:00'));
    expect(result.until).toBe(local('2026-03-10T07:00:00') + FREEZE_WINDOW_MS);
  });

  it('freezes if any enabled schedule is inside its window', () => {
    const dock: Schedule = { hour: 22, minute: 30, weekdays: [0, 1, 2, 3, 4, 5, 6] };
    expect(isFrozen([WAKE, dock], local('2026-03-10T22:15:00')).frozen).toBe(true);
  });

  it('is never frozen by a schedule that can never fire', () => {
    expect(isFrozen([{ hour: 7, minute: 0, weekdays: [] }], Date.now()).frozen).toBe(false);
  });
});
