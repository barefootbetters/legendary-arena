# EC-390 — Match Invites UI: Invitee Core (WP-360)

**Pairs with:** WP-360 · **Reserves:** D-24152 · **Lane:** standard two-session · **Status:** execution-prep 2026-07-11
**Layer:** App (`apps/arena-client`).

## Scope decision (D-24152, operator-confirmed 2026-07-11)
Ship the **invitee-side core**; **defer** the inviter-side "Invite a friend" trigger + the full seat-selecting join-from-invite to a follow-on. Rationale (verified in the lobby/play code): `LobbyView` creates→joins→navigates immediately (no persistent `matchId` to invite from — the natural site is the in-match play view), and joining needs `joinMatch(matchID, seatId, playerName, authToken)` → credentials → navigate (not a simple link). On accept, hand the player off to the **Lobby** to join.

## Before Starting
- [ ] Baseline after **WP-358 merged** (`/api/me/match-invites` endpoints Wired). Fresh worktree → `pnpm install` + `pnpm -r build` BEFORE `vue-tsc`.

## Locked Values
- `matchInvitesApi.ts`: `fetchMatchInvites` / `acceptMatchInvite` (returns `{matchId}`) / `declineMatchInvite`; inline `MatchInviteView` (no server import); client `MATCH_INVITE_API_ERROR_CODES` mirror + set-equality drift test vs the WP-358 server union.
- `useMatchInvites.ts`: `invites`/`isLoading`/`errorCode` + `load`/`accept`/`decline` (mutate → refetch).
- `MatchInvitesSection.vue` (`?route=me`, mounted in `MyProfilePage.vue`): list pending invites (inviter `@handle` + displayName, **no `accountId`**), Accept (→ hand-off matchId), Decline; loading/empty/error states.

## Guardrails
- [ ] No engine/registry-runtime/server import; `MatchInviteView` inline. No `accountId` rendered (asserted).
- [ ] §23(b) neutral copy ("invite" / "game" / "join"); no match/opponent/win framing.
- [ ] Rides the API; no join reimplementation here (deferred).

## Files to Produce
- `apps/arena-client/src/lib/api/matchInvitesApi.ts` (+ `.test.ts`)
- `apps/arena-client/src/composables/useMatchInvites.ts` (+ `.test.ts`)
- `apps/arena-client/src/components/MatchInvitesSection.vue` (+ `.test.ts`)
- `apps/arena-client/src/pages/MyProfilePage.vue` (mount)

## After Completing
- [ ] `arena-client` typecheck (vue-tsc) 0 + test green; `pnpm -r build` 0.
- [ ] D-24152 → Active (with the deferred-follow-on scope note); WORK_INDEX WP-360 `[x]`; EC_INDEX + STATUS + wiki + mindmap (📝→✅); backlog line for the inviter-trigger + full-join follow-on.
- [ ] D-24026 operator-pending on deploy (see a pending invite on `?route=me`, Accept/Decline).

## Common Failure Smells
- Importing the server type instead of mirroring inline.
- Reimplementing join in the section (deferred — hand off to Lobby).
- Silent server-code drift (the mirror test guards it).
