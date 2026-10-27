/**
 * Size-Changing effective-class helper for the Legendary Arena game engine.
 *
 * Size-Changing is a printed Hero mechanic — "When you play this card, it has the
 * [Class] class." (rulebook keyword `sizechanging`, pdfPage 33). The grant is realized
 * here at class-read time: a card in `inPlay` counts as each of its *effective* classes —
 * its printed `G.cardTraits[id].heroClass` PLUS any class in `G.cardSizeChangingClasses[id]`
 * PLUS any class Rogue's Copy Powers copied on this play (`G.cardCopiedClasses[id]`, D-24730).
 *
 * This module is the SINGLE effective-class source. Both class-matching reads in
 * heroConditions.evaluate.ts (`heroClassMatch`, `distinctHeroClassesAtLeast`) derive class
 * membership from these functions; neither re-implements printed-vs-granted matching.
 *
 * Pure: deterministic functions of exactly `G.cardTraits[id].heroClass`,
 * `G.cardSizeChangingClasses[id]` and `G.cardCopiedClasses[id]`. No mutation, no caching/memoization, recomputed each call.
 * `G.cardTraits` is never written — the grant is an additive second class source.
 *
 * No boardgame.io imports. No registry imports. No .reduce().
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

// why: D-24074 — a frozen shared empty result so the no-grant path (the common case)
// allocates nothing and callers can iterate it safely without a null check.
const NO_GRANTED_CLASSES: readonly string[] = Object.freeze([]);

/**
 * Returns the Hero Classes a card gains when played (its Size-Changing grant).
 *
 * @param G - Current game state (read-only).
 * @param cardId - The CardExtId to look up.
 * @returns The card's normalized granted-class list, or an empty list when it grants none.
 */
export function getGrantedClasses(
  G: LegendaryGameState,
  cardId: CardExtId,
): readonly string[] {
  const grantedByCard = G.cardSizeChangingClasses;
  if (grantedByCard === undefined) {
    return NO_GRANTED_CLASSES;
  }
  const granted = grantedByCard[cardId];
  if (granted === undefined) {
    return NO_GRANTED_CLASSES;
  }
  return granted;
}

/**
 * Returns the Hero Classes Copy Powers copied onto a card for its current play.
 *
 * // why: D-24730 — kept apart from getGrantedClasses so the "is this card
 * Size-Changing?" reads (cheapOrSizeChangingAtLeast) never mistake a copy for
 * Size-Changing, and so cleanup can drop the copy without touching the setup grants.
 *
 * @param G - Current game state (read-only).
 * @param cardId - The CardExtId to look up.
 * @returns The card's copied-class list this turn, or an empty list when it has none.
 */
export function getCopiedClasses(
  G: LegendaryGameState,
  cardId: CardExtId,
): readonly string[] {
  const copiedByCard = G.cardCopiedClasses;
  if (copiedByCard === undefined) {
    return NO_GRANTED_CLASSES;
  }
  const copied = copiedByCard[cardId];
  if (copied === undefined) {
    return NO_GRANTED_CLASSES;
  }
  return copied;
}

/**
 * Returns whether a played card counts as a given Hero Class.
 *
 * A card in `inPlay` has class `C` iff `C` is its printed `heroClass` OR `C` is in its
 * Size-Changing granted list OR Copy Powers copied `C` on this play. Presence, not
 * count: a card whose printed class equals a granted class still simply "has" that class.
 *
 * @param G - Current game state (read-only).
 * @param cardId - The CardExtId of the played card.
 * @param classSlug - The normalized Hero Class slug to test for.
 * @returns Whether the card counts as that class.
 */
// why: D-24074 — Size-Changing grants the listed class on play; a card in inPlay has class C iff printed heroClass OR granted (cardSizeChangingClasses) OR copied this play (cardCopiedClasses, D-24730). The single effective-class source; cardTraits is never mutated
export function cardHasClassWhenPlayed(
  G: LegendaryGameState,
  cardId: CardExtId,
  classSlug: string,
): boolean {
  const traitEntry = G.cardTraits[cardId];
  // why: WP-703 / D-24523 — a card counts as EITHER printed class (hc or hc2)
  // in addition to any Size-Changing granted class (D-24074, below).
  if (traitEntry !== undefined && (traitEntry.heroClass === classSlug || traitEntry.heroClass2 === classSlug)) {
    return true;
  }
  for (const grantedClass of getGrantedClasses(G, cardId)) {
    if (grantedClass === classSlug) {
      return true;
    }
  }
  for (const copiedClass of getCopiedClasses(G, cardId)) {
    if (copiedClass === classSlug) {
      return true;
    }
  }
  return false;
}
