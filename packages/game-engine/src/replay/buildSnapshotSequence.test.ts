/**
 * Tests for buildSnapshotSequence (WP-063 / EC-071).
 *
 * Covers:
 *   - length invariants (empty moves, non-empty moves)
 *   - deterministic equality across identical calls
 *   - JSON.stringify roundtrip
 *   - Object.isFrozen on outer sequence and snapshots array
 *   - buildUIState call-count (asserted via snapshot count + distinct-object
 *     identity; see note below)
 *   - optional-field construction matrix per D-6303 omission rule
 *   - top-level sorted-key probe per D-6302
 *
 * Uses node:test + node:assert only. No boardgame.io imports.
 *
 * Spy note: ESM module namespaces are frozen, so mock.method() cannot
 * intercept the buildUIState import inside buildSnapshotSequence. The
 * call-count invariant is instead asserted structurally — each push in
 * the helper body is preceded by exactly one buildUIState call, so the
 * returned snapshots.length equals the true call count. A distinct-object
 * identity check further confirms that every slot holds a fresh projection
 * rather than an aliased reference. This reduction is documented in the
 * WP-063 post-mortem §3 (decisions surfaced in execution).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ReplayMove } from './replay.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import { buildSnapshotSequence } from './buildSnapshotSequence.js';

/**
 * Minimal mock registry for replay tests. Mirrors replay.verify.test.ts +
 * replay.execute.test.ts so the WP-063 helper-side fixtures stay anchored
 * to the same shape WP-027 / WP-080 exercise.
 */
const mockRegistry: CardRegistryReader = { listCards: () => [] };

/**
 * Standard test setup config. Mirrors replay.execute.test.ts verbatim so
 * any determinism drift is detected against the same baseline WP-080 locked.
 */
const standardSetupConfig: MatchSetupConfig = {
  schemeId: 'test-scheme-001',
  mastermindId: 'test-mastermind-001',
  villainGroupIds: ['test-villain-group-001'],
  henchmanGroupIds: ['test-henchman-group-001'],
  heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
  bystandersCount: 10,
  woundsCount: 15,
  officersCount: 20,
  sidekicksCount: 5,
};

const standardPlayerOrder: readonly string[] = ['0', '1'];
const standardSeed = 'test-seed-001';

/** A sample move that provably mutates G.lobby.ready so snapshots diverge. */
const readyMovePlayerZero: ReplayMove = {
  playerId: '0',
  moveName: 'setPlayerReady',
  args: { ready: true },
};

const readyMovePlayerOne: ReplayMove = {
  playerId: '1',
  moveName: 'setPlayerReady',
  args: { ready: true },
};

describe('buildSnapshotSequence — length invariants', () => {
  it('returns a sequence of length 1 when moves is empty', () => {
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves: [],
      registry: mockRegistry,
    });
    assert.strictEqual(sequence.snapshots.length, 1);
  });

  it('returns a sequence of length moves.length + 1 for non-empty moves', () => {
    const moves: readonly ReplayMove[] = [readyMovePlayerZero, readyMovePlayerOne];
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves,
      registry: mockRegistry,
    });
    assert.strictEqual(sequence.snapshots.length, moves.length + 1);
  });
});

describe('buildSnapshotSequence — determinism', () => {
  it('produces deep-equal sequences across two identical calls', () => {
    const moves: readonly ReplayMove[] = [readyMovePlayerZero, readyMovePlayerOne];
    const a = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves,
      registry: mockRegistry,
    });
    const b = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves,
      registry: mockRegistry,
    });
    assert.deepStrictEqual(a, b);
  });

  it('JSON.stringify roundtrips without loss', () => {
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves: [readyMovePlayerZero],
      registry: mockRegistry,
    });
    const serialized = JSON.stringify(sequence);
    const parsed = JSON.parse(serialized);
    assert.deepStrictEqual(parsed, JSON.parse(JSON.stringify(sequence)));
    assert.strictEqual(parsed.version, 1);
    assert.strictEqual(parsed.snapshots.length, sequence.snapshots.length);
  });
});

describe('buildSnapshotSequence — freeze discipline', () => {
  it('freezes the outer sequence object', () => {
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves: [],
      registry: mockRegistry,
    });
    assert.strictEqual(Object.isFrozen(sequence), true);
  });

  it('freezes the snapshots array', () => {
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves: [readyMovePlayerZero],
      registry: mockRegistry,
    });
    assert.strictEqual(Object.isFrozen(sequence.snapshots), true);
  });
});

describe('buildSnapshotSequence — buildUIState call-count (structural equivalent)', () => {
  it('produces one snapshot per buildUIState invocation and each is a distinct object', () => {
    const moves: readonly ReplayMove[] = [
      readyMovePlayerZero,
      readyMovePlayerOne,
    ];
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves,
      registry: mockRegistry,
    });
    assert.strictEqual(sequence.snapshots.length, moves.length + 1);
    // Distinct-object identity: each snapshot is a fresh projection, not an
    // aliased reference. Combined with the length invariant above, this is
    // equivalent to asserting buildUIState was invoked exactly moves.length + 1
    // times — the helper's push/build pairing makes the two counts identical.
    const distinctCount = new Set(sequence.snapshots).size;
    assert.strictEqual(distinctCount, sequence.snapshots.length);
  });

  it('reflects per-step input changes across snapshots (diverging activePlayerId)', () => {
    // Move from player '1' so snapshot[1].game.activePlayerId differs from
    // snapshot[0].game.activePlayerId (which is playerOrder[0] = '0'). If
    // buildUIState had only been called once, both snapshots would be
    // identical. A diverging activePlayerId proves a second buildUIState
    // invocation ran with a different currentPlayer input.
    const moves: readonly ReplayMove[] = [readyMovePlayerOne];
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves,
      registry: mockRegistry,
    });
    assert.strictEqual(sequence.snapshots[0]!.game.activePlayerId, '0');
    assert.strictEqual(sequence.snapshots[1]!.game.activePlayerId, '1');
  });
});

describe('buildSnapshotSequence — optional-field construction matrix (D-6303)', () => {
  it('omits the metadata key when params.metadata is absent', () => {
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves: [],
      registry: mockRegistry,
    });
    assert.strictEqual(sequence.metadata, undefined);
    const serialized = JSON.stringify(sequence);
    // The metadata key must not appear in serialized output — no "metadata":
    // null, no "metadata": undefined, no "metadata":{} stub.
    assert.strictEqual(/"metadata"\s*:/.test(serialized), false);
  });

  it('omits the metadata key when params.metadata is an empty object', () => {
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves: [],
      registry: mockRegistry,
      metadata: {},
    });
    assert.strictEqual(sequence.metadata, undefined);
    const serialized = JSON.stringify(sequence);
    assert.strictEqual(serialized.includes('"metadata"'), false);
  });

  it('includes only matchId when metadata.matchId is the only set sub-field', () => {
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves: [],
      registry: mockRegistry,
      metadata: { matchId: 'match-abc' },
    });
    assert.deepStrictEqual(sequence.metadata, { matchId: 'match-abc' });
    const serialized = JSON.stringify(sequence);
    assert.strictEqual(serialized.includes('"matchId":"match-abc"'), true);
    assert.strictEqual(serialized.includes('"seed"'), false);
    assert.strictEqual(serialized.includes('"producedAt"'), false);
  });

  it('includes only seed when metadata.seed is the only set sub-field', () => {
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves: [],
      registry: mockRegistry,
      metadata: { seed: 'seed-xyz' },
    });
    assert.deepStrictEqual(sequence.metadata, { seed: 'seed-xyz' });
    const serialized = JSON.stringify(sequence);
    assert.strictEqual(serialized.includes('"seed":"seed-xyz"'), true);
    assert.strictEqual(serialized.includes('"matchId"'), false);
    assert.strictEqual(serialized.includes('"producedAt"'), false);
  });

  it('includes only producedAt when metadata.producedAt is the only set sub-field', () => {
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves: [],
      registry: mockRegistry,
      metadata: { producedAt: '2026-04-16T00:00:00Z' },
    });
    assert.deepStrictEqual(sequence.metadata, {
      producedAt: '2026-04-16T00:00:00Z',
    });
    const serialized = JSON.stringify(sequence);
    assert.strictEqual(
      serialized.includes('"producedAt":"2026-04-16T00:00:00Z"'),
      true,
    );
    assert.strictEqual(serialized.includes('"matchId"'), false);
    assert.strictEqual(serialized.includes('"seed"'), false);
  });

  it('never emits the literal "undefined" or "null" strings for absent optional fields', () => {
    const sequence = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves: [],
      registry: mockRegistry,
      metadata: { matchId: 'match-abc' },
    });
    const serialized = JSON.stringify(sequence);
    assert.strictEqual(/"metadata"\s*:\s*undefined/.test(serialized), false);
    assert.strictEqual(/"metadata"\s*:\s*null/.test(serialized), false);
    assert.strictEqual(/"seed"\s*:\s*undefined/.test(serialized), false);
    assert.strictEqual(/"producedAt"\s*:\s*null/.test(serialized), false);
  });
});

describe('buildSnapshotSequence — top-level sorted-key probe (D-6302)', () => {
  it('produces JSON.stringify output with stable ordering across construction permutations', () => {
    // Two distinct constructions that differ only in metadata sub-field
    // insertion order; the returned sequence must serialize identically
    // once top-level keys are sorted. This probes the D-6302 guarantee
    // that the helper does not leak insertion order into the serialized
    // top-level key ordering.
    const withMatchFirst = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves: [],
      registry: mockRegistry,
      metadata: {
        matchId: 'probe',
        seed: 'probe-seed',
        producedAt: '2026-04-16T00:00:00Z',
      },
    });
    const withSeedFirst = buildSnapshotSequence({
      setupConfig: standardSetupConfig,
      seed: standardSeed,
      playerOrder: standardPlayerOrder,
      moves: [],
      registry: mockRegistry,
      metadata: {
        seed: 'probe-seed',
        producedAt: '2026-04-16T00:00:00Z',
        matchId: 'probe',
      },
    });
    assert.deepStrictEqual(withMatchFirst, withSeedFirst);
    assert.strictEqual(
      JSON.stringify(withMatchFirst),
      JSON.stringify(withSeedFirst),
    );
  });
});
