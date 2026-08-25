/**
 * Tests for the PendingMelterKoChoicePrompt component (WP-603 / EC-638).
 *
 * Covers render gates (present only for the fighting/chooser player), KO and Keep
 * dispatch with the clicked { ownerPlayerID, cardId, keep }, render-all-and-only the
 * projected revealedTops, same-frame double-click single-submit, and re-enable after
 * the pending choice changes (multi-card resolution / freeze regression).
 *
 * This is the component test the scry-ko prompt never had (the WP-603 gap-fill).
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingMelterKoChoice } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import PendingMelterKoChoicePrompt from './PendingMelterKoChoicePrompt.vue';

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

const mockChoice: UIPendingMelterKoChoice = {
  choiceType: 'melter-ko',
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

describe('PendingMelterKoChoicePrompt (WP-603 / EC-638)', () => {
  test('renders when the choice exists and the viewer is the fighting player', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingMelterKoChoicePrompt, {
      props: { pendingMelterKoChoice: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="pending-melter-ko-choice-prompt"]').exists());
  });

  test('does not render when the choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingMelterKoChoicePrompt, {
      props: { pendingMelterKoChoice: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="pending-melter-ko-choice-prompt"]').exists());
  });

  test('does not render for a non-chooser (opponent) or a spectator', () => {
    const { submitMove } = recorder();
    const opponent = mount(PendingMelterKoChoicePrompt, {
      props: { pendingMelterKoChoice: mockChoice, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!opponent.find('[data-testid="pending-melter-ko-choice-prompt"]').exists(), 'opponent hidden');
    const spectator = mount(PendingMelterKoChoicePrompt, {
      props: { pendingMelterKoChoice: mockChoice, viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find('[data-testid="pending-melter-ko-choice-prompt"]').exists(), 'spectator hidden');
  });

  test('renders exactly one row per revealed top (render-all-and-only)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingMelterKoChoicePrompt, {
      props: { pendingMelterKoChoice: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    const rows = wrapper.findAll('[data-testid^="pending-melter-ko-choice-row-"]');
    assert.equal(rows.length, mockChoice.revealedTops.length, 'one row per revealed top');
    assert.ok(wrapper.find('[data-testid="pending-melter-ko-choice-row-player-0-test-wound"]').exists());
    assert.ok(wrapper.find('[data-testid="pending-melter-ko-choice-row-player-1-test-hero"]').exists());
  });

  test('clicking KO dispatches resolveMelterKoChoice with { ownerPlayerID, cardId, keep:false }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingMelterKoChoicePrompt, {
      props: { pendingMelterKoChoice: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="pending-melter-ko-choice-ko-player-0-test-wound"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveMelterKoChoice');
    assert.deepEqual(calls[0]!.args, { ownerPlayerID: 'player-0', cardId: 'test-wound', keep: false });
  });

  test('clicking Keep dispatches resolveMelterKoChoice with { keep:true } for the right owner', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingMelterKoChoicePrompt, {
      props: { pendingMelterKoChoice: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="pending-melter-ko-choice-keep-player-1-test-hero"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.args, { ownerPlayerID: 'player-1', cardId: 'test-hero', keep: true });
  });

  test('a same-frame double-click fires exactly once (isSubmitting early-return)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingMelterKoChoicePrompt, {
      props: { pendingMelterKoChoice: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="pending-melter-ko-choice-ko-player-0-test-wound"]');
    await btn.trigger('click');
    await btn.trigger('click');
    assert.equal(calls.length, 1, 'second same-frame click is a no-op');
  });

  test('re-enables after the choice changes so the next revealed card is resolvable (freeze regression)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingMelterKoChoicePrompt, {
      props: { pendingMelterKoChoice: mockChoice, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="pending-melter-ko-choice-ko-player-0-test-wound"]').trigger('click');
    assert.equal(calls.length, 1);

    // The engine drops the resolved entry; the next server frame delivers a fresh
    // choice object with only the remaining revealed card.
    const nextChoice: UIPendingMelterKoChoice = {
      choiceType: 'melter-ko',
      playerID: 'player-0',
      revealedTops: [
        {
          ownerPlayerID: 'player-1',
          cardId: 'test-hero',
          display: { extId: 'test-hero', name: 'Test Hero', imageUrl: 'https://example.com/hero.jpg', cost: 5 },
        },
      ],
    };
    await wrapper.setProps({ pendingMelterKoChoice: nextChoice });

    await wrapper.find('[data-testid="pending-melter-ko-choice-keep-player-1-test-hero"]').trigger('click');
    assert.equal(calls.length, 2, 'the next revealed card is resolvable (panel not frozen)');
    assert.deepEqual(calls[1]!.args, { ownerPlayerID: 'player-1', cardId: 'test-hero', keep: true });
  });
});
