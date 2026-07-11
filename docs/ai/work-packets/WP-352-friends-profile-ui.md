# WP-352 — Friends Tab on the Owner Profile (Arena Client)

**Status:** Draft 2026-07-10 · **BLOCKED on WP-351** (hard dep — the `/api/me/friends*` endpoints must be **Wired** on `main`; WP-351 is drafted-and-blocked-on-WP-350 at this WP's draft time). **Standard two-session lane** (D-24028 — NOT lightweight: new client contract wrapper + new component + `MyProfilePage.vue` edit + user-visible surface). Pairs with **EC-382** (authored at execution-prep). Reserves **D-24144** (lands at execution).
**Primary Layer:** App (`apps/arena-client`)
**User-Visible Surface:** `play.legendary-arena.com` (`?route=me` → a new **Friends** section on the owner profile). **D-24026 live-verify APPLIES** (deferred until WP-351 is deployed).
**Dependencies:** **WP-351** (packet #2 — the six `/api/me/friends*` endpoints + the `FriendSummary` wire shape; **must be Wired**) ⛔ *drafted, blocked on WP-350*; WP-104 (`MyProfilePage.vue` + the `ownerProfileApi.ts` wrapper pattern) ✅; WP-160 (the Pinia auth store bearer token) ✅; WP-161 (`buildApiUrl` / `VITE_API_BASE_URL`) ✅.
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution — **must be after WP-350 + WP-351 merged**).

---

## Goal

Give a signed-in player a **Friends** section on their owner profile (`?route=me`): add a friend by `@handle`, see incoming friend requests with Accept / Decline, see their own outgoing (sent) pending requests, and see their friends list with Remove. The section is a thin client over WP-351's `/api/me/friends*` API — a new `friendsApi.ts` wrapper (mirroring `ownerProfileApi.ts`), a `useFriends` composable for state, and a `FriendsSection.vue` rendered inside `MyProfilePage.vue` alongside the existing sections. This is the **UI half** of the Friends & Ranked Trust subsystem (charter FR-1…FR-9). Every friend is shown by `@handle` + display name (never an `AccountId` — the API never sends one).

---

## User-Visible Impact

On `?route=me`, below the existing profile sections, a **Friends** panel appears with: an "Add a friend" input (`@handle`) + button; a **Requests** area listing incoming requests (Accept / Decline) and the player's own outgoing pending requests (display-only); and a **Friends** list (each with Remove). Typed errors render as friendly inline lines ("You're already friends", "No player with that handle", "Claim a handle first to add friends"). Nothing about matches, wins, ranks, or opponents appears — this is social, not competitive (§23(b)).

---

## Assumes

- **WP-351 is Wired and its contract is on `main`.** `GET /api/me/friends` → `{ friends: FriendSummary[] }`; `GET /api/me/friends/requests` → `{ incoming, outgoing }`; `POST /api/me/friends/requests {handle}` → `201 {FriendSummary}`; `POST …/requests/:handle/{accept,decline}` → `200 {FriendSummary}`; `DELETE /api/me/friends/:handle` → `204`. `FriendSummary = { handle, displayName, status, direction, requestedAt, respondedAt }` — **no `accountId`**. Error body is `{ error: FriendApiErrorCode }`. ⛔ *At draft time WP-351 is not Wired — this packet is BLOCKED until it is.*
- **The owner-page API-wrapper pattern is fixed.** `apps/arena-client/src/lib/api/ownerProfileApi.ts` declares wire shapes **inline by structural compatibility** (no server-layer import — engine/server isolation), prefixes every URL with `buildApiUrl(...)` (WP-161), attaches `Authorization: Bearer ${authToken}` when the token is non-null, returns `{ ok:true, value } | { ok:false, status, code }`, never throws, and its `.test.ts` drift-tests the client error-code mirror against the server union (set-equality). `friendsApi.ts` mirrors this exactly. (Verified: `ownerProfileApi.ts`.)
- **`MyProfilePage.vue` composes section components.** It imports section components from `../components/*.vue` (e.g., `BillingSection.vue`) and renders them with the owner's `authToken`. `FriendsSection.vue` is added the same way. (Verified: `MyProfilePage.vue:25`.)
- **Tests run under `node:test` + tsx + `@legendary-arena/vue-sfc-loader/register`** (`apps/arena-client` `test` script); `.vue` components are testable via the loader. Files are `*.test.ts`. (Verified: `apps/arena-client/package.json`.)
- **SFC pattern is `defineComponent`** (D-6512); the Pinia auth store exposes the bearer token (WP-160). (Verified: `MyProfilePage.vue`, `stores/auth.ts`.)

If WP-351 is not Wired, or any of the above is false, this packet is **BLOCKED** and must not execute.

---

## Context (Read First)

- [`wiki/profile-login.md` §Friends & Ranked Trust Layer (Proposed)](../../../wiki/profile-login.md) — the charter. Packet #3 (this WP) is the "Profile UI" item. **FR-2** is why the UI keys on `@handle`, never `accountId` (the API never sends one).
- `docs/ai/work-packets/WP-351-friend-request-api.md` — the API this UI calls (the `FriendSummary` shape + the `FriendApiErrorCode` set + status mapping). **Do not add server work here.**
- `apps/arena-client/src/lib/api/ownerProfileApi.ts` (+ `.test.ts`) — the wrapper + drift-test precedent to mirror verbatim (`buildApiUrl`, bearer token, `{ok}|{ok:false,status,code}`, `parseFailure` reading `body.error`).
- `apps/arena-client/src/pages/MyProfilePage.vue` — where the `<FriendsSection>` mounts, and how `authToken` is threaded to sections.
- `apps/arena-client/src/components/BillingSection.vue` — a section-component precedent (structure, loading/empty/error states, `defineComponent`).
- `docs/ai/ARCHITECTURE.md §Import Rules` — `apps/arena-client` must NOT import `@legendary-arena/game-engine/setup`, `registry` (runtime), `server`, `pg`. This packet imports none of those.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; `defineComponent` SFCs (D-6512); test files `.test.ts` under `node:test`.
- Human-style code per `00.6`; full-sentence UI error copy; `// why:` on non-obvious choices; JSDoc per exported function/composable.
- **Layer isolation.** `friendsApi.ts` / `useFriends.ts` / `FriendsSection.vue` import nothing from `@legendary-arena/game-engine`, `@legendary-arena/registry` (runtime), `apps/server`, `pg`, or `boardgame.io`. `FriendSummary` is declared **inline** by structural compatibility with WP-351's server shape (no server import).

**Packet-specific:**
- **Handle-only identity on screen (FR-2).** The UI displays and acts on `@handle` + `displayName`; it never reads or shows an `accountId` (the API sends none). Every friend action targets a `@handle`.
- **Consumer-only.** This packet adds no endpoint, no migration, no server file. It calls only WP-351's six routes. Any missing capability (see "Known gap" below) is deferred, not invented here.
- **Client mirror + drift test.** `friendsApi.ts` carries a client-local `FRIEND_API_ERROR_CODES` mirror with a `.test.ts` set-equality drift test against the server union (mirrors the `AVATAR_UPLOAD_ERROR_CODES` precedent) so a server code change fails loudly.
- **Never throws; typed failure.** Every wrapper returns `{ ok:false, status, code }` on non-2xx and `{ ok:false, status:0, code:null }` on a network throw. The UI renders a friendly line per code; unknown code → generic banner.
- **No PvP framing (§23(b)).** Copy uses "friend" / "request" / "add" only — no "challenge", "opponent", "match", "vs", win/loss, or rank language.
- **No gameplay / engine / UIState touch.** This is a profile surface; it does not read `G`, `UIState`, or any engine projection.

**Session protocol:**
- If the exact wrapper result shape or the auth-token threading is unclear, stop and read `ownerProfileApi.ts` / `MyProfilePage.vue` — do not invent the fetch contract.

---

## Scope (In)

### A) `friendsApi.ts` (new) — `apps/arena-client/src/lib/api/`
Six `fetch` wrappers mirroring `ownerProfileApi.ts` (each `buildApiUrl` + optional `Bearer`, never throws):
- `fetchFriends(authToken)` → `{ ok:true, value: FriendSummary[] } | Failure`
- `fetchFriendRequests(authToken)` → `{ ok:true, value: { incoming: FriendSummary[]; outgoing: FriendSummary[] } } | Failure`
- `sendFriendRequest(authToken, handle)` → `{ ok:true, value: FriendSummary } | Failure`
- `acceptFriendRequest(authToken, handle)` → `{ ok:true, value: FriendSummary } | Failure`
- `declineFriendRequest(authToken, handle)` → `{ ok:true, value: FriendSummary } | Failure`
- `removeFriend(authToken, handle)` → `{ ok:true } | Failure` (204)
- Inline `FriendSummary` type (mirror WP-351, no server import); client-local `FRIEND_API_ERROR_CODES` mirror + `FriendApiErrorCode` type; `parseFailure` reads `body.error`.

### B) `useFriends.ts` (new) — `apps/arena-client/src/composables/`
A composable owning the section's reactive state: `friends`, `incoming`, `outgoing`, `isLoading`, `errorCode`; `load()` (fetch friends + requests), `add(handle)`, `accept(handle)`, `decline(handle)`, `remove(handle)` — each calling the wrapper and refetching (simple refetch, not optimistic, to keep state authoritative). Pure of DOM; unit-testable with a stubbed api module.

### C) `FriendsSection.vue` (new) — `apps/arena-client/src/components/`
`defineComponent` SFC taking an `authToken` prop; renders: an add-by-`@handle` input + button; the **Requests** area (incoming with Accept/Decline; outgoing **display-only**); the **Friends** list (each with Remove); loading / empty / error states; friendly per-code error copy. No `accountId` anywhere.

### D) `MyProfilePage.vue` (modified)
Import + render `<FriendsSection :auth-token="authToken" />` as a new section, mirroring how `BillingSection` is mounted. No other change to the page.

### E) Tests
- `friendsApi.test.ts` — each wrapper's success + failure parsing (`body.error` → code); the `FRIEND_API_ERROR_CODES` drift test (set-equality vs the server union); network-throw → `{status:0,code:null}`.
- `useFriends.test.ts` — `load` populates the three lists; `add`/`accept`/`decline`/`remove` call the right wrapper and refetch; a failed action surfaces `errorCode` without corrupting the lists.
- `FriendsSection.test.ts` — renders incoming/outgoing/friends; Accept/Decline/Remove/Add fire the composable actions; **no `accountId` string appears in the rendered output** (asserted); per-code error copy renders.

---

## Out of Scope

- **No server work** — no endpoint, migration, or `apps/server` file. Consumes WP-351 only.
- **No block list / privacy controls** — the charter's "privacy controls + block list" ride on models (`allow_friend_requests`, a block table) that do not exist until **packet #6**; deferred there.
- **No cancel-outgoing-request** — WP-351 exposes no "cancel my sent request" route (see **Known gap**); outgoing pending is display-only here.
- **No email** — the Brevo notification is **packet #4** (server-side).
- **No ranked / lobby surface** — the ranked-eligibility UX is **packet #5**.
- **No public-profile friends display** — this packet is the owner's own `?route=me` section only; showing friends/mutual-friends on the public profile is a later WP.
- **No engine / `G` / `UIState` / gameplay touch.**

---

## Files Expected to Change

- `apps/arena-client/src/lib/api/friendsApi.ts` — **new**
- `apps/arena-client/src/composables/useFriends.ts` — **new**
- `apps/arena-client/src/components/FriendsSection.vue` — **new**
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** (mount `<FriendsSection>`)
- `apps/arena-client/src/lib/api/friendsApi.test.ts` — **new**
- `apps/arena-client/src/composables/useFriends.test.ts` — **new**
- `apps/arena-client/src/components/FriendsSection.test.ts` — **new**
- Governance: `WORK_INDEX.md` (blocked row) + `DECISIONS.md` (**D-24144**, at execution) + `STATUS.md` + `wiki/profile-login.md` (packet-#3 → WP-352 link). `EC_INDEX.md` row + the EC-382 file at **execution-prep**.

**3 code + 1 page edit + 3 tests. Standard two-session lane** (new client wrapper contract + new component + user-visible surface). No `apps/server` / `data/migrations` / engine / registry touch.

---

## Contract

### Client wrapper result (mirrors `OwnerProfileApiResult`)
`FriendsApiResult<T> = { ok: true; value: T } | { ok: false; status: number; code: FriendApiErrorCode | null }` (the `remove` wrapper's success branch is `{ ok: true }`, no value).

### `FriendSummary` (inline mirror — no server import)
`{ handle: string; displayName: string; status: 'pending' | 'accepted' | 'declined'; direction: 'incoming' | 'outgoing'; requestedAt: string; respondedAt: string | null }` — **no `accountId`**.

### Locked Values (do not re-derive at execution)
| Key | Value |
|---|---|
| Section mount | `<FriendsSection>` renders on `?route=me` inside `MyProfilePage.vue`, threaded the owner `authToken` (same as `BillingSection`) |
| Identity on screen | `@handle` + `displayName` only — **no** `accountId` rendered or read (asserted by a test grep of the rendered output) |
| State strategy | mutate → **refetch** (`useFriends` reloads friends + requests after any action; authoritative, not optimistic) |
| Outgoing requests | **display-only** (no cancel route in WP-351) |
| Error copy map | closed per-code copy: `already_friends`→"You're already friends." · `already_pending`→"A request to that player is already pending." · `handle_not_found`→"No player with that handle." · `handle_required`→"Claim a handle first to add friends." · `self_friendship`→"You can't friend yourself." · `not_addressee`/`no_pending_request`/`not_friends`→context line · `unauthorized`→"Please sign in again." · unknown/null → generic banner |
| Drift | `friendsApi.test.ts` asserts the client `FRIEND_API_ERROR_CODES` mirror equals the server union as a set |

---

## Acceptance Criteria

1. `friendsApi.ts` exports the six wrappers, each using `buildApiUrl` + optional `Bearer ${authToken}`, returning `{ ok:true, value } | { ok:false, status, code }` (`remove` → `{ ok:true }`), never throwing (network throw → `{status:0,code:null}`) (**AC-1**).
2. The client `FRIEND_API_ERROR_CODES` mirror is set-equal to WP-351's server union, asserted by a drift test that fails if the server union changes (**AC-2**).
3. `useFriends` `load()` populates `friends` / `incoming` / `outgoing`; `add`/`accept`/`decline`/`remove` call the matching wrapper and refetch; a failed action sets `errorCode` and leaves the lists intact (**AC-3**).
4. `FriendsSection.vue` renders on `?route=me`, shows friends + incoming (Accept/Decline) + outgoing (display-only) + an add-by-`@handle` control, wires each to the composable, and renders the locked per-code error copy; **no `accountId` string appears in its rendered output** (asserted) (**AC-4**).
5. `MyProfilePage.vue` mounts `<FriendsSection>` with the owner `authToken`; no other page behavior changes (**AC-5**).
6. No import of `@legendary-arena/game-engine`/`registry`(runtime)/`apps/server`/`pg`/`boardgame.io` in the new files; `FriendSummary` is declared inline (no server import) (**AC-6**).
7. `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) 0; `pnpm --filter @legendary-arena/arena-client test` green (new suites pass, baseline otherwise unchanged); `pnpm -r build` 0 (**AC-7**).

---

## Verification Steps

```pwsh
# Step 1 — typecheck + build (requires WP-350 + WP-351 merged)
pnpm --filter @legendary-arena/arena-client typecheck   # Expected: vue-tsc exits 0
pnpm -r build                                           # Expected: exits 0

# Step 2 — arena-client tests (new suites)
pnpm --filter @legendary-arena/arena-client test
# Expected: friendsApi / useFriends / FriendsSection suites present; baseline + these

# Step 3 — layer isolation + no accountId on screen
Select-String -Path "apps\arena-client\src\lib\api\friendsApi.ts","apps\arena-client\src\composables\useFriends.ts","apps\arena-client\src\components\FriendsSection.vue" -Pattern "@legendary-arena/game-engine|@legendary-arena/registry|apps/server|boardgame.io"
# Expected: no output
Select-String -Path "apps\arena-client\src\components\FriendsSection.vue" -Pattern "accountId|ext_id"
# Expected: no output

# Step 4 — the wrapper + drift mirror exist
Select-String -Path "apps\arena-client\src\lib\api\friendsApi.ts" -Pattern "FRIEND_API_ERROR_CODES|FriendSummary|buildApiUrl"

# Step 5 — scope
git diff --name-only   # Expected: only the ## Files Expected to Change set
```

---

## Definition of Done

- [ ] **WP-350 + WP-351 are Done / Wired on `main`** (hard-dep chain) — verified before execution opens
- [ ] All acceptance criteria pass
- [ ] `friendsApi.ts` (6 wrappers, drift mirror), `useFriends.ts`, `FriendsSection.vue` created; `MyProfilePage.vue` mounts the section
- [ ] `@handle` + `displayName` only on screen; no `accountId` rendered/read (test-asserted); no PvP framing
- [ ] No engine/registry-runtime/server/pg/boardgame.io import; `FriendSummary` inline
- [ ] `arena-client` typecheck (vue-tsc) 0 + test green; `pnpm -r build` 0
- [ ] `DECISIONS.md` **D-24144** landed (Active); `WORK_INDEX` (WP-352) + `STATUS.md` updated; `wiki/profile-login.md` packet-#3 row links WP-352
- [ ] **User-visible verification (D-24026):** APPLIES. On deployed `play.legendary-arena.com` `?route=me`: add a friend by `@handle` → appears in outgoing; from the other account accept → appears in both friends lists; remove → gone. Operator-pending on deploy (after WP-351 is live). This packet's proof is the suite **plus** the live click-through, NOT tests alone.

---

## Vision Alignment

**Vision clauses touched:** none of the scoring/PAR/replay clauses. A social surface; the ranked UX is packet #5.

**Conflict assertion:** No conflict. A profile section that manages the friendship graph over WP-351's API; no scoring, PAR, replay, RNG, or leaderboard touch. Identity on screen is the public `@handle`, never the internal `AccountId`.

**Non-Goal proximity check:** Crosses none of NG-1..7. **Not pay-to-win (NG-1)** — friend management confers no gameplay advantage. **PvP terminology (§23(b)):** copy is "friend"/"request"/"add" — no match/opponent/win-loss/vs/challenge framing (per `feedback_pvp_terminology_scope`). **No social reputation** (charter permanent non-goal) — the UI shows binary friendship state only, no counts-as-status.

**Determinism preservation:** N/A — client profile surface; no engine, `G`, `UIState`, replay, RNG, or hash.

---

## Lint Gate Self-Review (00.3)

- §1 Structure — PASS: all required sections; `## Out of Scope` lists ≥2 (server, block/privacy, cancel-outgoing, email, ranked, public-profile, engine).
- §2 Non-Negotiable Constraints — PASS: handle-only identity, consumer-only, client mirror+drift, never-throws, no-PvP-framing, no-engine; cites `00.6`/D-6512.
- §3 Assumes — PASS: WP-351 contract (blocked note), the `ownerProfileApi` wrapper pattern, `MyProfilePage` section pattern, the test harness, the SFC pattern — each with a source.
- §4 Context — PASS: charter, WP-351, `ownerProfileApi.ts` precedent, `MyProfilePage.vue`, `BillingSection.vue`, ARCHITECTURE import rules.
- §5 Output Completeness — PASS: 3 code + 1 page edit + 3 tests; standard lane (new wrapper contract + component + user-visible → correctly NOT lightweight).
- §6 Naming — PASS: `friendsApi`, `useFriends`, `FriendsSection`, `FRIEND_API_ERROR_CODES`; no abbreviations.
- §7 Dependency Discipline — PASS: **zero** new dependencies (uses `vue` + `buildApiUrl` + the auth store already present).
- §8 Architectural Boundaries — PASS (App): no engine/registry-runtime/server/pg/boardgame.io import; `FriendSummary` inline; grep-gated.
- §9 Windows Compatibility — PASS: `pwsh` + `Select-String` + `\` paths.
- §10 Env Var Hygiene — N/A: reuses `VITE_API_BASE_URL` (WP-161); no new env var.
- §11 Authentication Clarity — PASS: every wrapper attaches the bearer token from the auth store; a null token yields the unauthenticated path; the API is `authenticated-session-required`. No new identity model.
- §12 Test Quality — PASS: `node:test` via the arena-client harness; wrapper success/failure, drift, composable state, component render + no-`accountId` assertion.
- §13 Commands & Verification — PASS: exact `pnpm` (typecheck/test/build) + `Select-String` with expected output.
- §14 Acceptance Criteria — PASS: 7 binary, observable items naming real files/routes/fields.
- §15 Definition of Done — PASS: binary checkboxes incl. dependency gate + DECISIONS/index/wiki + live-verify; §15.1 addressed.
- §15.1 User-Visible Verification (D-24026) — PASS (APPLIES): this IS a user-visible surface; the live `?route=me` friend add→accept→remove click-through is a DoD item, operator-pending on deploy after WP-351 is live; proof is suite + live check, not tests alone.
- §16 Code Style — PASS: `defineComponent`; explicit `if/else`; typed results; `// why:` on the refetch-not-optimistic choice, the no-`accountId` rule, and the `body.error` parse; JSDoc per export; named imports.
- §17 Vision Alignment — PASS: `## Vision Alignment` present; NG-1 + §23(b) addressed; scoring/determinism N/A.
- §18 Prose-vs-Grep — PASS: verification greps target identifiers (`FriendSummary`, `FRIEND_API_ERROR_CODES`) + a real `accountId`-absence check, not a count-literal echo.
- §19 Bridge-vs-HEAD — N/A: no repo-state snapshot artifact.
- §20 Funding Surface Gate — N/A: no donate/support/tournament-funding copy or affordance.
- §21 API Catalog Update — N/A: consumes existing WP-351 endpoints; adds no server endpoint (no `api-endpoints.md` edit).

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): NOT READY — BLOCKED on WP-351 (→ WP-350).** The blocking PS-item is the hard-dep chain: WP-351's `/api/me/friends*` endpoints are not Wired at draft time (WP-351 is itself blocked on WP-350). Per `01.0a §Blocking drafts`, this WP merges as a `[ ]` placeholder carrying **BLOCKED on WP-351**, reserving WP-352 / EC-382 / D-24144 and locking the UI contract. **Re-run pre-flight to READY once WP-350 + WP-351 are Done/Wired on `main`.** No other blockers: the `ownerProfileApi` wrapper pattern, the `MyProfilePage` section pattern, the auth store, and `buildApiUrl` are all verified on `main`; scope is 3 code + 1 page edit + 3 tests, single layer.

**Copilot (01.7): PASS (design), pending re-run post-WP-351.** Real failure modes pinned: (a) rendering/reading an `accountId` the API never sends → **handle-only rule + no-`accountId` render assertion**; (b) importing a server type → **inline `FriendSummary` + isolation grep**; (c) a server code change silently unhandled → **client mirror + set-equality drift test**; (d) optimistic state drifting from the server → **mutate-then-refetch**; (e) PvP framing creeping into copy → **§23(b) copy lock**; (f) expecting a cancel-outgoing route that does not exist → **display-only outgoing + Known-gap note**. No BLOCK.

## Known gap (surfaced, not silently absorbed)

WP-351 exposes no **cancel-my-outgoing-request** route (accept/decline are addressee-only; remove targets accepted friendships). So a sender cannot rescind a pending request from this UI. Outgoing pending is therefore **display-only** in this packet. Closing the gap is a small additive route on WP-351 (or a packet-#6 abuse-control item) — noted here so a future WP picks it up rather than this packet inventing a server endpoint out of scope.

## Decision (reserved, lands at execution)

Reserves **D-24144**: the owner-profile Friends section (packet #3 of the Friends & Ranked Trust subsystem). Locks: (1) the client surface — `friendsApi.ts` (six wrappers mirroring `ownerProfileApi.ts`) + `useFriends` composable + `FriendsSection.vue` mounted in `MyProfilePage.vue` on `?route=me`; (2) **handle-only identity on screen** — `@handle` + `displayName`, never `accountId` (FR-2; the API sends none), test-asserted; (3) mutate-then-**refetch** state (authoritative, not optimistic); (4) the client `FRIEND_API_ERROR_CODES` mirror + set-equality drift test against the server union (the `AVATAR_UPLOAD_ERROR_CODES` precedent); (5) **outgoing pending is display-only** — WP-351 exposes no cancel route (Known gap); (6) consumer-only — no server/migration/engine touch; block-list/privacy (packet #6) and email (packet #4) explicitly out. Drafted 2026-07-10; not yet landed (BLOCKED on WP-351).
