/**
 * Integration tests for the turn loop advancement helper.
 *
 * Verifies that advanceTurnStage correctly advances through all three
 * canonical turn stages and calls ctx.events.endTurn() when the turn
 * should end.
 *
 * No boardgame.io imports. Uses a minimal inline mock context with an
 * endTurn spy — the existing makeMockCtx provides SetupContext (for
 * setup-time operations), not a move context with events.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { advanceTurnStage } from './turnLoop.js';
import type { TurnLoopState, TurnLoopContext } from './turnLoop.js';
import { TURN_STAGES } from './turnPhases.types.js';

/**
 * Creates a minimal TurnLoopContext with a spy on events.endTurn.
 *
 * @returns An object with the context and the endTurn spy for assertions.
 */
function makeTurnLoopMockContext(): { context: TurnLoopContext; endTurnSpy: ReturnType<typeof mock.fn> } {
  const endTurnSpy = mock.fn();
  const context: TurnLoopContext = {
    events: {
      endTurn: endTurnSpy,
    },
  };
  return { context, endTurnSpy };
}

describe('advanceTurnStage', () => {
  it('advances from first stage to second stage', () => {
    const gameState: TurnLoopState = { currentStage: TURN_STAGES[0] };
    const { context, endTurnSpy } = makeTurnLoopMockContext();

    advanceTurnStage(gameState, context);

    assert.equal(gameState.currentStage, TURN_STAGES[1]);
    assert.equal(endTurnSpy.mock.callCount(), 0);
  });

  it('advances from second stage to third stage', () => {
    const gameState: TurnLoopState = { currentStage: TURN_STAGES[1] };
    const { context, endTurnSpy } = makeTurnLoopMockContext();

    advanceTurnStage(gameState, context);

    assert.equal(gameState.currentStage, TURN_STAGES[2]);
    assert.equal(endTurnSpy.mock.callCount(), 0);
  });

  it('calls ctx.events.endTurn when at the last stage', () => {
    const gameState: TurnLoopState = { currentStage: TURN_STAGES[2] };
    const { context, endTurnSpy } = makeTurnLoopMockContext();

    advanceTurnStage(gameState, context);

    assert.equal(endTurnSpy.mock.callCount(), 1);
    // why: currentStage should remain unchanged — the play phase onBegin
    // hook resets it to TURN_STAGES[0] when the next turn begins.
    assert.equal(gameState.currentStage, TURN_STAGES[2]);
  });

  it('G remains JSON-serializable after each transition', () => {
    const gameState: TurnLoopState = { currentStage: TURN_STAGES[0] };
    const { context } = makeTurnLoopMockContext();

    // Advance through all stages and verify serializability at each step
    advanceTurnStage(gameState, context);
    assert.doesNotThrow(() => JSON.stringify(gameState));

    advanceTurnStage(gameState, context);
    assert.doesNotThrow(() => JSON.stringify(gameState));

    advanceTurnStage(gameState, context);
    assert.doesNotThrow(() => JSON.stringify(gameState));
  });
});
