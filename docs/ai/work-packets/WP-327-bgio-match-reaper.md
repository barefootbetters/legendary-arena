# WP-327 — Server-Side Reaper for Stale bgio Matches

**User-Visible Surface:** play.legendary-arena.com (indirectly — the lobby). No new
endpoint and no client change; the operator-visible effect is that abandoned and
finished matches stop accumulating in `bgio.matches`, so the lobby list (already
filtered client-side by WP-326) also shrinks at the source and the durable match
store does not grow without bound.

## Goal

Add an in-process **match reaper** that periodically deletes stale rows from
`bgio.matches`: a **finished** match (metadata carries `gameover`) is wiped after a
short grace, and an **abandoned** match (no `gameover`) is wiped after a longer TTL
of no updates. The reaper runs on a `setInterval` timer started once at process
startup (when the pg pool is available) and stopped on SIGTERM — mirroring the
existing legends-publisher scheduler. Deletion uses the row's server-side
`updated_at` column and `now()` so no application wall-clock read enters the
decision.

## Assumes

- WP-309 / D-24095 shipped the `bgio` schema and the `createBgioPgStore(pool)`
  adapter. `bgio.matches` has columns `match_id text pk`, `state jsonb`,
  `initial_state jsonb`, `metadata jsonb`, `log jsonb`, `updated_at timestamptz`;
  every `createMatch` / `setState` / `setMetadata` write sets `updated_at = now()`
  (`apps/server/src/db/bgioPgStore.js`). Locked baseline: `origin/main` @
  `ce022043`.
- boardgame.io match **metadata** carries a `gameover` key once a game ends — the
  WP-309 store's own `listMatches` gameover predicate reads `metadata.gameover !==
  undefined` (`bgioPgStore.js:296`), mirroring boardgame.io's InMemory store.
- The single long-lived `pg.Pool` (WP-115) is constructed in `startServer()` and
  returned to `index.mjs`, which owns close-on-SIGTERM. The legends publisher
  (`legends.scheduler.js` + its `index.mjs` wiring) is the precedent: a `.stop()`-
  handle scheduler started after `startServer()` when `pool !== undefined` and
  stopped inside the SIGTERM handler before `closePool`.
- `apps/server` DB-backed test suites use `node:test`'s non-silent
  `{ skip: 'requires test database' }` when `TEST_DATABASE_URL` is unset, and pure
  tests exercise the module against a recording/failing stub pool
  (`bgioPgStore.test.ts` pattern). `apps/server` has no tsconfig (not typechecked by
  `pnpm -r build`); `node:test` mock timers are available for interval testing.

## Context (Read First)

- `apps/server/src/db/bgioPgStore.js` — the store this reaper cleans up behind;
  `wipe(matchID)` (single-row DELETE) and `listMatches(opts)` (honors
  `where.isGameover` / `updatedBefore` / `updatedAfter`) already exist. The reaper
  is a **batch** DELETE, not a per-id `wipe` loop, to keep it one atomic query.
- `apps/server/src/legends/legends.scheduler.js` + `apps/server/src/index.mjs`
  (SIGTERM handler, `legendsPublisherHandle.stop()`) — the exact scheduler +
  lifecycle pattern to mirror.
- `apps/server/src/db/bgioPgStore.test.ts` — the recording/failing stub-pool test
  pattern to mirror for the reaper's pure tests.
- `docs/ai/DECISIONS.md` — scan D-24095 (framework-store exemption + `bgio` schema
  boundary — the reaper stays inside that boundary), D-14202 (legends publisher
  kill-switch/interval env posture).
- `.claude/rules/architecture.md` + `.claude/skills/legendary-persistence` —
  Persistence Boundary: only the server layer persists; the reaper deletes
  framework operational state in the `bgio` schema and never touches `legendary.*`.
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code rules.

**Why now:** the co-release partner of **WP-326**. WP-309 made the match store
durable (fixing the deploy-freeze) but nothing removes matches, so `bgio.matches`
grows forever with abandoned and finished games (observed on
play.legendary-arena.com, 2026-07-07). WP-326 hides the dead rows client-side; this
WP removes them at the source so the store stays bounded and the client filter has
less to hide over time. Split by layer (arena-client vs server) per the Layer
Boundary; shared `## Assumes` on WP-309.

## Scope (In)

- **`matchReaper.js`** (new, `apps/server/src/db/`) — two exports plus the locked
  interval/TTL constants:
  - `reapStaleMatches(database, { gameoverGraceMs, abandonedTtlMs })` — one atomic
    `DELETE FROM bgio.matches` whose WHERE keeps a row only when it is old enough
    for its class: a `gameover`-bearing row past `gameoverGraceMs`, or a
    non-`gameover` row past `abandonedTtlMs`, both measured against `updated_at`
    versus `now()` server-side. Returns the deleted row count. Wraps any DB error
    in a full-sentence, operation-named message (the `bgioPgStore` idiom).
  - `startMatchReaper({ database, intervalMs, gameoverGraceMs, abandonedTtlMs })` —
    starts a `setInterval` that runs `reapStaleMatches` and logs a full-sentence
    line when it deletes > 0; a failed run logs and is swallowed (never crashes the
    process). `unref()`s the timer so it never holds the process open at shutdown.
    Returns `{ stop() }` (clears the interval).
  - Locked constants: `MATCH_REAPER_INTERVAL_MS`, `GAMEOVER_GRACE_MS`,
    `ABANDONED_TTL_MS` (values in §Locked contract values), each with a `// why:`.
- **`matchReaper.test.ts`** (new, `apps/server/src/db/`) — pure tests (no DB): a
  recording stub pool asserts `reapStaleMatches` issues one DELETE against
  `bgio.matches` carrying the two interval params and returns the stub `rowCount`; a
  failing stub pool asserts the wrapped full-sentence error; `node:test` mock timers
  assert `startMatchReaper` runs a reap after `intervalMs` and that `stop()` halts
  further runs.
- **`index.mjs`** (modified) — after `startServer()`, when `pool !== undefined`,
  `startMatchReaper({ database: pool, ... })` and hold the handle; inside the SIGTERM
  handler call `matchReaperHandle.stop()` alongside the existing
  `legendsPublisherHandle.stop()`, before `closePool`. Runtime-wiring only, in the
  process-lifecycle owner (01.5), mirroring the legends publisher verbatim.

## Out of Scope

- **Any engine / `G` / `ctx` / gameplay change** — the reaper stores nothing and
  decides no gameplay; it deletes framework operational rows only.
- **Any `legendary.*` domain-schema write** — deletion is confined to the `bgio`
  schema (D-24095 boundary). No snapshot, leaderboard, or domain table is touched.
- **A one-time backfill delete of the rows already in `bgio.matches`** — the reaper
  clears them on its first post-deploy runs; a manual `DELETE` for immediate cleanup
  is an operator action, not part of this WP.
- **An HTTP health/trigger endpoint for the reaper** (`/health/match-reaper` or a
  manual `POST`) — observability is via the log line; a health route is a future
  hardening WP (the legends publisher's `/health/legends-publisher` precedent).
- **A per-match `wipe` loop or `listMatches`-then-delete** — the reaper is one
  atomic batch DELETE; it does not reuse the per-id store methods.
- **New npm dependencies** — none; `pg` + `setInterval` are already present.

## Files Expected to Change

| File | Action |
|------|--------|
| `apps/server/src/db/matchReaper.js` | **New** — `reapStaleMatches` + `startMatchReaper` + locked constants |
| `apps/server/src/db/matchReaper.test.ts` | **New** — recording/failing stub-pool + mock-timer tests |
| `apps/server/src/index.mjs` | **Modified** — start the reaper after `startServer()`; stop it in the SIGTERM handler (01.5 runtime-wiring) |
| `docs/ai/DECISIONS.md` | **Modified** — D-24113 (Active on execution) |
| `docs/ai/STATUS.md` | **Modified** — record the change (execution) |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-327 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-357 row |

No other files may be modified. `bgioPgStore.js` is a WP-309 contract module and is
**not** edited here.

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Deliver **full file contents** for every new or modified file — no diffs.
- ESM only (`.js` in the `"type": "module"` server package); Node v22+.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (explicit control flow,
  descriptive names, JSDoc on every function, `// why:` on non-obvious code).

**Packet-specific:**
- **Persistence Boundary.** The reaper deletes only from `bgio.matches` (the D-24095
  framework store). It never reads or writes `legendary.*`, never interprets the
  match blob, and never imports engine / registry / preplan / boardgame.io code.
- **No application wall-clock in the decision.** Row age is computed server-side as
  `updated_at < now() - interval`; the JS side passes only the two TTL magnitudes.
  (`setInterval` for scheduling is server-layer wiring, allowed — the legends
  publisher precedent; determinism rules govern the engine, not server ops.)
- A failed reap run is **logged and swallowed** — it must never crash the process or
  reject an unhandled promise; the next interval retries.
- The interval timer is `unref()`'d so it never keeps the process alive during
  shutdown; SIGTERM still calls `stop()` explicitly.
- Do NOT edit `bgioPgStore.js` (WP-309 contract module) or add an HTTP endpoint.
- No new npm dependencies.

**Session protocol:** if any scope or contract question is ambiguous, STOP and ask —
do not guess or widen scope.

**Locked contract values:**
- `MATCH_REAPER_INTERVAL_MS = 900_000` (15 minutes) — reap cadence.
- `GAMEOVER_GRACE_MS = 3_600_000` (1 hour) — finished matches wiped after this.
- `ABANDONED_TTL_MS = 86_400_000` (24 hours) — non-gameover matches wiped after
  this much no-update time.
- DELETE keeps a row for deletion when:
  `(metadata IS NOT NULL AND jsonb_exists(metadata,'gameover') AND updated_at <
  now() - make_interval(secs => $1))` **OR** `((metadata IS NULL OR NOT
  jsonb_exists(metadata,'gameover')) AND updated_at < now() - make_interval(secs =>
  $2))`, with `$1 = gameoverGraceMs/1000`, `$2 = abandonedTtlMs/1000`.
- Reserved decision: **D-24113**.

## Vision Alignment

- **Vision clauses touched:** §14 (operability — bounded, self-maintaining match
  store), §22 (financial sustainability — unbounded storage growth is a cost). §11
  (engine owns truth) is untouched: the reaper deletes framework operational rows,
  not authoritative game state. **Conflict assertion:** `No conflict.`
  **Non-Goal proximity:** none of NG-1..7 crossed. **Determinism:** N/A — the reaper
  is server-side operational maintenance; it touches no engine / RNG / replay / hash
  surface, and the age decision runs in SQL `now()`, never an engine clock.

## Acceptance Criteria

1. `reapStaleMatches(recordingPool, { gameoverGraceMs: 3_600_000, abandonedTtlMs:
   86_400_000 })` issues exactly one query, a `DELETE FROM bgio.matches` whose text
   contains `jsonb_exists(metadata` and `make_interval(secs =>`, with params
   `[3600, 86400]`, and returns the pool's reported `rowCount` (asserted).
2. On a stub pool whose `query` rejects, `reapStaleMatches` rejects with a
   full-sentence message naming `bgio.matches` and the reap operation (asserted).
3. With `node:test` mock timers, `startMatchReaper({ database, intervalMs })` runs a
   reap after `intervalMs` elapses, and after `stop()` no further reap runs on the
   next interval (asserted).
4. The reaper deletes **only** from `bgio.matches` — no query text references a
   `legendary.` table (asserted by scanning the recorded query text).
5. `index.mjs` starts the reaper after `startServer()` only when `pool !==
   undefined`, and the SIGTERM handler calls its `stop()` (verified by inspection +
   D-24026 live log evidence; wiring is not unit-mounted).
6. `apps/server` `test` passes (pure reaper tests run without a database; DB-backed
   suites remain skipped when `TEST_DATABASE_URL` is unset); `pnpm -r build` green.
7. No files outside `## Files Expected to Change` are modified; `bgioPgStore.js`
   unchanged.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/server test        # pure reaper tests pass; DB suites skip w/o TEST_DATABASE_URL
pnpm -r build                                      # succeeds (server has no tsconfig; build covers the typed packages)
git diff --name-only                               # only ## Files Expected to Change; bgioPgStore.js absent
```

Optional DB-backed proof (operator, local pg): with `TEST_DATABASE_URL` set to a db
that has migration `023_create_bgio_match_store.sql` applied, seed rows with old
`updated_at` (one with `metadata->>'gameover'` set, one without), run
`reapStaleMatches`, and assert only the past-TTL rows are deleted.

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `apps/server` `test` green (pure); `pnpm -r build` green
- [ ] **User-visible / operator verification (D-24026, surface =
      play.legendary-arena.com + server logs):** after merge + deploy, the server log
      shows the reaper start line, and within the reap cadence the abandoned /
      finished matches disappear from `bgio.matches` (and thus the lobby list). Until
      then STATUS.md records the test evidence + the deferred live observation.
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24113 Active; `WORK_INDEX.md`
      WP-327 `[x]`; `EC_INDEX.md` EC-357 Done
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | All required sections present; Out of Scope lists ≥2 exclusions; single layer (server) |
| 2 | ✅ PASS | Engine-wide (full files, ESM/Node22, 00.6) + packet-specific + session protocol + locked values present |
| 3 | ✅ PASS | §Assumes lists the WP-309 store/columns, the metadata.gameover contract, the pool/scheduler lifecycle, the test harness, green baseline @ ce022043 |
| 4 | ✅ PASS | §Context cites the store, the legends scheduler + index.mjs wiring, the stub-pool test, the persistence rule, D-entries |
| 5 | ✅ PASS | §Files lists 3 code/test + 4 governance files, each with an action; `bgioPgStore.js` explicitly excluded |
| 6 | ✅ PASS | Names match: `bgio.matches`, `updated_at`, `metadata.gameover`, `reapStaleMatches`, `startMatchReaper`; no 00.2 field surface touched |
| 7 | ✅ PASS | No new npm dependency — `pg` + `setInterval` already present; excluded in §Out of Scope |
| 8 | ✅ PASS | Layer Boundary respected — server-only; no engine/registry/preplan/boardgame.io import; deletes only `bgio` schema (D-24095) |
| 9 | ✅ PASS | SQL is a parameterized query (no shell); Verification uses pnpm on Windows pwsh |
| 10 | ✅ N/A | No new environment variables (constants are locked in-module; matches the legends-scheduler default-interval posture without adding a knob) |
| 11 | ✅ N/A | No authentication surface — no endpoint; internal scheduler only |
| 12 | ✅ PASS | Tests use `node:test` + recording/failing stub pool + mock timers; no boardgame.io import; DB-backed suites skip non-silently without `TEST_DATABASE_URL` |
| 13 | ✅ PASS | Verification uses `pnpm --filter … test` + `pnpm -r build` + `git diff --name-only`; expected outcomes stated |
| 14 | ✅ PASS | 7 binary, observable, function/query-specific acceptance criteria |
| 15 | ✅ PASS | DoD includes STATUS / DECISIONS / WORK_INDEX + scope-boundary check; User-Visible Surface declared + live D-24026 item |
| 16 | ✅ PASS | Explicit control flow; descriptive names; JSDoc + `// why:` on constants, the SQL age-decision, the swallowed-failure, and the `unref()` |
| 17 | ✅ PASS | `## Vision Alignment` present — §14/§22; no conflict; no NG crossed; determinism N/A (SQL `now()`, not an engine clock) |
| 18 | ✅ N/A | No literal-string-scoped forbidden-token grep in Verification Steps |
| 19 | ✅ N/A | No repo-state-summarizing artifact |
| 20 | ✅ N/A | No funding surface |
| 21 | ✅ N/A | No HTTP endpoint added, and no **catalogued** `Library-only` function changed — the reaper is a new internal scheduler with no HTTP route (api-endpoints.md catalogs routes; D-11804 not triggered) |

**Verdict: 21/21 resolved (16 PASS, 5 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Single layer (server), additive new module + one
process-lifecycle wiring edit (01.5, in `index.mjs`, the lifecycle owner). The
reaper mirrors the legends-publisher scheduler verbatim for start/stop, and the
`bgioPgStore` recording/failing stub-pool pattern for pure tests, so both the
lifecycle and the DB-error surface are proven precedents. The delete is one atomic
parameterized query confined to the `bgio` schema (D-24095), with the age decision
in SQL `now()` — no application wall-clock, no engine coupling. DB-backed behavior is
deferred to the optional operator proof + D-24026 live evidence, consistent with the
`apps/server` DB-suite skip convention.

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing (server-only; no engine/registry/preplan/boardgame.io
import), no monetization / identity / RNG / multiplayer-sync, no new contract file,
no hash impact, no `legendary.*` write. The persistence boundary is respected — the
reaper deletes framework operational rows in the dedicated `bgio` schema per D-24095
and never interprets the blob. Failure is swallowed-and-logged so a transient DB
error cannot crash the process. The only cross-cutting concern (a background timer)
reuses the proven legends-publisher lifecycle. No BLOCK modes.
