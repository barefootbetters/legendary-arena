# EC-745 — Synergy Realization: per-match Synergy Rate + Table Total

**WP:** WP-708 · **Layer:** Game Engine + Server + Arena Client · **Lane:** Standard two-session · **Status:** Pending

Governs execution of WP-708: a per-player conditional-clause counter on the
hash-excluded `G.diagnostics`, read into a **display-only** Synergy Rate on the
endgame report card + coach, plus a neutral cross-seat Table Total. Aggregates the
already-shipped signals (WP-295 whiff log, WP-409 fired-count); adds no detection.

## Before Starting

- [ ] Baseline `origin/main` @ `4ee5ff39`; engine + server + arena-client suites green pre-change.
- [ ] Confirm the seam is unchanged: `evaluateAllConditions` + the condition-failed `continue` branch (`hero/heroEffects.execute.ts`, WP-295); `GameDiagnostics` (`diagnostics/hollowEffect.types.ts`); `PlayerScoringContribution` + `deriveScoringInputs` (`scoring/parScoring.*`); `CoachPlayerLine` (`apps/server/src/coach/coach.types.ts`); `EndgameSummary.vue` `perPlayer` row + `contributionPhrases`.
- [ ] Confirm `G.diagnostics` is excluded from BOTH oracles (`computeStateHash` + `PRE_WP080`) before relying on "no re-pin".

## Locked Values

- Diagnostics field: `GameDiagnostics.conditionalClauses?: Record<string, { played: number; assembled: number }>` — optional, absent until first write (lazy-init like `traces?`).
- Recorder: `recordConditionalClause(G, playerID, { assembled: boolean }): void` in `diagnostics/synergyCount.record.ts` (new). Never throws.
- Scoring fields (display-only): `PlayerScoringContribution.conditionalClausesPlayed`, `.conditionalClausesAssembled` (readonly number).
- Counting rule: count a hook iff it has **≥ 1 condition AND its mechanic is non-hollow**; `played` always, `assembled` iff `evaluateAllConditions === true`.
- Player-facing name: **Synergy Rate** (`assembled / played`, hidden when `played === 0`); **Table Total** = Σ `assembled`. NOT "Team-Up Rate".
- Endgame copy order: Table Total → seat Synergy Rate line → (later phase) teaching line.

## Guardrails

- **Two vocabularies:** engine keeps `conditional*` / `condition-failed` / `fired`; surfaced copy shows NONE of `whiff` / `failed` / `error` / `missed` / `wasted`.
- **Off-ranking:** the synergy fields NEVER enter `finalScore` / `rawScore` / PAR / grade (NG-1). Display-only, like the WP-616 per-seat defeat counts.
- **Hash-neutral:** counters ride `G.diagnostics` only → NO `finalStateHash` / `PRE_WP080` re-pin. Verify empirically (sweep + full run); a re-pin means something leaked out of diagnostics — STOP.
- **Hollow-excluded:** a condition-failed hook never reaches `detectHollowHeroHook`, so gate the denominator on the mechanic being in the handled/`MVP_KEYWORDS` set at the chokepoint — not on a post-hoc hollow record.
- **Layer boundary:** `synergyCount.record.ts` imports no `boardgame.io`; the client re-evaluates no conditions (renders numbers + engine-authored count only, D-20105).
- **No `.reduce()`** in the counter logic; hero path only (villain/scheme out).
- Additive only: no change to firing behavior, no `EffectTraceStatus` member, no card-data.

## Required Comments (`// why:`)

- On `GameDiagnostics.conditionalClauses`: why it is hash-excluded + display-only (no re-pin; never scored).
- On the chokepoint `recordConditionalClause` call: why unconditional and hollow hooks are skipped (no player decision / not the player's backlog).
- On the `EndgameSummary.vue` `played === 0` guard: why no rate renders (no synergy decision that match).

## Files to Produce

Mirror WP-708 §Files Expected to Change exactly (8 source + 5 test). The single new engine module is `diagnostics/synergyCount.record.ts`; the single `01.5` client-wiring surface is `EndgameSummary.vue`.

## After Completing

- [ ] Engine / server / arena-client suites green (record deltas); `vue-tsc` clean; `pnpm -r build` 0.
- [ ] Sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical (no re-pin); `sim:runtime-observed:check` current.
- [ ] `finalScore`/grade unchanged for every fixture (asserted).
- [ ] Copy-lint green.
- [ ] `git diff --name-only` = the allowlist + governance.
- [ ] `DESIGN-SYNERGY-REALIZATION.md` committed (ratified) with the WP.
- [ ] Flip WORK_INDEX `[ ]→[x]`, EC_INDEX `Pending→Done`, mindmap `📝→✅`, `roadmap:counts:check` 0; D-24531 Active; STATUS close-out.
- [ ] Two-commit topology (`EC-745:` impl + `SPEC:` close).
- [ ] D-24026 live-verify (post-deploy STATUS-flip): a real match with a live + a dead condition shows the Table Total + seat line.

## Common Failure Smells

- Counting an unconditional hook (inflates the denominator) or a hollow hook (blames the player for our backlog).
- Any re-pin of `finalStateHash` / `PRE_WP080` — means a value leaked out of `G.diagnostics`; STOP and find it.
- Surfacing "whiff/failed/missed" in the endgame copy (copy-lint catches it).
- Reading `lastPlayEffectsFired` as the numerator — it is a per-play transient total, not a per-match conditional-assembled count.
