# EC-660 — CI Postgres DB-suite job (Execution Checklist)

**Source:** docs/ai/work-packets/WP-625-ci-postgres-db-suite.md
**Layer:** CI / Infra (`.github/workflows/ci.yml` + optional `apps/server` script)

## Before Starting
- [ ] Baseline `origin/main` `0dc641ba` (post #1684 fixture repair); worktree clean; capture the SHA.
- [ ] Read `ci.yml` `unit-tests` job (the DB-less server run this complements) + the
      auto-memory `project_db_backed_server_tests_local` (serialize, migrate-first, `.env` two-URL trap).
- [ ] Confirm `scripts/migrate.mjs` reads `DATABASE_URL`, is idempotent, exits 1 on failure.
- [ ] **Green-baseline gate:** with `TEST_DATABASE_URL` at a fresh local DB, `pnpm -r build`
      then run the full `apps/server` suite serialized — record the tally. Any DB-only
      failure is either fixed here (bounded fixture repair) or quarantined with a
      documented `skip` + follow-up note. Do NOT wire the job until the baseline is green.

## Locked Values (do not re-derive)
- Service: `postgres` (pin a major, e.g. `postgres:16`) with `POSTGRES_USER` /
  `POSTGRES_PASSWORD` / `POSTGRES_DB` env and a `pg_isready` health check
  (`--health-cmd`, `--health-interval/-timeout/-retries`).
- Migrate BEFORE tests: `node scripts/migrate.mjs` with `DATABASE_URL` = the service URL.
- Run serialized: `--test-concurrency=1` (files share one DB — non-negotiable).
- `TEST_DATABASE_URL` = the same ephemeral service URL (host `localhost` /
  `127.0.0.1`, the mapped port). NEVER a secret / real / shared DB connection string.
- `timeout-minutes` set (a hang → fast red, mirroring the `unit-tests` 20-min cap).
- Job display name self-describing: **Server DB Tests** (the repo's named-gate norm).

## Guardrails
- **Ephemeral only** — the service is created and torn down per run; the job must not
  reference the local dev DB, `secrets.*DATABASE_URL`, or any persistent DB.
- **Build before test** — `pnpm -r build` first; the server suite imports built dist
  (registry / game-engine / lagn). A stale/missing dist reds at import, not logic.
- **Migrate before test** — a schema-less DB fails every test; run the migrator and
  fail the job if it exits non-zero.
- **Serialized** — omit `--test-concurrency=1` and DB files race → flaky cross-file
  failures that look like real regressions.
- **Baseline discipline** — the job's own PR cannot merge unless the suite is green,
  so the green baseline is enforced by construction; do not `continue-on-error` it
  to sneak a red suite onto `main`.
- **Bounded repair** — fixture corrections only; a genuine missing-migration finding
  is escalated (its own decision), not silently patched.
- **`// (YAML) why:`** comments on the service block, the migrate-before-test order,
  and the serialization flag.

## Files to Produce
- `.github/workflows/ci.yml` — **modified** — the new `Server DB Tests` job.
- `apps/server/package.json` — **modified (optional)** — a `test:db` serialized script.
- `docs/ai/DECISIONS.md` — **modified** — D-24435 Active.
- **(bounded)** any test-fixture file the green baseline requires — enumerate the exact
  paths here once the baseline run reveals them; anything larger → quarantine + follow-up.

## After Completing
- [ ] The new check runs on the PR, the DB-gated tests execute (DB lane 0-skipped), suite green.
- [ ] Mutation evidence recorded: a throwaway DB-only break reds the job; reverted.
- [ ] CI-minute cost noted (build + migrate + serialized server suite).
- [ ] STATUS.md updated; WORK_INDEX WP-625 `[x]`; EC_INDEX EC-660 Done; D-24435 Active;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- Every DB test still shows `requires test database` → `TEST_DATABASE_URL` not exported
  into the test step's env (service up but URL unset).
- `relation "legendary.players" does not exist` → migrate step missing or ran after tests.
- Flaky cross-file failures that pass alone → missing `--test-concurrency=1`.
- Job green but DB tests all skipped → the URL points nowhere / the self-skip still fires;
  assert a non-zero DB-lane test count, not just exit 0.
- The suite reds on a fixture unrelated to this WP → pre-existing rot; fix if trivial,
  else quarantine with a follow-up (do not expand scope open-endedly).
