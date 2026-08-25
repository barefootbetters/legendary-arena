# EC-639 — Feedback Intake & Voting API (Execution Checklist)

**Source:** docs/ai/work-packets/WP-604-feedback-intake-and-voting-api.md
**Layer:** Server (`apps/server`) + Persistence (DB migrations)

## Before Starting
- [ ] On `main`, clean, fast-forward synced; `origin/main` baseline recorded in the WP.
- [ ] `data/migrations/` latest is `041_create_coach_reports.sql` (this WP adds 042 + 043).
- [ ] `apps/server/src/coach/coach.routes.ts` + `competition/competition.routes.ts` read — the route shape + `koa-body` per-route pattern to mirror.
- [ ] `pnpm --filter @legendary-arena/server build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0
- [ ] Target file set = exactly the `## Files to Produce` list below; any file outside it is a FAIL, surfaced as a blocker before editing.

## Locked Values (do not re-derive)
- Schema: `legendary.*`; PK `bigserial`; account id is `ext_id text` (`legendary.players.ext_id`).
- `FeedbackType` = `'bug' | 'enhancement' | 'review'` (canonical array `FEEDBACK_TYPES`).
- `FeedbackStatus` = `'under_review' | 'planned' | 'in_progress' | 'shipped' | 'declined'` (array `FEEDBACK_STATUSES`).
- New item default: `status = 'under_review'` — the ONLY status this packet writes.
- Vote uniqueness: `UNIQUE (feedback_item_id, account_ext_id)` — the one-vote-per-account enforcement; `vote_count` is a `COUNT` projection, never a stored column.
- Endpoints: `POST /api/feedback` (auth), `GET /api/feedback` (guest), `POST` + `DELETE /api/feedback/:id/vote` (auth).
- Auth closed set (D-9905): `guest | handle-required | authenticated-session-required`.
- Public `GET` returns `type = 'enhancement'` only — never bug/review rows, never author PII. Default status set (no `statusFilter`) = `['planned','in_progress','shipped']` (the public roadmap view); raw `under_review` intake is hidden by default.
- Column names: `feedback_item.author_ext_id` (the submitter) and `feedback_vote.account_ext_id` (the voter) are **intentionally distinct** names for a `legendary.players.ext_id` value — do NOT "unify" them; they mark different roles.

## Guardrails
- No global `/api` body parser — each write route attaches its OWN `koaBody()` (`request.body` is `undefined` in prod otherwise). Verify by running, not by reasoning.
- No `UPDATE ... status` anywhere in `apps/server/src/feedback/` — status authoring is the follow-on dashboard WP. STOP if a status write appears in scope.
- `vote_count` is derived (`COUNT` over `feedback_vote`) — never a `feedback_item` column, never hand-set.
- Voting + submission are `authenticated-session-required` via the injected `requireAuthenticatedSession`; `GET` is `guest`. No anonymous/IP voting.
- No `boardgame.io`, no `@legendary-arena/game-engine` runtime import, no UI import; `pg` only via the injected `DatabaseClient`.
- `Cache-Control: no-store` is the first statement in every route handler (D-11504); uniform `{ error: <code> }` envelope.
- `feedback_item` / `feedback_vote` are ordinary domain tables — NOT a `G`/snapshot/save-game, NOT a persistence carve-out; no carve-out language added.
- Migrations are idempotent (`IF NOT EXISTS`), sequential (042 then 043).

## Required `// why:` Comments
- `043` `UNIQUE (feedback_item_id, account_ext_id)`: this constraint is the one-vote-per-account rule — the DB owns the tally (D-24414).
- `feedback.routes.ts` route-scoped `koaBody()`: no global `/api` body parser; `request.body` is undefined in prod without it.
- Migration headers (042/043): persistence-boundary note — ordinary domain storage, not `G`/snapshot/save-game, no carve-out (mirror migration 041's header).
- The `type='enhancement'`-only SQL filter in `listPublicEnhancements`: paraphrase the literal in prose if a count-bounded grep gate policing it exists (EC grep-gate discipline).

## Files to Produce
- `data/migrations/042_create_feedback_item.sql` — **new** — `legendary.feedback_item` + `(feedback_type,status)` index
- `data/migrations/043_create_feedback_vote.sql` — **new** — `legendary.feedback_vote` + UNIQUE + FK CASCADE
- `apps/server/src/feedback/feedback.types.ts` — **new** — unions/arrays/record/projection/error codes
- `apps/server/src/feedback/feedback.logic.ts` — **new** — pure validate + projection shaper (no `pg`)
- `apps/server/src/feedback/feedback.persistence.ts` — **new** — the only `pg` file (insert/list/addVote/removeVote)
- `apps/server/src/feedback/feedback.routes.ts` — **new** — 4 routes, mirror `coach.routes.ts`
- `apps/server/src/feedback/feedback.logic.test.ts` — **new** — pure + drift assertion
- `apps/server/src/feedback/feedback.routes.test.ts` — **new** — injected stubs
- `apps/server/src/feedback/feedback.persistence.test.ts` — **new** — DB-gated, serialized
- `apps/server/src/server.mjs` — **modified** — register feedback routes (01.5 runtime-wiring; the ONLY wiring file)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — 4 whole rows (D-11804)

## After Completing
- [ ] `pnpm --filter @legendary-arena/server build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (persistence test serialized `--test-concurrency=1`; non-silent skip without `TEST_DATABASE_URL`)
- [ ] `Select-String` confirms: no `UPDATE ... status`, no `boardgame.io`/`game-engine` import, `koaBody` present per write route
- [ ] Live verification = N/A (surface `none — infrastructure`); STATUS.md states "No user-observable change — infrastructure only"
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated (4 rows, whole-row, closed sets)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24414 flipped Drafted → Active (post-execution)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-604 glyph `📝` → `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells
- `request.body` undefined at runtime → the write route is missing its own `koaBody()` (no global parser).
- A vote double-counts → the `UNIQUE` constraint or the `ON CONFLICT DO NOTHING` is missing; `vote_count` was stored instead of projected.
- Public list leaks a bug/review row → the `type='enhancement'` filter was dropped from `listPublicEnhancements`.
- Persistence test races another DB suite → `--test-concurrency=1` missing (shared local Postgres).
