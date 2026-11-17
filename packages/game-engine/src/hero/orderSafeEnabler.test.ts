/**
 * Tests for the order-safe enabler classification (WP-900 / D-24857).
 *
 * - Drift pin: the allowlist is an explicit literal list, contains every wait-and-see type,
 *   and is disjoint from the sequence-gate and play-history sets.
 * - Predicate: each rejecting field, alone on an otherwise order-safe baseline hook, makes the
 *   hook order-unsafe; allowlisted conditions keep it safe.
 * - Keyset: every field the classification tables mark 'rejected' or 'recursed' has a case.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ORDER_SAFE_ENABLER_CONDITION_TYPES,
  ORDER_SAFETY_FIELD_TABLES,
  isOrderSafeEnablerHook,
} from './orderSafeEnabler.js';
import { WAIT_AND_SEE_CONDITION_TYPES } from './deferredConditionalGrants.js';
import { PLAY_HISTORY_CONDITION_TYPES, SEQUENCE_GATE_CONDITION_TYPES } from './heroConditions.evaluate.js';
import type { HeroAbilityHook, HeroEffectDescriptor } from '../rules/heroAbility.types.js';

// why: WP-900 / D-24857 — an explicit list, not a spread of WAIT_AND_SEE_CONDITION_TYPES, so a
// new wait-and-see type is a visible, reviewed change to the coach's enabler allowlist.
const EXPECTED_ORDER_SAFE_TYPES: readonly string[] = [
  'recruitMadeThisTurnAtLeast',
  'distinctHeroClassesAtLeast',
  'defeatedVillainOrMastermindThisTurn',
  'cardsDrawnThisTurnAtLeast',
  'cardsDiscardedThisTurnAtLeast',
  'masterStrikePlayedThisTurn',
  'masterStrikeOrAmbushPlayedThisTurn',
  'ownedCardKoedThisTurn',
  'ownedHeroKoedThisTurn',
  'deckCardKoedThisTurn',
  'attackIconCardKoedFromDeckThisTurn',
  'nonGreyHeroKoedFromDeckThisTurn',
  'heroPutIntoKoPileThisTurn',
  'firstHeroPlayedThisTurn',
];

/** The order-safe baseline effect: a flat Attack grant. */
const FLAT_ATTACK: HeroEffectDescriptor = { type: 'attack', magnitude: 2 };

/**
 * Builds an onPlay hook (no conditions, one flat Attack effect unless overridden).
 *
 * @param overrides - Hook fields to set.
 * @returns The hook.
 */
function makeHook(overrides: Partial<HeroAbilityHook> = {}): HeroAbilityHook {
  return { cardId: 'test/hero/card#0', timing: 'onPlay', keywords: [], effects: [FLAT_ATTACK], ...overrides };
}

/**
 * Builds the baseline hook with one effect: the flat Attack plus the given fields.
 *
 * @param fields - Effect fields to add to the flat Attack.
 * @returns The hook.
 */
function hookWithEffectFields(fields: Partial<HeroEffectDescriptor>): HeroAbilityHook {
  return makeHook({ effects: [{ ...FLAT_ATTACK, ...fields }] });
}

/**
 * Wraps an inner effect under a nested-effect field of an otherwise clean outer effect.
 *
 * @param fieldName - The nested-effect array field.
 * @param innerEffect - The inner effect.
 * @returns The hook.
 */
function hookWithNestedEffect(
  fieldName: 'digestEffects' | 'indigestionEffects' | 'excessiveViolenceEffects' | 'heistEffects',
  innerEffect: HeroEffectDescriptor,
): HeroAbilityHook {
  // why: the outer effect is a plain 'heist' carrying no top-level rejecting field, so the case
  // can only fail through the recursion (never through e.g. a digest threshold).
  return makeHook({ effects: [{ type: 'heist', [fieldName]: [innerEffect] }] });
}

const COUNT_SCALED_INNER: HeroEffectDescriptor = {
  type: 'attack-per-count',
  magnitude: 1,
  countSource: 'victory-bystanders',
};

// why: WP-900 / D-24857 — the AC 3 'false' cases keyed by the effect field that rejects them,
// read by the keyset test so every 'rejected' / 'recursed' table entry has a case.
const REJECTING_EFFECT_FIELD_CASES: Record<string, HeroAbilityHook> = {
  countSource: hookWithEffectFields({ type: 'attack-per-count', countSource: 'odd-cost-heroes-played-this-turn' }),
  countScaledChoiceOptions: hookWithEffectFields({
    type: 'count-scaled-choose',
    countScaledChoiceOptions: [
      { kind: 'count-scaled', resource: 'attack', countSource: 'attack-icon-played-this-turn', magnitude: 1 },
    ],
  }),
  rewardComposition: hookWithEffectFields({ rewardComposition: 'berserk' }),
  empoweredClass: hookWithEffectFields({ empoweredClass: 'tech' }),
  empoweredClasses: hookWithEffectFields({ empoweredClasses: ['tech', 'covert'] }),
  digestThreshold: hookWithEffectFields({ digestThreshold: 3 }),
  digestEffects: hookWithNestedEffect('digestEffects', COUNT_SCALED_INNER),
  indigestionEffects: hookWithNestedEffect('indigestionEffects', COUNT_SCALED_INNER),
  bothCondition: hookWithEffectFields({ bothCondition: { type: 'heroClassMatch', value: 'instinct' } }),
  excessiveViolenceEffects: hookWithNestedEffect('excessiveViolenceEffects', COUNT_SCALED_INNER),
  heistEffects: hookWithNestedEffect('heistEffects', COUNT_SCALED_INNER),
  sunlightEffects: hookWithEffectFields({ sunlightEffects: [FLAT_ATTACK] }),
  moonlightEffects: hookWithEffectFields({ moonlightEffects: [FLAT_ATTACK] }),
  attackRestriction: hookWithEffectFields({
    attackRestriction: { targets: ['bridge'], widenToMastermindWhen: [{ type: 'heroClassMatch', value: 'ranged' }] },
  }),
  nonGreyHeroKoAttack: hookWithEffectFields({ nonGreyHeroKoAttack: 2 }),
};

describe('ORDER_SAFE_ENABLER_CONDITION_TYPES drift pin (WP-900 / D-24857)', () => {
  test('equals the explicit 14-literal list, with no duplicate', () => {
    assert.deepEqual([...ORDER_SAFE_ENABLER_CONDITION_TYPES], [...EXPECTED_ORDER_SAFE_TYPES]);
    assert.equal(new Set(ORDER_SAFE_ENABLER_CONDITION_TYPES).size, ORDER_SAFE_ENABLER_CONDITION_TYPES.length);
  });

  test('contains every wait-and-see type', () => {
    for (const waitAndSeeType of WAIT_AND_SEE_CONDITION_TYPES) {
      assert.ok(ORDER_SAFE_ENABLER_CONDITION_TYPES.includes(waitAndSeeType), `${waitAndSeeType} must be order-safe`);
    }
  });

  test('is disjoint from the sequence-gate and play-history sets', () => {
    for (const orderSafeType of ORDER_SAFE_ENABLER_CONDITION_TYPES) {
      assert.equal(SEQUENCE_GATE_CONDITION_TYPES.includes(orderSafeType), false, `${orderSafeType} is a sequence gate`);
      assert.equal(PLAY_HISTORY_CONDITION_TYPES.includes(orderSafeType), false, `${orderSafeType} is play history`);
    }
  });
});

describe('isOrderSafeEnablerHook — order-safe hooks (WP-900 / D-24857)', () => {
  test('no conditions and a flat Attack effect', () => {
    assert.equal(isOrderSafeEnablerHook(makeHook()), true);
  });

  test('only a wait-and-see condition', () => {
    const hook = makeHook({ conditions: [{ type: 'recruitMadeThisTurnAtLeast', value: '8' }] });
    assert.equal(isOrderSafeEnablerHook(hook), true);
  });

  test('only a first-Hero condition', () => {
    const hook = makeHook({ conditions: [{ type: 'firstHeroPlayedThisTurn', value: '1' }] });
    assert.equal(isOrderSafeEnablerHook(hook), true);
  });

  test('an attack restriction with no Mastermind widening', () => {
    assert.equal(isOrderSafeEnablerHook(hookWithEffectFields({ attackRestriction: { targets: ['bridge'] } })), true);
  });

  test('an allowlisted bothCondition and an allowlisted widening condition are not blanket rejections', () => {
    const bothHook = hookWithEffectFields({ bothCondition: { type: 'recruitMadeThisTurnAtLeast', value: '8' } });
    const widenHook = hookWithEffectFields({
      attackRestriction: { targets: ['bridge'], widenToMastermindWhen: [{ type: 'firstHeroPlayedThisTurn', value: '1' }] },
    });
    assert.equal(isOrderSafeEnablerHook(bothHook), true);
    assert.equal(isOrderSafeEnablerHook(widenHook), true);
  });
});

describe('isOrderSafeEnablerHook — order-unsafe hooks (WP-900 / D-24857)', () => {
  test('a hook condition not on the allowlist', () => {
    const rejectedTypes = [
      'heroClassMatch',
      'playedThisTurn',
      ...PLAY_HISTORY_CONDITION_TYPES,
      'bystandersInVictoryAtLeast',
      'patrolSpaceEmpty',
      'notARealCondition',
    ];
    for (const conditionType of rejectedTypes) {
      const hook = makeHook({ conditions: [{ type: conditionType, value: '1' }] });
      assert.equal(isOrderSafeEnablerHook(hook), false, `${conditionType} must not be order-safe`);
    }
  });

  test('an allowlisted condition beside a disallowed one', () => {
    const hook = makeHook({
      conditions: [
        { type: 'firstHeroPlayedThisTurn', value: '1' },
        { type: 'playedThisTurn', value: '8' },
      ],
    });
    assert.equal(isOrderSafeEnablerHook(hook), false);
  });

  test('a composition primitive', () => {
    const hook = makeHook({ primitiveEffects: [{ op: 'noop' }] as unknown as NonNullable<HeroAbilityHook['primitiveEffects']> });
    assert.equal(isOrderSafeEnablerHook(hook), false);
  });

  test('each rejecting effect field, alone on the baseline', () => {
    for (const [fieldName, hook] of Object.entries(REJECTING_EFFECT_FIELD_CASES)) {
      assert.equal(isOrderSafeEnablerHook(hook), false, `${fieldName} must make the hook order-unsafe`);
    }
  });

  test('a no-more-draws effect (Shenanigans)', () => {
    assert.equal(isOrderSafeEnablerHook(makeHook({ effects: [FLAT_ATTACK, { type: 'no-more-draws' }] })), false);
  });

  test('every rejected or recursed effect field has a case (keyset)', () => {
    const tableKeys: string[] = [];
    for (const [fieldName, safety] of Object.entries(ORDER_SAFETY_FIELD_TABLES.effectFields)) {
      if (safety !== 'safe') {
        tableKeys.push(fieldName);
      }
    }
    assert.deepEqual(tableKeys.sort(), Object.keys(REJECTING_EFFECT_FIELD_CASES).sort());
  });

  test('the hook table rejects or recurses exactly conditions, effects and primitiveEffects', () => {
    const tableKeys: string[] = [];
    for (const [fieldName, safety] of Object.entries(ORDER_SAFETY_FIELD_TABLES.hookFields)) {
      if (safety !== 'safe') {
        tableKeys.push(fieldName);
      }
    }
    assert.deepEqual(tableKeys.sort(), ['conditions', 'effects', 'primitiveEffects']);
  });
});
