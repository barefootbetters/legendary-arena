---
title: Leaderboard
type: System
tags:
  - leaderboard
  - scoring
  - par
  - vision
  - persistence
  - layer-server
related:
  - scoring.md
  - par-simulation-calibration.md
  - scheme.md
  - scheme-twist.md
  - card-type-taxonomy.md
  - profile-login.md
status: draft
source:
  - ../apps/legends-board/package.json
  - ../docs/ai/work-packets/WP-142-legends-snapshot-publisher.md
  - ../docs/ai/work-packets/WP-143-legends-attract-board.md
  - ../docs/ai/execution-checklists/EC-164-legends-attract-board.checklist.md
  - ../docs/02-ARCHITECTURE.md
  - ../docs/12-SCORING-REFERENCE.md
  - ../docs/01-VISION.md
  - ../packages/game-engine/src/scoring/parScoring.keys.ts
last-reviewed: 2026-07-08
---

# Leaderboard

## Summary

The public leaderboard is the **Legends Attract Board** ("Hall of
Legends") — a read-only Vue 3 + Vite single-page app in
[`apps/legends-board`](../apps/legends-board/package.json), designed to
render at **`https://legends.legendary-arena.com`** (Cloudflare Pages). It
displays scenario rankings computed by the engine's two-layer PAR
[Scoring](scoring.md) system, reading pre-computed JSON snapshots from R2
with zero server API calls and zero authentication. The board app is built
and merged (WP-143, 2026-05-15) but its custom domain is **not yet
provisioned** — see [Edge Cases](#edge-cases). The multi-tier *annual
championship* structure (overall champion, per-mastermind championships,
skill tiers, yearly archive) is a **proposal**, not a landed design — it
lives in [Open Questions](#open-questions) until ratified.

## Mechanics

### Where it lives

| Concern | Location |
|---|---|
| Public leaderboard app | [`apps/legends-board`](../apps/legends-board/package.json) — Vue 3 + Vite SPA |
| Intended public URL | `https://legends.legendary-arena.com` (Cloudflare Pages) |
| Snapshot publisher | WP-142 — writes ranking JSON to R2 under `legends/v1/*` |
| Scoring math (the numbers shown) | [`docs/12-SCORING-REFERENCE.md`](../docs/12-SCORING-REFERENCE.md) + [Scoring](scoring.md) |
| PAR calibration (how a scenario's baseline is set) | [PAR Simulation Calibration](par-simulation-calibration.md) |

The board is **one of three related surfaces** people conflate:

- **`apps/legends-board`** — the running product (this page's subject).
- **[`docs/12-SCORING-REFERENCE.md`](../docs/12-SCORING-REFERENCE.md)** —
  the *scoring model* that produces the ranked numbers. It is the spec
  behind the ranking, not the ranking.
- **`ewiki.legendary-arena.com/par-simulation-calibration/`** — the
  public/engineering explainer for PAR calibration
  ([PAR Simulation Calibration](par-simulation-calibration.md)). Reference
  content, not the board and not the authoritative math.

The chain is: **scoring model defines the math → PAR calibration derives
each scenario's baseline → the attract board renders the resulting
rankings.**

### Data flow (zero-API, snapshot-driven)

Per WP-143 / [EC-164](../docs/ai/execution-checklists/EC-164-legends-attract-board.checklist.md),
the board reads pre-computed snapshots directly from R2 (`legends/v1/*`)
and renders them client-side. It performs no server calls, holds no auth,
and writes no cookies or `localStorage`. This keeps the public surface
cheap to host (static CDN) and impossible to use as a write path into game
state — it is a projection of already-published results, never a source of
truth.

Panels shipped in the board: **overall**, **weekly**, **by-scheme**,
**recent-achievements**, and **now-playing**. Kiosk mode (`?kiosk=1`)
drives big-screen / stream displays, cycling panels on a timer; a
freshness badge degrades visually once a snapshot passes a staleness
threshold, and a fetch failure renders a visible error panel rather than a
blank page.

### What identifies a ranking row

The engine already emits a canonical per-scenario identity, built by
`buildScenarioKey` in
[`parScoring.keys.ts`](../packages/game-engine/src/scoring/parScoring.keys.ts):

```
ScenarioKey = "{schemeSlug}::{mastermindSlug}::{sorted-villainGroupSlugs-joined-by-+}"
TeamKey     = "{sorted-heroSlugs-joined-by-+}"
```

`ScenarioKey` **is** the natural key for a single leaderboard board: one
board per (scheme × mastermind × villain groups). `TeamKey` identifies the
hero loadout that posted the score. Every leaderboard entry also carries a
`scoringConfigVersion` pin and a `replayHash`, so rows are only ever
compared against peers computed under the same scoring config, and every
row is reproducible by re-running its replay (VISION §24). See
[Scoring](scoring.md) for the full entry shape.

This matters for the championship proposal below: any higher-tier
championship (per-mastermind, overall, annual) is a **derived aggregation
over existing `ScenarioKey` rows** — no new engine identity needs to be
invented.

## Interactions

- **[Scoring](scoring.md).** Produces the `ScoreBreakdown` /
  `LeaderboardEntry` records the board displays. Lower `finalScore` is
  better (negative = under PAR). The board never recomputes — it renders
  what the engine already produced.
- **[PAR Simulation Calibration](par-simulation-calibration.md).** Sets
  each scenario's `ParBaseline` (the "course rating"). Without a calibrated
  PAR, a scenario cannot admit leaderboard entries.
- **[Scheme](scheme.md), Mastermind, [Scheme Twist](scheme-twist.md), and
  Villain Groups.** These form the scenario identity that keys every board.
  The championship proposal hinges on how these combine across the game's
  ~40 sets (see [Open Questions](#open-questions)).
- **[Profile Login](profile-login.md).** Score *submission* happens in the
  authenticated arena client (`play.legendary-arena.com`); the public board
  is read-only and anonymous. Player identity on a row comes from the
  submission path, not the board.
- **Persistence.** The board consumes R2 snapshots — derived, published
  records. `G` is never persisted or read by the board (per the
  runtime-only boundary in [Scoring](scoring.md)).

## Edge Cases

- **The public URL is not live yet.** `legends.legendary-arena.com` is
  documented as `state=planned` with DNS unprovisioned; an operational
  health check against it returns `ENOTFOUND`. The board *app* is built and
  merged (WP-143), and [`docs/02-ARCHITECTURE.md`](../docs/02-ARCHITECTURE.md)
  lists the domain as "planned." Treat the URL as the intended address, not
  a browsable page, until the Cloudflare Pages custom domain and DNS are
  attached.
- **The board only shows what the publisher wrote.** With no live
  submission volume feeding WP-142's snapshot publisher, the board renders
  empty/placeholder panels. A blank board is a data-supply state, not a
  board bug.
- **Cross-version comparison is never silent.** Rows carry a
  `scoringConfigVersion`; any PAR or weight change increments it, and rows
  under different versions are not directly comparable (VISION §22). Any
  championship aggregation must filter by version.
- **Scenario keys are slug-sorted before join.** Hand-built keys that skip
  the sort fragment a single scenario into multiple identities. The
  championship aggregation must group over canonical keys only — see
  [Scoring](scoring.md) Edge Cases.

## Open Questions

> **Proposal, not decided.** Everything in this section is a design
> brainstorm for a multi-tier annual championship. The wiki is descriptive
> and does not make design decisions — ratifying any of this requires a
> [DECISIONS.md](../docs/ai/DECISIONS.md) entry and Work Packets. It is
> recorded here so the reasoning isn't lost, not as a spec to build from.

**The combinatorial problem.** The game has ~40 sets; each set packages
multiple masterminds and multiple schemes (with scheme twists). Ranking
every (mastermind × scheme × villain-group) combination separately yields
thousands of near-empty boards. The design question is how to give players
meaningful, findable competition without that fragmentation.

**Proposed tier structure (four tiers):**

| Tier | Board identity | Scoring basis |
|---|---|---|
| 1. Overall annual champion | one board for the year ("2026 Legendary Arena Champion") | aggregate `finalScore` across all scenarios the player has posted (sum, or best-N) |
| 2. Per-mastermind championship | one board per mastermind ("2026 Thanos Champion") | **set-gauntlet** — see below |
| 3. Category champions (optional) | e.g. "best across all Villain masterminds" vs "all Mastermind masterminds" | aggregate over the tier-2 boards in that category |
| 4. Skill tiers | percentile bands within any board | rank within your band, so newcomers don't compete against veterans |

**The recommended consolidation — the "set-gauntlet."** The cleanest way
to collapse the mastermind × scheme explosion (and the approach the
brainstorm converged on): to hold *"2026 Thanos Champion,"* a player must
post a verified score against Thanos across **every scheme twist packaged
in Thanos's set**, and the championship score is the aggregate of those
runs (average or sum). A set with five schemes means five required
scenarios. This yields **one board per mastermind** instead of one per
mastermind×scheme, rewards breadth (master all flavors, not just farm the
easiest scheme), and fits the heroism theme.

**Why this is cheap to build.** A per-mastermind championship is a
**derived view over existing `ScenarioKey` rows** — group all rows whose
`mastermindSlug` matches and whose `schemeSlug` is one of the schemes in
that mastermind's set, require the player to have a row for each, then
aggregate. No new engine identity, no new score type; the engine already
computes the per-scenario rows. The work is a leaderboard-server grouping +
board panels, not an engine change.

**Annual reset.** On Dec 31, archive all active boards as immutable
historical records (the app is literally the "Hall of Legends"); on Jan 1,
open fresh boards for the new year. Archived boards stay browsable as past
championships. VISION §22's immutability of declared PAR baselines already
supports comparing a full year's runs on a stable footing.

**Still open before any of this can be built:**

- Aggregate function per tier — sum vs average vs best-N — and how partial
  gauntlets (some but not all schemes posted) display (provisional? hidden?).
- Whether "set" membership for the gauntlet is defined by the registry's
  set grouping or an explicit championship manifest.
- Category-tier definitions (tier 3) — which masterminds count as "Villain
  masterminds" vs "Mastermind masterminds," and whether tier 3 ships at all.
- Skill-tier banding method (fixed percentiles vs dynamic) and how it
  interacts with low-population boards.
- Data model for active vs archived boards, and the reset job that performs
  the Dec 31 → Jan 1 rollover.

## References

- [`apps/legends-board/package.json`](../apps/legends-board/package.json)
  — the board app ("Public Legends Attract Board — read-only scoreboard SPA
  for legends.legendary-arena.com")
- [WP-142](../docs/ai/work-packets/WP-142-legends-snapshot-publisher.md) —
  Legends snapshot publisher (writes ranking JSON to R2 `legends/v1/*`)
- [WP-143](../docs/ai/work-packets/WP-143-legends-attract-board.md) +
  [EC-164](../docs/ai/execution-checklists/EC-164-legends-attract-board.checklist.md)
  — the attract board SPA (Vue 3 + Vite, Cloudflare Pages, kiosk mode,
  R2-snapshot-driven, zero-auth)
- [`docs/02-ARCHITECTURE.md`](../docs/02-ARCHITECTURE.md) — domain table
  (`legends.legendary-arena.com` → `apps/legends-board`, status *planned*)
- [`docs/12-SCORING-REFERENCE.md`](../docs/12-SCORING-REFERENCE.md) — the
  scoring formula, weights, caps, PAR derivation, and leaderboard
  tiebreakers (the math behind the numbers)
- [`docs/01-VISION.md`](../docs/01-VISION.md) §20–26 — PAR-based scenario
  scoring, replay-verified competitive integrity, immutability of declared
  baselines
- [`parScoring.keys.ts`](../packages/game-engine/src/scoring/parScoring.keys.ts)
  — `buildScenarioKey` / `buildTeamKey` (the canonical board keys)
- [Scoring](scoring.md), [PAR Simulation Calibration](par-simulation-calibration.md)
  — companion wiki pages for the scoring internals
