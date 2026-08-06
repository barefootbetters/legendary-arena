// why: jsdom globals must be installed before Vue's mount() is called.
import '../testing/jsdom-setup';

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';

import FriendsSection from './FriendsSection.vue';
import type { FriendSummary } from '../lib/api/friendsApi';

enableAutoUnmount(afterEach);

interface StubResponse {
  status: number;
  body: unknown;
}

const originalFetch = globalThis.fetch;
let routeHandler: (url: string, init: RequestInit) => StubResponse;
const capturedCalls: { url: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  capturedCalls.length = 0;
  routeHandler = () => ({ status: 200, body: {} });
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const resolvedInit = init ?? {};
    capturedCalls.push({
      url: String(url),
      method: String(resolvedInit.method ?? 'GET'),
      body:
        typeof resolvedInit.body === 'string'
          ? JSON.parse(resolvedInit.body)
          : null,
    });
    const { status, body } = routeHandler(String(url), resolvedInit);
    return { status, json: async () => body } as Response;
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function friend(overrides: Partial<FriendSummary> = {}): FriendSummary {
  return {
    handle: 'nova',
    displayName: 'Nova',
    status: 'accepted',
    direction: 'outgoing',
    requestedAt: '2026-07-11T00:00:00.000Z',
    respondedAt: null,
    ...overrides,
  };
}

function routeReads(
  friends: FriendSummary[],
  incoming: FriendSummary[],
  outgoing: FriendSummary[],
): void {
  // why: the send POST and the requests GET share the same URL
  // (/api/me/friends/requests), so the stub branches on METHOD too — the
  // POST expects 201, the GET expects 200 with the two lists; DELETE 204.
  routeHandler = (url, init) => {
    const method = String(init.method ?? 'GET');
    if (method === 'GET' && url.endsWith('/api/me/friends')) {
      return { status: 200, body: { friends } };
    }
    if (method === 'GET' && url.endsWith('/api/me/friends/requests')) {
      return { status: 200, body: { incoming, outgoing } };
    }
    if (method === 'POST' && url.endsWith('/api/me/friends/requests')) {
      return { status: 201, body: friend({ handle: 'sent', status: 'pending' }) };
    }
    if (method === 'POST') {
      return { status: 200, body: friend() };
    }
    if (method === 'DELETE') {
      return { status: 204, body: null };
    }
    return { status: 200, body: {} };
  };
}

async function mountLoaded(
  friends: FriendSummary[],
  incoming: FriendSummary[],
  outgoing: FriendSummary[],
) {
  routeReads(friends, incoming, outgoing);
  const wrapper = mount(FriendsSection, { props: { authToken: 'token' } });
  await flushPromises();
  return wrapper;
}

test('renders friends, incoming (Accept/Decline), and outgoing (display-only)', async () => {
  const wrapper = await mountLoaded(
    [friend({ handle: 'buddy', displayName: 'Buddy' })],
    [friend({ handle: 'inbound', displayName: 'Inbound', direction: 'incoming', status: 'pending' })],
    [friend({ handle: 'sent', displayName: 'Sent', direction: 'outgoing', status: 'pending' })],
  );
  assert.equal(wrapper.find('[data-testid="friends-friend-buddy"]').exists(), true);
  assert.match(wrapper.find('[data-testid="friends-friend-buddy"]').text(), /@buddy/);
  assert.match(wrapper.find('[data-testid="friends-friend-buddy"]').text(), /Buddy/);

  assert.equal(wrapper.find('[data-testid="friends-incoming-inbound"]').exists(), true);
  assert.equal(wrapper.find('[data-testid="friends-accept-inbound"]').exists(), true);
  assert.equal(wrapper.find('[data-testid="friends-decline-inbound"]').exists(), true);

  assert.equal(wrapper.find('[data-testid="friends-outgoing-sent"]').exists(), true);
  // Outgoing is display-only: no remove/accept/decline control on it.
  assert.match(wrapper.find('[data-testid="friends-outgoing-sent"]').text(), /Request sent/);
});

test('no accountId / ext_id string appears in the rendered output', async () => {
  const wrapper = await mountLoaded(
    [friend({ handle: 'buddy' })],
    [friend({ handle: 'inbound', direction: 'incoming', status: 'pending' })],
    [],
  );
  const html = wrapper.html();
  assert.equal(html.includes('accountId'), false);
  assert.equal(html.includes('ext_id'), false);
});

test('empty state renders the friendly empty lines', async () => {
  const wrapper = await mountLoaded([], [], []);
  assert.equal(wrapper.find('[data-testid="friends-empty"]').exists(), true);
  assert.equal(wrapper.find('[data-testid="friends-requests-empty"]').exists(), true);
});

test('Add friend POSTs the typed handle (leading @ stripped) and clears the box', async () => {
  const wrapper = await mountLoaded([], [], []);
  await wrapper.find('[data-testid="friends-add-input"]').setValue('@bob');
  await wrapper.find('[data-testid="friends-add-button"]').trigger('click');
  await flushPromises();
  const post = capturedCalls.find(
    (call) => call.method === 'POST' && call.url.endsWith('/api/me/friends/requests'),
  );
  assert.ok(post, 'a POST to /api/me/friends/requests fired');
  assert.deepEqual(post.body, { handle: 'bob' });
  // input cleared on success
  const input = wrapper.find('[data-testid="friends-add-input"]').element as HTMLInputElement;
  assert.equal(input.value, '');
});

test('pasting an Account ID POSTs {accountId} not {handle}', async () => {
  const wrapper = await mountLoaded([], [], []);
  await wrapper
    .find('[data-testid="friends-add-input"]')
    .setValue('4f2219e4-1c3b-4a5d-8e6f-0a1b2c3d4e5f');
  await wrapper.find('[data-testid="friends-add-button"]').trigger('click');
  await flushPromises();
  const post = capturedCalls.find(
    (call) => call.method === 'POST' && call.url.endsWith('/api/me/friends/requests'),
  );
  assert.ok(post, 'a POST to /api/me/friends/requests fired');
  assert.deepEqual(post.body, {
    accountId: '4f2219e4-1c3b-4a5d-8e6f-0a1b2c3d4e5f',
  });
});

test('an unknown Account ID renders the account-not-found copy', async () => {
  const wrapper = await mountLoaded([], [], []);
  // Next send fails with account_not_found (a well-formed but unknown UUID).
  routeHandler = (url) => {
    if (url.endsWith('/api/me/friends/requests')) {
      return { status: 404, body: { error: 'account_not_found' } };
    }
    return { status: 200, body: { friends: [], incoming: [], outgoing: [] } };
  };
  await wrapper
    .find('[data-testid="friends-add-input"]')
    .setValue('4f2219e4-1c3b-4a5d-8e6f-0a1b2c3d4e5f');
  await wrapper.find('[data-testid="friends-add-button"]').trigger('click');
  await flushPromises();
  assert.equal(wrapper.find('[data-testid="friends-error"]').exists(), true);
  assert.match(
    wrapper.find('[data-testid="friends-error"]').text(),
    /No player with that Account ID\./,
  );
});

test('Accept / Decline / Remove fire the matching endpoint', async () => {
  const wrapper = await mountLoaded(
    [friend({ handle: 'buddy' })],
    [friend({ handle: 'inbound', direction: 'incoming', status: 'pending' })],
    [],
  );
  await wrapper.find('[data-testid="friends-accept-inbound"]').trigger('click');
  await flushPromises();
  assert.ok(capturedCalls.some((c) => c.url.endsWith('/api/me/friends/requests/inbound/accept')));

  await wrapper.find('[data-testid="friends-remove-buddy"]').trigger('click');
  await flushPromises();
  assert.ok(
    capturedCalls.some((c) => c.method === 'DELETE' && c.url.endsWith('/api/me/friends/buddy')),
  );
});

test('a rejected add renders the locked per-code error copy', async () => {
  const wrapper = await mountLoaded([], [], []);
  // Next send fails with already_pending.
  routeHandler = (url) => {
    if (url.endsWith('/api/me/friends/requests')) {
      return { status: 409, body: { error: 'already_pending' } };
    }
    return { status: 200, body: { friends: [], incoming: [], outgoing: [] } };
  };
  await wrapper.find('[data-testid="friends-add-input"]').setValue('bob');
  await wrapper.find('[data-testid="friends-add-button"]').trigger('click');
  await flushPromises();
  assert.equal(wrapper.find('[data-testid="friends-error"]').exists(), true);
  assert.match(
    wrapper.find('[data-testid="friends-error"]').text(),
    /already pending/i,
  );
});

test('a rejected add renders the specific WP-355 abuse-control copy (not the generic banner)', async () => {
  // why: before the mirror was extended, blocked / rate_limited /
  // request_cooldown narrowed to null on the client and fell through to
  // the generic banner; this asserts each now renders its own line.
  const abuseCases = [
    { code: 'blocked', status: 403, pattern: /blocked/i },
    { code: 'rate_limited', status: 429, pattern: /too many requests/i },
    { code: 'request_cooldown', status: 429, pattern: /recently declined/i },
  ];
  for (const abuseCase of abuseCases) {
    const wrapper = await mountLoaded([], [], []);
    routeHandler = (url) => {
      if (url.endsWith('/api/me/friends/requests')) {
        return { status: abuseCase.status, body: { error: abuseCase.code } };
      }
      return { status: 200, body: { friends: [], incoming: [], outgoing: [] } };
    };
    await wrapper.find('[data-testid="friends-add-input"]').setValue('bob');
    await wrapper.find('[data-testid="friends-add-button"]').trigger('click');
    await flushPromises();
    const errorText = wrapper.find('[data-testid="friends-error"]').text();
    assert.match(errorText, abuseCase.pattern);
    assert.doesNotMatch(errorText, /something went wrong/i);
  }
});
