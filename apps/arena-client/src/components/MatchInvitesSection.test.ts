// why: jsdom globals must be installed before Vue's mount() is called.
import '../testing/jsdom-setup';

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';

import MatchInvitesSection from './MatchInvitesSection.vue';
import type { MatchInviteView } from '../lib/api/matchInvitesApi';

enableAutoUnmount(afterEach);

interface StubResponse {
  status: number;
  body: unknown;
}

const originalFetch = globalThis.fetch;
let routeHandler: (url: string, init: RequestInit) => StubResponse;

beforeEach(() => {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const { status, body } = routeHandler(String(url), init ?? {});
    return { status, json: async () => body } as Response;
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function invite(matchId: string): MatchInviteView {
  return {
    matchId,
    inviterHandle: 'nova',
    inviterDisplayName: 'Nova',
    status: 'pending',
    createdAt: '2026-07-11T00:00:00.000Z',
  };
}

test('renders pending invites with the inviter handle + display name, and NO accountId', async () => {
  routeHandler = () => ({ status: 200, body: { invites: [invite('m1')] } });
  const wrapper = mount(MatchInvitesSection, { props: { authToken: 'token' } });
  await flushPromises();
  const html = wrapper.html();
  assert.ok(html.includes('@nova'));
  assert.ok(html.includes('Nova'));
  assert.ok(html.includes('invited you to a game'));
  // FR-2: no accountId / ext_id anywhere in the rendered output.
  assert.ok(!html.includes('accountId'));
  assert.ok(wrapper.find('[data-testid="match-invite-accept-m1"]').exists());
  assert.ok(wrapper.find('[data-testid="match-invite-decline-m1"]').exists());
});

test('empty state shows when there are no invites', async () => {
  routeHandler = () => ({ status: 200, body: { invites: [] } });
  const wrapper = mount(MatchInvitesSection, { props: { authToken: 'token' } });
  await flushPromises();
  assert.ok(wrapper.find('[data-testid="match-invites-empty"]').exists());
});

test('Accept posts, refetches, and surfaces the hand-off matchId', async () => {
  let listCalls = 0;
  routeHandler = (url, init) => {
    if (url.endsWith('/accept') && init.method === 'POST') {
      return { status: 200, body: { matchId: 'm1' } };
    }
    listCalls += 1;
    return { status: 200, body: { invites: listCalls >= 2 ? [] : [invite('m1')] } };
  };
  const wrapper = mount(MatchInvitesSection, { props: { authToken: 'token' } });
  await flushPromises();
  await wrapper.find('[data-testid="match-invite-accept-m1"]').trigger('click');
  await flushPromises();
  const accepted = wrapper.find('[data-testid="match-invites-accepted"]');
  assert.ok(accepted.exists());
  assert.ok(accepted.text().includes('m1'));
  // the accepted invite is gone from the pending list after the refetch
  assert.ok(wrapper.find('[data-testid="match-invites-empty"]').exists());
});

test('Decline failure surfaces the error line', async () => {
  routeHandler = (url, init) => {
    if (url.endsWith('/decline') && init.method === 'POST') {
      return { status: 404, body: { error: 'invite_not_found' } };
    }
    return { status: 200, body: { invites: [invite('m1')] } };
  };
  const wrapper = mount(MatchInvitesSection, { props: { authToken: 'token' } });
  await flushPromises();
  await wrapper.find('[data-testid="match-invite-decline-m1"]').trigger('click');
  await flushPromises();
  const error = wrapper.find('[data-testid="match-invites-error"]');
  assert.ok(error.exists());
  assert.ok(error.text().includes('no longer available'));
});
