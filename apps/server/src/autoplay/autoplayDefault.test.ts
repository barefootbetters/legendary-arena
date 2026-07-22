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

import { buildDefaultComposition } from './autoplay.mjs';

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
