# EC-640 — Feedback Triage Panel (Execution Checklist)

**Source:** docs/ai/work-packets/WP-605-feedback-triage-panel.md
**Layer:** Server (`apps/server`) + App (`apps/dashboard`)

## Before Starting
- [ ] On `main`, clean, fast-forward synced; `origin/main` baseline recorded in the WP (@ `745a8d78`).
- [ ] WP-604 on `main`: the `legendary.feedback_item` / `feedback_vote` tables + `apps/server/src/feedback/` module exist; WP-604 wrote no status.
- [ ] `apps/server/src/auth/adminSession.ts` (`requireAdminSession`), `apps/server/src/dashboard/dashboardBilling.routes.ts` (admin read), `apps/server/src/profile/admin/adminProfile.routes.ts` (admin PATCH), and `apps/dashboard/src/pages/monetization/MonetizationPage.vue` + `services/endpoints.ts` read (the shapes to mirror).
- [ ] `pnpm --filter @legendary-arena/server test` exits 0; `pnpm --filter @legendary-arena/dashboard typecheck`/`build` exit 0.
- [ ] Target file set = exactly the `## Files to Produce` list below; any file outside it is a FAIL surfaced before editing.

## Locked Values (do not re-derive)
- `FeedbackStatus` closed set `under_review | planned | in_progress | shipped | declined` (reuse `FEEDBACK_STATUSES`; never redefine).
- Endpoints: `GET /api/dash/feedback` (admin list-all), `PATCH /api/dash/feedback/:id/status` (admin status write).
- Success envelope `{ data: { items } }` / `{ data: { item } }`; error `{ code }` ∈ `{ invalid_request, invalid_status, resolution_reason_required, not_found, internal_error }` + gate codes (`unauthorized`→401, `forbidden`→403, `lookup_failed`→500).
- `OperatorFeedbackItem` = `FeedbackItemRecord` + `voteCount` (operator-only — retains `authorExtId`, unlike the public shaper).
- `Auth` = `admin-session-required` (the catalog's four-value Auth taxonomy value per D-9905 **extended by D-15901** = Hanko session + `is_admin = TRUE`; the value every `/api/dash/*` row already carries). NOT `authenticated-session-required`.

## Guardrails
- `updateFeedbackItemStatus` is the ONLY code path that writes `feedback_item.status` / `resolution_reason` / `updated_at`. STOP if a second status writer appears.
- Both new endpoints are `requireAdminSession`-gated; the public `/api/feedback` routes are UNCHANGED (still write no status). `is_admin` is read ONLY in `adminSession.ts` — never inline it in the triage routes.
- `resolution_reason` REQUIRED non-empty when `status='declined'` (`resolution_reason_required`); normalized to `NULL` for every other status (a move off Declined clears it). Out-of-set `status` → `invalid_status`.
- `GET /api/dash/feedback` is operator-only (all types + statuses + `voteCount`, no PII strip) — it is NOT the public enhancement GET; a player must never reach it.
- `{ data }` envelope + `Cache-Control: no-store` as the FIRST statement of every handler; the `PATCH` route parses its body with the **stream-guarded `ensureJsonBodyParsed` wrapper copied from `feedback.routes.ts`** (route-scoped `koaBody()` short-circuited when `koaContext.req.on` is not a function) — NOT a bare `koaBody()` (crashes the stub route test) and NOT adminProfile's bodyless read (parses nothing); no global `/api` parser exists.
- The dashboard `feedbackTriage.ts` type hand-mirrors the server `OperatorFeedbackItem` (no cross-app import allowed) — **pin both declarations** with a "keep in sync with the other" comment, and assert the `FeedbackTriageItem` field-name keyset in `feedbackTriage.test.ts` so a desync fails a test.
- The `feedback.{types,logic,persistence}.ts` edits are **additive** extensions of the WP-604 contract, authorized by **D-24416** (the contract-change DECISIONS entry) — no existing signature changes.
- No `boardgame.io` / `@legendary-arena/game-engine` runtime import; `pg` only via the injected `DatabaseClient`.
- Dashboard `.vue` is a thin shell — validation/projection logic lives in a pure `.ts` (the runner can't mount `.vue`); coverage 90/80/88.
- Server persistence tests DB-gated, serialized (`--test-concurrency=1`), non-silent skip when `TEST_DATABASE_URL` unset.

## Required `// why:` Comments
- `updateFeedbackItemStatus` `UPDATE`: this is the sanctioned first (and only) status writer — WP-604/EC-639 deferred status authoring to WP-605 (D-24416); the dashboard is the sole status writer.
- `dashboardFeedback.routes.ts` `PATCH` `ensureJsonBodyParsed`: no global `/api` body parser; `request.body` is undefined in prod without it; the stream-guard lets the same handler run under the injected-stub test (which sets `request.body` directly and so does not exercise the parser — note this in the test).
- `resolution_reason` normalization to `NULL` off Declined: required only on Declined; cleared otherwise so a stale reason never lingers.
- The operator-only projection retaining `authorExtId`: operator-gated surface, not public — distinct from the PII-stripping public shaper.

## Files to Produce
- `apps/server/src/feedback/feedback.persistence.ts` — **mod** — `listAllFeedbackItems` + `updateFeedbackItemStatus`
- `apps/server/src/feedback/feedback.logic.ts` — **mod** — `validateUpdateFeedbackStatusInput` + `toOperatorFeedbackItem`
- `apps/server/src/feedback/feedback.types.ts` — **mod** — `OperatorFeedbackItem` + `UpdateFeedbackStatusInput` + 2 error codes
- `apps/server/src/dashboard/dashboardFeedback.routes.ts` — **new** — admin GET + PATCH
- `apps/server/src/feedback/feedback.logic.test.ts` — **mod** — validator + shaper tests
- `apps/server/src/feedback/feedback.persistence.test.ts` — **mod** — DB-gated status round-trip + list-all
- `apps/server/src/dashboard/dashboardFeedback.routes.test.ts` — **new** — injected-stub route tests
- `apps/server/src/server.mjs` — **mod** — register feedback triage routes (01.5, the ONLY wiring file)
- `apps/dashboard/src/pages/feedback/FeedbackTriagePage.vue` — **new** — the triage page (shell)
- `apps/dashboard/src/services/endpoints.ts` — **mod** — `fetchFeedbackItems` + `updateFeedbackStatus` (net-new PATCH mutation)
- `apps/dashboard/src/services/mocks.ts` — **mod** — mock feedback queue
- `apps/dashboard/src/types/feedbackTriage.ts` — **new** — mirror type + pure `validateStatusEdit`
- `apps/dashboard/src/types/feedbackTriage.test.ts` — **new** — pure-helper tests (90/80/88)
- `apps/dashboard/src/router/index.ts` — **mod** — `feedback` child route
- `apps/dashboard/src/layouts/AppLayout.vue` — **mod** — nav entry
- `docs/ai/REFERENCE/api-endpoints.md` — **mod** — 2 whole rows (D-11804)

## After Completing
- [ ] `pnpm --filter @legendary-arena/server test` exits 0; `pnpm --filter @legendary-arena/dashboard typecheck`/`test:coverage`/`build` exit 0.
- [ ] `Select-String -CaseSensitive -Pattern "SET status"` over `apps\server\src\feedback\*.ts` + the new route → exactly one match, in `feedback.persistence.ts` (`updateFeedbackItemStatus`, the sole writer); no `is_admin` in the triage route; no `boardgame.io`/`game-engine` import.
- [ ] Live verification (D-24026): the deployed `dashboard.legendary-arena.com/feedback` lists + sets status; Declined requires a reason.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated (2 rows, whole-row, closed sets).
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — D-24416 flipped Drafted → Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date; `EC_INDEX.md` EC-640 → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-605 glyph `📝` → `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Common Failure Smells
- `request.body` undefined on PATCH in prod while the route test passes → the route used a bare `koaBody()` (or adminProfile's bodyless read) instead of the stream-guarded `ensureJsonBodyParsed`; the injected-stub test never exercises the parser, so it stays green — verify against a real stream, not the stub.
- A player reaches `/api/dash/feedback` → the admin gate was dropped or wired with the player `requireAuthenticatedSession` instead of `requireAdminSession`.
- Declined item with no reason persists → `validateUpdateFeedbackStatusInput` missing the Declined branch.
- Dashboard coverage gate fails → status-edit validation was left inline in the `.vue` (untestable) instead of the pure `.ts`.
