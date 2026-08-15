# Anchor

An alarm you cannot dismiss from bed — at either end of the night.

- **At bedtime** it rings until the phone is physically docked away from the bed, and keeps it there.
- **In the morning** it fires from that dock, across the room, and is cleared only by a second tag
  somewhere else entirely.

Personal tool. iOS first. Everything on-device — no account, no server, no sync.

## Status

**Planning complete and audited. No application code yet.**

The design is in [`docs/plan/anchor-plan.md`](./docs/plan/anchor-plan.md) — 38 decisions, each with
its reasoning, converged through two `/house-plan` audits. Phase 0 has not been started.

## Start here

**Read [§1](./docs/plan/anchor-plan.md) and [§3](./docs/plan/anchor-plan.md) of the plan before
anything else.** §1 says who the app defends against and is the brake on adding machinery; §3 is the
build order. Then [`CLAUDE.md`](./CLAUDE.md) for the conventions.

The plan's header carries a where-to-look table and a glossary. Use them — the document is long
because every decision records *why*, not because it is padded.

### Building Phase 0

The recipe is [§13 step 2](./docs/plan/anchor-plan.md). It scaffolds from `create-expo-app`,
configures five things that are not obvious, and ends when the app boots, a migration runs,
`npm test` and `npm run check:code` both pass, **and the `core/` purity rule has been proven to fire
by deliberately breaking it**.

Phase 0 needs no Apple Developer account and no hardware. It is the one thing that can start today.

## The rules that matter most

| | |
| --- | --- |
| `src/core/` is pure | No `expo-*`, `react-native`, `react`, or native imports. Every behaviour rule lives there, and it is the only surface testable without sleeping |
| A tag is identified by hardware UID | Never the NDEF payload. An empty UID never matches |
| A tag has one role, everywhere | Its place records where it is stuck, and never affects whether a scan matches |
| Uncertain proximity never rings | The one place the app biases toward silence. A false positive at 03:00 is worse than the problem it solves |
| Every business rule has a test | A rule without one is unfinished, not merely untested |
| Every phase ends with a working app | Additive over a working base, never half-wired |
| Done means `npm test` **and** `npm run check:code` | Tests prove behaviour; the gate proves the rules behaviour depends on are still enforced |

## Phases

| | | Blocked by |
| --- | --- | --- |
| **0** | Template, conventions made enforceable | nothing |
| **1** | Alarm core — morning alarm cleared only by a tag | NFC needs a paid account; AlarmKit device builds need an entitlement |
| **2** | Places and geofencing | Phase 1 |
| **3** | Feature A — the evening dock alarm | Phase 2 |
| **4** | Dock sessions and beacon proximity | Phase 3, plus hardware |

**Use Phase 1 for a fortnight before starting Phase 2.** An explicit gate, with a duration — see §3.

## What you need

**~£10 of hardware**, none of it required before Phase 1: NTAG213 stickers (~£5 for 10–20) and an
ESP32 board (~£3–5) run off USB at the dock. Not a payment card — those randomise their UID.

**A paid Apple Developer account** for NFC and App Groups, and a separate approved entitlement for
AlarmKit on device. Neither blocks Phase 0, and the AlarmKit spike runs in the simulator for free.

## Docs

| | |
| --- | --- |
| What it is, and every decision with its reasoning | [`docs/plan/anchor-plan.md`](./docs/plan/anchor-plan.md) |
| Conventions for AI agents | [`CLAUDE.md`](./CLAUDE.md) |
| Auditing a plan before it becomes code | [`docs/development/plan-audit-guide.md`](./docs/development/plan-audit-guide.md) |
| Reviewing code | [`docs/development/review-guide.md`](./docs/development/review-guide.md) |

## Stack

Expo + TypeScript (dev client, npm), Expo Router, NativeWind, Drizzle on `expo-sqlite`, AlarmKit via
a community bridge, `react-native-nfc-manager`, `react-native-beacon-radar`, `expo-location`.

Android is deferred: the platform seam exists in the design, the implementation does not.
