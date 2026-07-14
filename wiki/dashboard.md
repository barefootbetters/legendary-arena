---
title: Dashboard
type: Tool
tags:
  - dashboard
  - operations
  - tooling
  - vue
  - primevue
  - cloudflare
  - hanko
  - mock-mode
  - ci
related:
  - operational-health-checks.md
  - profile-login.md
  - development-workflow.md
  - monetization-model.md
  - leaderboard.md
  - wiki-viewer.md
status: draft
source:
  - ../apps/dashboard/package.json
  - ../apps/dashboard/docs/dashboard-operating-system.md
  - ../apps/dashboard/docs/code-checks-and-balances.md
  - ../apps/dashboard/src/router/index.ts
  - ../apps/dashboard/src/services/mocks.ts
  - ../apps/dashboard/src/services/analyticsLiveFetchers.ts
  - ../apps/dashboard/src/services/api.ts
  - ../apps/dashboard/src/services/endpoints.ts
  - ../apps/dashboard/src/pages/players/PlayerAnalyticsPage.vue
  - ../apps/server/src/analytics/analytics.routes.ts
  - ../apps/dashboard/src/auth/hankoClient.ts
  - ../apps/dashboard/src/main.ts
  - ../.github/workflows/ci.yml
last-reviewed: 2026-07-13
---

# Dashboard

## Summary

The internal admin / operations dashboard for Legendary Arena — a Vue 3 +
PrimeVue 4 + Vite single-page app (`@legendary-arena/dashboard`) that deploys
to `dashboard.legendary-arena.com`. It is a **decision engine, not a data
display**: the layout encodes a daily morning-operating loop that reads
top-to-bottom in causal order (Audience → Revenue Engine → Retention &
Control) so the operator can answer one question — *"what single thing do I
fix first today?"* It is **mock-mode-first**: every metric feed renders
synthetic data by default and flips to a live API source only when the deploy
environment enables it.

> **Before trusting any number on the live dashboard:** no site-analytics
> platform is wired yet (Cloudflare Web Analytics / Plausible for traffic,
> Search Console for SEO all remain TODO), so threshold widgets stay in
> **no-data / mock mode** and mock-mode-first is the default posture. And
> *which* feeds have actually flipped **LIVE** in production is
> **deploy-environment state, not visible from this repo or this page** — check
> the Cloudflare Pages project env (`VITE_USE_MOCKS` / `VITE_API_BASE_URL`)
> rather than assuming a page is showing real data. Full detail in
> [§Open Questions](#open-questions) below.

## Mechanics

### Stack and shape

The app is a client-only SPA. Its dependency stack (from
[`apps/dashboard/package.json`](../apps/dashboard/package.json)):

- **Vue 3** + **vue-router** (client history routing) + **Pinia** (stores).
- **PrimeVue 4** with the **Aura** theme preset; **dark mode is the default**
  and is applied synchronously before mount to avoid a light-palette flash
  ([`src/main.ts`](../apps/dashboard/src/main.ts)).
- **ECharts** via **vue-echarts** for charts; chart types and the canvas
  renderer are registered explicitly at startup (vue-echarts does not
  auto-register them).
- **axios** for the live-mode HTTP client; **`@teamhanko/hanko-elements`** for
  sign-in.

It is **self-contained**: it has **no `@legendary-arena/*` runtime imports**,
so it neither needs the registry/engine build chain nor can import engine
types. The layered internal structure is **pages → widgets → composables →
services**:

- **Pages** (`src/pages/**`) are route targets; **widgets** (`src/widgets/**`)
  are the individual cards; **composables** (`src/composables/use*.ts`) hold
  per-metric logic; **services** (`src/services/**`) are the data layer (mock
  factories and live fetchers).

### Pages

Routing is defined once in
[`src/router/index.ts`](../apps/dashboard/src/router/index.ts). Every route
except `/login` sits behind an authenticated `AppLayout`:

| Route | Page | Focus |
|---|---|---|
| `/overview` | `OverviewPage` | Morning glance — KPI strip, funnel, revenue, governance |
| `/vision` | `VisionRoadmapPage` | Build vision + dated roadmap |
| `/coverage` | `CoveragePage` | Hero-mechanic + in-play effect coverage |
| `/players` | `PlayerAnalyticsPage` | A player-records table + traffic-sources, activation-funnel, retention-cohorts trend widgets (see [Data provenance](#the-players-page-data-provenance-and-what-it-is-not)) |
| `/monetization` | `MonetizationPage` | Revenue, net revenue, paid-action errors |
| `/gameplay` | `GameplayPage` | Match / gameplay analytics |
| `/system` | `SystemHealthPage` | Server status, error rate, ops-at-a-glance |
| `/pipeline` | `PipelinePage` | Governance throughput, sweep health, inspection triage |
| `/debug` | `DebugPage` | Feature flags / diagnostic surface |
| `/login` | `LoginPage` | Hanko sign-in (the only unauthenticated route) |

### The `/players` page: data provenance (and what it is NOT)

The name is misleading, so it is worth stating plainly: **`/players`
([`PlayerAnalyticsPage`](../apps/dashboard/src/pages/players/PlayerAnalyticsPage.vue))
is an acquisition/retention *analytics* view. It is not a directory of players,
and it has no connection to the friends-invite / lobby flow.** The page carries
two independent feeds, wired through two different HTTP clients:

| Feed on the page | Client | Live URL | Backed by |
|---|---|---|---|
| Traffic-sources, activation-funnel, retention-cohorts trend widgets | [`analyticsLiveFetchers.ts`](../apps/dashboard/src/services/analyticsLiveFetchers.ts) (via the `mocks.ts` `fetch*` aliases) | `${VITE_API_BASE_URL}/api/analytics/{traffic-sources,activation-funnel,retention-cohorts}` | **Real server routes** in [`apps/server/src/analytics/analytics.routes.ts`](../apps/server/src/analytics/analytics.routes.ts), reading the `legendary.analytics_events` table (session/UTM acquisition telemetry, per D-20501) |
| The player-records table (`fetchPlayerRecords` — handle, last-active, etc.) | [`endpoints.ts`](../apps/dashboard/src/services/endpoints.ts) → the axios `apiClient` ([`api.ts`](../apps/dashboard/src/services/api.ts), default base `…/api/dash`) | `${VITE_API_BASE_URL}/players` (`/api/dash/players` by default) | **No server route** — nothing under `/api/dash/*` is registered in `apps/server`. This feed is **mock-only** in practice ([`mockPlayerRecords()`](../apps/dashboard/src/services/mocks.ts) returns synthetic names like *"Alice Chen"*); a live call would 404. |

Both clients now share **one base-URL convention** (aligned 2026-07-13): the
`VITE_API_BASE_URL` is the API **server root** (e.g. `https://api.legendary-arena.com`),
and every call passes an **absolute** path — `analyticsLiveFetchers` builds
`/api/analytics/…`, and `apiClient` (`endpoints.ts`) builds `/api/dash/…`. So a single
`VITE_API_BASE_URL` serves both families. (Earlier the `apiClient` base baked in a
`/api/dash` suffix while `endpoints.ts` passed bare paths — that would have
double-prefixed the analytics fetchers and 404'd them in live mode; the fix moved the
`/api/dash` prefix onto the paths.) Server coverage: the `/api/analytics/*` widgets
plus the `endpoints.ts` **billing/revenue (WP-373)** and **matches/players/kpis
(WP-374)** feeds are now wired; `/metrics/dau`, `/alerts`, and `/system/nodes` remain
mock (no data source yet — see the note above).

> **Wiring underway (2026-07).** The `/api/dash/*` family is being wired to real
> data, and the **billing + revenue** slice is now **live server-side** — a new
> [`apps/server/src/dashboard/`](../apps/server/src/dashboard/dashboardBilling.routes.ts)
> module serves `GET /api/dash/metrics/billing/health` (+`/sparklines`),
> `/revenue`, and `/metrics/revenue` (all `admin-session-required`) from the Stripe
> tables: failure/abandonment rates from `stripe_events.process_error` +
> `stripe_checkout_sessions.intent_status`, and revenue amounts from the
> `checkout.session.completed` webhook envelope's `amount_total` (the price
> allowlist carries no amount, so the amount comes from the stored envelope, in
> cents ÷100; a missing amount is skipped, never fabricated). Executed as
> **WP-373 / EC-402 / D-24168** (Active). **These feeds still render mock in the
> deployed dashboard until the deploy sets `VITE_USE_MOCKS=false` + a
> `VITE_API_BASE_URL` and prod Stripe data flows** — code-live ≠ dashboard-live.
> The **gameplay + KPI slice** (`/matches`, `/players`, `/kpis`) is now **live
> server-side** — **executed as WP-374 / EC-403 / D-24169** — via
> `apps/server/src/dashboard/dashboardGameplay.{types,logic,routes}.ts`. `/matches`
> reads the `bgio.matches` blob as a read-only **match-summary projection**
> (extending the D-24095/24153 carve-out — a new ARCHITECTURE.md §Persistence
> Boundary sentence; `initial_state.G.matchConfiguration` + `metadata` only, never
> `state`/`log`), `/players` aggregates `competitive_scores` (with an *approximate*
> `lastActive` — no activity log exists), and `/kpis` returns the derivable subset
> with prior-window trends (**DAU omitted** — no activity signal). As with billing,
> these render mock in the deployed dashboard until the live flip. `/metrics/dau`
> stays deferred, and `/system/nodes` (infra telemetry) and `/alerts` (no alerting
> model) stay blocked until that data infrastructure exists.

**Why it is *not* the friends-invite / lobby flow.** That flow — friend
requests, match invites, the pre-match "Waiting for players" panel — lives in a
**different app and backend**: the play server (`apps/server`) operating on the
`legendary.friendships` / `match_invites` / `match_seat_accounts` / `players`
domain tables via `/api/me/friends*`, `/api/match/invites`, and
`/api/me/match-invites*`, surfaced on `play.legendary-arena.com` (the arena
client; see [Profile Login](profile-login.md) §Friends & Ranked Trust). The
dashboard reads **none** of those tables or endpoints. The only friends/invite
strings anywhere in `apps/dashboard` are merged Work-Packet titles in the
build-time [`governance-snapshot.json`](../apps/dashboard/src/data/governance-snapshot.json)
(the Pipeline/governance view) — build history, not a runtime data connection.

### Mock-mode-first (the LIVE flip seam)

Each analytics feed is exported from
[`src/services/mocks.ts`](../apps/dashboard/src/services/mocks.ts) as a
`fetch*`-aliased binding chosen by a single shared predicate,
`isLiveModeEnabled()`, defined in
[`src/services/analyticsLiveFetchers.ts`](../apps/dashboard/src/services/analyticsLiveFetchers.ts).
The predicate is the **single source of truth** for the flip (per D-20601):
live mode is on only when the deploy environment turns the use-mocks flag off
**and** supplies a non-empty API base URL. When it is off — the default, plus
all of local dev and the test runner — the **MOCK** factories run; when on, the
**LIVE** fetchers run. Widgets import the stable `fetch*` alias so their source
never changes across the flip (a byte-identity constraint from the WP-203/206
series). Live fetches attach an `Authorization: Bearer` token from the shared
`authToken.ts` seam (cookies are ignored — D-11202 / D-24003).

Mock envelopes are stamped `source: 'MOCK'`; a `MockModeBanner` component makes
the synthetic state visible on the surface.

### Build-time generated data

Two data files are **generated at build time and git-ignored**, yet imported
statically by composables — so they must exist before typecheck, test, or build
can resolve the module. The `build` script runs both generators before
`vite build`:

- `src/data/governance-snapshot.json` — produced by
  `scripts/build-governance-snapshot.mjs` (reads `git log`); consumed by
  `useGovernanceSnapshot`.
- `src/data/coverage-ledger.json` — a build-time copy of the committed hero
  mechanic ledger, produced by `scripts/build-coverage-ledger.mjs`; consumed by
  `useCoverageLedger`.

The in-play effect baseline (`src/data/in-play-hollow-baseline.json`) is, by
contrast, **committed**.

### Auth and deploy boundary

Sign-in is brokered through **Hanko**. The dashboard carries its **own**
single-file broker wrapper,
[`src/auth/hankoClient.ts`](../apps/dashboard/src/auth/hankoClient.ts) — the
only file allowed to import `@teamhanko/*` — mirroring the broker-confinement
discipline used by the player app (see [Profile Login](profile-login.md)).
Route guarding gates **purely on `isAuthenticated`** (token present); role-based
routing was retired (WP-241 / D-24004), and admin role-scoping is deferred to a
server-side follow-up. In front of the deploy, **Cloudflare Access (WP-197)** is
the operator-reachability boundary. The app deploys as the Cloudflare Pages
project `legendary-arena-dashboard`.

### CI — the Dashboard Gates job

CI runs a self-contained **Dashboard Gates** job
([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) that wires the
checks from `apps/dashboard/docs/code-checks-and-balances.md §11`. Because the
app has no `@legendary-arena/*` runtime imports, the job needs no prior build
artifacts. It first generates the two git-ignored data files
(`prebuild:snapshot`, `prebuild:coverage`), then runs five **blocking** gates:

1. **Lint** (`eslint`)
2. **Typecheck** (`vue-tsc --noEmit`)
3. **Test** (`test:coverage` — node:test with coverage floors of 90% lines /
   80% branches / 88% functions)
4. **Format check** (`prettier --check`)
5. **Build** (`vite build`, after the two generators)

Any single gate failing reds the whole job — and, because it runs on every PR,
every PR.

### Operating model (design intent)

The daily operating system the layout encodes is specified in
[`apps/dashboard/docs/dashboard-operating-system.md`](../apps/dashboard/docs/dashboard-operating-system.md):
a **Priority Action** widget collapses all signals into one "fix this first"
decision, ranked by a deterministic cascade order (System-critical → Audience →
Offense → Retention). Metric widgets report one of four statuses — **Pass /
Warning / Critical / No-data** — with No-data made explicitly visible so the
operator's instrumentation blind spots create pressure to close them. The
current build is largely **Phase 1 (structure with mock data)**; per-widget
threshold enforcement activates as real data sources are wired.

## Interactions

- **[Profile Login](profile-login.md)** — the player-facing auth stack. The
  dashboard reuses the same **Hanko broker-confinement** pattern but is a
  **distinct app** with its own `hankoClient.ts` copy on a different domain
  (`dashboard.` vs `play.`). That page's F-2 note about "the only file allowed
  to import `@teamhanko/*`" is scoped to the arena-client copy.
- **[Operational Health Checks](operational-health-checks.md)** — the sibling
  operator surface. Those are stand-alone `pnpm check` probe *scripts*; this is
  a hosted *SPA*. They are complementary, not the same tooling.
- **[Monetization Model](monetization-model.md)** — the Monetization page
  surfaces the revenue streams that model describes (revenue, net revenue after
  royalties/costs, paid-action errors).
- **[Leaderboard](leaderboard.md)** / vision — the Vision & Roadmap page tracks
  build priorities; the coverage page reads the hero mechanic ledger the effect
  grind maintains.
- **[Development Workflow](development-workflow.md)** — the nightly CI triage /
  sweep feeds (governance throughput, sweep health, inspection triage) are the
  data the Pipeline page renders.

## Edge Cases

- **Numbers are synthetic by default.** The dashboard is mock-mode-first — an
  unwired feed shows randomized mock data, not zeros or real figures. Confirm
  the `source: 'MOCK'` envelope (or the `MockModeBanner`) before trusting any
  number; a "live-looking" figure may be a mock factory until the LIVE flip is
  enabled for that feed.
- **`pnpm test` run bare fails on the generated-data composables — this is a
  local-setup artifact, not a repo red.** `useGovernanceSnapshot`,
  `useCoverageLedger`, and the composables that chain off them statically import
  `governance-snapshot.json` / `coverage-ledger.json`, which are generated and
  git-ignored. Running the suite without first running `prebuild:snapshot` +
  `prebuild:coverage` makes those tests fail to resolve the module. CI generates
  both files before the test step, so Dashboard Gates stays green and the full
  suite passes once the data exists. If those specific tests fail locally, run
  the two generators first — do not diagnose it as a regression on `main`.
- **The format gate is blocking and unforgiving.** `format:check` is a Dashboard
  Gates step: any file under `src/**/*.{ts,vue,css,json}` that does not satisfy
  Prettier reds the entire job — and therefore every open PR. This happened when
  the WP-241 `hankoClient.ts` + test were committed without passing Prettier;
  the gate stayed red until an `INFRA:` format-only commit fixed it
  (2026-07-09). Run `format:check` (or `format`) before committing.
- **Run every gate locally before committing.** The Dashboard Gates set is lint
  + typecheck + `test:coverage` + `format:check` + build. Passing only one or
  two locally still lets the job red on a check you skipped.
- **Self-contained, so contract drift is manual.** With no `@legendary-arena/*`
  imports, the dashboard cannot share engine/server types; any alignment between
  its live-fetcher response shapes and the real server contracts is maintained
  by hand.
- **Dark mode is the default.** A missing / unrecognized `la-dashboard-theme`
  localStorage value renders the dark Aura palette, not light.

## Code Touchpoints

- [`apps/dashboard/package.json`](../apps/dashboard/package.json) — scripts
  (`dev` / `build` / `typecheck` / `test` / `test:coverage` / `format:check`)
  and the dependency stack.
- [`src/router/index.ts`](../apps/dashboard/src/router/index.ts) — routes and
  the `isAuthenticated`-only guard (WP-241 / D-24004).
- [`src/services/mocks.ts`](../apps/dashboard/src/services/mocks.ts) — mock
  factories and the `fetch*` alias exports that switch on `liveMode`.
- [`src/services/analyticsLiveFetchers.ts`](../apps/dashboard/src/services/analyticsLiveFetchers.ts)
  — `isLiveModeEnabled()`, the single LIVE-flip predicate.
- [`src/auth/hankoClient.ts`](../apps/dashboard/src/auth/hankoClient.ts) — the
  broker-confined Hanko wrapper (only `@teamhanko/*` importer).
- [`src/main.ts`](../apps/dashboard/src/main.ts) — PrimeVue/Aura theme, ECharts
  registration, synchronous initial-theme application.
- `apps/dashboard/scripts/build-governance-snapshot.mjs`,
  `build-coverage-ledger.mjs` — the two build-time data generators.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — the Dashboard
  Gates job (§3c).

## Data Files

- `src/data/governance-snapshot.json` — **generated, git-ignored**
  (`build-governance-snapshot.mjs`, reads `git log`).
- `src/data/coverage-ledger.json` — **generated, git-ignored** (build-time copy
  of the hero mechanic ledger).
- `src/data/in-play-hollow-baseline.json` — **committed** effect-coverage
  baseline.
- `src/config/infraCostBudgets.ts`, `src/config/revenueDeductions.ts` — cost /
  revenue-deduction configuration.
- `src/data/buildRoadmap.ts` — the vision/roadmap source data.

## Open Questions

- **No site-analytics platform is wired yet.** Until one is (e.g., Cloudflare
  Web Analytics / Plausible for traffic, Search Console for SEO), threshold
  widgets stay in no-data or mock mode and mock-mode-first remains the default
  posture. See the *Open Questions* in
  [`dashboard-operating-system.md`](../apps/dashboard/docs/dashboard-operating-system.md).
- **Which feeds have flipped LIVE in production** is deploy-environment state,
  not visible from the repo — check the CF Pages project env (`VITE_USE_MOCKS` /
  `VITE_API_BASE_URL`) rather than assuming a page is showing real data.

## References

- [`apps/dashboard/docs/dashboard-operating-system.md`](../apps/dashboard/docs/dashboard-operating-system.md)
  — the daily operating-system design (phases, Priority Action, status model).
- [`apps/dashboard/docs/build-vision-and-roadmap.md`](../apps/dashboard/docs/build-vision-and-roadmap.md),
  [`jarvis-command-center.md`](../apps/dashboard/docs/jarvis-command-center.md),
  [`code-checks-and-balances.md`](../apps/dashboard/docs/code-checks-and-balances.md)
  — companion app design docs.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — Dashboard Gates
  (§3c) and its blocking check set.
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-24004 (routing gates on
  `isAuthenticated`), D-20601 / D-24003 (LIVE-flip seam + bearer-token auth),
  D-11202 (server requires `Authorization: Bearer`).
- [Profile Login](profile-login.md) — the player-facing Hanko auth stack this
  dashboard's broker pattern mirrors.
- [Operational Health Checks](operational-health-checks.md) — the sibling
  operator-probe scripts.
- [Wiki Viewer](wiki-viewer.md) — how to author, preview, and publish ewiki
  pages like this one.
