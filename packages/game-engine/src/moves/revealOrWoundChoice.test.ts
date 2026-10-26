/**
 * Reveal or gain a Wound: a player who can reveal chooses (WP-845 / D-24779).
 *
 * Drives the villain primitive `reveal-or-wound` (Sabretooth's Fight) and the hero keyword
 * `reveal-or-gain-wound-each` (co2e Crazed Rampage) through the real executors, then the opener
 * (`openRevealOrWoundSeatChoiceIfNeeded`) and the real `resolveSeatChoice` move, which dispatches
 * to `applyRevealOrWoundSeatChoice`. The live `turn.onMove` and reducer wiring is in game.test.ts;
 * the sim / PAR / runFixture mirrors are in simulation/seatChoiceDispatch.test.ts.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeVillainAbilities } from '../villain/villainEffects.execute.js';
import { executeSingleEffect } from '../hero/heroEffects.execute.js';
import {
  applyRevealOrWoundSeatChoice,
  openRevealOrWoundSeatChoiceIfNeeded,
  REVEAL_OR_WOUND_SEAT_CHOICE_KIND,
  VILLAIN_EFFECT_WOUND_OPTION_LABEL,
} from './revealOrWoundChoice.logic.js';
import { applySeatChoiceTimeoutDefault, resolveSeatChoice } from './seatChoice.resolve.js';
import { choosePlayingSeatChoiceOption } from '../simulation/ai.seatChoice.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { formatCardRef } from '../log/logDisplay.js';
import { composeWoundOutcomeClause } from '../events/notableEvents.compose.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';
import type { LegendaryGameState, PendingRevealOrWoundChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroEffectDescriptor } from '../rules/heroAbility.types.js';

const SABRETOOTH = 'core/brotherhood/sabretooth#0' as CardExtId;
const XMEN = 'core/wolverine/wolverine#0' as CardExtId;
const PLAIN = 'core/spider-man/spider-man#0' as CardExtId;
const RAMPAGE = 'co2e/hulk/crazed-rampage#0' as CardExtId;
const STRENGTH = 'test/strong/smash#0' as CardExtId;
const RANGED = 'test/zapper/zap#0' as CardExtId;
const DIVING_BLOCK = 'core/captain-america/diving-block#0' as CardExtId;

const SABRETOOTH_REF = formatCardRef({}, SABRETOOTH);
const RAMPAGE_REF = formatCardRef({}, RAMPAGE);

const RAMPAGE_EFFECT: HeroEffectDescriptor = {
  type: 'reveal-or-gain-wound-each',
  revealCriterion: { kind: 'hero-class', heroClass: 'strength' },
};

const HERO_CONTEXT = {
  ctx: { turn: 1 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * A two-or-more-seat state for Sabretooth's Fight (`reveal-or-wound:team:x-men`).
 *
 * @param hands - Each seat's hand.
 * @param wounds - The Wound supply.
 * @returns The game state (current player 0).
 */
function makeSabretoothState(hands: Record<string, CardExtId[]>, wounds: CardExtId[]): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const seat of Object.keys(hands)) {
    playerZones[seat] = makePlayerZones({ hand: hands[seat] });
  }
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    turnEconomy: makeTurnEconomy(),
    playerZones,
    piles: makeGlobalPiles({ wounds }),
    mastermind: makeMastermindState(),
    heroAbilityHooks: [],
    villainAbilityHooks: [{
      cardId: SABRETOOTH,
      timing: 'onFight',
      keywords: [],
      effects: [{ primitive: 'reveal-or-wound', requireKind: 'team', requireValue: 'x-men' }],
    }],
    cardTraits: {
      [XMEN]: { heroClass: 'covert', team: 'x-men' },
      [PLAIN]: { heroClass: 'covert', team: 'spider-friends' },
      [DIVING_BLOCK]: { heroClass: 'instinct', team: 'avengers' },
    },
    cardStats: {},
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

/**
 * A two-seat state for co2e Crazed Rampage, played by seat 0.
 *
 * @param hands - Each seat's hand.
 * @param wounds - The Wound supply.
 * @returns The game state (Crazed Rampage in seat 0's play area).
 */
function makeRampageState(hands: Record<string, CardExtId[]>, wounds: CardExtId[]): LegendaryGameState {
  const G = makeSabretoothState(hands, wounds);
  G.playerZones['0']!.inPlay = [RAMPAGE];
  G.villainAbilityHooks = [];
  G.cardTraits = {
    [RAMPAGE]: { team: 'avengers', heroClass: 'strength' },
    [STRENGTH]: { team: 'avengers', heroClass: 'strength' },
    [RANGED]: { team: 'avengers', heroClass: 'ranged' },
  } as unknown as LegendaryGameState['cardTraits'];
  return G;
}

/** Fights Sabretooth for current player 0. */
function fightSabretooth(G: LegendaryGameState): void {
  executeVillainAbilities(G, { currentPlayer: '0' }, SABRETOOTH, 'onFight');
}

/** Plays Crazed Rampage for player 0. */
function playRampage(G: LegendaryGameState): void {
  executeSingleEffect(G, HERO_CONTEXT, '0', RAMPAGE, RAMPAGE_EFFECT);
}

/**
 * Submits one seat's answer through the real resolveSeatChoice move.
 *
 * @param G - The game state.
 * @param seat - The answering seat.
 * @param optionIndex - 0 Reveal, 1 Gain a Wound.
 */
function answer(G: LegendaryGameState, seat: string, optionIndex: number): void {
  resolveSeatChoice(makeMockMoveContext(G, { playerID: seat, numPlayers: 2 }), { optionIndex });
}

/** The strikeBlocked events, as `playerId:threatKind`. */
function strikeBlockedEvents(G: LegendaryGameState): string[] {
  const events: string[] = [];
  for (const event of G.notableEvents) {
    if (event.type === 'strikeBlocked') {
      events.push(`${event.playerId}:${event.threatKind}`);
    }
  }
  return events;
}

describe('reveal-or-wound villain enqueue (WP-845 AC-1)', () => {
  it('a cannot-reveal seat is wounded inline and the revealer is queued, with no strikeBlocked yet', () => {
    const G = makeSabretoothState({ '0': [XMEN], '1': [PLAIN] }, ['wound-0', 'wound-1'] as CardExtId[]);
    fightSabretooth(G);

    assert.deepStrictEqual(G.playerZones['1']!.discard, ['wound-0'], 'seat 1 gained the Wound inline');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'seat 0 is not wounded at effect time');
    assert.deepStrictEqual(G.pendingRevealOrWoundChoices, [{
      sourceCardId: SABRETOOTH,
      currentPlayerID: '0',
      revealOptionLabel: 'Reveal a matching X-Men Hero',
      revealingSeats: ['0'],
      strikeBlockThreatKind: 'fight',
    }]);
    assert.deepStrictEqual(strikeBlockedEvents(G), [], 'no strikeBlocked until the Reveal lands');
    assert.deepStrictEqual(G.messages.map((entry) => [entry.text, entry.outcome]), [
      ['Fight effect: 1 player(s) had no X-Men Hero and gained a Wound (Player 1).', 'applied'],
      ['Fight effect: Player 0 can reveal a matching X-Men Hero and will choose whether to reveal it or gain a Wound.', 'neutral'],
    ]);
  });

  it('the revealing seats are stored ascending whatever order they were given in', () => {
    const G = makeSabretoothState({ '0': [XMEN], '1': [XMEN], '2': [XMEN] }, ['wound-0'] as CardExtId[]);
    fightSabretooth(G);
    assert.deepStrictEqual(G.pendingRevealOrWoundChoices?.[0]?.revealingSeats, ['0', '1', '2']);
    assert.deepStrictEqual(G.messages.map((entry) => entry.text), [
      'Fight effect: Player 0, Player 1, Player 2 can reveal a matching X-Men Hero and will choose whether to reveal it or gain a Wound.',
    ]);
  });
});

describe('reveal-or-wound opener (WP-845 AC-2 / AC-7)', () => {
  it('AC-2: parks one reveal-or-wound choice for the queued seats and leaves the entry at the front', () => {
    const G = makeSabretoothState({ '0': [XMEN], '1': [PLAIN] }, ['wound-0', 'wound-1'] as CardExtId[]);
    fightSabretooth(G);
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');

    assert.deepStrictEqual(G.pendingSeatChoice, {
      kind: REVEAL_OR_WOUND_SEAT_CHOICE_KIND,
      addressedSeats: ['0'],
      seatPrompts: { '0': { options: [{ label: 'Reveal a matching X-Men Hero' }, { label: 'Gain a Wound instead' }] } },
      submissions: {},
      defaultOptionIndex: 0,
    });
    assert.equal(VILLAIN_EFFECT_WOUND_OPTION_LABEL, 'Gain a Wound instead');
    assert.equal(G.pendingRevealOrWoundChoices?.length, 1, 'the entry stays queued while its choice is open');

    const parked = G.pendingSeatChoice;
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    assert.equal(G.pendingSeatChoice, parked, 'a second call does nothing while the choice is open');
    assert.equal(G.pendingRevealOrWoundChoices?.length, 1);
  });

  it('AC-7: waits while pendingHeroChoice is set or the match is decided', () => {
    const G = makeSabretoothState({ '0': [XMEN] }, ['wound-0'] as CardExtId[]);
    fightSabretooth(G);
    G.pendingHeroChoice = { sentinel: true } as unknown as LegendaryGameState['pendingHeroChoice'];
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    assert.equal(G.pendingSeatChoice, undefined, 'no park under an open hero choice');
    delete G.pendingHeroChoice;

    G.counters = { [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1 };
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    assert.equal(G.pendingSeatChoice, undefined, 'no park once the match is decided');
    assert.equal(G.pendingRevealOrWoundChoices?.length, 1, 'the entry stays owed');
  });

  it('AC-7: two entries queued in one move open one at a time, FIFO', () => {
    const G = makeSabretoothState({ '0': [XMEN], '1': [XMEN] }, ['wound-0', 'wound-1'] as CardExtId[]);
    fightSabretooth(G);
    G.playerZones['1']!.hand = [PLAIN];
    fightSabretooth(G);
    assert.deepStrictEqual(G.pendingRevealOrWoundChoices?.map((entry) => entry.revealingSeats), [['0', '1'], ['0']]);

    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    assert.deepStrictEqual(G.pendingSeatChoice?.addressedSeats, ['0', '1'], 'the first entry opens first');
    answer(G, '0', 0);
    answer(G, '1', 0);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.deepStrictEqual(G.pendingRevealOrWoundChoices?.map((entry) => entry.revealingSeats), [['0']]);

    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    assert.deepStrictEqual(G.pendingSeatChoice?.addressedSeats, ['0'], 'then the second');
  });

  it('AC-7: an entry with no revealing seats is dropped with a blocked line and parks nothing', () => {
    const G = makeSabretoothState({ '0': [PLAIN] }, ['wound-0'] as CardExtId[]);
    G.pendingRevealOrWoundChoices = [{
      sourceCardId: SABRETOOTH, currentPlayerID: '0', revealOptionLabel: 'Reveal a matching X-Men Hero',
      revealingSeats: [], strikeBlockThreatKind: 'fight',
    }];
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(Object.hasOwn(G, 'pendingRevealOrWoundChoices'), false, 'the drained key is deleted');
    assert.equal(G.messages.at(-1)?.outcome, 'blocked');
  });

  it('an entry naming a seat with no zones is dropped the same way', () => {
    const G = makeSabretoothState({ '0': [PLAIN] }, ['wound-0'] as CardExtId[]);
    G.pendingRevealOrWoundChoices = [{
      sourceCardId: SABRETOOTH, currentPlayerID: '0', revealOptionLabel: 'Reveal a matching X-Men Hero',
      revealingSeats: ['7'], strikeBlockThreatKind: 'fight',
    }];
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(Object.hasOwn(G, 'pendingRevealOrWoundChoices'), false);
  });
});

describe('reveal-or-wound apply (WP-845 AC-3)', () => {
  it('Gain a Wound: the seat gains a Wound, woundsDrawn moves for the current player, and the entry drains', () => {
    const G = makeSabretoothState({ '0': [XMEN], '1': [PLAIN] }, ['wound-0', 'wound-1'] as CardExtId[]);
    fightSabretooth(G);
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    answer(G, '0', 1);

    assert.deepStrictEqual(G.playerZones['0']!.discard, ['wound-1'], 'seat 0 took the Wound');
    assert.equal(G.turnEconomy.woundsDrawn, 1, 'seat 0 is the current player');
    assert.deepStrictEqual(strikeBlockedEvents(G), [], 'a decline is not a block');
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(Object.hasOwn(G, 'pendingRevealOrWoundChoices'), false, 'the empty queue key is deleted');
    const last = G.messages.at(-1)!;
    assert.equal(last.text, `Reveal or gain a Wound (${SABRETOOTH_REF}): Player 0 chose to gain a Wound.`);
    assert.equal(last.outcome, 'applied');
  });

  it('Reveal: no Wound, one strikeBlocked with the entry threat kind, and the entry drains', () => {
    const G = makeSabretoothState({ '0': [XMEN], '1': [PLAIN] }, ['wound-0', 'wound-1'] as CardExtId[]);
    fightSabretooth(G);
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    answer(G, '0', 0);

    assert.deepStrictEqual(G.playerZones['0']!.discard, []);
    assert.equal(G.turnEconomy.woundsDrawn, 0, 'only seat 1 (not current) was wounded');
    assert.deepStrictEqual(strikeBlockedEvents(G), ['0:fight']);
    assert.equal(Object.hasOwn(G, 'pendingRevealOrWoundChoices'), false);
    const last = G.messages.at(-1)!;
    assert.equal(last.text, `Reveal or gain a Wound (${SABRETOOTH_REF}): Player 0 revealed.`);
    assert.equal(last.outcome, 'blocked');
  });

  it('a mixed answer names both halves, applied in ascending seat order', () => {
    const G = makeSabretoothState({ '0': [XMEN], '1': [XMEN], '2': [XMEN] }, ['wound-0', 'wound-1'] as CardExtId[]);
    fightSabretooth(G);
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    answer(G, '2', 1);
    answer(G, '0', 0);
    answer(G, '1', 1);

    assert.deepStrictEqual(G.playerZones['1']!.discard, ['wound-0'], 'seat 1 applies before seat 2');
    assert.deepStrictEqual(G.playerZones['2']!.discard, ['wound-1']);
    assert.equal(G.turnEconomy.woundsDrawn, 0, 'neither decliner is the current player');
    assert.deepStrictEqual(strikeBlockedEvents(G), ['0:fight']);
    assert.equal(
      G.messages.at(-1)!.text,
      `Reveal or gain a Wound (${SABRETOOTH_REF}): Player 0 revealed; Player 1, Player 2 chose to gain a Wound.`,
    );
  });

  it('a decliner who finds the supply empty is named (D-24686)', () => {
    const G = makeSabretoothState({ '0': [XMEN], '1': [XMEN] }, ['wound-0'] as CardExtId[]);
    fightSabretooth(G);
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    answer(G, '0', 1);
    answer(G, '1', 1);

    assert.deepStrictEqual(G.playerZones['0']!.discard, ['wound-0']);
    assert.deepStrictEqual(G.playerZones['1']!.discard, []);
    assert.equal(
      G.messages.at(-1)!.text,
      `Reveal or gain a Wound (${SABRETOOTH_REF}): Player 0 chose to gain a Wound; the Wound supply ran out before Player 1.`,
    );
  });

  it('a decliner holding Diving Block gets the reveal window and the D-24673 wording', () => {
    const G = makeSabretoothState({ '0': [XMEN], '1': [XMEN, DIVING_BLOCK] }, ['wound-0', 'wound-1'] as CardExtId[]);
    G.heroAbilityHooks = [
      { cardId: DIVING_BLOCK, timing: 'onPlay', keywords: ['diving-block'] },
    ] as unknown as LegendaryGameState['heroAbilityHooks'];
    fightSabretooth(G);
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    answer(G, '0', 1);
    answer(G, '1', 1);

    assert.deepStrictEqual(G.pendingDivingBlockWounds, [{ playerID: '1', woundCardId: 'wound-1' }]);
    assert.equal(
      G.messages.at(-1)!.text,
      `Reveal or gain a Wound (${SABRETOOTH_REF}): ${composeWoundOutcomeClause(['0'], ['1'])}.`,
    );
  });

  it('a JSON round-trip between park and resolve still applies and shifts (element-wise seat equality)', () => {
    const parkedState = makeSabretoothState({ '0': [XMEN], '1': [XMEN] }, ['wound-0', 'wound-1'] as CardExtId[]);
    fightSabretooth(parkedState);
    openRevealOrWoundSeatChoiceIfNeeded(parkedState, undefined, '0');
    const G = JSON.parse(JSON.stringify(parkedState)) as LegendaryGameState;
    answer(G, '0', 0);
    answer(G, '1', 1);

    assert.deepStrictEqual(G.playerZones['1']!.discard, ['wound-0']);
    assert.deepStrictEqual(strikeBlockedEvents(G), ['0:fight']);
    assert.equal(Object.hasOwn(G, 'pendingRevealOrWoundChoices'), false);
  });

  it('a choice that does not answer the front entry applies nothing, stays owed, and re-parks once', () => {
    const G = makeSabretoothState({ '0': [XMEN], '1': [XMEN] }, ['wound-0', 'wound-1'] as CardExtId[]);
    fightSabretooth(G);
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    // why: force a mismatch — the parked choice addresses seat 0 only, the entry seats 0 and 1.
    G.pendingSeatChoice!.addressedSeats = ['0'];
    answer(G, '0', 1);

    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'nothing applied');
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(G.pendingRevealOrWoundChoices?.length, 1, 'the entry is still owed');
    assert.equal(G.messages.at(-1)!.outcome, 'blocked');

    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    assert.deepStrictEqual(G.pendingSeatChoice?.addressedSeats, ['0', '1'], 're-parked from the entry');
    answer(G, '0', 0);
    answer(G, '1', 1);
    assert.deepStrictEqual(G.playerZones['1']!.discard, ['wound-0']);
    assert.equal(Object.hasOwn(G, 'pendingRevealOrWoundChoices'), false, 'the next resolve drains it');
  });

  it('an answer with no owed entry is logged and applies nothing', () => {
    const G = makeSabretoothState({ '0': [XMEN] }, ['wound-0'] as CardExtId[]);
    applyRevealOrWoundSeatChoice(G, {
      kind: REVEAL_OR_WOUND_SEAT_CHOICE_KIND, addressedSeats: ['0'],
      seatPrompts: { '0': { options: [{ label: 'Reveal' }, { label: 'Gain a Wound instead' }] } },
      submissions: { '0': { optionIndex: 1 } }, defaultOptionIndex: 0,
    });
    assert.deepStrictEqual(G.playerZones['0']!.discard, []);
    assert.equal(G.messages.at(-1)!.outcome, 'blocked');
  });
});

describe('reveal-or-gain-wound-each hero enqueue (WP-845 AC-4)', () => {
  it('a non-playing seat holding a Strength Hero is queued; the hero entry omits strikeBlockThreatKind', () => {
    const G = makeRampageState({ '0': [RANGED], '1': [STRENGTH] }, ['wound-0', 'wound-1'] as CardExtId[]);
    playRampage(G);

    assert.deepStrictEqual(G.playerZones['0']!.discard, ['wound-0'], 'the playing seat has no other Strength Hero');
    const entry = G.pendingRevealOrWoundChoices?.[0] as PendingRevealOrWoundChoice;
    assert.deepStrictEqual(entry, {
      sourceCardId: RAMPAGE,
      currentPlayerID: '0',
      revealOptionLabel: 'Reveal another Strength Hero',
      revealingSeats: ['1'],
    });
    assert.ok(!('strikeBlockThreatKind' in entry), 'a hero entry omits the key entirely');
    assert.deepStrictEqual(G.messages.map((message) => [message.text, message.outcome, message.card]), [
      [`Each player without another Strength Hero gained a Wound (${RAMPAGE_REF}): Player 0.`, 'applied', RAMPAGE],
      [`Player 1 can reveal another Strength Hero and will choose whether to reveal it or gain a Wound (${RAMPAGE_REF}).`, 'neutral', RAMPAGE],
    ]);
  });

  it('a decline by the non-playing seat does not move the playing seat woundsDrawn, and a hero Reveal pushes no strikeBlocked', () => {
    const G = makeRampageState({ '0': [STRENGTH], '1': [STRENGTH] }, ['wound-0'] as CardExtId[]);
    playRampage(G);
    assert.deepStrictEqual(G.pendingRevealOrWoundChoices?.[0]?.revealingSeats, ['0', '1'], 'the playing seat "another" scope is unchanged');
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    answer(G, '0', 0);
    answer(G, '1', 1);

    assert.deepStrictEqual(G.playerZones['1']!.discard, ['wound-0']);
    assert.equal(G.turnEconomy.woundsDrawn, 0);
    assert.deepStrictEqual(strikeBlockedEvents(G), []);
    const last = G.messages.at(-1)!;
    assert.equal(last.text, `Reveal or gain a Wound (${RAMPAGE_REF}): Player 0 revealed; Player 1 chose to gain a Wound.`);
    assert.equal(last.card, RAMPAGE, 'WP-438 attribution on the hero site');
  });
});

// why: AC-5 — the expected values below were captured on the UNMODIFIED baseline (origin/main
// 9ef66944) by running these exact inputs through the pre-WP-845 executors, before any source
// change. They are literals, never recomputed with the new code.
describe('no revealer is byte-identical to the baseline (WP-845 AC-5)', () => {
  it('villain: Sabretooth with no X-Men Hero anywhere', () => {
    const G = {
      messages: [],
      notableEvents: [],
      turnEconomy: makeTurnEconomy(),
      playerZones: { '0': makePlayerZones({ hand: [PLAIN] }), '1': makePlayerZones({ hand: [PLAIN] }) },
      piles: makeGlobalPiles({ wounds: ['wound-0', 'wound-1', 'wound-2'] as CardExtId[] }),
      mastermind: makeMastermindState(),
      heroAbilityHooks: [],
      villainAbilityHooks: [{
        cardId: SABRETOOTH, timing: 'onFight', keywords: [],
        effects: [{ primitive: 'reveal-or-wound', requireKind: 'team', requireValue: 'x-men' }],
      }],
      cardTraits: { [PLAIN]: { heroClass: 'covert', team: 'spider-friends' } },
      cardStats: {},
      cardDisplayData: {},
    } as unknown as LegendaryGameState;
    fightSabretooth(G);

    assert.equal(Object.hasOwn(G, 'pendingRevealOrWoundChoices'), false);
    assert.deepStrictEqual(G.messages.map((entry) => ({ text: entry.text, outcome: entry.outcome, card: entry.card })), [
      { text: 'Fight effect: 2 player(s) had no X-Men Hero and gained a Wound (Player 0, Player 1).', outcome: 'applied', card: undefined },
    ]);
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['wound-0']);
    assert.deepStrictEqual(G.playerZones['1']!.discard, ['wound-1']);
    assert.deepStrictEqual(G.notableEvents, []);
    assert.equal(G.turnEconomy.woundsDrawn, 1);
    assert.deepStrictEqual(G.piles.wounds, ['wound-2']);
  });

  it('hero: Crazed Rampage with no other Strength Hero anywhere', () => {
    const G = {
      messages: [],
      notableEvents: [],
      turnEconomy: makeTurnEconomy(),
      playerZones: {
        '0': makePlayerZones({ hand: [RANGED], inPlay: [RAMPAGE] }),
        '1': makePlayerZones({ hand: [RANGED] }),
      },
      piles: makeGlobalPiles({ wounds: ['wound-0', 'wound-1', 'wound-2'] as CardExtId[] }),
      mastermind: makeMastermindState(),
      heroAbilityHooks: [],
      cardTraits: {
        [RAMPAGE]: { team: 'avengers', heroClass: 'strength' },
        [RANGED]: { team: 'avengers', heroClass: 'ranged' },
      },
      cardStats: {},
      cardDisplayData: {},
    } as unknown as LegendaryGameState;
    playRampage(G);

    assert.equal(Object.hasOwn(G, 'pendingRevealOrWoundChoices'), false);
    assert.deepStrictEqual(G.messages.map((entry) => ({ text: entry.text, outcome: entry.outcome, card: entry.card })), [
      {
        text: 'Each player without another Strength Hero gained a Wound (co2e/hulk/crazed-rampage#0 (co2e/hulk/crazed-rampage#0)): Player 0, Player 1.',
        outcome: 'applied',
        card: 'co2e/hulk/crazed-rampage#0',
      },
    ]);
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['wound-0']);
    assert.deepStrictEqual(G.playerZones['1']!.discard, ['wound-1']);
    assert.deepStrictEqual(G.notableEvents, []);
    assert.equal(G.turnEconomy.woundsDrawn, 1);
    assert.deepStrictEqual(G.piles.wounds, ['wound-2']);
  });
});

describe('empty Wound supply at open (WP-845 AC-6)', () => {
  it('no choice parks; every seat reveals, each villain revealer gets a strikeBlocked, and the entry drains', () => {
    const G = makeSabretoothState({ '0': [XMEN], '1': [XMEN] }, [] as CardExtId[]);
    fightSabretooth(G);
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');

    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(Object.hasOwn(G, 'pendingRevealOrWoundChoices'), false);
    assert.deepStrictEqual(strikeBlockedEvents(G), ['0:fight', '1:fight']);
    const last = G.messages.at(-1)!;
    assert.equal(last.text, `Reveal or gain a Wound (${SABRETOOTH_REF}): the Wound supply is empty, so Player 0, Player 1 revealed.`);
    assert.equal(last.outcome, 'blocked');
  });
});

describe('timeout and bot answers (WP-845 AC-9)', () => {
  it('the timeout default resolves an absent seat as Reveal, and the bot answers 0', () => {
    const G = makeSabretoothState({ '0': [XMEN], '1': [XMEN] }, ['wound-0'] as CardExtId[]);
    fightSabretooth(G);
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    assert.equal(choosePlayingSeatChoiceOption(G, '1'), 0, 'the playing-seat bot answers Reveal');
    answer(G, '0', 1);
    applySeatChoiceTimeoutDefault(G, ['1']);

    assert.deepStrictEqual(G.playerZones['0']!.discard, ['wound-0']);
    assert.deepStrictEqual(G.playerZones['1']!.discard, [], 'the absent seat revealed');
    assert.deepStrictEqual(strikeBlockedEvents(G), ['1:fight']);
    assert.equal(Object.hasOwn(G, 'pendingRevealOrWoundChoices'), false);
  });
});
