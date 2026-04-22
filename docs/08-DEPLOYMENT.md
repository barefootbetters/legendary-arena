# 08 — Deployment

> How Legendary Arena is deployed and what infrastructure exists.
>
> **Last updated:** 2026-04-14
>
> **Current state:** All foundation infrastructure operational.
> Cloudflare R2 (40 card sets), registry viewer (Cloudflare Pages),
> game server (Render.com), PostgreSQL (Render.com), and migration
> runner are all live.

---

## Infrastructure Overview

| Component | Service | URL | Status |
|---|---|---|---|
| Card data & images | Cloudflare R2 | `https://images.barefootbetters.com` | ✅ Live |
| Registry viewer | Cloudflare Pages | `https://cards.barefootbetters.com` | ✅ Live |
| Game server | Render.com | `render.yaml` | ✅ Live (FP-01) |
| PostgreSQL | Render.com (managed) | `legendary.*` schema | ✅ Live (FP-01) |
| Database migrations | `scripts/migrate.mjs` | `data/migrations/` | ✅ Live (FP-02) |
| GitHub repo | GitHub | `github.com/barefootbetters/legendary-arena` | ✅ Live |

---

## What Is Deployed Now

### Cloudflare R2 (Card Data)

Publicly readable. No secrets required.

| Content | Path | Count |
|---|---|---|
| Set index | `metadata/sets.json` | 40 sets |
| Per-set card JSON | `metadata/{abbr}.json` | 40 files |
| Keyword glossary | `metadata/keywords-full.json` | 123 keywords |
| Rule glossary | `metadata/rules-full.json` | 20 rules |
| Card images | `{abbr}/{abbr}-{type}-{slug}.webp` | ~1000+ images |

**Validation gate:** `pnpm validate` must pass with 0 errors before
any data upload. Warnings (cross-set duplicates, known data quality
items) are informational and do not block uploads.

**Image URL patterns** (per 00.2 §3.2 — hyphens, not underscores):

| Card type | Pattern | Example |
|---|---|---|
| Mastermind | `{abbr}-mm-{slug}` | `mdns-mm-lilith-mother-of-demons.webp` |
| Mastermind Tactic | `{abbr}-mt-{mmSlug}-{tacticSlug}` | `mdns-mt-lilith-mother-of-demons-connoisseur-of-souls.webp` |
| Villain | `{abbr}-vi-{groupSlug}-{cardSlug}` | `mdns-vi-lilin-meatmarket.webp` |
| Hero | `{abbr}-hr-{heroSlug}-{suffix}` | `mdns-hr-blade-daywalker-3c1.webp` |
| Henchman | `{abbr}-hm-{slug}` | `core-hm-doombot-legion.webp` |
| Scheme | `{abbr}-sc-{slug}` | `mdns-sc-sire-vampires-at-the-blood-bank.webp` |

**Important:** Hero card images should always use the stored `imageUrl`
field from the card JSON. Construct URLs from patterns only as a
fallback.

### Cloudflare Pages (Registry Viewer)

The card browser SPA at `cards.barefootbetters.com`. Built from
`apps/registry-viewer/`. Deployed via Cloudflare Pages Git integration.

### GitHub Actions (CI)

Two workflows exist:

| Workflow | Triggers on | Jobs |
|---|---|---|
| `ci.yml` | Push to main, PRs, version tags | Validate → Build → Upload R2 → Publish npm |
| `commit-hygiene.yml` | PRs to main | Commit messages, file hygiene, EC traceability |

---

## What Is NOT Deployed Yet

| Component | Created by | What it provides |
|---|---|---|
| Client UI | WP-028+ | Player-facing game interface |
| PAR artifact storage | WP-050 | Immutable simulation results |
| Competitive gate | WP-051 | Pre-release leaderboard enforcement |

---

## Pre-Deployment Validation

Before any deployment, run these checks:

```pwsh
# 1. Validate R2 card data (no .env needed)
pnpm validate
# Must exit 0 — errors block deployment

# 2. Verify local environment (optional but recommended)
pnpm check:env
```

If `pnpm validate` reports errors (not warnings), deployment is blocked.
Fix the data issues first.

---

## R2 Data Upload Process

When new card sets are added or existing data is corrected:

1. Run `convert-cards-v15.mjs` to generate updated JSON
2. Upload JSON to R2: `rclone copy data/cards/ r2:legendary-images/metadata/`
3. Upload images to R2: `rclone copy <image-source> r2:legendary-images/{abbr}/`
4. Run `pnpm validate` to verify the upload
5. Commit any local data changes with `INFRA:` or `SPEC:` prefix

**Rate limiting:** R2 may throttle aggressive parallel uploads. The
validation script uses a 50ms delay between set fetches.

**Cache:** R2 serves data via CDN. After uploading, allow a few minutes
for cache propagation. Cache-bust with `?t=<timestamp>` query parameter
if needed during verification.

---

## Environment Variables (Production)

These variables are configured in the Render.com dashboard:

| Variable | Where set | Notes |
|---|---|---|
| `DATABASE_URL` | Render (auto-wired) | From managed PostgreSQL — do NOT set manually |
| `NODE_ENV` | Render dashboard | `production` |
| `GAME_SERVER_URL` | Render dashboard | Public URL of the Render service |
| `JWT_SECRET` | Render dashboard | 32+ byte hex — rotate by updating and redeploying |
| `R2_PUBLIC_URL` | Render dashboard | `https://images.barefootbetters.com` |
| `CF_PAGES_URL` | Render dashboard | `https://cards.barefootbetters.com` |
| `VITE_GAME_SERVER_URL` | Render dashboard | Same as `GAME_SERVER_URL` |
| `PORT` | Render (auto-injected) | Do NOT set in dashboard — Render injects automatically |
| `EXPECTED_DB_NAME` | Render dashboard | Database name for connection verification |

**Critical:** `PORT` is auto-injected by Render. Setting it manually in
the dashboard causes port conflicts and silent startup failures.

See `.env.example` for the complete reference with generation commands
and placeholder values.

---

## Server Startup Sequence (FP-01)

The server completes two startup tasks before accepting requests:

```
Task 1 — Card registry (from local files):
  createRegistryFromLocalFiles()
  → Loads metadata/sets.json + per-set card JSON
  → Validates against Zod schemas
  → Returns immutable CardRegistry
  → Log: "[server] registry loaded: X sets, Y cards"

Task 2 — Rules text (from PostgreSQL):
  loadRules()
  → Reads from legendary.rules table
  → Returns in-memory rules via getRules()
  → Log: "[server] rules loaded: N rules"

Both complete → Server() starts → accepts requests
```

Both tasks must succeed before the server accepts any match creation
requests. Failure in either task prevents startup.

---

## Rollback Strategy (Planned — WP-035)

| Component | Rollback method |
|---|---|
| Code | Revert commit, re-deploy via Render Git trigger |
| Database | PostgreSQL point-in-time restore (Render managed) |
| R2 data | R2 is append-only by convention; upload previous versions |
| Registry viewer | Cloudflare Pages automatic rollback to previous deployment |

Detailed rollback procedures will be documented in WP-035 (Release &
Ops Playbook) and WP-042 (Deployment Checklists).

---

## Future Deployment Features

| Feature | Work Packet | What it adds |
|---|---|---|
| Release playbook | WP-035 | 4 environments, release artifacts, incident response |
| Deployment checklists | WP-042 | Binary pass/fail procedures for R2, PostgreSQL, infra |
| Launch readiness | WP-038 | 4 gate categories, launch day procedure, 72h freeze |
| Post-launch metrics | WP-039 | Monitoring, alerting, live ops cadence |

---

**See also:**
- [04-DEVELOPMENT-SETUP.md](04-DEVELOPMENT-SETUP.md) — local development setup
- [01-REPO-FOLDER-STRUCTURE.md](01-REPO-FOLDER-STRUCTURE.md) — where deployment files live
- [07-CLI-REFERENCE.md](07-CLI-REFERENCE.md) — validation and commit scripts
- [05-ROADMAP.md](05-ROADMAP.md) — FP-01, FP-02, WP-035, WP-042
