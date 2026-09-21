/**
 * Tests for the CoveringFireChoicePrompt component (WP-719 / EC-756 / D-24541 — Hawkeye's
 * "Covering Fire").
 *
 * Covers render gates (present only for the chooser), the binary Draw / Discard render with the
 * other-player-count label, move dispatch with { choice: 'draw' } / { choice: 'discard' }, and
 * the no-double-submit guard. Mirrors DoOverPrompt / DrawOrEmpoweredPrompt tests.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingCoveringFireChoice } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import CoveringFireChoicePrompt from './CoveringFireChoicePrompt.vue';

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

const mockPending: UIPendingCoveringFireChoice = {
  playerID: 'player-0',
  otherPlayerCount: 2,
};

describe('CoveringFireChoicePrompt (WP-719 / EC-756)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CoveringFireChoicePrompt, {
      props: { pendingCoveringFireChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="covering-fire-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CoveringFireChoicePrompt, {
      props: { pendingCoveringFireChoice: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="covering-fire-prompt"]').exists());
  });

  test('does not render for a non-chooser or a spectator', () => {
    const { submitMove } = recorder();
    const opponent = mount(CoveringFireChoicePrompt, {
      props: { pendingCoveringFireChoice: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!opponent.find('[data-testid="covering-fire-prompt"]').exists());
    const spectator = mount(CoveringFireChoicePrompt, {
      props: { pendingCoveringFireChoice: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find('[data-testid="covering-fire-prompt"]').exists());
  });

  test('renders a Draw button and a Discard button, each labeled with the other-player count', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CoveringFireChoicePrompt, {
      props: { pendingCoveringFireChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const draw = wrapper.find('[data-testid="covering-fire-draw"]');
    const discard = wrapper.find('[data-testid="covering-fire-discard"]');
    assert.ok(draw.exists());
    assert.match(draw.text(), /Each of 2 other player\(s\) draws a card/);
    assert.ok(discard.exists());
    assert.match(discard.text(), /Each of 2 other player\(s\) discards a card/);
  });

  test('clicking Draw fires resolveCoveringFireChoice with { choice: "draw" }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(CoveringFireChoicePrompt, {
      props: { pendingCoveringFireChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="covering-fire-draw"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveCoveringFireChoice');
    assert.deepEqual(calls[0]!.args, { choice: 'draw' });
  });

  test('clicking Discard fires resolveCoveringFireChoice with { choice: "discard" }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(CoveringFireChoicePrompt, {
      props: { pendingCoveringFireChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="covering-fire-discard"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveCoveringFireChoice');
    assert.deepEqual(calls[0]!.args, { choice: 'discard' });
  });

  test('does not double-submit on rapid clicks (isSubmitting guard)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(CoveringFireChoicePrompt, {
      props: { pendingCoveringFireChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const button = wrapper.find('[data-testid="covering-fire-draw"]');
    await button.trigger('click');
    await button.trigger('click');
    assert.equal(calls.length, 1, 'only one submit despite two clicks');
  });
});
