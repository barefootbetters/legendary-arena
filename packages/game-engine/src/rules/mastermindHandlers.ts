/**
 * Mastermind strike handler for the ImplementationMap.
 *
 * Produces RuleEffect[] when a mastermind strike card is revealed from
 * the villain deck. MVP: increments a strike counter and queues a message.
 *
 * No boardgame.io imports. No registry imports. No G mutation.
 * Handler returns effects — applyRuleEffects applies them.
 */

import type { RuleEffect } from './ruleHooks.types.js';
import type { LegendaryGameState } from '../types.js';

/**
 * Mastermind strike handler for the ImplementationMap.
 *
 * Produces effects when a mastermind strike card is revealed from the
 * villain deck. MVP: increments a strike counter and queues a message.
 *
 * @param _gameState - Current game state (unused in MVP handler).
 * @param _ctx - Context (unused — handlers produce effects, not mutations).
 * @param _payload - Trigger payload ({ cardId } from villain reveal).
 * @returns Array of RuleEffect descriptions to apply.
 */
// why: MVP strike effect is simplified. Full mastermind text abilities
// (each player gains a wound, discard cards, etc.) require a 'gainWound'
// effect type that does not exist yet. Counter tracking + message provides
// observability for the MVP. A future WP will add card-movement wound
// effects.
export function mastermindStrikeHandler(
  _gameState: LegendaryGameState,
  _ctx: unknown,
  _payload: unknown,
): RuleEffect[] {
  const effects: RuleEffect[] = [];

  effects.push({
    type: 'modifyCounter',
    counter: 'masterStrikeCount',
    delta: 1,
  });

  effects.push({
    type: 'queueMessage',
    message: 'Mastermind strike revealed — strike count incremented.',
  });

  return effects;
}
