/**
 * Determinism tests for buildInitialGameState.
 *
 * Verifies that identical inputs produce identical outputs. A failure here
 * indicates a replay-breaking change — the engine must produce the exact
 * same initial state given the same config, registry, and RNG.
 *
 * Uses makeMockCtx from src/test/mockCtx.ts — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialGameState } from './buildInitialGameState.js';
import { shuffleDeck } from './shuffle.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';

/**
 * Creates a valid mock MatchSetupConfig for determinism tests.
 */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test-scheme-det',
    mastermindId: 'test-mastermind-det',
    villainGroupIds: ['test-villain-det-001', 'test-villain-det-002'],
    henchmanGroupIds: ['test-henchman-det-001'],
    heroDeckIds: ['test-hero-det-001', 'test-hero-det-002', 'test-hero-det-003'],
    bystandersCount: 20,
    woundsCount: 15,
    officersCount: 10,
    sidekicksCount: 5,
  };
}

/**
 * Creates a minimal mock registry that satisfies CardRegistryReader.
 */
function createMockRegistry(): CardRegistryReader {
  return {
    listCards: () => [],
  };
}

describe('buildInitialGameState — determinism', () => {
  // why: A failure in this test means that the same inputs no longer produce
  // identical outputs. This is a replay-breaking change — any code that
  // relies on deterministic setup (replay systems, testing, debugging) would
  // produce different results. This test must always pass.
  it('two calls with the same inputs produce identical G', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();

    // why: Using the same makeMockCtx() instance for both calls ensures that
    // the RNG behavior is identical. makeMockCtx's Shuffle reverses arrays
    // deterministically, so both calls should produce the exact same state.
    const context = makeMockCtx({ numPlayers: 3 });

    const firstState = buildInitialGameState(config, registry, context);
    const secondState = buildInitialGameState(config, registry, context);

    assert.deepStrictEqual(
      firstState,
      secondState,
      'Two calls with identical inputs must produce identical game state. ' +
      'A mismatch here indicates a replay-breaking change in the setup logic.',
    );
  });

  it('serialized G is identical between two calls', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 2 });

    const firstSerialized = JSON.stringify(
      buildInitialGameState(config, registry, context),
    );
    const secondSerialized = JSON.stringify(
      buildInitialGameState(config, registry, context),
    );

    assert.equal(
      firstSerialized,
      secondSerialized,
      'Serialized game state must be byte-for-byte identical between two ' +
      'calls with the same inputs. A mismatch indicates non-determinism.',
    );
  });

  it('different player counts produce different state', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();

    const twoPlayerState = buildInitialGameState(
      config,
      registry,
      makeMockCtx({ numPlayers: 2 }),
    );
    const threePlayerState = buildInitialGameState(
      config,
      registry,
      makeMockCtx({ numPlayers: 3 }),
    );

    assert.notDeepStrictEqual(
      twoPlayerState.playerZones,
      threePlayerState.playerZones,
      'Different player counts must produce different playerZones',
    );
  });

  it('shuffleDeck was called (deck order differs from unshuffled)', () => {
    const config = createTestConfig();
    const registry = createMockRegistry();
    const context = makeMockCtx({ numPlayers: 1 });

    const gameState = buildInitialGameState(config, registry, context);
    const deck = gameState.playerZones['0'].deck;

    // why: makeMockCtx reverses arrays during shuffle. The unshuffled starting
    // deck is [agent x8, trooper x4]. After reversal, the deck should start
    // with troopers and end with agents. If the deck matches the unshuffled
    // order, the shuffle was skipped.
    const firstCard = deck[0];
    const lastCard = deck[deck.length - 1];

    // After reversal: troopers at front, agents at back
    assert.ok(
      firstCard.includes('trooper'),
      'After mock shuffle (reverse), the first card should be a trooper. ' +
      'If this fails, shuffleDeck may not be calling context.random.Shuffle.',
    );
    assert.ok(
      lastCard.includes('agent'),
      'After mock shuffle (reverse), the last card should be an agent. ' +
      'If this fails, shuffleDeck may not be calling context.random.Shuffle.',
    );
  });

  it('shuffleDeck does not mutate the input array', () => {
    const original = ['card-a', 'card-b', 'card-c', 'card-d'];
    const snapshot = [...original];
    const context = makeMockCtx();

    shuffleDeck(original, context);

    // why: shuffleDeck passes [...cards] to context.random.Shuffle to
    // guarantee the caller's array is never mutated. If the defensive copy
    // is removed, this test will fail because makeMockCtx's Shuffle reverses
    // in-place via the spread, but the original would also be passed by
    // reference to Shuffle which could mutate it.
    assert.deepStrictEqual(
      original,
      snapshot,
      'shuffleDeck must not mutate the input array. The defensive copy ' +
      'inside shuffleDeck protects callers from side effects.',
    );
  });
});
