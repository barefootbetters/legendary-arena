/**
 * Tests for buildOperatorView (WP-802 / EC-839 / D-24689 §4).
 *
 * The operator projection is the admin's whole-board read of an operator match.
 * These tests pin that it exists only for an operator match, reveals every zone
 * in stored order (index 0 next), counts Wounds per zone, never aliases `G`, and
 * is deterministic.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildOperatorView } from './operatorView.build.js';
import { buildInitialGameState, WOUND_EXT_ID } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader } from '../test/fixtureBuilders.js';
import type { MatchConfiguration, LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { UICardDisplay } from './uiState.types.js';
import type { OperatorBuildContext } from './operatorView.types.js';

const OPERATOR_CONTEXT: OperatorBuildContext = { phase: 'play', turn: 3, currentPlayer: '0' };

/**
 * Creates a valid test match configuration, flagged as an operator match when
 * `isOperatorMatch` is true.
 */
function createTestConfig(isOperatorMatch: boolean): MatchConfiguration {
  const config: MatchConfiguration = {
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
  return isOperatorMatch ? { ...config, isDebugMatch: true } : config;
}

/**
 * Builds a two-seat match state through the real setup path.
 */
function createGameState(isOperatorMatch: boolean): LegendaryGameState {
  const registry = { ...makeCardRegistryReader(), listCards: () => [] };
  return buildInitialGameState(createTestConfig(isOperatorMatch), registry, makeMockCtx());
}

/**
 * Builds a display entry for a test card.
 */
function display(extId: string): UICardDisplay {
  return { extId, name: `Card ${extId}`, imageUrl: `https://images.example/${extId}.webp`, cost: 1 };
}

/**
 * Builds an operator-match state with known, deliberately ordered contents in
 * every zone the view reads. Seat '1' is inserted before seat '0' so the
 * sort-by-player-id rule is observable.
 */
function createKnownOperatorState(): LegendaryGameState {
  const gameState = createGameState(true);
  gameState.playerZones = {
    '1': {
      deck: ['p1-deck-a', WOUND_EXT_ID],
      hand: ['p1-hand-a'],
      discard: [],
      inPlay: [],
      victory: ['p1-victory-a'],
      undercover: [],
    },
    '0': {
      deck: [WOUND_EXT_ID, 'p0-deck-a', WOUND_EXT_ID, WOUND_EXT_ID],
      hand: [WOUND_EXT_ID, 'p0-hand-a', WOUND_EXT_ID],
      discard: ['p0-discard-a', WOUND_EXT_ID],
      inPlay: ['p0-inplay-a'],
      victory: [],
      undercover: [],
    },
  };
  gameState.villainDeck = { ...gameState.villainDeck, deck: ['villain-next', 'villain-second'] };
  gameState.heroDeck = ['hero-next', 'hero-second'];
  gameState.mastermind = { ...gameState.mastermind, tacticsDeck: ['tactic-next', 'tactic-second'] };
  gameState.ko = ['ko-a'];
  gameState.escapedPile = ['escaped-a'];
  gameState.counters = { schemeTwistCount: 2, escapedVillains: 1 };
  gameState.cardDisplayData = {
    'p0-hand-a': display('p0-hand-a'),
    'villain-next': display('villain-next'),
    'ko-a': display('ko-a'),
    'not-in-the-view': display('not-in-the-view'),
  };
  return gameState;
}

describe('buildOperatorView (WP-802 / D-24689)', () => {
  it('returns null for a normal match', () => {
    assert.equal(buildOperatorView(createGameState(false), OPERATOR_CONTEXT), null);
  });

  it('returns every seat\'s five zones in stored order, sorted by player id', () => {
    const view = buildOperatorView(createKnownOperatorState(), OPERATOR_CONTEXT);
    assert.ok(view !== null);
    assert.deepEqual(view.seats.map((seat) => seat.playerId), ['0', '1']);
    const seatZero = view.seats[0]!;
    assert.deepEqual(seatZero.deckTopFirst, [WOUND_EXT_ID, 'p0-deck-a', WOUND_EXT_ID, WOUND_EXT_ID]);
    assert.deepEqual(seatZero.hand, [WOUND_EXT_ID, 'p0-hand-a', WOUND_EXT_ID]);
    assert.deepEqual(seatZero.discard, ['p0-discard-a', WOUND_EXT_ID]);
    assert.deepEqual(seatZero.inPlay, ['p0-inplay-a']);
    assert.deepEqual(seatZero.victory, []);
    assert.deepEqual(view.seats[1]!.deckTopFirst, ['p1-deck-a', WOUND_EXT_ID]);
    assert.deepEqual(view.seats[1]!.victory, ['p1-victory-a']);
  });

  it('counts Wounds separately in hand, discard and deck (the D-24684 case)', () => {
    const view = buildOperatorView(createKnownOperatorState(), OPERATOR_CONTEXT);
    assert.ok(view !== null);
    assert.deepEqual(view.seats[0]!.woundsByZone, { deck: 3, hand: 2, discard: 1, inPlay: 0, victory: 0 });
    assert.deepEqual(view.seats[1]!.woundsByZone, { deck: 1, hand: 0, discard: 0, inPlay: 0, victory: 0 });
  });

  it('returns the three decks top-first, the supply counts, the KO and escaped piles, and a copy of the counters', () => {
    const gameState = createKnownOperatorState();
    const view = buildOperatorView(gameState, OPERATOR_CONTEXT);
    assert.ok(view !== null);
    assert.deepEqual(view.villainDeckTopFirst, ['villain-next', 'villain-second']);
    assert.deepEqual(view.heroDeckTopFirst, ['hero-next', 'hero-second']);
    assert.deepEqual(view.mastermindTacticsTopFirst, ['tactic-next', 'tactic-second']);
    assert.deepEqual(view.supplyCounts, {
      wounds: gameState.piles.wounds.length,
      bystanders: gameState.piles.bystanders.length,
      officers: gameState.piles.officers.length,
      sidekicks: gameState.piles.sidekicks.length,
    });
    assert.equal(view.supplyCounts.wounds, 15, 'the Wound supply is the setup woundsCount');
    assert.deepEqual(view.koPile, ['ko-a']);
    assert.deepEqual(view.escapedPile, ['escaped-a']);
    assert.equal(view.currentStage, gameState.currentStage);
    assert.deepEqual(view.counters, { schemeTwistCount: 2, escapedVillains: 1 });
    (view.counters as Record<string, number>).schemeTwistCount = 99;
    assert.equal(gameState.counters.schemeTwistCount, 2, 'mutating the view counters leaves G.counters unchanged');
  });

  it('holds display data for exactly the ids that appear in the view', () => {
    const view = buildOperatorView(createKnownOperatorState(), OPERATOR_CONTEXT);
    assert.ok(view !== null);
    assert.deepEqual(Object.keys(view.cardDisplay).sort(), ['ko-a', 'p0-hand-a', 'villain-next']);
    assert.deepEqual(view.cardDisplay['ko-a'], display('ko-a'));
  });

  it('carries the unfiltered UIState as board, with the operator-match flag', () => {
    const view = buildOperatorView(createKnownOperatorState(), OPERATOR_CONTEXT);
    assert.ok(view !== null);
    assert.equal(view.board.isDebugMatch, true);
    assert.equal(view.board.game.activePlayerId, '0');
    const seatOneHand = view.board.players.find((player) => player.playerId === '1')?.handCards;
    assert.deepEqual(seatOneHand, ['p1-hand-a'], 'board is unfiltered: another seat\'s hand is visible');
  });

  it('never aliases G: mutating the returned arrays leaves G unchanged', () => {
    const gameState = createKnownOperatorState();
    const before = JSON.stringify(gameState);
    const view = buildOperatorView(gameState, OPERATOR_CONTEXT);
    assert.ok(view !== null);
    const mutableLists: CardExtId[][] = [
      view.seats[0]!.deckTopFirst as CardExtId[],
      view.seats[0]!.hand as CardExtId[],
      view.seats[0]!.discard as CardExtId[],
      view.seats[0]!.inPlay as CardExtId[],
      view.seats[1]!.victory as CardExtId[],
      view.villainDeckTopFirst as CardExtId[],
      view.heroDeckTopFirst as CardExtId[],
      view.mastermindTacticsTopFirst as CardExtId[],
      view.koPile as CardExtId[],
      view.escapedPile as CardExtId[],
    ];
    for (const list of mutableLists) {
      list.push('mutation');
      list.reverse();
    }
    (view.cardDisplay['ko-a'] as { name: string }).name = 'mutated';
    assert.equal(JSON.stringify(gameState), before);
  });

  it('is deterministic: two calls on the same G deep-equal', () => {
    const gameState = createKnownOperatorState();
    assert.deepEqual(
      buildOperatorView(gameState, OPERATOR_CONTEXT),
      buildOperatorView(gameState, OPERATOR_CONTEXT),
    );
  });

  // why: WP-806 / D-24713 §5 — setAsideCounts is optional and omit-when-off, so an
  // operator match that never set a supply card aside has no key at all.
  it('has no setAsideCounts key while G.operatorSetAside is absent', () => {
    const view = buildOperatorView(createGameState(true), OPERATOR_CONTEXT);
    assert.ok(view !== null);
    assert.equal(Object.hasOwn(view, 'setAsideCounts'), false);
  });

  it('counts each pile of G.operatorSetAside exactly, and 0 for a pile never set aside', () => {
    const gameState = createGameState(true);
    gameState.operatorSetAside = { wounds: ['pile-wound', 'pile-wound', 'pile-wound'], officers: [] };
    const view = buildOperatorView(gameState, OPERATOR_CONTEXT);
    assert.ok(view !== null);
    assert.deepEqual(view.setAsideCounts, { wounds: 3, bystanders: 0, officers: 0, sidekicks: 0 });
  });
});
