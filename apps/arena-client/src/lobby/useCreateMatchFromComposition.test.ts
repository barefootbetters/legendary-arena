import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  launchMatchFromComposition,
  launchBotAllyFromComposition,
} from './useCreateMatchFromComposition';
import { serverUrl } from './lobbyApi';
import type { MatchSetupConfig } from '@legendary-arena/game-engine';

// WP-448: the shared launch primitive extracted from LobbyView's two
// create-and-join paths. These stubbed-`fetch` isolation tests pin the
// extracted sequence (create → join seat '0' → navigate) and the never-throw
// failure contract without mounting the SFC. The lobby's existing
// lobbyApi / LobbyView suites stay unchanged (behavior-preserving extraction).

const SAMPLE_CONFIG: MatchSetupConfig = {
  schemeId: 'core/midtown-bank-robbery',
  mastermindId: 'core/magneto',
  villainGroupIds: ['core/brotherhood', 'core/hydra'],
  henchmanGroupIds: ['core/hand-ninjas'],
  heroDeckIds: [
    'core/spider-man',
    'core/hulk',
    'core/wolverine',
    'core/black-widow',
    'core/cyclops',
  ],
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 12,
};

interface StubbedCall {
  url: string;
  init: RequestInit | undefined;
}

let originalFetch: typeof globalThis.fetch | undefined;
let calls: StubbedCall[];

function installFetchStub(
  responder: (url: string, init: RequestInit | undefined) => Response,
): void {
  calls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    return responder(url, init);
  }) as typeof globalThis.fetch;
}

function restoreFetch(): void {
  if (originalFetch !== undefined) {
    globalThis.fetch = originalFetch;
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });
}

// why: the primitive navigates by assigning `window.location.search`. This
// minimal window stub records the assigned value so a test can assert the exact
// nav URL without a jsdom document; `sessionStorage` stays undefined so the
// diagnostics stash safely no-ops.
let navigatedSearch: string | null;
let originalWindow: unknown;

function installWindowStub(): void {
  navigatedSearch = null;
  originalWindow = (globalThis as { window?: unknown }).window;
  const locationStub = {
    _search: '',
    get search(): string {
      return this._search;
    },
    set search(value: string) {
      this._search = value;
      navigatedSearch = value;
    },
  };
  Object.defineProperty(globalThis, 'window', {
    value: { location: locationStub },
    writable: true,
    configurable: true,
  });
}

function restoreWindow(): void {
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    writable: true,
    configurable: true,
  });
}

describe('launchMatchFromComposition (WP-448)', () => {
  beforeEach(() => {
    installWindowStub();
  });

  afterEach(() => {
    restoreFetch();
    restoreWindow();
  });

  test('success: creates the match, joins seat 0, navigates, and returns { ok: true, matchID }', async () => {
    installFetchStub((url) => {
      if (url.endsWith('/api/match/create')) {
        return jsonResponse(200, { matchID: 'match-abc' });
      }
      if (url.endsWith('/api/match/join')) {
        return jsonResponse(200, { playerCredentials: 'secret-xyz' });
      }
      return textResponse(500, `unexpected url ${url}`);
    });

    const result = await launchMatchFromComposition({
      config: SAMPLE_CONFIG,
      playerCount: 2,
      playerName: 'Tester',
      authToken: 'test-token',
    });

    assert.deepEqual(result, { ok: true, matchID: 'match-abc' });

    // create then join, in that order
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.url, `${serverUrl}/api/match/create`);
    assert.equal(calls[1]!.url, `${serverUrl}/api/match/join`);

    const joinBody = JSON.parse(String(calls[1]!.init?.body)) as {
      matchID: string;
      playerID: string;
      playerName: string;
    };
    assert.equal(joinBody.matchID, 'match-abc');
    assert.equal(joinBody.playerID, '0');
    assert.equal(joinBody.playerName, 'Tester');

    // navigated to the play surface with seat 0 + encoded credentials
    assert.equal(
      navigatedSearch,
      '?match=match-abc&player=0&credentials=secret-xyz',
    );
  });

  test('create fails: returns { ok: false } with the locked message and issues no join', async () => {
    installFetchStub((url) => {
      if (url.endsWith('/api/match/create')) {
        return textResponse(500, 'internal boom');
      }
      return jsonResponse(200, { playerCredentials: 'should-not-be-used' });
    });

    const result = await launchMatchFromComposition({
      config: SAMPLE_CONFIG,
      playerCount: 2,
      playerName: 'Tester',
      authToken: 'test-token',
    });

    assert.equal(result.ok, false);
    if (result.ok === false) {
      assert.match(result.message, /^Failed to create and join the match\. /);
      assert.match(result.message, /HTTP 500/);
    }

    // only the create was attempted — no join, and no navigation
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, `${serverUrl}/api/match/create`);
    assert.equal(navigatedSearch, null);
  });
});

// WP-502 Play Again fix — the bot-ally launch primitive rebuilds a co-op match.
describe('launchBotAllyFromComposition (WP-502)', () => {
  beforeEach(() => {
    installWindowStub();
  });

  afterEach(() => {
    restoreFetch();
    restoreWindow();
  });

  test('success: creates a bot-ally match (numPlayers/botCount/policy), joins seat 0, navigates', async () => {
    installFetchStub((url) => {
      if (url.endsWith('/api/match/create-with-bot')) {
        return jsonResponse(200, { matchId: 'match-bot' });
      }
      if (url.endsWith('/api/match/join')) {
        return jsonResponse(200, { playerCredentials: 'secret-bot' });
      }
      return textResponse(500, `unexpected url ${url}`);
    });

    const result = await launchBotAllyFromComposition({
      config: SAMPLE_CONFIG,
      playerCount: 2,
      botCount: 1,
      policy: 'competent',
      playerName: 'Tester',
      authToken: 'test-token',
    });

    assert.deepEqual(result, { ok: true, matchID: 'match-bot' });

    // create-with-bot then join seat 0, in that order
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.url, `${serverUrl}/api/match/create-with-bot`);
    assert.equal(calls[1]!.url, `${serverUrl}/api/match/join`);

    // the create body carries the bot parameters (so the server seats the bot)
    const createBody = JSON.parse(String(calls[0]!.init!.body));
    assert.equal(createBody.numPlayers, 2);
    assert.equal(createBody.botCount, 1);
    assert.equal(createBody.policy, 'competent');

    // the human joins their own seat 0 and navigates to the new match
    const joinBody = JSON.parse(String(calls[1]!.init!.body));
    assert.equal(joinBody.playerID, '0');
    assert.match(navigatedSearch ?? '', /match=match-bot/);
    assert.match(navigatedSearch ?? '', /player=0/);
  });

  test('failure: a create-with-bot error returns { ok: false } with a bot-ally message and does not navigate', async () => {
    installFetchStub((url) => {
      if (url.endsWith('/api/match/create-with-bot')) {
        return textResponse(400, 'a bot-ally match needs at least 2 seats');
      }
      return textResponse(500, `unexpected url ${url}`);
    });

    const result = await launchBotAllyFromComposition({
      config: SAMPLE_CONFIG,
      playerCount: 2,
      botCount: 1,
      policy: 'random',
      playerName: 'Tester',
      authToken: 'test-token',
    });

    assert.equal(result.ok, false);
    if (result.ok === false) {
      assert.match(result.message, /^Failed to create and join the bot-ally match\. /);
    }
    assert.equal(calls.length, 1);
    assert.equal(navigatedSearch, null);
  });
});
