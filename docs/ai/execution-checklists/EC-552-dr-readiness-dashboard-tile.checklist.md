# EC-552 — DR Readiness Dashboard Tile (Execution Checklist)

**Source:** docs/ai/work-packets/WP-517-dr-readiness-dashboard-tile.md
**Layer:** CI + Server (`apps/server`) + App (`apps/dashboard`) — one WP, single session, two-commit topology

## Before Starting
- [ ] `dr-drill-reminder.yml` on `main` opens `DR drill due — <Month> <Year>` issues (#1298); note the **em-dash** (U+2014)
- [ ] Read `apps/server/src/dashboard/dashboardRuntime.routes.{ts,test.ts}` — the endpoint MIRRORS it (admin gate, `no-store`, `{data}`); do not invent a shape
- [ ] Read `apps/dashboard/src/pages/system/SystemHealthPage.vue` + an existing `widgets/*Widget.vue` (e.g. `RuntimeHealthWidget.vue`) + its mock — mirror the widget+mock pattern (tiles are `widgets/*Widget.vue`, NOT `components/`)
- [ ] `pnpm -r build` exits 0; Dashboard Gates green on `main`
- [ ] Enumerate the EXACT target file set (= WP §5 / Files to Produce); any edit outside it is a FAIL

## Locked Values (do not re-derive)
- Endpoint: `GET /api/dash/dr-readiness`; **Auth `admin-session-required`** via `requireAdminSession` (NOT `authenticated-session-required`); `Cache-Control: no-store` **first statement**; body `{ data: DrReadiness }`; status `200/401/403/500`
- Reminder body add: a single `- [ ] Drill passed` checkbox line (dr-drill-reminder.yml issue body)
- `result`: newest **CLOSED** drill issue → checkbox **checked** = `pass`, present-**unchecked** = `fail`, **absent** = `unknown`
- `overdue`: an **OPEN** drill issue whose title month < the injected reference month
- `nextDue`: 1st of the **next** month (UTC), from the injected `referenceDate`
- Title match: exact `DR drill due — ` (em-dash U+2014); **exclude pull requests** from the issues list
- Repo coordinate: an explicit `owner/repo` constant/env (no `GITHUB_REPOSITORY` outside Actions)
- No-token: `200` + `{ data:{ source:"mock", overdue:false, lastDrill:null, nextDue } }` — never throw/500
- Token: `DASH_GITHUB_TOKEN` (`sync:false`, `issues:read`); cache TTL ≥ 5 min
- api-endpoints.md row: Status **`Wired`**, Auth **`admin-session-required`** (closed sets)

## Guardrails
- The derivation `deriveDrReadiness(issues, referenceDate)` is **pure** — reference date **injected**, NO internal clock read; unit-tested with fixture issues + a FIXED date (no network in the test)
- Mock-first: absent/invalid token → mock `{data}` + `200`, not an error
- **Read-only**: the endpoint/tile NEVER create/edit/close issues; the workflow edit only adds the checkbox to newly-opened issues
- Do NOT change the reminder cadence/schedule, `DISASTER_RECOVERY.md`, or `/vision`
- Field names follow the `/api/dash/*` projection convention (WP-373/374/439), not a new 00.2 lock
- No `packages/**` change; no engine/registry/determinism/persistence/RNG surface
- `git diff --name-only` == this allowlist; the only existing-file edits are the two `01.5` wiring files (`server.mjs`, `SystemHealthPage.vue`)
- Two-commit topology: `EC-552:` implementation + `SPEC:` govern-close

## Required `// why:` Comments
- The single clock read at the route boundary (why the route supplies `referenceDate` and the logic stays pure)
- The cache TTL constant (why: GitHub REST rate limits on a per-view admin tile)
- The no-token mock fallback (why `200`-not-error: the dashboard is mock-mode-first)
- The PR-exclusion filter (why: the issues endpoint returns PRs too)

## Files to Produce
- `.github/workflows/dr-drill-reminder.yml` — **modified** — add `- [ ] Drill passed`
- `apps/server/src/dashboard/dashboardDrReadiness.types.ts` — **new** — `DrReadiness`
- `apps/server/src/dashboard/dashboardDrReadiness.logic.ts` — **new** — pure `deriveDrReadiness(issues, referenceDate)`
- `apps/server/src/dashboard/dashboardDrReadiness.routes.ts` — **new** — admin gate + no-store + `{data}` + fetch/cache/repo/PR-filter/token
- `apps/server/src/dashboard/dashboardDrReadiness.routes.test.ts` — **new** — admin 200/401/403 + mock path + derivation
- `apps/server/src/server.mjs` — **modified** (01.5 — import + `registerDashboardDrReadinessRoutes`)
- `apps/dashboard/src/widgets/DrReadinessWidget.vue` — **new** — the tile (`widgets/*Widget.vue` convention, e.g. `RuntimeHealthWidget.vue`; NOT `components/`, NOT `*Tile.vue`)
- `apps/dashboard/src/services/drReadinessMocks.ts` — **new** — mock payload (flat `services/`, sibling to `opsHealthMocks.ts`)
- `apps/dashboard/src/pages/system/SystemHealthPage.vue` — **modified** (01.5 — import + mount the widget)
- `apps/dashboard/src/widgets/DrReadinessWidget.test.ts` — **new**
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — endpoint row (whole-row replace, D-11804)
- Govern-close: `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md` (D-24330 Active), `docs/ai/STATUS.md`, `docs/05-ROADMAP-MINDMAP.md` (`📝`→`✅`). `NUMBER-LEDGER.md` already reserved (not in the diff).

## After Completing
- [ ] `pnpm --filter @legendary-arena/server test` + `pnpm --filter @legendary-arena/dashboard test` green
- [ ] Dashboard Gates (lint/typecheck/coverage/format/build) green; `pnpm -r --no-bail test` green
- [ ] `git diff --name-only` = the allowlist (only `server.mjs` + `SystemHealthPage.vue` among existing files)
- [ ] `api-endpoints.md` row present (Status `Wired`, Auth `admin-session-required`); catalog gate green
- [ ] `DECISIONS.md` D-24330 Active; `WORK_INDEX.md` checked with date; `docs/05-ROADMAP-MINDMAP.md` `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] `STATUS.md` — "User-visible: dashboard System-Health DR readiness tile"; D-24026 operator-pending

## Common Failure Smells
- Endpoint uses `authenticated-session-required` or a flat body → wrong idiom; copy `dashboardRuntime.routes.ts` (admin gate + no-store + `{data}`)
- Fixture test flips across a month boundary → clock read inside the logic instead of an injected `referenceDate`
- `result` always `unknown` → not reading the `Drill passed` checkbox, or the reminder edit was skipped
- Zero issues matched → hyphen used instead of the em-dash, or PRs not excluded
- Endpoint 500s with no token → missing the mock-first fallback
