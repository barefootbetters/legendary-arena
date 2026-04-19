import '../../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import PlayerPanelList from './PlayerPanelList.vue';
import type { UIPlayerState } from '@legendary-arena/game-engine';

const SAMPLE_PLAYERS: readonly UIPlayerState[] = [
  {
    playerId: '0',
    deckCount: 12,
    handCount: 5,
    discardCount: 3,
    inPlayCount: 2,
    victoryCount: 4,
    woundCount: 0,
  },
  {
    playerId: '1',
    deckCount: 10,
    handCount: 5,
    discardCount: 4,
    inPlayCount: 3,
    victoryCount: 2,
    woundCount: 1,
  },
  {
    playerId: '2',
    deckCount: 9,
    handCount: 4,
    discardCount: 5,
    inPlayCount: 1,
    victoryCount: 1,
    woundCount: 2,
  },
];

test('PlayerPanelList renders one PlayerPanel per player in input order', () => {
  const wrapper = mount(PlayerPanelList, {
    props: {
      players: SAMPLE_PLAYERS,
      activePlayerId: '1',
    },
  });

  const panels = wrapper.findAllComponents({ name: 'PlayerPanel' });
  assert.equal(panels.length, SAMPLE_PLAYERS.length);
});

test('PlayerPanelList preserves UIState.players[] array order in rendered PlayerPanel instances (determinism defense)', () => {
  const wrapper = mount(PlayerPanelList, {
    props: {
      players: SAMPLE_PLAYERS,
      activePlayerId: '0',
    },
  });

  const renderedIds = wrapper
    .findAllComponents({ name: 'PlayerPanel' })
    .map((component) => component.props('player').playerId);
  const expectedIds = SAMPLE_PLAYERS.map((player) => player.playerId);

  assert.deepEqual(renderedIds, expectedIds);
});

test('PlayerPanelList forwards isActive=true only to the matching activePlayerId', () => {
  const wrapper = mount(PlayerPanelList, {
    props: {
      players: SAMPLE_PLAYERS,
      activePlayerId: '1',
    },
  });

  const panels = wrapper.findAllComponents({ name: 'PlayerPanel' });
  const activeFlags = panels.map((panel) => panel.props('isActive'));
  assert.deepEqual(activeFlags, [false, true, false]);
});
