/**
 * Tests for the PendingRevealThreeAssignPrompt component (WP-753 / EC-790).
 *
 * Covers render gates (present only for the chooser), the source-card heading, a Draw /
 * Discard / KO button per available disposition, dispatch of { cardId, disposition } on click,
 * the "then again" repeat note, and same-frame double-click single-submit.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingRevealThreeAssign } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import PendingRevealThreeAssignPrompt from './PendingRevealThreeAssignPrompt.vue';

interface RecordedCall {
  name: UiMoveName;
  args: unknown;
}

/**
 * Builds a submitMove recorder.
 *
 * @returns the recorded calls and the recording submitMove.
 */
function recorder(): { calls: RecordedCall[]; submitMove: SubmitMove } {
  const calls: RecordedCall[] = [];
  const submitMove: SubmitMove = (name, args) => {
    calls.push({ name, args });
  };
  return { calls, submitMove };
}

/**
 * Builds a pending assignment for player-0.
 *
 * @param remainingRepeats - Repeats owed after this reveal.
 * @returns The mock UI projection.
 */
function makeChoice(remainingRepeats: number): UIPendingRevealThreeAssign {
  return {
    choiceType: 'reveal-three-assign',
    playerID: 'player-0',
    sourceCard: {
      cardId: 'crystal',
      display: { extId: 'crystal', name: 'Crystal of Kadavus', imageUrl: '', cost: 8 },
    },
    revealedCards: [
      { cardId: 'card-a', display: { extId: 'card-a', name: 'Card A', imageUrl: '', cost: 3 } },
      { cardId: 'card-b', display: { extId: 'card-b', name: 'Card B', imageUrl: '', cost: 4 } },
      { cardId: 'card-c', display: { extId: 'card-c', name: 'Card C', imageUrl: '', cost: 5 } },
    ],
    availableDispositions: ['draw', 'discard', 'ko'],
    remainingRepeats,
  };
}

const promptSelector = '[data-testid="pending-reveal-three-assign-prompt"]';

describe('PendingRevealThreeAssignPrompt (WP-753 / EC-790)', () => {
  test('renders for the chooser with the source card named in the heading', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingRevealThreeAssignPrompt, {
      props: { pendingRevealThreeAssign: makeChoice(0), viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find(promptSelector).exists());
    assert.match(wrapper.find('h3').text(), /Crystal of Kadavus/);
  });

  test('does not render when the choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingRevealThreeAssignPrompt, {
      props: { pendingRevealThreeAssign: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find(promptSelector).exists());
  });

  test('does not render for a non-chooser (opponent) or a spectator', () => {
    const { submitMove } = recorder();
    const opponent = mount(PendingRevealThreeAssignPrompt, {
      props: { pendingRevealThreeAssign: makeChoice(0), viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!opponent.find(promptSelector).exists());
    const spectator = mount(PendingRevealThreeAssignPrompt, {
      props: { pendingRevealThreeAssign: makeChoice(0), viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find(promptSelector).exists());
  });

  test('renders Draw / Discard / KO per revealed card and dispatches { cardId, disposition }', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingRevealThreeAssignPrompt, {
      props: { pendingRevealThreeAssign: makeChoice(0), viewerPlayerId: 'player-0', submitMove },
    });
    // 3 cards × 3 dispositions = 9 buttons
    const buttons = wrapper.findAll('button');
    assert.equal(buttons.length, 9);
    assert.deepEqual(buttons.slice(0, 3).map((button) => button.text()), ['Draw', 'Discard', 'KO']);
    wrapper.find('[data-testid="pending-reveal-three-assign-draw-card-b"]').trigger('click');
    assert.deepEqual(calls[0], { name: 'resolveRevealThreeAssign', args: { cardId: 'card-b', disposition: 'draw' } });
  });

  test('shows only the still-unused dispositions', () => {
    const { submitMove } = recorder();
    const choice = makeChoice(0);
    choice.revealedCards = [choice.revealedCards[0]!];
    choice.availableDispositions = ['ko'];
    const wrapper = mount(PendingRevealThreeAssignPrompt, {
      props: { pendingRevealThreeAssign: choice, viewerPlayerId: 'player-0', submitMove },
    });
    assert.equal(wrapper.findAll('button').length, 1);
    assert.equal(wrapper.find('button').text(), 'KO');
  });

  test('notes the repeat only when remainingRepeats > 0', () => {
    const { submitMove } = recorder();
    const repeatSelector = '[data-testid="pending-reveal-three-assign-repeat"]';
    const withRepeat = mount(PendingRevealThreeAssignPrompt, {
      props: { pendingRevealThreeAssign: makeChoice(1), viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(withRepeat.find(repeatSelector).exists());
    const withoutRepeat = mount(PendingRevealThreeAssignPrompt, {
      props: { pendingRevealThreeAssign: makeChoice(0), viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!withoutRepeat.find(repeatSelector).exists());
  });

  test('same-frame double-click submits once', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingRevealThreeAssignPrompt, {
      props: { pendingRevealThreeAssign: makeChoice(0), viewerPlayerId: 'player-0', submitMove },
    });
    const button = wrapper.find('[data-testid="pending-reveal-three-assign-ko-card-c"]');
    button.trigger('click');
    button.trigger('click');
    assert.equal(calls.length, 1, 'only the first click submits');
  });
});
