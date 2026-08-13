/**
 * Tests for the PendingCopyPowersChoicePrompt component (WP-535 / EC-570).
 *
 * Covers render gates (present only for the chooser, hidden for opponents /
 * spectators / when absent), render-all-and-only the projected eligible Heroes,
 * move dispatch with the clicked { cardId }, same-frame double-click single-submit
 * (handler early-return on isSubmitting), the re-enable after the choice changes,
 * and the fail-safe empty-eligible case.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIState } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import PendingCopyPowersChoicePrompt from './PendingCopyPowersChoicePrompt.vue';

type UIPendingCopyPowersChoice = NonNullable<UIState['pendingCopyPowersChoice']>;

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

const mockPendingChoice: UIPendingCopyPowersChoice = {
  choiceType: 'copy-powers',
  playerID: 'player-0',
  eligible: [
    {
      cardId: 'core/gambit/card-shark',
      display: { extId: 'core/gambit/card-shark', name: 'Card Shark', imageUrl: 'https://example.com/gambit.jpg', cost: 4 },
    },
    {
      cardId: 'core/wolverine/keen-senses',
      display: { extId: 'core/wolverine/keen-senses', name: 'Keen Senses', imageUrl: 'https://example.com/wolverine.jpg', cost: 6 },
    },
  ],
};

describe('PendingCopyPowersChoicePrompt (WP-535 / EC-570)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingCopyPowersChoicePrompt, {
      props: { pendingCopyPowersChoice: mockPendingChoice, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="pending-copy-powers-choice-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingCopyPowersChoicePrompt, {
      props: { pendingCopyPowersChoice: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="pending-copy-powers-choice-prompt"]').exists());
  });

  test('does not render when viewer is not the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingCopyPowersChoicePrompt, {
      props: { pendingCopyPowersChoice: mockPendingChoice, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="pending-copy-powers-choice-prompt"]').exists());
  });

  test('does not render when viewer is a spectator (null playerId)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingCopyPowersChoicePrompt, {
      props: { pendingCopyPowersChoice: mockPendingChoice, viewerPlayerId: null, submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="pending-copy-powers-choice-prompt"]').exists());
  });

  test('renders exactly the projected eligible Heroes (render-all-and-only)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingCopyPowersChoicePrompt, {
      props: { pendingCopyPowersChoice: mockPendingChoice, viewerPlayerId: 'player-0', submitMove },
    });
    const buttons = wrapper.findAll('[data-testid^="pending-copy-powers-choice-card-"]');
    assert.equal(buttons.length, mockPendingChoice.eligible.length, 'one button per eligible entry');
    assert.ok(wrapper.find('[data-testid="pending-copy-powers-choice-card-core/gambit/card-shark"]').exists());
    assert.ok(wrapper.find('[data-testid="pending-copy-powers-choice-card-core/wolverine/keen-senses"]').exists());
    assert.ok(wrapper.text().includes('Card Shark'));
    assert.ok(wrapper.text().includes('Keen Senses'));
  });

  test('clicking an eligible Hero fires resolveCopyPowersChoice with that cardId', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingCopyPowersChoicePrompt, {
      props: { pendingCopyPowersChoice: mockPendingChoice, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="pending-copy-powers-choice-card-core/wolverine/keen-senses"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveCopyPowersChoice');
    assert.deepEqual(calls[0]!.args, { cardId: 'core/wolverine/keen-senses' });
  });

  test('a same-frame double-click fires resolveCopyPowersChoice exactly once (isSubmitting early-return)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingCopyPowersChoicePrompt, {
      props: { pendingCopyPowersChoice: mockPendingChoice, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="pending-copy-powers-choice-card-core/gambit/card-shark"]');
    await btn.trigger('click');
    await btn.trigger('click');
    assert.equal(calls.length, 1, 'second click is a no-op (handler early-returns on isSubmitting)');
  });

  test('re-enables after the pending choice changes (freeze regression)', async () => {
    // why: the prompt is kept mounted for the whole match by the parent page (only its
    // inner content is v-if'd), so isSubmitting must reset when a new choice arrives.
    // Without the reset, a later Copy Powers choice in the same match rendered with
    // disabled buttons, freezing the board under the block-all guard.
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingCopyPowersChoicePrompt, {
      props: { pendingCopyPowersChoice: mockPendingChoice, viewerPlayerId: 'player-0', submitMove },
    });

    await wrapper.find('[data-testid="pending-copy-powers-choice-card-core/gambit/card-shark"]').trigger('click');
    assert.equal(calls.length, 1);

    const secondChoice: UIPendingCopyPowersChoice = {
      choiceType: 'copy-powers',
      playerID: 'player-0',
      eligible: [
        {
          cardId: 'core/cyclops/optic-blast',
          display: { extId: 'core/cyclops/optic-blast', name: 'Optic Blast', imageUrl: 'https://example.com/cyclops.jpg', cost: 3 },
        },
      ],
    };
    await wrapper.setProps({ pendingCopyPowersChoice: secondChoice });

    await wrapper.find('[data-testid="pending-copy-powers-choice-card-core/cyclops/optic-blast"]').trigger('click');
    assert.equal(calls.length, 2, 'the next Copy Powers choice is resolvable (panel not frozen)');
    assert.deepEqual(calls[1]!.args, { cardId: 'core/cyclops/optic-blast' });
  });

  test('fail-safe: an empty eligible list renders no actionable entry and fires no move', () => {
    const { calls, submitMove } = recorder();
    const emptyChoice: UIPendingCopyPowersChoice = {
      choiceType: 'copy-powers',
      playerID: 'player-0',
      eligible: [],
    };
    const wrapper = mount(PendingCopyPowersChoicePrompt, {
      props: { pendingCopyPowersChoice: emptyChoice, viewerPlayerId: 'player-0', submitMove },
    });
    const buttons = wrapper.findAll('[data-testid^="pending-copy-powers-choice-card-"]');
    assert.equal(buttons.length, 0, 'no actionable entry rendered for an empty eligible set');
    assert.equal(calls.length, 0, 'no move fired');
  });
});
