/**
 * loadoutSummary.ts — tests (WP-302 / EC-333).
 *
 * Verifies `summarizeLoadout` extracts mastermind/scheme/hero/villain/
 * henchman names and the numeric counts from a well-formed LAGN
 * document, and returns safe fallbacks (`'Unknown'` names, empty lists,
 * `null` counts) for missing / misshaped fields without throwing — all
 * without importing `@legendary-arena/lagn`. Pure `node:test`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { summarizeLoadout } from './loadoutSummary';

const WELL_FORMED_LAGN = {
  lagn_version: 1,
  player_count: 3,
  setup: {
    mastermind: { id: 'lg/loki', name: 'Loki' },
    scheme: { id: 'lg/unleash', name: 'Unleash the Power Cosmic' },
    heroes: [
      { id: 'lg/spider-man', name: 'Spider-Man' },
      { id: 'lg/cyclops', name: 'Cyclops' },
    ],
    villain_groups: [{ id: 'lg/hydra', name: 'HYDRA' }],
    henchmen_groups: [{ id: 'lg/doombot', name: 'Doombot' }],
    bystanders_count: 12,
    wounds_count: 30,
    shield_officers_count: 30,
    sidekicks_count: 0,
  },
};

test('summarizeLoadout extracts names and counts from a well-formed document', () => {
  const summary = summarizeLoadout(WELL_FORMED_LAGN);
  assert.deepEqual(summary, {
    mastermind: 'Loki',
    scheme: 'Unleash the Power Cosmic',
    heroes: ['Spider-Man', 'Cyclops'],
    villainGroups: ['HYDRA'],
    henchmanGroups: ['Doombot'],
    playerCount: 3,
    bystandersCount: 12,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  });
});

test('summarizeLoadout falls back to the id when an entity name is absent', () => {
  const summary = summarizeLoadout({
    setup: {
      mastermind: { id: 'lg/loki' },
      heroes: [{ id: 'lg/spider-man' }],
    },
  });
  assert.equal(summary.mastermind, 'lg/loki');
  assert.deepEqual(summary.heroes, ['lg/spider-man']);
});

test('summarizeLoadout returns safe fallbacks for a missing setup block', () => {
  const summary = summarizeLoadout({ lagn_version: 1 });
  assert.deepEqual(summary, {
    mastermind: 'Unknown',
    scheme: 'Unknown',
    heroes: [],
    villainGroups: [],
    henchmanGroups: [],
    playerCount: null,
    bystandersCount: null,
    woundsCount: null,
    officersCount: null,
    sidekicksCount: null,
  });
});

test('summarizeLoadout does not throw on null / non-object / misshaped input', () => {
  for (const bad of [null, undefined, 42, 'nope', [], { setup: 'not-an-object' }]) {
    const summary = summarizeLoadout(bad);
    assert.equal(summary.mastermind, 'Unknown');
    assert.deepEqual(summary.heroes, []);
    assert.equal(summary.bystandersCount, null);
  }
});

test('summarizeLoadout ignores misshaped array entries and negative/non-integer counts', () => {
  const summary = summarizeLoadout({
    setup: {
      heroes: [{ id: 'lg/a', name: 'A' }, 'not-an-object', 99, { name: 'B' }],
      villain_groups: 'not-an-array',
      bystanders_count: -1,
      wounds_count: 3.5,
    },
  });
  assert.deepEqual(summary.heroes, ['A', 'B']);
  assert.deepEqual(summary.villainGroups, []);
  assert.equal(summary.bystandersCount, null);
  assert.equal(summary.woundsCount, null);
});
