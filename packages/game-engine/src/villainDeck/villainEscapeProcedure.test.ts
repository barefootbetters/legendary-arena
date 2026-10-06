/**
 * Tests for the rulebook Villain-escape procedure, steps 1–2 (WP-793 / D-24656).
 *
 * Rules v23 L556–L570: an escape KOs an HQ Hero costing 6 or less (the current player
 * chooses; 0 eligible = a logged no-op, 1 = automatic, 2+ = a seat choice; the HQ
 * refills), then, if it carried Bystanders, every player with a hand card discards one,
 * then its Escape effect resolves. Steps 1–2 are recorded on G.pendingEscapeProcedures
 * by resolveVillainEscape and opened after the move by
 * openEscapeProcedureSeatChoiceIfNeeded; step 3 stays inside the move.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState, MatchConfiguration, PendingSeatChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { RevealContext } from './villainDeck.reveal.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { makeCardRegistryReader, makeCardStatEntry, makePlayerZones } from '../test/fixtureBuilders.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { SCHEME_TWIST_RESOLVERS } from '../rules/schemeTwistResolvers.js';
import { revealVillainCard } from './villainDeck.reveal.js';
import { enterCityIgnoringAmbush } from './villainDeck.enterCity.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import {
  ESCAPE_BYSTANDER_DISCARD_KIND,
  ESCAPE_HQ_KO_KIND,
  ESCAPE_HQ_KO_MAX_COST,
  enqueueEscapeProcedure,
  openEscapeProcedureSeatChoiceIfNeeded,
} from './villainEscapeProcedure.js';

/** Empty registry so the fixture does not depend on real card data. */
const EMPTY_REGISTRY: CardRegistryReader = { ...makeCardRegistryReader(),
  listCards: () => [],
};

const ESCAPER = 'test-villain-escaper-00' as CardExtId;
const ENTERING = 'test-villain-entering-00' as CardExtId;
const BYSTANDER_A = 'test-bystander-a' as CardExtId;
const BYSTANDER_B = 'test-bystander-b' as CardExtId;
const UNENDING_ENERGY = 'core/cyclops' as CardExtId;
const WOUND_LINE = 'gained a wound from villain escape';

/** One recorded setActivePlayers call (the stage-ride admission). */
interface RecordedRide {
  value: Record<string, { stage: string; moveLimit: number }>;
  revert?: boolean;
}

/**
 * Builds the match config every fixture here uses.
 *
 * @param schemeId - The scheme (a Hero-Deck scheme for the depletion case).
 * @returns A 9-field MatchConfiguration.
 */
function buildConfig(schemeId = 'test-scheme-001'): MatchConfiguration {
  return {
    schemeId,
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 0,
  };
}

/**
 * Builds a complete game state with the given seats' hands, an empty HQ, an empty
 * Hero Deck and a two-Wound supply.
 *
 * @param hands - Each seat's hand, keyed by seat id.
 * @returns The game state.
 */
function buildState(hands: Record<string, CardExtId[]>): LegendaryGameState {
  const seatCount = Object.keys(hands).length;
  const gameState = buildInitialGameState(buildConfig(), EMPTY_REGISTRY, makeMockCtx({ numPlayers: seatCount }));
  gameState.playerZones = {};
  for (const seat of Object.keys(hands)) {
    gameState.playerZones[seat] = {
      ...makePlayerZones(), deck: [], hand: [...hands[seat]!], discard: [], inPlay: [], victory: [],
    };
  }
  gameState.piles.wounds = ['test-wound-00', 'test-wound-01'] as CardExtId[];
  gameState.hq = [null, null, null, null, null];
  gameState.heroDeck = [];
  return gameState;
}

/**
 * Places Heroes in the HQ with the given costs (null leaves a slot empty).
 *
 * @param gameState - The game state, mutated.
 * @param costs - One entry per HQ slot: a cost, or null for an empty slot.
 */
function setHq(gameState: LegendaryGameState, costs: (number | null)[]): void {
  for (let slotIndex = 0; slotIndex < costs.length; slotIndex++) {
    const cost = costs[slotIndex];
    if (cost === null || cost === undefined) {
      gameState.hq[slotIndex] = null;
      continue;
    }
    const heroId = `test-hero-slot${slotIndex}-cost${cost}` as CardExtId;
    gameState.hq[slotIndex] = heroId;
    gameState.cardStats[heroId] = makeCardStatEntry({ cost });
  }
}

/**
 * Fills the City so the next entry pushes `ESCAPER` (space 4) out.
 *
 * @param gameState - The game state, mutated.
 * @param bystanders - Bystanders the escaper has captured.
 */
function fillCity(gameState: LegendaryGameState, bystanders: CardExtId[]): void {
  gameState.city = [
    'test-c0' as CardExtId,
    'test-c1' as CardExtId,
    'test-c2' as CardExtId,
    'test-c3' as CardExtId,
    ESCAPER,
  ];
  gameState.villainDeckCardTypes[ESCAPER] = 'villain';
  if (bystanders.length > 0) {
    gameState.attachedBystanders = { [ESCAPER]: [...bystanders] };
  }
}

/** The reveal context the direct escape paths take. */
function buildRevealContext(): RevealContext {
  return { random: makeMockCtx().random, ctx: { currentPlayer: '0' } };
}

/**
 * A recording events surface: every setActivePlayers call is pushed to `rides`.
 *
 * @param rides - The sink for recorded stage rides.
 * @returns The events object the opener accepts.
 */
function recordingEvents(rides: RecordedRide[]): { setActivePlayers: (arg: RecordedRide) => void } {
  return {
    setActivePlayers: (arg: RecordedRide) => {
      rides.push(arg);
    },
  };
}

/**
 * Submits `optionIndex` for `seat` through the real resolveSeatChoice move.
 *
 * @param gameState - The game state.
 * @param seat - The submitting seat.
 * @param optionIndex - The option the seat picks.
 */
function submit(gameState: LegendaryGameState, seat: string, optionIndex: number): void {
  const moveContext = makeMockMoveContext(gameState, { playerID: seat, numPlayers: 2 });
  resolveSeatChoice(moveContext, { optionIndex });
}

/**
 * Whether any log line contains `fragment`.
 *
 * @param gameState - The game state.
 * @param fragment - The substring to look for.
 * @returns True when a matching line exists.
 */
function hasLog(gameState: LegendaryGameState, fragment: string): boolean {
  return gameState.messages.some((entry) => entry.text.includes(fragment));
}

/**
 * The open seat choice, asserted present.
 *
 * @param gameState - The game state.
 * @returns The open seat choice.
 */
function openChoice(gameState: LegendaryGameState): PendingSeatChoice {
  const choice = gameState.pendingSeatChoice;
  assert.ok(choice, 'a seat choice must be open');
  return choice;
}

describe('escape procedure step 1 — the HQ KO (WP-793 / D-24656)', () => {
  it('0 eligible: a cost-7 Hero is never offered or KO\'d; only the no-op line is logged', () => {
    const gameState = buildState({ '0': [] });
    setHq(gameState, [7, null, null, null, 8]);
    enqueueEscapeProcedure(gameState, ESCAPER, '0', false);

    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');

    assert.equal(ESCAPE_HQ_KO_MAX_COST, 6);
    assert.equal(gameState.pendingSeatChoice, undefined, 'no choice opens with 0 eligible Heroes');
    assert.deepEqual(gameState.ko, [], 'nothing is KO\'d');
    assert.ok(hasLog(gameState, 'KO\'d nothing — no Hero in the HQ costs 6 or less.'));
    assert.equal('pendingEscapeProcedures' in gameState, false, 'the drained queue key is removed');
  });

  it('1 eligible: KO\'d automatically and the slot refills from heroDeck[0]', () => {
    const gameState = buildState({ '0': [] });
    setHq(gameState, [7, 6, null, null, null]);
    gameState.heroDeck = ['test-refill-a', 'test-refill-b'] as CardExtId[];
    enqueueEscapeProcedure(gameState, ESCAPER, '0', false);

    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');

    assert.equal(gameState.pendingSeatChoice, undefined, 'one eligible Hero needs no prompt');
    assert.deepEqual(gameState.ko, ['test-hero-slot1-cost6']);
    assert.equal(gameState.hq[1], 'test-refill-a', 'the slot refills from the Hero Deck front');
    assert.deepEqual(gameState.heroDeck, ['test-refill-b']);
    assert.ok(hasLog(gameState, 'KO\'d test-hero-slot1-cost6 (test-hero-slot1-cost6) from the HQ.'));
    assert.equal('pendingEscapeProcedures' in gameState, false);
  });

  it('an empty Hero Deck leaves the KO\'d slot null; a Haunted Hero is KO\'d and its haunter stays', () => {
    const gameState = buildState({ '0': [] });
    setHq(gameState, [null, null, 4, null, null]);
    gameState.hqHaunters = [null, null, { kind: 'villain', cardId: 'test-haunter' as CardExtId }, null, null];
    enqueueEscapeProcedure(gameState, ESCAPER, '0', false);

    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');

    assert.deepEqual(gameState.ko, ['test-hero-slot2-cost4'], 'the Haunted Hero costing 6 or less is KO\'d');
    assert.equal(gameState.hq[2], null, 'an empty Hero Deck leaves the slot null (D-13503)');
    assert.deepEqual(gameState.hqHaunters[2], { kind: 'villain', cardId: 'test-haunter' }, 'the haunter stays in the space');
  });

  it('2+ eligible: a one-seat choice for the chooser, sorted cost then slot; resolving option i KOs that Hero', () => {
    const gameState = buildState({ '0': [], '1': [] });
    setHq(gameState, [5, 3, 7, 3, null]);
    gameState.heroDeck = ['test-refill-a'] as CardExtId[];
    enqueueEscapeProcedure(gameState, ESCAPER, '0', false);

    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');

    const choice = openChoice(gameState);
    assert.equal(choice.kind, ESCAPE_HQ_KO_KIND);
    assert.deepEqual(choice.addressedSeats, ['0'], 'addressed to the current player only');
    assert.equal(choice.defaultOptionIndex, 0);
    assert.deepEqual(
      choice.seatPrompts['0']!.options,
      [
        { label: 'test-hero-slot1-cost3 (cost 3)', cardId: 'test-hero-slot1-cost3' },
        { label: 'test-hero-slot3-cost3 (cost 3)', cardId: 'test-hero-slot3-cost3' },
        { label: 'test-hero-slot0-cost5 (cost 5)', cardId: 'test-hero-slot0-cost5' },
      ],
      'the cost-7 Hero is not offered; ties break by slot',
    );

    submit(gameState, '0', 1);

    assert.equal(gameState.pendingSeatChoice, undefined, 'the choice applied and cleared');
    assert.deepEqual(gameState.ko, ['test-hero-slot3-cost3']);
    assert.equal(gameState.hq[3], 'test-refill-a');
    assert.ok(hasLog(gameState, `Escape: ${ESCAPER} (${ESCAPER}) KO'd test-hero-slot3-cost3 (test-hero-slot3-cost3) from the HQ.`),
      'the log names the escaped Villain from the queue front');
  });
});

describe('escape procedure step 2 — the Bystander discard (WP-793 / D-24656)', () => {
  it('opens only when a Bystander was carried', () => {
    const gameState = buildState({ '0': ['test-card-a'] as CardExtId[] });
    enqueueEscapeProcedure(gameState, ESCAPER, '0', false);

    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');

    assert.equal(gameState.pendingSeatChoice, undefined, 'no discard without a carried Bystander');
    assert.deepEqual(gameState.playerZones['0']!.hand, ['test-card-a']);
  });

  it('one choice per escape however many Bystanders; empty-hand seats are not addressed', () => {
    const gameState = buildState({
      '0': ['test-card-a', 'test-card-b'] as CardExtId[],
      '1': [],
      '2': ['test-card-c'] as CardExtId[],
    });
    fillCity(gameState, [BYSTANDER_A, BYSTANDER_B]);
    gameState.villainDeck.deck = [ENTERING];
    gameState.villainDeckCardTypes[ENTERING] = 'villain';

    revealVillainCard(makeMockMoveContext(gameState, { numPlayers: 3 }));
    assert.equal(gameState.pendingEscapeProcedures?.length, 1, 'one entry for the one escape');
    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');

    const choice = openChoice(gameState);
    assert.equal(choice.kind, ESCAPE_BYSTANDER_DISCARD_KIND);
    assert.deepEqual(choice.addressedSeats, ['0', '2'], 'seat 1 has no card and is not addressed');
    assert.deepEqual(
      choice.seatPrompts['0']!.options,
      [{ label: 'test-card-a', cardId: 'test-card-a' }, { label: 'test-card-b', cardId: 'test-card-b' }],
    );
    assert.equal(choice.defaultOptionIndex, 0);
  });

  it('every hand empty: only the no-op line is logged', () => {
    const gameState = buildState({ '0': [], '1': [] });
    enqueueEscapeProcedure(gameState, ESCAPER, '0', true);

    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');

    assert.equal(gameState.pendingSeatChoice, undefined);
    assert.ok(hasLog(gameState, 'Escape: no player has a card to discard for the Bystanders carried away.'));
    assert.equal('pendingEscapeProcedures' in gameState, false);
  });

  it('a 2-seat apply discards one card each through discardFromHand (Unending Energy queues return-on-discard)', () => {
    const gameState = buildState({
      '0': ['test-card-a', 'test-card-b'] as CardExtId[],
      '1': [UNENDING_ENERGY, 'test-card-c'] as CardExtId[],
    });
    gameState.heroAbilityHooks = [
      { cardId: UNENDING_ENERGY, timing: 'onDiscard', keywords: ['return-on-discard'] },
    ] as LegendaryGameState['heroAbilityHooks'];
    enqueueEscapeProcedure(gameState, ESCAPER, '0', true);
    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');

    submit(gameState, '1', 0);
    assert.ok(gameState.pendingSeatChoice, 'the choice waits for every addressed seat');
    submit(gameState, '0', 1);

    assert.equal(gameState.pendingSeatChoice, undefined);
    assert.deepEqual(gameState.playerZones['0']!.hand, ['test-card-a']);
    assert.deepEqual(gameState.playerZones['0']!.discard, ['test-card-b']);
    assert.deepEqual(gameState.playerZones['1']!.hand, ['test-card-c']);
    assert.deepEqual(gameState.playerZones['1']!.discard, [UNENDING_ENERGY]);
    assert.deepEqual(gameState.pendingReturnOnDiscard, [{ playerID: '1', cardId: UNENDING_ENERGY }],
      'the discard went through the discardFromHand chokepoint');
    assert.ok(hasLog(gameState, 'Player 1 discarded core/cyclops (core/cyclops) (Bystanders carried away).'));
  });
});

describe('escape procedure order and waits (WP-793 / D-24656)', () => {
  it('step 1 resolves before step 2 opens', () => {
    const gameState = buildState({ '0': ['test-card-a'] as CardExtId[], '1': ['test-card-b'] as CardExtId[] });
    setHq(gameState, [2, 3, null, null, null]);
    enqueueEscapeProcedure(gameState, ESCAPER, '0', true);

    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');
    assert.equal(openChoice(gameState).kind, ESCAPE_HQ_KO_KIND, 'the KO opens first');
    submit(gameState, '0', 0);
    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');

    assert.equal(openChoice(gameState).kind, ESCAPE_BYSTANDER_DISCARD_KIND, 'then the discard');
    assert.equal('pendingEscapeProcedures' in gameState, false, 'step 2 popped the only entry');
  });

  it('two escapes in one move drain in escape order', () => {
    const gameState = buildState({ '0': [] });
    setHq(gameState, [2, 3, 4, null, null]);
    enqueueEscapeProcedure(gameState, 'test-villain-first' as CardExtId, '0', false);
    enqueueEscapeProcedure(gameState, 'test-villain-second' as CardExtId, '0', false);

    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');
    submit(gameState, '0', 0);
    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');
    submit(gameState, '0', 0);
    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');

    const koLines = gameState.messages.filter((entry) => entry.text.includes('from the HQ.'));
    assert.equal(koLines.length, 2);
    assert.ok(koLines[0]!.text.includes('test-villain-first'), 'the first escape KOs first');
    assert.ok(koLines[1]!.text.includes('test-villain-second'));
    assert.equal('pendingEscapeProcedures' in gameState, false);
  });

  it('opens nothing while another seat choice, a return-on-discard reaction or a pendingHeroChoice is open, or once the match is decided', () => {
    const blockers: Array<(gameState: LegendaryGameState) => void> = [
      (gameState) => {
        gameState.pendingSeatChoice = {
          kind: 'generic', addressedSeats: ['0'], seatPrompts: { '0': { options: [{ label: 'x' }] } },
          submissions: {}, defaultOptionIndex: 0,
        };
      },
      (gameState) => {
        gameState.pendingReturnOnDiscard = [{ playerID: '0', cardId: UNENDING_ENERGY }];
      },
      (gameState) => {
        gameState.pendingHeroChoice = { sentinel: true } as unknown as LegendaryGameState['pendingHeroChoice'];
      },
      (gameState) => {
        gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] = 1;
      },
    ];
    for (const block of blockers) {
      const gameState = buildState({ '0': [] });
      setHq(gameState, [2, 3, null, null, null]);
      enqueueEscapeProcedure(gameState, ESCAPER, '0', false);
      block(gameState);
      const seatChoiceBefore = gameState.pendingSeatChoice;

      openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');

      assert.equal(gameState.pendingSeatChoice, seatChoiceBefore, 'no escape choice is parked');
      assert.deepEqual(gameState.ko, [], 'nothing is KO\'d');
      assert.equal(gameState.pendingEscapeProcedures?.[0]?.isHqKoResolved, false, 'the entry waits');
    }
  });

  it('a Juggernaut escape\'s hand-KO pick resolves before the escape\'s seat choices open', () => {
    const gameState = buildState({
      '0': ['core/hero-a#0', 'core/hero-b#0', 'core/hero-c#0'] as CardExtId[],
    });
    setHq(gameState, [2, 3, null, null, null]);
    fillCity(gameState, [BYSTANDER_A]);
    gameState.villainDeck.deck = [ENTERING];
    gameState.villainDeckCardTypes[ENTERING] = 'villain';
    gameState.villainAbilityHooks = [
      {
        cardId: ESCAPER,
        timing: 'onEscape',
        keywords: [],
        effects: [{ primitive: 'ko-hero', target: 'each', magnitude: 2, zone: 'hand' }],
      },
    ] as LegendaryGameState['villainAbilityHooks'];

    revealVillainCard(makeMockMoveContext(gameState));
    assert.equal(gameState.pendingKoHeroChoices?.length, 1, 'the Escape effect parked its hand-KO pick in the move');
    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');
    assert.equal(gameState.pendingSeatChoice, undefined, 'no escape choice stacks on the step-3 pick');

    delete gameState.pendingKoHeroChoices;
    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');
    assert.equal(openChoice(gameState).kind, ESCAPE_HQ_KO_KIND, 'the KO opens once the pick resolved');
  });

  it('a two-seat discard parks with no stage-ride skip; a one-seat KO for the active seat parks with the skip', () => {
    const discardRides: RecordedRide[] = [];
    const discardState = buildState({ '0': ['test-card-a'] as CardExtId[], '1': ['test-card-b'] as CardExtId[] });
    enqueueEscapeProcedure(discardState, ESCAPER, '0', true);
    openEscapeProcedureSeatChoiceIfNeeded(discardState, recordingEvents(discardRides), '0');
    assert.equal(discardRides.length, 1);
    assert.deepEqual(Object.keys(discardRides[0]!.value).sort(), ['0', '1'],
      'the active seat rides with the others (D-24656 point 3)');

    const koRides: RecordedRide[] = [];
    const koState = buildState({ '0': [] });
    setHq(koState, [2, 3, null, null, null]);
    enqueueEscapeProcedure(koState, ESCAPER, '0', false);
    openEscapeProcedureSeatChoiceIfNeeded(koState, recordingEvents(koRides), '0');
    assert.equal(openChoice(koState).kind, ESCAPE_HQ_KO_KIND);
    assert.equal(koRides.length, 0, 'the active seat is not stage-ridden for its own KO (D-24648)');
  });

  it('depletion: an automatic KO that empties the Hero Deck on a Hero-Deck scheme ends the match before step 2 parks', () => {
    const gameState = buildState({ '0': ['test-card-a'] as CardExtId[], '1': ['test-card-b'] as CardExtId[] });
    gameState.selection.schemeId = 'core/super-hero-civil-war';
    setHq(gameState, [2, null, null, null, null]);
    gameState.heroDeck = ['test-refill-a'] as CardExtId[];
    enqueueEscapeProcedure(gameState, ESCAPER, '0', true);

    openEscapeProcedureSeatChoiceIfNeeded(gameState, undefined, '0');

    assert.deepEqual(gameState.heroDeck, [], 'the refill emptied the Hero Deck');
    assert.equal(gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1, 'SCHEME_LOSS is set in the same call');
    assert.equal(gameState.pendingSeatChoice, undefined, 'the queued step 2 does not park');
  });
});

describe('every escape path enqueues the procedure (WP-793 / D-24656)', () => {
  it('a reveal push-off enqueues; its Escape effect fires in the move; no generic Wound', () => {
    const gameState = buildState({ '0': [] });
    fillCity(gameState, [BYSTANDER_A]);
    gameState.villainDeck.deck = [ENTERING];
    gameState.villainDeckCardTypes[ENTERING] = 'villain';
    gameState.villainAbilityHooks = [
      { cardId: ESCAPER, timing: 'onEscape', keywords: [], effects: [{ primitive: 'gain-wound', target: 'each' }] },
    ] as LegendaryGameState['villainAbilityHooks'];

    revealVillainCard(makeMockMoveContext(gameState));

    assert.deepEqual(gameState.pendingEscapeProcedures, [
      { escapedCardId: ESCAPER, chooserPlayerID: '0', hasCarriedBystanders: true, isHqKoResolved: false },
    ]);
    assert.deepEqual(gameState.playerZones['0']!.discard, ['test-wound-00'],
      'step 3 (the printed Escape Wound) already resolved inside the move, before the queue opens — and only it: no second, generic Wound');
    assert.equal(hasLog(gameState, WOUND_LINE), false, 'no generic escape-Wound line');
  });

  it('enterCityIgnoringAmbush enqueues', () => {
    const gameState = buildState({ '0': [] });
    fillCity(gameState, []);

    enterCityIgnoringAmbush(gameState, buildRevealContext(), DEFAULT_IMPLEMENTATION_MAP, ENTERING);

    assert.deepEqual(gameState.pendingEscapeProcedures, [
      { escapedCardId: ESCAPER, chooserPlayerID: '0', hasCarriedBystanders: false, isHqKoResolved: false },
    ]);
    assert.deepEqual(gameState.playerZones['0']!.discard, [], 'no generic escape Wound');
    assert.equal(hasLog(gameState, WOUND_LINE), false);
  });

  it('the Secret Invasion Skrull push runs the full escape: enqueue, onEscape, and the HQ already refilled', () => {
    const gameState = buildState({ '0': [] });
    gameState.selection.schemeId = 'core/secret-invasion-of-the-skrull-shapeshifters';
    setHq(gameState, [2, 2, 2, 2, 9]);
    gameState.heroDeck = ['test-refill-a', 'test-refill-b'] as CardExtId[];
    fillCity(gameState, [BYSTANDER_A]);
    // why: the escaper's Escape effect captures the RIGHTMOST HQ Hero. The Skrull leaves
    // slot 4; only when the slot was refilled BEFORE the escape does the capture take the
    // refill (test-refill-a), which then rides into the Escape Pile with its captor.
    gameState.villainAbilityHooks = [
      { cardId: ESCAPER, timing: 'onEscape', keywords: [], effects: [{ primitive: 'capture-hq-hero', selector: 'rightmost' }] },
    ] as LegendaryGameState['villainAbilityHooks'];

    SCHEME_TWIST_RESOLVERS['secret-invasion'](gameState, buildRevealContext(), DEFAULT_IMPLEMENTATION_MAP, {}, 'test-twist' as CardExtId);

    assert.deepEqual(gameState.pendingEscapeProcedures, [
      { escapedCardId: ESCAPER, chooserPlayerID: '0', hasCarriedBystanders: true, isHqKoResolved: false },
    ]);
    assert.ok(gameState.escapedPile.includes('test-refill-a' as CardExtId),
      'the onEscape capture took the refilled slot-4 Hero');
    assert.equal(gameState.hq[3], 'test-hero-slot3-cost2', 'slot 3 was not captured');
    assert.ok(hasLog(gameState, `Villain ${ESCAPER} (${ESCAPER}) escaped from the city.`), 'the shared escape line');
    assert.equal(hasLog(gameState, WOUND_LINE), false);
  });
});
