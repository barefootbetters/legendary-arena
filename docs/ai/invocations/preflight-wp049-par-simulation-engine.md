# Pre-Flight Invocation — WP-049

---

### Pre-Flight Header

**Target Work Packet:** `WP-049`
**Title:** PAR Simulation Engine
**Previous WP Status:**
- WP-036 Complete (commit `539b543`, post-mortem + EC + STATUS closed in `61df4c0`)
- WP-048 Complete (commit `2587bbb`, pre-flight + decisions `c5f7ca4`)
**Pre-Flight Date:** 2026-04-23
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Inputs loaded:**
- Session context: `docs/ai/session-context/session-context-wp049.md`
- Reference: `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`
- Reference: `docs/ai/REFERENCE/01.7-copilot-check.md`

**Work Packet Class:** Infrastructure & Verification

WP-049 introduces the T2 Competent Heuristic AI policy and the PAR
aggregation pipeline. The new code (a) runs outside the boardgame.io
lifecycle (no move, no phase hook, no `G` mutation by the new files),
(b) consumes the WP-036 simulation framework and the WP-048 scoring
contracts, (c) emits a data-only `ParSimulationResult` consumed by
WP-050 (PAR Artifact Storage). T2 is a policy passed into
`runSimulation`; `runSimulation` already owns the only write paths to
`G`. No new G fields, no wiring into `LegendaryGame.moves`, no new
phase hooks. This matches the "Infrastructure & Verification" class
defined by `01.4` (harnesses, replay, testing infra, verification
tooling — has runtime logic but does not mutate `G` in gameplay).

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-049.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY**
and stop.

---

### Authority Chain (Must Read)

1. `.claude/CLAUDE.md` — EC-mode rules, lint gate, execution checklists
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary (Simulation lives in engine
   category; no boardgame.io, registry, or server imports)
3. `docs/01-VISION.md` — §3, §20, §22, §23, §25, §26; NG-1/NG-7
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — `src/simulation/` classified
   as engine category via D-3601
5. `docs/ai/execution-checklists/EC-049-par-simulation-engine.checklist.md`
6. `docs/ai/work-packets/WP-049-par-simulation-engine.md`
7. `docs/ai/work-packets/WP-050-par-artifact-storage.md` — locks the
   field names WP-049 must emit (downstream consumer)
8. `docs/ai/DECISIONS.md` — D-0701, D-0702, D-2704, D-2801, D-3601,
   D-3602, D-3604, D-4801–D-4806

On conflict, higher-authority documents win.

---

### Vision Sanity Check

- **Vision clauses touched:** §3 (Trust & Fairness), §20 (PAR is beatable,
  skill-measurement), §22 (Deterministic Evaluation), §23 (Reproducibility),
  §25 (Skill Measurement), §26 (PAR derivation pipeline); NG-1 (No
  Pay-to-Win); NG-7 (No Persuasion Surfaces).
- **Conflict assertion:** No conflict — WP-049 preserves all touched
  clauses. The simulation policy (T2) is rules-faithful, never
  superhuman; PAR is scenario-only and available before hero choice;
  the derivation is transparent and version-controlled.
- **Non-Goal proximity:** NG-1 and NG-7 confirmed clear. PAR is
  deterministic, seed-driven, and version-pinned — no monetization path
  can alter a scenario's PAR value. T2 does not model persuasion,
  cosmetic, or engagement surfaces.
- **Determinism preservation:** STRONG. Two-domain PRNG (D-3604) —
  run-level shuffle RNG and policy-level decision RNG never share
  state. Percentile aggregation uses integer-preserving nearest-rank
  (no float interpolation). `generatedAtOverride` is required for
  reproducibility tests; without it, `generatedAt` is the only
  non-deterministic field and is clearly documented as such.
- **WP `## Vision Alignment` block:** Present in WP-049 §Vision
  Alignment (lines 498–523). Cites §3, §22, §23, §25, §26, NG-1, NG-7
  and D-0701, D-0702, D-3604, D-3602, D-1244.

---

### Dependency & Sequencing Check

| WP | Required Artifacts | Status | Notes |
|---|---|---|---|
| WP-036 | `AIPolicy`, `LegalMove`, `SimulationConfig`, `SimulationResult`, `createRandomPolicy`, `getLegalMoves`, `runSimulation`, `SimulationLifecycleContext` | ✅ Complete | Committed `539b543` (+ closure `61df4c0`). `packages/game-engine/src/simulation/` contains `ai.types.ts`, `ai.random.ts`, `ai.legalMoves.ts`, `simulation.runner.ts`, `simulation.test.ts`. |
| WP-048 | `ScenarioScoringConfig`, `ScoringInputs`, `ScoreBreakdown`, `ParBaseline`, `PenaltyEventType`, `PENALTY_EVENT_TYPES`, `computeRawScore`, `buildScoreBreakdown`, `buildScenarioKey`, `validateScoringConfig` | ✅ Complete | Committed `2587bbb` (+ SPEC amendments `c5f7ca4`). `packages/game-engine/src/scoring/parScoring.types.ts`, `parScoring.logic.ts`, `parScoring.keys.ts` present and exported. |
| WP-049 itself | Draft WP + EC with surgical tightening applied 2026-04-23 (uncommitted) | ✅ Reviewed | `git status` confirms uncommitted edits on WP-049, EC-049, WP-050 — same three files identified by the session-context bridge. |

**No Foundation Prompt impact:** WP-049 introduces no env vars, R2 data,
database schema, or server wiring. FP-00.4/00.5/01/02 assumptions
remain valid.

**Verdict:** all prerequisite WPs are complete; session-context's
"must-resolve" item #3 (contract surfaces unchanged) is verified by
`git log -- packages/game-engine/src/simulation/` and
`git log -- packages/game-engine/src/scoring/` — no commits touch
either directory since WP-036 / WP-048 closed.

---

### Dependency Contract Verification

Every dependency name used by WP-049 was cross-checked against the
actual source files at HEAD.

#### WP-036 surface (verified against `packages/game-engine/src/simulation/*.ts`)

- [x] `AIPolicy { name: string; decideTurn(playerView: UIState, legalMoves: LegalMove[]): ClientTurnIntent }` — matches `ai.types.ts:55-61`. T2 must implement this exact shape.
- [x] `LegalMove { name: string; args: unknown }` — matches `ai.types.ts:31-34`.
- [x] `SimulationConfig { games, seed, setupConfig, policies }` — matches `ai.types.ts:71-76`.
- [x] `SimulationResult { gamesPlayed, winRate, averageTurns, averageScore, escapedVillainsAverage, woundsAverage, seed }` — matches `ai.types.ts:86-94`. `generateScenarioPar` must build `ScoringInputs` from `SimulationResult` + final `G` projections; WP-049 §B is silent on exact mapping but the executor has the existing `deriveScoringInputs` pattern from WP-048 to reuse (see RS-2 below).
- [x] `createRandomPolicy(seed: string): AIPolicy` — matches `ai.random.ts:86`.
- [x] `getLegalMoves(gameState, context: SimulationLifecycleContext): LegalMove[]` — matches `ai.legalMoves.ts:89-92`.
- [x] `runSimulation(config, registry: CardRegistryReader): SimulationResult` — matches `simulation.runner.ts:495-498`.
- [ ] **CONTRACT DRIFT:** WP-049 §B line 357 names the parameter type as
      `CardRegistry`, but the established engine convention (D-3601 +
      D-2504 + WP-036's `runSimulation`) is `CardRegistryReader` (local
      structural interface from `matchSetup.validate.ts:28`). The real
      `CardRegistry` type lives in `@legendary-arena/registry`, which
      the engine category is forbidden to import. **Blocking finding
      PS-2 below.**

#### WP-048 surface (verified against `packages/game-engine/src/scoring/*.ts`)

- [x] `ScenarioScoringConfig { scenarioKey, weights, caps, penaltyEventWeights, parBaseline, scoringConfigVersion, createdAt, updatedAt }` — matches `parScoring.types.ts:145-166`.
- [x] `ScoringInputs { rounds, victoryPoints, bystandersRescued, escapes, penaltyEventCounts }` — matches `parScoring.types.ts:180-191`.
- [x] `ScoreBreakdown { inputs, weightedRoundCost, weightedPenaltyTotal, penaltyBreakdown, weightedBystanderReward, weightedVictoryPointReward, rawScore, parScore, finalScore, scoringConfigVersion }` — matches `parScoring.types.ts:200-221`.
- [x] `ParBaseline { roundsPar, bystandersPar, victoryPointsPar, escapesPar }` — matches `parScoring.types.ts:124-133`.
- [x] `PENALTY_EVENT_TYPES` canonical array — matches `parScoring.types.ts:94-100`.
- [x] `computeRawScore(inputs, config): number` — matches `parScoring.logic.ts:149-152`.
- [x] `buildScoreBreakdown(inputs, config): ScoreBreakdown` — matches `parScoring.logic.ts:252-255`.
- [x] `buildScenarioKey(scheme, mastermind, villains): ScenarioKey` — matches `parScoring.keys.ts:30-34`.
- [x] `validateScoringConfig(config): ScoringConfigValidationResult` — matches `parScoring.logic.ts:354-356`; never throws; structured return.
- [x] `deriveScoringInputs(replayResult, gameState): ScoringInputs` — present at `parScoring.logic.ts:51-54` but note it depends on `ReplayResult` (WP-027). WP-049 will need to build `ScoringInputs` from a `SimulationResult` + terminal `G`, not a replay result. The mapping helper belongs inside `par.aggregator.ts`; it does not modify `deriveScoringInputs`. (See RS-2.)

#### Shared field names (cross-checked)

- [x] `MatchSetupConfig` — canonical setup contract from `matchSetup.types.ts`; used unchanged.
- [x] `UIState` — from `ui/uiState.types.ts`; T2 consumes the
      audience-filtered projection only, same as the random policy
      (D-0701, D-3602).
- [x] `ClientTurnIntent { matchId, playerId, turnNumber, move: { name, args } }` — from `network/intent.types.ts`; already returned by the random policy. T2 must produce the same shape.
- [x] `SimulationLifecycleContext { phase, turn, currentPlayer, numPlayers }` — from `simulation/ai.legalMoves.ts:51-56`; exported publicly; no changes expected.

#### Code category classification

- [x] `src/simulation/` classified as engine category via **D-3601**
      (WP-036 pre-flight PS-1). No new D-entry required for WP-049 —
      the 3 new files plus 2 test files all land in an already-classified
      directory.

#### Decision-ID sanity check

- [x] D-0701 present (DECISIONS.md — AI Is Tooling, Not Gameplay).
- [x] D-0702 present (Balance Changes Require Simulation).
- [x] D-3604 present (Simulation Seed Reproducibility: Two Independent
      PRNG Domains).
- [x] D-2704 present (MVP Replay Uses Deterministic Mock Shuffle, Not
      Seed-Faithful Replay) — inherited by WP-049 for the seed-faithful
      reproducibility claim.
- [x] D-2801 present (local structural interface pattern) — applies to
      `ParValidationResult` and `TierOrderingResult` exact shapes.
- [x] Em-dash encoding risk (P6-27) — searched DECISIONS.md for em-dash
      `D‑` variants; present. No false-miss risk.

---

### Input Data Traceability Check

- [x] All non-user-generated inputs are listed in `docs/03.1-DATA-SOURCES.md` —
      **YES** (WP-049 consumes only `MatchSetupConfig` + `ScenarioScoringConfig`
      + `CardRegistryReader`; no new data sources).
- [x] Storage locations known — **YES** (WP-049 produces `ParSimulationResult`
      as in-memory data; no persistence. WP-050 is responsible for writing
      artifacts to disk).
- [x] Debuggable if behavior is wrong — **YES** (deterministic from
      `baseSeed` + `setupConfig` + `simulationPolicyVersion` +
      `scoringConfigVersion` + optional `generatedAtOverride`; single
      JSON result object).
- [x] No implicit data — **YES** (all inputs are explicit parameters).
- [x] Setup-time derived data — **N/A**. WP-049 does not add runtime
      fields to `G`.

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — **YES**.
      Baseline captured 2026-04-23 via `pnpm -r test`:

      | Package | Tests | Suites | Pass | Fail |
      |---|---:|---:|---:|---:|
      | packages/registry | 13 | 2 | 13 | 0 |
      | packages/vue-sfc-loader | 11 | 0 | 11 | 0 |
      | **packages/game-engine** | **444** | **110** | **444** | **0** |
      | apps/server | 6 | 2 | 6 | 0 |
      | apps/replay-producer | 4 | 2 | 4 | 0 |
      | packages/preplan | 52 | 7 | 52 | 0 |
      | apps/arena-client | 66 | 0 | 66 | 0 |
      | **Total** | **596** | **123** | **596** | **0** |

      WP-049 must not regress this baseline. The 2026-04-17 count of
      409 cited in the WP-048 bridge is **stale** — do not reuse it.

- [x] No known EC violations remain open — **YES**.
- [x] Required types/contracts exist and are exported — **YES**
      (all WP-036 and WP-048 surfaces verified above).
- [x] No naming/ownership conflicts — **YES**. WP-049 exports
      `createCompetentHeuristicPolicy`, `aggregateParFromSimulation`,
      `generateScenarioPar`, `validateParResult`, `validateTierOrdering`,
      `generateSeedSet`, `computeSeedSetHash`, `AI_POLICY_TIERS`,
      `AI_POLICY_TIER_DEFINITIONS`, `ParSimulationConfig`,
      `ParSimulationResult`, `ParValidationResult`, `TierOrderingResult`,
      `ParAggregationError`, `AIPolicyTier`. Grep confirmed no
      collisions at HEAD.
- [x] No architectural boundary conflicts anticipated at the contract
      level — **YES** (engine category, D-3601).

No NO answers → pre-flight remains **READY** at the structural layer.

---

### Runtime Readiness Check

WP-049 is **Infrastructure & Verification** class. The new policy and
aggregator do not mutate `G` directly. Writes to `G` still happen only
inside `runSimulation` (WP-036), via the moves dispatched through
`MOVE_MAP`. Runtime readiness concerns are therefore limited to the
policy's decision contract.

- [x] Expected runtime touchpoints known — **YES**. T2 is constructed
      in `ai.competent.ts` and invoked by `runSimulation` via the
      existing `AIPolicy.decideTurn` seam. `par.aggregator.ts` orchestrates
      many `runSimulation` calls; no new wiring into `game.ts`,
      `LegendaryGame.moves`, or phase hooks.
- [x] Framework context requirements understood — **YES**. T2 does
      NOT receive `ctx` — only `UIState` + `LegalMove[]` (same
      constraint as `createRandomPolicy`). No `ctx.events.*` calls,
      no `ctx.random.*` calls.
- [x] Mock infrastructure is sufficient — **YES**. T2 tests build
      synthetic `UIState` inputs per `createRandomPolicy`'s test
      precedent; no `makeMockCtx` modification required.
- [x] Runtime wiring allowance (01.5) **NOT INVOKED**. WP-049 does
      not (a) add a `LegendaryGameState` field, (b) change
      `buildInitialGameState`, (c) add a `LegendaryGame.moves` entry,
      or (d) add a phase hook. All four triggers are explicitly
      absent. See `01.5 §Escalation` — the allowance may not be
      cited retroactively; if the executor encounters an
      unanticipated structural break, STOP and escalate.
- [x] No architecture boundary violations expected — **YES**
      (engine category; no boardgame.io/registry/server imports).
- [x] Integration point code has been read — **YES** (`runSimulation`
      signature + `SimulationResult` shape + `computeRawScore`
      signature).
- [x] Simulation is out-of-band tooling — **YES** (confirmed in WP-049
      §Non-Negotiable Constraints).

---

### Maintainability & Upgrade Readiness

- [x] **Extension seam exists:** `AIPolicyTier` union +
      `AI_POLICY_TIERS` canonical array + `AI_POLICY_TIER_DEFINITIONS`
      reference taxonomy — T1/T3/T4 can be added later without
      refactoring T2. `ParAggregationError` is a named class; future
      error categories can subclass or extend the single throwing
      aggregator function.
- [x] **Patch locality:** Each heuristic is a named helper inside
      `ai.competent.ts`; a fix to "threat prioritization" stays inside
      one named function. Aggregation, validation, and tier ordering
      each live in their own pure helper inside `par.aggregator.ts`.
- [x] **Fail-safe behavior:** `aggregateParFromSimulation` is the
      ONLY throwing function in the new surface; everything else
      returns structured results. Unknown tier in `validateTierOrdering`
      returns structured fail, never throws. Policy tie-breaking
      always selects a legal move (input list is pre-validated by
      `getLegalMoves`).
- [x] **Deterministic reconstructability:** `ParSimulationResult`
      carries every input needed to replay the aggregation bit-for-bit
      given the same `(scenario, setupConfig, baseSeed,
      simulationPolicyVersion, scoringConfigVersion, generatedAtOverride)`.
- [x] **Backward-compatible test surface:** No changes to shared test
      helpers. No new `G` fields. Existing 596 tests continue to pass
      unchanged.
- [x] **Semantic naming stability:** `CompetentHeuristic`, `T2`,
      `usedForPar` — no MVP-only adjectives, no `V1` / `Simple` /
      `Immediate` leakage into public names. `simulationPolicyVersion`
      is the version suffix (e.g., `CompetentHeuristic/v1`).

---

### Code Category Boundary Check

- [x] All new/modified files fall cleanly into one existing category:
      `ai.competent.ts`, `par.aggregator.ts`, `ai.tiers.ts` → engine
      (D-3601); `types.ts`, `index.ts` → engine; test files → test.
- [x] Each file's category permits its imports: engine category
      allows `@legendary-arena/game-engine` internals and Node
      built-ins; forbids `boardgame.io`, `@legendary-arena/registry`,
      `apps/**`, `pg`. WP-049 files comply.
- [x] No file blurs category boundaries.
- [x] No new directory created — `src/simulation/` already
      classified.

---

### Scope Lock (Critical)

#### WP-049 Is Allowed To

- Create `packages/game-engine/src/simulation/ai.competent.ts` — T2
  Competent Heuristic policy (pure helper; no boardgame.io imports).
- Create `packages/game-engine/src/simulation/par.aggregator.ts` —
  aggregator + generator + validators + seed helpers +
  `ParAggregationError` class (pure helpers; no boardgame.io imports).
- Create `packages/game-engine/src/simulation/ai.tiers.ts` — tier
  taxonomy + canonical array + drift-detection export.
- Modify `packages/game-engine/src/types.ts` — re-export PAR simulation
  types.
- Modify `packages/game-engine/src/index.ts` — export PAR simulation
  API.
- Create `packages/game-engine/src/simulation/ai.competent.test.ts` —
  10 tests.
- Create `packages/game-engine/src/simulation/par.aggregator.test.ts` —
  17 tests.
- Modify `docs/ai/STATUS.md` — record T2 + PAR pipeline availability.
- Modify `docs/ai/DECISIONS.md` — append new D-entries (PAR decisions).
- Modify `docs/ai/work-packets/WORK_INDEX.md` — check off WP-049
  with today's date.

**This is the full allowlist. Anything not listed is forbidden.**

#### WP-049 Is Explicitly Not Allowed To

- Modify WP-036 contract files (`ai.types.ts`, `ai.random.ts`,
  `ai.legalMoves.ts`, `simulation.runner.ts`) — immutable.
- Modify WP-048 contract files (`parScoring.types.ts`,
  `parScoring.logic.ts`, `parScoring.keys.ts`, `scoring.logic.ts`,
  `scoring.types.ts`) — immutable.
- Modify `game.ts`, any file under `src/moves/`, `src/rules/`,
  `src/setup/`, `src/endgame/`, `src/phases/`, `src/turn/`, `src/economy/`,
  `src/zone*`, `src/ui/**`, `src/replay/**`, `src/invariants/**`.
- Add any new G field or persistence structure.
- Import `boardgame.io` in new files (engine category rule).
- Import `@legendary-arena/registry` (engine category rule); use the
  `CardRegistryReader` local structural interface instead (see PS-2).
- Use `Math.random()`, `Date.now()`, or any other non-seeded
  randomness/clock in policy or aggregator logic. `generatedAt` is
  the single exception — it uses `new Date().toISOString()` ONLY
  when `generatedAtOverride` is not provided, and every
  reproducibility test must inject the override.
- Use `.reduce()` with branching — use `for...of`.
- Use `require()` — ESM only, `.js` extensions on relative imports.
- Expand `CORE_MOVE_NAMES` / `CoreMoveName`.
- Invoke the `01.5 Runtime Wiring Allowance` retroactively.

**Rule:** Anything not explicitly allowed is out of scope.

---

### Test Expectations (Locked Before Execution)

- **New tests:** **27** (10 in `ai.competent.test.ts` + 17 in
  `par.aggregator.test.ts`), per WP-049 §F and §G.
- **New suites:** **+2**. Each test file must wrap its tests in a
  single top-level `describe('...', ...)` so the post-execution
  `node:test` suite count is `110 + 2 = 112` — NOT 110 (bare `test()`
  calls register 0 suites). Precedent: WP-031 P6-54 (test-count-locked
  WPs must specify wrapping intent). Recommended suite titles:
  `describe('T2 Competent Heuristic policy (WP-049)', …)` and
  `describe('PAR aggregator (WP-049)', …)`.
- **Expected new game-engine baseline:** **471 tests / 112 suites**,
  0 fail. All 7 packages' totals: **623 / 125 / 623 / 0**.
- **Existing test changes:** **NONE**. No existing tests require
  value-only updates under `01.5` (and `01.5` is NOT invoked).
- **Prior test baseline:** the full 596/123/596/0 count above must
  continue to pass unchanged.
- **Test boundaries:**
  - No `boardgame.io/testing` imports.
  - No `boardgame.io` imports (any subpath).
  - No `makeMockCtx` modifications; test files build synthetic
    `UIState` directly where needed (follow the
    `ai.random.ts`-adjacent test pattern).
  - No test file may modify `src/simulation/ai.types.ts`,
    `ai.legalMoves.ts`, `simulation.runner.ts`, or any scoring
    contract file.
- **Defensive guards:** none needed — no new G fields.

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

| # | Risk / Ambiguity | Impact | Mitigation | Decision / pattern to follow |
|---|---|---|---|---|
| RS-1 | **`registry: CardRegistry` parameter drift in WP-049 §B line 357.** The engine category forbids importing `CardRegistry` from `@legendary-arena/registry`. WP-036's `runSimulation` uses `CardRegistryReader` (local structural interface). | HIGH | Treat as PS-2 (blocking spec fix). | Replace every `registry: CardRegistry` reference in WP-049 with `registry: CardRegistryReader`. Mirror the change in EC-049 Locked Values if the type literal appears there (none currently). |
| RS-2 | **`ScoringInputs` construction from `SimulationResult` is under-specified.** WP-049 §B Orchestration step 4 says "Build `ScoringInputs`" without naming the helper. `deriveScoringInputs` (WP-048) takes a `ReplayResult`, not a `SimulationResult`. | MEDIUM | `par.aggregator.ts` defines a private helper that maps `SimulationResult` + terminal `G` projection into `ScoringInputs`. WP-048's safe-skip rule applies (zero counts for event types with no engine producer). | Private helper inside `par.aggregator.ts`, with `// why:` comment citing WP-048 D-4801. Do NOT modify `deriveScoringInputs`. |
| RS-3 | **`ParValidationResult` shape unspecified.** WP-049 says "returns a structured issues array" but does not lock the shape. | LOW | Lock as: `interface ParValidationResult { valid: boolean; issues: readonly ParValidationIssue[] }` where `ParValidationIssue = { severity: 'error' \| 'warn'; code: string; message: string }`. Full-sentence messages per code-style Rule 11. | Follow the WP-048 `ScoringConfigValidationResult` precedent (`valid: boolean; errors: readonly string[]`); extend with `severity`/`code` because the multimodality smell-test produces a warn-not-fail outcome. Executor may simplify to `{ valid, errors }` if the warn axis is not needed — document choice in DECISIONS.md. |
| RS-4 | **`TierOrderingResult` shape unspecified.** | LOW | Lock as: `interface TierOrderingResult { passed: boolean; medians: Record<AIPolicyTier, number>; violations: readonly string[] }`. | Executor may collapse to `{ passed, violations }` if per-tier medians are recorded elsewhere — document in DECISIONS.md. |
| RS-5 | **`ParAggregationError` class shape unspecified.** | LOW | Lock as: `class ParAggregationError extends Error { readonly code: 'EMPTY_DISTRIBUTION' \| 'PERCENTILE_OUT_OF_RANGE'; constructor(code, message) }`. | Tests assert `instanceof ParAggregationError` AND `.code`. Prefer a `name = 'ParAggregationError'` override so the error survives `JSON.stringify` readable. |
| RS-6 | **`needsMoreSamples` thresholds unspecified.** | LOW | Lock as deterministic module-level constants: `IQR_THRESHOLD = 2000` centesimal units; `STDEV_THRESHOLD = 1500` centesimal units. Trigger if `IQR > IQR_THRESHOLD OR stddev > STDEV_THRESHOLD`. | Executor MAY pick different numbers with a `// why:` comment + DECISIONS.md entry. The rule locked here is: constants are module-level, deterministic, and not a config input. |
| RS-7 | **Multimodality smell-test shape.** | LOW | 20-bin fixed-width histogram over `[min, max]`; flag when ≥2 peaks each ≥20% of max bin count AND peaks separated by ≥2 bins. | Per EC-049 Locked Values line 39 — already locked. Pre-flight confirms. |
| RS-8 | **Grep pattern escape in Verification Steps.** WP-049 §Verification Steps uses `Select-String … -Pattern "boardgame.io"`. The `.` is a regex wildcard (P6-50 precedent). Docs/JSDoc text mentioning `boardgame.io` would trip the gate. | LOW | Recommend the import-line-specific pattern: `-Pattern "from [''\"]boardgame\.io"`. Not a blocker — executor may rephrase comments to satisfy the broad pattern, but that weakens docs. | Executor may tighten the WP's grep to the import-specific variant in the execution commit and log in DECISIONS.md, or leave as-is and avoid the phrase "boardgame.io" in comments. This is executor-discretion, not blocking. |
| RS-9 | **`SimulationResult` vs `ScoringInputs` field mapping for penalty events.** `SimulationResult` exposes `escapedVillainsAverage` and `woundsAverage` (averages), but `ScoringInputs.penaltyEventCounts.villainEscaped` is an integer per-run count. | MEDIUM | `par.aggregator.ts` must run `runSimulation` with `games: 1` per seed (not `games: N`) so each call produces a single-game `SimulationResult` representing one run. Alternatively, iterate the seed list externally. The session context says option #3: "For each seed: Create T2 policy … Run one simulation via `runSimulation`". | Lock: one call to `runSimulation` per seed, `games: 1`. The aggregator iterates over seeds, not over games-per-seed. `// why:` comment cites D-3604 tie-break isolation (each seed has its own policy PRNG). |
| RS-10 | **Terminal `G` not exposed by `SimulationResult`.** `SimulationResult` returns aggregate averages; it does not return the terminal `LegendaryGameState`. `computeRawScore` needs per-run counts (bystandersRescued, escapes, rounds, VP). | HIGH | `par.aggregator.ts` cannot call `runSimulation` as-is; it needs per-game `G` + turn count + VP. Two options: (a) add a new exported helper `runSingleSimulationWithState(config, registry): { result, finalState, turnCount }` inside `simulation/` — **but this modifies WP-036 surface**; (b) replicate `simulateOneGame`-like orchestration inside `par.aggregator.ts` using imported engine primitives (`buildInitialGameState`, `buildUIState`, `filterUIStateForAudience`, `getLegalMoves`, `computeFinalScores`, `evaluateEndgame`, move imports). | **Lock option (b).** Replication is the WP-036 precedent pattern (D-2705 static MOVE_MAP). The aggregator is a second consumer of the same engine primitives; replicating the per-game loop is correct layer discipline. Alternatively, if replication would balloon scope, escalate to the human before execution and treat as a scope amendment with a new PS entry. Do NOT extend WP-036 surface silently. |
| RS-11 | **Provenance-copy "verbatim" semantics.** `simulationPolicyVersion` and `scoringConfigVersion` must pass a deep-equality check, not a reference check, when they are primitives. `generatedAtOverride` must round-trip identically. | LOW | Tests use `assert.strictEqual` for string/number provenance fields; `assert.deepStrictEqual` for whole-result comparison in test #15. `generatedAt = generatedAtOverride ?? new Date().toISOString()` — the coalescing expression is locked; no post-processing (no trimming, no canonicalization). | Locked. |
| RS-12 | **Hero pool neutrality.** WP-049 says hero pool is neutral / non-optimized for simulation but does not spell out how that's constructed. | LOW | Inherited from `setupConfig.heroDeckIds` — the caller provides the hero list; the aggregator does not modify it. T2 never counter-picks. | Locked: `generateScenarioPar` consumes `setupConfig.heroDeckIds` verbatim. If the caller passes an optimized pool, the PAR value reflects that pool; scenario publication workflow (WP-050/WP-051) is responsible for passing a neutral pool. |

**Locking rule:** every RS entry above is locked for execution. The
session prompt and execution session must not re-interpret them.

---

### Mutation Boundary Confirmation

**Skipped** — WP-049 does not add new move functions. The existing
move functions (dispatched via `MOVE_MAP` inside `runSimulation` or,
under RS-10 option (b), replicated inside `par.aggregator.ts`) are
the only `G` mutators. Their mutation contract was validated by
WP-036 pre-flight and remains unchanged.

---

### Pre-Flight Verdict (Binary)

**READY TO EXECUTE** — conditional on the two pre-session actions
below being resolved before the session execution prompt is generated.

WP-049 is properly sequenced (WP-036 + WP-048 both complete and
untouched since close); contracts are verified against HEAD; the
scope is locked to 7 code files + 3 doc files; the test baseline is
re-measured (596/123/596/0) and the expected delta is +27 tests /
+2 suites → 623/125/623/0; architectural boundaries are explicit
(engine category; no boardgame.io / registry / server imports; no
`G` field additions; no move registration; 01.5 not invoked); the
maintainability checks all pass (extension seam, patch locality,
fail-safe, deterministic reconstruction, backward-compatible tests,
stable naming); and every material risk is resolved and locked in
the RS table.

#### Pre-Session Actions (blocking)

**PS-1: Commit the uncommitted SPEC edits under a SPEC: prefix
before generating the session execution prompt.** Currently
uncommitted:
- `docs/ai/work-packets/WP-049-par-simulation-engine.md`
- `docs/ai/execution-checklists/EC-049-par-simulation-engine.checklist.md`
- `docs/ai/work-packets/WP-050-par-artifact-storage.md`

Plus the session-context bridge:
- `docs/ai/session-context/session-context-wp049.md` (untracked).

Also commit this pre-flight + copilot check document under the same
SPEC commit. Do NOT bundle these into the WP-049 execution commit —
the execution commit must have only the 7 code files + 3 governance
docs per EC-049.

**PS-2: Fix `registry: CardRegistry` → `registry: CardRegistryReader`
in WP-049.** Specifically line 357 of
`docs/ai/work-packets/WP-049-par-simulation-engine.md`:

> - `generateScenarioPar(config: ParSimulationConfig, registry: CardRegistry): ParSimulationResult`

must become:

> - `generateScenarioPar(config: ParSimulationConfig, registry: CardRegistryReader): ParSimulationResult`

`CardRegistryReader` is imported from `../matchSetup.validate.js`
(already the WP-036 convention). No EC-049 edit required (the EC
does not name the parameter type). If the WP text has any additional
`CardRegistry` mentions, fix them all. Add a `// why:` note:
`// why: CardRegistryReader is the engine-category local structural
interface for registry access; importing CardRegistry from
@legendary-arena/registry is forbidden by D-3601.`

Both actions are scope-neutral — they do not change the allowlist,
do not change the locked test count, and do not introduce a new
architectural concern. No re-run of pre-flight is required once
applied.

---

### Invocation Prompt Conformance Check

Applies when the session prompt is generated (Step 2). The prompt
must:

- [ ] Copy every EC-049 locked value verbatim.
- [ ] List the 10-file allowlist exactly (7 code + 3 docs).
- [ ] Cite the 596/123 → 623/125 test baseline lock.
- [ ] Explicitly declare `01.5 Runtime Wiring Allowance NOT INVOKED`
      with the 4 criteria enumerated.
- [ ] Cite each RS entry from this pre-flight.
- [ ] Cite D-0701, D-0702, D-3604, D-3601, D-2801, D-2704, D-4801.
- [ ] Require the executor to wrap each test file in one top-level
      `describe()` so the suite count lands at 112.
- [ ] Explicitly prohibit modification of WP-036 and WP-048 contract
      files.

No new scope may be introduced by the prompt.

---

### Authorized Next Step

**Pre-session actions — REQUIRED (2026-04-23):**

1. **PS-1:** Commit uncommitted SPEC edits (`WP-049`, `EC-049`,
   `WP-050`, `session-context-wp049`, plus this pre-flight doc)
   under `SPEC:` prefix, separate from the WP-049 execution commit.
2. **PS-2:** In `WP-049` replace `registry: CardRegistry` with
   `registry: CardRegistryReader` and add the `// why:` note cited
   above. Amend the same SPEC commit (or add a second SPEC commit).

After PS-1 and PS-2 are resolved, no re-run of pre-flight is required —
both actions are scope-neutral governance/text fixes.

> You are then authorized to generate a **session execution prompt**
> for WP-049 to be saved as:
> `docs/ai/invocations/session-wp049-par-simulation-engine.md`

**Guard:** The session prompt **must conform exactly** to the scope,
constraints, and RS decisions locked by this pre-flight. No new scope
may be introduced.

---

## Copilot Check

**Date:** 2026-04-23
**Pre-flight verdict under review:** READY TO EXECUTE (2026-04-23,
conditional on PS-1 + PS-2)
**Inputs reviewed:**
- EC: `docs/ai/execution-checklists/EC-049-par-simulation-engine.checklist.md`
- WP: `docs/ai/work-packets/WP-049-par-simulation-engine.md`
- Pre-flight: this document, sections above

### Overall Judgment

**RISK** — HOLD pending PS-1 + PS-2.

The pre-flight verdict stands in substance: WP-049 is sequenced,
scoped, contracts are verified, risks are resolved. The copilot scan
surfaces **two locking-semantics gaps** that are already captured as
PS actions (contract-drift on `CardRegistry` vs `CardRegistryReader`;
uncommitted spec files) and three minor tightening recommendations
(typed `ParAggregationError.code`, `ParValidationResult` shape,
suite-wrapping discipline). None of the findings would cause
architectural or determinism damage — they are scope-neutral fixes
that can be applied in-place and the check re-run or rolled into the
existing PS actions. No `BLOCK` class issue is present.

### Findings

Grouped by the 30-issue lens. Only non-clean-PASS issues listed;
every other issue scanned and marked PASS.

#### 1. Separation of Concerns & Boundaries

1. **#1 Engine vs UI boundary — PASS.** WP-049 §Non-Negotiable
   Constraints locks "simulation is out-of-band tooling"; engine
   category rules apply. T2 reads only the audience-filtered
   `UIState` projection; no engine or UI leakage.
2. **#9 UI re-implements engine logic — PASS.** N/A — no UI code in
   this WP.
3. **#16 Lifecycle wiring creep — RISK.**
   FIX: Pre-flight already locks "01.5 NOT INVOKED" with the 4
   triggers enumerated. Ensure the session prompt restates this
   verbatim and includes the WP-028 lifecycle-prohibition language:
   "Functions introduced by WP-049 MUST NOT be called from `game.ts`,
   any move, any phase hook, any `onBegin`/`onEnd`, or any file
   under `src/moves/`, `src/rules/`, `src/phases/`, `src/turn/`,
   `src/setup/`. They are consumed by test files and future
   WP-050/WP-051 artifact writers only."
4. **#29 Assumptions leaking across layers — PASS.** T2 reads
   filtered `UIState`, never `G` or `ctx`. D-3602 cited in WP.

#### 2. Determinism & Reproducibility

5. **#2 Non-determinism — RISK.**
   FIX: WP-049 correctly bans `Math.random()` and requires seeded
   RNG, but `generatedAt = new Date().toISOString()` when
   `generatedAtOverride` is absent is the one non-determinism
   source. The pre-flight RS-11 lock + WP-049 §Acceptance Criteria
   already document this. Add to the session prompt an explicit
   statement: "Every reproducibility test in `par.aggregator.test.ts`
   MUST inject `generatedAtOverride`; a test that omits it is a
   failing test." This prevents a future maintainer from writing a
   flaky test.
6. **#8 Single debugging truth artifact — PASS.**
   `ParSimulationResult` + `seedSetHash` + provenance fields are
   the canonical reconstruction artifact.
7. **#23 Deterministic ordering — RISK.**
   FIX: `aggregateParFromSimulation` sorts `rawScores` ascending —
   a stable sort is required for reproducibility when scores tie.
   `Array.prototype.sort` is stable in V8 (Node 22) but the spec
   historically was not. Add to the session prompt: "Use
   `Array.prototype.sort((left, right) => left - right)` — a stable
   numeric comparator. `// why:` comment cite Node 22 stable-sort
   guarantee." No new dependency required.

#### 3. Immutability & Mutation Discipline

8. **#3 Pure vs Immer confusion — PASS.** No new moves; no Immer
   drafts touched.
9. **#17 Hidden mutation via aliasing — RISK.**
   FIX: `ParSimulationResult.rawScoreDistribution` is a nested
   object. Spread-copy each numeric field (they are primitives, so
   this is automatic) but ensure the function does NOT return a
   reference to an internally-held distribution scratch object.
   Follow the WP-028 D-2801 aliasing precedent: construct a fresh
   object literal in the `return { ... }` statement. Post-mortem
   must verify.

#### 4. Type Safety & Contract Integrity

10. **#4 Contract drift — RISK.**
    FIX: This is the PS-2 finding — `registry: CardRegistry` vs
    `CardRegistryReader`. Already captured. No additional action
    required beyond PS-2.
11. **#5 Optional field ambiguity — PASS.**
    `generatedAtOverride?: string` follows the
    `exactOptionalPropertyTypes` pattern — conditional construction
    is not required because the WP spells out the coalescing
    expression explicitly.
12. **#6 Merge semantics — PASS.** No merge logic in WP-049.
13. **#10 Stringly-typed outcomes — RISK.**
    FIX: `ParAggregationError` should carry a typed `code` field —
    union `'EMPTY_DISTRIBUTION' | 'PERCENTILE_OUT_OF_RANGE'` — not
    a free-form string. See pre-flight RS-5. Reading a stringly-typed
    error at the call site breaks discriminated-union exhaustion
    checks. Lock the union in the session prompt.
14. **#21 Type widening — PASS.** `CardExtId` not used directly by
    WP-049 (it consumes `ScoringInputs` values). `AIPolicyTier` is
    a narrow union.
15. **#27 Weak canonical naming — PASS.** Field names match
    `00.2-data-requirements.md`. No abbreviations.

#### 5. Persistence & Serialization

16. **#7 Persisting runtime state — PASS.** WP-049 returns data
    only; WP-050 owns persistence.
17. **#19 JSON-serializability — RISK.**
    FIX: Add a test in `par.aggregator.test.ts` asserting
    `JSON.parse(JSON.stringify(result))` is `deepStrictEqual` to
    the original `ParSimulationResult`. WP-048 precedent (D-4806)
    already established this pattern for scoring types. Adjust
    locked test count from 17 → 18 if this test is accepted, OR
    absorb the roundtrip assertion into existing test #15
    (byte-identical reproducibility) since that test already
    compares whole results — preferred to preserve the 17-test
    lock.
18. **#24 Mixed persistence — PASS.** `ParSimulationResult` is
    data; no snapshot/config blur.

#### 6. Testing & Invariant Enforcement

19. **#11 Tests validate invariants — RISK.**
    FIX: Test #17 ("losses included, no filtering") is a behavioral
    assertion; strengthen it to an **invariant** by asserting that
    `rawScores.length === config.simulationCount` BEFORE percentile
    aggregation (i.e., no seed is silently dropped). Add a sentence
    to WP-049 test #17: "AND the pre-aggregation rawScores array
    length equals `simulationCount`." This prevents future
    refactors from filtering losses by accident.

#### 7. Scope & Execution Governance

20. **#12 Scope creep — PASS.** 10-file allowlist; PS-1 commit
    discipline ensures SPEC edits don't bleed into execution
    commit; verification step `git diff --name-only` enforces.
21. **#13 Unclassified directories — PASS.** `src/simulation/` is
    D-3601. No new dir.
22. **#30 Missing pre-session fixes — PASS.** PS-1 and PS-2
    explicitly captured; Authorized Next Step gates session-prompt
    generation on their resolution.

#### 8. Extensibility & Future-Proofing

23. **#14 Extension seams — PASS.** `AIPolicyTier` + canonical
    array + `AI_POLICY_TIER_DEFINITIONS` allow T1/T3/T4 without
    refactor.
24. **#28 Upgrade/deprecation story — PASS.**
    `simulationPolicyVersion` string (`CompetentHeuristic/v1`)
    supports future `/v2` without breaking old artifacts. WP-050
    wraps both.

#### 9. Documentation & Intent Clarity

25. **#15 Missing `// why:` — RISK.**
    FIX: Every heuristic in `ai.competent.ts` requires a `// why:`
    comment (EC-049 §Required `// why:` Comments already mandates
    this). Enforce in the session prompt with grep: "Every
    top-level function in `ai.competent.ts` MUST have a `// why:`
    comment. Pre-commit review greps for this." Also add `// why:`
    for: (a) mulberry32 / djb2 reuse (duplicated from `ai.random.ts`
    per WP-036 scope discipline); (b) sort comparator choice;
    (c) `IQR_THRESHOLD` / `STDEV_THRESHOLD` constants.
26. **#20 Ambiguous authority chain — PASS.** Pre-flight cites
    authority chain explicitly.
27. **#26 Implicit content semantics — PASS.** Nearest-rank
    percentile is spelled out with formula + example; no
    "convention-based meaning."

#### 10. Error Handling & Failure Semantics

28. **#18 Outcome evaluation timing — PASS.** PAR is derived
    end-of-match only via `computeRawScore`; D-4804 (end-of-match
    only) applies.
29. **#22 Silent vs loud failure — RISK.**
    FIX: WP-049 correctly splits throwing (`ParAggregationError`)
    from structured return (`ParValidationResult`,
    `TierOrderingResult`). Session prompt must restate this as a
    per-function table so the executor does not accidentally make
    `validateParResult` throw. Add: "`aggregateParFromSimulation`
    THROWS; `validateParResult` NEVER THROWS; `validateTierOrdering`
    NEVER THROWS; policy `decideTurn` NEVER THROWS; full-sentence
    error messages per code-style Rule 11."

#### 11. Single Responsibility & Logic Clarity

30. **#25 Overloaded function responsibilities — PASS.** Each of
    `aggregateParFromSimulation`, `generateScenarioPar`,
    `validateParResult`, `validateTierOrdering`, `generateSeedSet`,
    `computeSeedSetHash` has a single responsibility. T2 policy
    heuristics are each their own named helper.

### Mandatory Governance Follow-ups

- **DECISIONS.md entry (added by WP-049 execution commit):** record
  T2 as sole PAR authority; 55th-percentile choice; nearest-rank
  method; neutral hero pool; minimum N=500; loss treatment;
  pre-release gate; seed-set canonicalization; immutable Raw Score
  surface. (Already mandated by WP-049 Definition of Done.)
- **DECISIONS.md entry — optional:** if the executor elects a
  stricter `ParValidationResult` shape (with severity axis) than
  WP-048's `ScoringConfigValidationResult`, add an entry justifying
  the divergence.
- **02-CODE-CATEGORIES.md update:** no change required — D-3601
  already covers `src/simulation/`.
- **.claude/rules/*.md update:** no change required.
- **WORK_INDEX.md update:** check off WP-049 with today's date in
  the execution commit.

### Pre-Flight Verdict Disposition

- [ ] CONFIRM — stands as-is.
- [x] **HOLD** — apply the listed FIXes in-place, re-run copilot
      check.
- [ ] SUSPEND — pre-flight re-run required.

**Rationale for HOLD (not CONFIRM):** The pre-flight verdict is
correct in substance and the scope is unchanged. The FIXes are
scope-neutral text tightenings:
- PS-1 (commit uncommitted SPEC files) — already captured in
  pre-flight Authorized Next Step.
- PS-2 (`CardRegistry` → `CardRegistryReader`) — already captured.
- Copilot-only FIXes — all should be absorbed into the session
  execution prompt (Step 2), not into the WP/EC text itself, except
  the test #17 invariant clarification and the `ParAggregationError.code`
  union, which are small EC-049 additions. Re-run copilot check
  once these are applied; no pre-flight re-run required because
  scope (file allowlist, test count, wiring decision, category
  taxonomy) is unchanged.

**Rationale for not SUSPEND:** No FIX changes the allowlist, the
locked test count (17 aggregator + 10 policy tests), the wiring
decision (01.5 not invoked), the category taxonomy (engine via
D-3601), or a drift-pinned canonical array. PS-2 is a type-literal
rename that does not alter a contract shape — `CardRegistryReader`
was ALREADY what `runSimulation` consumed; WP-049's text was the
only place the wrong literal appeared.

### Next Step After HOLD

1. Apply PS-1 (commit SPEC files) and PS-2 (fix `CardRegistry`
   literal).
2. Absorb copilot FIXes #3, #5, #7, #9, #13, #17, #19, #25, #29
   into the session execution prompt body.
3. Optionally append to EC-049 §Locked Values (scope-neutral):
   - Lock `ParAggregationError.code` union
     (`'EMPTY_DISTRIBUTION' | 'PERCENTILE_OUT_OF_RANGE'`).
   - Clarify test #17: "AND the pre-aggregation rawScores array
     length equals `simulationCount`."
4. Re-run this copilot check (same session, no pre-flight re-run).
5. Generate `docs/ai/invocations/session-wp049-par-simulation-engine.md`.

---
