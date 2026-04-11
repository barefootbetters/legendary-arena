# WP-048 — PAR Scenario Scoring & Leaderboards

**Status:** Draft
**Primary Layer:** Game Engine (Scoring) + Server (Leaderboard Storage)
**Dependencies:** WP-020, WP-027, WP-030

---

## Session Context

WP-020 established `computeFinalScores` — a pure function that computes per-player
VP breakdowns from `G`. WP-027 established the replay verification harness with
`ReplayInput`, `replayGame`, and `verifyDeterminism`. WP-030 established
`ScenarioDefinition` and `CampaignDefinition` as data-only structures external to
the engine. This packet extends VP scoring into **PAR-based scenario scoring** —
a composite, scenario-aware model that normalizes player performance against a
fixed PAR baseline per scenario. It also defines the **leaderboard submission
contract** for replay-verified competitive entries. This packet does NOT modify
VP scoring (WP-020), replay infrastructure (WP-027), or scenario definitions
(WP-030). It builds on top of all three.

---

## Goal

Introduce deterministic PAR-based scoring and a leaderboard submission contract.
After this session:

- `ScenarioKey` and `TeamKey` are canonical, stable identity strings
- `ScenarioScoringConfig` defines per-scenario weights, caps, PAR baseline, and
  penalty event mappings — versioned and explicit
- `deriveScoringInputs(replay)` extracts R, VP, BP, E from a replay log
- `computeRawScore(inputs, config)` produces a weighted composite score
- `computeFinalScore(rawScore, config)` normalizes against PAR
- `ScoreBreakdown` provides full transparency of all components
- `LeaderboardEntry` defines the server-side record for replay-verified submissions
- Scoring is fully deterministic: same replay + same config version = same score
- Anti-exploit controls prevent stall/farm/grind dominance

---

## Assumes

- WP-020 complete. Specifically:
  - `computeFinalScores(G): FinalScoreSummary` exists and returns per-player VP
  - `PlayerScoreBreakdown` and `FinalScoreSummary` are exported types
  - VP constants (`VP_VILLAIN`, `VP_HENCHMAN`, etc.) are named exports
- WP-027 complete. Specifically:
  - `ReplayInput` canonical contract exists (seed + setupConfig + playerOrder + moves)
  - `replayGame(input): ReplayResult` exists and is pure
  - `computeStateHash(G)` exists with canonical serialization
  - `verifyDeterminism` runs replay twice and compares hashes
- WP-030 complete. Specifically:
  - `ScenarioDefinition` exists as a data-only, JSON-serializable type
  - Scenario identity is derivable from scheme + mastermind + villain groups
- `docs/12-SCORING-REFERENCE.md` exists (reference formula — this packet
  implements the engine contract for that reference model)
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/12-SCORING-REFERENCE.md` — read the full reference model. This packet
  implements the Raw Score formula, PAR definition, and leaderboard display
  contracts described there. The reference model is authoritative for the
  scoring philosophy; this packet is authoritative for the engine contract.
- `docs/ai/ARCHITECTURE.md §Section 2` — read "Zone & Pile Structure" and
  "Card Data Flow". Scoring inputs are derived from the replay log and final
  game state, not from UI state or client counters.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — scoring
  computation is game-engine layer. Leaderboard storage is server layer. The
  engine produces `ScoreBreakdown`; the server persists `LeaderboardEntry`.
  The engine must NOT import server or persistence code.
- `docs/ai/ARCHITECTURE.md — "Persistence Boundaries"` — `ScenarioScoringConfig`
  is Class 2 (Configuration) — safe to persist. `ScoreBreakdown` is Class 3
  (Snapshot) — safe to persist as an immutable record. Neither is `G`.
- `packages/game-engine/src/scoring/scoring.types.ts` — read existing VP scoring
  types. PAR scoring extends these; it does not replace them.
- `packages/game-engine/src/replay/replay.types.ts` — read `ReplayInput` and
  `ReplayResult`. PAR scoring derives inputs from replay output.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations),
  Rule 6 (`// why:` on weight defaults and monotonicity invariants), Rule 8
  (no `.reduce()` for score accumulation with branching), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — scoring involves no randomness
- Never throw inside scoring functions — return structured results
- `G` must not be mutated by scoring — all scoring functions are read-only
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in game-engine scoring files
- Full file contents for every new or modified file — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Determinism is non-negotiable:** same replay + same `scoringConfigVersion` =
  same `FinalScore`, always. No floating-point rounding variance — use integer
  arithmetic or fixed-precision (multiply by 100, score in centesimal units)
- **Monotonicity invariant:** Higher R and penalty events always increase
  RawScore (worse). Higher BP and VP always decrease RawScore (better). No
  weight combination may violate this — enforce via validation on
  `ScenarioScoringConfig`.
- **Structural invariants (bystander moral hierarchy):** Every scenario config
  must satisfy: (1) `bystanderReward > villainEscapedWeight`, (2)
  `bystanderLostWeight > villainEscapedWeight`, (3)
  `bystanderLostWeight > bystanderReward`. Config validation must enforce all
  three. See `docs/12-SCORING-REFERENCE.md` for rationale.
- **Scoring is replay-derivable:** every scoring input (R, VP, BP, E) must be
  extractable from the replay log + final game state. If a required event is
  not logged, STOP — add the missing log event first.
- **No magic numbers:** all weights, caps, and PAR values are explicit data in
  `ScenarioScoringConfig` — never hard-coded in scoring logic.
- **No per-player or per-hero modifiers:** scoring is scenario-aware, not
  player-aware or hero-aware.
- **No RNG normalization:** luck is not factored out after the fact.
- **Layer boundary:** scoring computation (engine) must not import server,
  persistence, or UI code. `LeaderboardEntry` type is defined in engine for
  the contract, but instantiation and storage are server-only.
- WP-020 contract files must NOT be modified — PAR scoring extends VP scoring.
- WP-027 contract files must NOT be modified — PAR scoring consumes replay output.
- No `.reduce()` for score accumulation with branching — use `for...of`
- Tests use `makeMockCtx` or plain mocks — no `boardgame.io` imports

**Locked contract values:**

- **Scoring formula (canonical):**

  ```
  RawScore = (R × W_R) + P - (BP × W_BP) - (VP × W_VP)
  P = sum(eventCount[type] × penaltyWeight[type])
  FinalScore = RawScore - PAR
  ```

  Lower is always better. Negative = under PAR. Zero = at PAR.
  Penalty events have **per-event weights** — there is no shared escape
  multiplier. Each event type contributes directly to Raw Score.

- **Component weights (reference — scenarios may override):**

  | Weight | Default | Direction |
  |--------|---------|-----------|
  | W_R    | +100    | Round cost (higher R = worse) |
  | W_BP   | +300    | Bystander rescue reward (higher BP = better) |
  | W_VP   | +50     | VP reward (higher VP = better) |

- **Penalty event weights (per-event, reference defaults):**

  | Event Type               | Default | Meaning |
  |--------------------------|---------|---------|
  | `villainEscaped`          | +200    | Loss of tactical control |
  | `bystanderLost`           | +500    | Heroic failure — civilian casualty |
  | `schemeTwistNegative`     | +400    | Scheme pressure resolving against players |
  | `mastermindTacticUntaken`  | +100    | Missed opportunity — incomplete victory |
  | `scenarioSpecificPenalty`  | scenario-defined | Scenario-unique failure event |

  Note: all weights are centesimal integers to avoid floating-point determinism
  issues. A weight of `+100` means 1.00 points. Display divides by 100.

- **Structural invariants (must hold for every scenario config):**
  1. `W_BP > villainEscapedWeight` — rescue bonus exceeds villain escape penalty
  2. `bystanderLostWeight > villainEscapedWeight` — losing civilians > losing villains
  3. `bystanderLostWeight > W_BP` — bystander loss penalty exceeds rescue bonus

  These prevent future rebalancing from eroding the moral hierarchy. Config
  validation must enforce all three.

- **ScenarioKey format:** `{schemeSlug}::{mastermindSlug}::{sorted-villainGroupSlugs-joined-by-+}`
  Example: `midtown-bank-robbery::red-skull::hydra+masters-of-evil`

- **TeamKey format:** `{sorted-heroSlugs-joined-by-+}`
  Example: `captain-america+iron-man+spider-man+wolverine`

- **Penalty event types (canonical list):**
  - `villainEscaped`
  - `bystanderLost`
  - `schemeTwistNegative`
  - `mastermindTacticUntaken`
  - `scenarioSpecificPenalty`

- **Tiebreaker order (when FinalScores are equal):**
  1. Fewer rounds (lower R)
  2. Fewer total penalty events
  3. Earlier completion timestamp

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

---

## Scope (In)

### A) `src/scoring/parScoring.types.ts` — new

- `ScenarioKey = string` (branded type alias — computed, not arbitrary)
- `TeamKey = string` (branded type alias — computed, not arbitrary)
- `buildScenarioKey(schemeSlug, mastermindSlug, villainGroupSlugs[]): ScenarioKey`
  — sorts villain slugs, joins with `+`, concatenates with `::` separator
- `buildTeamKey(heroSlugs[]): TeamKey` — sorts slugs, joins with `+`
- `interface ScoringWeights { roundCost: number; bystanderReward: number; victoryPointReward: number }` — all integers (centesimal); no shared escape multiplier — penalty events have per-event weights via `PenaltyEventWeights`
  - `// why:` comment: integer weights avoid floating-point determinism issues;
    display divides by 100
- `interface ScoringCaps { bystanderCap: number | null; victoryPointCap: number | null }` — `null` means no cap
- `type PenaltyEventType = 'villainEscaped' | 'bystanderLost' | 'schemeTwistNegative' | 'mastermindTacticUntaken' | 'scenarioSpecificPenalty'`
- `PENALTY_EVENT_TYPES: readonly PenaltyEventType[]` — canonical array with
  drift-detection test
- `interface PenaltyEventWeights` — `Record<PenaltyEventType, number>` mapping each
  event type to its integer weight contribution to E
- `interface ParBaseline { roundsPar: number; bystandersPar: number; victoryPointsPar: number; escapesPar: number }`
- `interface ScenarioScoringConfig { scenarioKey: ScenarioKey; weights: ScoringWeights; caps: ScoringCaps; penaltyEventWeights: PenaltyEventWeights; parBaseline: ParBaseline; scoringConfigVersion: number; createdAt: string; updatedAt: string }`
  - `// why:` comment: `scoringConfigVersion` is an integer that increments on
    any weight, cap, or PAR change — leaderboard entries pin to this version
- `interface ScoringInputs { rounds: number; victoryPoints: number; bystandersRescued: number; escapes: number; penaltyEventCounts: Record<PenaltyEventType, number> }`
- `interface ScoreBreakdown { inputs: ScoringInputs; weightedRoundCost: number; weightedPenaltyTotal: number; penaltyBreakdown: Record<PenaltyEventType, number>; weightedBystanderReward: number; weightedVictoryPointReward: number; rawScore: number; parScore: number; finalScore: number; scoringConfigVersion: number }`
- `interface LeaderboardEntry { scenarioKey: ScenarioKey; teamKey: TeamKey; playerIdentifiers: string[]; scoreBreakdown: ScoreBreakdown; replayHash: string; createdAt: string; scoringConfigVersion: number }`

### B) `src/scoring/parScoring.logic.ts` — new

- `deriveScoringInputs(replayResult: ReplayResult, gameLog: GameMessage[]): ScoringInputs`
  — pure function that extracts R, VP, BP, E from replay output and game log
  - Rounds: count from turn progression events in game log
  - VP: from `computeFinalScores(replayResult.finalState)` — reuses WP-020
  - BP: count bystander rescue events in game log
  - E: count penalty events by type in game log using `PENALTY_EVENT_TYPES`
  - Uses `for...of` over game log entries — no `.reduce()` with branching
  - `// why:` comment on each derivation source

- `computeRawScore(inputs: ScoringInputs, config: ScenarioScoringConfig): number`
  — pure function implementing the locked formula:
  `RawScore = (R × roundCost) + P - (BP × bystanderReward) - (VP × vpReward)`
  where `P = sum(eventCount[type] × penaltyWeight[type])`
  - Applies caps if configured: `effectiveBP = Math.min(inputs.bystandersRescued, config.caps.bystanderCap ?? Infinity)`
  - Applies caps if configured: `effectiveVP = Math.min(inputs.victoryPoints, config.caps.victoryPointCap ?? Infinity)`
  - No shared escape multiplier — each penalty event type weighted individually
  - All arithmetic is integer — no floating-point
  - `// why:` comment on monotonicity invariant

- `computeParScore(config: ScenarioScoringConfig): number`
  — pure function computing PAR using the same formula with PAR baseline inputs
  - Uses identical arithmetic path as `computeRawScore` to ensure consistency

- `computeFinalScore(rawScore: number, parScore: number): number`
  — `rawScore - parScore` — trivial but explicit for contract clarity

- `buildScoreBreakdown(inputs: ScoringInputs, config: ScenarioScoringConfig): ScoreBreakdown`
  — orchestrates the above into a full breakdown object

- `validateScoringConfig(config: ScenarioScoringConfig): ScoringConfigValidationResult`
  — validates:
    - All component weights positive (monotonicity)
    - All penalty event weights positive
    - Structural invariants:
      1. `bystanderReward > villainEscapedWeight`
      2. `bystanderLostWeight > villainEscapedWeight`
      3. `bystanderLostWeight > bystanderReward`
    - Caps non-negative when set
    - PAR baseline non-negative
    - Version > 0
  - Returns structured result, never throws

- Pure helper, no boardgame.io import, no server import

### C) `src/scoring/parScoring.keys.ts` — new

- `buildScenarioKey(schemeSlug: string, mastermindSlug: string, villainGroupSlugs: string[]): ScenarioKey`
  — sorts villain slugs alphabetically, joins with `+`, format:
  `{scheme}::{mastermind}::{v1+v2+v3}`
  - `// why:` comment: sorting ensures stable keys regardless of input order

- `buildTeamKey(heroSlugs: string[]): TeamKey`
  — sorts hero slugs alphabetically, joins with `+`

- Pure helper, no boardgame.io import

### D) `src/scoring/scoring.types.ts` — modified (minimal)

- Re-export `FinalScoreSummary` and `PlayerScoreBreakdown` (already exported)
- No structural changes — PAR scoring types live in `parScoring.types.ts`

### E) `src/types.ts` — modified

- Re-export PAR scoring types: `ScenarioKey`, `TeamKey`, `ScenarioScoringConfig`,
  `ScoringInputs`, `ScoreBreakdown`, `LeaderboardEntry`, `ScoringWeights`,
  `ScoringCaps`, `ParBaseline`, `PenaltyEventType`

### F) `src/index.ts` — modified

- Export PAR scoring functions: `deriveScoringInputs`, `computeRawScore`,
  `computeParScore`, `computeFinalScore`, `buildScoreBreakdown`,
  `validateScoringConfig`, `buildScenarioKey`, `buildTeamKey`
- Export PAR scoring types and constants: `PENALTY_EVENT_TYPES`

### G) Tests — `src/scoring/parScoring.logic.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Fourteen tests:
  1. `computeRawScore` with default weights matches hand-calculated value
  2. `computeRawScore` monotonicity: extra round increases score
  3. `computeRawScore` monotonicity: extra villain escape increases score
  4. `computeRawScore` monotonicity: extra bystander lost increases score more than villain escape
  5. `computeRawScore` monotonicity: extra bystander rescued decreases score
  6. `computeRawScore` monotonicity: extra VP decreases score
  7. `computeRawScore` respects bystander cap
  8. `computeRawScore` heroic play beats conservative play (Player A vs Player B scenario)
  9. `computeFinalScore` produces correct PAR-relative result
  10. `validateScoringConfig` rejects config with zero or negative weights
  11. `validateScoringConfig` rejects config violating structural invariant 1 (bystanderReward <= villainEscaped)
  12. `validateScoringConfig` rejects config violating structural invariant 3 (bystanderLost <= bystanderReward)
  13. `PENALTY_EVENT_TYPES` array matches `PenaltyEventType` union (drift detection)
  14. Determinism: same inputs + same config = identical `ScoreBreakdown`

### H) Tests — `src/scoring/parScoring.keys.test.ts` — new

- Uses `node:test` and `node:assert` only
- Four tests:
  1. `buildScenarioKey` with unsorted villain slugs produces sorted result
  2. `buildScenarioKey` with single villain group
  3. `buildTeamKey` with unsorted hero slugs produces sorted result
  4. Key stability: same inputs always produce same output

---

## Out of Scope

- **No PAR value derivation** — PAR values per scenario are set via
  `ScenarioScoringConfig`. The content-driven PAR derivation methodology
  (Vision goal 26, `docs/12-SCORING-REFERENCE.md`) will be implemented in a
  separate future WP that adds difficulty ratings to the content registry and
  computes PAR from them. This packet consumes PAR as input — it does not
  compute it.
- **No server endpoint implementation** — this packet defines the
  `LeaderboardEntry` contract. Server submission and storage are future work.
- **No leaderboard query or display** — this packet defines what is stored,
  not how it is queried or rendered.
- **No tournament scoring** — multi-scenario aggregate scoring is future work.
- **No difficulty tiers** — PAR variants by player count are future work.
- **No card-text VP modifiers** — card-specific VP bonuses remain WP-022+.
- **No UI changes** — scoring produces data, not display.
- **No modification of WP-020 or WP-027 contracts.**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `packages/game-engine/src/scoring/parScoring.types.ts` — **new** —
  ScenarioKey, TeamKey, ScenarioScoringConfig, ScoringInputs, ScoreBreakdown,
  LeaderboardEntry, PenaltyEventType, PENALTY_EVENT_TYPES
- `packages/game-engine/src/scoring/parScoring.logic.ts` — **new** —
  deriveScoringInputs, computeRawScore, computeParScore, computeFinalScore,
  buildScoreBreakdown, validateScoringConfig
- `packages/game-engine/src/scoring/parScoring.keys.ts` — **new** —
  buildScenarioKey, buildTeamKey
- `packages/game-engine/src/scoring/scoring.types.ts` — **modified** —
  minimal re-export additions only
- `packages/game-engine/src/types.ts` — **modified** — re-export PAR types
- `packages/game-engine/src/index.ts` — **modified** — export PAR scoring API
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — **new** —
  14 scoring tests
- `packages/game-engine/src/scoring/parScoring.keys.test.ts` — **new** —
  4 key tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Identity Keys
- [ ] `buildScenarioKey` produces stable, sorted keys
- [ ] `buildTeamKey` produces stable, sorted keys
- [ ] Key format matches locked contract values exactly

### Scoring Computation
- [ ] `computeRawScore` implements the locked formula exactly
- [ ] All arithmetic is integer (centesimal) — no floating-point
- [ ] Monotonicity invariant holds: higher R/E = worse, higher BP/VP = better
- [ ] Caps are applied when configured, ignored when `null`
- [ ] `computeParScore` uses identical arithmetic path as `computeRawScore`
- [ ] `computeFinalScore` = `rawScore - parScore`
- [ ] `buildScoreBreakdown` produces complete, deterministic output
- [ ] Same inputs + same config version = identical `ScoreBreakdown` (determinism)

### Configuration Validation
- [ ] `validateScoringConfig` rejects zero or negative component weights
- [ ] `validateScoringConfig` rejects zero or negative penalty event weights
- [ ] `validateScoringConfig` rejects negative caps
- [ ] `validateScoringConfig` rejects version <= 0
- [ ] `validateScoringConfig` rejects configs violating structural invariants:
      bystanderReward > villainEscaped, bystanderLost > villainEscaped,
      bystanderLost > bystanderReward
- [ ] Returns structured result, never throws

### Replay Integration
- [ ] `deriveScoringInputs` extracts R, VP, BP, E from replay output
- [ ] VP extraction reuses `computeFinalScores` from WP-020
- [ ] All inputs derivable from game log events — no UI state, no client counters

### Drift Detection
- [ ] `PENALTY_EVENT_TYPES` array matches `PenaltyEventType` union
- [ ] Drift-detection test asserts this

### Anti-Exploit
- [ ] Bystander cap applied when configured
- [ ] VP cap applied when configured
- [ ] W_R > 0 enforced by config validation (round cost is non-trivial)
- [ ] All penalty event weights > 0 enforced by config validation
- [ ] Structural invariants enforced — conservative play cannot outscore heroic play

### Pure Helper
- [ ] `parScoring.logic.ts` has no boardgame.io import
      (confirmed with `Select-String`)
- [ ] `parScoring.keys.ts` has no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `.reduce()` with branching logic in scoring
      (confirmed with `Select-String`)
- [ ] No registry import in scoring
      (confirmed with `Select-String`)
- [ ] No server import in scoring
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] All 14 scoring tests pass
- [ ] All 4 key tests pass
- [ ] All test files use `.test.ts`; no boardgame.io import

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] WP-020 contract files (`scoring.types.ts`, `scoring.logic.ts`) not
      structurally modified — re-exports only

---

## Verification Steps

```pwsh
# Step 1 — build after adding PAR scoring
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in PAR scoring
Select-String -Path "packages\game-engine\src\scoring\parScoring.logic.ts" -Pattern "boardgame.io"
Select-String -Path "packages\game-engine\src\scoring\parScoring.keys.ts" -Pattern "boardgame.io"
Select-String -Path "packages\game-engine\src\scoring\parScoring.types.ts" -Pattern "boardgame.io"
# Expected: no output for any

# Step 4 — confirm no server or registry import in PAR scoring
Select-String -Path "packages\game-engine\src\scoring" -Pattern "@legendary-arena/registry|apps/server" -Recurse
# Expected: no output

# Step 5 — confirm no .reduce() with branching in PAR scoring
Select-String -Path "packages\game-engine\src\scoring\parScoring.logic.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 6 — confirm integer arithmetic (no parseFloat, no toFixed in scoring logic)
Select-String -Path "packages\game-engine\src\scoring\parScoring.logic.ts" -Pattern "parseFloat|toFixed|Number\("
# Expected: no output

# Step 7 — confirm no require()
Select-String -Path "packages\game-engine\src\scoring" -Pattern "require(" -Recurse
# Expected: no output

# Step 8 — confirm WP-020 contracts not structurally modified
git diff packages/game-engine/src/scoring/scoring.types.ts
git diff packages/game-engine/src/scoring/scoring.logic.ts
# Expected: only re-export additions, no structural changes

# Step 9 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No boardgame.io import in PAR scoring files
      (confirmed with `Select-String`)
- [ ] No registry or server import in PAR scoring files
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in PAR scoring files (confirmed with `Select-String`)
- [ ] No floating-point arithmetic in scoring logic
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] WP-020 and WP-027 contract files not structurally modified
- [ ] `docs/ai/STATUS.md` updated — PAR scoring infrastructure exists
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why integer arithmetic for
      weights; why default weight values; why bystander moral hierarchy; why
      per-event penalty weights instead of shared multiplier; why ScenarioKey
      uses `::` separator; why LeaderboardEntry type lives in engine but
      storage is server-only
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-048 checked off with today's date
