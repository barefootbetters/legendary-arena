/**
 * Brainwash the Military — S.H.I.E.L.D. Officers as Villains (WP-823 / D-24756).
 *
 * The scheme (ca75) prints:
 * - "Setup: 7 Twists. Add 12 S.H.I.E.L.D. Officers to the Villain Deck."
 * - "Special Rules: S.H.I.E.L.D. Officers in the Villain Deck are Villains. Their
 *   Attack is 3 plus the number of Twists stacked next to this Scheme. When you
 *   defeat a S.H.I.E.L.D. Officer, gain it as a Hero."
 * - "Twist 1-6: Stack this Twist next to the Scheme as a 'Traitor Battalion.' Play
 *   another card from the Villain Deck."
 * - "Twist 7: All S.H.I.E.L.D. Officers in the city escape."
 * - "Evil Wins: When 5 S.H.I.E.L.D. Officers escape."
 *
 * This module holds the pure pieces: the Officer instance ids and how many the
 * Villain Deck gets, the setup-time display copy, and the City scan Twist 7 reads.
 * The Officers are converted Villains (the Killbots overlay, D-24324): typed
 * 'villain' in G.villainDeckCardTypes and tagged 'shield-officer' in
 * G.convertedVillainOrigins. The twist resolver lives in schemeTwistResolvers.ts.
 *
 * No boardgame.io import. No registry import. No I/O. No .reduce().
 */

import type { ConvertedVillainOrigin, LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { UICardDisplay } from '../ui/uiState.types.js';
import { SHIELD_OFFICER_EXT_ID } from '../setup/pilesInit.js';
import { CITY_SPACE_NAMES } from '../board/citySpaceNames.js';

/** The Brainwash the Military scheme ext_id. */
export const BRAINWASH_THE_MILITARY_SCHEME_ID = 'ca75/brainwash-the-military';

/** The scheme prints "Add 12 S.H.I.E.L.D. Officers to the Villain Deck." */
export const BRAINWASHED_OFFICER_COUNT = 12;

/** An Officer's Attack before the Traitor Battalion ("3 plus the number of Twists"). */
export const BRAINWASHED_OFFICER_BASE_ATTACK = 3;

/** Twists 1-6 stack as the Traitor Battalion; the next Twist is Twist 7. */
export const TRAITOR_BATTALION_STACK_LIMIT = 6;

/** "Evil Wins: When 5 S.H.I.E.L.D. Officers escape." */
export const BRAINWASHED_OFFICER_ESCAPE_THRESHOLD = 5;

/**
 * Returns the instance ext_id of the index-th Officer in the Villain Deck.
 *
 * @param index - The zero-based Officer index (0-11).
 * @returns The ext_id, e.g. `shield-officer-villain-deck-00`.
 */
export function brainwashedOfficerExtId(index: number): CardExtId {
  // why: the `-villain-deck-NN` grammar matches the Bystander, henchman and twist
  // instances, so every Villain Deck instance id shares one form.
  return `shield-officer-villain-deck-${String(index).padStart(2, '0')}` as CardExtId;
}

/**
 * Returns how many Officers the scheme adds to the Villain Deck.
 *
 * @param schemeId - The selected scheme ext_id.
 * @param officersCount - The configured S.H.I.E.L.D. Officer Stack size.
 * @returns 12 (or the whole Stack when it is smaller) for this scheme, else 0.
 */
export function resolveBrainwashedOfficerCount(schemeId: string, officersCount: number): number {
  if (schemeId !== BRAINWASH_THE_MILITARY_SCHEME_ID) {
    return 0;
  }
  // why: the 12 Officers come from the S.H.I.E.L.D. Officer Stack, so the Villain
  // Deck never holds more than the configured Stack supplied.
  if (!Number.isFinite(officersCount) || officersCount < 0) {
    return 0;
  }
  return Math.min(BRAINWASHED_OFFICER_COUNT, officersCount);
}

/**
 * Counts the Officers in a converted-villain origin map.
 *
 * @param origins - The converted-villain overlay (setup-time or G's).
 * @returns The number of 'shield-officer' entries.
 */
export function countBrainwashedOfficers(
  origins: Readonly<Record<CardExtId, ConvertedVillainOrigin>>,
): number {
  let officerCount = 0;
  for (const cardId of Object.keys(origins)) {
    if (origins[cardId] === 'shield-officer') {
      officerCount = officerCount + 1;
    }
  }
  return officerCount;
}

/**
 * Gives every Officer in the Villain Deck the S.H.I.E.L.D. Officer display entry.
 *
 * // why: the City tile, the log and the escaped pile name a card through
 * G.cardDisplayData; without a copy an Officer would render as its raw ext_id.
 * Each id gets a fresh object (no aliasing) with its own extId. A no-op for every
 * scheme without Officers.
 *
 * @param cardDisplayData - The freshly built display data; mutated in place.
 * @param origins - The converted-villain overlay from buildVillainDeck.
 */
export function applyBrainwashedOfficerDisplay(
  cardDisplayData: Record<CardExtId, UICardDisplay>,
  origins: Readonly<Record<CardExtId, ConvertedVillainOrigin>>,
): void {
  const officerEntry = cardDisplayData[SHIELD_OFFICER_EXT_ID];
  if (officerEntry === undefined) {
    return;
  }
  for (const cardId of Object.keys(origins)) {
    if (origins[cardId] !== 'shield-officer') {
      continue;
    }
    cardDisplayData[cardId] = { ...officerEntry, extId: cardId };
  }
}

/**
 * Lists the City spaces holding an Officer, escape edge first.
 *
 * @param gameState - The current game state (read-only).
 * @returns City indices from the Bridge (4) down to the Sewers (0).
 */
export function listCityBrainwashedOfficers(gameState: LegendaryGameState): number[] {
  const origins = gameState.convertedVillainOrigins ?? {};
  const indices: number[] = [];
  // why: the card names no order; the Bridge-first scan is the order Villains
  // leave the City in.
  for (let cityIndex = CITY_SPACE_NAMES.length - 1; cityIndex >= 0; cityIndex--) {
    const cardId = gameState.city[cityIndex];
    if (cardId === null || cardId === undefined) {
      continue;
    }
    if (origins[cardId] === 'shield-officer') {
      indices.push(cityIndex);
    }
  }
  return indices;
}
