import '../testing/jsdom-setup';

import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';

import WaitingForPlayersPanel from './WaitingForPlayersPanel.vue';
import { useAuthStore } from '../stores/auth';

/**
 * Tests for the pre-match waiting-room panel (WP-369 / EC-398). jsdom +
 * @vue/test-utils mount; `globalThis.fetch` (the lobby seat poll + the invite
 * POST) and `navigator.clipboard` are stubbed. Covers the render-gate (no
 * `?match=`, guest, full), the seat-status text, the invite (fires the
 * composable + typed error copy), the copy-join-link URL, and the no-accountId
 * assertion (FR-2).
 *
 * Authority: WP-369 §Scope; EC-398; D-24163.
 */

enableAutoUnmount(afterEach);

const originalFetch = globalThis.fetch;
const originalClipboard = globalThis.navigator?.clipboard;

interface StubResponse {
  status: number;
  body: unknown;
}
let routeHandler: (url: string, init: RequestInit) => StubResponse;
let clipboardWrites: string[] = [];

/** A lobby list body for one match with the given seat names (undefined = open). */
function lobbyBody(matchID: string, seatNames: (string | undefined)[]): unknown {
  const players = seatNames.map((name, index) =>
    name === undefined ? { id: index } : { id: index, name },
  );
  return { matches: [{ matchID, players }] };
}

function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

function installStubs(): void {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const { status, body } = routeHandler(String(url), init ?? {});
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    } as Response;
  }) as typeof globalThis.fetch;

  clipboardWrites = [];
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        clipboardWrites.push(text);
      },
    },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });
});

/** Mount with a fresh Pinia; sign in before mount so the auth-gated panel renders. */
function mountPanel(token: string | null) {
  setActivePinia(createPinia());
  if (token !== null) {
    useAuthStore().token = token;
  }
  return mount(WaitingForPlayersPanel);
}

describe('WaitingForPlayersPanel', () => {
  test('is not rendered outside a live match (no ?match=)', async () => {
    setSearch('');
    routeHandler = () => ({ status: 200, body: { matches: [] } });
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    assert.equal(wrapper.find('[data-testid="waiting-room"]').exists(), false);
  });

  test('is not rendered for a guest even with an open seat', async () => {
    setSearch('?match=m1');
    routeHandler = () => ({ status: 200, body: lobbyBody('m1', ['host', undefined]) });
    installStubs();
    const wrapper = mountPanel(null);
    await flushPromises();
    assert.equal(wrapper.find('[data-testid="waiting-room"]').exists(), false);
  });

  test('is not rendered when the match is full', async () => {
    setSearch('?match=m1');
    routeHandler = () => ({ status: 200, body: lobbyBody('m1', ['host', 'guest']) });
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    assert.equal(wrapper.find('[data-testid="waiting-room"]').exists(), false);
  });

  test('renders the seat status while a seat is open', async () => {
    setSearch('?match=m1');
    routeHandler = () => ({ status: 200, body: lobbyBody('m1', ['host', undefined]) });
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    assert.ok(wrapper.find('[data-testid="waiting-room"]').exists());
    assert.ok(
      wrapper.find('[data-testid="waiting-room-title"]').text().includes('1 of 2'),
    );
    // FR-2: nothing account-id-shaped in the rendered output.
    assert.ok(!wrapper.html().includes('accountId'));
  });

  test('Invite POSTs the handle (leading @ stripped) and confirms', async () => {
    setSearch('?match=m1');
    routeHandler = (url, init) => {
      if (url.endsWith('/api/match/invites') && init.method === 'POST') {
        return {
          status: 201,
          body: {
            matchId: 'm1',
            inviterHandle: 'me',
            inviterDisplayName: 'Me',
            status: 'pending',
            createdAt: '2026-07-13T00:00:00.000Z',
          },
        };
      }
      return { status: 200, body: lobbyBody('m1', ['host', undefined]) };
    };
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    await wrapper.find('[data-testid="waiting-room-handle"]').setValue('@buddy');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    const confirm = wrapper.find('[data-testid="waiting-room-confirm"]');
    assert.ok(confirm.exists());
    assert.ok(confirm.text().includes('@buddy'));
  });

  test('a not_friends invite failure shows the friends-list copy', async () => {
    setSearch('?match=m1');
    routeHandler = (url, init) => {
      if (url.endsWith('/api/match/invites') && init.method === 'POST') {
        return { status: 403, body: { error: 'not_friends' } };
      }
      return { status: 200, body: lobbyBody('m1', ['host', undefined]) };
    };
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    await wrapper.find('[data-testid="waiting-room-handle"]').setValue('stranger');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    const error = wrapper.find('[data-testid="waiting-room-error"]');
    assert.ok(error.exists());
    assert.ok(error.text().includes('friends list'));
  });

  test('Copy join link writes a lobby deep-link with no secret', async () => {
    setSearch('?match=m1');
    routeHandler = () => ({ status: 200, body: lobbyBody('m1', ['host', undefined]) });
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    await wrapper.find('[data-testid="waiting-room-copy-link"]').trigger('click');
    await flushPromises();
    assert.equal(clipboardWrites.length, 1);
    assert.ok(clipboardWrites[0]!.includes('/?route=lobby&match=m1'));
    assert.ok(!clipboardWrites[0]!.includes('credentials'));
    assert.ok(wrapper.find('[data-testid="waiting-room-link-copied"]').exists());
  });
});
