/**
 * Tests for the UndercoverChoicePrompt component (WP-678/679 / EC-716 / D-24494/D-24495).
 *
 * Covers render gates (present only for the chooser, hidden for opponents/spectators), one
 * button per eligible target, move dispatch with the right { targetExtId }, and the
 * no-double-submit guard. Mirrors CountScaledChoicePrompt.test.ts.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingUndercoverChoice } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import UndercoverChoicePrompt from './UndercoverChoicePrompt.vue';

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

const mockPending: UIPendingUndercoverChoice = {
  playerID: 'player-0',
  eligibleTargets: ['nick-fury#0', 'maria-hill#0'],
};

describe('UndercoverChoicePrompt (WP-678/679 / EC-716)', () => {
  test('renders when a pick is pending and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find('[data-testid="undercover-choice-prompt"]').exists());
    assert.equal(wrapper.findAll('button').length, 2, 'one button per eligible target');
  });

  test('does not render when no pick is pending', () => {
    const { submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find('[data-testid="undercover-choice-prompt"]').exists());
  });

  test('does not render for a non-chooser or a spectator', () => {
    const { submitMove } = recorder();
    const opponent = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!opponent.find('[data-testid="undercover-choice-prompt"]').exists());
    const spectator = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find('[data-testid="undercover-choice-prompt"]').exists());
  });

  test('clicking a target fires resolveUndercoverChoice with its { targetExtId }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="undercover-choice-option-1"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveUndercoverChoice');
    assert.deepEqual(calls[0]!.args, { targetExtId: 'maria-hill#0' });
  });

  test('does not fire twice (no-double-submit guard)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const button = wrapper.find('[data-testid="undercover-choice-option-0"]');
    await button.trigger('click');
    await button.trigger('click');
    assert.equal(calls.length, 1, 'the second click is debounced');
  });
});

// why: WP-901 / D-24858 — the your-hero pick ("You may send one of your [other] Heroes Undercover"):
// named hand / in-play groups plus "Don't send". Starter ids repeat, so lookups use findAll.
const yourHeroPending: UIPendingUndercoverChoice = {
  playerID: 'player-0',
  eligibleTargets: ['starting-shield-agent', 'starting-shield-agent'],
  eligibleHand: [
    { zone: 'hand', cardId: 'starting-shield-agent', display: { extId: 'starting-shield-agent', name: 'S.H.I.E.L.D. Agent', imageUrl: 'https://example.com/agent.jpg', cost: 0 } },
    { zone: 'hand', cardId: 'starting-shield-agent', display: { extId: 'starting-shield-agent', name: 'S.H.I.E.L.D. Agent', imageUrl: '', cost: 0 } },
  ],
  eligibleInPlay: [
    { zone: 'inPlay', cardId: 'bkwd/black-widow/infiltrate-the-conspiracy#0', display: { extId: 'bkwd/black-widow/infiltrate-the-conspiracy#0', name: 'Infiltrate the Conspiracy', imageUrl: '', cost: 7 } },
  ],
  canDecline: true,
};

describe('UndercoverChoicePrompt — your-hero pick (WP-901 / D-24858)', () => {
  test('renders the heading, a hand group and a played-this-turn group of named buttons', () => {
    const { submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: yourHeroPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.text().includes('You may send one of your Heroes Undercover'));
    assert.ok(wrapper.text().includes('From your hand'));
    assert.ok(wrapper.text().includes('Played this turn'));
    const handButtons = wrapper.findAll('[data-testid="undercover-choice-card-hand-starting-shield-agent"]');
    assert.equal(handButtons.length, 2, 'one button per hand entry, repeated ids included');
    assert.ok(handButtons[0]!.text().includes('S.H.I.E.L.D. Agent'), 'names, not ext ids');
    const inPlayButtons = wrapper.findAll('[data-testid="undercover-choice-card-inPlay-bkwd/black-widow/infiltrate-the-conspiracy#0"]');
    assert.equal(inPlayButtons.length, 1);
    assert.ok(inPlayButtons[0]!.text().includes('Infiltrate the Conspiracy'));
    assert.equal(wrapper.findAll('[data-testid^="undercover-choice-option-"]').length, 0, 'no legacy raw-id buttons');
  });

  test('a hand pick submits { zone: "hand", targetExtId }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: yourHeroPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.findAll('[data-testid="undercover-choice-card-hand-starting-shield-agent"]')[1]!.trigger('click');
    assert.deepEqual(calls, [{ name: 'resolveUndercoverChoice', args: { zone: 'hand', targetExtId: 'starting-shield-agent' } }]);
  });

  test('an in-play pick submits { zone: "inPlay", targetExtId }', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: yourHeroPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.findAll('[data-testid="undercover-choice-card-inPlay-bkwd/black-widow/infiltrate-the-conspiracy#0"]')[0]!.trigger('click');
    assert.deepEqual(calls, [{ name: 'resolveUndercoverChoice', args: { zone: 'inPlay', targetExtId: 'bkwd/black-widow/infiltrate-the-conspiracy#0' } }]);
  });

  test('"Don\'t send" submits { decline: true }, once', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: yourHeroPending, viewerPlayerId: 'player-0', submitMove },
    });
    const decline = wrapper.find('[data-testid="undercover-choice-decline"]');
    assert.equal(decline.text(), "Don't send");
    await decline.trigger('click');
    await decline.trigger('click');
    assert.deepEqual(calls, [{ name: 'resolveUndercoverChoice', args: { decline: true } }]);
  });

  test('hidden for opponents and spectators', () => {
    const { submitMove } = recorder();
    const opponent = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: yourHeroPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!opponent.find('[data-testid="undercover-choice-prompt"]').exists());
    const spectator = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: yourHeroPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!spectator.find('[data-testid="undercover-choice-prompt"]').exists());
  });

  test('the S.H.I.E.L.D. pick renders unchanged: legacy heading, raw-id buttons, no decline', () => {
    const { submitMove } = recorder();
    const wrapper = mount(UndercoverChoicePrompt, {
      props: { pendingUndercoverChoice: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.text().includes('Send which S.H.I.E.L.D. Hero Undercover?'));
    assert.ok(!wrapper.find('[data-testid="undercover-choice-decline"]').exists());
    assert.equal(wrapper.find('[data-testid="undercover-choice-option-0"]').text(), 'nick-fury#0');
  });
});
