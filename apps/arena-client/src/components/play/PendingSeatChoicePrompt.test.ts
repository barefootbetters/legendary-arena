/**
 * Tests for the PendingSeatChoicePrompt component (WP-684 / EC-721 / D-24501).
 *
 * Covers render gates (present only for an addressed seat whose own prompt is in the
 * per-seat-redacted projection — including a NON-ACTIVE seat), the per-option render
 * (one button per this seat's own option), move dispatch with the right { optionIndex },
 * and the no-double-submit guard. Mirrors CountScaledChoicePrompt.test.ts.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingSeatChoice } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import PendingSeatChoicePrompt from './PendingSeatChoicePrompt.vue';

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

// The per-seat-redacted projection the engine filter delivers to seat 'player-1'
// (a NON-ACTIVE addressed seat): it carries ONLY that seat's own prompt.
const forSeat1: UIPendingSeatChoice = {
  kind: 'generic',
  addressedSeats: ['player-0', 'player-1'],
  outstandingSeats: ['player-0', 'player-1'],
  seatPrompts: {
    'player-1': { options: [{ label: 'Reveal' }, { label: 'Decline' }] },
  },
};

describe('PendingSeatChoicePrompt (WP-684 / EC-721)', () => {
  test('renders for the addressed (non-active) seat whose own prompt is present', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: forSeat1, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="pending-seat-choice-prompt"]').exists());
  });

  test('does not render when no seat choice is present', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: undefined, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="pending-seat-choice-prompt"]').exists());
  });

  test('does not render for a seat not in the (redacted) prompt map, nor a spectator', () => {
    const { submitMove } = recorder();
    // Seat 'player-0' received a projection that does not carry its own prompt.
    const other = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: forSeat1, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!other.find('[data-testid="pending-seat-choice-prompt"]').exists());
    const spectator = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: forSeat1, viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find('[data-testid="pending-seat-choice-prompt"]').exists());
  });

  test('renders one button per option from this seat\'s own prompt', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: forSeat1, viewerPlayerId: 'player-1', submitMove },
    });
    const buttons = wrapper.findAll('button');
    assert.equal(buttons.length, 2, 'exactly two option buttons');
    assert.equal(wrapper.find('[data-testid="pending-seat-choice-option-0"]').text(), 'Reveal');
    assert.equal(wrapper.find('[data-testid="pending-seat-choice-option-1"]').text(), 'Decline');
  });

  test('clicking an option fires resolveSeatChoice with its { optionIndex }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: forSeat1, viewerPlayerId: 'player-1', submitMove },
    });
    await wrapper.find('[data-testid="pending-seat-choice-option-0"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveSeatChoice');
    assert.deepEqual(calls[0]!.args, { optionIndex: 0 });
  });

  test('does not double-submit on rapid clicks (isSubmitting guard)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: forSeat1, viewerPlayerId: 'player-1', submitMove },
    });
    const button = wrapper.find('[data-testid="pending-seat-choice-option-1"]');
    await button.trigger('click');
    await button.trigger('click');
    assert.equal(calls.length, 1, 'the second click is guarded');
  });

  // why: WP-682 / D-24499 — Diving Block is the first concrete consumer; the heading
  // reads naturally for it while the generic scaffold keeps "Your choice" for any other kind.
  test('renders the Diving Block heading for the diving-block kind (WP-682)', () => {
    const { submitMove } = recorder();
    const divingBlockChoice: UIPendingSeatChoice = {
      kind: 'diving-block',
      addressedSeats: ['player-1'],
      outstandingSeats: ['player-1'],
      seatPrompts: {
        'player-1': { options: [{ label: 'Reveal Diving Block: prevent the Wound and draw a card' }, { label: 'Take the Wound' }] },
      },
    };
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: divingBlockChoice, viewerPlayerId: 'player-1', submitMove },
    });
    assert.match(wrapper.find('.pending-seat-choice-prompt__heading').text(), /Diving Block/);
    assert.equal(wrapper.find('[data-testid="pending-seat-choice-option-0"]').text(), 'Reveal Diving Block: prevent the Wound and draw a card');
  });

  test('keeps the generic "Your choice" heading for a non-diving-block kind', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: forSeat1, viewerPlayerId: 'player-1', submitMove },
    });
    assert.equal(wrapper.find('.pending-seat-choice-prompt__heading').text(), 'Your choice');
  });
});
