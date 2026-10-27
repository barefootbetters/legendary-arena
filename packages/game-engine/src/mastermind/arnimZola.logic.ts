/**
 * Arnim Zola's shared "less than 2 printed Attack" reads (WP-821 / D-24754).
 *
 * Arnim Zola (ca75) keys his Master Strike and three of his four Tactics on Heroes
 * "that have less than 2 printed [icon:attack]". This module is the one home of
 * that predicate: the strike (rules/mastermindHandlers.ts), the tactics
 * (rules/tacticHandlers.ts) and the seat-choice builders and chain
 * (moves/seatChoiceTactics.ts, moves/seatChoice.resolve.ts) all read it here.
 *
 * Pure: reads G, never mutates it, never throws. No boardgame.io imports. No
 * registry imports. No .reduce(). It imports only printedHeroAttack and
 * WOUND_EXT_ID, so the pure seatChoiceTactics module can import it without a cycle.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { printedHeroAttack } from '../economy/abomination.logic.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';

/** Arnim Zola's mastermind id (`data/sweep-fixtures/mastermind-ids.full.json`). */
export const ARNIM_ZOLA_MASTERMIND_ID = 'ca75/arnim-zola';

// why: rules v23 L2301-2311 — "If you need to check a card for a value, and the card
// doesn't have that value, then it counts as 0." So a Hero with no Attack icon (and a
// card with no stats entry) reads 0 and is "less than 2"; a Hero printed `2+` reads 2
// and is not. Every Zola comparison uses this constant with a strict `<`.
export const ZOLA_PRINTED_ATTACK_LIMIT = 2;

/**
 * A single Crush Pacifist Resistance KO target: the zone the card sits in and its ext_id.
 *
 * // why: mirrors KoHeroTarget (villain/villainEffects.execute.ts:89) without importing
 * that large module into the pure seatChoiceTactics chain. Only the two "your Heroes"
 * zones apply (rules v23 L3439; D-24687).
 */
export interface ZolaKoTarget {
  zone: 'hand' | 'inPlay';
  cardId: CardExtId;
}

/**
 * Reports whether a card outside play has less than 2 printed Attack.
 *
 * @param G - Game state (read-only).
 * @param cardId - The card ext_id (an HQ slot or a hand card).
 * @returns true when the off-play printed Attack is below ZOLA_PRINTED_ATTACK_LIMIT.
 */
export function hasLessThanTwoPrintedAttack(G: LegendaryGameState, cardId: CardExtId): boolean {
  // why: printedHeroAttack is the off-play view (the `+` dropped, a Divided card's
  // halves summed, a missing entry read as 0), so this matches the printed card.
  return printedHeroAttack(G, cardId) < ZOLA_PRINTED_ATTACK_LIMIT;
}

/**
 * Lists the HQ slots whose Hero has less than 2 printed Attack, in ascending slot order.
 *
 * @param G - Game state (read-only).
 * @returns The qualifying HQ slot indices; `[]` when the HQ is missing or none qualify.
 */
export function listZolaWeakHqSlots(G: LegendaryGameState): number[] {
  const slots: number[] = [];
  const hq = G.hq;
  if (!hq) {
    return slots;
  }
  for (let slotIndex = 0; slotIndex < hq.length; slotIndex++) {
    const heroId = hq[slotIndex];
    if (heroId === null || heroId === undefined) {
      continue;
    }
    if (hasLessThanTwoPrintedAttack(G, heroId)) {
      slots.push(slotIndex);
    }
  }
  return slots;
}

/**
 * Lists a player's Heroes that Crush Pacifist Resistance may KO: the hand (in order),
 * then the cards played this turn (in order).
 *
 * @param G - Game state (read-only).
 * @param playerId - The player whose Heroes are scanned.
 * @returns The eligible targets; `[]` when the player has no zones.
 */
export function listCrushEligibleTargets(G: LegendaryGameState, playerId: string): ZolaKoTarget[] {
  const targets: ZolaKoTarget[] = [];
  const zones = G.playerZones[playerId];
  if (!zones) {
    return targets;
  }
  appendZoneKoTargets(G, 'hand', zones.hand, targets);
  appendZoneKoTargets(G, 'inPlay', zones.inPlay, targets);
  return targets;
}

/**
 * Appends one zone's eligible Crush targets to `targets`, skipping Wounds and
 * keeping the first copy of each ext_id in that zone.
 *
 * @param G - Game state (read-only).
 * @param zone - The zone being scanned.
 * @param cardIds - That zone's cards, in zone order.
 * @param targets - The target list to append to (mutated).
 */
function appendZoneKoTargets(
  G: LegendaryGameState,
  zone: ZolaKoTarget['zone'],
  cardIds: readonly CardExtId[],
  targets: ZolaKoTarget[],
): void {
  // why: S.H.I.E.L.D. starter ids repeat (`starting-shield-agent`), and KOing either
  // copy in one zone is outcome-identical, so one option per (zone, cardId). The same
  // id in the other zone stays its own option (the buildKoEligibleTargets rule).
  const seenCardIds = new Set<CardExtId>();
  for (const cardId of cardIds) {
    if (cardId === WOUND_EXT_ID || seenCardIds.has(cardId)) {
      continue;
    }
    seenCardIds.add(cardId);
    if (isCrushEligibleInZone(G, zone, cardId)) {
      targets.push({ zone, cardId });
    }
  }
}

/**
 * Reports whether a card in the given zone has less than 2 printed Attack.
 *
 * @param G - Game state (read-only).
 * @param zone - The zone the card sits in.
 * @param cardId - The card ext_id.
 * @returns true when the card qualifies for Crush Pacifist Resistance.
 */
function isCrushEligibleInZone(
  G: LegendaryGameState,
  zone: ZolaKoTarget['zone'],
  cardId: CardExtId,
): boolean {
  if (zone === 'hand') {
    return hasLessThanTwoPrintedAttack(G, cardId);
  }
  // why: a played card is the face being played (rules v23 L926), so its printed
  // Attack is that face's own cardStats entry, not the off-play sum of both halves.
  return (G.cardStats[cardId]?.attack ?? 0) < ZOLA_PRINTED_ATTACK_LIMIT;
}
