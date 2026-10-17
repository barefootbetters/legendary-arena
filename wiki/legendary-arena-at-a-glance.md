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
last-reviewed: 2026-10-17
---

# Legendary Arena at a Glance

## Summary

The one-screen background on the product: what Legendary Arena is, where
its sources live on the workstation, which site and service runs where,
which repositories hold what, how the second brain reads this repo, and
how the database and work-in-progress files are backed up. It renders at
the top of the wiki home page. Each topic links to the page that owns the
detail; this page orients, it does not decide.

## Mechanics {#at-a-glance}

**Product:** Legendary Arena — a digital, multiplayer web version of the
Legendary deck-building card game.

### Where things live on the workstation

| Root | Holds | Kept safe by |
|------|-------|--------------|
| `C:\www\` | Website sources (Hugo, `.md` files) | GitHub, deployed to Cloudflare |
| `C:\dev\` | Code projects (engines, libraries, tools) | GitHub repositories |
| `C:\pcloud\` | Personal and business records, staging, work-in-progress docs | pCloud |

More in [Workspace Map](workspace-map.md) and
[Data & File Locations](data-file-locations.md).

### Sites and services

| Hostname | What it is | Runs on | Access |
|----------|-----------|---------|--------|
| `www.legendary-arena.com` | Marketing site (Hugo) | Cloudflare Pages | Public |
| `play.legendary-arena.com` | Game client (Vue 3 SPA) | Cloudflare Pages | Public |
| `legends.legendary-arena.com` | Scoreboard (Vue 3 SPA, `apps/legends-board`) | Cloudflare Pages | Public |
| `cards.legendary-arena.com` | Card database (Vue 3 SPA) | Cloudflare Pages | Public |
| `dashboard.legendary-arena.com` | Admin dashboard (Vue 3 SPA) | Cloudflare Worker | Private — Cloudflare Access |
| `ewiki.legendary-arena.com` | This engineering wiki (Hugo) | Cloudflare Worker | Private — Cloudflare Access |
| `images.legendary-arena.com` | R2 bucket `legendary-images` — card images, avatars, audio | Cloudflare R2 | Public per key |
| `api.legendary-arena.com` | Game server + PostgreSQL | DigitalOcean droplet (Ubuntu VPS) | Public API |

Image example:
`https://images.legendary-arena.com/mdns/mdns-hr-blade-daywalker-ride-by-moonlight.webp`.
The authoritative hostname table is
[`docs/ops/DOMAINS.md`](../docs/ops/DOMAINS.md); what each service depends
on is the [Service Dependency Map](service-dependency-map.md).

### Repositories

| Repository | Holds | Local checkout |
|------------|-------|----------------|
| [`barefootbetters/legendary-arena`](https://github.com/barefootbetters/legendary-arena) | Engine monorepo — every app above except `www` | `C:\pcloud\BB\DEV\legendary-arena` today (on pCloud until moved); `C:\dev\legendary-arena` in future. `C:\www\legendary-arena` is a stale clone, safe to delete. |
| [`legendary-arena/legendary-arena-website`](https://github.com/legendary-arena/legendary-arena-website) | Marketing site (`www`) | `C:\www\legendary-arena-com` |
| [`legendary-arena/legendary-arena-lab`](https://github.com/legendary-arena/legendary-arena-lab) | The API droplet's setup and operator runbooks | `C:\www\legendary-arena-lab` |

In the lab repo, `infra\` holds the executable, authoritative versions —
cloud-init, numbered provisioners (`infra\scripts\NN-*.ps1`), systemd
units, nginx, the env template, and the `la-deploy` gate — and
`content\` is the Hugo operator wiki of runbooks. Overview:
[Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md).

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
marketing `docs\corporate-memory\`, then redeploy the MCP. To keep an
ewiki page out of Claude, set `sensitivity: owner-only` in its front
matter. More in [AI Second Brain](ai-second-brain.md).

### Backups

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

**Code** — the GitHub repos. Push is the backup.

## Interactions

- [Data & File Locations](data-file-locations.md) — the full locator map
  this page summarizes, down to card data, R2 keys, and env files.
- [Workspace Map](workspace-map.md) — why git checkouts and pCloud do not
  mix, and what belongs in each pCloud folder.
- [Service Dependency Map](service-dependency-map.md) — what breaks when
  each service above is down.
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

## References

- `C:\www\legendary-arena\README-LA.md` — the operator's draft this page
  was built from (2026-10-17).
- [`docs/ops/DOMAINS.md`](../docs/ops/DOMAINS.md) and
  [`docs/ops/domains.json`](../docs/ops/domains.json) — authoritative
  hostname table.
- `legendary-arena/legendary-arena-lab` `infra/scripts/50-backup.ps1` —
  the nightly database backup.
