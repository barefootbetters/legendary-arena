# EC-381 — Friend-Request API (`/api/me/friends*`) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-351-friend-request-api.md
**Layer:** Server (`apps/server/src/friendships/friendships.routes*.ts` + `server.mjs` wiring + `api-endpoints.md`). **Lane:** Standard two-session (new `.routes.ts` contract + new endpoints + api-catalog rows + wiring).

## Before Starting
- [ ] Fresh branch/worktree off `origin/main` — **after WP-350 merged** (verify `apps/server/src/friendships/friendships.{logic,types}.ts` present).
- [ ] Read the precedents: `loadoutLibrary.routes.ts` (auth-first, typed-error → status, `Cache-Control` first statement, deps bundle), `loadoutLibrary.routes.test.ts` (FakeRouter + injected session harness), `loadoutLibrary.types.ts` (`RequireAuthenticatedSessionResult` local-declare pattern), `handle.logic.ts` (`findAccountByHandle` + `getHandleForAccount`), `server.mjs` `registerLoadoutLibraryRoutes(...)` wiring site.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL. **WP-350's `friendships.{logic,types}.ts` are byte-identical pre/post.**

## Locked Values (do not re-derive)
- **Six routes** (`authenticated-session-required`, `Cache-Control: no-store` first statement): `POST /api/me/friends/requests` (body `{handle}` → 201), `GET /api/me/friends` (→ 200 `{friends}`), `GET /api/me/friends/requests` (→ 200 `{incoming, outgoing}`), `POST /api/me/friends/requests/:handle/accept` (→ 200), `POST /api/me/friends/requests/:handle/decline` (→ 200), `DELETE /api/me/friends/:handle` (→ 204).
- **`FriendSummary`** = `{ handle, displayName, status, direction, requestedAt, respondedAt }` — imports `FriendshipStatus` from WP-350; **NEVER** `accountId` / `ext_id` / `player_id` (FR-2).
- **`FriendApiErrorCode`** (11) = `self_friendship | already_pending | already_friends | no_pending_request | not_addressee | not_friends | unknown_account | unauthorized | invalid_request | handle_required | handle_not_found` — canonical `FRIEND_API_ERROR_CODES` array + drift test. (`internal_error` is the structural 500 sentinel, NOT in the union — mirrors loadout.)
- **HTTP status mapping:** `unauthorized`→401 · `invalid_request`→400 · `handle_not_found`→404 · `no_pending_request`→404 · `not_friends`→404 · `not_addressee`→403 · `handle_required`/`self_friendship`/`already_pending`/`already_friends`/`unknown_account`→409 · unexpected→500 `{error:'internal_error'}`.
- **Handle canonicalization:** pass the raw `@handle` to `findAccountByHandle` (it does `trim().toLowerCase()` internally).
- **Acting-account handle requirement:** on every **mutating** route (send/accept/decline/remove), the acting account must have a claimed handle (`getHandleForAccount` non-null) else `handle_required` (409). GET routes do not gate on handle.
- **Target resolution:** an unresolved body/`:handle` → `handle_not_found` (404).
- **Enrichment:** ONE `SELECT ext_id, display_handle, display_name FROM legendary.players WHERE ext_id = ANY($1::text[])` per list route (not N); swap each `FriendshipView.otherAccountId` for `{handle: display_handle, displayName: display_name}`.
- Reserved decision: **D-24143** (flips to Active at execution close).

## Guardrails
- **Contract-file lock:** WP-350's `friendships.{types,logic}.ts` and migration 028 are NOT touched (`git diff origin/main` empty for both). No new migration.
- **No new cross-layer import:** routes import only WP-350's `friendships.{logic,types}.js`, `../identity/handle.logic.js`, `../auth/sessionToken.types.js`, and `pg` types. **No `boardgame.io`, engine, registry.**
- **Auth-first:** `requireAuthenticatedSession` (caller-injected `verifier`/`accountResolver`) is the first business step on every route; guest → `unauthorized` 401; acting identity is session-resolved, NEVER body-supplied.
- **No `accountId` on the wire** — `FriendSummary` allowlist; asserted by a test.
- **Typed errors, never throw:** every non-2xx path → `{ error: FriendApiErrorCode }`; uncaught → typed 500 `{error:'internal_error'}`; `Cache-Control` first statement so it survives a throw.
- **No email / UI / ranked / gameplay touch.**

## Required `// why:` Comments
- On the wire-`accountId` omission in `FriendSummary` (FR-2).
- On the acting-account `handle_required` policy (keeps both parties addressable).
- On the HTTP status-mapping fall-through to 409.
- On the single-round-trip enrichment (`ANY($1)`, not N).
- On `Cache-Control` first statement (D-11504).

## Files to Produce
- `apps/server/src/friendships/friendships.routes.ts` — new (routes + wire types + enrichment).
- `apps/server/src/friendships/friendships.routes.test.ts` — new.
- `apps/server/src/server.mjs` — one `registerFriendshipRoutes(server.router, pool, { requireAuthenticatedSession, verifier, accountResolver })` call in the profile-routes wiring block (01.5).
- `docs/ai/REFERENCE/api-endpoints.md` — 6 new rows (D-11804; `Status = Wired`, `Auth = authenticated-session-required`; fields match `FriendSummary`).
- Governance: `DECISIONS.md` (D-24143 → Active), `STATUS.md`, `WORK_INDEX.md` (WP-351 `[x]`), `EC_INDEX.md` (EC-381 Done), `05-ROADMAP-MINDMAP.md`, `wiki/profile-login.md` (packet-#2 → WP-351).

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` green (new routes suite; DB-less skip parity; baseline otherwise unchanged).
- [ ] DB-backed smoke of the 6 endpoints against a real Postgres (documented in the session).
- [ ] `git diff --name-only origin/main -- apps/server/src/friendships/friendships.types.ts apps/server/src/friendships/friendships.logic.ts` → empty.
- [ ] `Select-String apps\server\src\friendships\friendships.routes.ts -Pattern "boardgame.io|@legendary-arena/game-engine|@legendary-arena/registry"` → no output.
- [ ] `api-endpoints.md` has 6 `/api/me/friends*` rows (closed `Status`/`Auth` sets); §21 passes.
- [ ] `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24143 Active) / WORK_INDEX (WP-351 `[x]`) / EC_INDEX (EC-381 Done) / mindmap node / wiki packet-#2 link; `roadmap:counts:check` green.
- [ ] `User-Visible Surface = none` → D-24026 live-verify **N/A** (deferred to packet #3); proof is the suite + the DB smoke.

## Common Failure Smells
- Leaking `accountId`/`ext_id`/`player_id` on any wire object (the exact FR-2 violation).
- Trusting a body-supplied identity instead of the session.
- N+1 enrichment (one query per friend) instead of `ANY($1)`.
- Editing WP-350's locked contract files.
- Missing `Cache-Control` first statement (a thrown 500 without the header).
- Forgetting the `api-endpoints.md` rows in the SAME commit as the routes (D-11804).
