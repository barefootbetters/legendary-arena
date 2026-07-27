# EC-474 — Server Runtime-Health Signal on the Dashboard

**Source:** WP-439 · **Reserves:** D-24258 · **Layer:** Server + App (dashboard) · **Lane:** standard (cross-app)

## Before Starting

- Deps on `main`: WP-373 ✅, WP-374 ✅ (the `/api/dash/*` admin-gated surface +
  `{ data }` envelope + `requireAdminSession`).
- Load skill: `.claude/skills/legendary-server/SKILL.md`.
- Dashboard cannot import `apps/server` — mirror the types by hand + a drift test.
- Baseline: `pnpm -r build` 0; server + dashboard suites green.

## Locked Values

- Endpoint `GET /api/dash/system/runtime` (under the `system/` group, like
  `/api/dash/system/nodes`); Auth admin (`requireAdminSession`); body `{ data }`
  (D-20503); `Cache-Control: no-store` first (D-11504).
- `RuntimeHealthSnapshot` fields: `capturedAt, uptimeSeconds, cpuCount, cpuPercent,
  eventLoopDelayMs{mean,p50,p99,max}, memoryRssMb, webConcurrency`. Byte-identical
  server ↔ dashboard.
- `cpuPercent` = machine-capacity percent (÷ cpuCount), clamped [0,100], `null` on
  no-baseline; event-loop reads are ns → ms; window = since previous read.
- Dashboard status thresholds: event-loop p99 `≥50ms` → watch, `≥200ms` →
  saturated. `RUNTIME_HEALTH_STATUSES = ['healthy','watch','saturated']`.

## Guardrails

1. The metric reads `process`/`perf_hooks`/`os` ONLY — no DB, no registry, no
   engine, no persistence. The pool is passed to the route solely for the admin gate.
2. Metric-math lives in PURE functions (`buildRuntimeHealthSnapshot`,
   `computeCpuPercent`, `parseWebConcurrency`, the dashboard util) so it is
   unit-tested without real timing; only `getRuntimeHealthSnapshot` is impure.
3. Dashboard must NOT import `apps/server` — hand-mirror the types; the
   `runtimeHealth.drift.test.ts` guards field-set parity (re-derive both sides in
   one commit if either changes).
4. Follow Pattern A (`endpoints.ts` `isMockMode()` branch → `useFetch` → widget)
   and the `wrapMock` mock idiom; do NOT add a second env gate in `mocks.ts`.
5. New endpoint ⇒ `api-endpoints.md` row in the SAME commit (D-11804 / §21):
   Status `Wired`, Auth `authenticated-session-required`; replace the whole row.
6. Do NOT cluster the server, add the tile to the Overview strip, or add
   time-series retention — all out of scope.
7. Coverage gate is strict (90/80/88): any new util/composable needs its own test.

## Required Comments (`// why:`)

- The module-load `eventLoopHistogram.enable()` (why enable once at startup).
- The CPU baseline seed + `hrtime` span (why a delta is needed for a percent).
- The `÷ cpuCount` normalisation (why machine-capacity percent → the clustering tell).
- The `eventLoopHistogram.reset()` after read (why per-window, not lifetime).
- The `server.mjs` registration (why admin-gated, pool only for the gate).

## Files to Produce

- Server: `dashboardRuntime.{types,logic,logic.test,routes,routes.test}.ts` +
  `server.mjs` (register).
- Dashboard: `types/index.ts` (mirror) + `types/runtimeHealth.drift.test.ts` +
  `services/mocks.ts` (`mockRuntimeHealth`) + `services/endpoints.ts`
  (`fetchRuntimeHealth`) + `utils/runtimeHealth.{ts,test.ts}` +
  `widgets/RuntimeHealthWidget.vue` + `pages/system/SystemHealthPage.vue` (mount).
- `docs/ai/REFERENCE/api-endpoints.md` (new row).

## After Completing

- `pnpm -r build` 0; `node --import tsx --test apps/server/src/dashboard/dashboardRuntime.*.test.ts`
  green; `pnpm --filter @legendary-arena/dashboard typecheck|lint|test:coverage|format:check|build`
  all green; `pnpm --filter @legendary-arena/server test` green; `pnpm -r --no-bail test` green.
- Govern-close (SPEC commit): WORK_INDEX `[x]`, EC_INDEX `Done`, mindmap `✅` +
  `pnpm roadmap:counts:write`, land D-24258 Active, STATUS. Commit prefix `EC-474:`
  (impl) + `SPEC:` (govern-close). D-24026 live-verify operator-pending (auth-gated
  deployed dashboard).

## Common Failure Smells

- `format:check` fails on the new `.vue`/`.ts` → run `prettier --write` on them.
- Coverage dips → the new util/endpoint additions need their test (util is 100%;
  the drift test loads the types).
- Drift test red → server and dashboard field sets diverged; re-derive both.
- `api-endpoints.md` gate (§21) red → the new endpoint row was omitted.
