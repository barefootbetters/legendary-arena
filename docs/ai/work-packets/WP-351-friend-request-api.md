# WP-351 — Friend-Request API (`/api/me/friends*`) (Server)

**Status:** Draft 2026-07-10 · **BLOCKED on WP-350** (hard dep — WP-350's `friendships.logic.ts` + `friendships.types.ts` must be **Done** before this executes; WP-350 is drafted, not executed at draft time). **Standard two-session lane** (D-24028 — NOT lightweight: new `.routes.ts` contract + new endpoints + api-catalog rows + `server.mjs` wiring). Pairs with **EC-381** (authored at execution-prep). Reserves **D-24143** (lands at execution).
**Primary Layer:** Server (`apps/server`)
**User-Visible Surface:** none directly — the HTTP surface the profile Friends-tab UI (**packet #3**) calls. Payoff surface: `play.legendary-arena.com` once packet #3 lands.
**Dependencies:** **WP-350** (packet #1 — `friendships.logic.ts` state machine + clique helper + `friendships.types.ts`; **must be Done**) ⛔ *drafted, not executed*; WP-104 (the `/api/me/*` authenticated route pattern + `requireAuthenticatedSession` + caller-injected `verifier`/`accountResolver`) ✅; WP-101 (`findAccountByHandle` — the handle→account resolver) ✅; WP-159/WP-112 (the auth session gate) ✅.
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution — **must be after WP-350 merged**).

---

## Goal

Expose WP-350's friendship logic over authenticated HTTP: six `/api/me/friends*` endpoints (send request / list friends / list pending / accept / decline / remove) — all `authenticated-session-required`. The API is the translation layer between the public `@handle` identifier and WP-350's `AccountId`-keyed logic: it resolves the target `@handle` → `AccountId` inbound (`findAccountByHandle`), and enriches the logic layer's `AccountId`-keyed results into a client-facing `FriendSummary` (the friend's `handle` + `displayName`) outbound — **never** leaking a friend's `AccountId` on the wire. This is the **API half** of the Friends & Ranked Trust subsystem (charter FR-1…FR-9); the Friends-tab UI (packet #3) consumes these endpoints, and the Brevo request-notification email is the deferred **packet #4** (this packet fires no email).

---

## User-Visible Impact

None directly (no UI). After packet #3 lands, a signed-in player's Friends tab calls these endpoints to add a friend by `@handle`, see incoming/outgoing pending requests, accept/decline, and unfriend. This packet ships the routes those actions call.

---

## Assumes

- **WP-350 is Done and its contract is on `main`.** `friendships.logic.ts` exports `sendFriendRequest` / `acceptFriendRequest` / `declineFriendRequest` / `removeFriend` / `listFriends` / `listIncomingRequests` / `listOutgoingRequests`, each `AccountId`-keyed and returning a typed `FriendshipResult`; `friendships.types.ts` exports `FriendshipStatus` + `FRIENDSHIP_STATUSES`. **This packet imports them read-only and MUST NOT modify either file** (contract-file lock; B-packets do not edit A-packet contracts). ⛔ *At draft time WP-350 is not yet executed — this packet is BLOCKED until it is.*
- **The `/api/me/*` authenticated pattern is fixed.** `registerOwnerProfileRoutes` / `registerLoadoutLibraryRoutes` register `/api/me/*` routes on the boardgame.io Koa router, call `requireAuthenticatedSession` as the first business step (caller-injected `verifier` + `accountResolver`), resolve an `AccountId` (= `legendary.players.ext_id`), wrap DB calls in `try/catch` → typed 500, and set status + body + `Cache-Control` on every path. `registerFriendshipRoutes` mirrors this exactly. (Verified: `apps/server/src/profile/ownerProfile.routes.ts`, `loadoutLibrary.routes.ts`.)
- **`findAccountByHandle` is the inbound resolver.** `apps/server/src/identity/handle.logic.ts:260` — `SELECT ext_id, … FROM legendary.players WHERE handle_canonical = $1 LIMIT 1`; returns the account (or none). This packet resolves the target `@handle` → `AccountId` with it (canonicalizing the input `trim().toLowerCase()` the same way `claimHandle` does). (Verified: `handle.logic.ts`.)
- **The public identifier is the handle, never the `AccountId`.** `PublicProfileView` (WP-102) deliberately omits `accountId` because it is a server-internal cross-service key. `FriendSummary` follows suit — a friend is identified on the wire by `handle` + `displayName` only. (Verified: `apps/server/src/profile/profile.types.ts:44`.)
- **`display_name` is NOT NULL; `display_handle` may be null pre-claim.** The enrichment reads both from `legendary.players`. (Verified: migration 004 / 008.)

If WP-350 is not Done, or any of the above is false, this packet is **BLOCKED** and must not execute.

---

## Context (Read First)

- [`wiki/profile-login.md` §Friends & Ranked Trust Layer (Proposed)](../../../wiki/profile-login.md) — the subsystem charter. Packet #2 (this WP) is the "Friend-request API" item; **FR-2** (identity anchor) is why `FriendSummary` omits `accountId`.
- `docs/ai/work-packets/WP-350-friendships-data-model.md` — the logic + types this packet wraps. **Do not modify** its `friendships.{types,logic}.ts`.
- `apps/server/src/profile/loadoutLibrary.routes.ts` — the closest route precedent (auth-first, typed-error mapping, `Cache-Control` on every path, caller-injected deps bundle). Mirror it.
- `apps/server/src/profile/ownerProfile.routes.ts` + `apps/server/src/server.mjs` (the `registerOwnerProfileRoutes(...)` / `registerLoadoutLibraryRoutes(...)` wiring block) — where `registerFriendshipRoutes` wires with the same auth deps + `pool`.
- `apps/server/src/identity/handle.logic.ts` — `findAccountByHandle` (inbound resolution) + the canonicalization rule.
- `docs/ai/REFERENCE/api-endpoints.md` + `00.3 §21` / D-11804 — the catalog obligation for the 6 new endpoints (same-commit at execution); `Auth` closed set + `Status` closed set (D-9905).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, Node v22+; `node:` prefix on built-ins; test files `.test.ts`.
- Human-style code per `00.6`; full-sentence error messages; `// why:` on non-obvious choices; JSDoc per function; no branching `.reduce()`.
- No new cross-layer import. The routes import only WP-350's `friendships.{logic,types}.ts` + `handle.logic.ts` + the identity types (all same layer) + `pg`. **No `boardgame.io`, no engine, no registry.**

**Packet-specific:**
- **Identity anchor on the wire (FR-2).** `FriendSummary` exposes the friend's `handle` + `displayName` only — **never** their `accountId` / `ext_id` / `player_id`. The acting account is resolved from the session, never from the request body.
- **Contract-file lock.** WP-350's `friendships.types.ts` / `friendships.logic.ts` are **byte-identical** pre/post this packet. New wire types + the route error union live in `friendships.routes.ts`.
- **Handle-addressable actions (locked policy).** Because every friend action routes by `@handle`, the **acting account must have a claimed handle**; a friend action from a handle-less account returns `handle_required` (so both parties are always addressable and `FriendSummary.handle` is always non-null). The **target** handle must resolve or the route returns `handle_not_found` (404).
- **Auth-first.** Every route calls `requireAuthenticatedSession` before any business logic; a guest/invalid session → `unauthorized` (401). No route trusts a body-supplied identity.
- **Typed errors, never throw.** The logic layer's `FriendshipResult` codes map to HTTP status via a locked table; the route error body is `{ error: FriendApiErrorCode }`; every path sets `Cache-Control`. No uncaught throw (typed 500).
- **No email, no UI, no ranked/gameplay touch.** The Brevo request-notification is **packet #4**; the Friends tab is **packet #3**; the ranked gate is **packet #5**. This packet fires none of them and touches no `competitive_scores` / engine / `G`.
- The route error-code union has a canonical `readonly` array + a drift test (mirrors `LOADOUT_LIBRARY_ERROR_CODES`).

**Session protocol:**
- If the exact `requireAuthenticatedSession` deps shape or the `FriendshipResult` codes are unclear, stop and read `loadoutLibrary.routes.ts` / WP-350's `friendships.types.ts` — do not invent the auth wiring or the code set.

---

## Scope (In)

### A) `friendships.routes.ts` (new) — `registerFriendshipRoutes(router, pool, deps)`
Registers six `authenticated-session-required` routes, each auth-first, typed-error-mapped, `Cache-Control: no-store`:
- `POST   /api/me/friends/requests` — body `{ handle }`; requires the acting account to have a claimed handle (`handle_required` else); resolves target `@handle` → `AccountId` (`handle_not_found` else); `sendFriendRequest`; **201** `{ FriendSummary }`.
- `GET    /api/me/friends` — `listFriends` enriched; **200** `{ friends: FriendSummary[] }`.
- `GET    /api/me/friends/requests` — incoming + outgoing pending, enriched; **200** `{ incoming: FriendSummary[], outgoing: FriendSummary[] }`.
- `POST   /api/me/friends/requests/:handle/accept` — resolve requester `:handle` → `AccountId`; `acceptFriendRequest`; **200** `{ FriendSummary }`.
- `POST   /api/me/friends/requests/:handle/decline` — `declineFriendRequest`; **200** `{ FriendSummary }`.
- `DELETE /api/me/friends/:handle` — resolve friend `:handle` → `AccountId`; `removeFriend`; **204**.

### B) Wire types + route error union (in `friendships.routes.ts`)
- `FriendSummary { handle: string; displayName: string; status: FriendshipStatus; direction: 'incoming' | 'outgoing'; requestedAt: string; respondedAt: string | null }` — imports `FriendshipStatus` from WP-350 (no redefinition). **No `accountId`.**
- `FriendApiErrorCode` closed union = the WP-350 `FriendshipErrorCode` values that can surface (`self_friendship` / `already_pending` / `already_friends` / `no_pending_request` / `not_addressee` / `not_friends` / `unknown_account`) **plus** the HTTP-layer codes `'unauthorized' | 'invalid_request' | 'handle_required' | 'handle_not_found'`; canonical `FRIEND_API_ERROR_CODES` `readonly` array + drift test.

### C) Enrichment resolver (in `friendships.routes.ts`)
- A helper mapping a set of `AccountId`s → `{ handle, displayName }` via `SELECT ext_id, display_handle, display_name FROM legendary.players WHERE ext_id = ANY($1)` (one round-trip per list route, not N). Composes each WP-350 `FriendshipView` (`otherAccountId` + `status` + `direction` + timestamps) into a `FriendSummary` by swapping `otherAccountId` for the resolved `handle`/`displayName`.

### D) Wiring — `server.mjs`
- One `registerFriendshipRoutes(server.router, pool, { requireAuthenticatedSession, verifier, accountResolver })` call in the existing profile-routes wiring block (01.5 runtime-wiring — same-layer, authorized).

### E) `api-endpoints.md` (D-11804, at execution)
- Add the **6** rows, each `Auth = authenticated-session-required`, `Status = Wired`; request/response field names match `FriendSummary` exactly.

### F) Tests — `friendships.routes.test.ts` (`node:test`, DB-backed with the profile-suite skip-when-no-DB harness)
- Auth: no session → `unauthorized` (401) on every route.
- Send: happy path 201 + `FriendSummary` (no `accountId` field on the body — asserted); handle-less actor → `handle_required`; unknown target handle → `handle_not_found` (404); malformed/missing `{handle}` body → `invalid_request`; duplicate → `already_pending`; already friends → `already_friends`; self (own handle) → `self_friendship`.
- Accept/decline: by addressee 200; by non-addressee → `not_addressee`; no pending → `no_pending_request`.
- Remove: 204; not-friends → `not_friends`.
- List friends / list requests: correct `direction`, correct enrichment (handle + displayName present, `accountId` absent), empty-state shapes.
- The `FRIEND_API_ERROR_CODES` drift test; the HTTP-status mapping table (each code → its locked status).

---

## Out of Scope

- **No change to WP-350's contract** — `friendships.{types,logic}.ts` and `legendary.friendships` (migration 028) are byte-identical; **no new migration** in this packet.
- **No email** — the Brevo request/accept notification is **packet #4**. This packet fires no email and adds no Brevo call.
- **No client / UI** — the Friends tab is **packet #3**.
- **No block list / rate limits / cooldown** — abuse controls are **packet #6**.
- **No ranked-eligibility wiring** — the clique helper's HTTP exposure (if any) and the match-start gate are **packet #5**. No `competitive_scores` / leaderboard / engine / `G` touch.
- **No handle-claim surface** — this packet *reads* handles (`findAccountByHandle`); claiming a handle stays WP-101's `claimHandle`.

---

## Files Expected to Change

- `apps/server/src/friendships/friendships.routes.ts` — **new** (routes + wire types + enrichment)
- `apps/server/src/friendships/friendships.routes.test.ts` — **new**
- `apps/server/src/server.mjs` — **modified** (one `registerFriendshipRoutes(...)` wiring call — 01.5)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (6 new rows, D-11804, at execution)
- Governance: `WORK_INDEX.md` (blocked row) + `DECISIONS.md` (**D-24143**, lands at execution) + `STATUS.md` + `wiki/profile-login.md` (packet-#2 → WP-351 link). `EC_INDEX.md` row + the EC-381 file are authored at **execution-prep**, per the SPEC-draft convention.

**2 code/test files + 1 wiring + catalog. Standard two-session lane** (new `.routes.ts` contract + new endpoints + catalog). No other files may be modified — **and WP-350's contract files may not be touched.**

---

## Contract

### Endpoints (all `authenticated-session-required`, JSON)
| Method + path | Body | Success |
|---|---|---|
| `POST /api/me/friends/requests` | `{ handle }` | `201 { FriendSummary }` |
| `GET /api/me/friends` | — | `200 { friends: FriendSummary[] }` |
| `GET /api/me/friends/requests` | — | `200 { incoming: FriendSummary[], outgoing: FriendSummary[] }` |
| `POST /api/me/friends/requests/:handle/accept` | — | `200 { FriendSummary }` |
| `POST /api/me/friends/requests/:handle/decline` | — | `200 { FriendSummary }` |
| `DELETE /api/me/friends/:handle` | — | `204` |

### Closed error union
`FriendApiErrorCode = 'self_friendship' | 'already_pending' | 'already_friends' | 'no_pending_request' | 'not_addressee' | 'not_friends' | 'unknown_account' | 'unauthorized' | 'invalid_request' | 'handle_required' | 'handle_not_found'` — canonical `FRIEND_API_ERROR_CODES` `readonly` array + drift test.

### Locked Values (do not re-derive at execution)
| Key | Value |
|---|---|
| `FriendSummary` fields | `handle`, `displayName`, `status`, `direction`, `requestedAt`, `respondedAt` — **never** `accountId`/`ext_id`/`player_id` (FR-2) |
| Handle canonicalization | inbound `@handle` is `trim().toLowerCase()`-canonicalized before `findAccountByHandle`, matching `claimHandle` |
| Acting-account handle requirement | a friend action from an account with `handle_canonical IS NULL` → `handle_required` (409). Keeps both parties addressable-by-handle |
| Target resolution | a `:handle` / body `handle` that does not resolve → `handle_not_found` (404) |
| HTTP status mapping | `unauthorized`→401 · `invalid_request`→400 · `handle_required`→409 · `handle_not_found`→404 · `self_friendship`/`already_pending`/`already_friends`/`no_pending_request`/`not_addressee`/`not_friends`/`unknown_account`→409 (conflict) except `not_addressee`→403 and `no_pending_request`/`not_friends`→404 · unexpected→500 |
| Cache | `Cache-Control: no-store` on every friend route (authenticated, mutable) |
| Enrichment | one `WHERE ext_id = ANY($1)` round-trip per list route (not N per row) |

### Auth
All six routes `∈ { authenticated-session-required }` per D-9905. `Status = Wired` (catalog).

---

## Acceptance Criteria

1. `registerFriendshipRoutes` registers the six routes on the boardgame.io router, each calling `requireAuthenticatedSession` first (guest → `unauthorized` 401) and setting `Cache-Control: no-store` (**AC-1**).
2. `POST /api/me/friends/requests` resolves the body `@handle` → `AccountId` (unresolved → `handle_not_found` 404), rejects a handle-less actor (`handle_required` 409) and a malformed body (`invalid_request` 400), calls `sendFriendRequest`, and returns `201 { FriendSummary }` on success (**AC-2**).
3. `accept` / `decline` / `DELETE` resolve the `:handle` → `AccountId` and call the matching WP-350 function; non-addressee → `not_addressee` (403), no pending → `no_pending_request` (404), not-friends → `not_friends` (404); `DELETE` returns `204` (**AC-3**).
4. `GET /api/me/friends` and `GET /api/me/friends/requests` return `FriendSummary` objects carrying the friend's `handle` + `displayName` and the correct `direction`, with **no** `accountId`/`ext_id`/`player_id` field on any wire object (asserted) (**AC-4**).
5. Every non-2xx path returns `{ error: FriendApiErrorCode }` per the locked status-mapping table; the union has a canonical `readonly` array asserted by a drift test; no route throws uncaught (typed 500) (**AC-5**).
6. WP-350's `friendships.types.ts` / `friendships.logic.ts` are byte-identical pre/post (`git diff` empty for both); no `boardgame.io`/engine/registry import in the new files; `server.mjs` wires exactly one `registerFriendshipRoutes` (**AC-6**).
7. `api-endpoints.md` has the 6 new rows (closed `Status`/`Auth` sets, field names matching `FriendSummary`) added in the same commit as the routes (D-11804); `00.3 §21` passes (**AC-7**).
8. `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/server test` green (new suite passes; DB-less env skips DB-backed cases as the existing profile suites do; baseline failing/skip set otherwise unchanged) (**AC-8**).

---

## Verification Steps

```pwsh
# Step 1 — build (requires WP-350 merged first)
pnpm -r build   # Expected: exits 0

# Step 2 — server tests (new routes suite; DB-less skip parity)
pnpm --filter @legendary-arena/server test
# Expected: friendships.routes suite present; failing/skip set == baseline + this new suite

# Step 3 — WP-350 contract untouched
git diff --name-only origin/main -- apps/server/src/friendships/friendships.types.ts apps/server/src/friendships/friendships.logic.ts
# Expected: no output (byte-identical)

# Step 4 — no accountId on the wire + no new cross-layer import
Select-String -Path "apps\server\src\friendships\friendships.routes.ts" -Pattern "boardgame.io|@legendary-arena/game-engine|@legendary-arena/registry"
# Expected: no output
Select-String -Path "apps\server\src\friendships\friendships.routes.ts" -Pattern "FriendSummary|FRIEND_API_ERROR_CODES|findAccountByHandle"
# Expected: present

# Step 5 — the 6 catalog rows landed
Select-String -Path "docs\ai\REFERENCE\api-endpoints.md" -Pattern "/api/me/friends"

# Step 6 — scope
git diff --name-only   # Expected: only the ## Files Expected to Change set
```

---

## Definition of Done

- [ ] **WP-350 is Done on `main`** (hard dep) — verified before execution opens
- [ ] All acceptance criteria pass
- [ ] `friendships.routes.ts` created; six auth-first routes; inbound `findAccountByHandle` resolution + `handle_required`/`handle_not_found` guards; `FriendSummary` enrichment with **no** `accountId`; locked HTTP status mapping; `Cache-Control: no-store`
- [ ] WP-350's `friendships.{types,logic}.ts` byte-identical (`git diff` empty)
- [ ] `server.mjs` wires exactly one `registerFriendshipRoutes` (01.5); no new cross-layer import; `node:test`; no `boardgame.io`
- [ ] Tests cover auth-gate, send (+ handle_required/handle_not_found/invalid_request/duplicate/self), accept/decline (+ not_addressee/no_pending_request), remove (+ not_friends), list enrichment (handle+displayName present, accountId absent), status-mapping + drift
- [ ] `api-endpoints.md` 6 rows added same-commit (D-11804); closed `Status`/`Auth` sets
- [ ] `pnpm -r build` 0; server test green (DB-less skip parity)
- [ ] `DECISIONS.md` **D-24143** landed (Active); `WORK_INDEX` (WP-351) + `STATUS.md` updated; `wiki/profile-login.md` packet-#2 row links WP-351
- [ ] **User-visible verification (D-24026):** N/A for this packet (no UI) — the live check is deferred to **packet #3**. This packet's proof is the test suite + a DB-backed `curl` smoke of the 6 endpoints against a real Postgres (documented in the execution session), NOT a `play.legendary-arena.com` screenshot.

---

## Vision Alignment

**Vision clauses touched:** none of the scoring/PAR/replay clauses. The API surfaces a social primitive; the ranked gate (packet #5) is where §23/§24/§25 reconciliation happens.

**Conflict assertion:** No conflict. Authenticated CRUD over the friendship graph; no scoring, PAR, replay, RNG, or leaderboard touch. `FriendSummary` exposes only the public handle + display name (never the internal `AccountId`), consistent with `PublicProfileView`.

**Non-Goal proximity check:** Crosses none of NG-1..7. **Not pay-to-win (NG-1)** — friend management confers no gameplay advantage. **PvP terminology (§23(b)):** "friend" / "request" carry no match/opponent/win-loss framing; Legendary stays co-op. **No social reputation** (charter permanent non-goal) — the API exposes binary friendship state only.

**Determinism preservation:** N/A — server wiring over profile-adjacent persistence; no engine, `G`, replay, RNG, or hash surface.

---

## Lint Gate Self-Review (00.3)

- §1 Structure — PASS: all required sections; `## Out of Scope` lists ≥2 (WP-350 contract, email, UI, abuse controls, ranked gate, handle-claim).
- §2 Non-Negotiable Constraints — PASS: wire identity anchor, contract-file lock, handle-addressable policy, auth-first, typed errors, no email/UI/gameplay; cites `00.6`.
- §3 Assumes — PASS: WP-350 contract (blocked note), `/api/me/*` pattern, `findAccountByHandle`, handle-is-public-id, `display_name` NOT NULL — each with a source.
- §4 Context — PASS: charter, WP-350, `loadoutLibrary.routes.ts` precedent, `server.mjs` wiring, `handle.logic.ts`, D-11804/§21.
- §5 Output Completeness — PASS: 2 code/test + 1 wiring + catalog + governance; standard lane (new contract file → correctly NOT lightweight).
- §6 Naming — PASS: `FriendSummary`, `registerFriendshipRoutes`, `FRIEND_API_ERROR_CODES`; no abbreviations; canonical field names preserved.
- §7 Dependency Discipline — PASS: **zero** new dependencies (reuses `pg` + WP-350 modules + `handle.logic.ts`).
- §8 Architectural Boundaries — PASS (Server): no game logic, no engine/registry/`boardgame.io` import; grep-gated; imports WP-350 (same layer) read-only.
- §9 Windows Compatibility — PASS: `pwsh` + `Select-String` + `\` paths.
- §10 Env Var Hygiene — N/A: no new env var (reuses `pool` + auth deps).
- §11 Authentication Clarity — PASS: all six routes `authenticated-session-required` (reuse `requireAuthenticatedSession`); acting identity is session-resolved, never body-supplied; guest → `unauthorized`. No new identity model or secret.
- §12 Test Quality — PASS: `node:test`; auth-gate, handle guards, per-transition errors, wire-leak assertion (no `accountId`), status-mapping + drift; DB-less skip parity.
- §13 Commands & Verification — PASS: exact `pnpm` + `Select-String` + a `git diff` proving the WP-350 contract is untouched.
- §14 Acceptance Criteria — PASS: 8 binary, observable items naming real routes/codes/fields.
- §15 Definition of Done — PASS: binary checkboxes incl. dependency gate + DECISIONS/index/catalog/wiki + commit topology; §15.1 addressed.
- §15.1 User-Visible Verification (D-24026) — PASS (N/A-with-reason): no UI; live check deferred to packet #3; proof is the suite + a DB-backed `curl` smoke, stated as such.
- §16 Code Style — PASS: explicit `if/else`/`for...of` (no branching `.reduce()`); typed result mapping; `// why:` on the wire-`accountId`-omission, the handle-required policy, and the status-mapping table; JSDoc per function; named imports.
- §17 Vision Alignment — PASS: `## Vision Alignment` present; NG-1 + §23(b) addressed; scoring/determinism N/A.
- §18 Prose-vs-Grep — PASS: verification greps target identifiers (`FriendSummary`, `findAccountByHandle`), not a count-literal echoed next to its own check.
- §19 Bridge-vs-HEAD — N/A: no repo-state snapshot artifact.
- §20 Funding Surface Gate — N/A: no donate/support/tournament-funding copy or affordance.
- §21 API Catalog Update — **APPLIES:** 6 new server endpoints → `api-endpoints.md` rows added same-commit at execution (D-11804), closed `Status`/`Auth` sets. Called out in Scope E + DoD.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): NOT READY — BLOCKED on WP-350.** The one blocking PS-item is the hard dependency: WP-350 (`friendships.logic.ts` + `friendships.types.ts`) is **drafted, not executed** at this WP's draft time. Per `01.0a §Phase 1 Definition of Done → Blocking drafts`, this WP is merged as a `[ ]` placeholder row carrying **BLOCKED on WP-350**, reserving the WP-351 / EC-381 / D-24143 numbers and locking the API contract so WP-350's execution can anticipate its consumer. **Re-run pre-flight to READY once WP-350 is Done on `main`.** No other blockers: the `/api/me/*` pattern, `findAccountByHandle`, and the auth deps are all verified on `main`; scope is locked to 2 files + wiring + catalog; new `.routes.ts` contract → standard lane (D-24028). Not a validation-tightening of an existing input path, so `01.4 §Empirical Scaffold` does not apply.

**Copilot (01.7): PASS (design), pending re-run post-WP-350.** Real failure modes pinned: (a) leaking a friend's `accountId` on the wire → **`FriendSummary` field allowlist + explicit no-`accountId` test**; (b) trusting a body-supplied identity → **auth-first, session-resolved actor only**; (c) a handle-less actor becoming unaddressable → **`handle_required` guard**; (d) editing WP-350's locked contract file → **byte-identical `git diff` gate**; (e) N+1 enrichment queries → **single `ext_id = ANY($1)` round-trip**; (f) a cross-layer import → **grep gate**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24143**: the `/api/me/friends*` friend-request API (packet #2 of the Friends & Ranked Trust subsystem). Locks: (1) the **six** `authenticated-session-required` endpoints + their HTTP verbs/shapes; (2) the `FriendSummary` wire projection — friend identified by `handle` + `displayName`, **never** `accountId` (FR-2, mirroring `PublicProfileView`); (3) the handle-addressable policy — the acting account must have a claimed handle (`handle_required`), the target must resolve (`handle_not_found`); (4) the `FriendApiErrorCode` closed union (WP-350 logic codes + `unauthorized`/`invalid_request`/`handle_required`/`handle_not_found`) + the locked HTTP status-mapping table; (5) enrichment as a single `ext_id = ANY($1)` round-trip per list route; (6) the contract-file lock — WP-350's `friendships.{types,logic}.ts` are not modified. Email notification (packet #4), UI (packet #3), and the ranked gate (packet #5) are explicitly out. Drafted 2026-07-10; not yet landed (BLOCKED on WP-350).
