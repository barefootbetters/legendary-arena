// why: WP-609 / EC-644 — proves the "Next hand" projection math. The load-bearing
// assertion is the two-stage EV: a short deck's cards are drawn with certainty
// before the discard reshuffles in, so a single combined-pool draw (which runs
// ~14% low on a short deck) is a FAIL. Also pins the closed-form EV (not sampled),
// the seeded-Monte-Carlo determinism, and the stable pool seed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpeculativePrng } from '@legendary-arena/preplan';
import {
  nextHandDrawSplit,
  expectedNextHand,
  sampleNextHandRange,
  projectNextHand,
  seedFromPool,
  HAND_PROJECTION_SAMPLE_COUNT,
  type HandProjectionPool,
} from './handProjection';

/** A pool where every deck card is `deckStat` and every discard card is `discardStat`. */
function uniformPool(
  deckCount: number,
  discardCount: number,
  deckStat: { recruit: number; attack: number; cost: number },
  discardStat: { recruit: number; attack: number; cost: number },
): HandProjectionPool {
  const deck: string[] = [];
  for (let index = 0; index < deckCount; index += 1) {
    deck.push('deck-card');
  }
  const discard: string[] = [];
  for (let index = 0; index < discardCount; index += 1) {
    discard.push('discard-card');
  }
  return {
    deck,
    discard,
    stats: { 'deck-card': deckStat, 'discard-card': discardStat },
  };
}

test('nextHandDrawSplit draws the deck first, discard supplies only the shortfall', () => {
  // Full deck: all six from the deck, none from the discard.
  assert.deepEqual(nextHandDrawSplit(20, 20), { fromDeck: 6, fromDiscard: 0 });
  // Short deck: two certain from the deck, four from the reshuffled discard.
  assert.deepEqual(nextHandDrawSplit(2, 10), { fromDeck: 2, fromDiscard: 4 });
  // Deck exactly a hand: no reshuffle.
  assert.deepEqual(nextHandDrawSplit(6, 9), { fromDeck: 6, fromDiscard: 0 });
  // Both empty: nothing drawn.
  assert.deepEqual(nextHandDrawSplit(0, 0), { fromDeck: 0, fromDiscard: 0 });
  // Tiny total pool: draw everything, no more.
  assert.deepEqual(nextHandDrawSplit(1, 2), { fromDeck: 1, fromDiscard: 2 });
});

test('expectedNextHand is the EXACT two-stage mean, not a single-pool draw', () => {
  // deck = two cards worth 10 attack; discard = five worth 0. HAND_SIZE = 6.
  // Two-stage: both tens are CERTAIN (fromDeck=2) + 4 zeros → 20.
  // A single combined-pool draw of 6 from 7 cards would give ~17.14 — the bug.
  const pool = uniformPool(
    2,
    5,
    { recruit: 0, attack: 10, cost: 0 },
    { recruit: 0, attack: 0, cost: 0 },
  );
  const expected = expectedNextHand(pool);
  assert.equal(expected.attack, 20);
  assert.equal(expected.recruit, 0);
});

test('expectedNextHand: a full deck draws entirely off the deck', () => {
  const pool = uniformPool(
    12,
    8,
    { recruit: 1, attack: 0, cost: 1 },
    { recruit: 99, attack: 99, cost: 0 },
  );
  const expected = expectedNextHand(pool);
  // Six drawn, all from the deck (recruit 1 each) → 6; the discard never enters.
  assert.equal(expected.recruit, 6);
  assert.equal(expected.attack, 0);
});

test('expectedNextHand: proportional mean within a mixed short deck', () => {
  // deck = one 4-recruit + one 0-recruit; both are drawn (fromDeck=2) → 4.
  const pool: HandProjectionPool = {
    deck: ['high', 'low'],
    discard: ['d', 'd', 'd', 'd'],
    stats: {
      high: { recruit: 4, attack: 0, cost: 0 },
      low: { recruit: 0, attack: 0, cost: 0 },
      d: { recruit: 1, attack: 0, cost: 0 },
    },
  };
  const expected = expectedNextHand(pool);
  // fromDeck=2 → 4+0; fromDiscard=min(4,4)=4 → 4×(4/4)=4 → 8 total.
  assert.equal(expected.recruit, 8);
});

test('expectedNextHand treats a missing deckCardStats entry as 0', () => {
  const pool: HandProjectionPool = {
    deck: ['known', 'unknown'],
    discard: [],
    stats: { known: { recruit: 3, attack: 2, cost: 0 } },
  };
  const expected = expectedNextHand(pool);
  // Both drawn (fromDeck=2): 3 + 0 recruit, 2 + 0 attack.
  assert.equal(expected.recruit, 3);
  assert.equal(expected.attack, 2);
});

test('expectedNextHand: empty pool projects zero, never NaN', () => {
  const pool: HandProjectionPool = { deck: [], discard: [], stats: {} };
  const expected = expectedNextHand(pool);
  assert.equal(expected.recruit, 0);
  assert.equal(expected.attack, 0);
});

test('projectNextHand EV equals the closed form (not the sampled mean)', () => {
  const pool = uniformPool(
    2,
    5,
    { recruit: 0, attack: 10, cost: 0 },
    { recruit: 0, attack: 0, cost: 0 },
  );
  const projection = projectNextHand(pool, createSpeculativePrng(seedFromPool(pool.deck, pool.discard)), 50);
  // Exact — the EV is closed-form regardless of the tiny sample count.
  assert.equal(projection.expectedAttack, 20);
});

test('sampleNextHandRange is deterministic for a given seed', () => {
  const pool = uniformPool(
    4,
    6,
    { recruit: 2, attack: 1, cost: 2 },
    { recruit: 1, attack: 3, cost: 0 },
  );
  const seed = seedFromPool(pool.deck, pool.discard);
  const first = sampleNextHandRange(pool, createSpeculativePrng(seed), HAND_PROJECTION_SAMPLE_COUNT);
  const second = sampleNextHandRange(pool, createSpeculativePrng(seed), HAND_PROJECTION_SAMPLE_COUNT);
  assert.deepEqual(first, second);
});

test('range is ordered low <= high and brackets the expected value', () => {
  const pool = uniformPool(
    5,
    5,
    { recruit: 3, attack: 1, cost: 2 },
    { recruit: 0, attack: 4, cost: 0 },
  );
  const projection = projectNextHand(
    pool,
    createSpeculativePrng(seedFromPool(pool.deck, pool.discard)),
  );
  assert.ok(projection.recruitRange.low <= projection.recruitRange.high);
  assert.ok(projection.attackRange.low <= projection.attackRange.high);
  // The p10/p90 band should straddle the mean for a non-degenerate pool.
  assert.ok(projection.recruitRange.low <= projection.expectedRecruit);
  assert.ok(projection.expectedRecruit <= projection.recruitRange.high);
});

test('seedFromPool is stable per pool and varies across pools', () => {
  const a = seedFromPool(['x', 'y'], ['z']);
  const b = seedFromPool(['x', 'y'], ['z']);
  const c = seedFromPool(['x', 'y'], ['w']);
  assert.equal(a, b);
  assert.notEqual(a, c);
});
