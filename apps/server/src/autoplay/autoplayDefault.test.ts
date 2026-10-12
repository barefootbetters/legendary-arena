/**
 * Tests for the autoplay default-composition builder.
 *
 * "Watch Bot Play" (POST /api/match/autoplay) creates a bot match. When the
 * caller sends no custom loadout, the server builds a default composition.
 * Under the WP-370 player-count setup enforcement the engine BLOCKS a
 * composition whose villain-group / henchmen-group / hero counts do not match
 * the player count (Game.setup throws → the create call 400s). The prior fixed
 * default (4 heroes / 1 villain group) matched NO player-count row, so every
 * "Watch Bot Play" click failed. These tests prove the scaled default is
 * count-valid for every supported player count (1–5).
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { checkPlayerCountComposition } from '@legendary-arena/registry';

import { buildDefaultComposition, registerAutoplayRoutes } from './autoplay.mjs';

/** The four supply-count fields the engine expects on every composition. */
const SUPPLY_FIELDS = [
  'bystandersCount',
  'woundsCount',
  'officersCount',
  'sidekicksCount',
] as const;

test('default composition satisfies the player-count setup table for every count 1–5', () => {
  for (const playerCount of [1, 2, 3, 4, 5]) {
    const composition = buildDefaultComposition(playerCount);
    const mismatches = checkPlayerCountComposition({
      playerCount,
      villainGroupIds: composition.villainGroupIds,
      henchmanGroupIds: composition.henchmanGroupIds,
      heroDeckIds: composition.heroDeckIds,
    });
    assert.deepEqual(
      mismatches,
      [],
      `The default composition for ${playerCount} player(s) must have zero setup-count ` +
        `mismatches, but got: ${JSON.stringify(mismatches)}`,
    );
  }
});

test('default composition carries a scheme, a mastermind, and all four supply counts', () => {
  const composition = buildDefaultComposition(1);
  assert.equal(
    typeof composition.schemeId,
    'string',
    'The default composition must carry a scheme id.',
  );
  assert.equal(
    typeof composition.mastermindId,
    'string',
    'The default composition must carry a mastermind id.',
  );
  for (const supplyField of SUPPLY_FIELDS) {
    assert.equal(
      typeof composition[supplyField],
      'number',
      `The default composition must carry a numeric ${supplyField}.`,
    );
  }
});

test('default composition uses distinct ids within each group list', () => {
  const composition = buildDefaultComposition(5);
  for (const [label, ids] of [
    ['villainGroupIds', composition.villainGroupIds],
    ['henchmanGroupIds', composition.henchmanGroupIds],
    ['heroDeckIds', composition.heroDeckIds],
  ] as const) {
    const uniqueIds = new Set(ids);
    assert.equal(
      uniqueIds.size,
      ids.length,
      `The default composition must not repeat an id within ${label}, but got: ${JSON.stringify(ids)}`,
    );
  }
});

test('an out-of-range player count falls back to the valid 1-player composition', () => {
  const fallbackComposition = buildDefaultComposition(0);
  const onePlayerComposition = buildDefaultComposition(1);
  assert.deepEqual(
    fallbackComposition,
    onePlayerComposition,
    'An out-of-range player count must fall back to the 1-player composition.',
  );
});

test('POST /api/match/autoplay refuses a setupData carrying isDebugMatch with 400 and never creates (WP-802 / D-24689 §2)', async () => {
  // why: capture the autoplay create handler (the last argument after koaBody())
  // with a fake router; the other playback routes register and are ignored.
  type AutoplayHandler = (koaContext: Record<string, unknown>) => Promise<void>;
  let createHandler: AutoplayHandler | undefined;
  const router = {
    post(path: string, ...handlers: AutoplayHandler[]): void {
      if (path === '/api/match/autoplay') {
        createHandler = handlers[handlers.length - 1];
      }
    },
    get(): void {},
  };
  registerAutoplayRoutes(router as never, {
    db: {},
    transport: {},
    auth: {},
    serverUrl: 'http://localhost:8000',
    internalDelegationSecret: 'test-secret',
  } as never);
  assert.ok(createHandler !== undefined, 'The autoplay create route must be registered.');

  const fetchCalls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls.push(String(input));
    throw new Error('A flagged autoplay request must never reach the native lobby.');
  }) as typeof globalThis.fetch;
  try {
    const koaContext: Record<string, unknown> = {
      request: { body: { playerCount: 1, setupData: { ...buildDefaultComposition(1), isDebugMatch: true } } },
      status: 0,
      body: undefined,
    };
    await createHandler(koaContext);
    assert.equal(koaContext.status, 400);
    assert.deepEqual(koaContext.body, {
      error:
        'This match setup carries isDebugMatch, which only the operator create route may set. ' +
        'Remove the field and create the match again.',
    });
    assert.deepEqual(fetchCalls, [], 'a flagged setupData never reaches the native create');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
