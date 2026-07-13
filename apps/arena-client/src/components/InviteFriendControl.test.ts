import '../testing/jsdom-setup';

import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';

import InviteFriendControl from './InviteFriendControl.vue';
import { useAuthStore } from '../stores/auth';

/**
 * Tests for the in-match "Invite a friend" control (WP-366 / EC-396). jsdom +
 * @vue/test-utils mount; `globalThis.fetch` is stubbed. Covers the render-gate
 * (no `?match=`, guest), a successful invite (POST body + confirmation + leading
 * `@` stripped), a typed error (not_friends copy), and the no-accountId
 * assertion (FR-2).
 *
 * Authority: WP-366 §Scope; EC-396; D-24158.
 */

enableAutoUnmount(afterEach);

const originalFetch = globalThis.fetch;

interface CapturedRequest {
  url: string;
  init: RequestInit;
}
let fetchCalls: CapturedRequest[] = [];

/** Set the page URL so `?match=` is (or is not) present at mount time. */
function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

/** Stub fetch to return a canned JSON Response and capture the request. */
function stubFetch(status: number, body: unknown): void {
  fetchCalls = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init: init ?? {} });
    return { status, json: async () => body } as Response;
  }) as typeof globalThis.fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * Mount with a fresh Pinia; optionally sign in with a token BEFORE mount so the
 * auth-gated control renders synchronously (the render gate is
 * `hasMatch && isAuthenticated`).
 */
function mountControl(token: string | null): ReturnType<typeof mount> {
  setActivePinia(createPinia());
  if (token !== null) {
    useAuthStore().token = token;
  }
  return mount(InviteFriendControl);
}

describe('InviteFriendControl', () => {
  test('is not rendered outside a live match (no ?match=)', () => {
    setSearch('');
    const wrapper = mountControl('tok');
    assert.equal(wrapper.find('[data-testid="invite-friend"]').exists(), false);
  });

  test('is not rendered for a guest (no token) even in a live match', () => {
    setSearch('?match=m1');
    const wrapper = mountControl(null);
    assert.equal(wrapper.find('[data-testid="invite-friend"]').exists(), false);
  });

  test('a successful invite POSTs { matchId, handle }, strips a leading @, and confirms', async () => {
    setSearch('?match=m1');
    stubFetch(201, {
      matchId: 'm1',
      inviterHandle: 'me',
      inviterDisplayName: 'Me',
      status: 'pending',
      createdAt: '2026-07-12T00:00:00.000Z',
    });
    const wrapper = mountControl('tok');
    await wrapper.find('[data-testid="invite-friend-handle"]').setValue('@buddy');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    assert.equal(fetchCalls.length, 1);
    assert.ok(fetchCalls[0]!.url.endsWith('/api/match/invites'));
    assert.deepEqual(JSON.parse(String(fetchCalls[0]!.init.body)), {
      matchId: 'm1',
      handle: 'buddy',
    });
    const confirm = wrapper.find('[data-testid="invite-friend-confirm"]');
    assert.ok(confirm.exists());
    assert.ok(confirm.text().includes('@buddy'));
    // FR-2: nothing account-id-shaped in the rendered output.
    assert.ok(!wrapper.html().includes('accountId'));
  });

  test('a not_friends failure shows the friends-list copy', async () => {
    setSearch('?match=m1');
    stubFetch(403, { error: 'not_friends' });
    const wrapper = mountControl('tok');
    await wrapper.find('[data-testid="invite-friend-handle"]').setValue('stranger');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const error = wrapper.find('[data-testid="invite-friend-error"]');
    assert.ok(error.exists());
    assert.ok(error.text().includes('friends list'));
  });

  test('an empty handle sends no request', async () => {
    setSearch('?match=m1');
    stubFetch(201, {});
    const wrapper = mountControl('tok');
    await wrapper.find('[data-testid="invite-friend-handle"]').setValue('   ');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    assert.equal(fetchCalls.length, 0);
  });
});
