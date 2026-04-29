# EC-117 — Public Player Profile Page (Execution Checklist)

**Source:** docs/ai/work-packets/WP-102-public-profile-page.md
**Layer:** Server (read-only profile composition) + Arena Client (Vue SPA route + page)

> *Slot retargeted from EC-102 to EC-117 (2026-04-28 staleness sweep). EC-102 is occupied by `EC-102-viewer-typecheck-cleanup.checklist.md` (viewer-series namespace keystone). Follows the EC-101 → EC-114 retarget precedent.*

**Execution Authority:** This EC is the authoritative execution checklist for WP-102. Implementation must satisfy every clause exactly. If EC and WP conflict on design, **WP-102 wins**.

## Before Starting (STOP / GO Gate)
- [ ] WP-052 merged on `main` (`legendary.players` + `legendary.replay_ownership` + `findPlayerByAccountId` + `Result<T>` + `AccountId`)
- [ ] WP-101 merged on `main` (Commit B `7b92734` confirmed; `findAccountByHandle` + `getHandleForAccount` + migration `008` applied)
- [ ] WP-053 / WP-103 contract files unchanged at HEAD (verified by `git diff main`)
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` baseline: engine **`570 / 126 / 0`**; server **`63 / 9 / 0`** (with skips when `TEST_DATABASE_URL` unset)
- [ ] `git diff --name-only packages/ apps/server/src/identity/ apps/server/src/replay/ apps/server/src/competition/ data/migrations/` empty at start

## Locked Values (do not re-derive)
- Endpoint: `GET /api/players/:handle/profile` (single new route; no other HTTP verbs)
- 404 body: `{ "error": "player_not_found" }` (verbatim; no information leak)
- `PublicProfileView` 4 fields: `handleCanonical`, `displayHandle`, `displayName`, `publicReplays`
- `PublicReplaySummary` 4 fields: `replayHash`, `scenarioKey`, `visibility`, `createdAt`
- `PublicReplaySummary.visibility` typed as `'public' | 'link'` — `'private'` excluded at the type level
- `ProfileErrorCode = 'player_not_found'` (sole value); `PROFILE_ERROR_CODES` canonical readonly array drift-tested
- Replay-filter SQL: `visibility IN ('public', 'link') AND (expires_at IS NULL OR expires_at > now())`
- `Result<T>`, `AccountId`, `DatabaseClient` re-imported from `../identity/identity.types.js`; never redeclared
- Vue route: `/players/:handle` lazy-loads `PlayerProfilePage.vue` via the existing router

## Guardrails
- No `INSERT` / `UPDATE` / `DELETE` SQL anywhere under `apps/server/src/profile/` (grep-verified)
- No `boardgame.io`, `@legendary-arena/game-engine`, `@legendary-arena/registry`, `@legendary-arena/preplan` import in any WP-102 file
- No `requireAuthenticatedSession` import; no Hanko reference (`@teamhanko`, `hanko.io`, `'hanko'` literal); no WP-112 contract invocation
- Handle → `AccountId` dereference per request via `findAccountByHandle`; no `(handle, *)` cache beyond request scope
- Empty-state tabs (rank, badges, tournaments, comments, integrity, support) make zero `fetch` / XHR / WebSocket calls
- `.reduce()` forbidden in profile composition; use explicit `for...of` loops
- WP-052 / WP-101 / WP-053 / WP-103 contract files NOT modified; `packages/game-engine/src/types.ts` NOT modified; no new migration

## Required `// why:` Comments
- `profile.routes.ts` route handler: thin adapter rationale (logic lives in `profile.logic.ts` for testability without Express)
- `profile.routes.ts` route handler: intentionally unauthenticated; visibility governed solely by replay flags + server filter; future authenticated `/me/profile` MUST register a separate handler
- `profile.logic.ts` `loadPlayerIdByAccountId`: WP-101 `findAccountByHandle` returns `PlayerAccount` keyed on `ext_id`/`AccountId`; the bigint `player_id` FK is fetched separately because `legendary.replay_ownership` joins on it
- `profile.logic.ts` 404 / `player_not_found` discipline: no information leak distinguishing unclaimed / deleted / reserved
- `profile.logic.ts` replay-filter SQL: `'private'` excluded at the SQL level; type-level exclusion is defense-in-depth
- `PlayerProfilePage.vue` empty-state tabs: zero fetch / network calls; rendered as static "Coming soon — see WP-NNN" placeholders

## Files to Produce
- `apps/server/src/profile/profile.types.ts` — **new**
- `apps/server/src/profile/profile.logic.ts` — **new**
- `apps/server/src/profile/profile.routes.ts` — **new**
- `apps/server/src/profile/profile.logic.test.ts` — **new** (8 tests in 1 `describe()` block)
- `data/migrations/` — **NOT modified** (no new migration in this WP)
- `apps/arena-client/src/router/routes.ts` — **modified** (single new route entry)
- `apps/arena-client/src/pages/PlayerProfilePage.vue` — **new**
- `apps/arena-client/src/lib/api/profileApi.ts` — **new** (`fetchPublicProfile(handle)`)
- `apps/server/src/<server-entry>.ts` — **modified** (one-line `registerProfileRoutes` call; exact file confirmed at pre-flight)

## After Completing
- [ ] All WP-102 §Verification Steps + §Definition of Done items pass
- [ ] `pnpm -r build` exits 0; engine baseline **`570 / 126 / 0`** unchanged
- [ ] Server baseline post-execution **`71 / 10 / 0`** (or `71` with skips for DB tests 4–8 when `TEST_DATABASE_URL` unset)
- [ ] `git diff --name-only main` limited to the files in §Files to Produce
- [ ] New `D-NNNN` entry classifies `apps/server/src/profile/` as a server-layer directory (mirrors D-5202 / D-10301); D-number assigned at execution
- [ ] `docs/ai/STATUS.md` `### WP-102 / EC-117 Executed` block at top of `## Current State`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-102 row `[ ]` → `[x]` with date + Commit A SHA
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-117 row `Draft` → `Done {YYYY-MM-DD}`
- [ ] Commit A prefix `EC-117:` (NOT `EC-102:` — collides with viewer-typecheck EC; NOT `WP-102:` — commit-msg hook rejects per P6-36); Commit B prefix `SPEC:`; Vision trailer `Vision: §3, §11, §14, §18, §24, §25` on Commit A

## Common Failure Smells
- Server baseline reads `48/7/0` or `522/116/0` — re-read post-WP-101 baselines: server `63/9/0`, engine `570/126/0` (post-WP-113 + WP-101 floor)
- `Result<T>` / `AccountId` / `DatabaseClient` redeclared in `profile.types.ts` — re-import from `../identity/identity.types.js` per the WP-101 precedent
- Migration filename `007_add_handle_to_players.sql` — STOP; WP-101 retargeted to slot `008` on 2026-04-27; slot `007` is WP-053 `competitive_scores`
- `'private'` appears anywhere in `profile.logic.ts` or `profile.types.ts` — STOP; visibility is type-narrowed to `'public' | 'link'` and SQL-filtered server-side
- Route handler imports `requireAuthenticatedSession` — STOP; this endpoint is intentionally public per WP-102 §Non-Negotiable Constraints
- Page calls `fetch` from inside an empty-state tab — STOP; tabs are inert per WP-102 §"Empty-state stubs make zero network requests"
