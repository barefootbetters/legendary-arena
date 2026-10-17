/**
 * Operator setter intents and options — Arena Client (WP-807 / EC-844 / D-24713).
 *
 * Pure builders for the operator setter pane: each intent builder returns the
 * exact `{ name, args }` one of WP-806's six `operator*` moves takes, and each
 * option builder turns an `OperatorView` into the lists the pane binds.
 *
 * No Vue and no Tweakpane here. The pane only submits intent through the
 * prop-drilled `submitMove`; the engine re-checks every setter and refuses
 * anything outside its table silently (WP-806).
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
  OperatorSeatView,
  OperatorSetSupplyCountArgs,
  OperatorSupplyPile,
  OperatorView,
  OperatorZoneRef,
} from '@legendary-arena/game-engine';

/** One setter submit: a WP-806 move name with its exact args shape. */
export type OperatorSetterIntent =
  | { name: 'operatorSetSupplyCount'; args: OperatorSetSupplyCountArgs }
  | { name: 'operatorMoveToDeckTop'; args: OperatorMoveToDeckTopArgs }
  | { name: 'operatorRevealNow'; args: OperatorRevealNowArgs }
  | { name: 'operatorMoveCard'; args: OperatorMoveCardArgs }
  | { name: 'operatorAddEconomy'; args: OperatorAddEconomyArgs }
  | { name: 'operatorEscapeVillain'; args: OperatorEscapeVillainArgs };

/** A card the "Move a card" folder can pick up, valued by a stable key. */
export interface OperatorCardSource {
  key: string;
  cardId: string;
  from: OperatorZoneRef;
  label: string;
}

/** A destination the "Move a card" folder can send a card to, valued by a stable key. */
export interface OperatorDestination {
  key: string;
  ref: OperatorZoneRef;
  label: string;
}

/** One Tweakpane list option. */
export interface OperatorListOption {
  text: string;
  value: string;
}

// why: WP-806 doesn't export its PILE_LABEL (it lives in the engine's
// operatorSetters.logic.ts, off the `.` surface); this mirrors those labels so
// the pane reads the same words as the "Operator:" log line.
/** The display label of each supply pile. */
export const PILE_LABEL: Readonly<Record<OperatorSupplyPile, string>> = {
  wounds: 'Wound',
  bystanders: 'Bystander',
  officers: 'S.H.I.E.L.D. Officer',
  sidekicks: 'Sidekick',
};

/** The fungible card id each supply pile hands out, from the engine. */
const PILE_CARD_ID: Readonly<Record<OperatorSupplyPile, string>> = {
  wounds: WOUND_EXT_ID,
  bystanders: BYSTANDER_EXT_ID,
  officers: SHIELD_OFFICER_EXT_ID,
  sidekicks: SIDEKICK_EXT_ID,
};

/** The source-list label of each player zone. */
const SOURCE_ZONE_LABEL: Readonly<Record<OperatorPlayerZoneName, string>> = {
  hand: 'hand',
  deck: 'deck',
  discard: 'discard pile',
  inPlay: 'play area',
  victory: 'Victory Pile',
};

/** The player zones a destination may name, in list order (WP-806 refuses `inPlay`). */
const DESTINATION_ZONES: readonly OperatorPlayerZoneName[] = ['hand', 'deck', 'discard', 'victory'];

/** The destination-list label of each destination zone. */
const DESTINATION_ZONE_LABEL: Readonly<Record<OperatorPlayerZoneName, string>> = {
  hand: 'hand',
  deck: 'deck (top)',
  discard: 'discard pile',
  inPlay: 'play area',
  victory: 'Victory Pile',
};

/**
 * Snap a number-field value to a whole number inside its range.
 *
 * // why: a Tweakpane number field can hold NaN — a click on a min/max slider whose
 * track measures 0 px wide maps 0/0, and the text field evaluates expressions such as
 * "0/0". The engine refuses a non-integer silently (WP-806), so the setter looked
 * broken with "NaN" in the field (live operator match cDfRs-e8CqM). Anything not
 * finite falls back to `min`; anything else is rounded and clamped.
 *
 * @param value The field's current value.
 * @param min The smallest allowed value.
 * @param max The largest allowed value (Infinity for none).
 * @returns A whole number in [min, max].
 */
export function toWholeNumberInRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(Math.round(value), min), max);
}

/**
 * Build the intent that sets a supply pile to a count.
 *
 * @param pile The supply pile.
 * @param count The new count.
 * @returns The `operatorSetSupplyCount` intent.
 */
export function buildSupplyCountIntent(pile: OperatorSupplyPile, count: number): OperatorSetterIntent {
  return { name: 'operatorSetSupplyCount', args: { pile, count } };
}

/**
 * Build the intent that moves a deck card to the top of its deck.
 *
 * @param deck The villain or hero deck.
 * @param cardId The card to move.
 * @returns The `operatorMoveToDeckTop` intent.
 */
export function buildDeckTopIntent(deck: OperatorDeckName, cardId: string): OperatorSetterIntent {
  return { name: 'operatorMoveToDeckTop', args: { deck, cardId } };
}

/**
 * Build the intent that reveals a Scheme Twist or Master Strike now.
 *
 * @param cardType The villain-deck card type to reveal.
 * @returns The `operatorRevealNow` intent.
 */
export function buildRevealNowIntent(cardType: OperatorRevealCardType): OperatorSetterIntent {
  return { name: 'operatorRevealNow', args: { cardType } };
}

/**
 * Build the intent that moves one card from a source to a destination.
 *
 * @param source The chosen source entry.
 * @param to The destination zone reference.
 * @returns The `operatorMoveCard` intent.
 */
export function buildMoveCardIntent(source: OperatorCardSource, to: OperatorZoneRef): OperatorSetterIntent {
  return { name: 'operatorMoveCard', args: { cardId: source.cardId, from: source.from, to } };
}

/**
 * Build the intent that adds Attack or Recruit to this turn.
 *
 * @param resource Attack or Recruit.
 * @param amount How much to add.
 * @returns The `operatorAddEconomy` intent.
 */
export function buildEconomyIntent(resource: OperatorEconomyResource, amount: number): OperatorSetterIntent {
  return { name: 'operatorAddEconomy', args: { resource, amount } };
}

/**
 * Build the intent that makes the Villain at the City's escape edge escape.
 *
 * @returns The `operatorEscapeVillain` intent.
 */
export function buildEscapeIntent(): OperatorSetterIntent {
  return { name: 'operatorEscapeVillain', args: {} };
}

// why: the viewer's own seat is marked so a "Move a card" pick can't land in the
// bot's hand by mistake (live operator match dmV240-Qb8j, 7.2.5). Other seats keep
// their plain number: the client has no per-seat bot flag, and an operator match
// may leave an open human seat, so it never guesses "Bot Ally".
/**
 * The seat label for the setter lists: "You (Player N)" for the viewer, else "Player N".
 *
 * @param seatPlayerId The seat being labelled.
 * @param viewerPlayerId The viewer's own seat.
 * @returns The seat label.
 */
export function seatLabel(seatPlayerId: string, viewerPlayerId: string): string {
  if (seatPlayerId === viewerPlayerId) {
    return `You (Player ${seatPlayerId})`;
  }
  return `Player ${seatPlayerId}`;
}

/**
 * The display name of a card, or its raw id when the view has no entry.
 *
 * @param cardId The card's ext id.
 * @param view The operator view.
 * @returns The card name or the raw id.
 */
function cardName(cardId: string, view: OperatorView): string {
  return view.cardDisplay[cardId]?.name ?? cardId;
}

/**
 * The cards of one seat zone as source entries, in stored order.
 *
 * @param seat The seat.
 * @param zone The zone name.
 * @param cardIds The zone's cards.
 * @param view The operator view, for card names.
 * @param viewerPlayerId The viewer's own seat, for the seat label.
 * @returns One source entry per card.
 */
function buildSeatZoneSources(
  seat: OperatorSeatView,
  zone: OperatorPlayerZoneName,
  cardIds: readonly string[],
  view: OperatorView,
  viewerPlayerId: string,
): OperatorCardSource[] {
  const sources: OperatorCardSource[] = [];
  for (const cardId of cardIds) {
    sources.push({
      // why: a stable key, never a list index — the lists shift after every
      // poll, and an index would silently point "Move card" at another card.
      key: `${seat.playerId}|${zone}|${cardId}`,
      cardId,
      from: { zone, playerId: seat.playerId },
      label: `${seatLabel(seat.playerId, viewerPlayerId)} · ${SOURCE_ZONE_LABEL[zone]} · ${cardName(cardId, view)}`,
    });
  }
  return sources;
}

/**
 * Every card the "Move a card" folder can pick up: each seat's five zones in
 * order, then the top of each non-empty supply.
 *
 * @param view The operator view.
 * @param viewerPlayerId The viewer's own seat, for the seat label.
 * @returns The source entries, in list order.
 */
export function buildCardSources(view: OperatorView, viewerPlayerId: string): OperatorCardSource[] {
  const sources: OperatorCardSource[] = [];
  for (const seat of view.seats) {
    sources.push(...buildSeatZoneSources(seat, 'hand', seat.hand, view, viewerPlayerId));
    sources.push(...buildSeatZoneSources(seat, 'deck', seat.deckTopFirst, view, viewerPlayerId));
    sources.push(...buildSeatZoneSources(seat, 'discard', seat.discard, view, viewerPlayerId));
    sources.push(...buildSeatZoneSources(seat, 'inPlay', seat.inPlay, view, viewerPlayerId));
    sources.push(...buildSeatZoneSources(seat, 'victory', seat.victory, view, viewerPlayerId));
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

/**
 * Every destination the "Move a card" folder can send a card to: four zones
 * per seat, then the KO pile.
 *
 * @param view The operator view.
 * @param viewerPlayerId The viewer's own seat, for the seat label.
 * @returns The destination entries, in list order.
 */
export function buildDestinations(view: OperatorView, viewerPlayerId: string): OperatorDestination[] {
  const destinations: OperatorDestination[] = [];
  for (const seat of view.seats) {
    for (const zone of DESTINATION_ZONES) {
      destinations.push({
        key: `${seat.playerId}|${zone}`,
        ref: { zone, playerId: seat.playerId },
        label: `${seatLabel(seat.playerId, viewerPlayerId)} · ${DESTINATION_ZONE_LABEL[zone]}`,
      });
    }
  }
  destinations.push({ key: 'ko', ref: { zone: 'ko' }, label: 'KO pile' });
  return destinations;
}

/**
 * A deck's distinct cards as list options, labelled by their first position.
 *
 * @param cardIds The deck, top first.
 * @param view The operator view, for card names.
 * @returns One option per distinct id, in first-seen order.
 */
export function buildDeckCardOptions(cardIds: readonly string[], view: OperatorView): OperatorListOption[] {
  const options: OperatorListOption[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < cardIds.length; i += 1) {
    const cardId = cardIds[i]!;
    if (seenIds.has(cardId)) {
      continue;
    }
    seenIds.add(cardId);
    options.push({ text: `${i + 1}. ${cardName(cardId, view)}`, value: cardId });
  }
  return options;
}

// why: the enable rule is presentation only — it saves silent no-op clicks. The
// engine re-checks the operator match, the turn, the stage and any open choice
// on every setter (WP-806) and refuses the rest.
/**
 * Whether the setters can run now: the viewer's own turn, in the `main` stage.
 *
 * @param view The operator view.
 * @param playerId The viewer's seat.
 * @returns True on the viewer's own turn in `main`.
 */
export function isSetterWindowOpen(view: OperatorView, playerId: string): boolean {
  return view.currentStage === 'main' && view.board.game.activePlayerId === playerId;
}

/**
 * Whether a Villain stands at the City's escape edge (space index 4).
 *
 * @param view The operator view.
 * @returns True when City space 4 holds a card.
 */
export function hasEscapeCandidate(view: OperatorView): boolean {
  return view.board.city.spaces[4] != null;
}
