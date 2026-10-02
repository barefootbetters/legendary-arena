/**
 * Restricted ("usable only against …") hero attack grants at play time (WP-790 / D-24652).
 *
 * Parses real printed lines (verbatim from data/cards) through buildHeroAbilityHooks,
 * then fires them through executeHeroEffects, and pins:
 * - Lightning Bolt grants a `['rooftops']` bucket, `attack` +2, and the exact log line;
 * - Tidal Wave's Ranged widen adds `'mastermind'` only when another Ranged Hero was played;
 * - Electro's Shocking Robbery with Ranged grants ONE +3 `['bank','mastermind']` bucket (not +6);
 * - a plain `+2[icon:attack]` line is unchanged (no `restrictedAttack` key).
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeHeroEffects } from './heroEffects.execute.js';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeCardRegistryReader, makePlayerZones } from '../test/fixtureBuilders.js';

/** Empty registry so the fixture does not depend on real card data. */
const EMPTY_REGISTRY: CardRegistryReader = { ...makeCardRegistryReader(), listCards: () => [] };

/** A second card already in play; it carries the Ranged class when the test says so. */
const OTHER_CARD = 'other-hero-card' as CardExtId;

/**
 * Parses one hero card's printed abilities through the real setup parser.
 *
 * @param setAbbr - The set abbreviation.
 * @param heroSlug - The hero slug.
 * @param cardSlug - The card slug.
 * @param abilities - The ability lines, verbatim from data/cards.
 * @returns The parsed hooks.
 */
function parse(setAbbr: string, heroSlug: string, cardSlug: string, abilities: string[]): HeroAbilityHook[] {
  const cards = [{ slug: cardSlug, hc: 'ranged', abilities }];
  const setData = {
    abbr: setAbbr,
    heroes: [{ slug: heroSlug, cards, physicalCards: [{ id: 'p0', count: 1, sides: [cardSlug] }] }],
    villains: [],
    henchmen: [],
    schemes: [],
    masterminds: [],
    bystanders: [],
    wounds: [],
    other: [],
  };
  const registry = {
    listCards: () => [],
    listSets: () => [{ abbr: setAbbr }],
    getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined),
  };
  const config: MatchSetupConfig = {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: ['test/villain-001'],
    henchmanGroupIds: ['test/henchman-001'],
    heroDeckIds: [`${setAbbr}/${heroSlug}`],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
  return buildHeroAbilityHooks(registry, config);
}

/**
 * Builds a game state with the played card (and optionally a Ranged card) in play.
 *
 * @param hooks - The parsed hooks (the played card is the first hook's card).
 * @param isOtherCardRanged - Whether the other in-play card is a Ranged Hero.
 * @returns The game state and the played card id.
 */
function makeState(
  hooks: HeroAbilityHook[],
  isOtherCardRanged: boolean,
): { gameState: LegendaryGameState; playedCardId: CardExtId } {
  const config: MatchConfiguration = {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 0,
  };
  const gameState = buildInitialGameState(config, EMPTY_REGISTRY, makeMockCtx({ numPlayers: 1 }));
  const playedCardId = hooks[0]!.cardId;
  gameState.playerZones['0'] = { ...makePlayerZones(), inPlay: [OTHER_CARD, playedCardId] };
  gameState.cardTraits[OTHER_CARD] = { heroClass: isOtherCardRanged ? 'ranged' : 'strength', team: null };
  gameState.heroAbilityHooks = hooks;
  return { gameState, playedCardId };
}

const LIGHTNING_BOLT = [
  'You get +2[icon:attack] usable only against Villains on the Rooftops.',
  '[hc:ranged]: You may use this bonus [icon:attack] against the Mastermind instead.',
];
const TIDAL_WAVE = [
  'You get +3[icon:attack] usable only against Villains in the Sewers or Bridge.',
  '[hc:ranged]: You may use this bonus [icon:attack] against the Mastermind instead.',
];
const SHOCKING_ROBBERY = [
  'You get +3[icon:attack] usable only against Adversaries in the Bank.',
  '[hc:ranged]: Instead you may get +3[icon:attack] usable only against the Commander.',
];

describe('restricted hero attack grants (WP-790 / D-24652)', () => {
  it('Lightning Bolt grants a Rooftops-only +2 and logs where it can be used', () => {
    const { gameState, playedCardId } = makeState(parse('co2e', 'storm', 'lightning-bolt', LIGHTNING_BOLT), false);
    executeHeroEffects(gameState, makeMockCtx(), '0', playedCardId);
    assert.equal(gameState.turnEconomy.attack, 2, 'the grant counts toward attack made');
    assert.deepEqual(gameState.turnEconomy.restrictedAttack, [
      { remaining: 2, targets: ['rooftops'], sourceCardId: playedCardId },
    ]);
    const messageTexts = gameState.messages.map((message) => (typeof message === 'string' ? message : message.text));
    assert.ok(
      messageTexts.some((text) => /^Player 0 gained \+2 attack \(only against: Rooftops\) from .+\.$/.test(text)),
      `expected the restricted grant log line, got: ${JSON.stringify(messageTexts)}`,
    );
  });

  it('Tidal Wave with another Ranged Hero played also allows the Mastermind', () => {
    const { gameState, playedCardId } = makeState(parse('co2e', 'storm', 'tidal-wave', TIDAL_WAVE), true);
    executeHeroEffects(gameState, makeMockCtx(), '0', playedCardId);
    assert.equal(gameState.turnEconomy.attack, 3);
    assert.deepEqual(gameState.turnEconomy.restrictedAttack?.[0]?.targets, ['sewers', 'bridge', 'mastermind']);
    assert.equal(gameState.turnEconomy.restrictedAttack?.length, 1, 'the follow-up line grants nothing');
  });

  it('Tidal Wave without a Ranged Hero stays Sewers / Bridge only', () => {
    const { gameState, playedCardId } = makeState(parse('co2e', 'storm', 'tidal-wave', TIDAL_WAVE), false);
    executeHeroEffects(gameState, makeMockCtx(), '0', playedCardId);
    assert.deepEqual(gameState.turnEconomy.restrictedAttack?.[0]?.targets, ['sewers', 'bridge']);
  });

  it('Shocking Robbery with Ranged grants ONE +3 usable against the Bank or the Mastermind (not +6)', () => {
    const { gameState, playedCardId } = makeState(parse('vill', 'electro', 'shocking-robbery', SHOCKING_ROBBERY), true);
    executeHeroEffects(gameState, makeMockCtx(), '0', playedCardId);
    assert.equal(gameState.turnEconomy.attack, 3);
    assert.deepEqual(gameState.turnEconomy.restrictedAttack, [
      { remaining: 3, targets: ['bank', 'mastermind'], sourceCardId: playedCardId },
    ]);
  });

  it('a plain +2[icon:attack] line is unchanged: no restrictedAttack key', () => {
    const { gameState, playedCardId } = makeState(parse('test', 'plain', 'plain-punch', ['You get +2[icon:attack].']), false);
    executeHeroEffects(gameState, makeMockCtx(), '0', playedCardId);
    assert.equal(gameState.turnEconomy.attack, 2);
    assert.equal(Object.keys(gameState.turnEconomy).includes('restrictedAttack'), false);
  });
});
