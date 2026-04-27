import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { UIState } from '@legendary-arena/game-engine';
import PlayView from './PlayView.vue';
import { useUiStateStore } from '../../stores/uiState';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

interface RecordedCall {
  name: UiMoveName;
  args: unknown;
}

function recorder(): { calls: RecordedCall[]; submitMove: SubmitMove } {
  const calls: RecordedCall[] = [];
  const submitMove: SubmitMove = (name, args) => {
    calls.push({ name, args });
  };
  return { calls, submitMove };
}

function buildPlayPhaseSnapshot(): UIState {
  return {
    game: {
      phase: 'play',
      turn: 3,
      activePlayerId: '0',
      currentStage: 'main',
    },
    players: [
      {
        playerId: '0',
        deckCount: 8,
        handCount: 2,
        discardCount: 4,
        inPlayCount: 0,
        victoryCount: 1,
        woundCount: 0,
        handCards: ['cap-rogers', 'iron-man-stark'],
      },
      {
        playerId: '1',
        deckCount: 9,
        handCount: 5,
        discardCount: 0,
        inPlayCount: 0,
        victoryCount: 0,
        woundCount: 1,
      },
    ],
    city: {
      spaces: [
        { extId: 'doom-bot', type: 'villain', keywords: [] },
        null,
        { extId: 'electro', type: 'villain', keywords: ['guard'] },
        null,
        null,
      ],
    },
    hq: { slots: ['hawkeye', null, 'wolverine', null, null] },
    mastermind: {
      id: 'doctor-doom',
      tacticsRemaining: 3,
      tacticsDefeated: 1,
    },
    scheme: { id: 'midtown-bank-robbery', twistCount: 2 },
    economy: {
      attack: 5,
      recruit: 4,
      availableAttack: 5,
      availableRecruit: 4,
    },
    log: [],
    progress: { bystandersRescued: 1, escapedVillains: 0 },
  };
}

function buildEndPhaseSnapshot(): UIState {
  const snapshot = buildPlayPhaseSnapshot();
  snapshot.game.phase = 'end';
  return snapshot;
}

describe('PlayView (WP-100)', () => {

test('PlayView renders the empty-match placeholder when snapshot is null', () => {
  setActivePinia(createPinia());
  const { submitMove } = recorder();
  const wrapper = mount(PlayView, { props: { submitMove } });

  const empty = wrapper.find('[data-testid="play-empty-match"]');
  assert.equal(empty.exists(), true);
  assert.equal(
    empty.text(),
    'No match is currently loaded. Wait for the server to push a frame, or return to the lobby.',
  );
  assert.equal(wrapper.findComponent({ name: 'ArenaHud' }).exists(), false);
});

test('PlayView renders ArenaHud + the five interactive children in play phase', () => {
  setActivePinia(createPinia());
  useUiStateStore().setSnapshot(buildPlayPhaseSnapshot());
  const { submitMove } = recorder();
  const wrapper = mount(PlayView, { props: { submitMove } });

  assert.equal(wrapper.findComponent({ name: 'ArenaHud' }).exists(), true);
  assert.equal(wrapper.findComponent({ name: 'MastermindTile' }).exists(), true);
  assert.equal(wrapper.findComponent({ name: 'CityRow' }).exists(), true);
  assert.equal(wrapper.findComponent({ name: 'HQRow' }).exists(), true);
  assert.equal(wrapper.findComponent({ name: 'HandRow' }).exists(), true);
  assert.equal(wrapper.findComponent({ name: 'TurnActionBar' }).exists(), true);
});

test('PlayView passes the viewer\'s handCards to HandRow', () => {
  setActivePinia(createPinia());
  useUiStateStore().setSnapshot(buildPlayPhaseSnapshot());
  const { submitMove } = recorder();
  const wrapper = mount(PlayView, { props: { submitMove } });

  const handRow = wrapper.findComponent({ name: 'HandRow' });
  assert.deepEqual(handRow.props('handCards'), [
    'cap-rogers',
    'iron-man-stark',
  ]);
  assert.equal(handRow.props('currentStage'), 'main');
});

test('PlayView passes city / hq / mastermind / economy props from snapshot', () => {
  setActivePinia(createPinia());
  const snapshot = buildPlayPhaseSnapshot();
  useUiStateStore().setSnapshot(snapshot);
  const { submitMove } = recorder();
  const wrapper = mount(PlayView, { props: { submitMove } });

  // why: Pinia wraps the snapshot in a reactive Proxy on setSnapshot, so
  // child props are NOT reference-equal to the original object — but they
  // are structurally equal. deepEqual is the correct shape check.
  const cityRow = wrapper.findComponent({ name: 'CityRow' });
  assert.deepEqual(cityRow.props('city'), snapshot.city);
  assert.equal(cityRow.props('currentStage'), 'main');

  const hqRow = wrapper.findComponent({ name: 'HQRow' });
  assert.deepEqual(hqRow.props('hq'), snapshot.hq);

  const mastermindTile = wrapper.findComponent({ name: 'MastermindTile' });
  assert.deepEqual(mastermindTile.props('mastermind'), snapshot.mastermind);
  assert.deepEqual(mastermindTile.props('economy'), snapshot.economy);

  const turnBar = wrapper.findComponent({ name: 'TurnActionBar' });
  assert.equal(turnBar.props('currentStage'), 'main');
});

test('PlayView suppresses interactive children when phase is not play', () => {
  setActivePinia(createPinia());
  useUiStateStore().setSnapshot(buildEndPhaseSnapshot());
  const { submitMove } = recorder();
  const wrapper = mount(PlayView, { props: { submitMove } });

  assert.equal(wrapper.findComponent({ name: 'ArenaHud' }).exists(), true);
  assert.equal(wrapper.findComponent({ name: 'MastermindTile' }).exists(), false);
  assert.equal(wrapper.findComponent({ name: 'CityRow' }).exists(), false);
  assert.equal(wrapper.findComponent({ name: 'HQRow' }).exists(), false);
  assert.equal(wrapper.findComponent({ name: 'HandRow' }).exists(), false);
  assert.equal(wrapper.findComponent({ name: 'TurnActionBar' }).exists(), false);
});

test('PlayView prop-drills submitMove through to children (typed UiMoveName invocation)', () => {
  setActivePinia(createPinia());
  useUiStateStore().setSnapshot(buildPlayPhaseSnapshot());
  const { calls, submitMove } = recorder();
  const wrapper = mount(PlayView, { props: { submitMove } });

  // Driving a child's click should reach the recorder via the prop chain.
  void wrapper
    .find('[data-testid="play-action-end-turn"]')
    .trigger('click');

  // End Turn is gated to 'cleanup' but the click handler still emits via
  // submitMove; the disabled HTML attr just blocks user input. We exercise
  // the chain by clicking a Draw (enabled in 'main') instead.
  const drawCalls = calls.filter((entry) => entry.name === 'drawCards');
  void wrapper.find('[data-testid="play-action-draw"]').trigger('click');
  const afterDraw = calls.filter((entry) => entry.name === 'drawCards');
  assert.equal(afterDraw.length, drawCalls.length + 1);
});

});
