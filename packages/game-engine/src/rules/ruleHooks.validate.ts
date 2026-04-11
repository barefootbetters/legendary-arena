/**
 * Validators for rule hook contracts.
 *
 * All validators return structured MoveResult values and never throw.
 * MoveError is reused from coreMoves.types.ts — no new error type is
 * defined here.
 *
 * No boardgame.io imports. Pure validation only.
 */

import type { MoveError } from '../moves/coreMoves.types.js';
import { RULE_TRIGGER_NAMES, RULE_EFFECT_TYPES } from './ruleHooks.types.js';
import type { RuleTriggerName } from './ruleHooks.types.js';

/** Structured result returned by all rule hook validators. */
type ValidateResult = { ok: true } | { ok: false; errors: MoveError[] };

/**
 * Validates that a trigger name is a known RuleTriggerName and that the
 * payload has the required fields for that trigger.
 *
 * Returns { ok: true } on success, or { ok: false, errors: [...] } on failure.
 * Never throws.
 */
export function validateTriggerPayload(
  triggerName: unknown,
  payload: unknown,
): ValidateResult {
  const errors: MoveError[] = [];

  if (typeof triggerName !== 'string') {
    errors.push({
      code: 'INVALID_TRIGGER_NAME',
      message: 'The trigger name must be a string.',
      path: 'triggerName',
    });
    return { ok: false, errors };
  }

  if (!RULE_TRIGGER_NAMES.includes(triggerName as RuleTriggerName)) {
    errors.push({
      code: 'UNKNOWN_TRIGGER_NAME',
      message: `The trigger name "${triggerName}" is not a recognized rule trigger.`,
      path: 'triggerName',
    });
    return { ok: false, errors };
  }

  if (payload === null || typeof payload !== 'object') {
    errors.push({
      code: 'INVALID_PAYLOAD',
      message: 'The trigger payload must be a non-null object.',
      path: 'payload',
    });
    return { ok: false, errors };
  }

  const record = payload as Record<string, unknown>;

  if (triggerName === 'onTurnStart' || triggerName === 'onTurnEnd') {
    if (typeof record.currentPlayerId !== 'string') {
      errors.push({
        code: 'MISSING_CURRENT_PLAYER_ID',
        message: `The payload for "${triggerName}" must include a currentPlayerId string.`,
        path: 'payload.currentPlayerId',
      });
    }
  }

  if (triggerName === 'onCardRevealed') {
    if (typeof record.cardId !== 'string') {
      errors.push({
        code: 'MISSING_CARD_ID',
        message: 'The payload for "onCardRevealed" must include a cardId string.',
        path: 'payload.cardId',
      });
    }
    if (typeof record.cardTypeSlug !== 'string') {
      errors.push({
        code: 'MISSING_CARD_TYPE_SLUG',
        message: 'The payload for "onCardRevealed" must include a cardTypeSlug string.',
        path: 'payload.cardTypeSlug',
      });
    }
  }

  if (
    triggerName === 'onSchemeTwistRevealed' ||
    triggerName === 'onMastermindStrikeRevealed'
  ) {
    if (typeof record.cardId !== 'string') {
      errors.push({
        code: 'MISSING_CARD_ID',
        message: `The payload for "${triggerName}" must include a cardId string.`,
        path: 'payload.cardId',
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

/**
 * Validates that an effect has a known type and the required fields for
 * that type.
 *
 * Returns { ok: true } on success, or { ok: false, errors: [...] } on failure.
 * Never throws.
 */
export function validateRuleEffect(effect: unknown): ValidateResult {
  const errors: MoveError[] = [];

  if (effect === null || typeof effect !== 'object') {
    errors.push({
      code: 'INVALID_EFFECT',
      message: 'The rule effect must be a non-null object.',
      path: 'effect',
    });
    return { ok: false, errors };
  }

  const record = effect as Record<string, unknown>;

  if (typeof record.type !== 'string') {
    errors.push({
      code: 'MISSING_EFFECT_TYPE',
      message: 'The rule effect must include a type string.',
      path: 'effect.type',
    });
    return { ok: false, errors };
  }

  if (!RULE_EFFECT_TYPES.includes(record.type)) {
    errors.push({
      code: 'UNKNOWN_EFFECT_TYPE',
      message: `The effect type "${record.type}" is not a recognized rule effect type.`,
      path: 'effect.type',
    });
    return { ok: false, errors };
  }

  if (record.type === 'queueMessage') {
    if (typeof record.message !== 'string') {
      errors.push({
        code: 'MISSING_MESSAGE',
        message: 'The "queueMessage" effect must include a message string.',
        path: 'effect.message',
      });
    }
  }

  if (record.type === 'modifyCounter') {
    if (typeof record.counter !== 'string') {
      errors.push({
        code: 'MISSING_COUNTER',
        message: 'The "modifyCounter" effect must include a counter string.',
        path: 'effect.counter',
      });
    }
    if (typeof record.delta !== 'number') {
      errors.push({
        code: 'MISSING_DELTA',
        message: 'The "modifyCounter" effect must include a delta number.',
        path: 'effect.delta',
      });
    }
  }

  if (record.type === 'drawCards') {
    if (typeof record.playerId !== 'string') {
      errors.push({
        code: 'MISSING_PLAYER_ID',
        message: 'The "drawCards" effect must include a playerId string.',
        path: 'effect.playerId',
      });
    }
    if (typeof record.count !== 'number') {
      errors.push({
        code: 'MISSING_COUNT',
        message: 'The "drawCards" effect must include a count number.',
        path: 'effect.count',
      });
    }
  }

  if (record.type === 'discardHand') {
    if (typeof record.playerId !== 'string') {
      errors.push({
        code: 'MISSING_PLAYER_ID',
        message: 'The "discardHand" effect must include a playerId string.',
        path: 'effect.playerId',
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

/**
 * Validates that a hook definition has the correct shape with all required
 * fields.
 *
 * Returns { ok: true } on success, or { ok: false, errors: [...] } on failure.
 * Never throws.
 */
export function validateHookDefinition(hook: unknown): ValidateResult {
  const errors: MoveError[] = [];

  if (hook === null || typeof hook !== 'object') {
    errors.push({
      code: 'INVALID_HOOK',
      message: 'The hook definition must be a non-null object.',
      path: 'hook',
    });
    return { ok: false, errors };
  }

  const record = hook as Record<string, unknown>;

  if (typeof record.id !== 'string') {
    errors.push({
      code: 'MISSING_ID',
      message: 'The hook definition must include an id string.',
      path: 'hook.id',
    });
  }

  if (record.kind !== 'scheme' && record.kind !== 'mastermind') {
    errors.push({
      code: 'INVALID_KIND',
      message: 'The hook definition kind must be "scheme" or "mastermind".',
      path: 'hook.kind',
    });
  }

  if (typeof record.sourceId !== 'string') {
    errors.push({
      code: 'MISSING_SOURCE_ID',
      message: 'The hook definition must include a sourceId string.',
      path: 'hook.sourceId',
    });
  }

  if (!Array.isArray(record.triggers)) {
    errors.push({
      code: 'MISSING_TRIGGERS',
      message: 'The hook definition must include a triggers array.',
      path: 'hook.triggers',
    });
  } else {
    for (const trigger of record.triggers) {
      if (!RULE_TRIGGER_NAMES.includes(trigger as RuleTriggerName)) {
        errors.push({
          code: 'UNKNOWN_TRIGGER_IN_HOOK',
          message: `The trigger "${String(trigger)}" in the hook definition is not a recognized rule trigger.`,
          path: 'hook.triggers',
        });
      }
    }
  }

  if (typeof record.priority !== 'number') {
    errors.push({
      code: 'MISSING_PRIORITY',
      message: 'The hook definition must include a priority number.',
      path: 'hook.priority',
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}
