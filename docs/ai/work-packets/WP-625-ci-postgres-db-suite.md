# WP-625 — CI Postgres job: run the server DB-gated test suite automatically

**Status:** Ready (Pending execution)
**Primary Layer:** CI / Infra (`.github/workflows/ci.yml` + optional `apps/server` script)
**Dependencies:** none blocking — the server DB suite + `scripts/migrate.mjs` + `data/migrations/**` all exist on `main`. (WP-624 / #1684 are the motivating drift cases, both already landed.)
**User-Visible Surface:** none (a CI gate; no product change)

> Baseline: `origin/main` at commit `0dc641ba` (INFRA: repair shared competition test fixtures for live-DB run, #1684).

---

## Session Context

`apps/server`'s DB-gated test suites — every test that self-skips with `requires
test database` when `TEST_DATABASE_URL` is unset (competition, profile,
friendships, badges, replay/capture, seat-account, …) — **never run in CI**. The
`ci.yml` "Workspace Unit Tests" job runs `pnpm -r test` with no database and its
own comment states the design: *"DB-gated server tests self-skip when
`TEST_DATABASE_URL` is unset, so the default runner environment is sufficient."*
`apps/server` also has **no typecheck script** (tsx strips types; `pnpm -r build`
does not cover it).

The consequence is a whole class of drift that only a manual live-DB run catches:

- **WP-591 / D-24400** made `schemeTwistsPar` + `bystandersLostPar` required
  `ParBaseline` fields but did not update the shared `TEST_SCORING_CONFIG`
  fixture, so `computeParScore` went `NaN` and **reded the entire competition DB
  suite** against a live DB — invisible in CI, discovered only by hand and
  repaired in #1684.
- **WP-624** covered an *injected-seam* gap where a drift in `readSeatAccounts`'s
  shape or the caller's `.find()` would silently null `submitterSeatId` and stop
  the Vanguard badge firing — a failure only a DB-gated end-to-end run surfaces.

This packet closes the blind spot: a dedicated CI job provisions an **ephemeral**
Postgres, migrates it, and runs the `apps/server` suite with `TEST_DATABASE_URL`
set (serialized), so the DB-gated tests actually execute on every PR.

---

## Goal

Add a required CI job ("Server DB Tests") to `.github/workflows/ci.yml` that:
spins an ephemeral `postgres` service (Actions `services:`), builds the workspace,
runs `node scripts/migrate.mjs` against the service, then runs the `apps/server`
test suite **serialized** (`--test-concurrency=1`) with `TEST_DATABASE_URL`
pointed at the service — so a DB-only failure (a stale fixture, an unwired seam, a
missing migration column) turns into a fast, honest red X instead of merging
silently.

---

## User-Visible Impact

None. A CI gate only.

---

## Assumes

- `scripts/migrate.mjs` applies `data/migrations/*.sql` in order against
  `DATABASE_URL`, is idempotent, and exits non-zero on failure (it already runs in
  the Render buildCommand).
- The `apps/server` DB-gated tests self-skip on unset `TEST_DATABASE_URL` and run
  when it is set (the WP-104 `ownerProfile.logic.test.ts` skip pattern; the WP-053
  competition pattern).
- DB-suite files share one database and must run serialized (`--test-concurrency=1`)
  — the `project_db_backed_server_tests_local` operating note.
- The workspace must be built before the server suite (apps import built `dist`).

---

## Scope (In)

- `.github/workflows/ci.yml` — add one job: an ephemeral `postgres` service,
  `pnpm install` + `pnpm -r build`, a migrate step (`DATABASE_URL` = the service),
  and a serialized server-suite step (`TEST_DATABASE_URL` = the service). A
  `timeout-minutes` cap so a hang fails fast.
- **(Optional)** `apps/server/package.json` — a `test:db` script that single-sources
  the serialized invocation (`node --import tsx --test --test-concurrency=1
  "scripts/**/*.test.ts" "src/**/*.test.ts"`), so the workflow calls one script
  rather than restating the glob.
- **Green-baseline repair (in-scope, bounded):** whatever fixture/migration
  corrections the full server DB suite needs to go green beyond #1684. Any
  pre-existing DB-only failure that is *not* a quick fixture repair is quarantined
  with a documented `skip` + a follow-up WP note, so this packet is not an open-ended
  rot hunt.
- `docs/ai/DECISIONS.md` — land D-24435 at execution.

## Scope (Out)

- No product/runtime code change; no new migration (unless the baseline repair
  reveals a genuinely missing column, which would be its own decision).
- Not the nightly/heavier sweeps; this is the per-PR gate only.
- Not a general `apps/server` typecheck lane (a separate, larger concern — noted as
  a natural follow-up, not done here).

---

## Files Expected to Change

- `.github/workflows/ci.yml` — **modified** (new job)
- `apps/server/package.json` — **modified** (optional `test:db` script)
- `docs/ai/DECISIONS.md` — **modified** (D-24435, at execution)
- plus any **bounded** test-fixture repair the green baseline requires (enumerated
  in the EC allowlist once the executor runs the suite)

---

## Contract

The new required check **Server DB Tests** must pass for a PR to merge. The check
provisions its own ephemeral Postgres — it never touches the local dev DB or any
shared/production database.

---

## Acceptance Criteria

- [ ] A `Server DB Tests` job exists in `ci.yml` with a `services: postgres` block
      (health-checked), a workspace build, a `migrate` step, and a serialized
      server-suite step with `TEST_DATABASE_URL` set.
- [ ] On the job's own PR the DB-gated server tests **execute** (0 skipped for the
      DB lane) and the suite is **green** — proving the baseline is clean.
- [ ] A deliberately reintroduced DB-only failure (e.g. re-break the parBaseline
      fixture on a throwaway commit) makes the new job go **red** — evidence it
      actually gates. (Recorded in the execution notes, then reverted.)
- [ ] The job runs its own ephemeral service; no secret/real-DB connection string
      is used.
- [ ] `timeout-minutes` is set; CI-minute cost is noted in the execution summary.

---

## Verification Steps

1. Locally, establish the green baseline: `pnpm -r build`, then from `apps/server`
   with `TEST_DATABASE_URL` at a fresh local DB, run the suite serialized and
   confirm 0 fail / 0 unexpected skips in the DB lane.
2. Push the branch; confirm the new **Server DB Tests** check runs, executes the
   DB-gated tests, and is green.
3. Mutation evidence: on a throwaway commit, reintroduce a DB-only break; confirm
   the job reds; revert.

---

## Definition of Done

- [ ] The job is on `main`, green, and required.
- [ ] The DB-gated server tests run in CI (no longer self-skip on the green path).
- [ ] Mutation-checked that the job actually fails on a DB-only regression.
- [ ] D-24435 Active; WORK_INDEX WP-625 `[x]`; EC_INDEX EC-660 Done; mindmap
      `📝`→`✅` + `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Drafting-time pass; all 21 sections resolve. Highlights:

- **§ Scope** — PASS: one CI job + one optional script; the green-baseline repair is
  explicitly bounded (quarantine-with-follow-up for non-trivial rot).
- **§ Determinism / persistence / hash** — N/A: no runtime/engine change; the
  ephemeral DB is test infrastructure, never a persistence-boundary change.
- **§ Secrets** — PASS: the service uses in-workflow throwaway credentials; no real
  DB connection string, no secret required.
- **§ Layer boundary** — N/A: CI/infra is orthogonal to the Registry→Engine→Server
  chain.
- **§ API catalog (§21)** — N/A: no endpoint/library-surface change.

**Pre-flight (draft):** READY TO EXECUTE — no blocking dependency; scope is a single
additive CI job plus a bounded baseline repair; the forcing function (the job's own
PR must be green) makes the baseline requirement self-enforcing. **Copilot
self-review:** PASS — additive infra; the one real risk (a large pre-existing DB-rot
backlog making the baseline hard to green) is handled by the explicit
quarantine-with-follow-up clause, mirroring the engine `typecheck:tests` D-24372 §2
precedent (start bounded, don't block the world on a backlog).
