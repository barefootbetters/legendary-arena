/**
 * Tests for the per-match BotAllyDriver (WP-375 / EC-404).
 *
 * Covers the driver's orchestration with injected fakes (no boardgame.io, no
 * DB): it acts ONLY on a bot seat's turn, ignores the human's turns, drains a
 * bot-owned parked choice, tears down (and de-registers) on every exit path
 * (terminal / abandon / maxTurns / fault) — the N=10 leak check — marks the
 * match bot-faulted rather than hanging when the turn wedges, and decides moves
 * deterministically from its seed (decideBotMove over a real engine state).
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitialGameState } from '@legendary-arena/game-engine';

import {
  botAllyDrivers,
  createBotAllyDriver,
  decideBotMove,
  buildBotPolicy,
  isBotSeatTurn,
  BOT_ALLY_STATUS,
  BOT_FAULTED_MESSAGE,
} from './botAllyDriver.mjs';

// why: every test registers drivers in the shared module-scope map; clear it
// after each so a leaked driver in one test can never mask a leak in another
// (the N=10 leak assertion depends on a clean starting map).
afterEach(() => {
  for (const driver of botAllyDrivers.values()) {
    driver.stop();
  }
  botAllyDrivers.clear();
});

/**
 * Builds a fake fetched match state.
 */
function fakeState(currentPlayer: string, stateId: number, extra: Record<string, unknown> = {}) {
  return {
    ctx: { currentPlayer, phase: 'play', turn: 1, numPlayers: 2, ...extra },
    _stateID: stateId,
  };
}

/**
 * Builds injected driver deps backed by a mutable in-memory match. `submitMove`
 * runs an optional reducer to advance the fake match; `decide` and per-call
 * overrides are supplied per test.
 */
function makeDeps(options: {
  initial: unknown;
  decide?: (state: unknown, seat: string) => { name: string; args: unknown } | null;
  onSubmit?: (
    move: { seat: string; moveName: string; moveArgs: unknown },
    current: { value: unknown },
  ) => void;
  overrides?: Record<string, unknown>;
}) {
  const match = { value: options.initial };
  const submitCalls: Array<{ seat: string; moveName: string; moveArgs: unknown }> = [];
  const persistCalls: Array<{ status: string; faultMessage: string | undefined }> = [];

  const deps: Record<string, unknown> = {
    autoStart: false,
    fetchState: async () => match.value,
    submitMove: async (move: { seat: string; moveName: string; moveArgs: unknown }) => {
      submitCalls.push(move);
      if (options.onSubmit) {
        options.onSubmit(move, match);
      }
    },
    persistStatus: async (_id: string, status: string, faultMessage: string | undefined) => {
      persistCalls.push({ status, faultMessage });
    },
    decide: options.decide ?? (() => ({ name: 'advanceStage', args: {} })),
    ...(options.overrides ?? {}),
  };
  return { deps, match, submitCalls, persistCalls };
}

test('isBotSeatTurn is true only on a play-phase bot seat turn', () => {
  const botSeats = ['1'];
  assert.equal(isBotSeatTurn(fakeState('1', 1), botSeats), true);
  assert.equal(isBotSeatTurn(fakeState('0', 1), botSeats), false, 'human seat 0 is never a bot turn');
  assert.equal(isBotSeatTurn(fakeState('1', 1, { phase: 'lobby' }), botSeats), false, 'lobby phase is not a bot turn');
  assert.equal(isBotSeatTurn(fakeState('1', 1, { gameover: { winner: 'x' } }), botSeats), false, 'a finished match is not a bot turn');
});

test('the driver ignores the human turn and never dispatches for seat 0', async () => {
  const { deps, submitCalls } = makeDeps({ initial: fakeState('0', 5) });
  const driver = createBotAllyDriver({ matchId: 'm-human', botSeats: ['1'], deps });

  await driver.tick();

  assert.equal(submitCalls.length, 0, 'no move was dispatched on the human seat 0 turn');
  assert.equal(driver.getTurnCount(), 0);
  assert.equal(botAllyDrivers.has('m-human'), true, 'the driver stays registered, waiting for the bot turn');
});

test('the driver acts on a bot seat turn and dispatches only for the bot seat', async () => {
  // The bot seat "1" plays one move (endTurn) which passes the turn to seat 0.
  const { deps, submitCalls } = makeDeps({
    initial: fakeState('1', 1),
    decide: () => ({ name: 'endTurn', args: {} }),
    onSubmit: (move, match) => {
      // endTurn passes control back to the human seat 0 + advances the state id.
      match.value = fakeState('0', 2);
    },
  });
  const driver = createBotAllyDriver({ matchId: 'm-bot', botSeats: ['1'], deps });

  await driver.tick();

  assert.equal(submitCalls.length, 1, 'exactly one move was dispatched for the bot turn');
  assert.equal(submitCalls[0]!.seat, '1', 'the dispatch was for the bot seat, never seat 0');
  assert.equal(driver.getTurnCount(), 1, 'the completed bot turn incremented the turn count');
});

test('the driver drains a bot-owned parked choice by dispatching the resolve move', async () => {
  // decideBotMove returns a resolve short-circuit move (its default args
  // already filled by getLegalMoves); the driver must dispatch it.
  let submitted = 0;
  const { deps, submitCalls } = makeDeps({
    initial: fakeState('1', 1),
    decide: () => ({ name: 'resolveKoHeroChoice', args: { cardId: 'hero-x', zone: 'discard' } }),
    onSubmit: (_move, match) => {
      submitted += 1;
      // First dispatch resolves the choice and ends the turn (passes to seat 0).
      match.value = submitted >= 1 ? fakeState('0', 2) : fakeState('1', 1);
    },
  });
  const driver = createBotAllyDriver({ matchId: 'm-choice', botSeats: ['1'], deps });

  await driver.tick();

  assert.equal(submitCalls[0]!.moveName, 'resolveKoHeroChoice', 'the parked choice was drained');
  assert.deepEqual(submitCalls[0]!.moveArgs, { cardId: 'hero-x', zone: 'discard' });
});

test('the driver tears down and de-registers on a terminal (game over) state', async () => {
  const { deps, persistCalls } = makeDeps({
    initial: fakeState('1', 1, { gameover: { winner: 'heroes' } }),
  });
  const driver = createBotAllyDriver({ matchId: 'm-over', botSeats: ['1'], deps });

  await driver.tick();

  assert.equal(botAllyDrivers.has('m-over'), false, 'the driver was removed from the registry');
  assert.equal(driver.getStatus(), BOT_ALLY_STATUS.completed);
  assert.deepEqual(persistCalls, [{ status: BOT_ALLY_STATUS.completed, faultMessage: undefined }]);
});

test('N=10 lifecycle: every terminal match tears down with no registry leak', async () => {
  for (let index = 0; index < 10; index++) {
    const { deps } = makeDeps({ initial: fakeState('1', 1, { gameover: { winner: 'heroes' } }) });
    const driver = createBotAllyDriver({ matchId: `leak-${index}`, botSeats: ['1'], deps });
    await driver.tick();
  }
  assert.equal(botAllyDrivers.size, 0, 'no driver leaked across 10 match lifecycles');
});

test('a wedged bot turn marks the match bot-faulted and never hangs', async () => {
  // decide throws; the fault fallback (endTurn → advanceStage) cannot advance
  // the state (submitMove is a no-op here), so the driver marks it faulted.
  const { deps, persistCalls } = makeDeps({
    initial: fakeState('1', 7),
    decide: () => {
      throw new Error('policy blew up (raw detail must never reach the match).');
    },
    onSubmit: () => {
      // no-op: the state id never advances, so the fallback cannot recover.
    },
  });
  const driver = createBotAllyDriver({ matchId: 'm-fault', botSeats: ['1'], deps });

  await driver.tick();

  assert.equal(botAllyDrivers.has('m-fault'), false, 'the faulted driver was de-registered');
  assert.equal(driver.getStatus(), BOT_ALLY_STATUS.faulted);
  assert.equal(persistCalls.length, 1);
  assert.equal(persistCalls[0]!.status, BOT_ALLY_STATUS.faulted);
  assert.equal(
    persistCalls[0]!.faultMessage,
    BOT_FAULTED_MESSAGE,
    'the persisted fault message is the public-safe co-op sentence, never a raw error',
  );
});

test('the fault fallback recovers a stalled turn by advancing the stage', async () => {
  // decide returns a move that does not advance (stall). endTurn is a no-op
  // (not cleanup) but advanceStage progresses, so the fallback recovers and the
  // turn eventually passes — the match is NOT faulted.
  let stateId = 1;
  let hasAdvanced = false;
  const match = { value: fakeState('1', stateId) as unknown };
  const submitCalls: Array<{ seat: string; moveName: string }> = [];
  const persistCalls: Array<{ status: string }> = [];
  const deps = {
    autoStart: false,
    fetchState: async () => match.value,
    submitMove: async (move: { seat: string; moveName: string }) => {
      submitCalls.push(move);
      if (move.moveName === 'advanceStage') {
        // advanceStage progresses the wedged stage (still the bot's turn).
        hasAdvanced = true;
        stateId += 1;
        match.value = fakeState('1', stateId);
      } else if (move.moveName === 'endTurn' && hasAdvanced) {
        // endTurn is a no-op until a stage has advanced (mimics reaching
        // cleanup); once advanced it passes the turn to the human seat 0.
        stateId += 1;
        match.value = fakeState('0', stateId);
      }
      // the primary decide move (recruitHero) and a pre-cleanup endTurn are
      // no-ops (stall), so the fallback must reach advanceStage to recover.
    },
    persistStatus: async (_id: string, status: string) => {
      persistCalls.push({ status });
    },
    decide: () => ({ name: 'recruitHero', args: { hqIndex: 0 } }),
  } as unknown as Record<string, unknown>;
  const driver = createBotAllyDriver({ matchId: 'm-recover', botSeats: ['1'], deps });

  await driver.tick();

  assert.ok(
    submitCalls.some((call) => call.moveName === 'advanceStage'),
    'the fault fallback dispatched advanceStage to progress the wedged turn',
  );
  // why: a recovered turn PASSES to the human — the driver stays active/registered
  // waiting for the next bot turn; it is NOT faulted and NOT torn down.
  assert.notEqual(driver.getStatus(), BOT_ALLY_STATUS.faulted, 'the recovered turn did not fault the match');
  assert.equal(driver.getStatus(), BOT_ALLY_STATUS.active, 'the driver stays active after a recovered, passed turn');
  assert.equal(driver.getTurnCount(), 1, 'the recovered turn counted as one completed bot turn');
  assert.equal(botAllyDrivers.has('m-recover'), true, 'the driver remains registered after a passed turn');
});

test('a wedge recovered by the one fresh-fetch whole-turn retry does not fault the match', async () => {
  // Attempt 1 wedges: the decision throws and the fault fallback (a no-op submit)
  // cannot advance, so the whole turn faults. WP-414's single retry re-attempts
  // the whole turn from fresh state; attempt 2's decision passes the turn, so the
  // match is NOT faulted.
  let decideCalls = 0;
  const { deps, persistCalls } = makeDeps({
    initial: fakeState('1', 1),
    decide: () => {
      decideCalls += 1;
      if (decideCalls === 1) {
        throw new Error('transient legal-move race (raw detail must never reach the match).');
      }
      return { name: 'endTurn', args: {} };
    },
    onSubmit: (move, match) => {
      // why: only the retry's real endTurn (decideCalls >= 2) advances; attempt
      // 1's fault-fallback endTurn/advanceStage (decideCalls === 1) stay no-ops,
      // so attempt 1 genuinely faults before the retry runs.
      if (move.moveName === 'endTurn' && decideCalls >= 2) {
        match.value = fakeState('0', 2);
      }
    },
  });
  const driver = createBotAllyDriver({ matchId: 'm-retry-ok', botSeats: ['1'], deps });

  await driver.tick();

  assert.equal(decideCalls, 2, 'exactly two whole-turn attempts ran — the retry fired exactly once');
  assert.notEqual(driver.getStatus(), BOT_ALLY_STATUS.faulted, 'the retried turn recovered and did not fault');
  assert.equal(driver.getStatus(), BOT_ALLY_STATUS.active, 'the driver stays active after the recovered, passed turn');
  assert.equal(driver.getTurnCount(), 1, 'the recovered turn counted as one completed bot turn');
  assert.equal(persistCalls.length, 0, 'a recovered turn persisted no terminal status');
  assert.equal(botAllyDrivers.has('m-retry-ok'), true, 'the driver remains registered after the recovered turn');
});

test('a second consecutive wedge faults; the whole-turn retry fires at most once', async () => {
  // Every decision throws and no submit advances, so BOTH the original attempt
  // and the single retry wedge — the match faults. decideCalls === 2 proves the
  // retry ran exactly once (not zero, not a loop).
  let decideCalls = 0;
  const { deps, persistCalls } = makeDeps({
    initial: fakeState('1', 7),
    decide: () => {
      decideCalls += 1;
      throw new Error('policy blew up again (raw detail never reaches the match).');
    },
    onSubmit: () => {
      // no-op: neither attempt's fault fallback can advance, so both attempts fault.
    },
  });
  const driver = createBotAllyDriver({ matchId: 'm-double-wedge', botSeats: ['1'], deps });

  await driver.tick();

  assert.equal(decideCalls, 2, 'exactly two whole-turn attempts ran — the retry fired once, never more');
  assert.equal(driver.getStatus(), BOT_ALLY_STATUS.faulted, 'a twice-wedged turn faults the match');
  assert.equal(persistCalls.length, 1, 'the faulted teardown persisted exactly once');
  assert.equal(persistCalls[0]!.status, BOT_ALLY_STATUS.faulted);
  assert.equal(
    persistCalls[0]!.faultMessage,
    BOT_FAULTED_MESSAGE,
    'the persisted fault message is the public-safe co-op sentence, never a raw error',
  );
  assert.equal(botAllyDrivers.has('m-double-wedge'), false, 'the twice-wedged driver was de-registered');
});

test('the driver tears down as abandoned after the idle-poll grace elapses', async () => {
  // The human never moves (seat 0 turn, unchanging state id). After maxIdlePolls
  // no-progress ticks the driver tears down as abandoned.
  const { deps, persistCalls } = makeDeps({
    initial: fakeState('0', 3),
    overrides: { maxIdlePolls: 3 },
  });
  const driver = createBotAllyDriver({ matchId: 'm-idle', botSeats: ['1'], deps });

  await driver.tick(); // idlePolls 0 (first sighting sets lastStateId)
  await driver.tick(); // idlePolls 1
  await driver.tick(); // idlePolls 2
  assert.equal(botAllyDrivers.has('m-idle'), true, 'not yet abandoned before the grace elapses');
  await driver.tick(); // idlePolls 3 → abandoned

  assert.equal(botAllyDrivers.has('m-idle'), false, 'the driver was torn down on abandonment');
  assert.equal(driver.getStatus(), BOT_ALLY_STATUS.abandoned);
  assert.equal(persistCalls[0]!.status, BOT_ALLY_STATUS.abandoned);
});

test('the driver tears down as exhausted at the bot-turn cap', async () => {
  // Each tick completes one bot turn (endTurn → passes → next tick bot again).
  let turn = 0;
  const match = { value: fakeState('1', 1) as unknown };
  const persistCalls: Array<{ status: string }> = [];
  const deps = {
    autoStart: false,
    maxTurns: 2,
    fetchState: async () => match.value,
    submitMove: async () => {
      turn += 1;
      // endTurn passes to seat 0, then the next tick sees a fresh bot turn.
      match.value = fakeState('0', turn + 1);
    },
    persistStatus: async (_id: string, status: string) => {
      persistCalls.push({ status });
    },
    decide: () => ({ name: 'endTurn', args: {} }),
  } as unknown as Record<string, unknown>;
  const driver = createBotAllyDriver({ matchId: 'm-cap', botSeats: ['1'], deps });

  await driver.tick(); // turn 1
  // reset to a bot turn for the second tick
  match.value = fakeState('1', 10);
  await driver.tick(); // turn 2 → hits maxTurns

  assert.equal(driver.getStatus(), BOT_ALLY_STATUS.exhausted);
  assert.equal(botAllyDrivers.has('m-cap'), false, 'the exhausted driver was de-registered');
});

// ---------------------------------------------------------------------------
// Determinism — decideBotMove is seed-bound over a real engine state.
// ---------------------------------------------------------------------------

/**
 * Builds a real 2-player LegendaryGameState via the engine setup path (empty
 * registry, mirroring the autoplay rewind test), wrapped as a fetched state for
 * a bot seat.
 */
function realBotState(botSeat: string) {
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
  const gameState = buildInitialGameState(config as never, registry as never, setupContext as never);
  return {
    G: gameState,
    ctx: { phase: 'play', turn: 1, currentPlayer: botSeat, numPlayers: 2 },
    _stateID: 1,
  };
}

test('decideBotMove is deterministic for the same decision seed and state', () => {
  const state = realBotState('1');
  const moveA = decideBotMove(state, '1', buildBotPolicy('bot-seed-alpha', 'competent'));
  const moveB = decideBotMove(state, '1', buildBotPolicy('bot-seed-alpha', 'competent'));
  assert.deepEqual(moveA, moveB, 'two policies with the same seed pick the same move for the same state');
  assert.equal(typeof moveA.name, 'string');
  assert.ok(moveA.name.length > 0, 'a real legal move name was chosen');
});

test('decideBotMove chooses only from the legal moves the seat may see', () => {
  const state = realBotState('1');
  // In the start stage the only legal moves are revealVillainCard / advanceStage.
  const move = decideBotMove(state, '1', buildBotPolicy('seed-legal', 'competent'));
  assert.ok(
    ['revealVillainCard', 'advanceStage'].includes(move.name),
    `chose a start-stage-legal move (got ${move.name})`,
  );
});

// WP-414 / D-24233 — reset the lifetime revive_count once a REVIVED match proves
// it is still drivable (completes a bot turn), so restart churn on a healthy
// match never strands it at the D-24230 cap.

/**
 * Builds deps whose bot turn passes control back to seat 0 (a successful turn),
 * plus a `resetRevivalCount` spy recording the match ids it was called with.
 */
function makeReviveDeps() {
  const resetCalls: string[] = [];
  const built = makeDeps({
    initial: fakeState('1', 1),
    decide: () => ({ name: 'endTurn', args: {} }),
    onSubmit: (_move, match) => {
      // endTurn passes control to the human seat 0 → the bot turn "passed".
      match.value = fakeState('0', 2);
    },
    overrides: {
      resetRevivalCount: async (id: string) => {
        resetCalls.push(id);
      },
    },
  });
  return { ...built, resetCalls };
}

test('a revived driver resets revive_count after its first successful bot turn', async () => {
  const { deps, resetCalls } = makeReviveDeps();
  const driver = createBotAllyDriver({
    matchId: 'm-revived',
    botSeats: ['1'],
    deps,
    initialReviveCount: 3,
  });

  await driver.tick();

  assert.equal(driver.getTurnCount(), 1, 'the bot turn completed');
  assert.deepEqual(resetCalls, ['m-revived'], 'revive_count was reset exactly once for this match');
});

test('a fresh driver (initialReviveCount 0) never resets revive_count', async () => {
  const { deps, resetCalls } = makeReviveDeps();
  const driver = createBotAllyDriver({
    matchId: 'm-fresh',
    botSeats: ['1'],
    deps,
    // initialReviveCount omitted → defaults to 0 → no reset write
  });

  await driver.tick();

  assert.equal(driver.getTurnCount(), 1, 'the bot turn completed');
  assert.deepEqual(resetCalls, [], 'a never-revived match writes no reset');
});

test('the revive_count reset fires at most once per driver lifetime (latched)', async () => {
  const { deps, match, resetCalls } = makeReviveDeps();
  const driver = createBotAllyDriver({
    matchId: 'm-latch',
    botSeats: ['1'],
    deps,
    initialReviveCount: 2,
  });

  await driver.tick(); // first bot turn → reset fires
  // hand the bot a second turn; the latch must suppress a second reset write.
  match.value = fakeState('1', 3);
  await driver.tick(); // second bot turn → no further reset

  assert.equal(driver.getTurnCount(), 2, 'two bot turns completed');
  assert.deepEqual(resetCalls, ['m-latch'], 'the reset wrote only once across two successful turns');
});
