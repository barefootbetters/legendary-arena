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
- `parScoring.logic.ts` computeRawScore: monotonicity invariant and per-event penalty explanation
- `parScoring.logic.ts` deriveScoringInputs: each derivation source documented
- `parScoring.keys.ts` buildScenarioKey: sorting ensures stable keys regardless of input order

## Files to Produce
- `src/scoring/parScoring.types.ts` — **new** — all PAR types, constants, interfaces
- `src/scoring/parScoring.logic.ts` — **new** — scoring computation + config validation
- `src/scoring/parScoring.keys.ts` — **new** — ScenarioKey and TeamKey builders
- `src/scoring/scoring.types.ts` — **modified** — re-exports only
- `src/types.ts` — **modified** — re-export PAR types
- `src/index.ts` — **modified** — export PAR scoring API
- `src/scoring/parScoring.logic.test.ts` — **new** — 14 tests (incl. moral hierarchy + invariant validation)
- `src/scoring/parScoring.keys.test.ts` — **new** — 4 tests

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No boardgame.io/registry/server imports in parScoring files (Select-String)
- [ ] No `.reduce()` in parScoring files (Select-String)
- [ ] No floating-point arithmetic in scoring logic (Select-String for parseFloat/toFixed)
- [ ] WP-020 and WP-027 contracts not structurally modified (git diff)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated (integer arithmetic, default weights, bystander moral hierarchy, per-event penalties, key format, LeaderboardEntry layer split)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date

## Common Failure Smells
- Floating-point in tests (e.g., `=== 1.5`) usually means weights are not centesimal integers
- Re-implementing VP counting instead of calling `computeFinalScores` — reuse WP-020
- `parScoring.logic.ts` importing `boardgame.io` — must be pure helper
- ScenarioKey with unsorted villain slugs — key instability bug
- Single shared W_E multiplier instead of per-event penalty weights — wrong formula
- Conservative play outscoring heroic play in tests — structural invariant violation
