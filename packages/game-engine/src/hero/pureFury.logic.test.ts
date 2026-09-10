/**
 * Tests for Nick Fury's Pure Fury — conditional free defeat (WP-682 / EC-719 / D-24499).
 *
 * Covers: countShieldHeroesInKo (S.H.I.E.L.D.-team Heroes in the GLOBAL KO pile, HYDRA
 * excluded); buildPureFuryTargets (printed attack STRICTLY less than the count; City
 * Villains + the Mastermind; a tactic-less Mastermind excluded; 0/1/≥2 cardinality); and
 * resolveDefeatChoice accepting the 'pure-fury' discriminant to defeat the chosen target
 * for FREE (no attack spent) through the shared defeat path. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countShieldHeroesInKo, buildPureFuryTargets } from './heroEffects.execute.js';
import { resolveDefeatChoice, hasPendingDefeatChoice } from '../moves/defeatChoice.resolve.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

interface StatEntry {
  attack: number;
  recruit: number;
  cost: number;
  fightCost: number;
  fightCostMode: 'static' | 'dynamic';
  fightCostBase: number;
}

/** A static villain/mastermind stat row whose printed attack is `printedAttack`. */
function staticFightStats(printedAttack: number): StatEntry {
  return { attack: 0, recruit: 0, cost: 0, fightCost: printedAttack, fightCostMode: 'static', fightCostBase: 0 };
}

interface MockGOptions {
  city?: (CardExtId | null)[];
  ko?: CardExtId[];
  cardTraits?: Record<string, { heroClass: string | null; team: string | null }>;
  cardStats?: Record<string, StatEntry>;
  mastermindBaseCardId?: string;
  mastermindTacticsDeck?: CardExtId[];
  attack?: number;
  pendingDefeatChoices?: LegendaryGameState['pendingDefeatChoices'];
}

/** Minimal LegendaryGameState for Pure Fury tests. */
function makeG(options?: MockGOptions): LegendaryGameState {
  const config = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: ['g'],
    henchmanGroupIds: ['h'],
    heroDeckIds: ['d'],
    bystandersCount: 0,
    woundsCount: 0,
    officersCount: 0,
    sidekicksCount: 0,
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
    currentStage: 'main',
    playerZones: {
      '0': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      '1': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    cardTraits: options?.cardTraits ?? {},
    villainAbilityHooks: [],
    piles: { ...makeGlobalPiles(), bystanders: [], wounds: [], officers: [], sidekicks: [] },
    messages: [],
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: (options?.ko ?? []) as CardExtId[],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    turnEconomy: { ...makeTurnEconomy(), attack: options?.attack ?? 0, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    cardStats: (options?.cardStats ?? {}) as LegendaryGameState['cardStats'],
    mastermind: { ...makeMastermindState(),
      id: 'test-mastermind',
      baseCardId: (options?.mastermindBaseCardId ?? 'test-mastermind-base') as CardExtId,
      tacticsDeck: (options?.mastermindTacticsDeck ?? []) as CardExtId[],
      tacticsDefeated: [],
      attachedBystanders: [],
    },
    city: (options?.city as LegendaryGameState['city']) ?? initializeCity(),
    hq: initializeHq(),
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    notableEvents: [],
    cardDisplayData: {},
    ...(options?.pendingDefeatChoices ? { pendingDefeatChoices: options.pendingDefeatChoices } : {}),
  } as unknown as LegendaryGameState;
}

/** A move context with a real currentPlayer + turn (mirrors defeatChoice.resolve.test). */
function makeMoveContext(gameState: LegendaryGameState) {
  const mockCtx = makeMockCtx({ numPlayers: 2 });
  return {
    G: gameState,
    ctx: { ...mockCtx.ctx, currentPlayer: '0', turn: 1, phase: 'play' },
    random: mockCtx.random,
    events: { endTurn: () => {}, setPhase: () => {}, endGame: () => {} },
    playerID: '0' as string,
    log: { setMetadata: () => {} },
  };
}

describe('countShieldHeroesInKo (WP-682 / D-24499)', () => {
  it('counts S.H.I.E.L.D.-team Heroes in the global KO pile, excluding HYDRA and non-team cards', () => {
    const G = makeG({
      ko: ['sh-1', 'sh-2', 'hydra-1', 'nonteam-1'],
      cardTraits: {
        'sh-1': { heroClass: 'tech', team: 'shield' },
        'sh-2': { heroClass: 'covert', team: 'shield' },
        'hydra-1': { heroClass: null, team: 'hydra' },
        'nonteam-1': { heroClass: 'ranged', team: 'avengers' },
      },
    });
    assert.equal(countShieldHeroesInKo(G), 2);
  });

  it('is 0 for an empty KO pile', () => {
    assert.equal(countShieldHeroesInKo(makeG({ ko: [] })), 0);
  });
});

describe('buildPureFuryTargets (WP-682 / D-24499)', () => {
  it('returns 0 targets when no Villain/Mastermind attack is strictly below the count', () => {
    const G = makeG({
      ko: ['sh-1'],
      cardTraits: { 'sh-1': { heroClass: 'tech', team: 'shield' } },
      city: ['villain-a', null, null, null, null],
      cardStats: { 'villain-a': staticFightStats(1), 'mm-base': staticFightStats(5) },
      mastermindBaseCardId: 'mm-base',
      mastermindTacticsDeck: ['t1'],
    });
    // KO count = 1; villain attack 1 is NOT < 1; mastermind 5 not < 1.
    assert.deepStrictEqual(buildPureFuryTargets(G), []);
  });

  it('a City Villain with printed attack STRICTLY less than the count is a target', () => {
    const G = makeG({
      ko: ['sh-1', 'sh-2'],
      cardTraits: { 'sh-1': { heroClass: 'tech', team: 'shield' }, 'sh-2': { heroClass: 'covert', team: 'shield' } },
      city: ['villain-a', null, null, null, null],
      cardStats: { 'villain-a': staticFightStats(1) },
    });
    // KO count = 2; villain attack 1 < 2 → eligible.
    assert.deepStrictEqual(buildPureFuryTargets(G), [
      { kind: 'villain', cityIndex: 0, cardId: 'villain-a' },
    ]);
  });

  it('includes the Mastermind (with a tactic remaining) when its printed attack is below the count', () => {
    const G = makeG({
      ko: ['sh-1', 'sh-2', 'sh-3'],
      cardTraits: {
        'sh-1': { heroClass: 'tech', team: 'shield' },
        'sh-2': { heroClass: 'covert', team: 'shield' },
        'sh-3': { heroClass: 'ranged', team: 'shield' },
      },
      city: ['villain-a', null, null, null, null],
      cardStats: { 'villain-a': staticFightStats(2), 'mm-base': staticFightStats(2) },
      mastermindBaseCardId: 'mm-base',
      mastermindTacticsDeck: ['t1', 't2'],
    });
    // KO count = 3; villain 2 < 3 and mastermind 2 < 3 → both, City first, Mastermind last.
    assert.deepStrictEqual(buildPureFuryTargets(G), [
      { kind: 'villain', cityIndex: 0, cardId: 'villain-a' },
      { kind: 'mastermind', cardId: 'mm-base' },
    ]);
  });

  it('excludes a Mastermind with no tactics left even when its attack is below the count', () => {
    const G = makeG({
      ko: ['sh-1', 'sh-2'],
      cardTraits: { 'sh-1': { heroClass: 'tech', team: 'shield' }, 'sh-2': { heroClass: 'covert', team: 'shield' } },
      city: [null, null, null, null, null],
      cardStats: { 'mm-base': staticFightStats(1) },
      mastermindBaseCardId: 'mm-base',
      mastermindTacticsDeck: [],
    });
    assert.deepStrictEqual(buildPureFuryTargets(G), []);
  });
});

describe('resolveDefeatChoice — pure-fury discriminant (WP-682 / D-24499)', () => {
  it('accepts a parked pure-fury choice and defeats the chosen City Villain for FREE (no attack spent)', () => {
    const G = makeG({
      city: ['villain-a', 'villain-b', null, null, null],
      cardStats: { 'villain-a': staticFightStats(0), 'villain-b': staticFightStats(0) },
      attack: 0,
      pendingDefeatChoices: [
        {
          choiceType: 'pure-fury',
          playerID: '0',
          targets: [
            { kind: 'villain', cityIndex: 0, cardId: 'villain-a' },
            { kind: 'villain', cityIndex: 1, cardId: 'villain-b' },
          ],
        },
      ],
    });
    const context = makeMoveContext(G);

    resolveDefeatChoice(context as never, { targetKind: 'villain', cityIndex: 0 });

    assert.equal(G.city[0], null, 'the chosen villain is defeated');
    assert.ok(G.playerZones['0']!.victory.includes('villain-a'), 'the villain moved to the victory pile');
    assert.equal(G.city[1], 'villain-b', 'the un-chosen villain is untouched');
    assert.equal(G.turnEconomy.attack, 0, 'no attack was spent (free defeat)');
    assert.equal(G.turnEconomy.spentAttack, 0, 'no attack was spent (free defeat)');
    assert.equal(hasPendingDefeatChoice(G), false, 'the pending choice is front-popped');
  });
});
