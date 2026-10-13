# Disaster Recovery — Legendary Arena

> **Last updated:** 2026-10-12
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
which backed up Render from 2026-08-09, was **disabled at cutover** and is deleted
after the rollback window. The key layout and retention are unchanged, so the R2
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

**Rollback window (to ~2026-10-20).** The Render web service is suspended, not
deleted, and Render's database snapshots exist until that database is deleted.
Rolling back is the D-24707 §8 procedure: restore the DNS-only CNAME `api.` →
`legendary-arena-server.onrender.com`, resume the service, swap
`LEGENDS_PUBLISHER_ENABLED`, and **re-add `api.` as a Render custom domain**
(Render's Cloudflare-for-SaaS hostname overrides the zone record). After the
window, Render is deleted and this paragraph goes.

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
| Full rebuild on a **new** droplet (provision, harden, Postgres, TLS, restore, deploy, DNS) | **Not yet timed** — the next full-rebuild drill measures it | — |

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
| `la-droplet-monitor` down | On-box health, disk, or backup age failed | Read the ping body, then the matching journal. |

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
   dump. **Open decision:** encrypt each dump on the droplet with a public key
   (e.g. `age`), keeping the private key offline in the operator's secret
   store. The cost is key custody: lose that key and every encrypted backup is
   unreadable.
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

**`/etc/la/.env` — droplet-owned** (written by the provisioners, not copied from
anywhere): `DATABASE_URL` (the local role), `NODE_ENV`, `NODE_VERSION`, `PORT`,
and `LEGENDS_PUBLISHER_ENABLED` (`true` only on the box holding the live database,
because the publisher writes production R2 from its own database).

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
- **Procedure (droplet intact):** redeploy with the lab's `40-app-deploy.ps1`
  (checkout, frozen install, build, migrations, restart, health gate). A known-
  good commit is a hand deploy with `DEPLOY_REF=<sha>`.
- **Procedure (droplet lost):** create a droplet (Ubuntu 24.04) with the lab's
  cloud-init → run the provisioners in order (`05` SSH, `06` UFW, `07`, `08`
  swap, `10` Node/pnpm, `20` Nginx, `21` Cloudflare origin TLS with the Origin Certificate, `30`
  PostgreSQL) →
  install `/etc/la/.env` and `/etc/la/backup.env` (§4) → DR-01 restore from R2
  → `40-app-deploy.ps1` → `50`/`60 -Install` (backup and monitor timers) →
  point the proxied `api.` A record at the new IP → §6 validation. The
  provisioners are vendor-neutral (CI smoke runs them on plain Ubuntu 24.04), so
  another provider works if DigitalOcean is the problem.

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
- [`SERVER_REBUILD_RUNBOOK.md`](SERVER_REBUILD_RUNBOOK.md) — **split out
  2026-08-09**: the step-by-step **quarterly full-service rebuild drill** (bare
  host → running service → §6 capability validation). **It predates the
  2026-10-12 droplet cutover** (it still describes PM2 and Render). Until it is
  updated, the executable rebuild is the `legendary-arena-lab` provisioners in
  the order given in §5 DR-02.
- `POSTGRES_RESTORE_RUNBOOK.md` — not yet split. On the droplet, restores are the
  lab's `51-restore.ps1` (§5 DR-01, DR-03).

**Not yet decided (operator):** the RPO/RTO values (§1), and whether a passing DR
drill becomes a *binding* release gate (that would need a `DECISIONS.md` entry — it
is descriptive here, not enforced). *(The external `pg_dump` → R2 pipeline question
is resolved — built as WP-416, live since 2026-08-09, and moved onto the droplet at
the 2026-10-12 cutover, §0.)*
