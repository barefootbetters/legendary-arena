---
title: Video Commerce
type: Guide
tags:
  - layer-marketing
  - youtube
  - commerce
  - monetization
  - video
  - storybrand
related:
  - youtube-channel-plan.md
  - video-production-workflow.md
  - monetization-model.md
  - homepage-marketing-scorecard.md
  - homepage-spec.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\video-commerce.md (this page — https://ewiki.legendary-arena.com/video-commerce/)
  - ../docs/01-VISION.md
last-reviewed: 2026-09-01
canonical-source: docs/marketing/video-commerce-plan.md
canonical-source-repo: legendary-arena/legendary-arena-website
---

# Video Commerce

## Summary

The **commerce layer** of the Legendary Arena video program: selling the
physical gear *through* the videos — an in-video checkout — rather than
only building awareness. The [YouTube Channel Plan](youtube-channel-plan.md)
owns content and the [go-to-market plan](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/go-to-market-plan.md)
owns launch and distribution; neither covers how a video turns its
audience into gear revenue. The authoritative document is
`docs/marketing/video-commerce-plan.md` in the marketing repo; this page
mirrors it.

## Mechanics

The premise, from *How YouTube Is Quietly Becoming An E-Commerce Platform*
(My Wife Quit Podcast, 2026-08-18): product tags and in-video shopping
shelves let a small, loyal audience buy without leaving the watch session,
and a creator's own product beats affiliate promotion. Legendary Arena
already has both prerequisites — first-party gear and a mastery-native
content format.

**The gear (already checkout-ready).** A static Hugo catalog
(`content/shop/*.md`) wired to Snipcart + Stripe, with three featured SKUs
surfaced on the homepage as "Featured Gear":

| SKU | Price | Natural video home |
|-----|-------|--------------------|
| Starter Deck Box (`LA-DECK-001`) | $24.99 | First-session / "how to play" videos |
| Arena Playmat (`LA-MAT-001`) | $34.99 | Setup, table-presence, zones/turn-tracker clips |
| Strategy Guide Vol. 1 (`LA-GUIDE-001`) | $14.99 | Deck-building / "how standing works" content |

**The fourth conversion goal.** The channel plan names three primary
goals per video (play, email, subscriber). Video commerce adds a fourth —
**gear purchase** — under the same single-goal rule: gear is primary only
on videos whose content is already about the physical object or the
mastery the guide teaches. On a trust/fairness or first-game onboarding
video, a spoken gear CTA competes with the goal that builds the audience,
so it stays out of the primary slot.

**Tagging beats description links, own product beats affiliate.** A
product tagged on the video surface converts better than a URL in the
description; first-party checkout on `/shop/` stays the source of truth
while platform shelves (YouTube Shopping, TikTok Shop, Reels) are additive
paths onto the same three products. Early video real estate sells the
deckbox, mat, and guide — not random affiliate picks.

**Commerce-readiness gates (C1–C4).** Parallel to the go-to-market launch
gates: C1 fulfillment real, C2 real product imagery (the shop images are
still SVG placeholders — a hard prerequisite), C3 platform shop live +
eligibility confirmed, C4 attribution on. Do not tag a product you cannot
photograph, ship, or stand behind.

## Interactions

- **[YouTube Channel Plan](youtube-channel-plan.md)** — owns content,
  series, and the first three conversion goals; the "gear purchase" goal
  here extends its single-goal rule to the shop side.
- **[Monetization Model](monetization-model.md)** — the fairness boundary
  this plan sits inside. Physical deckbox / playmat / guide are
  presentation, accessory, and education for the *tabletop* game; they
  touch no digital rules, scoring, PAR, matchmaking, or standing, so they
  sit on the safe side of the no-pay-to-win line by construction.
- **[Homepage Marketing Scorecard](homepage-marketing-scorecard.md)** —
  the homepage's "Featured Gear" section is the on-site destination the
  video tags drive toward.
- **[Video Production Workflow](video-production-workflow.md)** — the
  per-video pipeline that produces the gear-forward segments and B-roll.

## Edge Cases

- **Placeholder imagery blocks tagging.** The shop currently ships SVG
  placeholders and a `draft` sample product. Tagging a product with fake
  art and no fulfillment burns trust faster than not tagging at all —
  hence C1/C2 gate every public gear CTA.
- **Gear CTAs can cannibalize the funnel.** On trust or onboarding videos,
  a "buy" CTA competes with the play/email goal that actually grows the
  audience. The single-goal rule governs: gear is primary only where the
  content is already about the object.
- **Platform eligibility drifts.** The podcast's figures (a small channel
  earning ~$20k from tags, lowered shopping-eligibility thresholds) are
  the *source's* claims, not measured Legendary Arena results, and
  platform policy changes often — confirm current YouTube Shopping /
  TikTok Shop eligibility before relying on a threshold.
- **Language must stay honest.** The mat is "table presence," the guide is
  "52 weeks of strategy," the box is "everything you need to start" —
  never "the edge you need to win." The fairness position is the brand;
  gear copy must not muddy it.

## References

- [video-commerce-plan.md (marketing repo — authoritative)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/video-commerce-plan.md)
- [youtube-channel-plan.md (marketing repo)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/youtube-channel-plan.md)
- [go-to-market-plan.md (marketing repo)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/go-to-market-plan.md)
- [Monetization Model](monetization-model.md) — revenue streams and the
  fairness guardrails gear must respect
- [01-VISION.md](../docs/01-VISION.md) — permanent non-goals (the
  no-pay-to-win boundary)
- *How YouTube Is Quietly Becoming An E-Commerce Platform* — My Wife Quit
  Podcast, 2026-08-18 (strategic input; claims attributed, not verified):
  https://www.youtube.com/watch?v=cs5USwMSDrs
