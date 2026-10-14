/**
 * Operator setter intents and options — Arena Client (WP-807 / EC-844 / D-24713).
 *
 * Pure helpers behind the operator Setters pane: six intent builders that
 * return WP-806's exact move name and args, the option lists the pane binds
 * ("Move a card" sources and destinations, deck card choices), and the two
 * presentation checks that enable its buttons.
 *
 * No Vue and no Tweakpane here. The pane only submits intent through
 * `submitMove`; the engine decides every setter (WP-806 refuses anything else
 * silently). Card labels are names only (`cardDisplay[id]?.name`, raw id as
 * fallback), never card text.
 */

import {
  BYSTANDER_EXT_ID,
  OPERATOR_SUPPLY_PILES,
  SHIELD_OFFICER_EXT_ID,
  SIDEKICK_EXT_ID,
  WOUND_EXT_ID,
} from '@legendary-arena/game-engine';
import type {
  OperatorAddEconomyArgs,
  OperatorDeckName,
  OperatorEconomyResource,
  OperatorEscapeVillainArgs,
  OperatorMoveCardArgs,
  OperatorMoveToDeckTopArgs,
  OperatorPlayerZoneName,
  OperatorRevealCardType,
  OperatorRevealNowArgs,
  OperatorSetSupplyCountArgs,
  OperatorSupplyPile,
  OperatorView,
  OperatorZoneRef,
} from '@legendary-arena/game-engine';

/** One setter submit: WP-806's move name with its typed args. */
export type OperatorSetterIntent =
  | { name: 'operatorSetSupplyCount'; args: OperatorSetSupplyCountArgs }
  | { name: 'operatorMoveToDeckTop'; args: OperatorMoveToDeckTopArgs }
  | { name: 'operatorRevealNow'; args: OperatorRevealNowArgs }
  | { name: 'operatorMoveCard'; args: OperatorMoveCardArgs }
  | { name: 'operatorAddEconomy'; args: OperatorAddEconomyArgs }
  | { name: 'operatorEscapeVillain'; args: OperatorEscapeVillainArgs };

// why: the lists are valued by a stable key, never a list index — after a poll the
// lists shift, and an index would silently move a different card. Two copies of
// one card in one zone share a key, which is harmless: the engine treats them alike.
/** A card the "Move a card" folder can move, valued by a stable key. */
export interface OperatorCardSource {
  key: string;
  cardId: string;
  from: OperatorZoneRef;
  label: string;
}

/** A place the "Move a card" folder can move a card to, valued by a stable key. */
export interface OperatorDestination {
  key: string;
  ref: OperatorZoneRef;
  label: string;
}

/** One option of a deck card list. */
export interface OperatorDeckCardOption {
  text: string;
  value: string;
}

// why: WP-806 does not export its PILE_LABEL (operatorSetters.logic.ts is not on
// the `.` surface); this mirrors its labels so the pane and the game log name a
// supply the same way.
/** The display label for each supply pile. */
export const PILE_LABEL: Readonly<Record<OperatorSupplyPile, string>> = {
  wounds: 'Wound',
  bystanders: 'Bystander',
  officers: 'S.H.I.E.L.D. Officer',
  sidekicks: 'Sidekick',
};

/** The fungible card id each supply pile holds, from the engine's `.` surface. */
const PILE_CARD_ID: Readonly<Record<OperatorSupplyPile, string>> = {
  wounds: WOUND_EXT_ID,
  bystanders: BYSTANDER_EXT_ID,
  officers: SHIELD_OFFICER_EXT_ID,
  sidekicks: SIDEKICK_EXT_ID,
};

// why: City index 4 is the escape edge — the space operatorEscapeVillain empties
// (WP-806 §Assumes).
/** The City space index a Villain escapes from. */
const CITY_ESCAPE_EDGE_INDEX = 4;

/**
 * Set a supply pile to a count.
 *
 * @param pile The supply pile.
 * @param count The new pile size.
 * @returns The `operatorSetSupplyCount` intent.
 */
export function buildSupplyCountIntent(pile: OperatorSupplyPile, count: number): OperatorSetterIntent {
  return { name: 'operatorSetSupplyCount', args: { pile, count } };
}

/**
 * Put a card on top of the villain or hero deck.
 *
 * @param deck The deck to reorder.
 * @param cardId The card to move to the top.
 * @returns The `operatorMoveToDeckTop` intent.
 */
export function buildDeckTopIntent(deck: OperatorDeckName, cardId: string): OperatorSetterIntent {
  return { name: 'operatorMoveToDeckTop', args: { deck, cardId } };
}

/**
 * Reveal a Scheme Twist or Master Strike from the villain deck now.
 *
 * @param cardType The villain-deck card type to reveal.
 * @returns The `operatorRevealNow` intent.
 */
export function buildRevealNowIntent(cardType: OperatorRevealCardType): OperatorSetterIntent {
  return { name: 'operatorRevealNow', args: { cardType } };
}

/**
 * Move one card from its source zone to a destination.
 *
 * @param source The chosen card and the zone it is in.
 * @param to The destination zone.
 * @returns The `operatorMoveCard` intent.
 */
export function buildMoveCardIntent(source: OperatorCardSource, to: OperatorZoneRef): OperatorSetterIntent {
  return { name: 'operatorMoveCard', args: { cardId: source.cardId, from: source.from, to } };
}

/**
 * Add Attack or Recruit to this turn.
 *
 * @param resource The turn resource.
 * @param amount How much to add.
 * @returns The `operatorAddEconomy` intent.
 */
export function buildEconomyIntent(resource: OperatorEconomyResource, amount: number): OperatorSetterIntent {
  return { name: 'operatorAddEconomy', args: { resource, amount } };
}

/**
 * Make the Villain at the City's escape edge escape.
 *
 * @returns The `operatorEscapeVillain` intent, with empty args.
 */
export function buildEscapeIntent(): OperatorSetterIntent {
  return { name: 'operatorEscapeVillain', args: {} };
}

/**
 * The display name of a card, or its raw id when the view has no entry.
 *
 * @param view The operator view.
 * @param cardId The card's ext id.
 * @returns The card name or the raw id.
 */
function cardName(view: OperatorView, cardId: string): string {
  return view.cardDisplay[cardId]?.name ?? cardId;
}

/** One seat zone the source list reads, with its label. */
interface SeatSourceZone {
  zone: OperatorPlayerZoneName;
  label: string;
  cardIds: readonly string[];
}

/**
 * A seat's five zones in source-list order.
 *
 * @param seat The seat's operator view.
 * @returns hand, deck (top first), discard pile, play area and Victory Pile.
 */
function seatSourceZones(seat: OperatorView['seats'][number]): SeatSourceZone[] {
  return [
    { zone: 'hand', label: 'hand', cardIds: seat.hand },
    { zone: 'deck', label: 'deck', cardIds: seat.deckTopFirst },
    { zone: 'discard', label: 'discard pile', cardIds: seat.discard },
    { zone: 'inPlay', label: 'play area', cardIds: seat.inPlay },
    { zone: 'victory', label: 'Victory Pile', cardIds: seat.victory },
  ];
}

/**
 * Every card "Move a card" can move: each seat's five zones in seat order, then
 * one entry per non-empty supply pile.
 *
 * @param view The operator view.
 * @returns The sources, each valued by a stable key.
 */
export function buildCardSources(view: OperatorView): OperatorCardSource[] {
  const sources: OperatorCardSource[] = [];
  for (const seat of view.seats) {
    for (const sourceZone of seatSourceZones(seat)) {
      for (const cardId of sourceZone.cardIds) {
        sources.push({
          key: `${seat.playerId}|${sourceZone.zone}|${cardId}`,
          cardId,
          from: { zone: sourceZone.zone, playerId: seat.playerId },
          label: `Player ${seat.playerId} · ${sourceZone.label} · ${cardName(view, cardId)}`,
        });
      }
    }
  }
  for (const pile of OPERATOR_SUPPLY_PILES) {
    if (view.supplyCounts[pile] > 0) {
      sources.push({
        key: `supply|${pile}`,
        cardId: PILE_CARD_ID[pile],
        from: { zone: 'supply', pile },
        label: `${PILE_LABEL[pile]} supply (top)`,
      });
    }
  }
  return sources;
}

/** A seat zone "Move a card" can move to, with its label. */
const DESTINATION_ZONES: readonly { zone: 'hand' | 'deck' | 'discard' | 'victory'; label: string }[] = [
  { zone: 'hand', label: 'hand' },
  { zone: 'deck', label: 'deck (top)' },
  { zone: 'discard', label: 'discard pile' },
  { zone: 'victory', label: 'Victory Pile' },
];

/**
 * Every destination "Move a card" offers: four zones per seat, then the KO pile.
 *
 * @param view The operator view.
 * @returns The destinations, each valued by a stable key.
 */
export function buildDestinations(view: OperatorView): OperatorDestination[] {
  const destinations: OperatorDestination[] = [];
  for (const seat of view.seats) {
    for (const destinationZone of DESTINATION_ZONES) {
      destinations.push({
        key: `${seat.playerId}|${destinationZone.zone}`,
        ref: { zone: destinationZone.zone, playerId: seat.playerId },
        label: `Player ${seat.playerId} · ${destinationZone.label}`,
      });
    }
  }
  destinations.push({ key: 'ko', ref: { zone: 'ko' }, label: 'KO pile' });
  return destinations;
}

/**
 * One option per distinct card of a deck, in first-seen order, labelled by the
 * card's first position from the top.
 *
 * @param cardIds The deck, top first.
 * @param view The operator view (for card names).
 * @returns `{ text: "<position>. <name>", value: cardId }` per distinct card.
 */
export function buildDeckCardOptions(cardIds: readonly string[], view: OperatorView): OperatorDeckCardOption[] {
  const options: OperatorDeckCardOption[] = [];
  const seenCardIds = new Set<string>();
  for (let i = 0; i < cardIds.length; i += 1) {
    const cardId = cardIds[i]!;
    if (seenCardIds.has(cardId)) {
      continue;
    }
    seenCardIds.add(cardId);
    options.push({ text: `${i + 1}. ${cardName(view, cardId)}`, value: cardId });
  }
  return options;
}

// why: presentation only — it saves silent no-op clicks. The engine re-checks the
// operator match, the turn, the stage and open choices on every setter (WP-806).
/**
 * Whether the setters can run now: the viewer's own turn, in the main stage.
 *
 * @param view The operator view.
 * @param playerId The viewer's seat id.
 * @returns True on the viewer's own turn in `main`.
 */
export function isSetterWindowOpen(view: OperatorView, playerId: string): boolean {
  return view.currentStage === 'main' && view.board.game.activePlayerId === playerId;
}

/**
 * Whether a Villain stands at the City's escape edge.
 *
 * @param view The operator view.
 * @returns True when City space index 4 holds a card.
 */
export function hasEscapeCandidate(view: OperatorView): boolean {
  const edgeCard = view.board.city.spaces[CITY_ESCAPE_EDGE_INDEX];
  return edgeCard !== null && edgeCard !== undefined;
}
