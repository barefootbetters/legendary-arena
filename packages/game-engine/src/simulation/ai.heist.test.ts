/**
 * The bot's Heist decision (WP-878 / D-24826).
 *
 * Builds the REAL Heist hooks from the committed data/cards/amwp.json, so the payoff walk reads the
 * same fused `heist` effects fireHeistPlays fires. Pins the card-count tally, that the decision
 * never depends on the deck's order or top card, the X-Con-only exclusion, every isHeistAvailable
 * failure, and that none of the three helpers mutates G.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { countHeistOdds, hasBotHeistPayoff, shouldBotAttemptHeist } from './ai.heist.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealedCardType } from '../villainDeck/villainDeck.types.js';
import { makeCardStatEntry, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const PETTY_LARCENY = 'amwp/scott-lang-cat-burglar/petty-larceny#0' as CardExtId;
const X_CON_SECURITY_VAN = 'amwp/scott-lang-cat-burglar/x-con-security-van#0' as CardExtId;
const X_CON_SECURITY_VAN_SECOND = 'amwp/scott-lang-cat-burglar/x-con-security-van#1' as CardExtId;
const HAND_TWO = 'test/hand-hero/two-cost#0' as CardExtId;

const SCHEME_TWIST = 'scheme-twist#0' as CardExtId;
const BYSTANDER = 'bystander#0' as CardExtId;
const HENCHMAN = 'test/henchman-group/goon#0' as CardExtId;
const VILLAIN_TWO = 'test/villain-group/thug#0' as CardExtId;
const VILLAIN_TWO_SECOND = 'test/villain-group/thug#1' as CardExtId;
const VILLAIN_FOUR = 'test/villain-group/brute#0' as CardExtId;
const VILLAIN_FOUR_SECOND = 'test/villain-group/brute#1' as CardExtId;

/** The locked odds deck (EC-916): Scheme Twist 0, Bystander 1, henchman 1, villain 2, villain 4. */
const LOCKED_DECK: CardExtId[] = [SCHEME_TWIST, BYSTANDER, HENCHMAN, VILLAIN_TWO, VILLAIN_FOUR];

/**
 * Builds the real hooks for the Scott Lang, Cat Burglar Hero deck from the committed card data.
 *
 * @returns Every hook the match carries.
 */
function buildHooks(): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'amwp.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'amwp' ? setData : undefined) };
  const config = { heroDeckIds: ['amwp/scott-lang-cat-burglar'] } as unknown as MatchConfiguration;
  return buildHeroAbilityHooks(registry, config);
}

const HOOKS = buildHooks();

/**
 * A one-seat main-stage state with Petty Larceny played and readied and a 2-cost Hero in hand, so
 * the Heist Count is 2 ({1, 2}). The Villain Deck is the locked odds deck.
 *
 * @returns A LegendaryGameState sufficient for the Heist helpers.
 */
function makeState(): LegendaryGameState {
  const villainDeckCardTypes: Record<CardExtId, RevealedCardType> = {
    [SCHEME_TWIST]: 'scheme-twist',
    [BYSTANDER]: 'bystander',
    [HENCHMAN]: 'henchman',
    [VILLAIN_TWO]: 'villain',
    [VILLAIN_TWO_SECOND]: 'villain',
    [VILLAIN_FOUR]: 'villain',
    [VILLAIN_FOUR_SECOND]: 'villain',
  };
  return {
    currentStage: 'main',
    turnEconomy: { ...makeTurnEconomy(), heistCrewCards: [PETTY_LARCENY] },
    playerZones: {
      '0': { ...makePlayerZones(), hand: [HAND_TWO], inPlay: [PETTY_LARCENY] },
    },
    villainDeck: { deck: [...LOCKED_DECK], discard: [] },
    villainDeckCardTypes,
    cardVictoryPoints: {
      [HENCHMAN]: 1,
      [VILLAIN_TWO]: 2,
      [VILLAIN_TWO_SECOND]: 2,
      [VILLAIN_FOUR]: 4,
      [VILLAIN_FOUR_SECOND]: 4,
    },
    cardStats: {
      [PETTY_LARCENY]: makeCardStatEntry({ cost: 1 }),
      [X_CON_SECURITY_VAN]: makeCardStatEntry({ cost: 5 }),
      [X_CON_SECURITY_VAN_SECOND]: makeCardStatEntry({ cost: 5 }),
      [HAND_TWO]: makeCardStatEntry({ cost: 2 }),
    },
    heroAbilityHooks: HOOKS,
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
  } as unknown as LegendaryGameState;
}

/**
 * Replaces the readied crew and the played cards with the given cards.
 *
 * @param G - The game state.
 * @param crew - The cards played and readied this turn.
 */
function setCrew(G: LegendaryGameState, crew: CardExtId[]): void {
  G.turnEconomy.heistCrewCards = [...crew];
  G.playerZones['0']!.inPlay = [...crew];
}

describe('WP-878 countHeistOdds — the card-count tally (D-24826 §1)', () => {
  it('tallies the locked deck at Heist Count 2: win 3, tie 1, lose 1', () => {
    const G = makeState();
    assert.deepEqual(countHeistOdds(G, '0'), { winCount: 3, tieCount: 1, loseCount: 1 });
  });

  it('gives the same tally and the same decision for the reversed deck', () => {
    const G = makeState();
    const forwardOdds = countHeistOdds(G, '0');
    const forwardDecision = shouldBotAttemptHeist(G, '0');
    G.villainDeck.deck = [...LOCKED_DECK].reverse();
    assert.deepEqual(countHeistOdds(G, '0'), forwardOdds);
    assert.equal(shouldBotAttemptHeist(G, '0'), forwardDecision);
    assert.equal(forwardDecision, true, 'the locked deck favors the Heist');
  });

  it('is all zero for an empty or absent Villain Deck', () => {
    const G = makeState();
    G.villainDeck.deck = [];
    assert.deepEqual(countHeistOdds(G, '0'), { winCount: 0, tieCount: 0, loseCount: 0 });
    (G as { villainDeck?: unknown }).villainDeck = undefined;
    assert.deepEqual(countHeistOdds(G, '0'), { winCount: 0, tieCount: 0, loseCount: 0 });
  });
});

describe('WP-878 shouldBotAttemptHeist — never reads the top card (D-24826 §1, §5)', () => {
  it('attempts when the top card would lose but the deck as a set favors the Heist', () => {
    const G = makeState();
    G.villainDeck.deck = [VILLAIN_FOUR, SCHEME_TWIST, BYSTANDER, HENCHMAN];
    assert.deepEqual(countHeistOdds(G, '0'), { winCount: 3, tieCount: 0, loseCount: 1 });
    assert.equal(shouldBotAttemptHeist(G, '0'), true);
  });

  it('does not attempt when the top card would win but the deck as a set does not favor it', () => {
    const G = makeState();
    G.villainDeck.deck = [SCHEME_TWIST, VILLAIN_FOUR, VILLAIN_FOUR_SECOND, VILLAIN_TWO];
    assert.deepEqual(countHeistOdds(G, '0'), { winCount: 1, tieCount: 1, loseCount: 2 });
    assert.equal(shouldBotAttemptHeist(G, '0'), false);
  });

  it('does not attempt when every card ties (ties count as neither)', () => {
    const G = makeState();
    G.villainDeck.deck = [VILLAIN_TWO, VILLAIN_TWO_SECOND];
    assert.deepEqual(countHeistOdds(G, '0'), { winCount: 0, tieCount: 2, loseCount: 0 });
    assert.equal(shouldBotAttemptHeist(G, '0'), false);
  });

  it('does not attempt when wins and losses are equal', () => {
    const G = makeState();
    G.villainDeck.deck = [SCHEME_TWIST, VILLAIN_FOUR];
    assert.equal(shouldBotAttemptHeist(G, '0'), false);
  });
});

describe('WP-878 hasBotHeistPayoff — X-Con Security Van alone pays the bot nothing (D-24826 §3)', () => {
  it('a crew of X-Con Security Van alone has no payoff, so the bot does not attempt', () => {
    const G = makeState();
    setCrew(G, [X_CON_SECURITY_VAN]);
    assert.equal(hasBotHeistPayoff(G), false);
    assert.equal(shouldBotAttemptHeist(G, '0'), false);
  });

  it('two X-Con copies still have no payoff', () => {
    const G = makeState();
    setCrew(G, [X_CON_SECURITY_VAN, X_CON_SECURITY_VAN_SECOND]);
    assert.equal(hasBotHeistPayoff(G), false);
  });

  it('X-Con Security Van plus Petty Larceny has a payoff, so the bot attempts', () => {
    const G = makeState();
    setCrew(G, [X_CON_SECURITY_VAN, PETTY_LARCENY]);
    assert.equal(hasBotHeistPayoff(G), true);
    assert.equal(shouldBotAttemptHeist(G, '0'), true);
  });

  it('an empty crew, or a G without hooks, has no payoff', () => {
    const G = makeState();
    setCrew(G, []);
    assert.equal(hasBotHeistPayoff(G), false);
    const noHooks = makeState();
    (noHooks as { heroAbilityHooks?: unknown }).heroAbilityHooks = undefined;
    assert.equal(hasBotHeistPayoff(noHooks), false);
  });
});

describe('WP-878 shouldBotAttemptHeist — every isHeistAvailable failure (D-24826 §2)', () => {
  it('is false outside the main stage', () => {
    const G = makeState();
    G.currentStage = 'cleanup';
    assert.equal(shouldBotAttemptHeist(G, '0'), false);
  });

  it('is false while a choice is open', () => {
    const G = makeState();
    G.pendingMoveVillainChoices = [
      { playerID: '0', sourceCardId: X_CON_SECURITY_VAN, variant: 'x-con-security-van' },
    ];
    assert.equal(shouldBotAttemptHeist(G, '0'), false);
  });

  it('is false with nothing readied', () => {
    const G = makeState();
    G.turnEconomy.heistCrewCards = [];
    assert.equal(shouldBotAttemptHeist(G, '0'), false);
  });

  it('is false once this turn\'s Heist was attempted', () => {
    const G = makeState();
    G.turnEconomy.hasAttemptedHeistThisTurn = true;
    assert.equal(shouldBotAttemptHeist(G, '0'), false);
  });

  it('is false for a seat with no zones', () => {
    const G = makeState();
    assert.equal(shouldBotAttemptHeist(G, '1'), false);
  });

  it('is false with an empty Villain Deck', () => {
    const G = makeState();
    G.villainDeck.deck = [];
    assert.equal(shouldBotAttemptHeist(G, '0'), false);
  });
});

describe('WP-878 Heist helpers never mutate G', () => {
  it('G deep-equals its structuredClone after all three helpers run', () => {
    const G = makeState();
    setCrew(G, [X_CON_SECURITY_VAN, PETTY_LARCENY]);
    const before = structuredClone(G);
    countHeistOdds(G, '0');
    hasBotHeistPayoff(G);
    shouldBotAttemptHeist(G, '0');
    assert.deepStrictEqual(G, before);
  });
});
