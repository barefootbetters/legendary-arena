/**
 * Tests for the ReturnOnDiscardPrompt component (Cyclops Unending Energy —
 * "If a card effect makes you discard this card, you may return this card to
 * your hand", WP-498 / D-24301).
 *
 * Covers render gates (present only for the chooser), the Return move dispatch
 * with the projected { cardId }, Decline dispatch with { decline: true }, the
 * non-dismissible contract (the only exits are Return or Decline), and the
 * no-double-submit guard (handler early-return on isSubmitting; re-enable on the
 * next frame).
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingReturnOnDiscard } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import ReturnOnDiscardPrompt from './ReturnOnDiscardPrompt.vue';

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

const mockPending: UIPendingReturnOnDiscard = {
  playerID: 'player-0',
  eligibleReturnCards: [
    { zone: 'discard', cardId: 'core/cyclops', display: { extId: 'core/cyclops', name: 'Unending Energy', imageUrl: 'https://example.com/ue.jpg', cost: 6 } },
  ],
};

describe('ReturnOnDiscardPrompt (Cyclops Unending Energy)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(ReturnOnDiscardPrompt, {
      props: { pendingReturnOnDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="return-on-discard-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(ReturnOnDiscardPrompt, {
      props: { pendingReturnOnDiscard: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="return-on-discard-prompt"]').exists());
  });

  test('does not render when viewer is not the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(ReturnOnDiscardPrompt, {
      props: { pendingReturnOnDiscard: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="return-on-discard-prompt"]').exists());
  });

  test('does not render when viewer is a spectator (null playerId)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(ReturnOnDiscardPrompt, {
      props: { pendingReturnOnDiscard: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="return-on-discard-prompt"]').exists());
  });

  test('clicking the returnable card fires resolveReturnOnDiscard with that cardId (round-trip)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(ReturnOnDiscardPrompt, {
      props: { pendingReturnOnDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="return-on-discard-card-core/cyclops"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveReturnOnDiscard');
    assert.deepEqual(calls[0]!.args, { cardId: 'core/cyclops' });
  });

  test('clicking Decline fires resolveReturnOnDiscard with { decline: true }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(ReturnOnDiscardPrompt, {
      props: { pendingReturnOnDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="return-on-discard-decline"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveReturnOnDiscard');
    assert.deepEqual(calls[0]!.args, { decline: true });
  });

  test('non-dismissible: the only controls are the returnable card + Decline', () => {
    const { submitMove } = recorder();
    const wrapper = mount(ReturnOnDiscardPrompt, {
      props: { pendingReturnOnDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const allButtons = wrapper.findAll('button');
    assert.equal(allButtons.length, mockPending.eligibleReturnCards.length + 1, 'no dismiss button beyond the card + Decline');
  });

  test('a same-frame double-click fires the move exactly once (isSubmitting early-return)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(ReturnOnDiscardPrompt, {
      props: { pendingReturnOnDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="return-on-discard-card-core/cyclops"]');
    await btn.trigger('click');
    await btn.trigger('click');
    assert.equal(calls.length, 1, 'second click is a no-op (handler early-returns on isSubmitting)');
  });

  test('re-enables after the pending choice changes so the next queued choice is resolvable', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(ReturnOnDiscardPrompt, {
      props: { pendingReturnOnDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="return-on-discard-card-core/cyclops"]').trigger('click');
    assert.equal(calls.length, 1);

    const secondChoice: UIPendingReturnOnDiscard = {
      playerID: 'player-0',
      eligibleReturnCards: [
        { zone: 'discard', cardId: 'core/cyclops', display: { extId: 'core/cyclops', name: 'Unending Energy', imageUrl: 'https://example.com/ue.jpg', cost: 6 } },
      ],
    };
    await wrapper.setProps({ pendingReturnOnDiscard: secondChoice });

    await wrapper.find('[data-testid="return-on-discard-decline"]').trigger('click');
    assert.equal(calls.length, 2, 'the next queued choice is resolvable (panel not frozen)');
    assert.deepEqual(calls[1]!.args, { decline: true });
  });
});
