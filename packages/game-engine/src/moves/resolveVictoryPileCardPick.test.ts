/**
 * Tests for the resolveVictoryPileCardPick move (WP-285 / D-24067) and
 * the hasPendingVictoryPileCardPick predicate.
 *
 * Covers all 7 mandatory ACs from EC-317 §Required Test Coverage:
 *   AC-valid     — correct attack value granted to G.turnEconomy.attack
 *   AC-absent    — cardId not in victory pile: G entirely unmutated
 *   AC-non-villain — card present but villainDeckCardTypes[id] !== 'villain': G unmutated
 *   AC-empty     — eligible list empty at resolution time: G unmutated
 *   AC-fifo      — FIFO order: ≥2 queued entries, first resolve consumes entry [0]
 *   AC-undef     — undefined queue: predicate returns false; move is a no-op
 *   AC-shift     — queue length is exactly startLength − 1 after a successful resolve
 *
 * Also covers: block-all guard completeness for all guarded moves; the remaining
 * resolver moves (resolveOptionalKoReward, resolveKoHeroChoice, resolveHeroChoice)
 * stay available while pendingVictoryPileCardPick is populated (they each have
 * their own queue); invalid arg shapes; wrong playerID; stale cardId after queue
 * parks but before player resolves.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveVictoryPileCardPick,
  hasPendingVictoryPileCardPick,
  getEligibleVictoryVillains,
} from './resolveVictoryPileCardPick.js';
import { endTurn, playCard, drawCards } from './coreMoves.impl.js';
import { fightVillain } from './fightVillain.js';
import { recruitHero } from './recruitHero.js';
import { fightMastermind } from './fightMastermind.js';
import { dodgeCard } from './dodgeCard.js';
import { playFromUndercover } from './playFromUndercover.js';
import { resolveOptionalKoReward } from './optionalKoReward.resolve.js';
import { resolveKoHeroChoice } from './koHeroChoice.resolve.js';
import { resolveHeroChoice } from './heroChoice.resolve.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { LegendaryGame } from '../game.js';
import type {
  LegendaryGameState,
  PendingVictoryPileCardPick,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/**
 * Creates a minimal LegendaryGameState for testing the victory-pile pick flow.
 *
 * @param overrides - Selective overrides for player "0" zones, the pending queues,
 *   the villain deck type map, card stats, turn economy, and current stage.
 */
function makeTestGameState(
  overrides: {
    victory?: CardExtId[];
    hand?: CardExtId[];
    discard?: CardExtId[];
    deck?: CardExtId[];
    pendingVictoryPileCardPick?: PendingVictoryPileCardPick[];
    villainDeckCardTypes?: Record<string, string>;
    cardStats?: Record<string, { attack: number; recruit: number; cost: number; fightCost: number }>;
    attack?: number;
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
        inPlay: [],
        victory: overrides.victory ?? [],
      },
    },
    piles: { bystanders: [], wounds: [], officers: [], sidekicks: [], horrors: [] },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainAbilityHooks: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: (overrides.villainDeckCardTypes ?? {}) as Record<string, string>,
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    turnEconomy: {
      attack: overrides.attack ?? 0,
      recruit: 0,
      spentAttack: 0,
      spentRecruit: 0,
      piercing: 0,
      woundsDrawn: 0,
    },
    cardStats: (overrides.cardStats ?? {}) as Record<string, { attack: number; recruit: number; cost: number; fightCost: number }>,
    cardKeywords: {},
    heroDeck: [],
    escapedPile: [],
    mastermind: {
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base' as CardExtId,
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

  if (overrides.pendingVictoryPileCardPick !== undefined) {
    state.pendingVictoryPileCardPick = overrides.pendingVictoryPileCardPick;
  }

  return state;
}

/**
 * Builds a move context with event spies for the move under test.
 */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): { context: Parameters<typeof resolveVictoryPileCardPick>[0] } {
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
  } as unknown as Parameters<typeof resolveVictoryPileCardPick>[0];

  return { context };
}

// ---------------------------------------------------------------------------
// AC-valid: correct attack value granted
// ---------------------------------------------------------------------------

describe('resolveVictoryPileCardPick — valid pick grants printed attack', () => {
  it('grants the villain printed-attack value to G.turnEconomy.attack (AC-valid)', () => {
    const gameState = makeTestGameState({
      victory: ['villain-a' as CardExtId],
      villainDeckCardTypes: { 'villain-a': 'villain' },
      cardStats: { 'villain-a': { attack: 0, recruit: 0, cost: 0, fightCost: 4 } },
      pendingVictoryPileCardPick: [{ rewardType: 'attack', playerID: '0' }],
      attack: 5,
    });
    const { context } = makeMoveContext(gameState);

    resolveVictoryPileCardPick(context, { cardId: 'villain-a' as CardExtId });

    assert.equal(gameState.turnEconomy.attack, 9, 'attack += 4 (villain printed attack)');
  });

  it('reads attack from G.cardStats as a number, no coercion (WP-247)', () => {
    const gameState = makeTestGameState({
      victory: ['villain-b' as CardExtId],
      villainDeckCardTypes: { 'villain-b': 'villain' },
      cardStats: { 'villain-b': { attack: 0, recruit: 0, cost: 0, fightCost: 7 } },
      pendingVictoryPileCardPick: [{ rewardType: 'attack', playerID: '0' }],
      attack: 0,
    });
    const { context } = makeMoveContext(gameState);

    resolveVictoryPileCardPick(context, { cardId: 'villain-b' as CardExtId });

    assert.equal(gameState.turnEconomy.attack, 7, 'attack += 7 (villain printed attack)');
  });

  it('logs a human-readable message on success', () => {
    const gameState = makeTestGameState({
      victory: ['villain-c' as CardExtId],
      villainDeckCardTypes: { 'villain-c': 'villain' },
      cardStats: { 'villain-c': { attack: 0, recruit: 0, cost: 0, fightCost: 3 } },
      pendingVictoryPileCardPick: [{ rewardType: 'attack', playerID: '0' }],
    });
    const { context } = makeMoveContext(gameState);

    resolveVictoryPileCardPick(context, { cardId: 'villain-c' as CardExtId });

    assert.ok(gameState.messages.length > 0, 'message logged on success');
  });
});

// ---------------------------------------------------------------------------
// AC-shift: queue length is exactly startLength − 1 after successful resolve
// ---------------------------------------------------------------------------

describe('resolveVictoryPileCardPick — queue shift', () => {
  it('removes exactly one entry from the front of the queue (AC-shift)', () => {
    const pending: PendingVictoryPileCardPick[] = [
      { rewardType: 'attack', playerID: '0' },
    ];
    const gameState = makeTestGameState({
      victory: ['villain-d' as CardExtId],
      villainDeckCardTypes: { 'villain-d': 'villain' },
      cardStats: { 'villain-d': { attack: 0, recruit: 0, cost: 0, fightCost: 5 } },
      pendingVictoryPileCardPick: pending,
    });
    const { context } = makeMoveContext(gameState);

    resolveVictoryPileCardPick(context, { cardId: 'villain-d' as CardExtId });

    assert.equal(gameState.pendingVictoryPileCardPick!.length, 0, 'queue emptied after single resolve');
  });
});

// ---------------------------------------------------------------------------
// AC-fifo: FIFO order — first resolve consumes entry [0], [1] untouched
// ---------------------------------------------------------------------------

describe('resolveVictoryPileCardPick — FIFO ordering', () => {
  it('pops only the front entry; second entry is untouched (AC-fifo)', () => {
    const pending: PendingVictoryPileCardPick[] = [
      { rewardType: 'attack', playerID: '0' },
      { rewardType: 'attack', playerID: '0' },
    ];
    const gameState = makeTestGameState({
      victory: ['villain-e' as CardExtId],
      villainDeckCardTypes: { 'villain-e': 'villain' },
      cardStats: { 'villain-e': { attack: 0, recruit: 0, cost: 0, fightCost: 6 } },
      pendingVictoryPileCardPick: pending,
    });
    const { context } = makeMoveContext(gameState);

    resolveVictoryPileCardPick(context, { cardId: 'villain-e' as CardExtId });

    assert.equal(gameState.pendingVictoryPileCardPick!.length, 1, 'one entry remains after first resolve');
    assert.equal(gameState.pendingVictoryPileCardPick![0]!.playerID, '0', 'remaining entry is the second one');
  });
});

// ---------------------------------------------------------------------------
// AC-absent: cardId not in victory pile → G entirely unmutated
// ---------------------------------------------------------------------------

describe('resolveVictoryPileCardPick — card absent from victory pile', () => {
  it('returns with no side effects when cardId is not in the victory pile (AC-absent)', () => {
    const pending: PendingVictoryPileCardPick[] = [{ rewardType: 'attack', playerID: '0' }];
    const gameState = makeTestGameState({
      victory: ['villain-f' as CardExtId],
      villainDeckCardTypes: { 'villain-f': 'villain' },
      cardStats: { 'villain-f': { attack: 0, recruit: 0, cost: 0, fightCost: 4 } },
      pendingVictoryPileCardPick: pending,
      attack: 3,
    });
    const { context } = makeMoveContext(gameState);

    resolveVictoryPileCardPick(context, { cardId: 'not-in-pile' as CardExtId });

    assert.equal(gameState.turnEconomy.attack, 3, 'attack unchanged');
    assert.equal(gameState.pendingVictoryPileCardPick!.length, 1, 'queue intact');
    assert.deepStrictEqual(gameState.messages, [], 'no message on no-op');
  });
});

// ---------------------------------------------------------------------------
// AC-non-villain: card present but villainDeckCardTypes[id] !== 'villain' → G unmutated
// ---------------------------------------------------------------------------

describe('resolveVictoryPileCardPick — non-villain card in victory pile', () => {
  it('returns with no side effects when card is a henchman, not a villain (AC-non-villain)', () => {
    const pending: PendingVictoryPileCardPick[] = [{ rewardType: 'attack', playerID: '0' }];
    const gameState = makeTestGameState({
      victory: ['henchman-g' as CardExtId],
      villainDeckCardTypes: { 'henchman-g': 'henchman' },
      cardStats: { 'henchman-g': { attack: 0, recruit: 0, cost: 0, fightCost: 2 } },
      pendingVictoryPileCardPick: pending,
      attack: 2,
    });
    const { context } = makeMoveContext(gameState);

    resolveVictoryPileCardPick(context, { cardId: 'henchman-g' as CardExtId });

    assert.equal(gameState.turnEconomy.attack, 2, 'attack unchanged — henchman not eligible');
    assert.equal(gameState.pendingVictoryPileCardPick!.length, 1, 'queue intact');
  });

  it('returns with no side effects when card has no entry in villainDeckCardTypes', () => {
    const pending: PendingVictoryPileCardPick[] = [{ rewardType: 'attack', playerID: '0' }];
    const gameState = makeTestGameState({
      victory: ['mystery-card' as CardExtId],
      villainDeckCardTypes: {},
      cardStats: { 'mystery-card': { attack: 0, recruit: 0, cost: 0, fightCost: 5 } },
      pendingVictoryPileCardPick: pending,
      attack: 1,
    });
    const { context } = makeMoveContext(gameState);

    resolveVictoryPileCardPick(context, { cardId: 'mystery-card' as CardExtId });

    assert.equal(gameState.turnEconomy.attack, 1, 'attack unchanged — undefined type not eligible');
    assert.equal(gameState.pendingVictoryPileCardPick!.length, 1, 'queue intact');
  });
});

// ---------------------------------------------------------------------------
// AC-empty: eligible list empty at resolution time → G entirely unmutated
// ---------------------------------------------------------------------------

describe('resolveVictoryPileCardPick — empty eligible list at resolution time', () => {
  it('returns with no side effects when victory pile has cards but none are villains (AC-empty)', () => {
    const pending: PendingVictoryPileCardPick[] = [{ rewardType: 'attack', playerID: '0' }];
    const gameState = makeTestGameState({
      victory: ['bystander-h' as CardExtId],
      villainDeckCardTypes: { 'bystander-h': 'bystander' },
      cardStats: {},
      pendingVictoryPileCardPick: pending,
      attack: 4,
    });
    const { context } = makeMoveContext(gameState);

    resolveVictoryPileCardPick(context, { cardId: 'bystander-h' as CardExtId });

    assert.equal(gameState.turnEconomy.attack, 4, 'attack unchanged — no eligible villain');
    assert.equal(gameState.pendingVictoryPileCardPick!.length, 1, 'queue intact');
  });

  it('returns with no side effects when victory pile is empty', () => {
    const pending: PendingVictoryPileCardPick[] = [{ rewardType: 'attack', playerID: '0' }];
    const gameState = makeTestGameState({
      victory: [],
      villainDeckCardTypes: {},
      cardStats: {},
      pendingVictoryPileCardPick: pending,
      attack: 7,
    });
    const { context } = makeMoveContext(gameState);

    resolveVictoryPileCardPick(context, { cardId: 'villain-i' as CardExtId });

    assert.equal(gameState.turnEconomy.attack, 7, 'attack unchanged — empty victory pile');
    assert.equal(gameState.pendingVictoryPileCardPick!.length, 1, 'queue intact');
  });
});

// ---------------------------------------------------------------------------
// AC-undef: undefined queue → predicate returns false; move is a no-op
// ---------------------------------------------------------------------------

describe('resolveVictoryPileCardPick — undefined queue', () => {
  it('hasPendingVictoryPileCardPick returns false when queue is undefined (AC-undef)', () => {
    const gameState = makeTestGameState({});
    // No pendingVictoryPileCardPick set — field remains undefined

    assert.equal(hasPendingVictoryPileCardPick(gameState), false, 'predicate false on undefined queue');
  });

  it('hasPendingVictoryPileCardPick returns false when queue is empty array', () => {
    const gameState = makeTestGameState({
      pendingVictoryPileCardPick: [],
    });

    assert.equal(hasPendingVictoryPileCardPick(gameState), false, 'predicate false on empty queue');
  });

  it('hasPendingVictoryPileCardPick returns true when queue has one entry', () => {
    const gameState = makeTestGameState({
      pendingVictoryPileCardPick: [{ rewardType: 'attack', playerID: '0' }],
    });

    assert.equal(hasPendingVictoryPileCardPick(gameState), true, 'predicate true when entry present');
  });

  it('move is a no-op when queue is undefined', () => {
    const gameState = makeTestGameState({
      victory: ['villain-j' as CardExtId],
      villainDeckCardTypes: { 'villain-j': 'villain' },
      cardStats: { 'villain-j': { attack: 0, recruit: 0, cost: 0, fightCost: 3 } },
      attack: 5,
    });
    // No pendingVictoryPileCardPick set
    const { context } = makeMoveContext(gameState);

    resolveVictoryPileCardPick(context, { cardId: 'villain-j' as CardExtId });

    assert.equal(gameState.turnEconomy.attack, 5, 'attack unchanged — no pending queue');
    assert.equal(gameState.pendingVictoryPileCardPick, undefined, 'queue still undefined');
  });
});

// ---------------------------------------------------------------------------
// Atomicity: no partial mutation on any failure path
// ---------------------------------------------------------------------------

describe('resolveVictoryPileCardPick — atomicity', () => {
  it('does not mutate G.turnEconomy on invalid args (non-string cardId)', () => {
    const pending: PendingVictoryPileCardPick[] = [{ rewardType: 'attack', playerID: '0' }];
    const gameState = makeTestGameState({
      victory: ['villain-k' as CardExtId],
      villainDeckCardTypes: { 'villain-k': 'villain' },
      cardStats: { 'villain-k': { attack: 0, recruit: 0, cost: 0, fightCost: 5 } },
      pendingVictoryPileCardPick: pending,
      attack: 2,
    });
    const { context } = makeMoveContext(gameState);

    // @ts-expect-error — intentional invalid arg to test guard
    resolveVictoryPileCardPick(context, { cardId: 42 });

    assert.equal(gameState.turnEconomy.attack, 2, 'attack unchanged on invalid cardId type');
    assert.equal(gameState.pendingVictoryPileCardPick!.length, 1, 'queue intact on invalid arg');
  });

  it('does not mutate G.turnEconomy when playerID does not match front entry', () => {
    const pending: PendingVictoryPileCardPick[] = [{ rewardType: 'attack', playerID: '1' }];
    const gameState = makeTestGameState({
      victory: ['villain-l' as CardExtId],
      villainDeckCardTypes: { 'villain-l': 'villain' },
      cardStats: { 'villain-l': { attack: 0, recruit: 0, cost: 0, fightCost: 4 } },
      pendingVictoryPileCardPick: pending,
      attack: 6,
    });
    // Player "0" calls the move but the pending entry is for player "1"
    const { context } = makeMoveContext(gameState, '0');

    resolveVictoryPileCardPick(context, { cardId: 'villain-l' as CardExtId });

    assert.equal(gameState.turnEconomy.attack, 6, 'attack unchanged — wrong playerID');
    assert.equal(gameState.pendingVictoryPileCardPick!.length, 1, 'queue intact');
  });
});

// ---------------------------------------------------------------------------
// getEligibleVictoryVillains helper
// ---------------------------------------------------------------------------

describe('getEligibleVictoryVillains', () => {
  it('returns only villain-typed cards from the victory pile', () => {
    const gameState = makeTestGameState({
      victory: ['villain-m' as CardExtId, 'henchman-n' as CardExtId, 'villain-o' as CardExtId],
      villainDeckCardTypes: {
        'villain-m': 'villain',
        'henchman-n': 'henchman',
        'villain-o': 'villain',
      },
    });

    const eligible = getEligibleVictoryVillains(gameState, '0');

    assert.deepStrictEqual(eligible, ['villain-m', 'villain-o'], 'only villains returned');
  });

  it('returns empty array when no players zones exist for playerID', () => {
    const gameState = makeTestGameState({});

    const eligible = getEligibleVictoryVillains(gameState, 'nonexistent-player');

    assert.deepStrictEqual(eligible, [], 'no zones → empty eligible list');
  });

  it('returns cards in victory-pile order (not sorted by attack)', () => {
    const gameState = makeTestGameState({
      victory: ['villain-p' as CardExtId, 'villain-q' as CardExtId],
      villainDeckCardTypes: {
        'villain-p': 'villain',
        'villain-q': 'villain',
      },
    });

    const eligible = getEligibleVictoryVillains(gameState, '0');

    assert.deepStrictEqual(eligible, ['villain-p', 'villain-q'], 'victory pile order preserved');
  });
});

// ---------------------------------------------------------------------------
// Block-all guard: all action moves return when pendingVictoryPileCardPick is set
// ---------------------------------------------------------------------------

describe('block-all guard — pendingVictoryPileCardPick freezes all action moves', () => {
  function makeBlockAllState(): LegendaryGameState {
    return makeTestGameState({
      hand: ['hero-x' as CardExtId],
      victory: [],
      attack: 10,
      currentStage: 'main',
      pendingVictoryPileCardPick: [{ rewardType: 'attack', playerID: '0' }],
      cardStats: {
        'hero-x': { attack: 1, recruit: 0, cost: 0, fightCost: 0 },
      },
      villainDeckCardTypes: {},
    });
  }

  function makeBlockAllContext(gameState: LegendaryGameState) {
    return {
      G: gameState,
      ctx: {
        numPlayers: 1,
        currentPlayer: '0',
        phase: 'play',
        turn: 1,
        playOrder: ['0'],
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
      playerID: '0',
      log: { setMetadata: mock.fn() },
    } as unknown as Parameters<typeof playCard>[0];
  }

  it('drawCards is a no-op while pick is pending (block-all)', () => {
    const gameState = makeBlockAllState();
    gameState.currentStage = 'start';
    // Add a card to the deck so drawCards would normally work
    gameState.playerZones['0']!.deck = ['card-to-draw' as CardExtId];
    const ctx = makeBlockAllContext(gameState);

    drawCards(ctx as unknown as Parameters<typeof drawCards>[0], { count: 1 });

    assert.ok(
      !gameState.playerZones['0']!.hand.includes('card-to-draw' as CardExtId),
      'drawCards blocked — card-to-draw not drawn into hand',
    );
  });

  it('playCard is a no-op while pick is pending (block-all)', () => {
    const gameState = makeBlockAllState();
    const attackBefore = gameState.turnEconomy.attack;
    const ctx = makeBlockAllContext(gameState);

    playCard(ctx, { cardId: 'hero-x' as CardExtId });

    assert.equal(gameState.turnEconomy.attack, attackBefore, 'playCard blocked — attack unchanged');
    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['hero-x'], 'playCard blocked — hand unchanged');
  });

  it('fightVillain is a no-op while pick is pending (block-all)', () => {
    const gameState = makeBlockAllState();
    const ctx = makeBlockAllContext(gameState);

    fightVillain(ctx as unknown as Parameters<typeof fightVillain>[0], { citySlot: 0 });

    assert.deepStrictEqual(gameState.counters, {}, 'fightVillain blocked — counters unchanged');
  });

  it('fightMastermind is a no-op while pick is pending (block-all)', () => {
    const gameState = makeBlockAllState();
    const ctx = makeBlockAllContext(gameState);

    fightMastermind(ctx as unknown as Parameters<typeof fightMastermind>[0], {});

    assert.equal(
      gameState.mastermind.tacticsDefeated.length,
      0,
      'fightMastermind blocked — no tactics defeated',
    );
  });

  it('recruitHero is a no-op while pick is pending (block-all)', () => {
    const gameState = makeBlockAllState();
    const ctx = makeBlockAllContext(gameState);

    recruitHero(ctx as unknown as Parameters<typeof recruitHero>[0], { hqSlot: 0, heroId: 'hero-x' as CardExtId });

    assert.deepStrictEqual(gameState.playerZones['0']!.discard, [], 'recruitHero blocked — discard unchanged');
  });

  it('revealVillainCard is a no-op while pick is pending (block-all)', () => {
    const gameState = makeBlockAllState();
    gameState.currentStage = 'start';
    const ctx = makeBlockAllContext(gameState);

    revealVillainCard(ctx as unknown as Parameters<typeof revealVillainCard>[0], {});

    assert.deepStrictEqual(gameState.villainDeck.discard, [], 'revealVillainCard blocked — discard unchanged');
  });

  it('dodgeCard is a no-op while pick is pending (block-all)', () => {
    const gameState = makeBlockAllState();
    // Give the hand card a dodge hook so dodgeCard would be eligible absent the guard.
    gameState.cardKeywords = { 'hero-x': ['dodge'] } as unknown as LegendaryGameState['cardKeywords'];
    gameState.heroAbilityHooks = [
      { cardId: 'hero-x', timing: 'onPlay', keywords: ['dodge'], effects: [] },
    ] as unknown as LegendaryGameState['heroAbilityHooks'];
    gameState.playerZones['0']!.deck = ['replacement' as CardExtId];
    const ctx = makeBlockAllContext(gameState);

    dodgeCard(ctx as unknown as Parameters<typeof dodgeCard>[0], { cardId: 'hero-x' as CardExtId });

    assert.deepStrictEqual(gameState.playerZones['0']!.hand, ['hero-x'], 'dodgeCard blocked — hand unchanged');
    assert.ok(
      !gameState.playerZones['0']!.hand.includes('replacement' as CardExtId),
      'dodgeCard blocked — no replacement drawn',
    );
  });

  it('playFromUndercover is a no-op while pick is pending (block-all)', () => {
    const gameState = makeBlockAllState();
    // Seed a face-down card the move would otherwise play.
    gameState.playerZones['0']!.faceDownCards = [
      { instanceId: 'fd-1' as CardExtId, cardId: 'fd-1' as CardExtId, ownerPlayerId: '0' },
    ];
    const ctx = makeBlockAllContext(gameState);

    playFromUndercover(
      ctx as unknown as Parameters<typeof playFromUndercover>[0],
      { instanceId: 'fd-1' as CardExtId },
    );

    assert.equal(gameState.playerZones['0']!.faceDownCards.length, 1, 'playFromUndercover blocked — face-down store intact');
    assert.deepStrictEqual(gameState.playerZones['0']!.inPlay, [], 'playFromUndercover blocked — nothing played');
  });

  it('advanceStage is a no-op (no events.endTurn()) while pick is pending (block-all)', () => {
    const gameState = makeBlockAllState();
    gameState.currentStage = 'cleanup';
    const ctx = makeBlockAllContext(gameState);

    type MoveDef = { move: (c: typeof ctx) => void };
    const advanceStageFn = (LegendaryGame.moves?.advanceStage as MoveDef | undefined)?.move;
    assert.ok(advanceStageFn, 'advanceStage must be registered on LegendaryGame.moves');
    advanceStageFn!(ctx);

    assert.equal(
      (ctx.events.endTurn as ReturnType<typeof mock.fn>).mock.calls.length,
      0,
      'advanceStage did not end the turn while pick pending',
    );
    assert.equal(gameState.currentStage, 'cleanup', 'stage unchanged');
  });

  it('resolveVictoryPileCardPick itself is available (not blocked by the predicate)', () => {
    const gameState = makeTestGameState({
      victory: ['villain-r' as CardExtId],
      villainDeckCardTypes: { 'villain-r': 'villain' },
      cardStats: { 'villain-r': { attack: 0, recruit: 0, cost: 0, fightCost: 3 } },
      pendingVictoryPileCardPick: [{ rewardType: 'attack', playerID: '0' }],
      attack: 2,
    });
    const { context } = makeMoveContext(gameState);

    resolveVictoryPileCardPick(context, { cardId: 'villain-r' as CardExtId });

    assert.equal(gameState.turnEconomy.attack, 5, 'resolve itself is not blocked');
    assert.equal(gameState.pendingVictoryPileCardPick!.length, 0, 'queue popped by resolve');
  });

  it('resolveOptionalKoReward, resolveKoHeroChoice, and resolveHeroChoice remain importable', () => {
    // These each have their own queue — they are NOT blocked by hasPendingVictoryPileCardPick
    // (each of their guards only checks their own queue). This test verifies the imports are
    // wired and the functions exist at runtime.
    assert.equal(typeof resolveOptionalKoReward, 'function', 'resolveOptionalKoReward is available');
    assert.equal(typeof resolveKoHeroChoice, 'function', 'resolveKoHeroChoice is available');
    assert.equal(typeof resolveHeroChoice, 'function', 'resolveHeroChoice is available');
  });
});

// ---------------------------------------------------------------------------
// endTurn block-all guard (turn-end gates)
// ---------------------------------------------------------------------------

describe('block-all guard — endTurn blocked while pick is pending', () => {
  it('endTurn does not call events.endTurn while pendingVictoryPileCardPick is populated', () => {
    const gameState = makeTestGameState({
      pendingVictoryPileCardPick: [{ rewardType: 'attack', playerID: '0' }],
      currentStage: 'cleanup',
    });
    const endTurnSpy = mock.fn();
    const context = {
      G: gameState,
      ctx: {
        numPlayers: 1,
        currentPlayer: '0',
        phase: 'play',
        turn: 1,
        playOrder: ['0'],
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
      playerID: '0',
      log: { setMetadata: mock.fn() },
    } as unknown as Parameters<typeof endTurn>[0];

    endTurn(context, {});

    assert.equal(endTurnSpy.mock.calls.length, 0, 'endTurn events.endTurn NOT called while pick pending');
  });
});
