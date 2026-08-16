/**
 * The occurrence lifecycle and reconciliation (D25, D29, D23, §12).
 *
 * The cases that earn their place are the silent ones: a phone off overnight, an edit that leaves
 * the old instant scheduled, and a future row reported as a miss the moment it is created. None
 * would fail loudly — each just means the alarm does the wrong thing on a morning nobody is
 * watching.
 */
import { describe, expect, it } from 'vitest';

import {
  invalidatedByChange,
  reissueAll,
  missedOccurrences,
  missingOccurrences,
  occurrenceAlarmId,
  reconcile,
  type OccurrenceRow,
} from './occurrences';
import type { Schedule } from './schedule';

const EVERY_DAY: Schedule = { hour: 7, minute: 0, weekdays: [0, 1, 2, 3, 4, 5, 6] };
const local = (s: string) => new Date(s).getTime();
const row = (over: Partial<OccurrenceRow> & { id: number; dueAt: number }): OccurrenceRow => ({
  firedAt: null,
  clearedAt: null,
  ...over,
});

describe('materialising the horizon (D29)', () => {
  it('proposes several occurrences ahead, not just the next one', () => {
    const missing = missingOccurrences(EVERY_DAY, [], local('2026-03-10T08:00:00'));
    expect(missing).toEqual([
      local('2026-03-11T07:00:00'),
      local('2026-03-12T07:00:00'),
      local('2026-03-13T07:00:00'),
    ]);
  });

  it('survives a phone that was off overnight — tomorrow is already scheduled', () => {
    // Only the next occurrence exists. If the horizon were one deep, a night powered off would
    // leave nothing scheduled and the alarm would stay dead until the app was opened.
    const existing = [row({ id: 1, dueAt: local('2026-03-11T07:00:00') })];
    const missing = missingOccurrences(EVERY_DAY, existing, local('2026-03-10T08:00:00'));
    expect(missing).toContain(local('2026-03-12T07:00:00'));
  });

  it('is idempotent — re-running proposes nothing new', () => {
    const now = local('2026-03-10T08:00:00');
    const first = missingOccurrences(EVERY_DAY, [], now);
    const existing = first.map((dueAt, i) => row({ id: i + 1, dueAt }));
    expect(missingOccurrences(EVERY_DAY, existing, now)).toEqual([]);
  });
});

describe('inferring a miss (D25, D29)', () => {
  it('reports a past-due occurrence that never fired', () => {
    const existing = [row({ id: 1, dueAt: local('2026-03-09T07:00:00') })];
    expect(missedOccurrences(existing, local('2026-03-10T08:00:00'))).toHaveLength(1);
  });

  it('does not report a future occurrence, which would cry wolf every launch', () => {
    const existing = [row({ id: 1, dueAt: local('2026-03-11T07:00:00') })];
    expect(missedOccurrences(existing, local('2026-03-10T08:00:00'))).toEqual([]);
  });

  it('does not report one that fired', () => {
    const existing = [row({ id: 1, dueAt: local('2026-03-09T07:00:00'), firedAt: 1 })];
    expect(missedOccurrences(existing, local('2026-03-10T08:00:00'))).toEqual([]);
  });

  it('does not report one cleared without a recorded firing', () => {
    const existing = [row({ id: 1, dueAt: local('2026-03-09T07:00:00'), clearedAt: 1 })];
    expect(missedOccurrences(existing, local('2026-03-10T08:00:00'))).toEqual([]);
  });
});

describe('invalidation on edit or timezone change (D23)', () => {
  it('invalidates unresolved future rows, so a new time is not merely cosmetic', () => {
    const now = local('2026-03-10T08:00:00');
    const existing = [
      row({ id: 1, dueAt: local('2026-03-09T07:00:00'), firedAt: 1 }),
      row({ id: 2, dueAt: local('2026-03-11T07:00:00') }),
      row({ id: 3, dueAt: local('2026-03-12T07:00:00') }),
    ];
    expect(invalidatedByChange(existing, now).map((o) => o.id)).toEqual([2, 3]);
  });

  it('leaves history alone — resolved rows are the only evidence when a night went wrong', () => {
    const existing = [row({ id: 1, dueAt: local('2026-03-09T07:00:00'), firedAt: 1 })];
    expect(invalidatedByChange(existing, local('2026-03-10T08:00:00'))).toEqual([]);
  });
});

describe('reconciliation (§12)', () => {
  const now = local('2026-03-10T08:00:00');
  const future = row({ id: 7, dueAt: local('2026-03-11T07:00:00') });

  it('schedules an intent the OS does not hold', () => {
    const plan = reconcile([future], [], now);
    expect(plan.schedule).toEqual([{ id: occurrenceAlarmId(7), at: future.dueAt }]);
    expect(plan.cancel).toEqual([]);
  });

  it('is idempotent — running twice asks for nothing the second time', () => {
    expect(reconcile([future], [occurrenceAlarmId(7)], now)).toEqual({ schedule: [], cancel: [] });
  });

  it('cancels an alarm the OS holds that intent no longer wants', () => {
    const plan = reconcile([], [occurrenceAlarmId(99)], now);
    expect(plan.cancel).toEqual([occurrenceAlarmId(99)]);
  });

  it('treats a moved time as a new id, since the bridge cannot report instants', () => {
    // An edit invalidates the old occurrence and creates a new row, so reconcile cancels the stale
    // id and schedules the new one — it never has to notice that an instant changed.
    const replacement = row({ id: 8, dueAt: future.dueAt + 1_800_000 });
    const plan = reconcile([replacement], [occurrenceAlarmId(7)], now);
    expect(plan.schedule).toEqual([{ id: occurrenceAlarmId(8), at: replacement.dueAt }]);
    expect(plan.cancel).toEqual([occurrenceAlarmId(7)]);
  });

  it('re-issues everything when the bridge cannot enumerate what it holds', () => {
    expect(reissueAll([future], now)).toEqual({
      schedule: [{ id: occurrenceAlarmId(7), at: future.dueAt }],
      cancel: [],
    });
  });

  it('never re-schedules a past or already-resolved occurrence', () => {
    const past = row({ id: 1, dueAt: local('2026-03-09T07:00:00') });
    const cleared = row({ id: 2, dueAt: local('2026-03-11T07:00:00'), clearedAt: 5 });
    expect(reconcile([past, cleared], [], now).schedule).toEqual([]);
  });
});
