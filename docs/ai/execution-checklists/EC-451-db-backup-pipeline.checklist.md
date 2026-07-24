# EC-451 — PostgreSQL Backup Pipeline (Execution Checklist)

**Source:** docs/ai/work-packets/WP-416-db-backup-pipeline.md
**Layer:** Server / Ops (cross-cutting CI; orthogonal to the runtime chain)

## Before Starting
- [ ] `docs/ops/DISASTER_RECOVERY.md` exists on `main` (names the external-backup gap this WP fills)
- [ ] Enumerate the EXACT target file set (same as Files to Produce); any edit outside it is a FAIL
- [ ] Confirm **D-24236** is unclaimed across `main` AND open PR branches (renumber if taken)
- [ ] Confirm a `📝` WP-416 node already exists in `docs/05-ROADMAP-MINDMAP.md` (it was added at drafting); at close, FLIP `📝 → ✅` — do not re-add. If somehow absent, ADD it before flipping, else `roadmap:counts:check` stays red
- [ ] `pnpm -r build` exits 0 (baseline green)
- [ ] Confirm no `@aws-sdk/*` / `axios` / `node-fetch` will be added (grep the two new scripts after writing)

## Locked Values (do not re-derive)
- Schedule cron: `'17 9 * * *'` (daily, 09:17 UTC) + `workflow_dispatch`
- R2 key prefix: `db-backups/`
- R2 key format: `db-backups/<YYYY>/<MM>/<DD>/legendary-arena-<YYYYMMDDTHHMMSSZ>.dump`
- `pg_dump` format flag: `-Fc`; minimum `pg_dump` client major version: `18`
- v1 retention: keep 35 days; delete keys older than 35 days before the reference date
- Age source: parse the **filename** timestamp (`legendary-arena-<YYYYMMDDTHHMMSSZ>.dump`), NOT the path segments; a filename not matching the shape is IGNORED (kept, not thrown)
- Pure function name: `selectBackupsToPrune(objectKeys, referenceDate)`
- GitHub Actions secrets: `BACKUP_DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET`
- Skip-green guard: first step sets `has_secrets=${{ secrets.BACKUP_DATABASE_URL != '' }}`; later steps `if: steps.<guard>.outputs.has_secrets == 'true'` (`secrets` is not allowed in a job-level `if:`)
- R2 ↔ aws-CLI: map `AWS_ACCESS_KEY_ID`←`R2_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`←`R2_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION=auto`; pass `--endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`; set `AWS_REQUEST_CHECKSUM_CALCULATION=when_required` + `AWS_RESPONSE_CHECKSUM_VALIDATION=when_required` (aws-cli v2 checksums break R2 PutObject otherwise)

## Guardrails
- `pg_dump` is READ-ONLY — no write/migration/DELETE against the production DB
- No new npm dependency — R2 I/O via the runner's `aws` CLI; retention script uses only `node:` built-ins
- `selectBackupsToPrune` is pure — NO network, NO filesystem, NO credentials; it only maps keys+date → keys-to-delete
- Timestamp parse: decompose into `Date.UTC(y, m-1, d, H, M, S)` — NEVER `new Date(str)` (V8 can't parse the compact `YYYYMMDDTHHMMSSZ`); reject out-of-range components (month 13) as malformed, not `Date.UTC`-rolled-over; boundary strictly-greater (exactly 35d → KEEP)
- Dump integrity: `pg_dump` writes a FILE under `set -euo pipefail` with an exit-code check; the file must be non-empty (> 1024 bytes) before upload counts as success (guards a wrong/empty `BACKUP_DATABASE_URL`)
- Prune gate: dump/upload/prune steps use `if: steps.<guard>.outputs.has_secrets == 'true'` ONLY — never `always()`/`!cancelled()` (bare `if:` keeps implicit `success()`, so a failed upload skips prune)
- Secret-in-logs: NO `set -x`, NO echo/transform of `BACKUP_DATABASE_URL`; pass via env, not argv — rely on Actions masking
- No file under `apps/server/**`, `packages/**`, or `data/migrations/**` is touched
- No real secret value in any file — only `${{ secrets.NAME }}` references; assert `R2_BACKUP_BUCKET != 'legendary-images'` before upload
- Do NOT change the DB `ipAllowList`; the workflow depends on the external URL being reachable

## Required `// why:` Comments
- Cron time (`17 9`): why an off-the-hour minute (runner-contention avoidance)
- The 35-day constant: why this window, and that GFS tiers are deferred (Out of Scope)
- The secret-absent early exit in the workflow: why skip-green instead of fail

## Files to Produce
- `.github/workflows/db-backup.yml` — **new** — daily pg_dump → R2 upload → prune; secret-gated, skips green when secrets absent
- `scripts/db-backup-retention.mjs` — **new** — pure `selectBackupsToPrune` + thin stdin→stdout CLI
- `scripts/db-backup-retention.test.ts` — **new** — `node:test`, non-vacuous: (i) known stamp → known UTC epoch; (ii) 35d−1s KEPT vs 35d+1s DELETED; (iii) right-prefix non-timestamp tail ignored; (iv) out-of-range date (month 13) ignored not rolled over; (v) empty → empty
- `docs/ops/DISASTER_RECOVERY.md` — **modified** — fill §3 "Database (external)" row; update §0 gap statement
- Governance ledgers (edited at govern-close): `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — the WP + EC allowlists are identical, so the "diff shows only allowlisted files" close-out is satisfiable

## After Completing
- [ ] `node --import tsx --test scripts/db-backup-retention.test.ts` exits 0
- [ ] `grep -c "@aws-sdk\|axios\|node-fetch" scripts/db-backup-retention.mjs` → `0`
- [ ] `git diff --name-only` shows only the allowlisted files
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change — infrastructure only"
- [ ] `docs/ai/DECISIONS.md` — D-24236 landed (CI-independent `pg_dump → R2`; key layout + 35-day retention; external-URL-as-CI-secret tradeoff)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` glyph `📝` → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- Every retention key parses to `NaN`/kept → used `new Date('YYYYMMDDTHHMMSSZ')` (V8 returns Invalid Date); must decompose into `Date.UTC(...)`
- A tiny/0-byte dump uploaded as success → missing the non-empty size check; a wrong/empty `BACKUP_DATABASE_URL` dumps nothing but exits 0
- `pg_dump: server version mismatch` → the runner installed a client < 18; pin the PostgreSQL 18 apt repo
- Retention test needs network/creds to run → the selection function was written with I/O inside it (must be pure)
- CI red on a docs-only PR → mindmap node missing or count table stale (run `roadmap:counts:write`)
