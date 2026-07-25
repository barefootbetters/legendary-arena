# WP-424 — Stop Bot-Ally Drivers on SIGTERM (Deploy-Overlap Freeze) (Server)

**Status:** Draft 2026-07-25 · **PROPOSED (WP-424; highest landed WP is 423 = hugo-version-upgrade)** · **Lightweight lane** (D-24028 — single layer, 2 code files + tests, additive). Pairs with **EC-459** (authored). Reserves **D-24244** (lands at execution).
> **Renumber note:** originally drafted as WP-423 / EC-458 / D-24243; a concurrent session landed those same numbers first (#1000, `hugo-version-upgrade`), so this renumbered to WP-424 / EC-459 / D-24244 per the ledger "first-landed keeps" rule.

**Primary Layer:** Server (`apps/server/src/`)
**User-Visible Surface:** `play.legendary-arena.com` play surface — a bot-ally co-op match that is mid-bot-turn during a redeploy no longer freezes because the **old (draining) instance keeps driving the bot seat** and races the new instance. **D-24026 live-verify APPLIES** (deploy mid bot-ally match; the bot keeps playing after the deploy settles instead of wedging on a fight).
**Dependencies:** WP-375 ✅ (the driver + `botAllyDrivers` registry), WP-420 ✅ (the SIGTERM handler + `shutdown_interrupted` revival this extends). No hard-dep WP in flight.
**Baseline:** `origin/main` @ `01cd6ac4` (capture `git rev-parse origin/main` at execution).

---

## Goal

Fix a **silent bot-ally freeze that recurs on essentially every deploy** that catches a bot
mid-turn. Live evidence (match `DBlXvBs_WXA`, 2026-07-25): the co-op board froze on the bot's
turn 15 right after the bot fought a villain — the turn never ended — while the server reported
`{ driving:true, status:'active' }`. The deploy log showed the smoking gun: after the new
instance re-registered the driver, boardgame.io's Master repeatedly rejected the bot's move —
`ERROR: invalid stateID, was=[273], expected=[274] - playerID=[1] - action[fightVillain]` (and
again `288/289` 58s later) — an **off-by-one stateID race**: two writers were driving the same
bot seat.

**Root cause:** the SIGTERM handler (`index.mjs`) marks the driven bot-ally matches
`shutdown_interrupted` (WP-420) but **never stops their drivers**. Render's rolling deploy boots
the NEW instance (which revives those matches and starts driving them) BEFORE it SIGTERMs the
OLD one; the old SIGTERM handler then blocks in `httpServer.close(...)` draining the human's
long-lived Socket.IO connection, so the old instance's drivers keep polling (250 ms) and
submitting the bot's moves for the **entire termination-grace window** (until Render SIGKILLs).
Two instances driving the same seat race on boardgame.io's `_stateID`; the slow, chain-triggering
`fightVillain` loses repeatedly, never lands, and the turn wedges. Because a driver *is*
registered, `driving:true` — so WP-419's stall banner (needs `driving:false`) stays silent and
the human just sees a frozen board.

This packet stops the drivers on SIGTERM so the old instance ends its participation the moment
the deploy signal arrives.

---

## User-Visible Impact

A co-op player mid-match during a deploy no longer freezes on the bot's turn. The old instance
stops driving the bot seat at SIGTERM; the new instance's revived driver (WP-420) becomes the
sole writer, so the bot's `fightVillain` lands and the turn completes. Healthy non-deploy matches
and every human-only / solo match are unchanged.

---

## Assumes

- **The SIGTERM handler marks the driven matches before pool close** (`index.mjs`; WP-420,
  `markInProgressBotAllyMatchesInterrupted([...botAllyDrivers.keys()])`). (Verified.)
- **`botAllyDrivers` is this process's live-driver registry** and each driver's `stop()` clears
  its poll timer, sets `stopped=true`, and de-registers it. (Verified — `botAllyDriver.mjs`.)
- **Boot revival re-attaches a `shutdown_interrupted` match past the cap** (WP-420). Stopping the
  old driver does not lose the match — the new instance revives it. (Verified.)
- **Single-instance steady state; the only two-writer window is a rolling deploy** (old draining
  + new booted). A cross-instance ownership lock is the durable multi-instance answer; noted out
  of scope. (Verified — Render single service.)

---

## Context (Read First)

- `apps/server/src/index.mjs` — the SIGTERM handler that marks matches but never stops drivers.
- `apps/server/src/bot-ally/botAllyDriver.mjs` — `botAllyDrivers`, `createBotAllyDriver` (the
  `driver.stop()` contract), `scheduleNextTick`/`runTick`/`attemptBotTurn` (the poll loop that
  keeps submitting), `tickInProgress`.
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — `rehydrateBotAllyDrivers` (boot revival) +
  `markInProgressBotAllyMatchesInterrupted`; **read-only** for this packet.
- The live diagnostic: match `DBlXvBs_WXA` — `driving:true/active` while frozen on the bot's turn
  15; deploy log `invalid stateID … action[fightVillain]` 51s after new-instance boot.

---

## Non-Negotiable Constraints

**Always apply:** human-style code (`00.6`); ESM; full-sentence errors; `// why:` on the
non-obvious bits; no determinism/persistence surface touched (server orchestration).

**Packet-specific:**
- **Mark before stop.** The SIGTERM handler MUST read `[...botAllyDrivers.keys()]` for the
  `shutdown_interrupted` mark BEFORE stopping the drivers (`stop()` empties the map).
- **Stop is synchronous + total.** `stopAllBotAllyDrivers()` stops every registered driver
  (clears its timer, sets `stopped`, de-registers). It writes no status (WP-420's mark owns the
  side-table; the new instance owns revival).
- **In-flight tick must bail.** A tick already awaiting a fetch/submit at SIGTERM must submit no
  further moves — `attemptBotTurn` checks `driver.stopped` each step; `runTick` skips the
  post-turn side-table write when stopped.
- **No new revival/status semantics.** WP-420's mark-and-revive is unchanged; this only ends the
  old instance's driving.

---

## Scope (In)

### A) `stopAllBotAllyDrivers()` (`apps/server/src/bot-ally/botAllyDriver.mjs`, modified)
- New exported function: snapshot `[...botAllyDrivers.values()]` then call `driver.stop()` on each
  (snapshot first because `stop()` deletes from the map as it runs).

### B) Mid-turn bail (`apps/server/src/bot-ally/botAllyDriver.mjs`, modified)
- `attemptBotTurn`: at the top of the step loop, `if (driver.stopped) return { kind: 'passed' }`.
- `runTick`: after `driveBotTurn(...)`, `if (driver.stopped) return;` — no turn-count / revival
  write on the way out of a shutdown-stopped tick.

### C) SIGTERM wiring (`apps/server/src/index.mjs`, modified)
- Import `stopAllBotAllyDrivers`; call it in the SIGTERM handler AFTER
  `markInProgressBotAllyMatchesInterrupted(...)`, before the other handle stops / `httpServer.close`.

### D) Tests (`apps/server/src/bot-ally/botAllyDriver.test.ts`, modified)
- `stopAllBotAllyDrivers` stops + de-registers every driver.
- A driver stopped mid-turn submits no further moves and does not advance the turn counter.

---

## Out of Scope

- **A cross-instance ownership guard** (DB advisory lock / `driver_owner` + heartbeat so
  overlapping instances can never both drive a match) — the durable multi-instance fix; a named
  follow-up. This packet closes the dominant lingering-driver window only.
- **WP-420's mark-and-revive semantics** — unchanged; this composes with them.
- **The status route / client banner** — unchanged.
- **Unsticking the already-frozen `DBlXvBs_WXA`** — an operator action once the fix deploys and the
  old instance is gone, not a code change.

---

## Files Expected to Change

- `apps/server/src/bot-ally/botAllyDriver.mjs` — **modified** (`stopAllBotAllyDrivers` + two `driver.stopped` bails)
- `apps/server/src/index.mjs` — **modified** (import + call in SIGTERM handler)
- `apps/server/src/bot-ally/botAllyDriver.test.ts` — **modified** (2 new tests)
- `docs/ai/STATUS.md` — **modified** (fix note)
- Governance: `WORK_INDEX.md` (WP-424) + `DECISIONS.md` (**D-24244**) + `EC_INDEX.md`/EC-459 + `NUMBER-LEDGER.md` (reservations) + `docs/05-ROADMAP-MINDMAP.md` node, at execution.

> No `api-endpoints.md` change — no HTTP endpoint added / modified / removed / re-statused (§21 N/A).

---

## Contract

| Key | Value |
|---|---|
| `stopAllBotAllyDrivers()` | snapshots `botAllyDrivers.values()`, calls `driver.stop()` on each (clears timer + de-registers) |
| SIGTERM order | mark `shutdown_interrupted` (reads the keys) → `stopAllBotAllyDrivers()` → stop periodic handles → `httpServer.close` |
| Mid-turn bail | `attemptBotTurn` returns on `driver.stopped`; `runTick` skips the post-turn write on `driver.stopped` |
| Revival | unchanged — the new instance revives the `shutdown_interrupted` match (WP-420) |
| Untouched | status route / `driving`; the client banner; determinism/persistence; response shape/auth |
| Deployment | single-instance steady state; the deploy overlap is the only two-writer window (ownership lock deferred) |

---

## Acceptance Criteria

1. `stopAllBotAllyDrivers()` stops and de-registers every registered driver (timer cleared, `stopped=true`, removed from `botAllyDrivers`) (asserted) (**AC-1**).
2. The SIGTERM handler calls `stopAllBotAllyDrivers()` AFTER the `shutdown_interrupted` mark reads `[...botAllyDrivers.keys()]` (so the mark still sees the driven matches) (**AC-2**).
3. A driver stopped mid-turn submits no further moves and does not advance the turn counter or write status (asserted) (**AC-3**).
4. WP-420's mark-and-revive logic is unchanged (no edit to `markInProgressBotAllyMatchesInterrupted` / `rehydrateBotAllyDrivers` bodies) (**AC-4**).
5. `pnpm --filter @legendary-arena/server test` green; `pnpm -r build` clean; `pnpm -r --no-bail test` green repo-wide (**AC-5**).
6. Deploy mid bot-ally match: the bot keeps playing after the deploy settles (no `invalid stateID … fightVillain` wedge) (D-24026, operator-pending on deploy) (**AC-6**).

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test
pnpm -r --no-bail test
Select-String -Path "apps\server\src\bot-ally\botAllyDriver.mjs" -Pattern "stopAllBotAllyDrivers"      # present
Select-String -Path "apps\server\src\index.mjs" -Pattern "stopAllBotAllyDrivers"                       # wired into SIGTERM
git diff --name-only
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `stopAllBotAllyDrivers()` exists and is called in the SIGTERM handler after the interrupt-mark
- [ ] An in-flight tick bails on `driver.stopped`; no stray post-turn side-table write on shutdown
- [ ] WP-420 mark-and-revive untouched; no determinism/persistence change; no HTTP shape/auth change
- [ ] `server` test green (+2 driver tests); `pnpm -r build` 0; `pnpm -r --no-bail test` green repo-wide
- [ ] `DECISIONS.md` **D-24244** landed; `WORK_INDEX` (WP-424) + `EC_INDEX`/EC-459 + `NUMBER-LEDGER` + mindmap node + `docs/ai/STATUS.md` updated
- [ ] Live-verify (D-24026, operator-pending on deploy): deploy mid bot-ally match, bot keeps playing
- [ ] No files outside `## Files Expected to Change` were modified

---

## Vision Alignment

**Vision clauses touched:** §14 (reliability — a routine deploy no longer freezes a live co-op
match), §11 (match lifecycle). **Conflict assertion:** No conflict — a shutdown-ordering fix; no
scoring / variant / determinism / persistence change. **Non-Goal check:** NG — no gameplay change.
**Determinism:** none touched (server orchestration; the driver never mutates `G`).

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. Highlights — §5 lightweight lane (single layer, 2 code files +
tests, additive); §8 Server boundary (orchestration only; no engine/registry runtime change);
§11/§21 N/A (no HTTP endpoint change); §15.1 APPLIES (D-24026 deploy-mid-match keeps playing);
§17 §11/§14 (no conflict). §22 determinism N/A.

## Pre-Flight / Copilot (drafter self-review, lightweight lane)

**Pre-flight: READY.** Deps on `main` (WP-375/420); scope locked; no hard-dep WP in flight.
**Scaffold (empirical independence):** implemented + ran the affected suite — `botAllyDriver.test.ts`
20/0 (2 new) after `pnpm -r build`.

**Copilot: PASS.** Failure modes pinned: (a) the interrupt-mark misses the driven matches because
stop ran first → **mark reads the keys BEFORE stop, AC-2**; (b) an in-flight tick keeps submitting
after stop → **`driver.stopped` bail in `attemptBotTurn`, AC-3**; (c) a stray post-turn status
write during shutdown → **`runTick` bail on `driver.stopped`**; (d) the map mutating mid-iteration
in `stop()` → **snapshot `values()` first, AC-1**; (e) WP-420 revival broken → **mark-and-revive
untouched, AC-4**; (f) residual boot-to-SIGTERM overlap → **ownership lock named out of scope
(single-instance steady state; this closes the dominant lingering-driver window)**.

## Decision (reserved, lands at execution)

Reserves **D-24244**: the server SIGTERM handler stops every registered bot-ally driver
(`stopAllBotAllyDrivers()`) AFTER marking the driven matches `shutdown_interrupted` (WP-420), so a
Render rolling deploy's OLD (draining) instance stops driving the bot seat instead of racing the
NEW instance's revived driver on boardgame.io's `_stateID` (`invalid stateID … fightVillain`) and
freezing the co-op match `driving:true`. An in-flight tick bails on `driver.stopped`. The durable
cross-instance ownership guard is a named follow-up; single-instance steady state is assumed.
Drafted 2026-07-25; not yet landed.
