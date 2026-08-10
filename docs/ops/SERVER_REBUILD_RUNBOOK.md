# Server Rebuild & Full-Service Recovery Drill — Legendary Arena

> **Last updated:** 2026-08-09
>
> The **quarterly** full-service recovery drill: rebuild the entire service on a
> throwaway host from written steps alone, restore the database from an offsite
> backup, and prove **players can play** — login, match, leaderboard, friendships,
> images, email, and test-mode payments. This is the executable companion the ewiki
> [Ubuntu Lab Provisioning](../../wiki/ubuntu-lab-provisioning.md) page points at
> ("this lab is where the runbook is rehearsed").
>
> **Companion docs:** [`DISASTER_RECOVERY.md`](DISASTER_RECOVERY.md) owns recovery
> objectives (RPO/RTO), the DR-01…DR-05 scenarios, the asset/backup inventories,
> and the capability checklist this drill runs (§6 there). This file is the
> step-by-step for the **full-rebuild** exercise named in that doc's §7 cadence and
> §9 split. [`INCIDENT_RESPONSE.md`](INCIDENT_RESPONSE.md) covers in-match incidents,
> not infrastructure.

---

## 0. What this drill is (read first)

- **Goal:** prove the *whole procedure* — bare host → running service → validated
  gameplay — works from documentation alone, with **no memory and no undocumented
  step**. A backup is only proven once a full recovery has actually been
  demonstrated (`DISASTER_RECOVERY.md` §8).
- **Cadence:** **quarterly.** (The monthly drill is the DB-restore-only exercise;
  the semiannual one is full platform recovery. See `DISASTER_RECOVERY.md` §7.)
- **Where:** a **throwaway** host (the DigitalOcean Ubuntu lab), **never**
  production. Restore always runs against a **copy** of the data.
- **Pass/fail:** binary, by business capability — every box in §5 must pass. "Ubuntu
  boots" is not recovery; "players can play" is.
- **Time budget:** the target **RTO is 4 hours** (`DISASTER_RECOVERY.md` §1). Record
  the real number (§6); a drill that took 6 hours only "fails" against a stated RTO.

> **Safety guardrails (non-negotiable).**
> - Never point the lab at the production database. Render's DB allows
>   credential-gated public inbound (`ipAllowList: ['0.0.0.0/0']`) — that is a
>   footgun, not an invitation. Restore into a **fresh lab database** every time.
> - Never copy production secrets onto the lab. Use **test-mode / throwaway**
>   values for the `sync: false` set (Stripe **test** keys, a scratch JWT, a lab R2
>   bucket). A learning box is a soft target.
> - **Stripe stays in test mode** for the whole drill. No production charges.
> - Tear the host down afterward (§7) so a soft target does not linger.

---

## 1. Prerequisites

Before the clock starts, confirm you have — *without* logging into the running
service:

- [ ] **A target host** you can provision from scratch (DigitalOcean account + SSH
  key; region `sfo3`, nearest to the Render Oregon DB).
- [ ] **The operator secret store** (password manager / vault) holding the
  `sync: false` set — **for reference only**; the drill uses test-mode values, but
  §4 completeness is itself a checked recovery asset.
- [ ] **Backup access** to pull a dump: either the R2 backup token
  (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ACCOUNT_ID` /
  `R2_BACKUP_BUCKET`) **or** the pCloud token — restoring from *both* across drills
  proves the 3-2-1 copies (`DISASTER_RECOVERY.md` §3). `rclone` reads these.
- [ ] The GitHub repo URL and the ability to `git clone`.
- [ ] A throwaway lab hostname (e.g. `lab.<your-domain>`) to point at the droplet.

**Start a stopwatch now** and log each phase's elapsed time into the §6 table.

---

## 2. Provision & harden the host

Follow the ewiki [Ubuntu Lab Provisioning](../../wiki/ubuntu-lab-provisioning.md)
§1 for the full detail; the essentials:

- Ubuntu **24.04 LTS**, `sfo3`, 2 vCPU / 4 GB / 80 GB (the migration target is 4
  vCPU / 8 GB — either works for the drill). SSH-key auth only.
- Create a non-root `operator` user; disable root login and password auth; enable
  UFW (`OpenSSH` + `Nginx Full`), Fail2Ban, and unattended-upgrades.

---

## 3. Base application stack

Match the repo pins exactly — a drill on a different Node or `boardgame.io` is
testing a different system than production.

```bash
# Node MUST be 24.18.0 (.node-version, D-24205); corepack provides pnpm.
curl -fsSL https://fnm.vercel.app/install | bash && source ~/.bashrc
fnm install 24.18.0 && fnm use 24.18.0 && fnm default 24.18.0
node -v                                     # confirm v24.18.0
corepack enable

# OS-level pieces (app deps come from pnpm, not apt):
sudo apt update && sudo apt install -y git nginx postgresql certbot python3-certbot-nginx
sudo npm install -g pm2

# PostgreSQL client must be >= 18 to restore an -Fc dump from prod PG 18:
sudo apt install -y postgresql-client-18 || true   # pgdg repo if the distro lags
pg_dump --version                                   # confirm >= 18
```

---

## 4. Restore the database from an offsite backup (into a COPY)

Create a **fresh** lab database and restore the latest backup object into it. This
is the DR-05 recovery path — the offsite dump is the only copy that survives losing
the primary provider.

```bash
# One-time: a lab role + EMPTY target database (never the production DB).
sudo -u postgres createuser -P la_lab               # prompts for a lab password
sudo -u postgres createdb -O la_lab la_restore
export DATABASE_URL="postgres://la_lab:<password>@localhost:5432/la_restore"

# --- pull the newest dump from an offsite copy (pick R2 or pCloud) ---
# rclone remote config via env vars — no rclone.conf needed on the lab.
# R2:
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  RCLONE_CONFIG_R2_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID> \
  RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY> \
  RCLONE_CONFIG_R2_ENDPOINT="https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com" \
  RCLONE_CONFIG_R2_REGION=auto
latest="$(rclone lsf r2:<R2_BACKUP_BUCKET>/db-backups/ --recursive --files-only | sort | tail -1)"
rclone copyto "r2:<R2_BACKUP_BUCKET>/db-backups/${latest}" /tmp/la.dump
# (pCloud alternative: configure an rclone `pcloud` remote and
#  rclone copyto "pcloud:db-backups/${latest}" /tmp/la.dump)

# --- integrity gate + restore (DISASTER_RECOVERY.md §3 gates) ---
pg_restore --list /tmp/la.dump >/dev/null          # archive TOC readable — not corrupt
pg_restore --no-owner --no-privileges -d "$DATABASE_URL" /tmp/la.dump
# role/ownership warnings are expected on a fresh cluster; the restore still succeeds.

# --- verify data landed (compare against the backup source, not live prod) ---
for t in legendary.players legendary.player_profiles legendary.friendships \
         legendary.competitive_scores bgio.matches; do
  echo "$t = $(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM $t")"
done
rm -f /tmp/la.dump                                 # the dump holds real user PII
```

> The dump carries real user data. Keep it only on the lab, delete it after restore,
> and never commit it.

---

## 5. Deploy the server & bring the service up

```bash
git clone <repo-url> legendary-arena && cd legendary-arena
pnpm install && pnpm -r build                       # same as render.yaml buildCommand

# Secrets: supply TEST-MODE / throwaway values for the sync:false set (JWT, Hanko x3,
# Stripe TEST x3, analytics salt, four submit tokens, R2 x4 → a scratch bucket,
# Brevo x2). DATABASE_URL points at the la_restore copy from §4. Never prod secrets.
export PORT=3000                                    # pin it: the app defaults to 8000
                                                    # (process.env.PORT ?? '8000') — set
                                                    # PORT so it matches the Nginx proxy below
node scripts/migrate.mjs                             # apply migrations to the restored copy
pm2 start "node --import ./apps/server/node_modules/tsx/dist/loader.mjs \
  apps/server/src/index.mjs" --name la-server
pm2 save && pm2 startup
```

Nginx as a TLS-terminating reverse proxy for `lab.<your-domain>` → `127.0.0.1:3000`
(the `$PORT` above). Use the WebSocket-forwarding server block from
[Ubuntu Lab Provisioning](../../wiki/ubuntu-lab-provisioning.md) §2 (Socket.IO needs
the `Upgrade`/`Connection` headers or live match traffic silently fails), then
`sudo certbot --nginx -d lab.<your-domain>` for TLS.

---

## 6. Capability validation (binary — every box must pass)

Run against the **lab** host (`https://lab.<your-domain>`), not production. This is
`DISASTER_RECOVERY.md` §6 executed on the rebuilt service.

**Phase 1 — Infrastructure**
- [ ] `pm2` shows `la-server` online; Nginx healthy; TLS valid
- [ ] `curl https://lab.<your-domain>/health` → HTTP 200

**Phase 2 — Database & data integrity**
- [ ] App connects; migrations current; no startup errors in `pm2 logs la-server`
- [ ] Row counts ≈ backup source for `legendary.players`, `player_profiles`,
  `friendships`, `competitive_scores`, `bgio.matches` (matches §4)

**Phase 3 — Authentication**
- [ ] A known test account logs in; session created; profile loads

**Phase 4 — Core gameplay**
- [ ] Create match → appears in lobby
- [ ] Second account joins
- [ ] Turn submits; state updates; match completes
- [ ] Completed match persists across a `pm2 restart la-server` (`bgio.matches`)

**Phase 5 — Multiplayer (Socket.IO)**
- [ ] WebSocket connects; two clients see real-time state; reconnect succeeds

**Phase 6 — Rankings**
- [ ] Match score recorded to `legendary.competitive_scores`; leaderboard shows it

**Phase 7 — Friendships**
- [ ] Friend list loads; request → accept → friendship visible

**Phase 8 — Storage (R2)**
- [ ] Representative card images render from `images.legendary-arena.com`

**Phase 9 — Payments (Stripe, TEST MODE ONLY)**
- [ ] Stripe **test** checkout completes. **No production charges.**

**Phase 10 — Marketing (Brevo)**
- [ ] Brevo API auth succeeds; test email received

Recovery is complete **only** when every box above passes.

---

## 7. Record the drill, then tear down

Copy this block into `DISASTER_RECOVERY.md` §7 "Drill history" (the record is the
asset — a drill with no record is treated as not performed):

```
Date:                YYYY-MM-DD
Scenario:            DR-02 full server rebuild + §6 capability validation
Backup object key:   db-backups/YYYY/MM/DD/legendary-arena-<stamp>.dump  (from R2 or pCloud)
Commit SHA restored: <git rev-parse HEAD of the clone>
Observed RPO:        __ (age of the backup used)
Observed RTO:        __ (= total recovery time below)
Result:              PASS / FAIL
Issues found:        …
Corrective action:   …  (fix the runbook if any step was undocumented)
```

| Metric | Result |
|---|---|
| Time to provision host | |
| Time to restore database | |
| Time to deploy app | |
| Time to restore secrets | |
| Time to first successful login | |
| Time to first successful match | |
| **Total recovery time (RTO)** | |

**Teardown:** destroy the droplet, drop the lab database, and revoke any throwaway
credentials minted for the drill. Leaving a soft target with a data copy on it is
its own risk.

> **The point of the drill is the runbook, not the host.** If any step here was
> wrong, missing, or done from memory, fix *this file* in the same session — that
> correction is the real output. Next quarter someone follows it cold.

---

## 8. Cross-references

- [`DISASTER_RECOVERY.md`](DISASTER_RECOVERY.md) — recovery objectives, DR-01…DR-05
  scenarios, asset/backup inventories, §6 capability checklist, §7 drill history.
- [Ubuntu Lab Provisioning](../../wiki/ubuntu-lab-provisioning.md) — full host
  provisioning/hardening detail and the migration context (Render → DigitalOcean;
  PM2 → systemd is the migration target, PM2 is the current rehearsal path).
- [`render.yaml`](../../render.yaml) — the blueprint whose build/start commands and
  `sync: false` secret set this runbook mirrors.
- [Operational Health Checks](../../wiki/operational-health-checks.md) — `pnpm check`
  validates toolchain + external-service connectivity the same way in the lab.
