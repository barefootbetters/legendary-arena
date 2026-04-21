import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createPrePlan,
  computeStateFingerprint,
  type PlayerStateSnapshot,
} from './preplanSandbox.js';

function buildSnapshot(overrides: Partial<PlayerStateSnapshot> = {}): PlayerStateSnapshot {
  return {
    playerId: '0',
    hand: ['card-a', 'card-b'],
    deck: ['card-c', 'card-d', 'card-e', 'card-f', 'card-g', 'card-h', 'card-i', 'card-j'],
    discard: [],
    counters: { attack: 0, recruit: 0 },
    currentTurn: 5,
    ...overrides,
  };
}

describe('preplan sandbox (WP-057)', () => {
  test("createPrePlan returns status 'active' with revision 1, empty ledger and steps", () => {
    const prePlan = createPrePlan(buildSnapshot(), 'plan-001', 42);
    assert.equal(prePlan.status, 'active');
    assert.equal(prePlan.revision, 1);
    assert.deepEqual(prePlan.revealLedger, []);
    assert.deepEqual(prePlan.planSteps, []);
    assert.equal(prePlan.invalidationReason, undefined);
  });

  test('appliesToTurn equals snapshot.currentTurn + 1', () => {
    const prePlan = createPrePlan(buildSnapshot({ currentTurn: 7 }), 'plan-002', 42);
    assert.equal(prePlan.appliesToTurn, 8);
  });

  test('deck is shuffled', () => {
    // why: seed 42 applied to this 8-card deck produces a non-identity
    // Fisher-Yates permutation under the WP-057 LCG — covers the
    // identity-permutation edge case that shorter decks could slip past
    // (RS-11 shuffle-fixture discipline).
    const snapshot = buildSnapshot();
    const prePlan = createPrePlan(snapshot, 'plan-003', 42);
    assert.notDeepEqual(prePlan.sandboxState.deck, snapshot.deck);
    assert.equal(prePlan.sandboxState.deck.length, snapshot.deck.length);
    const shuffledSet = new Set(prePlan.sandboxState.deck);
    const sourceSet = new Set(snapshot.deck);
    assert.equal(shuffledSet.size, sourceSet.size);
    for (const cardExtId of sourceSet) {
      assert.ok(shuffledSet.has(cardExtId));
    }
  });

  test('fingerprint is deterministic (same snapshot → same fingerprint)', () => {
    const snapshot = buildSnapshot();
    const firstFingerprint = computeStateFingerprint(snapshot);
    const secondFingerprint = computeStateFingerprint(snapshot);
    assert.equal(firstFingerprint, secondFingerprint);
  });

  test('fingerprint changes when hand contents differ', () => {
    const baseline = buildSnapshot({ hand: ['card-a', 'card-b'] });
    const divergent = buildSnapshot({ hand: ['card-a', 'card-z'] });
    const baselineFingerprint = computeStateFingerprint(baseline);
    const divergentFingerprint = computeStateFingerprint(divergent);
    assert.notEqual(baselineFingerprint, divergentFingerprint);
  });

  test('zero-op plan is valid', () => {
    const prePlan = createPrePlan(buildSnapshot(), 'plan-004', 42);
    assert.equal(prePlan.status, 'active');
    assert.deepEqual(prePlan.revealLedger, []);
    assert.deepEqual(prePlan.planSteps, []);
    assert.ok(prePlan.baseStateFingerprint.length > 0);
    assert.ok(prePlan.sandboxState.hand.length > 0);
    assert.ok(prePlan.sandboxState.deck.length > 0);
  });
});
