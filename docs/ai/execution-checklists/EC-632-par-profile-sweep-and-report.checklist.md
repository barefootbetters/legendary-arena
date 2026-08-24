# EC-632 — PAR Profile Sweep + Too-Easy Fidelity Report + Scoring-Wiki Render (Execution Checklist)

**Source:** docs/ai/work-packets/WP-597-par-profile-sweep-and-report.md
**Layer:** Shared Tooling (authoring-time script) + committed data + ewiki

## Before Starting
- [ ] WP-596 on `main`: `@legendary-arena/game-engine` exports
      `generateScenarioParSamples`, `aggregateTurnDistributionProfile`;
      `@legendary-arena/game-engine/setup` exports `writeParProfileArtifact`
- [ ] `scripts/generate-seed-par.mjs` exports `enumerateScenarios`;
      `@legendary-arena/registry` exports `createRegistryFromLocalFiles`
- [ ] `pnpm -r build` exits 0 (the sweep imports built `dist`)
- [ ] Scope lock: the code files are exactly `scripts/generate-par-profiles.mjs`
      + `scripts/generate-par-profiles.test.ts`; the committed outputs live under
      `data/par/profile/v1/`; the render is `wiki/par-simulation-calibration.md`.
      Governance/closeout docs (STATUS, DECISIONS, WORK_INDEX, EC_INDEX,
      05-ROADMAP-MINDMAP) are expected out-of-band edits, NOT scope violations

## Locked Values (do not re-derive)
- `generateScenarioParSamples(config, registry)` takes a **`ParSimulationConfig`**
  (10 fields), NOT a bare `MatchSetupConfig`: `{ scenarioKey, setupConfig, playerCount,
  simulationCount, baseSeed, percentile, scoringConfig, simulationPolicyVersion,
  scoringConfigVersion, generatedAtOverride? }`. The `MatchSetupConfig` is only `setupConfig`.
- `MatchSetupConfig` fields (9): `schemeId`, `mastermindId`, `villainGroupIds`,
  `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`, `woundsCount`,
  `officersCount`, `sidekicksCount`
- Sources: `henchmanGroupIds` ← `getGauntletConfig(setAbbr, mastermindSlug, schemeSlug, playerCount)`
  (`@legendary-arena/registry/gauntletConfigs`) → `{ villainGroupIds, henchmanGroupIds }`, undefined→skip
  (split the set-qualified extIds into setAbbr+slug); `heroDeckIds` ← the fixed hero pool sliced to
  `resolveEffectiveHeroCount(schemeExtId, playerCount, getPlayerCountSetup(playerCount).heroCount)`
  (both `@legendary-arena/registry/playerCountSetup`, 3-arg); `scoringConfig` ←
  `loadScoringConfigForScenario(scenarioKey, 'data/scoring-configs')` (never re-derived)
- Fixed hero pool: `core/spider-man`, `core/hulk`, `core/wolverine`, `core/black-widow`,
  `core/cyclops`, `core/iron-man` (6 core heroes)
- Wrapper fields: `percentile` = `PAR_PERCENTILE_DEFAULT` (55, imported);
  `simulationPolicyVersion` = `'CompetentHeuristic/v1'`; `scoringConfigVersion` = the
  loaded config's version; `baseSeed` = `` `par-profile-${scenarioKey}` ``; supply counts 30/30/30/12
- Too-easy comparator (locked): `monotoneImproving` true first → higher `winRate`
  first → lower `minWinningTurn` first (`null` last) → `scenarioKey` asc.
  `winRate = winCount / (winCount + lossCount)` (0 when no resolved games)
- Profile tree: `data/par/profile/<version>/` (WP-596 / D-24405) — never
  `data/par/seed/` or `data/par/sim/`
- Profiles carry `derived: true` / `authoritative: false` (via `writeParProfileArtifact`)
- `PROFILE_MIN_BIN_SIZE` + all profile fields come from WP-596 — consume, never redefine

## Guardrails
- Build a full `ParSimulationConfig` (10 fields), NOT a bare `MatchSetupConfig` —
  the latter is only `setupConfig`. `scoringConfig` is LOADED via
  `loadScoringConfigForScenario`, never re-derived (the private `buildScoringConfig`
  in `generate-seed-par.mjs` is scope-locked)
- Henchmen ← `getGauntletConfig` (registry/gauntletConfigs, undefined→skip); hero count ←
  `resolveEffectiveHeroCount(schemeId, numPlayers, baseHeroCount)` (registry/playerCountSetup,
  3-arg, baseHeroCount = `getPlayerCountSetup(playerCount).heroCount`), scheme-aware
  (Secret Invasion 6, Civil War 4-at-2p), not the raw `heroCount`
- The too-easy comparator is the locked rule above — a fixed multi-key sort, not
  an invented scalar; unit-test it (incl. `null` minWinningTurn sorts last)
- Authoring-time Shared Tooling ONLY — the script imports engine/registry but is
  never imported by runtime code; it changes NO engine/server/app source
- Do NOT modify `generate-seed-par.mjs` or any `packages/game-engine` source; do
  NOT write under `data/par/seed/` or `data/par/sim/`
- Everything produced is a DIAGNOSTIC — never published as competitive PAR, never
  read by the server gate
- Per-scenario failure → caught, recorded in `skipped[]` with a reason, sweep
  continues (never aborts)
- Determinism: fixed timestamps + sorted-key canonical JSON so a re-run diffs
  clean; no `Math.random()` (games are seeded via WP-049 `baseSeed`)
- No `.reduce()` with branching — explicit `for...of`
- STOP (do not partial-fix) if the enumeration or a registry API differs from the
  WP's assumption — surface it as a blocker

## Required `// why:` Comments
- the fixed hero/henchman loadout: isolates mastermind/scheme/villain difficulty
  so the diagnostic is about the *content*, not the hero choice
- the per-scenario try/catch skip: a broken setup must not abort the whole sweep
- the too-easy ranking key: what combination of monotoneImproving + winRate +
  minWinningTurn means "most too-easy", and that it is a fidelity signal not a PAR

## Files to Produce
- `scripts/generate-par-profiles.mjs` — **new** — sweep + report generator
- `scripts/generate-par-profiles.test.ts` — **new** — `node:test` pure-helper tests
- `data/par/profile/v1/**` — **new** — per-scenario profiles + `fidelity-report.json`
  + `fidelity-report.md` (committed diagnostic data)
- `wiki/par-simulation-calibration.md` — **modified** — the render section
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip the WP-597 node glyph

## After Completing
- [ ] `pnpm -r build` exits 0; `node --test scripts/generate-par-profiles.test.ts` passes
- [ ] Full sweep ran; `data/par/profile/v1/**` committed; re-run diffs clean
- [ ] `pnpm run wiki-viewer:check-links` passes
- [ ] Live-on-surface: the new section renders on the deployed calibration ewiki
      page (or the ungated `*.onrender.com` fallback if the deploy is gated)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24406 flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-597 checked off with date; `EC_INDEX.md` EC-632 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅`, then `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- Sweep aborts on the first bad scenario → the try/catch skip is missing or too narrow
- Re-run shows a diff → a non-fixed timestamp or non-canonical JSON leaked in
- Profiles appear under `seed/` or `sim/` → wrong writer or wrong tree; use `writeParProfileArtifact`
- Every scenario ranks identically too-easy → the ranking key collapsed (check the
  winRate / minWinningTurn tie-breakers), OR the engine genuinely is that uniform
  (record it honestly, don't force spread)
