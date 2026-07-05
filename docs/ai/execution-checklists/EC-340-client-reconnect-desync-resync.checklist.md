# EC-340 — Client Reconnect & Desync Auto-Resync (Execution Checklist)

**Source:** docs/ai/work-packets/WP-311-client-reconnect-desync-resync.md
**Layer:** Client (`apps/arena-client`)

## Before Starting
- [ ] On `main`, clean, synced to `origin/main`; baseline `git rev-parse origin/main` recorded.
- [ ] WP-090 subscribe site present: `apps/arena-client/src/client/bgioClient.ts` `createLiveClient` builds the live `Client` over `SocketIO({server})` and `subscribe()`s frames (reads `state?.G` only today).
- [ ] boardgame.io ^0.50.2 `ClientState` surfaces `isConnected: boolean` on the subscribe frame (verified against `dist/types/src/client/client.d.ts`) — else STOP (RS session-protocol).
- [ ] WP-309 durable store is live (a resync must recover real match state).
- [ ] `pnpm --filter @legendary-arena/arena-client test` + `typecheck` green on `main`.
- [ ] Target file set = the `## Files to Produce` below. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Connection signal: boardgame.io `state.isConnected` (from `transport.isConnected`) — read in the EXISTING subscribe callback; do NOT invent a parallel connection probe.
- Force-resync primitive: `client.stop()` then `client.start()` — re-triggers the SocketIO connect → `onSync` → `_stateID` re-anchor. NEVER assign `_stateID`, fabricate a frame, or call a server endpoint directly.
- Connection store shape: `{ isConnected: boolean, lastStateId: number | null, hasEverConnected: boolean }` + setters only (mirror `uiState.ts`; no `G` data, no logic).
- Banner visibility predicate: `hasEverConnected === true && isConnected === false`.
- Reserved decision: **D-24096**.

## Guardrails
- Client submits intent only; `resync()` RE-READS authoritative state, never reconstructs/branches game logic.
- No engine / move / zone-op / snapshot / `apps/server` / `packages/**` file modified; no `G` change; no new state surface in `G` for connection tracking.
- Banner is non-blocking + read-only — surfaces status + a reconnect action; never mutates match state, never gates a move the engine would accept.
- Preserve the existing `state.G` projection write + the WP-070 pre-plan disruption middleware in the subscribe callback byte-for-byte.
- Server-side WP-116 cells (D-11601 grace / D-11602 pause / D-11604 abandonment / D-11605 replay-on-abort / D-11606 spectator) are OUT OF SCOPE — add none of them.
- No new npm dependency; no socket.io transport-option tuning (follow-up).

## Required `// why:` Comments
- `bgioClient.ts` `resync()`: cite WP-116 reconnect policy + D-24096 (why `stop()`+`start()` is the re-anchor path, not a `_stateID` poke).
- Banner mount (App.vue / HUD host): cite WP-311 + D-24096 (01.5 wiring).
- `DECISIONS.md` D-24096: the resync mechanism + the explicit server-side deferral.

## Files to Produce
- `apps/arena-client/src/client/bgioClient.ts` — **modified** — read `isConnected`/`_stateID` → connection store; add `resync()`.
- `apps/arena-client/src/stores/connection.ts` — **new** — connection Pinia store.
- `apps/arena-client/src/components/ConnectionStatusBanner.vue` — **new** — reconnect banner.
- `apps/arena-client/src/App.vue` (or the HUD play-view host) — **modified** — mount the banner (01.5).
- `apps/arena-client/src/client/bgioClient.test.ts` — **new/modified** — connection-surfacing + resync order tests.
- `apps/arena-client/src/stores/connection.test.ts` — **new** — store/setter tests.
- `apps/arena-client/src/components/ConnectionStatusBanner.test.ts` — **new** — banner render + button-invokes-resync.
- `docs/ai/DECISIONS.md` — **modified** — D-24096.
- Governance ledgers: `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client test` passes (connection/banner/resync tests run).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) passes; `pnpm -r build` exits 0.
- [ ] `Select-String bgioClient.ts "isConnected"` → the read + store write present; `"_stateID\s*="` → no output.
- [ ] `git diff --name-only | Select-String "apps/server|packages/"` → no output.
- [ ] Live-on-surface (D-24026): a mid-match drop shows the banner and the client re-anchors (auto or via the banner) without a full reload; evidence + deploy SHA captured.
- [ ] `docs/ai/STATUS.md`, `WORK_INDEX.md` (WP-311 checked off), `EC_INDEX.md` (EC-340 Done) updated.

## Common Failure Smells
- A frame arrives with `isConnected: false` but the store never updates → the subscribe callback still reads only `state.G`.
- `resync()` assigns `_stateID` or POSTs to the server → wrong primitive; must be `stop()`+`start()`.
- Any diff under `apps/server/**` or `packages/game-engine/**` → scope breach (this is client-only).
- The banner covers/gates the board → it must be non-blocking and never gate moves.
