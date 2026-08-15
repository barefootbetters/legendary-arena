/**
 * Card-text dynamic victory-point modifiers for the Legendary Arena game engine.
 *
 * Some villain cards print a victory-point worth that depends on the end-of-game
 * board rather than a fixed printed number. Supreme HYDRA is the first such card:
 * "Supreme HYDRA is worth +3 VP for each other HYDRA Villain in your Victory Pile."
 *
 * This module resolves that worth from the victory-pile ext_id strings alone.
 * Pure — no `G` mutation, no engine randomness, no I/O. No boardgame.io
 * imports. Seeded with exactly one card (duplicate-first per
 * `.claude/rules/code-style.md` §Abstraction); the second dynamic-VP card earns
 * the generalization.
 */

import type { CardExtId } from '../state/zones.types.js';

/** Supreme HYDRA's base victory-point worth before the per-HYDRA bonus. */
export const SUPREME_HYDRA_BASE_VP = 3;

/** Bonus victory points Supreme HYDRA gains for each OTHER HYDRA Villain in the pile. */
export const SUPREME_HYDRA_BONUS_PER_OTHER_HYDRA_VILLAIN = 3;

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
 * Pure — reads only the victory-pile ext_id strings; no `G` mutation, no `ctx`.
 *
 * @param cardId - The victory-pile card being scored.
 * @param victoryPile - The scoring player's full victory pile (ext_id strings).
 * @returns The card's dynamic VP, or null when it carries no dynamic rule.
 */
export function computeDynamicVillainVictoryPoints(
  cardId: CardExtId,
  victoryPile: readonly CardExtId[],
): number | null {
  // why: `[icon:piercing]` renders Victory Points in this card data (corroborated
  // across the corpus: Ultron, amwp, 3dtc). Supreme HYDRA is the FIRST card-text VP
  // modifier — the `scoring.types.ts` "future packet" note, delivered per D-24355.
  // Seeded with exactly one card, not a multi-card registry (duplicate-first).
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

  return null;
}
