import '../testing/jsdom-setup';

/**
 * useOperatorBoard tests (WP-804 / EC-841).
 *
 * Mounts the composable in a tiny host component (it stops on unmount) against
 * a stubbed `globalThis.fetch`, a real Pinia auth store and node:test mock
 * timers: it polls every 3000 ms only while expanded, stops on collapse and on
 * unmount, keeps the last board on an error, never runs two chains after a
 * collapse → expand or a refresh mid-flight, and never lets a stale response
 * overwrite a newer board. Also pins `buildOperatorFileName`.
 */

import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { defineComponent, ref, type Ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';

import {
  OPERATOR_BOARD_POLL_MS,
  buildOperatorFileName,
  useOperatorBoard,
  type OperatorBoardState,
} from './useOperatorBoard';
import { useAuthStore } from '../stores/auth';
import type { OperatorBoardResponse } from '../lib/api/operatorMatchApi';

const originalFetch = globalThis.fetch;

/**
 * A minimal board body, told apart by its `matchId` marker.
 *
 * @param marker The value to carry in `matchId`.
 * @returns A board response stand-in.
 */
function boardBody(marker: string): OperatorBoardResponse {
  return { matchId: marker, operatorView: {}, botDecisions: [] } as unknown as OperatorBoardResponse;
}

interface BoardFetchStub {
  /** How many board requests were made. */
  count: () => number;
  /** Resolve the pending request at `index` with a 200 board. */
  resolveWith: (index: number, marker: string) => void;
  /** Answer every future request (and every pending one) immediately. */
  autoResolve: (marker: string) => void;
}

/**
 * Stub fetch so board requests stay pending until the test answers them, or
 * answer at once after `autoResolve`.
 *
 * @returns The stub controls.
 */
function stubBoardFetch(): BoardFetchStub {
  const pending: ((response: Response) => void)[] = [];
  let autoMarker: string | null = null;
  let requestCount = 0;
  const okResponse = (marker: string): Response =>
    ({ ok: true, status: 200, json: async () => boardBody(marker) }) as unknown as Response;
  globalThis.fetch = (() => {
    requestCount += 1;
    if (autoMarker !== null) {
      return Promise.resolve(okResponse(autoMarker));
    }
    return new Promise<Response>((resolve) => {
      pending.push(resolve);
    });
  }) as typeof globalThis.fetch;
  return {
    count: () => requestCount,
    resolveWith: (index, marker) => pending[index]!(okResponse(marker)),
    autoResolve: (marker) => {
      autoMarker = marker;
      for (const resolve of pending) {
        resolve(okResponse(marker));
      }
    },
  };
}

/**
 * Mount the composable in a host component.
 *
 * @param isExpanded The panel's open flag.
 * @returns The mounted wrapper and the composable's state.
 */
function mountBoard(isExpanded: Ref<boolean>) {
  let state: OperatorBoardState | null = null;
  const Host = defineComponent({
    setup() {
      state = useOperatorBoard('op-match-1', isExpanded);
      return {};
    },
    render() {
      return null;
    },
  });
  const wrapper = mount(Host);
  return { wrapper, state: state! as OperatorBoardState };
}

beforeEach(() => {
  setActivePinia(createPinia());
  useAuthStore().setSession('admin-token', null);
  mock.timers.enable({ apis: ['setTimeout'] });
});

afterEach(() => {
  mock.timers.reset();
  globalThis.fetch = originalFetch;
});

describe('useOperatorBoard (WP-804)', () => {
  test('polls every 3000 ms only while expanded, and stops when collapsed and on unmount', async () => {
    const stub = stubBoardFetch();
    stub.autoResolve('board');
    const isExpanded = ref(true);
    const { wrapper, state } = mountBoard(isExpanded);
    await flushPromises();
    assert.equal(stub.count(), 1, 'an immediate poll on open');
    assert.equal(state.board.value?.matchId, 'board');

    mock.timers.tick(OPERATOR_BOARD_POLL_MS);
    await flushPromises();
    assert.equal(stub.count(), 2);

    isExpanded.value = false;
    await flushPromises();
    mock.timers.tick(OPERATOR_BOARD_POLL_MS * 3);
    await flushPromises();
    assert.equal(stub.count(), 2, 'no board request while collapsed');

    isExpanded.value = true;
    await flushPromises();
    assert.equal(stub.count(), 3, 'expanding restarts the poll');

    wrapper.unmount();
    mock.timers.tick(OPERATOR_BOARD_POLL_MS * 3);
    await flushPromises();
    assert.equal(stub.count(), 3, 'no board request after unmount');
  });

  test('a collapsed panel makes no request at all', async () => {
    const stub = stubBoardFetch();
    stub.autoResolve('board');
    mountBoard(ref(false));
    await flushPromises();
    mock.timers.tick(OPERATOR_BOARD_POLL_MS * 2);
    await flushPromises();
    assert.equal(stub.count(), 0);
  });

  test('a failed poll keeps the last board and sets errorMessage', async () => {
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return { ok: true, status: 200, json: async () => boardBody('first') } as unknown as Response;
      }
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'The board read failed.' }),
      } as unknown as Response;
    }) as typeof globalThis.fetch;
    const { state } = mountBoard(ref(true));
    await flushPromises();
    assert.equal(state.errorMessage.value, null);

    mock.timers.tick(OPERATOR_BOARD_POLL_MS);
    await flushPromises();
    assert.equal(state.board.value?.matchId, 'first', 'the last good board stays');
    assert.equal(state.errorMessage.value, 'The board read failed.');
  });

  test('a collapse → expand while a fetch is in flight leaves exactly one chain', async () => {
    const stub = stubBoardFetch();
    const isExpanded = ref(true);
    mountBoard(isExpanded);
    await flushPromises();
    assert.equal(stub.count(), 1, 'the first fetch is in flight');

    isExpanded.value = false;
    await flushPromises();
    isExpanded.value = true;
    await flushPromises();
    assert.equal(stub.count(), 2);

    // Both the stale and the current response land now.
    stub.autoResolve('board');
    await flushPromises();

    mock.timers.tick(OPERATOR_BOARD_POLL_MS);
    await flushPromises();
    mock.timers.tick(OPERATOR_BOARD_POLL_MS);
    await flushPromises();
    assert.equal(stub.count(), 4, 'one request per interval: a single chain');
  });

  test('refreshNow mid-flight leaves one chain, and a stale response never overwrites a newer board', async () => {
    const stub = stubBoardFetch();
    const { state } = mountBoard(ref(true));
    await flushPromises();
    assert.equal(stub.count(), 1);

    const refreshDone = state.refreshNow();
    await flushPromises();
    assert.equal(stub.count(), 2);

    stub.resolveWith(1, 'newer');
    await refreshDone;
    await flushPromises();
    stub.resolveWith(0, 'older');
    await flushPromises();
    assert.equal(state.board.value?.matchId, 'newer', 'the stale response is dropped');

    stub.autoResolve('board');
    mock.timers.tick(OPERATOR_BOARD_POLL_MS);
    await flushPromises();
    assert.equal(stub.count(), 3, 'exactly one chain after the refresh');
  });
});

describe('buildOperatorFileName (WP-804)', () => {
  test('builds both kinds of file name', () => {
    assert.equal(
      buildOperatorFileName('operator', 'op-match-1', 1700000000000),
      'legendary-arena-operator-op-match-1-1700000000000.json',
    );
    assert.equal(
      buildOperatorFileName('fixture', 'op-match-1', 1700000000000),
      'legendary-arena-fixture-op-match-1-1700000000000.json',
    );
  });

  test('replaces path separators and names an empty match no-match', () => {
    assert.equal(
      buildOperatorFileName('operator', 'a/b\\c', 5),
      'legendary-arena-operator-a-b-c-5.json',
    );
    assert.equal(buildOperatorFileName('fixture', '', 5), 'legendary-arena-fixture-no-match-5.json');
  });
});
