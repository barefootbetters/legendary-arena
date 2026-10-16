/**
 * Core Wolverine "Berserker Rage" — +1 attack per extra card drawn this turn (D-24732).
 *
 * "Draw three cards." / "[hc:instinct]: You get +1[icon:attack] for each extra card you've
 * drawn this turn." Before D-24732 the second line had no marker, so the icon extractor read
 * "+1[icon:attack]" as a flat +1. The curated marker now emits an attack-per-count effect on
 * the extra-cards-drawn-this-turn source, which reads G.turnEconomy.cardsDrawn: every effect
 * draw the current player makes this turn, never the hand drawn at end of turn.
 *
 * Covers: +3 from its own draws once another Instinct Hero is played; +4 after Keen Senses
 * drew 1 earlier; the [hc:instinct] gate blocks the grant; a reveal-draw (Spider-Man's
 * Astonishing Strength) counts; the end-of-turn hand fill (incl. a next-hand override, the
 * Treasures of Latveria shape) does not. Uses the real parser over the generated core lines.
 * Uses node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects, executeSingleEffect } from './heroEffects.execute.js';
import { applyEndOfTurnCleanup } from '../moves/endOfTurnCleanup.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook, HeroEffectDescriptor } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

// why: the exact generated core lines (data/cards/core.json after the hero-ability-markers
// pass), so the test exercises the same parse a live match does.
const WOLVERINE_CARDS = [
  { slug: 'keen-senses', abilities: ['[hc:instinct]: Draw a card. [keyword:draw:1]'] },
  { slug: 'healing-factor', abilities: ['You may KO a Wound from your hand or discard pile. If you do, draw a card. [keyword:ko-wound-reward:draw:1]'] },
  {
    slug: 'berserker-rage',
    abilities: [
      'Draw three cards. [keyword:draw:3]',
      "[hc:instinct]: You get +1[icon:attack] for each extra card you've drawn this turn. [keyword:attack-per-count:extra-cards-drawn-this-turn:1]",
    ],
  },
];
const SPIDER_MAN_CARDS = [
  { slug: 'astonishing-strength', abilities: ['Reveal the top card of your deck. If that card costs 2 or less, draw it. [keyword:reveal:2]'] },
];

const BERSERKER_RAGE = 'core/wolverine/berserker-rage#0';
const KEEN_SENSES = 'core/wolverine/keen-senses#0';
const HEALING_FACTOR = 'core/wolverine/healing-factor#0';
const ASTONISHING_STRENGTH = 'core/spider-man/astonishing-strength#0';
const AGENT = 'starting-shield-agent';
const TROOPER = 'starting-shield-trooper';

/** Builds a minimal getSet registry holding the core Wolverine and Spider-Man cards. */
function makeRegistry(): unknown {
  const toHero = (heroSlug: string, cards: { slug: string; abilities: string[] }[]) => ({
    slug: heroSlug,
    cards,
    physicalCards: cards.map((card, index) => ({ id: `${heroSlug}-p${String(index)}`, count: 1, sides: [card.slug] })),
  });
  const setData = {
    abbr: 'core',
    heroes: [toHero('wolverine', WOLVERINE_CARDS), toHero('spider-man', SPIDER_MAN_CARDS)],
    villains: [],
    henchmen: [],
    schemes: [],
    masterminds: [],
    bystanders: [],
    wounds: [],
    other: [],
  };
  return {
    listCards: () => [],
    listSets: () => [{ abbr: 'core' }],
    getSet: (abbr: string) => (abbr === 'core' ? setData : undefined),
  };
}

/** A valid mock MatchSetupConfig selecting the core Wolverine and Spider-Man hero decks. */
function makeConfig(): MatchSetupConfig {
  return {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: ['test/villain-001'],
    henchmanGroupIds: ['test/henchman-001'],
    heroDeckIds: ['core/wolverine', 'core/spider-man'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

/**
 * One-player state with the given cards in play and a deck of starters to draw from.
 *
 * @param inPlay - The cards played this turn, in play order.
 * @param deck - The player's deck (top = index 0).
 */
function makeState(inPlay: string[], deck: string[]): LegendaryGameState {
  return {
    messages: [],
    currentStage: 'main',
    turnEconomy: makeTurnEconomy(),
    playerZones: { '0': makePlayerZones({ deck: [...deck], inPlay: [...inPlay] }) },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    heroAbilityHooks: buildHeroAbilityHooks(makeRegistry(), makeConfig()) as HeroAbilityHook[],
    cardTraits: {
      [BERSERKER_RAGE]: { heroClass: 'instinct', team: 'x-men' },
      [KEEN_SENSES]: { heroClass: 'instinct', team: 'x-men' },
      [HEALING_FACTOR]: { heroClass: 'instinct', team: 'x-men' },
      [ASTONISHING_STRENGTH]: { heroClass: 'strength', team: 'spider-friends' },
    },
    cardStats: {
      [AGENT]: { cost: 0, attack: 0, recruit: 1 },
      [TROOPER]: { cost: 0, attack: 1, recruit: 0 },
    },
    cardKeywords: {},
    cardDisplayData: {},
    hq: [null, null, null, null, null],
    city: [null, null, null, null, null],
    ko: [],
  } as unknown as LegendaryGameState;
}

const heroCtx = {
  ctx: { turn: 1 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/** Ten starters to draw from — enough for every play in these tests. */
function starterDeck(): string[] {
  return [AGENT, TROOPER, AGENT, TROOPER, AGENT, TROOPER, AGENT, TROOPER, AGENT, TROOPER];
}

describe('core Berserker Rage — +1 attack per extra card drawn this turn (D-24732)', () => {
  it('after one other Instinct play, grants +3 from its own three draws', () => {
    const gameState = makeState([HEALING_FACTOR, BERSERKER_RAGE], starterDeck());
    executeHeroEffects(gameState, heroCtx, '0', BERSERKER_RAGE);
    assert.equal(gameState.playerZones['0']!.hand.length, 3, 'line 1 drew three cards');
    assert.equal(gameState.turnEconomy.cardsDrawn, 3, 'the three draws count as extra cards');
    assert.equal(gameState.turnEconomy.attack, 3, '+1 per extra card drawn = +3, not the flat +1');
  });

  it('grants +4 after Keen Senses drew 1 earlier this turn', () => {
    const gameState = makeState([HEALING_FACTOR, KEEN_SENSES], starterDeck());
    executeHeroEffects(gameState, heroCtx, '0', KEEN_SENSES);
    assert.equal(gameState.turnEconomy.cardsDrawn, 1, 'Keen Senses drew one card');
    gameState.playerZones['0']!.inPlay.push(BERSERKER_RAGE);
    executeHeroEffects(gameState, heroCtx, '0', BERSERKER_RAGE);
    assert.equal(gameState.playerZones['0']!.hand.length, 4, 'one card from Keen Senses, three from Berserker Rage');
    assert.equal(gameState.turnEconomy.attack, 4, '1 + 3 extra cards drawn = +4');
  });

  it('grants nothing from line 2 without another Instinct Hero played, but still draws three', () => {
    const gameState = makeState([BERSERKER_RAGE], starterDeck());
    executeHeroEffects(gameState, heroCtx, '0', BERSERKER_RAGE);
    assert.equal(gameState.playerZones['0']!.hand.length, 3, 'the ungated draw line still resolves');
    assert.equal(gameState.turnEconomy.attack, 0, 'the [hc:instinct] gate blocks the count-scaled grant');
  });

  it('counts a reveal-draw (Astonishing Strength) as an extra card drawn', () => {
    // why: Astonishing Strength is a Strength card, so Healing Factor supplies the Instinct gate.
    const gameState = makeState([HEALING_FACTOR, ASTONISHING_STRENGTH], starterDeck());
    executeHeroEffects(gameState, heroCtx, '0', ASTONISHING_STRENGTH);
    assert.equal(gameState.playerZones['0']!.hand.length, 1, 'the cost-0 deck top was drawn');
    assert.equal(gameState.turnEconomy.cardsDrawn, 1, 'the reveal-draw counts toward cardsDrawn');
    gameState.playerZones['0']!.inPlay.push(BERSERKER_RAGE);
    executeHeroEffects(gameState, heroCtx, '0', BERSERKER_RAGE);
    assert.equal(gameState.turnEconomy.attack, 4, '1 reveal-draw + 3 own draws = +4');
  });

  it('a reveal that leaves the card on top (cost above 2) counts nothing', () => {
    const gameState = makeState([HEALING_FACTOR, ASTONISHING_STRENGTH], [BERSERKER_RAGE, ...starterDeck()]);
    gameState.cardStats[BERSERKER_RAGE] = { cost: 8, attack: 0, recruit: 0 } as LegendaryGameState['cardStats'][string];
    executeHeroEffects(gameState, heroCtx, '0', ASTONISHING_STRENGTH);
    assert.equal(gameState.playerZones['0']!.hand.length, 0, 'the 8-cost deck top stayed on the deck');
    assert.equal(gameState.turnEconomy.cardsDrawn, 0, 'no draw, no count');
  });

  it('the end-of-turn hand draw, including a next-hand override, does not count', () => {
    const gameState = makeState([HEALING_FACTOR], starterDeck());
    gameState.turnEconomy.cardsDrawn = 2;
    // why: the Treasures of Latveria / Savage Land Mutates shape — a bigger next hand.
    gameState.handSizeOverrides = { '0': 9 };
    applyEndOfTurnCleanup(gameState, '0', heroCtx);
    assert.equal(gameState.playerZones['0']!.hand.length, 9, 'the new hand was drawn');
    assert.equal(gameState.turnEconomy.cardsDrawn, 2, 'the hand fill adds nothing to cardsDrawn');
  });
});

describe('Psychic Link — only the playing player draw counts toward cardsDrawn (D-24732)', () => {
  const REVEAL_EFFECT: HeroEffectDescriptor = {
    type: 'reveal-from-hand',
    revealCriterion: { kind: 'team', team: 'x-men' },
  };

  it('both players reveal and draw; only player 0 (the current player) adds to the count', () => {
    const gameState = makeState([], starterDeck());
    gameState.playerZones['0']!.hand = [KEEN_SENSES];
    gameState.playerZones['1'] = makePlayerZones({ hand: [HEALING_FACTOR], deck: starterDeck() });
    executeSingleEffect(gameState, heroCtx, '0', 'core/emma-frost/psychic-link#0', REVEAL_EFFECT);
    assert.equal(gameState.playerZones['0']!.hand.length, 2, 'player 0 drew');
    assert.equal(gameState.playerZones['1']!.hand.length, 2, 'player 1 drew');
    assert.equal(gameState.turnEconomy.cardsDrawn, 1, 'only the current player draw counts');
  });
});
