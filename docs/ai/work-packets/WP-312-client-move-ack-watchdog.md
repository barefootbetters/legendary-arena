# WP-312 — Client Move-Acknowledgment Watchdog (Desync Auto-Recovery)

**Status:** Ready
**Primary Layer:** Client (`apps/arena-client`)
**Dependencies:** WP-090 (Socket.IO transport) · WP-311 (the `resync()` primitive + `connection` store — this WP reuses both) · WP-309 (durable store — a forced resync recovers real live state) · D-10008 (all engine moves are `client: false` — the invariant that makes `_stateID` a clean server-confirmation signal, see below).
**User-Visible Surface:** play.legendary-arena.com — a match that silently wedges (client one `_stateID` behind the server, moves rejected) now auto-recovers instead of freezing.

> This is the **actual** fix for the recurring play.legendary-arena.com mid-match freeze. WP-309 made the state durable and WP-311 handled *disconnects*, but the freeze is a **connected desync**: the client drops one server `patch`, ends up one `_stateID` behind, the server goes idle and then silently rejects the client's stale moves (`ERROR: invalid stateID, was=[N], expected=[N+1]`) without re-syncing it. `isConnected` never flips (the socket stays alive), so WP-311's banner never shows. Confirmed 2026-07-05 from Render logs (matches `bLCYAwi2tkp`, `B66jmk2QyP5`): continuous `invalid stateID` rejections with **zero** disconnect events during play.

---

## Session Context

boardgame.io's server pushes state as `patch` deltas over socket.io, keyed on the base `_stateID`. socket.io does **not** redeliver messages dropped across a transient/micro reconnect, so a client can miss a single patch and fall one `_stateID` behind. Two framework facts turn that transient miss into a permanent freeze:

1. **The server silently drops stale moves.** In the boardgame.io master, an action whose `stateID` ≠ the store's `_stateID` is logged (`invalid stateID, was=…, expected=…`) and the handler **`return`s — it sends the client nothing** (no correction, no sync).
2. **The recovery fallback needs a *next* patch.** boardgame.io's client re-syncs only when a *subsequent* patch fails to apply. On an idle turn (server waiting for the player), no next patch arrives, so the fallback never fires.

**Why `_stateID` is a reliable signal here (D-10008).** All engine moves are defined `client: false` (`packages/game-engine/src/game.ts`, per D-10008 — `playerView` reshapes `G` to `UIState`, so the client cannot run moves locally). With `client: false`, the client applies **no** optimistic prediction: its `_stateID` advances **only** when the server sends an authoritative frame. Therefore "the player submitted a move but `_stateID` did not advance" reliably means "the server did not accept/acknowledge it" — the exact wedge symptom. This WP uses that signal to auto-recover.

WP-311 shipped `LiveClientHandle.resync()` (= `client.stop()` + `client.start()`, re-running the SocketIO connect → server `onSync` → `_stateID` re-anchor) and a `connection` Pinia store tracking `lastStateId`. This WP adds the missing trigger: a watchdog that fires `resync()` when a submitted move is not acknowledged in time.

---

## Goal

After this session, `apps/arena-client` auto-recovers a wedged live match:

- When the player submits a move via `createLiveClient(...).submitMove(...)`, the client records the current `_stateID` and arms a **move-acknowledgment watchdog**.
- If a server frame advances `_stateID` before the timeout, the move was acknowledged and the watchdog is cleared (the normal path; a rapid-click race self-heals well under the timeout).
- If the timeout elapses with **no** `_stateID` advance, the move was dropped/rejected (the wedge) → the client calls `resync()` to re-anchor to the server's authoritative state, and the player can act again — **no banner click, no page reload**.
- A short cooldown prevents resync thrash if the player keeps acting while genuinely stuck.

Client-only. No engine/move/`G`/server change; no new state surface in `G`; no new dependency. The watchdog re-reads authoritative state via boardgame.io's own sync — it never fabricates state or forces a stale move through.

---

## User-Visible Impact

A player mid-match previously froze permanently when the client dropped one server update: the board stopped responding and every click was silently rejected server-side, with no banner and no recovery. After this packet, an unacknowledged move triggers an automatic re-sync within a few seconds and play resumes. Together with WP-309 (durable state) and WP-311 (`resync()` + connection surface), the mid-match freeze is closed: the server holds the truth, and the client now detects when it has fallen behind and snaps back to it.

---

## Assumes

- WP-311 shipped: `apps/arena-client/src/client/bgioClient.ts` exposes `LiveClientHandle.resync()` (`stop()`+`start()`) and the subscribe callback writes `state.isConnected`/`_stateID` to the `connection` store. (Verified on `main` @ WP-311 merge.)
- All engine moves are `client: false` (D-10008), so `_stateID` advances only on server-authoritative frames — the premise the watchdog depends on. If a future WP re-enables client prediction for any move, this watchdog's signal weakens and must be revisited.
- boardgame.io ^0.50.2 delivers `_stateID` on the subscribe frame (verified in WP-311).
- WP-309 durable store is live (a resync fetches real live state).
- `apps/arena-client` `test` + `typecheck` (vue-tsc) are green on `main`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/arena-client/src/client/bgioClient.ts` — `createLiveClient`: the subscribe callback (where `_stateID` is read) and the `submitMove` / `resync` handle methods. The watchdog state + timer live here, in the factory closure. Preserve the WP-089 projection write, the WP-070 pre-plan middleware, and the WP-311 connection-store write byte-for-byte.
- `apps/arena-client/src/stores/connection.ts` — already tracks `lastStateId`; the watchdog may read it or track `_stateID` locally in the closure (prefer the local closure value to avoid a store round-trip on every frame).
- `packages/game-engine/src/game.ts` (moves block, ~line 308) — read the `client: false` definitions + the D-10008 rationale comment; this is the invariant the watchdog relies on. **Do not modify it** — this WP is client-only.
- `docs/ai/DECISIONS.md` D-10008 (client:false), D-24096 (WP-311 resync mechanism) — cited by this WP; reserves **D-24097**.
- boardgame.io master stale-move handling (`invalid stateID` → `return`, no client notification) and the patch/sync fallback — the framework behavior this works around. (Do not modify the framework.)

---

## Non-Negotiable Constraints

**Client-layer (always apply):**
- Client submits **intent** only; the watchdog re-reads authoritative state via `resync()`, never reconstructs game logic, never forces a stale move through, never pokes `_stateID`.
- No engine / move / zone-op / snapshot / server file modified. No `G` change; no new state surface in `G`.
- ESM only, Node v22+; `.test.ts` tests via the arena-client harness; full-sentence errors.
- No `Math.random` / wall-clock feeding any **move** (the watchdog's `setTimeout` is client transport UX, not a move — permitted; determinism of match state is unaffected).

**Packet-specific:**
- The watchdog arms **only** after a real move is dispatched (`client.moves[name]` is a function and was called) — never for an unknown/no-op move name.
- Recovery MUST be `resync()` (WP-311's `stop()`+`start()` re-anchor). The watchdog MUST NOT fabricate a frame, assign `_stateID`, resubmit the stale move, or call a server endpoint directly.
- A cooldown MUST bound auto-resyncs so a persistently-stuck client (or button-mashing during a real outage) cannot trigger a resync storm.
- Timers MUST be cleared on `stop()` (handle teardown) so no timer outlives the client (mirrors the WP-262 interval-cleanup discipline).
- **`_stateID`-as-ack depends on D-10008 (`client: false`).** This WP does not change that invariant and must not be read as permitting client-side prediction.

**Session protocol:**
- If, at execution, `_stateID` is found to advance without a server frame (i.e., client prediction is somehow active despite D-10008), STOP — the watchdog's premise is invalid and the approach must be reconsidered before coding.

---

## Scope (In)

### A) Move-acknowledgment watchdog in the live client
- **`apps/arena-client/src/client/bgioClient.ts`** — modified, inside `createLiveClient`:
  - Track in the factory closure: `latestStateId: number | null` (updated in the existing subscribe callback alongside the connection-store write), `pendingBaselineStateId: number | null`, a watchdog `setTimeout` handle, and a `resyncCoolingDown` flag with its own cooldown-timer handle.
  - **Arm** (in `submitMove`, only after a real `move(...)` dispatch, and only when not cooling down): set `pendingBaselineStateId = latestStateId`; (re)arm the watchdog timer for `MOVE_ACK_TIMEOUT_MS`.
  - **Acknowledge** (in the subscribe callback, after updating `latestStateId`): if `pendingBaselineStateId !== null` and `latestStateId` has advanced past it, clear the watchdog (move landed / client re-anchored).
  - **Fire** (on watchdog timeout, still unacknowledged): call `resync()`; clear pending; start the cooldown (`resyncCoolingDown = true` for `RESYNC_COOLDOWN_MS`, then clear).
  - **Teardown** (in the handle's `stop()`): clear the watchdog + cooldown timers.
  - Export `MOVE_ACK_TIMEOUT_MS` and `RESYNC_COOLDOWN_MS` as named constants (so tests reference the locked values; `// why:` on each value's rationale).

### B) DECISIONS entry
- **`docs/ai/DECISIONS.md`** — new **D-24097**: the watchdog mechanism (`_stateID`-not-advancing-after-a-move ⇒ `resync()`), the locked timeout + cooldown values and their rationale, the dependency on D-10008 (`client: false`) as the enabling invariant, and why the recovery is `resync()` not a resubmit/poke. Cites WP-311 (D-24096) + WP-309.

### C) Tests
- **`apps/arena-client/src/client/bgioClient.test.ts`** — modified, using `node:test` mock timers (`mock.timers`) + the existing stub client factory:
  - submit a move, advance `_stateID` via a server frame before the timeout → `resync` (stop+start) is **not** triggered.
  - submit a move, tick past `MOVE_ACK_TIMEOUT_MS` with **no** `_stateID` advance → `resync` **is** triggered (the stub records the `stop()`→`start()` re-anchor).
  - after a fire, a second stuck move within `RESYNC_COOLDOWN_MS` does **not** trigger a second resync (cooldown holds).
  - an unknown/no-op move name does not arm the watchdog (no resync on timeout).

---

## Out of Scope

- **No engine / move / `G` / server change.** Does not touch `game.ts`, `client: false`, or any move.
- **No banner/UX change** — WP-311's banner (for genuine disconnects) is unchanged; this WP is silent auto-recovery for the connected-desync case.
- **No resubmission of the dropped move.** The watchdog re-anchors state; it does not replay the player's lost click (the player re-acts after recovery). Auto-replay of the lost intent is a possible future refinement, explicitly deferred.
- **No server-side change** — the boardgame.io master's silent-reject-on-stale behavior is framework-internal and not modified (per the WP-308 no-framework-patch precedent).
- **No socket.io transport-option tuning** (reconnection/redelivery) — a possible complementary hardening, deferred.
- **No new npm dependency.**

---

## Files Expected to Change

- `apps/arena-client/src/client/bgioClient.ts` — **modified** — the move-ack watchdog + locked constants.
- `apps/arena-client/src/client/bgioClient.test.ts` — **modified** — watchdog tests (mock timers).
- `docs/ai/DECISIONS.md` — **modified** — D-24097.
- Governance ledgers: `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`.

No other files may be modified.

---

## Acceptance Criteria

### A) Watchdog behavior
- [ ] A submitted move whose `_stateID` advances (server frame) before `MOVE_ACK_TIMEOUT_MS` does NOT trigger `resync()`.
- [ ] A submitted move with no `_stateID` advance within `MOVE_ACK_TIMEOUT_MS` triggers exactly one `resync()` (stub records `stop()` then `start()`).
- [ ] A second stuck move within `RESYNC_COOLDOWN_MS` of a fire does NOT trigger a second `resync()`.
- [ ] An unknown/no-op move name does not arm the watchdog (no `resync()` on timeout).
- [ ] The watchdog + cooldown timers are cleared on `handle.stop()` (no timer outlives the client).

### B) Recovery primitive
- [ ] Recovery is `resync()` only — no `_stateID` assignment, no stale-move resubmit, no direct server call (confirmed by `Select-String`).

### Reconciliation / Decisions
- [ ] `docs/ai/DECISIONS.md` has D-24097 (mechanism + locked timeout/cooldown values + D-10008 dependency).

### Tests / Build
- [ ] `pnpm --filter @legendary-arena/arena-client test` passes (watchdog tests included, using mock timers).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) passes.
- [ ] `pnpm -r build` exits 0.

### Scope
- [ ] No files outside `## Files Expected to Change` modified; no `apps/server` / `packages/**` diff.

---

## Verification Steps

```pwsh
# 1 — the watchdog recovers via resync(), never by poking _stateID or resubmitting
Select-String -Path "apps\arena-client\src\client\bgioClient.ts" -Pattern "_stateID\s*=[^=]"
# Expected: no output (never assigns _stateID)

# 2 — locked constants exist
Select-String -Path "apps\arena-client\src\client\bgioClient.ts" -Pattern "MOVE_ACK_TIMEOUT_MS|RESYNC_COOLDOWN_MS"
# Expected: the const declarations + uses

# 3 — no server / engine edit
git diff --name-only | Select-String "apps/server|packages/"
# Expected: no output

# 4 — arena-client suite + typecheck
pnpm --filter @legendary-arena/arena-client test
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: pass; watchdog tests run

# 5 — scope
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

- [ ] **User-visible verification (surface = play.legendary-arena.com):** confirmed **live** after deploy — a mid-match wedge (client one `_stateID` behind; a move that does nothing) auto-recovers within ~`MOVE_ACK_TIMEOUT_MS` and play resumes, without a banner click or page reload. Evidence captured (observed behaviour + deploy-confirmed SHA; ideally the Render log showing the `invalid stateID` rejection followed by recovery). Tests alone do NOT satisfy this (D-24026).
- [ ] All acceptance criteria pass.
- [ ] `pnpm --filter @legendary-arena/arena-client test` + `typecheck` pass; `pnpm -r build` exits 0.
- [ ] No engine/server/`G` file modified (`git diff`).
- [ ] `docs/ai/DECISIONS.md` D-24097 landed.
- [ ] `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md` updated.

---

## Vision Alignment

> §17 triggered: Multiplayer synchronization / reconnection (Vision §4).

- **Vision clauses touched:** §3 (Trust & Fairness), §4 (Multiplayer sync / reconnection), §11 (stateless client — re-reads authoritative state, holds no authority). No monetization/scoring/PAR/identity clause touched.
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The client stays a read-only consumer; the watchdog's recovery is boardgame.io's own authoritative re-sync. §4 is strictly improved (a wedged match recovers instead of freezing).
- **Non-Goal proximity:** none of NG-1..7 crossed — reliability infrastructure, no paid surface, no persuasive copy.
- **Determinism preservation:** client-only; no `G`, no move, no `ctx.random.*`. `_stateID`-as-ack relies on D-10008 (`client: false`), which is unchanged. The watchdog's `setTimeout` is client UX, not a move — match-state determinism (Vision §22) is unaffected.

---

## Lint Gate Self-Review

> Per 01.0a Step 5 / 00.3. Verdict: **PASS.**

- **§1 Structure** — PASS. Goal, Assumes, Context, Scope In, Out of Scope (≥2 exclusions: no resubmit; no server/framework change), Files, Constraints, AC, Verification, DoD present.
- **§2 Constraints** — PASS. Client-layer + packet-specific + session protocol; arms-only-on-real-dispatch, resync-only recovery, cooldown, timer teardown, D-10008 dependency called out.
- **§3 Assumes** — PASS. WP-311 primitives, the D-10008 `client:false` premise (with the "if prediction re-enabled, revisit" caveat), `_stateID` on the frame, WP-309 durability, green harness.
- **§4 Context** — PASS. bgioClient.ts, connection store, game.ts moves block (read-only), D-10008/D-24096, the framework stale-move behavior cited specifically.
- **§5 Files** — PASS. Code surface = bgioClient.ts + its test (2 files) + DECISIONS + governance. Single layer; additive.
- **§6 Naming** — PASS. `MOVE_ACK_TIMEOUT_MS`, `RESYNC_COOLDOWN_MS`, `pendingBaselineStateId`, `latestStateId` — full words; no 00.2 field touched.
- **§7 Dependency discipline** — PASS. No new npm dependency.
- **§8 Architectural boundaries** — PASS. Client-only; no engine/server import; no `G` state surface; client stays read-only; recovery via the framework's own sync.
- **§9 Windows compat** — PASS. `pwsh` + `Select-String` + `\` paths.
- **§10 Env vars** — N/A. None.
- **§11 Auth** — N/A. Reuses existing credentials; no auth surface.
- **§12 Tests** — PASS. `node:test` mock timers + the existing stub factory; the four watchdog behaviors covered without a live server.
- **§13 Verification** — PASS. `pnpm --filter` + exact `Select-String` (including the `_stateID\s*=[^=]` assignment-only pattern that avoids the comparison self-trip), expected output inline.
- **§14 AC** — PASS. Binary, symbol-specific, grouped.
- **§15 DoD** — PASS. §15.1: `User-Visible Surface = play.legendary-arena.com`; DoD carries a live-on-surface wedge-recovery verification (D-24026) not satisfiable by tests alone.
- **§16 Code style** — PASS. Small helpers, JSDoc, `// why:` on constants + resync, no premature abstraction; explicit `for`/guards, no `.reduce()`.
- **§17 Vision** — PASS. `## Vision Alignment` present; §3/§4/§11/§22 cited; no-conflict + determinism line included.
- **§18 Prose-vs-grep** — PASS. Greps target `_stateID\s*=[^=]` (assignment only, not the comparison), the two constants, and `apps/server|packages/`; no adjacent prose enumerates forbidden tokens without a cite.
- **§19 Bridge-vs-HEAD** — N/A at lint (commit-time discipline).
- **§20 Funding surface** — N/A. No funding affordance.
- **§21 API Catalog** — N/A. No HTTP endpoint or `apps/server` library function touched (client-only).
