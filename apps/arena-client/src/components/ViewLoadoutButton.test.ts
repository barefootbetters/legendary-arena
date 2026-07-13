import '../testing/jsdom-setup';

import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';

import ViewLoadoutButton from './ViewLoadoutButton.vue';
import { useAuthStore } from '../stores/auth';

/**
 * Tests for the in-match "View loadout in Registry Viewer" control (WP-363 /
 * EC-393). jsdom + @vue/test-utils mount; `globalThis.fetch` and `window.open`
 * are stubbed. Covers the render-gate (no `?match=`), the null-token
 * short-circuit (no fetch), the success `window.open` (noopener + `?lagn=`), the
 * pop-up-blocked fallback, the 403 message, and the in-flight guard.
 *
 * Authority: WP-363 §Scope (In) §E; EC-393; D-24155.
 */

enableAutoUnmount(afterEach);

const originalFetch = globalThis.fetch;
const originalOpen = window.open;

interface OpenCall {
  url: string;
  target?: string;
  features?: string;
}
let openCalls: OpenCall[] = [];
let fetchCalls = 0;

/** Set the page URL so `?match=` is (or is not) present at mount time. */
function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

/** Stub window.open to record calls and return the supplied handle. */
function stubOpen(returns: Window | null): void {
  openCalls = [];
  window.open = ((url?: string | URL): Window | null => {
    openCalls.push({ url: String(url), target: '_blank', features: 'noopener' });
    return returns;
  }) as typeof window.open;
}

/** Stub fetch to return a canned JSON Response. */
function stubFetch(body: unknown, status = 200): void {
  fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  window.open = originalOpen;
});

function mountButton() {
  setActivePinia(createPinia());
  return mount(ViewLoadoutButton);
}

describe('ViewLoadoutButton', () => {
  test('is not rendered outside a live match (no ?match=)', () => {
    setSearch('');
    const wrapper = mountButton();
    assert.equal(wrapper.find('[data-testid="view-loadout-button"]').exists(), false);
  });

  test('a null token shows the sign-in message and fires no fetch', async () => {
    setSearch('?match=m1');
    stubFetch({ lagn: {} });
    stubOpen({} as Window);
    const wrapper = mountButton();
    // token defaults to null (guest)
    await wrapper.find('[data-testid="view-loadout-button"]').trigger('click');
    await flushPromises();

    assert.equal(fetchCalls, 0);
    assert.equal(openCalls.length, 0);
    assert.match(
      wrapper.find('[data-testid="view-loadout-status"]').text(),
      /sign in/i,
    );
  });

  test('a successful fetch opens the viewer with a ?lagn= URL and noopener', async () => {
    setSearch('?match=m1');
    stubFetch({ lagn: { lagn_version: '1.0.0', game_id: 'm1' } });
    stubOpen({} as Window);
    const wrapper = mountButton();
    useAuthStore().token = 'tok';

    await wrapper.find('[data-testid="view-loadout-button"]').trigger('click');
    await flushPromises();

    assert.equal(fetchCalls, 1);
    assert.equal(openCalls.length, 1);
    assert.match(openCalls[0]!.url, /\/\?lagn=/);
    assert.equal(openCalls[0]!.url.includes('//?'), false);
    assert.equal(openCalls[0]!.features, 'noopener');
    assert.equal(wrapper.find('[data-testid="view-loadout-status"]').exists(), false);
  });

  test('a blocked pop-up (window.open → null) shows the fallback message', async () => {
    setSearch('?match=m1');
    stubFetch({ lagn: {} });
    stubOpen(null);
    const wrapper = mountButton();
    useAuthStore().token = 'tok';

    await wrapper.find('[data-testid="view-loadout-button"]').trigger('click');
    await flushPromises();

    assert.match(
      wrapper.find('[data-testid="view-loadout-status"]').text(),
      /blocked|pop-?up/i,
    );
  });

  test('a 403 shows the participants-only message and opens no tab', async () => {
    setSearch('?match=m1');
    stubFetch({ error: 'not_a_participant' }, 403);
    stubOpen({} as Window);
    const wrapper = mountButton();
    useAuthStore().token = 'tok';

    await wrapper.find('[data-testid="view-loadout-button"]').trigger('click');
    await flushPromises();

    assert.equal(openCalls.length, 0);
    assert.match(
      wrapper.find('[data-testid="view-loadout-status"]').text(),
      /only players/i,
    );
  });

  test('an in-flight click is ignored (fetch fires once)', async () => {
    setSearch('?match=m1');
    stubOpen({} as Window);
    // a deferred fetch we resolve manually to hold the first call in flight
    let resolveFetch: (r: Response) => void = () => {};
    fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    }) as typeof globalThis.fetch;

    const wrapper = mountButton();
    useAuthStore().token = 'tok';

    // fire two clicks before the first fetch resolves
    const first = (wrapper.vm as unknown as { onViewLoadout: () => Promise<void> }).onViewLoadout();
    const second = (wrapper.vm as unknown as { onViewLoadout: () => Promise<void> }).onViewLoadout();
    assert.equal(fetchCalls, 1);

    resolveFetch(
      new Response(JSON.stringify({ lagn: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await Promise.all([first, second]);
    await flushPromises();
    assert.equal(fetchCalls, 1);
  });
});
