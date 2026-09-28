# EC-824 — Guest solo create (Execution Checklist)

**Source:** docs/ai/work-packets/WP-787-guest-solo-create.md
**Layer:** Server (`apps/server`)

## Before Starting
- [ ] `x-legendary-internal-delegation` + `internalDelegationSecret` admit native `/games/legendary-arena/create` and `/{id}/join`; native create returns `{ matchID }`, join returns `{ playerCredentials }`; else STOP
- [ ] `botAllyContext` carries `db`, `database`, `serverUrl`, `internalDelegationSecret`; `add-guest` returns `{ matchId, seat, credentials }`; else STOP
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (baseline 1636 / 265 suites / 1430 pass / 0 fail / 206 skipped at `da4d3a2c`)
- [ ] EXACT target files: `tokenBucketRateLimiter.mjs`, `tokenBucketRateLimiter.test.ts`, `guestSoloRoutes.mjs`, `guestSoloRoutes.test.ts`,
      `server.mjs`, `docs/ai/REFERENCE/api-endpoints.md` + governance; anything else is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- Route `POST /api/match/create-guest-solo`, Auth `guest`; `registerGuestSoloRoutes(router, context)`, called with `botAllyContext` right after `registerGuestAccessRoutes`.
- `GUEST_SOLO_FEATURED_TABLE`: `schemeId: 'core/midtown-bank-robbery'`, `mastermindId: 'core/magneto'`, `villainGroupIds: ['core/brotherhood']`,
  `henchmanGroupIds: ['core/sentinel']`, `heroDeckIds: ['core/spider-man', 'core/hulk', 'core/wolverine']`, `bystandersCount: 30`,
  `woundsCount: 30`, `officersCount: 30`, `sidekicksCount: 12` (identical to WP-785 `FEATURED_TABLE`).
- Native create `{ numPlayers: 1, setupData: GUEST_SOLO_FEATURED_TABLE, unlisted: true }` → read `matchID`; native join
  `{ playerID: '0', playerName: 'Guest' }` → read `playerCredentials`, returned as `credentials`; both with the secret header.
- 200 `{ matchId, seat: '0', credentials }`; `Cache-Control: no-store` on every response.
- Rate key = `koaContext.req.headers['cf-connecting-ip']` when it is a non-empty string, else `koaContext.request.ip` when a non-empty string, else `'unknown'`.
  `GUEST_SOLO_RATE_LIMIT_WINDOW_MS = 60_000`, `DEFAULT_GUEST_SOLO_RATE_LIMIT_CAPACITY = 5`; 429
  `Too many guest matches were started from this connection. Please wait a minute and try again.`
- Key-source log: on the first request after `registerGuestSoloRoutes` runs (a closure flag; production registers once, so once per process), log `[guest-solo] rate-limit key source: <cf-connecting-ip|request.ip|unknown>` (the source name only, never the IP).
- Capacity: prune timestamps older than `GUEST_SOLO_ACTIVE_WINDOW_MS = 7_200_000`; `DEFAULT_MAX_ACTIVE_GUEST_SOLO_MATCHES = 200`; at/over → 503
  `Guest play is at capacity right now. Please sign in to play, or try again in a few minutes.` Record a timestamp only after a successful join.
- Native non-OK → native status + `The guest match could not be created. <native message>` (`<native message>` = the native response's `text()`);
  thrown fetch → 502 `The guest match could not be created because the game server did not respond. Please retry in a moment.`
- `tokenBucketRateLimiter.mjs`: `createTokenBucketRateLimiter({ capacity, windowMs, now })` → `{ consume(key, count) }` (whole-window reset,
  same semantics as `makeGuestJoinRateLimiter`) and `resolveRateLimitKey(koaContext)` → `{ key, source }`.
- The limiter and capacity list live inside `registerGuestSoloRoutes` (closure, never module scope). Seams: `context.guestSoloRateLimitCapacity`,
  `context.maxActiveGuestSoloMatches`, `context.now`.

## Guardrails
- Server only; no `packages/**`, client, engine, migration, or npm-dependency change. `/create`, `/join`, the native guard, autoplay unchanged. 01.5 NOT INVOKED.
- Zero `legendary.*` writes, zero pool queries, zero bgio-store calls from this route; never read the session; never write a seat row.
- Bodyless: no `koaBody()` / `ensureJsonBodyParsed`; the body is never read.
- Rate limit, then capacity, both BEFORE any `fetch`.
- Never log credentials or IPs. Error bodies are `{ error: '<full sentence>' }`.
- Handler split into small helpers (capacity check, create, join); no function over ~30 lines; JSDoc on every function; no nested ternaries.

## Required `// why:` Comments
- `GUEST_SOLO_FEATURED_TABLE`: server-fixed so an unauthenticated caller cannot choose a composition; Brotherhood is Magneto's Always Leads.
- The key order: `request.ip` is a proxy hop (Koa `app.proxy` off); `cf-connecting-ip` delivery and forgeability are unverified until live
  (the direct onrender.com origin also answers `Server: cloudflare`); the capacity cap is the hard bound either way.
- `unlisted: true`: a guest solo table never appears in the public join list.
- The capacity window: an in-process approximation of live guest matches (the reaper removes abandoned rows after 24 h).
- Bodyless: the body is never parsed or read, so no body parser is needed (api-endpoints §Body-Parsing Convention).
- The shared helper: third token-bucket copy → abstracted (code style); the older copies move in a follow-up.

## Files to Produce
- `apps/server/src/match/tokenBucketRateLimiter.mjs` — **new** (shared limiter + key resolver)
- `apps/server/src/match/tokenBucketRateLimiter.test.ts` — **new** (5 tests, one `describe`)
- `apps/server/src/match/guestSoloRoutes.mjs` — **new** (the route, featured table, capacity)
- `apps/server/src/match/guestSoloRoutes.test.ts` — **new** (10 tests, one `describe`; spy pool + spy store; test 5 also pins the
  one-time key-source log, test 8 also proves a native failure records no capacity entry)
- `apps/server/src/server.mjs` — **modified** (one import + one registration)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (one new whole row, `Wired`, `guest`, bodyless, WP-787)
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] `pnpm -r build` 0; server 1636 → 1651 tests / 265 → 267 suites / 1445 pass / 0 fail / 206 skipped (observed baseline + 15 if main moved)
- [ ] `git status --porcelain` ⊆ Files to Produce
- [ ] D-24635 Active + a one-line "amended by D-24635" pointer on D-24092; the `api-endpoints.md` row lands in the same commit
- [ ] STATUS.md: "No user-observable change — infrastructure only" + the live-check result
- [ ] Live (D-24026, post-deploy): signed-out curl → 200 `seat: "0"`; the play URL opens a Magneto / Brotherhood / Midtown lobby-phase match;
      six rapid calls from network A → sixth 429, then one call from network B → 200; the Render log key-source line reads `cf-connecting-ip`
      (if not, or network B gets 429, record it and open the follow-up before calling the WP done); no `match_seat_accounts` row (read-only query)
- [ ] WORK_INDEX WP-787 `[x]` with date; EC_INDEX EC-824 → Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write` + `:check` exit 0

## Common Failure Smells
- Network B also gets 429 → keyed on the proxy hop; the key-source log reads `request.ip`.
- Guest tables show in the lobby join list → `unlisted` dropped from the native create body.
- A spy pool or store records a call → something called `recordSeatAccount`, read the session, or read metadata.
- 503 after a burst of failed creates → the timestamp was recorded before the join succeeded.
- Tests bleed limiter state into each other, or the key-source log fires only in the first test → state hoisted to module scope.
- Native create 400 "requires 1 villain groups" → the featured table drifted from WP-785's.
