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
  leftFace: 'a',
};

// why: cvwr Captain America, Secret Avenger — sides[] is ["inspire-a-man", "inspire-a-nation"]
// but Inspire a Nation (slot 2) is printed on the LEFT half, so the engine projects leftFace 'b'.
const reversedPending: UIPendingSplitFaceChoice = {
  playerID: 'player-0',
  faceA: { extId: 'cvwr/captain-america-secret-avenger/inspire-a-man#0', name: 'Inspire a Man', cost: 4, attack: 2, recruit: 0 },
  faceB: { extId: 'cvwr/captain-america-secret-avenger/inspire-a-nation#0', name: 'Inspire a Nation', cost: 4, attack: 0, recruit: 2 },
  leftFace: 'b',
};

/** The face ids of the rendered buttons, in DOM (left-to-right) order. */
function renderedFaceOrder(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('button').map((button) => button.attributes('data-testid') ?? '');
}

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

  test('renders face A first when leftFace is "a"', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.deepEqual(renderedFaceOrder(wrapper), ['split-face-a', 'split-face-b']);
  });

  test('renders the printed-left face B first for a reversed card, and each button still submits its own face', async () => {
    const left = recorder();
    const wrapper = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: reversedPending, viewerPlayerId: 'player-0', submitMove: left.submitMove },
    });
    assert.deepEqual(renderedFaceOrder(wrapper), ['split-face-b', 'split-face-a'], 'Inspire a Nation (left half) renders first');
    const buttons = wrapper.findAll('button');
    assert.match(buttons[0]!.text(), /Inspire a Nation/);
    assert.match(buttons[1]!.text(), /Inspire a Man/);
    await buttons[0]!.trigger('click');
    assert.deepEqual(left.calls, [{ name: 'resolveSplitFaceChoice', args: { face: 'b' } }], 'the left button submits face b');

    const right = recorder();
    const second = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: reversedPending, viewerPlayerId: 'player-0', submitMove: right.submitMove },
    });
    await second.findAll('button')[1]!.trigger('click');
    assert.deepEqual(right.calls, [{ name: 'resolveSplitFaceChoice', args: { face: 'a' } }], 'the right button submits face a');
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

  // ---------------------------------------------------------------------------
  // WP-778 / D-24615 — a side's discard-to-play cost (bkwd Attune / Atone)
  // ---------------------------------------------------------------------------

  /** Attune (face a, costed) / Atone (face b, free), with the served WP-777 fields. */
  function attunePending(discardToPlayCost: number, isSelectable: boolean): UIPendingSplitFaceChoice {
    return {
      playerID: 'player-0',
      faceA: { extId: 'bkwd/falcon-winter-soldier/attune#0', name: 'Attune', cost: 3, attack: 0, recruit: 3, isSelectable, discardToPlayCost },
      faceB: { extId: 'bkwd/falcon-winter-soldier/atone#0', name: 'Atone', cost: 3, attack: 0, recruit: 0, isSelectable: true, discardToPlayCost: 0 },
      leftFace: 'a',
    };
  }

  test('a one-card discard cost shows "Discard a card to play this side"', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: attunePending(1, true), viewerPlayerId: 'player-0', submitMove },
    });
    assert.equal(wrapper.find('[data-testid="split-face-a-cost"]').text(), 'Discard a card to play this side');
    assert.ok(!wrapper.find('[data-testid="split-face-a-blocked"]').exists(), 'a payable side shows no blocked hint');
    assert.equal(wrapper.find('[data-testid="split-face-a"]').attributes('disabled'), undefined, 'a payable side is enabled');
  });

  test('a two-card cost the hand cannot pay shows the plural cost line and "Not enough cards in hand to discard"', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: attunePending(2, false), viewerPlayerId: 'player-0', submitMove },
    });
    assert.equal(wrapper.find('[data-testid="split-face-a-cost"]').text(), 'Discard 2 cards to play this side');
    assert.equal(wrapper.find('[data-testid="split-face-a-blocked"]').text(), 'Not enough cards in hand to discard');
  });

  test('absent fields and a zero cost render as before WP-778: no cost line, no hint, enabled', () => {
    const { submitMove } = recorder();
    const absent = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const zeroCost = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: attunePending(1, true), viewerPlayerId: 'player-0', submitMove },
    });
    for (const face of ['a', 'b'] as const) {
      assert.ok(!absent.find(`[data-testid="split-face-${face}-cost"]`).exists(), `no cost line on face ${face} without the fields`);
      assert.ok(!absent.find(`[data-testid="split-face-${face}-blocked"]`).exists(), `no hint on face ${face} without the fields`);
      assert.equal(absent.find(`[data-testid="split-face-${face}"]`).attributes('disabled'), undefined, `face ${face} enabled`);
    }
    assert.ok(!zeroCost.find('[data-testid="split-face-b-cost"]').exists(), 'a zero-cost side (Atone) shows no cost line');
  });

  test('an unselectable side is disabled with "No card in hand to discard" and never submits, even with disabled removed', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: attunePending(1, false), viewerPlayerId: 'player-0', submitMove },
    });
    const attune = wrapper.find('[data-testid="split-face-a"]');
    assert.notEqual(attune.attributes('disabled'), undefined, 'the unselectable side is disabled');
    assert.equal(attune.attributes('aria-disabled'), 'true', 'aria-disabled mirrors disabled');
    assert.equal(wrapper.find('[data-testid="split-face-a-blocked"]').text(), 'No card in hand to discard');
    // why: @vue/test-utils skips trigger() on a disabled element, so a plain click cannot prove the
    // onChoose guard — remove the attribute to force the click through to the handler.
    (attune.element as HTMLButtonElement).removeAttribute('disabled');
    await attune.trigger('click');
    assert.deepEqual(calls, [], 'the onChoose guard refuses the unselectable side');
  });

  test('a blocked click does not set the submit latch: the other side then submits exactly once', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(SplitFaceChoicePrompt, {
      props: { pendingSplitFaceChoice: attunePending(1, false), viewerPlayerId: 'player-0', submitMove },
    });
    const attune = wrapper.find('[data-testid="split-face-a"]');
    (attune.element as HTMLButtonElement).removeAttribute('disabled');
    await attune.trigger('click');
    await wrapper.find('[data-testid="split-face-b"]').trigger('click');
    assert.deepEqual(calls, [{ name: 'resolveSplitFaceChoice', args: { face: 'b' } }]);
  });
});
