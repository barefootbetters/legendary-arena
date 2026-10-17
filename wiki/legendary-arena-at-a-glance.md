---
title: Legendary Arena at a Glance
type: Guide
tags:
  - findability
  - operations
  - governance
  - cloudflare
  - digitalocean
  - backup
related:
  - data-file-locations.md
  - workspace-map.md
  - service-dependency-map.md
  - ubuntu-lab-provisioning.md
  - ai-second-brain.md
  - disaster-recovery.md
  - system-backup.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\legendary-arena-at-a-glance.md (this page — https://ewiki.legendary-arena.com/legendary-arena-at-a-glance/)
  - C:\www\legendary-arena\README-LA.md (operator's product background draft, folded in 2026-10-17)
  - ../docs/ops/DOMAINS.md
  - ../docs/ops/domains.json
  - ../docs/ops/service-dependencies.json
  - ../docs/03-DATA-PIPELINE.md
last-reviewed: 2026-10-17
---

# Legendary Arena at a Glance

## Summary

The one-screen background on the product, answering four questions:
where Legendary Arena's files live, how they are backed up, which files
you can edit (and which are generated or stale), and which outside
services it depends on — DigitalOcean, GitHub, Cloudflare, and the rest.
It renders at the top of the wiki home page. Each topic links to the page
that owns the detail; this page orients, it does not decide.

## Mechanics {#at-a-glance}

**Product:** Legendary Arena — a digital, multiplayer web version of the
Legendary deck-building card game.

### Where the files are

**Local roots on the workstation:**

| Root | Holds | Kept safe by |
|------|-------|--------------|
| `C:\www\` | Website sources (Hugo, `.md` files) | GitHub, deployed to Cloudflare |
| `C:\dev\` | Code projects (engines, libraries, tools) | GitHub repositories |
| `C:\pcloud\` | Personal and business records, staging, work-in-progress docs | pCloud |

**Repositories:**

| Repository | Holds | Local checkout |
|------------|-------|----------------|
| [`barefootbetters/legendary-arena`](https://github.com/barefootbetters/legendary-arena) | Engine monorepo — every app below except `www` | `C:\pcloud\BB\DEV\legendary-arena` today (on pCloud until moved); `C:\dev\legendary-arena` in future |
| [`legendary-arena/legendary-arena-website`](https://github.com/legendary-arena/legendary-arena-website) | Marketing site (`www`) | `C:\www\legendary-arena-com` |
| [`legendary-arena/legendary-arena-lab`](https://github.com/legendary-arena/legendary-arena-lab) | The API droplet's setup and operator runbooks | `C:\www\legendary-arena-lab` |

In the lab repo, `infra\` holds the executable, authoritative versions —
cloud-init, numbered provisioners (`infra\scripts\NN-*.ps1`), systemd
units, nginx, the env template, and the `la-deploy` gate — and
`content\` is the Hugo operator wiki of runbooks. Overview:
[Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md).

**What runs where:**

| Hostname | What it is | Built from | Runs on | Access |
|----------|-----------|------------|---------|--------|
| `www.legendary-arena.com` | Marketing site (Hugo) | `legendary-arena-website` | Cloudflare Pages | Public |
| `play.legendary-arena.com` | Game client (Vue 3 SPA) | `apps/arena-client` | Cloudflare Pages | Public |
| `legends.legendary-arena.com` | Scoreboard (Vue 3 SPA) | `apps/legends-board` | Cloudflare Pages | Public |
| `cards.legendary-arena.com` | Card database (Vue 3 SPA) | `apps/registry-viewer` | Cloudflare Pages | Public |
| `dashboard.legendary-arena.com` | Admin dashboard (Vue 3 SPA) | `apps/dashboard` | Cloudflare Worker | Private — Cloudflare Access |
| `ewiki.legendary-arena.com` | This engineering wiki (Hugo) | `wiki/` via `apps/wiki-viewer` | Cloudflare Worker | Private — Cloudflare Access |
| `images.legendary-arena.com` | Card images, avatars, audio, card-data mirror | R2 bucket `legendary-images` | Cloudflare R2 | Public per key |
| `api.legendary-arena.com` | Game server + PostgreSQL | `apps/server` | DigitalOcean droplet (Ubuntu VPS) | Public API |

Image example:
`https://images.legendary-arena.com/mdns/mdns-hr-blade-daywalker-ride-by-moonlight.webp`.
Authoritative hostname table: [`docs/ops/DOMAINS.md`](../docs/ops/DOMAINS.md).
Deeper locator: [Data & File Locations](data-file-locations.md) and
[Workspace Map](workspace-map.md).

### How it is backed up

**Database** — nightly at 09:17 UTC, by the `la-backup` timer on the
droplet (`50-backup.ps1`):

| Copy | Where | Retention |
|------|-------|-----------|
| Local | Droplet `/var/backups/la` | Last 7 dumps; lost with the droplet |
| Offsite 1 (primary) | Cloudflare R2 bucket `legendary-arena-db-backups` | 30-day bucket lock; keeps 35 daily / 12 weekly / 12 monthly |
| Offsite 2 (second vendor) | pCloud mirror, same `db-backups/YYYY/MM/DD/` keys | Mirrors R2 |

Restore: [Disaster Recovery](disaster-recovery.md).

**Work in progress** — pCloud (`C:\pcloud\LA`). Never sync a GitHub repo
there; pCloud clashes with `.git` folders.

**Code** — the GitHub repos. Push is the backup; unpushed work exists only
on the workstation.

### Which files you can edit

| Edit this | To change |
|-----------|-----------|
| `wiki\*.md` (engine repo) | This ewiki. Merging to `main` rebuilds and deploys it. |
| `apps\`, `packages\`, `docs\` (engine repo) | The game, the server, every Vue app, and the governance docs — on a branch, through a PR. |
| `docs\ops\domains.json`, `docs\ops\service-dependencies.json` | The hostname and dependency tables the ewiki renders. |
| `scripts\convert-cards\inputs\` (set sources and `patches\`) | Card data — then rerun the full convert pipeline ([`docs/03-DATA-PIPELINE.md`](../docs/03-DATA-PIPELINE.md)). |
| `data\cards\co2e.json` | Core Set 2nd Edition — the one hand-authored set file. |
| `C:\www\legendary-arena-com` | The marketing site and blog. |
| `infra\` in `C:\www\legendary-arena-lab` | The droplet's setup — the authoritative version; re-run the provisioner after changing it. |
| `C:\pcloud\LA` | Work-in-progress business files. |

| Don't edit this | Why |
|-----------------|-----|
| `data\cards\*.json` (except `co2e.json`) | Generated by the convert pipeline; a rerun overwrites hand edits. |
| `wiki\architecture-inventory.md` | Generated by `scripts/architecture-inventory.mjs`. |
| `apps\wiki-viewer\content\` | Build-time copy of `wiki\`, gitignored, rewritten every build. |
| `packages\lagn-spec\schemas\lagn-v1.json` | Rewritten by the build. |
| `C:\www\legendary-arena` | Stale clone of the engine repo — nothing deploys from it; safe to delete. |
| `C:\Users\jjensen\bbcode\modern-master-strike` | Frozen legacy copy of old card data; nothing reads it. |
| The brain MCP's `ewiki` folder | A snapshot of `main` — edit `wiki\` and redeploy instead. |

Card-data edits do not reach `cards.legendary-arena.com` until the R2
`metadata/` mirror is copied by hand (`rclone`); see
[Data & File Locations](data-file-locations.md).

### What it depends on

| Vendor | What Legendary Arena uses it for |
|--------|----------------------------------|
| **GitHub** | All three repos, Actions CI, and the deploy pipelines (ewiki, dashboard, droplet app) |
| **Cloudflare** | DNS and proxy for every hostname; Pages (`www`, `play`, `legends`, `cards`); Workers (`dashboard`, `ewiki`); R2 (images, audio, card-data mirror, database backups); Access (the private sites) |
| **DigitalOcean** | The droplet running the game server and its self-hosted PostgreSQL |
| **pCloud** | Work-in-progress files and the second offsite database backup |
| **Hanko** | Player sign-in |
| **Stripe** | Payments, including checkout behind the Snipcart cart |
| **Snipcart** | The `www` shop cart |
| **Brevo** | Email — newsletter signup and transactional mail |
| **Anthropic** | The AI coach's match reports |
| **healthchecks.io**, **UptimeRobot** | Monitoring and alerts for the droplet, its database, and the backups |
| **npm** | The package registry every build installs from |
| **YouTube** | Videos embedded in blog posts |
| **barefootbetters.com** (WordPress) | Hosts the team icons |

What breaks when each one is down, and where to check:
[Service Dependency Map](service-dependency-map.md), rendered from
[`docs/ops/service-dependencies.json`](../docs/ops/service-dependencies.json).

### Shared with the second brain

The brain repo is
[`barefootbetters/jefferyjjensen-corporate-memory`](https://github.com/barefootbetters/jefferyjjensen-corporate-memory)
(private), checked out at `C:\www\jefferyjjensen-corporate-memory`.

**Rule:** the brain reads Legendary Arena from GitHub `main` only, never a
local checkout (`connections.md` rows 8–9). Unmerged work is invisible to
it.

1. **Brain MCP connector** (Claude web, desktop, phone) —
   `https://brain-mcp.barefootbetters.com/mcp`, behind Cloudflare Access.
   - Folder `ewiki` is this repo's `wiki\`. The repo is public, so every
     page ships unless its front matter says `sensitivity: owner-only`.
   - Source list: `scripts\brain-sources.psd1` in the brain repo
     (sparse-clones `main` at deploy time).
   - It is a snapshot: merging an ewiki edit does **not** update it.
     Redeploy from the brain repo's clean `main` with
     `pwsh -File scripts\brain-mcp.ps1 -Deploy`.
2. **Live reads by Claude sessions in the brain repo**
   (`raw.githubusercontent.com` / `gh api`, `main`):
   - Engine: `docs\ai\STATUS.md`, `docs\ai\DECISIONS.md`,
     `docs\ai\work-packets\WORK_INDEX.md`, `wiki\`.
   - Marketing: `legendary-arena-website` `docs\corporate-memory\`
     (business brief, decisions, KPIs) and `content\blog\`.
3. **Web viewer** — `https://brain.barefootbetters.com` (Access). The
   brain repo's own notes, not Legendary Arena files.

To share a Legendary Arena file, merge it into the engine `wiki\` or
marketing `docs\corporate-memory\`, then redeploy the MCP. More in
[AI Second Brain](ai-second-brain.md).

## Interactions

- [Data & File Locations](data-file-locations.md) — the full locator map
  this page summarizes, down to card data, R2 keys, and env files.
- [Workspace Map](workspace-map.md) — why git checkouts and pCloud do not
  mix, and what belongs in each pCloud folder.
- [Service Dependency Map](service-dependency-map.md) — what breaks when
  each vendor above is down, and where to check.
- [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md) — how the API
  droplet is built from the lab repo.
- [AI Second Brain](ai-second-brain.md) — the brain's sources, agents,
  and deploy.
- [Disaster Recovery](disaster-recovery.md) and
  [System Backup](system-backup.md) — the restore runbook and backup
  layers behind the table above.

## Edge Cases

- **The engine monorepo is still on pCloud.** It breaks the
  "no git checkouts on pCloud" rule until it moves to
  `C:\dev\legendary-arena`; see [Workspace Map](workspace-map.md).
- **`C:\www\legendary-arena` is a stale clone.** Nothing deploys from it.
  Do not edit or search it.
- **The brain MCP lags `main`.** A merged ewiki edit reaches the brain
  connector only after a redeploy from the brain repo.
- **Everything in `wiki\` is public on GitHub.** The ewiki site is behind
  Cloudflare Access, but the repo is public; `sensitivity: owner-only`
  keeps a page out of the brain, not off GitHub.
- **The card database reads R2, not the repo.** A merged card-data change
  is invisible on `cards.legendary-arena.com` until the `metadata/` mirror
  is copied by hand.

## References

- `C:\www\legendary-arena\README-LA.md` — the operator's draft this page
  was built from (2026-10-17).
- [`docs/ops/DOMAINS.md`](../docs/ops/DOMAINS.md) and
  [`docs/ops/domains.json`](../docs/ops/domains.json) — authoritative
  hostname table.
- [`docs/ops/service-dependencies.json`](../docs/ops/service-dependencies.json)
  — the vendor list and what each one powers.
- [`docs/03-DATA-PIPELINE.md`](../docs/03-DATA-PIPELINE.md) — which card
  files are generated and which are sources.
- `legendary-arena/legendary-arena-lab` `infra/scripts/50-backup.ps1` —
  the nightly database backup.
