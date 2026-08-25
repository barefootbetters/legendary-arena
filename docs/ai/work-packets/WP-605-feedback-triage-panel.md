# WP-605 — Feedback Triage Panel (operator status authoring)

**Status:** Ready
**Primary Layer:** Server (`apps/server`) + App (`apps/dashboard`)
**Dependencies:** WP-604 / EC-639 (the `legendary.feedback_item` / `legendary.feedback_vote` tables + `apps/server/src/feedback/` module), WP-131 / adminSession (`requireAdminSession` operator gate), the WP-373/374/439 `/api/dash/*` + dashboard-panel pattern
**User-Visible Surface:** dashboard (a new **Feedback** triage page on `dashboard.legendary-arena.com`; operator-only)

> Baseline: `origin/main` @ `745a8d78` (WP-604 merged). This packet is the
> first follow-on to WP-604 named in D-24414 — the **operator triage panel** —
> and lands the status-authoring half of the *Surfaces and authority* split.

---

## Session Context

D-24414 built the feedback system custom on the Postgres + Hanko + Dashboard stack and split its surfaces by authority — *players author demand, the operator authors status, the codebase authors "done"* (ewiki `user-feedback-and-public-roadmap.md §Surfaces and authority`). WP-604 shipped the intake/voting backbone and **deferred all status authoring to this packet** (its EC-639 forbade any `UPDATE ... status` in `apps/server/src/feedback/`). This WP lands that authoring: the operator-only server endpoints that read the whole feedback queue and write an item's status, plus the `dashboard.legendary-arena.com` triage page that drives them. It is the **first and only** code that writes `feedback_item.status` / `resolution_reason`.

---

## Goal

After this session the operator has a **Feedback** triage page on
`dashboard.legendary-arena.com` that lists the entire feedback queue — every
`bug` / `enhancement` / `review`, every status, with each item's projected
`voteCount` — and lets the operator move an item through the closed status set
(`Under review → Planned → In progress → Shipped → Declined`), supplying a
required `resolution_reason` when declining. Two new **admin-gated** server
endpoints back it: `GET /api/dash/feedback` (list all items) and
`PATCH /api/dash/feedback/:id/status` (author status). Status is written
**only** here (the dashboard is the sole status writer, D-24416); players never
set it, and the public `GET /api/feedback` continues to only *display* it.

---

## User-Visible Impact

An operator opening `dashboard.legendary-arena.com/feedback` sees the triage
queue: a sortable/filterable table of every submitted item (type, title, status,
vote count, submitted date) and, per row, a control to set the item's status —
with a reason field that appears (and is required) when the status is
**Declined**. Setting a status persists immediately and the row reflects the new
state. No player-, visitor-, or public-facing surface changes: this is the
operator's private triage tool, gated by the existing single Hanko + Cloudflare
Access admin gate. (Surface = dashboard, D-24026 live-verify applies.)

---

## Assumes

- **WP-604 complete on `main`.** `legendary.feedback_item`
  (`id, feedback_type, title, description, author_ext_id, status, resolution_reason,
  created_at, updated_at`) + `legendary.feedback_vote` exist; the
  `apps/server/src/feedback/` module exports `FeedbackType` / `FeedbackStatus`
  (+ their canonical arrays), `FeedbackItemRecord`, `insertFeedbackItem`,
  `listPublicEnhancements`, `countVotesForItem`, `addVote`, `removeVote`, and
  registers the four public `/api/feedback` routes. **WP-604 wrote no status**
  (column DEFAULT `under_review`); this packet is the deferred status author.
- **The `requireAdminSession` operator gate exists** (`apps/server/src/auth/adminSession.ts`):
  a Hanko bearer session + a single `is_admin` lookup on `legendary.players`,
  injected into the dashboard registrars in `server.mjs` as
  `{ requireAdminSession, verifier, accountResolver }`. `adminSession.ts` is the
  **only** site permitted to read `is_admin` (a grep gate enforces it — the
  triage routes must never inline an `is_admin` check).
- **The `/api/dash/*` + dashboard-panel pattern is established** (WP-373/374/439):
  `registerDashboard*Routes(router, pool, deps)` with `Cache-Control: no-store`
  first, a `{ data: T }` success envelope, `{ code }` errors; the dashboard fetches
  through `services/endpoints.ts` (`isMockMode()` per call) + `useFetch` + the
  axios `apiClient` (which attaches the bearer). `dashboardBilling.routes.ts` is
  the read model; `apps/server/src/profile/admin/adminProfile.routes.ts` is the
  admin **write/PATCH** model.
- **Dashboard test/CI:** the dashboard test runner is `node --import tsx --test`
  over `src/**/*.test.ts` — it **cannot mount `.vue`**, so panel logic lives in
  pure `.ts`; the "Dashboard Gates" CI job runs lint (`eslint src/**/*.{ts,vue}`),
  typecheck (`vue-tsc --noEmit`), `test:coverage` (lines 90 / branches 80 /
  functions 88), `format:check`, and `build`.
- `pnpm --filter @legendary-arena/server test` and
  `pnpm --filter @legendary-arena/dashboard build` exit 0 on `main`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- **`wiki/user-feedback-and-public-roadmap.md §Surfaces and authority` + `§Stage 2 — Tracking`** — the design authority: the dashboard is the *only* status writer; the five public statuses and their meaning; `resolution_reason` required on Declined; "Shipped" reflects the WP/git spine (operator-set here, auto-derivation is a follow-on).
- **`.claude/rules/architecture.md §Persistence Boundary` + `.claude/skills/legendary-server/SKILL.md`** — `feedback_item` is an ordinary domain table; the server wires + stores, it does not decide gameplay; no engine/`boardgame.io`/registry runtime import.
- **`apps/server/src/auth/adminSession.ts`** — `requireAdminSession` shape + the `AdminSessionResult` closed union (`unauthorized`→401, `forbidden`→403, `lookup_failed`→500). Do **not** read `is_admin` anywhere else.
- **`apps/server/src/dashboard/dashboardBilling.routes.ts`** — the admin-gated **read** route pattern to mirror verbatim in shape: local structural `KoaRouter`, `passesAdminGate`, `Cache-Control: no-store` first, `{ data }` envelope, `try/catch` → typed 500, `pg` only via the injected client (logic owns SQL).
- **`apps/server/src/profile/admin/adminProfile.routes.ts`** — the admin **write** *shape* to mirror: body validation → a not-found (404) path → delegation to a pure validator + a persistence writer → recording the acting admin from the gate result. **Caveat:** its writes are `router.post` (there is **no** existing PATCH-verb route in the server — `@koa/router` supports `.patch()`, so WP-605's PATCH is fine, just the first of its kind), and it attaches **no** body parser (it parses no body / relies on injected test bodies) — so it is **not** the body-parse exemplar. Take the body-parse pattern from `feedback.routes.ts` instead (next bullet).
- **`apps/server/src/feedback/feedback.{types,logic,persistence,routes}.ts`** — the WP-604 module this extends: the record shape, the pure-validator + projection-shaper idiom in `feedback.logic.ts`, the single-`pg`-file rule in `feedback.persistence.ts` (`ON CONFLICT` / row-mapper helpers), and — the body-parse model for the PATCH — the `ensureJsonBodyParsed` **stream-guarded** wrapper around a route-scoped `koaBody()` (`feedback.routes.ts`; it short-circuits when `koaContext.req.on` is not a function, so a bare `koaBody()` does not crash the injected-stub unit-test context, and prod `request.body` is defined). A raw `koaBody()` without the guard would break the route tests; adminProfile's bodyless read parses nothing.

  > **Contract-file note (D-24416).** This packet's edits to `feedback.types.ts` / `feedback.logic.ts` / `feedback.persistence.ts` are **additive extensions** of the WP-604 feedback contract (new types/functions, no existing signature changed), governed by **D-24416** — the DECISIONS entry that authorizes the status-writer, the endpoints, and these type additions (`OperatorFeedbackItem`, `UpdateFeedbackStatusInput`, the two new `FeedbackErrorCode` members). WP-604→605 is a sequential follow-on, not a parallel A/B split, so the "B-packet must not touch A-packet contract files" rule does not bind; the additive `.types.ts` change is sanctioned by D-24416 (code-style §Contract Files: a contract change requires a DECISIONS entry).
- **`apps/dashboard/src/pages/monetization/MonetizationPage.vue`** — the closest panel template: `useFetch(fetchX)` → loading/error/empty/`DataTable` branches. `apps/dashboard/src/services/endpoints.ts` (the `isMockMode()` fetcher family) + `services/mocks.ts` + `services/api.ts` (`apiClient`, bearer interceptor). `apps/dashboard/src/router/index.ts` (add one child route) + the nav in `apps/dashboard/src/layouts/AppLayout.vue`.
- **`docs/ai/REFERENCE/00.2-data-requirements.md`** — confirm canonical field names before naming any request/response field.
- **`docs/ai/REFERENCE/api-endpoints.md §D-11804`** — this packet adds two endpoint rows (`Status = Wired`, `Auth = admin-session-required` — the live catalog's Auth Taxonomy is a **four**-value closed set (D-9905 **extended by D-15901**): `admin-session-required` = a server-validated Hanko session **+ `is_admin = TRUE`**, and it is the value **every** existing `/api/dash/*` row already carries. Do NOT use `authenticated-session-required` — that would understate the gate).
- **`docs/ai/REFERENCE/00.6-code-style.md`** — Rules 4/6/9/11/13/14.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, Node v22+, `node:` prefix on built-ins, `.test.ts` tests. Full file contents for every new or modified file — no diffs, no snippets.
- No `boardgame.io`, no `@legendary-arena/game-engine` runtime import, no engine/`G`/`ctx`/scoring/RNG touch. `pg` only via the injected `DatabaseClient`.
- Human-style code per `00.6` (full-sentence errors, no abbreviations, `// why:` where non-obvious, no branching `.reduce()`).

**Packet-specific:**
- **The dashboard is the sole status writer (D-24416).** `updateFeedbackItemStatus` is the only code path that writes `feedback_item.status` / `resolution_reason` / advances `updated_at`. Both new server endpoints are **`requireAdminSession`-gated**; the public `/api/feedback` routes are unchanged and still write no status.
- **Introduces (does not violate) the status `UPDATE`.** WP-604/EC-639 forbade `UPDATE ... status` in `apps/server/src/feedback/`; this packet is the sanctioned follow-on that adds exactly one such writer. EC-640 relocates that grep to assert the update lives **only** in `updateFeedbackItemStatus` and is admin-gated.
- **`resolution_reason` is required on Declined, ignored otherwise.** `validateUpdateFeedbackStatusInput` rejects `status='declined'` with an empty/absent reason (`resolution_reason_required`); for every other status it stores `resolution_reason = NULL` (a prior reason is cleared on a move off Declined). It rejects a `status` outside `FEEDBACK_STATUSES` (`invalid_status`).
- **Operator read is operator-only, never public.** `GET /api/dash/feedback` returns **all** types + statuses with `voteCount`; it is admin-gated and never reachable by a player. It is not the public `GET /api/feedback` (which stays enhancement-only + PII-stripped). Bug/review free-text may contain PII (design §Edge Cases) — it is exposed only behind the admin gate.
- **`{ data }` envelope + `Cache-Control: no-store` first** on both new routes (the `/api/dash/*` convention, D-20503 / D-11504); errors use `{ code }`. The `PATCH` route parses its body with the **stream-guarded `ensureJsonBodyParsed` wrapper** copied from `feedback.routes.ts` (a route-scoped `koaBody()` short-circuited when `koaContext.req.on` is not a function) — **not** a bare `koaBody()` (which crashes the injected-stub route test) and **not** adminProfile's bodyless read (which parses nothing). There is no global `/api` parser, so without this prod `request.body` is `undefined`. The route test injects `request.body` directly and therefore does **not** exercise the parser (note this in the test).
- **Dashboard panel:** live-mode via the `endpoints.ts` `isMockMode()` pattern (a mock generator for offline dev); the `.vue` file is a thin render shell — all validation/projection logic lives in a pure, unit-tested `.ts` (the dashboard runner can't mount `.vue`; coverage 90/80/88). The status **mutation** (`PATCH`) is net-new — no dashboard mutation fetcher exists yet (all current `endpoints.ts` fetchers are `apiClient.get`); add `updateFeedbackStatus` as an `apiClient.patch` beside the read fetcher.
- **Cross-boundary type mirror (pin both sides).** The dashboard cannot import server types (layer boundary), so `apps/dashboard/src/types/feedbackTriage.ts` hand-mirrors the server `OperatorFeedbackItem` shape. Nothing binds them at compile time, so **both** declarations carry an explicit pin comment ("any change to the server `OperatorFeedbackItem` MUST update this mirror, and vice-versa"), and `feedbackTriage.test.ts` asserts the expected field-name keyset so a silent desync fails a test.
- **App/client typecheck is mandatory:** `pnpm --filter @legendary-arena/dashboard typecheck` (vue-tsc) MUST pass Before/After.

**Locked contract values (do not re-derive):**
- **`FeedbackStatus`** closed set `'under_review' | 'planned' | 'in_progress' | 'shipped' | 'declined'` (reuse `FEEDBACK_STATUSES`; do not redefine).
- **Endpoints:** `GET /api/dash/feedback`, `PATCH /api/dash/feedback/:id/status`.
- **Envelope:** success `{ data: { items } }` / `{ data: { item } }`; error `{ code }` (`invalid_request | invalid_status | resolution_reason_required | not_found | internal_error`) + the admin-gate codes (`unauthorized`→401, `forbidden`→403).
- **`Auth`:** admin-gated via `requireAdminSession` (a Hanko session **+ `is_admin = TRUE`**); catalog `Auth = admin-session-required` (the D-15901 closed-set value every `/api/dash/*` row uses), **not** `authenticated-session-required`.

**Session protocol:** if any field name, table column, admin-helper signature, or dashboard composable/service API is unclear, STOP and read the cited file — never guess or invent a column, envelope, or helper shape.

---

## Debuggability & Diagnostics

- Every status write is externally observable as a single `feedback_item` row change (a `SELECT` confirms `status` / `resolution_reason` / `updated_at`); the list read is a pure projection of `feedback_item` + a `COUNT` over `feedback_vote`.
- Deterministic given identical DB state + inputs; no clock/RNG branch (`updated_at = now()` is recorded, not branched on).
- Failures are localizable to a typed `{ code }` + a full-sentence server log line; the dashboard surfaces the code as a legible error state.

---

## Scope (In)

### A) Server — persistence (`apps/server/src/feedback/feedback.persistence.ts`, modified)
- `listAllFeedbackItems(database): Promise<OperatorFeedbackItem[]>` — every item, **all** types + statuses, each with its `voteCount` (`LEFT JOIN` + `COUNT`), newest first. No type filter, no PII strip (operator-only).
- `updateFeedbackItemStatus(database, itemId, status, resolutionReason): Promise<FeedbackItemRecord | null>` — `UPDATE ... SET status, resolution_reason, updated_at = now() ... RETURNING *`; returns `null` when no row matches the id. The **only** status writer.

### B) Server — pure logic (`apps/server/src/feedback/feedback.logic.ts`, modified)
- `validateUpdateFeedbackStatusInput(body): { ok: true; value: UpdateFeedbackStatusInput } | { ok: false; code }` — `status` ∈ `FEEDBACK_STATUSES` (else `invalid_status`); `resolution_reason` required non-empty when `status='declined'` (else `resolution_reason_required`), normalized to `null` for every other status. Never throws.
- `toOperatorFeedbackItem(record, voteCount): OperatorFeedbackItem` — the operator projection (the full record + `voteCount`; operator-only, so `authorExtId` is retained, unlike the public shaper).

### C) Server — types (`apps/server/src/feedback/feedback.types.ts`, modified)
- `OperatorFeedbackItem` (the record + `voteCount`), `UpdateFeedbackStatusInput` (`{ status; resolutionReason: string | null }`), and the new `FeedbackErrorCode` members (`invalid_status`, `resolution_reason_required`).

### D) Server — admin routes (`apps/server/src/dashboard/dashboardFeedback.routes.ts`, new)
- `registerDashboardFeedbackRoutes(router, database, deps)` mirroring `dashboardBilling.routes.ts`: `passesAdminGate` (from the injected `requireAdminSession`), `Cache-Control: no-store` first, `{ data }` / `{ code }`, `try/catch` → 500.
- `GET /api/dash/feedback` → `{ data: { items } }`.
- `PATCH /api/dash/feedback/:id/status` → parse the body via the `ensureJsonBodyParsed` stream-guarded wrapper (copied from `feedback.routes.ts`, not a bare `koaBody()`) → `validateUpdateFeedbackStatusInput` → `updateFeedbackItemStatus` → `{ data: { item } }`; `404 { code: 'not_found' }` on unknown id; `400 { code }` on invalid input.

### E) Server — wiring (`apps/server/src/server.mjs`, modified — 01.5)
- `registerDashboardFeedbackRoutes(server.router, pool, { requireAdminSession, verifier, accountResolver })`, beside the other dashboard registrars. **Only** runtime-wiring file.

### F) Server — API catalog (`docs/ai/REFERENCE/api-endpoints.md`, modified — D-11804)
- Two whole `Wired` rows (closed-set Status/Auth; operator-only noted in Notes).

### G) Server — tests
- `feedback.logic.test.ts` (modified) — the new validator (accept + each reject branch, reason normalization) + the operator shaper.
- `feedback.persistence.test.ts` (modified, DB-gated serialized) — status round-trip (each transition), `resolution_reason` set on Declined + cleared off it, `updated_at` advances, unknown-id → `null`, `listAllFeedbackItems` returns all types/statuses with correct `voteCount`.
- `dashboardFeedback.routes.test.ts` (new) — injected stubs: admin-gate (401/403), `{ data }` envelope, the 404 + validation paths, `Cache-Control` first.

### H) Dashboard — the triage page + wiring
- `apps/dashboard/src/pages/feedback/FeedbackTriagePage.vue` (new) — `useFetch(fetchFeedbackItems)` → a `DataTable` (type / title / status / voteCount / created) with a per-row status editor (a select over the five statuses + a reason field shown/required on Declined) that calls the mutation and refreshes. Thin render shell.
- `apps/dashboard/src/services/endpoints.ts` (modified) — `fetchFeedbackItems()` (GET, `isMockMode()`) + `updateFeedbackStatus(id, input)` (the net-new PATCH mutation via `apiClient.patch`).
- `apps/dashboard/src/services/mocks.ts` (modified) — a mock feedback-queue generator.
- `apps/dashboard/src/types/feedbackTriage.ts` (new) — the dashboard-side `FeedbackTriageItem` type (hand-mirror of the server `OperatorFeedbackItem`, **with a pin comment binding the two** — see the cross-boundary-mirror constraint) + a **pure** `validateStatusEdit(status, reason)` helper the `.vue` delegates to.
- `apps/dashboard/src/types/feedbackTriage.test.ts` (new) — pure tests for `validateStatusEdit` (Declined-requires-reason, invalid status, reason-cleared) + a **field-name keyset assertion** on `FeedbackTriageItem` (so a silent desync from the server shape fails a test), to the 90/80/88 gate.
- `apps/dashboard/src/router/index.ts` (modified) — a `feedback` child route (lazy `import()`, `meta.requiresAuth: true`, mirroring the existing children).
- `apps/dashboard/src/layouts/AppLayout.vue` (modified) — a nav entry for the Feedback page, matching the existing nav item shape (`{ to, label, abbreviation }`).

---

## Out of Scope

- **No public / player surface** — no change to `GET /api/feedback`, the future public roadmap board, the intake form, or any marketing/arena-client surface.
- **No auto-derived "Shipped" from the git/WP spine** — the operator sets Shipped manually in this MVP; wiring Shipped to a merged WP is a follow-on.
- **No role tiers / delegated moderation** — a single Hanko + Cloudflare Access operator gate, exactly as today (design §No role tiers).
- **No changelog / monthly-recap / roadmap-render surface** — follow-on WPs.
- **No vote weighting, no new voting behavior** — WP-604's vote surface is untouched.
- **No handle resolution / author enrichment** — the operator item carries the raw `authorExtId`; resolving it to a display handle is a later nicety.
- **No engine / `G` / scoring / `boardgame.io` / registry-runtime change.**

---

## Files Expected to Change

**Server (code):**
- `apps/server/src/feedback/feedback.persistence.ts` — **modified**
- `apps/server/src/feedback/feedback.logic.ts` — **modified**
- `apps/server/src/feedback/feedback.types.ts` — **modified**
- `apps/server/src/dashboard/dashboardFeedback.routes.ts` — **new**
- `apps/server/src/feedback/feedback.logic.test.ts` — **modified**
- `apps/server/src/feedback/feedback.persistence.test.ts` — **modified**
- `apps/server/src/dashboard/dashboardFeedback.routes.test.ts` — **new**
- `apps/server/src/server.mjs` — **modified** (01.5 runtime-wiring)

**Dashboard (code):**
- `apps/dashboard/src/pages/feedback/FeedbackTriagePage.vue` — **new**
- `apps/dashboard/src/services/endpoints.ts` — **modified**
- `apps/dashboard/src/services/mocks.ts` — **modified**
- `apps/dashboard/src/types/feedbackTriage.ts` — **new**
- `apps/dashboard/src/types/feedbackTriage.test.ts` — **new**
- `apps/dashboard/src/router/index.ts` — **modified**
- `apps/dashboard/src/layouts/AppLayout.vue` — **modified**

**Catalog:**
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (two `Wired` rows, D-11804)

No other **code** files may be modified. **Governance / closeout docs**
(expected, exempt from the code-scope check): `docs/ai/STATUS.md`,
`docs/ai/DECISIONS.md` (D-24416 → Active), `WORK_INDEX.md` (WP-605 `[x]`),
`EC_INDEX.md` (EC-640 → Done), `docs/05-ROADMAP-MINDMAP.md` (`✅` + counts).

> **Split-vs-single (recorded).** This WP crosses `apps/server` → `apps/dashboard`
> (~16 code files), above the "~10 files / one layer" rule of thumb. It is kept
> as **one** WP deliberately: it is a single, indivisible operator feature (the
> panel is inert without its endpoints; the endpoints have no other consumer), it
> matches the established `/api/dash/*`-endpoint-plus-dashboard-panel shape
> (WP-373/374/439), and the crossing is server→dashboard (the two top,
> non-engine layers) — not an engine/registry boundary. The two sides are
> independently testable (server: DB-gated + injected-stub; dashboard: mock-mode
> + pure logic), so no cross-layer test coupling exists. Splitting would strand
> the panel WP as BLOCKED-on-the-API WP for no reviewer benefit.

---

## Contract

**`GET /api/dash/feedback`** (admin) → `200 { data: { items: OperatorFeedbackItem[] } }`
where `OperatorFeedbackItem = { id, feedbackType, title, description, authorExtId,
status, resolutionReason, voteCount, createdAt, updatedAt }`, newest first. Errors:
`401 { code: 'unauthorized' }`, `403 { code: 'forbidden' }`, `500 { code: 'internal_error' }`.

**`PATCH /api/dash/feedback/:id/status`** (admin) → body `{ status: FeedbackStatus,
resolutionReason?: string }` → `200 { data: { item: OperatorFeedbackItem } }`. Errors:
`400 { code: 'invalid_status' | 'resolution_reason_required' | 'invalid_request' }`,
`401`/`403` (gate), `404 { code: 'not_found' }`, `500 { code: 'internal_error' }`.
`Cache-Control: no-store` first on both; the PATCH parses its own JSON body.

---

## Acceptance Criteria

### Server
- [ ] `GET /api/dash/feedback` rejects a non-admin (`401`/`403`) and, for an admin, returns every item (all types + statuses) with a correct projected `voteCount`.
- [ ] `PATCH /api/dash/feedback/:id/status` sets `status` (+ `updated_at`), requires a non-empty `resolution_reason` when `status='declined'` (`400 resolution_reason_required`) and stores `NULL` otherwise, rejects an out-of-set status (`400 invalid_status`), and returns `404` for an unknown id.
- [ ] `updateFeedbackItemStatus` is the ONLY code path that writes `feedback_item.status` (confirmed with `Select-String`); both routes are `requireAdminSession`-gated; `is_admin` is read nowhere outside `adminSession.ts`.
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (persistence tests DB-gated, serialized, non-silent skip without `TEST_DATABASE_URL`).
- [ ] No `boardgame.io` / `game-engine` import in any new/changed server file.

### Dashboard
- [ ] `dashboard.legendary-arena.com/feedback` lists the queue and sets a status; the reason field appears + is required only on Declined; a set persists and the row updates.
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` / `test:coverage` (90/80/88) / `build` exit 0; the pure `validateStatusEdit` is unit-tested.

### Scope
- [ ] No code files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Server
pnpm --filter @legendary-arena/server test        # exits 0 (DB-gated serialized; non-silent skip w/o TEST_DATABASE_URL)
# why: -CaseSensitive so the update...Status IDENTIFIER (call sites, tests) never matches;
# the SQL clause `SET status` (uppercase) appears only in updateFeedbackItemStatus's UPDATE.
Select-String -CaseSensitive -Path "apps\server\src\feedback\*.ts","apps\server\src\dashboard\dashboardFeedback.routes.ts" -Pattern "SET status"
# Expected: exactly one match, in apps\server\src\feedback\feedback.persistence.ts (the sole status writer)
Select-String -Path "apps\server\src\dashboard\dashboardFeedback.routes.ts" -Pattern "is_admin"
# Expected: no output (is_admin is read only in adminSession.ts)

# Dashboard
pnpm --filter @legendary-arena/dashboard typecheck   # vue-tsc, exits 0
pnpm --filter @legendary-arena/dashboard test:coverage  # 90/80/88
pnpm --filter @legendary-arena/dashboard build          # exits 0

# Scope
git diff --name-only   # only the ## Files Expected to Change list + governance closeout
```

---

## Definition of Done

- [ ] **User-visible verification (D-24026):** the Feedback triage page is confirmed live on the deployed `dashboard.legendary-arena.com/feedback` — the queue lists, a status set persists, Declined requires a reason — with a screenshot or observed-behavior note (the dashboard is Hanko+Access-gated, so verify on the authenticated deployed page, the repo-standard for dashboard WPs).
- [ ] All acceptance criteria pass.
- [ ] `pnpm --filter @legendary-arena/server test` exits 0; `pnpm --filter @legendary-arena/dashboard typecheck` / `test:coverage` / `build` exit 0.
- [ ] `updateFeedbackItemStatus` is the sole status writer; both endpoints admin-gated; `is_admin` unread outside `adminSession.ts` (Select-String).
- [ ] No code files outside `## Files Expected to Change` modified (`git diff --name-only`).
- [ ] `docs/ai/REFERENCE/api-endpoints.md` — two new rows (D-11804), whole-row, closed-set Status/Auth.
- [ ] `docs/ai/STATUS.md` updated (the operator triage surface now exists).
- [ ] `docs/ai/DECISIONS.md` — D-24416 flipped Drafted → Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-605 `[x]` with date; `EC_INDEX.md` EC-640 → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅`; `pnpm roadmap:counts:check` exits 0.

---

## Vision Alignment

- **Vision surfaces touched:** identity/profile boundary (VISION §7a/§19a-b) and the fairness bright lines (§21 / NG-1…8), via the ewiki *Surfaces and authority* split.
- **Conflict assertion:** none. Status authoring is an **operator** editorial judgment behind the existing admin gate — it transfers no product authority to the crowd (design §Success metrics), adds no funding/pay-to-win/ranking lever, and exposes no new player-facing surface. `voteCount` remains a DB projection (unweighted, one-account-one-vote, unchanged). The operator-only read may show bug/review free-text (possible PII) — it is admin-gated and never public, matching the design's PII posture.
- **NG-proximity check:** none. No paywall, no funding channel, no pay-to-win, no monetization affordance — an internal operator triage tool.
- **Determinism preservation:** N/A — no engine/`G`/replay/scoring path; a server CRUD write + a dashboard render.

---

## Lint Gate Self-Review

Audited against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` (21 sections):

- **§1 Structure** — PASS (all sections present + non-empty).
- **§2 Non-Negotiable Constraints** — PASS. Engine determinism items N/A (no engine surface); the always-apply output-discipline lines present; packet-specific constraints + locked values enumerated.
- **§3 Assumes** — PASS (WP-604, `requireAdminSession`, the `/api/dash` pattern, dashboard test/CI; BLOCKED-if-false stated; baseline SHA recorded).
- **§4 Context** — PASS (ewiki design page, ARCHITECTURE persistence/server, adminSession, the read + write route models, the WP-604 module, the dashboard page/services/router, 00.2, api-endpoints §D-11804, 00.6).
- **§5 Files Expected to Change** — PASS (15 code files across two layers + the `api-endpoints.md` catalog doc; governance carve-out; split-vs-single recorded).
- **§6 Naming Consistency** — PASS (columns/fields match WP-604 + 00.2: `feedback_item.status` / `resolution_reason` / `author_ext_id`; `voteCount` projection).
- **§7 Dependencies** — PASS (no new npm dep; reuses `requireAdminSession`, `koa-body`, `pg`, PrimeVue `DataTable`, axios `apiClient`).
- **§8 Architectural Boundaries** — PASS (server persists + wires; dashboard renders; no engine/registry/`boardgame.io` runtime import; `pg` via injected client; `feedback_item` ordinary domain storage).
- **§9 Windows** — PASS (`pwsh` / `Select-String` / backslash paths).
- **§10 Env Var Hygiene** — PASS (no new env vars; `TEST_DATABASE_URL` documented; `VITE_USE_MOCKS` reused).
- **§11 Authentication Clarity** — PASS (admin-gated writes + reads via injected `requireAdminSession` = Hanko session + `is_admin = TRUE`; the public routes unchanged; catalog `Auth = admin-session-required`, the D-15901 closed-set value every `/api/dash/*` row uses).
- **§12 Test Quality** — PASS (`node:test`, no `boardgame.io`; server DB test serialized + non-silent skip; dashboard pure-logic + coverage gate; `.vue` untested by design).
- **§13 Commands & Verification** — PASS (exact `pnpm --filter` commands + expected output + the two Select-String guards).
- **§14 Acceptance Criteria** — PASS (binary/observable, grouped by side).
- **§15 Definition of Done** — PASS (STATUS/DECISIONS/WORK_INDEX/EC_INDEX + scope check; §15 dashboard surface → D-24026 live-verify item present).
- **§16 Code Style** — PASS (full-sentence errors, no abbreviations, `// why:`, ESM/named imports, pure-logic extraction).
- **§17 Vision Alignment** — PASS (`## Vision Alignment` present; identity/fairness surfaces addressed; NG-proximity none).
- **§18 Prose-vs-Grep** — PASS (the sole-writer grep is pinned to the SQL clause `SET status` with `-CaseSensitive` — so the `updateFeedbackItemStatus` identifier at call sites/tests never matches and only the one UPDATE clause does; the `is_admin` grep is scoped to the new route file; both greps target `apps\server\src\**`, excluding this markdown, so no WP prose self-trips).
- **§19 Bridge-vs-HEAD** — N/A (commit-time discipline, not a WP-lint rule).
- **§20 Funding Surface Gate** — N/A (justified): no funding affordance, donate/tournament copy, or funding-channel integration — an internal operator tool.
- **§21 API Catalog (D-11804)** — PASS: `api-endpoints.md` in the allowlist; two whole rows, `Status = Wired`, `Auth = admin-session-required` (the D-15901 four-value-set value every `/api/dash/*` row carries), field names matching the data contract.

**Pre-flight verdict (01.4):** READY TO EXECUTE (independent audit; all cited files/exports/CI thresholds verified against the tree; 3 cosmetic RS-items folded in). **Copilot verdict (01.7):** RISK → resolved (the three scope-neutral fixes — `admin-session-required` Auth value, the `SET status` case-sensitive sole-writer grep, and the `ensureJsonBodyParsed` stream-guarded PATCH body-parse + the cross-boundary mirror pin — were applied in place; file allowlist, mutation boundary, and contracts unchanged, so no pre-flight re-run). **Lint (00.3):** PASS after correcting the Auth taxonomy value (§21/§11) and the sole-writer grep (§18).
