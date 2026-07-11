# WP-350 — Friendships Data Model + Status Machine + Mutual-Clique Helper (Server)

**Status:** Draft 2026-07-10 · **Standard two-session lane** (D-24028 — NOT lightweight: new `.types.ts` contract + new table + a new server code category [the social graph]). Pairs with **EC-380** (authored at execution-prep, not at draft, per the SPEC-draft convention). Reserves **D-24142** (lands at execution).
**Primary Layer:** Server + Persistence (`apps/server`, `data/migrations`)
**User-Visible Surface:** none in this packet — **library-only** infrastructure. The first packet of the Friends & Ranked Trust subsystem charter ([`wiki/profile-login.md` §Friends & Ranked Trust Layer](../../../wiki/profile-login.md)). The friend-request API that exposes these functions over HTTP is the deferred **packet #2**; the profile Friends-tab UI is packet #3; the ranked-eligibility gate that consumes the clique helper is packet #5. Payoff surface: `play.legendary-arena.com` once those land.
**Dependencies:** WP-052 (`legendary.players` + `ext_id`/`AccountId` + the `Result<T>`/closed-error-code/canonical-`readonly`-array drift-test pattern) ✅; WP-101 (`handle_canonical` — the discovery anchor, resolved by the caller in packet #2, not here) ✅; WP-104 (the `legendary.player_*` profile-family FK convention: `player_id bigint` FK + inline `ext_id → player_id` resolution, migration 009) ✅. **No dependency on any unmerged WP.**
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution). At HEAD the engine has `legendary.players` (`player_id bigint` PK, `ext_id text` = AccountId, `handle_canonical`), the profile-family tables (`player_profiles`/`player_links` migration 009, `player_loadouts` migration 022) — but **no peer-to-peer social graph**. Highest migration on disk is `027`; next free is `028`.

---

## Goal

Ship the server-side **friendship graph** as a pure data + logic layer: a new `legendary.friendships` table, a typed logic module implementing the symmetric friend-request **state machine** (send → pending → accepted | declined, plus remove), and the **mutual-clique query helper** that answers "do these accounts all pairwise friend each other?" — the primitive the ranked-eligibility gate (packet #5) will call. Every function is keyed on `AccountId` (`ext_id`) and returns a typed `FriendshipResult<T>`; nothing in this packet exposes an HTTP endpoint or touches the client. This is the **data-model half** of the Friends & Ranked Trust subsystem (charter FR-1…FR-9); the API (packet #2) and UI (packet #3) consume this contract.

---

## User-Visible Impact

None in this packet (no UI, no endpoint). After packets #2 and #3 land, a signed-in player will search a friend by `@handle`, send a request, see incoming/outgoing requests on `?route=me`, accept/decline, and unfriend — all calling the functions this packet ships. After packet #5 lands, a multiplayer run becomes leaderboard-eligible only when its human seats form a friendship clique — computed by the helper this packet ships.

---

## Assumes

- **`legendary.players` exposes `player_id bigint` PK + `ext_id text` (AccountId).** The profile-family tables FK an internal `player_id` to `legendary.players(player_id)` and resolve `ext_id → player_id` inline (`SELECT player_id FROM legendary.players WHERE ext_id = $1 LIMIT 1`). `legendary.friendships` uses this exact convention. (Verified: `data/migrations/004`, `009`; `apps/server/src/profile/ownerProfile.logic.ts:208`.)
- **The `Result<T>` + closed-error-union + canonical-`readonly`-array + drift-test pattern is fixed.** WP-052's `identity.types.ts` and WP-104's `OwnerProfileErrorCode` establish it; `FriendshipResult<T>` / `FriendshipErrorCode` mirror it exactly. (Verified: `apps/server/src/identity/identity.types.ts`.)
- **Handle→AccountId resolution already exists and is the caller's job.** `handle_canonical` (WP-101) maps a `@handle` to an account; packet #2's route resolves the target handle to an `AccountId` before calling `sendFriendRequest`. This packet's functions take `AccountId`s, never handles — keeping the data layer free of handle-search concerns. (Verified: `apps/server/src/identity/handle.*`.)
- **Migration numbering:** the next free migration is `028` (highest on disk is `027`). (Verified: `data/migrations/`.)
- **The `'friends'` visibility value is intentionally not yet in the profile privacy enum.** Migration 009's `avatar_visibility`/`about_me_visibility`/`links_visibility` closed set is `('private','public')` with a `// why:` stating `'friends'` is excluded "until a friend-graph WP lands." This packet is that WP; adding a `'friends'` visibility value remains a **future** packet's job (out of scope here — no consumer yet). (Verified: `data/migrations/009_create_player_profiles_and_links.sql:60`.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- [`wiki/profile-login.md` §Friends & Ranked Trust Layer (Proposed)](../../../wiki/profile-login.md) — the subsystem charter. **FR-1…FR-9** are this packet's design invariants; the "Proposed WP breakdown" packet #1 is this WP. The charter's illustrative schema keys on `ext_id text`; **this WP refines that to the profile-family `player_id bigint` FK convention** (migrations 009/022) for consistency, exposing an `AccountId`-keyed logic API on top — the illustrative sketch was explicitly "not locked."
- `docs/01-VISION.md §23/§24/§25` — the co-op competition model. The clique helper is a pure predicate; it does **not** import a PvP ladder. §25(a) forbids cumulative-count ranking inputs — friendship stays a **binary** relation (FR-9 / charter non-goal: no reputation/karma).
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — `apps/server` may import `pg` + Node built-ins. This packet adds **no new cross-layer import** (no `boardgame.io`, engine, registry, or lagn).
- `apps/server/src/profile/ownerProfile.logic.ts` — the `ext_id → player_id` resolution, the `try/catch → typed Result`, and the `BEGIN/COMMIT` transaction pattern to mirror.
- `data/migrations/009_create_player_profiles_and_links.sql` — the FK / `ON DELETE CASCADE` / `IF NOT EXISTS` idempotency pattern for the new table.
- `apps/server/src/identity/identity.types.ts` — the `Result<T>` + `AUTH_PROVIDERS`-style canonical-array drift-test precedent.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, Node v22+; `node:` prefix on built-ins; test files `.test.ts`.
- Human-style code per `00.6`; full-sentence error messages; `// why:` on non-obvious choices; JSDoc per function; no branching `.reduce()`; `for...of` + explicit `if/else`.
- No new cross-layer import. `friendships.{types,logic}.ts` import only `pg` types + Node built-ins (and re-import `AccountId`/`Result` from `identity.types.ts` — same layer). **No `boardgame.io`, no engine, no registry.**

**Packet-specific (charter invariants):**
- **Identity anchor (FR-2 / FR-3).** Every function is keyed on `AccountId` (`ext_id`); the table stores `player_id`; `display_name` never participates. A friendship survives renames because it is identified only by the two accounts.
- **Symmetry (FR-4).** An accepted friendship is symmetric. Stored **once per unordered pair** — a normalized `UNIQUE (LEAST(requester_id,addressee_id), GREATEST(requester_id,addressee_id))` index forbids both `A→B` and `B→A` rows. `requester_id`/`addressee_id` record only *who initiated* (for pending-request display). "Is A a friend of B?" checks the single row regardless of direction. No one-way / follower semantics.
- **Clique helper is a pure predicate (FR-6).** `areAllMutualFriends(pool, accountIds)` is a pure function of the accepted-friendship relation over the given account set — no judgement, no side effects. It reports **only** whether a friendship clique exists — never leaderboard eligibility, anti-cheat status, matchmaking, or moderation outcomes; those policies stay owned by their consuming subsystems (the ranked gate is packet #5). Locked algorithm below.
- **Closed state set.** `status ∈ ('pending','accepted','declined')` — a DB `CHECK` + a TypeScript closed union + a canonical `readonly` array + a drift test. Adding a state requires a new WP + DECISIONS entry.
- **Blocking boundary.** Friendship and blocking are **independent** concepts. `legendary.friendships` is not the source of truth for blocking and MUST NOT gain a `'blocked'` status value; any future block system uses a **separate** persistence model. (Forecloses the "just add another enum value" drift.)
- **No self, duplicate, or reverse-duplicate rows.** `CHECK (requester_id <> addressee_id)` + the normalized-pair unique index; the logic layer maps a would-be duplicate to a typed error, never a second row.
- **Re-request after decline is an UPDATE, not a second row.** `sendFriendRequest` on an existing `declined` pair transitions it `declined → pending` (UPDATE); a `pending` or `accepted` pair is rejected with a typed code.
- **Zone/engine boundary untouched.** `G`, the engine, gameplay, replay, RNG, and hashes are not involved — this is profile-adjacent persistence. No determinism surface.
- Every closed error-code union has a canonical `readonly` array + a drift test (mirrors `AUTH_PROVIDERS` / `OWNER_PROFILE_ERROR_CODES`).

**Session protocol:**
- If the exact `ext_id → player_id` SQL or the `Result<T>` shape is unclear, stop and read `ownerProfile.logic.ts` / `identity.types.ts` — do not invent the resolution or the result contract.

---

## Friendship Invariants

The graph inherits the charter's canonical invariants ([`wiki/profile-login.md` §Friends & Ranked Trust Layer](../../../wiki/profile-login.md), `FR-#`). This packet is bound by — and packets #2–#6 inherit verbatim — the following. **Numbering matches the charter; do not renumber.**

- **FR-2 (identity anchor).** Every relationship, request, and lookup is keyed on `AccountId`; `display_name` and `handle_canonical` are **never** friendship keys.
- **FR-3 (durability).** A friendship survives display-name, avatar, profile, handle-display, and team-affiliation changes — it is identified solely by the two `AccountId`s.
- **FR-4 (symmetry).** An accepted friendship is symmetric, and a pair has **at most one** stored relationship row.
- **FR-6 (objectively computable).** The clique helper is a **pure predicate** over the accepted-friendship relation.
- **FR-8 (trust signal, not security guarantee).** The graph raises the cost of collusion; it does not eliminate it.
- **Binary relation (charter permanent non-goal).** Friendship carries **no** score, reputation, endorsement, follower, or trust-ranking concept.

## Scope (In)

### A) Migration `028_create_friendships.sql`
`legendary.friendships`:
- `friendship_id  bigserial   PRIMARY KEY`
- `requester_id   bigint      NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE`
- `addressee_id   bigint      NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE`
- `status         text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined'))`
- `requested_at   timestamptz NOT NULL DEFAULT now()`
- `responded_at   timestamptz` (nullable; set on accept/decline)
- `CHECK (requester_id <> addressee_id)`
- **Normalized-pair unique index:** `CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_unique ON legendary.friendships (LEAST(requester_id,addressee_id), GREATEST(requester_id,addressee_id))` — one row per unordered pair regardless of direction.
- **Lookup index:** `CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status ON legendary.friendships (addressee_id, status)` — the "incoming pending requests" read path.
- Idempotent (`IF NOT EXISTS` on table + indexes), mirroring migrations 004/008/009.

### B) `friendships.types.ts` (new contract)
- `FriendshipStatus = 'pending' | 'accepted' | 'declined'` + canonical `FRIENDSHIP_STATUSES` `readonly` array.
- `FriendshipView` — the wire shape: `{ otherAccountId: AccountId; status: FriendshipStatus; direction: 'incoming' | 'outgoing'; requestedAt: string; respondedAt: string | null }` (from a given viewer's perspective; **no** `player_id`, **no** `friendship_id`, **no** `display_name`).
- Closed `FriendshipErrorCode` union + `FRIENDSHIP_ERROR_CODES` `readonly` array (see Contract).
- `FriendshipResult<T>` — mirrors WP-052 `Result<T>` (`{ok:true,value} | {ok:false,reason,code}`), keyed on `FriendshipErrorCode`.
- Re-import `AccountId` + `DatabaseClient` from `../identity/identity.types.js` (no parallel declaration).

### C) `friendships.logic.ts` (pure-ish DB logic — the state machine + clique helper)
All take the `pg` pool + `AccountId`s; each resolves `ext_id → player_id` inline and wraps DB work in `try/catch → typed FriendshipResult`:
- `sendFriendRequest(pool, fromAccountId, toAccountId)` — guards self / unknown-account / existing-pending / already-friends; INSERTs `pending`, or transitions an existing `declined` pair `→ pending` (UPDATE, `requested_at = now()`, `responded_at = null`, `requester_id` = the new sender).
- `acceptFriendRequest(pool, addresseeAccountId, requesterAccountId)` — only the original addressee of a `pending` row may accept; `→ accepted`, `responded_at = now()`.
- `declineFriendRequest(pool, addresseeAccountId, requesterAccountId)` — addressee declines a `pending` row; `→ declined`, `responded_at = now()`.
- `removeFriend(pool, accountId, otherAccountId)` — either party removes an `accepted` friendship; **DELETEs** the row (symmetric; re-friending later is a fresh request).
- `listFriends(pool, accountId)` — `accepted` rows for the account → `FriendshipView[]`.
- `listIncomingRequests(pool, accountId)` / `listOutgoingRequests(pool, accountId)` — `pending` rows where the account is addressee / requester.
- `getFriendshipStatus(pool, accountIdA, accountIdB)` — `FriendshipStatus | 'none'` for the pair.
- `areAllMutualFriends(pool, accountIds)` — **the clique helper.** Locked algorithm in Contract.

### D) Tests
- `friendships.logic.test.ts` (`node:test`, DB-backed with the existing profile-suite skip-when-no-DB harness): send happy path; self-request → `self_friendship`; unknown account → `unknown_account`; duplicate pending (either direction) → `already_pending`; send when already accepted → `already_friends`; `declined → pending` re-request via `sendFriendRequest`; accept by non-addressee → `not_addressee`; accept/decline with no pending → `no_pending_request`; `removeFriend` deletes and is symmetric; `removeFriend` on a non-accepted pair → `not_friends`; list incoming/outgoing/friends correctness + `direction` field; **clique helper**: `n≤1` → `true` (vacuous), a full triangle → `true`, a missing edge → `false`, a `pending` (non-accepted) edge does **not** count → `false`, order-independence (same result regardless of `accountIds` order or which party sent each request); the **full lifecycle** `accept → removeFriend → re-request → accept again` (proves `removeFriend` DELETEs cleanly and a removed pair can re-friend — guards against a future regression that replaces DELETE with a status field); the `FriendshipStatus` + `FriendshipErrorCode` drift tests.

---

## Out of Scope

- **No HTTP endpoints, no `server.mjs` wiring, no `api-endpoints.md` rows** — this packet is **library-only**. The `/api/me/friends*` routes are **packet #2**; `00.3 §21` / D-11804 therefore do **not** apply here (no server endpoint added).
- **No client / UI** — the Friends tab, add-by-`@handle` search, and pending lists are **packet #3**.
- **No handle-search resolution** — packet #2 resolves `@handle → AccountId`; this packet's functions take `AccountId`s.
- **No ranked-eligibility wiring** — the clique helper ships here; the gate that calls it at match start is **packet #5** (integrates with `player_count` / migration 027). No `competitive_scores` / leaderboard touch.
- **No block list, rate limits, or re-request cooldown** — the privacy/abuse controls (charter §Privacy & abuse) are **packet #3/#6**. `status` deliberately omits `'blocked'` (blocking is orthogonal to friendship — a block can exist with no prior request — and gets its own model later). No time-based cooldown logic (keeps this packet free of clock-dependent behavior).
- **No `'friends'` profile-visibility value** — migration 009's privacy enum stays `('private','public')`; adding `'friends'` is a future packet once a consumer exists.
- **No engine / `G` / gameplay / replay / RNG / hash surface.**

---

## Files Expected to Change

- `data/migrations/028_create_friendships.sql` — **new**
- `apps/server/src/friendships/friendships.types.ts` — **new** (contract)
- `apps/server/src/friendships/friendships.logic.ts` — **new**
- `apps/server/src/friendships/friendships.logic.test.ts` — **new**
- Governance: `docs/ai/work-packets/WORK_INDEX.md` (draft row) + `docs/ai/DECISIONS.md` (**D-24142**, lands at execution) + `docs/ai/STATUS.md` + `wiki/profile-login.md` (packet-#1 → WP-350 link). `EC_INDEX.md` row + the EC-380 file are authored at **execution-prep**, per the SPEC-draft convention.

**4 code/test files, single layer (server), no wiring, no new import. Standard two-session lane** (new `.types.ts` contract + new table + new code category — D-24028 forbids the lightweight lane for a new contract file). No other files may be modified.

---

## Contract

### Functions (all return `FriendshipResult<T>` unless noted)
| Function | Returns |
|---|---|
| `sendFriendRequest(pool, fromAccountId, toAccountId)` | `FriendshipView` (the new/updated pending row) |
| `acceptFriendRequest(pool, addresseeAccountId, requesterAccountId)` | `FriendshipView` (accepted) |
| `declineFriendRequest(pool, addresseeAccountId, requesterAccountId)` | `FriendshipView` (declined) |
| `removeFriend(pool, accountId, otherAccountId)` | `void` (row deleted) |
| `listFriends(pool, accountId)` | `FriendshipView[]` (accepted) |
| `listIncomingRequests(pool, accountId)` | `FriendshipView[]` (pending, addressee = account) |
| `listOutgoingRequests(pool, accountId)` | `FriendshipView[]` (pending, requester = account) |
| `getFriendshipStatus(pool, a, b)` | `FriendshipStatus \| 'none'` |
| `areAllMutualFriends(pool, accountIds)` | `boolean` (pure predicate; not wrapped) |

### Closed error union
`FriendshipErrorCode = 'unknown_account' | 'self_friendship' | 'already_pending' | 'already_friends' | 'no_pending_request' | 'not_addressee' | 'not_friends'` — canonical `FRIENDSHIP_ERROR_CODES` `readonly` array + drift test.

`unknown_account` is returned when **one or more** supplied `AccountId`s fail to resolve to a `player_id`; it deliberately does **not** reveal *which* account failed (no account-existence enumeration — consistent with the WP-102 `player_not_found` single-code posture).

### Locked Values (do not re-derive at execution)
| Key | Value |
|---|---|
| `status` closed set | `('pending','accepted','declined')` — DB CHECK + union + canonical array (blocking is a separate future model; **not** a status here) |
| Pair uniqueness | one row per **unordered** pair: `UNIQUE (LEAST(requester_id,addressee_id), GREATEST(requester_id,addressee_id))` |
| `sendFriendRequest` on `declined` pair | transition `declined → pending` via **UPDATE** (new `requester_id`, `requested_at = now()`, `responded_at = null`) — never a second row |
| `removeFriend` | **DELETE** the row (symmetric); re-friending is a fresh request, not a status flip |
| Clique — business rule | A set of accounts forms a friendship clique **iff** for every account `A` in the set and every *distinct* account `B` in the set, `accepted_friendship(A,B) = true`. The count-comparison below is the approved **implementation** of this rule, not the rule itself. |
| Clique — implementation | Resolve the (de-duplicated) `n` `AccountId`s to `n` `player_id`s; the set is a clique **iff** the count of `accepted` rows with **both** endpoints in the set equals `n*(n-1)/2`. The normalized-pair unique index guarantees at most one row per pair, so this counts each connected pair exactly once. `n ≤ 1` → `true` (vacuous). |
| Clique — input normalization | Repeated `AccountId`s are removed before evaluation, so `[A,B,C]`, `[A,A,B,C]`, and `[B,C,A,A]` are equivalent and return the same result. |
| `FriendshipView` fields | `otherAccountId`, `status`, `direction ('incoming'|'outgoing')`, `requestedAt`, `respondedAt` — never `player_id`, `friendship_id`, or `display_name` |

---

## Acceptance Criteria

1. Migration `028` creates `legendary.friendships` with the Scope-A columns/constraints — `player_id` FKs `ON DELETE CASCADE`, the `status` CHECK, `CHECK (requester_id <> addressee_id)`, the normalized-pair unique index, and the `(addressee_id, status)` lookup index. **Data-integrity:** the normalized-pair index rejects storing both `A→B` and `B→A` as separate rows — **at most one** friendship row exists per unordered account pair (a second insert in either direction fails at the DB) (**AC-1**).
2. `sendFriendRequest` inserts a `pending` row keyed on the two accounts' `player_id`s; rejects self (`self_friendship`), unknown account (`unknown_account`), an existing pending pair in either direction (`already_pending`), and an accepted pair (`already_friends`); and transitions an existing `declined` pair `→ pending` via UPDATE rather than a second row (**AC-2**).
3. `acceptFriendRequest` / `declineFriendRequest` operate only on a `pending` row and only by its addressee (non-addressee → `not_addressee`; no pending → `no_pending_request`); accept → `accepted`, decline → `declined`, both set `responded_at`. `removeFriend` DELETEs an `accepted` row from either side (symmetric) and returns `not_friends` when no accepted row exists (**AC-3**).
4. `listFriends` / `listIncomingRequests` / `listOutgoingRequests` return the correct rows as `FriendshipView` with the correct `direction`, exposing no `player_id` / `friendship_id` / `display_name`; `getFriendshipStatus` returns the pair's status or `'none'` (**AC-4**).
5. `areAllMutualFriends` returns `true` for `n ≤ 1` and for a full clique, `false` when any pair lacks an `accepted` friendship, ignores non-`accepted` (pending) edges, de-duplicates repeated inputs, and is order-independent (**AC-5**).
6. `FriendshipStatus` and `FriendshipErrorCode` each have a canonical `readonly` array asserted by a forward+backward drift test; no function throws uncaught (all DB failures → typed result); no `boardgame.io`/engine/registry import in the new files (**AC-6**).
7. `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/server test` green (the new suite passes; DB-less env skips DB-backed cases exactly as the existing profile suites do; the baseline failing/skip set is otherwise unchanged) (**AC-7**).

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build   # Expected: exits 0

# Step 2 — server tests (new suite; DB-less skip parity)
pnpm --filter @legendary-arena/server test
# Expected: friendships.logic suite present; failing/skip set == baseline + this new suite

# Step 3 — no new cross-layer import in the friendships module
Select-String -Path "apps\server\src\friendships\*.ts" -Pattern "boardgame.io|@legendary-arena/game-engine|@legendary-arena/registry|@legendary-arena/lagn"
# Expected: no output

# Step 4 — closed sets + clique helper + drift arrays exist
Select-String -Path "apps\server\src\friendships\friendships.types.ts" -Pattern "FRIENDSHIP_STATUSES|FRIENDSHIP_ERROR_CODES|FriendshipResult"
Select-String -Path "apps\server\src\friendships\friendships.logic.ts" -Pattern "areAllMutualFriends|sendFriendRequest"

# Step 5 — migration shape
Select-String -Path "data\migrations\028_create_friendships.sql" -Pattern "friendships_pair_unique|status IN \('pending','accepted','declined'\)|ON DELETE CASCADE"

# Step 6 — scope
git diff --name-only   # Expected: only the ## Files Expected to Change set
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Migration `028` present; `legendary.friendships` shape per Scope A (player_id FKs CASCADE, status CHECK, self-CHECK, normalized-pair unique index, addressee lookup index)
- [ ] `friendships.types.ts` / `.logic.ts` created; the send/accept/decline/remove state machine + list helpers + `getFriendshipStatus` + `areAllMutualFriends` clique helper; `AccountId`-keyed; `ext_id → player_id` resolved inline; typed `FriendshipResult`; canonical arrays + drift tests
- [ ] `declined → pending` re-request is an UPDATE (no second row); `removeFriend` DELETEs (symmetric); clique `n≤1` vacuously true, non-accepted edges ignored, order/duplicate-independent
- [ ] No new cross-layer import; `node:test`; no `boardgame.io`
- [ ] `pnpm -r build` 0; server test green (DB-less skip parity)
- [ ] `DECISIONS.md` **D-24142** landed (Active); `WORK_INDEX` (WP-350) + `STATUS.md` updated; `wiki/profile-login.md` packet-#1 row links WP-350
- [ ] **User-visible verification (D-24026):** N/A for this packet (no UI/endpoint) — the live check is deferred to packets #2/#3. This packet's proof is the test suite + a DB-backed `psql` smoke of the state machine + clique helper against a real Postgres (documented in the execution session), NOT a `play.legendary-arena.com` screenshot.

---

## Vision Alignment

**Vision clauses touched:** **§23/§24/§25** (co-op competition model — the clique helper is a pure predicate the ranked gate will consume; it imports no PvP ladder). §25(a) — friendship is a **binary** relation, never a cumulative-count ranking input.

**Conflict assertion:** No conflict. The packet builds the social/trust primitive the charter (FR-1…FR-9) specifies without touching scoring, PAR, replay, or RNG. The clique helper is read-only and side-effect-free; it decides nothing on its own (the gate that uses it is packet #5, reconciled against §23–25 there).

**Non-Goal proximity check:** Crosses none of NG-1..7. **Not pay-to-win (NG-1)** — a friendship confers no gameplay advantage; it gates *ranked eligibility* (a trust boundary), not power. **PvP terminology (§23(b)):** "friend" / "request" / "clique" carry no match/opponent/win-loss framing; Legendary stays co-op. **No social reputation** (charter permanent non-goal) — friendship is binary, no scores/karma.

**Determinism preservation:** N/A — profile-adjacent persistence; no engine, `G`, replay, RNG, or hash surface. `legendary.friendships` is application data, never game state.

---

## Lint Gate Self-Review (00.3)

- §1 Structure — PASS: all required sections; `## Out of Scope` lists ≥2 (routes/wiring, UI, handle-search, ranked gate, block/rate/cooldown, `'friends'` visibility, engine surface).
- §2 Non-Negotiable Constraints — PASS: identity anchor, symmetry-as-normalized-pair, closed status set, no-new-import, clique-as-pure-predicate; cites `00.6`.
- §3 Assumes — PASS: players/`player_id` shape, `Result<T>` pattern, handle-resolution-is-caller's-job, migration number, `'friends'`-visibility deferral — each with a file source.
- §4 Context — PASS: charter FR-1…FR-9, §23–25, ARCHITECTURE import rule, `ownerProfile.logic.ts` pattern, migration 009, identity types.
- §5 Output Completeness — PASS: 4 code/test files, single layer, no wiring; standard lane (new contract file → correctly NOT lightweight).
- §6 Naming — PASS: `FriendshipView`, `friendships.*`, `areAllMutualFriends`, `FRIENDSHIP_ERROR_CODES`; no abbreviations; boolean helper reads as a predicate.
- §7 Dependency Discipline — PASS: **zero** new dependencies (uses `pg` + Node built-ins already present).
- §8 Architectural Boundaries — PASS (Server): no game logic, no engine/registry/`boardgame.io` import; grep-gated; profile-adjacent persistence only.
- §9 Windows Compatibility — PASS: `pwsh` + `Select-String` + `\` paths.
- §10 Env Var Hygiene — N/A: no new env var (reuses the `pool`).
- §11 Authentication Clarity — N/A (library-only): no endpoint, no session surface in this packet; auth is packet #2's concern. Functions take an already-resolved `AccountId`.
- §12 Test Quality — PASS: `node:test`; state-machine transitions, cross-direction duplicate, clique true/false/vacuous/order-independent, drift tests; DB-less skip parity with existing profile suites.
- §13 Commands & Verification — PASS: exact `pnpm` + `Select-String` with expected output.
- §14 Acceptance Criteria — PASS: 7 binary, observable items naming the real table/functions/codes.
- §15 Definition of Done — PASS: binary checkboxes incl. DECISIONS/index/wiki + commit topology; §15.1 addressed.
- §15.1 User-Visible Verification (D-24026) — PASS (N/A-with-reason): no UI/endpoint; live check deferred to packets #2/#3; proof is the suite + a DB-backed `psql` smoke, stated as such.
- §16 Code Style — PASS: `for...of`/explicit `if/else` (no branching `.reduce()`); typed result unions; `// why:` on the normalized-pair index, the `declined→pending` UPDATE, the clique count-vs-`C(n,2)` algorithm, and the `n≤1` vacuous case; JSDoc per function; named imports.
- §17 Vision Alignment — PASS: `## Vision Alignment` present; §23/§24/§25 + §25(a); NG-1 + §23(b) addressed; determinism N/A.
- §18 Prose-vs-Grep — PASS: verification greps target identifiers (`areAllMutualFriends`, `FRIENDSHIP_ERROR_CODES`), not a count-literal echoed next to its own check.
- §19 Bridge-vs-HEAD — N/A: no repo-state snapshot artifact.
- §20 Funding Surface Gate — N/A: no donate/support/tournament-funding copy or affordance.
- §21 API Catalog Update — **N/A (does not apply):** this packet adds **no** HTTP endpoint and no `apps/server/src/**` `Library-only` catalog function is being *cataloged* yet (the friendships functions become catalog rows when packet #2 wires them). No `api-endpoints.md` edit in this packet.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): READY.** Dependencies verified on source (WP-052 players/`ext_id`/`Result`; WP-101 handle; WP-104 profile-family FK convention). No unmerged hard-dep. Scope locked to 4 files + governance; new contract file (`friendships.types.ts`) + new table → **standard two-session lane, correctly not lightweight** (D-24028 forbids the lane for new contract files). Not a validation-tightening of an existing input path (net-new module), so `01.4 §Empirical Scaffold` does not apply.

**Copilot (01.7): PASS.** Real failure modes pinned: (a) reverse-duplicate rows (`A→B` + `B→A`) → **normalized-pair unique index + `already_pending` guard + test**; (b) an unfriended pair blocking a fresh request → **`removeFriend` DELETEs, not a status flip**; (c) a declined pair blocking re-request → **`declined→pending` UPDATE path + test**; (d) the clique helper miscounting → **locked count == `C(n,2)` algorithm, non-accepted edges excluded, `n≤1` vacuous, order/dup-independent, all tested**; (e) leaking `player_id`/`display_name` on the wire → **`FriendshipView` field allowlist + test**; (f) a stray cross-layer import → **grep gate**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24142**: the `legendary.friendships` data model + the `AccountId`-keyed friendship state machine + the mutual-clique helper, as packet #1 of the Friends & Ranked Trust subsystem. Specifically locks: (1) the profile-family `player_id bigint` FK convention (**refining** the charter's illustrative `ext_id` sketch — migrations 009/022 precedent) with inline `ext_id → player_id` resolution and an `AccountId`-keyed public API; (2) symmetry stored as **one row per unordered pair** via a normalized `LEAST/GREATEST` unique index, with `requester_id`/`addressee_id` recording only initiation direction; (3) the closed `status` set `('pending','accepted','declined')` — **blocking, rate limits, and re-request cooldown are deferred** to a later packet (blocking is orthogonal to friendship and gets its own model; no clock-dependent logic here); (4) `sendFriendRequest` transitions a `declined` pair `→ pending` via UPDATE (never a second row) and `removeFriend` DELETEs (symmetric); (5) the clique algorithm — a set is a clique iff the count of `accepted` rows with both endpoints in the (de-duplicated) set equals `n*(n-1)/2`, with `n≤1` vacuously true; (6) **library-only** scope — no HTTP endpoint, no `'friends'` profile-visibility value (deferred until a consumer exists per migration 009's note). Drafted 2026-07-10; not yet landed.
