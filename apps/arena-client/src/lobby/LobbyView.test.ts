import '../testing/jsdom-setup';

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';

import LobbyView from './LobbyView.vue';
import { useAuthStore } from '../stores/auth';
import { buildGuestPlayUrl } from './lobbyApi';

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

// --- WP-629: host-side "Add guest" in the lobby seat list ---

function mountLobbySignedIn(token = 'host-token') {
  setActivePinia(createPinia());
  useAuthStore().token = token;
  return mount(LobbyView);
}

/** Route fetch by URL: the add-guest POST vs. the lobby list poll. */
function stubLobbyRoutes(
  addGuestResponse: { status: number; body: unknown },
  matches: unknown[],
): void {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith('/api/match/add-guest') && init?.method === 'POST') {
      const { status, body } = addGuestResponse;
      return {
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ matches }) } as Response;
  }) as typeof globalThis.fetch;
}

test('WP-629: Add guest button shows for a signed-in host on a match with an open seat', async () => {
  setSearch('?route=lobby');
  stubMatches([rawMatch('m1', ['host', undefined])]);
  const wrapper = mountLobbySignedIn();
  await flushPromises();
  assert.ok(wrapper.find('[data-testid="lobby-add-guest-m1"]').exists());
});

test('WP-629: Add guest button is hidden when signed out', async () => {
  setSearch('?route=lobby');
  stubMatches([rawMatch('m1', ['host', undefined])]);
  const wrapper = mountLobby();
  await flushPromises();
  assert.equal(wrapper.find('[data-testid="lobby-add-guest-m1"]').exists(), false);
});

test('WP-629: clicking Add guest calls the endpoint, shows a persistent guest link, and Done dismisses it', async () => {
  setSearch('?route=lobby');
  stubLobbyRoutes(
    { status: 200, body: { matchId: 'm1', seat: '1', credentials: 'guest-secret' } },
    [rawMatch('m1', ['host', undefined])],
  );
  const clipboardWrites: string[] = [];
  const originalClipboard = globalThis.navigator?.clipboard;
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (t: string) => { clipboardWrites.push(t); } },
  });
  try {
    const wrapper = mountLobbySignedIn();
    await flushPromises();
    await wrapper.find('[data-testid="lobby-add-guest-m1"]').trigger('click');
    await flushPromises();
    assert.ok(wrapper.find('[data-testid="lobby-guest-ready-m1"]').exists());
    await wrapper.find('[data-testid="lobby-guest-copy-m1"]').trigger('click');
    await flushPromises();
    const url = clipboardWrites[clipboardWrites.length - 1]!;
    assert.ok(url.includes('?match=m1'));
    assert.ok(url.includes('player=1'));
    assert.ok(url.includes('credentials=guest-secret'));
    // the link persists until dismissed
    await wrapper.find('[data-testid="lobby-guest-done-m1"]').trigger('click');
    await flushPromises();
    assert.equal(wrapper.find('[data-testid="lobby-guest-ready-m1"]').exists(), false);
  } finally {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  }
});

test('WP-629: a full match (409) shows the match-full copy in the lobby', async () => {
  setSearch('?route=lobby');
  stubLobbyRoutes(
    { status: 409, body: { error: 'the match is full' } },
    [rawMatch('m1', ['host', undefined])],
  );
  const wrapper = mountLobbySignedIn();
  await flushPromises();
  await wrapper.find('[data-testid="lobby-add-guest-m1"]').trigger('click');
  await flushPromises();
  const err = wrapper.find('[data-testid="lobby-guest-error-m1"]');
  assert.ok(err.exists());
  assert.ok(err.text().includes('full'));
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

// --- WP-525 / D-24338: scheme-aware requirement projection on the play lobby ---

const SECRET_INVASION_SCHEME = 'core/secret-invasion-of-the-skrull-shapeshifters';

/**
 * Scheme-aware requirements stub mimicking the WP-525 server projection: the
 * Secret Invasion query gets heroCount 6 at every player count; every other
 * request gets the base table. Keyed off the `?schemeId=` query in the URL.
 */
function stubSchemeAwareRequirements(): void {
  const secretInvasionRequirements = Object.fromEntries(
    Object.entries(SETUP_REQUIREMENTS).map(([count, row]) => [count, { ...row, heroCount: 6 }]),
  );
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/match/setup-requirements')) {
      // why: the client URL-encodes the schemeId ('/' → '%2F'), so match on the
      // scheme SLUG (hyphens survive encoding), not the full 'core/…' ext_id.
      const requirements = url.includes('secret-invasion-of-the-skrull-shapeshifters')
        ? secretInvasionRequirements
        : SETUP_REQUIREMENTS;
      return { ok: true, status: 200, json: async () => ({ requirements }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ matches: [] }) } as Response;
  }) as typeof globalThis.fetch;
}

test('WP-525: with Secret Invasion selected the play lobby requires 6 heroes — 5 disables Create, 6 enables it', async () => {
  setSearch('?route=lobby');
  stubSchemeAwareRequirements();
  const wrapper = mountLobby();
  await flushPromises();

  // select Secret Invasion → the scheme watcher re-fetches the scheme-aware table
  await wrapper.find('#schemeId').setValue(SECRET_INVASION_SCHEME);
  await flushPromises();

  // 2 villains / 1 henchman / 5 heroes — correct for a normal 2p scheme, but SI needs 6
  await setManualComposition(wrapper, {
    numPlayers: '2',
    villains: 'core/x,core/y',
    henchmen: 'core/h',
    heroes: 'a,b,c,d,e',
  });
  await flushPromises();

  const createButton = wrapper.find('[data-testid="lobby-submit-create"]');
  assert.ok(
    (createButton.element as HTMLButtonElement).disabled,
    'Secret Invasion + 5 heroes must disable Create (the scheme requires 6)',
  );
  const warnings = wrapper.find('[data-testid="lobby-manual-player-count-warnings"]');
  assert.match(warnings.text(), /needs 6 heroes/);

  // add a 6th hero → matches the scheme requirement → Create enabled
  await setManualComposition(wrapper, {
    numPlayers: '2',
    villains: 'core/x,core/y',
    henchmen: 'core/h',
    heroes: 'a,b,c,d,e,f',
  });
  await flushPromises();
  assert.ok(
    !(createButton.element as HTMLButtonElement).disabled,
    'Secret Invasion + 6 heroes must enable Create',
  );
});

test('WP-525: switching away from Secret Invasion restores the base 5-hero requirement', async () => {
  setSearch('?route=lobby');
  stubSchemeAwareRequirements();
  const wrapper = mountLobby();
  await flushPromises();

  await wrapper.find('#schemeId').setValue(SECRET_INVASION_SCHEME);
  await flushPromises();
  await wrapper.find('#schemeId').setValue('core/some-other-scheme');
  await flushPromises();

  await setManualComposition(wrapper, {
    numPlayers: '2',
    villains: 'core/x,core/y',
    henchmen: 'core/h',
    heroes: 'a,b,c,d,e',
  });
  await flushPromises();

  const createButton = wrapper.find('[data-testid="lobby-submit-create"]');
  assert.ok(
    !(createButton.element as HTMLButtonElement).disabled,
    'a non-Secret-Invasion scheme keeps the base 5-hero requirement — 5 heroes enables Create',
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

test('WP-376: createWithBotAlly uses an uploaded loadout composition + player count (not the empty manual fields)', async () => {
  setSearch('?route=lobby');
  const calls = stubBotAllyFetch();
  const wrapper = mountLobby();
  await flushPromises();
  signIn();
  await wrapper.find('#playerName').setValue('Solo Player');

  // Author via the recommended loadout path (paste a MATCH-SETUP document),
  // leaving the manual composition fields empty — the exact shape that used to
  // send an empty villainGroupIds and 400.
  const loadoutDocument = JSON.stringify({
    schemaVersion: '1.0',
    playerCount: 2,
    heroSelectionMode: 'GROUP_STANDARD',
    composition: {
      schemeId: 'core/midtown-bank-robbery',
      mastermindId: 'core/magneto',
      villainGroupIds: ['core/brotherhood', 'core/hydra'],
      henchmanGroupIds: ['core/hand-ninjas'],
      heroDeckIds: ['core/spider-man', 'core/hulk', 'core/wolverine', 'core/black-widow', 'core/cyclops'],
      bystandersCount: 2,
      woundsCount: 30,
      officersCount: 5,
      sidekicksCount: 12,
    },
  });
  await wrapper.find('#loadoutPaste').setValue(loadoutDocument);
  await wrapper.find('[data-testid="lobby-loadout-parse"]').trigger('click');
  await flushPromises();

  await wrapper.find('[data-testid="lobby-create-bot-ally"]').trigger('click');
  await flushPromises();

  const createCall = calls.find((call) => call.url.includes('/api/match/create-with-bot'));
  assert.ok(createCall, 'the bot-ally create endpoint was called');
  const body = JSON.parse(String(createCall!.init?.body)) as {
    numPlayers: number;
    botCount: number;
    setupData: { villainGroupIds: string[]; mastermindId: string };
  };
  // The composition came from the uploaded loadout — NOT the empty manual form.
  assert.deepEqual(body.setupData.villainGroupIds, ['core/brotherhood', 'core/hydra']);
  assert.equal(body.setupData.mastermindId, 'core/magneto');
  assert.equal(body.numPlayers, 2, 'seat count comes from the loadout playerCount');
  assert.equal(body.botCount, 1);
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

// --- WP-499 / EC-534: "Join by match ID or link" affordance ---

/**
 * Stub fetch routing by URL for the join-by-reference flow: the single-match
 * GET (`/games/legendary-arena/<id>`) returns `singleMatch` at `matchStatus`
 * (default 200), the authed join returns a credential, and the mount-time list
 * / requirements calls succeed. Records every call for assertions.
 */
function stubJoinByRefFetch(
  singleMatch: unknown,
  matchStatus = 200,
): RecordedCall[] {
  const recorded: RecordedCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    recorded.push({ url, init });
    if (url.includes('/api/match/join')) {
      return { ok: true, status: 200, json: async () => ({ playerCredentials: 'ref-cred' }) } as Response;
    }
    if (url.includes('/api/match/setup-requirements')) {
      return { ok: true, status: 200, json: async () => ({ requirements: SETUP_REQUIREMENTS }) } as Response;
    }
    // why: the single-match GET carries an id path segment after the game name;
    // the mount-time list is `/games/legendary-arena?isGameover=false` (no `/id`).
    if (url.includes('/games/legendary-arena/')) {
      const ok = matchStatus >= 200 && matchStatus < 300;
      return { ok, status: matchStatus, json: async () => singleMatch } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ matches: [] }) } as Response;
  }) as typeof globalThis.fetch;
  return recorded;
}

test('WP-499: Join by reference fetches the match and joins the FIRST open seat', async () => {
  setSearch('?route=lobby');
  // seat 0 is taken (Host); seat 1 is open — the join must target seat 1.
  const calls = stubJoinByRefFetch({ players: [{ id: 0, name: 'Host' }, { id: 1 }] });
  const wrapper = mountLobby();
  await flushPromises();
  signIn();
  await wrapper.find('#playerName').setValue('Guest Player');

  await wrapper.find('[data-testid="lobby-join-reference-input"]').setValue('KdHnMXaOPin');
  await wrapper.find('[data-testid="lobby-join-reference-submit"]').trigger('click');
  await flushPromises();

  assert.ok(
    calls.some((call) => call.url.endsWith('/games/legendary-arena/KdHnMXaOPin')),
    'the single match was fetched by id',
  );
  const joinCall = calls.find((call) => call.url.includes('/api/match/join'));
  assert.ok(joinCall, 'the authed join was called');
  const joinBody = JSON.parse(String(joinCall!.init?.body)) as { matchID: string; playerID: string };
  assert.equal(joinBody.matchID, 'KdHnMXaOPin');
  assert.equal(joinBody.playerID, '1', 'joined the first OPEN seat, not seat 0');
});

test('WP-499: Join by reference accepts a full invite link', async () => {
  setSearch('?route=lobby');
  const calls = stubJoinByRefFetch({ players: [{ id: 0 }] });
  const wrapper = mountLobby();
  await flushPromises();
  signIn();
  await wrapper.find('#playerName').setValue('Guest Player');

  await wrapper
    .find('[data-testid="lobby-join-reference-input"]')
    .setValue('https://play.legendary-arena.com/?route=lobby&match=LinkedMatch1');
  await wrapper.find('[data-testid="lobby-join-reference-submit"]').trigger('click');
  await flushPromises();

  const joinCall = calls.find((call) => call.url.includes('/api/match/join'));
  assert.ok(joinCall, 'the link resolved to a join');
  const joinBody = JSON.parse(String(joinCall!.init?.body)) as { matchID: string };
  assert.equal(joinBody.matchID, 'LinkedMatch1');
});

test('WP-499: empty input shows inline copy and fetches nothing', async () => {
  setSearch('?route=lobby');
  const calls = stubJoinByRefFetch({ players: [{ id: 0 }] });
  const wrapper = mountLobby();
  await flushPromises();
  signIn();
  await wrapper.find('#playerName').setValue('Guest Player');

  await wrapper.find('[data-testid="lobby-join-reference-submit"]').trigger('click');
  await flushPromises();

  assert.match(
    wrapper.find('[data-testid="lobby-error"]').text(),
    /Enter a match ID or an invite link/,
  );
  assert.ok(!calls.some((call) => call.url.includes('/games/legendary-arena/')), 'no single-match fetch');
  assert.ok(!calls.some((call) => call.url.includes('/api/match/join')), 'no join');
});

test('WP-499: an unknown match (404) shows not-found and does not join', async () => {
  setSearch('?route=lobby');
  const calls = stubJoinByRefFetch(null, 404);
  const wrapper = mountLobby();
  await flushPromises();
  signIn();
  await wrapper.find('#playerName').setValue('Guest Player');

  await wrapper.find('[data-testid="lobby-join-reference-input"]').setValue('missingmatch');
  await wrapper.find('[data-testid="lobby-join-reference-submit"]').trigger('click');
  await flushPromises();

  assert.match(
    wrapper.find('[data-testid="lobby-error"]').text(),
    /No match found with ID missingmatch/,
  );
  assert.ok(!calls.some((call) => call.url.includes('/api/match/join')), 'no join on a missing match');
});

test('WP-499: a match with no open seat shows an error and does not join', async () => {
  setSearch('?route=lobby');
  // both seats taken → no open seat
  const calls = stubJoinByRefFetch({ players: [{ id: 0, name: 'Host' }, { id: 1, name: 'Guest' }] });
  const wrapper = mountLobby();
  await flushPromises();
  signIn();
  await wrapper.find('#playerName').setValue('Guest Player');

  await wrapper.find('[data-testid="lobby-join-reference-input"]').setValue('FullMatch01');
  await wrapper.find('[data-testid="lobby-join-reference-submit"]').trigger('click');
  await flushPromises();

  assert.match(
    wrapper.find('[data-testid="lobby-error"]').text(),
    /has no open seats/,
  );
  assert.ok(!calls.some((call) => call.url.includes('/api/match/join')), 'no join on a full match');
});

// --- WP-631: per-match guest password + game name (D-24441) ---

/**
 * Route fetch for the WP-631 surfaces: the lobby list, the per-match guest-access
 * meta GET, and the set/join POSTs. `meta` maps matchID → the guest-access body.
 * Records every call in `guestCalls` so a test can assert what was sent (and what
 * was NOT — e.g. the password never in a URL).
 */
let guestCalls: { url: string; init: RequestInit | undefined }[] = [];
function stubGuestRoutes(options: {
  matches: unknown[];
  meta: Record<string, { gameName: string | null; hasGuestPassword: boolean }>;
  joinResponse?: { status: number; body: unknown };
  setResponse?: { status: number; body: unknown };
}): void {
  guestCalls = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    guestCalls.push({ url: u, init });
    if (u.includes('/guest-access')) {
      const rawId = u.split('/api/match/')[1]!.split('/guest-access')[0]!;
      const body = options.meta[decodeURIComponent(rawId)] ?? { gameName: null, hasGuestPassword: false };
      return { ok: true, status: 200, json: async () => ({ matchId: rawId, ...body }) } as Response;
    }
    if (u.endsWith('/api/match/join-as-guest') && init?.method === 'POST') {
      const { status, body } = options.joinResponse ?? { status: 200, body: {} };
      return {
        status, ok: status >= 200 && status < 300,
        json: async () => body,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      } as Response;
    }
    if (u.endsWith('/api/match/set-guest-access') && init?.method === 'POST') {
      const { status, body } = options.setResponse ?? { status: 200, body: {} };
      return {
        status, ok: status >= 200 && status < 300,
        json: async () => body,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ matches: options.matches }) } as Response;
  }) as typeof globalThis.fetch;
}

test('WP-631: the lobby row shows the host-set game name (falls back to matchID when unnamed)', async () => {
  setSearch('?route=lobby');
  stubGuestRoutes({
    matches: [rawMatch('m1', ['host', undefined]), rawMatch('m2', ['host', undefined])],
    meta: { m1: { gameName: 'Grandkids game', hasGuestPassword: true } },
  });
  const wrapper = mountLobby();
  await flushPromises();
  assert.equal(wrapper.find('[data-testid="lobby-match-name-m1"]').text(), 'Grandkids game');
  assert.equal(wrapper.find('[data-testid="lobby-match-name-m2"]').text(), 'm2');
});

test('WP-631: "Join as guest" shows only where hasGuestPassword AND an open seat', async () => {
  setSearch('?route=lobby');
  stubGuestRoutes({
    matches: [
      rawMatch('m1', ['host', undefined]),
      rawMatch('m2', ['host', undefined]),
      rawMatch('m3', ['host', 'guest2']),
    ],
    meta: {
      m1: { gameName: 'Open', hasGuestPassword: true },
      m2: { gameName: 'Named only', hasGuestPassword: false },
      m3: { gameName: 'Full', hasGuestPassword: true },
    },
  });
  const wrapper = mountLobby();
  await flushPromises();
  assert.ok(wrapper.find('[data-testid="lobby-join-guest-open-m1"]').exists());
  assert.equal(wrapper.find('[data-testid="lobby-join-guest-open-m2"]').exists(), false);
  assert.equal(wrapper.find('[data-testid="lobby-match-name-m2"]').text(), 'Named only');
  assert.equal(wrapper.find('[data-testid="lobby-join-guest-open-m3"]').exists(), false);
});

test('D-24447: host "Add guest" is HIDDEN on a password match (seat kept open for lobby join), shown on a passwordless one', async () => {
  setSearch('?route=lobby');
  stubGuestRoutes({
    matches: [
      rawMatch('m1', ['host', undefined]), // open seat + password → Add guest hidden
      rawMatch('m2', ['host', undefined]), // open seat, no password → Add guest shown
    ],
    meta: {
      m1: { gameName: 'Grandkids', hasGuestPassword: true },
      m2: { gameName: 'Open', hasGuestPassword: false },
    },
  });
  const wrapper = mountLobbySignedIn();
  await flushPromises();
  // the password match hides "Add guest" (it would fill the seat) but keeps the
  // guest's lobby-join affordance
  assert.equal(wrapper.find('[data-testid="lobby-add-guest-m1"]').exists(), false);
  assert.ok(wrapper.find('[data-testid="lobby-join-guest-open-m1"]').exists());
  // the passwordless match still offers the link-handoff "Add guest"
  assert.ok(wrapper.find('[data-testid="lobby-add-guest-m2"]').exists());
});

test('WP-631: correct password posts to join-as-guest (password in the body) and the play URL never carries the password', async () => {
  // why: jsdom's window.location is non-configurable, so the actual
  // `window.location.href = ...` navigation cannot be intercepted here (see the
  // bgioClient App-routing note). Instead assert the observable effects: the
  // join POST carried the password in its BODY, the happy path showed no error,
  // and the play URL builder (buildGuestPlayUrl — which has no password param, so
  // it structurally cannot leak it) produces the ?match&player&credentials shape
  // without the password. The full navigation is covered by the App-routing +
  // useCreateMatchFromComposition suites.
  setSearch('?route=lobby');
  stubGuestRoutes({
    matches: [rawMatch('m1', ['host', undefined])],
    meta: { m1: { gameName: 'Open', hasGuestPassword: true } },
    joinResponse: { status: 200, body: { matchId: 'm1', seat: '1', credentials: 'guest-cred' } },
  });
  const wrapper = mountLobby();
  await flushPromises();
  await wrapper.find('[data-testid="lobby-join-guest-open-m1"]').trigger('click');
  await flushPromises();
  await wrapper.find('[data-testid="lobby-join-guest-password-m1"]').setValue('apple');
  await wrapper.find('[data-testid="lobby-join-guest-form-m1"]').trigger('submit');
  await flushPromises();
  // the password went in the POST body, not a URL
  const joinCall = guestCalls.find((call) => call.url.endsWith('/api/match/join-as-guest'));
  assert.ok(joinCall !== undefined);
  const joinBody = JSON.parse(String(joinCall!.init!.body)) as { matchId: string; password: string };
  assert.equal(joinBody.matchId, 'm1');
  assert.equal(joinBody.password, 'apple');
  // the happy path did not surface an error line
  assert.equal(wrapper.find('[data-testid="lobby-join-guest-error-m1"]').exists(), false);
  // the play URL the handler navigates to carries only match/player/credentials
  const playUrl = buildGuestPlayUrl('m1', '1', 'guest-cred');
  assert.ok(playUrl.includes('match=m1'));
  assert.ok(playUrl.includes('player=1'));
  assert.ok(playUrl.includes('credentials=guest-cred'));
  assert.equal(playUrl.includes('apple'), false, 'the password never appears in the play URL');
});

test('WP-631: a wrong password (401) shows co-op copy and does not navigate', async () => {
  setSearch('?route=lobby');
  stubGuestRoutes({
    matches: [rawMatch('m1', ['host', undefined])],
    meta: { m1: { gameName: 'Open', hasGuestPassword: true } },
    joinResponse: { status: 401, body: { error: 'wrong' } },
  });
  const wrapper = mountLobby();
  await flushPromises();
  await wrapper.find('[data-testid="lobby-join-guest-open-m1"]').trigger('click');
  await flushPromises();
  await wrapper.find('[data-testid="lobby-join-guest-password-m1"]').setValue('nope');
  await wrapper.find('[data-testid="lobby-join-guest-form-m1"]').trigger('submit');
  await flushPromises();
  const err = wrapper.find('[data-testid="lobby-join-guest-error-m1"]');
  assert.ok(err.exists());
  assert.match(err.text(), /password isn.t right/i);
});

test('WP-631: rate-limited (429) and ended (404) map to distinct copy', async () => {
  for (const trial of [
    { status: 429, pattern: /too many tries/i },
    { status: 404, pattern: /has ended/i },
  ]) {
    setSearch('?route=lobby');
    stubGuestRoutes({
      matches: [rawMatch('m1', ['host', undefined])],
      meta: { m1: { gameName: 'Open', hasGuestPassword: true } },
      joinResponse: { status: trial.status, body: { error: 'x' } },
    });
    const wrapper = mountLobby();
    await flushPromises();
    await wrapper.find('[data-testid="lobby-join-guest-open-m1"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="lobby-join-guest-password-m1"]').setValue('apple');
    await wrapper.find('[data-testid="lobby-join-guest-form-m1"]').trigger('submit');
    await flushPromises();
    assert.match(wrapper.find('[data-testid="lobby-join-guest-error-m1"]').text(), trial.pattern);
  }
});

test('WP-631: host set-guest-password field is write-only and never renders a stored password', async () => {
  setSearch('?route=lobby');
  stubGuestRoutes({
    matches: [rawMatch('m1', ['host', undefined])],
    meta: { m1: { gameName: 'Grandkids', hasGuestPassword: true } },
    setResponse: { status: 200, body: { matchId: 'm1', gameName: 'Grandkids', hasGuestPassword: true } },
  });
  const wrapper = mountLobbySignedIn();
  await flushPromises();
  await wrapper.find('[data-testid="lobby-set-guest-open-m1"]').trigger('click');
  await flushPromises();
  const nameInput = wrapper.find('[data-testid="lobby-set-guest-name-m1"]').element as HTMLInputElement;
  const passwordInput = wrapper.find('[data-testid="lobby-set-guest-password-m1"]').element as HTMLInputElement;
  assert.equal(nameInput.value, 'Grandkids');
  assert.equal(passwordInput.value, '');
  assert.equal(passwordInput.type, 'password');
});

test('WP-631: host set submit posts to set-guest-access; a rename omits the password from the body', async () => {
  setSearch('?route=lobby');
  stubGuestRoutes({
    matches: [rawMatch('m1', ['host', undefined])],
    meta: { m1: { gameName: 'Old name', hasGuestPassword: true } },
    setResponse: { status: 200, body: { matchId: 'm1', gameName: 'New name', hasGuestPassword: true } },
  });
  const wrapper = mountLobbySignedIn();
  await flushPromises();
  await wrapper.find('[data-testid="lobby-set-guest-open-m1"]').trigger('click');
  await flushPromises();
  await wrapper.find('[data-testid="lobby-set-guest-name-m1"]').setValue('New name');
  await wrapper.find('[data-testid="lobby-set-guest-form-m1"]').trigger('submit');
  await flushPromises();
  const setCall = guestCalls.find((call) => call.url.endsWith('/api/match/set-guest-access'));
  assert.ok(setCall !== undefined);
  const body = JSON.parse(String(setCall!.init!.body)) as Record<string, unknown>;
  assert.equal(body.gameName, 'New name');
  assert.equal('password' in body, false, 'an untouched password field is omitted (kept as-is)');
});

test('WP-631: host set 403 (not a participant) shows the "must be in this game" line', async () => {
  setSearch('?route=lobby');
  stubGuestRoutes({
    matches: [rawMatch('m1', ['host', undefined])],
    meta: { m1: { gameName: 'Grandkids', hasGuestPassword: false } },
    setResponse: { status: 403, body: { error: 'not a participant' } },
  });
  const wrapper = mountLobbySignedIn();
  await flushPromises();
  await wrapper.find('[data-testid="lobby-set-guest-open-m1"]').trigger('click');
  await flushPromises();
  await wrapper.find('[data-testid="lobby-set-guest-password-m1"]').setValue('apple');
  await wrapper.find('[data-testid="lobby-set-guest-form-m1"]').trigger('submit');
  await flushPromises();
  assert.match(wrapper.find('[data-testid="lobby-set-guest-status-m1"]').text(), /must be in this game/i);
});
