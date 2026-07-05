# WP-311 — Client Reconnect & Desync Auto-Resync (arena-client)

**Status:** Ready
**Primary Layer:** Client (`apps/arena-client`)
**Dependencies:** WP-090 (Socket.IO transport via `boardgame.io/client` — shipped) · WP-116 (disconnect/reconnect **policy**, D-11601..D-11605 — this WP wires the `reconnect` column of that policy on the client) · WP-309 (durable bgio match store — makes a client resync recover the *real* match state rather than a wiped one).
**User-Visible Surface:** play.legendary-arena.com — a client whose socket drops (or that silently falls behind the server's authoritative state) shows a "reconnecting" banner and automatically re-anchors to the live match instead of freezing.

> This packet implements the **client-side** half of WP-116's `reconnect` policy ("state sync via boardgame.io standard sync"). It is the direct fix for the 2026-07-05 play.legendary-arena.com freeze (match `B66jmk2QyP5`, turn 14): the server stayed up and the match state was durable (WP-309), but the client fell one boardgame.io `_stateID` behind after a transient socket drop and never re-anchored, so every subsequent move was rejected server-side (`ERROR: invalid stateID, was=[N], expected=[N+1]`) and the player was stuck.

---

## Session Context

WP-090 wired the arena-client to the server over Socket.IO via `boardgame.io/client`. `apps/arena-client/src/client/bgioClient.ts` creates the `Client({ game, multiplayer: SocketIO({server}), matchID, playerID, credentials })` and `subscribe()`s to server-pushed frames — but the subscribe callback reads **only `state.G`** and ignores `state.isConnected` (which boardgame.io sets from `transport.isConnected` on every frame, per `ClientState<G> = null | (State<G> & { isConnected: boolean })`). There is **no** connection-status surface, no reconnect UX, and no forced re-sync anywhere in `apps/arena-client`. When the socket blips or the client silently stops receiving frames, boardgame.io only re-anchors `_stateID` on a fresh socket connect (`onSync`); a client that is nominally connected but behind never recovers on its own → the match freezes for that player even though the server (and, post-WP-309, the durable store) is healthy.

WP-116 locked the **policy** (D-11601..D-11605) but produced no code and explicitly deferred wiring to "a future implementation WP that wires reconnect handlers." This is the client half of that wiring, scoped to the resync/recovery path that fixes the observed freeze. The server-side multiplayer machinery (pause-on-drop D-11602, phase-aware grace D-11601, hard-timeout abandonment D-11604, replay-on-abort D-11605) is **deferred** — it is multiplayer-seat policy, not what breaks a solo/duo client that merely lost sync.

---

## Goal

After this session, the arena-client detects and recovers from a lost or stale live-match connection:

- The boardgame.io client's `state.isConnected` is read on every frame and written to a small Pinia **connection store**; the play surface renders a non-blocking **"Connection lost — reconnecting…"** banner while disconnected.
- The `LiveClientHandle` exposes a **`resync()`** primitive that re-establishes the socket and re-anchors the client's `_stateID` to the server's authoritative state via boardgame.io's standard sync (`stop()` then `start()`), so a wedged/behind client can recover **without a full page reload**.
- `resync()` is invoked (a) automatically when a disconnect is followed by a restored transport, and (b) manually from the banner's "Reconnect now" action.

No engine, move, zone-op, snapshot, server, or `G` change. No new state surface in `G`. The client only re-reads the authoritative state boardgame.io already owns.

---

## User-Visible Impact

A player whose connection drops mid-match (Wi-Fi blip, laptop sleep, a server instance recycle like the 2026-07-05 one) previously froze silently: the board stayed on its last frame and clicks did nothing, because the client was one `_stateID` behind and the server rejected every move as stale. After this packet, the client shows it is reconnecting and re-anchors to the live match automatically (or on one banner click), and play resumes. Combined with WP-309 (the match state now survives the restart), the freeze is closed end-to-end: the state is durable **and** the client re-syncs to it.

---

## Assumes

- WP-090 complete: `apps/arena-client/src/client/bgioClient.ts` constructs the live boardgame.io `Client` over `SocketIO({ server })` and `subscribe()`s to state frames. (Verified: the subscribe callback exists and reads `state?.G` only.)
- boardgame.io ^0.50.2 exposes `state.isConnected: boolean` and `state._stateID: number` on the object delivered to `subscribe()` (verified against `dist/types/src/client/client.d.ts`: `ClientState<G> = null | (State<G> & { isConnected: boolean })`), and the `Client` handle exposes `start()` / `stop()`.
- WP-309 shipped: the server's match store is durable, so a resync fetches real live state, not a wiped/new match.
- The arena-client Pinia + component test harness (`apps/arena-client` vitest / vue-tsc) is green on `main`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/arena-client/src/client/bgioClient.ts` — the single runtime engine-import site and the only place the live `Client` is created + subscribed. Read the whole `createLiveClient` + subscribe body; the `state.isConnected` read and the `resync()` primitive land here. Preserve the WP-089 projection contract and the WP-070 pre-plan disruption middleware already in the callback.
- `docs/ai/ARCHITECTURE.md §Disconnect & Reconnect Semantics` + `.claude/rules/architecture.md §Disconnect & Reconnect Posture (Cross-Reference)` — the WP-116 policy this wires. The `reconnect` cell is "Pause is released… State sync via boardgame.io standard sync." This WP makes that client behaviour real; it MUST NOT implement the `disconnect`/`timeout` server-side cells (pause / grace / abandonment).
- `docs/ai/DECISIONS.md` D-11601..D-11606 — the locked policy; this WP cites them and reserves **D-24096** for the client-resync mechanism + the explicit server-side deferral.
- `apps/arena-client/src/stores/uiState.ts` — the Pinia store pattern to mirror for the new connection store (`defineStore`, plain state + setters, no logic).
- The arena-client HUD host (where `createLiveClient` is started and the board is rendered — e.g. `App.vue` / the play view) — the banner mounts here; this is the one same-layer runtime-wiring file (01.5) if the mount point sits outside a pure-new-file allowlist.
- `packages/game-engine` boardgame.io `ClientState` type is not imported by arena-client (it is a `boardgame.io/client` type); do not add an engine or boardgame.io type import beyond the existing `bgioClient.ts` site.

---

## Non-Negotiable Constraints

**Client-layer (always apply):**
- Client submits **intent** only; it never computes outcomes. `resync()` re-reads authoritative state — it never reconstructs or branches game logic.
- No engine / move / zone-op / snapshot / server file modified. No change to `G` or any engine type.
- No new state surface in `G` for connection tracking (WP-116 constraint: disconnect tracking lives in framework/client state, never `G`).
- ESM only, Node v22+; `.test.ts` tests via the arena-client harness; full-sentence errors.
- Determinism: reconnect/resync introduces no non-determinism into match state; it only reads the server's authoritative frame. No `Math.random`, no wall-clock read feeding any move.

**Packet-specific:**
- `resync()` MUST be implemented as boardgame.io's own re-sync path (`stop()` then `start()` on the live client, re-triggering the SocketIO connect → `onSync` handshake). It MUST NOT poke `_stateID`, fabricate frames, or call server endpoints directly.
- The banner is **non-blocking** and **read-only** — it surfaces status and offers a reconnect action; it never mutates match state and never gates moves the engine would otherwise accept.
- The connection store holds framework/transport status only (`isConnected`, last-seen `_stateID`, `hasEverConnected`) — never any `G`/card/zone data.
- **Server-side WP-116 policy is out of scope** (D-11601 grace, D-11602 pause, D-11604 abandonment, D-11605 replay-on-abort, D-11606 spectator). This WP wires the client `reconnect` behaviour only; it MUST NOT add any server pause/timeout/abandonment logic. A `// why:` on the deferral cites D-24096.

**Session protocol:**
- If boardgame.io ^0.50.2 does not surface `isConnected` on the subscribe frame as `ClientState` types claim, STOP and confirm against the installed bundle before inventing a connection signal.

---

## Scope (In)

### A) Surface connection state in the live client
- **`apps/arena-client/src/client/bgioClient.ts`** — modified:
  - In the existing `client.subscribe((state) => …)` callback, read `state?.isConnected` and `state?._stateID` and write them to the new connection store (below), in addition to the existing `state.G` projection write. Preserve the existing projection + pre-plan disruption logic byte-for-byte.
  - Add a **`resync()`** method to the returned `LiveClientHandle`: calls `client.stop()` then `client.start()` (re-establishes the socket → boardgame.io re-sends `onSync` → the client's `_stateID` re-anchors to the server's current state). `// why:` comment citing WP-116 reconnect policy + D-24096.
  - Auto-resync: when a frame reports `isConnected === true` after the store's prior value was `false` (a disconnect→reconnect transition), no manual `resync()` is needed (boardgame.io already re-synced on the reconnect); the store update clears the banner. `resync()` exists for the wedged case where the transport reports connected but the client is behind (banner action).

### B) Connection Pinia store
- **`apps/arena-client/src/stores/connection.ts`** — new: `defineStore('connection', …)` with plain state `{ isConnected: boolean, lastStateId: number | null, hasEverConnected: boolean }` and setters (`setConnected(isConnected, stateId)`). Mirrors the `uiState.ts` store shape (state + setters, no logic). No `G` data.

### C) Reconnect banner
- **`apps/arena-client/src/components/ConnectionStatusBanner.vue`** — new: renders when `hasEverConnected === true && isConnected === false`. Shows "Connection lost — reconnecting…" and a **"Reconnect now"** button that calls the live client's `resync()`. Non-blocking (does not cover the board); dismisses automatically when `isConnected` returns to `true`.

### D) Mount the banner (runtime wiring, 01.5)
- The play surface host (e.g. `apps/arena-client/src/App.vue` or the HUD view that starts `createLiveClient`) — modified: render `<ConnectionStatusBanner>` and pass it the handle's `resync`. This is the one same-layer wiring file; document with a `// why:` citing WP-311 + D-24096.

### E) DECISIONS entry
- **`docs/ai/DECISIONS.md`** — new **D-24096**: the client-resync mechanism (`stop()`+`start()` as the force-resync primitive; why not a manual `_stateID` poke; why the banner is non-blocking/read-only), and the **explicit deferral** of the server-side WP-116 cells (D-11602/11604/11605) to a later WP. Cites WP-116 + WP-309.

### F) Tests
- **`apps/arena-client/src/client/bgioClient.test.ts`** (extend or new) — with the injected test client factory: a frame with `isConnected: false` writes the connection store; `resync()` calls `stop()` then `start()` in order; the projection/pre-plan path is unchanged.
- **`apps/arena-client/src/stores/connection.test.ts`** — new: setter behaviour + `hasEverConnected` latch.
- **`apps/arena-client/src/components/ConnectionStatusBanner.test.ts`** — new: renders only when disconnected-after-first-connect; the button invokes the passed `resync`.

---

## Out of Scope

- **Server-side WP-116 policy** — pause-on-drop (D-11602), phase-aware grace window (D-11601), hard-timeout abandonment + `endReason:'abandoned'` replay (D-11604/D-11605), spectator-on-drop (D-11606). Deferred to a later server-side implementation WP; recorded in D-24096.
- **No engine / move / snapshot / `G` / server change.** No `apps/server` edit.
- **No new npm dependency.** boardgame.io's existing SocketIO transport + its reconnection are reused.
- **No socket.io transport-option tuning** (reconnectionAttempts, heartbeat intervals) — if the zombie-socket detection needs transport-level config, that is a follow-up; this WP relies on boardgame.io's default reconnection + the explicit `resync()`.
- **No change to move-submission semantics** — a rejected stale move is still rejected by the server; this WP gives the client a way to re-anchor, not a way to force a stale move through.

---

## Files Expected to Change

- `apps/arena-client/src/client/bgioClient.ts` — **modified** — read `isConnected`/`_stateID`, add `resync()`.
- `apps/arena-client/src/stores/connection.ts` — **new** — connection Pinia store.
- `apps/arena-client/src/components/ConnectionStatusBanner.vue` — **new** — reconnect banner.
- `apps/arena-client/src/App.vue` (or the HUD play-view host) — **modified** — mount the banner (01.5 wiring).
- `apps/arena-client/src/client/bgioClient.test.ts` — **new/modified** — connection-surfacing + resync tests.
- `apps/arena-client/src/stores/connection.test.ts` — **new** — store tests.
- `apps/arena-client/src/components/ConnectionStatusBanner.test.ts` — **new** — banner tests.
- `docs/ai/DECISIONS.md` — **modified** — D-24096.
- Governance ledgers: `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`.

No other files may be modified.

---

## Acceptance Criteria

### A) Connection surfacing
- [ ] `bgioClient.ts`'s subscribe callback reads `state.isConnected` and writes the connection store on every frame (confirmed by test with the injected factory).
- [ ] The existing `state.G` projection write + WP-070 pre-plan disruption path are unchanged (no regression in `bgioClient` tests).

### B) Resync primitive
- [ ] `LiveClientHandle.resync()` calls `client.stop()` then `client.start()` (order asserted); it pokes no `_stateID` and calls no server endpoint directly.

### C) Banner
- [ ] `ConnectionStatusBanner.vue` renders only when `hasEverConnected && !isConnected`; the "Reconnect now" button invokes the passed `resync`; the banner clears when `isConnected` returns true.

### D) Wiring
- [ ] The banner is mounted on the play surface and receives the live handle's `resync`.

### Reconciliation / Decisions
- [ ] `docs/ai/DECISIONS.md` has D-24096 recording the resync mechanism + the explicit server-side deferral.

### Tests / Build
- [ ] `pnpm --filter @legendary-arena/arena-client test` passes; new tests included.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) passes.
- [ ] `pnpm -r build` exits 0.

### Scope
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`); no `apps/server` / `packages/**` diff.

---

## Verification Steps

```pwsh
# 1 — connection store is written from the subscribe frame
Select-String -Path "apps\arena-client\src\client\bgioClient.ts" -Pattern "isConnected"
# Expected: the read + store write

# 2 — resync uses stop()+start(), not a _stateID poke
Select-String -Path "apps\arena-client\src\client\bgioClient.ts" -Pattern "_stateID\s*="
# Expected: no output (never assigns _stateID)

# 3 — no server / engine edit
git diff --name-only | Select-String "apps/server|packages/"
# Expected: no output

# 4 — arena-client suite + typecheck
pnpm --filter @legendary-arena/arena-client test
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: pass; new connection/banner/resync tests run

# 5 — scope
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

- [ ] **User-visible verification (surface = play.legendary-arena.com):** confirmed **live** after deploy — a mid-match connection drop shows the reconnecting banner and the client re-anchors (via auto-resync or the banner action) so play resumes without a full reload. Evidence captured (observed behaviour + deploy-confirmed SHA). Tests alone do NOT satisfy this (D-24026).
- [ ] All acceptance criteria pass.
- [ ] `pnpm --filter @legendary-arena/arena-client test` + `typecheck` pass; `pnpm -r build` exits 0.
- [ ] No engine/server/`G` file modified (`git diff`).
- [ ] `docs/ai/DECISIONS.md` D-24096 landed (mechanism + server-side deferral).
- [ ] `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md` updated.

---

## Vision Alignment

> §17 triggered: Multiplayer synchronization / reconnection (Vision §4).

- **Vision clauses touched:** §3 (Trust & Fairness), §4 (Multiplayer sync / reconnection), §11 (stateless client — the client re-reads authoritative state, holds no authority). No monetization/scoring/PAR/identity clause touched.
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The client remains a read-only consumer of authoritative state; `resync()` re-reads the engine's truth via boardgame.io's standard sync and never fabricates or forces state. §4 is strictly improved (a dropped client recovers instead of freezing).
- **Non-Goal proximity:** none of NG-1..7 crossed — a reconnect banner + resync is durability/UX infrastructure, no paid surface, no persuasive copy.
- **Determinism preservation:** client-only; no `G`, no move, no `ctx.random.*`, no wall-clock feeding a move. Resync reads the same authoritative frame the server already computed (Vision §22 unaffected).

---

## Lint Gate Self-Review

> Per 01.0a Step 5 / 00.3. Verdict: **PASS.**

- **§1 Structure** — PASS. Goal, Assumes, Context, Scope In, Out of Scope (≥2 exclusions: server-side policy; transport tuning), Files, Constraints, AC, Verification, DoD all present.
- **§2 Constraints** — PASS. Client-layer + packet-specific + session protocol; full-file-contents implied for new files.
- **§3 Assumes** — PASS. WP-090 subscribe site, the verified `ClientState.isConnected` type, WP-309 durability, green client harness.
- **§4 Context** — PASS. bgioClient.ts, the WP-116 policy section + rules mirror, D-11601..06, uiState store pattern, the mount host cited specifically.
- **§5 Files** — PASS. Client code surface = 4 files (bgioClient modify, store, banner, mount) + 3 tests; rest governance. Single layer.
- **§6 Naming** — PASS. `isConnected`, `resync`, `lastStateId`, `hasEverConnected` — full words; no `MatchSetupConfig`/00.2 field touched.
- **§7 Dependency discipline** — PASS. No new npm dependency (reuses boardgame.io transport).
- **§8 Architectural boundaries** — PASS. Client-only; no engine/server import beyond the existing bgioClient site; no `G` state surface (WP-116 constraint honoured); client stays read-only.
- **§9 Windows compat** — PASS. `pwsh` + `Select-String` + `\` paths.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. Reuses the existing match credentials; no auth surface change.
- **§12 Tests** — PASS. Vitest/vue harness; injected client factory (no live server); banner + store + resync covered.
- **§13 Verification** — PASS. `pnpm --filter` + exact `Select-String`, expected output inline.
- **§14 AC** — PASS. Binary, file/symbol-specific, grouped.
- **§15 DoD** — PASS. §15.1: `User-Visible Surface = play.legendary-arena.com`; DoD carries a live-on-surface reconnect verification (D-24026) not satisfiable by tests alone.
- **§16 Code style** — PASS. Small methods, JSDoc, `// why:` on resync + deferral, no premature abstraction.
- **§17 Vision** — PASS. `## Vision Alignment` present; §3/§4/§11/§22 cited; no-conflict + determinism line included.
- **§18 Prose-vs-grep** — PASS. Greps target `isConnected` / `_stateID =` / `apps/server|packages/`; no adjacent prose enumerates forbidden tokens without a cite.
- **§19 Bridge-vs-HEAD** — N/A at lint (commit-time discipline).
- **§20 Funding surface** — N/A. No funding affordance.
- **§21 API Catalog** — N/A. No HTTP endpoint or `apps/server` library function added/changed (client-only).
