---
title: Data & File Locations
type: Guide
tags:
  - data-pipeline
  - persistence
  - storage
  - findability
  - governance
related:
  - workspace-map.md
  - architecture-inventory.md
  - r2-image-naming-convention.md
  - lagn-v1.md
  - card-type-taxonomy.md
  - profile-login.md
  - operational-health-checks.md
  - complete-game-fixtures.md
  - music-authoring.md
  - blog-post-authoring.md
  - hugo-web-system.md
status: draft
source:
  - C:\dev\legendary-arena\wiki\data-file-locations.md (this page — https://ewiki.legendary-arena.com/data-file-locations/)
  - ../docs/01-REPO-FOLDER-STRUCTURE.md
  - ../docs/ops/DOMAINS.md
  - ../docs/ai/REFERENCE/00.2-data-requirements.md
  - ../packages/registry/src/heroImageUrl.ts
  - ../apps/server/src/profile/avatarUpload.logic.ts
  - ../render.yaml
  - legendary-arena/legendary-arena-lab infra/scripts (the API droplet, production since 2026-10-12)
  - C:\www\README.md (operator's machine-level notes, folded in 2026-10-17)
  - ../.github/workflows/wiki-viewer.yml
  - C:\www\legendary-arena-com\ (marketing repo — content/blog/, static/images/blog/)
last-reviewed: 2026-10-17
---

# Data & File Locations

## Summary

A single locator map for "where does *X* live?" — first at the machine
level (the three local roots, the git checkouts, and which source builds
which `legendary-arena.com` site), then inside the engine repo: card
data, metadata, the database schema, Cloudflare R2 object storage,
replays, LAGN, env/config, and the docs/coverage data dirs — plus a
trace of how one published file travels from a pCloud draft to the live
site, copy by copy. It is a
**navigation hub**: for each subsystem it gives the path and points at
the deep page that owns the detail. It does not restate those pages or
make any decision — the authoritative locations are the code, the
migrations, [`docs/ops/DOMAINS.md`](../docs/ops/DOMAINS.md) for
hostnames, and the pages cited here.

## Mechanics

### Start here — local roots, repos, and public sites

The workstation's local paths have one source of truth,
`C:\pcloud\legendary-arena\README.md`, published as the
[Legendary Arena System Map](legendary-arena-system-map.md). The tables
below summarize it for this page; when they differ, the README wins.

**Local roots on the workstation.** Three top-level folders, split by
what the files are and how they are kept safe:

| Root | Holds | Kept safe by |
|------|-------|--------------|
| `C:\www\` | Website checkouts — the marketing repo and other published-content sites | GitHub (push); deployed to Cloudflare |
| `C:\dev\` | Code checkouts — engines, libraries, tools. The engine monorepo lives at `C:\dev\legendary-arena` (moved off pCloud 2026-10-17); the shared tools (the lab, the wiki theme, the dashboard) moved here 2026-10-18 | GitHub (push) |
| `C:\pcloud\` | Business records, staging, work-in-progress docs, media masters. Legendary Arena's working root is `C:\pcloud\legendary-arena\` | pCloud sync |

**Two kinds of backup, never mixed.** GitHub is the backup for anything
in a git repo — push is what makes code durable. pCloud is the backup
for work-in-progress files that are not in git. A git checkout does not
belong on pCloud: pCloud syncs the `.git` folder too, and the two clash.

The engine monorepo broke that rule until 2026-10-17, when it moved off
the sync drive to `C:\dev\legendary-arena` (operator decision; see
[Workstation Layout Migration](workstation-layout-migration.md)). See
[Workspace Map](workspace-map.md) for what belongs in each pCloud folder.

**Git checkouts that make up Legendary Arena:**

| Local path | GitHub remote | What it is |
|------------|---------------|------------|
| `C:\dev\legendary-arena` | `barefootbetters/legendary-arena` | **The engine monorepo** — engine, API server, every Vue app, card data, and this wiki's source. The canonical checkout (off pCloud since 2026-10-17). |
| `C:\www\legendary-arena-com` | `legendary-arena/legendary-arena-website` | Hugo marketing site and blog → `www.legendary-arena.com`. |
| `C:\dev\legendary-arena-lab` | `legendary-arena/legendary-arena-lab` | API droplet provisioning (`infra/scripts/NN-*.ps1`) and the droplet side of the server deploy. |
| `C:\dev\bb-studio-ewiki-theme` | `barefootbetters/bb-studio-ewiki-theme` | Shared Hugo theme the wikis build with (D-24728). |
| `C:\dev\bb-studio-dashboard` | `barefootbetters/bb-studio-dashboard` | The shared operator dashboard (D-24723); Legendary Arena becomes an instance of it after parity. |
| ~~`C:\www\legendary-arena`~~ | `barefootbetters/legendary-arena` | **Deleted 2026-10-17** (migration Phase 6c). It was a stale second clone; every branch was merged or superseded on GitHub first. |

The apps (`arena-client`, `registry-viewer`, …) are folders under
`apps/` in the engine monorepo, not repositories of their own.

**Public sites — which source builds which hostname.** The authoritative
table and probe runbook is [`docs/ops/DOMAINS.md`](../docs/ops/DOMAINS.md)
(machine-readable `docs/ops/domains.json`, probed by
`scripts/check-subdomains.mjs`). Snapshot at this revision:

| Hostname | What it is | Source | Hosted on | Access |
|----------|-----------|--------|-----------|--------|
| `www.legendary-arena.com` | Marketing site + blog (Hugo) | `C:\www\legendary-arena-com` | Cloudflare Pages | Public; the apex `legendary-arena.com` 301s here |
| `play.legendary-arena.com` | Game client (Vue 3 SPA) | `apps/arena-client` | Cloudflare Pages | Public |
| `cards.legendary-arena.com` | Card database / browser (Vue 3 SPA) | `apps/registry-viewer` | Cloudflare Pages | Public; reads the R2 `metadata/` mirror, not the repo |
| `legends.legendary-arena.com` | Public scoreboard / attract board (Vue 3 SPA) | `apps/legends-board` | Cloudflare Pages | Public |
| `api.legendary-arena.com` | Game server REST + Socket.IO, with its PostgreSQL | `apps/server` | DigitalOcean droplet behind Cloudflare (since 2026-10-12) | Public API |
| `dashboard.legendary-arena.com` | Admin dashboard (Vue 3 SPA) | `apps/dashboard` | Cloudflare Worker | **Private** — Cloudflare Access |
| `ewiki.legendary-arena.com` | This engineering wiki (Hugo) | `apps/wiki-viewer` building `wiki/` | Cloudflare Worker | **Private** — Cloudflare Access |
| `images.legendary-arena.com` | Card images, avatars, audio, metadata mirror | R2 bucket `legendary-images` | Cloudflare R2 + CDN | Public per key, e.g. `/mdns/mdns-hr-blade-daywalker-ride-by-moonlight.webp` |
| `wiki.legendary-arena.com` | Public player wiki | not yet authored | Cloudflare Pages | Planned |

Every hostname is hyphenated — `legendary-arena.com`, never
`legendaryarena.com`.

### Card data and the convert pipeline

Game-ready card data is one JSON file per set under
[`data/cards/`](../data/cards/) (41 sets). **Most** files are
**generated**, not hand-edited — the multi-stage pipeline under
[`scripts/convert-cards/`](../scripts/convert-cards/) produces them
(see the `co2e` exception below):

| Stage | Script | What it does |
|-------|--------|--------------|
| 1 | `convert-cards-v15.mjs` | Reads the upstream set sources under `scripts/convert-cards/inputs/cards/`, assigns the card-type ribbon, composes each card's `imageUrl`, writes `data/cards/{setAbbr}.json`. |
| 2 | `apply-card-counts.mjs` | Attaches per-hero `cardCounts` from `scripts/convert-cards/inputs/hero-card-counts.json`. |
| 3 | `apply-hero-ability-markers.mjs` | Marks hero abilities with metadata (scaling, free activations). |
| 4 | `apply-effect-markers.mjs` | Applies effect / follow-up-taxonomy markers used by coverage tooling. |
| 5 | `apply-defeat-requirement-markers.mjs` | Appends `[require-to-defeat:…]` markers ("can't defeat X unless you have a [class] Hero") from `inputs/villain-defeat-requirements.json`. |

Four outlier sets (`2099`, `amwp`, `wpnx`, `wtif`) have no stage-1 source
and are produced by `apply-card-counts.mjs` alone. Full stage order:
[`docs/03-DATA-PIPELINE.md`](../docs/03-DATA-PIPELINE.md).

Running only stage 1 regresses the data — the marker stages must run in
order. The image-URL convention each card carries is documented in full
on [R2 Image Naming Convention](r2-image-naming-convention.md).

> **Exception — `co2e` is hand-maintained.** Core Set 2nd Edition has no
> upstream source in the sibling `modern-master-strike` repo and no entry
> under `scripts/convert-cards/inputs/cards/`, so
> [`data/cards/co2e.json`](../data/cards/co2e.json) is **authored directly
> and never regenerated** by the pipeline. Hand-editing it is the correct
> workflow; running the converter would not reproduce it. Its `abbr` is
> likewise absent from the hardcoded `SET_ABBR_MAP` in
> `convert-cards-v15.mjs` — harmless while no co2e source is converted, but
> it must be added before one ever is (see
> [R2 Image Naming Convention](r2-image-naming-convention.md)).

### Card metadata and taxonomy

Taxonomy, keyword, rules, and pattern JSON live under
[`data/metadata/`](../data/metadata/):

- `sets.json` — expansion-set registry.
- `card-types.json` — in-repo Registry-Viewer taxonomy (type list; **no**
  image-ribbon prefixes — see [Card Type Taxonomy](card-type-taxonomy.md)
  and the Edge Cases below).
- `card-mechanics.json`, `keywords-full.json`, `rules-full.json` —
  mechanic text, keyword definitions, authoritative rule text.
- `*-patterns.json` / `*-pattern-assignments.json` — hero / villain /
  mastermind / scheme-twist / henchman behavioural patterns.

[`data/load_legendary_data.mjs`](../data/load_legendary_data.mjs) loads
this metadata into PostgreSQL at startup.

### Database (PostgreSQL, schema `legendary`)

All tables live in the `legendary` schema. Migrations are numbered SQL
files under [`data/migrations/`](../data/migrations/) (`001`…`046` at this
revision). Canonical field-name rules:
[00.2-data-requirements.md](../docs/ai/REFERENCE/00.2-data-requirements.md).

| Domain | Tables |
|--------|--------|
| Card / rules reference | `sets`, `masterminds`, `villain_groups`, `schemes`, `rules`, `rule_docs`, `source_files` |
| Identity & profile | `players` (the `ext_id` UUID / `email` / `auth_provider`), `player_profiles`, `player_links` |
| Replays | `replay_blobs` (content-addressed), `replay_ownership` |
| Teams | `teams`, `team_member_events`, `team_audit_log` |
| Commerce | `entitlements`, `stripe_events`, `stripe_checkout_sessions`, `competitive_scores` |
| Operations / telemetry | `player_badges`, `admin_actions`, `analytics_events`, `sweep_runs`, `inspection_reports`, `finding_handoffs` |

> The table list grows with each migration — treat the count above as a
> snapshot and verify against `data/migrations/` before relying on it.

### Object storage (Cloudflare R2)

Bucket: **`legendary-images`** (rclone remote `r2:legendary-images`).
Binaries live in R2; their metadata lives in Postgres — never the
reverse. Key prefixes:

| Prefix | Contents | Host constant |
|--------|----------|---------------|
| `{setAbbr}/{setAbbr}-{ribbon}-{slug}.webp` | Card images, per-set directory | `R2_BASE_URL` → `images.legendary-arena.com` ([`heroImageUrl.ts`](../packages/registry/src/heroImageUrl.ts)) |
| `avatars/{accountId}.webp` | Player avatars, keyed by immutable AccountId | `AVATAR_CDN_BASE` → `images.legendary-arena.com` ([`avatarUpload.logic.ts`](../apps/server/src/profile/avatarUpload.logic.ts)) |
| `metadata/{abbr}.json`, `metadata/sets.json`, `metadata/card-mechanics.json`, … | Flat mirror of the card + metadata JSON — **the Registry Viewer's live data source** | **manual `rclone copy`** — no automated sync (see below) |
| `themes/` | Gameplay UI themes from [`content/themes/`](../content/themes/) | [`scripts/upload-themes-to-r2.mjs`](../scripts/upload-themes-to-r2.mjs) |
| `audio/themes/…mp3`, `audio/heroes/…mp3` | Per-theme (`MT01`–`MT04` music + `ES01`–`ES04` event stings) and per-hero (`MT01`–`MT04`) music, 320 kbps MP3 — the **sole** audio surface | interim on `legendary-images` → `images.legendary-arena.com/audio/…`; production target `music.barefootbetters.com` (not live) — see [Music Authoring](music-authoring.md) |
| `legends/…json` | Legends Snapshot Publisher output (separate `R2_LEGENDS_BUCKET`) | the API droplet's `/etc/la/.env` (names inventoried in `render.yaml`) |

R2 credentials are **not committed**: local `.env` carries
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`; production injects
`R2_*` secrets from the API droplet's root-only env file `/etc/la/.env`
(the Render dashboard until the 2026-10-12 cutover). Reachability is probed by
`pnpm check` (see [Operational Health Checks](operational-health-checks.md)).

### Music and audio

Audio has a **single delivery surface: R2.** The published 320 kbps MP3
derivatives — per-theme (`MT01`–`MT04` music plus `ES01`–`ES04` event
stings) and per-hero (`MT01`–`MT04`) — live under the `audio/` prefix
above and are the only audio the app fetches. **Nothing audio is
committed to git.** Only the crop scripts, the authoring guide, and the
`content/themes/*.json` `musicAssets.*Url` references are tracked; the
WAV masters and their local MP3 derivatives are working binaries that
live on pCloud (`C:\pcloud\legendary-arena\audio\`), never in the repo tree and never
uploaded as masters — see [Workspace Map](workspace-map.md). To avoid a
per-cue R2 round-trip on time-critical stings (e.g. master-strike), the
arena client **prefetches a theme's stings into decoded audio buffers at
match start** rather than bundling audio into the build. Full pipeline:
[Music Authoring](music-authoring.md).

### Replays and LAGN

- **Replays** persist in Postgres, content-addressed by hash:
  `legendary.replay_blobs` (immutable blob) + `legendary.replay_ownership`
  (player ↔ hash + visibility/retention). Server API:
  [`apps/server/src/identity/replayOwnership.logic.ts`](../apps/server/src/identity/replayOwnership.logic.ts).
- **LAGN** (Legendary Arena Game Notation) is the published interchange
  spec in [`packages/lagn-spec/`](../packages/lagn-spec/) — full detail on
  [LAGN Specification](lagn-v1.md). Client-side loadout parsing lives
  in [`apps/arena-client/src/lobby/`](../apps/arena-client/src/lobby/)
  (`lagnLoadout.ts` → `parseLoadoutJson.ts`).

### Packages and apps

| Path | Role |
|------|------|
| `packages/game-engine/` | Gameplay rules, moves, phases, zone ops, determinism. |
| `packages/registry/` | Card-data access layer (loads metadata + card JSON). |
| `packages/lagn-spec/` | LAGN validator + schema (npm; `lagn` CLI). |
| `packages/preplan/` | Non-authoritative per-client pre-planning model. |
| `packages/vue-sfc-loader/` | Test-time Vue SFC loader hook (dev/test only). |
| `apps/server/` | boardgame.io server + REST API + persistence wiring. |
| `apps/arena-client/` | Gameplay client SPA (`play.legendary-arena.com`). |
| `apps/dashboard/` | Internal admin dashboard SPA (`dashboard.legendary-arena.com`). |
| `apps/registry-viewer/` | Card browser (`cards.legendary-arena.com`). |
| `apps/legends-board/` | Public read-only Legends scoreboard (`legends.legendary-arena.com`). |
| `apps/engine-runner/` | Headless bot-vs-bot simulation runner CLI (D-24088). |
| `apps/replay-producer/` | CLI that emits deterministic replay sequences. |
| `apps/wiki-viewer/` | Hugo build of this wiki (`ewiki.legendary-arena.com`). |

### Config, env and deploy

- [`.env.example`](../.env.example) — template listing every required
  variable (`DATABASE_URL`, `JWT_SECRET`, `HANKO_*`, `STRIPE_*`,
  `R2_*` / `AWS_*`, `BREVO_*`, `VITE_*`, …). The real `.env` values are
  injected per-environment and are **not** committed.
- [`render.yaml`](../render.yaml) — the retired Render blueprint
  (`legendary-arena-server`, `legendary-arena-db`; production until
  2026-10-12). It no longer governs production, but stays as the inventory of
  `sync: false` secret names.
- `/etc/la/.env` on the API droplet — the production server's secrets
  (root-only, mode 600) since 2026-10-12; provisioning lives in the
  `legendary-arena-lab` repo (see
  [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md)).
- [`apps/wiki-viewer/wrangler.jsonc`](../apps/wiki-viewer/wrangler.jsonc) and
  [`apps/dashboard/wrangler.jsonc`](../apps/dashboard/wrangler.jsonc) — the
  assets-only Cloudflare Workers that serve the ewiki and the dashboard
  (D-24690).
- [`.claude/`](../.claude/) — Claude Code harness config, rules, and skills.

### Docs, decisions and coverage data

- [`docs/`](../docs/) — product/architecture docs:
  [01-REPO-FOLDER-STRUCTURE.md](../docs/01-REPO-FOLDER-STRUCTURE.md) (the
  directory map), `02-ARCHITECTURE.md`, `12-SCORING-REFERENCE.md`,
  `13-REPLAYS-REFERENCE.md`, [10-GLOSSARY.md](../docs/10-GLOSSARY.md), and
  the Marvel Legendary universal-rules text/PDF.
- [`docs/ai/`](../docs/ai/) — `DECISIONS.md` (`D-NNNNN`), `ARCHITECTURE.md`,
  `work-packets/` (`WP-NNN`), `execution-checklists/` (`EC-NNN`),
  `REFERENCE/` (locked reference docs incl.
  [00.2-data-requirements.md](../docs/ai/REFERENCE/00.2-data-requirements.md)
  and `api-endpoints.md`).
- [`docs/ai/coverage/`](../docs/ai/coverage/) — generated effect/mechanic
  ledgers (`hero-mechanic-ledger.{json,csv}`,
  `villain-mechanic-ledger.{json,csv}`, `runtime-observed-hollows.json`).
- [`wiki/`](../wiki/) — this engineering wiki ([INDEX.md](INDEX.md) lists
  every page).

### One file's journey: draft to live site (the six copies)

The sections above say where a file sits once it has landed. This traces
how a published file gets there. The worked example is a blog post,
`dog.md`, with its image `dog.jpg`, on the marketing site. That is the
lane where the whole chain can be seen end to end. The file moves
**forward one surface at a time and is never copied backwards**:

| # | Copy | Where it lives | Who changes it |
|---|------|----------------|----------------|
| 1 | Draft | pCloud drafts folder on the laptop (`C:\pcloud\…`) | You — authoring |
| 2 | pCloud mirror | pCloud's cloud copy of #1 | pCloud sync |
| 3 | Repo working copy | `C:\www\legendary-arena-com\`: `content/blog/<slug>.md` + `static/images/blog/<slug>/dog.webp` | You — the last copy you ever edit |
| 4 | GitHub | `legendary-arena/legendary-arena-website`, after push + PR merge | git |
| 5 | Build output | `public/`, generated by Hugo inside the Cloudflare Pages build | The build — regenerated every deploy |
| 6 | Live | Cloudflare's edge, serving `www.legendary-arena.com/blog/<slug>/` | Cloudflare |

Three rules carry the whole workflow:

- **Move, don't copy, at #1 → #3.** When the post goes into the repo, the
  drafts copy is removed from pCloud. From that point GitHub (#4) is the
  post's backup, and pCloud's job for that post is over. If you keep two
  live drafts, you end up guessing which one is current.
- **Only #1 and #3 are hand-edited.** Everything from #4 onwards is
  produced by a push or a build. A correction goes in at #3 and flows
  forward. An edit made to `public/` or to the live site is wiped by the
  next build.
- **Images and markdown take the same path. They differ only at #5.** Hugo
  copies `static/` into `public/` verbatim, so the image arrives byte for
  byte as committed. Markdown is compiled: `content/blog/<slug>.md` becomes
  `public/blog/<slug>/index.html`. The source is always markdown, and the
  web only ever sees HTML.

The ewiki runs the same chain, but its storage is arranged differently.
See the Edge Cases. Card data and card art do **not** follow this chain:
they publish to R2 (see [Object storage](#object-storage-cloudflare-r2)),
not through a Hugo build.

## Interactions

- **[R2 Image Naming Convention](r2-image-naming-convention.md)** owns the
  card-image filename rules; this page only points at the `data/cards/`
  and R2 locations.
- **[LAGN Specification](lagn-v1.md)** owns the game-notation format;
  this page locates the package and the client parser.
- **[Card Type Taxonomy](card-type-taxonomy.md)** owns the type list backing
  `data/metadata/card-types.json`.
- **[Profile Login](profile-login.md)** owns the identity/auth detail behind
  the `players` / `player_links` tables and the `avatars/` prefix.
- **[Operational Health Checks](operational-health-checks.md)** owns the
  probes that verify the PostgreSQL / R2 / Hanko connections this map names.
- **[Workspace Map](workspace-map.md)** owns which storage surface (pCloud,
  git, hosted) a kind of file belongs on; the six-copy journey above is
  how a file crosses those surfaces.
- **[Blog Post Authoring](blog-post-authoring.md)** owns the marketing
  repo's content lane — front matter, image budgets, the PR + preview step
  between copies #3 and #4.

## Edge Cases

- **One image host (avatar/card split resolved, WP-296 / D-24083).** Card
  images (`R2_BASE_URL`) and player avatars (`AVATAR_CDN_BASE`) both now
  resolve to `images.legendary-arena.com`, two host constants over the same
  `legendary-images` bucket. Avatars were historically on the legacy
  `images.barefootbetters.com` host; WP-296 unified them (constant swap +
  migration 021 rewriting existing `avatar_url` rows). Any remaining
  `images.barefootbetters.com/avatars` reference is stale. (The
  `/metadata` and `/docs` surfaces followed on 2026-07-16: all live repo
  references now point at `images.legendary-arena.com`; the legacy host
  remains a live alias on the same bucket, no redirect.)
- **Two `card-types.json` files.** The in-repo
  `data/metadata/card-types.json` is the Registry-Viewer taxonomy with **no**
  image-ribbon prefixes; the authoritative prefix registry is the *upstream*
  `modern-master-strike/src/data/card-types.json` (sibling repo). See
  [R2 Image Naming Convention](r2-image-naming-convention.md).
- **`03-DATA-PIPELINE.md` was stale and is current again.** It once
  described a single converter; since PR #1780 it documents the full
  multi-stage `scripts/convert-cards/` chain and is the place to check
  stage order. Older copies of this page called it stale.
- **There used to be two clones of the engine repo.** A stale second
  clone at `C:\www\legendary-arena` shared the engine remote but was far
  behind `main`, so a search across `C:\www\` could return superseded
  files; it was deleted on 2026-10-17. The canonical checkout is `C:\dev\legendary-arena`, where the engine moved
  off pCloud on 2026-10-17 (operator decision). That location replaces the
  `C:\www\legendary-arena` target named in D-24208's rationale, which was
  where the stale clone sat, and follows the `C:\dev\` = code convention.
- **`legends.` is the scoreboard, and `ewiki.` is private.** The Legends
  board is a Vue SPA showing competitive standings, not a lore site, and
  the engineering wiki sits behind Cloudflare Access — a 302/401/403 from
  either gated host is the healthy response, not an outage.
- **The R2 `metadata/` mirror is synced by hand — a repo commit changes
  nothing the viewer shows.** The Registry Viewer fetches
  `{metadataBaseUrl}/metadata/sets.json` and `/metadata/{abbr}.json` from R2
  at startup; it never reads `data/cards/` or `data/metadata/` from the repo.
  There is **no** CI job or deploy hook that publishes them — the mirror is
  updated only by an explicit `rclone copy`. Two practical consequences:
  (a) after editing card data, `rclone copyto data/cards/{abbr}.json
  r2:legendary-images/metadata/{abbr}.json` (and `card-mechanics.json` /
  `sets.json` if they changed) or the change is invisible on
  `cards.legendary-arena.com`; (b) the mirror can legitimately run *ahead of*
  or *behind* `main`, so a viewer/repo mismatch is a sync gap, not a bug.
  Registering a set in `sets.json` without also mirroring it means its cards
  load but it is missing from the set index.
- **25 card names are stored in sort-order form — this is upstream, not a
  bug, and it is fixed at display time (swept 2026-07-18).** Twenty-five
  names across twenty sets end with a trailing article: `"Legacy Virus,
  The"`, `"Dark Phoenix Saga, The"`, `"Hood, The"`. The count is exactly
  1:1 with `scripts/convert-cards/inputs/cards/*.js`, so the converter is
  passing upstream data through faithfully. The hand-authored `co2e` set is
  the **only** set using natural order, which is what makes the corpus look
  inconsistent — it is one convention with one exception, not 25 defects.
  Five are masterminds, so the form also appears in published board names
  and slugs: `gauntlet-cosm-beyonder-the`, `gauntlet-cosm-grandmaster-the`,
  `gauntlet-rvlt-hood-the`, `gauntlet-wwhk-red-king-the`,
  `gauntlet-wwhk-sentry-the`.

  **Renaming the data was considered and rejected.** `data/cards/` is
  generated, so the edit would land in `inputs/cards/*.js` and require a
  full four-stage pipeline re-run plus regeneration of every card-data-derived
  gate feed. Card names reach `G.cardDisplayData`, and `computeStateHash`
  intentionally hashes the full `G` (see the note at
  [`game.ts`](../packages/game-engine/src/game.ts) ~L496) — so a rename
  re-pins both the sentinel `finalStateHash` and `PRE_WP080_HASH`. And the
  slugs could not move regardless: they are the set-qualified competitive id
  space (D-10014), embedded in `scenario_key`s, replay artifacts, and the
  five board names above. Paying that cost still leaves the URLs reading
  `-the`.

  **The fix is display-only:** `formatCardDisplayName()` in
  [`gauntletDisplay.ts`](../apps/legends-board/src/panels/gauntletDisplay.ts)
  restores natural order at render time. Never feed its output back into an
  id, slug, link, or lookup key. To re-run the sweep:

  ```bash
  grep -rhoE 'name: *"[^"]*, (The|A|An)"' scripts/convert-cards/inputs/cards/*.js | sort -u
  ```

  Note the inputs are `.js` with **double**-quoted values — scanning them as
  JSON, or with a single-quote pattern, silently returns zero.
- **Snapshots are not the migration list.** The table inventory and migration
  count are a point-in-time snapshot; both grow. `data/migrations/` is the
  source of truth.
- **pCloud conflict files.** Until 2026-10-17 this repo lived on a
  pCloud-synced path, which spawned `… [conflicted N].json` siblings; the
  un-suffixed file is canonical. Any that survive in history are leftovers
  from that era.
- **Secrets are never in the repo.** `.env` and the droplet's `/etc/la/.env` hold all
  credentials; the committed `.env.example` is only the shape.
- **A post and its images go into two trees, not one folder (six-copy
  journey, #3).** The marketing site does not use Hugo page bundles. The
  markdown goes into `content/blog/<slug>.md`. The images go into
  `static/images/blog/<slug>/`, and that directory name must match the
  slug exactly. The two travel together in **one commit**, not in one
  folder. Moving the drafts folder into the repo whole would put the
  markdown somewhere Hugo never renders.
- **The image that ships is not the `dog.jpg` you drafted with.** Copy #3
  is the optimized derivative: `.webp`, max 200KB (hero 80–120KB). The
  full-resolution source stays in pCloud permanently. "Move, don't copy"
  applies to the prose and to the shipped derivative, not to the
  original. See [Blog Post Authoring](blog-post-authoring.md).
- **The ewiki's chain differs in two places.** (a) Until 2026-10-17 the
  engine repo lived on a pCloud-synced path, so copy #3 was *also*
  mirrored by pCloud. Since the move to `C:\dev\legendary-arena` it
  follows the same rule as every other checkout: once the file reaches the
  repo, GitHub is its backup and pCloud's job is done (see
  [Start here](#start-here--local-roots-repos-and-public-sites)). (b) The build (#5) runs in
  GitHub Actions, not in Cloudflare. `.github/workflows/wiki-viewer.yml`
  projects `wiki/` into the gitignored `apps/wiki-viewer/content/` (one
  more generated copy you never touch), runs `hugo --source
  apps/wiki-viewer`, and `wrangler deploy` uploads the output to an
  assets-only Worker (D-24690). Edit `wiki/*.md` only. Never edit
  `apps/wiki-viewer/content/`.

## References

- [01-REPO-FOLDER-STRUCTURE.md](../docs/01-REPO-FOLDER-STRUCTURE.md) — the
  authoritative directory layout.
- [00.2-data-requirements.md](../docs/ai/REFERENCE/00.2-data-requirements.md) —
  canonical field names and the `legendary` schema namespace.
- [`heroImageUrl.ts`](../packages/registry/src/heroImageUrl.ts) — card-image
  `R2_BASE_URL` host constant.
- [`avatarUpload.logic.ts`](../apps/server/src/profile/avatarUpload.logic.ts) —
  avatar `AVATAR_CDN_BASE` host constant and upload pipeline.
- [`render.yaml`](../render.yaml) — the retired Render blueprint; the
  inventory of `sync: false` secret names.
- [R2 Image Naming Convention](r2-image-naming-convention.md),
  [LAGN Specification](lagn-v1.md),
  [Card Type Taxonomy](card-type-taxonomy.md),
  [Profile Login](profile-login.md),
  [Operational Health Checks](operational-health-checks.md) — the deep pages
  this map links to.
