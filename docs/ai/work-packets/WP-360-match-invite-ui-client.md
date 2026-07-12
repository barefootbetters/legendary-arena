# WP-360 — Match Invites UI: Invite a Friend + Pending Invites (Arena Client)

**Status:** Draft 2026-07-11 · **BLOCKED on WP-358** (the four `/api/match/invites` + `/api/me/match-invites` endpoints must be Wired; WP-358 is drafted, not executed). **Standard two-session lane** (new client contract wrapper + new component + a lobby-surface edit + a user-visible surface). Pairs with **EC-390** (execution-prep). Reserves **D-24152** (lands at execution).
**Primary Layer:** App (`apps/arena-client`)
**User-Visible Surface:** `play.legendary-arena.com` — an "Invite a friend" control on the match/lobby surface + a **Pending game invites** list on `?route=me` (Join / Decline). **D-24026 live-verify APPLIES.**
**Dependencies:** **WP-358** (the match-invite API + `MatchInviteView` shape) ⛔ *drafted, not executed*; WP-352 (`friendsApi.ts` / `FriendsSection.vue` client patterns to mirror) ✅ **Done**; the client lobby (`apps/arena-client/src/lobby/LobbyView.vue` + `lobbyApi.ts` — the match create/join + navigate path Join hands off to) ✅.
**Baseline:** `origin/main` @ (capture at execution — **must be after WP-358 merged**).

---

## Goal

Wire WP-358's match-invite API into the client so a player can **invite a friend into their game** and **act on invites they receive**. Two surfaces: an "Invite a friend" control (add by `@handle`) on the match/lobby view where the current `matchId` is known, and a "Pending game invites" list on `?route=me` (mirroring the WP-352 Friends section) with **Join** and **Decline**. Join calls `POST …/accept` (which returns the `matchId`) and hands off to the **existing** lobby join+navigate path — it does not reimplement joining. This is the client follow-on WP-358 named; identity is shown by `@handle`/display name only (the API sends no `accountId`).

---

## User-Visible Impact

In a match/lobby, a player types a friend's `@handle` and clicks "Invite" (typed errors render inline — "You're not friends", "No player with that handle", "You must be in the match to invite"). On `?route=me`, a "Pending game invites" panel lists incoming invites (inviter name + who they are) with **Join** (drops you into that match) and **Decline**.

---

## Assumes

- **WP-358 exposes the four endpoints + `MatchInviteView`.** `POST /api/match/invites {matchId, handle}` → `201 {MatchInviteView}`; `GET /api/me/match-invites` → `200 {invites: MatchInviteView[]}`; `POST /api/me/match-invites/:matchId/accept` → `200 {matchId}`; `POST …/:matchId/decline` → `204`. `MatchInviteView = { matchId, inviterHandle, inviterDisplayName, status, createdAt }` — **no `accountId`**; error body `{ error: MatchInviteErrorCode }`. ⛔ *Not on `main` at draft time — BLOCKED until WP-358 lands.*
- **The WP-352 client API/composable/section pattern is fixed.** `friendsApi.ts` declares wire shapes inline (no server import), `buildApiUrl` + bearer token, `{ ok }|{ ok:false, status, code }`, never throws, client error-code mirror + drift test; `FriendsSection.vue` renders lists with loading/empty/error states via a `useFriends` composable. `matchInvitesApi.ts` / `useMatchInvites` / `MatchInvitesSection.vue` mirror them. (Verified: WP-352 files on `main`.)
- **The lobby owns the current `matchId` + the join+navigate path.** `LobbyView.vue` / `lobbyApi.ts` create/join a match and navigate into play; the invite control reads the current `matchId` from there, and Join reuses this path with the accepted `matchId`. (Verified: `apps/arena-client/src/lobby/`.)
- **`MyProfilePage.vue` mounts section components** (e.g. `FriendsSection`) with the owner `authToken`; `MatchInvitesSection` mounts the same way. (Verified: `MyProfilePage.vue`.)

If WP-358 is not merged, or any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/work-packets/WP-358-match-friend-invite-server.md` — the API this UI calls (`MatchInviteView`, the error codes, accept-returns-`matchId`).
- `apps/arena-client/src/lib/api/friendsApi.ts` (+ `.test.ts`) — the wrapper + drift-mirror pattern to mirror verbatim.
- `apps/arena-client/src/composables/useFriends.ts` + `apps/arena-client/src/components/FriendsSection.vue` — the composable + section pattern for the pending-invites list.
- `apps/arena-client/src/lobby/LobbyView.vue` + `lobbyApi.ts` — where the invite control mounts (current `matchId`) and the join+navigate path Join reuses.
- `apps/arena-client/src/pages/MyProfilePage.vue` — where `MatchInvitesSection` mounts.

---

## Non-Negotiable Constraints

- ESM; `defineComponent` (D-6512); `.test.ts`; human-style code per `00.6`; JSDoc.
- **Layer isolation** — no engine/registry-runtime/server/`pg`/`boardgame.io` import; `MatchInviteView` mirrored inline; client `MATCH_INVITE_ERROR_CODES` mirror + set-equality drift test vs the server union (the `friendsApi` precedent).
- **Handle-only identity (FR-2).** Show `@handle` + display name; never read/show an `accountId` (the API sends none). Assert no `accountId` in rendered output.
- **Join reuses the existing lobby path.** Accept → `POST …/accept` → take the returned `matchId` → call the **existing** lobby join+navigate — no re-implementation of join, no bgio credential handling here.
- **Never throws; typed failure.** Wrappers return `{ ok:false, status, code }`; the UI renders friendly per-code copy. **No PvP framing** (§23(b)) — "invite" / "join" only.
- **Mutate → refetch** (pending-invites list reloads after accept/decline; authoritative, not optimistic).

---

## Scope (In)

### A) `matchInvitesApi.ts` (new) — four `fetch` wrappers mirroring `friendsApi.ts`:
`inviteFriendToMatch(authToken, matchId, handle)` → `MatchInviteView`; `fetchMatchInvites(authToken)` → `MatchInviteView[]`; `acceptMatchInvite(authToken, matchId)` → `{ matchId }`; `declineMatchInvite(authToken, matchId)` → `{ ok:true }`. Inline `MatchInviteView`; client `MATCH_INVITE_ERROR_CODES` mirror + `MatchInviteErrorCode`; `parseFailure` reads `body.error`; never throws.

### B) `useMatchInvites.ts` (new) — reactive `invites` / `isLoading` / `errorCode`; `load()`, `accept(matchId)`, `decline(matchId)` (refetch after); `invite(matchId, handle)` (for the lobby control). Stubbable api for unit tests.

### C) `MatchInvitesSection.vue` (new) — a `?route=me` "Pending game invites" panel (mirrors `FriendsSection`): list incoming invites (inviter `@handle` + display name), **Join** (accept → hand the returned `matchId` to the existing lobby join+navigate) and **Decline**; loading/empty/error states; per-code copy; **no `accountId`** rendered.

### D) `LobbyView.vue` (modified) — an "Invite a friend" control (`@handle` input + button) visible when a `matchId` exists, calling `useMatchInvites().invite(currentMatchId, handle)` with inline typed-error copy (`not_friends` / `handle_not_found` / `not_in_match` / `already_invited`).

### E) `MyProfilePage.vue` (modified) — mount `<MatchInvitesSection :auth-token="authToken" />` (like `FriendsSection`).

### F) Tests — `matchInvitesApi.test.ts` (wrappers + drift + failure parse), `useMatchInvites.test.ts` (state + refetch + invite), `MatchInvitesSection.test.ts` (render + Join/Decline + no-`accountId` assertion), and a `LobbyView` test for the invite control firing `invite`.

---

## Out of Scope

- **No server change** — WP-358 owns the API.
- **No re-implementation of match join** — Join reuses the existing lobby join+navigate path with the accepted `matchId`.
- **No non-friend invite UI** — friends-only per WP-358; sharing a link to a stranger is a separate affordance (not built here).
- **No in-app notification bell / real-time push** — the invites list is fetched (poll/refresh), not pushed.
- **No engine / `G` / gameplay-rules touch** — only the lobby entry point + a profile section.

---

## Files Expected to Change

- `apps/arena-client/src/lib/api/matchInvitesApi.ts` — **new**
- `apps/arena-client/src/composables/useMatchInvites.ts` — **new**
- `apps/arena-client/src/components/MatchInvitesSection.vue` — **new**
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** (invite control)
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** (mount the section)
- `apps/arena-client/src/lib/api/matchInvitesApi.test.ts` — **new**
- `apps/arena-client/src/composables/useMatchInvites.test.ts` — **new**
- `apps/arena-client/src/components/MatchInvitesSection.test.ts` — **new**
- Governance: `WORK_INDEX.md` + `DECISIONS.md` (**D-24152**) + `STATUS.md` + `wiki/profile-login.md`. `EC_INDEX.md` + EC-390 at execution-prep.

**3 new code + 2 edits + 3 tests. Standard two-session lane.** No server/engine touch.

---

## Acceptance Criteria

1. `matchInvitesApi.ts` exports the four wrappers (`buildApiUrl` + bearer, `{ ok }|{ ok:false, status, code }`, never throws); the client `MATCH_INVITE_ERROR_CODES` mirror is set-equal to WP-358's union (drift test) (**AC-1**).
2. `useMatchInvites` `load()` populates `invites`; `accept`/`decline` call the wrapper and refetch; `invite(matchId, handle)` posts and surfaces typed errors (**AC-2**).
3. `MatchInvitesSection.vue` renders incoming invites (inviter `@handle` + display name), Join accepts + hands the returned `matchId` to the existing lobby join+navigate, Decline declines; **no `accountId`** in rendered output (asserted); per-code copy renders (**AC-3**).
4. `LobbyView.vue` shows the invite control when a `matchId` exists and fires `invite`; `MyProfilePage.vue` mounts `MatchInvitesSection` (**AC-4**).
5. No engine/registry-runtime/server/`boardgame.io` import; `MatchInviteView` inline; no join re-implementation (**AC-5**).
6. `arena-client` typecheck 0 + test green; `pnpm -r build` 0 (**AC-6**).

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client typecheck   # 0
pnpm --filter @legendary-arena/arena-client test        # matchInvites suites green
Select-String -Path "apps\arena-client\src\lib\api\matchInvitesApi.ts","apps\arena-client\src\components\MatchInvitesSection.vue" -Pattern "boardgame.io|@legendary-arena/game-engine|@legendary-arena/registry|accountId"   # no output
Select-String -Path "apps\arena-client\src\lib\api\matchInvitesApi.ts" -Pattern "MATCH_INVITE_ERROR_CODES|MatchInviteView"
git diff --name-only   # only the allowlist
```

---

## Definition of Done

- [ ] **WP-358 Done/Wired on `main`** — verified before execution
- [ ] All acceptance criteria pass
- [ ] `matchInvitesApi.ts` (4 wrappers + drift mirror), `useMatchInvites.ts`, `MatchInvitesSection.vue` created; `LobbyView` invite control; `MyProfilePage` mounts the section
- [ ] `@handle` + display name only; no `accountId`; Join reuses the existing lobby join+navigate (no re-implementation)
- [ ] No engine/registry-runtime/server/`boardgame.io` import; `MatchInviteView` inline
- [ ] `arena-client` typecheck 0 + test green; `pnpm -r build` 0
- [ ] `DECISIONS.md` **D-24152** Active; `WORK_INDEX` (WP-360) + `STATUS.md` + `wiki` updated
- [ ] **User-visible verification (D-24026):** APPLIES. On deployed `play`: in a match, invite a friend by `@handle` → they see it on `?route=me` → Join drops them into the match; Decline removes it. Operator-pending on deploy.

---

## Vision Alignment

§23 (co-op — invite a friend to play together; no PvP framing). NG-1 (invite confers no advantage). §23(b) copy neutral ("invite"/"join"). No social reputation. Determinism N/A (client).

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. §5 standard lane (new wrapper contract + component + lobby edit + user-visible); §8 App boundary (no engine import; inline mirror; Join reuses lobby path, no bgio); §11 all calls attach the bearer token (the endpoints are authenticated); §15.1 APPLIES; §21 N/A (no server endpoint added). §18 greps target identifiers + no-`accountId`/no-bgio absence checks.

## Pre-Flight / Copilot (drafter self-review)

**Pre-flight (01.4): NOT READY — BLOCKED on WP-358.** The endpoints aren't on `main`. Merged as a `[ ]` placeholder (01.0a Blocking-drafts), reserving WP-360/EC-390/D-24152. Re-run to READY once WP-358 lands. No other blocker (the WP-352 patterns + the lobby join path are verified).

**Copilot (01.7): PASS (design).** Pinned: (a) reimplementing join → **accept returns `matchId`; reuse the existing lobby join+navigate**; (b) `accountId` on screen → **handle/display only, asserted**; (c) importing the server type → **inline mirror + isolation grep**; (d) silent server-code drift → **set-equality mirror test**; (e) optimistic-state drift → **mutate-then-refetch**; (f) PvP framing → **§23(b) copy lock**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24152**: the match-invites client UI — `matchInvitesApi.ts` (four wrappers mirroring `friendsApi.ts`) + `useMatchInvites` + `MatchInvitesSection.vue` (a `?route=me` pending-invites panel) + an "Invite a friend" control on `LobbyView.vue`. Locks: (1) **handle-only identity** on screen (never `accountId`; the API sends none); (2) **Join reuses the existing lobby join+navigate** with the accept-returned `matchId` (no join re-implementation, no bgio credential handling); (3) a client `MATCH_INVITE_ERROR_CODES` mirror + set-equality drift test; (4) mutate-then-refetch; (5) friends-only (no non-friend invite UI). Drafted 2026-07-11; not yet landed (BLOCKED on WP-358).
