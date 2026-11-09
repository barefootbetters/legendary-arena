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

describe('MoveVillainChoicePrompt — a resized City (WP-831 / D-24764)', () => {
  test('a 3-space City offers only the spaces that exist', async () => {
    const { submitMove } = recorder();
    const wrapper = mount(MoveVillainChoicePrompt, {
      props: {
        pendingMoveVillainChoice: { playerID: 'player-0', villainCityIndices: [0] },
        city: { spaces: [cityCard('villain-sewers', 'HYDRA Kidnappers'), null, null], escapedPile: [] },
        viewerPlayerId: 'player-0',
        submitMove,
      },
    });
    await wrapper.find('[data-testid="move-villain-source"]').trigger('click');
    const destinations = wrapper.findAll('[data-testid="move-villain-destination"]').map((destination) => destination.text());
    assert.equal(destinations.length, 2, 'the Bank and the Rooftops only');
    assert.ok(destinations.every((text) => !text.includes('Bridge') && !text.includes('Streets')));
  });
});

describe('MoveVillainChoicePrompt — a 6-space City (WP-831 / D-24764)', () => {
  test('the unnamed sixth space is offered as "Space 6", numbered as on the board', async () => {
    const { submitMove } = recorder();
    const wrapper = mount(MoveVillainChoicePrompt, {
      props: {
        pendingMoveVillainChoice: { playerID: 'player-0', villainCityIndices: [0] },
        city: { spaces: [cityCard('villain-sewers', 'HYDRA Kidnappers'), null, null, null, null, null], escapedPile: [] },
        viewerPlayerId: 'player-0',
        submitMove,
      },
    });
    await wrapper.find('[data-testid="move-villain-source"]').trigger('click');
    const destinations = wrapper.findAll('[data-testid="move-villain-destination"]').map((destination) => destination.text());
    assert.equal(destinations.length, 5);
    assert.ok(destinations.some((text) => text.includes('Space 6')));
  });
});

describe('MoveVillainChoicePrompt — the X-Con Security Van variant (WP-876 / D-24823)', () => {
  /**
   * Mounts the prompt for an X-Con Security Van entry on the given City.
   *
   * @param spaces - The projected City spaces.
   * @param villainCityIndices - The engine indices holding a Villain.
   * @returns The wrapper and the recorded submissions.
   */
  function mountXCon(spaces: UICityState['spaces'], villainCityIndices: number[]) {
    const { calls, submitMove } = recorder();
    const wrapper = mount(MoveVillainChoicePrompt, {
      props: {
        pendingMoveVillainChoice: { playerID: 'player-0', villainCityIndices, variant: 'x-con-security-van' },
        city: { spaces, escapedPile: [] },
        viewerPlayerId: 'player-0',
        submitMove,
      },
    });
    return { wrapper, calls };
  }

  /**
   * The engine indices of the spaces a City holds no Villain in (the engine's G.city[i] === null).
   *
   * @param spaces - The projected City spaces.
   * @param sourceIndex - The source space, never a destination.
   * @returns The empty indices, ascending.
   */
  function emptyIndices(spaces: UICityState['spaces'], sourceIndex: number): number[] {
    const indices: number[] = [];
    for (let cityIndex = 0; cityIndex < spaces.length; cityIndex++) {
      if (spaces[cityIndex] === null && cityIndex !== sourceIndex) {
        indices.push(cityIndex);
      }
    }
    return indices;
  }

  test('shows the X-Con heading, region label and KO note', () => {
    const { wrapper } = mountXCon(mockCity.spaces, [0, 3]);
    const region = wrapper.find('[data-testid="move-villain-prompt"]');
    assert.equal(wrapper.find('.move-villain-prompt__heading').text(), 'X-Con Security Van: move a Villain to an empty space');
    assert.equal(region.attributes('aria-label'), 'X-Con Security Van: move a Villain to an empty space');
    assert.equal(wrapper.find('[data-testid="move-villain-x-con-note"]').text(), 'If you move a Villain, you KO one of your Heroes.');
    assert.ok(!wrapper.text().includes('Spinning Cyclone'));
    assert.ok(!wrapper.text().includes('rescued'));
  });

  test('a five-space City offers exactly the engine\'s empty spaces, never "swap with"', async () => {
    const { wrapper, calls } = mountXCon(mockCity.spaces, [0, 3]);
    await wrapper.find('[data-testid="move-villain-source"]').trigger('click');
    const destinations = wrapper.findAll('[data-testid="move-villain-destination"]');
    const labels = destinations.map((destination) => destination.text());
    assert.ok(labels.every((label) => !label.includes('swap with')));
    assert.equal(labels.length, emptyIndices(mockCity.spaces, 3).length);
    // why: the first source in visual order is the Streets (engine 3); submit to the first offered
    // destination (the Bridge, engine 4) and check the ENGINE indices.
    await destinations[0]!.trigger('click');
    await wrapper.find('[data-testid="move-villain-confirm"]').trigger('click');
    assert.deepEqual(calls, [{ name: 'resolveMoveVillainChoice', args: { fromCityIndex: 3, toCityIndex: 4 } }]);
    assert.ok(emptyIndices(mockCity.spaces, 3).includes(4));
  });

  test('a six-space City offers exactly the engine\'s empty spaces, the unnamed sixth included', async () => {
    const spaces: UICityState['spaces'] = [
      cityCard('villain-sewers', 'HYDRA Kidnappers'),
      cityCard('villain-bank', 'Doombot Legion'),
      null,
      cityCard('villain-streets', 'Savage Land Mutates'),
      null,
      null,
    ];
    const { wrapper } = mountXCon(spaces, [0, 1, 3]);
    const sources = wrapper.findAll('[data-testid="move-villain-source"]');
    await sources[sources.length - 1]!.trigger('click');
    const labels = wrapper.findAll('[data-testid="move-villain-destination"]').map((destination) => destination.text());
    assert.deepEqual(labels, ['Space 6', 'Bridge', 'Rooftops']);
    assert.equal(labels.length, emptyIndices(spaces, 0).length);
  });

  test('without the variant the Spinning Cyclone rendering is unchanged', async () => {
    const { wrapper } = mountPrompt();
    assert.equal(wrapper.find('.move-villain-prompt__heading').text(), 'Spinning Cyclone: move a Villain');
    assert.equal(wrapper.find('[data-testid="move-villain-prompt"]').attributes('aria-label'), 'Spinning Cyclone: move a Villain');
    assert.equal(wrapper.find('[data-testid="move-villain-x-con-note"]').exists(), false);
    await wrapper.find('[data-testid="move-villain-source"]').trigger('click');
    const labels = wrapper.findAll('[data-testid="move-villain-destination"]').map((destination) => destination.text());
    assert.ok(labels.some((label) => label.includes('swap with')), 'occupied spaces still offer a swap');
  });
});
