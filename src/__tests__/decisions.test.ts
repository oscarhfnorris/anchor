/**
 * Decisions not yet covered by a running test.
 *
 * D37 makes section 5 of the plan the checklist: a rule in `core/` without a test is unfinished, not
 * merely untested. `npm run check:rules` derives coverage by scanning test titles for decision
 * references, so this file is the human-readable to-do list rather than the source of that count —
 * renaming a stub here cannot make the number move.
 *
 * To fill one in: delete its stub and write the real test beside the code it covers, naming the
 * decision in the describe or it title so the checklist picks it up. Arrange a state, apply one
 * event with an explicit ctx, then assert the next state AND the emitted effects — asserting state
 * alone passes happily while the alarm silently never gets rescheduled.
 */
import { describe, it } from 'vitest';

describe('Phase 1 — still to build', () => {
  it.todo('D6 — Give-up is measured by absence of interaction, not motion sensing');
  it.todo('D27 — An alarm cannot be enabled without its clearing tag registered, and deleting a tag disable…');
  it.todo('D29 — A missed firing is inferred lazily: on launch, any occurrence past due with no fired_at is…');
  it.todo('D34 — Tags may be fixed or portable; a portable tag belongs to no place');
});

describe('Phase 2 — places and geofencing', () => {
  it.todo('D3 — Only a confirmed exit transition may silence a ringing alarm. A static "presence says away…');
  it.todo('D4 — unknown location is not away');
  it.todo('D9 — Outside every known place, Feature B degrades rather than disappears');
  it.todo('D12 — Leaving the active place while an alarm is alerting stops it — both features');
  it.todo('D13 — On return, the dock alarm resumes and the wake alarm does not');
  it.todo('D14 — A place\'s radius is user-configurable, floored at 100m');
  it.todo('D19 — While any alarm alerts, location runs at high accuracy, capped at a few minutes from first…');
  it.todo('D26 — A D12 stop of the wake alarm is provisional for a few minutes — a confirmed return inside…');
  it.todo('D33 — Features degrade per place according to the hardware installed there, and the app says so…');
});

describe('Phase 3 — the dock alarm', () => {
  it.todo('D21 — D7\'s freeze covers session duration and grace settings, not just alarm times');
});

describe('Phase 4 — sessions and proximity', () => {
  it.todo('D11 — The dock session is enforced by proximity');
  it.todo('D15 — The dock session persists across restart and force-quit');
  it.todo('D16 — A session ends on confirmed geofence exit, or a user-set duration from its start — whichev…');
  it.todo('D17 — A resumed or proximity-broken dock alarm vibrates and notifies first, sounding only after…');
  it.todo('D24 — Bluetooth off at dock time refuses to start a session; switched off mid-session it ends th…');
  it.todo('D28 — Clearing the wake alarm ends any open dock session');
  it.todo('D38 — Charging state vetoes a proximity alarm. If the phone is still charging, it has not been p…');
});

describe('not behavioural — no reducer test to write', () => {
  it.todo('D8 — no server — enforced by the absence of one');
  it.todo('D30 — structural: places exist at all');
  it.todo('D32 — structural: schedules are global, enforced by the schema');
  it.todo('D36 — process: every phase ends working');
  it.todo('D37 — process: this checklist is that rule');
});
