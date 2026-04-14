/**
 * Scheme twist handler for the ImplementationMap.
 *
 * Produces RuleEffect[] when a scheme twist card is revealed from the
 * villain deck. Increments the scheme twist counter and checks whether
 * the twist count has reached the loss threshold.
 *
 * No boardgame.io imports. No registry imports. No G mutation.
 * Handler returns effects — applyRuleEffects applies them.
 */

import type { RuleEffect } from './ruleHooks.types.js';
import type { LegendaryGameState } from '../types.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';

// why: MVP uses a fixed threshold. Most standard Legendary schemes trigger
// loss at 7 twists. A future WP will parameterize per-scheme thresholds
// resolved from registry data at setup time.
const MVP_SCHEME_TWIST_THRESHOLD = 7;

/**
 * Scheme twist handler for the ImplementationMap.
 *
 * Produces effects when a scheme twist card is revealed from the villain
 * deck. Increments the scheme twist counter and checks whether the twist
 * count has reached the loss threshold.
 *
 * @param gameState - Current game state (read-only — do not mutate).
 * @param _ctx - Context (unused — handlers produce effects, not mutations).
 * @param _payload - Trigger payload ({ cardId } from villain reveal).
 * @returns Array of RuleEffect descriptions to apply.
 */
export function schemeTwistHandler(
  gameState: LegendaryGameState,
  _ctx: unknown,
  _payload: unknown,
): RuleEffect[] {
  const effects: RuleEffect[] = [];

  effects.push({
    type: 'modifyCounter',
    counter: 'schemeTwistCount',
    delta: 1,
  });

  effects.push({
    type: 'queueMessage',
    message: 'Scheme twist revealed — twist count incremented.',
  });

  // why: scheme-loss is mediated through counters, not direct endgame
  // calls. The endgame evaluator reads G.counters to determine loss.
  // We predict the post-effect count by adding 1 to the current value
  // because applyRuleEffects has not yet applied the increment above.
  const predictedTwistCount =
    (gameState.counters.schemeTwistCount ?? 0) + 1;

  if (predictedTwistCount >= MVP_SCHEME_TWIST_THRESHOLD) {
    effects.push({
      type: 'modifyCounter',
      counter: ENDGAME_CONDITIONS.SCHEME_LOSS,
      delta: 1,
    });

    effects.push({
      type: 'queueMessage',
      message: 'Scheme loss triggered — twist threshold reached.',
    });
  }

  return effects;
}
