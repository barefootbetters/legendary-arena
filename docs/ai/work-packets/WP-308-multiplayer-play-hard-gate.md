# WP-308 — Multiplayer-Play Hard Gate (Close the Native-Lobby Bypass)

**Status:** Draft (not yet executed)
**Layer:** Server (`apps/server`) only
**User-Visible Surface:** `play.legendary-arena.com` (match create/join — enforcement only; no visible UI change)
**Reserves:** D-24094
**Baseline:** `origin/main` @ `64e1c86d` (drafted 2026-07-04)

## Goal

Close the WP-307 soft-gate bypass. Today the boardgame.io **native** lobby
routes (`POST /games/legendary-arena/create` and
`POST /games/legendary-arena/{matchID}/join`) stay open, so the D-24092
account gate is enforced only on the official arena-client path — a raw API
request straight to the native routes creates/joins a match with no account
(D-24093 §Enforcement level). After this session those native POST routes
reject any external caller that lacks a valid authenticated session, so the
gate is **unbypassable**: a signed-in account is required to play a seat by
**any** path. Legitimate server-internal delegation (the WP-307 guarded
endpoints and the WP-163/164 autoplay loop) and match spectating/listing
keep working unchanged.

## Assumes

- **WP-307 / D-24092 / D-24093 (Done, on `main`)** — the soft gate: guarded
  `POST /api/match/create` + `/join` in
  `apps/server/src/match/matchGate.routes.ts` run
  `requireAuthenticatedSession` then delegate server-internal (loopback
  `fetch`) to the native lobby. D-24093 §Enforcement level names the
  bypass this WP closes.
- **WP-163/164 (Done)** — the autoplay loop (`apps/server/src/autoplay/autoplay.mjs`,
  `registerAutoplayRoutes`) creates an all-bot match by the **same**
  server-internal loopback `fetch` to `/games/legendary-arena/create` +
  `/join`. This path must keep working after the guard lands.
- **WP-112 / WP-126 / WP-131 (Done)** — `requireAuthenticatedSession` +
  the Hanko verifier, wired in `server.mjs`.
- boardgame.io `Server({ games, origins })` returns `{ app, router, run, … }`;
  `server.run({ port })` starts it (`server.mjs:922`). `server.app` is the
  Koa app; the lobby router is applied by `Server()`. No app-level
  middleware exists in `apps/server` today (this WP adds the first).

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24093 §Enforcement level** (the soft-gate
  limitation this closes), **D-24092** (the policy), D-24077 (Brevo enqueue).
- `docs/01-VISION.md` — §Access Model, §3 / §11 (identity), §4 (multiplayer),
  NG-1 (the gate confers no gameplay advantage — still true for the hard gate).
- `docs/ai/ARCHITECTURE.md` — §Layer Boundary: the guard is server wiring,
  contains no game logic. `.claude/skills/legendary-server/SKILL.md`.
- `docs/ai/REFERENCE/api-endpoints.md` — the native create/join rows (Auth
  `guest` → `authenticated-session-required`); §21 update target.
- `apps/server/src/server.mjs` — `startServer()` (~480), the `Server({...})`
  construction (~509), the loopback origin `autoplayServerUrl` (~570), the
  route registrations (~572 autoplay, ~736 matchGate), and `server.run` (~922).
- `apps/server/src/match/matchGate.routes.ts` + `apps/server/src/autoplay/autoplay.mjs`
  — the two server-internal delegating `fetch` call sites.

## Scope (In)

- Add an **app-layer Koa guard middleware** (new
  `apps/server/src/match/nativeLobbyGuard.ts`) that intercepts **POST** to
  `/games/legendary-arena/create` and `/games/legendary-arena/{matchID}/join`
  and allows the request only if it carries **either** a valid
  **internal-delegation secret** header **or** a valid authenticated session;
  otherwise responds `401` with a full-sentence `{ error }`. All other
  paths/methods (the `GET` list, spectating, socket traffic, every `/api/*`
  route) pass straight through.
- Mount the guard so it runs **before** the boardgame.io lobby router
  (primary approach: `server.app.middleware.unshift(guard)` after `Server()`
  and before `server.run`). The execution scaffold confirms the ordering
  against the installed boardgame.io version (see Pre-Flight PS-1) and
  falls back to a loopback-source check or bgio lobby config if needed.
- Generate a **per-process internal-delegation secret** at startup
  (`crypto.randomBytes`, server layer — not engine), hold it in memory,
  never expose it to any client, and thread it into the guard + both
  delegating call sites.
- `matchGate.routes.ts` + `autoplay.mjs`: attach the internal-delegation
  secret header to their existing loopback `fetch` to the native lobby.
- `api-endpoints.md` (§21): native create/join Auth `guest` →
  `authenticated-session-required`, with a Notes line documenting the
  server-internal secret path.
- Land **D-24094** (the hard-gate mechanism; supersedes D-24093's soft-gate
  limitation).
- Tests: guard unit tests (no secret + no session → 401; **wrong/invalid
  secret value → 401**; valid secret → pass-through; valid session →
  pass-through; `GET` list untouched; non-lobby path untouched).

## Out of Scope

- **arena-client** — unchanged. It already reaches create/join through the
  WP-307 guarded `/api/match/*` endpoints; the native routes it still uses
  (`listMatches` `GET`) stay open. No client file is touched.
- **The native `GET /games/legendary-arena` list / spectating / socket
  connection** — stays open (guest); the guard matches only the two POST
  create/join paths.
- **Removing or re-implementing the native lobby** — the routes remain; the
  guard sits in front. No bgio-internals patch, no custom match storage
  (would collide with the "`G` never persisted" boundary).
- **The autoplay/spectator product surface** — still guest; it keeps
  working via the internal-delegation secret.
- **Reconnect (WP-116)** — not modified; if a reconnect path re-hits native
  join, it is called out in Pre-Flight PS-2, not changed here.

## Files Expected to Change

- `apps/server/src/match/nativeLobbyGuard.ts` — **new** — the Koa guard
  middleware + the allow-if-secret-or-session predicate.
- `apps/server/src/match/nativeLobbyGuard.test.ts` — **new** — `node:test`:
  no-secret-no-session → 401; wrong-secret-value → 401; secret → pass;
  session → pass; `GET` list untouched; unrelated path untouched.
- `apps/server/src/server.mjs` — **modified** — generate the secret, mount
  the guard before the lobby router, thread the secret to the matchGate +
  autoplay registrations.
- `apps/server/src/match/matchGate.routes.ts` — **modified** — attach the
  internal-delegation secret header to the delegating `fetch` (create + join).
- `apps/server/src/autoplay/autoplay.mjs` — **modified** — attach the same
  header to the autoplay delegating `fetch` (create + join).
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — §21 native
  create/join Auth-posture change + Notes.
- `docs/ai/DECISIONS.md` — **modified** — land D-24094.

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only; Node v22+; `node:` prefix on built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — explicit,
  full-sentence errors, JSDoc per function, no `.reduce()` with branching.

**Packet-specific:**
- **Server wires; engine decides.** The guard authenticates/authorizes and
  passes through or rejects — NO game/move/phase/rule logic.
- The guard matches **only** POST to the two native create/join paths.
  Every other path and method passes through untouched (the `GET` list,
  spectating, sockets, `/api/*`).
- **Session branch reuses the existing model.** The guard's session check
  calls `requireAuthenticatedSession` (`apps/server/src/auth/sessionToken.logic.ts`)
  — the same Bearer-token → Hanko-verifier → accountResolver path the WP-307
  `/api/match/*` guard uses. The guard introduces NO second authentication
  model.
- The internal-delegation secret is **process-local, never sent to a
  client**, never logged, never committed. Generated at startup; a process
  restart **regenerates** it. It is never persisted, env-configured, or
  backward-compatible across restarts — the guard and both delegating call
  sites share the one in-memory value, so a restart rotates all of them
  atomically.
- **Secret match is value-exact and constant-time.** Possession of the
  header *name* grants nothing; the request must carry the exact
  process-generated secret value, compared with `crypto.timingSafeEqual` on
  equal-length buffers (never `===` / string compare).
- No new npm dependency; Node built-in `crypto` + `fetch` only.
- Hanko stays confined (WP-099); `auth_provider` never carries `'hanko'`.
- No engine / `G` / replay / RNG / persistence surface; no migration.

**Session protocol:** if `server.app.middleware.unshift` does NOT place the
guard before the boardgame.io lobby router in the installed version (the
guard must run first to block), STOP and adopt the documented fallback
(loopback-source-IP check or bgio lobby config) — do NOT patch boardgame.io
internals.

**Locked contract values:**
- Guarded paths: `POST /games/legendary-arena/create`,
  `POST /games/legendary-arena/{matchID}/join`.
- Reject response: HTTP `401`, body `{ error: <full sentence> }`.
- Internal header name is a locked constant defined once in
  `nativeLobbyGuard.ts` and imported by the delegating call sites (never
  re-typed as a string literal).

## Vision Alignment

- **Vision clauses touched:** §3 (identity), §4 (multiplayer sync), §11
  (accounts), §Access Model, NG-1.
- **Conflict assertion:** `No conflict: this WP strengthens the D-24092
  Access Model to an unbypassable gate and preserves all touched clauses.`
- **Non-Goal proximity check:** NG-1 not crossed — the hard gate is a *free*
  account requirement conferring no gameplay advantage; no other NG-1..7
  surface is touched.
- **Determinism preservation:** N/A — auth posture on the lobby transport
  only; no RNG, scoring, replay, or move/phase path; `G` / `ctx` /
  `finalStateHash` untouched.

## Funding Surface Gate

**N/A** — no funding surface: no nav/registry/profile funding affordance, no
tournament funding channel, no "donate"/"support" user-visible copy. Pure
server-side auth enforcement. (Carve-out: 00.3 §20.1 governance-mention.)

## API Catalog Update (§21)

Triggered — the native create/join Auth posture changes. In the same commit,
`api-endpoints.md` updates the `POST /games/legendary-arena/create` and
`POST /games/legendary-arena/{matchID}/join` rows (Auth `guest` →
`authenticated-session-required`; whole-row replacement per D-11804), with a
Notes line that server-internal delegation (matchGate + autoplay) is admitted
via the process-local internal-delegation secret. The `GET /games/legendary-arena`
list row stays `guest` (unchanged).

## Acceptance Criteria

1. External `POST /games/legendary-arena/create` with no session and no
   internal secret returns `401`; no match is created.
2. External `POST /games/legendary-arena/{matchID}/join` with no session and
   no internal secret returns `401`.
3. External `POST …/create` carrying the internal header with a **wrong /
   invalid secret value** (header present, value incorrect) returns `401`;
   no match is created. (Guards against a presence-only check.)
4. A request carrying the valid internal-delegation secret passes through to
   the native lobby (the matchGate + autoplay delegation still succeeds).
5. `GET /games/legendary-arena` (list / spectating) still returns `200`
   with no auth — untouched.
6. The WP-307 guarded `POST /api/match/create` + `/join` still work
   end-to-end for a signed-in caller (auth → delegate-with-secret → native).
7. "Watch Bot Play" (`POST /api/match/autoplay`) still creates a bot match
   with no user auth (delegation carries the secret).
8. The internal secret appears in no client response, no log line, and no
   committed file.
9. `D-24094` is present in `docs/ai/DECISIONS.md` and marked Active.
10. `apps/server` build + tests green; `pnpm -r build` 0.
11. No file outside `## Files Expected to Change` is **created or modified**
    (arena-client untouched).

## Verification Steps

- `pnpm --filter @legendary-arena/server test` — new `nativeLobbyGuard.test.ts`
  green (401 without secret/session; 401 with a wrong secret value; pass with
  the valid secret; pass with session; `GET` list + unrelated path untouched).
- `pnpm -r build` — exits 0.
- **Scaffold (PS-1, at execution):** stand up a minimal boardgame.io
  `Server`, `unshift` the guard, and `curl` `POST …/create` — expect `401`
  without the secret and success with it (proves the guard precedes the
  lobby router). Record the observed result.
- Live-on-surface (D-24026): on the deployed build, `POST /api/match/create`
  with no auth → `401` (unchanged), a **raw** `POST /games/legendary-arena/create`
  with no auth → **now `401`** (was `200` under the soft gate), and
  "Watch Bot Play" + the signed-in lobby still work.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `apps/server` build + test green; `pnpm -r build` 0.
- [ ] **Live-on-surface (D-24026):** on `play.legendary-arena.com` /
      `api.legendary-arena.com` — raw native `POST …/create` now returns
      `401`; the WP-307 signed-in flow + "Watch Bot Play" still work.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated in the same commit (§21).
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md`: D-24094 Active; note it closes the D-24093
      soft-gate limitation.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] No files outside `## Files Expected to Change` were modified.

## User-Visible Impact

No visible UI change. The observable difference is enforcement: a raw API
call to the native lobby can no longer create or join a match without a
signed-in account, so the D-24092 gate holds by every path — every player
who plays a seat is provisioned and enters the email pipeline (WP-174 /
WP-293). Normal UI users see exactly what WP-307 already gives them.

## Lint Gate Self-Review (00.3)

- **§1 Structure / §2 Constraints / §3 Assumes / §4 Context / §5 Files:**
  PASS — all present; 7 files, bounded, each new/modified + description;
  constraints reference 00.6.
- **§6 Naming:** PASS — `matchID`, `playerCredentials`, native paths verbatim.
- **§7 Dependencies:** PASS — no new dep; `crypto`/`fetch` built-ins; Hanko-confined.
- **§8 Boundaries:** PASS — server-only; no game logic; no `G`/DB-of-state.
- **§9 Windows / §10 Env:** N/A — no shell scripts; the secret is
  process-generated, not a new configured env var (a `// why:` notes it).
- **§11 Auth Clarity:** PASS — one model: authenticated Hanko session (or the
  process-internal delegation secret for loopback calls) required to reach
  native create/join; `## Out of Scope` + Notes state what stays open.
- **§12 Tests:** PASS — `node:test`; no network/DB/boardgame.io import in the
  guard unit test (structural fakes).
- **§13 Verification / §14 Acceptance / §15 DoD:** PASS — exact commands;
  11 binary criteria (incl. wrong-secret-value → 401, guarding against a
  presence-only check); DoD carries STATUS/DECISIONS/WORK_INDEX +
  scope-boundary + live-on-surface (surface ≠ none).
- **§16 Code Style:** PASS — bound to 00.6.
- **§17 Vision Alignment:** PASS (triggered §3/§4/§11 + identity) — block
  present with clauses + NG-1 check + determinism-N/A line.
- **§18 Prose-vs-Grep:** PASS — no literal-string count-grep in Verification.
- **§19 Bridge-vs-HEAD:** N/A.
- **§20 Funding Gate:** N/A (justified).
- **§21 API Catalog:** PASS (triggered) — same-commit `api-endpoints.md`
  Auth-posture change; closed-set values; canonical names.

**Final Gate:** no FAIL. **Lint verdict: PASS.**

## Pre-Flight Verdict (01.4)

**NOT READY — PS-1 (blocking, scaffold) + PS-2 (confirm).** Correctly
sequenced (WP-307 on `main`), scoped, lint-clean; two items need a running
server to resolve, so they belong to the execution session's opening scaffold.

- **PS-1 (blocking) — middleware-ordering + validation-tightening scaffold
  (01.4 §Empirical Scaffold).** This WP makes the native create/join newly
  reject external callers (validation-tightening) **and** the whole mechanism
  depends on the guard running **before** boardgame.io's lobby router.
  Execution MUST, before implementing: stand up a minimal bgio `Server`,
  `server.app.middleware.unshift(guard)`, and observe that a raw
  `POST …/create` returns `401` without the secret and succeeds with it —
  proving the ordering. If `unshift` does not precede the lobby router in the
  installed version, adopt the fallback (loopback-source-IP check or bgio
  lobby config) — never patch bgio internals. Also run
  `pnpm --filter @legendary-arena/server test` on the prototype to enumerate
  any pre-existing fixtures that POST to the native lobby unauthenticated
  (WP-307's scaffold found none server-side, but the guard changes the wiring,
  so re-confirm) and fold any breakage into scope.
- **PS-2 (confirm) — delegation + reconnect paths.** Confirm that threading
  the secret into the matchGate + autoplay loopback `fetch` keeps both
  delegations passing the guard (AC-3/5/6), and that no reconnect path
  (WP-116) re-hits native join in a way the guard would block; if it does,
  surface it as a blocker before touching files.

Copilot check (01.7) runs after pre-flight flips to READY (post-scaffold).

## Copilot Check (01.7)

**Deferred** — 01.7 runs only after pre-flight = READY, which requires the
PS-1 scaffold. Recorded here so the sequence is explicit: the copilot pass
(30-mode audit) is the execution session's first gate once the scaffold
confirms the mechanism.
