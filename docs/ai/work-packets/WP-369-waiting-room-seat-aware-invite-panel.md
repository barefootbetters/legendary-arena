# WP-369 — Pre-Match Waiting Room: Seat-Aware "Waiting for Players" Invite Panel (Arena Client)

**Status:** Draft 2026-07-12 · **READY (not blocked — all hard-deps Done)** · **Standard two-session lane** (a new play-view panel + a poll composable + a lobby deep-link highlight; supersedes WP-366's corner control; user-visible surface). Pairs with an EC (authored at execution-prep). Reserves **D-24163** (lands at execution).
**Primary Layer:** App (`apps/arena-client`)
**User-Visible Surface:** `play.legendary-arena.com` — a "Waiting for players" panel in the in-match view while seats are open; `lobby` gains a one-line match-highlight from the copied join link. **D-24026 live-verify APPLIES.**
**Dependencies:** WP-366 (the `useMatchInvites().invite` + `inviteFriendToMatch` plumbing + the `PlayViewport` mount point) ✅ **Done (PR #709)**; the client lobby (`lobbyApi.listMatches`, `LobbyView`) ✅. **No unmerged dependency — executable now.**
**Baseline:** `origin/main` @ (capture at execution).

---

## Goal

Give a host who is waiting for other players a real waiting-room experience **inside the play view** (Option chosen 2026-07-12 over a dedicated new route). Today a host who creates an N-seat match lands straight in the play view and the game stalls until others join, with only WP-366's small always-on corner "Invite a friend" control. This WP replaces that corner control with a **seat-aware "Waiting for players" panel** that appears only while the match has open seats, shows how many seats remain, invites a friend by `@handle` (reusing the WP-366 plumbing), offers a **copy-join-link**, and auto-hides once the match fills.

---

## User-Visible Impact

While a match still has an open seat, the host sees a panel: **"Waiting for players — 1 of 2"**, the open-seat indicator, an `@handle` invite input (Invite), and a **Copy join link** button. Sending an invite reuses the WP-366 friends-invite flow (the friend Accepts on `?route=me` → drops into the match). Copying the link yields a lobby URL that opens the lobby with this match highlighted for a one-click join. When the last seat fills, the panel disappears on its own.

---

## Assumes

- **WP-366 is on `main`.** `matchInvitesApi.ts#inviteFriendToMatch`, `useMatchInvites().invite`, and the `PlayViewport` mount point exist; `InviteFriendControl.vue` is mounted **only** in `PlayViewport` (verified). Its durable value is the API/composable layer, not the corner presentation.
- **`lobbyApi.listMatches()` reports seat occupancy.** Returns `LobbyMatchSummary[]` = `{ matchID, players: { id, name? }[], gameover }`; an **open** seat has no `name` (the same open-seat rule `joinMatchFromInvite` uses). The list endpoint needs no auth. (Verified.)
- **The bgio client wrapper does NOT surface `matchData`.** `bgioClient.ts`'s subscribe delivers only `{ G, isConnected, _stateID }` to the UI (WP-090/311) — player-join status is not exposed. So seat-fill is polled from `listMatches`, not read from the transport. (Verified — extending the transport is explicitly out of scope.)
- **`?match=` is present in the in-match view** and carries the live `matchId` (D-16501). (Verified.)

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/work-packets/WP-366-match-invite-inviter-trigger-and-join.md` + `apps/arena-client/src/components/InviteFriendControl.vue` — the corner control this supersedes; its `useMatchInvites().invite` plumbing is reused unchanged.
- `apps/arena-client/src/lib/joinMatchFromInvite.ts` — the open-seat rule (`typeof seat.name !== 'string'`) and `lobbyApi.listMatches` usage to mirror.
- `apps/arena-client/src/lobby/lobbyApi.ts` (`listMatches` / `LobbyMatchSummary`) + `lobby/LobbyView.vue` (the match list + `joinExisting`; where the copy-link highlight lands).
- `apps/arena-client/src/pages/PlayViewport.vue` — the in-match root that mounts the panel (holds `matchId`, D-16501).
- `apps/arena-client/src/components/ViewLoadoutButton.vue` — the self-contained `?match=` + `useAuthStore()` read idiom to follow.

---

## Non-Negotiable Constraints

- ESM; `defineComponent` (D-6512); `.test.ts`; human-style code per `00.6`; JSDoc.
- **Layer isolation** — no engine/registry-runtime/server/`pg`/`boardgame.io` import; reuse `lobbyApi.listMatches` + `useMatchInvites().invite`. **No change to `bgioClient.ts` / the WP-090/311 transport** (seat-fill is polled, not read from `matchData`).
- **Handle-only identity (FR-2).** Invite acts on `@handle` + display name; never render or read an `accountId`.
- **Reuse the WP-366 invite flow.** The panel's invite calls `useMatchInvites().invite` (→ `inviteFriendToMatch`, `POST /api/match/invites`) — no new invite mechanic, no server change.
- **Seat-gated visibility.** The panel renders only for a live authed match with **≥1 open seat**; it auto-hides at 0 open seats (full) or when the match is no longer listed. A 1-seat (solo) match never shows it.
- **Polling is bounded and cleaned up.** The seat poll runs only while the panel is open, on a fixed interval (locked value), and is cleared on full/gone/unmount. No poll after the match fills.
- **Copy-link carries no secret.** The join link is `${origin}/?route=lobby&match=<matchId>` — a public lobby deep-link (matches are already publicly joinable via the lobby); it contains **no** bearer/credentials/seat.
- **Never throws; typed failure.** Invite failures render the WP-366 typed per-code copy; a failed seat poll leaves the last-known status (never blanks the panel mid-wait). §23(b) co-op copy ("waiting" / "invite" / "join") — no PvP framing.

---

## Scope (In)

### A) `useMatchSeatStatus.ts` (new composable)
- Polls `lobbyApi.listMatches()` on a fixed interval, finds the match by `matchId`, and exposes reactive `{ totalSeats, openSeats, isFull, isPresent }` (open = seats with no `name`). Starts on mount, stops when `isFull` / not present / on unmount. A failed poll preserves the last snapshot. No auth, no bgio import.

### B) `WaitingForPlayersPanel.vue` (new) — supersedes `InviteFriendControl.vue`
- Self-contained (`?match=` + `useAuthStore()`, the `ViewLoadoutButton` idiom). Renders only when authed, live match, and `openSeats > 0`. Shows: "Waiting for players — {filled} of {total}" + open-seat line; an `@handle` invite input + Invite (reusing `useMatchInvites().invite` + typed per-code copy, leading `@` stripped, success clears + confirms); a **Copy join link** button writing `${origin}/?route=lobby&match=<matchId>` to the clipboard with a brief "Link copied" confirmation. Auto-hides when `isFull`.

### C) `PlayViewport.vue` (modified)
- Replace the `<InviteFriendControl />` mount with `<WaitingForPlayersPanel />` (same shared-viewport-root placement, D-16501).

### D) Retire `InviteFriendControl.vue` + `InviteFriendControl.test.ts`
- Superseded by the panel (its only mount was `PlayViewport`). The durable invite plumbing (`inviteFriendToMatch`, `useMatchInvites().invite`) is **unchanged**; update the `matchInvitesApi.ts` doc comment to name `WaitingForPlayersPanel` instead of `InviteFriendControl`.

### E) `LobbyView.vue` (modified — minimal deep-link highlight)
- On mount, read `?match=<id>`; if it matches a joinable match, sort/scroll that row to the top and apply a highlight class (pre-select for one-click `joinExisting`). One param read + one computed/ref + a scroll-into-view; no change to `joinExisting` or the join contract.

### F) Tests
- `useMatchSeatStatus.test.ts` (new): counts open seats from a stubbed `listMatches`; reports `isFull` when all named; preserves last snapshot on a failed poll; stops polling at full.
- `WaitingForPlayersPanel.test.ts` (new): render-gate (no `?match=`, guest, full → hidden); seat-status text; Invite fires the composable + typed error copy; Copy-link writes the `?route=lobby&match=` URL; no `accountId`.
- `LobbyView.test.ts` (extend): `?match=<id>` highlights + orders the matching row.

---

## Out of Scope

- **No dedicated waiting-room route/surface** (Option "dedicated room" was declined 2026-07-12 — this is the play-view waiting state).
- **No `bgioClient.ts` / transport change** — seat-fill is polled from `listMatches`; boardgame.io `matchData` is deliberately not plumbed to the UI here.
- **No new server endpoint / migration** — reuses the WP-358 invite API + the lobby list.
- **No game-start / auto-start gating change** — the engine already runs; this only surfaces the wait + invite. No "Start game" button.
- **No auto-join from the copy-link** — the recipient still explicitly joins an open seat in the lobby (matches are already publicly joinable; the link only pre-selects one).

---

## Files Expected to Change

- `apps/arena-client/src/composables/useMatchSeatStatus.ts` — **new** (+ `.test.ts`)
- `apps/arena-client/src/components/WaitingForPlayersPanel.vue` — **new** (+ `.test.ts`)
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** (swap the mount)
- `apps/arena-client/src/components/InviteFriendControl.vue` + `InviteFriendControl.test.ts` — **deleted** (superseded)
- `apps/arena-client/src/lib/api/matchInvitesApi.ts` — **modified** (doc comment only)
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** (deep-link highlight) (+ `LobbyView.test.ts` extend)
- Governance: `WORK_INDEX.md` + `DECISIONS.md` (**D-24163**) + `STATUS.md` + `wiki/profile-login.md` + mindmap. `EC_INDEX.md` + EC at execution-prep.

**2 new (panel + poll composable) + 1 mount swap + 1 supersede-delete + 1 lobby highlight + tests. Standard two-session lane.** No server/engine/transport touch.

---

## Contract

- **New composable:** `useMatchSeatStatus(matchId) → { totalSeats, openSeats, isFull, isPresent }` (reactive; polls `listMatches`).
- **Locked Values:**

| Key | Value |
|---|---|
| Panel visibility | authed + live `?match=` + `openSeats > 0`; auto-hide at `isFull` |
| Seat source | poll `lobbyApi.listMatches()` (find by `matchID`, open = `!seat.name`) — no `matchData`/transport read |
| Poll interval | fixed constant (locked at execution; ~5s), cleared on full/gone/unmount |
| Invite | `useMatchInvites().invite` (WP-366) — no new mechanic |
| Copy-link | `${origin}/?route=lobby&match=<matchId>` — no secret |
| Identity | `@handle` + display name only; no `accountId` (FR-2) |
| Supersedes | `InviteFriendControl.vue` deleted; invite plumbing reused |

---

## Acceptance Criteria

1. `useMatchSeatStatus` reports `openSeats`/`isFull` from `listMatches`, preserves the last snapshot on a failed poll, and stops polling at full (**AC-1**).
2. `WaitingForPlayersPanel` renders only for an authed live match with an open seat; shows "{filled} of {total}"; auto-hides when full; surfaces no `accountId` (**AC-2**).
3. The panel's Invite calls `useMatchInvites().invite` and renders the WP-366 typed per-code copy on failure (**AC-3**).
4. Copy-link writes `${origin}/?route=lobby&match=<matchId>` (no bearer/credentials) and confirms (**AC-4**).
5. `InviteFriendControl.vue` + its test are removed; `PlayViewport` mounts `WaitingForPlayersPanel`; the invite plumbing (`inviteFriendToMatch` / `useMatchInvites().invite`) is byte-unchanged (**AC-5**).
6. `LobbyView` highlights + orders the `?match=<id>` row without changing `joinExisting` (**AC-6**).
7. No engine/registry/server/`boardgame.io` import; no `bgioClient.ts` change (**AC-7**).
8. `arena-client` typecheck (vue-tsc) 0 + test green; `pnpm -r build` 0 (**AC-8**).

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client typecheck   # 0
pnpm --filter @legendary-arena/arena-client test        # WaitingForPlayersPanel + useMatchSeatStatus + LobbyView suites green
Select-String -Path "apps\arena-client\src\components\WaitingForPlayersPanel.vue" -Pattern "listMatches|useMatchInvites|route=lobby"
git status --porcelain | Select-String "InviteFriendControl"   # shows deletions
Select-String -Path "apps\arena-client\src\components\WaitingForPlayersPanel.vue","apps\arena-client\src\composables\useMatchSeatStatus.ts" -Pattern "accountId|boardgame.io|@legendary-arena/game-engine|bgioClient"   # no output
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `useMatchSeatStatus` + `WaitingForPlayersPanel` created; `PlayViewport` swapped; `InviteFriendControl.vue` + test deleted; `matchInvitesApi` doc comment updated; `LobbyView` deep-link highlight added
- [ ] Invite reuses `useMatchInvites().invite` (plumbing byte-unchanged); no bgio-transport change; no `accountId`; §23(b) copy
- [ ] `arena-client` typecheck (vue-tsc) 0 + test green; `pnpm -r build` 0
- [ ] `DECISIONS.md` **D-24163** landed (Active); `WORK_INDEX` (WP-369) + `STATUS.md` + `wiki` + mindmap updated
- [ ] **User-visible verification (D-24026):** APPLIES. On deployed `play`: create a 2-seat match → the panel shows "1 of 2" + invite + copy-link → invite a friend → they Accept → panel disappears when the seat fills. Operator-pending on deploy; proof is the suite + the live walk-through.

---

## Vision Alignment

§23 (co-op — invite a friend to play *together* while waiting; no PvP framing). NG-1 (waiting/inviting confers no gameplay advantage). §23(b) copy neutral. Determinism N/A (client surface; the panel never reads/writes `G`/`UIState` — it reads `?match=` + polls the public lobby list).

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. §5 standard lane (2 new + swap + supersede-delete + lobby highlight + user-visible); §8 App boundary (reuses `lobbyApi` + `useMatchInvites`; no engine/bgio/transport import); §11 the invite attaches the bearer via the reused wrapper; the lobby list needs none; §15.1 APPLIES (live create→wait→invite→fill walk-through); §17 §23+NG-1, determinism N/A; §21 N/A (no server endpoint added). §18 greps target `listMatches`/`useMatchInvites`/`route=lobby` + the no-`accountId`/no-bgio absence checks + the `InviteFriendControl` deletion.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): READY.** All hard-deps Done on `main` (WP-366 plumbing + mount; the lobby list). No blocker. Scope is a single layer (arena-client), single surface primary (play view) + one small lobby highlight.

**Copilot (01.7): PASS.** Failure modes pinned: (a) reaching for `matchData` → **poll `listMatches`; no transport change**; (b) a poll that never stops → **bounded interval, cleared on full/gone/unmount**; (c) a secret in the copy-link → **public lobby deep-link only, no bearer/seat**; (d) two invite UIs on screen → **retire `InviteFriendControl`; the panel is the sole invite surface**; (e) `accountId` on screen → **handle-only, asserted**; (f) the panel touching game state → **reads `?match=` + the public list only, never `G`/`UIState`**; (g) PvP framing → **§23(b) copy lock**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24163**: the pre-match waiting-room seat-aware invite panel (play-view waiting state; the dedicated-room surface was declined). Locks: (1) a `WaitingForPlayersPanel.vue` mounted in `PlayViewport` that renders only for an authed live match with ≥1 open seat and auto-hides when full; (2) seat-fill via a new `useMatchSeatStatus` composable that **polls `lobbyApi.listMatches()`** (open = `!seat.name`) on a bounded interval — **no `bgioClient.ts`/transport change**, boardgame.io `matchData` deliberately not plumbed to the UI; (3) the invite reuses WP-366's `useMatchInvites().invite` (no new mechanic/server change) and **supersedes `InviteFriendControl.vue`**, which is deleted (plumbing retained); (4) a copy-join-link = `${origin}/?route=lobby&match=<matchId>` (public deep-link, no secret) + a minimal `LobbyView` highlight of that match (no auto-join, `joinExisting` unchanged); (5) handle-only identity (no `accountId`, FR-2), §23(b) copy. Client-only; no server/engine/transport change. Drafted 2026-07-12; not yet landed.
