/**
 * Tests for the ReturnZeroCostDiscardPrompt component (Black Knight's Defend
 * the Weak — "Return a 0-cost card from your discard pile to your hand",
 * D-24139).
 *
 * Covers render gates (present only for the chooser), render-all-and-only the
 * projected eligible discard cards (in discard order), pick move dispatch with
 * the clicked { cardId }, the MANDATORY contract (no Decline control exists —
 * the only exit is picking a card), and the no-double-submit guard (handler
 * early-return on isSubmitting; re-enable on the next frame).
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingReturnZeroCostDiscard } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import ReturnZeroCostDiscardPrompt from './ReturnZeroCostDiscardPrompt.vue';

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

const mockPending: UIPendingReturnZeroCostDiscard = {
  playerID: 'player-0',
  eligibleDiscardCards: [
    { zone: 'discard', cardId: 'zero-card-1', display: { extId: 'zero-card-1', name: 'Zero Card 1', imageUrl: 'https://example.com/1.jpg', cost: 0 } },
    { zone: 'discard', cardId: 'zero-card-2', display: { extId: 'zero-card-2', name: 'Zero Card 2', imageUrl: 'https://example.com/2.jpg', cost: 0 } },
  ],
};

describe('ReturnZeroCostDiscardPrompt (D-24139)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(ReturnZeroCostDiscardPrompt, {
      props: { pendingReturnZeroCostDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="return-zero-cost-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(ReturnZeroCostDiscardPrompt, {
      props: { pendingReturnZeroCostDiscard: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="return-zero-cost-prompt"]').exists());
  });

  test('does not render when viewer is not the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(ReturnZeroCostDiscardPrompt, {
      props: { pendingReturnZeroCostDiscard: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="return-zero-cost-prompt"]').exists());
  });

  test('does not render when viewer is a spectator (null playerId)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(ReturnZeroCostDiscardPrompt, {
      props: { pendingReturnZeroCostDiscard: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="return-zero-cost-prompt"]').exists());
  });

  test('renders exactly the projected eligible discard cards in discard order', () => {
    const { submitMove } = recorder();
    const wrapper = mount(ReturnZeroCostDiscardPrompt, {
      props: { pendingReturnZeroCostDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const cardButtons = wrapper.findAll('[data-testid^="return-zero-cost-card-"]');
    assert.equal(cardButtons.length, mockPending.eligibleDiscardCards.length, 'one button per eligible discard card');
    assert.equal(cardButtons[0]!.attributes('data-testid'), 'return-zero-cost-card-zero-card-1');
    assert.equal(cardButtons[1]!.attributes('data-testid'), 'return-zero-cost-card-zero-card-2');
  });

  test('clicking an eligible card fires resolveReturnZeroCostDiscard with that cardId (round-trip)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(ReturnZeroCostDiscardPrompt, {
      props: { pendingReturnZeroCostDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="return-zero-cost-card-zero-card-2"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveReturnZeroCostDiscard');
    assert.deepEqual(calls[0]!.args, { cardId: 'zero-card-2' });
  });

  test('MANDATORY: the only controls are the eligible cards — no Decline / dismiss button', () => {
    const { submitMove } = recorder();
    const wrapper = mount(ReturnZeroCostDiscardPrompt, {
      props: { pendingReturnZeroCostDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const allButtons = wrapper.findAll('button');
    assert.equal(allButtons.length, mockPending.eligibleDiscardCards.length,
      'the printed text has no "you may" — the prompt must not offer a decline exit');
  });

  test('a same-frame double-click on a card fires the move exactly once (isSubmitting early-return)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(ReturnZeroCostDiscardPrompt, {
      props: { pendingReturnZeroCostDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const button = wrapper.find('[data-testid="return-zero-cost-card-zero-card-1"]');
    await button.trigger('click');
    await button.trigger('click');
    assert.equal(calls.length, 1, 'the second click must early-return on isSubmitting');
  });

  test('a NEW pending frame (fresh object identity) re-enables the controls', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(ReturnZeroCostDiscardPrompt, {
      props: { pendingReturnZeroCostDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="return-zero-cost-card-zero-card-1"]').trigger('click');
    assert.equal(calls.length, 1);

    // Simulate the next server frame: a fresh pending object for a second queued choice.
    await wrapper.setProps({ pendingReturnZeroCostDiscard: { ...mockPending } });
    await wrapper.find('[data-testid="return-zero-cost-card-zero-card-2"]').trigger('click');
    assert.equal(calls.length, 2, 'a fresh frame clears the isSubmitting latch');
  });
});
