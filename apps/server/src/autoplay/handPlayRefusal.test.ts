/**
 * Regression: the autoplay bot skips a hand card the engine refuses instead of
 * re-submitting it to the 30-play cap (D-24699).
 *
 * The engine refuses a playCard by returning void without moving the card, and
 * boardgame.io still commits that move, so the match _stateID advances. The play
 * step's old silent-rejection guard ("_stateID did not advance") therefore never
 * fired: the bot re-submitted the same refused card (always hand[0]) up to the
 * 30-play cap, each one paced, and never reached the rest of its hand. The fix
 * detects a refusal by its effect (the card's copies in hand did not drop and its
 * copies in play did not rise), skips that card for the rest of the step, and
 * drains any already-parked choice before the first pick so a block-all guard
 * cannot make every card look refused. (Revert proof: without the fix the first
 * two tests commit 30 playCard moves; without the opening drain the third test
 * skips every card and leaves the choice parked.)
 *
 * This suite drives the REAL play step (`playHandCards`) through boardgame.io's
 * real Master and the real engine moves — the only fakes are an in-memory match
 * store, a no-op transport, and an instant playback controller — and records the
 * exact move sequence the bot submits. Same harness as handPlayDrain.test.ts.
 * The last test covers the D-24705 lead pick: a "first Hero you played this turn"
 * card is played before the rest of the hand.
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

const MATCH_ID = 'hand-play-refusal-match';
// why: the ssw2 Extinction Blast shape — "To play this card, you must discard
// three cards from your hand." [keyword:discard-to-play:3]. A hand of three can
// never pay it, so the engine's D-24185 pre-commit precondition refuses it.
const EXTINCTION_BLAST_CARD = 'test-hero-deck-001/extinction-blast#0';
// why: the engine's Wound pile id (WOUND_EXT_ID); playCard refuses a Wound by the
// D-24455 pre-commit precondition.
const WOUND_CARD = 'pile-wound';

interface StoredMatch {
  state: { G: Record<string, unknown>; ctx: Record<string, unknown>; _stateID: number };
  metadata: Record<string, unknown>;
}

interface PlayerZonesView {
  hand: string[];
  deck: string[];
  inPlay: string[];
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
 * @returns The loop context playHandCards consumes and the store.
 */
async function buildMainStageMatch(hand: string[], heroAbilityHooks: unknown[]) {
  const processedGame = ProcessGameConfig({ ...LegendaryGame, seed: 'hand-play-refusal' });
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
    playerZones: Record<string, PlayerZonesView>;
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

/**
 * Reads the active player's zones from the stored match.
 *
 * @param memory - The in-memory store wrapper.
 * @returns Player 0's zones.
 */
function readPlayerZones(memory: { stored: StoredMatch }): PlayerZonesView {
  return (memory.stored.state.G as { playerZones: Record<string, PlayerZonesView> }).playerZones['0']!;
}

test('an unpayable discard-to-play card is submitted once, skipped, and the rest of the hand is played (D-24699)', async (context) => {
  const extinctionBlastHook = {
    cardId: EXTINCTION_BLAST_CARD,
    timing: 'onPlay',
    keywords: ['discard-to-play'],
    effects: [{ type: 'discard-to-play', magnitude: 3 }],
  };
  const hand = [EXTINCTION_BLAST_CARD, 'test-hero-deck-002/plain-card#0', 'test-hero-deck-002/plain-card#1'];
  const { loop, memory } = await buildMainStageMatch(hand, [extinctionBlastHook]);
  const logSpy = context.mock.method(console, 'log', () => {});

  const result = await playHandCards(loop, memory.stored.state);

  assert.equal(result.kind, 'progressed');
  assert.deepEqual(
    memory.committedMoves,
    ['playCard', 'playCard', 'playCard'],
    'one refused Extinction Blast play then the two playable cards; before the fix the refused card repeated to the 30-play cap',
  );
  assert.equal(result.playedCount, 2, 'the refused play is not counted as played');
  const zones = readPlayerZones(memory);
  assert.deepEqual(zones.hand, [EXTINCTION_BLAST_CARD], 'the refused card stays in hand');
  assert.deepEqual(zones.inPlay, ['test-hero-deck-002/plain-card#0', 'test-hero-deck-002/plain-card#1'], 'the playable cards were played in hand order');
  const refusalLines = logSpy.mock.calls
    .map((call) => String(call.arguments[0]))
    .filter((line) => line.includes('refused') && line.includes(EXTINCTION_BLAST_CARD));
  assert.equal(refusalLines.length, 1, 'exactly one log line names the refused card');
});

test('a Wound in hand is skipped instead of blocking every later play (D-24699)', async (context) => {
  const hand = [WOUND_CARD, 'test-hero-deck-001/plain-card#0', WOUND_CARD, 'test-hero-deck-001/plain-card#1'];
  const { loop, memory } = await buildMainStageMatch(hand, []);
  context.mock.method(console, 'log', () => {});

  const result = await playHandCards(loop, memory.stored.state);

  assert.equal(result.kind, 'progressed');
  assert.deepEqual(
    memory.committedMoves,
    ['playCard', 'playCard', 'playCard'],
    'one refused Wound play then the two playable cards; the second Wound copy is never submitted',
  );
  assert.equal(result.playedCount, 2);
  const zones = readPlayerZones(memory);
  assert.deepEqual(zones.hand, [WOUND_CARD, WOUND_CARD], 'both Wounds stay in hand');
  assert.deepEqual(zones.inPlay, ['test-hero-deck-001/plain-card#0', 'test-hero-deck-001/plain-card#1']);
});

test('a choice already parked when the play step starts is resolved before the first play (D-24699)', async () => {
  const hand = ['test-hero-deck-001/plain-card#0', 'test-hero-deck-001/plain-card#1', 'test-hero-deck-002/plain-card#0'];
  const { loop, memory } = await buildMainStageMatch(hand, []);
  // why: seed a block-all choice parked before the hand-play step (the shape a
  // card replayed during the start -> main advance leaves behind).
  (memory.stored.state.G as { pendingPutHandOnDeckTop?: unknown[] }).pendingPutHandOnDeckTop = [{ playerID: '0' }];

  const result = await playHandCards(loop, memory.stored.state);

  assert.equal(result.kind, 'progressed');
  assert.deepEqual(
    memory.committedMoves,
    ['resolvePutHandOnDeckTop', 'playCard', 'playCard'],
    'the parked choice resolves first, then the two remaining hand cards are played',
  );
  assert.equal(result.playedCount, 2);
  const zones = readPlayerZones(memory);
  assert.deepEqual(zones.hand, [], 'the hand is fully played out (one card went on the deck top)');
  assert.equal((memory.stored.state.G as { pendingPutHandOnDeckTop?: unknown[] }).pendingPutHandOnDeckTop?.length ?? 0, 0, 'no choice is left parked');
});

test('a normal hand with duplicate starting-card ids plays exactly as before (D-24699)', async () => {
  // why: starting S.H.I.E.L.D. cards share one id per kind, so a played copy
  // leaves another copy in hand; the refusal check must count copies, not test
  // membership, or it would wrongly skip the second Agent.
  const hand = ['starting-shield-agent', 'starting-shield-agent', 'starting-shield-trooper', 'test-hero-deck-001/plain-card#0'];
  const { loop, memory } = await buildMainStageMatch(hand, []);

  const result = await playHandCards(loop, memory.stored.state);

  assert.equal(result.kind, 'progressed');
  assert.deepEqual(memory.committedMoves, ['playCard', 'playCard', 'playCard', 'playCard'], 'one playCard per hand card, nothing else');
  assert.equal(result.playedCount, 4);
  const zones = readPlayerZones(memory);
  assert.deepEqual(zones.hand, []);
  assert.deepEqual(zones.inPlay, hand, 'cards were played in hand order');
});

test('a "first Hero you played this turn" card leads the turn instead of waiting its hand-order turn (D-24705)', async () => {
  // why: D-24705 — live match 0BVSi0_KY0A: Do-Over behind two S.H.I.E.L.D. Agents
  // always failed its gate. The hand puts Do-Over third; it must be played first so the
  // gate passes, which the parked-then-drained resolveDoOver proves. Four live cards
  // stay behind it, so the bot declines under both the D-24498 and D-24706 defaults.
  const DO_OVER_CARD = 'test-hero-deck-001/hey-can-i-get-a-do-over#0';
  const doOverHook = {
    cardId: DO_OVER_CARD,
    timing: 'onPlay',
    keywords: ['do-over'],
    conditions: [{ type: 'firstHeroPlayedThisTurn', value: '1' }],
    effects: [{ type: 'do-over' }],
  };
  const hand = [
    'starting-shield-agent',
    'starting-shield-agent',
    DO_OVER_CARD,
    'test-hero-deck-001/plain-card#0',
    'test-hero-deck-001/plain-card#1',
  ];
  const { loop, memory } = await buildMainStageMatch(hand, [doOverHook]);
  const gameState = memory.stored.state.G as { cardDisplayData: Record<string, unknown> };
  gameState.cardDisplayData = {
    ...gameState.cardDisplayData,
    [DO_OVER_CARD]: {
      extId: DO_OVER_CARD,
      name: 'Hey, Can I Get a Do-Over?',
      cost: 3,
      imageUrl: '',
      heroClass: 'instinct',
      team: 'unaffiliated',
      abilityText:
        'If this is the first Hero you played this turn, you may discard the rest of your hand and draw four cards. [keyword:first-hero-condition] [keyword:do-over]',
    },
  };

  const result = await playHandCards(loop, memory.stored.state);

  assert.equal(result.kind, 'progressed');
  assert.deepEqual(
    memory.committedMoves,
    ['playCard', 'resolveDoOver', 'playCard', 'playCard', 'playCard', 'playCard'],
    'Do-Over is played first, its gate passes and parks the choice, the drain resolves it, then the rest of the hand plays',
  );
  assert.equal(result.playedCount, 5);
  const zones = readPlayerZones(memory);
  assert.deepEqual(
    zones.inPlay,
    [DO_OVER_CARD, 'starting-shield-agent', 'starting-shield-agent', 'test-hero-deck-001/plain-card#0', 'test-hero-deck-001/plain-card#1'],
    'Do-Over first, then the rest in hand order',
  );
});
