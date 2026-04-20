# Session Prompt — WP-057 Pre-Plan Sandbox Execution

**Work Packet:** [docs/ai/work-packets/WP-057-preplan-sandbox-execution.md](../work-packets/WP-057-preplan-sandbox-execution.md) (amended 2026-04-20 per pre-flight PS-2 / PS-3 and copilot-check HOLD FIXes)
**Execution Checklist:** [docs/ai/execution-checklists/EC-057-preplan-sandbox-execution.checklist.md](../execution-checklists/EC-057-preplan-sandbox-execution.checklist.md)
**Pre-Flight:** [docs/ai/invocations/preflight-wp057-preplan-sandbox-execution.md](preflight-wp057-preplan-sandbox-execution.md)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp057.md](../session-context/session-context-wp057.md)
**Commit prefix:** `EC-057:` on every code-changing commit in the WP-057 allowlist; `SPEC:` on governance / pre-flight / governance-close commits outside the allowlist; `WP-057:` is **forbidden** (commit-msg hook rejects per P6-36).
**Pre-flight verdict:** READY TO EXECUTE (effective after PS-1 / PS-2 / PS-3 / PS-4 resolution + copilot-check HOLD FIXes all landed in Commit A0 `SPEC:` bundle). WP-056 + WP-006A + WP-008B all complete; `CardExtId` import path verified at `packages/game-engine/src/index.ts:5`; `PrePlan` / `PrePlanSandboxState` / `RevealRecord` / `PrePlanStep` canonical shapes verified at `packages/preplan/src/preplan.types.ts:29, 132, 169, 202`; preplan package category classified under D-5601 (Immutable) at `02-CODE-CATEGORIES.md:43, 168-205`; repo baseline confirmed `536 passing / 0 failing` at HEAD `b9b677e`.
**Copilot Check (01.7):** CONFIRM — 30/30 PASS after re-run 2026-04-20 following three HOLD FIXes (Date.now grep added, test 12 uniform null-on-inactive added, test 13 revision-increment discipline added). See §Copilot Check Disposition below.
**WP Class:** **Infrastructure & Verification** (runtime logic in non-authoritative layer; zero `G` mutation; zero `game.ts` wiring; zero new moves; zero new phase hooks; zero `boardgame.io` imports).
**Primary layer:** Pre-Planning (Non-Authoritative, Per-Client) — `preplan` code category per D-5601. Implementation files land under `packages/preplan/` only.

---

## Quick-Reference Stop Conditions (Non-Normative Summary)

This section is a **derived summary** of STOP triggers distributed across §Pre-Session Gates, §Non-Negotiable Constraints, §Verification Steps, and §Final Reminders. It is **not an independent authority** — if this summary ever diverges from the canonical sections below, the canonical sections win. Purpose: give the executor a single pre-read sanity check before committing to the full 813-line read.

Execution MUST NOT begin, and MUST halt in progress, if ANY of the following is true:

- Commit A0 (`SPEC:` pre-flight bundle) is not landed (§Pre-Session Gate 2)
- Repo baseline is not exactly `536 passing / 0 failing` at session-start HEAD (§Pre-Session Gate 3)
- `packages/preplan/src/preplan.types.ts` differs from WP-056 output — `git diff` must be empty (§Non-Negotiable Constraints; §Verification Step 2)
- Any file outside the 12-file WP-057 Commit A allowlist is modified or staged (§Files Expected to Change; §Verification Step 23)
- `Date.now()` appears anywhere in `packages/preplan/src/` other than `speculativePrng.ts:generateSpeculativeSeed` (§Non-Negotiable Constraints; §Verification Step 17)
- Any speculative operation mutates its input `PrePlan` (aliasing or in-place mutation) or increments `revision` incorrectly (§Operation invariants; Test 11 + Test 13)
- Any speculative operation returns a non-null `PrePlan` when `status !== 'active'` (§Operation invariants RS-8; Test 12)
- Commit message starts with `WP-057:` (P6-36; §Pre-Session Gate 1; commit-msg hook rejects)
- `packages/preplan/src/preplan.types.ts` or `packages/preplan/tsconfig.json` appears in `git diff --name-only` (WP-056 output; immutable in this WP)
- Any 01.5 runtime-wiring-allowance edit is made — 01.5 is NOT INVOKED for this WP (§Runtime Wiring Allowance)
- Any inherited dirty-tree item or `.claude/worktrees/` content is staged (§Pre-Session Gate 4)
- Any quarantine stash `stash@{0..2}` is popped (§Pre-Session Gate 5)

If any trigger fires: **STOP immediately.** Do not force-fit. Escalate via pre-flight amendment per 01.4 §Scope-Neutral Mid-Execution Amendment (WP-031 precedent) if the divergence is legitimate; otherwise report and abort the session.

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-057:` on code-changing commits inside the WP-057 allowlist; `SPEC:` on governance / pre-flight / governance-close commits. `WP-057:` is forbidden per P6-36 (commit-msg hook rejects).

2. **Governance committed (P6-34 discipline).** Before writing any code file, run `git log --oneline -10` and confirm the Commit A0 `SPEC:` pre-flight bundle landed all of:
   - `docs/ai/execution-checklists/EC-057-preplan-sandbox-execution.checklist.md` (new)
   - `docs/ai/work-packets/WP-057-preplan-sandbox-execution.md` (amended — §Amendments section + §D exports + §F canonical array section + §E tests with 13 operations tests + §Files Expected to Change with 10-file allowlist + §Acceptance Criteria + §Verification Steps + §Governance + §Definition of Done)
   - `docs/ai/invocations/preflight-wp057-preplan-sandbox-execution.md` (new, includes Copilot Check + Re-Run Copilot Check)
   - `docs/ai/session-context/session-context-wp057.md` (new)
   - `docs/ai/execution-checklists/EC_INDEX.md` (EC-057 row added under Phase 6)
   - this session prompt

   If any is unlanded, STOP — execution is blocked on pre-flight governance.

3. **Upstream dependency baseline.** Run:
   ```bash
   pnpm -r --if-present test
   ```
   Expect repo-wide `536 passing / 0 failing` (registry 13 / vue-sfc-loader 11 / game-engine 436 / server 6 / replay-producer 4 / arena-client 66 / preplan 0). Engine baseline = `436 tests / 109 suites / 0 failing`. If the repo baseline diverges, STOP and reconcile against `WORK_INDEX.md` before proceeding — the WP-057 test-count delta (`+23 tests / +4 suites`) depends on this starting point.

4. **Working-tree hygiene (P6-27 / P6-44 / P6-50 discipline).** `git status --short` will show inherited dirty-tree files from prior sessions. None are in WP-057's implementation allowlist:
   - `M docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md` (unrelated)
   - `?? .claude/worktrees/` (runtime state from parallel WP-081 build-pipeline cleanup session — do NOT touch; do NOT commit)
   - `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md` (unrelated)
   - `?? docs/ai/invocations/forensics-move-log-format.md` (unrelated)
   - `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md` (unrelated)
   - `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md` (unrelated)
   - `?? docs/ai/invocations/session-wp068-preferences-foundation.md` (unrelated)
   - `?? docs/ai/post-mortems/01.6-applyReplayStep.md` (unrelated)
   - `?? docs/ai/session-context/session-context-forensics-move-log-format.md` (unrelated)
   - `?? docs/ai/session-context/session-context-wp067.md` (unrelated)

   Stage files by exact name — **never** `git add .` / `git add -A` / `git add -u`. The 10 unrelated items MUST NOT appear in any WP-057 commit.

5. **Quarantine state — do NOT disturb.**
   - `stash@{0}` — "wp-055-quarantine-viewer" (registry-viewer v1→v2). **Do NOT pop.**
   - `stash@{1}` — WP-068 / MOVE_LOG_FORMAT governance edits. **Do NOT pop.**
   - `stash@{2}` — pre-WP-062 dirty tree. **Do NOT pop.**

6. **Parallel WP-081 session (may still be live).** The registry build-pipeline cleanup landed at commit `ea5cfdd` (plus amendments `9fae043` / `aab002f`) but the `.claude/worktrees/` directory may still carry worktree residue. WP-057 touches zero registry files — no coordination required. If `.claude/worktrees/` is present at session start, leave it alone.

7. **Code-category classification confirmed (D-5601 Immutable).** WP-057 output lives under:
   - `packages/preplan/src/**` — `preplan` code category per D-5601 (Status: Immutable in `02-CODE-CATEGORIES.md:43, 168-205`). Permits `import type` from `@legendary-arena/game-engine` + Node built-ins only; forbids runtime engine imports, `boardgame.io`, `@legendary-arena/registry`, `apps/**`, `pg`, any writes to `G` / `ctx`, any persistence to storage, any wiring into `game.ts` / moves / phase hooks, `Math.random()`, `ctx.random.*`, `.reduce()`, `require(`.

   No new directory introduced by WP-057. No further classification decision needed.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause + §Escalation. WP-057 is an Infrastructure & Verification WP that introduces non-authoritative runtime logic in a new package; it does NOT add, modify, or consume any engine-wide runtime-visible structure. Each of the four 01.5 trigger criteria is absent:

| 01.5 Trigger Criterion | Applies to WP-057? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | Zero engine type modified. All WP-057 types live in `packages/preplan/src/` — `PlayerStateSnapshot`, `PrePlanStatusValue`. The `PrePlan` contract from WP-056 is read-only immutable in this WP. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | Zero edits to `buildInitialGameState` or any setup orchestrator. The preplan layer is non-authoritative and never participates in setup. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | Zero moves added. `CoreMoveName` / `CORE_MOVE_NAMES` unchanged. `LegendaryGame.moves` unchanged. Engine baseline `436 / 109 / 0 fail` must hold UNCHANGED. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | Zero phase hooks added. `MATCH_PHASES` / `TURN_STAGES` unchanged. The preplan layer cannot be wired into `game.ts` — the engine does not know preplan exists (WP-028 lifecycle-prohibition precedent). |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock in §Files Expected to Change applies without the allowance. Any file beyond the allowlist is a scope violation per P6-27, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it. Per 01.5 §Escalation: the allowance *"must be invoked in the session prompt. It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."*

---

## Copilot Check (01.7) — DISPOSITION: CONFIRM

Per [docs/ai/REFERENCE/01.7-copilot-check.md](../REFERENCE/01.7-copilot-check.md) §When Copilot Check Is Required. WP-057 is **Infrastructure & Verification**, for which 01.7 is **mandatory**.

First pass (2026-04-20) returned **RISK → HOLD** with three scope-neutral FIX findings:

- **Issue 2 (Non-Determinism):** `Date.now` grep missing from After Completing — permitted at one location only but not binary-gated. FIX: add `git grep -nE "Date\.now" packages/preplan/src/` expecting exactly one hit (`speculativePrng.ts` inside `generateSpeculativeSeed`).
- **Issue 11 (Tests Validate Behavior, Not Invariants) — null-on-inactive uniform convention:** locked across all five speculative operations in EC-057 RS-8 but only tested on `speculativeDraw` (the other four had no inactive-status test). FIX: add test 12 parameterized over five operations × two non-active statuses (10 assertions in one `test`).
- **Issue 11 (Tests Validate Behavior, Not Invariants) — revision-increment discipline:** locked verbally in EC-057 ("`+1` on successful mutation; no increment on null-return") but never test-asserted. FIX: add test 13 parameterized over five operations × (success path + null-return path) proving both branches.

All three FIXes applied in A0 pre-flight bundle (scope-neutral — zero allowlist changes, zero new files, zero new function signatures; +2 tests raises `speculativeOperations.test.ts` from 11 → 13 tests; repo-wide baseline raised `557 → 559`).

Re-run (2026-04-20) returned **CONFIRM** — 30/30 PASS. Session prompt generation authorized. See §Copilot Check — Re-Run in the pre-flight file for the full 30-issue trace.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — §Pre-Planning Layer, §Import Rules (Quick Reference), §Layer Boundary (authoritative reference)
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — ESM only; full English names; JSDoc on every export; `.reduce()` ban; `.test.ts` extension only; node:test runner
4. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Layer Boundary (Authoritative) — `packages/preplan/**` classified as Pre-Planning layer
5. [docs/ai/DESIGN-PREPLANNING.md](../DESIGN-PREPLANNING.md) §3 (randomness in the sandbox — client-local PRNG rationale; `Date.now()` acceptable for seed entropy because speculative randomness is non-authoritative)
6. [docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md](../DESIGN-CONSTRAINTS-PREPLANNING.md) — 12 constraints; WP-057 enforces #1 (explicit representation), #2 (advisory / non-binding), #3 (reveal ledger is sole rewind authority), #5 (locally determinable), #8 (zero/partial/full planning), #9 (no information leakage — sandbox counters must be player-visible only), #10 (single-turn scope — `appliesToTurn = snapshot.currentTurn + 1`). Constraints #4/#6/#7/#11/#12 remain WP-058 scope — **do not pull forward**.
7. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) — `preplan` category (D-5601, Immutable) — read the full definition section (lines 168-205) for import rules, forbidden tokens, and permitted framework references
8. [docs/ai/execution-checklists/EC-057-preplan-sandbox-execution.checklist.md](../execution-checklists/EC-057-preplan-sandbox-execution.checklist.md) — **primary execution authority** (Before Starting + Locked Values + Guardrails + Required `// why:` Comments + Files to Produce + After Completing + Common Failure Smells)
9. [docs/ai/work-packets/WP-057-preplan-sandbox-execution.md](../work-packets/WP-057-preplan-sandbox-execution.md) — authoritative WP specification as amended 2026-04-20
10. [docs/ai/session-context/session-context-wp057.md](../session-context/session-context-wp057.md) — bridge from WP-056 closure (`eade2d0` + SPEC closers through `b9b677e`); baselines, quarantine state, inherited dirty-tree map, upstream contracts with line numbers, pre-flight locks, discipline precedents
11. [docs/ai/invocations/preflight-wp057-preplan-sandbox-execution.md](preflight-wp057-preplan-sandbox-execution.md) — pre-flight audit + copilot check + re-run copilot check
12. [docs/ai/DECISIONS.md](../DECISIONS.md) — D-5601 (`preplan` code category); the session may author D-5701 (or a grouped block) for the speculative PRNG + purity + ledger-integrity decisions per WP-057 §Governance
13. [packages/preplan/src/preplan.types.ts](../../../packages/preplan/src/preplan.types.ts) — **immutable in this WP** (read-only reference). WP-056 output at commit `eade2d0`. Field names and union values must match verbatim at call sites.
14. [packages/preplan/src/index.ts](../../../packages/preplan/src/index.ts) — will be modified to add runtime exports alongside existing type re-exports (authorized type-only → mixed transition per EC-057 RS-2)
15. [packages/game-engine/src/index.ts](../../../packages/game-engine/src/index.ts) — line 5 re-exports `CardExtId` (read-only reference; NEVER modify from this session)
16. [packages/registry/package.json](../../../packages/registry/package.json) — lines 19 (`"test": "node --import tsx --test src/**/*.test.ts"`) and 34 (`"tsx": "^4.15.7"`) are the mirror pattern for `packages/preplan/package.json` updates
17. [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) — mandatory 10-section audit (see §Post-Mortem below)
18. [docs/ai/REFERENCE/01.4-pre-flight-invocation.md](../REFERENCE/01.4-pre-flight-invocation.md) §Established Patterns + §Precedent Log (P6-22 / P6-27 / P6-36 / P6-44 / P6-50 / P6-51 / WP-028 aliasing / WP-031 grep escaping) — discipline inherited by WP-057
19. [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) — this session declares NOT INVOKED (above)

If any conflict, higher-authority documents win. WP and EC are subordinate to ARCHITECTURE.md and `.claude/rules/*.md`.

---

## Goal (Binary)

After this session, Legendary Arena has functional speculative pre-planning capability in the non-authoritative `@legendary-arena/preplan` package. A player may speculatively create a sandbox, draw from a client-local shuffled deck, play cards, update counters, add plan steps, and draw from shared sources — all without touching authoritative game state. Specifically:

1. **`packages/preplan/src/speculativePrng.ts` exists** — exports `createSpeculativePrng(seed: number): () => number`, `speculativeShuffle<T>(items: readonly T[], random: () => number): T[]`, `generateSpeculativeSeed(): number`. Pure helpers. No framework imports. `Date.now()` used exactly once inside `generateSpeculativeSeed` with a `// why:` comment citing DESIGN-PREPLANNING §3.
2. **`packages/preplan/src/preplanSandbox.ts` exists** — exports `PlayerStateSnapshot` type, `createPrePlan(snapshot, prePlanId, prngSeed): PrePlan`, `computeStateFingerprint(snapshot): string`. Pure helpers. `createPrePlan` returns a fresh PrePlan with `status: 'active'`, `revision: 1`, empty `revealLedger`, empty `planSteps`, `invalidationReason: undefined`, `appliesToTurn = snapshot.currentTurn + 1`.
3. **`packages/preplan/src/speculativeOperations.ts` exists** — exports `speculativeDraw`, `speculativePlay`, `updateSpeculativeCounter`, `addPlanStep`, `speculativeSharedDraw`. All five operations return `null` when `prePlan.status !== 'active'` (uniform null-on-inactive convention, RS-8). All mutation paths increment `revision` by exactly 1; null-return paths increment 0. All `sandboxState` arrays/objects are spread-copied (no aliasing through returned references). Every successful draw (deck or shared) appends exactly one `RevealRecord` with monotonically-increasing `revealIndex`.
4. **`packages/preplan/src/preplanStatus.ts` exists** — exports `PREPLAN_STATUS_VALUES = ['active', 'invalidated', 'consumed'] as const;` and `PrePlanStatusValue` derived type. Includes compile-time exhaustive check proving the array matches `PrePlan['status']` union exactly (deferred from WP-056 per EC-056 Locked Value line 32).
5. **`packages/preplan/src/index.ts` modified** — runtime exports added alongside existing type re-exports: `PREPLAN_STATUS_VALUES` + `PrePlanStatusValue` + `PlayerStateSnapshot` + all ten new runtime functions. Authorized type-only → mixed transition per EC-057 RS-2.
6. **Four new test files exist** — `speculativePrng.test.ts` (3 tests), `preplanSandbox.test.ts` (6 tests), `speculativeOperations.test.ts` (13 tests), `preplanStatus.test.ts` (1 test). Each wraps its tests in exactly one top-level `describe()` block. Total **23 new tests / 4 new suites / 0 failing**.
7. **`packages/preplan/package.json` modified** — adds `"test": "node --import tsx --test src/**/*.test.ts"` script and `"tsx": "^4.15.7"` devDep (matching registry's version exactly). `pnpm-lock.yaml` delta scoped to `importers['packages/preplan']` devDep block.
8. **`packages/preplan/src/preplan.types.ts` UNCHANGED** (`git diff` empty) — WP-056 output is immutable in this WP.
9. **Engine baseline UNCHANGED: `436 / 109 / 0 fail`.** Repo-wide: `536 → 559 passing / 0 failing` (preplan delta `0/0/0 → 23/4/0`).
10. **All architectural boundary greps return expected output** — no `boardgame.io` imports; no runtime engine imports (type-only permitted); no registry / server / apps imports; no `Math.random`; no `ctx.random.*`; no `require(`; no `.reduce(`; `Date.now` exactly one hit at `speculativePrng.ts:generateSpeculativeSeed`; no JSDoc references to `G` / `LegendaryGameState` / `LegendaryGame` / `boardgame.io` in prose (P6-50 paraphrase discipline); `ctx` permitted only in `ctx.turn + 1` invariant prose (inherited WP-056 carve-out).
11. **`docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md` produced** per mandatory 01.6 trigger (three independent reasons: new long-lived abstractions; first runtime consumer of `PrePlan.status` closed union; contract consumed by WP-058). **Section 6 aliasing trace MANDATORY** — every returned `PrePlan`'s `sandboxState` arrays/objects traced line-by-line to confirm fresh copies.
12. **Governance closed (Commit B):** `STATUS.md`, `WORK_INDEX.md` (WP-057 `[x]` with date + commit hash), `EC_INDEX.md` (EC-057 status Draft → Done), and any authored `D-NNNN` entries in `DECISIONS.md` + `DECISIONS_INDEX.md`.

No engine changes. No registry changes. No server changes. No client changes. No new npm dependencies beyond adding `tsx` as preplan devDep. No new scripts elsewhere in the repo. No `game-engine` / `registry` / `apps/*` `package.json` edits.

---

## Locked Values (Do Not Re-Derive)

### Commit & governance prefixes

- **EC / commit prefix:** `EC-057:` on every code-changing commit in the WP-057 allowlist; `SPEC:` on governance / pre-flight / governance-close commits; `WP-057:` is **forbidden** (P6-36).
- **Three-commit topology (matching WP-034 / WP-035 / WP-042 / WP-055 / WP-056):**
  - **Commit A0 (`SPEC:`)** — pre-flight bundle: EC-057 + WP-057 amendments + pre-flight (includes copilot check + re-run) + session-context + EC_INDEX row + DECISIONS_INDEX row (if D-5701 is pre-authored at A0). **Must be landed before Commit A.**
  - **Commit A (`EC-057:`)** — execution: 10 implementation files + `pnpm-lock.yaml` + 01.6 post-mortem + D-entries authored during execution (if any).
  - **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` (WP-057 `[x]` with date + commit hash) + `EC_INDEX.md` (EC-057 Draft → Done with commit hash).

### Ten function signatures (verbatim — from WP-057 §A, §B, §C; EC-057 Locked Values)

```typescript
// speculativePrng.ts
export function createSpeculativePrng(seed: number): () => number;
export function speculativeShuffle<T>(items: readonly T[], random: () => number): T[];
export function generateSpeculativeSeed(): number;

// preplanSandbox.ts
export type PlayerStateSnapshot = {
  playerId: string;
  hand: CardExtId[];
  deck: CardExtId[];
  discard: CardExtId[];
  counters: Record<string, number>;
  currentTurn: number;
};
export function createPrePlan(
  snapshot: PlayerStateSnapshot,
  prePlanId: string,
  prngSeed: number,
): PrePlan;
export function computeStateFingerprint(snapshot: PlayerStateSnapshot): string;

// speculativeOperations.ts
export function speculativeDraw(
  prePlan: PrePlan,
): { updatedPlan: PrePlan; drawnCard: CardExtId } | null;
export function speculativePlay(prePlan: PrePlan, cardExtId: CardExtId): PrePlan | null;
export function updateSpeculativeCounter(
  prePlan: PrePlan,
  counterName: string,
  delta: number,
): PrePlan | null;
export function addPlanStep(
  prePlan: PrePlan,
  step: Omit<PrePlanStep, 'isValid'>,
): PrePlan | null;
export function speculativeSharedDraw(
  prePlan: PrePlan,
  source: RevealRecord['source'],
  cardExtId: CardExtId,
): PrePlan | null;
```

Return-type asymmetry is intentional: `speculativeDraw` surfaces the drawn card in a tuple so callers need not scan `sandboxState.hand` for the new top-of-hand entry; all other operations return only the updated plan.

### `PREPLAN_STATUS_VALUES` canonical array (PS-2)

**File:** `packages/preplan/src/preplanStatus.ts`

```typescript
import type { PrePlan } from './preplan.types.js';

export const PREPLAN_STATUS_VALUES = ['active', 'invalidated', 'consumed'] as const;
export type PrePlanStatusValue = typeof PREPLAN_STATUS_VALUES[number];

// Compile-time exhaustive-check
type _StatusDriftCheck = PrePlanStatusValue extends PrePlan['status']
  ? PrePlan['status'] extends PrePlanStatusValue
    ? true
    : never
  : never;
const _statusDriftProof: _StatusDriftCheck = true;
void _statusDriftProof;
```

Array values appear in spec order matching `preplan.types.ts:66` union declaration. `as const` mandatory. `PREPLAN_EFFECT_TYPES` for `invalidationReason.effectType` is **NOT** added in this WP — remains deferred to WP-058 per EC-056 Locked Value line 32.

### `index.ts` new shape (verbatim)

```typescript
// why: WP-056 shipped this surface as type-only re-exports; WP-057 (first
// runtime consumer of the pre-plan contract) adds runtime exports for
// speculative operations. Authorized by EC-057 RS-2.

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
```

### `package.json` diff shape

Two changes only:
- Under `scripts`: add `"test": "node --import tsx --test src/**/*.test.ts"` (identical to `packages/registry/package.json:19`).
- Under `devDependencies`: add `"tsx": "^4.15.7"` (identical version to `packages/registry/package.json:34`).

No other edits. `name`, `version`, `description`, `type`, `main`, `types`, `exports`, `files`, `peerDependencies`, `build` script, and `typescript` devDep all unchanged.

### `PlayerStateSnapshot` shape (verbatim)

```typescript
export type PlayerStateSnapshot = {
  playerId: string;
  hand: CardExtId[];
  deck: CardExtId[];
  discard: CardExtId[];
  counters: Record<string, number>;
  currentTurn: number;
};
```

Lives in `preplanSandbox.ts`. Caller-supplied; WP-057 does not define how the snapshot is obtained — the caller (future UI/controller WP) is responsible for converting engine projections into snapshots.

### Operation invariants (all five operations)

- **Null-on-inactive uniform convention (RS-8):** every operation (`speculativeDraw`, `speculativePlay`, `updateSpeculativeCounter`, `addPlanStep`, `speculativeSharedDraw`) returns `null` when `prePlan.status !== 'active'`. Return types encode this via `PrePlan | null` (or `{updatedPlan, drawnCard} | null` for draw). No exceptions.
- **Failure signaling convention:** `null` return for expected failure paths (empty deck, card not in hand, non-active status); `throw` reserved for programming errors (internal invariant violations). Matches engine's "moves never throw" pattern extended to the advisory layer.
- **Revision-increment discipline:** `+1` on every successful mutation; `0 delta` on every null-return path. Tests 12 and 13 assert both branches.
- **Purity + spread-copy discipline:** every returned `PrePlan` is a fresh object; every `sandboxState.hand` / `deck` / `discard` / `inPlay` / `counters` that differs from input is a fresh array/object (`[...hand, drawnCard]`, `deck.slice(1)`, `{...counters, [name]: newValue}`). No aliasing through returned references. Standard JSON-equality tests cannot detect aliasing — post-mortem §6 aliasing trace is MANDATORY.
- **`appliesToTurn` invariant:** `createPrePlan` sets `appliesToTurn = snapshot.currentTurn + 1` unconditionally (DESIGN-CONSTRAINT #10).
- **Reveal ledger monotonicity:** every successful `speculativeDraw` appends exactly one `RevealRecord` with `source: 'player-deck'` and `revealIndex` one greater than the current max (monotonically increasing from 0). Every successful `speculativeSharedDraw` appends one `RevealRecord` with caller-supplied `source`. No other operation touches the ledger.
- **Fingerprint determinism:** same `PlayerStateSnapshot` → same fingerprint. Different `hand` / `deck` identities / `discard` / `counters` → different fingerprint. **Deck order excluded** (sandbox has its own shuffle). Algorithm is implementation detail.

### Test baseline lock

- **Registry package:** `13 / 2 / 0 fail` UNCHANGED
- **vue-sfc-loader package:** `11 / ? / 0 fail` UNCHANGED
- **game-engine package:** `436 / 109 / 0 fail` UNCHANGED (WP-057 touches ZERO engine code)
- **server package:** `6 / ? / 0 fail` UNCHANGED
- **replay-producer package:** `4 / ? / 0 fail` UNCHANGED
- **arena-client package:** `66 / ? / 0 fail` UNCHANGED
- **preplan package:** `0 / 0 / 0 fail → 23 / 4 / 0 fail` — four new test files, each wrapped in one top-level `describe()` block
- **Repo-wide:** `536 / 0 fail → 559 / 0 fail`

### Test file structure

- `speculativePrng.test.ts` — 1 `describe('preplan PRNG (WP-057)')` block, 3 tests
- `preplanSandbox.test.ts` — 1 `describe('preplan sandbox (WP-057)')` block, 6 tests
- `speculativeOperations.test.ts` — 1 `describe('preplan speculative operations (WP-057)')` block, 13 tests
- `preplanStatus.test.ts` — 1 `describe('preplan status drift (WP-057)')` block, 1 test

Bare top-level `test()` calls are **forbidden** — they do not register as suites under `node:test` (WP-031 precedent). The +4 suite count is locked.

### Shuffle fixture discipline (RS-11)

The `createPrePlan` "deck is shuffled" test must use a deck of **≥8 `CardExtId`s** and a seed whose shuffle produces a non-identity permutation. A `// why:` comment at the seed literal justifies the choice (e.g., "seed 0x5eed1 proven to produce non-identity Fisher-Yates output on this 8-card deck — covers the identity-permutation edge case absent from shorter decks").

### Lockfile delta scope

- `pnpm install` is expected to regenerate `pnpm-lock.yaml` with a devDep delta inside `importers['packages/preplan']` (adding `tsx`).
- **Any cross-importer churn is a scope violation.** If the delta touches importers other than `packages/preplan`, STOP and investigate before commit (P6-44 discipline).

### `Date.now()` permission scope

- Permitted at exactly ONE location: `packages/preplan/src/speculativePrng.ts` inside the `generateSpeculativeSeed` function body.
- Verification grep expects EXACTLY ONE HIT at that location. Any additional hit is an unauthorized wall-clock read — STOP and escalate.
- Permission is anchored in DESIGN-PREPLANNING §3 + WORK_INDEX convention (line 1463) + D-5601 category rules. Mandatory `// why:` comment at the call site reinforces rationale.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` anywhere in `packages/preplan/` (tests included). All speculative randomness flows exclusively through `generateSpeculativeSeed` → `createSpeculativePrng` → `speculativeShuffle`.
- Never use `ctx.random.*` — no `ctx` exists in the preplan layer. Engine `ctx.random.*` remains the sole authority for real (authoritative) deck order.
- Never throw inside speculative operations — use `null` return for expected failures. Throws are reserved for programming errors (e.g., internal invariant violations), not for expected conditions like empty deck, missing card, or non-active status.
- Never persist `PrePlan` or any of its fields — ARCHITECTURE.md §Pre-Planning Layer declares the entire layer non-persistent.
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`.
- `node:` prefix on all Node.js built-in imports (e.g., `import { ok } from 'node:assert/strict'` in tests).
- Test files use `.test.ts` extension — never `.test.mjs`.
- Full file contents for every new or modified file in the output — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — full English names, no abbreviations (no `cfg`, `mm`, `sch`, `res`, `req`, `e`, `cb`, `fn`, `msg`, `ver`, `fix`); every function has JSDoc; no higher-order functions unless framework-required.

**Packet-specific (layer discipline — `preplan` code category per D-5601):**
- **Pre-Planning layer only** — new files live in `packages/preplan/src/` only.
- **No runtime engine imports** — zero bare `import { ... } from '@legendary-arena/game-engine'`. Type-only imports are permitted (`import type { CardExtId } from '@legendary-arena/game-engine';` is the only engine reference).
- **No `boardgame.io` imports** — zero; grep-verified with escaped-dot pattern (`from ['"]boardgame\.io`) per WP-031 P6-22.
- **No `@legendary-arena/registry` imports** — zero.
- **No `apps/**` imports** — zero.
- **No `pg` imports** — zero.
- **No `require()`** — grep-verified with escaped-paren pattern (`require\(`) per P6-22.
- **No `Math.random`** — grep-verified with escaped-dot pattern (`Math\.random`) per P6-22.
- **No `.reduce()`** — grep-verified with escaped-dot + paren (`\.reduce\(`) per P6-22 / WP-033 P6-22.
- **`Date.now()` permitted exactly ONCE** at `speculativePrng.ts:generateSpeculativeSeed` — grep gate expects exactly one hit. Any additional hit is a scope violation.
- **No wiring into `game.ts`, `LegendaryGame.moves`, phase hooks, or any engine lifecycle point** — WP-028 lifecycle-prohibition precedent.
- **No modifications to `packages/preplan/src/preplan.types.ts`** — WP-056 output immutable in this WP. Any edit is a scope violation; escalate instead.
- **No `PREPLAN_EFFECT_TYPES` canonical array** — remains WP-058 scope.
- **No modifications to prior contract files** — `packages/game-engine/**`, `packages/registry/**`, `apps/**` must not change.
- **`pnpm-lock.yaml` delta scoped** — only `importers['packages/preplan']` devDep block may change; cross-importer churn is a scope violation.

**Paraphrase discipline (P6-50):** JSDoc comments in new `.ts` files must not reference engine runtime concepts by name. Forbidden tokens in JSDoc prose: `G`, `LegendaryGameState`, `LegendaryGame`, `boardgame.io`. `ctx` is permitted only in the `ctx.turn + 1` invariant reference (inherited WP-056 carve-out at `preplan.types.ts:54`). Rephrase as needed: "the game framework" / "authoritative engine state" / "the engine's authoritative randomness primitives". Verification greps will reject violations using escaped-dot patterns.

**Aliasing prevention (WP-028 precedent):** every `sandboxState.hand` / `deck` / `discard` / `inPlay` / `counters` array/object returned inside a new `PrePlan` must be a fresh spread/slice/object-literal copy. Standard `JSON.stringify` equality tests cannot detect aliasing — inspection during post-mortem §6 is mandatory. Tests include a 3-sequential-operations no-mutation proof.

**Revision-increment discipline:** `+1` on every successful mutation path; `0 delta` (return `null` or return input unchanged) on every non-active-status path. Test 13 proves this across all five operations.

**Session protocol:**
- If any contract, field name, or reference seems unclear, STOP and ask — never guess or invent.
- Reality-reconciliation at every Locked Value reference: cross-check against `packages/preplan/src/preplan.types.ts` for type shapes, `packages/game-engine/src/index.ts:5` for `CardExtId`, `packages/registry/package.json:19, 34` for test script + tsx version before writing code.

---

## Files Expected to Change (Strict Allowlist)

Commit A (`EC-057:`) may modify ONLY the following files. Anything outside is a scope violation per P6-27.

### New files (9)

1. `packages/preplan/src/speculativePrng.ts` — PRNG + Fisher-Yates shuffle + seed generator; pure helpers
2. `packages/preplan/src/preplanSandbox.ts` — `PlayerStateSnapshot` type + `createPrePlan` + `computeStateFingerprint`; pure helpers
3. `packages/preplan/src/speculativeOperations.ts` — five speculative operations; uniform null-on-inactive; spread-copy discipline
4. `packages/preplan/src/preplanStatus.ts` — `PREPLAN_STATUS_VALUES` + `PrePlanStatusValue` + compile-time drift check (PS-2)
5. `packages/preplan/src/speculativePrng.test.ts` — 3 tests in `describe('preplan PRNG (WP-057)')`
6. `packages/preplan/src/preplanSandbox.test.ts` — 6 tests in `describe('preplan sandbox (WP-057)')`
7. `packages/preplan/src/speculativeOperations.test.ts` — 13 tests in `describe('preplan speculative operations (WP-057)')`
8. `packages/preplan/src/preplanStatus.test.ts` — 1 test in `describe('preplan status drift (WP-057)')` (PS-2)
9. `docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md` — mandatory 10-section post-mortem (three triggers fire: new long-lived abstractions + first runtime consumer of `PrePlan.status` closed union + contract consumed by WP-058)

### Modified files (2 + 3 governance in Commit B)

10. `packages/preplan/src/index.ts` — add runtime exports alongside existing type re-exports (Commit A)
11. `packages/preplan/package.json` — add `test` script + `tsx` devDep (PS-3, Commit A)
12. `pnpm-lock.yaml` — regenerated by `pnpm install`; delta scoped to `importers['packages/preplan']` devDep block (Commit A)
13. `docs/ai/STATUS.md` — add "WP-057 / EC-057 Executed — Pre-Plan Sandbox Execution" entry under Current State with date + commit hash (Commit B)
14. `docs/ai/work-packets/WORK_INDEX.md` — flip WP-057 entry from `[ ] ... ✅ Reviewed — pending` to `[x] ... ✅ Reviewed — Executed YYYY-MM-DD at commit <hash>` (Commit B)
15. `docs/ai/execution-checklists/EC_INDEX.md` — EC-057 status flipped Draft → Done; summary counts updated; entry updated with commit hash (Commit B)
16. (optional) `docs/ai/DECISIONS.md` + `docs/ai/DECISIONS_INDEX.md` — if D-5701 (or split entries) authored during execution for speculative PRNG + purity + ledger-integrity governance decisions per WP-057 §Governance

### UNCHANGED files (tripwires)

- **`packages/preplan/src/preplan.types.ts`** — **immutable in this WP** (WP-056 output). `git diff packages/preplan/src/preplan.types.ts` must be empty.
- **`pnpm-workspace.yaml`** — unchanged; glob already covers `packages/preplan/`.
- **`packages/game-engine/**`** — every engine file unchanged. Engine baseline `436 / 109 / 0` must hold.
- **`packages/registry/**`** — registry layer unchanged.
- **`packages/vue-sfc-loader/**`** — unchanged.
- **`apps/server/**`**, **`apps/arena-client/**`**, **`apps/registry-viewer/**`**, **`apps/replay-producer/**`** — all unchanged.
- Root `package.json` — unchanged (no new top-level dependency).

### Forbidden files (scope-violation tripwire)

- Any file under `packages/game-engine/**` — layer boundary violation (engine does not know preplan exists)
- Any file under `packages/registry/**` — scope violation
- Any file under `packages/vue-sfc-loader/**` — scope violation
- Any file under `apps/**` — layer boundary violation
- `packages/preplan/src/preplan.types.ts` — immutable in this WP (WP-056 output)
- `packages/preplan/tsconfig.json` — unchanged; tsconfig is WP-056 output
- `pnpm-workspace.yaml` — do not touch
- Root `package.json` — no new top-level deps
- Any `.claude/worktrees/**` — parallel-session state
- Any stash@{0}/{1}/{2} pop — quarantined content owned by other sessions

---

## Required `// why:` Comments (Verbatim Placement)

### In `speculativePrng.ts`

- **At the `Date.now()` call inside `generateSpeculativeSeed`:** "non-authoritative layer; speculative randomness per DESIGN-PREPLANNING §3 — the engine's authoritative randomness primitives remain the sole authority for real deck order"
- **At the LCG constants (or equivalent algorithm) inside `createSpeculativePrng`:** "algorithm changes require updating snapshot tests (changing the algorithm changes shuffle output for existing seeds)"

### In `preplanSandbox.ts`

- **At the `appliesToTurn: snapshot.currentTurn + 1` assignment inside `createPrePlan`:** "single-turn scope invariant (DESIGN-CONSTRAINT #10); planning a different turn is invalid"
- **At the `revision: 1` initialization inside `createPrePlan`:** "new PrePlan instance starts at revision 1; post-rewind PrePlans are new instances with new prePlanId and revision 1"
- **On `computeStateFingerprint` (JSDoc or inline):** "deck order is sandbox-local and re-shuffled on rewind; fingerprint covers contents only (hand / deck size + identities / discard / counters), not deck order"

### In `speculativeOperations.ts`

- **At each `status !== 'active'` short-circuit in all five operations:** "pre-plan is advisory and only mutates while active; null-return signals non-active status to the caller without throwing (WP-057 failure-signaling convention)"
- **At each `revision: prePlan.revision + 1` line (or equivalent):** "monotonic revision enables stale-reference detection, race resolution, and notification ordering (preplan.types.ts PrePlan.revision invariant)" — at first occurrence only; subsequent increments reference the first.
- **At the `isValid: true` initialization inside `addPlanStep`:** "plan-step validity is advisory and never flipped in WP-057; per-step invalidation is WP-058 scope"
- **At the first spread/slice returning a new sandbox array:** "fresh array prevents aliasing — consumer must not be able to mutate input PrePlan through returned sandboxState references (WP-028 aliasing precedent)"

### In `preplanStatus.ts`

- **At the `as const` on `PREPLAN_STATUS_VALUES`:** "canonical readonly array paired with PrePlan.status closed union; drift-detection test enforces parity at build time (deferred from WP-056 per EC-056 Locked Value line 32; first runtime consumer is WP-057 §C speculative operation status guards)"

### In `index.ts`

- **At the top of the file (header comment):** "WP-056 shipped this surface as type-only re-exports; WP-057 (first runtime consumer of the pre-plan contract) adds runtime exports for speculative operations. Authorized by EC-057 RS-2."

### In `speculativePrng.test.ts`

- **At the chosen seed literal in the sandbox shuffle test:** a `// why:` comment justifying the seed choice (e.g., "seed `0xDEADBEEF` proven to produce non-identity Fisher-Yates output on an 8-card `CardExtId[]` — covers the identity-permutation edge case absent from shorter decks").

---

## Implementation Task Sequence (Strict Order)

Each task must complete before the next begins. Do not reorder. Do not skip.

**Task 1 — Verify starting baseline.**
- `pnpm -r --if-present test` returns repo-wide `536 passing / 0 failing`.
- `git log --oneline -10` confirms Commit A0 (SPEC pre-flight bundle) landed EC-057 + WP-057 amendments + pre-flight + session-context + EC_INDEX row + this session prompt per §Pre-Session Gate 2.
- `git status --short` shows only the inherited 10 unrelated dirty-tree items plus possibly `.claude/worktrees/`.
- `packages/preplan/src/preplan.types.ts` matches WP-056 output verbatim (hash-check against commit `eade2d0` if desired; at minimum `git diff packages/preplan/src/preplan.types.ts` must be empty).

**Task 2 — Read the anchors.** Open and read:
- `packages/preplan/src/preplan.types.ts` in full (confirm the four types, line 66 for `status` union, line 108 for `effectType` union, line 182 for `RevealRecord.source` union, line 218 for `PrePlanStep.intent` union, line 132 for `PrePlanSandboxState`)
- `packages/game-engine/src/index.ts` (confirm `CardExtId` re-export at line 5)
- `packages/registry/package.json` (confirm `test` script at line 19 and `tsx` devDep at line 34 — mirror the exact `^4.15.7` version)
- `docs/ai/work-packets/WP-057-preplan-sandbox-execution.md` §A through §F (code skeletons are the spec; §F is the new canonical array; §E is the new 23-test breakdown including tests 12 and 13)
- `docs/ai/DESIGN-PREPLANNING.md` §3 (randomness in the sandbox — `Date.now()` rationale)

If any read produces a surprise (different field name, different shape, missing file, `preplan.types.ts` hash differs from `eade2d0`), STOP and escalate — pre-flight missed a drift.

**Task 3 — Create `packages/preplan/src/speculativePrng.ts`.**
- Three exported functions per §Locked Values signatures.
- `createSpeculativePrng` uses a simple LCG (e.g., `state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000;`) or equivalent reproducible algorithm.
- `speculativeShuffle` implements Fisher-Yates; takes `readonly T[]` input; returns `T[]`; does not mutate input (spread to local array first).
- `generateSpeculativeSeed` uses `Date.now()` (ONLY place `Date.now()` may appear in `packages/preplan/`); mandatory `// why:` comment at the call site.
- Required `// why:` comment at LCG constants.
- Zero imports from `@legendary-arena/game-engine` (this file has no dependency on engine types). Zero imports from `boardgame.io`. Zero other imports.

**Task 4 — Create `packages/preplan/src/preplanSandbox.ts`.**
- `PlayerStateSnapshot` type per §Locked Values shape.
- `createPrePlan` per §Locked Values signature. Body:
  1. Compute `shuffledDeck = speculativeShuffle(snapshot.deck, createSpeculativePrng(prngSeed))`.
  2. Compute `baseStateFingerprint = computeStateFingerprint(snapshot)`.
  3. Build initial `sandboxState` from snapshot (spread-copy arrays; `inPlay: []`).
  4. Return a fresh `PrePlan` with `status: 'active'`, `revision: 1`, empty `revealLedger: []`, empty `planSteps: []`, `invalidationReason: undefined`, `appliesToTurn: snapshot.currentTurn + 1`.
  5. `playerId: snapshot.playerId`; `prePlanId: <passed in>`.
- `computeStateFingerprint` — deterministic function over `snapshot.playerId`, `snapshot.hand`, `snapshot.deck` (contents only, order excluded via sort-before-hash or equivalent), `snapshot.discard`, `snapshot.counters`. Algorithm is implementation detail (e.g., stringify with sorted keys + simple hash); result is a deterministic string.
- **Fingerprint non-goals (do NOT over-engineer):** requirements are LIMITED to determinism (same snapshot → same string) and content sensitivity (different player-visible state → different string). Cryptographic strength, collision resistance across adversarial inputs, cross-process stability, and tamper resistance are **NOT goals**. The fingerprint is a DESIGN-CONSTRAINT-#3-adjacent divergence hint (see `preplan.types.ts:69-76` NON-GUARANTEE clause), never a security boundary. Do NOT import `node:crypto` or any hashing library — a trivial FNV-1a or djb2 over a sorted-keys stringification is more than sufficient.
- Required `// why:` comments per §Required Comments.
- Imports: `import type { CardExtId } from '@legendary-arena/game-engine';`, `import type { PrePlan } from './preplan.types.js';`, `import { createSpeculativePrng, speculativeShuffle } from './speculativePrng.js';`. No other imports.

**Task 5 — Create `packages/preplan/src/speculativeOperations.ts`.**
- Five exported functions per §Locked Values signatures.
- Every function first checks `prePlan.status !== 'active'` → `return null`. Required `// why:` comment at each guard.
- Every successful mutation returns a fresh `PrePlan` with `revision: prePlan.revision + 1` and fresh `sandboxState` / `revealLedger` / `planSteps` as applicable (spread-copy discipline mandatory).
- `speculativeDraw`: guard; if `deck.length === 0` → return null; take `drawnCard = deck[0]`; `newDeck = deck.slice(1)`; `newHand = [...hand, drawnCard]`; `newLedger = [...revealLedger, { source: 'player-deck', cardExtId: drawnCard, revealIndex: revealLedger.length }]`; return `{ updatedPlan: {...prePlan, revision: revision + 1, sandboxState: {...sandboxState, hand: newHand, deck: newDeck}, revealLedger: newLedger}, drawnCard }`.
- `speculativePlay`: guard; if `!hand.includes(cardExtId)` → return null; remove first occurrence from hand (new array); append to inPlay (new array); return new PrePlan with incremented revision.
- `updateSpeculativeCounter`: guard; `newCounters = {...counters, [counterName]: (counters[counterName] ?? 0) + delta}`; return new PrePlan with incremented revision.
- `addPlanStep`: guard; `newStep = {...step, isValid: true}`; `newSteps = [...planSteps, newStep]`; return new PrePlan with incremented revision. Required `// why:` at `isValid: true`.
- `speculativeSharedDraw`: guard; `newHand = [...hand, cardExtId]`; `newLedger = [...revealLedger, { source, cardExtId, revealIndex: revealLedger.length }]`; return new PrePlan with incremented revision.
- Required `// why:` comments per §Required Comments (status guards, revision increment first-occurrence, isValid, first spread-copy).
- Imports: `import type { CardExtId } from '@legendary-arena/game-engine';`, `import type { PrePlan, RevealRecord, PrePlanStep } from './preplan.types.js';`. No other imports.

**Task 6 — Create `packages/preplan/src/preplanStatus.ts`.**
- Verbatim from §Locked Values `PREPLAN_STATUS_VALUES` block.
- Required `// why:` comment at `as const`.
- One import: `import type { PrePlan } from './preplan.types.js';`. No other imports.

**Task 7 — Modify `packages/preplan/src/index.ts`.**
- Replace existing type-only re-exports with the new mixed shape from §Locked Values `index.ts` block.
- Required `// why:` header comment at the top of the file.

**Task 8 — Modify `packages/preplan/package.json`.**
- Add two lines only: `"test": "node --import tsx --test src/**/*.test.ts"` under `scripts`, and `"tsx": "^4.15.7"` under `devDependencies`.
- No other edits. Verify `name`, `version`, `description`, `type`, `main`, `types`, `exports`, `files`, `peerDependencies`, `build` script, and existing `typescript` devDep all unchanged.

**Task 9 — Run `pnpm install`.**
- From the repo root. Expect exit 0.
- `pnpm-lock.yaml` delta: inside `importers['packages/preplan']` only (`tsx` entry added). Any cross-importer churn is a scope violation — STOP and escalate.

**Task 10 — Create test files (four files, in this order).**

**Why this ordering (implementation → install → build → tests, not test-first):** Tests are written AFTER all implementation files (Tasks 3-6), the `index.ts` export surface (Task 7), the `package.json` test script + `tsx` devDep (Task 8), and the `pnpm install` lockfile regeneration (Task 9) have landed. This ordering ensures that a failing test isolates a **behavior bug**, not a missing export, a missing runner, a missing devDep, or a tsconfig path resolution issue. A TDD-style "tests first" ordering would conflate tooling failures with contract failures and is explicitly not the pattern for this WP.

**Task 10a — `packages/preplan/src/speculativePrng.test.ts`.**
- One `describe('preplan PRNG (WP-057)')` block.
- 3 tests:
  1. "same seed produces same shuffle order": `createSpeculativePrng(42)` run twice on same input produces identical output.
  2. "different seeds produce different shuffle orders": seeds 42 and 43 on same input produce different outputs.
  3. "shuffle does not mutate input array": deep-equal check of input array before and after `speculativeShuffle`.
- Imports: `import { describe, test } from 'node:test';`, `import { strict as assert } from 'node:assert';`, `import { createSpeculativePrng, speculativeShuffle } from './speculativePrng.js';`.

**Task 10b — `packages/preplan/src/preplanSandbox.test.ts`.**
- One `describe('preplan sandbox (WP-057)')` block.
- 6 tests:
  1. "createPrePlan returns status 'active' with revision 1, empty ledger and steps"
  2. "appliesToTurn equals snapshot.currentTurn + 1"
  3. "deck is shuffled" — use ≥8-card deck + proven non-identity seed per RS-11; `// why:` comment at seed literal.
  4. "fingerprint is deterministic (same snapshot → same fingerprint)"
  5. "fingerprint changes when hand contents differ"
  6. "zero-op plan is valid" — `createPrePlan` followed by no operations produces a usable PrePlan with empty ledger and steps.
- Imports: standard `node:test` + `node:assert/strict` + `./preplanSandbox.js` + `./preplan.types.js` (type-only).

**Task 10c — `packages/preplan/src/speculativeOperations.test.ts`.**
- One `describe('preplan speculative operations (WP-057)')` block.
- **13 tests** per §E test list:
  1. "speculativeDraw moves top card from deck to hand"
  2. "speculativeDraw appends RevealRecord with source 'player-deck' and monotonic revealIndex"
  3. "speculativeDraw returns null when deck is empty"
  4. "speculativeDraw returns null when status is not 'active'"
  5. "speculativePlay moves card from hand to inPlay"
  6. "speculativePlay returns null when card is not in hand"
  7. "updateSpeculativeCounter adds delta to named counter"
  8. "updateSpeculativeCounter creates counter if missing"
  9. "addPlanStep appends step with isValid: true"
  10. "speculativeSharedDraw adds card to hand and records source in ledger"
  11. "no operation mutates input PrePlan across 3 sequential operations" (aliasing proof — deep-equal input before + after)
  12. **"all five operations return null when status is 'invalidated' or 'consumed'"** — 10 `assert.strictEqual(result, null)` assertions iterating five operations × two non-active statuses (RS-8)
  13. **"revision increments by exactly 1 on each successful mutation and 0 on null-return paths across all five operations"** — 10 assertions iterating five operations × (one success, one null-return)

**Task 10d — `packages/preplan/src/preplanStatus.test.ts`.**
- One `describe('preplan status drift (WP-057)')` block.
- 1 test: "PREPLAN_STATUS_VALUES matches PrePlan['status'] union exactly". Runtime set-equality check against a fixture `Set<PrePlan['status']>` containing the three literal values; assert `PREPLAN_STATUS_VALUES.length === 3` and each value is present in the fixture set and vice versa. The compile-time exhaustive check in `preplanStatus.ts` provides type-level proof; this test provides runtime proof (per WP-007A / 009A / 014A / 021 drift-detection precedent).

**Task 11 — Build.** `pnpm -r build` exits 0. `packages/preplan/dist/` contains `.js` + `.d.ts` for all new files plus existing `preplan.types.js` / `index.js`. `dist/` is gitignored.

**Task 12 — Test.** `pnpm -r --if-present test` exits 0. Expect:
- preplan `23 tests / 4 suites / 0 failing`
- engine `436 / 109 / 0` UNCHANGED
- registry `13 / 2 / 0` unchanged
- vue-sfc-loader `11 / 0` unchanged
- server `6 / 0` unchanged
- replay-producer `4 / 0` unchanged
- arena-client `66 / 0` unchanged
- repo-wide `559 / 0`

**Task 13 — Run full verification suite.** See §Verification Steps below. Every step must return the expected output.

**Task 14 — Author `docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md`.** Full 10-section template per `01.6-post-mortem-checklist.md`. Mandatory per three triggers. **Section 6 aliasing trace MANDATORY** — trace every return path in `speculativeOperations.ts` line-by-line; confirm every `sandboxState` array/object is a fresh spread-copy; cite WP-028 precedent. Sections §8 (reality-reconciliation findings) and §10 (fixes applied during post-mortem) expected to be clean if implementation followed the spec.

**Task 15 — Stage Commit A.** `git add` by filename only:
```bash
git add packages/preplan/src/speculativePrng.ts
git add packages/preplan/src/preplanSandbox.ts
git add packages/preplan/src/speculativeOperations.ts
git add packages/preplan/src/preplanStatus.ts
git add packages/preplan/src/speculativePrng.test.ts
git add packages/preplan/src/preplanSandbox.test.ts
git add packages/preplan/src/speculativeOperations.test.ts
git add packages/preplan/src/preplanStatus.test.ts
git add packages/preplan/src/index.ts
git add packages/preplan/package.json
git add pnpm-lock.yaml
git add docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md
# If D-entries authored during execution:
# git add docs/ai/DECISIONS.md
# git add docs/ai/DECISIONS_INDEX.md
```
**Never** `git add .` / `git add -A` / `git add -u`. Confirm `git diff --cached --name-only` returns exactly these 12 files (or 14 with D-entries). Commit with `EC-057: <short title + description>` following WP-056 Commit A message structure.

**⚠ Commit-prefix tripwire (muscle-memory catch at point of action):** the commit-msg hook will hard-reject any message starting with `WP-057:` per P6-36. Use **`EC-057:`** only. If the hook rejects unexpectedly, `git log -1 --pretty=%B` to inspect the message — do NOT bypass with `--no-verify` (forbidden). Fix the message and retry with a fresh commit (never `--amend` the execution commit).

**Task 16 — Author Commit B governance close.** Update `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, and `docs/ai/execution-checklists/EC_INDEX.md`. Commit with `SPEC: close WP-057 / EC-057 governance`.

**Task 17 — Final green check.**
- `pnpm -r build && pnpm -r --if-present test` → repo-wide `559 / 0`; engine UNCHANGED at `436 / 109 / 0`.
- `git status --short` → clean tree except for the inherited quarantine (10 unrelated items) and `stash@{0..2}` untouched.
- `git log --oneline -5` → A0 (SPEC) → A (EC-057) → B (SPEC) on top, with `b9b677e` or later pre-session HEAD preceding A0.

---

## Verification Steps (Every Step Must Return Expected Output)

Each MUST be executed and pass before Definition of Done is checked. All grep patterns escape regex specials per P6-22 / WP-031 P6-22 so JSDoc prose mentioning forbidden tokens in rationale-context does not false-positive binary gates.

```bash
# Step 1 — pnpm-workspace.yaml UNCHANGED
git diff pnpm-workspace.yaml
# Expected: no output

# Step 2 — preplan.types.ts UNCHANGED (WP-056 immutable output)
git diff packages/preplan/src/preplan.types.ts
# Expected: no output

# Step 3 — preplan tsconfig.json UNCHANGED
git diff packages/preplan/tsconfig.json
# Expected: no output

# Step 4 — pnpm install succeeds with scoped lockfile delta
pnpm install
# Expected: exits 0; pnpm-lock.yaml delta limited to importers['packages/preplan'] tsx addition

# Step 5 — repo-wide build
pnpm -r build
# Expected: exits 0; packages/preplan/dist/ updated with all new .js + .d.ts

# Step 6 — repo-wide tests (baseline 536 → 559)
pnpm -r --if-present test
# Expected: 559 passing / 0 failing; preplan 23/4/0; engine UNCHANGED 436/109/0

# Step 7 — preplan package tests specifically
pnpm --filter @legendary-arena/preplan test
# Expected: 23 tests / 4 suites / 0 failing

# Step 8 — engine package tests UNCHANGED
pnpm --filter @legendary-arena/game-engine test
# Expected: 436 tests / 109 suites / 0 failing (UNCHANGED)

# Step 9 — registry package tests UNCHANGED
pnpm --filter @legendary-arena/registry test
# Expected: 13 tests / 2 suites / 0 failing (UNCHANGED)

# Step 10 — no boardgame.io imports in preplan (escaped dot per P6-22)
git grep -nE "from ['\"]boardgame\.io" packages/preplan/
# Expected: no output

# Step 11 — no runtime engine imports in preplan (type-only permitted)
git grep -nE "from ['\"]@legendary-arena/game-engine['\"]" packages/preplan/src/ | grep -v "import type"
# Expected: no output

# Step 12 — no registry imports in preplan
git grep -nE "from ['\"]@legendary-arena/registry" packages/preplan/
# Expected: no output

# Step 13 — no pg imports in preplan
git grep -nE "from ['\"]pg" packages/preplan/
# Expected: no output

# Step 14 — no apps imports in preplan
git grep -nE "from ['\"]apps/" packages/preplan/
# Expected: no output

# Step 15 — no Math.random in preplan (tests included)
git grep -nE "Math\.random" packages/preplan/
# Expected: no output

# Step 16 — no ctx.random in preplan
git grep -nE "ctx\.random" packages/preplan/
# Expected: no output

# Step 17 — Date.now exactly one hit (speculativePrng.ts only)
git grep -nE "Date\.now" packages/preplan/src/
# Expected: exactly one line: packages/preplan/src/speculativePrng.ts:<N>:<Date.now() call inside generateSpeculativeSeed>

# Step 18 — no require( in preplan (ESM only)
git grep -nE "require\(" packages/preplan/
# Expected: no output

# Step 19 — no .reduce( in preplan
git grep -nE "\.reduce\(" packages/preplan/
# Expected: no output

# Step 20 — P6-50 paraphrase discipline: forbidden tokens absent from preplan code + JSDoc
git grep -nE "\b(LegendaryGameState|LegendaryGame|boardgame\.io)\b" packages/preplan/src/
# Expected: no output

# Step 21 — `G` token absent from preplan src (P6-50)
git grep -nE "\bG\b" packages/preplan/src/
# Expected: no output

# Step 22 — `ctx` token appears only in the ctx.turn + 1 invariant reference (inherited WP-056 carve-out)
git grep -nE "\bctx\b" packages/preplan/src/
# Expected: only `ctx.turn + 1` / `ctx.turn` references in JSDoc prose (inherited from preplan.types.ts:54)

# Step 23 — allowlist check
git diff --name-only
# Expected: exactly the 12 allowlisted files (9 new implementation + 2 modified implementation + pnpm-lock.yaml + post-mortem)
# (+ DECISIONS.md / DECISIONS_INDEX.md if D-entries authored; those are explicitly allowed)
# No other paths.

# Step 24 — inherited dirty-tree untouched
git status --short
# Expected: the 10 unrelated inherited items plus `.claude/worktrees/` remain unstaged and unmodified; no new unexpected entries
```

---

## Post-Mortem Requirements (01.6 MANDATORY)

Author `docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md` per [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) full 10-section template.

### Why mandatory (three triggers — any ONE alone suffices)

1. **New long-lived abstractions** — `speculativePrng`, sandbox factory, five speculative operations, `PREPLAN_STATUS_VALUES` canonical array. These are the canonical pre-planning runtime for the lifetime of the project.
2. **First runtime consumer of `PrePlan.status` closed union** — speculative operations guard on `status === 'active'`; `PREPLAN_STATUS_VALUES` drift test locks parity with the union.
3. **Contract consumed by WP-058** — the disruption pipeline will read `revealLedger`, `sandboxState`, `revision`, and trigger `status: 'active' → 'invalidated'` transitions. WP-058 depends on WP-057's contract stability.

### Section 6 aliasing trace MANDATORY (WP-028 precedent)

For every return statement in `speculativeOperations.ts` that constructs a new `PrePlan`, trace line-by-line:
- Every `sandboxState.hand` assignment must be a fresh `[...]` spread or `.slice()` — cite line number.
- Every `sandboxState.deck` assignment must be a fresh `[...]` spread or `.slice()` — cite line number.
- Every `sandboxState.discard` assignment must be a fresh `[...]` spread or `.slice()` — cite line number.
- Every `sandboxState.inPlay` assignment must be a fresh `[...]` spread or `.slice()` — cite line number.
- Every `sandboxState.counters` assignment must be a fresh `{...}` object literal — cite line number.
- Every `revealLedger` assignment must be a fresh `[...]` spread — cite line number.
- Every `planSteps` assignment must be a fresh `[...]` spread — cite line number.

If ANY return path uses a direct reference to input state, STOP — this is an aliasing bug (WP-028 precedent). Fix under post-mortem §10 before commit.

**Concrete aliasing anti-pattern examples (DO NOT SHIP — these look correct on tests but leak input references):**

```typescript
// 🚫 ANTI-PATTERN 1: entire sandboxState aliased
return {
  updatedPlan: {
    ...prePlan,
    revision: prePlan.revision + 1,
    sandboxState: prePlan.sandboxState,  // ← WHOLE OBJECT ALIASED; consumer can mutate input
  },
  drawnCard,
};

// 🚫 ANTI-PATTERN 2: individual arrays aliased (more subtle; passes JSON.stringify equality)
return {
  ...prePlan,
  revision: prePlan.revision + 1,
  sandboxState: {
    ...prePlan.sandboxState,
    hand: newHand,
    deck: prePlan.sandboxState.deck,  // ← deck array reference shared; consumer.mutate() leaks
  },
};

// 🚫 ANTI-PATTERN 3: counters object aliased (spread not applied on nested object)
return {
  ...prePlan,
  revision: prePlan.revision + 1,
  sandboxState: {
    ...prePlan.sandboxState,
    counters: prePlan.sandboxState.counters,  // ← Record<string, number> shared by reference
  },
};

// ✅ CORRECT: every differing field spread-copied to a fresh structure
return {
  ...prePlan,
  revision: prePlan.revision + 1,
  sandboxState: {
    ...prePlan.sandboxState,          // shallow spread of unchanged fields
    hand: [...newHand],               // fresh array
    deck: newDeck.slice(),            // fresh array (slice creates a new array)
    counters: { ...newCounters },     // fresh object
  },
  revealLedger: [...newLedger],       // fresh array
};
```

The anti-patterns all pass `JSON.stringify(input) === JSON.stringify(output-with-input-preserved)` because value-equality is maintained. They fail only under **reference mutation**: a consumer that calls `result.sandboxState.deck.push(...)` would mutate the input PrePlan. Test 11 catches this via a 3-sequential-operations deep-equality check on the original input PrePlan after operations run — if aliasing is present, the original input has been corrupted.

### Required sections

- §1 Overview — three-triggers narrative, execution summary
- §2 Final Baseline — preplan `23/4/0`, engine UNCHANGED, repo `559/0`
- §3 Allowlist Conformance — 12-file diff confirmation
- §4 Architectural Boundary — all 15 verification greps passed
- §5 Contract Fidelity — ten function signatures match EC-057 verbatim; `PrePlan.status` guard present in all five operations
- §6 Aliasing Trace — as above (MANDATORY)
- §7 Invariant Enforcement — revision +1 / 0 delta; ledger monotonicity; uniform null-on-inactive
- §8 Reality-Reconciliation Findings — expected: none (pre-flight caught all drift)
- §9 01.5 / 01.6 Verification — 01.5 NOT INVOKED four criteria confirmed; 01.6 triggers confirmed
- §10 Fixes Applied During Post-Mortem — expected: none if implementation followed spec; any aliasing bug discovered here is documented with the fix

### Commit staging

01.6 post-mortem is staged into Commit A alongside the implementation files (not Commit B). This matches WP-034 / WP-035 / WP-042 / WP-055 / WP-056 precedent.

---

## Definition of Done

This session is complete when:

- [ ] All 9 new implementation files created under `packages/preplan/src/`
- [ ] `packages/preplan/src/index.ts` modified to export new runtime symbols alongside existing type re-exports; `// why:` header comment present
- [ ] `packages/preplan/package.json` modified with `test` script + `tsx` devDep (exactly two additions; no other edits)
- [ ] `pnpm-lock.yaml` delta scoped to `importers['packages/preplan']` devDep block only
- [ ] `packages/preplan/src/preplan.types.ts` UNCHANGED (`git diff` empty)
- [ ] `packages/preplan/tsconfig.json` UNCHANGED
- [ ] `pnpm-workspace.yaml` UNCHANGED
- [ ] All ten function signatures match EC-057 Locked Values verbatim
- [ ] `PlayerStateSnapshot` type matches EC-057 Locked Values verbatim
- [ ] `PREPLAN_STATUS_VALUES` + `PrePlanStatusValue` + compile-time drift check present in `preplanStatus.ts`
- [ ] All five speculative operations guard on `status === 'active'` and return `null` on non-active
- [ ] All successful mutations increment `revision` by exactly 1; all null-return paths leave revision unchanged
- [ ] All `sandboxState` arrays/objects in returned PrePlans are fresh spread-copies (no aliasing — proven in post-mortem §6)
- [ ] Every successful draw (deck or shared) appends exactly one `RevealRecord` with monotonically-increasing `revealIndex`
- [ ] `createPrePlan` sets `appliesToTurn = snapshot.currentTurn + 1` unconditionally
- [ ] `Date.now()` appears exactly once in `packages/preplan/src/` (at `generateSpeculativeSeed`) with mandatory `// why:` comment
- [ ] 12 required `// why:` comment locations all filled per §Required Comments
- [ ] 23 new tests pass (3 + 6 + 13 + 1); 4 new suites; preplan baseline `0/0/0 → 23/4/0`
- [ ] Test 12 (uniform null-on-inactive × 5 ops × 2 non-active statuses) passes with 10 assertions
- [ ] Test 13 (revision-increment discipline × 5 ops × 2 branches) passes with 10 assertions
- [ ] Engine baseline UNCHANGED `436 / 109 / 0`; repo-wide `536 → 559 passing / 0 failing`
- [ ] All 24 verification steps return expected output (greps pass; `Date.now` grep returns exactly one hit)
- [ ] `docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md` authored with all 10 sections; §6 aliasing trace complete; §9 01.5/01.6 verification confirmed
- [ ] Commit A landed with prefix `EC-057:`; 12 files staged (or 14 with D-entries); no `WP-057:` prefix anywhere
- [ ] Commit B landed with prefix `SPEC:`; STATUS + WORK_INDEX + EC_INDEX updated
- [ ] Inherited dirty-tree items (10 unrelated + `.claude/worktrees/`) untouched and not staged
- [ ] Quarantine stashes `stash@{0..2}` intact and not popped

---

## Final Reminders

- **Phase 6 is closed.** No retro-editing of Phase-6 artifacts (WP-034 / 035 / 042 / 055 / 056 / 081 are all `[x]`).
- **Non-authoritative by construction.** `packages/preplan/` owns no game state; any pressure to add a write path to `G` is an architecture violation — STOP and escalate.
- **`preplan.types.ts` is immutable in this WP.** WP-056 output is final. Any perceived need to add a field, rename a field, or edit JSDoc is scope creep — STOP and escalate.
- **Uniform null-on-inactive (RS-8).** Every speculative operation returns `null` when `status !== 'active'`. Non-negotiable; test 12 enforces this.
- **Revision is monotonic.** `+1` on successful mutation; `0 delta` on null-return. Test 13 enforces this.
- **Aliasing is forbidden.** Every `sandboxState` array/object in a returned `PrePlan` is a fresh spread-copy. Post-mortem §6 trace is mandatory; aliasing bugs discovered at commit time must be fixed in §10 before Commit A lands.
- **Reveal ledger is the rewind authority** (DESIGN-CONSTRAINT #3). WP-057 populates it in `speculativeDraw` and `speculativeSharedDraw`; no other operation touches it. WP-058 rewind logic (future) reads `revealLedger` only; never `sandboxState`.
- **Single-turn scope.** `appliesToTurn = snapshot.currentTurn + 1` unconditionally. Multi-turn planning is out of scope.
- **`Date.now()` permitted exactly ONCE** at `speculativePrng.ts:generateSpeculativeSeed`. Any propagation elsewhere trips the Step 17 grep gate.
- **`PREPLAN_EFFECT_TYPES` remains WP-058 scope.** Do not pull forward.
- **Three-commit topology + 01.5 NOT INVOKED + 01.6 MANDATORY.** The session prompt declares all three; the post-mortem confirms them.
- **P6-50 paraphrase.** JSDoc uses "the game framework" / "the engine's authoritative randomness primitives" — never `G` / `LegendaryGameState` / `LegendaryGame` / `boardgame.io` by name. `ctx.turn + 1` is the only permitted framework reference (inherited from WP-056).

If any contract, field name, signature, or reference seems unclear at any point, STOP and ask.

**End of session prompt.**
