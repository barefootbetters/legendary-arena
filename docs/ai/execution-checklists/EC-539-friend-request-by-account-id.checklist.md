# EC-539 — Friend request by @handle OR Account ID (Execution Checklist)

**Source:** docs/ai/work-packets/WP-504-friend-request-by-account-id.md
**Layer:** Server (`apps/server` friendships route + identity guard) + App (`apps/arena-client` friends API/composable/component). Cross-layer, standard two-session lane. No engine/registry/data/persistence touch.

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] `pnpm -r build` first (arena-client imports the game-engine dist; server tests need built deps)
- [ ] Precondition A: `grep -q "findAccountByHandle(handleValue, database)" apps/server/src/friendships/friendships.routes.ts`
- [ ] Precondition B: `grep -q "export async function findPlayerByAccountId" apps/server/src/identity/identity.logic.ts`
- [ ] Precondition C: `grep -q "FRIEND_API_ERROR_CODES" apps/server/src/friendships/friendships.routes.ts` AND `grep -q "expectedServerUnion" apps/arena-client/src/lib/api/friendsApi.test.ts`
- [ ] Precondition D: `grep -q "deliberately NO .accountId. field" apps/arena-client/src/lib/api/friendsApi.ts` (FR-2 invariant to preserve)
- [ ] Precondition E: `! grep -rq "isWellFormedAccountId" apps/server/src` (guard is new)
- [ ] Working tree clean except this WP

## Locked Values (do not re-derive)
- **UUID-shape guard** — `isWellFormedAccountId(value: string): boolean` in `apps/server/src/identity/identity.logic.ts`. Regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` case-insensitive (general UUID shape — NOT v4-only; the DB lookup is the authority on existence, the guard only rejects obvious garbage without a round-trip). Pure; no I/O.
- **Client discriminator** — `parsePlayerIdentifier(raw)` in `apps/arena-client/src/lib/api/playerIdentifier.ts`: trim → empty `null`; strip ONE leading `@`; UUID-shape (same regex) → `{ kind:'accountId', value }`; else `{ kind:'handle', value }`. Pure; imports nothing from server.
- **Body contract** — `POST /api/me/friends/requests` reads `{ handle?, accountId? }`. Exactly one non-empty: neither → `invalid_request`; both → `invalid_request`. `accountId` branch order: `isWellFormedAccountId` (false → `invalid_request`) → `findPlayerByAccountId` (null → `account_not_found`) → the resolved `targetAccount` enters the EXISTING block → cooldown → rate-limit → `sendFriendRequest` sequence UNCHANGED.
- **New error code `account_not_found`** — add to ALL **FIVE** drift sites in lockstep: (1) server `FriendApiErrorCode` union, (2) server `FRIEND_API_ERROR_CODES` array, (3) the server route-test's own hardcoded `expected` code-set in `friendships.routes.test.ts` (~line 240 — the suite goes red if this one is missed), (4) client `FRIEND_API_ERROR_CODES` mirror in `friendsApi.ts`, (5) client `expectedServerUnion` copy in `friendsApi.test.ts`. `statusForFriendApiErrorCode('account_not_found') → 404` (add to the existing 404 branch with `handle_not_found`; the default fallthrough is 409).
- **`sendFriendRequest(authToken, target)`** — `target: { handle: string } | { accountId: string }`; body is `{ handle }` or `{ accountId }` accordingly. The existing exported **`add(raw)`** in `useFriends.ts` (the ONLY caller; there is no `sendRequest`) parses `raw` via `parsePlayerIdentifier` (null → the existing invalid-input inline path, NO network call) then passes the target. `FriendsSection.vue` already trims + strips a leading `@` before calling `add`, so `add` receives a bare handle or a UUID — do NOT add a second strip/trim.
- **UI copy** — input placeholder/label "@handle or Account ID"; `account_not_found` → "No player with that Account ID." (distinct from `handle_not_found` → "No player with that handle.").

## Guardrails
- **FR-2 is untouched.** Do NOT add `accountId` to any response, `FriendSummary`, or render path. This WP is input-only. The existing no-`accountId`-on-the-wire test MUST stay green.
- Reuse, don't fork: the accountId path differs from the handle path ONLY in the resolver call; everything after `targetAccount` is the existing block/cooldown/rate-limit + `sendFriendRequest` — do not duplicate or reorder it.
- No self-add guard: `sendFriendRequest` already returns `self_friendship` when requester == target; do not add a second check.
- Pure helpers stay pure: `isWellFormedAccountId` and `parsePlayerIdentifier` do no I/O and import no cross-layer code.
- Zero determinism/persistence surface; no `G`/RNG/replay/hash; no re-pin (N/A). No schema migration (no new column).
- If any of {new contract file, response-shape change, a second endpoint, determinism/persistence surface, engine/registry/data edit, scope ambiguity} arises → STOP and re-scope (do not absorb match-invites — that path was dropped as redundant).

## Required `// why:` Comments
- On the both/neither `invalid_request` branch (why: exactly one identifier is accepted; supplying both is ambiguous, neither is empty — 400 before any resolution).
- On `isWellFormedAccountId`'s use before `findPlayerByAccountId` (why: reject malformed input as `invalid_request` without a DB round-trip; the lookup is the authority on existence, not the guard).
- On the `account_not_found` branch (why: a well-formed but unknown AccountId is a not-found the client renders as inline copy — distinct from `invalid_request`/malformed).

## Files to Produce
- `apps/server/src/identity/identity.logic.ts` — **mod** — `isWellFormedAccountId` (+ `identity.logic.test.ts` units: valid UUID any-case true; empty/handle/short/long/non-hex false)
- `apps/server/src/friendships/friendships.routes.ts` — **mod** — accountId branch + `account_not_found` union/array/status (+ `friendships.routes.test.ts`: accountId 201 / malformed→`invalid_request` / unknown→`account_not_found` / both→`invalid_request` / neither→`invalid_request` / self-by-own-UUID→`self_friendship`; drift array assertion still green)
- `apps/arena-client/src/lib/api/playerIdentifier.ts` — **new** — `parsePlayerIdentifier` (+ `.test.ts`: UUID / `@jeff` / `jeff` / empty / whitespace)
- `apps/arena-client/src/lib/api/friendsApi.ts` — **mod** — mirror `account_not_found`; `sendFriendRequest(authToken, target)` (+ `friendsApi.test.ts`: drift copy updated; `{accountId}` body path; `account_not_found`→typed code)
- `apps/arena-client/src/composables/useFriends.ts` — **mod** — the existing `add(raw)` gains parse routing (+ `useFriends.test.ts`: UUID→`{accountId}`, handle→`{handle}`, unparseable→no call + inline invalid)
- `apps/arena-client/src/components/FriendsSection.vue` — **mod** — input placeholder/label copy + `friendMessageForCode` gains `account_not_found`; no handler change (already trims/strips) (+ `FriendsSection.test.ts`: paste UUID sends `{accountId}`; not-found message renders)
- `docs/ai/REFERENCE/api-endpoints.md` — **mod** — `POST /api/me/friends/requests` row (D-11804 whole-row; add `accountId` to request schema; Status `Wired`, Auth `authenticated-session-required`)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` / `NUMBER-LEDGER.md` / `DECISIONS.md` — **mod** — governance close

## After Completing
- [ ] `isWellFormedAccountId` + `parsePlayerIdentifier` units green; both drift tests green with `account_not_found`
- [ ] Route tests: accountId 201 asserts the resolved target `AccountId`; all four error paths return the locked code/status; FR-2 no-`accountId`-on-the-wire test still green
- [ ] Component test: pasting a UUID sends `{accountId}`; the not-found message renders; a handle still sends `{handle}`
- [ ] In-browser (localhost): paste a real Account ID → request; a random UUID → "No player with that Account ID."; an @handle → works
- [ ] `pnpm -r build` + `pnpm --filter @legendary-arena/server test` + `pnpm --filter @legendary-arena/arena-client test` exit 0; coverage holds
- [ ] `git diff --name-only | grep -vE '<the WP-504 allowlist regex>'` → NO MATCH
- [ ] api-endpoints.md row replaced; STATUS/WORK_INDEX/EC_INDEX flipped; NUMBER-LEDGER RESERVED→LANDED; D-24308 Active; ROADMAP node `✅` + counts refreshed
- [ ] Commit prefix: `EC-539:` (code) + `SPEC:` (governance); D-24026 live-verify add-by-Account-ID on the deployed Friends section (operator-pending)

## Common Failure Smells
- Drift test goes red → you added `account_not_found` to fewer than all FIVE sites (server union, server array, **the server route-test's `expected` set**, client mirror, client `expectedServerUnion`). All five, or none. The server route-test set (~`friendships.routes.test.ts:240`) is the most-missed one.
- Note (pre-existing, do NOT fix here): the client mirror + `expectedServerUnion` already lag the server union by three WP-355 codes (`blocked`/`rate_limited`/`request_cooldown`). The client drift test only self-checks (mirror vs hardcoded copy), so it stays green regardless. Adding `account_not_found` to the two client sites keeps them consistent; the WP-355 gap is a separate spun-off task, out of this WP's scope.
- `account_not_found` returns 409 → you left it in the fallthrough; it must be in the 404 branch beside `handle_not_found`.
- A no-`accountId`-on-the-wire (FR-2) test regressed → you leaked `accountId` into a response; this WP is input-only, revert the projection change.
- Self-by-own-UUID returns 201 → you bypassed `sendFriendRequest`'s `self_friendship` guard; the accountId path MUST funnel through it, not around it.
- The both-fields request creates a friend → you resolved `handle` first without rejecting the ambiguous both-present case up front.
