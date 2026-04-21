import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { PrePlan } from './preplan.types.js';
import type { PlayerAffectingMutation } from './disruption.types.js';
import { isPrePlanDisrupted } from './disruptionDetection.js';

function buildActivePlan(overrides: Partial<PrePlan> = {}): PrePlan {
  return {
    prePlanId: 'plan-detect',
    revision: 1,
    playerId: '0',
    appliesToTurn: 4,
    status: 'active',
    baseStateFingerprint: 'abc123',
    sandboxState: {
      hand: [],
      deck: [],
      discard: [],
      inPlay: [],
      counters: {},
    },
    revealLedger: [],
    planSteps: [],
    ...overrides,
  };
}

function buildMutation(overrides: Partial<PlayerAffectingMutation> = {}): PlayerAffectingMutation {
  return {
    sourcePlayerId: '1',
    affectedPlayerId: '0',
    effectType: 'discard',
    effectDescription: 'forced discard of a random hero card',
    ...overrides,
  };
}

describe('preplan disruption detection (WP-058)', () => {
  test('active plan owned by the affected player is disrupted (true)', () => {
    const prePlan = buildActivePlan({ playerId: '0' });
    const mutation = buildMutation({ affectedPlayerId: '0' });
    assert.equal(isPrePlanDisrupted(prePlan, mutation), true);
  });

  test('active plan owned by a different player is not disrupted (false)', () => {
    const prePlan = buildActivePlan({ playerId: '0' });
    const mutation = buildMutation({ affectedPlayerId: '1' });
    assert.equal(isPrePlanDisrupted(prePlan, mutation), false);
  });

  test('null pre-plan is never disrupted (false)', () => {
    const mutation = buildMutation({ affectedPlayerId: '0' });
    assert.equal(isPrePlanDisrupted(null, mutation), false);
  });

  test('already-invalidated plan is not re-disrupted (false)', () => {
    const prePlan = buildActivePlan({ playerId: '0', status: 'invalidated' });
    const mutation = buildMutation({ affectedPlayerId: '0' });
    assert.equal(isPrePlanDisrupted(prePlan, mutation), false);
  });

  test('already-consumed plan is not disrupted (false)', () => {
    const prePlan = buildActivePlan({ playerId: '0', status: 'consumed' });
    const mutation = buildMutation({ affectedPlayerId: '0' });
    assert.equal(isPrePlanDisrupted(prePlan, mutation), false);
  });
});
