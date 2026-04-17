# EC-048 — PAR Scenario Scoring & Leaderboards (Execution Checklist)

**Source:** docs/ai/work-packets/WP-048-par-scenario-scoring-leaderboards.md
**Layer:** Game Engine (Scoring) + Server (Leaderboard Contract)

## Before Starting
- [ ] WP-020 complete — `computeFinalScores`, `FinalScoreSummary`, VP constants exist
- [ ] WP-027 complete — `ReplayInput`, `replayGame`, `computeStateHash` exist
- [ ] WP-030 complete — `ScenarioDefinition` exists
- [ ] `docs/12-SCORING-REFERENCE.md` read — reference formula and structural invariants understood
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

## Locked Values (do not re-derive)
- Formula: `RawScore = (R × W_R) + P - (BP × W_BP) - (VP × W_VP)` where `P = sum(eventCount[type] × penaltyWeight[type])`
- Formula: `FinalScore = RawScore - PAR`
- Lower is always better (negative = under PAR)
- Component weights (centesimal integers): W_R=+100, W_BP=+300, W_VP=+50
- Penalty event weights (centesimal): villainEscaped=+200, bystanderLost=+500, schemeTwistNegative=+400
- Structural invariants: (1) W_BP > villainEscaped, (2) bystanderLost > villainEscaped, (3) bystanderLost > W_BP
- ScenarioKey: `{scheme}::{mastermind}::{sorted-villains-joined-by-+}`
- TeamKey: `{sorted-heroes-joined-by-+}`
- PenaltyEventTypes: `villainEscaped`, `bystanderLost`, `schemeTwistNegative`, `mastermindTacticUntaken`, `scenarioSpecificPenalty`
- Tiebreakers: fewer rounds, then fewer total penalty events, then earlier timestamp
- **`deriveScoringInputs` signature (D-4801):**
  `deriveScoringInputs(replayResult: ReplayResult, gameState: LegendaryGameState): ScoringInputs` — NO `gameLog` / `GameMessage[]` parameter.
  Derivation sources:
  - `rounds` = `replayResult.moveCount`
  - `victoryPoints` = `sum(computeFinalScores(gameState).players[*].totalVP)` (team-aggregate, D-4803)
  - `bystandersRescued` = count of `gameState.playerZones[*].victory` entries where `gameState.villainDeckCardTypes[id] === 'bystander'`
  - `escapes` = `gameState.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0`
  - `penaltyEventCounts.villainEscaped` = `escapes`
  - `penaltyEventCounts.bystanderLost` = `0` (safe-skip, D-4801)
  - `penaltyEventCounts.schemeTwistNegative` = `0` (safe-skip, D-4801)
  - `penaltyEventCounts.mastermindTacticUntaken` = `0` (safe-skip, D-4801)
  - `penaltyEventCounts.scenarioSpecificPenalty` = `0` (safe-skip, D-4801)
- **`ScoringConfigValidationResult` shape:** `{ readonly valid: boolean; readonly errors: readonly string[] }` — `errors` are full-sentence strings.
- **Self-contained config (D-4805):** every `ScenarioScoringConfig` carries a full set of fields; no runtime merge with defaults.
- **End-of-match only (D-4804):** `deriveScoringInputs` is only called when the replayed state is terminal.

## Guardrails
- All arithmetic is integer (centesimal) — no floating-point in scoring logic
- Per-event penalty weights — no shared escape multiplier (W_E removed)
- Structural invariants enforced by `validateScoringConfig` — conservative play cannot outscore heroic play
- No boardgame.io imports in parScoring files (pure helpers)
- No registry or server imports in parScoring files
- No `.reduce()` with branching — use `for...of`
- VP extraction reuses `computeFinalScores` from WP-020 — do not reimplement
- WP-020 and WP-027 contract files must not be structurally modified
- `LeaderboardEntry` type defined in engine; instantiation/storage is server-only

## Required `// why:` Comments
- `parScoring.types.ts` ScoringWeights: integer weights avoid floating-point determinism issues
- `parScoring.types.ts` scoringConfigVersion: version pins leaderboard entries to specific config
- `parScoring.types.ts` PenaltyEventWeights: per-event weights encode moral hierarchy — bystander loss > villain escape
- `parScoring.types.ts` ScoringConfigValidationResult: full-sentence error messages match code-style Rule 11 and make config-authoring failures self-describing
- `parScoring.logic.ts` computeRawScore: monotonicity invariant and per-event penalty explanation
- `parScoring.logic.ts` deriveScoringInputs (rounds): MVP uses `replayResult.moveCount` as a round proxy; per-turn counting deferred to a follow-up WP (D-4801)
- `parScoring.logic.ts` deriveScoringInputs (VP): reuses WP-020 `computeFinalScores`; summed across players per D-4803 team-aggregate rule
- `parScoring.logic.ts` deriveScoringInputs (bystanders): victory pile is the canonical rescue marker — matches EC-068 / WP-067 aggregation approach
- `parScoring.logic.ts` deriveScoringInputs (escapes): `?? 0` — counter is lazily initialised; absence is semantically zero
- `parScoring.logic.ts` deriveScoringInputs — each safe-skipped penalty type (`bystanderLost`, `schemeTwistNegative`, `mastermindTacticUntaken`, `scenarioSpecificPenalty`): "no engine producer today; follow-up WP will introduce <producer path>. D-4801 safe-skip."
- `parScoring.logic.ts` buildScoreBreakdown: result must not alias caller-provided `ScoringInputs` — spread-copy `inputs` and `penaltyEventCounts` before storing (D-2801 aliasing precedent)
- `parScoring.logic.ts` validateScoringConfig: error messages are full sentences naming the invariant violated (code-style Rule 11)
- `parScoring.keys.ts` buildScenarioKey: sorting ensures stable keys regardless of input order

## Files to Produce
- `src/scoring/parScoring.types.ts` — **new** — all PAR types, constants, interfaces
- `src/scoring/parScoring.logic.ts` — **new** — scoring computation + config validation
- `src/scoring/parScoring.keys.ts` — **new** — ScenarioKey and TeamKey builders
- `src/scoring/scoring.types.ts` — **modified** — re-exports only
- `src/types.ts` — **modified** — re-export PAR types
- `src/index.ts` — **modified** — export PAR scoring API
- `src/scoring/parScoring.logic.test.ts` — **new** — 16 tests (moral hierarchy + invariant validation + self-contained-config + JSON-roundtrip + aliasing)
- `src/scoring/parScoring.keys.test.ts` — **new** — 4 tests

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — baseline was 376 passing, 96 suites; new total is 392 passing, 98 suites (+16 new scoring tests in 1 new describe block + 4 new key tests in 1 new describe block)
- [ ] `pnpm -r test` exits 0 — repo-wide was 409; new total is 425
- [ ] No boardgame.io/registry/server imports in parScoring files (Select-String -SimpleMatch)
- [ ] No `.reduce()` in parScoring files (Select-String -SimpleMatch)
- [ ] No floating-point arithmetic in scoring logic (Select-String -SimpleMatch for parseFloat/toFixed)
- [ ] WP-020 and WP-027 contracts not structurally modified (git diff)
- [ ] `packages/game-engine/src/types.ts` `LegendaryGameState` shape unchanged (D-4802)
- [ ] `packages/game-engine/src/setup/buildInitialGameState.ts` signature unchanged (D-4802)
- [ ] Test 14 aliasing assertion passes (D-2801)
- [ ] Test 15 self-contained-config rejection passes (D-4805)
- [ ] Test 16 JSON-roundtrip passes for `ScoreBreakdown` and `LeaderboardEntry` (D-4806)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` contains the six new PAR-scoring entries (D-4801 through D-4806) — added during the pre-flight amendment 2026-04-17, confirm they survived the execution commit
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date

## Common Failure Smells
- Floating-point in tests (e.g., `=== 1.5`) usually means weights are not centesimal integers
- Re-implementing VP counting instead of calling `computeFinalScores` — reuse WP-020
- `parScoring.logic.ts` importing `boardgame.io` — must be pure helper
- ScenarioKey with unsorted villain slugs — key instability bug
- Single shared W_E multiplier instead of per-event penalty weights — wrong formula
- Conservative play outscoring heroic play in tests — structural invariant violation
- Importing or declaring a `GameMessage` type anywhere — forbidden by D-4801; derivation reads `G` directly
- Adding `activeScoringConfig` to `LegendaryGameState` — forbidden by D-4802 in this WP; deferred to WP-067
- Non-villainEscaped penalty counts returning anything other than `0` — forbidden until a future WP introduces the producer (D-4801 safe-skip)
- `buildScoreBreakdown` returning `{ inputs }` directly (aliased) — must construct a new object with spread-copied `penaltyEventCounts` (D-2801)
- Adding a `Date`, `Map`, or `Set` field to `ScoreBreakdown` or `LeaderboardEntry` — breaks D-4806 JSON-roundtrip invariant
- Accepting a `ScenarioScoringConfig` with a missing `penaltyEventWeights[type]` entry — violates D-4805 self-contained rule; Test 15 catches this
