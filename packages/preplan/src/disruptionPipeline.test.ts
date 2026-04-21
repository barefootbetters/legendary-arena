import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { PrePlan, RevealRecord } from './preplan.types.js';
import type { PlayerAffectingMutation } from './disruption.types.js';
import {
  invalidatePrePlan,
  computeSourceRestoration,
  buildDisruptionNotification,
  executeDisruptionPipeline,
} from './disruptionPipeline.js';
import { isPrePlanDisrupted } from './disruptionDetection.js';
import { createPrePlan } from './preplanSandbox.js';
import {
  speculativeDraw,
  speculativePlay,
  speculativeSharedDraw,
} from './speculativeOperations.js';

function buildActivePlan(overrides: Partial<PrePlan> = {}): PrePlan {
  return {
    prePlanId: 'plan-pipeline',
    revision: 7,
    playerId: '0',
    appliesToTurn: 9,
    status: 'active',
    baseStateFingerprint: 'fingerprint-xyz',
    sandboxState: {
      hand: ['card-a', 'card-b'],
      deck: ['card-c'],
      discard: ['card-x'],
      inPlay: [],
      counters: { attack: 3, recruit: 1 },
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

describe('preplan disruption pipeline (WP-058)', () => {
  // ---------- Invalidation ----------

  test('invalidatePrePlan on active plan sets status to invalidated', () => {
    const prePlan = buildActivePlan();
    const result = invalidatePrePlan(prePlan, buildMutation());
    assert.ok(result !== null);
    assert.equal(result.status, 'invalidated');
  });

  test('invalidatePrePlan populates invalidationReason from the mutation (with-card and without-card branches)', () => {
    // with-card branch
    const withCardPlan = buildActivePlan();
    const withCardMutation = buildMutation({
      sourcePlayerId: '2',
      effectType: 'ko',
      effectDescription: 'KO of a hero card on deck',
      affectedCardExtId: 'hero-wolverine',
    });
    const withCardResult = invalidatePrePlan(withCardPlan, withCardMutation);
    assert.ok(withCardResult !== null);
    assert.ok(withCardResult.invalidationReason !== undefined);
    assert.equal(withCardResult.invalidationReason.sourcePlayerId, '2');
    assert.equal(withCardResult.invalidationReason.effectType, 'ko');
    assert.equal(withCardResult.invalidationReason.effectDescription, 'KO of a hero card on deck');
    assert.equal(withCardResult.invalidationReason.affectedCardExtId, 'hero-wolverine');

    // without-card branch — conditional-assignment pattern omits the key entirely
    const noCardPlan = buildActivePlan();
    const noCardResult = invalidatePrePlan(noCardPlan, buildMutation());
    assert.ok(noCardResult !== null);
    assert.ok(noCardResult.invalidationReason !== undefined);
    assert.equal(
      Object.prototype.hasOwnProperty.call(noCardResult.invalidationReason, 'affectedCardExtId'),
      false,
    );
  });

  test('invalidatePrePlan returns null on non-active status', () => {
    const invalidatedPlan = buildActivePlan({ status: 'invalidated' });
    assert.equal(invalidatePrePlan(invalidatedPlan, buildMutation()), null);
    const consumedPlan = buildActivePlan({ status: 'consumed' });
    assert.equal(invalidatePrePlan(consumedPlan, buildMutation()), null);
  });

  test('invalidatePrePlan leaves input unmutated, revision unchanged, sandbox arrays fresh', () => {
    const prePlan = buildActivePlan();
    const originalHandRef = prePlan.sandboxState.hand;
    const originalDeckRef = prePlan.sandboxState.deck;
    const originalLedgerRef = prePlan.revealLedger;
    const originalPlanStepsRef = prePlan.planSteps;
    const originalRevision = prePlan.revision;
    const result = invalidatePrePlan(prePlan, buildMutation());
    assert.ok(result !== null);
    // revision not incremented
    assert.equal(result.revision, originalRevision);
    // input references unchanged
    assert.equal(prePlan.sandboxState.hand, originalHandRef);
    assert.equal(prePlan.sandboxState.deck, originalDeckRef);
    assert.equal(prePlan.revealLedger, originalLedgerRef);
    assert.equal(prePlan.planSteps, originalPlanStepsRef);
    // output arrays are fresh copies (reference-unequal to input)
    assert.notEqual(result.sandboxState.hand, prePlan.sandboxState.hand);
    assert.notEqual(result.sandboxState.deck, prePlan.sandboxState.deck);
    assert.notEqual(result.sandboxState.discard, prePlan.sandboxState.discard);
    assert.notEqual(result.sandboxState.inPlay, prePlan.sandboxState.inPlay);
    assert.notEqual(result.sandboxState.counters, prePlan.sandboxState.counters);
    assert.notEqual(result.revealLedger, prePlan.revealLedger);
    assert.notEqual(result.planSteps, prePlan.planSteps);
  });

  // ---------- Source restoration ----------

  test('computeSourceRestoration on empty ledger produces empty buckets', () => {
    const result = computeSourceRestoration([]);
    assert.deepEqual(result.playerDeckReturns, []);
    assert.deepEqual(result.sharedSourceReturns, {});
  });

  test('computeSourceRestoration collects player-deck reveals into playerDeckReturns', () => {
    const ledger: RevealRecord[] = [
      { source: 'player-deck', cardExtId: 'card-a', revealIndex: 0 },
      { source: 'player-deck', cardExtId: 'card-b', revealIndex: 1 },
    ];
    const result = computeSourceRestoration(ledger);
    assert.deepEqual(result.playerDeckReturns, ['card-a', 'card-b']);
    assert.deepEqual(result.sharedSourceReturns, {});
  });

  test('computeSourceRestoration collects non-player-deck reveals into sharedSourceReturns', () => {
    const ledger: RevealRecord[] = [
      { source: 'officer-stack', cardExtId: 'officer-1', revealIndex: 0 },
      { source: 'hq', cardExtId: 'hero-hq', revealIndex: 1 },
    ];
    const result = computeSourceRestoration(ledger);
    assert.deepEqual(result.playerDeckReturns, []);
    assert.deepEqual(result.sharedSourceReturns, {
      'officer-stack': ['officer-1'],
      hq: ['hero-hq'],
    });
  });

  test('computeSourceRestoration separates mixed sources into the correct buckets', () => {
    const ledger: RevealRecord[] = [
      { source: 'player-deck', cardExtId: 'card-a', revealIndex: 0 },
      { source: 'officer-stack', cardExtId: 'officer-1', revealIndex: 1 },
      { source: 'player-deck', cardExtId: 'card-b', revealIndex: 2 },
      { source: 'sidekick-stack', cardExtId: 'sidekick-1', revealIndex: 3 },
      { source: 'officer-stack', cardExtId: 'officer-2', revealIndex: 4 },
    ];
    const result = computeSourceRestoration(ledger);
    assert.deepEqual(result.playerDeckReturns, ['card-a', 'card-b']);
    assert.deepEqual(result.sharedSourceReturns, {
      'officer-stack': ['officer-1', 'officer-2'],
      'sidekick-stack': ['sidekick-1'],
    });
  });

  test('computeSourceRestoration preserves insertion order within each bucket', () => {
    const ledger: RevealRecord[] = [
      { source: 'hq', cardExtId: 'hq-1', revealIndex: 0 },
      { source: 'hq', cardExtId: 'hq-2', revealIndex: 1 },
      { source: 'hq', cardExtId: 'hq-3', revealIndex: 2 },
    ];
    const result = computeSourceRestoration(ledger);
    assert.deepEqual(result.sharedSourceReturns.hq, ['hq-1', 'hq-2', 'hq-3']);
  });

  test('computeSourceRestoration reads only revealLedger — sandbox contents are ignored (ledger-sole rewind)', () => {
    // Construct a plan whose sandboxState deliberately disagrees with the
    // ledger. DESIGN-CONSTRAINT #3 requires the ledger to win.
    const ledger: RevealRecord[] = [
      { source: 'player-deck', cardExtId: 'ledger-only-1', revealIndex: 0 },
      { source: 'officer-stack', cardExtId: 'ledger-only-2', revealIndex: 1 },
    ];
    const plan: PrePlan = buildActivePlan({
      sandboxState: {
        hand: ['other-1'],
        deck: ['other-2'],
        discard: [],
        inPlay: [],
        counters: {},
      },
      revealLedger: ledger,
    });
    const result = computeSourceRestoration(plan.revealLedger);
    assert.deepEqual(result.playerDeckReturns, ['ledger-only-1']);
    assert.deepEqual(result.sharedSourceReturns, {
      'officer-stack': ['ledger-only-2'],
    });
  });

  // ---------- Notification ----------

  test('buildDisruptionNotification populates prePlanId / affectedPlayerId / sourcePlayerId', () => {
    const invalidatedPlan = buildActivePlan({
      prePlanId: 'plan-n1',
      playerId: '0',
      status: 'invalidated',
      invalidationReason: {
        sourcePlayerId: '1',
        effectType: 'discard',
        effectDescription: 'ignored here',
      },
    });
    const mutation = buildMutation({
      sourcePlayerId: '1',
      affectedPlayerId: '0',
      effectDescription: 'forced discard',
    });
    const result = buildDisruptionNotification(invalidatedPlan, mutation);
    assert.equal(result.prePlanId, 'plan-n1');
    assert.equal(result.affectedPlayerId, '0');
    assert.equal(result.sourcePlayerId, '1');
  });

  test('buildDisruptionNotification message includes the effect description', () => {
    const invalidatedPlan = buildActivePlan({
      status: 'invalidated',
      invalidationReason: {
        sourcePlayerId: '1',
        effectType: 'ko',
        effectDescription: 'KO of top deck card',
      },
    });
    const mutation = buildMutation({
      effectType: 'ko',
      effectDescription: 'KO of top deck card',
    });
    const result = buildDisruptionNotification(invalidatedPlan, mutation);
    assert.ok(result.message.includes('KO of top deck card'));
  });

  test('buildDisruptionNotification message includes card when mutation carries affectedCardExtId', () => {
    const invalidatedPlan = buildActivePlan({
      status: 'invalidated',
      invalidationReason: {
        sourcePlayerId: '1',
        effectType: 'ko',
        effectDescription: 'KO of hero-wolverine',
        affectedCardExtId: 'hero-wolverine',
      },
    });
    const mutation = buildMutation({
      effectDescription: 'KO of hero-wolverine',
      affectedCardExtId: 'hero-wolverine',
    });
    const result = buildDisruptionNotification(invalidatedPlan, mutation);
    assert.ok(result.message.includes('hero-wolverine'));
    assert.equal(result.affectedCardExtId, 'hero-wolverine');
  });

  test('buildDisruptionNotification omits affectedCardExtId when mutation carries no card', () => {
    const invalidatedPlan = buildActivePlan({
      status: 'invalidated',
      invalidationReason: {
        sourcePlayerId: '1',
        effectType: 'discard',
        effectDescription: 'forced discard',
      },
    });
    const result = buildDisruptionNotification(invalidatedPlan, buildMutation());
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'affectedCardExtId'), false);
    assert.ok(!result.message.includes('('));
  });

  test('buildDisruptionNotification throws when status is not invalidated', () => {
    const activePlan = buildActivePlan({ status: 'active' });
    assert.throws(
      () => buildDisruptionNotification(activePlan, buildMutation()),
      /expected 'invalidated'/,
    );
    const consumedPlan = buildActivePlan({ status: 'consumed' });
    assert.throws(
      () => buildDisruptionNotification(consumedPlan, buildMutation()),
      /expected 'invalidated'/,
    );
  });

  // ---------- Full pipeline ----------

  test('executeDisruptionPipeline on active matching plan returns full result with requiresImmediateNotification: true', () => {
    const prePlan = buildActivePlan();
    const result = executeDisruptionPipeline(prePlan, buildMutation());
    assert.ok(result !== null);
    assert.equal(result.requiresImmediateNotification, true);
    assert.ok(result.invalidatedPlan !== undefined);
    assert.ok(result.sourceRestoration !== undefined);
    assert.ok(result.notification !== undefined);
  });

  test('executeDisruptionPipeline returns null when invalidatePrePlan returns null (non-active)', () => {
    const invalidatedPlan = buildActivePlan({ status: 'invalidated' });
    assert.equal(executeDisruptionPipeline(invalidatedPlan, buildMutation()), null);
    const consumedPlan = buildActivePlan({ status: 'consumed' });
    assert.equal(executeDisruptionPipeline(consumedPlan, buildMutation()), null);
  });

  test('executeDisruptionPipeline result.invalidatedPlan.status is invalidated', () => {
    const result = executeDisruptionPipeline(buildActivePlan(), buildMutation());
    assert.ok(result !== null);
    assert.equal(result.invalidatedPlan.status, 'invalidated');
  });

  test('executeDisruptionPipeline result.sourceRestoration matches the input ledger', () => {
    const ledger: RevealRecord[] = [
      { source: 'player-deck', cardExtId: 'card-a', revealIndex: 0 },
      { source: 'officer-stack', cardExtId: 'officer-1', revealIndex: 1 },
    ];
    const prePlan = buildActivePlan({ revealLedger: ledger });
    const result = executeDisruptionPipeline(prePlan, buildMutation());
    assert.ok(result !== null);
    assert.deepEqual(result.sourceRestoration.playerDeckReturns, ['card-a']);
    assert.deepEqual(result.sourceRestoration.sharedSourceReturns, {
      'officer-stack': ['officer-1'],
    });
  });

  test('executeDisruptionPipeline result.notification.message includes the cause', () => {
    const prePlan = buildActivePlan();
    const mutation = buildMutation({ effectDescription: 'KO of a hero card' });
    const result = executeDisruptionPipeline(prePlan, mutation);
    assert.ok(result !== null);
    assert.ok(result.notification.message.includes('KO of a hero card'));
  });

  test('executeDisruptionPipeline on multiple mutations for same player: first succeeds, second returns null', () => {
    const prePlan = buildActivePlan();
    const firstResult = executeDisruptionPipeline(prePlan, buildMutation({ effectType: 'discard' }));
    assert.ok(firstResult !== null);
    const secondResult = executeDisruptionPipeline(
      firstResult.invalidatedPlan,
      buildMutation({ effectType: 'ko' }),
    );
    assert.equal(secondResult, null);
  });

  test('caller gates the pipeline via isPrePlanDisrupted — active+non-matching returns false and the pipeline is not invoked', () => {
    // Caller pattern: detect first; only call the pipeline when detection
    // returns true. For a non-matching mutation (affectedPlayerId !==
    // prePlan.playerId), detection returns false and the caller never
    // reaches executeDisruptionPipeline. The plan remains active.
    const prePlan = buildActivePlan({ playerId: '0' });
    const nonMatchingMutation = buildMutation({ affectedPlayerId: '1' });
    assert.equal(isPrePlanDisrupted(prePlan, nonMatchingMutation), false);
    // Sanity: if a caller skipped detection and invoked the pipeline anyway,
    // the pipeline does not enforce ownership — it would still invalidate.
    // Detection is the ownership gate; the pipeline is the tear-down.
    assert.equal(prePlan.status, 'active');
  });

  // ---------- Acceptance scenario ----------

  test('acceptance: create → speculativeDraw → speculativePlay → disrupt → verify', () => {
    const snapshot = {
      playerId: '0',
      hand: ['starter-a', 'starter-b'],
      deck: ['deck-c', 'deck-d'],
      discard: [] as string[],
      counters: { attack: 0, recruit: 0 },
      currentTurn: 3,
    };
    const prePlan = createPrePlan(snapshot, 'plan-acceptance', 1234);

    const afterDraw = speculativeDraw(prePlan);
    assert.ok(afterDraw !== null);

    const afterPlay = speculativePlay(afterDraw.updatedPlan, 'starter-a');
    assert.ok(afterPlay !== null);

    const afterShared = speculativeSharedDraw(afterPlay, 'hq', 'hq-reveal-1');
    assert.ok(afterShared !== null);

    const mutation = buildMutation({
      sourcePlayerId: '1',
      affectedPlayerId: '0',
      effectType: 'discard',
      effectDescription: 'forced discard of a hero',
    });
    const result = executeDisruptionPipeline(afterShared, mutation);
    assert.ok(result !== null);
    assert.equal(result.invalidatedPlan.status, 'invalidated');
    assert.equal(result.requiresImmediateNotification, true);

    // The player-deck return comes from the sandbox draw; the hq return
    // comes from the shared draw. Verify both are derived from the ledger.
    assert.equal(result.sourceRestoration.playerDeckReturns.length, 1);
    const [playerDeckCard] = result.sourceRestoration.playerDeckReturns;
    assert.equal(typeof playerDeckCard, 'string');
    assert.deepEqual(result.sourceRestoration.sharedSourceReturns.hq, ['hq-reveal-1']);
  });
});
