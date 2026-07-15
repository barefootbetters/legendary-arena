import '../testing/jsdom-setup';

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { defineComponent } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';

import { useAnalyticsCapture } from './useAnalyticsCapture';
import { useAuthStore } from '../stores/auth';
import { useUiStateStore } from '../stores/uiState';
import type { UIState } from '@legendary-arena/game-engine';

const originalFetch = globalThis.fetch;
let capturedEvents: Array<{ event_type: string; user_id: string | null }> = [];

/** Records every emitted analytics event by parsing the POST body. */
function installCaptureStub(): void {
  capturedEvents = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { event_type: string; user_id: string | null };
    capturedEvents.push({ event_type: body.event_type, user_id: body.user_id });
    return { ok: true, status: 200, async json() { return {}; }, async text() { return ''; } } as Response;
  }) as typeof globalThis.fetch;
}

/** Event types captured so far. */
function firedTypes(): string[] {
  return capturedEvents.map((event) => event.event_type);
}

/** Mount a throwaway component whose setup wires the analytics hub. */
function mountHub() {
  const Host = defineComponent({
    setup() {
      useAnalyticsCapture();
      return () => null;
    },
  });
  return mount(Host);
}

/** A minimal UIState with the given phase and optional gameOver. */
function snapshot(phase: string, gameOver?: unknown): UIState {
  return { game: { phase }, ...(gameOver !== undefined ? { gameOver } : {}) } as unknown as UIState;
}

beforeEach(() => {
  setActivePinia(createPinia());
  installCaptureStub();
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('emits the channel event exactly once on mount (direct in the test env)', async () => {
  mountHub();
  await flushPromises();

  const channelEvents = capturedEvents.filter((event) =>
    ['direct', 'search', 'referral', 'paid'].includes(event.event_type),
  );
  assert.equal(channelEvents.length, 1, 'one channel event on mount');
  assert.equal(channelEvents[0]!.event_type, 'direct');
  assert.equal(channelEvents[0]!.user_id, null, 'channel event is anonymous');
});

test('signup-complete fires on the first authenticated transition with the account id', async () => {
  mountHub();
  await flushPromises();
  assert.equal(firedTypes().includes('signup-complete'), false, 'not fired before auth');

  useAuthStore().setSession('token-1', 'acct-42');
  await flushPromises();

  const signup = capturedEvents.find((event) => event.event_type === 'signup-complete');
  assert.ok(signup, 'signup-complete fired on the first authenticated transition');
  assert.equal(signup!.user_id, 'acct-42');
});

test('signup-complete does NOT fire for a returning sign-in (flag already set)', async () => {
  localStorage.setItem('legendary-arena.analytics.signup-complete', '1');
  mountHub();
  await flushPromises();

  useAuthStore().setSession('token-1', 'acct-42');
  await flushPromises();

  assert.equal(firedTypes().includes('signup-complete'), false, 'returning sign-in does not re-fire signup-complete');
});

test('retention-return fires for a returning authed user past the 1-day threshold', async () => {
  localStorage.setItem('legendary-arena.analytics.signup-complete', '1');
  localStorage.setItem('legendary-arena.analytics.last-visit', String(Date.now() - 2 * 86_400_000));
  mountHub();
  await flushPromises();

  useAuthStore().setSession('token-1', 'acct-7');
  await flushPromises();

  assert.equal(firedTypes().includes('retention-return'), true, 'retention-return fired');
  assert.equal(firedTypes().includes('signup-complete'), false, 'not a signup-complete');
});

test('retention-return does NOT fire when the last visit is recent', async () => {
  localStorage.setItem('legendary-arena.analytics.signup-complete', '1');
  localStorage.setItem('legendary-arena.analytics.last-visit', String(Date.now() - 60_000));
  mountHub();
  await flushPromises();

  useAuthStore().setSession('token-1', 'acct-7');
  await flushPromises();

  assert.equal(firedTypes().includes('retention-return'), false, 'recent visit is not a return');
});

test('retention-return does NOT fire for an anonymous (unauthenticated) visitor', async () => {
  localStorage.setItem('legendary-arena.analytics.signup-complete', '1');
  localStorage.setItem('legendary-arena.analytics.last-visit', String(Date.now() - 3 * 86_400_000));
  mountHub();
  await flushPromises();

  assert.equal(firedTypes().includes('retention-return'), false, 'retention needs authentication');
});

test('first-match-started and first-match-completed each fire once, guarded by localStorage', async () => {
  const uiStore = useUiStateStore();
  useAuthStore().setSession('token-1', 'acct-9');
  mountHub();
  await flushPromises();

  uiStore.setSnapshot(snapshot('play'));
  await flushPromises();
  assert.equal(firedTypes().filter((t) => t === 'first-match-started').length, 1, 'first-match-started once');

  // a second play snapshot must NOT re-fire (localStorage flag guards it)
  uiStore.setSnapshot(null);
  await flushPromises();
  uiStore.setSnapshot(snapshot('play'));
  await flushPromises();
  assert.equal(firedTypes().filter((t) => t === 'first-match-started').length, 1, 'still once');

  uiStore.setSnapshot(snapshot('end', { outcome: 'heroes-win' }));
  await flushPromises();
  assert.equal(firedTypes().filter((t) => t === 'first-match-completed').length, 1, 'first-match-completed once');
});
