import '../testing/jsdom-setup';

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';

import LobbyView from './LobbyView.vue';
import { useAuthStore } from '../stores/auth';

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

// --- WP-376 / EC-405: "Play with a bot ally" affordance ---

interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

/**
 * Stub fetch routing by URL: the bot-ally create returns { matchId }, the join
 * returns the human's own credential, and the mount-time list / requirements
 * calls succeed. Records every call for assertions.
 */
function stubBotAllyFetch(): RecordedCall[] {
  const recorded: RecordedCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    recorded.push({ url, init });
    if (url.includes('/api/match/create-with-bot')) {
      return { ok: true, status: 200, json: async () => ({ matchId: 'match-bot-xyz' }) } as Response;
    }
    if (url.includes('/api/match/join')) {
      return { ok: true, status: 200, json: async () => ({ playerCredentials: 'human-own-cred' }) } as Response;
    }
    if (url.includes('/api/match/setup-requirements')) {
      return { ok: true, status: 200, json: async () => ({ requirements: SETUP_REQUIREMENTS }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ matches: [] }) } as Response;
  }) as typeof globalThis.fetch;
  return recorded;
}

/** Sign in the pinia auth store so the affordance's auth gate passes. */
function signIn(): void {
  useAuthStore().setSession('bot-ally-token', null);
}

test('WP-376: createWithBotAlly POSTs create-with-bot then joins seat 0 via the authed join', async () => {
  setSearch('?route=lobby');
  const calls = stubBotAllyFetch();
  const wrapper = mountLobby();
  await flushPromises();
  signIn();
  await wrapper.find('#playerName').setValue('Solo Player');

  await wrapper.find('[data-testid="lobby-create-bot-ally"]').trigger('click');
  await flushPromises();

  const createCall = calls.find((call) => call.url.includes('/api/match/create-with-bot'));
  assert.ok(createCall, 'the bot-ally create endpoint was called');
  assert.equal(
    (createCall!.init?.headers as Record<string, string>).Authorization,
    'Bearer bot-ally-token',
    'the create carries the human bearer token (auth-gated)',
  );
  const createBody = JSON.parse(String(createCall!.init?.body)) as {
    numPlayers: number;
    botCount: number;
    policy: string;
  };
  assert.equal(createBody.numPlayers, 2);
  assert.equal(createBody.botCount, 1);
  assert.equal(createBody.policy, 'competent');

  // The human joins their OWN seat 0 through the authed join (never a
  // server-returned seat-0 credential — the key distinction from autoplay).
  const joinCall = calls.find((call) => call.url.includes('/api/match/join'));
  assert.ok(joinCall, 'the human joined seat 0 via the authed join endpoint');
  const joinBody = JSON.parse(String(joinCall!.init?.body)) as { matchID: string; playerID: string };
  assert.equal(joinBody.matchID, 'match-bot-xyz');
  assert.equal(joinBody.playerID, '0');
  assert.equal(
    (joinCall!.init?.headers as Record<string, string>).Authorization,
    'Bearer bot-ally-token',
  );
});

test('WP-376: a botCount not less than the seat count is rejected before any POST', async () => {
  setSearch('?route=lobby');
  const calls = stubBotAllyFetch();
  const wrapper = mountLobby();
  await flushPromises();
  signIn();
  await wrapper.find('#playerName').setValue('Solo Player');
  await wrapper.find('#numPlayers').setValue('2');
  await wrapper.find('#botAllyBotCount').setValue('2'); // 2 bots in a 2-seat match leaves no human seat

  await wrapper.find('[data-testid="lobby-create-bot-ally"]').trigger('click');
  await flushPromises();

  assert.ok(
    !calls.some((call) => call.url.includes('/api/match/create-with-bot')),
    'an invalid bot count never reaches the server',
  );
  assert.match(wrapper.find('[data-testid="lobby-error"]').text(), /bot count must be between 1 and 1/i);
});

test('WP-376: a guest is redirected to login and never posts a bot-ally create', async () => {
  setSearch('?route=lobby');
  const calls = stubBotAllyFetch();
  const wrapper = mountLobby();
  await flushPromises();
  // no signIn() — the auth store token stays null (guest)
  await wrapper.find('#playerName').setValue('Guest');

  await wrapper.find('[data-testid="lobby-create-bot-ally"]').trigger('click');
  await flushPromises();

  assert.ok(
    !calls.some((call) => call.url.includes('/api/match/create-with-bot')),
    'a guest never issues an unauthenticated bot-ally create',
  );
});

test('WP-376: the bot-ally block uses co-op copy with no versus/opponent framing', async () => {
  setSearch('?route=lobby');
  stubBotAllyFetch();
  const wrapper = mountLobby();
  await flushPromises();

  const block = wrapper.find('[data-testid="lobby-bot-ally"]');
  assert.ok(block.exists(), 'the bot-ally block renders');
  const text = block.text().toLowerCase();
  assert.ok(text.includes('bot ally'), 'the copy frames the bot as an ally');
  assert.ok(!/\bvs\b|opponent|beat the bot|versus/.test(text), 'no PvP/versus framing (VISION §23(b))');
});
