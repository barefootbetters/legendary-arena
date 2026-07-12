# WP-366 — Match Invites UI: Inviter Trigger + Join-From-Invite (Arena Client)

**Status:** Draft 2026-07-12 · **READY (not blocked — all hard-deps Done)** · **Standard two-session lane** (extends two WP-360 contract-adjacent files + a new play-view control + upgrades the Accept flow + a user-visible surface). Pairs with **EC-394** (execution-prep). Reserves **D-24158** (lands at execution).
**Primary Layer:** App (`apps/arena-client`)
**User-Visible Surface:** `play.legendary-arena.com` — an "Invite a friend" control in the **in-match play view** + a **real one-click Join** on the `?route=me` game-invites panel. **D-24026 live-verify APPLIES.**
**Dependencies:** WP-360 (the invitee-core `matchInvitesApi` / `useMatchInvites` / `MatchInvitesSection`) ✅ **Done (PR #697)**; WP-358 (the `/api/match/invites` + accept endpoints) ✅; the client lobby (`lobbyApi.listMatches` / `joinMatch`, `PlayViewport`) ✅. **No unmerged dependency — executable now.**
**Baseline:** `origin/main` @ (capture at execution).

---

## Goal

Complete the match-invite UX that WP-360 deferred: (1) the **inviter side** — a small "Invite a friend" control in the **in-match play view** (`PlayViewport`, which holds the `matchId`, D-16501) so a seated player can invite an accepted friend by `@handle` mid-match; and (2) the **full join-from-invite** — upgrade the `?route=me` game-invites panel's **Accept** from a lobby hand-off message into a real one-click join: accept the invite, find the match's first open seat via the existing `lobbyApi.listMatches`, and `joinMatch` → navigate into play. Both reuse existing primitives (the WP-358 invite API, `lobbyApi.listMatches`/`joinMatch`) — no server change, no new join mechanics.

---

## User-Visible Impact

While playing a match, a player sees an "Invite a friend" box (type `@handle` → Invite; typed errors render inline — "You're not friends", "No player with that handle", "You must be in the match to invite", "Already invited"). On `?route=me`, clicking **Accept** on a pending game invite now **drops the player straight into that match** (or shows "This match is no longer joinable" if it ended or filled) instead of telling them to go to the Lobby.

---

## Assumes

- **WP-360's invitee core is on `main`.** `matchInvitesApi.ts` exports `fetchMatchInvites`/`acceptMatchInvite`/`declineMatchInvite` + the inline `MatchInviteView` + the client `MATCH_INVITE_API_ERROR_CODES` mirror (which already includes the inviter-side codes `self_invite`/`not_in_match`/`not_friends`/`already_invited`/`handle_not_found`); `useMatchInvites` exposes `invites`/`isLoading`/`errorCode` + `load`/`accept`/`decline`; `MatchInvitesSection.vue` renders the `?route=me` panel. (Verified: WP-360 files on `main`.)
- **`PlayViewport.vue` holds the live `matchId`** (a prop, D-16501) and renders `PlayDesktop`/`PlayMobile` + a shared submission-status HUD — a natural mount point for a small invite control visible in both layouts. (Verified: `PlayViewport.vue:60`.)
- **`lobbyApi` exposes the join primitives.** `listMatches()` → `LobbyMatchSummary[]` (`{ matchID, players: { id, name? }[] }`; an **open** seat has no `name`); `joinMatch(matchID, seatId, playerName, authToken)` → `{ playerCredentials }`; the join+navigate query shape is `?match=<id>&player=<seatId>&credentials=<creds>` (mirrors `LobbyView.joinExisting`). (Verified: `lobbyApi.ts`, `LobbyView.vue:232-269`.)
- **The player's display name is resolvable client-side** for the seat `playerName` (the owner profile `displayName`, or the claimed handle as a fallback). (Verified: `ownerProfileApi.ts` / the auth store.)

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/work-packets/WP-360-match-invite-ui-client.md` — the invitee core this completes; its execution scope note names exactly these two deferred bits.
- `apps/arena-client/src/lib/api/matchInvitesApi.ts` + `composables/useMatchInvites.ts` + `components/MatchInvitesSection.vue` — the WP-360 files this extends/upgrades.
- `apps/arena-client/src/lobby/lobbyApi.ts` (`listMatches` / `joinMatch` / `LobbyMatchSummary`) + `lobby/LobbyView.vue` (`joinExisting` — the seat-pick + join+navigate pattern to reuse).
- `apps/arena-client/src/pages/PlayViewport.vue` — the in-match root that holds `matchId`; where the invite control mounts.

---

## Non-Negotiable Constraints

- ESM; `defineComponent` (D-6512); `.test.ts`; human-style code per `00.6`; JSDoc.
- **Layer isolation** — no engine/registry-runtime/server/`pg`/`boardgame.io` import; reuse the existing `lobbyApi` client wrappers for join (no new match/join mechanics, no bgio credential handling beyond forwarding `playerCredentials` into the navigate query, exactly as `LobbyView.joinExisting` does).
- **Handle-only identity (FR-2).** Show/act on `@handle` + display name; never render or read an `accountId` (the API sends none).
- **Reuse the lobby join path.** Join-from-invite calls `lobbyApi.listMatches` + `lobbyApi.joinMatch` and navigates with the same `?match&player&credentials` query as `joinExisting` — it does NOT reimplement the join.
- **Never throws; typed failure.** The invite wrapper returns `{ ok }|{ ok:false, status, code }`; the play-view control renders friendly per-code copy. **No PvP framing** (§23(b)) — "invite" / "join" only.
- **Join edge cases are handled, not swallowed.** After accept, if the match is absent from `listMatches` (ended/gameover) or has no open seat (full) → a clear "no longer joinable" line, not a silent failure.
- **The invite control does not touch game state** — it reads `matchId` and posts an invite; no `G` / `UIState` / gameplay read or write.

---

## Scope (In)

### A) `matchInvitesApi.ts` (extend — additive)
- Add `inviteFriendToMatch(authToken, matchId, handle)` → `POST /api/match/invites { matchId, handle }` → `201 { MatchInviteView }` (mirrors the `sendFriendRequest` wrapper shape; `parseFailure` reads `body.error`). The client `MATCH_INVITE_API_ERROR_CODES` mirror already covers every inviter code — **no drift-mirror change**. WP-360's three invitee wrappers are byte-identical.

### B) `useMatchInvites.ts` (extend — additive)
- Add `invite(matchId, handle)` → calls `inviteFriendToMatch`, sets `errorCode` on failure, returns `boolean`. The invitee `load`/`accept`/`decline` are byte-identical.

### C) `InviteFriendControl.vue` (new) — the inviter trigger
- A small `defineComponent` control taking `matchId` + `authToken` props: an `@handle` input + "Invite" button calling `useMatchInvites().invite(matchId, handle)`; a leading `@` is stripped; the box clears on success and shows a "Invited!" confirmation; typed per-code copy for `not_friends`/`handle_not_found`/`not_in_match`/`already_invited`/`self_invite`. No `accountId`. §23(b) copy.

### D) `PlayViewport.vue` (modified) — mount the invite control
- Render `<InviteFriendControl :match-id="matchId" :auth-token="…" />` at the shared viewport root (alongside the submission-status HUD), shown only for a live match (`matchId !== ''`) and an authenticated player. No change to `PlayDesktop`/`PlayMobile` or the game board.

### E) `MatchInvitesSection.vue` (modified) — Accept becomes a real join
- Replace the WP-360 accept hand-off with: on Accept, call `accept(matchId)`; on success, `lobbyApi.listMatches()` → find the match by `matchID` → first open seat (`!seat.name`); if the match is absent → "This match is no longer joinable."; if no open seat → "This match is full."; else `lobbyApi.joinMatch(matchId, seatId, playerName, authToken)` and navigate `?match=<id>&player=<seatId>&credentials=<creds>` (the `joinExisting` pattern). `playerName` = the player's `displayName` (owner profile) with the handle as fallback. Decline + the list/empty/error states are unchanged.

### F) Tests
- `matchInvitesApi.test.ts` (extend): `inviteFriendToMatch` 201 happy path + a `not_friends` 403 failure parse.
- `useMatchInvites.test.ts` (extend): `invite` success + failure (`errorCode` set).
- `InviteFriendControl.test.ts` (new): renders; Invite fires the composable; typed error copy; no `accountId`.
- `MatchInvitesSection.test.ts` (extend): Accept → join path (stub `listMatches` + `joinMatch`, assert navigate query); the "no longer joinable" (match absent) + "full" (no open seat) branches.

---

## Out of Scope

- **No server change** — the invite API + accept (WP-358) are unchanged; no new endpoint, migration, or engine touch.
- **No new join mechanics** — reuses `lobbyApi.listMatches` + `joinMatch` + the `joinExisting` navigate query.
- **No lobby-invite trigger** — the invite control lives in the play view (where the `matchId` + a seated player exist), not the lobby.
- **No game-board / `G` / `UIState` change** — the invite control mounts at the viewport root only.
- **No invite rate-limit / cancel-invite UI** — the server enforces friends-only (anti-spam by construction); a cancel-sent-invite affordance is a separate future item.

---

## Files Expected to Change

- `apps/arena-client/src/lib/api/matchInvitesApi.ts` — **modified** (add `inviteFriendToMatch`)
- `apps/arena-client/src/composables/useMatchInvites.ts` — **modified** (add `invite`)
- `apps/arena-client/src/components/InviteFriendControl.vue` — **new**
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** (mount the control)
- `apps/arena-client/src/components/MatchInvitesSection.vue` — **modified** (Accept → real join)
- Tests: `matchInvitesApi.test.ts` + `useMatchInvites.test.ts` + `MatchInvitesSection.test.ts` (extend) + `InviteFriendControl.test.ts` (new)
- Governance: `WORK_INDEX.md` + `DECISIONS.md` (**D-24158**) + `STATUS.md` + `wiki/profile-login.md` + mindmap. `EC_INDEX.md` + EC-394 at execution-prep.

**2 extended wrappers + 1 new component + 1 play-view mount + 1 upgraded component + tests. Standard two-session lane.** No server/engine touch.

---

## Contract

- **New wrapper:** `inviteFriendToMatch(authToken, matchId, handle) → MatchInvitesApiResult<MatchInviteView>`.
- **New composable action:** `useMatchInvites().invite(matchId, handle) → Promise<boolean>`.
- **Locked Values:**

| Key | Value |
|---|---|
| Invite trigger site | `InviteFriendControl` mounted in `PlayViewport` (holds `matchId`, D-16501); live-match + authed only |
| Join-from-invite | accept → `listMatches` (find by `matchID`, first `!seat.name` open seat) → `joinMatch(matchId, seat, playerName, authToken)` → navigate `?match&player&credentials` (the `joinExisting` pattern) |
| `playerName` | the player's owner-profile `displayName`, handle as fallback |
| Join edge cases | match absent from `listMatches` → "no longer joinable"; no open seat → "full" |
| Identity | `@handle` + `displayName` only; no `accountId` (FR-2) |
| Reuse | `lobbyApi.listMatches` + `joinMatch`; no reimplemented join |

---

## Acceptance Criteria

1. `inviteFriendToMatch` posts `{ matchId, handle }` to `/api/match/invites`, returns `MatchInviteView` on 201, and parses `{ error }` on failure; the WP-360 invitee wrappers are byte-identical (**AC-1**).
2. `useMatchInvites().invite(matchId, handle)` calls the wrapper, returns `true`/`false`, and sets `errorCode` on failure (**AC-2**).
3. `InviteFriendControl.vue` mounts in `PlayViewport` for a live authed match, sends an invite for the typed `@handle`, renders typed per-code copy, and surfaces no `accountId` (**AC-3**).
4. `MatchInvitesSection` Accept accepts then joins via `lobbyApi.listMatches` + `joinMatch` and navigates with `?match&player&credentials`; a match absent from `listMatches` → "no longer joinable"; no open seat → "full" (**AC-4**).
5. No engine/registry-runtime/server/`boardgame.io` import; `MatchInviteView` still inline; no `accountId` rendered (**AC-5**).
6. `arena-client` typecheck (vue-tsc) 0 + test green; `pnpm -r build` 0 (**AC-6**).

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client typecheck   # 0
pnpm --filter @legendary-arena/arena-client test        # matchInvite* + InviteFriendControl suites green
Select-String -Path "apps\arena-client\src\lib\api\matchInvitesApi.ts" -Pattern "inviteFriendToMatch"
Select-String -Path "apps\arena-client\src\components\MatchInvitesSection.vue" -Pattern "listMatches|joinMatch"
Select-String -Path "apps\arena-client\src\components\InviteFriendControl.vue","apps\arena-client\src\components\MatchInvitesSection.vue" -Pattern "accountId|boardgame.io|@legendary-arena/game-engine"   # no output
git diff --name-only   # only the allowlist
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `inviteFriendToMatch` + `useMatchInvites().invite` added (WP-360 invitee wrappers byte-identical); `InviteFriendControl.vue` created + mounted in `PlayViewport` (live-match + authed only)
- [ ] `MatchInvitesSection` Accept joins via `lobbyApi.listMatches` + `joinMatch` + navigate; match-absent + full edge cases handled
- [ ] No engine/registry-runtime/server/`boardgame.io` import; `MatchInviteView` inline; no `accountId`; §23(b) copy
- [ ] `arena-client` typecheck (vue-tsc) 0 + test green; `pnpm -r build` 0
- [ ] `DECISIONS.md` **D-24158** landed (Active); `WORK_INDEX` (WP-366) + `STATUS.md` + `wiki` + mindmap updated
- [ ] **User-visible verification (D-24026):** APPLIES. On deployed `play`: in a live match, invite a friend by `@handle` → they see it on `?route=me` → **Accept drops them into the match**. Operator-pending on deploy; proof is the suite + the live click-through.

---

## Vision Alignment

§23 (co-op — invite a friend to play *together*; no PvP framing). NG-1 (an invite/join confers no gameplay advantage). §23(b) copy neutral ("invite"/"join"). No social reputation. Determinism N/A (client surface; the invite control never reads/writes `G`/`UIState`).

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. §5 standard lane (new component + two extended wrappers + upgraded Accept + play-view mount + user-visible); §8 App boundary (reuses `lobbyApi`; no engine/bgio import; `MatchInviteView` inline); §11 all calls attach the bearer token (endpoints authenticated); §15.1 APPLIES (live invite→accept→join click-through); §17 §23(b)+NG-1, determinism N/A; §21 N/A (no server endpoint added). §18 greps target identifiers + no-`accountId`/no-bgio absence checks.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): READY.** All hard-deps Done on `main` (WP-360 invitee core, WP-358 invite API, the lobby `listMatches`/`joinMatch` + `PlayViewport`). No blocker. Scope locked to 2 extended wrappers + 1 new component + 1 mount + 1 upgraded component + tests, single layer.

**Copilot (01.7): PASS.** Failure modes pinned: (a) reimplementing join → **reuse `lobbyApi.listMatches`+`joinMatch`+the `joinExisting` navigate query**; (b) a joined-but-gone match → **match-absent + full edge-case copy, not a silent fail**; (c) `accountId` on screen → **handle-only, asserted**; (d) importing a server/engine type → **inline `MatchInviteView` + isolation grep**; (e) the invite control touching game state → **mounts at the viewport root, reads `matchId` only, no `G`/`UIState`**; (f) PvP framing → **§23(b) copy lock**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24158**: the match-invite inviter-trigger + join-from-invite (the deferred WP-360 follow-on). Locks: (1) an additive `inviteFriendToMatch` wrapper + `useMatchInvites().invite`; (2) `InviteFriendControl.vue` mounted in `PlayViewport` (the in-match root holding `matchId`, D-16501; live-match + authed only; reads `matchId`, never `G`/`UIState`); (3) `MatchInvitesSection` Accept upgraded to a real join via `lobbyApi.listMatches` (first open seat, `!seat.name`) + `joinMatch` + the `joinExisting` `?match&player&credentials` navigate — reusing the lobby path, no reimplemented join; (4) handled join edge cases (match absent → "no longer joinable"; full → "full"); (5) handle-only identity (no `accountId`, FR-2). Client-only; no server/engine change. Drafted 2026-07-12; not yet landed.
