import '../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { usePreplanStore } from './preplan';
import {
  activePrePlanFixture,
  invalidatedPrePlanFixture,
  sampleDisruptionResultFixture,
} from '../fixtures/preplan/index';

describe('usePreplanStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('initial state has current and lastNotification both null', () => {
    const store = usePreplanStore();
    assert.equal(store.current, null);
    assert.equal(store.lastNotification, null);
    assert.equal(Object.keys(store.$state).length, 2);
  });

  test('startPlan installs the supplied plan as current', () => {
    const store = usePreplanStore();
    store.startPlan(activePrePlanFixture);
    assert.deepStrictEqual(store.current, activePrePlanFixture);
  });

  test('startPlan throws when called a second time on an active plan', () => {
    const store = usePreplanStore();
    store.startPlan(activePrePlanFixture);
    assert.throws(
      () => {
        store.startPlan(activePrePlanFixture);
      },
      (error: unknown) => {
        return (
          error instanceof Error &&
          error.message.includes(
            'Cannot start a plan while another plan is active',
          )
        );
      },
    );
  });

  test('consumePlan on an active plan sets status to consumed and preserves every other field', () => {
    const store = usePreplanStore();
    store.startPlan(activePrePlanFixture);
    store.consumePlan();
    assert.notEqual(store.current, null);
    const after = store.current;
    assert.notEqual(after, null);
    if (after === null) return;
    assert.equal(after.status, 'consumed');
    // why: deep-equal every PrePlan field except `status` against the
    // active fixture. Field list mirrors the canonical PrePlan type at
    // packages/preplan/src/preplan.types.ts:29-116; revision is preserved
    // unchanged because status transitions are not in the revision-bump
    // list (preplan.types.ts:33-46).
    assert.equal(after.prePlanId, activePrePlanFixture.prePlanId);
    assert.equal(after.revision, activePrePlanFixture.revision);
    assert.equal(after.playerId, activePrePlanFixture.playerId);
    assert.equal(after.appliesToTurn, activePrePlanFixture.appliesToTurn);
    assert.equal(
      after.baseStateFingerprint,
      activePrePlanFixture.baseStateFingerprint,
    );
    assert.deepStrictEqual(
      after.sandboxState,
      activePrePlanFixture.sandboxState,
    );
    assert.deepStrictEqual(
      after.revealLedger,
      activePrePlanFixture.revealLedger,
    );
    assert.deepStrictEqual(after.planSteps, activePrePlanFixture.planSteps);
  });

  test('consumePlan when current is null is a no-op', () => {
    const store = usePreplanStore();
    store.consumePlan();
    assert.equal(store.current, null);
  });

  test('consumePlan on an already-invalidated plan is a no-op', () => {
    const store = usePreplanStore();
    store.startPlan(invalidatedPrePlanFixture);
    store.consumePlan();
    assert.notEqual(store.current, null);
    if (store.current === null) return;
    assert.equal(store.current.status, 'invalidated');
  });

  test('recordDisruption sets lastNotification to the result notification', () => {
    const store = usePreplanStore();
    store.recordDisruption(sampleDisruptionResultFixture);
    assert.deepStrictEqual(
      store.lastNotification,
      sampleDisruptionResultFixture.notification,
    );
  });

  test('recordDisruption on an active plan transitions current.status to invalidated', () => {
    const store = usePreplanStore();
    store.startPlan(activePrePlanFixture);
    store.recordDisruption(sampleDisruptionResultFixture);
    assert.notEqual(store.current, null);
    if (store.current === null) return;
    assert.equal(store.current.status, 'invalidated');
  });

  test('recordDisruption on an already-invalidated plan still updates lastNotification', () => {
    const store = usePreplanStore();
    store.startPlan(invalidatedPrePlanFixture);
    store.recordDisruption(sampleDisruptionResultFixture);
    assert.deepStrictEqual(
      store.lastNotification,
      sampleDisruptionResultFixture.notification,
    );
    assert.notEqual(store.current, null);
    if (store.current === null) return;
    assert.equal(store.current.status, 'invalidated');
  });

  test('dismissNotification clears lastNotification and does not touch current', () => {
    const store = usePreplanStore();
    store.startPlan(activePrePlanFixture);
    store.recordDisruption(sampleDisruptionResultFixture);
    store.dismissNotification();
    assert.equal(store.lastNotification, null);
    assert.notEqual(store.current, null);
  });

  test('clearPlan clears both current and lastNotification', () => {
    const store = usePreplanStore();
    store.startPlan(activePrePlanFixture);
    store.recordDisruption(sampleDisruptionResultFixture);
    store.clearPlan();
    assert.equal(store.current, null);
    assert.equal(store.lastNotification, null);
  });

  test('isActive reflects every status correctly', () => {
    const store = usePreplanStore();
    assert.equal(store.isActive, false);

    store.startPlan(activePrePlanFixture);
    assert.equal(store.isActive, true);

    store.consumePlan();
    assert.equal(store.isActive, false);

    store.clearPlan();
    store.startPlan(invalidatedPrePlanFixture);
    assert.equal(store.isActive, false);
  });

  test('determinism: starting the same fixture twice (with clearPlan in between) produces byte-equal store state', () => {
    const store = usePreplanStore();
    store.startPlan(activePrePlanFixture);
    const firstSerialization = JSON.stringify(store.$state);
    store.clearPlan();
    store.startPlan(activePrePlanFixture);
    const secondSerialization = JSON.stringify(store.$state);
    assert.equal(firstSerialization, secondSerialization);
  });
});
