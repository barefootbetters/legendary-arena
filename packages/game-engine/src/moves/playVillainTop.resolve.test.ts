/**
 * Tests for the resolvePlayVillainTopChoice move (WP-663 / D-24474 — Emma Frost's
 * Shadowed Thoughts) and the block-all action-move guards that freeze the board while a
 * play-top-Villain-Deck choice is pending.
 *
 * Covers: accept (plays the top Villain-Deck card via the shared reveal cascade → city
 * entry — AND grants the printed +N Attack reward); decline (front-pop, no play, no
 * Attack, deck untouched, logged); invalid arg / empty queue / wrong playerID → silent
 * no-op (queue intact, never throws); front-pop ordering; hasPendingPlayVillainTopChoice;
 * block-all completeness across the guarded action moves; the resolver stays available.
 *
 * Covers AC per WP-663 / EC-700. Uses node:test + node:assert only.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePlayVillainTopChoice,
  hasPendingPlayVillainTopChoice,
} from './playVillainTop.resolve.js';
import { endTurn, playCard, drawCards } from './coreMoves.impl.js';
import { fightVillain } from './fightVillain.js';
import { recruitHero } from './recruitHero.js';
import { fightMastermind } from './fightMastermind.js';
import type { LegendaryGameState, PendingPlayVillainTopChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/**
 * Creates a minimal LegendaryGameState for testing the play-top-Villain-Deck flow.
 *
 * @param overrides - Selective overrides for the villain deck + card types, the pending
 *   queue, the city, and current stage. The turn economy starts at 10/10 so the +Attack
 *   reward is observable.
 */
function makeTestGameState(
  overrides: {
    villainDeck?: CardExtId[];
    villainDeckCardTypes?: Record<string, string>;
    city?: (CardExtId | null)[];
    pendingPlayVillainTopChoices?: PendingPlayVillainTopChoice[];
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
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    piles: { bystanders: [], wounds: [], officers: [], sidekicks: [], horrors: [] },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainAbilityHooks: [],
    villainDeck: { deck: overrides.villainDeck ?? [], discard: [] },
    villainDeckCardTypes: (overrides.villainDeckCardTypes ?? {}) as unknown as LegendaryGameState['villainDeckCardTypes'],
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
    city: overrides.city ?? [null, null, null, null, null],
    hq: [null, null, null, null, null],
    cardDisplayData: {},
    cardTraits: {},
    schemeSetupInstructions: [],
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.pendingPlayVillainTopChoices !== undefined) {
    state.pendingPlayVillainTopChoices = overrides.pendingPlayVillainTopChoices;
  }

  return state;
}

/**
 * Builds a move context (the reveal reshuffle reverses the deck, proving the seam ran).
 */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): { context: Parameters<typeof resolvePlayVillainTopChoice>[0]; endTurnSpy: ReturnType<typeof mock.fn> } {
  const endTurnSpy = mock.fn();
  const context = {
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
      endTurn: endTurnSpy,
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
  } as unknown as Parameters<typeof resolvePlayVillainTopChoice>[0];

  return { context, endTurnSpy };
}

/** A pending play-top-Villain-Deck choice for player "0" from Shadowed Thoughts (+2 Attack). */
const shadowedThoughtsPending = (playerID = '0'): PendingPlayVillainTopChoice => ({
  playerID,
  cardId: 'ms-emma-frost-shadowed-thoughts' as CardExtId,
  attackReward: 2,
});

describe('resolvePlayVillainTopChoice — accept', () => {
  it('plays the top Villain-Deck card (enters the city) AND grants the +N Attack reward', () => {
    const gameState = makeTestGameState({
      villainDeck: ['vd-top' as CardExtId],
      villainDeckCardTypes: { 'vd-top': 'villain' },
      pendingPlayVillainTopChoices: [shadowedThoughtsPending()],
    });
    const { context } = makeMoveContext(gameState);

    resolvePlayVillainTopChoice(context, { accept: true });

    const cityCards = gameState.city.filter((occupant) => occupant !== null);
    assert.deepStrictEqual(cityCards, ['vd-top'], 'the played villain entered the city');
    assert.deepStrictEqual(gameState.villainDeck.deck, [], 'the top card left the villain deck');
    assert.equal(gameState.turnEconomy.attack, 12, '+2 Attack reward granted (10 → 12)');
    assert.equal(gameState.pendingPlayVillainTopChoices!.length, 0, 'queue front-popped');
  });

  it('does not grant Attack if the reward magnitude is 0 (defensive: still plays the card)', () => {
    const gameState = makeTestGameState({
      villainDeck: ['vd-top' as CardExtId],
      villainDeckCardTypes: { 'vd-top': 'villain' },
      pendingPlayVillainTopChoices: [{ playerID: '0', cardId: 'x' as CardExtId, attackReward: 0 }],
    });
    const { context } = makeMoveContext(gameState);

    resolvePlayVillainTopChoice(context, { accept: true });

    assert.equal(gameState.turnEconomy.attack, 10, 'no Attack change for a 0 reward');
    assert.equal(gameState.pendingPlayVillainTopChoices!.length, 0, 'queue front-popped');
  });
});

describe('resolvePlayVillainTopChoice — decline', () => {
  it('front-pops with no play and no Attack; villain deck untouched; logs one line', () => {
    const gameState = makeTestGameState({
      villainDeck: ['vd-top' as CardExtId],
      villainDeckCardTypes: { 'vd-top': 'villain' },
      pendingPlayVillainTopChoices: [shadowedThoughtsPending()],
    });
    const { context } = makeMoveContext(gameState);

    resolvePlayVillainTopChoice(context, { accept: false });

    assert.deepStrictEqual(gameState.villainDeck.deck, ['vd-top'], 'villain deck untouched on decline');
    assert.deepStrictEqual(gameState.city.filter((o) => o !== null), [], 'nothing entered the city on decline');
    assert.equal(gameState.turnEconomy.attack, 10, 'no Attack on decline');
    assert.equal(gameState.pendingPlayVillainTopChoices!.length, 0, 'queue front-popped on decline');
    assert.ok(gameState.messages.some((line) => /declined/.test(line.text)), 'the decline is logged');
  });
});

describe('resolvePlayVillainTopChoice — front-only multi-entry integrity', () => {
  it('a 2-entry queue: one decline removes exactly the front entry', () => {
    const gameState = makeTestGameState({
      pendingPlayVillainTopChoices: [shadowedThoughtsPending('0'), shadowedThoughtsPending('0')],
    });
    const { context } = makeMoveContext(gameState);

    resolvePlayVillainTopChoice(context, { accept: false });

    assert.equal(gameState.pendingPlayVillainTopChoices!.length, 1, 'exactly one entry removed');
    assert.deepStrictEqual(gameState.pendingPlayVillainTopChoices![0], shadowedThoughtsPending('0'), 'remaining entry intact');
  });
});

describe('resolvePlayVillainTopChoice — silent no-ops leave the queue byte-identical', () => {
  function expectNoOp(
    args: Parameters<typeof resolvePlayVillainTopChoice>[1],
    overrides: Parameters<typeof makeTestGameState>[0],
    playerId = '0',
  ): void {
    const gameState = makeTestGameState(overrides);
    const queueBefore = JSON.stringify(gameState.pendingPlayVillainTopChoices ?? null);
    const deckBefore = JSON.stringify(gameState.villainDeck.deck);
    const { context } = makeMoveContext(gameState, playerId);
    resolvePlayVillainTopChoice(context, args);
    assert.equal(JSON.stringify(gameState.pendingPlayVillainTopChoices ?? null), queueBefore, 'queue unchanged');
    assert.equal(JSON.stringify(gameState.villainDeck.deck), deckBefore, 'villain deck unchanged');
  }

  it('no-op on a non-boolean accept', () => {
    expectNoOp(
      { accept: 'yes' } as unknown as Parameters<typeof resolvePlayVillainTopChoice>[1],
      { villainDeck: ['vd-top' as CardExtId], villainDeckCardTypes: { 'vd-top': 'villain' }, pendingPlayVillainTopChoices: [shadowedThoughtsPending()] },
    );
  });

  it('no-op on an empty queue', () => {
    expectNoOp({ accept: true }, { villainDeck: ['vd-top' as CardExtId], pendingPlayVillainTopChoices: [] });
  });

  it('no-op on an absent queue (undefined)', () => {
    expectNoOp({ accept: true }, { villainDeck: ['vd-top' as CardExtId] });
  });

  it('no-op on wrong playerID (front belongs to another player)', () => {
    expectNoOp(
      { accept: true },
      { villainDeck: ['vd-top' as CardExtId], villainDeckCardTypes: { 'vd-top': 'villain' }, pendingPlayVillainTopChoices: [shadowedThoughtsPending('1')] },
      '0',
    );
  });
});

describe('hasPendingPlayVillainTopChoice predicate', () => {
  it('true when the queue has entries', () => {
    assert.equal(hasPendingPlayVillainTopChoice(makeTestGameState({ pendingPlayVillainTopChoices: [shadowedThoughtsPending()] })), true);
  });
  it('false on an empty queue', () => {
    assert.equal(hasPendingPlayVillainTopChoice(makeTestGameState({ pendingPlayVillainTopChoices: [] })), false);
  });
  it('false when the queue is absent (undefined)', () => {
    assert.equal(hasPendingPlayVillainTopChoice(makeTestGameState({})), false);
  });
});

describe('block-all guards: every action move is a no-op while a play-top-Villain-Deck choice is pending', () => {
  it('endTurn does not sweep or call events.endTurn() while pending', () => {
    const gameState = makeTestGameState({
      pendingPlayVillainTopChoices: [shadowedThoughtsPending()],
      currentStage: 'cleanup',
    });
    gameState.playerZones['0'] = { deck: [], hand: ['a' as CardExtId], discard: [], inPlay: ['c' as CardExtId], victory: [], undercover: [] };
    const { context, endTurnSpy } = makeMoveContext(gameState);

    endTurn(context);

    assert.equal(endTurnSpy.mock.calls.length, 0, 'events.endTurn() blocked');
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['a'], 'hand not swept');
    assert.deepStrictEqual(gameState.playerZones['0']!.inPlay, ['c'], 'inPlay not swept');
  });

  it('playCard does not move a card or change economy while pending', () => {
    const gameState = makeTestGameState({ pendingPlayVillainTopChoices: [shadowedThoughtsPending()] });
    gameState.playerZones['0'] = { deck: [], hand: ['a' as CardExtId, 'b' as CardExtId], discard: [], inPlay: [], victory: [], undercover: [] };
    gameState.cardStats = { a: { attack: 3, recruit: 0, cost: 0, fightCost: 0 } } as unknown as LegendaryGameState['cardStats'];
    const { context } = makeMoveContext(gameState);

    playCard(context, { cardId: 'a' as CardExtId });

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['a', 'b'], 'hand untouched');
    assert.deepStrictEqual(gameState.playerZones['0']!.inPlay, [], 'inPlay untouched');
    assert.equal(gameState.turnEconomy.attack, 10, 'economy untouched');
  });

  it('drawCards is a no-op while pending', () => {
    const gameState = makeTestGameState({ pendingPlayVillainTopChoices: [shadowedThoughtsPending()], currentStage: 'start' });
    gameState.playerZones['0'] = { deck: ['c0' as CardExtId, 'c1' as CardExtId], hand: [], discard: [], inPlay: [], victory: [], undercover: [] };
    const { context } = makeMoveContext(gameState);
    drawCards(context, { count: 5 });
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, [], 'no cards drawn');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, ['c0', 'c1'], 'deck untouched');
  });

  it('fightVillain is a no-op while pending', () => {
    const gameState = makeTestGameState({ pendingPlayVillainTopChoices: [shadowedThoughtsPending()] });
    gameState.city = ['villain-x' as CardExtId, null, null, null, null];
    gameState.cardStats = { 'villain-x': { attack: 0, recruit: 0, cost: 0, fightCost: 0 } } as unknown as LegendaryGameState['cardStats'];
    const { context } = makeMoveContext(gameState);

    fightVillain(context, { cityIndex: 0 });

    assert.equal(gameState.city[0], 'villain-x', 'villain still in city');
    assert.deepStrictEqual(gameState.playerZones['0']!.victory, [], 'victory untouched');
  });

  it('recruitHero is a no-op while pending', () => {
    const gameState = makeTestGameState({ pendingPlayVillainTopChoices: [shadowedThoughtsPending()] });
    gameState.hq = ['hero-hq' as CardExtId, null, null, null, null];
    gameState.cardStats = { 'hero-hq': { attack: 0, recruit: 0, cost: 0, fightCost: 0 } } as unknown as LegendaryGameState['cardStats'];
    const { context } = makeMoveContext(gameState);

    recruitHero(context, { hqIndex: 0 });

    assert.equal(gameState.hq[0], 'hero-hq', 'HQ slot untouched');
    assert.deepStrictEqual(gameState.playerZones['0']!.discard, [], 'discard untouched');
  });

  it('fightMastermind is a no-op while pending', () => {
    const gameState = makeTestGameState({ pendingPlayVillainTopChoices: [shadowedThoughtsPending()] });
    gameState.cardStats = { 'test-mastermind-base': { attack: 0, recruit: 0, cost: 0, fightCost: 0 } } as unknown as LegendaryGameState['cardStats'];
    const { context } = makeMoveContext(gameState);

    fightMastermind(context);

    assert.deepStrictEqual(gameState.mastermind.tacticsDeck, ['tactic-0'], 'tactics untouched');
    assert.deepStrictEqual(gameState.playerZones['0']!.victory, [], 'victory untouched');
  });
});

describe('resolvePlayVillainTopChoice is NOT blocked while its own choice is pending', () => {
  it('the resolver itself resolves (declines) while pending', () => {
    const gameState = makeTestGameState({ pendingPlayVillainTopChoices: [shadowedThoughtsPending()] });
    const { context } = makeMoveContext(gameState);
    resolvePlayVillainTopChoice(context, { accept: false });
    assert.equal(gameState.pendingPlayVillainTopChoices!.length, 0, 'resolver not blocked');
  });
});
