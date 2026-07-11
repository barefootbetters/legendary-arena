# EC-385 — Friend Abuse Controls (Execution Checklist)

**Source:** docs/ai/work-packets/WP-355-friend-abuse-controls.md
**Layer:** Server + Persistence (`apps/server/src/friendships/**`, `data/migrations`). **Lane:** Standard two-session (new table + new `.logic.ts` + block endpoints + additive `FriendApiErrorCode` extension + catalog rows).

## Before Starting
- [ ] Fresh worktree off `origin/main`. Highest migration on disk is `029`; next free is `030`.
- [ ] Confirm hard-deps on `main`: WP-350 (`legendary.friendships`, `removeFriend`), WP-351 (`friendships.routes.ts` send handler + `FriendApiErrorCode` + `findAccountByHandle`), WP-104 auth pattern. All ✅.
- [ ] Read `friendships.routes.ts` (WP-351/353 — the send handler to guard at ~372, the `FriendApiErrorCode` union ~137, `statusForFriendApiErrorCode` ~207, the `KoaRouter` interface, the end of `registerFriendshipRoutes` ~597 where block routes mount), `friendships.logic.ts` (`resolvePlayerId` + normalized-pair pattern), `ownerProfile.logic.ts` (`BEGIN/COMMIT` via `pool.connect()`).
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL. **WP-350's `friendships.{types,logic}.ts` are byte-identical.**

## Locked Values (do not re-derive)
- **Migration `030`:** `legendary.player_blocks` — `block_id bigserial PK`; `blocker_id`/`blocked_id bigint NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE`; `created_at timestamptz NOT NULL DEFAULT now()`; `UNIQUE (blocker_id, blocked_id)`; `CHECK (blocker_id <> blocked_id)`; index on `blocker_id`. Idempotent.
- **`MAX_OUTGOING_PENDING_PER_DAY = 20`** (outgoing `pending` requests in the trailing 24h; `>=` → `rate_limited`).
- **`REREQUEST_COOLDOWN_HOURS = 24`** (re-send to a requester whose decline against you is within this window → `request_cooldown`).
- **Guard order in the send handler:** **block → cooldown → rate limit**, ALL before `sendFriendRequest` (after the target `@handle` resolves).
- **Block symmetry:** `isEitherBlocked(pool, a, b)` rejects a send if A blocked B **or** B blocked A → `blocked`.
- **Block sever:** `blockPlayer` INSERTs the block **and** DELETEs any `legendary.friendships` normalized-pair row between the two, in one `BEGIN/COMMIT` (a scoped pair-delete in the NEW module — WP-350 files untouched).
- **`FriendApiErrorCode` += `'blocked' | 'rate_limited' | 'request_cooldown'`** (union + `FRIEND_API_ERROR_CODES` array + the drift test in `friendships.routes.test.ts` updated together). Status: `blocked`→403, `rate_limited`→429, `request_cooldown`→429.
- **`BlockApiErrorCode`** (new closed union in `playerBlocks.logic.ts`) = `'unknown_account' | 'self_block' | 'already_blocked' | 'not_blocked'` + `BLOCK_ERROR_CODES` array + drift test. Route adds `unauthorized`/`invalid_request`/`handle_not_found`. Status: `not_blocked`/`handle_not_found`→404, `self_block`/`already_blocked`/`unknown_account`→409, `invalid_request`→400, `unauthorized`→401.
- **Block endpoints** (`authenticated-session-required`, `Cache-Control: no-store`): `POST /api/me/blocks {handle}` → 201 (`{ handle, displayName }`); `DELETE /api/me/blocks/:handle` → 204; `GET /api/me/blocks` → 200 `{ blocked: [{ handle, displayName }] }`. **No `accountId`** on the wire (FR-2). Mounted INSIDE `registerFriendshipRoutes` (no `server.mjs` change).
- Reserved decision: **D-24147** (flips to Active at execution close).

## Guardrails
- No cross-layer import beyond the server set; `playerBlocks.logic.ts` imports only `pg` types + Node built-ins + identity types (same layer). No `boardgame.io`/engine/registry.
- WP-350 `friendships.{types,logic}.ts` byte-identical (`git diff origin/main` empty); the sever reuses a scoped pair-delete in the new module.
- WP-351's six friend-endpoint shapes byte-identical; only the send row's error set is extended (additive) + the block endpoints are new.
- Server-layer clock reads (`Date.now()` for the 24h window + cooldown) are allowed (NOT engine) — add a `// why:` at each.

## Required `// why:` Comments
- On the transactional block-and-sever (`BEGIN/COMMIT`).
- On the symmetric `isEitherBlocked` (both directions).
- On the guard order (block → cooldown → rate limit) before `sendFriendRequest`.
- On the trailing-24h window + cooldown clock reads (server-layer, not engine).
- On `unknown_account` not revealing which account failed.

## Files to Produce
- `data/migrations/030_create_player_blocks.sql` — new.
- `apps/server/src/friendships/playerBlocks.logic.ts` — new (block model + guard helpers).
- `apps/server/src/friendships/playerBlocks.logic.test.ts` — new.
- `apps/server/src/friendships/friendships.routes.ts` — send guards + 3 block endpoints + extended `FriendApiErrorCode` (additive).
- `apps/server/src/friendships/friendships.routes.test.ts` — guard + block-endpoint cases + extended drift test.
- `docs/ai/REFERENCE/api-endpoints.md` — 3 block rows + updated `POST /api/me/friends/requests` row (D-11804).
- Governance: `DECISIONS.md` (D-24147 → Active), `STATUS.md`, `WORK_INDEX.md` (WP-355 `[x]`), `EC_INDEX.md` (EC-385 Done), `05-ROADMAP-MINDMAP.md`, `wiki/profile-login.md`.

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` green (new + extended suites; DB-less skip parity; baseline otherwise unchanged).
- [ ] `git diff --name-only origin/main -- apps/server/src/friendships/friendships.types.ts apps/server/src/friendships/friendships.logic.ts` → empty.
- [ ] `Select-String playerBlocks.logic.ts -Pattern "player_blocks|isEitherBlocked|blockPlayer"` present; `friendships.routes.ts -Pattern "blocked|rate_limited|request_cooldown|/api/me/blocks"` present; migration grep present.
- [ ] No cross-layer import in the new module; no `accountId` on the block-list wire (test-asserted).
- [ ] `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24147 Active) / WORK_INDEX (WP-355 `[x]`) / EC_INDEX (EC-385 Done) / mindmap ✅ / wiki; `api-endpoints.md` 3 rows + send row same-commit; `roadmap:counts:check` green.
- [ ] `User-Visible Surface = play.legendary-arena.com` → **D-24026 operator-pending on deploy** (block → can't be friend-requested + friendship gone; over-cap → rate_limited; re-send after decline → request_cooldown).

## Common Failure Smells
- Modeling a block as a friendship `status` (must be the separate `player_blocks` table — D-24142).
- A block leaving a live friendship (must be transactional insert-block-and-sever).
- One-directional block bypass (must be `isEitherBlocked` both directions).
- Editing WP-350's locked contract files.
- `FriendApiErrorCode` drift (union + array + drift test updated together).
- `accountId` leaking on the block list.
- Rate limit counting the wrong rows (must be outgoing `pending` by `requester_id` in the trailing 24h).
