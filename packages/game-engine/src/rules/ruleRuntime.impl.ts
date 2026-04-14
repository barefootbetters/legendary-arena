/**
 * Rule hook definitions and ImplementationMap for scheme and mastermind
 * rule hooks.
 *
 * Builds HookDefinition entries for the selected scheme and mastermind
 * at setup time, and maps their hook ids to handler functions in the
 * ImplementationMap. Scheme hooks fire on onSchemeTwistRevealed;
 * mastermind hooks fire on onMastermindStrikeRevealed.
 *
 * No boardgame.io imports. No database, network, or filesystem access.
 */

import type { HookDefinition } from './ruleHooks.types.js';
import type { ImplementationMap } from './ruleRuntime.execute.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import { schemeTwistHandler } from './schemeHandlers.js';
import { mastermindStrikeHandler } from './mastermindHandlers.js';

/** Stable identifier for the default scheme hook. */
export const DEFAULT_SCHEME_HOOK_ID = 'default-scheme-hook';

/** Stable identifier for the default mastermind hook. */
export const DEFAULT_MASTERMIND_HOOK_ID = 'default-mastermind-hook';

// why: functions cannot be serialized; ImplementationMap is rebuilt each
// match from matchData. Handler functions live outside G.

/**
 * The ImplementationMap mapping both default hook IDs to their handler
 * functions.
 *
 * This map is imported by game.ts and passed to executeRuleHooks in the
 * lifecycle hooks. It is never stored in any field of G.
 */
export const DEFAULT_IMPLEMENTATION_MAP: ImplementationMap = {
  [DEFAULT_SCHEME_HOOK_ID]: schemeTwistHandler,
  [DEFAULT_MASTERMIND_HOOK_ID]: mastermindStrikeHandler,
};

/**
 * Builds the default HookDefinition entries for a match.
 *
 * Creates one scheme hook (priority 10, listens to onSchemeTwistRevealed)
 * and one mastermind hook (priority 20, listens to
 * onMastermindStrikeRevealed). The sourceId for each hook comes from the
 * match setup config.
 *
 * @param config - The match setup config providing schemeId and mastermindId.
 * @returns Array of two HookDefinition entries for the default hooks.
 */
export function buildDefaultHookDefinitions(
  config: MatchSetupConfig,
): HookDefinition[] {
  return [
    {
      id: DEFAULT_SCHEME_HOOK_ID,
      kind: 'scheme',
      sourceId: config.schemeId,
      triggers: ['onSchemeTwistRevealed'],
      priority: 10,
    },
    {
      id: DEFAULT_MASTERMIND_HOOK_ID,
      kind: 'mastermind',
      sourceId: config.mastermindId,
      triggers: ['onMastermindStrikeRevealed'],
      priority: 20,
    },
  ];
}
