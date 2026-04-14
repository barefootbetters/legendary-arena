/**
 * Tests for the Legendary Arena replay harness (WP-027).
 *
 * Verifies that the replay harness produces deterministic results,
 * canonical state hashing works correctly, and all contracts are
 * JSON-serializable.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ReplayInput } from './replay.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import { replayGame } from './replay.execute.js';
import { computeStateHash } from './replay.hash.js';
import { verifyDeterminism } from './replay.verify.js';

/**
 * Minimal mock registry for replay tests. Returns empty card list since
 * replay tests do not require card validation.
 */
const mockRegistry: CardRegistryReader = { listCards: () => [] };

/**
 * Standard test ReplayInput with all 9 MatchSetupConfig fields.
 * Uses the same test config pattern established in
 * buildInitialGameState.shape.test.ts.
 */
const standardInput: ReplayInput = {
  seed: 'test-seed-001',
  setupConfig: {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  },
  playerOrder: ['0', '1'],
  moves: [],
};

describe('replayGame', () => {
  it('with valid input produces a ReplayResult', () => {
    const result = replayGame(standardInput, mockRegistry);

    assert.ok(result.finalState, 'ReplayResult must have a finalState');
    assert.equal(typeof result.stateHash, 'string', 'stateHash must be a string');
    assert.ok(result.stateHash.length > 0, 'stateHash must not be empty');
    assert.equal(result.moveCount, 0, 'moveCount must match input moves length');
  });

  it('with same input twice produces identical stateHash', () => {
    const result1 = replayGame(standardInput, mockRegistry);
    const result2 = replayGame(standardInput, mockRegistry);

    assert.equal(
      result1.stateHash,
      result2.stateHash,
      'Identical ReplayInput must produce identical stateHash on repeated runs',
    );
  });

  it('with different player count produces different stateHash', () => {
    // why: makeMockCtx uses a deterministic reverse-shuffle (not seed-based),
    // so different seed values alone do not change the shuffle output.
    // Different player counts produce genuinely different initial states
    // (different number of player zones, different deck compositions),
    // which is a stronger proof that different inputs produce different hashes.
    const threePlayerInput: ReplayInput = {
      ...standardInput,
      seed: 'test-seed-002',
      playerOrder: ['0', '1', '2'],
    };

    const result1 = replayGame(standardInput, mockRegistry);
    const result2 = replayGame(threePlayerInput, mockRegistry);

    assert.notEqual(
      result1.stateHash,
      result2.stateHash,
      'Different inputs (different player count) must produce different stateHash',
    );
  });
});

describe('verifyDeterminism', () => {
  it('returns identical: true for deterministic input', () => {
    const result = verifyDeterminism(standardInput, mockRegistry);

    assert.equal(result.identical, true, 'Deterministic engine must produce identical: true');
    assert.equal(
      result.hash1,
      result.hash2,
      'Both replay runs must produce the same hash',
    );
  });
});

describe('computeStateHash', () => {
  it('is deterministic — same G produces same hash', () => {
    const replayResult = replayGame(standardInput, mockRegistry);
    const hash1 = computeStateHash(replayResult.finalState);
    const hash2 = computeStateHash(replayResult.finalState);

    assert.equal(
      hash1,
      hash2,
      'computeStateHash must produce the same hash for the same state',
    );
  });

  it('differs for different G states', () => {
    // why: use different player counts to guarantee genuinely different
    // game states (different number of player zones, deck sizes).
    const threePlayerInput: ReplayInput = {
      ...standardInput,
      playerOrder: ['0', '1', '2'],
    };

    const result1 = replayGame(standardInput, mockRegistry);
    const result2 = replayGame(threePlayerInput, mockRegistry);

    const hash1 = computeStateHash(result1.finalState);
    const hash2 = computeStateHash(result2.finalState);

    assert.notEqual(
      hash1,
      hash2,
      'Different game states must produce different hashes',
    );
  });
});

describe('ReplayInput serialization', () => {
  it('is JSON-serializable (roundtrip test)', () => {
    const serialized = JSON.stringify(standardInput);
    assert.ok(serialized, 'JSON.stringify must not return undefined');

    const deserialized = JSON.parse(serialized) as ReplayInput;
    assert.deepEqual(
      deserialized,
      standardInput,
      'JSON roundtrip must produce equivalent ReplayInput',
    );
  });

  it('JSON.stringify succeeds for replayResult.finalState', () => {
    const result = replayGame(standardInput, mockRegistry);

    const serialized = JSON.stringify(result.finalState);
    assert.ok(
      serialized,
      'JSON.stringify must succeed for finalState (serialization proof)',
    );
    assert.ok(
      serialized.length > 0,
      'Serialized finalState must not be empty',
    );
  });
});
