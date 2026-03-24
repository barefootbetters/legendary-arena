# Legendary Arena — Monorepo

Card Data Access Layer, Registry Viewer, and publishing tooling for the Legendary Arena card game.

---

## Repo Structure

```
legendary-arena/
├── data/
│   └── raw/                  ← Source card JSON files (commit these)
├── images/
│   ├── raw/                  ← Original images (pre-rename)
│   └── standard/             ← Canonical WebP images (auto-generated)
├── packages/
│   └── registry/             ← @legendary-arena/registry npm package
│       ├── src/              ← TypeScript source
│       ├── scripts/          ← Build / validate / upload scripts
│       └── dist/             ← Build output (gitignored, generated in CI)
├── apps/
│   └── registry-viewer/      ← Vite + Vue 3 static viewer app
└── .github/workflows/ci.yml  ← CI pipeline
```

---

## Quick Start

```bash
# Install all workspace dependencies
pnpm install
```

---

## How to Run Validation

Validates every card in `data/raw/` against the Zod schema.  
Fails with exit code 1 if there are duplicate IDs, missing fields, or bad image filenames.

```bash
# From repo root:
pnpm registry:validate

# With explicit options:
cd packages/registry
CARDS_DIR=../../data/raw DATA_VERSION=1.0.0 pnpm validate
```

Writes a `packages/registry/dist/registry-health.json` report on every run.

---

## How to Build the Registry Package

```bash
# Normalize + validate cards, then compile TypeScript types:
pnpm registry:build

# This runs in order:
#  1. scripts/normalize-cards.ts  → dist/cards.json
#  2. tsc                         → dist/*.js + dist/*.d.ts
#  3. scripts/build-dist.mjs      → dist/index.json, sets.json, keywords.json
```

---

## How to Standardize Images

1. Place raw WebP images in `images/raw/` (run `convert-to-webp.mjs` first if needed).
2. Run:

```bash
cd packages/registry
pnpm standardize-img
# Or with custom paths:
INPUT_IMG_DIR=../../images/raw OUTPUT_IMG_DIR=../../images/standard pnpm standardize-img
```

This copies images to `images/standard/{type}/{cardId}.webp` and writes `dist/image-manifest.json`.

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

## How to Point the Viewer at a Different dataVersion

Edit `apps/registry-viewer/public/registry-config.json`:

```json
{
  "dataVersion": "1.2.0",
  "dataBaseUrl":  "https://assets.legendary-arena.com",
  "imageBaseUrl": "https://assets.legendary-arena.com/images/1.2.0"
}
```

The viewer fetches `{dataBaseUrl}/data/{dataVersion}/cards.json` and images from `{imageBaseUrl}/{type}/{filename}.webp` at runtime — no rebuild needed.

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
- `data/1.0.0/cards.json`, `index.json`, etc. → R2
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
- [ ] `dist/cards.json` contains all normalized cards sorted by ID
- [ ] `dist/index.json` contains lightweight metadata only
- [ ] `dist/registry-health.json` is written on every validation run
- [ ] Viewer loads `cards.json` and `registry-health.json` from R2 base URL
- [ ] Viewer renders card images via `{imageBaseUrl}/{type}/{fileName}`
- [ ] Viewer search and filters work without a backend
- [ ] `pnpm viewer:build` produces a deployable static site
