/**
 * simulation.setupShuffle.test.ts — the seeded setup-shuffle regression guard
 * (WP-453 / EC-488 / D-24273).
 *
 * The simulation and fixture-replay setup paths used to build their
 * `SetupContext` from the unit-test helper whose `Shuffle` simply reverses the
 * array. `buildVillainDeck` lexically sorts the assembled deck before shuffling
 * and virtual `scheme-twist-…` ids sort LAST, so reversing stacked every twist
 * on TOP of the villain deck. On the two core schemes whose twist resolver
 * chains extra reveals that cascaded through all eight clustered twists in one
 * turn-1 reveal and tripped the doom-clock threshold — an auto-loss at turn 0,
 * before any move — and it depressed every other scheme more mildly.
 *
 * These tests drive the REAL `makeSeededSetupContext(...).random.Shuffle` with a
 * controlled `nextRandom` stub, which is a legitimate INPUT to the builder.
 *
 * why NOT re-implement mulberry32 or Fisher-Yates here and assert against the
 * test's own copy: that would pass even if a setup site reverted to the reverse
 * mock, making the guard vacuous. The wiring itself is additionally covered by
 * the zero-`makeMockCtx` grep in the three touched files, by the re-recorded
 * sentinel fixture, and by the `simulation.captureMoves.test.ts` round-trip.
 *
 * Runner: node:test (native Node.js). Registry-free — the game-engine layer
 * must not import the registry.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { makeSeededSetupContext } from './simulation.runner.js';

/**
 * A deterministic stand-in for the run's mulberry32 closure.
 *
 * why: a fixed, repeatable sequence lets these tests assert BOTH that the real
 * Fisher-Yates permutes (not reverses, not identity) and that the same
 * `nextRandom` state reproduces a byte-identical order — without this file
 * owning a second copy of the PRNG the builder is supposed to use.
 *
 * @param values - The 0..1 sequence to emit, cycled if exhausted.
 * @returns A closure with the same shape as the run's mulberry32.
 */
function makeStubNextRandom(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length]!;
    index += 1;
    return value;
  };
}

/**
 * A lexically-sorted deck shaped like the one `buildVillainDeck` produces:
 * ordinary villain ids first, virtual scheme-twist ids sorted last.
 */
function makeSortedDeckWithTrailingTwists(): string[] {
  const villains = [
    'bystander-00',
    'core-villain-a-00',
    'core-villain-b-01',
    'henchman-doombot-00',
    'henchman-doombot-01',
    'master-strike-00',
  ];
  const twists = [
    'scheme-twist-x-00',
    'scheme-twist-x-01',
    'scheme-twist-x-02',
    'scheme-twist-x-03',
  ];
  return [...villains, ...twists];
}

/** True when every scheme-twist id sits in one unbroken run at the top. */
function twistsAreClusteredAtTop(deck: readonly string[], twistCount: number): boolean {
  const head = deck.slice(0, twistCount);
  return head.every((cardId) => cardId.startsWith('scheme-twist-'));
}

describe('makeSeededSetupContext — seeded setup shuffle (WP-453 / D-24273)', () => {
  it('exposes the SetupContext shape buildInitialGameState consumes', () => {
    const context = makeSeededSetupContext(3, makeStubNextRandom([0.5]));
    assert.equal(context.ctx.numPlayers, 3, 'seat count is carried through');
    assert.equal(typeof context.random.Shuffle, 'function', 'Shuffle is provided');
  });

  it('does not return the identity order', () => {
    const deck = makeSortedDeckWithTrailingTwists();
    const context = makeSeededSetupContext(2, makeStubNextRandom([0.13, 0.71, 0.42, 0.88, 0.05, 0.63]));
    const shuffled = context.random.Shuffle(deck);
    assert.notDeepEqual(shuffled, deck, 'a shuffle that returns its input has not shuffled');
  });

  it('does not return the REVERSE order — the exact reverse-mock behaviour', () => {
    // why: the direct regression guard. The old setup context reversed, and the
    // reverse of a sorted deck is what clustered the twists.
    const deck = makeSortedDeckWithTrailingTwists();
    const context = makeSeededSetupContext(2, makeStubNextRandom([0.13, 0.71, 0.42, 0.88, 0.05, 0.63]));
    const shuffled = context.random.Shuffle(deck);
    assert.notDeepEqual(shuffled, [...deck].reverse(), 'the setup shuffle must not be a reverse');
  });

  it('does not cluster every scheme-twist id at the top of the deck', () => {
    // why: THE bug. Reversing a lexically sorted deck put all four twists in an
    // unbroken run at the top, which is what cascaded to the turn-0 loss.
    const deck = makeSortedDeckWithTrailingTwists();
    const twistCount = deck.filter((cardId) => cardId.startsWith('scheme-twist-')).length;

    assert.equal(
      twistsAreClusteredAtTop([...deck].reverse(), twistCount),
      true,
      'sanity: the reverse of this deck DOES cluster the twists (the bug being guarded)',
    );

    const context = makeSeededSetupContext(2, makeStubNextRandom([0.13, 0.71, 0.42, 0.88, 0.05, 0.63]));
    const shuffled = context.random.Shuffle(deck);
    assert.equal(
      twistsAreClusteredAtTop(shuffled, twistCount),
      false,
      'the seeded shuffle must distribute twists, not stack them on top',
    );
  });

  it('preserves the deck contents exactly — a permutation, not a rewrite', () => {
    const deck = makeSortedDeckWithTrailingTwists();
    const context = makeSeededSetupContext(2, makeStubNextRandom([0.13, 0.71, 0.42, 0.88, 0.05, 0.63]));
    const shuffled = context.random.Shuffle(deck);
    assert.equal(shuffled.length, deck.length, 'no card gained or lost');
    assert.deepEqual([...shuffled].sort(), [...deck].sort(), 'same multiset of ids');
  });

  it('does not mutate the input deck', () => {
    const deck = makeSortedDeckWithTrailingTwists();
    const before = [...deck];
    const context = makeSeededSetupContext(2, makeStubNextRandom([0.13, 0.71, 0.42, 0.88, 0.05, 0.63]));
    context.random.Shuffle(deck);
    assert.deepEqual(deck, before, 'Shuffle returns a new array and leaves its input alone');
  });

  it('is deterministic — the same nextRandom sequence reproduces the order', () => {
    const deck = makeSortedDeckWithTrailingTwists();
    const sequence = [0.13, 0.71, 0.42, 0.88, 0.05, 0.63];
    const first = makeSeededSetupContext(2, makeStubNextRandom(sequence)).random.Shuffle(deck);
    const second = makeSeededSetupContext(2, makeStubNextRandom(sequence)).random.Shuffle(deck);
    assert.deepEqual(second, first, 'identical seed state must reproduce byte-identical order');
  });

  it('is seed-sensitive — a different nextRandom sequence gives a different order', () => {
    const deck = makeSortedDeckWithTrailingTwists();
    const first = makeSeededSetupContext(
      2,
      makeStubNextRandom([0.13, 0.71, 0.42, 0.88, 0.05, 0.63]),
    ).random.Shuffle(deck);
    const second = makeSeededSetupContext(
      2,
      makeStubNextRandom([0.97, 0.02, 0.55, 0.31, 0.79, 0.24]),
    ).random.Shuffle(deck);
    assert.notDeepEqual(second, first, 'a different PRNG stream must produce a different order');
  });
});
