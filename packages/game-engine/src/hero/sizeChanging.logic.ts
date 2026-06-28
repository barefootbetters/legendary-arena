/**
 * Size-Changing effective-class helper for the Legendary Arena game engine.
 *
 * Size-Changing is a printed Hero mechanic — "When you play this card, it has the
 * [Class] class." (rulebook keyword `sizechanging`, pdfPage 33). The grant is realized
 * here at class-read time: a card in `inPlay` counts as each of its *effective* classes —
 * its printed `G.cardTraits[id].heroClass` PLUS any class in `G.cardSizeChangingClasses[id]`.
 *
 * This module is the SINGLE effective-class source. Both class-matching reads in
 * heroConditions.evaluate.ts (`heroClassMatch`, `distinctHeroClassesAtLeast`) derive class
 * membership from these functions; neither re-implements printed-vs-granted matching.
 *
 * Pure: deterministic functions of exactly `G.cardTraits[id].heroClass` and
 * `G.cardSizeChangingClasses[id]`. No mutation, no caching/memoization, recomputed each call.
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
 * Returns whether a played card counts as a given Hero Class.
 *
 * A card in `inPlay` has class `C` iff `C` is its printed `heroClass` OR `C` is in its
 * Size-Changing granted list. Presence, not count: a card whose printed class equals a
 * granted class still simply "has" that class.
 *
 * @param G - Current game state (read-only).
 * @param cardId - The CardExtId of the played card.
 * @param classSlug - The normalized Hero Class slug to test for.
 * @returns Whether the card counts as that class.
 */
// why: D-24074 — Size-Changing grants the listed class on play; a card in inPlay has class C iff printed heroClass OR granted (cardSizeChangingClasses). The single effective-class source; cardTraits is never mutated
export function cardHasClassWhenPlayed(
  G: LegendaryGameState,
  cardId: CardExtId,
  classSlug: string,
): boolean {
  const traitEntry = G.cardTraits[cardId];
  if (traitEntry !== undefined && traitEntry.heroClass === classSlug) {
    return true;
  }
  for (const grantedClass of getGrantedClasses(G, cardId)) {
    if (grantedClass === classSlug) {
      return true;
    }
  }
  return false;
}
