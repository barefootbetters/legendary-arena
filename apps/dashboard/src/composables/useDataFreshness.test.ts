import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';

import { useDataFreshness, type DataFreshnessSource } from './useDataFreshness.js';

// why: WP-527 — useDataFreshness starts a 5s setInterval that is cleared only in
// onUnmounted, which never fires outside a component instance. Mock setInterval so no
// real timer leaks and keeps the node:test process alive after the assertions run.

test('relativeTime is "Never" for null / undefined / NaN updatedAt (WP-527 / D-19804)', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    // why: the live /api/dash/* bare { data } envelope carries no updatedAt, so at
    // runtime it arrives undefined (or NaN) despite the number|null type — all must
    // read 'Never', never 'NaNh ago'.
    for (const absent of [null, undefined, Number.NaN]) {
      const { relativeTime } = useDataFreshness(
        ref(absent as number | null),
        ref<DataFreshnessSource | null>('MOCK'),
      );
      assert.equal(relativeTime.value, 'Never', `updatedAt=${String(absent)} must read Never`);
    }
  } finally {
    mock.timers.reset();
  }
});

test('relativeTime is a relative string for a finite recent updatedAt (WP-527)', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const { relativeTime } = useDataFreshness(
      ref(Date.now()),
      ref<DataFreshnessSource | null>('LIVE'),
    );
    assert.notEqual(relativeTime.value, 'Never');
    assert.match(relativeTime.value, /just now|ago/i);
  } finally {
    mock.timers.reset();
  }
});

test('sourceLabel is "" for null / undefined source and passes a present label through (WP-527 / D-19804)', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const nullSource = useDataFreshness(
      ref<number | null>(Date.now()),
      ref<DataFreshnessSource | null>(null),
    );
    assert.equal(nullSource.sourceLabel.value, '', 'null source -> no badge label');

    // why: the live envelope yields an undefined source (not just null); both hide
    // the badge via v-if="sourceLabel".
    const undefinedSource = useDataFreshness(
      ref<number | null>(Date.now()),
      ref(undefined as unknown as DataFreshnessSource | null),
    );
    assert.equal(undefinedSource.sourceLabel.value, '', 'undefined source -> no badge label');

    const mockSource = useDataFreshness(
      ref<number | null>(Date.now()),
      ref<DataFreshnessSource | null>('MOCK'),
    );
    assert.equal(mockSource.sourceLabel.value, 'MOCK', 'mock mode -> MOCK label');

    const liveSource = useDataFreshness(
      ref<number | null>(Date.now()),
      ref<DataFreshnessSource | null>('LIVE'),
    );
    assert.equal(liveSource.sourceLabel.value, 'LIVE', 'live source label passes through');
  } finally {
    mock.timers.reset();
  }
});
