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
  - brand-asset-generation.md
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

Video commerce is the layer that turns a watch session into a gear sale —
in-video checkout on first-party products, not awareness alone and not
affiliate clutter. The [YouTube Channel Plan](youtube-channel-plan.md) owns
content and the first three conversion goals (play, email, subscriber); this
page owns the fourth — **gear purchase** — and the rules that keep it from
stealing the other three or crossing the no-pay-to-win line. The authoritative
long-form policy is `docs/marketing/video-commerce-plan.md` in the marketing
repo; this page is the operating mirror.

## Mechanics

### Why this layer exists

Legendary Arena already has the two things the source video treats as
prerequisites: first-party products (deck box, playmat, strategy guide) and a
mastery-native content format (how the system is played, not how it is farmed).
Platform shelves (YouTube Shopping, later TikTok Shop / Reels) are additive
paths onto `/shop/` — they do not replace Snipcart + Stripe and do not authorize
new SKUs.

StoryBrand cast for this layer:

| Role | Who / what |
|------|-----------|
| Hero | The player who wants standing from sessions played well |
| Problem | The table is incomplete, or the system is not yet known |
| Guide | The video, speaking as the system — not as a salesman |
| Plan | Watch → understand the decision → play → (only when earned) get the object the video already used |
| Success | The same table, the same rules, better presented |
| Failure | A buy CTA that sounds like an edge, or a tagged product that cannot ship |

### Scope and non-goals

**In scope:** which videos may make gear the primary goal, which SKU belongs on
which video, tagging vs description links, the readiness gates C1–C4, copy that
stays on the safe side of fairness, and attribution back to `/shop/`.

**Out of scope (refused here):** series design and upload cadence
([YouTube Channel Plan](youtube-channel-plan.md)); launch sequence and paid
distribution (go-to-market plan); digital rules, scoring, PAR, matchmaking, and
standing (never for sale); channel memberships, Super Thanks, ad RPM, and
affiliate of other brands (later, and via the
[Monetization Model](monetization-model.md), not this page); and new SKUs
invented to fill a platform shelf.

### The gear

Static Hugo catalog at `content/shop/*.md`, checkout via Snipcart + Stripe,
three featured SKUs on the homepage. No fourth product until C1 and C2 are true
for it.

| SKU | Price | What it is | Natural video home | Honest phrase | Forbidden phrase |
|-----|-------|-----------|--------------------|---------------|------------------|
| Starter Deck Box (`LA-DECK-001`) | $24.99 | 60 cards, rulebook, deckbox | First-session / how-to-play | "Everything you need to start" | "The deck that wins" |
| Arena Playmat (`LA-MAT-001`) | $34.99 | Neoprene mat, printed zones, turn tracker | Setup, table presence, zones/turn-tracker | "Table presence" | "The edge you need" |
| Strategy Guide Vol. 1 (`LA-GUIDE-001`) | $14.99 | 52 weeks of deck-building strategy | Deck-building / how standing works | "52 weeks of strategy" | "The secret to standing" |

These three sit on the safe side of the [Monetization Model](monetization-model.md)
by construction: presentation, accessory, and education for the tabletop game;
they touch no digital rules, scoring, PAR, matchmaking, or standing.

### The fourth conversion goal (precedence)

The channel plan's single-goal rule names three primary goals per video (play,
email, subscriber). This page adds **gear purchase** under the same rule: one
primary CTA per video. Gear may be primary **only when all three hold** — the
product is materially featured, it directly supports the topic, and a purchase
CTA does not conflict with an audience-building goal (play or email) the video is
better positioned to serve. Otherwise gear is secondary (a description link) or
omitted.

| Video job | Primary goal | Gear? | How |
|-----------|-------------|-------|-----|
| Trust / fairness / "why this system" | Play or email | No | No spoken buy. A `/shop/` description link is enough. |
| First-game onboarding | Play | Soft only | Show the box on the table; do not ask for the sale. |
| Setup / table presence | Gear (mat, then box) | Yes — primary | Tag the mat; end screen to the playmat page. |
| How to play / first session | Gear (box) | Yes — primary | Tag the box; spoken CTA after the system has been shown. |
| Deck-building / standing / championship | Gear (guide) | Yes — primary | Tag the guide; CTA is "the volume behind this session," not "buy an advantage." |
| Shorts: one decision | Subscriber or play | Soft only | Object may appear; no hard sell in 20 seconds. |

Tagging beats a URL in the description, and own product beats affiliate — but
both are *assumptions to validate* via attribution (C4), not asserted facts.
Early video real estate sells the box, the mat, and the guide.

### Commerce-readiness gates

Parallel to the go-to-market launch gates. **No public gear CTA for a SKU until
all four pass for it**; failure of any gate blocks tagging.

| Gate | Meaning | Pass criteria (done when) |
|------|---------|---------------------------|
| **C1 — Fulfillment real** | The unit can be picked, packed, shipped, refunded | Supplier + ship-from + SLA + returns path exist, and a test order has completed end to end |
| **C2 — Real imagery** | Shop and tag show the manufactured object, not a stand-in | A photograph of the shipped unit is on `/shop/`; SVG placeholders and any draft sample product are gone |
| **C3 — Platform shop live** | Eligibility + catalog confirmed on the platform being tagged | The platform's shop lists the three SKUs and they are purchasable; current eligibility confirmed the week of first tag — never from a podcast threshold |
| **C4 — Attribution on** | A sale can be traced to a video | UTM on every tagged destination + Snipcart/Stripe metadata, pulled weekly into the [Homepage Marketing Scorecard](homepage-marketing-scorecard.md) |

**C2 is the current hard block.** Tagging a product with placeholder art and no
fulfillment burns trust faster than not tagging at all. If C1–C4 fail for a SKU,
untag it — never leave a dead tag live.

### Operating rules

1. `/shop/` (Snipcart + Stripe) is the source of truth; platform shelves are
   additive mirrors, never a migration.
2. One tagged SKU per video unless it is a catalog/setup tour; prefer the SKU the
   footage already uses.
3. The spoken CTA comes after the system has been demonstrated, never as the cold
   open.
4. End screen and description use the canonical product URL, not a shortener.
5. Confirm YouTube Shopping / TikTok Shop eligibility the week of first use. The
   podcast's figures are the source's claims, not Legendary Arena results, and
   policy moves.
6. Community, memberships, and "binder-buy" formats stay off this layer until the
   three SKUs convert on long-form.

### Copy rules

Voice is the system: direct, mature, no irony. Gear copy describes the object and
the session; it never describes power.

- **Use:** skill, mastery, decision, refine, standing, composition, presentation,
  table, session.
- **Do not use:** luck, RNG, grind, farm, loot, gacha, pack, pay-to-win, edge,
  "advantage you can buy," secret, meta, tier list.

Honest spoken-CTA patterns — box: "This is the starter box the session used —
cards, rulebook, deckbox." Mat: "Zones and the turn tracker are on the mat, the
same layout as the table in this video." Guide: "Volume 1 is the 52-week path
from first draft to championship play."

### Measurement

Track per video, not just per channel: primary-goal completion; the tag →
product-page session → checkout start → paid order funnel; revenue by SKU and by
video; and refund/complaint rate on video-attributed orders (a trust canary). A
**cannibalization check** guards the funnel — an onboarding or trust video that
adds a gear CTA must not lose its play/email conversion; if it does, revert it to
the channel-plan goal. Vanity metrics (impressions, likes, raw views) are
secondary. A tagged video that does not sell is not a failure if it still hits
its primary non-gear goal; a tagged video that sells by sounding like pay-to-win
is a failure even if revenue is up.

## Interactions

- **[YouTube Channel Plan](youtube-channel-plan.md)** — owns content, series, and
  the first three conversion goals; the "gear purchase" goal here extends its
  single-goal rule onto the shop.
- **[Monetization Model](monetization-model.md)** — the fairness boundary this
  plan sits inside. Physical deckbox / playmat / guide are presentation,
  accessory, and education; they do not buy standing.
- **[Homepage Marketing Scorecard](homepage-marketing-scorecard.md)** — the
  homepage's "Featured Gear" section is the on-site destination the tags drive
  toward.
- **[Homepage Spec](homepage-spec.md)** — product names, prices, and phrases must
  match the homepage, not drift in video lower-thirds.
- **[Video Production Workflow](video-production-workflow.md)** — where
  gear-forward B-roll, table setup, and the spoken CTA are scheduled in the cut.

## Edge Cases

- **Placeholder imagery.** The shop still ships SVG placeholders and a draft
  sample product. No public tag until C2 is cleared per SKU.
- **Funnel cannibalization.** Buy CTAs on trust or onboarding videos steal the
  audience-building goal. The single-goal rule wins.
- **Platform eligibility drift.** Do not bake "500 subscribers" or "$20k from
  tags" into a forecast — confirm live platform policy the week of first use.
- **Language slip.** "Table presence" and "52 weeks of strategy" stay; "the edge
  you need to win" is a brand incident, not a conversion tweak.
- **Affiliate temptation.** Other people's products stay off the shelf while
  these three SKUs exist and are unsold.
- **Digital/physical confusion.** A viewer must never think the playmat or guide
  changes matchmaking, PAR, or standing. If a comment thread starts that rumor,
  pin a correction and review the CTA.

## References

- [video-commerce-plan.md (marketing repo — authoritative)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/video-commerce-plan.md)
- [youtube-channel-plan.md (marketing repo)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/youtube-channel-plan.md)
- [go-to-market-plan.md (marketing repo)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/go-to-market-plan.md)
- [Monetization Model](monetization-model.md) — revenue streams and the fairness
  guardrails gear must respect
- [01-VISION.md](../docs/01-VISION.md) — permanent non-goals (the no-pay-to-win
  boundary)
- *How YouTube Is Quietly Becoming An E-Commerce Platform* — My Wife Quit
  Podcast, 2026-08-18 (strategic input; claims attributed, not verified):
  https://www.youtube.com/watch?v=cs5USwMSDrs
