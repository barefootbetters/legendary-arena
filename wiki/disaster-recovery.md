---
title: Disaster Recovery
type: Guide
tags:
  - operations
  - persistence
  - render
  - cloudflare
  - postgres
  - backup
  - governance
related:
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
  - ../render.yaml
  - ../.github/workflows/db-backup.yml
last-reviewed: 2026-10-08
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
**source code** (GitHub), the **database data** (Render Postgres:
`legendary.*` domain schema + the `bgio` framework-store schema), and the
**secrets** (Render env vars marked `sync: false`, held in the operator's
own secret store, not in the repo). If an asset is not in the §2 inventory
of the canonical doc, recovery assumes it is lost.

### The three backup layers

| Layer | Source | Where | Notes |
|---|---|---|---|
| Managed (internal) | Render Postgres automated snapshots + PITR | Render | Retention per plan — confirm in the Render dashboard. Cannot survive losing Render itself. |
| External (provider-independent) | `pg_dump -Fc`, daily 09:17 UTC GitHub Actions ([`db-backup.yml`](../.github/workflows/db-backup.yml), WP-416 / D-24236) | private Cloudflare R2 bucket, `db-backups/YYYY/MM/DD/` | **Primary** offsite copy. Live since 2026-08-09; restore drilled 2026-08-09. GFS retention: 35 daily · 12 weekly · 12 monthly. |
| Second offsite (3-2-1) | the same dump, `rclone copyto` in the same run | pCloud, `db-backups/` (US region, `api.pcloud.com`) | Vendor independent of Cloudflare, same GFS policy. Live since 2026-08-10; restore drilled 2026-08-10. |

The external layers are the ones that make a provider-loss recoverable. They
are a full-database operational `pg_dump` — **not** an application read of
the `bgio` blob, so they sit outside the persistence-boundary carve-outs and
interpret nothing (see
[ARCHITECTURE.md §Persistence Boundary](../docs/ai/ARCHITECTURE.md) and
DECISIONS [D-24095](../docs/ai/DECISIONS.md)). The backup is a derived
operational copy and is never read back into gameplay state.

### Reading a `DB Backup` run

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
provided … (2095)` in the mirror step). Operator-only; the token is a secret:

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
| DR-01 | Database loss / corruption | Yes — Render dashboard restore / PITR, or the latest R2 / pCloud dump (restore drilled) |
| DR-02 | Application server lost, DB intact | Yes — lowest risk; the server is stateless, redeploy from the [`render.yaml`](../render.yaml) blueprint |
| DR-03 | Accidental data deletion (`DROP TABLE …`) | Yes — Render PITR to just before the deletion, or the last nightly dump (up to ~24 h of loss) |
| DR-04 | Credential compromise | Yes, operationally — rotate the secret at its source; no data restore unless data was tampered with |
| DR-05 | Cloud-provider / account failure | Yes — the R2 dump survives losing Render, and the pCloud copy survives losing Cloudflare; both restores drilled (2026-08-09 / 08-10) |

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
  non-production box where the restore and rebuild drills are *rehearsed*
  against a **copy** of the database, never a live cutover.
- **[Architecture Inventory](architecture-inventory.md)** — the live
  Render + Cloudflare topology a rebuild has to reconstitute.
- **[Data & File Locations](data-file-locations.md)** — where the assets a
  recovery depends on actually live (Postgres tables, R2 key prefixes,
  env/config).
- **[Development Workflow](development-workflow.md)** — the normal
  build-and-deploy loop a DR-02 server rebuild falls back onto (redeploy
  from `main` via Render + Cloudflare).

## Edge Cases

- **A backup nobody has restored is an assumption, not a backup.** Both
  offsite copies have been restored in a drill (§7 of the canonical doc).
  The monthly `DR drill due — <Month> <Year>` issue keeps that evidence
  fresh; the canonical §3 integrity gates require a drill within 90 days.
- **A green run is not proof both copies landed.** Since 2026-10-08 a pCloud
  mirror failure leaves the run green with a warning. The open
  `Backup mirror failing — pCloud` issue is the signal, not the run color.
- **RPO / RTO are proposed defaults, not confirmed policy.** The canonical
  doc §1 seeds 24 h / 4 h pending operator confirmation; a recovery only
  "fails" against a number that has actually been agreed.
- **A server snapshot does not help a bad `DELETE`.** DR-03 is recoverable
  only through point-in-time recovery (if enabled and in-window) or the
  external dump — not by rebuilding the app server.
- **Secret loss surfaces as a boot failure, not silent degradation.**
  Production startup is fatal-on-missing for several `sync: false` secrets,
  so a rebuild that forgets one fails fast at boot rather than limping.
- **`ANALYTICS_USER_ID_SALT` rotation is one-way.** Rotating it during a
  DR-04 response invalidates existing `user_id_hash` linkage — treat as
  irreversible, per its `render.yaml` note.
- **The R2 dump and the card images share one vendor.** Both live on
  Cloudflare, so a single-vendor loss takes the primary database backup and
  the images at once. The pCloud second copy covers the database side of that.
  The exact card-image bytes uploaded to R2 also live in the operator's
  pCloud-synced `card-images-staging/original/` folder, outside this repo.
- **pCloud tokens can be revoked out from under CI.** The 2026-10-05
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
- [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml) —
  the daily `pg_dump` → R2 → pCloud workflow, with the mirror-status
  tracking issue.
- [ARCHITECTURE.md §Persistence Boundary](../docs/ai/ARCHITECTURE.md) and
  [DECISIONS.md](../docs/ai/DECISIONS.md) D-24095 (framework-store
  exemption), D-24236 (WP-416 backup pipeline).
- [`render.yaml`](../render.yaml) — the blueprint a rebuild reconstitutes
  (`databases:` block, `R2_*` secret shape, `sync: false` secret list).
