# CLAUDE.md — AI agent guide for Anchor

Canonical instruction file for AI coding agents in this repo. `AGENTS.md` is a thin pointer back
here — keep the real conventions in this file and in `docs/`, and keep every other tool's instruction
file a pointer, so they stay in sync.

**What this app is:** `docs/plan/anchor-plan.md`. Read it before any substantive work.

> This repo is new. The rule set below is deliberately short. Rules should accrete when something
> actually bites, not be imported wholesale from a mature codebase — an unearned rule is ceremony
> with nothing to push back on.

## Non-negotiable rules

- **`src/core/` is pure.** It must not import from `expo-*`, `react-native`, `react`, or any native
  module. It is the one part of the app that would survive an Android port, and the only part where
  the behaviour rules actually live. If a rule about *when an alarm fires or clears* is not in
  `core/`, it is in the wrong place.
- **Tag identity is the hardware UID, never the NDEF payload.** Compare normalised lowercase hex, and
  treat an empty UID as never matching — a failed read must not become a successful dismissal.
- **A tag has exactly one role, everywhere** (D22). A tag's place records where it is stuck and never
  affects whether a scan matches. Per-place roles would let one tag be dock at home and morning
  elsewhere, and it would then clear the morning alarm while sitting on the dock beside the bed.
- **Only a confirmed exit transition may silence a ringing alarm.** "Confirmed" is load-bearing: a
  region-exit event must be corroborated by a fresh fix showing real distance beyond the radius. A
  static `away` reading may not silence a ringing alarm, and an uncorroborated exit leaves it
  ringing. A GPS glitch at 07:00 must not be able to cancel the alarm silently.
- **On return, the dock alarm resumes and the wake alarm does not** — walking that far already proves
  you are awake, but it does nothing to put the phone on the dock. The asymmetry is deliberate; do
  not "fix" one to match the other.
- **But a wake-alarm exit-stop is provisional for a few minutes** (D26). A confirmed return inside
  that window *does* resume it, because a confident-but-wrong GPS fix would otherwise kill the alarm
  permanently. D13 and D26 are both true: D13 governs a real departure, D26 catches a bad reading.
- **`unknown` presence is not `away`.** Only a positive, corroborated "outside the active place"
  changes anything. No-fix-yet, permission-denied, and stale-location all mean *keep the alarm*.
- **Uncertain proximity never rings.** Everywhere else the app biases toward the alarm sounding;
  proximity biases the opposite way. Beacon not seen, Bluetooth off, signal ambiguous — do not ring.
  A missed enforcement costs one night's discipline; a false positive at 03:00 costs a night's sleep
  and the user's trust in the app.
- **The dock and wake features are independent.** They share the tag registry, schedule arithmetic
  and presence service — nothing else. Each must work correctly with the other disabled, and neither
  may read the other's schedule or enabled state. The single permitted coupling is suspending
  proximity while the wake alarm alerts. Do not "unify" their handling; they encode genuinely
  different rules.
- **A dock session is durable state, not memory.** It must survive a restart or force-quit and be
  rehydrated on cold launch, or "restart the phone" bypasses the feature in one step.
- **A resumed or proximity-broken dock alarm goes through the grace period.** Vibrate and notify
  first, sound only after the configured delay unless docked. Never skip straight to sounding — that
  wakes a household for something only the phone's owner cares about, and it is what keeps a
  proximity false positive from being a siren at 03:00.
- **One export per file** in UI code, named after its export (`tag-card.tsx`, `use-alarm.ts`).
  Shared types go in a co-located `types.ts`. Service/lib modules may group related exports.
- **Spacing: 4-point system.** Tailwind/NativeWind scale utilities only (`gap-*`, `p-*`, `m-*`) — no
  arbitrary values like `p-[13px]`.
- **Never run prettier** (`--write` or `--check`). Match the surrounding style; formatting is
  manual/IDE.

## Every business rule has a test

A rule in `core/` without a test is **unfinished**, not merely untested (plan §5, D37). The decision
table in the plan is the checklist — every entry describing runtime behaviour maps to at least one
test. `core/` is a pure reducer with nothing to mock, so there is no cost to hide behind.

Scenario tests are **golden traces**: a scripted event sequence asserted as the complete resulting
sequence of states and effects, not spot checks. A trace written in one phase must still pass
unchanged in every later phase — re-recording one needs a stated reason, because that is how the
protection quietly disappears.

DB tests take a fresh in-memory database each. Never share state between tests.

## Done means check:code too

Nothing is finished on `npm test` alone. **`npm test` and `npm run check:code` must both be green.**
Tests prove behaviour; `check:code` proves the rules that behaviour depends on are still enforced —
lint including `core/` purity, types, and `expo-doctor`.

A change that passes tests while `core/` has quietly grown a native import has not finished.

**Gates need a zero baseline.** A rule with pre-existing violations belongs in the advisory scan, not
in `check:code` — a permanently red gate is a gate everyone learns to ignore.

## Every phase ends working

The app must **build and function at the end of every phase** (plan §3, D36). A phase is additive
over a working base — never a half-wired intermediate that only makes sense once the next one lands.

This is also a design check, not just discipline: if adding places breaks the alarm, the layering was
wrong. That should surface at the end of the phase, not at the end of the build.

## Who this defends against

**A tired person who wants better sleep, and nobody else.** Not an attacker, not a determined
cheater. Read the plan's §1 before adding anything that closes a loophole.

Bypasses that take deliberate effort — force-quitting, reinstalling, moving a tag next to the bed,
changing a setting the night before — **work, and are not defects.** Someone doing that has decided
not to use the app. Most bypasses are self-policing anyway, because carrying them out means picking
up the phone, which is across the room.

Every rule that closes a loophole must also have an independent reason to exist: correctness, honesty
about degraded state, or not being annoying. **If bypass-closing is its only justification, do not
add it** — say so instead and move on. Friction is aimed at ten seconds of grogginess; machinery that
only stops a wide-awake, motivated person has no job here.

## Code comments

Comment the *why*, not the *what* — design decisions and non-obvious rationale are valuable,
especially here, where most of the code encodes an answer to "can I cheat this?".

Keep them **out of the middle of data structures**: don't interleave multi-line comments between the
fields of an object or array literal. Put the rationale in the doc block above the declaration, or
immediately before the structure. Short single-line field annotations are fine.

## Plan audit

Before a plan becomes code, adversarially audit it with **`/house-plan`** — apply
`docs/development/plan-audit-guide.md` (six lenses: assumptions, premortem, failure modes,
completeness, right-sizing/YAGNI, scenario walk) and loop until **two consecutive** rounds produce
zero new VALID findings.

Over-scope is a first-class finding, not diligence. This repo is a personal tool; a plan that builds
for a product that does not exist yet is defective.

Findings go in **chat, never into repo `.md` files**. When the plan is a doc, editing that doc *is*
the fix. Never create a `.md` just to have something to fix.

## Code review

Every code review applies `docs/development/review-guide.md`: auto-refute Part A (established
patterns — do not flag), flag Part B. Run it via **`/house-review`**, which loops until a round finds
nothing new. Findings go in chat, never into repo `.md` files.

## Expo agent tooling

This project depends on fast-moving SDK surface, so **prefer retrieval over model memory**:

- **Expo Skills** — `github.com/expo/skills`
- **Expo MCP server** — `docs.expo.dev/mcp`
- **llms.txt** — Expo publishes AI-oriented docs; use them rather than recalled API shapes
- **Claude Code + Expo** — `docs.expo.dev/agents/claude`

Never invent an Expo or AlarmKit API from memory. Look it up. For AlarmKit specifically, the
authoritative source is the SDK's own `.swiftinterface`, not the web docs.

## Platform seam

iOS and Android alarm implementations live behind `src/alarm/types.ts` and are resolved by React
Native's `.ios.ts` / `.android.ts` extensions. Do not add platform branching anywhere else — if a
`Platform.OS` check is creeping into `core/` or `ui/`, the seam is in the wrong place.
