/**
 * Indestructible Man's shared reads and writes (WP-768 / D-24601).
 *
 * bkwd Indestructible Man prints: "You can't use [icon:attack] to fight Indestructible Man."
 * and "Once during each of your turns, you may shuffle two Elite Assassins from your Victory
 * Pile into the Villain Deck. If you do, fight Indestructible Man." His Master Strike shuffles
 * an Elite Assassin from the current player's Victory Pile into the Villain Deck.
 *
 * This module is the one home of those rules: the fightMastermind move, its getLegalMoves
 * mirror (D-24364), the Master Strike and the UIState projection all read these helpers, so
 * the move gate, the bot and the board can never disagree.
 *
 * Pure helpers over G. No boardgame.io import. No registry import. No .reduce(). Never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { shuffleDeck } from '../setup/shuffle.js';
import { victoryPointValueForCard } from '../economy/bloodFrenzy.logic.js';
import { isMastermindHaunting } from '../board/haunt.logic.js';
import { isMastermindGuarded } from '../board/besideMastermind.logic.js';
import { isFinalBlowAvailable } from './mastermind.logic.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';

/** Indestructible Man's qualified mastermind id (`G.selection.mastermindId`). */
export const INDESTRUCTIBLE_MAN_MASTERMIND_ID = 'bkwd/indestructible-man';

// why: every Elite Assassin instance id is `bkwd-villain-elite-assassins-<card>-NN`
// (villainDeck.setup.ts builds a copy suffix per instance), so a prefix match finds every
// copy of every Assassin and nothing else in a Victory Pile.
/** The ext_id prefix shared by every Elite Assassin instance. */
export const ELITE_ASSASSIN_EXT_ID_PREFIX = 'bkwd-villain-elite-assassins-';

// why: the base face prints "shuffle two Elite Assassins"; the Epic face's three is out of
// scope (Epic Masterminds are not selectable, D-24193).
/** How many Elite Assassins one shuffle-fight costs. */
export const SHUFFLE_FIGHT_ASSASSIN_COUNT = 2;

/** The engine-written reason a plain Fight against Indestructible Man is refused. */
export const INDESTRUCTIBLE_MAN_ATTACK_LOCK_REASON =
  "You can't use Attack to fight Indestructible Man. Shuffle two Elite Assassins from your Victory Pile into the Villain Deck to fight him.";

/**
 * Reports whether the match's Mastermind is Indestructible Man.
 *
 * @param G - The game state (read-only).
 * @returns True when the selected Mastermind is bkwd Indestructible Man.
 */
export function isIndestructibleMan(G: LegendaryGameState): boolean {
  // why: a narrow test G may omit selection; treat it as any other Mastermind.
  return G.selection?.mastermindId === INDESTRUCTIBLE_MAN_MASTERMIND_ID;
}

/**
 * Lists the Elite Assassins in a player's Victory Pile, in pile order.
 *
 * @param G - The game state (read-only).
 * @param playerId - The player whose Victory Pile is read.
 * @returns The Assassin ext_ids; empty when the player is unknown or has none.
 */
export function listEligibleAssassins(G: LegendaryGameState, playerId: string): CardExtId[] {
  const zones = G.playerZones[playerId];
  if (zones === undefined) {
    return [];
  }
  const assassins: CardExtId[] = [];
  for (const cardId of zones.victory) {
    if (cardId.startsWith(ELITE_ASSASSIN_EXT_ID_PREFIX)) {
      assassins.push(cardId);
    }
  }
  return assassins;
}

/**
 * Reports whether a player may shuffle-fight Indestructible Man (ignoring the board gates).
 *
 * @param G - The game state (read-only).
 * @param playerId - The player who would fight.
 * @returns True when he is the Mastermind, the shuffle is unused this turn, and the player
 *   has at least SHUFFLE_FIGHT_ASSASSIN_COUNT Elite Assassins.
 */
export function canShuffleFight(G: LegendaryGameState, playerId: string): boolean {
  if (!isIndestructibleMan(G)) {
    return false;
  }
  if (G.indestructibleManShuffleUsedThisTurn === true) {
    return false;
  }
  return listEligibleAssassins(G, playerId).length >= SHUFFLE_FIGHT_ASSASSIN_COUNT;
}

/**
 * Validates an untrusted `shuffleAssassinIds` move argument.
 *
 * @param G - The game state (read-only).
 * @param playerId - The fighting player.
 * @param ids - The untrusted argument.
 * @returns True for exactly SHUFFLE_FIGHT_ASSASSIN_COUNT distinct strings, each an Elite
 *   Assassin in that player's Victory Pile.
 */
export function isValidShuffleFightPick(
  G: LegendaryGameState,
  playerId: string,
  ids: unknown,
): ids is readonly CardExtId[] {
  if (!Array.isArray(ids) || ids.length !== SHUFFLE_FIGHT_ASSASSIN_COUNT) {
    return false;
  }
  const eligible = listEligibleAssassins(G, playerId);
  const seen: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || seen.includes(id) || !eligible.includes(id)) {
      return false;
    }
    seen.push(id);
  }
  return true;
}

/**
 * Picks a player's lowest-VP Elite Assassins (ties broken by ext_id).
 *
 * // why: the bot's default pair and the Master Strike's single pick (not a player choice,
 * D-24601) both spend the Assassins worth the least, so the score cost is smallest.
 *
 * @param G - The game state (read-only).
 * @param playerId - The player whose Victory Pile is read.
 * @param count - How many to pick.
 * @returns Up to `count` ext_ids, lowest VP first.
 */
export function selectLowestVpAssassins(
  G: LegendaryGameState,
  playerId: string,
  count: number,
): CardExtId[] {
  const ranked: { cardId: CardExtId; victoryPoints: number }[] = [];
  for (const cardId of listEligibleAssassins(G, playerId)) {
    ranked.push({ cardId, victoryPoints: victoryPointValueForCard(G, playerId, cardId) ?? 0 });
  }
  ranked.sort((left, right) => {
    if (left.victoryPoints !== right.victoryPoints) {
      return left.victoryPoints - right.victoryPoints;
    }
    if (left.cardId < right.cardId) {
      return -1;
    }
    if (left.cardId > right.cardId) {
      return 1;
    }
    return 0;
  });
  const picked: CardExtId[] = [];
  for (const entry of ranked) {
    if (picked.length >= count) {
      break;
    }
    picked.push(entry.cardId);
  }
  return picked;
}

/**
 * Shuffles cards from a player's Victory Pile into the Villain Deck.
 *
 * // why: WP-838 / D-24771 shape — the cards join the deck and the whole deck is shuffled
 * once through the caller's seeded Shuffle, so the order is deterministic per seed. A null
 * provider (a stub strike context) moves nothing and logs that it could not shuffle, the
 * Baron Strucker null-source precedent.
 *
 * @param G - The game state (mutated: the Victory Pile, the Villain Deck, messages).
 * @param playerId - The player whose Victory Pile gives up the cards.
 * @param cardIds - The cards to move; each must be in that Victory Pile.
 * @param shuffleContext - The seeded Shuffle, or null when none is available.
 * @returns True when the cards moved.
 */
export function shuffleIntoVillainDeck(
  G: LegendaryGameState,
  playerId: string,
  cardIds: readonly CardExtId[],
  shuffleContext: ShuffleProvider | null,
): boolean {
  const zones = G.playerZones[playerId];
  if (zones === undefined || cardIds.length === 0) {
    return false;
  }
  if (shuffleContext === null) {
    pushLog(G,
      `No shuffle source was available, so no Elite Assassin was shuffled into the Villain Deck.`,
      'blocked',
    );
    return false;
  }
  for (const cardId of cardIds) {
    if (!zones.victory.includes(cardId)) {
      return false;
    }
  }
  const remaining: CardExtId[] = [...zones.victory];
  for (const cardId of cardIds) {
    remaining.splice(remaining.indexOf(cardId), 1);
  }
  zones.victory = remaining;
  G.villainDeck.deck = shuffleDeck([...G.villainDeck.deck, ...cardIds], shuffleContext);
  return true;
}

/**
 * Formats a list of cards for a log line.
 *
 * @param G - The game state (read-only; supplies cardDisplayData).
 * @param cardIds - The cards.
 * @returns The formatted names joined with " and ".
 */
export function formatAssassinList(G: LegendaryGameState, cardIds: readonly CardExtId[]): string {
  const names: string[] = [];
  for (const cardId of cardIds) {
    names.push(formatCardRef(G.cardDisplayData, cardId));
  }
  return names.join(' and ');
}

/**
 * Reports whether the shuffle-fight is open on the board for a player.
 *
 * Covers the board and flag conditions only (Assassins, once per turn, tactics or an
 * available Final Blow, Haunt, guard); the client still applies its stage, heal and
 * pending-choice gates, exactly as it does for a plain Fight. Read by the projection.
 *
 * @param G - The game state (read-only).
 * @param playerId - The player who would fight.
 * @returns True when the shuffle-fight would pass every board gate for that player.
 */
export function isShuffleFightOpen(G: LegendaryGameState, playerId: string): boolean {
  if (!canShuffleFight(G, playerId)) {
    return false;
  }
  const hasFightTarget =
    G.mastermind.tacticsDeck.length > 0 || isFinalBlowAvailable(G.mastermind, G.finalBlow);
  if (!hasFightTarget) {
    return false;
  }
  return !isMastermindHaunting(G) && !isMastermindGuarded(G);
}

/**
 * Reports whether the attack lock reason should be shown for Indestructible Man.
 *
 * // why: the lock reason rides UIMastermindState.fortifiedReason; once he is vanquished
 * (no tactics and no Final Blow left) the tile must show its "victory assured" state, not
 * the lock, so the reason is projected only while a fight is otherwise still possible.
 *
 * @param G - The game state (read-only).
 * @returns True when he is the Mastermind and a fight target remains.
 */
export function isIndestructibleManLockShown(G: LegendaryGameState): boolean {
  if (!isIndestructibleMan(G)) {
    return false;
  }
  return G.mastermind.tacticsDeck.length > 0 || isFinalBlowAvailable(G.mastermind, G.finalBlow);
}
