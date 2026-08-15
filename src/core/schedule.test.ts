/**
 * Wall-clock schedule arithmetic (D23).
 *
 * The DST tests are the point of this file. "The alarm shifted by an hour twice a year" is the
 * classic alarm-app bug, it is silent, and it is only noticed by being woken at the wrong time —
 * which is exactly the class of failure that cannot be caught by using the app.
 *
 * These run in Europe/London (set in vitest.config.mts) so the transitions are deterministic.
 */
import { describe, expect, it } from 'vitest';

import { horizon, nextOccurrence, type Schedule } from './schedule';

const EVERY_DAY: Schedule = { hour: 7, minute: 0, weekdays: [0, 1, 2, 3, 4, 5, 6] };
const WEEKDAYS: Schedule = { hour: 7, minute: 0, weekdays: [1, 2, 3, 4, 5] };

/** Local wall-clock time as an instant, so tests read as the clock in the room. */
const local = (s: string) => new Date(s).getTime();

describe('nextOccurrence', () => {
  it('finds later today when the time has not passed', () => {
    const at = nextOccurrence(EVERY_DAY, local('2026-03-10T06:00:00'));
    expect(at).toBe(local('2026-03-10T07:00:00'));
  });

  it('rolls to tomorrow once the time has passed', () => {
    const at = nextOccurrence(EVERY_DAY, local('2026-03-10T08:00:00'));
    expect(at).toBe(local('2026-03-11T07:00:00'));
  });

  it('fires exactly at the boundary instant', () => {
    const at = nextOccurrence(EVERY_DAY, local('2026-03-10T07:00:00'));
    expect(at).toBe(local('2026-03-10T07:00:00'));
  });

  it('skips inactive weekdays', () => {
    // 2026-03-14 is a Saturday; weekdays-only should land on Monday the 16th.
    const at = nextOccurrence(WEEKDAYS, local('2026-03-14T09:00:00'));
    expect(at).toBe(local('2026-03-16T07:00:00'));
  });

  it('returns null when no weekday is active rather than guessing', () => {
    expect(nextOccurrence({ hour: 7, minute: 0, weekdays: [] }, Date.now())).toBeNull();
  });

  describe('DST (D23) — the wall clock wins, not the elapsed hour', () => {
    it('still fires at 07:00 local on the spring-forward day', () => {
      // BST begins 2026-03-29; the clocks jump 01:00 -> 02:00.
      const at = nextOccurrence(EVERY_DAY, local('2026-03-28T09:00:00'));
      expect(new Date(at!).getHours()).toBe(7);
      expect(new Date(at!).getDate()).toBe(29);
    });

    it('still fires at 07:00 local on the autumn-back day', () => {
      // GMT resumes 2026-10-25; the clocks fall 02:00 -> 01:00.
      const at = nextOccurrence(EVERY_DAY, local('2026-10-24T09:00:00'));
      expect(new Date(at!).getHours()).toBe(7);
      expect(new Date(at!).getDate()).toBe(25);
    });

    it('spans a 23-hour day rather than a fixed 24 hours', () => {
      // Start before the 28th's alarm so the pair straddles the transition: 28th 07:00 GMT to
      // 29th 07:00 BST. Both remain 07:00 on the clock; only the elapsed time differs.
      const before = nextOccurrence(EVERY_DAY, local('2026-03-27T09:00:00'))!;
      const after = nextOccurrence(EVERY_DAY, before + 60_000)!;
      expect(after - before).toBe(23 * 60 * 60 * 1000);
    });

    it('spans a 25-hour day when the clocks go back', () => {
      const before = nextOccurrence(EVERY_DAY, local('2026-10-23T09:00:00'))!;
      const after = nextOccurrence(EVERY_DAY, before + 60_000)!;
      expect(after - before).toBe(25 * 60 * 60 * 1000);
    });
  });
});

describe('horizon', () => {
  it('materialises several occurrences ahead, oldest first', () => {
    const out = horizon(EVERY_DAY, local('2026-03-10T08:00:00'), 3);
    expect(out).toEqual([
      local('2026-03-11T07:00:00'),
      local('2026-03-12T07:00:00'),
      local('2026-03-13T07:00:00'),
    ]);
  });

  it('is empty when the schedule can never fire', () => {
    expect(horizon({ hour: 7, minute: 0, weekdays: [] }, Date.now())).toEqual([]);
  });

  it('skips inactive days while filling the horizon', () => {
    const out = horizon(WEEKDAYS, local('2026-03-13T08:00:00'), 2);
    expect(out).toEqual([local('2026-03-16T07:00:00'), local('2026-03-17T07:00:00')]);
  });
});
