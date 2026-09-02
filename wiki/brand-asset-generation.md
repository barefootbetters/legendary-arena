---
title: Brand Asset Generation
type: Guide
tags:
  - layer-marketing
  - brand
  - governance
  - ai-generation
  - commerce
related:
  - video-commerce.md
  - video-production-workflow.md
  - monetization-model.md
  - homepage-spec.md
  - youtube-channel-plan.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\brand-asset-generation.md (this page — https://ewiki.legendary-arena.com/brand-asset-generation/)
  - ../docs/01-VISION.md
last-reviewed: 2026-09-01
canonical-source: docs/marketing/brand-asset-generation.md
canonical-source-repo: legendary-arena/legendary-arena-website
---

# Brand Asset Generation

## Summary

The operating system for generating marketing assets — copy, thumbnails,
OG/social images, ad variants, video descriptions — with AI **without producing
generic slop or drifting off the brand**. It locks Pain, Person, Promise and the
honest product facts in files the generator cannot wander from, then makes many
on-brand candidates and kills the rest. The authoritative long-form policy is
`docs/marketing/brand-asset-generation.md` in the marketing repo; this page is
the operating mirror. It cites the locked brand system — it does not re-author
voice.

## Mechanics

### The Three Ps

Every asset must serve Pain, Person, and Promise or it is slop.

| P | Legendary Arena |
|---|-----------------|
| **Pain** | Tabletop Legendary is geography and setup; most digital card games sell grind, gates, and an edge you can buy. The player who wants mastery has nowhere honest to put the hours. |
| **Person** | A deck-builder who knows the genre, cares about decisions more than drops, and will read a scenario. Not a gacha whale, not an "open packs" shopper. |
| **Promise** | Assemble heroes, read the scenario, earn standing from sessions played well. Same rules tomorrow as today — no bar, no gate, no purchase that changes the match. |

### The context pack (required reading)

Before emitting any public copy or image, the generator reads a fixed pack — the
fence it cannot wander past: the Three Ps above; the brand voice / verb palette
(`assemble · build · recruit · fight · master · defeat · earn · become`) / tone
bright-lines / CTA contract / canonical terms; the three SKUs with their honest
vs forbidden phrases and per-surface CTA legality
([Video Commerce](video-commerce.md)); and real product photography (no SVG
placeholders). **Do not invent SKUs, prices, canonical terms, or player
testimonials** — if a fact is not in the pack, it does not go in the asset. A
[Legendary Arena CLAUDE.md pointer](https://github.com/legendary-arena/legendary-arena-website/blob/main/.claude/CLAUDE.md)
requires the pack be read before any public copy or image.

### Angles that fit

Directional angles, each inheriting the [Video Commerce](video-commerce.md)
CTA legality — gear is a primary CTA only where the object is intrinsic to the
content: table presence (playmat), first session / everything you need to start
(deck box), 52 weeks of strategy (guide), skill decides / rules don't drift
(trust — play or email, **never** gear), and the weekly scenario is live
(calendar — play). Never make gear the CTA on a trust angle.

### Generate → QA (the kill-list)

Generate many candidates; keep the on-brand ones; kill the rest (do not "revise
until it limps across"). The standing brand-failure bright-lines apply (generic
adjectives leading copy, mechanics-first framing, terminology drift, off-token
color/font, verbose/"click here" CTAs, emoji/humor/filler/questions-as-headlines,
Marvel-dependent copy, self-deprecation). Generation-specific kills: forbidden
commerce phrases ("the edge you need," "pack," luck/gacha/pay-to-win/meta/tier
list), fabricated cards, **AI player-avatar testimonials** (refused outright),
generic page-builder layouts, wrong/off-token logo, and placeholder imagery
presented as product.

### The creative tracker and volume gate

When volume begins, log every candidate — date, type, channel, angle, SKU, cost,
model, status (shipped / killed / needs-human). **"Winner" is not tracked until a
real surface exists to measure it** (a live video, shop session, or running ad);
before that it is a guess, judged then by the
[Video Commerce](video-commerce.md) metrics, not impressions or likes.
**Batch product-still/ad generation is gated on real photography** (the
video-commerce C2 gate) — 18 variants around an SVG placeholder are 18 pieces of
trust-eroding slop. First batch once C2 clears: 12 pieces (4 stills, 4
thumbnails, 4 OG/social) from the message bank and real photos.

### Humans keep final copy

The generator drafts; a human approves every public line and image. AI marketing
skews salesy by default and the brand voice is the opposite (direct, no hype, no
irony) — the read-aloud tone test decides. A short "grill me" interview forcing
Pain / Person / Promise before a batch improves every downstream prompt.

## Interactions

- **[Video Commerce](video-commerce.md)** — owns the SKU facts, honest/forbidden
  phrases, and per-surface CTA legality this page's context pack and angles point
  to.
- **[Video Production Workflow](video-production-workflow.md)** — consumes the
  message bank and kill-list when producing thumbnails, descriptions, and B-roll.
- **[Monetization Model](monetization-model.md)** — the fairness boundary the
  do-not-adopt list enforces (no AI-UGC testimonials, no BOGO on standing).
- **[Homepage Spec](homepage-spec.md)** — the positioning the Three Ps
  consolidate; generated copy must match it, not drift.

## Edge Cases

- **Slop by default.** AI marketing output skews salesy and generic; the pack +
  kill-list exist precisely because "generate a thumbnail" without them produces
  off-brand slop. Humans own final approval.
- **AI-UGC testimonials.** A synthetic player "reviewing" the arena is a fairness
  incident, not a conversion tactic — refused outright, regardless of appeal.
- **Placeholder imagery.** No batch product generation until real photography
  clears the video-commerce C2 gate.
- **Discount reflex.** BOGO / urgency is permissible only on physical gear, and
  even then must never sound like a purchasable advantage — never on standing or
  the digital game.
- **Message-bank drift.** The bank grows only by human addition; an agent must
  not invent a line and add it to the approved set.

## References

- [brand-asset-generation.md (marketing repo — authoritative)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/brand-asset-generation.md)
- [strategy.md (marketing repo — brand voice, verb palette, terminology, failure modes)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/brand/strategy.md)
- [video-commerce-plan.md (marketing repo)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/video-commerce-plan.md)
- [Video Commerce](video-commerce.md) — SKU facts, honest/forbidden phrases, CTA legality
- [01-VISION.md](../docs/01-VISION.md) — permanent non-goals (the fairness boundary)
