# EC-459 — Stop Bot-Ally Drivers on SIGTERM (Deploy-Overlap Freeze) (Server) (Execution Checklist)

> **Status:** PROPOSED — number pending governance allocation (WP-424 / EC-459).
> **Source WP:** [WP-424](../work-packets/WP-424-bot-ally-stop-drivers-on-sigterm.md).
> **Lane:** Lightweight (single layer, 2 code files + tests, additive).
> **Renumber note:** originally EC-458 / WP-423 / D-24243; a concurrent session landed those numbers first (#1000, `hugo-version-upgrade`), so this renumbered to EC-459 / WP-424 / D-24244.

**Layer:** Server (`apps/server/src/`)

## Scope (read first)
IN scope: add `stopAllBotAllyDrivers()` and call it in the `index.mjs` SIGTERM handler (AFTER
the `shutdown_interrupted` mark reads the driven-match keys) so a draining old instance stops
driving the bot seat during a rolling deploy; make an in-flight tick bail on `driver.stopped`.
OUT of scope: WP-420's mark-and-revive semantics (unchanged), a cross-instance ownership lock
(named follow-up), the status route / client banner (unchanged).

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it (baseline `01cd6ac4`)
- [ ] WP-375 (driver + `botAllyDrivers`) and WP-420 (SIGTERM mark + `shutdown_interrupted` revival) are on `main`
- [ ] `botAllyDriver.mjs` reviewed — `driver.stop()` clears the timer, sets `stopped`, deletes from `botAllyDrivers`; `scheduleNextTick`/`runTick`/`attemptBotTurn` poll loop; `tickInProgress`
- [ ] `index.mjs` SIGTERM handler reviewed — it marks `[...botAllyDrivers.keys()]` then closes handles/pool but never stops the drivers
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/server test` runs (build-before-test — a stale registry `dist` crashes server test imports)

## Locked Values (do not re-derive)
- SIGTERM order: `markInProgressBotAllyMatchesInterrupted([...botAllyDrivers.keys()])` FIRST, then `stopAllBotAllyDrivers()`, then the periodic-handle stops + `httpServer.close`
- `stopAllBotAllyDrivers()` snapshots `[...botAllyDrivers.values()]` BEFORE looping (`stop()` mutates the map)
- `stop()` is the existing driver method — no new teardown/status write (WP-420's mark owns the side-table; the new instance owns revival)
- Mid-turn bail: `attemptBotTurn` `if (driver.stopped) return { kind: 'passed' }` at the loop top; `runTick` `if (driver.stopped) return;` after `driveBotTurn`
- Single-instance steady state; the deploy overlap (old draining + new booted) is the only two-writer window

## Guardrails
- The `shutdown_interrupted` mark MUST run before the stop — stopping first empties the map and the mark would see no matches
- `stopAllBotAllyDrivers()` writes NO side-table status — it only clears timers + de-registers (WP-420 mark + new-instance revival own the rest)
- WP-420's `markInProgressBotAllyMatchesInterrupted` / `rehydrateBotAllyDrivers` bodies are NOT edited
- An in-flight tick submits no further moves after `stop()` — the `driver.stopped` bails are the guarantee
- No determinism / persistence / response-shape / auth change

## Required `// why:` Comments
- `stopAllBotAllyDrivers` — why it exists (deploy-overlap: the old draining instance keeps driving the bot seat and races the new instance on `_stateID`); why snapshot-first
- `index.mjs` SIGTERM — why stop AFTER the mark (the mark reads the driven-match keys)
- `attemptBotTurn` — why bail on `driver.stopped` (a tick in flight at shutdown must submit no further moves)
- `runTick` — why skip the post-turn write on `driver.stopped` (process tearing down; new instance owns revival/status)

## Files to Produce
- `apps/server/src/bot-ally/botAllyDriver.mjs` — **modified** — `stopAllBotAllyDrivers()` export + `driver.stopped` bail in `attemptBotTurn` + in `runTick`
- `apps/server/src/index.mjs` — **modified** — import `stopAllBotAllyDrivers`; call it in the SIGTERM handler after the interrupt-mark
- `apps/server/src/bot-ally/botAllyDriver.test.ts` — **modified** — `stopAllBotAllyDrivers` stop+de-register; mid-turn-stop submits no further moves
- `docs/ai/DECISIONS.md` — **modified** — **D-24244** lands Active
- `docs/ai/STATUS.md` — **modified** — bot-ally deploy-overlap fix note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-424
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-459 status
- `docs/ai/NUMBER-LEDGER.md` — **modified** — reserve WP-424 / EC-459 / D-24244
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-424 node; `pnpm roadmap:counts:write`

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` passes (bot-ally driver 20/0 +2; full server suite green + DB-gated skips)
- [ ] `pnpm -r --no-bail test` green repo-wide
- [ ] `rg "stopAllBotAllyDrivers" apps/server/src/bot-ally/botAllyDriver.mjs apps/server/src/index.mjs` → defined + wired
- [ ] `git diff apps/server/src/bot-ally/botAllyRoutes.mjs` is empty (WP-420 mark-and-revive untouched)
- [ ] Integration (D-24026, post-deploy): deploy mid bot-ally match; the bot keeps playing (no `invalid stateID … fightVillain` wedge)
- [ ] D-24244 Active; WORK_INDEX/EC_INDEX/NUMBER-LEDGER/mindmap/STATUS updated
- [ ] `node scripts/check-number-ledger.mjs --check` green; `pnpm roadmap:counts:check` green
- [ ] Commit prefix `EC-459:` (staged files under `apps/server/`, `docs/`)

## Common Failure Smells
- The `shutdown_interrupted` mark writes nothing on deploy → the stop ran before the mark (map emptied first)
- The old instance still races the new one after deploy → `stopAllBotAllyDrivers()` not called in SIGTERM, or an in-flight tick has no `driver.stopped` bail
- A stray side-table write during shutdown → the `runTick` post-turn bail is missing
- WP-420 revival stops re-attaching matches → a mark-and-revive body was edited (it must not be)
- Server tests crash on import → stale registry `dist` (build first)
