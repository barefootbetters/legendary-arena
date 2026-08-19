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
  - windows-engine-exe.md
  - seed-challenges.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\par-simulation-calibration.md (this page — https://ewiki.legendary-arena.com/par-simulation-calibration/)
  - ../docs/01-VISION.md
  - ../docs/12-SCORING-REFERENCE.md
  - ../docs/12.1-PAR-ARTIFACT-INTEGRITY.md
  - ../docs/13-REPLAYS-REFERENCE.md
  - ../docs/05-ROADMAP-MINDMAP.md
  - ../docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md
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
  - ../docs/ai/work-packets/WP-250-hero-effect-coverage-gate.md
  - ../docs/ai/work-packets/WP-257-hollow-effect-detector.md
  - ../docs/ai/work-packets/WP-422-seed-par-publication.md
last-reviewed: 2026-08-19
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

**A working, rules-faithful game engine is the hard prerequisite.**
Simulation faithfully measures whatever the engine actually does — so a PAR
calibrated on an engine that does not yet play the scenario the way the
printed rules dictate is a baseline for a *different, easier game*. Until
core-set ability coverage is complete, calibration is a dry-run / smoke
capability, not a source of published competitive baselines (see
[Prerequisite: a rules-faithful engine](#prerequisite-a-rules-faithful-engine)).

## Phase 1 — Seed Difficulty Ratings (Pre-Simulation Priors)

Simulation is Phase 2. Before it can run — and to cover new content the moment it
ships — every scenario needs a **seed PAR**: a content-authored *prior*, not a
truth. Seed difficulty ratings are the input to that prior. Their whole job is to
produce a reasonable **uncalibrated** baseline that simulation later **supersedes**
with the 55th-percentile T2 result. This section defines how those 1–10 ratings are
assigned.

**Shipped (WP-422 / D-24242, Active 2026-08-19).** Seed PAR is published for the
active gauntlet **season** (`data/gauntlet-configs.json`): every (mastermind,
scheme) leg × player-count villain-slice — the core-2026 season is **128 scenario
keys** over 19 rated entities — committed under `data/par/seed/v1/` and read by the
server gate, which turns competitive submissions on for those scenarios. Ratings
live on a standalone registry surface, `data/difficulty-ratings/seed-difficulty-v1.json`
(validated by `packages/registry/src/difficultyRatings.schema.ts`) — **not** the
theme schema, which has no per-entity object. The stored `parValue` is
`computeParScore(baseline)` on the **Raw Score scale** (see [§Phase 1 implementation
note](../docs/12-SCORING-REFERENCE.md)); the `12000 + M×1200 + …` scalar there is a
difficulty *index*, not the literal PAR. Delivery is committed-to-repo, the same
local-fs model as `data/cards`.

### The question a rating answers

> "If a competent-but-imperfect player faces this content under normal setup
> assumptions, how much does this component **lower expected Raw Score / raise loss
> pressure** compared with baseline content?"

It explicitly does **not** answer: how famous the villain is, how fun the card is,
how hard your last game felt, or what PAR you *want* the scenario to have. Ratings
are Phase-1 priors — nothing more.

Difficulty in Legendary is famously **interaction-dependent**: the community's own
difficulty rankings (mastermind/scheme/villain threads on BoardGameGeek, the various
"hardest masterminds/schemes" write-ups) converge on the same conclusion — an
entity rated "in a vacuum" is a weak signal because the *other* components in a setup
define much of its impact. The v23 Universal Rules make the same point and note that
**villain VP is the clearest single signal** for how hard a Villain Group is. So the
model separates three concerns and never conflates them:

1. **Entity baseline difficulty** — a stable 1–10 rating on the Mastermind, Scheme,
   or Villain Group *itself*.
2. **Scenario synergy difficulty** — a deterministic, enumerable adjustment applied
   only when specific components combine.
3. **Simulation correction** — the later empirical replacement (T2 55th percentile).

### The 1–10 scale (5 is the center)

`5` = a normal competent-game expectation. Below 5 makes the seed *easier*, above 5
*harder*. `1–2` tutorial/trivial; `3–4` easy/low-normal; `6–7` above-normal/hard;
`8–9` very-hard/extreme (strong clock, denial, protection, wounds, escapes, KO,
scaling, or alternate-loss pressure); `10` apex — severe pressure even before synergy.

### Entity rubrics (integer, from sub-scores)

Each entity is rated from **five dimensions scored 0–4**, then
`difficultyRating = clamp(1, 10, ceil(rawTotal / 2))`. Scoring different dimensions
per type keeps ratings mechanical, not thematic. Every published rating **must carry
its sub-score basis** (auditable — no undocumented "vibes").

**Mastermind** — `attackThresholdPressure + masterStrikeSeverity + tacticSeverity +
protectionOrAccessRestriction + scalingOrAlternateLossPressure`. High-end profiles:
severe protection, hand/deck suppression, city destruction, alternate-loss conditions,
or very high attack thresholds. Base-set masterminds generally sit low-to-mid unless a
Master Strike or tactic becomes dangerous in a specific scenario.

**Scheme** — `clockTightness + lossConditionSeverity + irreversibleDamage +
resourceDenial + setupConstraintOrScaling`. The Scheme usually defines the *clock* and
*loss condition*, so it is rated separately from the Mastermind. High-end: tight clock
plus irreversible board/deck damage, or a setup-warping loss path.

**Villain Group** — `attackAndVpPressure + ambushPressure + fightPunishmentOrDenial +
escapePressure + synergyOrKeywordComplexity`. Start from VP + attack (the v23 signal),
then adjust for text (Ambush/Fight/Escape and keyword combinatorics).

### Scenario difficulty and synergy

An entity's base rating is **never** permanently inflated by its worst pairing.
Scenario difficulty is composed at scenario time:

```
baseScenarioDifficulty = 0.40·mastermindDifficulty
                       + 0.40·schemeDifficulty
                       + 0.20·avg(villainGroupDifficulties)

scenarioDifficulty = clamp(1, 10, round(baseScenarioDifficulty + synergyAdjustment))
```

`synergyAdjustment` is an **explicit, enumerable** `-2.0 … +2.0`, each with a
`reasonCode` and a human description — never a hidden fudge. Representative bands:
same-resource pressure `+0.5…+1.0`; a component accelerating the Scheme's loss
condition `+0.5…+1.5`; a runaway multi-component loop `+1.5…+2.0`; components that
partially counteract `-0.5…-1.0`. `scenarioDifficulty` then feeds the
[§Phase 1](../docs/12-SCORING-REFERENCE.md) formula that `computeParScore` owns; the
entity ratings themselves stay content **metadata**, never scoring logic.

### Seed vs simulation, and never a silent rewrite

Seed artifacts are stamped `source: "seed"`, `calibrationStatus: "uncalibrated"`, with
their `difficultyRatingVersion`. When simulation lands it writes a **new** artifact
(`source: "simulation"`, `calibrationStatus: "calibrated"`, `percentileUsed: 55`) and
records the `seedParDelta`. A large delta is a **Phase-3 tuning signal**, not licence
to secretly edit the original seed — a wrong seed is superseded by a *new versioned*
rating (`seed-difficulty-v2`, `supersedes: v1`), never an in-place overwrite (PAR
artifacts are immutable; published competitive PAR always **prefers simulation over
seed**).

### Governance rules

1. **Integer ratings only** (`1…10`); precision lives in the 0–4 sub-scores.
2. **Every rating carries a `basis`/`subscores` object** — no undocumented drift.
3. **Entity rating ≠ scenario rating** — a Mastermind is never rated "because of a
   Scheme"; combination pressure is a scenario `synergyAdjustment`.
4. **Manual seed ratings are never silently rewritten after publication** — refine via
   a new `ratingVersion`.
5. **Published competitive PAR prefers simulation over seed** (seed exists only until
   simulation does).

### Rating record shape

```json
{
  "entityDifficultyVersion": "seed-difficulty-v1",
  "masterminds": {
    "core/loki": {
      "difficultyRating": 7,
      "subscores": {
        "attackThresholdPressure": 2, "masterStrikeSeverity": 3,
        "tacticSeverity": 3, "protectionOrAccessRestriction": 3,
        "scalingOrAlternateLossPressure": 3
      }
    }
  }
}
```

The rating MUST equal its basis: `clamp(1, 10, ceil((2+3+3+3+3) / 2)) = ceil(14/2) = 7`.
The schema (`difficultyRatings.schema.ts`) rejects any entry whose `difficultyRating`
disagrees with its sub-score sum — the rating is never a free number beside the basis.
Keys are set-qualified ext_ids; a `schemes` and `villainGroups` map sit alongside
`masterminds`. Henchman groups are not rated (the Seed PAR formula has no henchman term).

Community difficulty research (BGG threads, "hardest masterminds/schemes" articles)
and the v23 rules are used only as **anchor validation** for a first pass — sanity
checks that a rating lands in the right band — never as canonical scores.

## Mechanics

### Prerequisite: a rules-faithful engine

Calibration cannot produce a trustworthy PAR before the engine can actually
*play the scenario correctly*. [VISION §26](../docs/01-VISION.md) and
[12-SCORING-REFERENCE Phase 2](../docs/12-SCORING-REFERENCE.md) define PAR
against **"competent, rules-faithful play"** — and simulation is a faithful
mirror of engine behavior, not of the printed rulebook. If the engine
under-implements a scenario, the Raw Score distribution reflects that
weaker game, and the resulting PAR would be calibrated against the wrong
target. Ordering matters: **build the game engine first, then calibrate.**
This is not a wiki-imposed rule — the roadmap already gates on it: *"Core
set keyword & ability coverage — get the core set fully playable first,
then add sets incrementally"*
([05-ROADMAP-MINDMAP Next Horizons](../docs/05-ROADMAP-MINDMAP.md)).

Concretely, four engine-completeness gaps make calibration a dry-run today
rather than a publishable-PAR capability:

1. **Ability coverage is incomplete.** The hero reveal/rescue/draw
   executors and the villain fight/ambush/escape/KO effects have largely
   landed, but the deferred predicate machinery for filtered/targeted
   villain effects and reveal player-choice breadth are still outstanding
   before the core set is "fully playable"
   ([05-ROADMAP-MINDMAP](../docs/05-ROADMAP-MINDMAP.md), roadmap detail).
   Much of the printed ability corpus is still *hollow* — a declared card
   ability whose executable handler is absent or unreachable — which the
   engine now detects and surfaces at runtime
   ([WP-257](../docs/ai/work-packets/WP-257-hollow-effect-detector.md);
   [DESIGN-HOLLOW-EFFECT-DETECTION](../docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md)).
   The live executable-vs-hollow ratio is tracked on the dashboard
   `/coverage` surface and gated in CI by the hero-effect coverage gate
   ([WP-250](../docs/ai/work-packets/WP-250-hero-effect-coverage-gate.md)).
   A hollow ability contributes nothing to the outcome, so it silently
   shifts the distribution away from rules-faithful play.

2. **Only one of five penalty producers exists.** `deriveScoringInputsFromFinalState`
   populates `villainEscaped`; the other four `PenaltyEventType` categories
   are safe-skipped to zero because no engine producer emits them yet
   (D-4801). The penalty half of the Raw Score is therefore largely absent
   from today's distribution.

3. **The calibration loop is observation-only.** It defers rule hooks fired
   via `ctx.events` (D-0205), so even effects that *are* implemented for
   live play are not all exercised inside the current per-game loop.

4. ~~**The play-to-leaderboard loop is not yet closed.** The score-submission
   HTTP wiring is still a Next Horizon, so calibrated PAR has no live
   consumer to gate yet.~~ **Stale — corrected 2026-07-18.** The wiring
   shipped: **WP-332** wired `POST /api/competition/scores` on 2026-07-08,
   injecting the real bound `parGate.checkParPublished`. Every link in the
   loop is now closed **except this one**, which inverts the urgency of this
   list — reasons 1–3 are no longer "why calibration is not worth running
   yet" but **the sole remaining blocker on the whole competitive surface.**

   **Resolved for the seed tier — WP-422 / D-24242 (2026-08-19).** The Phase-1
   **seed** PAR index is now generated and committed for the active gauntlet
   season (`data/par/seed/v1/index.json`, 128 core-2026 scenarios), so the gate
   finds an index and the server logs `PAR index loaded: N scenarios` instead of
   the unavailable message below. Competitive submissions for those scenarios now
   score against a published (uncalibrated) seed, and their boards can fill. What
   remains blocked is the **simulation-calibrated** tier: reasons 1–3 still gate
   publishing a *simulation* PAR (a trustworthy `T2` distribution needs a
   rules-faithful engine), so today's published values are seeds, explicitly
   `calibrationStatus: "uncalibrated"`, that simulation supersedes later.

   Before WP-422, with no index at all, the server logged at startup:

   ```
   [server] PAR index unavailable at both data/par/sim/v1/index.json
     and data/par/seed/v1/index.json; competitive submissions disabled.
   ```

   and every submission fail-closed to `par_not_published`
   (`competition.logic.ts`) before any replay reduction — so
   `legendary.competitive_scores` stayed empty and the Legends board + the
   **110** gauntlet boards could not fill regardless of play volume. That
   empty-index state is now lifted for the seeded season scope.

The consequence, by design: a scenario with incomplete ability coverage
falls back to its Phase 1 content seed, explicitly marked `uncalibrated`
([12-SCORING-REFERENCE Phase 2](../docs/12-SCORING-REFERENCE.md)); and any
`simulation` PAR produced while coverage is still growing is provisional —
each coverage improvement that changes the distribution is a
`scoringConfigVersion` event, never a silent retroactive edit
([Scoring](scoring.md)). Running the pipeline against today's engine is
valuable as a smoke test and a variance/tier-ordering check (small-N,
`validateParResult` inspection), but the PAR it yields should not be
published as a competitive baseline until the scenario's rules are
faithfully implemented.

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

## Comparison: absolute PAR vs. ordinal league ranking

[Legendary Leagues](https://www.legendaryleagues.com/about/ranking) is a
long-running community ranking system for the physical game. It solves the
same core problem this pipeline exists for — *how do you rank results across
setups of wildly different difficulty?* — with the **opposite** mechanism.
Reading the two side by side is the clearest way to see what PAR buys and
what it costs.

### How Legendary Leagues ranks

It is a **purely ordinal** system. For each match, every player's result in
each **scoring category** (won-or-not, villains/henchmen escaped,
turns-to-finish, VP, and a penalised Total Score) is ranked against the
other players' results in that same category. Those per-category ranks are
summed, and the sum is itself re-ranked to give the player's overall finish
for the match. Match finishes are summed across the season for the
standings. **No absolute score ever enters the standings — only positions.**

Three interchangeable "methods" pick *what skill means* for a season:

- **Classic** — ranks VP twice (raw total VP, and the penalised Total
  Score), so score dominates.
- **Points Per Turn (PPT)** — replaces both VP ranks with `VP / turns`,
  rewarding fast wins over slow bystander-farming ("rescuing all the
  bystanders may not result in victory with this system").
- **Single VP** — keeps only the penalised Total Score, dropping the raw-VP
  rank.

The penalised Total Score is the community/rulebook formula
`Total Score = VP − 4·(Bystanders carried away) − 3·(Scheme Twists) − 1·(Escaped Villains)`.
An **adjusted-points** rule keeps standings fair when fewer players complete
a later match — each absent player adds one point to every finisher — so a
full early field cannot out-bank a thin later one.

### The essential difference

| | **PAR (this system)** | **Legendary Leagues** |
|---|---|---|
| Scale | **Absolute** — `finalScore = rawScore − PAR`, a real number | **Ordinal** — position only; magnitude discarded |
| Difficulty normalisation | Per-scenario simulated baseline (55th-pct T2) | Rank-only; difficulty cancels *if* ranked players shared the setup |
| Opponents required | **None** — a solo run gets a meaningful score | A **field** — ranking needs ≥ 2 comparable results |
| All-time / cross-setup boards | Yes — versioned, immutable, comparable forever | No — meaningful only within a match/season cohort |
| Trust model | Server-side **replay-verified**; no client number trusted | **Self-reported** ("you provide the numbers") |
| Prerequisite | A rules-faithful engine + Monte-Carlo calibration | None — works on paper, day one, for any content |
| Reproducibility | Deterministic, hashed artifact | Standings **fluctuate** as late results post |

### What the ordinal model does better

- **Zero calibration cost.** It ranks brand-new — even unimplemented —
  content the day it appears. PAR cannot competitively rank a scenario until
  the engine plays it faithfully *and* the sweep has calibrated it; the whole
  [Prerequisite](#prerequisite-a-rules-faithful-engine) section of this page
  is that cost.
- **Immune to absolute-scale distortion.** Because only positions count, a
  miscalibrated weight or a blow-out game cannot inflate a season total.
  PAR's percentile choice buys *some* of this robustness; ordinal ranking has
  it by construction.
- **Difficulty falls out for free** — no baseline to derive — provided
  everyone ranked against each other played the same setup.
- **"What is skill" is a per-season knob** (Classic / PPT / Single VP) rather
  than an engine change.

### What PAR does better

- **A lone player gets a real, comparable score.** For a co-op game whose
  leaderboards must fill at low traffic, this is decisive — ordinal ranking
  is undefined for a field of one.
- **Absolute, all-time, cross-setup comparability.** "Best result ever
  recorded on this Mastermind" is expressible; an ordinal league can only say
  "you beat six of nine people this week."
- **Cheat-resistant.** Replay-verified server-side scoring (D-5301) is a
  different integrity class from self-reported numbers — the precondition for
  real stakes.
- **Immutable and reproducible.** Version-pinned hashed artifacts do not
  drift as more results arrive.

### What PAR can borrow

1. **Anchor the penalty weights to the 4 : 3 : 1 rulebook ratio.** Legendary
   Leagues (and the rulebook it cites) weight a lost bystander at 4×, a
   scheme twist at 3×, and an escaped villain at 1×. That is exactly the
   "moral hierarchy" VISION §21 asserts for our `PenaltyEventType` weights —
   and it is external, community-validated evidence for both the *ordering*
   and the rough *magnitudes*. Two of those three penalties (`bystanderLost`,
   `schemeTwistNegative`) are precisely the ones still safe-skipping to zero
   for lack of an engine producer
   ([Scoring — penalty producer status](scoring.md)). The takeaway is
   concrete: wiring the `bystanderLost` and `schemeTwistNegative` producers
   should be prioritised, and their Phase-1 seed weights can start from the
   4 : 3 : 1 anchor rather than being invented from scratch.
2. **Expose the score components as category sub-boards.** `ScoreBreakdown`
   already carries `weightedRoundCost`, `weightedBystanderReward`,
   `weightedVictoryPointReward`, and the penalty total as separate fields.
   Surfacing "fewest turns", "most VP", "cleanest (fewest escapes)" as their
   own leaderboards — the way Legendary Leagues ranks each category — is a
   UI/product move that needs **no engine change** and gives players more ways
   to be the best at something.
3. **A Points-Per-Turn view.** PPT's insight — that raw VP over-rewards slow,
   exhaustive play — is worth a derived `VP / turns` board alongside the PAR
   board. PAR already prices turns via `weightedRoundCost`, but a *ratio*
   board reads differently and directly discourages stalling. Also a
   no-engine-change derived view.
4. **An ordinal league layer on top of Seed Challenges.** The ordinal model's
   one hard requirement — that ranked players share a setup — is exactly what
   [Seed Challenges](seed-challenges.md) guarantee. A Legendary-Leagues-style
   season run over a fixed seeded board would let us keep PAR as the absolute
   per-run score *and* run head-to-head standings with the adjusted-points
   fairness rule on top. The two systems are complementary, not competing:
   PAR scores the run; ordinal ranking seasons it.

The through-line: PAR and ordinal ranking optimise for different worlds.
Ordinal ranking is the right tool for a **synchronous field playing one
shared setup**; PAR is the right tool for an **asynchronous, low-traffic,
solo-friendly, cross-time competitive record** — the world VISION §20–26
commits us to. The borrowings above take the parts of the ordinal model that
*don't* require giving up absolute, verifiable, solo-viable scoring.

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
- **[Windows Engine Exe](windows-engine-exe.md).** The proposed standalone
  engine binary packages this same `simulation/` harness — `sweep.runner.ts`,
  the T2 competent policy, and the per-game `MOVE_MAP` loop — as a distributable
  Windows `.exe`. Calibration *derives PAR values* from the harness; the exe
  effort *distributes the harness* as a binary. Same substrate, different
  purpose; the exe changes no calibration logic.
- **[Seed Challenges](seed-challenges.md).** A *proposed* reuse of this same
  Monte-Carlo win-rate harness for a different question — vetting whether a
  single seeded board is a fair contest (winnable but not trivial) before it
  is published as a challenge, rather than deriving a scenario's PAR baseline.
- **Determinism & replays.** Calibration inherits the engine's determinism:
  identical seeds reproduce identical games and therefore an identical PAR.
  [13-REPLAYS-REFERENCE](../docs/13-REPLAYS-REFERENCE.md) requires that
  every leaderboard score be re-scorable from a deterministic replay under
  its original `scoringConfigVersion`; PAR calibration is the sibling
  process that produces the baseline those scores are normalized against,
  under the same version-pinning discipline.

## Edge Cases

- **A green run is not a valid PAR if the engine is under-built.** The
  pipeline runs to completion and produces a distribution even when many of
  the scenario's abilities are hollow — nothing errors. The distribution is
  simply calibrated against a weaker game than the printed rules describe.
  Coverage completeness is a precondition the pipeline cannot self-check;
  it is verified out-of-band on the `/coverage` surface and the hero-effect
  coverage gate ([WP-250](../docs/ai/work-packets/WP-250-hero-effect-coverage-gate.md)).
  See [Prerequisite: a rules-faithful engine](#prerequisite-a-rules-faithful-engine).
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
- [Legendary Leagues — Ranking](https://www.legendaryleagues.com/about/ranking)
  — the community ordinal-ranking system (Classic / Points-Per-Turn /
  Single VP methods, the `VP − 4·bystanders − 3·twists − 1·escapes` Total
  Score, and adjusted-points standings) contrasted in
  [§Comparison](#comparison-absolute-par-vs-ordinal-league-ranking)
- [`docs/05-ROADMAP-MINDMAP.md`](../docs/05-ROADMAP-MINDMAP.md) — Next
  Horizons ("get the core set fully playable first"); the roadmap detail on
  what hero/villain ability coverage has landed vs what remains; the
  score-submission HTTP wiring horizon — the engine prerequisite this page
  documents
- [`docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md`](../docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md)
  — the detect→surface loop for hollow abilities (declared but unreachable),
  the direct measure of the coverage gap
- [WP-036](../docs/ai/work-packets/WP-036-ai-playtesting-balance-simulation.md),
  [WP-048](../docs/ai/work-packets/WP-048-par-scenario-scoring-leaderboards.md),
  [WP-049](../docs/ai/work-packets/WP-049-par-simulation-engine.md),
  [WP-050](../docs/ai/work-packets/WP-050-par-artifact-storage.md),
  [WP-051](../docs/ai/work-packets/WP-051-par-publication-server-gate.md),
  [WP-250](../docs/ai/work-packets/WP-250-hero-effect-coverage-gate.md)
  (hero-effect coverage gate + `/coverage`),
  [WP-257](../docs/ai/work-packets/WP-257-hollow-effect-detector.md)
  (hollow-effect detector)
