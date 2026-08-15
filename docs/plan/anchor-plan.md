# Anchor — plan

Status: **draft, pre-audit.** Nothing here is built. This document is the target of `/house-plan`
before any code exists.

---

## 1. The problem

Two failures at opposite ends of the same night:

1. **Getting up.** An alarm within arm's reach gets dismissed while unconscious.
2. **Getting to sleep.** The phone in bed pushes bedtime back indefinitely.

Both are solved by the same physical fact: **the phone is not where you are.** Anchor enforces that
with alarms that can only be silenced somewhere else in the room, or the house.

## 2. The loop

Two NFC tags, deliberately separated.

- **Tag A — the dock.** Across the room or in another room. Explicitly *not* the bedside table.
- **Tag B — the morning target.** Bathroom, kettle, front door.

| Time | Behaviour | Clears on |
| --- | --- | --- |
| Bedtime (e.g. 22:30) | Alarm rings — only if inside the home region | **Tag A** |
| Overnight | Phone rests at the dock | — |
| Wake (e.g. 07:00) | Alarm fires **at the dock**, across the room | **Tag B** |

**Why two tags.** If Tag A also cleared the morning alarm you would tap it while already standing at
the dock and return to bed. The morning alarm's job is to get you out of the bedroom, so the tag that
clears it must live outside the bedroom.

**Why the bedtime alarm is an alarm and not a reminder.** A notification is dismissible from bed. The
premise of the whole app is that the only accepted proof is physical presence at a specific object.

## 3. Prior art

Both halves exist separately. The pairing does not.

- **Morning NFC alarms** — crowded: Tagdawn, Chirp O'Clock, Moti (iOS); Sleep as Android, NFC Alarm
  Clock (Android).
- **Bedtime NFC-gated app blocking** — exists: Foqos, AppToken (iOS); UpDude (Android).
- **An alarm that rings until the phone is docked away from the bed** — no product found.

This is a personal-use tool first. Shipping is a possible later outcome, not a design constraint now.

## 4. Decisions already made

Each of these is load-bearing. Changing one changes the design.

| # | Decision | Why |
| --- | --- | --- |
| D1 | Tag identity is the **hardware UID**, never the NDEF payload | An NDEF payload copies onto a spare sticker kept under the pillow, defeating the premise |
| D2 | Enforcement is **re-arm**, not block | `stopButton` is deprecated in iOS 26.1 ("not used anymore"); the Stop button is system-owned and cannot be removed |
| D3 | Only the **bedtime** alarm is location-gated | A geofence glitch at 03:00 must never be able to cancel the alarm that wakes you |
| D4 | `unknown` location is **not** `away` | Treating no-fix-yet as absence silently cancels the alarm |
| D5 | Bedtime gives up after inactivity; **the wake alarm never gives up** | An alarm you can outlast is an alarm you learn to outlast |
| D6 | Give-up is measured by **absence of interaction**, not motion sensing | iOS exposes no "user unlocked the phone" API; pressing Stop already proves presence, and costs no permission |
| D7 | Settings freeze **±1 hour** around either alarm | Otherwise bedtime moves an hour later at 22:29 |
| D8 | Everything on-device. **No server.** | No account, no sync, no privacy surface, nothing to run |

## 5. Stack

Chosen to maximise transfer to the existing Next/T3 work, and because Expo's first-party agent
tooling is now good.

| Layer | Choice | Note |
| --- | --- | --- |
| Framework | Expo + TypeScript, **dev client** | Expo Go cannot load native modules; prebuild from day one |
| Routing | Expo Router | Same file-based mental model as the Next App Router |
| UI | NativeWind | Tailwind classes; carries the 4-point spacing discipline over |
| DB | Drizzle + `expo-sqlite` | Same ORM idiom as the existing repo |
| Alarm (iOS) | `expo-alarm-kit` or `react-native-nitro-ios-alarm-kit` | Community packages — pin exact versions |
| Alarm UI (iOS) | `@bacons/apple-targets` → widget extension | `AlarmAttributes` is an `ActivityAttributes`, so this is mandatory |
| NFC | `react-native-nfc-manager` | Covers both platforms |
| Geofence | `expo-location` + TaskManager | Covers both platforms |
| Payments (deferred) | RevenueCat | Only if this ever ships |

**Agent tooling, set up before the first line of code:** Expo Skills (`github.com/expo/skills`), the
Expo MCP server (`docs.expo.dev/mcp`), and `llms.txt` so docs come from current Expo rather than
model memory. SDK versions move fast enough that this matters more here than in a web repo.

## 6. Architecture

```
src/
  core/                  pure TS. imports nothing from expo-*, react-native, or react.
    engine.ts              the night state machine
    schedule.ts            next-occurrence arithmetic
    tags.ts                UID normalisation + role matching
    lockout.ts             the ±1h settings freeze
  alarm/
    types.ts               the AlarmEngine interface — the platform seam
    engine.ios.ts          AlarmKit
    engine.android.ts      deferred; stub that throws
  nfc/  geo/  db/          shared
  ui/                      NativeWind screens
targets/
  alarm-widget/            SwiftUI, iOS only
```

**`core/` importing nothing platform-specific is the rule the whole design rests on.** It is the only
part that encodes "can I cheat this?", it is the only part worth testing exhaustively, and it is the
only part an Android build would reuse rather than rewrite.

**The seam.** React Native resolves `.ios.ts` / `.android.ts` automatically — no DI framework. Adding
Android later means writing `engine.android.ts` plus one full-screen Activity, and touching nothing
else.

**Why the state machine can live in TypeScript.** Both platforms launch the app when an alarm is
dismissed (iOS via launch-on-dismissal, Android via the full-screen intent). JS is running by the
time the re-arm decision is needed. If that were not true the logic would have to be written twice in
two native languages and kept in sync forever.

## 7. State machine

States: `idle` → `bedtimeArmed` → `bedtimeAlerting` → `docked` → `wakeAlerting` → `released`, plus
`stoodDown(reason)` for a suppressed night.

Events: `tick`, `alarmFired`, `stopPressed`, `tagScanned`, `presenceChanged`.

The rules that matter:

- A scan is accepted only if the tag's **role matches the alarm currently ringing**. The dock tag
  presented to the morning alarm is rejected (D-decision: see §4 D1 rationale and §2).
- `stopPressed` on an unsatisfied alarm schedules a fresh alarm `rearmDelay` later. The original fire
  time is preserved across re-arms, so the give-up window measures from when the alarm *first* rang.
- `presenceChanged` may only affect `bedtimeArmed` / `bedtimeAlerting` / `stoodDown(awayFromHome)`.
  It must not touch `docked` or `wakeAlerting` (§4 D3).
- An empty scanned UID never matches, so a failed read cannot become a successful dismissal.

## 8. Data model

Four tables, SQLite via Drizzle. Kilobytes total.

- `tags` — id, role (`dock` | `morning`), uid (hex), label, registered lat/lon, created_at
- `schedules` — bedtime, wake, active weekdays, home region + radius, flags
- `nights` — history: armed/docked/released timestamps, stand-down reason
- `settings` — key/value

**One wrinkle.** The iOS widget extension runs in a separate process and cannot read the SQLite file.
The handful of values native code needs at alarm time go in an **App Group `UserDefaults`**, written
through the native module. `@bacons/apple-targets` configures the App Group.

## 9. Build order

1. Repo conventions + agent tooling (this commit).
2. Expo app scaffold, dev client, prebuild, NativeWind, Drizzle. Prove it runs on device.
3. `core/` + its tests, against a synthetic clock. No UI, no native.
4. NFC read → show a UID on screen. Proves the capability and the provisioning.
5. AlarmKit spike: schedule, fire, launch-on-dismissal. **The riskiest step — do it early.**
6. Widget extension.
7. Wire the loop end to end.
8. Geofence gating.
9. Settings lockout, history, UI polish.

Steps 4 and 5 are where this project most plausibly dies. Both are cheap spikes. Do them before
building anything that assumes they work.

## 10. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| NFC Tag Reading capability needs a **paid Apple Developer account** (~$99/yr) | Blocks everything | Confirm before step 2 |
| AlarmKit bridges are young community packages | High | Pin versions; be ready to fork; step 5 is a spike for exactly this |
| Launch-on-dismissal may be too slow or unreliable to re-arm | High | Measure in step 5; fallback is a custom Swift `LiveActivityIntent` |
| App Review may reject an un-dismissible alarm | Medium, deferred | Tagdawn ships the same pattern; irrelevant until shipping |
| Force-quitting the app defeats re-arm | Accepted | Out of scope — the adversary is a sleepy user, not an attacker |
| Geofence exit events are coarse (≥100m, latency) | Low | Radius ≥150m; re-evaluate on foreground |

## 11. Deliberately out of scope

Named so the audit does not treat them as gaps:

- **Android.** The seam exists; the implementation is deferred entirely.
- **Overnight proximity / BLE beacon.** Once the phone is across the room the friction has done its
  job. Revisit only if retrieval turns out to be a real habit.
- **App blocking (FamilyControls).** Separate entitlement, weeks of Apple approval, and the physical
  separation is the actual mechanism.
- **Payments, accounts, sync, cloud.** No server is a decision (§4 D8), not an omission.
- **Snooze.** Possibly never. Deferred pending real use.

## 12. Open questions

1. Give-up window length — 20 minutes of no interaction? Untested guess.
2. Re-arm delay — 20s? Long enough to walk to the dock, short enough to be relentless.
3. What happens if the dock tag is scanned *before* bedtime? Early docking should probably be
   allowed and should cancel the pending alarm.
4. What happens on a night where the wake alarm is never cleared — does the next bedtime still arm?
