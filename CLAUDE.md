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
- **Tag identity is the hardware UID, never the NDEF payload.** A payload copies onto a second
  sticker you keep by the bed, which defeats the entire premise of the app. Compare normalised
  lowercase hex, and treat an empty UID as never matching — a failed read must not become a
  successful dismissal.
- **Never gate the wake alarm on location or presence.** Only the bedtime alarm is geo-gated. A
  geofence glitch at 03:00 must not be able to cancel the alarm that wakes you.
- **`unknown` presence is not `away`.** Only a positive "outside the home region" suppresses
  anything. No-fix-yet, permission-denied, and stale-location all mean *keep the alarm*.
- **One export per file** in UI code, named after its export (`tag-card.tsx`, `use-alarm.ts`).
  Shared types go in a co-located `types.ts`. Service/lib modules may group related exports.
- **Spacing: 4-point system.** Tailwind/NativeWind scale utilities only (`gap-*`, `p-*`, `m-*`) — no
  arbitrary values like `p-[13px]`.
- **Never run prettier** (`--write` or `--check`). Match the surrounding style; formatting is
  manual/IDE.

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
