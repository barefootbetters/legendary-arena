/**
 * Size-Changing granted or removed on an HQ Hero during play (WP-862 / D-24804).
 *
 * Six printed effects (Pym Particles, Ultron-Pym, Shrinksperiments, Sporr, Fin Fang Foom's Alien
 * Dragon Technology, Darren Cross's Shrinking Research Budget) did nothing before this WP. These
 * tests build the REAL hero and villain hooks from the committed card data, fire them through the
 * real executors and tactic dispatch, resolve every pick through the real resolveSeatChoice, and
 * price through the real resolveRecruitCost, so the parse, the overlay, the pick and the price are
 * pinned together.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import { executeVillainAbilities } from '../villain/villainEffects.execute.js';
import { dispatchTacticOnFight } from '../rules/tacticHandlers.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import { applyEndOfTurnCleanup } from '../moves/endOfTurnCleanup.logic.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import { buildUIState } from '../ui/uiState.build.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { getHqCardSizeChanging, hqCardHasSizeChanging, resolveRecruitCost } from './sizeChanging.logic.js';
import {
  SIZE_CHANGING_CLASS_PICK_SEAT_CHOICE_KIND,
  SIZE_CHANGING_GRANT_SEAT_CHOICE_KIND,
  clearExpiredHqSizeChangingGrants,
  grantSizeChangingToHqHero,
} from './sizeChangingGrant.logic.js';
import type { LegendaryGameState, MatchConfiguration, PendingSeatChoice } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
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

const PYM_PARTICLES = 'antm/ant-man/pym-particles#0' as CardExtId;
const ALIEN_DRAGON_TECHNOLOGY = 'chmp-mastermind-fin-fang-foom-alien-dragon-technology' as CardExtId;
const SHRINKING_RESEARCH_BUDGET = 'amwp-mastermind-darren-cross-shrinking-research-budget' as CardExtId;

// Synthetic HQ Heroes: copy-unique ids, as buildHeroDeck makes them.
const TECH_HERO = 'test/hero/tech-hero#0' as CardExtId;
const TECH_HERO_COPY = 'test/hero/tech-hero#1' as CardExtId;
const CHEAP_HERO = 'test/hero/cheap-hero#0' as CardExtId;
const PRICEY_HERO = 'test/hero/pricey-hero#0' as CardExtId;
const PRINTED_SIZE_CHANGER = 'test/hero/printed-size-changer#0' as CardExtId;
const DUAL_HERO_A = 'test/hero/dual-a#0' as CardExtId;
const DUAL_HERO_B = 'test/hero/dual-b#0' as CardExtId;
const GREY_HERO = 'test/hero/grey-hero#0' as CardExtId;
const PLAYED_TECH = 'test/hero/played-tech#0' as CardExtId;
const PLAYED_RANGED = 'test/hero/played-ranged#0' as CardExtId;

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0', numPlayers: 2 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Reads one committed set file.
 *
 * @param setAbbr - The set abbreviation.
 * @returns The parsed set data.
 */
function readSet(setAbbr: string): unknown {
  return JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
}

/**
 * Builds a registry stub over the given committed sets.
 *
 * @param setAbbrs - The sets to expose.
 * @returns A registry exposing getSet / listCards.
 */
function makeSetRegistry(setAbbrs: string[]): { listCards: () => never[]; getSet: (abbr: string) => unknown } {
  const sets: Record<string, unknown> = {};
  for (const setAbbr of setAbbrs) {
    sets[setAbbr] = readSet(setAbbr);
  }
  return { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
}

/**
 * Builds the real antm Ant-Man hero hooks.
 *
 * @returns Every hook the hero deck produces.
 */
function buildAntManHooks(): HeroAbilityHook[] {
  return buildHeroAbilityHooks(makeSetRegistry(['antm']), { heroDeckIds: ['antm/ant-man'] } as unknown as MatchConfiguration);
}

/**
 * Builds the real villain hooks for the three villain groups that carry the grant.
 *
 * @returns The villain hooks.
 */
function buildGrantVillainHooks(): VillainAbilityHook[] {
  const config = {
    villainGroupIds: ['antm/ultrons-legacy', 'amwp/cross-technologies', 'chmp/monsters-unleashed'],
    henchmanGroupIds: [],
  } as unknown as MatchSetupConfig;
  return buildVillainAbilityHooks(makeSetRegistry(['antm', 'amwp', 'chmp']), config);
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

/**
 * A two-seat state wide enough for the executors, the seat-choice resolve and the price.
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
    hq: [null, null, null, null, null],
    heroDeck: [],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    scheme: { twistPile: [] },
    heroAbilityHooks: buildAntManHooks(),
    villainAbilityHooks: buildGrantVillainHooks(),
    cardStats: {
      [TECH_HERO]: stat(5), [TECH_HERO_COPY]: stat(5), [CHEAP_HERO]: stat(2), [PRICEY_HERO]: stat(7),
      [PRINTED_SIZE_CHANGER]: stat(6), [DUAL_HERO_A]: stat(4), [DUAL_HERO_B]: stat(3), [GREY_HERO]: stat(0),
    },
    cardTraits: {
      [TECH_HERO]: { heroClass: 'tech', team: null },
      [TECH_HERO_COPY]: { heroClass: 'tech', team: null },
      [CHEAP_HERO]: { heroClass: 'covert', team: null },
      [PRICEY_HERO]: { heroClass: 'strength', team: null },
      [PRINTED_SIZE_CHANGER]: { heroClass: 'strength', team: null },
      [DUAL_HERO_A]: { heroClass: 'ranged', heroClass2: 'tech', team: null },
      [DUAL_HERO_B]: { heroClass: 'instinct', heroClass2: 'covert', team: null },
      [GREY_HERO]: { heroClass: null, team: null },
      [PLAYED_TECH]: { heroClass: 'tech', team: null },
      [PLAYED_RANGED]: { heroClass: 'ranged', team: null },
    },
    cardSizeChangingClasses: { [PRINTED_SIZE_CHANGER]: ['strength'] },
    cardKeywords: {},
    cardDisplayData: {
      [TECH_HERO]: { name: 'Tech Hero', imageUrl: '', cost: 5 },
      [TECH_HERO_COPY]: { name: 'Tech Hero', imageUrl: '', cost: 5 },
      [CHEAP_HERO]: { name: 'Cheap Hero', imageUrl: '', cost: 2 },
      [PRICEY_HERO]: { name: 'Pricey Hero', imageUrl: '', cost: 7 },
      [PRINTED_SIZE_CHANGER]: { name: 'Printed Size-Changer', imageUrl: '', cost: 6 },
      [DUAL_HERO_A]: { name: 'Dual Hero A', imageUrl: '', cost: 4 },
      [DUAL_HERO_B]: { name: 'Dual Hero B', imageUrl: '', cost: 3 },
      [GREY_HERO]: { name: 'Grey Hero', imageUrl: '', cost: 0 },
      // why: setup puts mastermind tactics in cardDisplayData under the tactic ext_id
      // (buildCardDisplayData), so the logs name the printed tactic.
      [ALIEN_DRAGON_TECHNOLOGY]: { name: 'Alien Dragon Technology', imageUrl: '', cost: 0 },
      [SHRINKING_RESEARCH_BUDGET]: { name: 'Shrinking Research Budget', imageUrl: '', cost: 0 },
    },
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/**
 * Resolves the open seat choice for player 0 through the real move.
 *
 * @param G - The game state.
 * @param optionIndex - The chosen option.
 */
function resolveAs(G: LegendaryGameState, optionIndex: number): void {
  resolveSeatChoice({ G, playerID: '0', ctx: { ...mockCtx.ctx }, random: mockCtx.random, events: undefined } as never, { optionIndex });
}

/**
 * Returns the option labels of the open seat choice for player 0.
 *
 * @param G - The game state.
 * @returns The labels, in option order.
 */
function openLabels(G: LegendaryGameState): string[] {
  const options = G.pendingSeatChoice?.seatPrompts['0']?.options ?? [];
  const labels: string[] = [];
  for (const option of options) {
    labels.push(option.label);
  }
  return labels;
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

describe('WP-862 parse: the six grant lines', () => {
  it('Pym Particles line 2 is the grant keyword, with no Size-Changing of its own (RS-6)', () => {
    const pymHooks = buildAntManHooks().filter((hook) => hook.cardId === PYM_PARTICLES);
    assert.equal(pymHooks.length, 2, 'two ability lines, two hooks');
    const grantHook = pymHooks[1]!;
    assert.deepStrictEqual(grantHook.keywords, ['hq-hero-gains-size-changing-tech']);
    assert.deepStrictEqual(grantHook.effects, [{ type: 'hq-hero-gains-size-changing-tech' }]);
    assert.equal(grantHook.sizeChangingClasses, undefined, 'the descriptive [hc:tech] is not its own discount');
    assert.equal(grantHook.conditions, undefined, 'nor a play gate');
    assert.equal(grantHook.unresolvedMarkers, undefined);
    // why: the first line keeps the printed Microscopic [Tech]x5, so Pym Particles still has
    // Size-Changing — only the spurious extra Tech step is gone.
    assert.deepStrictEqual(pymHooks[0]!.microscopicSizeChangingClasses, ['tech', 'tech', 'tech', 'tech', 'tech']);
    for (const hook of pymHooks) {
      assert.equal(hook.sizeChangingClasses, undefined, 'no Pym Particles hook feeds cardSizeChangingClasses');
    }
  });

  it('the three villain Fight lines parse to their grant descriptors', () => {
    const hooks = buildGrantVillainHooks();
    const expected: [string, 'if-none' | 'add' | 'replace', string[]][] = [
      ['antm-villain-ultrons-legacy-ultron-pym', 'if-none', ['tech']],
      ['amwp-villain-cross-technologies-shrinksperiments', 'replace', ['tech']],
      ['chmp-villain-monsters-unleashed-sporr', 'add', ['tech', 'ranged']],
    ];
    for (const [prefix, mode, classes] of expected) {
      const fightHook = hooks.find((hook) => hook.cardId.startsWith(`${prefix}-`) && hook.timing === 'onFight');
      assert.ok(fightHook !== undefined, `${prefix} has an onFight hook`);
      assert.deepStrictEqual(fightHook.effects, [
        { primitive: 'hq-hero-gains-size-changing', sizeChangingGrantMode: mode, sizeChangingGrantClasses: classes },
      ]);
    }
  });

  it('a malformed grant marker is not a descriptor (a valid one in the same shape is)', () => {
    const malformed = [
      // why: positive control — the same synthetic set with a valid marker must yield exactly one
      // descriptor, so the malformed cases below can't pass vacuously.
      'hq-hero-gains-size-changing:add:tech',
      'hq-hero-gains-size-changing:sideways:tech',
      'hq-hero-gains-size-changing:add',
      'hq-hero-gains-size-changing:add:purple',
      'hq-hero-gains-size-changing:add:tech:extra',
    ];
    for (const marker of malformed) {
      const setData = {
        abbr: 'test', heroes: [], henchmen: [], schemes: [], masterminds: [], bystanders: [], wounds: [], other: [],
        villains: [{ slug: 'grp', cards: [{ slug: 'villain', abilities: [`Fight: Something. [effect:${marker}]`] }] }],
      };
      const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'test' ? setData : undefined) };
      const hooks = buildVillainAbilityHooks(registry, { villainGroupIds: ['test/grp'], henchmanGroupIds: [] } as unknown as MatchSetupConfig);
      const fightHook = hooks.find((hook) => hook.timing === 'onFight');
      const effects = fightHook?.effects ?? [];
      const expectedCount = marker === 'hq-hero-gains-size-changing:add:tech' ? 1 : 0;
      assert.equal(effects.length, expectedCount, `${marker} yields ${expectedCount} descriptor(s)`);
    }
  });
});

describe('WP-862 overlay reads (RS-1) and the recruit price', () => {
  it('add unions the classes once; replace sets them and drops Microscopic; off-HQ reads printed', () => {
    const G = makeState();
    G.hq = [PRINTED_SIZE_CHANGER, TECH_HERO, null, null, null];
    G.cardMicroscopicSizeChangingClasses = { [TECH_HERO]: ['tech', 'tech'] };
    G.hqSizeChangingGrants = [
      { cardId: PRINTED_SIZE_CHANGER, classes: ['strength', 'tech'], replacesPrinted: false, expiresAtEndOfTurn: true },
      { cardId: TECH_HERO, classes: ['ranged'], replacesPrinted: true, expiresAtEndOfTurn: true },
    ];
    assert.deepStrictEqual(getHqCardSizeChanging(G, PRINTED_SIZE_CHANGER), { classes: ['strength', 'tech'], microscopicIcons: [] });
    assert.deepStrictEqual(getHqCardSizeChanging(G, TECH_HERO), { classes: ['ranged'], microscopicIcons: [] });
    G.hq = [null, null, null, null, null];
    assert.deepStrictEqual(getHqCardSizeChanging(G, PRINTED_SIZE_CHANGER), { classes: ['strength'], microscopicIcons: [] });
    assert.deepStrictEqual(getHqCardSizeChanging(G, TECH_HERO), { classes: [], microscopicIcons: ['tech', 'tech'] });
  });

  it('a Tech grant discounts only its own card by 2 once a Tech card is played, while it is in the HQ', () => {
    const G = makeState();
    G.hq = [TECH_HERO, TECH_HERO_COPY, null, null, null];
    G.playerZones['0']!.inPlay = [PLAYED_TECH];
    G.hqSizeChangingGrants = [{ cardId: TECH_HERO, classes: ['tech'], replacesPrinted: false, expiresAtEndOfTurn: true }];
    assert.equal(resolveRecruitCost(G, '0', TECH_HERO), 3, '5 less 2');
    assert.equal(resolveRecruitCost(G, '0', TECH_HERO_COPY), 5, 'the other copy is priced as printed');
    G.playerZones['0']!.inPlay = [];
    assert.equal(resolveRecruitCost(G, '0', TECH_HERO), 5, 'no Tech played → no discount');
    G.playerZones['0']!.inPlay = [PLAYED_TECH];
    G.hq = [null, TECH_HERO_COPY, null, null, null];
    assert.equal(resolveRecruitCost(G, '0', TECH_HERO), 5, 'once it leaves the HQ the grant is inert');
  });
});

describe('WP-862 effects end to end', () => {
  it('Ultron-Pym: two eligible Heroes open a priciest-first pick that skips printed or granted Size-Changing', () => {
    const G = makeState();
    G.hq = [CHEAP_HERO, PRINTED_SIZE_CHANGER, PRICEY_HERO, TECH_HERO, null];
    G.hqSizeChangingGrants = [{ cardId: TECH_HERO, classes: ['ranged'], replacesPrinted: false, expiresAtEndOfTurn: true }];
    const ultronPym = villainCopyId(G.villainAbilityHooks, 'antm-villain-ultrons-legacy-ultron-pym');
    executeVillainAbilities(G, { currentPlayer: '0' }, ultronPym, 'onFight');
    assert.equal(G.pendingSeatChoice?.kind, SIZE_CHANGING_GRANT_SEAT_CHOICE_KIND);
    assert.deepStrictEqual(openLabels(G), [
      'Pricey Hero gains Size-Changing Tech this turn',
      'Cheap Hero gains Size-Changing Tech this turn',
    ]);
    assert.equal(G.pendingSeatChoice?.defaultOptionIndex, 0);
    assert.ok(lastLog(G).startsWith('Fight effect: Player 0 chooses a Hero in the HQ to gain Size-Changing'));
    resolveAs(G, 1);
    assert.equal(G.pendingSeatChoice, undefined);
    G.playerZones['0']!.inPlay = [PLAYED_TECH];
    assert.equal(resolveRecruitCost(G, '0', CHEAP_HERO), 0, '2 less 2');
    assert.equal(resolveRecruitCost(G, '0', PRICEY_HERO), 7, 'the unchosen Hero is unchanged');
    assert.ok(lastLog(G).startsWith('Fight effect: Player 0 gave Cheap Hero Size-Changing Tech this turn'));
  });

  it('Ultron-Pym: one eligible Hero is granted at once; none is a logged no-op', () => {
    const G = makeState();
    G.hq = [PRINTED_SIZE_CHANGER, CHEAP_HERO, null, null, null];
    const ultronPym = villainCopyId(G.villainAbilityHooks, 'antm-villain-ultrons-legacy-ultron-pym');
    executeVillainAbilities(G, { currentPlayer: '0' }, ultronPym, 'onFight');
    assert.equal(G.pendingSeatChoice, undefined, 'no pick for a single eligible Hero');
    assert.deepStrictEqual(G.hqSizeChangingGrants, [{ cardId: CHEAP_HERO, classes: ['tech'], replacesPrinted: false, expiresAtEndOfTurn: true }]);
    const secondResults = executeVillainAbilities(G, { currentPlayer: '0' }, ultronPym, 'onFight');
    assert.deepStrictEqual(secondResults, [], 'keyword-less: the executor records no result (RS-7)');
    assert.equal(G.pendingSeatChoice, undefined, 'nothing eligible → nothing parked');
    assert.equal(G.hqSizeChangingGrants?.length, 1, 'both HQ Heroes now have Size-Changing');
    assert.equal(lastLog(G), 'Fight effect: No Hero in the HQ can gain Size-Changing (' + (G.cardDisplayData?.[ultronPym]?.name ?? ultronPym) + ').');
    assert.equal(G.messages[G.messages.length - 1]?.outcome, 'blocked');
  });

  it('Shrinksperiments replaces a printed Size-Changing [Strength] with [Tech] for this turn', () => {
    const G = makeState();
    G.hq = [PRINTED_SIZE_CHANGER, null, null, null, null];
    const shrinksperiments = villainCopyId(G.villainAbilityHooks, 'amwp-villain-cross-technologies-shrinksperiments');
    executeVillainAbilities(G, { currentPlayer: '0' }, shrinksperiments, 'onFight');
    assert.deepStrictEqual(getHqCardSizeChanging(G, PRINTED_SIZE_CHANGER).classes, ['tech']);
    G.playerZones['0']!.inPlay = [PRICEY_HERO];
    assert.equal(resolveRecruitCost(G, '0', PRINTED_SIZE_CHANGER), 6, 'a Strength card no longer discounts it');
    G.playerZones['0']!.inPlay = [PLAYED_TECH];
    assert.equal(resolveRecruitCost(G, '0', PRINTED_SIZE_CHANGER), 4, 'a Tech card does');
    assert.ok(lastLog(G).includes('made Printed Size-Changer lose its Size-Changing and gain Size-Changing Tech this turn'));
  });

  it('Sporr adds Tech and Ranged to any Hero, one step per class', () => {
    const G = makeState();
    G.hq = [PRICEY_HERO, null, null, null, null];
    const sporr = villainCopyId(G.villainAbilityHooks, 'chmp-villain-monsters-unleashed-sporr');
    executeVillainAbilities(G, { currentPlayer: '0' }, sporr, 'onFight');
    G.playerZones['0']!.inPlay = [PLAYED_TECH, PLAYED_RANGED];
    assert.equal(resolveRecruitCost(G, '0', PRICEY_HERO), 3, '7 less 2 less 2');
    assert.ok(lastLog(G).includes('gave Pricey Hero Size-Changing Tech and Ranged this turn'));
  });

  it('Pym Particles (hero) grants Tech to a Hero with none, with no Fight prefix', () => {
    const G = makeState();
    G.hq = [PRINTED_SIZE_CHANGER, TECH_HERO, null, null, null];
    executeHeroEffects(G, mockCtx, '0', PYM_PARTICLES);
    assert.deepStrictEqual(G.hqSizeChangingGrants, [{ cardId: TECH_HERO, classes: ['tech'], replacesPrinted: false, expiresAtEndOfTurn: true }]);
    const grantLine = G.messages.find((message) => message.text.includes('Size-Changing Tech this turn'));
    assert.ok(grantLine !== undefined && grantLine.text.startsWith('Player 0 gave Tech Hero'));
  });

  it('Alien Dragon Technology lists all five classes in printed order; a Haunted Hero is offered last', () => {
    const G = makeState();
    G.hq = [PRICEY_HERO, CHEAP_HERO, null, null, null];
    G.hqHaunters = [{ kind: 'mastermind' }, null, null, null, null];
    dispatchTacticOnFight(G, { currentPlayer: '0' }, ALIEN_DRAGON_TECHNOLOGY, mockCtx);
    assert.deepStrictEqual(openLabels(G), [
      'Cheap Hero gains Size-Changing Strength, Instinct, Covert, Tech and Ranged this turn',
      'Pricey Hero gains Size-Changing Strength, Instinct, Covert, Tech and Ranged this turn',
    ]);
  });

  it('the bot answers the pick with the default and the board unfreezes; the parked pick round-trips JSON', () => {
    const G = makeState();
    G.hq = [CHEAP_HERO, PRICEY_HERO, null, null, null];
    const sporr = villainCopyId(G.villainAbilityHooks, 'chmp-villain-monsters-unleashed-sporr');
    executeVillainAbilities(G, { currentPlayer: '0' }, sporr, 'onFight');
    const parked = G.pendingSeatChoice as PendingSeatChoice;
    assert.deepStrictEqual(JSON.parse(JSON.stringify(parked)), parked);
    const moves = getLegalMoves(G, { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 2 } as never);
    assert.deepStrictEqual(moves, [{ name: 'resolveSeatChoice', args: { optionIndex: 0 } }]);
    resolveAs(G, 0);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(G.hqSizeChangingGrants?.[0]?.cardId, PRICEY_HERO, 'the priciest Hero');
  });
});

describe('WP-862 Shrinking Research Budget (RS-4)', () => {
  it('grants single-class Heroes at once, logs a classless one, and chains one class pick per dual-class Hero', () => {
    const G = makeState();
    G.hq = [DUAL_HERO_A, CHEAP_HERO, GREY_HERO, DUAL_HERO_B, PRINTED_SIZE_CHANGER];
    dispatchTacticOnFight(G, { currentPlayer: '0' }, SHRINKING_RESEARCH_BUDGET, mockCtx);
    assert.deepStrictEqual(G.hqSizeChangingGrants, [{ cardId: CHEAP_HERO, classes: ['covert'], replacesPrinted: false, expiresAtEndOfTurn: false }]);
    assert.ok(G.messages.some((message) => message.text === 'Fight effect: Grey Hero has no Hero Class, so it gains nothing (Shrinking Research Budget).'));
    assert.equal(G.pendingSeatChoice?.kind, SIZE_CHANGING_CLASS_PICK_SEAT_CHOICE_KIND);
    assert.deepStrictEqual(openLabels(G), ['Dual Hero A gains Size-Changing Tech', 'Dual Hero A gains Size-Changing Ranged']);
    resolveAs(G, 1);
    assert.deepStrictEqual(openLabels(G), ['Dual Hero B gains Size-Changing Instinct', 'Dual Hero B gains Size-Changing Covert']);
    resolveAs(G, 0);
    assert.equal(G.pendingSeatChoice, undefined, 'no Hero is owed a class any more');
    assert.deepStrictEqual(getHqCardSizeChanging(G, DUAL_HERO_A).classes, ['ranged']);
    assert.deepStrictEqual(getHqCardSizeChanging(G, DUAL_HERO_B).classes, ['instinct']);
    assert.deepStrictEqual(getHqCardSizeChanging(G, PRINTED_SIZE_CHANGER).classes, ['strength'], 'a Hero with Size-Changing is skipped');
  });

  it('its grants survive end of turn and are pruned once the card leaves the HQ', () => {
    const G = makeState();
    G.hq = [CHEAP_HERO, null, null, null, null];
    G.hqSizeChangingGrants = [
      { cardId: CHEAP_HERO, classes: ['covert'], replacesPrinted: false, expiresAtEndOfTurn: false },
      { cardId: CHEAP_HERO, classes: ['tech'], replacesPrinted: false, expiresAtEndOfTurn: true },
    ];
    applyEndOfTurnCleanup(G, '0', mockCtx);
    assert.deepStrictEqual(G.hqSizeChangingGrants, [{ cardId: CHEAP_HERO, classes: ['covert'], replacesPrinted: false, expiresAtEndOfTurn: false }]);
    G.hq = [null, null, null, null, null];
    clearExpiredHqSizeChangingGrants(G);
    assert.equal(Object.hasOwn(G, 'hqSizeChangingGrants'), false, 'the empty overlay is deleted');
  });
});

describe('WP-862 guards and lifetimes', () => {
  it('end-of-turn cleanup removes every this-turn grant and deletes the field', () => {
    const G = makeState();
    G.hq = [TECH_HERO, null, null, null, null];
    G.hqSizeChangingGrants = [{ cardId: TECH_HERO, classes: ['tech'], replacesPrinted: false, expiresAtEndOfTurn: true }];
    applyEndOfTurnCleanup(G, '0', mockCtx);
    assert.equal(Object.hasOwn(G, 'hqSizeChangingGrants'), false);
  });

  it('an open seat choice blocks the park but not a single-eligible grant', () => {
    const G = makeState();
    G.hq = [CHEAP_HERO, PRICEY_HERO, null, null, null];
    const openChoice: PendingSeatChoice = {
      kind: 'generic', addressedSeats: ['0'], seatPrompts: { '0': { options: [{ label: 'x' }] } }, submissions: {}, defaultOptionIndex: 0,
    };
    G.pendingSeatChoice = openChoice;
    assert.equal(grantSizeChangingToHqHero(G, '0', ['tech'], 'add', ALIEN_DRAGON_TECHNOLOGY), null);
    assert.equal(G.pendingSeatChoice, openChoice, 'the open choice is untouched');
    assert.equal(G.hqSizeChangingGrants, undefined);
    assert.ok(lastLog(G).includes('another choice is open'));
    assert.equal(G.messages[G.messages.length - 1]?.outcome, 'blocked');
    G.hq = [CHEAP_HERO, null, null, null, null];
    assert.equal(grantSizeChangingToHqHero(G, '0', ['tech'], 'add', ALIEN_DRAGON_TECHNOLOGY), CHEAP_HERO);
  });

  it('a stale option (its Hero left the HQ) grants nothing and logs it', () => {
    const G = makeState();
    G.hq = [CHEAP_HERO, PRICEY_HERO, null, null, null];
    grantSizeChangingToHqHero(G, '0', ['tech'], 'add', ALIEN_DRAGON_TECHNOLOGY);
    G.hq = [CHEAP_HERO, null, null, null, null];
    resolveAs(G, 0);
    assert.equal(G.hqSizeChangingGrants, undefined);
    assert.ok(lastLog(G).startsWith('Fight effect: Pricey Hero is no longer in the HQ, so it gains nothing'));
    assert.equal(hqCardHasSizeChanging(G, CHEAP_HERO), false);
  });
});

describe('WP-862 HQ recruitCosts projection (RS-8)', () => {
  it('a grant puts recruitCosts on the board in a match with no printed Size-Changing card', () => {
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
    G.cardTraits = { ...G.cardTraits, [PLAYED_TECH]: { heroClass: 'tech', team: null } };
    G.playerZones['0']!.inPlay = [PLAYED_TECH];
    const uiContext = { phase: 'play' as string | null, turn: 1, currentPlayer: '0' };
    assert.equal('recruitCosts' in buildUIState(G, uiContext).hq, false, 'precondition: no Size-Changing, no recruitCosts');
    G.hqSizeChangingGrants = [{ cardId: hqHero, classes: ['tech'], replacesPrinted: false, expiresAtEndOfTurn: true }];
    assert.deepStrictEqual(buildUIState(G, uiContext).hq.recruitCosts, [2, null, null, null, null]);
  });
});

describe('WP-862 Inspector follow-ups: every effect parks and resolves, Pym Particles price, SRB branches', () => {
  it('Pym Particles prices with only its Microscopic steps (no spurious Tech step from line 2)', () => {
    const G = makeState();
    // why: derive both setup maps from the REAL hooks, exactly as buildInitialGameState does, so
    // the old parse (line 2 → sizeChangingClasses ['tech']) would add a 2-less step and fail here.
    const sizeChangingClasses: Record<string, string[]> = {};
    const microscopicClasses: Record<string, string[]> = {};
    for (const hook of buildAntManHooks().filter((candidate) => candidate.cardId === PYM_PARTICLES)) {
      if (hook.sizeChangingClasses !== undefined) {
        sizeChangingClasses[hook.cardId] = [...(sizeChangingClasses[hook.cardId] ?? []), ...hook.sizeChangingClasses];
      }
      if (hook.microscopicSizeChangingClasses !== undefined) {
        microscopicClasses[hook.cardId] = [...hook.microscopicSizeChangingClasses];
      }
    }
    G.cardSizeChangingClasses = sizeChangingClasses as LegendaryGameState['cardSizeChangingClasses'];
    G.cardMicroscopicSizeChangingClasses = microscopicClasses as LegendaryGameState['cardMicroscopicSizeChangingClasses'];
    G.cardStats = { ...G.cardStats, [PYM_PARTICLES]: makeCardStatEntry({ cost: 9 }) };
    G.cardTraits = { ...G.cardTraits, ['test/hero/played-tech#1' as CardExtId]: { heroClass: 'tech', team: null } };
    G.hq = [PYM_PARTICLES, null, null, null, null];
    G.playerZones['0']!.inPlay = [PLAYED_TECH, 'test/hero/played-tech#1' as CardExtId];
    assert.equal(resolveRecruitCost(G, '0', PYM_PARTICLES), 5, '9 less two Microscopic Tech steps, no extra Tech step');
  });

  it('Shrinksperiments with two Heroes parks the replace label and resolves through resolveSeatChoice', () => {
    const G = makeState();
    G.hq = [PRINTED_SIZE_CHANGER, CHEAP_HERO, null, null, null];
    const shrinksperiments = villainCopyId(G.villainAbilityHooks, 'amwp-villain-cross-technologies-shrinksperiments');
    executeVillainAbilities(G, { currentPlayer: '0' }, shrinksperiments, 'onFight');
    assert.deepStrictEqual(openLabels(G), [
      'Printed Size-Changer loses its Size-Changing and gains Size-Changing Tech this turn',
      'Cheap Hero loses its Size-Changing and gains Size-Changing Tech this turn',
    ]);
    resolveAs(G, 0);
    assert.deepStrictEqual(G.hqSizeChangingGrants, [{ cardId: PRINTED_SIZE_CHANGER, classes: ['tech'], replacesPrinted: true, expiresAtEndOfTurn: true }]);
    assert.deepStrictEqual(getHqCardSizeChanging(G, PRINTED_SIZE_CHANGER).classes, ['tech']);
  });

  it('Pym Particles with two eligible Heroes parks a pick from the hero play and resolves it', () => {
    const G = makeState();
    G.hq = [CHEAP_HERO, PRICEY_HERO, PRINTED_SIZE_CHANGER, null, null];
    executeHeroEffects(G, mockCtx, '0', PYM_PARTICLES);
    assert.equal(G.pendingSeatChoice?.kind, SIZE_CHANGING_GRANT_SEAT_CHOICE_KIND);
    assert.deepStrictEqual(openLabels(G), [
      'Pricey Hero gains Size-Changing Tech this turn',
      'Cheap Hero gains Size-Changing Tech this turn',
    ]);
    resolveAs(G, 1);
    assert.deepStrictEqual(G.hqSizeChangingGrants, [{ cardId: CHEAP_HERO, classes: ['tech'], replacesPrinted: false, expiresAtEndOfTurn: true }]);
    assert.ok(lastLog(G).startsWith('Player 0 gave Cheap Hero Size-Changing Tech this turn'));
  });

  it('Alien Dragon Technology resolves to all five classes', () => {
    const G = makeState();
    G.hq = [PRICEY_HERO, CHEAP_HERO, null, null, null];
    dispatchTacticOnFight(G, { currentPlayer: '0' }, ALIEN_DRAGON_TECHNOLOGY, mockCtx);
    resolveAs(G, 1);
    assert.deepStrictEqual(G.hqSizeChangingGrants, [
      { cardId: CHEAP_HERO, classes: ['strength', 'instinct', 'covert', 'tech', 'ranged'], replacesPrinted: false, expiresAtEndOfTurn: true },
    ]);
  });

  it('Shrinking Research Budget under an open seat choice: single-class grants apply, the pick is dropped', () => {
    const G = makeState();
    G.hq = [DUAL_HERO_A, CHEAP_HERO, null, null, null];
    const openChoice: PendingSeatChoice = {
      kind: 'generic', addressedSeats: ['0'], seatPrompts: { '0': { options: [{ label: 'x' }] } }, submissions: {}, defaultOptionIndex: 0,
    };
    G.pendingSeatChoice = openChoice;
    dispatchTacticOnFight(G, { currentPlayer: '0' }, SHRINKING_RESEARCH_BUDGET, mockCtx);
    assert.equal(G.pendingSeatChoice, openChoice, 'the open choice is untouched');
    assert.deepStrictEqual(G.hqSizeChangingGrants, [{ cardId: CHEAP_HERO, classes: ['covert'], replacesPrinted: false, expiresAtEndOfTurn: false }]);
    assert.ok(lastLog(G).includes('another choice is open'));
    assert.equal(G.messages[G.messages.length - 1]?.outcome, 'blocked');
  });

  it('a stale Shrinking Research Budget class pick grants nothing and chains nothing', () => {
    const G = makeState();
    G.hq = [DUAL_HERO_A, null, null, null, null];
    dispatchTacticOnFight(G, { currentPlayer: '0' }, SHRINKING_RESEARCH_BUDGET, mockCtx);
    G.hq = [null, null, null, null, null];
    resolveAs(G, 0);
    assert.equal(G.hqSizeChangingGrants, undefined);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.ok(lastLog(G).startsWith('Fight effect: Dual Hero A is no longer in the HQ, so it gains nothing'));
  });
});
