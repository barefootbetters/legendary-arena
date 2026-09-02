---
title: Go-to-Market Plan
type: Guide
tags:
  - layer-marketing
  - storybrand
  - go-to-market
  - launch
  - distribution
related:
  - youtube-channel-plan.md
  - video-commerce.md
  - homepage-spec.md
  - homepage-review-template.md
  - video-production-workflow.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\go-to-market-plan.md (this page — https://ewiki.legendary-arena.com/go-to-market-plan/)
  - ../docs/01-VISION.md
last-reviewed: 2026-09-02
canonical-source: docs/marketing/go-to-market-plan.md
canonical-source-repo: legendary-arena/legendary-arena-website
---

This page mirrors the authoritative source at
`C:\www\legendary-arena-com\docs\marketing\go-to-market-plan.md`.
If they disagree, the marketing repo copy wins.

---

# Go-to-Market Plan

## Summary

The go-to-market plan is the launch and 90-day execution layer — **what
happens first, in what order, across which channels, and how we know it's
working**. The [YouTube Channel Plan](youtube-channel-plan.md) owns content and
series; the [Video Commerce](video-commerce.md) page owns the gear-sale layer;
this page owns the **launch sequence, the phased calendar, the cross-channel
weekly rhythm, the distribution playbook, and the launch scorecard**.

The governing decision is **ordering: ship before you promote.**

## Governing sequence: ship before you promote

The live homepage is graded **NO-GO** ([Homepage Review
Template](homepage-review-template.md) § Current-State Audit): it fails the
grunt test, states no problem, shows no proof, and runs a single CTA. Driving
traffic to a NO-GO homepage spends attention on a page that cannot convert it.

**Rule:** asset *creation* starts now; traffic *to the homepage* waits until the
homepage clears its own GO/NO-GO. Two clocks run in parallel:

- **From day one** (builds the assets the homepage needs): video production,
  Shorts, blog posts, Discord / X / Reddit presence.
- **Gated behind homepage GO:** the "Play Free" funnel as the primary
  destination, the lead-magnet email capture as a headline offer, and any paid
  spend.

### Launch readiness gates

Promotion ramps in stages; each gate is **binary** (met or not — no partial
credit). G1–G3 are the critical path — until they clear, the work is building
inventory and audience, not pouring traffic into a funnel that leaks.

| Gate | Condition | Unlocks |
|------|-----------|---------|
| **G1 — Homepage ships** | All BLOCKER + MAJOR readiness items resolved; grunt test passes; re-graded to GO | Sending earned traffic to the homepage as the primary destination |
| **G2 — Lead magnet live** | Deck-Builder's Primer PDF exists *and* the `/get-started` capture page is live | Headline email-capture offer on homepage + every video |
| **G3 — Analytics on** | Site analytics platform chosen (Plausible candidate) and conversion tracking live | Measuring play-start and signup conversion, not just clicks |
| **G4 — Proof exists** | ≥2 anchor videos live + ≥3 Shorts published | Embedding real proof on the homepage; "Watch gameplay" has a destination |
| **G5 — Paid unlock** | G1–G4 true *and* ≥3 videos each clearing CTR >5% and avg view duration >50% | Small, tracked paid tests |

## North-star funnel

```
Visitor → Video viewer → Site visitor → Email subscriber
                                      ↘ First game started → First game completed → Returning player
```

Every channel and every weekly task maps to one transition in this chain. Views,
impressions, and follower counts are vanity numbers until they move a person one
step right. The post-signup email states (Pending → Confirmed → Welcomed →
Active) belong to the email pipeline, not this plan — this plan's job is to get a
person to the site, into the list, and into a first game.

## 90-day directional targets

**Directional targets — not forecasts, commitments, or acceptance criteria** —
subject to baseline calibration once analytics (G3) is live. Trend direction
matters more than the absolute number at launch: miss the number but hold the
trend and the system is working.

| Outcome | 90-day directional target |
|---------|---------------------------|
| Email subscribers | 500–1,000 |
| Weekly play starts | 100–300 by end of period (requires G3) |
| Long-form videos published | 8–12 |
| Shorts published | 30–50 |
| Companion blog posts | 1 per long-form video |
| Discord members | First 100 (charter community) |

The **email number is the one that compounds** — the only audience asset no
platform can take away. Optimize toward signups-per-video, not just views.

## Phased milestones (3 × 4 weeks)

Phasing follows the Messaging Priority Rule — establish Trust (L2) and Access
(L1) before Recognition (L4) and Mastery (L5). Weeks 1–8 are the channel plan's
[8-week content calendar](youtube-channel-plan.md); weeks 9–12 continue it.

- **Weeks 1–4 — Foundation (Trust + Access).** Ship the page, prove the villain,
  open the list. Clear G1–G3; publish BtA #1 (prove fairness) + HtP #1 (first
  game in 10 minutes); stand up Discord / X / Reddit with UTM'd links. Goal:
  homepage live and GO; 100–200 signups.
- **Weeks 5–8 — Momentum (Tutorials + Community).** Make the channel a real
  "Watch gameplay" destination; embed the first videos in the homepage Proof
  section; ramp Discord activity. Goal: 300–500 subscribers; consistent weekly
  play traffic.
- **Weeks 9–12 — Amplification (Double Down + Reach).** First guest episode;
  reinforce the top 20% (follow-ups + fresh Shorts); SEO follow-through;
  partnership outreach to 5–10 tabletop creators; clear G5 if criteria met.
  Goal: 700–1,000+ subscribers; a repeatable weekly system.

## Cross-channel weekly rhythm

The channel plan defines the one-video-per-week **production** cadence; this plan
**layers distribution, community, and email on top** — it does not replace it.
Realistic load is ~20–30 hrs/week once the systems run. **Build first, record
second** — if the demo isn't ready, slide the recording rather than ship a
rushed video that poisons the retention signal.

## Multi-channel distribution playbook

YouTube is the engine, but not the whole vehicle. Each channel has a distinct
role, a primary funnel transition, and one rule that keeps it from becoming
spam. **All outbound links carry UTM parameters** (the WP-020 convention) so
attribution is clean from day one.

| Channel | Role | Primary transition | The one rule |
|---------|------|--------------------|--------------|
| Blog / SEO | Capture search demand; build long-lived authority | Visitor → Site visitor → Subscriber | One post per video, problem-first — never a thin post |
| Discord | Convert players into a returning community | First game → Returning player | A hub, not a megaphone |
| X / Twitter | Spread the villain framing to competitive-card audiences | Visitor → Video viewer | Lead with the problem, land the product as the resolution |
| Reddit | Reach players discussing the exact pain points | Visitor → Video viewer | Participate first; self-promotion gets domains shadow-banned |
| Shorts / TikTok / Reels | Top-of-funnel discovery | Visitor → Video viewer | Keep the 3–7-per-video minimum |
| Partnerships | Borrow trust and audience from tabletop creators | Their audience → ours | Lead with value to *them*, not a pitch |
| Paid (G5 only) | Amplify what already works, never to discover it | — | No paid against a NO-GO homepage or an unproven creative |

## Lead magnet launch

The **Deck-Builder's Primer** is the email engine's hook and is **not yet built**
— neither the PDF nor the `/get-started` capture page exists today. This is
**Gate G2** and a week 1–4 deliverable: produce the primer PDF, build the
`/get-started` capture page with the Brevo signup form, and gate it behind email
on the homepage body (not just the footer) and in every video description +
pinned comment. One magnet, one link, clean UTM attribution first —
theme-specific magnets come later.

## Launch scorecard (weekly read)

A single end-of-week read that **consolidates** existing measurement, not a
parallel system: email signups by video slug, email delivery / open / CTR /
unsub, video CTR (>5%) and avg view duration (>50%), Shorts views and
Shorts→long-form clicks, and — **blocked on G3** — play starts / first-game
conversion and homepage bounce. **The honest gap:** until G3 lands, "play
starts" and "homepage bounce" are not measurable site-side (UTMs flow, but no
tool ingests them yet). **Do not substitute Google Analytics** — it is not this
project's stack, and casually adding it would silently mutate the analytics
decision the funnel-analytics WPs own.

## Next immediate actions

In dependency order (the first three are the critical path):

1. **Clear G1** — ship the homepage to spec; re-grade to GO.
2. **Clear G2** — build the Deck-Builder's Primer + `/get-started` page; gate
   behind email everywhere.
3. **Clear G3** — choose the analytics platform (Plausible) and turn on
   conversion tracking.
4. **Produce + publish** BtA #1 + HtP #1 (G4) and cut their Shorts.
5. **Stand up** Discord + X + Reddit with UTM'd links; begin the weekly
   cross-channel rhythm.

Build the assets now, ship the homepage, then turn on the traffic — in that
order. Measure ruthlessly once G3 lands, and iterate on the winners.

## References

- [go-to-market-plan.md (marketing repo — authoritative)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/go-to-market-plan.md)
- [youtube-channel-plan.md (marketing repo)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/youtube-channel-plan.md)
- [video-commerce-plan.md (marketing repo)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/video-commerce-plan.md)
- [homepage-spec.md (marketing repo)](https://github.com/legendary-arena/legendary-arena-website/blob/main/docs/marketing/homepage-spec.md)
- ewiki mirrors — [YouTube Channel Plan](https://ewiki.legendary-arena.com/youtube-channel-plan/) · [Video Commerce](https://ewiki.legendary-arena.com/video-commerce/) · [Homepage Spec](https://ewiki.legendary-arena.com/homepage-spec/) · [Homepage Review Template](https://ewiki.legendary-arena.com/homepage-review-template/)
- [Monetization Model](https://ewiki.legendary-arena.com/monetization-model/) — revenue streams and the fairness guardrails gear must respect
- [01-VISION.md](https://github.com/barefootbetters/legendary-arena/blob/main/docs/01-VISION.md) — permanent non-goals (the no-pay-to-win boundary)
