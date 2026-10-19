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
import { buildRandomActsWoundChoice, buildPassLeftChoice } from '../moves/seatChoiceCards.js';
import {
  buildMonarchsDecreeModeChoice,
  buildMonarchsDiscardChoice,
  buildVanishingIllusionsChoice,
} from '../moves/seatChoiceTactics.js';
import { buildEscapeBystanderDiscardChoice } from '../villainDeck/villainEscapeProcedure.js';
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

    const passLeft = makeState({ '0': ['a#0', 'b#0'], '1': ['c#0'] });
    withChoice(passLeft, buildPassLeftChoice(passLeft, ['0', '1']));
    assert.equal(choosePlayingSeatChoiceOption(passLeft, '0'), 0);
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
 * Reads the open choice's absent-seat default.
 *
 * @param G - A state with an open seat choice.
 * @returns choice.defaultOptionIndex.
 */
function readAbsentSeatDefault(G: LegendaryGameState): number {
  return G.pendingSeatChoice!.defaultOptionIndex;
}
