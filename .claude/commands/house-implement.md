---
description: Plan a change, audit the plan to convergence, build it, then review the code — the full house loop end to end.
---

Take a piece of work from "here's what I want" to "reviewed code, committed", running this repo's two
gates in order: **`/house-plan`** on the plan, then **`/house-review`** on the result. This is a
**wrapper, not a third engine** — it owns the sequencing and the handover, and adds no rubric of its
own. The plan rubric is `docs/development/plan-audit-guide.md`; the code rubric is
`docs/development/review-guide.md`.

Use it when the work is big enough that building the wrong thing is a real risk. For a one-line fix,
just make the fix — the ceremony costs more than the change.

The target is the task in the argument, or the task under discussion in chat. If it is genuinely
ambiguous what you are being asked to build, **ask** — a wrong premise is the one defect neither gate
can catch.

## Phase 1 — Plan, and audit it to convergence

1. **Write the plan first**, before any code. A plan in chat is fine. This repo already has a plan
   doc at `docs/plan/anchor-plan.md` — when the work is a phase of that plan, **the doc is the plan**,
   and fixing it means editing it. Never create a new `.md` just to have something to audit.
2. **Ask the questions the plan cannot answer for itself.** This is the phase for them and the only
   phase where they are cheap. An unowned decision surfaced here is a question; discovered in Phase 2
   it is a rewrite. Batch them — one round, not a drip.
3. **Run `/house-plan`.** Follow it exactly, including convergence: **two consecutive rounds with zero
   new VALID findings**, a different lens leading each round, findings reported individually.
4. **Do not start building until the plan is green.** The gate is worthless if the code it was meant
   to shape already exists.

## Phase 2 — Implement

5. **Build what the plan says.** If implementing surfaces something the plan got wrong — and it will —
   **say so, fix the plan, and re-audit the changed part** before carrying on. A plan that no longer
   describes the code is worse than no plan, because the next reader trusts it.
6. **Retrieve, don't recall.** Expo and AlarmKit surface moves faster than model memory. Read
   `docs/development/expo-guidelines.md` first, then re-retrieve anything version-shaped that matters
   (§9 of the plan lists the sources). Never invent an API to make a step work.
7. **Commit in reviewable pieces**, messages saying *why*. One concern per commit.
8. **Keep the gate green as you go** — `npm run check:code` and `npm test`. Do not save them for
   Phase 3: a failure found early is a fix, found late it is a rework.
   **Read the real exit code** (`cmd; echo $?`), never the tail of a pipeline — `cmd | tail; echo $?`
   reports `tail`'s status and will tell you a failing check passed.
9. **Prove the rules fire, don't assume they do.** Where a step installs an enforcement mechanism —
   the `core/` purity rule above all — deliberately violate it once and watch it break. A rule
   believed to be enforced but not wired is worse than no rule (D36 reasoning, plan §13).

## Phase 3 — Review

10. **Run `/house-review`** on the result. Follow it exactly: deterministic layers, then the rubric
    pass, all triaged through `review-guide.md`, looping until a round yields zero new VALID findings.
11. **Fix what it finds, then re-run the fast layers.** Findings in code you wrote this session are
    the expected case, not an embarrassment — report them like any other.

## Reporting

- **Every finding, from both gates, goes to chat individually** — the audit's lens + verdict, the
  review's file:line + failure scenario. Never fix silently.
- **Results live in chat.** Never write audit or review summaries as `.md` into the repo. The plan
  may be a doc; the *findings about it* are not.
- **Close with both convergence summaries** and say plainly what is left: anything deferred, any
  decision still open, anything you could not verify.

## Do not stop until it converges

**Run the whole loop in one go.** Convergence is the exit condition — not a round count, not "enough
for now", not the point where findings get tedious. Do not hand back a half-finished loop, and do not
ask permission to continue: "shall I keep going?" is not a question, it is a pause the user has to
spend a turn undoing.

**Phase boundaries are not stopping points.** Finishing the audit and *saying* "implementation starts
now" is not implementing — it is a handback dressed as progress. Cross every boundary in the turn you
reach it.

**Convergence means FRESH rounds, not fix-verification.** Re-confirming the fix you just made is
necessary but is not a round and cannot end the loop. If you fixed something, you owe another fresh
round in that gate.

The **only** legitimate reason to stop early is a **genuine question** — one whose answer changes what
you do next and that you cannot settle from the repo, the docs, or a sensible default. A decision the
user must own is worth stopping for; a progress check is not.

Report as you go, so the user can interrupt if they want to. That is their call, not yours to pre-empt.

## What this command does NOT do

- It does not replace either gate, add lenses, or relax a convergence rule. If the guides disagree
  with anything here, they win.
- It does not push, or open a PR, unless asked.
- It does not turn a small change into a project. If Phase 1 concludes the work is a few lines, say so
  and build it; over-scoping is a finding under the plan rubric's own Lens 5.
