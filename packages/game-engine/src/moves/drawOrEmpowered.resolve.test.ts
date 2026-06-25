/**
 * Tests for the resolveDrawOrEmpowered move + hasPendingDrawOrEmpowered predicate
 * (WP-286 / EC-318 / D-24069).
 *
 * Covers the EC-318 §Required Test Coverage seven: 'draw' draws exactly one card +
 * pops; 'empowered' grants the same amount as the core empowered path + pops;
 * hasPendingDrawOrEmpowered over undefined/[]/non-empty; invalid choice → G
 * unmutated; wrong playerID → queue intact; FIFO front-only; queue shift count.
 *
 * The block-all guard completeness + the deterministic bot default live in the
 * later sections (added once those sites are wired). Uses node:test + node:assert.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDrawOrEmpowered,
  hasPendingDrawOrEmpowered,
} from './drawOrEmpowered.resolve.js';
import { interpretHeroPrimitiveEffect } from '../hero/effectPrimitive.interpret.js';
import { buildEmpoweredComposition } from '../rules/heroCompositions.js';
import { endTurn, playCard, drawCards } from './coreMoves.impl.js';
import { fightVillain } from './fightVillain.js';
import { recruitHero } from './recruitHero.js';
import { fightMastermind } from './fightMastermind.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { LegendaryGame } from '../game.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import type { LegendaryGameState, PendingDrawOrEmpowered } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardTraitEntry } from '../state/cardTraits.types.js';

/**
 * Creates a minimal LegendaryGameState for testing the draw-or-empowered flow.
 *
 * @param overrides - Selective overrides for player "0" zones, the pending queue,
 *   the HQ row + card traits (for the empowered count), and current stage.
 */
function makeTestGameState(
  overrides: {
    hand?: CardExtId[];
    discard?: CardExtId[];
    inPlay?: CardExtId[];
    deck?: CardExtId[];
    hq?: (CardExtId | null)[];
    cardTraits?: Record<CardExtId, CardTraitEntry>;
    pendingDrawOrEmpowered?: PendingDrawOrEmpowered[];
    currentStage?: LegendaryGameState['currentStage'];
  } = {},
): LegendaryGameState {
  const state: LegendaryGameState = {
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
    currentStage: overrides.currentStage ?? 'main',
    playerZones: {
      '0': {
        deck: overrides.deck ?? [],
        hand: overrides.hand ?? [],
        discard: overrides.discard ?? [],
        inPlay: overrides.inPlay ?? [],
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
    hq: overrides.hq ?? [null, null, null, null, null],
    cardDisplayData: {},
    cardTraits: overrides.cardTraits ?? {},
    schemeSetupInstructions: [],
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.pendingDrawOrEmpowered !== undefined) {
    state.pendingDrawOrEmpowered = overrides.pendingDrawOrEmpowered;
  }

  return state;
}

/**
 * Builds a move context for the move under test (draw branch needs ctx.random).
 */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveDrawOrEmpowered>[0] {
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
      endTurn: mock.fn(),
      setPhase: mock.fn(),
      endPhase: mock.fn(),
      setStage: mock.fn(),
      endStage: mock.fn(),
      pass: mock.fn(),
      endGame: mock.fn(),
    },
    random: {
      Shuffle: <T>(deck: T[]): T[] => [...deck].reverse(),
      D4: mock.fn(), D6: mock.fn(), D10: mock.fn(), D12: mock.fn(), D20: mock.fn(),
      Die: mock.fn(), Number: mock.fn(),
    },
    playerID: playerId,
    log: { setMetadata: mock.fn() },
  } as unknown as Parameters<typeof resolveDrawOrEmpowered>[0];
}

/** A pending draw-or-empowered choice for the given player, empowered by strength. */
const strengthPending = (playerID = '0'): PendingDrawOrEmpowered => ({
  playerID,
  empoweredClass: 'strength',
});

/** Two strength-class HQ cards so the empowered count is a non-zero 2. */
const twoStrengthHq = (): {
  hq: (CardExtId | null)[];
  cardTraits: Record<CardExtId, CardTraitEntry>;
} => ({
  hq: ['s0' as CardExtId, 's1' as CardExtId, null, null, null],
  cardTraits: {
    s0: { heroClass: 'strength' },
    s1: { heroClass: 'strength' },
  } as unknown as Record<CardExtId, CardTraitEntry>,
});

describe('resolveDrawOrEmpowered — { choice: "draw" }', () => {
  it('draws exactly one card from the deck top into hand and pops the front entry', () => {
    const gameState = makeTestGameState({
      deck: ['top-of-deck' as CardExtId, 'next' as CardExtId],
      hand: [],
      pendingDrawOrEmpowered: [strengthPending()],
    });
    const context = makeMoveContext(gameState);

    resolveDrawOrEmpowered(context, { choice: 'draw' });

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['top-of-deck'], 'exactly one card drawn into hand');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, ['next'], 'one card removed from the deck top');
    assert.equal(gameState.pendingDrawOrEmpowered!.length, 0, 'front entry popped');
  });
});

describe('resolveDrawOrEmpowered — { choice: "empowered" }', () => {
  it('grants the same attack amount as the core empowered path for that board, then pops', () => {
    const board = twoStrengthHq();
    const gameState = makeTestGameState({
      hq: board.hq,
      cardTraits: board.cardTraits,
      pendingDrawOrEmpowered: [strengthPending()],
    });
    const context = makeMoveContext(gameState);

    // why: the core empowered path runs buildEmpoweredComposition(class) through the
    // interpreter. Run it directly on an identical board to capture the reference grant,
    // then assert the move produced the same delta — proving the 'empowered' branch reuses
    // the composition (no re-implementation) and grants the same amount (AC-8).
    const coreState = makeTestGameState({ hq: board.hq, cardTraits: board.cardTraits });
    interpretHeroPrimitiveEffect(coreState, makeMoveContext(coreState), '0', buildEmpoweredComposition('strength'));
    const coreGrant = coreState.turnEconomy.attack - 10;

    resolveDrawOrEmpowered(context, { choice: 'empowered' });

    assert.equal(coreGrant, 2, 'two strength HQ cards → the core path grants +2 attack');
    assert.equal(gameState.turnEconomy.attack, 10 + coreGrant, 'the move granted the same amount as the core path');
    assert.equal(gameState.pendingDrawOrEmpowered!.length, 0, 'front entry popped');
  });
});

describe('hasPendingDrawOrEmpowered predicate', () => {
  it('false when the queue is absent (undefined)', () => {
    assert.equal(hasPendingDrawOrEmpowered(makeTestGameState({})), false);
  });
  it('false on an empty queue', () => {
    assert.equal(hasPendingDrawOrEmpowered(makeTestGameState({ pendingDrawOrEmpowered: [] })), false);
  });
  it('true when the queue has one entry', () => {
    assert.equal(hasPendingDrawOrEmpowered(makeTestGameState({ pendingDrawOrEmpowered: [strengthPending()] })), true);
  });
});

describe('resolveDrawOrEmpowered — failure boundaries leave G unmutated', () => {
  it('invalid choice → G entirely unmutated, queue intact', () => {
    const gameState = makeTestGameState({
      deck: ['top' as CardExtId],
      pendingDrawOrEmpowered: [strengthPending()],
    });
    const before = JSON.stringify(gameState);
    const context = makeMoveContext(gameState);

    resolveDrawOrEmpowered(context, { choice: 'banana' } as unknown as Parameters<typeof resolveDrawOrEmpowered>[1]);

    assert.equal(JSON.stringify(gameState), before, 'no field mutated on an invalid choice');
  });

  it('front playerID mismatch → G unmutated, queue intact', () => {
    const gameState = makeTestGameState({
      deck: ['top' as CardExtId],
      pendingDrawOrEmpowered: [strengthPending('1')],
    });
    const before = JSON.stringify(gameState);
    const context = makeMoveContext(gameState, '0');

    resolveDrawOrEmpowered(context, { choice: 'draw' });

    assert.equal(JSON.stringify(gameState), before, 'no field mutated when the front belongs to another player');
    assert.equal(gameState.pendingDrawOrEmpowered!.length, 1, 'queue intact');
  });

  it('empty queue → no-op', () => {
    const gameState = makeTestGameState({ deck: ['top' as CardExtId], pendingDrawOrEmpowered: [] });
    const before = JSON.stringify(gameState);
    resolveDrawOrEmpowered(makeMoveContext(gameState), { choice: 'draw' });
    assert.equal(JSON.stringify(gameState), before, 'no-op on an empty queue');
  });
});

describe('resolveDrawOrEmpowered — FIFO front-only integrity', () => {
  it('a 2-entry queue: one resolve consumes [0]; [1] is untouched', () => {
    const gameState = makeTestGameState({
      deck: ['top' as CardExtId, 'next' as CardExtId],
      pendingDrawOrEmpowered: [
        { playerID: '0', empoweredClass: 'strength' },
        { playerID: '0', empoweredClass: 'tech' },
      ],
    });
    const context = makeMoveContext(gameState);

    resolveDrawOrEmpowered(context, { choice: 'draw' });

    assert.equal(gameState.pendingDrawOrEmpowered!.length, 1, 'exactly one entry removed (startLength - 1)');
    assert.deepStrictEqual(
      gameState.pendingDrawOrEmpowered![0],
      { playerID: '0', empoweredClass: 'tech' },
      'the second entry is untouched after the first resolves',
    );
  });
});

describe('block-all guards: action moves are no-ops while a draw-or-empowered choice is pending (AC-14)', () => {
  it('playCard does not move a card or change economy while pending', () => {
    const gameState = makeTestGameState({
      hand: ['a' as CardExtId, 'b' as CardExtId],
      pendingDrawOrEmpowered: [strengthPending()],
    });
    gameState.cardStats = { a: { attack: 3, recruit: 0, cost: 0, fightCost: 0 } } as unknown as LegendaryGameState['cardStats'];

    playCard(makeMoveContext(gameState), { cardId: 'a' as CardExtId });

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['a', 'b'], 'hand untouched');
    assert.deepStrictEqual(gameState.playerZones['0']!.inPlay, [], 'inPlay untouched');
    assert.equal(gameState.turnEconomy.attack, 10, 'economy untouched');
  });

  it('drawCards is a no-op while pending', () => {
    const gameState = makeTestGameState({
      deck: ['c0' as CardExtId, 'c1' as CardExtId],
      hand: [],
      pendingDrawOrEmpowered: [strengthPending()],
      currentStage: 'start',
    });

    drawCards(makeMoveContext(gameState), { count: 5 });

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, [], 'no cards drawn');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, ['c0', 'c1'], 'deck untouched');
  });

  it('fightVillain is a no-op while pending', () => {
    const gameState = makeTestGameState({ pendingDrawOrEmpowered: [strengthPending()] });
    gameState.city = ['villain-x' as CardExtId, null, null, null, null];
    gameState.cardStats = { 'villain-x': { attack: 0, recruit: 0, cost: 0, fightCost: 0 } } as unknown as LegendaryGameState['cardStats'];

    fightVillain(makeMoveContext(gameState), { cityIndex: 0 });

    assert.equal(gameState.city[0], 'villain-x', 'villain still in city');
    assert.deepStrictEqual(gameState.playerZones['0']!.victory, [], 'victory untouched');
  });

  it('recruitHero is a no-op while pending', () => {
    const gameState = makeTestGameState({ pendingDrawOrEmpowered: [strengthPending()] });
    gameState.hq = ['hero-hq' as CardExtId, null, null, null, null];
    gameState.cardStats = { 'hero-hq': { attack: 0, recruit: 0, cost: 0, fightCost: 0 } } as unknown as LegendaryGameState['cardStats'];

    recruitHero(makeMoveContext(gameState), { hqIndex: 0 });

    assert.equal(gameState.hq[0], 'hero-hq', 'HQ slot untouched');
    assert.deepStrictEqual(gameState.playerZones['0']!.discard, [], 'discard untouched');
  });

  it('fightMastermind is a no-op while pending', () => {
    const gameState = makeTestGameState({ pendingDrawOrEmpowered: [strengthPending()] });
    gameState.cardStats = { 'test-mastermind-base': { attack: 0, recruit: 0, cost: 0, fightCost: 0 } } as unknown as LegendaryGameState['cardStats'];

    fightMastermind(makeMoveContext(gameState));

    assert.deepStrictEqual(gameState.mastermind.tacticsDeck, ['tactic-0'], 'tactics untouched');
  });

  it('revealVillainCard is a no-op while pending', () => {
    const gameState = makeTestGameState({ pendingDrawOrEmpowered: [strengthPending()], currentStage: 'start' });
    gameState.villainDeck = { deck: ['vd-0' as CardExtId], discard: [] };
    gameState.villainDeckCardTypes = { 'vd-0': 'bystander' } as unknown as LegendaryGameState['villainDeckCardTypes'];

    revealVillainCard(makeMoveContext(gameState));

    assert.deepStrictEqual(gameState.villainDeck.deck, ['vd-0'], 'villain deck untouched');
  });

  it('endTurn does not sweep the hand while pending', () => {
    const gameState = makeTestGameState({
      hand: ['a' as CardExtId, 'b' as CardExtId],
      inPlay: ['c' as CardExtId],
      pendingDrawOrEmpowered: [strengthPending()],
      currentStage: 'cleanup',
    });

    endTurn(makeMoveContext(gameState));

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['a', 'b'], 'hand not swept');
    assert.deepStrictEqual(gameState.playerZones['0']!.inPlay, ['c'], 'inPlay not swept');
  });

  it('advanceStage is a no-op (stage unchanged) while pending', () => {
    const gameState = makeTestGameState({
      pendingDrawOrEmpowered: [strengthPending()],
      currentStage: 'cleanup',
    });
    const context = makeMoveContext(gameState);
    type MoveDef = { move: (c: typeof context) => void };
    const advanceStageFn = (LegendaryGame.moves?.advanceStage as MoveDef | undefined)?.move;
    assert.ok(advanceStageFn, 'advanceStage move is registered');

    advanceStageFn!(context);

    assert.equal(gameState.currentStage, 'cleanup', 'stage unchanged while a choice is pending');
  });
});

describe('deterministic bot default (AC-15)', () => {
  it('getLegalMoves returns exactly resolveDrawOrEmpowered { choice: "empowered" } while pending', () => {
    const gameState = makeTestGameState({ pendingDrawOrEmpowered: [strengthPending()] });

    const legalMoves = getLegalMoves(gameState, {
      phase: 'play',
      turn: 1,
      currentPlayer: '0',
      numPlayers: 1,
    });

    assert.deepStrictEqual(
      legalMoves,
      [{ name: 'resolveDrawOrEmpowered', args: { choice: 'empowered' } }],
      'exactly one deterministic empowered default move (no ctx.random)',
    );
  });
});
