/**
 * Regression: the autoplay drain resolves a seat choice addressed to a
 * NON-active seat instead of stalling (D-24590).
 *
 * Loki's Vanishing Illusions ("each other player must KO a Villain from their
 * Victory Pile") and Dr. Doom's Monarch's Decree discard park a
 * `G.pendingSeatChoice` (WP-684 / D-24501) addressed to seats OTHER than the
 * active player. getLegalMoves answers for the enumerated seat only, and the
 * drain always enumerated `ctx.currentPlayer` — whose legal list is empty while
 * the block-all guard freezes the turn — so the drain no-op'd and an all-bot
 * autoplay match stalled. The fix enumerates each outstanding addressed seat and
 * dispatches its default-option resolveSeatChoice as that seat (the WP-749 sim /
 * PAR policy).
 *
 * Like discardToLimitDrain.test.ts, this suite deliberately imports the engine so
 * it checks the decision against a REAL getLegalMoves and a REAL resolveSeatChoice
 * move, not a hand-mocked legal-move list.
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialGameState, getLegalMoves, LegendaryGame } from '@legendary-arena/game-engine';
import { findSeatChoiceActingSeat } from './botLoopProgress.mjs';
import { decidePendingChoiceDispatch } from './autoplay.mjs';

interface SeatChoiceGameState {
  playerZones: Record<string, { hand: string[]; victory: string[] }>;
  ko: string[];
  pendingSeatChoice?: {
    kind: string;
    addressedSeats: string[];
    seatPrompts: Record<string, { options: Array<{ label: string; cardId?: string }> }>;
    submissions: Record<string, { optionIndex: number }>;
    defaultOptionIndex: number;
  };
}

/**
 * Builds a real match state via the engine setup path (empty registry, as in
 * discardToLimitDrain.test.ts) with seat '0' active, then parks a Vanishing
 * Illusions KO choice addressed to every OTHER seat, each holding one Villain in
 * its Victory Pile — the state Loki's tactic leaves after seat '0' defeats him.
 *
 * @param numPlayers - Player count (2 or 3).
 * @returns The fetched-state shape ({ G, ctx, _stateID }) the loop consumes.
 */
function realParkedVanishingIllusionsState(numPlayers: number) {
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
    ctx: { numPlayers },
    random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
  };
  const gameState = buildInitialGameState(config as never, registry as never, setupContext as never) as unknown as SeatChoiceGameState;
  const otherSeats: string[] = [];
  for (let seatIndex = 1; seatIndex < numPlayers; seatIndex++) {
    otherSeats.push(String(seatIndex));
  }
  const prompts: Record<string, { options: Array<{ label: string; cardId: string }> }> = {};
  for (const seat of otherSeats) {
    const villainId = `test-villain-group-001/villain-${seat}#0`;
    gameState.playerZones[seat]!.victory = [villainId];
    prompts[seat] = { options: [{ label: `Villain ${seat}`, cardId: villainId }] };
  }
  gameState.pendingSeatChoice = {
    kind: 'vanishing-illusions-ko',
    addressedSeats: otherSeats,
    seatPrompts: prompts,
    submissions: {},
    defaultOptionIndex: 0,
  };
  return {
    G: gameState,
    ctx: { phase: 'play', turn: 1, currentPlayer: '0', numPlayers },
    _stateID: 1,
  };
}

/**
 * Runs the real engine resolveSeatChoice move as `playerID`, mutating state.G in
 * place (no framework — parkSeatChoice's stage ride is a guarded no-op here).
 */
function applyResolveSeatChoice(state: { G: unknown; ctx: unknown }, playerID: string, args: unknown) {
  const moves = LegendaryGame.moves as Record<string, { move: (context: unknown, moveArgs: unknown) => void }>;
  moves.resolveSeatChoice!.move(
    { G: state.G, ctx: state.ctx, events: {}, playerID, random: { Shuffle: <T>(deck: T[]): T[] => deck } },
    args,
  );
}

test('the active player has no legal move while a seat choice is addressed to another seat (the stall)', () => {
  const state = realParkedVanishingIllusionsState(2);
  const legalMoves = getLegalMoves(state.G as never, { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 2 });
  assert.deepEqual(legalMoves, [], 'the blocked active seat has nothing to dispatch — enumerating it alone stalls');
});

test('the drain dispatches the non-active seat’s default resolveSeatChoice as that seat (regression)', () => {
  const state = realParkedVanishingIllusionsState(2);
  const decision = decidePendingChoiceDispatch(state);
  assert.equal(decision.kind, 'dispatch', 'before the fix this was "none" and the loop stalled');
  if (decision.kind !== 'dispatch') return;
  assert.equal(decision.playerId, '1', 'the addressed non-active seat acts');
  assert.equal(decision.move.name, 'resolveSeatChoice');
  assert.deepEqual(decision.move.args, { optionIndex: 0 }, 'getLegalMoves’ own default, never synthesized');
});

test('draining a three-player choice resolves every addressed seat in order, then releases the turn', () => {
  const state = realParkedVanishingIllusionsState(3);
  const actingSeats: string[] = [];
  for (let step = 0; step < 5; step++) {
    const decision = decidePendingChoiceDispatch(state);
    if (decision.kind !== 'dispatch') break;
    actingSeats.push(decision.playerId);
    applyResolveSeatChoice(state, decision.playerId, decision.move.args);
  }
  assert.deepEqual(actingSeats, ['1', '2'], 'each outstanding addressed seat acts once, ascending');
  assert.equal(state.G.pendingSeatChoice, undefined, 'the choice applied atomically and cleared');
  assert.deepEqual(state.G.playerZones['1']!.victory, [], 'seat 1 KO’d its Villain');
  assert.deepEqual(state.G.playerZones['2']!.victory, [], 'seat 2 KO’d its Villain');
  assert.ok(state.G.ko.includes('test-villain-group-001/villain-1#0'));
  assert.ok(state.G.ko.includes('test-villain-group-001/villain-2#0'));
  assert.equal(decidePendingChoiceDispatch(state).kind, 'none', 'nothing left to drain');
});

test('an addressed seat with no resolve move is reported stuck, not spun on', () => {
  const state = realParkedVanishingIllusionsState(2);
  // why: address the choice to a seat with no zones — getLegalMoves fails closed
  // (empty list) for it, the shape of any seat the engine cannot offer a resolve
  // move to. The drain must report it rather than loop.
  state.G.pendingSeatChoice!.addressedSeats = ['7'];
  const decision = decidePendingChoiceDispatch(state);
  assert.equal(decision.kind, 'stuck');
  if (decision.kind !== 'stuck') return;
  assert.equal(decision.playerId, '7');
});

test('findSeatChoiceActingSeat defers to the current player when it is itself outstanding', () => {
  const choice = { addressedSeats: ['0', '1'], submissions: {} };
  assert.equal(findSeatChoiceActingSeat({ pendingSeatChoice: choice }, '0'), null, 'the existing path drains the active seat first');
  assert.equal(findSeatChoiceActingSeat({ pendingSeatChoice: { addressedSeats: ['0', '1'], submissions: { 0: { optionIndex: 0 } } } }, '0'), '1');
  assert.equal(findSeatChoiceActingSeat({}, '0'), null, 'no seat choice open');
  assert.equal(
    findSeatChoiceActingSeat({ pendingSeatChoice: { addressedSeats: ['1'], submissions: { 1: { optionIndex: 0 } } } }, '0'),
    null,
    'every addressed seat has submitted',
  );
});
