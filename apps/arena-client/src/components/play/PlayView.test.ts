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

function buildLobbyPhaseSnapshot(): UIState {
  const snapshot = buildPlayPhaseSnapshot();
  snapshot.game.phase = 'lobby';
  snapshot.game.currentStage = '';
  return snapshot;
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
  assert.equal(wrapper.findComponent({ name: 'LobbyControls' }).exists(), false);
});

test('PlayView renders ArenaHud + LobbyControls in lobby phase (revised 2026-04-27)', () => {
  setActivePinia(createPinia());
  useUiStateStore().setSnapshot(buildLobbyPhaseSnapshot());
  const { submitMove } = recorder();
  const wrapper = mount(PlayView, { props: { submitMove } });

  assert.equal(wrapper.findComponent({ name: 'ArenaHud' }).exists(), true);
  assert.equal(wrapper.findComponent({ name: 'LobbyControls' }).exists(), true);
  assert.equal(wrapper.findComponent({ name: 'MastermindTile' }).exists(), false);
  assert.equal(wrapper.findComponent({ name: 'CityRow' }).exists(), false);
  assert.equal(wrapper.findComponent({ name: 'HQRow' }).exists(), false);
  assert.equal(wrapper.findComponent({ name: 'HandRow' }).exists(), false);
  assert.equal(wrapper.findComponent({ name: 'TurnActionBar' }).exists(), false);
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

test('PlayView suppresses interactive children + LobbyControls in end phase (only ArenaHud renders)', () => {
  setActivePinia(createPinia());
  useUiStateStore().setSnapshot(buildEndPhaseSnapshot());
  const { submitMove } = recorder();
  const wrapper = mount(PlayView, { props: { submitMove } });

  assert.equal(wrapper.findComponent({ name: 'ArenaHud' }).exists(), true);
  assert.equal(wrapper.findComponent({ name: 'LobbyControls' }).exists(), false);
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

  void wrapper.find('[data-testid="play-action-draw"]').trigger('click');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, 'drawCards');
  assert.deepEqual(calls[0]!.args, { count: 6 });
});

test('PlayView prop-drills submitMove through to LobbyControls (lobby phase)', () => {
  setActivePinia(createPinia());
  useUiStateStore().setSnapshot(buildLobbyPhaseSnapshot());
  const { calls, submitMove } = recorder();
  const wrapper = mount(PlayView, { props: { submitMove } });

  void wrapper
    .find('[data-testid="play-lobby-mark-ready"]')
    .trigger('click');
  void wrapper
    .find('[data-testid="play-lobby-start-match"]')
    .trigger('click');

  assert.equal(calls.length, 2);
  assert.equal(calls[0]!.name, 'setPlayerReady');
  assert.deepEqual(calls[0]!.args, { ready: true });
  assert.equal(calls[1]!.name, 'startMatchIfReady');
  assert.deepEqual(calls[1]!.args, {});
});

});
