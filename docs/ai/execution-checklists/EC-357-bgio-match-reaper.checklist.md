# EC-357 — Server-Side Reaper for Stale bgio Matches (Execution Checklist)

**Source:** docs/ai/work-packets/WP-327-bgio-match-reaper.md
**Layer:** server only (new `db/matchReaper.js` + tests + `index.mjs` wiring; `bgioPgStore.js` NOT edited)
**Lane:** Standard — co-released with WP-326 (client filter); this half removes the dead rows at the source.

## Before Starting
- [ ] On the branch, clean, synced; baseline `origin/main` @ `ce022043` recorded.
- [ ] Confirm `bgio.matches` columns (`match_id`, `state`, `initial_state`, `metadata`, `log`, `updated_at`) and that every write sets `updated_at = now()` (`db/bgioPgStore.js`).
- [ ] Confirm boardgame.io metadata carries `gameover` on game end (store `listMatches` reads `metadata.gameover !== undefined`, `bgioPgStore.js:296`).
- [ ] Re-read `legends/legends.scheduler.js` + `index.mjs` SIGTERM handler (the `.stop()`-handle scheduler + lifecycle to mirror) and `bgioPgStore.test.ts` (recording/failing stub-pool pattern).
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL. Do NOT edit `bgioPgStore.js`.

## Locked Values (do not re-derive)
- `MATCH_REAPER_INTERVAL_MS = 900_000` (15 min) · `GAMEOVER_GRACE_MS = 3_600_000` (1 h) · `ABANDONED_TTL_MS = 86_400_000` (24 h).
- DELETE (one atomic query, params `$1 = gameoverGraceMs/1000`, `$2 = abandonedTtlMs/1000`, i.e. seconds):
  `DELETE FROM bgio.matches WHERE (metadata IS NOT NULL AND jsonb_exists(metadata,'gameover') AND updated_at < now() - make_interval(secs => $1)) OR ((metadata IS NULL OR NOT jsonb_exists(metadata,'gameover')) AND updated_at < now() - make_interval(secs => $2))`.
- `reapStaleMatches` returns `result.rowCount ?? 0`.
- Reserved decision: **D-24113**.

## Guardrails
- Persistence Boundary (D-24095): delete ONLY from `bgio.matches`. No `legendary.*` read/write, no blob interpretation, no engine/registry/preplan/boardgame.io import.
- Age decision is server-side (`updated_at < now() - make_interval(...)`) — the JS side passes only the two TTL magnitudes; no application wall-clock read (`Date.now()`/`new Date()`).
- A failed reap run is **logged and swallowed** — never crash the process, never leave an unhandled rejection; the next interval retries.
- `unref()` the interval timer (guard `typeof timer.unref === 'function'`) so it never holds the process open; SIGTERM still calls `stop()` explicitly.
- `index.mjs` wiring only: start after `startServer()` when `pool !== undefined`; `stop()` in the SIGTERM handler beside `legendsPublisherHandle.stop()`, before `closePool`.
- No new npm dependency; no HTTP endpoint; do NOT edit `bgioPgStore.js`.

## Required `// why:` Comments
- Each of the three constants (why: reap cadence / gameover grace / abandoned TTL — and why these magnitudes).
- The SQL age decision (why: `now() - make_interval` keeps the wall-clock server-side; the two classes — gameover-grace vs abandoned-TTL — in one atomic DELETE).
- `jsonb_exists(metadata,'gameover')` over `?`/`->>'gameover'` (why: precise key-existence matching the store's `metadata.gameover !== undefined`; function form avoids any `?`-placeholder ambiguity in node-pg).
- The swallowed-and-logged failed run (why: a transient DB error must not crash the process; next interval retries).
- The `unref()` (why: the reaper timer must never keep the process alive at shutdown; SIGTERM still stops it).

## Files to Produce
- `db/matchReaper.js` [`reapStaleMatches` + `startMatchReaper` + the 3 locked constants].
- `db/matchReaper.test.ts` [recording stub pool → asserts one DELETE on `bgio.matches` with `jsonb_exists(metadata` + `make_interval(secs =>`, params `[3600, 86400]`, returns `rowCount`; failing stub pool → wrapped full-sentence error; `node:test` mock timers → reap fires after `intervalMs`, `stop()` halts further runs; recorded query text references no `legendary.` table].
- `index.mjs` [modify: start reaper after `startServer()` when `pool !== undefined`; `stop()` in SIGTERM handler].
- Governance: `docs/ai/DECISIONS.md` (D-24113), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/server test` — pure reaper tests pass; DB-backed suites skip non-silently without `TEST_DATABASE_URL`.
- [ ] `pnpm -r build` succeeds (server has no tsconfig; build covers the typed packages).
- [ ] `git diff --name-only` = the allowlist (3 server + 4 governance); `bgioPgStore.js` absent.
- [ ] STATUS / DECISIONS (D-24113 Active) / WORK_INDEX (WP-327 `[x]`) / EC_INDEX (EC-357 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com + server logs` → D-24026 operator-pending (reaper start line in logs; abandoned/finished matches drop out of `bgio.matches` and the lobby within the cadence).

## Common Failure Smells
- Editing `bgioPgStore.js` (a WP-309 contract module) → out of scope; the reaper is a new sibling module.
- A per-id `wipe` loop or `listMatches`-then-delete → the reaper is ONE atomic batch DELETE.
- Reading `Date.now()` / `new Date()` for the cutoff → keep the age decision in SQL `now() - make_interval`.
- Letting a failed reap reject unhandled or crash the process → must be logged and swallowed.
- Deleting from (or even referencing) a `legendary.*` table → hard persistence-boundary violation (D-24095).
- Forgetting to `stop()` on SIGTERM, or not `unref()`ing the timer → the interval holds the process open at shutdown.
