# WP-307 — Multiplayer-Play Authentication Gate

**Status:** Draft (not yet executed)
**Layer:** Server + App (arena-client)
**User-Visible Surface:** `play.legendary-arena.com` (the lobby / match-create-and-join surface)
**Reserves:** D-24093
**Baseline:** `origin/main` @ `f299d82e` (drafted 2026-07-04)

## Goal

After this session, creating or joining a **playable seat** in a
multiplayer match on `play.legendary-arena.com` requires an authenticated
Hanko session. An unauthenticated visitor who tries to create or join a
match is redirected to the sign-in route instead of silently entering an
open match. The already-shipped "Watch Bot Play" spectator surface and
match spectating remain **guest-open** — they are the ungated free taste
(D-24092). This is the forcing function that lights up the email-capture
pipeline that already ships end-to-end (WP-174 provisioning writes the
verified email; WP-293 enqueues it to Brevo): making a free account the
gate to multiplayer play is what turns visitors into captured, marketable
contacts, without walling off the game entirely.

## Assumes

- **D-24092 (Active, 2026-07-04)** — the Access Model policy this WP
  implements: free account required for multiplayer play; guest taste is
  the shipped "Watch Bot Play"; persistence already gated. Source:
  `docs/ai/DECISIONS.md` D-24092 + `docs/01-VISION.md` §Access Model.
- **WP-112 / WP-126 / WP-131 (shipped)** — `requireAuthenticatedSession`
  orchestrator (`apps/server/src/auth/sessionToken.logic.js`) + the Hanko
  verifier, wired in production. Exports the same
  `(req, deps) => Promise<AuthResult>` shape the profile / teams /
  entitlements routes already consume (`server.mjs` deps bundle).
- **WP-174 / WP-293 (shipped)** — first-sign-in provisioning writes
  `legendary.players.email`; the production account resolver best-effort
  enqueues to Brevo. No change to this path is in scope.
- **WP-011 / WP-092 (shipped)** — the lobby create/join flow and loadout
  intake. `apps/arena-client/src/lobby/lobbyApi.ts` currently POSTs to the
  boardgame.io native routes `/games/legendary-arena/create` and
  `/games/legendary-arena/{matchID}/join` with **no** bearer token.
- **WP-160 / WP-161 / WP-175 (shipped)** — the client sign-in route
  (`?route=login`), the Pinia auth store holding the bearer token, and
  `buildApiUrl()` for API-host-prefixed fetches.
- **"Watch Bot Play" (WP-163 / WP-164, shipped)** — `POST /api/match/autoplay`
  creates an all-bot match server-side and returns `{ matchId, credentials }`,
  unauthenticated. This is the precedent the guarded endpoints mirror and
  the surface that stays guest.
- boardgame.io `Server({ games, origins })` exposes the native lobby under
  `server.router`; the server may create a match server-side by calling the
  same lobby the autoplay module already drives.

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24092** (the policy this implements),
  **D-24077 / WP-293** (Brevo enqueue — do not alter), **D-24084** (auth
  lives on `play`). Scan for related auth entries.
- `docs/01-VISION.md` — §Access Model (policy parent), §3 / §11 (identity),
  §4 (multiplayer sync), Non-Goals NG-1..7 (the gate must confer no
  gameplay advantage).
- `docs/ai/ARCHITECTURE.md` — §Layer Boundary (Authoritative): **the server
  wires, the engine decides**; the guarded endpoints must contain no game
  logic. `.claude/rules/architecture.md` Server layer + Import Rules.
- `.claude/skills/legendary-server/SKILL.md` — server-layer enforcement.
- `docs/ai/REFERENCE/api-endpoints.md` — the API catalog; §21 update target
  (new endpoints + the auth-posture note on the native lobby path).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — §8.1 Match Configuration:
  `MatchSetupConfig` field names (`schemeId`, `mastermindId`,
  `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, plus counts) and
  `playerCredentials` — used verbatim, never renamed.
- `apps/server/src/server.mjs` (lobby wiring ~508-556; deps bundle + route
  registration ~616-900) and `apps/server/src/autoplay/autoplay.mjs` (the
  server-side match-create precedent).
- `apps/arena-client/src/lobby/lobbyApi.ts` (`createMatch` / `joinMatch`
  call sites) and `LobbyView.vue` (the create/join UI actions).

## Scope (In)

- Add **guarded** server endpoints that front the boardgame.io native
  lobby for playable-seat creation and joining:
  - `POST /api/match/create` — requires an authenticated session; validates
    the `MatchSetupConfig` body via the existing setup validator; delegates
    to the native lobby server-side; returns `{ matchID }`.
  - `POST /api/match/join` — requires an authenticated session; delegates
    to the native lobby join; returns `{ playerCredentials }`.
  - Both run `requireAuthenticatedSession` as the FIRST business-logic step
    and return `401` with a full-sentence error body when the session is
    absent or invalid.
- Register the guarded routes in `server.mjs` using the existing
  `{ requireAuthenticatedSession, verifier, accountResolver }` deps bundle,
  mirroring the profile / teams registration pattern.
- arena-client: `lobbyApi.ts` `createMatch` / `joinMatch` switch from the
  native `/games/*` routes to the guarded `/api/match/*` endpoints and
  attach the bearer token from the auth store.
- arena-client: `LobbyView.vue` create/join actions **redirect to
  `?route=login`** when the auth store holds no token, instead of issuing
  an unauthenticated request.
- Land **D-24093** (the guard-mechanism decision).
- Update `docs/ai/REFERENCE/api-endpoints.md` per §21: rows for the two new
  endpoints (`Auth = authenticated-session-required`) and an auth-posture
  annotation on the native `/games/legendary-arena/*` create/join rows.
- Tests: server route tests (no session → `401`; valid session → success +
  delegation) and updated `lobbyApi` client tests for the new call sites.

## Out of Scope

- **"Watch Bot Play" / spectator path** — `POST /api/match/autoplay` and
  match spectating stay **guest-open**. This WP must NOT add an auth check
  to them; gating the free taste would violate D-24092.
- **The boardgame.io native `/games/*` routes** are not removed or
  modified internally — the guard is a server endpoint in front of them,
  never a change to framework internals.
- **The in-app marketing-consent checkbox** — a permitted future
  enhancement per D-24092, explicitly not built here; consent stays on
  Brevo double opt-in.
- **A guest playable solo-vs-AI mode** — not built; the ungated taste is
  the existing spectator "Watch Bot Play".
- **Persistence endpoints** (`/api/me/*`, loadouts, badges) — already
  authenticated; untouched.

## Files Expected to Change

- `apps/server/src/match/matchGate.routes.ts` — **new** — guarded
  `POST /api/match/create` + `POST /api/match/join` handlers; each calls
  `requireAuthenticatedSession` first, then delegates to the native lobby.
- `apps/server/src/match/matchGate.routes.test.ts` — **new** — `node:test`
  coverage: missing/invalid session → `401`; valid session → delegates and
  returns `matchID` / `playerCredentials`; the spectator path is unaffected.
- `apps/server/src/server.mjs` — **modified** — register the two guarded
  routes with the existing deps bundle (one `register*Routes` call).
- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — `createMatch`
  / `joinMatch` target `/api/match/*` and attach the bearer token.
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — create/join
  actions redirect to `?route=login` when unauthenticated.
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified** — update
  the create/join call-site assertions to the guarded endpoints + header.
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — §21 rows (two new
  endpoints + native-lobby auth-posture annotation).
- `docs/ai/DECISIONS.md` — **modified** — land D-24093 (flip reserved →
  Active).

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no
  snippets, no "show only the changed section".
- ESM only; Node v22+; `node:` prefix on built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — explicit,
  boring, junior-maintainable; full-sentence error messages; JSDoc per
  function; no `.reduce()` with branching; descriptive names.

**Packet-specific:**
- **Server wires; engine decides.** The guarded endpoints contain NO game
  logic — they authenticate, validate the setup shape via the existing
  validator, and delegate match creation/join to the boardgame.io lobby.
  No move, phase, rule, or outcome logic in `apps/server`.
- `requireAuthenticatedSession` is the FIRST business-logic step in each
  guarded handler (the profile/teams precedent).
- The spectator/autoplay path stays guest — no auth added to
  `/api/match/autoplay` or spectating.
- No new npm dependency. Use Node built-in `fetch` if a server-internal
  HTTP call to the native lobby is used (never `axios`/`node-fetch`).
- Hanko stays confined per WP-099; `auth_provider` never carries `'hanko'`;
  `AccountId` remains server-generated.
- `MatchSetupConfig` field names are used verbatim from 00.2 §8.1 — the
  9-field composition lock is unchanged (this WP adds no setup fields).

**Session protocol:** if the guard mechanism cannot be implemented as an
endpoint-in-front-of-lobby without touching bgio internals, STOP and
re-open D-24093 rather than modifying framework internals.

**Locked contract values:**
- New endpoints: `POST /api/match/create` → `{ matchID }`;
  `POST /api/match/join` → `{ playerCredentials }`.
- `Auth = authenticated-session-required` for both (00.3 §21 / D-9905
  closed set).
- Unauthenticated response: HTTP `401`, body `{ error: <full sentence> }`
  matching the sibling `/api/me/*` error shape.

## Vision Alignment

- **Vision clauses touched:** §3 (identity), §4 (multiplayer sync), §11
  (accounts/ownership), §Access Model, Non-Goals NG-1.
- **Conflict assertion:** `No conflict: this WP implements §Access Model
  and preserves all touched clauses.` The gate is authorized by D-24092.
- **Non-Goal proximity check:** NG-1 (no pay-to-win) is **not** crossed —
  the gate is a *free* account requirement that confers no gameplay
  advantage; free and paid players who sign in play the identical game.
  No other NG-1..7 surface is touched (no purchasable standing, no
  randomized goods, no competitive-signal sale).
- **Determinism preservation:** N/A — this WP touches auth posture on the
  lobby transport only. It adds no RNG, no scoring, no replay surface, and
  does not enter any move/phase/effect path; `G`, `ctx`, and
  `finalStateHash` are untouched.

## Funding Surface Gate

**N/A** — this WP touches no funding surface: no global-nav or
registry-viewer funding affordance, no profile funding-attribution
surface, no tournament funding-channel integration, and no user-visible
"donate"/"support"/"tournament funding" copy. The account gate is an auth
posture change, not a funding surface. (Authority for the carve-out:
00.3 §20.1 governance/analytical-mention exclusion.)

## API Catalog Update (§21)

Triggered — this WP changes the auth posture of the multiplayer
create/join surface and adds two endpoints. In the same commit,
`docs/ai/REFERENCE/api-endpoints.md` gains full rows for
`POST /api/match/create` and `POST /api/match/join`
(`Status = Wired`, `Auth = authenticated-session-required`,
`Authorizing WP = WP-307`), and the native
`/games/legendary-arena/create` + `/join` rows gain an annotation noting
the client now reaches them via the guarded endpoints (spectator/autoplay
still reach the open path). Whole-row replacement per D-11804; canonical
field names (`matchID`, `playerCredentials`) per 00.2.

## Acceptance Criteria

1. `POST /api/match/create` with no bearer token returns `401` and a
   full-sentence error body; no match is created.
2. `POST /api/match/create` with a valid Hanko session returns `200` and a
   `{ matchID }` for a match created in the native lobby.
3. `POST /api/match/join` with no bearer token returns `401`; with a valid
   session returns `{ playerCredentials }`.
4. `POST /api/match/autoplay` (spectator) and match spectating still
   succeed with **no** bearer token — the free taste is unaffected.
5. `apps/arena-client/src/lobby/lobbyApi.ts` `createMatch` / `joinMatch`
   target `/api/match/*` and send the bearer token; no call site targets
   the native `/games/*` create/join for a playable seat.
6. In `LobbyView.vue`, a create/join action while signed-out routes the
   user to `?route=login` and issues no unauthenticated match request.
7. `docs/ai/REFERENCE/api-endpoints.md` carries the two new rows with
   `Auth = authenticated-session-required` and the native-lobby annotation.
8. `D-24093` is present in `docs/ai/DECISIONS.md` and marked Active.
9. `apps/server` build + tests green; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
10. No file outside `## Files Expected to Change` is modified.

## Verification Steps

- `pnpm --filter @legendary-arena/server test` — expect the new
  `matchGate.routes.test.ts` cases green (401 without session; success
  with session; spectator path unaffected).
- `pnpm --filter @legendary-arena/arena-client typecheck` — exits 0
  (`vue-tsc --noEmit`; build/test do not type-check — see EC).
- `pnpm --filter @legendary-arena/arena-client test` — updated `lobbyApi`
  call-site assertions green.
- `pnpm -r build` — exits 0.
- Live-on-surface (D-24026): on `play.legendary-arena.com`, signed-out,
  attempting to create/join a match routes to sign-in; signed-in,
  create/join succeeds; "Watch Bot Play" still works signed-out.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `apps/server` build + test green; `arena-client` `typecheck` + `test`
      green; `pnpm -r build` green.
- [ ] **Live-on-surface verification (D-24026):** confirmed on
      `play.legendary-arena.com` — signed-out create/join redirects to
      sign-in; signed-in create/join works; spectator "Watch Bot Play"
      still guest-open. (Surface ≠ `none` — tests + merge do not satisfy
      this.)
- [ ] `docs/ai/REFERENCE/api-endpoints.md` updated in the same commit (§21).
- [ ] `docs/ai/STATUS.md` updated with what changed.
- [ ] `docs/ai/DECISIONS.md`: D-24093 flipped to Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] No files outside `## Files Expected to Change` were modified.

## User-Visible Impact

On `play.legendary-arena.com`, playing a seat in a multiplayer match now
requires a free sign-in; unauthenticated visitors are sent to the sign-in
route. Watching bot matches remains available without an account. The
payoff: every player who signs in to play is provisioned and enqueued to
the marketing pipeline that already ships, turning play intent into
captured contacts.

## Lint Gate Self-Review (00.3)

- **§1 Structure:** PASS — all required sections present.
- **§2 Non-Negotiable Constraints:** PASS — engine-wide (full files, no
  diffs, ESM/Node v22, 00.6 reference) + packet-specific + session protocol
  + locked contract values.
- **§3 Assumes:** PASS — prior WPs, files, and external state enumerated.
- **§4 Context:** PASS — specific docs + sections (00.2 §8.1, ARCHITECTURE
  §Layer Boundary, D-24092/24077/24084).
- **§5 Files Expected to Change:** PASS — 8 files, each new/modified +
  description. At the "consider split" threshold; kept as one coherent
  vertical (thin client changes) per the don't-over-decompose steer.
- **§6 Naming:** PASS — `matchID`, `playerCredentials`, `MatchSetupConfig`
  fields verbatim from 00.2 §8.1.
- **§7 Dependency Discipline:** PASS — no new npm dep; `axios`/`node-fetch`
  rejected; Hanko-confined per WP-099.
- **§8 Architectural Boundaries:** PASS — server wires, engine decides; no
  game logic in `apps/server`; no `G` persistence.
- **§9 Windows:** N/A — no shell scripts; `pnpm` commands only.
- **§10 Environment Variables:** N/A — introduces no new env var (Hanko +
  Brevo already wired at startup).
- **§11 Authentication Clarity:** PASS — one model: a Hanko authenticated
  session (bearer) is required to obtain match credentials; boardgame.io
  `playerCredentials` remain the in-match token. Protected endpoints state
  `authenticated-session-required`; spectator/autoplay stays guest by design
  (the `## Out of Scope` limitation).
- **§12 Test Quality:** PASS — `node:test`/`node:assert`; server route
  tests and client tests need no network/DB and no boardgame.io import.
- **§13 Verification:** PASS — exact `pnpm` commands with expected output.
- **§14 Acceptance Criteria:** PASS — 10 binary, observable items.
- **§15 Definition of Done:** PASS — STATUS/DECISIONS/WORK_INDEX +
  scope-boundary check; `User-Visible Surface` declared; live-on-surface
  item present (surface ≠ `none`).
- **§16 Code Style:** PASS — deliverables bound to 00.6 by the constraints.
- **§17 Vision Alignment:** PASS (triggered — §3/§4/§11 + monetization) —
  `## Vision Alignment` present with clause numbers, NG-1 non-goal check,
  and a determinism-N/A line.
- **§18 Prose-vs-Grep:** PASS — the WP body declares no literal-string grep
  Verification Step; the EC carries the `requireAuthenticatedSession`
  grep-echo discipline for the executor.
- **§19 Bridge-vs-HEAD:** N/A — not a repo-state-summarizing artifact.
- **§20 Funding Surface Gate:** N/A — see `## Funding Surface Gate` (no
  funding surface or copy touched).
- **§21 API Catalog:** PASS (triggered) — see `## API Catalog Update (§21)`;
  requires the same-commit `api-endpoints.md` update, closed-set Auth/Status,
  canonical field names.

**Final Gate:** no FAIL condition triggers. **Lint verdict: PASS.**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Correctly sequenced (all hard-deps on `main`),
scoped, lint-clean, and the validation-tightening scaffold has been run.

- **PS-1 (RESOLVED) — Empirical Scaffold run (01.4 §Empirical Scaffold).**
  Prototyped the client endpoint swap (`createMatch`/`joinMatch` →
  `/api/match/*`) in `lobbyApi.ts` and ran
  `pnpm --filter @legendary-arena/arena-client test` (2026-07-04).
  **Observed breakage: exactly 4 tests, all in
  `apps/arena-client/src/lobby/lobbyApi.test.ts`** (the create/join URL
  assertions at lines 86/156/252 + the HTTP-500 error-message URL regex at
  line 177). `listMatches` (GET, unchanged) did **not** break. No other
  file and no other package regressed. Server-side: no test references the
  native lobby create/join (static confirmation — the only callers are
  `lobbyApi.test.ts` + `LobbyView.vue`, both already in the allowlist; the
  guarded endpoints are net-new with no pre-existing fixture). **No scope
  expansion needed** — the breakage is fully contained in files already in
  `§Files Expected to Change`. Prototype reverted; the working tree is
  clean.
- **PS-2 (confirm at execution start) — framework singletons (WP-102
  PS-1/PS-2 precedent).** The guarded routes register Koa-style on
  `Server().router` (mirroring the profile/teams
  `register*Routes(router, deps)` pattern), NOT Express. The client
  redirect uses `App.vue`'s existing query-string router (`?route=login`),
  NOT vue-router (absent from the dependency graph and forbidden by the
  no-new-dep constraint). Non-blocking — the WP already encodes both
  correctly; confirm against live code before wiring.

**Request-body note (folds into Locked Values):** `POST /api/match/create`
takes `{ numPlayers, setupData: MatchSetupConfig }` (unchanged from the
native contract); `POST /api/match/join` takes `{ matchID, playerID,
playerName }` — `matchID` moves from the URL path (native
`/games/legendary-arena/:matchID/join`) into the request body for the
guarded endpoint.

## Copilot Check (01.7)

**PASS** — audited WP + EC + pre-flight against the 30 failure modes.
Most (determinism #2/#8/#23, mutation #3/#17, persistence #7/#19/#24,
outcome-timing #18/#26) are N/A: this WP touches no engine / `G` / RNG /
persistence / game-outcome surface. Substantive modes clear:

- **#1 / #9 / #16 / #29 (boundaries):** the guarded handler authenticates,
  validates the setup shape, and delegates — no game logic in `apps/server`
  (Guardrail + `## Non-Negotiable Constraints`); the client swaps endpoints
  + redirects, re-implementing nothing.
- **#4 / #6 / #27 (contract):** `matchID` / `playerCredentials` /
  `MatchSetupConfig` locked per 00.2; §21 whole-row catalog update required;
  the scaffold empirically bounded the fixture drift.
- **#10 / #22 (loud, typed failure):** unauthenticated → HTTP `401`,
  `{ error: <full sentence> }` matching the `/api/me/*` shape.
- **#11 (invariant tests):** the route test asserts 401-without-session
  **and** success-with-session **and** spectator-path-unaffected — a
  non-vacuous negative + positive + isolation triple.
- **#12 / #30 (governance):** allowlist locked, Out-of-Scope explicit,
  D-24093 reserved, index rows added.

**RISK (documented, resolved inline) — #13 directory classification.** The
new `apps/server/src/match/` directory inherits the existing **`server-app`**
code category, exactly like the sibling route-handler directories
(`autoplay/`, `entitlements/`, `teams/`, `profile/`, `marketing/`). It is
**not** a new code category and needs **no** `02-CODE-CATEGORIES.md` update
(contrast WP-300's `functions/`, which was a genuinely new edge subsurface).
No further action required.
