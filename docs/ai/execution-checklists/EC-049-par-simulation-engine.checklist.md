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
- T2 heuristics: threat prioritization, heroism bias, economy awareness, limited deck awareness, local optimization only
- T2 prohibitions: no civilian sacrifice, no intentional losses, no hidden state, no simulation-awareness, no exploit loops
- PAR percentile: 55th (configurable 50th-60th). Do not use the mean.
- Minimum sample: N >= 500 per scenario. Recommended: 1000-2000.
- Hero selection: neutral, non-optimized pool (PAR measures scenario difficulty before hero choice)
- Loss treatment: losses included in distribution as first-class outcomes (no filtering, no weighting, no special casing)
- Pre-release gate: PAR must exist before competitive leaderboard entries are accepted (enforcement is server-layer)
- Tier ordering: median Raw Scores must satisfy T3 < T2 < T1 < T0 (lower score = stronger play); minimum N >= 50 per tier in tests
- Seed sets: `generateSeedSet` is deterministic; `seedSetHash` stored in PAR result for audit
- PAR reproducibility: identical config = identical PAR + metadata across runs
- Raw Score semantics are an immutable trust surface — no changes without major version bump (WP-040)

## Guardrails
- Simulation is out-of-band tooling — never runs during live gameplay
- T2 receives filtered UIState only — no direct G access (D-0701)
- All decisions deterministic: same (scenario, tier, seed, scoringConfigVersion) = same output
- Raw Score computed via `computeRawScore` from WP-048 — no simulation-specific scoring
- Simulation produces replay artifacts sufficient to reproduce final state and score
- Tier ordering validated before PAR publication — violated ordering blocks publication
- Multimodal distributions flagged as potential exploit — PAR publication must halt until resolved
- `needsMoreSamples` flag set when variance exceeds threshold — signals pre-release gate to require more runs
- WP-036 and WP-048 contract files must not be modified
- No engine gameplay files modified
- No boardgame.io imports, no `Math.random()`, no `.reduce()` with branching

## Required `// why:` Comments
- `ai.competent.ts` each heuristic: threat (scoring impact), heroism (moral hierarchy), economy (anti-exploit), deck (human memory), local (human decision-making)
- `par.aggregator.ts` percentile: robust to outliers; 55th is slightly conservative
- `par.aggregator.ts` generateScenarioPar: PAR determined before hero choice
- `par.aggregator.ts` generateSeedSet: canonical seed sets make PAR reproducibility auditable
- `par.aggregator.ts` validateTierOrdering: violated ordering means heuristics are wrong or scenario is degenerate

## Files to Produce
- `src/simulation/ai.competent.ts` — **new** — T2 Competent Heuristic policy
- `src/simulation/par.aggregator.ts` — **new** — PAR aggregation, generation, validation, tier ordering, seed sets
- `src/simulation/ai.tiers.ts` — **new** — policy tier taxonomy
- `src/types.ts` — **modified** — re-export PAR simulation types
- `src/index.ts` — **modified** — export PAR simulation API
- `src/simulation/ai.competent.test.ts` — **new** — 10 tests
- `src/simulation/par.aggregator.test.ts` — **new** — 16 tests

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
- Losses filtered from distribution — artificially optimistic PAR
- Simulation modifying engine files — tooling must be external
- PAR published without pre-release gate check — leaderboard integrity risk
