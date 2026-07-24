---
title: Ubuntu Lab Provisioning
type: Tutorial
tags:
  - infrastructure
  - digitalocean
  - ubuntu
  - postgres
  - deployment
  - operator-reference
  - draft
related:
  - architecture-inventory.md
  - development-workflow.md
  - operational-health-checks.md
  - data-file-locations.md
  - workspace-map.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\ubuntu-lab-provisioning.md (this page — https://ewiki.legendary-arena.com/ubuntu-lab-provisioning/)
  - ../render.yaml
  - ../docs/ops/DOMAINS.md
  - ../docs/ops/domains.json
last-reviewed: 2026-07-23
---

# Ubuntu Lab Provisioning

> **Draft, non-production.** This page describes a *proposed* personal
> DigitalOcean Ubuntu box used as a **learning lab, staging host, and future
> migration target** — not a production cutover. Production today runs on
> Render + Cloudflare (see the [Architecture & Library Adoption
> Inventory](architecture-inventory.md) for the live topology and sizing). No
> decision to leave Render has been recorded in
> [DECISIONS.md](../docs/ai/DECISIONS.md); if this box ever becomes production
> topology, that needs its own Work Packet and `DECISIONS` entry. This page
> defines nothing and governs nothing — it is a walkthrough.

## Summary

A single ~$24/mo DigitalOcean droplet (Ubuntu 24.04 LTS, 2 vCPU / 4 GB) bought
purely as an operator lab: a place to build **portable Ubuntu/Linux operations
skill**, run a **staging copy** of `apps/server` the project does not otherwise
have, and **rehearse the risky parts of a possible future migration** (self-hosted
Postgres backup/restore, cross-provider database latency) without ever putting
production at risk. The value is capability and a de-risked decision — the modest
monthly delta versus Render is not the point.

## Mechanics

### What the lab is — and is not

- **Is:** a personal Linux box for learning Nginx / PM2 / systemd / Certbot /
  UFW; a staging target for `apps/server` (the project has none today —
  `render.yaml` sets `pullRequestPreviewsEnabled: false` on the wiki and runs no
  staging service); a sandbox to measure and rehearse before any production move.
- **Is not:** production, and not pointed at the production database. The Render
  managed Postgres currently allows credential-gated public inbound
  (`ipAllowList: ['0.0.0.0/0']` in `render.yaml`), which makes it *reachable* from
  a droplet — treat that as a footgun, not an invitation. The lab always runs
  against a **copy** of the data (see Restore drill below).

### Why "the server is relocatable at all"

`apps/server` is **persistence-stateless**: live match state is written to Postgres
(the boardgame.io adapter's `bgio` schema), so a server restart does not drop live
matches. That is the single property that makes an app-tier lab (and any eventual
Option-E-style move of the stateless server) possible. "Stateless" here means
*persistence-stateless*, **not** *connection-stateless* — live WebSocket
connections and the server's cron singletons (legends publisher, match reaper,
capture harvester) still live in-process. One box is fine; see Edge Cases for what
multi-node would additionally require.

### 1 — Provision the droplet

```bash
# Region: pin to the SAME region as the Render Postgres (Oregon / US-West per
# the Managed database notes in the architecture inventory) so any later
# app↔DB latency probe reflects a realistic co-located deployment, not a
# cross-continent worst case.
# Image: Ubuntu 24.04 (LTS). Size: 2 vCPU / 4 GB / 80 GB SSD (~$24/mo).
# Auth: SSH key only — no password login.
```

Baseline hardening on first boot:

```bash
adduser operator && usermod -aG sudo operator      # non-root working user
# Then, as operator, disable root SSH + password auth in /etc/ssh/sshd_config:
#   PermitRootLogin no
#   PasswordAuthentication no
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
sudo apt update && sudo apt install -y fail2ban unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades    # enable auto security patches
```

### 2 — Base application stack

```bash
# Node — match the repo pin exactly (.node-version → 24.18.0, D-24205).
# Use a version manager (fnm/nvm) or NodeSource; install 24.18.0, not "latest".
corepack enable                                    # pnpm per packageManager pin
sudo apt install -y git nginx postgresql           # postgresql = LAB DB only
sudo npm install -g pm2                             # process manager
```

Nginx as a TLS-terminating reverse proxy in front of the Node process, with
Certbot for the certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
# Point a throwaway lab hostname (e.g. lab.<your-domain>) at the droplet IP,
# then: sudo certbot --nginx -d lab.<your-domain>
# Nginx server block proxy_pass → http://127.0.0.1:<server-port>, with the
# Upgrade/Connection headers set so Socket.IO WebSocket upgrades pass through.
```

### 3 — Deploy `apps/server` against a COPY of the DB

The build/start commands mirror what `render.yaml` runs; the difference is the
lab runs them by hand under PM2 instead of Render's build pipeline:

```bash
git clone <repo> && cd legendary-arena
pnpm install && pnpm -r build                      # same as render.yaml buildCommand
node scripts/migrate.mjs                            # migrations against the LAB DB
pm2 start "node --import ./apps/server/node_modules/tsx/dist/loader.mjs \
  apps/server/src/index.mjs" --name la-server
pm2 save && pm2 startup                             # survive reboots
```

Environment: the server reads ~15 secrets that `render.yaml` marks `sync: false`
(JWT, Hanko ×3, Stripe ×3, analytics salt, four submit tokens, R2 ×4, Brevo ×2).
For a lab, supply **throwaway / test-mode** values (Stripe test keys, a scratch R2
bucket, a lab JWT secret) — never copy production secrets onto a learning box.
`DATABASE_URL` points at the local lab Postgres, never at prod. Confirm health via
the `/health` endpoint (and `/health/legends-publisher` if that loop is enabled).

### 4 — Latency probe (do this before trusting any Option-E move)

The reason to measure: a production "move only the stateless server, keep managed
Postgres" step would put the app↔DB link across the public internet instead of
Render's internal network. A boardgame.io move handler issues many small queries,
and the bot-ally poll runs every 250 ms per live match — a chatty, latency-sensitive
profile. Stand the server on the droplet, point it at a **copy** DB reachable over
the same provider boundary you would use in production (same region), and measure
per-round-trip query latency under a simulated match load. Treat the result as the
gate on whether that move is worth doing — measure, don't assume.

### 5 — Restore drill (rehearse before self-managed PG ever touches prod)

Self-hosting Postgres means owning backups and restores. Rehearse it on the lab
against a copy, on a schedule, until it is boring:

```bash
pg_dump "$SOURCE_COPY_URL" -Fc -f /tmp/la-lab.dump # capture
createdb la_restore_test                           # fresh target
pg_restore -d la_restore_test /tmp/la-lab.dump     # restore
# Verify: row counts on key legendary.* tables, and that apps/server starts
# clean against the restored copy. A restore you have not tested is not a backup.
```

## Interactions

- **[Architecture & Library Adoption Inventory](architecture-inventory.md)** —
  the authoritative live picture this lab shadows: the Render account model and
  instance sizing (server `standard`; the managed Postgres, pinned in
  `render.yaml`, was bumped `basic-1gb` → `pro-4gb` under load — treat `render.yaml`
  as authoritative when the generated inventory lags a plan change), the
  managed-database operational notes (the OOM-recovery history, blueprint-managed
  settings, connection-pool posture), and the full deployment topology. Read it
  first; this page assumes those facts rather than restating them.
- **[Development Workflow](development-workflow.md)** — the production
  develop-from-anywhere loop (Claude Code sessions → GitHub → auto-deploy on merge
  to `main` via Render + Cloudflare). The lab is a manual, off-`main` sibling of
  that loop, not a replacement for it.
- **[Operational Health Checks](operational-health-checks.md)** — `pnpm check`
  walks toolchain and external-service connectivity (PostgreSQL, R2, Hanko, CORS);
  useful for validating a lab deploy the same way production is validated.
- **[Data & File Locations](data-file-locations.md)** and
  **[Workspace Map](workspace-map.md)** — where the `legendary.*` tables, R2
  prefixes, and env/config actually live, so a lab copy pulls from the right places.

## Edge Cases

- **Region mismatch inflates DB latency.** If the droplet and the Render Postgres
  sit in different regions, the latency probe measures the network, not the
  architecture. Pin the droplet to the DB's region (Oregon / US-West).
- **Never point the lab at production data.** The credential-gated `0.0.0.0/0`
  inbound rule makes prod *reachable* — that convenience is exactly the footgun.
  Always run against a restored copy.
- **Do not copy production secrets onto the box.** Use test-mode credentials for
  the `sync: false` env set. A learning box is a soft target.
- **"Stateless" is persistence-stateless, not connection-stateless.** One droplet
  is fine. A future multi-node app tier would additionally need a Socket.IO Redis
  adapter (WebSocket fan-out) and leader-election / single-owner scheduling for the
  cron singletons, or the reaper and publisher double-fire.
- **`bgio` blob growth rides along.** The match store never prunes finished
  matches, so a restored copy carries that bloat (fine for a lab; a retention job
  is the standing production follow-up noted in the inventory's DB notes).
- **Build cost moves onto the box.** `pnpm -r build` is heavy; on a 2 vCPU droplet
  it is real wall-clock time, not Render's managed pipeline. (Unrelated to Render's
  Hobby-workspace 500 build-minute allowance, which is a Render-side concern.)
- **Version pins still bind.** Node must be `24.18.0` to match `.node-version`
  (D-24205); `boardgame.io` stays on the `^0.50.0` line. A lab on a newer Node or
  bgio is testing a different system than production.
- **Certbot + unattended-upgrades are now yours.** Certificate renewal and kernel
  patches are operator responsibilities on a droplet that Render otherwise absorbs;
  unattended-upgrades may schedule a reboot.

## Open Questions

- **Production disposition is undecided.** Whether any workload should leave Render
  is not recorded in [DECISIONS.md](../docs/ai/DECISIONS.md). This lab is
  exploratory. Promoting it to production topology would require a Work Packet, a
  `DECISIONS` entry, and a check against the server-layer boundary in
  [`.claude/rules/architecture.md`](../.claude/rules/architecture.md).
- **Managed vs self-hosted Postgres for any eventual co-located phase** — open. The
  lab exists partly to answer it with a rehearsed restore rather than a guess.
- **The latency threshold that would make a stateless-server move acceptable** —
  to be established empirically from the probe in Mechanics §4.

## References

- [`render.yaml`](../render.yaml) — the blueprint-managed production infra source
  (authoritative for plan values): server `plan: standard`, the managed-DB `plan`,
  the `sync: false` secret set, and the build/start commands this runbook mirrors.
- [Architecture & Library Adoption Inventory](architecture-inventory.md) — Render
  account model & sizing, managed-database operational notes, and deployment
  topology (generated by `scripts/architecture-inventory.mjs`).
- [`docs/ops/DOMAINS.md`](../docs/ops/DOMAINS.md) and
  [`docs/ops/domains.json`](../docs/ops/domains.json) — canonical subdomain manifest
  and ops runbook for the live hosts.
- [Development Workflow](development-workflow.md),
  [Operational Health Checks](operational-health-checks.md),
  [Data & File Locations](data-file-locations.md),
  [Workspace Map](workspace-map.md) — companion operator references.
