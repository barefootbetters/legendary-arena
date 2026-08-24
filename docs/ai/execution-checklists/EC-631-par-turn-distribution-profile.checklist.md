# EC-631 — PAR Turn-Distribution Profile (Execution Checklist)

**Source:** docs/ai/work-packets/WP-596-par-turn-distribution-profile.md
**Layer:** Game Engine (Simulation + Persistence carve-out)

## Before Starting
- [ ] WP-049 exports `generateScenarioPar` + internal `simulateOneGame`; WP-050
      exports `scenarioKeyToFilename` + SHA-256 PAR write helpers (par.storage.ts)
- [ ] `evaluateEndgame` returns `EndgameResult | null`, outcome
      `'heroes-win' | 'scheme-wins' | 'tie'`
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] Scope lock: the 7 CODE files in `Files to Produce` are the only CODE files
      touched — any other code file is a FAIL, surfaced as a blocker. The
      governance/closeout docs (STATUS.md, DECISIONS.md, WORK_INDEX.md,
      EC_INDEX.md, `docs/05-ROADMAP-MINDMAP.md`) are the expected out-of-band
      closeout edits, NOT scope violations

## Locked Values (do not re-derive)
- `PAR_PERCENTILE_DEFAULT = 55` — unchanged; the profile exposes the full
  distribution, it does not change the percentile
- `EndgameOutcome` = `'heroes-win' | 'scheme-wins' | 'tie'`; `PerGameSample.outcome`
  adds `'unresolved'` (evaluateEndgame returned null — hit the safety cap)
- `PerGameSample` fields (7): `turnCount`, `rawScore`, `victoryPoints`,
  `bystandersRescued`, `schemeTwistCount`, `escapes`, `outcome` —
  `schemeTwistCount` sourced from `finalState.counters.schemeTwistCount ?? 0`
  (canonical `G.counters` name; equals `penaltyEventCounts.schemeTwistNegative`, D-24340)
- `MatchSetupConfig` fields (9, locked): `schemeId`, `mastermindId`,
  `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`,
  `woundsCount`, `officersCount`, `sidekicksCount`

## Guardrails
- `generateScenarioPar` `parValue` MUST be byte-identical after the refactor —
  route it through `generateScenarioParSamples`, change no seed/policy/scoring/percentile.
  The regression pin asserts against a HARDCODED numeric literal captured from
  `main` before editing — a self-comparison or in-test re-run does NOT satisfy it
- `writeParProfileArtifact` OVERWRITES an existing profile (regenerable derived
  artifact) — do NOT copy the PAR artifact's lock-on-exist behavior
- `monotoneImproving` vacuous case: fewer than 2 bins with
  `gameCount >= PROFILE_MIN_BIN_SIZE` ⇒ `true` (pin it with a test)
- Profile is a SEPARATE derived artifact — never in `ParSimulationResult`, the
  hashed PAR artifact body, or the PAR index (WP-050 locked contracts)
- Profile is never a competitive input, never read into gameplay, never a
  save-game (persistence-boundary: derived record, not state)
- No `.reduce()` with branching in aggregation — explicit `for...of` on sorted copies
- Simulation files (`par.aggregator.ts`, `par.profile.ts`) import no `boardgame.io`;
  filesystem IO only in `par.storage.ts` under the D-5001 carve-out
- No new `G` field — `finalStateHash` / `PRE_WP080_HASH` stay byte-identical
- STOP (do not partial-fix) if the parValue regression pin fails — investigate why

## Required `// why:` Comments
- `generateScenarioParSamples`: reuses the WP-049 loop so rows are the exact games
  `generateScenarioPar` scores
- `monotoneImproving`: a difficulty-FIDELITY signal (scenario too easy on the
  under-built engine), not a strategy guide — the calibration-wiki caveat
- profile write in `par.storage.ts`: derived, non-authoritative record under the
  D-5001 IO carve-out, deliberately separate from the immutable PAR artifact (D-24405)

## Files to Produce
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** —
  `PerGameSample` + `generateScenarioParSamples`; route `generateScenarioPar` through it
- `packages/game-engine/src/simulation/par.profile.ts` — **new** — profile types +
  `aggregateTurnDistributionProfile` + `PROFILE_MIN_BIN_SIZE`
- `packages/game-engine/src/simulation/par.storage.ts` — **modified** — derived
  profile write/read to a separate `profile/<version>/` tree
- `packages/game-engine/src/index.ts` — **modified** — re-export new public surface
- `packages/game-engine/src/simulation/par.profile.test.ts` — **new** — aggregation
  + round-trip coverage
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — **modified** —
  samples-count test + parValue-unchanged regression pin
- `packages/game-engine/src/simulation/par.storage.test.ts` — **modified** —
  profile write/read round-trip to a temp dir
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip the WP-596 node glyph

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `generateScenarioPar` parValue regression pin passes (byte-identical)
- [ ] STATUS.md states "No user-observable change — infrastructure only" (surface
      is `none — infrastructure`; render + sweep named as deferred follow-up)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated — D-24405 flipped to Active (post-execution)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-631 row flipped to Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node at `✅`, then `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- parValue drifted after the refactor → the loop's seed/policy/scoring order was
  changed, not just re-routed through samples
- A profile field appears in `ParSimulationResult` or the PAR index → the derived
  artifact leaked into a WP-050 locked contract; move it to the profile tree
- `monotoneImproving` never true in tests → the min-bin-size filter or the
  non-increasing (lower=better) comparison direction is inverted
