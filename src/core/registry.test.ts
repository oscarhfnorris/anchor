/**
 * The registry rules (D27), tested without a database.
 *
 * That is the whole reason they moved out of `db/`: whether an alarm may be enabled is a rule about
 * when an alarm can fire and clear, so it belongs where rules live and can be checked without a
 * schema, a migration or a driver.
 */
import { describe, expect, it } from 'vitest';

import { alarmsLeftUnclearable, canEnable, CLEARING_ROLE, hasClearingTag } from './registry';
import type { RegisteredTag } from './tags';

const morning: RegisteredTag = { uid: '04a2b3c4', role: 'morning', portable: true };
const kitchen: RegisteredTag = { uid: '04ffee11', role: 'morning', portable: false };
const dockTag: RegisteredTag = { uid: 'deadbeef', role: 'dock', portable: false };

describe('D27 — which alarms may be enabled', () => {
  it('maps each alarm to the role that clears it, never the other way round', () => {
    expect(CLEARING_ROLE).toEqual({ dock: 'dock', wake: 'morning' });
  });

  it('refuses the wake alarm with no morning tag', () => {
    expect(canEnable('wake', [])).toEqual({ ok: false, reason: 'noClearingTag' });
    expect(canEnable('wake', [dockTag])).toEqual({ ok: false, reason: 'noClearingTag' });
  });

  it('allows it once any morning tag exists (D31)', () => {
    expect(canEnable('wake', [morning])).toEqual({ ok: true });
    expect(canEnable('wake', [kitchen])).toEqual({ ok: true });
  });

  it('judges each feature independently (D10)', () => {
    expect(hasClearingTag('wake', [dockTag])).toBe(false);
    expect(hasClearingTag('dock', [dockTag])).toBe(true);
  });
});

describe('D27 — what a deletion breaks', () => {
  it('names the alarm left with nothing to clear it', () => {
    expect(alarmsLeftUnclearable(morning.uid, [morning], ['wake'])).toEqual(['wake']);
  });

  it('leaves it alone while another tag of that role remains (D31)', () => {
    expect(alarmsLeftUnclearable(morning.uid, [morning, kitchen], ['wake'])).toEqual([]);
  });

  it('never reports an alarm that was already disabled', () => {
    expect(alarmsLeftUnclearable(morning.uid, [morning], [])).toEqual([]);
  });

  it('does not disturb the other feature (D10)', () => {
    const tags = [morning, dockTag];
    expect(alarmsLeftUnclearable(morning.uid, tags, ['wake', 'dock'])).toEqual(['wake']);
  });

  it('reports both when the deleted tag was the last of its role for each', () => {
    // A tag has one role (D22), so this is only reachable if both alarms are already unclearable —
    // which is exactly the state the invariant must not leave behind.
    expect(alarmsLeftUnclearable('nothing', [], ['wake', 'dock'])).toEqual(['wake', 'dock']);
  });
});
