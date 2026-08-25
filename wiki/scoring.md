---
title: Scoring
type: System
tags:
  - layer-engine
  - scoring
  - par
  - leaderboard
  - determinism
  - persistence
  - drift-detection
  - vision
related:
  - par-simulation-calibration.md
  - gameplay-strategy.md
  - leaderboard.md
  - villain-deck.md
  - master-strike.md
  - scheme-twist.md
  - scheme.md
  - rule-execution-pipeline.md
  - turn-system.md
  - cardextid.md
  - card-type-taxonomy.md
  - board-keywords.md
  - seed-challenges.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\scoring.md (this page — https://ewiki.legendary-arena.com/scoring/)
  - ../.claude/skills/legendary-game-engine/SKILL.md
  - ../packages/game-engine/src/scoring/scoring.types.ts
  - ../packages/game-engine/src/scoring/parScoring.types.ts
  - ../packages/game-engine/src/scoring/parScoring.keys.ts
  - ../packages/game-engine/src/scoring/parScoring.logic.ts
  - ../packages/game-engine/src/scoring/scoring.logic.ts
  - ../packages/game-engine/src/scoring/scoringConfigLoader.ts
  - ../docs/01-VISION.md
  - ../docs/12-SCORING-REFERENCE.md
  - ../docs/12.1-PAR-ARTIFACT-INTEGRITY.md
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/ai/work-packets/WP-020-vp-scoring-win-summary-minimal-mvp.md
  - ../docs/ai/work-packets/WP-027-determinism-replay-verification-harness.md
  - ../docs/ai/work-packets/WP-048-par-scenario-scoring-leaderboards.md
  - ../docs/ai/work-packets/WP-049-par-simulation-engine.md
  - ../docs/ai/work-packets/WP-050-par-artifact-storage.md
  - ../docs/ai/work-packets/WP-051-par-publication-server-gate.md
  - ../docs/ai/work-packets/WP-053a-par-artifact-scoring-config.md
  - ../docs/ai/work-packets/WP-422-seed-par-publication.md
  - ../docs/10-GLOSSARY.md
last-reviewed: 2026-08-22
---

# Scoring

## Summary

Scoring is the engine's two-layer measurement system: a per-match
**Final Score** computed from match outcomes, normalized against a
per-scenario **PAR baseline** that represents competent rules-faithful
play. Both layers are end-of-match-only, deterministic, JSON-
serializable, and config-version-pinned so historical results stay
comparable. The structural separation between *how hard the scenario
is* (PAR) and *how heroic you were inside it* (Final Score) is locked
by VISION §20–26 and is the architectural anchor for every leaderboard
surface.

## Mechanics

### The two-layer model

The system has two distinct measurement layers, mirroring the golf
metaphor in [VISION §20](../docs/01-VISION.md):

- **Layer A — PAR (course rating).** Static per-scenario expected
  outcome for a competent team. Encoded as `ParBaseline` (rounds,
  bystanders, victory points, escapes). Never adapts to the team
  that played. Day-one it is the **content-driven seed** (WP-422 /
  D-24242 — a difficulty-mapped `ParBaseline`, `parValue =
  computeParScore(baseline)`, published per gauntlet season and stamped
  `calibrationStatus: "uncalibrated"`); simulation later **supersedes**
  the seed with a Monte-Carlo baseline — see
  [PAR Simulation Calibration](par-simulation-calibration.md) for both
  the seed ratings and the pipeline that recalibrates them.
- **Layer B — Final Score (execution quality).** Computed per
  match: `finalScore = rawScore - parScore`. Lower is better;
  negative is under PAR. Driven by the same formula applied to the
  match's `ScoringInputs` and to the scenario's `ParBaseline`, then
  subtracted.

This page documents the layer separation, the type contracts, the
determinism invariants, and the persistence boundary. The numerical
formula and worked weight values live in
[`docs/12-SCORING-REFERENCE.md`](../docs/12-SCORING-REFERENCE.md) and
are not duplicated here.

### Identity keys

Two canonical string keys identify a scoring context:

- **`ScenarioKey`** — `"{schemeSlug}::{mastermindSlug}::{sorted-villainGroupSlugs-joined-by-+}"`,
  built by `buildScenarioKey` in
  [`parScoring.keys.ts`](../packages/game-engine/src/scoring/parScoring.keys.ts).
- **`TeamKey`** — `"{sorted-heroSlugs-joined-by-+}"`, built by
  `buildTeamKey`.

Both keys are **never constructed by hand**. The sort + join
algorithm is the only valid construction path; producing keys from
unsorted slug lists silently breaks leaderboard joins.

### Self-contained scenario configs (D-4805)

Every scenario carries a complete `ScenarioScoringConfig`:

```ts
interface ScenarioScoringConfig {
  scenarioKey: ScenarioKey;
  weights: ScoringWeights;
  caps: ScoringCaps;
  penaltyEventWeights: PenaltyEventWeights;
  parBaseline: ParBaseline;
  scoringConfigVersion: number;
  createdAt: string;   // ISO-8601, class-2 metadata
  updatedAt: string;   // ISO-8601, class-2 metadata
}
```

The reference defaults in
[`12-SCORING-REFERENCE.md`](../docs/12-SCORING-REFERENCE.md) are
**authoring guidance, not runtime merge targets** — `validateScoringConfig`
rejects any configuration missing any required field, including any
`PenaltyEventType` key. A scenario config is either valid in full or
invalid in full; partial configs do not run.

### Integer-encoded weights (centesimal)

`ScoringWeights` and `PenaltyEventWeights` are **integers**, not
floats. The
[`parScoring.types.ts`](../packages/game-engine/src/scoring/parScoring.types.ts)
header is explicit: weights are stored at centesimal precision (×100)
to avoid floating-point determinism issues; display layers divide by
100 to render decimal values. The engine never sees fractional
weights. This is one of the determinism invariants and is non-
negotiable across all platforms (Windows / Linux / Render hosts).

As of **WP-599 / D-24409**, `ScoringWeights` no longer carries a
`bystanderReward` field — the invented per-bystander rescue reward was
removed, and a rescued bystander now scores only its printed 1 VP through
the `victoryPointReward` term. Victory points are the sole reward.

### `scoringConfigVersion` pin

Every `ScoreBreakdown` and `LeaderboardEntry` carries the integer
`scoringConfigVersion` of the config that produced it. The version
increments on **any** weight, cap, or PAR change. Consumers compare
results only against peers under the same version; cross-version
comparison is never silently allowed. This is the immutability
guarantee VISION §22 requires: "Once declared, PAR baselines are
immutable for the purpose of competition."

### `PenaltyEventType` closed taxonomy

```ts
type PenaltyEventType =
  | 'villainEscaped'
  | 'bystanderLost'
  | 'schemeTwistNegative'
  | 'mastermindTacticUntaken'
  | 'scenarioSpecificPenalty';
```

`PENALTY_EVENT_TYPES` is the canonical readonly array, kept in
one-to-one correspondence via drift-detection tests. Each type has
its own integer weight; there is no shared escape multiplier. Per
the source `// why:` comment, the per-event weights encode the
moral hierarchy from VISION §21 (e.g., `bystanderLost` is more
severe than `villainEscaped`).

### Derivation boundary (D-4801, D-4804)

`ScoringInputs` is derived from a completed match by
`deriveScoringInputs(replayResult, finalGameState)`:

- **End-of-match only (D-4804).** Callers must not invoke the
  derivation mid-match; partial state produces invalid scoring.
- **Team-aggregate VP (D-4803).** `victoryPoints` is summed across
  all players, not stored per-player.
- **Replay-driven, turns-native.** `rounds` is the completed
  play-turn count (`replayResult.turnCount`), matching how the PAR
  baselines were calibrated. An earlier MVP used `moveCount` as a
  proxy; D-24123 / D-24125 re-based the metric to turns when the
  live submission path shipped (see
  [Leaderboard](leaderboard.md) for that pipeline).

The derivation step is the single boundary between match runtime
and the scoring system. Once `ScoringInputs` exists, the rest of
the pipeline is pure.

#### Penalty producer status

**Three of the five `PenaltyEventType` values have an engine producer today —
`villainEscaped`, `schemeTwistNegative`, and `bystanderLost`.** The first two are
pure end-of-match counter reads; `bystanderLost` counts the Bystander
entries of `G.escapedPile` — where "Bystander" means **either** a villain-deck
Bystander **or** a supply-pile Bystander (`BYSTANDER_EXT_ID`), resolved through the
shared `isBystanderCard` predicate (WP-586 / D-24395). The remaining two are hardcoded to `0` in
`deriveScoringInputs` as D-4801 safe-skips, each with a `// why:` comment naming
its deferred follow-up:

| Penalty event | Producer | Status |
|---|---|---|
| `villainEscaped` | `ENDGAME_CONDITIONS.ESCAPED_VILLAINS` counter | **live** |
| `bystanderLost` | `G.escapedPile` (via `isBystanderCard`) | **live** — counts civilians carried away by escaping Villains, from **both** villain-deck and supply-pile Bystander sources (WP-528 / D-24339; two-source count corrected WP-586 / D-24395) |
| `schemeTwistNegative` | `G.counters.schemeTwistCount` counter | **live** — counts every scheme twist (WP-529 / D-24340; no polarity classification) |
| `mastermindTacticUntaken` | none | safe-skip `0` — derivable at endgame, but the semantics need per-turn history |
| `scenarioSpecificPenalty` | none | safe-skip `0` — no generic producer; awaits structured scenario events |

This is load-bearing for anyone reasoning about live scores. The
weights and their structural invariants are fully specified and
validated, but a penalty with no producer contributes nothing to
`weightedPenaltyTotal`. `bystanderLost` — which the sole surviving
structural invariant ranks above `villainEscaped` (WP-599 removed the two
invariants that referenced the deleted rescue reward) — is **now produced**
(from the escaped pile), so a match that lets civilians be carried away *is*
scored on that loss. There is no longer a separate rescue reward: as of
WP-599 / D-24409 a rescued bystander scores only its printed 1 VP through the
victory-point term (the bystander count is still derived from the victory pile,
but as a VP contributor and an informational stat, not a standalone reward).
Both the loss count and the rescued-bystander count use **both** Bystander
sources — villain-deck and supply-pile — through the shared `isBystanderCard`
predicate, so the competitive score, the per-player VP tally, and the HUD
rescue count always agree on what a Bystander is (WP-586 / D-24395; before that
fix the scoring derivation counted only villain-deck Bystanders and
undercounted rescues).

Do not describe a still-safe-skipped penalty as "counted from" anything until
its producer lands. Player-facing guidance written against the
specification rather than the implementation has already drifted
once on exactly this point.

#### External weight anchor — the rulebook 4 : 3 : 1 penalty ratio

The community [Legendary Leagues](https://www.legendaryleagues.com/about/ranking)
ranking system scores a match with the rulebook Total Score
`VP − 4·(bystanders carried away) − 3·(scheme twists) − 1·(escaped villains)`.
Read as a *ratio*, that is independent corroboration of the moral
hierarchy `penaltyEventWeights` encode (VISION §21): a lost bystander
outweighs a scheme twist, which outweighs an escaped villain, **4 : 3 : 1**.
All three of those terms are now produced — `bystanderLost` (WP-528 / D-24339),
`schemeTwistNegative` (WP-529 / D-24340), and `villainEscaped` (already live) —
so the 4 : 3 : 1 ratio was a ready-made seed for their relative weights rather
than a number invented from scratch. **It is now the adopted reference default**
(D-24342 / WP-531, rescaled by WP-599 / D-24409): the scoring reference and the
test scenario config carry `bystanderLost 40 / schemeTwistNegative 30 /
villainEscaped 10`, with the escape as the 1-VP unit (was `400 / 300 / 100`
before WP-599 put the penalties on true VP-units — 1 VP = 10 centesimal, the same
scale as the VP reward). WP-599 also **removed the separate bystander-rescue
reward**: the rulebook gives no positive rescue bonus (only the −4 penalty for a
lost civilian), so a rescued bystander now scores only its printed 1 VP and the
moral hierarchy rests entirely on the heavy `bystanderLost` penalty — faithful to
the rulebook. This remains an anchor for the *ordering and rough
magnitude*, **not** a replacement for calibration — the published weights remain
whatever `validateScoringConfig` accepts under a pinned `scoringConfigVersion`,
and a simulation-calibrated production config supersedes the seed. The full contrast between this absolute PAR model and
the ordinal league model — pros, cons, and other borrowings — lives on
[PAR Simulation Calibration §Comparison](par-simulation-calibration.md#comparison-absolute-par-vs-ordinal-league-ranking).

### Pipeline shape

```
ScoringInputs ──┐
                ├──> buildScoreBreakdown ──> ScoreBreakdown
ScenarioConfig ─┘                                │
                                                 ├──> LeaderboardEntry
ReplayHash ──────────────────────────────────────┘    (server-built)
```

`ScoreBreakdown` is the immutable result the engine returns:
`weightedPenaltyTotal`, `penaltyBreakdown`,
`weightedVictoryPointReward`, `rawScore`,
`parScore`, `finalScore`, plus the inputs and version pin. Every
intermediate component is exposed so leaderboard UIs and
post-match summaries never recompute. (WP-599 / D-24409 removed
`weightedBystanderReward` — victory points are the sole reward term, and
rescued bystanders score as 1 VP inside `weightedVictoryPointReward`. There is
also no per-round cost — the rulebook has no round penalty; Scheme Twists carry
game length. WP-585.)

`LeaderboardEntry` (defined in the engine, instantiated in the
server) wraps a `ScoreBreakdown` with `replayHash` (WP-027
`computeStateHash` output), `playerIdentifiers`, and the same
`scoringConfigVersion` pin.

### JSON-serializable invariant (D-4806)

Every public scoring type must survive
`JSON.parse(JSON.stringify(…))` with structural equality. No
functions, Maps, Sets, Dates, or class instances appear in any
exported type. This invariant is what makes scoring results safe to
persist as snapshots, ship to the leaderboard server, and replay
deterministically across deploys.

### MVP VP table (Layer-A inputs only)

The MVP victory-point inventory in
[`scoring.types.ts`](../packages/game-engine/src/scoring/scoring.types.ts)
defines five named constants used to compute per-player VP from
`G.playerZones[…].victory` and the wounds piles. These are inputs
to Layer A's victory-point category — not the Final Score
formula directly. Card-text-specific VP modifiers are deferred to
future WPs per the source `// why:` comment.

## Your report card

When a match ends, the endgame screen shows your **competitive score** — lower is
better, PAR-relative — with a letter grade (Legendary / A / B / C / D / F). The card
breaks the number down so you can see exactly where it came from:

- **By player.** Each seat is named — `Player 1 (Bot)` for a bot ally,
  `Player 2 (@yourhandle)` for a signed-in human — with that seat's victory points
  and rescued bystanders. The competitive score is a shared-team score; this split is
  a display-only reconciliation that sums to the team totals.
- **Raw-score ledger.** Your raw score is shown as two columns: the **penalties** that
  raised it (scheme twists, villain escapes, bystanders lost, and a match-lost penalty
  on a loss) beside what you **earned** that lowered it — **victory points** (the sole
  reward, which already counts each rescued bystander as 1 VP). The two sides net to
  your raw score. Your rescued-bystander count is shown alongside as an informational
  stat, not a separate scored line (WP-599 removed the standalone rescue reward — a
  rescue is worth its 1 VP, and heroism is enforced by the heavy penalty for *losing*
  a civilian).
- **PAR for this scenario.** The same formula applied to what this scenario is expected
  to yield — set by its scheme, mastermind, and villain groups (not the henchmen). Your
  final score is Raw − PAR.
- **Grade scale.** The full ladder (what a B / A / Legendary needs) with your grade
  marked in place.
- **Luck of the draw.** An honest read of how the shuffle treated you: it compares the
  adversity you actually faced (scheme twists, villain escapes, bystanders lost) with
  what this scenario usually deals. A **favorable** shuffle means the deck broke your
  way; a **difficult** shuffle credits you for holding the line with a bad draw; an
  **even** shuffle is a fair test. It is a deterministic read from your score breakdown
  — the same match always reads the same way, and it never sees your deck order.

The seat identities behind the names are derived at score-submission time and are never
stored on your score row — they are display metadata only. (An opinionated AI coach that
recommends heroes and purchases is a planned Legendary-Pass feature, separate from this
objective card.)

## Interactions

- **[Gameplay Strategy](gameplay-strategy.md).** Scoring is the
  *measurement* of the skill that page models. PAR (Layer A) is the outcome
  a *competent* team should reach, and a good Final Score means the ranked
  player decisions — Hero Deck construction, play order, Mastermind timing —
  were made well. The `mastermindTacticUntaken` penalty is the scoring hook
  for that page's Rank-2 Mastermind-timing decision (specified but not yet
  produced — see [Penalty producer status](#penalty-producer-status)).
- **[Scheme](scheme.md), Mastermind, and Villain Groups.** Together
  they form the scenario identity — the `ScenarioKey` is derived
  exclusively from these slugs. PAR is keyed on the scenario, never
  on the team that plays it.
- **[Villain Deck](villain-deck.md).** Three of the five
  `PenaltyEventType` values are *specified* to source from the
  villain-deck pipeline, and all three are wired up today —
  see [Penalty producer status](#penalty-producer-status):
  - `villainEscaped` — **live**; counted from
    `ENDGAME_CONDITIONS.ESCAPED_VILLAINS`
  - `schemeTwistNegative` — **live** (WP-529 / D-24340); counts
    **every** scheme twist via `G.counters.schemeTwistCount` — no
    polarity/qualification (every Legendary twist advances the villain's
    scheme; the rulebook subtracts 3 × every twist)
  - `bystanderLost` — **live** (WP-528 / D-24339); counts the Bystander
    entries of `G.escapedPile` — both villain-deck and supply-pile Bystanders, via
    the shared `isBystanderCard` predicate (civilians an escaping Villain carried
    away, D-24314; two-source count corrected WP-586) — mirrors the `bystandersRescued`
    victory-zone count
- **[Scheme Twist](scheme-twist.md).** The `schemeTwistNegative`
  penalty event ties scoring to twist outcomes. The Scheme Twist
  page documents the trigger; this page documents the penalty
  taxonomy that consumes it.
- **Endgame.** Final scoring is end-of-match only and runs once
  `endIf` (per `evaluateEndgame` in
  [`game-engine.md` Endgame](../.claude/skills/legendary-game-engine/SKILL.md))
  has resolved. `computeFinalScores` reads `G` without mutating it
  and never triggers endgame logic.
- **Persistence.** `ScoreBreakdown` and `LeaderboardEntry` are the
  only scoring artifacts that cross the persistence boundary. `G`
  itself is never persisted (per
  [`architecture.md` "G and ctx Are Runtime-Only"](../.claude/rules/architecture.md));
  scoring summaries are derived records, not save-game state.
- **Replay verification.** `replayHash` (WP-027) is the proof that a
  `LeaderboardEntry` is reproducible by re-running the replay
  through the engine. VISION §24 requires every leaderboard entry
  be replay-verified; this hash is the structural enforcement. As of
  2026-07-09 this is live end-to-end: the server's submission route
  re-executes the captured match, recomputes the hash, and scores
  server-side — it never trusts a client number (D-5301). The full
  match → row → snapshot pipeline is documented on
  [Leaderboard](leaderboard.md).
- **[Seed Challenges](seed-challenges.md).** A *proposed* competitive board
  (see [Leaderboard](leaderboard.md)) reuses this scoring pipeline unchanged —
  a seeded match is scored identically; the shared seed removes *board*
  variance, not the scoring math.

## Edge Cases

- **Cross-version comparison is never silent.** A `ScoreBreakdown`
  produced under `scoringConfigVersion: 3` is not directly
  comparable to one under `version: 4`. Leaderboard surfaces must
  filter by version; the engine offers no implicit migration of
  historical scores. VISION §22 requires this — refinements create
  new versions, never retroactive adjustments.
- **`null` caps mean "no cap", not zero.** `ScoringCaps.bystanderCap`
  and `victoryPointCap` are `number | null`. `null` is the explicit
  sentinel for "uncapped" (per WP-029 D-2901 precedent —
  `exactOptionalPropertyTypes` is enabled, so `undefined` is not
  interchangeable with `null`).
- **Keys are slug-sorted before join.** A `ScenarioKey` built from
  `['x', 'a', 'b']` and one built from `['a', 'b', 'x']` must
  produce the same string. Hand-constructing keys without the sort
  step yields different string identities for the same scenario —
  silent leaderboard fragmentation.
- **`PenaltyEventWeights` must cover every `PenaltyEventType`.**
  `validateScoringConfig` rejects configs missing any key. There
  is no fallback to zero for unset weights; a missing weight is a
  validation error, not a silent default.
- **Drift hazard.** Adding a `PenaltyEventType` requires updating
  the union, the `PENALTY_EVENT_TYPES` array, every existing
  `ScenarioScoringConfig.penaltyEventWeights` map (since
  `validateScoringConfig` requires full coverage), and any scoring
  code that fans out on the type. The drift-detection test catches
  the array-vs-union mismatch; existing-config back-population is
  on the migration author.
- **Scoring never throws on partial state.** Engine code paths that
  encounter incomplete or malformed scoring inputs return
  validation results (`ScoringConfigValidationResult`) or push
  diagnostic messages — they do not throw. Only `Game.setup()` may
  throw per
  [`game-engine.md` Throwing Convention](../.claude/skills/legendary-game-engine/SKILL.md).
- **`computeFinalScores` is read-only.** Per the
  [10-GLOSSARY.md](../docs/10-GLOSSARY.md) entry: "reads `G` without
  mutating it. Never triggers endgame logic. Never queries the
  registry." Calling it during a match for preview purposes is
  technically possible but violates D-4804 (end-of-match only) —
  the result is not meaningful mid-match.

## Code Touchpoints

- [`packages/game-engine/src/scoring/parScoring.types.ts`](../packages/game-engine/src/scoring/parScoring.types.ts)
  — `ScenarioKey`, `TeamKey`, `ScoringWeights`, `ScoringCaps`,
  `PenaltyEventType`, `PENALTY_EVENT_TYPES`, `PenaltyEventWeights`,
  `ParBaseline`, `ScenarioScoringConfig`, `ScoringInputs`,
  `ScoreBreakdown`, `LeaderboardEntry`,
  `ScoringConfigValidationResult`
- [`packages/game-engine/src/scoring/parScoring.keys.ts`](../packages/game-engine/src/scoring/parScoring.keys.ts)
  — `buildScenarioKey`, `buildTeamKey` (canonical-form constructors)
- [`packages/game-engine/src/scoring/parScoring.logic.ts`](../packages/game-engine/src/scoring/parScoring.logic.ts)
  — `deriveScoringInputs`, `buildScoreBreakdown`,
  `validateScoringConfig`
- [`packages/game-engine/src/scoring/scoring.types.ts`](../packages/game-engine/src/scoring/scoring.types.ts)
  — VP table constants, `PlayerScoreBreakdown`, `FinalScoreSummary`;
  re-exports the PAR types
- [`packages/game-engine/src/scoring/scoring.logic.ts`](../packages/game-engine/src/scoring/scoring.logic.ts)
  — `computeFinalScores` (per-player VP aggregation; pure read of `G`)
- [`packages/game-engine/src/scoring/scoringConfigLoader.ts`](../packages/game-engine/src/scoring/scoringConfigLoader.ts)
  — config loader / validation entry point

## History

- WP-020: VP scoring + win summary; `computeFinalScores` introduced; economy-vs-scoring separation locked
- WP-027: `computeStateHash` introduced — produces the `replayHash` consumed by `LeaderboardEntry`
- WP-048: PAR type family introduced (`ScenarioKey`, `TeamKey`, `ScenarioScoringConfig`, `ScoreBreakdown`, `LeaderboardEntry`); D-4801 / D-4803 / D-4804 / D-4805 / D-4806 locked
- WP-049: PAR simulation engine — heuristic AI runs to compute the 55th-percentile baseline (per VISION §26 phase 2)
- WP-050: PAR artifact storage — server-side persistence of versioned configs
- WP-051: PAR publication server gate — server-side admission rule for new config versions
- WP-053a: `ScenarioScoringConfig` extension landed; PAR config authoring origin moved to `data/scoring-configs/` (D-5306a)
- WP-332 + D-24119 arc (WP-333 → WP-340): score-submission transport went live (submit-by-`matchId`, faithful-replay verification, server-side scoring); `rounds` re-based from move count to completed play-turn count (D-24123 / D-24125)
- INFRA PR #630 (2026-07-09): DB-gated server test baseline repaired — 11 pre-existing failures (invisible to CI, which never sets `TEST_DATABASE_URL`) fixed across the leaderboard read-layer and profile suites; the full DB-wired `apps/server` suite is 848/848 green serialized, so scoring/leaderboard test failures against a live test DB are regressions from here on
- WP-585 + D-24394 (2026-08-22): rulebook-faithful scoring — the per-round cost (`roundCost` / `roundsPar` / `weightedRoundCost`) was **fully removed** (the printed rulebook has no round/turn penalty; Scheme Twists are its length proxy), so `RawScore = Penalties − (BP × bystanderReward) − (VP × vpReward)`; `scoringConfigVersion 2→3`, `rawScoreSemanticsVersion 1→2`; 128 seed PAR artifacts regenerated with no retroactive invalidation of existing rows
- WP-586 + D-24395 (2026-08-22): the competitive-score derivation **undercounted rescued Bystanders** — it counted only villain-deck Bystanders and dropped supply-pile Bystanders (`BYSTANDER_EXT_ID`) from both `bystandersRescued` and `bystanderLost`; a single shared `isBystanderCard` predicate now backs the VP tally, the HUD rescue count, and both scoring-input paths (live + PAR), so all surfaces agree. Server-side derivation, no game-state-hash re-pin
- WP-587/588 + D-24396/24397 (2026-08-22): the endgame report card gained the PAR **derivation** (the same formula on the scenario baseline), a colour-coded **grade scale**, a **per-player** VP/bystander split, and named penalties ("7 scheme twists", not "7 penalties") — all rendered verbatim from the returned breakdown, no server change
- WP-591 + D-24400 (2026-08-23): interim **scheme-aware PAR** — PAR was scheme-blind and mis-graded both ways (flood schemes pinned Legendary, light schemes graded wins F); per-scheme baselines from 13 real-game anchors, PAR now models expected twists + bystanders-lost, a loss penalty grades a loss by margin, retuned grade bands; `scoringConfigVersion 3→4`
- WP-593 + D-24402 (2026-08-23): report card v2 — **named players** (`Player N (Bot)` / `Player N (@handle)`) via a derived, non-persisted `seatIdentities` projection on the submit response, a **raw-score ledger** (penalties vs earned), and an objective, deterministic **luck-of-the-draw** read (actual adversity vs the scenario's PAR expectation). Display + read-path only; no game-state-hash re-pin
- WP-599 + D-24409 (2026-08-24): rulebook-faithful scoring — removed the invented −200 bystander-rescue reward (a rescued bystander now scores only its 1 VP, ending the double-count) and rescaled penalties to true VP-units (escape 10 / twist 30 / bystander-lost 40, the rulebook 4:3:1); dropped structural invariants 1 & 3, LOSS_PENALTY 6000→800, re-derived grade bands; scoringConfigVersion 4→5 / rawScoreSemanticsVersion 3→4, 128 configs + seed artifacts regenerated, no retroactive invalidation. Supersedes D-24408.

## References

- [`docs/01-VISION.md`](../docs/01-VISION.md) §20–26 — PAR-Based Scenario
  Scoring; the two-layer model (Layer A / Layer B); deterministic
  evaluation; replay-verified competitive integrity; immutability of
  declared baselines
- [`docs/12-SCORING-REFERENCE.md`](../docs/12-SCORING-REFERENCE.md) —
  the formula, weights, caps, and worked examples (canonical home;
  not duplicated in the wiki)
- [Legendary Leagues — Ranking](https://www.legendaryleagues.com/about/ranking)
  — the community ordinal-ranking system; source of the rulebook 4 : 3 : 1
  Total Score penalty ratio anchored in
  [Penalty producer status](#penalty-producer-status)
  and contrasted in full on
  [PAR Simulation Calibration §Comparison](par-simulation-calibration.md#comparison-absolute-par-vs-ordinal-league-ranking)
- [`docs/12.1-PAR-ARTIFACT-INTEGRITY.md`](../docs/12.1-PAR-ARTIFACT-INTEGRITY.md)
  — rationale for hashing PAR artifacts
- [`.claude/skills/legendary-game-engine/SKILL.md`](../.claude/skills/legendary-game-engine/SKILL.md)
  — Throwing Convention; Endgame `endIf` contract; Move Validation
  Contract (validators return — only `Game.setup()` may throw)
- [`.claude/rules/architecture.md`](../.claude/rules/architecture.md)
  — Persistence boundary (`G` is runtime-only; snapshots are
  derived records)
- [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) — WP-020 review
  notes; PAR pipeline summary
- [`docs/10-GLOSSARY.md`](../docs/10-GLOSSARY.md) —
  `ENDGAME_CONDITIONS`, `evaluateEndgame`, `EndgameResult`,
  `computeFinalScores`
- [WP-020](../docs/ai/work-packets/WP-020-vp-scoring-win-summary-minimal-mvp.md),
  [WP-027](../docs/ai/work-packets/WP-027-determinism-replay-verification-harness.md),
  [WP-048](../docs/ai/work-packets/WP-048-par-scenario-scoring-leaderboards.md),
  [WP-049](../docs/ai/work-packets/WP-049-par-simulation-engine.md),
  [WP-050](../docs/ai/work-packets/WP-050-par-artifact-storage.md),
  [WP-051](../docs/ai/work-packets/WP-051-par-publication-server-gate.md),
  [WP-053a](../docs/ai/work-packets/WP-053a-par-artifact-scoring-config.md)
