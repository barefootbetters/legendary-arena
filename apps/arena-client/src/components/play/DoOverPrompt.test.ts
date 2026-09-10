/**
 * Tests for the DoOverPrompt component (WP-681 / EC-718 / D-24498).
 *
 * Covers render gates (present only for the chooser), the binary Accept / Decline render
 * with the concrete cost label, move dispatch with { accept: true } / { decline: true }, and
 * the no-double-submit guard. Mirrors DrawOrEmpoweredPrompt / SmashDiscardPrompt tests.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingDoOver } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import DoOverPrompt from './DoOverPrompt.vue';

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

const mockPending: UIPendingDoOver = {
  playerID: 'player-0',
  handSize: 3,
  drawCount: 4,
};

describe('DoOverPrompt (WP-681 / EC-718)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(DoOverPrompt, {
      props: { pendingDoOver: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="do-over-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(DoOverPrompt, {
      props: { pendingDoOver: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="do-over-prompt"]').exists());
  });

  test('does not render for a non-chooser or a spectator', () => {
    const { submitMove } = recorder();
    const opponent = mount(DoOverPrompt, {
      props: { pendingDoOver: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!opponent.find('[data-testid="do-over-prompt"]').exists());
    const spectator = mount(DoOverPrompt, {
      props: { pendingDoOver: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find('[data-testid="do-over-prompt"]').exists());
  });

  test('renders an Accept button (with the hand-size cost) and a Decline button', () => {
    const { submitMove } = recorder();
    const wrapper = mount(DoOverPrompt, {
      props: { pendingDoOver: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const accept = wrapper.find('[data-testid="do-over-accept"]');
    assert.ok(accept.exists());
    assert.match(accept.text(), /Discard 3 card\(s\) and draw 4/);
    assert.ok(wrapper.find('[data-testid="do-over-decline"]').exists());
  });

  test('clicking Accept fires resolveDoOver with { accept: true }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(DoOverPrompt, {
      props: { pendingDoOver: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="do-over-accept"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveDoOver');
    assert.deepEqual(calls[0]!.args, { accept: true });
  });

  test('clicking Decline fires resolveDoOver with { decline: true }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(DoOverPrompt, {
      props: { pendingDoOver: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="do-over-decline"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveDoOver');
    assert.deepEqual(calls[0]!.args, { decline: true });
  });

  test('does not double-submit on rapid clicks (isSubmitting guard)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(DoOverPrompt, {
      props: { pendingDoOver: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const button = wrapper.find('[data-testid="do-over-accept"]');
    await button.trigger('click');
    await button.trigger('click');
    assert.equal(calls.length, 1, 'only one submit despite two clicks');
  });
});
