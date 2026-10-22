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
