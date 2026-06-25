/**
 * Tests for the DrawOrEmpoweredPrompt component (WP-287 / EC-319).
 *
 * Covers render gates (present only for the chooser), the two-button render
 * ("Draw a card" + the projected empoweredLabel), move dispatch with the right
 * { choice }, the non-dismissible contract (the only exits are the two buttons —
 * no close affordance), and the no-double-submit guard (handler early-return on
 * isSubmitting; re-enable on the next frame).
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingDrawOrEmpowered } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import DrawOrEmpoweredPrompt from './DrawOrEmpoweredPrompt.vue';

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

const mockPending: UIPendingDrawOrEmpowered = {
  playerID: 'player-0',
  empoweredLabel: 'Empowered by Strength',
};

describe('DrawOrEmpoweredPrompt (WP-287 / EC-319)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(DrawOrEmpoweredPrompt, {
      props: { pendingDrawOrEmpowered: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="draw-or-empowered-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(DrawOrEmpoweredPrompt, {
      props: { pendingDrawOrEmpowered: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="draw-or-empowered-prompt"]').exists());
  });

  test('does not render when viewer is not the chooser (AC-2)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(DrawOrEmpoweredPrompt, {
      props: { pendingDrawOrEmpowered: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="draw-or-empowered-prompt"]').exists());
  });

  test('does not render when viewer is a spectator (null playerId)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(DrawOrEmpoweredPrompt, {
      props: { pendingDrawOrEmpowered: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="draw-or-empowered-prompt"]').exists());
  });

  test('renders exactly two buttons — "Draw a card" + the projected empoweredLabel (AC-5)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(DrawOrEmpoweredPrompt, {
      props: { pendingDrawOrEmpowered: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const buttons = wrapper.findAll('button');
    assert.equal(buttons.length, 2, 'exactly two choice buttons, no dismiss/close affordance');
    assert.equal(wrapper.find('[data-testid="draw-or-empowered-draw"]').text(), 'Draw a card');
    assert.equal(wrapper.find('[data-testid="draw-or-empowered-empowered"]').text(), 'Empowered by Strength');
  });

  test('clicking "Draw a card" fires resolveDrawOrEmpowered with { choice: "draw" } (AC-5)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(DrawOrEmpoweredPrompt, {
      props: { pendingDrawOrEmpowered: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="draw-or-empowered-draw"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveDrawOrEmpowered');
    assert.deepEqual(calls[0]!.args, { choice: 'draw' });
  });

  test('clicking the empowered button fires resolveDrawOrEmpowered with { choice: "empowered" } (AC-5)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(DrawOrEmpoweredPrompt, {
      props: { pendingDrawOrEmpowered: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="draw-or-empowered-empowered"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveDrawOrEmpowered');
    assert.deepEqual(calls[0]!.args, { choice: 'empowered' });
  });

  test('non-dismissible: the only controls are the two choice buttons (no close/cancel affordance) (AC-5)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(DrawOrEmpoweredPrompt, {
      props: { pendingDrawOrEmpowered: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.equal(wrapper.findAll('button').length, 2, 'no dismiss/close button beyond the two choices');
  });

  test('a same-frame double-click fires resolveDrawOrEmpowered exactly once (isSubmitting early-return)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(DrawOrEmpoweredPrompt, {
      props: { pendingDrawOrEmpowered: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="draw-or-empowered-draw"]');
    await btn.trigger('click');
    await btn.trigger('click');
    assert.equal(calls.length, 1, 'second click is a no-op (handler early-returns on isSubmitting)');
  });

  test('pressing the second button after the first in the same frame is a no-op (no double-submit) (AC-5)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(DrawOrEmpoweredPrompt, {
      props: { pendingDrawOrEmpowered: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="draw-or-empowered-draw"]').trigger('click');
    await wrapper.find('[data-testid="draw-or-empowered-empowered"]').trigger('click');
    assert.equal(calls.length, 1, 'the empowered button is blocked after a draw submit in the same frame');
  });

  test('re-enables after the pending choice changes so the next queued choice is resolvable', async () => {
    // why: the prompt is kept mounted for the whole match by the parent page (only
    // its inner content is v-if'd), so isSubmitting must reset when a new
    // pendingDrawOrEmpowered arrives. Without the reset the panel would freeze under
    // WP-286's block-all guard.
    const { calls, submitMove } = recorder();
    const wrapper = mount(DrawOrEmpoweredPrompt, {
      props: { pendingDrawOrEmpowered: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="draw-or-empowered-draw"]').trigger('click');
    assert.equal(calls.length, 1);

    const secondChoice: UIPendingDrawOrEmpowered = {
      playerID: 'player-0',
      empoweredLabel: 'Empowered by Tech',
    };
    await wrapper.setProps({ pendingDrawOrEmpowered: secondChoice });

    await wrapper.find('[data-testid="draw-or-empowered-empowered"]').trigger('click');
    assert.equal(calls.length, 2, 'the next queued choice is resolvable (panel not frozen)');
    assert.deepEqual(calls[1]!.args, { choice: 'empowered' });
  });
});
