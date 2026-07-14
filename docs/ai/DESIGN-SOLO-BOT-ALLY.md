# Design: Solo with a Bot Ally ("Solo vs Bot")

> **Status:** PROPOSAL — not yet ratified. No D-/WP-/EC- numbers allocated;
> allocation is a governance step (see §11). Subordinate to
> `docs/ai/ARCHITECTURE.md` and `.claude/rules/*.md`. **Extends** the autoplay
> subsystem (`apps/server/src/autoplay/`, EC-180/181/182) and the AI policy
> surface (`packages/game-engine/src/simulation/`).
> **Date:** 2026-07-14

---

## 1. The problem

A player who wants a **2-player game but has no second human** cannot start one
today. A 2-seat match sets `G.lobby.requiredPlayers = ctx.numPlayers = 2`
(`packages/game-engine/src/setup/buildInitialGameState.ts:545`), and the lobby
will not leave its waiting phase until **two distinct seats each ready
themselves** (`packages/game-engine/src/lobby/lobby.validate.ts:63`). The
waiting-room UI offers only "invite a friend" — no way to fill the second seat
yourself (`apps/arena-client/src/components/WaitingForPlayersPanel.vue:150-158`).
So the player sits at **"Waiting for players — 1 of 2"** forever.

This surfaced from a Registry Viewer bug where the export guard was (correctly)
blocking a `solo` loadout with `player_count: 2`. That guard is right and stays
(`apps/registry-viewer/src/composables/useLoadoutLagnExport.ts:145`): a lone
human loading a 2-seat file hangs in the lobby. The **real** ask —
"how do I play a 2-player game solo?" — is a live-play feature, not an export
tweak: **fill the second co-op seat with a bot.**

### 1a. Framing: it's a bot *ally*, not an opponent

Multiplayer Legendary is **cooperative** — every seat fights the Mastermind
together; there is no competitive variant
(`apps/server/src/match/matchLagn.logic.ts:170-183`, "the game is co-op vs the
Mastermind — never competitive"). So a human + bot 2-seat match is the human and
the bot **on the same side**. All player-facing copy must be co-op-framed per
§23(b) — "Play with a bot ally", "add a bot to your table" — never "vs",
"opponent", or "beat the bot". The colloquial name "solo vs bot" is used only
internally in this doc.

---

## 2. What already exists (and what's missing)

**`solo` = exactly 1 player is a system-wide invariant.** Engine
(`packages/game-engine/src/game.ts:187` "Solo play (1) is a core mode"); server
(`variantForSeatCount`: 1 → `solo`, 2+ → `cooperative`,
`matchLagn.logic.ts:178`). **This proposal does not touch that.** A bot-ally
match is a **`cooperative`, N-seat** match in which one seat is human and the
rest are bot-driven. No new engine variant.

**A live all-bot match already works.** `apps/server/src/autoplay/autoplay.mjs`
("Watch Bot Play", EC-180/181/182) runs the *entire* lifecycle server-side and
is the direct precedent for everything below:

| Lifecycle step | Autoplay does it at | Reused for bot-ally? |
|---|---|---|
| Create match (loopback → native `create`, internal-secret header) | `autoplay.mjs:291-301` | Yes |
| Join **every** seat as a bot via the internal-delegation secret | `autoplay.mjs:319-344` | **Partly** — join only the bot seats, not seat 0 |
| Auto-ready all seats + `startMatchIfReady` | `autoplay.mjs:896-910` | **Partly** — ready only bot seats; human readies their own |
| Drive moves via `Master.onUpdate` (in-process, server-authoritative) | `autoplay.mjs:456-481` | Yes — but gated on "it's a bot seat's turn" |
| Reuse `getLegalMoves` / `buildUIState` / `filterUIStateForAudience` / `decideTurn` | `autoplay.mjs:16-23`, `:620-631` | Yes |
| Drain pending forced choices | `botLoopProgress.mjs` (`findPendingChoiceMove`) | Yes |

**The gap:** autoplay always seats **every** player as a bot and the human only
**spectates** (`autoplay.mjs:319` loops over *all* seats). There is **no mixed
human + bot match** — no concept of one human seat sharing a live match with a
bot seat, no per-seat bot driver attachable to a human-created match. That mixed
match is exactly what this feature adds.

**The bot itself is ready to reuse as-is.**
`createCompetentHeuristicPolicy(seed: string): AIPolicy`
(`packages/game-engine/src/simulation/ai.competent.ts:447-476`) exposes
`decideTurn(playerView: UIState, legalMoves: LegalMove[]): ClientTurnIntent`.
It is deterministic (its own decision seed, tie-breaks only — **does not need
the match shuffle seed**, D-3604), and it consumes only the **audience-filtered
`UIState`** a seat legitimately sees — never raw `G`. Output is a
`ClientTurnIntent` (`network/intent.types.ts:35-54`) with `move.name` + `args`,
directly submittable.

---

## 3. Chosen architecture

**Server-side bot driver, in the boardgame.io server process, submitting the
bot seat's moves via `Master.onUpdate` — the autoplay pattern, narrowed to the
bot seat(s) of a mixed match.**

```
Human browser (seat "0", authenticated, Socket.IO) ─┐
                                                     ├─► boardgame.io Server (authoritative G, Postgres)
Bot Driver (in server process, seat "1"…"N-1") ─────┘        ▲
   loop: when ctx.currentPlayer is a bot seat →               │ broadcasts
     buildUIState → filterUIStateForAudience(bot seat) →       │
     getLegalMoves → policy.decideTurn → Master.onUpdate ──────┘
```

### Why this placement (rejected alternatives)

- **Client-side bot (in the human's browser) — rejected.** Moves are
  `client: false` / server-authoritative (`game.ts:352-386`, D-10008); the
  client only holds a filtered `UIState`, not raw `G`, and a client-computed
  move would be untrusted. The engine architecture actively pushes bot execution
  server-side.
- **Separate bot client over Socket.IO (headless human) — rejected as heavier.**
  Works and is authoritative, but adds a second socket connection and a second
  client lifecycle per match for no benefit over in-process `Master.onUpdate`,
  which autoplay already proves.
- **In-process `runSimulation` reducer loop — rejected for live play.** The
  offline runner (`simulation.runner.ts`) applies moves by calling engine move
  functions directly against its **own** in-memory `G`. In a live match the
  authoritative `G` lives in the boardgame.io server/DB; the bot must mutate
  *that* state, so it must go through `Master`, not a private reducer.

---

## 4. Component changes

### 4a. Server — new bot-ally subsystem (`apps/server/src/bot-ally/`)

**New endpoint `POST /api/match/create-with-bot`.** Body:
`{ numPlayers: 2..5, botCount: 1..(numPlayers-1), policy: 'competent'|'random', setupData }`.
Auth: **human session required** (same gate as `/api/match/create`,
`matchGate.routes.ts:238`). Handler, server-side, in order:

1. **Create** the match (loopback → native `create`, internal-secret header),
   `numPlayers` as given. (mirror `autoplay.mjs:291-301`)
2. **Reserve + join the bot seats only** — seats `"1"…"botCount"` via the
   internal-delegation secret, capturing each seat's `playerCredentials`.
   (mirror `autoplay.mjs:319-344`, but skip seat `"0"`)
3. **Register a `BotAllyDriver`** for this match (see 4b) holding the bot seats'
   credentials + a per-match **decision seed** (persist for replay/repro).
4. **Immediately ready the bot seats** (`setPlayerReady {ready:true}` dispatched
   as each bot `playerID` via `Master.onUpdate`). Do **not** start the match.
5. Return `{ matchId }` to the client. The human then performs the **normal
   authenticated join** for seat `"0"` (`/api/match/join`,
   `matchGate.routes.ts:298`) so seat 0 gets a real `match_seat_accounts` row
   and its own credential via the existing URL hand-off
   (`LobbyView.vue:305-309`).

> **Ordering guarantee:** because the bot seats are joined **before** the client
> is told the match exists, by the time the human joins seat 0 all seats are
> filled → `openSeats` hits 0 → the `WaitingForPlayersPanel` auto-hides
> (`WaitingForPlayersPanel.vue:72-78`). The human never sees "1 of 2". When the
> human readies seat 0, `readyCount` reaches `requiredPlayers` (bot seats already
> ready) and `startMatchIfReady` fires normally.

### 4b. Server — `BotAllyDriver` (per match)

A per-match driver, held in a `Map<matchId, BotAllyDriver>` registry (mirror
autoplay's `autoplayControllers`, `autoplay.mjs:40`). Responsibilities:

- **Turn detection.** Unlike autoplay (which owns every seat and self-paces), the
  bot-ally driver must act **only when it is a bot seat's turn** or when there is
  a **pending forced choice owned by a bot seat**. It must react to the human's
  moves. Two viable mechanisms:
  - **(A) Poll** `db.fetch(matchId, {state:true})` on a short interval (autoplay
    already reads state back this way, `autoplay.mjs`), check
    `ctx.currentPlayer` / pending-choice ownership, act if it belongs to a bot
    seat. Simplest, matches the existing idiom. Cost: a timer per active match.
  - **(B) Subscribe** to the boardgame.io server's post-update hook / transport
    broadcast and act on state deltas. Lower latency, no idle polling, but
    couples to framework internals.
  - **Recommendation: start with (A) poll** (proven idiom, easy to reason about,
    easy to tear down), leave (B) as an optimization. **[OPEN: confirm bgio
    v0.50 exposes a clean post-update subscription before committing to (A).]**
- **Move production.** For a bot seat's turn:
  `buildUIState(G, lifecycleContext)` →
  `filterUIStateForAudience(..., {kind:'player', playerId: botSeat})` →
  `getLegalMoves(G, lifecycleContext)` → `policy.decideTurn(view, legalMoves)` →
  `Master.onUpdate(MAKE_MOVE{type,args,credentials,playerID}, stateID, matchId, botSeat)`.
  (identical shape to `autoplay.mjs:456-481`, `:620-631`)
- **Forced-choice draining.** When the engine parks a forced choice on a bot seat
  (KO-a-hero, optional-KO-reward, victory-pile pick, draw-or-empowered,
  return-zero-cost-discard), resolve it with the deterministic default via
  `findPendingChoiceMove` (`botLoopProgress.mjs`) exactly as autoplay does. The
  bot must not block the human waiting on a bot-owned choice.
- **Error containment.** If `decideTurn` throws or returns an illegal move, the
  match must **not** hang. Fallback: attempt `endTurn`/`advanceStage`; if still
  stuck, mark the match **bot-faulted** and surface a co-op-framed error to the
  human ("the bot ally couldn't continue"). Never leave the human's turn
  permanently blocked on the bot.
- **Teardown.** Remove the driver + stop the poll on: match terminal
  (`evaluateEndgame` reports an end state), human abandonment (disconnect beyond
  a grace window), or explicit leave. See §7 for restart.

### 4c. Client — `apps/arena-client`

- **Lobby affordance.** Add a "Play with a bot ally" control to `LobbyView.vue`,
  modeled on the existing "Watch Bot Play" form (`LobbyView.vue:524-544`):
  choose total seats (2–5) and how many are bots (default: 1 human + 1 bot),
  policy (default `competent`). On submit → `POST /api/match/create-with-bot`,
  then perform the normal authenticated seat-0 join and navigate to the play
  surface with the human's own `player`/`credentials` query params.
- **Waiting room.** No code change strictly required (the ordering guarantee in
  §4a makes the panel auto-hide), but **verify** the panel never flashes "invite
  a friend" for a bot-filled seat, and confirm its copy stays co-op.
- **In-match indication.** Show which seat(s) are the bot ally (a badge on the
  seat), so the human understands who is acting when the bot takes its turn.
  Co-op copy only.

### 4d. Engine — likely **no change**

The engine already supports N-seat cooperative play and exposes every helper the
driver needs (`getLegalMoves`, `buildUIState`, `filterUIStateForAudience`,
`createCompetentHeuristicPolicy`, all barrel-exported at
`packages/game-engine/src/index.ts:458-464`). The lobby ready/start gate works
unchanged once the bot seats self-ready. **No new variant, no `requiredPlayers`
change.**

---

## 5. Data / attribution consequences

Bot seats have no `match_seat_accounts` row (they join via the internal secret,
not a session — `seatAccount.logic.ts:66-70`; consistent with autoplay and
D-24120). The attribution paths were audited against a missing bot row on two
axes: **does it crash**, and **does it leak**.

### 5a. Crash / error tolerance — VERIFIED SAFE

`readSeatAccounts` (`seatAccount.logic.ts:72-87`) returns **only the rows that
exist** — a bot seat is simply absent, never a null/placeholder. Every consumer
iterates or maps that list, so a bot seat is skipped, not errored:

- **Match capture (D-24119 / WP-335)** — `matchCapture.logic.ts:129-159` loops
  `for (const seat of seats)` and `assignReplayOwnership` per **returned** seat;
  `seatsOwned` counts humans only; no cross-check against `numPlayers`. Bot seat
  → not iterated. Also best-effort per seat (a throw is logged, other seats + the
  artifact are unaffected).
- **Ranked eligibility** — `competition.logic.ts:487-491` maps the roster to
  account ids and is fail-safe to Casual on any throw (`:492-506`).
- **Invite gate** (`matchInvites.logic.ts:141`) and **LAGN-export gate**
  (`matchLagn.routes.ts:222`) check the **caller's own** account against the
  roster; a missing bot row is irrelevant to that membership test.

**Conclusion:** the feature will **not break** attribution. The "must tolerate
the gap" pre-ship check passes on the crash axis. ✅

### 5b. Ranked-eligibility LEAK — MUST BE GUARDED (blocking)

`computeRankedEligibility` (`competition.logic.ts:482-507`) is **blind to bot
seats**. It reads the human roster and returns `areAllMutualFriends(roster)`,
where an `n ≤ 1` roster is **vacuously ranked-eligible** (`:474-475`).

For a 1-human + 1-bot match, `readSeatAccounts` returns **just the human**, so
`roster.length === 1` → vacuously eligible → the human can submit a **ranked**
competitive score (with `player_count = 2`) via the normal request path
(`submitCompetitiveScoreByMatchIdForRequest`, `:394`, which calls
`computeRankedEligibility` at `:457`). This **bypasses the mutual-friend-clique
requirement** that a real 2-human ranked match must satisfy — bot-assist becomes
a *strictly easier* path to a ranked N-player score than the intended all-human
path. This is a leaderboard-integrity / ranked-farming vector, reachable through
the existing score-submission flow.

**Required guard (blocking for ship):** exclude any bot-occupied match from
ranked. Preferred implementation — make the ranked gate **seat-count aware**
rather than roster-only:

```
ranked ⇔ readSeatAccounts(matchId).length === match.numPlayers
         && areAllMutualFriends(roster)
```

i.e. **every** seat must map to a mutual-friend account. This closes the bot gap
*and* the analogous guest gap (guests also have no row, D-24120) in one check,
and it degrades to the existing behavior for all-human matches. Belt-and-braces:
also **tag the match** with `botSeats: PlayerID[]` at creation (§4a step 3) and
short-circuit ranked to `false` when the tag is non-empty, so the exclusion does
not depend solely on a row-count inference. Add a regression test:
*1 human + 1 bot ⇒ `isRankedEligible === false`.*

### 5c. Match record / stats tagging

Tag bot-ally matches with `botSeats: PlayerID[]` on match metadata at creation
(§4a step 3). Beyond the ranked guard (5b), this lets any future human-vs-human
stats / leaderboard surface filter these matches out explicitly.

**DECIDED (2026-07-14): Casual history yes, ranked never.** A bot-ally match's
result appears in the participating human's own **Casual** score history
(`is_ranked_eligible = false`), and is **never** ranked-eligible under any
condition (enforced by the 5b seat-count guard AND the non-empty `botSeats` tag
short-circuit — either alone is sufficient; both are required defence-in-depth).
No separate achievement/progression surface is in scope for v1; if one is added
later it inherits this rule — bot-ally counts as Casual, never ranked.

---

## 6. Determinism & seeding

- The bot needs **only its own decision seed** (persist per match for
  reproducibility). It does **not** consume the match shuffle seed (D-3604;
  `ai.competent.ts:16-18`).
- The **match shuffle seed** is owned and persisted internally by boardgame.io
  in the authoritative match state — already available server-side, no config
  surface needed.
- Persisting `{decisionSeed, policy, botSeats}` with the match makes a bot-ally
  match fully replayable through existing replay tooling.

---

## 7. Failure modes & lifecycle robustness

| Risk | Mitigation |
|---|---|
| **Server restart** kills in-memory drivers mid-match | Drivers are in-process (like autoplay). Either (a) on boot, scan active `cooperative` matches tagged with `botSeats` and **re-register** drivers, or (b) accept that a restart ends in-flight bot-ally matches and surface it. **[OPEN — pick a; (a) preferred for a shippable feature.]** |
| **Internal-delegation secret** is process-local, regenerated on restart (`nativeLobbyGuard.ts:165`, `server.mjs:659`) | The driver must obtain the secret the **autoplay way** — injected at route registration (`server.mjs:677`) — never from config. A re-registered driver (7a) must re-acquire the current secret. |
| **Bot errors / illegal move** hangs the human | §4b error containment: fallback endTurn → mark bot-faulted → co-op error to human. Add a hard per-bot-turn timeout. |
| **Human abandons**; driver polls forever | Teardown on human disconnect beyond a grace window; cap match lifetime (autoplay caps at `maxTurns = 400`). |
| **Human tries to invite a friend** into a bot seat | Bot seats are already filled, so `openSeats > 0` is false and the invite panel is hidden; also reject invites to a match tagged with `botSeats` server-side. |
| **Idle poll cost** at scale (one timer per active match) | Acceptable at current scale; revisit with mechanism (B) subscription if match volume grows. |

---

## 8. Testing

- **Unit — `BotAllyDriver`:** acts only when `ctx.currentPlayer` is a bot seat;
  ignores the human's turns; drains a bot-owned forced choice; tears down on
  terminal state; error path marks bot-faulted rather than hanging.
- **Unit — create-with-bot handler:** joins only the bot seats via the secret;
  seat 0 left open for the human; bot seats auto-readied; returns `matchId`.
- **Integration — full mixed match:** one human seat + one bot seat reaches a
  terminal state; the human never observes "Waiting for players"; the bot takes
  its turns; the match record has no `match_seat_accounts` row for the bot seat
  and result capture tolerates it.
- **Determinism:** same `decisionSeed` + same human move sequence ⇒ identical bot
  moves.
- **Regression:** existing all-bot autoplay (EC-180/181/182) unchanged; existing
  human-only lobby start unchanged.

---

## 9. Rollout

1. Engine: confirm no change needed (spike: drive a 2-seat match where seat 1 is
   bot-driven through the *offline* runner to validate the view→legalMoves→
   decideTurn loop for a **non-index-0** seat).
2. Server: `create-with-bot` endpoint + `BotAllyDriver` + registry + secret
   wiring + restart re-registration (7a).
3. Server: attribution/result-capture audit (§5) — must pass before client ships.
4. Client: lobby affordance + seat-0 join flow + bot-seat badge.
5. Verify waiting-room never flashes for bot seats; co-op copy review (§23(b)).

---

## 10. Non-goals

- **No new engine variant.** `solo` stays "exactly 1 player"; bot-ally is
  `cooperative`.
- **No competitive/PvP.** The game is co-op only; the bot is an ally.
- **No client-side bot execution.**
- **No change to the Registry Viewer export guard** — it correctly blocks
  `solo` + `player_count ≠ 1` and is unaffected by this feature.
- **No difficulty tiers beyond existing policies** (`competent`, `random`) in v1;
  tuned bot difficulty is a later enhancement.

---

## 11. Open questions for governance / decision

1. **Allocate numbers:** this proposal needs a WP (server driver), likely a
   second WP (client), EC checklists, and D- entries for the key decisions
   (bot-ally = cooperative-with-reserved-seats; server-side `Master` placement;
   restart re-registration policy). Not self-allocated here.
2. **Turn detection:** poll (A) vs subscribe (B) — confirm bgio v0.50
   post-update hook before locking (A).
3. **Restart policy:** re-register drivers on boot (preferred) vs end-on-restart.
4. **Attribution:** ✅ crash-tolerance verified (§5a) — result-capture does not
   break on a bot seat with no account row. ⚠️ **Blocking guard identified**
   (§5b): the ranked-eligibility gate is bot-blind and would let a 1-human+1-bot
   match submit a *ranked* score, bypassing the mutual-friend requirement. Ship
   requires the seat-count-aware ranked guard + `botSeats` tag + regression test.
   ✅ **Progression policy DECIDED (2026-07-14):** Casual history yes, ranked
   never (§5c). No longer open.
5. **Multi-bot:** v1 default is 1 human + 1 bot; do we ship 1 human + up-to-4
   bots at once, or cap at 1 bot initially?
