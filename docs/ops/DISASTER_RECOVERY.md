# Disaster Recovery — Legendary Arena

> **Last updated:** 2026-10-20
>
> Operator-focused recovery procedures for restoring **service** (players
> able to log in and play), not just files, after infrastructure loss,
> database failure, accidental deletion, or credential compromise.
>
> **Companion docs:** [`INCIDENT_RESPONSE.md`](INCIDENT_RESPONSE.md) covers
> *in-match game-state* incidents (P0–P3 severity, rollback, replay desync);
> this document covers *infrastructure* recovery. The ewiki
> [Ubuntu Lab Provisioning](../../wiki/ubuntu-lab-provisioning.md) page
> documents the production droplet and the `legendary-arena-lab`
> provisioners a rebuild re-runs; restore and rebuild drills run against a
> **copy** of the database, never the live one.

---

## 0. Current state — read this first

**Production moved off Render on 2026-10-12 (D-24707).** `api.legendary-arena.com`
(`apps/server`) and its PostgreSQL 18 run on one self-hosted DigitalOcean droplet
(`sfo3`, Ubuntu 24.04) behind Cloudflare. Postgres listens on `localhost` only.
The droplet was built by the numbered provisioners in the
`legendary-arena/legendary-arena-lab` repo (`infra/scripts/NN-*.ps1`), and every
one of them was rehearsed on 2026-10-11/12 before cutover. The front-ends stay on
Cloudflare Pages, and the ewiki and dashboard are Cloudflare Workers (D-24690).

**Backups run on the droplet.** Every night at 09:17 UTC the `la-backup` systemd
timer runs the lab's `50-backup.ps1`: `pg_dump -Fc` → a local copy (last 7) → the
private Cloudflare R2 bucket `legendary-arena-db-backups` (`db-backups/YYYY/MM/DD/`,
GFS: 35 daily · 12 weekly · 12 monthly) → a **permanent pCloud mirror** (the
second vendor). Each offsite copy reports to its own healthchecks.io check. The
first production backup landed in R2 and pCloud on 2026-10-12, byte-identical.
The WP-416 GitHub Actions nightly (`.github/workflows/db-backup.yml`, D-24236),
which backed up Render from 2026-08-09, was **disabled at cutover** and deleted on
2026-10-22 with Render. The key layout and retention are unchanged, so the R2
and pCloud history is continuous.

Consequence, stated plainly so it is not discovered during a crisis:

- **There is no managed backup layer and no point-in-time recovery.** Render's
  snapshots and PITR ended with Render. Worst-case data loss for DR-01 and DR-03
  is everything since the last nightly dump (up to ~24 h).
- **The database lives on the droplet.** Losing the droplet loses the live
  database, so a lost droplet is DR-01 on a fresh droplet, not just DR-02.
- **DR-05 is recoverable.** The R2 dump survives losing the droplet or
  DigitalOcean; the pCloud copy survives losing Cloudflare. Restores were drilled
  from R2 (2026-08-09, and onto the droplet 2026-10-12) and from pCloud
  (2026-08-10) — §7.

**Render is deleted (2026-10-22).** The D-24707 §8 rollback window ended
~2026-10-20, and the Render web service, its database, and the `render.yaml`
Blueprint were deleted on 2026-10-22. There is no Render rollback target and no
Render database snapshot: the droplet's nightly dumps in R2 and pCloud are the
only copies.

---

## 1. Recovery objectives (RPO / RTO)

These are **business decisions**; the values below are **proposed defaults
pending operator confirmation** (Jeff), seeded from the review that prompted
this doc.

| Objective | Definition | Proposed default | Bounded by |
|---|---|---|---|
| **RPO** (max acceptable data loss) | How much recent data may be lost | **24 hours** | Backup cadence. The droplet takes one nightly dump and has no PITR, so the effective RPO is ≈ 24 h. Only WAL archiving (not built) would tighten it. |
| **RTO** (max acceptable downtime) | How long service may be down | **4 hours** | Restore + redeploy time — measure it in the §7 drill, don't assume it. The 2026-10-12 cutover (dump, restore, DNS switch) took 10 m 10 s of measured downtime. |

The protected data (what RPO is measured against): accounts, player profiles,
friendships, competitive scores, match metadata, replay metadata — all in
Postgres (`legendary.*` and `bgio.*`).

> Confirm or adjust these two numbers before treating any drill result as
> pass/fail — a recovery that took 6 hours only "fails" against a stated RTO.

**Measured so far** (from the §7 drill records):

| Step | Measured | Drill |
|---|---|---|
| Download + restore the database from an R2 object | 3 s (2.7 MB dump) | 2026-08-09 |
| Download + restore from the pCloud copy | 6 s (2.5 MB dump) | 2026-08-10 |
| Dump production + restore it onto the droplet | 13 s dump (14.6 MB) + restore | 2026-10-12 cutover |
| End-to-end move of production to a pre-provisioned droplet (freeze, dump, restore, DNS switch) | **10 m 10 s** of downtime (UptimeRobot) | 2026-10-12 cutover |
| App deploy (`40-app-deploy.ps1`: install, build, migrations, restart, health gate) | 71 s | 2026-10-11 rehearsal |
| Full rebuild on a **new** droplet (provision, harden, Postgres, TLS, restore, deploy; DNS not moved) | **13 m 31 s** of hands-on steps (provisioning ~6.5 min of it) | 2026-10-22 rebuild drill |

The database is small (~66 MB live, ~15 MB dump), so the restore itself is
seconds. RTO is bounded by provisioning a host and repointing DNS, not by the
restore.

---

## 2. Critical assets inventory

If an item is not listed here, assume it is lost in a disaster. Recovery
depends on every one of these being independently available.

Assets are tiered by what their loss *means* for recovery:

- **Tier 0 — Existential:** unique, irreplaceable; loss without a backup is
  unrecoverable. These are the only assets a backup strategy exists for.
- **Tier 1 — Service capability:** required for players to play, but
  reconstructable from a provider dashboard or from Tier-0 source (not unique
  data of their own).
- **Tier 2 — Rebuildable:** convenience / operational; reprovisioned from
  scratch with no data loss.

| Tier | Asset | Where it lives | Recovery source |
|---|---|---|---|
| **0** | **Source code** | GitHub `barefootbetters/legendary-arena` | `git clone` |
| **0** | **Database** | PostgreSQL 18 on the DigitalOcean droplet (`localhost` only) | The nightly R2 dump (`51-restore.ps1`, `RESTORE_FROM_R2=latest`), or the pCloud copy (`RESTORE_DUMP=<file>`) |
| **0** | **Secrets / config** | The droplet's root-only `/etc/la/.env` and `/etc/la/backup.env` (mode 600); master copies in the operator's private ops folder — see §4 | Operator's own secret store |
| **1** | **Infrastructure definition** | `legendary-arena/legendary-arena-lab` `infra/` (cloud-init + numbered provisioners, smoke-tested on fresh Ubuntu 24.04 in CI) | GitHub (Tier-0 source), applied to a fresh droplet |
| **1** | **Application host** | The DigitalOcean droplet (`sfo3`, 2 vCPU / 4 GB + 2 GB swap) | Reprovision with the lab provisioners (§5 DR-02) |
| **1** | **DNS + CDN + Access** | Cloudflare (DNS, Pages, Workers, R2, Access, the `Origin TLS strict — api hosts` Configuration Rule) | Cloudflare dashboard |
| **1** | **TLS certificates** | Cloudflare edge (managed); a Cloudflare Origin Certificate on the droplet's Nginx (covers `api.` and `api-next.`, valid to 2041) | Edge: automatic. Origin: the operator's copy, or re-issue in the Cloudflare dashboard |
| **1** | **Card images** | Cloudflare R2 (`images.legendary-arena.com`) | R2; the uploaded bytes also live in the operator's pCloud-synced `card-images-staging/original/` |
| **2** | **Operator workstations** | local machines | reinstall + `git clone` |
| **2** | **CI/CD runners** | GitHub Actions (hosted) | provider-managed |
| **2** | **Monitoring** | healthchecks.io (`la-droplet-monitor`, `la-droplet-backup`, `la-droplet-pcloud`) and UptimeRobot (`api./health/db`); dashboards are derived views | Re-create the checks; ping URLs come from the secrets in §4 |

**The real assets are the Tier-0 three: source code, database data, and
secrets.** The server is replaceable; those three are not.

> **Trigger rule.** Loss of a **Tier-2** asset alone does **not** trigger
> disaster recovery — reprovision it and move on. DR is for Tier-0 loss (and
> Tier-1 loss a provider dashboard cannot immediately restore).

---

## 3. Backup inventory (truthful current state)

| What | Source | Method | Storage | Retention | Verified by |
|---|---|---|---|---|---|
| Database (managed) | — | **None since 2026-10-12.** Self-hosted Postgres has no managed snapshots or PITR. Render's snapshots of the pre-cutover database exist until that database is deleted (~2026-10-20). | — | — | — |
| Database (local) | Droplet Postgres | `pg_dump -Fc`, lab `50-backup.ps1`, nightly 09:17 UTC (`la-backup` timer) | Droplet `/var/backups/la` | Last 7 dumps; lost with the droplet | `la-droplet-monitor` alerts if the newest is over 26 h old |
| Database (external) | the same dump | Uploaded by the same run | Cloudflare R2, private bucket `legendary-arena-db-backups`, `db-backups/YYYY/MM/DD/` | GFS: 35 daily · 12 weekly · 12 monthly | **Drilled 2026-08-09; restored onto the droplet 2026-10-12 (§7)** |
| Database (2nd offsite) | the same dump | `rclone` mirror in the same run | pCloud (US region), `db-backups/` — independent of Cloudflare | Same GFS policy, pruned separately | **Drilled 2026-08-10 (§7)**; first droplet mirror byte-identical to R2, 2026-10-12 |
| Droplet disk image | the whole `la-rehearsal-01` disk | DigitalOcean usage-based Droplet backup, plan `custom_daily`, enabled 2026-10-20 (API action 3485061489; the control panel shows it under the **Usage-Based** tab at $0.03/GiB); a crash-consistent image, not a database backup ([Provider-native options](#provider-native-options-digitalocean)) | DigitalOcean, same account as the droplet | 7 days | Daily, 08:00–12:00 UTC window; first image due 2026-10-21. Image restore not yet drilled |
| Card images | R2 upload pipeline | manual/scripted | Cloudflare R2; source bytes in pCloud `card-images-staging/original/` | indefinite | image loads |
| Source code | GitHub | git | GitHub + local clones | full history | every clone |
| Secrets | operator | manual | droplet `/etc/la/*.env` + operator secret store | operator-managed | §4 completeness |

That is 3-2-1: the live database plus two offsite copies on independent vendors
with independent credentials. The pipeline adds **no standby host and no
alternate-jurisdiction copy** — those would be cost and attack surface aimed at
risks below the operational-drill gaps that actually bound recovery here.

**Failure posture.** The two offsite copies report separately, so a mirror
failure never reads as a failed backup:

| Signal | Meaning | Response |
|---|---|---|
| healthchecks.io `la-droplet-backup` down or late (email) | The dump or the R2 upload failed — no good offsite backup that night | **Urgent**, same day; the RPO clock is running. Read `journalctl -u la-backup`. |
| healthchecks.io `la-droplet-pcloud` down (email, reason in the ping body) | R2 is safe; the pCloud mirror failed, or `BACKUP_PCLOUD_TOKEN` is missing | Fix within days. A revoked pCloud token (`pcloud error: Revoked 'access_token' … (2095)`) is the usual cause: re-mint with `rclone authorize "pcloud"`, write it into the operator's `backup.env`, and reinstall it on the droplet. |
| `la-droplet-monitor` down | On-box health, disk, backup age, or a stuck deploy failed | Read the ping body, then follow the triage steps in [lab Monitoring](https://lab.legendary-arena.com/ops/monitoring/#when-la-droplet-monitor-goes-down). A deploy restart no longer trips it (lab #43). |

Nights missed during a pCloud outage exist only on R2; back-copy them with
`rclone copy r2:<bucket>/db-backups/<yyyy>/<mm> pcloud:db-backups/<yyyy>/<mm>`.
Each rclone authorization is independent, so the droplet's token, the retired
GitHub nightly's `RCLONE_PCLOUD_TOKEN`, and the operator's local `pcloud:` remote
are revoked and re-minted separately. A pCloud account-security change can
revoke all of them at once (it happened 2026-10-05).

### Known gaps

Stated plainly so none of them is discovered during a recovery:

1. **Older backups and the pCloud copy can still be deleted from the droplet.**
   Pruning needs delete rights, so the droplet's R2 and pCloud tokens can delete
   dumps. Since 2026-10-13 the R2 bucket lock (below) protects every R2 dump for
   its first 30 days, which are the ones a restore uses; weekly and monthly R2
   dumps older than that, and every pCloud copy, remain deletable. pCloud has no
   equivalent lock documented here.
2. **Dumps are not encrypted client-side.** R2 encrypts every object at rest
   (AES-256, Cloudflare-managed keys), but anyone holding the R2 or pCloud
   credentials, or the operator's pCloud login, can read the player data in a
   dump. **Deferred (operator, 2026-10-13)** until the AI Second Brain's
   connections are mapped (DigitalOcean, Cloudflare, GitHub, the laptop,
   pCloud, the Hugo sites), so one key-custody design covers the brain's
   backups and these. The candidate is unchanged: encrypt each dump on the
   droplet with a public key (e.g. `age`), private key held offline in the
   operator's secret store. The cost is key custody: lose that key and every
   encrypted backup is unreadable.
3. **Payments since the last dump are missing after a restore.** There is no
   PITR, and purchases reach `legendary.*` through Stripe webhooks. Stripe is
   the source of truth and keeps events for 30 days, and the webhook handler
   ignores duplicate deliveries, so a restore is followed by resending the
   events since the dump time (§5 DR-01, DR-03).

**Closed 2026-10-13:**

- **Nothing stopped the droplet from deleting every R2 copy.** R2 bucket lock
  rule `la-db-backup-lock` on `legendary-arena-db-backups`, prefix `db-backups`,
  30 days, enabled 2026-10-13: no R2 dump can be deleted or overwritten in its
  first 30 days. Lock rules are changed through the Cloudflare dashboard or
  account API, not the S3 credentials the droplet holds, so a compromised
  droplet or a retention bug can't remove them. GFS pruning never conflicts:
  `scripts/db-backup-retention.mjs` keeps every backup younger than 35 days
  and ignores keys it can't parse, so it never asks to delete a locked object.

- **The job only checked size** (D-24711). `50-backup.ps1` now runs `pg_restore --list`
  on every dump before upload (integrity gate 3, on produce) and fails the run
  on an unreadable or empty archive. It logs the SHA-256, and the success ping
  body carries `size=… toc_entries=… sha256=…` (lab #34; first production run
  2026-10-13: 318 entries).
- **A dead database did not alert** (D-24711). `GET /health/db` runs `SELECT 1` and
  answers 503 when the database is down or slow (engine #2760).
  `la-droplet-monitor` checks it every 5 minutes (lab #34), and UptimeRobot's
  public monitor was moved from `/health` to `/health/db` on 2026-10-13.

### Not in any backup

The nightly dump covers PostgreSQL only. Everything else is recovered from
somewhere else, or not at all:

| Data | Where it lives | If it is lost |
|---|---|---|
| Player avatars | R2 `legendary-images`, `avatars/` | **No second copy.** The database keeps each URL; players re-upload. |
| Card images | R2 `legendary-images` | Re-upload from the operator's pCloud `card-images-staging/original/`. |
| Card metadata, themes | R2 `legendary-images` (`metadata/`, `themes/`) | Regenerated from the repo (`pnpm metadata:upload`, `scripts/upload-themes-to-r2.mjs`). |
| Legends snapshots | R2 `legends/v1/*` | Derived: the publisher rewrites them from the database within 5 minutes. |
| Other R2 media (audio) | R2 `legendary-images`, `audio/` | No second copy documented. |
| Sign-in identities and passkeys | Hanko | Vendor-held. `legendary.players` keys each account by its Hanko user id (`auth_provider_id`); losing the Hanko tenant strands every account. |
| Payments, invoices | Stripe | Stripe is the source of truth. |
| Newsletter contacts | Brevo | Vendor-held. |
| Source, issues, Actions history | GitHub | Every clone holds the full source history; issues and Actions history are GitHub-only. |
| Live matches in progress | Runtime only | Not recoverable by design (§9). |

### Provider-native options (DigitalOcean)

An outside review (Grok, 2026-10-20) compared this plan with what DigitalOcean
offers. Its conclusion matches this doc's. The R2 + pCloud logical dumps are the
recovery path, because they survive losing DigitalOcean. DigitalOcean's own tools
add speed, not independence. Each claim below was checked against DigitalOcean's
docs on 2026-10-20. Where the review was wrong, the table says so.

| Option | What it gives | What it does not give | Verdict |
|---|---|---|---|
| **Usage-based Droplet backups** (generally available since 2025-11-26; **enabled 2026-10-20**) | A full disk image every 4 h, 6 h, 12 h, day, or week, taken while the droplet runs. A lost or broken droplet comes back as a new droplet from the image: OS, hardening, Nginx, TLS, `/etc/la/*.env`, and the app, with no provisioner run. | **Not a database backup.** DigitalOcean calls the images crash-consistent (disk only, never memory) and recommends an application-level tool for busy databases, so the image's Postgres is a power-loss copy. **No help for DR-05.** The images live in the same DigitalOcean account, so losing the account loses them. Volumes are not included. | **Enabled 2026-10-20** (§3 inventory). It replaces the full rebuild in DR-02 "droplet lost" (13 m 31 s hands-on, 2026-10-22 drill) with an image restore, while DigitalOcean itself is healthy. Steps: [below](#enabling-droplet-backups). |
| **Postgres data directory on a Volume** | Moves and resizes the data disk on its own. | Droplet backups skip volumes, and DigitalOcean does not schedule volume snapshots, so this adds a second thing to back up. The database is ~66 MB, so moving it buys nothing. | **Not now.** |
| **Managed PostgreSQL** | Daily backups plus WAL, restoring to any point in the last 7 days. The review said PITR comes only on higher tiers, but DigitalOcean's feature page doesn't gate it by plan. Optional standby node for failover. | Reverses D-24707. Its backups stay in the DigitalOcean account, so the R2 + pCloud dumps would still be needed for DR-05. | **Not now.** Revisit only if a confirmed RPO under 24 h or the ops load makes it worth the cost. |
| **WAL archiving to R2 / pCloud** | The self-hosted way to get an RPO under 24 h, and PITR for DR-03. | More moving parts and storage. | **Only if the §1 RPO is confirmed tighter than 24 h.** |
| **Reserved IP** | The `api.` A record survives a rebuild unchanged. | `api.` is proxied by Cloudflare, so repointing it is one quick edit anyway. | **Low.** Worth doing on the next rebuild, not before. |
| **Second copy of avatars and audio** (Spaces, or pCloud) | Closes the "no second copy" rows in [Not in any backup](#not-in-any-backup). | — | **Agreed, already a known gap.** What matters is a copy off Cloudflare; which vendor holds it is secondary. |
| **Client-side encryption of dumps** | — | No DigitalOcean feature covers it. | **Still deferred** (§3 Known gaps, 2). |

The review also flagged §1 RPO / RTO as still unconfirmed. That number decides
the WAL and Managed rows above.

#### Enabling Droplet backups

Operator-only: it changes the DigitalOcean account and adds a monthly charge.

1. **Settings.** Usage-Based plan, Daily, retention 7 days (the panel allows
   7–30 for daily). The image is the
   speed layer and R2 / pCloud keep the history, so a long retention buys
   nothing. Window: 08:00–12:00 UTC (01:00–05:00 Pacific), the quietest hours.
   The 13-second nightly dump at 09:17 falls inside it, which is harmless.
2. **Cost.** The usage-based daily rate is $0.03 per GiB of restorable size per
   month, measured on used disk, not the 80 GB allocation. The basic daily plan,
   for comparison, is 30 % of the droplet ($7.20/mo on the $24 droplet). Read
   the estimate the panel shows before you enable.
3. **Enable.** Control panel → Droplets → `la-rehearsal-01` → **Backups** →
   **Setup Automated Backups** → **Usage-Based** tab → set frequency, retention,
   and window → **Enable Backups**. Without the panel, the API is the path.
   doctl's `--backup-policy-plan daily` is the **basic** (30 %) plan. The
   usage-based plans are `custom_daily`, `custom_weekly`, and `intra_daily_*`
   (`doctl compute droplet backup-policies list-supported`), and they need a
   `retention_period_days` that doctl has no flag for. A `custom_daily` request
   without one is refused with a 422. Send it with the token from the doctl config:
   `curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"type":"enable_backups","backup_policy":{"plan":"custom_daily","hour":8,"retention_period_days":7}}' https://api.digitalocean.com/v2/droplets/<droplet-id>/actions`.
   (This is how it was enabled on 2026-10-20.)
4. **Confirm.** `doctl compute droplet backup-policies get <droplet-id>` shows
   `backup_enabled: true`, the plan, the hour, the retention, and the next
   window. The droplet's `Features` column did not list `backups` right after
   enabling, so don't rely on it. The first image then shows on the
   droplet's Backups page. Record the settings and the date in the §3
   "Droplet disk image" row.
5. **Drill once.** Create a throwaway droplet from the newest image and confirm
   it boots, `la-server` starts, and Postgres comes up clean. Keep it off the
   production database and off DNS. Set `LEGENDS_PUBLISHER_ENABLED=false` on it
   before starting `la-server`, because the image carries production's `true`,
   and that would let two publishers write production R2. Record it in §7, then
   destroy the droplet.

### Backup integrity gates

A backup that *exists* is not a backup that *works*. Each database backup must
satisfy **all** of these before any scenario may count it as a fallback:

1. The object exists at its expected `db-backups/…` key.
2. Its size is non-zero (`50-backup.ps1` already refuses a dump ≤ 1024 bytes on
   *produce*; this re-checks on *consume*).
3. `pg_restore --list <dump>` succeeds — the custom-format archive's table of
   contents is readable (catches a truncated or corrupt dump without a full
   restore). `50-backup.ps1` runs this on produce too, and logs the dump's
   SHA-256; on consume, `sha256sum` the downloaded copy and compare it with that
   night's `Dump readable:` line in `journalctl -u la-backup` (or the
   `la-droplet-backup` ping body).
4. Its age is ≤ the §1 RPO at the moment it is relied upon.
5. A restore drill (§7) has been recorded within the last **90 days**.

**Failure of any gate ⇒ the backup is considered _unavailable_,** and any
scenario that depended on it drops to "not recoverable" until a good backup
passes all five. Gates 1–3 are cheap enough to automate as a post-upload smoke
check; gates 4–5 are policy checks against this document.

---

## 4. Secrets to re-provision

On any rebuild, these values must be restored from the operator's secret store
(they are **not** in the repo). Production reads them from the droplet's
root-only `/etc/la/.env`; the backup job reads `/etc/la/backup.env`.

**The store copy is `la-prod.env`** in the operator's private ops folder, beside
`backup.env`, `monitor.env` and `origin.{crt,key}`. It is a verbatim copy of
production's `/etc/la/.env` (34 keys, verified identical by key name and value hash
on 2026-10-22), so it is the one file a rebuild reads. Refresh it after any
production secret change:
`ssh operator@<droplet ip> "sudo -n cat /etc/la/.env" > la-prod.env`.
It replaced two Render-era exports (`render-secrets*.env`, renamed
`*.RETIRED-20261022`) that disagreed with each other and with production on up to
20 keys, including `JWT_SECRET` and the Stripe keys.

**`/etc/la/.env` — application secrets** (the `sync: false` set in the retired
[`render.yaml`](../../render.yaml)):
`JWT_SECRET`, `HANKO_TENANT_BASE_URL`, `HANKO_EXPECTED_AUDIENCE`,
`HANKO_JWKS_REFRESH_INTERVAL_MS`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ALLOWLIST`, `PUBLIC_BASE_URL`,
`ANALYTICS_USER_ID_SALT`, `SWEEP_SUBMIT_TOKEN`, `INSPECTION_SUBMIT_TOKEN`,
`HANDOFF_SUBMIT_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_ACCOUNT_ID`, `BREVO_API_KEY`, `BREVO_LIST_ID`.

**`/etc/la/.env` — also required, but NOT in `render.yaml`.** `apps/server`
reads these, and they were set only in Render's Environment tab, so a rebuild
that uses `render.yaml` as its checklist misses them:
`DASH_GITHUB_TOKEN`, `DASH_GITHUB_REPO`, `PAR_VERSION`,
`BREVO_FRIEND_REQUEST_TEMPLATE_ID`, `BREVO_FRIEND_ACCEPTED_TEMPLATE_ID`,
`BREVO_MATCH_INVITE_TEMPLATE_ID`.

**`/etc/la/.env` — droplet-owned** (written by hand on each box; no provisioner
writes them, and `la-prod.env` carries the old box's values, so overwrite them):
`DATABASE_URL=postgres://la:<password>@localhost:5432/la` (the password
given to `30-postgres.ps1` as `LA_DB_PASSWORD`), `NODE_ENV=production`,
`PORT=3000`, `LISTEN_HOST=127.0.0.1` (the origin lock; `60-monitor` alerts without
it), `WEB_CONCURRENCY=1`, and `LEGENDS_PUBLISHER_ENABLED` (`true` only on the box
holding the live database, because the publisher writes production R2 from its own
database; `false` on any drill box).

**`/etc/la/backup.env`:** the R2 credentials and bucket for the backup, the pCloud
token (`BACKUP_PCLOUD_TOKEN`), and the healthchecks.io ping URLs
(`BACKUP_HEALTHCHECK_URL`, `BACKUP_PCLOUD_HEALTHCHECK_URL`). `/etc/la/monitor.env`
holds the `la-droplet-monitor` ping URL.

Both files are installed by the operator with `scp` + `sudo install -m 600` and
verified **by key name only** — values are never printed.

**Secret-recovery validation.** Restoring secrets is complete only when both
hold: (a) the recovered inventory **matches** every key listed above — no secret
silently missing — and (b) production startup completes with **no**
fatal-on-missing failures in the logs (`journalctl -u la-server`). Until both
hold, recovery is **not** complete regardless of infrastructure state: a booting
host with a missing `JWT_SECRET` or `STRIPE_SECRET_KEY` has not recovered
service. A missing `DASH_GITHUB_*`, `PAR_VERSION`, or Brevo template id does not
stop boot — it degrades the dashboard, PAR scoring, or transactional email
quietly — so check those keys by name.

---

## 5. Recovery scenarios

Each scenario: trigger, **honest current recoverability**, and procedure.

### Recovery order (all scenarios)

Whatever the scenario, restore in dependency order — upstream before
downstream — so each step has what the next one needs:

1. **Access & credentials** — operator secret store, and logins to Cloudflare /
   DigitalOcean / GitHub / healthchecks.io, plus the operator's SSH key for the
   droplet. Without these, nothing else can start.
2. **Source code** — `git clone` (the engine repo and `legendary-arena-lab`).
3. **Database** — restore the newest dump that passes the §3 gates (§5 DR-01,
   DR-03, DR-05).
4. **Application infrastructure** — host, config, deploy (`40-app-deploy.ps1`
   runs the migrations).
5. **External services** — DNS repoint, R2, Stripe, Brevo.
6. **Capability validation** — §6, top to bottom.
7. **Declare recovery complete** — §8.

> **Rule.** Database recovery always precedes application validation.
> Validating the app against an empty or half-restored database produces false
> failures and wastes the drill.

### DR-01 — Database loss

- **Trigger:** the droplet's database is corrupted or unavailable.
- **Recoverable today?** Yes. Restore the latest R2 dump onto the droplet with
  the lab's `51-restore.ps1` (`RESTORE_FROM_R2=latest`; drilled 2026-10-12), or
  the pCloud copy. There is no PITR: anything since the last nightly dump is lost.
- **Procedure:** stop `la-server` → `51-restore.ps1` with
  `RESTORE_FROM_R2=latest` and `RESTORE_ALLOW_LIVE_TARGET=true` (or
  `RESTORE_DUMP=<file>` for a downloaded pCloud dump) → verify §6 Phase 2 →
  start `la-server` → in the Stripe dashboard, resend every webhook event since
  the dump time (§3 Known gaps, 4) → verify §6 Phases 3+. If the newest R2
  object fails a §3 gate, use the newest one that passes.

### DR-02 — Application server loss

- **Trigger:** the app process or deploy is broken, or the host is compromised.
- **Recoverable today?** Yes. The server is stateless (live match state is in
  Postgres). If only the app is broken, this is the lowest-risk scenario. **If
  the droplet itself is lost, the database went with it** — that is DR-01 on a
  fresh droplet.
- **Procedure (droplet intact):** if the last deploy broke it, run
  `40-app-deploy.ps1 -Rollback` (under `flock /run/la-deploy.lock`). It
  switches `/opt/la-app/current` back to the previous release with no
  rebuild. Otherwise redeploy with the lab's `40-app-deploy.ps1`: a release
  directory build (frozen install, build, migrations), then a restart behind
  `la-server-standby` and a health gate. A known-good commit is a hand deploy
  with `DEPLOY_REF=<sha>`.
- **Procedure (droplet lost):** timed at 13 m 31 s of hands-on steps
  (2026-10-22 drill, §7). Run every provisioner as
  `sudo pwsh -NoProfile -NonInteractive -File <script>` from
  `/opt/la-lab/infra/scripts`.
  1. Create an Ubuntu 24.04 droplet (`s-2vcpu-4gb`; if the region refuses the
     size, use a neighbor such as sfo2 or the `-intel` size) with the lab's
     `infra/cloud-init.yaml`, its `REPLACE_WITH_OPERATOR_PUBLIC_KEY` replaced
     with the operator's public key. Wait for `cloud-init status` → `done`.
  2. Copy the lab tree: `git archive --format=tar origin/main infra | ssh
     operator@<ip> "sudo mkdir -p /opt/la-lab && sudo chown operator:operator
     /opt/la-lab && tar -x -C /opt/la-lab"`.
  3. `05` SSH, `06` UFW, `07` fail2ban/upgrades, `08` swap, `10` Node/pnpm,
     `20` Nginx, `30` PostgreSQL (with a new `LA_DB_PASSWORD`).
  4. Install `/etc/la/.env`, `/etc/la/backup.env` and `/etc/la/monitor.env`
     (§4; write the droplet-owned keys by hand), and the origin cert and key at
     `/etc/ssl/cloudflare/origin.{crt,key}` → `21` Cloudflare origin TLS.
  5. `50 -Install` **before** the restore: it installs rclone, which `51` needs.
  6. DR-01 restore from R2 (`RESTORE_FROM_R2=latest`, `RESTORE_TARGET_DB=la`,
     `RESTORE_ALLOW_LIVE_TARGET=true`).
  7. `40-app-deploy.ps1` with `DEPLOY_REF=<last live sha>`.
  8. `50` once (the first local backup; until it exists `la-health` fails with
     "no backup found"), then `60 -Install`, `22 -Install`, and `41` with
     `DEPLOY_PUBLIC_KEY_FILE` (the public half of `DEPLOY_SSH_KEY`) so automatic
     deploys work; update the `DEPLOY_HOST` / `DEPLOY_KNOWN_HOSTS` secrets.
  9. Point the proxied `api.` A record at the new IP → §6 validation.

  The provisioners are vendor-neutral (CI smoke runs them on plain Ubuntu
  24.04), so another provider works if DigitalOcean is the problem.
- **Procedure (droplet lost, from a Droplet backup image — daily since 2026-10-20, §3):**
  create a droplet from the newest backup image → let Postgres finish crash
  recovery → if the newest R2 dump that passes the §3 gates is newer than the
  image, restore it (DR-01) → point the proxied `api.` A record at the new IP →
  §6 validation. This skips provisioning, but it needs DigitalOcean healthy.
  **Never use an image after a host compromise:** the image may carry the
  compromise, so rebuild from the provisioners.

### DR-03 — Accidental data deletion

- **Trigger:** e.g. `DELETE FROM legendary.friendships;` or
  `DROP TABLE legendary.competitive_scores;`.
- **Recoverable today?** Yes, from the last nightly dump taken before the
  deletion (up to ~24 h of loss for those tables). There is no PITR, and a
  server rebuild does **not** help.
- **Procedure:** identify the deletion time → restore the newest dump taken
  before it into a **scratch** database on the droplet (`51-restore.ps1`
  defaults to a non-live target) → copy the affected tables back → validate
  them (§6 Phase 2) → reconcile anything written since the dump. If billing
  tables were affected, resend the Stripe webhook events since the dump time.

### DR-04 — Credential compromise

- **Trigger:** a secret (JWT, Stripe, R2, DB password, pCloud token, deploy
  key) leaked.
- **Recoverable today?** Yes, operationally: rotate. No data restore needed
  unless data was tampered with.
- **Procedure:** rotate the affected secret at its source (Hanko / Stripe /
  R2 / the Postgres role / pCloud) → update `/etc/la/.env` (or `backup.env`)
  on the droplet and the operator's master copy → `sudo systemctl restart
  la-server` → audit `legendary.admin_actions` / `legendary.stripe_events` for
  misuse. A leaked deploy key can only redeploy commits already on `main`
  (the `la-deploy` gate, D-24708); rotate `DEPLOY_SSH_KEY` anyway. Note
  `ANALYTICS_USER_ID_SALT` rotation invalidates existing `user_id_hash`
  linkage (per its `render.yaml` note) — treat as one-way.

### DR-05 — Cloud-provider / account failure

- **Trigger:** loss of the droplet's data or the DigitalOcean account, or loss
  of Cloudflare.
- **Recoverable?** **Yes.** That depends on all three of these staying true:
  (a) the nightly backup is running (`la-droplet-backup` green), (b) a
  successful backup object is present and passes the §3 integrity gates, and
  (c) a restore drill is on record within 90 days (§7). **Backup existence
  alone is not recoverability.** The R2 dump survives losing the droplet or
  DigitalOcean; the pCloud copy also survives losing Cloudflare.
- **Procedure (DigitalOcean lost):** DR-02 "droplet lost" on any provider,
  restoring from R2.
- **Procedure (Cloudflare lost):** restore from the pCloud copy. Cloudflare
  also hosts DNS, the front-ends, the ewiki, R2 card images and the TLS edge,
  so those must be reconstituted elsewhere first; the card-image bytes are in
  pCloud `card-images-staging/original/`.

---

## 6. Recovery validation checklist (binary, by business capability)

Recovery is **not** complete when "Ubuntu boots." It is complete when
**players can play.** Every item is pass/fail; organize by capability, not by
infrastructure component.

**Phase 1 — Infrastructure**
- [ ] `systemctl is-active la-server` → `active`; no errors in `journalctl -u la-server`
- [ ] Nginx healthy; TLS valid at the Cloudflare edge and at the origin (SSL Full (strict) on `api.`)
- [ ] `curl https://api.legendary-arena.com/health` → HTTP 200 (through Cloudflare)
- [ ] `pwsh scripts/Test-ApiDeployment.ps1 -OriginIp <new droplet IP>` → `SUMMARY: … 0 failure(s)`. Beyond the API surface, it proves the origin lock: Cloudflare refuses a client-supplied `cf-connecting-ip` (403), the droplet IP's 443 and 3000 are unreachable directly, and port 80 only redirects. The guest rate limiters trust that header, so a rebuild that skips `21` (UFW to Cloudflare) or `LISTEN_HOST=127.0.0.1` fails here.
- [ ] healthchecks.io `la-droplet-monitor` green; UptimeRobot `api./health/db` up

**Phase 2 — Database & data integrity**
- [ ] App connects; migrations current; no startup errors in logs
- [ ] Row counts ≈ backup source for: `legendary.players`,
  `legendary.player_profiles`, `legendary.friendships`,
  `legendary.competitive_scores`, `bgio.matches`

**Phase 3 — Authentication**
- [ ] A known test account can log in; session created; profile loads

**Phase 4 — Core gameplay**
- [ ] Create match → appears in lobby
- [ ] Second account joins
- [ ] Turn submits; state updates; match completes
- [ ] Completed match persists across a server restart (`bgio.matches`)

**Phase 5 — Multiplayer (Socket.IO)**
- [ ] WebSocket connects; two clients see real-time state changes; reconnect succeeds

**Phase 6 — Rankings**
- [ ] Match score recorded to `legendary.competitive_scores`; leaderboard shows it

**Phase 7 — Friendships**
- [ ] Friend list loads; request send → accept → friendship visible

**Phase 8 — Storage (R2)**
- [ ] Representative card images render from `images.legendary-arena.com`

**Phase 9 — Payments (Stripe, TEST MODE ONLY)**
- [ ] Stripe test checkout completes. **No production charges during drills.**

**Phase 10 — Marketing (Brevo)**
- [ ] Brevo API auth succeeds; test email received

---

## 7. DR drill record

Keep evidence — the drill history is itself an asset.

```
Date:                YYYY-MM-DD
Scenario:            DR-0X (e.g. full database restore)
Backup object key:   db-backups/YYYY/MM/DD/legendary-arena-<stamp>.dump
Commit SHA restored: <sha the dump's schema/data corresponds to, if known>
Observed RPO:        __ (age of the backup used, at restore time)
Observed RTO:        __ (= Total recovery time, below)
Duration:            __ minutes
Result:              PASS / FAIL
Issues found:        …
Corrective action:   …
```

The drill **record itself** — this block plus the command output you captured —
is the evidence. Screenshots are **not** required; a text log is more useful and
greppable. A drill with no record is treated as **not performed**.

**Metrics to record each drill** (these become the real RTO evidence):

| Metric | Result |
|---|---|
| Time to provision host | |
| Time to restore database | |
| Time to deploy app | |
| Time to restore secrets | |
| Time to first successful login | |
| Time to first successful match | |
| **Total recovery time** | |

**Cadence:** database restore drill **monthly**; full server rebuild
**quarterly**; complete platform recovery **semiannually**; re-run **all**
after any major infrastructure change.

### Running the quarterly rebuild drill

The drill is §5 DR-02 "droplet lost", run in order on a **throwaway** droplet
(tag `la-drill`), never on production. First run: 2026-10-22 (record below).

- **Secrets come from the store** (`la-prod.env`, §4), so the drill also proves
  the store is complete. Three overrides keep the box from touching production:
  `LEGENDS_PUBLISHER_ENABLED=false` (only one box may publish), a `backup.env`
  with `BACKUP_LOCAL_ONLY=true` and no healthchecks or pCloud keys, and a
  `monitor.env` with an empty `MONITOR_HEALTHCHECK_URL` (a drill box must never
  ping the production checks).
- **Never touch `api.`.** To check the Cloudflare edge, run `21` with
  `DOMAIN=api-next.legendary-arena.com`, point the proxied `api-next` A record at
  the drill box, run `pwsh scripts/Test-ApiDeployment.ps1 -BaseUrl
  https://api-next.legendary-arena.com -OriginIp <drill ip>`, then point
  `api-next` back. Without the flip, check at the origin: `/health`, `/health/db`
  and a WebSocket upgrade (`--http1.1`) over `curl --resolve
  api-next.legendary-arena.com:443:127.0.0.1` on the box, and from outside, 443
  and 3000 time out while 80 redirects.
- **§6 Phases 3–10** need a client pointed at the rebuilt box, which the
  front-ends do not support on a side hostname; they are proven at a real cutover.
  Record them as not exercised.
- **Time it:** log each step's UTC finish and report hands-on time apart from any
  wait for the operator.
- **Tear down:** destroy the droplet (it holds production secrets and a data copy),
  drop its host key from `known_hosts`, and put `api-next` back if it moved.
- **Record it:** add the §7 entry, and on that quarter's `DR drill due` issue tick
  `**Quarterly — full-service rebuild drill.**` and `Drill passed` before closing
  it. The dashboard DR Readiness tile reads those two boxes for the last rebuild.

### Drill history

**2026-08-09 — DR-05 restore-mechanics drill (local `pg_restore` of a prod dump).**

```
Date:                2026-08-09
Scenario:            DR-05 — restore of a full `pg_dump -Fc` of production Postgres
Backup object key:   n/a — dumped directly from prod for this drill; the WP-416 R2
                     pipeline was not yet live (BACKUP_DATABASE_URL secret fix in
                     progress), so no R2 object existed yet to restore
Commit SHA restored: n/a — data-fidelity drill; schema as on `main` at drill time
Observed RPO:        ~0 (dump taken at drill time)
Observed RTO:        12s (dump 10s + restore 2s) into a throwaway local database
Duration:            ~1 min including validation
Result:              PASS
Issues found:        none — pg_restore --list OK (integrity gate); restored row
                     counts matched prod exactly: legendary.players 4,
                     player_profiles 1, friendships 1, competitive_scores 0,
                     bgio.matches 3
Corrective action:   none. Follow-up: re-drill from an actual R2 object once the
                     WP-416 pipeline produces its first dump.
```

**Scope of this drill.** It proved the restore *mechanics and data fidelity*
(dump → readable archive → restore → row-count match), satisfying the §3
integrity gate "restore drilled within 90 days." It did **not** exercise full
service bring-up (§6 Phases 3–10) or restore the literal R2 artifact — both are
named follow-ups, the latter blocked only on the backup-secret fix.

**2026-08-09 — DR-05 drill from the actual R2 object (definitive).**

```
Date:                2026-08-09
Scenario:            DR-05 — restore of the literal R2 backup object (not a fresh dump)
Backup object key:   db-backups/2026/08/09/legendary-arena-20260809T225114Z.dump (2,702,371 bytes)
Commit SHA restored: n/a — data-fidelity drill; schema as on `main` at backup time
Observed RPO:        minutes (object age at drill time; daily-cadence RPO otherwise)
Observed RTO:        3s (download 1s + restore 2s) into a throwaway local database
Duration:            ~1 min including validation
Result:              PASS
Issues found:        none. pg_restore --list OK (integrity gate). Stable tables
                     matched prod exactly (players 4, player_profiles 1,
                     friendships 1, competitive_scores 0). bgio.matches read
                     restored 1 vs live prod 2 — the RPO gap, not a fidelity
                     fault: the snapshot predates a match prod gained after 22:51.
Corrective action:   none. The R2 object downloads, its archive is readable, and
                     it restores cleanly — DR-05's recovery path is proven.
```

**Scope.** This is the definitive DR-05 drill: it exercised the *actual recovery
artifact* (download the R2 object → readable archive → restore → count-check),
not a freshly-taken dump. It still did not exercise full service bring-up (§6
Phases 3–10) — the quarterly full-rebuild drill on the Ubuntu lab remains the
place for that.

**2026-08-10 — DR-05 drill from the pCloud second copy (3-2-1 close-out).**

```
Date:                2026-08-10
Scenario:            DR-05 — restore of the R2→pCloud mirrored object from the
                     second vendor (pCloud), proving the 3-2-1 copy is recoverable
Backup object key:   db-backups/2026/08/10/legendary-arena-20260810T002522Z.dump (2,534,907 bytes)
Commit SHA restored: n/a — data-fidelity drill; schema as on `main` at backup time
Observed RPO:        minutes (object age at drill time; daily-cadence RPO otherwise)
Observed RTO:        6s (download 4s + restore 2s) into a throwaway local database
Duration:            ~1 min including validation
Result:              PASS
Issues found:        none. pg_restore --list OK. All tables matched prod exactly:
                     players 4, player_profiles 1, friendships 1,
                     competitive_scores 0, bgio.matches 1.
Corrective action:   none. The pCloud copy downloads, its archive is readable, and
                     it restores cleanly — the second vendor is a real recovery path.
```

**Scope.** Confirms the second offsite copy is itself restorable (not merely
present), so a single-vendor loss of Cloudflare leaves an independently-recoverable
copy on pCloud. Same data-fidelity scope as the R2 drills; full service bring-up
stays the quarterly Ubuntu-lab exercise.

**2026-10-11/12 — DR-01 production-copy restore onto the droplet (rehearsal).**

```
Date:                2026-10-11 / 2026-10-12
Scenario:            DR-01 — restore a production `pg_dump` onto the droplet with
                     the lab's 51-restore.ps1, before cutover
Backup object key:   n/a — a production dump copied to the droplet for the drill
                     (deleted afterwards)
Commit SHA restored: n/a — data-fidelity drill; schema_migrations 45 on both sides
Observed RPO:        ~0 (dump taken at drill time)
Observed RTO:        not recorded
Duration:            not recorded
Result:              PASS (second run)
Issues found:        first run failed: production carries pg_stat_statements, and
                     the restore role cannot create it. Fixed in lab #23 (51
                     pre-creates the dump's extensions as postgres and restores
                     via -L; the smoke test covers it). Rerun: 41 tables and
                     6,320 rows identical to production.
Corrective action:   lab #23.
```

**2026-10-12 — DR-05 restore from an R2 object onto the droplet (rehearsal).**

```
Date:                2026-10-12
Scenario:            DR-05 — 50-backup.ps1 uploads to R2, then 51-restore.ps1
                     RESTORE_FROM_R2=latest downloads and restores it
Backup object key:   newest object in legendary-arena-db-backups-rehearsal
                     (a separate rehearsal bucket, never the production one)
Commit SHA restored: n/a — data-fidelity drill
Observed RPO:        minutes (object age at drill time)
Observed RTO:        not recorded
Duration:            not recorded
Result:              PASS — row counts identical
Issues found:        none. GFS pruning on a synthetic 120-day history kept 47
                     and flagged 73, as designed.
Corrective action:   none.
```

**2026-10-12 — Cutover restore (production; the definitive droplet restore).**

```
Date:                2026-10-12 (about 19:00–19:30 UTC)
Scenario:            DR-02/DR-05-shaped move — Render suspended to freeze writes,
                     a read-only dump restored into the droplet's live database
                     (51-restore.ps1, RESTORE_ALLOW_LIVE_TARGET=true), DNS switched
Backup object key:   n/a — a read-only dump taken after the write freeze (14.6 MB,
                     13 s), deleted after the restore
Commit SHA restored: n/a — schema_migrations 45 on both sides
Observed RPO:        0 (writes frozen before the dump)
Observed RTO:        10 m 10 s of downtime, measured by UptimeRobot
Duration:            ~30 min including the rollback rehearsal on api-next
Result:              PASS — 41 tables and 6,425 rows identical to the source.
                     Through Cloudflare: /health 200, WebSocket upgrade 101, and a
                     signed-in match landed in the droplet database. The first
                     production backup landed in R2 and pCloud, byte-identical.
Issues found:        Render's custom-domain registration for api. (Cloudflare for
                     SaaS) overrode the zone record (x-render-routing:
                     suspend-by-user) until it was deleted in Render. A rollback
                     must re-add it (§0).
Corrective action:   recorded in D-24707 §8 and §0 above.
```

**Scope.** The cutover exercised a real restore plus §6 Phases 1–5 (health,
data, login, a match, WebSocket). It did not run Phases 6–10 as a checklist; the
next full-rebuild drill covers those.

**2026-10-22 — DR-02 "droplet lost" full rebuild on a new droplet (no image).**

```
Date:                2026-10-22 (05:57–06:06 and 12:58–13:04 UTC)
Scenario:            DR-02 droplet lost — a throwaway droplet (la-drill-01, sfo2,
                     s-2vcpu-4gb, tag la-drill) built only from lab cloud-init +
                     provisioners (lab a46e9fd) and the operator secret store, then
                     destroyed. Production untouched.
Backup object key:   db-backups/2026/10/22/legendary-arena-20261022T091717Z.dump
                     (1,940,060 bytes; RESTORE_FROM_R2=latest — inferred as the
                     newest nightly at restore time; 51's download line was not
                     captured)
Commit SHA restored: 4a31641c (production's live commit); schema_migrations 46,
                     0 migrations pending
Observed RPO:        ~3 h 45 m (dump age at restore)
Observed RTO:        13 m 31 s of hands-on steps; 7 h 6 m wall clock, almost all of
                     it waiting for the operator to run the restore
Duration:            see the metrics table below
Result:              PASS for §6 Phase 1 at the origin and Phase 2. la-health "All
                     checks passed"; /health, /health/db, /version 200 over origin
                     TLS (Cloudflare Origin CA cert); WebSocket upgrade 101;
                     :3000 on loopback; from outside, 443 and 3000 time out and 80
                     redirects. Row counts identical to production (players 9,
                     player_profiles 1, friendships 3, competitive_scores 0,
                     bgio.matches 0); the box's first local dump was byte-size
                     identical to the source (1,940,060).
Issues found:        1. s-2vcpu-4gb was not creatable in sfo3 (422 "Size is not
                        available in this region"); sfo3 offered only the -intel
                        size ($28). Used sfo2.
                     2. DR-02 never said how lab infra/ gets onto the box.
                     3. 51-restore needs rclone, which only `50-backup.ps1 -Install`
                        installs, and DR-02 ran that after the restore: the restore
                        failed until 50 -Install ran.
                     4. §4 said the provisioners write the droplet-owned .env keys;
                        none does. LISTEN_HOST and WEB_CONCURRENCY were not listed;
                        NODE_VERSION was listed but production does not set it.
                     5. The secret store (render-secrets*.env) lacks DASH_GITHUB_REPO,
                        and its DATABASE_URL is the deleted Render database.
                     6. DR-02 omitted 22 (Cloudflare-range UFW refresh) and 41
                        (deploy user for automatic deploys).
                     7. A fresh box fails la-health with "no backup found" until its
                        first 50-backup run.
Corrective action:   DR-02 procedure and §4 rewritten in this commit (1–4, 6, 7).
                     Item 5 done the same day: the store is now la-prod.env, a
                     verbatim copy of production's .env (§4); the two Render
                     exports also disagreed with each other and were retired.
```

| Metric | Result |
|---|---|
| Time to provision host (create through `30`, incl. cloud-init ~3 min) | 6 m 28 s |
| Time to restore secrets (+ origin cert, then `21`) | 36 s + 6 s |
| Time to restore database (`50 -Install` for rclone, then `51`) | 7 s + 6 s |
| Time to deploy app (`40`) | 69 s |
| Timers, first backup, deploy user (`60`/`22 -Install`, `50`, `41`) | 12 s |
| Time to first successful login | not exercised |
| Time to first successful match | not exercised |
| **Total recovery time (hands-on)** | **13 m 31 s** |

**Scope.** The `api.` record was not moved and the `api-next` flip was not made,
so the drill did not cover the Cloudflare edge path (proven at the 2026-10-12
cutover) or §6 Phases 3–10, which need a client pointed at the rebuilt box.
Add about a minute for the proxied A-record edit. Destroying the box removed the
production secrets and data copy it held. Next full rebuild is due by
2027-01-22 (quarterly).

---

## 8. Acceptance criteria & success statement

Recovery is successful **only** when all of the following pass: health
endpoint 200; users can log in; profiles load; match creation, join, and
completion work; leaderboards update; friendships function; images load;
emails function; payments function (test mode); no critical errors in logs.

> **A backup is not considered valid until it has been successfully restored
> and validated through a recovery drill.** The restore procedure — not the
> backup file — is the asset.

> **Disaster-recovery success statement.** Recovery is complete only when a
> test user can authenticate, create a match, play a complete game, submit a
> score, observe the leaderboard update, and access all required assets and
> services without error. Infrastructure recovery alone does not constitute
> successful service restoration.

---

## 9. Non-goals — what recovery does not preserve

Disaster recovery restores **durable persisted data only**. It does **not**
preserve, and no drill is expected to recover:

- **Active matches in progress** — live `G` / `ctx` is runtime-only. A
  *completed* match persists via `bgio.matches`; an in-flight one does not
  survive a cutover.
- **Open WebSocket / Socket.IO connections** — clients reconnect and resync.
- **Runtime memory and process-local state.**
- **Temporary caches.**
- **Analytics hash continuity after an `ANALYTICS_USER_ID_SALT` rotation**
  (DR-04) — one-way by design.

This aligns with the persistence boundary: `G` and `ctx` are runtime-only, and
snapshots are derived counts, never save-games. Recovery guarantees the durable
record — accounts, profiles, friendships, scores, match metadata, replay
metadata — not the ephemeral session running on top of it.

---

## 10. Future structure

Kept close to **one** document (duplicate-first: split only when a section grows
unwieldy). Current split:

- `DISASTER_RECOVERY.md` — this overview + scenarios + acceptance (stays).
- `SERVER_REBUILD_RUNBOOK.md` — **retired 2026-10-22.** Split out 2026-08-09 for
  the quarterly rebuild drill, it described the Render / PM2 / certbot host and
  went stale at the 2026-10-12 cutover. The rebuild is now §5 DR-02 (drilled
  2026-10-22) and the drill wrapper is §7 "Running the quarterly rebuild drill".
- `POSTGRES_RESTORE_RUNBOOK.md` — not yet split. On the droplet, restores are the
  lab's `51-restore.ps1` (§5 DR-01, DR-03).

**Not yet decided (operator):** the RPO/RTO values (§1), and whether a passing DR
drill becomes a *binding* release gate (that would need a `DECISIONS.md` entry — it
is descriptive here, not enforced). *(The external `pg_dump` → R2 pipeline question
is resolved — built as WP-416, live since 2026-08-09, and moved onto the droplet at
the 2026-10-12 cutover, §0.)*
