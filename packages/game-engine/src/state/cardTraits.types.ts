/**
 * Card trait types for the Legendary Arena game engine.
 *
 * Categorical card attributes resolved at setup time from registry data.
 * Stored in G.cardTraits as a sibling snapshot to G.cardStats.
 */

// why: categorical traits are separated from economy stats (CardStatEntry).
// CardStatEntry holds numeric economy values (attack, recruit, cost, fightCost).
// CardTraitEntry holds categorical attributes (heroClass, team). Mixing them
// conflates two concerns and makes the types harder to extend independently.

/**
 * Categorical card attributes resolved at setup time from registry data.
 *
 * @property heroClass - Hero class slug or null for non-hero cards.
 * @property team - Team slug or null for cards without a team.
 */
export interface CardTraitEntry {
  heroClass: string | null;
  // why: WP-703 / D-24523 — a dual-class hero card's SECOND printed class. Optional
  // and omitted-when-absent (never `null` on a single-class card) so a match with no
  // dual-class hero serializes byte-identically to pre-WP-703 (no determinism re-pin).
  heroClass2?: string | null;
  team: string | null;
}
