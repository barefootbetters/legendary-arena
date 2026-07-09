/**
 * Tests for the PutAnyNumberBottomHQPrompt component (D-24132 — "Choose any number of
 * cards/Heroes from the HQ. Put them on the bottom of the Hero Deck" — Wonder Man's 8th Wonder
 * of the World, Sunspot's Empyreal Force, Star-Lord (T'Challa)'s Colliding Dreams).
 *
 * Covers render gates (present only for the chooser), render-all-and-only the projected
 * eligible HQ cards (in slot order), multi-select toggle, Confirm dispatch with the selected
 * { cardIds } (in selection order, possibly empty), Put None dispatch with { cardIds: [] }, the
 * non-dismissible contract (only cards + Confirm + Put None), the no-double-submit guard, and
 * selection reset on the next frame.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingPutAnyNumberBottomHQ } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import PutAnyNumberBottomHQPrompt from './PutAnyNumberBottomHQPrompt.vue';

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

const mockPending: UIPendingPutAnyNumberBottomHQ = {
  playerID: 'player-0',
  eligibleHqCards: [
    { cardId: 'hq-card-1', display: { extId: 'hq-card-1', name: 'HQ Card 1', imageUrl: 'https://example.com/1.jpg', cost: 3 } },
    { cardId: 'hq-card-2', display: { extId: 'hq-card-2', name: 'HQ Card 2', imageUrl: 'https://example.com/2.jpg', cost: 5 } },
    { cardId: 'hq-card-3', display: { extId: 'hq-card-3', name: 'HQ Card 3', imageUrl: 'https://example.com/3.jpg', cost: 2 } },
  ],
};

describe('PutAnyNumberBottomHQPrompt (D-24132)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PutAnyNumberBottomHQPrompt, {
      props: { pendingPutAnyNumberBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="put-any-number-hq-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PutAnyNumberBottomHQPrompt, {
      props: { pendingPutAnyNumberBottomHQ: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="put-any-number-hq-prompt"]').exists());
  });

  test('does not render when viewer is not the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PutAnyNumberBottomHQPrompt, {
      props: { pendingPutAnyNumberBottomHQ: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="put-any-number-hq-prompt"]').exists());
  });

  test('does not render when viewer is a spectator (null playerId)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PutAnyNumberBottomHQPrompt, {
      props: { pendingPutAnyNumberBottomHQ: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="put-any-number-hq-prompt"]').exists());
  });

  test('renders exactly the projected eligible HQ cards in slot order', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PutAnyNumberBottomHQPrompt, {
      props: { pendingPutAnyNumberBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const cardButtons = wrapper.findAll('[data-testid^="put-any-number-hq-card-"]');
    assert.equal(cardButtons.length, mockPending.eligibleHqCards.length, 'one toggle per eligible HQ card');
    assert.equal(cardButtons[0]!.attributes('data-testid'), 'put-any-number-hq-card-hq-card-1');
    assert.equal(cardButtons[2]!.attributes('data-testid'), 'put-any-number-hq-card-hq-card-3');
  });

  test('toggling two cards then Confirm fires resolvePutAnyNumberBottomHQ with those cardIds (selection order)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PutAnyNumberBottomHQPrompt, {
      props: { pendingPutAnyNumberBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="put-any-number-hq-card-hq-card-3"]').trigger('click');
    await wrapper.find('[data-testid="put-any-number-hq-card-hq-card-1"]').trigger('click');
    await wrapper.find('[data-testid="put-any-number-hq-confirm"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolvePutAnyNumberBottomHQ');
    assert.deepEqual(calls[0]!.args, { cardIds: ['hq-card-3', 'hq-card-1'] });
  });

  test('toggling a card twice deselects it (Confirm submits without it)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PutAnyNumberBottomHQPrompt, {
      props: { pendingPutAnyNumberBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="put-any-number-hq-card-hq-card-2"]');
    await btn.trigger('click');
    await btn.trigger('click');
    await wrapper.find('[data-testid="put-any-number-hq-confirm"]').trigger('click');
    assert.deepEqual(calls[0]!.args, { cardIds: [] }, 'toggled off → not in the submitted selection');
  });

  test('Confirm with no selection fires resolvePutAnyNumberBottomHQ with an empty array', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PutAnyNumberBottomHQPrompt, {
      props: { pendingPutAnyNumberBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="put-any-number-hq-confirm"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.args, { cardIds: [] });
  });

  test('clicking Put None fires resolvePutAnyNumberBottomHQ with an empty array', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PutAnyNumberBottomHQPrompt, {
      props: { pendingPutAnyNumberBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="put-any-number-hq-put-none"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolvePutAnyNumberBottomHQ');
    assert.deepEqual(calls[0]!.args, { cardIds: [] });
  });

  test('non-dismissible: the only controls are the eligible cards + Confirm + Put None', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PutAnyNumberBottomHQPrompt, {
      props: { pendingPutAnyNumberBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const allButtons = wrapper.findAll('button');
    assert.equal(
      allButtons.length,
      mockPending.eligibleHqCards.length + 2,
      'no dismiss button beyond the HQ cards + Confirm + Put None',
    );
  });

  test('a same-frame double-click on Confirm fires the move exactly once (isSubmitting early-return)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PutAnyNumberBottomHQPrompt, {
      props: { pendingPutAnyNumberBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="put-any-number-hq-confirm"]');
    await btn.trigger('click');
    await btn.trigger('click');
    assert.equal(calls.length, 1, 'second click is a no-op (handler early-returns on isSubmitting)');
  });

  test('re-enables and clears the selection after the pending choice changes', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PutAnyNumberBottomHQPrompt, {
      props: { pendingPutAnyNumberBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="put-any-number-hq-card-hq-card-1"]').trigger('click');
    await wrapper.find('[data-testid="put-any-number-hq-confirm"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.args, { cardIds: ['hq-card-1'] });

    const secondChoice: UIPendingPutAnyNumberBottomHQ = {
      playerID: 'player-0',
      eligibleHqCards: [
        { cardId: 'hq-card-9', display: { extId: 'hq-card-9', name: 'HQ Card 9', imageUrl: 'https://example.com/9.jpg', cost: 4 } },
      ],
    };
    await wrapper.setProps({ pendingPutAnyNumberBottomHQ: secondChoice });

    // The prior selection must NOT carry over — Confirm now submits only the new selection.
    await wrapper.find('[data-testid="put-any-number-hq-confirm"]').trigger('click');
    assert.equal(calls.length, 2, 'the next queued choice is resolvable (panel not frozen)');
    assert.deepEqual(calls[1]!.args, { cardIds: [] }, 'selection reset across frames — no stale hq-card-1');
  });
});
