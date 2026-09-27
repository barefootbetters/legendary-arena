# WP-773 — Bot-ally turn pacing: a readable pause between a bot ally's moves

**Status:** Draft 2026-09-26 · **EC:** EC-810 · **Reserves:** D-24610
**Primary Layer:** Server (`apps/server/src/bot-ally/`) — no engine, client or registry change
**User-Visible Surface:** play.legendary-arena.com (solo + bot-ally matches)
**Lane:** standard two-session. It is small, but it changes the bot-ally driver's tick
duration, which the D-24256 ownership lease depends on, and 01.0a resolves any doubt about
lightweight eligibility against it.
**Baseline:** `origin/main` @ `32fd8ba2` (2026-09-26; the reserve #2435 landed).

## Goal

In a solo match with a bot ally, the bot's turn should be something the human can watch.
Today the driver plays the bot's whole turn back to back — reveal, card plays, recruits,
fights, end turn — as fast as the server can write it. Every villain slash, combo burst and
call-out word its moves trigger stacks on top of the last, and the turn is over before the
player can read it. This packet adds a short, fixed pause after each of the bot's
board-visible moves, so each move lands and animates before the next one.

## User-Visible Impact

- During a bot ally's turn, each board-changing move is followed by a pause of 0.8 s: a
  villain reveal, a recruit, a fight, an exorcise, or a pending-choice answer. Each card play
  is followed by a shorter 0.4 s pause. The shipped feel layer (villain slash, combo flash,
  takedown words, notable-event chips) plays each beat instead of piling them up.
- Stage steps and ending the turn are not paused.
- A typical turn is fully paced. Take a reveal, six plays, two recruits and two fights:
  0.8 + 6 × 0.4 + 2 × 0.8 + 2 × 0.8 = 6.4 s of pauses, inside the 7.2 s budget. A move whose
  pause would overflow the tick's 7.2 s budget runs unpaced (a later, cheaper pause can still fit).
- With several bot allies, each bot's turn adds up to about 7.2 s. At the 5-seat maximum,
  four bots add up to about 29 s per round.
- The human's own moves are unchanged and stay instant.

## Assumes

- **WP-375 / D-24170 ✅** — the per-match bot-ally driver (`apps/server/src/bot-ally/botAllyDriver.mjs`)
  polls every 250 ms (`BOT_POLL_INTERVAL_MS`). It drives a bot turn inside one poll tick
  (`runTick` ~L560 → `driveBotTurn` ~L880 → `attemptBotTurn` ~L1093). Ticks never overlap
  (`tickInProgress`). The only driver-creation path is `startDriverForMatch`
  (`botAllyRoutes.mjs` ~L515), which both create and revival use.
- **D-24230 ✅** — `driveBotTurn` re-runs `attemptBotTurn` **once**, in the same tick, after a fault.
- **WP-424 / D-24244 ✅** — `attemptBotTurn` bails at the top of each step when `driver.stopped`
  is set (~L1106). `stop()` sets `stopped`, clears the poll timer and de-registers the driver.
  It does not cancel an in-flight await.
- **WP-437 / D-24256 ✅** — the 15 s ownership lease (`BOT_ALLY_LEASE_TTL_MS = 15000`,
  `botAllyOwnership.mjs` ~L63) is claimed or renewed **once per tick**, before the turn
  (`runTick` ~L578). D-24256 (DECISIONS.md ~L33391) **rejected** renewing inside the turn loop
  "as touching the hot path + retry budgets". Its TTL rationale assumes a tick is
  "~sub-second when the DB is healthy" (`botAllyOwnership.mjs` ~L51-54; DECISIONS.md ~L33382).
- **D-24593 ✅** — a seat choice owed by a non-active bot seat is answered on the separate
  seat-choice path (`handleSeatChoiceTick` / `submitBotSeatChoice`). An outstanding seat
  choice makes `attemptBotTurn` return `yielded`.
- **`moveAdvanced`** is true only when `_stateID` changed **and** `dispatchMadeRealProgress`
  (~L1049) confirms real progress (~L1182-1193).
- **D-24234 ✅** — the client's spectator-staleness watchdog (`SPECTATOR_STALE_TIMEOUT_MS = 15000`,
  `apps/arena-client/src/client/bgioClient.ts` ~L110-114) resyncs only after 15 s with no frame,
  and its comment already assumes a bot cadence of about 1 s per move. Each advanced move still
  pushes a frame.
- **D-24231 ✅** — the bot-ally stall banner is status-based (`useBotAllyStatus.ts` ~L129), not
  time-based, so a slower bot turn cannot trip it.
- **Watch Bot Play precedent** — its default delay between moves is 800 ms (`apps/server/src/autoplay/autoplay.mjs`
  ~L329, clamped to 100–5000; the lobby default at `apps/arena-client/src/lobby/LobbyView.vue` ~L145).
- `pnpm -r build` exits 0 and the server suite is green on `origin/main` (CI green on the baseline).

## Context (Read First)

- **The gap, in code.** In `attemptBotTurn`, a successful submit sets `moveAdvanced` and
  breaks out of the submit loop. The `while` loop then goes to its loop-top stop check and
  straight to the next `fetchState`. The only `delay()` calls are the submit retry back-offs
  (~L767, ~L1198). `delay(ms)` is module-private (~L138).
- **Which moves show on the board** (redaction per D-12803 / WP-128):
  - `revealVillainCard`, `recruitHero`, `fightVillain`, `fightMastermind` and
    `exorciseHauntedHero` change the City, HQ, villain deck or Mastermind.
  - A `playCard` shows as the bot's in-play count, a log line and `lastPlayEffectsFired` (the
    combo flash). That is a lighter beat, so it gets the shorter pause.
  - `resolve*` answers mostly show as counts and log lines, but can move cards, so they get the
    full pause.
  - `advanceStage` changes the stage label, and at cleanup runs end-of-turn cleanup and ends the turn.
  - `endTurn` hands the turn over.
- **Why pause after the move.** The pacing invariant "one crescendo per resolved move … never
  a collision" (`wiki/design-system-overview.md#pacing-invariants`) is what back-to-back bot
  moves violate. A pause after each move lets its beat play out before the next move's beat.
- **Why a per-tick millisecond budget.** A paced tick must still finish well inside the 15 s
  lease TTL. Otherwise, during a rolling deploy, a peer instance could claim the lease mid-turn
  (D-24256's residual).
  - The budget counts the pause milliseconds **the driver itself schedules** (the sum of fixed
    constants). No wall clock is read, so the driver stays clock-free ("Counting poll ticks
    rather than reading a wall clock keeps the driver deterministic and clock-free", ~L152).
  - The budget is held per `driveBotTurn` call, i.e. per tick. It is **shared across the
    D-24230 retry**, so a faulted-then-retried turn cannot take a second budget inside the same
    lease renewal.
  - A turn resumed after a `yielded` return is a new tick with a new lease renewal, and it gets
    a new budget.
- **What this changes about D-24256.** The lease *mechanism* is unchanged: it is still renewed
  once per tick, and never inside the turn. But its TTL *premise* ("a tick is sub-second on a
  healthy DB") no longer holds. A healthy paced tick now takes up to about 7.2 s plus DB time.
  One DB blip inside that tick (the retry back-offs, ~1.5 s per wedged move) narrows the margin
  further. D-24610 records this amendment. The TTL rationale comment in `botAllyOwnership.mjs`
  is updated to match, as a comment-only edit.
- **Why this does not conflict with Vision §16 ("gameplay must feel instantaneous").** §16 is
  about lag from computation. This is deliberate pacing of the *ally's* turn so the human can
  follow it, the way a tabletop player watches their ally play (Vision §4). The human's own
  actions are untouched. D-24610 records this reading.
- **Layer.** `docs/ai/ARCHITECTURE.md` §Layer Boundary: the server wires and schedules, and the
  engine decides. The pause is scheduling only.
- **No existing pacing to reuse.** Nothing in `apps/server/src/bot-ally/` or
  `docs/ai/DESIGN-SOLO-BOT-ALLY.md` paces moves, and no test asserts turn speed.
  `wiki/bot-ally.md` states the opposite today (~L70-71 "There is no artificial 'thinking'
  pause…", ~L139 "No think-time…"). This packet corrects it.

## Non-Negotiable Constraints

**Server-wide (do not remove):**
- The server never decides gameplay. The bot's move **choices and their order are
  unchanged**; only the time between submissions changes.
- No `boardgame.io` or `pg` import in `botAllyDriver.mjs`.
- ESM only, Node v22+, the `node:` prefix; tests are `.test.ts` with `node:test`.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: JSDoc on every function, no
  abbreviations, full-sentence log text, `// why:` on every constant whose value is not self-evident.

**Packet-specific:**
- **The lease mechanism is unchanged.** No lease call is added inside `driveBotTurn` or
  `attemptBotTurn`. Only the TTL rationale comment in `botAllyOwnership.mjs` changes, as
  comment-only.
- **No other budget changes:** `BOT_POLL_INTERVAL_MS`, `BOT_MOVE_SUBMIT_ATTEMPTS`,
  `BOT_MOVE_RETRY_BASE_MS`, `BOT_MAX_MOVE_STEPS_PER_TURN`, `BOT_MAX_TURNS` and
  `BOT_ALLY_LEASE_TTL_MS` keep their values.
- **Retry back-offs stay on the module `delay`, never the injected `pause`.**
- **Clock-free.** The pause is an awaited timer, and the budget sums the constants the driver
  schedules. No `Date.now` / `performance.now`, and no elapsed-time decision.
- **The pause decision looks only at the move just submitted** (its name and `moveAdvanced`).
  It never looks ahead at the post-move state. So a paced move that causes a `passed` or
  `yielded` return is still followed by its pause.
- **No test awaits real pacing time.** Every harness that drives a paced move injects a
  recording no-op `pause`.
- **Watch Bot Play (`apps/server/src/autoplay/`) is untouched.**
- `// why:` comments and JSDoc name "the ownership lease" / "the lease renewal". They never use
  the call form `renewOrAcquireLease(` (Verification Step 3 counts it). The comment edit in
  `botAllyOwnership.mjs` never restates the TTL constant's declaration (Step 5 counts it).

**Session protocol:** if a bot move you did not expect to pace (or not to pace) shows up in a
test or in play, STOP and ask. Do not widen or narrow the move classes on your own.

## Locked Contract Values

- New exported constants in `apps/server/src/bot-ally/botAllyDriver.mjs`, each with a `// why:`:
  - `export const BOT_MOVE_PACING_MS = 800;` — the pause after a board-changing move. It
    matches Watch Bot Play's default delay between moves.
  - `export const BOT_PLAY_CARD_PACING_MS = 400;` — the pause after a `playCard`, a lighter beat
    (a count, a log line and the combo flash).
  - `export const BOT_PACING_BUDGET_MS_PER_TICK = 7200;` — the most pause time one tick
    schedules. It is under half of `BOT_ALLY_LEASE_TTL_MS` (15 000), because the lease is
    renewed once per tick.
  - `export const BOT_UNPACED_MOVE_NAMES = Object.freeze(['advanceStage', 'endTurn']);`
- A pure helper `pacingMsForMove(moveName, movePacingMs, playCardPacingMs)` returns `0` for a
  name in `BOT_UNPACED_MOVE_NAMES`, `playCardPacingMs` for `'playCard'`, and `movePacingMs` for
  every other name. It is exported for tests.
- New optional `deps` overrides, resolved once in `createBotAllyDriver` next to the existing
  overrides, and passed down through the `limits` object:
  - `movePacingMs?: number` (default `BOT_MOVE_PACING_MS`);
  - `playCardPacingMs?: number` (default `BOT_PLAY_CARD_PACING_MS`);
  - `pacingBudgetMsPerTick?: number` (default `BOT_PACING_BUDGET_MS_PER_TICK`);
  - `pause?: (ms: number) => Promise<void>` (default: the module's existing `delay`).
- **The pacing rule.** `driveBotTurn` creates one budget record `{ spentMs: 0 }` per call and
  passes the same record to both `attemptBotTurn` calls (the first attempt and the D-24230
  retry). In `attemptBotTurn`, after the submit loop, when `moveAdvanced === true`:
  - let `pauseMs = pacingMsForMove(move.name, ...)`;
  - if `pauseMs > 0` **and** `budget.spentMs + pauseMs <= pacingBudgetMsPerTick`, then
    `await pause(pauseMs)` and add `pauseMs` to `budget.spentMs`;
  - otherwise do not pause.
- **No pause** on a move that did not advance (the retry path), on `runFaultFallback`
  dispatches, or on the seat-choice path (`handleSeatChoiceTick` / `submitBotSeatChoice`). A
  vanished or game-over result returns from inside the submit loop, before the pause.
- The pacing decision lives in `pacingMsForMove` plus a short block at the pause site.
  `attemptBotTurn` (already about 135 lines) grows by no more than about 10 lines.
- A stop during a pause is honoured by the existing loop-top `driver.stopped` check: no further
  `fetchState` or `submitMove` runs after the pause resolves. `stop()` is not changed.
- The `createBotAllyDriver` deps JSDoc documents the four new deps, and adds the missing line
  for the lease-renewal dep (described as "the ownership lease renewal", not in call form).

## Scope (In)

### A) Pacing in the driver — `apps/server/src/bot-ally/botAllyDriver.mjs`
- The constants, `pacingMsForMove`, the overrides, the shared per-tick budget and the rule
  above. `driveBotTurn` / `attemptBotTurn` parameters may change (they are module-internal).
  The behavior is locked; the plumbing is not.

### B) Lease rationale comment — `apps/server/src/bot-ally/botAllyOwnership.mjs`
- Comment-only. The TTL `// why:` now says a tick is at most one paced turn old: up to
  `BOT_PACING_BUDGET_MS_PER_TICK` of pauses plus DB time. It cites D-24610, which amends the
  D-24256 premise, and keeps the residual note. `BOT_ALLY_LEASE_TTL_MS` is unchanged.

### C) Tests — `apps/server/src/bot-ally/botAllyDriver.test.ts`
- The `makeDeps` harness injects a recording no-op `pause` by default.
- **`pacingMsForMove`:** `advanceStage` / `endTurn` → 0, `playCard` → 400, `revealVillainCard`
  / `fightVillain` / `recruitHero` / `resolveKoHeroChoice` → 800. The test also asserts, at
  runtime, that `'playCard'`, `'advanceStage'`, `'endTurn'`, `'revealVillainCard'`, `'recruitHero'`
  and `'fightVillain'` are keys of `LegendaryGame.moves`, imported from
  `@legendary-arena/game-engine` in the test only (the driver's imports are unchanged). This pins
  the name literals against an engine rename (D-24372).
- **Paced set:** a bot turn submitting `revealVillainCard`, `playCard`, `playCard`,
  `recruitHero`, `fightVillain`, `advanceStage`, `endTurn` records exactly
  `[800, 400, 400, 800, 800]`.
- **Override + identical sequence (AC 5):** the same scenario with `movePacingMs: 0` and
  `playCardPacingMs: 0` records no pause, and its `submitCalls` equal the default run's.
- **Budget** (one test, three cases):
  - (a) 12 `fightVillain` then `endTurn` records exactly 9 pauses of 800 (7 200 ms; this pins `<=`).
  - (b) 20 `playCard` then `endTurn` records exactly 18 pauses of 400.
  - (c) Skip, not stop: `playCard`, 9 × `fightVillain`, `playCard`, `endTurn` records exactly
    `[400, 800 × 8, 400]`. The 9th fight's 800 would reach 7 600 ms and is skipped; the last 400
    lands at exactly 7 200 ms. An implementation that stops pacing at the first overflow would
    record 9 pauses and fail.
- **Budget shared across the retry:**
  - Attempt 1 makes 6 `fightVillain` moves. Then `decide` returns `null` and the fallback moves do
    not advance, so it faults.
  - The `driveBotTurn` retry then makes 6 more `fightVillain` moves and `endTurn`.
  - Assert exactly 9 pauses totalling 7 200 ms. A per-attempt budget would record 12 pauses
    (9 600 ms), so this test tells the two apart.
- **No pause on a non-advancing move:** `playCard` swallowed once (it does not advance), then
  lands, then `endTurn` records exactly one pause (400). That one real 500 ms back-off stays on
  `delay`.
- **No pause on the fault fallback:** reached through `decide` returning `null` (no wedged
  submit, so no real back-off). No pause is recorded for the fallback dispatch.
- **Stop during a pause:** a `pause` stub that calls `driver.stop()` leads to no further
  `submitMove` (mirrors the WP-424 shutdown-bail test).
- **No look-ahead (AC 4):** a `fightVillain` whose submit parks a `G.pendingSeatChoice` with an
  outstanding addressed seat records exactly `[800]`. The tick then yields (`getTurnCount() === 0`,
  and no further `submitMove` in that tick).
- `apps/server/src/bot-ally/botAllySeatChoice.test.ts`: `makeRealDeps` injects a no-op `pause`
  (defensive; its only driven turn move is `endTurn`).

### D) Docs — `wiki/bot-ally.md`
- "How the bot plays → Its own turns" (~L70-71): replace "There is no artificial 'thinking'
  pause, so its turns resolve quickly" with the paced behavior. A short pause follows each card
  play, and a longer one each reveal, recruit, fight or choice. Stage steps and ending the turn
  are not paused. A very busy turn speeds up once its pause budget is spent.
- Edge Cases (~L139): replace "No think-time: a bot's turn can flash by…" with the budget
  note (the rest of a very busy turn runs at full speed; the game log has every move).
- `last-reviewed` bumped.
- `wiki/visual-effects.md`: rewrite the "Readable bot turns come first" paragraph as shipped. The
  driver pauses 0.8 s / 0.4 s per move within a 7.2 s per-tick budget (WP-773 / D-24610).
- `wiki/visual-effects-design-ancestry.md`:
  - The Hearthstone "AI plays at a readable pace" row (~L212): rewrite the Arena-adoption cell to
    describe the shipped pacing — a 0.8 s pause after each board-changing move, 0.4 s after a card
    play, none after a stage step or End Turn, all within a 7.2 s per-tick budget
    ([`botAllyDriver.mjs`](../apps/server/src/bot-ally/botAllyDriver.mjs)). Set its Status to
    "Shipped (WP-773)".
  - The cross-walk (~L240): "bot pacing (drafted)" → "bot pacing (shipped)".
  - The References bullet (~L331): split WP-773 out as shipped.
  (WP-774 edits a different section of `visual-effects.md`; at most a trivial rebase.)

## Out of Scope

- A player-facing speed setting (for example "fast bots"). That would be a lobby control, a
  route parameter and a stored per-match value. It is a named follow-up; Watch Bot Play's speed
  control is the precedent.
- Renewing the ownership lease during a pause. It would need a further D-24256 amendment. A
  named alternative if the budget ever needs to grow.
- `botAllyRoutes.test.ts`: no change. Its create tests fetch a lobby-phase state and never
  drive a paced move.
- Watch Bot Play / autoplay pacing, the 250 ms poll, the retry budgets and the step caps.
- Any client change (the turn banner is WP-774; the notable-event overlay's own 2.5 s FIFO stays
  as is), engine, registry or card-data change.

## Files Expected to Change

Server (`apps/server/src/bot-ally/`):
- `botAllyDriver.mjs` — **modified** — constants, `pacingMsForMove`, overrides, per-tick budget, pause site, deps JSDoc
- `botAllyOwnership.mjs` — **modified** — comment-only TTL rationale (D-24610 amends the D-24256 premise)
- `botAllyDriver.test.ts` — **modified** — recording `pause` in `makeDeps`, plus the Scope C tests
- `botAllySeatChoice.test.ts` — **modified** — no-op `pause` in `makeRealDeps` only

Docs:
- `wiki/bot-ally.md` — **modified** — the paced behavior; the no-think-time claims removed.
- `wiki/visual-effects.md` — **modified** — the bot-pacing paragraph becomes shipped.
- `wiki/visual-effects-design-ancestry.md` — **modified** — the bot-pacing row, cross-walk and reference become shipped.

Governance: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24610 → Active),
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md`.

No other files may be modified.

## Contract

- The four constants and `pacingMsForMove` are exported from `botAllyDriver.mjs` with the
  values above.
- `createBotAllyDriver` accepts the optional `movePacingMs`, `playCardPacingMs`,
  `pacingBudgetMsPerTick` and `pause` deps. Omitting them gives production behavior.
- The pacing rule above. No other driver behavior changes.

## Acceptance Criteria

1. After each advanced bot move, the driver awaits `pacingMsForMove(name)`: 800 for
   board-changing moves, 400 for `playCard`, and 0 for `advanceStage` / `endTurn`. It pauses
   only while the tick's summed pauses stay within 7 200 ms.
2. The budget is shared by the first attempt and the D-24230 retry within one tick.
3. Setting both pacing overrides to 0 disables pacing entirely (no `pause` call).
4. No pause follows a non-advancing submit or a fault-fallback dispatch. A paced move that
   leads to a `passed` / `yielded` return is still followed by its pause (no look-ahead).
5. The bot's submitted move sequence is identical with and without pacing (same scenario,
   equal `submitCalls`).
6. A driver stopped during a pause submits no further move.
7. The lease is renewed exactly as before: one renewal per tick, none inside a turn. The TTL
   rationale comment reflects the paced tick.
8. No test awaits real pacing time. `botAllyDriver.test.ts` grows by about 0.5 s at most (the
   one real back-off in the non-advancing scenario).
9. `wiki/bot-ally.md` describes the paced behavior. The two "no pause / no think-time" claims
   are gone.

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — server suite (record before/after counts and botAllyDriver.test.ts duration)
pnpm --filter @legendary-arena/server test
# Expected: 0 failures; +9 tests in botAllyDriver.test.ts, 0 elsewhere. The nine are:
# pacingMsForMove, paced set, override, budget [three cases, one test], shared-across-retry,
# non-advancing, fault fallback, stop-during-pause, no look-ahead.

# Step 2b — the driver test file's own duration (before and after)
pnpm --filter @legendary-arena/server exec node --import tsx --test src/bot-ally/botAllyDriver.test.ts
# Expected: record the summary duration_ms before and after; the delta is ≤ ~600 ms

# Step 3 — no lease call was added inside the turn loop
Select-String -Path apps\server\src\bot-ally\botAllyDriver.mjs -Pattern "renewOrAcquireLease\(" | Measure-Object | Select-Object -ExpandProperty Count
# Expected: 1 (the existing call in runTick)

# Step 4 — budgets unchanged
Select-String -Path apps\server\src\bot-ally\botAllyDriver.mjs -Pattern "BOT_POLL_INTERVAL_MS = 250|BOT_MOVE_SUBMIT_ATTEMPTS = 3|BOT_MOVE_RETRY_BASE_MS = 500|BOT_MAX_MOVE_STEPS_PER_TURN = 100|BOT_MAX_TURNS = 400"
# Expected: 5 matches

# Step 5 — the lease TTL value is unchanged
Select-String -Path apps\server\src\bot-ally\botAllyOwnership.mjs -Pattern "BOT_ALLY_LEASE_TTL_MS = 15000"
# Expected: 1 match

# Step 5b — the ownership-file edit is comment-only
git diff -U0 origin/main -- apps/server/src/bot-ally/botAllyOwnership.mjs
# Expected: every changed line is inside the BOT_ALLY_LEASE_TTL_MS JSDoc block (lines starting " *");
# no code line changed
Select-String -Path apps\server\src\bot-ally\botAllyOwnership.mjs -Pattern "D-24610"
# Expected: at least 1 match

# Step 5c — the wiki's no-pause claims are gone
Select-String -Path wiki\bot-ally.md -Pattern "no artificial|No think-time|flash by"
# Expected: no output
Select-String -Path wiki\visual-effects.md,wiki\visual-effects-design-ancestry.md -Pattern "back to back|has no pause between moves|bot pacing \(drafted\)|WP-773 drafted|drafted as WP-773|WP-773 \(bot-ally turn pacing\), WP-774"
# Expected: no output

# Step 6 — whole repo
pnpm -r --no-bail test
# Expected: 0 failures

# Step 7 — scope
git status --porcelain
# Expected: only the Files Expected to Change (plus governance). Revert line-ending-only
# churn from `pnpm -r build` (e.g. packages/lagn-spec/schemas/lagn-v1.json).
```

## Definition of Done

- [ ] All acceptance criteria pass; server test counts recorded before/after.
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` has 0 failures.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED):** on play.legendary-arena.com, play a solo match with
      one bot ally and watch at least two bot turns. Card plays land about 0.4 s apart. The
      reveal, recruits and fights land about 0.8 s apart. The villain slash and combo beats
      play one at a time within the budget. Record the matchId in `docs/ai/STATUS.md`. A merged
      PR alone is not done.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` D-24610 flipped to Active.
- [ ] `wiki/bot-ally.md` updated (paced behavior; the no-think-time claims removed); `wiki/visual-effects.md`
      and `wiki/visual-effects-design-ancestry.md` mark bot pacing shipped.
- [ ] `WORK_INDEX.md` WP-773 checked off with date. `EC_INDEX.md` EC-810 → Done.
      `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅`. `pnpm roadmap:counts:write`;
      `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:**
  - §4 Faithful Multiplayer Experience: a tabletop player watches their ally play, and the
    table stays readable.
  - §16 Performance & Responsiveness: see the non-conflict note in Context, also recorded in
    D-24610.
  - §17 Accessibility: a turn a player can follow.
  - §8 Deterministic Game Engine: untouched.
- **Conflict assertion:** No conflict. The pause changes only when the server submits the
  bot's already-decided moves. The human's own actions stay instant. Bot-ally matches are
  never ranked, and NG-1..NG-8 are not touched.
- **Determinism preservation:** server scheduling only. The engine, the replay log, and the
  bot's decisions and their order are unchanged. The driver stays clock-free (a timer, a sum
  of constants, no wall-clock read).

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1 structure:** every required section is present; the baseline SHA is cited.
- **§2 constraints:** server-wide (full file contents, Node v22+, ESM), packet-specific (the
  lease mechanism unchanged, back-offs on `delay`, clock-free, no look-ahead), session protocol,
  locked values.
- **§3 Assumes / §4 Context:** the following are cited with file locations:
  - WP-375 / D-24170, D-24230, D-24244, D-24256 (with its TTL premise), D-24593,
    `dispatchMadeRealProgress`, D-24234, D-24231;
  - the Watch Bot Play 800 ms source (autoplay.mjs + LobbyView.vue);
  - the pacing invariant;
  - `docs/ai/ARCHITECTURE.md §Layer Boundary` (the server wires and never decides).
- **§5 files / §7 deps:** a closed allowlist: 2 source files (one comment-only), 2 tests, 3 wiki
  pages, and governance. No new npm dependency.
- **§6 naming:** full-word constants (`BOT_MOVE_PACING_MS`, `BOT_PLAY_CARD_PACING_MS`,
  `BOT_PACING_BUDGET_MS_PER_TICK`, `BOT_UNPACED_MOVE_NAMES`), `pacingMsForMove`, and full-word
  deps. `MatchSetupConfig` untouched.
- **§8 layer boundary:** server only. No engine import added; no `boardgame.io` / `pg` in the driver.
- **§9 Windows:** the verification uses `pwsh` (`Select-String`).
- **§10 env / §11 auth:** N/A — no env var or auth surface.
- **§12 tests:** `node:test` with injected deps and a recording `pause`. Negative cases: no
  pause on retry, fallback or unpaced moves; the budget cap; the budget shared across the
  retry; stop during a pause; an identical move sequence.
- **§13 verification:** exact commands with expected output (+9 tests; 5 budget matches).
- **§14 AC / §15 DoD:** binary ACs. The DoD carries STATUS, DECISIONS, WORK_INDEX, scope and
  the D-24026 live verify.
- **§16 code style:** `// why:` on each constant (the 800 ms precedent, the lighter play beat,
  the TTL-derived budget, the unpaced set). The pacing decision is in a small helper; the pause
  site adds about 10 lines to the existing ~135-line `attemptBotTurn`. No `.reduce()`.
- **§17 Vision Alignment:** present (§4, §16 with an explicit non-conflict, §17, §8).
- **§18 prose-vs-grep:** Step 3 counts `renewOrAcquireLease(` calls (expected 1). Every new
  comment and JSDoc line says "the ownership lease renewal", never the call form.
- **§19 bridge:** N/A — commit-time rule; baseline `32fd8ba2` recorded.
- **§20 Funding Surface:** N/A — server-side move pacing and one wiki paragraph; no funding
  affordance, no donate or support copy, no funding channel.
- **§21 API Catalog:** N/A — no endpoint or `Library-only` function changes; the bot-ally
  status route's response shape is untouched.

## Gate Verdicts

Drafted 2026-09-26 on base `32fd8ba2`. Each gate ran as an independent subagent.

- **01.4 pre-flight:** READY TO EXECUTE, after one fix round. The per-turn move counter became a
  per-tick millisecond budget shared across the D-24230 retry, and Steps 2b / 5b / 5c were added.
- **01.7 copilot:** CONFIRM, after two HOLD rounds. The final residual rewrote the ancestry
  "AI plays at a readable pace" row and extended the Step 5c grep.
- **00.3 lint:** PASS.
- **01.5 runtime wiring:** not invoked. The driver is already wired, and the change is internal.
