import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import SharedDecks from './SharedDecks.vue';
import type { UISharedPilesState, UITurnEconomyState } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

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

function piles(over: Partial<UISharedPilesState> = {}): UISharedPilesState {
  return {
    bystandersCount: 27,
    woundsCount: 2,
    horrorsCount: 0,
    officersCount: 30,
    sidekicksCount: 0,
    ...over,
  };
}

function economy(over: Partial<UITurnEconomyState> = {}): UITurnEconomyState {
  return {
    attack: 0,
    recruit: 0,
    availableAttack: 0,
    availableRecruit: 0,
    piercing: 0,
    woundsDrawn: 0,
    ...over,
  };
}

describe('SharedDecks (WP-648 — recruitable S.H.I.E.L.D. Officer supply)', () => {
  test('renders the officers cell as a recruit button with the supply count', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        economy: economy({ recruit: 5, availableRecruit: 5 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    assert.equal(button.exists(), true);
    assert.match(button.text(), /\[30\]/);
  });

  test('clicking the officers cell emits recruitOfficer with an empty payload', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        economy: economy({ recruit: 3, availableRecruit: 3 }),
        submitMove,
      },
    });
    void wrapper.find('[data-testid="play-recruit-officer"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'recruitOfficer');
    assert.deepEqual(calls[0]!.args, {});
  });

  test('disables the officer buy with a stage tooltip when currentStage is not main', () => {
    const { submitMove } = recorder();
    for (const stage of ['start', 'cleanup'] as const) {
      const wrapper = mount(SharedDecks, {
        props: {
          piles: piles(),
          currentStage: stage,
          economy: economy({ recruit: 5, availableRecruit: 5 }),
          submitMove,
        },
      });
      const button = wrapper.find('[data-testid="play-recruit-officer"]');
      assert.equal(button.attributes('disabled'), '');
      assert.match(button.attributes('title')!, /Only available during the Main/);
    }
  });

  test('disables the officer buy with a cost tooltip when recruit is short of 3', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        economy: economy({ recruit: 2, availableRecruit: 2 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /Needs 3 recruit, you have 2/);
  });

  test('disables the officer buy with an empty-supply tooltip when officersCount is 0', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles({ officersCount: 0 }),
        currentStage: 'main',
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /No S\.H\.I\.E\.L\.D\. Officers remain/);
  });

  test('disables the officer buy when it is not the viewer turn', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        isViewerTurn: false,
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /not your turn/i);
  });

  test('renders the projected Officer card face image inside the recruit button', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles({
          officerDisplay: {
            extId: 'pile-shield-officer',
            name: 'S.H.I.E.L.D. Officer',
            imageUrl: 'https://images.legendary-arena.com/core/core-so-officer.webp',
            cost: null,
          },
        }),
        currentStage: 'main',
        economy: economy({ recruit: 5, availableRecruit: 5 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    const image = button.find('[data-testid="card-tile-image"]');
    assert.equal(image.exists(), true, 'the Officer card face image must render');
    assert.equal(
      image.attributes('src'),
      'https://images.legendary-arena.com/core/core-so-officer.webp',
    );
    // the count + buy cost still read alongside the card face
    assert.match(button.text(), /\[30\]/);
    assert.match(button.text(), /Recruit: 3/);
  });

  test('falls back to a text card face when officerDisplay is absent (older snapshots)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        economy: economy({ recruit: 5, availableRecruit: 5 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    // no imageUrl → CardTile renders its text fallback, never a broken <img>
    assert.equal(button.find('[data-testid="card-tile-image"]').exists(), false);
    assert.equal(button.find('[data-testid="card-tile-fallback"]').exists(), true);
  });

  test('the other four supply cells stay static counts (only the officers cell is a button)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        economy: economy({ recruit: 5, availableRecruit: 5 }),
        submitMove,
      },
    });
    assert.equal(wrapper.findAll('button').length, 1, 'exactly one recruit button (Officers only)');
    assert.match(wrapper.find('[data-testid="play-shared-deck-wounds"]').text(), /\[2\]/);
    assert.match(wrapper.find('[data-testid="play-shared-deck-bystanders"]').text(), /\[27\]/);
  });
});
