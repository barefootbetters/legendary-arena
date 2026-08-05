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

  it('returns tie when finalTurnTie >= 1 and no win/loss is set', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.FINAL_TURN_TIE]: 1,
    }));
    assert.deepStrictEqual(result, {
      outcome: 'tie',
      reason:
        'A deck ran out and the final turn ended with no winner — the game is a tie between good and evil.',
    });
  });

  // why: the tie is only ever resolved when nothing else fired, but the
  // evaluator must still rank it LAST defensively — a win/loss present alongside
  // the tie counter must win/lose, never tie.
  it('a win/loss takes priority over the tie counter', () => {
    const heroesWin = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.FINAL_TURN_TIE]: 1,
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 1,
    }));
    assert.deepStrictEqual(heroesWin, {
      outcome: 'heroes-win',
      reason: 'The mastermind has been defeated.',
    });

    const schemeWins = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.FINAL_TURN_TIE]: 1,
      [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1,
    }));
    assert.deepStrictEqual(schemeWins, {
      outcome: 'scheme-wins',
      reason: 'The scheme has been completed.',
    });
  });

  // why: the FINAL_TURN_TRIGGERED latch alone must NEVER end the game — it only
  // marks that the current turn is the final one. Only the resolved
  // FINAL_TURN_TIE counter (set by turn.onEnd) ends the game in a tie.
  it('returns null when only the final-turn latch is set (latch never ends the game)', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED]: 1,
    }));
    assert.strictEqual(result, null);
  });

  // why: WP-502 / D-24306 — the player-initiated End Game latch resolves to a tie
  // flagged endedEarly so the competitive path can refuse to score it.
  it('returns an endedEarly tie when MATCH_ENDED_EARLY is set', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.MATCH_ENDED_EARLY]: 1,
    }));
    assert.deepStrictEqual(result, {
      outcome: 'tie',
      reason: 'The players ended the match early.',
      endedEarly: true,
    });
  });

  // why: WP-502 — End Game is highest priority: closing out an in-progress match
  // supersedes every natural win / loss / tie that might also be latched.
  it('MATCH_ENDED_EARLY takes priority over every natural win/loss/tie condition', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.MATCH_ENDED_EARLY]: 1,
      [ENDGAME_CONDITIONS.ESCAPED_VILLAINS]: ESCAPE_LIMIT,
      [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1,
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 1,
      [ENDGAME_CONDITIONS.FINAL_TURN_TIE]: 1,
    }));
    assert.deepStrictEqual(result, {
      outcome: 'tie',
      reason: 'The players ended the match early.',
      endedEarly: true,
    });
  });

  // why: WP-502 — endedEarly is early-end-only; a genuine tie/win/loss must NEVER
  // carry the marker, or the competitive path would wrongly skip scoring them.
  it('a natural tie / win / loss never carries the endedEarly marker', () => {
    for (const counters of [
      { [ENDGAME_CONDITIONS.FINAL_TURN_TIE]: 1 },
      { [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 1 },
      { [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1 },
      { [ENDGAME_CONDITIONS.ESCAPED_VILLAINS]: ESCAPE_LIMIT },
    ]) {
      const result = evaluateEndgame(makeMinimalState(counters));
      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.endedEarly, undefined);
    }
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
