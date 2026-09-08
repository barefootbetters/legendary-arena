/**
 * Mastermind logic unit tests for WP-019.
 *
 * Tests defeatTopTactic and areAllTacticsDefeated pure helpers.
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defeatTopTactic, areAllTacticsDefeated, transformMastermind } from './mastermind.logic.js';
import type { MastermindState } from './mastermind.types.js';
import { makeMastermindState } from '../test/fixtureBuilders.js';

describe('defeatTopTactic', () => {
  it('removes first card from tacticsDeck and appends to tacticsDefeated', () => {
    const state: MastermindState = { ...makeMastermindState(),
      id: 'mm-a',
      baseCardId: 'mm-a-base',
      tacticsDeck: ['tactic-1', 'tactic-2', 'tactic-3'],
      tacticsDefeated: [],
    };

    const result = defeatTopTactic(state);

    assert.deepStrictEqual(result.tacticsDeck, ['tactic-2', 'tactic-3']);
    assert.deepStrictEqual(result.tacticsDefeated, ['tactic-1']);
  });

  it('on empty tacticsDeck: returns unchanged', () => {
    const state: MastermindState = { ...makeMastermindState(),
      id: 'mm-b',
      baseCardId: 'mm-b-base',
      tacticsDeck: [],
      tacticsDefeated: ['already-defeated'],
    };

    const result = defeatTopTactic(state);

    assert.strictEqual(result, state, 'Must return the same object when deck is empty');
    assert.deepStrictEqual(result.tacticsDeck, []);
    assert.deepStrictEqual(result.tacticsDefeated, ['already-defeated']);
  });

  it('preserves strikePile, attachedBystanders, and gameText through a defeat', () => {
    const state: MastermindState = { ...makeMastermindState(),
      id: 'mm-f',
      baseCardId: 'mm-f-base',
      tacticsDeck: ['tactic-1'],
      tacticsDefeated: [],
      strikePile: ['strike-1'],
      attachedBystanders: ['pile-bystander'],
      gameText: ['Master Strike: each player discards a card.'],
    };

    const result = defeatTopTactic(state);

    assert.deepStrictEqual(
      result.strikePile,
      ['strike-1'],
      'strikePile must survive the rebuild',
    );
    assert.deepStrictEqual(
      result.attachedBystanders,
      ['pile-bystander'],
      'attachedBystanders must survive the rebuild',
    );
    assert.deepStrictEqual(
      result.gameText,
      ['Master Strike: each player discards a card.'],
      'gameText must survive the rebuild',
    );
  });

  it('returns new object (input not mutated)', () => {
    const state: MastermindState = { ...makeMastermindState(),
      id: 'mm-c',
      baseCardId: 'mm-c-base',
      tacticsDeck: ['tactic-x', 'tactic-y'],
      tacticsDefeated: [],
    };

    const result = defeatTopTactic(state);

    assert.notStrictEqual(result, state, 'Must return a new object');
    assert.deepStrictEqual(
      state.tacticsDeck,
      ['tactic-x', 'tactic-y'],
      'Original tacticsDeck must not be mutated',
    );
    assert.deepStrictEqual(
      state.tacticsDefeated,
      [],
      'Original tacticsDefeated must not be mutated',
    );
  });
});

describe('areAllTacticsDefeated', () => {
  it('returns true when deck empty and defeated non-empty', () => {
    const state: MastermindState = { ...makeMastermindState(),
      id: 'mm-d',
      baseCardId: 'mm-d-base',
      tacticsDeck: [],
      tacticsDefeated: ['t1', 't2', 't3'],
    };

    assert.strictEqual(areAllTacticsDefeated(state), true);
  });

  it('returns false when deck has cards', () => {
    const state: MastermindState = { ...makeMastermindState(),
      id: 'mm-e',
      baseCardId: 'mm-e-base',
      tacticsDeck: ['remaining'],
      tacticsDefeated: ['t1'],
    };

    assert.strictEqual(areAllTacticsDefeated(state), false);
  });
});

describe('transformMastermind (WP-669 / D-24483)', () => {
  const generalRoss = 'wwhk-mastermind-general-thunderbolt-ross-general-thunderbolt-ross';
  const redHulk = 'wwhk-mastermind-general-thunderbolt-ross-red-hulk';

  /** A captured transforming mastermind, active on the General Ross face. */
  const rossState = (): MastermindState => ({ ...makeMastermindState(),
    id: 'wwhk/general-thunderbolt-ross',
    baseCardId: generalRoss,
    alternateFaceId: redHulk,
    tacticsDeck: ['t1', 't2'],
    tacticsDefeated: ['t0'],
    strikePile: ['s1'],
    gameText: ['General Ross text'],
    faceGameText: { [generalRoss]: ['General Ross text'], [redHulk]: ['Red Hulk text'] },
  });

  it('swaps baseCardId ↔ alternateFaceId and updates gameText to the new face', () => {
    const flipped = transformMastermind(rossState());
    assert.strictEqual(flipped.baseCardId, redHulk, 'the new active face is Red Hulk');
    assert.strictEqual(flipped.alternateFaceId, generalRoss, 'the now-inactive face is General Ross');
    assert.deepStrictEqual(flipped.gameText, ['Red Hulk text'], 'gameText follows the new active face');
  });

  it('preserves every unrelated field across the flip (copy-then-override)', () => {
    const flipped = transformMastermind(rossState());
    assert.deepStrictEqual(flipped.tacticsDeck, ['t1', 't2'], 'tactics survive the flip');
    assert.deepStrictEqual(flipped.tacticsDefeated, ['t0'], 'defeated tactics survive');
    assert.deepStrictEqual(flipped.strikePile, ['s1'], 'strikePile survives');
    assert.deepStrictEqual(flipped.faceGameText?.[redHulk], ['Red Hulk text'], 'faceGameText survives');
  });

  it('is bidirectional — flipping twice returns to the original face', () => {
    const there = transformMastermind(rossState());
    const back = transformMastermind(there);
    assert.strictEqual(back.baseCardId, generalRoss, 'flipping back restores General Ross');
    assert.strictEqual(back.alternateFaceId, redHulk);
    assert.deepStrictEqual(back.gameText, ['General Ross text']);
  });

  it('is a no-op for a mastermind with no alternateFaceId (non-transform)', () => {
    const plain: MastermindState = { ...makeMastermindState(),
      id: 'core/dr-doom',
      baseCardId: 'core-mastermind-dr-doom-dr-doom',
      gameText: ['Doom text'],
    };
    const result = transformMastermind(plain);
    assert.strictEqual(result, plain, 'no alternateFaceId → returns the input unchanged');
  });
});
