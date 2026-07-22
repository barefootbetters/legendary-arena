# WP-414 — Bot-Ally Stall Surfacing + Restart Revival (Server)

**Status:** Draft 2026-07-22 · **PROPOSED (WP-414; highest landed WP is 412)** · **Standard two-session lane** (D-24028 — NOT lightweight: a new read endpoint + a driver survivability change + a schema migration + changed teardown/revival semantics). Pairs with **WP-415** (client stall banner) and **EC-449** (authored). Reserves **D-24229, D-24230** (land at execution). **Fast-follow to WP-375** (the bot-ally driver).
**Primary Layer:** Server (`apps/server/src/bot-ally/`, `apps/server/src/server.mjs`, `data/migrations/`)
**User-Visible Surface:** `play.legendary-arena.com` play surface — a bot-ally match that loses (or faults) its server-side driver no longer freezes the human silently: the driver is revived on restart, a wedged turn is retried once, and (via **WP-415**) the human is told when the bot ally has genuinely stopped. **D-24026 live-verify APPLIES** (a bot-ally match must survive a server restart and keep playing; a genuinely-wedged match must settle to a surfaced `faulted`).
**Dependencies:** **WP-375 ✅** (the `BotAllyDriver` + `rehydrateBotAllyDrivers` + the `legendary.match_bot_ally` side-table this packet extends); **WP-309 / D-24095 ✅** (the `bgio` pg store whose `db.fetch` reports `ctx.gameover`); **WP-115 ✅** (the long-lived pg pool + route-registration pattern).
**Baseline:** `origin/main` @ `a8178d5f` (capture `git rev-parse origin/main` at execution).

---

## Goal

Stop a bot-ally match from freezing the human when the server-side driver
disappears or a bot turn wedges. The `BotAllyDriver` is in-process runtime state
(`botAllyDrivers` Map, `botAllyDriver.mjs:47`); a live driver always tears down
within `BOT_MAX_MOVE_STEPS_PER_TURN` on any wedge, so a **lasting** freeze means
the driver is *gone* (server restart) or was persisted `faulted` and never
revived. Today `rehydrateBotAllyDrivers` revives only `status='active'` rows —
so a driver that faulted (or exhausted) before a restart is never re-attached,
and the human on seat 0 waits forever with **no signal** (`fault_message` is
written to the side-table but no endpoint exposes it). This packet (a) adds a
read-only **status surface** the client can poll, (b) makes the driver **retry a
wedged turn once** before faulting, and (c) makes restart revival **revive a
still-live faulted/exhausted match**, bounded by a `revive_count` so a genuinely
stuck match settles to a *surfaced* `faulted` instead of looping every deploy.

---

## User-Visible Impact

A player in a co-op match with a bot ally who alt-tabs while a teammate session
merges a deploy (the reported repro) no longer returns to a dead board: the new
server instance re-attaches the bot driver and the bot keeps taking its turns. If
the bot genuinely cannot continue (a real wedge that survives one retry and the
revival cap), the human is no longer stranded on a silent board — **WP-415**
renders a co-op-framed "the bot ally has stopped" banner (fed by the status
surface this packet adds) with a way out.

---

## Assumes

- **`BotAllyDriver` is per-match, in-memory, and torn down on every exit path**
  (terminal / abandon / maxTurns / fault), persisting a terminal `status`
  (+ `fault_message` when faulted) to `legendary.match_bot_ally`.
  `botAllyDriver.mjs:47/337-363`; `BOT_ALLY_STATUS` at `:112-118`. (Verified.)
- **`rehydrateBotAllyDrivers` runs unconditionally on boot, awaited before the
  server accepts traffic**, and today re-registers only `status='active'` rows,
  re-reading each bot seat's credential from the persisted bgio match metadata.
  `botAllyRoutes.mjs:526-576`; `server.mjs:1034`; `readActiveBotAllyMatches` at
  `:243-255`; `readBotSeatCredentials` at `:271-284`. (Verified.)
- **The bgio pg store round-trips match metadata (incl. `players[seat].credentials`)
  and reports `ctx.gameover`** via `db.fetch(id, {state:true})` / `{metadata:true}`.
  `bgioPgStore.js:166-234`. (Verified — this is what revival re-reads.)
- **`fault_message` is a public-safe, co-op-framed sentence** (never a raw
  exception/stack/DB/secret/id/path — WP-261 / D-24037). `botAllyDriver.mjs:104-106`.
  (Verified — safe to surface verbatim to the human.)
- **The `legendary.match_bot_ally` row is never deleted; only `status` /
  `fault_message` are updated** as the driver tears down. `migration 033` header;
  `updateBotAllyMatchStatus` at `botAllyRoutes.mjs:229-235`. (Verified — a new
  `revive_count` column is safe to add and carry forward.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `apps/server/src/bot-ally/botAllyDriver.mjs` — the driver (turn-gate, fault
  fallback `runFaultFallback` `:540-552`, teardown `:337-363`).
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — the create endpoint, the
  side-table read/write helpers, and `rehydrateBotAllyDrivers` (`:526`).
- `apps/server/src/db/bgioPgStore.js` — the framework store `db.fetch` revival
  reads (D-24095 blob-read discipline: this packet reads only `ctx.gameover`
  presence + the metadata credential surface, never interprets `G`).
- `data/migrations/033_create_match_bot_ally.sql` — the table this packet's
  migration `036` extends with `revive_count`.
- WP-375 (`docs/ai/work-packets/WP-375-solo-bot-ally-driver-server.md`) — the
  parent packet; its `§Out of Scope` explicitly parked restart re-hydration as a
  fast-follow, and D-24170 recommended "re-register" — this packet completes that
  by covering the faulted-but-live case it left open.
- `docs/01-VISION.md §23(b)` — co-op framing (the bot is an ally; any surfaced
  string is co-op, never PvP/versus).

---

## Non-Negotiable Constraints

**Always apply:**
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`; deliver **full
  file contents** for every new/modified file (no diffs/snippets); ESM only,
  Node v22+.
- ESM only; `node:` built-ins; `.test.ts`; full-sentence errors; `// why:` on
  non-obvious choices; JSDoc; no branching `.reduce()`.
- Server layer only; the bot-ally code imports the engine **barrel** helpers it
  already uses — no deeper engine reach, no new engine import.

**Packet-specific:**
- **The status endpoint reads ONLY `legendary.match_bot_ally`.** It never reads
  the bgio blob and never touches `G`/`ctx` — the human-facing status is derived
  entirely from the side-table's `status` + `fault_message` (D-24095 discipline).
- **Auth = `guest` keyed by `matchId`.** The `matchId` is the unguessable
  capability; the response carries only a public-safe status label + the co-op
  `fault_message`, never identity, never `G`, never seat credentials (D-24229).
- **Revival is bounded.** A match is revived at most `MAX_REVIVALS` times
  (`revive_count`); past the cap it stays `faulted` and is surfaced, never
  revived again — a permanently-wedged match must not re-register a doomed driver
  on every deploy.
- **Revival only re-attaches a still-live match** (`db.fetch` shows
  `ctx.gameover === undefined`); a faulted match whose game already ended is
  marked `completed`, never revived.
- **The within-turn retry is exactly once.** A wedged turn is re-attempted from a
  fresh `fetchState` a single time; a second consecutive wedge persists `faulted`
  (the existing never-block-the-human fallback order is unchanged — the retry sits
  in front of it).
- **`fault_message` is surfaced verbatim** — never re-decorated with an
  exception, id, or path at the route layer (it is already public-safe).
- **No change to the create/join/ready path, seat-0 discipline, or `botSeats`
  tag** (WP-375 / D-24120 invariants untouched).

**Session protocol:**
- If the `MAX_REVIVALS` cap value, the poll auth posture, or whether a running
  instance (not just boot) should self-revive a fault is unresolved, resolve it
  here and record in D-24229 / D-24230 — do not guess.

---

## Scope (In)

### A) `GET /api/match/:matchId/bot-ally-status` (`apps/server/src/bot-ally/botAllyRoutes.mjs`)
- Auth: **`guest`** (matchId is the capability). `Cache-Control: no-store`.
- Reads `legendary.match_bot_ally` for `:matchId`. Response `200`:
  `{ driving: boolean, status: 'active'|'faulted'|'abandoned'|'exhausted'|'completed'|'absent', message: string | null }`.
  - `absent` (+ `driving:false`, `message:null`) when there is **no** row — the
    match is not a bot-ally match; the client shows nothing.
  - `driving === (status === 'active')`. `message` is the row's `fault_message`
    when `status === 'faulted'`, else `null`.
- `500` project-owned envelope `{ error: 'internal_error' }` on an uncaught DB
  fault (`no-store` on the error path too). Status-code domain `{200, 500}`.
- Registered inside `registerBotAllyRoutes(router, context)` (no new wiring call
  in `server.mjs`).

### B) Within-turn retry-once (`apps/server/src/bot-ally/botAllyDriver.mjs`)
- In `driveBotTurn`, a `retriedOnce`-guarded restart of the **entire turn loop**
  fires once — ahead of returning any `faulted` — from fresh authoritative state
  (`fetchState`), covering **all four** fault exits: the three `runFaultFallback`
  sites (decide-throw, null-move, no-op-stateID) AND the step-cap exhaustion exit
  (which does not call `runFaultFallback`). The retry is a fresh continuation from
  current state, not a re-submit of already-applied steps — so its rationale is a
  bounded second budget for a transient `getLegalMoves`/stateID race, and a real
  wedge still faults on the second pass. The existing per-step `runFaultFallback`
  (`endTurn` → `advanceStage`) recovery is unchanged; the retry wraps around it.

### C) Bounded restart revival (`apps/server/src/bot-ally/botAllyRoutes.mjs`)
- `readActiveBotAllyMatches` → **`readRevivableBotAllyMatches`**: selects rows
  where `status = 'active'` **OR** (`status IN ('faulted','exhausted')` AND
  `revive_count < MAX_REVIVALS`), returning `revive_count`.
- In `rehydrateBotAllyDrivers`, for each revivable row: if `db.fetch` shows the
  match gone or `ctx.gameover !== undefined` → mark `completed`, skip (unchanged).
  Otherwise re-read credentials and re-register; when the row was **not** already
  `active`, flip `status='active'` and **increment `revive_count`** in the same
  update. A row at the cap is excluded by the query and stays `faulted`.
- `MAX_REVIVALS = 3` (locked).

### D) Migration `036_add_revive_count_to_match_bot_ally.sql`
- `ALTER TABLE legendary.match_bot_ally ADD COLUMN IF NOT EXISTS revive_count integer NOT NULL DEFAULT 0;` Idempotent, additive.

### E) Tests
- `botAllyRoutes.test.ts`: status endpoint returns `active`/`driving:true`,
  `faulted`+message, `absent` for a rowless match, `500` envelope on a DB throw;
  `readRevivableBotAllyMatches` includes active + still-under-cap faulted, excludes
  at-cap; revival marks `completed` on a gameover match, flips `active` +
  increments `revive_count` on a live faulted match, skips on missing credentials.
- `botAllyDriver.test.ts`: a wedge recovered by the fresh-fetch retry does NOT
  fault; a second consecutive wedge DOES fault; the retry fires at most once.

---

## Out of Scope

- **The client stall banner** — **WP-415** (this packet is server-only; no
  `arena-client` edit). This packet only *produces* the status surface WP-415
  consumes.
- **Human takeover of a dead bot seat** — not in this arc (would touch seat→
  account mapping + ranked eligibility; a named future WP).
- **A running instance auto-reviving its own fault more than the one within-turn
  retry** — cross-restart revival is bounded by `revive_count`; a live instance
  gets exactly one within-turn retry, then faults and surfaces (Decision).
- **Any change to the bot decision policy, determinism, create/join/ready flow,
  seat-0 discipline, or the `botSeats` ranked tag** (WP-375 invariants).
- **Deleting or repurposing the `match_bot_ally` row** — additive column only.

---

## Files Expected to Change

- `apps/server/src/bot-ally/botAllyRoutes.mjs` — **modified** (status route;
  `readRevivableBotAllyMatches`; revival increments `revive_count`)
- `apps/server/src/bot-ally/botAllyDriver.mjs` — **modified** (within-turn
  retry-once ahead of the fault fallback)
- `apps/server/src/bot-ally/botAllyRoutes.test.ts` — **modified** (status +
  revival cases)
- `apps/server/src/bot-ally/botAllyDriver.test.ts` — **modified** (retry-once)
- `data/migrations/036_add_revive_count_to_match_bot_ally.sql` — **new**
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (1 new row:
  `GET /api/match/:matchId/bot-ally-status`, `Status: Wired`, `Auth: guest`) — D-11804
- `docs/ai/STATUS.md` — **modified** (stall-surfacing + revival note)
- Governance: `WORK_INDEX.md` (WP-414) + `DECISIONS.md` (**D-24229, D-24230**) +
  `EC_INDEX.md`/EC-449 + `docs/05-ROADMAP-MINDMAP.md` node, at execution.

> `server.mjs` is **NOT** edited — the status route registers inside the existing
> `registerBotAllyRoutes`, and revival is already wired via `rehydrateBotAllyDrivers`.

---

## Contract

| Key | Value |
|---|---|
| Endpoint | `GET /api/match/:matchId/bot-ally-status`, `guest`, → `{ driving, status, message }`; `{200, 500}`; `Cache-Control: no-store` |
| `status` domain | `'active' \| 'faulted' \| 'abandoned' \| 'exhausted' \| 'completed' \| 'absent'` |
| `driving` | `status === 'active'` |
| `message` | `fault_message` when `status==='faulted'`, else `null` (public-safe, verbatim) |
| Read source | `legendary.match_bot_ally` ONLY — never the bgio blob / `G` (D-24095) |
| Retry | exactly one fresh-fetch retry of a wedged turn before `runFaultFallback` |
| Revival set | `status='active'` OR (`faulted`/`exhausted` AND `revive_count < MAX_REVIVALS` AND game still live) |
| `MAX_REVIVALS` | `3` |
| Revival effect | re-register driver; if was not `active`: `status='active'`, `revive_count += 1` |
| Migration | `036` adds `revive_count integer NOT NULL DEFAULT 0` (additive, idempotent) |

---

## Acceptance Criteria

1. `GET /api/match/:matchId/bot-ally-status` returns `{driving:true,status:'active',message:null}` for a live bot-ally match, `{driving:false,status:'faulted',message:<public-safe>}` for a faulted one, and `{driving:false,status:'absent',message:null}` for a non-bot-ally match; it reads only the side-table and never the bgio blob (**AC-1**).
2. A bot turn that wedges once but succeeds on a fresh re-fetch does NOT fault; a turn that wedges twice consecutively faults via the existing fallback; the retry fires at most once per turn (**AC-2**).
3. On boot, `rehydrateBotAllyDrivers` re-registers a still-live `faulted`/`exhausted` match that is under the revival cap, flipping it to `active` and incrementing `revive_count`; a faulted match whose game already ended is marked `completed`, not revived (**AC-3**).
4. A match at `revive_count === MAX_REVIVALS` is excluded from the revival set and stays `faulted` (no endless deploy-revive loop) (**AC-4**).
5. Migration `036` adds `revive_count` idempotently and additively; a re-run is a no-op; existing rows default to `0` (**AC-5**).
6. `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` green; `api-endpoints.md` carries the new `GET` row. A live bot-ally match survives a server restart and keeps playing; a genuinely-wedged match settles to a surfaced `faulted` (D-24026, operator-pending on deploy) (**AC-6**).

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test
Select-String -Path "apps\server\src\bot-ally\botAllyRoutes.mjs" -Pattern "bot-ally-status|readRevivableBotAllyMatches|revive_count"  # present
Select-String -Path "apps\server\src\bot-ally\botAllyRoutes.mjs" -Pattern "db\.fetch\(.*state:\s*true"                              # revival still gates on ctx.gameover, not on interpreting G
Select-String -Path "apps\server\src\bot-ally\botAllyDriver.mjs" -Pattern "Math\.random|Date\.now"                                  # zero (determinism unchanged)
git diff --name-only   # server.mjs MUST NOT appear
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Status endpoint reads only the side-table, `guest` auth, `no-store`, `{200,500}`, `absent` for a rowless match
- [ ] Within-turn retry fires exactly once before the fault fallback
- [ ] Revival re-attaches still-live faulted/exhausted matches under the cap (flip `active` + `revive_count++`), marks gameover matches `completed`, excludes at-cap rows
- [ ] Migration `036` additive + idempotent; `server.mjs` unchanged
- [ ] `pnpm -r build` 0; server test green; live restart-survival + surfaced-fault verified (D-24026, operator-pending on deploy)
- [ ] `DECISIONS.md` **D-24229 + D-24230** landed; `WORK_INDEX` (WP-414) + `api-endpoints.md` row + `EC_INDEX`/EC-449 updated
- [ ] `docs/ai/STATUS.md` updated — bot-ally stall surfacing + bounded restart revival note
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] The status surface is readable by **WP-415** (contract frozen)

---

## Vision Alignment

**Vision clauses touched:** §23 (co-op — the bot is an ally; the surfaced status/
message is co-op, never PvP), §23(b) (co-op-only copy on any surfaced string).
**Conflict assertion:** No conflict — hardens an existing co-op mode's resilience
and adds a read-only diagnostic; no scoring / variant / determinism change.
**Non-Goal check:** NG — no new engine variant; `botSeats` ranked tag untouched.
**Determinism:** the bot decision path is unchanged (no `Math.random`/`Date.now`);
revival re-runs the same seeded policy; the retry re-fetches authoritative state.

## Lint Gate Self-Review (00.3)

- §1–§21 PASS or N/A-with-reason. Highlights — §5 standard lane (new endpoint +
  driver change + migration + changed revival semantics); §8 server boundary (no
  new engine reach; reads only the side-table + `ctx.gameover` presence, never
  interprets `G` — D-24095); §11 APPLIES (new `guest` `GET` endpoint →
  `api-endpoints.md` row + status/auth from the closed sets); §15.1 APPLIES
  (D-24026 restart-survival + surfaced-fault); §17 §23(b) co-op framing +
  determinism-unchanged addressed.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight: READY** — all deps Done on `main` (WP-375 driver + side-table +
rehydration; WP-309 pg store reports `ctx.gameover`; WP-115 pool/route pattern).
The revival extension completes the fast-follow WP-375 parked; no framework
internal is guessed.

**Copilot: PASS.** Failure modes pinned: (a) endless deploy-revive of a wedged
match → **`revive_count` cap, AC-4**; (b) reviving a match whose game already
ended → **gameover check marks `completed`, AC-3**; (c) status leaks identity/`G`
→ **side-table-only read, public-safe `fault_message` verbatim, D-24095/D-24229**;
(d) the retry masks a real wedge forever → **exactly-once guard, then the existing
fault fallback, AC-2**; (e) a silent freeze persists because nothing tells the
human → **the status surface + WP-415 banner**; (f) determinism regression →
**decision path untouched, grep `Math.random`/`Date.now` = 0**.

## Decision (reserved, lands at execution)

Reserves **D-24229** (bot-ally read-only status surface: `GET /api/match/:matchId/
bot-ally-status`, `guest`-by-capability, side-table-only, public-safe
`fault_message`) and **D-24230** (bot-ally survivability: one within-turn
fresh-fetch retry before fault; bounded restart revival of still-live faulted/
exhausted matches via a `revive_count`-capped `MAX_REVIVALS=3`). Drafted
2026-07-22; not yet landed.
