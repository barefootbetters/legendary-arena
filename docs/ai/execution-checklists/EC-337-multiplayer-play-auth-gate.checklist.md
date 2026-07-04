# EC-337 — Multiplayer-Play Authentication Gate (Execution Checklist)

**Source:** docs/ai/work-packets/WP-307-multiplayer-play-auth-gate.md
**Layer:** Server + App (arena-client)

## Before Starting
- [ ] D-24092 is Active in `docs/ai/DECISIONS.md` (policy parent).
- [ ] WP-112/126/131 shipped: `requireAuthenticatedSession` exists in
      `apps/server/src/auth/sessionToken.logic.js` and is wired in `server.mjs`.
- [ ] WP-160/161/175 shipped: client `?route=login`, auth store bearer token,
      `buildApiUrl()`.
- [ ] Scope lock: the EXACT target set is the 8 files in `Files to Produce` —
      any modification outside it is a FAIL; surface as a blocker, do not improvise.
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (baseline).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (baseline).

## Locked Values (do not re-derive)
- `POST /api/match/create` → `{ matchID }`
- `POST /api/match/join` → `{ playerCredentials }`
- `Auth = authenticated-session-required` (both; 00.3 §21 / D-9905 closed set)
- Unauthenticated response: HTTP `401`, body `{ error: <full sentence> }`
- `MatchSetupConfig` fields verbatim from 00.2 §8.1 (no new setup field)

## Guardrails
- Server wires; engine decides — NO game/move/phase/rule logic in the handlers.
- `requireAuthenticatedSession` is the FIRST business-logic step in each handler.
- Do NOT add auth to `/api/match/autoplay` or spectating — the free taste stays guest.
- Do NOT modify boardgame.io internals or remove the native `/games/*` routes;
  the guard is an endpoint IN FRONT of the lobby. Else STOP and re-open D-24093.
- No new npm dependency; Node built-in `fetch` only if a server-internal call is used.
- Hanko stays confined (WP-099); `auth_provider` never carries `'hanko'`;
  `AccountId` server-generated.
- Do NOT touch the WP-293 Brevo enqueue path.

## Required `// why:` Comments
- `matchGate.routes.ts` handlers: why auth precedes delegation (D-24092 gate).
- `server.mjs` route registration: why the guarded routes reuse the existing deps bundle.
- `LobbyView.vue` redirect branch: why signed-out create/join routes to login.
- Grep discipline (EC-TEMPLATE §132): do NOT echo `requireAuthenticatedSession`
  verbatim in a `// why:` comment if a count-bounded grep gate targets it —
  paraphrase ("the authenticated-session helper").

## Files to Produce
- `apps/server/src/match/matchGate.routes.ts` — **new** — guarded create/join.
- `apps/server/src/match/matchGate.routes.test.ts` — **new** — 401 + success + spectator-unaffected.
- `apps/server/src/server.mjs` — **modified** — register guarded routes with deps bundle.
- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — call `/api/match/*` + bearer.
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — redirect-to-login guard.
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified** — updated call sites.
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — §21 rows + native-lobby annotation.
- `docs/ai/DECISIONS.md` — **modified** — land D-24093 (Active).

## After Completing
- [ ] `pnpm --filter @legendary-arena/server test` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (vue-tsc).
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] `pnpm -r build` exits 0.
- [ ] Live-on-surface (D-24026): signed-out create/join → sign-in; signed-in works;
      "Watch Bot Play" still guest-open on `play.legendary-arena.com`.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — D-24093 Active.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated (same commit).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date.

## Common Failure Smells
- A `401` for the spectator/autoplay path means the guard leaked onto the free taste.
- A `vue-tsc` error shipped to main means the `typecheck` gate was skipped (build/test
  do not type-check arena-client).
- Game logic creeping into `matchGate.routes.ts` means the server-wires boundary broke.
