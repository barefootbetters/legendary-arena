/**
 * Type contracts for the villain deck subsystem.
 *
 * Defines RevealedCardType (the 5 canonical card classifications used by
 * the reveal pipeline), the REVEALED_CARD_TYPES canonical array (for
 * drift-detection testing), and VillainDeckState (the shape of
 * G.villainDeck).
 *
 * No boardgame.io imports. No registry imports. Types and constants only.
 */

import type { CardExtId } from '../state/zones.types.js';

// ---------------------------------------------------------------------------
// RevealedCardType
// ---------------------------------------------------------------------------

/**
 * The 5 canonical card type classifications for the villain deck.
 *
 * Each card in G.villainDeck.deck is mapped to one of these types in
 * G.villainDeckCardTypes. The reveal pipeline uses this classification
 * to determine which rule triggers to emit.
 *
 * Slugs use hyphens, not underscores — a mismatch silently prevents the
 * correct trigger from firing.
 */
export type RevealedCardType =
  | 'villain'
  | 'henchman'
  | 'bystander'
  | 'scheme-twist'
  | 'mastermind-strike';

/**
 * All RevealedCardType values in canonical order. Single source of truth.
 *
 * Used for drift-detection testing — if a type is added to the
 * RevealedCardType union, it must also appear in this array (and vice versa).
 */
export const REVEALED_CARD_TYPES: readonly RevealedCardType[] = [
  'villain',
  'henchman',
  'bystander',
  'scheme-twist',
  'mastermind-strike',
] as const;

// ---------------------------------------------------------------------------
// VillainDeckState
// ---------------------------------------------------------------------------

/**
 * The shape of the villain deck zone in G.
 *
 * deck: ordered stack of CardExtId strings to be revealed (top = index 0).
 * discard: cards that have been revealed and resolved.
 */
export interface VillainDeckState {
  /** Cards remaining to be revealed. Top of deck is deck[0]. */
  deck: CardExtId[];
  /** Cards that have been revealed and resolved. */
  discard: CardExtId[];
}

// ---------------------------------------------------------------------------
// Design note: G.villainDeckCardTypes
// ---------------------------------------------------------------------------

// why: classification stored at setup so moves never access registry at runtime.
// G.villainDeckCardTypes is Record<CardExtId, RevealedCardType> — a plain
// object mapping each card in the villain deck to its classification.
// buildVillainDeck (WP-014B) populates this at setup time from registry data.
// revealVillainCard reads it in O(1) without any registry access.
