/**
 * Regression: the autoplay bot resolves a pending choice between hand plays
 * (D-24695).
 *
 * A played card can park a block-all pending choice — anni Brainstorm's Time
 * Loop Experiments draws a card then parks a mandatory put-a-hand-card-on-deck-top
 * choice. While it is parked the engine refuses every playCard. The refusal is a
 * void return, which boardgame.io still commits (the _stateID advances), so the
 * play step's silent-rejection guard never fired: it re-submitted the same
 * blocked card up to its 30-play cap, each one paced, and then the spend step
 * drained the choice. The match did not freeze, but the bot forfeited its
 * remaining hand plays that turn. The fix drains any parked choice after each
 * accepted play. (Revert proof: without the fix the first test commits 30
 * playCard moves and no resolve.)
 *
 * This suite drives the REAL play step (`playHandCards`) through boardgame.io's
 * real Master and the real engine moves — the only fakes are an in-memory match
 * store, a no-op transport, and an instant playback controller — and records the
 * exact move sequence the bot submits.
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { LegendaryGame } from '@legendary-arena/game-engine';
import { playHandCards } from './autoplay.mjs';

// why: boardgame.io v0.50 ships /master and /internal as CJS only (same bridge
// autoplay.mjs uses).
const require = createRequire(import.meta.url);
const { Master } = require('boardgame.io/master');
const { ProcessGameConfig, InitializeGame, Async } = require('boardgame.io/internal');

const MATCH_ID = 'hand-play-drain-match';
const TIME_LOOP_CARD = 'test-hero-deck-001/time-loop-experiments#0';

interface StoredMatch {
  state: { G: Record<string, unknown>; ctx: Record<string, unknown>; _stateID: number };
  metadata: Record<string, unknown>;
}

/**
 * Builds a minimal async match store over one in-memory match, recording the
 * name of every move the Master commits (from each write's deltalog).
 *
 * @param initial - The match's starting state and metadata.
 * @returns The store plus the recorded committed move names.
 */
function createMemoryStore(initial: StoredMatch) {
  const stored: StoredMatch = { state: structuredClone(initial.state), metadata: initial.metadata };
  const committedMoves: string[] = [];
  const store = {
    type: () => Async.prototype.type(),
    fetch: async (_matchId: string, options: { state?: boolean; metadata?: boolean }) => ({
      state: options.state ? stored.state : undefined,
      metadata: options.metadata ? stored.metadata : undefined,
    }),
    setState: async (_matchId: string, state: StoredMatch['state'], deltalog?: Array<{ action: { payload: { type: string } } }>) => {
      // why: a real store serializes the write; cloning also drops Immer's freeze
      // so the scenario setup below can edit the stored G.
      stored.state = structuredClone(state);
      for (const logEntry of deltalog ?? []) {
        committedMoves.push(logEntry.action.payload.type);
      }
    },
    setMetadata: async (_matchId: string, metadata: Record<string, unknown>) => {
      stored.metadata = metadata;
    },
  };
  return { store, stored, committedMoves };
}

/**
 * Builds a solo match in the play phase's main stage with the given hand, via
 * the real setup path (empty registry) and the real lobby moves.
 *
 * @param hand - The active player's hand.
 * @param heroAbilityHooks - Ability hooks for the hand's cards.
 * @returns The loop context playHandCards consumes, the store, and the state.
 */
async function buildMainStageMatch(hand: string[], heroAbilityHooks: unknown[]) {
  const processedGame = ProcessGameConfig({ ...LegendaryGame, seed: 'hand-play-drain' });
  const setupData = {
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
  const initialState = InitializeGame({ game: processedGame, numPlayers: 1, setupData });
  const memory = createMemoryStore({ state: initialState, metadata: { players: {} } });
  const transport = { pubSub: { publish: () => {} } };
  const master = new Master(processedGame, memory.store, { send() {}, sendAll() {} }, undefined);
  for (const lobbyMove of [
    { type: 'setPlayerReady', args: [{ ready: true }] },
    { type: 'startMatchIfReady', args: [] },
  ]) {
    await master.onUpdate(
      { type: 'MAKE_MOVE', payload: { ...lobbyMove, playerID: '0', credentials: 'bot' } },
      memory.stored.state._stateID,
      MATCH_ID,
      '0',
    );
  }
  assert.equal(memory.stored.state.ctx.phase, 'play', 'the real lobby moves started the match');
  // why: set the scenario directly on the stored G — the main stage, a known
  // hand, a known deck to draw from, and the hooks for the hand's cards.
  const gameState = memory.stored.state.G as {
    currentStage: string;
    playerZones: Record<string, { hand: string[]; deck: string[] }>;
    heroAbilityHooks: unknown[];
  };
  gameState.currentStage = 'main';
  gameState.playerZones['0']!.hand = hand;
  gameState.playerZones['0']!.deck = ['test-hero-deck-002/drawn-card#0', 'test-hero-deck-002/drawn-card#1'];
  gameState.heroAbilityHooks = heroAbilityHooks;
  memory.committedMoves.length = 0;
  const controller = {
    pushState: () => {},
    waitIfPaused: async () => {},
    getActiveDelay: () => 0,
  };
  const loop = {
    moveParams: { processedGame, db: memory.store, transport, auth: undefined, matchId: MATCH_ID, credentials: { 0: 'bot' } },
    controller,
    db: memory.store,
    matchId: MATCH_ID,
  };
  return { loop, memory };
}

test('a choice-opening card no longer forfeits the rest of the hand (D-24695 regression)', async () => {
  // why: the Time Loop Experiments shape — draw 1, then park the mandatory
  // put-a-hand-card-on-deck-top choice (a block-all guard on playCard).
  const timeLoopHook = {
    cardId: TIME_LOOP_CARD,
    timing: 'onPlay',
    keywords: ['put-hand-on-deck-top'],
    effects: [{ type: 'put-hand-on-deck-top', magnitude: 1 }],
  };
  const { loop, memory } = await buildMainStageMatch(
    [TIME_LOOP_CARD, 'test-hero-deck-001/plain-card#0'],
    [timeLoopHook],
  );

  const result = await playHandCards(loop, memory.stored.state);

  assert.equal(result.kind, 'progressed');
  assert.deepEqual(
    memory.committedMoves,
    ['playCard', 'resolvePutHandOnDeckTop', 'playCard'],
    'the parked choice resolves between plays; before the fix the blocked playCard repeated to the 30-play cap',
  );
  assert.equal(result.playedCount, 2, 'both remaining hand cards were played (one went on the deck top)');
  const zones = (memory.stored.state.G as { playerZones: Record<string, { hand: string[]; deck: string[] }> }).playerZones['0']!;
  assert.deepEqual(zones.hand, [], 'the hand is fully played out');
  assert.equal((memory.stored.state.G as { pendingPutHandOnDeckTop?: unknown[] }).pendingPutHandOnDeckTop?.length ?? 0, 0, 'no choice is left parked');
});

test('a turn with no pending choice submits exactly the plays it did before', async () => {
  const hand = ['test-hero-deck-001/plain-card#0', 'test-hero-deck-001/plain-card#1', 'test-hero-deck-002/plain-card#0'];
  const { loop, memory } = await buildMainStageMatch(hand, []);

  const result = await playHandCards(loop, memory.stored.state);

  assert.equal(result.kind, 'progressed');
  assert.deepEqual(memory.committedMoves, ['playCard', 'playCard', 'playCard'], 'one playCard per hand card, nothing else');
  assert.equal(result.playedCount, 3);
  const zones = (memory.stored.state.G as { playerZones: Record<string, { hand: string[]; inPlay: string[] }> }).playerZones['0']!;
  assert.deepEqual(zones.inPlay, hand, 'cards were played in hand order');
});
