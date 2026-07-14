# EC-404 — Solo Bot-Ally Driver (Server) (Execution Checklist)

> **Status:** PROPOSED — number pending governance allocation. Renumbered
> EC-403 → EC-404 to clear the collision with WP-374 (whose checklist is EC-403).
> The block is now EC-404 (driver) / EC-405 (client) / EC-406 (ranked guard).
> **Source design:** `docs/ai/DESIGN-SOLO-BOT-ALLY.md`.
> **Source WP:** [WP-375](../work-packets/WP-375-solo-bot-ally-driver-server.md) (proposed number, pending allocation).

**Layer:** Server (`apps/server/src/bot-ally/`)

## Scope (read first)
IN scope: the `POST /api/match/create-with-bot` endpoint, the per-match
`BotAllyDriver` (turn-gated bot move submission over `Master`), auto-readying the
bot seats, and tagging the match `botSeats`. OUT of scope (separate companion
ECs, both required before the *client* ships): the arena-client lobby affordance
(proposed EC-405, client) and the **seat-count-aware ranked-eligibility guard**
in `competition.logic.ts` (proposed EC-406, competition — implements
DESIGN §5b, the blocking anti-farm guard). This EC only *produces* the `botSeats`
tag; EC-406 *consumes* it.

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it
- [ ] `DESIGN-SOLO-BOT-ALLY.md` is RATIFIED and its §5b/§5c decisions have D-numbers
- [ ] WP for this EC allocated; §Pre-Flight Verdict = READY
- [ ] Autoplay subsystem present as the pattern source: `apps/server/src/autoplay/autoplay.mjs` (create/join `:291`/`:319`, ready+start `:896`, `Master.onUpdate` move `:456`), `botLoopProgress.mjs` (`findPendingChoiceMove`)
- [ ] Internal-delegation secret wiring understood: injected at route registration (`server.mjs:677`), process-local, regenerated on restart (`nativeLobbyGuard.ts:165`)
- [ ] Engine barrel exports available: `getLegalMoves`, `buildUIState`, `filterUIStateForAudience`, `createCompetentHeuristicPolicy`, `createRandomPolicy` (`packages/game-engine/src/index.ts:458-464`)
- [ ] Companion EC-406 (ranked guard) is scheduled — this EC MUST NOT ship to the client without it (DESIGN §5b)
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/server test` runs (pre-existing `join-match.test.ts` fail may persist per WP-159 STATUS; not blocking)

## Locked Values (do not re-derive)
- Endpoint: `POST /api/match/create-with-bot`, Auth: `authenticated-session-required`
- Request body: `{ numPlayers: 2..5, botCount: 1..(numPlayers-1), policy: 'competent' | 'random', setupData: MatchSetupConfig }`
- Response: `{ matchId }` — `200` on success; `400` invalid body (`numPlayers`/`botCount` out of range, `botCount >= numPlayers`); `401` unauthenticated; `500` envelope on fault
- Seat assignment: **human = seat `"0"`**; **bot seats = `"1"` … `String(botCount)`**
- Bot seats join via the **internal-delegation secret** ONLY (mirror `autoplay.mjs:319-344`); **`recordSeatAccount` is NOT called for bot seats** (D-24120 — bots have no `match_seat_accounts` row)
- **Server does NOT join seat 0** — the client joins seat 0 via the existing authed `POST /api/match/join` so seat 0 gets its `match_seat_accounts` row + credential hand-off (`matchGate.routes.ts:298`, `LobbyView.vue:305-309`)
- Bot seats **auto-readied at creation** (`setPlayerReady {ready:true}` dispatched as each bot `playerID` via `Master.onUpdate`); the endpoint **MUST NOT** call `startMatchIfReady` — the human readying seat 0 reaches `readyCount === requiredPlayers` and starts the match (`lobby.validate.ts:63`)
- Ordering: all bot seats joined + readied + driver registered **before** the handler returns `matchId` (so `openSeats` is 0 when the human arrives → `WaitingForPlayersPanel` auto-hides, `:72-78`)
- Driver registry: module-scope `Map<matchId, BotAllyDriver>` (mirror `autoplayControllers`, `autoplay.mjs:40`)
- `botPollIntervalMs = 250` — driver polls `db.fetch(matchId, {state:true})` and acts when it is a bot seat's turn or a bot-owned pending choice exists **[PROPOSED value; confirm vs a bgio post-update hook before locking, DESIGN §4b]**
- `maxTurns = 400` (match-lifetime cap; mirror autoplay)
- Move submission: `Master.onUpdate({ type: moveName, args, credentials: credentials[seat], playerID: seat }, stateID, matchId, seat)` (mirror `autoplay.mjs:456-481`)
- View pipeline per bot turn: `buildUIState(G, lifecycleCtx)` → `filterUIStateForAudience(..., { kind:'player', playerId: botSeat })` → `getLegalMoves(G, lifecycleCtx)` → `policy.decideTurn(view, legalMoves)`
- Forced-choice drain: `findPendingChoiceMove` (`botLoopProgress.mjs`) resolves a bot-owned parked choice with its deterministic default
- Persisted match metadata: `{ botSeats: PlayerID[], decisionSeed: string, policy: 'competent' | 'random' }` **[OPEN: storage location — bgio `setupData` vs a `legendary` side-table; decide + record D-entry]**
- Bot policy: `createCompetentHeuristicPolicy(decisionSeed)` (default) or `createRandomPolicy(decisionSeed)`; decision seed is the bot's OWN seed (tie-breaks only) — it does NOT consume the match shuffle seed (D-3604)
- Fault fallback order: `endTurn` → `advanceStage` → mark match **bot-faulted** with a PUBLIC-SAFE co-op sentence (never raw exception/stack/DB/secret/id/path — WP-261 / D-24037 discipline)

## Guardrails
- The driver dispatches moves **ONLY** for bot seats (`ctx.currentPlayer ∈ botSeats`) or bot-owned pending choices — it **NEVER** dispatches for seat `"0"` (the human drives seat 0 over Socket.IO)
- The endpoint **NEVER** joins seat 0 and **NEVER** calls `startMatchIfReady`
- `recordSeatAccount` is **NEVER** called for a bot seat (D-24120); a bot seat must remain absent from `match_seat_accounts`
- The internal-delegation secret is obtained via route-registration injection (`registerBotAllyRoutes(router, context)` fed from `server.mjs:677`) — **NEVER** from config/env
- Driver removed from the registry + poll cleared on **EVERY** exit path: terminal (`ctx.gameover !== undefined`), human abandonment (disconnect beyond grace), `maxTurns`, and fault (mirror D-16308 leak discipline)
- **Never leave the human blocked**: any `decideTurn` throw / illegal move / stuck bot turn falls through the fault-fallback order and marks bot-faulted — the human's turn is never permanently gated on the bot
- Determinism: no `Math.random()` / `Date.now()` in the decision path; the bot's only randomness is its seeded PRNG (`decisionSeed`)
- Bot view MUST pass through `filterUIStateForAudience` for the bot seat — never hand the bot raw `G` (hidden-info discipline; also what the offline runner + autoplay do)
- The match is tagged `botSeats` at creation; ranked exclusion is **defence-in-depth** — this tag AND EC-406's seat-count check each independently force Casual (DESIGN §5b/§5c)

## Required `// why:` Comments
- `botAllyRoutes.mjs` create handler — why seat 0 is NOT joined server-side (client authed join preserves seat→account mapping + credential hand-off)
- bot-seat join site — why the internal secret + why NO `recordSeatAccount` (D-24120)
- auto-ready-not-start site — why the match is not started here (human seat 0 readying reaches `requiredPlayers`, `lobby.validate.ts:63`)
- `botAllyDriver.mjs` turn-gate — why it acts only on bot seats (human owns seat 0 over the socket)
- `botAllyDriver.mjs` exit cleanup — registry-leak risk on every exit path (D-16308 analog)
- fault-fallback site — the never-block-the-human invariant + public-safe message rule (WP-261 / D-24037)
- `botSeats` tag write — feeds the Casual-never-ranked guard (DESIGN §5b/§5c)

## Files to Produce
- `apps/server/src/bot-ally/botAllyDriver.mjs` — **new** — per-match driver: poll loop, turn-gate, `Master.onUpdate` move submit, forced-choice drain, fault fallback, teardown
- `apps/server/src/bot-ally/botAllyDriver.test.ts` — **new** — acts-only-on-bot-turn; ignores human turns; drains a bot-owned choice; teardown on terminal (N=10 leak); fault path marks bot-faulted (never hangs); determinism (same seed + human sequence ⇒ same bot moves)
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — **new** — `POST /api/match/create-with-bot` handler + `registerBotAllyRoutes(router, context)`
- `apps/server/src/bot-ally/botAllyRoutes.test.ts` — **new** — joins only bot seats; seat 0 left open; bot seats readied; match NOT started; `botSeats` + seed persisted; returns `matchId`; body validation (`400`); auth (`401`)
- `apps/server/src/server.mjs` — **modified** — `registerBotAllyRoutes(server.router, context)` + internal-secret injection (mirror autoplay wiring `:677`)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — 1 new row: `POST /api/match/create-with-bot`, `Status: Wired`, `Auth: authenticated-session-required`
- `docs/ai/DECISIONS.md` — **modified** — new D-entries: bot-ally = `cooperative` with server-reserved bot seats; server-side `Master.onUpdate` placement; Casual-never-ranked (§5c); server-restart driver re-registration policy (§7); match-metadata storage location
- `docs/ai/STATUS.md` — **modified** — bot-ally driver note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off the WP
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — add EC-404 (+ note companion EC-405 client, EC-406 ranked guard)

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `botAllyDriver.test.ts` + `botAllyRoutes.test.ts` pass (incl. N=10 teardown-leak, fault-fallback, determinism)
- [ ] `rg "playerID:\s*['\"]0['\"]" apps/server/src/bot-ally` → zero (driver never dispatches for the human seat)
- [ ] `rg "startMatchIfReady" apps/server/src/bot-ally/botAllyRoutes.mjs` → zero (endpoint never starts the match)
- [ ] `rg "recordSeatAccount" apps/server/src/bot-ally` → zero (bots have no account row)
- [ ] `rg "registerBotAllyRoutes" apps/server/src/server.mjs` → exactly 1
- [ ] `rg "Math\.random|Date\.now" apps/server/src/bot-ally/botAllyDriver.mjs` → zero (determinism)
- [ ] Integration: 1 human + 1 bot reaches a terminal state; the human never observes "Waiting for players"; match record has NO `match_seat_accounts` row for the bot seat AND capture (`matchCapture.logic.ts:129`) tolerates it (`seatsOwned` counts the human only)
- [ ] Integration: the finished bot-ally match is tagged `botSeats` non-empty (feeds EC-406 Casual guard)
- [ ] `api-endpoints.md` has the new row; D-entries Active; STATUS/WORK_INDEX/EC_INDEX updated
- [ ] Commit prefix `EC-404:` (staged files under `apps/server/` + `docs/`)

## Common Failure Smells
- Human sees "1 of 2" → bot seats joined/readied AFTER returning `matchId` (ordering violated), or a bot ready was missed
- Match never starts → bot seats not readied, or the endpoint wrongly called/awaited a start
- Match hangs mid-game → poll not running (driver not detecting the bot turn), or a bot-owned pending choice not drained via `findPendingChoiceMove`
- Human's turn frozen → driver dispatched for seat `"0"`, or the fault path didn't fall back to `endTurn`/`advanceStage`
- Registry grows across matches → teardown missing on an exit path (terminal / abandon / maxTurns / fault)
- Bot-ally score appears as **ranked** → `botSeats` tag not written here, or companion EC-406 (seat-count ranked guard) not landed — this is the DESIGN §5b farm vector; both defences must be present
- Hidden cards visible to the bot's decisions → bot view skipped `filterUIStateForAudience`
- Bot moves non-deterministic across replays → `decisionSeed` not persisted, or `Math.random`/`Date.now` leaked into the decision path
- Bot seat shows up in `match_seat_accounts` → `recordSeatAccount` wrongly called for a bot seat (breaks D-24120 + the EC-406 seat-count guard)
