/**
 * Tests for the resolveReorderChoice move (WP-479 / D-24286) and the
 * hasPendingReorderChoice block-all predicate.
 *
 * Covers: resolve rewrites the top-N of the deck to the submitted permutation +
 * front-pop (AC-2), leaving cards below the top-N untouched; a non-permutation
 * (drop / dupe / wrong length), a wrong playerID, an empty queue, a non-array /
 * empty orderedCardIds, and a drifted deck top are silent no-ops that leave the
 * queue byte-identical; hasPendingReorderChoice; a block-all no-op on an action
 * move while a reorder choice is pending (AC-3).
 *
 * Uses node:test + node:assert only. No boardgame.io testing imports.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveReorderChoice,
  hasPendingReorderChoice,
} from './reorderChoice.resolve.js';
import { playCard } from './coreMoves.impl.js';
import type { LegendaryGameState, PendingReorderChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

const A = 'core/a#0' as CardExtId;
const B = 'core/b#0' as CardExtId;
const C = 'core/c#0' as CardExtId;
const UNDER = 'core/under#0' as CardExtId;

/**
 * Creates a minimal LegendaryGameState for testing the reorder flow.
 *
 * @param overrides - Selective overrides for player "0" deck, the pending reorder
 *   queue, and current stage.
 */
function makeTestGameState(
  overrides: {
    deck?: CardExtId[];
    pendingReorderChoices?: PendingReorderChoice[];
    currentStage?: LegendaryGameState['currentStage'];
  } = {},
): LegendaryGameState {
  const state = {
    matchConfiguration: {
      schemeId: 'test-scheme', mastermindId: 'test-mastermind', villainGroupIds: [],
      henchmanGroupIds: [], heroDeckIds: [], bystandersCount: 0, woundsCount: 0,
      officersCount: 0, sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme', mastermindId: 'test-mastermind', villainGroupIds: [],
      henchmanGroupIds: [], heroDeckIds: [],
    },
    currentStage: overrides.currentStage ?? 'main',
    playerZones: {
      '0': {
        deck: overrides.deck ?? [],
        hand: [],
        discard: [],
        inPlay: [],
        victory: [],
      },
    },
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
    turnEconomy: { attack: 10, recruit: 10, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
    cardStats: {},
    cardKeywords: {},
    heroDeck: [],
    escapedPile: [],
    mastermind: {
      id: 'test-mastermind', baseCardId: 'test-mastermind-base',
      tacticsDeck: ['tactic-0'] as CardExtId[], tacticsDefeated: [], strikePile: [],
      attachedBystanders: [],
    },
    scheme: { twistPile: [] },
    notableEvents: [],
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    cardDisplayData: {},
    cardTraits: {},
    schemeSetupInstructions: [],
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.pendingReorderChoices !== undefined) {
    state.pendingReorderChoices = overrides.pendingReorderChoices;
  }
  return state;
}

/** Builds a move context for the move under test. */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveReorderChoice>[0] {
  return {
    G: gameState,
    ctx: {
      numPlayers: 1, currentPlayer: playerId, phase: 'play', turn: 1,
      playOrder: [playerId], playOrderPos: 0, activePlayers: null,
    },
    events: {
      endTurn: mock.fn(), setPhase: mock.fn(), endPhase: mock.fn(),
      setStage: mock.fn(), endStage: mock.fn(), pass: mock.fn(), endGame: mock.fn(),
    },
    random: {
      Shuffle: <T>(deck: T[]): T[] => [...deck].reverse(),
      D4: mock.fn(), D6: mock.fn(), D10: mock.fn(), D12: mock.fn(), D20: mock.fn(),
      Die: mock.fn(), Number: mock.fn(),
    },
    playerID: playerId,
    log: { setMetadata: mock.fn() },
  } as unknown as Parameters<typeof resolveReorderChoice>[0];
}

function reorderEntry(cardIds: CardExtId[]): PendingReorderChoice {
  return { choiceType: 'reorder-deck-top', playerID: '0', cardIds };
}

describe('resolveReorderChoice (WP-479 / D-24286)', () => {
  it('rewrites the top-N of the deck to the submitted order and front-pops (AC-2)', () => {
    // deck top is [A, B, C]; UNDER sits below the reordered window and must not move.
    const G = makeTestGameState({
      deck: [A, B, C, UNDER],
      pendingReorderChoices: [reorderEntry([A, B, C])],
    });
    resolveReorderChoice(makeMoveContext(G), { orderedCardIds: [C, A, B] });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [C, A, B, UNDER], 'top-3 reordered, UNDER untouched');
    assert.equal(G.pendingReorderChoices!.length, 0, 'front-popped on success');
  });

  it('no-ops on a non-permutation (dropped card) — queue intact', () => {
    const G = makeTestGameState({ deck: [A, B, C], pendingReorderChoices: [reorderEntry([A, B, C])] });
    resolveReorderChoice(makeMoveContext(G), { orderedCardIds: [A, B] });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [A, B, C], 'deck unchanged');
    assert.equal(G.pendingReorderChoices!.length, 1, 'queue intact for resubmit');
  });

  it('no-ops on a non-permutation (duplicated card) — queue intact', () => {
    const G = makeTestGameState({ deck: [A, B, C], pendingReorderChoices: [reorderEntry([A, B, C])] });
    resolveReorderChoice(makeMoveContext(G), { orderedCardIds: [A, A, B] });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [A, B, C], 'deck unchanged');
    assert.equal(G.pendingReorderChoices!.length, 1, 'queue intact');
  });

  it('no-ops on a foreign card not in the parked remainder — queue intact', () => {
    const G = makeTestGameState({ deck: [A, B, C], pendingReorderChoices: [reorderEntry([A, B, C])] });
    resolveReorderChoice(makeMoveContext(G), { orderedCardIds: [A, B, UNDER] });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [A, B, C], 'deck unchanged');
    assert.equal(G.pendingReorderChoices!.length, 1, 'queue intact');
  });

  it('no-ops on a wrong playerID — queue intact', () => {
    const G = makeTestGameState({ deck: [A, B, C], pendingReorderChoices: [reorderEntry([A, B, C])] });
    resolveReorderChoice(makeMoveContext(G, '1'), { orderedCardIds: [C, B, A] });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [A, B, C], 'deck unchanged');
    assert.equal(G.pendingReorderChoices!.length, 1, 'queue intact');
  });

  it('no-ops on an empty queue', () => {
    const G = makeTestGameState({ deck: [A, B, C], pendingReorderChoices: [] });
    resolveReorderChoice(makeMoveContext(G), { orderedCardIds: [C, B, A] });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [A, B, C], 'deck unchanged');
  });

  it('no-ops on a non-array / empty orderedCardIds', () => {
    const G = makeTestGameState({ deck: [A, B, C], pendingReorderChoices: [reorderEntry([A, B, C])] });
    resolveReorderChoice(makeMoveContext(G), { orderedCardIds: [] });
    assert.equal(G.pendingReorderChoices!.length, 1, 'empty selection is a no-op');
    resolveReorderChoice(makeMoveContext(G), { orderedCardIds: undefined as unknown as CardExtId[] });
    assert.equal(G.pendingReorderChoices!.length, 1, 'non-array is a no-op');
  });

  it('no-ops when the deck top has drifted from the parked remainder (defense-in-depth)', () => {
    // parked [A, B, C] but the live deck top is [A, B] — the block-all guard should
    // prevent this; if it ever regresses, the resolve must not scramble the deck.
    const G = makeTestGameState({ deck: [A, B], pendingReorderChoices: [reorderEntry([A, B, C])] });
    resolveReorderChoice(makeMoveContext(G), { orderedCardIds: [C, B, A] });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [A, B], 'deck unchanged on drift');
    assert.equal(G.pendingReorderChoices!.length, 1, 'queue intact');
  });

  it('hasPendingReorderChoice reflects the queue', () => {
    assert.equal(hasPendingReorderChoice(makeTestGameState()), false, 'undefined queue → false');
    assert.equal(hasPendingReorderChoice(makeTestGameState({ pendingReorderChoices: [] })), false, 'empty queue → false');
    assert.equal(hasPendingReorderChoice(makeTestGameState({ pendingReorderChoices: [reorderEntry([A, B])] })), true, 'non-empty → true');
  });

  it('block-all: playCard is a no-op while a reorder choice is pending (AC-3)', () => {
    const G = makeTestGameState({ deck: [A, B, C], pendingReorderChoices: [reorderEntry([A, B, C])] });
    // playCard must no-op (the block-all guard); the deck/queue stay untouched.
    playCard(makeMoveContext(G) as never, { cardId: A } as never);
    assert.deepStrictEqual(G.playerZones['0']!.deck, [A, B, C], 'deck frozen while pending');
    assert.equal(G.pendingReorderChoices!.length, 1, 'choice still pending after a blocked action');
  });
});
