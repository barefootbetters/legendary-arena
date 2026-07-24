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

> **Draft, non-production.** A proposed personal DigitalOcean Ubuntu box used as a
> **learning lab, staging host, and future migration-rehearsal target** — not a
> production cutover. Production runs on Render + Cloudflare (see the
> [Architecture & Library Adoption Inventory](architecture-inventory.md)). No
> decision to leave Render is recorded in
> [DECISIONS.md](../docs/ai/DECISIONS.md); making this box production topology
> would need its own Work Packet and `DECISIONS` entry. This page defines nothing
> and governs nothing — it is a walkthrough.
>
> **The lab exists to build operator capability and generate objective
> measurements. It does not constitute a recommendation to leave Render, nor does
> it establish future production architecture.**

## Summary

A single ~$24/mo DigitalOcean droplet (Ubuntu 24.04 LTS, 2 vCPU / 4 GB / 80 GB
SSD) bought purely as an operator lab, to:

- **Build portable Linux-operations skill** — Nginx, PM2, systemd, Certbot, UFW,
  unattended-upgrades.
- **Provide the staging target the project lacks** — `render.yaml` sets
  `pullRequestPreviewsEnabled: false` and runs no staging service.
- **Rehearse the risky parts of a possible future migration** — self-hosted
  Postgres backup/restore, cross-provider database latency — without ever putting
  production at risk.

Cost savings are a secondary benefit, not a justification for any production
infrastructure change.

## Mechanics

### What the lab is — and is not

- **Is:** a personal Linux box for learning Nginx / PM2 / systemd / Certbot /
  UFW; a staging target for `apps/server`; a sandbox to measure and rehearse
  before any production move.
- **Is not:** production, and not pointed at the production database. The Render
  managed Postgres currently allows credential-gated public inbound
  (`ipAllowList: ['0.0.0.0/0']` in `render.yaml`) — treat that as a footgun, not
  an invitation. The lab always runs against a **copy** of the data (see the
  Restore drill).

The Postgres installed on the lab exists **solely** to support backup, restore,
and operational-training exercises. Its presence does **not** imply self-hosted
Postgres is the preferred future production architecture — that question is open
(see Open Questions).

### Prerequisites & effort

- A DigitalOcean account with an SSH key pair already uploaded.
- A throwaway lab hostname (e.g. `lab.<your-domain>`) ready to point at the
  droplet IP.
- Familiarity with the production topology in the
  [Architecture Inventory](architecture-inventory.md).
- A local repo clone and the ability to produce a Postgres dump from a
  **non-production** source.

**Effort:** first full provision ~2–4 hours; rebuilds are much faster once the
procedure is muscle memory (that speed is itself the §6 goal).

### Why "the server is relocatable at all"

`apps/server` is **persistence-stateless**: live match state is written to Postgres
(the boardgame.io adapter's `bgio` schema), so a server restart does not drop live
matches. That single property makes an app-tier lab (and any eventual
Option-E-style move of the stateless server) possible. "Stateless" here means
*persistence-stateless*, **not** *connection-stateless* — live WebSocket
connections and the server's cron singletons (legends publisher, match reaper,
capture harvester) still live in-process. One box is fine; see Edge Cases for what
multi-node would additionally require.

### 1 — Provision the droplet

- **Region:** pin to the **nearest DigitalOcean US-West region to the Render
  Postgres**. The managed DB is in **Oregon** (per the inventory's managed-database
  notes); DigitalOcean has no Oregon region, so `sfo3` (San Francisco) is the
  closest. It is *not* co-located with Oregon, which is fine — the §4 latency probe
  then measures the realistic cross-provider hop, which is exactly the number worth
  knowing.
- **Image:** Ubuntu 24.04 (LTS). **Size:** 2 vCPU / 4 GB / 80 GB SSD (~$24/mo).
- **Auth:** SSH key only. Create via the DigitalOcean UI or `doctl`.

Baseline hardening (first boot as root, create the working user, then switch to it):

```bash
adduser operator && usermod -aG sudo operator      # non-root working user
# Log out, back in as operator, then harden SSH:
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl reload ssh

sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable   # 'Nginx Full' = 80 + 443

sudo apt update && sudo apt install -y fail2ban unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades    # enable auto security patches
```

### 2 — Base application stack

Install Node **before** the global `pm2`, and match the repo pin exactly
(`.node-version` → `24.18.0`, D-24205) — a version manager keeps that pin explicit:

```bash
curl -fsSL https://fnm.vercel.app/install | bash   # or nvm
source ~/.bashrc
fnm install 24.18.0 && fnm use 24.18.0 && fnm default 24.18.0
node -v                                            # confirm v24.18.0
corepack enable                                    # pnpm per the packageManager pin

sudo apt install -y git nginx postgresql certbot python3-certbot-nginx  # OS-level pieces
sudo npm install -g pm2                            # after Node is on PATH
```

`apt` installs only the **OS-level** pieces (Nginx, PM2's runtime, the lab
**Postgres server**). The application's own runtime dependencies —
`boardgame.io`, `pg`, the `@legendary-arena/*` workspace packages — are **not**
system packages: they come from `pnpm install` (§3) and run **inside** the Node
process. There is nothing to `apt install` for boardgame.io.

Nginx as a TLS-terminating reverse proxy. Point `lab.<your-domain>` at the droplet
IP, run `sudo certbot --nginx -d lab.<your-domain>`, and use a server block whose
`location /` forwards WebSocket upgrades (Socket.IO needs the `Upgrade`/`Connection`
headers, or live match traffic silently fails):

```nginx
server {
    server_name lab.<your-domain>;
    location / {
        proxy_pass http://127.0.0.1:3000;      # the port apps/server listens on
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade; # WebSocket upgrade for Socket.IO
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    # Certbot inserts the listen 443 / ssl_certificate lines here.
}
```

### 3 — Deploy `apps/server` against a COPY of the DB

The build/start commands mirror what `render.yaml` runs; the difference is the lab
runs them by hand under PM2 instead of Render's build pipeline:

```bash
git clone <repo-url> legendary-arena && cd legendary-arena
pnpm install && pnpm -r build                      # same as render.yaml buildCommand

# Create the lab role + database once (never the production DB):
sudo -u postgres createuser -P la_lab              # prompts for a lab password
sudo -u postgres createdb -O la_lab la_lab
export DATABASE_URL="postgres://la_lab:<password>@localhost:5432/la_lab"

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

A production "move only the stateless server, keep managed Postgres" step would put
the app↔DB link across the public internet instead of Render's internal network. A
boardgame.io move handler issues many small queries, and the bot-ally poll runs
every 250 ms per live match — a chatty, latency-sensitive profile. Stand the server
on the droplet, point it at a **copy** DB reachable over the same provider boundary
you would use in production (the §1 region), and measure per-round-trip query
latency under a simulated match load. Treat the result as the gate on whether that
move is worth doing — measure, don't assume.

### 5 — Restore drill (rehearse before self-managed PG ever touches prod)

Self-hosting Postgres means owning backups and restores. Rehearse it on the lab
against a copy, on a schedule, until it is boring:

```bash
pg_dump "$SOURCE_COPY_URL" -Fc -f /tmp/la-lab.dump # capture from a NON-prod source
createdb la_restore_test                           # fresh target
pg_restore -d la_restore_test /tmp/la-lab.dump     # restore
# Verify: row counts on key legendary.* tables, and that apps/server starts
# clean against the restored copy. A restore you have not tested is not a backup.
```

### 6 — Disaster-recovery exercise (full rebuild from docs)

The restore drill proves the data; this proves the *whole procedure*. At least
once, destroy the entire lab host and rebuild it using only what is written down —
no memory, no undocumented step. A rebuild has demonstrated recovery when a fresh
host is provisioned, the app redeployed, Postgres restored from a backup, TLS
re-established, and `/health` returns green — all from the documented steps alone.
Backups are only proven after a full recovery has actually been demonstrated.

The authoritative, executable version of this exercise — recovery objectives
(RPO/RTO), the DR-01…DR-05 scenario procedures, and the binary
business-capability validation checklist — lives in the operator runbook at
[`docs/ops/DISASTER_RECOVERY.md`](../docs/ops/DISASTER_RECOVERY.md) (a
prescriptive runbook, deliberately kept out of the descriptive ewiki). This lab
is where that runbook is *rehearsed*; the runbook is what you follow when it is
not a drill.

### Ownership boundary (what a self-managed move would transfer)

Render currently owns, and a move to a self-managed droplet would transfer to the
operator, each of the following:

- Host maintenance and OS/kernel security patching
- Service lifecycle (restarts, health recovery, deploy pipeline)
- Managed Postgres operations (tuning, connection management, version upgrades)
- Backup infrastructure and point-in-time recovery
- Service monitoring and alerting
- Platform-level security updates

This list is the operational cost side of any migration. Per the Summary, cost
reduction alone is not treated as a sufficient reason to accept that transfer.

### What a successful lab looks like

Descriptive, not a pass/fail gate: the lab has served its purpose once the
operator can, unaided —

- provision a fresh Ubuntu host from scratch,
- deploy `apps/server` against a lab database,
- perform a complete Postgres backup **and** restore,
- recover the host after a simulated failure (the §6 rebuild),
- rotate TLS certificates and application secrets,
- measure and document app↔database latency (§4), and
- patch and maintain the host across at least one release cycle.

### Future architecture candidates (evaluation out of scope)

The lab is the instrument for *evaluating* — not selecting — where the workloads
could run:

| Option | Configuration | Notes |
|---|---|---|
| **A** | Render server + Render Postgres | Current production. |
| **B** | Ubuntu server + Render Postgres | Stateless-server move only; introduces the cross-provider app↔DB hop the §4 probe measures. |
| **C** | Ubuntu server + managed Postgres (co-located) | Self-hosted app tier, DB still managed, app and DB back on one fast private network. |
| **D** | Ubuntu app server + Ubuntu database server | Fully self-managed. |
| **E** | Render server + self-hosted Ubuntu Postgres | **Highest-risk of the set — avoid.** Self-hosts the crown-jewel DB *and* forces the app↔DB link over the public internet, inverting the safer "self-host the stateless tier first, keep the stateful tier managed" ordering. |

Choosing among these is explicitly outside this page's scope; it would be the
subject of a future migration Work Packet and `DECISIONS` entry.

## Interactions

- **[Architecture & Library Adoption Inventory](architecture-inventory.md)** —
  the authoritative live picture this lab shadows: Render account model and
  sizing (server `standard`; the managed Postgres, pinned in `render.yaml`, was
  bumped `basic-1gb` → `pro-4gb` under load — treat `render.yaml` as
  authoritative when the generated inventory lags a plan change), the
  managed-database notes, and the full deployment topology. Read it first.
- **[Development Workflow](development-workflow.md)** — the production
  develop-from-anywhere loop (Claude Code → GitHub → auto-deploy on merge to
  `main`). The lab is a manual, off-`main` sibling of that loop, not a replacement.
- **[Operational Health Checks](operational-health-checks.md)** — `pnpm check`
  walks toolchain and external-service connectivity (PostgreSQL, R2, Hanko, CORS);
  validate a lab deploy the same way production is validated.
- **[Data & File Locations](data-file-locations.md)** and
  **[Workspace Map](workspace-map.md)** — where the `legendary.*` tables, R2
  prefixes, and env/config live, so a lab copy pulls from the right places.

## Edge Cases

- **Region is nearest-not-same.** DigitalOcean has no Oregon region; `sfo3` is the
  closest to Render's Oregon DB. Pin the droplet there so the §4 probe reflects a
  realistic hop rather than a cross-continent worst case — but do not read the
  result as *co-located* latency.
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
  it is real wall-clock time, not Render's managed pipeline.
- **Version pins still bind.** Node must be `24.18.0` to match `.node-version`
  (D-24205); `boardgame.io` stays on the `^0.50.0` line. A lab on a newer Node or
  bgio is testing a different system than production.
- **Certbot + unattended-upgrades are now yours.** Certificate renewal and kernel
  patches are operator responsibilities on a droplet that Render otherwise absorbs;
  unattended-upgrades may schedule a reboot.

## Open Questions

- **Production disposition is undecided.** Whether any workload should leave Render
  is not recorded in [DECISIONS.md](../docs/ai/DECISIONS.md). This lab is
  exploratory. Promoting it to production topology would require, at minimum: an
  approved migration Work Packet; a corresponding `DECISIONS` entry; validated
  backup and restore procedures (Mechanics §5–6); documented production monitoring;
  documented **and tested** rollback procedures; the operational-burden transfer
  (see Ownership boundary) explicitly accepted by the operator; and a check against
  the server-layer boundary in
  [`.claude/rules/architecture.md`](../.claude/rules/architecture.md). These are the
  conditions a move would have to clear — not a commitment that it will happen.
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
- [`docs/ops/DISASTER_RECOVERY.md`](../docs/ops/DISASTER_RECOVERY.md) — the
  authoritative operator disaster-recovery runbook this lab rehearses.
- [`docs/ops/DOMAINS.md`](../docs/ops/DOMAINS.md) and
  [`docs/ops/domains.json`](../docs/ops/domains.json) — canonical subdomain manifest
  and ops runbook for the live hosts.
- [Development Workflow](development-workflow.md),
  [Operational Health Checks](operational-health-checks.md),
  [Data & File Locations](data-file-locations.md),
  [Workspace Map](workspace-map.md) — companion operator references.
