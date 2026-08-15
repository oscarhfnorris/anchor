# Anchor — plan

Status: **audited, pre-build.** Nothing here is built. This document converged through `/house-plan`
before any code exists; the decision table and §6 carry the findings.

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

**The exit must be confirmed, not merely reported.** A region-exit event alone is not enough — GPS
drifts indoors, and a spurious exit at 07:00 would silently cancel the alarm and let you oversleep.
Corroborate with a fresh fix showing real distance beyond the radius. **If the fix is unavailable or
ambiguous, keep ringing.** This is the same bias as everywhere else in the app except proximity.

**Confirmation is automatic, with no button to press.** While any alarm is alerting, location runs at
high accuracy continuously, and every re-arm cycle takes a fresh fix. A real departure is therefore
confirmed within seconds of the phone getting a clean reading, without the user doing anything.

Waiting on iOS's own region-exit debounce would leave the alarm ringing all the way down the street;
polling directly is what makes the rule usable rather than decorative.

**It must be bounded, because the wake alarm never gives up (D5).** "Only while an alarm sounds" is
not self-limiting: an unanswered wake alarm rings indefinitely, and continuous high-accuracy location
alongside it would drain the battery flat — on the one morning nobody is there to notice. Cap the
high-accuracy window at a few minutes from first ring, then fall back to coarse monitoring. A
departure that has not happened in the first few minutes is not the case this rule exists for.

**What happens on return differs by feature, because their success conditions differ.**

| | On confirmed exit | On return |
| --- | --- | --- |
| **Feature B — wake** | Stops for that occurrence | **Does not resume** |
| **Feature A — dock** | Stops | **Resumes**, inside its window |

The wake alarm exists to get you awake and out of the bedroom. Walking a hundred-plus metres from
the house proves that more comprehensively than scanning Tag B ever could — the alarm's goal is
already met, so bringing it back would be punishing success.

The dock alarm exists to get the phone onto the dock. Leaving the house does not achieve that at
all; the obligation is simply outstanding. So it resumes on return, and without that resume
"step out of the front door and back" would bypass the feature entirely.

**The radius is a difficulty dial, not just a geofence parameter.** It is user-configurable, floored
at 100m because iOS geofencing degrades below that. Setting it small makes the wake alarm cheaper to
escape; setting it large makes a genuine departure slower to register. The ±1h settings freeze (D7)
covers it, so it cannot be shrunk at 06:55.

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
| D13 | On return, the **dock alarm resumes** and the **wake alarm does not** | Their success conditions differ. Walking 150m from the house already proves you are awake and out of bed, so the wake alarm's goal is met. It does nothing to put the phone on the dock, so that obligation is still outstanding — and without the resume, "step outside and back" would bypass Feature A entirely |
| D14 | The home radius is **user-configurable**, floored at 100m | iOS geofencing degrades below 100m. Above that it is a difficulty dial: small is easier to escape, large is slower to register a real departure. D7's freeze stops it being shrunk at 06:55 |
| D15 | The dock session **persists across restart and force-quit** | Otherwise "restart the phone" is a one-step bypass |
| D16 | A session ends on **confirmed geofence exit, or a user-set duration** from its start — whichever first | It must not depend on Feature B's alarm time; B may be disabled entirely (D10). A session that never closes corrupts the following night |
| D17 | A **resumed or proximity-broken** dock alarm vibrates and notifies first, sounding only after a user-set delay unless docked | Coming home at 01:00 should not blast sleeping housemates. It also downgrades a 03:00 proximity false positive from a siren to a vibration — the best available mitigation for the project's highest risk |
| D18 | The re-arm delay **shortens with each cycle** | Stalling should get progressively worse, not stay comfortable |
| D19 | While any alarm alerts, location runs at **high accuracy**, capped at a few minutes from first ring | Makes D12 confirmation automatic with zero taps. The cap exists because D5 means an unanswered wake alarm rings forever, and unbounded GPS beside it would flatten the battery |
| D20 | There is an **escape hatch**: a long-press-and-hold override that cancels any alarm and any session outright, logged and rate-limited | Illness, emergencies, and a lost or unreadable Tag B otherwise leave an alarm that literally cannot be stopped. An app that can trap its user is worse than one that can be cheated |
| D21 | D7's freeze covers **session duration and grace settings**, not just alarm times, and settings are frozen outright while a session is open | Otherwise shortening the session to one hour at 01:00 ends it early — a clean bypass through a setting that is not an "alarm time" |
| D22 | The two tag roles must hold **distinct UIDs**; registering one tag to both is rejected | One tag in both roles voids the entire premise, and it is a plausible setup mistake rather than an attack |
| D23 | Schedules are **wall-clock local**, and a session's duration is **absolute elapsed time** | The alarm should fire at 07:00 on the clock in the room. Sessions must not gain or lose an hour at a DST boundary |
| D24 | Bluetooth off at dock time **refuses to start a session**; switched off mid-session it **ends the session and records it** | Bias-to-silence is correct for ringing, but silently unenforcing turns "toggle Bluetooth" into a one-tap bypass. Refuse loudly at the start rather than fail quietly at 03:00 |
| D25 | Every alarm occurrence records **whether it actually fired**, surfaced on the home screen | The worst failure is silent: a broken bridge means no alarm and no warning. An alarm app that fails quietly has actively harmed the user |
| D26 | A D12 stop of the **wake** alarm is **provisional** for a few minutes — a confirmed return inside that window resumes it. High-accuracy location **runs for at least this window**, overriding D19's cap | D13 removed the safety net, so a confident-but-wrong fix would kill the alarm permanently. The override matters: if D19 dropped to coarse first, the corrective fix would never arrive and the provisional window would be decorative |
| D27 | An alarm **cannot be enabled without its clearing tag registered**, and deleting a tag disables the alarm that depends on it | Otherwise the first night ends in an alarm nothing can clear. The deletion half matters just as much — the invariant is "an enabled alarm always has a way to be cleared", not merely a check at creation |
| D28 | Clearing the wake alarm **ends any open dock session** | Extends the §2 seam. Otherwise the session outlives the morning and carrying the phone to Tag B trips a dock alarm minutes after getting up |
| D29 | A missed firing is **inferred lazily**: on launch, any occurrence past due with no `fired_at` is a miss | If the bridge fails, the app is never launched, so nothing is running to record the failure at the time. Detection has to be retrospective or D25 does not work at all |

## 5. The dock session

Scanning Tag A starts a dock session — whether the alarm summoned you or you docked early.

**Early docking is allowed and encouraged.** Scanning Tag A before the scheduled time cancels the
pending alarm and starts the session immediately. Going to bed early should never be punished.

**During the session**, a BLE beacon at the dock is monitored. If the phone leaves the beacon's range
and stays gone past a debounce window, the dock alarm resumes. This is what makes early docking safe:
without it, docking at 20:00 and retrieving the phone at 20:05 defeats the whole feature.

**The session has a user-set duration** — X hours from the moment it starts. It ends when that
elapses, or on a confirmed exit from the home region, whichever comes first. It does **not** reference
Feature B's alarm time: the features are independent (D10), Feature B may be disabled entirely, and a
dock session must work with no morning alarm configured at all.

**The session survives a restart or a force-quit.** Start time and duration are persisted, and a cold
launch rehydrates any session still inside its window. Without this, "restart the phone" is a
one-step bypass of the whole feature.

**Proximity runs only while at home,** and is suspended from the moment Feature B starts alerting
until the session ends (§2) — clearing the wake alarm ends any open session outright (D28). Without
that, a session configured to run past the morning would trip a dock alarm minutes after you got up,
while the phone was in your hand on the way to Tag B. Outside the home region there is no dock and
nothing to enforce.

### The grace period

**A resumed or broken dock alarm does not start at full volume.** It vibrates and posts a notice
first, then sounds after a user-set delay — 30 seconds, 1 minute, 5 minutes — unless the phone is
docked in the meantime.

**It must be implemented as a scheduled alarm, not a background timer.** iOS grants roughly ten
seconds of execution after a beacon or region event — nowhere near a five-minute wait. So the grace
is: on the break, post the notification and immediately *schedule* an AlarmKit alarm for
`now + grace`, then cancel it if the phone docks in time. The waiting is the OS's job. A
`setTimeout` here would simply never fire, and the failure would be silent.

This exists so that coming home at 01:00 does not blast a house full of sleeping people for something
only the phone's owner cares about. The scheduled bedtime alarm has no grace; it fires at a time the
household already expects.

The grace also happens to be the best available mitigation for the project's highest risk. A
proximity false positive at 03:00 becomes a vibration and a notification rather than a siren, and if
the beacon reappears within the window nothing sounds at all. **Apply it to proximity breaks as well
as re-entry**, for exactly that reason.

### Why this is the riskiest part of the design

A proximity false positive is an alarm at 03:00 for no reason — **worse than the problem the app
exists to solve.** The failure modes are real and must be designed for, not discovered:

| Mode | Detection difficulty | Handling |
| --- | --- | --- |
| Beacon battery dies mid-night | Silent — indistinguishable from "phone moved" | Warn on weakening signal; verify the beacon is visible *at dock time* and refuse to start a session without it |
| BLE flapping at low TX power | Silent | Debounce: require N consecutive seconds of absence, not a single missed advertisement |
| Bluetooth switched off | Detectable | Never treat as "phone left" — but refuse to start a session without it, and end a running session if it goes off (D24). Silently unenforcing turns one toggle into a complete bypass |
| Phone at the edge of range | Silent | Tune beacon TX power so the boundary is well inside the room, not at the doorway |

**The bias throughout is toward silence.** Where proximity state is uncertain, do not ring. This is
the opposite of the bias everywhere else in the app, and deliberately so: a missed enforcement costs
one night's discipline, a false positive costs a night's sleep and the user's trust in the app.

## 6. Escape hatches, permissions, and degraded states

### The escape hatch (D20)

Feature B never gives up (D5) and is cleared only by Tag B. If Tag B is peeled off, lost, or simply
unreadable, the alarm rings **forever**, and the only exit is walking past the home radius. The same
trap catches genuine emergencies and illness.

So: a deliberate, awkward override — press and hold for several seconds — that cancels the current
alarm and any open session outright. It is logged and shown in history.

**It is never rate-limited to the point of refusal.** A hard cap would reinstate exactly the trap
this exists to remove: exhaust the week's allowance, lose Tag B, and there is no way out at all.
Overuse is discouraged by **escalating friction** — a longer hold, a confirmation, a visible count in
history — never by refusing. Friction is a deterrent; a locked door is a defect.

It also does not weaken Feature B, because the phone is across the room at the dock. Reaching it to
press and hold is precisely what the alarm was demanding.

**Where it lives is constrained by AlarmKit.** The alert surface exposes exactly one
`secondaryButton` — confirmed from the SDK interface, and `stopButton` is deprecated besides. So the
alert cannot carry both "scan tag" and "override". The secondary button opens the app, and the app
presents both. The escape hatch is therefore always two steps away, which is a reasonable amount of
friction for something that should be rare.

**An app that can trap its user is worse than one that can be cheated.** This is the one place where
that trade is made explicitly.

### Permissions, and the ways they rot

The app needs AlarmKit authorisation, NFC, Bluetooth, Notifications, and **Location: Always**.

Location Always is the fragile one. iOS may downgrade it to *While Using* — at the prompt, at the
"still allowing?" re-prompt weeks later, or on reinstall. Every location-dependent rule (D3, D12,
D19, D26, and the geofence gate on Feature A) **fails silently** when that happens.

Treat a downgraded or missing permission as a **loud, blocking state**: the home screen says the app
cannot do its job, and Feature A refuses to arm rather than arming and quietly not enforcing. Never
degrade silently — silent degradation on an alarm app means oversleeping without knowing why.

### Reboot

AlarmKit alarms are system-scheduled and survive a restart, but iOS does **not** resume region
monitoring until the device has been unlocked once. A phone that dies at 03:00, is charged at the
dock, and reboots at 05:00 has no geofencing until it is unlocked — which will not happen while the
user is asleep.

The wake alarm should still fire. The location-dependent rules will not work until first unlock, and
that is acceptable provided nothing depends on them *to ring*. Verified in build step 5, not assumed.

### Both alarms ringing at once

D10 makes the features independent, so nothing prevents identical or overlapping times. When two
alarms are alerting, a scanned tag clears **the alarm whose role it matches**, not "the one currently
ringing" — the rule in §9 is written per-role for exactly this reason. Overlapping schedules should
also be flagged at configuration time, since it is almost always a mistake.

### Time changes

Schedules are wall-clock local (D23): 07:00 means 07:00 on the clock in the room, including the day
the clocks change. A session's duration is absolute elapsed time, so it neither gains nor loses an
hour at the boundary. Crossing a timezone re-bases the schedule to local time; the home region does
not move, so away-from-home behaviour (D9) applies as usual.

## 7. Stack

Chosen to maximise transfer to the existing Next/T3 work, and because Expo's first-party agent
tooling is now good.

| Layer | Choice | Note |
| --- | --- | --- |
| Framework | Expo + TypeScript, **dev client** | Expo Go cannot load native modules; prebuild from day one |
| Routing | Expo Router | Same file-based mental model as the Next App Router |
| UI | NativeWind | Tailwind classes; carries the 4-point spacing discipline over |
| DB | Drizzle + `expo-sqlite` | Same ORM idiom as the existing repo |
| Alarm (iOS) | `expo-alarm-kit` or `react-native-nitro-ios-alarm-kit` | Community packages — pin exact versions. **iOS deployment target 26.0**, so the app runs on nothing older. `expo-alarm-kit` requires an App Group whose identifier must match its `configure()` call exactly; the Nitro module needs a physical device and no-ops entirely on Android |
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

## 8. Architecture

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

## 9. Behaviour rules

Rules that matter, stated so a test can be written against each:

- A scanned tag clears **the alerting alarm whose role it matches** — not "the alarm currently
  ringing", since D10 allows both to alert at once. The dock tag presented to the wake alarm is
  rejected, and vice versa.
- The two roles must hold distinct UIDs; registration rejects a tag already bound to the other role
  (D22).
- An empty or unreadable UID **never matches**, so a failed read cannot become a dismissal.
- `stopPressed` on an unsatisfied alarm schedules a fresh alarm `rearmDelay` later. The original fire
  time is preserved across re-arms, so the give-up window measures from when the alarm *first* rang.
- Presence may suppress Feature A entirely and may downgrade Feature B to dismissible.
- A **confirmed exit transition** while alerting stops the alarm (D12). A static `away` reading may
  not silence a ringing alarm, and `unknown` never may.
- On return, the **dock** alarm resumes for the remainder of the session window; the **wake** alarm
  does not (D13).
- An exit is confirmed only by a fresh fix showing real distance beyond the radius. An exit event
  that cannot be corroborated leaves the alarm ringing.
- The home radius is configurable but never below 100m (D14).
- A dock session persists across process death and is rehydrated on cold launch if still inside its
  window (D15). It closes on confirmed exit or when its duration elapses (D16).
- A resumed or proximity-broken dock alarm passes through the grace period first: vibrate, notify,
  then sound after the configured delay unless docked (D17). The scheduled bedtime alarm does not.
- Each re-arm shortens the delay (D18); the give-up window still measures from the first ring.
- Both features must function correctly with the other disabled. Neither may read the other's
  schedule or enabled state (D10).
- Proximity may only resume the dock alarm during an active dock session, at home, while Feature B is
  not alerting.
- Uncertain proximity state never rings (§5) — but Bluetooth being off is refused at dock time and
  ends a running session (D24), rather than silently leaving it unenforced.
- A wake-alarm exit-stop is provisional: a confirmed return inside the window resumes it (D26).
- The escape hatch cancels any alarm and session unconditionally, and is always available (D20).
- A downgraded or missing Location Always permission blocks Feature A from arming rather than letting
  it arm unenforced (§6).
- Schedules are wall-clock local; session durations are absolute elapsed time (D23).

## 10. Data model

SQLite via Drizzle. Kilobytes total.

- `tags` — id, role (`dock` | `morning`), uid (hex), label, registered lat/lon, created_at.
  **Unique on `uid`** — one physical tag cannot hold both roles (D22)
- `alarms` — one row per feature: kind, time, active weekdays, enabled, feature-specific settings
- `home_region` — centre, radius
- `beacon` — one row: uuid/major/minor, label, last_seen, last_rssi. Singular; there is one dock
- `occurrences` — per scheduled firing: due_at, fired_at, cleared_at, how it ended. **Whether an
  alarm actually fired is the single most important thing to record** — a broken bridge otherwise
  fails silently and the user simply oversleeps with no indication why (D25)
- `sessions` — dock sessions: started, duration, state, ended, how it ended, proximity breaks, graces
  used. **This table is live state, not just history** — a session must be rehydratable after process
  death (D15), so it is the durable record of whether a night is in progress
- `events` — alarm fired / stopped / scanned / stood down, for debugging why a night went wrong

**One wrinkle.** The iOS widget extension runs in a separate process and cannot read the SQLite file.
The handful of values native code needs at alarm time go in an **App Group `UserDefaults`**, written
through the native module. `@bacons/apple-targets` configures the App Group.

### State consistency: SQLite is intent, everything else is derived

State lives in three places — the SQLite database, AlarmKit's scheduled alarms, and the App Group
`UserDefaults` mirror. They can disagree after a crash, a force-quit, or a battery death mid-session.

**Transactions alone cannot fix this.** ACID applies within SQLite, and the alarm is not in SQLite —
it is in an OS service that cannot be enlisted in a database transaction. There is no two-phase
commit available with AlarmKit, so "schedule the alarm and update the session atomically" is not
something the storage layer can be asked to provide.

The design is therefore **reconciliation, not transaction**:

- **SQLite holds intent** — what alarms and sessions *should* exist. It is the single source of truth
  and the only durable one.
- **AlarmKit and the App Group mirror are derived.** Never read them to decide what should be true.
- **Write intent before acting.** A crash between the write and the OS call is then recoverable: the
  next reconcile sees an intent with no matching alarm and repairs it. The reverse order loses the
  intent entirely.
- **Reconcile idempotently** on cold launch, on foreground, and after every alarm event: read desired
  state from the DB, read actual alarms from `AlarmManager.alarms`, make actual match desired.
  Running it twice must be harmless.

Use transactions for the SQLite writes regardless — session state and its event log should move
together. That is necessary, just not sufficient.

## 11. Build order

**Steps 1–3 need no paid account.** They are also the highest-value, lowest-risk work in the
project, which makes the provisioning boundary and the sensible work order the same line.

A free Personal Team gives 7-day provisioning profiles, 3 devices and 10 App IDs a week, and it
covers Expo, Expo Router, NativeWind, Drizzle, `expo-location`, and BLE beacons. It does **not**
cover Core NFC (which returns *Sandbox restriction*), App Groups, or the AlarmKit entitlement — so
steps 4 onward are gated.

**Apply for the AlarmKit entitlement the day the account exists**, then carry on with steps 1–3 while
it queues. Serialising behind it wastes the wait; ignoring it risks building `core/` for a capability
that never arrives.

1. Repo conventions + agent tooling (done).
2. Expo app scaffold, dev client, prebuild, NativeWind, Drizzle. Prove it runs on device.
3. `core/` + its tests, against a synthetic clock, plus the night simulator. No UI, no native — this
   step runs entirely in Node and needs no device or account at all.
4. NFC read → show a UID on screen. Proves the capability and the provisioning.
5. **AlarmKit spike**: schedule, fire, launch-on-dismissal, re-arm. The riskiest step.
6. Widget extension.
7. Feature B end to end (wake → Tag B), including tag registration, **the escape hatch**, and the
   `occurrences` record of whether each alarm actually fired (D25). Simpler of the two; ship it
   working before starting A. The escape hatch cannot wait for step 8 — a v1 user can lose Tag B on
   the first night, and without it the app has no off switch at all.

   **← v1 stops here.** A morning alarm cleared only by a tag across the flat is already the thing
   that solves half the problem, and it works with none of the geofencing, sessions, proximity, or
   beacon hardware. **Use it for a fortnight before building anything else.** The most likely way
   this project fails is not a technical one — it is twelve steps of scaffolding for a personal tool
   that never gets used. Everything below is v2.

   **v1 deliberately ships without the settings lockout** (D7/D21, step 12). It is a probe for one
   question — does being made to walk to a tag actually get me up? — and that is answered honestly
   or not at all. If the fortnight ends with the alarm quietly disabled at 06:59 most mornings, that
   is the finding, and it is a more useful one than any amount of enforcement built on top.

8. Feature A without proximity (dock alarm → Tag A), plus home-region setup and the escape hatch.
9. **Proximity spike**: beacon at low TX power, measure real flapping over several nights *with
   alarms disabled* before letting it ring anything. Also verify that `AlarmManager.schedule`
   completes inside the ~10s window iOS grants after a beacon event — D17's grace depends on it, and
   if it does not, the grace has to be pre-scheduled at dock time and cancelled instead.
10. Dock sessions + early docking.
11. Geofence gating and Feature B degradation.
12. Settings lockout, history, UI polish.

Steps 5 and 9 are where this project most plausibly dies. Both are cheap spikes. Do them before
building anything that assumes they work — and note step 9 runs in observation mode first, because
the cost of getting proximity wrong is being woken at 03:00.

## 12. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| **AlarmKit needs a managed entitlement Apple must approve** (`com.apple.developer.alarmkit`) — not unlocked by paying | Blocks everything, with a queue and a possibility of refusal | Apply the day the account exists, in parallel with steps 1–3. An alarm app is a legitimate use case, but the lead time is real and unknown |
| NFC Tag Reading and App Groups need a **paid account** (~$99/yr) | Blocks steps 4–7 | Core NFC returns *Sandbox restriction* on a Personal Team; `expo-alarm-kit` needs an App Group too, so the alarm path is double-gated |
| **Proximity false positive rings at 03:00** | Highest — worse than the original problem | Debounce, bias-to-silence, observation-only period in step 9 |
| **False geofence exit silently stops the wake alarm** → overslept | Highest, and silent | D3: exit must be corroborated by a fresh fix; ambiguous → keep ringing. This is the risk D12 reintroduces and must be measured, not assumed |
| AlarmKit bridges are young community packages | High | Pin versions; be ready to fork; step 5 is a spike for exactly this |
| Launch-on-dismissal too slow or unreliable to re-arm | High | Measure in step 5; fallback is a custom Swift `LiveActivityIntent` |
| Beacon battery dies silently mid-session | High | Verify beacon at dock time; warn on weakening signal |
| iOS background BLE scanning is throttled or unreliable | High | Region monitoring (enter/exit) rather than continuous ranging; step 9 measures the truth |
| Two native modules now (AlarmKit + beacons) | Medium | Both are Expo-dev-build compatible; neither works in Expo Go |
| App Review may reject an un-dismissible alarm | Medium, deferred | Tagdawn ships the same pattern; irrelevant until shipping |
| The grace period becomes a repeatable bypass | **Accepted, not mitigated** | Judged unrealistic: repeatedly breaking proximity at home to farm five-minute windows is more effort than picking the phone up and ignoring the app. No cap in v1; revisit only if it happens |
| Session, alarm, and mirror state disagree after a crash | Medium, silent | Reconciliation (§10): SQLite holds intent, AlarmKit and the mirror are derived, reconcile idempotently on launch and foreground |
| **Location Always silently downgraded to While Using** → every geofence rule fails quietly | Highest, and silent | Treat as a blocking state (§6): Feature A refuses to arm, home screen says so. Never degrade silently |
| **The project is never finished** — 12 steps for a personal tool | High, and the likeliest failure of all | The v1 cut at build step 7: a working morning alarm with no geofencing, sessions, or beacon. Use it for a fortnight before continuing |
| The escape hatch becomes the normal way to dismiss | Medium | Deliberately awkward, logged, shown in history, rate-limited per week (D20) |
| DST or a timezone change shifts an alarm by an hour | Medium, silent, and annual | D23: wall-clock local schedules, absolute-elapsed sessions. Test explicitly — it is the classic alarm-app bug |
| Force-quitting the app defeats re-arm | Accepted | Out of scope — the adversary is a sleepy user, not an attacker |

## 13. Testing and CI

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

## 14. Deliberately out of scope

Named so the audit does not treat them as gaps:

- **Android.** The seam exists; the implementation is deferred entirely.
- **App blocking (FamilyControls).** Separate entitlement, weeks of Apple approval, and physical
  separation is the actual mechanism.
- **Payments, accounts, sync, cloud.** No server is a decision (D8), not an omission.
- **Snooze.** Possibly never. Deferred pending real use.

## 15. Open questions

Everything the audit and the earlier rounds raised is now settled in the decision table, §5 and §6.
What remains is empirical: values that can only be set by running the thing.

### Settled defaults, to be tuned in use

| Setting | Default | Basis |
| --- | --- | --- |
| Give-up window (Feature A) | 20 min of no interaction | Accepted as a starting guess |
| Re-arm delay | 20s → 15s → 10s, floor 10s | Escalating (D18). The floor stops it becoming unsatisfiable — below roughly 10s you cannot cross a room before it fires again |
| Proximity debounce | 60s of continuous non-detection | Long enough to ride out occlusion (a body between phone and beacon, the phone face-down), short enough to catch a real pickup. Never act on a single missed advertisement. iOS imposes its own beacon-exit delay on top |
| Grace before a resumed alarm sounds | User-set: 30s / 1 min / 5 min | D17 |
| Session duration | User-set hours from start | D16 |
| Home radius | User-set, floor 100m | D14 |

### Genuinely open

1. **Is 60s the right proximity debounce?** Chosen on reasoning, not measurement. Build step 9's
   observation period exists to replace it with a number derived from real overnight logs. It is the
   single value most likely to be wrong, and being wrong means either a false alarm or a bypass.
2. **How fast is confirmed exit in practice?** D19 should make it near-instant, but that assumes a
   clean GPS fix is available quickly from indoors near a door. Measurable in build step 11.
