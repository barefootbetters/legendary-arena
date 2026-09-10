/**
 * Tests for the PendingRuthlessDictatorChoicePrompt component (WP-695 / EC-732).
 *
 * Covers render gates (present only for the chooser), a disposition button per available
 * disposition, dispatch of { cardId, disposition } on click, and same-frame double-click
 * single-submit.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingRuthlessDictatorChoice } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import PendingRuthlessDictatorChoicePrompt from './PendingRuthlessDictatorChoicePrompt.vue';

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

const mockChoice: UIPendingRuthlessDictatorChoice = {
  choiceType: 'ruthless-dictator',
  playerID: 'player-0',
  revealedCards: [
    { cardId: 'card-a', display: { extId: 'card-a', name: 'Card A', imageUrl: '', cost: 3 } },
    { cardId: 'card-b', display: { extId: 'card-b', name: 'Card B', imageUrl: '', cost: 4 } },
  ],
  availableDispositions: ['ko', 'discard', 'top'],
};

describe('PendingRuthlessDictatorChoicePrompt (WP-695 / EC-732)', () => {
  test('renders when the choice exists and the viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingRuthlessDictatorChoicePrompt, {
      props: { pendingRuthlessDictatorChoice: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="pending-ruthless-dictator-choice-prompt"]').exists());
  });

  const testId = '[data-testid="pending-ruthless-dictator-choice-prompt"]';

  test('does not render when the choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingRuthlessDictatorChoicePrompt, {
      props: { pendingRuthlessDictatorChoice: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find(testId).exists());
  });

  test('does not render for a non-chooser (opponent) or a spectator', () => {
    const { submitMove } = recorder();
    const opponent = mount(PendingRuthlessDictatorChoicePrompt, {
      props: { pendingRuthlessDictatorChoice: mockChoice, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!opponent.find(testId).exists());
    const spectator = mount(PendingRuthlessDictatorChoicePrompt, {
      props: { pendingRuthlessDictatorChoice: mockChoice, viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find(testId).exists());
  });

  test('renders a button per available disposition and dispatches { cardId, disposition }', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingRuthlessDictatorChoicePrompt, {
      props: { pendingRuthlessDictatorChoice: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    // 2 cards × 3 dispositions = 6 buttons
    assert.equal(wrapper.findAll('button').length, 6);
    wrapper.find('[data-testid="pending-ruthless-dictator-ko-card-a"]').trigger('click');
    assert.deepEqual(calls[0], { name: 'resolveRuthlessDictatorChoice', args: { cardId: 'card-a', disposition: 'ko' } });
  });

  test('same-frame double-click submits once', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingRuthlessDictatorChoicePrompt, {
      props: { pendingRuthlessDictatorChoice: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="pending-ruthless-dictator-discard-card-b"]');
    btn.trigger('click');
    btn.trigger('click');
    assert.equal(calls.length, 1, 'only the first click submits');
  });
});
