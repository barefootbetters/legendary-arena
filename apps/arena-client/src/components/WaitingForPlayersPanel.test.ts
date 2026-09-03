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
      // why: the WP-628 addGuest wrapper reads response.text() on a non-2xx to
      // build its error message; provide it so a stubbed failure surfaces the
      // real status (not a "text is not a function" TypeError).
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
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

  test('renders an Add guest button while a seat is open (WP-628)', async () => {
    setSearch('?match=m1');
    routeHandler = () => ({ status: 200, body: lobbyBody('m1', ['host', undefined]) });
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    assert.ok(wrapper.find('[data-testid="waiting-room-add-guest"]').exists());
  });

  test('D-24447: Add guest is hidden when a guest password is set (seat kept open for lobby join)', async () => {
    setSearch('?match=m1');
    routeHandler = (url) => {
      if (url.includes('/guest-access')) {
        return {
          status: 200,
          body: { matchId: 'm1', gameName: 'Grandkids', hasGuestPassword: true },
        };
      }
      return { status: 200, body: lobbyBody('m1', ['host', undefined]) };
    };
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    // the panel still renders (open seat), but "Add guest" is gone so the seat
    // stays open for the lobby "Join as guest" flow; the set-password affordance
    // remains.
    assert.ok(wrapper.find('[data-testid="waiting-room"]').exists());
    assert.equal(wrapper.find('[data-testid="waiting-room-add-guest"]').exists(), false);
    assert.ok(wrapper.find('[data-testid="waiting-room-set-guest-password"]').exists());
  });

  test('Add guest calls /api/match/add-guest and builds a ?match&player&credentials guest link', async () => {
    setSearch('?match=m1');
    routeHandler = (url, init) => {
      if (url.endsWith('/api/match/add-guest') && init.method === 'POST') {
        return { status: 200, body: { matchId: 'm1', seat: '1', credentials: 'guest-secret' } };
      }
      return { status: 200, body: lobbyBody('m1', ['host', undefined]) };
    };
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    await wrapper.find('[data-testid="waiting-room-add-guest"]').trigger('click');
    await flushPromises();
    assert.ok(wrapper.find('[data-testid="waiting-room-guest"]').exists());
    await wrapper.find('[data-testid="waiting-room-copy-guest"]').trigger('click');
    await flushPromises();
    const guestUrl = clipboardWrites[clipboardWrites.length - 1]!;
    assert.ok(guestUrl.includes('?match=m1'));
    assert.ok(guestUrl.includes('player=1'));
    assert.ok(guestUrl.includes('credentials=guest-secret'));
  });

  test('Open guest seat opens the guest link in a new tab', async () => {
    setSearch('?match=m1');
    routeHandler = (url, init) => {
      if (url.endsWith('/api/match/add-guest') && init.method === 'POST') {
        return { status: 200, body: { matchId: 'm1', seat: '1', credentials: 'guest-secret' } };
      }
      return { status: 200, body: lobbyBody('m1', ['host', undefined]) };
    };
    installStubs();
    const opened: string[] = [];
    const originalOpen = window.open;
    window.open = ((url?: string | URL) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
    try {
      const wrapper = mountPanel('tok');
      await flushPromises();
      await wrapper.find('[data-testid="waiting-room-add-guest"]').trigger('click');
      await flushPromises();
      await wrapper.find('[data-testid="waiting-room-open-guest"]').trigger('click');
      assert.equal(opened.length, 1);
      assert.ok(opened[0]!.includes('?match=m1'));
      assert.ok(opened[0]!.includes('player=1'));
      assert.ok(opened[0]!.includes('credentials=guest-secret'));
    } finally {
      window.open = originalOpen;
    }
  });

  test('a full match (409) shows the match-full copy', async () => {
    setSearch('?match=m1');
    routeHandler = (url, init) => {
      if (url.endsWith('/api/match/add-guest') && init.method === 'POST') {
        return { status: 409, body: { error: 'the match is full' } };
      }
      return { status: 200, body: lobbyBody('m1', ['host', undefined]) };
    };
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    await wrapper.find('[data-testid="waiting-room-add-guest"]').trigger('click');
    await flushPromises();
    const error = wrapper.find('[data-testid="waiting-room-add-guest-error"]');
    assert.ok(error.exists());
    assert.ok(error.text().includes('full'));
  });

  test('a non-409 add-guest failure shows the generic retry copy', async () => {
    setSearch('?match=m1');
    routeHandler = (url, init) => {
      if (url.endsWith('/api/match/add-guest') && init.method === 'POST') {
        return { status: 500, body: { error: 'boom' } };
      }
      return { status: 200, body: lobbyBody('m1', ['host', undefined]) };
    };
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    await wrapper.find('[data-testid="waiting-room-add-guest"]').trigger('click');
    await flushPromises();
    const error = wrapper.find('[data-testid="waiting-room-add-guest-error"]');
    assert.ok(error.exists());
    assert.ok(error.text().includes('try again'));
  });

  test('WP-629: Done dismisses the guest hand-off (which persists until then)', async () => {
    setSearch('?match=m1');
    routeHandler = (url, init) => {
      if (url.endsWith('/api/match/add-guest') && init.method === 'POST') {
        return { status: 200, body: { matchId: 'm1', seat: '1', credentials: 'guest-secret' } };
      }
      return { status: 200, body: lobbyBody('m1', ['host', undefined]) };
    };
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    await wrapper.find('[data-testid="waiting-room-add-guest"]').trigger('click');
    await flushPromises();
    assert.ok(wrapper.find('[data-testid="waiting-room-guest"]').exists());
    await wrapper.find('[data-testid="waiting-room-guest-done"]').trigger('click');
    await flushPromises();
    assert.equal(wrapper.find('[data-testid="waiting-room-guest"]').exists(), false);
  });

  // --- WP-634: in-match "Set guest password" (D-24441) ---

  test('WP-634: "Set guest password" opens a form that prefills the name and keeps the password blank', async () => {
    setSearch('?match=m1');
    routeHandler = (url) => {
      if (url.includes('/api/match/m1/guest-access')) {
        return { status: 200, body: { matchId: 'm1', gameName: 'Grandkids', hasGuestPassword: true } };
      }
      return { status: 200, body: lobbyBody('m1', ['host', undefined]) };
    };
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    await wrapper.find('[data-testid="waiting-room-set-guest-password"]').trigger('click');
    await flushPromises();
    const nameInput = wrapper.find('[data-testid="waiting-room-guest-name"]').element as HTMLInputElement;
    const pwInput = wrapper.find('[data-testid="waiting-room-guest-pw"]').element as HTMLInputElement;
    assert.equal(nameInput.value, 'Grandkids', 'name prefilled from the public meta');
    assert.equal(pwInput.value, '', 'password field is write-only (never shows a stored value)');
    assert.equal(pwInput.type, 'password');
    // the hand-off hint names where the guest goes (the lobby, not this screen)
    const hint = wrapper.find('[data-testid="waiting-room-guest-pw-hint"]');
    assert.ok(hint.exists());
    assert.match(hint.text(), /join from the lobby using this password/i);
  });

  test('WP-634: Save POSTs to set-guest-access with the bearer; a name-only save omits the password', async () => {
    setSearch('?match=m1');
    const posts: { url: string; init: RequestInit }[] = [];
    routeHandler = (url, init) => {
      if (url.includes('/api/match/m1/guest-access') && (init.method ?? 'GET') === 'GET') {
        return { status: 200, body: { matchId: 'm1', gameName: '', hasGuestPassword: false } };
      }
      if (url.endsWith('/api/match/set-guest-access') && init.method === 'POST') {
        posts.push({ url, init });
        return { status: 200, body: { matchId: 'm1', gameName: 'Grandkids', hasGuestPassword: true } };
      }
      return { status: 200, body: lobbyBody('m1', ['host', undefined]) };
    };
    installStubs();
    const wrapper = mountPanel('host-token');
    await flushPromises();
    await wrapper.find('[data-testid="waiting-room-set-guest-password"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="waiting-room-guest-name"]').setValue('Grandkids');
    await wrapper.find('[data-testid="waiting-room-guest-pw"]').setValue('apple');
    await wrapper.find('[data-testid="waiting-room-guest-password-form"]').trigger('submit');
    await flushPromises();
    assert.equal(posts.length, 1);
    assert.equal(
      (posts[0]!.init.headers as Record<string, string>).Authorization,
      'Bearer host-token',
    );
    const body = JSON.parse(String(posts[0]!.init.body)) as Record<string, unknown>;
    assert.equal(body.gameName, 'Grandkids');
    assert.equal(body.password, 'apple');
    assert.match(wrapper.find('[data-testid="waiting-room-guest-pw-status"]').text(), /Saved/);

    // a subsequent rename (blank password) must OMIT the password field. The form
    // stays open after a save (showing the status), and the password field is
    // cleared to blank — so just edit the name and resubmit.
    posts.length = 0;
    await wrapper.find('[data-testid="waiting-room-guest-name"]').setValue('Renamed');
    await wrapper.find('[data-testid="waiting-room-guest-password-form"]').trigger('submit');
    await flushPromises();
    const renameBody = JSON.parse(String(posts[0]!.init.body)) as Record<string, unknown>;
    assert.equal(renameBody.gameName, 'Renamed');
    assert.equal('password' in renameBody, false, 'a blank password is omitted (kept as-is)');
  });

  test('WP-634: a 403 from set-guest-access shows the "must be in this game" line', async () => {
    setSearch('?match=m1');
    routeHandler = (url, init) => {
      if (url.includes('/api/match/m1/guest-access') && (init.method ?? 'GET') === 'GET') {
        return { status: 200, body: { matchId: 'm1', gameName: '', hasGuestPassword: false } };
      }
      if (url.endsWith('/api/match/set-guest-access') && init.method === 'POST') {
        return { status: 403, body: { error: 'not a participant' } };
      }
      return { status: 200, body: lobbyBody('m1', ['host', undefined]) };
    };
    installStubs();
    const wrapper = mountPanel('tok');
    await flushPromises();
    await wrapper.find('[data-testid="waiting-room-set-guest-password"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="waiting-room-guest-pw"]').setValue('apple');
    await wrapper.find('[data-testid="waiting-room-guest-password-form"]').trigger('submit');
    await flushPromises();
    assert.match(wrapper.find('[data-testid="waiting-room-guest-pw-status"]').text(), /must be in this game/i);
  });
});
