/**
 * Unit tests for the extra-turn primitive (WP-696 / D-24513).
 *
 * Covers `consumeExtraTurn` (the shared counter-drain used by every production
 * turn-rotation site) and `advanceTurnStage`'s turn-end branch that honors it:
 *   - grant: a queued extra turn ends the turn via events.endTurn({ next }) for
 *     the SAME seat, and the counter decrements to deletion (no leftover key);
 *   - normal rotation: with no counter, the bare events.endTurn() is used;
 *   - stacking: two queued extra turns drain one per turn-end;
 *   - byte-identity hygiene: a fully-spent counter leaves G exactly as an
 *     untriggered game (the lazy-omit hash pattern).
 *
 * No boardgame.io imports — advanceTurnStage takes the narrow TurnLoopContext.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { advanceTurnStage, consumeExtraTurn } from './turnLoop.js';
import type { TurnLoopState, TurnLoopContext } from './turnLoop.js';
import { TURN_STAGES } from './turnPhases.types.js';

/**
 * Creates a minimal TurnLoopContext with a spy on events.endTurn.
 *
 * @param currentPlayer - The acting seat id (default '0').
 * @returns The context plus the endTurn spy for call/argument assertions.
 */
function makeContext(currentPlayer = '0'): { context: TurnLoopContext; endTurnSpy: ReturnType<typeof mock.fn> } {
  const endTurnSpy = mock.fn();
  const context: TurnLoopContext = {
    currentPlayer,
    events: { endTurn: endTurnSpy },
  };
  return { context, endTurnSpy };
}

describe('consumeExtraTurn', () => {
  it('returns false and mutates nothing when no counter is set', () => {
    const state: { extraTurns?: Record<string, number> } = {};
    const consumed = consumeExtraTurn(state, '0');
    assert.equal(consumed, false);
    assert.equal(state.extraTurns, undefined);
  });

  it('returns false when the player has no queued extra turn', () => {
    const state: { extraTurns?: Record<string, number> } = { extraTurns: { '1': 2 } };
    const consumed = consumeExtraTurn(state, '0');
    assert.equal(consumed, false);
    // why: other players' counters are untouched by a non-matching consume.
    assert.deepEqual(state.extraTurns, { '1': 2 });
  });

  it('returns true and deletes the key when draining the last queued turn', () => {
    const state: { extraTurns?: Record<string, number> } = { extraTurns: { '0': 1 } };
    const consumed = consumeExtraTurn(state, '0');
    assert.equal(consumed, true);
    // why: decrement-to-delete leaves NO residual key (byte-identity hygiene).
    assert.equal(Object.prototype.hasOwnProperty.call(state.extraTurns, '0'), false);
  });

  it('returns true and decrements (keeping the key) when more than one is queued', () => {
    const state: { extraTurns?: Record<string, number> } = { extraTurns: { '0': 2 } };
    const consumed = consumeExtraTurn(state, '0');
    assert.equal(consumed, true);
    assert.deepEqual(state.extraTurns, { '0': 1 });
  });
});

describe('advanceTurnStage — extra-turn branch', () => {
  it('grants the same seat another turn via endTurn({ next }) when a turn is queued', () => {
    const gameState: TurnLoopState = { currentStage: TURN_STAGES[2], extraTurns: { '0': 1 } };
    const { context, endTurnSpy } = makeContext('0');

    advanceTurnStage(gameState, context);

    assert.equal(endTurnSpy.mock.callCount(), 1);
    // why: the extra turn is the SAME seat's next turn — endTurn is called with
    // { next: currentPlayer }, not the bare form that would rotate away.
    assert.deepEqual(endTurnSpy.mock.calls[0]!.arguments, [{ next: '0' }]);
    // why: the counter drained to deletion — no leftover key.
    assert.equal(gameState.extraTurns?.['0'], undefined);
  });

  it('ends the turn with the bare endTurn() when no extra turn is queued', () => {
    const gameState: TurnLoopState = { currentStage: TURN_STAGES[2] };
    const { context, endTurnSpy } = makeContext('0');

    advanceTurnStage(gameState, context);

    assert.equal(endTurnSpy.mock.callCount(), 1);
    // why: regression-safe — normal turns must call endTurn with no argument so
    // boardgame.io rotates to the next seat.
    assert.deepEqual(endTurnSpy.mock.calls[0]!.arguments, []);
  });

  it('stacks: two queued extra turns drain one per turn-end', () => {
    const gameState: TurnLoopState = { currentStage: TURN_STAGES[2], extraTurns: { '0': 2 } };
    const { context, endTurnSpy } = makeContext('0');

    advanceTurnStage(gameState, context);
    assert.deepEqual(endTurnSpy.mock.calls[0]!.arguments, [{ next: '0' }]);
    assert.equal(gameState.extraTurns?.['0'], 1);

    // why: the second turn-end drains the last queued extra turn.
    gameState.currentStage = TURN_STAGES[2];
    advanceTurnStage(gameState, context);
    assert.deepEqual(endTurnSpy.mock.calls[1]!.arguments, [{ next: '0' }]);
    assert.equal(gameState.extraTurns?.['0'], undefined);

    // why: after the queue drains, the next turn-end rotates normally.
    gameState.currentStage = TURN_STAGES[2];
    advanceTurnStage(gameState, context);
    assert.deepEqual(endTurnSpy.mock.calls[2]!.arguments, []);
  });

  it('does not end the turn (or touch the counter) mid-stage', () => {
    const gameState: TurnLoopState = { currentStage: TURN_STAGES[0], extraTurns: { '0': 1 } };
    const { context, endTurnSpy } = makeContext('0');

    advanceTurnStage(gameState, context);

    assert.equal(endTurnSpy.mock.callCount(), 0);
    assert.equal(gameState.currentStage, TURN_STAGES[1]);
    // why: the counter is only consumed at turn-end, not on a stage advance.
    assert.equal(gameState.extraTurns?.['0'], 1);
  });

  it('only the acting seat is granted an extra turn; other seats are untouched', () => {
    const gameState: TurnLoopState = { currentStage: TURN_STAGES[2], extraTurns: { '1': 1 } };
    const { context, endTurnSpy } = makeContext('0');

    advanceTurnStage(gameState, context);

    // why: player 0 has no queued turn, so a normal bare end-turn fires; player 1's
    // queued extra turn is NOT consumed by player 0's turn-end.
    assert.deepEqual(endTurnSpy.mock.calls[0]!.arguments, []);
    assert.deepEqual(gameState.extraTurns, { '1': 1 });
  });
});
