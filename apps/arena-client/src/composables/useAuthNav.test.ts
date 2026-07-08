// why: jsdom globals must be installed before Vue's mount() is called.
import '../testing/jsdom-setup';

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { defineComponent, ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import {
  useAuthNav,
  resolveDisplayLabel,
  type AuthNavState,
} from './useAuthNav';
import { useAuthStore } from '../stores/auth';
import type { OwnerProfileView } from '../lib/api/ownerProfileApi';

// why: WP-330 wires useAuthNav to fetchOwnerProfile, which calls the global
// fetch. The stub counts calls (to prove fetch-once) and returns the owner
// profile the test wants; the default is a non-ok 401 so signed-in tests that
// do not care about the label never hit the network and keep the fallback.
const originalFetch = globalThis.fetch;
let fetchCallCount = 0;

function stubFetch(handler: () => Response): void {
  globalThis.fetch = (async (): Promise<Response> => {
    fetchCallCount += 1;
    return handler();
  }) as typeof fetch;
}

/**
 * Build a 200 owner-profile Response with sensible defaults, overriding the
 * identity fields the label depends on.
 */
function ownerProfileResponse(
  overrides: Partial<OwnerProfileView>,
): Response {
  const view: OwnerProfileView = {
    accountId: 'acc-1',
    displayName: 'Nova',
    handleCanonical: 'nova',
    avatarUrl: null,
    aboutMe: null,
    avatarVisibility: 'private',
    aboutMeVisibility: 'private',
    linksVisibility: 'private',
    links: [],
    updatedAt: null,
    ...overrides,
  };
  return new Response(JSON.stringify(view), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchCallCount = 0;
  stubFetch(() => new Response('{}', { status: 401 }));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * Mount a minimal wrapper component that calls useAuthNav() in setup,
 * providing proper inject context and Pinia.
 */
function mountAuthNav(options?: {
  isBootstrapping?: boolean;
  token?: string | null;
}): { state: AuthNavState; pinia: ReturnType<typeof createPinia> } {
  const pinia = createPinia();
  setActivePinia(pinia);

  if (options?.token !== undefined && options.token !== null) {
    useAuthStore().setSession(options.token, null);
  }

  let captured!: AuthNavState;

  const TestHost = defineComponent({
    setup() {
      captured = useAuthNav();
      return { captured };
    },
    template: '<div />',
  });

  mount(TestHost, {
    global: {
      plugins: [pinia],
      provide: {
        isAuthBootstrapping: ref(options?.isBootstrapping ?? false),
      },
    },
  });

  return { state: captured, pinia };
}

describe('useAuthNav (WP-175)', () => {
  test('bootstrapping state: isBootstrapping is true when provided as true', () => {
    const { state } = mountAuthNav({ isBootstrapping: true });
    assert.equal(state.isBootstrapping.value, true);
  });

  test('bootstrapping state: displayLabel is "My account" regardless of auth', () => {
    const { state } = mountAuthNav({ isBootstrapping: true, token: 'tok-1' });
    assert.equal(state.displayLabel.value, 'My account');
  });

  test('signed-out state: isSignedIn is false when no token is set', () => {
    const { state } = mountAuthNav({ isBootstrapping: false });
    assert.equal(state.isSignedIn.value, false);
  });

  test('signed-out state: displayLabel is "My account" when signed out', () => {
    const { state } = mountAuthNav({ isBootstrapping: false });
    assert.equal(state.displayLabel.value, 'My account');
  });

  test('signed-in state: isSignedIn is true when a token is present', () => {
    const { state } = mountAuthNav({ token: 'tok-abc' });
    assert.equal(state.isSignedIn.value, true);
  });

  test('signed-in state: displayLabel resolves to the fetched displayName', async () => {
    stubFetch(() => ownerProfileResponse({ displayName: 'Nova' }));
    const { state } = mountAuthNav({ token: 'tok-abc' });
    await flushPromises();
    assert.equal(state.displayLabel.value, 'Nova');
  });

  test('signed-in state: empty displayName falls back to @handleCanonical', async () => {
    stubFetch(() =>
      ownerProfileResponse({ displayName: '   ', handleCanonical: 'nova' }),
    );
    const { state } = mountAuthNav({ token: 'tok-abc' });
    await flushPromises();
    assert.equal(state.displayLabel.value, '@nova');
  });

  test('signed-in state: a non-ok profile fetch leaves the "My account" fallback', async () => {
    // beforeEach installs a 401 stub; the label must stay at the fallback.
    const { state } = mountAuthNav({ token: 'tok-abc' });
    await flushPromises();
    assert.equal(state.displayLabel.value, 'My account');
  });

  test('signed-in state: the owner profile is fetched at most once per session', async () => {
    stubFetch(() => ownerProfileResponse({ displayName: 'Nova' }));
    mountAuthNav({ token: 'tok-abc' });
    await flushPromises();
    assert.equal(fetchCallCount, 1);
  });

  test('isBootstrapping defaults to true when no provide is injected', () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    let captured!: AuthNavState;

    const TestHost = defineComponent({
      setup() {
        captured = useAuthNav();
        return {};
      },
      template: '<div />',
    });

    // Mount WITHOUT providing isAuthBootstrapping — the inject default
    // ref(true) should kick in as the fail-safe.
    mount(TestHost, { global: { plugins: [pinia] } });

    assert.equal(captured.isBootstrapping.value, true);
  });

  test('signOut is a function on the returned state', () => {
    const { state } = mountAuthNav({ token: 'tok-signout' });
    assert.equal(typeof state.signOut, 'function');
  });
});

describe('resolveDisplayLabel (WP-330 / D-24116)', () => {
  /** Build an OwnerProfileView with only the two identity fields that matter. */
  function viewWith(
    displayName: string,
    handleCanonical: string | null,
  ): OwnerProfileView {
    return {
      accountId: 'acc-1',
      displayName,
      handleCanonical,
      avatarUrl: null,
      aboutMe: null,
      avatarVisibility: 'private',
      aboutMeVisibility: 'private',
      linksVisibility: 'private',
      links: [],
      updatedAt: null,
    };
  }

  test('prefers the trimmed displayName when non-empty', () => {
    assert.equal(resolveDisplayLabel(viewWith('  Nova  ', 'nova')), 'Nova');
  });

  test('falls back to @handleCanonical when displayName is blank', () => {
    assert.equal(resolveDisplayLabel(viewWith('   ', 'nova')), '@nova');
  });

  test('falls back to "My account" when both are absent', () => {
    assert.equal(resolveDisplayLabel(viewWith('', null)), 'My account');
  });
});
