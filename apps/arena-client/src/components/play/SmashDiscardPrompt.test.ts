/**
 * Tests for the SmashDiscardPrompt component (WP-676 / EC-713 / D-24492).
 *
 * Covers render gates (present only for the chooser), the per-card render (one Discard
 * button per eligible hand card + a first-class Decline), move dispatch with the right
 * { cardId } / { decline: true }, and the no-double-submit guard. Mirrors
 * OptionalKoRewardPrompt / CountScaledChoicePrompt tests.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingSmashDiscard } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import SmashDiscardPrompt from './SmashDiscardPrompt.vue';

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

const mockPending: UIPendingSmashDiscard = {
  playerID: 'player-0',
  magnitude: 2,
  eligibleHand: [
    { zone: 'hand', cardId: 'card-a', display: { extId: 'card-a', name: 'Card A', imageUrl: '', cost: 1 } },
    { zone: 'hand', cardId: 'card-b', display: { extId: 'card-b', name: 'Card B', imageUrl: '', cost: 3 } },
  ],
};

describe('SmashDiscardPrompt (WP-676 / EC-713)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SmashDiscardPrompt, {
      props: { pendingSmashDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="smash-discard-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SmashDiscardPrompt, {
      props: { pendingSmashDiscard: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="smash-discard-prompt"]').exists());
  });

  test('does not render for a non-chooser or a spectator', () => {
    const { submitMove } = recorder();
    const opponent = mount(SmashDiscardPrompt, {
      props: { pendingSmashDiscard: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!opponent.find('[data-testid="smash-discard-prompt"]').exists());
    const spectator = mount(SmashDiscardPrompt, {
      props: { pendingSmashDiscard: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find('[data-testid="smash-discard-prompt"]').exists());
  });

  test('renders one Discard button per eligible hand card plus a Decline button', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SmashDiscardPrompt, {
      props: { pendingSmashDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="smash-discard-card-card-a"]').exists());
    assert.ok(wrapper.find('[data-testid="smash-discard-card-card-b"]').exists());
    assert.ok(wrapper.find('[data-testid="smash-discard-decline"]').exists());
  });

  test('clicking a hand card fires resolveSmashDiscard with its { cardId }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(SmashDiscardPrompt, {
      props: { pendingSmashDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="smash-discard-card-card-b"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveSmashDiscard');
    assert.deepEqual(calls[0]!.args, { cardId: 'card-b' });
  });

  test('clicking Decline fires resolveSmashDiscard with { decline: true }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(SmashDiscardPrompt, {
      props: { pendingSmashDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="smash-discard-decline"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveSmashDiscard');
    assert.deepEqual(calls[0]!.args, { decline: true });
  });

  test('does not double-submit on rapid clicks (isSubmitting guard)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(SmashDiscardPrompt, {
      props: { pendingSmashDiscard: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const button = wrapper.find('[data-testid="smash-discard-card-card-a"]');
    await button.trigger('click');
    await button.trigger('click');
    assert.equal(calls.length, 1, 'the second click is guarded');
  });
});
