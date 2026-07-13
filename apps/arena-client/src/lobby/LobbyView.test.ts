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

// --- WP-371: player-count pre-submit check on the manual create form ---

const SETUP_REQUIREMENTS = {
  1: { villainGroupCount: 1, henchmenGroupCount: 1, villainDeckBystanderCount: 1, heroCount: 3 },
  2: { villainGroupCount: 2, henchmenGroupCount: 1, villainDeckBystanderCount: 2, heroCount: 5 },
  3: { villainGroupCount: 3, henchmenGroupCount: 1, villainDeckBystanderCount: 8, heroCount: 5 },
  4: { villainGroupCount: 3, henchmenGroupCount: 2, villainDeckBystanderCount: 8, heroCount: 5 },
  5: { villainGroupCount: 4, henchmenGroupCount: 2, villainDeckBystanderCount: 12, heroCount: 6 },
};

/** Stub fetch: serve the requirements for the setup endpoint, empty match list otherwise. */
function stubWithRequirements(requirements: unknown): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/match/setup-requirements')) {
      return { ok: true, status: 200, json: async () => ({ requirements }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ matches: [] }) } as Response;
  }) as typeof globalThis.fetch;
}

async function setManualComposition(
  wrapper: ReturnType<typeof mountLobby>,
  values: { numPlayers: string; villains: string; henchmen: string; heroes: string },
): Promise<void> {
  await wrapper.find('#numPlayers').setValue(values.numPlayers);
  await wrapper.find('#villainGroupIds').setValue(values.villains);
  await wrapper.find('#henchmanGroupIds').setValue(values.henchmen);
  await wrapper.find('#heroDeckIds').setValue(values.heroes);
}

test('WP-371: a manual composition that does not match the player count warns and disables Create', async () => {
  setSearch('?route=lobby');
  stubWithRequirements(SETUP_REQUIREMENTS);
  const wrapper = mountLobby();
  await flushPromises();

  // 2 players needs 2 villain groups / 1 henchman / 5 heroes; provide 1 / 1 / 5.
  await setManualComposition(wrapper, { numPlayers: '2', villains: 'core/x', henchmen: 'core/h', heroes: 'a,b,c,d,e' });

  const warnings = wrapper.find('[data-testid="lobby-manual-player-count-warnings"]');
  assert.ok(warnings.exists(), 'a player-count warning should render on a mismatch');
  assert.match(warnings.text(), /2-player match needs 2 villain groups/);
  const createButton = wrapper.find('[data-testid="lobby-submit-create"]');
  assert.ok(
    (createButton.element as HTMLButtonElement).disabled,
    'Create must be disabled while the composition does not match the player count',
  );
});

test('WP-371: a manual composition that matches the player count clears the warning and enables Create', async () => {
  setSearch('?route=lobby');
  stubWithRequirements(SETUP_REQUIREMENTS);
  const wrapper = mountLobby();
  await flushPromises();

  await setManualComposition(wrapper, { numPlayers: '2', villains: 'core/x,core/y', henchmen: 'core/h', heroes: 'a,b,c,d,e' });

  assert.ok(
    !wrapper.find('[data-testid="lobby-manual-player-count-warnings"]').exists(),
    'no warning should render when the composition matches',
  );
  const createButton = wrapper.find('[data-testid="lobby-submit-create"]');
  assert.ok(
    !(createButton.element as HTMLButtonElement).disabled,
    'Create must be enabled when the composition matches the player count',
  );
});

test('WP-371: when the requirements fetch is unavailable the pre-check stays silent (no false block)', async () => {
  setSearch('?route=lobby');
  // stubMatches serves every fetch as `{ matches }` — the requirements fetch
  // therefore fails the shape check and setupRequirements stays null.
  stubMatches([]);
  const wrapper = mountLobby();
  await flushPromises();

  // A mismatched composition, but with no requirements loaded the pre-check is inert.
  await setManualComposition(wrapper, { numPlayers: '2', villains: 'core/x', henchmen: '', heroes: '' });

  assert.ok(
    !wrapper.find('[data-testid="lobby-manual-player-count-warnings"]').exists(),
    'no warning should render when requirements are unavailable',
  );
  const createButton = wrapper.find('[data-testid="lobby-submit-create"]');
  assert.ok(
    !(createButton.element as HTMLButtonElement).disabled,
    'Create must not be blocked by an unavailable pre-check (engine remains the authority)',
  );
});
