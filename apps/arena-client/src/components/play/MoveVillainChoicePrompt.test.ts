/**
 * Tests for the MoveVillainChoicePrompt component (WP-795 / EC-832 / D-24664 — core Storm's
 * "Spinning Cyclone").
 *
 * Covers render gates (present only for the chooser), the source list (one button per City
 * Villain), the four-space destination list with "swap with" labels, the Move button disabled
 * until both picks are made, ENGINE-index submission (Sewers 0 → Bridge 4 — a Rooftops-only case
 * would pass vacuously because index 2 maps to itself visually), the always-enabled Don't move
 * decline, and the no-double-submit guard. Mirrors CoveringFireChoicePrompt tests.
 *
 * Uses node:test + @vue/test-utils (arena-client test infrastructure).
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UICityState, UIPendingMoveVillainChoice } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

import MoveVillainChoicePrompt from './MoveVillainChoicePrompt.vue';

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

/** A projected City card with just the fields the prompt reads. */
function cityCard(extId: string, name: string): NonNullable<UICityState['spaces'][number]> {
  return {
    extId,
    type: 'villain',
    keywords: [],
    display: { extId, name, imageUrl: '', cost: null },
    attachedHeroes: [],
    attachedHeroDisplay: [],
    capturedBystanderCount: 0,
  } as unknown as NonNullable<UICityState['spaces'][number]>;
}

// Villains in the Sewers (engine 0) and the Streets (engine 3).
const mockCity: UICityState = {
  spaces: [cityCard('villain-sewers', 'HYDRA Kidnappers'), null, null, cityCard('villain-streets', 'Doombot Legion'), null],
  escapedPile: [],
};

const mockPending: UIPendingMoveVillainChoice = {
  playerID: 'player-0',
  villainCityIndices: [0, 3],
};

function mountPrompt(
  overrides: { pending?: UIPendingMoveVillainChoice | undefined; viewerPlayerId?: string | null } = {},
) {
  const { calls, submitMove } = recorder();
  const wrapper = mount(MoveVillainChoicePrompt, {
    props: {
      pendingMoveVillainChoice: 'pending' in overrides ? overrides.pending : mockPending,
      city: mockCity,
      viewerPlayerId: 'viewerPlayerId' in overrides ? overrides.viewerPlayerId! : 'player-0',
      submitMove,
    },
  });
  return { wrapper, calls };
}

describe('MoveVillainChoicePrompt (WP-795 / EC-832)', () => {
  test('renders when a pending choice exists and the viewer is the chooser', () => {
    const { wrapper } = mountPrompt();
    assert.ok(wrapper.find('[data-testid="move-villain-prompt"]').exists());
  });

  test('does not render when the pending choice is undefined', () => {
    const { wrapper } = mountPrompt({ pending: undefined });
    assert.ok(!wrapper.find('[data-testid="move-villain-prompt"]').exists());
  });

  test('does not render for a non-chooser or a spectator', () => {
    const opponent = mountPrompt({ viewerPlayerId: 'player-1' }).wrapper;
    assert.ok(!opponent.find('[data-testid="move-villain-prompt"]').exists());
    const spectator = mountPrompt({ viewerPlayerId: null }).wrapper;
    assert.ok(!spectator.find('[data-testid="move-villain-prompt"]').exists());
  });

  test('lists one source per City Villain, by name and space', () => {
    const { wrapper } = mountPrompt();
    const sources = wrapper.findAll('[data-testid="move-villain-source"]');
    assert.equal(sources.length, 2);
    const texts = sources.map((source) => source.text());
    assert.ok(texts.some((text) => text.includes('HYDRA Kidnappers') && text.includes('Sewers')));
    assert.ok(texts.some((text) => text.includes('Doombot Legion') && text.includes('Streets')));
  });

  test('after a source pick, lists the other four spaces with "swap with" on occupied ones', async () => {
    const { wrapper } = mountPrompt();
    assert.equal(wrapper.findAll('[data-testid="move-villain-destination"]').length, 0, 'no destinations before a source pick');
    const sewersSource = wrapper.findAll('[data-testid="move-villain-source"]').find((source) => source.text().includes('Sewers'))!;
    await sewersSource.trigger('click');
    const destinations = wrapper.findAll('[data-testid="move-villain-destination"]');
    assert.equal(destinations.length, 4);
    const texts = destinations.map((destination) => destination.text());
    assert.ok(!texts.some((text) => text.startsWith('Sewers')), 'the source space is not a destination');
    assert.ok(texts.includes('Streets (swap with Doombot Legion)'));
    assert.ok(texts.includes('Bridge'));
  });

  test('Move is disabled until both picks are made, then submits ENGINE indices Sewers (0) → Bridge (4)', async () => {
    const { wrapper, calls } = mountPrompt();
    const confirm = () => wrapper.find('[data-testid="move-villain-confirm"]');
    assert.equal(confirm().attributes('disabled'), '', 'disabled with no picks');

    const sewersSource = wrapper.findAll('[data-testid="move-villain-source"]').find((source) => source.text().includes('Sewers'))!;
    await sewersSource.trigger('click');
    assert.equal(confirm().attributes('disabled'), '', 'disabled with only a source pick');

    const bridgeDestination = wrapper.findAll('[data-testid="move-villain-destination"]').find((destination) => destination.text() === 'Bridge')!;
    await bridgeDestination.trigger('click');
    assert.equal(confirm().attributes('disabled'), undefined, 'enabled once both picks are made');

    await confirm().trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'resolveMoveVillainChoice');
    assert.deepEqual(calls[0]!.args, { fromCityIndex: 0, toCityIndex: 4 });
  });

  test("Don't move is always enabled and submits { decline: true }", async () => {
    const { wrapper, calls } = mountPrompt();
    const decline = wrapper.find('[data-testid="move-villain-decline"]');
    assert.equal(decline.attributes('disabled'), undefined);
    await decline.trigger('click');
    assert.deepEqual(calls, [{ name: 'resolveMoveVillainChoice', args: { decline: true } }]);
  });

  test('does not double-submit, and re-enables when a new pending frame arrives', async () => {
    const { wrapper, calls } = mountPrompt();
    const decline = wrapper.find('[data-testid="move-villain-decline"]');
    await decline.trigger('click');
    await decline.trigger('click');
    assert.equal(calls.length, 1, 'the second click is ignored');

    await wrapper.setProps({ pendingMoveVillainChoice: { playerID: 'player-0', villainCityIndices: [0, 3] } });
    assert.equal(wrapper.find('[data-testid="move-villain-decline"]').attributes('disabled'), undefined);
    await wrapper.find('[data-testid="move-villain-decline"]').trigger('click');
    assert.equal(calls.length, 2);
  });
});
