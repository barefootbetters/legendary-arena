/**
 * City and HQ zone helpers for the Legendary Arena game engine.
 *
 * pushVillainIntoCity implements the deterministic push logic for placing
 * revealed villains and henchmen into the City. initializeCity and
 * initializeHq create empty zones for game setup.
 *
 * All helpers are pure functions — no boardgame.io imports, no side effects,
 * no .reduce(). Inputs are never mutated.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { CityZone, HqZone } from './city.types.js';

// ---------------------------------------------------------------------------
// Push result
// ---------------------------------------------------------------------------

/**
 * Result of pushing a villain into the City.
 */
export interface PushVillainResult {
  /** The new City state after the push. */
  city: CityZone;
  /** The card that escaped (was in space 4), or null if space 4 was empty. */
  escapedCard: CardExtId | null;
}

// ---------------------------------------------------------------------------
// pushVillainIntoCity
// ---------------------------------------------------------------------------

/**
 * Pushes a villain or henchman card into City space 0.
 *
 * All existing cards shift rightward (toward the escape edge at space 4).
 * If space 4 was occupied, that card escapes and is returned as escapedCard.
 *
 * @param city - The current City zone (5-tuple). Not mutated.
 * @param cardId - The card to place at space 0.
 * @returns The new City state and the escaped card (or null).
 */
export function pushVillainIntoCity(
  city: CityZone,
  cardId: CardExtId,
): PushVillainResult {
  // Capture escape before shifting
  const escapedCard = city[4];

  // why: rightward = toward escape. Space 4 is the escape edge.
  // Explicit assignment — no .reduce(), no array methods.
  const newCity: CityZone = [
    cardId,   // space 0: newly revealed card enters here
    city[0],  // space 1: old space 0 shifts right
    city[1],  // space 2: old space 1 shifts right
    city[2],  // space 3: old space 2 shifts right
    city[3],  // space 4: old space 3 shifts right (old space 4 escaped above)
  ];

  return {
    city: newCity,
    escapedCard: escapedCard ?? null,
  };
}

// ---------------------------------------------------------------------------
// Initialization helpers
// ---------------------------------------------------------------------------

/**
 * Creates an empty City zone for game setup.
 *
 * @returns A 5-element tuple of nulls.
 */
export function initializeCity(): CityZone {
  return [null, null, null, null, null];
}

/**
 * Creates an empty HQ zone for game setup.
 *
 * @returns A 5-element tuple of nulls.
 */
export function initializeHq(): HqZone {
  // why: recruit slot population is WP-016 scope
  return [null, null, null, null, null];
}
