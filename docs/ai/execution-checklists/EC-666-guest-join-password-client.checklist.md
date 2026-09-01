# EC-666 — Guest Password: Host Set-UI + Guest Join-by-Password (Client) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-631-guest-join-password-client.md
**Layer:** App (`apps/arena-client`)

## Before Starting

- [ ] **WP-630 must be merged** (the endpoints + meta this consumes). Confirm on `main`.
- [ ] Read `LobbyView.vue` (match list + create flow + the WP-629 guest idioms) and `lobbyApi.ts` (`addGuest`/`joinMatch` wrapper shapes + `buildGuestPlayUrl`).
- [ ] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0 (baseline).

## Locked Values (do not re-derive)

- Wrappers in `lobbyApi.ts`: `setGuestAccess(matchId, { gameName, password }, authToken)` (host bearer); `joinAsGuest(matchId, password)` (no auth) → `{ matchId, seat, credentials }`; `readGuestAccessMeta(matchId)` → `{ gameName, hasGuestPassword }`. Full-sentence `Error` with `status` on non-2xx (except `readGuestAccessMeta`, which swallows failure → `{ null, false }`).
- **Request bodies use `matchId` (lowercase-d), mirroring `addGuest` — NOT `joinMatch`'s `matchID`.** The server reads `matchId`; the wrong casing is a silent 400.
- Host set-UI is **edit-control-only** in the lobby row of a match the host is **seated in** (not a create-form field — the create flow navigates away and `set-guest-access` 403s until seated).
- Guest join navigates via **`window.location.href = buildGuestPlayUrl(...)`** — that helper returns a FULL absolute URL, so `window.location.search` (the `joinExisting` idiom) would be malformed.
- "Join as guest" shows ONLY where `hasGuestPassword` is true **AND `players.some(isOpenSeat)`** (mirror the WP-629 "Add guest" gate); it is NOT the account-holder "Join" (unchanged; still login-gated).
- The row display name falls back to `matchID` when the meta `gameName` is null/empty.
- Password input is write-only (never render a stored password).
- Error copy: 401 → wrong password; 429 → "too many tries, wait a moment"; 409 → "couldn't join — the game may have just filled or the password was removed"; 404 → "that game has ended"; else generic. Never throw. `set-guest-access` 403 → "you must be in this game to set its password".

## Guardrails

- arena-client only — no server/contract change; no `G`/`ctx`.
- SFCs keep `defineComponent({ setup })` (D-6512).
- Guard `navigator`/`window` APIs; the account-holder "Join" and the WP-628 link/QR are untouched.
- Do not weaken the WP-627/630 server gates (the client only calls them).

## Required `// why:` Comments

- On the guest join building the `?match&player&credentials` URL: the unguarded live route, creds-only connect.
- On "Join as guest" gated by `hasGuestPassword` (distinct from the login-gated "Join").

## Files to Produce

- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — three wrappers.
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified** — wrapper tests.
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — host name/password fields + edit control + list names + guest "Join as guest" → password prompt.
- `apps/arena-client/src/lobby/LobbyView.test.ts` — **modified** — host set fields (password write-only), list names (+ matchID fallback), named-but-passwordless shows name/no button, full-match hides button, join-as-guest happy (navigates, password NOT in URL) + 401/429/409/404 copy.

## After Completing

- [ ] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0
- [ ] D-24026 live-verify (pick game by name → password → seated)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then `pnpm roadmap:counts:write`

## Common Failure Smells (Optional)

- "Join as guest" appears on a match with no password / no open seat → the `hasGuestPassword && players.some(isOpenSeat)` gate wasn't applied.
- The stored password renders in the edit control → the field must be write-only.
- Guest lands on the lobby not the seat → the navigate assigned a full URL to `window.location.search` (must be `window.location.href`), or a `route=` param crept in.
- Every three wrappers 400 → the body used `matchID` not `matchId`.
