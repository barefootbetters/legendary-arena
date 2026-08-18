/**
 * Unit tests for the start-of-turn draw primitive (WP-236).
 *
 * Verifies drawCardsIntoHand fills the hand from the deck, reshuffles the
 * discard on exhaustion, stops early when no cards remain, and keeps the
 * zones JSON-serializable. No boardgame.io import — the helper is pure.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HAND_SIZE, drawCardsIntoHand, reshuffleDiscardIntoDeck } from './drawCards.logic.js';
import type { PlayerZones } from '../state/zones.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { makePlayerZones } from '../test/fixtureBuilders.js';

/**
 * Builds a minimal PlayerZones literal with the supplied zone overrides.
 *
 * @param partial - Zone overrides; omitted zones default to empty arrays.
 * @returns A complete PlayerZones object.
 */
function makeZones(partial: Partial<PlayerZones>): PlayerZones {
  return { ...makePlayerZones(),
    deck: partial.deck ?? [],
    hand: partial.hand ?? [],
    discard: partial.discard ?? [],
    inPlay: partial.inPlay ?? [],
    victory: partial.victory ?? [],
  };
}

// why: the reverse-shuffle proves the reshuffle actually ran — an identity
// shuffle would pass even if the helper skipped the reshuffle. Mirrors the
// deterministic makeMockCtx pattern used across the engine test suite.
const reverseShuffleContext: ShuffleProvider = {
  random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
};

describe('drawCardsIntoHand', () => {
  it('exports HAND_SIZE === 6', () => {
    assert.equal(HAND_SIZE, 6);
  });

  it('draws count cards from the top of the deck into the hand', () => {
    const zones = makeZones({ deck: ['card-a', 'card-b', 'card-c'], hand: [] });

    drawCardsIntoHand(zones, 2, reverseShuffleContext);

    assert.deepEqual(zones.hand, ['card-a', 'card-b']);
    assert.deepEqual(zones.deck, ['card-c']);
  });

  it('reshuffles the discard into the deck when the deck is exhausted mid-draw', () => {
    const zones = makeZones({
      deck: ['card-a', 'card-b'],
      hand: [],
      discard: ['card-c', 'card-d', 'card-e'],
    });

    drawCardsIntoHand(zones, 5, reverseShuffleContext);

    // 2 drawn from the deck, then the discard is reversed into the new deck
    // (['card-e', 'card-d', 'card-c']) and 3 more are drawn from its top.
    assert.equal(zones.hand.length, 5);
    assert.equal(zones.deck.length, 0);
    assert.equal(zones.discard.length, 0);
    assert.deepEqual(zones.hand, ['card-a', 'card-b', 'card-e', 'card-d', 'card-c']);
  });

  it('stops early when the deck and discard are both empty', () => {
    const zones = makeZones({ deck: ['card-a'], hand: [], discard: [] });

    drawCardsIntoHand(zones, 5, reverseShuffleContext);

    assert.deepEqual(zones.hand, ['card-a']);
    assert.equal(zones.deck.length, 0);
    assert.equal(zones.discard.length, 0);
  });

  it('draws zero cards when count is 0 and leaves the zones untouched', () => {
    const zones = makeZones({ deck: ['card-a', 'card-b'], hand: [] });

    drawCardsIntoHand(zones, 0, reverseShuffleContext);

    assert.deepEqual(zones.hand, []);
    assert.deepEqual(zones.deck, ['card-a', 'card-b']);
  });

  it('leaves the zones JSON-serializable after drawing', () => {
    const zones = makeZones({ deck: ['card-a', 'card-b', 'card-c'], hand: [] });

    drawCardsIntoHand(zones, 2, reverseShuffleContext);

    assert.doesNotThrow(() => JSON.stringify(zones));
  });
});

describe('reshuffleDiscardIntoDeck (WP-478 / D-24285)', () => {
  it('appends the reshuffled discard AFTER cards already on top', () => {
    // why: a partial reveal window left 'top' on the deck; the reshuffled discard
    // (reversed by the fake shuffle) must slide in beneath it, not replace it.
    const zones = makeZones({ deck: ['top'], discard: ['x', 'y'] });

    reshuffleDiscardIntoDeck(zones, reverseShuffleContext);

    assert.deepEqual(zones.deck, ['top', 'y', 'x']);
    assert.deepEqual(zones.discard, []);
  });

  it('forms the whole deck from the discard when the deck is empty', () => {
    const zones = makeZones({ deck: [], discard: ['a', 'b', 'c'] });

    reshuffleDiscardIntoDeck(zones, reverseShuffleContext);

    assert.deepEqual(zones.deck, ['c', 'b', 'a']);
    assert.deepEqual(zones.discard, []);
  });

  it('is a no-op when the discard is empty (the terminal condition)', () => {
    const zones = makeZones({ deck: ['only'], discard: [] });

    reshuffleDiscardIntoDeck(zones, reverseShuffleContext);

    assert.deepEqual(zones.deck, ['only']);
    assert.deepEqual(zones.discard, []);
  });

  it('is a safe no-op on an empty discard even without a shuffle context', () => {
    // why: the context is only dereferenced when there is a discard to shuffle, so a
    // caller that never reaches a non-empty discard may pass undefined.
    const zones = makeZones({ deck: ['only'], discard: [] });

    assert.doesNotThrow(() => reshuffleDiscardIntoDeck(zones, undefined));
    assert.deepEqual(zones.deck, ['only']);
  });

  it('leaves the deck unchanged when a non-empty discard has no shuffle source', () => {
    // why: determinism — without ctx.random.Shuffle we cannot deterministically
    // reform the deck, so leave the zones untouched rather than use a fallback RNG.
    const zones = makeZones({ deck: [], discard: ['a', 'b'] });

    reshuffleDiscardIntoDeck(zones, undefined);

    assert.deepEqual(zones.deck, []);
    assert.deepEqual(zones.discard, ['a', 'b']);
  });
});
