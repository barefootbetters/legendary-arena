import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { PrePlan } from './preplan.types.js';
import {
  speculativeDraw,
  speculativePlay,
  updateSpeculativeCounter,
  addPlanStep,
  speculativeSharedDraw,
} from './speculativeOperations.js';

function buildActivePlan(overrides: Partial<PrePlan> = {}): PrePlan {
  return {
    prePlanId: 'plan-test',
    revision: 1,
    playerId: '0',
    appliesToTurn: 6,
    status: 'active',
    baseStateFingerprint: 'deadbeef',
    sandboxState: {
      hand: ['card-a', 'card-b'],
      deck: ['card-c', 'card-d'],
      discard: ['card-x'],
      inPlay: [],
      counters: { attack: 2, recruit: 1 },
    },
    revealLedger: [],
    planSteps: [],
    ...overrides,
  };
}

describe('preplan speculative operations (WP-057)', () => {
  test('speculativeDraw moves top card from deck to hand', () => {
    const prePlan = buildActivePlan();
    const result = speculativeDraw(prePlan);
    assert.ok(result !== null);
    assert.equal(result.drawnCard, 'card-c');
    assert.deepEqual(result.updatedPlan.sandboxState.hand, ['card-a', 'card-b', 'card-c']);
    assert.deepEqual(result.updatedPlan.sandboxState.deck, ['card-d']);
  });

  test("speculativeDraw appends RevealRecord with source 'player-deck' and monotonic revealIndex", () => {
    const firstDraw = speculativeDraw(buildActivePlan());
    assert.ok(firstDraw !== null);
    assert.equal(firstDraw.updatedPlan.revealLedger.length, 1);
    assert.deepEqual(firstDraw.updatedPlan.revealLedger[0], {
      source: 'player-deck',
      cardExtId: 'card-c',
      revealIndex: 0,
    });
    const secondDraw = speculativeDraw(firstDraw.updatedPlan);
    assert.ok(secondDraw !== null);
    assert.equal(secondDraw.updatedPlan.revealLedger.length, 2);
    const secondLedgerEntry = secondDraw.updatedPlan.revealLedger[1];
    assert.ok(secondLedgerEntry !== undefined);
    assert.equal(secondLedgerEntry.revealIndex, 1);
  });

  test('speculativeDraw returns null when deck is empty', () => {
    const prePlan = buildActivePlan({
      sandboxState: {
        hand: ['card-a'],
        deck: [],
        discard: [],
        inPlay: [],
        counters: {},
      },
    });
    const result = speculativeDraw(prePlan);
    assert.equal(result, null);
  });

  test("speculativeDraw returns null when status is not 'active'", () => {
    const result = speculativeDraw(buildActivePlan({ status: 'invalidated' }));
    assert.equal(result, null);
  });

  test('speculativePlay moves card from hand to inPlay', () => {
    const prePlan = buildActivePlan();
    const result = speculativePlay(prePlan, 'card-a');
    assert.ok(result !== null);
    assert.deepEqual(result.sandboxState.hand, ['card-b']);
    assert.deepEqual(result.sandboxState.inPlay, ['card-a']);
  });

  test('speculativePlay returns null when card is not in hand', () => {
    const result = speculativePlay(buildActivePlan(), 'card-missing');
    assert.equal(result, null);
  });

  test('updateSpeculativeCounter adds delta to named counter', () => {
    const result = updateSpeculativeCounter(buildActivePlan(), 'attack', 3);
    assert.ok(result !== null);
    assert.equal(result.sandboxState.counters.attack, 5);
    assert.equal(result.sandboxState.counters.recruit, 1);
  });

  test('updateSpeculativeCounter creates counter if missing', () => {
    const result = updateSpeculativeCounter(buildActivePlan(), 'fresh-counter', 7);
    assert.ok(result !== null);
    assert.equal(result.sandboxState.counters['fresh-counter'], 7);
  });

  test('addPlanStep appends step with isValid: true', () => {
    const result = addPlanStep(buildActivePlan(), {
      intent: 'playCard',
      targetCardExtId: 'card-a',
      description: 'play card-a first',
    });
    assert.ok(result !== null);
    assert.equal(result.planSteps.length, 1);
    const firstStep = result.planSteps[0];
    assert.ok(firstStep !== undefined);
    assert.equal(firstStep.isValid, true);
    assert.equal(firstStep.intent, 'playCard');
    assert.equal(firstStep.targetCardExtId, 'card-a');
  });

  test('speculativeSharedDraw adds card to hand and records source in ledger', () => {
    const result = speculativeSharedDraw(buildActivePlan(), 'officer-stack', 'card-officer');
    assert.ok(result !== null);
    assert.deepEqual(result.sandboxState.hand, ['card-a', 'card-b', 'card-officer']);
    assert.equal(result.revealLedger.length, 1);
    assert.deepEqual(result.revealLedger[0], {
      source: 'officer-stack',
      cardExtId: 'card-officer',
      revealIndex: 0,
    });
  });

  test('no operation mutates input PrePlan across 3 sequential operations', () => {
    const originalPlan = buildActivePlan();
    const originalSnapshot = JSON.parse(JSON.stringify(originalPlan));
    const afterDraw = speculativeDraw(originalPlan);
    assert.ok(afterDraw !== null);
    const afterPlay = speculativePlay(afterDraw.updatedPlan, 'card-a');
    assert.ok(afterPlay !== null);
    const afterCounter = updateSpeculativeCounter(afterPlay, 'attack', 1);
    assert.ok(afterCounter !== null);
    assert.deepEqual(originalPlan, originalSnapshot);
  });

  test("all five operations return null when status is 'invalidated' or 'consumed'", () => {
    const invalidated = buildActivePlan({ status: 'invalidated' });
    const consumed = buildActivePlan({ status: 'consumed' });
    assert.equal(speculativeDraw(invalidated), null);
    assert.equal(speculativePlay(invalidated, 'card-a'), null);
    assert.equal(updateSpeculativeCounter(invalidated, 'attack', 1), null);
    assert.equal(addPlanStep(invalidated, { intent: 'playCard', description: 'x' }), null);
    assert.equal(speculativeSharedDraw(invalidated, 'hq', 'card-x'), null);
    assert.equal(speculativeDraw(consumed), null);
    assert.equal(speculativePlay(consumed, 'card-a'), null);
    assert.equal(updateSpeculativeCounter(consumed, 'attack', 1), null);
    assert.equal(addPlanStep(consumed, { intent: 'playCard', description: 'x' }), null);
    assert.equal(speculativeSharedDraw(consumed, 'hq', 'card-x'), null);
  });

  test('revision increments by exactly 1 on each successful mutation and 0 on null-return paths across all five operations', () => {
    const activePlan = buildActivePlan();
    const invalidatedPlan = buildActivePlan({ status: 'invalidated' });

    const drawResult = speculativeDraw(activePlan);
    assert.ok(drawResult !== null);
    assert.equal(drawResult.updatedPlan.revision, activePlan.revision + 1);

    const playResult = speculativePlay(activePlan, 'card-a');
    assert.ok(playResult !== null);
    assert.equal(playResult.revision, activePlan.revision + 1);

    const counterResult = updateSpeculativeCounter(activePlan, 'attack', 1);
    assert.ok(counterResult !== null);
    assert.equal(counterResult.revision, activePlan.revision + 1);

    const stepResult = addPlanStep(activePlan, { intent: 'playCard', description: 'x' });
    assert.ok(stepResult !== null);
    assert.equal(stepResult.revision, activePlan.revision + 1);

    const sharedResult = speculativeSharedDraw(activePlan, 'hq', 'card-hq-1');
    assert.ok(sharedResult !== null);
    assert.equal(sharedResult.revision, activePlan.revision + 1);

    assert.equal(speculativeDraw(invalidatedPlan), null);
    assert.equal(speculativePlay(invalidatedPlan, 'card-a'), null);
    assert.equal(updateSpeculativeCounter(invalidatedPlan, 'attack', 1), null);
    assert.equal(addPlanStep(invalidatedPlan, { intent: 'playCard', description: 'x' }), null);
    assert.equal(speculativeSharedDraw(invalidatedPlan, 'hq', 'card-hq-1'), null);
    assert.equal(invalidatedPlan.revision, 1);
  });
});
