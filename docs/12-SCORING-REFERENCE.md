# Legendary Arena — Scoring Reference Model

> **Status:** Vision-level reference formula — not locked math
> **Authority:** Subordinate to `01-VISION.md` (goals 20-26) and `docs/ai/ARCHITECTURE.md`
> **Version:** 1.1
> **Last updated:** 2026-04-11

---

## Table of Contents

- [Purpose](#purpose)
- [Two-Layer Scoring Architecture](#two-layer-scoring-architecture)
- [Scoring Mechanics](#scoring-mechanics)
- [Raw Score Composition](#raw-score-composition)
- [Component Definitions](#component-definitions)
- [Structural Invariants](#structural-invariants-non-negotiable)
- [Full Formula](#full-formula-expanded)
- [Scenario PAR Definition and Derivation](#scenario-par-definition--derivation)
- [Worked Example](#worked-example-illustrative-only)
- [Leaderboard Display and Tiebreakers](#leaderboard-display--tiebreakers)
- [Score Provenance Requirements](#score-provenance-requirements)
- [Design Guardrails](#design-guardrails)
- [Anti-Exploit Clauses](#anti-exploit-clauses)
- [Future Extensions](#future-extensions)
- [Explicit Non-Goal](#explicit-non-goal)
- [Relationship to Other Documents](#relationship-to-other-documents)

---

## Purpose

This document translates **Vision goals 20-26** into a concrete, implementable,
and fully deterministic scoring model for Legendary Arena.

It exists to:
- Provide the single authoritative reference for all scoring logic
- Encode the moral hierarchy of heroism (rescue > containment > loss) into
  measurable outcomes
- Prevent score inflation, exploit metas, and subjective judgment
- Enable perfect reproducibility across replays, leaderboards, and future
  expansions
- Serve as the contract for engine implementation, UI display, and community
  understanding

This is a **design specification**, not engine code. Implementation must follow
the architecture rules in `.claude/rules/architecture.md` and
`.claude/skills/legendary-game-engine/SKILL.md`.

---

## Two-Layer Scoring Architecture

The system mirrors golf scoring with two intentionally separated layers:

### Layer A: Scenario Difficulty Rating (PAR)

Measures **how hard the scenario itself is**, independent of player skill or
hero choice.

- **Inputs:** Scheme, Mastermind, Villain Groups, Henchmen, Player Count
- **Output:** A single static PAR value for that scenario configuration
- **Question answered:** "What is a reasonable outcome for competent,
  rules-faithful play on this setup?"

PAR is static, content-driven, and never player-adaptive, hero-dependent, or
luck-adjusted.

### Layer B: Player & Hero Performance (Execution Quality)

Measures **how well** the chosen heroes and players performed against the
scenario's difficulty. Combines two intertwined judgments:

- **Hero selection skill** — synergy, scenario match, bystander/tempo/threat
  balance
- **In-game decision quality** — efficiency (rounds), tactical success (VP),
  heroism (bystanders rescued), failures (escapes, civilian casualties)

**Output:** `Final Score = Raw Score - PAR`

**Question answered:** "Given how hard this scenario is, how heroic was your
play?"

### Why the Separation Matters

- A brutal scenario can still yield elite (deeply negative) scores
- An easy scenario can still expose poor play
- Hero selection becomes a visible dimension of skill
- Leaderboards remain comparable **within** each scenario while preserving
  difficulty differences **across** scenarios

The moral hierarchy (bystander rescue > villain escape; bystander loss is worst)
lives entirely in Layer B. It does not affect PAR directly. It shapes what "good
play" looks like — ensuring heroism is visible even on the hardest scenarios.

> **PAR measures how hard the world is.**
> **Final Score measures how heroic you were inside it.**

---

## Scoring Mechanics

Every completed game produces a **Raw Score**, normalized against the scenario's
**PAR** to produce the **Final Score**:

```
Final Score = Raw Score - PAR
```

- **Negative** = under PAR (exceptional, heroic play)
- **Zero** = at PAR (competent, expected play by experienced players)
- **Positive** = over PAR (suboptimal play)

**Lower is always better.** This preserves golf-style intuition and prevents
score inflation across scenarios.

---

## Raw Score Composition

> **Updated by WP-599 / D-24409 (2026-08-24): full rulebook fidelity — one reward
> term, penalties in true VP-units.** The invented per-bystander rescue reward is
> **removed**. A rescued bystander now scores **only** its printed 1 VP, folded into
> the Victory Points total — so a bystander is counted exactly once, ending the prior
> double-count. **Victory Points is the sole reward term.** Penalty weights are
> rescaled to true VP-units (1 VP = 10 centesimal, the same scale as the VP reward):
> `villainEscaped 100→10`, `schemeTwistNegative 300→30`, `bystanderLost 400→40` (the
> rulebook 4:3:1, now on the VP scale); the LA-only inert penalties
> `mastermindTacticUntaken 25→10` and `scenarioSpecificPenalty 40→10` take a minor
> in-scale value. New Raw Score formula: `RawScore = P − (VP × 10) + lossPenalty`,
> mirroring the rulebook / community Total Score `VP − 4·bystandersLost − 3·twists −
> 1·escapes`. Structural invariants 1 (`W_BP > villainEscaped`) and 3
> (`bystanderLost > W_BP`) are **removed** with the reward they referenced; invariant
> 2 (`bystanderLost > villainEscaped`, now `40 > 10`) survives as the sole
> moral-hierarchy invariant — the "rescue is the point" hierarchy now lives entirely
> on the heavy `bystanderLost` penalty, exactly as the rulebook encodes it (it
> penalizes losing civilians −4 but gives no positive rescue reward). `LOSS_PENALTY
> 6000→800`; `SCORE_GRADE_BANDS` re-derived against 13 real anchor games (Legendary ≤
> −500, A ≤ −250, B ≤ 150, C ≤ 500, D ≤ 1100, F). `scoringConfigVersion 4→5` /
> `rawScoreSemanticsVersion 3→4`; 128 scoring-configs + 128 seed PAR artifacts + index
> regenerated; existing rows keep their pinned versions (no retroactive invalidation).
> The game-**winner** VP (rulebook table result) still counts bystanders at 1 VP each;
> only the competitive score changed. **INTERIM / tunable.** Supersedes D-24408. See
> D-24409.

> **Updated by WP-591 / D-24400 (2026-08-23): scheme-aware PAR, physical baselines,
> loss penalty, retuned grade bands.** The seed PAR was scheme-BLIND (a flat
> difficulty→baseline template) but bystander rescues are scheme-DRIVEN (validated
> from 13 real-game diagnostics: Midtown Bank Robbery 24-37 vs Cosmic Cube 3-4), so a
> single PAR mis-graded both ways. The generator is now scheme-aware
> (`baselineForScenario`), `ParBaseline` gains `schemeTwistsPar` + `bystandersLostPar`
> and `computeParScore` subtracts those penalties (so PAR shares the raw score's full
> penalty footing — physical baselines), a lost match adds a flat `LOSS_PENALTY`
> (6000) to `RawScore` (so a bystander-heavy loss can't out-grade a competent win),
> and `SCORE_GRADE_BANDS` is retuned (Legendary ≤ −2000, A ≤ −700, B ≤ 700, C ≤ 2000,
> D ≤ 4000, F). `scoringConfigVersion 3→4` / `rawScoreSemanticsVersion 2→3`; existing
> rows keep their pinned versions. This is an **INTERIM** calibration — VISION §26
> Phase-2 simulation calibration supersedes it once the competent AI is strong enough
> to be a valid reference (a spike showed today's AI too weak). See D-24400.

> **Updated by WP-585 / D-24394 (2026-08-22): no per-round cost.** The Marvel
> Legendary v23 rulebook's "Scoring" section subtracts only −4/Bystander-lost,
> −3/Scheme-Twist, −1/Villain-escaped and has **no round/turn penalty** — Scheme
> Twists are its length proxy. The former `(R × W_R)` round-cost term was an LA
> addition that double-counted length; it has been **removed**. `R` (rounds) is
> retained only as informational context, never scored. Historical worked examples
> below that still show a `(R × …)` term predate this change and are illustrative.

```
Raw Score =
  P             +
  lossPenalty   -
  (VP x W_VP)
```

Where `P` is the weighted sum of all penalty event contributions, `lossPenalty` is a
flat `LOSS_PENALTY` added only when the match is lost, and `VP` is the sole reward
term (WP-599 / D-24409 removed the separate bystander-rescue reward — rescued
bystanders now score as their printed 1 VP inside `VP`).

All values are stored and computed as **centesimal integers** (multiplied by 100
internally) for perfect precision and deterministic integer arithmetic.

### Component Summary

| Symbol | Name                  | Direction       | Description                                    |
|--------|-----------------------|-----------------|------------------------------------------------|
| R      | Rounds played         | Higher = worse  | Full player turn cycles (informational only)   |
| BP     | Bystanders rescued    | Informational   | Bystanders saved (score as 1 VP each inside VP; no separate reward — WP-599) |
| VP     | Victory Points earned | Higher = better | Total VP per official rules — **sole reward term**, includes rescued bystanders at 1 VP each |
| P      | Penalty total         | Higher = worse  | Weighted sum of all penalty events             |
| W_*    | Weights               | --              | Scenario-defined per component                 |

---

## Component Definitions

### 1. Rounds Played (R) — Informational Only (no longer scored)

Counts full player-turn cycles until victory or loss.

**No weight (WP-585 / D-24394).** `R` carries no score contribution — the rulebook
has no round penalty, and game length is captured by the Scheme-Twist penalty (twists
accumulate the longer the villains operate). `R` is still shown to players as context.

---

### 2. Bystanders Rescued (BP) — Heroism

Counts bystanders saved via defeat, effects, or special rules. Saving civilians is
the moral core of the game — but as of **WP-599 / D-24409 there is no separate BP
reward weight.** A rescued bystander scores **only** its printed **1 VP**, folded
into the Victory Points total (§3). `~~W_BP = +300~~` is **removed**.

The heroism incentive is now carried entirely by the penalty side: losing a
civilian to an escaping villain costs the heavy `bystanderLost` penalty (+40),
exactly as the Marvel Legendary rulebook encodes it — the rulebook penalizes losing
civilians −4 but gives **no** positive rescue bonus. Rescue is "the point" because
failing to rescue is expensive, not because rescue pays a bonus on top of its VP.

`BP` is retained as an **informational** stat (shown on the report card and used by
PAR's `bystandersLostPar` adversity read), never as a separate scored line.

---

### 3. Victory Points (VP) — The Sole Reward

Total VP earned per official rules. VP is the **only reward term** in the Raw Score
and explicitly **counts rescued bystanders at 1 VP each** (alongside defeated
villains, henchmen, and mastermind tactics) — so a bystander is counted **exactly
once**, ending the prior double-count in which a rescue paid both its VP and a
separate bonus.

**Default weight:** `W_VP = +10` (0.10 per VP) — the true VP-unit that the rescaled
penalties (§4) share.

---

### 4. Penalty Events (P)

Each event type carries its own weight, reflecting the **moral hierarchy**.

> **Rulebook anchor (D-24342, rescaled by WP-599 / D-24409).** The three rulebook
> penalties — `bystanderLost` : `schemeTwistNegative` : `villainEscaped` — are
> anchored to the community / rulebook **4:3:1** ratio. WP-599 rescaled them to true
> VP-units (1 VP = 10 centesimal, the same scale as the VP reward), so the triple is
> now `40 / 30 / 10` with `villainEscaped` as the 1-VP unit (was `400 / 300 / 100`).
> `mastermindTacticUntaken` and `scenarioSpecificPenalty` are
> Legendary-Arena-specific penalties, **not** part of that triple; they take a minor
> in-scale value (+10).

| Event Type               | Default Weight | Meaning                                    |
|--------------------------|----------------|--------------------------------------------|
| `villainEscaped`         | +10 (1.00)     | Loss of tactical control                   |
| `bystanderLost`          | +40 (4.00)     | Heroic failure — civilian casualty          |
| `schemeTwistNegative`    | +30 (3.00)     | Scheme pressure resolving against players   |
| `mastermindTacticUntaken` | +10 (1.00)    | Missed opportunity — incomplete victory     |
| `scenarioSpecificPenalty` | +10 / scenario-defined | Scenario-unique failure event         |

The penalty total `P` is:

```
P = sum(eventCount[type] x eventWeight[type])
```

Each penalty event type must be:
- Logged in the authoritative game log
- Counted deterministically
- Mapped to a numeric weight via scenario config

#### Why Bystander Losses Are Weighted Highest

In Legendary (and in comics), saving civilians is the point. The scoring model
encodes a moral hierarchy:

- Letting a villain escape is bad
- Letting a villain escape **with a captured bystander** is worse
- Losing a bystander (+40) costs four times what letting a villain escape (+10)
  does — the rulebook 4:1 spread

This ensures players cannot adopt a "cold, conservative" strategy — ignoring
civilians in favor of perfect board control — and outscore a player who takes
risks to save lives. Note (WP-599 / D-24409): the incentive is entirely
penalty-side now — there is no positive rescue bonus to weigh against; a rescued
bystander scores only its 1 VP, and the moral pressure comes from the heavy cost of
*losing* one.

#### Why Untaken Tactics Are Penalized

Mastermind tactics already contribute to VP when defeated (VP_TACTIC = +5 per
WP-020). The `mastermindTacticUntaken` penalty is a separate signal: it measures
**completeness of victory**, not combat value. A team that wins without fully
defeating the mastermind has left the job unfinished. The modest weight (+10)
reflects that this is a minor penalty — a tiebreaker-level signal, not a
dominant scoring factor.

---

## Structural Invariants (Non-Negotiable)

These relationships **must hold for every scenario configuration**. They are hard
rules that prevent future rebalancing from eroding the moral structure of the
system.

> **WP-599 / D-24409 removed invariants 1 and 3.** Both referenced the deleted
> bystander-rescue reward (`W_BP`), which no longer exists — a rescued bystander now
> scores only its 1 VP. The sole surviving moral-hierarchy invariant is invariant 2
> below: with no positive rescue bonus, the entire hierarchy rests on the heavy
> `bystanderLost` penalty, exactly as the rulebook encodes it.

### Invariant: Bystander Loss Exceeds Villain Escape

```
bystanderLostWeight > villainEscapedWeight
```

Losing a civilian is always worse than losing a villain. Prevents strategies that
sacrifice civilians to maintain board position. This is the single non-negotiable
moral-hierarchy relationship the scoring model must preserve.

### Default Values Satisfy the Invariant

```
bystanderLost (40) > villainEscaped (10)   (rulebook 4:1)
```

Any scenario-specific tuning must preserve this invariant exactly.

---

## Full Formula (Expanded)

```
Raw Score =
  (villainEscapes x 10) +
  (bystandersLost x 40) +
  (schemeTwistNegatives x 30) +
  (mastermindTacticsUntaken x 10) +
  (scenarioSpecificPenalties x scenarioWeight) +
  lossPenalty -
  (VP x vpReward)
```

> WP-599 / D-24409: **VP is the sole reward term** — the `(BP × bystanderReward)`
> term is removed (rescued bystanders score as 1 VP inside `VP`). Penalty weights are
> the rulebook 4:3:1 anchor rescaled to true VP-units (`bystanderLost 40 /
> schemeTwistNegative 30 / villainEscaped 10`, D-24409, was `400 / 300 / 100`);
> `mastermindTacticUntaken` and `scenarioSpecificPenalty` take a minor in-scale value
> (+10). `lossPenalty` is a flat `LOSS_PENALTY` (800) added only on a lost match. The
> VP reward weight is a scenario-config value (seed default `vpReward 10`).
> WP-585 / D-24394 already removed the `(R × …)` round-cost term.

```
Final Score = Raw Score - PAR
```

Lower is always better. All weights are centesimal integers.

---

## Scenario PAR Definition & Derivation

PAR represents the expected Raw Score for **competent, rules-faithful play** by
experienced players. It is **static** per scenario configuration, deliberately
beatable, and **not** perfect play. PAR is never player-adaptive, session-adaptive,
or dynamically adjusted.

**PAR is determined by simulation before players ever choose heroes, so success
reflects skill — not hindsight adjustment.**

PAR calibration uses a three-phase pipeline: content-driven seeding for immediate
coverage, simulation calibration for accuracy, and post-release refinement for
long-term correctness. This mirrors how golf courses set PAR, how exams set
pass thresholds, and how games set recommended difficulty levels.

Source: Vision goal 26 (Simulation-Calibrated PAR Determination)

### Phase 1: Content-Driven Seed (Immediate Coverage)

Every Mastermind, Scheme, and Villain Group / Henchman Group in the content
registry carries a **Difficulty Rating**: an integer from 1 to 10.

| Rating | Meaning                                         |
|--------|--------------------------------------------------|
| 1-2    | Simple / low threat (e.g., basic henchmen)       |
| 3-4    | Moderate threat (standard villain groups)         |
| 5-6    | Challenging (complex masterminds, tricky schemes) |
| 7-8    | Hard (powerful masterminds, punishing schemes)    |
| 9-10   | Extreme (the hardest content in the game)         |

Difficulty ratings are:
- **Version-controlled** — part of the content data files, not hard-coded logic
- **Assigned once** when a content set is added to the registry
- **Transparent** — visible to players and auditable
- **Calibratable** — refined by simulation data and aggregate play data

The content-driven formula provides an **initial PAR estimate** for any valid
scenario, functional before any simulation has run:

```
PAR_seed = BasePAR
         + (MastermindRating x M_WEIGHT)
         + (SchemeRating x S_WEIGHT)
         + sum(VillainGroupRatings x V_WEIGHT)
         + (PlayerCountAdjustment x P_WEIGHT)
```

All values are centesimal integers.

#### Default Seed Constants

| Constant     | Default Value | Meaning                                     |
|--------------|---------------|---------------------------------------------|
| BasePAR      | 12000         | Baseline difficulty (120.00 points)          |
| M_WEIGHT     | 1200          | Per-point mastermind toughness (12.00)       |
| S_WEIGHT     | 1000          | Per-point scheme complexity (10.00)          |
| V_WEIGHT     | 600           | Per-point villain/henchman group difficulty (6.00) |
| P_WEIGHT     | 500           | Per-step player count adjustment (5.00)      |

#### Player Count Adjustment

| Players | Adjustment | Centesimal Effect |
|---------|------------|-------------------|
| 1       | -1         | -500 (solo is harder per-player) |
| 2       | 0          | 0 (baseline) |
| 3       | +1         | +500 |
| 4       | +2         | +1000 |
| 5-6     | +3         | +1500 |

Content-driven seeding provides **immediate, publishable PAR** for every scenario
at launch. Players know PAR before building their hero team — just like golfers
know course PAR before tee-off. However, seed PAR alone targets ~60-70% accuracy.
Simulation calibration raises this to 80-90%.

#### Implementation note — the `PAR_seed` scalar is a difficulty INDEX, not the stored `parValue` (WP-422 / D-24242)

The `PAR_seed` scalar above (`12000 + Mastermind×1200 + …`) is a **difficulty
index** on its own scale — useful for ranking scenarios, but **not** the literal
`parValue` stored in a seed artifact. The engine's `computeParScore` derives PAR
from a scenario's four-field `ParBaseline` (rounds / bystanders / VP / escapes) on
the **Raw Score scale** — the same scale live `finalScore = rawScore − PAR` and
simulation (Phase 2) use. Those two scales do not coincide: the calibration
example below shows a `26800` content-scalar seed resolving to a `−1200`
simulation PAR. Publishing the `12000+` scalar as `parValue` would make every real
player's `finalScore` nonsensical until simulation replaced it.

So the shipped Seed PAR generator (`scripts/generate-seed-par.mjs`, WP-422) maps a
scenario's composed difficulty → a documented `ParBaseline` template and sets
`parValue = computeParScore(baseline)` on the Raw Score scale, using the adopted
default weights (originally D-24342: round 50 / bystander-reward 200 / VP 10;
penalties 400/300/100/25/40 — **rescaled by WP-599 / D-24409** to VP 10, no
bystander reward, penalties 40/30/10/10/10; the 128 seed artifacts were regenerated
under the new weights). The `12000+` scalar is retained here only as the difficulty
index it always was. Full mapping + default-weight rationale: **D-24242**.

### Phase 2: Simulation Calibration (Pre-Release Accuracy)

Before release of any new content set, the simulation pipeline runs to validate
and refine the content-driven seed PAR.

#### Simulation Inputs

- Scheme, Mastermind, Villain Groups, Henchmen, Player Count
- **No hero choice optimization** — PAR is scenario-only, never hero-dependent
- Heuristic AI policies select heroes randomly from the available pool

#### Heuristic AI Policies

Simulations use **competent heuristic AI** — not perfect play and not random
chaos. The AI models experienced players making reasonable but imperfect
decisions:

- Prefers fighting villains holding bystanders when possible
- Avoids excessive round stalling
- Recruits reasonably synergistic heroes when options exist
- Does not play ultra-conservatively or recklessly
- Makes mistakes at a realistic rate

This abstraction represents exactly the player skill level PAR is calibrated
against: competent, rules-faithful play by experienced players.

AI policy design is specified in WP-036 (AI Playtesting & Balance Simulation).

#### Simulation Volume

Run **hundreds to thousands of games** per scenario configuration. For each
simulated game, compute the Raw Score using the **same scoring formula** players
use. This produces a distribution of Raw Scores per scenario.

#### PAR Selection Rule

**Do not use the mean.** Use a robust percentile:

```
PAR = percentile(simulatedRawScores, 55)
```

The **55th percentile** (slightly above median) is recommended because:
- It accounts for outlier games (extreme luck, both good and bad)
- It produces PAR that is beatable but fair — slightly better than median
  performance is required to reach PAR
- It matches player expectations: PAR should feel achievable but not trivial

If the 55th percentile produces PAR values that feel too easy or too hard during
playtesting, the percentile may be adjusted (50th-60th range) with a
`scoringConfigVersion` bump. The percentile choice itself is a tunable constant,
not a formula change.

#### Simulation Output

For each scenario configuration, simulation produces:

- **PAR** (centesimal integer) — the calibrated PAR value
- **Confidence metadata** (informational, not scored):
  - Sample size (number of simulated games)
  - Standard deviation of Raw Scores
  - Seed PAR vs calibrated PAR delta

If simulation has not yet run for a scenario (e.g., brand-new content), the
content-driven seed PAR is used as a fallback. This is explicitly marked as
`uncalibrated` in the scoring config.

### Complementary Roles: Ratings and Simulation

Content-driven difficulty ratings and simulation calibration serve
**complementary purposes** — neither replaces the other:

| Aspect | Difficulty Ratings | Simulation |
|--------|-------------------|------------|
| **Purpose** | Human-readable explanation | Statistical accuracy |
| **Answers** | "Why is this scenario hard?" | "What does competent play actually score?" |
| **Timing** | Available immediately | Requires AI player (WP-036) |
| **Player-facing** | Visible, debatable | Opaque, precise |
| **Calibration role** | Seeds the formula | Validates and refines the seed |

Players see: *"This is a hard 4-player scenario (Mastermind: 8, Scheme: 7). PAR: 268."*

They don't need to know how many simulations ran. Ratings give meaning;
simulation gives correctness.

### Phase 3: Post-Release Refinement (Long-Term Accuracy)

After launch, real player data further refines PAR:

1. **Collect** — aggregate Raw Scores from competitive submissions (replay-verified
   only)
2. **Compare** — median competent scores vs current PAR per scenario
3. **Adjust** — difficulty ratings and/or seed constants, never the scoring formula
4. **Version** — any change requires a `scoringConfigVersion` bump; existing
   leaderboard entries retain the version they were scored under

Post-release refinement adjusts **difficulty ratings**, not scoring semantics.
This preserves trust: scores already earned are never retroactively invalidated,
replays remain deterministic, and the formula itself is invariant.

### PAR Calibration Example

**Scenario:** Red Skull (Rating 5) with Midtown Bank Robbery (Rating 4),
Hydra (Rating 3) and Masters of Evil (Rating 5), 2 players.

**Phase 1 — Seed PAR:**

```
PAR_seed = 12000 + (5 x 1200) + (4 x 1000) + (3 x 600) + (5 x 600) + (0 x 500)
         = 26800
```

**Phase 2 — Simulation (1000 games):**

```
Simulated Raw Score distribution:
  25th percentile: -2100
  50th percentile (median): -1400
  55th percentile: -1200
  75th percentile: -600
```

```
PAR_calibrated = -1200  (55th percentile)
```

The simulation reveals that the seed PAR (26800) was far from the actual
simulation distribution. The calibrated PAR (-1200) replaces the seed, and the
seed constants may be adjusted to reduce future drift for similar scenarios.

**Phase 3 — Post-release (after 500 real games):**

```
Median real player Raw Score: -1150
Current PAR: -1200
Delta: +50 (PAR is slightly generous)
```

Within acceptable tolerance — no adjustment needed. If the delta exceeded a
threshold (e.g., > 500 centesimal), difficulty ratings would be adjusted and a
new `scoringConfigVersion` published.

### Calibration Invariants

- **Calibration never changes the scoring formula** — only PAR values, difficulty
  ratings, and seed constants
- **Raw Score computation is invariant** — same replay always produces same Raw
  Score regardless of PAR changes
- **No retroactive score invalidation** — existing leaderboard entries keep their
  original `scoringConfigVersion`
- **PAR is always scenario-only** — never adapted to hero selection, player
  history, or luck outcomes

> **Integrity note:** Published PAR values are immutable, cryptographically hashed artifacts; see `12.1-PAR-ARTIFACT-INTEGRITY.md` for the rationale and trust model.

---

## Worked Example (Illustrative Only)

> **Pre-WP-599 scale.** The two worked examples below still use the superseded weights
> (round term, `bystanderReward 300`, `vpReward 50`, penalties `100 / 400 / 300`) and
> the old PAR magnitude, so their arithmetic **does not** match the current formula
> (`RawScore = P − (VP × 10) + lossPenalty`, penalties `10 / 40 / 30`, no round term,
> no bystander reward). They are retained only to illustrate *why Player A beats
> Player B* — the moral hierarchy the model encodes — not the exact numbers. The
> ordering (heroic play wins) is unchanged under the new scale; the magnitudes are
> not. Recomputing them requires a regenerated scenario PAR on the WP-599 scale.

Using the same scenario from the PAR Calibration Example above:

**Scenario:** Red Skull (5) + Midtown Bank Robbery (4) + Hydra (3) + Masters
of Evil (5), 2 Players. **PAR = -1200** (simulation-calibrated, 55th percentile).

### Player A — Heroic, Rescue-Focused

| Component              | Value |
|------------------------|-------|
| R                      | 10    |
| BP (bystanders rescued)| 6     |
| VP                     | 32    |
| villainEscapes         | 2     |
| bystandersLost         | 0     |
| schemeTwistNegatives   | 1     |

```
Raw Score = (10 x 100) + (2 x 100) + (0 x 400) + (1 x 300) - (6 x 300) - (32 x 50)
          = 1000 + 200 + 0 + 300 - 1800 - 1600
          = -1900
```

```
Final Score = -1900 - (-1200) = -700
```

**Result: 7.00 under PAR** — strong, heroic performance.

### Player B — Conservative, Board-Control Focused

| Component              | Value |
|------------------------|-------|
| R                      | 10    |
| BP (bystanders rescued)| 1     |
| VP                     | 38    |
| villainEscapes         | 1     |
| bystandersLost         | 1     |
| schemeTwistNegatives   | 0     |

```
Raw Score = (10 x 100) + (1 x 100) + (1 x 400) + (0 x 300) - (1 x 300) - (38 x 50)
          = 1000 + 100 + 400 + 0 - 300 - 1900
          = -700
```

```
Final Score = -700 - (-1200) = 500
```

**Result: 5.00 over PAR** — competent but unheroic.

### Why Player A Wins Decisively

Player A is **7.00 under PAR**; Player B is **5.00 over PAR** — a 12.00-point
gap. Player A let more villains escape but saved every civilian. Player B had
better board control and higher VP, but lost a bystander — which under the
rulebook 4:3:1 anchor now costs four times what an escape does, widening the gap
from 11.00 to 12.00 and sharpening exactly the hierarchy the model exists to encode. The simulation-
calibrated PAR places both results in a meaningful range: Player A clearly
outperformed competent play, while Player B fell short.

---

## Leaderboard Display & Tiebreakers

Leaderboards show:
- **Final Score** (displayed as X.XX under / at / over PAR)
- **Component breakdown** (R, BP, VP, penalty events — full transparency)
- **Hero composition**
- **Scenario identifier** (Scheme + Mastermind + Villain groups)

**Sorting:** Strictly by Final Score (ascending — lower is better).

**Tiebreakers** (in order):
1. Fewer rounds played
2. Fewer total penalty events
3. Earlier completion timestamp

---

## Score Provenance Requirements

Every leaderboard entry must be:

1. **Logged** — derived entirely from the authoritative game log
2. **Replay-derivable** — re-computable from the replay record
3. **Scenario-defined** — using weights published for that scenario
4. **Deterministic** — identical replay produces identical score
5. **Version-tagged** — stamped with the exact `scoringConfigVersion` used

No score component may exist that cannot be verified through replay.

Source: Vision goal 22 (Deterministic & Reproducible Evaluation),
Vision goal 24 (Replay-Verified Competitive Integrity)

---

## Design Guardrails

### Permitted

- Scenario-specific weight tuning (while preserving structural invariants)
- Scenario-specific bystander caps
- Scenario-specific penalty event definitions
- Adding new penalty event types (with scenario-level weight definitions)

### Prohibited

- Per-player modifiers or handicaps in scoring
- Per-hero modifiers or hero-specific scoring bonuses
- Hidden caps without documentation
- RNG normalization after the fact (luck adjustment)
- Factors not derivable from the game log
- Subjective or heuristic scoring components
- Time-of-day, session-count, or play-frequency modifiers
- Weight configurations that violate structural invariants

---

## Anti-Exploit Clauses

**Bystander Farming:** Enforced by scenario-specific cap. Rescues beyond the cap
contribute zero additional score benefit.

**VP Grinding:** Sub-linear VP reward keeps VP-farming unprofitable relative to the
penalties a longer game accrues.

**Round Stalling (WP-585 / D-24394):** There is no direct round penalty. Stalling is
punished indirectly: the longer the game runs, the more Scheme/Plot Twists are revealed,
and each twist adds `+30` to Raw Score (the rulebook's own length proxy). A team that
drags the game out reveals more twists and scores worse.

**Conservative Play:** Moral hierarchy prevents "ignore civilians for board
control" from dominating. Players who take risks to save bystanders outscore
players who play conservatively — even if the risk-taker lets more villains
escape.

**Discovered Exploits:** Documented in this reference, neutralized via scenario
weights (respecting invariants), never retroactively invalidated, logged in
`docs/ai/DECISIONS.md`.

---

## Future Extensions

The following are anticipated but not yet defined:

- **Tournament scoring** — multi-scenario aggregate scoring rules
- **Score decay** — whether historical scores are re-evaluated when PAR changes
- **Cooperative scoring** — per-player contribution metrics (informational, not
  competitive)

These will be specified in separate documents when the engine supports them.

---

## Explicit Non-Goal

This model is **not** intended to dictate the correct way to play Marvel
Legendary. It exists solely to make skill visible, improvement measurable,
and heroism rewarding.

If players argue more about the **formula** than the **gameplay**, the model
has failed and must be revised.

Source: Vision goal 25 (Skill Over Repetition)

---

## Endgame Report Card (Display Surface)

The endgame report card (`apps/arena-client/src/components/hud/EndgameSummary.vue`)
renders the server-returned `ScoreBreakdown` **verbatim** — it never recomputes a
score client-side. Three presentation layers sit on top of that breakdown (WP-593 /
D-24402):

- **Named players.** The per-player VP/bystander split labels each seat
  `Player 1 (Bot)` / `Player 2 (@handle)` from a DERIVED, non-persisted
  `seatIdentities` roster (`{ playerId, isBot, handle }`) the server attaches to the
  `POST /api/competition/scores` response beside the record. It is built from the
  seat→account map (WP-333), the bot-ally tag (WP-375), and `legendary.players.display_handle`;
  it is **never** a `CompetitiveScoreRecord` column and is **never** persisted. A
  seat that maps to neither a bot nor a handled account renders as plain `Player N`.
- **Raw-score ledger.** The raw score is shown as a two-sided ledger — penalty lines
  (positive; they raise the score) beside the earned-reward line (VP; shown
  subtracted) — netting to the verbatim `rawScore`. As of WP-599 / D-24409 VP is the
  sole earned line (rescued bystanders score as 1 VP inside it); the rescued-bystander
  count is shown as an informational stat, not a separate scored line. A lost match
  shows its `weightedLossPenalty` as its own penalty line.
- **Luck of the draw.** An OBJECTIVE, deterministic read of how favorable the shuffle
  was: the match's actual adversity (`schemeTwistNegative` + `villainEscaped` +
  `bystanderLost` counts) versus the scenario's PAR expectation (`schemeTwistsPar` +
  `escapesPar` + `bystandersLostPar`). The actual/expected ratio bands to
  `favorable` (≤ 0.75), `difficult` (≥ 1.35), or `average`, framed encouragingly.
  It is computed from the breakdown only — never from deck order, which the engine
  never projects — and is absent for records with no WP-591 adversity baseline.

The opinionated hero/purchase coaching (a Legendary-Pass-gated LLM feature) is a
separate future arc (WP-B), not part of this display surface.

## Relationship to Other Documents

| Document | Relationship |
|----------|-------------|
| `01-VISION.md` (goals 20-26) | Authoritative — this document implements those goals |
| `docs/ai/ARCHITECTURE.md` | Authoritative — scoring engine must follow architecture rules |
| `docs/ai/DECISIONS.md` | Log any weight changes or anti-exploit adjustments here |
| `WP-048` | Engine implementation contract — implements this reference model |
| `EC-048` | Execution checklist — enforces locked values from this reference |
| `12.1-PAR-ARTIFACT-INTEGRITY.md` | Explains why PAR artifacts are hashed (rationale, not contract) |
| `WP-049` | PAR simulation engine — implements Phase 2 calibration pipeline |
| `EC-049` | Execution checklist — enforces simulation and T2 policy contracts |
| Content Registry | Difficulty ratings feed PAR derivation formula (Phase 1) |
| Future: Tournament Rules | Will define multi-scenario aggregate scoring |

---

**This document is a living reference model, not locked math.**
Weights and constants may be refined with real play data, but only while
respecting every structural invariant and Vision goal. All changes are
version-controlled and never retroactive.

This is how Legendary Arena turns every game into a measurable act of heroism.
