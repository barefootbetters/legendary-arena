# EC-461 — Bot-Ally Driver Survives a Transient Postgres Blip (Server) (Execution Checklist)

> **Status:** PROPOSED — number pending governance allocation (WP-426 / EC-461).
> **Source WP:** [WP-426](../work-packets/WP-426-bot-ally-survive-db-blip.md).
> **Lane:** Lightweight (single file + tests, additive).

**Layer:** Server (`apps/server/src/bot-ally/`)

## Scope (read first)
IN scope: make the bot-ally driver tolerate a bounded run of consecutive empty `fetchState`
results (a transient Postgres outage the bgio store surfaces as an empty return) instead of
tearing down as `completed` on the first empty. OUT of scope: the infra trigger (why PG goes
`ECONNREFUSED` around deploys), making `resilientFetch` throw (store-contract change — rejected),
WP-419/420/424 behaviors (unchanged).

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it (baseline `0e7694b4`)
- [ ] WP-375 (driver/poll loop), WP-414 (revival/side-table), WP-424 (SIGTERM stop) are on `main`
- [ ] `botAllyDriver.mjs` reviewed — `runTick` top-of-tick `state === null` teardown; `attemptBotTurn` returns `'vanished'` on a mid-turn empty; `driveBotTurn` `'game-over' || 'vanished'` teardown; the driver-object fields; `createBotAllyDriver` limits threading
- [ ] The deploy-log evidence reviewed — `resilientFetch` returns EMPTY on exhausted retries (`… returning empty`), and the driver then teardown-`completed`
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/server test` runs (build-before-test — a stale registry `dist` crashes server test imports)

## Locked Values (do not re-derive)
- `BOT_MAX_EMPTY_FETCH_POLLS = 90` (consecutive empties tolerated; ≈ several minutes given the store's own ~1.8s/call retry)
- `deps.maxEmptyFetchPolls` override; threaded through `createBotAllyDriver` limits → `runTick`
- Driver field `emptyFetchPolls: 0`; `+1` per empty (in `tolerateEmptyFetch`); reset `= 0` on any non-empty fetch (in `runTick`)
- Teardown-on-empty only at `emptyFetchPolls >= maxEmptyFetchPolls` → `completed`
- Both empty sites funnel through `tolerateEmptyFetch`: top-of-tick `state === null` AND mid-turn `driveBotTurn` `'vanished'` (split from `'game-over'`)

## Guardrails
- A single empty fetch NEVER tears the driver down — only a sustained-empty run past the threshold does
- The counter resets on ANY non-empty fetch, so interspersed empties never accrete to a false teardown
- `'game-over'` still tears down IMMEDIATELY (not tolerated) — it is split out from `'vanished'`
- `resilientFetch` / the store's empty-return contract is NOT edited (consumer-side fix only)
- WP-419 `driving`, WP-420 mark-and-revive, WP-424 SIGTERM stop are NOT edited
- No determinism / persistence / response-shape / auth change

## Required `// why:` Comments
- `BOT_MAX_EMPTY_FETCH_POLLS` — why an empty fetch is ambiguous (reaped vs unreachable-DB) and why the count is the distinguisher; why 90
- `runTick` `state === null` — why tolerate rather than teardown; the reset-on-real-state
- `runTick` `'vanished'` — why the mid-turn empty gets the same tolerance
- `tolerateEmptyFetch` — the consecutive-count contract

## Files to Produce
- `apps/server/src/bot-ally/botAllyDriver.mjs` — **modified** — constant + `emptyFetchPolls` field + limits threading + `tolerateEmptyFetch` + the two teardown-site edits + the reset
- `apps/server/src/bot-ally/botAllyDriver.test.ts` — **modified** — single-empty tolerated; sustained-empty teardown; non-empty reset
- `docs/ai/DECISIONS.md` — **modified** — **D-24247** lands Active
- `docs/ai/STATUS.md` — **modified** — bot-ally DB-blip fix note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-426
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-461 status
- `docs/ai/NUMBER-LEDGER.md` — **modified** — reserve WP-426 / EC-461 / D-24247
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-426 node; `pnpm roadmap:counts:write`

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` passes (bot-ally driver 23/0 +3; full server suite green + DB-gated skips)
- [ ] `pnpm -r --no-bail test` green repo-wide
- [ ] `rg "tolerateEmptyFetch|BOT_MAX_EMPTY_FETCH_POLLS|emptyFetchPolls" apps/server/src/bot-ally/botAllyDriver.mjs` → present at all sites
- [ ] `git diff apps/server/src/bot-ally/botAllyRoutes.mjs` is empty (store wiring untouched)
- [ ] Integration (D-24026, post-deploy): a bot-ally match survives a DB blip / restart and keeps playing
- [ ] D-24247 Active; WORK_INDEX/EC_INDEX/NUMBER-LEDGER/mindmap/STATUS updated
- [ ] `node scripts/check-number-ledger.mjs --check` green; `pnpm roadmap:counts:check` green
- [ ] Commit prefix `EC-461:` (staged files under `apps/server/`, `docs/`)

## Common Failure Smells
- The driver still dies on a DB blip → an empty site not funnelled through `tolerateEmptyFetch`, or the threshold too small
- A genuinely-gone match never tears down → the threshold teardown missing, or the counter never increments
- Intermittent empties eventually teardown a healthy match → the reset-on-non-empty missing
- `'game-over'` no longer tears down → it was left bundled with `'vanished'` under the tolerance
- Server tests crash on import → stale registry `dist` (build first)
