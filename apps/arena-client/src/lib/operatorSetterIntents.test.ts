/**
 * Operator setter intent and option builder tests (WP-807 / EC-844 §D).
 *
 * Pure: an inline `OperatorView` fixture, no Vue and no Tweakpane.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BYSTANDER_EXT_ID,
  WOUND_EXT_ID,
} from '@legendary-arena/game-engine';
import type { OperatorView, UIState } from '@legendary-arena/game-engine';

import {
  buildCardSources,
  buildDeckCardOptions,
  buildDeckTopIntent,
  buildDestinations,
  buildEconomyIntent,
  buildEscapeIntent,
  buildMoveCardIntent,
  buildRevealNowIntent,
  buildSupplyCountIntent,
  hasEscapeCandidate,
  isSetterWindowOpen,
  seatLabel,
  toWholeNumberInRange,
} from './operatorSetterIntents';

/**
 * A two-seat operator view with one card in each of seat 0's five zones.
 *
 * @param overrides Fields that replace the defaults.
 * @returns The view.
 */
function buildView(overrides: Partial<OperatorView> = {}): OperatorView {
  return {
    board: {
      game: { activePlayerId: '0' },
      city: { spaces: [null, null, null, null, { extId: 'villain-edge' }], escapedPile: [] },
    } as unknown as UIState,
    currentStage: 'main',
    seats: [
      {
        playerId: '0',
        deckTopFirst: ['deck-card'],
        hand: ['hand-card'],
        discard: ['discard-card'],
        inPlay: ['play-card'],
        victory: ['victory-card'],
        woundsByZone: { deck: 0, hand: 0, discard: 0, inPlay: 0, victory: 0 },
      },
      {
        playerId: '1',
        deckTopFirst: [],
        hand: ['other-hand'],
        discard: [],
        inPlay: [],
        victory: [],
        woundsByZone: { deck: 0, hand: 0, discard: 0, inPlay: 0, victory: 0 },
      },
    ],
    villainDeckTopFirst: [],
    heroDeckTopFirst: [],
    mastermindTacticsTopFirst: [],
    supplyCounts: { wounds: 3, bystanders: 1, officers: 0, sidekicks: 0 },
    koPile: [],
    escapedPile: [],
    counters: {},
    cardDisplay: {
      'hand-card': { extId: 'hand-card', name: 'Hand Card', imageUrl: '', cost: 1 },
      a: { extId: 'a', name: 'A', imageUrl: '', cost: null },
      b: { extId: 'b', name: 'B', imageUrl: '', cost: null },
    },
    ...overrides,
  };
}

describe('operatorSetterIntents — intent builders (WP-807)', () => {
  test('each builder returns the locked move name and args', () => {
    assert.deepEqual(buildSupplyCountIntent('wounds', 0), {
      name: 'operatorSetSupplyCount',
      args: { pile: 'wounds', count: 0 },
    });
    assert.deepEqual(buildDeckTopIntent('villain', 'v-1'), {
      name: 'operatorMoveToDeckTop',
      args: { deck: 'villain', cardId: 'v-1' },
    });
    assert.deepEqual(buildRevealNowIntent('mastermind-strike'), {
      name: 'operatorRevealNow',
      args: { cardType: 'mastermind-strike' },
    });
    const source = { key: '0|hand|c', cardId: 'c', from: { zone: 'hand' as const, playerId: '0' }, label: '' };
    assert.deepEqual(buildMoveCardIntent(source, { zone: 'ko' }), {
      name: 'operatorMoveCard',
      args: { cardId: 'c', from: { zone: 'hand', playerId: '0' }, to: { zone: 'ko' } },
    });
    assert.deepEqual(buildEconomyIntent('recruit', 7), {
      name: 'operatorAddEconomy',
      args: { resource: 'recruit', amount: 7 },
    });
    assert.deepEqual(buildEscapeIntent(), { name: 'operatorEscapeVillain', args: {} });
  });
});

describe('operatorSetterIntents — option builders (WP-807)', () => {
  test('buildCardSources lists seats in order across five zones, then supplies with cards', () => {
    const sources = buildCardSources(buildView(), '0');
    assert.deepEqual(
      sources.map((source) => source.key),
      [
        '0|hand|hand-card',
        '0|deck|deck-card',
        '0|discard|discard-card',
        '0|inPlay|play-card',
        '0|victory|victory-card',
        '1|hand|other-hand',
        'supply|wounds',
        'supply|bystanders',
      ],
    );
    assert.deepEqual(
      sources.map((source) => source.label),
      [
        'You (Player 0) · hand · Hand Card',
        'You (Player 0) · deck · deck-card',
        'You (Player 0) · discard pile · discard-card',
        'You (Player 0) · play area · play-card',
        'You (Player 0) · Victory Pile · victory-card',
        'Player 1 · hand · other-hand',
        'Wound supply (top)',
        'Bystander supply (top)',
      ],
    );
    assert.deepEqual(sources[1]!.from, { zone: 'deck', playerId: '0' });
    assert.equal(sources[6]!.cardId, WOUND_EXT_ID);
    assert.deepEqual(sources[6]!.from, { zone: 'supply', pile: 'wounds' });
    assert.equal(sources[7]!.cardId, BYSTANDER_EXT_ID);
  });

  test('buildDestinations lists four zones per seat plus the KO pile', () => {
    const destinations = buildDestinations(buildView(), '0');
    assert.deepEqual(
      destinations.map((destination) => destination.key),
      ['0|hand', '0|deck', '0|discard', '0|victory', '1|hand', '1|deck', '1|discard', '1|victory', 'ko'],
    );
    assert.deepEqual(
      destinations.slice(0, 4).map((destination) => destination.label),
      ['You (Player 0) · hand', 'You (Player 0) · deck (top)', 'You (Player 0) · discard pile', 'You (Player 0) · Victory Pile'],
    );
    assert.deepEqual(destinations[8], { key: 'ko', ref: { zone: 'ko' }, label: 'KO pile' });
    assert.deepEqual(destinations[5]!.ref, { zone: 'deck', playerId: '1' });
  });

  test('seatLabel marks only the viewer seat as "You"; other seats keep their number', () => {
    assert.equal(seatLabel('0', '0'), 'You (Player 0)');
    assert.equal(seatLabel('1', '0'), 'Player 1');
    assert.equal(seatLabel('1', '1'), 'You (Player 1)');
  });

  test('the "You" label follows the viewer seat, not seat 0', () => {
    const destinations = buildDestinations(buildView(), '1');
    assert.equal(destinations[0]!.label, 'Player 0 · hand');
    assert.equal(destinations[4]!.label, 'You (Player 1) · hand');
    const sources = buildCardSources(buildView(), '1');
    assert.equal(sources[5]!.label, 'You (Player 1) · hand · other-hand');
  });

  test('buildDeckCardOptions keeps distinct ids labelled by first position', () => {
    assert.deepEqual(buildDeckCardOptions(['a', 'a', 'b'], buildView()), [
      { text: '1. A', value: 'a' },
      { text: '3. B', value: 'b' },
    ]);
  });

  test('isSetterWindowOpen needs the viewer turn in the main stage', () => {
    assert.equal(isSetterWindowOpen(buildView({ currentStage: 'start' }), '0'), false);
    assert.equal(isSetterWindowOpen(buildView(), '1'), false);
    assert.equal(isSetterWindowOpen(buildView(), '0'), true);
  });

  test('hasEscapeCandidate reads City space 4', () => {
    assert.equal(hasEscapeCandidate(buildView()), true);
    const emptyEdge = buildView({
      board: {
        game: { activePlayerId: '0' },
        city: { spaces: [null, null, null, null, null], escapedPile: [] },
      } as unknown as UIState,
    });
    assert.equal(hasEscapeCandidate(emptyEdge), false);
  });

  test('hasEscapeCandidate reads the LAST space of a resized City (WP-831)', () => {
    const smallCity = buildView({
      board: {
        game: { activePlayerId: '0' },
        city: { spaces: [null, { extId: 'villain-edge' }], escapedPile: [] },
      } as unknown as UIState,
    });
    assert.equal(hasEscapeCandidate(smallCity), true);
  });
});

describe('toWholeNumberInRange (live match cDfRs-e8CqM)', () => {
  test('NaN and infinities fall back to the minimum', () => {
    assert.equal(toWholeNumberInRange(Number.NaN, 1, 20), 1);
    assert.equal(toWholeNumberInRange(Number.POSITIVE_INFINITY, 1, 20), 1);
    assert.equal(toWholeNumberInRange(Number.NEGATIVE_INFINITY, 0, Number.POSITIVE_INFINITY), 0);
  });

  test('rounds to a whole number and clamps into the range', () => {
    assert.equal(toWholeNumberInRange(7, 1, 20), 7);
    assert.equal(toWholeNumberInRange(4.6, 1, 20), 5);
    assert.equal(toWholeNumberInRange(25, 1, 20), 20);
    assert.equal(toWholeNumberInRange(-3, 1, 5), 1);
    assert.equal(toWholeNumberInRange(40, 0, Number.POSITIVE_INFINITY), 40);
  });
});
