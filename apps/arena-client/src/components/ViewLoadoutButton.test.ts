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
  target: string;
}
/** A fake pre-opened tab (models `window.open('', '_blank')` returning a handle). */
interface FakeTab {
  location: { href: string };
  opener: unknown;
  closed: boolean;
  close(): void;
}
let openCalls: OpenCall[] = [];
let lastTab: FakeTab | null = null;
let fetchCalls = 0;

/** Set the page URL so `?match=` is (or is not) present at mount time. */
function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

/**
 * Stub window.open. When `blocked`, returns null (pop-up blocked); otherwise
 * returns a fresh {@link FakeTab} whose `location.href` / `opener` / `close()`
 * the handler drives — modelling the real `window.open('', '_blank')` handle.
 */
function stubOpen(blocked: boolean): void {
  openCalls = [];
  lastTab = null;
  window.open = ((url?: string | URL, target?: string): Window | null => {
    openCalls.push({ url: String(url ?? ''), target: String(target ?? '') });
    if (blocked) {
      return null;
    }
    const tab: FakeTab = {
      location: { href: '' },
      opener: { note: 'non-null until the handler severs it' },
      closed: false,
      close(): void {
        this.closed = true;
      },
    };
    lastTab = tab;
    return tab as unknown as Window;
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

  test('a null token shows the sign-in message and fires no fetch (and opens no tab)', async () => {
    setSearch('?match=m1');
    stubFetch({ lagn: {} });
    stubOpen(false);
    const wrapper = mountButton();
    // token defaults to null (guest)
    await wrapper.find('[data-testid="view-loadout-button"]').trigger('click');
    await flushPromises();

    assert.equal(fetchCalls, 0);
    // pre-open happens AFTER the token check, so a guest opens no tab
    assert.equal(openCalls.length, 0);
    assert.match(
      wrapper.find('[data-testid="view-loadout-status"]').text(),
      /sign in/i,
    );
  });

  test('a successful fetch pre-opens a blank tab then navigates it to the ?lagn= URL', async () => {
    setSearch('?match=m1');
    stubFetch({ lagn: { lagn_version: '1.0.0', game_id: 'm1' } });
    stubOpen(false);
    const wrapper = mountButton();
    useAuthStore().token = 'tok';

    await wrapper.find('[data-testid="view-loadout-button"]').trigger('click');
    await flushPromises();

    assert.equal(fetchCalls, 1);
    // opened synchronously as a blank tab (NOT the final URL, NOT noopener)
    assert.equal(openCalls.length, 1);
    assert.equal(openCalls[0]!.url, '');
    assert.equal(openCalls[0]!.target, '_blank');
    // then navigated to the viewer deep-link, with opener severed
    assert.ok(lastTab, 'a tab handle was returned');
    assert.match(lastTab!.location.href, /\/\?lagn=/);
    assert.equal(lastTab!.location.href.includes('//?'), false);
    assert.equal(lastTab!.opener, null);
    assert.equal(lastTab!.closed, false);
    assert.equal(wrapper.find('[data-testid="view-loadout-status"]').exists(), false);
  });

  test('a genuinely blocked pop-up (window.open → null) shows the message and fires no fetch', async () => {
    setSearch('?match=m1');
    stubFetch({ lagn: {} });
    stubOpen(true);
    const wrapper = mountButton();
    useAuthStore().token = 'tok';

    await wrapper.find('[data-testid="view-loadout-button"]').trigger('click');
    await flushPromises();

    // pre-open failed, so we return before fetching
    assert.equal(fetchCalls, 0);
    assert.match(
      wrapper.find('[data-testid="view-loadout-status"]').text(),
      /blocked|pop-?up/i,
    );
  });

  test('a 403 closes the pre-opened tab (no navigation) and shows the participants-only message', async () => {
    setSearch('?match=m1');
    stubFetch({ error: 'not_a_participant' }, 403);
    stubOpen(false);
    const wrapper = mountButton();
    useAuthStore().token = 'tok';

    await wrapper.find('[data-testid="view-loadout-button"]').trigger('click');
    await flushPromises();

    assert.ok(lastTab, 'a tab was pre-opened');
    assert.equal(lastTab!.closed, true); // the blank tab is closed on failure
    assert.equal(lastTab!.location.href, ''); // never navigated
    assert.match(
      wrapper.find('[data-testid="view-loadout-status"]').text(),
      /only players/i,
    );
  });

  test('an in-flight click is ignored (fetch fires once)', async () => {
    setSearch('?match=m1');
    stubOpen(false);
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
