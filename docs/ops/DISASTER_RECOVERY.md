# Disaster Recovery — Legendary Arena

> **Last updated:** 2026-08-09
>
> Operator-focused recovery procedures for restoring **service** (players
> able to log in and play), not just files, after infrastructure loss,
> database failure, accidental deletion, or credential compromise.
>
> **Companion docs:** [`INCIDENT_RESPONSE.md`](INCIDENT_RESPONSE.md) covers
> *in-match game-state* incidents (P0–P3 severity, rollback, replay desync);
> this document covers *infrastructure* recovery. The ewiki
> [Ubuntu Lab Provisioning](../../wiki/ubuntu-lab-provisioning.md) page is
> where the restore and rebuild drills below are *rehearsed* on a
> non-production box.

---

## 0. Current state — read this first

Prerequisite #1 — a provider-independent database backup — **now exists in
code** (WP-416 / D-24236): the `.github/workflows/db-backup.yml` GitHub Actions
workflow runs `pg_dump -Fc` daily against the Render database and uploads the
dump to a **private** Cloudflare R2 bucket under `db-backups/`, pruned by a
grandfather-father-son policy (35 daily · 12 weekly · 12 monthly). It runs in CI,
independent of the app server. **It is live as of 2026-08-09** —
the five GitHub Actions secrets (`BACKUP_DATABASE_URL`, `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET`, the last a
private bucket) are provisioned, and a `workflow_dispatch` run confirmed a dump
landed in R2 (`db-backups/2026/08/09/…dump`, ~2.7 MB). Daily backups now run on
the `17 9 * * *` schedule.

Alongside it, Render's managed Postgres still produces internal backups (daily
snapshots and, on the current `pro-4gb` plan, point-in-time recovery — confirm
retention in the Render dashboard).

Consequence, stated plainly so it is not discovered during a crisis:

- **DR-01 / DR-03** (database loss, accidental deletion) are recoverable through
  Render's own dashboard restore / PITR **and**, once the workflow is
  provisioned, from the R2 dump. The restore *mechanics* were drilled 2026-08-09
  (a full `pg_dump`/`pg_restore` of prod into a scratch DB; row counts matched —
  §7), and re-drilled the same day from the **actual R2 object** (downloaded and
  restored; stable tables matched — §7).
- **DR-05** (Render itself loses the data, or the account is lost) becomes
  recoverable **once the R2 backup is live *and* one restore drill is recorded**
  (§5 DR-05): the dump on Cloudflare R2 is the only copy that survives losing
  Render, and an un-drilled dump is an assumption, not a recovery. **Both hold as
  of 2026-08-09** — the backup is live and the R2 object has been restored in a
  drill (§7), so this scenario is now recoverable.

**The core provision-and-drill work is complete** (2026-08-09, §7): secrets
provisioned, first backup in R2, and the R2 object restored in a drill.
Grandfather-father-son long-term retention (weekly/monthly tiers) is now **enabled**
(2026-08-09, §3). The second offsite copy (3-2-1) is **wired** into `db-backup.yml`
(pCloud mirror), pending only its `RCLONE_PCLOUD_TOKEN` secret (§3).

---

## 1. Recovery objectives (RPO / RTO)

These are **business decisions**; the values below are **proposed defaults
pending operator confirmation** (Jeff), seeded from the review that prompted
this doc.

| Objective | Definition | Proposed default | Bounded by |
|---|---|---|---|
| **RPO** (max acceptable data loss) | How much recent data may be lost | **24 hours** | Backup cadence. With only Render daily snapshots, effective RPO ≈ 24 h; enabling/using PITR tightens it toward minutes. |
| **RTO** (max acceptable downtime) | How long service may be down | **4 hours** | Restore + redeploy time — measure it in the §7 drill, don't assume it. |

The protected data (what RPO is measured against): accounts, player profiles,
friendships, competitive scores, match metadata, replay metadata — all in
Postgres (`legendary.*` and `bgio.*`).

> Confirm or adjust these two numbers before treating any drill result as
> pass/fail — a recovery that took 6 hours only "fails" against a stated RTO.

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
| **0** | **Database** | Render managed Postgres (`legendary-arena-db`) | Render restore / PITR; **plus** the WP-416 R2 dump once its secrets are provisioned |
| **0** | **Secrets / config** | Operator secret store (values are `sync: false` in [`render.yaml`](../../render.yaml)) — see §4 | Operator's own password manager / vault |
| **1** | **Infrastructure definition** | [`render.yaml`](../../render.yaml) (blueprint) | GitHub (Tier-0 source), applied via Render |
| **1** | **DNS + CDN + Access** | Cloudflare (Pages, R2, Access, DNS) | Cloudflare dashboard |
| **1** | **TLS certificates** | Render / Cloudflare (managed); Certbot on a self-hosted box | Re-issued automatically / via Certbot |
| **1** | **Card images** | Cloudflare R2 (`images.legendary-arena.com`) | R2 (independent of Render) |
| **2** | **Ubuntu lab / staging box** | operator-provisioned droplet | reprovision ([Ubuntu Lab Provisioning](../../wiki/ubuntu-lab-provisioning.md)) |
| **2** | **Operator workstations** | local machines | reinstall + `git clone` |
| **2** | **CI/CD runners** | GitHub Actions (hosted) | provider-managed |
| **2** | **Monitoring / dashboards** | derived views | rebuild from source |

**The real assets are the Tier-0 three: source code, database data, and
secrets.** The server is replaceable; those three are not.

> **Trigger rule.** Loss of a **Tier-2** asset alone does **not** trigger
> disaster recovery — reprovision it and move on. DR is for Tier-0 loss (and
> Tier-1 loss a provider dashboard cannot immediately restore).

---

## 3. Backup inventory (truthful current state)

| What | Source | Method | Storage | Retention | Verified by |
|---|---|---|---|---|---|
| Database (managed) | Render Postgres | Render automated snapshots + PITR | Render (internal) | Per Render plan — **confirm in dashboard** | **Never drilled** |
| Database (external) | Render Postgres | `pg_dump -Fc` — daily GitHub Actions (`.github/workflows/db-backup.yml`, WP-416) | Cloudflare R2 (private `R2_BACKUP_BUCKET`, `db-backups/` prefix) | GFS: 35 daily · 12 weekly · 12 monthly | **Drilled 2026-08-09 (§7)** |
| Database (2nd offsite) | the same dump | `rclone copyto` — same `db-backup.yml` run, after the R2 upload | pCloud (`db-backups/` path), independent of Cloudflare | GFS mirror (same selector) | **pending `RCLONE_PCLOUD_TOKEN`** |
| Card images | R2 upload pipeline | manual/scripted | Cloudflare R2 | indefinite | image loads |
| Source code | GitHub | git | GitHub + local clones | full history | every clone |
| Secrets | operator | manual | operator secret store | operator-managed | §4 completeness |

**Now live and hardened:** the external row's pipeline (WP-416) is provisioned and
producing daily backups, a restore has been drilled (§7), and **grandfather-
father-son retention is enabled** — 35 daily, then one-per-week out to 12 weeks,
then one-per-month out to 12 months (`scripts/db-backup-retention.mjs`). The
**second offsite copy** (3-2-1) is now **wired into `db-backup.yml`**: after the R2
upload the same dump is `rclone`-mirrored to **pCloud** — a vendor independent of
Cloudflare — and pruned to the same GFS policy. Like the R2 leg it skips green
until its secret (`RCLONE_PCLOUD_TOKEN`) is provisioned; until then only the R2
copy is produced. It is additive to the existing pipeline and requires
**no new primary infrastructure** (no standby host, no alternate-jurisdiction copy) — those would
be cost and attack surface aimed at risks below the license-loss and
operational-drill gaps that actually bound recovery here.

### Backup integrity gates

A backup that *exists* is not a backup that *works*. Each database backup must
satisfy **all** of these before any scenario may count it as a fallback:

1. The object exists at its expected `db-backups/…` key.
2. Its size is non-zero (the workflow already refuses a dump ≤ 1024 bytes on
   *produce*; this re-checks on *consume*).
3. `pg_restore --list <dump>` succeeds — the custom-format archive's table of
   contents is readable (catches a truncated or corrupt dump without a full
   restore).
4. Its age is ≤ the §1 RPO at the moment it is relied upon.
5. A restore drill (§7) has been recorded within the last **90 days**.

**Failure of any gate ⇒ the backup is considered _unavailable_,** and any
scenario that depended on it drops to "not recoverable" until a good backup
passes all five. Gates 1–3 are cheap enough to automate as a post-upload smoke
check; gates 4–5 are policy checks against this document.

---

## 4. Secrets to re-provision (from `render.yaml`)

On any rebuild, these `sync: false` values must be restored from the
operator's secret store (they are **not** in the repo):

`JWT_SECRET`, `HANKO_TENANT_BASE_URL`, `HANKO_EXPECTED_AUDIENCE`,
`HANKO_JWKS_REFRESH_INTERVAL_MS`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ALLOWLIST`, `PUBLIC_BASE_URL`,
`ANALYTICS_USER_ID_SALT`, `SWEEP_SUBMIT_TOKEN`, `INSPECTION_SUBMIT_TOKEN`,
`HANDOFF_SUBMIT_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_ACCOUNT_ID`, `BREVO_API_KEY`, `BREVO_LIST_ID`, plus `DATABASE_URL`
(provided by the DB service). Production startup is fatal-on-missing for
several of these, so a missing secret shows up immediately as a boot failure.

**Secret-recovery validation.** Restoring secrets is complete only when both
hold: (a) the recovered inventory **matches** the `sync: false` set in
[`render.yaml`](../../render.yaml) — no secret silently missing — and (b)
production startup completes with **no** fatal-on-missing failures in the logs.
Until both hold, recovery is **not** complete regardless of infrastructure
state: a booting host with a missing `JWT_SECRET` or `STRIPE_SECRET_KEY` has
not recovered service.

---

## 5. Recovery scenarios

Each scenario: trigger, **honest current recoverability**, and procedure.

### Recovery order (all scenarios)

Whatever the scenario, restore in dependency order — upstream before
downstream — so each step has what the next one needs:

1. **Access & credentials** — operator secret store, and logins to Cloudflare /
   Render / GitHub. Without these, nothing else can start.
2. **Source code** — `git clone`.
3. **Database** — snapshot / PITR / R2 dump restore (§5 DR-01, DR-03, DR-05).
4. **Application infrastructure** — host, config, `node scripts/migrate.mjs`,
   deploy.
5. **External services** — DNS repoint, R2, Stripe, Brevo.
6. **Capability validation** — §6, top to bottom.
7. **Declare recovery complete** — §8.

> **Rule.** Database recovery always precedes application validation.
> Validating the app against an empty or half-restored database produces false
> failures and wastes the drill.

### DR-01 — Database loss

- **Trigger:** DB instance corrupted / unavailable.
- **Recoverable today?** Only via Render dashboard restore / PITR. No external
  fallback.
- **Procedure:** Render dashboard → restore the DB to the latest good snapshot
  (or a PITR timestamp within RPO) → verify §6 Phase 2 → verify §6 Phases 3+.

### DR-02 — Application server loss

- **Trigger:** server destroyed / host compromised. **Database intact.**
- **Recoverable today?** Yes. The server is stateless (live match state is in
  Postgres). This is the lowest-risk scenario.
- **Procedure:** provision host → install runtime (Node `24.18.0`, pnpm, PM2,
  Nginx) → `git clone` → `pnpm install && pnpm -r build` → restore secrets
  (§4) → `node scripts/migrate.mjs` → `pm2 start` → §6 validation. On Render:
  redeploy from `main` (the blueprint rebuilds the service).

### DR-03 — Accidental data deletion

- **Trigger:** e.g. `DELETE FROM legendary.friendships;` or
  `DROP TABLE legendary.competitive_scores;`.
- **Recoverable today?** Only via Render PITR to a timestamp just before the
  deletion — **if** PITR is enabled and its window covers it. A server snapshot
  does **not** help. This is the scenario an external backup most protects.
- **Procedure:** identify the deletion time → Render PITR restore to just
  before it → validate affected tables (§6 Phase 2) → reconcile.

### DR-04 — Credential compromise

- **Trigger:** a secret (JWT, Stripe, R2, DB password) leaked.
- **Recoverable today?** Yes, operationally: rotate. No data restore needed
  unless data was tampered with.
- **Procedure:** rotate the affected secret at its source (Hanko / Stripe /
  R2 / Render DB) → update the Render env var → redeploy → audit
  `legendary.admin_actions` / `legendary.stripe_events` for misuse. Note
  `ANALYTICS_USER_ID_SALT` rotation invalidates existing `user_id_hash`
  linkage (per its render.yaml note) — treat as one-way.

### DR-05 — Cloud-provider / account failure

- **Trigger:** Render outage that loses data, or loss of the Render account.
- **Recoverable?** **NO** until *all three* hold: (a) the R2 backup is
  configured (secrets provisioned), (b) a successful backup object is present
  and passes the §3 integrity gates, and (c) a restore drill has been recorded
  (§7). **Backup existence alone is not recoverability.** Once all three hold:
  yes, from the R2 dump — the only database copy that survives losing Render.
- **Procedure:** provision Postgres elsewhere → restore the latest `db-backups/…`
  R2 dump (`pg_restore`) → stand up the server (DR-02) pointed at it → repoint DNS
  → §6 validation.

---

## 6. Recovery validation checklist (binary, by business capability)

Recovery is **not** complete when "Ubuntu boots." It is complete when
**players can play.** Every item is pass/fail; organize by capability, not by
infrastructure component.

**Phase 1 — Infrastructure**
- [ ] Server process running; PM2 (or Render service) healthy
- [ ] Nginx / reverse proxy healthy; TLS valid
- [ ] `curl https://api.legendary-arena.com/health` → HTTP 200

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

Kept as **one** document today (duplicate-first: split only when a section
grows unwieldy). If/when the procedures deepen, split into:

- `DISASTER_RECOVERY.md` — this overview + scenarios + acceptance (stays).
- `POSTGRES_RESTORE_RUNBOOK.md` — database-specific restore commands.
- `SERVER_REBUILD_RUNBOOK.md` — full Ubuntu/Render rebuild steps.

**Not yet decided (operator):** the RPO/RTO values (§1); whether building the
external `pg_dump` → R2 backup pipeline (prerequisite #1) proceeds as its own
Work Packet; and whether a passing DR drill becomes a *binding* release gate
(that would need a `DECISIONS.md` entry — it is descriptive here, not enforced).
