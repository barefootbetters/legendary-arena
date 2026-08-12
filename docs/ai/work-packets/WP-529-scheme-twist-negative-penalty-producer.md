# WP-529 — Wire the `schemeTwistNegative` Penalty Producer (count scheme twists from `G.counters.schemeTwistCount`)

**Layer:** Game Engine (`packages/game-engine`)
**EC:** [EC-564](../execution-checklists/EC-564-scheme-twist-negative-penalty-producer.checklist.md)
**Status:** Draft 2026-08-11
**Baseline:** drafted off `origin/main` @ `8c996b5d` (reserve-first: WP-529/EC-564/D-24340 claimed via a prior minimal ledger commit)
**Lane:** standard two-session (PAR / scoring is barred from the Lightweight Lane per 01.0a §Eligibility gate #6)

## Goal

Make the `schemeTwistNegative` penalty **actually count** in match scoring.
Today **both** score-derivation paths hard-code `schemeTwistNegative` to `0` as
a D-4801 safe-skip — `deriveScoringInputs` (real-match / leaderboard) and
`deriveScoringInputsFromFinalState` (the PAR-calibration simulation path in
`par.aggregator.ts`) — so the villain's scheme advancing is invisible to a
match's Final Score, and PAR baselines are calibrated as if scheme twists carry
no cost. This WP replaces **both** safe-skips with the same pure, end-of-match
derivation: `schemeTwistNegative = G.counters.schemeTwistCount ?? 0` — a direct
counter read, exactly like `villainEscaped` reads
`G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`. It is the third of the five
`PenaltyEventType` producers to go live (after `villainEscaped` and
`bystanderLost` / WP-528), and the sibling of WP-528.

## Assumes

- **WP-048 ✅** — the PAR scoring type family, `ScoringInputs`,
  `deriveScoringInputs`, `PenaltyEventType`, and the Raw Score formula that
  multiplies `penaltyEventCounts.schemeTwistNegative` by the config's
  `penaltyEventWeights.schemeTwistNegative`. The consuming arithmetic already
  iterates `PENALTY_EVENT_TYPES`, so a non-zero count flows through with no
  contract change; only the producer is missing.
- **A durable scheme-twist counter already exists.** Every revealed scheme
  twist increments `G.counters.schemeTwistCount` via
  `buildGenericTwistEffects` (`rules/schemeHandlers.ts` — a `modifyCounter`
  `RuleEffect` with `counter: 'schemeTwistCount'`, `delta: 1`), and the
  twist-loss doom-clock
  compares that counter against the scheme's `lossThreshold` (D-24178). The
  counter increments for **every** scheme twist — including the Mystique
  escape→twist path (`villainDeck.reveal.ts`) and schemes whose twist-count loss
  is suppressed by a `resourceLossCondition` (the increment still runs; only the
  loss latch is suppressed). So the total is durably present in the terminal
  `G` — nothing new to model, no invented mechanic.
- **End-of-match derivation is the contract (D-4804).** Both functions run only
  against a terminal `G`; reading `G.counters.schemeTwistCount` there is
  consistent with how `escapes` (also a counter read) is derived.

## Context (Read First)

`schemeTwistNegative` has been specified-but-unproduced since WP-048: of the
five `PenaltyEventType` values only `villainEscaped` has a producer; the other
four safe-skip to `0` (D-4801) in both derivation functions. WP-528 wires
`bystanderLost`; this WP wires `schemeTwistNegative` — its sibling.

**The design decision this WP locks (D-24340): `schemeTwistNegative` counts
*every* scheme twist, not a "negative-polarity" subset.** The
[Scoring](../../../wiki/scoring.md) doc previously anticipated "a discriminated
scheme-twist outcome projection" — i.e. classifying each twist as negative or
not. A faithful reading **dissolves** that: in Legendary a Scheme Twist *is* the
villain's clock — every twist advances the scheme against the players, and there
is no beneficial scheme twist. The community/rulebook Total Score confirms it:
it subtracts `3 × (Number of Scheme Twists)` — **every** twist, unconditionally.
So the faithful, rulebook-consistent producer is simply the count of twists
flipped, which `G.counters.schemeTwistCount` already holds. No per-twist
polarity model is needed or correct.

**Why now:** the same cross-system review that motivated WP-528 (this project's
PAR scoring vs. the community "Legendary Leagues" ranking) surfaced the 4:3:1
rulebook penalty ratio — bystander `4` : scheme-twist `3` : escaped-villain `1`.
Wiring `schemeTwistNegative` closes the middle term. (Re-anchoring the actual
per-config weights to that ratio is a **separate** future concern — no
production `ScenarioScoringConfig` exists yet, and note the test fixture
currently sets `schemeTwistNegative: 50 < villainEscaped: 100`, the *opposite* of
the 4:3:1 ordering — a weight-authoring fix, out of scope here.)

**Why a counter read, not new state:** `G.counters.schemeTwistCount` already
exists and is durable to end-of-match, so the producer adds **no** `G` field.
`finalStateHash` / `PRE_WP080_HASH` stay byte-identical — no re-pin (the same
property WP-528 preserved).

**Why both derivation copies:** `deriveScoringInputsFromFinalState`
(`par.aggregator.ts`) scores the Monte-Carlo games that produce a scenario's PAR
baseline. Counting `schemeTwistNegative` only on the real-match path would make
calibrated PAR baselines systematically too easy on twist-heavy scenarios.
Wiring both keeps calibration and live score symmetric (the WP-528 lesson).

## Non-Negotiable Constraints

- **Engine-layer purity.** Both derivation functions stay pure, deterministic,
  side-effect-free, end-of-match, and read `G` without mutating it
  (D-4802 / D-4804). No `ctx.random`, no `boardgame.io` import, no I/O.
- **No new `G` field.** Derive from the existing `G.counters.schemeTwistCount`.
  Adding a field would force a `finalStateHash` / `PRE_WP080_HASH` dual re-pin —
  STOP if tempted.
- **No contract-file edit.** `PenaltyEventType` and `PENALTY_EVENT_TYPES`
  (`parScoring.types.ts`) are unchanged; `ScoringInputs` / `ScoreBreakdown` keep
  their shape.
- **Locked derivation:** `schemeTwistNegative = gameState.counters.schemeTwistCount ?? 0`.
  Applied identically in `deriveScoringInputs` and
  `deriveScoringInputsFromFinalState`. The `?? 0` mirrors the lazy-counter
  pattern used for `escapes`.
- **Count all twists** — this is D-24340; do NOT filter by any polarity/outcome
  classification.
- **Full file contents** for every changed file (no diffs/snippets). ESM-only,
  Node v22+. Human-style code — see
  [`docs/ai/REFERENCE/00.6-code-style.md`](../REFERENCE/00.6-code-style.md)
  (`// why:` + JSDoc; explicit constant naming).
- **Session protocol:** one WP per session; scaffold-first (below) before the
  READY claim; two-commit topology (`EC-564:` + `SPEC:`).

## Scope (In)

- Replace the `schemeTwistNegativeCount = 0` safe-skip in `deriveScoringInputs`
  (`packages/game-engine/src/scoring/parScoring.logic.ts`) with
  `gameState.counters.schemeTwistCount ?? 0` + updated `// why:` (D-24340
  rationale).
- Replace the identical `schemeTwistNegative: 0` safe-skip in
  `deriveScoringInputsFromFinalState`
  (`packages/game-engine/src/simulation/par.aggregator.ts`) with the same
  counter read + updated `// why:`; correct the stale function JSDoc that claims
  all remaining penalties safe-skip.
- Add unit tests in `scoring/parScoring.logic.test.ts` and
  `simulation/par.aggregator.test.ts` covering the ACs below.
- Update [`wiki/scoring.md`](../../../wiki/scoring.md) for the now-live producer.
  This is more than a one-row flip (copilot 01.7 finding): (a) flip the
  `schemeTwistNegative` producer-table row + status-list line to
  "live — counts `G.counters.schemeTwistCount` (D-24340)"; (b) **rewrite the
  polarity language at the "scheme-twist outcomes that qualify" prose** — that
  "qualify per the per-scenario penalty config" framing is exactly what D-24340
  rejects; replace with "counts **every** scheme twist via
  `G.counters.schemeTwistCount` (no polarity/qualification)"; (c) reconcile the
  stale "only `villainEscaped` has a producer" / "the other four … `0`" /
  "not yet produced" prose; (d) **the section heading "Penalty producer status —
  four of five safe-skip to zero" and its slug are referenced by three internal
  links** — do NOT silently change the count in the heading (it breaks those
  anchors and fails `wiki-viewer:check-links`). Rename the heading to a
  **count-neutral** title (e.g. "Penalty producer status") and update all three
  referencing links to the new slug **atomically**, then confirm
  `wiki-viewer:check-links` reports 0 broken anchors. **Coordination with WP-528:**
  WP-528 (`bystanderLost`) touches the same heading/table and the same
  `par.aggregator.ts` JSDoc; phrase the heading count and the JSDoc against this
  branch's **actual** producer set at execution time (do not assume `bystanderLost`
  is live unless WP-528 has merged into this base), and re-check the shared row +
  anchor for a merge conflict before the SPEC commit.
- Land D-24340 (the count-all-twists semantic + derivation-source decision).

## Out of Scope

- **The other producers** — `bystanderLost` (WP-528, in flight),
  `mastermindTacticUntaken`, `scenarioSpecificPenalty` — not touched here.
- **Re-anchoring per-config penalty weights** to the 4:3:1 rulebook ratio, and
  authoring production `ScenarioScoringConfig`s. The producer is
  config-independent; whatever weight a config carries multiplies the new count.
- **`computeParScore`** — the PAR baseline carries no scheme-twist term (a
  baseline is expressed via `ParBaseline` fields); it keeps
  `schemeTwistNegative: 0`. (Distinct from `deriveScoringInputsFromFinalState`,
  which scores *simulated games* and IS in scope.)
- **Any per-twist polarity/outcome classification.** D-24340 rejects it as
  unfaithful; every twist counts.
- **Any new `G` field or counter.** Counter already exists.

## Files Expected to Change

- `packages/game-engine/src/scoring/parScoring.logic.ts` — **modified** —
  `deriveScoringInputs`: counter read + `// why:`.
- `packages/game-engine/src/scoring/parScoring.logic.test.ts` — **modified** —
  AC-1..AC-4 tests.
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** —
  `deriveScoringInputsFromFinalState`: same counter read + `// why:`; JSDoc fix.
- `packages/game-engine/src/simulation/par.aggregator.test.ts` — **modified** —
  AC-5 symmetry test.
- `wiki/scoring.md` — **modified** — flip the `schemeTwistNegative` producer
  status to live.
- `docs/ai/DECISIONS.md` — **modified** — D-24340 flips Drafted → Active.
- Governance close: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`
  (glyph 📝 → ✅ + counts refresh), `docs/ai/STATUS.md`.

> **Scaffold-first (01.0a Step 3 / 01.4 Empirical Scaffold).** This WP changes a
> derived score, so it can break any existing fixture/test that ends with a
> non-zero `schemeTwistCount` and asserts a specific `rawScore` / `finalScore` /
> `penaltyEventCounts` (in either the logic or the aggregator suite). The
> executor MUST prototype both derivations and run
> `pnpm --filter @legendary-arena/game-engine test` **before** claiming scope is
> locked, and fold every observed break into this allowlist. Do not reason "it's
> additive."

## Contract

- `deriveScoringInputs(replayResult, gameState)` and
  `deriveScoringInputsFromFinalState(finalState, turnCount)` return
  `ScoringInputs` unchanged in **shape**; only
  `penaltyEventCounts.schemeTwistNegative` changes from a constant `0` to
  `gameState.counters.schemeTwistCount ?? 0`.
- No change to `ScoringInputs`, `ScoreBreakdown`, `ScenarioScoringConfig`,
  `PenaltyEventType`, or `PENALTY_EVENT_TYPES` (no contract-file edit).
- No new `G` / `LegendaryGameState` field. `G` and `ctx` remain runtime-only.
- Derivation is pure, deterministic, end-of-match, reads `G` without mutating it
  (D-4802 / D-4804).
- **No persisted score is invalidated.** `scoringConfigVersion` versions the
  *config*, not the derivation; no production `ScenarioScoringConfig` and no
  persisted `legendary.competitive_scores` row computed under the old
  (`schemeTwistNegative` always `0`) logic exist, so no bump or re-score is owed
  (D-24340). Any producer wired *after* production configs exist MUST bump
  `scoringConfigVersion`.

## Acceptance Criteria

1. In `deriveScoringInputs`, a terminal `gameState` with
   `counters.schemeTwistCount === N` produces
   `penaltyEventCounts.schemeTwistNegative === N`.
2. A terminal `gameState` with no `schemeTwistCount` counter (absent) produces
   `schemeTwistNegative === 0` (the `?? 0` lazy-counter path).
3. The derived count flows through `buildScoreBreakdown` into
   `penaltyBreakdown.schemeTwistNegative` (= count × the config weight) and into
   `weightedPenaltyTotal` / `rawScore`.
4. **Control-revert is non-vacuous:** reverting either derivation to `0` fails at
   least one test.
5. `deriveScoringInputsFromFinalState` (PAR-calibration path) produces the same
   `schemeTwistNegative === N` for the same terminal state — the two copies are
   symmetric.
6. `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0;
   whole-workspace `pnpm -r --no-bail test` exits 0.
7. Sentinel `finalStateHash` + `PRE_WP080_HASH` **byte-identical** (no new `G`
   field) — STOP and investigate on any shift.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → 0; the new
   `schemeTwistNegative` tests (logic + aggregator) pass; total count rose.
3. Control-revert: temporarily restore `schemeTwistNegative = 0` in each
   function → the corresponding tests fail; restore.
4. `pnpm -r --no-bail test` → whole workspace 0-fail.
5. `pnpm -r build` → 0; `git status` shows no unexpected regenerated-artifact
   drift.
6. Confirm sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged.
7. `pnpm wiki-viewer:check-links` → 0.

## Definition of Done

- [ ] Both `deriveScoringInputs` and `deriveScoringInputsFromFinalState` derive
      `schemeTwistNegative` from `G.counters.schemeTwistCount`; safe-skips
      removed; `// why:` updated; aggregator JSDoc corrected.
- [ ] Tests added (AC-1..AC-5) and green; control-revert non-vacuous in both
      suites.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` 0;
      `pnpm -r --no-bail test` 0; `pnpm -r build` 0; `wiki-viewer:check-links` 0.
- [ ] Sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical.
- [ ] `wiki/scoring.md` `schemeTwistNegative` status flipped to live.
- [ ] D-24340 flipped Active; `STATUS.md`, `WORK_INDEX.md` (`[x]`), `EC_INDEX.md`
      (Done), roadmap node ✅ + `roadmap:counts:check` 0.
- [ ] **No files outside `## Files Expected to Change` were modified**
      (`git diff --name-only` matches the allowlist).

## Vision Alignment

Triggers §17.1 #1 (scoring / PAR) and #2 (leaderboards). **Serves VISION §20–26**
(PAR-Based Scenario Scoring; the two-layer `finalScore = rawScore − parScore`
model): wiring the scheme-twist penalty makes the Final Score reflect how much
the villain's clock advanced, and wiring it symmetrically in the PAR-calibration
path keeps §26's simulated baseline consistent with the live score. Honors
**§22** (immutability / version-pinning): no persisted score or published
baseline is retroactively altered — the change lands before any production
config or competitive-score row exists. Honors **§24** (replay-verified,
deterministic scoring): the derivation is a pure counter read of existing
terminal state, fully reproducible, adding no non-determinism. **No conflict**
with any Vision clause. **NG-1 (no pay-to-win):** untouched — a scoring-fidelity
fix with no monetization surface. **Determinism preserved:** no new `G` field,
no `ctx.random`; `finalStateHash` / `PRE_WP080_HASH` byte-identical.

## User-Visible Impact

**User-Visible Surface = play.legendary-arena.com** (leaderboard / Final Score —
a match in which more scheme twists flipped now scores worse, and PAR baselines
reflect that cost). **D-24026 live-verify operator-pending.** Note: no production
`ScenarioScoringConfig` exists yet, so the observable effect lands once a
scenario config is authored; the engine derivation is correct regardless, and
STATUS.md should record "engine producer live; player-observable once a
production scoring config is authored."

## §20 (Funding / support affordances)

**N/A** — engine scoring derivation only; no navigation, registry, profile, or
funding affordance is added, and no user-visible donate/support copy is
introduced.

## Lint Gate Self-Review (00.3)

Recorded verdict after the 00.3 gate run: all 21 sections PASS or explicit N/A
(§21 N/A — no HTTP endpoint; `deriveScoringInputs` keeps its signature and
return shape). Structure mirrors the WP-528 sibling that cleared 00.3.

## Gate Verdicts

Run as three independent subagents against the WP+EC.

- **Pre-flight (01.4):** **READY TO EXECUTE.** RS items folded: the counter
  effect is `modifyCounter`/`delta:1` (wording corrected); the scaffold now runs
  `pnpm -r --no-bail test` (cross-package consumers of `deriveScoringInputs`);
  the `par.aggregator.ts` JSDoc must reflect the branch's actual producer set at
  execution time (WP-528 may not have executed yet).
- **Copilot (01.7):** RISK → resolved in-place. Both findings folded — the
  `wiki/scoring.md` scope now enumerates the count-neutral heading rename + the
  three referencing anchors + the polarity-language rewrite (the
  `wiki-viewer:check-links` hazard), and the WP-528 coordination note (shared
  heading + shared aggregator JSDoc; phrase against the actual branch state).
- **Lint (00.3):** **ALL PASS / N/A** — all required sections present (modeled on
  the WP-528 sibling); §17 cites clause numbers, §20 justified, §21 N/A, DoD
  scope-boundary checkbox present.

## History

- Reserves **D-24340** (Drafted 2026-08-11). Reserved-first in
  [NUMBER-LEDGER](../NUMBER-LEDGER.md): WP-529 / EC-564 / D-24340.
- Sibling of **WP-528** (`bystanderLost` producer).
- Hard-deps: **WP-048 ✅** (PAR scoring pipeline) + **D-24178 ✅** (per-scheme
  twist-loss threshold; documents `G.counters.schemeTwistCount` as the durable
  per-match twist counter).
