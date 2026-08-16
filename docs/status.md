# Where this is

Written by hand, because the part worth recording is *why* things are where they are, and that does
not come out of a script. The one number that rots is deliberately not asserted here — run
`npm run check:rules` for live decision coverage.

Last reviewed against the plan: after the data-layer restructure.

---

## The short version

**Phase 0 is complete and ran on a device. Phase 1's logic is complete; its device half cannot start
without a paid Apple account.** Everything buildable without that account is built.

The critical path is not code. It is £99 and an entitlement queue of unknown length.

## Phases

| | | State |
| --- | --- | --- |
| **0** | The template | **Complete.** Built, installed and launched on an iOS 26.5 simulator. Migration applied and a write/read round trip verified in the on-device database, not just in the UI |
| **1** | The alarm core | **Logic complete, device half blocked.** Every rule a test can honestly verify is written and tested. NFC, AlarmKit-on-device and the widget need the account |
| **2** | Places and geofencing | Not started. Gated behind Phase 1's fortnight of real use, which is deliberate (§3) |
| **3** | Feature A — the dock alarm | Not started. Needs Phase 2 |
| **4** | Sessions and proximity | Not started. Needs Phase 3, an ESP32, and one to two weeks of nights in observation mode |

## What exists

| Area | Modules |
| --- | --- |
| Domain (`core/`) | `tags` · `schedule` · `lockout` · `registry` · `occurrences` · `wake/reducer` · `types` |
| Platform seam (`alarm/`) | `types` (the `AlarmEngine` interface) · `engine.fake` |
| Data (`db/`) | `schema/tables` · `schema/zod` · `repositories/{alarms,tags,settings}` · `client` |
| UI (`app/`) | The status screen — Phase 1 grows this same route into the home screen |

## Decisions: what "covered" actually means

`check:rules` reports coverage by scanning test titles for decision references. **It counts a
decision as covered when any test names it, which overstates several of them** — a decision with two
halves is marked done when one half is tested and the other belongs to a later phase.

The honest breakdown:

### Fully covered — implemented and tested

| | Why it is genuinely done |
| --- | --- |
| **D1** UID identity | Normalisation, hex-only, empty never matches — in `core/`, in the repository, and refused by the insert schema so an unnormalised value cannot reach the table |
| **D7** settings freeze | Symmetric window, both sides of the alarm, with the reason surfaced so the UI can explain the refusal |
| **D10** feature independence | Asserted three ways: the reducer ignores the other feature's events, deleting a tag touches only its own alarm, and the schema permits one alarm per kind |
| **D18** shortening re-arm | Delay sequence, the floor, and that it never drops below the floor across fifty cycles |
| **D20** escape hatch | Cancels from any alerting state, never refused however many times used, and recorded so overuse is visible |
| **D22** one role per tag | Registration refuses a tag bound to the other role; the dock tag presented to the wake alarm is rejected as `wrongRole`, not `unknownTag` |
| **D27** clearing-tag invariant | Both halves — cannot enable without a tag, and deleting the last one disables the alarm *and reports which* |
| **D29** lazy miss inference | Past-due with no `fired_at` is a miss; a future occurrence is not, so the home screen cannot cry wolf every launch |
| **D31** any tag of the role | A second morning tag satisfies the alarm, and deleting one leaves the alarm enabled |
| **D35** step gate | Refuses a correct tag with a count of how many steps short, accepts at the threshold, and skips-but-says-so when the pedometer is unavailable |

### Partly covered — the untested half is a later phase

| | Tested | Not yet |
| --- | --- | --- |
| **D2** re-arm not block | The reducer reschedules rather than dismissing | Whether AlarmKit actually re-arms in time. That is build step 5's spike and a fake cannot answer it |
| **D5** B never gives up | The wake alarm survives 200 Stop presses | Feature A's give-up window — Phase 3 |
| **D23** wall-clock time | Schedules, including the 23- and 25-hour DST days | Session duration as absolute elapsed time — Phase 4 |
| **D25** records whether it fired | The reducer emits `recordOccurrence`, and the miss query reads it | Nothing writes to the `occurrences` table yet; there is no occurrences repository |
| **D34** fixed or portable | Portable, and that every tag is portable while places do not exist | Fixed tags — Phase 2, when a tag can have a place |

### Outstanding

Phase 2 owns D3, D4, D9, D12, D13, D14, D19, D26, D30, D33. Phase 3 owns D21. Phase 4 owns D11,
D15, D16, D17, D24, D28, D38. D6 is Feature A's give-up rule. D8, D32, D36 and D37 describe the
project rather than its runtime and have nothing to assert.

## What is blocked, and on what

None of this is a matter of effort.

| Blocked | Why | Waiting on |
| --- | --- | --- |
| NFC read | Core NFC returns *Sandbox restriction* on a free Personal Team | Paid Apple Developer account |
| AlarmKit on device | Needs the `com.apple.developer.alarmkit` entitlement | The account, then an approval queue of unknown length |
| The AlarmKit bridge at all | `expo-alarm-kit`'s `configure()` wants an App Group | The account. Whether the simulator tolerates one unprovisioned is unverified, and it undercuts the plan's claim that the spike is free |
| Widget extension | App Groups | The account |
| Phase 2 onward | §3's fortnight of real use, which is the mitigation for the plan's own highest-rated risk | Fourteen mornings |

## What the plan got wrong, and was corrected

Recorded because a plan that quietly stops matching reality is worse than no plan.

- **`Database.deserialize()` does not exist.** The test-harness design in §15 rested on it. Restoring
  a snapshot is `new Database(buffer)`.
- **NativeWind v4's setup would have broken the build.** SDK 57 needs v5, which uses PostCSS and
  `withNativewind(config)` with no `input` option.
- **The AlarmKit bridge reports ids, not instants.** `getAllAlarms(): string[]` means reconciliation
  can compare *which* alarms exist but never *when* the OS thinks they fire. The first reconcile
  implementation compared instants and was unimplementable against the real bridge.
- **The bridge numbers weekdays 1–7** where `Date#getDay` uses 0–6. Converted at the seam only.
- **`expo-alarm-kit` needs an App Group**, which the plan did not account for when calling the
  simulator spike free.
- **`getAllAlarms()` is a mirror, not the OS.** It lists keys the bridge wrote into App Group
  storage and never asks AlarmKit, so reconciliation compares intent against a second mirror rather
  than reality. Blind re-issue is therefore the primary strategy, not a fallback.
- **The alerting state was held in memory**, which iOS destroys on every alarm dismissal — so the
  re-arm delay would never have shortened and the step gate would have restarted on every press.
  Both silent. Now derived from stored occurrences and their event log.
- **Squashing migrations breaks an installed app.** Observed on the simulator: a regenerated `0000`
  fails against a database that already has the tables.

## Where the architecture moved

- Policy that had been written into the data layer (D27) moved to `core/`, where a rule about when an
  alarm can fire belongs and can be tested without a database.
- `db/` became a proper data layer: `schema/` describes the data, `repositories/` are its only entry
  points. Named for the standard mobile layering — UI, domain, data — rather than "services", which
  in mobile vocabulary means something else and invites domain logic back into the wrong place.
- Every repository validates with the drizzle-zod barrel in both directions, because rows outlive
  versions and a restored database can hand back a value TypeScript would otherwise believe.

## CI

Runs `npm run check:code` on every push and pull request, on ubuntu — the same command as locally,
because the moment the two diverge a green local run stops meaning anything. Third-party actions are
pinned to commit SHAs rather than tags, since a tag is mutable and a retagged action would run with
repository credentials.

No device builds: macOS runners cost roughly ten times the minutes, and everything worth gating is
platform-agnostic by construction. Device builds go through EAS on demand.

## Next

1. **Buy the account and apply for the AlarmKit entitlement.** The queue is the only unbounded wait
   in the project and it gates the step where this most plausibly dies.
2. **Run the AlarmKit spike** — it may work in the simulator; the App Group question decides that.
3. **Then Phase 1's device half**, and only then the fortnight.
