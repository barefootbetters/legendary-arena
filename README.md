# Legendary Arena — Monorepo

Game engine, multiplayer server, web clients, card data, and publishing
tooling for the Legendary Arena card game.

---

## Where things live

Three documents answer "where does *X* live?", at three different
altitudes. Start with whichever matches your question:

| Question | Read |
|---|---|
| Which storage surface does this file belong to at all — git, pCloud, or a hosted service? | **[Workspace Map](https://ewiki.legendary-arena.com/workspace-map/)** (source: [`wiki/workspace-map.md`](wiki/workspace-map.md)) |
| Where in *this repo* does it live? | [`docs/01-REPO-FOLDER-STRUCTURE.md`](docs/01-REPO-FOLDER-STRUCTURE.md) — authoritative for the directory layout |
| Where does the *data* live — card JSON, metadata, migrations, R2 keys? | [Data & File Locations](https://ewiki.legendary-arena.com/data-file-locations/) |

The short version of the first one: **git holds text worth diffing;
pCloud holds work-in-progress and binaries; hosted services hold what
gets delivered.** A file lives on exactly one surface.

---

## Repo Structure

A pnpm monorepo. Every tracked top-level directory, one line each:

```
legendary-arena/
├── packages/                 ← shared libraries (built to dist/, gitignored)
│   ├── game-engine/          ← gameplay rules, moves, phases, determinism
│   ├── registry/             ← card-data access layer (@legendary-arena/registry)
│   ├── lagn-spec/            ← LAGN notation validator + schema (published npm)
│   ├── preplan/              ← non-authoritative per-client turn planning
│   └── vue-sfc-loader/       ← test-time Vue SFC loader (dev/test only)
│
├── apps/                     ← deployable applications
│   ├── server/               ← boardgame.io server + REST API + persistence
│   ├── arena-client/         ← gameplay client SPA (play.legendary-arena.com)
│   ├── registry-viewer/      ← card browser (cards.legendary-arena.com)
│   ├── legends-board/        ← public leaderboards (legends.legendary-arena.com)
│   ├── wiki-viewer/          ← Hugo build of wiki/ (ewiki.legendary-arena.com)
│   ├── dashboard/            ← internal operator dashboard
│   ├── engine-runner/        ← headless simulation harness
│   └── replay-producer/      ← CLI emitting deterministic replay sequences
│
├── data/                     ← generated + authored game data (never runtime state)
│   ├── cards/                ← per-set card JSON (41 sets) — mostly generated
│   ├── metadata/             ← sets.json, keywords, rules, taxonomies
│   ├── migrations/           ← PostgreSQL DDL (legendary.* schema)
│   ├── scoring-configs/      ← per-scenario scoring config
│   └── sweep-fixtures/       ← fixtures for the audit sweeps
│
├── scripts/                  ← CLI tooling
│   ├── convert-cards/        ← the multi-stage card pipeline + its inputs
│   ├── card-image-*/         ← image download / convert / rename chain
│   ├── coverage/             ← effect + mechanic ledger generators
│   ├── audit/                ← repo audit sweeps
│   ├── ec/                   ← Execution Checklist tooling
│   └── git/                  ← hook installation and commit helpers
│
├── wiki/                     ← engineering wiki source (published to ewiki)
├── ewiki/                    ← per-page wiki assets, projected at build time
├── content/                  ← gameplay themes + media consumed by the apps
├── docs/                     ← product docs + docs/ai/ governance (WP/EC/DECISIONS)
├── .claude/                  ← Claude Code rules, skills, coordination
├── .githooks/                ← commit-message and pre-commit hygiene
└── .github/workflows/        ← CI pipelines
```

Per-directory detail, ownership, and the governing import rules:
[`docs/01-REPO-FOLDER-STRUCTURE.md`](docs/01-REPO-FOLDER-STRUCTURE.md).

**Card images are not in this repo.** They are served from Cloudflare R2
at `images.legendary-arena.com`; the staging and conversion chain lives
under `scripts/card-image-*/`. See
[Data & File Locations](https://ewiki.legendary-arena.com/data-file-locations/).

---

## Quick Start

```bash
# Install all workspace dependencies
pnpm install
```

---

## How to Run Validation

Validates card data in `data/cards/` and lookup files in `data/metadata/`
against the Zod schemas. Fails with exit code 1 on schema violations,
unresolved cross-references, or unreachable card images (Phase 5 HEAD checks).

```bash
# From repo root (defaults resolve to data/cards/ and data/metadata/):
pnpm registry:validate

# Skip the Phase 5 image reachability checks:
SKIP_IMAGES=1 pnpm registry:validate

# Validate against live R2 instead of local files:
R2_BASE_URL=https://images.legendary-arena.com pnpm registry:validate
```

Writes a `packages/registry/dist/registry-health.json` report on every run.

---

## How to Build the Registry Package

```bash
# Compile TypeScript types:
pnpm registry:build

# Runs: tsc -p tsconfig.build.json → dist/*.js + dist/*.d.ts
# Registry validation (pnpm registry:validate) is a separate command and
# writes dist/registry-health.json; the build itself is tsc-only.
```

---

## How to Build the Viewer

```bash
# Development server (hot reload):
pnpm viewer:dev

# Production build (static files → apps/registry-viewer/dist/):
pnpm viewer:build
```

Deploy `apps/registry-viewer/dist/` to Cloudflare Pages (or any static host).

---

## How to Point the Viewer at a Different Data Host

Edit `apps/registry-viewer/public/registry-config.json`:

```json
{
  "metadataBaseUrl": "https://images.legendary-arena.com",
  "rulebookPdfUrl":  "https://images.legendary-arena.com/docs/legendary-universal-rules-v23.pdf"
}
```

The viewer fetches `{metadataBaseUrl}/metadata/sets.json` plus per-set `{metadataBaseUrl}/metadata/{abbr}.json` files at runtime — no rebuild needed. Card images load from the absolute `imageUrl` values inside that metadata.

---

## How to Upload to R2

1. Copy `.env.example` to `.env` and fill in your Cloudflare credentials:

```bash
cp packages/registry/.env.example packages/registry/.env
# Edit .env with real values — never commit this file
```

2. Build dist first, then upload:

```bash
cd packages/registry
DATA_VERSION=1.0.0 pnpm upload
```

Uploads:
- `images/1.0.0/{type}/{cardId}.webp` → R2

---

## How to Publish to npm

The package published is `@legendary-arena/registry`.  
Only `dist/` and `docs/` ship (controlled by the `files` field in `package.json`).

```bash
cd packages/registry

# Bump version in package.json first, then:
pnpm publish --access public

# prepublishOnly runs automatically and rebuilds dist/ before publishing.
```

For automated publishing, push a semver tag and the GitHub Actions workflow handles it:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## CI Pipeline (GitHub Actions)

`.github/workflows/ci.yml` runs on every push to `main` and on version tags:

| Step | Trigger | What it does |
|------|---------|-------------|
| `validate` | every push | `pnpm registry:validate` — fails CI on schema errors |
| `build` | after validate | Compiles TypeScript, writes `dist/` |
| `build-viewer` | after build | Vite builds the static viewer |
| `upload-r2` | tags only | Uploads data + images to Cloudflare R2 |
| `publish-npm` | tags only | Publishes `@legendary-arena/registry` to npm |

Required GitHub Secrets for tag releases:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`
- `NPM_TOKEN`

---

## Canonical ID Rules

Card IDs must match:
```
<type>-<slug>[-<variant>]
```
- `type`: one of `hero | villain | location | event | equipment | relic`
- `slug`: lowercase alphanumeric + hyphens, 2–40 chars
- `variant`: optional, lowercase alphanumeric + hyphens, 1–20 chars

**Examples:** `hero-iron-man`, `villain-thanos`, `location-wakanda`, `hero-iron-man-mk50`

Image filenames are derived directly: `{cardId}.webp` — e.g. `hero-iron-man.webp`

---

## Definition of Done Checklist

- [ ] `pnpm registry:validate` fails on duplicate IDs
- [ ] `pnpm registry:validate` fails on missing required fields
- [ ] `pnpm registry:validate` fails on non-canonical image filenames
- [ ] `pnpm registry:validate` fails on invalid card ID format
- [ ] `dist/registry-health.json` is written on every validation run
- [ ] Viewer renders card images via `{imageBaseUrl}/{type}/{fileName}`
- [ ] Viewer search and filters work without a backend
- [ ] `pnpm viewer:build` produces a deployable static site
