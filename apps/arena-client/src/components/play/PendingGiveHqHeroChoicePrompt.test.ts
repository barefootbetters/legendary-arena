/**
 * Tests for the PendingGiveHqHeroChoicePrompt component (WP-532 / EC-567).
 *
 * Covers render gates (present only for the chooser, hidden for opponents /
 * spectators / when absent), render-all-and-only the projected eligible HQ
 * Heroes, move dispatch with the clicked { cardId }, same-frame double-click
 * single-submit (handler early-return on isSubmitting), the re-enable after the
 * choice changes, and the fail-safe empty-eligible case.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIState } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import PendingGiveHqHeroChoicePrompt from './PendingGiveHqHeroChoicePrompt.vue';

type UIPendingGiveHqHeroChoice = NonNullable<UIState['pendingGiveHqHeroChoice']>;

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

const mockPendingChoice: UIPendingGiveHqHeroChoice = {
  choiceType: 'give-hq-hero',
  playerID: 'player-0',
  eligible: [
    {
      cardId: 'hq-slot-0-hero-1',
      display: { extId: 'test-hero-1', name: 'Test Hero 1', imageUrl: 'https://example.com/hero1.jpg', cost: 5 },
    },
    {
      cardId: 'hq-slot-1-hero-2',
      display: { extId: 'test-hero-2', name: 'Test Hero 2', imageUrl: 'https://example.com/hero2.jpg', cost: 6 },
    },
  ],
};

describe('PendingGiveHqHeroChoicePrompt (WP-532 / EC-567)', () => {
  test('renders when pending choice exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingGiveHqHeroChoicePrompt, {
      props: { pendingGiveHqHeroChoice: mockPendingChoice, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="pending-give-hq-hero-choice-prompt"]').exists());
  });

  test('does not render when pending choice is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingGiveHqHeroChoicePrompt, {
      props: { pendingGiveHqHeroChoice: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="pending-give-hq-hero-choice-prompt"]').exists());
  });

  test('does not render when viewer is not the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingGiveHqHeroChoicePrompt, {
      props: { pendingGiveHqHeroChoice: mockPendingChoice, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="pending-give-hq-hero-choice-prompt"]').exists());
  });

  test('does not render when viewer is a spectator (null playerId)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingGiveHqHeroChoicePrompt, {
      props: { pendingGiveHqHeroChoice: mockPendingChoice, viewerPlayerId: null, submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="pending-give-hq-hero-choice-prompt"]').exists());
  });

  test('renders exactly the projected eligible HQ Heroes (render-all-and-only)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingGiveHqHeroChoicePrompt, {
      props: { pendingGiveHqHeroChoice: mockPendingChoice, viewerPlayerId: 'player-0', submitMove },
    });
    const buttons = wrapper.findAll('[data-testid^="pending-give-hq-hero-choice-card-"]');
    assert.equal(buttons.length, mockPendingChoice.eligible.length, 'one button per eligible entry');
    assert.ok(wrapper.find('[data-testid="pending-give-hq-hero-choice-card-hq-slot-0-hero-1"]').exists());
    assert.ok(wrapper.find('[data-testid="pending-give-hq-hero-choice-card-hq-slot-1-hero-2"]').exists());
    assert.ok(wrapper.text().includes('Test Hero 1'));
    assert.ok(wrapper.text().includes('Test Hero 2'));
  });

  test('clicking an eligible HQ Hero fires resolveGiveHqHeroChoice with that cardId', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingGiveHqHeroChoicePrompt, {
      props: { pendingGiveHqHeroChoice: mockPendingChoice, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="pending-give-hq-hero-choice-card-hq-slot-1-hero-2"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveGiveHqHeroChoice');
    assert.deepEqual(calls[0]!.args, { cardId: 'hq-slot-1-hero-2' });
  });

  test('a same-frame double-click fires resolveGiveHqHeroChoice exactly once (isSubmitting early-return)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingGiveHqHeroChoicePrompt, {
      props: { pendingGiveHqHeroChoice: mockPendingChoice, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="pending-give-hq-hero-choice-card-hq-slot-0-hero-1"]');
    await btn.trigger('click');
    await btn.trigger('click');
    assert.equal(calls.length, 1, 'second click is a no-op (handler early-returns on isSubmitting)');
  });

  test('re-enables after the pending choice changes so the next Fight is resolvable (freeze regression)', async () => {
    // why: the prompt is kept mounted for the whole match by the parent page
    // (only its inner content is v-if'd), so isSubmitting must reset when a new
    // choice arrives. Without the reset, a later give-HQ-Hero choice in the same
    // match rendered with disabled buttons, freezing the board under the block-all guard.
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingGiveHqHeroChoicePrompt, {
      props: { pendingGiveHqHeroChoice: mockPendingChoice, viewerPlayerId: 'player-0', submitMove },
    });

    await wrapper.find('[data-testid="pending-give-hq-hero-choice-card-hq-slot-0-hero-1"]').trigger('click');
    assert.equal(calls.length, 1);

    const secondChoice: UIPendingGiveHqHeroChoice = {
      choiceType: 'give-hq-hero',
      playerID: 'player-0',
      eligible: [
        {
          cardId: 'hq-slot-2-hero-3',
          display: { extId: 'test-hero-3', name: 'Test Hero 3', imageUrl: 'https://example.com/hero3.jpg', cost: 4 },
        },
      ],
    };
    await wrapper.setProps({ pendingGiveHqHeroChoice: secondChoice });

    await wrapper.find('[data-testid="pending-give-hq-hero-choice-card-hq-slot-2-hero-3"]').trigger('click');
    assert.equal(calls.length, 2, 'the next give-HQ-Hero choice is resolvable (panel not frozen)');
    assert.deepEqual(calls[1]!.args, { cardId: 'hq-slot-2-hero-3' });
  });

  test('fail-safe: an empty eligible list renders no actionable entry and fires no move', () => {
    const { calls, submitMove } = recorder();
    const emptyChoice: UIPendingGiveHqHeroChoice = {
      choiceType: 'give-hq-hero',
      playerID: 'player-0',
      eligible: [],
    };
    const wrapper = mount(PendingGiveHqHeroChoicePrompt, {
      props: { pendingGiveHqHeroChoice: emptyChoice, viewerPlayerId: 'player-0', submitMove },
    });
    const buttons = wrapper.findAll('[data-testid^="pending-give-hq-hero-choice-card-"]');
    assert.equal(buttons.length, 0, 'no actionable entry rendered for an empty eligible set');
    assert.equal(calls.length, 0, 'no move fired');
  });
});
