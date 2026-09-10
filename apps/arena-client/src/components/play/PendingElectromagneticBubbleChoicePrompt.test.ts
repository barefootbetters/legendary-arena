/**
 * Tests for the PendingElectromagneticBubbleChoicePrompt component (WP-695 / EC-732).
 *
 * Covers render gates (present only for the chooser), a button per eligible X-Men Hero,
 * dispatch of { cardId } on click, and same-frame double-click single-submit.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingElectromagneticBubbleChoice } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import PendingElectromagneticBubbleChoicePrompt from './PendingElectromagneticBubbleChoicePrompt.vue';

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

const mockChoice: UIPendingElectromagneticBubbleChoice = {
  choiceType: 'electromagnetic-bubble',
  playerID: 'player-0',
  eligibleCards: [
    { cardId: 'wolverine', display: { extId: 'wolverine', name: 'Wolverine', imageUrl: '', cost: 5 } },
    { cardId: 'cyclops', display: { extId: 'cyclops', name: 'Cyclops', imageUrl: '', cost: 4 } },
  ],
};

describe('PendingElectromagneticBubbleChoicePrompt (WP-695 / EC-732)', () => {
  test('renders when the choice exists and the viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingElectromagneticBubbleChoicePrompt, {
      props: { pendingElectromagneticBubbleChoice: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="pending-electromagnetic-bubble-choice-prompt"]').exists());
  });

  test('does not render when undefined, for an opponent, or a spectator', () => {
    const { submitMove } = recorder();
    for (const props of [
      { pendingElectromagneticBubbleChoice: undefined, viewerPlayerId: 'player-0', submitMove },
      { pendingElectromagneticBubbleChoice: mockChoice, viewerPlayerId: 'player-1', submitMove },
      { pendingElectromagneticBubbleChoice: mockChoice, viewerPlayerId: null, submitMove },
    ]) {
      const wrapper = mount(PendingElectromagneticBubbleChoicePrompt, { props });
      assert.ok(!wrapper.find('[data-testid="pending-electromagnetic-bubble-choice-prompt"]').exists());
    }
  });

  test('renders a button per eligible Hero and dispatches { cardId } on click', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingElectromagneticBubbleChoicePrompt, {
      props: { pendingElectromagneticBubbleChoice: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    assert.equal(wrapper.findAll('button').length, 2);
    wrapper.find('[data-testid="pending-electromagnetic-bubble-card-cyclops"]').trigger('click');
    assert.deepEqual(calls[0], { name: 'resolveElectromagneticBubbleChoice', args: { cardId: 'cyclops' } });
  });

  test('same-frame double-click submits once', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingElectromagneticBubbleChoicePrompt, {
      props: { pendingElectromagneticBubbleChoice: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="pending-electromagnetic-bubble-card-wolverine"]');
    btn.trigger('click');
    btn.trigger('click');
    assert.equal(calls.length, 1);
  });
});
