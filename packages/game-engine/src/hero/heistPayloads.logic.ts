/**
 * Heist payloads for the Legendary Arena game engine (WP-876 / D-24823).
 *
 * Three Ant-Man and the Wasp Heist abilities do more than the shipped +recruit / +attack / draw /
 * rescue executors model. Their handlers in heroEffects.execute.ts are thin; the G-mutating work
 * lives here:
 *
 * - The Big Score: "If the card revealed from the Villain Deck is a Master Strike, KO it and put a
 *   card from the Bystander Deck on top of the Villain Deck." (applyHeistMasterStrikeKo)
 * - Revolutionary Anthem: "If the card revealed from the Villain Deck is a Scheme Twist, you get
 *   another +2 Attack, and you may shuffle that deck." (isHeistRevealedSchemeTwist,
 *   parkHeistShuffleChoice, applyHeistShuffleResolvedSeatChoice; the +2 itself goes through the
 *   shipped attack path in the handler)
 * - X-Con Security Van: "You may move a Villain to an empty city space. If you do, KO one of your
 *   Heroes." (applyHeistMoveVillain parks the move choice; resolveMoveVillainChoice resolves it)
 *
 * Every helper runs only inside a move (fireHeistPlays from attemptHeist, or resolveSeatChoice).
 * No boardgame.io import, no heroEffects.execute import, no I/O, no randomness of its own: the
 * only shuffle uses the seat-choice apply's shuffle context (ctx.random). This module and
 * moves/seatChoice.resolve.ts form a runtime-safe import cycle (the divingBlock.logic.ts
 * precedent): each reads the other's bindings only inside function bodies.
 */

import type { LegendaryGameState, PendingSeatChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { parkSeatChoice } from '../moves/seatChoice.resolve.js';
import { koCard } from '../board/ko.logic.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';

/** The seat-choice kind for Revolutionary Anthem's optional Villain Deck shuffle. */
export const HEIST_SHUFFLE_SEAT_CHOICE_KIND = 'heist-shuffle-villain-deck';

/** The shuffle option's label (option 0). */
export const HEIST_SHUFFLE_OPTION_LABEL = 'Shuffle the Villain Deck';

/** The leave option's label (option 1, the default). */
export const HEIST_LEAVE_OPTION_LABEL = 'Leave the Villain Deck as it is';

/** The boardgame.io events surface parkSeatChoice reads (possibly absent in a unit context). */
type HeistSeatChoiceEvents = Parameters<typeof parkSeatChoice>[1];

/** The deterministic shuffle source the seat-choice apply receives (absent on the timeout path). */
type HeistShuffleContext = { random: { Shuffle: <T>(deck: T[]) => T[] } } | undefined;

/**
 * Applies The Big Score's Master Strike clause on a successful Heist.
 *
 * Reads the card THIS Heist revealed (G.turnEconomy.heistRevealedCardId):
 * - absent, or not a Master Strike → a neutral line, nothing else;
 * - a Master Strike no longer on top of the Villain Deck → a blocked line, nothing else;
 * - else the Master Strike leaves the Villain Deck top for the KO pile, and the Bystander Deck's
 *   front card goes on top of the Villain Deck (nothing is put on top when that deck is empty).
 *
 * @param G - Game state (mutated: the Villain Deck, G.ko, the Bystander Deck, the log).
 * @param playerID - The player whose Heist succeeded.
 * @param cardId - The Big Score card, for log attribution.
 */
export function applyHeistMasterStrikeKo(G: LegendaryGameState, playerID: string, cardId: CardExtId): void {
  const cardRef = formatCardRef(G.cardDisplayData, cardId);
  const revealedCardId = G.turnEconomy.heistRevealedCardId;
  // why: WP-876 / D-24823 — "the card revealed" is the RECORDED id, never the live top: an
  // earlier Heist ability in this Heist may already have changed the Villain Deck top.
  if (revealedCardId === undefined || G.villainDeckCardTypes?.[revealedCardId] !== 'mastermind-strike') {
    pushLog(G, `The card Player ${playerID}'s Heist revealed is not a Master Strike, so ${cardRef} KOs nothing.`, 'neutral', cardId);
    return;
  }
  // why: WP-876 / D-24823 — KO "it" only while it is still on top. A second Big Score in the same
  // Heist finds the Bystander the first one put there, so it KOs nothing.
  if (G.villainDeck.deck[0] !== revealedCardId) {
    pushLog(G, `The Master Strike Player ${playerID}'s Heist revealed is no longer on top of the Villain Deck, so ${cardRef} KOs nothing.`, 'blocked', cardId);
    return;
  }
  G.villainDeck.deck = G.villainDeck.deck.slice(1);
  G.ko = koCard(G.ko, revealedCardId);
  const strikeRef = formatCardRef(G.cardDisplayData, revealedCardId);
  const bystanderId = G.piles.bystanders[0];
  if (bystanderId === undefined) {
    pushLog(G, `Player ${playerID}'s ${cardRef} KO'd ${strikeRef} from the Villain Deck; the Bystander Deck is empty, so no card goes on top.`, 'applied', cardId);
    return;
  }
  G.piles.bystanders = G.piles.bystanders.slice(1);
  G.villainDeck.deck = [bystanderId, ...G.villainDeck.deck];
  // why: WP-876 / D-24823 — a Bystander Deck card has no villainDeckCardTypes entry, and a reveal
  // of an untyped card fails, so it is typed 'bystander' when absent (the Change the Outcome of
  // WWII precedent).
  if (G.villainDeckCardTypes[bystanderId] === undefined) {
    G.villainDeckCardTypes[bystanderId] = 'bystander';
  }
  pushLog(G, `Player ${playerID}'s ${cardRef} KO'd ${strikeRef} from the Villain Deck and put a Bystander on top of the Villain Deck.`, 'applied', cardId);
}

/**
 * Whether the card this turn's Heist revealed is a Scheme Twist (Revolutionary Anthem's check).
 *
 * @param G - Game state (not mutated).
 * @returns true when the recorded revealed card is typed 'scheme-twist'.
 */
export function isHeistRevealedSchemeTwist(G: LegendaryGameState): boolean {
  const revealedCardId = G.turnEconomy.heistRevealedCardId;
  if (revealedCardId === undefined) {
    return false;
  }
  return G.villainDeckCardTypes?.[revealedCardId] === 'scheme-twist';
}

/**
 * Builds Revolutionary Anthem's optional shuffle seat choice for the active player.
 *
 * @param playerID - The active player (the only addressed seat).
 * @returns The pending seat choice; the default leaves the deck as it is.
 */
function buildHeistShuffleChoice(playerID: string): PendingSeatChoice {
  return {
    kind: HEIST_SHUFFLE_SEAT_CHOICE_KIND,
    addressedSeats: [playerID],
    seatPrompts: {
      [playerID]: {
        options: [{ label: HEIST_SHUFFLE_OPTION_LABEL }, { label: HEIST_LEAVE_OPTION_LABEL }],
      },
    },
    submissions: {},
    // why: WP-876 / D-24823 — "you may shuffle": the timeout default leaves the deck as it is.
    defaultOptionIndex: 1,
  };
}

/**
 * Offers Revolutionary Anthem's "you may shuffle that deck" as one seat choice for the active
 * player, unless a seat choice is already open.
 *
 * // why: WP-876 / D-24823 — one prompt per Heist. attemptHeist requires no open choice and no
 * other Heist line parks a seat choice, so an open one here is an earlier Anthem's offer; shuffling
 * twice is the same choice, so the second Anthem logs "already offered" and parks nothing.
 * Parked with the active player as the skipped seat, so no stage ride is needed.
 *
 * @param G - Game state (mutated: G.pendingSeatChoice, the log).
 * @param events - The move's boardgame.io events (undefined in a unit context).
 * @param playerID - The active player.
 * @param cardId - The Revolutionary Anthem card, for log attribution.
 */
export function parkHeistShuffleChoice(
  G: LegendaryGameState,
  events: HeistSeatChoiceEvents,
  playerID: string,
  cardId: CardExtId,
): void {
  const cardRef = formatCardRef(G.cardDisplayData, cardId);
  if (G.pendingSeatChoice !== undefined) {
    pushLog(G, `Player ${playerID} has already been offered a shuffle of the Villain Deck this Heist (${cardRef}).`, 'neutral', cardId);
    return;
  }
  parkSeatChoice(G, events, buildHeistShuffleChoice(playerID), playerID);
  pushLog(G, `Player ${playerID} may shuffle the Villain Deck (${cardRef}).`, 'neutral', cardId);
}

/**
 * Applies a resolved 'heist-shuffle-villain-deck' seat choice: shuffle the Villain Deck, or leave it.
 *
 * // why: WP-876 / D-24823 — the only randomness in the Heist payloads, through the seat-choice
 * apply's shuffle context (ctx.random), never Math.random. The timeout path supplies no context;
 * its default is Leave, so it never needs one. A Shuffle answer with no context shuffles nothing.
 *
 * @param G - Game state (mutated: the Villain Deck order, the log).
 * @param choice - The fully-submitted seat choice.
 * @param shuffleContext - The move's random source, or undefined (timeout path).
 */
export function applyHeistShuffleResolvedSeatChoice(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  shuffleContext: HeistShuffleContext,
): void {
  const seat = choice.addressedSeats[0];
  if (seat === undefined) {
    return;
  }
  const optionIndex = choice.submissions[seat]?.optionIndex;
  if (optionIndex !== 0) {
    pushLog(G, `Player ${seat} left the Villain Deck as it is (Revolutionary Anthem).`, 'neutral');
    return;
  }
  if (shuffleContext === undefined) {
    pushLog(G, `Player ${seat} chose to shuffle the Villain Deck, but no shuffle source was available, so it was not shuffled (Revolutionary Anthem).`, 'blocked');
    return;
  }
  G.villainDeck.deck = shuffleContext.random.Shuffle([...G.villainDeck.deck]);
  pushLog(G, `Player ${seat} shuffled the Villain Deck (Revolutionary Anthem).`, 'applied');
}

/**
 * Parks X-Con Security Van's move-a-Villain choice when there is something to move.
 *
 * // why: WP-876 / D-24823 — the move needs a Villain in the City AND an empty City space
 * (`G.city[i] === null`); without both there is nothing to move, so nothing parks and nothing is
 * KO'd ("If you do"). The entry carries variant 'x-con-security-van', which makes
 * resolveMoveVillainChoice accept only empty destinations, rescue nothing, and KO one of the
 * player's Heroes after a move. Lazy-init at the park site (the Spinning Cyclone precedent).
 *
 * @param G - Game state (mutated: G.pendingMoveVillainChoices, the log).
 * @param playerID - The player whose Heist succeeded.
 * @param cardId - The X-Con Security Van card (the entry's sourceCardId).
 */
export function applyHeistMoveVillain(G: LegendaryGameState, playerID: string, cardId: CardExtId): void {
  let hasCityVillain = false;
  let hasEmptySpace = false;
  for (const citySpace of G.city) {
    if (citySpace === null) {
      hasEmptySpace = true;
    } else {
      hasCityVillain = true;
    }
  }
  const cardRef = formatCardRef(G.cardDisplayData, cardId);
  if (!hasCityVillain || !hasEmptySpace) {
    pushLog(G, `Player ${playerID}'s ${cardRef} has nothing to move: it needs a Villain in the City and an empty City space.`, 'blocked', cardId);
    return;
  }
  if (!G.pendingMoveVillainChoices) {
    G.pendingMoveVillainChoices = [];
  }
  G.pendingMoveVillainChoices.push({ playerID, sourceCardId: cardId, variant: 'x-con-security-van' });
  pushLog(G, `Player ${playerID} may move a Villain to an empty City space (${cardRef}); if they do, they KO one of their Heroes.`, 'neutral', cardId);
}
