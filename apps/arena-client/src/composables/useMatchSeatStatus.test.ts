// why: jsdom globals must be installed before Vue's mount() is called.
import '../testing/jsdom-setup';

import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { defineComponent } from 'vue';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';

import {
  useMatchSeatStatus,
  SEAT_POLL_INTERVAL_MS,
} from './useMatchSeatStatus';

/**
 * Tests for the seat-occupancy poll composable (WP-369 / EC-398). It reads the
 * public lobby list (`listMatches` → `GET /games/legendary-arena`), so a route
 * `globalThis.fetch` stub drives it. The composable uses onMounted/onUnmounted,
 * so it runs inside a mounted harness component.
 */

enableAutoUnmount(afterEach);

const originalFetch = globalThis.fetch;

/** A `matches` list body for a match with the given seat names (undefined = open). */
function lobbyBody(matchID: string, seatNames: (string | undefined)[]): unknown {
  const players = seatNames.map((name, index) =>
    name === undefined ? { id: index } : { id: index, name },
  );
  return { matches: [{ matchID, players }] };
}

/** Stub fetch to return a canned lobby list (ok=true). */
function stubList(body: unknown): void {
  globalThis.fetch = (async () =>
    ({ ok: true, status: 200, json: async () => body }) as Response) as typeof globalThis.fetch;
}

/** Stub fetch to throw (transport failure). */
function stubThrow(): void {
  globalThis.fetch = (async () => {
    throw new Error('Simulated lobby list failure.');
  }) as typeof globalThis.fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.timers.reset();
});

/** Mount a harness that exposes the composable's refs on `vm`. */
function mountSeatStatus(matchId: string) {
  const Harness = defineComponent({
    setup() {
      return useMatchSeatStatus(matchId);
    },
    render() {
      return null;
    },
  });
  return mount(Harness);
}

test('reports open/total seats from the first poll', async () => {
  stubList(lobbyBody('m1', ['host', undefined]));
  const wrapper = mountSeatStatus('m1');
  await flushPromises();
  const vm = wrapper.vm as unknown as {
    totalSeats: number;
    openSeats: number;
    isFull: boolean;
    isPresent: boolean;
  };
  assert.equal(vm.totalSeats, 2);
  assert.equal(vm.openSeats, 1);
  assert.equal(vm.isFull, false);
  assert.equal(vm.isPresent, true);
});

test('reports isFull when every seat is named', async () => {
  stubList(lobbyBody('m1', ['host', 'guest']));
  const wrapper = mountSeatStatus('m1');
  await flushPromises();
  const vm = wrapper.vm as unknown as { openSeats: number; isFull: boolean };
  assert.equal(vm.openSeats, 0);
  assert.equal(vm.isFull, true);
});

test('a match absent from the list is not present and not full', async () => {
  stubList({ matches: [] });
  const wrapper = mountSeatStatus('m1');
  await flushPromises();
  const vm = wrapper.vm as unknown as { isPresent: boolean; isFull: boolean };
  assert.equal(vm.isPresent, false);
  assert.equal(vm.isFull, false);
});

test('an empty matchId disables polling (no fetch, no status)', async () => {
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return { ok: true, status: 200, json: async () => ({ matches: [] }) } as Response;
  }) as typeof globalThis.fetch;
  const wrapper = mountSeatStatus('');
  await flushPromises();
  const vm = wrapper.vm as unknown as { isPresent: boolean };
  assert.equal(fetchCalls, 0);
  assert.equal(vm.isPresent, false);
});

test('a failed poll preserves the last snapshot', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  stubList(lobbyBody('m1', ['host', undefined]));
  const wrapper = mountSeatStatus('m1');
  await flushPromises();
  const vm = wrapper.vm as unknown as { openSeats: number; isPresent: boolean };
  assert.equal(vm.openSeats, 1, 'first poll saw one open seat');

  // the next poll fails — the counts must not blank
  stubThrow();
  mock.timers.tick(SEAT_POLL_INTERVAL_MS);
  await flushPromises();
  assert.equal(vm.openSeats, 1, 'a failed poll preserves the last snapshot');
  assert.equal(vm.isPresent, true);
});
