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

### Core principles

Six principles summarize the whole proposal and are the governance lens for
every implementation decision that follows. If a later design choice violates
one of these, the choice is wrong — not the principle.

1. **Feedback is signal, not authority.** It informs the work; it does not
   direct it.
2. **Voting influences priorities but does not determine them.** The board
   surfaces demand; the operator still owns sequencing.
3. **The public roadmap is informational, not contractual.** A listed item is a
   direction, never a promise.
4. **Internal governance remains the system of record.** Work Packets,
   Execution Checklists, [DECISIONS.md](../docs/ai/DECISIONS.md), and git history
   are authoritative; the public board is a projection of them.
5. **Every public item eventually receives a terminal outcome** — Shipped, or
   Declined with a reason. Nothing is left to rot in limbo.
6. **Trust is maintained through transparency, not through promising
   everything.** Saying "no, because…" builds more trust than a roadmap that
   never says no.

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

The specific vendors in the table above are a point-in-time survey and will age;
the durable filter is the criteria, not the names. Whatever board is adopted
should:

- **Export all its data on demand** — no hostage situation at migration time.
- **Support identity-gated voting** — one real account, one vote.
- **Expose public status** — Planned / In progress / Shipped, visibly.
- **Avoid mandatory lock-in** — no proprietary format we can't leave.
- **Allow eventual migration to a self-hosted surface** — buying is a runway to
  owning, not a destination.

### Reviews — a parallel track (not a numbered stage)

Reviews sit **outside** the numbered enhancement pipeline. They are not backlog
items and do not flow into tracking or voting — they are **social proof** and
belong on the marketing surface, not the roadmap board. Options: a
star-rating + prose field
gated behind a real (logged-in, match-having) account to keep them authentic;
app-store and marketplace reviews once distributed there; and curated
testimonials on the homepage. Authenticity is the whole game — a review from an
account that has actually played carries weight; an anonymous one invites
astroturf. This ties directly into the trust posture in
[Legendary Arena — Tribe and Trust](legendary-arena-tribe-and-trust.md): the same
identity fence that filters the community also authenticates a review.

### Stage 2 — Tracking (public status ↔ internal work spine)

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

### Stage 3 — Voting (rank what's most wanted)

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

### Stage 4 — Public visibility (changelog + roadmap)

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

### System of record

The public board is **informative only**. The authoritative record of what was
built, and why, remains the internal spine — Work Packets, Execution Checklists,
[DECISIONS.md](../docs/ai/DECISIONS.md), git history, and the private
[Dashboard](dashboard.md) views. Where the public board and the internal records
disagree, the internal records win. The roadmap is a **projection of the work,
not the work itself**. This is not a new authority — it restates the existing
model, where the Dashboard `/pipeline` is the private source of truth and the
public surface is a curated view of it — stated plainly so a public board can
never quietly become the thing engineering is steered by.

### Surfaces and authority

A feedback system spans three surfaces, and the failure mode is letting the
wrong one own a piece of the truth. The split:

| Surface | Role | Writes | Reads |
|---|---|---|---|
| **Public intake + roadmap board** (`www` / `roadmap.`, JS-capable) | Where players submit and vote | Players (identity-gated) | Everyone |
| **`dashboard.legendary-arena.com`** ([Dashboard](dashboard.md)) | Operator triage: review the queue, assign status, move items to terminal states, watch vote trends | Operator only | Operator only |
| **WP / EC / [DECISIONS.md](../docs/ai/DECISIONS.md) / git** | The build record — what actually shipped | The engineering loop | — |

The authority rule in one line: **players author demand; the operator authors
status; the codebase authors "done."** Each surface owns exactly one thing and
is a viewer of the rest:

- **Raw feedback and vote counts** are owned by the intake store (Postgres) —
  the public board writes into it, the dashboard reads and annotates it. Neither
  surface "owns" a vote count; the database does.
- **Status** (Planned / In progress / Shipped / Declined) is an editorial
  judgment, so exactly one surface may set it: the **dashboard**. The public
  board only *displays* status; players never set it.
- **"Shipped"** still derives from the WP/git spine — it flips when the Work
  Packet merges to `main` ([Development Workflow](development-workflow.md)); the
  dashboard *reflects* that rather than declaring it.

This keeps a brigaded vote or a stray dashboard edit from ever becoming the
thing engineering is steered by — it is the *Surfaces* corollary of the *System
of record* rule above.

**No role tiers.** This proposal keeps the dashboard a **single Hanko +
Cloudflare Access gate**, exactly as it is today — the operator is the only
writer, and there is no community-moderator tier that can triage without full
access. A tiered-trust moderation model is out of scope here: if queue volume
ever justifies delegated triage, that is a separate change to the dashboard auth
model, raised then — not assumed now.

### Operational ownership

A feedback board is a **standing commitment, not a launch-and-forget feature** —
community systems die from neglected queues, and an abandoned board advertises
inattention louder than no board at all. The proposal therefore treats a **named
operator as a launch precondition**: without someone accountable for the queue,
the board should not go live. The minimum recurring duties:

- **Weekly** — review new feedback; acknowledge bugs.
- **Monthly** — sweep stale items; move every one to a terminal state; publish
  the recap post.
- **Quarterly** — refresh the roadmap themes.

The point is not bureaucracy — it is that the maintenance cost is the real cost
of the system, and it must be owned before it is launched.

### Cadence — monthly vs quarterly (the recommendation)

The recommendation is direct: **run a two-tier cadence — quarterly themes over a
monthly changelog.**

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
delivered, with dates" shape requested. The quarterly theme sits above it as the
"why these, in this order" framing.

### Success metrics

Without a definition of "working," a feedback system drifts into decoration. The
proposed system is succeeding when:

- **Every feedback item carries a status** — nothing is silently swallowed.
- **No item sits in "Under review" past one monthly cycle** — the queue is
  actually triaged, not just collected.
- **Every shipped roadmap item appears in the changelog** — the forward and
  backward views reconcile.
- **Monthly recaps ship consistently** — the heartbeat doesn't skip.
- **A player can see their request accepted, declined, or completed** — the loop
  visibly closes for the person who opened it.

The goal is **visibility and trust — not democratic control of development
priorities.** A board that hits these metrics is doing its job even when it tells
a player "no."

## Interactions

- **[Changelog](changelog.md)** — the existing backward-looking record
  (projected from `docs/09-CHANGELOG.md`). The proposed player-facing changelog
  is a plain-language sibling of this, not a replacement.
- **[Dashboard](dashboard.md)** — the operator's private triage surface (behind
  the existing single Hanko + Cloudflare Access gate): where feedback is reviewed
  and status is assigned. It is the only surface that may set an item's public
  status, and it reflects "Shipped" from the WP/git spine rather than declaring
  it. See *Surfaces and authority* above.
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
- **Who is the named operator?** The *Operational ownership* section makes an
  owner a launch precondition; it does not yet name one or set an SLA. That
  assignment is the open decision.
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
