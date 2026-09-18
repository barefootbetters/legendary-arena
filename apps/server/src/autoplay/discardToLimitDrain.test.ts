/**
 * Regression: the bot loop drives through a Magneto "discard down to four"
 * Master Strike instead of stalling.
 *
 * Observed live 2026-09-17 (Magneto / Midtown Bank Robbery): a solo autoplay bot
 * match halted with "The bot loop stopped: no legal move was available for the
 * current stage" when Magneto's Master Strike parked a discard-to-limit choice on
 * the active player. Root cause: the engine's getLegalMoves DID short-circuit to
 * the single `resolveDiscardChoice` move (with default cheapest-first args), but
 * the server-side parked-choice recognizer (`findPendingChoiceMove`) only knew 10
 * of the engine's ~29 `resolve…` short-circuits — `resolveDiscardChoice` was not
 * among them. The autoplay drain no-op'd, the start-stage handler found no legal
 * lifecycle move, and the loop aborted; the bot-ally driver only limped through by
 * the accident of its single-move policy fallback.
 *
 * This suite exercises the fix against a REAL engine short-circuit (not a
 * hand-mocked legal-move list): it builds a real match state, parks a real Magneto
 * discard-to-limit choice, and asserts (a) getLegalMoves emits the resolve
 * short-circuit, (b) the autoplay drain recognizes it via findPendingChoiceMove
 * (the exact call `drainPendingChoices` makes), and (c) the bot-ally `decideBotMove`
 * returns it. Unlike botLoopProgress.test.ts (which EC-292 keeps game-framework
 * free), this suite deliberately imports the engine so it verifies the recognizer
 * against the engine's actual output.
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialGameState, getLegalMoves } from '@legendary-arena/game-engine';
import { findPendingChoiceMove } from './botLoopProgress.mjs';
import { decideBotMove, buildBotPolicy } from '../bot-ally/botAllyDriver.mjs';

/**
 * Builds a real 2-player match state via the engine setup path (empty registry,
 * mirroring the autoplay rewind / bot-ally determinism tests), then parks a
 * Magneto discard-to-limit choice on `seat` with a hand of five cards (one over
 * the four-card limit) so getLegalMoves short-circuits to resolveDiscardChoice.
 *
 * @param {string} seat - The active seat the choice is parked on.
 * @returns The fetched-state shape ({ G, ctx, _stateID }) the loops consume.
 */
function realParkedDiscardState(seat: string) {
  const config = {
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
  const registry = { listCards: () => [] };
  const setupContext = {
    ctx: { numPlayers: 2 },
    random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
  };
  const gameState = buildInitialGameState(config as never, registry as never, setupContext as never) as {
    playerZones: Record<string, { hand: string[] }>;
    pendingDiscardChoices?: Array<{ choiceType: string; playerID: string; limit: number }>;
  };
  // why: give the active seat a five-card hand (one over the limit) and park the
  // discard-to-limit choice — the exact state Magneto's Master Strike leaves when
  // the player holds no X-Men Hero to reveal.
  gameState.playerZones[seat]!.hand = [
    'test/a#0',
    'test/b#0',
    'test/c#0',
    'test/d#0',
    'test/e#0',
  ];
  gameState.pendingDiscardChoices = [{ choiceType: 'discard-to-limit', playerID: seat, limit: 4 }];
  return {
    G: gameState,
    ctx: { phase: 'play', turn: 1, currentPlayer: seat, numPlayers: 2 },
    _stateID: 1,
  };
}

test('getLegalMoves short-circuits a parked Magneto discard-to-limit to resolveDiscardChoice', () => {
  const state = realParkedDiscardState('1');
  const legalMoves = getLegalMoves(state.G as never, {
    phase: 'play',
    turn: 1,
    currentPlayer: '1',
    numPlayers: 2,
  });
  assert.equal(legalMoves.length, 1, 'a parked block-all choice freezes every other move');
  assert.equal(legalMoves[0]!.name, 'resolveDiscardChoice', 'the sole legal move is the discard resolver');
  const args = legalMoves[0]!.args as { cardIds: string[] };
  assert.equal(args.cardIds.length, 1, 'the default discards exactly down to the four-card limit (5 − 4)');
});

test('the autoplay drain recognizes the real resolveDiscardChoice short-circuit (regression)', () => {
  // why: this is the exact decision `drainPendingChoices` makes — before the fix
  // findPendingChoiceMove returned null here (resolveDiscardChoice was not in the
  // recognized set), the drain no-op'd, and the loop aborted with "no legal move".
  const state = realParkedDiscardState('1');
  const legalMoves = getLegalMoves(state.G as never, {
    phase: 'play',
    turn: 1,
    currentPlayer: '1',
    numPlayers: 2,
  });
  const drained = findPendingChoiceMove(legalMoves);
  assert.notEqual(drained, null, 'the discard-to-limit short-circuit is recognized as a parked choice');
  assert.equal(drained!.name, 'resolveDiscardChoice');
});

test('the bot-ally driver decides resolveDiscardChoice for a parked discard-to-limit', () => {
  const state = realParkedDiscardState('1');
  const move = decideBotMove(state, '1', buildBotPolicy('discard-regression-seed', 'competent'));
  assert.equal(move.name, 'resolveDiscardChoice', 'the bot drains the parked choice rather than faulting');
  const args = move.args as { cardIds: string[] };
  assert.equal(args.cardIds.length, 1, 'it carries the engine-supplied cheapest-first default selection');
});

test('the random bot policy also drives through the discard-to-limit choice', () => {
  // why: the short-circuit is a single legal move, so BOTH policies resolve it —
  // the fix generalizes across policy, not just the competent heuristic.
  const state = realParkedDiscardState('1');
  const move = decideBotMove(state, '1', buildBotPolicy('discard-regression-seed', 'random'));
  assert.equal(move.name, 'resolveDiscardChoice');
});
