---
title: Revenue Operating Spec
type: Guide
tags:
  - layer-marketing
  - storybrand
  - revenue
  - go-to-market
  - commerce
related:
  - go-to-market-plan.md
  - video-commerce.md
  - youtube-channel-plan.md
  - monetization-model.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\revenue-operating-spec.md (this page — https://ewiki.legendary-arena.com/revenue-operating-spec/)
  - ../docs/01-VISION.md
last-reviewed: 2026-09-02
canonical-source: docs/marketing/revenue-operating-spec.md
canonical-source-repo: legendary-arena/legendary-arena-website
---

This page mirrors the authoritative source at
`C:\www\legendary-arena-com\docs\marketing\revenue-operating-spec.md`.
If they disagree, the marketing repo copy wins.

---

# Revenue Operating Spec

## Summary

The marketing plans are strong as **governance** and thin as a **revenue
machine**. This spec's job is narrow: **put the cash register and the shippable
object on the same critical path as the story** for the next 90 days. Revenue in
that window can only come from **gear** (physical or digital), not play starts —
so the offer, its fulfillment, and its attribution get a clock of their own that
does not wait behind a YouTube studio roadmap.

It is **subordinate to** `docs/01-VISION.md` §Financial Sustainability and the
[Monetization Model](monetization-model.md) — it sequences and instruments; it
redefines no revenue stream and crosses no Non-Goal (NG-1…NG-7). It adds no new
physical SKU (only a bundle of the existing three and a digital edition of the
existing guide).

## The correction: revenue is the 90-day north star

The [go-to-market](go-to-market-plan.md) north-star funnel ends at "returning
player" — an **acquisition** funnel. For a 90-day cash goal, revenue is the north
star:

```
Aware player → Trust the table → Buy a session object
                              ↘ Email (owned follow-up)
                              ↘ First digital game (habit, later LTV)
```

Views, Discord members, and play starts build the trust the buy depends on
(Clock A), but they don't pay fulfillment. Clock B (cash) runs **in parallel**.

## Two gates the launch plan is missing

- **G0 — Offer is legal and shippable.** The physical **60-card Starter Deck
  Box** (`LA-DECK-001`) is **covered under the Upper Deck / Marvel license** — the
  same license the mandatory royalties are already paid under — so it ships and is
  promoted as a licensed product (confirmed by Jeff, 2026-09-02). G0 is a
  **confirm-scope gate, not a block**: confirm the license terms cover each
  specific SKU / surface before its first public tag or paid test. Public copy
  keeps "Marvel" out of headline SEO per the WP-008 brand decision (a brand
  posture, not a licensing limit). Mat and guide are original-identity and clear
  G0 trivially.
- **G1b — First game is one click.** Homepage "Play now" may not point at the
  loadout-JSON lobby (its current target) until a new player can finish a game
  without pasting JSON — or, interim, until it points at a bot-replay or the
  primer. Until then, G1 is cosmetic.

## Two clocks

| Clock | Runs | Contents | Waits on |
|-------|------|----------|----------|
| **A — Audience** | Day one | Videos, Shorts, Discord / X / Reddit, the primer | Nothing |
| **B — Cash** | Day one, **parallel** | C1–C2 fulfillment + imagery, product pages, the bundle, first ~20 warm orders | **Not** G4 |

Shop-page traffic is allowed **before** homepage GO — a product page with real
imagery, a shipping SLA, and checkout can convert a warm click while the homepage
is still being rebuilt.

## The offer (AOV + near-zero COGS)

No new physical product (per the [video commerce](video-commerce.md) non-goals):

| SKU | Type | What | Why |
|-----|------|------|-----|
| **Session Kit** (`LA-KIT-001`) | Bundle of the existing three | Box + mat + guide, clears a free-shipping floor | Raises AOV |
| **Strategy Guide PDF** (`LA-GUIDE-001-PDF`) | Digital | Vol. 1 delivered instantly | Fastest honest dollar; near-zero COGS; trains the list; **no Marvel card IP** |
| **Free-shipping floor** | Shop rule | e.g. orders over ~$50 ship free | Nudges the bundle |

Prices and the floor are **hypotheses** pending unit-economics calibration
(COGS, ship by zone, margin, break-even CPA — fill before any paid spend).

## The money scorecard

Add to the [go-to-market](go-to-market-plan.md) weekly read (signups and play
starts can grow with $0 revenue): **paid orders, AOV, contribution margin after
ship, refund / complaint rate, revenue by SKU and by video, revenue per 1,000
views on gear-primary videos.** Plus a **cannibalization kill-switch** — if an
onboarding/trust video's play/email conversion drops after a spoken buy CTA,
revert it to its channel-plan goal that week. The 90-day targets become a money
table (directional): 40–80 orders, AOV $45+, refund < 5%, email 300–600 (still
useful, no longer the headline).

## The leaks (fix in Week 0)

Trust-negative under a fairness brand:

1. **Placeholder `sample-product`** in the live shop — the C2 hard block in the
   flesh; unpublish until a real SKU with real imagery replaces it.
2. **"Play now" → JSON lobby** — re-point per G1b.
3. **Featured Gear without fulfillment** — pull any SKU that fails C1/C2 from the
   homepage until it passes. A ghost product under a trust brand is worse than no
   shop.

## The 4-week cash calendar (Clock B)

Runs alongside the channel plan, not after it.

- **Week 0 — Stop the leaks.** Record the G0 license-scope confirmation (deck
  license-covered; mat + guide original-identity). Place one
  real test order; pack, ship, refund it (C1). Photograph the shipped units;
  replace placeholders (C2). Re-point "Play now" (G1b).
- **Week 1 — Make the register work.** Product pages (photo, contents, shipping
  SLA, returns, UTM). Add the Session Kit + free-shipping floor. Email capture on
  `/shop/` + footer **now**; thin `/get-started`, PDF to follow. Minimum
  analytics recording `checkout_start` + `purchase`.
- **Weeks 1–2 — Sell to warm traffic.** Barefoot Betters readers, people you play
  with; r/legendary / r/marvelchampions as a participant. **Goal: 10 orders**
  before cold promotion.
- **Weeks 2–6 — Content that builds trust and sells.** BtA #1, HtP #1, and the
  setup-on-the-official-mat video the same week C2 photos exist (tag the mat).
  Shorts, one companion post per long-form, one value email per week.
- **Weeks 6–12 — Amplify after ~20 orders + 2–4 videos.** Homepage proof;
  re-grade G1; guest outreach; YouTube Shopping (**C3 / Fourthwall**) on the SKUs
  already selling on `/shop/`; tiny paid vs. the winning video or product page —
  never before G0 / C1 / C2.

## What "good" looks like in 90 days

C1–C2 green and Featured Gear real; `/get-started` live; **40–80 orders** with
AOV pulled up by the kit and a low refund rate; 4 long-form + ~15 Shorts with at
least one measurably attached to sales; homepage re-graded toward GO; "Play now"
one-click or no longer primary; a **written IP posture you can defend.**

## Open decisions (owner: Jeff)

Conservative defaults were taken where the call is yours — confirm or redirect:

1. **Offer pricing** — Session Kit price + free-shipping floor are placeholders.
2. **"Play now" re-point** — a live homepage UX change (flagged, not executed).
3. **Unpublish `sample-product` now** — a live shop change (flagged, not executed).

**Resolved:** G0 / IP posture — `LA-DECK-001` is license-covered under the
existing Upper Deck / Marvel license (confirmed by Jeff, 2026-09-02); G0 is a
confirm-scope gate, not a block, and the deck stays.

No other live-site changes were made by this spec — nothing unpublished, no CTA
re-pointed, no SKU built. Those await the calls above.

## References

- **Revenue Operating Spec** — [ewiki mirror (this page)](https://ewiki.legendary-arena.com/revenue-operating-spec/) · [marketing repo — authoritative](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/revenue-operating-spec.md)
- **Go-to-Market Plan** — [ewiki mirror](https://ewiki.legendary-arena.com/go-to-market-plan/) · [marketing repo](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/go-to-market-plan.md)
- **Video Commerce Plan** — [ewiki mirror](https://ewiki.legendary-arena.com/video-commerce/) · [marketing repo](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/video-commerce-plan.md)
- **YouTube Channel Plan** — [ewiki mirror](https://ewiki.legendary-arena.com/youtube-channel-plan/) · [marketing repo](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/youtube-channel-plan.md)
- [Monetization Model](https://ewiki.legendary-arena.com/monetization-model/) — canonical revenue streams and the no-pay-to-win boundary
- [01-VISION.md](https://github.com/barefootbetters/legendary-arena/blob/main/docs/01-VISION.md) — §Financial Sustainability (canonical) + permanent non-goals (NG-1…NG-7)
