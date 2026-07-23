---
title: Dopamine Trigger Framework
type: Guide
tags:
  - design-system
  - psychology
  - reward
  - juice
  - pacing
  - arena-client
  - research
related:
  - design-system-overview.md
  - visual-effects.md
  - sound-effects.md
  - narrative-psychology.md
  - turn-system.md
  - villain-deck.md
  - vision.md
  - monetization-model.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\dopamine-triggers.md (this page — https://ewiki.legendary-arena.com/dopamine-triggers/)
  - ../packages/game-engine/src/events/notableEvents.types.ts
  - ../packages/game-engine/src/ui/uiState.types.ts
  - ../packages/game-engine/src/moves/coreMoves.impl.ts
  - ../packages/game-engine/src/endgame/endgame.types.ts
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/01-VISION.md
last-reviewed: 2026-07-22
---

# Dopamine Trigger Framework

## Summary

This page is the **reward-psychology reference** for
`play.legendary-arena.com` — the "why is this loop satisfying?" layer that
sits underneath the [Visual Effects](visual-effects.md) and
[Sound Effects](sound-effects.md) frameworks. Those two pages decide *what*
a moment looks and sounds like; this page explains *why* a given moment
lands as a reward, a threat, or a relief, and how to **pace and time** the
sensory cues so the payoff feels earned rather than noisy.

It maps the [shared trigger spine](design-system-overview.md#shared-trigger-spine)
to the small set of reward mechanisms that actually drive satisfaction in a
deck-builder: **variable reward** (you don't know what the villain deck
will reveal), **escalating reward** (a synergy chain that keeps paying
off), **loss aversion** (the escape and scheme counters climbing toward
defeat), and the **peak-end** shape of a match (the finale carries
disproportionate emotional weight). Each maps to signals the client already
receives, so the framework is buildable on the same client-side reaction
surface as visual and audio.

This is **engagement craft, not compulsion engineering.** Legendary Arena's
satisfaction comes from *good play being visibly rewarded* — a well-built
synergy chain, a clutch rescue, a Mastermind vanquished. Per
[Vision](vision.md), the game never gates play behind spend and is never
pay-to-win ([Monetization Model](monetization-model.md)); the reward loop
lives entirely inside the free game. This page documents how to make winning
*feel* as good as it is, and nothing more.

No feel-layer code beyond the shipped audio foundation ships today — this is
`draft` research. Only the event vocabulary, the projected `UIState`
signals, and the architectural boundaries are sourced to code; the pacing
and reward mappings are proposals.

**How to read this page.** The [Dopamine Contract](#dopamine-contract) below
is the **fixed governance layer** — the reward classification, pacing
invariants, and bright lines a future Work Packet is judged against. The
[Mechanics](#mechanics) are **design detail** (evolvable), and
[Decisions Pending](#decisions-pending) / [Deferred](#deferred) are the
**roadmap**.

## Dopamine Contract

This section is the **immovable governance layer** of the page. The reward
*psychology* below it may evolve; the classification, the pacing
invariants, and the bright lines here may not without a `DECISIONS.md`
entry.

### What this layer is — and is not

The Dopamine framework is **not its own code layer** and emits nothing at
runtime. It is a **pacing + priority contract** the
[Visual Effects](visual-effects.md) and [Sound Effects](sound-effects.md)
layers implement. Its deliverables are a reward classification, a priority
ranking, and timing/sequencing rules those two layers honour — never a
runtime of its own.

### Reward classification (locked vocabulary)

Every spine event resolves to one of four classes; both sensory layers must
treat them consistently:

| Class | Spine events | Cue posture |
|---|---|---|
| **Reward** | `fightResolved`, `mastermindDefeated`, `healResolved`, a combo (`lastPlayEffectsFired >= 1`) | Celebrate — the positive payoff |
| **Threat** | `mastermindStrikeResolved`, `schemeTwistResolved`, `ambushResolved`, rising `escapedVillains` / `scheme.twistCount` | Menace — **never** a positive cue |
| **Relief** | a Master Strike survived without disaster, a City threat cleared (`fightResolved`), `healResolved` | The exhale after tension |
| **Resolution** | `heroes-win` / `scheme-wins` / `tie` | The peak-end finale — weighted heaviest |

### Pacing invariants (MUST)

- **Contrast through restraint** — the big treatments are reserved for
  peaks; routine actions stay subtle.
- **Anticipation before payoff** — a micro-beat of build-up precedes the
  resolution cue.
- **One crescendo per resolved move** — simultaneous events merge or
  sequence into a single crescendo, never a collision.
- **Reward the skill, not the luck** — the escalating-combo payoff is
  attributed to the player's deck-building, not to randomness.

### Non-Goals — this framework MUST NOT

- add any engine or determinism footprint (it is pure client-side pacing);
- fire a positive cue when the menace rises (threat is tension, not reward);
- introduce any reward that gates play, pressures spend, manufactures
  scarcity, or builds a compulsion loop — the [Vision](vision.md) bright
  lines ([Monetization Model](monetization-model.md)) are hard boundaries,
  not guidance.

The reward loop lives entirely inside the **free game.**

## Mechanics

### Priority tiers {#priority-tiers}

Reward weight ranks which moments earn the biggest sensory budget; a Work
Packet times the cues in this order rather than treating every reward
equally:

**Tier 1 — Peaks** (the biggest budget):

- The endgame finale (`heroes-win` / `scheme-wins` / `tie`) — peak-end
- A Mastermind vanquished (`mastermindDefeated`)
- A 3+ synergy chain (`lastPlayEffectsFired >= 3`)

**Tier 2 — Standard rewards & reliefs**:

- `fightResolved` (with the bystander flourish when one is freed)
- 1–2 combo chains
- `healResolved`

**Tier 3 — Ambient & tension pacing**:

- Rising-menace ambient treatment (`escapedVillains` / `scheme.twistCount`)
- Difficulty ↔ reward coupling (a clutch win near the escape cap feels
  bigger)

### The five reward mechanisms

Each mechanism is a *pattern* in how the spine's events arrive over time —
not a new signal. The client already has everything needed to detect them.

#### 1. Variable reward — the villain-deck reveal

The single strongest satisfaction driver in the game is **not knowing what
comes next.** Every villain-deck reveal
([Villain Deck](villain-deck.md)) is a sealed outcome — a harmless card, a
menacing Ambush, a Scheme Twist, or a Master Strike — resolved from a
deterministic-but-player-unknown shuffle (`ctx.random`, so it replays
identically yet feels random *to the player*). That variable-ratio shape is
the classic reason "flip the top card" is compelling.

- **Design use:** give the *reveal itself* a beat of anticipation before the
  outcome cue resolves — a brief hold, then the payoff. The
  [Turn System](turn-system.md) reveal step is the anticipation window; the
  `notableEvents` (`ambushResolved` / `schemeTwistResolved` /
  `mastermindStrikeResolved`) are the resolution.
- **Guardrail:** the variability is *in the game's own randomness*, which
  the player already accepted by sitting down — it is not a manufactured
  loot-box or a spend-gated pull.

#### 2. Escalating reward — the synergy chain (the flagship)

The chain-reaction combo is a **compounding** reward: one card's effect
fires another, and another, and each step should pay off bigger than the
last. This is the dopamine engine behind the
[combo flash](visual-effects.md#combo-signal)
and the [combo cue](sound-effects.md#tiered-combo), and it rides the live
`UIState.game.lastPlayEffectsFired` count (D-24221).

| `lastPlayEffectsFired` | Reward feel | Why it lands |
|---|---|---|
| `1` | "That worked." | Baseline confirmation — the play did something |
| `2` | "Oh — it *linked*." | The surprise of a second effect firing unprompted |
| `>= 3` | "I *built* this." | Attribution of a big payoff to the player's own deck-building skill — the deepest satisfaction a deck-builder offers |

- **Design use:** the ascending visual/audio tiers must **peak together**
  and land *after* a micro-beat of build-up, so a 3-chain reads as a
  crescendo the player caused, not a random flash. Reward the *skill*, not
  the luck.

#### 3. Loss aversion — the menace counters

Losing hurts more than winning feels good — so the villains *closing in* is
a potent (negative) driver that makes the eventual win sweeter. Two
already-projected counters climb toward defeat:

- `UIState.progress.escapedVillains` → loss at `ESCAPE_LIMIT` (8).
- `UIState.scheme.twistCount` → the scheme completes at its own limit
  (`schemeLoss` flips terminal).

- **Design use:** this is the emotional core of the *adaptive danger-meter
  score* on [Sound Effects](sound-effects.md)
  and a candidate for a rising *ambient* visual menace. Pressure builds
  tension; relieving it (defeating the threat, see below) is the reward.

#### 4. Relief — defeating the threat / healing

Reward isn't only positive gains; **removing a threat** is its own hit.
`fightResolved` (a villain cleared from the City), `healResolved` (wounds
KO'd), and a Master Strike *survived* without disaster are relief beats —
the tension built by loss-aversion, discharged.

- **Design use:** pair the relief cue's *character* to the tension it
  discharges — a bigger exhale after a bigger scare.

#### 5. Peak-end — the finale carries the memory

Players remember a session by its **emotional peak** and its **ending**
(the peak-end rule), far more than its average. The three endgame outcomes
(`heroes-win` / `scheme-wins` / `tie`) are the disproportionately-weighted
end beat — which is exactly why the [visual finale](visual-effects.md#endgame)
and the [endgame stinger](sound-effects.md) get
the biggest treatment in the game.

- **Design use:** spend the effect budget lavishly on the finale and on the
  single biggest mid-match peak (a Mastermind vanquished). A restrained
  early game makes the peak read as a peak.

### Pacing — the discipline that separates juice from noise

More cues is not more dopamine. The mechanisms above only pay off if they
are **spaced and prioritized**:

- **Contrast requires restraint.** If every card play triggers a
  full-screen flourish, nothing feels special. Reserve the big treatments
  for the peaks (3+ combos, defeats, the finale) and keep routine actions
  (draw, single-effect play) subtle.
- **Anticipation before payoff.** A micro-beat of build-up (the reveal hold,
  the combo crescendo) makes the resolution land harder than an instant
  flash.
- **Don't stack simultaneous peaks into mud.** When several events resolve
  in one move (a fight that triggers a chain that rescues a bystander),
  sequence or merge the cues so they read as one crescendo, not a collision.
- **Fatigue is real.** Repetitive identical cues dull fast; vary within a
  tier (the [motif](music-authoring.md#motif-matrix) layer does this for
  audio by keying to the acting hero).

### Where this framework lives

Nowhere new. The Dopamine framework is **not its own code layer** — it is
the *timing and priority contract* that the
[Visual Effects](visual-effects.md) and [Sound Effects](sound-effects.md)
layers implement. It reads the same client-side `UIState` reaction surface
(per [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md), engine owns truth, UI
consumes read-only projections), adds zero engine footprint, and expresses
itself entirely through *how* the two sensory layers schedule their cues.
Concretely, it becomes: an effect-priority table, a per-tier build-up
timing, and a "one crescendo per resolved move" sequencing rule shared by
both layers.

## Interactions

- **[Design System Overview](design-system-overview.md).** The parent hub;
  its [shared trigger spine](design-system-overview.md#shared-trigger-spine)
  has a "Dopamine" column that this page expands — reward vs threat vs
  relief per event.
- **[Visual Effects](visual-effects.md)** and
  **[Sound Effects](sound-effects.md).** This framework is the *why and
  when* behind their *what*; the three must agree on which moments are peaks
  and how build-up is timed.
- **[Narrative Psychology](narrative-psychology.md).** The complementary
  driver — dopamine is the *reward* hook, narrative is the *meaning* hook.
  A Mastermind defeat is both a peak reward *and* "good triumphs"; the two
  frameworks reinforce the same moment from different angles.
- **[Villain Deck](villain-deck.md).** The source of variable reward (the
  reveal) and the menace counters (escape / twist).
- **[Vision](vision.md)** and **[Monetization Model](monetization-model.md).**
  The bright lines: the reward loop is free-game engagement craft, never a
  spend-pressure or pay-to-win surface.

## Edge Cases

- **Reward the skill, not the luck.** The escalating-combo hit is powerful
  precisely because the player *built* the deck that chained — attribute the
  payoff to their choice. Rewarding pure randomness the same way trains the
  wrong lesson and cheapens the real synergy peaks.
- **The counters climb for the villains, not the player.** Loss-aversion
  tension comes from `escapedVillains` / `twistCount` — but they are only
  *tension*, not a reward to celebrate. Don't fire a positive cue when the
  menace rises; save the payoff for discharging it.
- **`lastPlayEffectsFired` is a scalar, per-play, reset each turn.** It is
  not a running session tally — the escalating-reward mechanism is
  *within one play*, not cumulative across a turn. (Same signal caveat the
  visual/audio combo consumers live with.)
- **Peaks need valleys.** The peak-end and contrast mechanisms *depend* on
  the early/routine game being under-stated. Over-juicing the whole match
  flattens the very peaks this framework exists to create — this is a
  content-tuning constraint, not just a code one.
- **Determinism and boundaries are untouched.** Like every feel-layer
  framework, this is pure client-side reaction: it never reads into or
  writes `G`/`ctx`, never affects validation, never branches engine logic.
- **Stay inside the Vision bright lines.** This documents why the *free
  game* is satisfying. Anything that would convert reward psychology into
  spend pressure, artificial scarcity, or a compulsion loop is out of scope
  by [Vision](vision.md) rule — it belongs nowhere in this framework.

## Code Touchpoints

- [`packages/game-engine/src/moves/coreMoves.impl.ts`](../packages/game-engine/src/moves/coreMoves.impl.ts)
  — `G.lastPlayEffectsFired`, the escalating-reward chain count
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — `game.lastPlayEffectsFired`, `progress.escapedVillains`,
  `scheme.twistCount`, `players[].woundCount`, `notableEvents` — every
  reward/threat/relief signal this framework times against
- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — the six event variants classified here as reward / threat / relief
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `EndgameOutcome`, `ESCAPE_LIMIT` — the peak-end finale and the
  loss-aversion ceiling
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — the read-only-projection
  boundary that keeps this a client-side timing contract, not engine logic

## Acceptance Criteria

This framework has no runtime of its own, so it is satisfied when the
sensory implementation it governs exhibits all of the following (each
observable in play). No Work Packet is scoped yet; when the visual/audio
WPs land, "the pacing contract holds" means:

- Routine actions (draw, single-effect play) stay visibly and audibly
  subtle; the Tier-1 peaks get the largest treatment.
- A synergy chain's visual and audio tiers **peak together** after a
  build-up beat (the shared `comboTierForCount` mapping).
- When one move resolves several spine events, the cues read as **one
  crescendo**, not a collision.
- **No** positive cue fires on a threat-class event or on rising menace.
- The endgame finale (peak-end) carries the heaviest treatment of the
  match.
- Nothing in the pacing layer reads or writes `G`/`ctx`, affects
  validation, or appears in the determinism hash.
- No mechanic gates play, pressures spend, or builds a compulsion loop.

## Decisions Pending

Open choices the visual/audio WPs must resolve (not recommendations):

- **Effect-priority table** — the concrete artifact this framework owes: an
  exact per-event reward weight both sensory layers consume, refining the
  [priority tiers](#priority-tiers) into a full ranking.
- **Build-up timing per tier** — how long the anticipation micro-beat is
  before a combo / reveal payoff. Needs playtesting: too long feels laggy,
  too short kills the crescendo.
- **Simultaneous-event sequencing rule** — the merge/sequence algorithm for
  the "one crescendo per resolved move" invariant, shared by both layers.

## Deferred

Out of scope for v1:

- **Difficulty ↔ reward coupling** — modulating reward intensity by how
  close the menace counters are to the loss cap (a clutch win near the
  escape cap feels bigger). Buildable from `escapedVillains` /
  `scheme.twistCount`, but a Tier-3 tuning pass, not a v1 concern.

## References

- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — the projected reward/threat signals
- [`packages/game-engine/src/moves/coreMoves.impl.ts`](../packages/game-engine/src/moves/coreMoves.impl.ts)
  — the combo chain count's origin
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `EndgameOutcome`, `ESCAPE_LIMIT`
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — engine owns truth / UI
  consumes read-only projections
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-24221 (`lastPlayEffectsFired`,
  the escalating-reward chain signal), D-24228 (the shipped tiered combo cue
  this framework paces)
- [Vision](vision.md), [Monetization Model](monetization-model.md) — the
  bright lines: free-game engagement craft, never pay-to-win or
  spend-pressure
- Companion feel-layer pages: [Design System Overview](design-system-overview.md),
  [Visual Effects](visual-effects.md), [Sound Effects](sound-effects.md),
  [Narrative Psychology](narrative-psychology.md)
