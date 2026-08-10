# WP-517 — DR Readiness Dashboard Tile (Reminder marker + Server feed + Dashboard tile)

**Status:** Draft 2026-08-09
**Layer:** CI (`.github/workflows`) + Server (`apps/server`) + App (`apps/dashboard`) — **one WP, single execution session** (two-commit topology: `EC-552:` impl + `SPEC:` close)
**User-Visible Surface:** `dashboard.legendary-arena.com` (operator/admin dashboard — System Health / ops-health section)
**Baseline:** drafted off `origin/main` @ `b073e895` (2026-08-09)
**Reserves:** D-24330 · **EC:** EC-552 · **Hard-dep:** `dr-drill-reminder` workflow (#1298, merged)

> **Renumber note (2026-08-09).** Originally drafted as WP-516 / EC-551 / D-24329;
> a parallel session shipped Ymir Fight KO-wounds under those exact numbers (#1300/#1301,
> Done on `main`) while this reserve sat only on the draft branch. Renumbered to the
> next-free WP-517 / EC-552 / D-24330 per the 01.0b parallel-execution collision rule
> (shipped-on-main wins; the loser renumbers). Scope and design are unchanged.

## Non-Negotiable Constraints

- Code must follow `docs/ai/REFERENCE/00.6-code-style.md` (human-style, explicit, junior-readable).
- The executor produces **complete files**, never diffs, patches, or `// … unchanged` snippets.
- The endpoint mirrors the **existing `/api/dash/*` idiom exactly** (pre-flight PS-1/PS-2): `requireAdminSession` gate (200/401/403), `Cache-Control: no-store` as the first statement, and the `{ data: T }` envelope (D-20503/D-11504/D-15901) — like `registerDashboardRuntimeRoutes`. No new auth or response shape.
- **Read-only**: neither the endpoint nor the tile creates/edits/closes issues. The reminder-workflow edit only adds a checkbox to newly-opened issues.
- No `packages/**` change; no engine/registry/determinism/persistence/RNG surface.

## 1. Goal

Surface **disaster-recovery drill readiness** as a tile on the System-Health (ops)
page of `dashboard.legendary-arena.com`, so DR posture is a daily-visible signal
instead of a doc nobody re-reads. The tile shows **last drill** (date + PASS/FAIL),
**next due**, and an **overdue** flag, derived from the `DR drill due` GitHub issues
the `dr-drill-reminder` workflow manages.

## 2. Assumes

- `dr-drill-reminder.yml` is on `main`, opening `DR drill due — <Month> <Year>`
  issues (em-dash U+2014, UTC month) on cadence (#1298, merged).
- The dashboard consumes admin data via `/api/dash/*` endpoints in `apps/server`,
  all gated by `requireAdminSession`, returning `{ data }` + `Cache-Control:
  no-store` (WP-373/374/439; `dashboardRuntime.routes.ts` is the template). New
  endpoints follow that idiom.
- The dashboard's ops surface is `apps/dashboard/src/pages/system/SystemHealthPage.vue`.
- `DISASTER_RECOVERY.md` §7 defines the cadence this tile reflects.

## 3. Context

The DR arc (backups → GFS → 3-2-1 → runbook → reminder) is complete; the remaining
risk is a drill cadence that silently lapses. The reminder issues add accountability
but live in the Issues tab. A tile on the ops page the operator already checks closes
the loop. **Ops-health, not `/vision`** (`/vision` is product roadmap).

**PASS/FAIL source (pre-flight RS-1, operator-decided 2026-08-09).** The reminder
issue body currently carries no result marker, so this WP **amends
`dr-drill-reminder.yml`** to add a `- [ ] Drill passed` checkbox; the operator checks
it before closing a drill issue, and the feed reads the checkbox on the newest closed
drill issue → `result: pass | fail`. (Alternatives rejected: date-only drops the
headline signal; a label relies on the operator remembering to label.)

**Source of truth = the drill issues (D-24330).** Open-past-its-month = overdue;
newest-closed = last drill. No parallel committed status ledger, no §7 parse.

## 4. Scope

**In:**
- Amend `dr-drill-reminder.yml`: add a `- [ ] Drill passed` line to the issue body.
- New `GET /api/dash/dr-readiness` in `apps/server` — `requireAdminSession`,
  `no-store`, `{ data: DrReadiness }`; **mock-first** (no `DASH_GITHUB_TOKEN` →
  `source:"mock"` + `200`, never 500); reads the drill issues via the GitHub REST API
  (explicit `owner/repo`; filters out PRs) with a ≥5-min in-process cache.
- New **DR Readiness** tile in `SystemHealthPage.vue`'s ops section (mock-first).
- `api-endpoints.md` row (Status `Wired`, Auth `admin-session-required`).

**Out:**
- No change to the reminder cadence/schedule (only the issue-body checkbox).
- No new dashboard page or `/vision` change; no issue mutation from server/dashboard.
- No `DISASTER_RECOVERY.md` content change; no `packages/**` change.

## 5. Files Expected to Change

- `.github/workflows/dr-drill-reminder.yml` — **modified** — add the `Drill passed` checkbox line.
- `apps/server/src/dashboard/dashboardDrReadiness.types.ts` — **new** — `DrReadiness` type.
- `apps/server/src/dashboard/dashboardDrReadiness.logic.ts` — **new** — **pure** `deriveDrReadiness(issues, referenceDate)` (reference date **injected**, never read internally).
- `apps/server/src/dashboard/dashboardDrReadiness.routes.ts` — **new** — route (admin gate, no-store, `{data}`, GitHub fetch + cache + repo-coordinate + PR-filter + token gate).
- `apps/server/src/dashboard/dashboardDrReadiness.routes.test.ts` — **new**.
- `apps/server/src/server.mjs` — **modified** (01.5 runtime-wiring: import + `registerDashboardDrReadinessRoutes`, mirroring the sibling registrations).
- `apps/dashboard/src/widgets/DrReadinessWidget.vue` — **new** — the tile (matches the `widgets/*Widget.vue` convention, e.g. `RuntimeHealthWidget.vue`; NOT `components/`, NOT `*Tile.vue`).
- `apps/dashboard/src/services/drReadinessMocks.ts` — **new** — its mock payload (flat `services/`, sibling to `opsHealthMocks.ts`).
- `apps/dashboard/src/pages/system/SystemHealthPage.vue` — **modified** (01.5 runtime-wiring: import + mount the widget).
- `apps/dashboard/src/widgets/DrReadinessWidget.test.ts` — **new**.
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — the endpoint row.
- Govern-close ledgers: `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md` (D-24330 Active), `docs/ai/STATUS.md`, `docs/05-ROADMAP-MINDMAP.md`. `NUMBER-LEDGER.md` is **already reserved** (not in the execution diff).

All dashboard files are exact (widget + mock + test, all **new**); the only edits to
**existing** files are the two `01.5` wiring files (`server.mjs`,
`SystemHealthPage.vue`), so `git diff --name-only` can equal the allowlist.

## 6. Contract

`GET /api/dash/dr-readiness` — **Auth:** `admin-session-required` (`requireAdminSession`,
D-15901). **Headers:** `Cache-Control: no-store` (first statement). **Status:** `200`
(admin) / `401` (unauth) / `403` (non-admin) / `500`. **Body:** `{ data: DrReadiness }`
(D-20503 envelope).

```
DrReadiness = {
  lastDrill: { date: "YYYY-MM-DD", result: "pass" | "fail" | "unknown" } | null,
  nextDue:   "YYYY-MM-DD",   // 1st of the next month (UTC), from the injected referenceDate
  overdue:   boolean,        // an OPEN drill issue whose title month < referenceDate month
  source:    "github" | "mock"
}
```

- `lastDrill` = newest **closed** drill issue; `result` from its `Drill passed`
  checkbox (checked → `pass`, present-unchecked → `fail`, absent → `unknown`).
- Field names follow the `/api/dash/*` projection convention (WP-373/374/439), not a
  new 00.2 lock.
- `DASH_GITHUB_TOKEN` (`sync:false`, `issues:read`); repo coordinate via an explicit
  `owner/repo` constant/env (no `GITHUB_REPOSITORY` outside Actions). Issues list
  filters out pull requests. Title match is the exact em-dash prefix `DR drill due — `.

## 7. Acceptance Criteria

- [ ] `GET /api/dash/dr-readiness` returns `200 { data }` + `no-store` for an admin; `401` unauth, `403` non-admin (mirrors `dashboardRuntime` tests).
- [ ] No `DASH_GITHUB_TOKEN` → `200` with `data.source:"mock"` (`overdue:false`, `lastDrill:null`) — no throw, no 500.
- [ ] `deriveDrReadiness(fixtureIssues, fixedDate)` yields the correct `lastDrill` (newest closed + `result` from the checkbox), `nextDue` (1st of next month), and `overdue` — time-independent via the injected `referenceDate`.
- [ ] Pull-request "issues" and non-matching titles are excluded from the derivation.
- [ ] The tile renders last drill / next due / overdue on `SystemHealthPage`, mock-mode by default, and does not appear on `/vision`.
- [ ] `api-endpoints.md` row present: Status `Wired`, Auth `admin-session-required` (closed sets), fields per the `/api/dash` convention.
- [ ] Dashboard Gates CI (lint/typecheck/coverage/format/build) green; `pnpm -r --no-bail test` green.

## 8. Verification Steps

1. `pnpm --filter @legendary-arena/server test` → routes + pure-logic tests pass.
2. Local `curl` with no token → `200`, `data.source:"mock"`.
3. `pnpm --filter @legendary-arena/dashboard test` + dashboard build green.
4. Live (D-24026, post-deploy): the tile reflects the current drill issue (#1299).

## 9. User-Visible Impact

Operator/admin only (behind the dashboard's Hanko + Cloudflare Access gate). Adds a
**DR Readiness** tile to the System-Health page: last drill (date + PASS/FAIL), next
due, overdue flag. No player-facing surface. Verified live per D-24026 (Step 8.4).

## 10. Definition of Done

- [ ] §4–6 implemented; all §7 criteria pass.
- [ ] `api-endpoints.md` updated (D-11804), Status `Wired` / Auth `admin-session-required`.
- [ ] Dashboard Gates + workspace tests green; `git diff --name-only` = the EC allowlist.
- [ ] D-24330 Active; WORK_INDEX/EC_INDEX/STATUS/mindmap updated; `roadmap:counts:check` exits 0.
- [ ] D-24026 live-verification recorded (operator-pending until deploy).

## Lint Gate Self-Review

Per `00.3` (21 sections), verdicts recorded at draft (re-run after this revision):
constraints block + `00.6` reference present (§1/§2); User-Visible Surface declared +
§9 present (§15.1); 7 acceptance criteria (§14); §21 API-catalog in-scope (whole-row
replace, closed-set Status/Auth). §17/§20 N/A (operator-only, no
scoring/RNG/funding surface). §9 N/A (no shell scripts).

Gate verdicts (2026-08-09): pre-flight READY TO EXECUTE; copilot PASS; lint PASS.
