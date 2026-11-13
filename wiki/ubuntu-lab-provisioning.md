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
related:
  - architecture-inventory.md
  - development-workflow.md
  - operational-health-checks.md
  - disaster-recovery.md
  - data-file-locations.md
  - workspace-map.md
  - ai-second-brain.md
  - render-migration-analysis.md
  - system-backup.md
status: canonical
source:
  - C:\dev\legendary-arena\wiki\ubuntu-lab-provisioning.md (this page — https://ewiki.legendary-arena.com/ubuntu-lab-provisioning/)
  - ../render.yaml
  - ../docs/ops/DOMAINS.md
  - ../docs/ops/domains.json
  - C:\pcloud\legendary-arena\ops\accounting\expenses2026 (Render bills, Aug and Sep 2026)
  - C:\dev\legendary-arena-lab (infra/scripts, infra/systemd — the executable versions)
last-reviewed: 2026-11-13
---

# Ubuntu Lab Provisioning

> **Governance status.** The move of `api.legendary-arena.com` and its PostgreSQL
> off Render is recorded as [D-24707](../docs/ai/DECISIONS.md) (Active
> 2026-10-12). It is an operational migration run by the `legendary-arena-lab`
> program repo (`docs/PLAN.md`, `infra/`), so it has no Work Packet. The ewiki
> half of the move is D-24690.

> **Current status (2026-11-12).** The migration is finished. Production has
> run on this droplet since 2026-10-12, and Render was deleted on 2026-10-22.
> Every step in [Open Questions](#open-questions) under "Migration" is done. The
> items still open are operating gaps found a month in: see
> [First month in production](#first-month-in-production-2026-10-12-to-2026-11-12)
> and the "Operating" list under Open Questions. The executable versions of
> everything here live in the `legendary-arena-lab` repo (`infra/scripts/`,
> `infra/systemd/`, `infra/cloud-init.yaml`) and win over this page; this page
> is the human-readable record.

## Summary

The Ubuntu 24.04 DigitalOcean host that replaced Render for the game server
and its PostgreSQL on 2026-10-12: one box running Nginx behind Cloudflare, the Node server,
and a self-hosted PostgreSQL under systemd, with nightly backups to Cloudflare
R2 and a pCloud mirror. This
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
   ├─ apps/server    (Node 24.18.0, systemd la-server on 127.0.0.1:3000;
   │                  la-server-standby on :3001 only during a deploy restart)
   └─ PostgreSQL 18  (localhost only)
   │
pg_dump  →  Cloudflare R2 (primary)  →  pCloud (mirror)   nightly 09:17 UTC
```

- **Is:** the production host for `apps/server` and a self-hosted
  PostgreSQL 18 — the target architecture locked in the migration PLAN. The
  server and database share one box, so there is no cross-provider hop (the
  alternatives weighed are in
  [Architecture candidates](render-migration-analysis.md#architecture-candidates-decided)).
- **Is provisioned and rehearsed (2026-10-11).** `la-rehearsal-01` passed every
  provisioner and a production-copy restore, and is kept as the cutover box; see
  [Rehearsal results](#rehearsal-results-2026-10-11).
- **Carries production since 2026-10-12.** `api.legendary-arena.com` is a
  proxied Cloudflare A record to this droplet, and its PostgreSQL 18 holds the
  production data (see [Cutover](#cutover-2026-10-12)). Before cutover the box
  was rehearsed only against a **copy** of the data, never the live prod DB.
  Render's managed Postgres allowed credential-gated public inbound
  (`ipAllowList: ['0.0.0.0/0']` in `render.yaml`) — a footgun, not an
  invitation; it stayed up only as the rollback copy. Render was deleted on
  2026-10-22, after the 7-day rollback window.

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
| Deploy | Automatic after CI passes on `main` ([`deploy-server.yml`](../.github/workflows/deploy-server.yml), D-24708): GitHub Actions → SSH as the restricted `deployer` user, whose key is pinned to the `la-deploy` gate (`41-deploy-user.ps1`) → `40-app-deploy.ps1` for the exact tested commit (install, build, migrations, restart, health gate). Hand deploys run `40` directly. |
| Backups | Nightly `pg_dump` (09:17 UTC) → local copy → R2 (production bucket `legendary-arena-db-backups` since cutover) → **pCloud mirror** (second vendor, permanent), each with its own health check; restore drill (§5), full rebuild (§6). The local backup and restore drill passed on 2026-10-11; the R2 upload, restore-from-R2, and the first production pCloud mirror passed on 2026-10-12. See [Offsite backups](#offsite-backups-r2--pcloud). |
| Monitoring | Provisioner `60` every 5 min (server, `/health`, `/health/db`, disk, backup age), plus pings after each backup and its pCloud mirror, to three healthchecks.io dead-man's-switch checks that email on a failure or a missing ping. Rehearsed 2026-10-12, including a real alert. UptimeRobot checks the public `api.…/health/db` path every 5 minutes (moved from `/health` on 2026-10-13, so a dead database alerts too). |

The executable versions — cloud-init, the numbered provisioners, the systemd
unit, the TLS setup and the deploy pipeline — live in the `legendary-arena-lab`
repo (`infra/`, `content/`, and its operator wiki), and they are authoritative.
§1–§6 below are the original hand-run rehearsal procedure, kept because they
show what each provisioner does.

### Database care

What `30-postgres.ps1` sets, and what PostgreSQL is left to do on its own:

| Area | Current state |
|---|---|
| Install source | The PostgreSQL project's own apt repo (PGDG, `apt.postgresql.org`), major version 18. |
| Memory | Sized from the box's RAM at provision time: `shared_buffers` 25% (979 MB on 4 GB), `effective_cache_size` 75%, `maintenance_work_mem` RAM/16 (max 1 GB). Re-run `30` after a resize so these follow the new RAM. |
| WAL | `wal_buffers` 16 MB, `min_wal_size` 1 GB, `max_wal_size` 4 GB. On an 80 GB disk with a 66 MB database this is generous, not tight. No WAL archiving (see [Disaster Recovery](disaster-recovery.md), RPO). |
| Connections | `listen_addresses = 'localhost'`, `scram-sha-256`. The server's `pg.Pool` is `max: 10` per process (`apps/server/src/db/database.ts`); during a deploy the `:3001` standby adds up to 10 more. That is well under PostgreSQL's default `max_connections` of 100, so PgBouncer would add a part with nothing to fix. |
| Autovacuum | Stock defaults, untuned. |
| `bgio.matches` growth | Rows are pruned: the WP-327 match reaper deletes finished matches 1 h after `gameover` and abandoned ones after 24 h. The table *file* doesn't shrink, though: deleted rows leave dead TOAST space that autovacuum makes reusable but never returns to disk. To get it back, run `52-vacuum-reclaim.ps1` (a one-shot `VACUUM FULL`, `la-server` stopped) per `docs/ops/RUNBOOK-db-storage-reclaim.md`. `60-monitor` alerts on disk use, which is the signal to do it. |
| `pg_stat_statements` | The extension came over from Render with the data (`51` pre-creates it), but `30` doesn't add it to `shared_preload_libraries`, so the extension exists and collects nothing; querying its view errors. Turning it on is one setting plus a PostgreSQL restart. Open item. |
| Minor updates | **Not automatic.** unattended-upgrades applies Ubuntu's own security pocket only (`07` doesn't widen `Allowed-Origins`), and PGDG is a third-party origin. PostgreSQL 18.x security releases install only when the operator runs `apt upgrade`. Open item. |
| Major upgrade (18 → 19+) | Not rehearsed. With a 66 MB database the simplest path is the one already proven: install the new major next to the old, `pg_dump` from 18, restore with `51-restore.ps1` into the new cluster, point `DATABASE_URL` at it. The 2026-10-12 cutover dump took 13 s. `pg_upgradecluster` is the in-place alternative. |

### Development parity with production

Production is Ubuntu 24.04, Node `24.18.0` (`.node-version`, D-24205), and
PostgreSQL 18. The development workstation is Windows 11. Three things
already keep the two from drifting:

- **CI builds and tests every change on Linux.** The engine's CI jobs run on
  `ubuntu-latest`, so path separators, case-sensitive file names, and line
  endings fail there before they reach the droplet.
- **The provisioners are tested on a fresh Ubuntu 24.04 in CI.**
  `provision-smoke` in the lab repo runs the whole chain, from cloud-init to
  deploy, on every infra change.
- **The droplet builds what it runs.** `40-app-deploy.ps1` installs and builds
  the exact tested commit on the box itself, never an artifact built on Windows.

Where Windows has cost time is at the hand-off to the box:

- Lab scripts `scp`'d from a Windows checkout arrived with CRLF line endings
  (2026-10-12). Install LF copies with `git show <commit>:<path>`.
- Secrets piped from PowerShell into `gh secret set` pick up a trailing CRLF.
  Use `--body`.

Two ways to get a closer local copy of production, if one is wanted:

- **WSL2 running Ubuntu 24.04**, with the same Node pin and PostgreSQL 18.
- **A throwaway droplet built by the same provisioners.** The 2026-10-22 DR-02
  drill built one in 13 m 31 s of hands-on time, at the 2/4 droplet's hourly
  rate (about $0.036 an hour).

Running the workstation itself on Ubuntu is a preference, not a parity
requirement. The checks above already run on Linux whatever OS the editor
is on.

### Rehearsal results (2026-10-11)

The provisioners were rehearsed end to end on a real droplet before any
production traffic: `la-rehearsal-01`, DigitalOcean `sfo3`, Basic 2 vCPU /
4 GB / 80 GB ($24/mo), Ubuntu 24.04.5. The droplet is **kept** as the cutover
box, so cutover day starts from a provisioned host rather than a blank one.

| Step | Result |
|---|---|
| cloud-init | Pass after a fix (bug 1 below): `operator` user, SSH key, PowerShell 7.6.6 |
| `05` SSH hardening | Pass: root login and password auth refused; key login as `operator` works |
| `06` UFW | Pass: only 22, 80, and 443 open |
| `07` fail2ban + unattended-upgrades | Pass |
| `08` swapfile | Pass: 2 GB, swappiness 10 |
| `10` Node / pnpm | Pass: Node 24.18.0, pnpm 10.32.1 |
| `20` Nginx | Pass: `/health` proxied on port 80 |
| `30` PostgreSQL | Pass: PostgreSQL 18.6; `shared_buffers` auto-set to 979 MB (25% of RAM) |
| `40` deploy | Pass in 71 s: engine `main` built, migrations run, systemd service healthy |
| `50` → `51` backup and restore drill | Pass: 41 tables, row counts identical; `51` refuses the live database without its flag |
| Production-copy restore | Pass after a fix (bug 2 below): 41 tables and 6,320 rows identical to production; `schema_migrations` 45 on both |
| `21` Cloudflare TLS | Pass, tested through `api-next.legendary-arena.com` (a proxied record pointed at the droplet): `/health` 200 through Cloudflare with SSL Strict, Socket.IO handshake 200, WebSocket upgrade 101, and the droplet IP on 443 times out because UFW admits only Cloudflare. Production `api.` was untouched |
| `50` offsite backup to R2 | Pass (2026-10-12), using the separate bucket `legendary-arena-db-backups-rehearsal`. `-Install` added rclone and the 09:17 UTC timer; one backup uploaded; `51 RESTORE_FROM_R2=latest` restored it with identical row counts; retention pruning on a synthetic 120-day history keeps 47 and flags 73 |
| `50` pCloud mirror | Pass (2026-10-12, production, after the cutover restore). The droplet got its own pCloud token (minted on the operator's desktop and written straight into the backup config, never displayed). Before installing it, the token was proven by listing the existing `db-backups/` folders. The first run's dump (15.4 MB) landed in pCloud byte-identical to the R2 object, and `la-droplet-pcloud` went green. The mirror reports to its own check: a missing token or a failed copy fails `la-droplet-pcloud` only, never `la-droplet-backup` |
| `60` monitoring | Pass (2026-10-12). Two healthchecks.io checks: `la-droplet-monitor` (5-min period, 10-min grace) and `la-droplet-backup` (cron `17 9 * * *` UTC, 2-h grace). `-Install` registered the 5-minute timer, and one monitor run and one backup run each pinged their check. Stopping `la-server` sent a failure ping ("la-server is not active; /health unreachable"), and the run after restarting it passed. The ping URLs live only in the droplet's root-only config |

**Measured on the 4 GB box.** The deploy build peaked at **1.37 GB used with
no swap**. Steady state with the server and Postgres running is about 800 MB
used and 3.1 GB available. That confirms the $24 sizing: the heaviest moment
used about a third of RAM.

**Two real bugs, both invisible to CI, both fixed in `legendary-arena-lab`:**
1. **Ubuntu 24.04 ships a system group named `operator` (gid 37).**
   cloud-init's `useradd operator` failed with "group operator exists", so
   the user and its SSH key were never created and the box was unreachable as
   `operator`. CI missed it because `provision-smoke` only schema-checks
   cloud-init and creates the user with its own command. Fixed in lab #22:
   `primary_group: operator` in cloud-init, and the same fix in
   `05-user-and-ssh.ps1`. Verified on a fresh boot.
2. **Production carries `pg_stat_statements`** (Render's query monitoring),
   and `51-restore` restores as the app role, which cannot create extensions.
   The restore failed at the first statement, and **the real cutover restore
   would have failed the same way.** Fixed in lab #23: `51` creates the dump's
   extensions as `postgres` first, then restores the rest as the app role.
   `provision-smoke` now covers this case.

**Data handling.** The production copy was a read-only `pg_dump` (15 MB, from
a 66 MB database). The operator ran the copy to the droplet and the restore
by hand. Afterwards every copy was deleted: the local dump, the copy on the
droplet, and the restored scratch database. Production was never written to.

**How strict TLS is set.** The zone runs SSL mode **Full**, not strict, and
stays that way. Full (strict) applies only to the api hostnames, through the
Configuration Rule `Origin TLS strict — api hosts`, so no other site on the
zone is affected. The Cloudflare Origin Certificate covers
`api.legendary-arena.com` and `api-next.legendary-arena.com` only (no wildcard)
and is valid to 2041. The operator created it and installed it on the droplet
personally; the private key went nowhere else. **Renewal** is the operator's,
and nothing reminds anyone before 2041: issue a new Origin Certificate in
Cloudflare for the same two hostnames, then re-run `21-cloudflare-tls.ps1`
with `CF_ORIGIN_CERT` / `CF_ORIGIN_KEY` pointing at the new pair. The master
copy sits in the private ops folder with the other keys. At cutover `api.` joined the
rule, and its record changed from the DNS-only CNAME to Render into a
proxied A record to the droplet. Rollback restores that CNAME exactly.

**External uptime monitor (2026-10-12).** UptimeRobot (free plan) checks
`https://api.legendary-arena.com/health/db` every 5 minutes and emails on failure
(it watched `/health` until 2026-10-13, when it moved to the route that also
runs `SELECT 1` against PostgreSQL, D-24711).
The on-box check calls `127.0.0.1`, so it never tests DNS, Cloudflare, Nginx, or
TLS; this monitor does. It was green against Render before cutover and followed
`api.` to the droplet with no change.

**Cutover done 2026-10-12.** Cutover results: see the cutover section below.

### Cutover (2026-10-12)

Production moved to the droplet on **2026-10-12, around 12:00–12:30 PDT
(about 19:00–19:30 UTC)**. That was earlier than the planned 11 PM window: a
read-only check showed no active matches in the previous 15 minutes and 4
matches created in the previous 24 hours, so a quiet midday window cost players
nothing and left the afternoon to watch the box. UptimeRobot recorded one
outage of **10 m 10 s** (at its 5-minute check granularity).

The steps performed:

1. **Rollback rehearsed first.** `api-next` was switched to a DNS-only CNAME to
   Render and back to the proxied A record. Each change was visible in public
   DNS within seconds.
2. **Render suspended.** The web service `legendary-arena-server` was
   suspended, so nothing wrote to the Render database during the final dump.
   Both `api.` and the onrender hostname then answered `503`.
3. **Final dump restored.** A read-only `pg_dump` (14.6 MB, 13 s) was restored
   into the droplet's live database with `51-restore.ps1`
   (`RESTORE_ALLOW_LIVE_TARGET=true`, `la-server` stopped). Every table
   matched the source: **41 tables, 6,425 rows**, and `schema_migrations` 45.
   The dump was then deleted from the droplet and the operator's desktop.
4. **Legends publisher moved.** `LEGENDS_PUBLISHER_ENABLED=true` on the
   droplet, and `false` in Render's environment. Only the box with the live
   database publishes. The first droplet publish succeeded right away.
5. **DNS switched.** `api.legendary-arena.com` joined the
   `Origin TLS strict — api hosts` Configuration Rule, and its record changed
   from the DNS-only CNAME to Render into a proxied A record to the droplet.
6. **Render's custom domain removed (unplanned).** Traffic for `api.` kept
   reaching Render's "Service Suspended" page, even when pinned to the
   Cloudflare edge (`x-render-routing: suspend-by-user`). Render had registered
   `api.` as a custom hostname in its own Cloudflare for SaaS account, and that
   overrides the zone's own record. Deleting the custom domain in Render's
   dashboard fixed it at once.
7. **Verified.** Through Cloudflare: `/health` returned 200,
   `/health/legends-publisher` was ok, the Socket.IO handshake returned 200
   and the WebSocket upgrade 101, and the droplet IP refused direct
   connections. A signed-in match was then played end to end and landed in the
   droplet's database. There were no server errors.
8. **Backups switched.** `50-backup.ps1` now writes to the production bucket
   `legendary-arena-db-backups` and mirrors to pCloud. The first run
   (15.4 MB) landed in both places, byte-identical. The healthchecks.io checks
   `la-droplet-monitor`, `la-droplet-backup` and `la-droplet-pcloud` are green.
   This repo's `db-backup.yml` nightly was disabled (`gh workflow disable`) and
   was deleted on 2026-10-22.

**Rollback (7-day window, to ~2026-10-20).**
1. Restore the DNS-only CNAME `api` → `legendary-arena-server.onrender.com`.
2. Resume the Render service and set Render's `LEGENDS_PUBLISHER_ENABLED`
   back to `true` (and the droplet's to `false`).
3. **Re-add `api.legendary-arena.com` as a custom domain in Render**, then wait
   a few minutes for Render to verify it and issue a certificate. Without it,
   Render won't answer for `api.`.

Anything written on the droplet after the flip isn't in Render's database. A
rollback after real traffic needs that data copied back.

**Deploys after cutover.** For the first hours they were manual
(`40-app-deploy.ps1` over SSH). Since D-24708 (2026-10-12),
[`deploy-server.yml`](../.github/workflows/deploy-server.yml) deploys after CI
succeeds on a push to `main`:

- It deploys the exact tested commit, and only when a server-relevant file
  changed since the live commit.
- It connects as the restricted `deployer` user, whose key can only ask for
  `status` or `deploy <commit on main, not older than live>`.
- The droplet side then runs `40-app-deploy.ps1`. It builds the commit in its
  own release directory, `/opt/la-app/releases/<sha>` (frozen install, build,
  migrations), while the old release keeps serving. Then it switches
  `/opt/la-app/current` to the new release and restarts `la-server`.
- During that restart, `la-server-standby` runs the new build on `:3001`.
  Nginx's `la_server` upstream lists it as a backup, so requests the
  restarting server refuses go there instead of failing (lab #39, 2026-10-15).
  Before this, every restart dropped requests: 6 s with nobody connected, 36 s
  with a player's websocket open (fixed in #2819).
- The commit is recorded as live (`/var/lib/la-deploy/live-commit`, which the
  gate's `status` reads) only after the health gate passes. The droplet keeps
  `current` and `previous`; `40-app-deploy.ps1 -Rollback` switches between
  them with no rebuild (lab #40).

Logs: `journalctl -u la-server` (the server), `journalctl -u
la-server-standby` (the standby during a deploy), and `journalctl -t
la-deploy` (the gate).

### First month in production (2026-10-12 to 2026-11-12)

What the box has done since cutover, from the engine and lab repos and the
billing record.

| Area | Record |
|---|---|
| Downtime | **10 m 10 s** at cutover (UptimeRobot, 5-minute granularity). No unplanned outage of the public API since. The planned kernel reboot on 2026-11-13 at 05:14 UTC took about **15 s**: one 502 from Cloudflare, then `/health/db` OK. |
| Alerts | One, a **false** DOWN: on 2026-10-21 at 05:55 UTC a `la-health` run landed in the ~4 s restart gap of a deploy. The public site stayed up (Nginx served the `:3001` standby, no 5xx), and the next run passed. Fixed in lab #43: `60-monitor` now waits for the deploy lock. Plus one **real** DOWN that reached nobody: `la-droplet-backup` went down on 2026-10-29 at 11:17 UTC and stayed down until 2026-11-13 04:58 UTC. Its only channel was email to a Microsoft-hosted mailbox that was down (Open Questions, Operating item 7). |
| **Silent failure** | **From 2026-10-29 to 2026-11-13 (15 days) the on-box timers didn't run: no `la-health` check, no nightly backup, and no Cloudflare-range refresh.** The API itself stayed up throughout; UptimeRobot on `/health/db` stayed green. Found while installing lab #45 and fixed the same night (see [Offsite backups](#offsite-backups-r2--pcloud)). |
| Deploy restarts | Before 2026-10-15, every restart dropped requests: 6 s idle, 36 s with a player's websocket open. Fixed by closing websockets on SIGTERM (#2819), the `:3001` standby (lab #39), and per-commit release directories with a no-rebuild rollback (lab #40). |
| Recovery | DigitalOcean Droplet backups enabled 2026-10-20 (daily, 7-day retention), as the fast path for a lost droplet. DR-02 full rebuild drilled on a new droplet 2026-10-22: **13 m 31 s** of hands-on steps. Restores from the R2 dumps are drilled separately ([Disaster Recovery](disaster-recovery.md) §7). No restore was needed. RPO by design is ≈ 24 h (nightly dump, no PITR). From 2026-10-29 to 2026-11-13, with no nightly dump, the newest R2/pCloud copy was the 2026-10-28 dump. The DigitalOcean Droplet backups are a separate DigitalOcean job and were enabled throughout. Whether they actually ran in that window wasn't checked. |
| Cost | October (12–31): $17.65 usage, $12.65 charged after a one-time $5 credit. A full month is capped at $24.00 plus backups. Month-by-month figures: [DigitalOcean actuals](render-migration-analysis.md#digitalocean-actuals-from-october-2026). |
| Capacity | Measured 2026-11-13 02:56 UTC, at a quiet hour: **850 MB used of 3.9 GB (22%), 3.0 GB available**, load average 0.00, **swap 2.8 MB** of 2 GB, disk **8.2 GB of 77 GB (11%)**. Steady-state memory matches the pre-cutover rehearsal (about 800 MB; the deploy build peaked at 1.37 GB). The swap figure is idle pages pushed out at `swappiness` 10, not memory pressure. Nothing is near the resize trigger: memory above ~70%, CPU above ~50% under real traffic, or real swap use outside deploys ([Target configuration](#target-configuration)). This was one reading at an idle hour, not a peak. Since 2026-11-13, `la-health` alerts on memory held high and on swap-out outside a deploy, and every ping body carries the reading (after the reboot: 19% memory, 0 MB swap). CPU load is still checked by hand: `uptime`. |
| OOM kills | **None.** `sudo journalctl -k --since 2026-10-12 \| grep -ciE 'oom-kill\|out of memory'` returned **0** on 2026-11-13, covering cutover through that night's reboot (the journal persists across boots). It needs `sudo`: run without it, `journalctl -k` can't read kernel messages on this box and prints 0 whatever happened. |
| Kernel patches | A reboot was pending from before cutover until 2026-11-13: the box had been up 32 days on kernel 6.8.0-142, with 6.8.0-146 and -147 installed on disk. Rebooted 2026-11-13 at 05:14 UTC onto **6.8.0-147**. `la-health` now warns while a reboot is pending and fails once it has waited 7 days. |
| PostgreSQL | 18.6 until 2026-11-13. Then upgraded to **18.7**, and PGDG minor releases now install unattended. `pg_stat_statements` has been preloaded and collecting since the same night. |

### Offsite backups (R2 + pCloud)

Every night at 09:17 UTC the droplet's `la-backup` timer runs the lab's
`50-backup.ps1`. One run produces three copies, on three vendors:

| Copy | Where | Kept | Health check |
|---|---|---|---|
| Local | the droplet's `/var/backups/la`, last 7 dumps | lost with the droplet | `la-droplet-monitor` alerts if the newest is over 26 h old |
| **Primary offsite** | Cloudflare R2, private bucket `legendary-arena-db-backups`, `db-backups/YYYY/MM/DD/legendary-arena-<stamp>.dump` | GFS: 35 daily, 12 weekly, 12 monthly. Since 2026-10-13 the bucket lock rule `la-db-backup-lock` (prefix `db-backups`, 30 days) blocks deleting or overwriting any dump in its first 30 days, even with the droplet's credentials | `la-droplet-backup` (dump + R2 upload) |
| **Second offsite (pCloud)** | pCloud (US region), the same `db-backups/YYYY/MM/DD/` keys | the same GFS pruning, applied to pCloud separately | `la-droplet-pcloud` (the mirror only) |

That is 3-2-1: the live database, plus two offsite copies with independent
vendors and credentials. Losing Cloudflare, or losing the R2 token, still
leaves a recoverable dump on pCloud. The Render-era GitHub nightly
(`db-backup.yml`) kept the same pCloud copy from 2026-08-10. Its last copy and
the droplet's first one sit side by side in `db-backups/2026/10/12/`.

**Why the mirror has its own check.** R2 is the primary copy. A pCloud failure
mustn't read as "the backup failed", which is urgent, and it mustn't stay
silent either. The engine's `db-backup.yml` used the same posture from
2026-10-08 (#2641), after a revoked pCloud token turned four nights red while R2
was fine. So on the droplet:

- R2 failed, meaning the dump or the upload: `la-droplet-backup` goes **down**
  (email). Fix it the same day; the RPO clock is running.
- pCloud failed, or `BACKUP_PCLOUD_TOKEN` is missing: `la-droplet-pcloud` goes
  **down** (email, with the reason in the ping body). R2 is safe; fix within days.
- Both green: both copies landed.

**Configuration.** The droplet's root-only `/etc/la/backup.env` holds the R2
credentials and bucket, the pCloud token (`BACKUP_PCLOUD_TOKEN`), and the two
ping URLs (`BACKUP_HEALTHCHECK_URL`, `BACKUP_PCLOUD_HEALTHCHECK_URL`). The
operator keeps the master copy in the private ops folder and installs it with
`scp` + `sudo install -m 600`. It's verified by key name only.

**The pCloud token.** It's an rclone pCloud OAuth token, minted on the
operator's desktop with `rclone authorize "pcloud"`. The output is captured and
written straight into the local `backup.env` as `BACKUP_PCLOUD_TOKEN=…`, so the
token is never displayed or pasted into chat. Each authorization is independent:
the droplet's token and any other (the retired GitHub nightly's, the operator's
local `pcloud:` remote) are revoked separately, so re-minting one never breaks
another. A revoked token shows up as `pcloud error: Revoked 'access_token' …
(2095)` in `journalctl -u la-backup` and turns `la-droplet-pcloud` down. Re-mint
it the same way and reinstall `backup.env`.

**Production data only.** Install the pCloud token, or point
`BACKUP_R2_BUCKET` at the production bucket, only while the droplet holds the
production database. Before the cutover restore, the droplet's test database
would have dropped test dumps into the production folders. The shared GFS
pruning would then have counted them as real backups and pruned real ones to
make room.

**The 2026-10-29 to 2026-11-13 gap.** On the droplet, PowerShell is a snap.
`50-backup`, `60-monitor` and `22-cloudflare-ufw-refresh` had installed their
units with the snap's versioned path, `/snap/powershell/414/…/pwsh`. A routine
snap refresh between the 2026-10-28 and 2026-10-29 runs deleted that revision.
Every run after that failed before the script started (`status=203/EXEC`):
- no dumps reached R2 or pCloud
- `la-health` couldn't run to notice the stale backup
- no pings went to `la-droplet-backup` or `la-droplet-monitor`

The repair, on 2026-11-13:
- On the box, the three units were pointed at `/snap/powershell/current/…/pwsh`, which snapd keeps on the live revision.
- The missed backup ran at 04:58 UTC: dumped, checked readable (320 TOC entries), uploaded to R2 and mirrored to pCloud. The firewall refresh found no range changes.
- Lab #46 makes every future `-Install` write the `current` path. `provision-smoke` now installs the PowerShell snap, as cloud-init does, to prove it. A missed path change would also have moved the scripts' output out of `journalctl -u <unit>`, which the checks below rely on, and the smoke test checks for that too.

Deploys were never affected: `la-deploy` looks up `pwsh` each time it runs.

**Check it by hand:**

```text
sudo ls -l /var/backups/la                    # newest dump is from the last 09:17 UTC run
journalctl -u la-backup -n 15 --no-pager      # dump, "Uploading to r2:…", "Mirroring to pcloud:…", "Backup complete."
systemctl list-timers la-backup.timer         # next run
```

Restoring from either copy, and the provider-loss scenarios, are on
[Disaster Recovery](disaster-recovery.md). `51-restore.ps1` restores straight
from R2 (`RESTORE_FROM_R2=latest`). A pCloud dump restores through
`RESTORE_DUMP=<file>` after downloading it.

### Secrets and configuration

| File | Holds | Read by |
|---|---|---|
| `/etc/la/.env` (root, mode 600, set by `40`) | The app's secrets and settings: the `render.yaml` `sync: false` set plus the keys Render's Environment tab carried (`DASH_GITHUB_*`, `BREVO_*_TEMPLATE_ID`, `PAR_VERSION`), and the droplet-owned `DATABASE_URL`, `PORT`, `LISTEN_HOST`, `LEGENDS_PUBLISHER_ENABLED` | systemd `EnvironmentFile=` for `la-server` and `la-server-standby`; the process runs as `operator` |
| `/etc/la/backup.env` (root, 600) | R2 backup credentials and bucket, `BACKUP_PCLOUD_TOKEN`, two ping URLs | `la-backup` only, so the running server never holds backup credentials |
| `/etc/la/monitor.env` (root, 600) | The `la-droplet-monitor` ping URL | `la-health` only |

- **Master copies** sit in the operator's private ops folder. A rebuild reads
  them from there ([Disaster Recovery](disaster-recovery.md) §4). Refresh the
  master after any change on the box.
- **Rotation** follows DR-04 in the runbook: rotate at the source, update the
  file on the box and the master copy, then `sudo systemctl restart la-server`.
  The pCloud token has its own re-mint steps above.
- **systemd `LoadCredential=`** would keep secrets out of the process
  environment. It isn't adopted: the server reads `process.env`, so it would
  need code changes for little gain on a one-user box.
- **Never on a rehearsal box.** See Edge Cases.

### Reaching the droplet

The droplet's public IPv4 isn't written in any repo, because this one is
public and the address is the one thing the origin lock hides. The engine's
deploy workflow holds it as the `DEPLOY_HOST` secret, which can't be read back.
Look it up when you need it:

- **Cloudflare (works from the workstation today):** the proxied `api` A record
  points at the droplet, so its content is the IP. In the dashboard, open
  `legendary-arena.com` → DNS → Records → `api` → Content. Or, with the DNS
  token:

  ```powershell
  $headers = @{ Authorization = "Bearer $([Environment]::GetEnvironmentVariable('CLOUDFLARE_DNS_API_TOKEN', 'User'))" }
  $zone = (Invoke-RestMethod -Headers $headers -Uri 'https://api.cloudflare.com/client/v4/zones?name=legendary-arena.com').result[0].id
  (Invoke-RestMethod -Headers $headers -Uri "https://api.cloudflare.com/client/v4/zones/$zone/dns_records?name=api.legendary-arena.com").result.content
  ```

- **DigitalOcean control panel:** Droplets → `la-rehearsal-01`. The ipv4
  address is at the top of the page.
- **`doctl compute droplet list --format Name,PublicIPv4`** needs a valid
  `doctl` token. The desktop one has expired (Open Questions, Operating item 6).

Two checks confirm it's the right box. `ssh-keygen -F <ip>` finds it in
`~/.ssh/known_hosts` if this workstation has logged in before. On a first
login, the host key fingerprint ssh shows must match the `ssh-ed25519` line
held in the engine's `DEPLOY_KNOWN_HOSTS` secret.

Log in as `operator` with the workstation key:

```powershell
$ip = '<droplet ip>'
ssh -i $HOME\.ssh\id_ed25519 "operator@$ip"
```

To skip the lookup next time, give it an alias in the workstation's
`~/.ssh/config` (not the repo), then `ssh la-droplet`:

```text
Host la-droplet
  HostName <droplet ip>
  User operator
  IdentityFile ~/.ssh/id_ed25519
```

### Verifying the droplet

Two checks cover the box, one from each side:

- **From outside:** `pwsh scripts/Test-ApiDeployment.ps1 -OriginIp <droplet IP>`
  (IP from [Reaching the droplet](#reaching-the-droplet)). It probes the public API surface and
  its auth gates through `api.`. It then checks that Cloudflare refuses a
  request bringing its own `cf-connecting-ip` (403), and that the droplet IP's
  443 and 3000 don't answer while port 80 only 301s. The guest rate limiters key
  on that header (D-24635 §3), so these lines are the proof that a client can't
  reach Node without Cloudflare and pick its own bucket. All 12 probes passed on
  2026-10-14. Run it after every rebuild ([Disaster Recovery](disaster-recovery.md)
  §6) and after any UFW or Nginx change.
- **On the box:** the lab's `60-monitor.ps1`, run every 5 minutes by
  `la-health.timer`. It checks that `la-server` is active, `/health` and
  `/health/db` return 200, `:3000` listens on loopback only, that disk use
  and backup age are within limits, that memory hasn't held above 70% and
  nothing swapped out outside a deploy, and that no reboot has been pending a
  week (since 2026-11-13, lab #45). Then it pings `la-droplet-monitor`, and the
  ping body carries the memory and swap reading and any pending-reboot warning.
  A failed
  weekly Cloudflare-range refresh (`22-cloudflare-ufw-refresh.ps1`) also fails it.

The origin lock has three parts, each set by a provisioner:
- UFW admits 443 only from Cloudflare's published ranges (`21`), refreshed
  weekly (`22`, lab #37).
- Nginx's port-80 server only redirects.
- `LISTEN_HOST=127.0.0.1` in `/etc/la/.env` keeps Node on loopback (engine
  #2804, lab #36).

There's no DigitalOcean cloud firewall, so UFW is the only network gate.

```text
journalctl -u la-health -n 5 --no-pager         # "[60-monitor] All checks passed."
ss -Htln 'sport = :3000'                        # 127.0.0.1:3000 only
systemctl list-timers la-cf-ufw-refresh.timer   # next weekly refresh
```

**What nothing watches.** The checks above answer "is it up, did the backup
land, and is the box under memory pressure or waiting on a reboot?" They don't
cover:

- **CPU load.** The resize trigger's CPU half (above ~50% under real traffic)
  is still checked by hand with `uptime`.
- **Logs.** journald runs at Ubuntu's default cap (10% of the filesystem, at
  most 4 GB), which is fine on 80 GB. `60-monitor`'s disk check would catch
  runaway growth.
- **A timer that can't start at all.** If `la-health` or `la-backup` can't
  launch, as from 2026-10-29 to 2026-11-13, nothing on the box can report it.
  Only healthchecks.io's missing-ping alerts can. They did fire on 2026-10-29,
  but their one channel was an email address on a mailbox that was down. Since
  2026-11-13 every check also alerts through Pushover to the operator's phone,
  at high priority for DOWN (Open Questions, Operating item 7).

Kernel reboots stay manual: `07` doesn't turn on `Automatic-Reboot`. A
reboot costs about 15 s of boot time with no Nginx standby across it, so do it
at a quiet hour when `la-health` warns.

### Prerequisites & effort

- A DigitalOcean account with an SSH key pair already uploaded.

  **Account status (2026-10-11).** Payment method added. The operator's
  desktop has `doctl` authenticated with a 30-day API token, and its SSH key
  is uploaded to the account. One droplet exists, `la-rehearsal-01` ($24/mo),
  kept as the cutover box (see [Rehearsal results](#rehearsal-results-2026-10-11)).
  A spend alert a little above the droplet price (for example $30 a month,
  raised on a resize) is recommended; it was not confirmed set as of this
  revision. The $5 "Inference Cloud Trial" credit expires 2026-10-21 and is
  named for the inference products, so do not count on it covering droplet
  usage. (It was applied to the October invoice anyway.)

  **2026-11-12:** the desktop's 30-day `doctl` token has expired (`401 Unable
  to authenticate`). Mint a new one before the next rebuild, resize, or drill,
  since DR-02 starts with `doctl`. The spend alert is still unconfirmed.
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

Render owned each of these until 2026-10-12; on the droplet they are the operator's:

- Host maintenance and OS/kernel security patching
- Service lifecycle (restarts, health recovery, deploy pipeline)
- Managed Postgres operations (tuning, connection management, version upgrades)
- Backup infrastructure and point-in-time recovery
- Service monitoring and alerting
- Platform-level security updates

The program has **accepted** this transfer. The single-box SPOF that comes with
it is mitigated by tested nightly `pg_dump` backups to R2 **and** pCloud (two
vendors, each with its own health check; see
[Offsite backups](#offsite-backups-r2--pcloud)), and by a rehearsed restore and
rebuild (§5–6), which the PLAN makes a hard gate before cutover.

**What the single box accepts, and what would change it:**

| Accepted today | Trigger to revisit | Move |
|---|---|---|
| Up to ~24 h of data loss (nightly dump, no PITR) | An RPO under 24 h confirmed as a business need | WAL archiving to R2 / pCloud, or DigitalOcean Managed PostgreSQL ([Disaster Recovery](disaster-recovery.md), provider-native options) |
| Downtime while a droplet is restored or rebuilt (13 m 31 s hands-on in the drill) | An RTO well under that, or paying players affected by a real outage | A warm standby droplet; Reserved IP for the `api.` record |
| 2 vCPU / 4 GB | The resize trigger in [Target configuration](#target-configuration) | Resize CPU and RAM only to 4 / 8 GB ($48), keep the disk |
| One app process | Load one process can't carry | A second app node, which needs a Socket.IO Redis adapter and single-owner scheduling for the cron singletons (Edge Cases) |

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
  the generated live picture of what this lab became: the production droplet's
  host and sizing notes (size, resize trigger, Cloudflare edge, loopback bind,
  the `la-deploy` gate), the database posture and backup notes, and the full
  deployment topology. Read it first.
- **[Development Workflow](development-workflow.md)** — the production
  develop-from-anywhere loop (Claude Code → GitHub → deploy on merge to
  `main`). The migration replaced Render's push-to-main auto-deploy with
  `deploy-server.yml`, which deploys after CI passes, over SSH to the
  `la-deploy` gate → `40-app-deploy.ps1` (owned by the `legendary-arena-lab`
  program). The hand-run steps on this page are its rehearsal-time
  equivalent.
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
- **A rehearsal box never gets production data or secrets — the production
  droplet does.** Since cutover the production droplet holds the live database
  and the real secrets in `/etc/la/.env` and `/etc/la/backup.env`. Any *other*
  box built from these steps (a rehearsal, a rebuild test, a learning lab) runs
  against a restored copy with test-mode credentials for the `sync: false` env
  set, and never gets the pCloud token or the production backup bucket (see
  "Production data only" above).
- **"Stateless" is persistence-stateless, not connection-stateless.** One droplet
  is fine. A future multi-node app tier would additionally need a Socket.IO Redis
  adapter (WebSocket fan-out) and leader-election / single-owner scheduling for the
  cron singletons, or the reaper and publisher double-fire.
- **`bgio` file bloat rides along.** The match reaper prunes rows (finished
  matches 1 h after `gameover`, abandoned ones after 24 h), but the table file
  keeps its dead TOAST space until a `VACUUM FULL`. A `pg_dump` / restore
  writes only live rows, so a restored copy comes back compact. See
  [Database care](#database-care).
- **Build cost moves onto the box.** `pnpm -r build` is heavy; on a 2 vCPU droplet
  it is real wall-clock time, not Render's managed pipeline.
- **Version pins still bind.** Node must be `24.18.0` to match `.node-version`
  (D-24205); `boardgame.io` stays on the `^0.50.0` line. A lab on a newer Node or
  bgio is testing a different system than production.
- **Certificates and kernel patches are now yours.** Certificate renewal (Certbot
  in the hand-run steps, the Cloudflare Origin Certificate in the program) and
  kernel patches are operator responsibilities on a droplet that Render otherwise
  absorbs. unattended-upgrades installs security patches but never reboots
  (`Automatic-Reboot` is off), so a new kernel waits for a manual reboot, and
  PGDG PostgreSQL updates wait for a manual `apt upgrade`.

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
  voice doesn't require local STT/TTS on either host. The whole provisioner
  chain and a production-copy restore were then rehearsed on `la-rehearsal-01`,
  which surfaced two bugs CI could not see (lab #22, #23); the box is kept for
  cutover. The cost, vendor and architecture analysis moved to
  [Render Migration Analysis](render-migration-analysis.md).
- **2026-10-12** — Cutover: production moved to this droplet and the Render
  web service was suspended for a 7-day rollback window (see
  [Cutover](#cutover-2026-10-12)). The same day, the pCloud mirror became a
  permanent part of every production backup, with its own `la-droplet-pcloud`
  check (lab #30), and deploys became automatic after CI (D-24708).
- **2026-10-14** — Verified the origin lock: Cloudflare refuses a client
  `cf-connecting-ip`, and the droplet IP is unreachable on 443 and 3000. Node
  moved to loopback (`LISTEN_HOST`, engine #2804 / lab #36), the Cloudflare
  ranges started refreshing weekly (lab #37), and `Test-RenderDeployment.ps1`
  became `Test-ApiDeployment.ps1` with the origin checks (see
  [Verifying the droplet](#verifying-the-droplet)).
- **2026-10-15** — Deploy restarts stopped dropping requests: a `:3001`
  standby behind Nginx (lab #39), per-commit release directories with a
  no-rebuild rollback (lab #40), and websockets closed on SIGTERM (#2819).
- **2026-10-20** — DigitalOcean Droplet backups enabled (daily, 7 days).
- **2026-10-21** — The only alert since cutover, a false DOWN from a health
  check that landed in a deploy restart; `60-monitor` now waits for the deploy
  lock (lab #43).
- **2026-10-22** — Render deleted after the rollback window. The DR-02 full
  rebuild was drilled on a new droplet in 13 m 31 s of hands-on time.
- **2026-11-12** — One-month review: the `draft` tag dropped, and
  [First month in production](#first-month-in-production-2026-10-12-to-2026-11-12),
  [Database care](#database-care),
  [Development parity](#development-parity-with-production),
  [Secrets and configuration](#secrets-and-configuration), and the single-box
  revisit triggers added. Two stale Edge Cases corrected (the match store *is*
  pruned; unattended-upgrades never reboots). A live reading on 2026-11-13
  showed 22% memory, 11% disk, and a kernel reboot pending since before
  cutover.
- **2026-11-13** — Lab #45 installed on the droplet: memory, swap and
  pending-reboot alerts in `la-health`, PGDG minor releases through
  unattended-upgrades, and `pg_stat_statements` preloaded. The install found
  that a PowerShell snap refresh had stopped `la-health`, `la-backup` and
  `la-cf-ufw-refresh` since 2026-10-29: 15 days without an offsite backup or an
  on-box check. Repaired on the box, made permanent in the provisioners (lab
  #46), and the missed backup run. PostgreSQL went from 18.6 to 18.7, and a
  quiet-hour reboot at 05:14 UTC loaded kernel 6.8.0-147 (about 15 s down).

## Open Questions

**Status as of 2026-11-13:** every migration step below is done. Items 1–5
under Operating were done and installed on the droplet on 2026-11-13, and item
7 was closed the same night. Items 6 and 8 are open.

**Operating** (most are a provisioner change in the lab repo):

1. ~~**Reboot the droplet at a quiet hour.**~~ Done 2026-11-13 at 05:14 UTC,
   onto kernel 6.8.0-147. `la-server`, PostgreSQL, `/health/db` and the timers
   came back, and `la-health` passed with no reboot warning. The `sudo` OOM
   re-check found no OOM kills since cutover.
2. ~~**Alert on memory and swap** in `60-monitor`, against the resize
   trigger.~~ Done (lab #45, installed 2026-11-13). It fails on memory held at or
   above 70% for 3 runs, or more than 8 MB swapped out between runs with no
   deploy in between.
3. ~~**Alert on `/var/run/reboot-required`.**~~ Done (lab #45). A pending
   reboot is a warning in the ping body, and a failure once it has waited 7
   days.
4. ~~**Apply PGDG PostgreSQL minor releases.**~~ Done (lab #45). `07` allows
   `apt.postgresql.org:noble-pgdg` in unattended-upgrades. 18.7 was applied by
   hand the same night.
5. ~~**Preload `pg_stat_statements`** in `30`.~~ Done (lab #45). `30` also no
   longer appends duplicate config lines on every run.
6. **Re-mint the desktop `doctl` token** (expired) and confirm the DigitalOcean
   spend alert.
7. ~~**Give healthchecks.io a second alert channel.**~~ Done 2026-11-13. A
   Pushover integration (high priority for DOWN, low for UP) is assigned to
   every check, alongside the existing email. Its test notification reached the
   operator's Android phone. Why 15 days of missed pings went unnoticed: the
   alert fired: `la-droplet-backup`'s
   log shows `up ➔ down` on 2026-10-29 at 11:17 UTC, which is the missed 09:17
   run plus its 2-hour grace, and `down ➔ up` at the 2026-11-13 04:58 UTC
   catch-up. The ping's user agent moved from PowerShell 7.6.6 to 7.6.9 across
   the gap, which is the snap refresh. But every check's only notification method
   was email to the operator's Microsoft-hosted mailbox, and that mailbox was
   down. healthchecks.io's "Delivered" on an email only means the mail server
   accepted it, not that it reached an inbox.
8. **Buy the Pushover Android license before about 2026-12-13.** The device
   is on Pushover's 30-day trial, which started 2026-11-13. After it ends,
   Pushover stops delivering to that phone, and item 7's second channel goes
   quiet without any error. The license is a one-time $4.99 per platform, bought
   in the app or at pushover.net under Upgrade Now.

**Migration** (done; kept for the record). Governance is
[D-24707](../docs/ai/DECISIONS.md), with the ewiki half as D-24690.

1. ~~Transcribe the migration decision into `DECISIONS.md`.~~ Done 2026-10-12:
   D-24707.
2. ~~Publish the migration Work Packet.~~ Not needed: D-24707 records this as
   an operational migration run by the lab program, and its "Not changed" clause
   carries the server-layer boundary check
   ([`.claude/rules/architecture.md`](../.claude/rules/architecture.md)): `apps/server`
   stays the wiring layer, and no engine or persistence rule changes.
3. ~~Finish the last unrehearsed provisioning step, `60` monitoring.~~ Done
   2026-10-12: every provisioner has now passed (see
   [Rehearsal results](#rehearsal-results-2026-10-11)). `21` Cloudflare TLS, the
   `50` R2 backup, and `60` monitoring passed on 2026-10-12, and the restore
   gate passed on a production copy.
4. ~~Cut over from a fresh production dump, with a rehearsed rollback (repoint
   Cloudflare DNS `api.` → Render). The same day, switch the droplet's backups
   from the rehearsal bucket to the production backup bucket and retire this
   repo's `db-backup.yml` nightly.~~ Done 2026-10-12 (see
   [Cutover](#cutover-2026-10-12)). Backups write to
   `legendary-arena-db-backups`, and `db-backup.yml` is disabled: its source,
   Render, stopped being the truth, and the droplet's Postgres is
   localhost-only, so the workflow could not reach it.
5. ~~Decommission Render after the 7-day rollback window (~2026-10-20), and
   delete `db-backup.yml` the same day.~~ Done 2026-10-22: the web service,
   the database, and the Blueprint are deleted in Render, and `db-backup.yml`
   is deleted from this repo.

## References

- [`render.yaml`](../render.yaml) — the retired Render blueprint (production
  until 2026-10-12): server `plan: pro`, the managed-DB `plan: pro-4gb`,
  the `sync: false` secret set (still the inventory of secret names the
  droplet's `/etc/la/.env` must supply), and the build/start commands this
  runbook mirrors.
- [Architecture & Library Adoption Inventory](architecture-inventory.md) — the
  production droplet's host & sizing notes, the database posture and backup
  notes, and deployment topology (generated by
  `scripts/architecture-inventory.mjs`).
- [`docs/ops/DISASTER_RECOVERY.md`](../docs/ops/DISASTER_RECOVERY.md) — the
  authoritative operator disaster-recovery runbook this lab rehearses.
- [`docs/ops/DOMAINS.md`](../docs/ops/DOMAINS.md) and
  [`docs/ops/domains.json`](../docs/ops/domains.json) — canonical subdomain manifest
  and ops runbook for the live hosts.
- [Development Workflow](development-workflow.md),
  [Operational Health Checks](operational-health-checks.md),
  [Data & File Locations](data-file-locations.md),
  [Workspace Map](workspace-map.md) — companion operator references.
