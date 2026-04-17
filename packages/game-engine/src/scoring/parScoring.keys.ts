/**
 * Canonical identity-key builders for PAR scoring (WP-048).
 *
 * buildScenarioKey and buildTeamKey produce stable, sorted strings that
 * uniquely identify a scenario and a hero team respectively. Keys are
 * used as index keys for leaderboard lookups and for pinning score
 * breakdowns to their scenario context.
 *
 * Pure helpers. No boardgame.io import. No registry, server, or filesystem
 * access. Deterministic for a given input set.
 */

import type { ScenarioKey, TeamKey } from './parScoring.types.js';

/**
 * Builds a canonical ScenarioKey from a scheme slug, a mastermind slug, and
 * the list of villain group slugs participating in the scenario.
 *
 * Format: `{schemeSlug}::{mastermindSlug}::{sorted-villainGroupSlugs-joined-by-+}`
 *
 * Example: `buildScenarioKey('midtown-bank-robbery', 'red-skull',
 * ['masters-of-evil', 'hydra'])` returns
 * `'midtown-bank-robbery::red-skull::hydra+masters-of-evil'`.
 *
 * @param schemeSlug - Slug identifying the scheme.
 * @param mastermindSlug - Slug identifying the mastermind.
 * @param villainGroupSlugs - Villain group slugs; order does not matter.
 * @returns A stable, sorted ScenarioKey string.
 */
export function buildScenarioKey(
  schemeSlug: string,
  mastermindSlug: string,
  villainGroupSlugs: readonly string[],
): ScenarioKey {
  // why: sorting ensures stable keys regardless of input order. Two calls
  // with the same villains in different orders must produce the same key
  // so leaderboards index consistently.
  const sortedVillainGroupSlugs = [...villainGroupSlugs].sort();
  const villainSegment = sortedVillainGroupSlugs.join('+');
  return `${schemeSlug}::${mastermindSlug}::${villainSegment}`;
}

/**
 * Builds a canonical TeamKey from the list of hero slugs playing the match.
 *
 * Format: `{sorted-heroSlugs-joined-by-+}`
 *
 * Example: `buildTeamKey(['wolverine', 'spider-man', 'iron-man',
 * 'captain-america'])` returns
 * `'captain-america+iron-man+spider-man+wolverine'`.
 *
 * @param heroSlugs - Hero slugs; order does not matter.
 * @returns A stable, sorted TeamKey string.
 */
export function buildTeamKey(heroSlugs: readonly string[]): TeamKey {
  const sortedHeroSlugs = [...heroSlugs].sort();
  return sortedHeroSlugs.join('+');
}
