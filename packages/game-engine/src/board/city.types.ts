/**
 * City and HQ zone types for the Legendary Arena game engine.
 *
 * The City is a row of spaces (5 by default; 1-6 under a scheme that changes
 * the number of city spaces, WP-831 / D-24764) where revealed villains and
 * henchmen are placed. The HQ is a row of 5 hero slots for recruit-eligible
 * heroes and stays a fixed 5-tuple.
 *
 * No boardgame.io imports. No registry imports. Types and the City size bounds only.
 */

import type { CardExtId } from '../state/zones.types.js';

// ---------------------------------------------------------------------------
// City Zone
// ---------------------------------------------------------------------------

// why: WP-831 / D-24764 — the City is a variable-length array because a scheme can
// change the number of city spaces (Change the Outcome of WWII: 1 to 6; rules v23
// "Ego" / "Galactus": the HQ is unaffected). Its length is the match's current City
// size, CITY_MIN_SIZE..CITY_MAX_SIZE, checked at runtime by validateCityShape and the
// structural invariant (the fixed 5-tuple D-2602 relied on can no longer hold).

/** A single City space — occupied by a villain/henchman or empty. */
export type CitySpace = CardExtId | null;

/** The City size every match starts with (rules v23: "Each of the 5 city spaces"). */
export const CITY_DEFAULT_SIZE = 5;

/** The fewest city spaces a scheme can leave (Change the Outcome of WWII: Switzerland, 1). */
export const CITY_MIN_SIZE = 1;

/** The most city spaces a scheme can make (Change the Outcome of WWII: USSR, 6). */
export const CITY_MAX_SIZE = 6;

/**
 * The City zone: its ordered spaces, `CITY_DEFAULT_SIZE` unless a scheme resized it.
 *
 * Space 0 is the entry point (newly revealed villains enter here). The last
 * space (`length - 1`) is the escape edge (cards pushed past it escape the city).
 */
export type CityZone = CitySpace[];

// ---------------------------------------------------------------------------
// HQ Zone
// ---------------------------------------------------------------------------

// why: fixed 5-tuple enforces board layout at type level; same rationale
// as CityZone above.

/** A single HQ slot — occupied by a hero card or empty. */
export type HqSlot = CardExtId | null;

/**
 * The HQ zone: 5 ordered hero recruit slots.
 *
 * Slot 0 through slot 4 each hold a single hero card available for
 * recruitment. Empty slots are filled from the hero deck (WP-016).
 */
export type HqZone = [HqSlot, HqSlot, HqSlot, HqSlot, HqSlot];
