/**
 * Card-text dynamic victory-point modifiers for the Legendary Arena game engine.
 *
 * Some villain cards print a victory-point worth that depends on the end-of-game
 * board rather than a fixed printed number. Two such cards live here:
 * - Supreme HYDRA: "worth +3 VP for each other HYDRA Villain in your Victory Pile."
 * - Ultron: "worth +1 VP for each tech Hero you have among all your cards at the
 *   end of the game."
 *
 * The two differ in scope: Supreme HYDRA counts villains in the victory pile only,
 * while Ultron counts tech Heroes across ALL the player's cards (every zone). So
 * the resolver takes both the victory pile and the player's full card list plus the
 * card-trait snapshot. Pure — no `G` mutation, no engine randomness, no I/O. No
 * boardgame.io imports. Ultron is the second dynamic-VP card, so the multi-card
 * resolver shape is now earned (duplicate-first per `.claude/rules/code-style.md`
 * §Abstraction).
 */

import type { CardExtId } from '../state/zones.types.js';

/** Supreme HYDRA's base victory-point worth before the per-HYDRA bonus. */
export const SUPREME_HYDRA_BASE_VP = 3;

/** Bonus victory points Supreme HYDRA gains for each OTHER HYDRA Villain in the pile. */
export const SUPREME_HYDRA_BONUS_PER_OTHER_HYDRA_VILLAIN = 3;

/** Ultron's base victory-point worth before the per-tech-Hero bonus. */
export const ULTRON_BASE_VP = 2;

/** Bonus victory points Ultron gains for each `[hc:tech]` Hero among all the player's cards. */
export const ULTRON_BONUS_PER_TECH_HERO = 1;

/**
 * Counts the `[hc:tech]` Hero cards among a list of the player's card ext_ids.
 *
 * Pure — reads only the `cardTraits` setup snapshot. Only Hero cards carry a
 * `heroClass`; non-hero cards (starting S.H.I.E.L.D. cards, wounds, villains,
 * henchmen, bystanders) are `null`/absent in `cardTraits` and are not counted.
 *
 * @param cardIds - The player's card ext_ids (any/all zones).
 * @param cardTraits - The setup card-trait snapshot (`heroClass` / `team` per card).
 * @returns The number of ext_ids whose `heroClass` is `'tech'`.
 */
export function countTechHeroesAmongCards(
  cardIds: readonly CardExtId[],
  cardTraits: Record<CardExtId, { heroClass: string | null; team: string | null }>,
): number {
  let techHeroCount = 0;
  for (const cardId of cardIds) {
    // why: only Hero cards carry a heroClass; non-hero cards are null/absent and
    // are not counted. Optional-chain so an absent entry reads as undefined, not a throw.
    if (cardTraits[cardId]?.heroClass === 'tech') {
      techHeroCount++;
    }
  }
  return techHeroCount;
}

/**
 * Reports whether a victory-pile ext_id belongs to a HYDRA-group Villain.
 *
 * Villain instance ext_ids are `{setAbbr}-villain-{groupSlug}-{cardSlug}-{copy}`
 * (`villainCardInstanceExtIds`), so HYDRA-group membership is decided by the
 * `-villain-hydra-` segment. The `-villain-` segment already excludes henchmen
 * and bystanders, so no separate card-type lookup is needed.
 *
 * @param extId - A card ext_id from a player's victory pile.
 * @returns true iff the ext_id is a HYDRA-group Villain instance.
 */
export function isHydraGroupVillain(extId: CardExtId): boolean {
  return extId.includes('-villain-hydra-');
}

/**
 * Returns a villain card's full dynamic VP when it is a known card-text
 * VP-modifier villain, or null when the card has no dynamic rule (the caller
 * then uses the printed-VP / fallback path).
 *
 * Pure — reads only the ext_id strings and the `cardTraits` snapshot; no `G`
 * mutation, no `ctx`.
 *
 * @param cardId - The victory-pile card being scored.
 * @param victoryPile - The scoring player's full victory pile (ext_id strings).
 * @param allPlayerCardIds - Every card the scoring player owns across all zones
 *   (deck + hand + discard + inPlay + victory).
 * @param cardTraits - The setup card-trait snapshot (`heroClass` / `team` per card).
 * @returns The card's dynamic VP, or null when it carries no dynamic rule.
 */
export function computeDynamicVillainVictoryPoints(
  cardId: CardExtId,
  victoryPile: readonly CardExtId[],
  allPlayerCardIds: readonly CardExtId[],
  cardTraits: Record<CardExtId, { heroClass: string | null; team: string | null }>,
): number | null {
  // why: `[icon:piercing]` renders Victory Points in this card data (corroborated
  // across the corpus: Ultron, amwp, 3dtc). Supreme HYDRA is the FIRST card-text VP
  // modifier — the `scoring.types.ts` "future packet" note, delivered per D-24355.
  if (cardId.includes('-villain-hydra-supreme-hydra-')) {
    // why: "other HYDRA Villain" excludes this Supreme HYDRA instance itself, which
    // is a HYDRA Villain counted in its own victory pile; subtract 1. Clamp negatives
    // to 0 defensively — this card is always in its own pile when scored, so the raw
    // count is at least 1 in practice.
    const otherHydraVillainCount = Math.max(
      0,
      victoryPile.filter(isHydraGroupVillain).length - 1,
    );
    return (
      SUPREME_HYDRA_BASE_VP +
      SUPREME_HYDRA_BONUS_PER_OTHER_HYDRA_VILLAIN * otherHydraVillainCount
    );
  }

  if (cardId.includes('-villain-masters-of-evil-ultron-')) {
    // why: `[icon:piercing]` is Victory Points; Ultron counts `[hc:tech]` Heroes among
    // ALL the player's cards (every zone), NOT just the victory pile — the distinction
    // from Supreme HYDRA (which counts villains in the victory pile only). Delivered per
    // D-24362.
    return (
      ULTRON_BASE_VP +
      ULTRON_BONUS_PER_TECH_HERO * countTechHeroesAmongCards(allPlayerCardIds, cardTraits)
    );
  }

  return null;
}
