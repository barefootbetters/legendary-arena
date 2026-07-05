// why: jsdom globals must be installed before Vue's mount() is called.
import './testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import App from './App.vue';

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
