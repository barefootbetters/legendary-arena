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
§Financial Sustainability outranks this page. If any content on this page
conflicts with VISION §Financial Sustainability, **VISION controls automatically**
— no interpretation process is required, and this page must be amended to restore
consistency. Nothing here creates policy; it cites policy.

**Change control.** The revenue model is amended only in VISION; the locked
profile boundary is amended only via a new entry in the marketing-repo decision
log (`docs/corporate-memory/01-decision-log.md`), never by editing this page or
the policy doc in place. This page follows those sources — it does not lead them.

## Source ownership

Where each decision actually lives. When in doubt, this table wins over any prose
on the page.

| Topic | Authoritative source |
|-------|----------------------|
| Revenue model (the four streams) | VISION §Financial Sustainability |
| Profile free/paid boundary | Marketing-repo decision log + `docs/product/profile-features-free-vs-paid.md` |
| Legendary Pass mechanics, reward tables, pricing | Marketing-repo product docs (+ decision log) |
| Digital-goods / printables store rollout | Marketing-repo `docs/product/digital-goods-store-rollout.md` |
| Tournament / organized-play funding | [`docs/TOURNAMENT-FUNDING.md`](../docs/TOURNAMENT-FUNDING.md) |
| This page | Reference summary + non-normative rationale only |

## The revenue model (canonical: VISION §Financial Sustainability)

The four approved revenue streams (all fairness-safe):

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

## Profile-page application

The profile is a marketing and virality asset (see [Profile Login](profile-login.md)),
so basic identity — unique handle + public URL — is always free; the paid layer
is prestige, self-expression, and convenience, mapped onto VISION's streams
(Pass = Supporter Subscriptions; frames/banners = One-Time Cosmetics; supporter
flair = Premium Recognition Tiers).

The free/paid boundary is **locked (2026-07-03; amended 2026-07-04)**. Key calls:

- **Always free:** unique handle + public URL, display name, static avatar, a
  standard biography field, all earned badges, basic team display, replay
  verification, recent personal history + basic stats, basic privacy controls.
- **Paid (Legendary Pass / cosmetics):** cosmetic, presentation, archival,
  analytics, export, and customization depth — for example animated avatars &
  frames, custom banners, prestige themes, showcase slots, deeper history and
  search, richer stat visualizations (same data), export tools, granular privacy.
  Illustrative only; the policy doc below owns the authoritative enumeration.
- **Convenience:** first handle change free, repeat changes paid.
- **Not a tier lever:** bio length is not used as a monetization lever.
- **Recognition, not rank:** supporter flair is allowed (VISION Premium
  Recognition Tiers) but must read unambiguously as patronage.

Full split and rationale live in the marketing-repo policy doc
`C:\www\legendary-arena-com\docs\product\profile-features-free-vs-paid.md` — this
page cites it; that doc holds the detailed table. Reviewed on major
profile-feature additions (and at least annually); changes land as a new
decision-log entry, not an in-place edit.

## Scoreboard & performance surfaces

The paid convenience/cosmetic layer also covers the player-facing scoreboard and
stats UI in **arena-client** (`play.legendary-arena.com`). This is *not* the
`/scoring/` page on this wiki, which is the internal engineering doc for the
scoring system, not a product surface.

Same filter as everywhere: features that confer no gameplay advantage (NG‑1…NG‑7)
**may** be offered as paid cosmetic or convenience features, subject to the
guardrails below — the goal is a real free experience, not to monetize everything
that moves. Free keeps a genuine player experience: recent history, basic charts,
own best PAR delta, replay verification, and the quality-normalized public views.
Paid adds depth and tooling (illustrative): full lifetime history with search,
richer interactive visualizations, high-quality branded exports, and
pin-to-profile highlights. **Comparison tooling** is the one fairness-sensitive
line — free keeps a fair baseline (compare against public examples + modest
slots); paid expands slots and the side-by-side viewer, gating quantity/tooling
only, never the ability to learn from public examples.

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
  [`docs/TOURNAMENT-FUNDING.md`](../docs/TOURNAMENT-FUNDING.md)).

Rollout sequencing and priorities live in the marketing repo
(`docs/product/digital-goods-store-rollout.md`), not here — this page records
that the surfaces exist and which streams they belong to.

## Seasonal engagement: the Legendary Pass (Stream #1 execution)

The Legendary Supporter Subscriptions stream is being developed as a seasonal,
dual-track **Legendary Pass** — a free track open to every logged-in player and a
premium track. Rewards are unlocked solely by *play* (arena progression earned
from completed games, personal-best PAR, verified replays, and rotating
challenges); paid players never progress faster. This applies the Fortnite
existence proof directly: it re-sells the same player base each season while
rewarding the players who actually show up.

Fairness properties that keep it inside every Non-Goal:

- Progression currency is earned by play only; no purchasable progression boosters.
- Every reward is cosmetic, convenience, or recognition — zero impact on rules,
  scoring, PAR, matchmaking, leaderboard eligibility, or standing.
- The free track is always present and meaningful; basic identity and public
  leaderboard participation stay free (Guardrails #1 and #2).
- All rewards are deterministic and fully previewable before claim or purchase — no
  randomness (Guardrail #5). Season titles and flair read unambiguously as
  patronage (Guardrail #3). Optional paid level-skips, when offered, are
  transparent, linearly priced, and grant only the same cosmetics a player could
  earn by play.

### Classification

> The Legendary Pass is an implementation of Revenue Stream #1 (Legendary
> Supporter Subscriptions). It is not a fifth revenue stream and creates no
> amendment to the VISION revenue model.

The detailed mechanics — progression schedule, per-season reward tables, pricing,
and level-skip terms — are a product spec tracked in the marketing-repo product
docs and blessed via the decision log, exactly like the profile boundary and the
digital-goods store. This page records only that the execution exists and which
stream it belongs to; it does not define the mechanics or set the price.

## Prohibited monetization

Permanently out of scope unless VISION is amended. This is the quick blacklist for
developers and reviewers; the Guardrails below give the principles and rationale,
and `scripts/audit/vision/monetization.greps.mjs` enforces a subset in code.

- Gameplay advantages of any kind (pay-to-win)
- Competitive-ranking advantages, or paid matchmaking advantages
- Paid leaderboard placement, or any paid competitive signal
- Loot boxes, gacha, randomized or mystery purchases, gambling mechanics
- Energy systems or pay-to-skip timers
- Sale or brokering of player data
- Third-party advertising or sponsor surfaces in gameplay

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
6. **No ads or data monetization.** In-gameplay advertising, sponsor surfaces,
   and selling or brokering player data are out (VISION NG‑5) — they would clash
   with the trust/tribe positioning the free core is built to earn.

## Economic rationale (non-normative)

> This section is explanatory only. The authoritative monetization model is
> VISION §Financial Sustainability; the examples and historical comparisons below
> are illustrative and carry no governance weight.

### Why free-to-play funds the model (loss-leader economics)

The shape above — free to play (`play.legendary-arena.com`), free to browse the
card registry (`cards.legendary-arena.com`), paid only for cosmetic, convenience,
and recognition layers — is a deliberate **loss-leader / "razor-and-blades"**
structure, not an accident of what happened to be easy to charge for.

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

### Where the model sits among free-core precedents

Three well-known projects give away their core and fund it three different ways.
The comparison clarifies which parts of each precedent Legendary Arena borrows —
and which it must not.

| Precedent | Free core | Who pays | For what |
|-----------|-----------|----------|----------|
| **Fortnite** | The game | Players | Cosmetics, seasonal passes, recognition — optional, engagement-driven, deterministic, zero pay-to-win |
| **Linux** | The kernel | Corporations that depend on it | A neutral maintainer / shared infrastructure (the Linux Foundation pays the steward; no license royalties) |
| **GNU / FSF** | The software and the four freedoms | Donors and members | The mission itself (nonprofit patronage) |

Legendary Arena is a deliberate blend of the first two:

- **From Fortnite — the consumer engine.** Free-to-play plus cosmetic,
  convenience, and recognition revenue is the proven at-scale model, and it is
  exactly the four streams above. Fortnite also supplies the cautionary half:
  after its 2023 FTC settlement over randomized "loot-llama" purchases, the
  industry lesson is disclosed, deterministic purchases — which is why Guardrail
  #5 bans randomness outright.
- **From Linux — the shared-infrastructure piece.** Enterprise and
  organized-play licensing is the Linux-Foundation logic in miniature: the
  organizers, schools, and creators who depend on a healthy ecosystem help fund
  the platform that keeps it healthy. Platform→organizer billing only, never a
  path to bill players (see [`docs/TOURNAMENT-FUNDING.md`](../docs/TOURNAMENT-FUNDING.md)).
- **Not from the FSF — pure patronage.** The donation-funded model sustains a
  nonprofit mission; it does not cover Marvel / Upper Deck royalties, payroll, and
  ongoing development. Recognition tiers (Guardrail #3) borrow the *idea* of
  patronage as a supplement, never as the primary engine.

The takeaway: instrument and iterate the fairness-safe product streams (Fortnite's
lesson), lean on ecosystem-funded facilitation where it fits (Linux's lesson), and
keep patronage a garnish, not the meal (the FSF's limit).

## References

- [`docs/01-VISION.md`](../docs/01-VISION.md) — §Financial Sustainability (**canonical revenue model**)
- [`docs/TOURNAMENT-FUNDING.md`](../docs/TOURNAMENT-FUNDING.md) — organizer-side tournament funding policy (WP-097)
- [Profile Login](profile-login.md) — the profile/auth surface the paid layer attaches to
- [Legendary Forge](legendary-forge.md) — the physical product behind the digital-unlock bridge
- `C:\www\legendary-arena-com\docs\product\profile-features-free-vs-paid.md` — profile free/paid boundary **policy** (marketing repo, internal; locked 2026-07-03, amended 2026-07-04)
