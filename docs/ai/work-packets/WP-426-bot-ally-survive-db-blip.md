# WP-426 — Bot-Ally Driver Survives a Transient Postgres Blip (Server)

**Status:** Draft 2026-07-25 · **PROPOSED (WP-426; highest landed WP is 424)** · **Lightweight lane** (D-24028 — single file + tests, additive). Pairs with **EC-461** (authored). Reserves **D-24247** (lands at execution).
**Primary Layer:** Server (`apps/server/src/bot-ally/`)
**User-Visible Surface:** `play.legendary-arena.com` play surface — a bot-ally co-op match no longer freezes when Postgres briefly becomes unreachable (a Render DB restart / instability around a deploy). **D-24026 live-verify APPLIES** (a bot-ally match survives a DB blip and keeps playing).
**Dependencies:** WP-375 ✅ (the driver + poll loop), WP-414 ✅ (revival / side-table), WP-424 ✅ (the freeze arc this continues). No hard-dep WP in flight.
**Baseline:** `origin/main` @ `0e7694b4` (capture `git rev-parse origin/main` at execution).

---

## Goal

Fix **another silent bot-ally freeze**, on a build that already carries WP-424. Live diagnostic
(match `nZn_U4QO-hr`, 2026-07-25): the co-op board froze on the bot's turn while `bot-ally-status`
reported `{ driving:true, status:'active' }`. The server deploy log named the mechanism: Postgres
briefly went unreachable after a deploy —

```
[bgio-store] fetch for match "nZn_U4QO-hr" transient failure (attempt 1/4); retrying: connect ECONNREFUSED …:5432
… (attempts 2/4, 3/4, 4/4) …
[bgio-store] fetch for match "nZn_U4QO-hr" still failing after 4 transient retries; keeping the server up, returning empty
[bot-ally] match nZn_U4QO-hr failed to persist teardown status "completed": connect ECONNREFUSED …:5432
```

**Root cause.** The bgio store's `resilientFetch` **returns empty (not a throw)** when it exhausts
its retry budget against an unreachable Postgres — the #930 keep-the-server-up behavior. But
`botAllyDriver.mjs`'s `runTick` treated an empty `fetchState` as **"the match vanished from the
store → teardown as `completed`"**, so a transient DB blip **killed the driver mid-match**. The
teardown's own status write then also failed against the same dead DB, leaving the side-table row
`active` with no live driver — a silent freeze (self-healing only on a later restart's revival,
re-looping if the DB stays flaky). An empty fetch is **ambiguous** — reaped match *vs* unreachable
DB — and the driver assumed the former on the FIRST empty. (The mid-turn `submitMove` *throw* path
is already caught + re-armed by `scheduleNextTick`; it is the empty-*fetch* → teardown that is
fatal, in BOTH the top-of-tick fetch and the mid-turn `'vanished'` result from `attemptBotTurn`.)

---

## User-Visible Impact

A co-op player whose match hits a brief Postgres outage (common around deploys) no longer freezes
on the bot's turn. The driver rides out the outage — still registered — and resumes driving the
moment the DB recovers. Healthy matches and every human-only / solo match are unchanged.

---

## Assumes

- **`resilientFetch` returns empty on exhausted retries** (does not throw) to keep the server up
  (#930). (Verified — the deploy log's `… returning empty`.)
- **The driver's `fetchState` = the store fetch**, so an empty result reaches `runTick` /
  `attemptBotTurn` as `null`. (Verified — `botAllyRoutes.mjs` wiring.)
- **A live driver's match rarely vanishes legitimately** — gameover / idle-abandon teardown fires
  first, and the reaper never deletes a live match — so tolerating a long empty run before
  teardown is safe. (Verified — `matchReaper`, driver teardown paths.)

---

## Context (Read First)

- `apps/server/src/bot-ally/botAllyDriver.mjs` — `runTick` (the top-of-tick `state === null`
  teardown), `attemptBotTurn` (returns `'vanished'` on a mid-turn empty), `driveBotTurn`,
  `teardown`, the driver-object fields, `createBotAllyDriver` limits.
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — the injected `fetchState` (store `db.fetch`);
  **read-only** for this packet.
- The live diagnostic: match `nZn_U4QO-hr` — deploy log ECONNREFUSED → empty → teardown-completed.

---

## Non-Negotiable Constraints

**Always apply:** human-style code (`00.6`); ESM; full-sentence errors; `// why:` on the
non-obvious bits; no determinism/persistence surface touched (server orchestration).

**Packet-specific:**
- **Empty is tolerated, not terminal-on-first.** Only a run of `>= BOT_MAX_EMPTY_FETCH_POLLS`
  CONSECUTIVE empty fetches tears the driver down (`completed`). Any non-empty fetch resets the
  counter.
- **Both empty sites funnel through one helper.** The top-of-tick `state === null` and the
  mid-turn `driveBotTurn` `'vanished'` result both call `tolerateEmptyFetch`; `'game-over'` is
  split out and still tears down immediately.
- **No store-contract change.** `resilientFetch` still returns empty-to-stay-up; the fix lives in
  the consumer.
- **Compose, don't disturb.** WP-419 liveness `driving`, WP-420 mark-and-revive, WP-424 SIGTERM
  stop are unchanged.

---

## Scope (In)

### A) Tolerance counter (`apps/server/src/bot-ally/botAllyDriver.mjs`, modified)
- `BOT_MAX_EMPTY_FETCH_POLLS = 90`; `deps.maxEmptyFetchPolls` override; threaded through
  `createBotAllyDriver` limits + `runTick`.
- Driver-object field `emptyFetchPolls: 0`.

### B) `tolerateEmptyFetch` + wiring (`apps/server/src/bot-ally/botAllyDriver.mjs`, modified)
- Helper: increment `emptyFetchPolls`; teardown `completed` only at the threshold.
- `runTick`: `state === null` → `tolerateEmptyFetch`; reset `emptyFetchPolls = 0` on a real state;
  `driveBotTurn` `'vanished'` → `tolerateEmptyFetch` (split from `'game-over'`).

### C) Tests (`apps/server/src/bot-ally/botAllyDriver.test.ts`, modified)
- A single empty does not teardown; sustained empties past the tolerance teardown `completed`; a
  non-empty fetch resets the counter.

---

## Out of Scope

- **The infra trigger** — why Postgres goes `ECONNREFUSED` around deploys (a deploy-coupled DB
  restart or residual instability despite the basic-1gb move, #932). An operational investigation,
  not this code fix.
- **Making `resilientFetch` throw** on connection-refused (a shared store-contract change; wider
  blast radius) — rejected in favor of the consumer-side fix.
- **WP-419 / WP-420 / WP-424 behaviors** — unchanged; this composes with them.

---

## Files Expected to Change

- `apps/server/src/bot-ally/botAllyDriver.mjs` — **modified** (constant + field + `tolerateEmptyFetch` + two teardown-site edits)
- `apps/server/src/bot-ally/botAllyDriver.test.ts` — **modified** (3 new tests)
- `docs/ai/STATUS.md` — **modified** (fix note)
- Governance: `WORK_INDEX.md` (WP-426) + `DECISIONS.md` (**D-24247**) + `EC_INDEX.md`/EC-461 + `NUMBER-LEDGER.md` + `docs/05-ROADMAP-MINDMAP.md`, at execution.

> No `api-endpoints.md` change — no HTTP endpoint added / modified / removed / re-statused (§21 N/A).

---

## Contract

| Key | Value |
|---|---|
| `BOT_MAX_EMPTY_FETCH_POLLS` | 90 (consecutive empties tolerated; ≈ several minutes given the store's ~1.8s/call retry) |
| `emptyFetchPolls` | driver field; `+1` per empty fetch, `= 0` on any non-empty fetch |
| Teardown-on-empty | only at `emptyFetchPolls >= BOT_MAX_EMPTY_FETCH_POLLS` → `completed` |
| Empty sites | top-of-tick `state === null` AND mid-turn `'vanished'` both → `tolerateEmptyFetch` |
| `'game-over'` | still tears down immediately (split from `'vanished'`) |
| Untouched | WP-419 `driving`; WP-420 revival; WP-424 SIGTERM stop; the store's empty-return contract; determinism/persistence |

---

## Acceptance Criteria

1. A single empty `fetchState` does NOT tear the driver down — it stays registered, status `active`, no status persisted (asserted) (**AC-1**).
2. `BOT_MAX_EMPTY_FETCH_POLLS` CONSECUTIVE empty fetches tear the driver down `completed` (asserted) (**AC-2**).
3. A non-empty fetch resets `emptyFetchPolls`, so interspersed empties never reach the consecutive threshold (asserted) (**AC-3**).
4. Both the top-of-tick empty and the mid-turn `'vanished'` result funnel through `tolerateEmptyFetch`; `'game-over'` still tears down immediately (**AC-4**).
5. `pnpm --filter @legendary-arena/server test` green; `pnpm -r build` clean; `pnpm -r --no-bail test` green repo-wide (**AC-5**).
6. A bot-ally match survives a Postgres blip / DB restart and keeps playing (D-24026, operator-pending on deploy) (**AC-6**).

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test
pnpm -r --no-bail test
Select-String -Path "apps\server\src\bot-ally\botAllyDriver.mjs" -Pattern "tolerateEmptyFetch|BOT_MAX_EMPTY_FETCH_POLLS|emptyFetchPolls"
git diff --name-only
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] An empty fetch is tolerated for a bounded run; only a sustained-empty match tears down
- [ ] Both empty sites funnel through `tolerateEmptyFetch`; `'game-over'` unchanged
- [ ] WP-419/420/424 behaviors untouched; store contract untouched; no determinism/persistence/HTTP change
- [ ] `server` test green (+3 driver tests); `pnpm -r build` 0; `pnpm -r --no-bail test` green repo-wide
- [ ] `DECISIONS.md` **D-24247** landed; `WORK_INDEX` (WP-426) + `EC_INDEX`/EC-461 + `NUMBER-LEDGER` + mindmap node + `docs/ai/STATUS.md` updated
- [ ] Live-verify (D-24026, operator-pending on deploy): a bot-ally match survives a DB blip
- [ ] No files outside `## Files Expected to Change` were modified

---

## Vision Alignment

**Vision clauses touched:** §14 (reliability — a routine DB blip no longer freezes a live co-op
match), §11 (match lifecycle). **Conflict assertion:** No conflict — a resilience fix; no scoring /
variant / determinism / persistence change. **Non-Goal check:** NG — no gameplay change.
**Determinism:** none touched (server orchestration; the driver never mutates `G`).

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. Highlights — §5 lightweight lane (single file + tests, additive);
§8 Server boundary (orchestration only); §11/§21 N/A (no HTTP endpoint change); §15.1 APPLIES
(D-24026 survive-a-DB-blip); §17 §11/§14 (no conflict). §22 determinism N/A.

## Pre-Flight / Copilot (drafter self-review, lightweight lane)

**Pre-flight: READY.** Deps on `main` (WP-375/414/424); scope locked; no hard-dep WP in flight.
**Scaffold (empirical independence):** implemented + ran the affected suite — `botAllyDriver.test.ts`
23/0 (3 new) after `pnpm -r build`.

**Copilot: PASS.** Failure modes pinned: (a) a genuinely-gone match never tears down → **threshold
teardown at `BOT_MAX_EMPTY_FETCH_POLLS`, AC-2**; (b) intermittent empties accrete to a false
teardown → **reset on any non-empty, AC-3**; (c) the mid-turn empty still kills the driver →
**`'vanished'` funnels through the same helper, AC-4**; (d) `'game-over'` wrongly tolerated →
**split out, still immediate teardown, AC-4**; (e) the threshold too short for a real DB restart →
**90 empties × the store's ~1.8s/call ≈ several minutes**; (f) store contract disturbed → **fix is
consumer-side only, empty-return untouched**.

## Decision (reserved, lands at execution)

Reserves **D-24247**: the bot-ally driver tolerates a bounded run of consecutive empty `fetchState`
results (a transient Postgres outage the bgio store surfaces as an empty return, #930) via an
`emptyFetchPolls` counter + `tolerateEmptyFetch`, instead of tearing down as `completed` on the
FIRST empty — so a DB blip / restart around a deploy no longer kills the driver mid-match and
freezes the co-op board. Both the top-of-tick empty and the mid-turn `'vanished'` funnel through
the helper; `'game-over'` still tears down immediately. Making the store throw was rejected (wider
blast radius); the infra trigger for the DB `ECONNREFUSED` is a separate operational investigation.
Drafted 2026-07-25; not yet landed.
