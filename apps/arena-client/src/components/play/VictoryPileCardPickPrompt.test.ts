/**
 * Tests for the VictoryPileCardPickPrompt component (WP-313 / EC-343).
 *
 * Covers render gates (present only for the chooser), the one-button-per-eligible-villain
 * render (name + "+N Attack"), move dispatch with the right { cardId }, and the
 * no-double-submit guard.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingVictoryPileCardPick } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import VictoryPileCardPickPrompt from './VictoryPileCardPickPrompt.vue';

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

const mockPending: UIPendingVictoryPileCardPick = {
  playerID: 'player-0',
  eligibleVillains: [
    {
      cardId: 'core-villain-brotherhood-magneto-00',
      display: { extId: 'core-villain-brotherhood-magneto-00', name: 'Magneto', imageUrl: 'x', cost: 5 },
      attackValue: 5,
    },
    {
      cardId: 'core-villain-skrulls-super-skrull-00',
      display: { extId: 'core-villain-skrulls-super-skrull-00', name: 'Super-Skrull', imageUrl: 'x', cost: 4 },
      attackValue: 4,
    },
  ],
};

const SELECTOR = '[data-testid="victory-pile-pick-prompt"]';

describe('VictoryPileCardPickPrompt (WP-313 / EC-343)', () => {
  test('renders when pending pick exists and viewer is the chooser', () => {
    const { submitMove } = recorder();
    const wrapper = mount(VictoryPileCardPickPrompt, {
      props: { pendingVictoryPileCardPick: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(wrapper.find(SELECTOR).exists());
  });

  test('does not render when the pick is undefined', () => {
    const { submitMove } = recorder();
    const wrapper = mount(VictoryPileCardPickPrompt, {
      props: { pendingVictoryPileCardPick: undefined, viewerPlayerId: 'player-0', submitMove },
    });
    assert.ok(!wrapper.find(SELECTOR).exists());
  });

  test('does not render for a non-chooser opponent', () => {
    const { submitMove } = recorder();
    const wrapper = mount(VictoryPileCardPickPrompt, {
      props: { pendingVictoryPileCardPick: mockPending, viewerPlayerId: 'player-1', submitMove },
    });
    assert.ok(!wrapper.find(SELECTOR).exists());
  });

  test('does not render for a spectator (null playerId)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(VictoryPileCardPickPrompt, {
      props: { pendingVictoryPileCardPick: mockPending, viewerPlayerId: null, submitMove },
    });
    assert.ok(!wrapper.find(SELECTOR).exists());
  });

  test('renders one button per eligible villain, each with name + "+N Attack"', () => {
    const { submitMove } = recorder();
    const wrapper = mount(VictoryPileCardPickPrompt, {
      props: { pendingVictoryPileCardPick: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const buttons = wrapper.findAll('button');
    assert.equal(buttons.length, 2, 'one button per eligible villain');
    assert.match(buttons[0]!.text(), /Magneto \(\+5 Attack\)/);
    assert.match(buttons[1]!.text(), /Super-Skrull \(\+4 Attack\)/);
  });

  test('clicking a villain submits resolveVictoryPileCardPick with its cardId', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(VictoryPileCardPickPrompt, {
      props: { pendingVictoryPileCardPick: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="victory-pile-pick-core-villain-skrulls-super-skrull-00"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveVictoryPileCardPick');
    assert.deepEqual(calls[0]!.args, { cardId: 'core-villain-skrulls-super-skrull-00' });
  });

  test('does not double-submit — the second click within the same frame is ignored', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(VictoryPileCardPickPrompt, {
      props: { pendingVictoryPileCardPick: mockPending, viewerPlayerId: 'player-0', submitMove },
    });
    const btn = wrapper.find('[data-testid="victory-pile-pick-core-villain-brotherhood-magneto-00"]');
    await btn.trigger('click');
    await btn.trigger('click');
    assert.equal(calls.length, 1, 'the second click is debounced by isSubmitting');
  });
});
