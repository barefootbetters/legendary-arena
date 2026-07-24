# WP-416 — Provider-Independent PostgreSQL Backup Pipeline (pg_dump → R2)

**Status:** Drafted (not yet executed)
**Layer:** Server / Ops (CI-driven; orthogonal to the Registry → Engine → Server runtime chain)
**User-Visible Surface:** none — infrastructure
**Baseline:** drafted off `origin/main` @ `79c11ea5` (2026-07-23)

## Goal

Establish an automated, provider-independent backup of the production
PostgreSQL database. A scheduled GitHub Actions workflow runs `pg_dump`
against the Render-managed database daily and uploads the compressed dump to
Cloudflare R2 under a dated key, with age-based retention pruning. This closes
the gap named as **prerequisite #1** in
[`docs/ops/DISASTER_RECOVERY.md`](../../ops/DISASTER_RECOVERY.md) §0: today the
only database backups are Render's internal ones, so a loss of the Render
account or region (scenario DR-05) is unrecoverable. After this WP, a copy of
the database lives in R2 (Cloudflare), independent of Render.

## Assumes

- [`docs/ops/DISASTER_RECOVERY.md`](../../ops/DISASTER_RECOVERY.md) exists on
  `main` (landed via PR #967) and names the external-backup gap this WP fills.
- The Render-managed PostgreSQL (`legendary-arena-db`) is reachable over its
  **External Database URL** — `render.yaml` `databases:` sets
  `ipAllowList: ['0.0.0.0/0']` (credential-gated public inbound), so a CI runner
  can connect with the DB password. If this is later narrowed to internal-only,
  this WP's connection method must be revisited (noted in Out of Scope).
- A Cloudflare R2 bucket and S3-API credentials exist. `render.yaml` already
  provisions `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ACCOUNT_ID` as
  server secrets for the avatar + legends pipelines; the same credential shape
  (a token scoped to write the backup bucket) is used here as GitHub Actions
  secrets.
- Local dev runs PostgreSQL 18.3 (`docs/04-DEVELOPMENT-SETUP.md`); `render.yaml`
  does not pin the prod server version — **confirm it in the Render dashboard**
  before first use. The `pg_dump` client floor is **≥ 18** regardless: a client
  newer-or-equal to the server always dumps successfully; only an older client
  errors. So a v18 client is safe whatever the prod minor is.
- GitHub Actions is the project's CI host; the existing **`schedule:`-triggered**
  sweep workflows (`sweep-nightly.yml`, `sweep-weekly.yml`) establish the cron +
  `workflow_dispatch` + `${{ secrets.* }}` pattern to mirror. (Note
  `inspection-nightly.yml` is `workflow_run:`-chained, not `schedule:` — not the
  precedent here.)

## Context (Read First)

- [`docs/ops/DISASTER_RECOVERY.md`](../../ops/DISASTER_RECOVERY.md) — §0 (the
  backup gap), §3 (backup inventory row this WP fills), §5 DR-05.
- [`docs/ai/ARCHITECTURE.md`](../../ARCHITECTURE.md) §Layer Boundary and the
  §Persistence Boundary (Cross-Layer) note — this WP performs a **read-only**
  `pg_dump` of the whole database (both the `legendary.*` domain schema and the
  `bgio` framework-store schema). The D-24095 exemption and its carve-outs
  govern *application reads* of the `bgio` blob; a full-database `pg_dump` for
  disaster recovery is an **operational backup**, not an application read of blob
  contents, and interprets nothing — confirm this framing holds (Vision Alignment).
- [`.claude/rules/architecture.md`](../../../.claude/rules/architecture.md) —
  Persistence Boundary; the backup is a derived operational copy, never read
  back into gameplay state.
- [`render.yaml`](../../../render.yaml) — the `databases:` block (ipAllowList,
  plan) and the `R2_*` secret shape this WP mirrors as GitHub secrets.
- [`docs/ai/REFERENCE/00.6-code-style.md`](../REFERENCE/00.6-code-style.md) —
  human-style code for the retention script.

## Scope (In)

- A new scheduled GitHub Actions workflow that, once per day (and on manual
  dispatch): installs a PostgreSQL 18 client, runs `pg_dump` in custom
  compressed format (`-Fc`) against the external `DATABASE_URL`, and uploads the
  dump to R2 under a dated key.
- A dated, sortable R2 key layout under a fixed prefix so backups are
  enumerable and prunable.
- Age-based retention pruning: after each successful upload, delete backups
  older than the retention window, driven by a **pure, unit-tested selection
  function** (given the list of existing dated keys and a reference date, return
  the keys to delete).
- Filling the empty "Database (external)" row in
  `docs/ops/DISASTER_RECOVERY.md` §3 and updating the §0 gap statement to
  reflect that the pipeline now exists.

## Out of Scope

- **Automated restore / restore-verification.** This WP produces backups; the
  restore procedure is already documented in `DISASTER_RECOVERY.md` §5 and is
  drilled manually per §7. Automating a restore-and-validate drill is a separate
  future WP.
- **Grandfather-father-son (GFS) long-term retention** (weekly/monthly tiers).
  v1 retention is a single age-based daily window (locked value below); the
  weekly/monthly tiers named in the DR doc are a deferred enhancement.
- **Any change to the app server** (`apps/server/**`), the game engine, or the
  database schema. No new HTTP endpoint, no server cron loop — the backup runs
  in CI, independent of the running server (the DR-independence rationale).
- **Narrowing the DB `ipAllowList`.** This WP depends on the external URL being
  reachable; changing the inbound posture is a separate operational decision.
- **Bounding dump size/time.** The dump grows with the never-pruned `bgio`
  match/replay blobs, so daily `pg_dump` runtime, runner wall-clock, and Render
  egress creep upward. GitHub's 360-min job timeout gives ample near-term
  headroom, so v1 ships without a ceiling — but a dump-size/duration alert (or the
  standing `bgio` retention job the inventory already flags) is the named
  follow-up that bounds it. No code for it in this WP.

## Files Expected to Change

**Deliverables:**

- `.github/workflows/db-backup.yml` — **new** — daily `schedule:` +
  `workflow_dispatch` workflow. A first **guard step** maps
  `${{ secrets.BACKUP_DATABASE_URL != '' }}` to an output; all later steps run
  only `if:` that output is `'true'`, so an unconfigured repo concludes **green**
  without running (GitHub Actions forbids the `secrets` context in a job-level
  `if:`, so the guard-step-output pattern is mandatory — there is no
  secret-presence skip precedent in the repo to copy). When enabled: install a
  PostgreSQL 18 client → `pg_dump -Fc` → upload to R2 via `aws s3` (S3-compatible,
  with the R2 env mapping in Locked Values) → prune via the retention script.
- `scripts/db-backup-retention.mjs` — **new** — pure retention-selection
  function `selectBackupsToPrune(objectKeys, referenceDate)` returning the keys
  outside the retention window, plus a thin CLI that reads keys from stdin and
  prints keys-to-delete (one per line) for the workflow to pipe into `aws s3 rm`.
- `scripts/db-backup-retention.test.ts` — **new** — `node:test` coverage of the
  selection function: keeps in-window, deletes out-of-window, boundary date,
  empty input, malformed key ignored.
- `docs/ops/DISASTER_RECOVERY.md` — **modified** — fill the §3 "Database
  (external)" backup-inventory row (method / storage / retention / verification)
  and update the §0 current-state gap statement now that the pipeline exists.

**Governance ledgers (edited at govern-close, per the Definition of Done):**

- `docs/ai/STATUS.md` — **modified** — "No user-observable change —
  infrastructure only" entry.
- `docs/ai/DECISIONS.md` — **modified** — land D-24236.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off the WP-416 row.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — flip EC-451
  `Pending → Done`.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — glyph `📝 → ✅`, then regenerate
  the count table.

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**

- Output the **full contents** of every new or modified file. Diffs, snippets,
  or "show only the changed section" are forbidden.
- ESM only; Node v22+ built-ins (the retention script uses no npm dependencies).
- Human-style code per
  [`docs/ai/REFERENCE/00.6-code-style.md`](../REFERENCE/00.6-code-style.md):
  full words, `is/has/can` booleans, JSDoc on every function, functions ≤ 30
  lines, `// why:` on non-obvious decisions, full-sentence error messages.

**Packet-specific:**

- The `pg_dump` is **read-only**. The workflow must never run a write, migration,
  or `DELETE` against the production database; the DB credentials used must be
  usable for a dump (a read-capable role is sufficient).
- **No new npm dependency.** R2 I/O uses the `aws` CLI (S3-compatible, against
  the R2 endpoint) available on the runner; the retention script uses only Node
  built-ins. Do not add `@aws-sdk/*` to a root script or a new package.
- The retention **selection** logic is a pure function with no I/O — it takes a
  key list + reference date and returns keys to delete. All R2 listing/deletion
  is done by the workflow via the CLI, never inside the pure function (keeps it
  unit-testable without network/credentials).
- **No real secret value** appears in any file. Secrets are referenced only as
  `${{ secrets.NAME }}` in the workflow.
- The R2 backup bucket (`R2_BACKUP_BUCKET`) MUST be a **private** bucket,
  distinct from the public `legendary-images` bucket — a database dump must never
  be publicly readable. (`// why:` the dump contains accounts and all domain data.)
- Retention deletion runs **only after** a verified-successful upload in the
  same run; a failed dump or upload must not trigger pruning. The prune/dump/upload
  steps gate on `if: steps.<guard>.outputs.has_secrets == 'true'` **only** — never
  `always()` / `!cancelled()`, which would run prune after a failed upload and
  defeat this constraint (the bare step `if:` keeps the implicit `success()`).
- **Secret-in-logs hygiene:** the dump step must NOT enable `set -x` and must NOT
  echo or transform `BACKUP_DATABASE_URL`; pass the connection via environment
  (not as an argv the runner process list would expose), relying on Actions
  secret masking. (`// why:` the URL carries the DB password; masking is defeated
  by `set -x` / echo / argv exposure.)

**Session protocol:**

- If any scope item is ambiguous, STOP and ask — do not improvise a restore
  path, a schema change, or a server-side backup loop.

**Locked contract values (do not re-derive):**

- Schedule: daily, `cron: '17 9 * * *'` (09:17 UTC — off the top of the hour to
  avoid runner contention; `// why:` required).
- R2 object key prefix: `db-backups/`
- R2 object key format: `db-backups/<YYYY>/<MM>/<DD>/legendary-arena-<YYYYMMDDTHHMMSSZ>.dump`
- `pg_dump` format flag: `-Fc` (custom, compressed).
- Minimum `pg_dump` client major version: **18**.
- v1 retention window: **keep 35 days**; delete any backup whose age exceeds 35
  days before the reference date. GFS tiers are Out of Scope.
- Retention age source: `selectBackupsToPrune` parses the **filename timestamp**
  (`legendary-arena-<YYYYMMDDTHHMMSSZ>.dump`), not the path segments — one
  authoritative date per key so the boundary and malformed-key tests are
  deterministic. A key whose filename does not match the timestamp shape is
  **ignored** (kept, not deleted, and not thrown on).
- Retention function name: `selectBackupsToPrune`.
- GitHub Actions secrets consumed: `BACKUP_DATABASE_URL` (external DB
  connection string), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET`.
- **Secret-absence guard (skip-green):** a first step sets an output, e.g.
  `has_secrets=${{ secrets.BACKUP_DATABASE_URL != '' }}`; every subsequent step
  carries `if: steps.<guard>.outputs.has_secrets == 'true'`. An unconfigured repo
  concludes success without dumping. (`secrets` is not usable in a job-level
  `if:`, so the guard-step output is the mechanism.)
- **R2 ↔ aws-CLI mapping (the S3-compatible upload/prune surface):** the `aws`
  CLI reads `AWS_*`, not `R2_*`, so map in the step env —
  `AWS_ACCESS_KEY_ID=${{ secrets.R2_ACCESS_KEY_ID }}`,
  `AWS_SECRET_ACCESS_KEY=${{ secrets.R2_SECRET_ACCESS_KEY }}`,
  `AWS_DEFAULT_REGION=auto` — and pass
  `--endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` on every
  `aws s3` call. Also set `AWS_REQUEST_CHECKSUM_CALCULATION=when_required` and
  `AWS_RESPONSE_CHECKSUM_VALIDATION=when_required` — aws-cli v2's default
  integrity checksums break R2 `PutObject` without them.
- **Dump-integrity contract (what "successful upload" means):** `pg_dump` writes
  to a **file** (not a bare pipe), under `set -euo pipefail`, with an explicit
  non-zero-exit check; the dump file must then be **non-empty** (size greater than
  a locked floor of **1024 bytes** — a real `-Fc` dump of a seeded DB far exceeds
  this; a 0-byte or tiny file signals a wrong/empty `BACKUP_DATABASE_URL`). Upload
  is counted successful only when the dump exited 0 AND the size check passed; the
  prune step is gated on that success (see the `if:` guardrail below).
- **Timestamp parsing (correctness trap):** the filename stamp
  `YYYYMMDDTHHMMSSZ` is the compact/basic ISO form and is **NOT** parseable by
  `new Date(string)` in V8 (it returns `Invalid Date`). `selectBackupsToPrune`
  MUST parse by **decomposing the components into `Date.UTC(year, month-1, day,
  hour, minute, second)`** — never `new Date(theString)`. Reject an out-of-range
  component set (e.g. month `13`) as malformed (ignored) rather than letting
  `Date.UTC` month-rollover accept it. Boundary is **strictly greater**:
  `referenceEpoch - parsedEpoch > 35*24*60*60*1000` → delete; exactly 35 days →
  keep.
- **Bucket-collision guard:** the workflow asserts
  `R2_BACKUP_BUCKET != 'legendary-images'` before upload (a name-collision guard
  so a misconfiguration never writes a DB dump into the public images bucket). The
  private-ness of the bucket itself is operator-attested (not CI-checkable).

## Vision Alignment

- **Vision clauses touched:** §18 (replays / replay storage — the dump includes
  `bgio.replay_artifacts` and `legendary.replay_blobs`), §5/§13/§14 (live ops /
  operational resilience), §3/§11 (accounts/identity — the dump includes account
  tables).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
  The backup is a read-only, out-of-band copy of existing data; it changes no
  game semantics, no scoring, no replay behavior, and no persisted schema.
- **Non-Goal proximity check:** none of NG-1..7 are crossed — no monetization,
  persuasion, pay-to-win, or competitive surface is touched.
- **Determinism preservation:** N/A to gameplay — the WP touches no engine RNG,
  scoring, or replay-execution path. `pg_dump` is a byte-copy of stored data and
  does not re-execute or re-derive anything; `finalStateHash` and all
  sentinel/hash surfaces are unchanged.

## User-Visible Impact

`none — infrastructure`. No player-observable change on any surface. The payoff
is operational: a provider-independent database backup exists in R2, so the
DR-05 (Render/account loss) scenario becomes recoverable and the
`DISASTER_RECOVERY.md` §0 gap closes. STATUS.md must state "No user-observable
change — infrastructure only."

## Acceptance Criteria

1. `.github/workflows/db-backup.yml` exists with a daily `schedule:` cron
   `'17 9 * * *'` and a `workflow_dispatch` trigger.
2. The workflow installs a PostgreSQL client of major version ≥ 18 before
   running `pg_dump`.
3. The workflow runs `pg_dump -Fc` against `${{ secrets.BACKUP_DATABASE_URL }}`
   and uploads the result to R2 at a key matching
   `db-backups/<YYYY>/<MM>/<DD>/legendary-arena-<timestamp>.dump`.
4. The workflow's first step sets a `has_secrets` output from
   `${{ secrets.BACKUP_DATABASE_URL != '' }}`; the dump/upload/prune steps carry
   `if: ...has_secrets == 'true'`, so an unconfigured repo concludes green, and
   pruning runs only after a successful upload step.
5. `scripts/db-backup-retention.mjs` exports `selectBackupsToPrune(objectKeys,
   referenceDate)` — a pure function returning keys strictly older than 35 days.
6. `scripts/db-backup-retention.test.ts` covers, **non-vacuously**: (i) a known
   timestamp string maps to a known UTC epoch; (ii) 35-days-minus-1-second → KEPT
   and 35-days-plus-1-second → DELETED (proves the strict-greater boundary); (iii)
   a right-prefix key with a non-timestamp tail is ignored (kept, not thrown);
   (iv) an out-of-range date (e.g. `…20261301T…`, month 13) is ignored, **not**
   `Date.UTC`-rolled-over into a valid date; (v) empty input → empty output.
   `node --import tsx --test scripts/db-backup-retention.test.ts` runs it green
   (the `.test.ts` + `tsx`-loader convention, mirroring `roadmap:counts:test`).
7. No new npm dependency is added (no `@aws-sdk/*`, no `axios`); the retention
   script imports only `node:` built-ins.
8. `docs/ops/DISASTER_RECOVERY.md` §3 "Database (external)" row is filled and §0
   no longer states the external-backup gap as open.
9. No file under `apps/server/**`, `packages/**`, or `data/migrations/**` is
   modified.

## Verification Steps

(PowerShell 7+ — the project's primary shell.)

- `node --import tsx --test scripts/db-backup-retention.test.ts` — the retention
  suite passes (all cases green; `tsx` loader because the test is `.test.ts`).
- `node -e "import('./scripts/db-backup-retention.mjs').then(m => console.log(typeof m.selectBackupsToPrune))"`
  — prints `function`.
- `Select-String -Path scripts/db-backup-retention.mjs -Pattern '@aws-sdk|axios|node-fetch'`
  — expected **no matches** (no forbidden/new dependency in the retention script).
- Manual (post-merge, operator): configure the five GitHub secrets (with a
  **private** `R2_BACKUP_BUCKET`), run the workflow via `workflow_dispatch`,
  confirm an object appears in R2 under `db-backups/…`, and confirm the run is
  green.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `node --import tsx --test scripts/db-backup-retention.test.ts` exits 0.
- [ ] No file outside `## Files Expected to Change` was modified
      (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated, stating "No user-observable change —
      infrastructure only".
- [ ] `docs/ai/DECISIONS.md` updated with **D-24236** (backup runs in CI
      independent of the app server; `pg_dump → R2`; key layout + 35-day
      retention; external-URL-as-CI-secret tradeoff accepted for backup
      independence + `pg_dump` availability). The entry states the persistence
      framing outright: a full-database `pg_dump` is an **out-of-band operational
      copy** — it interprets nothing, derives no feature, and is never read back
      into gameplay state — so it is not a D-24095 blob-read and needs no new
      persistence-boundary carve-out.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-451 flipped `Pending → Done`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph flipped `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Lint Gate Self-Review (00.3)

- **§1 Structure:** PASS — all ten required sections present; `## Out of Scope`
  lists four excluded items.
- **§2 Non-Negotiable Constraints:** PASS — Engine-wide (full-file output,
  diffs forbidden, ESM/Node v22+, cites 00.6) + Packet-specific + Session
  protocol + Locked values all present.
- **§3 Assumes:** PASS — DR doc dependency, external-URL reachability, R2 creds,
  PG18, CI host all listed; no silent-wrong-output path.
- **§4 Context:** PASS — specific docs/sections cited (DR doc, ARCHITECTURE
  persistence boundary, rules, render.yaml, 00.6).
- **§5 Files:** PASS — 4 deliverables + 5 governance ledgers, each listed
  new/modified with a description; the deliverable set is bounded and the WP and
  EC allowlists are identical (so the DoD "diff shows only allowlisted files"
  check is satisfiable).
- **§6 Naming:** PASS — no canonical-field-name surface; schema table names
  match migrations.
- **§7 Dependency discipline:** PASS — explicitly forbids new npm deps; uses
  built-in `node:` + the runner's `aws` CLI; no `axios`/`node-fetch`.
- **§8 Architectural boundaries:** PASS — read-only `pg_dump`; no move-function
  DB access; no server/engine change; the backup is a derived operational copy,
  never read back into gameplay (persistence boundary respected).
- **§9 Windows compatibility:** PASS with note — the workflow runs on
  `ubuntu-latest` **by design** (CI runner; `pg_dump` availability); this is not
  a local-dev-environment assumption. The retention script is pure Node
  (cross-platform).
- **§10 Env var hygiene:** PASS — the five GitHub Actions secrets are documented
  in Locked Values; no local `.env` var is introduced (so `.env.example` is
  unchanged); no real secret appears.
- **§11 Auth:** N/A — no authentication surface.
- **§12 Test quality:** PASS — `node:test`, no boardgame.io import, no
  network/DB access (the pure selection function is tested in isolation).
- **§13 Verification:** PASS — exact commands with expected output.
- **§14 Acceptance criteria:** PASS — 9 binary, observable, specific checks.
- **§15 Definition of Done:** PASS — STATUS/DECISIONS/WORK_INDEX + scope-boundary
  check + `none — infrastructure` STATUS wording present.
- **§16 Code style:** PASS — pure function, JSDoc, `// why:` on the cron time
  and 35-day window, full-sentence errors required by constraints.
- **§17 Vision Alignment:** PASS — section present; clauses cited; no conflict;
  determinism line present.
- **§18 Prose-vs-grep:** PASS — the only count-bounded grep (`grep -c`) targets
  dependency tokens the retention file must not contain; no adjacent prose in
  that file enumerates them.
- **§19 Bridge-vs-HEAD:** N/A — this WP is not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate:** N/A — this is an infrastructure backup WP; it
  touches no navigation, registry-viewer, profile, tournament, or user-visible
  funding copy surface.
- **§21 API Catalog:** N/A — no HTTP endpoint is added or modified and no
  `apps/server/src/**` library function changes; the pipeline runs entirely in
  CI, so `api-endpoints.md` is not touched.
