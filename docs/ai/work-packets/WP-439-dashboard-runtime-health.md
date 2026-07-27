# WP-439 — Server Runtime-Health Signal on the Operator Dashboard

**Status:** Drafted 2026-07-27 · **EC:** EC-474 · **Reserves:** D-24258
**Layer:** Server (`apps/server/**`) + App (`apps/dashboard/**`) · **Lane:** standard (cross-app)
**Baseline:** drafted+executed off `origin/main` @ `48db4bf4` in an isolated worktree.

## Goal

Give the operator a **data-backed answer to "is one Node process CPU-saturated —
is clustering worth its cost yet?"**. Add an admin-gated `GET
/api/dash/system/runtime` that returns a live snapshot of the game server
process's runtime health (CPU %, event-loop delay percentiles, resident memory,
uptime, CPU count, `WEB_CONCURRENCY`), and a **Server Runtime Health** tile on the
dashboard's System Health page that renders it with a plain-English clustering
hint. This replaces guesswork about whether to cluster the server with an
observed signal.

## Assumes

- **WP-373 / WP-374 (D-24168 / D-24169)** — the `/api/dash/*` surface, the
  `requireAdminSession` (WP-159) admin gate, and the bare `{ data: T }` envelope
  (D-20503). This WP adds one more route on that surface following the
  `dashboardGameplay` idiom.
- The dashboard's **Pattern A** data path (`services/endpoints.ts` `fetchX` with an
  `isMockMode()` branch → `useFetch` composable → widget), the `wrapMock` mock
  idiom (`services/mocks.ts`), and the cross-app **type-drift-test** convention
  (`types/*.drift.test.ts`, hand-mirrored server types).
- **D-11804** — a new HTTP endpoint MUST be recorded in
  `docs/ai/REFERENCE/api-endpoints.md` in the same commit.
- Server layer may read clocks / CPU / `perf_hooks` (the no-clock rule is an
  *engine* rule).

## Context

This WP came out of the clustering discussion (2026-07-27): a deploy log showed
Render setting `WEB_CONCURRENCY=2`, which is inert today (the server runs a single
process). Whether to cluster to use the second core should be decided by evidence
of single-process CPU saturation, not a hunch. Node's standard saturation signal
is **event-loop delay** (`perf_hooks.monitorEventLoopDelay`) — a rising p99 while
one core maxes and the others idle is exactly the "clustering would help" tell.
The tile surfaces that plus process CPU %, so the operator can watch it under real
load before paying the clustering cost (a shared Socket.IO adapter + singleton
leader-election — see the follow-up note).

## Scope (In)

- **Server** (`apps/server/src/dashboard/`):
  - `dashboardRuntime.types.ts` — `RuntimeHealthSnapshot` + `EventLoopDelayMs` +
    the route-deps bundle.
  - `dashboardRuntime.logic.ts` — a module-load event-loop histogram
    (`monitorEventLoopDelay`), a module-state CPU baseline, a **pure**
    `buildRuntimeHealthSnapshot(readings)` + `computeCpuPercent` +
    `parseWebConcurrency`, and the thin `getRuntimeHealthSnapshot()` sampler.
  - `dashboardRuntime.routes.ts` — `GET /api/dash/system/runtime`, `no-store` +
    `requireAdminSession` + `{ data }`.
  - `dashboardRuntime.logic.test.ts` + `dashboardRuntime.routes.test.ts`.
  - `server.mjs` — register the route (mirrors the gameplay registration).
- **Dashboard** (`apps/dashboard/src/`):
  - `types/index.ts` — mirror `RuntimeHealthSnapshot` + `EventLoopDelayMs`.
  - `types/runtimeHealth.drift.test.ts` — cross-app field-set drift guard.
  - `services/mocks.ts` — `mockRuntimeHealth()`.
  - `services/endpoints.ts` — `fetchRuntimeHealth()` (Pattern A).
  - `utils/runtimeHealth.ts` (+ test) — pure status/format/clustering-hint helpers.
  - `widgets/RuntimeHealthWidget.vue` — the tile (mirrors `ServerStatusWidget`).
  - `pages/system/SystemHealthPage.vue` — mount the tile at the top.
- **API catalog** (`docs/ai/REFERENCE/api-endpoints.md`) — the new endpoint row.

## Scope (Out)

- **Actually clustering the server** (Node `cluster`/`throng`) — a separate,
  deliberately-deferred decision needing a shared Socket.IO adapter + singleton
  leader-election for the reaper/harvester/publisher; this WP only provides the
  signal to decide it.
- Adding the tile to the Overview "Ops at a Glance" strip (kept to the System
  Health page to bound scope).
- Historical/time-series retention of the metric (the tile shows a live snapshot;
  each poll reports the window since the last read).
- Multi-instance/per-worker aggregation (single process assumed; the snapshot is
  this process's).
- Any engine/registry/persistence/determinism change.

## Files Expected to Change

| File | Change |
|---|---|
| `apps/server/src/dashboard/dashboardRuntime.types.ts` | NEW |
| `apps/server/src/dashboard/dashboardRuntime.logic.ts` | NEW |
| `apps/server/src/dashboard/dashboardRuntime.logic.test.ts` | NEW |
| `apps/server/src/dashboard/dashboardRuntime.routes.ts` | NEW |
| `apps/server/src/dashboard/dashboardRuntime.routes.test.ts` | NEW |
| `apps/server/src/server.mjs` | EDIT — register the route |
| `apps/dashboard/src/types/index.ts` | EDIT — mirror the types |
| `apps/dashboard/src/types/runtimeHealth.drift.test.ts` | NEW |
| `apps/dashboard/src/services/mocks.ts` | EDIT — `mockRuntimeHealth` |
| `apps/dashboard/src/services/endpoints.ts` | EDIT — `fetchRuntimeHealth` |
| `apps/dashboard/src/utils/runtimeHealth.ts` | NEW |
| `apps/dashboard/src/utils/runtimeHealth.test.ts` | NEW |
| `apps/dashboard/src/widgets/RuntimeHealthWidget.vue` | NEW |
| `apps/dashboard/src/pages/system/SystemHealthPage.vue` | EDIT — mount |
| `docs/ai/REFERENCE/api-endpoints.md` | EDIT — new endpoint row (D-11804) |
| governance | WP/EC/WORK_INDEX/EC_INDEX/mindmap/NUMBER-LEDGER/DECISIONS/STATUS |

## Contract

- `GET /api/dash/system/runtime` — Auth `authenticated-session-required` (admin;
  `requireAdminSession`). Response `200 { data: RuntimeHealthSnapshot }`;
  `401`/`403` via the shared admin-gate mapping; `Cache-Control: no-store`.
- `RuntimeHealthSnapshot = { capturedAt: string; uptimeSeconds: number; cpuCount:
  number; cpuPercent: number | null; eventLoopDelayMs: { mean; p50; p99; max };
  memoryRssMb: number; webConcurrency: number | null }`. Byte-mirrored on the
  dashboard; the drift test guards parity.
- `cpuPercent` is normalised to **total machine capacity** (÷ `cpuCount`), so a
  pure-JS process caps near `100/cpuCount`; `null` on the first read (no baseline).
- Event-loop percentiles are the window **since the previous read** (the histogram
  resets each read).

## Acceptance Criteria

1. `GET /api/dash/system/runtime` returns `200 { data }` for an admin, `401`
   unauthenticated, `403` non-admin, always `no-store`.
2. The snapshot math is correct: CPU % normalised to machine capacity + clamped +
   null-guarded; ns→ms conversion; `WEB_CONCURRENCY` parsed or null.
3. The dashboard System Health page renders a **Server Runtime Health** tile with
   the p99 headline + status chip, the metric grid, and a clustering hint;
   4-arm state (loading/error/empty/data); mock-mode populated.
4. Cross-app type parity guarded by `runtimeHealth.drift.test.ts`.
5. All server + dashboard gates green (below).

## Verification Steps

1. `pnpm -r build` → 0.
2. `node --import tsx --test apps/server/src/dashboard/dashboardRuntime.*.test.ts`
   → green.
3. `pnpm --filter @legendary-arena/dashboard typecheck | lint | test:coverage |
   format:check | build` → all green (coverage ≥ 90/80/88).
4. `pnpm --filter @legendary-arena/server test` → green.
5. `pnpm -r --no-bail test` → repo-wide green.

## Definition of Done

- [ ] Endpoint + tile shipped; mock-mode populated; admin-gated.
- [ ] Pure metric-math unit-tested; cross-app drift test present.
- [ ] All server + dashboard CI gates green; `pnpm -r build` 0; repo-wide test green.
- [ ] `api-endpoints.md` row added (D-11804); §21 gate satisfied.
- [ ] Full governance filed (WP/EC/D-24258 + WORK_INDEX/EC_INDEX/mindmap/STATUS/
      NUMBER-LEDGER); ledger + roadmap-counts gates green. Commit prefix `EC-474:`.
- [ ] **D-24026 live-verify operator-pending** — the tile is behind the dashboard's
      admin auth gate and only meaningful against the deployed server, so visual
      confirmation is on the deployed dashboard (consistent with every prior
      dashboard-widget WP).

## Lint Gate Self-Review (`00.3`, 21 sections)

- §1 Scope / §2 Layers (Server + App, no boundary violation — dashboard has no
  server import; types hand-mirrored) / §3 Files enumerated — PASS.
- §4 Determinism — N/A engine; server clock/CPU reads allowed; dashboard mock uses
  the established `randomBetween` idiom. PASS.
- §5 Persistence — no DB write; the metric reads `process`/`perf_hooks`/`os` only;
  nothing persisted. PASS.
- §8 Backend — reuses the shared pool ONLY for the admin gate (no new pool). PASS.
- §9 Canonical arrays — `RUNTIME_HEALTH_STATUSES` added with an iterating test. PASS.
- §10 Contract files — none of the locked `.types/.validate/.gating` engine
  contracts touched; the new `.types.ts` is a fresh dashboard-feed shape. PASS.
- §17 Vision — §14 observability; no conflict. PASS.
- §18 Tests — server pure-math + route-gate tests; dashboard util + drift tests;
  coverage gate green. PASS.
- §19 Comments — `// why:` on the histogram enable, the CPU baseline, the ÷cpuCount
  normalisation, the reset-after-read, and the route wiring. PASS.
- §20 Error handling — route try/catch → 500 `{ code }`; ns→ms floors NaN/Inf. PASS.
- §21 API Catalog (D-11804) — **APPLIES**: `api-endpoints.md` gains the
  `/api/dash/system/runtime` row (Status `Wired`, Auth `authenticated-session-required`).
- Remaining sections N/A (no registry/engine/UI-projection/schema change).

**Pre-flight verdict:** READY TO EXECUTE (deps WP-373/374 ✅ on main; scope locked).
**Copilot check verdict:** PASS (residual: the event-loop histogram reset is
per-read, so two concurrent admin pollers share/reset each other's window — a
non-issue for a single-operator dashboard; documented in D-24258).
