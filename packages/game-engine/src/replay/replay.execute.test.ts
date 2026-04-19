/**
 * Tests for the replay harness step-level API (WP-080 / EC-072).
 *
 * Covers applyReplayStep's determinism + same-reference contract (Case 1),
 * replayGame's byte-identical hash through the loop-delegation refactor
 * (Case 2 — regression guard via PRE_WP080_HASH), and the unknown-move
 * warning-and-skip path routed through applyReplayStep (Case 3).
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ReplayInput, ReplayMove } from './replay.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import { applyReplayStep, replayGame } from './replay.execute.js';
import { computeStateHash } from './replay.hash.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';

// why: one-shot capture helper. Filled in by running the regression test
// ONCE against pre-refactor replayGame, then replaced with the literal
// hash. Not a permanent pattern — future WPs should not propagate it.
// This constant is WP-080's byte-identity anchor through the loop-delegation
// refactor; updating it casually would silently defeat the regression guard.
const PRE_WP080_HASH = 'a56f949e';

/**
 * Minimal mock registry for replay tests. Mirrors replay.verify.test.ts.
 */
const mockRegistry: CardRegistryReader = { listCards: () => [] };

/**
 * Standard test ReplayInput. Mirrors replay.verify.test.ts verbatim so the
 * Case 2 regression guard is anchored to the same fixture WP-027 exercises.
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

describe('applyReplayStep', () => {
  it('produces identical state for identical inputs and returns the same reference', () => {
    const numPlayers = standardInput.playerOrder.length;
    const setupContext = makeMockCtx({ numPlayers });
    const original = buildInitialGameState(
      standardInput.setupConfig,
      mockRegistry,
      setupContext,
    );
    const clone = structuredClone(original);

    const move: ReplayMove = {
      moveName: 'setPlayerReady',
      playerId: '0',
      args: { ready: true },
    };

    const originalResult = applyReplayStep(original, move, numPlayers);
    const cloneResult = applyReplayStep(clone, move, numPlayers);

    assert.strictEqual(
      computeStateHash(originalResult),
      computeStateHash(cloneResult),
      'applyReplayStep must produce byte-identical state for identical inputs',
    );
    assert.strictEqual(
      originalResult,
      original,
      'applyReplayStep must return the same reference it received (Q2 = A, D-6304)',
    );
  });

  it('preserves replayGame stateHash byte-identically (regression guard via PRE_WP080_HASH)', () => {
    const result = replayGame(standardInput, mockRegistry);

    if (PRE_WP080_HASH === '__CAPTURE_ME__') {
      // why: first-run capture path. Print the hash so it can be pasted into
      // PRE_WP080_HASH, then fail loudly so the refactor cannot proceed until
      // the regression anchor is locked against pre-refactor replayGame.
      console.log('WP-080 CAPTURE:', result.stateHash);
      assert.fail(
        'Paste the printed hash into PRE_WP080_HASH, then re-run this test before refactoring replayGame.',
      );
    }

    assert.strictEqual(
      result.stateHash,
      PRE_WP080_HASH,
      'replayGame stateHash must be byte-identical through the WP-080 loop-delegation refactor',
    );
  });

  it('emits warning-and-skip for unknown move name without throwing', () => {
    const numPlayers = standardInput.playerOrder.length;
    const setupContext = makeMockCtx({ numPlayers });
    const gameState = buildInitialGameState(
      standardInput.setupConfig,
      mockRegistry,
      setupContext,
    );
    const messagesBefore = gameState.messages.length;

    const unknownMove: ReplayMove = {
      moveName: 'nonexistentMove',
      playerId: '0',
      args: undefined,
    };

    const returned = applyReplayStep(gameState, unknownMove, numPlayers);

    assert.strictEqual(
      returned,
      gameState,
      'applyReplayStep must return the same reference even when the move is unknown',
    );
    assert.strictEqual(
      gameState.messages.length,
      messagesBefore + 1,
      'Unknown move must append exactly one message to gameState.messages',
    );
    assert.strictEqual(
      gameState.messages[gameState.messages.length - 1],
      'Replay warning: unknown move name "nonexistentMove" — skipped.',
      'Unknown-move message text must match the canonical warning-and-skip string',
    );
  });
});
