---
title: User Feedback and Public Roadmap
type: Guide
tags:
  - feedback
  - roadmap
  - changelog
  - voting
  - community
  - governance
  - layer-marketing
  - planning
  - research
related:
  - changelog.md
  - dashboard.md
  - development-workflow.md
  - monetization-model.md
  - legendary-arena-tribe-and-trust.md
  - blog-post-authoring.md
  - seed-challenges.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\user-feedback-and-public-roadmap.md (this page — https://ewiki.legendary-arena.com/user-feedback-and-public-roadmap/)
  - ../docs/01-VISION.md
  - ../docs/09-CHANGELOG.md
  - ../docs/ai/REFERENCE/development-workflow.md
last-reviewed: 2026-08-24
---

# User Feedback and Public Roadmap

## Summary

*(Draft, planning.)* This page surveys the options for collecting player
feedback — **bug reports, enhancement requests, and reviews** — and proposes a
four-stage pipeline: **intake → tracking → voting → public roadmap**. It weighs
build-vs-buy for each stage, recommends identity-gated voting on the existing
Hanko login, and recommends a **monthly public changelog nested under quarterly
roadmap themes** so anyone can see what shipped, what's in progress *this month*,
and what's coming. It proposes a design and records a recommendation; it defines
nothing and reserves no `WP-` / `D-` yet. Once a direction is chosen, the
concrete decision belongs in [DECISIONS.md](../docs/ai/DECISIONS.md) and the
build in a Work Packet — not here.

## Mechanics

### The three feedback types are not one system

Treating "feedback" as a single inbox is the most common mistake. The three
inputs have different shapes, different urgency, and different audiences, and
collapsing them produces a channel that serves none of them well.

| Type | What it is | Urgency | Wants a reply? | Public? |
|---|---|---|---|---|
| **Bug report** | "X is broken / froze / rendered wrong" | High — revenue and trust bleed while it's open | Yes: acknowledge + fix ETA | Usually kept private (may contain a match/diagnostics dump) |
| **Enhancement request** | "I wish it did Y" | Low — backlog input | Eventually: "planned / declined / shipped" | **Yes** — this is what the roadmap + voting surface is *for* |
| **Review / testimonial** | "Here's what I think of it" (rating + prose) | Low, but marketing-critical | Rarely 1:1; aggregate matters | **Yes** — social proof on the homepage and stores |

The pipeline below routes each type to a fit-for-purpose home. A bug carries a
[Play Diagnostics](play-diagnostics.md) payload and should land close to the
engineering triage loop; an enhancement request wants to be *visible and
votable*; a review wants to be *aggregated and displayed*.

### Stage 1 — Intake (how feedback arrives)

The honest trade is **speed-to-launch (buy)** versus **owning the data and the
cost curve (build)**. Legendary Arena already runs the pieces a built solution
needs — PostgreSQL, a Hanko identity broker ([Profile Login](profile-login.md)),
Cloudflare, and a Vue admin surface ([Dashboard](dashboard.md)) — which tilts
the math toward build for anything long-lived, and toward buy only when the goal
is to validate the *idea* of a feedback board before investing in one.

| Option | Pros | Cons | Fit |
|---|---|---|---|
| **In-app widget → own Postgres** (custom) | Owns the data; no per-seat SaaS bill; ties to the real player account; one identity, one moderation surface; captures diagnostics on bug reports | Build + maintain cost; moderation and spam controls are on us; no roadmap/voting UI out of the box | **Recommended for bugs**, and the long-term home for everything |
| **Fider** (open-source, self-hostable) | Free; self-hosted → owns the data; has voting + status columns + public board built in; MIT-adjacent licensing | One more service to host, patch, and back up; its auth is separate unless bridged to Hanko | **Strong build-vs-buy middle** for enhancement requests |
| **Canny / Featurebase / Frill / Nolt** (SaaS boards) | Fastest to launch; polished voting + roadmap + changelog in one; low ops burden | Recurring cost that scales with usage; data lives off-platform; another login for players; export/lock-in risk | **Buy only to validate**, then migrate |
| **GitHub Issues (public repo)** | Free; devs live there already; great for bugs | The engine repo is **private** (governance + IP), so this needs a *separate public* issues-only repo; not player-friendly; no native voting beyond 👍 | Poor fit for a consumer audience |
| **Discord / community** | Where players already are; conversational; zero build | Ephemeral; not rankable; no status tracking; moderation-heavy; feedback evaporates in the scroll | Good *listening post*, bad *system of record* |
| **Email / embedded form** (Brevo, Typeform) | Trivial to stand up; reuses the [Brevo Email Pipeline](brevo-email-pipeline.md) | Unstructured; no voting; no public visibility; manual triage | Fine as a fallback "contact us", not the backbone |

**Recommendation.** Route **bug reports** into a small custom intake backed by
the existing Postgres + Hanko stack, carrying the diagnostics payload straight
to engineering triage. Give **enhancement requests** a public, votable board —
self-hosted **Fider** if we want a proven board today with the least build, or a
custom board on the same stack if we'd rather own every pixel and avoid a second
service. The bright line: don't stand up a paid SaaS board as the *permanent*
home when we already own identity, storage, and an admin UI — that's the
institutional-dependency trap. Buy it only as a two-week experiment to prove
players will actually vote before we build.

### Stage 2 — Reviews (a different animal)

Reviews are not backlog items; they are **social proof** and belong on the
marketing surface, not the roadmap board. Options: a star-rating + prose field
gated behind a real (logged-in, match-having) account to keep them authentic;
app-store and marketplace reviews once distributed there; and curated
testimonials on the homepage. Authenticity is the whole game — a review from an
account that has actually played carries weight; an anonymous one invites
astroturf. This ties directly into the trust posture in
[Legendary Arena — Tribe and Trust](legendary-arena-tribe-and-trust.md): the same
identity fence that filters the community also authenticates a review.

### Stage 3 — Tracking (public status ↔ internal work spine)

The project already has a rigorous **internal** tracking spine — Work Packets and
Execution Checklists in
[WORK_INDEX.md](../docs/ai/work-packets/WORK_INDEX.md), decisions in
[DECISIONS.md](../docs/ai/DECISIONS.md), and the build-time
[Dashboard](dashboard.md) `/pipeline` and roadmap views
([Development Workflow](development-workflow.md)). What's missing is the
**public-facing** projection of that spine. The tracking system's job is to be a
thin, honest mapping:

```
Public feedback item  ──►  Internal WP/EC        ──►  Public status
(votable, plain-language)   (the real work unit)      (5 states, below)
```

A **closed set of public statuses** keeps the board legible and sets
expectations without over-promising:

| Public status | Means | Internal signal |
|---|---|---|
| **Under review** | Received, not yet triaged | No WP yet |
| **Planned** | Accepted; scheduled to a month/quarter | WP drafted / queued in WORK_INDEX |
| **In progress** | Being worked this month | WP executing |
| **Shipped** | Live in production, with a date | WP complete + merged to `main` |
| **Declined** | Won't do — with a one-line reason | Logged; closes the loop honestly |

The mapping stays deliberately loose: one public item may span several WPs, and
internal WP/EC/D numbering never leaks to players. **Declined with a reason** is
as important as Shipped — an ignored request is worse than a declined one,
because silence reads as "they don't listen."

### Stage 4 — Voting (rank what's most wanted)

Voting turns a wishlist into a **priority signal**. The design questions are
identity, weight, and abuse.

- **Identity-gated.** One vote per **account** per item, authenticated through
  the existing Hanko login ([Profile Login](profile-login.md)). This is the
  single biggest anti-abuse lever and we already have the machinery — no anonymous
  or IP-based voting, which is trivially stuffed.
- **Simple upvote, not up/down.** Enhancement boards rank by demand; a downvote
  mostly discourages posting. Keep it a one-directional "I want this too," with a
  running count and a "you voted" state.
- **Weighting (optional, later).** Votes *could* be weighted by engagement
  (matches played) or by paid tier — a
  [Legendary Pass](monetization-model.md) holder's vote counting for more is a
  defensible perk and a monetization hook. Start unweighted (one account, one
  vote) for trust; revisit weighting only if raw counts get gamed or if it
  becomes a deliberate Pass benefit.
- **Sort by demand, show the tail.** Default the board to most-voted, but keep
  newer and "planned" items reachable so the board doesn't ossify around its
  first popular entries.

Voting does **not** bind the roadmap. It's an input to prioritization, not a
referendum — the operator still owns sequencing (some low-vote items are
load-bearing infrastructure; some high-vote items conflict with the
[Vision](vision.md) bright lines). The board promises *"we see the demand,"* not
*"the top vote ships next."*

### Stage 5 — Public visibility (changelog + roadmap)

This is the "so anyone can see what we've done, what's being worked on, and
what's coming" surface. Three sub-surfaces, each with a job:

1. **Roadmap board** — the live *forward* view: the votable enhancement board
   filtered to **Planned / In progress**, grouped by the current period. This is
   where "what's being worked on this month" lives.
2. **Changelog** — the *backward* view: what shipped, newest first, each with a
   date. The repo already maintains [docs/09-CHANGELOG.md](../docs/09-CHANGELOG.md),
   projected onto the ewiki as [Changelog](changelog.md). A **player-facing**
   changelog on `legendary-arena.com` would be a lighter, plain-language sibling
   — the same shipped items, minus the WP/architecture vocabulary.
3. **Monthly recap post** — a narrative [blog post](blog-post-authoring.md) that
   ties the month together: "here's what we shipped, here's what you voted up,
   here's what's next." This is the marketing artifact; the board and changelog
   are the systems of record it points at.

**Where it lives.** The forward roadmap and the player changelog belong on the
marketing site (`www.legendary-arena.com`, Hugo) or a dedicated
`roadmap.legendary-arena.com`, because they're consumer-facing and want to ship
JavaScript (live vote counts, filtering) — which the **ewiki cannot do** (its
zero-`<script>` JS-free gate). This page (an ewiki design doc) describes the
system; the system itself renders on the JS-capable marketing surface.

### Cadence — monthly vs quarterly (the recommendation)

Jeff asked for a direct opinion. **Run a two-tier cadence: quarterly themes over
a monthly changelog.**

- **Monthly changelog + recap** is the heartbeat. It answers "what did you do
  *this* month, and what are you doing *now*." Given this project's throughput —
  a Work Packet can land every few hours — a **quarterly-only** cadence would
  bury months of visible progress and read as stale between drops. Monthly
  showcases velocity, and velocity is itself a marketing asset for a young
  product: a roadmap that visibly moves every 30 days builds more trust than a
  polished one that updates four times a year.
- **Quarterly themes** are the horizon. Each quarter gets a small number of
  named bets ("Q4: competitive scoring + the public roadmap") that the monthly
  changelogs ladder up to. Themes give the roadmap a shape beyond a flat list and
  let you say no to off-theme requests gracefully.
- **Not weekly.** Weekly would be too noisy to curate and would trivialize
  individual ships. Monthly is frequent enough to show momentum, infrequent
  enough to be worth reading.

Concretely: each monthly changelog names **what was planned for that month** and
stamps the **date each item was accomplished** — exactly the "planned vs
delivered, with dates" shape Jeff described. The quarterly theme sits above it as
the "why these, in this order" framing.

## Interactions

- **[Changelog](changelog.md)** — the existing backward-looking record
  (projected from `docs/09-CHANGELOG.md`). The proposed player-facing changelog
  is a plain-language sibling of this, not a replacement.
- **[Dashboard](dashboard.md)** — the internal `/pipeline` and roadmap views are
  the *private* system of record; the public roadmap board is a curated
  projection of the same underlying work.
- **[Development Workflow](development-workflow.md)** — the WP → GitHub →
  auto-deploy loop that a "Shipped" status hangs off; a public item flips to
  Shipped when its WP merges to `main`.
- **[Profile Login](profile-login.md)** — the Hanko identity that gates voting
  and authenticates reviews (one account, one vote).
- **[Legendary Arena — Tribe and Trust](legendary-arena-tribe-and-trust.md)** —
  the trust/identity fence that keeps voting and reviews authentic rather than
  astroturfed.
- **[Monetization Model](monetization-model.md)** — where optional vote-weighting
  or a [Legendary Pass](monetization-model.md) roadmap perk would attach, subject
  to the Vision fairness bright lines.
- **[Blog Post Authoring](blog-post-authoring.md)** — the monthly recap post is a
  Mode-C blog artifact on the marketing site.
- **[Seed Challenges](seed-challenges.md)** — an example of a proposed feature
  that a public roadmap board would track from "Planned" to "Shipped."

## Edge Cases

- **The feedback graveyard.** A board where nothing ever changes status is worse
  than no board — it advertises inattention. Every item needs a terminal state
  (Shipped or Declined-with-reason); a monthly triage that touches every stale
  "Under review" item is the maintenance cost of running this at all.
- **Roadmap-as-promise.** A public "Planned" item is read as a commitment.
  Hedge the surface ("directional, not a guarantee; priorities shift") and prefer
  moving items to Declined over letting them rot, so the board stays honest.
- **Ballot-stuffing.** Anonymous or IP-based voting is trivially gamed; this is
  the whole reason to gate on the Hanko account. Sockpuppet accounts remain a
  residual risk that ties back to the Tribe-and-Trust identity controls.
- **PII in bug reports.** A [Play Diagnostics](play-diagnostics.md) dump is
  credential-redacted by design, but free-text feedback can still carry personal
  detail. Intake storage inherits the same privacy handling as any player data;
  don't surface raw bug text publicly.
- **Private repo, no public Issues.** The engine repo is private (IP +
  governance), so "just use GitHub Issues" isn't a consumer option without a
  separate public issues-only repo — noted so it isn't re-proposed each time.
- **Review authenticity.** Reviews from accounts that never played are
  astroturf; gate the review form behind a real, match-having account.
- **SaaS lock-in.** If a hosted board (Canny/Featurebase/etc.) is used to
  validate, confirm data export *before* adopting it, so the eventual migration to
  an owned surface isn't a hostage situation.

## Open Questions

- **Build vs buy for the enhancement board** — self-hosted Fider, a fully custom
  board on Postgres+Hanko, or a SaaS validation phase first? Not yet decided;
  needs a `DECISIONS.md` entry once chosen.
- **Where the public roadmap renders** — a section of `www.legendary-arena.com`
  or a dedicated `roadmap.legendary-arena.com` subdomain? (Check the subdomain
  manifest before assuming a host.)
- **Player-facing changelog authoring** — hand-written plain-language sibling, or
  a filtered auto-projection of `docs/09-CHANGELOG.md`? The former reads better;
  the latter can't drift.
- **Vote weighting** — start unweighted; revisit only if raw counts get gamed or
  if weighting becomes a deliberate Legendary Pass perk (a Vision-fairness
  question, not just an engineering one).
- **Moderation ownership** — who triages the board monthly, and against what
  SLA? A board is a standing commitment, not a launch-and-forget feature.
- **No `WP-` / `D-` reserved yet.** This page is a proposal. Reserve numbers and
  draft the Work Packet(s) when a direction is chosen — do not treat this page as
  authorization to build.

## References

- [docs/01-VISION.md](../docs/01-VISION.md) — the fairness bright lines and
  "no margin, no mission" funding posture that constrain vote-weighting and any
  monetization hook on the roadmap.
- [docs/09-CHANGELOG.md](../docs/09-CHANGELOG.md) — the existing
  backward-looking changelog and its projection to the ewiki.
- [docs/ai/REFERENCE/development-workflow.md](../docs/ai/REFERENCE/development-workflow.md)
  — the WP → deploy loop a "Shipped" status derives from.
- [WORK_INDEX.md](../docs/ai/work-packets/WORK_INDEX.md) and
  [DECISIONS.md](../docs/ai/DECISIONS.md) — the internal work spine the public
  board projects.
- [Dashboard](dashboard.md), [Development Workflow](development-workflow.md),
  [Changelog](changelog.md), [Profile Login](profile-login.md),
  [Monetization Model](monetization-model.md),
  [Legendary Arena — Tribe and Trust](legendary-arena-tribe-and-trust.md),
  [Blog Post Authoring](blog-post-authoring.md) — related wiki pages (see
  Interactions).
- **External tools surveyed** (not endorsements; for build-vs-buy comparison):
  Fider (`https://fider.io`, open-source, self-hostable),
  Canny (`https://canny.io`), Featurebase (`https://featurebase.app`),
  Frill (`https://frill.co`), Nolt (`https://nolt.io`).
