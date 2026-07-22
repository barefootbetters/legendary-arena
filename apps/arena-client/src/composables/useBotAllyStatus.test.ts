// why: jsdom globals must be installed before Vue's mount() is called.
import '../testing/jsdom-setup';

import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { defineComponent } from 'vue';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';

import { useBotAllyStatus, BOT_ALLY_STATUS_POLL_MS } from './useBotAllyStatus';

/**
 * Tests for the bot-ally status poll composable (WP-415 / EC-450). It reads
 * WP-414's `GET /api/match/:matchId/bot-ally-status`, so a route `globalThis.fetch`
 * stub drives it. The composable uses onMounted/onUnmounted + a self-scheduling
 * setTimeout, so it runs inside a mounted harness with mocked timers.
 */

enableAutoUnmount(afterEach);

const originalFetch = globalThis.fetch;
let fetchCalls = 0;

/** Stub fetch to return a canned status body (HTTP 200). Counts calls. */
function stubStatus(body: unknown): void {
  fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return { status: 200, json: async () => body } as Response;
  }) as typeof globalThis.fetch;
}

/** Stub fetch to reject (transport failure). Counts calls. */
function stubThrow(): void {
  fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('Simulated bot-ally status failure.');
  }) as typeof globalThis.fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.timers.reset();
});

interface StatusVm {
  hasStopped: boolean;
  message: string | null;
  status: string | null;
}

/** Mount a harness exposing the composable's refs on `vm`. */
function mountStatus(matchId: string) {
  const Harness = defineComponent({
    setup() {
      return useBotAllyStatus(matchId);
    },
    render() {
      return null;
    },
  });
  return mount(Harness);
}

test('probes once and stops for a non-bot-ally match (absent), never polling again', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  stubStatus({ driving: false, status: 'absent', message: null });
  const wrapper = mountStatus('m-absent');
  await flushPromises();
  const vm = wrapper.vm as unknown as StatusVm;

  assert.equal(fetchCalls, 1, 'probed exactly once');
  assert.equal(vm.hasStopped, false, 'absent is not a stall');
  assert.equal(vm.status, 'absent');

  // advancing well past the poll interval must NOT trigger another fetch
  mock.timers.tick(BOT_ALLY_STATUS_POLL_MS * 3);
  await flushPromises();
  assert.equal(fetchCalls, 1, 'a non-bot-ally match is never polled again');
});

test('keeps polling a live (active) match', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  stubStatus({ driving: true, status: 'active', message: null });
  const wrapper = mountStatus('m-active');
  await flushPromises();
  const vm = wrapper.vm as unknown as StatusVm;

  assert.equal(fetchCalls, 1);
  assert.equal(vm.hasStopped, false, 'a driving bot ally is not stopped');

  mock.timers.tick(BOT_ALLY_STATUS_POLL_MS);
  await flushPromises();
  assert.equal(fetchCalls, 2, 'a live match keeps polling');
});

test('a faulted status sets hasStopped + the server message, then stops polling', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const serverMessage = 'The bot ally could not finish its turn, so the match was stopped.';
  stubStatus({ driving: false, status: 'faulted', message: serverMessage });
  const wrapper = mountStatus('m-faulted');
  await flushPromises();
  const vm = wrapper.vm as unknown as StatusVm;

  assert.equal(vm.hasStopped, true, 'an abnormal stop sets hasStopped');
  assert.equal(vm.message, serverMessage, 'the server message is carried verbatim');
  assert.equal(vm.status, 'faulted');

  mock.timers.tick(BOT_ALLY_STATUS_POLL_MS * 2);
  await flushPromises();
  assert.equal(fetchCalls, 1, 'a terminal status stops the poll');
});

test('a normally-completed match never sets hasStopped', async () => {
  stubStatus({ driving: false, status: 'completed', message: null });
  const wrapper = mountStatus('m-completed');
  await flushPromises();
  const vm = wrapper.vm as unknown as StatusVm;

  assert.equal(vm.hasStopped, false, 'a normal end is owned by the end-of-match UI');
  assert.equal(vm.status, 'completed');
});

test('a fetch error is fail-soft — never sets hasStopped, retried on the next tick', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  stubThrow();
  const wrapper = mountStatus('m-blip');
  await flushPromises();
  const vm = wrapper.vm as unknown as StatusVm;

  assert.equal(vm.hasStopped, false, 'a network blip is not a stopped bot');
  assert.equal(fetchCalls, 1);

  mock.timers.tick(BOT_ALLY_STATUS_POLL_MS);
  await flushPromises();
  assert.equal(fetchCalls, 2, 'a failed poll is retried on the next tick');
  assert.equal(vm.hasStopped, false, 'still no false stall after the retry');
});

test('an empty matchId disables polling entirely (no fetch)', async () => {
  stubStatus({ driving: false, status: 'absent', message: null });
  const wrapper = mountStatus('');
  await flushPromises();
  const vm = wrapper.vm as unknown as StatusVm;

  assert.equal(fetchCalls, 0, 'an empty matchId probes nothing');
  assert.equal(vm.hasStopped, false);
});

test('the poll timer is cleared on unmount (no leak)', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  stubStatus({ driving: true, status: 'active', message: null });
  const wrapper = mountStatus('m-unmount');
  await flushPromises();
  assert.equal(fetchCalls, 1);

  wrapper.unmount();
  mock.timers.tick(BOT_ALLY_STATUS_POLL_MS * 3);
  await flushPromises();
  assert.equal(fetchCalls, 1, 'no poll fires after unmount — the timer was cleared');
});
