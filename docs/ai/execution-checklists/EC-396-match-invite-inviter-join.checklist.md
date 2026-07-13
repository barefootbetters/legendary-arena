# EC-396 — Match Invites UI: Inviter Trigger + Join-From-Invite (WP-366)

**Pairs with:** WP-366 · **Reserves:** D-24158 · **Lane:** standard two-session · **Status:** Done 2026-07-12
**Layer:** App (`apps/arena-client`). Completes the deferred WP-360 follow-on (D-24152 §deferred). Client-only; no server change.

## Numbering note
EC renumbered **394 → 396**: WP-362 grabbed EC-394 during its own parallel execution; EC-395 = WP-364. WP-366 / D-24158 (renumbered from WP-365/D-24157, which #699 took first).

## Before Starting
- [x] Baseline on `origin/main` (WP-360 invitee core + WP-358 invite API + WP-363's `PlayViewport` mount all landed). Rebuild `game-engine` + `registry` dist BEFORE `vue-tsc` (the pulled commits added new `UIPending*` UIState fields — stale dist reads as false arena-client type errors).

## Locked Values
- `matchInvitesApi.ts`: add `inviteFriendToMatch(authToken, matchId, handle)` → `POST /api/match/invites` `{matchId, handle}`, 201 → `MatchInviteView`, else `parseMatchInviteFailure`. Only wrapper with a JSON body (sets `Content-Type`). WP-360 wrappers + `MATCH_INVITE_API_ERROR_CODES` mirror **byte-identical**.
- `useMatchInvites.ts`: add `invite(matchId, handle) → Promise<boolean>` (sets `errorCode` on failure). Invitee `load`/`accept`/`decline` byte-identical.
- `InviteFriendControl.vue` (new): mounted once in `PlayViewport`. Self-contained — reads `?match=` + `useAuthStore()` (the `ViewLoadoutButton` idiom), render-gated `v-if="hasMatch && isAuthenticated"`. `@handle` input (leading `@` stripped) + Invite; success clears + confirms; typed per-code copy (`not_friends`/`handle_not_found`/`not_in_match`/`already_invited`/`self_invite`). Reads `?match=` only — never `G`/`UIState`.
- `joinMatchFromInvite.ts` (new, pure): injected `listMatches`/`joinMatch`/`navigate` deps. Find match by `matchID` (absent → `not_joinable`), first open seat `!seat.name` (none → `full`), `joinMatch` → navigate `?match&player&credentials` (the `LobbyView.joinExisting` pattern); list/join throw → `error`.
- `MatchInvitesSection.vue`: Accept → `accept` → `joinMatchFromInvite` (real deps; `navigate = (q)=>{ window.location.search = q; }`); inline join-status line (absent → "no longer available", full → "already full", error → generic retry). New `playerName` prop (owner `displayName`, handle fallback) fed by `MyProfilePage`. Hand-off `acceptedMatchId` removed.

## Guardrails
- [x] No engine/registry-runtime/server/`boardgame.io` import; `MatchInviteView` inline; no `accountId` rendered or sent (FR-2, asserted).
- [x] §23(b) invite/join copy — no match/opponent/win framing.
- [x] Join reuses `lobbyApi.listMatches`/`joinMatch` — no reimplemented join / bgio credential handling beyond forwarding `playerCredentials` into the navigate query.
- [x] No server endpoint / migration / api-catalog change (`POST /api/match/invites` shipped in WP-358).

## Files Produced
- `apps/arena-client/src/lib/api/matchInvitesApi.ts` (+ `.test.ts` — `inviteFriendToMatch` 201 + not_friends 403)
- `apps/arena-client/src/composables/useMatchInvites.ts` (+ `.test.ts` — `invite` success + failure)
- `apps/arena-client/src/lib/joinMatchFromInvite.ts` (+ `.test.ts` — join+navigate / not_joinable / full / list-throw / join-throw)
- `apps/arena-client/src/components/InviteFriendControl.vue` (+ `.test.ts` — render-gate ×2, success+strip-@, not_friends, empty-handle)
- `apps/arena-client/src/components/MatchInvitesSection.vue` (+ `.test.ts` — Accept→absent, Accept→full)
- `apps/arena-client/src/pages/PlayViewport.vue` (mount), `apps/arena-client/src/pages/MyProfilePage.vue` (`:player-name`)

## After Completing
- [x] `arena-client` typecheck (vue-tsc) 0; `arena-client` test **899/899** / 0 skipped; `pnpm -r build` 0.
- [x] D-24158 → Active; WORK_INDEX WP-366 `[x]`; EC_INDEX row; STATUS; wiki charter (WP-366 link); mindmap 📝→✅ + `roadmap:counts:write`.
- [ ] D-24026 operator-pending on deploy: in a live match, invite a friend by `@handle` → they see it on `?route=me` → Accept drops them into the match.

## Common Failure Smells
- Stale engine dist → false `UIPending*` type errors (rebuild first, not a regression).
- A test `fetch` stub without `ok` → `listMatches`/`joinMatch` throw (they branch on `response.ok`, not status).
- Clicking a `type=submit` button in jsdom doesn't fire form submit → trigger `submit` on the `<form>`.
- Auth-gated control mounted before the token is set → not in DOM (set token before mount, or use a reactive computed gate).
