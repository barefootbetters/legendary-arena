---
title: Deck Probability Panel
type: Guide
tags:
  - ui
  - probability
  - deck
  - pace
  - projection
  - design-system
  - vision
related:
  - vision.md
  - play-board.md
  - scoring.md
  - awards-and-badges.md
  - soul-of-legendary-arena.md
  - design-system-overview.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\deck-probability-panel.md (this page — https://ewiki.legendary-arena.com/deck-probability-panel/)
  - ../docs/01-VISION.md
last-reviewed: 2026-08-25
---

# Deck Probability Panel

## Summary

A proposed **collapsible side panel** that shows deck inventory and draw
odds — what is left in a deck, the probability of drawing it, and, above
the raw stats, a **pace indicator** that projects whether the table is on
track to beat the mastermind. Its design goal is to turn raw counts into
**a race you can feel**: not "here is a number," but "you are on pace" or
"you are falling behind," and "expect around five attack next hand."

> This page is `draft` and **descriptive**, per [SCHEMA.md](SCHEMA.md). It
> captures a proposed feature and its rationale as a point of view; it
> invents no engine behavior and makes no build decision. An actual panel
> is governed by a future Work Packet and
> [DECISIONS.md](../docs/ai/DECISIONS.md), not by this essay. Everything
> below is a *proposal*, written in the conditional on purpose.

## Mechanics

### The panel, at a glance

A toggle-able panel that layers information from a glanceable top line down
to the math a curious player can expand:

1. **Pace** (top) — on pace / falling behind, turns remaining, projected
   score.
2. **Hand projection** — what your *next hand* is likely to hold (recruit
   and attack), as an expected value plus a range.
3. **Deck inventory** — what remains in each relevant deck.
4. **Layered probabilities** — the draw odds for the cards that matter.
5. **The math** (expandable) — the hypergeometric detail underneath the
   headline odds, for players who want to see the work.

### Per-player panels plus one shared villain panel

Legendary Arena is **cooperative**, and cooperative play is table talk —
the information is already shared out loud. That removes the hidden-
information objection to a probability aid: a player reasoning about the
odds aloud is normal play, not an exploit. So the natural model is a
**per-player deck panel** for each player's own pool, plus **one shared
villain panel** everyone reads together.

### Bystanders get their own line

Bystanders are worth breaking out separately, because they are two things
at once: **rescue points** (a reason to reach into the city) and **pure
blockers** (bodies in the way of the fight). A single "cards remaining"
count hides that dual role; their own line makes the tradeoff legible.

### Hand projection, not card-by-card

The more actionable framing is the **whole hand**, not the next single
card — because players play hands, not cards. Rather than "you have a 12%
chance to draw this card," the panel would answer "**what recruit and what
attack is my next hand likely to give me**," as an **expected value with a
range**: *expect around five attack, with a thirty percent shot at eight or
more.* That is the number a player actually decides on — whether to gamble
on clearing the city this turn.

Exact combinatorics on a six-card draw get heavy fast, so the pragmatic
route is a **Monte Carlo simulation** — sample many hands from the pool and
report the distribution. Running it in a **worker** keeps the UI
responsive. (This is client-side advisory math and must stay outside the
deterministic engine boundary — see Edge Cases.)

### The pace indicator

The centerpiece. Wounds and twists both **tick forward at a knowable
rate**, so the panel can project whether the table will clear the
mastermind before the twist deck runs out. Expressed as **"on pace" versus
"falling behind,"** with turns remaining and a projected final score, it
reframes the whole readout as a race against the doom clock rather than a
wall of statistics. It answers the question players actually feel: *are we
going to make it?*

### Reshuffle uncertainty: pool, not sequence

An honest limit the panel must respect. A discard pile is known, but once
it reshuffles the **order** is unknown. So the panel is really telling you
**"what is in the pool,"** not the sequence you will draw it in. Framing
matters: it projects composition and likelihood, and it must not imply a
certainty about draw order that the shuffle has erased.

### A little history, surfaced in the panel

The panel is also a natural home for a thread of real intellectual history
— the "soul with receipts" pattern from
[Soul of Legendary Arena](soul-of-legendary-arena.md), applied to a
feature. Each idea in the panel has a genuine lineage:

- **Pascal and Fermat (1654)** — invented probability arguing over how to
  split the stakes of an interrupted game: the **"problem of points,"** the
  usual takeoff point of the whole field. That *is* the pace indicator in
  embryo — projecting a fair outcome from an unfinished game.
- **Christiaan Huygens (1657)** — *De ratiociniis in ludo aleae*, the first
  printed treatise on games of chance, introduced **expected value** —
  literally what the hand projection computes.
- **Benjamin Franklin's "infallible rule" (1726)** — from the journal of
  his Atlantic crossing, reflecting on a game of draughts: *"if two persons
  equal in judgement play for a considerable sum, he that loves money most
  shall lose."* Mind the goose, not the golden eggs. It is the bridge to
  the team-versus-selfish thread that drives
  [Awards and Badges](awards-and-badges.md).

Surfaced lightly — a line of flavor beside the stat it names — this gives
the panel a bit of soul instead of being a bare calculator.

## Interactions

- **[Play Board](play-board.md)** — the panel is a read-only projection
  surface that reads the same UIState the board renders; it derives, it
  never decides. The engine owns truth and the client consumes read-only
  projections (ARCHITECTURE.md, Architectural Principles #2).
- **[Scoring](scoring.md)** — the pace indicator's "projected score" is a
  forward projection of the scoring model; it must track whatever scoring
  actually computes, not a parallel formula.
- **[Awards and Badges](awards-and-badges.md)** — shares the history layer
  (Franklin's rule) and the cooperative-first philosophy: the panel should
  help the *team* read the race, not hand one player a selfish edge.
- **[Soul of Legendary Arena](soul-of-legendary-arena.md)** — the history
  layer is the "soul with receipts" discipline applied to a UI feature.
- **[Design System Overview](design-system-overview.md)** — the panel's
  collapse/expand behavior, the "race you can feel" framing, and the
  glanceable-to-detailed layering are feel-layer concerns.

## Edge Cases

- **This is a proposal, not governance.** Nothing here defines engine
  behavior or gates a Work Packet. If a sentence reads as "the engine
  MUST," it is in the wrong place — move it to a WP / DECISIONS entry and
  cite it, or delete it. Per [SCHEMA.md](SCHEMA.md) Scope Exclusion.
- **Client-side advisory only — never authoritative.** The panel computes
  from information the client already holds (its own pool; public discard
  and villain composition). It must be a read-only aid that never feeds
  back into game state. Clients submit intent, not outcomes.
- **Monte Carlo must not touch engine randomness.** Any simulation is
  client-local and must use a client-local PRNG, never `ctx.random.*` —
  that belongs to the deterministic engine and must never be borrowed for
  a UI estimate. The [pre-planning](../docs/ai/DESIGN-PREPLANNING.md) layer
  is the established precedent for non-authoritative, per-client
  speculation with a client-local PRNG.
- **Pool, not sequence.** After a reshuffle the panel knows composition,
  not order; its language must not promise draw-order certainty.
- **Do not double the doom clock.** The pace projection reads the same
  wound/twist state the existing danger signal surfaces; it should reuse
  that model, not invent a second, drifting one.
- **Cooperative assumption is load-bearing.** The "info is already shared"
  justification holds because play is cooperative and spoken. A future
  competitive or hidden-information mode would need this reconsidered.

## Open Questions

- **Where does the projection math live?** A client-only helper, or a
  pre-planning-adjacent module? This is a layer-placement decision for a
  Work Packet, citing ARCHITECTURE.md — not something this page settles.
- **Exact hypergeometric vs. Monte Carlo** — at what draw size does exact
  math stop being practical, and is a hybrid (exact for small pools,
  simulation for full hands) worth it?
- **How much history is the right amount?** A single flavor line per stat,
  a toggle, or an out-of-panel "learn more" — enough for soul, not so much
  it clutters the race.
- **Does the pace indicator belong here or beside the danger signal?** The
  two overlap; one may subsume the other.
- **Should the panel be filed as a formal spec (a Work Packet)?** The
  brainstorm is captured here; the buildable spec, with acceptance
  criteria, is a WP this page does not replace.

## References

- [docs/01-VISION.md](../docs/01-VISION.md) — the cooperative fantasy and
  the engine-owns-truth / read-only-projection posture that bounds what an
  advisory panel may be.
- [play-board.md](play-board.md), [scoring.md](scoring.md),
  [awards-and-badges.md](awards-and-badges.md),
  [soul-of-legendary-arena.md](soul-of-legendary-arena.md),
  [design-system-overview.md](design-system-overview.md) — related wiki
  pages.
- Pascal–Fermat correspondence (1654), the "problem of points" — the
  founding exchange of probability theory; the conceptual root of the pace
  indicator.
- Christiaan Huygens, *De ratiociniis in ludo aleae* (1657) — the first
  printed treatise on games of chance; introduced expected value, the
  basis of the hand projection.
- Benjamin Franklin, [*A Journal of a Voyage from England to Philadelphia,
  1726*](https://www.let.rug.nl/usa/documents/1701-1750/benjamin-franklin-journal-of-a-voyage-from-england-to-philadelphia-1726.php)
  — the "infallible rule, that, if two persons equal in judgement play for
  a considerable sum, he that loves money most shall lose"; formulated over
  draughts, game-agnostic. The bridge to
  [Awards and Badges](awards-and-badges.md).
