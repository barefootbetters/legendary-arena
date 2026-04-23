# Session Prompt — WP-049 PAR Simulation Engine

**Work Packet:** [docs/ai/work-packets/WP-049-par-simulation-engine.md](../work-packets/WP-049-par-simulation-engine.md) (amended 2026-04-23 per PS-2 + copilot FIXes)
**Execution Checklist:** [docs/ai/execution-checklists/EC-049-par-simulation-engine.checklist.md](../execution-checklists/EC-049-par-simulation-engine.checklist.md) (amended 2026-04-23 per copilot FIXes)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp049.md](../session-context/session-context-wp049.md)
**Pre-Flight Report:** [docs/ai/invocations/preflight-wp049-par-simulation-engine.md](preflight-wp049-par-simulation-engine.md)
**Pre-flight verdict:** READY TO EXECUTE (2026-04-23) — PS-1 + PS-2 resolved in Commit A0 `67927f1`.
**Copilot Check (01.7):** HOLD → rolled into this prompt + EC/WP edits (same commit). Final disposition CONFIRM once this prompt lands.
**Commit prefix:** `EC-049:` on every code-changing commit in the WP-049 allowlist; `SPEC:` on governance/pre-flight commits outside the allowlist; `WP-049:` is **forbidden** (commit-msg hook rejects per P6-36). EC-049 slot is **unconsumed** as of `main @ 67927f1` — no retargeting trap.
**WP Class:** Infrastructure & Verification. External consumer tooling. No engine gameplay changes. No `G` mutation from new files. No moves added. No phase hooks. No new `LegendaryGameState` fields. No `buildInitialGameState` shape change.
**Primary layer:** Game Engine (existing `packages/game-engine/src/simulation/` subdirectory, already classified as `engine` category per D-3601).

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-049:` on code commits inside the allowlist; `SPEC:` on governance commits. `WP-049:` forbidden. Subject lines containing `WIP` / `misc` / `tmp` / `updates` / `changes` / `debug` / `fix stuff` are rejected by `.githooks/commit-msg`.

2. **Governance bundle A0 landed.** Confirm Commit A0 `67927f1` is HEAD of main (or is on the current branch). A0 contains:
   - `docs/ai/work-packets/WP-049-par-simulation-engine.md` (PS-2 applied, copilot FIXes)
   - `docs/ai/execution-checklists/EC-049-par-simulation-engine.checklist.md` (copilot FIXes)
   - `docs/ai/work-packets/WP-050-par-artifact-storage.md` (dual artifact classes)
   - `docs/ai/invocations/preflight-wp049-par-simulation-engine.md` (pre-flight + copilot check)
   - `docs/ai/session-context/session-context-wp049.md` (bridge)

   If A0 is not landed, STOP — execution is blocked on pre-flight governance.

3. **Upstream dependency baseline.** Run:
   ```bash
   pnpm -r test
   ```
   Expect **596 tests / 123 suites / 0 fail** repo-wide. Package-level breakdown:
   - registry `13 / 2 / 0`
   - vue-sfc-loader `11 / 0 / 0`
   - **game-engine `444 / 110 / 0` (MUST shift to `471 / 112 / 0` post-Commit A — exactly +27 tests, +2 suites)**
   - server `6 / 2 / 0`
   - replay-producer `4 / 2 / 0`
   - preplan `52 / 7 / 0`
   - arena-client `66 / 0 / 0`
   - Post-Commit A repo-wide: `623 / 125 / 0`.

   If the repo baseline diverges, STOP and reconcile before writing code.

4. **Upstream contract surface verification.** Before writing any file, grep-verify every dependency export at `main @ 67927f1`:

   ```bash
   grep -n "export interface AIPolicy"              packages/game-engine/src/simulation/ai.types.ts
   grep -n "export interface LegalMove"             packages/game-engine/src/simulation/ai.types.ts
   grep -n "export interface SimulationConfig"      packages/game-engine/src/simulation/ai.types.ts
   grep -n "export interface SimulationResult"      packages/game-engine/src/simulation/ai.types.ts
   grep -n "export function createRandomPolicy"     packages/game-engine/src/simulation/ai.random.ts
   grep -n "export function getLegalMoves"          packages/game-engine/src/simulation/ai.legalMoves.ts
   grep -n "export interface SimulationLifecycleContext" packages/game-engine/src/simulation/ai.legalMoves.ts
   grep -n "export function runSimulation"          packages/game-engine/src/simulation/simulation.runner.ts
   grep -n "export interface CardRegistryReader"    packages/game-engine/src/matchSetup.validate.ts
   grep -n "export interface ScenarioScoringConfig" packages/game-engine/src/scoring/parScoring.types.ts
   grep -n "export interface ScoringInputs"         packages/game-engine/src/scoring/parScoring.types.ts
   grep -n "export interface ScoreBreakdown"        packages/game-engine/src/scoring/parScoring.types.ts
   grep -n "export interface ParBaseline"           packages/game-engine/src/scoring/parScoring.types.ts
   grep -n "export const PENALTY_EVENT_TYPES"       packages/game-engine/src/scoring/parScoring.types.ts
   grep -n "export function computeRawScore"        packages/game-engine/src/scoring/parScoring.logic.ts
   grep -n "export function computeParScore"        packages/game-engine/src/scoring/parScoring.logic.ts
   grep -n "export function buildScoreBreakdown"    packages/game-engine/src/scoring/parScoring.logic.ts
   grep -n "export function buildScenarioKey"       packages/game-engine/src/scoring/parScoring.keys.ts
   grep -n "export function validateScoringConfig"  packages/game-engine/src/scoring/parScoring.logic.ts
   grep -n "export function buildInitialGameState"  packages/game-engine/src/setup/buildInitialGameState.ts
   grep -n "export function buildUIState"           packages/game-engine/src/ui/uiState.build.ts
   grep -n "export function filterUIStateForAudience" packages/game-engine/src/ui/uiState.filter.ts
   grep -n "export function evaluateEndgame"        packages/game-engine/src/endgame/endgame.evaluate.ts
   grep -n "export function computeFinalScores"     packages/game-engine/src/scoring/scoring.logic.ts
   grep -n "export function resetTurnEconomy"       packages/game-engine/src/economy/economy.logic.ts
   grep -n "export function advanceTurnStage"       packages/game-engine/src/turn/turnLoop.ts
   grep -n "export function makeMockCtx"            packages/game-engine/src/test/mockCtx.ts
   ```

   Each MUST return exactly one line. If any returns zero lines, STOP — the Assumes gate is violated.

5. **WP-036 + WP-048 contract files MUST be unchanged.** Before and after Commit A, run:
   ```bash
   git diff main -- packages/game-engine/src/simulation/ai.types.ts \
                    packages/game-engine/src/simulation/ai.random.ts \
                    packages/game-engine/src/simulation/ai.legalMoves.ts \
                    packages/game-engine/src/simulation/simulation.runner.ts \
                    packages/game-engine/src/simulation/simulation.test.ts \
                    packages/game-engine/src/scoring/parScoring.types.ts \
                    packages/game-engine/src/scoring/parScoring.logic.ts \
                    packages/game-engine/src/scoring/parScoring.keys.ts \
                    packages/game-engine/src/scoring/scoring.types.ts \
                    packages/game-engine/src/scoring/scoring.logic.ts
   ```
   Expect **zero output**. Any modification to these files is a Hard Stop.

6. **Working-tree hygiene (P6-27).** `git status --short` should show only `?? .claude/worktrees/`. Stage by exact filename only — `git add .` / `-A` / `-u` are forbidden.

7. **Branch discipline.** Cut a fresh topic branch from main @ 67927f1:
   ```bash
   git checkout -b wp-049-par-simulation-engine main
   ```
   Do NOT reuse an existing branch. Do NOT rebase onto an unreleased branch.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md). WP-049 is purely additive and touches **zero** engine contract surface:

| 01.5 Trigger Criterion | Applies to WP-049? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | No engine type modified. Zero new G fields. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | `buildInitialGameState` called unchanged; no return shape changes. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | Zero moves added. Engine 444/110/0 baseline held for all existing tests. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook. No `onBegin` / `onEnd`. No `endIf` change. |

**Conclusion:** 01.5 is **NOT INVOKED**. Per 01.5 §Escalation: *"It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."* If an unanticipated structural break appears mid-execution, **STOP and escalate** — do not force-fit.

**Lifecycle prohibition.** Functions introduced by WP-049 (`createCompetentHeuristicPolicy`, `aggregateParFromSimulation`, `generateScenarioPar`, `validateParResult`, `validateTierOrdering`, `generateSeedSet`, `computeSeedSetHash`) MUST NOT be called from:
- `game.ts` or any `LegendaryGame.moves` entry
- Any phase hook (`onBegin`, `onEnd`, `endIf`, phase `onBegin`)
- Any file under `src/moves/`, `src/rules/`, `src/phases/`, `src/turn/`, `src/setup/`, `src/endgame/`, `src/economy/`, `src/zone*`, `src/ui/**`, `src/replay/**`, `src/invariants/**`

They are consumed by test files (inside `packages/game-engine/src/simulation/`) and future WP-050 / WP-051 artifact writers only. (WP-028 lifecycle-prohibition precedent.)

---

## Post-Mortem (01.6) — MANDATORY

Per [01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). WP-049 triggers three mandatory conditions:

| 01.6 Trigger | Applies? | Justification |
|---|---|---|
| New long-lived abstraction | **Yes** | `AIPolicyTier` union + `AI_POLICY_TIERS` canonical array + `ParSimulationResult` contract anchor WP-050 / WP-051 downstream WPs. |
| New contract consumed by future WPs | **Yes** | `ParSimulationResult` field shape locks WP-050 artifact writer. |
| New canonical readonly array | **Yes** | `AI_POLICY_TIERS` + drift test (test #11). |
| New setup artifact in `G` | No | Zero G involvement. |

**Post-mortem must cover (minimum):**

1. **Aliasing check.** Trace every returned array/object in `generateScenarioPar`: `rawScoreDistribution` is a fresh object literal; `ParSimulationResult` returns no internally-held scratch references. Cite WP-028 D-2801 / WP-029 aliasing precedent.
2. **JSON-roundtrip check.** Confirm test #15 exercises `JSON.parse(JSON.stringify(result))` via `deepStrictEqual` — no Maps, Sets, functions, or class instances slipped into the result. `ParAggregationError` is never stored in the result; it is thrown.
3. **`// why:` comment completeness.** Every heuristic in `ai.competent.ts`, plus every entry in EC-049 §Required `// why:` Comments, is present. Grep: `grep -c "// why:" packages/game-engine/src/simulation/ai.competent.ts packages/game-engine/src/simulation/par.aggregator.ts`.
4. **Reproducibility-test protocol.** Every test that asserts byte-identity injects `generatedAtOverride`. No test silently relies on wall-clock coincidence.
5. **Per-game-loop replication audit (RS-10).** `par.aggregator.ts` replicates the per-game loop using engine primitives; `runSimulation` surface untouched. Grep: `git diff main -- packages/game-engine/src/simulation/simulation.runner.ts` MUST show zero output.
6. **Layer boundary audit.** `grep -n "from ['\"]boardgame\.io" packages/game-engine/src/simulation/ai.competent.ts packages/game-engine/src/simulation/par.aggregator.ts packages/game-engine/src/simulation/ai.tiers.ts` returns zero output. Same for `@legendary-arena/registry`.

**Post-mortem file path:** `docs/ai/post-mortems/01.6-WP-049-par-simulation-engine.md`. Template = `docs/ai/post-mortems/01.6-WP-036-ai-playtesting-balance-simulation.md`.

Post-mortem runs in the **same session** as Commit A execution, before Commit B (governance close). Fixes applied during post-mortem are strict in-allowlist refinements (WP-031 precedent) — they do NOT require 01.5 invocation.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary (authoritative); engine may NOT import `boardgame.io`, registry, preplan, server, pg
3. [.claude/rules/game-engine.md](../../../.claude/rules/game-engine.md) — engine category rules; registry boundary; no `.reduce()`; no `Math.random()`
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — ESM only, `.test.ts` extension, full-sentence error messages, no abbreviations, JSDoc required on every function
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — §Layer Boundary; §MVP Gameplay Invariants; §Debuggability & Diagnostics
6. [docs/ai/execution-checklists/EC-049-par-simulation-engine.checklist.md](../execution-checklists/EC-049-par-simulation-engine.checklist.md) — **primary execution authority** (Locked Values + Guardrails + Failure Semantics table + Required `// why:` Comments + Files to Produce + After Completing + Common Failure Smells)
7. [docs/ai/work-packets/WP-049-par-simulation-engine.md](../work-packets/WP-049-par-simulation-engine.md) — authoritative WP specification
8. [docs/ai/session-context/session-context-wp049.md](../session-context/session-context-wp049.md) — bridge from WP-048 closure; baselines; quarantine state; precedents
9. [docs/ai/invocations/preflight-wp049-par-simulation-engine.md](preflight-wp049-par-simulation-engine.md) — READY TO EXECUTE verdict; copilot-check findings; RS-1 through RS-12 resolved
10. [docs/ai/DECISIONS.md](../DECISIONS.md) — D-0701 (AI Is Tooling, Not Gameplay), D-0702 (Balance Changes Require Simulation), D-2702 (framework bypass), D-2704 (PRNG capability gap), D-2705 (static MOVE_MAP), D-2801 (local structural interface), D-2903 (UIState filtering), D-3601 (Simulation Code Category), D-3602 (AI Uses Same Pipeline as Humans), D-3604 (Two Independent PRNG Domains), D-4801 through D-4806 (PAR scoring contracts)
11. [docs/12-SCORING-REFERENCE.md](../../12-SCORING-REFERENCE.md) — three-phase PAR pipeline; WP-049 implements Phase 2
12. [docs/ai/REFERENCE/00.6-code-style.md](../REFERENCE/00.6-code-style.md) — human-facing style guide (Rule 4, 6, 8, 11, 13)
13. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) — engine category rules (includes `src/simulation/` per D-3601)

**Implementation anchors (read before coding — paths verified at pre-flight time):**

14. [packages/game-engine/src/simulation/ai.types.ts](../../../packages/game-engine/src/simulation/ai.types.ts) — `AIPolicy`, `LegalMove`, `SimulationConfig`, `SimulationResult` definitions. T2 policy MUST conform to `AIPolicy` exactly. **Immutable** (WP-036 contract).
15. [packages/game-engine/src/simulation/ai.random.ts](../../../packages/game-engine/src/simulation/ai.random.ts) — T0 `createRandomPolicy` reference implementation. T2 follows the same construction pattern: seeded mulberry32 closure over decision RNG; `name` field; `decideTurn(view, moves)` returns a `ClientTurnIntent`.
16. [packages/game-engine/src/simulation/ai.legalMoves.ts](../../../packages/game-engine/src/simulation/ai.legalMoves.ts) lines 89–179 — `getLegalMoves` canonical enumeration order. T2 reads the returned list in this order; any index-based tie-breaking depends on the stable order.
17. [packages/game-engine/src/simulation/simulation.runner.ts](../../../packages/game-engine/src/simulation/simulation.runner.ts) lines 55–240 — the reference per-game loop pattern (`SimulationMoveContext`, `MOVE_MAP`, `shuffleWithPrng`, `buildMoveContext`, `simulateOneGame`). `par.aggregator.ts` MUST replicate this structure (RS-10) with its own private helpers; **do NOT import from `simulation.runner.ts`** (its helpers are not exported and WP-036 is immutable).
18. [packages/game-engine/src/matchSetup.validate.ts](../../../packages/game-engine/src/matchSetup.validate.ts) line 28 — `CardRegistryReader` interface. This is the type `generateScenarioPar` accepts (PS-2).
19. [packages/game-engine/src/scoring/parScoring.types.ts](../../../packages/game-engine/src/scoring/parScoring.types.ts) — `ScenarioScoringConfig`, `ScoringInputs`, `ScoreBreakdown`, `ParBaseline`, `PenaltyEventType`, `PENALTY_EVENT_TYPES`. **Immutable** (WP-048 contract).
20. [packages/game-engine/src/scoring/parScoring.logic.ts](../../../packages/game-engine/src/scoring/parScoring.logic.ts) — `computeRawScore`, `buildScoreBreakdown`, `validateScoringConfig`. WP-049 calls `computeRawScore` per-run. **Immutable** (WP-048 contract).
21. [packages/game-engine/src/scoring/parScoring.keys.ts](../../../packages/game-engine/src/scoring/parScoring.keys.ts) — `buildScenarioKey`. Used to construct the `ScenarioKey` field of `ParSimulationConfig`. **Immutable** (WP-048 contract).
22. [packages/game-engine/src/endgame/endgame.evaluate.ts](../../../packages/game-engine/src/endgame/endgame.evaluate.ts) — `evaluateEndgame(G): EndgameOutcome | null`. Called inside the replicated per-game loop to detect termination.
23. [packages/game-engine/src/ui/uiState.build.ts](../../../packages/game-engine/src/ui/uiState.build.ts) — `buildUIState(G, ctx): UIState`. Called each turn in the replicated loop. `UIBuildContext = { readonly phase: string | null; readonly turn: number; readonly currentPlayer: string }` (local interface per D-2801).
24. [packages/game-engine/src/ui/uiState.filter.ts](../../../packages/game-engine/src/ui/uiState.filter.ts) — `filterUIStateForAudience(state, audience): UIState`. T2 receives only the filtered projection (D-3602 + D-0701).
25. [packages/game-engine/src/scoring/scoring.logic.ts](../../../packages/game-engine/src/scoring/scoring.logic.ts) — `computeFinalScores(G): FinalScoreSummary`. Used to build `ScoringInputs.victoryPoints` (sum across players per D-4803) at end-of-game.
26. [packages/game-engine/src/moves/coreMoves.impl.ts](../../../packages/game-engine/src/moves/coreMoves.impl.ts) — `drawCards`, `playCard`, `endTurn`. Move imports for the replicated MOVE_MAP.
27. [packages/game-engine/src/villainDeck/villainDeck.reveal.ts](../../../packages/game-engine/src/villainDeck/villainDeck.reveal.ts) — `revealVillainCard`.
28. [packages/game-engine/src/moves/fightVillain.ts](../../../packages/game-engine/src/moves/fightVillain.ts) / `recruitHero.ts` / `fightMastermind.ts` — the three fight/recruit exports.
29. [packages/game-engine/src/turn/turnLoop.ts](../../../packages/game-engine/src/turn/turnLoop.ts) — `advanceTurnStage`. Used for `advanceStage` dispatch per D-2705.
30. [packages/game-engine/src/setup/buildInitialGameState.ts](../../../packages/game-engine/src/setup/buildInitialGameState.ts) — `buildInitialGameState(config, registry, setupContext)`. Called per-seed to produce the initial `G`.
31. [packages/game-engine/src/test/mockCtx.ts](../../../packages/game-engine/src/test/mockCtx.ts) — `makeMockCtx({ numPlayers })` returns `SetupContext`. Used only for the initial `G` construction; move dispatch uses the aggregator's own seeded PRNG.
32. [packages/game-engine/src/economy/economy.logic.ts](../../../packages/game-engine/src/economy/economy.logic.ts) — `resetTurnEconomy()`. Called in the replicated loop on turn rotation.
33. [packages/game-engine/src/simulation/simulation.test.ts](../../../packages/game-engine/src/simulation/simulation.test.ts) — WP-036 reference test patterns (mock registry, mock setup, how to construct a `UIState` from scratch for policy tests).

If any conflict, higher-authority documents win. WP and EC are subordinate to `ARCHITECTURE.md`, `.claude/rules/*.md`, and DECISIONS.md.

---

## Goal (Binary)

After this session, the game engine exposes the T2 Competent Heuristic AI policy and the complete PAR aggregation pipeline that measures scenario difficulty via simulation. Specifically:

1. **`packages/game-engine/src/simulation/ai.competent.ts`** exists with exported `createCompetentHeuristicPolicy(seed: string): AIPolicy` implementing all five behavioral heuristics, plus the four required `// why:` comments per EC-049.
2. **`packages/game-engine/src/simulation/ai.tiers.ts`** exists with exported `AIPolicyTier` union, `AI_POLICY_TIERS` canonical readonly array (drift-pinned), `AIPolicyTierDefinition` interface, and `AI_POLICY_TIER_DEFINITIONS` reference taxonomy.
3. **`packages/game-engine/src/simulation/par.aggregator.ts`** exists with exported `ParSimulationConfig`, `ParSimulationResult`, `ParValidationResult`, `TierOrderingResult`, `ParAggregationError`, `ParAggregationErrorCode`, plus exported functions `aggregateParFromSimulation`, `generateScenarioPar`, `validateParResult`, `validateTierOrdering`, `generateSeedSet`, `computeSeedSetHash`. The file replicates the per-game loop from WP-036 `simulation.runner.ts` using engine primitives only (RS-10).
4. **`packages/game-engine/src/types.ts`** re-exports the PAR simulation types.
5. **`packages/game-engine/src/index.ts`** exports the public PAR simulation API (9 exports per WP-049 §E).
6. **`packages/game-engine/src/simulation/ai.competent.test.ts`** exists with exactly **10** tests inside one `describe('T2 Competent Heuristic policy (WP-049)', …)` block.
7. **`packages/game-engine/src/simulation/par.aggregator.test.ts`** exists with exactly **17** tests inside one `describe('PAR aggregator (WP-049)', …)` block.
8. **Engine baseline shift: 444 / 110 / 0 → 471 / 112 / 0.** Repo-wide: 596 → 623 tests; 123 → 125 suites. Zero existing tests modified.
9. **Governance closed:** `docs/ai/STATUS.md` records the T2 + PAR pipeline availability; `docs/ai/DECISIONS.md` records at minimum: T2 as sole PAR authority, 55th-percentile choice, nearest-rank method, neutral hero pool, minimum N=500, loss treatment, pre-release gate, seed-set canonicalization, immutable Raw Score surface; `docs/ai/work-packets/WORK_INDEX.md` flips WP-049 `[ ]` → `[x]` with today's date + Commit A hash; `docs/ai/execution-checklists/EC_INDEX.md` flips EC-049 Draft → Done.

No engine gameplay changes. No server changes. No arena-client changes. No preplan changes. No `package.json` / `pnpm-lock.yaml` edits. No modifications to WP-036 (`ai.types.ts`, `ai.random.ts`, `ai.legalMoves.ts`, `simulation.runner.ts`) or WP-048 (`parScoring.*.ts`, `scoring.*.ts`) contract files.

---

## Locked Values (Do Not Re-Derive)

All Locked Values below are copied verbatim from EC-049 + WP-049 §Non-Negotiable Constraints + pre-flight RS-1 through RS-12. Any divergence between this prompt and EC-049/WP-049 is a prompt authoring bug — escalate and re-run copilot check rather than "work around."

### Commit topology (three commits)

- **Commit A0 (`SPEC:`)** — pre-flight bundle. **Already landed** at `67927f1`.
- **Commit A (`EC-049:`)** — execution. Contains:
  - `packages/game-engine/src/simulation/ai.competent.ts` (new)
  - `packages/game-engine/src/simulation/ai.tiers.ts` (new)
  - `packages/game-engine/src/simulation/par.aggregator.ts` (new)
  - `packages/game-engine/src/simulation/ai.competent.test.ts` (new; 10 tests in 1 suite)
  - `packages/game-engine/src/simulation/par.aggregator.test.ts` (new; 17 tests in 1 suite)
  - `packages/game-engine/src/types.ts` (re-exports)
  - `packages/game-engine/src/index.ts` (exports)
  - `docs/ai/DECISIONS.md` (new PAR decisions — see §Governance Decisions below)
- **Commit B (`SPEC:`)** — governance close. Contains:
  - `docs/ai/work-packets/WORK_INDEX.md` (WP-049 `[ ]` → `[x]` with date + Commit A hash)
  - `docs/ai/execution-checklists/EC_INDEX.md` (EC-049 Draft → Done)
  - `docs/ai/STATUS.md` (T2 + PAR pipeline availability)
  - `docs/ai/post-mortems/01.6-WP-049-par-simulation-engine.md` (post-mortem — new file)

### Raw Score ordering (locked)

**Lower Raw Score = stronger play.** Tier-ordering compares medians with `<`. PAR selects the Nth percentile of an ascending-sorted distribution, so a lower PAR indicates a scenario where competent play consistently produces lower (better) Raw Scores.

### PAR percentile (locked)

- Default: **55th percentile**. Configurable range: `[50, 60]` inclusive.
- Method: **nearest-rank** on the ascending-sorted array:
  `rankIndex = ceil((percentile / 100) * N) - 1`, clamped to `[0, N - 1]`.
- Output: **integer** in Raw Score units — no float interpolation.
- Sort comparator: `[...rawScores].sort((left, right) => left - right)` — explicit stable numeric comparator. Input array never mutated. Default lexical comparator is **forbidden**.
- No use of the mean.

### `ParAggregationError` (locked shape)

```ts
export type ParAggregationErrorCode =
  | 'EMPTY_DISTRIBUTION'
  | 'PERCENTILE_OUT_OF_RANGE';

export class ParAggregationError extends Error {
  readonly name = 'ParAggregationError';
  constructor(
    readonly code: ParAggregationErrorCode,
    message: string,
  ) {
    super(message);
  }
}
```

- Tests #3 and #4 MUST assert both `instanceof ParAggregationError` **AND** `.code === '<expected>'` — never by message substring.
- Error messages are full sentences per `00.6-code-style.md` Rule 11.

### `ParSimulationConfig` (WP-049 §B verbatim)

```ts
export interface ParSimulationConfig {
  readonly scenarioKey: ScenarioKey;
  readonly setupConfig: MatchSetupConfig;
  readonly playerCount: number;
  readonly simulationCount: number;      // minimum 500
  readonly baseSeed: string;
  readonly percentile: number;           // default 55, allowed 50-60 inclusive
  readonly scoringConfig: ScenarioScoringConfig;

  readonly simulationPolicyVersion: string; // e.g. "CompetentHeuristic/v1"
  readonly scoringConfigVersion: number;

  readonly generatedAtOverride?: string;    // ISO string
}
```

### `ParSimulationResult` (WP-049 §B verbatim — field names locked for WP-050)

```ts
export interface ParSimulationResult {
  readonly scenarioKey: ScenarioKey;
  readonly parValue: number;                // integer in Raw Score units
  readonly percentileUsed: number;
  readonly sampleSize: number;
  readonly seedSetHash: string;

  readonly rawScoreDistribution: {
    readonly min: number;
    readonly p25: number;
    readonly median: number;
    readonly p55: number;
    readonly p75: number;
    readonly max: number;
    readonly standardDeviation: number;
    readonly interquartileRange: number;    // p75 - p25
  };

  readonly needsMoreSamples: boolean;
  readonly seedParDelta: number;

  readonly simulationPolicyVersion: string;
  readonly scoringConfigVersion: number;

  readonly generatedAt: string;             // ISO; overrideable for reproducibility
}
```

- Field names are load-bearing — WP-050 consumes every one. Renaming any field during execution forces a WP-050 amendment. If a rename is needed, STOP and escalate.

### `ParValidationResult` and `TierOrderingResult` (locked — pre-flight RS-3 + RS-4)

```ts
export type ParValidationSeverity = 'error' | 'warn';

export interface ParValidationIssue {
  readonly severity: ParValidationSeverity;
  readonly code: string;     // internal stable string; full-sentence message carries detail
  readonly message: string;  // full sentence per code-style Rule 11
}

export interface ParValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ParValidationIssue[];
}

export interface TierOrderingResult {
  readonly passed: boolean;
  readonly medians: Readonly<Record<AIPolicyTier, number>>;
  readonly violations: readonly string[];   // full sentences
}
```

- `ParValidationResult.valid === false` whenever any `issue.severity === 'error'`. A `'warn'` alone (e.g., multimodality smell-test flag) does NOT invalidate the result but must still be surfaced.
- Executor MAY simplify to `{ valid, errors: readonly string[] }` if the severity axis is not needed for the tests — document the simplification in DECISIONS.md. The 17-test count and §F/§G test content do not depend on the severity axis.

### `AIPolicyTier` + canonical array (locked)

```ts
export type AIPolicyTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

export const AI_POLICY_TIERS: readonly AIPolicyTier[] = [
  'T0', 'T1', 'T2', 'T3', 'T4',
] as const;

export interface AIPolicyTierDefinition {
  readonly tier: AIPolicyTier;
  readonly name: string;
  readonly purpose: string;
  readonly usedForPar: boolean;
}

export const AI_POLICY_TIER_DEFINITIONS: readonly AIPolicyTierDefinition[] = [
  { tier: 'T0', name: 'Random Legal',         purpose: 'Sanity / smoke tests',        usedForPar: false },
  { tier: 'T1', name: 'Naive',                purpose: 'Regression baseline',          usedForPar: false },
  { tier: 'T2', name: 'Competent Heuristic',  purpose: 'Primary PAR calibration',      usedForPar: true },
  { tier: 'T3', name: 'Strong Heuristic',     purpose: 'Upper-bound validation',       usedForPar: false },
  { tier: 'T4', name: 'Near-Optimal',         purpose: 'Research only',                usedForPar: false },
] as const;
```

- Drift test (test #11 in `par.aggregator.test.ts`): `AI_POLICY_TIERS.length === 5` AND for every member of the union there is exactly one entry in the canonical array. Same pattern as `MATCH_PHASES` / `TURN_STAGES` / `PENALTY_EVENT_TYPES`.
- Test #12: `AI_POLICY_TIER_DEFINITIONS.filter(entry => entry.usedForPar).length === 1` AND the lone entry is T2.

### Minimum sample size (locked)

- `N >= 500` per scenario (enforced in `validateParResult` as an `'error'` issue when violated).
- Recommended: 1000–2000.
- Test #6: result with `N < 500` fails validation.

### Neutral hero pool (locked)

- `generateScenarioPar` consumes `config.setupConfig.heroDeckIds` verbatim — the caller is responsible for passing a neutral pool. The aggregator does NOT modify or re-select heroes (D-0702 + §26 scenario-first-then-hero ordering).
- T2's policy reads the filtered `UIState` like any other policy — no special scenario introspection, no counter-picking.

### Loss treatment (locked)

- Losses (scheme victory, villain deck exhaustion) are included in the Raw Score distribution as first-class outcomes.
- No filtering, no weighting, no special casing.
- A loss produces a high Raw Score (many penalties, few rescues), which naturally penalizes degenerate scenarios.
- Test #17 asserts both: (a) mixed win/loss distributions produce the correct percentile without filtering, AND (b) `result.sampleSize === config.simulationCount` (no silent drops).

### Tier ordering (locked)

- `validateTierOrdering` requires `median(T3) < median(T2) < median(T1) < median(T0)` (lower is better).
- Minimum `N >= 50` per tier in tests.
- Test #9: passes when ordering holds. Test #10: fails when violated.

### Seed set canonicalization (locked)

- `generateSeedSet(baseSeed, count)` is deterministic (same inputs → same seed array, always).
- Index-based derivation pattern: each element is `djb2(baseSeed + ':' + index)` stringified, or equivalent stable mapping. Executor chooses the exact formula; document in DECISIONS.md.
- `computeSeedSetHash(seeds)` is deterministic and order-sensitive. Any stable hash is acceptable; djb2 over the joined array (e.g., `seeds.join('|')`) is sufficient per D-3601 "no crypto libraries in simulation." Document choice in DECISIONS.md.

### PAR reproducibility (locked)

- **Identical** `(scenarioKey, setupConfig, baseSeed, simulationCount, percentile, simulationPolicyVersion, scoringConfigVersion, generatedAtOverride)` + identical `scoringConfig` contents ⇒ **byte-identical** `ParSimulationResult`.
- Without `generatedAtOverride`, only `generatedAt` may differ run-to-run; all other fields must match.
- Every reproducibility test MUST inject `generatedAtOverride` — a test that omits it is a failing test (pre-flight RS-11).

### Tie-break RNG isolation (D-3604, locked)

- The aggregator MUST use two independent PRNG domains:
  - **Run-level shuffle RNG** — one per per-game loop invocation; derived from the per-game seed (the `i`-th entry of `generateSeedSet`). Drives deck reshuffles inside dispatched moves via `SimulationMoveContext.random.Shuffle`.
  - **Policy-level decision RNG** — owned by the T2 policy instance (`createCompetentHeuristicPolicy(seed)` closes over its own mulberry32 instance). Drives tie-break decisions inside `decideTurn`.
- The two domains **never share state**. Reseeding one domain (e.g., passing a different `baseSeed`) must not perturb the other.

### Legal-move conformance (locked)

- The `ClientTurnIntent` returned by T2 MUST correspond to exactly one of the `LegalMove[]` entries — matching by `move.name` **AND** required payload fields (e.g., `cardId`, `cityIndex`, `hqIndex`).
- "Almost matching" payloads are invalid — test #9 asserts `never produces an illegal move` across the four fight/recruit/reveal paths.

### Failure semantics (per-function — locked, MUST match EC-049)

| Function | Throws? | Returns on invalid input |
|---|---|---|
| `createCompetentHeuristicPolicy` | No | N/A |
| T2 `decideTurn` | No | Always returns a legal `ClientTurnIntent`; never throws |
| `aggregateParFromSimulation` | **Yes** — `ParAggregationError` | — |
| `generateScenarioPar` | No (propagates `ParAggregationError` only; never wraps or swallows) | N/A |
| `validateParResult` | No | Structured `ParValidationResult` |
| `validateTierOrdering` | No | Structured `TierOrderingResult` |
| `generateSeedSet` | No | Empty array when `count <= 0` |
| `computeSeedSetHash` | No | Stable hash for any input |

### Distribution integrity (locked)

- `generateScenarioPar` MUST assemble `rawScores: number[]` with `rawScores.length === config.simulationCount` before calling `aggregateParFromSimulation`.
- `ParSimulationResult` MUST survive `JSON.parse(JSON.stringify(result))` with structural equality — no functions, Maps, Sets, or class instances. Test #15 asserts this via `deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)))` alongside the byte-identity check.
- `result.sampleSize === config.simulationCount`. Test #17 asserts this.

### `needsMoreSamples` thresholds (pre-flight RS-6, locked)

- Module-level `const IQR_THRESHOLD = 2000` (centesimal units) and `const STDEV_THRESHOLD = 1500` (centesimal units) inside `par.aggregator.ts`.
- `needsMoreSamples = interquartileRange > IQR_THRESHOLD OR standardDeviation > STDEV_THRESHOLD`.
- Executor MAY select different numeric thresholds with a `// why:` comment + DECISIONS.md entry justifying the choice. The rule locked here is: **thresholds are module-level deterministic constants, not config inputs**.

### Multimodality smell-test (locked)

- Fixed-width 20-bin histogram over `[min, max]`.
- Flag `'multimodal-suspicion'` (severity `'warn'`) when `>= 2` bins each have `>= 20%` of the maximum bin count AND peaks are separated by `>= 2` bins.
- No external scenario-difficulty metadata consulted — input is only `result.rawScoreDistribution` + the raw scores array (passed in as a second arg to `validateParResult` or reconstructed from distribution bounds; executor chooses — lock the choice in DECISIONS.md).

### Registry parameter type (locked — PS-2)

- `generateScenarioPar` signature: `(config: ParSimulationConfig, registry: CardRegistryReader): ParSimulationResult`.
- **Never** `registry: CardRegistry`. Engine category forbids importing `@legendary-arena/registry` (D-3601).
- `CardRegistryReader` is imported from `'../matchSetup.validate.js'`.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any `import ... from 'boardgame.io'` in any new file (including sub-paths like `boardgame.io/testing`)
- Any `import ... from '@legendary-arena/registry'` in any new file
- Any modification to `simulation.runner.ts`, `ai.types.ts`, `ai.random.ts`, `ai.legalMoves.ts`, `simulation.test.ts`, `parScoring.types.ts`, `parScoring.logic.ts`, `parScoring.keys.ts`, `scoring.types.ts`, `scoring.logic.ts`
- Any `.reduce()` with branching in simulation logic (simple accumulation OK only if accompanied by a `// why:` comment justifying that no branching is present)
- Any `Math.random()` in any new file (except: `generatedAt = config.generatedAtOverride ?? new Date().toISOString()` is the sole locked clock use)
- Any `require()` in any file
- Any IO, network, filesystem, or environment access in new files
- Any modification to gameplay logic (moves, phases, hooks, rules, endgame, turn, villainDeck)
- Any modification to `game.ts`, `buildInitialGameState`, `buildUIState`, `filterUIStateForAudience`
- Any new G fields, moves, phases, stages, or trigger names
- Any modification to `makeMockCtx`, `FinalScoreSummary`, or any shared test helper
- Any files modified outside the 8-file Commit A allowlist
- Any attempt to call `Game.setup()` or import `LegendaryGame`
- Any storage of `AIPolicy`, `ParSimulationConfig`, or any function in `G`
- Any call to `crypto`, `node:crypto`, or external hashing libraries (djb2 inline is sufficient)
- Any test that asserts byte-identity on a `ParSimulationResult` WITHOUT injecting `generatedAtOverride`
- Any `rawScores.sort()` call without the explicit `(a, b) => a - b` comparator
- Any `ParAggregationError` test that matches by message substring (must be `instanceof` + `.code`)
- Any expansion of scope beyond WP-049 (no "while I'm here" improvements)

---

## AI Agent Warning (Strict)

The PAR simulation pipeline is **calibration tooling**. It does NOT participate in live gameplay. AI is tooling, not gameplay (D-0701). Balance changes require simulation (D-0702).

**Do NOT:**
- Modify any gameplay logic or move implementations
- Import `boardgame.io` in any new file (move files import it internally, but WP-049 files must not — the grep gate verifies this)
- Import `Game.setup()` or `LegendaryGame` — use `buildInitialGameState` directly per D-2702
- Attempt to use `makeMockCtx`'s shuffle as the aggregator PRNG — construct your own mulberry32 closures (one per run seed, one per policy seed) per D-2704 + D-3604
- Add new fields to `LegendaryGameState`, `FinalScoreSummary`, `UIState`, `SimulationResult`, `ScenarioScoringConfig`, or any WP-036/WP-048 type
- Store `AIPolicy` (a function) or `ParSimulationConfig` (contains no functions, but still ephemeral) in `G`
- Use `boardgame.io/testing` in any file
- Import registry package types — use `CardRegistryReader` local interface per PS-2
- Call `runSimulation` from `par.aggregator.ts` (RS-10: `SimulationResult` aggregates averages, not terminal `G` — replicate the per-game loop instead)

**Instead:**
- Replicate the per-game loop from `simulation.runner.ts` inside `par.aggregator.ts` using only engine primitives (`buildInitialGameState`, `buildUIState`, `filterUIStateForAudience`, `getLegalMoves`, `computeFinalScores`, `evaluateEndgame`, the 8 move imports, `advanceTurnStage`, `resetTurnEconomy`)
- Maintain a local `AggregatorMoveContext` interface (5 fields, same shape as `SimulationMoveContext` per D-2801 — local, not imported from `simulation.runner.ts`)
- Maintain a local `AggregatorLifecycleContext` or reuse the public `SimulationLifecycleContext` import from `ai.legalMoves.js` (the latter is preferred — it's the documented public contract)
- Derive `ScoringInputs` directly from the terminal `G` after each per-seed game completes. Reuse existing primitives (`computeFinalScores` for VP sum per D-4803; scan victory piles for `bystander` card types; read `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]` for escapes; `rounds = turnsElapsed` per game). Penalty-event counts follow WP-048's safe-skip (zero for types without an engine producer, per D-4801)
- Call `computeRawScore(inputs, config.scoringConfig)` per run to produce the distribution entries
- Use `for...of` everywhere; never `.reduce()` with branching

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/simulation/ai.tiers.ts` (new)

Implement the tier taxonomy exactly as shown in §Locked Values → `AIPolicyTier` + canonical array. Single file, no imports beyond types. Must be importable from `ai.competent.ts` (to read `AI_POLICY_TIER_DEFINITIONS`) and `par.aggregator.ts` (to validate tier ordering).

### B) Create `packages/game-engine/src/simulation/ai.competent.ts` (new)

**Imports (allowed):**

```ts
import type { AIPolicy, LegalMove } from './ai.types.js';
import type { UIState } from '../ui/uiState.types.js';
import type { ClientTurnIntent } from '../network/intent.types.js';
```

**Forbidden imports:** `boardgame.io`, `@legendary-arena/registry`, `../replay/**`, `../server/**`, `../moves/**` (move imports live in `par.aggregator.ts` only).

**Exports:** `createCompetentHeuristicPolicy(seed: string): AIPolicy`.

**Behavior — all five heuristics MUST be implemented (see WP-049 §A for full specification):**

1. Threat prioritization (`// why:` cites scoring impact)
2. Heroism bias (`// why:` cites moral hierarchy)
3. Economy awareness (`// why:` cites anti-exploit)
4. Limited deck awareness (`// why:` cites human memory)
5. Local optimization (`// why:` cites human decision-making)

**Policy construction:**

- Internal mulberry32 + djb2 helpers (duplicate from `ai.random.ts` pattern — do NOT export the helpers and do NOT import them; the WP-036 scope lock documents this duplication as intentional).
- Closure owns a single mulberry32 instance (tie-break RNG only).
- `name: \`CompetentHeuristic-${seed}\`` (or `'CompetentHeuristic'` if simpler — test #10 asserts `policy.name === 'CompetentHeuristic'`; if you choose the seed-suffix form, change test #10 to `assert.ok(policy.name.startsWith('CompetentHeuristic'))` — EC-049 §F test #10 is the authoritative assertion).
- `decideTurn(playerView, legalMoves)`:
  1. If `legalMoves.length === 0` — return `endTurn` intent (same fallback as T0 per `ai.random.ts:93-103`).
  2. Score each legal move using the five heuristics; deterministic tie-break via the policy mulberry32.
  3. Return a `ClientTurnIntent` pointing to the selected move (preserve `move.name` and `move.args` exactly from the chosen `LegalMove`).
  4. NEVER throw. NEVER access `G`. NEVER access hidden state.

**JSDoc "Forbidden behaviors" block** on `createCompetentHeuristicPolicy` and its returned policy's `decideTurn` (WP-028 projection-purity precedent). No caching, no memoization, no closures over `G`/`ctx`, no retained state that affects next call's output, no IO.

### C) Create `packages/game-engine/src/simulation/par.aggregator.ts` (new)

**Imports (allowed):**

```ts
import type { LegendaryGameState } from '../types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type {
  ScenarioKey,
  ScenarioScoringConfig,
  ScoringInputs,
  PenaltyEventType,
} from '../scoring/parScoring.types.js';
import type { UIState } from '../ui/uiState.types.js';
import type { ClientTurnIntent } from '../network/intent.types.js';

import type { AIPolicy, LegalMove } from './ai.types.js';
import type { SimulationLifecycleContext } from './ai.legalMoves.js';
import type { AIPolicyTier } from './ai.tiers.js';

import { getLegalMoves } from './ai.legalMoves.js';
import { createCompetentHeuristicPolicy } from './ai.competent.js';

import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { buildUIState } from '../ui/uiState.build.js';
import { filterUIStateForAudience } from '../ui/uiState.filter.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { computeFinalScores } from '../scoring/scoring.logic.js';
import { computeRawScore, computeParScore } from '../scoring/parScoring.logic.js';
import { PENALTY_EVENT_TYPES } from '../scoring/parScoring.types.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { resetTurnEconomy } from '../economy/economy.logic.js';
import { advanceTurnStage } from '../turn/turnLoop.js';

import { drawCards, playCard, endTurn } from '../moves/coreMoves.impl.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { fightVillain } from '../moves/fightVillain.js';
import { recruitHero } from '../moves/recruitHero.js';
import { fightMastermind } from '../moves/fightMastermind.js';
```

**Forbidden imports:** `boardgame.io`, `@legendary-arena/registry`, anything from `simulation.runner.ts` (RS-10 — replicate, don't import), anything from `apps/**`.

**Exports (in this order for readability):**

Types: `ParSimulationConfig`, `ParSimulationResult`, `ParValidationIssue`, `ParValidationSeverity`, `ParValidationResult`, `TierOrderingResult`, `ParAggregationErrorCode`.

Error class: `ParAggregationError`.

Constants (exported for testability): `PAR_PERCENTILE_DEFAULT = 55`, `PAR_MIN_SAMPLE_SIZE = 500`, `IQR_THRESHOLD`, `STDEV_THRESHOLD`, `MULTIMODALITY_BIN_COUNT = 20`.

Functions: `aggregateParFromSimulation`, `generateSeedSet`, `computeSeedSetHash`, `generateScenarioPar`, `validateParResult`, `validateTierOrdering`.

**Internal structure (do NOT export):**

- `interface AggregatorMoveContext` — local structural interface mirroring `SimulationMoveContext` from `simulation.runner.ts` (5 fields per D-2801).
- `function hashSeedString(seed: string): number` — djb2. Duplicated from `ai.random.ts` / `simulation.runner.ts` per WP-036 precedent.
- `function createMulberry32(seed: number): () => number` — same mulberry32 as `ai.random.ts`.
- `function shuffleWithPrng<T>(deck: T[], nextRandom): T[]` — Fisher-Yates; returns new array.
- `function buildMoveContext(G, playerId, phase, turn, numPlayers, endTurnFlag, nextRandom)` — constructs `AggregatorMoveContext`.
- `const MOVE_MAP: Record<string, MoveFn>` — 8 entries per WP-036 precedent.
- `function simulateOneGame(config, registry, seed, gameIndex, t2Policy): { finalState, turnCount, isHeroesWin }` — replicated per-game loop. 200-turn safety cap. Uses `config.setupConfig`, one seeded shuffle PRNG per call (`hashSeedString(seed)`).
- `function deriveScoringInputsFromFinalState(finalState, turnCount): ScoringInputs` — builds `ScoringInputs` from terminal `G`:
  - `rounds = turnCount`
  - `victoryPoints = sum over computeFinalScores(finalState).players[i].totalVP` (D-4803)
  - `bystandersRescued = count CardExtIds in every player's victory pile whose cardType is 'bystander'` (mirrors `deriveScoringInputs` in `parScoring.logic.ts`)
  - `escapes = finalState.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0`
  - `penaltyEventCounts = { villainEscaped: escapes, bystanderLost: 0, schemeTwistNegative: 0, mastermindTacticUntaken: 0, scenarioSpecificPenalty: 0 }` — safe-skip per WP-048 D-4801 for the four penalty types with no engine producer today. `// why:` citing D-4801.

**`generateScenarioPar` orchestration:**

1. Validate inputs: `simulationCount >= PAR_MIN_SAMPLE_SIZE` (otherwise throw `ParAggregationError` with `code: 'EMPTY_DISTRIBUTION'`? — **no**, use a dedicated validator path: `validateParResult` returns a failed result; `generateScenarioPar` proceeds but the caller handles). **Simpler rule:** `generateScenarioPar` does NOT enforce `>= 500` — it runs whatever count the config specifies. `validateParResult` is the enforcement point, so seed-bootstrapping with `N=10` for unit tests remains possible. Document this in DECISIONS.md. Tests #5 / #6 target `validateParResult`, not `generateScenarioPar`.
2. `seeds = generateSeedSet(config.baseSeed, config.simulationCount)`.
3. `seedSetHash = computeSeedSetHash(seeds)`.
4. `rawScores: number[] = []`. For each `seed` in `seeds`:
   - `t2Policy = createCompetentHeuristicPolicy(seed)` — fresh policy per seed (decision RNG domain).
   - `{ finalState, turnCount } = simulateOneGame(config, registry, seed, index, t2Policy)` — fresh shuffle RNG per game (shuffle domain).
   - `inputs = deriveScoringInputsFromFinalState(finalState, turnCount)`.
   - `score = computeRawScore(inputs, config.scoringConfig)`.
   - `rawScores.push(score)`.
5. **Invariant:** `assert(rawScores.length === config.simulationCount)` internally — if this fails, a seed was silently dropped (impossible given the loop structure, but codify the invariant). Use `if (rawScores.length !== config.simulationCount) throw new ParAggregationError('EMPTY_DISTRIBUTION', 'Internal invariant violation: rawScores.length (${rawScores.length}) !== simulationCount (${config.simulationCount}).');`
6. `parValue = aggregateParFromSimulation(rawScores, config.percentile)` — may throw `ParAggregationError` on empty array or bad percentile. `generateScenarioPar` does not catch; the error propagates to the caller.
7. Compute distribution stats (`min`, `p25`, `median`, `p55`, `p75`, `max`, `standardDeviation`, `interquartileRange`) from the sorted array. Reuse the nearest-rank formula for the percentile stats.
8. `needsMoreSamples = interquartileRange > IQR_THRESHOLD || standardDeviation > STDEV_THRESHOLD`.
9. `seedParDelta = parValue - computeParScore(config.scoringConfig)`. `computeParScore` is exported from `parScoring.logic.ts` and applies the same formula as `computeRawScore` to the `ParBaseline` values. This is the seed PAR (content-authored) — `seedParDelta` measures how far the simulation PAR drifts from the seed PAR for the same scenario.
10. Build the final result with fresh object literal for `rawScoreDistribution` (no aliasing — WP-028 D-2801):

```ts
const result: ParSimulationResult = {
  scenarioKey: config.scenarioKey,
  parValue,
  percentileUsed: config.percentile,
  sampleSize: config.simulationCount,
  seedSetHash,
  rawScoreDistribution: {
    min: /* ... */,
    p25: /* ... */,
    median: /* ... */,
    p55: /* ... */,
    p75: /* ... */,
    max: /* ... */,
    standardDeviation: /* ... */,
    interquartileRange: /* ... */,
  },
  needsMoreSamples,
  seedParDelta,
  simulationPolicyVersion: config.simulationPolicyVersion,
  scoringConfigVersion: config.scoringConfigVersion,
  generatedAt: config.generatedAtOverride ?? new Date().toISOString(),
};
return result;
```

**`aggregateParFromSimulation(rawScores, percentile)`:**

```ts
if (rawScores.length === 0) {
  throw new ParAggregationError(
    'EMPTY_DISTRIBUTION',
    'aggregateParFromSimulation requires at least one raw score to compute a percentile.',
  );
}
if (percentile < 0 || percentile > 100) {
  throw new ParAggregationError(
    'PERCENTILE_OUT_OF_RANGE',
    `aggregateParFromSimulation requires percentile in [0, 100]; got ${percentile}.`,
  );
}
// why: explicit numeric comparator required — default sort() is lexical.
const sortedAscending = [...rawScores].sort((left, right) => left - right);
const nearestRankIndex = Math.max(
  0,
  Math.min(
    sortedAscending.length - 1,
    Math.ceil((percentile / 100) * sortedAscending.length) - 1,
  ),
);
return sortedAscending[nearestRankIndex]!;
```

### D) Modify `packages/game-engine/src/types.ts`

Append PAR simulation type re-exports at the end of the file (mirror the WP-036 pattern for `AIPolicy` / `LegalMove` / `SimulationConfig` / `SimulationResult`):

```ts
export type {
  ParSimulationConfig,
  ParSimulationResult,
  ParValidationIssue,
  ParValidationSeverity,
  ParValidationResult,
  TierOrderingResult,
  ParAggregationErrorCode,
  AIPolicyTier,
  AIPolicyTierDefinition,
} from './simulation/par.aggregator.js';

export type { AIPolicyTier } from './simulation/ai.tiers.js';  // if not already exported via par.aggregator
```

Do NOT add any other modification. Do NOT reorder existing exports.

### E) Modify `packages/game-engine/src/index.ts`

Add the public PAR simulation API (mirror WP-036's simulation exports pattern):

```ts
export { createCompetentHeuristicPolicy } from './simulation/ai.competent.js';
export {
  aggregateParFromSimulation,
  generateScenarioPar,
  validateParResult,
  validateTierOrdering,
  generateSeedSet,
  computeSeedSetHash,
  ParAggregationError,
} from './simulation/par.aggregator.js';
export {
  AI_POLICY_TIERS,
  AI_POLICY_TIER_DEFINITIONS,
} from './simulation/ai.tiers.js';
```

Type re-exports go through `types.ts` (task D); do not duplicate here.

### F) Create `packages/game-engine/src/simulation/ai.competent.test.ts` (new — 10 tests)

Structure:

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createCompetentHeuristicPolicy } from './ai.competent.js';
// ...plus whatever synthetic UIState / LegalMove fixtures tests need

describe('T2 Competent Heuristic policy (WP-049)', () => {
  test('policy implements AIPolicy interface (name + decideTurn)', () => { /* ... */ });
  test('same seed + same state = same decision (determinism)', () => { /* ... */ });
  test('different seed = different tie-breaking decisions', () => { /* ... */ });
  test('prefers fighting villain with bystander over villain without (heroism bias)', () => { /* ... */ });
  test('prefers preventing imminent escape over recruiting (threat prioritization)', () => { /* ... */ });
  test('does not stall when fighting is available (economy awareness)', () => { /* ... */ });
  test('AI does not access hidden state (filtered UIState only)', () => { /* ... */ });
  test('T2 produces valid ClientTurnIntent for all legal move types', () => { /* ... */ });
  test('T2 never produces an illegal move', () => { /* ... */ });
  test('T2 policy name is CompetentHeuristic (or starts with)', () => { /* ... */ });
});
```

All tests use synthetic `UIState` + `LegalMove[]` fixtures. No `makeMockCtx` modification. No live `G` construction in this file (that's exercised in `par.aggregator.test.ts`). Exactly 10 tests wrapped in one `describe` → +1 suite.

### G) Create `packages/game-engine/src/simulation/par.aggregator.test.ts` (new — 17 tests)

Structure:

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateParFromSimulation,
  generateScenarioPar,
  validateParResult,
  validateTierOrdering,
  generateSeedSet,
  computeSeedSetHash,
  ParAggregationError,
  AI_POLICY_TIERS,
  AI_POLICY_TIER_DEFINITIONS,
} from '../index.js';

describe('PAR aggregator (WP-049)', () => {
  test('aggregateParFromSimulation with 1000 scores returns 55th percentile (rankIndex 549)', () => { /* ... */ });
  test('percentile of sorted identical scores returns that score (integer)', () => { /* ... */ });
  test('empty array throws ParAggregationError with code EMPTY_DISTRIBUTION', () => {
    try {
      aggregateParFromSimulation([], 55);
      assert.fail('expected throw');
    } catch (error) {
      assert.ok(error instanceof ParAggregationError);
      assert.equal(error.code, 'EMPTY_DISTRIBUTION');
    }
  });
  test('percentile outside [0,100] throws ParAggregationError with code PERCENTILE_OUT_OF_RANGE', () => { /* ... */ });
  test('validateParResult accepts valid result with N >= 500', () => { /* ... */ });
  test('validateParResult rejects result with N < 500', () => { /* ... */ });
  test('validateParResult passes unimodal distribution cleanly', () => { /* ... */ });
  test('validateParResult flags bimodal distribution as suspicious (histogram peak detection)', () => { /* ... */ });
  test('validateTierOrdering passes when T3 < T2 < T1 < T0 medians (N >= 50 per tier)', () => { /* ... */ });
  test('validateTierOrdering fails when ordering violated', () => { /* ... */ });
  test('AI_POLICY_TIERS matches AIPolicyTier union exactly (drift detection)', () => {
    assert.equal(AI_POLICY_TIERS.length, 5);
    assert.deepStrictEqual([...AI_POLICY_TIERS], ['T0', 'T1', 'T2', 'T3', 'T4']);
  });
  test('only T2 has usedForPar: true', () => {
    const parTiers = AI_POLICY_TIER_DEFINITIONS.filter(e => e.usedForPar);
    assert.equal(parTiers.length, 1);
    assert.equal(parTiers[0]!.tier, 'T2');
  });
  test('generateSeedSet same baseSeed + same count = same seeds', () => { /* ... */ });
  test('computeSeedSetHash same seeds = same hash', () => { /* ... */ });
  test('generateScenarioPar is byte-identical + JSON-roundtrip stable with injected generatedAtOverride', () => {
    // NOTE: this test MUST inject config.generatedAtOverride.
    // It performs BOTH:
    //   (a) assert.deepStrictEqual(resultA, resultB)
    //   (b) assert.deepStrictEqual(JSON.parse(JSON.stringify(resultA)), JSON.parse(JSON.stringify(resultB)))
    // Proving byte-identity AND JSON-serializability in one test preserves the 17-test lock.
  });
  test('generateScenarioPar copies simulationPolicyVersion and scoringConfigVersion verbatim', () => { /* ... */ });
  test('losses included in distribution; result.sampleSize === config.simulationCount', () => { /* ... */ });
});
```

Exactly 17 tests wrapped in one `describe` → +1 suite. Every test that asserts byte-identity injects `generatedAtOverride`.

### H) Modify `docs/ai/DECISIONS.md`

Append (new) decisions covering at minimum:

- **Why T2 is the sole PAR authority** — heuristic calibrated to experienced human play; T0/T1 too weak for valid PAR; T3/T4 too strong; §26 + D-0702.
- **Why 55th percentile (nearest-rank)** — robust to outliers; slightly conservative; integer-preserving; deterministic.
- **Why neutral hero pool** — PAR is Layer A (scenario difficulty), hero choice is Layer B (§26); counter-picking would contaminate the measurement.
- **Why N >= 500 minimum** — noise floor per initial calibration; recommended N=1000–2000; enforceable via `validateParResult`.
- **T2 behavioral heuristics rationale** — five heuristics selected to model experienced players; each heuristic has a scoring motivation.
- **Loss treatment rationale** — losses included as first-class outcomes; filtering would produce artificially optimistic PAR.
- **Pre-release gate rationale** — PAR must exist for every official scenario before leaderboard entries accepted (server-layer enforcement per WP-051).
- **Seed-set canonicalization rationale** — deterministic index-based derivation + canonical hash → reproducibility + audit.
- **Immutable Raw Score surface** — changes require major version bump (WP-040).
- **`generateScenarioPar` does NOT enforce min sample size** — `validateParResult` is the enforcement point so seed-bootstrapping tests remain possible (pre-flight RS-6 clarification).
- **`needsMoreSamples` thresholds** — specific numeric values chosen; module-level constants not config inputs.
- **`ParValidationResult` severity axis** — if simplified to `{ valid, errors }`, document here.

Each decision gets a `D-NNNN` identifier from the next available range (check DECISIONS.md head for last-issued ID).

---

## Scope Lock (Authoritative)

### Commit A (EC-049) — exactly 8 files

- `packages/game-engine/src/simulation/ai.competent.ts` — NEW
- `packages/game-engine/src/simulation/ai.tiers.ts` — NEW
- `packages/game-engine/src/simulation/par.aggregator.ts` — NEW
- `packages/game-engine/src/simulation/ai.competent.test.ts` — NEW
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — NEW
- `packages/game-engine/src/types.ts` — MODIFIED (type re-exports only; no other changes)
- `packages/game-engine/src/index.ts` — MODIFIED (add public API exports; no other changes)
- `docs/ai/DECISIONS.md` — MODIFIED (new PAR decisions)

### Commit B (SPEC) — exactly 4 files

- `docs/ai/work-packets/WORK_INDEX.md` — flip WP-049 `[ ]` → `[x]` with date + Commit A hash
- `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-049 Draft → Done
- `docs/ai/STATUS.md` — record T2 + PAR pipeline availability
- `docs/ai/post-mortems/01.6-WP-049-par-simulation-engine.md` — NEW post-mortem file (mandatory per 01.6)

### Files explicitly forbidden to touch

- Any file under `packages/game-engine/src/` NOT listed above
- `packages/game-engine/src/simulation/ai.types.ts` / `ai.random.ts` / `ai.legalMoves.ts` / `simulation.runner.ts` / `simulation.test.ts` (WP-036 contract — immutable)
- `packages/game-engine/src/scoring/parScoring.types.ts` / `parScoring.logic.ts` / `parScoring.keys.ts` (WP-048 contract — immutable)
- `packages/game-engine/src/scoring/scoring.types.ts` / `scoring.logic.ts` (WP-020 contract — immutable)
- `packages/game-engine/src/game.ts`, any moves file, any phase/turn/rule/zone/ui/replay/invariants file
- `packages/game-engine/src/test/mockCtx.ts` — immutable shared helper
- `packages/game-engine/src/matchSetup.types.ts` / `matchSetup.validate.ts` — immutable upstream contract
- `packages/registry/**`, `packages/preplan/**`, `apps/**`
- `package.json`, `pnpm-lock.yaml`, `tsconfig*.json`, `.claude/rules/**`, `docs/ai/REFERENCE/**`

If the implementation uncovers a structural problem that would require touching any of these files, **STOP and escalate** — do not force-fit under 01.5 (it is NOT INVOKED).

---

## Verification Steps

Run all of the following after Commit A is drafted but BEFORE committing. All must pass.

### Build + test

```bash
pnpm --filter @legendary-arena/game-engine build
# Expected: exit 0

pnpm -r test
# Expected: exit 0; 623 tests / 125 suites / 0 fail.
# game-engine specifically: 471 / 112 / 0.
```

### Layer-boundary grep gates (import-line-specific per P6-50)

```bash
grep -nE "from ['\"]boardgame\.io" packages/game-engine/src/simulation/ai.competent.ts packages/game-engine/src/simulation/par.aggregator.ts packages/game-engine/src/simulation/ai.tiers.ts packages/game-engine/src/simulation/ai.competent.test.ts packages/game-engine/src/simulation/par.aggregator.test.ts
# Expected: no output.

grep -nE "from ['\"]@legendary-arena/registry" packages/game-engine/src/simulation/ai.competent.ts packages/game-engine/src/simulation/par.aggregator.ts packages/game-engine/src/simulation/ai.tiers.ts
# Expected: no output.

grep -nE "Math\.random" packages/game-engine/src/simulation/ai.competent.ts packages/game-engine/src/simulation/par.aggregator.ts packages/game-engine/src/simulation/ai.tiers.ts
# Expected: no output.

grep -nE "\.reduce\(" packages/game-engine/src/simulation/ai.competent.ts packages/game-engine/src/simulation/par.aggregator.ts
# Expected: no output (even simple accumulation — use for...of).

grep -nE "require\(" packages/game-engine/src/simulation/ai.competent.ts packages/game-engine/src/simulation/par.aggregator.ts packages/game-engine/src/simulation/ai.tiers.ts packages/game-engine/src/simulation/ai.competent.test.ts packages/game-engine/src/simulation/par.aggregator.test.ts
# Expected: no output.
```

### Upstream contract integrity

```bash
git diff main -- packages/game-engine/src/simulation/ai.types.ts \
                 packages/game-engine/src/simulation/ai.random.ts \
                 packages/game-engine/src/simulation/ai.legalMoves.ts \
                 packages/game-engine/src/simulation/simulation.runner.ts \
                 packages/game-engine/src/simulation/simulation.test.ts \
                 packages/game-engine/src/scoring/parScoring.types.ts \
                 packages/game-engine/src/scoring/parScoring.logic.ts \
                 packages/game-engine/src/scoring/parScoring.keys.ts
# Expected: no output.
```

### `// why:` comment completeness

```bash
grep -c "// why:" packages/game-engine/src/simulation/ai.competent.ts
# Expected: >= 6 (5 heuristics + RNG isolation)

grep -c "// why:" packages/game-engine/src/simulation/par.aggregator.ts
# Expected: >= 10 (percentile + sort comparator + error union + orchestration + seed set + generatedAt + thresholds + tier ordering + JSON invariant + per-game loop replication)
```

### Scope lock — only expected files changed

```bash
git diff --name-only main | sort
# Expected for Commit A (exactly 8 lines):
#   docs/ai/DECISIONS.md
#   packages/game-engine/src/index.ts
#   packages/game-engine/src/simulation/ai.competent.test.ts
#   packages/game-engine/src/simulation/ai.competent.ts
#   packages/game-engine/src/simulation/ai.tiers.ts
#   packages/game-engine/src/simulation/par.aggregator.test.ts
#   packages/game-engine/src/simulation/par.aggregator.ts
#   packages/game-engine/src/types.ts
```

### Suite count discipline (P6-54)

```bash
pnpm --filter @legendary-arena/game-engine test 2>&1 | grep "ℹ suites"
# Expected: "ℹ suites 112" — exactly +2 from baseline 110.
```

If the suite count is 111 or 110, one or both test files are missing a `describe()` wrapper. Add the wrapper; do NOT add more tests.

---

## Definition of Done

Every item below MUST be true before Commit A is committed:

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm -r test` exits 0 with `623 / 125 / 0` total; `471 / 112 / 0` for game-engine
- [ ] All 10 T2 policy tests pass; all 17 aggregator tests pass
- [ ] Every test file uses `.test.ts`; no `boardgame.io/testing` import
- [ ] No `boardgame.io` / `@legendary-arena/registry` imports in any new file (grep-verified with import-line-specific pattern)
- [ ] No `Math.random()`, `.reduce()` with branching, or `require()` in any new file
- [ ] No engine gameplay / upstream contract files modified (git-diff-verified)
- [ ] `generateScenarioPar` signature uses `registry: CardRegistryReader` (PS-2)
- [ ] `ParAggregationError.code` is the typed union; tests match `instanceof` + `.code`
- [ ] Test #15 asserts both byte-identity AND JSON round-trip
- [ ] Test #17 asserts `result.sampleSize === config.simulationCount`
- [ ] Every reproducibility test in `par.aggregator.test.ts` injects `generatedAtOverride`
- [ ] `AI_POLICY_TIERS` drift test passes (test #11); only-T2-usedForPar test passes (test #12)
- [ ] `docs/ai/DECISIONS.md` contains the new PAR decisions (minimum 11 items per task H)
- [ ] Post-mortem written at `docs/ai/post-mortems/01.6-WP-049-par-simulation-engine.md` covering the 6 mandatory checks (pre-Commit B)
- [ ] Commit A subject line starts with `EC-049:`; Commit B subject line starts with `SPEC:`

---

## Final Instruction

WP-049 is the moment the engine gains the ability to measure scenario difficulty without human playtesting. Every architectural choice in this prompt — the two independent PRNG domains, the replicated per-game loop, the immutable upstream contracts, the per-function throw/no-throw table, the JSON-roundtrip discipline, the reproducibility override — exists to make PAR measurements **trustworthy enough to gate leaderboard entries**. If any constraint feels tedious: read the pre-flight (§Risk Review) and the decision (D-0702). The tedium is the point.

If anything is unclear, STOP and ask. Do not guess.
