/**
 * Tests for the player-initiated "End Game" move (WP-502 / D-24306).
 *
 * Verifies endMatchEarly latches the MATCH_ENDED_EARLY endgame counter so
 * evaluateEndgame resolves the match as an endedEarly tie; that it is a no-op
 * once the match has already ended (idempotent, never relabels a natural
 * finish); and that it never throws — even on a narrow G missing the messages
 * array.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { endMatchEarly } from './endMatchEarly.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import type { LegendaryGameState } from '../types.js';

/**
 * Builds a LegendaryGameState complete enough for endMatchEarly: it reads only
 * G.counters (via evaluateEndgame) and appends to G.messages (via pushLog).
 */
function createState(counters: Record<string, number> = {}): LegendaryGameState {
  return {
    counters,
    messages: [],
  } as unknown as LegendaryGameState;
}

/** Builds a move context bound to the given G for player 0's turn. */
function createMoveContext(gameState: LegendaryGameState) {
  return {
    G: gameState,
    ctx: {
      currentPlayer: '0',
      numPlayers: 2,
      phase: 'play',
      turn: 3,
      playOrder: ['0', '1'],
      playOrderPos: 0,
    },
  } as unknown as Parameters<typeof endMatchEarly>[0];
}

describe('endMatchEarly', () => {
  it('latches MATCH_ENDED_EARLY so evaluateEndgame resolves an endedEarly tie', () => {
    const state = createState();
    endMatchEarly(createMoveContext(state));

    assert.equal(state.counters[ENDGAME_CONDITIONS.MATCH_ENDED_EARLY], 1);
    assert.deepEqual(evaluateEndgame(state), {
      outcome: 'tie',
      reason: 'The players ended the match early.',
      endedEarly: true,
    });
  });

  it('appends a game-log line naming the player who ended the match', () => {
    const state = createState();
    endMatchEarly(createMoveContext(state));

    assert.equal(state.messages.length, 1);
    assert.match(state.messages[0]?.text ?? '', /Player 0 ended the match early\./);
  });

  // why: End Game must never overwrite or relabel a match that already reached a
  // natural win / loss / tie — the idempotent guard returns before mutating.
  it('is a no-op when the match has already ended naturally', () => {
    const state = createState({ [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 1 });
    endMatchEarly(createMoveContext(state));

    assert.equal(state.counters[ENDGAME_CONDITIONS.MATCH_ENDED_EARLY], undefined);
    assert.equal(state.messages.length, 0);
    // the natural heroes-win result is preserved, unflagged.
    assert.deepEqual(evaluateEndgame(state), {
      outcome: 'heroes-win',
      reason: 'The mastermind has been defeated.',
    });
  });

  // why: a second End Game after the first must no-op (the match is already an
  // endedEarly tie) — the counter stays 1, no duplicate log line.
  it('is idempotent across repeated calls', () => {
    const state = createState();
    endMatchEarly(createMoveContext(state));
    endMatchEarly(createMoveContext(state));

    assert.equal(state.counters[ENDGAME_CONDITIONS.MATCH_ENDED_EARLY], 1);
    assert.equal(state.messages.length, 1);
  });

  // why: moves never throw — a narrow G without a messages array must be tolerated
  // (pushLog guards it), matching the engine-wide no-throw contract.
  it('never throws on a narrow G missing the messages array', () => {
    const narrow = { counters: {} } as unknown as LegendaryGameState;
    assert.doesNotThrow(() => endMatchEarly(createMoveContext(narrow)));
    assert.equal(narrow.counters[ENDGAME_CONDITIONS.MATCH_ENDED_EARLY], 1);
  });
});
