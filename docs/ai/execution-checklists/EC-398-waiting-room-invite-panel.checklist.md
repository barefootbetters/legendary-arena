# EC-398 — Pre-Match Waiting Room: Seat-Aware "Waiting for Players" Invite Panel (WP-369)

**Pairs with:** WP-369 · **Reserves:** D-24163 · **Lane:** standard two-session · **Status:** execution-prep 2026-07-13
**Layer:** App (`apps/arena-client`). Client-only; no server/engine/transport change, no migration.

## Numbering note
EC-398 (EC-397 = WP-367/#712). WP-369 / D-24163 renumbered from WP-367/D-24159 (#712 staked 367/368 + D-24159..62 first).

## Before Starting
- [ ] Baseline on `origin/main`. **Rebuild `game-engine` + `registry` dist BEFORE `vue-tsc`** (WP-356/#711 changed the engine; arena-client imports built dist → stale dist reads as false type errors).

## Locked Values
- `useMatchSeatStatus.ts` (new): `useMatchSeatStatus(matchId) → { totalSeats, openSeats, isFull, isPresent }` reactive. Polls `lobbyApi.listMatches()` (find by `matchID`; open seat = `typeof seat.name !== 'string'`) on a fixed `SEAT_POLL_INTERVAL_MS` (~5000). Starts on mount; **stops** when `isFull` / not present / on unmount. A **failed poll preserves the last snapshot** (never blanks). No auth, no bgio/engine import.
- `WaitingForPlayersPanel.vue` (new): self-contained (`?match=` via `URLSearchParams` + `useAuthStore()`, the `ViewLoadoutButton` idiom). Renders only when `hasMatch && isAuthenticated && openSeats > 0`; auto-hides at `isFull`. Shows "Waiting for players — {filled} of {total}" + open-seat line; `@handle` invite (leading `@` stripped, empty ignored) via `useMatchInvites().invite` + typed per-code copy (reuse the WP-366 message map: `not_friends`/`handle_not_found`/`not_in_match`/`already_invited`/`self_invite`); success clears + confirms; a **Copy join link** button writing `${window.location.origin}/?route=lobby&match=<matchId>` to the clipboard + brief "Link copied". `defineComponent` (D-6512).
- `PlayViewport.vue`: swap `<InviteFriendControl />` → `<WaitingForPlayersPanel />` (same shared-root placement, D-16501; import + `components:` + template).
- `InviteFriendControl.vue` + `.test.ts`: **deleted** (only mount was PlayViewport). `matchInvitesApi.ts` doc comment: `InviteFriendControl` → `WaitingForPlayersPanel`. Invite plumbing (`inviteFriendToMatch` / `useMatchInvites().invite`) **byte-unchanged**.
- `LobbyView.vue`: read `?match=<id>` on mount → `highlightMatchId`; an `orderedMatches` computed puts the highlighted joinable match first; `<li class="match-row">` gets `match-row--highlight` when `match.matchID === highlightMatchId`; defensive `scrollIntoView` after `refreshMatches` (guard `typeof … === 'function'` for jsdom). `joinExisting` + the join contract **unchanged**.

## Guardrails
- [ ] No engine/registry-runtime/server/`pg`/`boardgame.io` import; **no `bgioClient.ts` change** (seat-fill polled, `matchData` not plumbed).
- [ ] No `accountId` rendered or sent (FR-2, asserted). §23(b) co-op copy ("waiting"/"invite"/"join") — no match/opponent/win framing.
- [ ] Copy-link carries no bearer/credentials/seat — only `?route=lobby&match=<id>`.
- [ ] Invite reuses `useMatchInvites().invite`; no new invite mechanic / server endpoint / migration.
- [ ] Panel never reads/writes `G`/`UIState`.

## Files to Produce
- `apps/arena-client/src/composables/useMatchSeatStatus.ts` (+ `.test.ts`)
- `apps/arena-client/src/components/WaitingForPlayersPanel.vue` (+ `.test.ts`)
- `apps/arena-client/src/pages/PlayViewport.vue` (swap mount)
- DELETE `apps/arena-client/src/components/InviteFriendControl.vue` + `.test.ts`
- `apps/arena-client/src/lib/api/matchInvitesApi.ts` (doc comment)
- `apps/arena-client/src/lobby/LobbyView.vue` (deep-link highlight) (+ `LobbyView.test.ts` extend)

## Tests
- `useMatchSeatStatus.test.ts`: counts open seats from stubbed `listMatches`; `isFull` when all named; preserves last snapshot on a failed poll; stops polling at full.
- `WaitingForPlayersPanel.test.ts`: render-gate (no `?match=` / guest / full → hidden); seat-status text; Invite fires the composable + typed error copy; Copy-link writes `?route=lobby&match=`; no `accountId`.
- `LobbyView.test.ts` (extend): `?match=<id>` highlights + orders the matching row first.

## After Completing
- [ ] `arena-client` typecheck (vue-tsc) 0 + test green; `pnpm -r build` 0.
- [ ] D-24163 → Active; WORK_INDEX WP-369 `[x]`; EC_INDEX EC-398 row; STATUS; wiki charter (drafted → executed); mindmap 📝→✅ + `roadmap:counts:write`.
- [ ] D-24026 operator-pending on deploy (create a 2-seat match → panel "1 of 2" + invite/copy-link → friend joins → panel auto-hides).

## Common Failure Smells
- Stale engine dist → false arena-client `vue-tsc` errors (rebuild first, not a regression).
- A test `fetch` stub without `ok:` → `listMatches` throws (branches on `response.ok`, not status).
- Auth-gated control mounted before token set → absent from DOM (set token before mount, or reactive computed gate).
- A poll timer not cleared on unmount/full → leaked interval; guard it.
- `scrollIntoView` unimplemented in jsdom → guard `typeof`.
- Reaching for `matchData`/`bgioClient` → poll `listMatches` instead (transport is out of scope).
