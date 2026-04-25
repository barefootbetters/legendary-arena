import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createMatch, joinMatch, listMatches, serverUrl } from './lobbyApi';
import type { LobbyMatchSummary } from './lobbyApi';
import type { MatchSetupConfig } from '@legendary-arena/game-engine';

const SAMPLE_CONFIG: MatchSetupConfig = {
  schemeId: 'scheme-midtown-bank-robbery',
  mastermindId: 'mastermind-magneto',
  villainGroupIds: ['villains-brotherhood'],
  henchmanGroupIds: ['henchmen-hand-ninjas'],
  heroDeckIds: [
    'hero-spider-man',
    'hero-hulk',
    'hero-wolverine',
    'hero-black-widow',
  ],
  bystandersCount: 1,
  woundsCount: 30,
  officersCount: 5,
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

describe('lobbyApi (WP-090)', () => {
  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    restoreFetch();
  });

  test('createMatch POSTs { numPlayers, setupData } to /games/legendary-arena/create and returns matchID', async () => {
    installFetchStub(() => jsonResponse(200, { matchID: 'match-abc' }));
    const result = await createMatch(SAMPLE_CONFIG, 2);

    assert.equal(result.matchID, 'match-abc');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, `${serverUrl}/games/legendary-arena/create`);
    assert.equal(calls[0]!.init?.method, 'POST');

    const bodyText = String(calls[0]!.init?.body);
    const parsed = JSON.parse(bodyText) as {
      numPlayers: number;
      setupData: MatchSetupConfig;
    };
    assert.equal(parsed.numPlayers, 2);
    assert.deepEqual(parsed.setupData, SAMPLE_CONFIG);
  });

  test('listMatches parses raw response and normalizes player ids to strings, open seats as name-less', async () => {
    installFetchStub(() =>
      jsonResponse(200, {
        matches: [
          {
            gameName: 'legendary-arena',
            unlisted: false,
            players: [
              { id: 0, name: 'Alice' },
              { id: 1 },
            ],
            setupData: SAMPLE_CONFIG,
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
            matchID: 'match-1',
          },
          {
            gameName: 'legendary-arena',
            unlisted: false,
            players: [{ id: 0 }, { id: 1 }],
            matchID: 'match-2',
            gameover: { winner: '0' },
          },
        ],
      }),
    );

    const summaries: LobbyMatchSummary[] = await listMatches();

    assert.equal(calls[0]!.url, `${serverUrl}/games/legendary-arena`);
    assert.equal(summaries.length, 2);

    assert.equal(summaries[0]!.matchID, 'match-1');
    assert.equal(summaries[0]!.players.length, 2);
    assert.deepEqual(summaries[0]!.players[0], { id: '0', name: 'Alice' });
    // why: an open seat arrives with no `name` key. The mapping must not
    // fabricate a `name: undefined` property either — exact-shape assertion.
    assert.deepEqual(summaries[0]!.players[1], { id: '1' });
    assert.deepEqual(summaries[0]!.setupData, SAMPLE_CONFIG);
    assert.equal(summaries[0]!.gameover, null);

    assert.equal(summaries[1]!.matchID, 'match-2');
    assert.equal(summaries[1]!.setupData, null);
    assert.deepEqual(summaries[1]!.gameover, { winner: '0' });
  });

  test('joinMatch POSTs { playerID, playerName } and returns playerCredentials', async () => {
    installFetchStub(() =>
      jsonResponse(200, {
        playerID: '0',
        playerCredentials: 'secret-xyz',
      }),
    );

    const result = await joinMatch('match-abc', '0', 'Tester');
    assert.equal(result.playerCredentials, 'secret-xyz');
    assert.equal(
      calls[0]!.url,
      `${serverUrl}/games/legendary-arena/match-abc/join`,
    );
    assert.equal(calls[0]!.init?.method, 'POST');

    const parsed = JSON.parse(String(calls[0]!.init?.body)) as {
      playerID: string;
      playerName: string;
    };
    assert.equal(parsed.playerID, '0');
    assert.equal(parsed.playerName, 'Tester');
  });

  test('each helper throws a full-sentence Error on HTTP 500 including endpoint and status', async () => {
    installFetchStub(() => textResponse(500, 'internal boom'));

    await assert.rejects(
      () => createMatch(SAMPLE_CONFIG, 2),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Failed to create match/);
        assert.match(error.message, /HTTP 500/);
        assert.match(error.message, /\/games\/legendary-arena\/create/);
        return true;
      },
    );

    await assert.rejects(
      () => listMatches(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Failed to list matches/);
        assert.match(error.message, /HTTP 500/);
        return true;
      },
    );

    await assert.rejects(
      () => joinMatch('match-abc', '0', 'Tester'),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Failed to join match match-abc/);
        assert.match(error.message, /HTTP 500/);
        return true;
      },
    );
  });
});
