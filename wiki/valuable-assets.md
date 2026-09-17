---
title: Valuable Assets
type: Guide
tags:
  - strategy
  - moat
  - business
  - architecture
  - asset-inventory
  - governance
related:
  - card-effect-system.md
  - effect-rulings.md
  - lagn-v1.md
  - play-board.md
  - scoring.md
  - monetization-model.md
  - reward-integrity.md
  - vision.md
  - soul-of-legendary-arena.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\valuable-assets.md (this page — https://ewiki.legendary-arena.com/valuable-assets/)
  - ../docs/lagn-architecture-brief.md
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/01-VISION.md
last-reviewed: 2026-09-17
---

# Valuable Assets

## Summary

A ranked, editorial inventory of the highest-value things Legendary Arena has
**actually built** — and, more importantly, **where the moat is**. The card IP is
licensed, not owned, and the architecture is reproducible; what is genuinely
expensive to reproduce is the accumulated engineering and analytical work. This
page names the top five assets in order of strategic value (survival lens:
protect revenue, ship a better product, reduce risk), and places the frequently
over-claimed [effect-rulings corpus](effect-rulings.md) honestly against them.

> **This is a snapshot, not a metric.** The ranking reflects what has been built
> as of 2026-09-17 and a judgment about durability. Real revenue mix can reorder
> it — see [Edge Cases](#edge-cases).

## Mechanics

### The ranking

**1. The deterministic game engine + effect system.** The faithful Marvel
Legendary rules engine: moves / phases / turn flow, the hero effect-primitive AST
and compositions, ~25 villain primitives, mastermind / scheme / twist handlers,
the reusable pending-choice interaction model, and hard determinism (all
randomness through `ctx.random.*`, replay-pinned by `finalStateHash`). Hundreds of
cards' behaviour is encoded and test-pinned here. This is the true crown jewel —
the distilled reading of the physical game's design — and the thing every other
asset depends on. Documented in [Card Effect System](card-effect-system.md) and
[Rule Execution Pipeline](rule-execution-pipeline.md).

**2. The card catalogue + registry + images.** 41 sets converted from upstream
sources into the registry format with inline effect markers, a reproducible
5-stage regeneration pipeline gated by a semantic-diff check, the searchable
taxonomy metadata, and the Cloudflare R2 image library. The other half of "the
game exists at all," and a large normalisation grind that would be costly to
redo. See [Card Effect System](card-effect-system.md) (the marker authoring),
[Card Image Acquisition](card-image-acquisition.md), and
[R2 Image Naming Convention](r2-image-naming-convention.md).

**3. The live multiplayer product.** The thing customers actually touch: the
arena client (play surface, playmats, visual and audio feel layers), the server
wiring boardgame.io into Postgres with reconnect handling, guest play, the solo
bot-ally, and the deploy pipeline. Survival lens: this is what earns. See
[Play Board](play-board.md) and [Turn System](turn-system.md).

**4. The competitive + economy layer.** Retention and monetisation: the PAR
skill-measurement / seed-challenge scoring, leaderboards, the LAGN loadout /
result notation, report cards, and the monetisation model with the Legendary
Pass. See [Scoring](scoring.md), [Seed Challenges](seed-challenges.md),
[LAGN Specification](lagn-v1.md), and [Monetization Model](monetization-model.md).

**5. The AI-development governance system.** The force multiplier: the WP / EC /
DECISIONS / number-ledger machine, the `.claude` rules, this ~80-page ewiki, and
the CI gate lattice (coverage / ledger, dashboard, reward-integrity). Underrated
*as an asset* because it is invisible in the product — but it is why the other
four grow at a work-packet every few hours with drift caught mechanically. See
[Development Workflow](development-workflow.md) and
[Reward Integrity](reward-integrity.md).

### Where the effect-rulings corpus sits

The LAGN architecture brief calls the [effect-rulings corpus](effect-rulings.md)
its "crown jewel." That is aspirational, and it is worth building — but it ranks
**below all five above**, for two reasons:

- **It is not built yet.** It is scoped as WP-704 (drafted 2026-09-17), not shipped.
- **It is insurance on asset #1, not an asset in its own right.** A rulings corpus
  is a *test corpus over* the engine — it makes the analytical work legible and
  drift-proof, which is real value, but the analytical work itself already lives
  in the engine and the card markers. Delete the rulings and you still have a
  game; delete the engine and the rulings describe nothing.

The moat is the engine plus the catalogue. The rulings corpus protects and
documents that moat; it does not constitute it.

## Interactions

- **[Card Effect System](card-effect-system.md)** and
  [Rule Execution Pipeline](rule-execution-pipeline.md) — asset #1, the engine.
- **[Card Image Acquisition](card-image-acquisition.md)** /
  [R2 Image Naming Convention](r2-image-naming-convention.md) — asset #2, the data/images.
- **[Play Board](play-board.md)** / [Turn System](turn-system.md) — asset #3, the product.
- **[Scoring](scoring.md)** / [LAGN Specification](lagn-v1.md) /
  [Monetization Model](monetization-model.md) — asset #4, the economy.
- **[Reward Integrity](reward-integrity.md)** — asset #5, the governance discipline.
- **[Effect Rulings](effect-rulings.md)** — the insurance policy on asset #1.
- **[Vision](vision.md)** and [Soul of Legendary Arena](soul-of-legendary-arena.md)
  — *why* these assets matter; this page is the *what* and the *how-valuable*.

## Edge Cases

- **Revenue mix can reorder this.** The ranking weights durability of the moat.
  If the Gauntlet economy or the Legendary Pass is what actually converts,
  asset #4 climbs. Whoever has the revenue data should adjust accordingly — this
  page is a starting judgment, not a settled fact.
- **"Crown jewel" language is about the analytical work, not a file.** The brief's
  moat argument is sound; the mistake is reading it as "the rulings JSON is the
  main asset." The analytical work is mostly already captured in the engine and
  the markers.
- **This page will drift.** It is a dated snapshot. Re-review when a major
  subsystem ships or the business model shifts; do not treat an old ranking as
  current truth.

## History

- **2026-09-17** — Page created to capture the top-five asset ranking and the
  moat reasoning, alongside the [effect-rulings](effect-rulings.md) page and the
  reconciled LAGN architecture brief (PR #2085 / #2088).

## Open Questions

- **Revenue-weighted ranking.** This is an engineering-durability judgment. A
  revenue-weighted version (which assets are actually paying the bills) needs the
  billing data the operator dashboard holds — worth doing once that data is at hand.

## References

- [`docs/lagn-architecture-brief.md`](../docs/lagn-architecture-brief.md) — the
  moat argument and the "crown jewel" framing (in context).
- [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) — the layer boundaries
  the engine / registry / product assets are built on.
- [`docs/01-VISION.md`](../docs/01-VISION.md) — what the game is for.
- [Effect Rulings](effect-rulings.md), [Card Effect System](card-effect-system.md),
  [LAGN Specification](lagn-v1.md), [Scoring](scoring.md),
  [Monetization Model](monetization-model.md).
