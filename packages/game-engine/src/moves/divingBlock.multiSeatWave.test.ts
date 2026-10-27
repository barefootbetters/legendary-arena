/**
 * A Diving Block wave that addresses the ACTIVE seat AND a non-active seat must stay
 * submittable by every addressed seat, through boardgame.io's own reducer.
 *
 * Live fault: 4p operator match Y1w7rCsC8Ek (Loki / Super Hero Civil War, 3 bot
 * allies). On bot seat 1's own turn the start-stage reveal was a Loki Master Strike;
 * seats 1 and 3 both held Diving Block and both gained a Wound, so the post-move
 * opener parked one wave addressed to ['1', '3']. The D-24648 active-seat skip
 * stage-rode only seat 3, so boardgame.io's activePlayers became { '3': ... } and
 * seat 1 — the current player — was no longer active. The bot driver answers the
 * first bot-owed seat in addressedSeats order (seat 1); boardgame.io refused it as
 * an inactive-player move, the submission never landed, and the match faulted.
 *
 * These drive a REAL match through InitializeGame + CreateGameReducer (the only
 * vehicle that applies setActivePlayers), and pick each seat's move with the real
 * getLegalMoves, the same call the bot driver makes.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// why: the deep dist entry is the game.test.ts precedent for driving boardgame.io's
// own reducer; it carries no types (cast below).
import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';
import { LegendaryGame } from '../game.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';

/** The slice of a boardgame.io match state these tests read. */
interface WaveTestState {
  G: LegendaryGameState;
  ctx: {
    currentPlayer: string;
    phase: string;
    turn: number;
    numPlayers: number;
    activePlayers: Record<string, string> | null;
  };
}

/** The boardgame.io reducer, typed for these tests. */
type WaveTestReducer = (state: WaveTestState, action: { type: string; payload: unknown }) => WaveTestState;

const { InitializeGame, CreateGameReducer } = boardgameInternal as unknown as {
  InitializeGame(config: { game: unknown; numPlayers: number; setupData: unknown }): WaveTestState;
  CreateGameReducer(config: { game: unknown; isClient: boolean }): WaveTestReducer;
};

const LOKI_STRIKE_CARD_ID = 'test/loki-master-strike';
const DIVING_BLOCK_CARD_PREFIX = 'core/captain-america/diving-block#';

/**
 * A plausible mock MatchConfiguration (the game.test.ts fixture shape).
 *
 * @returns A 9-field configuration over test ids.
 */
function createMockMatchConfiguration(): MatchConfiguration {
  return {
    schemeId: 'test/test-scheme-001',
    mastermindId: 'test/test-mastermind-001',
    villainGroupIds: ['test/test-villain-group-001', 'test/test-villain-group-002'],
    henchmanGroupIds: ['test/test-henchman-group-001'],
    heroDeckIds: ['test/test-hero-deck-001', 'test/test-hero-deck-002', 'test/test-hero-deck-003'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

/**
 * Dispatches one move through the reducer as the given seat.
 *
 * @param reducer - The boardgame.io reducer.
 * @param state - The state to apply the move to.
 * @param moveName - The move name.
 * @param args - The move arguments.
 * @param playerID - The seat submitting the move.
 * @returns The next state (unchanged when boardgame.io refuses the move).
 */
function dispatchMove(
  reducer: WaveTestReducer,
  state: WaveTestState,
  moveName: string,
  args: unknown[],
  playerID: string,
): WaveTestState {
  return reducer(state, { type: 'MAKE_MOVE', payload: { type: moveName, args, playerID } });
}

/**
 * Starts a seeded 4-seat match whose opening seat is `openingSeat`.
 *
 * @param openingSeat - The seat that must take the first turn.
 * @returns The first play state and the reducer that drives it.
 */
function startFourSeatMatchOpenedBy(openingSeat: string): { state: WaveTestState; reducer: WaveTestReducer } {
  for (let seedIndex = 0; seedIndex < 80; seedIndex++) {
    const seededGame = { ...LegendaryGame, seed: `diving-block-wave-${seedIndex}` };
    const reducer = CreateGameReducer({ game: seededGame, isClient: false });
    let state = InitializeGame({ game: seededGame, numPlayers: 4, setupData: createMockMatchConfiguration() });
    for (let seat = 0; seat < 4; seat++) {
      state = dispatchMove(reducer, state, 'setPlayerReady', [{ ready: true }], String(seat));
    }
    state = dispatchMove(reducer, state, 'startMatchIfReady', [], '0');
    assert.equal(state.ctx.phase, 'play', 'a fully readied lobby must start play');
    if (state.ctx.currentPlayer === openingSeat) {
      return { state, reducer };
    }
  }
  throw new Error(`No seed in diving-block-wave-0 … 79 opened seat ${openingSeat}; widen the seed range.`);
}

/**
 * Stages the turn-start Loki Master Strike: core Loki is the Mastermind, the strike is
 * the villain-deck top, and each seat in `divingBlockSeats` holds a Diving Block. No
 * hand holds a Strength Hero, so every seat gains a Wound.
 *
 * @param state - The first play state (start stage, nothing revealed yet).
 * @param divingBlockSeats - The seats that hold a Diving Block in hand.
 * @returns The state with the staged G.
 */
function stageLokiStrikeAgainstDivingBlocks(state: WaveTestState, divingBlockSeats: string[]): WaveTestState {
  const G = structuredClone(state.G);
  (G as { selection: { mastermindId: string } }).selection.mastermindId = 'core/loki';
  // why: one placeholder card in each shared deck keeps the deck-exhaustion final-turn
  // latch (WP-367) from ending the mock match (the game.test.ts precedent).
  G.heroDeck = ['test/placeholder-hero-card'];
  G.villainDeck = { ...G.villainDeck, deck: [LOKI_STRIKE_CARD_ID, 'test/placeholder-villain-card'] };
  G.villainDeckCardTypes = { ...G.villainDeckCardTypes, [LOKI_STRIKE_CARD_ID]: 'mastermind-strike' };
  const divingBlockHooks = [];
  for (const seat of divingBlockSeats) {
    const cardId = `${DIVING_BLOCK_CARD_PREFIX}${seat}`;
    G.playerZones[seat]!.hand.push(cardId);
    divingBlockHooks.push({ cardId, timing: 'onPlay', keywords: ['diving-block'] });
  }
  G.heroAbilityHooks = [...G.heroAbilityHooks, ...divingBlockHooks] as typeof G.heroAbilityHooks;
  return { ...state, G };
}

/**
 * Picks the seat's single seat-choice move with the real getLegalMoves, exactly as the
 * bot driver's decideBotSeatChoiceMove does.
 *
 * @param state - The current match state.
 * @param seat - The seat to enumerate.
 * @returns The move name and its args.
 */
function decideSeatChoiceMove(state: WaveTestState, seat: string): { name: string; args: unknown } {
  const legalMoves = getLegalMoves(state.G, {
    phase: state.ctx.phase,
    turn: state.ctx.turn,
    currentPlayer: seat,
    numPlayers: state.ctx.numPlayers,
  });
  assert.equal(legalMoves.length, 1, `seat ${seat} must be offered exactly one move while it owes the wave`);
  assert.equal(legalMoves[0]!.name, 'resolveSeatChoice');
  return { name: legalMoves[0]!.name, args: legalMoves[0]!.args };
}

/**
 * Submits each seat's default answer in the given order and asserts every one lands.
 *
 * @param reducer - The boardgame.io reducer.
 * @param state - The state with the wave open.
 * @param seatOrder - The order the seats answer in.
 * @returns The state after every seat answered.
 */
function answerWaveInOrder(reducer: WaveTestReducer, state: WaveTestState, seatOrder: string[]): WaveTestState {
  let current = state;
  for (const seat of seatOrder) {
    const move = decideSeatChoiceMove(current, seat);
    const next = dispatchMove(reducer, current, move.name, [move.args], seat);
    const isStillOwed =
      next.G.pendingSeatChoice !== undefined && next.G.pendingSeatChoice.submissions[seat] === undefined;
    assert.equal(
      isStillOwed,
      false,
      `seat ${seat}'s resolveSeatChoice must land (activePlayers was ${JSON.stringify(current.ctx.activePlayers)})`,
    );
    current = next;
  }
  return current;
}

describe('Diving Block wave addressing the active seat and a non-active seat (Y1w7rCsC8Ek)', () => {
  it('the turn-start Loki strike opens one wave addressed to the active seat and the other holder', () => {
    const { state: firstState, reducer } = startFourSeatMatchOpenedBy('1');
    const staged = stageLokiStrikeAgainstDivingBlocks(firstState, ['1', '3']);

    const afterReveal = dispatchMove(reducer, staged, 'revealVillainCard', [], '1');

    assert.equal(afterReveal.G.villainRevealedThisTurn, true);
    assert.equal(afterReveal.G.pendingSeatChoice?.kind, 'diving-block');
    assert.deepEqual(afterReveal.G.pendingSeatChoice?.addressedSeats, ['1', '3']);
    const activePlayers = afterReveal.ctx.activePlayers ?? {};
    assert.ok('1' in activePlayers, `the active seat must stay admitted (activePlayers ${JSON.stringify(activePlayers)})`);
    assert.ok('3' in activePlayers, 'the non-active Diving Block holder must be admitted');
  });

  it('the active seat answers first (the bot driver order), then the other seat; the turn can advance', () => {
    const { state: firstState, reducer } = startFourSeatMatchOpenedBy('1');
    const staged = stageLokiStrikeAgainstDivingBlocks(firstState, ['1', '3']);
    const afterReveal = dispatchMove(reducer, staged, 'revealVillainCard', [], '1');

    const resolved = answerWaveInOrder(reducer, afterReveal, afterReveal.G.pendingSeatChoice!.addressedSeats);

    assert.equal(resolved.G.pendingSeatChoice, undefined, 'the wave applies once both seats answered');
    assert.equal(resolved.G.pendingDivingBlockWounds, undefined, 'both parked Wounds are drained');
    // why: the default is DECLINE (keep the Wound), so each holder keeps its Wound.
    const texts = resolved.G.messages.map((entry) => entry.text);
    assert.ok(texts.some((text) => text.endsWith('Player 1 took the Wound (declined Diving Block).')));
    assert.ok(texts.some((text) => text.endsWith('Player 3 took the Wound (declined Diving Block).')));
    assert.deepEqual(resolved.ctx.activePlayers, { '1': 'playTurn' }, 'the normal turn is restored');

    const afterAdvance = dispatchMove(reducer, resolved, 'advanceStage', [], '1');
    assert.equal(afterAdvance.G.currentStage, 'main', 'the active seat is not frozen in start');
  });

  it('the non-active seat answers first, then the active seat; the turn can advance', () => {
    const { state: firstState, reducer } = startFourSeatMatchOpenedBy('1');
    const staged = stageLokiStrikeAgainstDivingBlocks(firstState, ['1', '3']);
    const afterReveal = dispatchMove(reducer, staged, 'revealVillainCard', [], '1');

    const resolved = answerWaveInOrder(reducer, afterReveal, ['3', '1']);

    assert.equal(resolved.G.pendingSeatChoice, undefined);
    assert.deepEqual(resolved.ctx.activePlayers, { '1': 'playTurn' }, 'the normal turn is restored');
    const afterAdvance = dispatchMove(reducer, resolved, 'advanceStage', [], '1');
    assert.equal(afterAdvance.G.currentStage, 'main');
  });

  it('a wave addressed only to the active seat still opens without any stage ride (D-24648)', () => {
    const { state: firstState, reducer } = startFourSeatMatchOpenedBy('1');
    const staged = stageLokiStrikeAgainstDivingBlocks(firstState, ['1']);

    const afterReveal = dispatchMove(reducer, staged, 'revealVillainCard', [], '1');

    assert.deepEqual(afterReveal.G.pendingSeatChoice?.addressedSeats, ['1']);
    assert.deepEqual(afterReveal.ctx.activePlayers, { '1': 'playTurn' }, 'no stage ride for a one-seat active wave');
    const resolved = answerWaveInOrder(reducer, afterReveal, ['1']);
    assert.equal(resolved.G.pendingSeatChoice, undefined);
    assert.equal(dispatchMove(reducer, resolved, 'advanceStage', [], '1').G.currentStage, 'main');
  });
});
