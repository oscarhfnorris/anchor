---
description: Adversarially audit a plan / design doc before it becomes code.
---

Adversarially audit a **plan** against this repo's plan-audit rubric. The planning-side counterpart
to `/house-review`: same loop-until-clean discipline, but it audits a *plan* — so there is no
compiler, no tests, no second tool. The engine is you, reading the plan adversarially through six
lenses from a **fresh angle each round**.

The target is either the **path** passed as an argument, or — when no path is given — the **plan
under discussion in chat**. Default target for this repo is `docs/plan/anchor-plan.md`. If it is
genuinely ambiguous which plan is meant, ask; never guess.

Steps:

1. Read `docs/development/plan-audit-guide.md` — the six lenses (L1 Assumptions, L2 Premortem,
   L3 Failure-modes/FMEA-DRBFM, L4 Completeness & scope, L5 Right-sizing & coherence, L6 Scenario
   walk), the verdict vocabulary, and the convergence rule. Load it as audit context.
2. Read the target plan **in full**, plus enough of the code and external reality it depends on to
   judge whether its claims are true. A plan asserting "AlarmKit supports X" is only refutable by
   checking. Ground the audit in retrievable fact, not prose — for Apple APIs the SDK's
   `.swiftinterface` is authoritative over web docs, and for Expo packages the current README is
   authoritative over model memory.
3. **Audit through all six lenses**, leading with a different lens each round. L6 for this project
   means walking *behavioural* scenarios — including an adversarial one where the user is actively
   trying to cheat the app, since that is the threat model the whole design exists to address.
4. **Loop until clean — with the user in the loop.** After each round:
   - **Report every finding to the chat, individually** — ALL of them, not just the valid ones: the
     lens (L1–L6), the **load-bearing quote/section**, recall (CONFIRMED / PLAUSIBLE), and a triage
     verdict with the why: **VALID** (a concrete defect — will fix the plan) or **REFUTED** (the plan
     already covers it — quote where; or it demands scope the plan rightly deferred per L5/YAGNI).
     Never fix silently; the chat report comes first.
   - **Results live in chat — never write audit results as `.md` files into the repo.** If the plan
     is a repo doc, editing that doc to fix findings is the whole point. If the plan is only in chat,
     present the corrected sections in chat; do NOT create a `.md` just to have something to fix.
   - Apply the VALID fixes, then **re-audit** — leading with a different lens.
   - **Carry the triage forward:** a finding already refuted-with-reason is NOT new when re-surfaced;
     don't re-litigate it, or the loop never converges.
   - **Stop when TWO CONSECUTIVE rounds yield zero new VALID findings.** The falling-severity trend
     (structural gaps → wording) is the signal you're done. **Anti-trivia guard:** once a round
     surfaces only cosmetic nits, fix them ALL in one batched pass — they don't each reset the
     counter, and never manufacture trivia to keep looping. Close with a one-table summary of all
     rounds plus the two clean rounds that ended it.
   - **A round is a FRESH pass with a new lead lens, not a re-check of your last fix.** Confirming an
     edit resolved a finding is necessary but is NOT an audit round and can NEVER count toward the
     two clean rounds. If you changed the plan this pass, the counter restarts from a fresh round.
     Declaring convergence off a fix-verification is faking the loop — do not do it.

## Do not stop until it converges

**Run the whole loop in one go.** Convergence is the exit condition — not a round count, not "enough
for now", not the point where findings get tedious. Do not hand back a half-finished loop, and do not
ask permission to continue: "shall I keep going?" is not a question, it is a pause the user has to
spend a turn undoing.

**Finishing a round is not finishing.** Reporting a round's findings and stopping is the same
handback — apply the fixes and start the next round in the same turn.

The **only** legitimate reason to stop early is a **genuine question** — one whose answer changes
what you do next and that you cannot settle from the repo, the docs, or a sensible default. Ask it
plainly and carry on from the answer. A decision the user must own is worth stopping for; a progress
check is not.

Report as you go — every round's findings, as they land — so the user can interrupt if they want to.
That is their call, not yours to pre-empt.

Verify discipline (from the rubric):

- Keep only findings citing a **load-bearing plan statement** plus a concrete consequence. Vague
  "could be clearer" → drop.
- **Auto-refute** anything the plan already addresses (cite the section) or scope it deliberately
  deferred with a stated reason. Over-scope is itself a finding (L5) — this is a personal tool, and
  building for a userbase that does not exist is a defect.
- **Default-keep** a novel structural gap unless the plan disproves it.
- Every finding must map to a concrete plan edit, a decision to surface, or a section to add.

This audit **improves the plan in place**; it never implements it. Code changes are out of scope —
that is `/house-review` once the plan is built.
