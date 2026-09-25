/**
 * Regression: the bot-ally driver answers a seat choice addressed to a bot seat
 * even when that bot is NOT the active player (D-24593).
 *
 * Loki's Vanishing Illusions ("each other player must KO a Villain from their
 * Victory Pile") and Dr. Doom's Monarch's Decree discard (D-24511) park a
 * `G.pendingSeatChoice` (WP-684 / D-24501) addressed to seats OTHER than the
 * active player. The driver acted only when a bot seat was `ctx.currentPlayer`,
 * so:
 *   1. a human defeating the tactic left the bot's submission outstanding, and
 *      the block-all guard froze the human's turn forever;
 *   2. a bot defeating the tactic had no legal move of its own while the other
 *      seats owed their submissions, so its turn wedged into the fault path.
 *
 * Like seatChoiceDrain.test.ts, this suite builds a REAL engine state and runs
 * the REAL resolveSeatChoice move when the driver submits it, so the decision is
 * checked against the engine's own getLegalMoves answer.
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialGameState, LegendaryGame } from '@legendary-arena/game-engine';

import {
  botAllyDrivers,
  createBotAllyDriver,
  findBotOwedSeatChoiceSeat,
  hasOutstandingSeatChoice,
  BOT_ALLY_STATUS,
} from './botAllyDriver.mjs';

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

interface MatchState {
  G: SeatChoiceGameState;
  ctx: { phase: string; turn: number; currentPlayer: string; numPlayers: number; gameover?: unknown };
  _stateID: number;
}

interface SubmittedMove {
  seat: string;
  moveName: string;
  moveArgs: unknown;
}

// why: every driver registers in the shared module-scope map; clear it after
// each test so one test's driver can never leak into another.
afterEach(() => {
  for (const driver of botAllyDrivers.values()) {
    driver.stop();
  }
  botAllyDrivers.clear();
});

/**
 * Builds a real match state via the engine setup path (empty registry, as in
 * seatChoiceDrain.test.ts) with `activeSeat` to move, then parks a Vanishing
 * Illusions KO choice addressed to `addressedSeats`, each holding one Villain in
 * its Victory Pile.
 *
 * @param numPlayers - Player count.
 * @param activeSeat - ctx.currentPlayer.
 * @param addressedSeats - The seats that owe a submission.
 * @returns The fetched-state shape ({ G, ctx, _stateID }) the driver consumes.
 */
function parkedVanishingIllusionsState(numPlayers: number, activeSeat: string, addressedSeats: string[]): MatchState {
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
  const prompts: Record<string, { options: Array<{ label: string; cardId: string }> }> = {};
  for (const seat of addressedSeats) {
    const villainId = `test-villain-group-001/villain-${seat}#0`;
    gameState.playerZones[seat]!.victory = [villainId];
    prompts[seat] = { options: [{ label: `Villain ${seat}`, cardId: villainId }] };
  }
  gameState.pendingSeatChoice = {
    kind: 'vanishing-illusions-ko',
    addressedSeats,
    seatPrompts: prompts,
    submissions: {},
    defaultOptionIndex: 0,
  };
  return {
    G: gameState,
    ctx: { phase: 'play', turn: 1, currentPlayer: activeSeat, numPlayers },
    _stateID: 1,
  };
}

/**
 * Runs the real engine resolveSeatChoice move as `playerID`, mutating state.G in
 * place (no framework — parkSeatChoice's stage ride is a guarded no-op here).
 */
function applyResolveSeatChoice(state: MatchState, playerID: string, args: unknown) {
  const moves = LegendaryGame.moves as Record<string, { move: (context: unknown, moveArgs: unknown) => void }>;
  moves.resolveSeatChoice!.move(
    { G: state.G, ctx: state.ctx, events: {}, playerID, random: { Shuffle: <T>(deck: T[]): T[] => deck } },
    args,
  );
}

/**
 * Builds driver deps over a mutable real match. `submitMove` behaves like the
 * live Master: resolveSeatChoice runs the real move; any other move while a seat
 * choice is open is a block-all-guard no-op that still bumps `_stateID`;
 * `endTurn` otherwise passes the turn to `nextSeatAfterEndTurn`.
 */
function makeRealDeps(initial: MatchState, nextSeatAfterEndTurn: string, decide?: (state: unknown, seat: string) => { name: string; args: unknown }) {
  const match = { value: initial };
  const submitCalls: SubmittedMove[] = [];
  const persistCalls: Array<{ status: string; faultMessage: string | undefined }> = [];
  const decideCalls: string[] = [];
  const deps = {
    autoStart: false,
    maxIdlePolls: 1000,
    fetchState: async () => match.value,
    submitMove: async (move: SubmittedMove) => {
      submitCalls.push(move);
      const state = match.value;
      if (move.moveName === 'resolveSeatChoice') {
        applyResolveSeatChoice(state, move.seat, move.moveArgs);
      } else if (state.G.pendingSeatChoice === undefined && move.moveName === 'endTurn') {
        state.ctx = { ...state.ctx, currentPlayer: nextSeatAfterEndTurn, turn: state.ctx.turn + 1 };
      }
      state._stateID += 1;
    },
    persistStatus: async (_id: string, status: string, faultMessage: string | undefined) => {
      persistCalls.push({ status, faultMessage });
    },
    decide: (state: unknown, seat: string) => {
      decideCalls.push(seat);
      return decide ? decide(state, seat) : { name: 'endTurn', args: {} };
    },
  };
  return { deps, match, submitCalls, persistCalls, decideCalls };
}

test('human active, seat choice addressed to the bot: the bot submits its default resolveSeatChoice as its own seat (regression)', async () => {
  const { deps, match, submitCalls, persistCalls } = makeRealDeps(parkedVanishingIllusionsState(2, '0', ['1']), '1');
  const driver = createBotAllyDriver({ matchId: 'm-human-loki', botSeats: ['1'], deps });

  await driver.tick();

  assert.equal(submitCalls.length, 1, 'before the fix the driver waited on the human turn and submitted nothing');
  assert.deepEqual(submitCalls[0], { seat: '1', moveName: 'resolveSeatChoice', moveArgs: { optionIndex: 0 } });
  assert.equal(match.value.G.pendingSeatChoice, undefined, 'the choice applied and cleared, releasing the human turn');
  assert.deepEqual(match.value.G.playerZones['1']!.victory, [], 'the bot KO’d its Villain');
  assert.ok(match.value.G.ko.includes('test-villain-group-001/villain-1#0'));
  assert.equal(driver.getTurnCount(), 0, 'answering a seat choice is not a bot turn');
  assert.equal(persistCalls.length, 0, 'no teardown');

  await driver.tick();
  assert.equal(submitCalls.length, 1, 'with the choice cleared the human turn is left alone');
});

test('human active, choice addressed to the human and a bot: only the bot seat is answered, the human seat never', async () => {
  const { deps, match, submitCalls } = makeRealDeps(parkedVanishingIllusionsState(3, '0', ['0', '2']), '1');
  const driver = createBotAllyDriver({ matchId: 'm-human-both', botSeats: ['1', '2'], deps });

  await driver.tick();
  await driver.tick();

  assert.deepEqual(submitCalls.map((call) => call.seat), ['2'], 'the bot answers once and never for the human seat');
  assert.deepEqual(Object.keys(match.value.G.pendingSeatChoice!.submissions), ['2']);
});

test('bot active defeats the tactic: the other bot answers, the active bot waits for the human without faulting, then finishes its turn', async () => {
  const { deps, match, submitCalls, persistCalls, decideCalls } = makeRealDeps(
    parkedVanishingIllusionsState(3, '1', ['0', '2']),
    '2',
  );
  const driver = createBotAllyDriver({ matchId: 'm-bot-loki', botSeats: ['1', '2'], deps });

  await driver.tick();
  assert.deepEqual(submitCalls, [{ seat: '2', moveName: 'resolveSeatChoice', moveArgs: { optionIndex: 0 } }]);

  for (let poll = 0; poll < 3; poll++) {
    await driver.tick();
  }
  assert.equal(submitCalls.length, 1, 'while the human owes its submission the active bot submits nothing');
  assert.deepEqual(decideCalls, [], 'the active bot’s policy is never consulted over a blocked state');
  assert.equal(persistCalls.length, 0, 'before the fix the blocked bot turn fell through to the fault path');
  assert.equal(driver.getTurnCount(), 0);
  assert.equal(botAllyDrivers.has('m-bot-loki'), true);

  // The human answers over Socket.IO.
  applyResolveSeatChoice(match.value, '0', { optionIndex: 0 });
  match.value._stateID += 1;
  assert.equal(match.value.G.pendingSeatChoice, undefined);

  await driver.tick();
  assert.deepEqual(decideCalls, ['1'], 'the active bot resumes its own turn');
  assert.deepEqual(submitCalls.at(-1), { seat: '1', moveName: 'endTurn', moveArgs: {} });
  assert.equal(driver.getTurnCount(), 1);
  assert.equal(persistCalls.length, 0);
});

test('bot active and itself addressed: it answers its own seat choice', async () => {
  const { deps, match, submitCalls } = makeRealDeps(parkedVanishingIllusionsState(2, '1', ['1']), '0');
  const driver = createBotAllyDriver({ matchId: 'm-bot-self', botSeats: ['1'], deps });

  await driver.tick();

  assert.deepEqual(submitCalls[0], { seat: '1', moveName: 'resolveSeatChoice', moveArgs: { optionIndex: 0 } });
  assert.equal(match.value.G.pendingSeatChoice, undefined);
});

test('a bot seat the engine offers no resolve move faults loudly instead of spinning', async () => {
  const state = parkedVanishingIllusionsState(2, '0', ['1']);
  // why: address the choice to a bot seat with no zones — getLegalMoves fails
  // closed (empty list) for it, the shape of any seat the engine cannot offer a
  // resolve move to.
  state.G.pendingSeatChoice!.addressedSeats = ['7'];
  const { deps, submitCalls, persistCalls } = makeRealDeps(state, '1');
  const driver = createBotAllyDriver({ matchId: 'm-stuck', botSeats: ['1', '7'], deps });

  await driver.tick();

  assert.equal(submitCalls.length, 0);
  assert.equal(driver.getStatus(), BOT_ALLY_STATUS.faulted);
  assert.equal(persistCalls[0]!.status, BOT_ALLY_STATUS.faulted);
  assert.equal(botAllyDrivers.has('m-stuck'), false, 'the faulted driver de-registered');
});

test('findBotOwedSeatChoiceSeat / hasOutstandingSeatChoice read only outstanding addressed seats', () => {
  const choice = { addressedSeats: ['0', '1', '2'], submissions: { 1: { optionIndex: 0 } } };
  assert.equal(findBotOwedSeatChoiceSeat({ G: { pendingSeatChoice: choice } }, ['1', '2']), '2', 'seat 1 already submitted');
  assert.equal(findBotOwedSeatChoiceSeat({ G: { pendingSeatChoice: choice } }, ['1']), null, 'only the human owes');
  assert.equal(hasOutstandingSeatChoice({ G: { pendingSeatChoice: choice } }), true);
  const answered = { addressedSeats: ['0'], submissions: { 0: { optionIndex: 0 } } };
  assert.equal(hasOutstandingSeatChoice({ G: { pendingSeatChoice: answered } }), false);
  assert.equal(hasOutstandingSeatChoice({ G: {} }), false);
  assert.equal(hasOutstandingSeatChoice({ ctx: {} }), false, 'a G-less state never throws');
});
