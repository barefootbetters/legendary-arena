# EC-449 — Bot-Ally Stall Surfacing + Restart Revival (Server) (Execution Checklist)

> **Status:** PROPOSED — number pending governance allocation (EC-449 / EC-450 pair).
> **Source WP:** [WP-414](../work-packets/WP-414-bot-ally-stall-surface-and-revival.md).
> **Pairs with:** EC-450 (client stall banner, WP-415 — consumes this EC's status surface).

**Layer:** Server (`apps/server/src/bot-ally/`, `data/migrations/`)

## Scope (read first)
IN scope: a read-only `GET /api/match/:matchId/bot-ally-status` surface, a
within-turn retry-once before the `BotAllyDriver` faults, bounded restart revival
of still-live faulted/exhausted matches (a new `revive_count` column), and the
`036` migration. OUT of scope (companion EC-450, client): the play-surface stall
banner that consumes this status surface. This EC only *produces* the status
surface + the survivability change; EC-450 *consumes* it. No `server.mjs` edit —
the route registers inside the existing `registerBotAllyRoutes`, and revival is
already wired via `rehydrateBotAllyDrivers`.

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it
- [ ] WP-414 allocated; §Pre-Flight Verdict = READY; WP-375 (driver + side-table + rehydration) is Done on `main`
- [ ] `botAllyDriver.mjs` understood: `botAllyDrivers` Map (`:47`), `BOT_ALLY_STATUS` (`:112-118`), `driveBotTurn` (`:461-526`), `runFaultFallback` (`:540-552`), `teardown` (`:337-363`)
- [ ] `botAllyRoutes.mjs` understood: `readActiveBotAllyMatches` (`:243-255`), `readBotSeatCredentials` (`:271-284`), `updateBotAllyMatchStatus` (`:229-235`), `rehydrateBotAllyDrivers` (`:526-576`), `startDriverForMatch` (`:329-343`)
- [ ] `bgioPgStore.js` `fetch` reports `ctx.gameover` + round-trips metadata credentials (`:195-234`)
- [ ] `data/migrations/033_create_match_bot_ally.sql` reviewed (the table `036` extends; columns `bot_seats text[]`, `status text default 'active'`, `fault_message`, `decision_seed`, `policy`)
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/server test` runs

## Locked Values (do not re-derive)
- Endpoint: `GET /api/match/:matchId/bot-ally-status`, Auth: **`guest`** (matchId is the capability), `Cache-Control: no-store`
- Response `200`: `{ driving: boolean, status: 'active'|'faulted'|'abandoned'|'exhausted'|'completed'|'absent', message: string | null }`
- `driving === (status === 'active')`; `message` = row `fault_message` when `status==='faulted'`, else `null`; `absent` (+ `driving:false`, `message:null`) when NO `match_bot_ally` row
- `500` project-owned envelope `{ error: 'internal_error' }` (no-store on the error path too); status-code domain `{200, 500}`
- Read source: `legendary.match_bot_ally` ONLY — NEVER the bgio blob, NEVER `G`/`ctx` (D-24095)
- `MAX_REVIVALS = 3` (per-match lifetime revival cap)
- Revival set (`readRevivableBotAllyMatches`): `status = 'active'` OR (`status IN ('faulted','exhausted')` AND `revive_count < MAX_REVIVALS`). It returns `match_id, bot_seats, decision_seed, policy, revive_count` — the four columns `readActiveBotAllyMatches` already returned PLUS `revive_count` (dropping one breaks `startDriverForMatch`)
- Revival gate: `db.fetch(matchId,{state:true})` — a gone/`ctx.gameover !== undefined` match is marked `completed` and skipped (unchanged path); a live one is re-registered
- Revival effect: re-register the driver; when the row was NOT already `active`, in one UPDATE set `status='active'` AND `revive_count = revive_count + 1`
- Within-turn retry: exactly ONE fresh-`fetchState` re-attempt of a wedged turn before the turn is treated as faulted; a per-turn `retriedOnce` boolean guards it. The guard wraps the **whole-turn** loop, so it covers **every** fault exit — the three `runFaultFallback` sites (decide-throw `:487`, null-move `:495`, no-op-stateID `:515`) AND the step-cap exhaustion exit (`:525`, which does not call `runFaultFallback`) — so no fault path bypasses the single retry
- Migration `036_add_revive_count_to_match_bot_ally.sql`: `ALTER TABLE legendary.match_bot_ally ADD COLUMN IF NOT EXISTS revive_count integer NOT NULL DEFAULT 0;` (additive, idempotent)
- Fault message is surfaced VERBATIM (already public-safe, WP-261 / D-24037) — never re-decorated at the route layer

## Guardrails
- The status route reads **ONLY** the side-table; it **NEVER** calls `db.fetch` on the bgio blob and never inspects `G`/`ctx` (D-24095 store-only discipline)
- `guest` auth: the response carries **NO** identity, **NO** `G`, **NO** seat credentials — only `{ driving, status, message }`
- Revival is **bounded**: a row at `revive_count === MAX_REVIVALS` is excluded from the revival set and stays `faulted` — a permanently-wedged match must not re-register a doomed driver on every deploy
- Revival re-attaches **only a still-live match** (`ctx.gameover === undefined`); a faulted match whose game already ended is marked `completed`, never revived
- The within-turn retry is **exactly once** — the existing never-block-the-human fallback order (`endTurn` → `advanceStage` → `faulted`) is unchanged and sits behind the single retry
- **No `server.mjs` edit**, no change to the create/join/ready path, seat-0 discipline, the `botSeats` tag, or the bot decision policy (WP-375 / D-24120 invariants)
- Determinism: no `Math.random()` / `Date.now()` introduced; the retry re-fetches authoritative state and re-runs the same seeded policy

## Required `// why:` Comments
- status route — why `guest` (matchId is the capability) + why side-table-only (never the bgio blob; D-24095)
- status route — why `fault_message` is surfaced verbatim (already public-safe, WP-261 / D-24037)
- `readRevivableBotAllyMatches` — why the revival set widened beyond `active` (a faulted-but-live driver lost to a restart must revive) + why `revive_count < MAX_REVIVALS` (no endless deploy-revive loop)
- revival re-register site — why the gameover check still marks `completed` (a finished match is not revived) + why `revive_count` increments
- `driveBotTurn` retry — why exactly one fresh-fetch retry precedes the fault fallback (a transient getLegalMoves/stateID race resolves on the retry; a real wedge still faults)
- migration `036` — why additive/idempotent `revive_count` default 0 (existing rows carry forward)

## Files to Produce
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — **modified** — `GET /api/match/:matchId/bot-ally-status` inside `registerBotAllyRoutes`; `readRevivableBotAllyMatches`; `rehydrateBotAllyDrivers` revives still-live under-cap rows + increments `revive_count`
- `apps/server/src/bot-ally/botAllyDriver.mjs` — **modified** — one within-turn fresh-fetch retry ahead of `runFaultFallback`
- `apps/server/src/bot-ally/botAllyRoutes.test.ts` — **modified** — status `active`/`faulted`+message/`absent`/`500`; `readRevivableBotAllyMatches` includes active + under-cap faulted, excludes at-cap; revival marks `completed` on gameover, flips `active`+`revive_count++` on live faulted, skips on missing credentials
- `apps/server/src/bot-ally/botAllyDriver.test.ts` — **modified** — retry recovers a single wedge (no fault); second consecutive wedge faults; retry fires at most once
- `data/migrations/036_add_revive_count_to_match_bot_ally.sql` — **new** — additive `revive_count`
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — 1 new row: `GET /api/match/:matchId/bot-ally-status`, `Status: Wired`, `Auth: guest` (D-11804)
- `docs/ai/DECISIONS.md` — **modified** — **D-24229** (status surface) + **D-24230** (retry + bounded revival) flip to Active
- `docs/ai/STATUS.md` — **modified** — bot-ally stall-surfacing + revival note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-414
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-449 status (+ note companion EC-450 client)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip WP-414 node `📝` → `✅`; `pnpm roadmap:counts:write`

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `botAllyRoutes.test.ts` + `botAllyDriver.test.ts` pass (status, revival, cap, retry-once)
- [ ] `rg "bot-ally-status" apps/server/src/bot-ally/botAllyRoutes.mjs` → exactly 1 route
- [ ] `rg "MAX_REVIVALS|revive_count" apps/server/src/bot-ally/botAllyRoutes.mjs` → present (cap enforced)
- [ ] `rg "registerBotAllyRoutes" apps/server/src/server.mjs` → still exactly 1 (no new wiring); `server.mjs` NOT in `git diff --name-only`
- [ ] `rg "Math\.random|Date\.now" apps/server/src/bot-ally/botAllyDriver.mjs` → zero
- [ ] Migration `036` applied to the test DB is idempotent (a re-run is a no-op; existing rows show `revive_count = 0`)
- [ ] `api-endpoints.md` has the new `GET` row; D-24229 + D-24230 Active; WORK_INDEX/EC_INDEX/mindmap updated
- [ ] Integration (D-24026, post-deploy): a bot-ally match survives a server restart and keeps playing; a genuinely-wedged match settles to `faulted` and the status surface reports it
- [ ] Commit prefix `EC-449:` (staged files under `apps/server/`, `data/migrations/`, `docs/`)

## Common Failure Smells
- Status leaks identity / `G` → the route read the bgio blob instead of the side-table, or returned more than `{ driving, status, message }`
- A wedged match revives on every deploy forever → `revive_count` not incremented, or the cap not enforced in `readRevivableBotAllyMatches`
- A finished match gets a resurrected driver → the `ctx.gameover` gate skipped before re-register
- The retry masks a real wedge indefinitely → the `retriedOnce` guard missing, so it loops instead of falling to the fault fallback
- `server.mjs` shows in the diff → the route was wired there instead of inside `registerBotAllyRoutes`, or revival added a second boot call
- Human still frozen after a fault → status surface returns `absent` for a real bot-ally match (row read keyed wrong), so EC-450's banner never fires
- Non-2xx on a rowless match → `absent` must be a `200`, not a `404`
