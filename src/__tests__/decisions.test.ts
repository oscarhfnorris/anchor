/**
 * The decision table as an executable checklist.
 *
 * D37 makes §5 of the plan the test checklist: a rule in `core/` without a test is unfinished, not
 * merely untested. This file is that checklist, written out so the unfinished part is visible
 * rather than remembered. A later phase implementing D16 finds its stub already waiting; a decision
 * with no stub here is one somebody forgot to carry across.
 *
 * **Filling one in.** Every stub becomes the same shape, so completing it is writing a body rather
 * than choosing a form — which is what keeps the golden traces of §15 consistent across phases
 * written weeks apart:
 *
 *     it('D12 — a confirmed exit while alerting stops the alarm', () => {
 *       const state: AlarmState = { kind: 'alerting', firstRangAt: 0, rearmCount: 0 };
 *       const ctx = context({ presence: 'away' });
 *       const next = reduce(state, { kind: 'presenceChanged', presence: 'away', corroborated: true }, ctx);
 *       expect(next.state.kind).toBe('stoodDown');
 *       expect(next.effects).toContainEqual({ kind: 'cancelAlarm' });
 *     });
 *
 * Arrange a state, apply one event with an explicit `ctx`, assert the next state *and* the emitted
 * effects. Asserting state alone passes while the alarm silently never gets scheduled.
 *
 * `context()` below is the shared arrange helper. It exists now so that the first real test does not
 * invent a private one, and every later test builds the same way — stating only the fields it cares
 * about.
 */
import { describe, it } from 'vitest';

import type { Context } from '../core/types';

/** A neutral `Context`; override only what a test is actually about. */
export function context(overrides: Partial<Context> = {}): Context {
  return {
    now: 0,
    presence: 'unknown',
    proximity: 'unknown',
    bluetoothEnabled: true,
    isCharging: false,
    stepsSinceAlertStart: null,
    stepThreshold: 15,
    registeredUids: [],
    ...overrides,
  };
}

describe('Tags and scanning', () => {
  it.todo('D1 — Tag identity is the hardware UID, never the NDEF payload');
  it.todo('D22 — A tag has exactly one role, everywhere. Registering a tag already bound to the other role is…');
  it.todo('D27 — An alarm cannot be enabled without its clearing tag registered, and deleting a tag disables t…');
  it.todo('D31 — A role accepts any of its registered UIDs, not one tag');
  it.todo('D34 — Tags may be fixed or portable; a portable tag belongs to no place');
  it.todo('D35 — For portable tags only, a scan is accepted after N steps since the alarm first rang (CMPedome…');
});

describe('Alarm lifecycle', () => {
  it.todo('D2 — Enforcement is re-arm, not block');
  it.todo('D5 — Feature A gives up; Feature B never does');
  it.todo('D6 — Give-up is measured by absence of interaction, not motion sensing');
  it.todo('D7 — Settings freeze ±1 hour around either alarm');
  it.todo('D18 — The re-arm delay shortens with each cycle, to a floor of ~10s');
  it.todo('D20 — There is an escape hatch: a long-press-and-hold override that cancels any alarm and any sessi…');
  it.todo('D21 — D7\'s freeze covers session duration and grace settings, not just alarm times');
  it.todo('D23 — Schedules are wall-clock local, and a session\'s duration is absolute elapsed time');
  it.todo('D25 — Every alarm occurrence records whether it actually fired, surfaced on the home screen');
  it.todo('D29 — A missed firing is inferred lazily: on launch, any occurrence past due with no fired_at is a…');
});

describe('Presence and geofence', () => {
  it.todo('D3 — Only a confirmed exit transition may silence a ringing alarm. A static "presence says away" r…');
  it.todo('D4 — unknown location is not away');
  it.todo('D9 — Outside every known place, Feature B degrades rather than disappears');
  it.todo('D12 — Leaving the active place while an alarm is alerting stops it — both features');
  it.todo('D13 — On return, the dock alarm resumes and the wake alarm does not');
  it.todo('D14 — A place\'s radius is user-configurable, floored at 100m');
  it.todo('D19 — While any alarm alerts, location runs at high accuracy, capped at a few minutes from first ring');
  it.todo('D26 — A D12 stop of the wake alarm is provisional for a few minutes — a confirmed return inside tha…');
  it.todo('D33 — Features degrade per place according to the hardware installed there, and the app says so at…');
});

describe('Dock session', () => {
  it.todo('D10 — The two features are independent');
  it.todo('D11 — The dock session is enforced by proximity');
  it.todo('D15 — The dock session persists across restart and force-quit');
  it.todo('D16 — A session ends on confirmed geofence exit, or a user-set duration from its start — whichever…');
  it.todo('D17 — A resumed or proximity-broken dock alarm vibrates and notifies first, sounding only after a u…');
  it.todo('D24 — Bluetooth off at dock time refuses to start a session; switched off mid-session it ends the s…');
  it.todo('D28 — Clearing the wake alarm ends any open dock session');
  it.todo('D38 — Charging state vetoes a proximity alarm. If the phone is still charging, it has not been pick…');
});

describe('not behavioural — no reducer stub', () => {
  it.todo('D8 — no server — enforced by the absence of one, not by a test');
  it.todo('D30 — structural: places exist at all');
  it.todo('D32 — structural: schedules are global, enforced by the schema');
  it.todo('D36 — process: every phase ends working');
  it.todo('D37 — process: this file is that rule');
});
