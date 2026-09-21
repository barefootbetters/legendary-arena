/**
 * Tests for the split / dual-faced hero "choose a side" flow (WP-724 / D-24546, un-deferring
 * D-14101): the resolveSplitFaceChoice move, the hasPendingSplitFaceChoice predicate, the
 * isSplitCardInstance + parkSplitFaceChoice helpers, the playCard park branch, and the block-all
 * guard.
 *
 * Covers:
 *  - hasPendingSplitFaceChoice: false when undefined/empty, true when queued.
 *  - isSplitCardInstance: true for a card whose base is in G.splitFaces; false otherwise / no map.
 *  - parkSplitFaceChoice: pushes a PendingSplitFaceChoice with faceA = played, faceB = alternate
 *    (same #copyIndex).
 *  - resolveSplitFaceChoice face 'a' → keeps faceA in inPlay, grants faceA economy, queue pops.
 *  - resolveSplitFaceChoice face 'b' → relabels inPlay faceA→faceB, grants faceB economy, queue pops.
 *  - invalid face / wrong player / empty queue → silent no-op (queue intact, no economy).
 *  - playCard on a split card parks a choice and grants NO economy until resolved (integration).
 *  - the block-all guard freezes another move (drawCards) while a split-face choice is pending.
 *
 * Uses node:test + node:assert only. No boardgame.io imports.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSplitFaceChoice,
  hasPendingSplitFaceChoice,
  isSplitCardInstance,
  parkSplitFaceChoice,
} from './splitFaceChoice.resolve.js';
import { playCard, drawCards } from './coreMoves.impl.js';
import type { LegendaryGameState, PendingSplitFaceChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

type SeatOverride = { deck?: CardExtId[]; hand?: CardExtId[]; discard?: CardExtId[]; inPlay?: CardExtId[] };

/** A card-stat row; only attack/recruit/cost matter for these tests. */
function stat(attack: number, recruit: number, cost: number) {
  return { attack, recruit, cost, fightCost: 0, fightCostMode: 'static' as const, fightCostBase: 0 };
}

/**
 * Builds a minimal N-seat LegendaryGameState for the split-face flow. `seats` maps each
 * playerID to its zone contents; unspecified zones default to empty.
 */
function makeTestGameState(
  seats: Record<string, SeatOverride>,
  overrides: {
    pendingSplitFaceChoices?: PendingSplitFaceChoice[];
    splitFaces?: Record<string, string>;
    currentStage?: LegendaryGameState['currentStage'];
    cardStats?: Record<string, ReturnType<typeof stat>>;
  } = {},
): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const [seatId, zones] of Object.entries(seats)) {
    playerZones[seatId] = {
      deck: zones.deck ?? [], hand: zones.hand ?? [], discard: zones.discard ?? [],
      inPlay: zones.inPlay ?? [], victory: [],
    };
  }
  const state = {
    matchConfiguration: {
      schemeId: 'test-scheme', mastermindId: 'test-mastermind', villainGroupIds: [],
      henchmanGroupIds: [], heroDeckIds: [], bystandersCount: 0, woundsCount: 0,
      officersCount: 0, sidekicksCount: 0,
    },
    currentStage: overrides.currentStage ?? 'main',
    playerZones,
    piles: { bystanders: [], wounds: [], officers: [], sidekicks: [], horrors: [] },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainAbilityHooks: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    turnEconomy: {
      attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0,
    },
    cardStats: overrides.cardStats ?? {},
    cardKeywords: {},
    heroDeck: [],
    escapedPile: [],
    mastermind: {
      id: 'test-mastermind', baseCardId: 'test-mastermind-base', tacticsDeck: [] as CardExtId[],
      tacticsDefeated: [], strikePile: [], attachedBystanders: [],
    },
    scheme: { twistPile: [] },
    notableEvents: [],
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    cardDisplayData: {},
    cardTraits: {},
    transformDeck: [],
    transformTargets: {},
    schemeSetupInstructions: [],
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.splitFaces !== undefined) {
    state.splitFaces = overrides.splitFaces as Record<CardExtId, CardExtId>;
  }
  if (overrides.pendingSplitFaceChoices !== undefined) {
    state.pendingSplitFaceChoices = overrides.pendingSplitFaceChoices;
  }
  return state;
}

/** Builds a move context (random.Shuffle reverses to prove it ran, mirroring makeMockCtx). */
function makeMoveContext(gameState: LegendaryGameState, playerId = '0'): Parameters<typeof resolveSplitFaceChoice>[0] {
  return {
    G: gameState,
    ctx: {
      numPlayers: 2, currentPlayer: playerId, phase: 'play', turn: 1,
      playOrder: ['0', '1'], playOrderPos: 0, activePlayers: null,
    },
    events: {
      endTurn: mock.fn(), setPhase: mock.fn(), endPhase: mock.fn(), setStage: mock.fn(),
      endStage: mock.fn(), pass: mock.fn(), endGame: mock.fn(),
    },
    random: {
      Shuffle: <T>(deck: T[]): T[] => [...deck].reverse(),
      D4: mock.fn(), D6: mock.fn(), D10: mock.fn(), D12: mock.fn(), D20: mock.fn(), Die: mock.fn(), Number: mock.fn(),
    },
    playerID: playerId,
    log: { setMetadata: mock.fn() },
  } as unknown as Parameters<typeof resolveSplitFaceChoice>[0];
}

const FACE_A = 'cvwr/peter-parker/hot-bowl-of-soup#0' as CardExtId;
const FACE_B = 'cvwr/peter-parker/protect-my-family#0' as CardExtId;
const SPLIT_FACES = { 'cvwr/peter-parker/hot-bowl-of-soup': 'cvwr/peter-parker/protect-my-family' };

describe('hasPendingSplitFaceChoice + isSplitCardInstance (WP-724 / D-24545)', () => {
  it('hasPendingSplitFaceChoice is false when the queue is undefined or empty, true when queued', () => {
    const empty = makeTestGameState({ '0': {} });
    assert.equal(hasPendingSplitFaceChoice(empty), false);
    empty.pendingSplitFaceChoices = [];
    assert.equal(hasPendingSplitFaceChoice(empty), false);
    empty.pendingSplitFaceChoices = [{ playerID: '0', sourceCardId: FACE_A, faceA: FACE_A, faceB: FACE_B }];
    assert.equal(hasPendingSplitFaceChoice(empty), true);
  });

  it('isSplitCardInstance is true for a split base, false for a non-split card or when no map exists', () => {
    const withMap = makeTestGameState({ '0': {} }, { splitFaces: SPLIT_FACES });
    assert.equal(isSplitCardInstance(withMap, FACE_A), true, 'split base (any copy) is recognized');
    assert.equal(isSplitCardInstance(withMap, 'cvwr/peter-parker/hot-bowl-of-soup#4' as CardExtId), true, 'copy-agnostic');
    assert.equal(isSplitCardInstance(withMap, 'core/spider-man/astonishing-strength#0' as CardExtId), false, 'non-split card');
    assert.equal(isSplitCardInstance(withMap, FACE_B), false, 'the alternate base is never a primary key');
    const noMap = makeTestGameState({ '0': {} });
    assert.equal(isSplitCardInstance(noMap, FACE_A), false, 'no splitFaces map → never a split');
  });
});

describe('parkSplitFaceChoice (WP-724 / D-24546)', () => {
  it('pushes a pending choice with faceA = played instance and faceB = alternate at the same copy index', () => {
    const gameState = makeTestGameState({ '0': { inPlay: [FACE_A] } }, { splitFaces: SPLIT_FACES });
    parkSplitFaceChoice(gameState, '0', FACE_A);
    assert.equal(gameState.pendingSplitFaceChoices?.length, 1);
    assert.deepEqual(gameState.pendingSplitFaceChoices?.[0], {
      playerID: '0', sourceCardId: FACE_A, faceA: FACE_A, faceB: FACE_B,
    });
  });
});

describe('resolveSplitFaceChoice — face binding (WP-724 / D-24546)', () => {
  it("face 'a' keeps the primary face in inPlay, grants faceA economy, pops the queue", () => {
    const gameState = makeTestGameState(
      { '0': { inPlay: [FACE_A] } },
      {
        splitFaces: SPLIT_FACES,
        pendingSplitFaceChoices: [{ playerID: '0', sourceCardId: FACE_A, faceA: FACE_A, faceB: FACE_B }],
        // hot-bowl-of-soup: recruit 1, no attack; protect-my-family: attack 1, no recruit.
        cardStats: { [FACE_A]: stat(0, 1, 2), [FACE_B]: stat(1, 0, 2) },
      },
    );
    resolveSplitFaceChoice(makeMoveContext(gameState, '0'), { face: 'a' });

    assert.deepEqual(gameState.playerZones['0']!.inPlay, [FACE_A], 'primary face stays in inPlay');
    assert.equal(gameState.turnEconomy.recruit, 1, 'faceA recruit granted');
    assert.equal(gameState.turnEconomy.attack, 0, 'faceA has no attack');
    assert.equal(hasPendingSplitFaceChoice(gameState), false, 'queue popped');
  });

  it("face 'b' relabels inPlay to the alternate face, grants faceB economy, pops the queue", () => {
    const gameState = makeTestGameState(
      { '0': { inPlay: [FACE_A] } },
      {
        splitFaces: SPLIT_FACES,
        pendingSplitFaceChoices: [{ playerID: '0', sourceCardId: FACE_A, faceA: FACE_A, faceB: FACE_B }],
        cardStats: { [FACE_A]: stat(0, 1, 2), [FACE_B]: stat(1, 0, 2) },
      },
    );
    resolveSplitFaceChoice(makeMoveContext(gameState, '0'), { face: 'b' });

    assert.deepEqual(gameState.playerZones['0']!.inPlay, [FACE_B], 'inPlay relabelled to the alternate face');
    assert.equal(gameState.turnEconomy.attack, 1, 'faceB attack granted');
    assert.equal(gameState.turnEconomy.recruit, 0, 'faceB has no recruit');
    assert.equal(hasPendingSplitFaceChoice(gameState), false, 'queue popped');
  });

  it('invalid face / wrong player / empty queue are silent no-ops (queue intact, no economy)', () => {
    const base = () => makeTestGameState(
      { '0': { inPlay: [FACE_A] }, '1': {} },
      {
        splitFaces: SPLIT_FACES,
        pendingSplitFaceChoices: [{ playerID: '0', sourceCardId: FACE_A, faceA: FACE_A, faceB: FACE_B }],
        cardStats: { [FACE_A]: stat(0, 1, 2), [FACE_B]: stat(1, 0, 2) },
      },
    );

    const badFace = base();
    resolveSplitFaceChoice(makeMoveContext(badFace, '0'), { face: 'x' as 'a' });
    assert.equal(hasPendingSplitFaceChoice(badFace), true, 'invalid face: queue intact');
    assert.equal(badFace.turnEconomy.recruit, 0, 'invalid face: no economy granted');

    const wrongPlayer = base();
    resolveSplitFaceChoice(makeMoveContext(wrongPlayer, '1'), { face: 'a' });
    assert.equal(hasPendingSplitFaceChoice(wrongPlayer), true, 'wrong player: queue intact');
    assert.equal(wrongPlayer.turnEconomy.recruit, 0, 'wrong player: no economy granted');

    const emptyQueue = makeTestGameState({ '0': {} }, { splitFaces: SPLIT_FACES });
    resolveSplitFaceChoice(makeMoveContext(emptyQueue, '0'), { face: 'a' });
    assert.equal(emptyQueue.turnEconomy.recruit, 0, 'empty queue: no economy granted');
  });
});

describe('playCard integration + block-all guard (WP-724 / D-24546)', () => {
  it('playing a split card parks a choice and grants NO economy until resolved', () => {
    const gameState = makeTestGameState(
      { '0': { hand: [FACE_A] } },
      {
        splitFaces: SPLIT_FACES,
        cardStats: { [FACE_A]: stat(0, 1, 2), [FACE_B]: stat(1, 0, 2) },
      },
    );
    playCard(makeMoveContext(gameState, '0'), { cardId: FACE_A });

    assert.deepEqual(gameState.playerZones['0']!.hand, [], 'card left the hand');
    assert.deepEqual(gameState.playerZones['0']!.inPlay, [FACE_A], 'card entered inPlay as its primary face');
    assert.equal(hasPendingSplitFaceChoice(gameState), true, 'a choose-a-side choice was parked');
    assert.equal(gameState.turnEconomy.recruit, 0, 'economy is DEFERRED until the side is chosen');
    assert.equal(gameState.turnEconomy.attack, 0, 'economy is DEFERRED until the side is chosen');
  });

  it('a pending split-face choice freezes another action move (drawCards)', () => {
    const gameState = makeTestGameState(
      { '0': { hand: [], deck: ['x1', 'x2'] as CardExtId[] } },
      {
        splitFaces: SPLIT_FACES,
        pendingSplitFaceChoices: [{ playerID: '0', sourceCardId: FACE_A, faceA: FACE_A, faceB: FACE_B }],
      },
    );
    drawCards(makeMoveContext(gameState, '0') as unknown as Parameters<typeof drawCards>[0], { count: 1 });
    assert.deepEqual(gameState.playerZones['0']!.hand, [], 'drawCards is a no-op while a split-face choice is pending');
    assert.equal(gameState.playerZones['0']!.deck.length, 2, 'deck untouched');
  });
});
