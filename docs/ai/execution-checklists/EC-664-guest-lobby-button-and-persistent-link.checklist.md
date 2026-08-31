# EC-664 — "Add Guest" in the Lobby + Persistent Hand-off Link (Execution Checklist)

**Source:** docs/ai/work-packets/WP-629-guest-lobby-button-and-persistent-link.md
**Layer:** App (`apps/arena-client`)

## Before Starting

- [ ] Read `WaitingForPlayersPanel.vue` (WP-628 guest section + `isVisible`) and `LobbyView.vue` (match-seat list + `useAuthStore`).
- [ ] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0 (baseline).

## Locked Values (do not re-derive)

- `buildGuestPlayUrl(matchId, seat, credentials)` in `lobbyApi.ts` → `?match=<id>&player=<seat>&credentials=<cred>` (each `encodeURIComponent`'d); used by lobby + panel.
- Lobby "Add guest": shown only when `authStore.token !== null` on a match with an open seat; **never redirects to login** (hidden when signed out).
- Hand-off **persists until Done**: panel `isVisible` also true while `guestLink !== null`; lobby tracks the active match's link/error, cleared on Done.
- Error copy: `409` → "This match is full — there's no open seat for a guest."; else → "Couldn't add a guest — please try again."
- Hot-seat / physical hand-off only (D-24438).

## Guardrails

- arena-client UI only — no server/engine/contract change; no `G`/`ctx`; no new route/dep.
- SFCs keep `defineComponent({ setup })` (D-6512).
- Guard `navigator.clipboard` / `window.open` (a missing API never throws out of the handler).
- On `addGuest` failure, map by `status` and never re-throw.
- The lobby "Add guest" must NOT call `requireAuthTokenOrRedirectToLogin` (no login redirect) — read `authStore.token` and guard.

## Required `// why:` Comments

- On the panel `isVisible` change: why it stays true while a guest link is set (adding a guest fills the seat, which would auto-hide it).
- On the lobby "Add guest": why it never redirects to login (unlike Join) and is hidden when signed out.
- On the guarded `navigator`/`window.open` calls.

## Files to Produce

- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — `buildGuestPlayUrl`.
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — lobby "Add guest" + inline persistent link.
- `apps/arena-client/src/lobby/LobbyView.test.ts` — **modified** — lobby tests.
- `apps/arena-client/src/components/WaitingForPlayersPanel.vue` — **modified** — persistent link + Done + shared helper.
- `apps/arena-client/src/components/WaitingForPlayersPanel.test.ts` — **modified** — Done-dismiss test.

## After Completing

- [ ] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0
- [ ] D-24026 live-verify on `play.legendary-arena.com`
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)

- The lobby "Add guest" redirects to login → it called `requireAuthTokenOrRedirectToLogin`; read `authStore.token` and guard instead.
- The hand-off link still vanishes → the `isVisible` `|| guestLink !== null` (panel) / active-match tracking (lobby) was not applied.
