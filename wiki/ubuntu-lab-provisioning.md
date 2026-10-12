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
  - ai-second-brain.md
  - render-migration-analysis.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\ubuntu-lab-provisioning.md (this page — https://ewiki.legendary-arena.com/ubuntu-lab-provisioning/)
  - ../render.yaml
  - ../docs/ops/DOMAINS.md
  - ../docs/ops/domains.json
  - C:\pcloud\LA\ops\accounting\expenses2026\render-Invoice-0SPQWPNF-0005.pdf (Render bill, Aug 2026)
  - C:\pcloud\LA\ops\accounting\expenses2026\render-Invoice-0SPQWPNF-0006.pdf (Render bill, Sep 2026)
last-reviewed: 2026-10-11
---

# Ubuntu Lab Provisioning

> **Governance status.** The decision to move `api.legendary-arena.com` and its
> PostgreSQL off Render is made, and the `legendary-arena-lab` program repo is
> executing it (`docs/PLAN.md`, `infra/`). Its transcription into the engine repo
> (a `DECISIONS.md` entry and a migration Work Packet) is pending; until it lands,
> the program repo is the governing source and this page stays `status: draft`.
> The ewiki half of the move is already recorded as D-24690.

## Summary

The Ubuntu 24.04 DigitalOcean host that will replace Render for the game server
and its PostgreSQL: one box running Nginx behind Cloudflare, the Node server,
and a self-hosted PostgreSQL under systemd, with backups to Cloudflare R2. This
page records the target architecture, what the operator takes over, and the
provisioning, restore and rebuild procedure. The cost, sizing and vendor
analysis behind it is on the Render Migration Analysis page.

## Mechanics

### Target architecture

```text
Players
   │
Cloudflare  (DNS, proxy, TLS to the origin)
   │
DigitalOcean droplet, Ubuntu 24.04 LTS, sfo3
   ├─ Nginx          (reverse proxy, WebSocket upgrade for Socket.IO)
   ├─ apps/server    (Node 24.18.0, under systemd)
   └─ PostgreSQL 18  (localhost only)
   │
pg_dump  →  Cloudflare R2  (backups)
```

- **Is becoming:** the production host for `apps/server` and a self-hosted
  PostgreSQL 18 — the target architecture locked in the migration PLAN. The
  server and database share one box, so there is no cross-provider hop (the
  alternatives weighed are in
  [Architecture candidates](render-migration-analysis.md#architecture-candidates-decided)).
- **Is not yet carrying production traffic.** Until cutover, the box is
  provisioned and rehearsed against a **copy** of the data, never the live prod
  DB. Render's managed Postgres allows credential-gated public inbound
  (`ipAllowList: ['0.0.0.0/0']` in `render.yaml`) — a footgun, not an
  invitation. Render stays warm as the rollback target until the decommission
  phase (live-until-cutover topology:
  [Architecture & Library Adoption Inventory](architecture-inventory.md)).

### Why the platform is changing

1. **Cost.** Render bills about $146 a month (August and September 2026). The
   droplet starts at $24, about $1,470 a year less
   ([Cost case](render-migration-analysis.md#cost-case-september-2026)).
2. **Control.** Full OS access, infrastructure-as-code the business owns, and
   recovery procedures that can be rehearsed rather than trusted.
3. **Operator capability.** A proven ability to provision, rebuild, restore and
   recover the environment without depending on one vendor.

When the box was planned in July, cost looked roughly even and control was the
driver. Render's plans were raised under load that month, and cost became a
driver too.

### Target configuration

| Part | Setting |
|---|---|
| Host | DigitalOcean `sfo3`, Ubuntu 24.04 LTS, 2 vCPU / 4 GB / 80 GB SSD ($24/mo), 2 GB swapfile (lab D-002). Resize path: 4 vCPU / 8 GB ($48), on evidence ([Sizing from measured use](render-migration-analysis.md#sizing-from-measured-use-2026-10-11)). |
| Application | `apps/server` on Node 24.18.0, run by a systemd unit. |
| Database | Self-hosted PostgreSQL 18 on `localhost`. |
| Edge | Cloudflare in front; Nginx terminates TLS with a Cloudflare Origin Certificate. |
| Deploy | GitHub Actions → SSH → `git pull` + build + `systemctl reload`. |
| Backups | `pg_dump` to R2; restore rehearsed (§5) and full rebuild rehearsed (§6). |
| Monitoring | Documented monitoring is a cutover gate owned by the program. |

The executable versions — cloud-init, the numbered provisioners, the systemd
unit, the TLS setup and the deploy pipeline — live in the `legendary-arena-lab`
repo (`infra/`, `content/`, and its operator wiki), and they are authoritative.
§1–§6 below are the original hand-run rehearsal procedure, kept because they
show what each provisioner does.

### Prerequisites & effort

- A DigitalOcean account with an SSH key pair already uploaded.

  **Account status (2026-10-04).** The account is open but has **no payment
  method**, so it cannot create a droplet yet. Usage is $0 and no resources
  exist. The account also holds a $5 "Inference Cloud Trial" credit that
  expires 2026-10-21. It is named for the inference products, so do not count
  on it covering droplet usage. Remaining setup, in order:
  1. Add a payment method (operator only).
  2. Set a spend alert a little above the planned droplet price, for example
     $30 a month for the $24 box (raise it on a resize). The billing page now offers spend alerts.
  3. Upload the SSH public key, and create an API token if provisioning goes
     through `doctl` or Terraform.
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

- **Region:** `sfo3` (San Francisco). Socket.IO rides Cloudflare to the
  origin, so origin round-trip time reaches live matches, and San Francisco
  serves a West Coast player base.
- **Image and size:** per [Target configuration](#target-configuration). The
  swapfile is `infra/scripts/08-swap.ps1` in the lab repo.
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

> **Rehearsal procedure — superseded for the real host.** §2 and §3 run the
> server under PM2 and issue the certificate with Certbot, as the first hand-run
> lab did. The target host uses a **systemd** unit and a **Cloudflare Origin
> Certificate**; follow the lab repo's `infra/` provisioners for those. The
> Node pin, the Nginx WebSocket block and the copy-only database rule below
> still apply as written.

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
        proxy_pass http://127.0.0.1:3000;      # apps/server port — export PORT=3000 (§3); it defaults to 8000
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
export PORT=3000                                    # apps/server defaults to 8000
                                                    # (process.env.PORT ?? '8000'); pin it to
                                                    # match the Nginx proxy_pass in §2

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

### 4 — Latency probe (moot)

The first lab plan measured app↔DB latency across providers, as the gate on a
"move only the server, keep Render Postgres" option. The target co-locates the
database on `localhost`, so there is no hop to measure and this is not a step.
Why that option was weighed and dropped is under
[Architecture candidates](render-migration-analysis.md#architecture-candidates-decided).

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

### Operational ownership

Render owns each of these today; on the droplet they become the operator's:

- Host maintenance and OS/kernel security patching
- Service lifecycle (restarts, health recovery, deploy pipeline)
- Managed Postgres operations (tuning, connection management, version upgrades)
- Backup infrastructure and point-in-time recovery
- Service monitoring and alerting
- Platform-level security updates

The program has **accepted** this transfer. The single-box SPOF that comes with
it is mitigated by tested `pg_dump` → R2 backups and a rehearsed restore and
rebuild (§5–6), which the PLAN makes a hard gate before cutover.

### What a successful lab looks like

Descriptive, not a pass/fail gate: the lab has served its purpose once the
operator can, unaided —

- provision a fresh Ubuntu host from scratch,
- deploy `apps/server` against a lab database,
- perform a complete Postgres backup **and** restore,
- recover the host after a simulated failure (the §6 rebuild),
- rotate TLS certificates and application secrets, and
- patch and maintain the host across at least one release cycle.

## Interactions

- **[Render Migration Analysis](render-migration-analysis.md)** — the cost
  case, measured-use sizing, vendor comparison and survey, and architecture
  candidates behind the [Target configuration](#target-configuration).
- **[AI Second Brain](ai-second-brain.md)** — gets its own host; this box is
  below its 8 GB floor. Its runbook hardens that host per §1.
- **[Architecture & Library Adoption Inventory](architecture-inventory.md)** —
  the authoritative live picture this lab shadows: Render account model and
  sizing (server `pro`, Postgres `pro-4gb`, both raised under load in July
  2026; treat `render.yaml` as authoritative if the generated inventory ever
  lags a plan change), the
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

- **Region is about players now, not the database.** `sfo3` was first picked
  as the closest region to Render's Oregon DB. Co-location removed that hop, but
  origin round-trip time still reaches live matches through Cloudflare, so keep
  the West Coast pin. A central-US host would trade West Coast latency for
  national evenness.
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
- **Certificates and kernel patches are now yours.** Certificate renewal (Certbot
  in the hand-run steps, the Cloudflare Origin Certificate in the program) and
  kernel patches are operator responsibilities on a droplet that Render otherwise
  absorbs; unattended-upgrades may schedule a reboot.

## History

- **2026-07** — The box was planned as an operator learning lab and staging
  host, with PM2, Certbot and a cross-provider latency probe (§2–§4). Render's
  plans were raised under load the same month.
- **2026-07-25 to 2026-10-04** — The migration stalled, then restarted;
  `legendary-arena-lab` #17 and #18 fixed the provisioners and proved them in CI
  on Ubuntu 24.04.
- **Program decisions since** — systemd replaced PM2, a Cloudflare Origin
  Certificate replaced Certbot, and co-located `localhost` PostgreSQL replaced
  the managed-database options, which made the latency probe moot.
- **2026-10-11** — The ewiki moved off Render to an assets-only Cloudflare
  Worker (D-24690). The droplet was sized from measured Render use at 2 vCPU /
  4 GB with a 2 GB swapfile (lab D-002, `legendary-arena-lab` #19); it is too
  small to also host the [AI Second Brain](ai-second-brain.md), and driving-only
  voice doesn't require local STT/TTS on either host. The cost, vendor and
  architecture analysis moved to
  [Render Migration Analysis](render-migration-analysis.md).

## Open Questions

- **Governance transcription is pending.** The move of `api.` and Postgres off
  Render is decided at the program level but not yet recorded in
  [DECISIONS.md](../docs/ai/DECISIONS.md) (only the ewiki half is, as
  D-24690), and it has no migration Work Packet. Until both land, this page cites
  the migration PLAN rather than a `D-`/`WP-` ID and stays `status: draft`.

**Remaining actions**, in order (the execution gates are owned by the program):

1. Transcribe the migration decision into `DECISIONS.md`.
2. Publish the migration Work Packet, including a check against the
   server-layer boundary in
   [`.claude/rules/architecture.md`](../.claude/rules/architecture.md).
3. Pass the cutover gates: a validated backup and a **tested** restore and
   rebuild (§5–6), and documented monitoring.
4. Cut over, with a tested rollback (repoint Cloudflare DNS `api.` → Render).
5. Decommission Render after a deliberately short rollback window.

## References

- [`render.yaml`](../render.yaml) — the blueprint-managed production infra source
  (authoritative for plan values): server `plan: pro`, the managed-DB `plan: pro-4gb`,
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
