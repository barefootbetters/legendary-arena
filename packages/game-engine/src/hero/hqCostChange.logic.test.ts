/**
 * "Heroes currently in the HQ cost N less / more this turn" (WP-868 / D-24811).
 *
 * chmp Tim Boo Ba and asrd Jormungand (Fight, 1 less), vnom Dr. Carlton Drake (Fight, 1 less,
 * Instinct and Tech Heroes only) and msis The Mind Stone (Ambush, 2 more) logged an
 * `unmarked-ability` hollow and did nothing. These tests build the REAL villain hooks from the
 * committed card data, fire them through the real executor, and price through the real
 * resolveRecruitCost, end-of-turn cleanup and buildUIState, so the parse, the overlay, the price
 * and the projection are pinned together.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { executeVillainAbilities } from '../villain/villainEffects.execute.js';
import { applyEndOfTurnCleanup } from '../moves/endOfTurnCleanup.logic.js';
import { buildUIState } from '../ui/uiState.build.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { resolveRecruitCost } from './sizeChanging.logic.js';
import { getHqCostChange } from './hqCostChange.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import {
  makeCardRegistryReader,
  makeCardStatEntry,
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the
// amwpWaspSizeChanging.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

// Synthetic HQ Heroes: copy-unique ids, as buildHeroDeck makes them.
const TECH_HERO = 'test/hero/tech-hero#0' as CardExtId;
const INSTINCT_HERO = 'test/hero/instinct-hero#0' as CardExtId;
const COVERT_HERO = 'test/hero/covert-hero#0' as CardExtId;
const DUAL_RANGED_INSTINCT = 'test/hero/dual-ranged-instinct#0' as CardExtId;
const ZERO_COST_HERO = 'test/hero/zero-cost#0' as CardExtId;
const REFILL_HERO = 'test/hero/refill-hero#0' as CardExtId;
const SIZE_CHANGER = 'test/hero/size-changer#0' as CardExtId;
const PLAYED_STRENGTH = 'test/hero/played-strength#0' as CardExtId;

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0', numPlayers: 2 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};
const VILLAIN_CTX = { currentPlayer: '0', turn: 1 };

/**
 * Builds a registry stub over the given committed sets.
 *
 * @param setAbbrs - The sets to expose.
 * @returns A registry exposing getSet / listCards.
 */
function makeSetRegistry(setAbbrs: string[]): { listCards: () => never[]; getSet: (abbr: string) => unknown } {
  const sets: Record<string, unknown> = {};
  for (const setAbbr of setAbbrs) {
    sets[setAbbr] = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  }
  return { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
}

/**
 * Builds the real villain hooks for the four villain groups that carry the cost change.
 *
 * @returns The villain hooks.
 */
function buildCostChangeVillainHooks(): VillainAbilityHook[] {
  const config = {
    villainGroupIds: ['chmp/monsters-unleashed', 'asrd/omens-of-ragnarok', 'vnom/life-foundation', 'msis/infinity-stones'],
    henchmanGroupIds: [],
  } as unknown as MatchSetupConfig;
  return buildVillainAbilityHooks(makeSetRegistry(['chmp', 'asrd', 'vnom', 'msis']), config);
}

/**
 * Finds the first copy id of a villain card in the built hooks.
 *
 * @param hooks - The villain hooks.
 * @param cardPrefix - The `${set}-villain-${group}-${card}` prefix.
 * @returns The copy-indexed villain id.
 */
function villainCopyId(hooks: VillainAbilityHook[], cardPrefix: string): CardExtId {
  const hook = hooks.find((candidate) => candidate.cardId.startsWith(`${cardPrefix}-`));
  assert.ok(hook !== undefined, `a hook exists for ${cardPrefix}`);
  return hook.cardId;
}

const HOOKS = buildCostChangeVillainHooks();
const TIM_BOO_BA = villainCopyId(HOOKS, 'chmp-villain-monsters-unleashed-tim-boo-ba');
const JORMUNGAND = villainCopyId(HOOKS, 'asrd-villain-omens-of-ragnarok-jormungand-the-world-serpent');
const CARLTON_DRAKE = villainCopyId(HOOKS, 'vnom-villain-life-foundation-dr-carlton-drake');
const MIND_STONE = villainCopyId(HOOKS, 'msis-villain-infinity-stones-the-mind-stone');

/**
 * A two-seat state wide enough for the executor, the price and end-of-turn cleanup.
 *
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(): LegendaryGameState {
  const stat = (cost: number) => makeCardStatEntry({ cost });
  return {
    currentStage: 'main',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones() }, '1': { ...makePlayerZones() } },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    city: [null, null, null, null, null],
    hq: [TECH_HERO, INSTINCT_HERO, COVERT_HERO, DUAL_RANGED_INSTINCT, ZERO_COST_HERO],
    heroDeck: [],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    scheme: { twistPile: [] },
    heroAbilityHooks: [],
    villainAbilityHooks: HOOKS,
    cardStats: {
      [TECH_HERO]: stat(5), [INSTINCT_HERO]: stat(4), [COVERT_HERO]: stat(3),
      [DUAL_RANGED_INSTINCT]: stat(6), [ZERO_COST_HERO]: stat(0), [REFILL_HERO]: stat(5),
      [SIZE_CHANGER]: stat(1), [PLAYED_STRENGTH]: stat(3),
    },
    cardTraits: {
      [TECH_HERO]: { heroClass: 'tech', team: null },
      [INSTINCT_HERO]: { heroClass: 'instinct', team: null },
      [COVERT_HERO]: { heroClass: 'covert', team: null },
      [DUAL_RANGED_INSTINCT]: { heroClass: 'ranged', heroClass2: 'instinct', team: null },
      [ZERO_COST_HERO]: { heroClass: 'strength', team: null },
      [REFILL_HERO]: { heroClass: 'tech', team: null },
      [SIZE_CHANGER]: { heroClass: 'strength', team: null },
      [PLAYED_STRENGTH]: { heroClass: 'strength', team: null },
    },
    cardSizeChangingClasses: { [SIZE_CHANGER]: ['strength'] },
    cardKeywords: {},
    cardDisplayData: {
      [TECH_HERO]: { name: 'Tech Hero', imageUrl: '', cost: 5 },
      [INSTINCT_HERO]: { name: 'Instinct Hero', imageUrl: '', cost: 4 },
      [COVERT_HERO]: { name: 'Covert Hero', imageUrl: '', cost: 3 },
      [DUAL_RANGED_INSTINCT]: { name: 'Dual Hero', imageUrl: '', cost: 6 },
      [ZERO_COST_HERO]: { name: 'Zero Hero', imageUrl: '', cost: 0 },
      [TIM_BOO_BA]: { name: 'Tim Boo Ba', imageUrl: '', cost: 0 },
      [CARLTON_DRAKE]: { name: 'Dr. Carlton Drake', imageUrl: '', cost: 0 },
      [MIND_STONE]: { name: 'The Mind Stone', imageUrl: '', cost: 0 },
    },
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/**
 * Returns the text of the last log line.
 *
 * @param G - The game state.
 * @returns The last message text.
 */
function lastLog(G: LegendaryGameState): string {
  return G.messages[G.messages.length - 1]?.text ?? '';
}

/**
 * Prices every HQ slot for player 0.
 *
 * @param G - The game state.
 * @returns One price per slot, null for an empty slot.
 */
function hqPrices(G: LegendaryGameState): (number | null)[] {
  const prices: (number | null)[] = [];
  for (const cardId of G.hq) {
    prices.push(cardId === null ? null : resolveRecruitCost(G, '0', cardId));
  }
  return prices;
}

describe('WP-868 RS-4 parse: the four HQ cost change lines', () => {
  it('each marked line parses to its descriptor from the committed card data', () => {
    const expected: [string, 'onFight' | 'onAmbush', Record<string, unknown>][] = [
      ['chmp-villain-monsters-unleashed-tim-boo-ba', 'onFight',
        { primitive: 'hq-heroes-cost-change', costChangeDirection: 'less', magnitude: 1 }],
      ['asrd-villain-omens-of-ragnarok-jormungand-the-world-serpent', 'onFight',
        { primitive: 'hq-heroes-cost-change', costChangeDirection: 'less', magnitude: 1 }],
      ['vnom-villain-life-foundation-dr-carlton-drake', 'onFight',
        { primitive: 'hq-heroes-cost-change', costChangeDirection: 'less', magnitude: 1, costChangeClasses: ['instinct', 'tech'] }],
      ['msis-villain-infinity-stones-the-mind-stone', 'onAmbush',
        { primitive: 'hq-heroes-cost-change', costChangeDirection: 'more', magnitude: 2 }],
    ];
    for (const [prefix, timing, descriptor] of expected) {
      const timingHooks = HOOKS.filter((hook) => hook.cardId.startsWith(`${prefix}-`) && hook.timing === timing);
      assert.ok(timingHooks.length > 0, `${prefix} has a ${timing} hook`);
      for (const timingHook of timingHooks) {
        assert.deepStrictEqual(timingHook.effects, [descriptor], `${timingHook.cardId} ${timing}`);
        assert.deepStrictEqual(timingHook.unresolvedMarkers ?? [], [], 'the marker resolves');
      }
    }
  });
});

describe('WP-868 RS-1 HQ cost change (D-24811)', () => {
  it("Tim Boo Ba's Fight lowers every current HQ Hero's recruit price by 1 and names them", () => {
    const G = makeState();
    assert.deepStrictEqual(hqPrices(G), [5, 4, 3, 6, 0], 'precondition: printed prices');
    executeVillainAbilities(G, VILLAIN_CTX, TIM_BOO_BA, 'onFight');
    assert.deepStrictEqual(hqPrices(G), [4, 3, 2, 5, 0], 'each Hero costs 1 less; a 0-cost Hero stays 0');
    assert.equal(G.hqCostChanges?.length, 5, 'one overlay entry per HQ Hero');
    assert.equal(
      lastLog(G),
      'Fight effect: Heroes in the HQ cost 1 less this turn (Tim Boo Ba): Tech Hero, Instinct Hero, Covert Hero, Dual Hero, Zero Hero.',
    );
  });

  it("Jormungand's Fight is the same 1-less change", () => {
    const G = makeState();
    executeVillainAbilities(G, VILLAIN_CTX, JORMUNGAND, 'onFight');
    assert.deepStrictEqual(hqPrices(G), [4, 3, 2, 5, 0]);
  });

  it('a Hero placed in the HQ after the Fight pays its printed price', () => {
    const G = makeState();
    executeVillainAbilities(G, VILLAIN_CTX, TIM_BOO_BA, 'onFight');
    G.hq[0] = REFILL_HERO;
    assert.equal(resolveRecruitCost(G, '0', REFILL_HERO), 5, '"currently in the HQ" excludes a later refill');
  });

  it('Dr. Carlton Drake changes only Instinct and Tech Heroes; a dual-class Hero with either counts', () => {
    const G = makeState();
    executeVillainAbilities(G, VILLAIN_CTX, CARLTON_DRAKE, 'onFight');
    assert.deepStrictEqual(hqPrices(G), [4, 3, 3, 5, 0], 'Tech, Instinct and Ranged/Instinct drop; Covert and Strength stay');
    assert.equal(
      lastLog(G),
      'Fight effect: Heroes in the HQ cost 1 less this turn (Dr. Carlton Drake): Tech Hero, Instinct Hero, Dual Hero.',
    );
  });

  it("The Mind Stone's Ambush raises every current HQ Hero's price by 2", () => {
    const G = makeState();
    executeVillainAbilities(G, VILLAIN_CTX, MIND_STONE, 'onAmbush');
    assert.deepStrictEqual(hqPrices(G), [7, 6, 5, 8, 2]);
    assert.ok(lastLog(G).startsWith('Ambush effect: Heroes in the HQ cost 2 more this turn (The Mind Stone): '));
  });

  it('the change applies before Size-Changing (floor at 0, then the discount)', () => {
    const G = makeState();
    G.hq = [SIZE_CHANGER, null, null, null, null] as LegendaryGameState['hq'];
    G.playerZones['0']!.inPlay = [PLAYED_STRENGTH];
    assert.equal(resolveRecruitCost(G, '0', SIZE_CHANGER), 0, 'precondition: printed 1, Size-Changing takes it to 0');
    executeVillainAbilities(G, VILLAIN_CTX, MIND_STONE, 'onAmbush');
    // why: change first: 1 + 2 = 3, then Size-Changing 2 less = 1. The other order (discount to 0,
    // then +2) would give 2, so this pins the locked order.
    assert.equal(resolveRecruitCost(G, '0', SIZE_CHANGER), 1);
  });

  it('a "less" change floors at 0 before a Microscopic discount takes the price below 0', () => {
    // why: Inspector P2 — the floor matters only when Size-Changing can then go negative
    // (Microscopic, rules v23 p.30). Printed 0, 1 less: floor-first gives 0, then the one matched
    // icon takes 2 off for -2. An unfloored sum would give -3.
    const G = makeState();
    G.hq = [ZERO_COST_HERO, null, null, null, null] as LegendaryGameState['hq'];
    G.cardMicroscopicSizeChangingClasses = { [ZERO_COST_HERO]: ['strength'] };
    G.playerZones['0']!.inPlay = [PLAYED_STRENGTH];
    executeVillainAbilities(G, VILLAIN_CTX, TIM_BOO_BA, 'onFight');
    assert.equal(resolveRecruitCost(G, '0', ZERO_COST_HERO), -2);
  });

  it('a recruited Hero leaves the overlay inert', () => {
    const G = makeState();
    executeVillainAbilities(G, VILLAIN_CTX, TIM_BOO_BA, 'onFight');
    G.hq[0] = null;
    G.playerZones['0']!.discard = [TECH_HERO];
    assert.equal(getHqCostChange(G, TECH_HERO), 0, 'out of the HQ, the change no longer applies');
    assert.equal(resolveRecruitCost(G, '0', TECH_HERO), 5);
  });

  it('end-of-turn cleanup deletes the overlay and prices return to printed', () => {
    const G = makeState();
    executeVillainAbilities(G, VILLAIN_CTX, TIM_BOO_BA, 'onFight');
    assert.ok(G.hqCostChanges !== undefined);
    applyEndOfTurnCleanup(G, '0', mockCtx);
    assert.equal(Object.hasOwn(G, 'hqCostChanges'), false, 'the key is deleted, not emptied');
    assert.deepStrictEqual(hqPrices(G), [5, 4, 3, 6, 0]);
  });

  it('an empty HQ logs a blocked no-op and creates no overlay', () => {
    const G = makeState();
    G.hq = [null, null, null, null, null] as LegendaryGameState['hq'];
    executeVillainAbilities(G, VILLAIN_CTX, TIM_BOO_BA, 'onFight');
    assert.equal(G.hqCostChanges, undefined);
    assert.equal(lastLog(G), 'Fight effect: no matching Heroes in the HQ (Tim Boo Ba).');
    assert.equal(G.messages[G.messages.length - 1]?.outcome, 'blocked');
  });
});

describe('WP-868 RS-1 HQ recruitCosts projection (pre-flight PS-1)', () => {
  it('a cost change puts recruitCosts on the board in a match with no Size-Changing card, until cleanup', () => {
    const config = {
      schemeId: 'test-scheme-001', mastermindId: 'test-mastermind-001',
      villainGroupIds: ['test-villain-group-001'], henchmanGroupIds: ['test-henchman-group-001'],
      heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
      bystandersCount: 10, woundsCount: 15, officersCount: 20, sidekicksCount: 5,
    } as MatchSetupConfig;
    const G = buildInitialGameState(config, { ...makeCardRegistryReader(), listCards: () => [] }, makeMockCtx());
    delete G.cardSizeChangingClasses;
    delete G.cardMicroscopicSizeChangingClasses;
    const hqHero = G.playerZones['0']!.deck[0]!;
    G.hq = [hqHero, null, null, null, null] as LegendaryGameState['hq'];
    G.cardStats = { ...G.cardStats, [hqHero]: makeCardStatEntry({ cost: 4 }) };
    G.villainAbilityHooks = HOOKS;
    const uiContext = { phase: 'play' as string | null, turn: 1, currentPlayer: '0' };
    assert.equal('recruitCosts' in buildUIState(G, uiContext).hq, false, 'precondition: no Size-Changing, no recruitCosts');
    executeVillainAbilities(G, VILLAIN_CTX, TIM_BOO_BA, 'onFight');
    assert.deepStrictEqual(buildUIState(G, uiContext).hq.recruitCosts, [3, null, null, null, null]);
    applyEndOfTurnCleanup(G, '0', mockCtx);
    assert.equal('recruitCosts' in buildUIState(G, uiContext).hq, false, 'after cleanup the field is omitted again');
  });
});
