import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { PrePlan } from './preplan.types.js';
import { PREPLAN_STATUS_VALUES } from './preplanStatus.js';

describe('preplan status drift (WP-057)', () => {
  test("PREPLAN_STATUS_VALUES matches PrePlan['status'] union exactly", () => {
    const expected: Set<PrePlan['status']> = new Set(['active', 'invalidated', 'consumed']);
    assert.equal(PREPLAN_STATUS_VALUES.length, 3);
    const actual = new Set(PREPLAN_STATUS_VALUES);
    for (const value of expected) {
      assert.ok(actual.has(value), `expected PREPLAN_STATUS_VALUES to contain ${value}`);
    }
    for (const value of actual) {
      assert.ok(expected.has(value), `unexpected value ${value} in PREPLAN_STATUS_VALUES`);
    }
  });
});
