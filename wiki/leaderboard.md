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
  - C:\pcloud\BB\DEV\legendary-arena\wiki\leaderboard.md (this page — https://ewiki.legendary-arena.com/leaderboard/)
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
  - ../docs/ai/work-packets/WP-344-player-count-gauntlet-boards-server.md
  - ../docs/ai/work-packets/WP-345-player-count-gauntlet-client.md
  - ../apps/server/src/legends/gauntlet.logic.ts
  - ../docs/ai/DESIGN-RANKING.md
  - ../packages/registry/src/playerCountSetup.ts
  - ../packages/registry/src/gauntletPack.ts
  - ../apps/server/src/legends/gauntletTruth.logic.ts
  - ../apps/server/src/gauntlet/gauntletRun.types.ts
  - ../apps/server/src/gauntlet/gauntletRun.logic.ts
  - ../apps/server/src/gauntlet/gauntletRun.routes.ts
  - ../apps/server/src/gauntlet/gauntletRunProgress.logic.ts
  - ../apps/arena-client/src/pages/MyProfilePage.vue
  - ../apps/arena-client/src/lobby/useCreateMatchFromComposition.ts
  - ../apps/legends-board/src/panels/gauntletPackDownload.ts
  - ../apps/registry-viewer/src/lib/loadoutGauntletPackImport.ts
  - ../data/migrations/039_create_player_gauntlet_runs.sql
  - ../docs/ai/REFERENCE/api-endpoints.md
  - ../docs/ai/work-packets/WP-440-gauntlet-pack-contract.md
  - ../docs/ai/work-packets/WP-441-legends-gauntlet-download.md
  - ../docs/ai/work-packets/WP-442-gauntlet-truth-helper.md
  - ../docs/ai/work-packets/WP-443-gauntlet-run-persistence.md
  - ../docs/ai/work-packets/WP-444-registry-viewer-gauntlet-pack-import.md
  - ../docs/ai/work-packets/WP-445-gauntlet-run-import-api.md
  - ../docs/ai/work-packets/WP-446-gauntlet-run-derived-progression.md
  - ../docs/ai/work-packets/WP-448-composition-to-match-launch-primitive.md
  - ../docs/ai/work-packets/WP-449-profile-gauntlet-tracker-ui.md
last-reviewed: 2026-07-29
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
were all provisioned that day (details under [Edge Cases](#edge-cases)). Of the
multi-tier *annual championship* structure, the **per-mastermind
set-gauntlets are decided and shipped** — including the player-count
dimension (D-24131 / D-24134) and, as of 2026-07-16, a second
**fixed-hero-pool championship division** beside the open one (D-24187);
see [Gauntlets](#gauntlets--the-per-mastermind-set-championships-d-24131--d-24134--d-24187).
The remaining tiers (overall champion, category champions, skill tiers,
yearly archive) are **proposals** living in
[Open Questions](#open-questions) until ratified.

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

### Gauntlets — the per-mastermind set championships (D-24131 / D-24134 / D-24187)

> This section documents the **decided and shipped** gauntlet system. It
> graduated out of [Open Questions](#open-questions) when D-24131 ratified
> tier 2 of the championship proposal (2026-07-09) and WP-342 / WP-343
> executed the same day. **D-24134** (the player-count dimension) is now
> also fully shipped — WP-344 (server) and WP-345 (client, PR #787)
> executed 2026-07-16, so the player-count boards, roster-keyed entries,
> and challenge links below are **live**, not pending. **D-24187** adds a
> second *division* beside the open one — the fixed-hero-pool
> championship — also shipped 2026-07-16 (WP-384 + WP-385); see
> [Fixed-hero-pool division](#fixed-hero-pool-division-d-24187) below.

> **Want to run one yourself?** This section is about the public
> *standings*. The personal **download → import → build → track** loop —
> download a gauntlet on `legends.legendary-arena.com`, import it into your
> play profile, assemble heroes per leg, and track progress toward the
> championship — is documented under
> [Gauntlet runs](#gauntlet-runs--download--import--build--track-wp-440449)
> below.

The gauntlet collapses the mastermind × scheme board explosion into one
findable championship per mastermind. **Identity:** one gauntlet per
(set `abbr` × mastermind `slug`) for every set packaging ≥1 scheme — **110
gauntlets across 39 qualifying sets** at current data (`dims`/`3dtc`
excluded); **legs** = that set's schemes (3–8). A row qualifies as a leg
only when:

> **The count is derived, never authored.** `buildGauntletCatalog()`
> computes it at server startup from `registry.listSets()`; any number
> written into prose is a snapshot that starts drifting immediately. This
> page previously carried both "105" and "109" in four places while the
> live catalog published 110. Recompute rather than trust a quoted figure:
> sum `masterminds.length` over every `data/cards/*.json` with
> `schemes.length ≥ 1`.

- its `schemeSlug` **and** `mastermindSlug` both belong to the gauntlet's
  set (both-sides-same-set rule; slug-space collisions across sets are one
  competitive identity, accepted v1 semantics),
- `outcome = 'heroes-win'` (migration 026; legacy `NULL` rows never
  qualify) — wins only,
- its `scoring_config_version` equals the currently-published version for
  its `scenario_key` (VISION §22),
- its `player_count` matches the board's player count (migration 027;
  legacy `NULL` rows never qualify on any count-keyed board).

**Aggregation:** best (lowest) `final_score` per leg, any villain groups;
a board entry requires a winning best on **every** leg (complete gauntlets
only); `totalScore` = sum of best-per-leg, `averageScoreCentis` =
`round(totalScore·100/legCount)`; rank `totalScore ASC`. There is **no
submission step** — standings are a publisher-derived aggregation
recomputed each ~5-minute cycle.

> **"Any villain groups" is being retired for ranked play (D-24199 / WP-395,
> drafted 2026-07-18 — not yet executed).** Free villain choice makes PAR
> calibration *unreachable*, not merely costly: `ScenarioKey` is
> `scheme::mastermind::sorted-villain-groups`, the 41 sets ship **134**
> villain groups, and PAR is calibrated per key with a validator rejecting
> `sampleSize < 500`. Across 639 scheme × mastermind leg pairs that is 85,626
> scenarios at 1 player and **8,205,239,889 at 5** — roughly 4.1 trillion
> simulated games. A canonical villain + henchmen loadout per mastermind
> collapses it to **639 scenarios (~319,500 games)**. Since submission
> fail-closes on `par_not_published`, this is the difference between a ranked
> surface that can exist and one that cannot.
>
> Scoped to **gauntlet qualification only** — casual play keeps free
> selection, and hero choice stays free in both divisions (heroes are not part
> of `ScenarioKey`, so they cost nothing to calibrate). Migration cost is
> currently **zero** because `competitive_scores` is empty; that ends the day
> the first score lands. **103 / 111** masterminds already declare
> `alwaysLeads`, so most of the loadout is given by the printed cards.

**Player-count boards** *(D-24134, live)*: one board per
(set × mastermind × playerCount 1..5). The existing
`gauntlet-<setAbbr>-<mastermindSlug>.json` file becomes the solo board;
multiplayer boards are additive `…-p<N>.json` files (N = 2..5), written
lazily. A multiplayer entry is **roster-keyed**: the competitor is the
exact team of authenticated accounts owning the qualifying replay (owner
count must equal `player_count` — a guest seat voids team eligibility;
every member's ownership visibility must be link/public before any handle
is published), and the **same roster** must clear every leg. Entries carry
`players[]` — every member's handle — which is the "2-player core Dr. Doom
champions: both names on the board" surface. Scores never compare across
player counts (see the PAR note under [Edge Cases](#edge-cases)).

**Publishing:** per-gauntlet snapshots (only when ≥1 complete entry) + a
`gauntlet-index.json` catalog listing every gauntlet with `legCount` /
`entryCount` (zero-entry boards render as "unclaimed" CTAs on the index);
additive manifest fields `gauntletBoards` / `gauntletIndex`. *(D-24134,
live)*: index entries carry per-count `entryCounts` and the per-gauntlet
`legs` list, and the board panel has a player-count selector plus
**"Challenge this leg" links** — each leg links to the Registry Viewer's
URL-parameterized loadout preview (`?schemeId=…&mastermindId=…`, WP-114)
with the leg's scheme and mastermind pinned, so a player lands one "Edit
this loadout" click away from picking heroes for a correctly-keyed run.

Shipped surfaces: WP-342 (server: outcome column + gauntlet read-layer +
publisher emission) and WP-343 (client: set-grouped index, hash routing,
board panel, designed empty states) — both executed 2026-07-09; WP-344
(server: player-count persistence + roster-keyed per-count standings) and
WP-345 (client: count selector, rosters, challenge links) — both executed
2026-07-16 (WP-345 D-24026 live-verified on `legends.legendary-arena.com`,
PR #787). Migrations apply to production automatically — `render.yaml`'s
server buildCommand runs `scripts/migrate.mjs` on every deploy (a failure
blocks the deploy), so 026 and 027 are both live (verified via the
published gauntlet index, which now carries `entryCounts` on all 110
gauntlets). The remaining precondition for boards filling is data supply:
authenticated players
finishing winning matches.

### Fixed-hero-pool division (D-24187)

> Shipped 2026-07-16 (WP-384 server + WP-385 client). The prestige
> **division** beside the open gauntlet — the "legendary" format the
> operator asked for. The design reasoning trail lives under
> [Hero requirements](#hero-requirements--the-fixed-hero-pool-gauntlet-shipped-2026-07-16-d-24187)
> in Open Questions; this is the live behavior.

Every gauntlet board now has **two divisions**, switchable by a toggle:

- **Open** — the D-24131 / D-24134 standings above, unchanged. Any heroes,
  per leg. This is the acquisition surface and the default view.
- **Fixed-Pool Championship** — the same completeness and roster rules,
  **plus** a shared hero-pool constraint. To claim a fixed board a
  competitor's chosen winning replays must, across all legs, draw their
  heroes from one pool of at most **`heroCount + 2`** distinct heroes
  (`PLAYER_COUNT_SETUP` + 2, D-24165: solo 3+2 = 5, 2–4p 5+2 = 7, 5p
  6+2 = 8). The championship title attaches to this division.

**How it works, end to end:**

- **`team_key` (migration 034).** Every verified score now records the
  match's hero team identity — the set-qualified `heroDeckIds` sorted ASC
  and `+`-joined, derived server-side at submission from the reduced final
  state (never client-supplied). A one-time artifact backfill covered any
  pre-migration rows under a narrow **D-24187** carve-out on the
  boardgame.io replay-artifact blob (it resolved as a no-op — production
  `competitive_scores` was empty, so every stored score carries its
  `team_key` from birth).
- **Standings.** The publisher's single per-gauntlet query returns both
  divisions; the fixed side runs a deterministic, bounded, exact-optimum
  search over the competitor's distinct team keys for the lowest-scoring
  pool-satisfying assignment (cap 12 distinct teams per roster × count ×
  gauntlet, with logged — never silent — truncation). No submission step;
  no declaration; the pool is *inferred* from the wins.
- **Snapshots.** Additive, lazy `gauntlet-<setAbbr>-<mastermindSlug>-fixed`
  (solo) and `…-fixed-p<N>` (N = 2..5) board files, written only at ≥1
  complete entry; fixed entries carry `heroPool` (the union of the winning
  teams' heroes). The index gains `fixedEntryCounts` per count. Open-board
  files, semantics, and entries are byte-unchanged.
- **Board UI.** The board panel shows an **Open | Fixed-Pool Championship**
  toggle; fixed boards render a **Hero Pool** column and a championship
  subtitle; the open board carries a feeder line inviting the championship;
  the index shows a gold `★ Np` chip for each *claimed* fixed count. An
  unclaimed fixed board (or count) renders the open-championship "rank #1
  unclaimed" state — never an error.

**Terminology.** The hero constraint is the **hero pool**; "roster" stays
the D-24134 *player-account* dimension. A multiplayer fixed entry needs
both — the same account roster on every leg **and** a shared hero pool.

**Launch state.** All 110 gauntlets publish `fixedEntryCounts`, every count
currently unclaimed — the intended open-championship acquisition state. The
first authenticated player (or roster) to clear a full set with one hero
pool claims the first Fixed-Pool Championship, with their pool on the board.

### Per-gauntlet editorial content (naming approved — D-24191)

> **Status: unblocked 2026-07-18.** The IP-naming fork below was decided by
> the operator in favour of naming — see **D-24191** in
> [DECISIONS.md](../docs/ai/DECISIONS.md). Gauntlet editorial may name
> masterminds, schemes, and sets; the generic house style remains the
> default for every other post. Pilot scope: 2–3 posts, measured, before
> any commitment to the full 110.

**The idea.** One article per gauntlet on
`www.legendary-arena.com/posts/`, showing the gauntlet's composition and
offering hero commentary. The motivating problem is real: every board is
currently unclaimed, so each gauntlet page is a dead end with nothing to
read and nothing for a search engine to index. Editorial gives all 110 a
reason to exist *before* anyone has played them, and turns
`legends.legendary-arena.com` from a scoreboard into a funnel.

**What a gauntlet actually fixes** — the most common misconception, worth
stating plainly because it invalidates the obvious version of this idea:

| Publishable per gauntlet | *Not* fixed by the gauntlet |
|---|---|
| Mastermind (name, slug, home set) | Villain groups — **any villain groups qualify** |
| The full scheme **leg** list (3–8) | Henchmen groups |
| Per-player-count setup counts (`PLAYER_COUNT_SETUP`) | Bystanders / wounds / officers / sidekicks as a *gauntlet* property |
| Fixed-division pool **budget** (`heroCount + 2`) | The fixed division's hero **roster** |

A gauntlet is a **multi-leg championship**, not a match loadout. It pins a
mastermind and a set's scheme list; everything else varies per match. The
fixed-hero-pool division imposes a *budget*, not a roster — the published
pool is discovered from whichever teams an entrant actually submitted
(`findBestPoolAssignment()`), so no per-gauntlet hero list exists to
publish. There is also no wounds / officers / sidekicks data anywhere in
`PLAYER_COUNT_SETUP` (the "What If…?" variant setup is deferred per
D-24165).

**Generate the facts; hand-write only the opinion.** The composition block
is 100% derived from the registry at startup. Any post that hard-codes it
begins rotting the moment a set changes — the drift callout above is the
proof, three different counts in one file. Render the setup block from
`buildGauntletCatalog()` output; reserve prose for what a human adds.

**Sequencing.** Publish three, not 110, and measure before scaling. Hero
recommendations are pure opinion today because no win-rate data exists;
structure each post so a "what actually wins" section can be appended from
`legendary.competitive_scores` once boards fill. That later section is the
defensible content — replay-verified win rates are something only the
operator of the verification pipeline can write.

**IP naming — decided (D-24191).** All **55** pre-existing posts under
`content/posts/` name **zero** Marvel characters and never use the word
"Marvel"; that house style is deliberate. Per-gauntlet posts are the
opposite by construction — their value is naming a specific mastermind and
its schemes — so the operator ratified a **scoped carve-out**:

- Gauntlet editorial **may** name masterminds, schemes, and sets. These are
  the competitive identity of a published board, already rendered on
  `legends.legendary-arena.com`.
- The generic style **remains the default** for every other post. Nothing
  is rewritten; this is not blanket permission for marketing copy.
- **Naming is not reproduction.** Card text, card art, and set-wide card
  lists stay on the licensed gameplay and registry surfaces.

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

## Gauntlet runs — download → import → build → track (WP-440..449)

> This documents the **shipped** personal gauntlet-run loop — the
> download → import → build → track → champion arc that sits *beside* the
> public standings above. All slices are on `origin/main`: WP-440..446 plus
> WP-448 and WP-449 (WP-447 is an unrelated villain card mechanic, not part
> of this arc). WP-449 (the profile tracker UI) merged as PR #1073. Public
> **standings** are still a publisher-derived aggregation; a **run** is one
> player's private progress toward claiming a gauntlet.

The public gauntlet boards answer "who holds this championship." This loop
answers the other half — **"let me go earn it"** — as an end-to-end player
journey:

1. **Download** a Mastermind Gauntlet on `legends.legendary-arena.com`.
2. **Import** it into your play profile at `?route=me` on
   `play.legendary-arena.com`.
3. **Build** your own hero team for each leg.
4. **Play** each leg, **score** it, **track** progress, and — once every leg
   is cleared from one legal hero pool — **earn the championship**.

Nothing about a player's *progress* is stored as a flag. Progression is
**read-only derived state**, recomputed on every read from the run's hero
picks plus the player's own competitive scores (the derived-progression
lock, D-24262). The pieces:

### The pack — an identity-only token (WP-440 / D-24260)

A downloaded gauntlet is a tiny **identity token**, not a loadout. Its whole
schema is a version stamp plus the gauntlet's identity:

```
{ "pack_version": 1,
  "gauntlet": { "setAbbr": "core", "mastermindSlug": "magneto",
                "division": "fixed", "playerCount": 1 } }
```

It carries **no** legs, hero picks, or adversary compositions — the server
(or any registry-backed surface) **re-resolves** a gauntlet's legs and
approved compositions from the live registry at import time. The schema, the
pure `buildGauntletPack` builder, and the strict version-gated
`validateGauntletPack` live in
[`packages/registry/src/gauntletPack.ts`](../packages/registry/src/gauntletPack.ts).
This is deliberately **not** a LAGN document — see
[Gauntlet packs are not LAGN](lagn-v1.md#gauntlet-packs-are-not-lagn).

### Legends download — zero-API, client-side (WP-441 / D-24261)

The legends board pins **Core Set / Magneto** first as a showcase, and adds a
**"Download Mastermind Gauntlet"** control with a player-count + division
selector (defaulting to **solo + fixed**). It builds the pack **client-side**
(an inline, **type-only** registry import — legends-board's only runtime
dependency stays `vue`, preserving its zero-API invariant) and downloads
`gauntlet-<set>-<mm>-<div>-p<N>.gauntlet.json`. No server call is involved.

### Cards-builder consumer (WP-444 / D-24263)

The Registry Viewer ("cards" surface) gains a **"Load Gauntlet Pack"** entry
that resolves a pack **client-side** from its bundled registry into a
prefilled builder: a **leg (scheme) picker**, then the default variant-0
approved composition (villains / henchmen / counts) filled in, **heroes left
empty** for the player to choose. Unknown or unoffered packs fail to a
friendly message.

### Shared truth — one source, cross-checked (WP-442)

[`apps/server/src/legends/gauntletTruth.logic.ts`](../apps/server/src/legends/gauntletTruth.logic.ts)
(`qualifiesAsLegClear` + `findBestPoolAssignment`) is the **single** source
of truth for what "cleared a leg" and "champion" mean. It was extracted from
the standings fold so that **both** the public leaderboard
(`getGauntletStandings`) and the personal run tracker consume the *same*
functions — a cross-check test proves the two can never drift on either
verdict.

### Run persistence — minimal + maximally derived (WP-443 / D-24262)

Migration `039_create_player_gauntlet_runs.sql` adds
`legendary.player_gauntlet_runs`. A row stores **only** identity
(`player_id` FK, `set_abbr`, `mastermind_slug`, `division`, `player_count`),
the player's per-leg hero picks (`leg_picks jsonb` — a `schemeSlug →
heroDeckIds[]` map, the single authoritative hero state; no child hero
table), and audit timestamps. It stores **nothing derived** — no status,
hero-pool, pool-validity, standing, or "where you left off" column. A
partial-unique index (`WHERE first_completed_at IS NULL`) enforces
at-most-one **active** run per identity; a finished run drops out of the
index and frees the slot. `first_completed_at` is a **write-once audit /
archive-boundary** stamp — never read as championship truth (every read
re-derives standing from `legendary.competitive_scores`). This is the
**derived-progression lock**: no future work may cache a derived progression
value without a superseding decision.

### Import + run API (WP-445 / D-24264 · WP-446 / D-24265)

`/api/me/gauntlet-runs` (`authenticated-session-required`) is the run CRUD
surface:

- **`POST`** — idempotent import. The whole request body is the untrusted
  WP-440 pack; the server validates it, resolves the legs server-side, and
  creates (or **attaches to**) the active run of that identity. The
  migration-039 partial-unique conflict is caught and resolved to the
  existing run — **never** a `409` / `500`. Invalid pack shape → `400`; a
  gauntlet / player-count with no approved menu → `422`.
- **`GET`** returns a derived
  [`GauntletRunProgressView`](../apps/server/src/gauntlet/gauntletRun.types.ts)
  per run — the **5-state status** `needs-heroes → ready → playing →
  all-legs-cleared → champion`, the hero **pool** (sorted union of every
  leg's picks), **budget headroom** (`budget − pool.length`, where budget =
  `heroCount + 2`), per-leg `cleared` + `lastPlayedAt`, and `isChampion` —
  **all computed at read time** via the WP-442 truth helper, nothing stored.
- **`PATCH`** edits a run's `leg_picks` (structural validation only — hero-id
  legality is a launch-time concern); **`DELETE`** removes a run. Every
  handler is scoped by the resolved `player_id` (cross-account isolation) and
  sets `Cache-Control: no-store`.

The row-by-row request/response contract is in
[`api-endpoints.md`](../docs/ai/REFERENCE/api-endpoints.md).

### Play primitive + tracker UI (WP-448 / D-24268 · WP-449 / D-24269)

`launchMatchFromComposition`
([`useCreateMatchFromComposition.ts`](../apps/arena-client/src/lobby/useCreateMatchFromComposition.ts))
is a single reusable **create → join** launch chain, shared by the lobby and
the tracker. The `?route=me` **Gauntlet runs** section
([`MyProfilePage.vue`](../apps/arena-client/src/pages/MyProfilePage.vue))
renders import (file **and** paste), an **active-run card** (status badge,
pool + budget headroom, per-leg rows showing each leg's hero picks and a
**"Play this leg"** button), the derived **"where you left off"** leg, and
completed history.

The two "every leg won" states are **visibly distinct**:
**`all-legs-cleared`** (amber) means every leg was won but the winning teams
draw from more heroes than the one budgeted pool allows — trim to a legal
pool to claim the title; **`champion`** (green trophy) means a single
budget-valid pool cleared them all. The status ladder tests `champion`
before `all-legs-cleared` so a claimed championship is never masked.

**"Play this leg"** assembles a `MatchSetupConfig` from the run's picked
heroes plus a **server-supplied `launch` block** — the variant-0 villains /
henchmen and the canonical `GAUNTLET_LEG_STANDARD_SUPPLY` supply-stack counts
(`{ bystanders: 30, wounds: 30, officers: 30, sidekicks: 15 }`) — because the
arena client cannot import the registry. On gameover the existing
submit-on-gameover watcher records the score, and the next tracker read
re-derives the run's progression.

### Live-verification

The arc is merged to `origin/main` (WP-449 = PR #1073). Per the **D-24026**
gate, "done" means user-observable on the deployed surface
(`play.legendary-arena.com` `?route=me`); the tracker's live-verification
follows that gate. Until an authenticated player finishes winning matches,
both the public gauntlet standings and a personal run's cleared legs stay
empty — the loop is wired end-to-end and waiting on **data supply**, the same
precondition the public boards have.

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
  (board review, 2026-07-09 — FIXED by WP-343 / D-24135 the same day).**
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
- **The DB-gated server test baseline is green (since 2026-07-09,
  PR #630).** CI never sets `TEST_DATABASE_URL`, so the DB-backed
  `apps/server` tests only run locally — and 11 pre-existing failures had
  rotted invisibly, 7 of them in the WP-054 leaderboard read-layer tests
  ([`leaderboard.logic.test.ts`](../apps/server/src/leaderboards/leaderboard.logic.test.ts)).
  The failures were fixture drift, not read-layer bugs: the WP-054-era
  `seedScore` helper predated the D-24119-arc submission contract
  (`updateReplayVisibility` no longer returns an `{ ok, value }` envelope,
  and submission now rejects `'private'` visibility outright per D-5302 —
  a private fixture must submit as `'public'` and retract afterwards,
  which is also the production path the visibility-exclusion tests
  actually exercise, since the read layer filters on *current* ownership
  visibility). With the repair the full DB-wired suite runs serialized at
  848/848 pass / 0 skipped, so any future DB-gated failure is a
  regression, not carried-forward baseline rot.
- **Cross-version comparison is never silent.** Rows carry a
  `scoringConfigVersion`; any PAR or weight change increments it, and rows
  under different versions are not directly comparable (VISION §22). Any
  championship aggregation must filter by version.
- **Published PAR baselines are player-count-blind (known gap).** The
  scoring spec ([`docs/12-SCORING-REFERENCE.md`](../docs/12-SCORING-REFERENCE.md)
  §Player Count Adjustment) defines a per-count PAR term, but the
  implemented `parScoring` pipeline does not apply it — a solo run and a
  5-player run are scored against the same baseline today, so their
  scores are not comparable. D-24134 makes the comparison structurally
  impossible on the boards (one board per player count) rather than
  pretending the numbers are commensurate; per-count PAR calibration
  remains future work, and landing it is a `scoringConfigVersion` bump
  handled as an archival rollover (D-24131 §5).
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
> (set × mastermind) for every set with ≥1 scheme (110 boards at current
> data; `dims`/`3dtc` excluded); legs = the set's schemes; **wins only**
> (a new `outcome` column on `competitive_scores`, written at submission);
> best score per leg, any villain groups; entry = complete gauntlets only,
> ranked by total (= average) of best legs; rows must carry the
> currently-published `scoringConfigVersion` (VISION §22); **no submission
> step** — standings are a publisher-derived aggregation; snapshots
> `gauntlet-<setAbbr>-<mastermindSlug>.json` + a `gauntlet-index.json`
> catalog + additive manifest fields. The full decided behavior now lives
> under [Gauntlets](#gauntlets--the-per-mastermind-set-championships-d-24131--d-24134--d-24187)
> in Mechanics — this callout is the historical pointer, not the spec.
> WP-343 (the legends-board index + gauntlet panel) executed 2026-07-09;
> the profile-progress surfaces remain backlogged. **D-24134**
> (2026-07-09) extended the decided design with player-count boards
> (1–5), roster-keyed multiplayer entries naming every teammate's handle,
> and per-leg challenge links — WP-344 / WP-345 drafted, pending
> execution. Tiers 1, 3, 4 and the annual reset below remain **proposals**.

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

### Hero requirements — the fixed-hero-pool gauntlet (SHIPPED 2026-07-16, D-24187)

> **Shipped and live (2026-07-16).** This started as the operator's
> 2026-07-16 hero-requirements recommendation, was ratified the same day
> by **D-24187**, and both packets executed and deployed that day:
> [WP-384](../docs/ai/work-packets/WP-384-fixed-hero-pool-gauntlet-server.md)
> (server — `team_key` persistence + pool-constrained standings +
> publisher, PR #784) and
> [WP-385](../docs/ai/work-packets/WP-385-fixed-hero-pool-gauntlet-client.md)
> (client — the division toggle + hero-pool display, PR #787,
> D-24026 live-verified on `legends.legendary-arena.com`). The design
> narrative below is preserved as the reasoning trail; the **live
> behavior** is summarized under
> [Fixed-hero-pool division](#fixed-hero-pool-division-d-24187) in
> Mechanics, and D-24187 is the authoritative spec. Two things landed
> exactly as the review predicted: the fork resolved to **parallel
> divisions** (the open gauntlet stays byte-unchanged as the acquisition
> surface; the fixed-pool board sits beside it as the prestige division
> the championship title attaches to), and the pool budget is **exactly
> `heroCount + 2`** (a binary check — the union of heroes across an
> entry's legs fits the budget or it does not).

**The recommendation: a gauntlet entry must be earned with a fixed hero
group plus 1–2 alternates.** To claim a set's mastermind championship, a
player clears every leg (every scheme in the set, vs that mastermind)
using one core hero group, with at most 1–2 pre-chosen alternate heroes
available to swap in for legs that hard-counter the core. "Any heroes
per leg" — cherry-picking a fresh counter-team for each scheme — would
no longer earn the championship.

**Why fixed-pool is the "legendary" format.** This is a classic
community challenge shape in the physical game (fixed-roster campaign
clears, "best team for all masterminds" formats), and it aligns with
what the platform already claims to reward:

- **It proves mastery, not lookup skill.** One versatile team that
  survives every scheme in a set — different twist pressures, different
  always-leads villains, different class/keyword demands — demonstrates
  system knowledge and consistency. Per-leg counter-picking mostly
  demonstrates access to a tier list.
- **It fits the Hall of Legends' prestige framing.** A fixed-team set
  clear is a notable, reproducible achievement worth a named board row;
  open-selection wins are just normal play (which the per-scenario
  boards already rank).
- **Alternates absorb the hard cases without collapsing the format.**
  Most schemes fall to a good core group; the 1–2 alternates cover the
  rare hard counter (a scheme that punishes a missing class or demands
  a specific keyword) without reverting to open selection.

**Formalization (player-count-relative).** The hero-deck size is not
always 5 — it is enforced per player count by the registry's setup
table ([`playerCountSetup.ts`](../packages/registry/src/playerCountSetup.ts),
D-24165): solo = 3 heroes, 2–4 players = 5, 5 players = 6. Since
gauntlet boards are already per-player-count (D-24134), each board has
a well-defined core size, and the rule generalizes as:

> An entry qualifies when there exists a **hero pool** of at most
> `heroCount + 2` heroes (the board's hero-deck size plus two
> alternates) such that every chosen leg's winning replay drew its
> entire hero deck from that pool. Equivalently: the union of hero
> slugs across the entry's legs is ≤ `heroCount + 2`.

No declaration step is needed — like D-24131, this stays a
publisher-derived aggregation with no submission ceremony. The
publisher searches the player's qualifying wins for a
pool-satisfying assignment (see the optimization note below).

**Terminology guard:** "roster" already means the *player-account* team
on multiplayer boards (D-24134 roster-keyed entries). The hero
constraint is a separate dimension — call it the **hero pool**, never
the roster. On a multiplayer board an entry would need both: the same
account roster on every leg (shipped D-24134 rule) *and* a shared hero
pool across legs (this proposal).

**Feasibility review (2026-07-16).** Cheap, but not free:

- **The engine identity already exists.** `buildTeamKey`
  ([`parScoring.keys.ts`](../packages/game-engine/src/scoring/parScoring.keys.ts))
  produces the canonical sorted-hero-slug `TeamKey`, and the
  engine-defined `LeaderboardEntry` contract already carries a
  `teamKey` field. No engine change is required — consistent with the
  championship posture that gauntlet tiers are derived aggregations.
- **But the server never persisted it.** `legendary.competitive_scores`
  has no team column — rows carry `scenario_key` but not the heroes
  used. Enforcement needs an additive migration (a `team_key` column
  written at submission time; the server already holds the replay's
  `initialState`, whose `matchConfiguration.heroDeckIds` is the hero
  deck, when it re-reduces the artifact) plus a one-time backfill of
  existing rows from `bgio.replay_artifacts`.
- **Constrained best-per-leg is a small optimization, not a lookup.**
  Under D-24131 the best score per leg is independent; under a shared
  pool, leg choices interact (the best win on leg A may use heroes that
  blow the pool budget for leg B). In practice a player posts few
  distinct `TeamKey`s per set, so the publisher can brute-force the
  best pool-satisfying assignment over those; a guard cap on distinct
  teams considered keeps the cycle bounded.

**The open fork — replace or run parallel.** Two ways to ship this,
and the choice is the real decision a D-entry must make:

1. **Replace** — fixed-pool becomes *the* gauntlet entry rule, amending
   D-24131's "best per leg, any heroes" semantics. Strongest identity
   for the championship, but it raises the entry bar while every board
   is still in the empty-board acquisition phase, and it invalidates
   (or re-derives) any entries earned under the open rule.
2. **Parallel divisions** — the shipped open gauntlet stays as the
   acquisition surface, and the fixed-pool board lands beside it as
   the prestige division (visually distinguished; arguably the only
   division that confers the "champion" title). Preserves the shipped
   decision, keeps the on-ramp, and open-division entries remain a
   feeder ("you've cleared all legs — now clear them with one team").

**Where open selection still lives, either way.** The per-scenario
(`ScenarioKey`) boards remain open-selection — first clears of a new
set, casual play, wild-synergy experiments, and pure per-scenario score
optimization all still rank there. The hero requirement only governs
what it takes to claim a **set championship**.

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
- [WP-344](../docs/ai/work-packets/WP-344-player-count-gauntlet-boards-server.md)
  + [WP-345](../docs/ai/work-packets/WP-345-player-count-gauntlet-client.md)
  + DECISIONS.md **D-24134** — the player-count extension (per-count
  boards, roster-keyed multiplayer entries, challenge links); drafted
  2026-07-09, pending execution
- [Scoring](scoring.md), [PAR Simulation Calibration](par-simulation-calibration.md)
  — companion wiki pages for the scoring internals
