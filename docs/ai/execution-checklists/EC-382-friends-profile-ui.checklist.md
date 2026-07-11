# EC-382 — Friends Tab on the Owner Profile (Execution Checklist)

**Source:** docs/ai/work-packets/WP-352-friends-profile-ui.md
**Layer:** App (`apps/arena-client`). **Lane:** Standard two-session (new client wrapper contract + new component + user-visible surface).

## Before Starting
- [ ] Fresh branch/worktree off `origin/main` — **after WP-350 + WP-351 merged** (the `/api/me/friends*` endpoints are Wired).
- [ ] Read the precedents: `lib/api/ownerProfileApi.ts` (+ `.test.ts` for the fetch-stub + drift test), `components/BillingSection.vue` (`defineComponent` section + `authToken` prop + loading/error/empty/ready states), `pages/MyProfilePage.vue` (how `<BillingSection :auth-token="readAuthToken()" />` mounts), `composables/useAuthNav.test.ts` (globalThis.fetch stub + `@vue/test-utils` mount).
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL. **No `apps/server` / `data/migrations` / engine / registry touch.**

## Locked Values (do not re-derive)
- **`FriendSummary` (inline mirror, no server import):** `{ handle: string; displayName: string; status: 'pending'|'accepted'|'declined'; direction: 'incoming'|'outgoing'; requestedAt: string; respondedAt: string | null }` — **no `accountId`**.
- **`FriendsApiResult<T>`** = `{ ok:true, value:T } | { ok:false, status:number, code: FriendApiErrorCode | null }`; the `removeFriend` success branch is `{ ok:true }` (no value).
- **Client `FRIEND_API_ERROR_CODES` mirror** (11, set-equal to WP-351 server union): `self_friendship`, `already_pending`, `already_friends`, `no_pending_request`, `not_addressee`, `not_friends`, `unknown_account`, `unauthorized`, `invalid_request`, `handle_required`, `handle_not_found` — with a drift test.
- **Six wrappers** (`buildApiUrl` + optional `Bearer ${authToken}`, never throw; network throw → `{status:0,code:null}`; parse `body.error` for the code): `fetchFriends`, `fetchFriendRequests`, `sendFriendRequest`, `acceptFriendRequest`, `declineFriendRequest`, `removeFriend`. Routes: `GET /api/me/friends`, `GET /api/me/friends/requests`, `POST /api/me/friends/requests` `{handle}`, `POST /api/me/friends/requests/:handle/accept`, `…/decline`, `DELETE /api/me/friends/:handle`.
- **State strategy:** mutate → **refetch** (authoritative, not optimistic). `useFriends.load()` fetches friends + requests; each action calls the wrapper then reloads.
- **Outgoing pending is display-only** (WP-351 has no cancel route — Known gap).
- **Identity on screen:** `@handle` + `displayName` only — **no `accountId`** rendered/read (grep-asserted; `FriendsSection.vue` contains neither `accountId` nor `ext_id`).
- **Error copy map (closed):** `already_friends`→"You're already friends." · `already_pending`→"A request to that player is already pending." · `handle_not_found`→"No player with that handle." · `handle_required`→"Claim a handle first to add friends." · `self_friendship`→"You can't friend yourself." · `not_addressee`/`no_pending_request`/`not_friends`→context line · `unauthorized`→"Please sign in again." · unknown/null → generic banner.
- Reserved decision: **D-24144** (flips to Active at execution close).

## Guardrails
- **Consumer-only.** No endpoint, migration, or server file. Calls only WP-351's six routes.
- **Layer isolation.** `friendsApi.ts` / `useFriends.ts` / `FriendsSection.vue` import nothing from `@legendary-arena/game-engine`, `@legendary-arena/registry` (runtime), `apps/server`, `pg`, `boardgame.io`. `FriendSummary` declared inline.
- **No PvP framing (§23(b)).** Copy is "friend"/"request"/"add" only — no challenge/opponent/match/vs/win-loss/rank.
- `defineComponent` SFC (D-6512, NOT `<script setup>`); return all template bindings from `setup()`. `node:test` `.test.ts`.
- Never throws; typed failure. `// why:` on the refetch-not-optimistic choice, the no-`accountId` rule, the `body.error` parse.

## Required `// why:` Comments
- On the inline `FriendSummary` (mirror of the server shape; isolation rule forbids the import).
- On the client `FRIEND_API_ERROR_CODES` mirror + drift test.
- On mutate-then-refetch (authoritative, not optimistic).
- On outgoing-requests being display-only (no cancel route in WP-351).

## Files to Produce
- `apps/arena-client/src/lib/api/friendsApi.ts` — new.
- `apps/arena-client/src/composables/useFriends.ts` — new.
- `apps/arena-client/src/components/FriendsSection.vue` — new.
- `apps/arena-client/src/pages/MyProfilePage.vue` — mount `<FriendsSection :auth-token="readAuthToken()" />`.
- `apps/arena-client/src/lib/api/friendsApi.test.ts` — new.
- `apps/arena-client/src/composables/useFriends.test.ts` — new.
- `apps/arena-client/src/components/FriendsSection.test.ts` — new.
- Governance: `DECISIONS.md` (D-24144 → Active), `STATUS.md`, `WORK_INDEX.md` (WP-352 `[x]`), `EC_INDEX.md` (EC-382 Done), `05-ROADMAP-MINDMAP.md`, `wiki/profile-login.md` (packet-#3 → WP-352).

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) 0; `pnpm --filter @legendary-arena/arena-client test` green (new suites; baseline otherwise unchanged); `pnpm -r build` 0.
- [ ] `Select-String friendsApi.ts,useFriends.ts,FriendsSection.vue -Pattern "@legendary-arena/game-engine|@legendary-arena/registry|apps/server|boardgame.io"` → no output.
- [ ] `Select-String FriendsSection.vue -Pattern "accountId|ext_id"` → no output.
- [ ] `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24144 Active) / WORK_INDEX (WP-352 `[x]`) / EC_INDEX (EC-382 Done) / mindmap node ✅ / wiki packet-#3 link; `roadmap:counts:check` green.
- [ ] `User-Visible Surface = play.legendary-arena.com ?route=me` → **D-24026 APPLIES**: operator-pending live click-through (add by @handle → outgoing; accept from the other account → both friends lists; remove → gone) after WP-351 is deployed. Proof = suite + live check.

## Common Failure Smells
- Rendering/reading an `accountId` the API never sends.
- Importing a server type instead of the inline `FriendSummary`.
- Optimistic list mutation that drifts from the server (use refetch).
- A server code change silently unhandled (drift test must fail loudly).
- PvP framing creeping into copy.
- Expecting a cancel-outgoing route that WP-351 doesn't expose.
