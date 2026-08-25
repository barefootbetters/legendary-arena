---
title: Awards and Badges
type: Guide
tags:
  - awards
  - badges
  - achievements
  - cooperative-play
  - motivation
  - design-system
  - vision
related:
  - vision.md
  - leaderboard.md
  - monetization-model.md
  - soul-of-legendary-arena.md
  - design-system-overview.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\awards-and-badges.md (this page — https://ewiki.legendary-arena.com/awards-and-badges/)
  - ../docs/01-VISION.md
last-reviewed: 2026-08-25
---

# Awards and Badges

## Summary

This page captures the **design point of view** for Legendary Arena's
awards and badges, and the psychology behind it. The single idea it
serves: **reward cooperation, not selfish optimization.** The game is
cooperative — the players face the mastermind together — so the badges
should honor the plays that only make sense for the team, never collapse
into "whoever scored highest."

> This page is `draft` and **descriptive**, per [SCHEMA.md](SCHEMA.md).
> It states a point of view and the reasoning behind it; it invents no
> mechanic and makes no design decision. Any actual badge system is
> governed by a future Work Packet and [DECISIONS.md](../docs/ai/DECISIONS.md),
> not by this essay. Where this page and higher-tier docs differ, the
> higher-tier doc wins.

## Mechanics

### The problem it solves: reward the goose, not the eggs

Legendary Arena is a cooperative game, but the instinct it invites is
selfish: get the most victory points, the highest attack, the shiniest
personal turn. Tie badges to those raw numbers and you reward exactly the
wrong thing — you pay players to optimize *away* from the team.

The design goal is the inverse: reward the plays that only pay off for the
table. A badge should recognize the player who cleared the city so no one
else got overrun, or who recruited the hero that let *someone else* land
the killing blow. The badge points at contribution, not at a personal
scoreboard.

### The psychology of achievement

The badge system rests on a small, honest theory of why recognition works
and how it backfires:

- **Napoleon's ribbon — value is agreed meaning.** *"A soldier will fight
  long and hard for a bit of colored ribbon"* — attributed to Napoleon in
  conversation aboard HMS *Bellerophon* on 15 July 1815, recorded in
  Heinl's *Dictionary of Military and Naval Quotations*. The ribbon has no
  worth except the meaning people agree to give it — the whole psychology
  of achievements in one image. (A traditional attribution, not from
  Napoleon's own writing — see Edge Cases.)
- **Franklin's "infallible rule" — the one who loves money most will
  lose.** In the journal of his 1726 Atlantic crossing, reflecting on an
  afternoon of draughts, Benjamin Franklin wrote: *"I will venture to lay
  it down for an infallible rule, that, if two persons equal in judgement
  play for a considerable sum, he that loves money most shall lose"* — the
  anxiety for the stakes confounds the play. Chase the reward and you play
  worse for it; mind the goose, not the golden eggs.
- **Self-Determination Theory (Deci & Ryan).** Durable motivation rests
  on three needs: **competence**, **autonomy**, and **relatedness**.
  Badges work when they signal genuine mastery and shared accomplishment;
  they satisfy *relatedness* best when they are about the table, not the
  individual.
- **The overjustification effect.** Reward something people already love
  and they love it less — the extrinsic reward crowds out the intrinsic
  joy. A badge system has to be designed *around* this trap, not into it.

The synthesis the two halves make: Franklin warns against loving the gold,
and Self-Determination Theory explains *why* chasing the badge hollows out
the fun. So the badges should reward the goose (cooperative play), never
the eggs (high scores).

### Design principles for cooperative badges

- **Team-only plays.** Recognize actions that are only good for the team —
  clearing the city, enabling an ally's finishing blow — not personal
  totals.
- **Shared / table badges.** The strongest kind: awarded to the *whole
  table*, not a person. Nobody can farm it alone, so it cannot be gamed
  selfishly.
- **Retroactive badges.** Awarded for something the player did without
  knowing it was being measured. Because the reward was invisible during
  play, it sidesteps the overjustification trap entirely — the joy came
  first, the badge second.
- **Tiered team badges.** A five-player badge, four-, three-, and
  two-player badges — recognition scaled to the size of the cooperation.
- **Solo gets its own category, not nothing.** With no teammates there is
  no cooperation to reward, but withholding a badge reads as *"you played
  wrong."* Give solo players mastery / difficulty badges of their own
  instead — a different lane, not exclusion.

### The team-vs-selfish signal

A companion to the badges: a way to surface when a player optimized for
themselves — most victory points, highest attack — at the team's expense.
Framed gently ("you acted for yourself, not the team") it is a reflective
signal, the mirror image of the cooperative badge. Whether it should be a
badge, a post-game statistic, or a coaching line is an open design
question, not something this page decides.

### History woven into the game

A separate but adjacent thread from the same conversation: give the game a
little real history. Card and game probability has a genuine lineage — the
1654 Pascal–Fermat correspondence on the "problem of points," and
Christiaan Huygens' *De ratiociniis in ludo aleae* (1657), the first
printed treatise on the subject, which introduced **expected value**.
Surfacing that history — the way the [soul](soul-of-legendary-arena.md)
page anchors content in documented real-world arcs — is "soul with
receipts." The full lineage lives on the
[Deck Probability Panel](deck-probability-panel.md) page, where it powers
the pace indicator and hand projection; here it is only the bridge from
Franklin's rule to cooperative play.

## Interactions

- **[Vision](vision.md)** — the cooperative good-versus-evil fantasy and
  the no-pay-to-win promise. Badges are *recognition*, never gameplay
  power; that boundary is the vision's, and this page stays inside it.
- **[Leaderboard](leaderboard.md)** — the competitive / scoring surface.
  The badge philosophy exists precisely so recognition does not collapse
  into "highest score wins"; the two surfaces answer different needs.
- **[Soul of Legendary Arena](soul-of-legendary-arena.md)** — the soul
  principle. Cooperative-first badges are the gratitude, courage, and
  legacy virtues rendered as recognition; the card-math history thread is
  the "soul with receipts" pattern applied to a feature.
- **[Monetization Model](monetization-model.md)** — badges drive
  engagement and retention, but the overjustification caution cuts both
  ways: recognition must not be monetized in a way that hollows out the
  play it celebrates.
- **[Design System Overview](design-system-overview.md)** — the feel layer
  and authorial voice that a badge's copy, art, and moment-of-award live
  inside.

## Edge Cases

- **This is a point of view, not governance.** Nothing here gates a Work
  Packet or defines engine behavior. If it ever reads as inventing a
  constraint, the fix is to move that constraint into a WP / DECISIONS
  entry and cite it, or delete the sentence — per [SCHEMA.md](SCHEMA.md)
  Scope Exclusion.
- **The Napoleon quote is a traditional attribution.** Traced to a
  conversation aboard HMS *Bellerophon* (15 July 1815) and recorded in
  Heinl's *Dictionary of Military and Naval Quotations* (1966), but not
  from Napoleon's own pen. Kept because it is apt, and attributed honestly
  rather than laundered into a firsthand fact — the
  [soul](soul-of-legendary-arena.md) discipline.
- **Franklin's rule is game-agnostic — and it is *draughts*, not cards.**
  Franklin formulated it during an afternoon of draughts on his 1726
  voyage, about any game played for stakes. It applies cleanly to
  Legendary's cooperative table, but represent it as the general maxim it
  is; the source is the voyage journal, not a card treatise.
- **Solo is a category, not a punishment.** The absence of a solo badge is
  a design smell; the mastery/difficulty lane is the fix.
- **Overjustification applies to this system itself.** The very act of
  adding badges risks crowding out intrinsic fun. The shared and
  retroactive designs are the mitigations — not decoration, but the point.
- **No pay-to-win boundary.** Badges may never confer gameplay advantage.
  They are meaning agreed upon, in Napoleon's sense — recognition, not
  power.

## Open Questions

- **How much of the history belongs here vs. on the panel page?** The full
  probability lineage lives on
  [Deck Probability Panel](deck-probability-panel.md); this page carries
  only Franklin's rule as the cooperative-play bridge. Confirm that split
  reads cleanly.
- **Is Cardano worth adding?** His *Liber de ludo aleae* (written c. 1560s,
  published 1663) predates Huygens' treatise; a candidate if the history
  thread grows.
- **What form does the team-vs-selfish signal take** — badge, post-game
  stat, or coaching line? A WP decision, not this page's.
- **Does the draw-probability side panel belong here or on its own feature
  page?** It shares the history thread but is a distinct UI feature.

## References

- [docs/01-VISION.md](../docs/01-VISION.md) — the cooperative
  good-versus-evil fantasy, the player promise, and the no-pay-to-win
  commitment that bounds what a badge may be.
- Self-Determination Theory — Edward L. Deci & Richard M. Ryan
  (competence, autonomy, relatedness) as the framework for durable
  motivation.
- The overjustification effect — Lepper, Greene & Nisbett (1973),
  *Undermining Children's Intrinsic Interest with Extrinsic Reward* — the
  classic demonstration that rewards can crowd out intrinsic interest.
- Napoleon Bonaparte — *"a soldier will fight long and hard for a bit of
  colored ribbon"* — attributed to a conversation aboard HMS *Bellerophon*,
  15 July 1815; recorded in R. D. Heinl, *Dictionary of Military and Naval
  Quotations* (1966). A traditional attribution, not Napoleon's own
  writing.
- Benjamin Franklin, [*A Journal of a Voyage from England to Philadelphia,
  1726*](https://www.let.rug.nl/usa/documents/1701-1750/benjamin-franklin-journal-of-a-voyage-from-england-to-philadelphia-1726.php)
  — the "infallible rule, that, if two persons equal in judgement play for
  a considerable sum, he that loves money most shall lose."
- Christiaan Huygens, *De ratiociniis in ludo aleae* (1657) — the first
  printed treatise on the mathematics of games of chance, built on the
  1654 Pascal–Fermat correspondence; the anchor for the history-in-game
  thread.
- [soul-of-legendary-arena.md](soul-of-legendary-arena.md),
  [leaderboard.md](leaderboard.md),
  [monetization-model.md](monetization-model.md) — related wiki pages.
