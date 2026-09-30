import '../testing/jsdom-setup';

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';
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

// why: WP-788 / D-24636 — an INTENTIONAL behavior change. Signed out, Enter Arena
// now starts a guest solo match instead of bouncing to sign-in (D-24633 §4 is
// superseded); jsdom never navigates, so the request is what the test observes.
test('signed out: a click starts one guest solo match and never calls the authed create or join', async () => {
  let releaseGuest: () => void = () => undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    recordRequest(input, init);
    await new Promise<void>((resolve) => {
      releaseGuest = resolve;
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({ matchId: 'guest-1', seat: '0', credentials: 'guest-cred' }),
    } as Response;
  }) as typeof globalThis.fetch;
  const wrapper = mountEntrance(null);
  const button = wrapper.find('[data-testid="arena-enter"]');
  await button.trigger('click');
  button.element.removeAttribute('disabled');
  await button.trigger('click');
  releaseGuest();
  await flushPromises();
  assert.equal(recordedRequests.length, 1);
  assert.ok(recordedRequests[0]!.url.endsWith('/api/match/create-guest-solo'));
  assert.equal(recordedRequests.some((request) => request.url.endsWith('/api/match/create')), false);
  assert.equal(recordedRequests.some((request) => request.url.endsWith('/api/match/join')), false);
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

/**
 * Stubs fetch so the guest-solo start fails with the given HTTP status.
 *
 * @param status The status the guest route returns.
 */
function stubGuestFailure(status: number): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    recordRequest(input, init);
    return { ok: false, status, text: async () => 'server sentence' } as Response;
  }) as typeof globalThis.fetch;
}

test('signed out shows the guest helper and a Sign in link; signed in shows neither', () => {
  stubLaunchSuccess();
  const signedOut = mountEntrance(null);
  assert.match(signedOut.text(), /You’ll play as a guest\. Sign in to save your results\./);
  assert.equal(
    signedOut.find('[data-testid="arena-sign-in-link"]').attributes('href'),
    '?route=login',
  );
  const signedIn = mountEntrance('token-1');
  assert.equal(signedIn.find('[data-testid="arena-sign-in-link"]').exists(), false);
  assert.doesNotMatch(signedIn.text(), /You’ll play as a guest/);
});

test('a throttled guest start (429) shows the 429 copy and re-enables the button', async () => {
  stubGuestFailure(429);
  const wrapper = mountEntrance(null);
  await wrapper.find('[data-testid="arena-enter"]').trigger('click');
  await flushPromises();
  assert.equal(
    wrapper.find('[data-testid="arena-enter-error"]').text(),
    'Too many guest games were started from this connection. Sign in to play now, or try again in a minute.',
  );
  assert.equal(wrapper.find('[data-testid="arena-enter"]').attributes('disabled'), undefined);
});

test('a full guest capacity (503) shows the 503 copy', async () => {
  stubGuestFailure(503);
  const wrapper = mountEntrance(null);
  await wrapper.find('[data-testid="arena-enter"]').trigger('click');
  await flushPromises();
  assert.equal(
    wrapper.find('[data-testid="arena-enter-error"]').text(),
    'Guest play is full right now. Sign in to play now, or try again in a few minutes.',
  );
});

test('any other failure, or a network error with no status, shows the generic copy', async () => {
  const generic = 'The guest game could not be started. Sign in to play, or try again.';
  stubGuestFailure(500);
  const serverError = mountEntrance(null);
  await serverError.find('[data-testid="arena-enter"]').trigger('click');
  await flushPromises();
  assert.equal(serverError.find('[data-testid="arena-enter-error"]').text(), generic);

  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as typeof globalThis.fetch;
  const networkError = mountEntrance(null);
  await networkError.find('[data-testid="arena-enter"]').trigger('click');
  await flushPromises();
  assert.equal(networkError.find('[data-testid="arena-enter-error"]').text(), generic);
  assert.equal(networkError.find('[data-testid="arena-enter"]').attributes('disabled'), undefined);
});

/**
 * Mounts the entrance with App's `isSessionHydrating` flag provided, signed out
 * until the test sets a session (the moment hydration would populate it).
 *
 * @returns The mounted wrapper and the provided flag.
 */
function mountHydratingEntrance() {
  setActivePinia(createPinia());
  const isSessionHydrating = ref(true);
  const wrapper = mount(ArenaEntrance, {
    global: { provide: { isSessionHydrating } },
  });
  return { wrapper, isSessionHydrating };
}

// why: D-24640 — amends D-24636 §5. A signed-in visitor whose session is still
// hydrating has `token === null`; the entrance must not read that as signed out.
test('while the session hydrates: button disabled, "Checking your sign-in…" shown, no guest helper, and a click sends nothing', async () => {
  stubLaunchSuccess();
  const { wrapper } = mountHydratingEntrance();
  const button = wrapper.find('[data-testid="arena-enter"]');
  assert.equal(button.attributes('disabled'), '');
  assert.equal(button.text(), 'Enter Arena');
  assert.equal(wrapper.find('[data-testid="arena-checking-sign-in"]').text(), 'Checking your sign-in…');
  assert.equal(wrapper.find('[data-testid="arena-sign-in-link"]').exists(), false);
  assert.doesNotMatch(wrapper.text(), /You’ll play as a guest/);
  button.element.removeAttribute('disabled');
  await button.trigger('click');
  await flushPromises();
  assert.equal(recordedRequests.length, 0);
});

test('hydration settling signed in: the click takes the signed-in create + join, never create-guest-solo', async () => {
  stubLaunchSuccess();
  const { wrapper, isSessionHydrating } = mountHydratingEntrance();
  useAuthStore().bootstrapFromCachedToken('token-1');
  isSessionHydrating.value = false;
  await flushPromises();
  assert.equal(wrapper.find('[data-testid="arena-checking-sign-in"]').exists(), false);
  assert.equal(wrapper.find('[data-testid="arena-sign-in-link"]').exists(), false);
  await wrapper.find('[data-testid="arena-enter"]').trigger('click');
  await flushPromises();
  assert.equal(recordedRequests.some((request) => request.url.endsWith('/api/match/create-guest-solo')), false);
  assert.ok(recordedRequests[0]!.url.endsWith('/api/match/create'));
  assert.ok(recordedRequests[1]!.url.endsWith('/api/match/join'));
});

test('hydration settling signed out: the guest helper appears and the click starts a guest match', async () => {
  stubGuestFailure(503);
  const { wrapper, isSessionHydrating } = mountHydratingEntrance();
  isSessionHydrating.value = false;
  await flushPromises();
  assert.equal(wrapper.find('[data-testid="arena-checking-sign-in"]').exists(), false);
  assert.match(wrapper.text(), /You’ll play as a guest\. Sign in to save your results\./);
  await wrapper.find('[data-testid="arena-enter"]').trigger('click');
  await flushPromises();
  assert.equal(recordedRequests.length, 1);
  assert.ok(recordedRequests[0]!.url.endsWith('/api/match/create-guest-solo'));
});
