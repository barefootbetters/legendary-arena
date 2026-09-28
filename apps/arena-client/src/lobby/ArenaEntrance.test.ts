import '../testing/jsdom-setup';

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';

import ArenaEntrance from './ArenaEntrance.vue';
import { FEATURED_TABLE } from './featuredTable';
import { useAuthStore } from '../stores/auth';

/**
 * WP-785 / EC-822 — the Arena entrance. jsdom never navigates, so these tests
 * observe requests and rendered text, not `location` changes (the navigation is
 * covered by the D-24026 live verify).
 */

enableAutoUnmount(afterEach);

const originalFetch = globalThis.fetch;

interface RecordedRequest {
  readonly url: string;
  readonly body: unknown;
}

let recordedRequests: RecordedRequest[] = [];

/**
 * Records one outgoing request, parsing a JSON body when present.
 *
 * @param input The fetch input.
 * @param init The fetch init.
 */
function recordRequest(input: RequestInfo | URL, init?: RequestInit): void {
  const url = typeof input === 'string' ? input : input.toString();
  let body: unknown = null;
  if (typeof init?.body === 'string') {
    body = JSON.parse(init.body);
  }
  recordedRequests.push({ url, body });
}

/**
 * Stubs fetch so create returns `created-1` and join returns a credential.
 */
function stubLaunchSuccess(): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    recordRequest(input, init);
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/api/match/create')) {
      return { ok: true, status: 200, json: async () => ({ matchID: 'created-1' }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ playerCredentials: 'secret-1' }) } as Response;
  }) as typeof globalThis.fetch;
}

/**
 * Stubs fetch so every request fails with HTTP 500.
 */
function stubLaunchFailure(): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    recordRequest(input, init);
    return { ok: false, status: 500, text: async () => 'server exploded' } as Response;
  }) as typeof globalThis.fetch;
}

/**
 * Mounts the entrance with a fresh Pinia, optionally signed in.
 *
 * @param token The bearer token, or `null` for a signed-out visitor.
 * @returns The mounted wrapper.
 */
function mountEntrance(token: string | null) {
  setActivePinia(createPinia());
  if (token !== null) {
    useAuthStore().setSession(token, null);
  }
  return mount(ArenaEntrance);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  recordedRequests = [];
});

test('renders the heading, encounter, roster, and the Magneto art', () => {
  stubLaunchSuccess();
  const wrapper = mountEntrance('token-1');
  const text = wrapper.text();
  assert.match(text, /The Arena Awaits/);
  assert.match(text, /Magneto and the Brotherhood are robbing Midtown Bank\./);
  assert.match(text, /Spider-Man, Hulk, and Wolverine answer the call\./);
  assert.equal(wrapper.find('[data-testid="arena-featured-art"]').attributes('alt'), 'Magneto');
});

test('sends no request on mount', async () => {
  stubLaunchSuccess();
  mountEntrance('token-1');
  await flushPromises();
  assert.equal(recordedRequests.length, 0);
});

test('signed out: a click sends no request, shows no error, and leaves the button enabled', async () => {
  stubLaunchSuccess();
  const wrapper = mountEntrance(null);
  assert.match(wrapper.text(), /Sign in to take your seat\. Your account is free\./);
  await wrapper.find('[data-testid="arena-enter"]').trigger('click');
  await flushPromises();
  assert.equal(recordedRequests.length, 0);
  assert.equal(wrapper.find('[data-testid="arena-enter-error"]').exists(), false);
  assert.equal(wrapper.find('[data-testid="arena-enter"]').attributes('disabled'), undefined);
});

test('signed in: one create with the featured table at 1 player, then a join for seat 0 as Player', async () => {
  stubLaunchSuccess();
  const wrapper = mountEntrance('token-1');
  await wrapper.find('[data-testid="arena-enter"]').trigger('click');
  await flushPromises();
  assert.equal(recordedRequests.length, 2);
  assert.ok(recordedRequests[0]!.url.endsWith('/api/match/create'));
  assert.deepEqual(recordedRequests[0]!.body, { numPlayers: 1, setupData: FEATURED_TABLE });
  assert.ok(recordedRequests[1]!.url.endsWith('/api/match/join'));
  assert.deepEqual(recordedRequests[1]!.body, {
    matchID: 'created-1',
    playerID: '0',
    playerName: 'Player',
  });
});

test('a failed create shows the launcher message and re-enables the button', async () => {
  stubLaunchFailure();
  const wrapper = mountEntrance('token-1');
  await wrapper.find('[data-testid="arena-enter"]').trigger('click');
  await flushPromises();
  const error = wrapper.find('[data-testid="arena-enter-error"]');
  assert.equal(error.exists(), true);
  assert.match(error.text(), /Failed to create and join the match\./);
  assert.equal(wrapper.find('[data-testid="arena-enter"]').attributes('disabled'), undefined);
});

test('a second click while entering does not create a second match', async () => {
  let releaseCreate: () => void = () => undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    recordRequest(input, init);
    await new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    return { ok: true, status: 200, json: async () => ({ matchID: 'created-1' }) } as Response;
  }) as typeof globalThis.fetch;
  const wrapper = mountEntrance('token-1');
  const button = wrapper.find('[data-testid="arena-enter"]');
  await button.trigger('click');
  button.element.removeAttribute('disabled');
  await button.trigger('click');
  assert.equal(recordedRequests.length, 1);
  assert.equal(wrapper.find('[data-testid="arena-enter"]').text(), 'Entering…');
  releaseCreate();
  await flushPromises();
});

test('the Arena Workshop link points at ?route=workshop', () => {
  stubLaunchSuccess();
  const wrapper = mountEntrance('token-1');
  assert.equal(
    wrapper.find('[data-testid="arena-workshop-link"]').attributes('href'),
    '?route=workshop',
  );
});
