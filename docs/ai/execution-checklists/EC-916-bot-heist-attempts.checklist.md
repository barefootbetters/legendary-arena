# EC-916 — Bots attempt a Heist when the card-count odds favor it (Execution Checklist)

**Source:** docs/ai/work-packets/WP-878-bot-heist-attempts.md
**Layer:** Game Engine simulation / bot policy (`packages/game-engine/src/simulation/**`) + a header comment in `moves/attemptHeist.ts`
**Risk Tier:** MEDIUM — bot behavior and bot-driven simulation output for loadouts with an `amwp` Heist Hero; no rules, UIState, auth, money, persistence, client or server code

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `799463b4` with the reserve #3245 merged; `pnpm -r build && pnpm -r --no-bail test`
      exit 0; record every package's count.
- [ ] Read the models: `moves/attemptHeist.ts` (`heistCount`, `heistRevealedVictoryPoints`, `isHeistAvailable`, the move);
      `getLegalMoves` steps 4b–5 and `SIMULATION_MOVE_NAMES` (`simulation/ai.legalMoves.ts`); `scoreOneMove`
      (`simulation/ai.competent.ts`); the WP-757 `exorciseHauntedHero` `MOVE_MAP` entries and drift block;
      `getHooksForCard` (`rules/heroAbility.types.ts` ~l.437); `fireHeistPlays` (`hero/heroEffects.execute.ts`).
- [ ] Re-check: no sentinel / hash-oracle / PAR fixture uses an `amwp` Hero (`git grep scott-lang-cat-burglar`, `amwp/ant-army`,
      `amwp/wasp`, `amwp/ant-man` outside card data and docs). Expected hits: unit tests, `scripts/runtime-observed-hollows.mjs`,
      `content/themes/ultron-age.json` (a theme; no pin reads it). A sentinel / hash / PAR hit is a STOP: its pin can move.

## Locked Values (do not re-derive)
- Policy (Jeff, 2026-11-08): attempt iff `isHeistAvailable(G, playerId)` AND `hasBotHeistPayoff(G)` AND
  `odds.winCount > odds.loseCount`. Ties count as neither. Never read `deck[0]` or any single deck index.
- `simulation/ai.heist.ts` (new, pure, no `boardgame.io`):
  `interface HeistOdds { readonly winCount: number; readonly tieCount: number; readonly loseCount: number }`;
  `countHeistOdds(G, playerId): HeistOdds` (Heist Count from `heistCount`; per card of `G.villainDeck.deck`,
  `heistRevealedVictoryPoints`; `count > victoryPoints` win, `===` tie, else lose; absent / empty deck → all 0);
  `hasBotHeistPayoff(G): boolean` (the `fireHeistPlays` walk: crew card → `getHooksForCard(G.heroAbilityHooks ?? [], cardId)`
  → `hook.effects ?? []` with `type === 'heist'` → `heistEffects ?? []`; true as soon as one inner `type` is not
  `'heist-move-villain-ko-hero'`);
  `shouldBotAttemptHeist(G, playerId): boolean` (explicit `if` chain, availability first).
- `getLegalMoves` step 4c, after 4b and before 5: `if (stage === 'main' && shouldBotAttemptHeist(gameState, activePlayer))`
  push `{ name: 'attemptHeist', args: {} }`. Header enumeration list gains the 4b (missing today) and 4c lines.
- `SIMULATION_MOVE_NAMES` gains `'attemptHeist'` (appended last).
- `SCORE_ATTEMPT_HEIST = 175`; `scoreOneMove` arm `if (move.name === 'attemptHeist') return SCORE_ATTEMPT_HEIST;`.
- `MOVE_MAP` entry in `simulation.runner.ts` and `par.aggregator.ts`: `attemptHeist: (context) => attemptHeist(context as never)`.
- Odds test deck (Heist Count 2): Scheme Twist 0, Bystander 1, henchman 1, villain 2, villain 4 → win 3, tie 1, lose 1.
- D-24826 amends D-24808 §2 / §7, closes D-24823 §7, and supersedes the `ai.competent.ts` "Exact card counting" line and
  WP-049 Heuristic 4 (~l.152) and §A.4 (~l.274) for the Heist gate only (the policy still never reads raw `G`); the
  WP-049 post-mortem line "does not consult deck composition" is historical.

## Guardrails
- Non-`amwp` boards: `getLegalMoves` output and every bot choice byte-identical (an existing enumeration test passes unedited).
- Core sentinel, hash-oracle, PAR and `sim:coverage` pins do not move; a moved pin is a STOP, never a re-pin.
- `sim:runtime-observed` may move only as explained by its `amwp` board; regenerate, never hand-edit.
- No change to `attemptHeist` behavior, `isHeistAvailable`, UIState, the client, the server, `game.ts` behavior or
  registration (one comment only), `CORE_MOVE_NAMES`, `MOVE_ALLOWED_STAGES` or `LOG_OUTCOMES`.
- STOP if `sim:runtime-observed` reports `gamesNotTerminated > 0` (`scripts/runtime-observed-hollows.mjs` ~l.446).
- No randomness, clock or I/O in `ai.heist.ts`; helpers never throw.
- No `.reduce()`, no nested ternaries; JSDoc on every function; `is/has/can` booleans.

## Required `// why:` Comments
- `shouldBotAttemptHeist`: the odds rule and that it never reads the top card or the order (D-24826 §1, §5).
- `hasBotHeistPayoff`: the X-Con bot answer declines, so an X-Con-only crew gains nothing.
- Step 4c: the gate lives in `getLegalMoves` so every policy honors it; `isHeistAvailable` first (D-24364).
- `SCORE_ATTEMPT_HEIST`: after every playable card, before plain spends; bonus fights and the Mastermind still first.
- Each `MOVE_MAP` entry and the `SIMULATION_MOVE_NAMES` entry (dispatchable or the per-turn loop hangs, WP-289 / D-24073).
- The `ai.competent.ts` "Forbidden behaviors" carve-out: the Heist gate's set count (D-24826) is the one exception.
- The refreshed comments in `selectDefaultMoveVillainArgs`, `chooseByKind`, the `attemptHeist.ts` header, the `game.ts`
  `attemptHeist` registration and the `game.test.ts` move-list pin (now reached / now emitted by `getLegalMoves`).

## Files to Produce
- Engine (`packages/game-engine/src/`): `simulation/ai.heist.ts` (**new**), `simulation/ai.heist.test.ts` (**new**),
  `simulation/{ai.legalMoves,ai.legalMoves.test,ai.competent,ai.competent.test}.ts`, `simulation/ai.seatChoice.ts`
  (comment), `simulation/{simulation.runner,par.aggregator}.ts`, `simulation/simulation.moveDispatch.drift.test.ts`,
  `moves/attemptHeist.ts` (header comment), `game.ts` and `game.test.ts` (one comment each). `index.ts` NOT modified.
- Generated, only if it moves: `docs/ai/coverage/runtime-observed-hollows.json`,
  `apps/dashboard/src/data/in-play-hollow-baseline.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (pin).
- Close: `DECISIONS.md` (D-24826), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`.

## Tests (new cases)
- `ai.heist.test.ts`: the locked tally; reversed deck same tally and decision; losing-top-but-favorable → true;
  winning-top-but-unfavorable → false; ties only → false; X-Con only → false; X-Con + Petty Larceny → true; each
  `isHeistAvailable` failure → false; `structuredClone(G)` before the three calls deep-equals `G` after (no mutation).
- `ai.legalMoves.test.ts`: emitted once, after 4b, before `advanceStage`; absent when false / not `main`; guard parity (run the
  move, the latch is set, not re-emitted); an X-Con + Petty Larceny crew, winning deck, a City Villain and an empty space: the
  move with a runner-shaped `SimulationMoveContext` (no new runner export) parks the X-Con choice, `getLegalMoves` yields
  its decline, `resolveMoveVillainChoice` with it empties the queue.
- `ai.competent.test.ts`: `playCard` > `attemptHeist` > plain fight / recruit / exorcise / advance; Mastermind fight > it.
- `simulation.moveDispatch.drift.test.ts`: `attemptHeist` in `SIMULATION_MOVE_NAMES` and both `MOVE_MAP` key sets.

## After Completing
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail everywhere; counts recorded.
- [ ] `sim:coverage --check` 0 unchanged; `sim:runtime-observed` regenerated, `:check` 0, diff explained by the `amwp` board;
      if it moved, dashboard `prebuild:coverage`, `build:in-play-baseline`, `test:coverage` 0.
- [ ] Termination probe (scratchpad, `dist`, `simulateOneGameAndCaptureMoves` + competent policy, sentinel core, heroes
      `amwp/scott-lang-cat-burglar`, `amwp/ant-army`, `amwp/wasp`, `amwp/ant-man`, `core/black-widow`, 8 seeds, 1 player):
      `endgameReached` for every game, ≥1 `attemptHeist` move, X-Con `{ decline: true }` count and Anthem `resolveSeatChoice`
      upper bound stated (0 allowed; move list only, no won / tied / lost split); numbers into D-24826 §Execution notes.
- [ ] `ledger:numbers:check`, `roadmap:counts:check`, `workindex:rows:check`, `workindex:executed:check` 0.
- [ ] `git diff --name-only origin/main` ⊆ Files to Produce.
- [ ] D-24826 Active; STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap ✅ + `roadmap:counts:write`; ledger LANDED; D-24026
      live-verify operator-pending in STATUS.

## Common Failure Smells
- The bot never attempts: `scoreOneMove` has no arm (unknown moves score 0, below advance 10).
- The sim hangs on "unknown move name": a `MOVE_MAP` entry is missing.
- The bot attempts before playing its other Heist cards: the score was set above 200.
- A test only passes with a specific deck order: the helper reads `deck[0]`.
