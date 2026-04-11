/**
 * Default stub implementations for scheme and mastermind rule hooks.
 *
 * These are minimal MVP stubs that respond to onTurnStart and onTurnEnd
 * triggers with observable messages and zero-delta counter modifications.
 * Real scheme and mastermind implementations will replace these in later
 * Work Packets.
 *
 * No boardgame.io imports. No database, network, or filesystem access.
 */

import type { RuleEffect, HookDefinition } from './ruleHooks.types.js';
import type { LegendaryGameState } from '../types.js';
import type { ImplementationMap } from './ruleRuntime.execute.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

/** Stable identifier for the default scheme hook. */
export const DEFAULT_SCHEME_HOOK_ID = 'default-scheme-hook';

/** Stable identifier for the default mastermind hook. */
export const DEFAULT_MASTERMIND_HOOK_ID = 'default-mastermind-hook';

/**
 * Default scheme implementation responding to onTurnStart.
 *
 * Returns a message and a zero-delta counter modification. The message
 * string is locked by WP-009B — integration tests assert exact equality.
 *
 * @param _gameState - Current game state (unused in default stub).
 * @param _ctx - Context (unused in default stub).
 * @param _payload - Trigger payload (unused in default stub).
 * @returns Array of RuleEffect descriptions.
 */
export function defaultSchemeImplementation(
  _gameState: LegendaryGameState,
  _ctx: unknown,
  _payload: unknown,
): RuleEffect[] {
  return [
    { type: 'queueMessage', message: 'Scheme: turn started.' },
    { type: 'modifyCounter', counter: 'schemeTwistCount', delta: 0 },
  ];
}

/**
 * Default mastermind implementation responding to onTurnEnd.
 *
 * Returns a message and a zero-delta counter modification. The message
 * string is locked by WP-009B — integration tests assert exact equality.
 *
 * @param _gameState - Current game state (unused in default stub).
 * @param _ctx - Context (unused in default stub).
 * @param _payload - Trigger payload (unused in default stub).
 * @returns Array of RuleEffect descriptions.
 */
export function defaultMastermindImplementation(
  _gameState: LegendaryGameState,
  _ctx: unknown,
  _payload: unknown,
): RuleEffect[] {
  return [
    { type: 'queueMessage', message: 'Mastermind: turn ended.' },
    { type: 'modifyCounter', counter: 'masterStrikeCount', delta: 0 },
  ];
}

/**
 * The default ImplementationMap mapping both default hook IDs to their
 * stub handler functions.
 *
 * This map is imported by game.ts and passed to executeRuleHooks in the
 * lifecycle hooks. It is never stored in any field of G.
 */
export const DEFAULT_IMPLEMENTATION_MAP: ImplementationMap = {
  [DEFAULT_SCHEME_HOOK_ID]: defaultSchemeImplementation,
  [DEFAULT_MASTERMIND_HOOK_ID]: defaultMastermindImplementation,
};

/**
 * Builds the default HookDefinition entries for a match.
 *
 * Creates one scheme hook (priority 10, listens to onTurnStart) and one
 * mastermind hook (priority 20, listens to onTurnEnd). The sourceId for
 * each hook comes from the match setup config.
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
      triggers: ['onTurnStart'],
      priority: 10,
    },
    {
      id: DEFAULT_MASTERMIND_HOOK_ID,
      kind: 'mastermind',
      sourceId: config.mastermindId,
      triggers: ['onTurnEnd'],
      priority: 20,
    },
  ];
}
