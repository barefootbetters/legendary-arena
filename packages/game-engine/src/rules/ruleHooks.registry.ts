/**
 * Hook registry factory and query helpers.
 *
 * createHookRegistry validates and stores hook definitions. It may throw
 * because registry construction is a setup-time operation, not a move.
 *
 * getHooksForTrigger returns hooks subscribed to a trigger, sorted
 * deterministically for replay correctness.
 *
 * No boardgame.io imports. Pure data operations only.
 */

import type { RuleTriggerName, HookDefinition, HookRegistry } from './ruleHooks.types.js';
import { validateHookDefinition } from './ruleHooks.validate.js';

/**
 * Creates a validated HookRegistry from an array of hook definitions.
 *
 * Each hook is validated with validateHookDefinition. If any hook fails
 * validation, this function throws an Error with a full-sentence message
 * identifying which hook failed. This is registry construction (setup-time),
 * not a move, so throwing is appropriate.
 */
export function createHookRegistry(hooks: HookDefinition[]): HookRegistry {
  for (const hook of hooks) {
    const result = validateHookDefinition(hook);
    if (!result.ok) {
      const errorMessages = result.errors
        .map((error) => error.message)
        .join('; ');
      throw new Error(
        `Hook definition "${String(hook.id)}" failed validation: ${errorMessages}`,
      );
    }
  }

  return [...hooks];
}

// why: Deterministic ordering is required for replay correctness. Sorting by
// priority ascending then by id lexically for ties ensures that identical
// hook registries always produce identical effect sequences when the same
// triggers fire. Without this guarantee, replays would diverge.

/**
 * Returns all hooks subscribed to the given trigger, sorted by priority
 * ascending, then by id lexically for ties.
 *
 * The deterministic sort order ensures identical effect sequences given the
 * same hooks, which is required for replay correctness.
 */
export function getHooksForTrigger(
  registry: HookRegistry,
  triggerName: RuleTriggerName,
): HookDefinition[] {
  const matchingHooks: HookDefinition[] = [];

  for (const hook of registry) {
    if (hook.triggers.includes(triggerName)) {
      matchingHooks.push(hook);
    }
  }

  matchingHooks.sort((hookA, hookB) => {
    if (hookA.priority !== hookB.priority) {
      return hookA.priority - hookB.priority;
    }
    return hookA.id.localeCompare(hookB.id);
  });

  return matchingHooks;
}
