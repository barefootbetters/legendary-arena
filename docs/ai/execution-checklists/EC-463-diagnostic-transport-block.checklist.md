# EC-463 — Transport Diagnostics Block (Execution Checklist)

**Source:** docs/ai/work-packets/WP-428-diagnostic-transport-block.md
**Layer:** App (`apps/arena-client`)

## Before Starting
- [ ] Baseline `origin/main` clean + fast-forward synced; re-confirm the WP baseline.
- [ ] WP-228 / D-22801 is on `main`: `apps/arena-client/src/diagnostics/diagnostics.ts` exports `buildDiagnosticReport(entries, context)` + the `DiagnosticContext` / `DiagnosticReport` interfaces, which already pass `uiStateSnapshot` / `matchSetup` through unmodified.
- [ ] WP-311 / D-24096 is on `main`: `apps/arena-client/src/stores/connection.ts` exposes `isConnected` / `lastStateId` / `hasEverConnected` and `setConnected(isConnected, stateId)`, called every subscribe frame from `client/bgioClient.ts`.
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0; `pnpm --filter arena-client test` exits 0.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL — surface as a blocker, do not improvise. In particular: do NOT edit `client/bgioClient.ts`, and NO `packages/**` / `apps/server/**` file.

## Locked Values (do not re-derive)
- Block type: `TransportDiagnostics = { isConnected: boolean; lastStateId: number | null; hasEverConnected: boolean; lastFrameAtMs: number | null; timeSinceLastFrameMs: number | null }`.
- Field sources: `isConnected` / `lastStateId` / `hasEverConnected` ← the `connection` store verbatim; `lastFrameAtMs` ← the store's new stamp; `timeSinceLastFrameMs` = `capturedAtMs - lastFrameAtMs` (non-negative integer) or `null` when `lastFrameAtMs` is `null`.
- New store field: `lastFrameAtMs: number | null`, initial `null`, set in `setConnected(isConnected, stateId, atMs = Date.now())` — a DEFAULTED third parameter. The existing two-argument call in `bgioClient.ts` is UNCHANGED.
- Pure helper: `buildTransportDiagnostics(state, capturedAtMs)` in `diagnostics.ts` — clock-free (takes `capturedAtMs`); no `Date.now()` inside.
- Report/context field: `transport: TransportDiagnostics` — REQUIRED (never `null`); the builder passes it through unmodified (no derivation in the builder).
- No reconnect/resync counters; no `bgioClient.ts` change; no new dependency.
- Reserved decision: **D-24249** (land Active at close).

## Guardrails
- Boundary-clean (EC-260 / D-22801): `diagnostics.ts` imports NOTHING from `packages/game-engine`, `packages/registry`, `packages/preplan`, `apps/server`, `pg`, or `boardgame.io`. The `connection` store is an App-layer Pinia store — reading it keeps the boundary. An engine/registry/server/`boardgame.io` import in `diagnostics.ts` ⇒ STOP.
- Transport state, never game state: read the `connection` store only. NEVER read/write `G`/`ctx`; add no persistence surface; touch no `finalStateHash` sentinel.
- Do NOT touch `client/bgioClient.ts`: the frame stamp rides the already-every-frame `setConnected` call via the DEFAULTED `atMs` parameter — the call site stays two-argument and source-compatible. A `bgioClient.ts` diff ⇒ STOP.
- Builder stays pure: `buildDiagnosticReport` reads no ambient `window`/`Date`; it passes `context.transport` straight through (like `uiStateSnapshot`/`matchSetup`). The one clock subtraction happens in `collectContext` via the pure helper (clock passed in).
- Block always present (never `null`): the store always exists for a mounted play surface, so `transport` carries live values or their null/`false` defaults (the `effectProvenance` posture, not the `matchSetup` null-when-absent posture).
- Reconnect/resync/frame counters are OUT — that requires instrumenting `bgioClient.ts` (WP-A2, separate).

## Required `// why:` Comments
- `connection.ts` (the defaulted `atMs = Date.now()`): a client-layer diagnostic timestamp marking the frame's arrival, outside the engine determinism boundary (which governs `packages/game-engine` only) — mirrors `diagnostics.ts`'s `captureTimestampMs`.

## Files to Produce
- `apps/arena-client/src/diagnostics/diagnostics.ts` — **modified** — `TransportDiagnostics` interface; `transport` on `DiagnosticContext` + `DiagnosticReport` (REQUIRED); pure `buildTransportDiagnostics(state, capturedAtMs)`; `transport: context.transport` pass-through in `buildDiagnosticReport`
- `apps/arena-client/src/stores/connection.ts` — **modified** — `lastFrameAtMs: number | null` state (initial `null`); defaulted `atMs = Date.now()` param on `setConnected` assigning `this.lastFrameAtMs`; updated JSDoc + the `// why:` note
- `apps/arena-client/src/components/DiagnosticExportButton.vue` — **modified** — `collectContext` reads `useConnectionStore()` and sets `transport: buildTransportDiagnostics(store, capturedAtMs)`
- `apps/arena-client/src/diagnostics/diagnostics.test.ts` — **modified** — `transport` default in `sampleContext`; builder cases (pass-through, `timeSinceLastFrameMs` derivation, `null` when `lastFrameAtMs` null); click-path carries the block from the store
- `apps/arena-client/src/stores/connection.test.ts` — **modified** — `lastFrameAtMs` starts `null`, set from explicit `atMs`, a number after a default-clock call

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter arena-client typecheck` exits 0 (vue-tsc — the REQUIRED-field + SFC gate).
- [ ] `pnpm --filter arena-client test` passes.
- [ ] `git diff --name-only` = the five allowlist files (+ governance); NO `client/bgioClient.ts`, NO `packages/game-engine/**`, NO `apps/server/**`.
- [ ] Verify the block live: download a diagnostic report from a local/dev play session; confirm the `transport` fields reflect the live connection state (`isConnected` / `lastStateId` / `hasEverConnected` match, `timeSinceLastFrameMs` is a small non-negative number on a healthy connection). The report is the artifact — no D-24026 rendered-surface gate applies (internal tooling).
- [ ] `docs/ai/STATUS.md` — the diagnostic report now carries a `transport` block.
- [ ] `docs/ai/DECISIONS.md` — land D-24249 Active.
- [ ] `wiki/play-diagnostics.md` — update the "no transport data captured today" Edge Case to the shipped state; add a WP-428 `History` line.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-428 checked off with the date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-463 Draft → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-428 node glyph `📝 → ✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- `client/bgioClient.ts` in the diff ⇒ you edited the call site instead of defaulting the `atMs` parameter (the stamp must ride the existing two-argument call).
- A `packages/game-engine/**` or `apps/server/**` file in the diff ⇒ you drifted out of the App layer; this is arena-client only.
- An engine/registry/`boardgame.io` import in `diagnostics.ts` ⇒ boundary violation (EC-260); the block reads the Pinia store, nothing more.
- `buildDiagnosticReport` reading `Date.now()` / `window` ⇒ the builder must stay pure; the clock lives in `collectContext`, passed into the helper.
- `transport` typed `unknown` / carried opaque ⇒ it is a TYPED block (unlike `uiStateSnapshot`); the builder and tests read its fields.
- `timeSinceLastFrameMs` negative or non-null when `lastFrameAtMs` is `null` ⇒ the derivation is wrong (non-negative, or `null` when no frame stamp).
- `sampleContext` untouched and many test cases edited ⇒ backfill the REQUIRED field once in the helper, not per-case.
