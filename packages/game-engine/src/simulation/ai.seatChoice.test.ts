/**
 * Unit tests for choosePlayingSeatChoiceOption (D-24744): the option a PLAYING
 * seat submits for an open seat choice, as opposed to the absent-seat
 * defaultOptionIndex that getLegalMoves offers.
 *
 * Each choice is built by the engine's own builder, so the option order under
 * test is the order the live game parks. node:test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState, PendingSeatChoice } from '../types.js';
import { choosePlayingSeatChoiceOption } from './ai.seatChoice.js';
import { getLegalMoves } from './ai.legalMoves.js';
import { openDivingBlockSeatChoiceIfNeeded } from '../moves/divingBlock.logic.js';
import {
  buildRandomActsWoundChoice,
  buildPassLeftChoice,
  buildHereHoldThisChoice,
  buildHereHoldThisTargets,
} from '../moves/seatChoiceCards.js';
import { makeCardStatEntry, makeTurnEconomy } from '../test/fixtureBuilders.js';
import {
  buildMonarchsDecreeModeChoice,
  buildMonarchsDiscardChoice,
  buildVanishingIllusionsChoice,
} from '../moves/seatChoiceTactics.js';
import {
  buildEscapeBystanderDiscardChoice,
  buildEscapeEffectCostDiscardChoice,
} from '../villainDeck/villainEscapeProcedure.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { parkHeistShuffleChoice } from '../hero/heistPayloads.logic.js';
import { buildGainWoundRewardChoice } from '../hero/gainWoundReward.logic.js';

/**
 * Minimal G carrying only the fields the builders and the policy read.
 *
 * @param handsBySeat - Each seat's hand.
 * @param extra - Fields merged over the base state.
 * @returns A partial LegendaryGameState.
 */
function makeState(
  handsBySeat: Record<string, string[]>,
  extra: Record<string, unknown> = {},
): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const seat of Object.keys(handsBySeat)) {
    playerZones[seat] = { deck: [], hand: [...handsBySeat[seat]!], discard: [], inPlay: [], victory: [] };
  }
  return {
    playerZones,
    cardDisplayData: {},
    cardStats: {},
    villainDeckCardTypes: {},
    mastermind: { tacticsDefeated: [], baseCardId: 'core-mastermind-loki' },
    messages: [],
    ...extra,
  } as unknown as LegendaryGameState;
}

/**
 * Parks a choice on G (no framework stage ride) and returns G.
 *
 * @param G - The state to mutate.
 * @param choice - The choice to park.
 * @returns The same state.
 */
function withChoice(G: LegendaryGameState, choice: PendingSeatChoice | undefined): LegendaryGameState {
  assert.ok(choice, 'the builder must produce a choice for this fixture');
  G.pendingSeatChoice = choice;
  return G;
}

describe('choosePlayingSeatChoiceOption (D-24744)', () => {
  it('reveals Diving Block, where the absent-seat default takes the Wound', () => {
    const G = makeState({ '0': [], '1': ['core-hero-black-widow-diving-block#0'] }, {
      pendingDivingBlockWounds: [{ playerID: '1', woundCardId: WOUND_EXT_ID }],
    });
    openDivingBlockSeatChoiceIfNeeded(G, undefined);
    assert.equal(G.pendingSeatChoice?.kind, 'diving-block');

    const absentDefault = getLegalMoves(G, { phase: 'play', turn: 1, currentPlayer: '1', numPlayers: 2 } as never);
    assert.deepEqual(absentDefault, [{ name: 'resolveSeatChoice', args: { optionIndex: 1 } }],
      'getLegalMoves keeps the D-24499 decline default for an absent seat');
    assert.equal(choosePlayingSeatChoiceOption(G, '1'), 0, 'a playing seat reveals');
    assert.match(G.pendingSeatChoice!.seatPrompts['1']!.options[0]!.label, /^Reveal Diving Block/);
  });

  it('takes the Random Acts Diving Block draw when offered, and keeps decline otherwise', () => {
    const withDivingBlock = withChoice(makeState({ '0': [] }), buildRandomActsWoundChoice('0', true));
    assert.equal(choosePlayingSeatChoiceOption(withDivingBlock, '0'), 2);

    const withoutDivingBlock = withChoice(makeState({ '0': [] }), buildRandomActsWoundChoice('0', false));
    assert.equal(choosePlayingSeatChoiceOption(withoutDivingBlock, '0'), 1);
  });

  it("discards a Wound first for Monarch's Decree, else the cheapest card", () => {
    const cardStats = {
      'hero-expensive#0': { cost: 7 },
      'starting-agent#0': { cost: 0 },
      'hero-mid#0': { cost: 4 },
    };
    const withWound = makeState({ '0': [], '1': ['hero-expensive#0', 'starting-agent#0', WOUND_EXT_ID] }, { cardStats });
    withChoice(withWound, buildMonarchsDiscardChoice(withWound, ['1']));
    assert.equal(choosePlayingSeatChoiceOption(withWound, '1'), 2);

    const noWound = makeState({ '0': [], '1': ['hero-expensive#0', 'hero-mid#0', 'starting-agent#0'] }, { cardStats });
    withChoice(noWound, buildMonarchsDiscardChoice(noWound, ['1']));
    assert.equal(readAbsentSeatDefault(noWound), 0, 'the absent-seat default discards the 7-cost Hero');
    assert.equal(choosePlayingSeatChoiceOption(noWound, '1'), 2);
  });

  it('discards the cheapest card for an escaped Bystander', () => {
    const G = makeState({ '0': ['hero-expensive#0', 'starting-agent#0'] }, {
      cardStats: { 'hero-expensive#0': { cost: 7 }, 'starting-agent#0': { cost: 0 } },
    });
    withChoice(G, buildEscapeBystanderDiscardChoice(G));
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), 1);
  });

  it('KOs the lowest-VP Villain for Vanishing Illusions', () => {
    const G = makeState({ '0': [], '1': [] }, {
      villainDeckCardTypes: { 'villain-big#0': 'villain', 'henchman-small#0': 'henchman' },
      cardVictoryPoints: { 'villain-big#0': 5, 'henchman-small#0': 1 },
    });
    G.playerZones['1']!.victory = ['villain-big#0', 'henchman-small#0'];
    withChoice(G, buildVanishingIllusionsChoice(G, ['1']));
    assert.equal(readAbsentSeatDefault(G), 0, 'the absent-seat default KOs the 5-VP Villain');
    assert.equal(choosePlayingSeatChoiceOption(G, '1'), 1);
  });

  it("keeps the default where it already is the present-player answer", () => {
    const monarchsMode = withChoice(makeState({ '0': [] }), buildMonarchsDecreeModeChoice('0'));
    assert.equal(choosePlayingSeatChoiceOption(monarchsMode, '0'), 0, 'each other player draws');
  });

  it('passes a Wound left for Random Acts, else the cheapest card (D-24745)', () => {
    const cardStats = { 'hero-expensive#0': { cost: 7 }, 'starting-agent#0': { cost: 0 } };
    const G = makeState({
      '0': ['hero-expensive#0', 'starting-agent#0'],
      '1': ['hero-expensive#1', WOUND_EXT_ID],
    }, { cardStats });
    withChoice(G, buildPassLeftChoice(G, ['0', '1']));
    assert.equal(readAbsentSeatDefault(G), 0, 'the absent-seat default passes the first hand card');
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), 1, 'the 0-cost starter, not the 7-cost Hero');
    assert.equal(choosePlayingSeatChoiceOption(G, '1'), 1, 'the Wound');

    const tied = makeState({ '0': ['a#0', 'b#0'], '1': ['c#0'] });
    withChoice(tied, buildPassLeftChoice(tied, ['0', '1']));
    assert.equal(choosePlayingSeatChoiceOption(tied, '0'), 0, 'equal cost keeps the earliest card');
  });

  it('Here, Hold This: the cheapest Villain the seat can fight now (D-24745)', () => {
    const G = makeCityState(3, ['villain-a#0', null, 'villain-b#0', 'villain-c#0', null], {
      'villain-a#0': 5, 'villain-b#0': 3, 'villain-c#0': 2,
    });
    withChoice(G, buildHereHoldThisChoice(G, '0', buildHereHoldThisTargets(G)));
    assert.equal(readAbsentSeatDefault(G), 0, 'the absent-seat default picks Villain A, which costs 5 and the seat has 3');
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), 2, 'Villain C: affordable and cheapest');

    const guarded = makeCityState(3, ['villain-a#0', 'villain-guard#0', null, null, null], {
      'villain-a#0': 1, 'villain-guard#0': 3,
    }, { 'villain-guard#0': ['guard'] });
    withChoice(guarded, buildHereHoldThisChoice(guarded, '0', buildHereHoldThisTargets(guarded)));
    assert.equal(choosePlayingSeatChoiceOption(guarded, '0'), 1,
      'the Guard, because getLegalMoves offers no fight against the cheaper Villain it blocks');
  });

  it('Here, Hold This: the escape-edge Villain first when the seat can fight it (D-24745)', () => {
    const G = makeCityState(5, ['villain-a#0', 'villain-b#0', null, null, 'villain-d#0'], {
      'villain-a#0': 2, 'villain-b#0': 3, 'villain-d#0': 4,
    });
    withChoice(G, buildHereHoldThisChoice(G, '0', buildHereHoldThisTargets(G)));
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), 2, 'Villain D on the escape edge, which the competent policy fights first');
  });

  it('Here, Hold This: nothing affordable picks the cheapest Villain that does not escape next (D-24745)', () => {
    const fullCity = makeCityState(0, ['villain-a#0', 'villain-b#0', 'villain-c#0', 'villain-d#0', 'villain-e#0'], {
      'villain-a#0': 6, 'villain-b#0': 6, 'villain-c#0': 3, 'villain-d#0': 7, 'villain-e#0': 1,
    });
    withChoice(fullCity, buildHereHoldThisChoice(fullCity, '0', buildHereHoldThisTargets(fullCity)));
    assert.equal(choosePlayingSeatChoiceOption(fullCity, '0'), 2,
      'Villain C; Villain E is cheaper but escapes on the next reveal, so every player would discard');

    const openCity = makeCityState(0, ['villain-a#0', null, 'villain-c#0', null, 'villain-e#0'], {
      'villain-a#0': 6, 'villain-c#0': 3, 'villain-e#0': 1,
    });
    withChoice(openCity, buildHereHoldThisChoice(openCity, '0', buildHereHoldThisTargets(openCity)));
    assert.equal(choosePlayingSeatChoiceOption(openCity, '0'), 2,
      'with an empty space the edge Villain does not escape next, so the cheapest, Villain E');
  });

  it('returns null when no choice is open, or the seat is not addressed or already answered', () => {
    const G = makeState({ '0': [], '1': ['core-hero-black-widow-diving-block#0'] }, {
      pendingDivingBlockWounds: [{ playerID: '1', woundCardId: WOUND_EXT_ID }],
    });
    assert.equal(choosePlayingSeatChoiceOption(G, '1'), null);
    openDivingBlockSeatChoiceIfNeeded(G, undefined);
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), null);
    G.pendingSeatChoice!.submissions['1'] = { optionIndex: 0 };
    assert.equal(choosePlayingSeatChoiceOption(G, '1'), null);
  });
});

/**
 * A one-seat main-stage state with a City and an attack pool, carrying the fields
 * getLegalMoves reads to enumerate fightVillain.
 *
 * @param attack - The seat's available attack.
 * @param city - The five City spaces.
 * @param fightCosts - Static fight cost per City Villain.
 * @param cardKeywords - Board keywords per card (Guard, Patrol).
 * @returns A partial LegendaryGameState.
 */
function makeCityState(
  attack: number,
  city: (string | null)[],
  fightCosts: Record<string, number>,
  cardKeywords: Record<string, string[]> = {},
): LegendaryGameState {
  const cardStats: Record<string, unknown> = {};
  for (const [villainCardId, fightCost] of Object.entries(fightCosts)) {
    cardStats[villainCardId] = makeCardStatEntry({ fightCost, fightCostBase: fightCost });
  }
  return makeState({ '0': [] }, {
    currentStage: 'main',
    villainRevealedThisTurn: true,
    turnEconomy: makeTurnEconomy({ attack }),
    cardStats,
    cardKeywords,
    hq: [null, null, null, null, null],
    city,
    piles: { bystanders: ['bystander#0'] },
    mastermind: { baseCardId: 'core-mastermind-loki', tacticsDeck: [], tacticsDefeated: [] },
  });
}

/**
 * Reads the open choice's absent-seat default.
 *
 * @param G - A state with an open seat choice.
 * @returns choice.defaultOptionIndex.
 */
function readAbsentSeatDefault(G: LegendaryGameState): number {
  return G.pendingSeatChoice!.defaultOptionIndex;
}

describe('WP-817 bot-ally pick for the Primus Escape discard (D-24750)', () => {
  it('T27: discards the lowest-cost eligible card (option 1, hero-cost3)', () => {
    const G = makeState(
      { '0': ['hero-cost4', 'hero-cost7', 'hero-cost3'], '1': ['hero-cost4'], '2': ['hero-cost2'] },
      {
        cardStats: {
          'hero-cost2': makeCardStatEntry({ cost: 2 }),
          'hero-cost3': makeCardStatEntry({ cost: 3 }),
          'hero-cost4': makeCardStatEntry({ cost: 4 }),
          'hero-cost7': makeCardStatEntry({ cost: 7 }),
        },
      },
    );
    withChoice(G, buildEscapeEffectCostDiscardChoice(G, { escapedCardId: 'primus-01', eligibleCosts: [2, 3, 5, 7] }));
    assert.deepEqual(
      G.pendingSeatChoice!.seatPrompts['0']!.options.map((option) => option.cardId),
      ['hero-cost7', 'hero-cost3'],
    );
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), 1);
  });
});

import { buildFallenIdolsDiscardChoice } from '../moves/seatChoiceTactics.js';

describe('WP-818 bot-ally pick for the Fallen Idols discard (D-24752)', () => {
  it('T15: discards the Wound, the same pick as the Monarch discard', () => {
    const G = makeState({ '0': [], '1': ['hero-cost-5#0', WOUND_EXT_ID] }, {
      cardStats: { 'hero-cost-5#0': { cost: 5 } },
    });
    withChoice(G, buildFallenIdolsDiscardChoice(G, ['1']));
    assert.equal(G.pendingSeatChoice?.kind, 'fallen-idols-discard');
    assert.equal(choosePlayingSeatChoiceOption(G, '1'), 1);
  });
});

// ---------------------------------------------------------------------------
// WP-821 / D-24754 — Arnim Zola's seat choices for a playing seat
// ---------------------------------------------------------------------------

import {
  buildComputerUploadedGeniusDiscardChoice,
  buildCrushPacifistResistanceChoice,
  buildDominateTheWeakChoice,
  CRUSH_PACIFIST_RESISTANCE_KO_KIND,
  CRUSH_PACIFIST_RESISTANCE_LAST_KO_KIND,
} from '../moves/seatChoiceTactics.js';

describe('WP-821 choosePlayingSeatChoiceOption — Arnim Zola kinds (D-24754)', () => {
  /** Card stats for the Zola bot cases (the Agent carries its real setup stats). */
  const ZOLA_BOT_STATS = {
    hero5: { attack: 3, cost: 5 },
    atk1Hero: { attack: 1, cost: 3 },
    'starting-shield-agent': { attack: 0, cost: 0 },
    hA: { attack: 1, cost: 3 },
    hB: { attack: 0, cost: 5 },
  };

  it('T18: Genius discards the Wound; Crush KOs a 0-cost Hero or declines; Dominate keeps its default', () => {
    const genius = makeState({ '0': [], '1': ['hero5', WOUND_EXT_ID] }, { cardStats: ZOLA_BOT_STATS });
    genius.pendingSeatChoice = buildComputerUploadedGeniusDiscardChoice(genius, ['1']);
    assert.equal(choosePlayingSeatChoiceOption(genius, '1'), 1, 'the Wound');

    const crush = makeState({ '0': ['atk1Hero', 'starting-shield-agent'] }, { cardStats: ZOLA_BOT_STATS });
    crush.pendingSeatChoice = buildCrushPacifistResistanceChoice(crush, '0', CRUSH_PACIFIST_RESISTANCE_KO_KIND);
    assert.equal(crush.pendingSeatChoice!.seatPrompts['0']!.options.length, 3);
    assert.equal(choosePlayingSeatChoiceOption(crush, '0'), 1, 'the 0-cost starter');

    const noStarter = makeState({ '0': ['atk1Hero'] }, { cardStats: ZOLA_BOT_STATS });
    noStarter.pendingSeatChoice = buildCrushPacifistResistanceChoice(noStarter, '0', CRUSH_PACIFIST_RESISTANCE_LAST_KO_KIND);
    assert.equal(choosePlayingSeatChoiceOption(noStarter, '0'), 1, '"KO nothing"');

    const dominate = makeState({ '0': [], '1': [] }, { cardStats: ZOLA_BOT_STATS, hq: ['hA', 'hB', null, null, null] });
    dominate.pendingSeatChoice = buildDominateTheWeakChoice(dominate, '0', [0, 1]);
    assert.equal(choosePlayingSeatChoiceOption(dominate, '0'), 0, 'you gain the highest-cost Hero');
  });
});

import { VILLAIN_EFFECT_TRAIT_DISCARD_KIND } from '../villainDeck/villainEscapeProcedure.js';

describe('WP-837 bot-ally pick for the every-player trait discard (D-24770)', () => {
  it('T23: discards the cheapest listed Hero, never the Wound option', () => {
    const G = makeState(
      { '0': ['hero-cost5', 'hero-cost3'] },
      {
        cardStats: {
          'hero-cost5': makeCardStatEntry({ cost: 5 }),
          'hero-cost3': makeCardStatEntry({ cost: 3 }),
        },
      },
    );
    withChoice(G, {
      kind: VILLAIN_EFFECT_TRAIT_DISCARD_KIND,
      addressedSeats: ['0'],
      seatPrompts: {
        '0': {
          options: [
            { label: 'hero-cost5', cardId: 'hero-cost5' },
            { label: 'hero-cost3', cardId: 'hero-cost3' },
            { label: 'Gain a Wound instead' },
          ],
        },
      },
      submissions: {},
      defaultOptionIndex: 0,
    } as PendingSeatChoice);
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), 1);
  });
});

describe('choosePlayingSeatChoiceOption — Revolutionary Anthem shuffle (WP-876 / D-24823)', () => {
  it('leaves the Villain Deck as it is', () => {
    const G = makeState({ '0': [] });
    // why: built by the engine's own park, so the option order is the order the live game shows.
    parkHeistShuffleChoice(G, undefined, '0', 'amwp/ant-army/revolutionary-anthem#0');
    assert.equal(G.pendingSeatChoice?.kind, 'heist-shuffle-villain-deck');
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), 1);
    assert.equal(G.pendingSeatChoice!.seatPrompts['0']!.options[1]!.label, 'Leave the Villain Deck as it is');
  });
});

// ---------------------------------------------------------------------------
// WP-882 / D-24833 — Zarathos playing-seat answers
// ---------------------------------------------------------------------------

import {
  buildZarathosDiscardDownChoice,
  ZARATHOS_CORRUPTED_SPIRIT_KIND,
  ZARATHOS_DEMONIC_ESSENCE_FIRST_KIND,
  ZARATHOS_DEMONIC_ESSENCE_LAST_KIND,
  ZARATHOS_ERUPTION_KIND,
  ZARATHOS_IMPRISON_KIND,
} from '../moves/seatChoiceTactics.js';
import type { SeatChoiceOption } from '../types.js';

/** Card stats for the Zarathos bot cases; the S.H.I.E.L.D. starters carry cost 0. */
const ZARATHOS_BOT_STATS = {
  cheapHero: { attack: 1, cost: 2 },
  pricyHero: { attack: 2, cost: 6 },
  covertHero: { attack: 1, cost: 3 },
  'starting-shield-agent': { attack: 0, cost: 0 },
  'starting-shield-trooper': { attack: 1, cost: 0 },
};

/** A single-seat choice of `kind` for `seat` with the given options and default. */
function zarathosChoice(
  kind: string,
  seat: string,
  options: SeatChoiceOption[],
  defaultOptionIndex: number,
): PendingSeatChoice {
  return { kind, addressedSeats: [seat], seatPrompts: { [seat]: { options } }, submissions: {}, defaultOptionIndex };
}

describe('WP-882 choosePlayingSeatChoiceOption — Zarathos kinds (D-24833)', () => {
  it('discard-down: drops the Wound first, else the cheapest card', () => {
    const withWound = makeState({ '0': [], '1': ['pricyHero', 'cheapHero', WOUND_EXT_ID, 'covertHero'] }, { cardStats: ZARATHOS_BOT_STATS });
    withWound.pendingSeatChoice = buildZarathosDiscardDownChoice(withWound, ['1']);
    const woundIndex = withWound.pendingSeatChoice!.seatPrompts['1']!.options.findIndex((option) => option.cardId === WOUND_EXT_ID);
    assert.equal(choosePlayingSeatChoiceOption(withWound, '1'), woundIndex);

    const noWound = makeState({ '0': [], '1': ['pricyHero', 'covertHero', 'cheapHero', 'pricyHero'] }, { cardStats: ZARATHOS_BOT_STATS });
    noWound.pendingSeatChoice = buildZarathosDiscardDownChoice(noWound, ['1']);
    const options = noWound.pendingSeatChoice!.seatPrompts['1']!.options;
    assert.equal(options[choosePlayingSeatChoiceOption(noWound, '1')!]!.cardId, 'cheapHero');
  });

  it('Demonic Essence (both kinds): a played 0-cost starter beats a hand 0-cost starter listed earlier', () => {
    for (const kind of [ZARATHOS_DEMONIC_ESSENCE_FIRST_KIND, ZARATHOS_DEMONIC_ESSENCE_LAST_KIND]) {
      const G = makeState({ '0': [] }, { cardStats: ZARATHOS_BOT_STATS });
      G.pendingSeatChoice = zarathosChoice(kind, '0', [
        { label: 'KO Cheap', cardId: 'cheapHero', sourceZone: 'hand' },
        { label: 'KO Agent', cardId: 'starting-shield-agent', sourceZone: 'hand' },
        { label: 'KO Pricy', cardId: 'pricyHero', sourceZone: 'inPlay' },
        { label: 'KO Trooper', cardId: 'starting-shield-trooper', sourceZone: 'inPlay' },
        { label: "Don't KO" },
      ], 4);
      assert.equal(choosePlayingSeatChoiceOption(G, '0'), 3, `${kind}: the played starter`);
    }
  });

  it('Demonic Essence: a hand starter when none is played, else the decline', () => {
    const handOnly = makeState({ '0': [] }, { cardStats: ZARATHOS_BOT_STATS });
    handOnly.pendingSeatChoice = zarathosChoice(ZARATHOS_DEMONIC_ESSENCE_FIRST_KIND, '0', [
      { label: 'KO Cheap', cardId: 'cheapHero', sourceZone: 'hand' },
      { label: 'KO Agent', cardId: 'starting-shield-agent', sourceZone: 'hand' },
      { label: 'KO Pricy', cardId: 'pricyHero', sourceZone: 'inPlay' },
      { label: "Don't KO" },
    ], 3);
    assert.equal(choosePlayingSeatChoiceOption(handOnly, '0'), 1, 'the hand starter');

    const noStarter = makeState({ '0': [] }, { cardStats: ZARATHOS_BOT_STATS });
    noStarter.pendingSeatChoice = zarathosChoice(ZARATHOS_DEMONIC_ESSENCE_LAST_KIND, '0', [
      { label: 'KO Cheap', cardId: 'cheapHero', sourceZone: 'hand' },
      { label: 'KO Pricy', cardId: 'pricyHero', sourceZone: 'inPlay' },
      { label: "Don't KO" },
    ], 2);
    assert.equal(choosePlayingSeatChoiceOption(noStarter, '0'), 2, 'the decline');
  });

  it('Corrupted Spirit: discards down when the cards owed are no more than the Wounds in hand, else keeps the default', () => {
    const options: SeatChoiceOption[] = [
      { label: 'Discard Covert Hero', cardId: 'covertHero' },
      { label: 'Discard down to 3 cards' },
    ];
    const cases: { hand: string[]; expected: number; why: string }[] = [
      { hand: ['covertHero', 'pricyHero', 'cheapHero', WOUND_EXT_ID], expected: 1, why: '4 cards, one Wound: owes 1' },
      { hand: ['covertHero', WOUND_EXT_ID, 'pricyHero', WOUND_EXT_ID, 'cheapHero'], expected: 1, why: '5 cards, two Wounds: owes 2' },
      { hand: ['covertHero', WOUND_EXT_ID, 'pricyHero', 'cheapHero', 'cheapHero'], expected: 0, why: '5 cards, one Wound: owes 2' },
      { hand: ['covertHero', 'pricyHero', 'cheapHero', 'cheapHero'], expected: 0, why: 'no Wound' },
    ];
    for (const { hand, expected, why } of cases) {
      const G = makeState({ '0': [], '1': hand }, { cardStats: ZARATHOS_BOT_STATS });
      G.pendingSeatChoice = zarathosChoice(ZARATHOS_CORRUPTED_SPIRIT_KIND, '1', options, 0);
      assert.equal(choosePlayingSeatChoiceOption(G, '1'), expected, why);
    }
  });

  it('Eruption and Imprison return their defaultOptionIndex', () => {
    const eruption = makeState({ '0': [], '1': ['covertHero', 'cheapHero'] }, { cardStats: ZARATHOS_BOT_STATS });
    eruption.pendingSeatChoice = zarathosChoice(ZARATHOS_ERUPTION_KIND, '1', [
      { label: 'Discard Covert Hero', cardId: 'covertHero' },
      { label: 'Gain a Wound' },
    ], 0);
    assert.equal(choosePlayingSeatChoiceOption(eruption, '1'), 0);

    const imprison = makeState({ '0': [] }, { cardStats: ZARATHOS_BOT_STATS });
    imprison.pendingSeatChoice = zarathosChoice(ZARATHOS_IMPRISON_KIND, '0', [
      { label: 'KO Villain A — draw 2', cardId: 'villainA' },
      { label: 'KO Villain B — draw 1', cardId: 'villainB' },
      { label: "Don't KO" },
    ], 2);
    assert.equal(choosePlayingSeatChoiceOption(imprison, '0'), 2);
  });
});

describe('WP-883 choosePlayingSeatChoiceOption — gain-wound-reward (D-24834)', () => {
  const HULK_SMASH = 'co2e/hulk/hulk-smash#0';
  const REWARD = { rewardType: 'attack' as const, magnitude: 5, sourceCardId: HULK_SMASH };

  it('gains when +5 reaches a City Villain it could not fight; declines when it opens nothing new', () => {
    const reachable = makeCityState(1, ['villain-a#0', null, null, null, null], { 'villain-a#0': 5 });
    withChoice(reachable, buildGainWoundRewardChoice('0', REWARD));
    assert.equal(readAbsentSeatDefault(reachable), 1, 'the absent-seat default declines');
    assert.equal(choosePlayingSeatChoiceOption(reachable, '0'), 0, '1 + 5 Attack reaches the 5-cost Villain');

    const outOfReach = makeCityState(1, ['villain-a#0', null, null, null, null], { 'villain-a#0': 9 });
    withChoice(outOfReach, buildGainWoundRewardChoice('0', REWARD));
    assert.equal(choosePlayingSeatChoiceOption(outOfReach, '0'), 1, '1 + 5 Attack still cannot fight a 9-cost Villain');

    const alreadyFightable = makeCityState(6, ['villain-a#0', null, null, null, null], { 'villain-a#0': 5 });
    withChoice(alreadyFightable, buildGainWoundRewardChoice('0', REWARD));
    assert.equal(choosePlayingSeatChoiceOption(alreadyFightable, '0'), 1, 'the fight is open without the Wound');
  });

  it('never writes G (purity)', () => {
    const G = makeCityState(1, ['villain-a#0', null, null, null, null], { 'villain-a#0': 5 });
    withChoice(G, buildGainWoundRewardChoice('0', REWARD));
    const before = structuredClone(G);
    choosePlayingSeatChoiceOption(G, '0');
    assert.deepEqual(G, before);
  });

  it('declines Diving Block on a tagged Wound and still reveals on an untagged one', () => {
    const tagged = makeState({ '0': ['core-hero-black-widow-diving-block#0'] }, {
      pendingDivingBlockWounds: [{ playerID: '0', woundCardId: WOUND_EXT_ID, gainWoundReward: REWARD }],
    });
    openDivingBlockSeatChoiceIfNeeded(tagged, undefined);
    assert.equal(choosePlayingSeatChoiceOption(tagged, '0'), tagged.pendingSeatChoice!.defaultOptionIndex);
    assert.equal(choosePlayingSeatChoiceOption(tagged, '0'), 1);

    const untagged = makeState({ '0': ['core-hero-black-widow-diving-block#0'] }, {
      pendingDivingBlockWounds: [{ playerID: '0', woundCardId: WOUND_EXT_ID }],
    });
    openDivingBlockSeatChoiceIfNeeded(untagged, undefined);
    assert.equal(choosePlayingSeatChoiceOption(untagged, '0'), 0);
  });

  it('one seat with Diving Block entries [untagged, tagged]: reveals in wave 1, declines in wave 2', () => {
    const G = makeState({ '0': ['core-hero-black-widow-diving-block#0'] }, {
      pendingDivingBlockWounds: [
        { playerID: '0', woundCardId: WOUND_EXT_ID },
        { playerID: '0', woundCardId: WOUND_EXT_ID, gainWoundReward: REWARD },
      ],
    });
    openDivingBlockSeatChoiceIfNeeded(G, undefined);
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), 0, 'wave 1 resolves the untagged front entry');
    // why: drain wave 1 the way the apply does (front entry for the seat), then reopen.
    G.pendingDivingBlockWounds!.shift();
    delete G.pendingSeatChoice;
    openDivingBlockSeatChoiceIfNeeded(G, undefined);
    assert.equal(choosePlayingSeatChoiceOption(G, '0'), 1, 'wave 2 resolves the tagged entry');
  });

  it('declines Flying Shield Block on a tagged Wound (a teammate\'s too) and still reveals on an untagged one', () => {
    const flyingShieldBlockChoice = (): PendingSeatChoice => ({
      kind: 'flying-shield-block',
      addressedSeats: ['1'],
      seatPrompts: { '1': { options: [{ label: 'Reveal' }, { label: 'Let Player 0 take the Wound' }] } },
      submissions: {},
      defaultOptionIndex: 1,
    });
    const tagged = makeState({ '0': [], '1': [] }, {
      pendingFlyingShieldBlockWounds: [
        { recipientID: '0', woundCardId: WOUND_EXT_ID, candidateSeats: ['1'], addressedSeat: '1', gainWoundReward: REWARD },
      ],
    });
    withChoice(tagged, flyingShieldBlockChoice());
    assert.equal(choosePlayingSeatChoiceOption(tagged, '1'), 1);

    const untagged = makeState({ '0': [], '1': [] }, {
      pendingFlyingShieldBlockWounds: [
        { recipientID: '0', woundCardId: WOUND_EXT_ID, candidateSeats: ['1'], addressedSeat: '1' },
      ],
    });
    withChoice(untagged, flyingShieldBlockChoice());
    assert.equal(choosePlayingSeatChoiceOption(untagged, '1'), 0);
  });
});
