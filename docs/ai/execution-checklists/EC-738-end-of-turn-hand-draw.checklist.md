# EC-738 — End-of-turn hand draw (Execution Checklist)

**Source:** docs/ai/work-packets/WP-701-end-of-turn-hand-draw.md
**Layer:** Game Engine (turn flow / setup / harnesses / determinism)

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce` below — any edit outside it is a
      FAIL; surface it, do not improvise.
- [ ] Baseline `origin/main` at the D-24520 reserve. Capture the CURRENT pins first:
      `PRE_WP080_HASH = '29e41e8'`; sentinel `finalStateHash =
      deba0f43ba17a103eb9f57abf5971106e4656b6515125e3db3f6db4b3ec594a1`.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] Re-read D-22002 (dual turn-end path) and D-24513 (extra-turn) before touching turn flow.

## Locked Values (do not re-derive)
- `HAND_SIZE = 6` (`moves/drawCards.logic.ts`) — UNCHANGED. `drawCardsIntoHand(zones, count,
  shuffleProvider)` — count-based, reshuffle-on-empty — UNCHANGED.
- **New helper** `applyEndOfTurnCleanup(G, playerID, shuffleProvider)` — the SINGLE end-of-turn
  cleanup site. Exact order: (1) `moveAllCards(inPlay → discard)`; (2) `moveAllCards(hand →
  discard)`; (3) `cardsToDraw = max(0, (handSizeOverrides?.[playerID] ?? HAND_SIZE) - hand.length)`
  then `drawCardsIntoHand(zones, cardsToDraw, shuffleProvider)`; (4) push `deckReshuffled`
  notable event iff `reshuffleCount > 0` (guard `Array.isArray(G.notableEvents)`); (5) `delete
  handSizeOverrides[playerID]` if present; (6) `consumeDeferredHandInjections(G, playerID,
  zones)`. Pure — NO boardgame.io import. Does NOT set `hasDrawnThisTurn` (that flag is an
  onBegin reset only).
- **Two turn-end paths, ONE cleanup each (never both for one end):** the `endTurn` move
  (`coreMoves.impl.ts`) replaces its inline discard sweep (in-play + hand → discard) with
  `applyEndOfTurnCleanup(G, playerID, { random })` (add `random` to the destructure), BEFORE
  the `consumeExtraTurn` branch; `advanceTurnStage` (`turnLoop.ts`) calls
  `context.cleanup(context.currentPlayer)` at the `cleanup` branch (nextStage === null)
  BEFORE the extra-turn / normal `events.endTurn()`.
- **`TurnLoopContext` gains a `cleanup: (endingPlayerID: string) => void` closure** (NOT a
  `shuffleProvider` — `advanceTurnStage` takes the deliberately-narrow `TurnLoopState`, which
  lacks `playerZones`/overrides/injections/`notableEvents`, so the full-state helper cannot be
  called from inside turnLoop.ts; the caller binds `G` + the ShuffleProvider in the closure,
  mirroring the existing `events.endTurn` closure). Every `advanceTurnStage` caller passes it:
  `game.ts` `advanceStage`, `simulation.runner.ts` `simulationAdvanceStage`,
  `par.aggregator.ts` `aggregatorAdvanceStage`, `replay.execute.ts` `replayAdvanceStage`
  (it DOES call advanceTurnStage — definite), `runFixture.ts` `fixtureAdvanceStage` — each
  binding `applyEndOfTurnCleanup(G, endingPlayerID, { random: <that context's random> })`.
- **`game.ts` `turn.onBegin`:** DELETE the auto-draw block (the fill + `deckReshuffled` +
  `handSizeOverrides` consume + `consumeDeferredHandInjections`). KEEP every reset (currentStage,
  turnEconomy, `villainRevealedThisTurn = false`, hasActedThisTurn, hasHealedThisTurn,
  deferred-grant clear, logMeta, lastPlayEffectsFired). **Set `hasDrawnThisTurn = TRUE`** (not
  false) — the hand is already dealt (end of prior turn / setup), so the scaffold `drawCards`
  move (server-only, allowed in start+main, self-guards on `hasDrawnThisTurn`) stays a guarded
  no-op ALL turn; this matches the OLD model's post-onBegin-draw flag value, so it is
  determinism-neutral for the flag and closes the mid-turn free-refill hole. Mirror in
  `applyOnBeginParity` (TRUE) and `buildInitialGameState` (`hasDrawnThisTurn: true`).
- **Setup:** in `buildInitialGameState.ts`, after each `buildPlayerState`, `drawCardsIntoHand(
  playerState.zones, HAND_SIZE, context)` in seat order (`Object.keys(...).sort()` / the existing
  loop order — LOCK the order for determinism). `playerInit.ts` still returns `hand: []`.
- **`applyOnBeginParity` (`onBeginParity.ts`):** KEEP the resets (`villainRevealedThisTurn`,
  `hasDrawnThisTurn`), DELETE the draw (fill + `deckReshuffled` + `hasDrawnThisTurn=true`).
  Remove the turn-1 pre-loop `applyOnBeginParity` DRAW in `simulation.runner.ts` (~540) and
  `par.aggregator.ts` (~634) — setup deals turn-1 hands (keep any needed turn-1 reset, or rely
  on setup init).
- **Determinism re-pin (regenerate, do NOT hand-write):** `PRE_WP080_HASH` and the sentinel
  `sentinel-core-doom-2p.replay.json` `expected` block (finalStateHash + messages +
  snapshotPerTurn + outcome). Run the replay harness to emit the new values; VERIFY the new
  sentinel state is correct (the core Dr. Doom Master Strike now discards full hands) before
  committing the pin.

## Guardrails
- The draw uses the existing primitive + `ShuffleProvider` (`ctx.random`) — NO new randomness.
- The helper is PURE (no boardgame.io import); moves never throw; zone moves via `zoneOps` /
  the draw primitive; no `.reduce()` in zone ops.
- Every `events.endTurn()` / turn-transition edit keeps a `// why:` comment.
- **Both** D-22002 turn-end paths clean up; NEITHER cleans up twice for one turn-end (the
  `endTurn` move does not call `advanceTurnStage` and vice-versa — verify).
- Extra turn (D-24513): cleanup precedes `events.endTurn({ next })`, so the same seat's extra
  turn begins with the freshly drawn hand.
- **Honest re-pin:** a hash that moves in a way the design does not predict is a STOP-and-
  investigate, never a fixture edited to make it pass. Never `@ts-ignore` / weaken a test.

## Required `// why:` Comments
- `endOfTurnCleanup.logic.ts` — why the draw is now at end-of-turn (tabletop between-turns
  hand; Master Strikes act on real hands) and why the injection/override consume travels here.
- `coreMoves.impl.ts` (`endTurn`) — why the discard sweep became `applyEndOfTurnCleanup`.
- `turnLoop.ts` — why the cleanup runs at the `advanceTurnStage` cleanup branch (the D-22002
  second turn-end path draws too).
- `game.ts` — why the onBegin draw block is removed (the draw moved to end-of-turn).
- `buildInitialGameState.ts` — why setup now deals initial hands (no onBegin draw for turn 1).
- The re-pin sites — why `PRE_WP080_HASH` / the sentinel changed (setup deals hands + draw moved).

## Files to Produce
- `packages/game-engine/src/moves/endOfTurnCleanup.logic.ts` — new — the helper (+ paired test).
- `packages/game-engine/src/moves/coreMoves.impl.ts` — modified — `endTurn` uses the helper.
- `packages/game-engine/src/turn/turnLoop.ts` — modified — cleanup at advanceTurnStage + context.
- `packages/game-engine/src/game.ts` — modified — remove onBegin draw; thread shuffleProvider.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — modified — deal initial hands.
- `packages/game-engine/src/simulation/onBeginParity.ts` — modified — drop draw, keep resets.
- `packages/game-engine/src/simulation/simulation.runner.ts` — modified — turn-1 + shuffleProvider.
- `packages/game-engine/src/simulation/par.aggregator.ts` — modified — same.
- `packages/game-engine/src/test/fixtures/runFixture.ts` — modified — shuffleProvider; reset-only rotate.
- `packages/game-engine/src/replay/replay.execute.ts` — modified iff it calls advanceTurnStage.
- `packages/game-engine/src/replay/replay.execute.test.ts` — modified — `PRE_WP080_HASH` re-pin.
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — regenerated.
- Test files (enumerated — the core behaviour shift forces each; scope-lock complete):
  - `packages/game-engine/src/moves/endOfTurnCleanup.logic.test.ts` — new — the helper.
  - `packages/game-engine/src/game.test.ts` — onBegin auto-draw tests → onEnd/setup.
  - `packages/game-engine/src/setup/buildInitialGameState.shape.test.ts` — hand = `HAND_SIZE`.
  - `packages/game-engine/src/setup/playerInit.shape.test.ts` — `buildPlayerState` stays `hand: []`.
  - `packages/game-engine/src/simulation/onBeginParity.test.ts` — resets-only parity.
  - `packages/game-engine/src/turn/turnLoop.test.ts` — `TurnLoopContext` gains the `cleanup`
    closure (7 call sites); cleanup-branch cases use a zone-bearing state + assert cleanup ran.
  - `packages/game-engine/src/turn/turnLoop.integration.test.ts` — same (`cleanup` closure +
    zone-bearing cleanup-branch state).
  - `packages/game-engine/src/moves/coreMoves.integration.test.ts` — the `endTurn` case now
    expects the post-cleanup drawn hand (honest expectation change).
  - `packages/game-engine/src/rules/mastermindHandlers.test.ts` + full-match hand-count tests
    that assumed a 0-card between-turns hand — audited/updated case-by-case.
- `wiki/turn-system.md` — modified — update the draw-timing narrative (operator-requested).

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] `pnpm -r build && pnpm -r --no-bail test` — whole-repo green (harness/replay parity).
- [ ] `PRE_WP080_HASH` + sentinel re-pinned to regenerated values; correctness verified
      (Master Strike discards full hands in the regenerated sentinel messages/snapshots).
- [ ] `pnpm cards:check` + coverage `:check` green (unaffected).
- [ ] Live-on-surface (D-24026): a real match shows a full hand between turns + a Master
      Strike discarding from it.
- [ ] `docs/ai/STATUS.md`, `DECISIONS.md` (D-24520 Active), `WORK_INDEX.md` (checked),
      `05-ROADMAP-MINDMAP.md` (✅ + `roadmap:counts:check`), `wiki/turn-system.md` updated.

## Common Failure Smells
- A player still has 0 cards between turns — the draw wasn't reached on one turn-end path
  (missing the `advanceTurnStage` cleanup call, or a harness still drawing at turn-start).
- Double hand (12 cards) — cleanup ran twice, or `applyOnBeginParity` still draws.
- A harness replay diverges — the harness didn't move the draw to end-of-turn (parity break).
- A hash moved unexpectedly on an UNRELATED oracle — a non-optional field or a reset leaked;
  STOP and investigate (do not re-pin blindly).
- Turn-1 crash / empty first hand — setup didn't deal initial hands, or a harness still relied
  on the turn-1 pre-loop draw.
