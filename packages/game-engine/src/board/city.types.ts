/**
 * City and HQ zone types for the Legendary Arena game engine.
 *
 * The City is a row of 5 spaces where revealed villains and henchmen are
 * placed. The HQ is a row of 5 hero slots for recruit-eligible heroes.
 * Both use fixed 5-tuples to enforce the board layout at the type level.
 *
 * No boardgame.io imports. No registry imports. Types only.
 */

import type { CardExtId } from '../state/zones.types.js';

// ---------------------------------------------------------------------------
// City Zone
// ---------------------------------------------------------------------------

// why: fixed 5-tuple enforces board layout at type level; variable-length
// arrays would allow invalid states (e.g., 6-space city or 0-space city).

/** A single City space — occupied by a villain/henchman or empty. */
export type CitySpace = CardExtId | null;

/**
 * The City zone: 5 ordered spaces.
 *
 * Space 0 is the entry point (newly revealed villains enter here).
 * Space 4 is the escape edge (cards pushed past here escape the city).
 */
export type CityZone = [CitySpace, CitySpace, CitySpace, CitySpace, CitySpace];

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
