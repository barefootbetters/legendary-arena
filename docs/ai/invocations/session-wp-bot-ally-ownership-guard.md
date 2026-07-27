# Session prompt — Draft + ship the bot-ally cross-instance ownership guard

Draft **and execute** a new Work Packet that **designs and ships a cross-instance
ownership guard for bot-ally drivers**, so that only ONE server instance ever
drives a given bot seat at a time. This closes the deploy-overlap "two-writer"
freeze that WP-424 explicitly deferred. Carry the whole arc: governance draft →
design decision → implementation → tests → PR → merge on green.

## Why (the problem this fixes)

In bot-ally co-op (human at seat 0 + a server-driven bot at seat 1+), a per-match
`BotAllyDriver` (`apps/server/src/bot-ally/botAllyDriver.mjs`) polls the bgio
Postgres store every 250ms and submits the bot's moves. On a **rolling Render
deploy**, the NEW instance revives the driver (`rehydrateBotAllyDrivers`) BEFORE
the OLD instance finishes draining — the old instance's SIGTERM handler blocks in
`httpServer.close` draining the human's long-lived Socket.IO connection, so its
driver keeps polling + submitting for the whole termination-grace window. Two
instances now drive the same bot seat and **race on the bgio `_stateID`**: the
bot's moves are rejected (`invalid stateID, was=[N], expected=[N+1]`), the turn
livelocks, and it neither cleanly progresses nor faults.

Because a driver IS registered, `GET /api/match/:id/bot-ally-status` reports
`{ driving: true, status: 'active' }` — so WP-419's stall banner (needs
`driving:false`) never fires, and WP-433's fault log (`[bot-ally] … FAULTED …`,
#1028) never fires (it is not a fault). The human sees a **silently frozen
board**. This recurs whenever concurrent dev sessions merge server-affecting PRs
close together (each merge → a Render redeploy → overlapping deploys).

**Live evidence:** match `Sk1ASNTkGSz` (2026-07-26T23:20, build `6018ac1`):
`driving:true / status:active`, bot stuck mid-turn-3, client economy 0/0
inconsistent with 6 economy-generating plays that turn — the same `driving:true`-
while-stuck signature as the WP-424 case `DBlXvBs_WXA`.

**WP-424 (D-24244) deferred exactly this fix:** *"a cross-instance ownership guard
(DB advisory lock / `driver_owner` + heartbeat) — the durable multi-instance fix
that closes the residual boot-to-SIGTERM window; single-instance steady state
assumed."* This WP is that deferred fix.

## Design space — evaluate and PICK ONE, document the decision

Weigh at least these two approaches, record the choice + rationale + rejected
option in `DECISIONS.md` (and a short design doc if the tradeoffs warrant it):

- **Option A — Postgres advisory lock.** `pg_try_advisory_lock(key)` keyed on a
  stable 64-bit hash of the match id; an instance acquires before driving and a
  reviving instance skips revival when `try` fails (lock still held by the
  draining old instance). Crash-safe: session-scoped advisory locks release
  automatically when the holding connection closes. **Caveat to solve:** the pg
  `Pool` hands out arbitrary connections, so the lock must be held on a *pinned*
  client for the driver's lifetime (not a pooled per-query connection), and
  released on `driver.stop()`. Assess whether pinning a client per active driver
  is acceptable against `pool max=10`.

- **Option B — `driver_owner` + heartbeat column.** Add `driver_owner`
  (an instance/boot id) + `heartbeat_at timestamptz` to `legendary.match_bot_ally`.
  The owning driver updates `heartbeat_at` each tick; SIGTERM clears ownership.
  Revival proceeds only when there is no owner OR the owner's heartbeat is older
  than a TTL (e.g. a few × the 250ms poll, comfortably > a normal tick).
  Explicit + observable + surfaceable on the status route; the TTL handles a
  crashed owner (no clean SIGTERM). **Caveat to solve:** pick a TTL that never
  false-expires a live owner yet recovers a crashed one within seconds; add a
  cheap sweep/claim at revival time.

Recommendation to consider (not binding): **Option B** tends to be the more
observable/debuggable fit for this codebase (it can surface `driver_owner` on the
status route, and the WP-420 `shutdown_interrupted` + WP-424 SIGTERM-stop
machinery already gives clean deploy signals) — but make the call from the code,
and if Option A's crash-safety wins, take it.

## Non-negotiable constraints

- **Single-instance steady state must not regress** — the guard is a no-op when
  only one instance is running (the common case). No added latency to a normal
  bot turn.
- **Never permanently block revival.** A crashed owner (no clean SIGTERM) must
  release within a bounded TTL so the match is never stuck forever. Interacts
  with WP-419 (`settleStrandedActiveMatches`) and WP-420 (deploy-aware revival) —
  do not double-fault or strand a match the guard is just waiting to hand off.
- **Never gate the HUMAN.** The guard governs only which instance drives the *bot
  seat*; human moves are never blocked.
- **Persistence boundary.** Ownership/heartbeat state lives in the
  `legendary.match_bot_ally` side-table (or an advisory lock) — NEVER in `G`/`ctx`
  (runtime-only). Do not read/write the bgio blob for this (respect D-24095 and
  its carve-outs). Server layer may use `Date.now()` for heartbeats (the
  `ctx.random`/no-clock rule is an *engine* rule, not a server rule).
- **Compose with the existing machinery, don't replace it:** WP-424
  `stopAllBotAllyDrivers` on SIGTERM, WP-420 `shutdown_interrupted` revival,
  WP-419 strand-settle + `driving` liveness, WP-426 empty-fetch tolerance. The
  guard slots in at revival time and (for Option B) at each tick.

## Governance workflow (binding)

1. **Catch up on `main`** (`git fetch origin main --prune`; scan recent WPs — the
   bot-ally arc has high throughput, e.g. WP-424/426/433 already shipped).
2. **Run the WP-drafting preflight** `docs/ai/REFERENCE/01.0a-wp-drafting-phase.md`
   in full (read the whole file; Steps 1–7 + the Phase 1 Definition of Done are
   binding — Step 6 write-the-session-prompt and Step 7 commit are NOT optional).
   Satisfy the **Prompt Lint Gate** `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`.
3. **Reserve numbers FIRST** via the number ledger:
   `node scripts/check-number-ledger.mjs --next wp` (and `ec`, `d`), append the
   reservation lines to `docs/ai/NUMBER-LEDGER.md`, and verify
   `node scripts/check-number-ledger.mjs --check`. (Do NOT scan the frontier by
   hand — the ledger is the allocator; concurrent sessions are running.)
4. **Draft** the WP + EC + `DECISIONS.md` entry (the design decision lands here) +
   `WORK_INDEX.md` row + `EC_INDEX.md` row + a `docs/05-ROADMAP-MINDMAP.md` node
   (then `pnpm roadmap:counts:write`) + `docs/ai/STATUS.md`. The API Catalog
   (`docs/ai/REFERENCE/api-endpoints.md`) needs updating only if the
   `bot-ally-status` response shape changes (e.g. surfacing `driver_owner`).
5. **Execute**: DB migration (next free number under `data/migrations/` — re-check
   at execution) + the driver/index/revival changes + tests. Load the
   `legendary-server` and `legendary-persistence` skills before editing
   `apps/server/**` / adding a migration.
6. Build + test: `pnpm -r build && pnpm -r --no-bail test`; the bot-ally driver
   suite must stay green (`node --import tsx --test apps/server/src/bot-ally/botAllyDriver.test.ts`).
   Migrations auto-apply on deploy via the Render buildCommand — never run
   `pnpm migrate` against prod (the local `.env` DB is LOCAL).
7. **Work in an isolated worktree off `origin/main`** — the main checkout is
   shared with concurrent sessions. Commit prefix `EC-<num>:`; end commits with
   the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer. Open the
   PR, background-wait CI (never foreground-block), merge on green, remove the
   worktree.

## Key files / context to read first

- `apps/server/src/bot-ally/botAllyDriver.mjs` — the driver, the `botAllyDrivers`
  Map, `rehydrateBotAllyDrivers`, `settleStrandedActiveMatches`,
  `stopAllBotAllyDrivers`, `attemptBotTurn`, the 250ms tick, the move-submit retry.
- `apps/server/src/index.mjs` — the SIGTERM handler (stops drivers, marks matches
  `shutdown_interrupted`).
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — the `bot-ally-status` route +
  `driving = row.status==='active' && botAllyDrivers.has(matchId)`.
- The `legendary.match_bot_ally` side-table + its migrations: `033_create_match_bot_ally.sql`,
  `036_add_revive_count_to_match_bot_ally.sql`, `037_add_shutdown_interrupted_to_match_bot_ally.sql`.
- The bgio Postgres store (`bgio` schema) + the pg `Pool` construction (for Option A's
  pinned-connection question).
- Prior bot-ally freeze WPs (read their DECISIONS entries for the invariants they
  hold and the residuals they deferred): **WP-424 / D-24244** (SIGTERM stop —
  deferred THIS guard), **WP-420 / D-24240** (deploy-aware revival),
  **WP-419 / D-24239** (strand-settle + `driving` liveness), **WP-426 / D-24247**
  (empty-fetch tolerance), **WP-433 / D-24255** (fault observability, #1028).
- Skills: `.claude/skills/legendary-server/SKILL.md`, `.claude/skills/legendary-persistence/SKILL.md`.
- The auto-memory `project-solo-bot-ally-arc` (the whole freeze history + the
  `driving:true`-while-stuck two-writer signature and the deferred guard note).

## Definition of Done

- Under overlapping deploys, only ONE instance drives a bot seat: the reviving
  instance defers until the previous owner's lease releases (clean SIGTERM) or
  expires (crash TTL) — no `_stateID` race, no silent frozen board.
- A crashed owner's lease expires within a bounded TTL so revival resumes; a match
  is never permanently stuck.
- Single-instance behavior is unchanged (guard is a no-op).
- Tests: unit tests for the lease/heartbeat/TTL + revival-gating logic (inject a
  fake clock + fake owner; do NOT depend on real wall-clock timing); the bot-ally
  driver suite stays green. `pnpm -r build` 0; server suite green.
- **D-24026 live-verify (operator-pending):** deploy twice in quick succession
  mid bot-ally match → the bot keeps playing, no freeze. Note this in the WP as
  operator-pending (the class only reproduces under real overlapping deploys, so
  it is not unit-testable end-to-end).
- Full governance filed (WP/EC/D + WORK_INDEX/EC_INDEX/mindmap/STATUS/NUMBER-LEDGER);
  ledger + roadmap-counts gates green. Commit prefix `EC-<num>:`.

## Scope guardrails

- IN: the ownership guard (migration + driver ownership acquire/release/heartbeat
  + revival gating), its tests, and (optional) surfacing `driver_owner` on the
  status route.
- OUT: any gameplay/engine change; the getLegalMoves pending-resolution class
  (that is the separate WP-427/#1028 fault line); the human's disconnect/reconnect
  policy (WP-116); changing the 250ms poll or the fault/retry budgets.
