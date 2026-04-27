import '../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import {
  createPrePlan,
  type PlayerStateSnapshot,
} from '@legendary-arena/preplan';
import { usePreplanStore } from '../stores/preplan';
import {
  applyDisruptionToStore,
  startPrePlanForActiveViewer,
} from './preplanLifecycle';
import {
  activePrePlanFixture,
  sampleDisruptionResultFixture,
  sampleDisruptionResultWithCardFixture,
  samplePlayerStateSnapshotFixture,
} from '../fixtures/preplan/index';

// why: compile-time drift sentinel. If createPrePlan's parameter
// list drifts (WP-057 adds, removes, renames, or reorders any of
// the three positional parameters: snapshot, prePlanId, prngSeed),
// this assignment fails typecheck before any runtime test has to
// catch it. Mirrors the preplanStatus.ts:25-31 drift-proof pattern.
// Zero runtime cost — the value is asserted at type level only.
type _ExpectedCreatePrePlanParams = [
  PlayerStateSnapshot,
  string,
  number,
];
type _ActualCreatePrePlanParams = Parameters<typeof createPrePlan>;
type _CreatePrePlanDriftCheck =
  _ActualCreatePrePlanParams extends _ExpectedCreatePrePlanParams
    ? _ExpectedCreatePrePlanParams extends _ActualCreatePrePlanParams
      ? true
      : never
    : never;
const _createPrePlanDriftProof: _CreatePrePlanDriftCheck = true;
void _createPrePlanDriftProof;

describe('preplanLifecycle adapters', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('startPrePlanForActiveViewer installs an active plan into a fresh store', () => {
    const store = usePreplanStore();
    startPrePlanForActiveViewer({
      snapshot: samplePlayerStateSnapshotFixture,
      prePlanId: 'wp059-lifecycle-test-1',
      prngSeed: 42,
      store,
    });
    assert.notEqual(store.current, null);
    if (store.current === null) return;
    assert.equal(store.current.status, 'active');
  });

  test('startPrePlanForActiveViewer called twice on the same store throws on the second call', () => {
    const store = usePreplanStore();
    startPrePlanForActiveViewer({
      snapshot: samplePlayerStateSnapshotFixture,
      prePlanId: 'wp059-lifecycle-test-2a',
      prngSeed: 42,
      store,
    });
    assert.throws(() => {
      startPrePlanForActiveViewer({
        snapshot: samplePlayerStateSnapshotFixture,
        prePlanId: 'wp059-lifecycle-test-2b',
        prngSeed: 43,
        store,
      });
    });
  });

  test('applyDisruptionToStore on a fresh store updates lastNotification and leaves current null', () => {
    const store = usePreplanStore();
    applyDisruptionToStore({ store, result: sampleDisruptionResultFixture });
    assert.deepStrictEqual(
      store.lastNotification,
      sampleDisruptionResultFixture.notification,
    );
    assert.equal(store.current, null);
  });

  test('applyDisruptionToStore on an active plan replaces current with result.invalidatedPlan', () => {
    const store = usePreplanStore();
    store.startPlan(activePrePlanFixture);
    applyDisruptionToStore({ store, result: sampleDisruptionResultFixture });
    assert.deepStrictEqual(
      store.current,
      sampleDisruptionResultFixture.invalidatedPlan,
    );
    assert.deepStrictEqual(
      store.lastNotification,
      sampleDisruptionResultFixture.notification,
    );
  });

  test('determinism: two runs against same snapshot/prePlanId/prngSeed produce byte-equal store state', () => {
    setActivePinia(createPinia());
    const firstStore = usePreplanStore();
    startPrePlanForActiveViewer({
      snapshot: samplePlayerStateSnapshotFixture,
      prePlanId: 'wp059-determinism',
      prngSeed: 1234,
      store: firstStore,
    });
    const firstSerialization = JSON.stringify(firstStore.$state);

    setActivePinia(createPinia());
    const secondStore = usePreplanStore();
    startPrePlanForActiveViewer({
      snapshot: samplePlayerStateSnapshotFixture,
      prePlanId: 'wp059-determinism',
      prngSeed: 1234,
      store: secondStore,
    });
    const secondSerialization = JSON.stringify(secondStore.$state);

    assert.equal(firstSerialization, secondSerialization);
  });

  test('privacy: startPrePlanForActiveViewer never registers a $subscribe listener', () => {
    const store = usePreplanStore();
    let subscribeCallCount = 0;
    const original$subscribe = store.$subscribe.bind(store);
    // why: monkey-patches $subscribe with a counter so that an accidental
    // subscription registration in the adapter (which would broadcast
    // store changes outside the privacy boundary) fails this test.
    // Production code under apps/arena-client/src/preplan/** must not
    // register subscriptions; only test files (this exception) reference
    // $subscribe.
    type SubscribeFn = typeof store.$subscribe;
    store.$subscribe = ((
      ...args: Parameters<SubscribeFn>
    ): ReturnType<SubscribeFn> => {
      subscribeCallCount += 1;
      return original$subscribe(...args);
    }) as SubscribeFn;

    startPrePlanForActiveViewer({
      snapshot: samplePlayerStateSnapshotFixture,
      prePlanId: 'wp059-privacy',
      prngSeed: 7,
      store,
    });

    assert.equal(subscribeCallCount, 0);
  });

  test('notification overwrite: two applyDisruptionToStore calls leave lastNotification equal to the second', () => {
    const store = usePreplanStore();
    store.startPlan(activePrePlanFixture);
    applyDisruptionToStore({ store, result: sampleDisruptionResultFixture });
    applyDisruptionToStore({
      store,
      result: sampleDisruptionResultWithCardFixture,
    });
    assert.deepStrictEqual(
      store.lastNotification,
      sampleDisruptionResultWithCardFixture.notification,
    );
  });
});
