# EC-749 — Synergy Realization: Realized Value % value-model refinement

**WP:** WP-712 · **Layer:** Game Engine only · **Lane:** Standard two-session · **Status:** Pending

Governs execution of WP-712: refine the WP-709 display-only Realized Value % value
model so it reflects all attack/recruit synergy value. Two gaps (from a real 2p Red
Skull match): pure count-scaled clauses (no boolean gate — Avengers Assemble / Perfect
Teamwork) are excluded, and count-scaled class-gated whiffs read 0 potential. Engine-only
(display fields already plumbed by WP-709). Hash-neutral, off-ranking, Synergy Rate
unchanged.

## Before Starting

- [ ] Baseline `origin/main` @ `67299144`; engine suite green pre-change.
- [ ] Confirm the WP-709 seam: the chokepoint whiff + assembled `recordConditionalClause` calls (`hero/heroEffects.execute.ts`), `heroClauseValue` (`hero/heroClauseValue.derive.ts`), the recorder + record shape `{played, assembled, potentialValue, realizedValue}` (`diagnostics/synergyCount.record.ts`), `isCountableConditionalClause = conditions.length > 0 && hookHasExecutableEffect`.
- [ ] Confirm `G.diagnostics` excluded from BOTH oracles (no re-pin).
- [ ] Confirm the pure count-scaled markers carry NO `[hc:X]:`/`[team:X]:` prefix (Avengers Assemble / Perfect Teamwork = pure `recruit-per-count`/`attack-per-count`, no condition) and that such a hook reaches the assembled branch (vacuous `evaluateAllConditions([])` = true) but is skipped by `isCountableConditionalClause`.

## Locked Values

- New helper: `heroClausePotentialFloor(hook): number` = Σ flat (`attack`/`recruit`) `magnitude` + Σ count-scaled (`attack-per-count`/`recruit-per-count`) `magnitude` (per-each UNIT — NOT scaled by count/perEach). 0 for a no-value hook. Pure; no `boardgame.io`; no `G` read needed (magnitudes only).
- `heroClauseValue` (existing, realized value) UNCHANGED: Σ flat `magnitude` + Σ count-scaled `magnitude × floor(resolveCountSource / perEach)`.
- Recorder: `recordConditionalClause(G, playerID, { assembled, clauseValue, countsTowardRate? })` — `countsTowardRate` defaults `true`; when `false`, accrue `potentialValue`/`realizedValue` but do NOT bump `played`/`assembled`.
- Chokepoint calls:
  - Whiff branch (boolean condition failed, `isCountableConditionalClause`): `clauseValue = Math.max(heroClauseValue(...), heroClausePotentialFloor(hook))` — a FLOOR, NOT a replacement. `{ assembled: false }`. A count-0 whiff (gate class = count source) rises 0 → per-each magnitude; a count>0 whiff (gate ≠ count source) keeps its true value. (Was `heroClauseValue` alone — which is 0 only at count 0.)
  - Assembled branch (boolean conditions passed, `isCountableConditionalClause`): `clauseValue = heroClauseValue(...)`, `{ assembled: true }` — UNCHANGED.
  - New no-condition count-scaled branch (`conditions.length === 0` AND hook has an `attack-per-count`/`recruit-per-count` value effect AND non-hollow): `{ assembled: true, clauseValue: heroClauseValue(...), countsTowardRate: false }`. Recorded at the chokepoint before `runHookEffects`. Detection: reuse the exact type check from `buildCountScaledResolution` (export a predicate or mirror inline with a `// why:`).
- Record shape `{ played, assembled, potentialValue, realizedValue }` UNCHANGED — only the values written change.

## Guardrails

- **Synergy Rate unchanged.** `played`/`assembled` stay boolean-gated only (`countsTowardRate: false` for pure count-scaled). Assert a fixture's played/assembled is byte-identical before/after.
- **Hash-neutral:** all on `G.diagnostics` → NO `finalStateHash` / `PRE_WP080` re-pin. Verify empirically; a re-pin means something leaked out of diagnostics — STOP.
- **Off-ranking:** value sums NEVER enter `finalScore`/`rawScore`/PAR/grade (NG-1). Unchanged posture.
- **Flat clauses unchanged:** a flat boolean clause records identically to WP-709 (floor = magnitude = realized). Regression-pin it.
- **Floor, never lower.** The whiff value is `Math.max(heroClauseValue, potentialFloor)` — a count>0 whiff MUST keep its true current-board value. The shipped `heroEffects.execute.test.ts:6256` pin (`potentialValue: 2` for a `[hc:tech]`-gated + `cost-four-plus`-count whiff) MUST stay green with NO edit; if you find yourself lowering it to 1, you used replace instead of floor — STOP.
- **Whiff floor = per-each magnitude, NOT a counterfactual best count.** The reorder counterfactual is the deferred WP-710 sequence teacher — do NOT compute a hypothetical count here.
- **Engine-only.** NO server/client change (display fields already flow from WP-709). `heroClauseValue.derive.ts` + `synergyCount.record.ts` import no `boardgame.io`; no `.reduce()`; hero path only.
- Additive to the record semantics only: no `EffectTraceStatus` change, no card-data, no new G field.

## Required Comments (`// why:`)

- On `heroClausePotentialFloor`: why the floor is the per-each `magnitude` (minimum meaningful payoff; the counterfactual best count is the deferred sequence teacher).
- On the whiff-branch switch to the floor: why a count-scaled whiff must register a nonzero potential (was invisible at count 0).
- On the no-condition count-scaled branch: why it records value but NOT played/assembled (`countsTowardRate: false` — pure count-scaled has no assembly decision; Synergy Rate stays boolean-gated).

## Files to Produce

Mirror WP-712 §Files Expected to Change exactly (3 source + 3 test), all under `packages/game-engine/**`. NO server/client files.

## After Completing

- [ ] Engine suite green (record delta); `pnpm -r build` 0 (server + client compile unchanged).
- [ ] Sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical; no fixture churn; `sim:runtime-observed:check` current.
- [ ] Synergy Rate (played/assembled) byte-identical for a fixture; `finalScore`/grade unchanged.
- [ ] Non-vacuity: stub `heroClausePotentialFloor`→0 fails AC-2; no-op the no-condition branch fails AC-3; restore.
- [ ] `git diff --name-only` = the allowlist + governance (engine-only, no server/client).
- [ ] Flip WORK_INDEX `[ ]→[x]`, EC_INDEX `Pending→Done`, mindmap `📝→✅`, `roadmap:counts:check` 0; D-24535 Active; NUMBER-LEDGER landed; STATUS.
- [ ] Two-commit topology (`EC-749:` impl + `SPEC:` close).
- [ ] D-24026 live-verify (post-deploy): a Cap-color-count match's Realized Value % now reflects Avengers Assemble / Perfect Teamwork realized value + a count-scaled whiff registers nonzero potential.

## Common Failure Smells

- Bumping `played`/`assembled` for a pure count-scaled clause (inflates Synergy Rate — must be `countsTowardRate: false`).
- REPLACING the whiff value with the floor instead of `Math.max` — regresses a count>0 whiff (e.g. `:6256` 2 → 1) and fails a shipped test. Use the floor as a floor.
- Computing a counterfactual "best count" for a whiff floor (that's WP-710; the floor is the per-each magnitude).
- Any `finalStateHash` / `PRE_WP080` re-pin — value leaked out of `G.diagnostics`; STOP.
- Touching server/client (the display fields already flow — engine-only WP).
- Changing flat-clause recording (must be a regression no-op).
- Double-counting a count-scaled clause that has BOTH a boolean gate and reaches the no-condition branch (the branches are exclusive: `isCountableConditionalClause` handles gated ones; the no-condition branch handles only `conditions.length === 0`).
