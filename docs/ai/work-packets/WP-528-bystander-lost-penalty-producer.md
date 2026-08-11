# WP-528 — Wire the `bystanderLost` Penalty Producer (derive lost civilians from the Escaped Villains pile)

**Layer:** Game Engine (`packages/game-engine`)
**EC:** [EC-563](../execution-checklists/EC-563-bystander-lost-penalty-producer.checklist.md)
**Status:** Draft 2026-08-11
**Baseline:** drafted off `origin/main` @ `2f589653` (rebased after WP-527/EC-562 were taken by #1339; this WP renumbered 527→528, 562→563)
**Lane:** standard two-session (PAR / scoring is barred from the Lightweight Lane per 01.0a §Eligibility gate #6)

## Goal

Make the `bystanderLost` penalty **actually count** in match scoring. Today
**both** score-derivation paths hard-code `bystanderLost` to `0` as a D-4801
safe-skip — `deriveScoringInputs` (real-match / leaderboard path) and
`deriveScoringInputsFromFinalState` (the PAR-calibration simulation path in
`par.aggregator.ts`) — so a match that lets civilians be carried away is not
scored on that loss, and PAR baselines are calibrated as if that loss never
happens. This WP replaces **both** safe-skips with the same pure, end-of-match
derivation that counts the `bystander`-typed cards sitting in `G.escapedPile`
(the cards an escaping Villain carried away), mirroring how each function
already counts `bystandersRescued` in the players' victory zones. It is the
second of the five `PenaltyEventType` producers to go live after
`villainEscaped`, and the two derivation copies are kept **symmetric** so a
calibrated PAR and the real score it normalizes are computed under identical
producer logic.

## Assumes

- **WP-048 ✅** — the PAR scoring type family, `ScoringInputs`,
  `deriveScoringInputs`, `PenaltyEventType`, and the Raw Score formula that
  multiplies `penaltyEventCounts.bystanderLost` by the config's
  `penaltyEventWeights.bystanderLost`
  (`packages/game-engine/src/scoring/parScoring.logic.ts`,
  `parScoring.types.ts`). The consuming arithmetic already iterates
  `PENALTY_EVENT_TYPES`, so a non-zero count flows through with no contract
  change; only the producer is missing.
- **Bystander carry-away is already modelled (D-24314 ✅).**
  `carryEscapedBystandersToPile` (`board/bystanders.logic.ts`) routes a captured
  Bystander into `G.escapedPile` when its Villain escapes. It is invoked from
  **two** escape sites — the villain-deck reveal escape branch
  (`villainDeck.reveal.ts:274`) and the scheme-twist city-displacement escape
  branch (`rules/schemeTwistResolvers.ts:650`). Carried-away Bystanders keep
  their `'bystander'` type. `G.escapedPile` also holds the escaped **villain**
  card itself (and, via one scheme effect, a hero-deck-top card); those are not
  `'bystander'`-typed and are correctly ignored by the derivation. So the data
  this producer needs is already durably present in the terminal `G` — nothing
  new to model, no invented mechanic — and counting by type is robust to which
  escape path carried the Bystander.
- **Card typing is available.** `gameState.villainDeckCardTypes[extId] === 'bystander'`
  is the same discriminator both derivation functions already use to count
  `bystandersRescued` (`parScoring.logic.ts:74-81`, `par.aggregator.ts:695-702`).
- **End-of-match derivation is the contract (D-4804).** Both functions run only
  against a terminal `G`; reading `G.escapedPile` there is consistent with how
  `escapes` and `bystandersRescued` are derived.

## Context (Read First)

The `bystanderLost` penalty has been specified-but-unproduced since WP-048
(see [Scoring — penalty producer status](../../../wiki/scoring.md) and
[PAR Simulation Calibration](../../../wiki/par-simulation-calibration.md),
reason #2). Of the five `PenaltyEventType` values, only `villainEscaped` has an
engine producer; the other four safe-skip to `0` (D-4801) in **both**
derivation functions. `bystanderLost` is the highest-severity of those —
`validateScoringConfig` enforces `bystanderLostWeight > villainEscapedWeight`
(`parScoring.logic.ts:402-406`) **and** `bystanderLostWeight > bystanderReward`
(`parScoring.logic.ts:407-411`) — yet it currently contributes nothing, so
"losing a civilian" is invisible to a match's Final Score.

**Why now:** a cross-system review (this project's PAR scoring vs. the community
"Legendary Leagues" ranking system) confirmed the ordering independently — the
community/rulebook Total Score weights a carried-away bystander at **4×**, a
scheme twist at **3×**, and an escaped villain at **1×**. That is external
corroboration of the moral hierarchy our structural invariants already assert,
and it makes wiring the missing producer the clearest high-value scoring
improvement available. (Re-anchoring the actual per-config weights to the 4:3:1
ratio is a **separate** future concern — no production `ScenarioScoringConfig`
exists yet; only the test fixture does — and is explicitly out of scope here.)

**Why the derivation, not a counter:** the intended-producer comment in the
source suggests "either an `ENDGAME_CONDITIONS.BYSTANDERS_LOST` counter or a
structured event log." A new `G` counter would shift the `finalStateHash` /
`PRE_WP080_HASH` oracles (the dual re-pin hazard). Deriving from the **existing**
`G.escapedPile` at endgame reads state that is already there, adds no `G` field,
and therefore requires **no hash re-pin**. This is the cheaper and cleaner path
and the one this WP locks (D-24339).

**Why both derivation copies:** `deriveScoringInputsFromFinalState`
(`par.aggregator.ts`) is an independent second copy of the derivation used to
score the Monte-Carlo games that produce a scenario's PAR baseline. If only the
real-match path counted `bystanderLost`, calibrated PAR baselines would be
systematically **too easy** on any bystander-losing scenario (the baseline
omits a penalty the real score incurs). Wiring both keeps the calibration and
the live score symmetric, which is the whole premise of `finalScore = rawScore
− parScore`.

## Non-Negotiable Constraints

- **Engine-layer purity.** Both derivation functions stay pure, deterministic,
  side-effect-free, end-of-match, and read `G` without mutating it
  (D-4802 / D-4804). No `ctx.random`, no `boardgame.io` import, no I/O.
- **No new `G` field.** Do not add a `G.counters.BYSTANDERS_LOST` (or any) field
  or event log. Derive from the existing `G.escapedPile`. Adding a `G` field
  would force a `finalStateHash` / `PRE_WP080_HASH` dual re-pin — STOP if
  tempted.
- **No contract-file edit.** `PenaltyEventType` and `PENALTY_EVENT_TYPES`
  (`parScoring.types.ts`) are unchanged; `ScoringInputs` / `ScoreBreakdown` keep
  their shape.
- **Locked derivation:** count entries of `gameState.escapedPile` whose
  `gameState.villainDeckCardTypes[extId] === 'bystander'`. Applied identically
  in `deriveScoringInputs` and `deriveScoringInputsFromFinalState`.
- **No double-count:** villains in `escapedPile` are the `villainEscaped` /
  `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` count; only `bystander`-typed entries
  feed `bystanderLost`.
- **Full file contents** for every changed file (no diffs/snippets). ESM-only,
  Node v22+. Human-style code — see
  [`docs/ai/REFERENCE/00.6-code-style.md`](../REFERENCE/00.6-code-style.md)
  (explicit `for...of`, no `.reduce()` in the count loop, full-word names,
  `// why:` + JSDoc).
- **Session protocol:** one WP per session; scaffold-first (below) before the
  READY claim; two-commit topology (`EC-563:` + `SPEC:`).

## Scope (In)

- Replace the `bystanderLostCount = 0` safe-skip in `deriveScoringInputs`
  (`packages/game-engine/src/scoring/parScoring.logic.ts`) with the escaped-pile
  derivation + updated `// why:` (D-24339 rationale).
- Replace the identical `bystanderLost: 0` safe-skip in
  `deriveScoringInputsFromFinalState`
  (`packages/game-engine/src/simulation/par.aggregator.ts:711`) with the same
  derivation + updated `// why:`, keeping the two copies symmetric.
- Add unit tests in `scoring/parScoring.logic.test.ts` and
  `simulation/par.aggregator.test.ts` (whichever already exercises each
  derivation) covering the ACs below, including a Bystander carried away via the
  **scheme-twist** escape path (not only the reveal path).
- Flip the `bystanderLost` status in [`wiki/scoring.md`](../../../wiki/scoring.md)
  (penalty-producer table + status list) from "safe-skip 0 / when the counter
  lands" to "live — derived from `G.escapedPile` (D-24339)". Re-run the wiki
  link gate.
- Land D-24339 (the derivation-source + no-re-pin + version-posture decision).

## Out of Scope

- **The other three unproduced producers** — `schemeTwistNegative`,
  `mastermindTacticUntaken`, `scenarioSpecificPenalty` — stay safe-skipped in
  both functions.
- **Re-anchoring per-config penalty weights** to the 4:3:1 rulebook ratio, and
  authoring production `ScenarioScoringConfig`s. The producer is
  config-independent; whatever weight a config carries multiplies the new count.
- **`computeParScore`** — the PAR baseline uses `bystanderLost: 0` by design
  (a baseline is expressed via `ParBaseline` fields, which carry no
  bystander-lost term); this WP does not change that. (Distinct from
  `deriveScoringInputsFromFinalState`, which scores *simulated games* and IS in
  scope.)
- **Any new `G` field, counter, or event log.** Derivation only.
- **Other bystander-loss paths** (e.g. a future effect that KOs a bystander
  outright) — the faithful MVP counts the carry-away path that `G.escapedPile`
  records via both current escape branches.

## Files Expected to Change

- `packages/game-engine/src/scoring/parScoring.logic.ts` — **modified** —
  `deriveScoringInputs`: escaped-pile derivation + `// why:`.
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — **modified** —
  AC-1..AC-5 tests.
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** —
  `deriveScoringInputsFromFinalState`: same escaped-pile derivation + `// why:`;
  also correct the function JSDoc (~lines 673-675) that currently claims "all
  five penalty-event types follow the WP-048 safe-skip" → now three
  (`schemeTwistNegative`, `mastermindTacticUntaken`, `scenarioSpecificPenalty`).
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — **modified** —
  AC-6 symmetry test (incl. a scheme-twist-carried bystander).
- `wiki/scoring.md` — **modified** — flip the `bystanderLost` producer status to
  live.
- `docs/ai/DECISIONS.md` — **modified** — D-24339 flips Drafted → Active.
- Governance close: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`
  (glyph 📝 → ✅ + `roadmap:counts:write`), `docs/ai/STATUS.md`.

> **Scaffold-first (01.0a Step 3 / 01.4 Empirical Scaffold).** This WP changes a
> derived score, so it can break any existing fixture/test that ends with
> bystanders in `escapedPile` and asserts a specific `rawScore` / `finalScore` /
> `penaltyEventCounts` (in either the logic or the aggregator suite). The
> executor MUST prototype both derivations and run
> `pnpm --filter @legendary-arena/game-engine test` **before** claiming scope is
> locked, and fold every observed break into this allowlist. Do not reason "it's
> additive."

## Contract

- `deriveScoringInputs(replayResult, gameState)` and
  `deriveScoringInputsFromFinalState(finalState, turnCount)` return
  `ScoringInputs` unchanged in **shape**; only `penaltyEventCounts.bystanderLost`
  changes from a constant `0` to `count(escapedPile where
  villainDeckCardTypes[extId] === 'bystander')`.
- No change to `ScoringInputs`, `ScoreBreakdown`, `ScenarioScoringConfig`,
  `PenaltyEventType`, or `PENALTY_EVENT_TYPES` (no contract-file edit).
- No new `G` / `LegendaryGameState` field. `G` and `ctx` remain runtime-only.
- Derivation is pure, deterministic, end-of-match, reads `G` without mutating it
  (D-4802 / D-4804).
- **No persisted score is invalidated.** `scoringConfigVersion` versions the
  *config*, not the derivation; no production `ScenarioScoringConfig` and no
  persisted `legendary.competitive_scores` row computed under the old
  (`bystanderLost` always `0`) logic exist, so no bump or re-score is owed
  (D-24339). Any producer wired *after* production configs exist MUST bump
  `scoringConfigVersion`.

## Acceptance Criteria

1. In `deriveScoringInputs`, a terminal `gameState` with exactly N
   `bystander`-typed cards in `escapedPile` produces
   `penaltyEventCounts.bystanderLost === N`.
2. Empty/absent `escapedPile` produces `bystanderLost === 0` (no throw).
3. An `escapedPile` mixing villain and bystander entries counts only the
   `bystander`-typed ones (villains must NOT be double-counted — they are the
   `escapes` / `ESCAPED_VILLAINS` count).
4. The derived count flows through `buildScoreBreakdown` into
   `penaltyBreakdown.bystanderLost` (= count × `penaltyEventWeights.bystanderLost`)
   and into `weightedPenaltyTotal` / `rawScore`.
5. **Control-revert is non-vacuous:** reverting either derivation to `0` fails at
   least one test.
6. `deriveScoringInputsFromFinalState` (PAR-calibration path) produces the same
   `bystanderLost === N` for the same terminal state — the two copies are
   symmetric; a Bystander carried away via the **scheme-twist** escape path is
   counted (not only the reveal path).
7. `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0;
   whole-workspace `pnpm -r --no-bail test` exits 0.
8. Sentinel `finalStateHash` + `PRE_WP080_HASH` **byte-identical** (no new `G`
   field) — STOP and investigate on any shift.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → 0; the new `bystanderLost`
   tests (logic + aggregator) are present and pass; total count rose.
3. Control-revert: temporarily restore `bystanderLost = 0` in each function →
   the corresponding tests fail; restore.
4. `pnpm -r --no-bail test` → whole workspace 0-fail.
5. `pnpm -r build` → 0; `git status` shows no unexpected regenerated-artifact
   drift (this WP touches no card data or generated feed).
6. Confirm sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged.
7. `pnpm wiki-viewer:check-links` → 0 (the `wiki/scoring.md` edit resolves).

## Definition of Done

- [ ] Both `deriveScoringInputs` and `deriveScoringInputsFromFinalState` derive
      `bystanderLost` from `G.escapedPile`; safe-skips removed; `// why:` updated.
- [ ] Tests added (AC-1..AC-6) and green; control-revert non-vacuous in both
      suites.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` 0;
      `pnpm -r --no-bail test` 0; `pnpm -r build` 0; `wiki-viewer:check-links` 0.
- [ ] Sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical.
- [ ] `wiki/scoring.md` `bystanderLost` status flipped to live.
- [ ] D-24339 flipped Active; `STATUS.md`, `WORK_INDEX.md` (`[x]`), `EC_INDEX.md`
      (Done), roadmap node ✅ + `roadmap:counts:check` 0.
- [ ] **No files outside `## Files Expected to Change` were modified**
      (`git diff --name-only` matches the allowlist).

## Vision Alignment

Triggers §17.1 #1 (scoring / PAR) and #2 (leaderboards). **Serves VISION §20–26**
(PAR-Based Scenario Scoring; the two-layer `finalScore = rawScore − parScore`
model): wiring the highest-severity missing penalty producer makes the Final
Score measure execution quality more faithfully, and wiring it symmetrically in
the PAR-calibration path keeps §26's simulated baseline consistent with the live
score it normalizes. Honors **§22** (immutability / version-pinning): no
persisted score or published baseline is retroactively altered — the change
lands before any production config or competitive-score row exists, and
`scoringConfigVersion` semantics are preserved. Honors **§24** (replay-verified,
deterministic scoring): the derivation is pure and reads existing terminal
state, so it is fully reproducible and adds no non-determinism. **No conflict**
with any Vision clause. **NG-1 (no pay-to-win):** untouched — this is a scoring
fidelity fix with no monetization or advantage-for-pay surface. **Determinism
preserved:** no new `G` field, no `ctx.random`; `finalStateHash` /
`PRE_WP080_HASH` byte-identical.

## User-Visible Impact

**User-Visible Surface = play.legendary-arena.com** (leaderboard / Final Score —
a match that lets civilians be carried away now scores worse, and PAR baselines
reflect that loss). **D-24026 live-verify operator-pending.** Note: no production
`ScenarioScoringConfig` exists yet, so the observable effect lands once a
scenario config is authored; the engine derivation is correct regardless, and
STATUS.md should record "engine producer live; player-observable once a
production scoring config is authored."

## §20 (Funding / support affordances)

**N/A** — engine scoring derivation only; no navigation, registry, profile, or
funding affordance is added, and no user-visible donate/support copy is
introduced.

## Lint Gate Self-Review (00.3)

Run against this WP after the fixes below; all 21 sections PASS or explicit N/A.
Recorded verdict: **ALL PASS / N/A** after the independent 00.3 subagent's five
FAILs (§1 Non-Negotiable Constraints, §2 constraints block + 00.6 reference, §15
scope-boundary checkbox, §17 Vision Alignment with clause numbers, §20 justified
N/A) were resolved in this revision, plus the §15.1 `## User-Visible Impact`
placement concern. §21 confirmed N/A (no HTTP endpoint; `deriveScoringInputs`
keeps its signature and return shape).

## Gate Verdicts

Run as three independent subagents against the WP+EC, then re-run after the
revision (01.0a Step 5 re-run rule).

- **Pre-flight (01.4):** **READY TO EXECUTE.** RS-1 ("sole writer" imprecision)
  and RS-2 (the `par.aggregator` mirror also safe-skips) both folded — the
  mirror is now in scope and the writer framing corrected.
- **Copilot (01.7):** RISK → **PASS on re-run.** Findings #1 (false "sole
  writer" claim), #2 (`wiki/scoring.md` status drift — now in scope), #3 (state
  the no-persisted-score premise — now in the Contract) all resolved; the new
  symmetric-scope decision confirmed sound. Final nit folded: the executor also
  corrects the stale `par.aggregator.ts` JSDoc ("all five … safe-skip" → three).
- **Lint (00.3):** FAIL → **ALL PASS / N/A on re-run** after the §1/§2/§15/§17/§20
  fixes (Non-Negotiable Constraints, 00.6 reference, scope-boundary checkbox,
  Vision Alignment with clause numbers, justified §20) plus the
  `## User-Visible Impact` section. §21 confirmed N/A.

## History

- Reserves **D-24339** (Drafted 2026-08-11). Reserved in
  [NUMBER-LEDGER](../NUMBER-LEDGER.md): WP-528 / EC-563 / D-24339.
- Hard-deps: **WP-048 ✅** (PAR scoring pipeline) + **D-24314 ✅** (bystander
  carry-away into `G.escapedPile`).
