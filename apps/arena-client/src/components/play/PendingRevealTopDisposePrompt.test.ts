/**
 * Tests for the PendingRevealTopDisposePrompt component (WP-702 / EC-739).
 *
 * Covers render gates (present only for the active/chooser player), Discard and Keep
 * dispatch with the clicked { ownerPlayerID, cardId, disposition }, render-all-and-only the
 * projected revealedTops, same-frame double-click single-submit, and re-enable after the
 * pending choice changes (multi-card resolution / freeze regression).
 *
 * Mirrors PendingMelterKoChoicePrompt.test.ts. Uses node:test + @vue/test-utils.
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingRevealTopDispose } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import PendingRevealTopDisposePrompt from './PendingRevealTopDisposePrompt.vue';

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

const mockChoice: UIPendingRevealTopDispose = {
  choiceType: 'reveal-top-dispose',
  playerID: 'player-0',
  revealedTops: [
    {
      ownerPlayerID: 'player-0',
      cardId: 'test-wound',
      display: { extId: 'test-wound', name: 'Wound', imageUrl: 'https://example.com/wound.jpg', cost: 0 },
    },
    {
      ownerPlayerID: 'player-1',
      cardId: 'test-hero',
      display: { extId: 'test-hero', name: 'Test Hero', imageUrl: 'https://example.com/hero.jpg', cost: 5 },
    },
  ],
};

describe('PendingRevealTopDisposePrompt (WP-702 / EC-739)', () => {
  test('renders when the choice exists and the viewer is the active player', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingRevealTopDisposePrompt, {
      props: { pendingRevealTopDispose: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="pending-reveal-top-dispose-prompt"]').exists());
  });

  test('does not render when the choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingRevealTopDisposePrompt, {
      props: { pendingRevealTopDispose: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="pending-reveal-top-dispose-prompt"]').exists());
  });

  test('does not render for a non-chooser (opponent) or a spectator', () => {
    const { submitMove } = recorder();
    const opponent = mount(PendingRevealTopDisposePrompt, {
      props: { pendingRevealTopDispose: mockChoice, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!opponent.find('[data-testid="pending-reveal-top-dispose-prompt"]').exists(), 'opponent hidden');
    const spectator = mount(PendingRevealTopDisposePrompt, {
      props: { pendingRevealTopDispose: mockChoice, viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find('[data-testid="pending-reveal-top-dispose-prompt"]').exists(), 'spectator hidden');
  });

  test('renders exactly one row per revealed top (render-all-and-only)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingRevealTopDisposePrompt, {
      props: { pendingRevealTopDispose: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    const rows = wrapper.findAll('[data-testid^="pending-reveal-top-dispose-row-"]');
    assert.equal(rows.length, mockChoice.revealedTops.length, 'one row per revealed top');
    assert.ok(wrapper.find('[data-testid="pending-reveal-top-dispose-row-player-0-test-wound"]').exists());
    assert.ok(wrapper.find('[data-testid="pending-reveal-top-dispose-row-player-1-test-hero"]').exists());
  });

  test("clicking Discard dispatches resolveRevealTopDispose with { ownerPlayerID, cardId, disposition:'discard' }", async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingRevealTopDisposePrompt, {
      props: { pendingRevealTopDispose: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="pending-reveal-top-dispose-discard-player-0-test-wound"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveRevealTopDispose');
    assert.deepEqual(calls[0]!.args, { ownerPlayerID: 'player-0', cardId: 'test-wound', disposition: 'discard' });
  });

  test("clicking Keep dispatches resolveRevealTopDispose with { disposition:'top' } for the right owner", async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingRevealTopDisposePrompt, {
      props: { pendingRevealTopDispose: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="pending-reveal-top-dispose-keep-player-1-test-hero"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.args, { ownerPlayerID: 'player-1', cardId: 'test-hero', disposition: 'top' });
  });

  test('a same-frame double-click fires exactly once (isSubmitting early-return)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingRevealTopDisposePrompt, {
      props: { pendingRevealTopDispose: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="pending-reveal-top-dispose-discard-player-0-test-wound"]');
    await btn.trigger('click');
    await btn.trigger('click');
    assert.equal(calls.length, 1, 'second same-frame click is a no-op');
  });

  test('re-enables after the choice changes so the next revealed card is resolvable (freeze regression)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingRevealTopDisposePrompt, {
      props: { pendingRevealTopDispose: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="pending-reveal-top-dispose-discard-player-0-test-wound"]').trigger('click');
    assert.equal(calls.length, 1);

    // The engine drops the resolved entry; the next server frame delivers a fresh
    // choice object with only the remaining revealed card.
    const nextChoice: UIPendingRevealTopDispose = {
      choiceType: 'reveal-top-dispose',
      playerID: 'player-0',
      revealedTops: [
        {
          ownerPlayerID: 'player-1',
          cardId: 'test-hero',
          display: { extId: 'test-hero', name: 'Test Hero', imageUrl: 'https://example.com/hero.jpg', cost: 5 },
        },
      ],
    };
    await wrapper.setProps({ pendingRevealTopDispose: nextChoice });

    await wrapper.find('[data-testid="pending-reveal-top-dispose-keep-player-1-test-hero"]').trigger('click');
    assert.equal(calls.length, 2, 'the next revealed card is resolvable (panel not frozen)');
    assert.deepEqual(calls[1]!.args, { ownerPlayerID: 'player-1', cardId: 'test-hero', disposition: 'top' });
  });
});
