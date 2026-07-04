---
title: Monetization Model
type: Brand
tags:
  - monetization
  - subscriptions
  - brand
  - governance
  - profile
related:
  - profile-login.md
  - legendary-forge.md
  - hugo-web-system.md
source:
  - ../docs/01-VISION.md
  - ../docs/TOURNAMENT-FUNDING.md
status: draft
last-reviewed: 2026-07-03
---

# Monetization Model

> This page publishes the settled view of how Legendary Arena makes money. Both
> the revenue model (VISION §Financial Sustainability) and the profile-page
> free/paid boundary (locked 2026-07-03) are decided. This page cites them; it
> defines nothing.

## Summary

Legendary Arena funds itself through cosmetic, convenience, and recognition
revenue — **never** gameplay advantage. The canonical model lives in
[`docs/01-VISION.md`](../docs/01-VISION.md) §Financial Sustainability ("No Margin,
No Mission"): four revenue streams, mandatory Upper Deck / Marvel royalties, and
the hard rule that revenue never crosses a Non-Goal boundary (NG‑1…NG‑7). This
page is the engineer- and designer-facing companion to that section — it explains
the model and how it lands on real surfaces (the profile, the Forge bridge). It
does not redefine anything.

## Authority

**VISION is authoritative.** Per the wiki
[authority hierarchy](SCHEMA.md#authority-position), `docs/01-VISION.md`
§Financial Sustainability outranks this page. If this page and VISION disagree,
**this page is wrong** and must be corrected. Nothing here creates policy; it
cites policy.

## The revenue model (canonical: VISION §Financial Sustainability)

Four streams, all fairness-safe:

| Stream | What it sells | Never includes |
|--------|---------------|----------------|
| **Legendary Supporter Subscriptions** | Recurring cosmetic + convenience: playmats, card-backs, UI themes, sound packs, unlimited replay storage, priority queues, early access to non-gameplay features | Any gameplay advantage |
| **One-Time Cosmetic & Presentation Purchases** | Deterministic, fully disclosed packs — alternate frames, themed tables, avatar options | Rules/balance changes |
| **Premium Recognition Tiers** | Public recognition, exclusive flair, "Hall of Legends" wall, priority access to community surfaces | Competitive standing signals |
| **Enterprise & Organized-Play Licensing** | Paid hosting / white-label for organizers, creators, schools, libraries — facilitation only | Player advantage |

A non-negotiable portion of every dollar flows as royalties to **Upper Deck
Entertainment and Marvel**. See VISION for the full covenant.

Related governance: tournament-level community funding is separate and
organizer-side (no organizer margin) — see
[`docs/TOURNAMENT-FUNDING.md`](../docs/TOURNAMENT-FUNDING.md). Note the deliberate
slogan divergence: VISION uses "No margin, no mission" in the nonprofit-margin
sense; the funding doc uses "no organizer margin" in the opposite sense, and the
slogan is banned from the funding doc to avoid collision.

## Profile-page application

The profile is a marketing and virality asset (see [Profile Login](profile-login.md)),
so basic identity — unique handle + public URL — is always free; the paid layer
is prestige, self-expression, and convenience, mapped onto VISION's streams
(Pass = Supporter Subscriptions; frames/banners = One-Time Cosmetics; supporter
flair = Premium Recognition Tiers).

The free/paid boundary is **locked (2026-07-03)**. Key calls:

- **Always free:** unique handle + public URL, display name, static avatar, a
  generous bio, all earned badges, basic team display, replay verification,
  personal stats/history, basic privacy controls.
- **Paid (Legendary Pass / cosmetics):** animated avatars & frames, custom
  banners, prestige themes, showcase slots & highlights, richer stat
  visualizations (same data), granular privacy, larger replay gallery.
- **Convenience:** first handle change free, repeat changes paid.
- **Not a tier lever:** bio length — everyone gets a decent length.
- **Recognition, not rank:** supporter flair is allowed (VISION Premium
  Recognition Tiers) but must read unambiguously as patronage.

Full split and rationale live in the marketing-repo policy doc
`C:\www\legendary-arena-com\docs\product\profile-features-free-vs-paid.md` — this
page cites it; that doc holds the detailed table.

## The physical → digital bridge

Owning a [Legendary Forge](legendary-forge.md) diorama unlocks exclusive cosmetic
profile items (frames, badges, banners). This is a differentiated,
hard-to-copy lever that bridges the two businesses with zero pay-to-win, since the
unlocks are purely cosmetic. Mechanics are owned by the `legendary-forge` repo;
this page only notes the tie-in exists.

## Guardrails (from VISION Non-Goals)

1. **No paid competitive signal.** Nothing paid may confer — or *appear* to
   confer — gameplay advantage or standing (NG‑1…NG‑7).
2. **Basic identity is always free.** Unique handle + public profile URL.
3. **Recognition ≠ rank.** Premium Recognition Tiers are explicitly authorized by
   VISION, but supporter marks must read unambiguously as patronage, never as
   competitive standing.
4. **Royalties come first.** Revenue covers expenses + royalties before buffer or
   expansion.

## References

- [`docs/01-VISION.md`](../docs/01-VISION.md) — §Financial Sustainability (**canonical revenue model**)
- [`docs/TOURNAMENT-FUNDING.md`](../docs/TOURNAMENT-FUNDING.md) — organizer-side tournament funding policy (WP-097)
- [Profile Login](profile-login.md) — the profile/auth surface the paid layer attaches to
- [Legendary Forge](legendary-forge.md) — the physical product behind the digital-unlock bridge
- `C:\www\legendary-arena-com\docs\product\profile-features-free-vs-paid.md` — profile free/paid boundary **policy** (marketing repo, internal; locked 2026-07-03)
