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

  // why: WP-827 / D-24760 — Flying Shield Block may be about another player's Wound, so the
  // heading names no owner and the option labels say whose Wound it is.
  test('renders the Flying Shield Block heading for the flying-shield-block kind (WP-827)', () => {
    const { submitMove } = recorder();
    const flyingShieldBlockChoice: UIPendingSeatChoice = {
      kind: 'flying-shield-block',
      addressedSeats: ['player-1'],
      outstandingSeats: ['player-1'],
      seatPrompts: {
        'player-1': { options: [{ label: "Reveal Flying Shield Block: prevent Player 0's Wound and rescue a Bystander" }, { label: 'Let Player 0 take the Wound' }] },
      },
    };
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: flyingShieldBlockChoice, viewerPlayerId: 'player-1', submitMove },
    });
    assert.equal(wrapper.find('.pending-seat-choice-prompt__heading').text(), 'A player would gain a Wound — Flying Shield Block?');
    assert.equal(wrapper.find('[data-testid="pending-seat-choice-option-0"]').text(), "Reveal Flying Shield Block: prevent Player 0's Wound and rescue a Bystander");
  });

  // why: WP-828 / D-24761 — Winter Soldier's 2>4: the options are the hand Heroes by name.
  test('renders the Man Out of Time grant heading for the out-of-time-grant kind (WP-828)', () => {
    const { submitMove } = recorder();
    const grantChoice: UIPendingSeatChoice = {
      kind: 'out-of-time-grant',
      addressedSeats: ['player-1'],
      outstandingSeats: ['player-1'],
      seatPrompts: {
        'player-1': { options: [{ label: 'Hero A' }, { label: 'Hero B' }] },
      },
    };
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: grantChoice, viewerPlayerId: 'player-1', submitMove },
    });
    assert.equal(wrapper.find('.pending-seat-choice-prompt__heading').text(), 'Choose a Hero in your hand to gain Man Out of Time this turn');
    assert.equal(wrapper.find('[data-testid="pending-seat-choice-option-1"]').text(), 'Hero B');
  });

  // why: WP-829 / D-24762 — Go Back in Time: the options are the HQ Heroes by name and cost.
  test('renders the Purge heading for the timestream-purge kind (WP-829)', () => {
    const { submitMove } = recorder();
    const purgeChoice: UIPendingSeatChoice = {
      kind: 'timestream-purge',
      addressedSeats: ['player-1'],
      outstandingSeats: ['player-1'],
      seatPrompts: {
        'player-1': { options: [{ label: 'Hero A (cost 3)' }, { label: 'Hero B (cost 5)' }] },
      },
    };
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: purgeChoice, viewerPlayerId: 'player-1', submitMove },
    });
    assert.equal(wrapper.find('.pending-seat-choice-prompt__heading').text(), 'Go Back in Time — choose a Hero in the HQ to Purge from the Timestream');
    assert.equal(wrapper.find('[data-testid="pending-seat-choice-option-1"]').text(), 'Hero B (cost 5)');
  });

  test('keeps the generic "Your choice" heading for a non-diving-block kind', () => {
    const { submitMove } = recorder();
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: forSeat1, viewerPlayerId: 'player-1', submitMove },
    });
    assert.equal(wrapper.find('.pending-seat-choice-prompt__heading').text(), 'Your choice');
  });

  // why: WP-694 / D-24511 — the two multi-seat core mastermind tactics render distinct
  // headings for each of their three kinds (Monarch's Decree mode + discard, Vanishing
  // Illusions KO); the viewer still sees only its own redacted prompt.
  test('renders a distinct heading for each of the three WP-694 kinds (Monarch\'s Decree / Vanishing Illusions)', () => {
    const { submitMove } = recorder();
    const cases: { kind: string; pattern: RegExp }[] = [
      { kind: 'monarchs-decree-mode', pattern: /Monarch’s Decree/ },
      { kind: 'monarchs-discard', pattern: /discard/ },
      { kind: 'vanishing-illusions-ko', pattern: /Vanishing Illusions/ },
    ];
    for (const { kind, pattern } of cases) {
      const choice: UIPendingSeatChoice = {
        kind,
        addressedSeats: ['player-1'],
        outstandingSeats: ['player-1'],
        seatPrompts: { 'player-1': { options: [{ label: 'Option A' }, { label: 'Option B' }] } },
      };
      const wrapper = mount(PendingSeatChoicePrompt, {
        props: { pendingSeatChoice: choice, viewerPlayerId: 'player-1', submitMove },
      });
      assert.match(
        wrapper.find('.pending-seat-choice-prompt__heading').text(),
        pattern,
        `heading for kind ${kind}`,
      );
    }
  });

  // why: WP-793 / D-24656 — the escape procedure's HQ-KO pick and Bystander discard, and a
  // non-active seat's own return-on-discard answer, each render their exact heading (not
  // the "Your choice" fallback).
  test('renders the exact heading for each of the three WP-793 kinds (escape procedure / return-on-discard)', () => {
    const { submitMove } = recorder();
    const cases: { kind: string; heading: string }[] = [
      { kind: 'escape-hq-ko', heading: 'A Villain escaped — choose a Hero in the HQ to KO' },
      { kind: 'escape-bystander-discard', heading: 'Bystanders were carried away — choose a card to discard' },
      { kind: 'return-on-discard', heading: 'Return the discarded card to your hand?' },
    ];
    for (const { kind, heading } of cases) {
      const choice: UIPendingSeatChoice = {
        kind,
        addressedSeats: ['player-1'],
        outstandingSeats: ['player-1'],
        seatPrompts: { 'player-1': { options: [{ label: 'Option A' }, { label: 'Option B' }] } },
      };
      const wrapper = mount(PendingSeatChoicePrompt, {
        props: { pendingSeatChoice: choice, viewerPlayerId: 'player-1', submitMove },
      });
      assert.equal(
        wrapper.find('.pending-seat-choice-prompt__heading').text(),
        heading,
        `heading for kind ${kind}`,
      );
    }
  });
});

describe('PendingSeatChoicePrompt — WP-830 Enigma Code peek (D-24763)', () => {
  test('the enigma-peek kind has its own heading', () => {
    const { submitMove } = recorder();
    const choice: UIPendingSeatChoice = {
      kind: 'enigma-peek',
      addressedSeats: ['player-1'],
      outstandingSeats: ['player-1'],
      seatPrompts: { 'player-1': { options: [{ label: 'Pay 1 Recruit: look at Enigma card 1' }, { label: "Don't look" }] } },
    };
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: choice, viewerPlayerId: 'player-1', submitMove },
    });
    assert.equal(
      wrapper.find('.pending-seat-choice-prompt__heading').text(),
      'Enigma Code — pay 1 Recruit to look at a face-down card?',
    );
  });
});

describe('PendingSeatChoicePrompt — WP-817 Primus Escape discard (D-24750)', () => {
  test('T31: the escape-effect-cost-discard kind has its own heading', () => {
    const { submitMove } = recorder();
    const choice: UIPendingSeatChoice = {
      kind: 'escape-effect-cost-discard',
      addressedSeats: ['player-1'],
      outstandingSeats: ['player-1'],
      seatPrompts: { 'player-1': { options: [{ label: 'Hero (cost 3)' }] } },
    };
    const wrapper = mount(PendingSeatChoicePrompt, {
      props: { pendingSeatChoice: choice, viewerPlayerId: 'player-1', submitMove },
    });
    assert.equal(
      wrapper.find('.pending-seat-choice-prompt__heading').text(),
      'A Villain escaped — choose a Hero to discard',
    );
  });
});
