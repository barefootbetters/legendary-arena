// why: jsdom globals (window/document/fetch target + Vue mount) before the SUT.
import '../testing/jsdom-setup';

import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { defineComponent } from 'vue';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import { useConnectionStore } from '../stores/connection';
import {
  useDeployVersionCheck,
  DEPLOY_VERSION_POLL_MS,
  type DeployVersionCheckState,
} from './useDeployVersionCheck';

/**
 * Tests for the WP-418 deploy-freshness composable. It fetches the build-stamped
 * `version.json` (a `globalThis.fetch` stub drives it), compares against an
 * injected baked sha, and raises `updateAvailable` on mount / tab-focus / socket
 * reconnect / a ~60s backstop / a `vite:preloadError`. All triggers are asserted
 * here (AC-6). The reconnect edge is driven through the WP-311 `connection` store.
 */

enableAutoUnmount(afterEach);

const originalFetch = globalThis.fetch;
let servedSha = '';
let fetchCalls = 0;
let captured: DeployVersionCheckState | null = null;

/** Stub `version.json` to serve `servedSha` (mutable between triggers). */
function serveSha(sha: string): void {
  servedSha = sha;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return { status: 200, json: async () => ({ gitSha: servedSha }) } as Response;
  }) as typeof globalThis.fetch;
}

/** Mount a headless harness exposing the composable's reactive state on `captured`. */
function mountCheck(bakedSha: string) {
  const Harness = defineComponent({
    setup() {
      const state = useDeployVersionCheck(bakedSha);
      captured = state;
      return state;
    },
    render() {
      return null;
    },
  });
  return mount(Harness);
}

/** The current `updateAvailable` value from the mounted composable. */
function flag(): boolean {
  assert.ok(captured !== null, 'composable mounted');
  return captured.updateAvailable.value;
}

beforeEach(() => {
  setActivePinia(createPinia());
  fetchCalls = 0;
  captured = null;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.timers.reset();
});

test('no banner when the deployed sha matches the baked sha', async () => {
  serveSha('same-sha');
  mountCheck('same-sha');
  await flushPromises();
  assert.ok(fetchCalls >= 1, 'checked on mount');
  assert.equal(flag(), false, 'identical build ⇒ no update');
});

test('flags an update on mount when the deployed sha differs', async () => {
  serveSha('new-sha');
  mountCheck('old-sha');
  await flushPromises();
  assert.equal(flag(), true, 'a newer deployed build ⇒ updateAvailable');
});

test('a failed version fetch is fail-soft — never a false positive', async () => {
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('Simulated version.json failure.');
  }) as typeof globalThis.fetch;
  mountCheck('old-sha');
  await flushPromises();
  assert.equal(flag(), false, 'a fetch error shows nothing');
});

test('the ~60s backstop poll catches a deploy that lands after mount', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  serveSha('old-sha'); // matches baked at mount
  mountCheck('old-sha');
  await flushPromises();
  assert.equal(flag(), false, 'no update at mount');

  servedSha = 'new-sha'; // a deploy lands while the tab sits idle
  mock.timers.tick(DEPLOY_VERSION_POLL_MS);
  await flushPromises();
  assert.equal(flag(), true, 'the backstop poll surfaced the deploy');
});

test('re-checks on tab-focus (visibilitychange → visible)', async () => {
  serveSha('old-sha');
  mountCheck('old-sha');
  await flushPromises();
  assert.equal(flag(), false);

  servedSha = 'new-sha';
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new window.Event('visibilitychange'));
  await flushPromises();
  assert.equal(flag(), true, 'a re-focus re-checked and found the deploy');
});

test('re-checks on socket reconnect (connection isConnected false→true)', async () => {
  serveSha('old-sha');
  mountCheck('old-sha');
  await flushPromises();
  assert.equal(flag(), false);

  servedSha = 'new-sha';
  // why: a false→true edge is the reconnect signal the composable watches.
  useConnectionStore().setConnected(true, 1);
  await flushPromises();
  assert.equal(flag(), true, 'a reconnect re-checked and found the deploy');
});

test('a vite:preloadError surfaces the banner immediately and prevents the white-screen', async () => {
  serveSha('same-sha'); // no version mismatch — the chunk 404 is the only signal
  mountCheck('same-sha');
  await flushPromises();
  assert.equal(flag(), false);

  const preloadError = new window.Event('vite:preloadError', { cancelable: true });
  window.dispatchEvent(preloadError);
  await flushPromises();
  assert.equal(flag(), true, 'a chunk 404 ⇒ a stale bundle ⇒ banner');
  assert.equal(preloadError.defaultPrevented, true, 'the default white-screen is prevented');
});

test('unmount clears the poll timer and listeners (no post-unmount flip)', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  serveSha('same-sha');
  const wrapper = mountCheck('same-sha');
  await flushPromises();

  wrapper.unmount();
  servedSha = 'new-sha';
  mock.timers.tick(DEPLOY_VERSION_POLL_MS * 2);
  window.dispatchEvent(new window.Event('vite:preloadError', { cancelable: true }));
  await flushPromises();
  assert.equal(flag(), false, 'no timer or listener fires after unmount');
});
