/**
 * Change the Outcome of WWII — the invasions, the conquered capitals and the loss (WP-832 /
 * D-24765).
 *
 * "Twist: The Axis invades a new country. Put all Villains and Bystanders from the city on the
 * bottom of the Villain Deck. The number of city spaces changes. Play 2 cards from the Villain
 * Deck. If any Villains escape this country, stack a Twist next to the scheme as a 'conquered
 * capital.'" Poland 4, France 3, USSR 6, England 3, USA 5, Australia 2, Switzerland 1. "Evil Wins:
 * When 3 capitals are conquered."
 *
 * Builds a full G from the shipped data/cards/ca75.json, resolves Twists through the registered
 * resolver, and drives real escapes through the reveal path (where every escape settles).
 *
 * node:test + node:assert only. No boardgame.io import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { SCHEME_TWIST_RESOLVERS } from './schemeTwistResolvers.js';
import { SCHEME_TWIST_CONFIGS } from './schemeTwistConfigs.js';
import { DEFAULT_IMPLEMENTATION_MAP } from './ruleRuntime.impl.js';
import { WWII_COUNTRIES, settleWwiiConquest } from './changeTheOutcomeOfWwii.logic.js';
import { WWII_CONQUERED_CAPITALS, WWII_COUNTRIES_INVADED } from './changeTheOutcomeOfWwii.constants.js';
import { isTwistLossSuppressed, resolveSchemeLossKind, resolveSchemeLossProgress, resolveSchemeLossThreshold } from './schemeLossProgress.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import type { LegendaryGameState } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';

const here = dirname(fileURLToPath(import.meta.url));
const ca75SetData = JSON.parse(readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', 'ca75.json'), 'utf8'));

const SCHEME_ID = 'ca75/change-the-outcome-of-wwii';
const TWIST_ID = 'scheme-twist-wwii-00' as CardExtId;
const IDENTITY_RANDOM = { Shuffle: <T,>(deck: T[]): T[] => [...deck] };
const REVEAL_CONTEXT: RevealContext = { random: IDENTITY_RANDOM, ctx: { currentPlayer: '0', turn: 3 } };

/** A setup registry over the real ca75 set (getSet serves ca75.json). */
const REGISTRY = {
  listCards: () => [],
  listSets: () => [{ abbr: 'ca75' }],
  getSet: (abbr: string) => (abbr === 'ca75' ? ca75SetData : undefined),
};

/** A ca75 loadout with the scheme under test. */
const CONFIG: MatchSetupConfig = {
  schemeId: SCHEME_ID,
  mastermindId: 'ca75/arnim-zola',
  villainGroupIds: ['ca75/masters-of-evil-wwii', 'ca75/zolas-creations'],
  henchmanGroupIds: [],
  heroDeckIds: ['ca75/agent-x-13', 'ca75/captain-america-falcon', 'ca75/winter-soldier', 'ca75/captain-america-1941'],
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 0,
};

/**
 * Builds a 2-player match on the real ca75 data whose Villain Deck holds only Villains, so the
 * Twist's 2 plays are predictable.
 *
 * @returns The game state and its Villain cards.
 */
function buildMatch(): { G: LegendaryGameState; villains: CardExtId[] } {
  const G = buildInitialGameState(CONFIG, REGISTRY, makeMockCtx({ numPlayers: 2 }));
  const villains = G.villainDeck.deck.filter((cardId) => G.villainDeckCardTypes[cardId] === 'villain');
  G.villainDeck.deck = [...villains];
  return { G, villains };
}

/**
 * Resolves one WWII Twist through the registered resolver.
 *
 * @param G - The game state, mutated in place.
 */
function twist(G: LegendaryGameState): void {
  SCHEME_TWIST_RESOLVERS['change-the-outcome-of-wwii'](G, REVEAL_CONTEXT, DEFAULT_IMPLEMENTATION_MAP, {}, TWIST_ID);
  G.counters.schemeTwistCount = (G.counters.schemeTwistCount ?? 0) + 1;
}

/**
 * The game log's text lines.
 *
 * @param G - The game state.
 * @returns Each log entry's text, in order.
 */
function logText(G: LegendaryGameState): string[] {
  const lines: string[] = [];
  for (const entry of G.messages) {
    lines.push(typeof entry === 'string' ? entry : entry.text);
  }
  return lines;
}

describe('Change the Outcome of WWII — the config (WP-832)', () => {
  it('X1 the scheme dispatches to its resolver and loses at 3 conquered capitals, not at Twist 7', () => {
    const config = SCHEME_TWIST_CONFIGS.get(SCHEME_ID)!;
    assert.equal(config.resolverId, 'change-the-outcome-of-wwii');
    assert.deepEqual(config.resourceLossCondition, { kind: 'scheme-counter', counter: WWII_CONQUERED_CAPITALS, threshold: 3, meterKind: 'conquered-capitals', lossDescription: 'capitals conquered' });
    const { G } = buildMatch();
    assert.equal(isTwistLossSuppressed(G), true);
    G.counters.schemeTwistCount = 7;
    assert.equal(evaluateEndgame(G), null, 'the seventh Twist alone is no longer a loss');
  });
});

describe('Change the Outcome of WWII — an invasion (WP-832)', () => {
  it('X2 Twist 1: the City Villains and their Bystanders go to the Villain Deck bottom, the City becomes 4 spaces, 2 cards are played', () => {
    const { G, villains } = buildMatch();
    const [cityVillain, ...deckVillains] = villains;
    const bystander = G.piles.bystanders[0]!;
    G.piles.bystanders = G.piles.bystanders.slice(1);
    G.city = [cityVillain!, null, null, null, null];
    G.villainDeck.deck = deckVillains;
    G.attachedBystanders[cityVillain!] = [bystander];
    const capturedHero = G.heroDeck[0]!;
    G.villainAttachedHeroes[cityVillain!] = [capturedHero];
    const escapedBefore = [...G.escapedPile];
    twist(G);
    // why: D-24764 §6 — the City is emptied before it resizes, so no Villain escapes a removed space.
    assert.deepEqual(G.escapedPile, escapedBefore, 'nothing escaped across the return and the resize');
    assert.deepEqual(G.villainAttachedHeroes[cityVillain!], [capturedHero], 'a captured Hero travels with its Villain');
    assert.equal(G.city.length, 4);
    assert.deepEqual(G.city, [deckVillains[1], deckVillains[0], null, null], 'the 2 played Villains');
    assert.deepEqual(G.villainDeck.deck.slice(-2), [cityVillain, bystander], 'Villain then its Bystander, at the bottom');
    assert.equal(G.villainDeckCardTypes[bystander], 'bystander', 'the returned Bystander reveals as a Bystander');
    assert.equal(G.attachedBystanders[cityVillain!], undefined);
    assert.equal(G.counters[WWII_COUNTRIES_INVADED], 1);
    assert.ok(logText(G).some((line) => line.includes('Twist 1: the Axis invades Poland') && line.includes('the City now has 4 spaces')));
    const twistEvent = G.notableEvents.find((event) => event.type === 'schemeTwistResolved');
    assert.ok(twistEvent !== undefined && twistEvent.type === 'schemeTwistResolved');
    assert.equal(twistEvent.resolverKey, 'changeTheOutcomeOfWwii');
  });

  it('X3 the seven Twists follow the printed countries; an eighth changes nothing', () => {
    const { G } = buildMatch();
    const sizes: number[] = [];
    for (let twistIndex = 0; twistIndex < 7; twistIndex++) {
      twist(G);
      sizes.push(G.city.length);
    }
    assert.deepEqual(sizes, WWII_COUNTRIES.map((country) => country.citySpaces));
    assert.deepEqual(sizes, [4, 3, 6, 3, 5, 2, 1]);
    twist(G);
    assert.equal(G.city.length, 1);
    assert.equal(G.counters[WWII_COUNTRIES_INVADED], 7);
    assert.ok(logText(G).some((line) => line.includes('no country left to invade')));
  });
});

describe('Change the Outcome of WWII — conquered capitals (WP-832)', () => {
  it('X4 escapes before Twist 1 conquer nothing (the normal City is not a country)', () => {
    const { G, villains } = buildMatch();
    G.escapedPile.push(villains[0]!);
    settleWwiiConquest(G);
    assert.equal(G.counters[WWII_CONQUERED_CAPITALS] ?? 0, 0);
  });

  it('X5 an escape in a country conquers its capital once, however many escape', () => {
    const { G, villains } = buildMatch();
    twist(G);
    G.escapedPile.push(villains[10]!);
    settleWwiiConquest(G);
    G.escapedPile.push(villains[11]!);
    settleWwiiConquest(G);
    assert.equal(G.counters[WWII_CONQUERED_CAPITALS], 1);
    assert.ok(logText(G).some((line) => line.includes('escaped Poland: its capital is conquered (1 of 3)')));
  });

  it('X6 a Villain pushed out by the Twist\'s own plays (Switzerland, 1 space) conquers the new country', () => {
    const { G } = buildMatch();
    for (let twistIndex = 0; twistIndex < 6; twistIndex++) {
      twist(G);
    }
    const capitalsBefore = G.counters[WWII_CONQUERED_CAPITALS] ?? 0;
    twist(G);
    assert.equal(G.city.length, 1);
    assert.equal(G.counters[WWII_CONQUERED_CAPITALS], capitalsBefore + 1, 'the second play pushed the first out of the 1-space City');
    assert.ok(logText(G).some((line) => line.includes('escaped Switzerland')));
  });

  it('X9 an escape just before the next Twist still conquers the country it happened in', () => {
    const { G, villains } = buildMatch();
    twist(G);
    G.escapedPile.push(villains[10]!);
    twist(G);
    assert.equal(G.counters[WWII_CONQUERED_CAPITALS], 1);
    assert.ok(logText(G).some((line) => line.includes('escaped Poland')));
  });

  it('X7 an escape from a later reveal conquers the capital at the escape (no onMove needed)', () => {
    const { G } = buildMatch();
    twist(G);
    const [incoming, ...rest] = G.villainDeck.deck;
    G.city = [rest[0]!, rest[1]!, rest[2]!, rest[3]!];
    G.villainDeck.deck = [incoming!, ...rest.slice(4)];
    G.currentStage = 'start';
    G.villainRevealedThisTurn = false;
    revealVillainCard(makeMockMoveContext(G, { numPlayers: 2 }));
    assert.equal(G.city[0], incoming);
    assert.ok(G.escapedPile.includes(rest[3]!));
    assert.equal(G.counters[WWII_CONQUERED_CAPITALS], 1);
  });

  it('X10 a Twist among the 2 plays invades the NEXT country, and the plays land there', () => {
    const { G, villains } = buildMatch();
    const twistCard = Object.keys(G.villainDeckCardTypes).find((cardId) => G.villainDeckCardTypes[cardId] === 'scheme-twist')!;
    G.villainDeck.deck = [villains[0]!, twistCard, villains[1]!, villains[2]!, villains[3]!];
    twist(G);
    assert.equal(G.counters[WWII_COUNTRIES_INVADED], 2, 'Poland, then France from the nested Twist');
    assert.equal(G.city.length, 3, 'France');
    assert.ok(logText(G).some((line) => line.includes('Twist 2: the Axis invades France')));
    assert.deepEqual(G.city.filter((cardId) => cardId !== null), [villains[2], villains[1]], "the nested Twist's 2 plays, in France");
  });

  it('X8 the third conquered capital is the loss, and the meter reads Capitals N/3', () => {
    const { G } = buildMatch();
    for (let countryIndex = 0; countryIndex < 3; countryIndex++) {
      twist(G);
      assert.equal(resolveSchemeLossKind(G), 'conquered-capitals');
      const runaway = G.villainDeck.deck.find((cardId) => G.villainDeckCardTypes[cardId] === 'villain')!;
      G.villainDeck.deck = G.villainDeck.deck.filter((cardId) => cardId !== runaway);
      G.escapedPile.push(runaway);
      settleWwiiConquest(G);
    }
    assert.equal(G.counters[WWII_CONQUERED_CAPITALS], 3);
    assert.equal(G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
    assert.notEqual(evaluateEndgame(G), null);
    assert.equal(resolveSchemeLossProgress(G), 3);
    assert.equal(resolveSchemeLossThreshold(G), 3);
  });
});
