import { describe, it } from 'node:test';
import assert from 'node:assert';

import type { LegendaryGameState } from '../types.js';
import { evaluateEndgame } from './endgame.evaluate.js';
import { ENDGAME_CONDITIONS, ESCAPE_LIMIT } from './endgame.types.js';

/**
 * Builds a minimal LegendaryGameState with only the counters field populated.
 *
 * evaluateEndgame is a pure function that reads only G.counters, so tests
 * cast a minimal object rather than building full state via
 * buildInitialGameState to avoid unnecessary coupling.
 */
function makeMinimalState(counters: Record<string, number>): LegendaryGameState {
  return { counters } as LegendaryGameState;
}

describe('evaluateEndgame', () => {
  it('returns null when all endgame counters are absent or 0', () => {
    const result = evaluateEndgame(makeMinimalState({}));
    assert.strictEqual(result, null);

    const resultWithZeros = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.ESCAPED_VILLAINS]: 0,
      [ENDGAME_CONDITIONS.SCHEME_LOSS]: 0,
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 0,
    }));
    assert.strictEqual(resultWithZeros, null);
  });

  it('returns scheme-wins when escapedVillains >= ESCAPE_LIMIT', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.ESCAPED_VILLAINS]: ESCAPE_LIMIT,
    }));
    assert.deepStrictEqual(result, {
      outcome: 'scheme-wins',
      reason: 'Too many villains escaped.',
    });
  });

  it('returns scheme-wins when schemeLoss >= 1', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1,
    }));
    assert.deepStrictEqual(result, {
      outcome: 'scheme-wins',
      reason: 'The scheme has been completed.',
    });
  });

  it('returns heroes-win when mastermindDefeated >= 1', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 1,
    }));
    assert.deepStrictEqual(result, {
      outcome: 'heroes-win',
      reason: 'The mastermind has been defeated.',
    });
  });

  // why: Prevents regression on the loss-before-victory evaluation order
  // decision. If both a loss condition and a victory condition are met
  // simultaneously, the loss must take priority.
  it('loss takes priority when both schemeLoss and mastermindDefeated are set', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1,
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 1,
    }));
    assert.deepStrictEqual(result, {
      outcome: 'scheme-wins',
      reason: 'The scheme has been completed.',
    });
  });

  it('JSON.stringify succeeds for all return values', () => {
    const nullResult = evaluateEndgame(makeMinimalState({}));
    assert.strictEqual(JSON.stringify(nullResult), 'null');

    const schemeLossResult = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1,
    }));
    assert.doesNotThrow(() => JSON.stringify(schemeLossResult));

    const heroesWinResult = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 1,
    }));
    assert.doesNotThrow(() => JSON.stringify(heroesWinResult));

    const escapeResult = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.ESCAPED_VILLAINS]: ESCAPE_LIMIT,
    }));
    assert.doesNotThrow(() => JSON.stringify(escapeResult));
  });
});
