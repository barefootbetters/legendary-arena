/**
 * operatorSetterIntents tests (WP-807 / EC-844 §D).
 *
 * Pins the six intent builders to WP-806's exact move names and args, the
 * "Move a card" source and destination lists (order, stable keys, labels), the
 * deck card options' first-position labels, and the two presentation checks.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BYSTANDER_EXT_ID,
  SHIELD_OFFICER_EXT_ID,
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
} from './operatorSetterIntents';

/**
 * An inline two-seat operator view.
 *
 * @param overrides Fields to replace on the view.
 * @returns The view.
 */
function buildView(overrides: Partial<OperatorView> = {}): OperatorView {
  const view = {
    board: {
      game: { activePlayerId: '0' },
      city: { spaces: [null, null, null, null, { extId: 'villain-edge' }] },
    } as unknown as UIState,
    currentStage: 'main',
    seats: [
      {
        playerId: '0',
        deckTopFirst: ['deck-card'],
        hand: ['hand-card'],
        discard: ['discard-card'],
        inPlay: ['in-play-card'],
        victory: ['victory-card'],
        woundsByZone: { deck: 0, hand: 0, discard: 0, inPlay: 0, victory: 0 },
      },
      {
        playerId: '1',
        deckTopFirst: [],
        hand: ['other-hand-card'],
        discard: [],
        inPlay: [],
        victory: [],
        woundsByZone: { deck: 0, hand: 0, discard: 0, inPlay: 0, victory: 0 },
      },
    ],
    villainDeckTopFirst: [],
    heroDeckTopFirst: [],
    mastermindTacticsTopFirst: [],
    supplyCounts: { wounds: 5, bystanders: 1, officers: 2, sidekicks: 0 },
    koPile: [],
    escapedPile: [],
    counters: {},
    cardDisplay: {
      'hand-card': { extId: 'hand-card', name: 'Hand Card', imageUrl: '', cost: 1 },
      a: { extId: 'a', name: 'A', imageUrl: '', cost: null },
      b: { extId: 'b', name: 'B', imageUrl: '', cost: null },
    },
  } as unknown as OperatorView;
  return { ...view, ...overrides };
}

describe('operatorSetterIntents (WP-807)', () => {
  test('each intent builder returns WP-806 exact move name and args', () => {
    assert.deepEqual(buildSupplyCountIntent('wounds', 0), {
      name: 'operatorSetSupplyCount',
      args: { pile: 'wounds', count: 0 },
    });
    assert.deepEqual(buildDeckTopIntent('villain', 'ymir'), {
      name: 'operatorMoveToDeckTop',
      args: { deck: 'villain', cardId: 'ymir' },
    });
    assert.deepEqual(buildRevealNowIntent('mastermind-strike'), {
      name: 'operatorRevealNow',
      args: { cardType: 'mastermind-strike' },
    });
    const source = { key: '0|hand|x', cardId: 'x', from: { zone: 'hand', playerId: '0' }, label: '' } as const;
    assert.deepEqual(buildMoveCardIntent(source, { zone: 'ko' }), {
      name: 'operatorMoveCard',
      args: { cardId: 'x', from: { zone: 'hand', playerId: '0' }, to: { zone: 'ko' } },
    });
    assert.deepEqual(buildEconomyIntent('recruit', 7), {
      name: 'operatorAddEconomy',
      args: { resource: 'recruit', amount: 7 },
    });
    assert.deepEqual(buildEscapeIntent(), { name: 'operatorEscapeVillain', args: {} });
  });

  test('buildCardSources lists seats in order across five zones, then non-empty supplies', () => {
    const sources = buildCardSources(buildView());
    assert.deepEqual(
      sources.map((source) => source.key),
      [
        '0|hand|hand-card',
        '0|deck|deck-card',
        '0|discard|discard-card',
        '0|inPlay|in-play-card',
        '0|victory|victory-card',
        '1|hand|other-hand-card',
        'supply|wounds',
        'supply|bystanders',
        'supply|officers',
      ],
    );
    assert.deepEqual(
      sources.map((source) => source.label),
      [
        'Player 0 · hand · Hand Card',
        'Player 0 · deck · deck-card',
        'Player 0 · discard pile · discard-card',
        'Player 0 · play area · in-play-card',
        'Player 0 · Victory Pile · victory-card',
        'Player 1 · hand · other-hand-card',
        'Wound supply (top)',
        'Bystander supply (top)',
        'S.H.I.E.L.D. Officer supply (top)',
      ],
    );
    assert.deepEqual(sources[1]!.from, { zone: 'deck', playerId: '0' });
    assert.deepEqual(
      sources.slice(6).map((source) => [source.cardId, source.from]),
      [
        [WOUND_EXT_ID, { zone: 'supply', pile: 'wounds' }],
        [BYSTANDER_EXT_ID, { zone: 'supply', pile: 'bystanders' }],
        [SHIELD_OFFICER_EXT_ID, { zone: 'supply', pile: 'officers' }],
      ],
      'a supply entry carries its fungible id; an empty pile (sidekicks 0) has none',
    );
  });

  test('buildDestinations lists four zones per seat, then the KO pile', () => {
    const destinations = buildDestinations(buildView());
    assert.deepEqual(
      destinations.map((destination) => [destination.key, destination.label]),
      [
        ['0|hand', 'Player 0 · hand'],
        ['0|deck', 'Player 0 · deck (top)'],
        ['0|discard', 'Player 0 · discard pile'],
        ['0|victory', 'Player 0 · Victory Pile'],
        ['1|hand', 'Player 1 · hand'],
        ['1|deck', 'Player 1 · deck (top)'],
        ['1|discard', 'Player 1 · discard pile'],
        ['1|victory', 'Player 1 · Victory Pile'],
        ['ko', 'KO pile'],
      ],
    );
    assert.deepEqual(destinations[3]!.ref, { zone: 'victory', playerId: '0' });
    assert.deepEqual(destinations[8]!.ref, { zone: 'ko' });
  });

  test('buildDeckCardOptions labels each distinct card by its first position', () => {
    assert.deepEqual(buildDeckCardOptions(['a', 'a', 'b'], buildView()), [
      { text: '1. A', value: 'a' },
      { text: '3. B', value: 'b' },
    ]);
    assert.deepEqual(buildDeckCardOptions([], buildView()), []);
  });

  test('isSetterWindowOpen needs the viewer turn in the main stage', () => {
    assert.equal(isSetterWindowOpen(buildView({ currentStage: 'start' }), '0'), false);
    assert.equal(isSetterWindowOpen(buildView(), '1'), false, 'another seat turn');
    assert.equal(isSetterWindowOpen(buildView(), '0'), true);
  });

  test('hasEscapeCandidate reads City space index 4', () => {
    assert.equal(hasEscapeCandidate(buildView()), true);
    const emptyEdge = buildView({
      board: {
        game: { activePlayerId: '0' },
        city: { spaces: [{ extId: 'villain-first' }, null, null, null, null] },
      } as unknown as UIState,
    });
    assert.equal(hasEscapeCandidate(emptyEdge), false);
  });
});
