# WP-604 — Feedback Intake & Voting API

**Status:** Ready
**Primary Layer:** Server (`apps/server`) + Persistence (DB migrations)
**Dependencies:** WP-01 (DB schema + `render.yaml` + `migrate.mjs` build-step pipeline), WP-104 / WP-332 (the injected `requireAuthenticatedSession` / `accountResolver` session-auth pattern), WP-594 (the `coach/` module shape this mirrors)
**User-Visible Surface:** none — infrastructure (backend tables + REST API; this packet ships no UI. The public roadmap board and the dashboard triage panel that consume this API are follow-on WPs.)

> `none — infrastructure` per D-24026: no player, visitor, or operator sees a UI
> difference after this packet deploys. The payoff is the persistence + intake
> contract the public board (a future arena-client/marketing WP) and the operator
> triage panel (a future dashboard WP) build on. STATUS.md must say so plainly.

---

## Session Context

D-24414 locks the build-vs-buy decision — **build the player-feedback + public-roadmap system custom on the existing Postgres + Hanko + Dashboard stack** (not SaaS, not self-hosted Fider); this packet lands the persistence + intake/voting **backbone** (tables + REST API) mirroring the WP-594 `coach/` module and the WP-332 `competition.routes.ts` authenticated-write pattern, and authors **no UI** — the operator triage panel (dashboard) and the public board (marketing/arena-client) are follow-on WPs.

---

## Goal

After this packet, `apps/server` can **accept, store, list, and vote on** player feedback. Two new tables in the `legendary.*` schema — `legendary.feedback_item` (one row per submitted bug / enhancement / review) and `legendary.feedback_vote` (one row per account per item) — back four new REST endpoints: `POST /api/feedback` (submit, authenticated), `GET /api/feedback` (public list of enhancement items with a projected `vote_count`), and `POST` / `DELETE /api/feedback/:id/vote` (identity-gated one-vote-per-account upvote toggle). Every item is created with status `under_review`; **this packet never mutates status** — status is authored only on the operator dashboard (a follow-on WP), per D-24414. `vote_count` is a projection (`COUNT` over `feedback_vote`), never a hand-set column; the one-vote-per-account rule is enforced by a `UNIQUE (feedback_item_id, account_ext_id)` constraint, so the database owns the tally.

---

## User-Visible Impact

**None — infrastructure. No user-observable change; this packet's payoff is the persistence + intake/voting contract that the public roadmap board and the operator triage panel (both follow-on WPs) build on.** The endpoints are reachable (an operator can `curl` a submit/list/vote), but no player-, visitor-, or operator-facing UI renders them yet. STATUS.md states "No user-observable change — infrastructure only" so this is not mistaken for visible progress. (D-24026)

---

## Assumes

- WP-01 complete. Specifically:
  - `data/migrations/` runs sequentially via `scripts/migrate.mjs` in the Render `buildCommand` (idempotent; `IF NOT EXISTS`); latest applied is `041_create_coach_reports.sql`.
  - All domain tables live in the `legendary.*` schema; PKs are `bigserial`; cross-service identity is `ext_id text` (`legendary.players.ext_id` = the account id).
- WP-104 / WP-332 complete. Specifically:
  - `apps/server/src/auth/sessionToken.types.ts` declares the injected-auth **contract types** (`SessionVerifier` / `AccountResolver` / the `requireAuthenticatedSession` options); the `requireAuthenticatedSession` **function** lives in `apps/server/src/auth/sessionToken.logic.ts` and is injected via `deps` into `competition.routes.ts` and `coach.routes.ts` (the pattern this packet mirrors).
  - The closed auth set (D-9905): `guest` | `handle-required` | `authenticated-session-required`.
- WP-594 complete — `apps/server/src/coach/` (`coach.types.ts` / `coach.logic.ts` / `coachReport.persistence.ts` / `coach.routes.ts`) is the module shape this packet mirrors; `coach.routes` is wired in `apps/server/src/server.mjs` via `registerCoachRoutes`.
- `D-24414` reserved in `docs/ai/NUMBER-LEDGER.md` (build-custom decision).
- `pnpm --filter @legendary-arena/server build` and `test` exit 0 on `main`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the Server layer wires and stores; it never decides gameplay. This packet is server + persistence only; it imports no `boardgame.io`, no `@legendary-arena/game-engine` runtime, no UI.
- `.claude/rules/architecture.md §Persistence Boundary (Cross-Layer)` — `G`/`ctx` are runtime-only; only the server/application layer persists. `feedback_item` / `feedback_vote` are **ordinary server-layer domain tables** (like `legendary.coach_reports`), NOT a `G`/snapshot/save-game and NOT a persistence carve-out. No carve-out is needed or added.
- `apps/server/src/coach/coach.routes.ts` — the authenticated-route pattern to mirror **verbatim in shape**: local structural `KoaRouter` interfaces (no `@koa/router` import), caller-injected `requireAuthenticatedSession` / `accountResolver`, `Cache-Control: no-store` as the first statement, a uniform `{ error: <code> }` envelope, `try/catch` → typed 500.
- `apps/server/src/competition/competition.routes.ts` — the **`koa-body` per-route body-parser** pattern: `import koaBody from 'koa-body'`, a route-scoped `const feedbackRouteJsonBodyParser = koaBody()` mounted only on the write routes. There is **no global `/api` body parser** — `request.body` is `undefined` in production without this (a shipped-bug class).
- `data/migrations/041_create_coach_reports.sql` — the migration template: heavy `-- why:` header, `CREATE TABLE IF NOT EXISTS legendary.<name>`, idempotent `CREATE INDEX IF NOT EXISTS`, sequential numbering.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — confirm canonical field naming conventions before naming any column or JSON field.
- `docs/ai/REFERENCE/api-endpoints.md §D-11804` — this packet adds endpoint rows; `Status ∈ { Wired, Shipped-but-unwired, Library-only, Pending }`, `Auth ∈ { guest, handle-required, authenticated-session-required }` (D-9905). Replace whole rows, no partial-column edits.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:`), Rule 9 (`node:` prefix), Rule 11 (full-sentence errors), Rule 13 (ESM only), Rule 14 (field names match the data contract).

---

## Non-Negotiable Constraints

**Server + persistence packet (engine-wide game constraints are N/A — this packet touches no `G`, `ctx`, move, phase, RNG, or `boardgame.io` surface):**

- No `boardgame.io`, no `@legendary-arena/game-engine` runtime import, no UI-package import. `pg` is reachable only through the injected `DatabaseClient`.
- **No global `/api` body parser.** Each write route (`POST /api/feedback`, `POST /api/feedback/:id/vote`) attaches its **own** `koaBody()` middleware. Without it, `request.body` is `undefined` in production (the WP-101 / competition-route shipped-bug class).
- **Status is never written by this packet.** `POST /api/feedback` inserts `status = 'under_review'` as a literal default; there is no code path that `UPDATE`s `status`. (Status authoring = the follow-on dashboard triage WP, per D-24414.)
- **`vote_count` is a projection, never a stored column.** It is computed by `COUNT` over `legendary.feedback_vote` at read time. One vote per account per item is enforced by a `UNIQUE (feedback_item_id, account_ext_id)` constraint — the database owns the tally (D-24414: "the DB owns vote_count").
- **Voting and submission are identity-gated** (D-24414): `POST /api/feedback`, `POST` and `DELETE /api/feedback/:id/vote` are `authenticated-session-required` via the injected `requireAuthenticatedSession`. `GET /api/feedback` is `guest`.
- **The public `GET` never leaks non-public data.** It returns `type = 'enhancement'` items only. Its **default** status set is the public roadmap view — `status IN ('planned','in_progress','shipped')` — so raw intake (`under_review`) and `declined` items are hidden unless an explicit `statusFilter` widens the set (the DB round-trip test passes `statusFilter: ['under_review']` to see a freshly-inserted item, since this packet only ever writes `under_review`). It never returns bug reports, review free-text, or author PII beyond a display handle.
- `Cache-Control: no-store` is the first statement in every route handler (D-11504).
- Full-sentence error messages (Rule 11); a uniform `{ error: <code> }` envelope; closed-set error codes.
- ESM only, `node:` prefix on built-ins, `.test.ts` test files. Node v22+ (built-in `fetch`).
- Output discipline: the executor emits **full file contents** for every new or modified file — no diffs, no snippets.

**Locked contract values:**

- **`legendary.*` schema**, `bigserial` PKs, `ext_id text` for the account (`legendary.players.ext_id`).
- **`FeedbackType` closed set:** `'bug' | 'enhancement' | 'review'`.
- **`FeedbackStatus` closed set (public projection):** `'under_review' | 'planned' | 'in_progress' | 'shipped' | 'declined'`.
- **Auth closed set (D-9905):** `guest | handle-required | authenticated-session-required`.
- **New endpoints:** `POST /api/feedback`, `GET /api/feedback`, `POST /api/feedback/:id/vote`, `DELETE /api/feedback/:id/vote`.

**Session protocol:** if any field name, table name, or auth helper signature is unclear, STOP and read the cited file — never guess or invent a column name or helper shape.

---

## Debuggability & Diagnostics

- Every endpoint is deterministic given identical DB state + inputs; no clock- or RNG-dependent behavior (timestamps are DB `now()`, recorded, not branched on).
- Every write is externally observable via a row in `legendary.feedback_item` / `legendary.feedback_vote`; every read is a pure projection of those rows.
- No state mutation that cannot be inspected post-hoc (a `SELECT`) or validated by a DB-gated test.
- Failures are localizable to a typed error code in the `{ error: <code> }` envelope + a full-sentence server log line.

---

## Scope (In)

### A) Migrations
- **`data/migrations/042_create_feedback_item.sql`** — new:
  - `CREATE TABLE IF NOT EXISTS legendary.feedback_item` — `id bigserial PK`, `feedback_type text NOT NULL CHECK (feedback_type IN ('bug','enhancement','review'))`, `title text NOT NULL`, `description text NOT NULL`, `author_ext_id text NOT NULL` (= `legendary.players.ext_id`), `status text NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review','planned','in_progress','shipped','declined'))`, `resolution_reason text` (nullable; required only when `status = 'declined'`, enforced in the future dashboard WP, not here), `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.
  - `CREATE INDEX IF NOT EXISTS` on `(feedback_type, status)` for the public list.
  - Heavy `-- why:` header mirroring migration 041 (persistence-boundary note: ordinary domain storage, not `G`/snapshot/save-game, no carve-out).
- **`data/migrations/043_create_feedback_vote.sql`** — new:
  - `CREATE TABLE IF NOT EXISTS legendary.feedback_vote` — `id bigserial PK`, `feedback_item_id bigint NOT NULL REFERENCES legendary.feedback_item(id) ON DELETE CASCADE`, `account_ext_id text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, `UNIQUE (feedback_item_id, account_ext_id)`.
  - `-- why:` on the UNIQUE constraint: it is the one-vote-per-account enforcement — the DB owns the tally (D-24414).

### B) `apps/server/src/feedback/feedback.types.ts` — new
- `FeedbackType`, `FeedbackStatus` union types + their canonical arrays (`FEEDBACK_TYPES`, `FEEDBACK_STATUSES`) with a drift-detection assertion in the test.
- `FeedbackItemRecord` (row shape), `PublicFeedbackItem` (projection: id, type, title, description, status, `voteCount`, `viewerHasVoted`, createdAt), `SubmitFeedbackInput`.
- Closed-set error codes: `FeedbackErrorCode`.

### C) `apps/server/src/feedback/feedback.logic.ts` — new (pure, no `pg`)
- `validateSubmitFeedbackInput(body): { ok: true; value: SubmitFeedbackInput } | { ok: false; code: FeedbackErrorCode }` — validates `type` ∈ set, `title`/`description` non-empty + length-bounded. Never throws.
- `toPublicFeedbackItem(row, voteCount, viewerHasVoted): PublicFeedbackItem` — the projection shaper.

### D) `apps/server/src/feedback/feedback.persistence.ts` — new (the only `pg` file)
- `insertFeedbackItem(db, input, authorExtId): Promise<FeedbackItemRecord>` — inserts with `status='under_review'`; never sets status otherwise.
- `listPublicEnhancements(db, { statusFilter?, viewerExtId? }): Promise<PublicFeedbackItem[]>` — `type='enhancement'`; when `statusFilter` is omitted it defaults to the public roadmap set `['planned','in_progress','shipped']`; `LEFT JOIN` vote count, `viewerHasVoted` when a viewer is present. No bug/review rows, no author PII.
- `addVote(db, itemId, accountExtId): Promise<'added' | 'already_voted' | 'no_such_item'>` — `INSERT ... ON CONFLICT DO NOTHING`.
- `removeVote(db, itemId, accountExtId): Promise<'removed' | 'not_voted'>`.

### E) `apps/server/src/feedback/feedback.routes.ts` — new
- Mirror `coach.routes.ts` shape: local structural `KoaRouter`, injected `requireAuthenticatedSession` / `accountResolver`, `Cache-Control: no-store` first, `{ error }` envelope, `try/catch` → 500.
- `POST /api/feedback` (auth) → `feedbackRouteJsonBodyParser = koaBody()` → validate → `insertFeedbackItem` → 201 `{ id }`.
- `GET /api/feedback` (guest) → `listPublicEnhancements` (resolve viewer opportunistically if a session token is present) → 200 `{ items }`.
- `POST /api/feedback/:id/vote` (auth) → `addVote` → 200 `{ voted: true, voteCount }` (idempotent on `already_voted`), 404 on `no_such_item`.
- `DELETE /api/feedback/:id/vote` (auth) → `removeVote` → 200 `{ voted: false, voteCount }`.

### F) Runtime wiring — `apps/server/src/server.mjs` — modified (01.5)
- Register the feedback routes beside `coach.routes` / `competition.routes`, injecting `db`, `requireAuthenticatedSession`, `accountResolver`. **This is the only runtime-wiring file** (01.5-authorized outside the pure allowlist).

### G) Tests
- `feedback.logic.test.ts` — pure: validation accept/reject, drift assertion (`FEEDBACK_TYPES` / `FEEDBACK_STATUSES` exact), projection shaping. `node:test` only, no DB.
- `feedback.routes.test.ts` — injected stubs (no real DB, no paid calls): auth-gate on submit/vote, guest read, `{ error }` envelope, 404 path. Mirrors `coach.routes.test.ts`.
- `feedback.persistence.test.ts` — **DB-gated**, serialized (`--test-concurrency=1`, non-silent skip when `TEST_DATABASE_URL` is unset): insert→list→vote→unvote round-trip (the list step passes `statusFilter: ['under_review']` to see the freshly-inserted item, since inserts are `under_review`), `UNIQUE` one-vote enforcement, default-list excludes `under_review`, `type='enhancement'`-only public list, status never mutated.

### H) API catalog — `docs/ai/REFERENCE/api-endpoints.md` — modified (D-11804)
- Add whole rows for the four endpoints with `Status = Wired`, correct `Auth` per the closed set, request/response field names matching the data contract.

---

## Out of Scope

- **No status mutation / triage / moderation** — assigning `planned`/`shipped`/`declined` is the operator dashboard triage WP (follow-on). This packet only ever writes `under_review`.
- **No UI** — no dashboard panel, no public board, no arena-client/marketing surface. Those are follow-on WPs.
- **No changelog / roadmap-render surface** — follow-on.
- **No vote weighting** — one account = one vote; any weighting is a separate future decision record (D-24414 / Vision fairness).
- **No public bug or review listing** — `GET` returns enhancement items only; bug/review submission is stored but has no read surface in this packet.
- **No engine / `G` / move / scoring change**, no `boardgame.io`, no registry runtime import.
- **No rate-limiting / CAPTCHA / spam-scoring** — identity-gating is the MVP anti-abuse lever; heavier controls are a follow-on if volume warrants (Tribe-and-Trust).

---

## Vision Alignment

This packet touches two Vision surfaces and conflicts with neither:

- **Identity & profile boundary (VISION §7a / §19a-b).** Voting and submission are gated on the existing Hanko account, and the public `GET` may surface an author's **display handle** on an enhancement item. This reuses the already-shipped identity surface (handles are already public on the leaderboard / profile); it introduces no new personal-data exposure — never email, never the raw `ext_id`, never bug/review free-text. One-vote-per-account is an integrity control, not a profile change.
- **Fairness bright lines (VISION §21 / NG-1…NG-8).** The feedback board is **not** a funding, pay-to-win, or ranking surface. Votes are unweighted (one account, one vote); D-24414 explicitly gates any future vote-weighting (incl. a paid-tier perk) behind its own decision record precisely because weighting would touch the fairness line. This packet ships no weighting and no monetization affordance.

**NG-proximity check:** none. No paywall, no funding channel, no pay-to-win lever, no tournament-funding copy — the board collects and ranks feedback, nothing more. The public roadmap "Shipped" status derives from the WP/git spine, not from any purchase.

---

## Files Expected to Change

- `data/migrations/042_create_feedback_item.sql` — **new**
- `data/migrations/043_create_feedback_vote.sql` — **new**
- `apps/server/src/feedback/feedback.types.ts` — **new**
- `apps/server/src/feedback/feedback.logic.ts` — **new**
- `apps/server/src/feedback/feedback.persistence.ts` — **new**
- `apps/server/src/feedback/feedback.routes.ts` — **new**
- `apps/server/src/feedback/feedback.logic.test.ts` — **new**
- `apps/server/src/feedback/feedback.routes.test.ts` — **new**
- `apps/server/src/feedback/feedback.persistence.test.ts` — **new**
- `apps/server/src/server.mjs` — **modified** — register feedback routes (01.5 runtime-wiring)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — four new endpoint rows (D-11804)

No other files may be modified (beyond the governance close-out: STATUS.md, DECISIONS.md, WORK_INDEX.md, ROADMAP-MINDMAP.md, EC_INDEX.md).

---

## Acceptance Criteria

### Migrations
- [ ] `042` creates `legendary.feedback_item` with the exact columns + CHECK constraints above; idempotent (`IF NOT EXISTS`).
- [ ] `043` creates `legendary.feedback_vote` with `UNIQUE (feedback_item_id, account_ext_id)` + `ON DELETE CASCADE`.
- [ ] `pnpm migrate` (against a test DB) applies both cleanly and is re-runnable.

### API
- [ ] `POST /api/feedback` rejects an unauthenticated caller with the auth error envelope; on success inserts `status='under_review'` and returns 201 `{ id }`.
- [ ] `GET /api/feedback` (no auth) returns only `type='enhancement'` items with a projected `voteCount`; no bug/review rows, no author PII.
- [ ] `POST /api/feedback/:id/vote` is idempotent (second call by the same account does not double-count; `voteCount` reflects the UNIQUE constraint); 404 on unknown id.
- [ ] `DELETE /api/feedback/:id/vote` removes the caller's vote; `voteCount` drops by one; no-op when not voted.
- [ ] No code path issues an `UPDATE ... status` (confirmed with `Select-String`).

### Tests
- [ ] `pnpm --filter @legendary-arena/server test` exits 0.
- [ ] Drift test: `FEEDBACK_TYPES` / `FEEDBACK_STATUSES` match their unions exactly.
- [ ] DB-gated persistence test runs serialized (`--test-concurrency=1`) and skips non-silently when `TEST_DATABASE_URL` is unset.
- [ ] No `boardgame.io` / `@legendary-arena/game-engine` import in any new file (confirmed with `Select-String`).

### Scope
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/server build
# Expected: exits 0

# Step 2 — tests (DB-gated serialized)
pnpm --filter @legendary-arena/server test
# Expected: all passing; persistence test runs when TEST_DATABASE_URL is set, else non-silent skip

# Step 3 — confirm status is never UPDATEd
Select-String -Path "apps\server\src\feedback\*.ts" -Pattern "UPDATE.*status"
# Expected: no output

# Step 4 — confirm no engine/boardgame.io import
Select-String -Path "apps\server\src\feedback\*.ts" -Pattern "boardgame.io|game-engine"
# Expected: no output

# Step 5 — confirm each write route attaches its own koaBody
Select-String -Path "apps\server\src\feedback\feedback.routes.ts" -Pattern "koaBody"
# Expected: import + at least one route-scoped koaBody()

# Step 6 — scope
git diff --name-only
# Expected: only files in ## Files Expected to Change (+ governance close-out)
```

---

## Definition of Done

- [ ] **User-visible verification (CONDITIONAL):** surface is `none — infrastructure` → `docs/ai/STATUS.md` states **"No user-observable change — infrastructure only"** (payoff: the intake/voting contract the public board + dashboard triage build on).
- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/server build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0
- [ ] No `UPDATE ... status` in `apps/server/src/feedback/` (Select-String)
- [ ] No `boardgame.io` / `game-engine` import in any new file (Select-String)
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` — four new rows (D-11804), whole-row, closed-set Status/Auth
- [ ] `docs/ai/STATUS.md` updated — the feedback intake/voting API + tables now exist; no user-observable change
- [ ] `docs/ai/DECISIONS.md` — D-24414 flipped from "Drafted" to **Active (post-execution)**
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-604 checked off with today's date
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-604 node glyph `📝` → `✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

---

## Lint Gate Self-Review

Audited against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` (21 sections) via an independent lint pass (2026-08-25). All sections PASS or carry a justified N/A:

- **§1 Structure** — PASS (all required sections present + non-empty).
- **§2 Non-Negotiable Constraints** — PASS. Engine-wide *determinism* items are N/A (no engine surface); the always-apply *output-discipline* lines (full file contents / no diffs / Node v22+) are present.
- **§3 Assumes** — PASS (WP-01, WP-104/332, WP-594, D-24414; blocked-if-false stated).
- **§4 Context** — PASS (ARCHITECTURE §Layer Boundary + §Persistence, 00.2, api-endpoints §D-11804, 00.6, mirror files).
- **§5 Files Expected to Change** — PASS (11 files, one cohesive server vertical; matches the EC allowlist exactly).
- **§6 Naming Consistency** — PASS (the vote-uniqueness column is `account_ext_id` everywhere; the earlier `account_id` slip in Goal/Constraints was corrected).
- **§7 Dependencies** — PASS (no new npm deps; reuses `koa-body`/`pg`/`node:test`).
- **§8 Architectural Boundaries** — PASS (Postgres domain data only; `G`/`ctx` never stored; pg via injected client; server-layer only).
- **§9 Windows** — PASS (`pwsh` / `Select-String` / backslash paths).
- **§10 Env Var Hygiene** — PASS (no new env vars; `TEST_DATABASE_URL` documented; no secrets).
- **§11 Authentication Clarity** — PASS (injected `requireAuthenticatedSession` for writes, `guest` GET; closed set D-9905).
- **§12 Test Quality** — PASS (`node:test`, no `boardgame.io`, DB test serialized + non-silent skip).
- **§13 Commands & Verification** — PASS (exact `pnpm` commands + expected output).
- **§14 Acceptance Criteria** — PASS (binary/observable; grouped by sub-task).
- **§15 Definition of Done** — PASS (STATUS/DECISIONS/WORK_INDEX + scope check; §15.1 `none — infrastructure` branch correct).
- **§16 Code Style** — PASS (full-sentence errors, no abbreviations, `// why:`, ESM/named imports).
- **§17 Vision Alignment** — PASS. `## Vision Alignment` section added: identity/profile boundary (§7a/§19a-b) reuses the shipped handle surface, no new PII; fairness bright lines (§21/NG-1…8) — unweighted voting, weighting gated by D-24414. NG-proximity: none.
- **§18 Prose-vs-Grep** — PASS (the `boardgame.io|game-engine` and `UPDATE.*status` greps are scoped to `apps\server\src\feedback\*.ts`, not WP prose).
- **§19 Bridge-vs-HEAD** — N/A (commit-time discipline, not a WP-lint rule).
- **§20 Funding Surface Gate** — N/A (justified): no global-nav / registry / profile funding affordance, no donate / tournament-funding copy, no funding-channel integration anywhere in this packet.
- **§21 API Catalog (D-11804)** — PASS: `api-endpoints.md` is in the allowlist; four whole rows, `Status = Wired`, `Auth` per the closed set, field names matching the data contract.

**Pre-flight verdict (01.4):** READY TO EXECUTE. **Copilot verdict (01.7):** RISK → resolved (the `account_id`→`account_ext_id` fix it prescribed was applied verbatim; a scope-neutral wording change). **Lint (00.3):** PASS after adding §17 Vision Alignment and the §2 output-discipline lines.
