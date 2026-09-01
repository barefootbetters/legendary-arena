# EC-666 — Guest Password: Host Set-UI + Guest Join-by-Password (Client) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-631-guest-join-password-client.md
**Layer:** App (`apps/arena-client`)

## Before Starting

- [ ] **WP-630 must be merged** (the endpoints + meta this consumes). Confirm on `main`.
- [ ] Read `LobbyView.vue` (match list + create flow + the WP-629 guest idioms) and `lobbyApi.ts` (`addGuest`/`joinMatch` wrapper shapes + `buildGuestPlayUrl`).
- [ ] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0 (baseline).

## Locked Values (do not re-derive)

- Wrappers in `lobbyApi.ts`: `setGuestAccess(matchId, { gameName, password }, authToken)` (host bearer); `joinAsGuest(matchId, password)` (no auth) → `{ matchId, seat, credentials }`; `readGuestAccessMeta(matchId)` → `{ gameName, hasGuestPassword }`. Full-sentence `Error` with `status` on non-2xx.
- Guest join navigates to `buildGuestPlayUrl(matchId, seat, credentials)` (`?match&player&credentials`, the unguarded live route).
- "Join as guest" shows ONLY where `hasGuestPassword` is true; it is NOT the account-holder "Join" (unchanged; still login-gated).
- Password input is write-only (never render a stored password).
- Error copy: 401 → wrong password; 429 → "too many tries, wait a moment"; 409 → match full / no password set; else generic. Never throw.

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
- `apps/arena-client/src/lobby/LobbyView.test.ts` — **modified** — set fields, list names, join-as-guest happy + 401/429/409 copy.

## After Completing

- [ ] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0
- [ ] D-24026 live-verify (pick game by name → password → seated)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then `pnpm roadmap:counts:write`

## Common Failure Smells (Optional)

- "Join as guest" appears on a match with no password → the `hasGuestPassword` gate wasn't applied.
- The stored password renders in the edit control → the field must be write-only.
- Guest lands on the lobby not the seat → a `route=` param crept into the URL, or the navigate used the wrong shape.
