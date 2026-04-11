/**
 * Contract and drift-detection tests for rule hook types, validators,
 * and registry helpers.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RULE_TRIGGER_NAMES,
  RULE_EFFECT_TYPES,
} from './ruleHooks.types.js';
import type {
  RuleTriggerName,
  RuleEffect,
  HookDefinition,
  OnTurnStartPayload,
  OnTurnEndPayload,
  OnCardRevealedPayload,
  OnSchemeTwistRevealedPayload,
  OnMastermindStrikeRevealedPayload,
} from './ruleHooks.types.js';
import {
  validateTriggerPayload,
  validateRuleEffect,
  validateHookDefinition,
} from './ruleHooks.validate.js';
import {
  createHookRegistry,
  getHooksForTrigger,
} from './ruleHooks.registry.js';

// ---------------------------------------------------------------------------
// Drift-detection tests
// ---------------------------------------------------------------------------

describe('RULE_TRIGGER_NAMES drift detection', () => {
  // why: Failure here means a trigger name was added to the RuleTriggerName
  // union but not the canonical array, or vice versa. Both must stay in sync.
  it('contains exactly the 5 canonical trigger names', () => {
    assert.deepStrictEqual(
      [...RULE_TRIGGER_NAMES],
      [
        'onTurnStart',
        'onTurnEnd',
        'onCardRevealed',
        'onSchemeTwistRevealed',
        'onMastermindStrikeRevealed',
      ],
    );
  });
});

describe('RULE_EFFECT_TYPES drift detection', () => {
  // why: Failure here means an effect type was added to the RuleEffect
  // tagged union but not the canonical array, or vice versa. Both must stay
  // in sync.
  it('contains exactly the 4 canonical effect types', () => {
    assert.deepStrictEqual(
      [...RULE_EFFECT_TYPES],
      [
        'queueMessage',
        'modifyCounter',
        'drawCards',
        'discardHand',
      ],
    );
  });
});

// ---------------------------------------------------------------------------
// validateTriggerPayload tests
// ---------------------------------------------------------------------------

describe('validateTriggerPayload', () => {
  it('accepts a valid onTurnStart payload', () => {
    const result = validateTriggerPayload('onTurnStart', {
      currentPlayerId: '0',
    });
    assert.deepStrictEqual(result, { ok: true });
  });

  it('rejects a payload with a missing required field', () => {
    const result = validateTriggerPayload('onCardRevealed', {
      cardId: 'card-ext-001',
      // missing cardTypeSlug
    });
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.length > 0);
      assert.strictEqual(result.errors[0].code, 'MISSING_CARD_TYPE_SLUG');
    }
  });
});

// ---------------------------------------------------------------------------
// validateRuleEffect tests
// ---------------------------------------------------------------------------

describe('validateRuleEffect', () => {
  it('accepts a valid queueMessage effect', () => {
    const effect: RuleEffect = { type: 'queueMessage', message: 'Scheme twist activated.' };
    const result = validateRuleEffect(effect);
    assert.deepStrictEqual(result, { ok: true });
  });

  it('rejects an effect with an unknown type', () => {
    const result = validateRuleEffect({ type: 'teleportPlayer', target: '1' });
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.length > 0);
      assert.strictEqual(result.errors[0].code, 'UNKNOWN_EFFECT_TYPE');
    }
  });
});

// ---------------------------------------------------------------------------
// validateHookDefinition tests
// ---------------------------------------------------------------------------

describe('validateHookDefinition', () => {
  it('accepts a valid HookDefinition', () => {
    const hook: HookDefinition = {
      id: 'scheme-001-twist',
      kind: 'scheme',
      sourceId: 'scheme-ext-001',
      triggers: ['onSchemeTwistRevealed'],
      priority: 10,
    };
    const result = validateHookDefinition(hook);
    assert.deepStrictEqual(result, { ok: true });
  });

  it('rejects a HookDefinition with a missing priority field', () => {
    const result = validateHookDefinition({
      id: 'scheme-002-twist',
      kind: 'scheme',
      sourceId: 'scheme-ext-002',
      triggers: ['onSchemeTwistRevealed'],
      // missing priority
    });
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.length > 0);
      const priorityError = result.errors.find(
        (error) => error.code === 'MISSING_PRIORITY',
      );
      assert.ok(priorityError, 'Expected a MISSING_PRIORITY error.');
    }
  });
});

// ---------------------------------------------------------------------------
// JSON serialization tests
// ---------------------------------------------------------------------------

describe('JSON serialization', () => {
  it('all trigger payload instances pass JSON.stringify without throwing', () => {
    const payloads: [RuleTriggerName, object][] = [
      ['onTurnStart', { currentPlayerId: '0' } satisfies OnTurnStartPayload],
      ['onTurnEnd', { currentPlayerId: '1' } satisfies OnTurnEndPayload],
      [
        'onCardRevealed',
        { cardId: 'card-ext-100', cardTypeSlug: 'villain' } satisfies OnCardRevealedPayload,
      ],
      [
        'onSchemeTwistRevealed',
        { cardId: 'card-ext-200' } satisfies OnSchemeTwistRevealedPayload,
      ],
      [
        'onMastermindStrikeRevealed',
        { cardId: 'card-ext-300' } satisfies OnMastermindStrikeRevealedPayload,
      ],
    ];

    for (const [triggerName, payload] of payloads) {
      assert.doesNotThrow(
        () => JSON.stringify(payload),
        `JSON.stringify should not throw for ${triggerName} payload.`,
      );
    }
  });

  it('all effect variants pass JSON.stringify without throwing', () => {
    const effects: RuleEffect[] = [
      { type: 'queueMessage', message: 'Test message.' },
      { type: 'modifyCounter', counter: 'escapedVillains', delta: 1 },
      { type: 'drawCards', playerId: '0', count: 2 },
      { type: 'discardHand', playerId: '1' },
    ];

    for (const effect of effects) {
      assert.doesNotThrow(
        () => JSON.stringify(effect),
        `JSON.stringify should not throw for "${effect.type}" effect.`,
      );
    }
  });
});
