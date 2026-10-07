/**
 * Tests for the split / dual-faced hero "choose a side" flow (WP-724 / D-24546, un-deferring
 * D-14101): the resolveSplitFaceChoice move, the hasPendingSplitFaceChoice predicate, the
 * isSplitCardInstance + parkSplitFaceChoice helpers, the playCard park branch, and the block-all
 * guard.
 *
 * Covers:
 *  - hasPendingSplitFaceChoice: false when undefined/empty, true when queued.
 *  - isSplitCardInstance: true for EITHER face of a split card (WP-772); false otherwise / no map.
 *  - face-b replay (WP-772 / D-24604): a face-b id replays into a fresh choice (faceA = primary);
 *    choosing a from a played face-b id relabels inPlay to face a.
 *  - parkSplitFaceChoice: pushes a PendingSplitFaceChoice with faceA = played, faceB = alternate
 *    (same #copyIndex).
 *  - resolveSplitFaceChoice face 'a' → keeps faceA in inPlay, grants faceA economy, queue pops.
 *  - resolveSplitFaceChoice face 'b' → relabels inPlay faceA→faceB, grants faceB economy, queue pops.
 *  - invalid face / wrong player / empty queue → silent no-op (queue intact, no economy).
 *  - playCard on a split card parks a choice and grants NO economy until resolved (integration).
 *  - the block-all guard freezes another move (drawCards) while a split-face choice is pending.
 *  - playBothSplitFaces (WP-780 / D-24619): both faces' economy in order, one face-a inPlay
 *    entry, the marker written between the faces; null pair → false with no mutation; missing
 *    zones → true with no mutation; playCard skips the picker only while Penumbra is active.
 *  - playBothSplitFaces per-face cost (D-24625): an unpayable face is skipped (no economy, no
 *    hooks, one log line); a lone played face is the unmarked entry.
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
  playBothSplitFaces,
  isSplitFacePayable,
  isSplitFaceBindable,
} from './splitFaceChoice.resolve.js';
import { playCard, drawCards } from './coreMoves.impl.js';
import { resolveDiscardToPlay } from './resolveDiscardToPlay.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
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

  it('isSplitCardInstance is true for either face of a split card, false for a non-split card or when no map exists', () => {
    const withMap = makeTestGameState({ '0': {} }, { splitFaces: SPLIT_FACES });
    assert.equal(isSplitCardInstance(withMap, FACE_A), true, 'split base (any copy) is recognized');
    assert.equal(isSplitCardInstance(withMap, 'cvwr/peter-parker/hot-bowl-of-soup#4' as CardExtId), true, 'copy-agnostic');
    assert.equal(isSplitCardInstance(withMap, 'core/spider-man/astonishing-strength#0' as CardExtId), false, 'non-split card');
    // why: WP-772 / D-24604 — INTENTIONAL behavior change (was `false`): a card played as face b
    // keeps its face-b id, so the next play arrives as face b and must still offer the choice.
    assert.equal(isSplitCardInstance(withMap, FACE_B), true, 'the alternate face is recognized too');
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

  it('argless (undefined) and null submissions → no-op, never throw, queue intact', () => {
    for (const badArgs of [undefined, null]) {
      const gameState = makeTestGameState(
        { '0': { inPlay: [FACE_A] } },
        {
          splitFaces: SPLIT_FACES,
          pendingSplitFaceChoices: [{ playerID: '0', sourceCardId: FACE_A, faceA: FACE_A, faceB: FACE_B }],
          cardStats: { [FACE_A]: stat(0, 1, 2), [FACE_B]: stat(1, 0, 2) },
        },
      );
      assert.doesNotThrow(() => resolveSplitFaceChoice(makeMoveContext(gameState, '0'), badArgs as never));
      assert.equal(gameState.pendingSplitFaceChoices!.length, 1, 'queue intact');
      assert.deepEqual(gameState.playerZones['0']!.inPlay, [FACE_A], 'inPlay unchanged');
      assert.equal(gameState.turnEconomy.recruit, 0, 'no economy granted');
      assert.equal(gameState.turnEconomy.attack, 0, 'no economy granted');
    }
  });
});

describe('face-b replay (WP-772 / D-24604)', () => {
  it('a card played as face b, redrawn and played again, parks a fresh choice with faceA = primary', () => {
    const gameState = makeTestGameState(
      { '0': { hand: [FACE_A] } },
      {
        splitFaces: SPLIT_FACES,
        cardStats: { [FACE_A]: stat(0, 1, 2), [FACE_B]: stat(1, 0, 2) },
      },
    );
    // First play: choose face b, so the physical copy now carries the face-b id.
    playCard(makeMoveContext(gameState, '0'), { cardId: FACE_A });
    resolveSplitFaceChoice(makeMoveContext(gameState, '0'), { face: 'b' });
    assert.deepEqual(gameState.playerZones['0']!.inPlay, [FACE_B], 'first play bound face b');

    // The face-b id comes back round (cleanup → discard → redraw), modelled as a direct move.
    gameState.playerZones['0']!.inPlay = [];
    gameState.playerZones['0']!.hand = [FACE_B];
    playCard(makeMoveContext(gameState, '0'), { cardId: FACE_B });

    assert.equal(hasPendingSplitFaceChoice(gameState), true, 'the replayed face-b card offers the choice again');
    assert.deepEqual(gameState.pendingSplitFaceChoices?.[0], {
      playerID: '0', sourceCardId: FACE_B, faceA: FACE_A, faceB: FACE_B,
    }, 'faceA is still the primary face; sourceCardId is the id actually in inPlay');
    assert.deepEqual(gameState.playerZones['0']!.inPlay, [FACE_B], 'the card entered inPlay under its face-b id');
  });

  it("choosing 'a' from a played face-b id relabels inPlay to face a and grants face a's economy", () => {
    const gameState = makeTestGameState(
      { '0': { inPlay: [FACE_B] } },
      {
        splitFaces: SPLIT_FACES,
        pendingSplitFaceChoices: [{ playerID: '0', sourceCardId: FACE_B, faceA: FACE_A, faceB: FACE_B }],
        cardStats: { [FACE_A]: stat(0, 1, 2), [FACE_B]: stat(1, 0, 2) },
      },
    );
    resolveSplitFaceChoice(makeMoveContext(gameState, '0'), { face: 'a' });

    assert.deepEqual(gameState.playerZones['0']!.inPlay, [FACE_A], 'inPlay relabelled from face b to face a');
    assert.equal(gameState.turnEconomy.recruit, 1, 'face a recruit granted');
    assert.equal(gameState.turnEconomy.attack, 0, 'face b attack NOT granted');
    assert.equal(hasPendingSplitFaceChoice(gameState), false, 'queue popped');
  });

  it("choosing 'b' again from a played face-b id leaves inPlay unchanged and grants face b's economy", () => {
    const gameState = makeTestGameState(
      { '0': { inPlay: [FACE_B] } },
      {
        splitFaces: SPLIT_FACES,
        pendingSplitFaceChoices: [{ playerID: '0', sourceCardId: FACE_B, faceA: FACE_A, faceB: FACE_B }],
        cardStats: { [FACE_A]: stat(0, 1, 2), [FACE_B]: stat(1, 0, 2) },
      },
    );
    resolveSplitFaceChoice(makeMoveContext(gameState, '0'), { face: 'b' });

    assert.deepEqual(gameState.playerZones['0']!.inPlay, [FACE_B], 'no relabel needed');
    assert.equal(gameState.turnEconomy.attack, 1, 'face b attack granted');
    assert.equal(gameState.turnEconomy.recruit, 0, 'face a recruit NOT granted');
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

describe('playBothSplitFaces + the playCard Penumbra branch (WP-780 / D-24619)', () => {
  const BOTH_SIDES_STATS = { [FACE_A]: stat(0, 1, 2), [FACE_B]: stat(1, 0, 2) };

  it('grants face a then face b, enters ONE face-a entry, and records the marker', () => {
    const gameState = makeTestGameState({ '0': {} }, { splitFaces: SPLIT_FACES, cardStats: BOTH_SIDES_STATS });
    const { G: _G, playerID: _playerID, ...context } = makeMoveContext(gameState, '0');
    const handled = playBothSplitFaces(gameState, context, '0', FACE_B);

    assert.equal(handled, true);
    assert.deepEqual(gameState.playerZones['0']!.inPlay, [FACE_A], 'a played face-b id normalises to face a');
    assert.equal(gameState.turnEconomy.recruit, 1, "face a's recruit");
    assert.equal(gameState.turnEconomy.attack, 1, "face b's attack");
    assert.deepEqual(gameState.turnEconomy.bothSidesPlayedCardIds, [FACE_A]);
    assert.equal(gameState.lastPlayEffectsFired, 0, 'no hooks — zero effects fired across both faces');
    const sideLines = gameState.messages.filter((entry) => entry.text.includes('resolved side'));
    assert.deepEqual(sideLines.map((entry) => entry.card), [FACE_A, FACE_B], 'side a, then side b');
  });

  it('returns false with NO mutation on a null pair (playCard then falls through to the park path)', () => {
    const plainCard = 'core/spider-man/astonishing-strength#0' as CardExtId;
    const gameState = makeTestGameState({ '0': {} }, { splitFaces: SPLIT_FACES });
    const before = JSON.stringify(gameState);
    const { G: _G, playerID: _playerID, ...context } = makeMoveContext(gameState, '0');
    assert.equal(playBothSplitFaces(gameState, context, '0', plainCard), false);
    assert.equal(JSON.stringify(gameState), before, 'the card is never half-played');
  });

  it('returns true with NO mutation when the player has no zones (silent no-op)', () => {
    const gameState = makeTestGameState({ '0': {} }, { splitFaces: SPLIT_FACES });
    const before = JSON.stringify(gameState);
    const { G: _G, playerID: _playerID, ...context } = makeMoveContext(gameState, '0');
    assert.equal(playBothSplitFaces(gameState, context, '9', FACE_A), true);
    assert.equal(JSON.stringify(gameState), before);
  });

  it('playCard skips the picker only while isPlayBothSidesActive is set', () => {
    const active = makeTestGameState({ '0': { hand: [FACE_A] } }, { splitFaces: SPLIT_FACES, cardStats: BOTH_SIDES_STATS });
    active.turnEconomy = { ...active.turnEconomy, isPlayBothSidesActive: true };
    playCard(makeMoveContext(active, '0'), { cardId: FACE_A });
    assert.equal(hasPendingSplitFaceChoice(active), false, 'no picker under Penumbra');
    assert.deepEqual(active.playerZones['0']!.inPlay, [FACE_A]);

    const inactive = makeTestGameState({ '0': { hand: [FACE_A] } }, { splitFaces: SPLIT_FACES, cardStats: BOTH_SIDES_STATS });
    playCard(makeMoveContext(inactive, '0'), { cardId: FACE_A });
    assert.equal(hasPendingSplitFaceChoice(inactive), true, 'the picker parks as today');
    assert.equal(inactive.turnEconomy.bothSidesPlayedCardIds, undefined);
  });
});

// ---------------------------------------------------------------------------
// WP-777 / D-24615 — a split face's discard-to-play cost binds at the face choice
// ---------------------------------------------------------------------------

const ATTUNE = 'bkwd/falcon-winter-soldier/attune#4' as CardExtId;
const ATONE = 'bkwd/falcon-winter-soldier/atone#4' as CardExtId;
const ATTUNE_SPLIT_FACES = { 'bkwd/falcon-winter-soldier/attune': 'bkwd/falcon-winter-soldier/atone' };
const HAND_CARD = 'core/spider-man/astonishing-strength#0' as CardExtId;
const NEW_WINGS = 'bkwd/falcon-winter-soldier/new-wings#0' as CardExtId;

/** Attune's regenerated hook: "To play this side, you must discard a card. [keyword:discard-to-play:1]". */
const ATTUNE_COST_HOOK = {
  cardId: ATTUNE, timing: 'onPlay', keywords: ['discard-to-play'],
  effects: [{ type: 'discard-to-play', magnitude: 1 }],
} as unknown as HeroAbilityHook;

/** A New Wings hook, so the match reads cardsDiscardedThisTurnAtLeast (turns the counter on). */
const NEW_WINGS_HOOK = {
  cardId: NEW_WINGS, timing: 'onPlay', keywords: ['attack'],
  conditions: [{ type: 'cardsDiscardedThisTurnAtLeast', value: '1' }],
  effects: [{ type: 'attack', magnitude: 4 }],
} as unknown as HeroAbilityHook;

/** A state with Attune / Atone in play (or in hand), parked, with Attune's cost hook. */
function makeAttuneState(hand: CardExtId[], parked: boolean, extraHooks: HeroAbilityHook[] = []): LegendaryGameState {
  const gameState = makeTestGameState(
    { '0': { hand, inPlay: parked ? [ATTUNE] : [] } },
    {
      splitFaces: ATTUNE_SPLIT_FACES,
      cardStats: { [ATTUNE]: stat(0, 3, 3), [ATONE]: stat(0, 0, 3) },
      ...(parked
        ? { pendingSplitFaceChoices: [{ playerID: '0', sourceCardId: ATTUNE, faceA: ATTUNE, faceB: ATONE }] }
        : {}),
    },
  );
  gameState.heroAbilityHooks = [ATTUNE_COST_HOOK, ...extraHooks];
  gameState.cardDisplayData = {
    [ATTUNE]: { name: 'Attune' }, [ATONE]: { name: 'Atone' },
  } as unknown as LegendaryGameState['cardDisplayData'];
  return gameState;
}

describe('isSplitFacePayable + isSplitFaceBindable (WP-777 / D-24615)', () => {
  it('a costed face is payable only with enough hand cards; a free face always is', () => {
    const emptyHand = makeAttuneState([], true);
    assert.equal(isSplitFacePayable(emptyHand, '0', ATTUNE), false);
    assert.equal(isSplitFacePayable(emptyHand, '0', ATONE), true);
    const oneCard = makeAttuneState([HAND_CARD], true);
    assert.equal(isSplitFacePayable(oneCard, '0', ATTUNE), true);
  });

  it('bindable = payable, or neither face payable (anti-freeze)', () => {
    const emptyHand = makeAttuneState([], true);
    assert.equal(isSplitFaceBindable(emptyHand, '0', ATTUNE, ATONE), false, 'Attune blocked while Atone is free');
    assert.equal(isSplitFaceBindable(emptyHand, '0', ATONE, ATTUNE), true);
    const bothCosted = makeAttuneState([], true, [{ ...ATTUNE_COST_HOOK, cardId: ATONE } as HeroAbilityHook]);
    assert.equal(isSplitFaceBindable(bothCosted, '0', ATTUNE, ATONE), true, 'neither payable → either binds');
    assert.equal(isSplitFaceBindable(bothCosted, '0', ATONE, ATTUNE), true);
  });
});

describe('resolveSplitFaceChoice — Attune discard cost (WP-777 / D-24615)', () => {
  it('rejects Attune from an empty hand: queue intact, no economy, one "could not choose" line', () => {
    const gameState = makeAttuneState([], true);
    const messagesBefore = gameState.messages.length;
    resolveSplitFaceChoice(makeMoveContext(gameState, '0'), { face: 'a' });
    assert.equal(gameState.pendingSplitFaceChoices?.length, 1, 'the choice stays open');
    assert.equal(gameState.turnEconomy.recruit, 0, 'no +3 recruit leaked');
    assert.deepEqual(gameState.playerZones['0']!.inPlay, [ATTUNE]);
    assert.equal(gameState.pendingDiscardToPlay, undefined, 'no cost parked');
    const newMessages = gameState.messages.slice(messagesBefore);
    assert.equal(newMessages.length, 1);
    assert.deepEqual(newMessages[0], {
      text: 'Player 0 could not choose Attune — it requires discarding 1 card(s) but their hand does not hold enough cards to discard; choose the other side.',
      outcome: 'neutral',
      card: ATTUNE,
    });
  });

  it('Atone still binds from an empty hand', () => {
    const gameState = makeAttuneState([], true);
    resolveSplitFaceChoice(makeMoveContext(gameState, '0'), { face: 'b' });
    assert.equal(gameState.pendingSplitFaceChoices?.length ?? 0, 0);
    assert.deepEqual(gameState.playerZones['0']!.inPlay, [ATONE]);
  });

  it('Attune with a card in hand grants +3 recruit and parks the discard; paying it discards and counts', () => {
    const gameState = makeAttuneState([HAND_CARD], true, [NEW_WINGS_HOOK]);
    resolveSplitFaceChoice(makeMoveContext(gameState, '0'), { face: 'a' });
    assert.equal(gameState.turnEconomy.recruit, 3);
    assert.deepEqual(gameState.pendingDiscardToPlay, [{ playerID: '0', sourceCardId: ATTUNE, remaining: 1 }]);
    resolveDiscardToPlay(makeMoveContext(gameState, '0') as Parameters<typeof resolveDiscardToPlay>[0], { cardId: HAND_CARD });
    assert.deepEqual(gameState.playerZones['0']!.hand, []);
    assert.deepEqual(gameState.playerZones['0']!.discard, [HAND_CARD]);
    assert.equal(gameState.pendingDiscardToPlay?.length ?? 0, 0);
    assert.deepEqual(gameState.cardsDiscardedThisTurn, { '0': 1 });
  });

  it('playCard commits a split card whose face a is costed, even from a one-card hand', () => {
    const gameState = makeAttuneState([ATTUNE], false);
    playCard(makeMoveContext(gameState, '0'), { cardId: ATTUNE });
    assert.deepEqual(gameState.playerZones['0']!.hand, []);
    assert.deepEqual(gameState.playerZones['0']!.inPlay, [ATTUNE]);
    assert.equal(gameState.pendingSplitFaceChoices?.length, 1, 'the side choice is parked');
  });
});

describe('playBothSplitFaces — per-face discard cost under Penumbra (D-24625)', () => {
  it('face a unpayable, face b payable: Attune skipped, Atone played as the one unmarked entry', () => {
    const gameState = makeAttuneState([], false);
    const { G: _G, playerID: _playerID, ...context } = makeMoveContext(gameState, '0');
    assert.equal(playBothSplitFaces(gameState, context, '0', ATTUNE), true);
    assert.deepEqual(gameState.playerZones['0']!.inPlay, [ATONE], 'the entry is the face actually played');
    assert.equal(gameState.turnEconomy.recruit, 0, "no Attune +3 recruit");
    assert.equal(gameState.turnEconomy.bothSidesPlayedCardIds, undefined, 'one face played — not marked');
    assert.equal(gameState.pendingDiscardToPlay, undefined, "Attune's cost hook never fired");
    const skipLines = gameState.messages.filter((entry) => entry.text.includes('could not play side'));
    assert.deepEqual(skipLines, [{
      text: 'Player 0 could not play side a, Attune — it requires discarding 1 card(s) but their hand does not hold enough cards to discard, so that side is skipped.',
      outcome: 'neutral',
      card: ATTUNE,
    }]);
    const sideLines = gameState.messages.filter((entry) => entry.text.includes('resolved side'));
    assert.deepEqual(sideLines.map((entry) => entry.card), [ATONE], 'only side b resolved');
  });

  it('both faces payable: Attune charges its cost, both faces resolve, the entry is marked', () => {
    const gameState = makeAttuneState([HAND_CARD], false);
    const { G: _G, playerID: _playerID, ...context } = makeMoveContext(gameState, '0');
    playBothSplitFaces(gameState, context, '0', ATONE);
    assert.deepEqual(gameState.playerZones['0']!.inPlay, [ATTUNE]);
    assert.equal(gameState.turnEconomy.recruit, 3);
    assert.deepEqual(gameState.turnEconomy.bothSidesPlayedCardIds, [ATTUNE]);
    assert.deepEqual(gameState.pendingDiscardToPlay, [{ playerID: '0', sourceCardId: ATTUNE, remaining: 1 }]);
  });

  it('neither face payable: face a still plays (anti-freeze fallback), face b is skipped', () => {
    const gameState = makeAttuneState([], false, [{ ...ATTUNE_COST_HOOK, cardId: ATONE } as HeroAbilityHook]);
    const { G: _G, playerID: _playerID, ...context } = makeMoveContext(gameState, '0');
    playBothSplitFaces(gameState, context, '0', ATTUNE);
    assert.deepEqual(gameState.playerZones['0']!.inPlay, [ATTUNE]);
    assert.equal(gameState.turnEconomy.bothSidesPlayedCardIds, undefined);
    assert.ok(gameState.messages.some((entry) => entry.text.includes('could not play side b, Atone')));
  });
});
