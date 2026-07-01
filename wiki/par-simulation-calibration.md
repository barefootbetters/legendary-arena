---
title: PAR Simulation Calibration
type: System
tags:
  - layer-engine
  - scoring
  - par
  - simulation
  - determinism
  - drift-detection
  - vision
related:
  - scoring.md
  - scheme.md
  - turn-system.md
  - cardextid.md
  - complete-game-fixtures.md
status: canonical
source:
  - ../docs/01-VISION.md
  - ../docs/12-SCORING-REFERENCE.md
  - ../docs/12.1-PAR-ARTIFACT-INTEGRITY.md
  - ../docs/13-REPLAYS-REFERENCE.md
  - ../packages/game-engine/src/simulation/par.aggregator.ts
  - ../packages/game-engine/src/simulation/ai.tiers.ts
  - ../packages/game-engine/src/simulation/ai.competent.ts
  - ../packages/game-engine/src/simulation/simulation.runner.ts
  - ../packages/game-engine/src/simulation/par.storage.ts
  - ../packages/game-engine/src/scoring/parScoring.logic.ts
  - ../docs/ai/work-packets/WP-036-ai-playtesting-balance-simulation.md
  - ../docs/ai/work-packets/WP-049-par-simulation-engine.md
  - ../docs/ai/work-packets/WP-050-par-artifact-storage.md
  - ../docs/ai/work-packets/WP-051-par-publication-server-gate.md
  - ../docs/ai/work-packets/WP-048-par-scenario-scoring-leaderboards.md
last-reviewed: 2026-07-01
---

# PAR Simulation Calibration

## Summary

PAR Simulation Calibration is the Monte-Carlo pipeline that **devises a
scenario's PAR value by playing the scenario, not by declaring it**. A
competent heuristic AI plays hundreds-to-thousands of complete games of a
fixed scenario, each game is scored with the same Raw Score formula players
use, and PAR is set to the **55th percentile** of that Raw Score
distribution. It implements Phase 2 of the three-phase PAR pipeline in
[VISION §26](../docs/01-VISION.md) — sitting between the Phase 1 content
seed and Phase 3 post-release refinement — and produces the immutable,
hashed PAR artifact competitive play depends on. The numeric scoring
formula lives in [Scoring](scoring.md); this page documents how the
distribution that feeds PAR is *generated*.

## Mechanics

### Why simulation, not a formula

PAR answers one question: *"What is a reasonable Raw Score for competent,
rules-faithful play on this exact setup?"* A closed-form estimate exists
(the Phase 1 content seed, `computeParScore`), but the
[calibration example in 12-SCORING-REFERENCE](../docs/12-SCORING-REFERENCE.md)
shows why it is not enough on its own: a seed PAR of `26800` for a real
scenario resolved to a simulation-calibrated PAR of `-1200` — the seed was
nowhere near the actual distribution of competent play. Simulation is the
empirical correction: it plays the scenario many times and reads the answer
off the outcome distribution rather than guessing it from difficulty
ratings.

### The five-tier policy taxonomy — only T2 defines PAR

[`ai.tiers.ts`](../packages/game-engine/src/simulation/ai.tiers.ts) defines
a closed five-tier spectrum of AI strength. Exactly **one** tier —
`T2`, "Competent Heuristic" — carries `usedForPar: true`:

| Tier | Name | Purpose | `usedForPar` |
|------|------|---------|:---:|
| `T0` | Random Legal | Sanity / smoke tests | ❌ |
| `T1` | Naive | Regression baseline | ❌ |
| `T2` | Competent Heuristic | **Primary PAR calibration** | ✅ |
| `T3` | Strong Heuristic | Upper-bound validation | ❌ |
| `T4` | Near-Optimal | Research only | ❌ |

T0/T1 play too weakly and T3/T4 play too strongly to model the
"experienced but imperfect human" that PAR is defined against. `T2` is the
only tier the aggregator ever instantiates for a published PAR value. The
`AIPolicyTier` union and the `AI_POLICY_TIERS` array are kept in
one-to-one correspondence by a drift-detection test.

### The T2 Competent Heuristic

[`ai.competent.ts`](../packages/game-engine/src/simulation/ai.competent.ts)
builds the policy via `createCompetentHeuristicPolicy(seed)`. Its
`decideTurn` scores each legal move against five behavioral heuristics that
model experienced play:

1. **Threat prioritization** — fight villains holding bystanders first;
   treat imminent escapes urgently.
2. **Heroism bias** — civilian rescue is worth the efficiency cost.
3. **Economy awareness** — fight when fighting is possible; never stall.
4. **Limited deck awareness** — a coarse early/mid/late posture, with no
   card counting.
5. **Local optimization** — evaluate this turn and the next only; no deep
   lookahead.

Move scoring is deterministic; ties are broken by a seeded `mulberry32`
PRNG closed over the policy-seed hash. This models exactly the skill floor
that VISION §26 and [12-SCORING-REFERENCE Phase 2](../docs/12-SCORING-REFERENCE.md)
calibrate against: reasonable but imperfect, never optimal, never chaotic.

### The per-game Monte-Carlo loop

`generateScenarioPar(config, registry)` in
[`par.aggregator.ts`](../packages/game-engine/src/simulation/par.aggregator.ts)
orchestrates the whole run:

1. **Derive a canonical seed set** from `(baseSeed, simulationCount)` via
   `generateSeedSet` — order-stable, independently indexed, so the seed
   list can never be silently reordered.
2. **Hash the seed set** (`computeSeedSetHash`, a `djb2` over the joined
   list) and store it on the result so any auditor can prove which seeds
   produced a given PAR.
3. **For each seed, play one complete game** (`simulateOneGame`): build the
   initial state with `buildInitialGameState`, then run a per-turn loop that
   asks `getLegalMoves`, lets the T2 policy pick an intent, and dispatches
   it through a static `MOVE_MAP`. Losses are first-class outcomes — no game
   is filtered out.
4. **Score each terminal state** with `computeRawScore(inputs, scoringConfig)`
   — the identical formula defined in [Scoring](scoring.md) and applied to
   live play — after deriving `ScoringInputs` directly from the final `G`.
5. **Aggregate** the Raw Score array into an integer PAR.

Two safety caps bound a run: `MAX_TURNS_PER_GAME` (200) and
`MAX_MOVES_PER_GAME` (2000). A game that trips either is flagged in
`gameState.messages` and counted as stuck rather than looping forever.

### The two-domain PRNG invariant (D-3604)

Every run uses **two independent PRNG domains**: a per-game *shuffle*
domain (deck ordering) and a per-policy *decision* domain (tie-breaking).
They never share state, so reseeding one — e.g., to reproduce a single
game's shuffle — cannot perturb the other's decisions. Both are seeded
`mulberry32` PRNGs; the aggregator duplicates the tiny PRNG plumbing inline
rather than importing it, per the WP-036 Scope Lock (RS-10).

### The 55th-percentile selection rule

`aggregateParFromSimulation(rawScores, percentile)` computes PAR by the
**nearest-rank** method on the sorted-ascending distribution:
`rankIndex = ceil((percentile / 100) * N) - 1`, clamped to `[0, N-1]`. No
float interpolation — PAR is always an integer in Raw Score units. The
default percentile is `PAR_PERCENTILE_DEFAULT = 55`; the publishable range
is `[50, 60]` inclusive.

The choice of the 55th percentile — slightly above the median — is
deliberate ([12-SCORING-REFERENCE](../docs/12-SCORING-REFERENCE.md)): it is
robust to lucky and unlucky outlier games, and it makes PAR *beatable but
fair* — a player must play slightly better than typical competent play to
reach it. The percentile is a **tunable constant, not a formula change**;
adjusting it within `[50, 60]` requires a `scoringConfigVersion` bump.

Because the mean is easily dragged by a few blowout games, PAR **never**
uses the mean — only a robust percentile.

### The distribution artifact and its guardrails

`generateScenarioPar` returns a `ParSimulationResult` whose fields WP-050
pins as the artifact schema: `parValue`, `percentileUsed`, `sampleSize`,
`seedSetHash`, a `rawScoreDistribution` summary
(`min`/`p25`/`median`/`p55`/`p75`/`max`/`standardDeviation`/`interquartileRange`),
`needsMoreSamples`, `seedParDelta` (calibrated PAR minus the Phase 1 seed —
the drift signal), and the `simulationPolicyVersion` /
`scoringConfigVersion` provenance pins. Every field is JSON-serializable and
survives a `JSON.parse(JSON.stringify(...))` round-trip.

`validateParResult` is the publication gate and never throws — it returns a
structured verdict:

- **error** — `sampleSize < PAR_MIN_SAMPLE_SIZE` (500); non-monotonic
  distribution bounds; `percentileUsed` outside `[50, 60]`.
- **warn** — `needsMoreSamples` set (IQR > 2000 or stddev > 1500); a
  multimodality smell test (20-bin histogram, ≥ 2 peak clusters separated
  by a valley) that flags degenerate exploit loops; or a note that the
  multimodality check was skipped when the raw array was not supplied.

`generateScenarioPar` itself does **not** enforce the 500-sample minimum —
that is deliberately deferred to `validateParResult` so small-N smoke tests
can still produce an inspectable result. A published PAR must clear
`validateParResult` with no errors.

### Tier-ordering sanity check

`validateTierOrdering(t0, t1, t2, t3)` is a calibration guardrail
independent of any single PAR value: it confirms
`median(T3) < median(T2) < median(T1) < median(T0)` (lower Raw Score =
stronger play), requiring ≥ 50 samples per tier. A violation means the
heuristics are miscalibrated or the scenario has a degenerate exploit — in
either case PAR publication should halt until the cause is understood.

### Where the sweep runs it

The single-scenario pipeline above is driven across the whole
scheme × mastermind matrix by the Simulation Sweep
([`sweep.runner.ts`](../packages/game-engine/src/simulation/sweep.runner.ts),
WP-194/WP-195), whose findings feed the nightly analytics and agent-triage
lanes. The sweep is the batch host; `generateScenarioPar` is the per-cell
unit of work.

### Storage: seed vs simulation, hashed and immutable

[`par.storage.ts`](../packages/game-engine/src/simulation/par.storage.ts)
(WP-050) persists PAR baselines as immutable JSON artifacts under a
versioned, per-source-class layout. Two source classes version
independently and are combined by a cross-class resolver:

- **`seed`** — the Phase 1 content-authored baseline; required until a
  simulation artifact exists for the same `ScenarioKey`.
- **`simulation`** — the Phase 2 `ParSimulationResult`; **supersedes** the
  seed at resolve time once present.

Each artifact is content-addressed by `ScenarioKey`, hashed with SHA-256
for tamper detection (excluding the hash field itself), cross-verified by
the version index, and locked against overwrite at the write layer. This is
the trust model explained in
[12.1-PAR-ARTIFACT-INTEGRITY](../docs/12.1-PAR-ARTIFACT-INTEGRITY.md): PAR
values are *precedent, not state* — once published they can never be
silently altered, and any hash mismatch halts publication. Filesystem IO is
carved out for this one file (and its test) per D-5001; every other
simulation file stays IO-free per the engine-layer rule (D-3601).

### The publication gate

WP-051 wires calibration into competitive play: a replay may only be
submitted to a scenario leaderboard if a PAR artifact exists for that
`ScenarioKey`. Simulation calibration is therefore the gate that turns a
newly-added scenario from "playable" into "competitively rankable".

## Interactions

- **[Scoring](scoring.md).** Calibration is Layer A's *derivation
  mechanism*; Scoring owns the formula, the type contracts
  (`ScenarioScoringConfig`, `ScoreBreakdown`), and the
  `scoringConfigVersion` pin. The aggregator calls Scoring's
  `computeRawScore` per game and `computeParScore` to compute
  `seedParDelta`. PAR is scenario-only — never keyed on the hero team, per
  the same VISION §26 rule both pages cite.
- **[Scheme](scheme.md), Mastermind, and Villain Groups.** These form the
  scenario identity that PAR is calibrated for. A scenario's `ScenarioKey`
  (built in Scoring) is the content address of its stored PAR artifact.
- **[Turn System](turn-system.md).** `simulateOneGame` replicates the
  engine's turn cadence outside boardgame.io: it advances stages, mirrors
  `onBegin` (auto-draw to hand size, once-per-turn flag resets, per WP-266),
  and resets the turn economy each turn. It is an observation-only loop —
  rule hooks fired by `ctx.events` are deferred (D-0205), matching the
  replay/determinism harness posture.
- **[Complete-Game Fixtures](complete-game-fixtures.md).** Both this
  pipeline and the fixture harness re-run engine moves outside the live
  server through a duplicated `MOVE_MAP`; both must therefore add any new
  move to their dispatch map or a parked pending choice hangs the loop
  (the WP-286 / WP-289 resolve-move fixes).
- **Determinism & replays.** Calibration inherits the engine's determinism:
  identical seeds reproduce identical games and therefore an identical PAR.
  [13-REPLAYS-REFERENCE](../docs/13-REPLAYS-REFERENCE.md) requires that
  every leaderboard score be re-scorable from a deterministic replay under
  its original `scoringConfigVersion`; PAR calibration is the sibling
  process that produces the baseline those scores are normalized against,
  under the same version-pinning discipline.

## Edge Cases

- **PAR is never the mean.** A handful of blowout games can drag the mean
  arbitrarily; only the nearest-rank percentile is used. `aggregateParFromSimulation`
  throws `ParAggregationError` on an empty distribution or an out-of-range
  percentile — it never silently returns a degenerate value.
- **Small-N results are inspectable but unpublishable.** `generateScenarioPar`
  will happily run 10 games for a smoke test; `validateParResult` is the
  point that rejects `sampleSize < 500`. Never publish a PAR that has not
  cleared validation.
- **Percentile drift needs a version bump.** Moving the percentile inside
  `[50, 60]` is allowed but is a `scoringConfigVersion` change, not a free
  tweak — existing leaderboard entries keep the version they were scored
  under.
- **Simulation supersedes seed, and the delta is the alarm.** Once a
  `simulation` artifact exists it wins over the `seed` at resolve time. A
  large `seedParDelta` is the intended signal that the Phase 1 difficulty
  ratings or seed constants need refinement (Phase 3), not a bug.
- **Stuck games are counted, not dropped.** A game that trips
  `MAX_TURNS_PER_GAME` or `MAX_MOVES_PER_GAME` is flagged in
  `G.messages` and still contributes its Raw Score; it is not silently
  excluded, which would bias the distribution.
- **Only T2 may define PAR.** Reading a PAR value off any other tier is a
  category error the taxonomy exists to prevent — T0/T1 understate and
  T3/T4 overstate competent play. `validateTierOrdering` is the sanity
  check that the tiers still rank in the expected order.
- **The aggregator must not import boardgame.io.** Simulation is
  engine-layer code; it reuses move functions but constructs its own local
  structural move context (D-2801) and duplicates PRNG plumbing (RS-10)
  rather than importing framework types. The layer-boundary grep gate
  enforces this.
- **Penalty producers that do not exist yet score as zero.** Four of the
  five `PenaltyEventType` categories have no engine producer today and are
  safe-skipped to zero in `deriveScoringInputsFromFinalState` (D-4801);
  only `villainEscaped` is currently populated. PAR rides on whatever
  producers exist — adding more is downstream work and shifts the
  distribution when it lands (a version-bump event).

## Code Touchpoints

- [`packages/game-engine/src/simulation/par.aggregator.ts`](../packages/game-engine/src/simulation/par.aggregator.ts)
  — `generateScenarioPar`, `aggregateParFromSimulation`, `generateSeedSet`,
  `computeSeedSetHash`, `validateParResult`, `validateTierOrdering`;
  `ParSimulationConfig` / `ParSimulationResult`; the constants
  `PAR_PERCENTILE_DEFAULT`, `PAR_MIN_SAMPLE_SIZE`, `IQR_THRESHOLD`,
  `STDEV_THRESHOLD`, `MULTIMODALITY_BIN_COUNT`
- [`packages/game-engine/src/simulation/ai.tiers.ts`](../packages/game-engine/src/simulation/ai.tiers.ts)
  — `AIPolicyTier`, `AI_POLICY_TIERS`, `AI_POLICY_TIER_DEFINITIONS`
  (`usedForPar` flag)
- [`packages/game-engine/src/simulation/ai.competent.ts`](../packages/game-engine/src/simulation/ai.competent.ts)
  — `createCompetentHeuristicPolicy` (the T2 policy)
- [`packages/game-engine/src/simulation/simulation.runner.ts`](../packages/game-engine/src/simulation/simulation.runner.ts)
  — WP-036 per-game runner the aggregator's loop mirrors (RS-10)
- [`packages/game-engine/src/simulation/sweep.runner.ts`](../packages/game-engine/src/simulation/sweep.runner.ts)
  — batch host across the scenario matrix
- [`packages/game-engine/src/simulation/par.storage.ts`](../packages/game-engine/src/simulation/par.storage.ts)
  — `ParArtifactSource` (`seed` / `simulation`); SHA-256 artifact write,
  index, cross-class resolver
- [`packages/game-engine/src/scoring/parScoring.logic.ts`](../packages/game-engine/src/scoring/parScoring.logic.ts)
  — `computeRawScore`, `computeParScore` consumed per game

## History

- WP-036: AI Playtesting & Balance Simulation — the T0 policy, the
  per-game runner, and the Scope Lock (RS-10) the aggregator duplicates
  rather than extends
- WP-048: PAR type family and the Raw Score formula the aggregator scores
  each game with
- WP-049: PAR Simulation Engine — this pipeline: the T2 policy, the
  aggregator, the 55th-percentile selection, and the validators
  (D-2801 local move context, D-3604 two-domain PRNG)
- WP-050: PAR Artifact Storage & Indexing — the hashed, immutable
  `seed` / `simulation` artifact layout and cross-class resolver
  (D-5001 IO carve-out)
- WP-051: PAR Publication & Server Gate — "no PAR artifact, no leaderboard
  submission"
- WP-194 / WP-195: Setup-matrix sweep runner + anomaly oracle that host
  calibration at scale
- WP-266: `onBegin` parity so the observation-only loop draws opening hands
  and can actually play cards
- WP-286 / WP-289: interactive resolve-move dispatch entries added to the
  aggregator `MOVE_MAP` so parked pending choices do not hang the loop

## References

- [`docs/01-VISION.md`](../docs/01-VISION.md) §26 — Simulation-Calibrated
  PAR Determination (the three-phase pipeline; "PAR is determined by
  simulation before players ever choose heroes"); §20–25 — the PAR scoring
  system and competitive-integrity goals it serves
- [`docs/12-SCORING-REFERENCE.md`](../docs/12-SCORING-REFERENCE.md) —
  Phase 2 (Simulation Calibration), the heuristic-AI description, the
  55th-percentile selection rule, the calibration example, and the
  calibration invariants
- [`docs/12.1-PAR-ARTIFACT-INTEGRITY.md`](../docs/12.1-PAR-ARTIFACT-INTEGRITY.md)
  — why PAR artifacts are hashed (tamper-evident immutability; PAR as
  precedent, not state)
- [`docs/13-REPLAYS-REFERENCE.md`](../docs/13-REPLAYS-REFERENCE.md) —
  deterministic replays as the sole scoring input; the version-pinning and
  reproducibility discipline calibration shares
- [Scoring](scoring.md) — the Raw Score / Final Score formula, type
  contracts, and `scoringConfigVersion` pin (canonical home; not duplicated
  here)
- [WP-036](../docs/ai/work-packets/WP-036-ai-playtesting-balance-simulation.md),
  [WP-048](../docs/ai/work-packets/WP-048-par-scenario-scoring-leaderboards.md),
  [WP-049](../docs/ai/work-packets/WP-049-par-simulation-engine.md),
  [WP-050](../docs/ai/work-packets/WP-050-par-artifact-storage.md),
  [WP-051](../docs/ai/work-packets/WP-051-par-publication-server-gate.md)
