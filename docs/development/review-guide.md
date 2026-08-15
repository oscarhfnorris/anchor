# Review guide

How code review works here and the rules it applies. `/house-review` loads this. The planning-side
counterpart is `plan-audit-guide.md`.

Adapted from the approvals-app repo. The verdict machinery is unchanged; Parts A and B are rewritten
for this stack — importing that repo's Postgres, tRPC, and multi-tenant rules wholesale would be
ceremony with nothing to push back on.

## Run

**`/house-review`** — the deterministic checks plus the agent review, all triaged through this guide.
**Loops**: report findings and verdicts in chat, fix the valid ones, re-run — until a round finds
nothing new.

Deterministic layers (add as they exist; do not block on ones that don't yet):
`npm run type-check` · `npm run lint` · `npm test`.

## Verdict vocabulary

Two axes, not competing sets:

- *Recall axis* — how a reviewer EMITS a candidate: **CONFIRMED** (load-bearing line + concrete
  failure scenario) or **PLAUSIBLE** (realistic but unproven). A candidate the code disproves is
  never surfaced.
- *Decision axis* — how `/house-review` TRIAGES each candidate: **VALID** (concrete failure scenario
  → will fix) or **REFUTED** (Part A match, or the code disproves it → dropped, with the reason).
- CONFIRMED/PLAUSIBLE is the *input*; VALID/REFUTED is the *output*. A PLAUSIBLE candidate can triage
  to either. **Convergence = a full round yields zero new VALID findings.** Prior REFUTED findings
  are carried forward, not re-litigated.

**Verify discipline:** keep only findings citing a load-bearing line (else drop); auto-refute Part A;
default-keep novel findings unless disproved.

## A. DON'T flag (intentional)

- **Re-arming an alarm the user just stopped.** This is the entire enforcement mechanism, not a bug.
  The system Stop button is deprecated-but-unremovable in iOS 26.1, so re-arm is the only option.
- **The morning alarm having no give-up path.** Deliberate — see the plan, §4 D5.
- **Duplicated-looking dock/wake handling.** They are two independent features encoding genuinely
  different rules (one is suppressible, gives up, and resumes on re-entry; the other degrades, never
  gives up, and does not resume). Do not "unify" them — see the plan, §4 D10 and D13.
- **The dock/wake asymmetry on re-entry.** Deliberate, and derived from their different success
  conditions — see the plan, §4 D13. Not an oversight in whichever branch you read second.
- **`unknown` presence being treated as home.** Deliberate fail-safe — see the plan, §4 D4.
- **Proximity code declining to ring when the beacon state is ambiguous.** That is the intended bias,
  not a missed case — see the plan, §5.
- Unchanged lines — review the diff, not history.
- Missing Android implementations. Deferred by the plan.

## B. DO flag (defects)

- **A `Platform.OS` check outside `src/alarm/`.** The seam is the interface, not scattered branching.
- **`src/core/` importing `expo-*`, `react-native`, `react`, or a native module.** This is the rule
  the architecture rests on.
- **Comparing NDEF payload instead of hardware UID**, or an unnormalised UID comparison, or any path
  where an empty/failed read could match a registered tag.
- **Silencing a ringing alarm on anything less than a corroborated exit.** A bare region-exit event,
  a static `away` reading, or a stale fix must not stop an alarm. Only a fresh fix showing real
  distance beyond the radius qualifies — see the plan, §4 D3/D12.
- **The dock alarm not resuming on re-entry.** Without it, stepping outside and walking back bypasses
  Feature A completely — see the plan, §4 D13.
- **A configurable home radius accepting a value below 100m.** iOS geofencing degrades below that,
  and the floor is what stops the radius becoming a one-tap escape hatch (D14).
- **Treating `unknown` presence as `away`** — it silently weakens enforcement.
- **Proximity ringing on a single missed beacon advertisement**, or on Bluetooth being off, or
  without a debounce window. This is the highest-severity defect class in the app: it wakes the user
  at 03:00 for nothing.
- **Cross-feature coupling between `core/dock/` and `core/wake/`** beyond the one documented
  suspension rule. They are independent (plan §4 D10).
- **Alarm-critical state written only to SQLite.** The iOS widget extension is a separate process and
  cannot read it; those values belong in the App Group `UserDefaults`.
- **Behaviour rules implemented in `ui/` or a platform module** rather than `core/`. If it decides
  *when an alarm fires or clears*, it belongs in `core/` and needs a test.
- **An Expo or AlarmKit API used from memory rather than retrieved.** Especially a hallucinated
  method on a community AlarmKit bridge.
- **Unpinned versions on the AlarmKit / NFC / apple-targets packages.** They are young; drift breaks
  the build silently.
- Silent fallback on an alarm path — **fail loud, or fail toward the alarm still ringing**.
- More than one export per file in UI code / no co-located `types.ts`.
- Arbitrary spacing (`p-[13px]`) rather than the 4-point scale.
- Duplicated logic that should be a shared, tested helper. **And the inverse:** a single-use helper
  extracted only to duck a lint metric — restructure inline instead. Extraction must earn itself.
- Comments interleaved between fields of an object or array literal.
- New behaviour rule in `core/` with no test.

## C. Scope

- One concern per change. Tests added, or a stated reason.
- Every finding fixed or dismissed **with a reason**.
- Never write review results as `.md` files into the repo — findings go in chat.
