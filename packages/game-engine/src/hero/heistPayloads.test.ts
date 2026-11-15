/**
 * Heist payloads (WP-876 / D-24823).
 *
 * Pins each branch of the three Heist payloads (The Big Score's Master Strike KO, Revolutionary
 * Anthem's Scheme Twist bonus and optional shuffle, X-Con Security Van's move park) through the
 * real handlers (executeSingleEffect) and the payload module, plus the new koOneOfYourHeroes
 * export the X-Con move resolves through. The whole-Heist flows live in moves/attemptHeist.test.ts.
 *
 * No boardgame.io imports. node:test + node:assert only; makeMockCtx for the forwarded context.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeSingleEffect } from './heroEffects.execute.js';
import {
  applyHeistShuffleResolvedSeatChoice,
  isHeistRevealedSchemeTwist,
  HEIST_SHUFFLE_SEAT_CHOICE_KIND,
} from './heistPayloads.logic.js';
import { koOneOfYourHeroes } from '../villain/villainEffects.execute.js';
import { applySeatChoiceTimeoutDefault } from '../moves/seatChoice.resolve.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { LegendaryGameState, PendingSeatChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealedCardType } from '../villainDeck/villainDeck.types.js';
import { makeGlobalPiles, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

const THE_BIG_SCORE = 'amwp/scott-lang-cat-burglar/the-big-score#0' as CardExtId;
const ANTHEM = 'amwp/ant-army/revolutionary-anthem#0' as CardExtId;
const X_CON = 'amwp/scott-lang-cat-burglar/x-con-security-van#0' as CardExtId;
const MASTER_STRIKE = 'master-strike#0' as CardExtId;
const SCHEME_TWIST = 'scheme-twist#0' as CardExtId;
const VILLAIN = 'test/villain-group/thug#0' as CardExtId;
const CITY_VILLAIN = 'test/villain-group/brute#0' as CardExtId;
const SUPPLY_BYSTANDER = 'pile-bystander' as CardExtId;
const HERO_A = 'test/hero/a#0' as CardExtId;
const HERO_B = 'test/hero/b#0' as CardExtId;

/**
 * A state wide enough for the three handlers: a Villain Deck, its card types, the Bystander Deck,
 * the City, player 0's zones and the turn economy.
 *
 * @param revealedCardId - The card the Heist recorded as revealed, or undefined for no Heist.
 * @returns A minimal LegendaryGameState.
 */
function makeState(revealedCardId?: CardExtId): LegendaryGameState {
  const villainDeckCardTypes: Record<CardExtId, RevealedCardType> = {
    [MASTER_STRIKE]: 'mastermind-strike',
    [SCHEME_TWIST]: 'scheme-twist',
    [VILLAIN]: 'villain',
  };
  const turnEconomy = makeTurnEconomy();
  if (revealedCardId !== undefined) {
    turnEconomy.hasAttemptedHeistThisTurn = true;
    turnEconomy.heistRevealedCardId = revealedCardId;
  }
  return {
    currentStage: 'main',
    messages: [],
    turnEconomy,
    playerZones: { '0': makePlayerZones(), '1': makePlayerZones() },
    piles: makeGlobalPiles({ bystanders: [SUPPLY_BYSTANDER, SUPPLY_BYSTANDER] }),
    villainDeck: { deck: [revealedCardId ?? VILLAIN, VILLAIN], discard: [] },
    villainDeckCardTypes,
    city: [null, null, null, null, null],
    ko: [],
    cardStats: {},
    cardTraits: {},
    cardDisplayData: {},
    heroAbilityHooks: [],
  } as unknown as LegendaryGameState;
}

/**
 * The log text, one line per entry.
 *
 * @param G - The game state.
 * @returns The log lines.
 */
function logLines(G: LegendaryGameState): string[] {
  const lines: string[] = [];
  for (const entry of G.messages as unknown[]) {
    lines.push(typeof entry === 'string' ? entry : (entry as { text: string }).text);
  }
  return lines;
}

/**
 * The outcome of the last log entry.
 *
 * @param G - The game state.
 * @returns Its outcome.
 */
function lastOutcome(G: LegendaryGameState): string | undefined {
  return (G.messages.at(-1) as { outcome?: string } | undefined)?.outcome;
}

describe('heist-master-strike-ko (The Big Score)', () => {
  it('a revealed Master Strike still on top is KO\'d and a Bystander goes on top, typed bystander', () => {
    const G = makeState(MASTER_STRIKE);
    assert.equal(G.villainDeckCardTypes[SUPPLY_BYSTANDER], undefined, 'untyped before');
    assert.equal(executeSingleEffect(G, makeMockCtx(), '0', THE_BIG_SCORE, { type: 'heist-master-strike-ko' }), true);
    assert.deepEqual(G.ko, [MASTER_STRIKE]);
    assert.deepEqual(G.villainDeck.deck, [SUPPLY_BYSTANDER, VILLAIN]);
    assert.equal(G.piles.bystanders.length, 1, 'the Bystander Deck is one shorter');
    assert.equal(G.villainDeckCardTypes[SUPPLY_BYSTANDER], 'bystander');
    assert.equal(lastOutcome(G), 'applied');
  });

  it('an empty Bystander Deck still KOs the Master Strike and puts nothing on top', () => {
    const G = makeState(MASTER_STRIKE);
    G.piles.bystanders = [];
    executeSingleEffect(G, makeMockCtx(), '0', THE_BIG_SCORE, { type: 'heist-master-strike-ko' });
    assert.deepEqual(G.ko, [MASTER_STRIKE]);
    assert.deepEqual(G.villainDeck.deck, [VILLAIN]);
    assert.ok(logLines(G).at(-1)!.includes('the Bystander Deck is empty'));
  });

  it('a revealed Master Strike KO that empties the Villain Deck still KOs it', () => {
    const G = makeState(MASTER_STRIKE);
    G.villainDeck.deck = [MASTER_STRIKE];
    G.piles.bystanders = [];
    executeSingleEffect(G, makeMockCtx(), '0', THE_BIG_SCORE, { type: 'heist-master-strike-ko' });
    assert.deepEqual(G.villainDeck.deck, []);
    assert.deepEqual(G.ko, [MASTER_STRIKE]);
  });

  it('any other revealed type changes no zone (neutral line)', () => {
    for (const revealed of [SCHEME_TWIST, VILLAIN]) {
      const G = makeState(revealed);
      const deckBefore = [...G.villainDeck.deck];
      executeSingleEffect(G, makeMockCtx(), '0', THE_BIG_SCORE, { type: 'heist-master-strike-ko' });
      assert.deepEqual(G.ko, []);
      assert.deepEqual(G.villainDeck.deck, deckBefore);
      assert.equal(G.piles.bystanders.length, 2);
      assert.equal(lastOutcome(G), 'neutral');
      assert.ok(logLines(G).at(-1)!.includes('is not a Master Strike'));
    }
  });

  it('no recorded revealed card changes nothing', () => {
    const G = makeState();
    executeSingleEffect(G, makeMockCtx(), '0', THE_BIG_SCORE, { type: 'heist-master-strike-ko' });
    assert.deepEqual(G.ko, []);
    assert.equal(lastOutcome(G), 'neutral');
  });

  it('a recorded Master Strike no longer on top is not KO\'d (blocked line), even with the live top a Master Strike type', () => {
    const G = makeState(MASTER_STRIKE);
    G.villainDeck.deck = [VILLAIN, MASTER_STRIKE];
    executeSingleEffect(G, makeMockCtx(), '0', THE_BIG_SCORE, { type: 'heist-master-strike-ko' });
    assert.deepEqual(G.ko, []);
    assert.deepEqual(G.villainDeck.deck, [VILLAIN, MASTER_STRIKE]);
    assert.equal(lastOutcome(G), 'blocked');
  });

  it('the type check reads the recorded id, not the live top', () => {
    // why: the live top is a Master Strike but the Heist revealed a Villain.
    const G = makeState(VILLAIN);
    G.villainDeck.deck = [MASTER_STRIKE, VILLAIN];
    executeSingleEffect(G, makeMockCtx(), '0', THE_BIG_SCORE, { type: 'heist-master-strike-ko' });
    assert.deepEqual(G.ko, []);
    assert.ok(logLines(G).at(-1)!.includes('is not a Master Strike'));
  });
});

describe('heist-scheme-twist-bonus (Revolutionary Anthem)', () => {
  it('a revealed Scheme Twist grants +N and parks one shuffle seat choice for the active player', () => {
    const G = makeState(SCHEME_TWIST);
    executeSingleEffect(G, makeMockCtx(), '0', ANTHEM, { type: 'heist-scheme-twist-bonus', magnitude: 2 });
    assert.equal(G.turnEconomy.attack, 2);
    const choice = G.pendingSeatChoice!;
    assert.equal(choice.kind, HEIST_SHUFFLE_SEAT_CHOICE_KIND);
    assert.deepEqual(choice.addressedSeats, ['0']);
    assert.deepEqual(choice.seatPrompts['0']!.options, [
      { label: 'Shuffle the Villain Deck' },
      { label: 'Leave the Villain Deck as it is' },
    ]);
    assert.equal(choice.defaultOptionIndex, 1);
  });

  it('a second Anthem grants another +N but offers no second prompt', () => {
    const G = makeState(SCHEME_TWIST);
    executeSingleEffect(G, makeMockCtx(), '0', ANTHEM, { type: 'heist-scheme-twist-bonus', magnitude: 2 });
    const firstChoice = G.pendingSeatChoice;
    executeSingleEffect(G, makeMockCtx(), '0', ANTHEM, { type: 'heist-scheme-twist-bonus', magnitude: 2 });
    assert.equal(G.turnEconomy.attack, 4);
    assert.equal(G.pendingSeatChoice, firstChoice, 'the open prompt is untouched');
    assert.ok(logLines(G).at(-1)!.includes('has already been offered a shuffle'));
    assert.equal(lastOutcome(G), 'neutral');
  });

  it('any other revealed card grants nothing and parks nothing', () => {
    for (const revealed of [MASTER_STRIKE, VILLAIN]) {
      const G = makeState(revealed);
      executeSingleEffect(G, makeMockCtx(), '0', ANTHEM, { type: 'heist-scheme-twist-bonus', magnitude: 2 });
      assert.equal(G.turnEconomy.attack, 0);
      assert.equal(G.pendingSeatChoice, undefined);
      assert.ok(logLines(G).at(-1)!.includes('is not a Scheme Twist'));
    }
  });

  it('isHeistRevealedSchemeTwist reads the recorded id only', () => {
    assert.equal(isHeistRevealedSchemeTwist(makeState(SCHEME_TWIST)), true);
    assert.equal(isHeistRevealedSchemeTwist(makeState(VILLAIN)), false);
    const unattempted = makeState();
    unattempted.villainDeck.deck = [SCHEME_TWIST];
    assert.equal(isHeistRevealedSchemeTwist(unattempted), false, 'a live Scheme Twist top with no Heist is not "revealed"');
  });
});

describe('the heist-shuffle-villain-deck apply', () => {
  /**
   * A submitted shuffle choice for player 0.
   *
   * @param optionIndex - The chosen option.
   * @returns The seat choice.
   */
  function submitted(optionIndex: number): PendingSeatChoice {
    return {
      kind: HEIST_SHUFFLE_SEAT_CHOICE_KIND,
      addressedSeats: ['0'],
      seatPrompts: { '0': { options: [{ label: 'Shuffle the Villain Deck' }, { label: 'Leave the Villain Deck as it is' }] } },
      submissions: { '0': { optionIndex } },
      defaultOptionIndex: 1,
    };
  }

  it('Shuffle reorders the deck through random.Shuffle, same multiset', () => {
    const G = makeState(SCHEME_TWIST);
    G.villainDeck.deck = [SCHEME_TWIST, VILLAIN, MASTER_STRIKE];
    applyHeistShuffleResolvedSeatChoice(G, submitted(0), makeMockCtx());
    assert.deepEqual(G.villainDeck.deck, [MASTER_STRIKE, VILLAIN, SCHEME_TWIST], 'makeMockCtx reverses, proving the shuffle ran');
    assert.equal(lastOutcome(G), 'applied');
  });

  it('Leave keeps the deck identical', () => {
    const G = makeState(SCHEME_TWIST);
    applyHeistShuffleResolvedSeatChoice(G, submitted(1), makeMockCtx());
    assert.deepEqual(G.villainDeck.deck, [SCHEME_TWIST, VILLAIN]);
    assert.equal(lastOutcome(G), 'neutral');
  });

  it('Shuffle with no shuffle source shuffles nothing (blocked line)', () => {
    const G = makeState(SCHEME_TWIST);
    applyHeistShuffleResolvedSeatChoice(G, submitted(0), undefined);
    assert.deepEqual(G.villainDeck.deck, [SCHEME_TWIST, VILLAIN]);
    assert.equal(lastOutcome(G), 'blocked');
  });

  it('the timeout default leaves the deck and clears the choice, with no generic resolved line', () => {
    const G = makeState(SCHEME_TWIST);
    G.pendingSeatChoice = { ...submitted(1), submissions: {} };
    applySeatChoiceTimeoutDefault(G, ['0']);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepEqual(G.villainDeck.deck, [SCHEME_TWIST, VILLAIN]);
    assert.equal(logLines(G).some((line) => line.startsWith('Seat 0 resolved')), false);
  });
});

describe('heist-move-villain-ko-hero (X-Con Security Van)', () => {
  it('a City Villain and an empty space park one x-con-security-van entry', () => {
    const G = makeState(VILLAIN);
    G.city = [CITY_VILLAIN, null, null, null, null];
    executeSingleEffect(G, makeMockCtx(), '0', X_CON, { type: 'heist-move-villain-ko-hero' });
    assert.deepEqual(G.pendingMoveVillainChoices, [{ playerID: '0', sourceCardId: X_CON, variant: 'x-con-security-van' }]);
    assert.equal(lastOutcome(G), 'neutral');
  });

  it('no City Villain parks nothing (blocked line)', () => {
    const G = makeState(VILLAIN);
    executeSingleEffect(G, makeMockCtx(), '0', X_CON, { type: 'heist-move-villain-ko-hero' });
    assert.equal(G.pendingMoveVillainChoices, undefined);
    assert.equal(lastOutcome(G), 'blocked');
  });

  it('a full City parks nothing (blocked line)', () => {
    const G = makeState(VILLAIN);
    G.city = [CITY_VILLAIN, VILLAIN, CITY_VILLAIN, VILLAIN, CITY_VILLAIN];
    executeSingleEffect(G, makeMockCtx(), '0', X_CON, { type: 'heist-move-villain-ko-hero' });
    assert.equal(G.pendingMoveVillainChoices, undefined);
    assert.equal(lastOutcome(G), 'blocked');
  });
});

describe('koOneOfYourHeroes (WP-876 / D-24823)', () => {
  it('no Hero in hand or play: none', () => {
    const G = makeState();
    G.playerZones['0']!.hand = ['pile-wound' as CardExtId];
    G.playerZones['0']!.discard = [HERO_A];
    assert.deepEqual(koOneOfYourHeroes(G, '0'), { outcome: 'none' });
    assert.deepEqual(G.ko, []);
  });

  it('one Hero: KO\'d with no prompt, its zone reported', () => {
    const G = makeState();
    G.playerZones['0']!.inPlay = [HERO_A];
    assert.deepEqual(koOneOfYourHeroes(G, '0'), { outcome: 'koed', koedCardId: HERO_A, zone: 'inPlay' });
    assert.deepEqual(G.ko, [HERO_A]);
    assert.deepEqual(G.playerZones['0']!.inPlay, []);
    assert.equal(G.pendingKoHeroChoices, undefined);
  });

  it('two identical copies in one zone: forced, KO\'d with no prompt', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HERO_A, HERO_A];
    assert.equal(koOneOfYourHeroes(G, '0').outcome, 'koed');
    assert.deepEqual(G.playerZones['0']!.hand, [HERO_A]);
  });

  it('two distinct Heroes: parks the bare ko-hero entry and KOs nothing', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HERO_A];
    G.playerZones['0']!.inPlay = [HERO_B];
    assert.deepEqual(koOneOfYourHeroes(G, '0'), { outcome: 'parked' });
    assert.deepEqual(G.pendingKoHeroChoices, [{ choiceType: 'ko-hero', playerID: '0' }]);
    assert.deepEqual(G.ko, []);
  });

  it('writes no log line', () => {
    const G = makeState();
    G.playerZones['0']!.inPlay = [HERO_A];
    koOneOfYourHeroes(G, '0');
    assert.equal(G.messages.length, 0);
  });
});
