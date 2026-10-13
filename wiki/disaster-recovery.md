---
title: Disaster Recovery
type: Guide
tags:
  - operations
  - persistence
  - digitalocean
  - render
  - cloudflare
  - postgres
  - backup
  - governance
related:
  - system-backup.md
  - operational-health-checks.md
  - ubuntu-lab-provisioning.md
  - data-file-locations.md
  - architecture-inventory.md
  - development-workflow.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\disaster-recovery.md (this page — https://ewiki.legendary-arena.com/disaster-recovery/)
  - ../docs/ops/DISASTER_RECOVERY.md
  - ../docs/ops/INCIDENT_RESPONSE.md
  - ../docs/ai/work-packets/WP-416-db-backup-pipeline.md
  - ../docs/ai/execution-checklists/EC-451-db-backup-pipeline.checklist.md
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/ai/DECISIONS.md
  - legendary-arena/legendary-arena-lab infra/scripts/50-backup.ps1 and 51-restore.ps1 (droplet backup and restore, production since 2026-10-12)
  - ../render.yaml
  - ../.github/workflows/db-backup.yml
last-reviewed: 2026-10-12
canonical-source: docs/ops/DISASTER_RECOVERY.md
---

## Summary

Disaster recovery is the operator playbook for restoring **service** —
players able to log in and play — after infrastructure loss, database
failure, accidental deletion, or credential compromise. The canonical
procedures live in [`docs/ops/DISASTER_RECOVERY.md`](../docs/ops/DISASTER_RECOVERY.md);
this page is a read-only ewiki mirror of it. The load-bearing idea:
recovery is complete when players can play, not when a server boots — so
every drill is graded by business capability (login, match, leaderboard,
friendships, images, email, test-mode payments), never by "the box is up."

The companion [`docs/ops/INCIDENT_RESPONSE.md`](../docs/ops/INCIDENT_RESPONSE.md)
covers *in-match game-state* incidents (rollback, replay desync); this
page is about *infrastructure* recovery.

## Mechanics

### What is actually at risk

The server is stateless and replaceable — live match state is in Postgres,
not in memory. The three assets that are **not** replaceable are the
**source code** (GitHub), the **database data** (PostgreSQL 18 on the
DigitalOcean droplet, `localhost` only: `legendary.*` domain schema + the
`bgio` framework-store schema), and the **secrets** (the droplet's root-only
env file `/etc/la/.env`, mode 600, also held in the operator's own secret
store, not in the repo; `render.yaml` keeps the inventory of `sync: false`
secret names). If an asset is not in the §2 inventory
of the canonical doc, recovery assumes it is lost.

### The backup layers

| Layer | Source | Where | Notes |
|---|---|---|---|
| Managed (internal) | None since 2026-10-12. Self-hosted PostgreSQL on the droplet has no managed snapshots or PITR. | — | Until the 2026-10-12 cutover, Render Postgres snapshots + PITR were this layer. Render's snapshots exist only until the Render database is deleted (~2026-10-20, end of the rollback window). |
| Local (on the droplet) | `pg_dump -Fc` by the lab's `50-backup.ps1` | the droplet's local disk, last 7 dumps | Fastest restore source; lost with the droplet. |
| External (provider-independent) | the same dump, daily 09:17 UTC by the droplet's `la-backup` systemd timer (`50-backup.ps1` in `legendary-arena-lab`), which then pings the healthchecks.io check `la-droplet-backup` | private Cloudflare R2 bucket `legendary-arena-db-backups`, `db-backups/YYYY/MM/DD/` | **Primary** offsite copy. GFS retention: 35 daily · 12 weekly · 12 monthly. Same key layout and retention as the WP-416 / D-24236 GitHub Actions nightly ([`db-backup.yml`](../.github/workflows/db-backup.yml)), which ran from 2026-08-09 and was disabled at the 2026-10-12 cutover. Restore from R2 drilled 2026-10-11/12 (`51-restore.ps1`, `RESTORE_FROM_R2=latest`). |
| Second offsite (3-2-1) | the same dump, `rclone` in the same `50-backup.ps1` run, on every production backup; it reports to its own healthchecks.io check `la-droplet-pcloud` | pCloud, `db-backups/` (US region, `api.pcloud.com`) | Vendor independent of Cloudflare, same GFS policy. Ran in the GitHub Actions nightly from 2026-08-10 (restore drilled 2026-08-10). It is permanent on the droplet (lab #30): a missing `BACKUP_PCLOUD_TOKEN` or a failed copy pings `la-droplet-pcloud` as failed, while `la-droplet-backup` stays green because R2 already holds the dump. The first droplet mirror landed 2026-10-12, byte-identical to the R2 object. How it runs, the token, and the checks: [Ubuntu Lab Provisioning § Offsite backups](ubuntu-lab-provisioning.md#offsite-backups-r2--pcloud). |

The external layers are the ones that make a provider-loss recoverable. They
are a full-database operational `pg_dump` — **not** an application read of
the `bgio` blob, so they sit outside the persistence-boundary carve-outs and
interpret nothing (see
[ARCHITECTURE.md §Persistence Boundary](../docs/ai/ARCHITECTURE.md) and
DECISIONS [D-24095](../docs/ai/DECISIONS.md)). The backup is a derived
operational copy and is never read back into gameplay state.

### Reading a droplet backup result

Since 2026-10-12 the nightly backup runs on the droplet, not in GitHub
Actions, so there is no run color to read. Three places tell you whether a
night landed:

| Where | Healthy | Unhealthy → action |
|---|---|---|
| healthchecks.io check `la-droplet-backup` | Up: a success ping after each nightly run | Down or late (email alert): no successful offsite backup that night. Urgent; the RPO clock is running. Read the run's log next. |
| healthchecks.io check `la-droplet-pcloud` | Up: the pCloud mirror landed | Down (email alert, with the reason in the ping body): R2 is safe, but the second copy failed or the token is missing. Fix within days; a revoked token is the usual cause (re-mint below). |
| `journalctl -u la-backup` on the droplet | The run logs the dump, the R2 upload, and the pCloud mirror | An error names the failing step: the dump, the R2 upload, or the mirror. |
| The R2 bucket `legendary-arena-db-backups` | Today's object under `db-backups/YYYY/MM/DD/` | Missing: the upload did not land, whatever the other two say. |

The on-box monitor (`la-droplet-monitor`, every 5 minutes) also checks the
age of the newest backup, so a timer that silently stops firing alerts too.

### Reading a `DB Backup` run (history, until 2026-10-12)

The engine's [`db-backup.yml`](../.github/workflows/db-backup.yml) was the
nightly backup from 2026-08-09 until the cutover, when it was disabled. It is
deleted after the rollback window. The guidance below applies only to its
past runs.

| Run result | Meaning | Action |
|---|---|---|
| Red | The **primary** failed: the dump or the R2 upload. No new offsite backup exists for that night. | Urgent. Read the failing step's log and fix the same day; the RPO clock is running. |
| Green + warning annotation | R2 succeeded; only the pCloud mirror failed. The issue **`Backup mirror failing — pCloud`** is open and gets a comment each failing night. | Fix within days. The issue closes itself on the first run whose mirror succeeds. |
| Green, no warning | Both copies landed. | None. |

The pCloud step is `continue-on-error` so a red run always means the primary
failed. Before that change (2026-10-08), a revoked pCloud token turned four
nights red (2026-10-05..08) while R2 succeeded every night, and nobody noticed.
The dashboard DR Readiness tile reads drill issues only, not backup runs.

**Re-minting a revoked pCloud token** (`pcloud error: Revoked 'access_token'
provided … (2095)` in the mirror step). This is the GitHub Actions procedure
from that period. On the droplet, mint a new token straight into the
operator's local `backup.env` without displaying it (`rclone authorize
"pcloud"` captured and written as `BACKUP_PCLOUD_TOKEN=…`), then install that
file as the droplet's root-only backup config. Each authorization is
independent, so the droplet's token and any other are revoked separately.
Operator-only; the token is a secret:

```powershell
rclone authorize "pcloud"
gh secret set RCLONE_PCLOUD_TOKEN -R barefootbetters/legendary-arena
rclone config reconnect pcloud:
gh workflow run db-backup.yml -R barefootbetters/legendary-arena
```

Paste the JSON that `rclone authorize` prints when `gh secret set` prompts for
it. The revocation also killed the operator's local `pcloud:` remote, so
reconnect it too. A new authorization does **not** revoke an existing one:
CI and the local remote both work on separate tokens. The account is US, so
`RCLONE_PCLOUD_HOSTNAME` stays unset (it defaults to `api.pcloud.com`).
Nights missed during an outage exist only on R2. Back-copy them with
`rclone copy r2:<bucket>/db-backups/<yyyy>/<mm> pcloud:db-backups/<yyyy>/<mm>`.

### Recovery scenarios (DR-01 … DR-05)

The canonical doc §5 enumerates five scenarios, each with an honest
"recoverable today?" verdict rather than an aspirational one:

| ID | Trigger | Honest recoverability |
|---|---|---|
| DR-01 | Database loss / corruption | Yes — restore the latest R2 dump onto the droplet with the lab's `51-restore.ps1` (`RESTORE_FROM_R2=latest`; drilled 2026-10-11/12), or the pCloud copy. No PITR: anything since the last nightly dump is lost |
| DR-02 | Application server lost, DB intact | Yes — lowest risk; the server is stateless. Redeploy with the lab's `40-app-deploy.ps1`; if the droplet itself is gone, the database went with it, so this becomes DR-01 on a fresh droplet (re-run the lab provisioners, then `40`) |
| DR-03 | Accidental data deletion (`DROP TABLE …`) | Yes — restore the last nightly dump (up to ~24 h of loss). No point-in-time recovery on self-hosted Postgres unless WAL archiving is added later |
| DR-04 | Credential compromise | Yes, operationally — rotate the secret at its source and in the droplet's `/etc/la/.env`, then restart `la-server`; no data restore unless data was tampered with |
| DR-05 | Cloud-provider / account failure | Yes — the R2 dump survives losing the droplet or DigitalOcean (restore it onto a fresh droplet), and the pCloud copy survives losing Cloudflare; restores drilled (R2 2026-08-09 and again onto the droplet 2026-10-11/12; pCloud 2026-08-10) |

### Recovery is graded by capability, not infrastructure

The §6 validation checklist is deliberately organized by business
capability — infrastructure health, then database integrity, then auth,
core gameplay, multiplayer, rankings, friendships, R2 images, Stripe
(test mode only — no production charges during drills), and Brevo email.
Every item is binary pass/fail. A restore that boots Ubuntu but where no
one can log in has not recovered anything.

## Interactions

- **[Operational Health Checks](operational-health-checks.md)** — the
  perimeter probes (`pnpm check`, `pnpm check:domains`) are the first
  diagnostic step when production looks broken and the fastest confirmation
  during a recovery that external services are reachable again.
- **[Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md)** — the
  production droplet (since 2026-10-12) and the `legendary-arena-lab`
  provisioners a rebuild re-runs; restore and rebuild drills run there
  against a **copy** of the database, never the live one.
- **[Architecture Inventory](architecture-inventory.md)** — the
  DigitalOcean droplet + Cloudflare topology a rebuild has to reconstitute.
- **[Data & File Locations](data-file-locations.md)** — where the assets a
  recovery depends on actually live (Postgres tables, R2 key prefixes,
  env/config).
- **[Development Workflow](development-workflow.md)** — the normal
  build-and-deploy loop a DR-02 server rebuild falls back onto (redeploy
  `main` to the droplet with the lab's `40-app-deploy.ps1`; the Cloudflare
  front-ends redeploy on their own).

## Edge Cases

- **A backup nobody has restored is an assumption, not a backup.** Both
  offsite copies have been restored in a drill (§7 of the canonical doc).
  The monthly `DR drill due — <Month> <Year>` issue keeps that evidence
  fresh; the canonical §3 integrity gates require a drill within 90 days.
- **A green run was not proof both copies landed** (history: `db-backup.yml`,
  2026-10-08 to 2026-10-12). A pCloud mirror failure left the run green with a
  warning; the open `Backup mirror failing — pCloud` issue was the signal,
  not the run color. On the droplet, read the `la-backup` journal for the
  mirror step.
- **RPO / RTO are proposed defaults, not confirmed policy.** The canonical
  doc §1 seeds 24 h / 4 h pending operator confirmation; a recovery only
  "fails" against a number that has actually been agreed.
- **A server snapshot does not help a bad `DELETE`.** DR-03 is recoverable
  only through the external dump — not by rebuilding the app server.
  Self-hosted Postgres has no point-in-time recovery, so the loss window is
  everything since the last nightly dump.
- **Secret loss surfaces as a boot failure, not silent degradation.**
  Production startup is fatal-on-missing for several `sync: false` secrets,
  so a rebuild that forgets one fails fast at boot rather than limping.
- **`render.yaml` is not the complete secrets checklist.** `apps/server` also
  reads `DASH_GITHUB_TOKEN`, `DASH_GITHUB_REPO`, `PAR_VERSION`, and three
  `BREVO_*_TEMPLATE_ID` values that were set only in Render's Environment tab.
  None of them stops boot, so a rebuild that misses one degrades the dashboard,
  PAR scoring, or transactional email quietly. The canonical doc §4 lists the
  full set for `/etc/la/.env`.
- **`ANALYTICS_USER_ID_SALT` rotation is one-way.** Rotating it during a
  DR-04 response invalidates existing `user_id_hash` linkage — treat as
  irreversible, per its `render.yaml` note (the note still applies; the value
  now lives in the droplet's env file).
- **The R2 dump and the card images share one vendor.** Both live on
  Cloudflare, so a single-vendor loss takes the primary database backup and
  the images at once. The pCloud second copy covers the database side of that.
  The exact card-image bytes uploaded to R2 also live in the operator's
  pCloud-synced `card-images-staging/original/` folder, outside this repo.
- **pCloud tokens can be revoked out from under a backup job.** The 2026-10-05
  revocation hit both the CI secret and the operator's local remote at the
  same moment. The trigger was not confirmed. A pCloud password change or an
  app-access revoke in pCloud settings would produce exactly this; expect it
  after any pCloud account-security change.

## Open Questions

- The confirmed RPO / RTO values (canonical doc §1 still lists them as
  proposed defaults: 24 h / 4 h).
- Whether the dashboard DR Readiness tile should also surface backup and
  mirror freshness (for example, an open `Backup mirror failing — pCloud`
  issue). Today it reads drill issues only.

## References

- [`docs/ops/DISASTER_RECOVERY.md`](../docs/ops/DISASTER_RECOVERY.md) —
  canonical source: RPO/RTO, asset + backup inventories, DR-01…DR-05
  procedures, the capability-graded validation checklist, and the drill
  record template.
- [`docs/ops/INCIDENT_RESPONSE.md`](../docs/ops/INCIDENT_RESPONSE.md) —
  companion for in-match game-state incidents.
- [WP-416 — Provider-Independent PostgreSQL Backup Pipeline](../docs/ai/work-packets/WP-416-db-backup-pipeline.md)
  and its [EC-451 checklist](../docs/ai/execution-checklists/EC-451-db-backup-pipeline.checklist.md).
- `legendary-arena/legendary-arena-lab` — `infra/scripts/50-backup.ps1`
  (the droplet's nightly `pg_dump` → local → R2 → pCloud, with separate
  healthchecks.io pings for the backup and the mirror), `51-restore.ps1` (restore, including
  `RESTORE_FROM_R2=latest`), and `60-monitor.ps1` (the on-box check); the
  engine-side summary is [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md).
- [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml) —
  the daily `pg_dump` → R2 → pCloud workflow from 2026-08-09; disabled at the
  2026-10-12 cutover and superseded by the lab's `50-backup.ps1`. Deleted
  after the rollback window.
- [ARCHITECTURE.md §Persistence Boundary](../docs/ai/ARCHITECTURE.md) and
  [DECISIONS.md](../docs/ai/DECISIONS.md) D-24095 (framework-store
  exemption), D-24236 (WP-416 backup pipeline).
- [`render.yaml`](../render.yaml) — the retired Render blueprint (production
  until 2026-10-12). It no longer governs production; it stays as the
  inventory of `sync: false` secret names a rebuild must supply in
  `/etc/la/.env`.
