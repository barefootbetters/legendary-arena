# EC-464 — Reconnect / Resync Counters in the Transport Diagnostics Block (Execution Checklist)

**Source:** docs/ai/work-packets/WP-429-transport-reconnect-resync-counters.md
**Layer:** App (`apps/arena-client`)

## Before Starting
- [ ] Baseline `origin/main` clean + fast-forward synced; re-confirm the WP baseline.
- [ ] WP-428 / D-24249 is on `main`: `diagnostics.ts` exports `TransportDiagnostics` + the pure `buildTransportDiagnostics(state, capturedAtMs)`; the `connection` store carries `lastFrameAtMs` + `setConnected(…, atMs)`.
- [ ] `bgioClient.ts` runs the four recovery functions (`onTransportReconnect`, `onWatchdogFire`, the spectator-staleness timer fire armed in `updateSpectatorWatchdog`, `onVisibilityChange`) and already imports `useConnectionStore`.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0; `pnpm --filter arena-client test` exits 0.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL — surface as a blocker, do not improvise. In particular: do NOT edit `DiagnosticExportButton.vue`, and NO `packages/**` / `apps/server/**` file.

## Locked Values (do not re-derive)
- Four counters (store fields, `number`, initial `0`): `reconnectResyncCount`, `moveAckResyncCount`, `spectatorStaleResyncCount`, `tabFocusResyncCount`.
- Four increment actions, each `+= 1`: `recordReconnectResync()`, `recordMoveAckResync()`, `recordSpectatorStaleResync()`, `recordTabFocusResync()`.
- Instrumentation sites (each PAST its path's cooldown gate). Two are single increments in their own body: `onTransportReconnect` → `recordReconnectResync` (past its inline gate); `onWatchdogFire` → `recordMoveAckResync` (gated upstream in `armWatchdog`). The other two share `forceCooldownGatedResync` — add a `cause: 'spectator' | 'tabFocus'` parameter and, PAST its cooldown gate, route the increment: `recordSpectatorStaleResync` (spectator timer arms `forceCooldownGatedResync('spectator')`) / `recordTabFocusResync` (`onVisibilityChange` calls `forceCooldownGatedResync('tabFocus')`). The `cause` param is the ONLY change to that helper.
- `TransportDiagnostics` gains the four `number` fields; `buildTransportDiagnostics` copies them from `state` verbatim (no derivation).
- No recovery-behavior change: `MOVE_ACK_TIMEOUT_MS`, `RESYNC_COOLDOWN_MS`, `SPECTATOR_STALE_TIMEOUT_MS`, the cooldown gating, watchdog arming, and `performResync` are UNCHANGED. The manual WP-311 banner `resync()` is NOT counted.
- The exporter (`DiagnosticExportButton.vue`) is UNCHANGED (the counters ride the store it already reads). No new dependency.
- Reserved decision: **D-24250** (land Active at close).

## Guardrails
- Boundary-clean (EC-260 / D-22801): `diagnostics.ts` imports NOTHING from `packages/game-engine`, `packages/registry`, `packages/preplan`, `apps/server`, `pg`, or `boardgame.io`. Widen `buildTransportDiagnostics`'s `state` param structurally — do NOT import the store into `diagnostics.ts`. A forbidden import there ⇒ STOP.
- Counters are framework/client state, never game state: they live on the `connection` store. NEVER read/write `G`/`ctx`; add no persistence surface; touch no `finalStateHash` sentinel.
- Instrument, do NOT re-architect: each counter increments once, PAST its path's cooldown gate. `onTransportReconnect` / `onWatchdogFire` take a single increment in their own body. The shared `forceCooldownGatedResync` gains a `cause` parameter (its ONLY change) so its single past-gate increment routes to the spectator vs tab-focus counter. Do NOT change any timing constant, the cooldown gate condition/timing, watchdog arming, or `performResync`. A diff hunk touching `MOVE_ACK_TIMEOUT_MS` / `RESYNC_COOLDOWN_MS` / `SPECTATOR_STALE_TIMEOUT_MS` ⇒ STOP.
- Count the four AUTO paths only; the manual banner `resync()` is not counted.
- Increment on the actual resync, not a cooldown-suppressed trigger. This is WHY the spectator/tab-focus increments go INSIDE `forceCooldownGatedResync` past its gate (not at the call sites, which would count suppressed triggers), routed by `cause`.
- The exporter stays untouched: `DiagnosticExportButton.vue` in the diff ⇒ STOP (the counters flow through the store, not a new collect call).

## Required `// why:` Comments
- `bgioClient.ts` (each of the four increment calls): a client-diagnostic tally of an auto-recovery firing (WP-429 / D-24250) — the count rides the `connection` store into the WP-428 transport block; no recovery behavior changes.

## Files to Produce
- `apps/arena-client/src/stores/connection.ts` — **modified** — four `number` counter fields (initial `0`) + four `record*` increment actions (each `+= 1`); updated JSDoc
- `apps/arena-client/src/client/bgioClient.ts` — **modified** — a past-gate `useConnectionStore().record*()` increment for each of the four recovery paths: single calls in `onTransportReconnect` + `onWatchdogFire`; a `cause: 'spectator' | 'tabFocus'` parameter on `forceCooldownGatedResync` (its only change) routing the spectator/tab-focus increments past its gate; the spectator timer + `onVisibilityChange` pass the matching `cause`. NO timing-constant / cooldown-gate / `performResync` change
- `apps/arena-client/src/diagnostics/diagnostics.ts` — **modified** — four `number` fields on `TransportDiagnostics`; `buildTransportDiagnostics` `state` param widened + verbatim copy of the four counters
- `apps/arena-client/src/stores/connection.test.ts` — **modified** — each counter starts `0`; each `record*` increments only its own field by one
- `apps/arena-client/src/diagnostics/diagnostics.test.ts` — **modified** — `sampleContext` transport default extended with the four counters; builder carries + round-trips them
- `apps/arena-client/src/client/bgioClient.test.ts` — **modified** — each recovery path increments its counter; a cooldown-suppressed path does not

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter arena-client typecheck` exits 0.
- [ ] `pnpm --filter arena-client test` passes.
- [ ] `git diff --name-only` = the six allowlist files (+ governance); NO `DiagnosticExportButton.vue`, NO `packages/game-engine/**`, NO `apps/server/**`. `git diff apps/arena-client/src/client/bgioClient.ts` touches no timing constant.
- [ ] Verify live: download a diagnostic report after driving/simulating a reconnect or resync in a local/dev session; confirm the matching counter is non-zero. The report is the artifact — no D-24026 rendered-surface gate (internal tooling).
- [ ] `docs/ai/STATUS.md` — the transport block now carries the four recovery counters.
- [ ] `docs/ai/DECISIONS.md` — land D-24250 Active.
- [ ] `wiki/play-diagnostics.md` — the Transport-block Mechanics subsection + Edge Case updated so the counters read as shipped; `pnpm wiki-viewer:check-links` clean.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-429 checked off with the date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-464 Pending → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-429 node glyph `📝 → ✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- A timing constant (`MOVE_ACK_TIMEOUT_MS` / `RESYNC_COOLDOWN_MS` / `SPECTATOR_STALE_TIMEOUT_MS`) in the `bgioClient.ts` diff ⇒ you changed recovery behavior; this WP only counts, it does not re-tune.
- `DiagnosticExportButton.vue` in the diff ⇒ you added a collect call; the counters ride the store the exporter already reads.
- An engine/registry/`boardgame.io` import in `diagnostics.ts` ⇒ boundary violation (EC-260); widen the `state` param structurally instead.
- A counter incremented in `performResync` ⇒ that conflates all four causes (and the manual resync); increment at each cause path instead (own body for reconnect/move-ack; cause-routed inside `forceCooldownGatedResync` for spectator/tab-focus).
- The manual banner `resync()` bumping a counter ⇒ only the four auto paths count (`resync()` calls `performResync` directly, not the cause-routed paths).
- A spectator/tab-focus increment at the CALL SITE (in the timer callback or `onVisibilityChange`) instead of inside `forceCooldownGatedResync` ⇒ it counts cooldown-suppressed triggers, not actual resyncs. Route it past the gate via the `cause` param.
- Incrementing inside `forceCooldownGatedResync` WITHOUT the `cause` param ⇒ spectator and tab-focus conflate into one count.
- `packages/game-engine/**` or `apps/server/**` in the diff ⇒ you drifted out of the App layer.
