# EC-049 — PAR Simulation Engine (Execution Checklist)

**Source:** docs/ai/work-packets/WP-049-par-simulation-engine.md
**Layer:** Tooling / Simulation (Out-of-Band)

## Before Starting
- [ ] WP-036 complete — `AIPolicy`, `createRandomPolicy`, `getLegalMoves`, `runSimulation` exist
- [ ] WP-048 complete — `ScenarioScoringConfig`, `computeRawScore`, `buildScenarioKey`, `PENALTY_EVENT_TYPES` exist
- [ ] `docs/12-SCORING-REFERENCE.md` read — three-phase PAR derivation pipeline understood
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

## Locked Values (do not re-derive)
- Only T2 (Competent Heuristic) may define PAR — aggregation code must hard-reject other tiers
- T2 heuristics: threat prioritization, heroism bias, economy awareness, limited deck awareness, local optimization only. Prohibitions: no civilian sacrifice, intentional losses, hidden-state access, simulation-awareness, or exploit loops
- Raw Score ordering: **lower Raw Score = stronger play** (tier-ordering and PAR percentile both rely on this)
- PAR percentile: 55th (configurable 50th-60th inclusive); nearest-rank method; integer output in Raw Score units. Do not use the mean. Do not interpolate.
- Sort comparator: `[...rawScores].sort((left, right) => left - right)` — explicit stable numeric comparator; input array never mutated. Default lexical comparator is forbidden.
- Minimum sample: N >= 500 per scenario. Recommended: 1000-2000.
- Hero selection: neutral, non-optimized pool (PAR measures scenario difficulty before hero choice)
- Loss treatment: losses included in distribution as first-class outcomes (no filtering, no weighting, no special casing)
- Pre-release gate: PAR must exist before competitive leaderboard entries are accepted (enforcement is server-layer)
- Tier ordering: median Raw Scores must satisfy T3 < T2 < T1 < T0; minimum N >= 50 per tier in tests
- Seed sets: `generateSeedSet` is deterministic; `seedSetHash` stored in PAR result for audit
- PAR reproducibility: identical (scenario, setupConfig, seedSet, simulationPolicyVersion, scoringConfigVersion, generatedAtOverride) = byte-identical PAR + metadata
- Provenance: `simulationPolicyVersion` and `scoringConfigVersion` are explicit config inputs, copied verbatim into the result
- Registry parameter type: `registry: CardRegistryReader` (engine-category local structural interface from `matchSetup.validate.ts`); **never** `CardRegistry` from `@legendary-arena/registry` — D-3601 forbids the import
- `ParAggregationError.code` union: `'EMPTY_DISTRIBUTION' | 'PERCENTILE_OUT_OF_RANGE'`; tests assert both `instanceof ParAggregationError` AND `.code === '<expected>'`; never match by message substring
- Distribution integrity: `result.sampleSize === config.simulationCount`; no seed may be silently dropped; pre-aggregation `rawScores` array length always equals `simulationCount`
- JSON-serializability: `ParSimulationResult` must survive `JSON.parse(JSON.stringify(result))` with structural equality (no functions, Maps, Sets, or class instances)
- Raw Score semantics are an immutable trust surface — no changes without major version bump (WP-040)

## Guardrails
- Simulation is out-of-band tooling — never runs during live gameplay
- WP-036 and WP-048 contract files must not be modified; no engine gameplay files modified
- **`runSimulation` MUST NOT be extended with new return shapes.** WP-049 cannot rely on `SimulationResult` alone (it returns aggregate averages, not terminal `G`). Replicate the per-game loop inside `par.aggregator.ts` using engine primitives — `buildInitialGameState`, `buildUIState`, `filterUIStateForAudience`, `getLegalMoves`, `computeFinalScores`, `evaluateEndgame`, move imports — following the WP-036 `simulation.runner.ts` precedent (D-2705 static MOVE_MAP, D-2801 local structural interface, D-2704 PRNG capability gap) (pre-flight RS-10)
- T2 receives filtered UIState only — no direct G access (D-0701)
- T2's `ClientTurnIntent` must match one of the provided `LegalMove[]` exactly (moveType + required payload) — never "almost matching"
- T2 tie-breaking RNG derives only from the policy seed; never shares state with run-level shuffle RNG (D-3604)
- Metadata reproducibility: `generatedAt` differs across runs unless `generatedAtOverride` is set; every reproducibility test MUST inject it — a test that omits it is a failing test
- Raw Score computed via `computeRawScore` from WP-048 — no simulation-specific scoring
- `ScoringInputs` construction from the replicated per-game loop is a private helper in `par.aggregator.ts`; do **not** modify `deriveScoringInputs` (WP-048) which takes a `ReplayResult`, not a `SimulationResult`
- Tier ordering validated before PAR publication — violated ordering blocks publication
- Multimodal distributions flagged as potential exploit — PAR publication must halt until resolved
- `needsMoreSamples` flag set when variance exceeds deterministic threshold (IQR or stddev) — signals pre-release gate to require more runs
- No boardgame.io imports, no `Math.random()` (except the locked `new Date().toISOString()` fallback when `generatedAtOverride` is absent), no `.reduce()` with branching

## Failure Semantics (per-function — locked)

| Function | Throws? | Returns on invalid input |
|---|---|---|
| `createCompetentHeuristicPolicy` | No | N/A |
| T2 `decideTurn` | No | Always returns a legal `ClientTurnIntent`; never throws |
| `aggregateParFromSimulation` | **Yes** — `ParAggregationError` (`.code ∈ {'EMPTY_DISTRIBUTION', 'PERCENTILE_OUT_OF_RANGE'}`) | — |
| `generateScenarioPar` | No (propagates `ParAggregationError` only; never wraps or swallows) | N/A |
| `validateParResult` | No | Structured `ParValidationResult` |
| `validateTierOrdering` | No | Structured `TierOrderingResult` |
| `generateSeedSet` | No | Empty array when `count <= 0` |
| `computeSeedSetHash` | No | Stable hash for any input |

Error messages are full sentences per `00.6-code-style.md` Rule 11 regardless of throw vs structured return.

## Required `// why:` Comments
- `ai.competent.ts` each heuristic: threat (scoring impact), heroism (moral hierarchy), economy (anti-exploit), deck (human memory), local (human decision-making)
- `ai.competent.ts` tie-break RNG isolation: policy seed only; never shares state with run-level shuffle RNG (D-3604)
- `par.aggregator.ts` percentile: robust to outliers; 55th is slightly conservative
- `par.aggregator.ts` sort comparator: explicit `(a,b) => a-b` required — default lexical comparator would mis-order integers
- `par.aggregator.ts` `ParAggregationError.code` union: discriminated codes keep failure handling exhaustive and survive JSON serialization
- `par.aggregator.ts` generateScenarioPar: PAR determined before hero choice
- `par.aggregator.ts` generateScenarioPar per-game loop replication: avoids extending WP-036 `runSimulation` surface (pre-flight RS-10; D-2705 / D-2801 / D-2704)
- `par.aggregator.ts` generatedAt fallback: `new Date().toISOString()` is the only non-deterministic write; reproducibility tests inject `generatedAtOverride`
- `par.aggregator.ts` generateSeedSet: canonical seed sets make PAR reproducibility auditable
- `par.aggregator.ts` `needsMoreSamples` thresholds: module-level deterministic constants (IQR + stddev); not config inputs
- `par.aggregator.ts` validateTierOrdering: violated ordering means heuristics are wrong or scenario is degenerate
- `par.aggregator.ts` JSON-roundtrip invariant: `ParSimulationResult` is a provenance artifact consumed by WP-050; non-serializable fields corrupt on-disk representation

## Files to Produce
- `src/simulation/ai.competent.ts` — **new** — T2 Competent Heuristic policy
- `src/simulation/par.aggregator.ts` — **new** — PAR aggregation, generation, validation, tier ordering, seed sets
- `src/simulation/ai.tiers.ts` — **new** — policy tier taxonomy
- `src/types.ts` — **modified** — re-export PAR simulation types
- `src/index.ts` — **modified** — export PAR simulation API
- `src/simulation/ai.competent.test.ts` — **new** — 10 tests
- `src/simulation/par.aggregator.test.ts` — **new** — 17 tests

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No boardgame.io/Math.random in new simulation files (Select-String)
- [ ] No `.reduce()` in new simulation files (Select-String)
- [ ] No engine or upstream contract files modified (git diff)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated (T2 as PAR authority, percentile choice, neutral hero pool, min sample, loss treatment, pre-release gate, seed set canonicalization, immutable scoring surface)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date

## Common Failure Smells
- T2 using `Math.random()` instead of seeded RNG — breaks determinism
- T2 accessing G directly instead of filtered UIState — violates D-0701
- Using mean instead of percentile for PAR — not robust to outliers
- T2 sacrificing bystanders for optimization — violates heroism bias
- Tier ordering violated (e.g., T2 outperforms T3) — heuristics miscalibrated
- Multimodal Raw Score distribution — possible degenerate exploit loop
- Adjusting PAR percentile to "fix" tier ordering failures — masks real problems
- `generateScenarioPar` producing different PAR on identical inputs — seed set or determinism bug
- Metadata differs across reproducibility runs without an injected `generatedAtOverride` — test is using wall-clock time
- Losses filtered from distribution — artificially optimistic PAR
- Importing `CardRegistry` from `@legendary-arena/registry` — violates D-3601; use `CardRegistryReader` local interface
- Extending `runSimulation` with new return fields — violates WP-036 immutability; replicate the per-game loop instead
- Default `rawScores.sort()` (lexical) — integers mis-ordered; always pass `(a, b) => a - b`
- `ParAggregationError` tests matching by message substring — should match `instanceof` AND `.code`
- Reproducibility test that asserts byte-identity but omits `generatedAtOverride` — flaky on clock boundaries
- `result.sampleSize` less than `config.simulationCount` — a seed was silently dropped
- `ParSimulationResult` containing a `Map`, `Set`, class instance, or function — breaks JSON round-trip and WP-050 persistence
