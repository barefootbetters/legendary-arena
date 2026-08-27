# WP-626 — Unref the autoplay review-window cleanup timers; drop `--test-force-exit`

**Status:** Ready (Pending execution)
**Primary Layer:** Server (`apps/server/src/autoplay/autoplay.mjs`) + CI config (`apps/server/package.json` `test:db`)
**Dependencies:** WP-625 ✅ (added the `test:db` script + advisory `Server DB Tests` job whose `--test-force-exit` this removes)
**User-Visible Surface:** none (a process-lifecycle + CI-hygiene fix; no product change)

> Baseline: `origin/main` at commit `a0dd333c` (EC-660: CI Postgres job runs the server DB-gated test suite (WP-625), #1687).

---

## Session Context

WP-625 shipped the `apps/server` `test:db` script with `--test-force-exit`, and
its own WORK_INDEX / EC-660 rows recorded the reason as *"a DB file leaks a `pg`
pool handle (a separate test-hygiene follow-up)."* This packet is that follow-up
— **and it corrects the diagnosis.**

The leaker is **not** a `pg.Pool`. It is two review-window cleanup timers in
`withRegisteredController` (`apps/server/src/autoplay/autoplay.mjs`):

```js
const REVIEW_WINDOW_MS = 5 * 60 * 1000;
// … normal-exit path:
setTimeout(() => autoplayControllers.delete(matchId), REVIEW_WINDOW_MS);
// … catch path:
setTimeout(() => autoplayControllers.delete(matchId), REVIEW_WINDOW_MS);
```

Neither is `.unref()`'d. `playbackController.test.ts` calls
`withRegisteredController` (its D-24037 / D-16308 deferred-cleanup test), so when
that file's tests finish the process still holds two pending 5-minute timers and
**cannot exit for ~5 minutes**. Under the serialized runner
(`--test-concurrency=1`) the whole suite sits after that file and looks hung.
`--test-force-exit` masks it by killing the process the moment the tests report.

**Bisect (evidence the assumption was wrong):**
- Running the full suite without `--test-force-exit` freezes with the last output
  from `autoplay/playbackController.test.ts` — the WP-625 observation.
- Running `playbackController.test.ts` **alone** without `--test-force-exit` hangs
  (exit 124 on a 30s timeout); `rewindAudience.test.ts` and
  `accountLookup.logic.test.ts` (the files that follow it) each exit `0`.
- During the hang, `pg_stat_activity` shows **0 connections** to the test DB — a
  leaked pool would hold open connections. `playbackController.test.ts` opens no
  pool at all (no `new Pool`, no DB). The lingering handles are the two
  `setTimeout`s.

`--test-force-exit` has a second cost: on Windows it triggers a libuv
`win/async.c` assertion crash in `matchGate.routes.integration.test.ts` because
force-exit races that file's koa-server close. Removing the flag removes that too
(those 3 tests pass cleanly; the crash cannot occur on the Linux CI runner).

---

## Goal

`.unref()` both review-window cleanup timers in `withRegisteredController`, then
remove `--test-force-exit` from the `apps/server` `test:db` script — so the
serialized server DB suite exits cleanly on its own and the flag (and its
Windows crash) go away.

`.unref()` is behavior-preserving on a live server: the process stays alive on
its listening socket, so each timer still fires and removes the finished
controller after `REVIEW_WINDOW_MS`. `.unref()` only stops a *pending* timer from
being the **sole** reason a process stays alive — which is exactly the desired
behavior for a short-lived process (a test runner, a one-shot bot-match script).

---

## User-Visible Impact

None.

---

## Assumes

- `withRegisteredController` is the only place the review-window cleanup timers
  are created (grep confirms exactly two `setTimeout(... REVIEW_WINDOW_MS)`).
- The `apps/server` `test:db` script is the single source for the serialized
  invocation; `ci.yml`'s `Server DB Tests` job calls it via
  `pnpm --filter @legendary-arena/server test:db` (no second copy of the flag).
- `--test-concurrency=1` stays — the DB-gated files share one database and must
  run one-file-at-a-time (`project_db_backed_server_tests_local`).

---

## Scope (In)

- `apps/server/src/autoplay/autoplay.mjs` — `.unref()` both review-window
  cleanup `setTimeout`s in `withRegisteredController` (normal-exit + catch), each
  with a `// why:` on the unref.
- `apps/server/package.json` — remove `--test-force-exit` from the `test:db`
  script (keep `--test-concurrency=1`).
- `docs/ai/DECISIONS.md` — land D-24436 at execution.

## Scope (Out)

- No engine/determinism change, no hash surface, no `G` field, no persistence or
  migration change. `.unref()` is a server-layer process-lifecycle concern.
- **Not** a `pool.end()` fix — the pg-pool hypothesis was a misdiagnosis; every
  file that opens a pool already closes it on all paths (verified by inspection:
  each `new Pool` is paired with a conditional `after` that `await pool.end()`).
- Not `--test-concurrency` — serialization is unchanged and still required.
- Not the promotion of the `Server DB Tests` job to a required check (still WP-625's
  tracked follow-up).

---

## Files Expected to Change

- `apps/server/src/autoplay/autoplay.mjs` — **modified** (two `.unref()`s)
- `apps/server/package.json` — **modified** (drop `--test-force-exit`)
- `docs/ai/DECISIONS.md` — **modified** (D-24436, at execution)

---

## Contract

The serialized `apps/server` DB suite (`test:db`, and the CI `Server DB Tests`
job that runs it) completes on its own without `--test-force-exit`: no hang, no
Windows `win/async.c` crash, same green tally. The autoplay review-window
cleanup still fires on a live server (the `.unref()` changes nothing there).

---

## Acceptance Criteria

- [ ] Both review-window `setTimeout`s in `withRegisteredController` are
      `.unref()`'d, each with a `// why:` comment.
- [ ] `apps/server` `test:db` no longer contains `--test-force-exit` (keeps
      `--test-concurrency=1`).
- [ ] `playbackController.test.ts` alone exits `0` without `--test-force-exit`
      (no 5-minute hang).
- [ ] The full server DB suite via `pnpm --filter @legendary-arena/server test:db`
      completes with **no hang** and the WP-625 green tally
      (**1414 tests / 1414 pass / 0 skipped**, exit `0`) against an ephemeral
      test DB. (The WP-625 baseline counted 1415 with 1 fail — the matchGate
      Windows crash; with the flag gone that phantom fail is absent, so 1414/0.)
- [ ] The CI `Server DB Tests` job is green on Linux with the flag removed.

---

## Verification Steps

1. `.unref()` both timers; run `playbackController.test.ts` alone without
   `--test-force-exit` and confirm a clean `0` exit (was exit 124 / hang).
2. Run the full suite via the `test:db` script (flag removed) against an
   ephemeral `legendary_arena_test` DB; confirm no hang + 1414/1414/0.
3. Push; confirm the advisory `Server DB Tests` job runs green on Linux.

---

## Definition of Done

- [ ] Both timers `.unref()`'d; `--test-force-exit` removed from `test:db`.
- [ ] Full server DB suite completes without the flag (no hang; 1414/1414/0).
- [ ] CI `Server DB Tests` green on Linux with the flag removed.
- [ ] D-24436 Active; WORK_INDEX WP-626 `[x]`; EC_INDEX EC-661 Done; mindmap
      `📝`→`✅` + `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Drafting-time pass; all 21 sections resolve. Highlights:

- **§ Scope** — PASS: two `.unref()`s + one flag removal + the D-entry; the
  pg-pool hypothesis is explicitly ruled out with bisect evidence, so scope does
  not expand into an open-ended pool-teardown audit.
- **§ Determinism / persistence / hash** — N/A: `.unref()` is a process-lifecycle
  concern in the server layer; no engine state, no hash surface, no persistence.
- **§ Layer boundary** — PASS: the change lives in `apps/server` (Server layer);
  no cross-layer edge, no new import.
- **§ API catalog (§21)** — N/A: no endpoint / library-surface change.
- **§ Comments** — PASS: each `.unref()` carries a `// why:` (non-obvious lifecycle
  reasoning), per code-style rules.

**Pre-flight (draft):** READY TO EXECUTE — dependency WP-625 is landed; the fix is
a two-line lifecycle correction plus a single-sourced CI flag removal, both
verified locally (full suite 1414/1414/0, no hang, no Windows crash). The one risk
— that another file also leaks a handle and the suite hangs elsewhere once the
flag is gone — is retired by the full-suite run completing clean end-to-end.
**Copilot self-review:** PASS — minimal, behavior-preserving on the live server.
