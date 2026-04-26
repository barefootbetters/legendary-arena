# EC-053a — PAR Artifact Carries Full ScenarioScoringConfig (Execution Checklist)

**Source:** docs/ai/work-packets/WP-053a-par-artifact-scoring-config.md
**Layer:** Engine + Server (PAR Contract Extension)

## Before Starting
- [ ] WP-048 complete: `ScenarioScoringConfig` type and `validateScoringConfig` exported
- [ ] WP-049 complete: PAR aggregator produces `ParSimulationResult`
- [ ] WP-050 complete: `SeedParArtifact`, `SimulationParArtifact`, `ParIndex` shapes; `validateParStore` exists
- [ ] WP-051 complete: `checkParPublished` returns `ParGateHit | null`; gate is fs-free at request time (D-5103)
- [ ] D-5306 + D-5306a + D-5306b + D-5306c + D-5306d landed in `docs/ai/DECISIONS.md` (A0 SPEC `1734475`)
- [ ] `data/par/` is empty or disposable on `main` (clean slate per WP-053a §Non-Negotiable Constraints)
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` reports `513 / 115 / 0`
- [ ] `pnpm --filter @legendary-arena/server test` reports `36 / 6 / 0` (10 skipped if no test DB)

## Locked Values (do not re-derive)
> Duplicated verbatim from WP-053a §Goal + §Scope. Any divergence is a hard STOP; the WP wins.
- **Primary Invariant:** PAR is the atomic tuple `(scenarioKey, parValue, scoringConfig)` — no valid runtime / validation / storage path where any one exists without the others
- `loadScoringConfigForScenario(scenarioKey: ScenarioKey, basePath: string): Promise<ScenarioScoringConfig>` — async deterministic loader; throws on parse / validation failure (PS-2)
- `loadAllScoringConfigs(basePath: string): Promise<Record<ScenarioKey, ScenarioScoringConfig>>` — async directory scan; returns frozen map (PS-2)
- `validateScoringConfig` returns `ScoringConfigValidationResult { valid: boolean; errors: readonly string[] }` (PS-1 — *not* a `Result<T>`-style `{ ok, reason }`); the loader joins `errors` with `'; '` for thrown messages
- `SeedParArtifact.scoringConfig: ScenarioScoringConfig` (non-optional)
- `SimulationParArtifact.scoringConfig: ScenarioScoringConfig` (non-optional)
- `ParIndex.scenarios[key].scoringConfig: ScenarioScoringConfig` (inline materialization at index-build time per D-5306b)
- `ParGateHit` extended return: `{ parValue, parVersion, source, scoringConfig }` (non-optional)
- `ParSimulationConfig.scoringConfig: ScenarioScoringConfig` — **already exists** at `par.aggregator.ts:136` (PS-3); aggregator unchanged
- `writeSimulationParArtifact(result, scoringConfig, basePath, parVersion): Promise<string>` — `scoringConfig` added as **3rd positional parameter** mirroring the existing `writeSeedParArtifact(artifact, scoringConfig, basePath, parVersion)` four-param precedent (PS-3)
- `buildSimulationArtifactFromResult(result, scoringConfig)` — gains the same parameter; embeds `scoringConfig` verbatim. `ParSimulationResult` is NOT modified (WP-049 contract locked).
- Version equality invariant: `scoringConfig.scoringConfigVersion === artifact.scoring.scoringConfigVersion`
- Authoring origin: `data/scoring-configs/<encoded-scenario-key>.json` per D-5306a; **filename encoding reuses `scenarioKeyToFilename` from `par.storage.ts:375` (`::` → `--`, `+` → `_`)** (PS-4); alphabetical key ordering inside each JSON file (determinism contract)
- Example file: `test-scheme-par--test-mastermind-par--test-villain-group-par.json` (encoded form of canonical test scenario key `test-scheme-par::test-mastermind-par::test-villain-group-par`)
- `validateParStore` error type strings: `'scoring_config_invalid'`, `'scoring_config_version_mismatch'`, `'par_baseline_redundancy_drift'` (D-5306c one-cycle audit)
- Engine baseline shifts `513 / 115 / 0` → **`522 / 116 / 0`** (+9 tests / +1 suite — pre-flight committed to the fresh top-level `describe('scoringConfigLoader (WP-053a)', …)` block outcome per the post-WP-031 wrap-in-describe convention) (PS-5)
- Server baseline shifts `36 / 6 / 0` → `38 / 6 / 0` (+2 tests in `parGate.test.ts`'s existing describe; +0 suites)

## Guardrails
- Server gate stays fs-free at request time (D-5103); `apps/server/src/par/parGate.mjs` MUST NOT import `node:fs` or `scoringConfigLoader`
- Engine loader (`scoringConfigLoader.ts`) does filesystem IO at authoring/startup time only; not a "pure helper" in the engine-wide sense; never called from moves / phases / hooks / `boardgame.io` lifecycle
- `validateScoringConfig` is the SOLE structural validator for embedded configs; do not re-implement validation
- `ParSimulationConfig.scoringConfig` is required (non-optional); aggregator embeds verbatim — NO derivation, no defaults, no fallbacks
- Gate construction is hard-throw: missing `scoringConfig` on any index entry → constructor throws → server fails to start. No partially-armed state.
- `SeedParArtifact.parBaseline` retained one cycle per D-5306c with a `// why:` comment; validator enforces `parBaseline === scoringConfig.parBaseline` equality
- No new npm dependencies; no `boardgame.io` import in any new file; no Math.random / Date.now / require()
- No modifications to `parScoring.types.ts`, `parScoring.logic.ts`, `apps/server/src/replay/`, `apps/server/src/identity/`, `server.mjs`, `index.mjs`, `data/migrations/`, root `package.json`, `pnpm-lock.yaml`

## Required `// why:` Comments
- `scoringConfigLoader.ts` head: filesystem-IO-at-startup justification + engine-wide-pure-helper-rule scope clarification
- `scoringConfigLoader.ts` `loadScoringConfigForScenario` throw site: authoring/startup throwing mirrors `Game.setup()` precedent (not in-move)
- `par.storage.ts` `SeedParArtifact.scoringConfig`: D-5306c one-cycle redundancy with `parBaseline`; future cleanup WP collapses
- `par.storage.ts` validator entry for `par_baseline_redundancy_drift`: enforces the one-cycle equality invariant
- `par.aggregator.ts` `scoringConfig` embed site: verbatim copy; no transformation; version-equality invariant locked
- `parGate.mjs` `ParGateHit` typedef: D-5306b inline materialization preserves D-5103 fs-free invariant
- `parGate.mjs` gate constructor guard: hard-throw on missing config; no partially-armed state
- `data/scoring-configs/README.md`: D-5306a authoring origin rationale; PAR aggregator reads from here at calibration time; consumers (server gate, WP-053) never read this directory directly

## Files to Produce
- `data/scoring-configs/README.md` — **new** — D-5306a authoring origin documentation
- `data/scoring-configs/test-scheme-par--test-mastermind-par--test-villain-group-par.json` — **new** — example file (encoded form per `scenarioKeyToFilename`; PS-4)
- `packages/game-engine/src/scoring/scoringConfigLoader.ts` — **new** — `loadScoringConfigForScenario` + `loadAllScoringConfigs`
- `packages/game-engine/src/scoring/scoringConfigLoader.test.ts` — **new** — 4 tests
- `packages/game-engine/src/simulation/par.storage.ts` — **modified** — artifact + index shape extensions; validator updates
- `packages/game-engine/src/simulation/par.storage.test.ts` — **modified** — +3 tests
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — `ParSimulationConfig.scoringConfig` required input + verbatim embed + version-equality invariant
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — **modified** — +2 tests
- `packages/game-engine/src/index.ts` — **modified** — export `loadScoringConfigForScenario` + `loadAllScoringConfigs`
- `apps/server/src/par/parGate.mjs` — **modified** — `ParGateHit` extension + gate construction hard-throw guard
- `apps/server/src/par/parGate.test.ts` — **modified** — +2 tests + mechanical `scoringConfig` fixture additions to existing tests

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` reports `522 / 116 / 0` (PS-5 locked outcome — fresh top-level `describe('scoringConfigLoader (WP-053a)', …)` block)
- [ ] `pnpm --filter @legendary-arena/server test` reports `38 / 6 / 0` (10 skipped if no test DB)
- [ ] All grep gates from WP-053a §Verification Steps pass (boundary, contract surface, locked WP-048 / WP-103 / WP-052 surfaces)
- [ ] `git diff --name-only main` shows only the files listed in §Files to Produce
- [ ] `git diff main -- packages/game-engine/src/scoring/parScoring.{types,logic}.ts` empty (WP-048 contract locked)
- [ ] `git diff main -- apps/server/src/{replay,identity}/ apps/server/src/server.mjs apps/server/src/index.mjs apps/server/scripts/ apps/server/package.json` empty
- [ ] `git diff main -- data/migrations/` empty (WP-053a does not land a migration)
- [ ] 01.6 post-mortem written at `docs/ai/post-mortems/01.6-WP-053a-par-artifact-scoring-config.md` (mandatory: new long-lived abstraction `scoringConfigLoader`; new contract consumed by WP-053; new on-disk authoring source `data/scoring-configs/`)
- [ ] `docs/ai/STATUS.md` updated with WP-053a / EC-053a current-state block
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-053a row flipped `[ ]` → `[x]` with date + Commit A hash
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-053a row flipped Draft → Done
- [ ] `docs/ai/DECISIONS.md` D-5306 status updated from "Active" to "Active — landed at <Commit A hash>"; D-5306a / D-5306b / D-5306c / D-5306d verified consistent with execution outcome
- [ ] Commit A subject prefix `EC-053a:`; Commit B subject prefix `SPEC:`; `WP-053a:` is forbidden per the commit-msg hook (P6-36)
- [ ] Vision trailer `Vision: §3, §22, §24` on Commit A
- [ ] Pre-commit review per `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md` run between "all gates green" and "stage Commit A" (WP-103 retrospective carry-forward); review artifact at `docs/ai/reviews/pre-commit-review-wp053a-ec053a.md`

## Common Failure Smells
- `parGate.mjs` imports `node:fs` → fs-free invariant broken (D-5103); revert and source config from in-memory index only
- `parGate.mjs` imports `scoringConfigLoader` → layer leak; the gate must consume config exclusively through the index
- `validateParStore` accepts an artifact missing `scoringConfig` → invariant broken; check is missing or wrong error type
- `par.aggregator.ts` accepts `scoringConfig` as optional (`?:`) → required-input invariant broken; aggregator must reject missing config
- Existing test fixture skipped instead of mechanically updated to include `scoringConfig` → discipline broken; every existing `SeedParArtifact` / `SimulationParArtifact` / `ParIndex` / `ParGateHit` fixture must add the field
- Manual JSON deserialization of `scoringConfig` field anywhere → bug; the loader and pg jsonb codec already deserialize at the boundary
- Hard-Stop grep pre-screening collision: any locked grep gate matching `// why:` comment text triggers the WP-103 carry-forward — reword the comment, not the gate (post-mortem 01.6-WP-103 §3.1)
- Skip-pattern `skip: 'requires test database'` count not exactly N for DB-dependent tests (WP-103 §16 carry-forward) — JSDoc / commentary references count toward the grep total
