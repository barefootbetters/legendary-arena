/**
 * Tests for the OptionalPutBottomHQPrompt component (Wonder Man's Ionic Energy —
 * "You may put a card from the HQ on the bottom of the Hero Deck").
 *
 * Covers render gates (present only for the chooser), render-all-and-only the
 * projected eligible HQ cards (in slot order), pick move dispatch with the clicked
 * { cardId }, Decline dispatch with { decline: true }, the non-dismissible contract
 * (the only exits are a pick or Decline), and the no-double-submit guard
 * (handler early-return on isSubmitting; re-enable on the next frame).
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingOptionalPutBottomHQ } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import OptionalPutBottomHQPrompt from './OptionalPutBottomHQPrompt.vue';

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

const mockPending: UIPendingOptionalPutBottomHQ = {
  playerID: 'player-0',
  eligibleHqCards: [
    { cardId: 'hq-card-1', display: { extId: 'hq-card-1', name: 'HQ Card 1', imageUrl: 'https://example.com/1.jpg', cost: 3 } },
    { cardId: 'hq-card-2', display: { extId: 'hq-card-2', name: 'HQ Card 2', imageUrl: 'https://example.com/2.jpg', cost: 5 } },
  ],
};

describe('OptionalPutBottomHQPrompt (Ionic Energy fix)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="put-bottom-hq-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="put-bottom-hq-prompt"]').exists());
  });

  test('does not render when viewer is not the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="put-bottom-hq-prompt"]').exists());
  });

  test('does not render when viewer is a spectator (null playerId)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="put-bottom-hq-prompt"]').exists());
  });

  test('renders exactly the projected eligible HQ cards in slot order', () => {
    const { submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const cardButtons = wrapper.findAll('[data-testid^="put-bottom-hq-card-"]');
    assert.equal(cardButtons.length, mockPending.eligibleHqCards.length, 'one button per eligible HQ card');
    assert.equal(cardButtons[0]!.attributes('data-testid'), 'put-bottom-hq-card-hq-card-1');
    assert.equal(cardButtons[1]!.attributes('data-testid'), 'put-bottom-hq-card-hq-card-2');
  });

  test('clicking an eligible card fires resolveOptionalPutBottomHQ with that cardId (round-trip)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="put-bottom-hq-card-hq-card-2"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveOptionalPutBottomHQ');
    assert.deepEqual(calls[0]!.args, { cardId: 'hq-card-2' });
  });

  test('clicking Decline fires resolveOptionalPutBottomHQ with { decline: true }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="put-bottom-hq-decline"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveOptionalPutBottomHQ');
    assert.deepEqual(calls[0]!.args, { decline: true });
  });

  test('non-dismissible: the only controls are the eligible cards + Decline', () => {
    const { submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const allButtons = wrapper.findAll('button');
    assert.equal(allButtons.length, mockPending.eligibleHqCards.length + 1, 'no dismiss button beyond the HQ cards + Decline');
  });

  test('a same-frame double-click on a card fires the move exactly once (isSubmitting early-return)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="put-bottom-hq-card-hq-card-1"]');
    await btn.trigger('click');
    await btn.trigger('click');
    assert.equal(calls.length, 1, 'second click is a no-op (handler early-returns on isSubmitting)');
  });

  test('re-enables after the pending choice changes so the next queued choice is resolvable', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="put-bottom-hq-card-hq-card-1"]').trigger('click');
    assert.equal(calls.length, 1);

    const secondChoice: UIPendingOptionalPutBottomHQ = {
      playerID: 'player-0',
      eligibleHqCards: [
        { cardId: 'hq-card-3', display: { extId: 'hq-card-3', name: 'HQ Card 3', imageUrl: 'https://example.com/3.jpg', cost: 2 } },
      ],
    };
    await wrapper.setProps({ pendingOptionalPutBottomHQ: secondChoice });

    await wrapper.find('[data-testid="put-bottom-hq-card-hq-card-3"]').trigger('click');
    assert.equal(calls.length, 2, 'the next queued choice is resolvable (panel not frozen)');
    assert.deepEqual(calls[1]!.args, { cardId: 'hq-card-3' });
  });
});

describe('OptionalPutBottomHQPrompt — mandatory form (Absorb Ambient Power, D-24133)', () => {
  const mandatoryPending: UIPendingOptionalPutBottomHQ = {
    playerID: 'player-0',
    mandatory: true,
    eligibleHqCards: [
      { cardId: 'hq-card-1', display: { extId: 'hq-card-1', name: 'HQ Card 1', imageUrl: 'https://example.com/1.jpg', cost: 3 } },
    ],
  };

  test('hides the Decline button when mandatory', () => {
    const { submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: mandatoryPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="put-bottom-hq-decline"]').exists(), 'no Decline for a mandatory choice');
    // the card buttons are still present so the player can satisfy the required choice
    assert.ok(wrapper.find('[data-testid="put-bottom-hq-card-hq-card-1"]').exists());
  });

  test('shows the Decline button for the optional form', () => {
    const { submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="put-bottom-hq-decline"]').exists(), 'optional form keeps Decline');
  });

  test('picking a card still fires resolveOptionalPutBottomHQ with { cardId } in the mandatory form', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(OptionalPutBottomHQPrompt, {
      props: { pendingOptionalPutBottomHQ: mandatoryPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="put-bottom-hq-card-hq-card-1"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveOptionalPutBottomHQ');
    assert.deepEqual(calls[0]!.args, { cardId: 'hq-card-1' });
  });
});
