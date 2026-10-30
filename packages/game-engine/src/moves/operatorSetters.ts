/**
 * Operator setters for the Legendary Arena game engine (WP-806 / EC-843 / D-24713).
 *
 * Six operator-match-only moves that set up a board through the real paths:
 * - operatorSetSupplyCount: set a supply pile's count (the excess waits in G.operatorSetAside);
 * - operatorMoveToDeckTop: move a villain-deck or hero-deck card to its top;
 * - operatorRevealNow: put the next Scheme Twist or Master Strike on top and reveal it now;
 * - operatorMoveCard: move a card over the closed route table (gain, KO, between player zones, HQ);
 * - operatorAddEconomy: add Attack or Recruit for this turn;
 * - operatorEscapeVillain: the Villain in the escape-edge City space escapes.
 *
 * Every setter follows the move validation contract: (1) validate the untrusted
 * args, (2) the operator gate (canRunOperatorSetter), (3) state preconditions,
 * (4) mutate through helpers and write an "Operator:" log line. Any failure at 1–3
 * returns void with G untouched. Moves never throw.
 *
 * Not in getLegalMoves, the simulation or PAR dispatch, the determinism-only replay
 * or the fixture runner (D-24713 §7), so bots never make them.
 *
 * No registry imports. No .reduce().
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CityZone, HqZone } from '../board/city.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { recordOwnedCardKoed } from '../hero/deferredConditionalGrants.js';
import { discardFromHand } from './discardFromHand.js';
import { gainOfficerToDiscard } from './recruitOfficer.js';
import { gainWoundForPlayer } from '../board/wounds.logic.js';
import { addResources } from '../economy/economy.logic.js';
import { performVillainReveal, resolveVillainEscape } from '../villainDeck/villainDeck.reveal.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';
import { OPERATOR_ECONOMY_MAX_AMOUNT } from './operatorSetters.types.js';
import type { OperatorRevealCardType, OperatorSupplyPile } from './operatorSetters.types.js';
import {
  PILE_LABEL,
  canRunOperatorSetter,
  classifyOperatorRoute,
  describeOperatorZone,
  isObjectRecord,
  isOperatorSupplyPile,
  isPlayerZoneRef,
  readOperatorZoneRef,
  readSeatZones,
} from './operatorSetters.logic.js';
import type { OperatorMoveRoute, OperatorPlayerZoneRef } from './operatorSetters.logic.js';
import type { OperatorZoneRef } from './operatorSetters.types.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/** The outcome of an `operatorMoveCard` route. */
interface OperatorRouteResult {
  /** Whether the card moved. */
  readonly isMoved: boolean;
  /** The HQ card an R4 placement displaced to the hero-deck bottom, or null. */
  readonly displacedCardId: CardExtId | null;
}

const NOT_MOVED: OperatorRouteResult = { isMoved: false, displacedCardId: null };
const MOVED: OperatorRouteResult = { isMoved: true, displacedCardId: null };

/**
 * Moves the top `amount` cards of a supply pile, in order, to the end of its set-aside list.
 *
 * @param G - The game state, mutated in place.
 * @param pile - The supply pile.
 * @param amount - How many cards to set aside (≤ the pile's length).
 */
function setAsideSupplyCards(G: LegendaryGameState, pile: OperatorSupplyPile, amount: number): void {
  // why: pile[0] is the top card; slicing the pile follows the gainOfficerToDiscard
  // precedent (D-24713 §5 — no single-card zoneOps call fits a multi-card move).
  const moving = G.piles[pile].slice(0, amount);
  G.piles[pile] = G.piles[pile].slice(amount);
  if (G.operatorSetAside === undefined) {
    G.operatorSetAside = {};
  }
  G.operatorSetAside[pile] = [...(G.operatorSetAside[pile] ?? []), ...moving];
}

/**
 * Returns `amount` cards from the end of a pile's set-aside list, one at a time, to the top of the pile.
 *
 * @param G - The game state, mutated in place.
 * @param pile - The supply pile.
 * @param amount - How many cards to return (≤ the set-aside length).
 */
function returnSetAsideCards(G: LegendaryGameState, pile: OperatorSupplyPile, amount: number): void {
  if (G.operatorSetAside === undefined) {
    return;
  }
  const setAside = [...(G.operatorSetAside[pile] ?? [])];
  let supply = [...G.piles[pile]];
  // why: last set aside, first returned — each card goes back on top, so a decrease
  // followed by an equal increase restores the pile's original order.
  for (let i = 0; i < amount; i += 1) {
    const cardId = setAside.pop();
    if (cardId === undefined) {
      break;
    }
    supply = [cardId, ...supply];
  }
  G.piles[pile] = supply;
  G.operatorSetAside[pile] = setAside;
}

/**
 * Sets a supply pile to a count, moving the difference to or from the set-aside zone.
 *
 * @param context - boardgame.io move context with G, ctx, playerID.
 * @param args - Untrusted `{ pile, count }` (OperatorSetSupplyCountArgs).
 */
export function operatorSetSupplyCount({ G, ctx, playerID }: MoveContext, args: unknown): void {
  // Step 1: Validate args.
  // why: moves never throw, so the payload is read field by field, never destructured
  // in the parameter list — an undefined or null payload returns here.
  if (!isObjectRecord(args)) return;
  const pile = args.pile;
  const count = args.count;
  if (!isOperatorSupplyPile(pile)) return;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return;

  // Step 2: Operator gate.
  if (!canRunOperatorSetter(G, ctx.currentPlayer, playerID)) return;

  // Step 3: Preconditions — the count fits the pile plus its set-aside, and differs.
  const current = G.piles[pile].length;
  const setAsideLength = G.operatorSetAside?.[pile]?.length ?? 0;
  if (count > current + setAsideLength) return;
  if (count === current) return;

  // Step 4: Mutate and log.
  if (count < current) {
    setAsideSupplyCards(G, pile, current - count);
  } else {
    returnSetAsideCards(G, pile, count - current);
  }
  pushLog(G, `Operator: ${PILE_LABEL[pile]} supply set to ${count} (was ${current}).`);
}

/**
 * Moves a card already in the villain deck or the hero deck to that deck's top.
 *
 * @param context - boardgame.io move context with G, ctx, playerID.
 * @param args - Untrusted `{ deck, cardId }` (OperatorMoveToDeckTopArgs).
 */
export function operatorMoveToDeckTop({ G, ctx, playerID }: MoveContext, args: unknown): void {
  // Step 1: Validate args (never destructured — moves never throw).
  if (!isObjectRecord(args)) return;
  const deckName = args.deck;
  const cardId = args.cardId;
  if (deckName !== 'villain' && deckName !== 'hero') return;
  if (typeof cardId !== 'string') return;

  // Step 2: Operator gate.
  if (!canRunOperatorSetter(G, ctx.currentPlayer, playerID)) return;

  // Step 3: Preconditions — the card is in the deck and not already on top.
  const deck = deckName === 'villain' ? G.villainDeck.deck : G.heroDeck;
  if (deck[0] === cardId) return;
  const moveResult = moveCardFromZone(deck, [], cardId);
  if (!moveResult.found) return;

  // Step 4: Mutate and log.
  // why: prepend to the removal result, never the original deck, or the card would
  // appear twice (the putHandOnDeckTop remove-then-prepend idiom).
  const reordered = [cardId, ...moveResult.from];
  if (deckName === 'villain') {
    G.villainDeck.deck = reordered;
  } else {
    G.heroDeck = reordered;
  }
  const deckLabel = deckName === 'villain' ? 'Villain' : 'Hero';
  pushLog(G, `Operator: ${formatCardRef(G.cardDisplayData, cardId)} moved to the top of the ${deckLabel} Deck.`);
}

/**
 * Finds the first villain-deck card of a type, top first.
 *
 * @param G - The game state (not mutated).
 * @param cardType - The card type to find.
 * @returns The card id, or undefined when the deck holds none.
 */
function findFirstVillainDeckCard(G: LegendaryGameState, cardType: OperatorRevealCardType): CardExtId | undefined {
  // why: G.villainDeckCardTypes is the source of truth (scheme conversions rewrite it),
  // so ext-id prefixes are never used to classify.
  for (const cardId of G.villainDeck.deck) {
    if (G.villainDeckCardTypes[cardId] === cardType) {
      return cardId;
    }
  }
  return undefined;
}

/**
 * Moves the next Scheme Twist or Master Strike to the villain-deck top and reveals it now.
 *
 * @param context - boardgame.io move context with G, ctx, playerID, random.
 * @param args - Untrusted `{ cardType }` (OperatorRevealNowArgs).
 */
export function operatorRevealNow({ G, ctx, playerID, ...context }: MoveContext, args: unknown): void {
  // Step 1: Validate args (never destructured — moves never throw).
  if (!isObjectRecord(args)) return;
  const cardType = args.cardType;
  if (cardType !== 'scheme-twist' && cardType !== 'mastermind-strike') return;

  // Step 2: Operator gate.
  if (!canRunOperatorSetter(G, ctx.currentPlayer, playerID)) return;

  // Step 3: Preconditions — the villain deck holds a card of that type.
  const cardId = findFirstVillainDeckCard(G, cardType);
  if (cardId === undefined) return;
  const moveResult = moveCardFromZone(G.villainDeck.deck, [], cardId);
  if (!moveResult.found) return;

  // Step 4: Put it on top, log, then reveal through the normal path.
  G.villainDeck.deck = [cardId, ...moveResult.from];
  pushLog(G, `Operator: revealing ${formatCardRef(G.cardDisplayData, cardId)} now.`);
  // why: D-24713 §3 — the setter itself chooses no card by chance; the move's random
  // goes to the normal reveal path, which uses it exactly as in play. The once-per-turn
  // villainRevealedThisTurn allowance is left untouched (performVillainReveal never
  // reads it; only the revealVillainCard move wrapper does).
  performVillainReveal(
    G,
    { random: context.random, ctx: { currentPlayer: ctx.currentPlayer, turn: ctx.turn } },
    DEFAULT_IMPLEMENTATION_MAP,
  );
}

/**
 * R1 — gains the supply's top card into a player's zone through the gain helpers.
 *
 * @param G - The game state, mutated in place.
 * @param pile - The supply pile.
 * @param to - The destination player zone (already route-checked).
 * @param cardId - The card the payload names; must be the pile's top card.
 * @returns Whether the card moved.
 */
function gainFromSupply(G: LegendaryGameState, pile: OperatorSupplyPile, to: OperatorPlayerZoneRef, cardId: CardExtId): boolean {
  if (G.piles[pile][0] !== cardId) return false;
  // why: D-24713 §6 — the real gain paths: gainWoundForPlayer runs the Diving Block
  // interception, gainOfficerToDiscard is the Officer gain. Bystanders and Sidekicks
  // have no gain helper, so they move as plain zone moves and trigger nothing.
  if (pile === 'wounds') return gainWoundForPlayer(G, to.playerId) !== undefined;
  if (pile === 'officers') return gainOfficerToDiscard(G, to.playerId);
  const zones = readSeatZones(G, to);
  if (zones === undefined) return false;
  const moveResult = moveCardFromZone(G.piles[pile], zones[to.zone], cardId);
  if (!moveResult.found) return false;
  G.piles[pile] = moveResult.from;
  zones[to.zone] = moveResult.to;
  return true;
}

/**
 * R2 — KOs a card from a player's zone.
 *
 * @param G - The game state, mutated in place.
 * @param from - The source player zone.
 * @param cardId - The card to KO.
 * @returns Whether the card moved.
 */
function koFromPlayerZone(G: LegendaryGameState, from: OperatorPlayerZoneRef, cardId: CardExtId): boolean {
  const zones = readSeatZones(G, from);
  if (zones === undefined) return false;
  const moveResult = moveCardFromZone(zones[from.zone], G.ko, cardId);
  if (!moveResult.found) return false;
  zones[from.zone] = moveResult.from;
  G.ko = moveResult.to;
  // why: WP-853 / D-24789 — a KO from the seat's hand, deck, discard or play is a card
  // they own; a Victory Pile KO is not (RS-1).
  if (from.zone !== 'victory') {
    recordOwnedCardKoed(G, from.playerId, cardId);
  }
  return true;
}

/**
 * R3 — moves a card between player zones (any seats); a deck destination is its top.
 *
 * @param G - The game state, mutated in place.
 * @param from - The source player zone.
 * @param to - The destination player zone (never `inPlay`; already route-checked).
 * @param cardId - The card to move.
 * @returns Whether the card moved.
 */
function moveBetweenPlayerZones(G: LegendaryGameState, from: OperatorPlayerZoneRef, to: OperatorPlayerZoneRef, cardId: CardExtId): boolean {
  if (from.zone === to.zone && from.playerId === to.playerId) return false;
  if (from.zone === 'hand' && to.zone === 'discard') {
    // why: D-24713 §6 — same-seat hand → discard goes through the discardFromHand
    // chokepoint so return-on-discard / teleport-on-discard fire; a cross-seat one
    // has no rules meaning and is refused.
    if (from.playerId !== to.playerId) return false;
    return discardFromHand(G, from.playerId, cardId);
  }
  const sourceZones = readSeatZones(G, from);
  const destinationZones = readSeatZones(G, to);
  if (sourceZones === undefined || destinationZones === undefined) return false;
  if (to.zone === 'deck') {
    // why: moveCardFromZone appends (the deck bottom); a deck destination is its top,
    // so remove first, then prepend (putHandOnDeckTop.resolve.ts).
    const removal = moveCardFromZone(sourceZones[from.zone], [], cardId);
    if (!removal.found) return false;
    sourceZones[from.zone] = removal.from;
    destinationZones.deck = [cardId, ...destinationZones.deck];
    return true;
  }
  const moveResult = moveCardFromZone(sourceZones[from.zone], destinationZones[to.zone], cardId);
  if (!moveResult.found) return false;
  sourceZones[from.zone] = moveResult.from;
  destinationZones[to.zone] = moveResult.to;
  return true;
}

/**
 * R4 — places a hero-deck card in an HQ space; the displaced card goes to the hero-deck bottom.
 *
 * @param G - The game state, mutated in place.
 * @param hqIndex - The HQ space (0–4, already validated).
 * @param cardId - The hero-deck card to place.
 * @returns Whether the card moved, and the displaced card (or null).
 */
function placeHeroInHq(G: LegendaryGameState, hqIndex: number, cardId: CardExtId): OperatorRouteResult {
  const moveResult = moveCardFromZone(G.heroDeck, [], cardId);
  if (!moveResult.found) return NOT_MOVED;
  const displacedCardId = G.hq[hqIndex] ?? null;
  const hq: HqZone = [...G.hq];
  hq[hqIndex] = cardId;
  G.hq = hq;
  // why: D-24713 §4 — the displaced card goes to the bottom (end) of the Hero Deck,
  // where "put a Hero from the HQ on the bottom of the Hero Deck" cards send one
  // (resolveOptionalPutBottomHQ). The placed card fills the space, so nothing refills.
  // G.hqHaunters is untouched and stays aligned with the space (D-24587).
  G.heroDeck = displacedCardId === null ? moveResult.from : [...moveResult.from, displacedCardId];
  return { isMoved: true, displacedCardId };
}

/**
 * Runs one classified `operatorMoveCard` route.
 *
 * @param G - The game state, mutated in place when the route succeeds.
 * @param route - The classified route.
 * @param from - The typed source reference.
 * @param to - The typed destination reference.
 * @param cardId - The card to move.
 * @returns Whether the card moved, and any R4 displaced card.
 */
function runOperatorRoute(G: LegendaryGameState, route: OperatorMoveRoute, from: OperatorZoneRef, to: OperatorZoneRef, cardId: CardExtId): OperatorRouteResult {
  if (route === 'gain-from-supply' && from.zone === 'supply' && isPlayerZoneRef(to)) {
    return gainFromSupply(G, from.pile, to, cardId) ? MOVED : NOT_MOVED;
  }
  if (route === 'ko-from-player' && isPlayerZoneRef(from)) {
    return koFromPlayerZone(G, from, cardId) ? MOVED : NOT_MOVED;
  }
  if (route === 'between-player-zones' && isPlayerZoneRef(from) && isPlayerZoneRef(to)) {
    return moveBetweenPlayerZones(G, from, to, cardId) ? MOVED : NOT_MOVED;
  }
  if (route === 'hero-to-hq' && to.zone === 'hq') {
    return placeHeroInHq(G, to.hqIndex, cardId);
  }
  return NOT_MOVED;
}

/**
 * Moves a card already in the match from one zone to another over the closed route table.
 *
 * @param context - boardgame.io move context with G, ctx, playerID.
 * @param args - Untrusted `{ cardId, from, to }` (OperatorMoveCardArgs).
 */
export function operatorMoveCard({ G, ctx, playerID }: MoveContext, args: unknown): void {
  // Step 1: Validate args (never destructured — moves never throw). readOperatorZoneRef
  // null-checks each nested ref before reading it and Object.hasOwn-checks player ids.
  if (!isObjectRecord(args)) return;
  const cardId = args.cardId;
  if (typeof cardId !== 'string') return;
  const from = readOperatorZoneRef(G, args.from);
  const to = readOperatorZoneRef(G, args.to);
  if (from === null || to === null) return;
  const route = classifyOperatorRoute(from, to);
  if (route === null) return;

  // Step 2: Operator gate.
  if (!canRunOperatorSetter(G, ctx.currentPlayer, playerID)) return;

  // Steps 3–4: each route checks the card is in its source before it mutates.
  const result = runOperatorRoute(G, route, from, to, cardId);
  if (!result.isMoved) return;
  const cardRef = formatCardRef(G.cardDisplayData, cardId);
  let message = `Operator: ${cardRef} moved from ${describeOperatorZone(from, false)} to ${describeOperatorZone(to, true)}.`;
  if (result.displacedCardId !== null) {
    message += ` ${formatCardRef(G.cardDisplayData, result.displacedCardId)} went to the bottom of the Hero Deck.`;
  }
  pushLog(G, message);
}

/**
 * Adds Attack or Recruit to the current turn's economy.
 *
 * @param context - boardgame.io move context with G, ctx, playerID.
 * @param args - Untrusted `{ resource, amount }` (OperatorAddEconomyArgs).
 */
export function operatorAddEconomy({ G, ctx, playerID }: MoveContext, args: unknown): void {
  // Step 1: Validate args (never destructured — moves never throw).
  if (!isObjectRecord(args)) return;
  const resource = args.resource;
  const amount = args.amount;
  if (resource !== 'attack' && resource !== 'recruit') return;
  if (typeof amount !== 'number' || !Number.isInteger(amount)) return;
  if (amount < 1 || amount > OPERATOR_ECONOMY_MAX_AMOUNT) return;

  // Step 2: Operator gate.
  if (!canRunOperatorSetter(G, ctx.currentPlayer, playerID)) return;

  // Step 3: No state precondition. Step 4: Mutate and log.
  // why: D-24713 §2 — a turn counter only (never VP or score); turn start resets it.
  if (resource === 'attack') {
    G.turnEconomy = addResources(G.turnEconomy, amount, 0);
  } else {
    G.turnEconomy = addResources(G.turnEconomy, 0, amount);
  }
  const resourceLabel = resource === 'attack' ? 'Attack' : 'Recruit';
  pushLog(G, `Operator: +${amount} ${resourceLabel} this turn.`);
}

/**
 * The Villain in the escape-edge City space escapes through the normal escape path.
 *
 * @param context - boardgame.io move context with G, ctx, playerID, random.
 * @param args - Untrusted payload; any non-null object (its keys are ignored).
 */
export function operatorEscapeVillain({ G, ctx, playerID, ...context }: MoveContext, args: unknown): void {
  // Step 1: Validate args — any non-null object (never destructured — moves never throw).
  if (!isObjectRecord(args)) return;

  // Step 2: Operator gate.
  if (!canRunOperatorSetter(G, ctx.currentPlayer, playerID)) return;

  // Step 3: Preconditions — the escape-edge space holds a Villain.
  // why: the escape edge is the City's last space (pushVillainIntoCity ejects it when the City is
  // full); WP-831 / D-24764 — a scheme can resize the City, so it is read from the current size.
  const escapeEdgeIndex = G.city.length - 1;
  const cardId = G.city[escapeEdgeIndex];
  if (cardId === null || cardId === undefined) return;

  // Step 4: Log, clear the space, then escape through the normal path.
  pushLog(G, `Operator: ${formatCardRef(G.cardDisplayData, cardId)} escapes.`);
  // why: D-24713 §2 — resolveVillainEscape does not touch G.city (its callers clear the
  // space first), so the setter clears the escape-edge space before calling it.
  const city: CityZone = [...G.city];
  city[escapeEdgeIndex] = null;
  G.city = city;
  // why: D-24713 §3 — the move's random goes to the normal escape path, which uses it
  // exactly as in play; the setter itself chooses nothing by chance.
  resolveVillainEscape(
    G,
    { random: context.random, ctx: { currentPlayer: ctx.currentPlayer, turn: ctx.turn } },
    DEFAULT_IMPLEMENTATION_MAP,
    cardId,
  );
}
