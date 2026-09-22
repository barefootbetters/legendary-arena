/**
 * Deferred Mastermind-victory promotion for Legendary Arena (WP-732 / D-24553).
 *
 * Per Universal Rules v23 §"End of the Game: Players Win", defeating the final
 * Mastermind Tactic assures victory but does NOT end the game mid-turn — the
 * current player still finishes their turn (fighting a few more Villains for
 * Victory Points) and the game ends at the END of that turn. The vanquish
 * therefore latches the non-terminal MASTERMIND_DEFEATED_PENDING counter (see
 * fightMastermind.ts); this module promotes that latch to the terminal
 * MASTERMIND_DEFEATED counter at the true end-of-game moment (turn.onEnd).
 *
 * This is the latch-then-resolve-at-turn-end sibling of finalTurn.logic.ts: that
 * module latches a deck-exhaustion tie mid-turn and resolves it at turn end; this
 * one latches an assured Mastermind win mid-turn and resolves it at turn end.
 *
 * No boardgame.io imports (a pure helper, like finalTurn.logic.ts). Deterministic.
 * Side effects are limited to G.counters, G.messages, and the pending-choice
 * fields, so these helpers are independently unit-testable.
 */

import type { LegendaryGameState } from '../types.js';
import { ENDGAME_CONDITIONS } from './endgame.types.js';
import { pushLog } from '../log/logPush.js';

/**
 * Promotes a pending Mastermind victory to the terminal win at turn end.
 *
 * If MASTERMIND_DEFEATED_PENDING is latched and the terminal MASTERMIND_DEFEATED
 * is not yet set, sets the terminal counter (so evaluateEndgame now returns
 * heroes-win), drops any player choice still parked at the true end of game (the
 * relocated D-24518 invariant — a won final state carries no dangling prompt),
 * and logs the win. Idempotent: once the terminal counter is set, subsequent
 * calls return immediately, so only the first turn-end promotion writes and logs.
 *
 * Called at every bgio-bypassing turn-end boundary (play-phase turn.onEnd in
 * game.ts, the simulation endTurn boundary, the fixture-runner rotation) and,
 * because the replay harness has no rotation site, once after its move loop.
 *
 * @param gameState - The game state to inspect and (on first promotion) mutate.
 */
export function promoteMastermindVictoryIfPending(gameState: LegendaryGameState): void {
  const isPendingLatched =
    (gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING] ?? 0) >= 1;
  const isTerminalAlreadySet =
    (gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] ?? 0) >= 1;
  if (!isPendingLatched || isTerminalAlreadySet) {
    return;
  }

  // why: WP-732 / D-24553 — the assured win becomes the real end of game now, at
  // the end of the winning player's turn. Set the terminal counter so
  // evaluateEndgame returns heroes-win (the top-level endIf then sets ctx.gameover).
  gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] = 1;

  // why: D-24518 (relocated from the vanquish site by WP-732) — the game is over,
  // so any choice still parked during the winning turn can never be resolved and
  // must not dangle as a prompt on the victory screen. At the vanquish the choice
  // legitimately stood (the player could still resolve it during the rest of the
  // turn); here, at true end of game, it is dropped.
  dropAllPendingPlayerChoices(gameState);

  pushLog(
    gameState,
    'The turn ends — the Mastermind is vanquished and the heroes win the game!',
  );
}

/**
 * Drops EVERY pending player choice from `G` (D-24518, audit-hardened; relocated
 * to the turn-end promotion by WP-732).
 *
 * Called ONLY at the true end of game (from promoteMastermindVictoryIfPending):
 * the game is over, so no pending choice can ever be resolved and none must
 * survive as a dangling prompt on the victory screen. Each field is set to
 * `undefined` so the won final state carries no pending choice (JSON-omitted, so
 * the hash oracles stay clean). Under WP-732 the vanquish itself no longer drops
 * — a choice parked by the final Tactic's Fight ability is legitimately
 * resolvable during the rest of the winning player's turn — so this removes
 * exactly what remained unresolved when the turn finally ended.
 *
 * This is the COMPLETE `pending*` set on `LegendaryGameState`. If a new
 * pending-choice field is added to the game state, add it here too (and to the
 * `clears EVERY pending-choice field` drift test in
 * mastermindVictory.logic.test.ts), or a choice parked in it at the winning
 * turn's end will dangle.
 *
 * @param gameState - Game state (mutated under the caller's Immer draft).
 */
export function dropAllPendingPlayerChoices(gameState: LegendaryGameState): void {
  gameState.pendingCopyPowersChoices = undefined;
  gameState.pendingCountScaledChoice = undefined;
  gameState.pendingDefeatChoices = undefined;
  gameState.pendingDiscardChoices = undefined;
  gameState.pendingDiscardToPlay = undefined;
  gameState.pendingDivingBlockWounds = undefined;
  gameState.pendingDoOverChoices = undefined;
  gameState.pendingDrawOrEmpowered = undefined;
  gameState.pendingElectromagneticBubbleChoices = undefined;
  gameState.pendingGiveHqHeroChoices = undefined;
  gameState.pendingHeroChoice = undefined;
  gameState.pendingKoDiscardChoices = undefined;
  gameState.pendingKoHeroChoices = undefined;
  gameState.pendingMelterKoChoices = undefined;
  gameState.pendingOptionalKoRewards = undefined;
  gameState.pendingOptionalPutBottomHQ = undefined;
  gameState.pendingPlayVillainTopChoices = undefined;
  gameState.pendingPutAnyNumberBottomHQ = undefined;
  gameState.pendingPutCardsOnDeckChoices = undefined;
  gameState.pendingPutHandOnDeckTop = undefined; // why: WP-700 / D-24519 — the put-a-hand-card-on-deck-top queue joins the end-of-game drop set (D-24518)
  gameState.pendingReorderChoices = undefined;
  gameState.pendingReturnOnDiscard = undefined;
  gameState.pendingReturnZeroCostDiscard = undefined;
  gameState.pendingRevealTopDispose = undefined; // why: WP-702 / D-24521 — the reveal-top discard-or-keep queue joins the end-of-game drop set (D-24518)
  gameState.pendingRuthlessDictatorChoices = undefined;
  gameState.pendingScryKoChoices = undefined;
  gameState.pendingSeatChoice = undefined;
  gameState.pendingSmashDiscards = undefined;
  gameState.pendingUndercoverChoice = undefined;
  gameState.pendingVictoryPileCardPick = undefined;
}
