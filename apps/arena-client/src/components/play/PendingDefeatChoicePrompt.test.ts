/**
 * Tests for the PendingDefeatChoicePrompt heading (WP-682 / EC-719 / D-24499).
 *
 * The prompt is reused by two conditional free-defeat cards: Silent Sniper
 * (choiceType 'defeat-with-bystander') and Nick Fury's Pure Fury (choiceType
 * 'pure-fury'). The heading must name the correct source. node:test + @vue/test-utils.
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingDefeatChoice } from '@legendary-arena/game-engine';
import type { SubmitMove } from './uiMoveName.types';

import PendingDefeatChoicePrompt from './PendingDefeatChoicePrompt.vue';

const noopSubmit: SubmitMove = () => {};

function choiceOfType(choiceType: 'defeat-with-bystander' | 'pure-fury'): UIPendingDefeatChoice {
  return {
    choiceType,
    playerID: 'player-0',
    targets: [
      { kind: 'villain', cityIndex: 0, display: { name: 'Villain A' } },
    ],
  } as unknown as UIPendingDefeatChoice;
}

describe('PendingDefeatChoicePrompt heading (WP-682 / D-24499)', () => {
  test('names Silent Sniper (Bystander) for the defeat-with-bystander choiceType', () => {
    const wrapper = mount(PendingDefeatChoicePrompt, {
      props: { pendingDefeatChoice: choiceOfType('defeat-with-bystander'), viewerPlayerId: 'player-0', submitMove: noopSubmit },
    });
    assert.match(wrapper.find('.pending-defeat-choice-prompt__heading').text(), /Bystander/);
  });

  test('names Pure Fury for the pure-fury choiceType', () => {
    const wrapper = mount(PendingDefeatChoicePrompt, {
      props: { pendingDefeatChoice: choiceOfType('pure-fury'), viewerPlayerId: 'player-0', submitMove: noopSubmit },
    });
    assert.match(wrapper.find('.pending-defeat-choice-prompt__heading').text(), /Pure Fury/);
  });
});
