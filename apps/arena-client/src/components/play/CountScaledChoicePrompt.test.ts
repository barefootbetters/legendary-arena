/**
 * Tests for the CountScaledChoicePrompt component (WP-675 / EC-712 / D-24490).
 *
 * Covers render gates (present only for the chooser), the per-option render (one button per
 * option labelled with its resolved total), move dispatch with the right { optionIndex }, and
 * the no-double-submit guard. Mirrors DrawOrEmpoweredPrompt.test.ts.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingCountScaledChoice } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import CountScaledChoicePrompt from './CountScaledChoicePrompt.vue';

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

const mockPending: UIPendingCountScaledChoice = {
  playerID: 'player-0',
  options: [
    { resource: 'recruit', perUnit: 1, count: 2, total: 2 },
    { resource: 'attack', perUnit: 1, count: 3, total: 3 },
  ],
};

describe('CountScaledChoicePrompt (WP-675 / EC-712)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CountScaledChoicePrompt, {
      props: { pendingCountScaledChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="count-scaled-choice-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CountScaledChoicePrompt, {
      props: { pendingCountScaledChoice: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="count-scaled-choice-prompt"]').exists());
  });

  test('does not render for a non-chooser or a spectator', () => {
    const { submitMove } = recorder();
    const opponent = mount(CountScaledChoicePrompt, {
      props: { pendingCountScaledChoice: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!opponent.find('[data-testid="count-scaled-choice-prompt"]').exists());
    const spectator = mount(CountScaledChoicePrompt, {
      props: { pendingCountScaledChoice: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find('[data-testid="count-scaled-choice-prompt"]').exists());
  });

  test('renders one button per option, labelled with its resolved total', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CountScaledChoicePrompt, {
      props: { pendingCountScaledChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const buttons = wrapper.findAll('button');
    assert.equal(buttons.length, 2, 'exactly two option buttons');
    assert.equal(wrapper.find('[data-testid="count-scaled-choice-option-0"]').text(), '+2 Recruit');
    assert.equal(wrapper.find('[data-testid="count-scaled-choice-option-1"]').text(), '+3 Attack');
  });

  test('clicking an option fires resolveCountScaledChoice with its { optionIndex }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(CountScaledChoicePrompt, {
      props: { pendingCountScaledChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="count-scaled-choice-option-1"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveCountScaledChoice');
    assert.deepEqual(calls[0]!.args, { optionIndex: 1 });
  });

  test('does not double-submit on rapid clicks (isSubmitting guard)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(CountScaledChoicePrompt, {
      props: { pendingCountScaledChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const button = wrapper.find('[data-testid="count-scaled-choice-option-0"]');
    await button.trigger('click');
    await button.trigger('click');
    assert.equal(calls.length, 1, 'the second click is guarded');
  });
});
