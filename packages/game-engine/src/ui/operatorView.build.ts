/**
 * Operator projection builder (WP-802 / EC-839 / D-24689).
 *
 * Builds the whole-board read an admin sees for an operator match: every seat's
 * five zones (deck in draw order), Wounds by zone, the villain deck, hero deck
 * and Mastermind tactics in order, the supply counts, the KO and escaped piles,
 * the engine's counters and the unfiltered `UIState`.
 *
 * Pure: no I/O, no randomness, no clock, no `boardgame.io` import, and `G` is
 * never mutated. Every array returned is a fresh copy, so a caller that mutates
 * the view cannot reach `G`.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId, PlayerZones } from '../state/zones.types.js';
import type { UICardDisplay } from './uiState.types.js';
import type {
  OperatorBuildContext,
  OperatorSeatView,
  OperatorSupplyCounts,
  OperatorView,
  OperatorWoundsByZone,
} from './operatorView.types.js';
import { buildUIState } from './uiState.build.js';
import { WOUND_EXT_ID } from '../setup/buildInitialGameState.js';

/**
 * Counts the Wound cards in one zone.
 *
 * @param zone - The zone's card ext_ids.
 * @returns How many of them are the Wound card.
 */
function countWoundsInZone(zone: readonly CardExtId[]): number {
  let woundCount = 0;
  for (const card of zone) {
    if (card === WOUND_EXT_ID) {
      woundCount += 1;
    }
  }
  return woundCount;
}

/**
 * Counts a seat's Wounds separately in each of its five zones.
 *
 * @param zones - The seat's card zones.
 * @returns The per-zone Wound counts.
 */
function countWoundsByZone(zones: PlayerZones): OperatorWoundsByZone {
  return {
    deck: countWoundsInZone(zones.deck),
    hand: countWoundsInZone(zones.hand),
    discard: countWoundsInZone(zones.discard),
    inPlay: countWoundsInZone(zones.inPlay),
    victory: countWoundsInZone(zones.victory),
  };
}

/**
 * Builds every seat's unredacted view, sorted ascending by player id.
 *
 * @param gameState - The operator match's state.
 * @returns One fresh-copied seat view per player.
 */
function buildSeatViews(gameState: LegendaryGameState): OperatorSeatView[] {
  // why: boardgame.io player ids are "0".."4", so a plain string sort is the
  // numeric seat order; sorting a copy keeps G's key order untouched.
  const playerIds = Object.keys(gameState.playerZones).sort();
  const seats: OperatorSeatView[] = [];
  for (const playerId of playerIds) {
    const zones = gameState.playerZones[playerId]!;
    seats.push({
      playerId,
      deckTopFirst: [...zones.deck],
      hand: [...zones.hand],
      discard: [...zones.discard],
      inPlay: [...zones.inPlay],
      victory: [...zones.victory],
      woundsByZone: countWoundsByZone(zones),
    });
  }
  return seats;
}

/**
 * Reads the remaining size of each shared supply pile.
 *
 * @param gameState - The operator match's state.
 * @returns The supply pile counts.
 */
function buildSupplyCounts(gameState: LegendaryGameState): OperatorSupplyCounts {
  return {
    wounds: gameState.piles.wounds.length,
    bystanders: gameState.piles.bystanders.length,
    officers: gameState.piles.officers.length,
    sidekicks: gameState.piles.sidekicks.length,
  };
}

/**
 * Counts the cards in each pile of the operator set-aside zone.
 *
 * @param setAside - The operator match's `G.operatorSetAside`.
 * @returns The per-pile count; a pile never set aside counts 0.
 */
function buildSetAsideCounts(setAside: NonNullable<LegendaryGameState['operatorSetAside']>): OperatorSupplyCounts {
  return {
    wounds: setAside.wounds?.length ?? 0,
    bystanders: setAside.bystanders?.length ?? 0,
    officers: setAside.officers?.length ?? 0,
    sidekicks: setAside.sidekicks?.length ?? 0,
  };
}

/**
 * Collects the display data for every card id that appears in the view. An id
 * with no `G.cardDisplayData` entry is left out.
 *
 * @param gameState - The operator match's state.
 * @param cardLists - Every card list the view returns.
 * @returns A fresh display record keyed by card ext_id.
 */
function collectCardDisplay(
  gameState: LegendaryGameState,
  cardLists: readonly (readonly CardExtId[])[],
): Record<CardExtId, UICardDisplay> {
  const cardDisplay: Record<CardExtId, UICardDisplay> = {};
  for (const cardList of cardLists) {
    for (const cardId of cardList) {
      const display = gameState.cardDisplayData[cardId];
      if (display !== undefined) {
        cardDisplay[cardId] = { ...display };
      }
    }
  }
  return cardDisplay;
}

/**
 * Lists every seat zone in the view, for the display-data collection.
 *
 * @param seats - The built seat views.
 * @returns The five zones of every seat.
 */
function listSeatZones(seats: readonly OperatorSeatView[]): (readonly CardExtId[])[] {
  const zones: (readonly CardExtId[])[] = [];
  for (const seat of seats) {
    zones.push(seat.deckTopFirst, seat.hand, seat.discard, seat.inPlay, seat.victory);
  }
  return zones;
}

/**
 * Builds the operator's whole-board read of an operator match.
 *
 * @param gameState - The match state.
 * @param context - The framework phase, turn and current player.
 * @returns The operator view, or `null` when the match is not an operator match.
 */
export function buildOperatorView(
  gameState: LegendaryGameState,
  context: OperatorBuildContext,
): OperatorView | null {
  // why: D-24689 §4 — the reveal-all projection exists only for an operator
  // match; any other match gets null and the server answers 409.
  if (gameState.isDebugMatch !== true) {
    return null;
  }
  const seats = buildSeatViews(gameState);
  const villainDeckTopFirst = [...gameState.villainDeck.deck];
  const heroDeckTopFirst = [...gameState.heroDeck];
  const mastermindTacticsTopFirst = [...gameState.mastermind.tacticsDeck];
  const koPile = [...gameState.ko];
  const escapedPile = [...gameState.escapedPile];
  const cardDisplay = collectCardDisplay(gameState, [
    ...listSeatZones(seats),
    villainDeckTopFirst,
    heroDeckTopFirst,
    mastermindTacticsTopFirst,
    koPile,
    escapedPile,
  ]);
  return {
    // why: D-24689 §4 — `board` is deliberately the UNFILTERED UIState (no
    // audience redaction): the admin sees every seat, and this view is served
    // only over the admin-session-required board route, never through playerView.
    board: buildUIState(gameState, context),
    currentStage: gameState.currentStage,
    seats,
    villainDeckTopFirst,
    heroDeckTopFirst,
    mastermindTacticsTopFirst,
    supplyCounts: buildSupplyCounts(gameState),
    // why: WP-806 / D-24713 §5 — a conditional spread inside the literal: the fields
    // are readonly and exactOptionalPropertyTypes forbids writing `undefined`, so the
    // key exists only when the set-aside zone does.
    ...(gameState.operatorSetAside !== undefined
      ? { setAsideCounts: buildSetAsideCounts(gameState.operatorSetAside) }
      : {}),
    koPile,
    escapedPile,
    counters: { ...gameState.counters },
    cardDisplay,
  };
}
