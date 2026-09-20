# EC-746 — Synergy Realization: Realized Value %

**WP:** WP-709 · **Layer:** Game Engine + Server + Arena Client · **Lane:** Standard two-session · **Status:** Pending

Governs execution of WP-709: value-weight the WP-708 conditional-clause synergy
signal. Per-clause attack/recruit value (flat magnitude or count-scaled
`magnitude × floor(count / perEach)`) is derived at the `evaluateAllConditions`
chokepoint and accumulated as `potentialValue` / `realizedValue` on the
hash-excluded `G.diagnostics`, read into a **display-only** Realized Value % on the
endgame report card + coach. Computed at the chokepoint, NOT read back from the
capped WP-706 trace channel.

## Before Starting

- [ ] Baseline `origin/main` @ `b45362aa`; engine + server + arena-client suites green pre-change.
- [ ] Confirm the seam is unchanged: the WP-708 chokepoint + `recordConditionalClause` (`hero/heroEffects.execute.ts`, `diagnostics/synergyCount.record.ts`); `buildCountScaledResolution` + `resolveCountSource` (`hero/heroEffects.execute.ts`, `hero/heroCountSource.resolve.ts`); `GameDiagnostics.conditionalClauses` (`diagnostics/hollowEffect.types.ts`); `PlayerScoringContribution` + `deriveScoringInputs` (`scoring/parScoring.*`); `CoachPlayerLine` + `buildCoachMatchSummary` (`apps/server/src/coach/*`); `EndgameSummary.vue` `synergyPhrase`.
- [ ] Confirm `G.diagnostics` is excluded from BOTH oracles (`computeStateHash` + `PRE_WP080`) before relying on "no re-pin".
- [ ] Confirm the value keyword set on `main`: `attack`, `recruit`, `attack-per-count`, `recruit-per-count` (the WP-706 `resource: 'attack'|'recruit'` set).

## Locked Values

- Record shape: `GameDiagnostics.conditionalClauses[playerID]: { played: number; assembled: number; potentialValue: number; realizedValue: number }` — additive on the WP-708 record; lazy; hash-excluded.
- Recorder: `recordConditionalClause(G, playerID, { assembled: boolean; clauseValue: number }): void` — `played += 1`, `potentialValue += clauseValue`; when `assembled`: `assembled += 1`, `realizedValue += clauseValue`. Never throws.
- Value helper: `heroClauseValue(G, playerID, cardId, hook): number` in `hero/heroClauseValue.derive.ts` (new). Pure; sums legacy `attack`/`recruit` (flat `magnitude`) + `attack-per-count`/`recruit-per-count` (`magnitude × floor(resolveCountSource(G, playerID, countSource, cardId) / perEach)`, `perEach` absent/≤0 → 1, absent `countSource` → 0). Non-value hook → 0. No `boardgame.io`, no `G` mutation, `for...of`.
- Scoring fields (display-only): `PlayerScoringContribution.conditionalClausesRealizedValue`, `.conditionalClausesPotentialValue` (readonly number). Same on `CoachPlayerLine` + the two client mirrors.
- Player-facing metric: **Realized Value %** = `round(100 × realizedValue / potentialValue)`, hidden when `potentialValue === 0`.
- Render order: Table Total → Synergy Rate (WP-708) → Realized Value % line.
- Value currency: attack + recruit magnitude ONLY. `primitiveEffects`, `count-scaled-choose`, `reveal-herodeck-attack`, draw/KO/rescue → no value weight (v1).

## Guardrails

- **Two vocabularies:** engine keeps `potentialValue`/`realizedValue`/`clauseValue`/`condition-failed`; surfaced copy shows NONE of `whiff` / `failed` / `error` / `missed` / `wasted`.
- **Off-ranking:** the value fields NEVER enter `finalScore` / `rawScore` / PAR / grade (NG-1). Display-only, like the WP-708 `conditionalClauses{Played,Assembled}` fields.
- **Hash-neutral:** the value sums ride `G.diagnostics` only → NO `finalStateHash` / `PRE_WP080` re-pin. Verify empirically (sweep + full run); a re-pin means value leaked out of diagnostics — STOP.
- **Gameplay grant untouched:** `resolveCountSource` returns the same integer the grant uses; the value helper only reads. Assert `resolveCountSource` returns identically with/without the helper call, OR that no grant/hash changed.
- **Chokepoint, not trace:** derive value at the chokepoint; do NOT read back `EffectTrace.resolution` (capped/lossy, count-scaled-only, absent for whiffs). Cross-check: for an assembled count-scaled clause **with a single count-scaled value effect** (the helper sums per-hook; `computedValue` is per-effect), `realizedValue === computedValue` for the same play.
- **Layer boundary:** `heroClauseValue.derive.ts` + `synergyCount.record.ts` import no `boardgame.io`; the client re-computes no value (renders engine-authored numbers only, D-20105).
- **No `.reduce()`** in the value/counter logic; hero path only (villain/scheme out).
- Additive only: no change to firing behavior, no `EffectTraceStatus` member, no card-data. The exact-match record-shape `deepEqual` pins live in TWO files — `synergyCount.record.test.ts` (~lines 24/34/42/43/53) **and** `heroEffects.conditional.test.ts` (the chokepoint records at ~:451/:471) — extend BOTH sets with `potentialValue`/`realizedValue` rather than only adding new cases (the WP-706/EC-206 optional-add-passes-silently class). The `heroEffects.conditional.test.ts` `conditionalClauses === undefined` assertions (unconditional/hollow hooks, ~:487/:507) stay valid — do NOT edit them. Also extend the `conditionalClauses` INPUT literals in `parScoring.logic.test.ts` (~:894/:929) with the two value fields (engine tests aren't typechecked, but leave no stale fixture).
- **Clause-value timing (locked):** `heroClauseValue` reads the count once at the chokepoint (pre-`runHookEffects` board snapshot), so clause value is the hook-evaluation-time ceiling. For a multi-effect hook where an earlier effect feeds a later count-scaled effect, the displayed value can differ from the per-effect grant — this is by design (display-only; live + replay both snapshot pre-execution, so no determinism impact). The AC-3 `realizedValue === computedValue` cross-check is therefore bounded to a hook with a SINGLE count-scaled value effect.
- **Silent-drop site:** `buildScoreBreakdown` (`scoring/parScoring.logic.ts` ~415–429) deep-copies `PlayerScoringContribution` field-by-field — add the two new value fields there too, or they never reach `competitionApi`/the client.

## Required Comments (`// why:`)

- On `GameDiagnostics.conditionalClauses` `potentialValue`/`realizedValue`: why hash-excluded + display-only (no re-pin; never scored).
- On `heroClauseValue`: why value currency = attack/recruit only, and why count-scaled uses the same `perEach` absent/≤0 → 1 normalization as `buildCountScaledResolution` (so realized == `computedValue`).
- On the chokepoint `clauseValue` computation: why the count-source read is valid on both branches (board settled, independent of the boolean condition) and byte-identical to the grant.
- On the `EndgameSummary.vue` `potentialValue === 0` guard: why no line renders (no synergy value that match).

## Files to Produce

Mirror WP-709 §Files Expected to Change exactly (11 source + 8 test). The new engine modules are `hero/heroClauseValue.derive.ts` (+ its test); the single `01.5` client-wiring surface is `EndgameSummary.vue`. The 8th test file is `hero/heroEffects.conditional.test.ts` — the recorder shape change forces extending its exact-match chokepoint `deepEqual` pins (below).

## After Completing

- [ ] Engine / server / arena-client suites green (record deltas); `vue-tsc` clean; `pnpm -r build` 0.
- [ ] Sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical (no re-pin); `sim:runtime-observed:check` current.
- [ ] `finalScore`/grade unchanged for every fixture (asserted).
- [ ] Cross-check: assembled count-scaled `realizedValue === computedValue`.
- [ ] Copy-lint green.
- [ ] `git diff --name-only` = the allowlist + governance.
- [ ] Flip WORK_INDEX `[ ]→[x]`, EC_INDEX `Pending→Done`, mindmap `📝→✅`, `roadmap:counts:check` 0; D-24532 Active; STATUS close-out.
- [ ] Two-commit topology (`EC-746:` impl + `SPEC:` close).
- [ ] D-24026 live-verify (post-deploy STATUS-flip): a real match with a count-scaled live condition + a flat dead condition shows the seat Realized Value %.

## Common Failure Smells

- Reading back `EffectTrace.resolution` for the aggregate (capped/lossy; misses flat clauses and whiffs) instead of computing at the chokepoint.
- Counting value for an unconditional or hollow hook (only `isCountableConditionalClause` hooks contribute value).
- Any re-pin of `finalStateHash` / `PRE_WP080` — means value leaked out of `G.diagnostics`; STOP and find it.
- Duplicating the count-scaled math and letting it drift from `buildCountScaledResolution` — pin them with the assembled-clause `realizedValue === computedValue` cross-check.
- Surfacing "whiff/failed/missed" in the Realized Value % copy (copy-lint catches it).
- Dividing by zero when `potentialValue === 0` (guard: no line).
