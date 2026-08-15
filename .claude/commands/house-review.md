---
description: Review the current diff against this repo's rubric, looping until clean.
---

Review the working diff against this repo's rubric. The code-side counterpart to `/house-plan`.

Steps:

1. Read `docs/development/review-guide.md` — Parts A (do NOT flag) and B (DO flag), and the verdict
   vocabulary. Load it as review context. Part A is not advisory: a finding matching Part A is
   auto-refuted even if a finder raises it confidently.
2. Establish scope: the diff against the base branch, or the paths the user named. Review the diff,
   not the file's history.
3. Run whatever deterministic layers exist (`npm run type-check`, `npm run lint`, `npm test`). Do not
   block on ones that don't exist yet — this repo is young. Report what you ran and what it said.
4. Review with the rubric, paying particular attention to the rules the architecture rests on:
   `src/core/` purity, UID-not-payload tag matching, and the rule that location never touches the
   wake alarm. Those three are where a plausible-looking change does real damage.
5. **Loop until clean — with the user in the loop.** After each round:
   - **Report every finding in chat, individually** — ALL of them, not just the valid ones: the
     load-bearing line, recall (CONFIRMED / PLAUSIBLE), and a triage verdict with the why —
     **VALID** (concrete failure scenario → will fix) or **REFUTED** (Part A match, or the code
     disproves it — say which). Never fix silently; the chat report comes first.
   - **Never write review results as `.md` files into the repo.** Findings are chat only.
   - Fix the VALID findings, re-run the deterministic layers, and **re-review**.
   - **Carry the triage forward:** a finding already refuted-with-reason is not new when
     re-surfaced. Don't re-litigate it.
   - **Stop when a full round yields zero new VALID findings.**

## Do not stop until it converges

Run the whole loop in one go. Reporting a round and stopping is a handback — apply the fixes and
start the next round in the same turn. Do not ask permission to continue.

The only legitimate reason to stop early is a genuine question whose answer changes what you do next
and that you cannot settle from the repo or a sensible default.

Verify discipline: keep only findings citing a load-bearing line; auto-refute Part A; default-keep
novel findings unless the code disproves them.
