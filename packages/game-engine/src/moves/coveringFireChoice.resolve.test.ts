/**
 * Tests for the resolveCoveringFireChoice move (WP-719 / D-24541 — Hawkeye's "Covering Fire"),
 * the hasPendingCoveringFireChoice predicate, the heroEffectCoveringFire park handler (via
 * executeHeroEffects, including the [hc:tech] heroClassMatch gate), and the block-all guard.
 *
 * Covers:
 *  - draw branch → EACH OTHER seat draws 1; the active (chooser) seat is untouched; queue popped.
 *  - discard branch → EACH OTHER seat auto-discards its deterministic default (lowest cost); the
 *    chooser is untouched; an empty-hand other seat discards nothing; queue popped.
 *  - invalid choice / wrong playerID / empty queue → silent no-op (queue intact).
 *  - the block-all guard freezes another move (drawCards) while a Covering Fire choice is pending.
 *  - the [hc:tech] gate: with another tech Hero in play the hook parks; with none it parks nothing.
 *
 * Uses node:test + node:assert only. No boardgame.io imports.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCoveringFireChoice,
  hasPendingCoveringFireChoice,
} from './coveringFireChoice.resolve.js';
import { drawCards } from './coreMoves.impl.js';
import { executeHeroEffects } from '../hero/heroEffects.execute.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { LegendaryGameState, PendingCoveringFireChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';

type SeatOverride = {
  deck?: CardExtId[];
  hand?: CardExtId[];
  discard?: CardExtId[];
  inPlay?: CardExtId[];
};

/**
 * Builds a minimal N-seat LegendaryGameState for the Covering Fire flow. `seats` maps each
 * playerID to its zone contents; unspecified zones default to empty.
 */
function makeTestGameState(
  seats: Record<string, SeatOverride>,
  overrides: {
    pendingCoveringFireChoices?: PendingCoveringFireChoice[];
    currentStage?: LegendaryGameState['currentStage'];
    cardStats?: Record<string, { attack: number; recruit: number; cost: number; fightCost: number; fightCostMode: 'static' | 'dynamic'; fightCostBase: number }>;
    cardTraits?: Record<string, { heroClass: string | null; team: string | null }>;
    heroAbilityHooks?: HeroAbilityHook[];
  } = {},
): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const [seatId, zones] of Object.entries(seats)) {
    playerZones[seatId] = {
      deck: zones.deck ?? [],
      hand: zones.hand ?? [],
      discard: zones.discard ?? [],
      inPlay: zones.inPlay ?? [],
      victory: [],
    };
  }
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
      attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0,
      woundsDrawn: 0, cardsDrawn: 0,
    },
    cardStats: overrides.cardStats ?? {},
    cardKeywords: {},
    heroDeck: [],
    escapedPile: [],
    mastermind: {
      id: 'test-mastermind', baseCardId: 'test-mastermind-base',
      tacticsDeck: [] as CardExtId[], tacticsDefeated: [], strikePile: [],
      attachedBystanders: [],
    },
    scheme: { twistPile: [] },
    notableEvents: [],
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    cardDisplayData: {},
    cardTraits: overrides.cardTraits ?? {},
    schemeSetupInstructions: [],
    heroAbilityHooks: overrides.heroAbilityHooks ?? [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.pendingCoveringFireChoices !== undefined) {
    state.pendingCoveringFireChoices = overrides.pendingCoveringFireChoices;
  }
  return state;
}

/** Builds a move context for resolveCoveringFireChoice (random.Shuffle reverses to prove it ran). */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveCoveringFireChoice>[0] {
  return {
    G: gameState,
    ctx: {
      numPlayers: 3, currentPlayer: playerId, phase: 'play', turn: 1,
      playOrder: ['0', '1', '2'], playOrderPos: 0, activePlayers: null,
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
  } as unknown as Parameters<typeof resolveCoveringFireChoice>[0];
}

/** A card-stat row (only `cost` matters for selectDefaultSmashDiscardTarget). */
function stat(cost: number) {
  return { attack: 0, recruit: 0, cost, fightCost: 0, fightCostMode: 'static' as const, fightCostBase: 0 };
}

describe('resolveCoveringFireChoice — draw branch (WP-719 / D-24541)', () => {
  it('each OTHER seat draws 1; the chooser is untouched; queue front-popped', () => {
    const gameState = makeTestGameState(
      {
        '0': { hand: ['a1'] as CardExtId[], deck: ['a2', 'a3'] as CardExtId[] },
        '1': { hand: ['b1'] as CardExtId[], deck: ['b2', 'b3'] as CardExtId[] },
        '2': { hand: [] as CardExtId[], deck: ['c1'] as CardExtId[] },
      },
      { pendingCoveringFireChoices: [{ playerID: '0', sourceCardId: 'covering-fire#0' as CardExtId }] },
    );
    resolveCoveringFireChoice(makeMoveContext(gameState, '0'), { choice: 'draw' });

    // chooser (seat 0) untouched
    assert.deepEqual(gameState.playerZones['0']!.hand, ['a1']);
    assert.deepEqual(gameState.playerZones['0']!.deck, ['a2', 'a3']);
    // seat 1 drew 1 (top of deck 'b2')
    assert.equal(gameState.playerZones['1']!.hand.length, 2);
    assert.ok(gameState.playerZones['1']!.hand.includes('b2' as CardExtId));
    assert.deepEqual(gameState.playerZones['1']!.deck, ['b3']);
    // seat 2 drew 1 (its only deck card)
    assert.deepEqual(gameState.playerZones['2']!.hand, ['c1']);
    assert.deepEqual(gameState.playerZones['2']!.deck, []);
    // queue popped
    assert.equal(hasPendingCoveringFireChoice(gameState), false);
  });

  it('an other seat with an empty deck reshuffles its discard, then draws', () => {
    const gameState = makeTestGameState(
      {
        '0': { deck: ['a1'] as CardExtId[] },
        '1': { deck: [] as CardExtId[], discard: ['d1', 'd2'] as CardExtId[] },
      },
      { pendingCoveringFireChoices: [{ playerID: '0', sourceCardId: 'covering-fire#0' as CardExtId }] },
    );
    resolveCoveringFireChoice(makeMoveContext(gameState, '0'), { choice: 'draw' });
    // seat 1's discard was reshuffled into the deck (reversed by the mock Shuffle) and one drawn
    assert.equal(gameState.playerZones['1']!.hand.length, 1);
    assert.equal(gameState.playerZones['1']!.discard.length, 0);
  });
});

describe('resolveCoveringFireChoice — discard branch (WP-719 / D-24541)', () => {
  it('each OTHER seat auto-discards its lowest-cost card; the chooser is untouched; queue popped', () => {
    const gameState = makeTestGameState(
      {
        '0': { hand: ['a1'] as CardExtId[] },
        '1': { hand: ['b-cheap', 'b-pricey'] as CardExtId[] },
        '2': { hand: ['c-only'] as CardExtId[] },
      },
      {
        pendingCoveringFireChoices: [{ playerID: '0', sourceCardId: 'covering-fire#0' as CardExtId }],
        cardStats: {
          'b-cheap': stat(1), 'b-pricey': stat(5), 'c-only': stat(3), 'a1': stat(2),
        },
      },
    );
    resolveCoveringFireChoice(makeMoveContext(gameState, '0'), { choice: 'discard' });

    // chooser untouched
    assert.deepEqual(gameState.playerZones['0']!.hand, ['a1']);
    // seat 1 discarded its lowest-cost card ('b-cheap' cost 1), kept 'b-pricey'
    assert.deepEqual(gameState.playerZones['1']!.hand, ['b-pricey']);
    assert.ok(gameState.playerZones['1']!.discard.includes('b-cheap' as CardExtId));
    // seat 2 discarded its only card
    assert.deepEqual(gameState.playerZones['2']!.hand, []);
    assert.ok(gameState.playerZones['2']!.discard.includes('c-only' as CardExtId));
    // queue popped
    assert.equal(hasPendingCoveringFireChoice(gameState), false);
  });

  it('an other seat with an empty hand discards nothing (no throw); queue still pops', () => {
    const gameState = makeTestGameState(
      {
        '0': { hand: ['a1'] as CardExtId[] },
        '1': { hand: [] as CardExtId[] },
      },
      {
        pendingCoveringFireChoices: [{ playerID: '0', sourceCardId: 'covering-fire#0' as CardExtId }],
        cardStats: { 'a1': stat(2) },
      },
    );
    assert.doesNotThrow(() =>
      resolveCoveringFireChoice(makeMoveContext(gameState, '0'), { choice: 'discard' }),
    );
    assert.deepEqual(gameState.playerZones['1']!.hand, []);
    assert.deepEqual(gameState.playerZones['1']!.discard, []);
    assert.equal(hasPendingCoveringFireChoice(gameState), false);
  });
});

describe('resolveCoveringFireChoice — invalid inputs are silent no-ops', () => {
  const base = () => makeTestGameState(
    {
      '0': { hand: ['a1'] as CardExtId[] },
      '1': { hand: ['b1'] as CardExtId[], deck: ['b2'] as CardExtId[] },
    },
    {
      pendingCoveringFireChoices: [{ playerID: '0', sourceCardId: 'covering-fire#0' as CardExtId }],
      cardStats: { 'a1': stat(2), 'b1': stat(1) },
    },
  );

  it('unknown choice value → no-op, queue intact', () => {
    const gameState = base();
    resolveCoveringFireChoice(makeMoveContext(gameState, '0'), { choice: 'nonsense' } as never);
    assert.equal(hasPendingCoveringFireChoice(gameState), true);
    assert.deepEqual(gameState.playerZones['1']!.hand, ['b1']);
  });

  it('wrong playerID → no-op, queue intact', () => {
    const gameState = base();
    resolveCoveringFireChoice(makeMoveContext(gameState, '1'), { choice: 'draw' });
    assert.equal(hasPendingCoveringFireChoice(gameState), true);
    assert.deepEqual(gameState.playerZones['1']!.hand, ['b1']);
  });

  it('empty queue → no-op, never throws', () => {
    const gameState = makeTestGameState({ '0': {}, '1': { hand: ['b1'] as CardExtId[] } });
    assert.doesNotThrow(() =>
      resolveCoveringFireChoice(makeMoveContext(gameState, '0'), { choice: 'draw' }),
    );
    assert.equal(hasPendingCoveringFireChoice(gameState), false);
  });
});

describe('hasPendingCoveringFireChoice block-all guard', () => {
  it('drawCards no-ops while a Covering Fire choice is pending', () => {
    const gameState = makeTestGameState(
      {
        '0': { hand: [] as CardExtId[], deck: ['a1', 'a2'] as CardExtId[] },
        '1': { hand: [] as CardExtId[] },
      },
      {
        pendingCoveringFireChoices: [{ playerID: '0', sourceCardId: 'covering-fire#0' as CardExtId }],
        currentStage: 'start',
      },
    );
    drawCards(makeMoveContext(gameState, '0') as never, { count: 1 } as never);
    // the guard froze the board: no card drawn for the active player
    assert.equal(gameState.playerZones['0']!.hand.length, 0);
  });
});

describe('heroEffectCoveringFire park handler + [hc:tech] gate (WP-719 / D-24541)', () => {
  const coveringFireHook: HeroAbilityHook = {
    cardId: 'hawkeye-covering-fire' as string,
    timing: 'onPlay',
    keywords: ['covering-fire'],
    effects: [{ type: 'covering-fire' }],
    // why: the [hc:tech] prefix parses as this heroClassMatch play-gate condition.
    conditions: [{ type: 'heroClassMatch', value: 'tech' }],
  } as unknown as HeroAbilityHook;

  it('parks a PendingCoveringFireChoice for the active player when another tech Hero is in play', () => {
    const gameState = makeTestGameState(
      { '0': { inPlay: ['hawkeye-covering-fire', 'iron-man'] as CardExtId[] }, '1': {} },
      {
        heroAbilityHooks: [coveringFireHook],
        // why: iron-man is another in-play tech Hero → heroClassMatch('tech') passes
        // (the triggering hawkeye card is self-excluded).
        cardTraits: {
          'hawkeye-covering-fire': { heroClass: 'tech', team: null },
          'iron-man': { heroClass: 'tech', team: null },
        },
      },
    );
    executeHeroEffects(gameState, makeMockCtx({ numPlayers: 2 }), '0', 'hawkeye-covering-fire' as string);
    assert.equal(hasPendingCoveringFireChoice(gameState), true);
    const front = gameState.pendingCoveringFireChoices![0]!;
    assert.equal(front.playerID, '0');
    assert.equal(front.sourceCardId, 'hawkeye-covering-fire');
  });

  it('parks NOTHING when the [hc:tech] gate fails (no other tech Hero in play)', () => {
    const gameState = makeTestGameState(
      { '0': { inPlay: ['hawkeye-covering-fire'] as CardExtId[] }, '1': {} },
      {
        heroAbilityHooks: [coveringFireHook],
        // why: only the triggering hawkeye card is tech, and it is self-excluded → gate fails.
        cardTraits: { 'hawkeye-covering-fire': { heroClass: 'tech', team: null } },
      },
    );
    executeHeroEffects(gameState, makeMockCtx({ numPlayers: 2 }), '0', 'hawkeye-covering-fire' as string);
    assert.equal(hasPendingCoveringFireChoice(gameState), false);
  });
});
