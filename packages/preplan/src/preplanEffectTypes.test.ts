import { describe, test } from 'node:test';
import { deepStrictEqual } from 'node:assert/strict';
import { PREPLAN_EFFECT_TYPES } from './preplanEffectTypes.js';
import type { PrePlanEffectType } from './preplanEffectTypes.js';

describe('preplan effect-type drift (WP-058)', () => {
  test('PREPLAN_EFFECT_TYPES matches PrePlanEffectType set exactly', () => {
    const expected = new Set<PrePlanEffectType>(['discard', 'ko', 'gain', 'other']);
    const actual = new Set(PREPLAN_EFFECT_TYPES);
    deepStrictEqual(actual, expected);
  });
});
