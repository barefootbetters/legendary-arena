# EC-338 — Multiplayer-Play Hard Gate (Execution Checklist)

**Source:** docs/ai/work-packets/WP-308-multiplayer-play-hard-gate.md
**Layer:** Server (`apps/server`) only

## Before Starting
- [ ] WP-307 / D-24092 / D-24093 are on `main` (the soft gate this hardens).
- [ ] **PS-1 scaffold FIRST (blocking):** stand up a minimal boardgame.io
      `Server`, `server.app.middleware.unshift(guard)`, `curl POST …/create` →
      expect `401` without the secret, success with it (proves the guard runs
      BEFORE the lobby router). If ordering fails → STOP, use the fallback
      (loopback-source-IP check or bgio lobby config); do NOT patch bgio.
- [ ] Scaffold also runs `pnpm --filter @legendary-arena/server test` to
      enumerate any pre-existing native-lobby fixture breakage; fold into scope.
- [ ] Scope lock: EXACT target set = the 7 files in `Files to Produce`; any
      other file **created or modified** is a FAIL — surface as a blocker,
      approve via amendment before proceeding (arena-client stays untouched).
- [ ] `pnpm --filter @legendary-arena/server test` green at baseline.

## Locked Values (do not re-derive)
- Guarded paths: `POST /games/legendary-arena/create`,
  `POST /games/legendary-arena/{matchID}/join` (POST only).
- Reject response: HTTP `401`, body `{ error: <full sentence> }`.
- Internal-delegation header name = one locked constant in
  `nativeLobbyGuard.ts`, imported by the delegating call sites (never a
  re-typed string literal).
- Native `GET /games/legendary-arena` list stays `guest`/open.

## Guardrails
- Server wires; engine decides — NO game/move/phase/rule logic in the guard.
- Guard matches ONLY POST to the two native create/join paths; everything
  else (GET list, spectating, sockets, `/api/*`) passes through untouched.
- Session branch reuses `requireAuthenticatedSession`
  (`apps/server/src/auth/sessionToken.logic.ts`) — the same Bearer → verifier →
  accountResolver path WP-307 uses. NO second authentication model.
- Secret match is value-exact AND constant-time: `crypto.timingSafeEqual` on
  equal-length buffers, never `===` / string compare. The header *name* alone
  grants nothing — the exact secret value is required.
- Internal secret is process-local: generated at startup (`crypto`), never
  sent to a client, never logged, never committed. A restart regenerates it;
  it is never persisted or env-configured (guard + both delegating sites share
  the one in-memory value, so a restart rotates all atomically).
- No new npm dependency; Node built-in `crypto` + `fetch` only.
- Hanko stays confined (WP-099); `auth_provider` never carries `'hanko'`.
- No engine / `G` / replay / RNG / persistence / migration surface.
- STOP means HARD STOP: if `unshift` ordering fails, adopt the documented
  fallback — do not improvise a bgio-internals patch.

## Required `// why:` Comments
- `nativeLobbyGuard.ts`: why the guard runs before the lobby router; why
  allow-if-secret-OR-session.
- `server.mjs`: why the secret is process-generated (not a configured env var);
  why `unshift` (ordering) rather than `app.use`.
- Delegating `fetch` sites (matchGate + autoplay): why they carry the internal
  header. Grep discipline (EC-TEMPLATE §132): paraphrase any policed literal.

## Files to Produce
- `apps/server/src/match/nativeLobbyGuard.ts` — **new** — guard middleware + predicate.
- `apps/server/src/match/nativeLobbyGuard.test.ts` — **new** — no-secret-no-session
  401 / wrong-secret-value 401 / secret-pass / session-pass / GET-untouched /
  unrelated-path-untouched.
- `apps/server/src/server.mjs` — **modified** — generate secret, unshift guard, thread secret.
- `apps/server/src/match/matchGate.routes.ts` — **modified** — internal header on delegating fetch.
- `apps/server/src/autoplay/autoplay.mjs` — **modified** — internal header on delegating fetch.
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — native create/join Auth `guest` → `authenticated-session-required` (D-11804 whole-row).
- `docs/ai/DECISIONS.md` — **modified** — land D-24094 (closes D-24093 soft-gate limitation).

## After Completing
- [ ] `pnpm --filter @legendary-arena/server test` exits 0.
- [ ] `pnpm -r build` exits 0.
- [ ] Live-on-surface (D-24026): raw native `POST …/create` no-auth → now `401`;
      WP-307 signed-in flow + "Watch Bot Play" still work on the deployed build.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — D-24094 Active.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated (same commit).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date.

## Common Failure Smells
- A `401` on `GET /games/legendary-arena` or on `/api/*` means the guard's
  path/method match is too broad.
- "Watch Bot Play" or the WP-307 signed-in create breaking means the
  delegating `fetch` is missing the internal header (or the constant drifted).
- The soft gate still bypassable (raw native create returns `200`) means the
  guard is mounted AFTER the lobby router — the PS-1 ordering fallback is needed.
- A present-but-wrong secret header passing through (should be `401`) means the
  guard checks header *presence*, not value — use value-exact `timingSafeEqual`.
