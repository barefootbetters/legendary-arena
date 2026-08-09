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
last-reviewed: 2026-08-09
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

### The two backup layers

| Layer | Source | Where | Notes |
|---|---|---|---|
| Managed (internal) | Render Postgres automated snapshots + PITR | Render | Retention per plan — confirm in the Render dashboard. Cannot survive losing Render itself. |
| External (provider-independent) | `pg_dump -Fc`, daily GitHub Actions ([`db-backup.yml`](../.github/workflows/db-backup.yml), WP-416 / D-24236) | private Cloudflare R2 bucket, `db-backups/` prefix, 35-day window | The only database copy that survives losing the Render account (scenario DR-05). |

The external layer is the one that makes a provider-loss recoverable. It
is a full-database operational `pg_dump` — **not** an application read of
the `bgio` blob, so it sits outside the persistence-boundary carve-outs and
interprets nothing (see
[ARCHITECTURE.md §Persistence Boundary](../docs/ai/ARCHITECTURE.md) and
DECISIONS [D-24095](../docs/ai/DECISIONS.md)). The backup is a derived
operational copy and is never read back into gameplay state.

### Recovery scenarios (DR-01 … DR-05)

The canonical doc §5 enumerates five scenarios, each with an honest
"recoverable today?" verdict rather than an aspirational one:

| ID | Trigger | Honest recoverability |
|---|---|---|
| DR-01 | Database loss / corruption | Render dashboard restore / PITR only; no external fallback until the R2 backup is provisioned |
| DR-02 | Application server lost, DB intact | Yes — lowest risk; the server is stateless, redeploy from the [`render.yaml`](../render.yaml) blueprint |
| DR-03 | Accidental data deletion (`DROP TABLE …`) | Render PITR to just before the deletion — the scenario an external backup most protects against |
| DR-04 | Credential compromise | Yes, operationally — rotate the secret at its source; no data restore unless data was tampered with |
| DR-05 | Cloud-provider / account failure | Recoverable **once the WP-416 backup is live**; the R2 dump is then the only surviving DB copy |

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

- **A backup nobody has restored is an assumption, not a backup.** The
  external pipeline exists in code but is inert until the operator
  provisions its five GitHub Actions secrets and runs it once via
  `workflow_dispatch` — **and** until a restore has actually been drilled.
  Until then, DR-05 remains unrecoverable regardless of what the workflow
  file says.
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
  Cloudflare, so a single-vendor loss takes the only database backup and
  the images at once — the reason a second offsite copy (3-2-1) is a named
  follow-up in the canonical doc.

## Open Questions

- Whether the WP-416 secrets have been provisioned and the first
  `workflow_dispatch` backup has produced an object in R2 (until then the
  workflow skips green and no external backup exists).
- Whether a restore has been drilled and an RTO measured — the §7 drill
  record is where that evidence lives; treat this page's recoverability
  claims as "designed for," not "proven," until a drill exists.
- The confirmed RPO / RTO values (canonical doc §1), long-term
  weekly/monthly GFS retention beyond the 35-day window, and a second
  offsite copy of the dump — all named as operator follow-ups.

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
  the daily `pg_dump` → R2 workflow.
- [ARCHITECTURE.md §Persistence Boundary](../docs/ai/ARCHITECTURE.md) and
  [DECISIONS.md](../docs/ai/DECISIONS.md) D-24095 (framework-store
  exemption), D-24236 (WP-416 backup pipeline).
- [`render.yaml`](../render.yaml) — the blueprint a rebuild reconstitutes
  (`databases:` block, `R2_*` secret shape, `sync: false` secret list).
