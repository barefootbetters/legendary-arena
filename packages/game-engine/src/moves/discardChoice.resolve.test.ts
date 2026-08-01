/**
 * Tests for the resolveDiscardChoice move (WP-476 / D-24284) and the
 * hasPendingDiscardChoice block-all predicate.
 *
 * Covers: resolve discards exactly the chosen cards down to the limit + front-pop
 * (AC-2); a wrong discard count (over/under), a card not in hand, a wrong
 * playerID, an empty queue, and a non-array/empty cardIds are silent no-ops that
 * leave the queue byte-identical; hasPendingDiscardChoice; a block-all no-op on an
 * action move while a discard choice is pending (AC-4).
 *
 * Uses node:test + node:assert only. No boardgame.io testing imports.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDiscardChoice,
  hasPendingDiscardChoice,
} from './discardChoice.resolve.js';
import { playCard } from './coreMoves.impl.js';
import type { LegendaryGameState, PendingDiscardChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

const A = 'core/a#0' as CardExtId;
const B = 'core/b#0' as CardExtId;
const C = 'core/c#0' as CardExtId;
const D = 'core/d#0' as CardExtId;
const E = 'core/e#0' as CardExtId;

/**
 * Creates a minimal LegendaryGameState for testing the discard-to-limit flow.
 *
 * @param overrides - Selective overrides for player "0" hand/discard, the pending
 *   discard queue, and current stage.
 */
function makeTestGameState(
  overrides: {
    hand?: CardExtId[];
    discard?: CardExtId[];
    pendingDiscardChoices?: PendingDiscardChoice[];
    currentStage?: LegendaryGameState['currentStage'];
  } = {},
): LegendaryGameState {
  const state = {
    matchConfiguration: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    currentStage: overrides.currentStage ?? 'start',
    playerZones: {
      '0': {
        deck: [],
        hand: overrides.hand ?? [],
        discard: overrides.discard ?? [],
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
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: ['tactic-0'] as CardExtId[],
      tacticsDefeated: [],
      strikePile: [],
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

  if (overrides.pendingDiscardChoices !== undefined) {
    state.pendingDiscardChoices = overrides.pendingDiscardChoices;
  }
  return state;
}

/** Builds a move context for the move under test. */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveDiscardChoice>[0] {
  return {
    G: gameState,
    ctx: {
      numPlayers: 1,
      currentPlayer: playerId,
      phase: 'play',
      turn: 1,
      playOrder: [playerId],
      playOrderPos: 0,
      activePlayers: null,
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
  } as unknown as Parameters<typeof resolveDiscardChoice>[0];
}

function discardChoice(limit: number = 4, playerID: string = '0'): PendingDiscardChoice {
  return { choiceType: 'discard-to-limit', playerID, limit };
}

describe('hasPendingDiscardChoice (WP-476 / D-24284)', () => {
  it('is false for undefined and empty queues, true for a non-empty queue', () => {
    assert.equal(hasPendingDiscardChoice(makeTestGameState()), false);
    assert.equal(hasPendingDiscardChoice(makeTestGameState({ pendingDiscardChoices: [] })), false);
    assert.equal(
      hasPendingDiscardChoice(makeTestGameState({ pendingDiscardChoices: [discardChoice()] })),
      true,
    );
  });
});

describe('resolveDiscardChoice (WP-476 / D-24284)', () => {
  it('discards exactly the chosen cards down to the limit and front-pops the queue (AC-2)', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E],
      pendingDiscardChoices: [discardChoice(4)],
    });
    resolveDiscardChoice(makeMoveContext(G), { cardIds: [B] });
    assert.deepStrictEqual(G.playerZones['0']!.hand, [A, C, D, E], 'the chosen card left the hand');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [B], 'the chosen card was appended to discard');
    assert.equal(G.pendingDiscardChoices?.length, 0, 'the queue was front-popped');
  });

  it('discards multiple chosen cards when more than one over the limit', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E],
      discard: [A],
      pendingDiscardChoices: [discardChoice(3)],
    });
    resolveDiscardChoice(makeMoveContext(G), { cardIds: [A, E] });
    assert.deepStrictEqual(G.playerZones['0']!.hand, [B, C, D], 'both chosen cards left the hand');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [A, A, E], 'both appended after the existing discard');
    assert.equal(G.pendingDiscardChoices?.length, 0);
  });

  it('is a silent no-op when the count discards to MORE than the limit (queue intact)', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E],
      pendingDiscardChoices: [discardChoice(4)],
    });
    // why: discarding 2 would leave 3 (< limit 4) — must discard EXACTLY to the limit.
    resolveDiscardChoice(makeMoveContext(G), { cardIds: [A, B] });
    assert.deepStrictEqual(G.playerZones['0']!.hand, [A, B, C, D, E], 'hand unchanged');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'discard unchanged');
    assert.equal(G.pendingDiscardChoices?.length, 1, 'the queue is intact for resubmit');
  });

  it('is a silent no-op when the count discards to FEWER than the limit (queue intact)', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E],
      pendingDiscardChoices: [discardChoice(4)],
    });
    // why: discarding 0 (empty) leaves 5 (> limit 4). Empty cardIds is rejected at
    // arg validation, but even a non-empty under-discard must no-op.
    resolveDiscardChoice(makeMoveContext(G), { cardIds: [] });
    assert.deepStrictEqual(G.playerZones['0']!.hand, [A, B, C, D, E], 'hand unchanged');
    assert.equal(G.pendingDiscardChoices?.length, 1);
  });

  it('is a silent no-op when a chosen card is NOT in the hand (queue intact)', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E],
      pendingDiscardChoices: [discardChoice(4)],
    });
    resolveDiscardChoice(makeMoveContext(G), { cardIds: ['core/not-held#0' as CardExtId] });
    assert.deepStrictEqual(G.playerZones['0']!.hand, [A, B, C, D, E], 'hand unchanged — card not held');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'nothing discarded');
    assert.equal(G.pendingDiscardChoices?.length, 1, 'the queue is intact');
  });

  it('is a silent no-op on a wrong playerID (queue intact)', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E],
      pendingDiscardChoices: [discardChoice(4, '0')],
    });
    resolveDiscardChoice(makeMoveContext(G, '1'), { cardIds: [A] });
    assert.deepStrictEqual(G.playerZones['0']!.hand, [A, B, C, D, E]);
    assert.equal(G.pendingDiscardChoices?.length, 1, 'front.playerID mismatch leaves the queue intact');
  });

  it('is a silent no-op on an empty queue', () => {
    const G = makeTestGameState({ hand: [A, B, C, D, E], pendingDiscardChoices: [] });
    resolveDiscardChoice(makeMoveContext(G), { cardIds: [A] });
    assert.deepStrictEqual(G.playerZones['0']!.hand, [A, B, C, D, E]);
  });

  it('is a silent no-op on a non-array / empty cardIds', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E],
      pendingDiscardChoices: [discardChoice(4)],
    });
    resolveDiscardChoice(makeMoveContext(G), { cardIds: undefined as unknown as CardExtId[] });
    assert.equal(G.pendingDiscardChoices?.length, 1, 'undefined cardIds is a no-op');
    resolveDiscardChoice(makeMoveContext(G), { cardIds: [] });
    assert.equal(G.pendingDiscardChoices?.length, 1, 'empty cardIds is a no-op');
  });
});

describe('block-all guard — a pending discard choice freezes action moves (AC-4)', () => {
  it('playCard is a silent no-op while a discard choice is pending', () => {
    const G = makeTestGameState({
      hand: [A, B, C, D, E],
      pendingDiscardChoices: [discardChoice(4)],
      currentStage: 'main',
    });
    playCard(makeMoveContext(G) as never, { cardId: A } as never);
    assert.deepStrictEqual(
      G.playerZones['0']!.hand,
      [A, B, C, D, E],
      'playCard did not move any card while the discard choice is pending',
    );
    assert.equal(G.pendingDiscardChoices?.length, 1, 'the discard choice is still pending');
  });
});
