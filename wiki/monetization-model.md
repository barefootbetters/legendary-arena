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
  - C:\pcloud\BB\DEV\legendary-arena\wiki\monetization-model.md (this page — https://ewiki.legendary-arena.com/monetization-model/)
  - ../docs/01-VISION.md
  - ../docs/TOURNAMENT-FUNDING.md
status: draft
last-reviewed: 2026-07-29
---

# Monetization Model

> This page publishes the settled view of how Legendary Arena makes money. Both
> the revenue model (VISION §Financial Sustainability) and the profile-page
> free/paid boundary (locked 2026-07-03, amended 2026-07-04) are decided. This page cites them; it
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

**Change control.** The revenue model is amended only in VISION; the locked
profile boundary is amended only via a new entry in the marketing-repo decision
log (`docs/corporate-memory/01-decision-log.md`), never by editing this page or
the policy doc in place. This page follows those sources — it does not lead them.

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

![Pie chart of the four Legendary Arena revenue streams — Legendary Supporter Subscriptions (45%), One-Time Cosmetic & Presentation Purchases (25%), Enterprise & Organized-Play Licensing (18%), and Premium Recognition Tiers (12%). Proportions are illustrative, not a forecast.](/monetization-model/revenue-streams.svg "width=88%")

*Illustrative revenue mix — **not a forecast, target, or policy figure**. The
canonical model is the four streams themselves (VISION §Financial
Sustainability), not any dollar split; these proportions are placeholders
pending real figures. Diagram source:
[revenue-streams.mmd](../ewiki/monetization-model/revenue-streams.mmd) —
regenerate the render with `mmdc`.*

Related governance: tournament-level community funding is separate and
organizer-side (no organizer margin) — see
[`docs/TOURNAMENT-FUNDING.md`](../docs/TOURNAMENT-FUNDING.md). Note the deliberate
slogan divergence: VISION uses "No margin, no mission" in the nonprofit-margin
sense; the funding doc uses "no organizer margin" in the opposite sense, and the
slogan is banned from the funding doc to avoid collision.

## Why free-to-play funds the model (loss-leader economics)

The shape above — free to play (`play.legendary-arena.com`), free to browse the
card registry (`cards.legendary-arena.com`), paid only for cosmetic, convenience,
and recognition layers — is a deliberate **loss-leader / "razor-and-blades"**
structure, not an accident of what happened to be easy to charge for. This
section explains the economic reasoning behind the settled model. It introduces
no new stream and moves no boundary; it is rationale, not policy.

**The pattern, from outside the game industry.** Coca-Cola supplies Disney parks
with fountain syrup at little or no cost in exchange for pouring-rights
exclusivity — the "free" product is an advertising expense that buys reach to a
captive, high-affinity audience. Disney in turn sells the finished drink at a
large markup, where the *complementary good* (the cup) and the captive venue —
not the syrup — carry the economics. Gillette runs the mirror image: cheap
handles, profitable blades. Give away, or price near cost, the thing that
acquires the customer; earn on the recurring complement they come back for.

**How it maps here:**

| Role in the pattern | Legendary Arena surface |
|---------------------|-------------------------|
| The "free" acquisition good (buys reach) | Free play + free registry viewer |
| The conversion step (capture identity, build the habit) | Free account + public profile — always free (Guardrail #2) |
| The profitable "blades" (recurring, engagement-scaled) | Cosmetic / convenience / recognition depth — the four streams above |

Free play and the registry viewer are the reach engine — how the brand gets in
front of players and how word spreads. Treating them as a marketing investment,
not as revenue left on the table, is the point; the money is made on the layers
an already-engaged player chooses to add.

**The trap this pattern hides — and why the leaderboard stays free.** The
tempting misread of "charge for the valuable part" is to gate the competitive
leaderboard behind payment. That is foreclosed here for two independent reasons:

1. **Fairness (binding).** Competitive standing is exactly what revenue may never
   touch (Guardrail #1, Guardrail #3; VISION NG‑1). Selling leaderboard presence
   or standing is a paid competitive signal — out, regardless of its commercial
   appeal.
2. **It is also commercially self-defeating.** Unlike Gillette blades, a
   leaderboard has a network effect: its value *is* the density of credible
   competitors on it. Gating participation shrinks that pool, which lowers the
   board's value, which lowers willingness to pay for anything attached to it — a
   doom loop. Coca-Cola's markup was safe because the captive audience already
   existed; a thin leaderboard has no such moat.

So the fairness-safe answer and the commercially-correct answer coincide: keep
ranked participation and basic identity free (a dense board and a healthy funnel),
and sell the cosmetic, convenience, and recognition **depth** around it — animated
frames, richer stat tooling, supporter flair, export tools, the Forge digital
bridge. That is precisely the split the four streams already encode.

## Profile-page application

The profile is a marketing and virality asset (see [Profile Login](profile-login.md)),
so basic identity — unique handle + public URL — is always free; the paid layer
is prestige, self-expression, and convenience, mapped onto VISION's streams
(Pass = Supporter Subscriptions; frames/banners = One-Time Cosmetics; supporter
flair = Premium Recognition Tiers).

The free/paid boundary is **locked (2026-07-03; amended 2026-07-04)**. Key calls:

- **Always free:** unique handle + public URL, display name, static avatar, a
  generous bio, all earned badges, basic team display, replay verification,
  recent personal history + basic stats, basic privacy controls.
- **Paid (Legendary Pass / cosmetics):** animated avatars & frames, custom
  banners, prestige themes, showcase slots & highlights, full lifetime history
  depth + search/filters, richer stat visualizations & dashboards (same data),
  export tools, granular privacy, larger replay gallery.
- **Convenience:** first handle change free, repeat changes paid.
- **Not a tier lever:** bio length — everyone gets a decent length.
- **Recognition, not rank:** supporter flair is allowed (VISION Premium
  Recognition Tiers) but must read unambiguously as patronage.

Full split and rationale live in the marketing-repo policy doc
`C:\www\legendary-arena-com\docs\product\profile-features-free-vs-paid.md` — this
page cites it; that doc holds the detailed table. Reviewed on major
profile-feature additions (and at least annually); changes land as a new
decision-log entry, not an in-place edit.

## Scoreboard & performance surfaces

The paid convenience/cosmetic layer also covers the player-facing scoreboard and
stats UI in **arena-client** (`play.legendary-arena.com` — the WP-054 / WP-149
public-leaderboard and personal-stats work). This is *not* the `/scoring/` page
on this wiki, which is the internal engineering doc for the scoring system, not a
product surface.

Same filter as everywhere: anything that confers no gameplay advantage
(NG‑1…NG‑7) defaults to paid. Free keeps a real player experience — recent
history, basic charts, own best PAR delta, replay verification, and the
quality-normalized public views. Paid adds depth and tooling: full lifetime
history + search, rich interactive visualizations & dashboards, high-quality
branded exports, pin-to-profile highlights, and priority loading for large
histories. **Comparison tooling** is the one fairness-sensitive line — free keeps
a fair baseline (compare against public examples + modest slots); paid expands
slots and the side-by-side viewer, gating quantity/tooling only, never the
ability to learn from public examples.

Detailed split: the marketing-repo policy doc
`C:\www\legendary-arena-com\docs\product\profile-features-free-vs-paid.md`
(§Scoreboard & performance surfaces).

## The physical → digital bridge

Owning a [Legendary Forge](legendary-forge.md) diorama unlocks exclusive cosmetic
profile items (frames, badges, banners). This is a differentiated,
hard-to-copy lever that bridges the two businesses with zero pay-to-win, since the
unlocks are purely cosmetic. Mechanics are owned by the `legendary-forge` repo;
this page only notes the tie-in exists.

## Additional revenue surfaces

Two further applications of the existing streams, committed 2026-07-04
(marketing-repo decision log). Neither is a new stream.

- **Premium Digital Goods & Printables Store** (`legendary-arena.com` shop) —
  printable playmats, art books, premium sound/theme packs, limited card-back
  tools. Maps to **One-Time Cosmetic & Presentation Purchases** (+ rotating packs
  via Subscriptions); rides the existing Snipcart/Stripe commerce layer. The
  printables derive from Marvel/Upper Deck IP, so royalty routing (VISION:
  royalties on all revenue) and licensing scope are launch prerequisites, not
  afterthoughts.
- **Tournament OS add-ons** — branded dashboards, automated reporting, private
  scenario libraries, priority support for organizers. Maps to **Enterprise &
  Organized-Play Licensing**. Platform→organizer billing only; never a path for
  organizers to bill players for profit (see
  [`docs/TOURNAMENT-FUNDING.md`](../docs/TOURNAMENT-FUNDING.md) / WP-097).

Rollout sequencing and priorities live in the marketing repo
(`docs/product/digital-goods-store-rollout.md`), not here — this page records
that the surfaces exist and which streams they belong to.

## Guardrails (from VISION Non-Goals)

1. **No paid competitive signal.** Nothing paid may confer — or *appear* to
   confer — gameplay advantage or standing (NG‑1…NG‑7).
2. **Basic identity is always free.** Unique handle + public profile URL.
3. **Recognition ≠ rank.** Premium Recognition Tiers are explicitly authorized by
   VISION, but supporter marks must read unambiguously as patronage, never as
   competitive standing.
4. **Royalties come first.** Revenue covers expenses + royalties before buffer or
   expansion.
5. **No randomness.** Every purchase is deterministic, fully disclosed, and
   purchase-known — no loot boxes, gacha, or randomized/mystery goods (mirrors
   VISION's "deterministic, fully disclosed" cosmetics language).

## References

- [`docs/01-VISION.md`](../docs/01-VISION.md) — §Financial Sustainability (**canonical revenue model**)
- [`docs/TOURNAMENT-FUNDING.md`](../docs/TOURNAMENT-FUNDING.md) — organizer-side tournament funding policy (WP-097)
- [Profile Login](profile-login.md) — the profile/auth surface the paid layer attaches to
- [Legendary Forge](legendary-forge.md) — the physical product behind the digital-unlock bridge
- `C:\www\legendary-arena-com\docs\product\profile-features-free-vs-paid.md` — profile free/paid boundary **policy** (marketing repo, internal; locked 2026-07-03, amended 2026-07-04)
