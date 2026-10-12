/**
 * Regression: a stored match carries no undo / redo snapshots (D-24702).
 *
 * boardgame.io 0.50 enables undo unless the game sets `disableUndo`. With undo on,
 * its reducer appends a full { G, ctx, plugins } snapshot to the match state's
 * `_undo` array for every move of the current turn, and the Master persists that
 * array in every bgio match record. Nothing uses undo (the game socket accepts only
 * MAKE_MOVE, D-24701), so LegendaryGame sets `disableUndo: true` and the stored
 * `_undo` / `_redo` stay empty.
 *
 * This suite drives a real solo match through boardgame.io's real Master and the
 * real engine moves (lobby → startMatchIfReady → revealVillainCard → advanceStage
 * ×2 → endTurn) and inspects the state the Master writes to the store after every
 * move. The only fakes are an in-memory match store and a no-op transport. Same
 * harness as autoplay/handPlayRefusal.test.ts. (Revert proof: without
 * `disableUndo` the first test fails on the first move, because `_undo` holds a
 * snapshot; the last test shows that growth directly.)
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { LegendaryGame } from '@legendary-arena/game-engine';

// why: boardgame.io v0.50 ships /master and /internal as CJS only (same bridge
// autoplay.mjs uses).
const require = createRequire(import.meta.url);
const { Master } = require('boardgame.io/master');
const { ProcessGameConfig, InitializeGame, Async } = require('boardgame.io/internal');

const MATCH_ID = 'undo-storage-match';

const SETUP_DATA = {
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

// why: the real lobby-to-turn-2 path a live match takes, as player moves.
const MATCH_MOVES = [
  { type: 'setPlayerReady', args: [{ ready: true }] },
  { type: 'startMatchIfReady', args: [] },
  { type: 'revealVillainCard', args: [] },
  { type: 'advanceStage', args: [] },
  { type: 'advanceStage', args: [] },
  { type: 'endTurn', args: [] },
];

interface StoredState {
  G: Record<string, unknown>;
  ctx: { turn: number; phase: string; gameover?: unknown };
  _stateID: number;
  _undo: unknown[];
  _redo: unknown[];
}

/**
 * Builds a solo match on a real Master over an in-memory store. The initial state
 * comes from the real setup path (empty registry).
 *
 * @param game - The game config to run (LegendaryGame, or a variant for contrast).
 * @returns The Master and a reader for the state last written to the store.
 */
function buildMatch(game: typeof LegendaryGame) {
  const processedGame = ProcessGameConfig({ ...game, seed: 'undo-storage' });
  const initialState = structuredClone(
    InitializeGame({ game: processedGame, numPlayers: 1, setupData: SETUP_DATA }),
  ) as StoredState;
  // why: the empty test registry deals an empty Hero Deck, which latches the
  // deck-exhaustion final turn (D-24159) and ends the match as a tie at the first
  // endTurn. Stocking the deck lets the match reach turn 2 as a live one does.
  (initialState.G as { heroDeck: string[] }).heroDeck = [
    'test-hero-deck-001/stock-card#0',
    'test-hero-deck-001/stock-card#1',
    'test-hero-deck-001/stock-card#2',
  ];
  let stored = { state: initialState, metadata: { players: {} } as Record<string, unknown> };
  const store = {
    type: () => Async.prototype.type(),
    fetch: async (_matchId: string, options: { state?: boolean; metadata?: boolean }) => ({
      state: options.state ? stored.state : undefined,
      metadata: options.metadata ? stored.metadata : undefined,
    }),
    setState: async (_matchId: string, state: StoredState) => {
      // why: a real store serializes the write, so the test reads what Postgres would hold.
      stored = { ...stored, state: structuredClone(state) };
    },
    setMetadata: async (_matchId: string, metadata: Record<string, unknown>) => {
      stored = { ...stored, metadata };
    },
  };
  const master = new Master(processedGame, store, { send() {}, sendAll() {} }, undefined);
  return { master, readState: () => stored.state };
}

/**
 * Sends one action to the Master as player 0.
 *
 * @param master - The match's Master.
 * @param readState - Reader for the stored state (supplies the current _stateID).
 * @param action - The boardgame.io action to send.
 */
async function sendAction(
  master: { onUpdate: (...args: unknown[]) => Promise<unknown> },
  readState: () => StoredState,
  action: { type: string; payload: Record<string, unknown> },
): Promise<void> {
  await master.onUpdate(action, readState()._stateID, MATCH_ID, '0');
}

test('every stored state keeps _undo and _redo empty while a real match reaches turn 2 (D-24702)', async () => {
  const { master, readState } = buildMatch(LegendaryGame);
  assert.deepEqual(readState()._undo, [], 'the initial state stores no undo snapshot');

  let firstPlayTurn = 0;
  for (const move of MATCH_MOVES) {
    const stateIdBefore = readState()._stateID;
    await sendAction(master, readState, {
      type: 'MAKE_MOVE',
      payload: { ...move, playerID: '0', credentials: 'player' },
    });
    const stored = readState();
    assert.equal(stored._stateID, stateIdBefore + 1, `the ${move.type} move was committed`);
    assert.deepEqual(stored._undo, [], `no undo snapshot is stored after ${move.type}`);
    assert.deepEqual(stored._redo, [], `no redo snapshot is stored after ${move.type}`);
    if (move.type === 'startMatchIfReady') {
      assert.equal(stored.ctx.phase, 'play', 'the lobby moves started the match');
      firstPlayTurn = stored.ctx.turn;
    }
  }

  const finalState = readState();
  assert.equal(finalState.ctx.phase, 'play', 'the match is still in play');
  assert.equal(finalState.ctx.gameover, undefined, 'the match did not end');
  assert.equal(finalState.ctx.turn, firstPlayTurn + 1, 'endTurn advanced the match to its second play turn');
  assert.equal(finalState.G.currentStage, 'start', 'the second turn opens at the start stage');
});

test('an UNDO action is refused and leaves the stored state unchanged (D-24702)', async (context) => {
  // why: boardgame.io logs the refusal ("Undo is not enabled") through console.error.
  context.mock.method(console, 'error', () => {});
  const { master, readState } = buildMatch(LegendaryGame);
  for (const move of MATCH_MOVES.slice(0, 3)) {
    await sendAction(master, readState, {
      type: 'MAKE_MOVE',
      payload: { ...move, playerID: '0', credentials: 'player' },
    });
  }
  const before = structuredClone(readState());

  await sendAction(master, readState, { type: 'UNDO', payload: { playerID: '0', credentials: 'player' } });

  assert.deepEqual(readState(), before, 'the revealVillainCard move was not rolled back');
});

test('with undo left on, the stored _undo grows by one full snapshot per move — the storage cost D-24702 removes', async () => {
  const { master, readState } = buildMatch({ ...LegendaryGame, disableUndo: false });
  for (const move of MATCH_MOVES.slice(0, 3)) {
    await sendAction(master, readState, {
      type: 'MAKE_MOVE',
      payload: { ...move, playerID: '0', credentials: 'player' },
    });
  }
  const stored = readState();
  assert.ok(stored._undo.length >= 2, `the undo stack holds per-move snapshots (got ${stored._undo.length})`);
  const lastSnapshot = stored._undo[stored._undo.length - 1] as { G?: unknown; ctx?: unknown; plugins?: unknown };
  assert.ok(lastSnapshot.G && lastSnapshot.ctx && lastSnapshot.plugins, 'each snapshot carries a full G, ctx and plugins copy');
});
