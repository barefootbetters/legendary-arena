/**
 * Size-Changing recruit-cost and effective-class helpers for the Legendary Arena game engine.
 *
 * Size-Changing is a recruit discount (D-24801, superseding D-24074's class grant):
 * - "Size-Changing [Class]" means "you can recruit this Hero for 2 less if you played any
 *   [Class] cards this turn" (rules v23 p.33). Each listed class is its own 2-less step, and
 *   the cost never drops below 0.
 * - "Microscopic Size-Changing [Class][Class][Class]" means "2 less for each matching card you
 *   played this turn, counting up to one per icon" (rules v23 p.30). It can reduce the cost
 *   to zero or below; a negative cost gives the recruiter that many Recruit points.
 * - The reduced cost applies only at the moment of recruiting (rules v23 p.33); every other
 *   cost read keeps the printed G.cardStats cost.
 * - The Villain / Mastermind side ("fight this Villain for 2 less", D-24802) shares
 *   applySizeChangingDiscount through economy.resolve.ts resolveFightPrice.
 *
 * This module is also the SINGLE effective-class source for played cards: a card in `inPlay`
 * counts as its printed `G.cardTraits[id].heroClass` / `heroClass2` PLUS any class Rogue's
 * Copy Powers copied on this play (`G.cardCopiedClasses[id]`, D-24730). A Size-Changing card
 * does NOT gain its listed classes.
 *
 * Pure: deterministic functions of G. No mutation, no caching, recomputed each call.
 * No boardgame.io imports. No registry imports. No .reduce().
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { playedCardIdsThisTurn } from './splitCard.logic.js';

// why: a frozen shared empty result so the common no-entry path allocates nothing and
// callers can iterate it safely without a null check.
const NO_CLASSES: readonly string[] = Object.freeze([]);

// why: D-24801 — rules v23 p.33 / p.30: every Size-Changing step is "2 less".
const SIZE_CHANGING_DISCOUNT_PER_STEP = 2;

/**
 * Returns the classes a card's printed Size-Changing line lists (its recruit-discount classes).
 *
 * @param G - Current game state (read-only).
 * @param cardId - The CardExtId to look up.
 * @returns The card's normalized Size-Changing classes, or an empty list when it has none.
 */
export function getSizeChangingClasses(
  G: LegendaryGameState,
  cardId: CardExtId,
): readonly string[] {
  const classesByCard = G.cardSizeChangingClasses;
  if (classesByCard === undefined) {
    return NO_CLASSES;
  }
  return classesByCard[cardId] ?? NO_CLASSES;
}

/**
 * Returns the icons of a card's printed Microscopic Size-Changing line, one entry per icon.
 *
 * @param G - Current game state (read-only).
 * @param cardId - The CardExtId to look up.
 * @returns The card's Microscopic icons (repeats kept), or an empty list when it has none.
 */
export function getMicroscopicSizeChangingClasses(
  G: LegendaryGameState,
  cardId: CardExtId,
): readonly string[] {
  const iconsByCard = G.cardMicroscopicSizeChangingClasses;
  if (iconsByCard === undefined) {
    return NO_CLASSES;
  }
  return iconsByCard[cardId] ?? NO_CLASSES;
}

/**
 * Returns whether a card has Size-Changing, counting Microscopic Size-Changing.
 *
 * // why: D-24801 — rules v23 p.30: "Microscopic Size-Changing is a type of Size-Changing, so
 * any effect that mentions Size-Changing works with Microscopic Size-Changing" (Antics, "has
 * Size-Changing" counts and reveals).
 *
 * @param G - Current game state (read-only).
 * @param cardId - The CardExtId to look up.
 * @returns Whether the card prints either Size-Changing form.
 */
export function hasSizeChanging(G: LegendaryGameState, cardId: CardExtId): boolean {
  return getSizeChangingClasses(G, cardId).length > 0 || getMicroscopicSizeChangingClasses(G, cardId).length > 0;
}

/**
 * Returns the Hero Classes Copy Powers copied onto a card for its current play.
 *
 * // why: D-24730 — kept apart from the Size-Changing maps so "is this card Size-Changing?"
 * reads never mistake a copy for Size-Changing, and so cleanup can drop the copy without
 * touching the setup maps.
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
    return NO_CLASSES;
  }
  return copiedByCard[cardId] ?? NO_CLASSES;
}

/**
 * Returns whether a played card counts as a given Hero Class.
 *
 * A card in `inPlay` has class `C` iff `C` is its printed `heroClass` / `heroClass2` OR Copy
 * Powers copied `C` on this play. Presence, not count.
 *
 * @param G - Current game state (read-only).
 * @param cardId - The CardExtId of the played card.
 * @param classSlug - The normalized Hero Class slug to test for.
 * @returns Whether the card counts as that class.
 */
// why: D-24801 — the single effective-class source; a Size-Changing card no longer gains its listed classes (D-24074's grant read the discount classes as a class, rules v23 p.33 says otherwise); cardTraits is never mutated
export function cardHasClassWhenPlayed(
  G: LegendaryGameState,
  cardId: CardExtId,
  classSlug: string,
): boolean {
  const traitEntry = G.cardTraits[cardId];
  // why: WP-703 / D-24523 — a card counts as EITHER printed class (hc or hc2).
  if (traitEntry !== undefined && (traitEntry.heroClass === classSlug || traitEntry.heroClass2 === classSlug)) {
    return true;
  }
  for (const copiedClass of getCopiedClasses(G, cardId)) {
    if (copiedClass === classSlug) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the cost a player pays to recruit a Hero right now, after Size-Changing.
 *
 * The printed G.cardStats cost, minus 2 for each Size-Changing class with a matching card the
 * player played this turn (floored at 0), minus 2 for each Microscopic icon matched by its own
 * played card. The Microscopic step may take the result below 0; a negative result is Recruit
 * the player gains by recruiting the card (rules v23 p.30).
 *
 * @param G - Current game state (read-only).
 * @param playerID - The recruiting player.
 * @param cardId - The HQ Hero being recruited.
 * @returns The recruit cost after Size-Changing; negative only through Microscopic Size-Changing.
 */
export function resolveRecruitCost(
  G: LegendaryGameState,
  playerID: string,
  cardId: CardExtId,
): number {
  const printedCost = G.cardStats[cardId]?.cost ?? 0;
  return applySizeChangingDiscount(
    G,
    playerID,
    printedCost,
    getSizeChangingClasses(G, cardId),
    getMicroscopicSizeChangingClasses(G, cardId),
  );
}

/**
 * Applies a Size-Changing discount to a cost, from the player's cards played this turn.
 *
 * The shared step for both sides of the keyword (D-24801 recruit, D-24802 fight): minus 2 for
 * each listed class with a matching card the player played this turn (floored at 0), then
 * minus 2 for each Microscopic icon matched by its own played card, which may go below 0.
 *
 * @param G - Current game state (read-only).
 * @param playerID - The recruiting or fighting player.
 * @param baseCost - The cost before Size-Changing.
 * @param sizeChangingClasses - The Size-Changing classes (one 2-less step each).
 * @param microscopicIcons - The Microscopic icons (one 2-less step per matched icon).
 * @returns The discounted cost; negative only through Microscopic Size-Changing.
 */
export function applySizeChangingDiscount(
  G: LegendaryGameState,
  playerID: string,
  baseCost: number,
  sizeChangingClasses: readonly string[],
  microscopicIcons: readonly string[],
): number {
  if (sizeChangingClasses.length === 0 && microscopicIcons.length === 0) {
    return baseCost;
  }
  const inPlay = G.playerZones[playerID]?.inPlay ?? [];
  const playedCardIds = playedCardIdsThisTurn(G, inPlay);
  let cost = baseCost;
  for (const classSlug of sizeChangingClasses) {
    if (anyPlayedCardHasClass(G, playedCardIds, classSlug)) {
      cost -= SIZE_CHANGING_DISCOUNT_PER_STEP;
    }
  }
  cost = Math.max(0, cost);
  cost -= SIZE_CHANGING_DISCOUNT_PER_STEP * countMatchedMicroscopicIcons(G, playedCardIds, microscopicIcons);
  return cost;
}

/**
 * Returns whether any played card counts as the given class.
 *
 * @param G - Current game state (read-only).
 * @param playedCardIds - The cards the player played this turn.
 * @param classSlug - The normalized Hero Class slug.
 * @returns Whether at least one played card has that class.
 */
function anyPlayedCardHasClass(
  G: LegendaryGameState,
  playedCardIds: readonly CardExtId[],
  classSlug: string,
): boolean {
  for (const playedCardId of playedCardIds) {
    if (G.cardTraits[playedCardId] !== undefined && cardHasClassWhenPlayed(G, playedCardId, classSlug)) {
      return true;
    }
  }
  return false;
}

/**
 * Counts how many Microscopic icons are matched, each played card matching at most one icon.
 *
 * // why: D-24801 — "2 less for each matching card you played this turn, counting up to" one
 * per icon (rules v23 p.30). Every printed line repeats one class, so a greedy first-free-icon
 * match is exact for the data; it stays one-card-one-icon for a mixed line too.
 *
 * @param G - Current game state (read-only).
 * @param playedCardIds - The cards the player played this turn.
 * @param icons - The card's Microscopic icons, one per printed icon.
 * @returns The number of matched icons (0 to icons.length).
 */
function countMatchedMicroscopicIcons(
  G: LegendaryGameState,
  playedCardIds: readonly CardExtId[],
  icons: readonly string[],
): number {
  const isIconMatched: boolean[] = icons.map(() => false);
  let matchedCount = 0;
  for (const playedCardId of playedCardIds) {
    if (G.cardTraits[playedCardId] === undefined) {
      continue;
    }
    for (let i = 0; i < icons.length; i++) {
      if (!isIconMatched[i] && cardHasClassWhenPlayed(G, playedCardId, icons[i]!)) {
        isIconMatched[i] = true;
        matchedCount += 1;
        break;
      }
    }
  }
  return matchedCount;
}
