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

```text
C:\www\        ← website sources (Hugo, .md files) - saved on github and deployed to Cloudflare
C:\dev\        ← code projects (engines, libraries, tools) - saved on github repositories
C:\pcloud\     ← personal & business records, staging, work-in-progress docs, etc. - saved on pcloud

Product: Legendary Arena (digital card game)
Cloudflare Pages:
    www.legendary-arena.com      ← public marketing site (Hugo)
    play.legendary-arena.com     ← public game client (Vue 3 SPA)
    legends.legendary-arena.com  ← public scoreboard (Vue 3 SPA, apps/legends-board)
    cards.legendary-arena.com    ← public card database (Vue 3 SPA)
Cloudflare Workers (private, behind Cloudflare Access):
    dashboard.legendary-arena.com  ← admin dashboard (Vue 3 SPA)
    ewiki.legendary-arena.com      ← engineering wiki (Hugo)
Cloudflare R2:
    images.legendary-arena.com   ← bucket legendary-images (card images, avatars, audio)
        e.g. https://images.legendary-arena.com/mdns/mdns-hr-blade-daywalker-ride-by-moonlight.webp
DigitalOcean droplet (Ubuntu VPS):
    api.legendary-arena.com      ← game server + PostgreSQL

Repositories:
    https://github.com/barefootbetters/legendary-arena          ← engine monorepo (all the apps above except www)
        - Current - C:\pcloud\BB\DEV\legendary-arena (on pCloud until moved to C:\dev)
        - Future  - C:\dev\legendary-arena
        - Stale   - C:\www\legendary-arena (safe to delete)
    https://github.com/legendary-arena/legendary-arena-website  ← marketing site (www)
        - C:\www\legendary-arena-com
    https://github.com/legendary-arena/legendary-arena-lab      ← the api droplet's setup + operator runbooks
        - C:\www\legendary-arena-lab
        - infra\  = the executable, authoritative versions: cloud-init, numbered provisioners
                    (infra\scripts\NN-*.ps1), systemd units, nginx, env template, la-deploy gate
        - content\ = Hugo operator wiki (runbooks)
        - ewiki overview: https://ewiki.legendary-arena.com/ubuntu-lab-provisioning/

Shared with the second brain:
    Brain repo: https://github.com/barefootbetters/jefferyjjensen-corporate-memory (private)
        - C:\www\jefferyjjensen-corporate-memory
    Rule: the brain reads Legendary Arena from GitHub main ONLY, never a local checkout
          (connections.md rows 8-9). Unmerged work is invisible to it.
    1. Brain MCP connector (Claude web/desktop/phone) - https://brain-mcp.barefootbetters.com/mcp (Access)
        - folder "ewiki" = engine repo wiki\ (public repo, so every page ships
          unless its front matter says sensitivity: owner-only)
        - source list: scripts\brain-sources.psd1 (sparse-clones main at deploy time)
        - it's a snapshot: merging an ewiki edit does NOT update it. Redeploy from the brain repo's clean main:
              pwsh -File scripts\brain-mcp.ps1 -Deploy
    2. Live reads by Claude sessions in the brain repo (raw.githubusercontent.com / gh api, main):
        - engine:    docs\ai\STATUS.md, docs\ai\DECISIONS.md, docs\ai\work-packets\WORK_INDEX.md, wiki\
        - marketing: legendary-arena-website docs\corporate-memory\ (business brief, decisions, KPIs), content\blog\
    3. Web viewer https://brain.barefootbetters.com (Access) - the brain repo's own notes, not LA files
    To share an LA file: merge it into engine wiki\ or marketing docs\corporate-memory\, then redeploy the MCP.
    To keep an ewiki page out of Claude: sensitivity: owner-only in its front matter.

Backups - database (nightly 09:17 UTC, la-backup timer on the droplet, 50-backup.ps1):
    Local     - droplet /var/backups/la, last 7 dumps (lost with the droplet)
    Offsite 1 - Cloudflare R2 bucket legendary-arena-db-backups (primary; 30-day bucket lock;
                keeps 35 daily / 12 weekly / 12 monthly)
    Offsite 2 - pCloud mirror, same db-backups/YYYY/MM/DD/ keys (second vendor)
    Restore   - https://ewiki.legendary-arena.com/disaster-recovery/
Backups - work in progress: pCloud (C:\pcloud\LA) - never sync GitHub repos there, it clashes with .git folders
Backups - code: GitHub repos (push)
```

Deeper detail: [Data & File Locations](data-file-locations.md),
[Workspace Map](workspace-map.md),
[Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md),
[AI Second Brain](ai-second-brain.md), and
[Disaster Recovery](disaster-recovery.md).

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
