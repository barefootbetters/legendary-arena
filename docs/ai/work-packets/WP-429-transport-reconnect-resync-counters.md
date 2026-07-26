# WP-429 — Reconnect / Resync Counters in the Transport Diagnostics Block

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`) — single runtime layer; **zero engine / determinism / persistence footprint** (the counters are framework/client recovery state per the WP-116 disconnect policy — they carry no `G` / card / zone data and are never persisted).
**Dependencies:** WP-428 / D-24249 (the `transport` block this extends), WP-311 / D-24096 (the `connection` store the counters live in), WP-312 / D-24097 (the move-acknowledgment watchdog), D-24232 (the reconnect-resync), and the spectator-staleness watchdog — the four auto-recovery paths in `bgioClient.ts` this instruments. All landed on `main`.
**User-Visible Surface:** none — internal operator tooling (the report is downloaded by an operator diagnosing a freeze; nothing on `play.legendary-arena.com` changes visually).

> Baseline: `origin/main` at commit `43a5fcf8` (WP-428 transport block merged, PR #1020). Re-baseline to current `origin/main` at execution.

---

## Goal

After this session, the WP-428 `transport` block carries **four recovery
counters** so a downloaded freeze report names how often the client silently
auto-recovered before the operator hit export — the "the client resynced 3 times
and is still stuck" signal the current block cannot show. The `bgioClient.ts`
transport wrapper already runs four auto-recovery paths (a transport-reconnect
resync, a move-ack-timeout resync, a spectator-staleness resync, and a tab-focus
resync); each increments a dedicated counter on the WP-311 `connection` store when
it actually fires, and `buildTransportDiagnostics` surfaces the four counts into
the `transport` block. This is the follow-up WP-428 deliberately deferred: it
**does** touch `bgioClient.ts` (four one-line increment calls at the existing
recovery sites), which is exactly why it is its own standard two-session WP rather
than folded into WP-428. No new recovery behavior, no engine change, no new
dependency.

---

## User-Visible Impact

None on the game surface — operator-facing diagnostics. The operational impact: a
freeze report distinguishes "the client never tried to recover" (all counters `0`
— a pure logical wedge) from "the client fought to recover and lost" (non-zero
counters — a transport/desync wedge that survived the auto-recovery machinery).
Paired with WP-428's `timeSinceLastFrameMs`, this turns the most common live freeze
class into a two-number read: how stale the connection is, and how many times the
client already auto-resynced trying to fix it.

---

## Assumes

- `apps/arena-client/src/diagnostics/diagnostics.ts` (WP-428 / D-24249) exports the
  `TransportDiagnostics` interface and the pure `buildTransportDiagnostics(state,
  capturedAtMs)` helper, which copies the `connection`-store fields into the block.
  The four counters are additive fields on both.
- `apps/arena-client/src/stores/connection.ts` (WP-311 / WP-428) is a Pinia Options
  store; WP-428 added `lastFrameAtMs` + a `setConnected(…, atMs)` action. The
  counters are additive state fields with dedicated increment actions.
- `apps/arena-client/src/client/bgioClient.ts` runs the four auto-recovery paths as
  named functions — `onTransportReconnect` (the D-24232 reconnect-resync),
  `onWatchdogFire` (the WP-312 move-ack timeout), the spectator-staleness timer fire
  (armed in `updateSpectatorWatchdog`, fires `forceCooldownGatedResync`), and
  `onVisibilityChange` (the tab-focus resync) — and already imports
  `useConnectionStore`. Each is the single instrumentation site for its counter.
- `buildTransportDiagnostics` reads the store structurally (a `state` object
  parameter), so widening its type to include the counters needs no store import in
  `diagnostics.ts` (the EC-260 boundary holds).
- `DiagnosticExportButton.vue` passes `useConnectionStore()` into
  `buildTransportDiagnostics`; the store already carries the new counter fields, so
  the exporter needs **no** change.
- The `connection` store is framework/transport state, never game state (WP-116):
  it carries no `G`/card/zone data and is never persisted. Counting recovery events
  introduces no persistence or determinism surface.
- `apps/arena-client` uses Vue 3 + `node:test`; `bgioClient.test.ts` injects a
  structural `BgioClientLike` stub, so the recovery paths are drivable in a test
  without the real boardgame.io runtime.
- `pnpm -r build` exits 0; the arena-client suite + `typecheck` (vue-tsc) pass on
  the baseline.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `apps/arena-client/src/client/bgioClient.ts` — the transport wrapper: the four
  recovery functions (`onTransportReconnect`, `onWatchdogFire`, the spectator
  timer fire, `onVisibilityChange`) are the instrumentation sites; it already
  imports `useConnectionStore`.
- `apps/arena-client/src/stores/connection.ts` — where the four counter fields +
  increment actions are added (beside WP-428's `lastFrameAtMs`).
- `apps/arena-client/src/diagnostics/diagnostics.ts` — the `TransportDiagnostics`
  interface + `buildTransportDiagnostics` to extend with the four counts.
- `apps/arena-client/src/diagnostics/diagnostics.test.ts` — the `sampleContext`
  helper's `transport` default (extend with the counters) + the builder cases.
- `apps/arena-client/src/stores/connection.test.ts` — the store test to extend for
  the increment actions.
- `apps/arena-client/src/client/bgioClient.test.ts` — the transport-wrapper test to
  extend: drive each recovery path and assert its counter increments.
- `docs/ai/DECISIONS.md` — **D-24249** (the transport block), **D-24096** (the
  connection store), **D-24097** (the move-ack watchdog), **D-24232** (the
  reconnect-resync), and the reserved **D-24250** at the tail of this WP.
- `wiki/play-diagnostics.md` — the ewiki page; its Transport-block Mechanics
  subsection + Edge Cases note the counters as a "not-yet-surfaced follow-up" — this
  WP flips that to the shipped state at execution.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Provide the **full file contents** for every new or modified file. **No** diffs, **no** snippets, **no** "show only the changed section."
- ESM only; Node v22+; Vue 3 SFCs; test files `*.test.ts` (`node:test`, no `boardgame.io/testing`).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- The diagnostics module stays **boundary-clean** (EC-260 / D-22801):
  `diagnostics.ts` imports NOTHING from `packages/game-engine`, `packages/registry`,
  `packages/preplan`, `apps/server`, `pg`, or `boardgame.io`. `bgioClient.ts` is the
  one runtime engine-import site (WP-090) and already imports `useConnectionStore` —
  adding increment calls introduces no new import class.
- **Counters are framework/client state, never game state.** They live on the
  WP-311 `connection` store; the WP does **not** read/write `G`/`ctx`, add a
  persistence surface, or touch any `finalStateHash` sentinel.
- **Instrument, do not re-architect the recovery machinery.** Each counter increments
  once, **past its path's cooldown gate**. Two paths (`onTransportReconnect`,
  `onWatchdogFire`) take a single increment in their own body. The other two share the
  gated helper `forceCooldownGatedResync`, which gains a `cause: 'spectator' |
  'tabFocus'` parameter so its single past-gate increment routes to the right counter
  — the **only** change to that helper (its resync/cooldown behavior is unchanged; it
  gains a parameter, not new logic). Do **not** change `MOVE_ACK_TIMEOUT_MS`,
  `RESYNC_COOLDOWN_MS`, `SPECTATOR_STALE_TIMEOUT_MS`, the cooldown *timing/gate
  condition*, the watchdog arming, or `performResync` behavior. The recovery paths
  behave identically; they just also count.
- **Count the four auto paths only.** `reconnectResyncCount` (`onTransportReconnect`),
  `moveAckResyncCount` (`onWatchdogFire`), `spectatorStaleResyncCount` (the spectator
  timer fire), `tabFocusResyncCount` (`onVisibilityChange` resync). The WP-311
  **manual** banner `resync()` is NOT counted (it is operator-initiated, not a
  silent auto-recovery — out of scope).
- **Increment on the actual resync, not the suppressed trigger.** A cooldown-gated
  path that returns early WITHOUT resyncing does not increment (the counter measures
  recoveries that fired, not triggers that were suppressed).
- **The exporter is unchanged.** `DiagnosticExportButton.vue` already passes the
  store into `buildTransportDiagnostics`; the new fields ride along. If the `.vue`
  appears in the diff, STOP — the counters flow through the store, not a new collect
  call.
- **No new dependency.**

**Session protocol:** if any contract or field name is unclear, stop and ask.

**Locked contract values (do not re-derive):**
- **Four counters (store fields, `number`, initial `0`):** `reconnectResyncCount`, `moveAckResyncCount`, `spectatorStaleResyncCount`, `tabFocusResyncCount`.
- **Four increment actions (one per counter), each `+= 1`:** `recordReconnectResync()`, `recordMoveAckResync()`, `recordSpectatorStaleResync()`, `recordTabFocusResync()`.
- **Instrumentation sites (each past its path's cooldown gate):** `onTransportReconnect` → `recordReconnectResync` (own body, past its inline gate); `onWatchdogFire` → `recordMoveAckResync` (own body; gated upstream in `armWatchdog`); and a new `cause: 'spectator' | 'tabFocus'` parameter on `forceCooldownGatedResync` routing a single past-gate increment → `recordSpectatorStaleResync` (spectator timer arms `forceCooldownGatedResync('spectator')`) / `recordTabFocusResync` (`onVisibilityChange` calls `forceCooldownGatedResync('tabFocus')`).
- **`TransportDiagnostics` gains the four `number` fields;** `buildTransportDiagnostics` copies them from `state` verbatim (no derivation).
- **No recovery-behavior change** — no timing-constant / cooldown-gate-condition / watchdog-arming / `performResync` edit; the ONLY `bgioClient.ts` structural change beyond the four increments is the `cause` parameter on `forceCooldownGatedResync`. No exporter change; no new dependency.
- **Reserved decision:** **D-24250** (the recovery counters; land Active at execution).

---

## Scope (In)

### A) Counter state + increment actions (`apps/arena-client/src/stores/connection.ts`, **modified**)
- Add four `number` state fields (initial `0`): `reconnectResyncCount`,
  `moveAckResyncCount`, `spectatorStaleResyncCount`, `tabFocusResyncCount`.
- Add four increment actions, each `this.<field> += 1`:
  `recordReconnectResync()`, `recordMoveAckResync()`,
  `recordSpectatorStaleResync()`, `recordTabFocusResync()`. Update the store JSDoc.

### B) Instrument the recovery paths (`apps/arena-client/src/client/bgioClient.ts`, **modified**)

**Two paths resync unconditionally in their own body** (their cooldown gate lives
elsewhere), so each takes a single increment call, past that gate and cause-specific:
- `onTransportReconnect` — `recordReconnectResync()` past its **own inline**
  `resyncCoolingDown` gate, beside `beginResyncCooldown()`.
- `onWatchdogFire` — `recordMoveAckResync()` (it calls `performResync()`
  unconditionally; the gate is upstream in `armWatchdog`).

**Two paths — the spectator-staleness timer fire and the tab-focus resync — share
the gated helper `forceCooldownGatedResync`** (whose `resyncCoolingDown` gate is at
the top). Incrementing at the *call site* would count cooldown-suppressed triggers;
incrementing *inside the shared helper* without knowing the cause would conflate the
two counters. Resolve both by adding a `cause: 'spectator' | 'tabFocus'` parameter to
`forceCooldownGatedResync` and, **past its cooldown gate**, incrementing the matching
counter (`recordSpectatorStaleResync` / `recordTabFocusResync`). The spectator timer
arms `forceCooldownGatedResync('spectator')`; `onVisibilityChange` calls
`forceCooldownGatedResync('tabFocus')`. This is the **only** change to the helper —
its resync + cooldown behavior is unchanged; it gains a parameter and a cause-routed
increment past the existing gate, so each counter still counts only actual resyncs.

A `// why:` at each increment notes it is a client-diagnostic recovery tally; no
timing constant / cooldown / `performResync` behavior changes.

### C) Surface the counters in the block (`apps/arena-client/src/diagnostics/diagnostics.ts`, **modified**)
- Extend `TransportDiagnostics` with the four `number` fields.
- Widen `buildTransportDiagnostics`'s `state` parameter to include them and copy
  each into the returned block verbatim (no derivation).

### D) Tests (`connection.test.ts` + `diagnostics.test.ts` + `bgioClient.test.ts`, **modified**)
- `connection.test.ts`: each counter starts `0`; each `record*` action increments
  its field by one and leaves the others untouched.
- `diagnostics.test.ts`: extend the `sampleContext` `transport` default with the four
  counters; assert `buildTransportDiagnostics` copies them into the block and they
  round-trip through the serialized report.
- `bgioClient.test.ts`: drive each of the four recovery paths through the structural
  client stub and assert the matching counter incremented (and a cooldown-suppressed
  path does not).

---

## Out of Scope

- **Any change to the recovery behavior** — no edit to `MOVE_ACK_TIMEOUT_MS`,
  `RESYNC_COOLDOWN_MS`, `SPECTATOR_STALE_TIMEOUT_MS`, the cooldown gating, the
  watchdog arming, `performResync`, or the reconnect/spectator/tab-focus logic. The
  paths behave identically; they only also count.
- **The manual WP-311 banner `resync()`** — operator-initiated, not a silent
  auto-recovery; not counted.
- **Any exporter change** (`DiagnosticExportButton.vue`) — the counters ride the
  store the exporter already reads.
- **Performance / memory capture, a transition log, buffer-durability, raw frame
  capture, server-side correlation** — separate WPs.
- **Any engine change** — no `G` field, no `UIState` field, no persistence, no
  `finalStateHash` re-pin.
- Refactors not listed in Scope (In).

---

## Files Expected to Change

**Arena-client runtime + tests (App layer):**
- `apps/arena-client/src/stores/connection.ts` — **modified** — four counter fields + four increment actions
- `apps/arena-client/src/client/bgioClient.ts` — **modified** — a past-gate increment for each of the four recovery paths: single calls in `onTransportReconnect` / `onWatchdogFire`, plus a `cause: 'spectator' | 'tabFocus'` parameter on `forceCooldownGatedResync` routing the spectator/tab-focus increments past its cooldown gate. No timing-constant / cooldown-gate-condition / `performResync` change.
- `apps/arena-client/src/diagnostics/diagnostics.ts` — **modified** — four counter fields on `TransportDiagnostics` + `buildTransportDiagnostics` state param + verbatim copy
- `apps/arena-client/src/stores/connection.test.ts` — **modified** — counter init + increment-action cases
- `apps/arena-client/src/diagnostics/diagnostics.test.ts` — **modified** — `sampleContext` transport default extended; builder carries + round-trips the counters
- `apps/arena-client/src/client/bgioClient.test.ts` — **modified** — each recovery path increments its counter; a cooldown-suppressed path does not

`apps/arena-client/src/components/DiagnosticExportButton.vue` is **NOT** in scope
(the counters ride the store it already reads). No `packages/**` or
`apps/server/**` file may be modified. This WP declares **no** `01.5`
runtime-wiring file — `bgioClient.ts` is an existing runtime module whose recovery
sites this instruments (not a new wiring host).

---

## Contract

- `TransportDiagnostics` gains `reconnectResyncCount`, `moveAckResyncCount`,
  `spectatorStaleResyncCount`, `tabFocusResyncCount` — all `number`.
- `connection` store gains the same four `number` fields (initial `0`) + four
  increment actions (`recordReconnectResync` / `recordMoveAckResync` /
  `recordSpectatorStaleResync` / `recordTabFocusResync`), each `+= 1`.
- `buildTransportDiagnostics(state, capturedAtMs)` copies the four counters from
  `state` verbatim (no derivation); the builder + exporter are otherwise unchanged.
- Each counter counts **actual** auto-resyncs fired by its path (past the cooldown
  gate), never the manual banner resync and never a cooldown-suppressed trigger.

---

## Vision Alignment

N/A on the §17.1 trigger surfaces: no scoring/PAR/leaderboards, no identity, no
card-data/content-semantics change, no RNG. **Multiplayer-sync note:** the WP
**counts** existing auto-recovery events into an operator report; it does **not**
change reconnect/resync/watchdog behavior — every threshold, cooldown, and trigger
is untouched, so sync semantics are identical. **Monetization note (NG-1..7):**
internal diagnostics, no revenue vector. **Determinism note (§22):** pure client
presentation — the counters live on the framework/transport `connection` store
(never `G`), the WP writes no `G`/`ctx`, adds zero engine/determinism/replay
footprint (sims/replays instantiate no client transport), and touches no
`finalStateHash` sentinel. NG-1..7 preserved.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy is added or proposed
(client diagnostic counters + a store field only).

## API Catalog

N/A — no HTTP endpoint and no `apps/server/src/**` `Library-only` function; the
report is assembled client-side and downloaded locally with zero network egress.

---

## Acceptance Criteria

All items are binary pass/fail.

- [ ] `TransportDiagnostics` carries the four `number` counters
      (`reconnectResyncCount`, `moveAckResyncCount`, `spectatorStaleResyncCount`,
      `tabFocusResyncCount`).
- [ ] The `connection` store exposes the four `number` fields (initial `0`) and the
      four increment actions, each incrementing only its own field by one.
- [ ] Each of the four `bgioClient.ts` recovery paths increments its matching
      counter when it fires a resync; a cooldown-suppressed trigger does not
      increment; no timing / cooldown / threshold / `performResync` behavior
      changed.
- [ ] `buildTransportDiagnostics` copies the four counters into the block verbatim;
      a round-trip `JSON.parse` of the serialized report deep-equals them.
- [ ] `DiagnosticExportButton.vue` is **not** modified (`git diff --name-only`);
      the counters reach the report via the store it already reads.
- [ ] The layer writes no `G`/`ctx` and adds no engine/determinism footprint
      (App-only runtime diff; no `packages/game-engine/**` file; no `finalStateHash`
      sentinel touched); no new dependency.
- [ ] `pnpm --filter arena-client typecheck` (vue-tsc) exits 0;
      `pnpm --filter arena-client test` passes; `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build everything
pnpm -r build
# Expected: exits 0

# Step 2 — arena-client typecheck + tests
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: both exit 0 / all pass (the connection/diagnostics/bgioClient suites
# gain the counter cases).

# Step 3 — the four counters exist, wired at the four recovery sites
Select-String -Path "apps\arena-client\src\client\bgioClient.ts" -Pattern "recordReconnectResync|recordMoveAckResync|recordSpectatorStaleResync|recordTabFocusResync"
# Expected: one increment call at each recovery site.

# Step 4 — no timing/threshold edit, exporter untouched, no engine footprint
git diff --name-only
# Expected: only apps/arena-client/src/stores/connection.{ts,test.ts},
# apps/arena-client/src/client/bgioClient.{ts,test.ts},
# apps/arena-client/src/diagnostics/diagnostics.{ts,test.ts} (+ governance).
# NO DiagnosticExportButton.vue, NO packages/game-engine/** file.
git diff apps/arena-client/src/client/bgioClient.ts | Select-String "MOVE_ACK_TIMEOUT_MS|RESYNC_COOLDOWN_MS|SPECTATOR_STALE_TIMEOUT_MS"
# Expected: no diff hunk touches the timing constants.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0;
      arena-client suite passes.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated — the transport block now carries the four
      recovery counters.
- [ ] `docs/ai/DECISIONS.md` updated — land **D-24250** as Active (the recovery
      counters).
- [ ] `wiki/play-diagnostics.md` — the Transport-block Mechanics subsection + the
      Edge Case are updated so the counters read as shipped (not a "not-yet-surfaced
      follow-up"); `pnpm wiki-viewer:check-links` clean.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-429 checked off with the date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-464 flipped to `Done`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-429 node glyph `📝 → ✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

> **User-Visible Surface = none (internal tooling).** No D-24026 live-on-surface
> gate applies. The execution session verifies the counters by downloading a
> diagnostic report after driving (or simulating) a reconnect/resync in a
> local/dev session and confirming the counts reflect the recovery activity.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`:

- **§1 Structure** — PASS. All required sections present; `Out of Scope` lists ≥2 excluded items (recovery-behavior change, manual resync, exporter change, perf/transition/buffer follow-ups, engine change).
- **§2 Constraints** — PASS. Engine-wide + packet-specific (boundary-clean, counters-not-game-state, instrument-don't-rearchitect, four-auto-paths-only, increment-on-actual-resync, exporter-unchanged, no new dep) + session protocol + locked values.
- **§3 Assumes** — PASS. The WP-428 block + helper, the WP-311 store, the four named `bgioClient` recovery functions, the structural helper `state` param, the unchanged exporter, the WP-116 framing, and a green baseline. Each cites its source.
- **§4 Context (Read First)** — PASS. Specific files (bgioClient.ts recovery sites, connection.ts, diagnostics.ts, the three test files) + D-24249/D-24096/D-24097/D-24232 + the ewiki page. No `00.2` reference: no card-data / setup-field change.
- **§5 Files** — PASS. 6 content files (3 runtime + 3 tests), bounded, no `01.5` wiring file; each marked modified with a one-line description; `DiagnosticExportButton.vue` explicitly excluded.
- **§6 Naming** — PASS. `reconnectResyncCount` / `moveAckResyncCount` / `spectatorStaleResyncCount` / `tabFocusResyncCount` + the `record*` actions; full words, no abbreviations; consistent with the WP-311 store + WP-428 block.
- **§7 Dependency discipline** — PASS. **No new dependency** — instruments existing recovery paths + extends the existing block.
- **§8 Architectural boundaries** — PASS. App layer only; `bgioClient.ts` already imports the store (no new import class); `diagnostics.ts` stays boundary-clean (structural `state` param); no `G` write; the EC-260 grep holds.
- **§9 Windows** — PASS. `pwsh` `Select-String` + `git diff` verification, incl. a timing-constant no-diff check.
- **§10 Env vars** — N/A. None introduced.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. arena-client `node:test`; `bgioClient.test.ts` injects a structural client stub (no real boardgame.io); `typecheck` gated.
- **§13 Verification** — PASS. Exact `pnpm` commands + expected output; the exporter-exclusion and timing-constant-no-diff gates are explicit.
- **§14 Acceptance criteria** — PASS. 8 binary, observable items aligned to the deliverables (the block fields, the store fields + actions, the four instrumented paths + no-behavior-change, the builder copy, the untouched exporter, no engine footprint, the gates, scope).
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/ewiki/WORK_INDEX/EC_INDEX/mindmap + scope check. `User-Visible Surface = none (internal tooling)` ⇒ §15.1 D-24026 does not apply (declared; report-download verification substituted).
- **§16 Code style** — PASS. Four `+= 1` actions + four single increment calls + a verbatim field copy + test cases; `// why:` on the recovery-site tallies; no abbreviations; every function keeps its JSDoc.
- **§17 Vision Alignment** — N/A (declared) + multiplayer-sync + monetization + determinism notes: counts sync recovery but changes no sync behavior; internal diagnostics, no revenue vector; pure client presentation, zero determinism footprint; NG-1..7 preserved.
- **§18 Prose-vs-grep** — PASS. Verification Step 3 greps `bgioClient.ts` for the four `record*` calls (source-file scoped, not a forbidden-token grep over prose).
- **§19 Bridge-vs-HEAD staleness** — N/A. Not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate** — N/A — no funding affordance / channel / donate-support copy.
- **§21 API Catalog** — N/A — no HTTP endpoint and no `apps/server/src/**` library function; the report is assembled client-side with zero network egress.

**Lint verdict: PASS (all 21 resolved; 6 N/A each justified; §7 no new dependency).**

---

## Pre-Flight Verdict (01.4)

> Recorded at drafting; the executing session re-confirms against its own baseline.

**Verdict: READY TO EXECUTE (2026-07-25).**

- **Sequencing / dependencies:** WP-428 / D-24249 (the block), WP-311 / D-24096 (the
  store), WP-312 / D-24097 (the watchdog), and D-24232 (the reconnect-resync) are all
  on `main`. No engine dependency; a client extension of shipped surfaces.
- **Green baseline:** `main @ 43a5fcf8`.
- **Scope lock:** closed allowlist (6 arena-client files), no `01.5` wiring file;
  `git diff --name-only` is a DoD gate that excludes `DiagnosticExportButton.vue` and
  `packages/game-engine/**`, and a second gate asserts no timing-constant diff hunk.
- **Contract fidelity:** each counter is a single increment at an existing recovery
  site; the block extension mirrors WP-428's field-copy; the recovery machinery's
  thresholds/cooldown are provably untouched (the timing-constant no-diff gate).
- **RS-1 (clarification, non-blocking):** the four counters map to the four *auto*
  recovery paths; the manual WP-311 banner resync is intentionally excluded (it is
  operator-initiated, not a silent freeze recovery). Named in Constraints / Out of
  Scope.
- **Design fork resolved (was the sole PS item):** an independent audit flagged that
  the spectator-staleness and tab-focus paths **both route through the shared gated
  helper `forceCooldownGatedResync`**, so "a single unconditional increment at each
  cause site, past the cooldown gate" is unsatisfiable for those two (incrementing at
  the call site counts cooldown-suppressed triggers; incrementing inside the shared
  helper conflates the two causes). Resolution locked in Scope B / Constraints /
  Locked Values: add a `cause: 'spectator' | 'tabFocus'` parameter to
  `forceCooldownGatedResync` and route the increment **past its gate** — the only
  change to that helper. The other two paths (`onTransportReconnect`, `onWatchdogFire`)
  are genuine single-increment bodies. This nudges the modified-region set (brings
  `forceCooldownGatedResync`'s signature into scope) but adds **no file** — it is still
  the 6-file allowlist.
- **Empirical scaffold (drafting session, reverted):** the 6-file allowlist was
  prototyped on this branch — the four store counters + `record*` actions
  (`connection.ts`), the two single-increment bodies + the `cause`-parameterized
  `forceCooldownGatedResync` and its two updated call sites (`bgioClient.ts`), the
  `TransportDiagnostics` + `buildTransportDiagnostics` extension (`diagnostics.ts`),
  and the store/builder/wrapper test cases — and the arena-client suite run:
  **`vue-tsc` typecheck 0** and **1102 / 1102 tests pass, 0 fail** (from the 1099
  baseline: +3 counter cases). `git diff --name-only` was exactly the six allowlist
  files (+ governance) — **no seventh file forced**, `DiagnosticExportButton.vue`
  absent (the counts ride the store it already reads), and **no diff hunk touches
  `MOVE_ACK_TIMEOUT_MS` / `RESYNC_COOLDOWN_MS` / `SPECTATOR_STALE_TIMEOUT_MS`**. The
  bgioClient counter assertions **empirically confirmed the cause-routing**: the
  spectator resync incremented `spectatorStaleResyncCount` and **not**
  `tabFocusResyncCount` — the exact conflation the audit warned about, proven
  prevented. The prototype was then reverted (this SPEC draft is docs-only).
- **PS items (blocking):** none (the shared-helper fork above is resolved and
  scaffold-proven).

---

## Copilot Check (01.7)

> Recorded at drafting; the executing session may re-run.

**Overall judgment: PASS → CONFIRM (2026-07-25), after resolving one audit finding.**
An independent read-only subagent audit initially returned **RISK/HOLD** on a real
defect — the spectator + tab-focus counters both route through the shared
`forceCooldownGatedResync`, making the original "single unconditional increment at
each cause site" spec unsatisfiable. The WP was corrected (a `cause` parameter routes
the increment past the shared gate; see §Scope B and the pre-flight design-fork note),
and the fix was **scaffold-proven** (the spectator resync tallies only
`spectatorStaleResyncCount`, not `tabFocusResyncCount`). Everything else the audit
checked — the 6-file allowlist, layer boundary, determinism/persistence posture, the
unchanged exporter, no-new-dependency — passed on the merits. Post-fix: additive,
single runtime layer (App), no engine/determinism risk, no recovery-behavior change
(the timing-constant no-diff gate proves it).

Selected findings:
- **#1 / #9 (layer boundary)** — client-only runtime; `bgioClient.ts` already
  imports the store; `diagnostics.ts` stays boundary-clean (structural `state`
  param); no `G` write.
- **#2 (determinism)** — zero engine footprint; counters are framework state
  (never `G`, never persisted); no `finalStateHash` sentinel touched.
- **#4 (contract drift)** — the four counters are additive on both the store and
  the block; the exporter is unchanged (the counters ride the store it reads).
- **#7 (new dependency)** — none; instruments existing paths.
- **#12 (scope creep)** — recovery-behavior change, the manual resync, perf capture,
  transition log, and server correlation are all explicitly deferred; closed
  allowlist + `git diff` + timing-constant gates.
- **#25 (shared-function responsibility) — RAISED then RESOLVED.** The audit caught
  that spectator + tab-focus share `forceCooldownGatedResync`; the WP now threads a
  `cause` parameter and increments past the shared gate, keeping the two counts
  distinct without a suppressed-trigger miscount — scaffold-proven.

**Disposition: CONFIRM** — session-prompt generation authorized (the one BLOCK/RISK
finding was resolved in-place and re-validated by the scaffold).

---

## Reserved Decisions (land at execution)

- **D-24250 (reserved; Drafted 2026-07-25, not yet landed)** — The WP-428
  `transport` block gains **four recovery counters**: `reconnectResyncCount`,
  `moveAckResyncCount`, `spectatorStaleResyncCount`, `tabFocusResyncCount`. (1)
  **One counter per existing auto-recovery path.** `bgioClient.ts` already runs four
  silent auto-recoveries — the D-24232 transport-reconnect resync
  (`onTransportReconnect`), the WP-312/D-24097 move-ack-timeout resync
  (`onWatchdogFire`), the spectator-staleness resync (the timer armed in
  `updateSpectatorWatchdog`), and the tab-focus resync (`onVisibilityChange`). Each
  gets a single increment call at the point it commits to a resync (past the
  cooldown gate), on the WP-311 `connection` store. (2) **Counts recoveries, not
  behavior.** No threshold, cooldown, watchdog-arming, or `performResync` behavior
  changes — the paths behave identically and only also count; the manual WP-311
  banner `resync()` is not counted (operator-initiated, not a silent recovery). (3)
  **Surfaced through the WP-428 block.** `buildTransportDiagnostics` copies the four
  counts from the store verbatim; the exporter is unchanged (the counts ride the
  store it already reads). Paired with WP-428's `timeSinceLastFrameMs`, a freeze
  report now names both how stale the connection is and how hard the client already
  fought to recover. (4) **Boundary preserved.** Pure client presentation — App
  layer only, framework/transport state (never `G`, never persisted per WP-116),
  `diagnostics.ts` stays EC-260-clean via a structural `state` param, zero
  engine/determinism/replay footprint, no `finalStateHash` re-pin.

---

## See Also

- [WP-428](WP-428-diagnostic-transport-block.md) / D-24249 — the `transport` block
  this extends.
- WP-311 / D-24096 — the `connection` store the counters live in.
- WP-312 / D-24097 — the move-ack watchdog (`onWatchdogFire`).
- D-24232 — the transport-reconnect resync (`onTransportReconnect`).
- ewiki [Play Diagnostics](https://ewiki.legendary-arena.com/play-diagnostics/) —
  the page whose "counters are a not-yet-surfaced follow-up" note this WP closes.
