# EC-339 — Durable boardgame.io Match Storage (Execution Checklist)

**Source:** docs/ai/work-packets/WP-309-durable-bgio-match-storage.md
**Layer:** Server

## Before Starting
- [ ] On `main`, clean, synced to `origin/main`; baseline `git rev-parse origin/main` recorded.
- [ ] WP-115 pool present: `server.mjs` builds a single `pg.Pool` via `createPool()` and
      `startServer()` returns it; `index.mjs` closes it on SIGTERM.
- [ ] `Server({...})` at `apps/server/src/server.mjs` currently has NO `db:` option.
- [ ] Operator approved the architecture reconciliation + Option A (WP-309 §Architecture
      Reconciliation, §Adapter Approach) — else STOP.
- [ ] `pnpm --filter @legendary-arena/server build` exits 0.
- [ ] Target file set = the six `## Files to Produce` below. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Schema: `bgio` (dedicated). NEVER `legendary.*`.
- Table: `bgio.matches`, PK `match_id text`.
- Adapter contract: boardgame.io ^0.50 `StorageAPI.Async` — method set/signatures read from the
  installed `boardgame.io/server` types, not invented.
- Adapter reuses the injected WP-115 `pg.Pool` — no `new Pool` / `createPool` inside the adapter.

## Guardrails
- The adapter STORES ONLY; it never reads/interprets/branches on the match blob's game state.
- No engine/move/zone-op/snapshot file is modified; `G` is not read by app code from the store.
- Adapter imports NO `@legendary-arena/game-engine` (or any engine path).
- Exactly one `pg.Pool` in `server.mjs` after the change (reorder ahead of `Server({...})` if
  needed, with a `// why:`); the close-on-SIGTERM ordering in `index.mjs` is preserved.
- Migration is idempotent (`create schema/table if not exists`) and contains no `legendary.`
  qualifier.
- Startup logs which store is active (`Postgres` vs `InMemory` fallback).
- Adapter async methods throw full-sentence errors naming the operation + `match_id`; no bare catch.

## Required `// why:` Comments
- Adapter module header + method: the schema-boundary choice (`bgio`, never `legendary.*`) and the
  "adapter never interprets the blob" invariant (cite WP-309 reconciliation + the DECISIONS entry).
- `server.mjs`: the pool reorder and the `db:` wiring (cite WP-309 + DECISIONS entry).
- Migration SQL comment: the `bgio` schema is bgio's operational store, deliberately outside
  `legendary.*` per the WP-309 reconciliation.

## Files to Produce
- `apps/server/src/db/bgioPgStore.js` — **new** — pg `StorageAPI.Async` adapter over WP-115 pool.
- `apps/server/src/db/bgioPgStore.test.ts` — **new** — DB-gated round-trip / restart-survival tests.
- `apps/server/migrations/<NNN>-bgio-match-store.sql` — **new** — `bgio` schema + `matches` table.
- `apps/server/src/server.mjs` — **modified** — pool reorder + `db:` wiring + startup log.
- `docs/ai/ARCHITECTURE.md` + `.claude/rules/architecture.md` — **modified** — reconciliation
  wording (identical); `docs/ai/DECISIONS.md` — **modified** — reconciliation + Option-A D-entry.
- Governance ledgers: `STATUS.md`, `WORK_INDEX.md`, `docs/05-ROADMAP.md` (Future-WP-I flip).

## After Completing
- [ ] `pnpm --filter @legendary-arena/server build` exits 0.
- [ ] `pnpm --filter @legendary-arena/server test` passes; DB suite run at least once with
      `TEST_DATABASE_URL` set (round-trip / restart-survival not skipped).
- [ ] `Select-String bgioPgStore.js "new Pool|createPool"` → no output; `"game-engine"` → no output.
- [ ] `Select-String migrations\*-bgio-match-store.sql "legendary\."` → no output.
- [ ] Live-on-surface (D-24026): restart the deployed server mid-match; the same client submits a
      move and it applies (no freeze). Evidence + deploy-confirmed SHA captured.
- [ ] `docs/ai/STATUS.md` updated — in-progress matches survive deploy/restart.
- [ ] `docs/ai/DECISIONS.md` updated — reconciliation + adapter-choice (Option A; Option B rejected).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-309 checked off with date; ROADMAP Future-WP-I flipped.

## Common Failure Smells
- A `Select-String "db:"` on `server.mjs` returning zero → the adapter was written but never wired.
- Round-trip test "skipped" in output → `TEST_DATABASE_URL` unset; the restart-survival proof did
  not actually run (green-but-vacuous).
- Any diff under `packages/game-engine/**` → boundary breach; the adapter is pulling engine code.
