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
  - ../docs/ops/domains.json
  - ../render.yaml
  - ../docs/02-ARCHITECTURE.md
  - ../docs/12-SCORING-REFERENCE.md
  - ../docs/01-VISION.md
  - ../packages/game-engine/src/scoring/parScoring.keys.ts
  - ../packages/game-engine/src/scoring/parScoring.logic.ts
  - ../apps/server/src/competition/competition.logic.ts
  - ../apps/server/src/leaderboards/leaderboard.logic.ts
  - ../apps/server/src/legends/legends.publisher.ts
  - ../apps/server/src/profile/profile.routes.ts
  - ../apps/server/src/profile/ownerProfile.routes.ts
  - ../data/migrations/007_create_competitive_scores_table.sql
  - ../docs/ai/DESIGN-RANKING.md
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
and merged (WP-143, 2026-05-15); as of **2026-07-08 it is live** at that URL
— the Cloudflare Pages project, custom domain, and WP-142 snapshot publisher
were all provisioned that day (details under [Edge Cases](#edge-cases)). The
multi-tier *annual
championship* structure (overall champion, per-mastermind championships,
skill tiers, yearly archive) is a **proposal**, not a landed design — it
lives in [Open Questions](#open-questions) until ratified.

## Mechanics

### Where it lives

| Concern | Location |
|---|---|
| Public leaderboard app | [`apps/legends-board`](../apps/legends-board/package.json) — Vue 3 + Vite SPA |
| Public URL (live 2026-07-08) | `https://legends.legendary-arena.com` — Cloudflare Pages project `legendary-arena-legends` |
| Snapshot publisher | WP-142 — writes ranking JSON to R2 under `legends/v1/*` (enabled in production 2026-07-08) |
| R2 snapshot host | `https://images.legendary-arena.com/legends/v1/*` (the `legendary-images` bucket; the board's `VITE_LEGENDS_R2_BASE_URL`) |
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

### From a finished match to a ranked row (the write path)

The board is the *last* stage of a longer pipeline. The **read** direction
(snapshot → board) is fully shipped and wired; the **write** direction (a
played match → a stored score) is only partially wired — the gap is called
out at the end of this section, and it is the real reason the live board is
currently empty.

The intended end-to-end chain, in order:

1. **The engine scores the match — the client never does.** During play the
   engine computes the PAR score deterministically
   ([`parScoring.logic.ts`](../packages/game-engine/src/scoring/parScoring.logic.ts):
   `deriveScoringInputs` → `computeRawScore` → `computeFinalScore` →
   `buildScoreBreakdown`), and the completed match yields a replay whose
   `computeStateHash` is its canonical fingerprint. Lower `finalScore` is
   better (negative = under PAR).

2. **Submission carries only a replay hash.** The submission contract is
   `CompetitiveSubmissionRequest = { replayHash: string }`
   (`apps/server/src/competition/competition.types.ts`) — no score is ever
   sent by the client. The server (`submitCompetitiveScore` →
   `submitCompetitiveScoreImpl`,
   `apps/server/src/competition/competition.logic.ts`) resolves replay
   ownership, loads the canonical replay, **re-executes it** (`replayGame`),
   and rejects the submission unless the recomputed `computeStateHash`
   equals the submitted `replayHash` (`replay_verification_failed`). Only
   then does it recompute the score server-side — it never trusts a
   client-supplied number (D-5301). Guests are rejected
   (`guest_not_eligible`); a scenario whose PAR is unpublished is rejected
   (`par_not_published`).

3. **The row is written to `legendary.competitive_scores`.** One immutable,
   write-once row per `(player_id, replay_hash)` (migration
   `007_create_competitive_scores_table.sql`; immutability per D-5302).
   Columns: `player_id` (bigint FK → `legendary.players`), `replay_hash`,
   `scenario_key`, `raw_score`, `final_score`, `score_breakdown` (jsonb),
   `par_version`, `scoring_config_version`, `state_hash`, `created_at`.
   **There is no handle or team column** — the stored identity is the
   internal `player_id`; a display name is attached later by JOIN. The
   `UNIQUE (player_id, replay_hash)` constraint gives per-replay idempotency
   (a resubmit is a no-op), but there is **no best-score-per-player
   collapsing** — every distinct eligible replay is its own row.

4. **The read layer projects rows to a safe public shape.**
   [`leaderboard.logic.ts`](../apps/server/src/leaderboards/leaderboard.logic.ts)
   (WP-054 / WP-115 / WP-150) SELECTs from `competitive_scores`,
   `INNER JOIN legendary.players` for `display_name`, orders
   `final_score ASC, created_at ASC`, and filters to `link` / `public`
   visibility. It returns `PublicLeaderboardEntry` — a locked 9-field
   projection (`rank`, `replayHash`, `playerDisplayName`, `scenarioKey`,
   `finalScore`, `rawScore`, `parVersion`, `scoringConfigVersion`,
   `createdAt`) with seven sensitive fields stripped at the type boundary
   (D-5201). Shipped, wired endpoints — all public, anonymous, read-only,
   `Cache-Control: no-store`: `GET /api/leaderboards/scenarios`,
   `/scenarios/:scenarioKey`, `/scores/:replayHash`, `/themes/:themeId`,
   `/top`.

5. **The publisher freezes reads into R2 snapshots.** WP-142's publisher
   ([`legends.publisher.ts`](../apps/server/src/legends/legends.publisher.ts))
   calls the *same* read-layer functions (`getGlobalTopLeaderboard`,
   `getScenarioLeaderboard`, `listScenarioKeys`) inside one read-only
   transaction and writes JSON to `legends/v1/*`: a `global-top` board
   (top 500) plus one `scenario-<scenarioKey>` board (top 100) for each
   scenario that has public scores. `manifest.json` is written **last**
   (D-14204) so a reader never sees a manifest pointing at half-written
   boards. The board SPA then fetches those files — see
   [Data flow](#data-flow-zero-api-snapshot-driven).

**What is NOT wired yet — the gap that matters.** There is **no HTTP
endpoint** that accepts a score submission. `submitCompetitiveScore` is a
complete, tested *library* surface, but nothing in
[`apps/server/src/server.mjs`](../apps/server/src/server.mjs) registers a
submit route — the transport is explicitly deferred
(`competition.types.ts` scopes the packet to "the library surface, not the
transport"). So `legendary.competitive_scores` receives no rows from
`play.legendary-arena.com` today; it is written only by test fixtures. This —
not merely low match volume — is why the live board shows `global-top` with
`rowCount: 0` and no per-scenario boards: with an empty table
`listScenarioKeys` returns nothing, so only the (empty) `global-top` board is
emitted. Wiring the submission endpoint is the missing link between "match
finished" and "row on the board."

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
- **[Profile Login](profile-login.md).** Score *submission* is designed to
  run from the authenticated arena client (`play.legendary-arena.com`) — the
  public board is always read-only and anonymous. Player identity on a row
  comes from the authenticated submission path, not the board. See
  [The profile page and the leaderboard](#the-profile-page-and-the-leaderboard)
  for how (and how little) the two are wired together today.
- **Persistence.** The board consumes R2 snapshots — derived, published
  records. `G` is never persisted or read by the board (per the
  runtime-only boundary in [Scoring](scoring.md)).

### The profile page and the leaderboard

**They share one identity record — and, today, nothing else.** The link
between a player's profile and their rankings is the single
`legendary.players` row, keyed internally on the bigint `player_id`
(external alias `ext_id` = `AccountId`; handle columns added in migration
`008_add_handle_to_players.sql`). There are two profile surfaces:

- **Public profile** — `GET /api/players/:handle/profile`
  ([`profile.routes.ts`](../apps/server/src/profile/profile.routes.ts)),
  rendered by
  [`PlayerProfilePage.vue`](../apps/arena-client/src/pages/PlayerProfilePage.vue).
  Resolves a player by `handle_canonical`; exposes `handleCanonical`,
  `displayHandle`, `displayName`, `publicReplays[]`, `teamAffiliations[]`,
  `badges[]`. `accountId` and `email` are deliberately withheld.
- **Owner ("my") profile** — `GET /api/me/profile`
  ([`ownerProfile.routes.ts`](../apps/server/src/profile/ownerProfile.routes.ts)),
  rendered by
  [`MyProfilePage.vue`](../apps/arena-client/src/pages/MyProfilePage.vue).
  Resolves by `ext_id` / `AccountId`; adds owner-only fields (avatar, about,
  visibility toggles, links, saved loadouts, billing). `email` is absent
  here too.

**No profile view displays any ranking data.** Nothing on either profile
fetches or renders a leaderboard standing, rank, personal best, or scenario
history. The public profile carries an inert **"Rank — coming soon
(WP-054 / WP-055)"** tab that makes zero network requests, and the server
wiring notes that the profile surface intentionally carries "no leaderboard /
competitive-score surface" (Vision §19b). There is no `/api/me/scores`
endpoint — a `listPlayerCompetitiveScores` library function exists but has no
route and no client caller.

**A deliberate identity rule governs how they may ever connect.** Ranking
keys on the stable internal `player_id` / `AccountId`, **never on the
handle** ([`DESIGN-RANKING.md`](../docs/ai/DESIGN-RANKING.md) — "player
identity for all ranking purposes is the stable player ID, never display
name, account alias, handle, or session identifier"). The handle is a
presentation alias only. Consequences:

- A **leaderboard row shows `display_name`** (via the read-layer JOIN), not
  the handle, and `PublicLeaderboardEntry` omits both the handle and
  `accountId`.
- A **score submission** takes its owner from the authenticated session
  (`account.accountId`, resolved to `player_id`), never from a
  client-supplied handle.
- The future rank tab's own comment warns it **must not fetch by handle**
  even once WP-054 / WP-055 land — it must resolve the player by `AccountId`
  first, then look up rankings by `player_id`.

So the profile → leaderboard integration is currently **latent**: the shared
`legendary.players` row is the join point a future "my rankings" panel would
use, but no such panel is built, and by design it will key on the internal
player ID, not the public handle.

## Edge Cases

- **The public URL is live (since 2026-07-08).** The deploy/domain
  provisioning that WP-143's app merge left open was finished this date. A
  Cloudflare Pages project `legendary-arena-legends` (build
  `pnpm --filter @legendary-arena/legends-board build`, output
  `apps/legends-board/dist`, env
  `VITE_LEGENDS_R2_BASE_URL=https://images.legendary-arena.com`) serves
  `https://legends.legendary-arena.com` (HTTP 200, SSL). The zero-API
  guarantee was verified against the **deployed bundle** — it contains no
  `api.legendary-arena.com` / `*.onrender.com` references and reads only
  `images.legendary-arena.com/legends/v1/*`; R2 CORS needed no change (the
  bucket already serves `Access-Control-Allow-Origin: *`).
  [`docs/ops/domains.json`](../docs/ops/domains.json) `legends.` is now
  `state=live` and `scripts/check-subdomains.mjs` reports it OK (PR #598).
  No app code changed — this was deploy/domain only. (Note:
  [`docs/02-ARCHITECTURE.md`](../docs/02-ARCHITECTURE.md)'s domain table may
  still read *planned*; `domains.json` is the operational status of record.)
- **The board only shows what the publisher wrote.** WP-142's snapshot
  publisher was enabled in production on 2026-07-08
  (`LEGENDS_PUBLISHER_ENABLED=true`, made durable in `render.yaml` by
  PR #599); `GET /health/legends-publisher` reports `status: "ok"` with a
  fresh `lastSuccessAt` and no errors. At enable time the live manifest
  (`legends/v1/manifest.json`) exposed a **single board, `global-top`, with
  `rowCount: 0`**. The deeper cause is upstream, not the board: the
  `legendary.competitive_scores` table is empty because the score-submission
  transport is **not yet wired** (see
  [From a finished match to a ranked row](#from-a-finished-match-to-a-ranked-row-the-write-path))
  — not merely low match volume. The board therefore renders its empty
  "Overall Rankings" state (with a working "Updated N min ago" freshness
  badge), not an error, and will fill on the next ~5-minute publish cycle
  once submissions start writing rows. A blank board is a data-supply state,
  not a board bug. Note the SPA ships five panel components (overall, weekly,
  by-scheme, recent-achievements, now-playing), but only the boards the
  publisher actually emits are rendered — at cutover that is just
  `global-top`.
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
