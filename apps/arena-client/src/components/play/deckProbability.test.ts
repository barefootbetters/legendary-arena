import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UIPlayerState } from '@legendary-arena/game-engine';
import {
  categorizeVillainCard,
  summarizeVillainDeck,
  nextDrawOdds,
  atLeastOneInNextN,
  harvestCardNames,
  tallyOwnDeck,
} from './deckProbability';

test('categorizeVillainCard maps each synthetic prefix to its RevealedCardType', () => {
  assert.equal(categorizeVillainCard('master-strike-03'), 'mastermind-strike');
  assert.equal(
    categorizeVillainCard('scheme-twist-negative-zone-01'),
    'scheme-twist',
  );
  assert.equal(categorizeVillainCard('bystander-villain-deck-07'), 'bystander');
  assert.equal(categorizeVillainCard('henchman-doombot-legion-02'), 'henchman');
  // villain is the fallback: `{setAbbr}-villain-{group}-{card}-NN`
  assert.equal(categorizeVillainCard('core-villain-hydra-viper-00'), 'villain');
  // any unrecognized shape also falls back to villain
  assert.equal(categorizeVillainCard('something-else'), 'villain');
});

test('categorizeVillainCard pins the documented Killbots miscount (Phase-1 limit)', () => {
  // why: a Killbots-converted card keeps its bystander-villain-deck- prefix even
  // though the engine type is `villain` (via unprojected G.convertedOrigins), so
  // this prefix reader miscounts it as Bystander. Pinning the known limit.
  assert.equal(categorizeVillainCard('bystander-villain-deck-11'), 'bystander');
});

test('summarizeVillainDeck counts by type with a total', () => {
  const composition = [
    'master-strike-00',
    'master-strike-01',
    'scheme-twist-x-00',
    'bystander-villain-deck-00',
    'henchman-y-00',
    'core-villain-z-a-00',
    'core-villain-z-a-01',
  ];
  const summary = summarizeVillainDeck(composition);
  assert.equal(summary.total, 7);
  assert.equal(summary.counts['mastermind-strike'], 2);
  assert.equal(summary.counts['scheme-twist'], 1);
  assert.equal(summary.counts.bystander, 1);
  assert.equal(summary.counts.henchman, 1);
  assert.equal(summary.counts.villain, 2);
});

test('nextDrawOdds returns count/deckSize and 0 for an empty deck', () => {
  assert.equal(nextDrawOdds(2, 8), 0.25);
  assert.equal(nextDrawOdds(0, 8), 0);
  assert.equal(nextDrawOdds(3, 0), 0);
});

test('atLeastOneInNextN is the hypergeometric complement, with guards', () => {
  assert.equal(atLeastOneInNextN(0, 10, 3), 0); // no matches
  assert.equal(atLeastOneInNextN(2, 0, 3), 0); // empty deck
  assert.equal(atLeastOneInNextN(2, 10, 0), 0); // no draws
  assert.equal(atLeastOneInNextN(2, 10, 10), 1); // draw the whole deck
  assert.equal(atLeastOneInNextN(2, 10, 20), 1); // n >= deckSize
  // 1 match in a 4-card deck, 1 draw → 1/4.
  assert.equal(atLeastOneInNextN(1, 4, 1), 0.25);
  // 1 match in a 4-card deck, 2 draws → 1 − (3/4)(2/3) = 1/2.
  assert.ok(Math.abs(atLeastOneInNextN(1, 4, 2) - 0.5) < 1e-9);
  // more draws than non-matching cards → certain (3 matches in 4, 2 draws).
  assert.equal(atLeastOneInNextN(3, 4, 2), 1);
});

test('harvestCardNames collects names from the flat display arrays and victory entries', () => {
  const player: UIPlayerState = {
    playerId: '0',
    deckCount: 0,
    handCount: 0,
    discardCount: 0,
    inPlayCount: 0,
    victoryCount: 0,
    woundCount: 0,
    handDisplay: [{ extId: 'a', name: 'Alpha', imageUrl: '', cost: 1 }],
    inPlayDisplay: [{ extId: 'b', name: 'Bravo', imageUrl: '', cost: 2 }],
    discardDisplay: [{ extId: 'c', name: 'Charlie', imageUrl: '', cost: 0 }],
    victoryCards: [
      { extId: 'd', display: { extId: 'd', name: 'Delta', imageUrl: '', cost: 3 } },
    ],
  };
  const names = harvestCardNames(player);
  assert.equal(names.get('a'), 'Alpha');
  assert.equal(names.get('b'), 'Bravo');
  assert.equal(names.get('c'), 'Charlie');
  // victory entries carry the nested UIDisplayEntry shape (name at .display.name)
  assert.equal(names.get('d'), 'Delta');
  assert.equal(names.size, 4);
});

test('tallyOwnDeck groups by resolved name with an Unknown fallback, sorted', () => {
  const names = new Map([
    ['a', 'Alpha'],
    ['b', 'Bravo'],
  ]);
  const composition = ['a', 'a', 'b', 'zzz-unresolved', 'a'];
  const tally = tallyOwnDeck(composition, names);
  // Alpha x3 first; then Bravo x1 vs Unknown x1 — tie broken by name.
  assert.deepEqual(tally, [
    { name: 'Alpha', count: 3 },
    { name: 'Bravo', count: 1 },
    { name: 'Unknown', count: 1 },
  ]);
});
