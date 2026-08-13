---
title: Gameplay Strategy
type: Guide
tags:
  - gameplay
  - strategy
  - skill
  - hero-deck
  - hq
  - setup
  - par
  - scoring
  - research
related:
  - scoring.md
  - par-simulation-calibration.md
  - narrative-psychology.md
  - dopamine-triggers.md
  - turn-system.md
  - villain-deck.md
  - scheme.md
  - master-strike.md
  - vision.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\gameplay-strategy.md (this page — https://ewiki.legendary-arena.com/gameplay-strategy/)
  - ../docs/legendary-universal-rules-v23.md
  - ../docs/01-VISION.md
  - ../docs/12-SCORING-REFERENCE.md
  - ../packages/game-engine/src/scoring/parScoring.logic.ts
last-reviewed: 2026-08-13
---

# Gameplay Strategy

## Summary

This page is the **skill model** for a Legendary Arena match — a
descriptive map of *where skill actually lives* in the ruleset, ranked by
long-term-plus-in-the-moment impact. It is the missing companion the rest
of the wiki assumes: [Scoring](scoring.md) measures skill (PAR is the
score a *competent, rules-faithful* team should reach), the
[PAR Simulation Calibration](par-simulation-calibration.md) heuristic AI
*performs* competent play to compute that baseline, and the
[Dopamine](dopamine-triggers.md) and [Narrative](narrative-psychology.md)
frameworks promise to *reward the skill, not the luck* — but none of them
spell out what the skilled decisions are. This page does.

Legendary Arena follows the Marvel Legendary ruleset, so the decision
hierarchy here is the physical game's, verified against
[the v23 universal rules](../docs/legendary-universal-rules-v23.md). It is
**descriptive of the ruleset**, not prescriptive coaching and not a
governance document — it defines no rule, sets no policy, and cites the
rules text and VISION for every mechanical claim. The strategic *analysis*
(build-style taxonomy, the class-synergy math) is illustrative reasoning,
which is why this page is `draft`: the authoritative distributions come
from the PAR Monte-Carlo pipeline, not from the estimates here.

## Mechanics

### Where skill lives — the ranked decision hierarchy {#decision-hierarchy}

Most of a match's *outcome variance* is the luck of the draw and the random
order of the Villain Deck. The **skill** lives in a small set of recurring
decisions. Ranked by combined long-term and in-the-moment leverage:

| Rank | Decision | Why it ranks here |
|---|---|---|
| **0** | **Which Heroes go into the Hero Deck** (given the Mastermind + Scheme) | The single highest-leverage decision in the game. It sets the shared pool everything else draws from — every later recruit is downstream of it. See [Rank 0](#rank-0). |
| **1** | **Order and selection of cards played from hand** | Superpowers, class synergies, and many keywords only fire based on play order and what has already been played this turn. Pure skill, every turn. See [Rank 1](#rank-1). |
| **2** | **Fighting the Mastermind — when, and how many Tactics** | High-stakes and distinct from clearing the City. Timing the first Tactic (and how many in one turn) is one of the biggest skill expressions in the game. See [Rank 2](#rank-2). |
| **3** | **What (and whether) to recruit from the HQ** | Builds the long-term engine; includes interleaving recruits with fights and chaining off newly-revealed HQ cards. See [Rank 3](#ranks-3-5). |
| **4** | **What City Villains to attack** | Immediate board control and victory points; the reactive half of tempo. See [Ranks 3–5](#ranks-3-5). |
| **5** | **What cards to KO** | Mostly reactive — escapes force a choice; some effects grant voluntary KOs. The deliberate side of this is [deck thinning](#deck-thinning). |

Two refinements distinguish this ranking from a naïve one:

- **Mastermind fighting is not "just another City Villain."** Choosing when
  to start taking Tactics is a separate, higher-stakes decision than
  clearing the City, so it sits at Rank 2 — above recruiting and City
  combat.
- **Hero Deck construction is the true Rank 0.** It is not a move inside the
  match; it is the setup decision the entire match's texture flows from.

### Rank 0 — Hero Deck construction {#rank-0}

The Hero Deck is a **shared, finite pool** all players recruit from through
the whole game. The HQ is only a five-card window into it. Because every
recruit later is downstream of what went into this deck, construction is the
highest-return decision available.

**The construction rules** (per
[the v23 universal rules](../docs/legendary-universal-rules-v23.md),
*The Hero/Ally Deck*):

- Choose a number of Heroes from the game's setup table — **3** in
  1-player solo, **5** at 2–4 players, **6** at 5 players.
- For each chosen Hero, add **all 14 of that Hero's cards** to the shared
  Hero Deck. The standard 14-card spread is two commons (5 copies each),
  one uncommon (3 copies), and one rare.
- Total Hero Deck size is therefore **42** (3 Heroes), **70** (5), or
  **84** (6). Shuffle it, then flip the top **5** cards face-up into the HQ.
- Whenever an HQ space empties (recruit or KO), refill it immediately from
  the top of the Hero Deck.

Each player's own **12-card starting deck** (8 S.H.I.E.L.D. Agents +
4 S.H.I.E.L.D. Troopers, drawing a 6-card hand) is **not** part of the Hero
Deck — it is personal and identical across players at the start.

**Why it's Rank 0.** The Hero Deck determines, for the whole match:

1. **What is recruitable at all** — the HQ is just the visible slice.
2. **Class and team synergy density** — Superpowers fire only when the
   required class/team was played earlier that turn, so a pool concentrated
   in one or two classes is dramatically stronger than a scattered one (see
   [the class-synergy math](#synergy-math)).
3. **Cost curve and tempo** — cheap Heroes recruit early and often;
   expensive ones are powerful but can clog the HQ.
4. **Keyword density** — some keywords only become an *engine* rather than a
   surprise when several supporting Heroes are present.
5. **Matchup fit** — some Heroes are much better or worse against a specific
   Mastermind or Scheme, so the pick is ideally made *after* the Mastermind
   and Scheme are known.

**Common build styles** (illustrative, not a closed set):

- **Focused class build** — 3–4 Heroes sharing one or two classes;
  Superpowers fire constantly. Usually the strongest raw-power approach.
- **Team identity build** — lean into one team (X-Men, Avengers, S.H.I.E.L.D.)
  for team-specific abilities and a stronger motif identity.
- **Keyword engine** — stack multiple Heroes that share one powerful keyword
  so it becomes reliable rather than occasional.
- **Scheme/Mastermind counter** — pick Heroes that specifically answer the
  chosen Mastermind or Scheme.
- **Balanced "good stuff"** — the five strongest individual Heroes
  regardless of synergy; safer for newer players, usually weaker than a
  focused build.

### The class-synergy math {#synergy-math}

Most Superpowers read: *"if you have already played a [Class] card this turn,
[effect]."* The enabler must be played **before** the Superpower card, so the
value depends on how often you can draw two same-class cards into one hand
and sequence them.

This is a hypergeometric problem, and the intuition is steep, not linear.
The important causal subtlety: the 70-card **Hero Deck** density sets what is
*available to recruit*, but the cards you actually **draw** come from your
**personal deck** — so draw-time synergy is governed by the class density you
build into your personal deck by recruiting from the pool and by
[thinning](#deck-thinning) the colorless starters out. Construction sets the
ceiling; recruiting and thinning realize it.

As a rough, **illustrative** picture of a single mid-game draw once the
starters are thinned:

| Personal-deck class focus | Approx. share of one class | Feel of Superpower firing |
|---|---|---|
| **Heavy** (stacked one class) | ~40–50% | Reliable engine — most turns |
| **Moderate** (two primary classes) | ~30–40% | A regular part of turns |
| **Balanced / scattered** | ~15–25% | An occasional pleasant surprise |

Two practical rules of thumb fall out:

- **Two-class focus is usually the sweet spot** — one class maximizes raw
  consistency but is fragile to class-hate and forgoes multi-class bonuses;
  three-plus primaries dilute Superpowers back toward unreliable.
- **Order control multiplies the advantage** — once you *hold* two class
  cards, [play sequencing](#rank-1) (enabler first) is what converts the draw
  into an actual trigger. The math sets the odds; skill cashes them.

> These buckets are order-of-magnitude intuition, not measured values. The
> **authoritative** consistency numbers for a given scenario come from the
> [PAR Simulation Calibration](par-simulation-calibration.md) Monte-Carlo
> pipeline, which plays hundreds of complete games and reports the real
> distribution — not from the estimates in this table.

### Rank 1 — Play order and selection {#rank-1}

Which cards you play from hand, and in what order, is pure skill exercised
every turn. Superpowers and class-gated effects only fire if their enabler
was played earlier in the same turn, so the same hand can produce a small or
a large turn depending entirely on sequencing. This is the moment-to-moment
craft the [Dopamine framework](dopamine-triggers.md)'s escalating-combo
reward pays off — a well-ordered hand is what makes `lastPlayEffectsFired`
climb.

### Rank 2 — Fighting the Mastermind {#rank-2}

Defeating the Mastermind means taking its **Tactics**, and *when* to start —
and how many to take in one turn — is a distinct, high-stakes decision
separate from clearing the City. Committing a big turn to Mastermind damage
trades tempo elsewhere; mistiming it can leave the final Tactic unreachable.
See [Master Strike](master-strike.md) for the antagonist side of the
Mastermind, and [Scoring](scoring.md) for how an untaken final Tactic is
*specified* to penalize a score (the `mastermindTacticUntaken` penalty —
note it has no engine producer yet).

### Ranks 3–5 — Recruit, City combat, KO {#ranks-3-5}

- **Rank 3 — Recruiting from the HQ** builds the long-term engine. A key
  skill is **interleaving**: recruits and fights may be taken in any order,
  and each recruit refills the HQ with a new face-up card, which can change
  what is available for the *next* decision that same turn.
- **Rank 4 — City combat** is immediate board control and victory points —
  the reactive half of tempo, constrained by what the Villain Deck reveals.
- **Rank 5 — KO** is mostly reactive: an escaping Villain forces you to KO
  an HQ Hero that costs 6 or less. Its *deliberate* form is
  [deck thinning](#deck-thinning).

### Deck thinning — the second-highest lever {#deck-thinning}

After construction and class focus, **thinning** is the highest-return
skill. Every game starts with 12 weak S.H.I.E.L.D. cards that dilute your
powerful Hero cards on every shuffle; permanently removing them raises the
density that makes Superpowers and synergies fire (the same density the
[synergy math](#synergy-math) turns on). Thinning is why strong KO Heroes are
often drafted even when they are not the highest raw Attack — they accelerate
the consistency curve.

The recurring pattern skilled players follow:

1. Clear **Wounds** first — they are pure dead cards.
2. Remove **starting S.H.I.E.L.D. cards** early, while the deck is still full
   of high-value Heroes.
3. Trim **off-class / low-synergy** Heroes once the deck is already tight.
4. Protect the **enablers and the KO-engine cards themselves** — don't thin
   away the machinery that does the thinning, or your key class enablers.

The failure modes are symmetrical: thinning too slowly leaves a diluted deck
all game; over-thinning (especially in multiplayer) can run you out of cards
into awkward reshuffles or dead turns.

### The decisions that aren't in the top list {#other-decisions}

Several real, non-luck choices recur below the headline ranking:

- **Interleaving recruit and fight.** The order is free and it matters —
  e.g. recruiting to change HQ costs before a cost-sensitive fight, or
  recruiting after a new card appears.
- **Optional "you may" abilities that reshape a turn.** Many effects are
  opt-in: **Dodge** (discard a card from hand to draw and sculpt your hand),
  **Excessive Violence** (once per turn, spend one more than needed to
  trigger an extra Attack ability), and card-specific **Healing** and
  **Focus** effects. Each is a small decision that can change a turn's
  shape. Precise per-keyword semantics live in the
  [v23 rules glossary](../docs/legendary-universal-rules-v23.md), not here.
- **The escape KO choice.** When a Villain escapes, *you* choose which
  cost-≤6 HQ Hero is KO'd — a real decision, often best spent removing a
  low-synergy or off-class Hero so future HQ refills stay on-theme.
- **The setup HQ mulligan.** If the opening HQ holds at least two cards
  costing 7 or more, all players may agree to set those aside, refill, and
  shuffle them back — a setup-only lever against an overly expensive opening
  HQ (introduced in *What If…?*).

### The four coachable layers {#coaching-layers}

The [decision hierarchy](#decision-hierarchy) ranks *where skill lives*; this
is the same skill viewed from the outside — the small set of **observable
dimensions** an analytics or coaching layer could grade a played turn against.
It is the companion of the
[Dopamine framework's card-counting section](dopamine-triggers.md#card-counting),
which frames these four as the skills the reward loop honours; this page grounds
each one in a rank above. Descriptive, as ever: these are the axes a coach
*would measure*, not coaching advice this page hands out.

| Layer | The skill it measures | Grounded in | Graded against |
|---|---|---|---|
| **Sequencing** | Play order within a turn — enabler before payoff so the chain fires | [Rank 1](#rank-1) | The best ordering of the actual hand |
| **Acquisition** | *What* to recruit and *when* — building the engine and trimming the dilution | [Rank 0](#rank-0) / [Rank 3](#ranks-3-5) / [thinning](#deck-thinning) | Class-focus and thinning value for the matchup |
| **Anticipation** | Reading the known deck — banking recruit capacity for a statistically-due card | [Rank 3](#ranks-3-5) recruiting, against the known [Hero Deck](#rank-0) composition | The probability inferable from visible play |
| **Efficiency** | The whole turn measured against a competent line | the full hierarchy | [PAR](par-simulation-calibration.md) — the machine performance of these decisions |

**Anticipation is the axis the ranking above understates.** The Hero Deck is a
*known, finite* pool — all 14 of a Hero's cards, with fixed counts of each (see
[Rank 0](#rank-0)) — so a player who tracks what has already surfaced can reason
about what is still coming: the rare high-cost card that hasn't appeared is
increasingly *due*, which argues for banking recruit power now to seize it when
it hits the HQ. That is probability-tracking from public information — the
deck-builder's card counting — and it rides entirely on the
[Rank 3](#ranks-3-5) recruit and interleaving decisions, never on hidden state.

**Why efficiency sits apart from the other three.** Sequencing, acquisition,
and anticipation are levers *the player pulls*; efficiency is the *scoreboard* —
one number for how the whole turn compared to the line a competent team would
have taken, which is exactly what [PAR](par-simulation-calibration.md) computes.
A coaching layer built on these four would surface the first three as teachable
levers and efficiency as the aggregate they roll up into.

## Interactions

- **[Scoring](scoring.md).** Scoring is the *measurement* of the skill this
  page describes. PAR (Layer A) is the outcome a *competent* team should
  reach; a good Final Score means the decisions here were made well. The
  `mastermindTacticUntaken` penalty is the scoring hook for the
  [Rank 2](#rank-2) Mastermind-timing decision.
- **[PAR Simulation Calibration](par-simulation-calibration.md).** The
  heuristic AI that computes PAR is a *machine performance* of this decision
  hierarchy — it plays complete games making these choices, and its score
  distribution is the authoritative source for the
  [synergy consistency numbers](#synergy-math) this page only estimates.
- **[Dopamine Trigger Framework](dopamine-triggers.md).** Its "reward the
  skill, not the luck" invariant refers directly to the decisions here — the
  escalating-combo payoff is attributed to the player's
  [construction](#rank-0) and [play order](#rank-1), not to randomness. Its
  [card-counting section](dopamine-triggers.md#card-counting) and the
  [four coachable layers](#coaching-layers) here are two views of the same
  skill axes — the reward-side framing and the decision-side grounding.
- **[Narrative Psychology Framework](narrative-psychology.md).** Its
  **Agency** hook ("I act on the world") and **Archetype** hook are the
  meaning-side of [Hero Deck construction](#rank-0) and thinning — the player
  authoring their team and their deck's quality.
- **[Turn System](turn-system.md).** The stage cycle is the frame the
  [play-order](#rank-1) and interleaving decisions happen inside.
- **[Villain Deck](villain-deck.md)** and **[Scheme](scheme.md).** The source
  of the luck the skill is expressed *against* — the random reveal order and
  the Scheme/Mastermind matchup the [construction](#rank-0) decision answers.

## Edge Cases

- **The synergy tables are illustrative, not measured.** The density buckets
  in [the synergy math](#synergy-math) are hypergeometric intuition to
  explain *why* focus matters — they are not calibrated probabilities. Cite
  the [PAR simulation](par-simulation-calibration.md) for real numbers, never
  this table.
- **Hero Deck density ≠ hand density.** Construction sets the recruitable
  *pool*; what you draw comes from your *personal* deck. The pool's class
  focus only becomes draw-time consistency after you recruit from it and thin
  the starters — a step the naïve "cards in a 6-card hand" framing skips.
- **This page is descriptive, not a rulebook.** Where a precise mechanic
  matters (exact keyword text, Tactic counts, Scheme specifics), the
  authoritative source is
  [the v23 rules](../docs/legendary-universal-rules-v23.md) — this page
  paraphrases and may lag a specific card's wording.
- **Solo changes the weights.** At 3 Heroes (42-card deck) focused synergy
  matters even more, and several setup quantities shrink; the ranking's
  *shape* holds but the margins move.
- **Marvel characters are licensed IP.** This page discusses roles and
  archetypes at a strategic level; it reproduces no card text or bios.

## Open Questions

- **Should the skill model feed the bot heuristic explicitly?** The
  [PAR heuristic AI](par-simulation-calibration.md) already encodes a
  competent policy; whether this ranking should be reconciled with (or
  derived from) that policy — so the documented skill model and the simulated
  one cannot drift — is unresolved. Check the PAR logic before treating this
  ranking as the bot's contract.
- **Player-facing vs internal.** Per [SCHEMA.md](SCHEMA.md) the wiki is an
  internal engineering reference, not a player guide. If this content is ever
  surfaced to players (a strategy page on `www.` or in-client onboarding), it
  should be reframed and re-homed there rather than linked from the ewiki.

## References

- [`docs/legendary-universal-rules-v23.md`](../docs/legendary-universal-rules-v23.md)
  — *The Hero/Ally Deck* (14-card spread, setup table, HQ refill), *Starting
  HQ Mulligan*, escape KO (cost ≤ 6), and the Dodge / Excessive Violence /
  Healing / Focus keyword glossary
- [`docs/01-VISION.md`](../docs/01-VISION.md) §20–26 — the skill-vs-luck
  framing and PAR as the "competent play" baseline this page is the model for
- [`docs/12-SCORING-REFERENCE.md`](../docs/12-SCORING-REFERENCE.md) — how the
  quality of these decisions becomes a Final Score
- [Scoring](scoring.md), [PAR Simulation Calibration](par-simulation-calibration.md)
  — the measurement and the machine performance of this decision hierarchy
- [Dopamine Trigger Framework](dopamine-triggers.md),
  [Narrative Psychology Framework](narrative-psychology.md) — the feel layers
  that reward this skill and give it meaning
- [Turn System](turn-system.md), [Villain Deck](villain-deck.md),
  [Scheme](scheme.md), [Master Strike](master-strike.md) — the mechanical
  frame the decisions operate within
