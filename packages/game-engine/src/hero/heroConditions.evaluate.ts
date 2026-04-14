/**
 * Hero condition evaluation for the Legendary Arena game engine.
 *
 * Evaluates declarative hero ability conditions against current game state.
 * Pure functions only — conditions read G and return boolean, never mutating
 * state. Unsupported condition types return false (safe skip).
 *
 * WP-023 scope: 4 MVP condition types. heroClassMatch and requiresTeam are
 * placeholders (return false) until team/class data is resolved into G by
 * a follow-up WP. requiresKeyword and playedThisTurn are fully functional.
 *
 * No boardgame.io imports. No registry imports. No .reduce().
 */

import type { LegendaryGameState } from '../types.js';
import type { HeroCondition } from '../rules/heroAbility.types.js';
import { getHooksForCard } from '../rules/heroAbility.types.js';

// ---------------------------------------------------------------------------
// evaluateCondition — single condition evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates a single hero ability condition against current game state.
 *
 * Pure function: reads G, returns boolean, never mutates state.
 * Unsupported condition types return false (safe skip).
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @param condition - The condition descriptor to evaluate.
 * @returns Whether the condition is met.
 */
export function evaluateCondition(
  G: LegendaryGameState,
  playerID: string,
  condition: HeroCondition,
): boolean {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return false;
  }

  switch (condition.type) {
    case 'heroClassMatch': {
      // why: hero class data is not resolved into G yet — returns false
      // until a follow-up WP adds class data to G.cardStats or a dedicated
      // field. This is a safe skip, same pattern as WP-022 for unsupported
      // keywords.
      return false;
    }

    case 'requiresTeam': {
      // why: team data is not resolved into G yet — returns false until a
      // follow-up WP adds team data to G.cardStats or a dedicated field.
      // Same safe-skip pattern.
      return false;
    }

    case 'requiresKeyword': {
      // why: evaluates keyword synergy — checks if any played card has
      // hooks with the specified keyword. Uses G.heroAbilityHooks which
      // is built at setup time and available at runtime.
      if (!G.heroAbilityHooks) {
        return false;
      }

      const targetKeyword = condition.value;

      for (const cardId of playerZones.inPlay) {
        const hooksForCard = getHooksForCard(G.heroAbilityHooks, cardId);
        for (const hook of hooksForCard) {
          for (const keyword of hook.keywords) {
            if (keyword === targetKeyword) {
              return true;
            }
          }
        }
      }

      return false;
    }

    case 'playedThisTurn': {
      // why: condition.value is always a string per HeroCondition contract
      // — parse to number for threshold comparison. Returns false if
      // parseInt produces NaN (safe skip for malformed data).
      const threshold = parseInt(condition.value, 10);
      if (Number.isNaN(threshold)) {
        return false;
      }

      return playerZones.inPlay.length >= threshold;
    }

    default: {
      // why: unsupported condition types are safely skipped — same pattern
      // as WP-022 for unsupported keywords. Future WPs will add new
      // condition types by extending this switch.
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// evaluateAllConditions — AND logic over all conditions
// ---------------------------------------------------------------------------

/**
 * Evaluates all conditions on a hero ability hook (AND logic).
 *
 * Returns true only if ALL conditions pass. Empty or undefined conditions
 * array returns true (unconditional effect).
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @param conditions - Array of conditions to evaluate (may be undefined).
 * @returns Whether all conditions are met.
 */
export function evaluateAllConditions(
  G: LegendaryGameState,
  playerID: string,
  conditions: HeroCondition[] | undefined,
): boolean {
  if (conditions === undefined || conditions.length === 0) {
    return true;
  }

  for (const condition of conditions) {
    if (!evaluateCondition(G, playerID, condition)) {
      return false;
    }
  }

  return true;
}
