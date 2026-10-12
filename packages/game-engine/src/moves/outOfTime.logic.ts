/**
 * Man / Woman Out of Time — the turn-2 replay (WP-803 / D-24692).
 *
 * Rules v23 L1667-1694: "After you use this card's abilities, set it aside. At the
 * beginning of your next turn, play this card a second time and then discard it."
 * The `out-of-time` hero handler (hero/heroEffects.execute.ts) does turn 1: it moves
 * the just-played card out of inPlay into `G.outOfTimeCards[playerID]`. This file does
 * turn 2: on the owner's next start → main advance, each set-aside card is played a
 * second time through the shared play core and then discarded.
 *
 * Called only through the `beginMain` closure that every turn loop binds on
 * `TurnLoopContext` (turn/turnLoop.ts), so live play, the simulation runner, the PAR
 * aggregator, the fixture runner and the replay harness all replay identically.
 *
 * No boardgame.io imports. No .reduce(). Never throws.
 */

import type { LegendaryGameState } from '../types.js';
import { applyCardPlay } from './coreMoves.impl.js';
import { moveCardFromZone } from './zoneOps.js';
import { recordOutOfTimePlayed } from '../economy/economy.logic.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';

// why: the play core's own context parameter type — the move context rest (random,
// events, ctx) that playCard hands to applyCardPlay. Derived from applyCardPlay so this
// file never redeclares (and drifts from) coreMoves.impl.ts's local MoveContext.
type ReplayPlayContext = Parameters<typeof applyCardPlay>[1];

/**
 * Plays each of a player's Out of Time cards a second time, in set-aside order, then
 * discards it (WP-803 / D-24692).
 *
 * Returns early, mutating nothing, when the player has no set-aside entry or no
 * playerZones. Otherwise snapshots the list, deletes the player's key once (and the
 * whole field when no key remains), then for each snapshot card: records it in the
 * turn's Out of Time ledger, logs the return line, plays it through `applyCardPlay`,
 * and — if it is still in inPlay — moves it to the end of the discard pile.
 *
 * No stage check: the caller (`advanceTurnStage`'s start → main branch) is the window.
 *
 * @param G - The game state, mutated in place.
 * @param context - The move context rest the play core needs (random for effects).
 * @param playerID - The player whose turn is starting main (the active player).
 */
export function replayOutOfTimeCards(
  G: LegendaryGameState,
  context: ReplayPlayContext,
  playerID: string,
): void {
  const outOfTimeCards = G.outOfTimeCards;
  const setAside = outOfTimeCards?.[playerID];
  if (outOfTimeCards === undefined || setAside === undefined || G.playerZones[playerID] === undefined) {
    return;
  }

  // why: snapshot then delete ONCE, before any play. A replayed card's abilities run
  // inside this loop, so the loop must not iterate a list those abilities could touch;
  // deleting up front also keeps the field absent afterwards (hash stability, D-24526).
  const snapshot = [...setAside];
  delete outOfTimeCards[playerID];
  if (Object.keys(outOfTimeCards).length === 0) {
    delete G.outOfTimeCards;
  }

  for (const cardId of snapshot) {
    // why: rules v23 L1674 / L1692 — the card is discarded the second time you play it,
    // so it can never go Out of Time again. Recording it in the ledger BEFORE the play
    // makes the handler's guard 1 block the second set-aside; it also keeps the card
    // counted as played this turn after the discard below (rules v23 L1682).
    G.turnEconomy = recordOutOfTimePlayed(G.turnEconomy, cardId);
    pushLog(G,
      `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, cardId)} returns from Out of Time and is played a second time.`,
      'neutral',
      cardId, // why: WP-438 — the returning card.
    );
    applyCardPlay(G, context, playerID, cardId);

    // why: rules v23 L1667 — "play this card a second time and then discard it". This is
    // the keyword's own cleanup, not "you discarded a card", so it makes no
    // recordCardDiscardedThisTurn / discardFromHand call (nothing that reads "when you
    // discard" fires). A card an ability already moved out of inPlay is left where it is.
    const playerZones = G.playerZones[playerID]!;
    if (playerZones.inPlay.includes(cardId)) {
      const moved = moveCardFromZone(playerZones.inPlay, playerZones.discard, cardId);
      playerZones.inPlay = moved.from;
      playerZones.discard = moved.to;
    }
  }
}
