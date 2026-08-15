# Plan-audit guide

How the **plan/design audit** works and the lenses it applies. The planning-side counterpart to
`review-guide.md` (which audits *code*). `/house-plan` loads this. Single source of truth for how we
adversarially audit a plan, design doc, or runbook **before** it becomes code.

Adapted from the same guide in the approvals-app repo. The lenses and the verdict vocabulary are
stack-agnostic; only the examples changed.

## Run

**`/house-plan [path-or-nothing]`** — adversarially audit a plan. The target is either a plan doc
(pass its path — e.g. `docs/plan/anchor-plan.md`) or the plan under discussion in chat (pass
nothing). Same audit either way; only where fixes land differs.

Loops: report findings + verdicts in chat, apply the VALID fixes, re-audit — until **two consecutive
rounds** produce **zero new VALID findings**.

## What it is (and is NOT)

- It audits a **plan**, not code — so there is no compiler, no test suite, no second tool to lean on.
  The engine is *you*, reading adversarially through the six lenses from a **fresh angle each round**.
- It is NOT a rewrite or a gold-plating pass. A plan that is **too big** is as defective as one that
  is too small. Over-engineering and speculative scope are first-class findings (L5).
- **This repo is a personal tool.** Scope discipline matters more than usual: a plan that builds
  infrastructure for a userbase that does not exist is failing L5, not being thorough.
- Results live in **chat** — never write audit results as `.md` into the repo. If the plan is a doc,
  editing that doc to fix findings is the whole point. If the plan is only in chat, present the
  corrected sections in chat; do not create a `.md` just to have something to fix.

## The six lenses

Grounded in premortem (Klein), FMEA / Design-Review-Based-on-Failure-Mode (Toyota DRBFM), and
checklist/scenario-based reading (IEEE 1028 / ISO 20246). Run **all six** each round; lead with a
different one each round so the read stays adversarial rather than self-confirming.

- **L1 · Assumptions.** Excavate every assumption the plan rests on, stated *and* silent. Flag each
  load-bearing one that is **unverified** or **unowned**. Hidden assumptions are the top failure
  source — a plan that doesn't name its assumptions is already failing this lens.
- **L2 · Premortem.** Assume it's six months later and the plan failed. Work backward: what's the
  most likely story? Each distinct failure path the plan doesn't prevent or detect is a finding.
- **L3 · Failure modes (FMEA/DRBFM).** For each change to an existing system, ask what breaks —
  score **severity × likelihood × detection-difficulty**, each 1–5. Note the third term: it is how
  HARD the mode is to notice (5 = silent, 1 = fails loudly in CI), so all three point the same way.
  Scoring "detectability" instead inverts it and promotes failures you'd have caught anyway.
  Silent, high-severity, hard-to-detect modes rank first.
- **L4 · Completeness & scope.** Missing steps, undefined interfaces, **unowned decisions**, hidden
  dependencies, no rollback, no verification, no sequencing, silent scope caps. "How do we know it
  worked?" and "how do we undo it?" must both be answerable.
- **L5 · Right-sizing & coherence.** Internal contradictions; do-now vs defer mislabeled;
  YAGNI / speculative abstraction; premature commitment where a decision should stay open.
  Over-scope is a defect, not diligence.
- **L6 · Scenario walk (SBR).** Run 3–5 concrete scenarios end-to-end through the plan. Anywhere a
  scenario dead-ends or the plan is silent is a finding.

  For this project the scenarios that matter are behavioural, not operational. Walk at least:
  *the user sleeps at someone else's house* · *the phone is in a bag when bedtime hits* · *the dock
  tag is unreadable or peeled off* · *the phone dies overnight* · *the user genuinely needs the phone
  at 03:00* · *the user is actively trying to cheat the app*.

## Verdict vocabulary

Two axes, not competing sets:

- *Recall* — how a lens EMITS a candidate: **CONFIRMED** (cites a load-bearing plan statement plus a
  concrete way the plan fails, misleads, or is unactionable) or **PLAUSIBLE** (a realistic gap, not
  yet proven from the text).
- *Decision* — how the audit TRIAGES it: **VALID** (a concrete defect → fix the plan) or **REFUTED**
  (the plan already covers it — cite where; or it demands scope the plan rightly excludes per L5).
- **Convergence = TWO consecutive rounds with zero new VALID findings.** Stricter than code review's
  single round, because a plan has no deterministic gate — the extra clean round guards against a
  lens that simply didn't look hard enough. Prior REFUTED findings are carried forward, **not**
  re-litigated. A falling severity trend (structural → wording) is the signal you're done.
- **Anti-trivia guard.** Convergence is about *structural* defects. Once a round surfaces only
  cosmetic or wording issues, fix them ALL in one batched pass — those do **not** each reset the
  counter, and you must **never manufacture trivia** to keep the loop alive. If two rounds produce
  only cosmetic fixes and nothing structural, you have converged: do the cleanup and stop. Escalate
  the structural bar each round, not the pedantry.

## Verify discipline

- Keep only findings citing a **load-bearing plan statement** plus a concrete consequence (a way the
  plan fails, misleads an implementer, or leaves a decision unmade). Vague "could be clearer" → drop.
- **Auto-refute** anything the plan already addresses (quote the section) and anything demanding
  scope the plan deliberately deferred with a stated reason — see the plan's out-of-scope section.
- **Default-keep** a novel structural gap unless the plan disproves it.
- Findings must be **actionable against the plan** — each maps to an edit, a decision to surface, or
  a section to add. "Rewrite everything" is not a finding.

## Output contract (per round)

Report a table: every finding, its lens (L1–L6), the load-bearing quote/section, recall
(CONFIRMED/PLAUSIBLE), triage (VALID/REFUTED) and the why. Apply the VALID fixes — in the plan doc if
there is one, otherwise to the in-chat plan — then re-audit leading with a different lens. Close with
a one-table summary of all rounds plus the two clean rounds that ended it.

## Scope discipline

One plan, one concern per audit. If the plan spans multiple features, say so and audit the seam. The
audit **improves the plan in place**; it never implements it.
