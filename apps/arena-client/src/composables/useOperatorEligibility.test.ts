/**
 * useOperatorEligibility tests (WP-804 / EC-841).
 *
 * Drives the gated probe against a stubbed `globalThis.fetch` and a real Pinia
 * auth store: no probe without a token or while disabled; true after a 200,
 * false after a 403; a reset when the token clears or the surface disables; a
 * probe when the token or the enable flag arrives after mount; and a 200 that
 * resolves after a reset is dropped (stale generation).
 */

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

import { useOperatorEligibility } from './useOperatorEligibility';
import { useAuthStore } from '../stores/auth';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * Stub fetch so every eligibility probe answers with a fixed status.
 *
 * @param status The HTTP status to answer.
 * @returns The recorded request URLs.
 */
function stubEligibility(status: number): string[] {
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return {
      ok: status === 200,
      status,
      json: async () => (status === 200 ? { isOperator: true } : { code: 'forbidden', reason: 'no' }),
    } as unknown as Response;
  }) as typeof globalThis.fetch;
  return urls;
}

/**
 * Stub fetch with a 200 whose arrival the test controls.
 *
 * @returns A `release` that lets the pending response resolve.
 */
function stubDeferredEligibility(): { release: () => void } {
  let release: () => void = () => undefined;
  globalThis.fetch = (() =>
    new Promise<Response>((resolve) => {
      release = () =>
        resolve({ ok: true, status: 200, json: async () => ({ isOperator: true }) } as unknown as Response);
    })) as typeof globalThis.fetch;
  return { release: () => release() };
}

/** Flush Vue's watcher scheduler and the pending fetch promises. */
async function flush(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

test('makes no probe without a token', async () => {
  setActivePinia(createPinia());
  const urls = stubEligibility(200);
  const { isOperator } = useOperatorEligibility(ref(true));
  await flush();
  assert.equal(urls.length, 0);
  assert.equal(isOperator.value, false);
});

test('makes no probe while disabled, even with a token', async () => {
  setActivePinia(createPinia());
  useAuthStore().setSession('admin-token', null);
  const urls = stubEligibility(200);
  const { isOperator } = useOperatorEligibility(ref(false));
  await flush();
  assert.equal(urls.length, 0, 'a disabled surface (a normal match) never probes');
  assert.equal(isOperator.value, false);
});

test('is true after a 200 and false after a 403', async () => {
  setActivePinia(createPinia());
  useAuthStore().setSession('admin-token', null);
  stubEligibility(200);
  const admin = useOperatorEligibility(ref(true));
  await flush();
  assert.equal(admin.isOperator.value, true);

  setActivePinia(createPinia());
  useAuthStore().setSession('player-token', null);
  stubEligibility(403);
  const player = useOperatorEligibility(ref(true));
  await flush();
  assert.equal(player.isOperator.value, false);
});

test('resets to false when the token clears or the surface disables', async () => {
  setActivePinia(createPinia());
  const authStore = useAuthStore();
  authStore.setSession('admin-token', null);
  stubEligibility(200);
  const isEnabled = ref(true);
  const { isOperator } = useOperatorEligibility(isEnabled);
  await flush();
  assert.equal(isOperator.value, true);

  authStore.clearSession();
  await flush();
  assert.equal(isOperator.value, false, 'a cleared token resets the answer');

  authStore.setSession('admin-token', null);
  await flush();
  assert.equal(isOperator.value, true);

  isEnabled.value = false;
  await flush();
  assert.equal(isOperator.value, false, 'disabling the surface resets the answer');
});

test('probes when the token arrives after mount and when the surface enables after mount', async () => {
  setActivePinia(createPinia());
  const urls = stubEligibility(200);
  const authStore = useAuthStore();
  const isEnabled = ref(false);
  const { isOperator } = useOperatorEligibility(isEnabled);
  await flush();
  assert.equal(urls.length, 0);

  // why: App.vue hydrates the session in the background, after mount.
  authStore.setSession('admin-token', null);
  await flush();
  assert.equal(urls.length, 0, 'still disabled');

  isEnabled.value = true;
  await flush();
  assert.equal(urls.length, 1);
  assert.equal(isOperator.value, true);
});

test('a 200 resolving after a reset leaves isOperator false (stale generation)', async () => {
  setActivePinia(createPinia());
  const authStore = useAuthStore();
  authStore.setSession('admin-token', null);
  const deferred = stubDeferredEligibility();
  const { isOperator } = useOperatorEligibility(ref(true));
  await flush();

  authStore.clearSession();
  await flush();
  deferred.release();
  await flush();
  assert.equal(isOperator.value, false, 'the stale 200 is dropped');
});
