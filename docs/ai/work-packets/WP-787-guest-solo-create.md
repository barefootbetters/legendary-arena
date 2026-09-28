# WP-787 — Guest solo create: a signed-out visitor can play one solo featured table

**Status:** Draft 2026-09-28 · **EC:** EC-824 · **Reserves:** D-24635
**Primary Layer:** Server (`apps/server`)
**User-Visible Surface:** none — infrastructure (API only; payoff: the client adoption WP makes
WP-785's signed-out Enter Arena a playable solo match)
**Lane:** standard two-session. Not lightweight: a new unauthenticated endpoint is an identity
surface (lane criterion 6) and the shared limiter helper is a new abstraction (criterion 3).
**Baseline:** `origin/main` @ `da4d3a2c` (2026-09-28); server 1636 tests / 265 suites / 1430 pass /
0 fail / 206 skipped (DB-gated), `pnpm -r build` 0 (observed).

## Goal

`docs/01-VISION.md` §Access Model promises that "a guest may play the tutorial and at least one solo
match against a villain/mastermind AI without an account" (D-24092). Today every create path needs a
session, so a signed-out visitor can only watch bots. Add one unauthenticated route,
`POST /api/match/create-guest-solo`, that creates a **1-player match on a server-fixed featured
table** (the same table WP-785 locks), joins the caller into seat `'0'` as `Guest`, and returns the
seat credentials. The seat stays rowless and the match stays Casual. The account wall stays on the
*second* action (saving, scoring, multiplayer), where D-24092 places it.

## User-Visible Impact

None directly: this WP ships an API route with no UI. A signed-out player sees a change only after
the client adoption WP wires WP-785's signed-out Enter Arena to this route. STATUS records "No
user-observable change — infrastructure only".

## Assumes

- **Dependencies:** WP-307, WP-308, WP-309, WP-333, WP-370, WP-627, WP-630 — all `[x]`. Independent of
  WP-785 / WP-786 (the featured table is duplicated here, not imported).
- **D-24092 (Active)** — Access Model; its locked choice made the spectator surface (Watch Bot Play)
  the only ungated taste. **D-24093 / D-24094** — guarded `/api/match/create|join` call
  `requireAuthenticatedSession`, then delegate to the native lobby over loopback with
  `INTERNAL_DELEGATION_HEADER` (`x-legendary-internal-delegation`,
  `apps/server/src/match/nativeLobbyGuard.ts`); the native guard gates only the two native POST paths
  and admits them with a session or that secret.
- **Native lobby (boardgame.io 0.50.2):** create takes `{ numPlayers, setupData, unlisted }` and
  returns `{ matchID }`; `unlisted` is read into `metadata.unlisted` and the list route filters it
  out. Join needs `playerName` (403 without it), takes an optional `playerID`, and returns
  `{ playerID, playerCredentials }`. The engine validates `setupData` (`validateSetupData`, a
  message-bearing 400). `minPlayers: 1`.
- **Unauthenticated-create precedent** — `POST /api/match/autoplay`
  (`apps/server/src/autoplay/autoplay.mjs`) creates and joins over loopback with the secret and returns
  seat credentials to a signed-out caller, with no rate limit or cap.
- **Rowless guest seats** — D-24120: `legendary.match_seat_accounts` is written only by
  `/api/match/join`. D-24437 / D-24441: guest seats are named `Guest` and rowless.
  `computeRankedEligibility` rule 2 (D-24172) makes a 0-row 1-seat match Casual. A signed-out caller
  cannot submit a score (session-gated, 401); a signed-in caller gets `not_owner` (no seat row, so
  capture assigns no ownership).
- **Response shape precedent** — `add-guest` / `join-as-guest` return `200 { matchId, seat, credentials }`
  with `Cache-Control: no-store`; errors are `{ error: '<full sentence>' }`; the client builds the play
  URL with `buildGuestPlayUrl` (`apps/arena-client/src/lobby/lobbyApi.ts`).
- **Rate-limit precedent** — `makeGuestJoinRateLimiter` (`guestAccessRoutes.mjs`) and analytics'
  module-private `makeRateLimiter`: whole-window token buckets keyed by `koaContext.request.ip`, with
  `context.*Capacity` / `context.now` seams, 429 before any work.
- **Deploy topology:** `render.yaml` runs one instance (`plan: pro`, no `numInstances`). Both
  `api.legendary-arena.com` and the direct `legendary-arena-server.onrender.com` origin return
  `Server: cloudflare` (Render's edge is Cloudflare). Nothing sets Koa `app.proxy`, so `request.ip` is
  a proxy hop. **Whether `cf-connecting-ip` reaches Node, and whether it can be forged, is unverified
  until live**; the process-wide cap is the hard bound either way.
- **Cleanup** — `matchReaper.js` deletes unfinished `bgio.matches` rows after 24 h. The capture
  harvester writes `bgio.replay_artifacts` for every finished match (autoplay included) with no
  retention.
- **`checkPlayerCountComposition`** (`@legendary-arena/registry/playerCountSetup`, already imported by
  `matchGate.routes.ts`) accepts `{ ...composition, playerCount }` and returns `[]` when legal.
  `PLAYER_COUNT_SETUP[1]` = 1 / 1 / 1 / 3 (D-24165). Magneto `alwaysLeads: ["brotherhood"]`.
- Server tests: `pnpm --filter @legendary-arena/server test` after `pnpm -r build`.

## Context (Read First)

- `docs/ai/REFERENCE/00.2-data-requirements.md` §6 (Mastermind–Villain relationship) and §7 (Match
  Configuration) — the composition field names and Always Leads.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary and `.claude/skills/legendary-server/SKILL.md` (the server
  wires; per-route body parsing).
- `docs/ai/REFERENCE/api-endpoints.md` — the closed Auth set, the D-11804 whole-row rule, and
  §Body-Parsing Convention (a route that never reads its body needs no parser).
- `apps/server/src/match/guestAccessRoutes.mjs` + `.test.ts` — the route and test precedent.
- `apps/server/src/server.mjs` — `botAllyContext` (`db` bgio store, `database` pg pool, `serverUrl`,
  `internalDelegationSecret`) and `registerGuestAccessRoutes(server.router, botAllyContext)`.
- DECISIONS scan: D-24092, D-24093, D-24094, D-24120, D-24172, D-24437, D-24441, D-24451, D-20503.
- **Why a new route, not a relaxed `/api/match/create`.** Relaxing `/create` would undo the D-24094 hard
  gate for arbitrary compositions and mix the D-24120 seat-row path with the rowless one. A separate,
  server-owned route keeps `/create` exactly as it is.
- **Why a server-fixed table.** Accepting client `setupData` unauthenticated widens the abuse surface;
  autoplay already does, this route does not.
- **Why a shared limiter helper.** This is the third token-bucket copy (analytics, join-as-guest, this
  route); code style says abstract at the third copy. Moving the two older copies onto it changes how
  they key requests, so that is a follow-up.
- **Signed-in callers.** The route never reads a session. A signed-in caller gets a Casual guest match;
  the authed WP-785 path is the right one for them.

## Non-Negotiable Constraints

**Engine-wide (do not remove):** ESM only, Node v22+, `node:` prefix. Full file contents, no diffs.
Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (no nested ternaries, full-word names,
JSDoc on every function, functions ≲ 30 lines, full-sentence error messages, `// why:` on every
non-obvious constant).

**Packet-specific:**
- Server layer only. No `packages/**`, engine, client, or migration change. No new npm dependency.
- No `legendary.*` write and no database query from this route. The only rows it causes are the native
  lobby's `bgio.matches` row (and, at gameover, the existing harvester's `bgio.replay_artifacts` row).
- Bodyless: never parse or read the request body (no `koaBody()`, no `ensureJsonBodyParsed`).
- Identity model: credentials-only (the bgio seat credential). The route never reads a session.
- `/api/match/create`, `/api/match/join`, the native lobby guard, and autoplay are unchanged.
- The rate-limit check and the capacity check run **before** any `fetch`.
- Credentials and client IPs are never logged.
- 01.5 is NOT INVOKED: `server.mjs` gets one import and one registration, allowlisted.

**Session protocol:** if the loopback header, the native create/join shapes, or the `add-guest`
response shape differ from Assumes, STOP. Stop and ask on any item not locked here.

## Locked Contract Values

- **Route:** `POST /api/match/create-guest-solo`, Auth `guest`, registered by
  `registerGuestSoloRoutes(router, context)` in `apps/server/src/match/guestSoloRoutes.mjs`, called from
  `server.mjs` with `botAllyContext` directly after `registerGuestAccessRoutes`.
- **Featured table** (`GUEST_SOLO_FEATURED_TABLE`, exported): `schemeId: 'core/midtown-bank-robbery'`,
  `mastermindId: 'core/magneto'`, `villainGroupIds: ['core/brotherhood']`,
  `henchmanGroupIds: ['core/sentinel']`, `heroDeckIds: ['core/spider-man', 'core/hulk', 'core/wolverine']`,
  `bystandersCount: 30`, `woundsCount: 30`, `officersCount: 30`, `sidekicksCount: 12`. Identical to
  WP-785's `FEATURED_TABLE`.
- **Native calls:** create body `{ numPlayers: 1, setupData: GUEST_SOLO_FEATURED_TABLE, unlisted: true }`
  → read `matchID`. Join body `{ playerID: '0', playerName: 'Guest' }` → read `playerCredentials`,
  returned as `credentials`. Both carry `[INTERNAL_DELEGATION_HEADER]: internalDelegationSecret`.
- **Success:** `200 { matchId, seat: '0', credentials }`; `Cache-Control: no-store` on every response.
- **Rate limit:** key = `koaContext.req.headers['cf-connecting-ip']` when it is a non-empty string, else
  `koaContext.request.ip` when a non-empty string, else `'unknown'`.
  `GUEST_SOLO_RATE_LIMIT_WINDOW_MS = 60_000`; `DEFAULT_GUEST_SOLO_RATE_LIMIT_CAPACITY = 5` creates per key
  per window; over → `429`
  `{ error: 'Too many guest matches were started from this connection. Please wait a minute and try again.' }`.
- **Key-source log:** on the first request after `registerGuestSoloRoutes` runs (a closure flag; production registers once, so once per process), log `[guest-solo] rate-limit key source: <cf-connecting-ip|request.ip|unknown>` (the source name only, never the IP).
- **Capacity:** an in-process list of creation timestamps; entries older than
  `GUEST_SOLO_ACTIVE_WINDOW_MS = 7_200_000` are pruned on each request.
  `DEFAULT_MAX_ACTIVE_GUEST_SOLO_MATCHES = 200`; at or over → `503`
  `{ error: 'Guest play is at capacity right now. Please sign in to play, or try again in a few minutes.' }`.
  A timestamp is recorded only after a successful join.
- **Failures:** a non-OK native create or join → the native status and
  `{ error: 'The guest match could not be created. <native message>' }`, where `<native message>` is the
  native response's `text()`; a thrown `fetch` → `502`
  `{ error: 'The guest match could not be created because the game server did not respond. Please retry in a moment.' }`.
- **Shared helper** `apps/server/src/match/tokenBucketRateLimiter.mjs` exports
  `createTokenBucketRateLimiter({ capacity, windowMs, now })` → `{ consume(key, count) }` (whole-window
  reset, identical semantics to `makeGuestJoinRateLimiter`) and `resolveRateLimitKey(koaContext)` →
  `{ key, source }` (the key rule above).
- **Isolation:** the limiter and the capacity list are created inside `registerGuestSoloRoutes` (a
  closure, never module scope). Test seams: `context.guestSoloRateLimitCapacity`,
  `context.maxActiveGuestSoloMatches`, `context.now`.

## Scope (In)

- `apps/server/src/match/tokenBucketRateLimiter.mjs` [new] — the two exports above, JSDoc, `// why:` on
  the whole-window reset and on the key order.
- `apps/server/src/match/tokenBucketRateLimiter.test.ts` [new] — one `describe`, exactly 5 tests:
  (1) `capacity` consumes then refuses; (2) the window reset refills; (3) keys are independent;
  (4) `resolveRateLimitKey` prefers a non-empty `cf-connecting-ip` (`source: 'cf-connecting-ip'`);
  (5) it falls back to `request.ip`, then `'unknown'`.
- `apps/server/src/match/guestSoloRoutes.mjs` [new] — `GUEST_SOLO_FEATURED_TABLE`, the constants, and
  `registerGuestSoloRoutes`; the handler split into small helpers (capacity check, create, join).
- `apps/server/src/match/guestSoloRoutes.test.ts` [new] — one `describe`, exactly 10 tests with a fake
  router, fake Koa context, spy pg pool (`context.database`) and spy bgio store (`context.db`), and a
  stubbed `fetch`: (1) the route is registered at the locked path; (2) success → one create carrying the
  secret, `numPlayers: 1`, the featured `setupData`, `unlisted: true`; one join for seat `'0'` as
  `Guest`; `200 { matchId, seat: '0', credentials }`; `no-store`; (3) a body with `setupData` /
  `numPlayers` / `playerName` is ignored; (4) the spy pool and spy store see **zero** calls; (5) over the
  rate limit → 429 with **no** `fetch`, and the key-source log fires exactly once across the two
  requests, naming the source and never the IP (stub `console.log`); (6) at capacity → 503 with no `fetch`; (7) a capacity entry older
  than the window is pruned and a create succeeds; (8) a native 400 on create → 400 with the locked
  prefix and no join, and with `maxActiveGuestSoloMatches: 1` a follow-up successful create still
  returns 200; (9) a thrown `fetch` → 502 and no capacity entry recorded; (10)
  `checkPlayerCountComposition({ ...GUEST_SOLO_FEATURED_TABLE, playerCount: 1 })` is `[]`, and Magneto's
  `alwaysLeads` slugs (read from `data/cards/core.json` via `import.meta.url`) are within the table's
  villain-group slugs.
- `apps/server/src/server.mjs` — import + one `registerGuestSoloRoutes(server.router, botAllyContext)`
  after `registerGuestAccessRoutes`, with a `// why:`.
- `docs/ai/REFERENCE/api-endpoints.md` — one new whole row (D-11804): Status `Wired`; Method `POST`;
  Path `/api/match/create-guest-solo`; Auth `guest`; Request "(none — bodyless POST, no `koaBody()`;
  any body ignored)"; Response "`200 → { matchId, seat: '0', credentials }`; `429` over the rate limit;
  `503` at capacity; `502` game server unreachable; native status passed through on failure;
  `Cache-Control: no-store`"; Authorizing WP WP-787; Notes "rowless Casual seat (D-24120 / D-24172),
  server-fixed table, unlisted, D-24635".

## Out of Scope

- Any client change, including WP-785's signed-out path (a client adoption WP calls this route, then
  navigates with `buildGuestPlayUrl`).
- Moving the analytics and join-as-guest limiters onto the shared helper (and so re-keying them).
- A catalog row for `POST /api/match/autoplay`, and the stale "secret-carrying callers" note on the
  native create/join rows (pre-existing papercuts; separate small fixes).
- Tutorial mode, multi-seat or bot-ally guest play, guest Battle Plan headers, a persisted or shared
  limiter, an env kill switch, and retention for `bgio.replay_artifacts`.

## Limitations (accepted)

- An attacker with many IPs (or a forged `cf-connecting-ip`, if forgeable) can use up the 200 cap, so
  guest play returns 503 for up to 2 h. Signed-in play is unaffected.
- A deploy or restart resets the limiter and the cap. There is no cross-instance enforcement; scaling
  out multiplies both per instance (D-20503 / D-24094 posture).
- The cap is soft under truly concurrent requests (check, then record after the join).
- A rate-limit token is spent even when the request then hits 503 or a native failure.
- Credentials travel in the play URL (the add-guest precedent).
- A create that succeeds but whose join fails leaves an orphan match, reaped after 24 h.
- `bgio.replay_artifacts` rows for finished guest matches have no retention (as for autoplay).
- The featured table is duplicated in WP-785; test 10 proves it is legal, and the client adoption WP
  proves the two are equal.

## Files Expected to Change

- `apps/server/src/match/tokenBucketRateLimiter.mjs` — **new** (shared limiter + key resolver)
- `apps/server/src/match/tokenBucketRateLimiter.test.ts` — **new** (5 tests)
- `apps/server/src/match/guestSoloRoutes.mjs` — **new** (the route, featured table, capacity)
- `apps/server/src/match/guestSoloRoutes.test.ts` — **new** (10 tests)
- `apps/server/src/server.mjs` — **modified** (one import + one registration)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (one new whole row)
- Governance: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24635 → Active; a one-line "amended by
  D-24635" pointer on D-24092), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

No other files may be modified.

## Contract

- `POST /api/match/create-guest-solo` (Auth `guest`, bodyless) creates exactly one 1-player, unlisted
  match on `GUEST_SOLO_FEATURED_TABLE`, joins seat `'0'` as `Guest`, and returns
  `{ matchId, seat, credentials }`.
- It writes nothing to `legendary.*`; the match is Casual and not submittable.
- It refuses (429 / 503) before any work when the per-key limit or the process-wide capacity is hit.

## Acceptance Criteria

1. The route exists at the locked path and answers without a session.
2. A success sends exactly one native create (secret, `numPlayers: 1`, featured `setupData`,
   `unlisted: true`) and one native join (seat `'0'`, `Guest`) and returns the locked 200 shape.
3. Client-supplied `setupData`, `numPlayers`, and `playerName` never reach the native calls.
4. No database or bgio-store call is issued on any path.
5. Over the rate limit → 429; at capacity → 503; neither calls `fetch`.
6. A native failure passes its status with the locked error prefix; a network failure → 502; neither
   records a capacity entry.
7. The featured table passes `checkPlayerCountComposition` at 1 player and honors Magneto's Always Leads.
8. `api-endpoints.md` carries the new whole row; the `/api/match/create` and `/join` rows are unchanged.
9. The server suite goes 1636 → 1651 tests, 1430 → 1445 pass, 0 fail, 206 skipped; suites 265 → 267;
   `pnpm -r build` exits 0.

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0
pnpm --filter @legendary-arena/server test
# Expected: 1651 tests / 267 suites / 1445 pass / 0 fail / 206 skipped
#           (baseline at da4d3a2c: 1636 / 265 / 1430 / 0 / 206; use the observed baseline + 15 if main moved)
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All acceptance criteria pass. Counts recorded before and after.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED, post-deploy):** signed out,
      `curl -s -X POST https://api.legendary-arena.com/api/match/create-guest-solo` → 200 with
      `seat: "0"`; open `play.legendary-arena.com/?match=<id>&player=0&credentials=<c>` → a Magneto /
      Brotherhood / Midtown match in the lobby phase. Six rapid calls from network A → the sixth is 429;
      then one call from a second network (e.g. a phone on cellular) → 200. Read the
      `[guest-solo] rate-limit key source:` line in the Render logs. If network B also gets 429, or the
      source is not `cf-connecting-ip`, record it in STATUS and open the follow-up before calling the WP
      done. Confirm no `legendary.match_seat_accounts` row for the matchId (read-only query).
- [ ] `docs/ai/DECISIONS.md` D-24635 Active + the D-24092 pointer; the `api-endpoints.md` row lands in
      the same commit.
- [ ] `docs/ai/STATUS.md`: "No user-observable change — infrastructure only", plus the live-check result.
      WORK_INDEX WP-787 `[x]` with date. EC_INDEX EC-824 → Done. Mindmap `📝`→`✅`.
      `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:** Access Model (delivers D-24092's guest solo taste; the account wall stays on
  save / score / multiplayer), §1 Rules Authenticity (the table honors Always Leads), §3 Player Trust &
  Fairness and §23 (a guest seat never reaches a leaderboard), §12 Cloud-Friendly (the limiter and cap
  are in-process; one instance today; scaling out multiplies both per instance — accepted, the D-20503 /
  D-24094 posture), Financial Sustainability (the existing gameover sign-in prompt is the conversion
  point; the cap bounds hosting cost). NG-1 / NG-4 / NG-6 not crossed.
- **Conflict assertion:** No conflict. D-24635 **amends** D-24092's locked choice — it widens the
  ungated taste from "the spectator surface" to "the spectator surface plus one solo table" — and
  narrows D-24094's "an account is required to play a seat by any path" for this one server-owned,
  secret-carrying route (the D-24437 / D-24441 guest seats are precedent). The native guard is unchanged.
- **Determinism preservation:** Unchanged. The engine runs the match as any other.

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1 structure:** every required section present, plus `## User-Visible Impact` and `## Limitations`.
  Baseline `origin/main` @ `da4d3a2c`.
- **§2 constraints:** engine-wide (ESM, Node 22, `node:`, full files, 00.6), packet-specific (server-only,
  zero `legendary.*` writes, bodyless, limit + capacity before any fetch), session protocol (loopback /
  shape STOP), locked values; 01.5 NOT INVOKED.
- **§3 / §4:** depends on WP-307/308/309/333/370/627/630 (all complete), independent of WP-785/786;
  Context cites 00.2 §6/§7, ARCHITECTURE §Layer Boundary + the legendary-server skill, api-endpoints
  §Body-Parsing Convention, D-24092/24093/24094/24120/24172/24441.
- **§5 / §7:** 4 new + 1 wiring file + catalog row, plus governance, each with a one-line description.
  No new deps (built-in fetch).
- **§6 naming:** 00.2 §7 composition fields verbatim; `{ matchId, seat, credentials }` follows add-guest /
  join-as-guest.
- **§8 layer:** apps/server only; no engine / registry / client change; the match row is the framework's
  own bgio row (D-24095).
- **§9 Windows:** `pwsh` verification. **§10:** N/A — no new env var (loopback `serverUrl` reuses the
  existing PORT-derived URL).
- **§11 auth:** a `guest` endpoint; credentials-only (bgio seat credential), never reads a session;
  `## Limitations` names the cap-exhaustion, restart-reset, per-instance, and URL-credential limits.
- **§12 tests:** `node:test`; fake router / Koa context, spy pool + store, stubbed fetch; no bgio import,
  network, or DB; negatives (429 and 503 send no fetch, failures record no capacity entry).
- **§13 / §14 / §15:** exact commands, 1636 → 1651 tests (0 fail, 206 skip); 9 binary ACs; DoD with the
  `git status` scope check, D-24635 flip, STATUS "No user-observable change — infrastructure only", and a
  D-24026 curl + two-network rate-limit live check.
- **§16 code style:** third token-bucket copy → shared helper (older two deferred); JSDoc everywhere; no
  nested ternary; `// why:` on the fixed table, key source, `unlisted`, capacity window, bodyless route.
- **§17 Vision:** present (Access Model, §1, §3, §12, §23, Financial Sustainability; NG-1/4/6 not
  crossed; amends D-24092's locked choice via D-24635). **§18:** N/A — no grep verification. **§19:** N/A
  (commit-time).
- **§20 Funding:** N/A — a server route with no UI; its only copy is the 429 / 503 / 502 error text; no
  donate or support copy.
- **§21 API Catalog:** triggered — one new whole row `POST /api/match/create-guest-solo` (`Wired`,
  `guest`, bodyless, WP-787) per D-11804; `/api/match/create` and `/join` rows unchanged; new helper
  exports are internal (not `Library-only`).

## Gate Verdicts

- **Pre-flight (01.4), run 1: NOT READY → READY after 10 doc-only fixes.** Baseline observed at
  `da4d3a2c`: `pnpm -r build` 0; server 1636 / 265 / 1430 pass / 0 fail / 206 skipped; no
  generated-artifact churn. Verified: native create/join shapes and `unlisted`, `botAllyContext`,
  `checkPlayerCountComposition`, the guest exclusion, one Render instance. PS-1: the `cf-connecting-ip`
  claim was unproven (the direct origin also returns `Server: cloudflare`) → key-source log line +
  two-network live check. Fixes: §15.1 surface declaration + User-Visible Impact, §4 citations, §3
  dependency line, §11 identity model + Limitations, native field reads / `text()` / header read /
  closure isolation / bodyless, the catalog row content, decision-reconciliation wording (D-9905 →
  D-24094 / D-24120; "amends" D-24092; `not_owner`), Vision §12 / §23, locked counts.
- **Copilot (01.7), run 1: RISK → HOLD** (scope-neutral; same allowlist, same +15 tests).
- **Lint (00.3), run 1: FAIL §3 / §4 / §11 / §15.1 → PASS after fixes** (block above).
- **Copilot (01.7), run 2: PASS → CONFIRM** after four wording fixes (the key-source log is a closure
  flag, consistent with closure isolation; tests 5 and 8 extended to cover the one-time log and "a
  native failure records no capacity entry", count unchanged at +15; catalog column `Path`; WP↔EC
  verbatim). **Pre-flight READY / lint PASS confirmed.**
