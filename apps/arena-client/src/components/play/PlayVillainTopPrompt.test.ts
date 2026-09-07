/**
 * Tests for the PlayVillainTopPrompt component (WP-663 / EC-700).
 *
 * Covers render gates (present only for the chooser), the two-button render (accept +
 * decline), move dispatch with the right { accept } payload, the non-dismissible contract
 * (the only exits are the two buttons — no close affordance), and the no-double-submit
 * guard (handler early-return on isSubmitting; re-enable on the next frame).
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingPlayVillainTop } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import PlayVillainTopPrompt from './PlayVillainTopPrompt.vue';

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

const mockPending: UIPendingPlayVillainTop = {
  playerID: 'player-0',
  attackReward: 2,
};

describe('PlayVillainTopPrompt (WP-663 / EC-700)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PlayVillainTopPrompt, {
      props: { pendingPlayVillainTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="play-villain-top-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PlayVillainTopPrompt, {
      props: { pendingPlayVillainTop: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="play-villain-top-prompt"]').exists());
  });

  test('does not render when viewer is not the chooser (AC-8)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PlayVillainTopPrompt, {
      props: { pendingPlayVillainTop: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="play-villain-top-prompt"]').exists());
  });

  test('does not render when viewer is a spectator (null playerId)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PlayVillainTopPrompt, {
      props: { pendingPlayVillainTop: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="play-villain-top-prompt"]').exists());
  });

  test('renders exactly two buttons — accept (with the projected +N Attack) + decline (AC-8)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PlayVillainTopPrompt, {
      props: { pendingPlayVillainTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const buttons = wrapper.findAll('button');
    assert.equal(buttons.length, 2, 'exactly two choice buttons, no dismiss/close affordance');
    assert.match(wrapper.find('[data-testid="play-villain-top-accept"]').text(), /\+2 Attack/);
    assert.equal(wrapper.find('[data-testid="play-villain-top-decline"]').text(), 'Decline');
  });

  test('clicking accept fires resolvePlayVillainTopChoice with { accept: true } (AC-8)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PlayVillainTopPrompt, {
      props: { pendingPlayVillainTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="play-villain-top-accept"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolvePlayVillainTopChoice');
    assert.deepEqual(calls[0]!.args, { accept: true });
  });

  test('clicking decline fires resolvePlayVillainTopChoice with { accept: false } (AC-8)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PlayVillainTopPrompt, {
      props: { pendingPlayVillainTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="play-villain-top-decline"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolvePlayVillainTopChoice');
    assert.deepEqual(calls[0]!.args, { accept: false });
  });

  test('non-dismissible: the only controls are the two choice buttons (no close/cancel affordance) (AC-8)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PlayVillainTopPrompt, {
      props: { pendingPlayVillainTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.equal(wrapper.findAll('button').length, 2, 'no dismiss/close button beyond the two choices');
  });

  test('a same-frame double-click fires resolvePlayVillainTopChoice exactly once (isSubmitting early-return)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PlayVillainTopPrompt, {
      props: { pendingPlayVillainTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="play-villain-top-accept"]');
    await btn.trigger('click');
    await btn.trigger('click');
    assert.equal(calls.length, 1, 'second click is a no-op (handler early-returns on isSubmitting)');
  });

  test('pressing decline after accept in the same frame is a no-op (no double-submit) (AC-8)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PlayVillainTopPrompt, {
      props: { pendingPlayVillainTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="play-villain-top-accept"]').trigger('click');
    await wrapper.find('[data-testid="play-villain-top-decline"]').trigger('click');
    assert.equal(calls.length, 1, 'the decline button is blocked after an accept submit in the same frame');
  });

  test('re-enables after the pending choice changes so the next queued choice is resolvable', async () => {
    // why: the prompt is kept mounted for the whole match by the parent page (only its
    // inner content is v-if'd), so isSubmitting must reset when a new pendingPlayVillainTop
    // arrives. Without the reset the panel would freeze under the block-all guard.
    const { calls, submitMove } = recorder();
    const wrapper = mount(PlayVillainTopPrompt, {
      props: { pendingPlayVillainTop: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="play-villain-top-accept"]').trigger('click');
    assert.equal(calls.length, 1);

    const secondChoice: UIPendingPlayVillainTop = { playerID: 'player-0', attackReward: 2 };
    await wrapper.setProps({ pendingPlayVillainTop: secondChoice });

    await wrapper.find('[data-testid="play-villain-top-decline"]').trigger('click');
    assert.equal(calls.length, 2, 'the next queued choice is resolvable (panel not frozen)');
    assert.deepEqual(calls[1]!.args, { accept: false });
  });
});
