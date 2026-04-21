# Session Prompt — WP-058 Pre-Plan Disruption Pipeline

**Work Packet:** [docs/ai/work-packets/WP-058-preplan-disruption-pipeline.md](../work-packets/WP-058-preplan-disruption-pipeline.md) (amended 2026-04-20 per pre-flight PS-2 / PS-3 + copilot-check HOLD FIXes; see §Amendments A-058-01 through A-058-05)
**Execution Checklist:** [docs/ai/execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md](../execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md)
**Pre-Flight:** [docs/ai/invocations/preflight-wp058-preplan-disruption-pipeline.md](preflight-wp058-preplan-disruption-pipeline.md) (includes Copilot Check + Re-Run Copilot Check → CONFIRM 30/30 PASS)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp058.md](../session-context/session-context-wp058.md)
**Commit prefix:** `EC-058:` on every code-changing commit in the WP-058 allowlist; `SPEC:` on governance / pre-flight / governance-close commits outside the allowlist; `WP-058:` is **forbidden** (commit-msg hook rejects per P6-36).
**Pre-flight verdict:** READY TO EXECUTE (effective after PS-1 / PS-2 / PS-3 resolution + three copilot-check HOLD FIXes all landed in Commit A0 `SPEC:` bundle). WP-056 complete at `eade2d0`; WP-057 complete at `8a324f0` (governance close `7414656`); `CardExtId` type import verified at `packages/game-engine/src/index.ts:5`; `PrePlan` / `invalidationReason.effectType` / `RevealRecord` / `RevealRecord.source` canonical shapes verified at `packages/preplan/src/preplan.types.ts:29, 108, 162-168, 182-187`; preplan package category classified under D-5601 (Immutable) at `02-CODE-CATEGORIES.md:43, 168-205`; repo baseline confirmed `559 passing / 0 failing` at HEAD `7414656`.
**Copilot Check (01.7):** CONFIRM — 30/30 PASS after re-run 2026-04-20 following three HOLD FIXes (Date.now grep gate added; ledger-sole restoration test added; `requiresImmediateNotification: true` JSDoc + `// why:` upgraded). See §Copilot Check Disposition below.
**WP Class:** **Infrastructure & Verification** (runtime logic in non-authoritative layer; zero `G` mutation; zero `game.ts` wiring; zero new moves; zero new phase hooks; zero `boardgame.io` imports).
**Primary layer:** Pre-Planning (Non-Authoritative, Per-Client) — `preplan` code category per D-5601. Implementation files land under `packages/preplan/src/` only.

---

## Quick-Reference Stop Conditions (Non-Normative Summary)

This section is a **derived summary** of STOP triggers distributed across §Pre-Session Gates, §Non-Negotiable Constraints, §Verification Steps, and §Final Reminders. It is **not an independent authority** — if this summary ever diverges from the canonical sections below, the canonical sections win. Purpose: give the executor a single pre-read sanity check before committing to the full session prompt.

Execution MUST NOT begin, and MUST halt in progress, if ANY of the following is true:

- Commit A0 (`SPEC:` pre-flight bundle) is not landed (§Pre-Session Gate 2)
- Repo baseline is not exactly `559 passing / 0 failing` at session-start HEAD (§Pre-Session Gate 3)
- `packages/preplan/src/preplan.types.ts` differs from WP-056 output — `git diff` must be empty (§Non-Negotiable Constraints; §Verification Step 2)
- `packages/preplan/src/preplanStatus.ts` / `speculativePrng.ts` / `preplanSandbox.ts` / `speculativeOperations.ts` differ from WP-057 output — all four `git diff` must be empty (§Non-Negotiable Constraints; §Verification Step 3)
- Any file outside the 9-file WP-058 Commit A allowlist is modified or staged (§Files Expected to Change; §Verification Step 22)
- `packages/preplan/package.json` or `pnpm-lock.yaml` appears in `git diff --name-only` — no devDep delta anticipated for WP-058 (§Files Expected to Change; §Pre-Session Gate 3)
- `Date.now()` appears anywhere in `packages/preplan/src/` other than `speculativePrng.ts:79` (WP-057 carve-out) (§Non-Negotiable Constraints; §Verification Step 15)
- `invalidatePrePlan` increments `revision` (status + `invalidationReason` are not revision-bumping fields per `preplan.types.ts:36-38`) (§Operation invariants; §Test expectations)
- Any WP-058 function returns an aliased `sandboxState` / `revealLedger` / `planSteps` through its returned envelope (full-spread 42/42 discipline) (§Operation invariants; §Post-Mortem §6)
- `computeSourceRestoration` reads any field of `PrePlan` other than `revealLedger` (DESIGN-CONSTRAINT #3 violation) (§Ledger-sole rewind; §Test expectations)
- `DisruptionPipelineResult.requiresImmediateNotification` is typed as `boolean` instead of literal `true` (§Locked Values; §B.2)
- `buildDisruptionNotification` throws anywhere other than the single `status !== 'invalidated'` programming-error guard (§Failure signaling)
- `PREPLAN_EFFECT_TYPES` uses anything other than `['discard', 'ko', 'gain', 'other'] as const` (§Locked Values)
- Compile-time drift check in `preplanEffectTypes.ts` omits `NonNullable<>` wrapper (required because `invalidationReason` is optional) (§Locked Values)
- `affectedCardExtId: mutation.affectedCardExtId` assigned unconditionally to an `affectedCardExtId?: CardExtId` slot — fails under `exactOptionalPropertyTypes: true` (§Conditional-assignment pattern)
- Any speculative operation returns a non-null `PrePlan` when `status !== 'active'` (carries WP-057 RS-8 null-on-inactive convention) (§Operation invariants)
- Commit message starts with `WP-058:` (P6-36; §Pre-Session Gate 1; commit-msg hook rejects)
- Any 01.5 runtime-wiring-allowance edit is made — 01.5 is NOT INVOKED for this WP (§Runtime Wiring Allowance)
- Any inherited dirty-tree item or `.claude/worktrees/` content is staged (§Pre-Session Gate 4)
- Any quarantine stash `stash@{0..2}` is popped (§Pre-Session Gate 5)

If any trigger fires: **STOP immediately.** Do not force-fit. Escalate via pre-flight amendment per 01.4 §Scope-Neutral Mid-Execution Amendment (WP-031 precedent) if the divergence is legitimate; otherwise report and abort the session.

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-058:` on code-changing commits inside the WP-058 allowlist; `SPEC:` on governance / pre-flight / governance-close commits. `WP-058:` is forbidden per P6-36 (commit-msg hook rejects).

2. **Governance committed (P6-34 discipline).** Before writing any code file, run `git log --oneline -10` and confirm the Commit A0 `SPEC:` pre-flight bundle landed all of:
   - `docs/ai/execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md` (new)
   - `docs/ai/work-packets/WP-058-preplan-disruption-pipeline.md` (amended — §Amendments section A-058-01 through A-058-05 + §B.1 `SourceRestoration` + §B.2 `DisruptionPipelineResult` + §H `PREPLAN_EFFECT_TYPES` + §I exports + §J tests with 29 tests and ledger-sole test + §Files Expected to Change with 8-file allowlist + §Acceptance Criteria with Canonical Effect-Type Array subsection + §Verification Steps with escaped-pattern greps)
   - `docs/ai/invocations/preflight-wp058-preplan-disruption-pipeline.md` (new, includes Copilot Check + Re-Run Copilot Check CONFIRM)
   - `docs/ai/execution-checklists/EC_INDEX.md` (EC-058 row added between EC-057 and EC-066 under Phase 6 with status `Draft`)
   - this session prompt
   - (optional) `docs/ai/session-context/session-context-wp058.md` may still be untracked at session start; include it in Commit A0 if still uncommitted

   If any is unlanded, STOP — execution is blocked on pre-flight governance.

3. **Upstream dependency baseline.** Run:
   ```bash
   pnpm -r --if-present test
   ```
   Expect repo-wide `559 passing / 0 failing` (registry 13 / vue-sfc-loader 11 / game-engine 436 / server 6 / replay-producer 4 / arena-client 66 / preplan 23). Engine baseline = `436 tests / 109 suites / 0 failing`. Preplan baseline = `23 tests / 4 suites / 0 failing`. If the repo baseline diverges, STOP and reconcile against `WORK_INDEX.md` before proceeding — the WP-058 test-count delta (`+29 tests / +3 suites` → repo `588 / 0`) depends on this starting point.

4. **Working-tree hygiene (P6-27 / P6-44 / P6-50 discipline).** `git status --short` will show inherited dirty-tree files from prior sessions. None are in WP-058's implementation allowlist:
   - `M docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md` (unrelated)
   - `?? .claude/worktrees/` (runtime state from parallel WP-081 build-pipeline cleanup session — do NOT touch; do NOT commit)
   - `?? content/themes/heroes/` (test-time artifact from theme-validation test; unrelated to WP-058 scope — do NOT stage)
   - `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md` (unrelated)
   - `?? docs/ai/invocations/forensics-move-log-format.md` (unrelated)
   - `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md` (unrelated)
   - `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md` (unrelated)
   - `?? docs/ai/invocations/session-wp068-preferences-foundation.md` (unrelated)
   - `?? docs/ai/post-mortems/01.6-applyReplayStep.md` (unrelated)
   - `?? docs/ai/session-context/session-context-forensics-move-log-format.md` (unrelated)
   - `?? docs/ai/session-context/session-context-wp067.md` (unrelated)

   Stage files by exact name — **never** `git add .` / `git add -A` / `git add -u`. The unrelated items MUST NOT appear in any WP-058 commit.

5. **Quarantine state — do NOT disturb.**
   - `stash@{0}` — "wp-055-quarantine-viewer" (registry-viewer v1→v2). **Do NOT pop.**
   - `stash@{1}` — WP-068 / MOVE_LOG_FORMAT governance edits. **Do NOT pop.**
   - `stash@{2}` — pre-WP-062 dirty tree. **Do NOT pop.**

6. **Parallel WP-081 session (may still be live).** The registry build-pipeline cleanup landed at commit `ea5cfdd` but the `.claude/worktrees/` directory may still carry worktree residue. WP-058 touches zero registry files — no coordination required. If `.claude/worktrees/` is present at session start, leave it alone.

7. **Code-category classification confirmed (D-5601 Immutable).** WP-058 output lives under:
   - `packages/preplan/src/**` — `preplan` code category per D-5601 (Status: Immutable in `02-CODE-CATEGORIES.md:43, 168-205`). Permits `import type` from `@legendary-arena/game-engine` + Node built-ins only; forbids runtime engine imports, `boardgame.io`, `@legendary-arena/registry`, `apps/**`, `pg`, any writes to `G` / `ctx`, any persistence to storage, any wiring into `game.ts` / moves / phase hooks, `Math.random()`, `ctx.random.*`, `.reduce()`, `require(`.

   No new directory introduced by WP-058. No further classification decision needed.

8. **WP-056 + WP-057 immutability check.** Run:
   ```bash
   git diff packages/preplan/src/preplan.types.ts
   git diff packages/preplan/src/preplanStatus.ts
   git diff packages/preplan/src/speculativePrng.ts
   git diff packages/preplan/src/preplanSandbox.ts
   git diff packages/preplan/src/speculativeOperations.ts
   git diff packages/preplan/package.json
   git diff packages/preplan/tsconfig.json
   ```
   All seven diffs MUST be empty. `packages/preplan/package.json` already has `tsx` devDep + `test` script from WP-057 PS-3 — no edit required in WP-058.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause + §Escalation. WP-058 is an Infrastructure & Verification WP that introduces non-authoritative runtime logic in an existing package; it does NOT add, modify, or consume any engine-wide runtime-visible structure. Each of the four 01.5 trigger criteria is absent:

| 01.5 Trigger Criterion | Applies to WP-058? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | Zero engine type modified. All WP-058 types live in `packages/preplan/src/` — `PlayerAffectingMutation`, `DisruptionNotification`, `SourceRestoration`, `DisruptionPipelineResult`, `PrePlanEffectType`. The `PrePlan` contract from WP-056 is read-only immutable in this WP. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | Zero edits to `buildInitialGameState` or any setup orchestrator. The preplan layer is non-authoritative and never participates in setup. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | Zero moves added. `CoreMoveName` / `CORE_MOVE_NAMES` unchanged. `LegendaryGame.moves` unchanged. Engine baseline `436 / 109 / 0 fail` must hold UNCHANGED. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | Zero phase hooks added. `MATCH_PHASES` / `TURN_STAGES` unchanged. The preplan layer cannot be wired into `game.ts` — the engine does not know preplan exists (WP-028 lifecycle-prohibition precedent). |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock in §Files Expected to Change applies without the allowance. Any file beyond the allowlist is a scope violation per P6-27, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it. Per 01.5 §Escalation: the allowance *"must be invoked in the session prompt. It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."*

---

## Copilot Check (01.7) — DISPOSITION: CONFIRM

Per [docs/ai/REFERENCE/01.7-copilot-check.md](../REFERENCE/01.7-copilot-check.md) §When Copilot Check Is Required. WP-058 is **Infrastructure & Verification**, for which 01.7 is **mandatory**.

First pass (2026-04-20) returned **RISK → HOLD** with three scope-neutral FIX findings:

- **Issue 2 (Non-Determinism):** `Date.now` grep missing — WP-057 carve-out at `speculativePrng.ts:79` not binary-gated against WP-058 propagation. FIX: add `git grep -nE "Date\.now" packages/preplan/src/` expecting exactly one hit.
- **Issue 11 (Tests Validate Behavior, Not Invariants) — ledger-sole rewind:** DESIGN-CONSTRAINT #3 locked in prose but not test-enforced. FIX: add a restoration test that constructs a `PrePlan` whose `sandboxState` disagrees with `revealLedger` and asserts restoration follows the ledger.
- **Issue 15 (Missing "Why" for Invariants) — `requiresImmediateNotification: true`:** literal-true field encodes Constraint #7 in the type system but JSDoc was minimal. FIX: upgrade JSDoc + add `// why:` citing "removing this field would delete a type-level enforcement mechanism".

All three FIXes applied in A0 pre-flight bundle (scope-neutral — zero allowlist changes, zero new files, zero new function signatures; +1 test raises `disruptionPipeline.test.ts` from ~22 to 23; +1 grep in verification; +1 `// why:` location).

Re-run (2026-04-20) returned **CONFIRM** — 30/30 PASS. Session prompt generation authorized. See §Copilot Check — Re-Run in the pre-flight file for the full 30-issue trace.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — §Pre-Planning Layer, §Import Rules (Quick Reference), §Layer Boundary (authoritative reference)
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — ESM only; full English names; JSDoc on every export; `.reduce()` ban; `.test.ts` extension only; node:test runner
4. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Layer Boundary (Authoritative) — `packages/preplan/**` classified as Pre-Planning layer
5. [docs/ai/DESIGN-PREPLANNING.md](../DESIGN-PREPLANNING.md) §11 (disruption pipeline single-workflow constraint — detect / invalidate / rewind / notify must ship together; cannot be split)
6. [docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md](../DESIGN-CONSTRAINTS-PREPLANNING.md) — 12 constraints; WP-058 enforces #3 (full rewind to clean hand — sandbox destroyed; ledger consumed for source restore), #4 (binary per-player detection keyed on `affectedPlayerId`), #6 (active player unburdened — passive observation; no active-player interaction), #7 (immediate notification — delivered before interaction resumes), #9 (no information leakage — speculative deck re-shuffled on caller side; shared sources restored), #11 (understandable failures — causal metadata captured at every stage), #12 (structured notification payload). Constraints #1/#2/#5/#8/#10 were WP-057 scope — **do not re-implement**.
7. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) — `preplan` category (D-5601, Immutable) — read the full definition section (lines 168-205) for import rules, forbidden tokens, and permitted framework references
8. [docs/ai/execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md](../execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md) — **primary execution authority** (Before Starting + Locked Values + Guardrails + Required `// why:` Comments + Files to Produce + After Completing + Common Failure Smells)
9. [docs/ai/work-packets/WP-058-preplan-disruption-pipeline.md](../work-packets/WP-058-preplan-disruption-pipeline.md) — authoritative WP specification as amended 2026-04-20
10. [docs/ai/session-context/session-context-wp058.md](../session-context/session-context-wp058.md) — bridge from WP-057 closure (`8a324f0`); baselines, quarantine state, inherited dirty-tree map, upstream contracts with line numbers, five lessons-learned patterns from WP-057 (strict-tsconfig narrowing, uniform failure-signaling, spread-copy 42/42, canonical-array deferral, test wrapping), discipline precedents
11. [docs/ai/invocations/preflight-wp058-preplan-disruption-pipeline.md](preflight-wp058-preplan-disruption-pipeline.md) — pre-flight audit + copilot check + re-run copilot check CONFIRM
12. [docs/ai/DECISIONS.md](../DECISIONS.md) — D-5601 (`preplan` code category); the session may author D-5801 (or a grouped block) for the disruption-pipeline single-workflow / ledger-sole rewind / integration-adapter-boundary decisions per WP-058 §Governance
13. [packages/preplan/src/preplan.types.ts](../../../packages/preplan/src/preplan.types.ts) — **immutable in this WP** (read-only reference). WP-056 output at commit `eade2d0`. Field names, union values, invariants must match verbatim at call sites. Lines of interest: `:29` (`PrePlan`), `:66` (status union), `:77` (fingerprint NON-GUARANTEE), `:92-115` (invalidationReason + effectType union), `:132` (PrePlanSandboxState), `:162-168` (RevealRecord ledger-sole invariant), `:169` (RevealRecord), `:182-187` (source open union), `:202` (PrePlanStep).
14. [packages/preplan/src/preplanStatus.ts](../../../packages/preplan/src/preplanStatus.ts) — **immutable in this WP** (WP-057 output). Pattern to replicate in `preplanEffectTypes.ts` with `NonNullable<>` accommodation.
15. [packages/preplan/src/speculativeOperations.ts](../../../packages/preplan/src/speculativeOperations.ts) — **immutable in this WP** (WP-057 output). Spread-copy 42/42 pattern precedent to replicate in `invalidatePrePlan`.
16. [packages/preplan/src/index.ts](../../../packages/preplan/src/index.ts) — will be modified to add additive WP-058 export block (5 functions + 4 types + `PREPLAN_EFFECT_TYPES` + `PrePlanEffectType`). WP-056 + WP-057 blocks unchanged.
17. [packages/game-engine/src/index.ts](../../../packages/game-engine/src/index.ts) — line 5 re-exports `CardExtId` (read-only reference; NEVER modify from this session)
18. [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) — mandatory 10-section audit (see §Post-Mortem below)
19. [docs/ai/REFERENCE/01.4-pre-flight-invocation.md](../REFERENCE/01.4-pre-flight-invocation.md) §Established Patterns + §Precedent Log (P6-22 / P6-27 / P6-36 / P6-44 / P6-50 / P6-51 / WP-028 aliasing / WP-031 grep escaping / WP-057 full-spread 42/42) — discipline inherited by WP-058
20. [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) — this session declares NOT INVOKED (above)
21. [docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md](../post-mortems/01.6-WP-057-preplan-sandbox-execution.md) — if present at session start, §6 aliasing trace is the direct precedent for WP-058's §6

If any conflict, higher-authority documents win. WP and EC are subordinate to ARCHITECTURE.md and `.claude/rules/*.md`.

---

## Goal (Binary)

After this session, Legendary Arena has a complete disruption pipeline in the non-authoritative `@legendary-arena/preplan` package: detection of player-affecting mutations → invalidation of the affected pre-plan with causal reason → computation of source restoration instructions from the reveal ledger → construction of a structured causal notification → full pipeline orchestration. All steps are pure, return plain JSON-serializable objects, and never touch authoritative game state. Specifically:

1. **`packages/preplan/src/disruption.types.ts` exists** — exports four public types: `PlayerAffectingMutation`, `DisruptionNotification`, `SourceRestoration`, `DisruptionPipelineResult`. `DisruptionPipelineResult.requiresImmediateNotification` is typed as literal `true` (not `boolean`) with JSDoc explaining the type-level Constraint #7 enforcement.
2. **`packages/preplan/src/disruptionDetection.ts` exists** — exports `isPrePlanDisrupted(prePlan: PrePlan | null, mutation: PlayerAffectingMutation): boolean`. Returns `false` on null plan or `status !== 'active'`. Binary per-player detection — no plan-step inspection, no sandbox inspection.
3. **`packages/preplan/src/disruptionPipeline.ts` exists** — exports `invalidatePrePlan`, `computeSourceRestoration`, `buildDisruptionNotification`, `executeDisruptionPipeline`; internal non-exported `buildNotificationMessage`. `invalidatePrePlan` returns a full-spread 42/42 fresh `PrePlan` with `status: 'invalidated'` + `invalidationReason`; **does NOT increment `revision`** (status is not a revision-bumping field per `preplan.types.ts:36-38`). `computeSourceRestoration` reads only `revealLedger` (DESIGN-CONSTRAINT #3). `buildDisruptionNotification` throws ONLY on `status !== 'invalidated'` (programming-error). `executeDisruptionPipeline` composes the four and returns `DisruptionPipelineResult | null` with `requiresImmediateNotification: true` on success.
4. **`packages/preplan/src/preplanEffectTypes.ts` exists** — exports `PREPLAN_EFFECT_TYPES = ['discard', 'ko', 'gain', 'other'] as const;` and `PrePlanEffectType` derived type. Includes compile-time exhaustive check using `NonNullable<PrePlan['invalidationReason']>['effectType']` (required because `invalidationReason` is optional on `PrePlan`). Deferred from WP-056 per `preplan.types.ts:101-106` JSDoc — WP-058 is the first runtime consumer of the `effectType` closed union.
5. **`packages/preplan/src/index.ts` modified** — additive WP-058 export block appended below the existing WP-056 + WP-057 blocks. Five functions + four types + `PREPLAN_EFFECT_TYPES` + `PrePlanEffectType`. WP-056 + WP-057 blocks UNCHANGED.
6. **Three new test files exist** — `disruptionDetection.test.ts` (5 tests), `disruptionPipeline.test.ts` (23 tests including the ledger-sole Issue 11 test), `preplanEffectTypes.test.ts` (1 test). Each wraps its tests in exactly one top-level `describe()` block. Total **29 new tests / 3 new suites / 0 failing**.
7. **Conditional-assignment pattern applied** at two optional `affectedCardExtId` sites (`invalidatePrePlan` inside `invalidationReason` + `buildDisruptionNotification` return value). Tests cover both with-card and without-card branches.
8. **`packages/preplan/src/preplan.types.ts`, `preplanStatus.ts`, `speculativePrng.ts`, `preplanSandbox.ts`, `speculativeOperations.ts` all UNCHANGED** (`git diff` empty for each).
9. **`packages/preplan/package.json` and `pnpm-lock.yaml` UNCHANGED** — `tsx` devDep + test script inherited from WP-057; no new devDep anticipated for WP-058.
10. **Engine baseline UNCHANGED: `436 / 109 / 0 fail`.** Repo-wide: `559 → 588 passing / 0 failing` (preplan delta `23/4/0 → 52/7/0`).
11. **All architectural boundary greps return expected output** — no `boardgame.io` imports; no runtime engine imports (type-only permitted); no registry / server / apps imports; no `Math.random`; no `ctx.random.*`; no `require(`; no `.reduce(`; `Date.now` exactly one hit at `speculativePrng.ts:79` (WP-057 carve-out; no new hit in WP-058 files); no JSDoc references to `G` / `LegendaryGameState` / `LegendaryGame` / `boardgame.io` in prose in NEW WP-058 files (P6-50 paraphrase discipline); `ctx` permitted only in the pre-existing `ctx.turn + 1` invariant references at `preplan.types.ts:21, :51` (inherited WP-056 carve-out).
12. **`docs/ai/post-mortems/01.6-WP-058-preplan-disruption-pipeline.md` produced** per mandatory 01.6 trigger (four reasons: new long-lived abstractions; first runtime consumer of `invalidationReason.effectType` closed union; first implementation of DESIGN-CONSTRAINT #3 "reveal ledger is sole rewind authority"; first full-spread 42/42 pattern applied to a status-transition operation — not a sandbox-mutation operation as in WP-057). **Section 6 aliasing trace MANDATORY** — every returned `PrePlan` from `invalidatePrePlan` traced line-by-line to confirm `sandboxState.{hand,deck,discard,inPlay,counters}` + `revealLedger` + `planSteps` are all fresh copies; every returned `SourceRestoration` / `DisruptionNotification` / `DisruptionPipelineResult` confirmed fresh.
13. **Governance closed (Commit B):** `STATUS.md`, `WORK_INDEX.md` (WP-058 `[x]` with date + commit hash), `EC_INDEX.md` (EC-058 status Draft → Done), and any authored `D-NNNN` entries in `DECISIONS.md` + `DECISIONS_INDEX.md`.

No engine changes. No registry changes. No server changes. No client changes. No new npm dependencies. No `tsx` / `typescript` / `package.json` edits in preplan. No `pnpm-lock.yaml` delta.

---

## Locked Values (Do Not Re-Derive)

### Commit & governance prefixes

- **EC / commit prefix:** `EC-058:` on every code-changing commit in the WP-058 allowlist; `SPEC:` on governance / pre-flight / governance-close commits; `WP-058:` is **forbidden** (P6-36).
- **Three-commit topology (matching WP-056 / WP-057 Phase 6 precedent):**
  - **Commit A0 (`SPEC:`)** — pre-flight bundle: EC-058 + WP-058 amendments A-058-01 through A-058-05 + pre-flight (includes copilot check + re-run) + session-context (if still untracked) + EC_INDEX row + this session prompt. **Must be landed before Commit A.**
  - **Commit A (`EC-058:`)** — execution: 8 new files (7 under `packages/preplan/src/` + 1 post-mortem) + 1 modified file (`index.ts`) + D-entries authored during execution (if any).
  - **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` (WP-058 `[x]` with date + commit hash) + `EC_INDEX.md` (EC-058 Draft → Done with commit hash).

### Five function signatures (verbatim — from WP-058 §C, §D, §E, §F, §G; EC-058 Locked Values)

```typescript
// disruptionDetection.ts
export function isPrePlanDisrupted(
  prePlan: PrePlan | null,
  mutation: PlayerAffectingMutation,
): boolean;

// disruptionPipeline.ts
export function invalidatePrePlan(
  prePlan: PrePlan,
  mutation: PlayerAffectingMutation,
): PrePlan | null;

export function computeSourceRestoration(
  revealLedger: readonly RevealRecord[],
): SourceRestoration;

export function buildDisruptionNotification(
  invalidatedPlan: PrePlan,
  mutation: PlayerAffectingMutation,
): DisruptionNotification;

export function executeDisruptionPipeline(
  prePlan: PrePlan,
  mutation: PlayerAffectingMutation,
): DisruptionPipelineResult | null;

// Internal (non-exported) helper inside disruptionPipeline.ts
function buildNotificationMessage(
  mutation: PlayerAffectingMutation,
): string;
```

### Four public types consolidated in `disruption.types.ts` (PS-3; verbatim)

```typescript
// disruption.types.ts
import type { CardExtId } from '@legendary-arena/game-engine';
import type { PrePlan } from './preplan.types.js';

export type PlayerAffectingMutation = {
  sourcePlayerId: string;
  affectedPlayerId: string;
  effectType: 'discard' | 'ko' | 'gain' | 'other';
  effectDescription: string;
  affectedCardExtId?: CardExtId;
};

export type DisruptionNotification = {
  prePlanId: string;
  affectedPlayerId: string;
  sourcePlayerId: string;
  message: string;
  affectedCardExtId?: CardExtId;
};

export type SourceRestoration = {
  playerDeckReturns: CardExtId[];
  sharedSourceReturns: Record<string, CardExtId[]>;
};

export type DisruptionPipelineResult = {
  invalidatedPlan: PrePlan;
  sourceRestoration: SourceRestoration;
  notification: DisruptionNotification;
  requiresImmediateNotification: true;
};
```

`disruptionPipeline.ts` imports all four types via `import type` — does NOT re-declare any of them (PS-3 consolidation).

### `PREPLAN_EFFECT_TYPES` canonical array (PS-2; verbatim)

**File:** `packages/preplan/src/preplanEffectTypes.ts`

```typescript
import type { PrePlan } from './preplan.types.js';

// why: canonical readonly array paired with
// PrePlan.invalidationReason.effectType closed union; drift-detection
// test enforces parity at build time (deferred from WP-056 per
// preplan.types.ts:101-106 JSDoc — WP-058 is the first runtime
// consumer of the effectType union).
export const PREPLAN_EFFECT_TYPES = ['discard', 'ko', 'gain', 'other'] as const;

export type PrePlanEffectType = typeof PREPLAN_EFFECT_TYPES[number];

type _EffectTypeDriftCheck = PrePlanEffectType extends
  NonNullable<PrePlan['invalidationReason']>['effectType']
  ? NonNullable<PrePlan['invalidationReason']>['effectType'] extends PrePlanEffectType
    ? true
    : never
  : never;
const _effectTypeDriftProof: _EffectTypeDriftCheck = true;
void _effectTypeDriftProof;
```

Array values appear in spec order matching `preplan.types.ts:108` union declaration (`'discard' | 'ko' | 'gain' | 'other'`). `as const` mandatory. **`NonNullable<>` mandatory** — without it, the indexed type is `undefined`-contaminated and the check compiles but asserts the wrong set.

### `index.ts` new shape (verbatim — additive block below existing WP-056 + WP-057 blocks)

```typescript
// why: WP-056 shipped this surface as type-only re-exports; WP-057 (first
// runtime consumer of the pre-plan contract) adds runtime exports for
// speculative operations. Authorized by EC-057 RS-2.
// WP-058 (first runtime consumer of the invalidationReason.effectType
// union + first implementation of DESIGN-CONSTRAINT #3 ledger-sole
// rewind) extends the runtime surface additively. WP-056 + WP-057 export
// blocks are unchanged.

// Types (WP-056)
export type {
  PrePlan,
  PrePlanSandboxState,
  RevealRecord,
  PrePlanStep,
} from './preplan.types.js';

// Canonical status array + derived type (WP-057, PS-2)
export { PREPLAN_STATUS_VALUES } from './preplanStatus.js';
export type { PrePlanStatusValue } from './preplanStatus.js';

// Sandbox creation (WP-057)
export type { PlayerStateSnapshot } from './preplanSandbox.js';
export { createPrePlan, computeStateFingerprint } from './preplanSandbox.js';

// Speculative operations (WP-057)
export {
  speculativeDraw,
  speculativePlay,
  updateSpeculativeCounter,
  addPlanStep,
  speculativeSharedDraw,
} from './speculativeOperations.js';

// PRNG (WP-057)
export {
  createSpeculativePrng,
  speculativeShuffle,
  generateSpeculativeSeed,
} from './speculativePrng.js';

// Disruption types (WP-058)
export type {
  PlayerAffectingMutation,
  DisruptionNotification,
  SourceRestoration,
  DisruptionPipelineResult,
} from './disruption.types.js';

// Disruption detection (WP-058)
export { isPrePlanDisrupted } from './disruptionDetection.js';

// Disruption pipeline (WP-058)
export {
  invalidatePrePlan,
  computeSourceRestoration,
  buildDisruptionNotification,
  executeDisruptionPipeline,
} from './disruptionPipeline.js';

// Canonical effect-type array + derived type (WP-058, PS-2)
export { PREPLAN_EFFECT_TYPES } from './preplanEffectTypes.js';
export type { PrePlanEffectType } from './preplanEffectTypes.js';
```

Upgrade the existing header `// why:` comment to the two-paragraph form above. Keep every WP-056 and WP-057 export line unchanged.

### Operation invariants (all five operations + full-spread discipline)

- **Null-on-inactive convention (carries from WP-057 RS-8):**
  - `isPrePlanDisrupted` returns `false` on `prePlan === null` OR `prePlan.status !== 'active'`.
  - `invalidatePrePlan` returns `null` on `prePlan.status !== 'active'`.
  - `executeDisruptionPipeline` returns `null` when `invalidatePrePlan` returns `null`.
  - `computeSourceRestoration` never fails — empty ledger produces `{ playerDeckReturns: [], sharedSourceReturns: {} }`.
  - `buildDisruptionNotification` is the sole exception: THROWS when `invalidatedPlan.status !== 'invalidated'` (programming-error; caller misuse).

- **Programming-error throw (only one in WP-058):** `buildDisruptionNotification` throws exactly when `invalidatedPlan.status !== 'invalidated'`. Error message format VERBATIM from WP-058 §F lines 400-403:
  ```
  Cannot build notification for PrePlan ${invalidatedPlan.prePlanId}: status is '${invalidatedPlan.status}', expected 'invalidated'.
  ```
  Reserved for caller misuse; `executeDisruptionPipeline` is the only expected caller and always passes an invalidated plan. Session-context-wp058 Lesson 2: "throws reserved for programming errors, null returns for expected failure paths."

- **`PrePlan.revision` MUST NOT increment in `invalidatePrePlan`.** Per `preplan.types.ts:36-38`: "Increments on any mutation of sandboxState, revealLedger, or planSteps." Status + `invalidationReason` are NOT those three fields. Test asserts `invalidatedPlan.revision === prePlan.revision`.

- **Full-spread 42/42 discipline for `invalidatePrePlan` return (RS-3, mirrors WP-057 post-mortem §6):** every field of the returned `PrePlan` is a fresh copy — `sandboxState.hand`, `sandboxState.deck`, `sandboxState.discard`, `sandboxState.inPlay`, `sandboxState.counters`, `revealLedger`, `planSteps` — even though invalidation does not semantically change them. The `{ ...prePlan, status: 'invalidated', invalidationReason: {...} }` partial-spread shortcut (WP-058 §D skeleton) is **too loose** — expand to full-field fresh copies. 01.6 §6 aliasing trace MANDATORY.

- **Conditional-assignment for optional `affectedCardExtId` (RS-4):** under `exactOptionalPropertyTypes: true` (`packages/preplan/tsconfig.json:8`), assigning `undefined` to a `field?: CardExtId` slot fails typecheck. Build the base object without `affectedCardExtId`, then assign in an `if (mutation.affectedCardExtId !== undefined)` block. Applies at two sites: (a) `invalidatePrePlan` → `invalidationReason.affectedCardExtId`; (b) `buildDisruptionNotification` → returned `DisruptionNotification.affectedCardExtId`.

- **Ledger-sole rewind authority (DESIGN-CONSTRAINT #3, `preplan.types.ts:162-168`):** `computeSourceRestoration` reads only `revealLedger: readonly RevealRecord[]`. It never inspects `PrePlan.sandboxState`. The new ledger-sole test (Issue 11 FIX) enforces this by passing a plan whose sandbox contents disagree with the ledger.

- **Source partitioning semantics (WP-058 §E):** `record.source === 'player-deck'` → `playerDeckReturns.push(record.cardExtId)`; every other value → `sharedSourceReturns[record.source]` (initialized to `[]` on first encounter via `if (!sharedSourceReturns[record.source]) sharedSourceReturns[record.source] = [];`, then pushed). Iteration via `for (const record of revealLedger)` preserves insertion order. **No `.reduce()`** — code-style invariant extends to preplan.

- **Pipeline ledger source (RS-8):** `executeDisruptionPipeline` passes `prePlan.revealLedger` (NOT `invalidatedPlan.revealLedger`) to `computeSourceRestoration` — equivalent because invalidation does not mutate ledger, and avoids coupling to `invalidatePrePlan`'s spread-copy semantics. Required `// why:` comment at the call site locks the rationale.

- **`requiresImmediateNotification: true` literal (Copilot Issue 15):** the field MUST be typed as literal `true` (not `boolean`). Widening to `boolean` deletes the type-level Constraint #7 encoding. Tests assert `result.requiresImmediateNotification === true` on every successful pipeline result.

- **First-mutation-wins mechanics:** WP-058 §Architectural Placement lines 120-125 locks "multiple mutations for same player → first produces result, second returns null." This is enforced mechanically by the status guard in `isPrePlanDisrupted` + `invalidatePrePlan` — **no caller dedup logic required**. Test pattern: call pipeline twice with the same mutation on the same plan; first returns a result, second returns `null`.

### Test baseline lock

- **Registry package:** `13 / 2 / 0 fail` UNCHANGED
- **vue-sfc-loader package:** `11 / 0 / 0 fail` UNCHANGED
- **game-engine package:** `436 / 109 / 0 fail` UNCHANGED (WP-058 touches ZERO engine code)
- **server package:** `6 / 2 / 0 fail` UNCHANGED
- **replay-producer package:** `4 / 2 / 0 fail` UNCHANGED
- **arena-client package:** `66 / 0 / 0 fail` UNCHANGED
- **preplan package:** `23 / 4 / 0 fail → 52 / 7 / 0 fail` — three new test files, each wrapped in one top-level `describe()` block
- **Repo-wide:** `559 / 0 fail → 588 / 0 fail`

### Test file structure

- `disruptionDetection.test.ts` — 1 `describe('preplan disruption detection (WP-058)')` block, **5 tests** (owner match → true; other-player → false; null plan → false; already-invalidated → false; already-consumed → false)
- `disruptionPipeline.test.ts` — 1 `describe('preplan disruption pipeline (WP-058)')` block, **23 tests**:
  - Invalidation: 4 (active → invalidated status; invalidationReason populated correctly; null on non-active; input not mutated + revision unchanged)
  - Source restoration: 6 (empty ledger; player-deck returns; shared-source returns; mixed sources separated; order preserved; **ledger-sole: sandbox disagrees with ledger, restoration follows ledger [Issue 11 FIX]**)
  - Notification: 5 (ids correct; message includes effect description; message includes card when set; message omits card when absent; throws on non-invalidated)
  - Full pipeline: 7 (active+matching → full result with `requiresImmediateNotification: true`; active+non-matching → null via detection; non-active → null; multiple mutations same player → first result then null; invalidatedPlan.status is 'invalidated'; sourceRestoration matches ledger; notification.message includes cause)
  - Acceptance scenario: 1 (create → speculative draw/play → disrupt → verify)
- `preplanEffectTypes.test.ts` — 1 `describe('preplan effect-type drift (WP-058)')` block, **1 test** (runtime set-equality between `new Set(PREPLAN_EFFECT_TYPES)` and `new Set<PrePlanEffectType>(['discard', 'ko', 'gain', 'other'])`)

Bare top-level `test()` calls are **forbidden** — they do not register as suites under `node:test` (WP-031 / WP-057 precedent). The +3 suite count is locked. Parameterized tests within a single `test()` call are acceptable (e.g., a `for (const status of ['invalidated', 'consumed'])` loop inside one `test` counts as one test but covers multiple cases) — this matches the WP-057 Test 12/13 precedent.

### Lockfile and package.json scope

- `packages/preplan/package.json` and `pnpm-lock.yaml` are **NOT in the allowlist** for WP-058.
- `tsx` devDep + test script inherited from WP-057 PS-3 landing; no new devDep required.
- If `pnpm install` produces a lockfile delta, it is a P6-44 tripwire — STOP and investigate before commit.

### `Date.now()` permission scope (unchanged from WP-057)

- Permitted at exactly ONE location: `packages/preplan/src/speculativePrng.ts:79` inside the `generateSpeculativeSeed` function body.
- Verification grep expects EXACTLY ONE HIT at that location. Any additional hit in a WP-058 new file is an unauthorized wall-clock read — STOP and escalate.
- WP-058 consumes no randomness by design (detection / invalidation / restoration derivation / notification construction are all deterministic). No new `Date.now` call is legitimate.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` anywhere in `packages/preplan/` (tests included). WP-058 consumes no randomness.
- Never use `ctx.random.*` — no `ctx` exists in the preplan layer.
- Never throw inside WP-058 code EXCEPT at the single `buildDisruptionNotification` programming-error guard. `null` return for every expected failure path.
- Never persist `PrePlan`, `PlayerAffectingMutation`, `DisruptionNotification`, `SourceRestoration`, `DisruptionPipelineResult`, or any of their fields — ARCHITECTURE.md §Pre-Planning Layer declares the entire layer non-persistent.
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`.
- `node:` prefix on all Node.js built-in imports (e.g., `import { ok, strictEqual, throws, deepStrictEqual } from 'node:assert/strict'`).
- Test files use `.test.ts` extension — never `.test.mjs`.
- Full file contents for every new or modified file in the output — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — full English names, no abbreviations; every function has JSDoc; no higher-order functions unless framework-required.

**Packet-specific (layer discipline — `preplan` code category per D-5601):**
- **Pre-Planning layer only** — new files live in `packages/preplan/src/` only.
- **No runtime engine imports** — zero bare `import { ... } from '@legendary-arena/game-engine'`. Type-only imports are permitted (`import type { CardExtId } from '@legendary-arena/game-engine'` is the only engine reference).
- **No `boardgame.io` imports** — zero; grep-verified with escaped-dot pattern (`from ['"]boardgame\.io`) per WP-031 P6-22.
- **No `@legendary-arena/registry` imports** — zero.
- **No `apps/**` imports** — zero.
- **No `pg` imports** — zero.
- **No `require()`** — grep-verified with escaped-paren pattern (`require\(`) per P6-22.
- **No `Math.random`** — grep-verified with escaped-dot pattern (`Math\.random`) per P6-22.
- **No `.reduce()`** — grep-verified with escaped-dot + paren (`\.reduce\(`) per P6-22. `computeSourceRestoration` uses explicit `for...of` with a mutable accumulator; no `.reduce()`.
- **`Date.now()` permitted exactly ONCE** at `speculativePrng.ts:79` (WP-057 carve-out) — grep gate expects exactly one hit. Any additional hit in WP-058 new files is a scope violation.
- **No wiring into `game.ts`, `LegendaryGame.moves`, phase hooks, or any engine lifecycle point** — WP-028 lifecycle-prohibition precedent.
- **No modifications to `packages/preplan/src/preplan.types.ts`** — WP-056 output immutable in this WP.
- **No modifications to `packages/preplan/src/preplanStatus.ts` / `speculativePrng.ts` / `preplanSandbox.ts` / `speculativeOperations.ts`** — WP-057 output immutable in this WP.
- **No modifications to `packages/preplan/package.json` or `pnpm-lock.yaml`** — inherited from WP-057; no devDep delta in WP-058.
- **`DisruptionPipelineResult.requiresImmediateNotification` MUST be typed as literal `true`** — not `boolean`, not `readonly true`, just `true`. Widening deletes the type-level Constraint #7 encoding.
- **`invalidatePrePlan` MUST NOT increment `revision`** — status + `invalidationReason` are not revision-bumping fields per `preplan.types.ts:36-38`.
- **`computeSourceRestoration` MUST read only `revealLedger`** — never `sandboxState`. DESIGN-CONSTRAINT #3.
- **`executeDisruptionPipeline` MUST read `prePlan.revealLedger`** (not `invalidatedPlan.revealLedger`) with required `// why:` comment.
- **Full-spread 42/42 discipline on every returned envelope** — `invalidatePrePlan` output carries fresh nested arrays/objects for `sandboxState.{hand,deck,discard,inPlay,counters}` + `revealLedger` + `planSteps` even when invalidation does not change them semantically.
- **Conditional-assignment pattern for optional `affectedCardExtId`** — never assign `undefined`; use `if (...) { result.affectedCardExtId = ... }` instead.

**Paraphrase discipline (P6-50):** JSDoc comments in new `.ts` files must not reference engine runtime concepts by name. Forbidden tokens in JSDoc prose and code comments in NEW WP-058 files: `G`, `LegendaryGameState`, `LegendaryGame`, `boardgame.io`. `ctx` is permitted only in the pre-existing `ctx.turn + 1` invariant references at `preplan.types.ts:21, :51` (inherited WP-056 carve-out — do NOT extend). Rephrase as needed: "the game framework" / "authoritative engine state" / "the engine's authoritative state". Verification greps will reject violations using escaped-dot patterns.

**Aliasing prevention (WP-028 + WP-057 precedent):** every `sandboxState.hand` / `deck` / `discard` / `inPlay` / `counters` array/object returned inside a new `PrePlan` (and every `playerDeckReturns` / `sharedSourceReturns` array inside `SourceRestoration`) must be a fresh spread/slice/object-literal copy. Standard `JSON.stringify` equality tests cannot detect aliasing — inspection during post-mortem §6 is mandatory. Tests include an "input not mutated" assertion after `invalidatePrePlan`.

**Session protocol:**
- If any contract, field name, or reference seems unclear, STOP and ask — never guess or invent.
- Reality-reconciliation at every Locked Value reference: cross-check against `packages/preplan/src/preplan.types.ts` for type shapes, `packages/game-engine/src/index.ts:5` for `CardExtId`, `packages/preplan/src/preplanStatus.ts` for the canonical-array + compile-time drift-check pattern to replicate in `preplanEffectTypes.ts`.

---

## Files Expected to Change (Strict Allowlist)

Commit A (`EC-058:`) may modify ONLY the following files. Anything outside is a scope violation per P6-27.

### New files (8)

1. `packages/preplan/src/disruption.types.ts` — four public types consolidated per PS-3 (`PlayerAffectingMutation`, `DisruptionNotification`, `SourceRestoration`, `DisruptionPipelineResult`)
2. `packages/preplan/src/disruptionDetection.ts` — `isPrePlanDisrupted` only
3. `packages/preplan/src/disruptionPipeline.ts` — `invalidatePrePlan`, `computeSourceRestoration`, `buildDisruptionNotification`, internal `buildNotificationMessage`, `executeDisruptionPipeline`; imports types via `import type`
4. `packages/preplan/src/preplanEffectTypes.ts` — `PREPLAN_EFFECT_TYPES` readonly array + `PrePlanEffectType` + compile-time drift check with `NonNullable<>` (PS-2)
5. `packages/preplan/src/disruptionDetection.test.ts` — 5 tests in `describe('preplan disruption detection (WP-058)')`
6. `packages/preplan/src/disruptionPipeline.test.ts` — 23 tests in `describe('preplan disruption pipeline (WP-058)')`, including the ledger-sole Issue 11 test
7. `packages/preplan/src/preplanEffectTypes.test.ts` — 1 test in `describe('preplan effect-type drift (WP-058)')`
8. `docs/ai/post-mortems/01.6-WP-058-preplan-disruption-pipeline.md` — mandatory 10-section post-mortem (four triggers fire)

### Modified files (1 in Commit A + 3 governance in Commit B)

9. `packages/preplan/src/index.ts` — add additive WP-058 export block below existing WP-056 + WP-057 blocks; upgrade header `// why:` comment (Commit A)
10. `docs/ai/STATUS.md` — add "WP-058 / EC-058 Executed — Pre-Plan Disruption Pipeline" entry under Current State with date + commit hash (Commit B)
11. `docs/ai/work-packets/WORK_INDEX.md` — flip WP-058 entry from `[ ] ... ✅ Reviewed — pending` to `[x] ... ✅ Reviewed — Executed YYYY-MM-DD at commit <hash>` (Commit B)
12. `docs/ai/execution-checklists/EC_INDEX.md` — EC-058 status flipped Draft → Done; entry updated with commit hash (Commit B)
13. (optional) `docs/ai/DECISIONS.md` + `docs/ai/DECISIONS_INDEX.md` — if D-5801 (or split entries) authored during execution for WP-058 §Governance decisions (single-workflow pipeline; ledger-sole rewind; integration-adapter boundary; binary per-player detection; pipeline produces instructions not actions)

### UNCHANGED files (tripwires)

- **`packages/preplan/src/preplan.types.ts`** — **immutable in this WP** (WP-056 output). `git diff packages/preplan/src/preplan.types.ts` must be empty.
- **`packages/preplan/src/preplanStatus.ts`** — **immutable in this WP** (WP-057 output). `git diff` must be empty.
- **`packages/preplan/src/speculativePrng.ts`** — **immutable in this WP** (WP-057 output). `git diff` must be empty.
- **`packages/preplan/src/preplanSandbox.ts`** — **immutable in this WP** (WP-057 output). `git diff` must be empty.
- **`packages/preplan/src/speculativeOperations.ts`** — **immutable in this WP** (WP-057 output). `git diff` must be empty.
- **`packages/preplan/package.json`** — unchanged; `tsx` devDep + test script inherited from WP-057.
- **`packages/preplan/tsconfig.json`** — unchanged.
- **`pnpm-lock.yaml`** — unchanged; no devDep delta for WP-058.
- **`pnpm-workspace.yaml`** — unchanged.
- **`packages/game-engine/**`** — every engine file unchanged. Engine baseline `436 / 109 / 0` must hold.
- **`packages/registry/**`** — registry layer unchanged.
- **`packages/vue-sfc-loader/**`** — unchanged.
- **`apps/server/**`**, **`apps/arena-client/**`**, **`apps/registry-viewer/**`**, **`apps/replay-producer/**`** — all unchanged.
- Root `package.json` — unchanged.

### Forbidden files (scope-violation tripwire)

- Any file under `packages/game-engine/**` — layer boundary violation (engine does not know preplan exists)
- Any file under `packages/registry/**` — scope violation
- Any file under `packages/vue-sfc-loader/**` — scope violation
- Any file under `apps/**` — layer boundary violation
- `packages/preplan/src/preplan.types.ts` — immutable (WP-056 output)
- `packages/preplan/src/preplanStatus.ts` / `speculativePrng.ts` / `preplanSandbox.ts` / `speculativeOperations.ts` — immutable (WP-057 output)
- `packages/preplan/package.json`, `packages/preplan/tsconfig.json` — unchanged
- `pnpm-workspace.yaml`, `pnpm-lock.yaml`, root `package.json` — unchanged
- Any `.claude/worktrees/**` — parallel-session state
- Any stash@{0}/{1}/{2} pop — quarantined content owned by other sessions

---

## Required `// why:` Comments (Verbatim Placement)

Copy the `// why:` comment bodies below verbatim (or paraphrase only for minor readability — the *rationale* must remain intact). Do not omit any.

**`disruptionDetection.ts` `isPrePlanDisrupted` — at the null-plan + status guards:**
```typescript
// why: pre-plan is advisory and only mutates while active; false-return
// signals "no disruption possible" without throwing. Binary per-player
// detection per DESIGN-CONSTRAINT #4 — no plan-step or sandbox inspection.
// Null-on-inactive convention extended from WP-057 RS-8 to the detection
// layer.
```

**`disruptionPipeline.ts` `invalidatePrePlan` — at the `status !== 'active'` guard:**
```typescript
// why: null-return signals non-active status without throwing. First-
// mutation-wins semantics for multiple mutations per move (WP-058
// §Architectural Placement lines 120-125) is enforced mechanically
// here — a second caller receives a plan whose status is already
// 'invalidated' and short-circuits to null. No caller dedup logic.
```

**`disruptionPipeline.ts` `invalidatePrePlan` — at the full-spread return (first occurrence):**
```typescript
// why: fresh copies for every sandboxState field + revealLedger +
// planSteps. Invalidation does not semantically change these three
// fields, but returning them by reference would let a consumer mutate
// the input PrePlan through the output envelope (WP-028 aliasing
// precedent; WP-057 post-mortem §6 42/42 pattern). Standard JSON-
// equality tests cannot detect aliasing — post-mortem §6 trace is
// the backstop.
```

**`disruptionPipeline.ts` `invalidatePrePlan` — at the conditional-assignment for `invalidationReason.affectedCardExtId`:**
```typescript
// why: exactOptionalPropertyTypes forbids explicit undefined
// assignment on an optional field (packages/preplan/tsconfig.json:8).
// Build invalidationReason without affectedCardExtId, then assign in
// an if-block only when mutation.affectedCardExtId is defined
// (session-context-wp058 Lesson 1; D-2901 preserveHandCards precedent).
```

**`disruptionPipeline.ts` `computeSourceRestoration` — at the `for (const record of revealLedger)` loop:**
```typescript
// why: reveal ledger is the sole authority for deterministic rewind
// (DESIGN-CONSTRAINT #3, preplan.types.ts:162-168). This loop reads
// only revealLedger; sandboxState is not inspected anywhere in this
// function. Any rewind logic that reads sandboxState is invalid —
// a future refactor that does so fails the ledger-sole test
// (Copilot Issue 11 FIX).
```

**`disruptionPipeline.ts` `buildDisruptionNotification` — at the `status !== 'invalidated'` throw:**
```typescript
// why: programming-error throw — executeDisruptionPipeline is the
// only expected caller and always passes an invalidated plan. Any
// other caller is misusing the API. WP-057 convention: throws
// reserved for programming errors, null returns for expected failure
// paths. Session-context-wp058 Lesson 2.
```

**`disruptionPipeline.ts` `buildDisruptionNotification` — at the conditional-assignment for returned `affectedCardExtId`:**
```typescript
// why: exactOptionalPropertyTypes forbids explicit undefined
// assignment (same rationale as invalidatePrePlan). Build the base
// notification without affectedCardExtId, assign in an if-block
// only when mutation.affectedCardExtId is defined.
```

**`disruptionPipeline.ts` `executeDisruptionPipeline` — at the `computeSourceRestoration(prePlan.revealLedger)` call:**
```typescript
// why: invalidation does not mutate the ledger; reading from the
// pre-invalidation plan is equivalent to reading from invalidatedPlan
// and avoids coupling to invalidatePrePlan's spread-copy semantics
// (pre-flight RS-8).
```

**`disruption.types.ts` — header block or at `DisruptionPipelineResult.requiresImmediateNotification`:**
```typescript
// why: requiresImmediateNotification is typed as literal `true` (not
// `boolean`) to encode Constraint #7 (immediate notification) in the
// type system. Callers check this field to confirm they are handling
// the notification requirement. Removing the field would delete a
// type-level enforcement mechanism — the notification requirement
// would then live only in prose. Do not "clean up" this field as
// redundant data (Copilot Issue 15).
```

**`preplanEffectTypes.ts` at the `as const` on `PREPLAN_EFFECT_TYPES`:** (already in the verbatim code block above)

**`index.ts` header comment:** (already in the verbatim code block above — the two-paragraph upgrade)

---

## Implementation Plan (Section by Section)

Write the files in this order. Each section ends with a "sanity check" that can be run locally before moving on.

### Step 1 — `disruption.types.ts` (types-only, no runtime)

Write the four public types verbatim per §Locked Values. Include the header `// why:` comment explaining PS-3 consolidation. No functions. No runtime code.

**Sanity check:** `pnpm --filter @legendary-arena/preplan build` — must exit 0 (types compile cleanly; `PrePlan` import resolves; `DisruptionPipelineResult.requiresImmediateNotification: true` parses as a literal type).

### Step 2 — `preplanEffectTypes.ts` (canonical array + compile-time drift check)

Write verbatim per §Locked Values. The `NonNullable<>` wrapper is mandatory — `invalidationReason` is optional on `PrePlan`, so without `NonNullable<>` the indexed access `PrePlan['invalidationReason']['effectType']` fails typecheck.

**Sanity check:** `pnpm --filter @legendary-arena/preplan build` — must exit 0. Drift-check constant `_effectTypeDriftProof: true = true` must assign.

### Step 3 — `disruptionDetection.ts` (five-line implementation)

Single exported function. Import `type { PrePlan }` from `./preplan.types.js` and `type { PlayerAffectingMutation }` from `./disruption.types.js`. Implementation:

```typescript
export function isPrePlanDisrupted(
  prePlan: PrePlan | null,
  mutation: PlayerAffectingMutation,
): boolean {
  // why: pre-plan is advisory and only mutates while active; false-return
  // signals "no disruption possible" without throwing. Binary per-player
  // detection per DESIGN-CONSTRAINT #4 — no plan-step or sandbox inspection.
  // Null-on-inactive convention extended from WP-057 RS-8 to the detection
  // layer.
  if (prePlan === null) return false;
  if (prePlan.status !== 'active') return false;
  return prePlan.playerId === mutation.affectedPlayerId;
}
```

**Sanity check:** file compiles; function body is purely expression-based (no mutation, no side effects).

### Step 4 — `disruptionPipeline.ts` (five functions + one internal helper)

This is the largest file. Write the functions in this order: `invalidatePrePlan` → `computeSourceRestoration` → `buildNotificationMessage` (internal) → `buildDisruptionNotification` → `executeDisruptionPipeline`. All imports are `import type`.

**`invalidatePrePlan` — key points:**
- Early `return null` on `status !== 'active'`.
- Return a **full-spread 42/42** `PrePlan` — every nested array/object is a fresh copy (mirror `speculativeOperations.ts:41-56` pattern from WP-057).
- Build `invalidationReason` using conditional-assignment for `affectedCardExtId`.
- Do NOT include `revision: prePlan.revision + 1` — revision does NOT increment.

Illustrative shape (pattern, not verbatim):
```typescript
const invalidationReason: PrePlan['invalidationReason'] = {
  sourcePlayerId: mutation.sourcePlayerId,
  effectType: mutation.effectType,
  effectDescription: mutation.effectDescription,
};
if (mutation.affectedCardExtId !== undefined) {
  invalidationReason.affectedCardExtId = mutation.affectedCardExtId;
}
return {
  ...prePlan,
  status: 'invalidated',
  invalidationReason,
  sandboxState: {
    hand: [...prePlan.sandboxState.hand],
    deck: [...prePlan.sandboxState.deck],
    discard: [...prePlan.sandboxState.discard],
    inPlay: [...prePlan.sandboxState.inPlay],
    counters: { ...prePlan.sandboxState.counters },
  },
  revealLedger: [...prePlan.revealLedger],
  planSteps: [...prePlan.planSteps],
};
```

Note: `revision` is NOT listed — the `...prePlan` top-level spread carries it through unchanged.

**`computeSourceRestoration` — key points:**
- Single `for (const record of revealLedger)` loop with mutable `playerDeckReturns: CardExtId[]` and `sharedSourceReturns: Record<string, CardExtId[]>` accumulators.
- `record.source === 'player-deck'` → push to `playerDeckReturns`.
- Otherwise → lazily initialize `sharedSourceReturns[record.source]` to `[]`, then push.
- No `.reduce()`. Read only `revealLedger` — NEVER `sandboxState`.

**`buildNotificationMessage` (internal) — key points:**
- Non-exported function.
- Format: `` `Player ${mutation.sourcePlayerId}'s ${mutation.effectDescription}` `` as base, then append `` ` (${mutation.affectedCardExtId}).` `` if card is set, else append `` `.` ``.
- Returns a single string.

**`buildDisruptionNotification` — key points:**
- Throws verbatim per §Locked Values when `invalidatedPlan.status !== 'invalidated'`.
- Uses conditional-assignment for returned `affectedCardExtId`.
- Calls `buildNotificationMessage(mutation)` for the `message` field.

**`executeDisruptionPipeline` — key points:**
- `const invalidatedPlan = invalidatePrePlan(prePlan, mutation);`
- `if (invalidatedPlan === null) return null;`
- `const sourceRestoration = computeSourceRestoration(prePlan.revealLedger);` — **read from `prePlan`, not `invalidatedPlan`**; required `// why:` comment at this line.
- `const notification = buildDisruptionNotification(invalidatedPlan, mutation);`
- Return `{ invalidatedPlan, sourceRestoration, notification, requiresImmediateNotification: true };`

**Sanity check:** `pnpm --filter @legendary-arena/preplan build` exits 0. Grep for `Date.now` / `Math.random` / `ctx.random` / `.reduce(` in the new file returns zero hits.

### Step 5 — `index.ts` modification

Upgrade the header `// why:` comment to the two-paragraph form per §Locked Values. Append the WP-058 additive export block below the existing WP-057 PRNG block. Do NOT reorder or edit existing WP-056 or WP-057 exports.

**Sanity check:** `git diff packages/preplan/src/index.ts` — only additions + the header comment upgrade. No existing export line changed.

### Step 6 — Tests

Write three test files, each wrapped in one top-level `describe()` block.

**`disruptionDetection.test.ts`:** 5 tests per WP-058 §J detection list. Use inline fixture builders for minimal `PrePlan` instances (status + playerId + minimal sandbox).

**`disruptionPipeline.test.ts`:** 23 tests per WP-058 §J pipeline list. Sub-groupings (invalidation / restoration / notification / full pipeline / acceptance) live as flat `test()` calls inside the single `describe`. Use descriptive test names that mirror the acceptance-criterion checklist entries.

Key tests to write carefully:
- **Invalidation #4 "Input plan is not mutated":** assert `invalidatedPlan.revision === prePlan.revision` AND `prePlan.sandboxState.hand === prePlan.sandboxState.hand` (reference-equality on input before and after the call). Also assert `invalidatedPlan.sandboxState.hand !== prePlan.sandboxState.hand` (fresh copy on output).
- **Restoration #6 (Copilot Issue 11 FIX) "ledger-sole":** construct a `PrePlan` where `sandboxState.hand = ['other-1']`, `sandboxState.deck = ['other-2']`, `sandboxState.discard = []`, `sandboxState.inPlay = []`, `sandboxState.counters = {}`, but `revealLedger` contains records with `cardExtId` values NOT in the sandbox (e.g., `{ source: 'player-deck', cardExtId: 'ledger-only-1', revealIndex: 0 }`). Call `computeSourceRestoration(plan.revealLedger)`. Assert the result contains EXACTLY the ledger-derived cards (`['ledger-only-1']` in `playerDeckReturns`) and IGNORES the sandbox contents.
- **Notification #5 "Throws on non-invalidated":** use `assert.throws(() => buildDisruptionNotification(activePlan, mutation), /expected 'invalidated'/);` with the exact error template.
- **Full pipeline #4 "Multiple mutations for same player":** call `executeDisruptionPipeline(plan, mutation1)` — expect a result. Then call `executeDisruptionPipeline(result.invalidatedPlan, mutation2)` — expect `null`.
- **Full pipeline "requiresImmediateNotification":** assert `result.requiresImmediateNotification === true`. This tests both the literal-type encoding and the runtime value.
- **Acceptance scenario:** use WP-057's `createPrePlan` + `speculativeDraw` + `speculativePlay` to build up an active plan with a non-empty `revealLedger`, then disrupt it, then assert the restoration matches the ledger. Verify `createPrePlan(updatedSnapshot, newPrePlanId, seed)` succeeds after disruption.

**`preplanEffectTypes.test.ts`:** 1 test doing runtime set-equality. Pattern:
```typescript
import { test, describe } from 'node:test';
import { deepStrictEqual } from 'node:assert/strict';
import { PREPLAN_EFFECT_TYPES } from './preplanEffectTypes.js';
import type { PrePlanEffectType } from './preplanEffectTypes.js';

describe('preplan effect-type drift (WP-058)', () => {
  test('PREPLAN_EFFECT_TYPES matches PrePlanEffectType set exactly', () => {
    const expected = new Set<PrePlanEffectType>(['discard', 'ko', 'gain', 'other']);
    const actual = new Set(PREPLAN_EFFECT_TYPES);
    deepStrictEqual(actual, expected);
  });
});
```

**Sanity check:** `pnpm --filter @legendary-arena/preplan test` — expect `52 passing / 7 suites / 0 failing`.

### Step 7 — Post-Mortem

Author `docs/ai/post-mortems/01.6-WP-058-preplan-disruption-pipeline.md` per [01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). Ten sections; §6 aliasing trace is MANDATORY (four triggers fire). See §Post-Mortem Requirements below.

**Sanity check:** file present; §6 traces every return statement in `invalidatePrePlan` + `computeSourceRestoration` + `buildDisruptionNotification` + `executeDisruptionPipeline` line-by-line to confirm fresh copies.

### Step 8 — Verification gates

Run every grep + build + test gate per §Verification Steps below. All must pass before staging for Commit A.

### Step 9 — Commit A staging

Stage ONLY the 9-file allowlist (8 new + 1 modified `index.ts`). If D-5801 authored, include `DECISIONS.md` + `DECISIONS_INDEX.md`. Run `git diff --name-only` and confirm zero unexpected files. Commit with `EC-058:` prefix.

### Step 10 — Commit B (governance close)

Update `STATUS.md`, `WORK_INDEX.md` (flip `[ ]` → `[x]` with date + Commit A hash), `EC_INDEX.md` (Draft → Done with Commit A hash). Commit with `SPEC:` prefix.

---

## Verification Steps (All Must Pass Before Commit A)

Run each command and confirm the expected output. If any step fails, STOP and reconcile.

1. **Build:** `pnpm --filter @legendary-arena/preplan build` → exits 0. `packages/preplan/dist/` contains `.js` + `.d.ts` for all 8 new files + regenerated `index.js`/`index.d.ts`.

2. **Full repo build:** `pnpm -r build` → exits 0.

3. **Tests:** `pnpm -r --if-present test` → preplan delta `23/4/0 → 52/7/0`; engine UNCHANGED at `436/109/0`; registry / vue-sfc-loader / server / replay-producer / arena-client all UNCHANGED; repo-wide `559 → 588 passing / 0 failing`.

4. **Immutable file check (WP-056 + WP-057 outputs):**
   ```bash
   git diff packages/preplan/src/preplan.types.ts
   git diff packages/preplan/src/preplanStatus.ts
   git diff packages/preplan/src/speculativePrng.ts
   git diff packages/preplan/src/preplanSandbox.ts
   git diff packages/preplan/src/speculativeOperations.ts
   ```
   All five diffs must be empty.

5. **package.json / lockfile / tsconfig scope check:**
   ```bash
   git diff packages/preplan/package.json
   git diff packages/preplan/tsconfig.json
   git diff pnpm-lock.yaml
   git diff pnpm-workspace.yaml
   ```
   All four diffs must be empty.

6. **`boardgame.io` import gate (escaped-dot per P6-22):**
   ```bash
   git grep -nE "from ['\"]boardgame\\.io" packages/preplan/
   ```
   → zero hits.

7. **Runtime engine import gate:**
   ```bash
   git grep -nE "from ['\"]@legendary-arena/game-engine['\"]" packages/preplan/src/
   ```
   → only lines beginning `import type` in NEW WP-058 files (plus the pre-existing line in `speculativeOperations.ts` for `CardExtId` carried from WP-057).

8. **Registry / pg / apps import gates:**
   ```bash
   git grep -nE "from ['\"]@legendary-arena/registry" packages/preplan/
   git grep -nE "from ['\"]pg" packages/preplan/
   git grep -nE "from ['\"]apps/" packages/preplan/
   ```
   → all three zero hits.

9. **Randomness gates:**
   ```bash
   git grep -nE "Math\\.random" packages/preplan/
   git grep -nE "ctx\\.random" packages/preplan/
   ```
   → both zero hits.

10. **ESM + `.reduce()` gates:**
    ```bash
    git grep -nE "require\\(" packages/preplan/
    git grep -nE "\\.reduce\\(" packages/preplan/
    ```
    → both zero hits.

11. **Date.now carve-out gate (WP-057 inheritance + Copilot Issue 2):**
    ```bash
    git grep -nE "Date\\.now" packages/preplan/src/
    ```
    → **exactly one hit** at `packages/preplan/src/speculativePrng.ts:79` inside `generateSpeculativeSeed`. Any additional hit in a WP-058 new file is a scope violation.

12. **P6-50 paraphrase discipline — engine runtime tokens:**
    ```bash
    git grep -nE "\\b(LegendaryGameState|LegendaryGame)\\b" packages/preplan/src/
    ```
    → zero hits in NEW WP-058 files (code + JSDoc).

13. **P6-50 paraphrase discipline — `G` token:**
    ```bash
    git grep -nE "\\bG\\b" packages/preplan/src/
    ```
    → zero hits.

14. **P6-50 paraphrase discipline — `ctx` token:**
    ```bash
    git grep -nE "\\bctx\\b" packages/preplan/src/
    ```
    → only the pre-existing `ctx.turn + 1` references at `packages/preplan/src/preplan.types.ts:21, :51` (WP-056 carve-out). Zero hits in new WP-058 files.

15. **Required `// why:` comments — spot-check:**
    ```bash
    git grep -n "// why:" packages/preplan/src/disruptionPipeline.ts | wc -l
    git grep -n "// why:" packages/preplan/src/disruptionDetection.ts | wc -l
    git grep -n "// why:" packages/preplan/src/disruption.types.ts | wc -l
    git grep -n "// why:" packages/preplan/src/preplanEffectTypes.ts | wc -l
    ```
    Each file must have at least one `// why:` comment covering the locked rationales. `disruptionPipeline.ts` has at least 7 (status guard in `invalidatePrePlan`, full-spread, two `affectedCardExtId` conditional-assignments, ledger-sole loop, programming-error throw, pipeline `prePlan.revealLedger` choice).

16. **PREPLAN_EFFECT_TYPES verification:**
    ```bash
    git grep -n "PREPLAN_EFFECT_TYPES" packages/preplan/src/
    ```
    Must appear in: `preplanEffectTypes.ts` (declaration), `preplanEffectTypes.test.ts` (runtime check), `index.ts` (export). Values are `['discard', 'ko', 'gain', 'other']` in that order.

17. **`NonNullable<>` drift-check verification:**
    ```bash
    git grep -n "NonNullable<PrePlan\\['invalidationReason'\\]>" packages/preplan/src/preplanEffectTypes.ts
    ```
    → at least one hit in the compile-time drift-check block.

18. **`requiresImmediateNotification` literal-type verification:**
    ```bash
    git grep -n "requiresImmediateNotification" packages/preplan/src/disruption.types.ts
    ```
    → appears as `requiresImmediateNotification: true;` (literal type, not `: boolean;`).

19. **`revision` not incremented in `invalidatePrePlan`:**
    ```bash
    git grep -nE "revision:\\s*prePlan\\.revision\\s*\\+" packages/preplan/src/disruptionPipeline.ts
    ```
    → zero hits. `invalidatePrePlan` must NOT contain `revision: prePlan.revision + 1` (or similar). The `...prePlan` top-level spread carries `revision` through unchanged.

20. **Programming-error throw template:**
    ```bash
    git grep -n "expected 'invalidated'" packages/preplan/src/disruptionPipeline.ts
    ```
    → exactly one hit, inside `buildDisruptionNotification`, matching the locked template.

21. **Test suite structure (one `describe` per file):**
    ```bash
    git grep -n "^describe" packages/preplan/src/disruptionDetection.test.ts
    git grep -n "^describe" packages/preplan/src/disruptionPipeline.test.ts
    git grep -n "^describe" packages/preplan/src/preplanEffectTypes.test.ts
    ```
    Each must return exactly one hit (no nested or sibling `describe` blocks).

22. **File allowlist check:**
    ```bash
    git diff --name-only
    ```
    Must match exactly:
    - `packages/preplan/src/disruption.types.ts` (A)
    - `packages/preplan/src/disruptionDetection.ts` (A)
    - `packages/preplan/src/disruptionPipeline.ts` (A)
    - `packages/preplan/src/preplanEffectTypes.ts` (A)
    - `packages/preplan/src/disruptionDetection.test.ts` (A)
    - `packages/preplan/src/disruptionPipeline.test.ts` (A)
    - `packages/preplan/src/preplanEffectTypes.test.ts` (A)
    - `packages/preplan/src/index.ts` (M)
    - `docs/ai/post-mortems/01.6-WP-058-preplan-disruption-pipeline.md` (A)
    - (optional) `docs/ai/DECISIONS.md` (M) + `docs/ai/DECISIONS_INDEX.md` (M) if D-5801 authored
    Nothing else.

23. **01.6 post-mortem present:**
    ```bash
    ls docs/ai/post-mortems/01.6-WP-058-preplan-disruption-pipeline.md
    ```
    → file exists; §6 aliasing trace section populated.

24. **Commit message prefix:**
    ```bash
    git log --oneline -5 | head -n 1
    ```
    → starts with `EC-058:` (NEVER `WP-058:`).

25. **Commit B governance files (after Commit A):**
    ```bash
    git grep -n "WP-058" docs/ai/STATUS.md
    git grep -n "WP-058" docs/ai/work-packets/WORK_INDEX.md
    git grep -n "EC-058" docs/ai/execution-checklists/EC_INDEX.md
    ```
    Each returns the updated entry with date + Commit A hash. WORK_INDEX `[ ]` flipped to `[x]`. EC_INDEX `Draft` flipped to `Done`.

If any step fails, STOP and reconcile before proceeding.

---

## Post-Mortem Requirements (01.6)

Author `docs/ai/post-mortems/01.6-WP-058-preplan-disruption-pipeline.md` per [01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). **Mandatory** — four triggers fire:

1. New long-lived abstractions: `isPrePlanDisrupted`, `invalidatePrePlan`, `computeSourceRestoration`, `buildDisruptionNotification`, `executeDisruptionPipeline`, `PREPLAN_EFFECT_TYPES`.
2. First runtime consumer of `invalidationReason.effectType` closed union.
3. First implementation of DESIGN-CONSTRAINT #3 "reveal ledger is sole rewind authority."
4. First full-spread 42/42 pattern applied to a status-transition operation (`invalidatePrePlan` changes `status` + `invalidationReason`, not `sandboxState` / `revealLedger` / `planSteps`, yet still carries fresh copies for all three).

All 10 sections required. §6 aliasing trace is the primary technical deliverable — trace every return statement line-by-line:

- `invalidatePrePlan`'s returned `PrePlan`: confirm `sandboxState.hand` / `deck` / `discard` / `inPlay` / `counters` + `revealLedger` + `planSteps` are all fresh copies (reference-unequal to input); confirm `invalidationReason.affectedCardExtId` is absent (not `undefined`) when `mutation.affectedCardExtId` is `undefined`.
- `computeSourceRestoration`'s returned `SourceRestoration`: confirm `playerDeckReturns` and `sharedSourceReturns` are both freshly built; confirm no reference to any `RevealRecord` field of `revealLedger` survives the function (since `CardExtId` is a `string`, this reduces to "no reference to the `revealLedger` array itself or any `cardExtId` string storage from it").
- `buildDisruptionNotification`'s returned `DisruptionNotification`: confirm all fields are fresh strings + the optional `affectedCardExtId` is absent (not `undefined`) when `mutation.affectedCardExtId` is `undefined`.
- `executeDisruptionPipeline`'s returned `DisruptionPipelineResult`: confirm all four fields come from the three preceding calls (no aliasing through intermediate references); confirm `requiresImmediateNotification: true` is a literal.

§8 Findings section: document any mid-execution deviations. If the full-spread pattern surfaces any issue, record it here.

---

## Final Reminders

- **The engine does not know preplan exists.** Zero engine file modified. Engine baseline `436 / 109 / 0` must hold. WP-028 lifecycle-prohibition precedent.
- **The reveal ledger is the sole authority for rewind.** `computeSourceRestoration` reads only `revealLedger`. Any `sandboxState` read in rewind logic is invalid.
- **Invalidation does not bump revision.** Only `sandboxState` / `revealLedger` / `planSteps` mutations bump revision (`preplan.types.ts:36-38`).
- **`buildDisruptionNotification` is the only function permitted to throw**, and only on a programming-error status mismatch. Every other expected failure returns `null` or `false`.
- **`requiresImmediateNotification: true` is a literal type.** Typing it as `boolean` is a scope violation.
- **`PREPLAN_EFFECT_TYPES` canonical array is WP-058's scope** (deferred from WP-056). `PREPLAN_STATUS_VALUES` was WP-057's scope and is immutable in WP-058.
- **No `package.json` / `pnpm-lock.yaml` delta.** WP-057 already added `tsx` + test script. Any lockfile delta is a P6-44 tripwire.
- **Conditional-assignment pattern at both `affectedCardExtId` sites** — never assign `undefined` to an optional field.
- **Full-spread 42/42 on `invalidatePrePlan` return** — fresh nested arrays/objects for every field, even those semantically unchanged. 01.6 §6 aliasing trace is the backstop.
- **One `describe()` per test file.** Parameterized tests are acceptable within a single `test()` call.
- **Staging by exact filename.** Never `git add .` / `git add -A` / `git add -u`. The 11 inherited dirty-tree items + `.claude/worktrees/` stay untouched.
- **Commit prefix `EC-058:` for code; `SPEC:` for governance; `WP-058:` forbidden.**
- **Three-commit topology:** A0 SPEC (already landed) → A EC-058 (execution) → B SPEC (governance close).

Session prompt is a transcription + ordering artifact of EC-058 + WP-058 (amended) + pre-flight + copilot check. If any instruction here requires interpretation that is not resolved in those documents, **STOP** and escalate via pre-flight amendment rather than guessing.

**End of session prompt.**
