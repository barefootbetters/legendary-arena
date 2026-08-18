/**
 * Wound "Healing" ability tests for WP-379 / EC-408 / D-24176 / D-24177.
 *
 * Verifies healWounds follows the non-core move contract: it gates to the main
 * stage, respects the block-all pending-choice guards and the "has not acted this
 * turn" precondition, KOs every Wound from the current player's hand into G.ko,
 * sets hasHealedThisTurn, and leaves G untouched on every blocked/empty call. Also
 * verifies the mutual exclusion both ways: a healed player cannot fight or recruit,
 * and a player who fought or recruited cannot heal.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { healWounds, hasHealedThisTurn } from './healWounds.js';
import { fightVillain } from './fightVillain.js';
import { recruitHero } from './recruitHero.js';
import { fightMastermind } from './fightMastermind.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState } from '../types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones } from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// Mock G factory + move context
// ---------------------------------------------------------------------------

interface HealStateOptions {
  hand?: string[];
  ko?: string[];
  currentStage?: LegendaryGameState['currentStage'];
  hasActedThisTurn?: boolean;
  hasHealedThisTurn?: boolean;
  city?: (string | null)[];
  hq?: (string | null)[];
  tacticsDeck?: string[];
  cardStats?: LegendaryGameState['cardStats'];
  turnEconomy?: LegendaryGameState['turnEconomy'];
  pendingKoHeroChoices?: LegendaryGameState['pendingKoHeroChoices'];
}

/**
 * Builds a LegendaryGameState complete enough for healWounds plus the three
 * fight/recruit moves' early paths. Player 0 owns all zones; the stage defaults
 * to main.
 */
function createHealState(options?: HealStateOptions): LegendaryGameState {
  const config = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: [],
    henchmanGroupIds: [],
    heroDeckIds: [],
    bystandersCount: 0,
    woundsCount: 0,
    officersCount: 0,
    sidekicksCount: 0,
  };

  const state: LegendaryGameState = {
    matchConfiguration: config,
    selection: {
      schemeId: config.schemeId,
      mastermindId: config.mastermindId,
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    currentStage: options?.currentStage ?? 'main',
    playerZones: {
      '0': { ...makePlayerZones(),
        deck: [],
        hand: options?.hand ?? [],
        discard: [],
        inPlay: [],
        victory: [],
      },
    },
    piles: { ...makeGlobalPiles(), bystanders: [], wounds: [], officers: [], sidekicks: [] },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: options?.ko ?? [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    cardKeywords: {},
    cardDisplayData: {},
    notableEvents: [],
    heroDeck: [],
    heroAbilityHooks: [],
    turnEconomy: options?.turnEconomy ?? {
      attack: 0,
      recruit: 0,
      spentAttack: 0,
      spentRecruit: 0,
      piercing: 0,
      woundsDrawn: 0,
    },
    cardStats: options?.cardStats ?? {},
    mastermind: { ...makeMastermindState(),
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: options?.tacticsDeck ?? [],
      tacticsDefeated: [],
      attachedBystanders: [],
    },
    city: options?.city ?? [null, null, null, null, null],
    hq: options?.hq ?? [null, null, null, null, null],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  };

  if (options?.hasActedThisTurn !== undefined) {
    state.hasActedThisTurn = options.hasActedThisTurn;
  }
  if (options?.hasHealedThisTurn !== undefined) {
    state.hasHealedThisTurn = options.hasHealedThisTurn;
  }
  if (options?.pendingKoHeroChoices !== undefined) {
    state.pendingKoHeroChoices = options.pendingKoHeroChoices;
  }

  return state;
}

/** Builds a move context bound to the given G for player 0's turn. */
function createMoveContext(gameState: LegendaryGameState) {
  return {
    G: gameState,
    ctx: {
      currentPlayer: '0',
      numPlayers: 1,
      phase: 'play',
      turn: 1,
      playOrder: ['0'],
      playOrderPos: 0,
    },
  } as unknown as Parameters<typeof healWounds>[0];
}

/** Counts how many entries in an array equal WOUND_EXT_ID. */
function countWounds(zone: readonly string[]): number {
  let total = 0;
  for (const cardId of zone) {
    if (cardId === WOUND_EXT_ID) total += 1;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Core Healing behavior
// ---------------------------------------------------------------------------

describe('healWounds — core behavior', () => {
  it('KOs every Wound from hand and keeps non-Wound cards', () => {
    const state = createHealState({
      hand: [WOUND_EXT_ID, 'hero-a', WOUND_EXT_ID, 'hero-b'],
    });
    healWounds(createMoveContext(state));

    assert.deepStrictEqual(state.playerZones['0']!.hand, ['hero-a', 'hero-b']);
    assert.strictEqual(countWounds(state.ko), 2);
    assert.strictEqual(state.ko.length, 2);
    assert.strictEqual(state.hasHealedThisTurn, true);
  });

  it('emits a healResolved notable event with the KO count (WP-381)', () => {
    const state = createHealState({ hand: [WOUND_EXT_ID, 'hero-a', WOUND_EXT_ID] });
    healWounds(createMoveContext(state));

    assert.strictEqual(state.notableEvents.length, 1);
    const event = state.notableEvents[0]!;
    assert.strictEqual(event.type, 'healResolved');
    // why: narrow the discriminated union before reading the variant fields.
    if (event.type === 'healResolved') {
      assert.strictEqual(event.playerId, '0');
      assert.strictEqual(event.woundsHealed, 2);
      assert.match(event.narrative, /KO'ing 2 Wound\(s\)/);
    }
    assert.doesNotThrow(() => JSON.stringify(state));
  });

  it('emits no notable event on a no-op heal (WP-381)', () => {
    const acted = createHealState({ hand: [WOUND_EXT_ID], hasActedThisTurn: true });
    healWounds(createMoveContext(acted));
    assert.strictEqual(acted.notableEvents.length, 0);
  });

  it('appends the KO\'d Wounds after any existing KO pile contents', () => {
    const state = createHealState({
      hand: [WOUND_EXT_ID],
      ko: ['already-ko'],
    });
    healWounds(createMoveContext(state));

    assert.deepStrictEqual(state.ko, ['already-ko', WOUND_EXT_ID]);
  });

  it('is a no-op when the hand holds no Wounds', () => {
    const state = createHealState({ hand: ['hero-a', 'hero-b'] });
    const before = JSON.stringify(state);
    healWounds(createMoveContext(state));

    assert.strictEqual(JSON.stringify(state), before);
    assert.notStrictEqual(state.hasHealedThisTurn, true);
  });

  it('is a no-op outside the main stage', () => {
    const state = createHealState({ hand: [WOUND_EXT_ID], currentStage: 'start' });
    const before = JSON.stringify(state);
    healWounds(createMoveContext(state));

    assert.strictEqual(JSON.stringify(state), before);
  });

  it('is a no-op when a pending choice is active (board frozen)', () => {
    const state = createHealState({
      hand: [WOUND_EXT_ID],
      pendingKoHeroChoices: [{ playerId: '0', eligibleZones: { hand: [], discard: [], inPlay: [] } }],
    });
    const before = JSON.stringify(state);
    healWounds(createMoveContext(state));

    assert.strictEqual(JSON.stringify(state), before);
  });

  it('leaves G JSON-serializable after a heal', () => {
    const state = createHealState({ hand: [WOUND_EXT_ID, 'hero-a'] });
    healWounds(createMoveContext(state));
    assert.doesNotThrow(() => JSON.stringify(state));
  });

  it('is deterministic — identical inputs produce an identical KO pile', () => {
    const first = createHealState({ hand: [WOUND_EXT_ID, 'hero-a', WOUND_EXT_ID] });
    const second = createHealState({ hand: [WOUND_EXT_ID, 'hero-a', WOUND_EXT_ID] });
    healWounds(createMoveContext(first));
    healWounds(createMoveContext(second));
    assert.deepStrictEqual(first.ko, second.ko);
    assert.deepStrictEqual(first.playerZones['0']!.hand, second.playerZones['0']!.hand);
  });
});

// ---------------------------------------------------------------------------
// Forward gate: acting bars Healing; acting sets the flag
// ---------------------------------------------------------------------------

describe('healWounds — acted-this-turn gate', () => {
  it('is a no-op when the player has already acted this turn', () => {
    const state = createHealState({ hand: [WOUND_EXT_ID], hasActedThisTurn: true });
    healWounds(createMoveContext(state));

    assert.strictEqual(countWounds(state.playerZones['0']!.hand), 1);
    assert.strictEqual(state.ko.length, 0);
    assert.notStrictEqual(state.hasHealedThisTurn, true);
  });

  it('a real recruit sets hasActedThisTurn, then Healing is barred', () => {
    const state = createHealState({
      hand: [WOUND_EXT_ID],
      hq: ['hero-x', null, null, null, null],
      cardStats: { 'hero-x': { attack: 0, recruit: 0, cost: 0, fightCost: 0, fightCostMode: 'static', fightCostBase: 0 } },
    });
    recruitHero(createMoveContext(state), { hqIndex: 0 });
    assert.strictEqual(state.hasActedThisTurn, true);

    healWounds(createMoveContext(state));
    assert.strictEqual(countWounds(state.playerZones['0']!.hand), 1, 'Wound must remain — cannot heal after recruiting');
  });

  it('a real villain fight sets hasActedThisTurn', () => {
    const state = createHealState({
      city: ['villain-x', null, null, null, null],
      cardStats: { 'villain-x': { attack: 0, recruit: 0, cost: 0, fightCost: 0, fightCostMode: 'static', fightCostBase: 0 } },
    });
    fightVillain(createMoveContext(state), { cityIndex: 0 });
    assert.strictEqual(state.hasActedThisTurn, true);
  });

  it('a real mastermind fight sets hasActedThisTurn', () => {
    const state = createHealState({
      tacticsDeck: ['tactic-1', 'tactic-2'],
      cardStats: { 'test-mastermind-base': { attack: 0, recruit: 0, cost: 0, fightCost: 0, fightCostMode: 'static', fightCostBase: 0 } },
    });
    fightMastermind(createMoveContext(state));
    assert.strictEqual(state.hasActedThisTurn, true);
  });
});

// ---------------------------------------------------------------------------
// Reverse lock: Healing bars fighting and recruiting
// ---------------------------------------------------------------------------

describe('healWounds — reverse lock after Healing', () => {
  it('hasHealedThisTurn predicate reflects the flag', () => {
    assert.strictEqual(hasHealedThisTurn(createHealState()), false);
    assert.strictEqual(hasHealedThisTurn(createHealState({ hasHealedThisTurn: true })), true);
  });

  it('fightVillain is a no-op after Healing', () => {
    const state = createHealState({
      hasHealedThisTurn: true,
      city: ['villain-x', null, null, null, null],
      cardStats: { 'villain-x': { attack: 0, recruit: 0, cost: 0, fightCost: 0, fightCostMode: 'static', fightCostBase: 0 } },
    });
    fightVillain(createMoveContext(state), { cityIndex: 0 });

    assert.strictEqual(state.city[0], 'villain-x', 'villain must remain in the City');
    assert.strictEqual(state.playerZones['0']!.victory.length, 0);
  });

  it('recruitHero is a no-op after Healing', () => {
    const state = createHealState({
      hasHealedThisTurn: true,
      hq: ['hero-x', null, null, null, null],
      cardStats: { 'hero-x': { attack: 0, recruit: 0, cost: 0, fightCost: 0, fightCostMode: 'static', fightCostBase: 0 } },
    });
    recruitHero(createMoveContext(state), { hqIndex: 0 });

    assert.strictEqual(state.hq[0], 'hero-x', 'hero must remain in the HQ');
    assert.strictEqual(state.playerZones['0']!.discard.length, 0);
  });

  it('fightMastermind is a no-op after Healing', () => {
    const state = createHealState({
      hasHealedThisTurn: true,
      tacticsDeck: ['tactic-1', 'tactic-2'],
      cardStats: { 'test-mastermind-base': { attack: 0, recruit: 0, cost: 0, fightCost: 0, fightCostMode: 'static', fightCostBase: 0 } },
    });
    fightMastermind(createMoveContext(state));

    assert.strictEqual(state.mastermind.tacticsDeck.length, 2, 'no tactic may be defeated after Healing');
    assert.strictEqual(state.playerZones['0']!.victory.length, 0);
  });
});
