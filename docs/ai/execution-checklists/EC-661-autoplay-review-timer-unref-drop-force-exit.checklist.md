# EC-661 — Unref autoplay review-window timers; drop `--test-force-exit` (Execution Checklist)

**Source:** docs/ai/work-packets/WP-626-autoplay-review-timer-unref-drop-force-exit.md
**Layer:** Server (`apps/server/src/autoplay/autoplay.mjs`) + CI config (`apps/server/package.json`)

## Before Starting
- [ ] Baseline `origin/main` `a0dd333c` (post WP-625 / #1687); worktree clean; capture the SHA.
- [ ] Read `withRegisteredController` in `apps/server/src/autoplay/autoplay.mjs`
      (the two `setTimeout(... REVIEW_WINDOW_MS)` calls) + `playbackController.test.ts`
      (the D-24037 / D-16308 deferred-cleanup test that drives it).
- [ ] Read the auto-memory `project_db_backed_server_tests_local` (serialize +
      migrate-first + the `.env` two-URL trap) for the local run.
- [ ] **Confirm the misdiagnosis, don't assume it:** bisect proves
      `playbackController.test.ts` hangs ALONE without `--test-force-exit`; 0 DB
      connections during the hang → not a `pg` pool. Do NOT go hunting for a
      missing `pool.end()`.

## Locked Values (do not re-derive)
- `REVIEW_WINDOW_MS = 5 * 60 * 1000` — unchanged; the fix is `.unref()`, NOT a
  shorter window and NOT removing the deferred cleanup (D-24037 / D-16308 require
  the controller to linger for the review window).
- Two `setTimeout`s to `.unref()`: the normal-exit path AND the catch path in
  `withRegisteredController`. Both, or the catch path still leaks on an aborted run.
- `--test-concurrency=1` STAYS in `test:db` — only `--test-force-exit` is removed.
- The fix is `.unref()` (process-lifecycle), not `pool.end()` (the WP-625 pg-pool
  assumption was wrong).

## Guardrails
- **Unref both timers** — `.unref()` the returned handle on each `setTimeout`. A
  bare `setTimeout(...)` return without `.unref()` on either path re-leaks.
- **`// why:` on each unref** — the reasoning is non-obvious (live server stays up
  on its socket so the timer still fires; a short-lived process must not block on
  a pending 5-minute timer). Required by code-style rules.
- **Behavior-preserving on the live server** — do NOT change `REVIEW_WINDOW_MS`,
  do NOT drop the `autoplayControllers.delete(matchId)` cleanup, do NOT move the
  timer out of `withRegisteredController`. `.unref()` is the whole change.
- **Single-sourced flag** — remove `--test-force-exit` only in the
  `apps/server` `test:db` script; `ci.yml` calls that script (no second copy).
  Keep the non-DB `test` script untouched.
- **No engine/hash/persistence/migration change** — this is Server-layer only.
- **Prove the whole suite, not just one file** — after the fix, run the FULL
  server DB suite via the `test:db` script (flag removed) end-to-end and confirm
  it completes (no hang), so no OTHER file leaks a handle once force-exit is gone.

## Files to Produce
- `apps/server/src/autoplay/autoplay.mjs` — **modified** — `.unref()` both
  review-window cleanup `setTimeout`s (+ `// why:` each).
- `apps/server/package.json` — **modified** — drop `--test-force-exit` from `test:db`.
- `docs/ai/DECISIONS.md` — **modified** — D-24436 Active.

## Local run (ephemeral DB — never the dev DB)
- [ ] Create `legendary_arena_test` (DROP + CREATE); apply `data/migrations/*.sql`
      via `psql -f` in order with `PGCLIENTENCODING=UTF8` (migration 002 `\i` seed
      is WIN1252-on-CRLF locally; `node scripts/migrate.mjs` is the CI/Linux path).
- [ ] `pnpm -r build`, then from repo root
      `TEST_DATABASE_URL=<test-url> pnpm --filter @legendary-arena/server test:db`.
- [ ] `DROP DATABASE IF EXISTS legendary_arena_test;` when done — leave no artifact
      in the dev DB.

## After Completing
- [ ] `playbackController.test.ts` alone exits `0` without `--test-force-exit`.
- [ ] Full `test:db` run: **no hang**, **1414 tests / 1414 pass / 0 skipped**, exit `0`.
      (WP-625's 1415/1-fail baseline dropped the matchGate Windows phantom-fail.)
- [ ] CI `Server DB Tests` job green on Linux with the flag removed.
- [ ] STATUS.md updated; WORK_INDEX WP-626 `[x]`; EC_INDEX EC-661 Done;
      D-24436 Active; mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- Suite still hangs after the fix → the catch-path timer was missed (only the
  normal path unref'd), or a DIFFERENT file leaks a handle — bisect the new hang.
- `playbackController.test.ts` still hangs alone → the `.unref()` landed on the
  wrong `setTimeout` (e.g. the `delay()` helper at the bottom of the file), not
  the review-window ones.
- Windows `win/async.c` assertion still fires → `--test-force-exit` not actually
  removed from the script the runner invokes (check `ci.yml` calls `test:db`).
