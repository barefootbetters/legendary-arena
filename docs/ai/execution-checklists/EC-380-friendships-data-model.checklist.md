# EC-380 — Friendships Data Model + Status Machine + Mutual-Clique Helper (Execution Checklist)

**Source:** docs/ai/work-packets/WP-350-friendships-data-model.md
**Layer:** Server + Persistence (`apps/server/src/friendships/**`, `data/migrations/028`). **Lane:** Standard two-session (new `.types.ts` contract + new table + new server code category — D-24028 forbids the lightweight lane for a new contract file).

## Before Starting
- [ ] Fresh branch/worktree off `origin/main`.
- [ ] Confirm the three hard-deps are on `main`: WP-052 (`legendary.players` `player_id`/`ext_id`/`Result<T>`), WP-101 (`handle_canonical`), WP-104 (profile-family `player_id bigint` FK convention, migration 009). All ✅ — no unmerged dep.
- [ ] Confirm next-free migration is `028` (highest on disk is `027`).
- [ ] Read `ownerProfile.logic.ts` (the `ext_id → player_id` resolve, `try/catch → typed Result`, `BEGIN/COMMIT`), migration 009 (FK / CASCADE / `IF NOT EXISTS`), `identity.types.ts` (`Result<T>` + `AUTH_PROVIDERS` drift precedent).
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- **`status` closed set:** `('pending','accepted','declined')` — DB CHECK + TS union + canonical `FRIENDSHIP_STATUSES` array + drift test. Blocking is a **separate future model**, NEVER a `'blocked'` status here.
- **Pair uniqueness:** one row per **unordered** pair — `CREATE UNIQUE INDEX ... friendships_pair_unique ON legendary.friendships (LEAST(requester_id,addressee_id), GREATEST(requester_id,addressee_id))`. Forbids both `A→B` and `B→A`.
- **Lookup index:** `idx_friendships_addressee_status ON legendary.friendships (addressee_id, status)` (incoming-pending read path).
- **`sendFriendRequest` on a `declined` pair:** transition `declined → pending` via **UPDATE** (new `requester_id`, `requested_at = now()`, `responded_at = null`) — never a second row.
- **`removeFriend`:** **DELETE** the row (symmetric); re-friending is a fresh request, not a status flip.
- **Clique — business rule:** a set is a clique **iff** for every distinct pair `(A,B)` in the set `accepted_friendship(A,B) = true`.
- **Clique — implementation:** resolve the de-duplicated `n` `AccountId`s to `n` `player_id`s; clique **iff** the count of `accepted` rows with **both** endpoints in the set equals `n*(n-1)/2`. `n ≤ 1` → `true` (vacuous). Repeated `AccountId`s removed before evaluation (order/dup independent).
- **`FriendshipView` fields:** `otherAccountId`, `status`, `direction ('incoming'|'outgoing')`, `requestedAt`, `respondedAt` — NEVER `player_id`, `friendship_id`, or `display_name`.
- **Closed error union:** `FriendshipErrorCode = 'unknown_account' | 'self_friendship' | 'already_pending' | 'already_friends' | 'no_pending_request' | 'not_addressee' | 'not_friends'` — canonical `FRIENDSHIP_ERROR_CODES` array + drift test. `unknown_account` = one-or-more unresolved `AccountId`s (no which-account enumeration).
- Reserved decision: **D-24142** (flips to Active at execution close).

## Guardrails
- **No new cross-layer import.** `friendships.{types,logic,logic.test}.ts` import only `pg` types + Node built-ins + re-import `AccountId`/`DatabaseClient`/`Result` shape from `../identity/identity.types.js` (same layer). NO `boardgame.io`, engine, registry, lagn.
- **Identity anchor (FR-2/FR-3):** every function keyed on `AccountId` (`ext_id`); the table stores `player_id`; `display_name` never a key. Resolve `ext_id → player_id` inline (`SELECT player_id FROM legendary.players WHERE ext_id = $1 LIMIT 1`).
- **Functions never throw** for expected failures — all DB failures → typed `FriendshipResult`. (`areAllMutualFriends` returns a bare `boolean`, not wrapped; a real DB fault may reject.)
- **Library-only:** NO HTTP endpoint, NO `server.mjs` wiring, NO `api-endpoints.md` row (§21 / D-11804 N/A — no endpoint added). NO `'friends'` profile-visibility value.
- Human-style code per `00.6`: `for...of` + explicit `if/else` (no branching `.reduce()`); full-sentence error messages; JSDoc per function.

## Required `// why:` Comments
- On the normalized-pair unique index (symmetry stored once per unordered pair).
- On the `declined → pending` UPDATE (re-request is not a second row).
- On the clique count-vs-`C(n,2)` algorithm + the `n ≤ 1` vacuous case + input de-duplication.
- On `unknown_account` not revealing which account failed (no enumeration).
- On any `now()` timestamp write (`responded_at`, re-request `requested_at`).

## Files to Produce
- `data/migrations/028_create_friendships.sql` — new.
- `apps/server/src/friendships/friendships.types.ts` — new (contract).
- `apps/server/src/friendships/friendships.logic.ts` — new.
- `apps/server/src/friendships/friendships.logic.test.ts` — new.
- Governance: `docs/ai/DECISIONS.md` (D-24142 → Active), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md` (WP-350 `[x]`), `docs/ai/execution-checklists/EC_INDEX.md` (EC-380 Done), `docs/05-ROADMAP-MINDMAP.md`, `wiki/profile-login.md` (packet-#1 → WP-350 link).

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter @legendary-arena/server test` green — new `friendships.logic` suite present; DB-less env skips DB-backed cases (parity with existing profile suites); baseline otherwise unchanged.
- [ ] DB-backed `psql` smoke of the state machine + clique helper against a real Postgres (documented in the session), since D-24026 live-verify is N/A (library-only).
- [ ] `Select-String apps\server\src\friendships\*.ts -Pattern "boardgame.io|@legendary-arena/game-engine|@legendary-arena/registry|@legendary-arena/lagn"` → no output.
- [ ] Migration grep: `friendships_pair_unique`, `status IN ('pending','accepted','declined')`, `ON DELETE CASCADE` present.
- [ ] `git diff --name-only` = the allowlist (4 code/test + governance).
- [ ] STATUS / DECISIONS (D-24142 Active) / WORK_INDEX (WP-350 `[x]`) / EC_INDEX (EC-380 Done) / mindmap node / wiki packet-#1 link.
- [ ] `User-Visible Surface = none (library-only)` → D-24026 live-verify **N/A** (deferred to packets #2/#3); proof is the suite + the `psql` smoke.

## Common Failure Smells
- Storing both `A→B` and `B→A` — the normalized-pair index must reject the second insert in either direction.
- `removeFriend` flipping a status instead of DELETE (breaks the re-friend lifecycle test).
- A `declined` re-request inserting a second row instead of UPDATE.
- Clique helper counting `pending` edges, or not de-duplicating repeated `AccountId`s, or wrong `n≤1` handling.
- Leaking `player_id` / `friendship_id` / `display_name` onto `FriendshipView`.
- Adding a `'blocked'` status value (blocking is orthogonal — separate model later).
- A stray cross-layer import (grep gate catches it).
