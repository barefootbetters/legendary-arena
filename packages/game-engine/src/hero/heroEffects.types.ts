/**
 * Internal result type for hero effect execution.
 *
 * Tracks what happened during executeHeroEffects — whether each effect
 * executed or was skipped, and why. Used for dev/test assertions only.
 *
 * Not stored in G. Not exported from the package unless tests need it.
 *
 * No boardgame.io imports. No registry imports. Contracts only.
 */

/**
 * Describes the outcome of a single hero effect execution attempt.
 *
 * @property executed - Whether the effect actually mutated G.
 * @property keyword - The HeroKeyword label of the effect.
 * @property message - Human-readable description of what happened.
 */
export interface HeroEffectResult {
  executed: boolean;
  keyword: string;
  message: string;
}
