# WP-437 — Bot-Ally Cross-Instance Ownership Guard (Deploy-Overlap Two-Writer Freeze)

**Status:** Drafted 2026-07-26 · **EC:** EC-472 · **Reserves:** D-24256
**Layer:** Server (`apps/server/**`) · **Lane:** standard (7 files + a new migration + a new module; exceeds the lightweight budget)
**Baseline:** drafted off `origin/main` @ `35ca6be9` in an isolated worktree (the shared checkout is owned by concurrent sessions).

## Goal

Close the deploy-overlap "two-writer" bot-ally freeze that WP-424 (D-24244)
explicitly deferred. On a rolling Render deploy the NEW instance revives a
match's `BotAllyDriver` and starts submitting the bot's moves BEFORE the OLD
instance finishes draining — so for the termination-grace window **two instances
drive the same bot seat** and race on boardgame.io's `_stateID` (`invalid
stateID, was=[N], expected=[N+1]`). The bot's move never lands, the turn
livelocks, and because a driver *is* registered the status route still reports
`{ driving: true, status: 'active' }` — so neither WP-419's stall banner (needs
`driving:false`) nor WP-433's fault log fires, and the human sees a **silently
frozen board**. This WP adds a durable cross-instance **ownership lease** so only
ONE instance ever drives a given bot seat at a time; the other defers until the
owner's lease releases (clean SIGTERM) or expires (crash TTL).

## Assumes

- **WP-375 ✅ / D-24170** — the `BotAllyDriver`, `botAllyDrivers` map,
  `rehydrateBotAllyDrivers`, `startDriverForMatch`, and the
  `legendary.match_bot_ally` side-table exist. (`apps/server/src/bot-ally/**`,
  migration `033`.)
- **WP-424 ✅ / D-24244** — the SIGTERM handler stops this process's drivers
  (`stopAllBotAllyDrivers`) and marks the driven matches `shutdown_interrupted`
  BEFORE `httpServer.close`. **This WP is the deferred durable multi-instance
  fix D-24244 named** ("a cross-instance ownership guard (DB advisory lock /
  `driver_owner` + heartbeat)").
- **WP-420 ✅ / D-24240** — `shutdown_interrupted` (migration `037`) +
  deploy-aware past-cap revival; **WP-419 ✅ / D-24239** — `driving` liveness +
  strand→faulted; **WP-426 ✅ / D-24247** — empty-fetch tolerance;
  **WP-433 ✅ / D-24255** — fault observability. The guard **composes with** all
  of these; it does not replace them.
- **D-24095** — the bgio blob is store-only; ownership state lives in the
  `legendary.match_bot_ally` side-table, NEVER in `G`/`ctx` and NEVER by reading
  the bgio blob. The server layer MAY use `Date.now()`/`now()` (the no-clock rule
  is an *engine* rule).
- The `pg.Pool` is a single shared pool with `max: 10`
  (`apps/server/src/db/database.ts`), used by every server surface.

## Context

WP-424 stopped the OLD instance's drivers *at SIGTERM*, but Render boots and
revives on the NEW instance BEFORE it SIGTERMs the OLD one — so the residual
**boot-to-SIGTERM overlap window** remains. D-24244 deferred exactly this fix and
assumed single-instance steady state. Live evidence recurs: match `Sk1ASNTkGSz`
(2026-07-26T23:20, build `6018ac1`) `driving:true / status:active`, bot stuck
mid-turn-3, client economy inconsistent with 6 economy-generating plays that turn
— the same `driving:true`-while-stuck signature as the WP-424 case `DBlXvBs_WXA`.

**Design decision (D-24256): Option B (`driver_owner` + `heartbeat_at` lease)
over Option A (pg advisory lock).** The decisive factor is the shared pool: a
session-scoped `pg_try_advisory_lock` must be held on a *pinned* client for the
driver's lifetime, but the single `max: 10` pool is shared across every server
surface (leaderboards, match create, dashboard, reaper, harvester) — pinning one
client per active driver would starve the pool with only a handful of concurrent
bot-ally matches, and a dedicated side-pool adds connection pressure on an
already-OOM-prone Render Postgres (#932). Option B uses ordinary pooled queries,
composes with the existing side-table + SIGTERM machinery, and is
**observable/debuggable** (`driver_owner` + `heartbeat_at` are directly
queryable; handoffs log). Its only cost vs Option A's automatic
connection-close release is that a crashed owner (no clean SIGTERM) frees on a
bounded **TTL** rather than instantly — acceptable, and the common clean-deploy
path releases explicitly on SIGTERM for a near-instant handoff. See D-24256 for
the full rationale + rejected option.

**Arbitration model — cooperative at the tick, not gated at revival.** Rather
than block the new instance from *attaching* a driver (which would require a new
periodic sweep to eventually pick the match up after the old owner releases), the
new instance attaches its driver as it does today, and the driver **arbitrates at
each poll tick**: it runs an atomic claim-or-renew, and drives ONLY when it holds
the lease; otherwise it yields the tick (keeps polling). The existing 250ms poll
loop IS the retry mechanism — no new interval. When the old owner releases
(SIGTERM) or its heartbeat goes stale (crash TTL), the new instance's
already-attached driver wins the lease on its very next tick and takes over as
the sole writer. This keeps `rehydrateBotAllyDrivers` structurally unchanged and
makes the guard a behavioural no-op for a single instance (it always wins its own
lease).

## Scope (In)

- **Migration `038`** — additive `driver_owner text` + `heartbeat_at timestamptz`
  columns on `legendary.match_bot_ally` (both NULL-default, idempotent).
- **New `apps/server/src/bot-ally/botAllyOwnership.mjs`** — a per-process
  `SERVER_INSTANCE_ID`, the `BOT_ALLY_LEASE_TTL_MS` constant, and two pooled-query
  helpers: `acquireOrRenewBotAllyLease(database, matchId, ownerId, ttlMs)` (the
  atomic claim-or-renew UPDATE → boolean owned) and
  `releaseBotAllyLeasesForOwner(database, ownerId)` (clears this instance's
  leases).
- **`botAllyDriver.mjs`** — at the top of `runTick`, an **optional**
  `deps.renewOrAcquireLease()` gate: skip the tick on a lease-check throw
  (transient), yield the tick when it returns `false` (another live owner), drive
  only when `true`. Absent dep ⇒ always-owned (single-instance / test default).
- **`botAllyRoutes.mjs`** — wire `renewOrAcquireLease` into `startDriverForMatch`'s
  `deps` (bound to `SERVER_INSTANCE_ID` + the match id + TTL + the pool).
- **`index.mjs`** — release this instance's leases in the SIGTERM handler
  (alongside the existing interrupt-mark + `stopAllBotAllyDrivers`).
- **Tests** — a new `botAllyOwnership.test.ts` (the lease helpers over a fake
  `database` — claim/renew/expiry/yield/release SQL + params) and new
  `botAllyDriver.test.ts` cases (yields when not owner, drives when owner, skips
  on lease throw, back-compat when the dep is absent) using an injected fake
  clock/owner.

## Scope (Out)

- Any gameplay/engine change; the `getLegalMoves` pending-resolution class
  (WP-427/#1028 fault line).
- The human's disconnect/reconnect policy (WP-116); the human is NEVER gated —
  the lease governs only which instance drives the *bot seat*.
- Changing the 250ms poll, the fault/retry budgets, or the revival cap
  (`MAX_REVIVALS`) logic.
- Surfacing `driver_owner` on the **public** `bot-ally-status` route — the guest
  surface stays minimal (`{ driving, status, message }`); ownership is observable
  via the DB + server logs. No `api-endpoints.md` change (no response-shape
  change; D-11804 N/A).
- Reading/writing the bgio blob for ownership (D-24095). Ownership is side-table
  only.

## Files Expected to Change

| File | Change |
|---|---|
| `data/migrations/038_add_driver_owner_to_match_bot_ally.sql` | NEW — additive `driver_owner` + `heartbeat_at` |
| `apps/server/src/bot-ally/botAllyOwnership.mjs` | NEW — instance id, TTL, acquire/renew + release helpers |
| `apps/server/src/bot-ally/botAllyOwnership.test.ts` | NEW — lease helper unit tests (fake `database`) |
| `apps/server/src/bot-ally/botAllyDriver.mjs` | EDIT — lease gate at top of `runTick` (optional dep) |
| `apps/server/src/bot-ally/botAllyDriver.test.ts` | EDIT — lease-gate cases (+ back-compat) |
| `apps/server/src/bot-ally/botAllyRoutes.mjs` | EDIT — wire `renewOrAcquireLease` dep into `startDriverForMatch` |
| `apps/server/src/index.mjs` | EDIT — release this instance's leases on SIGTERM |
| governance | WP/EC/WORK_INDEX/EC_INDEX/mindmap/NUMBER-LEDGER/DECISIONS/STATUS |

No file outside `apps/server/**` + `data/migrations/**` + governance changes.

## Contract

- **New columns** on `legendary.match_bot_ally`: `driver_owner text` (NULL = no
  owner), `heartbeat_at timestamptz` (NULL = never heartbeated). Additive; every
  existing row carries forward `NULL`/`NULL` (immediately claimable).
- **Lease acquire/renew** — one atomic statement:
  `UPDATE … SET driver_owner = <owner>, heartbeat_at = now(), updated_at = now()
  WHERE match_id = $1 AND (driver_owner IS NULL OR driver_owner = <owner> OR
  heartbeat_at IS NULL OR heartbeat_at < now() - (<ttlMs> ms))`. Returns owned =
  `rowCount > 0`. A fresh peer lease (different owner, recent heartbeat) fails the
  WHERE → `owned = false`.
- **Lease release** (SIGTERM) — `UPDATE … SET driver_owner = NULL, updated_at =
  now() WHERE driver_owner = <owner>`. A survivor can then claim on its next tick.
- **`SERVER_INSTANCE_ID`** — a per-process unique id (`crypto.randomUUID()` at
  module load); stable for the process lifetime; distinct across instances.
- **`BOT_ALLY_LEASE_TTL_MS`** — locked at **15000** (15s). Comfortably larger than
  a normal tick+turn (a live owner renews every ≤~2s, so never false-expires) and
  short enough that a crashed owner (no clean SIGTERM) frees within ~15s. The
  common clean-deploy path releases explicitly on SIGTERM, so TTL governs only the
  ungraceful-crash recovery latency.
- **Driver gate** — `deps.renewOrAcquireLease` is OPTIONAL. Absent ⇒ owned=true
  (single-instance / unit tests). Present + `false` ⇒ yield (no drive, no
  idle-tracking, no teardown). Present + throw ⇒ skip the tick (retry next poll).

## Acceptance Criteria

1. Under overlapping deploys only ONE instance drives a bot seat: while the old
   owner's lease is fresh the new instance's driver yields every tick (submits
   nothing); when the old owner releases (SIGTERM) or its heartbeat expires (TTL)
   the new instance claims and drives — no `_stateID` race.
2. A crashed owner (no SIGTERM) frees within `BOT_ALLY_LEASE_TTL_MS`; the match is
   never permanently stuck.
3. Single-instance behaviour is unchanged: the sole instance always wins its own
   lease every tick and drives exactly as before (one extra PK UPDATE per tick, no
   added turn latency).
4. The human is never gated; only the bot seat's driving instance is arbitrated.
5. Tests: `botAllyOwnership.test.ts` covers claim/renew/expiry(fake clock)/yield/
   release; `botAllyDriver.test.ts` covers owner-drives / non-owner-yields /
   lease-throw-skips / dep-absent-back-compat. The full bot-ally driver suite
   stays green. `pnpm -r build` 0; server suite green.

## Verification Steps

1. `pnpm -r build` → 0.
2. `node --import tsx --test apps/server/src/bot-ally/botAllyOwnership.test.ts` →
   green.
3. `node --import tsx --test apps/server/src/bot-ally/botAllyDriver.test.ts` →
   green (existing 25 + new cases).
4. `pnpm -r --no-bail test` → repo-wide green (DB-gated skips as usual).
5. Migration applies cleanly + idempotently against the local DB
   (`node scripts/migrate.mjs` with `TEST_DATABASE_URL`); re-run is a no-op.
6. **D-24026 live-verify (operator-pending):** deploy twice in quick succession
   mid bot-ally match on play.legendary-arena.com → the bot keeps playing, no
   freeze. This class only reproduces under real overlapping deploys, so it is not
   unit-testable end-to-end (documented operator-pending).

## Definition of Done

- [ ] Migration `038` additive + idempotent; both columns NULL-default.
- [ ] `botAllyOwnership.mjs` + tests; `botAllyDriver.mjs` lease gate + tests;
      routes wiring; SIGTERM release.
- [ ] Single-instance behaviour unchanged (guard is a behavioural no-op); the
      human is never gated.
- [ ] `pnpm -r build` 0; bot-ally driver suite green; `pnpm -r --no-bail test`
      repo-wide green.
- [ ] Full governance filed (WP/EC/D-24256 + WORK_INDEX/EC_INDEX/mindmap/STATUS/
      NUMBER-LEDGER); ledger + roadmap-counts gates green. Commit prefix `EC-472:`.
- [ ] **D-24026 live-verify operator-pending** (documented; class not
      unit-reproducible).

## Lint Gate Self-Review (`00.3`, 21 sections)

- §1 Scope closed / §2 Layer (Server only) / §3 Files enumerated — PASS.
- §4 Determinism — N/A engine; server may use `now()`/`Date.now()` (D-24095 note). PASS.
- §5 Persistence — ownership in the `match_bot_ally` side-table, NOT `G`/`ctx`, NOT the bgio blob (D-24095). PASS.
- §6 Zones / §7 Moves / §8 Backend — single shared pool used (no `new Pool()` per query); §8 PASS.
- §9 Canonical arrays — none touched. N/A.
- §10 Contract files — none (`.types/.validate/.gating` untouched). N/A.
- §11–§16 — no engine/registry/UI-projection change. N/A.
- §17 Vision — §11 lifecycle / §14 reliability; no conflict. PASS.
- §18 Tests — new unit suites + driver cases; fake clock (no real wall-clock timing). PASS.
- §19 Comments — `// why:` on the TTL, the instance-id, the lease WHERE, and the SIGTERM release. PASS.
- §20 Error handling — lease-check throw skips the tick; release best-effort/guarded. PASS.
- §21 API Catalog (D-11804) — **N/A**: no HTTP endpoint added/changed; `bot-ally-status` response shape unchanged (`driver_owner` NOT surfaced on the public route). PASS.

**Pre-flight verdict:** READY TO EXECUTE (deps WP-375/419/420/424/426/433 all ✅ on main; scope locked; Option-B decision made from the code).
**Copilot check verdict:** PASS (residual: a >TTL single-turn DB outage could momentarily re-expose the race — a pathological corner far outside the deploy-overlap target, and the fault/`_stateID`-reject machinery still bounds it; documented in D-24256).
