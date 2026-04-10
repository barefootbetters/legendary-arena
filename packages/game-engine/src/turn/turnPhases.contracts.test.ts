/**
 * Contract tests for turn phase types and transition helpers.
 *
 * Exactly 7 tests — each is its own test() block. No combined or
 * parameterized tests.
 */

import { test } from 'node:test';
import assert from 'node:assert';

import { MATCH_PHASES, TURN_STAGES } from './turnPhases.types.js';
import {
  getNextTurnStage,
  isValidTurnStageTransition,
} from './turnPhases.logic.js';

test('start -> main is a valid transition', () => {
  assert.strictEqual(isValidTurnStageTransition('start', 'main'), true);
});

test('main -> cleanup is a valid transition', () => {
  assert.strictEqual(isValidTurnStageTransition('main', 'cleanup'), true);
});

test('getNextTurnStage("cleanup") returns null', () => {
  assert.strictEqual(getNextTurnStage('cleanup'), null);
});

test('main -> start is NOT a valid transition', () => {
  assert.strictEqual(isValidTurnStageTransition('main', 'start'), false);
});

test('cleanup -> main is NOT a valid transition', () => {
  assert.strictEqual(isValidTurnStageTransition('cleanup', 'main'), false);
});

// why: If this test fails, it means a value was added to or removed from
// the TurnStage union type without updating the TURN_STAGES canonical array
// (or vice versa). Both must stay in sync — the array is the single source
// of truth for all stage-related logic.
test('drift: TURN_STAGES is exactly ["start", "main", "cleanup"]', () => {
  assert.deepStrictEqual(
    [...TURN_STAGES],
    ['start', 'main', 'cleanup'],
  );
});

// why: If this test fails, it means a value was added to or removed from
// the MatchPhase union type without updating the MATCH_PHASES canonical array
// (or vice versa). Both must stay in sync — the array is the single source
// of truth for all phase-related logic.
test('drift: MATCH_PHASES is exactly ["lobby", "setup", "play", "end"]', () => {
  assert.deepStrictEqual(
    [...MATCH_PHASES],
    ['lobby', 'setup', 'play', 'end'],
  );
});
