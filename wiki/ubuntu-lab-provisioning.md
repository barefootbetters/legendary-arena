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
  - migration
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
last-reviewed: 2026-07-24
---

# Ubuntu Lab Provisioning

> **Migration in progress.** `api.legendary-arena.com` and its PostgreSQL are
> moving off Render onto a self-hosted DigitalOcean Ubuntu droplet fronted by
> Cloudflare, and the ewiki moves to Cloudflare Pages. The move is decided at the
> migration-program level: the `legendary-arena-lab` repo holds the runbook and the
> infrastructure-as-code (`docs/PLAN.md`, `infra/`, and its operator wiki). Until
> the final decommission phase, Render stays warm as the rollback target (see the
> [Architecture & Library Adoption Inventory](architecture-inventory.md) for the
> live-until-cutover topology). This page defines nothing and governs nothing — it
> is the engine-repo record that the migration is happening; the program repo owns
> the executable steps.
>
> **Governance status — pending transcription.** This page is being flipped ahead
> of the engine-repo governance it will ultimately cite. The `DECISIONS.md` lock
> ("api + Postgres leave Render for DigitalOcean + Cloudflare; ewiki → Cloudflare
> Pages") and the migration Work Packet are **not yet written** — the latest
> decision at this revision is D-24236. Until they land, the migration PLAN in the
> `legendary-arena-lab` repo is the governing source; this page stays
> `status: draft` and deliberately cites no `D-`/`WP-` IDs it cannot yet resolve.
> The former "records no decision to leave Render" disclaimer is superseded: that
> decision is made — only its transcription into `DECISIONS.md` is outstanding.

## Summary

The single DigitalOcean droplet (Ubuntu 24.04 LTS) that `api.legendary-arena.com`
and its PostgreSQL are migrating onto, with Postgres self-hosted on the same box
and Cloudflare in front. The migration program sizes the target at **4 vCPU / 8 GB
to start** (stepping down to 4 GB if it runs idle), not the original 2 vCPU / 4 GB
lab spec.

This page is the engine-repo **record** of that migration. The executable
runbooks and infrastructure-as-code — cloud-init, the numbered provisioners,
Nginx + Cloudflare TLS, self-hosted Postgres, the systemd unit, and the SSH
deploy pipeline — live in the **`legendary-arena-lab`** repo (`infra/`,
`content/`, and its operator wiki). The hand-run steps below are retained as the
original rehearsal procedure and as background; where they differ from the program
(PM2 → systemd, Certbot → Cloudflare Origin Certificate, cross-provider probe →
co-located localhost DB), the program's `infra/` artifacts are authoritative.

The operator-capability and disaster-recovery-rehearsal value that first justified
the box still holds — but the box is no longer exploratory. The move is decided
(see the callout) and in progress; cost is roughly a wash, so control and
capability are the drivers, not the bill.

## Mechanics

### What this host is — and the migration phase it is in

- **Is becoming:** the production host for `apps/server` and a self-hosted
  PostgreSQL 18, behind Nginx + Cloudflare, under systemd — the target
  architecture locked in the migration PLAN (`legendary-arena-lab` repo).
- **Is not yet carrying production traffic.** Until the cutover phase, the box is
  provisioned and rehearsed against a **copy** of the data, never the live prod
  DB. The Render managed Postgres allows credential-gated public inbound
  (`ipAllowList: ['0.0.0.0/0']` in `render.yaml`) — that is a footgun, not an
  invitation; rehearsal always runs against a restored copy (see the Restore
  drill). Render stays warm as the rollback target through the decommission phase.

Self-hosting Postgres on this box is now the **chosen** path, not an open
question: the migration PLAN co-locates the server and database on one host
(no cross-provider hop). What remains is the disciplined execution and the
governance transcription noted in the callout — not the architecture decision.

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
matches. That single property is what makes relocating the server — which this
migration does — safe in the first place. "Stateless" here means
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

### 4 — Latency probe (superseded by the co-located target — historical)

> **Moot for the chosen architecture.** The migration co-locates the server and
> PostgreSQL on the same host (app ↔ DB over `localhost`), so the cross-provider
> app↔DB hop this probe measured no longer exists. This section is retained as
> background for why a "keep Postgres on Render" option was rejected; it is not a
> step in the migration.

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

This list is the operational cost side of the migration, and the program has
**accepted** the transfer: patching, service lifecycle, Postgres operations,
backups/point-in-time recovery, monitoring, and platform security updates become
operator responsibilities. The single-box SPOF that comes with it is mitigated by
tested `pg_dump` → R2 backups and a rehearsed restore (Mechanics §5–6), which the
PLAN makes a hard gate before cutover.

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

### Architecture candidates (decided — retained as evaluation history)

The evaluation is now resolved. The migration PLAN selects a **single
self-hosted host with the server and PostgreSQL co-located** on it (Ubuntu server
+ self-hosted Ubuntu Postgres on one box, no cross-provider hop) — the family of
Options C/D below, minus a second database server. The table is retained as the
record of what was weighed and why the highest-risk option was avoided:

| Option | Configuration | Notes |
|---|---|---|
| **A** | Render server + Render Postgres | Current production. |
| **B** | Ubuntu server + Render Postgres | Stateless-server move only; introduces the cross-provider app↔DB hop the §4 probe measures. |
| **C** | Ubuntu server + managed Postgres (co-located) | Self-hosted app tier, DB still managed, app and DB back on one fast private network. |
| **D** | Ubuntu app server + Ubuntu database server | Fully self-managed. |
| **E** | Render server + self-hosted Ubuntu Postgres | **Highest-risk of the set — avoid.** Self-hosts the crown-jewel DB *and* forces the app↔DB link over the public internet, inverting the safer "self-host the stateless tier first, keep the stateful tier managed" ordering. |

The choice is made at the migration-program level (`legendary-arena-lab` repo,
`docs/PLAN.md`). Its transcription into an engine-repo `DECISIONS` entry and a
migration Work Packet is the pending governance noted in the callout.

## Interactions

- **[Architecture & Library Adoption Inventory](architecture-inventory.md)** —
  the authoritative live picture this lab shadows: Render account model and
  sizing (server `standard`; the managed Postgres, pinned in `render.yaml`, was
  bumped `basic-1gb` → `pro-4gb` under load — treat `render.yaml` as
  authoritative when the generated inventory lags a plan change), the
  managed-database notes, and the full deployment topology. Read it first.
- **[Development Workflow](development-workflow.md)** — the production
  develop-from-anywhere loop (Claude Code → GitHub → auto-deploy on merge to
  `main`). The migration replaces Render's push-to-main auto-deploy with a GitHub
  Actions → SSH → `git pull` + build + `systemctl reload` pipeline (owned by the
  `legendary-arena-lab` program); the hand-run steps on this page are its manual,
  rehearsal-time equivalent.
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

- **Governance transcription is pending (the one real open item).** The decision
  to move `api.` + Postgres off Render is made at the migration-program level, but
  it is **not yet recorded** in [DECISIONS.md](../docs/ai/DECISIONS.md) (latest
  entry D-24236) and has no migration Work Packet. Until both land, this page
  cites the migration PLAN rather than a `D-`/`WP-` ID and stays `status: draft`.
  The still-required execution gates are unchanged and now owned by the program:
  validated backup **and tested** restore (Mechanics §5–6), documented monitoring,
  a tested rollback (repoint Cloudflare DNS `api.` → Render), the
  operational-burden transfer (accepted — see Ownership boundary), and a check
  against the server-layer boundary in
  [`.claude/rules/architecture.md`](../.claude/rules/architecture.md).
- **Managed vs self-hosted Postgres** — decided: self-hosted on the same host
  (co-located, `localhost`), per the PLAN. No longer open.
- **The cross-provider latency threshold** — moot: the co-located target removes
  the app↔DB hop the Mechanics §4 probe measured.

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
