# AGENTS.md

This repo's AI conventions are maintained in one place: **[`CLAUDE.md`](./CLAUDE.md)**.
Follow it and the `docs/` guides it indexes. This file is a thin pointer kept in sync with it.

**What the app is:** [`docs/plan/anchor-plan.md`](./docs/plan/anchor-plan.md). Read it first.

## Most critical rules — NOT exhaustive (full set in CLAUDE.md)

- **`src/core/` is pure** — no `expo-*`, `react-native`, `react`, or native imports. Behaviour rules
  live there or nowhere.
- **Tag identity is the hardware UID, never the NDEF payload.** An empty UID never matches.
- **Never gate the wake alarm on location.** Only bedtime is geo-gated.
- **`unknown` presence is not `away`.**
- **Never run prettier** — match existing style.
- **Never invent an Expo or AlarmKit API from memory** — retrieve it (Expo MCP / llms.txt / the iOS
  SDK's `.swiftinterface`).

## House plan (auditing a plan before it becomes code)

Apply `docs/development/plan-audit-guide.md` — six adversarial lenses plus the verdict vocabulary.
Procedure in [`.claude/commands/house-plan.md`](./.claude/commands/house-plan.md) (tool-agnostic:
read the plan and the code it touches, walk all six lenses leading with a different one each round,
loop until **two consecutive** rounds find nothing new, report every finding in chat with a lens,
load-bearing quote, and VALID/REFUTED verdict). Fix VALID findings **in the plan doc**; never write
audit results as `.md` into the repo. It audits the plan, never implements it.

## House review (any code review in this repo)

Apply `docs/development/review-guide.md` — Part A = established patterns, do **not** flag; Part B =
house rules, flag. Procedure in [`.claude/commands/house-review.md`](./.claude/commands/house-review.md):
run the deterministic checks, review with the rubric, loop until a round finds nothing new, report
every finding in chat with a VALID/REFUTED verdict. Never write review results as `.md` into the repo.
