/**
 * Tests for Nick Fury's Pure Fury — conditional free defeat (WP-682 / EC-719 / D-24499).
 *
 * Covers: countShieldHeroesInKo (S.H.I.E.L.D.-team Heroes in the GLOBAL KO pile, HYDRA
 * excluded); buildPureFuryTargets (current Attack STRICTLY less than the count, D-24741; City
 * Villains + the Mastermind; a tactic-less Mastermind excluded; 0/1/≥2 cardinality); and
 * resolveDefeatChoice accepting the 'pure-fury' discriminant to defeat the chosen target
 * for FREE (no attack spent) through the shared defeat path. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countShieldHeroesInKo, buildPureFuryTargets, executeSingleEffect } from './heroEffects.execute.js';
import {
  resolveDefeatChoice,
  hasPendingDefeatChoice,
  buildDefeatWithBystanderTargets,
  dispatchDefeatWithBystanderTarget,
  isMastermindFreeDefeatTarget,
} from '../moves/defeatChoice.resolve.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import type { LegendaryGameState } from '../types.js';
import { DARK_PORTAL_COUNT } from '../types.js';
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

describe('free defeats strike the Final Blow (D-24739)', () => {
  const SHIELD_KO: CardExtId[] = ['sh-1', 'sh-2', 'sh-3'] as CardExtId[];
  const SHIELD_TRAITS = {
    'sh-1': { heroClass: 'tech', team: 'shield' },
    'sh-2': { heroClass: 'covert', team: 'shield' },
    'sh-3': { heroClass: 'ranged', team: 'shield' },
  };

  /**
   * A Final Blow state with every Tactic defeated: the Mastermind's printed attack is 2,
   * the KO pile holds 3 S.H.I.E.L.D. Heroes, and the City is empty unless `city` is given.
   */
  function finalBlowG(options: {
    finalBlow?: boolean;
    finalBlowPending?: boolean;
    city?: (CardExtId | null)[];
    mastermindBystanders?: CardExtId[];
    pendingDefeatChoices?: LegendaryGameState['pendingDefeatChoices'];
  }): LegendaryGameState {
    const G = makeG({
      ko: SHIELD_KO,
      cardTraits: SHIELD_TRAITS,
      city: options.city ?? [null, null, null, null, null],
      cardStats: { 'mm-base': staticFightStats(2), 'villain-a': staticFightStats(0) },
      mastermindBaseCardId: 'mm-base',
      mastermindTacticsDeck: [],
      ...(options.pendingDefeatChoices ? { pendingDefeatChoices: options.pendingDefeatChoices } : {}),
    });
    if (options.finalBlow !== undefined) {
      (G as unknown as { finalBlow: boolean }).finalBlow = options.finalBlow;
    }
    G.mastermind = {
      ...G.mastermind,
      tacticsDefeated: ['t1', 't2', 't3', 't4'] as CardExtId[],
      attachedBystanders: options.mastermindBystanders ?? [],
      ...(options.finalBlowPending !== undefined ? { finalBlowPending: options.finalBlowPending } : {}),
    };
    return G;
  }

  it('Pure Fury targets the Mastermind while the final blow is pending', () => {
    const G = finalBlowG({ finalBlow: true, finalBlowPending: true });
    assert.deepStrictEqual(buildPureFuryTargets(G), [{ kind: 'mastermind', cardId: 'mm-base' }]);
  });

  it('a vanquished Mastermind (final blow already struck) is not a target', () => {
    const G = finalBlowG({ finalBlow: true, finalBlowPending: false });
    assert.deepStrictEqual(buildPureFuryTargets(G), []);
  });

  it('with Final Blow off, a tactic-less Mastermind stays excluded (unchanged)', () => {
    const G = finalBlowG({});
    assert.deepStrictEqual(buildPureFuryTargets(G), []);
  });

  it('a chosen Pure Fury final blow awards the Mastermind card for free and latches the win', () => {
    const G = finalBlowG({
      finalBlow: true,
      finalBlowPending: true,
      city: ['villain-a', null, null, null, null],
      pendingDefeatChoices: [
        {
          choiceType: 'pure-fury',
          playerID: '0',
          targets: [
            { kind: 'villain', cityIndex: 0, cardId: 'villain-a' as CardExtId },
            { kind: 'mastermind', cardId: 'mm-base' as CardExtId },
          ],
        },
      ],
    });
    resolveDefeatChoice(makeMoveContext(G) as never, { targetKind: 'mastermind' });

    assert.ok(G.playerZones['0']!.victory.includes('mm-base' as CardExtId), 'the Mastermind card is in the Victory Pile');
    assert.equal(G.mastermind.finalBlowPending, false, 'the final blow is no longer pending');
    assert.equal(G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING], 1, 'the win is latched for turn end');
    assert.equal(G.turnEconomy.spentAttack, 0, 'no attack was spent (free defeat)');
    assert.equal(G.city[0], 'villain-a', 'the un-chosen Villain is untouched');
    assert.ok(G.messages.some((entry) => /struck the final blow and defeated/.test(entry.text)));
  });

  it('a one-target Pure Fury play strikes the final blow with no prompt', () => {
    const G = finalBlowG({ finalBlow: true, finalBlowPending: true });
    const context = makeMoveContext(G);
    executeSingleEffect(G, context, '0', 'core/nick-fury/pure-fury#0' as CardExtId, { type: 'pure-fury' });

    assert.equal(hasPendingDefeatChoice(G), false, 'no prompt for a single target');
    assert.ok(G.playerZones['0']!.victory.includes('mm-base' as CardExtId));
    assert.equal(G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING], 1);
  });

  it('Silent Sniper can strike the final blow on a Mastermind holding a Bystander, rescuing it', () => {
    const G = finalBlowG({ finalBlow: true, finalBlowPending: true, mastermindBystanders: ['pile-bystander' as CardExtId] });
    assert.deepStrictEqual(buildDefeatWithBystanderTargets(G), [{ kind: 'mastermind', cardId: 'mm-base' }]);
    dispatchDefeatWithBystanderTarget(G, { currentPlayer: '0', turn: 1 }, { kind: 'mastermind', cardId: 'mm-base' as CardExtId }, { random: makeMockCtx().random });

    const victory = G.playerZones['0']!.victory;
    assert.ok(victory.includes('mm-base' as CardExtId));
    assert.ok(victory.includes('pile-bystander' as CardExtId), 'the held Bystander is rescued');
    assert.deepStrictEqual(G.mastermind.attachedBystanders, []);
  });

  it('isMastermindFreeDefeatTarget: tactic left, final blow pending, or neither', () => {
    assert.equal(isMastermindFreeDefeatTarget(finalBlowG({ finalBlow: true, finalBlowPending: true })), true);
    assert.equal(isMastermindFreeDefeatTarget(finalBlowG({ finalBlow: true, finalBlowPending: false })), false);
    assert.equal(isMastermindFreeDefeatTarget(finalBlowG({})), false);
    const withTactic = finalBlowG({});
    withTactic.mastermind = { ...withTactic.mastermind, tacticsDeck: ['t5'] as CardExtId[] };
    assert.equal(isMastermindFreeDefeatTarget(withTactic), true);
  });
});

// ---------------------------------------------------------------------------
// D-24741 — Pure Fury compares the target's CURRENT Attack (Jeff ruling)
// ---------------------------------------------------------------------------

describe('buildPureFuryTargets reads the current Attack (D-24741)', () => {
  /**
   * N S.H.I.E.L.D. Heroes for the KO pile, with their traits.
   *
   * @param count How many S.H.I.E.L.D. Heroes.
   * @returns The KO ids and the cardTraits rows.
   */
  function shieldKo(count: number): { ko: CardExtId[]; cardTraits: Record<string, { heroClass: string | null; team: string | null }> } {
    const ko: CardExtId[] = [];
    const cardTraits: Record<string, { heroClass: string | null; team: string | null }> = {};
    for (let index = 0; index < count; index++) {
      const cardId = `sh-${String(index)}` as CardExtId;
      ko.push(cardId);
      cardTraits[cardId] = { heroClass: 'tech', team: 'shield' };
    }
    return { ko, cardTraits };
  }

  /**
   * Turns a test state into a Portals game with `portalCount` Dark Portals open.
   *
   * @param G The state to change.
   * @param portalCount Dark Portals opened so far (1 = above the Mastermind).
   */
  function openDarkPortals(G: LegendaryGameState, portalCount: number): void {
    G.selection = { ...G.selection, schemeId: 'core/portals-to-the-dark-dimension' };
    G.counters = { ...G.counters, [DARK_PORTAL_COUNT]: portalCount };
  }

  it('tXTkG2Pardt: Loki printed 10 with the Mastermind Dark Portal is 11, not below 11 S.H.I.E.L.D. Heroes', () => {
    const G = makeG({
      ...shieldKo(11),
      city: [null, null, null, null, null],
      cardStats: { 'mm-base': staticFightStats(10) },
      mastermindBaseCardId: 'mm-base',
      mastermindTacticsDeck: ['t1'],
    });
    assert.deepStrictEqual(buildPureFuryTargets(G, '0'), [{ kind: 'mastermind', cardId: 'mm-base' }], 'printed 10 < 11 without a portal');
    openDarkPortals(G, 1);
    assert.deepStrictEqual(buildPureFuryTargets(G, '0'), [], '10 + 1 Dark Portal = 11 is not less than 11');
    G.ko = shieldKo(12).ko;
    G.cardTraits = shieldKo(12).cardTraits;
    assert.deepStrictEqual(buildPureFuryTargets(G, '0'), [{ kind: 'mastermind', cardId: 'mm-base' }], '11 < 12');
  });

  it('a Villain standing in a Dark Portal space counts its +1', () => {
    const G = makeG({
      ...shieldKo(3),
      city: ['villain-a', null, null, null, 'villain-b'],
      cardStats: { 'villain-a': staticFightStats(2), 'villain-b': staticFightStats(2) },
    });
    // why: two Dark Portals → the Mastermind and City space 4 (the Bridge) are portal'd.
    openDarkPortals(G, 2);
    assert.deepStrictEqual(buildPureFuryTargets(G, '0'), [
      { kind: 'villain', cityIndex: 0, cardId: 'villain-a' },
    ], 'villain-b is 2 + 1 = 3, not below 3');
  });

  it('a dynamic Villain counts its captured Heroes, not just its printed base', () => {
    const G = makeG({
      ...shieldKo(3),
      city: ['villain-dyn', null, null, null, null],
      cardStats: {
        'villain-dyn': { attack: 0, recruit: 0, cost: 0, fightCost: 0, fightCostMode: 'dynamic', fightCostBase: 1 },
        'captured-hero': { attack: 0, recruit: 0, cost: 2, fightCost: 0, fightCostMode: 'static', fightCostBase: 0 },
      },
    });
    G.villainAttachedHeroes = { 'villain-dyn': ['captured-hero' as CardExtId] };
    assert.deepStrictEqual(buildPureFuryTargets(G, '0'), [], 'base 1 + captured cost 2 = 3, not below 3');
  });

  it('a "-N attack" reduction this turn lowers the Mastermind into range', () => {
    const G = makeG({
      ...shieldKo(3),
      city: [null, null, null, null, null],
      cardStats: { 'mm-base': staticFightStats(4) },
      mastermindBaseCardId: 'mm-base',
      mastermindTacticsDeck: ['t1'],
    });
    assert.deepStrictEqual(buildPureFuryTargets(G, '0'), [], 'printed 4 is not below 3');
    G.turnEconomy = { ...G.turnEconomy, fightCostReductions: [{ target: 'mastermind', amount: 2, sourceCardId: 'storm-card' as CardExtId }] };
    assert.deepStrictEqual(buildPureFuryTargets(G, '0'), [{ kind: 'mastermind', cardId: 'mm-base' }], '4 - 2 = 2 < 3');
  });

  it('playing Pure Fury with only a portal-boosted Mastermind logs that nothing is weak enough', () => {
    const G = makeG({
      ...shieldKo(11),
      city: [null, null, null, null, null],
      cardStats: { 'mm-base': staticFightStats(10) },
      mastermindBaseCardId: 'mm-base',
      mastermindTacticsDeck: ['t1'],
    });
    openDarkPortals(G, 1);
    executeSingleEffect(G, makeMoveContext(G), '0', 'core/nick-fury/pure-fury#0' as CardExtId, { type: 'pure-fury' });
    assert.deepStrictEqual(G.mastermind.tacticsDefeated, [], 'no Tactic was defeated');
    assert.ok(
      G.messages.some((entry) => entry.text.includes('found no Villain or Mastermind weak enough for Pure Fury')),
      'the blocked line explains why',
    );
  });
});
