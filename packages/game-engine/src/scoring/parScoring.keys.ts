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
 * The one set whose ids appear BARE in a ScenarioKey segment. Every other set's
 * ids keep their `setAbbr/` qualifier.
 */
// why: D-24597 — reprints share bare slugs with core (co2e/msp1 Civil War, Cosmic
// Cube, Red Skull, Hydra, ...) but not rules, so a set-blind key scored them
// against core's PAR. Qualifying only non-core ids keeps every core key — and so
// every published PAR row and every stored competitive score — byte-identical.
export const SCENARIO_KEY_BARE_SET_ABBR = 'core';

/**
 * Projects one set-qualified ext_id (`setAbbr/slug`) to its ScenarioKey segment
 * form: the bare slug for a `core/` id, the id unchanged for any other set. An id
 * with no `/` passes through unchanged.
 *
 * Example: `toScenarioKeySegment('core/red-skull')` returns `'red-skull'`;
 * `toScenarioKeySegment('co2e/red-skull')` returns `'co2e/red-skull'`.
 *
 * @param extId - A set-qualified id, e.g. a `MatchSelection` field.
 * @returns The segment form used inside a ScenarioKey.
 */
export function toScenarioKeySegment(extId: string): string {
  const corePrefix = `${SCENARIO_KEY_BARE_SET_ABBR}/`;
  if (extId.startsWith(corePrefix)) {
    return extId.slice(corePrefix.length);
  }
  return extId;
}

/**
 * Builds the ScenarioKey for a match from its set-qualified selection ids — the
 * single derivation every PAR lookup keys on (capture, seed PAR generation).
 *
 * Example: `buildScenarioKeyFromExtIds('co2e/super-hero-civil-war',
 * 'core/red-skull', ['core/hydra'])` returns
 * `'co2e/super-hero-civil-war::red-skull::hydra'`.
 *
 * @param schemeExtId - Set-qualified scheme id.
 * @param mastermindExtId - Set-qualified mastermind id.
 * @param villainGroupExtIds - Set-qualified villain group ids; order does not matter.
 * @returns A stable, sorted ScenarioKey string.
 */
export function buildScenarioKeyFromExtIds(
  schemeExtId: string,
  mastermindExtId: string,
  villainGroupExtIds: readonly string[],
): ScenarioKey {
  const villainGroupSegments: string[] = [];
  for (const villainGroupExtId of villainGroupExtIds) {
    villainGroupSegments.push(toScenarioKeySegment(villainGroupExtId));
  }
  return buildScenarioKey(
    toScenarioKeySegment(schemeExtId),
    toScenarioKeySegment(mastermindExtId),
    villainGroupSegments,
  );
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
