# EC-341 — Client Move-Acknowledgment Watchdog (Execution Checklist)

**Source:** docs/ai/work-packets/WP-312-client-move-ack-watchdog.md
**Layer:** Client (`apps/arena-client`)

## Before Starting
- [ ] On `main`, clean, synced to `origin/main`; baseline `git rev-parse origin/main` recorded.
- [ ] WP-311 primitives present: `LiveClientHandle.resync()` (`stop()`+`start()`) and the subscribe callback writes `_stateID`/`isConnected` to the `connection` store.
- [ ] All engine moves are `client: false` (`packages/game-engine/src/game.ts`, D-10008) — the `_stateID`-as-ack premise. If any move predicts client-side, STOP.
- [ ] `pnpm --filter @legendary-arena/arena-client test` + `typecheck` green on `main`.
- [ ] Target file set = the `## Files to Produce` below. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Ack signal: boardgame.io `_stateID` advancing on a server frame (valid ONLY because all moves are `client: false` — no optimistic prediction; D-10008).
- Recovery: WP-311 `resync()` = `client.stop()` + `client.start()`. NEVER assign `_stateID`, resubmit the stale move, fabricate a frame, or call a server endpoint.
- `MOVE_ACK_TIMEOUT_MS` — the submit→ack deadline; conservative so a normal rapid-click race (self-heals in <1s) never trips it, and a real wedge recovers within a few seconds. Suggested ~4000 ms; lock the chosen value + `// why:` in D-24097.
- `RESYNC_COOLDOWN_MS` — minimum gap between auto-resyncs (resync-storm guard). Suggested ~8000 ms; lock in D-24097.
- Reserved decision: **D-24097**.

## Guardrails
- Arm the watchdog ONLY after a real move dispatched (`client.moves[name]` is a function and was called); never for an unknown/no-op name; never while cooling down.
- No engine / move / `apps/server` / `packages/**` / `G` change; no new state surface in `G`; no new dependency.
- Preserve byte-for-byte the WP-089 projection write, the WP-070 pre-plan middleware, and the WP-311 connection-store write in the subscribe callback.
- Clear the watchdog + cooldown timers on `handle.stop()` (no timer outlives the client — WP-262 interval-cleanup discipline).
- Do NOT modify `client: false` or the framework; the server's silent-reject-on-stale is worked around client-side, not patched.

## Required `// why:` Comments
- `MOVE_ACK_TIMEOUT_MS` / `RESYNC_COOLDOWN_MS`: the value rationale (why conservative; race self-heals vs real wedge).
- The watchdog fire → `resync()`: cite WP-311 (D-24096) + D-24097; note `_stateID`-as-ack relies on D-10008 (`client: false`).
- `DECISIONS.md` D-24097: mechanism + locked values + the D-10008 dependency + why resync (not resubmit/poke).

## Files to Produce
- `apps/arena-client/src/client/bgioClient.ts` — **modified** — move-ack watchdog (arm on dispatch, ack on `_stateID` advance, fire `resync()` on timeout, cooldown, timer teardown) + exported locked constants.
- `apps/arena-client/src/client/bgioClient.test.ts` — **modified** — watchdog tests via `node:test` `mock.timers`: ack-before-timeout → no resync; no-ack → resync (stop→start); cooldown blocks a second resync; unknown move → no arm.
- `docs/ai/DECISIONS.md` — **modified** — D-24097.
- Governance ledgers: `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client test` passes (watchdog tests run with mock timers).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) passes; `pnpm -r build` exits 0.
- [ ] `Select-String bgioClient.ts "_stateID\s*=[^=]"` → no output; `"MOVE_ACK_TIMEOUT_MS|RESYNC_COOLDOWN_MS"` → declarations present.
- [ ] `git diff --name-only | Select-String "apps/server|packages/"` → no output.
- [ ] Live-on-surface (D-24026): a mid-match wedge auto-recovers within ~`MOVE_ACK_TIMEOUT_MS` (no banner click / reload); evidence + deploy SHA (ideally a Render log showing `invalid stateID` then recovery).
- [ ] `STATUS.md`, `WORK_INDEX.md` (WP-312 checked off), `EC_INDEX.md` (EC-341 Done) updated.

## Common Failure Smells
- The watchdog fires on every rapid-click burst → timeout too short (races self-heal in <1s; `MOVE_ACK_TIMEOUT_MS` must sit well above round-trip).
- Repeated resyncs in a tight loop → cooldown not honored, or the fire path re-arms itself.
- A leaked timer keeps the test event loop alive (hang) → timers not cleared on `stop()`.
- Any diff under `packages/game-engine/**` or `apps/server/**` → scope breach (client-only).
- `resync()` resubmits the lost move or assigns `_stateID` → wrong recovery; must be a plain `stop()`+`start()` re-anchor.
