/**
 * Demolish (WP-864 / D-24807) — the one shared engine resolver for "[Demolish] each player".
 *
 * Rules v23 p.24 (keywords-full.json `demolish`): reveal the top card of the Hero Deck, note
 * its cost, put it on the bottom of the Hero Deck; each player reveals their hand and discards
 * a card with that cost. Reveal only one card, not one per player.
 *
 * Fin Fang Foom's Master Strike (`rules/mastermindHandlers.ts`) and the `demolish-each-player`
 * villain primitive (`villain/villainEffects.execute.ts`) both call `demolishEachPlayer`; no
 * other copy of this rule exists.
 *
 * Pure helper: no boardgame.io import, no registry import, no `.reduce()`, never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';
import { offPlayCardStats } from '../hero/splitCard.logic.js';
import { seatsInTurnOrderFrom } from '../turn/seatOrder.logic.js';
import { selectDefaultCostDiscardCard } from '../moves/villainDefeatRequirement.logic.js';
import { discardFromHand } from '../moves/discardFromHand.js';

/** One player's discard made by a Demolish. */
export interface DemolishDiscard {
  playerId: string;
  cardId: CardExtId;
}

/**
 * What one Demolish did: the revealed Hero (null when the Hero Deck was empty), its printed
 * cost (null when nothing was revealed or the card has no cost), and each player's discard.
 */
export interface DemolishResult {
  revealedCardId: CardExtId | null;
  cost: number | null;
  discards: DemolishDiscard[];
}

/**
 * Demolishes each player once: reveals the Hero Deck's top card, puts it on the bottom, and
 * has each player, current player first, discard the earliest hand card of that cost.
 *
 * @param G - The game state (mutated: the Hero Deck order, players' hands and discards, the log).
 * @param currentPlayer - The active player; the discard loop starts with them (D-24780). Null
 *   (stub contexts) keeps the sorted seat order.
 * @param logPrefix - The source label every log line starts with (e.g.
 *   `[Fin Fang Foom Master Strike]` or `Ambush effect:`).
 * @returns What was revealed and who discarded what.
 */
export function demolishEachPlayer(
  G: LegendaryGameState,
  currentPlayer: string | null,
  logPrefix: string,
): DemolishResult {
  // why: rules v23 p.24 — "Reveal only one card": one Hero Deck reveal per Demolish, read
  // once here, outside the per-player loop, so every player discards against the same cost.
  const revealedCardId = G.heroDeck[0];
  if (revealedCardId === undefined) {
    pushLog(G, `${logPrefix} the Hero Deck is empty, so nothing is Demolished.`, 'blocked');
    return { revealedCardId: null, cost: null, discards: [] };
  }

  // why: the bottom of the Hero Deck is the array end (heroDeck[0] is the top). Rotating by
  // rebind (the D-24481 idiom) keeps the deck length unchanged and never mutates in place.
  G.heroDeck = [...G.heroDeck.slice(1), revealedCardId];

  const revealedName = resolveCardName(G.cardDisplayData, revealedCardId);
  const cost = offPlayCardStats(G, revealedCardId)?.cost;
  if (cost === undefined) {
    pushLog(
      G,
      `${logPrefix} Demolish revealed ${revealedName} and put it on the bottom of the Hero Deck, but it has no cost, so no one discards.`,
      'blocked',
    );
    return { revealedCardId, cost: null, discards: [] };
  }

  pushLog(
    G,
    `${logPrefix} Demolish revealed ${revealedName} (cost ${cost}) and put it on the bottom of the Hero Deck.`,
    'applied',
  );

  const discards = discardCardOfCostForEachPlayer(G, currentPlayer, cost, logPrefix);

  // why: the result names what was revealed and who discarded what, so later Demolish
  // readers ("for each player that discards a card this way", Epic Fin Fang Foom's "KO all
  // the Heroes Demolished this way") can build on it without re-deriving the discards.
  return { revealedCardId, cost, discards };
}

/**
 * Has each player discard one hand card of the given cost, if they hold one.
 *
 * @param G - The game state (mutated: hands, discards, the log).
 * @param currentPlayer - The active player, or null for sorted order.
 * @param cost - The revealed Hero's printed cost.
 * @param logPrefix - The source label every log line starts with.
 * @returns Each player's discard, in the order they were made.
 */
function discardCardOfCostForEachPlayer(
  G: LegendaryGameState,
  currentPlayer: string | null,
  cost: number,
  logPrefix: string,
): DemolishDiscard[] {
  const discards: DemolishDiscard[] = [];
  // why: rules v23 L2247 — start with the current player, then clockwise (D-24780); a null
  // currentPlayer (stub contexts) keeps the sorted order.
  const playerIds = seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer);
  for (const playerId of playerIds) {
    // why: the rulebook lets each player choose which card of that cost to discard. Every
    // candidate has the same cost, so the engine auto-picks the earliest one in hand order
    // for every player (the WP-821 Arnim Zola strike precedent); an interactive pick is
    // deferred (D-24807).
    const cardId = selectDefaultCostDiscardCard(G, playerId, [cost]);
    if (cardId === null) {
      pushLog(G, `${logPrefix} Player ${playerId} has no card that costs ${cost} to discard.`, 'blocked');
      continue;
    }
    discardFromHand(G, playerId, cardId);
    pushLog(
      G,
      `${logPrefix} Player ${playerId} discarded ${resolveCardName(G.cardDisplayData, cardId)} (cost ${cost}).`,
      'applied',
    );
    discards.push({ playerId, cardId });
  }
  return discards;
}
