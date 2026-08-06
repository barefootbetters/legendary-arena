# WP-504 — Friend request by @handle OR Account ID (handle-or-UUID matching)

**Status:** Draft 2026-08-05 — standard two-session lane. **Gates: lint SATISFIED (21/21) · pre-flight READY · copilot PASS** — see Gate Verdicts.
**User-Visible Surface:** `arena-client` Friends section (the add-friend input now accepts an `@handle` **or** a pasted Account ID; D-24026 live-verification applies).
**Primary Layer:** Server (`apps/server` friendships route + a shared identity guard) **and** App (`apps/arena-client` friends API + composable + component). Cross-layer, boundary-respecting — no engine/registry/data/persistence touch.
**Dependencies:** WP-350 / WP-351 (the friend API + `FriendSummary`/`FriendApiErrorCode` contract + FR-2 output-redaction); WP-355 / D-24147 (the block/cooldown/rate-limit abuse chain the accountId path funnels into); WP-499 / D-24302 (the copy-paste-identifier trust model this mirrors); reuses `findPlayerByAccountId` (`apps/server/src/identity/identity.logic.ts`).

---

## Goal

Today a player can only add a friend by typing an **`@handle`** — `POST /api/me/friends/requests` accepts `{ handle }`, resolves it against `legendary.players.handle_canonical`, and errors if no such handle exists. There is no way to add someone by their **Account ID** even when you have it. This WP makes the add-friend surface **identifier-agnostic**: the endpoint accepts **either** `{ handle }` (unchanged) **or** `{ accountId }` (a well-formed v4 UUID = the target's own AccountId, shared with you out-of-band), resolves it via the existing `findPlayerByAccountId`, and funnels into the **same** abuse-control chain + `sendFriendRequest`. The Friends UI input accepts an `@handle` or a pasted Account ID, discriminating automatically. It is the by-identity twin of WP-499's by-match-ID join: a copy-paste capability, not a directory — you can only add an account whose ID was deliberately shared with you. FR-2 is untouched: friend **responses** still expose `handle` + `displayName` only, never an `accountId`; this change is **input-only** and emits no new identifier.

## Assumes (Hard-Gate Preconditions)

```bash
# A. The add-friend route resolves a handle and funnels into the abuse chain + sendFriendRequest (the flow accountId reuses).
grep -q "findAccountByHandle(handleValue, database)" apps/server/src/friendships/friendships.routes.ts && echo "A_OK handle-resolve path exists"
# B. findPlayerByAccountId resolves an AccountId to a PlayerAccount|null (the accountId-path resolver).
grep -q "export async function findPlayerByAccountId" apps/server/src/identity/identity.logic.ts && echo "B_OK accountId resolver exists"
# C. FriendApiErrorCode is a union mirrored by a canonical array + a client drift test (the lockstep account_not_found joins).
grep -q "FRIEND_API_ERROR_CODES" apps/server/src/friendships/friendships.routes.ts && grep -q "expectedServerUnion" apps/arena-client/src/lib/api/friendsApi.test.ts && echo "C_OK server union + array + client drift guard"
# D. FR-2 output redaction: FriendSummary carries no accountId (the invariant this WP must NOT breach).
grep -q "deliberately NO .accountId. field" apps/arena-client/src/lib/api/friendsApi.ts && echo "D_OK FR-2 no-accountId-on-the-wire invariant present"
# E. No AccountId-shape guard exists yet (this WP introduces the shared one).
! grep -rq "isWellFormedAccountId" apps/server/src && echo "E_OK no accountId-shape guard today"
```

## Context (Read First)

- **Why this surfaced.** Operator design question (2026-08-05): "Can we match players using either their handle or their UUID?" The answer, written into the ewiki Profile Login page (PR #1245): yes — `@handle` is the friendly discovery path, and the `AccountId`/`ext_id` UUID is an unambiguous copy-paste capability. This WP builds the friend-request half.
- **Why the friend-request surface (and not match-invites).** Match-invite creation is **friend-gated** (`createMatchInvite` returns `not_friends` when the target isn't already a friend), and a friend is always addressable by `@handle` — so UUID-matching on invites is redundant. The paired WP-505 was drafted and dropped for exactly this reason (its numbers retracted). The friend-**request** surface is the one place the UUID path earns its keep: you're adding someone who is **not yet** a friend and whose handle you may not have.
- **FR-2 is an OUTPUT invariant, not an input one.** FR-2 (D-…, WP-350/351) forbids the friend/invite/block/profile **wire projections** from ever emitting `accountId`/`ext_id`/`player_id`; a friend is identified on the wire and on screen by `handle` + `displayName`. That is precisely why a UUID is a *copy-paste* capability: you can never learn someone's AccountId from any friend surface — the only way to hold it is if they shared their own (their AccountId is shown to **them** on their owner profile). Accepting a self-held AccountId as request **input** emits no identifier and reveals nothing, so it does not breach FR-2. D-24308 records this scope clarification.
- **Reuse the resolver + the abuse chain, don't fork them.** The accountId path differs from the handle path only in *how the target `AccountId` is obtained* (`findPlayerByAccountId` vs `findAccountByHandle`). Once resolved, both feed the identical block → cooldown → rate-limit → `sendFriendRequest` sequence. `sendFriendRequest` already guards `self_friendship` / `already_pending` / `already_friends` in the logic layer, so a self-add-by-your-own-UUID is caught with no new guard.
- **Standard two-session lane (not lightweight, D-24028):** the surface is **identity** (explicitly excluded from the lightweight lane), it crosses a layer boundary (server + arena-client), and it adds an error code to a drift-locked union. All three force the standard draft→execute split. Zero determinism/persistence surface even so.
- **Pre-existing client drift (flagged, OUT of scope).** The client `FRIEND_API_ERROR_CODES` mirror (`friendsApi.ts`) and its drift test's `expectedServerUnion` copy list only **11** codes, but the server union already has **14** — the three WP-355 codes (`blocked`, `rate_limited`, `request_cooldown`) were never mirrored, so those server responses narrow to `null` on the client and render the generic banner today. The client "drift guard" compares the mirror to a *hardcoded* client-side copy, not to the server, so it never caught this. **This WP does not fix that** (it is a separate pre-existing bug) — it only adds `account_not_found` to keep its own change consistent. The gap is recorded here and spun off as its own task; do not absorb it into this WP.
- **Size note (cohesion over splitting).** This is a ~12-file full-stack feature (server route + shared identity guard + client API + composable + component, each with tests). It reads over the ~10-file split heuristic, but it is a **single** feature whose parts share two new helpers (`isWellFormedAccountId`, `parsePlayerIdentifier`); splitting it would fragment one contract across two WPs with a hard Assumes edge for no isolation benefit. Kept as one WP.

## Scope (In)

- **`apps/server/src/identity/identity.logic.ts`** — new pure exported guard `isWellFormedAccountId(value: string): boolean` (UUID-shape `8-4-4-4-12` hex, case-insensitive). No I/O. It gates the accountId path so obvious garbage yields `invalid_request` without a DB round-trip; the DB lookup remains the authority on existence.
- **`apps/server/src/friendships/friendships.routes.ts`** — the add-friend body now accepts `{ handle?, accountId? }`; **exactly one** non-empty value is required (neither → `invalid_request`; both → `invalid_request`). The `accountId` branch: `isWellFormedAccountId` (malformed → `invalid_request`) → `findPlayerByAccountId` (null → new `account_not_found`) → the resolved `targetAccount` funnels into the **existing** block/cooldown/rate-limit + `sendFriendRequest` sequence. Adds `account_not_found` to the `FriendApiErrorCode` union + `FRIEND_API_ERROR_CODES` array; `statusForFriendApiErrorCode('account_not_found') → 404` (join the existing `handle_not_found` branch — the default fallthrough is 409, so it must be added explicitly).
- **`apps/arena-client/src/lib/api/playerIdentifier.ts`** — new pure `parsePlayerIdentifier(raw: string): { kind: 'handle'; value: string } | { kind: 'accountId'; value: string } | null`. Trims; strips a single leading `@`; empty → `null`; matches the UUID shape → `accountId`; otherwise → `handle`. No I/O, no import from server code.
- **`apps/arena-client/src/lib/api/friendsApi.ts`** — add `account_not_found` to the client `FRIEND_API_ERROR_CODES` mirror; `sendFriendRequest(authToken, target)` where `target` is `{ handle: string } | { accountId: string }`, serialized to the matching body field.
- **`apps/arena-client/src/composables/useFriends.ts`** — the existing exported `add(raw)` (the function `FriendsSection` already calls — **not** a new `sendRequest`) parses `raw` via `parsePlayerIdentifier`; `null` → the existing invalid-input inline path (no network call); otherwise calls `sendFriendRequest` with the parsed target. The component already trims and strips a leading `@` before calling `add`, so a bare `@handle` arrives as `handle` and a UUID arrives unchanged.
- **`apps/arena-client/src/components/FriendsSection.vue`** — the add-friend input label/placeholder become "@handle or Account ID"; the existing `friendMessageForCode` map (in this file) gains `account_not_found` → "No player with that Account ID." No handler-logic change — it already trims/strips and delegates to `add`. Additive only.
- **Tests:** `identity.logic.test.ts` (guard units), `playerIdentifier.test.ts` (new), `friendsApi.test.ts` (client drift copy `expectedServerUnion` + accountId body + `account_not_found` mapping), `useFriends.test.ts` (parse routing through `add`), `FriendsSection.test.ts` (UUID input sends `accountId`; the not-found message), `friendships.routes.test.ts` (accountId 201 / malformed → `invalid_request` / unknown → `account_not_found` / both-or-neither → `invalid_request` / self-by-own-UUID → `self_friendship`; **plus** the file's own hardcoded `expected` code-set at its drift assertion — a **fifth** lockstep site — updated). Route-level cases are **DB-gated** (`TEST_DATABASE_URL`, via `provisionAccountWithHandle`) exactly like the existing suite; they assert on response status/body, not a spy.

## Out of Scope

- **Match invites, blocks, or any other friend endpoint** — only `POST /api/me/friends/requests` gains the accountId path. (WP-505 match-invite-by-UUID was evaluated and dropped as redundant; see Context.)
- **Exposing `accountId` in any response** — FR-2 stands; no wire projection changes; no `FriendSummary` field added.
- **A directory, search, or enumeration of accounts by UUID** — the capability is copy-paste only; no listing, no autocomplete, no reverse lookup.
- **Changing the acting-user handle gate** — the sender still needs a handle (`handle_required`) exactly as today; this WP only changes how the **target** is addressed.
- **Any engine/registry/data/persistence/RNG surface, a schema migration, or a new Decision beyond D-24308.**

## Files Expected to Change

- `apps/server/src/identity/identity.logic.ts` — **modified** (`isWellFormedAccountId`)
- `apps/server/src/identity/identity.logic.test.ts` — **modified** (guard units)
- `apps/server/src/friendships/friendships.routes.ts` — **modified** (accountId branch + `account_not_found` union/array/status)
- `apps/server/src/friendships/friendships.routes.test.ts` — **modified** (accountId cases + drift)
- `apps/arena-client/src/lib/api/playerIdentifier.ts` — **new** (pure parser)
- `apps/arena-client/src/lib/api/playerIdentifier.test.ts` — **new** (parser units)
- `apps/arena-client/src/lib/api/friendsApi.ts` — **modified** (mirror code + `sendFriendRequest` target)
- `apps/arena-client/src/lib/api/friendsApi.test.ts` — **modified** (drift copy + accountId path)
- `apps/arena-client/src/composables/useFriends.ts` — **modified** (parse routing)
- `apps/arena-client/src/composables/useFriends.test.ts` — **modified**
- `apps/arena-client/src/components/FriendsSection.vue` — **modified** (input copy + not-found message)
- `apps/arena-client/src/components/FriendsSection.test.ts` — **modified**
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** at execution (the `POST /api/me/friends/requests` request-schema row; D-11804 whole-row replace)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` / `NUMBER-LEDGER.md` / `DECISIONS.md` — **modified** (governance close)

12 code/test files + api-catalog + governance. Cross-layer, standard two-session lane.

## Contract

`POST /api/me/friends/requests` (authenticated-session; acting handle required) accepts a JSON body with **exactly one** of `handle: string` or `accountId: string`. `handle` behaves exactly as today. `accountId` must be a well-formed UUID (`isWellFormedAccountId`, else `invalid_request` 400); it resolves via `findPlayerByAccountId` (no match → `account_not_found` 404). A resolved target — by either path — funnels into the **unchanged** WP-355 block (403) / cooldown (429) / rate-limit (429) chain and `sendFriendRequest` (`self_friendship` / `already_pending` / `already_friends`, 409). Supplying both fields or neither → `invalid_request` (400). `account_not_found` is a new `FriendApiErrorCode` (server union + `FRIEND_API_ERROR_CODES` array + client mirror + both drift tests, in lockstep) mapping to 404. **No response shape changes: FR-2 stands — friend responses still emit `handle` + `displayName` only, never `accountId`.** The client add-friend input accepts an `@handle` or a pasted Account ID; `parsePlayerIdentifier` discriminates and the API sends the matching body field.

## Acceptance Criteria

1. `isWellFormedAccountId` returns `true` for a canonical UUID (e.g. `4f2219e4-…` 8-4-4-4-12 hex, any case) and `false` for empty, a bare handle, a too-short/too-long string, and a non-hex-containing string.
2. `parsePlayerIdentifier` returns `{kind:'accountId'}` for a UUID, `{kind:'handle'}` for `@jeff`/`jeff` (leading `@` stripped), and `null` for empty/whitespace.
3. `POST /api/me/friends/requests` with a valid `accountId` for an existing player creates the request (201) exactly as the handle path does — asserted DB-gated (`TEST_DATABASE_URL`, via `provisionAccountWithHandle`) on the response status/body, matching the existing route-test harness (not a spy).
4. Error paths return the locked codes/status: malformed `accountId` → `invalid_request` (400); well-formed but unknown → `account_not_found` (404); both `handle` and `accountId` present, or neither → `invalid_request` (400); your own `accountId` → `self_friendship` (409, via the existing logic guard). The block/cooldown/rate-limit guards still fire on the accountId path.
5. No response exposes `accountId` (FR-2 preserved) — asserted by the existing no-`accountId`-on-the-wire test (`assertFriendSummaryShape`, `friendships.routes.test.ts`) still passing. `account_not_found` is added to all **five** lockstep sites and every drift assertion stays green: server union + server `FRIEND_API_ERROR_CODES` array + the server route-test's hardcoded `expected` set + the client `FRIEND_API_ERROR_CODES` mirror + the client test's `expectedServerUnion` copy.
6. In the Friends UI, pasting an Account ID and submitting sends `{ accountId }` (not `{ handle }`); an unknown Account ID renders "No player with that Account ID."; a bare handle still sends `{ handle }`.
7. `pnpm -r build` + the server and arena-client suites exit 0; coverage thresholds hold; no file outside the allowlist changes; no `finalStateHash`/`PRE_WP080` re-pin (N/A — no engine surface).

## Verification Steps

```bash
pnpm -r build
pnpm --filter @legendary-arena/server test 2>&1 | tail -6
pnpm --filter @legendary-arena/arena-client test 2>&1 | tail -6
# Browser (localhost dev server, not CF-gated): open the Friends section, paste a
# real Account ID (from another account's owner profile) → request sends; paste a
# random UUID → "No player with that Account ID."; type an @handle → still works.
git diff --name-only | grep -vE '^(apps/server/src/(identity/identity\.logic|friendships/friendships\.routes)\.(ts|test\.ts)|apps/arena-client/src/(lib/api/(playerIdentifier|friendsApi)|composables/useFriends|components/FriendsSection)\.(ts|test\.ts|vue)|docs/)' ; echo "out-of-scope hits above (expect none)"
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–E passed
- [ ] All 7 Acceptance Criteria pass
- [ ] accountId add-friend confirmed in-browser (paste Account ID → request; unknown → inline copy; @handle still works)
- [ ] `pnpm -r build` + server + arena-client suites exit 0; coverage thresholds hold
- [ ] Only the 12 allowlisted files + api-catalog + governance changed; no engine/registry/data change; reserves no new decision beyond D-24308; FR-2 output redaction intact
- [ ] `docs/ai/REFERENCE/api-endpoints.md` `POST /api/me/friends/requests` row updated (D-11804 whole-row); request schema field names match `00.2`
- [ ] `docs/ai/STATUS.md` Done entry; WORK_INDEX `[x]` + EC_INDEX Done; NUMBER-LEDGER `RESERVED`→`LANDED`; D-24308 flipped Active; `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` 0
- [ ] Commit prefix `EC-539:` (code) + `SPEC:` (governance close)
- [ ] D-24026 live-verify: add-by-Account-ID confirmed on the deployed Friends section (operator-pending)

## Gate Verdicts (drafting session)

- **Pre-flight (01.4):** READY TO EXECUTE — dependencies (WP-350/351 friend API + FR-2, WP-355 abuse chain, WP-499/D-24302 trust model) are on `main`; `findPlayerByAccountId` pre-exists and returns `PlayerAccount|null`; scope is a closed 12-file allowlist; ambiguities (both/neither field, self-by-own-UUID, malformed vs unknown, FR-2 input-vs-output) resolved in the Contract + EC Locked Values. *(Recorded at draft; independent-subagent run.)*
- **Copilot (01.7):** PASS — no new contract file; the cross-layer edit respects the boundary (server owns resolution, client owns input parse); no determinism/persistence/hash surface. Two RISKs folded in (independent-subagent audit, 2026-08-05): (a) adding `account_not_found` touches **five** drift sites, not four — the server route-test `friendships.routes.test.ts` carries its own hardcoded `expected` code-set; the EC now lists all five as a lockstep Locked Value so no drift assertion goes red. (b) the composable function is the existing **`add(raw)`**, not a new `sendRequest`, and `FriendsSection.vue` already trims/strips `@` — the WP/EC were corrected to name the real symbol. A pre-existing, out-of-scope client-mirror drift (missing the three WP-355 codes) was also surfaced and spun off. *(Recorded at draft.)*
- **Lane:** standard two-session — identity surface + cross-layer + drift-union change all fail the lightweight eligibility gate.

## Lint Gate Self-Review

All 21 sections resolved (PASS or explicit N/A):
- **§4 (00.2):** the request schema adds `accountId` (an existing canonical concept = `AccountId`/`ext_id`); no card-data/match-setup field; `MatchSetupConfig` untouched. The api-catalog row (execution) uses the canonical field name.
- **§5:** Files Expected to Change is a closed set (12 code/test + api-catalog + governance) matching the EC.
- **§10 (env):** N/A — no new env var. **§11 (auth):** unchanged — `authenticated-session-required` + acting-handle gate as today; the target-resolution change adds no credential path. **§12 (tests):** `.test.ts` only; two new test files + additions.
- **§17 Vision / §20 Funding / §21 API:** resolved below.
- **§18 / §19:** N/A (the only verification grep runs over `git diff --name-only`; STATUS authored at close against live HEAD).
- All remaining sections PASS.

## Vision Alignment

**Clauses touched:** §22 (determinism — server resolution + app UI; no `G`/RNG/replay/hash); §23(b) (PvP terminology — N/A: adding a co-op friend, no player-vs-player term). **Conflict:** `No conflict.` A discovery-input affordance reusing the existing request path; no card semantics, gameplay, scoring, or persistence change. **Non-Goal check:** none of NG-1..8 crossed — not monetization, not pay-to-win; it lowers friction to connect with a friend, aligned with the product's growth interest. **FR-2 note:** the friends privacy invariant (no `accountId` on the wire) is explicitly preserved — this is input-only.

## Funding Surface Gate

**N/A — no funding surface touched** (no nav/registry/profile-funding/tournament affordance or copy; an add-friend input only). Authority: WP-097, D-9701, D-9801.

## API Catalog Update

**Deferred to execution (per lint §21).** `POST /api/me/friends/requests` gains an alternative request field (`accountId`); its `docs/ai/REFERENCE/api-endpoints.md` row is replaced whole (D-11804) in the `EC-539:` implementation commit, not at draft — the endpoint does not change until then. Status stays `Wired`; Auth stays `authenticated-session-required`. `isWellFormedAccountId` is a pure library helper (not HTTP-reachable) — no catalog row.
