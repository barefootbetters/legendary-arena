import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createSpeculativePrng,
  speculativeShuffle,
} from './speculativePrng.js';

describe('preplan PRNG (WP-057)', () => {
  test('same seed produces same shuffle order', () => {
    const deck = ['card-a', 'card-b', 'card-c', 'card-d', 'card-e', 'card-f', 'card-g', 'card-h'];
    const firstRun = speculativeShuffle(deck, createSpeculativePrng(42));
    const secondRun = speculativeShuffle(deck, createSpeculativePrng(42));
    assert.deepEqual(firstRun, secondRun);
  });

  test('different seeds produce different shuffle orders', () => {
    const deck = ['card-a', 'card-b', 'card-c', 'card-d', 'card-e', 'card-f', 'card-g', 'card-h'];
    const shuffleA = speculativeShuffle(deck, createSpeculativePrng(42));
    const shuffleB = speculativeShuffle(deck, createSpeculativePrng(43));
    assert.notDeepEqual(shuffleA, shuffleB);
  });

  test('shuffle does not mutate input array', () => {
    // why: seed 42 applied to this 8-card deck produces a non-identity
    // Fisher-Yates permutation under the WP-057 LCG (first draw picks
    // j=2 on the i=7 step), so the returned array must differ from the
    // input — guaranteeing the non-mutation assertion is a real check
    // and not a trivial equality between two identity-permutations.
    const deck = ['card-a', 'card-b', 'card-c', 'card-d', 'card-e', 'card-f', 'card-g', 'card-h'];
    const originalCopy = [...deck];
    const shuffled = speculativeShuffle(deck, createSpeculativePrng(42));
    assert.deepEqual(deck, originalCopy);
    assert.notDeepEqual(shuffled, originalCopy);
  });
});
