/**
 * Tests for the SplitFaceChoicePrompt component (WP-725 / EC-762 / D-24546 — the client half of
 * the split / dual-faced hero "choose a side" mechanic that un-defers D-14101).
 *
 * Covers the render gates (present only for the chooser; hidden for a non-chooser / spectator /
 * when undefined), the two-face render (name + economy), ability text routed through AbilityText
 * (never raw marker syntax), move dispatch with { face: 'a' } / { face: 'b' }, and the
 * no-double-submit guard. Mirrors CoveringFireChoicePrompt tests.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingSplitFaceChoice } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import SplitFaceChoicePrompt from './SplitFaceChoicePrompt.vue';
import AbilityText from './AbilityText.vue';

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

const mockPending: UIPendingSplitFaceChoice = {
  playerID: 'player-0',
  faceA: { extId: 'cvwr/peter-parker/hot-bowl-of-soup#0', name: 'Hot Bowl of Soup', abilityText: 'You may KO a Wound from your hand or discard pile. [keyword:ko-wound]', cost: 2, attack: 0, recruit: 1 },
  faceB: { extId: 'cvwr/peter-parker/protect-my-family#0', name: 'Protect My Family', abilityText: 'Rescue a Bystander. [keyword:rescue:1]', cost: 2, attack: 1, recruit: 0 },
};

describe('SplitFaceChoicePrompt (WP-725 / EC-762)', () => {
  test('renders when a pending choice exists and the viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="arena-hud-split-face-choice"]').exists());
    // both faces' names render
    assert.match(wrapper.text(), /Hot Bowl of Soup/);
    assert.match(wrapper.text(), /Protect My Family/);
  });

  test('does not render when the pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="arena-hud-split-face-choice"]').exists());
  });

  test('does not render for a non-chooser or a spectator', () => {
    const { submitMove } = recorder();
    const opponent = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!opponent.find('[data-testid="arena-hud-split-face-choice"]').exists());
    const spectator = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find('[data-testid="arena-hud-split-face-choice"]').exists());
  });

  test('routes each face ability text through AbilityText (never raw marker syntax)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    // one AbilityText per face (both faces carry ability text)
    assert.equal(wrapper.findAllComponents(AbilityText).length, 2);
  });

  test('clicking face A submits resolveSplitFaceChoice({ face: "a" })', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="split-face-a"]').trigger('click');
    assert.deepEqual(calls, [{ name: 'resolveSplitFaceChoice', args: { face: 'a' } }]);
  });

  test('clicking face B submits resolveSplitFaceChoice({ face: "b" })', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="split-face-b"]').trigger('click');
    assert.deepEqual(calls, [{ name: 'resolveSplitFaceChoice', args: { face: 'b' } }]);
  });

  test('does not submit twice for one choice (double-submit guard)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="split-face-a"]').trigger('click');
    await wrapper.find('[data-testid="split-face-b"]').trigger('click');
    assert.equal(calls.length, 1, 'the second click is ignored while submitting');
  });
});
