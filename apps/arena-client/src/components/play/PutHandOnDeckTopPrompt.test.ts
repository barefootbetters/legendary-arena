/**
 * Tests for the PutHandOnDeckTopPrompt component (Gambit's Stack the Deck +
 * siblings — "Draw N cards. Then put a card from your hand on top of your deck",
 * the put-hand-on-deck-top keyword, WP-700 / D-24519).
 *
 * Covers render gates (present only for the chooser), render-all-and-only the
 * projected eligible hand cards (in hand order), pick move dispatch with the
 * clicked { cardId }, the MANDATORY contract (no Decline control exists — the only
 * exit is placing a card on top), and the no-double-submit guard.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingPutHandOnDeckTop } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import PutHandOnDeckTopPrompt from './PutHandOnDeckTopPrompt.vue';

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

const mockPending: UIPendingPutHandOnDeckTop = {
  playerID: 'player-0',
  eligibleHand: [
    { zone: 'hand', cardId: 'hand-card-1', display: { extId: 'hand-card-1', name: 'Hand Card 1', imageUrl: 'https://example.com/1.jpg', cost: 2 } },
    { zone: 'hand', cardId: 'hand-card-2', display: { extId: 'hand-card-2', name: 'Hand Card 2', imageUrl: 'https://example.com/2.jpg', cost: 0 } },
  ],
};

describe('PutHandOnDeckTopPrompt (WP-700 / D-24519)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PutHandOnDeckTopPrompt, {
      props: { pendingPutHandOnDeckTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="put-hand-on-deck-top-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PutHandOnDeckTopPrompt, {
      props: { pendingPutHandOnDeckTop: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="put-hand-on-deck-top-prompt"]').exists());
  });

  test('does not render when viewer is not the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PutHandOnDeckTopPrompt, {
      props: { pendingPutHandOnDeckTop: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="put-hand-on-deck-top-prompt"]').exists());
  });

  test('does not render when viewer is a spectator (null playerId)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PutHandOnDeckTopPrompt, {
      props: { pendingPutHandOnDeckTop: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="put-hand-on-deck-top-prompt"]').exists());
  });

  test('renders exactly the projected eligible hand cards in hand order', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PutHandOnDeckTopPrompt, {
      props: { pendingPutHandOnDeckTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const cardButtons = wrapper.findAll('[data-testid^="put-hand-on-deck-top-card-"]');
    assert.equal(cardButtons.length, mockPending.eligibleHand.length, 'one button per eligible hand card');
    assert.equal(cardButtons[0]!.attributes('data-testid'), 'put-hand-on-deck-top-card-hand-card-1');
    assert.equal(cardButtons[1]!.attributes('data-testid'), 'put-hand-on-deck-top-card-hand-card-2');
  });

  test('clicking a card fires resolvePutHandOnDeckTop with that cardId (round-trip)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PutHandOnDeckTopPrompt, {
      props: { pendingPutHandOnDeckTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="put-hand-on-deck-top-card-hand-card-2"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolvePutHandOnDeckTop');
    assert.deepEqual(calls[0]!.args, { cardId: 'hand-card-2' });
  });

  test('MANDATORY: the only controls are the hand cards — no Decline / dismiss button', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PutHandOnDeckTopPrompt, {
      props: { pendingPutHandOnDeckTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const allButtons = wrapper.findAll('button');
    assert.equal(allButtons.length, mockPending.eligibleHand.length,
      'the printed placement has no "you may" — the prompt must not offer a decline exit');
  });

  test('a same-frame double-click on a card fires the move exactly once (isSubmitting early-return)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PutHandOnDeckTopPrompt, {
      props: { pendingPutHandOnDeckTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const button = wrapper.find('[data-testid="put-hand-on-deck-top-card-hand-card-1"]');
    await button.trigger('click');
    await button.trigger('click');
    assert.equal(calls.length, 1, 'the second click must early-return on isSubmitting');
  });

  test('a NEW pending frame (fresh object identity) re-enables the controls', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PutHandOnDeckTopPrompt, {
      props: { pendingPutHandOnDeckTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="put-hand-on-deck-top-card-hand-card-1"]').trigger('click');
    assert.equal(calls.length, 1);

    await wrapper.setProps({ pendingPutHandOnDeckTop: { ...mockPending, eligibleHand: [mockPending.eligibleHand[1]!] } });
    await wrapper.find('[data-testid="put-hand-on-deck-top-card-hand-card-2"]').trigger('click');
    assert.equal(calls.length, 2, 'a fresh frame clears the isSubmitting latch');
  });
});
