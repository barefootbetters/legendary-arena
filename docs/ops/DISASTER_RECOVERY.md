# Disaster Recovery — Legendary Arena

> **Last updated:** 2026-07-23
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

**Legendary Arena does not have a provider-independent database backup
today.** A repo audit (2026-07-23) found no `pg_dump`/`pg_restore`, no backup
cron, and nothing writing a database copy to R2 or any off-Render store. The
only backups that exist are whatever **Render's managed Postgres** produces
internally (daily snapshots and, on the current `pro-4gb` plan, point-in-time
recovery — operator to confirm retention in the Render dashboard).

Consequence, stated plainly so it is not discovered during a crisis:

- **DR-01 / DR-03** (database loss, accidental deletion) are recoverable
  **only** through Render's own dashboard restore / PITR. If that works and
  its retention window covers the event, good — but it has never been drilled.
- **DR-05** (Render itself loses the data, or the account is lost) is
  **currently unrecoverable.** There is no copy of the database outside Render.

**Prerequisite #1 for real DR is building an external backup pipeline**
(`pg_dump` → Cloudflare R2, retained daily/weekly/monthly, independent of
Render). Until that exists, this document describes a *target* capability and
an *honest* current-state; the validation drills below can still be run
against Render-managed backups, but the off-provider gap is the top risk.

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

| Asset | Where it lives | Recovery source |
|---|---|---|
| **Source code** | GitHub `barefootbetters/legendary-arena` | `git clone` |
| **Database** | Render managed Postgres (`legendary-arena-db`) | Render restore / PITR (today); external backup (once built) |
| **Secrets / config** | Render dashboard env vars (`sync: false` in [`render.yaml`](../../render.yaml)) — see §4 | Operator's own secret store (password manager / vault) |
| **Infrastructure definition** | [`render.yaml`](../../render.yaml) (blueprint) | GitHub |
| **DNS + CDN + Access** | Cloudflare (Pages, R2, Access, DNS) | Cloudflare dashboard |
| **TLS certificates** | Render / Cloudflare (managed); Certbot on a self-hosted box | Re-issued automatically / via Certbot |
| **Card images** | Cloudflare R2 (`images.legendary-arena.com`) | R2 (independent of Render) |

**The real assets are the source code, the database data, and the secrets.**
The server is replaceable; those three are not.

---

## 3. Backup inventory (truthful current state)

| What | Source | Method | Storage | Retention | Verified by |
|---|---|---|---|---|---|
| Database (managed) | Render Postgres | Render automated snapshots + PITR | Render (internal) | Per Render plan — **confirm in dashboard** | **Never drilled** |
| Database (external) | — | **none** | **none** | **none** | — |
| Card images | R2 upload pipeline | manual/scripted | Cloudflare R2 | indefinite | image loads |
| Source code | GitHub | git | GitHub + local clones | full history | every clone |
| Secrets | operator | manual | operator secret store | operator-managed | §4 completeness |

**Gap:** the "Database (external)" row is empty. Closing it — a `pg_dump` → R2
job with daily/weekly/monthly retention — is the single highest-value DR
investment and prerequisite #1 (§0).

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

---

## 5. Recovery scenarios

Each scenario: trigger, **honest current recoverability**, and procedure.

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
- **Recoverable today?** **No.** There is no database copy outside Render.
  This scenario is why prerequisite #1 (external backup) exists.
- **Procedure (once an external backup exists):** provision Postgres elsewhere
  → restore the latest R2 backup → stand up the server (DR-02) pointed at it →
  repoint DNS → §6 validation.

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
Date:            YYYY-MM-DD
Scenario:        DR-0X (e.g. full database restore)
Duration:        __ minutes
Result:          PASS / FAIL
Issues found:    …
Corrective action: …
```

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

## 9. Future structure

Kept as **one** document today (duplicate-first: split only when a section
grows unwieldy). If/when the procedures deepen, split into:

- `DISASTER_RECOVERY.md` — this overview + scenarios + acceptance (stays).
- `POSTGRES_RESTORE_RUNBOOK.md` — database-specific restore commands.
- `SERVER_REBUILD_RUNBOOK.md` — full Ubuntu/Render rebuild steps.

**Not yet decided (operator):** the RPO/RTO values (§1); whether building the
external `pg_dump` → R2 backup pipeline (prerequisite #1) proceeds as its own
Work Packet; and whether a passing DR drill becomes a *binding* release gate
(that would need a `DECISIONS.md` entry — it is descriptive here, not enforced).
