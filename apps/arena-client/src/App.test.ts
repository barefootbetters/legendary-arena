// why: jsdom globals must be installed before Vue's mount() is called.
import './testing/jsdom-setup';

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import App from './App.vue';
import type { HankoLike } from './auth/hankoClient';

/**
 * Mount App.vue for a given `?...` query (via the `searchOverride` testing
 * seam), stubbing the route child components so their side effects (LobbyView's
 * match-list fetch, the live client, the async pages) never run — this test is
 * about App.vue's own route selection + auth-bootstrap gating.
 *
 * No broker tenant is configured under node:test (`VITE_HANKO_TENANT_BASE_URL`
 * is undefined), so App.vue's bootstrap takes its synchronous
 * `tenantBaseUrl === ''` branch: a guarded route redirects to login, and the
 * public lobby stays put. That makes `data-route` deterministic without mocking
 * the broker SDK.
 */
async function mountApp(searchOverride: string): Promise<string> {
  setActivePinia(createPinia());
  const wrapper = mount(App, {
    props: { searchOverride },
    global: {
      plugins: [createPinia()],
      stubs: {
        // why: render the shell's default slot so the inner <main
        // data-testid="app-root"> is present to read data-route from.
        AppShell: { template: '<div><slot /></div>' },
        LobbyView: true,
        PlayViewport: true,
        ArenaHud: true,
        LoginPage: true,
        MyProfilePage: true,
        AdminBillingPage: true,
        PlayerProfilePage: true,
        SharedLoadoutPage: true,
      },
    },
  });
  await flushPromises();
  const root = wrapper.find('[data-testid="app-root"]');
  return root.attributes('data-route') ?? '(no data-route)';
}

describe('App.vue route + auth-bootstrap gating', () => {
  test('the lobby route renders the lobby and does NOT redirect to login (PR #547: lobby is public + non-blocking)', async () => {
    // why: the lobby hydrates the cached session in the BACKGROUND, but must
    // never redirect on load — even though shouldHydrateSession('lobby') is
    // true. If a regression treated the lobby like a guarded route, this would
    // flip to 'login'.
    assert.equal(await mountApp('?route='), 'lobby');
  });

  test('a bare / empty query falls back to the lobby', async () => {
    assert.equal(await mountApp(''), 'lobby');
  });

  test('a guarded route (?route=me) with no cached session redirects to login', async () => {
    assert.equal(await mountApp('?route=me'), 'login');
  });

  test('the admin-billing guarded route with no cached session redirects to login', async () => {
    assert.equal(await mountApp('?route=admin-billing'), 'login');
  });

  test('an explicit ?route=login renders the login surface', async () => {
    assert.equal(await mountApp('?route=login'), 'login');
  });

  test('the lobby does not show the auth-bootstrapping placeholder (renders immediately)', async () => {
    setActivePinia(createPinia());
    const wrapper = mount(App, {
      props: { searchOverride: '?route=' },
      global: {
        plugins: [createPinia()],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          LobbyView: true,
          PlayViewport: true,
          ArenaHud: true,
          LoginPage: true,
          MyProfilePage: true,
          AdminBillingPage: true,
          PlayerProfilePage: true,
          SharedLoadoutPage: true,
        },
      },
    });
    await flushPromises();
    assert.equal(
      wrapper.find('[data-testid="app-auth-bootstrapping"]').exists(),
      false,
    );
  });
});

describe('App.vue session hydration on the Arena entrance (D-24640)', () => {
  const originalFetch = globalThis.fetch;
  const mountedWrappers: Array<{ unmount: () => void }> = [];
  let requestedUrls: string[] = [];

  /**
   * The match requests made so far, as `/api/...` paths. Analytics posts from
   * App's instrumentation are left out.
   *
   * @returns The requested match paths, in order.
   */
  function matchRequests(): string[] {
    return requestedUrls
      .filter((url) => url.includes('/api/match/'))
      .map((url) => url.slice(url.indexOf('/api/')));
  }

  afterEach(() => {
    for (const wrapper of mountedWrappers) {
      wrapper.unmount();
    }
    mountedWrappers.length = 0;
    globalThis.fetch = originalFetch;
    requestedUrls = [];
  });

  /**
   * Stubs fetch so the authed create / join succeed and the guest route
   * answers too, recording every URL requested.
   */
  function stubMatchRoutes(): void {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      requestedUrls.push(url);
      if (url.endsWith('/api/match/create')) {
        return { ok: true, status: 200, json: async () => ({ matchID: 'created-1' }) } as Response;
      }
      if (url.endsWith('/api/match/create-guest-solo')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ matchId: 'guest-1', seat: '0', credentials: 'guest-cred' }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ playerCredentials: 'secret-1' }) } as Response;
    }) as typeof globalThis.fetch;
  }

  /**
   * Builds a broker fake whose session token is fixed.
   *
   * @param sessionToken The token the broker reports ('' for no session).
   * @returns A minimal HankoLike.
   */
  function makeFakeHanko(sessionToken: string): HankoLike {
    return {
      getSessionToken: () => sessionToken,
      logout: async () => undefined,
      onSessionCreated: () => () => undefined,
      onSessionExpired: () => () => undefined,
      onUserLoggedOut: () => () => undefined,
    };
  }

  /**
   * Mounts App on the bare landing URL with a broker factory that stays
   * pending until the returned `settle` is called.
   *
   * @returns The wrapper plus a function that resolves the broker with a token.
   */
  function mountWithPendingBroker() {
    let resolveBroker: (hanko: HankoLike) => void = () => undefined;
    const factory = () =>
      new Promise<HankoLike>((resolve) => {
        resolveBroker = resolve;
      });
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(App, {
      props: {
        searchOverride: '',
        hankoOverride: { tenantBaseUrl: 'https://tenant.example', factory },
      },
      global: {
        plugins: [pinia],
        stubs: { AppShell: { template: '<div><slot /></div>' } },
      },
    });
    mountedWrappers.push(wrapper);
    return {
      wrapper,
      settle: async (sessionToken: string) => {
        resolveBroker(makeFakeHanko(sessionToken));
        await flushPromises();
      },
    };
  }

  test('a click while a signed-in session is hydrating never starts a guest match; after it settles the click creates signed in', async () => {
    stubMatchRoutes();
    const { wrapper, settle } = mountWithPendingBroker();
    await flushPromises();

    const button = wrapper.find('[data-testid="arena-enter"]');
    assert.equal(button.attributes('disabled'), '');
    assert.equal(wrapper.find('[data-testid="arena-checking-sign-in"]').text(), 'Checking your sign-in…');
    assert.equal(wrapper.find('[data-testid="arena-sign-in-link"]').exists(), false);
    // why: a disabled button swallows the click; strip it to prove the handler
    // itself refuses too, not only the attribute.
    button.element.removeAttribute('disabled');
    await button.trigger('click');
    await flushPromises();
    assert.deepEqual(matchRequests(), []);

    await settle('token-1');
    assert.equal(wrapper.find('[data-testid="arena-checking-sign-in"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="arena-sign-in-link"]').exists(), false);
    await wrapper.find('[data-testid="arena-enter"]').trigger('click');
    await flushPromises();
    assert.deepEqual(matchRequests(), ['/api/match/create', '/api/match/join']);
  });

  test('when hydration settles with no session, the guest helper appears and the click starts a guest match', async () => {
    stubMatchRoutes();
    const { wrapper, settle } = mountWithPendingBroker();
    await flushPromises();
    assert.equal(wrapper.find('[data-testid="arena-sign-in-link"]').exists(), false);

    await settle('');
    assert.equal(wrapper.find('[data-testid="arena-enter"]').attributes('disabled'), undefined);
    assert.equal(wrapper.find('[data-testid="arena-sign-in-link"]').exists(), true);
    await wrapper.find('[data-testid="arena-enter"]').trigger('click');
    await flushPromises();
    assert.deepEqual(matchRequests(), ['/api/match/create-guest-solo']);
  });

  test('with no broker tenant configured, the entrance is never held in the hydrating state', async () => {
    stubMatchRoutes();
    setActivePinia(createPinia());
    const wrapper = mount(App, {
      props: { searchOverride: '' },
      global: {
        plugins: [createPinia()],
        stubs: { AppShell: { template: '<div><slot /></div>' } },
      },
    });
    mountedWrappers.push(wrapper);
    await flushPromises();
    assert.equal(wrapper.find('[data-testid="arena-enter"]').attributes('disabled'), undefined);
    assert.equal(wrapper.find('[data-testid="arena-checking-sign-in"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="arena-sign-in-link"]').exists(), true);
  });
});
