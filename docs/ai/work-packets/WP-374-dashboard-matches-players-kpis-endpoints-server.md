# WP-374 — Dashboard Matches + Players + KPIs Endpoints (Server): wire the `/api/dash` gameplay + KPI slice to real data

**Status:** Draft 2026-07-13 · **READY (not blocked — all hard-deps Done)** · **Large lane** (3 read endpoints across 3 concerns — a bgio-blob carve-out read, a domain-table aggregate, and a composed-KPI surface — plus an ARCHITECTURE.md persistence-boundary carve-out extension). Pairs with **EC-403** (execution-prep). Reserves **D-24169** (lands at execution).
**Primary Layer:** Server (`apps/server`) — extends the WP-373 `apps/server/src/dashboard/` module + the `/api/dash/*` surface.
**User-Visible Surface:** `dashboard.legendary-arena.com` — the `/players`, `/gameplay`, and `/overview` KPI-strip widgets flip mock → live once the deploy enables live mode. **D-24026 live-verify APPLIES** (deploy + prod-data-dependent).
**Dependencies:** WP-373 (the `/api/dash/*` module + admin gate + `{ data }` envelope) ✅; WP-361 (the D-24153 bgio-blob read pattern + registry ext_id→name resolution) ✅; WP-338/342/344 (`competitive_scores` outcome + player_count) ✅; WP-107/159 (`requireAdminSession` + `is_suspended`) ✅; WP-309 (`bgio.matches` store) ✅. **No unmerged dependency.**
**Baseline:** `origin/main` @ (capture at execution).

---

## Goal

Continue wiring the dashboard's `/api/dash/*` family (WP-373 did billing+revenue) to real data with the **gameplay + KPI slice**: `/matches`, `/players`, and the derivable subset of `/kpis`. Today the dashboard's `endpoints.ts` calls these paths in live mode but no server route serves them → mock-only. This packet adds them to the WP-373 `dashboard` module, reusing its admin gate and `{ data }` envelope, and extends the D-24095/24153 bgio-blob-read carve-out to authorize a read-only **match-summary/analytics projection**.

---

## User-Visible Impact

With the routes live and the deploy flipped, the dashboard's Player-Analytics table shows **real** players (matches played, win rate, status), the Gameplay page shows **real** recent matches (scheme, mastermind, player count, outcome, duration), and the Overview KPI strip shows **real** totals (players, matches, 30-day revenue, hero-win rate) with prior-window trends. (Low/empty numbers if prod volume is low is the accurate reflection — the legends-board "empty = data-supply state" precedent.)

---

## Assumes

- **`bgio.matches` carries the match setup + result** (migration 023, WP-309): `initial_state.G.matchConfiguration` (9-field composition incl. `schemeId`/`mastermindId`), `initial_state.ctx.numPlayers`, `metadata.createdAt`/`updatedAt` (ms), `metadata.gameover` (absent = in-progress; present = finished with a winner). (Verified: 023 schema + the bgio store test's `metadata.createdAt`.)
- **`competitive_scores` carries outcome + count** (026/027): `outcome ∈ {'heroes-win','scheme-wins'}` (nullable), `player_count` (nullable), `player_id`, `created_at`. (Verified.)
- **`legendary.players` carries the PlayerRecord fields**: `display_name`, `email`, `is_suspended` (015), `ext_id`, `created_at`. `matchesPlayed`/`winRate` are aggregated from `competitive_scores` by `player_id`; `lastActive` is **approximate** (the player's most recent `competitive_scores.created_at`, falling back to `players.created_at`) — there is no per-account activity/session log (the standing "no site-analytics" gap). (Verified.)
- **Scheme/mastermind resolve to display names via the startup registry** (the WP-361 idiom — ext_id → name, id-fallback). (Verified.)
- **The WP-373 `dashboard` module + `/api/dash/*` admin surface exist** and are the home for these routes. (Verified — on `main`.)
- **The revenue aggregate is reusable** from WP-373's `getRevenueDaily`/logic for the revenue KPI. (Verified.)

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` **D-24095 / D-24119 / D-24153** — the bgio-blob-read carve-out and its prior extensions (replay verification; Tier-1 LAGN loadout projection). This WP adds a **match-summary/analytics projection** extension.
- `apps/server/src/match/matchLagn.logic.ts` (WP-361) — the `SELECT initial_state`-only blob read + `matchConfiguration` parse + registry name resolution to mirror.
- `apps/server/src/dashboard/dashboardBilling.{types,logic,routes}.ts` (WP-373) — the module, admin gate (`requireAdminSession`), `{ data }` envelope, range handling, and pure-math/day-fill idioms to reuse.
- `apps/dashboard/src/types/index.ts` — the exact `MatchRecord`, `PlayerRecord`, `KpiSnapshot` (+ `KPI_STATUSES`) shapes the server must produce.
- `.claude/rules/architecture.md §Persistence Boundary (Cross-Layer)` + `docs/ai/ARCHITECTURE.md §Persistence Boundary` — the carve-out text to extend (both files, per the D-24153 precedent).

---

## Non-Negotiable Constraints

- ESM; `node:` built-ins; human-style code (`00.6`); JSDoc; `.test.ts`.
- **Server-layer only.** Reads Postgres (domain + `bgio` blob). No engine/registry-runtime gameplay import beyond the setup-time registry used for name resolution (the WP-361 pattern). No `boardgame.io` gameplay import; no write to any table; no migration.
- **Blob read is projection-only (carve-out discipline).** The `bgio.matches` read is a **read-only match-summary projection** — `initial_state.G.matchConfiguration` + `ctx.numPlayers` (setup) and `metadata.{createdAt,updatedAt,gameover}` (timing + result). **Never** `state`/`log`, never written back, never a source of gameplay state, never round-tripped. This is a NEW carve-out purpose → **D-24169 + the ARCHITECTURE.md §Persistence Boundary + rules-mirror edit** (mirroring D-24153).
- **Admin gate on every route** — `requireAdminSession` first statement, `no-store` first, mapped 401/403/500 (reuse the WP-373 `passesAdminGate` idiom). Bare `{ data: T }` (D-20503).
- **Honest-partial KPIs.** `/kpis` returns only the **derivable** KPIs (total players, total matches, 30-day revenue, hero-win rate, and similar). **DAU and any activity-derived KPI are OMITTED** (no activity signal exists — do not fabricate). Each KPI carries `previousValue` from the prior equal-length window for the trend; `target`/`tolerance`/`direction` only where a real threshold is known (else omitted, per D-19802).
- **Types mirror the dashboard contract inline** (no cross-app import; drift note → `apps/dashboard/src/types/index.ts`).
- **Never fabricate.** A match with no `gameover` is `in_progress` (not a guessed winner); a player with no scores has `matchesPlayed: 0` / `winRate: 0` (not null-coerced oddly); `lastActive` fallback is explicit.

---

## Scope (In)

### A) `/api/dash/matches` — `MatchRecord[]`
- New `dashboard/dashboardMatches.{types,logic,routes}.ts`. Reads recent `bgio.matches` (LIMIT, newest by `updated_at`), projecting each: `id` = matchId; `scheme`/`mastermind` = the `matchConfiguration` ext_ids resolved to display names (registry, id-fallback); `playerCount` = `ctx.numPlayers`; `startedAt` = `metadata.createdAt` (ISO); `duration` = `metadata.updatedAt − createdAt` seconds (0 if in-progress-and-unknown); `outcome` = `metadata.gameover` absent → `in_progress`, present → `hero_wins`/`villain_wins` per the gameover winner. Rows whose `initial_state` is null (setState-upsert artifacts) are skipped.

### B) `/api/dash/players` — `PlayerRecord[]`
- New `dashboard/dashboardPlayers.{types,logic,routes}.ts`. `legendary.players` LEFT JOIN aggregated `competitive_scores` (by `player_id`): `id` = ext_id; `name` = display_name; `email`; `matchesPlayed` = score count; `winRate` = `heroes-win` fraction; `status` = `is_suspended` → `banned`, else `active`/`inactive` by a recency threshold on `lastActive`; `lastActive` = max(`competitive_scores.created_at`) ?? `players.created_at`. Column-enumerated SQL; `for...of` aggregation.

### C) `/api/dash/kpis` — `KpiSnapshot[]`
- New `dashboard/dashboardKpis.{types,logic,routes}.ts`. Composes the **derivable** KPIs, each with a current + prior-window value for the trend: total players, new players (window), total matches, matches (window), 30-day revenue (reuse WP-373 `getRevenueDaily`), hero-win rate. Trend = up/down/flat from `previousValue`. `unit`/`label` per the dashboard's KPI conventions. **DAU/active-user KPIs omitted** (documented).

### D) Persistence-boundary carve-out extension (D-24169)
- `docs/ai/ARCHITECTURE.md §Persistence Boundary` + `.claude/rules/architecture.md §Persistence Boundary` each gain a sentence authorizing the read-only match-summary/analytics projection (matchConfiguration + numPlayers + metadata timing/gameover), mirroring the D-24153 loadout-projection sentence.

### E) `docs/ai/REFERENCE/api-endpoints.md` (D-11804) — 3 new `Wired` rows.

### F) Tests
- Pure logic tests (fake pool): match projection (in-progress vs finished outcome, null-initial_state skip, name resolution via an injected resolver); player aggregation (0-score player, win-rate math, status mapping, lastActive fallback); KPI composition + trend (prior-window compare, DAU omitted).
- Route tests (fake router + injected gate): admin gate, `no-store`, `{ data }` shape.
- DB-gated integration (skip-when-no-`TEST_DATABASE_URL`): seed a `bgio.matches` row (initial_state + metadata) + players + competitive_scores, assert the three responses; clean up in `after()`.

---

## Out of Scope

- **`/metrics/dau`** — no true active-user signal; a rough proxy is deferred (not fabricated here).
- **`/system/nodes` + `/alerts`** — no data source (infra telemetry / alerting model); blocked on new infrastructure.
- **No migration / no write / no new activity-tracking** — `lastActive` stays an approximation over existing data.
- **No dashboard-app code change** — the client already calls these paths; the live flip is a deploy-env action.
- **No new `finance` role** — admin gate (WP-373 precedent).

---

## Files Expected to Change

- `apps/server/src/dashboard/dashboardMatches.{types,logic,routes}.ts` — **new** (+ tests)
- `apps/server/src/dashboard/dashboardPlayers.{types,logic,routes}.ts` — **new** (+ tests)
- `apps/server/src/dashboard/dashboardKpis.{types,logic,routes}.ts` — **new** (+ tests)
- `apps/server/src/dashboard/dashboard.integration.test.ts` — **new** (DB-gated; may extend the WP-373 integration file)
- `apps/server/src/server.mjs` — **modified** (register the 3 route groups)
- `docs/ai/ARCHITECTURE.md` + `.claude/rules/architecture.md` — **modified** (D-24169 carve-out extension)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (3 rows, D-11804)
- Governance: `WORK_INDEX.md` + `DECISIONS.md` (**D-24169**) + `STATUS.md` + `wiki/dashboard.md` + mindmap. `EC_INDEX.md` + EC-403 at execution-prep.

**3 endpoint groups + a carve-out extension + catalog + tests. Large lane.** No engine/registry-runtime gameplay import; no migration.

---

## Contract

- **Routes (all `admin-session-required`, bare `{ data }`):** `GET /api/dash/matches`, `GET /api/dash/players`, `GET /api/dash/kpis`.
- **Locked Values:**

| Key | Value |
|---|---|
| Surface / gate / envelope | WP-373 `/api/dash/*` module, `requireAdminSession`, `{ data: T }` (D-20503) |
| Matches source | `bgio.matches` projection: `initial_state.G.matchConfiguration` (scheme/mastermind → registry names) + `ctx.numPlayers` + `metadata.{createdAt,updatedAt,gameover}` — carve-out D-24169 |
| Outcome map | gameover absent → `in_progress`; present → `hero_wins` / `villain_wins` (never guessed) |
| Players source | `players` LEFT JOIN aggregated `competitive_scores`; status via `is_suspended` + recency; `lastActive` = max score `created_at` ?? `players.created_at` (approximate) |
| KPIs | derivable subset only (players/matches/revenue/hero-win-rate) + prior-window `previousValue`; **DAU omitted** |
| Identity | admin surface; ext_id is the row `id`; no bearer/PII beyond what the dashboard shows |

---

## Acceptance Criteria

1. 3 routes registered under `/api/dash/*`, each `requireAdminSession`-first + `no-store` + `{ data }` (**AC-1**).
2. `/matches` projects the bgio blob (scheme/mastermind names, numPlayers, timing, outcome), maps gameover→outcome, skips null-`initial_state` rows, and reads projection-only (no `state`/`log`, no write) (**AC-2**).
3. `/players` aggregates matchesPlayed/winRate from `competitive_scores`, maps status from `is_suspended`, and derives an approximate `lastActive` with the documented fallback; a 0-score player is `0`/`0`, not null (**AC-3**).
4. `/kpis` returns the derivable KPIs with prior-window `previousValue`/trend and **omits DAU**; no fabricated values (**AC-4**).
5. `ARCHITECTURE.md` + rules mirror gain the D-24169 match-summary-projection carve-out sentence; `api-endpoints.md` gains 3 `Wired` rows (D-11804) (**AC-5**).
6. No engine/registry-runtime gameplay / `boardgame.io` import; no migration; no dashboard-app change (**AC-6**).
7. Server no-DB suite green; DB-gated integration green; `pnpm -r build` 0 (**AC-7**).

---

## Verification Steps

```pwsh
pnpm -r build   # 0
pnpm --filter @legendary-arena/server exec node --import tsx --test "src/dashboard/**/*.test.ts"
Select-String -Path "apps\server\src\dashboard\dashboardMatches.logic.ts" -Pattern "initial_state|matchConfiguration|gameover"
Select-String -Path "apps\server\src\dashboard\*.ts" -Pattern "boardgame.io|game-engine|\bstate\b.*log"   # no forbidden blob/gameplay reads
Select-String -Path "docs\ai\ARCHITECTURE.md",".claude\rules\architecture.md" -Pattern "match-summary|analytics projection|D-24169"
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `/matches` + `/players` + `/kpis` live under `/api/dash/*`, admin-gated, `{ data }`; blob read projection-only
- [ ] D-24169 carve-out extension in ARCHITECTURE.md + rules mirror; `api-endpoints.md` 3 rows
- [ ] Honest-partial KPIs (DAU omitted, documented); nothing fabricated
- [ ] No engine/registry-runtime gameplay / bgio import; no migration; no dashboard-app change
- [ ] Server no-DB suite green; DB-gated integration green; `pnpm -r build` 0
- [ ] `DECISIONS.md` **D-24169** Active; `WORK_INDEX` (WP-374) + `STATUS.md` + `api-endpoints.md` + `wiki/dashboard.md` + mindmap updated
- [ ] **D-24026:** APPLIES — deploy + live-flip + prod-data-dependent; execution proof is the DB-gated integration suite (seeded → asserted)

---

## Vision Alignment

§Operating Posture (operator visibility into gameplay + growth is the standing dashboard gap — real matches/players/KPIs make the morning-operating loop truthful). Business & commerce (surfacing real metrics is pro-operations). NG-1 N/A. §23(b) N/A (operator surface). Determinism N/A (live DB read; the blob read is a read-only projection, never gameplay state).

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. §5 large lane (3 endpoint groups + carve-out); §8 Server boundary (Postgres + read-only blob projection; setup-time registry only; no gameplay import); §11 admin gate every route; §14 the carve-out extension is a persistence-boundary change → ARCHITECTURE.md + rules mirror edited in the impl commit (per the D-entry-requires-architecture-edit rule); §15.1 APPLIES (deploy+data-dependent; integration suite is the proof); §17 operating-posture, determinism N/A; §21 APPLIES (3 `Wired` rows). §18 greps target the blob-projection fields + the no-`state`/`log`/gameplay-import absence checks + the carve-out sentence.

## Pre-Flight / Copilot (drafter self-review, large lane)

**Pre-flight (01.4): READY.** All hard-deps Done (WP-373 module + admin surface; WP-361 blob-read + name resolution; competitive_scores outcome/count; players columns; bgio store). Single layer (server). The one architectural element — the carve-out extension — is well-precedented by D-24153.

**Copilot (01.7): PASS.** Failure modes pinned: (a) reading `state`/`log` or writing the blob → **projection-only: matchConfiguration + numPlayers + metadata timing/gameover, read-only, carve-out-bounded**; (b) guessing a winner for an in-progress match → **gameover absent = in_progress, never guessed**; (c) fabricating DAU/activity KPIs → **omit; honest-partial, documented**; (d) a 0-score player null-coercing → **0/0 explicit**; (e) skipping the ARCHITECTURE.md edit that D-24169 requires → **edit ARCHITECTURE.md + rules mirror in the impl commit**; (f) drift from the dashboard shape → **inline mirror + drift note**; (g) over-scoping into `/system/nodes`/`/alerts` → **fenced out (no data source)**. Consider splitting into WP-374 (matches+players) + a follow-on (kpis) if the single-session execution proves too large — the KPI part naturally composes A+B+revenue.

## Decision (reserved, lands at execution)

Reserves **D-24169**: wire the dashboard's `/api/dash/*` gameplay + KPI slice (`/matches`, `/players`, `/kpis`) to real data (the second `/api/dash/*` slice after WP-373 billing+revenue), and **extend the D-24095/24119/24153 bgio-blob-read carve-out** to authorize a **read-only match-summary/analytics projection**. Locks: (1) three `admin-session-required` routes on the WP-373 `dashboard` module, bare `{ data }`; (2) `/matches` projects `bgio.matches` — `initial_state.G.matchConfiguration` (scheme/mastermind → registry names) + `ctx.numPlayers` + `metadata.{createdAt,updatedAt,gameover}` — **projection-only** (never `state`/`log`, never written, never gameplay state; gameover absent → in_progress, present → hero/villain win; null-initial_state rows skipped); (3) `/players` aggregates matchesPlayed/winRate from `competitive_scores`, status from `is_suspended`, and an **approximate** `lastActive` (max score `created_at` ?? `players.created_at`); (4) `/kpis` returns the **derivable subset** (players/matches/revenue-reusing-WP-373/hero-win-rate) with prior-window trends — **DAU/activity KPIs omitted, not fabricated**; (5) the ARCHITECTURE.md §Persistence Boundary + rules-mirror carve-out sentence (mirroring D-24153); (6) no migration, no write, no dashboard-app change. `/system/nodes` + `/alerts` remain blocked on absent infrastructure. Drafted 2026-07-13; not yet landed.
