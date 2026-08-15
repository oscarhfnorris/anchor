# Anchor

An alarm you cannot dismiss from bed — at either end of the night.

- **At bedtime** it rings until the phone is physically docked away from the bed.
- **In the morning** it fires from that dock, across the room, and is cleared only by a second NFC
  tag somewhere else entirely.

Personal tool first. iOS first. Everything on-device — no account, no server, no sync.

## Status

**Planning.** No application code yet. The plan is
[`docs/plan/anchor-plan.md`](./docs/plan/anchor-plan.md) and is pending its first `/house-plan` audit.

## Docs

| | |
| --- | --- |
| What it is and why | [`docs/plan/anchor-plan.md`](./docs/plan/anchor-plan.md) |
| AI agent conventions | [`CLAUDE.md`](./CLAUDE.md) |
| Auditing a plan | [`docs/development/plan-audit-guide.md`](./docs/development/plan-audit-guide.md) |
| Reviewing code | [`docs/development/review-guide.md`](./docs/development/review-guide.md) |

## Intended stack

Expo + TypeScript (dev client), Expo Router, NativeWind, Drizzle on `expo-sqlite`, AlarmKit via a
community bridge, `react-native-nfc-manager`, `expo-location`.

Android is deferred: the platform seam exists in the design, the implementation does not.
