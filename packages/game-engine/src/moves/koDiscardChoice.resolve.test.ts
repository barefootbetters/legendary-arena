/**
 * Tests for the KO-from-discard vertical (WP-693 / EC-730 / D-24510): the
 * eligibility predicate, hasPendingKoDiscardChoice, and the resolveKoDiscardChoice
 * move (0/3/4/over-cap/duplicate/absent/wrong-player/empty-queue).
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEligibleKoDiscardCards,
  hasPendingKoDiscardChoice,
  resolveKoDiscardChoice,
} from './koDiscardChoice.resolve.js';
import type { LegendaryGameState, PendingKoDiscardChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

interface MockGOptions {
  discard?: CardExtId[];
  ko?: CardExtId[];
  pending?: PendingKoDiscardChoice[];
}

/** Minimal state: resolveKoDiscardChoice reads only playerZones[pid].discard, G.ko, the queue, messages. */
function makeG(options?: MockGOptions): LegendaryGameState {
  return {
    messages: [],
    ko: [...(options?.ko ?? [])],
    playerZones: {
      '0': { deck: [], hand: [], discard: [...(options?.discard ?? [])], inPlay: [], victory: [] },
      '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    ...(options?.pending ? { pendingKoDiscardChoices: options.pending } : {}),
  } as unknown as LegendaryGameState;
}

/** A move context carrying only what resolveKoDiscardChoice reads (G + playerID). */
function makeContext(gameState: LegendaryGameState, playerID = '0') {
  return { G: gameState, playerID } as never;
}

/** A parked KO-from-discard choice for player 0 with cap 4. */
function parked(): PendingKoDiscardChoice[] {
  return [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 4 }];
}

describe('hasPendingKoDiscardChoice (WP-693 / D-24510)', () => {
  it('reflects the queue: undefined → false, empty → false, non-empty → true', () => {
    assert.equal(hasPendingKoDiscardChoice(makeG()), false);
    assert.equal(hasPendingKoDiscardChoice(makeG({ pending: [] })), false);
    assert.equal(hasPendingKoDiscardChoice(makeG({ pending: parked() })), true);
  });
});

describe('getEligibleKoDiscardCards (WP-693 / D-24510)', () => {
  it('returns the player discard in order, and a fresh copy (not the live array)', () => {
    const G = makeG({ discard: ['a', 'b', 'c'] });
    const eligible = getEligibleKoDiscardCards(G, '0');
    assert.deepStrictEqual(eligible, ['a', 'b', 'c']);
    eligible.push('x');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a', 'b', 'c'], 'the live discard is not mutated by the returned copy');
  });

  it('returns [] for an unknown player', () => {
    assert.deepStrictEqual(getEligibleKoDiscardCards(makeG(), '9'), []);
  });
});

describe('resolveKoDiscardChoice (WP-693 / D-24510)', () => {
  it('KO 0 (empty selection) is the legal "KO nothing" choice — pops the queue, KOs nothing', () => {
    const G = makeG({ discard: ['a', 'b'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: [] });
    assert.equal(hasPendingKoDiscardChoice(G), false, 'the empty selection still front-pops');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a', 'b'], 'nothing left the discard');
    assert.deepStrictEqual(G.ko, [], 'nothing was KO\'d');
  });

  it('KO 3 removes the chosen cards from discard and appends them to G.ko', () => {
    const G = makeG({ discard: ['a', 'b', 'c', 'd'], ko: ['pre'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a', 'c', 'd'] });
    assert.equal(hasPendingKoDiscardChoice(G), false);
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['b'], 'only unselected cards remain in discard');
    assert.deepStrictEqual(G.ko, ['pre', 'a', 'c', 'd'], 'the KO pile gains the chosen cards after any prior entry');
  });

  it('KO 4 (exactly the cap) is allowed', () => {
    const G = makeG({ discard: ['a', 'b', 'c', 'd', 'e'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a', 'b', 'c', 'd'] });
    assert.equal(hasPendingKoDiscardChoice(G), false);
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['e']);
    assert.deepStrictEqual(G.ko, ['a', 'b', 'c', 'd']);
  });

  it('OVER-CAP (5 > 4) is a silent no-op with the queue intact', () => {
    const G = makeG({ discard: ['a', 'b', 'c', 'd', 'e'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a', 'b', 'c', 'd', 'e'] });
    assert.equal(hasPendingKoDiscardChoice(G), true, 'over-cap leaves the queue intact');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a', 'b', 'c', 'd', 'e'], 'discard untouched');
    assert.deepStrictEqual(G.ko, []);
  });

  it('DUPLICATE ids are a silent no-op with the queue intact', () => {
    const G = makeG({ discard: ['a', 'b'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a', 'a'] });
    assert.equal(hasPendingKoDiscardChoice(G), true, 'a repeated id leaves the queue intact');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a', 'b'], 'discard untouched');
    assert.deepStrictEqual(G.ko, []);
  });

  it('an ABSENT id (not in the discard) is a silent no-op with the queue and discard intact', () => {
    const G = makeG({ discard: ['a', 'b'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a', 'zzz'] });
    assert.equal(hasPendingKoDiscardChoice(G), true, 'an absent id leaves the queue intact');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a', 'b'], 'discard fully restored on the invalid submission');
    assert.deepStrictEqual(G.ko, []);
  });

  it('a WRONG-PLAYER resolve (front.playerID !== playerID) is a silent no-op', () => {
    const G = makeG({ discard: ['a'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G, '1'), { cardIds: ['a'] });
    assert.equal(hasPendingKoDiscardChoice(G), true, 'a non-owner resolve leaves the queue intact');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a']);
  });

  it('an EMPTY queue is a silent no-op (no throw)', () => {
    const G = makeG({ discard: ['a'] });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a'] });
    assert.equal(hasPendingKoDiscardChoice(G), false);
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a'], 'nothing was KO\'d against an empty queue');
  });

  it('a non-array / non-string payload is a silent no-op', () => {
    const badArray = makeG({ discard: ['a'], pending: parked() });
    resolveKoDiscardChoice(makeContext(badArray), { cardIds: 'a' as never });
    assert.equal(hasPendingKoDiscardChoice(badArray), true, 'non-array cardIds leaves the queue intact');

    const badElement = makeG({ discard: ['a'], pending: parked() });
    resolveKoDiscardChoice(makeContext(badElement), { cardIds: [123 as never] });
    assert.equal(hasPendingKoDiscardChoice(badElement), true, 'a non-string element leaves the queue intact');
  });
});
