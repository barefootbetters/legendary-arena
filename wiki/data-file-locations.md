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
  - r2-image-naming-convention.md
  - lagn-v1.md
  - card-type-taxonomy.md
  - profile-login.md
  - operational-health-checks.md
  - complete-game-fixtures.md
status: draft
source:
  - ../docs/01-REPO-FOLDER-STRUCTURE.md
  - ../docs/ai/REFERENCE/00.2-data-requirements.md
  - ../packages/registry/src/heroImageUrl.ts
  - ../apps/server/src/profile/avatarUpload.logic.ts
  - ../render.yaml
last-reviewed: 2026-06-30
---

# Data & File Locations

## Summary

A single locator map for "where does *X* live in this repo?" — card
data, metadata, the database schema, Cloudflare R2 object storage,
replays, LAGN, env/config, and the docs/coverage data dirs. It is a
**navigation hub**: for each subsystem it gives the path and points at
the deep page that owns the detail. It does not restate those pages or
make any decision — the authoritative locations are the code, the
migrations, and the pages cited here.

## Mechanics

### Card data and the convert pipeline

Game-ready card data is one JSON file per set under
[`data/cards/`](../data/cards/) (40 sets). Each file is **generated**,
not hand-edited — the multi-stage pipeline under
[`scripts/convert-cards/`](../scripts/convert-cards/) produces it:

| Stage | Script | What it does |
|-------|--------|--------------|
| 1 | `convert-cards-v15.mjs` | Reads the upstream set sources under `scripts/convert-cards/inputs/cards/`, assigns the card-type ribbon, composes each card's `imageUrl`, writes `data/cards/{setAbbr}.json`. |
| 2 | `apply-card-counts.mjs` | Attaches per-hero `cardCounts` from `scripts/convert-cards/inputs/hero-card-counts.json`. |
| 3 | `apply-hero-ability-markers.mjs` | Marks hero abilities with metadata (scaling, free activations). |
| 4 | `apply-effect-markers.mjs` | Applies effect / follow-up-taxonomy markers used by coverage tooling. |

Running only stage 1 regresses the data — the marker stages must run in
order. The image-URL convention each card carries is documented in full
on [R2 Image Naming Convention](r2-image-naming-convention.md).

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
files under [`data/migrations/`](../data/migrations/) (`001`…`020` at this
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
| `avatars/{accountId}.webp` | Player avatars, keyed by immutable AccountId | `AVATAR_CDN_BASE` → `images.barefootbetters.com` ([`avatarUpload.logic.ts`](../apps/server/src/profile/avatarUpload.logic.ts)) — see Edge Cases |
| `metadata/` | Mirror of the converted card + metadata JSON | convert pipeline / rclone copy |
| `themes/` | Gameplay UI themes from [`content/themes/`](../content/themes/) | [`scripts/upload-themes-to-r2.mjs`](../scripts/upload-themes-to-r2.mjs) |
| `legends/…json` | Legends Snapshot Publisher output (separate `R2_LEGENDS_BUCKET`) | render.yaml secrets |

R2 credentials are **not committed**: local `.env` carries
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`; production injects
`R2_*` secrets via the Render dashboard. Reachability is probed by
`pnpm check` (see [Operational Health Checks](operational-health-checks.md)).

### Replays and LAGN

- **Replays** persist in Postgres, content-addressed by hash:
  `legendary.replay_blobs` (immutable blob) + `legendary.replay_ownership`
  (player ↔ hash + visibility/retention). Server API:
  [`apps/server/src/identity/replayOwnership.logic.ts`](../apps/server/src/identity/replayOwnership.logic.ts).
- **LAGN** (Legendary Arena Game Notation) is the published interchange
  spec in [`packages/lagn-spec/`](../packages/lagn-spec/) — full detail on
  [LAGN v1.0 Specification](lagn-v1.md). Client-side loadout parsing lives
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
| `apps/dashboard/` | Internal admin dashboard SPA. |
| `apps/registry-viewer/` | Card browser (Cloudflare Pages). |
| `apps/legends-board/` | Public read-only Legends scoreboard. |
| `apps/replay-producer/` | CLI that emits deterministic replay sequences. |
| `apps/wiki-viewer/` | Hugo build of this wiki. |

### Config, env and deploy

- [`.env.example`](../.env.example) — template listing every required
  variable (`DATABASE_URL`, `JWT_SECRET`, `HANKO_*`, `STRIPE_*`,
  `R2_*` / `AWS_*`, `BREVO_*`, `VITE_*`, …). The real `.env` values are
  injected per-environment and are **not** committed.
- [`render.yaml`](../render.yaml) — production services
  (`legendary-arena-server`, `legendary-arena-wiki`, `legendary-arena-db`)
  and their secret bindings (`sync: false`).
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

## Interactions

- **[R2 Image Naming Convention](r2-image-naming-convention.md)** owns the
  card-image filename rules; this page only points at the `data/cards/`
  and R2 locations.
- **[LAGN v1.0 Specification](lagn-v1.md)** owns the game-notation format;
  this page locates the package and the client parser.
- **[Card Type Taxonomy](card-type-taxonomy.md)** owns the type list backing
  `data/metadata/card-types.json`.
- **[Profile Login](profile-login.md)** owns the identity/auth detail behind
  the `players` / `player_links` tables and the `avatars/` prefix.
- **[Operational Health Checks](operational-health-checks.md)** owns the
  probes that verify the PostgreSQL / R2 / Hanko connections this map names.

## Edge Cases

- **Two avatar/card image hosts.** Card images resolve to
  `images.legendary-arena.com` (`R2_BASE_URL`) but avatars still resolve to
  the legacy `images.barefootbetters.com` (`AVATAR_CDN_BASE`). Both are
  custom domains over the same `legendary-images` bucket; the split is a
  known drift, not two buckets. Verify the constant in code before quoting a
  host.
- **Two `card-types.json` files.** The in-repo
  `data/metadata/card-types.json` is the Registry-Viewer taxonomy with **no**
  image-ribbon prefixes; the authoritative prefix registry is the *upstream*
  `modern-master-strike/src/data/card-types.json` (sibling repo). See
  [R2 Image Naming Convention](r2-image-naming-convention.md).
- **`03-DATA-PIPELINE.md` is stale.** The authoritative card pipeline is the
  four-stage `scripts/convert-cards/` chain documented above, not the older
  single-converter description in `docs/03-DATA-PIPELINE.md`.
- **Snapshots are not the migration list.** The table inventory and migration
  count are a point-in-time snapshot; both grow. `data/migrations/` is the
  source of truth.
- **pCloud conflict files.** This repo lives on a pCloud-synced path, which
  can spawn `… [conflicted N].json` siblings; the un-suffixed file is
  canonical.
- **Secrets are never in the repo.** `.env` and Render secrets hold all
  credentials; the committed `.env.example` is only the shape.

## References

- [01-REPO-FOLDER-STRUCTURE.md](../docs/01-REPO-FOLDER-STRUCTURE.md) — the
  authoritative directory layout.
- [00.2-data-requirements.md](../docs/ai/REFERENCE/00.2-data-requirements.md) —
  canonical field names and the `legendary` schema namespace.
- [`heroImageUrl.ts`](../packages/registry/src/heroImageUrl.ts) — card-image
  `R2_BASE_URL` host constant.
- [`avatarUpload.logic.ts`](../apps/server/src/profile/avatarUpload.logic.ts) —
  avatar `AVATAR_CDN_BASE` host constant and upload pipeline.
- [`render.yaml`](../render.yaml) — production services and secret bindings.
- [R2 Image Naming Convention](r2-image-naming-convention.md),
  [LAGN v1.0 Specification](lagn-v1.md),
  [Card Type Taxonomy](card-type-taxonomy.md),
  [Profile Login](profile-login.md),
  [Operational Health Checks](operational-health-checks.md) — the deep pages
  this map links to.
