# WP-049 — PAR Simulation Engine

**Status:** Draft
**Primary Layer:** Tooling / Simulation (Out-of-Band)
**Dependencies:** WP-036, WP-048

---

## Session Context

WP-036 established the AI simulation framework — `AIPolicy` interface,
`RandomPolicy` baseline, `getLegalMoves`, and `runSimulation`. WP-048
established the PAR scoring contract — `ScenarioScoringConfig`,
`computeRawScore`, `buildScoreBreakdown`, and the `ScenarioKey` identity
system. This packet connects the two: a **Competent Heuristic AI policy (T2)**
that models experienced human play, and a **PAR aggregation pipeline** that
runs T2 simulations and produces calibrated, versioned PAR values per scenario.

This packet does NOT modify the game engine, the scoring formula, or the
simulation framework. It builds on top of all three.

Simulation is **calibration tooling**, not gameplay logic (D-0701).

---

## Goal

Introduce the T2 Competent Heuristic AI policy and PAR aggregation pipeline.
After this session:

- `CompetentHeuristicPolicy` implements `AIPolicy` with behavioral heuristics
  modeling experienced, rules-faithful human play
- `aggregateParFromSimulation` computes PAR from the 55th percentile of
  simulated Raw Score distributions
- `generateScenarioPar` orchestrates: run simulation -> compute Raw Scores ->
  aggregate to PAR -> produce versioned `ScenarioScoringConfig`
- AI policy tiers are documented (T0-T4) with T2 as the sole PAR authority
- PAR values can be generated for any valid scenario without human intervention
- All simulation runs are deterministic, replayable, and versioned

---

## Assumes

- WP-036 complete. Specifically:
  - `AIPolicy` interface exists with `name` and `decideTurn(UIState, LegalMove[]): ClientTurnIntent`
  - `createRandomPolicy(seed)` exists (T0 baseline)
  - `getLegalMoves(G, ctx)` exists and returns valid moves
  - `runSimulation(config, registry)` exists and returns `SimulationResult`
  - `SimulationConfig` and `SimulationResult` are exported types
- WP-048 complete. Specifically:
  - `ScenarioScoringConfig`, `ScoringInputs`, `ScoreBreakdown` exist
  - `computeRawScore(inputs, config)` exists and is pure
  - `buildScenarioKey(scheme, mastermind, villains)` exists
  - `PenaltyEventType` union and `PENALTY_EVENT_TYPES` array exist
  - `validateScoringConfig` exists and enforces structural invariants
- `docs/12-SCORING-REFERENCE.md` exists with three-phase PAR derivation
  pipeline (content seed, simulation calibration, post-release refinement)
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/12-SCORING-REFERENCE.md — "PAR Derivation"` — read the full three-phase
  pipeline. This packet implements Phase 2 (Simulation Calibration). Phase 1
  (content-driven seed) provides the fallback when simulation hasn't run.
  Phase 3 (post-release refinement) is out of scope for this packet.
- `docs/12-SCORING-REFERENCE.md — "Two-Layer Scoring Architecture"` — PAR is
  Layer A (scenario difficulty). It is scenario-only, never hero-dependent.
  Hero selection for simulation uses a neutral, non-optimized pool.
- `docs/ai/DECISIONS.md` — read D-0701 (AI Is Tooling, Not Gameplay) and
  D-0702 (Balance Changes Require Simulation).
- `packages/game-engine/src/simulation/ai.types.ts` — read `AIPolicy`,
  `LegalMove`, `SimulationConfig`, `SimulationResult`. The T2 policy must
  conform to the `AIPolicy` interface exactly.
- `packages/game-engine/src/scoring/parScoring.types.ts` — read
  `ScenarioScoringConfig`, `ScoringInputs`. PAR aggregation produces a
  config that feeds the scoring engine.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations),
  Rule 6 (`// why:` on T2 behavioral heuristics and percentile selection),
  Rule 8 (no `.reduce()`), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- All AI randomness uses seeded RNG — never `Math.random()`
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in simulation files
- Full file contents for every new or modified file — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Simulation is out-of-band tooling** — never runs during live gameplay,
  never modifies engine logic, never stored in `G`
- **T2 is the sole PAR authority** — only the Competent Heuristic policy may
  be used to compute PAR values. Other tiers are for validation and testing.
- **PAR is scenario-only** — hero selection for simulation is neutral and
  non-optimized. No attempt to counter-pick the scenario.
- **Determinism** — same seed + same scenario config = same simulation output,
  same PAR value
- **Scoring formula is invariant** — Raw Scores are computed using the same
  `computeRawScore` function as live games. No simulation-specific scoring.
- **AI cannot inspect hidden state** — T2 receives filtered `UIState`, same
  as human players (D-0701)
- WP-036 contract files must NOT be modified — T2 implements `AIPolicy`
- WP-048 contract files must NOT be modified — PAR aggregation consumes
  scoring types
- No `.reduce()` for accumulation with branching — use `for...of`
- Tests use `makeMockCtx` or plain mocks — no `boardgame.io` imports

**Locked contract values:**

- **AI Policy Tiers (reference taxonomy):**

  | Tier | Name                | Purpose                     | Used for PAR |
  |-----:|---------------------|-----------------------------|--------------|
  |   T0 | Random Legal        | Sanity / smoke tests        | No           |
  |   T1 | Naive               | Regression baseline         | No           |
  |   T2 | Competent Heuristic | **Primary PAR calibration** | **Yes**      |
  |   T3 | Strong Heuristic    | Upper-bound validation      | Validation only |
  |   T4 | Near-Optimal        | Research only               | No           |

  Only T2 may define PAR. T0 exists in WP-036 as `RandomPolicy`. T1, T3, T4
  are future work.

- **T2 Behavioral Heuristics (must implement all five):**
  1. Threat prioritization — prefer villains with bystanders, prevent escapes
  2. Heroism bias — accept controlled inefficiency to save civilians
  3. Economy awareness — avoid stalling, avoid VP farming, recruit for quality
  4. Limited deck awareness — track coarse deck state, no exact card counting
  5. Local optimization only — consider current and next turn, no deep planning

- **T2 Explicit Prohibitions:**
  - Must not sacrifice civilians for long-term optimization
  - Must not engineer intentional losses for score advantage
  - Must not use hidden information
  - Must not adapt behavior based on "knowing it is a simulation"

- **PAR Percentile:** 55th percentile of simulated Raw Scores (default)
  - Configurable range: 50th-60th percentile
  - Do not use the mean

- **Minimum Sample Size:** N >= 500 simulated games per scenario
  - Recommended: N = 1000-2000 for high-variance scenarios

- **Loss treatment:** Losses (scheme victory, villain deck exhaustion) are
  included in the Raw Score distribution. A loss produces a high Raw Score
  (many penalties, few rescues). This naturally penalizes scenarios where
  competent play frequently loses.

- **Pre-release PAR gate:** New content sets must have PAR generated for all
  official scenario configurations before competitive leaderboard entries are
  accepted. PAR is available to players before they choose heroes.

- **Tier ordering validation:** Before publishing PAR, validate that T3
  outperforms T2 outperforms T1 outperforms T0 across sufficient runs. If
  ordering is violated, investigate before publishing.

- **Immutable surface:** Raw Score semantics (event taxonomy, sign conventions,
  component definitions) are a protected trust surface. Any change requires
  explicit major-version treatment per growth governance (WP-040).

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

---

## Scope (In)

### A) `src/simulation/ai.competent.ts` — new

- `createCompetentHeuristicPolicy(seed: string): AIPolicy`
  — T2 policy implementing all five behavioral heuristics:

  1. **Threat prioritization:**
     - Scan city for villains with attached bystanders — fight these first
     - If a villain is about to escape (city full), prioritize preventing escape
     - Respond to scheme twist pressure (escalating negative events)
     - `// why:` comment: mirrors experienced player behavior — bystanders and
       escapes are the most impactful scoring events

  2. **Heroism bias:**
     - When choosing between fighting a villain (no bystander) and fighting a
       villain (with bystander), prefer the bystander rescue even if the other
       villain is "easier"
     - Accept a controlled villain escape if the alternative is losing a
       bystander
     - `// why:` comment: reflects the moral hierarchy in the scoring model —
       rescue > containment > loss

  3. **Economy awareness:**
     - Recruit heroes that improve average turn quality (prefer higher
       attack/recruit values when available)
     - Do not stall — if the player can fight effectively, fight
     - Do not recruit when fighting is clearly better for score
     - `// why:` comment: avoids VP farming and round stalling exploits

  4. **Limited deck awareness:**
     - Track whether the game is early (deck mostly starting cards), mid
       (mixed), or late (mostly recruited heroes)
     - Adjust aggression: more cautious early, more aggressive late
     - No exact card counting, no draw prediction
     - `// why:` comment: models human memory limitations — experienced players
       know their deck composition roughly, not exactly

  5. **Local optimization:**
     - Evaluate current board state and choose the best available action
     - Consider "what happens if I don't act this turn" (escape risk)
     - No multi-turn lookahead, no game tree search
     - `// why:` comment: models human decision-making — competent but not
       computer-aided

  - Uses seeded RNG for any tie-breaking or randomized decisions
  - Deterministic: same seed + same state = same decision
  - Pure function, no boardgame.io import

### B) `src/simulation/par.aggregator.ts` — new

- `interface ParSimulationConfig { scenarioKey: ScenarioKey; setupConfig: MatchSetupConfig; playerCount: number; simulationCount: number; baseSeed: string; percentile: number; scoringConfig: ScenarioScoringConfig }`

- `generateSeedSet(baseSeed: string, count: number): string[]`
  — deterministic, order-stable seed list derived from a single base seed
  - Same baseSeed + same count = same seed list, always
  - `// why:` comment: canonical seed sets make PAR reproducibility auditable;
    seedSetHash in the result proves which seeds were used

- `computeSeedSetHash(seeds: string[]): string`
  — canonical hash of the seed list for provenance tracking

- `interface ParSimulationResult { scenarioKey: ScenarioKey; parValue: number; percentileUsed: number; sampleSize: number; seedSetHash: string; rawScoreDistribution: { min: number; p25: number; median: number; p55: number; p75: number; max: number; standardDeviation: number; interquartileRange: number }; needsMoreSamples: boolean; seedParDelta: number; simulationPolicyVersion: string; scoringConfigVersion: number; generatedAt: string }`
  - `seedSetHash` — canonical hash of the seed list used for this PAR computation
  - `interquartileRange` — p75 - p25, used for variance assessment
  - `needsMoreSamples` — true when variance exceeds a configurable threshold,
    signaling the pre-release gate should require more runs before publishing

- `aggregateParFromSimulation(rawScores: number[], percentile: number): number`
  — pure function that computes the Nth percentile of a sorted array of Raw Scores
  - Validates: array non-empty, percentile in [0, 100]
  - Returns centesimal integer
  - `// why:` comment: percentile is robust to outliers; 55th is slightly
    conservative (beatable but fair)

- `generateScenarioPar(config: ParSimulationConfig, registry: CardRegistry): ParSimulationResult`
  — orchestrates the full PAR generation pipeline:
  1. Generate canonical seed set via `generateSeedSet(config.baseSeed, config.simulationCount)`
  2. Compute `seedSetHash` via `computeSeedSetHash`
  3. Create T2 policy for each seed; run N simulations via `runSimulation` (WP-036)
  4. Compute Raw Score for each game via `computeRawScore` (WP-048)
     — losses included as first-class outcomes (no filtering)
  5. Aggregate to PAR via `aggregateParFromSimulation`
  6. Compute distribution statistics (including IQR and `needsMoreSamples` flag)
  7. Compute delta vs content-driven seed PAR
  8. Return versioned `ParSimulationResult` with `seedSetHash`
  - Uses `for...of` over simulation results — no `.reduce()` with branching
  - `// why:` comment: PAR is determined before players choose heroes;
    simulation uses neutral hero pool, not counter-picks

- `validateParResult(result: ParSimulationResult): ParValidationResult`
  — sanity checks:
  - Sample size >= 500
  - Raw Score distribution is unimodal (no exploit spikes — flag multimodal
    distributions or extreme outliers as potential degenerate loops)
  - PAR is within plausible range for the scenario's difficulty ratings
  - Returns structured result, never throws

- `validateTierOrdering(t0Result, t1Result, t2Result, t3Result): TierOrderingResult`
  — behavioral plausibility check across tiers:
  - T3 median Raw Score < T2 median (T3 outperforms T2)
  - T2 median Raw Score < T1 median (T2 outperforms T1)
  - T1 median Raw Score < T0 median (T1 outperforms T0)
  - Returns structured pass/fail with per-tier medians
  - `// why:` comment: if tier ordering is violated, either the heuristics
    are wrong or the scenario has a degenerate property — investigate before
    publishing PAR

### C) `src/simulation/ai.tiers.ts` — new

- `type AIPolicyTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4'`
- `AI_POLICY_TIERS: readonly AIPolicyTier[]` — canonical array with
  drift-detection test
- `interface AIPolicyTierDefinition { tier: AIPolicyTier; name: string; purpose: string; usedForPar: boolean }`
- `AI_POLICY_TIER_DEFINITIONS: readonly AIPolicyTierDefinition[]` — reference
  taxonomy documenting all five tiers
- `// why:` comment: only T2 may define PAR; other tiers exist for validation,
  testing, and research

### D) `src/types.ts` — modified

- Re-export PAR simulation types: `ParSimulationConfig`, `ParSimulationResult`,
  `AIPolicyTier`, `AI_POLICY_TIERS`

### E) `src/index.ts` — modified

- Export: `createCompetentHeuristicPolicy`, `aggregateParFromSimulation`,
  `generateScenarioPar`, `validateParResult`, `validateTierOrdering`,
  `generateSeedSet`, `computeSeedSetHash`,
  `AI_POLICY_TIERS`, `AI_POLICY_TIER_DEFINITIONS`

### F) Tests — `src/simulation/ai.competent.test.ts` — new

- Uses `node:test` and `node:assert` only; no boardgame.io import
- Ten tests:
  1. T2 policy implements `AIPolicy` interface (has `name` and `decideTurn`)
  2. Same seed + same state = same decision (determinism)
  3. Different seed = different tie-breaking decisions
  4. Prefers fighting villain with bystander over villain without (heroism bias)
  5. Prefers preventing imminent escape over recruiting (threat prioritization)
  6. Does not stall when fighting is available (economy awareness)
  7. AI does not access hidden state (receives filtered UIState only)
  8. T2 produces valid `ClientTurnIntent` for all legal move types
  9. T2 never produces an illegal move
  10. T2 policy `name` is `'CompetentHeuristic'`

### G) Tests — `src/simulation/par.aggregator.test.ts` — new

- Uses `node:test` and `node:assert` only
- Sixteen tests:
  1. `aggregateParFromSimulation` with 1000 scores returns 55th percentile
  2. Percentile of sorted identical scores returns that score
  3. Empty array rejects with validation error
  4. Percentile outside [0, 100] rejects with validation error
  5. `validateParResult` accepts valid result with N >= 500
  6. `validateParResult` rejects result with N < 500
  7. `validateParResult` passes unimodal distribution cleanly
  8. `validateParResult` flags bimodal distribution (two clusters) as suspicious
  9. `validateTierOrdering` passes when T3 < T2 < T1 < T0 (medians, N >= 50 per tier)
  10. `validateTierOrdering` fails when ordering is violated
  11. `AI_POLICY_TIERS` array matches `AIPolicyTier` union (drift detection)
  12. Only T2 has `usedForPar: true` in tier definitions
  13. `generateSeedSet` same baseSeed + same count = same seeds (determinism)
  14. `computeSeedSetHash` same seeds = same hash
  15. `generateScenarioPar` run twice with identical config = identical PAR + metadata
  16. Loss runs included in distribution — mixed win/loss list produces correct
      percentile without filtering losses

---

## Out of Scope

- **No T1, T3, or T4 policy implementations** — T0 exists in WP-036; T2 is
  this packet; others are future work
- **No engine modifications** — simulation is external tooling
- **No scoring formula changes** — Raw Score computation is invariant
- **No post-release refinement pipeline** — Phase 3 calibration is future work
- **No persistence of PAR results** — results are returned as data; storage
  and the "no leaderboard without PAR" enforcement gate are server-layer
  concerns per architecture layer boundaries
- **No UI for simulation or PAR management**
- **No hero optimization in simulation** — PAR is scenario-only
- **No WP-036 or WP-048 contract modifications**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**

---

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`. This WP
> implements Phase 2 of the PAR derivation pipeline — directly bears on
> every Skill Measurement clause.

**Vision clauses touched:** §3, §22, §23, §25, §26

**Conflict assertion:** No conflict. T2 Competent Heuristic AI policy
with five behavioral heuristics models experienced human play — never
perfect play (preserves "PAR is beatable" per §20). 55th-percentile
aggregation across ≥500 simulated games per scenario implements §26
Phase 2 verbatim. PAR is scenario-only — never adapted to hero
selection (§26).

**Non-Goal proximity:** Confirmed clear of NG-1, NG-7. PAR derivation
is transparent and version-controlled; no paid tier can alter PAR. The
content-driven seed (§26 Phase 1) gives day-one coverage without
monetization gating.

**Determinism preservation:** STRONG. Two-domain PRNG (D-3604) — run-level
shuffle and policy-level decision PRNGs never share state. Reproducible
from seed + setup. AI uses the same pipeline as humans (D-0701, D-3602)
— no special engine access. Setup is the sole configuration input
(D-1244); invalid setups are rejected, never corrected.

---

## Files Expected to Change

- `packages/game-engine/src/simulation/ai.competent.ts` — **new** —
  createCompetentHeuristicPolicy (T2)
- `packages/game-engine/src/simulation/par.aggregator.ts` — **new** —
  aggregateParFromSimulation, generateScenarioPar, validateParResult,
  validateTierOrdering, generateSeedSet, computeSeedSetHash
- `packages/game-engine/src/simulation/ai.tiers.ts` — **new** —
  AIPolicyTier, AI_POLICY_TIERS, AI_POLICY_TIER_DEFINITIONS
- `packages/game-engine/src/types.ts` — **modified** — re-export PAR
  simulation types
- `packages/game-engine/src/index.ts` — **modified** — export PAR simulation API
- `packages/game-engine/src/simulation/ai.competent.test.ts` — **new** —
  10 tests
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — **new** —
  16 tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### T2 Policy
- [ ] `createCompetentHeuristicPolicy` returns valid `AIPolicy`
- [ ] Implements all five behavioral heuristics
- [ ] Deterministic: same seed + same state = same decision
- [ ] AI receives filtered `UIState` — no direct G access
- [ ] Prefers bystander rescue over non-bystander villain fights
- [ ] Does not stall when fighting is available
- [ ] Never produces an illegal move

### PAR Aggregation
- [ ] `aggregateParFromSimulation` computes correct percentile
- [ ] Default percentile is 55
- [ ] Returns centesimal integer
- [ ] `generateScenarioPar` runs simulation and produces `ParSimulationResult`
- [ ] Result includes distribution statistics, IQR, seedSetHash, and seed PAR delta
- [ ] Result includes `needsMoreSamples` flag based on variance threshold
- [ ] `validateParResult` enforces N >= 500 minimum
- [ ] `validateParResult` passes unimodal distributions cleanly
- [ ] `validateParResult` flags bimodal/multimodal distributions as suspicious
- [ ] Losses included in distribution as first-class outcomes (no filtering)

### Seed Set Canonicalization
- [ ] `generateSeedSet` is deterministic: same baseSeed + same count = same seeds
- [ ] `computeSeedSetHash` is deterministic: same seeds = same hash
- [ ] `seedSetHash` is stored in `ParSimulationResult`

### PAR Reproducibility
- [ ] `generateScenarioPar` run twice with identical config produces identical
      PAR value, distribution stats, and metadata

### Tier Ordering Validation
- [ ] `validateTierOrdering` confirms T3 < T2 < T1 < T0 (median Raw Scores)
- [ ] Tier ordering tests use minimum N >= 50 per tier
- [ ] Fails when ordering is violated

### Policy Tiers
- [ ] `AI_POLICY_TIERS` matches `AIPolicyTier` union (drift detection)
- [ ] Only T2 has `usedForPar: true`

### Engine Isolation
- [ ] No engine gameplay files modified (confirmed with `Select-String`)
- [ ] No WP-036 contract files modified (confirmed with `git diff`)
- [ ] No WP-048 contract files modified (confirmed with `git diff`)
- [ ] No boardgame.io imports in new files (confirmed with `Select-String`)
- [ ] No `Math.random()` in new files (confirmed with `Select-String`)
- [ ] No `.reduce()` with branching (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] All 10 T2 policy tests pass
- [ ] All 16 aggregator tests pass
- [ ] All test files use `.test.ts`; no boardgame.io import

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all tests passing, 0 failing

# Step 3 — no boardgame.io import in new simulation files
Select-String -Path "packages\game-engine\src\simulation\ai.competent.ts" -Pattern "boardgame.io"
Select-String -Path "packages\game-engine\src\simulation\par.aggregator.ts" -Pattern "boardgame.io"
Select-String -Path "packages\game-engine\src\simulation\ai.tiers.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 4 — no Math.random
Select-String -Path "packages\game-engine\src\simulation" -Pattern "Math.random" -Recurse
# Expected: no output

# Step 5 — no .reduce()
Select-String -Path "packages\game-engine\src\simulation\ai.competent.ts" -Pattern "\.reduce\("
Select-String -Path "packages\game-engine\src\simulation\par.aggregator.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 6 — no engine gameplay modifications
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/ packages/game-engine/src/scoring/
# Expected: no output

# Step 7 — no WP-036 contract modifications
git diff packages/game-engine/src/simulation/ai.types.ts
git diff packages/game-engine/src/simulation/ai.random.ts
git diff packages/game-engine/src/simulation/ai.legalMoves.ts
git diff packages/game-engine/src/simulation/simulation.runner.ts
# Expected: no output

# Step 8 — no require()
Select-String -Path "packages\game-engine\src\simulation" -Pattern "require(" -Recurse
# Expected: no output

# Step 9 — no files outside scope
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
- [ ] No boardgame.io imports in new simulation files
      (confirmed with `Select-String`)
- [ ] No `Math.random()` in simulation (confirmed with `Select-String`)
- [ ] No `.reduce()` in simulation (confirmed with `Select-String`)
- [ ] No engine or upstream contract files modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — T2 Competent Heuristic policy exists; PAR
      can be generated for any scenario via simulation; AI policy tier taxonomy
      documented
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why T2 is the sole PAR
      authority; why 55th percentile; why neutral hero pool; why minimum 500
      sample size; T2 behavioral heuristic rationale
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-049 checked off with today's date
