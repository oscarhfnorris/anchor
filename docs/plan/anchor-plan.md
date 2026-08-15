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

## 2. Two features, not one flow

**This is the structural decision the rest of the design follows from.** Bedtime and morning are two
independent alarms, each configured like a normal alarm app — its own time, its own weekdays, its own
enable switch. Neither depends on the other having run.

### Feature A — Dock (evening)

| | |
| --- | --- |
| Fires | At its scheduled time, only when inside the home region |
| Cleared by | **Tag A — the dock.** Across the room or in another room. Explicitly *not* the bedside table |
| Then | The **dock session** begins: the phone must stay at the dock |
| Gives up | After a period of no interaction at all |

### Feature B — Wake (morning)

| | |
| --- | --- |
| Fires | At its scheduled time, wherever the phone is |
| Cleared by | **Tag B — the morning target.** Bathroom, kettle, front door |
| Away from home | Degrades to a normal dismissible alarm (see §4 D9) |
| Gives up | **Never** |

**Why two tags.** If Tag A also cleared the morning alarm you would tap it while already standing at
the dock and return to bed. The morning alarm's job is to get you out of the bedroom, so the tag that
clears it must live outside the bedroom.

**Why the evening one is an alarm and not a reminder.** A notification is dismissible from bed. The
premise of the app is that the only accepted proof is physical presence at a specific object.

**The one seam between the features.** Proximity enforcement must be suspended while the wake alarm
is alerting, or carrying the phone to Tag B would trigger a "phone left the dock" alarm. This is the
single point where the two features touch. It is named here rather than hidden because getting it
wrong produces an alarm at exactly the wrong moment.

### Leaving while an alarm is ringing

**A confirmed exit from the home region stops any alarm currently alerting.** Both features. If you
have left the house, the tag that would clear the alarm is unreachable, and a phone screaming in
public with no way to silence it is a worse outcome than a missed enforcement.

Two conditions make this safe rather than a loophole:

- **The exit must be confirmed, not merely reported.** A region-exit event alone is not enough — GPS
  drifts indoors, and a spurious exit at 07:00 would silently cancel the alarm and let you oversleep.
  Corroborate with a fresh fix showing real distance beyond the radius. **If the fix is unavailable
  or ambiguous, keep ringing.** This is the same bias as everywhere else in the app except proximity.
- **Re-entering resumes it.** If the alarm's active window has not expired, returning inside the
  region brings the alarm back. Without this, "walk out of the front door and back" is a complete
  bypass of the entire app.

**Why stepping outside is not a shortcut.** The home radius is at least 150m and iOS debounces exit
events. Satisfying this deliberately means walking a hundred-odd metres down the street, in the
state you woke up in, with the alarm going the whole way — and then it resumes when you come back.
That is strictly more effort than walking to the bathroom, which is the entire point.

## 3. Prior art

Both halves exist separately. The pairing does not.

- **Morning NFC alarms** — crowded: Tagdawn, Chirp O'Clock, Moti (iOS); Sleep as Android, NFC Alarm
  Clock (Android).
- **Bedtime NFC-gated app blocking** — exists: Foqos, AppToken (iOS); UpDude (Android).
- **An alarm that rings until the phone is docked away from the bed, and keeps it there** — no
  product found.

Personal-use tool first. Shipping is a possible later outcome, not a design constraint now.

## 4. Decisions already made

Each is load-bearing. Changing one changes the design.

| # | Decision | Why |
| --- | --- | --- |
| D1 | Tag identity is the **hardware UID**, never the NDEF payload | A payload copies onto a spare sticker kept under the pillow, defeating the premise |
| D2 | Enforcement is **re-arm**, not block | `stopButton` is deprecated in iOS 26.1 ("not used anymore"); the Stop button is system-owned and cannot be removed |
| D3 | Only a **confirmed exit transition** may silence a ringing alarm. A static "presence says away" reading may not, and `unknown` never may | A geofence glitch at 03:00 must not be able to cancel the alarm that wakes you. Requiring a corroborated transition keeps that protection while allowing the deliberate case (D12) |
| D4 | `unknown` location is **not** `away` | Treating no-fix-yet as absence silently weakens enforcement |
| D5 | Feature A gives up; **Feature B never does** | An alarm you can outlast is an alarm you learn to outlast |
| D6 | Give-up is measured by **absence of interaction**, not motion sensing | iOS exposes no "user unlocked the phone" API; pressing Stop already proves presence, and costs no permission |
| D7 | Settings freeze **±1 hour** around either alarm | Otherwise bedtime moves an hour later at 22:29 |
| D8 | Everything on-device. **No server.** | No account, no sync, no privacy surface, nothing to run |
| D9 | Away from home, Feature B **degrades rather than disappears** | Tag B is at home and unreachable. Suppressing the alarm means oversleeping; keeping it un-clearable means an alarm with no off switch |
| D10 | The two features are **independent** | Each is configured like a normal alarm. Feature B fires whether or not you docked last night |
| D11 | The dock session is **enforced by proximity**, not trust | Without it, early docking and "tap then pick it back up" are open loopholes |
| D12 | Leaving the home region while an alarm is alerting **stops it** — both features | The clearing tag is unreachable once you have left, and a phone screaming in public with no off switch is worse than a missed enforcement |
| D13 | Re-entering the region **resumes** a D12-stopped alarm, if its window has not expired | Otherwise "step outside and come back" bypasses the entire app |

## 5. The dock session

Scanning Tag A starts a dock session — whether the alarm summoned you or you docked early.

**Early docking is allowed and encouraged.** Scanning Tag A before the scheduled time cancels the
pending alarm and starts the session immediately. Going to bed early should never be punished.

**During the session**, a BLE beacon at the dock is monitored. If the phone leaves the beacon's range
and stays gone past a debounce window, the dock alarm resumes. This is what makes early docking safe:
without it, docking at 20:00 and retrieving the phone at 20:05 defeats the whole feature.

**The session ends** at a configured "docked until" time, defaulting to Feature B's alarm time but
stored independently (the features are independent — see D10). Proximity is also suspended while
Feature B is alerting (§2).

**Proximity runs only while at home.** Outside the home region there is no dock and nothing to
enforce.

### Why this is the riskiest part of the design

A proximity false positive is an alarm at 03:00 for no reason — **worse than the problem the app
exists to solve.** The failure modes are real and must be designed for, not discovered:

| Mode | Detection difficulty | Handling |
| --- | --- | --- |
| Beacon battery dies mid-night | Silent — indistinguishable from "phone moved" | Warn on weakening signal; verify the beacon is visible *at dock time* and refuse to start a session without it |
| BLE flapping at low TX power | Silent | Debounce: require N consecutive seconds of absence, not a single missed advertisement |
| Bluetooth switched off | Detectable | Treat as `unknown`, never as "phone left" |
| Phone at the edge of range | Silent | Tune beacon TX power so the boundary is well inside the room, not at the doorway |

**The bias throughout is toward silence.** Where proximity state is uncertain, do not ring. This is
the opposite of the bias everywhere else in the app, and deliberately so: a missed enforcement costs
one night's discipline, a false positive costs a night's sleep and the user's trust in the app.

## 6. Stack

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
| Proximity | `react-native-beacon-radar` | iBeacon, Expo-compatible in a dev build, has background scanning |
| Geofence | `expo-location` + TaskManager | Covers both platforms |
| Payments (deferred) | RevenueCat | Only if this ever ships |

**Hardware:** two NFC tags (NTAG215 stickers are fine) plus **one powered BLE beacon** with
adjustable TX power at the dock. The adjustability is not optional — a stock beacon reaches 10–70m,
which would cover the whole flat and enforce nothing.

**Agent tooling, set up before the first line of code:** Expo Skills (`github.com/expo/skills`), the
Expo MCP server (`docs.expo.dev/mcp`), and `llms.txt` so docs come from current Expo rather than
model memory.

## 7. Architecture

```
src/
  core/                  pure TS. imports nothing from expo-*, react-native, or react.
    dock/                  Feature A — schedule, alerting, session rules
    wake/                  Feature B — schedule, alerting, degradation
    tags.ts                UID normalisation + role matching
    schedule.ts            next-occurrence arithmetic (shared)
    lockout.ts             the ±1h settings freeze
  alarm/
    types.ts               the AlarmEngine interface — the platform seam
    engine.ios.ts          AlarmKit
    engine.android.ts      deferred; stub that throws
  proximity/  nfc/  geo/  db/    shared services
  ui/                      NativeWind screens
targets/
  alarm-widget/            SwiftUI, iOS only
```

**`core/` importing nothing platform-specific is the rule the whole design rests on.** It is the only
part that encodes "can I cheat this?", the only part worth testing exhaustively, and the only part an
Android build would reuse rather than rewrite.

**`core/dock/` and `core/wake/` are siblings, not a pipeline.** They share the tag registry, the
schedule arithmetic, and the presence service — nothing else. The only cross-feature rule is the
proximity suspension in §2, and it lives at the boundary, explicitly.

**The seam.** React Native resolves `.ios.ts` / `.android.ts` automatically — no DI framework. Adding
Android later means writing `engine.android.ts` plus one full-screen Activity, and touching nothing
else.

**Why the logic can live in TypeScript.** Both platforms launch the app when an alarm is dismissed
(iOS via launch-on-dismissal, Android via the full-screen intent). JS is running by the time the
re-arm decision is needed. If that were not true the logic would have to be written twice in two
native languages and kept in sync forever.

## 8. Behaviour rules

Rules that matter, stated so a test can be written against each:

- A scan is accepted only if the tag's **role matches the alarm currently ringing**. The dock tag
  presented to the wake alarm is rejected.
- An empty or unreadable UID **never matches**, so a failed read cannot become a dismissal.
- `stopPressed` on an unsatisfied alarm schedules a fresh alarm `rearmDelay` later. The original fire
  time is preserved across re-arms, so the give-up window measures from when the alarm *first* rang.
- Presence may suppress Feature A entirely and may downgrade Feature B to dismissible.
- A **confirmed exit transition** while alerting stops the alarm (D12); re-entry resumes it inside
  its window (D13). A static `away` reading may not silence a ringing alarm, and `unknown` never may.
- An exit is confirmed only by a fresh fix showing real distance beyond the radius. An exit event
  that cannot be corroborated leaves the alarm ringing.
- Proximity may only resume the dock alarm during an active dock session, at home, while Feature B is
  not alerting.
- Uncertain proximity state never rings (§5).

## 9. Data model

SQLite via Drizzle. Kilobytes total.

- `tags` — id, role (`dock` | `morning`), uid (hex), label, registered lat/lon, created_at
- `alarms` — one row per feature: kind, time, active weekdays, enabled, feature-specific settings
- `home_region` — centre, radius
- `beacons` — uuid/major/minor, label, last_seen, last_rssi
- `sessions` — dock session history: started, ended, how it ended, proximity breaks
- `events` — alarm fired / stopped / scanned / stood down, for debugging why a night went wrong

**One wrinkle.** The iOS widget extension runs in a separate process and cannot read the SQLite file.
The handful of values native code needs at alarm time go in an **App Group `UserDefaults`**, written
through the native module. `@bacons/apple-targets` configures the App Group.

## 10. Build order

1. Repo conventions + agent tooling (done).
2. Expo app scaffold, dev client, prebuild, NativeWind, Drizzle. Prove it runs on device.
3. `core/` + its tests, against a synthetic clock. No UI, no native.
4. NFC read → show a UID on screen. Proves the capability and the provisioning.
5. **AlarmKit spike**: schedule, fire, launch-on-dismissal, re-arm. The riskiest step.
6. Widget extension.
7. Feature B end to end (wake → Tag B). Simpler of the two; ship it working before starting A.
8. Feature A without proximity (dock alarm → Tag A).
9. **Proximity spike**: beacon at low TX power, measure real flapping over several nights *with
   alarms disabled* before letting it ring anything.
10. Dock sessions + early docking.
11. Geofence gating and Feature B degradation.
12. Settings lockout, history, UI polish.

Steps 5 and 9 are where this project most plausibly dies. Both are cheap spikes. Do them before
building anything that assumes they work — and note step 9 runs in observation mode first, because
the cost of getting proximity wrong is being woken at 03:00.

## 11. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| NFC Tag Reading capability needs a **paid Apple Developer account** (~$99/yr) | Blocks everything | Confirm before step 2 |
| **Proximity false positive rings at 03:00** | Highest — worse than the original problem | Debounce, bias-to-silence, observation-only period in step 9 |
| **False geofence exit silently stops the wake alarm** → overslept | Highest, and silent | D3: exit must be corroborated by a fresh fix; ambiguous → keep ringing. This is the risk D12 reintroduces and must be measured, not assumed |
| AlarmKit bridges are young community packages | High | Pin versions; be ready to fork; step 5 is a spike for exactly this |
| Launch-on-dismissal too slow or unreliable to re-arm | High | Measure in step 5; fallback is a custom Swift `LiveActivityIntent` |
| Beacon battery dies silently mid-session | High | Verify beacon at dock time; warn on weakening signal |
| iOS background BLE scanning is throttled or unreliable | High | Region monitoring (enter/exit) rather than continuous ranging; step 9 measures the truth |
| Two native modules now (AlarmKit + beacons) | Medium | Both are Expo-dev-build compatible; neither works in Expo Go |
| App Review may reject an un-dismissible alarm | Medium, deferred | Tagdawn ships the same pattern; irrelevant until shipping |
| Force-quitting the app defeats re-arm | Accepted | Out of scope — the adversary is a sleepy user, not an attacker |

## 12. Testing and CI

**The constraint that shapes everything: the core behaviour cannot be automatically tested.** No CI
runner can tap an NFC tag, walk away from a beacon, or cross a geofence. There is no Playwright
equivalent here — Maestro and Detox drive the UI, not the physical world this app is about.

Three consequences:

1. **`core/` purity is not a style preference — it is the testability strategy.** `core/` is the only
   surface in the project that can be verified without sleeping. Every behaviour rule that lives
   outside it is a rule that will only ever be tested by experiencing it at 03:00.
2. **`core/` gets exhaustive unit tests** against a synthetic clock — vitest, one tier, no harness
   (the DB is a file, or `:memory:`).
3. **A night simulator is the highest-value testing investment in the project.** A dev screen that
   drives a whole night through the state machine in seconds with synthetic events: alarm fired,
   stop pressed, wrong tag scanned, beacon lost, geofence exited, phone restarted mid-session. It
   costs almost nothing precisely because `core/` is pure, and it is the only way to exercise the
   failure paths that matter without waiting for them to happen for real.

### Enforcing `core/` purity

An ESLint `no-restricted-imports` zone rule, failing hard — **not** an advisory scan. It is the one
convention whose violation silently destroys the architecture, and unlike most house rules it is
trivially detectable statically.

### What we take from approvals-app, and what we don't

| | |
| --- | --- |
| **Take** | The `check-house-rules.mjs` pattern (advisory scan, always exits 0, surfaces what would otherwise be re-taught in review) · SHA-pinned third-party actions · `actionlint` · `dependabot` (especially: the native packages are young and fragile) · vitest |
| **Later** | paths-filter and skip-duplicate-actions (scar tissue from a large repo; premature here) · knip |
| **Leave** | Docker · the Postgres test harness · pwsh · Playwright and visual tests · CODEOWNERS · preview-db, schema-review, Vercel workflows |

**Docker does not transfer.** The existing image is a long-lived Next worker host for Azure Container
Apps. Anchor has no server. More decisively, **iOS builds cannot run in a container at all** — they
need macOS and Xcode. The equivalent is EAS Build, or macOS runners at a 10× minute multiplier.

**pwsh does not transfer.** In approvals-app it orchestrates real infrastructure — Azure databases,
obfuscation, tenant copies — with Pester and PSScriptAnalyzer behind it. Anchor has no
infrastructure. The remaining scripting need is one house-rules checker, which node runs natively.

**Anchor needs one check approvals-app has no analogue for:** `expo-doctor`, which validates SDK and
native dependency compatibility. Given two young native modules, that is a real gate.

### CI shape (start here, grow later)

On every PR, on ubuntu: `type-check` · `lint` (including the `core/` purity rule) · `test` ·
`expo-doctor` · the advisory house-rules scan. **No device builds in CI initially** — macOS runners
are expensive and EAS on demand is enough for a solo project.

## 13. Deliberately out of scope

Named so the audit does not treat them as gaps:

- **Android.** The seam exists; the implementation is deferred entirely.
- **App blocking (FamilyControls).** Separate entitlement, weeks of Apple approval, and physical
  separation is the actual mechanism.
- **Payments, accounts, sync, cloud.** No server is a decision (D8), not an omission.
- **Snooze.** Possibly never. Deferred pending real use.

## 14. Open questions

1. **Give-up window** for Feature A — 20 minutes of no interaction? Untested guess.
2. **Should the re-arm delay escalate?** A flat 20s is the simple version; 20 → 15 → 10 makes
   stalling progressively worse. Unknown whether the added pressure is worth the added complexity.
3. **Proximity debounce window** — how many consecutive seconds of absence before the alarm resumes?
   Purely empirical; step 9 exists to answer it.
4. **Does a dock session survive a phone restart or app force-quit?** If not, the loophole is
   "restart the phone". If so, it needs state that outlives the process.
5. **What ends a dock session that was never properly ended** — phone died, beacon died, user was
   away? A session that never closes will corrupt the next night.
6. **Should Feature A be suppressed on nights Feature B is disabled** (e.g. no alarm tomorrow)? They
   are independent by D10, which argues no — but docking with no morning alarm may be unwanted.
7. **How long is the D13 resume window?** Leave at 07:00, return at 07:20 — does the wake alarm come
   back? At 09:00, presumably not. The boundary is undecided and it is the difference between a
   working rule and an exploitable one.
8. **How fast is a confirmed exit in practice?** D12 is only usable if a genuine departure silences
   the alarm within a minute or two. If iOS takes ten minutes to confirm, the rule is decorative and
   the alarm rings all the way down the street anyway. Measurable in build step 11.
