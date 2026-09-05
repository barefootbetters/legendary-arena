/**
 * recruitOfficer move tests (WP-648 / EC-683 / D-24460).
 *
 * Verifies recruitOfficer follows the three-step validation contract, gates to
 * the main stage, moves the top S.H.I.E.L.D. Officer token from the shared
 * supply to the current player's discard, spends 3 recruit, and no-ops (never
 * throws) on an empty supply / insufficient recruit / wrong stage / heal-lock /
 * parked interactive choice.
 *
 * Uses node:test and node:assert only. Uses makeMockMoveContext. No boardgame.io
 * imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recruitOfficer, OFFICER_RECRUIT_COST } from './recruitOfficer.js';
import type { LegendaryGameState } from '../types.js';
import { SHIELD_OFFICER_EXT_ID } from '../setup/pilesInit.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { MockMoveContext } from '../test/mockMoveContext.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Mock G factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for officer-recruit tests. Player 0 is
 * current with the given recruit points; the Officer supply and cardStats are
 * seeded per case.
 */
function createMockGameState(options?: {
  officers?: string[];
  recruit?: number;
  currentStage?: LegendaryGameState['currentStage'];
  cardStats?: LegendaryGameState['cardStats'];
  hasHealedThisTurn?: boolean;
  pendingKoHeroChoices?: LegendaryGameState['pendingKoHeroChoices'];
}): LegendaryGameState {
  const config = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: ['test-villain-group'],
    henchmanGroupIds: ['test-henchman-group'],
    heroDeckIds: ['test-hero-deck'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };

  return {
    matchConfiguration: config,
    selection: {
      schemeId: config.schemeId,
      mastermindId: config.mastermindId,
      villainGroupIds: [...config.villainGroupIds],
      henchmanGroupIds: [...config.henchmanGroupIds],
      heroDeckIds: [...config.heroDeckIds],
    },
    currentStage: options?.currentStage ?? 'main',
    playerZones: {
      '0': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    piles: { ...makeGlobalPiles(), officers: options?.officers ?? [] },
    messages: [],
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    turnEconomy: { ...makeTurnEconomy(), recruit: options?.recruit ?? 0 },
    cardStats: options?.cardStats ?? {},
    mastermind: { ...makeMastermindState(),
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: [],
      tacticsDefeated: [],
    },
    city: initializeCity(),
    hq: initializeHq(),
    heroDeck: [],
    heroAbilityHooks: [],
    hasHealedThisTurn: options?.hasHealedThisTurn ?? false,
    pendingKoHeroChoices: options?.pendingKoHeroChoices ?? [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  };
}

function createMockMoveContext(gameState: LegendaryGameState): MockMoveContext {
  return makeMockMoveContext(gameState);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('recruitOfficer', () => {
  it('moves the top Officer token to the player discard on a funded main-stage recruit', () => {
    const gameState = createMockGameState({ officers: [SHIELD_OFFICER_EXT_ID], recruit: 3 });
    const moveContext = createMockMoveContext(gameState);

    recruitOfficer(moveContext, {} as never);

    assert.deepEqual(moveContext.G.piles.officers, [], 'officer supply must be empty after recruit');
    assert.ok(
      moveContext.G.playerZones['0']!.discard.includes(SHIELD_OFFICER_EXT_ID),
      'the Officer token must land in player 0 discard',
    );
  });

  it('spends the officer recruit cost (3) and marks the player as having acted', () => {
    const gameState = createMockGameState({ officers: [SHIELD_OFFICER_EXT_ID], recruit: 5 });
    const moveContext = createMockMoveContext(gameState);

    recruitOfficer(moveContext, {} as never);

    // why: getAvailableRecruit = recruit - spentRecruit; 5 - 3 = 2 remaining.
    assert.equal(moveContext.G.turnEconomy.spentRecruit, OFFICER_RECRUIT_COST, 'spentRecruit must be 3');
    assert.equal(moveContext.G.hasActedThisTurn, true, 'a successful recruit sets hasActedThisTurn (D-24180)');
  });

  it('emits exactly one supply-recruit log line', () => {
    const gameState = createMockGameState({ officers: [SHIELD_OFFICER_EXT_ID], recruit: 3 });
    const moveContext = createMockMoveContext(gameState);
    const before = moveContext.G.messages.length;

    recruitOfficer(moveContext, {} as never);

    assert.equal(moveContext.G.messages.length, before + 1, 'exactly one log line pushed');
  });

  it('insufficient recruit (2 < 3): no mutation', () => {
    const gameState = createMockGameState({ officers: [SHIELD_OFFICER_EXT_ID], recruit: 2 });
    const moveContext = createMockMoveContext(gameState);

    recruitOfficer(moveContext, {} as never);

    assert.deepEqual(moveContext.G.piles.officers, [SHIELD_OFFICER_EXT_ID], 'supply unchanged');
    assert.deepEqual(moveContext.G.playerZones['0']!.discard, [], 'discard unchanged');
    assert.equal(moveContext.G.turnEconomy.spentRecruit, 0, 'no recruit spent');
  });

  it('gates on cost (3), not the officer play-value (2): recruit=2 with cardStats cost 3 fails', () => {
    // why: guards against the reported bug — the UI showed the officer play-value
    // (recruit: 2) as if it were the buy cost; the engine must gate on cost (3).
    const gameState = createMockGameState({
      officers: [SHIELD_OFFICER_EXT_ID],
      recruit: 2,
      cardStats: { [SHIELD_OFFICER_EXT_ID]: { attack: 0, recruit: 2, cost: 3, fightCost: 0, fightCostMode: 'static', fightCostBase: 0 } },
    });
    const moveContext = createMockMoveContext(gameState);

    recruitOfficer(moveContext, {} as never);

    assert.deepEqual(moveContext.G.piles.officers, [SHIELD_OFFICER_EXT_ID], 'supply unchanged — cost 3 not affordable at recruit 2');
  });

  it('sources the cost from cardStats when present (cost 3 exactly affordable)', () => {
    const gameState = createMockGameState({
      officers: [SHIELD_OFFICER_EXT_ID],
      recruit: 3,
      cardStats: { [SHIELD_OFFICER_EXT_ID]: { attack: 0, recruit: 2, cost: 3, fightCost: 0, fightCostMode: 'static', fightCostBase: 0 } },
    });
    const moveContext = createMockMoveContext(gameState);

    recruitOfficer(moveContext, {} as never);

    assert.deepEqual(moveContext.G.piles.officers, [], 'recruit succeeds when cardStats cost 3 == available 3');
  });

  it('empty officer supply: no mutation, no throw', () => {
    const gameState = createMockGameState({ officers: [], recruit: 5 });
    const moveContext = createMockMoveContext(gameState);

    recruitOfficer(moveContext, {} as never);

    assert.deepEqual(moveContext.G.playerZones['0']!.discard, [], 'discard unchanged on empty supply');
    assert.equal(moveContext.G.turnEconomy.spentRecruit, 0, 'no recruit spent on empty supply');
  });

  it('wrong stage (start): no mutation', () => {
    const gameState = createMockGameState({ officers: [SHIELD_OFFICER_EXT_ID], recruit: 3, currentStage: 'start' });
    const moveContext = createMockMoveContext(gameState);

    recruitOfficer(moveContext, {} as never);

    assert.deepEqual(moveContext.G.piles.officers, [SHIELD_OFFICER_EXT_ID], 'supply unchanged off the main stage');
  });

  it('heal-lock (D-24180): a player who healed this turn cannot recruit an Officer', () => {
    const gameState = createMockGameState({ officers: [SHIELD_OFFICER_EXT_ID], recruit: 3, hasHealedThisTurn: true });
    const moveContext = createMockMoveContext(gameState);

    recruitOfficer(moveContext, {} as never);

    assert.deepEqual(moveContext.G.piles.officers, [SHIELD_OFFICER_EXT_ID], 'supply unchanged under the heal-lock');
  });

  it('block-all: a parked KO-a-Hero choice freezes the recruit', () => {
    const gameState = createMockGameState({
      officers: [SHIELD_OFFICER_EXT_ID],
      recruit: 3,
      pendingKoHeroChoices: [{ playerId: '0', sourceCardId: 'x', count: 1 }] as never,
    });
    const moveContext = createMockMoveContext(gameState);

    recruitOfficer(moveContext, {} as never);

    assert.deepEqual(moveContext.G.piles.officers, [SHIELD_OFFICER_EXT_ID], 'supply unchanged while a choice is pending');
  });

  it('falls back to OFFICER_RECRUIT_COST when cardStats has no officer entry', () => {
    const gameState = createMockGameState({ officers: [SHIELD_OFFICER_EXT_ID], recruit: 3, cardStats: {} });
    const moveContext = createMockMoveContext(gameState);

    recruitOfficer(moveContext, {} as never);

    assert.deepEqual(moveContext.G.piles.officers, [], 'recruit succeeds via the fallback constant');
  });

  it('G stays JSON-serializable after a recruit', () => {
    const gameState = createMockGameState({ officers: [SHIELD_OFFICER_EXT_ID], recruit: 3 });
    const moveContext = createMockMoveContext(gameState);

    recruitOfficer(moveContext, {} as never);

    assert.doesNotThrow(() => JSON.stringify(moveContext.G), 'G must remain JSON-serializable');
  });
});
