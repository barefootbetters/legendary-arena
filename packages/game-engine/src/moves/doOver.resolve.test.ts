/**
 * Tests for the resolveDoOver move (WP-681 / D-24498), the hasPendingDoOver predicate,
 * and the block-all guard that freezes the board while a Do-Over accept/decline choice is
 * pending.
 *
 * Covers: accept → discard the ENTIRE hand + draw a FIXED 4 + front-pop; decline → pop with
 * no discard, no draw; invalid arg shapes (both/neither) → no-op (queue intact); wrong
 * playerID → no-op; empty queue → no-op; the block-all guard (drawCards no-ops while pending).
 *
 * Uses node:test + node:assert only.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDoOver,
  hasPendingDoOver,
  DO_OVER_DRAW_COUNT,
} from './doOver.resolve.js';
import { drawCards } from './coreMoves.impl.js';
import type { LegendaryGameState, PendingDoOver } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/** Creates a minimal LegendaryGameState for testing the Do-Over flow. */
function makeTestGameState(
  overrides: {
    hand?: CardExtId[];
    discard?: CardExtId[];
    deck?: CardExtId[];
    pendingDoOverChoices?: PendingDoOver[];
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
    turnEconomy: {
      attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0,
      woundsDrawn: 0, cardsDrawn: 0,
    },
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

  if (overrides.pendingDoOverChoices !== undefined) {
    state.pendingDoOverChoices = overrides.pendingDoOverChoices;
  }
  return state;
}

/** Builds a move context for resolveDoOver (random.Shuffle reverses to prove it ran). */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveDoOver>[0] {
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
  } as unknown as Parameters<typeof resolveDoOver>[0];
}

describe('resolveDoOver — accept arm (WP-681 / D-24498)', () => {
  it('discards the ENTIRE hand and draws a FIXED 4, then front-pops', () => {
    const gameState = makeTestGameState({
      hand: ['h1', 'h2', 'h3'] as CardExtId[],
      deck: ['d1', 'd2', 'd3', 'd4', 'd5'] as CardExtId[],
      pendingDoOverChoices: [{ playerID: '0' }],
    });
    resolveDoOver(makeMoveContext(gameState), { accept: true });

    const zones = gameState.playerZones['0']!;
    // draw is a FIXED 4, independent of the 3 discarded
    assert.equal(zones.hand.length, DO_OVER_DRAW_COUNT);
    // the 3 original hand cards are now in discard (routed via the chokepoint)
    for (const original of ['h1', 'h2', 'h3']) {
      assert.ok(zones.discard.includes(original as CardExtId), `${original} discarded`);
    }
    // none of the original hand cards remain in hand
    for (const original of ['h1', 'h2', 'h3']) {
      assert.ok(!zones.hand.includes(original as CardExtId), `${original} not in hand`);
    }
    // queue front-popped
    assert.equal(hasPendingDoOver(gameState), false);
  });

  it('draws a fixed 4 even from an empty starting hand (nothing to discard)', () => {
    const gameState = makeTestGameState({
      hand: [],
      deck: ['d1', 'd2', 'd3', 'd4'] as CardExtId[],
      pendingDoOverChoices: [{ playerID: '0' }],
    });
    resolveDoOver(makeMoveContext(gameState), { accept: true });
    assert.equal(gameState.playerZones['0']!.hand.length, 4);
    assert.equal(hasPendingDoOver(gameState), false);
  });
});

describe('resolveDoOver — decline arm (WP-681 / D-24498)', () => {
  it('pops the queue with no discard and no draw', () => {
    const gameState = makeTestGameState({
      hand: ['h1', 'h2'] as CardExtId[],
      deck: ['d1', 'd2', 'd3', 'd4'] as CardExtId[],
      pendingDoOverChoices: [{ playerID: '0' }],
    });
    resolveDoOver(makeMoveContext(gameState), { decline: true });
    const zones = gameState.playerZones['0']!;
    assert.deepEqual(zones.hand, ['h1', 'h2']);
    assert.equal(zones.deck.length, 4);
    assert.equal(hasPendingDoOver(gameState), false);
  });
});

describe('resolveDoOver — invalid inputs are silent no-ops', () => {
  it('both flags present → no-op, queue intact', () => {
    const gameState = makeTestGameState({
      hand: ['h1'] as CardExtId[], deck: ['d1', 'd2', 'd3', 'd4'] as CardExtId[],
      pendingDoOverChoices: [{ playerID: '0' }],
    });
    resolveDoOver(makeMoveContext(gameState), { accept: true, decline: true } as never);
    assert.equal(hasPendingDoOver(gameState), true);
    assert.deepEqual(gameState.playerZones['0']!.hand, ['h1']);
  });

  it('wrong playerID → no-op, queue intact', () => {
    const gameState = makeTestGameState({
      hand: ['h1'] as CardExtId[], deck: ['d1', 'd2', 'd3', 'd4'] as CardExtId[],
      pendingDoOverChoices: [{ playerID: '0' }],
    });
    resolveDoOver(makeMoveContext(gameState, '1'), { accept: true });
    assert.equal(hasPendingDoOver(gameState), true);
  });

  it('empty queue → no-op, never throws', () => {
    const gameState = makeTestGameState({ hand: ['h1'] as CardExtId[] });
    assert.doesNotThrow(() => resolveDoOver(makeMoveContext(gameState), { accept: true }));
    assert.equal(hasPendingDoOver(gameState), false);
  });
});

describe('hasPendingDoOver block-all guard', () => {
  it('drawCards no-ops while a Do-Over choice is pending', () => {
    const gameState = makeTestGameState({
      hand: [] as CardExtId[],
      deck: ['d1', 'd2', 'd3'] as CardExtId[],
      pendingDoOverChoices: [{ playerID: '0' }],
      currentStage: 'start',
    });
    drawCards(makeMoveContext(gameState) as never, { count: 1 } as never);
    // the guard froze the board: no card drawn
    assert.equal(gameState.playerZones['0']!.hand.length, 0);
  });
});
