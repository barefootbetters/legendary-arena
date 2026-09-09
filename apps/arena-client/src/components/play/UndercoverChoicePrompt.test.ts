/**
 * Tests for the UndercoverChoicePrompt component (WP-678/679 / EC-716 / D-24494/D-24495).
 *
 * Covers render gates (present only for the chooser, hidden for opponents/spectators), one
 * button per eligible target, move dispatch with the right { targetExtId }, and the
 * no-double-submit guard. Mirrors CountScaledChoicePrompt.test.ts.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingUndercoverChoice } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import UndercoverChoicePrompt from './UndercoverChoicePrompt.vue';

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

const mockPending: UIPendingUndercoverChoice = {
  playerID: 'player-0',
  eligibleTargets: ['nick-fury#0', 'maria-hill#0'],
};

describe('UndercoverChoicePrompt (WP-678/679 / EC-716)', () => {
  test('renders when a pick is pending and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="undercover-choice-prompt"]').exists());
    assert.equal(wrapper.findAll('button').length, 2, 'one button per eligible target');
  });

  test('does not render when no pick is pending', () => {
    const { submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="undercover-choice-prompt"]').exists());
  });

  test('does not render for a non-chooser or a spectator', () => {
    const { submitMove } = recorder();
    const opponent = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!opponent.find('[data-testid="undercover-choice-prompt"]').exists());
    const spectator = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find('[data-testid="undercover-choice-prompt"]').exists());
  });

  test('clicking a target fires resolveUndercoverChoice with its { targetExtId }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="undercover-choice-option-1"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveUndercoverChoice');
    assert.deepEqual(calls[0]!.args, { targetExtId: 'maria-hill#0' });
  });

  test('does not fire twice (no-double-submit guard)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const button = wrapper.find('[data-testid="undercover-choice-option-0"]');
    await button.trigger('click');
    await button.trigger('click');
    assert.equal(calls.length, 1, 'the second click is debounced');
  });
});
