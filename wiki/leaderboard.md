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
  - ../apps/legends-board/src/App.vue
  - ../apps/legends-board/src/snapshots/snapshotClient.ts
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
  - ../apps/server/src/competition/competition.types.ts
  - ../apps/server/src/competition/competition.routes.ts
  - ../apps/server/src/replay/matchReplay.logic.ts
  - ../apps/server/src/replay/matchCapture.logic.ts
  - ../apps/server/src/leaderboards/leaderboard.logic.ts
  - ../apps/server/src/legends/legends.publisher.ts
  - ../apps/server/src/profile/profile.routes.ts
  - ../apps/server/src/profile/ownerProfile.routes.ts
  - ../apps/arena-client/src/lib/api/competitionApi.ts
  - ../apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts
  - ../data/migrations/007_create_competitive_scores_table.sql
  - ../data/migrations/024_create_match_seat_accounts.sql
  - ../data/migrations/025_create_bgio_replay_artifacts.sql
  - ../docs/ai/work-packets/WP-338-submit-by-matchid-server.md
  - ../docs/ai/work-packets/WP-339-arena-submit-my-scores.md
  - ../docs/ai/work-packets/WP-342-mastermind-gauntlet-boards-server.md
  - ../docs/ai/DESIGN-RANKING.md
last-reviewed: 2026-07-09
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

As of **2026-07-09** the **write path is also complete and deployed**: the
**D-24119 faithful-replay arc (WP-333 → WP-340)** wired the full
capture → submit → verify → score → leaderboard loop, and the server is live
on that code (verified `GET /api/version` → `gitSha: b20b97a`). A finished
match on `play.legendary-arena.com` now becomes a stored competitive score by
`matchId` alone — the server captures the match, re-executes it through the
faithful reducer, hash-verifies it, and scores it on the PAR-calibrated turn
scale. See [From a finished match to a ranked row](#from-a-finished-match-to-a-ranked-row-the-write-path).
The board will fill on its ~5-minute publish cycle once authenticated players
finish real matches (the remaining precondition is match volume + the
arena-client's own Cloudflare Pages deploy, not any missing code).

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

The board is the *last* stage of a longer pipeline. Both directions are now
**built and deployed**: the **read** direction (snapshot → board) shipped
earlier, and the **write** direction (a played match → a stored score) was
completed by the **D-24119 faithful-replay arc (WP-333 → WP-340)** and went
live on the server on **2026-07-09** (verified: `GET /api/version` →
`gitSha: b20b97a`, the WP-340 merge; `GET /api/me/scores` → `401`, i.e. the
route is wired and its auth gate runs). The earlier "no submission endpoint"
gap is closed. The one remaining precondition for rows to *appear* is simply
authenticated players finishing real matches on `play.legendary-arena.com`
(and the arena-client, a separate Cloudflare Pages deploy, carrying the WP-339
client — see [Edge Cases](#edge-cases)).

The end-to-end chain, in order:

1. **Seat → account identity is recorded at match join.** When an
   authenticated player joins, the server writes their server-verified
   `AccountId` to `legendary.match_seat_accounts` (`(match_id, player_id) →
   account_id`; migration `024_create_match_seat_accounts.sql`, WP-333 /
   D-24120). This is stored **server-side only** — never in boardgame.io
   `player.data`/`setupData` (which is visible to opponents). It is the link
   that lets a finished match's replay be attributed to the right accounts.

2. **On gameover, the match is captured into a durable, replayable
   artifact.** A background scan harvester (WP-335 / D-24122) reconstructs
   each finished match via the **faithful reducer**
   (`reduceMatchToFinalState`,
   [`matchReplay.logic.ts`](../apps/server/src/replay/matchReplay.logic.ts),
   WP-334 / D-24121): it re-executes the match's *persisted* boardgame.io
   `initialState + log` (from the WP-309 `bgio.matches` store) through
   boardgame.io's **own** reducer — seed- and turn-hook-faithful by
   construction — to reproduce the exact live final `G`, then hashes it with
   `computeStateHash`. It stores `{ initialState, log }` in
   `bgio.replay_artifacts` (migration `025_create_bgio_replay_artifacts.sql`)
   keyed by that `replayHash`, and calls `assignReplayOwnership` for each
   authenticated seat (from `match_seat_accounts`). The artifact is durable
   so it survives the WP-327 reaper deleting the live match row. *(Reduction
   faithfulness for multi-turn matches was a real subtlety: play-phase
   `endTurn` events are logged `automatic: false`, so the reducer must
   re-dispatch **only** player `MAKE_MOVE` entries and let the framework
   regenerate every move-triggered transition — D-24124.)*

3. **The client submits by `matchId`; the server does everything else.**
   The submission contract is `CompetitiveSubmissionRequest = { matchId:
   string }` (`apps/server/src/competition/competition.types.ts`, WP-338 /
   D-24126) — the client **cannot** compute `computeStateHash`, so it never
   sends a `replayHash` and never a score. `POST /api/competition/scores`
   (`authenticated-session-required`) runs
   `submitCompetitiveScoreByMatchIdForRequest`
   ([`competition.logic.ts`](../apps/server/src/competition/competition.logic.ts)):
   guest guard → **gameover gate** (unfinished → `409 match_not_finished`) →
   **resolve `replayHash` by `match_id`** (capturing **on-demand** if the
   5-minute harvester scan has not run yet) → confirm the caller's ownership
   (a **by-account** lookup, so a co-owner of a two-authenticated-seat match
   is not mis-rejected — WP-340 / D-24128) → **auto-publish** that ownership
   `private → public` (submitting is consent-to-publish) → delegate to the
   verify+score core. The core re-reduces the artifact and rejects the
   submission unless the recomputed `computeStateHash` equals the stored
   `replayHash` (`replay_verification_failed`); it never trusts a
   client-supplied number (D-5301). Then it scores server-side with
   `deriveScoringInputs → computeRawScore → computeFinalScore →
   buildScoreBreakdown`
   ([`parScoring.logic.ts`](../packages/game-engine/src/scoring/parScoring.logic.ts)).
   **`rounds` is the completed play-turn count** (`ReplayResult.turnCount`),
   matching how the PAR baselines were calibrated — *not* the move count that
   an earlier MVP proxy used (D-24123 / D-24125). Guests are rejected
   (`guest_not_eligible`); an unpublished-PAR scenario is rejected
   (`par_not_published`). Lower `finalScore` is better (negative = under PAR).

4. **The row is written to `legendary.competitive_scores`.** One immutable,
   write-once row per `(player_id, replay_hash)` (migration
   `007_create_competitive_scores_table.sql`; immutability per D-5302).
   Columns: `player_id` (bigint FK → `legendary.players`), `replay_hash`,
   `scenario_key`, `raw_score`, `final_score`, `score_breakdown` (jsonb),
   `par_version`, `scoring_config_version`, `state_hash`, `created_at`.
   **There is no handle or team column** — the stored identity is the
   internal `player_id`; a display name is attached later by JOIN. The
   `UNIQUE (player_id, replay_hash)` constraint gives per-replay idempotency
   (a resubmit returns the existing record with `wasExisting: true`), but
   there is **no best-score-per-player collapsing** — every distinct eligible
   replay is its own row.

5. **The read layer projects rows to a safe public shape.**
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

6. **The publisher freezes reads into R2 snapshots.** WP-142's publisher
   ([`legends.publisher.ts`](../apps/server/src/legends/legends.publisher.ts))
   calls the *same* read-layer functions (`getGlobalTopLeaderboard`,
   `getScenarioLeaderboard`, `listScenarioKeys`) inside one read-only
   transaction and writes JSON to `legends/v1/*`: a `global-top` board
   (top 500) plus one `scenario-<scenarioKey>` board (top 100) for each
   scenario that has public scores. `manifest.json` is written **last**
   (D-14204) so a reader never sees a manifest pointing at half-written
   boards. The board SPA then fetches those files — see
   [Data flow](#data-flow-zero-api-snapshot-driven).

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

**The OWNER profile now shows the player's own submitted scores (WP-339);
the PUBLIC profile still shows no ranking.** As of the D-24119 arc:

- **Owner ("my") profile — has a "Competitive Scores" section.**
  `MyProfilePage.vue` (`?route=me`) now fetches **`GET /api/me/scores`**
  (WP-338 / D-24126 — backed by `listPlayerCompetitiveScores`, which finally
  has a route) on mount and lists the signed-in player's submitted scores
  (final score, scenario, date; with loading/empty/error states). This is the
  player's *own* history, gated to their authenticated session — not a public
  ranking. Submission itself fires automatically from the arena-client **on
  gameover** for an authenticated player (a fire-once watcher at
  `PlayViewport`; a guest is never submitted and instead sees a "sign in to
  submit" prompt — WP-339 / D-24127).
- **Public profile — still no ranking data.** `PlayerProfilePage.vue` carries
  the same inert **"Rank — coming soon (WP-054 / WP-055)"** tab that makes
  zero network requests. Surfacing a *public* rank / standing on the public
  profile is still deferred (and, per the identity rule below, must resolve by
  `AccountId`, never by handle).

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
  fresh `lastSuccessAt` and no errors. At publisher-enable time (2026-07-08)
  the live manifest (`legends/v1/manifest.json`) exposed a **single board,
  `global-top`, with `rowCount: 0`** — because the score-submission transport
  was not yet wired and `legendary.competitive_scores` was empty. **That gap
  is now closed:** the D-24119 arc (WP-333 → WP-340) wired the full write path
  and the server is deployed on it (2026-07-09; see
  [From a finished match to a ranked row](#from-a-finished-match-to-a-ranked-row-the-write-path)).
  So an empty (or sparse) board is now genuinely a **data-supply** state —
  authenticated players simply need to finish real matches — not a missing
  endpoint. Two operational preconditions still gate rows actually appearing:
  (a) enough authenticated matches get played and submitted, and (b) the
  **arena-client** (`play.legendary-arena.com`, a separate Cloudflare Pages
  deploy — *not* the Render server) has shipped the WP-339 client that fires
  the on-gameover submission. The board renders its empty "Overall Rankings"
  state (with a working "Updated N min ago" freshness badge), not an error,
  and fills on the next ~5-minute publish cycle once rows exist. Note the SPA
  ships five panel components (overall, weekly, by-scheme, recent-achievements,
  now-playing), but only the boards the publisher actually emits are rendered
  — until per-scenario scores accumulate, that is just `global-top`.
- **~~Three of the five panels render a header-only table when empty~~
  (board review, 2026-07-09 — FIXED by WP-343 / D-24132 the same day).**
  `OverallPanel`, `WeeklyPanel`, and `BySchemePanel` now render the shared
  "No Legends yet — be the first" call-to-action when a board's `entries`
  is empty, and the WP-343 gauntlet index renders zero-entry gauntlets as
  inline "unclaimed" CTAs — the empty board is an acquisition surface,
  not a bare table.
- **Publisher board names do not match the SPA's panel keys.** The
  publisher emits `global-top` plus `scenario-<key>` boards, but the SPA's
  panel resolver keys are `overall` / `weekly` / `by-scheme` /
  `recent-achievements` / `now-playing`
  ([`App.vue`](../apps/legends-board/src/App.vue) `panelComponents`), so
  every board the publisher actually writes falls through to the
  `OverallPanel` fallback. Harmless for `global-top` today, but a future
  `scenario-*` board would render under the hardcoded "Overall Rankings"
  title with a permanently blank Scenario column (`ScenarioSnapshotEntry`
  has no `scenarioKey` field). Kiosk mode meanwhile titles the same view
  from the board slug ("Global Top") — two names for one panel.
- **A failed board fetch sticks until the next publisher write.** The
  60-second poll re-fetches board JSON only when `manifest.generatedAt`
  changes ([`App.vue`](../apps/legends-board/src/App.vue) `handlePoll`), so
  a transient per-board fetch failure displays "Data unavailable" until the
  publisher's next ~5-minute cycle bumps the manifest — not until the next
  poll.
- **Manifest polling is not edge-stale.** Verified live 2026-07-09:
  `legends/v1/manifest.json` serves `Cf-Cache-Status: DYNAMIC`, so the
  SPA's fresh-manifest polling assumption
  ([`snapshotClient.ts`](../apps/legends-board/src/snapshots/snapshotClient.ts))
  holds — the CDN does not serve the board a stale manifest.
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

> **Update 2026-07-09 — tier 2 is now DECIDED.** The per-mastermind
> set-gauntlet below was ratified and expanded to **all sets** by
> **D-24131** ([DECISIONS.md](../docs/ai/DECISIONS.md)), with
> [WP-342](../docs/ai/work-packets/WP-342-mastermind-gauntlet-boards-server.md)
> **executed 2026-07-09** as the server packet (outcome column + gauntlet
> read-layer + publisher emission; migration 026 PROD apply pending). Locked parameters: one gauntlet per
> (set × mastermind) for every set with ≥1 scheme (105 boards at current
> data; `dims`/`3dtc` excluded); legs = the set's schemes; **wins only**
> (a new `outcome` column on `competitive_scores`, written at submission);
> best score per leg, any villain groups; entry = complete gauntlets only,
> ranked by total (= average) of best legs; rows must carry the
> currently-published `scoringConfigVersion` (VISION §22); **no submission
> step** — standings are a publisher-derived aggregation; snapshots
> `gauntlet-<setAbbr>-<mastermindSlug>.json` + a `gauntlet-index.json`
> catalog + additive manifest fields. Follow-up WPs (backlogged): the
> legends-board set-grouped index + gauntlet panel, and profile surfaces
> (owner-profile progress checklist, public-profile completed-gauntlet
> badges). Tiers 1, 3, 4 and the annual reset below remain **proposals**.

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
post a verified score against Thanos across **every scheme packaged in
Thanos's set** (the scheme is the scenario component; its twists are cards
inside it), and the championship score is the aggregate of those
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

**Resolved for tier 2 by D-24131 (2026-07-09):** the aggregate is the
average of best-per-leg winning scores (complete gauntlets only); "set"
membership is the registry's set grouping (slugs from card data, never
re-slugified); partial gauntlets never appear on the public board —
progress displays only on the authenticated owner profile (follow-up WP).

**Still open (tiers 1 / 3 / 4 and lifecycle):**

- Category-tier definitions (tier 3) — which masterminds count as "Villain
  masterminds" vs "Mastermind masterminds," and whether tier 3 ships at all.
- Skill-tier banding method (fixed percentiles vs dynamic) and how it
  interacts with low-population boards.
- Data model for active vs archived boards, and the reset job that performs
  the Dec 31 → Jan 1 rollover (a `scoringConfigVersion` bump is handled as
  an archival rollover per D-24131 §5, which constrains this design).
- Tier-1 (annual overall champion) aggregate — sum vs average vs best-N
  across scenarios.

### Engagement & presentation proposal (2026-07-09 board review)

> **Proposal, not decided** — same rule as the championship section above.
> This records a 2026-07-09 review of the live board against
> community-platform leaderboards (the Skool pattern: windowed boards,
> streaks, levels with unlock perks, social proof). Ratifying any of it
> requires a [DECISIONS.md](../docs/ai/DECISIONS.md) entry and Work
> Packets. The mockups below are hand-authored illustrations of the
> direction, not shipped designs.

**Boundary first: none of this touches engine scoring.** Every mechanic
below is a **server-side derived aggregation over existing
`legendary.competitive_scores` rows** — the same posture as the
championship proposal. The only point source remains the replay-verified
`finalScore` (D-5301); engagement metrics are presentation, not a second
scoring system. Social-style engagement points (likes, posts — the Skool
point source) are explicitly **not** proposed: they are trivially gameable
and alien to a competitive game.

**The envisioned board:**

![Mockup of the envisioned Hall of Legends board. A dark gold-on-black leaderboard with three window tabs (7-Day active, 30-Day, All-Time), a freshness badge reading Updated 3 min ago, and six ranked rows. Each row shows a rank-movement arrow, rank number, avatar, player handle, best scenario key, a level chip, a play-streak flame with day count, a run count, and a best-score-versus-PAR value where negative golf-style scores render in gold. A footer notes every score is replay-verified.](/leaderboard/board-mockup-main.svg "width=92%")

*Envisioned populated board — windowed tabs, streak flames, level chips,
rank movement, and PAR-relative scores (lower is better). Hand-authored
mockup: [board-mockup-main.svg](../ewiki/leaderboard/board-mockup-main.svg).*

The four mechanics worth adopting, ranked by value-per-effort:

1. **Windowed boards — 7-day / 30-day / all-time.** The highest-leverage
   item. An all-time board locks up behind veterans within months; a
   weekly window gives every new player a winnable race. Cheapest of the
   four: the SPA already ships a `WeeklyPanel`, and the publisher already
   has the board-list plumbing — the work is a `created_at`-windowed
   variant of the existing read-layer queries plus new snapshot names.
   Windowed boards should rank by the window's *best verified score*
   (staying golf-scale), with the row also showing runs posted in the
   window.
2. **Play streaks.** Consecutive-day play streaks (the flame), computable
   from `competitive_scores.created_at` (or match history) per player. A
   proven daily-return mechanic, publishable as one extra field on
   existing snapshot entries.
3. **Levels / progression with unlock perks.** The Skool pattern that
   converts a scoreboard into a retention system: levels earned from
   verified play, a "N points to level up" nudge, and "1% of players"
   social proof per tier. Unlocks must be **cosmetic only** — titles,
   avatar frames, board flair — never gameplay power (VISION NG-1). Level
   names want Legendary-arena flavor, generic enough to stay clear of
   licensed character names (e.g. Recruit → Agent → Operative → Veteran →
   Champion → Legend). This is a real product arc (progression WPs), not a
   board tweak — recorded here so the board design leaves room for it.
4. **Avatars + a personal standing surface.** Avatar upload already
   shipped (owner profile); snapshot entries carry only a handle today.
   Adding avatars turns the kiosk from a spreadsheet into a hall of fame.
   The *personal* half — "you are #14 of 210, ▲3 this week, 38 pts to
   Level 5" — **cannot live on the legends board**, which is zero-auth by
   design; it belongs on the authenticated arena-client (the WP-339
   My-Scores surface is the natural host). The public board stays
   anonymous and read-only.

![Mockup of a personal standing card next to a level ladder. The left card shows player NightOwl at rank 14 of 210 this week, up three places, a Level 4 Veteran progress bar with 38 points to Level 5, a six-day streak flame with the caption Finish a match today to keep it alive, and three personal-best scenario scores. The right card lists six levels from Recruit to Legend with the share of players at each level shrinking from 46 percent to 1 percent, and a note that levels unlock cosmetics, titles, and avatar frames, never gameplay power.](/leaderboard/board-mockup-progression.svg "width=92%")

*Envisioned personal-standing card (arena-client side) and level ladder
with per-tier social proof. All numbers and level names are illustrative.
Hand-authored mockup:
[board-mockup-progression.svg](../ewiki/leaderboard/board-mockup-progression.svg).*

**Near-term, independent of all the above: a designed empty state.** As
noted under [Edge Cases](#edge-cases), three of five panels currently
render a header-only table when a board is empty — which is the live
default view until scores accumulate. The empty board is a wasted
conversion surface: "rank #1 is unclaimed" is the strongest call-to-action
this product will ever have, and it costs one panel component.

![Mockup of the envisioned empty-state view. The Hall of Legends header and window tabs sit above a centered gold trophy outline, the heading No Legends yet, the line The Hall opens with the first replay-verified score — rank number one is unclaimed, a gold call-to-action button reading Play now — be the first, and a footnote that signing in at play.legendary-arena.com and finishing a match submits the score automatically.](/leaderboard/board-mockup-empty.svg "width=92%")

*Envisioned empty state — the unclaimed board as an acquisition hook
instead of a bare table. Hand-authored mockup:
[board-mockup-empty.svg](../ewiki/leaderboard/board-mockup-empty.svg).*

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
- [WP-342](../docs/ai/work-packets/WP-342-mastermind-gauntlet-boards-server.md)
  + DECISIONS.md **D-24131** — the ratified set-gauntlet design and its
  server packet (executed 2026-07-09)
- [Scoring](scoring.md), [PAR Simulation Calibration](par-simulation-calibration.md)
  — companion wiki pages for the scoring internals
