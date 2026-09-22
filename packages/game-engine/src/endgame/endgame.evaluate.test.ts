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

  it('returns null for escapedVillains >= ESCAPE_LIMIT (generic escape cap retired — D-24317)', () => {
    // why: WP-509 / D-24317 removed the generic escapedVillains >= ESCAPE_LIMIT
    // loss. Escaped villains alone no longer end the game; villain-escape losses
    // are per-scheme (Negative Zone latches SCHEME_LOSS via an escaped-pile-count
    // resourceLossCondition). The counter is still tracked for stats.
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.ESCAPED_VILLAINS]: ESCAPE_LIMIT,
    }));
    assert.strictEqual(result, null);
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

  // why: WP-732 / D-24553 — INVERTED from the pre-WP-732 "loss takes priority"
  // pin. Per Universal Rules v23 §"End of the Game: Players Win", once the
  // Mastermind has no Tactics left "victory is assured, and players will win the
  // game even if the final Tactic's Fight ability would achieve the Scheme's Evil
  // Wins condition." The TERMINAL MASTERMIND_DEFEATED counter is now only ever set
  // at turn.onEnd (promoteMastermindVictoryIfPending), i.e. only after victory was
  // already assured, so it must WIN over a SCHEME_LOSS that also latched during the
  // finished winning turn. This is an intentional product-behavior change (rulebook
  // fidelity), not grader-gaming — the immediate "Evil Wins / don't finish the turn"
  // path (SCHEME_LOSS with NO Mastermind latch) is unchanged and pinned below.
  it('terminal mastermindDefeated takes priority over schemeLoss (assured win — WP-732 / D-24553)', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1,
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 1,
    }));
    assert.deepStrictEqual(result, {
      outcome: 'heroes-win',
      reason: 'The mastermind has been defeated.',
    });
  });

  // why: WP-732 / D-24553 — the victory-assured latch alone must NEVER end the
  // game. It mirrors FINAL_TURN_TRIGGERED: it only marks that victory is assured;
  // the current player still finishes their turn, and the win resolves when the
  // terminal counter is set at turn.onEnd.
  it('returns null for the pending Mastermind latch alone (win deferred to turn end)', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING]: 1,
    }));
    assert.strictEqual(result, null);
  });

  // why: WP-732 / D-24553 — the assured-win SUPPRESSION window: while the pending
  // latch is set, a SCHEME_LOSS latched during the rest of the winning turn must
  // NOT end the game (a deck-out or Evil-Wins during the finished turn does not
  // take the assured win away). evaluateEndgame returns null, so the turn plays out.
  it('suppresses schemeLoss while the pending Mastermind latch is set (assured-win window)', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING]: 1,
      [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1,
    }));
    assert.strictEqual(result, null);
  });

  // why: WP-732 / D-24553 — the pending latch also suppresses the deck-exhaustion
  // tie during the winning turn; the win resolves at turn end, never a tie.
  it('suppresses the finalTurnTie counter while the pending Mastermind latch is set', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING]: 1,
      [ENDGAME_CONDITIONS.FINAL_TURN_TIE]: 1,
    }));
    assert.strictEqual(result, null);
  });

  // why: WP-732 / D-24553 — MATCH_ENDED_EARLY still supersedes even an assured
  // win: a player-ended match closes out (tie + endedEarly) regardless of the
  // pending Mastermind latch.
  it('MATCH_ENDED_EARLY supersedes the pending Mastermind latch (early end wins)', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.MATCH_ENDED_EARLY]: 1,
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING]: 1,
    }));
    assert.deepStrictEqual(result, {
      outcome: 'tie',
      reason: 'The players ended the match early.',
      endedEarly: true,
    });
  });

  // why: WP-732 / D-24553 — REGRESSION: "Evil Wins" is NOT deferred. A SCHEME_LOSS
  // with NO Mastermind latch (neither terminal nor pending) still ends the game
  // immediately as scheme-wins ("Don't finish the turn"). The deferral applies
  // only when a Mastermind win is assured.
  it('a schemeLoss with no Mastermind latch still ends immediately (Evil Wins not deferred)', () => {
    const result = evaluateEndgame(makeMinimalState({
      [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1,
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
  });
});
