/**
 * Cap 75th count-scaled hero lines grant what they print (WP-824 / D-24757).
 *
 * Three ca75 lines parsed to a FLAT grant before this packet:
 * - International Strike Force, line 1: "[keyword:Savior]: You get +1[icon:attack] for each Hero
 *   Class you have." (was a flat +1 under the Savior gate);
 * - Star-Spangled Hero, line 1: "[keyword:Savior]: You get +2[icon:recruit] for each Hero Class you
 *   have." (was a flat +2 under the Savior gate);
 * - Paramilitary Ops: "You get +1[icon:attack] for each other [team:shield] Hero you played this turn
 *   that costs 1 or more." (was a flat +1 that any other S.H.I.E.L.D. card, starters included, unlocked).
 *
 * These tests build the REAL hooks from the committed data/cards/ca75.json (the markers pass output)
 * and drive executeHeroEffects, so they pin the parse and the grant together: the Savior gate failing
 * and passing, the per-Hero-Class count (hand + play, D-24529), and Paramilitary counting only OTHER
 * S.H.I.E.L.D. Heroes costing 1 or more (the cost-3 Officer counts; the cost-0 Agent / Trooper
 * starters and the card itself never do — the 2-not-3 result with another costed copy in play
 * proves self-exclusion).
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the
// doubledSuperpowerIcon.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const BYSTANDER = 'pile-bystander';
const SHIELD_AGENT = 'starting-shield-agent';
const SHIELD_TROOPER = 'starting-shield-trooper';
const SHIELD_OFFICER = 'pile-shield-officer';

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real hooks for one ca75 hero deck from the committed card data.
 *
 * @param heroSlug - The ca75 hero slug.
 * @returns Every hook the hero deck produces.
 */
function buildCa75HeroHooks(heroSlug: string): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'ca75.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'ca75' ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: [`ca75/${heroSlug}`] } as unknown as MatchConfiguration);
}

/**
 * Returns the hooks of the first copy of a card.
 *
 * @param hooks - The hero deck's hooks.
 * @param cardSlug - The card slug.
 * @returns The first copy's card id and its hooks (one per printed ability line).
 */
function firstCopyHooks(hooks: HeroAbilityHook[], cardSlug: string): { cardId: CardExtId; cardHooks: HeroAbilityHook[] } {
  const firstHook = hooks.find((hook) => hook.cardId.includes(`/${cardSlug}#`));
  assert.ok(firstHook !== undefined, `the ca75 data builds a hook for ${cardSlug}`);
  const cardId = firstHook.cardId;
  return { cardId, cardHooks: hooks.filter((hook) => hook.cardId === cardId) };
}

/**
 * Minimal state for driving executeHeroEffects.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @param cardTraits - Printed class / team per card id.
 * @param cardStats - Printed cost per card id.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(
  hooks: HeroAbilityHook[],
  cardTraits: Record<string, object>,
  cardStats: Record<string, object>,
): LegendaryGameState {
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones(), hand: [], inPlay: [], victory: [] } },
    piles: makeGlobalPiles(),
    mastermind: { ...makeMastermindState(), baseCardId: 'test-mastermind-base' as CardExtId },
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    cardKeywords: {},
    cardStats,
    cardTraits,
    cardDisplayData: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    ko: [],
    attachedBystanders: {},
    heroAbilityHooks: hooks,
    villainAbilityHooks: [],
  } as unknown as LegendaryGameState;
}

/**
 * Plays a card after the given cards, with the given hand and Victory Pile.
 *
 * @param G - The game state, mutated in place.
 * @param setup - Cards played earlier this turn, cards in hand, and the Victory Pile.
 * @param cardId - The card being played now.
 */
function play(
  G: LegendaryGameState,
  setup: { playedBefore: string[]; hand: string[]; victory: string[] },
  cardId: CardExtId,
): void {
  const playerZones = G.playerZones['0']!;
  playerZones.inPlay = [...(setup.playedBefore as CardExtId[]), cardId];
  playerZones.hand = [...(setup.hand as CardExtId[])];
  playerZones.victory = [...(setup.victory as CardExtId[])];
  executeHeroEffects(G, mockCtx, '0', cardId);
}

describe('ca75 International Strike Force — Savior: +1 Attack per Hero Class you have (WP-824)', () => {
  const hooks = buildCa75HeroHooks('steve-rogers-director-of-shield');
  const { cardId, cardHooks } = firstCopyHooks(hooks, 'international-strike-force');

  it('parses line 1 to a Savior-gated attack-per-count with no flat attack', () => {
    assert.equal(cardHooks.length, 2, 'one hook per printed ability line');
    const saviorHook = cardHooks[1]!;
    assert.deepEqual(saviorHook.conditions, [{ type: 'bystandersInVictoryAtLeast', value: '3' }]);
    assert.deepEqual(saviorHook.effects, [
      { type: 'attack-per-count', magnitude: 1, countSource: 'distinct-hero-classes-played-this-turn' },
    ]);
  });

  it('a Savior with three Hero Classes (hand + play) gets +3 Attack and line 0 still gets +3 Recruit', () => {
    const G = makeState(hooks, {
      [cardId]: { heroClass: 'strength', team: 'shield' },
      'played-tech#0': { heroClass: 'tech' },
      'hand-covert#0': { heroClass: 'covert' },
    }, {});
    play(G, { playedBefore: ['played-tech#0'], hand: ['hand-covert#0'], victory: [BYSTANDER, BYSTANDER, BYSTANDER] }, cardId);
    assert.equal(G.turnEconomy.attack, 3, 'Savior line: 1 per class x 3 classes');
    assert.equal(G.turnEconomy.recruit, 3, 'line 0: 1 per class x 3 classes');
  });

  it('two Bystanders is not a Savior: no Attack, while line 0 still scales', () => {
    const G = makeState(hooks, {
      [cardId]: { heroClass: 'strength', team: 'shield' },
      'played-tech#0': { heroClass: 'tech' },
      'hand-covert#0': { heroClass: 'covert' },
    }, {});
    play(G, { playedBefore: ['played-tech#0'], hand: ['hand-covert#0'], victory: [BYSTANDER, BYSTANDER] }, cardId);
    assert.equal(G.turnEconomy.attack, 0, 'the Savior gate fails');
    assert.equal(G.turnEconomy.recruit, 3, 'line 0 is ungated');
  });
});

describe('ca75 Star-Spangled Hero — Savior: +2 Recruit per Hero Class you have (WP-824)', () => {
  const hooks = buildCa75HeroHooks('captain-america-falcon');
  const { cardId, cardHooks } = firstCopyHooks(hooks, 'star-spangled-hero');

  it('parses line 1 to a Savior-gated recruit-per-count with no flat recruit', () => {
    assert.equal(cardHooks.length, 2, 'one hook per printed ability line');
    const saviorHook = cardHooks[1]!;
    assert.deepEqual(saviorHook.conditions, [{ type: 'bystandersInVictoryAtLeast', value: '3' }]);
    assert.deepEqual(saviorHook.effects, [
      { type: 'recruit-per-count', magnitude: 2, countSource: 'distinct-hero-classes-played-this-turn' },
    ]);
  });

  it('a Savior with four Hero Classes gets +8 Recruit; line 0 gets +8 Attack', () => {
    const G = makeState(hooks, {
      [cardId]: { heroClass: 'covert', team: 'avengers' },
      'played-ranged#0': { heroClass: 'ranged' },
      'hand-tech#0': { heroClass: 'tech' },
      'hand-instinct#0': { heroClass: 'instinct' },
    }, {});
    play(G, {
      playedBefore: ['played-ranged#0'],
      hand: ['hand-tech#0', 'hand-instinct#0'],
      victory: [BYSTANDER, BYSTANDER, BYSTANDER, BYSTANDER],
    }, cardId);
    assert.equal(G.turnEconomy.recruit, 8, 'Savior line: 2 per class x 4 classes');
    assert.equal(G.turnEconomy.attack, 8, 'line 0: 2 per class x 4 classes');
  });

  it('without three Bystanders the Savior line grants nothing', () => {
    const G = makeState(hooks, {
      [cardId]: { heroClass: 'covert', team: 'avengers' },
      'played-ranged#0': { heroClass: 'ranged' },
    }, {});
    play(G, { playedBefore: ['played-ranged#0'], hand: [], victory: [BYSTANDER] }, cardId);
    assert.equal(G.turnEconomy.recruit, 0, 'the Savior gate fails');
    assert.equal(G.turnEconomy.attack, 4, 'line 0: 2 per class x 2 classes');
  });
});

describe('ca75 Paramilitary Ops — +1 Attack per other S.H.I.E.L.D. Hero costing 1 or more (WP-824)', () => {
  const hooks = buildCa75HeroHooks('agent-x-13');
  const { cardId, cardHooks } = firstCopyHooks(hooks, 'paramilitary-ops');
  const otherParamilitaryId = hooks
    .map((hook) => hook.cardId)
    .find((candidate) => candidate.includes('/paramilitary-ops#') && candidate !== cardId)!;
  const cardTraits = {
    [cardId]: { heroClass: 'tech', team: 'shield' },
    [otherParamilitaryId]: { heroClass: 'tech', team: 'shield' },
    'avenger-costing-five#0': { heroClass: 'strength', team: 'avengers' },
  };
  const cardStats = {
    [cardId]: { cost: 4 },
    [otherParamilitaryId]: { cost: 4 },
    [SHIELD_OFFICER]: { cost: 3 },
    // why: the real setup gives the starters cost-0 rows (buildInitialGameState.ts), so the
    // fixture carries them too; a "has a cardStats row" predicate must not pass T8 / T10.
    [SHIELD_AGENT]: { cost: 0 },
    [SHIELD_TROOPER]: { cost: 0 },
    'avenger-costing-five#0': { cost: 5 },
  };

  it('parses to attack-per-count on the cost-filtered S.H.I.E.L.D. source, with no flat attack', () => {
    assert.equal(cardHooks.length, 1, 'one printed ability line');
    assert.deepEqual(cardHooks[0]!.effects, [
      { type: 'attack-per-count', magnitude: 1, countSource: 'shield-heroes-cost-one-plus-played-this-turn' },
    ]);
  });

  it('the cost-0 Agent and Trooper starters alone grant nothing', () => {
    const G = makeState(hooks, cardTraits, cardStats);
    play(G, { playedBefore: [SHIELD_AGENT, SHIELD_TROOPER, SHIELD_AGENT], hand: [], victory: [] }, cardId);
    assert.equal(G.turnEconomy.attack, 0, 'starters cost 0, so they are not counted');
  });

  it('the card alone grants nothing (the requiresTeam gate fails with no other S.H.I.E.L.D. card)', () => {
    const G = makeState(hooks, cardTraits, cardStats);
    play(G, { playedBefore: [], hand: [], victory: [] }, cardId);
    assert.equal(G.turnEconomy.attack, 0);
  });

  it('an Officer and another Paramilitary Ops count; starters and a non-S.H.I.E.L.D. Hero do not', () => {
    const G = makeState(hooks, cardTraits, cardStats);
    play(G, {
      playedBefore: [SHIELD_AGENT, SHIELD_OFFICER, otherParamilitaryId, 'avenger-costing-five#0', SHIELD_TROOPER],
      hand: [],
      victory: [],
    }, cardId);
    assert.equal(G.turnEconomy.attack, 2, '1 per counted Hero x 2 (Officer cost 3, Paramilitary Ops cost 4)');
  });
});
