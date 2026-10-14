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
  - ../docs/ai/REFERENCE/api-endpoints.md
  - ../docs/ai/work-packets/WP-604-feedback-intake-and-voting-api.md
  - ../docs/ai/work-packets/WP-605-feedback-triage-panel.md
  - C:\www\legendary-arena-com\docs\ai\work-packets\WP-043-public-roadmap-board.md (marketing repo)
  - C:\www\legendary-arena-com\docs\ai\work-packets\WP-045-interactive-voting.md (marketing repo)
last-reviewed: 2026-10-14
---

# User Feedback and Public Roadmap

## Summary

*(Draft — partly built.)* This page is the design authority for the player
feedback and public-roadmap system. It covers the three feedback types
(**bug reports, enhancement requests, and reviews**) and the **four-stage
enhancement pipeline: intake → tracking → voting → public visibility**. Reviews
follow a **parallel, marketing-oriented track** and do not participate in
tracking or voting. Six core principles and one authority rule govern every
implementation choice: *players author demand; the operator authors status; the
codebase authors "done."* The public board is informational only. The internal
Work Packet / DECISIONS / git spine remains the system of record.

The build-vs-buy question is settled: **build custom on the existing Postgres +
Hanko + Dashboard stack** ([D-24414](../docs/ai/DECISIONS.md)). As of the
**2026-10-14 audit**, the back end, operator triage, and a live votable board at
[`www.legendary-arena.com/roadmap/`](https://www.legendary-arena.com/roadmap/) have
shipped. Players still have **no submission surface**, so the public board is
empty. The player changelog and monthly recap are also unbuilt. See
*Implementation status* below for the stage-by-stage audit, and *Legendary Arena
today* for a dated snapshot of the game, written in the board's own
Shipped / In progress / Planned shape.

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

> **"Operator" in this document** means the **product owner / governing
> steward** — the person responsible for roadmap curation, feedback triage,
> priority decisions, and public roadmap maintenance. It is *not* an
> infrastructure or system administrator. In the current operating model the
> operator is the product owner.

### Implementation status (audited 2026-10-14)

The audit compared each stage of this design against the engine repo, the
marketing repo, and the live endpoints. The back end and both ends of the
authority split are in place. The pipeline still has no front door.

| Stage / surface | State | Where it lives | Evidence |
|---|---|---|---|
| **Decision: build vs buy** | ✅ Decided — build custom | Postgres + Hanko + Dashboard | D-24414 (Active 2026-08-25) |
| **Intake store** (`feedback_item`, `feedback_vote`) | ✅ Shipped | `legendary.*` schema, `apps/server/src/feedback/` | WP-604 / EC-639 (#1642) |
| **Intake API** — `POST /api/feedback` (bug / enhancement / review) | ✅ Shipped | `api.legendary-arena.com` | WP-604; [API catalog](../docs/ai/REFERENCE/api-endpoints.md) |
| **Player submission UI** (in-app widget or `www` form) | ❌ **Not built** | — | No client calls `POST /api/feedback` (arena-client, dashboard, registry-viewer, and `www` all checked) |
| **Tracking: operator triage** — status + Declined reason | ✅ Shipped | `dashboard.legendary-arena.com/feedback` | WP-605 / EC-640, D-24416 (dashboard is the **sole** status writer) |
| **Voting** — one account, one vote, unweighted | ✅ Shipped | `POST`/`DELETE /api/feedback/:id/vote` + the `www` board | WP-604 (API), marketing WP-045 (UI, 2026-08-26) |
| **Public roadmap board** — Planned / In progress / Shipped | ✅ Live, **but empty** | [`www.legendary-arena.com/roadmap/`](https://www.legendary-arena.com/roadmap/) | Marketing WP-043 (2026-08-25). `GET /api/feedback` returned `{"items":[]}` on 2026-10-14 |
| **"Shipped" derived from the WP/git spine** | ❌ Not built | — | The operator sets Shipped by hand in triage today |
| **Player-facing changelog** | ❌ Not built | — | No changelog page on `www`. The engineering [Changelog](changelog.md) has no dated entry after 2026-09-10 |
| **Monthly recap post** | ❌ Not started | — | No recap posts on the `www` blog since the board launched |
| **Reviews track** (rating + prose, social proof) | 🟡 Intake only | `feedback_type = 'review'` rows | No display surface. Reviews never reach the public `GET` |
| **Named operator + cadence** (Operational ownership) | ❌ Open | — | No owner or SLA recorded |

**What this means.** Every write path that a player would use exists only as
an API. An empty board at a public URL is a mild form of the *feedback
graveyard* (see Edge Cases): it says "nobody has asked for anything," which is
not true. The next build step with the most leverage is a **submission
surface**, followed by seeding the board from the snapshot below. Neither step
needs a new decision. Both sit inside D-24414.

### Legendary Arena today (snapshot, 2026-10-14)

This is a dated snapshot of the game, written in the board's own
Shipped / In progress / Planned shape. It has two jobs. It is the current-state
record for this page, and it is **candidate seed content** for the empty
`/roadmap/` board. The *Theme* and *What it means for players* columns are
written to be posted as they stand. The *Internal refs* column stays internal,
because WP/D numbers never reach players (see Stage 2). This snapshot does not
refresh itself: it is accurate as of the date in its heading, and the
authoritative record remains [WORK_INDEX.md](../docs/ai/work-packets/WORK_INDEX.md).

**At a glance.**

- **Cards:** 41 card sets in the registry.
- **Work Packets:** about 780 complete and about two dozen open.
- **Modes:** multiplayer, solo with a bot ally (since 2026-07), and guest
  seats with no account required (production-verified 2026-09-29), all on
  `play.legendary-arena.com`.
- **Hosting:**
  - Game server and Postgres on a DigitalOcean droplet since 2026-10-12
    (D-24707). Deploys run only after CI passes (D-24708).
  - ewiki and dashboard on Cloudflare Workers behind Access (D-24690).
- **Commerce:**
  - Stripe checkout, webhook, and entitlement plumbing exist on the server,
    and the Legendary Pass entitlement gates the AI Coach.
  - **No in-app purchase button calls checkout yet.** The "Get the Legendary
    Pass" link goes to the profile page.

**Shipped (2026-08-25 → 2026-10-14).**

| Theme | What it means for players | Internal refs |
|---|---|---|
| Play without an account | Join a friend's table as a guest, or tap "Enter Arena" and play a solo featured table without signing up | WP-627–631, WP-785–788; D-24441, D-24633–24636 |
| Cards play as printed | Dozens more hero keywords, Mastermind tactics, schemes, Master Strikes, and escape rules now follow the rulebook (Transform, Smash, Undercover, Phasing, split cards, and more). A rulings test suite guards them | WP-653–703, 724–748, 757–767, 772–783, 789–803; WP-704 / D-24524 |
| The Final Blow | The rulebook's optional fifth fight against the Mastermind is playable, with bigger tactic-hit and victory moments | WP-686, 687, 690; D-24504, D-24507 |
| A better board | Playmat skins (including licensed mats), a day/night theme, a no-scroll 1280×720 board, slash-to-fight (touch included), and a phone layout that fits | WP-666, 688, 699, 755, 756, 761, 766; D-24505 |
| Teamwork recognized | Team-contribution scores, shared and Vanguard badges, a synergy report card, and AI-coach tips on casual matches too | WP-612–623, 708–720, 751, 752; D-24427 |
| Fairer competition | Each gauntlet leg uses its own scheme's hero count; hero and henchman counts follow each scheme; a random player goes first | WP-796, 798–800, 805; D-24671, 24672, 24675, 24700 |
| Plan together, share the result | A shared three-phase battle plan per match, richer match-result exports, loadout share links, and a copyable game log | WP-635–641, 698, 707; D-24517 |
| Game feel | New visual and sound beats for shield blocks, wounds, Transform, reshuffles, and Excessive Violence | WP-642, 644–650, 672, 746 |
| Faster, cheaper, safer hosting | The game moved off Render to a self-hosted server, cutting hosting cost to about a sixth of what it was, and nothing deploys until tests pass | D-24707, D-24708 |

**In progress (drafted, not yet executed).**

| Theme | What it means for players | Internal refs |
|---|---|---|
| Replays you can keep | A downloadable replay of any finished match that re-plays exactly. Finished matches stay viewable after the server clears them | WP-808, 810 (blocked on 808), 811; D-24714, 24716, 24719 |
| Unguessable shuffles | Match seeds are generated on the server and never sent to clients, so nobody can predict the deck | WP-809; D-24715 |
| Clearer turns | Bot-ally pacing, a YOUR TURN banner and sound, "you can afford this" cues, and a superpower-ready glow on hand cards | WP-773–776 |
| More cards as printed | Midnight Massacre, Indestructible Man, Killmonger, Zarathos/Haunt, Lightshow, Soaring Flight, Critical Hit counts, and 17 conditional heroes | WP-741, 745, 758, 759, 764, 768–771, 781, 782, 784 |
| Honest result labels | The Hall of Legends explains a missing result (a tie or an unknown outcome) instead of leaving it blank | WP-812 (reserved); D-24720 |

**Planned (known gaps and named follow-ons; no WP drafted yet — operator to
confirm before any of these is posted as Planned).**

| Theme | What it means for players |
|---|---|
| Tell us what you think | An in-game "Send feedback" control, so requests reach this board (this page's Stage 1) |
| What's new, in plain words | A player-facing changelog and a monthly recap post (Stage 4) |
| Buy the Legendary Pass in-app | A purchase button wired to the existing Stripe checkout |
| Your profile, your history | Gauntlet progress on player profiles, and a rescore of historical competitive results under the current rules |

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

> **Decided (D-24414, 2026-08-25).** Build custom on Postgres + Hanko +
> Dashboard for all three types. Fider and the SaaS boards were not adopted.
> The store and API shipped in WP-604. The survey and recommendation below are
> kept as the record of why.

**Recommendation (as proposed).** Route **bug reports** into a small custom intake backed by
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
- **Unweighted to start (governance-gated).** This proposal recommends
  **unweighted** voting initially — one account, one vote — because it is the
  trust-preserving default. Votes *could* later be weighted by engagement
  (matches played) or by paid tier (a [Legendary Pass](monetization-model.md)
  holder's vote counting for more), but any such weighting **requires its own
  decision record**: it alters the trust model of the roadmap system and
  intersects the [Vision](vision.md) fairness bright lines, so it must not be
  introduced as an implementation detail. Revisit only if raw counts get gamed
  or if weighting becomes a deliberate, separately-decided Pass benefit.
- **Sort by demand, show the tail.** Default the board to most-voted, but keep
  newer and "planned" items reachable so the board doesn't ossify around its
  first popular entries.

*As built:* voting shipped exactly this way. It is one account, one unweighted
vote, enforced by a `UNIQUE (feedback_item_id, account_ext_id)` constraint.
It is upvote-only and idempotent: casting a vote or retracting it twice is a
no-op. The tally is a `COUNT`, never a stored field. The board sorts
most-voted first, then newest.

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

**Built (2026-08-25/26).** The roadmap board lives at
[`www.legendary-arena.com/roadmap/`](https://www.legendary-arena.com/roadmap/)
(marketing WP-043), not on a `roadmap.` subdomain. It is a read-only client-side
projection of the guest `GET /api/feedback`, with Planned / In progress /
Shipped columns. Signed-in visitors vote through the same Hanko bearer token the
`www` header uses (marketing WP-045). On API failure the page shows a
full-sentence error rather than a stale board. It hardcodes no roadmap content,
so it shows exactly what the operator has triaged, and today that is nothing.
Sub-surfaces 2 and 3 (the player changelog and the monthly recap) are not
built.

### The feedback item (as built)

All four surfaces (intake form, roadmap board, dashboard triage, and the
changelog projection) derive from one underlying record. WP-604 locked it as
two `legendary.*` tables. The canonical definitions are the migrations
`data/migrations/042_create_feedback_item.sql` and `043_create_feedback_vote.sql`, plus
`apps/server/src/feedback/feedback.types.ts`. The summary below is for
orientation only. (The tables are not yet listed in
[00.2-data-requirements](../docs/ai/REFERENCE/00.2-data-requirements.md).)

```
legendary.feedback_item
  id                 unique identifier
  feedback_type      bug | enhancement | review
  title              short summary (≤ 200 chars)
  description        body text (≤ 5000 chars; may hold PII — see Edge Cases)
  author_ext_id      the submitting account (from the session, never the body)
  status             under_review (default) | planned | in_progress | shipped | declined
  resolution_reason  required when status = declined; the "no, because…"
  created_at         submission time
  updated_at         last status/edit time

legendary.feedback_vote
  feedback_item_id + account_ext_id   UNIQUE — one vote per account per item
```

There is **no stored vote count**. `voteCount` is a `COUNT` projection over
`feedback_vote` at read time. Only the **operator** writes `status` and
`resolution_reason`, through `PATCH /api/dash/feedback/:id/status` (D-24416).
Only **players** write votes. That is the *Surfaces and authority* split in
data terms.

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
| **Public intake + roadmap board** (`www.legendary-arena.com/roadmap/`, JS-capable) | Where players submit and vote. *Board and voting are live; submission is not built yet.* | Players (identity-gated) | Everyone |
| **`dashboard.legendary-arena.com/feedback`** ([Dashboard](dashboard.md)) | Operator triage: review the queue, assign status, move items to terminal states, watch vote trends. *Live (WP-605).* | Operator only | Operator only |
| **WP / EC / [DECISIONS.md](../docs/ai/DECISIONS.md) / git** | The build record — what actually shipped | The engineering loop | — |

The authority rule, in one line:

> **Authority rule.** Players author demand. The operator authors status. The
> codebase authors "done."

Each surface owns exactly one thing and is a viewer of the rest:

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
- **Every "Planned" item is promoted to Shipped or moved to Declined within a
  documented review cycle** — *Planned is not a permanent parking lot.* This is
  the specific failure a public roadmap is most prone to: two-year-old "Planned"
  items that quietly became "never."
- **Monthly recaps ship consistently** — the heartbeat doesn't skip.
- **A player can see their request accepted, declined, or completed** — the loop
  visibly closes for the person who opened it.

The goal is to improve **visibility, trust, and prioritization signal** — it is
**not** a mechanism for transferring product authority from the operator to the
crowd. A board that hits these metrics is doing its job even when it tells a
player "no."

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
- **[Seed Challenges](seed-challenges.md)** — an example of a feature that went
  from proposal to shipped (WP-422) with no public board to show the journey.
  This is the kind of arc the board exists to make visible.
- **`www.legendary-arena.com/roadmap/`** (marketing repo, WP-043 + WP-045) is the
  live public board and vote surface. It reads the guest `GET /api/feedback` and
  writes votes with the visitor's Hanko token. Its layout is
  `layouts/roadmap/list.html` and its script is `assets/js/roadmap.js`.
- **[API catalog](../docs/ai/REFERENCE/api-endpoints.md)** — the authoritative
  rows for `/api/feedback`, `/api/feedback/:id/vote`, and `/api/dash/feedback`
  (request/response shapes, auth class, status-code domains).

## Edge Cases

- **The feedback graveyard.** A board where nothing ever changes status is worse
  than no board — it advertises inattention. Every item needs a terminal state
  (Shipped or Declined-with-reason); a monthly triage that touches every stale
  "Under review" item is the maintenance cost of running this at all.
- **The empty board (observed 2026-10-14).** This is the graveyard's quieter
  twin. The board went live on 2026-08-25. Seven weeks later it still shows
  "The roadmap is empty for now," because players have no way to submit and
  the operator has not posted any items. A shipped surface with no content
  reads as abandoned, just as an untriaged one does. The fix is operational, not
  architectural: seed it, then open intake.
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

*Resolved since the 2026-08-25 draft:* build-vs-buy → **build custom**
(D-24414). Where the board renders → **`www.legendary-arena.com/roadmap/`**
(marketing WP-043). Who may set status → **the dashboard only** (D-24416).

- **Where players submit.** Options: an in-app "Send feedback" control in the
  play client (which can attach a [Play Diagnostics](play-diagnostics.md)
  payload to a bug), a form on `www/roadmap/`, or both. The API already accepts
  all three types. This is the missing front door and the next WP to draft.
- **Seeding the board.** The operator can post enhancement items through
  `POST /api/feedback` from their own account and then move them to Planned or
  In progress in triage. Decide whether to seed from the *Legendary Arena
  today* snapshot below. A dashboard "create item" action would make this a
  one-step job; it does not exist yet.
- **Player-facing changelog authoring** — hand-written plain-language sibling, or
  a filtered auto-projection of `docs/09-CHANGELOG.md`? The former reads better;
  the latter can't drift. Either way the engineering changelog has to be kept
  current first. It has no dated entry after 2026-09-10.
- **Auto-derived "Shipped."** Today the operator sets Shipped by hand. Linking
  a feedback item to the WP(s) that delivered it, so Shipped flips on merge, is
  still unbuilt and still unspecified.
- **Vote weighting** — start unweighted; revisit only if raw counts get gamed or
  if weighting becomes a deliberate Legendary Pass perk (a Vision-fairness
  question, not just an engineering one).
- **Who is the named operator?** The *Operational ownership* section makes an
  owner a launch precondition; it does not yet name one or set an SLA. That
  assignment is the open decision.
- **Remaining follow-ons, each citing D-24414:** player submission surface,
  player changelog, monthly recap, auto-derived Shipped, and the reviews display
  surface. None has a WP reserved as of 2026-10-14.

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
  board projects. D-24414 (build custom) and D-24416 (dashboard is the sole
  status writer) are the two decisions this page's design produced.
- [WP-604](../docs/ai/work-packets/WP-604-feedback-intake-and-voting-api.md)
  (intake + voting API) and
  [WP-605](../docs/ai/work-packets/WP-605-feedback-triage-panel.md) (operator
  triage) — the shipped engine-side packets.
- Marketing repo `docs/ai/work-packets/WP-043-public-roadmap-board.md` and
  `WP-045-interactive-voting.md` — the shipped `www` board and voting UI.
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
