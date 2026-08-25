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

A proposed **collapsible side panel** that answers the one question a
cooperative table is really asking — **"are we going to make it?"** — and
backs the answer with the deck math underneath it. Its organizing
principle is a single sentence: **turn raw counts into a race you can
feel.** Everything on the panel exists to serve that; anything that does
not is cut or hidden.

It began as a **card counter** — the detective's notepad from *Clue*,
tracking what has been played and what is still out there — and grows into
an outlook: pace, next-hand projection, and deck health, layered on top of
the count.

> This page is `draft` and **descriptive**, per [SCHEMA.md](SCHEMA.md). It
> captures a proposed feature and its rationale as a point of view; it
> invents no engine behavior and specifies no build. Buildable acceptance
> criteria live in the eventual Work Packet(s), not here. Everything below
> is a *proposal*, written in the conditional on purpose.

## Mechanics

### The panel hierarchy — verdict first, math last

The final vision leads with the verdict and lets a curious player drill
down. This ordering *is* the design; reversing it (math first, verdict
buried) is the failure mode the page exists to prevent:

1. **PACE / OUTLOOK** — on pace or falling behind; a win forecast; turns
   to doom versus projected finish; a WIN / LOSS trajectory.
2. **NEXT HAND** — expected recruit and attack, framed as *decisions*
   ("31% chance of 8+ attack; 45% chance to afford a 7-cost hero").
3. **DECK HEALTH** — an executive summary and a trend arrow (improving ▲):
   composition, wounds, and whether the deck is stronger than it was.
4. **DECK INVENTORY (the counter)** — the *Clue* notepad: what has been
   played, what remains per type, and each line's own upcoming-draw odds.
5. **DETAILS ▼** — the expandable math (hypergeometric detail, individual
   card odds) for the player who wants to see the work.

### Pace and outlook — the headline

Wounds and twists tick forward at a **knowable rate**, so the panel can
project turns-to-doom against a projected finish and render a plain
verdict — **"on pace"** or **"falling behind,"** a WIN / LOSS trajectory, a
win forecast. That is the feature. It answers *are we going to make it?* in
a glance, and turns a wall of statistics into a race.

This overlaps the shipped danger signal (the adaptive-music danger meter,
WP-557/558) — very likely they are **one system**, a single "Campaign
Outlook" rather than two widgets. The danger meter says *how bad*; the pace
indicator says *how bad, and will we make it.* See Open Questions.

### The next hand — in decisions, not numbers

The actionable unit is the **whole hand**, not the next card — players play
hands. Rather than "12% to draw this card," the panel answers *what recruit
and what attack is my next hand likely to give me,* as an expected value
plus a range. But numbers alone are not decisions. The panel translates
them into **actions**:

> Expected attack ~5. **67%** clear the current city · **32%** afford a
> 7-cost hero · **11%** reach the mastermind.

Humans think in actions, not expected values. **Hand-level** probability is
strategy and belongs up front; **card-level** odds ("13% Hulk") are math,
rarely drive a decision, and live in the DETAILS drawer, hidden by default.
Exact combinatorics on a six-card draw get heavy fast, so the pragmatic
route is a **Monte Carlo** simulation in a **worker**. (Client-side
advisory math — outside the deterministic engine boundary; see Edge Cases.)

### Deck health and trend

Deckbuilders are fundamentally about the deck getting stronger, so the
panel makes that visible. An **executive summary** (a one-word health read
plus composition — attack / recruit share, wound count) and a **trend**:
attack potential now, after the next draw, after the next shuffle. *"Your
deck is stronger than it was three turns ago"* is positive feedback the raw
counts already contain but never surface.

### The inventory — a card counter with receipts

The MVP core and the feature's origin. Like the *Clue* notepad, it tracks
**what has been played** and **what remains per type** — *Master Strikes:
2 of 4* (the count varies by scheme), villains, bystanders, twists — and
gives each line **its own next-draw probability**, framed as **upcoming
risk** rather than bare object counts:

> Upcoming risk — Master Strike **18%** · Scheme Twist **14%** · Bystander
> **9%**.

The insight is *what can happen next?*, not *what objects remain?* And each
entry is a **doorway**: a checklist line links out to that character's
history — the blog and character-writing that make a player love the card
(the character-history loop from [Soul](soul-of-legendary-arena.md)).

### Reshuffle — two cases, not one

- **Your own deck.** The discard is known, but once it reshuffles the
  **order** is unknown, so the panel reports **"what is in the pool," not
  the sequence.**
- **The villain deck.** Schemes and effects reshuffle the villain deck
  **mid-game**, so its pool is **not a monotonic countdown** — a card
  already "spent" can return. The panel must model the villain pool as a
  live composition, not a burn-down bar. This is a distinct case from
  post-shuffle order-uncertainty, and easy to get wrong.

### A little history — in a Learn-More drawer

Kept **light** on the panel — a *"Did you know?"* line beside the stat it
names (expected value, Huygens, 1657). The fuller lineage belongs on
[Soul of Legendary Arena](soul-of-legendary-arena.md) or a proposed
sibling page, *Probability in Games*, not stuffed into a decision surface:

- **Pascal & Fermat (1654)** — the "problem of points"; the pace indicator
  in embryo.
- **Huygens (1657)** — expected value; the hand projection.
- **Cardano (c. 1560s)** — the gambler-mathematician; gives the lineage its
  mischief.
- **Jacob Bernoulli (1713)** — the law of large numbers; why the Monte
  Carlo estimate converges.
- **Bayes (1763)** — belief updating as each card reveals is *literally
  what the panel does, turn by turn*; the strongest fit of the set.
- **Franklin's "infallible rule" (1726)** — the bridge to
  [Awards and Badges](awards-and-badges.md).

### The toggle — and what it records

The panel is collapsible, and its **on/off state is recorded per game.**
That flag is a first-class datum, not a cosmetic preference: it feeds
[Awards and Badges](awards-and-badges.md) (a self-imposed *"no training
wheels"* achievement for playing with the panel off) and answers anyone who
calls the panel a crutch — the game knows who used it.

### MVP and phasing (agreed)

Presentation leads with pace, but the **build ships smallest-first.**
Recording the phasing here is deliberate: without it, each later layer
reads as approved scope. It is not — this is the agreed order, and the
buildable acceptance criteria for each phase live in the Work Packet(s):

- **Phase 1 (MVP) — the plain counter.** The inventory/checklist:
  played, remaining-per-type, upcoming-risk odds. The *Clue* notepad,
  client-side, off the new draw-pool composition projection.
- **Phase 2 — hand projection.** Expected recruit/attack as EV + range,
  decision-framed.
- **Phase 3 — pace / outlook.** The "are we winning" headline; unify with
  the danger signal.
- **Phase 4 — the rest.** Deck health + trend, the toggle→badge flag, the
  history drawer, and the post-game comic recap.

## Interactions

- **[Play Board](play-board.md)** — the panel is a read-only projection
  surface reading the same UIState the board renders; it derives, never
  decides (ARCHITECTURE.md, Architectural Principles #2). The panel's
  Phase-1 data dependency is a new **draw-pool composition** projection
  (own-pool audience-filtered; villain-deck composition public).
- **[Scoring](scoring.md)** — the pace outlook's projected score is a
  forward projection of the scoring model; it must track what scoring
  actually computes, not a parallel formula.
- **[Awards and Badges](awards-and-badges.md)** — the recorded toggle flag
  drives the "no training wheels" achievement; the panel serves the *team's*
  read of the race, never one player's selfish edge.
- **[Soul of Legendary Arena](soul-of-legendary-arena.md)** — the history
  layer is "soul with receipts"; the fuller probability lineage and the
  character-history doorways belong here (or on a *Probability in Games*
  sibling).
- **[Design System Overview](design-system-overview.md)** — the collapse /
  expand behavior, the "race you can feel" framing, and the shipped danger
  signal this outlook may absorb.

## Edge Cases

- **This is a proposal, not governance.** Nothing here defines engine
  behavior, gates a Work Packet, or carries acceptance criteria (those are
  WP/EC territory). If a sentence reads as "the engine MUST," move it to a
  WP / DECISIONS entry, or delete it. Per [SCHEMA.md](SCHEMA.md) Scope
  Exclusion.
- **Avoid information overload — the load-bearing constraint.** The panel
  must prioritize decision-making over statistical completeness. A statistic
  that does not materially help a player decide stays hidden behind the
  DETAILS drawer. Without this rule, future contributors will keep adding
  percentages, tables, and distributions until the panel is *Bloomberg
  Terminal Arena* — the exact opposite of "a race you can feel."
- **Card-level odds are math, not strategy.** Per-card draw percentages are
  hidden by default; hand-level and per-type risk odds are the surfaced
  layer.
- **Client-side advisory only — never authoritative.** The panel computes
  from information the client already holds (its own pool; public discard
  and villain composition). It is a read-only aid that never feeds back into
  game state. Clients submit intent, not outcomes.
- **Monte Carlo must not touch engine randomness.** Any simulation is
  client-local and must use a client-local PRNG, never `ctx.random.*`. The
  [pre-planning](../docs/ai/DESIGN-PREPLANNING.md) layer is the precedent
  for non-authoritative, per-client speculation with a client-local PRNG.
- **Own deck: pool, not sequence.** After a reshuffle the panel knows
  composition, not order; its language must not promise draw-order
  certainty.
- **Villain deck: not a monotonic countdown.** Mid-game reshuffles mean the
  villain pool can grow back; model it as a live composition, not a
  burn-down.
- **Do not double the doom clock.** The pace outlook reads the same
  wound/twist state the shipped danger signal surfaces; reuse that model,
  do not invent a second, drifting one.
- **Cooperative assumption is load-bearing.** The "info is already shared"
  justification holds because play is cooperative and spoken. A future
  competitive or hidden-information mode would need this reconsidered.

## Open Questions

- **Rename and unify?** Is this the "Deck Probability Panel," or is it
  really the **"Pace and Outlook Panel"** / a single **"Campaign Outlook"**
  that absorbs the danger signal? The name should follow the primary
  feature, which is the outlook, not the probabilities.
- **Where does the probability history live** — a light on-panel drawer, or
  a dedicated *Probability in Games* sibling page (with Soul carrying the
  meaning)? Bayes especially deserves a real write-up.
- **Exact vs. Monte Carlo** — at what draw size does exact hypergeometric
  math stop being practical; is a hybrid worth it?
- **Sibling content with no home yet.** Several threads from the same
  conversation belong on *other* pages, not here — the behavioral frame
  (Aristotle, Ostrom; the mind/body/heart/spirit lens; Blue Zones social-
  health research), and the mastermind/scheme **historical layer** (Orwell,
  the maps). The **post-game comic recap** in particular appears to be
  **unfiled** — it has no home page yet. Where does each land?
- **Does the toggle-off achievement belong here or on
  [Awards and Badges](awards-and-badges.md)?** The flag is defined here; the
  badge is defined there.

## References

- [docs/01-VISION.md](../docs/01-VISION.md) — the cooperative fantasy and
  the engine-owns-truth / read-only-projection posture that bounds an
  advisory panel.
- [play-board.md](play-board.md), [scoring.md](scoring.md),
  [awards-and-badges.md](awards-and-badges.md),
  [soul-of-legendary-arena.md](soul-of-legendary-arena.md),
  [design-system-overview.md](design-system-overview.md) — related wiki
  pages.
- *Clue* (Cluedo, 1949) — the detective card-counting board game whose
  deduction notepad is this feature's conceptual origin.
- Pascal–Fermat correspondence (1654), the "problem of points" — the
  founding exchange of probability theory; conceptual root of the pace
  indicator.
- Christiaan Huygens, *De ratiociniis in ludo aleae* (1657) — first printed
  treatise on games of chance; introduced expected value, the basis of the
  hand projection.
- Gerolamo Cardano, *Liber de ludo aleae* (written c. 1560s, published
  1663) — the earliest systematic treatment of games of chance.
- Jacob Bernoulli, *Ars Conjectandi* (1713) — the law of large numbers; why
  a Monte Carlo estimate converges on the true distribution.
- Thomas Bayes, *An Essay towards Solving a Problem in the Doctrine of
  Chances* (published posthumously, 1763) — Bayesian belief updating; what
  the panel does as each card reveals.
- Benjamin Franklin, [*A Journal of a Voyage from England to Philadelphia,
  1726*](https://www.let.rug.nl/usa/documents/1701-1750/benjamin-franklin-journal-of-a-voyage-from-england-to-philadelphia-1726.php)
  — the "infallible rule … he that loves money most shall lose"; formulated
  over draughts, game-agnostic. The bridge to
  [Awards and Badges](awards-and-badges.md).
