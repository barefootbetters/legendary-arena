# WP-375 — Solo Bot-Ally Driver: Mixed Human+Bot Match (Server)

**Status:** Draft 2026-07-14 · **PROPOSED (number pending allocation; highest live WP is 374)** · **Standard two-session lane** (D-24028 — NOT lightweight: a new authed endpoint + a per-match runtime driver + a match-metadata contract + a lobby seating behavior). Pairs with **EC-404** (authored). Reserves **D-24170** (lands at execution). **Source design:** `docs/ai/DESIGN-SOLO-BOT-ALLY.md`.
**Primary Layer:** Server (`apps/server/src/bot-ally/`, `apps/server/src/server.mjs`)
**User-Visible Surface:** `arena.legendary-arena.com` play surface — a player can start a cooperative match where the empty seat(s) are filled by a **bot ally** and the match actually starts and plays. **D-24026 live-verify APPLIES** (a real 1-human+1-bot match must reach a terminal state).
**Dependencies:** Autoplay subsystem (WP-163 / EC-180 — `autoplay.mjs`: the create/join/ready/`Master.onUpdate` pattern this packet narrows) ✅; WP-333 (`recordSeatAccount` / seat→account, D-24120 — bots have no row) ✅; WP-011/012 (match create/join + lobby phase) ✅; WP-308 (`nativeLobbyGuard` internal-delegation secret) ✅; the AI policy surface (`createCompetentHeuristicPolicy` / `getLegalMoves` / `buildUIState` / `filterUIStateForAudience`, barrel `packages/game-engine/src/index.ts:458-464`) ✅.
**Baseline:** `origin/main` @ (capture `git rev-parse origin/main` at execution).

---

## Goal

Let a single human play a **cooperative N-seat match** (2–5 seats) with the
non-human seats driven by the existing deterministic bot — the "how do I play a
2-player game solo?" gap. Mechanically this is a `cooperative` match (never a new
engine variant): the human joins seat `"0"` normally, the server reserves and
drives seats `"1"…"botCount"` with a per-match **`BotAllyDriver`**, mirroring the
all-bot autoplay lifecycle (`autoplay.mjs`) but narrowed to the bot seats of a
match that also has a real human. The bot is an **ally** (co-op vs the
Mastermind), never an opponent.

---

## User-Visible Impact

A signed-in player picks "play with a bot ally" (the client affordance is
**WP-376**), the match is created with the bot seat(s) pre-filled, and the play
surface never shows "Waiting for players — 1 of 2": the human readies their seat
and the match starts. On the bot's turn, the bot acts. A lone human can finally
complete a multi-seat cooperative game.

---

## Assumes

- **Autoplay already runs a full live bot lifecycle server-side.** `apps/server/src/autoplay/autoplay.mjs` — create (`:291-301`), join every seat as a bot via the internal secret (`:319-344`), ready-all + `startMatchIfReady` (`:896-910`), move via `master.onUpdate({type,args,credentials,playerID},...)` (`:456-481`). This packet reuses the mechanism for the **bot seats only**. (Verified.)
- **`requiredPlayers` is `ctx.numPlayers` frozen at setup**; the lobby starts when `readyCount >= requiredPlayers`. `buildInitialGameState.ts:545`; `lobby.validate.ts:63`. Bot seats readying + the human readying seat 0 reaches the count. (Verified.)
- **`setPlayerReady` keys off the dispatching `playerID`** (not `ctx.currentPlayer`), so the server can ready each bot seat by dispatching as that seat. `lobby.moves.ts:25-48`; `startMatchIfReady` at `:64`. (Verified.)
- **Bots join via the internal-delegation secret and get NO `match_seat_accounts` row** (D-24120); the secret is process-local, injected at route registration, regenerated on restart. `nativeLobbyGuard.ts:51/165`; `server.mjs:677`. (Verified.)
- **The bot policy consumes only the audience-filtered `UIState` and emits a `ClientTurnIntent`**, deterministic on its own decision seed (does NOT need the match shuffle seed, D-3604). `ai.competent.ts:447-476`; `getLegalMoves` at `ai.legalMoves.ts:108`; pending-choice drain `findPendingChoiceMove` in `botLoopProgress.mjs`. (Verified.)
- **Attribution tolerates a rowless bot seat** — `readSeatAccounts` returns only existing rows and every consumer iterates them (match capture `matchCapture.logic.ts:129`; ranked gate is fail-safe). (Verified — DESIGN §5a.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `docs/ai/DESIGN-SOLO-BOT-ALLY.md` — the design; §3 chosen placement (server-side `Master`), §4a/§4b endpoint + driver, §5 attribution, §7 failure modes.
- `apps/server/src/autoplay/autoplay.mjs` + `botLoopProgress.mjs` — the pattern source.
- `apps/server/src/match/matchGate.routes.ts` — the authed create/join gate the human seat-0 join reuses (WP-376 owns the client side).
- `packages/game-engine/src/lobby/lobby.moves.ts` / `lobby.validate.ts` — ready/start gate.
- `docs/01-VISION.md §23(b)` — co-op framing (bot is an ally; no PvP/versus language in any surfaced string).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; `node:` built-ins; `.test.ts`; full-sentence errors; `// why:` on non-obvious choices; JSDoc; no branching `.reduce()`.
- Server layer only; the bot-ally code may import the engine **barrel** helpers autoplay already uses (`getLegalMoves`, `buildUIState`, `filterUIStateForAudience`, `createCompetentHeuristicPolicy`, `createRandomPolicy`) — no deeper engine reach.

**Packet-specific:**
- **The server NEVER joins seat 0.** The human joins seat 0 via the authed `/api/match/join` (WP-376) so seat 0 gets its `match_seat_accounts` row + own credential. This endpoint reserves + drives only the bot seats.
- **`recordSeatAccount` is NEVER called for a bot seat** (D-24120). A bot seat must stay absent from `match_seat_accounts` — this is load-bearing for WP-377's ranked guard.
- **The endpoint auto-readies the bot seats but MUST NOT call `startMatchIfReady`** — the human readying seat 0 starts the match.
- **Join-before-return ordering:** all bot seats are joined + readied + the driver registered **before** the handler returns `matchId`, so the human arrives to a full lobby (`openSeats === 0` → waiting panel auto-hides).
- **The driver dispatches ONLY for bot seats** (`ctx.currentPlayer ∈ botSeats` or a bot-owned pending choice) — NEVER for seat `"0"`.
- **Never block the human:** a bot `decideTurn` throw / illegal move falls through `endTurn` → `advanceStage` → mark the match **bot-faulted** with a PUBLIC-SAFE co-op sentence (never raw exception/stack/DB/secret/id/path — WP-261 / D-24037).
- **Determinism:** no `Math.random()` / `Date.now()` in the decision path; the bot's only randomness is its seeded PRNG.
- **The internal-delegation secret is obtained via route-registration injection** (`server.mjs:677`), never from config/env.
- **Match tagged `botSeats`** at creation (feeds WP-377's Casual-never-ranked guard, DESIGN §5b/§5c).

**Session protocol:**
- If the poll-vs-subscribe turn-detection choice or the metadata storage location is unresolved, stop and resolve it (see Design note) — do not guess a bgio internal.

---

## Scope (In)

### A) `POST /api/match/create-with-bot` (`apps/server/src/bot-ally/botAllyRoutes.mjs`, new)
- Auth: `authenticated-session-required`. Body `{ numPlayers: 2..5, botCount: 1..(numPlayers-1), policy: 'competent'|'random', setupData: MatchSetupConfig }`.
- Server-side, in order: create (loopback native `create`, secret header) → join seats `"1"…"botCount"` via the secret (capture credentials; **no `recordSeatAccount`**) → register the `BotAllyDriver` (persist `{botSeats, decisionSeed, policy}`) → auto-ready the bot seats via `Master.onUpdate` → return `{ matchId }`. Never joins seat 0; never starts the match. `400` invalid body; `401` unauthed; `500` envelope.
- `registerBotAllyRoutes(router, context)` wired in `server.mjs` with the internal secret injected (mirror autoplay `:677`).

### B) `BotAllyDriver` (`apps/server/src/bot-ally/botAllyDriver.mjs`, new)
- Per-match, held in a module-scope `Map<matchId, BotAllyDriver>` (mirror `autoplayControllers`).
- Turn detection (poll `db.fetch` at `botPollIntervalMs`, **or** a bgio post-update hook — Design note): act only when `ctx.currentPlayer ∈ botSeats` or a bot-owned pending choice exists.
- Per bot turn: `buildUIState` → `filterUIStateForAudience({kind:'player', playerId: botSeat})` → `getLegalMoves` → `policy.decideTurn` → `Master.onUpdate`. Drain bot-owned pending choices via `findPendingChoiceMove`.
- Error containment (endTurn → advanceStage → bot-faulted). Teardown on terminal / abandon / `maxTurns` / fault — removed from the map on EVERY exit path.

### C) Match metadata `{ botSeats, decisionSeed, policy }`
- Persisted with the match so the driver can re-hydrate and WP-377 can read `botSeats`. **Storage location OPEN** (bgio `setupData` vs a `legendary` side-table) — Design note + Decision.

### D) Tests
- `botAllyDriver.test.ts`: acts only on a bot seat's turn; ignores the human's turns; drains a bot-owned choice; teardown on terminal (N=10 leak); fault path marks bot-faulted (never hangs); determinism (same seed + human sequence ⇒ same bot moves).
- `botAllyRoutes.test.ts`: joins only bot seats; seat 0 left open; bot seats readied; match NOT started; `botSeats`+seed persisted; returns `matchId`; body `400`; auth `401`.

---

## Out of Scope

- **Client lobby affordance** — WP-376 (this packet is server-only; no `arena-client` edit).
- **Ranked-eligibility guard** — WP-377 (this packet only *produces* the `botSeats` tag).
- **New bot difficulty tiers** — only `competent` / `random`.
- **Server-restart driver re-hydration** may be split to a fast-follow if (a) below is chosen; the packet MUST still leave in-flight matches in a defined state on restart (Decision).
- **No engine variant change** (`solo` stays exactly 1 player); **no `requiredPlayers` change**.

---

## Design note (surfaced)

Two choices are genuinely open and each needs a D-lock, not a guess:
1. **Turn detection — poll vs subscribe.** Poll `db.fetch` at `botPollIntervalMs` is the proven autoplay idiom and easy to tear down; a bgio v0.50 post-update subscription is lower-latency but couples to framework internals. **Recommend poll for v1**, subscribe as a later optimization.
2. **Restart re-hydration.** Drivers are in-memory. Either scan active `botSeats`-tagged `cooperative` matches on boot and re-register (preferred — a shippable feature survives a deploy), or define restart as ending in-flight bot-ally matches with a surfaced state. **Recommend re-register.**
3. **Metadata storage** — bgio `setupData` (travels with the match, no new table) vs a `legendary.match_bot_ally` side-table (clean queryability for WP-377). **Recommend the side-table** for a first-class `botSeats` read.

---

## Files Expected to Change

- `apps/server/src/bot-ally/botAllyRoutes.mjs` — **new**
- `apps/server/src/bot-ally/botAllyDriver.mjs` — **new**
- `apps/server/src/bot-ally/botAllyRoutes.test.ts` — **new**
- `apps/server/src/bot-ally/botAllyDriver.test.ts` — **new**
- `apps/server/src/server.mjs` — **modified** (register routes + inject secret)
- (if side-table) `data/migrations/030_add_match_bot_ally.sql` — **new**
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (`POST /api/match/create-with-bot` row, `Auth: authenticated-session-required`)
- Governance: `WORK_INDEX.md` (WP-375) + `DECISIONS.md` (**D-24170**) + `STATUS.md` + `EC_INDEX.md`/EC-404 at execution-prep.

---

## Contract

| Key | Value |
|---|---|
| Endpoint | `POST /api/match/create-with-bot`, `authenticated-session-required`, body `{numPlayers:2..5, botCount:1..numPlayers-1, policy:'competent'\|'random', setupData}` → `{matchId}` |
| Human seat | `"0"`, joined by the client via authed `/api/match/join`; server NEVER joins it |
| Bot seats | `"1"…"botCount"`, secret-delegated join, **no `match_seat_accounts` row**, auto-readied, match NOT started here |
| Driver | acts only on `ctx.currentPlayer ∈ botSeats` / bot-owned pending choice; `Master.onUpdate` submit; removed from the map on every exit path |
| Determinism | bot decision seed only; no `Math.random`/`Date.now` in the decision path |
| Fault | endTurn → advanceStage → bot-faulted (public-safe co-op message); never blocks the human |
| Tag | match tagged `botSeats: PlayerID[]` (+ `decisionSeed`, `policy`) — feeds WP-377 |
| Variant | `cooperative` (no new engine variant; `solo` unchanged) |

---

## Acceptance Criteria

1. `POST /api/match/create-with-bot` creates a match, joins only the bot seats via the secret (no `match_seat_accounts` row for them), auto-readies them, does NOT start the match, and returns `{ matchId }` (**AC-1**).
2. After the human joins + readies seat 0, the match starts (`readyCount === requiredPlayers`) and the `BotAllyDriver` submits the bot seat's moves via `Master.onUpdate`, drains bot-owned pending choices, and never dispatches for seat 0 (**AC-2**).
3. A bot `decideTurn` throw / illegal move never hangs the human — the fault fallback runs and the match is marked bot-faulted with a public-safe message (**AC-3**).
4. The driver is removed from the registry on every exit path (terminal / abandon / maxTurns / fault); N=10 lifecycle test shows no leak (**AC-4**).
5. The match is tagged `botSeats` (+ seed, policy); the value is readable for WP-377 (**AC-5**).
6. `pnpm -r build` 0; `pnpm --filter @legendary-arena/server test` green; a live 1-human+1-bot match reaches a terminal state (D-24026) (**AC-6**).

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test
Select-String -Path "apps\server\src\bot-ally\botAllyRoutes.mjs" -Pattern "create-with-bot|recordSeatAccount|startMatchIfReady"  # recordSeatAccount + startMatchIfReady must be ABSENT
Select-String -Path "apps\server\src\bot-ally\botAllyDriver.mjs" -Pattern "Math\.random|Date\.now"  # zero
Select-String -Path "apps\server\src\server.mjs" -Pattern "registerBotAllyRoutes"  # exactly 1
git diff --name-only
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Endpoint reserves + readies bot seats, leaves seat 0 open, never starts the match; join-before-return ordering holds
- [ ] Driver acts only on bot seats, drains bot-owned choices, never blocks the human, torn down on every exit path
- [ ] No `recordSeatAccount` for bot seats; match tagged `botSeats`
- [ ] `pnpm -r build` 0; server test green; live 1-human+1-bot match terminal (D-24026, operator-pending on deploy)
- [ ] `DECISIONS.md` **D-24170** landed; `WORK_INDEX` (WP-375) + `STATUS.md` + `api-endpoints.md` row updated
- [ ] Turn-detection, restart, and metadata-storage choices recorded in D-24170 (not left implicit)

---

## Vision Alignment

**Vision clauses touched:** §23 (co-op — the bot is an ally vs the Mastermind, never a PvP opponent), §23(b) (co-op-only copy on any surfaced string). **Conflict assertion:** No conflict — adds a co-op play mode; no scoring/variant change. **Non-Goal check:** NG — no new engine variant; `solo` invariant preserved. **Determinism:** the bot seat is seeded-deterministic; match shuffle RNG is bgio-owned and untouched.

## Lint Gate Self-Review (00.3)

- §1–§21 PASS or N/A-with-reason. Highlights — §5 standard lane (new endpoint + runtime driver + metadata contract); §8 server boundary (only the engine barrel helpers autoplay already uses); §11 APPLIES (new authed endpoint → `api-endpoints.md` row); §15.1 APPLIES (D-24026 live 1-human+1-bot match); §17 §23(b) co-op framing + determinism addressed.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight: READY** — all deps Done on `main`; the autoplay pattern is the proven precedent. Open design choices (turn detection / restart / storage) are surfaced with recommendations and reserved into D-24170; none blocks a start.

**Copilot: PASS.** Failure modes pinned: (a) human sees "1 of 2" → **join-before-return ordering**; (b) human's turn hangs on the bot → **fault fallback, never-block invariant**; (c) driver leak across matches → **teardown on every exit path, N=10 test**; (d) bot seat gets an account row → **no `recordSeatAccount`, tested**; (e) bot-ally becomes a ranked-farm → **`botSeats` tag produced here, consumed by WP-377**; (f) non-determinism → **seeded PRNG only, `rg` for `Math.random`/`Date.now`**.

## Decision (reserved, lands at execution)

Reserves **D-24170**: solo bot-ally = a `cooperative` match with server-reserved, secret-delegated, auto-readied bot seats driven by a per-match server-side `BotAllyDriver` via `Master.onUpdate`; the human joins seat 0 through the authed path (server never joins seat 0; no `match_seat_accounts` row for bots, D-24120); the endpoint never calls `startMatchIfReady`; the match is tagged `botSeats`. Locks the three open sub-choices at execution: turn detection (recommend poll), restart re-hydration (recommend re-register), metadata storage (recommend side-table). Drafted 2026-07-14; not yet landed.
