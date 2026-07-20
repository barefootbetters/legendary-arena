---
title: Vision
type: Guide
tags:
  - governance
  - vision
  - monetization
  - scoring
  - designer-reference
related:
  - monetization-model.md
  - scoring.md
  - par-simulation-calibration.md
  - leaderboard.md
  - profile-login.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\vision.md (this page — https://ewiki.legendary-arena.com/vision/)
  - ../docs/01-VISION.md
  - ../docs/12-SCORING-REFERENCE.md
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-07-19
---

# Vision

## Summary

A reader's map of [`docs/01-VISION.md`](../docs/01-VISION.md) — the
document that defines what Legendary Arena *is*, how it is currently
built, how it will never make money, and how it will. This page
summarizes and links; the vision document itself is authoritative and
sits at tier 3 of the authority hierarchy, above `.claude/rules/*.md`
and every Work Packet.

> **Editing this page**
>
> This ewiki page mirrors `docs/01-VISION.md` in this same repo.
>
> - **To edit the vision:** edit `docs/01-VISION.md`. Vision-tier edits
>   are authority-doc edits — present the change for explicit approval
>   before writing, per the authority hierarchy in
>   [`.claude/CLAUDE.md`](../.claude/CLAUDE.md).
> - **To edit this page:** edit `wiki/vision.md`, commit with a `SPEC:`
>   prefix, push to `main`.
> - **Keep both in sync.** If the vision changes, update this page in
>   the same cycle. Where the two disagree, the vision wins and this
>   page is wrong.

**Audience:** contributors, reviewers, operators, and designers who
need the vision's shape without reading all 918 lines of it. Players
are served by the public game documentation, not this page.

## Mechanics

### Vision at a glance

- **Purpose** — become the definitive digital home for *Marvel
  Legendary*: exact rules, real card content, verifiable fairness.
- **Primary goals (never change)** — Rules Authenticity · Content
  Authenticity · Player Trust & Fairness · Faithful Multiplayer ·
  Longevity & Expandability.
- **Business rule** — no sales, no business. Revenue funds payroll,
  Upper Deck and Marvel royalties, infrastructure, and the next round
  of content. *No margin, no mission.*
- **Permanent monetization boundaries** — no pay-to-win, no gacha or
  loot boxes, no paid balance advantage, no friction monetization, no
  ads inside the gameplay frame, no dark patterns, no social-influence
  mechanics. Everything outside those lines is open commercial space.
- **Competitive philosophy** — measure how *well* a game was played,
  not how long or how often. Every ranking input is replay-verified
  and quality-normalized.
- **Authority chain** — [`.claude/CLAUDE.md`](../.claude/CLAUDE.md) →
  [`ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) →
  [`01-VISION.md`](../docs/01-VISION.md) → `.claude/rules/*.md` →
  `WORK_INDEX.md` → individual Work Packets. Note that architecture
  outranks the vision: the vision says what the game *is*, not how the
  layers are drawn.

### What changes, and what does not

Change rate is not authority — `ARCHITECTURE.md` outranks the vision
and still changes far more often than it does. This table is about
churn, and about where a contributor is free to innovate.

| Layer | Expected change rate | Gate on changing it |
|---|---|---|
| Primary goals (1–5) | Effectively never | Violating one is a hard failure of vision, not a tradeoff |
| Non-goals (NG-1…NG-8) | Rare | Stated as permanent; "the answer is no" |
| Financial sustainability | Occasional | Open commercial space by design — packaging and pricing may evolve |
| Secondary goals (6–19b) | Moderate | Deviation allowed when intentional and recorded in [DECISIONS.md](../docs/ai/DECISIONS.md) |
| Architecture | Frequent | Tier-2 authority; changes via ARCHITECTURE.md + a D-entry |
| Work packets | Constant | The execution spine; churns by design |

### The frame: business survival first

The vision opens with **Business Survival (Sales & Product)**. Every
downstream goal — rules authenticity, content fidelity, multiplayer
reliability, fairness, longevity — exists in service of two truths:
revenue funds payroll, Upper Deck and Marvel royalties, cloud and R2
bills, and the next round of content; and a product worth buying is
what produces that revenue. "No sales = no business, no game, no
royalties" (VISION §Business Survival).

This ordering matters when reading the rest of the document: the
engineering discipline is instrumental, not decorative.

### Primary goals (non-negotiable, 1–5)

Violating any of these is a **hard failure of vision**, not a tradeoff.

| # | Goal | What it locks |
|---|---|---|
| 1 | **Rules Authenticity** | Exact *Marvel Legendary* rules — no simplifications, digital-only shortcuts, or reinterpretation; official errata included |
| 2 | **Content Authenticity** | Same card images, names, text, and semantics as the physical cards; presentation never alters rules meaning |
| 3 | **Player Trust & Fairness** | No hidden modifiers or manipulated randomness; seeded, reproducible RNG; inspectable state transitions; the engine never makes strategic decisions for players |
| 4 | **Faithful Multiplayer** | Tabletop cooperative experience preserved; correctness prioritized over convenience; reliable sync, reconnect, late-join |
| 5 | **Longevity & Expandability** | Years of expansions without rewrites; new content is data, not structural change |

Goal 5 is the reason [Content as Data](#secondary-goals-directional-6-19b)
and the registry layer exist: gameplay themes are added as validated
JSON with no engine edits (VISION §10, WP-055).

### Secondary goals (directional, 6–19b) {#secondary-goals-directional-6-19b}

Deviation is permitted only when intentional, documented in
[DECISIONS.md](../docs/ai/DECISIONS.md), and non-violating of any
primary goal.

- **Architecture & platform (6–8)** — Vue 3 SPA; strict layer
  separation (engine / server / client / registry) enforced by
  [ARCHITECTURE.md §Layer Boundary](../docs/ai/ARCHITECTURE.md#layer-boundary-authoritative);
  a deterministic, UI-agnostic engine suitable for replay and
  validation.
- **§7a Identity Boundary** — authentication ≠ identity ≠ progression.
  External providers (Hanko) verify *access*; identity, rank, badges,
  and competitive history are owned and computed by Legendary Arena and
  survive a provider swap. See [Profile Login](profile-login.md).
- **Content & assets (9–10a)** — R2-hosted static assets referenced by
  stable URL, never bundled; cards, sets, and keywords as data;
  the Registry Viewer (`cards.legendary-arena.com`) as public browser
  and living smoke test of the data pipeline.
- **Operations (11–12)** — stateless client reflecting authoritative
  state; local state disposable and recoverable; no single-machine or
  session-bound assumptions.
- **Development & governance (13–15)** — Execution-Checklist-driven
  work; bugs treated as execution-contract violations; explicit
  decisions with no silent drift; a codebase approachable without
  tribal knowledge.
- **Player experience (16–19b)** — performance as a correctness
  concern; accessibility that never confers advantage; replay and
  spectation as first-class; machine-readable exports for *external*,
  player-initiated LLM analysis (no in-game AI assistance).
- **§19a Profiles are reflective, not authoritative** — decorative
  fields (handle, bio, avatar, links) are editable; merit-bearing
  surfaces (badges, rank, replay history, competitive submissions) are
  derived from immutable records and are not. Editing a profile cannot
  rewrite history.
- **§19b Loadout library** — saved LAGN loadouts are decorative,
  shareable, user-authored content; never a competitive-submission
  path. See [LAGN v1.0 Specification](lagn-v1.md).

### Skill measurement & competitive benchmarking (20–26)

Skill is measured through replay-verified execution, on a golf-style
two-layer model: **PAR** measures scenario difficulty (Scheme +
Mastermind + Villain Groups + player count — static, not
hero-dependent, not luck-normalized), and **Raw Score** measures how
the players actually did. `Final Score = Raw Score − PAR`; lower is
better, negative is under par.

Three properties carry the weight: scores derive *exclusively* from the
authoritative replay and final state (§22); every leaderboard entry is
re-scorable and tamper-immune, enforced structurally rather than by
moderation (§24); and PAR is simulation-calibrated before heroes are
chosen, then immutable — refinements create new versions, never
retroactive adjustments (§26).

Formulas, weights, and the calibration pipeline live in
[Scoring](scoring.md), [PAR Simulation Calibration](par-simulation-calibration.md),
[Leaderboard](leaderboard.md), and
[12-SCORING-REFERENCE.md](../docs/12-SCORING-REFERENCE.md).

**§23 competitive surfaces** are (a) scenario benchmarking — "who plays
this scenario best with this team?" — and (b) asynchronous comparison
of independently played, replay-verified runs (ladders, year-end
honors). Never real-time PvP: players never share a game state or act
as opponents inside a match.

**§25 skill over repetition** splits into three rules: rankings must
use quality-normalized inputs only (best-N, average PAR delta) and
never raw volume; recognition badges *may* count runs but only behind a
per-run quality floor, distinct-`ScenarioKey` breadth, a real-time
elapsed window, and a no-feed-into-rankings constraint; volume
telemetry is display-only. The clause is explicitly **anti-bot, not
anti-veteran**. All badges carry a verifiable evidence class (D-1004).

The scoring philosophy encodes a moral hierarchy from the source
material: rescuing civilians is the strongest positive action, and a
bystander lost to an escaping villain is penalized more heavily than a
plain escape. The system rewards heroism, not caution.

### Non-goals: exploitative monetization (NG-1 … NG-8)

Permanent bright lines, not "ideas for later":

| ID | Disallowed |
|---|---|
| NG-1 | Pay-to-win or power purchases — money never changes how the game *plays* |
| NG-2 | Gacha, loot boxes, randomized purchases |
| NG-3 | Pay-for-power content — ownership never alters balance |
| NG-4 | Energy systems, timers, pay-to-skip friction |
| NG-5 | Ads or brand insertion *inside the gameplay frame* |
| NG-6 | Dark patterns and psychological exploitation |
| NG-7 | Monetization that requires an apology post to defend |
| NG-8 | Social influence mechanics — followers, likes, karma, trending feeds |

The scope of these is narrow by design. NG-5 governs the gameplay
frame only; event, tournament, leaderboard, and marketing-site
sponsorship is governed by Financial Sustainability. NG-8 permits
outbound profile links — they describe a player without ranking or
amplifying them.

The **Monetization Boundary Summary** pairs those bright lines with an
explicitly **open commercial space**: subscriptions, expansion packs,
cosmetics, enterprise and tournament licensing, out-of-frame
sponsorship, premium tiers, recognition programs, "and any other model
not yet imagined." The enumeration is deliberately open-ended.

### Financial sustainability ("no margin, no mission")

Legendary Arena must be financially self-sustaining from launch. The
named revenue streams are supporter subscriptions (cosmetic and
convenience differentiation), one-time cosmetic purchases, premium
recognition tiers, and enterprise / organized-play licensing. A
non-negotiable portion of every dollar flows to Upper Deck and Marvel
as royalties — framed as a virtuous cycle in which digital revenue
funds better physical sets. Revenue goes first to expenses and
royalties, then to buffer and content; if revenue falls short,
non-essential features are cut **before** rules, fairness,
accessibility, or royalties. See [Monetization Model](monetization-model.md).

**Access model.** The game is played for free, but a free account is
required for multiplayer matchmaking and account-persisted surfaces
(profile, loadout library, stats, leaderboard entry, replay
verification). A guest gets a real first taste — tutorial plus at least
one solo match — without an account. Marketing email requires separate
double opt-in: every account has an email, only opted-in accounts are
marketing contacts (D-24092).

### How the document is used

As a review gate: design review (does this violate a primary goal?),
architecture review (does this bypass a secondary goal?), scoring
review, monetization review, financial review, execution review,
Work-Packet pre-flight, and contributor onboarding.

> Primary goals define what must never change. Secondary goals define
> how we choose to build it today. Non-goals define how we will never
> make money. Financial sustainability defines how we will.

## Interactions

- **[Monetization Model](monetization-model.md)** — expands the
  Financial Sustainability section into the four revenue streams and
  the profile free/paid boundary; cites VISION and defines nothing.
- **[Scoring](scoring.md)** and
  **[PAR Simulation Calibration](par-simulation-calibration.md)** —
  the implementation of §20–§26; `ParBaseline` (Layer A) and
  `FinalScore` (Layer B).
- **[Leaderboard](leaderboard.md)** — the §23/§24/§25(a) surface:
  quality-normalized, replay-verified, `ScenarioKey`-keyed.
- **[Profile Login](profile-login.md)** — the §7a identity boundary in
  practice: Hanko verifies access, Legendary Arena owns identity.
- **[ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md)** — outranks this
  vision on architectural questions (tier 2 vs tier 3); the vision
  outranks `.claude/rules/*.md` and all Work Packets.
- **[DECISIONS.md](../docs/ai/DECISIONS.md)** — where every sanctioned
  deviation from a secondary goal is recorded; D-0005 (§23b), D-0006
  (§25b), D-1004 (badge tiers), D-24092 (access model).

## Edge Cases

The common misreadings, in the order they cause damage:

- **This page is not the vision.** It compresses 918 lines into a map.
  Any decision, review, or Work-Packet gate reads
  [`docs/01-VISION.md`](../docs/01-VISION.md) itself — summaries drop
  the qualifying clauses that usually decide the question.
- **Non-goals are narrower than they look.** NG-5 bans ads *in the
  gameplay frame*, not sponsorship generally; NG-8 bans amplification
  mechanics, not outbound links; NG-1 bans mechanical advantage, not
  paid content. Reading one wider than written forecloses revenue the
  vision deliberately leaves open.
- **The commercial space is open-ended.** The revenue list is
  illustrative — the Monetization Boundary Summary says "any other
  model not yet imagined" in terms. Treating it as a closed set is
  anti-commercial drift.
- **§25 targets farming, not mastery.** The "how long or how often"
  language is anti-bot; sustained high-quality play across distinct
  scenarios is exactly what recognition rewards.
- **Vision-tier edits need explicit approval**, and counts in either
  document are point-in-time observations rather than targets — §8's
  test figure carries its own as-of date.

## References

- [docs/01-VISION.md](../docs/01-VISION.md) — the authoritative vision
  document this page summarizes
- [docs/12-SCORING-REFERENCE.md](../docs/12-SCORING-REFERENCE.md) —
  full PAR derivation, weights, worked examples
- [docs/ai/ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — tier-2
  authority; layer boundaries and persistence rules
- [docs/ai/DECISIONS.md](../docs/ai/DECISIONS.md) — D-0005, D-0006,
  D-1004, D-24092
- [.claude/CLAUDE.md](../.claude/CLAUDE.md) — operating posture and the
  authority hierarchy
- [Monetization Model](monetization-model.md),
  [Scoring](scoring.md),
  [PAR Simulation Calibration](par-simulation-calibration.md),
  [Leaderboard](leaderboard.md),
  [Profile Login](profile-login.md),
  [LAGN v1.0 Specification](lagn-v1.md)
