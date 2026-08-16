# Progress

**Generated — do not edit by hand.** Run `npm run docs:progress` to refresh.

Every figure below is derived from the repo: decisions from the plan's own table, coverage from
scanning test titles, counts from the files on disk. A status doc maintained by hand is a promise
to update it later, and this project has already watched two documents drift from the code inside
a single day.

At a glance: **Phase 0 complete, Phase 1 partly built.** 15 of 38 decisions (39%) are
covered by a running test, across 123 tests in 13 files and 11 commits.

## Phases

| | Phase | Status | Notes |
| --- | --- | --- | --- |
| **0** | The template | Complete | Runs on device; migrations, round trip and build info verified |
| **1** | The alarm core | Partly built | All logic a fake can verify. Device steps blocked |
| **2** | Places and geofencing | Not started | Blocked by the fortnight gate, then Phase 1 |
| **3** | Feature A — the dock alarm | Not started | Needs Phase 2 |
| **4** | Sessions and proximity | Not started | Needs Phase 3, hardware, and nights of observation |

## What is blocked, and on what

None of these are matters of effort. Listing them here so "not done" never reads as "forgotten".

| Blocked | Why | Waiting on |
| --- | --- | --- |
| NFC read on device | Core NFC returns *Sandbox restriction* on a free Personal Team | Paid Apple Developer account |
| AlarmKit on device | Needs the `com.apple.developer.alarmkit` entitlement | Account, then an approval queue of unknown length |
| The AlarmKit bridge at all | `expo-alarm-kit`'s `configure()` wants an App Group | Account. May or may not be enforced in the simulator — unverified |
| Widget extension | Needs App Groups | Account |
| Phase 2 onward | §3 requires using Phase 1 for a fortnight first | A fortnight of actual mornings |

## Decision coverage

D37 makes the plan's decision table the test checklist: a rule in `core/` without a test is
unfinished, not merely untested. Coverage is measured by scanning test titles for decision
references, with comments stripped — describing how to test something does not count as testing it.

**15 / 38 covered.**

<details><summary>Covered</summary>

- **D1** — Tag identity is the hardware UID, never the NDEF payload
- **D2** — Enforcement is re-arm, not block
- **D5** — Feature A gives up; Feature B never does
- **D7** — Settings freeze ±1 hour around either alarm
- **D10** — The two features are independent
- **D18** — The re-arm delay shortens with each cycle, to a floor of ~10s
- **D20** — There is an escape hatch: a long-press-and-hold override that cancels any alarm and a…
- **D22** — A tag has exactly one role, everywhere. Registering a tag already bound to the other…
- **D23** — Schedules are wall-clock local, and a session's duration is absolute elapsed time
- **D25** — Every alarm occurrence records whether it actually fired, surfaced on the home screen
- **D27** — An alarm cannot be enabled without its clearing tag registered, and deleting a tag di…
- **D29** — A missed firing is inferred lazily: on launch, any occurrence past due with no fired_…
- **D31** — A role accepts any of its registered UIDs, not one tag
- **D34** — Tags may be fixed or portable; a portable tag belongs to no place
- **D35** — For portable tags only, a scan is accepted after N steps since the alarm first rang (…

</details>

<details><summary>Outstanding</summary>

- **D3** — Only a confirmed exit transition may silence a ringing alarm. A static "presence says…
- **D4** — unknown location is not away
- **D6** — Give-up is measured by absence of interaction, not motion sensing
- **D8** — Everything on-device. No server.
- **D9** — Outside every known place, Feature B degrades rather than disappears
- **D11** — The dock session is enforced by proximity
- **D12** — Leaving the active place while an alarm is alerting stops it — both features
- **D13** — On return, the dock alarm resumes and the wake alarm does not
- **D14** — A place's radius is user-configurable, floored at 100m
- **D15** — The dock session persists across restart and force-quit
- **D16** — A session ends on confirmed geofence exit, or a user-set duration from its start — wh…
- **D17** — A resumed or proximity-broken dock alarm vibrates and notifies first, sounding only a…
- **D19** — While any alarm alerts, location runs at high accuracy, capped at a few minutes from…
- **D21** — D7's freeze covers session duration and grace settings, not just alarm times
- **D24** — Bluetooth off at dock time refuses to start a session; switched off mid-session it en…
- **D26** — A D12 stop of the wake alarm is provisional for a few minutes — a confirmed return in…
- **D28** — Clearing the wake alarm ends any open dock session
- **D30** — There are many places, not one home. Every rule that said "the home region" means the…
- **D32** — Schedules are global; places carry hardware and geography only
- **D33** — Features degrade per place according to the hardware installed there, and the app say…
- **D36** — Every phase ends with a building, working app. No phase may leave it half-wired
- **D37** — Every business rule has a test. A rule in core/ without one is unfinished, not merely…
- **D38** — Charging state vetoes a proximity alarm. If the phone is still charging, it has not b…

</details>

## Modules

Tests are co-located, so a module with no test file beside it is visible here.

| Module | Co-located tests |
| --- | --- |
| `src/alarm/engine.fake.ts` | 9 |
| `src/alarm/types.ts` | — |
| `src/core/lockout.ts` | 7 |
| `src/core/occurrences.ts` | 15 |
| `src/core/registry.ts` | 9 |
| `src/core/schedule.ts` | 12 |
| `src/core/tags.ts` | 14 |
| `src/core/types.ts` | — |
| `src/core/wake/reducer.ts` | 19 |
| `src/db/client.ts` | — |
| `src/db/repositories/alarms.ts` | 3 |
| `src/db/repositories/index.ts` | — |
| `src/db/repositories/settings.ts` | 4 |
| `src/db/repositories/tags.ts` | 5 |
| `src/db/schema/index.ts` | — |
| `src/db/schema/tables.ts` | 6 |
| `src/db/schema/zod.ts` | 17 |
| `src/db/types.ts` | — |

## Tests

| File | Tests |
| --- | --- |
| `src/__tests__/db.test.ts` | 3 |
| `src/alarm/engine.fake.test.ts` | 9 |
| `src/core/lockout.test.ts` | 7 |
| `src/core/occurrences.test.ts` | 15 |
| `src/core/registry.test.ts` | 9 |
| `src/core/schedule.test.ts` | 12 |
| `src/core/tags.test.ts` | 14 |
| `src/core/wake/reducer.test.ts` | 19 |
| `src/db/repositories/alarms.test.ts` | 3 |
| `src/db/repositories/settings.test.ts` | 4 |
| `src/db/repositories/tags.test.ts` | 5 |
| `src/db/schema/tables.test.ts` | 6 |
| `src/db/schema/zod.test.ts` | 17 |
| **Total** | **123** |

