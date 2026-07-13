import '../testing/jsdom-setup';

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';

import LobbyView from './LobbyView.vue';

/**
 * Tests for the WP-369 / EC-398 addition to the lobby: the copy-join-link deep
 * link (`?route=lobby&match=<id>`) orders the matching row first and highlights
 * it. Only the highlight behaviour is exercised here (the lobby's create/join
 * flows are covered by lobbyApi/lobbyMatchFilter suites).
 */

enableAutoUnmount(afterEach);

const originalFetch = globalThis.fetch;

/** A raw lobby seat (undefined name = open). */
function rawMatch(matchID: string, seatNames: (string | undefined)[]) {
  return {
    matchID,
    players: seatNames.map((name, index) =>
      name === undefined ? { id: index } : { id: index, name },
    ),
  };
}

/** Stub fetch so the lobby list returns the given raw matches. */
function stubMatches(matches: unknown[]): void {
  globalThis.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({ matches }),
    }) as Response) as typeof globalThis.fetch;
}

function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mountLobby() {
  setActivePinia(createPinia());
  return mount(LobbyView);
}

test('?match=<id> orders the matching row first and highlights it', async () => {
  setSearch('?route=lobby&match=m2');
  // m1 and m2 are both joinable (one open seat each, not gameover)
  stubMatches([
    rawMatch('m1', ['host', undefined]),
    rawMatch('m2', ['host', undefined]),
  ]);
  const wrapper = mountLobby();
  await flushPromises();

  const rows = wrapper.findAll('.match-row');
  assert.equal(rows.length, 2);
  // the highlighted match is ordered first...
  assert.equal(rows[0]!.find('[data-match-id]').attributes('data-match-id'), 'm2');
  // ...and carries the highlight class; the other row does not
  assert.ok(rows[0]!.classes().includes('match-row--highlight'));
  assert.ok(!rows[1]!.classes().includes('match-row--highlight'));
});

test('with no ?match= param no row is highlighted and order is preserved', async () => {
  setSearch('?route=lobby');
  stubMatches([
    rawMatch('m1', ['host', undefined]),
    rawMatch('m2', ['host', undefined]),
  ]);
  const wrapper = mountLobby();
  await flushPromises();

  const rows = wrapper.findAll('.match-row');
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.find('[data-match-id]').attributes('data-match-id'), 'm1');
  assert.ok(!rows[0]!.classes().includes('match-row--highlight'));
  assert.ok(!rows[1]!.classes().includes('match-row--highlight'));
});
