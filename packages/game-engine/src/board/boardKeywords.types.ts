/**
 * Board keyword type definitions for the Legendary Arena game engine.
 *
 * Board keywords are structural City rules — NOT hero abilities. They fire
 * automatically without player choice and do not use the HeroAbilityHook
 * system.
 */

// why: board keywords are structural City rules, not hero abilities.
// They modify City behavior automatically: Patrol increases fight cost,
// Guard blocks access to lower-index cards, Ambush triggers effects on
// City entry. They require no player choice and use a separate mechanism
// from hero hooks.

/** A board-control keyword that modifies City behavior. */
export type BoardKeyword = 'patrol' | 'ambush' | 'guard';

/**
 * Canonical array of all board keywords. Single source of truth.
 *
 * Used for drift-detection testing — if a keyword is added to the
 * BoardKeyword union, it must also appear in this array (and vice versa).
 */
export const BOARD_KEYWORDS: readonly BoardKeyword[] = [
  'patrol',
  'ambush',
  'guard',
] as const;
