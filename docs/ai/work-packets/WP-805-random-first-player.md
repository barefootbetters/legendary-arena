# WP-805 — A random player goes first: the play phase opens on a seeded-random seat, not always seat 1 (Game Engine)

**Status:** Draft 2026-10-12
**Primary Layer:** Game Engine (play-phase turn order in `game.ts`, an omit-when-off setup flag in `G`)
**Dependencies:**
- WP-011 / D-10007 (the lobby phase and `startMatchIfReady` → `setPhase('play')`)
- WP-686 / D-24503 and WP-802 / D-24689 (the omit-when-off `G` flag precedent: `finalBlow`, `isDebugMatch`)
- WP-334 / WP-336, D-24119 / D-24124 (the faithful reducer replay of a stored `initialState + log`)
- WP-328 (`G.logMeta.firstPlayTurn`, the play-relative turn number)

**User-Visible Surface:** `play.legendary-arena.com` (every match with two or more seats)
**Lane:** Standard (two-session). It changes randomness and the shape of `G`, and re-pins two whole-`G` hash oracles. That fails lightweight-lane criteria 6 and 8.

> Baseline: `origin/main` at `30a27c1f` (includes #2727, the WP-804 / EC-841 reserve). The numbers WP-805 / EC-842 / D-24700 are reserved by #2730.

---

## Goal

Rules v23 L524: "Choose a random player to go first. Players take turns in clockwise order." `DESIGN-BOARD-LAYOUT.md` §5.1 says the same, and says the draw comes from `ctx.random`, seeded by the match.

**Today:** every match with two or more seats opens on **seat 1**. The play phase sets no `turn.order`, so boardgame.io's `TurnOrder.DEFAULT` applies. When a phase starts after framework turn 0, its `first` returns `(playOrderPos + 1) % playOrder.length`, the seat after the one that held the lobby turn (seat 0). In a bot-ally match the bot always takes the first turn. The production operator match `3pNYCKHKJCE` (2026-10-11) showed it: the human seat's first turn was board turn 2.

**After this session:**
1. In a new match with two or more seats, the play phase's first turn goes to a seat drawn with boardgame.io's seeded `random` at the moment play begins. Same seed, same opener; across seeds, every seat can open.
2. Turns then go clockwise (ascending seat order, wrapping), exactly as today.
3. A solo match is unchanged, byte for byte: no flag, no draw, seat 0.
4. A match whose stored initial state predates this packet (no flag) keeps today's opener, seat 1. So the faithful replay (score verification, the AI coach) of an older multi-seat log still reproduces it.

## User-Visible Impact

- In multiplayer and bot-ally matches, any seat may take the first turn, chosen at random per match. In a 2-seat bot-ally match the human opens about half the time instead of never.
- Nothing else in play changes. The HUD's turn counter, the log numbering (`logMeta.turn`, play-relative) and turn order after the first turn work as today.

---

## Assumes

1. **The default order** (`boardgame.io@0.50.2`, `dist/cjs/turn-order-4ab12333.js`):
   - `TurnOrder.DEFAULT` `:~992-995`: `first: ({ ctx }) => ctx.turn === 0 ? ctx.playOrderPos : (ctx.playOrderPos + 1) % ctx.playOrder.length`, with `next` `(ctx.playOrderPos + 1) % ctx.playOrder.length`.
   - `InitTurnOrderState` `:~901-919` builds `context = { ...GetAPIs(state), G, ctx }` and calls `order.first(context)`, so `random` (with `Die`) is available to `first`. The return must be a number (a non-number is an error). The live server runs an identical copy (`dist/cjs/server.js:~1041`).
   - `first` runs once per match, at play start: `StartPhase` → `StartTurn` → `InitTurnOrderState`, only when no `currentPlayer` is passed (`reducer-6f7cf6b0.js:~226-250`). In-turn and `endTurn({ next })` paths never call it.
   - The draw persists. `Flush` runs the plugins in reverse (`turn-order:~585-591`), so the events plugin (which applies `setPhase`) flushes before `random`, and `random`'s flush captures the `Die` draw. Reducer replay re-runs the same move and redraws identically. The phase change is server-only: `startMatchIfReady` is `client: false` (`game.ts:~739-741`).
   - **No draw today.** On `30a27c1f`, `plugins.random.data` is unchanged across `startMatchIfReady` for 1, 2 and 3 seats (draft probe, 2026-10-12). So the legacy and solo paths can be tested by a before/after deep-equal.
2. **The phases** (`packages/game-engine/src/game.ts`):
   - `lobby` `:~701-742` (`start: true`; `turn.activePlayers: { all: 'lobbyReady' }`).
   - `play` `:~746`; its `turn` block `:~756-790` sets `activePlayers: { currentPlayer: 'playTurn' }` `:~776` and the `playTurn` / seat-choice stages, and **no** `order`.
   - `startMatchIfReady` calls `events.setPhase('play')` (`lobby/lobby.moves.ts:~88`). The lobby consumes framework turn 1, so play opens at `ctx.turn === 2`.
   - The play `onBegin` stamps `G.logMeta = { turn: ctx.turn − firstPlayTurn + 1, … }` with `firstPlayTurn` captured once (`:~907-920`). The play-relative numbering does not depend on which seat opens.
3. **Omit-when-off `G` flags** (`setup/buildInitialGameState.ts:~637-649`; `types.ts:~1759-1777`): `finalBlow` and `isDebugMatch` are written only when on. Both whole-`G` hash oracles (`computeStateHash`, `hashGameState`) serialize the entire `G`, so an absent key keeps a match byte-identical. `buildInitialGameState(config, registry, context, scoringConfig?)` receives `context.ctx.numPlayers` (`:~259-264`).
4. **The faithful replay** (`apps/server/src/replay/matchReplay.logic.ts`, WP-334 / WP-336) re-runs a stored `initialState + log` through boardgame.io's reducer with the **current** `LegendaryGame`. It has four callers:
   - the capture harvester (`replay/matchCapture.logic.ts:~106`), which mints the `replayHash` for every finished match. It is the most exposed: any multi-seat match that starts before deploy and finishes after goes through it.
   - the competitive verifier (`competition/competition.logic.ts:~815`)
   - the AI coach (`coach/coach.logic.ts:~223`), a Legendary Pass feature that reduces past matches on demand
   - the scenario-key re-key (`replay/scenarioKeyRekey.logic.ts:~80`)

   A stored multi-seat log was recorded with seat 1 opening; if the current engine opened a different seat, the log's first move would be refused and the reduction would diverge. The flag in Assumes 3 is what tells the engine which rule a stored match was created under.
5. **Harnesses that do not use boardgame.io's turn order** keep a fixed seat-0 opener, which is one legal outcome of a random draw. They are not changed:
   - `simulation/simulation.runner.ts:~579` and `simulation/par.aggregator.ts:~674` (`currentPlayer = '0'`; their own mulberry32 PRNG, never byte-identical to boardgame.io's).
   - `test/fixtures/runFixture.ts` (the fixture's `playerOrder`).
   - `replay/buildSnapshotSequence.ts:~94` (`playerOrder[0]`).
6. **Hash oracles that move** (observed in the draft scaffold, below): the sentinel fixture `sentinel-core-doom-2p` `finalStateHash` (the value is in `test/fixtures/games/sentinel-core-doom-2p.replay.json` `:3`; asserted at `test/fixtures/replayFixtures.test.ts:~188`; the 2-seat board) and `PRE_WP080_HASH` (`replay/replay.execute.test.ts:~181`). The fixture is re-pinned by `scripts/record-game-fixture.mjs --input`, which reads the engine `dist`. Both move **only** because 2-seat `G` gains the flag: the fixture runner opens seat 0 regardless, so the trajectories are unchanged. Solo pins do not move.
7. **No other code assumes the opener.** A non-test grep of `packages/game-engine/src`, `apps/server/src` and `apps/arena-client/src` for `currentPlayer === '0'`, `playOrderPos`, `playOrder[0]`, `firstPlayer` and `startingPlayer` finds only the harness in Assumes 5 and a `mockMoveContext` default. The bot-ally driver acts only when `state.ctx.currentPlayer` is a bot seat (`bot-ally/botAllyDriver.mjs:~335`), and the autoplay loop drives whichever seat is current.
8. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**; reconcile the WP and D-24700 first. Line anchors are `~` approximate; re-read at execution.

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` L524 (the rule).
- `docs/ai/DESIGN-BOARD-LAYOUT.md` §5.1 L620-631 (random first player from `ctx.random`; clockwise rotation).
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #1 (determinism), §Phase & Turn Transitions, §Persistence Boundaries; `.claude/rules/architecture.md` §Determinism; `.claude/rules/code-style.md` §Comments (`// why:` on every `ctx.random` use).
- `docs/ai/DECISIONS.md`: D-10007, D-24503, D-24689, D-24119, D-24124, D-24687 §4 (the accepted pre-deploy replay window), D-24616 §5 (stored scores stay frozen).
- User memory: `reference_hashed_g_field_dual_repin`, `reference_simulation_harness_bypasses_bgio`.

**Why random, not "seat 0 always".** Jeff ruled for the rulebook (2026-10-12): v23 L524 and the design doc both say random. A fixed seat 0 would only move today's bias from the bot to the host.

**Why the draw happens when play begins, not in `Game.setup()`.** Two reasons:
- The design doc's "`Game.setup()` picks the first player" predates the lobby phase. The phase that needs an opener is `play`, and boardgame.io's hook for it is `turn.order.first`.
- A draw inside setup would come before every setup shuffle and shift them all, changing every match's deck order and every solo pin. A draw at play start comes after all setup shuffles, so decks are untouched; only draws made later in play shift.

**Why a flag in `G` (and the rejected alternative).** The rejected alternative changed `order.first` unconditionally. That needs no `G` change and moves no hash pin, but every multi-seat match stored before deploy would open on a different seat when the faithful replay re-runs its log. The first logged move would be refused, so score verification and the AI coach would break for those matches. A setup-stamped flag marks which rule a match was created under. New multi-seat matches carry it; older logs and solo matches don't, and keep their exact behavior. The cost is a declared re-pin of two 2-seat hash oracles (Assumes 6), with trajectories unchanged.

**Why omit it for solo.** A one-seat table has no choice to make (`Die(1)` is always 1), so drawing would only shift the RNG stream for nothing. Omitting the flag keeps every solo match, and every solo pin, byte-identical.

**Draft scaffold (observed, 2026-10-12; reverted, not committed).** The Locked Values were prototyped on `30a27c1f`:
- A boardgame.io-reducer probe: 3-seat openers over 40 seeds `{"0":11,"1":7,"2":22}`. The same seed twice gave the same opener and the same `plugins.random` state. Solo opened seat 0 with no flag. A 2-seat state with the flag removed opened seat 1 on 10 of 10 seeds.
- `pnpm --filter @legendary-arena/game-engine test`: 5092 tests, 2 failures, exactly the two oracles in Assumes 6.
- `pnpm --filter @legendary-arena/server test`: 1741 tests, 0 failures.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves and effects never throw. All randomness goes through boardgame.io's seeded `random` (the `ctx.random` family). No `Math.random`, clocks or I/O in engine code.
- `G` stays JSON-serializable. Only `Game.setup()` may throw.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24700) before coding. One WP per session.

**Packet-specific:**
- **The flag.** `readonly isFirstPlayerRandom?: boolean` on `LegendaryGameState` (readonly like `finalBlow` / `isDebugMatch`). `buildInitialGameState` writes `isFirstPlayerRandom: true` only when `context.ctx.numPlayers > 1`, and omits the key otherwise (the `finalBlow` / `isDebugMatch` spread). Nothing writes it after setup. Its JSDoc and `// why:` cite D-24700 and say that absence means "created under the old rule or solo".
- **The order** (`game.ts`, the `play` phase's `turn` block). Add `order` with:
  - `first: ({ G, ctx, random }) => …`: when `G.isFirstPlayerRandom !== true`, return `(ctx.playOrderPos + 1) % ctx.playOrder.length` (today's `DEFAULT.first` for a non-initial phase, verbatim). Otherwise return `random.Die(ctx.playOrder.length) - 1`.
  - `next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.playOrder.length` (today's `DEFAULT.next`, verbatim).
  - A `// why:` on the `random.Die` call (rules v23 L524, D-24700, the seeded draw at play start). A second `// why:` on the legacy branch: older stored logs and solo replay unchanged.
  - Nothing else in the `play` block changes. `activePlayers`, the stages, `onBegin` and `onEnd` are untouched, and no `ctx.events.*` call is added.
- **Turn order after the opener** is unchanged: clockwise, ascending seat order with wrap.
- **01.5 not invoked:** the field is optional, `buildInitialGameState` is already in the allowlist, and the draft scaffold showed no structural test failure (the `finalBlow` / `isDebugMatch` precedent).
- **No harness change** (Assumes 5). No `UIState` field: the opener shows through the existing `currentPlayer`.
- **Determinism.** The opener depends only on the match seed. A match created after deploy replays identically. A flagless state replays exactly as today. The two re-pinned oracles move only by the flag key; any other hash or PAR movement = STOP.

## Locked Values

- **Field:** `readonly isFirstPlayerRandom?: boolean` on `LegendaryGameState` (readonly like `finalBlow` / `isDebugMatch`), written `true` only when `numPlayers > 1`, never `false`.
- **Draw:** `random.Die(ctx.playOrder.length) - 1`, inside `play.turn.order.first`, only when `G.isFirstPlayerRandom === true`.
- **Legacy branch:** `(ctx.playOrderPos + 1) % ctx.playOrder.length`.
- **`next`:** `(ctx.playOrderPos + 1) % ctx.playOrder.length`.
- **Re-pinned oracles** (to the values the executed code produces; no other pin moves):
  - `sentinel-core-doom-2p` `finalStateHash`, through the recorder, never by hand: `pnpm --filter @legendary-arena/game-engine build`, then `node scripts/record-game-fixture.mjs --name sentinel-core-doom-2p --input packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`. `git diff` on the JSON must show exactly one changed line, the hash. JSON carries no comment, so the provenance goes in the commit's `Tests-changed:` trailer and D-24700.
  - `PRE_WP080_HASH` in `replay/replay.execute.test.ts`, edited in place, extending its existing provenance chain with a dated comment naming D-24700 and the flag.
- **Doc line:** `DESIGN-BOARD-LAYOUT.md` §5.1's "`Game.setup()` per WP-005A picks the first player" becomes: the first player is drawn with the match's seeded `random` when the play phase begins (WP-805 / D-24700).

---

## Scope (In)

- **A) Flag.** `types.ts` (the optional field with JSDoc + `// why:`); `setup/buildInitialGameState.ts` (the omit-when-off spread).
- **B) Order.** `game.ts` (`play.turn.order`).
- **C) Tests.**
  - `game.test.ts`: boardgame.io-reducer tests (`InitializeGame` + `CreateGameReducer`, the WP-411 precedent `:~775-801`). Every test seeds explicitly with `{ ...LegendaryGame, seed }` (the `SEEDED_GAME` precedent, `apps/server/src/replay/matchReplay.logic.test.ts:~197`); an unseeded `InitializeGame` seeds from the clock.
    1. over the 40 fixed seeds `seed-0` … `seed-39` (with `createMockMatchConfiguration()`), the **set** of 3-seat openers equals exactly `{'0','1','2'}`. The draft scaffold observed `{"0":11,"1":7,"2":22}` on the same seeds and config. This catches a truncated draw range such as `Die(length - 1)`. A flagged run's `plugins.random.data` also **changes** across `startMatchIfReady` (the draw happened).
    2. the same seed opens the same seat with the same `plugins.random` state, twice
    3. a 2-seat initial state with `isFirstPlayerRandom` removed opens seat 1, **and** its `plugins.random.data` is deep-equal before and after `startMatchIfReady` (the legacy-replay guarantee: no draw, so later draws don't shift)
    4. a solo match has no flag, opens seat 0, and its `plugins.random.data` is deep-equal before and after `startMatchIfReady`
    5. after the opener's turn ends, the next seat is `(opener + 1) % numPlayers`, run on a seed from test 1 whose 3-seat opener is `'2'`, so the asserted next seat is `'0'` (the wrap)
  - `game.test.ts`, beside the WP-802 `isDebugMatch` setup test (`:~157`): a **runtime** key assertion that `LegendaryGame.setup` writes the flag `true` for 2–5 seats and omits the key for 1 seat.
  - The two oracle re-pins (Locked Values), with a `Tests-changed:` trailer.
- **D) Doc.** `docs/ai/DESIGN-BOARD-LAYOUT.md` §5.1, one sentence.

## Out of Scope

- **Announcing the opener** (a "Player N goes first" log line or a Battle Brief line). The board already shows whose turn it is; any announcement is a follow-up.
- **The sim, PAR, fixture and replay-snapshot harnesses** keep seat 0 (Assumes 5). Randomizing them would re-pin every multi-seat PAR and sim baseline for no rules gain, since seat 0 is a legal draw.
- **Seat order around the table** (who sits where) and turn order after the first turn.
- **Scenario or scheme rules that name a first player.** None is implemented today.
- **Matches in their lobby at deploy time.** They were set up under the old engine (no flag), so they keep the seat-1 opener. That's the legacy branch working as designed.
- **Server or client edits.** None are needed (Assumes 7).
- **Client-sent framework events.** `LegendaryGame` declares no `events` config, so boardgame.io leaves `setPhase`, `endPhase`, `endGame` and the rest enabled (`reducer-6f7cf6b0.js:~630-631`), and the master accepts a raw `GAME_EVENT` from an active seat. A crafted client can already force a phase change today. After this packet, a forced `setPhase('play')` would also re-draw the opener. The faithful replay skips `GAME_EVENT`s, so such a match already diverges on replay. Closing it (`events: { setPhase: false, endPhase: false, endGame: false, … }`, checking that the engine's own `events.*` calls from moves still work) is a separate follow-up.

## Files Expected to Change

- `packages/game-engine/src/types.ts` — modified (the optional flag)
- `packages/game-engine/src/setup/buildInitialGameState.ts` — modified (the omit-when-off spread)
- `packages/game-engine/src/game.ts` — modified (`play.turn.order`)
- `packages/game-engine/src/game.test.ts` — modified (five reducer tests + the setup flag-key test)
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — re-pinned by the recorder (one line, `finalStateHash`)
- `packages/game-engine/src/replay/replay.execute.test.ts` — re-pin (`PRE_WP080_HASH`)
- `docs/ai/DESIGN-BOARD-LAYOUT.md` — one sentence in §5.1
- Governance: `docs/ai/DECISIONS.md` (D-24700), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 7 code, test, fixture and doc files plus 5 governance files.

## Contract

- The Locked Values.
- `G.isFirstPlayerRandom === true` means "this match draws its opener at random when play begins". Absent means "created before WP-805, or solo". Nothing writes it after setup.
- The play phase's `turn.order` is the only place the opener is chosen.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §22 / §24 (replay and ranked fairness), NG-1 (no pay-to-win; untouched).
**Conflict assertion:** none. New matches follow the rulebook. Every stored match replays exactly as recorded, because the legacy branch reproduces the old opener. Stored scores stay frozen (D-24616 §5).
**Non-Goal proximity:** not crossed. The opener is seeded per match; no purchase, cosmetic or account state affects it.
**Determinism:** one new seeded draw per multi-seat match, made at a fixed point (play start, after all setup shuffles). The same seed always gives the same opener. The sentinel 2-seat `finalStateHash` and `PRE_WP080_HASH` re-pin only for the new key; solo oracles and PAR are unchanged.

## Funding Surface Gate

§20 **N/A** (no monetization surface).

## API Catalog

§21 **N/A** (no HTTP endpoint or `apps/server` library change).

---

## Acceptance Criteria

1. **Random opener.** In a new match with 2–5 seats, the first play turn's `ctx.currentPlayer` is drawn by `random.Die`. Over seeds `seed-0` … `seed-39`, the set of 3-seat openers is exactly `{'0','1','2'}`.
2. **Seeded.** The same seed gives the same opener and the same `plugins.random` state.
3. **Clockwise.** After the opener ends its turn, the next seat is `(opener + 1) % numPlayers`, including the wrap from seat `'2'` to `'0'` on 3 seats.
4. **Legacy replay.** A 2-seat initial state without the flag opens on seat 1 and leaves `plugins.random.data` unchanged across `startMatchIfReady`, exactly as today.
5. **Solo unchanged.** A solo match has no `isFirstPlayerRandom` key, opens on seat 0 and leaves `plugins.random.data` unchanged across `startMatchIfReady`. Solo hash oracles are unchanged.
6. **Flag shape.** `buildInitialGameState` writes `isFirstPlayerRandom: true` for 2–5 seats and omits it for 1 seat (runtime key assertion).
7. **Pins.** Only the `sentinel-core-doom-2p` `finalStateHash` (recorder, one-line JSON diff) and `PRE_WP080_HASH` (dated provenance comment) move. PAR and every other oracle are unchanged.
8. **Build and tests.** `pnpm -r build` → 0 and `pnpm -r --no-bail test` → 0 fail. The server suite stays green with no edit.

## Verification Steps

1. `pnpm -r build` → 0.
2. Re-pin per Locked Values (recorder for the fixture, in-place for `PRE_WP080_HASH`), then `pnpm --filter @legendary-arena/game-engine test` → 0 fail. The re-pin diff touches only the two hash values and the `PRE_WP080_HASH` provenance comment.
3. `pnpm --filter @legendary-arena/server test` → 0 fail (no server edit).
4. `pnpm -r --no-bail test` → 0 fail; `pnpm par:seed:test` → 0; `pnpm sim:runtime-observed:check` and `pnpm sim:coverage --check` → 0 (unchanged: the harnesses don't use the play-phase order).
5. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn from the build.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24700 Active. It records:
  - the rule (v23 L524) and Jeff's 2026-10-12 ruling for random over "seat 0 always"
  - the draw point (`play.turn.order.first`, after all setup shuffles) and why not `Game.setup()`
  - the omit-when-off flag as the legacy-replay gate, and the rejected unconditional alternative
  - the solo omit
  - the harnesses staying on seat 0 as a legal draw outcome
  - the two declared oracle re-pins, trajectories unchanged
  - matches in their lobby at deploy keep the old opener
  - the four faithful-replay callers the gate protects: capture (`matchCapture.logic.ts`), the competitive verifier, the AI coach and the scenario-key re-key
  - the accepted rollback window: a deploy rollback or roll-forward that straddles a flagged match's lobby-to-play transition makes that match's faithful replay diverge (beside D-24687 §4)
  - the client-sent `GAME_EVENT` exposure (Out of Scope): a forced `setPhase('play')` would re-draw the opener; the fix is a separate `events` config follow-up
- [ ] `docs/ai/STATUS.md`; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-842:` then `SPEC:`), with a `Tests-changed:` trailer for the two re-pins.
- [ ] **D-24026 live-verify (post-merge):** create 2-seat bot-ally matches on `play.legendary-arena.com`, up to 8, stopping as soon as one has opened on the human seat and one on the bot (all 8 opening on the same seat has about a 0.8% chance). Each match's opener is stable on reload. Recorded as a STATUS flip.

## Reserved Decision (lands at execution)

**D-24700 — random-first-player.** It locks everything listed in the DoD item above.

---

## Lint Gate Self-Review (00.3)

- **§1 Structure:** every required section is present and non-empty. Out of Scope names six exclusions; there are 8 binary ACs.
- **§2 Constraints:** the engine-wide block is verbatim (full files, no diffs or snippets, ESM, Node v22+, 00.6). The packet-specific constraints, session protocol and Locked Values are present; "01.5 not invoked" is stated.
- **§3 Assumes:** 8 items, each cited to file:line, including the boardgame.io dist. They were re-verified against source by the independent pre-flight. A false item → BLOCKED.
- **§4 Context:** rules v23 L524, DESIGN-BOARD-LAYOUT §5.1, the named ARCHITECTURE sections, the rules files, the D-entries and the memory references. 00.2 is N/A: no card data, schema or `MatchSetupConfig` field is touched (the flag is a `G` field, not a setup-payload field).
- **§5 Output completeness:** 7 files plus 5 governance, each marked modified or re-pinned with a one-line description. Every forced test edit is in the allowlist: the reducer tests, the setup key test and both re-pins. Under the ~8-file bound.
- **§6 Naming:** `isFirstPlayerRandom` (boolean `is` prefix, full words). No 00.2 name is touched.
- **§7 Dependencies:** no new npm package. All listed dependencies are Done.
- **§8 Architecture:** engine-only. Randomness only through boardgame.io's seeded `random`; `G` stays JSON; no `ctx.events.*` call, no move, no persistence change; the server's faithful replay keeps working through the legacy branch.
- **§9 Windows:** pnpm and node commands only.
- **§10 Env vars:** N/A.
- **§11 Auth:** N/A.
- **§12 Tests:** `node:test`, `.test.ts`, seeded. The reducer tests use boardgame.io's internal reducer per the WP-411 `game.test.ts` precedent, not `boardgame.io/testing`. The negatives (legacy opener, no draw on the legacy and solo paths, the exact opener set, the wrap) are locked so a wrong implementation fails.
- **§13 Verification:** exact pnpm / node commands with expected results, including the recorder re-pin and the one-line diff check.
- **§14 ACs:** 8, binary and observable, tied to named fields, seeds and values.
- **§15 DoD:** STATUS, DECISIONS (D-24700), WORK_INDEX, EC_INDEX, mindmap, allowlist-only diff, two-commit topology. §15.1: the surface is `play.legendary-arena.com`, and the DoD has a live bot-ally check with a concrete stop rule.
- **§16 Code style:** 00.6 is cited. Two short arrow functions in a boardgame.io config (framework-required); `// why:` on the `random` use, the legacy branch, `next` and the spread.
- **§17 Vision:** the block is present; §1 / §22 / §24 are touched with no conflict, and NG-1 is not crossed.
- **§18 Prose-vs-grep:** N/A (no forbidden-token grep in Verification).
- **§19 Bridge staleness:** the baseline `30a27c1f` + #2730 is cited; the drafting commit re-checks `origin/main`.
- **§20 Funding surface:** N/A.
- **§21 API catalog:** N/A.

**Verdict: PASS (21 / 21 resolved).**

## Gate Record

**Pre-flight (01.4), round 1** (independent subagent, baseline `30a27c1f`): **READY TO EXECUTE**, conditional on two text fixes, both applied. Verified against source:
- `order.first` runs once per match at play start with `random` in its context.
- The `Die` draw persists through `Flush` and replays identically, and the phase change is server-only.
- The server's copy of `InitTurnOrderState` is identical.
- The legacy branch equals `DEFAULT.first` for every stored log.
- No code outside the declared harnesses assumes the opener.
- Only the two declared oracles move.
- The recorder command is correct.

Blockers, both applied:
- **PS-1:** Assumes 4 listed two replay callers; there are four (capture and scenario re-key added, and in the D-24700 DoD).
- **PS-2:** nothing tested "no extra draw". Tests 3 and 4 now assert `plugins.random.data` deep-equal across `startMatchIfReady`, and test 1 asserts the flagged run's changes. The drafter confirmed on `30a27c1f` that nothing draws at play start for 1–3 seats.

RS items applied: RS-1 (explicit seeding), RS-2 (Flush order, server duplicate, once-per-match), RS-3 (rollback window in D-24700). RS-4 (the data-sources doc lacks all three setup flags) is a separate change. RS-5 (client-sent `GAME_EVENT`s) became an Out of Scope bullet and a D-24700 line after copilot finding 3.

**Copilot (01.7), round 1: RISK → HOLD.** Determinism, allowlist completeness, the upgrade story and WP↔EC byte-identity were verified clean. Four findings, all applied with no allowlist change:
1. Test 1 asserts the exact opener set over `seed-0` … `seed-39`, catching a truncated draw range; test 5 pins the wrap.
2. The field is locked `readonly`.
3. The `GAME_EVENT` exposure is recorded.
4. Wording: the paragraph split, the live-verify stop rule, and "01.5 not invoked".

**Copilot (01.7), round 2: PASS, disposition CONFIRM** (2026-10-12). All four fixes landed with no contradiction; the locked values are byte-identical between WP and EC; the EC has 55 non-blank lines.
