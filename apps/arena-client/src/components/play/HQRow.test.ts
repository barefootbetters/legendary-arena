import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import HQRow from './HQRow.vue';
import type {
  UIDecksState,
  UIHQCard,
  UIHQState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
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

function hero(extId: string, name: string, cost: number): UIHQCard {
  return {
    extId,
    display: {
      extId,
      name,
      imageUrl: `https://images.legendary-arena.com/${extId}.png`,
      cost,
    },
  };
}

function fullHq(): UIHQState {
  return {
    slots: ['cap-rogers', null, 'iron-man-stark', 'spider-man-parker', null],
    slotDisplay: [
      hero('cap-rogers', 'Captain America', 4),
      null,
      hero('iron-man-stark', 'Iron Man', 6),
      hero('spider-man-parker', 'Spider-Man', 3),
      null,
    ],
  };
}

const DECKS: UIDecksState = { villainDeckCount: 0, heroDeckCount: 42 };

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

describe('HQRow (WP-129 — extends WP-100)', () => {
  test('renders 6-cell row: 5 hero slots + hero deck', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    const empties = wrapper.findAll('[data-testid="play-hq-empty"]');
    assert.equal(heroes.length, 3);
    assert.equal(empties.length, 2);
    assert.equal(wrapper.find('[data-testid="play-hq-hero-deck"]').exists(), true);
  });

  test('hero buttons map hqIndex to engine slot 0..4', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    const indices = heroes.map((b) => b.attributes('data-hq-index'));
    assert.deepEqual(indices, ['0', '2', '3']);
  });

  test('clicking a hero emits recruitHero with hqIndex', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    void heroes[2]!.trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'recruitHero');
    assert.deepEqual(calls[0]!.args, { hqIndex: 3 });
  });

  test('disables heroes with stage tooltip when currentStage is not main', () => {
    const { submitMove } = recorder();
    for (const stage of ['start', 'cleanup'] as const) {
      const wrapper = mount(HQRow, {
        props: {
          hq: fullHq(),
          decks: DECKS,
          currentStage: stage,
          economy: economy({ recruit: 9, availableRecruit: 9 }),
          submitMove,
        },
      });
      const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
      for (const button of heroes) {
        assert.equal(button.attributes('disabled'), '');
        assert.match(button.attributes('title')!, /Only available during the Main/);
      }
    }
  });

  test('disables heroes with cost tooltip when economy is short (precedence: stage met first)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ recruit: 4, availableRecruit: 4 }),
        submitMove,
      },
    });
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    // iron-man costs 6; available=4 → disabled with cost reason
    const ironMan = heroes.find((b) => b.attributes('data-card-id') === 'iron-man-stark');
    assert.notEqual(ironMan, undefined);
    assert.equal(ironMan!.attributes('disabled'), '');
    assert.match(ironMan!.attributes('title')!, /Needs 6 recruit, you have 4/);

    // cap-rogers costs 4; available=4 → enabled
    const cap = heroes.find((b) => b.attributes('data-card-id') === 'cap-rogers');
    assert.equal(cap!.attributes('disabled'), undefined);
  });

  test('hero deck cell reflects decks.heroDeckCount', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: { villainDeckCount: 0, heroDeckCount: 42 },
        currentStage: 'main',
        economy: economy({ availableRecruit: 9 }),
        submitMove,
      },
    });
    assert.match(wrapper.find('[data-testid="play-hq-hero-deck"]').text(), /\[42\]/);
  });
});

describe('HQRow — heal lock (D-24180 / D-24614)', () => {
  test('after a heal every hero is disabled with the heal-lock tooltip and a click submits nothing', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        hasHealedThisTurn: true,
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    assert.equal(heroes.length, 3);
    for (const button of heroes) {
      assert.equal(button.attributes('disabled'), '');
      assert.match(button.attributes('title')!, /cannot recruit or fight after healing this turn/);
      assert.match(button.find('[data-testid="card-tile"]').attributes('title')!, /cannot recruit or fight after healing this turn/);
    }
    await heroes[0]!.trigger('click');
    assert.equal(calls.length, 0);
  });

  test('the heal lock outranks the cost tooltip (turn, stage, heal lock, then resource)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        hasHealedThisTurn: true,
        economy: economy({ recruit: 0, availableRecruit: 0 }),
        submitMove,
      },
    });
    for (const button of wrapper.findAll('[data-testid="play-hq-hero"]')) {
      assert.match(button.attributes('title')!, /cannot recruit or fight after healing this turn/);
    }
  });

  test('without a heal the affordable heroes stay enabled', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        hasHealedThisTurn: false,
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    for (const button of wrapper.findAll('[data-testid="play-hq-hero"]')) {
      assert.equal(button.attributes('disabled'), undefined);
    }
    // An enabled tile keeps the card name as its hover text.
    const enabledTiles = wrapper.findAll('[data-testid="play-hq-hero"] [data-testid="card-tile"]');
    assert.deepEqual(
      enabledTiles.map((tile) => tile.attributes('title')),
      ['Captain America', 'Iron Man', 'Spider-Man'],
    );
  });
});

describe('HQRow — a City larger than five spaces (WP-831 / D-24764)', () => {
  test('each extra City space adds a blank leading cell when column-aligned, none otherwise', () => {
    const { submitMove } = recorder();
    const aligned = mount(HQRow, {
      props: { hq: fullHq(), decks: DECKS, currentStage: 'main', economy: economy(), submitMove, isColumnAligned: true, extraCitySpaces: 1 },
    });
    assert.equal(aligned.findAll('[data-testid="play-hq-extra-spacer"]').length, 1);
    assert.equal(aligned.findAll('[data-testid="play-hq-hero"]').length + aligned.findAll('[data-testid="play-hq-empty"]').length, 5, 'the HQ is still five');
    const normal = mount(HQRow, {
      props: { hq: fullHq(), decks: DECKS, currentStage: 'main', economy: economy(), submitMove, isColumnAligned: true },
    });
    assert.equal(normal.findAll('[data-testid="play-hq-extra-spacer"]').length, 0);
  });
});

describe('HQRow — table-perspective hover lift (WP-852 / D-24788)', () => {
  /** Mounts the HQ with the given lift flag (omitted when undefined). */
  function mountLift(isTiltLiftEnabled: boolean | undefined) {
    const { submitMove } = recorder();
    const liftProp = isTiltLiftEnabled === undefined ? {} : { isTiltLiftEnabled };
    return mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ availableRecruit: 9 }),
        submitMove,
        ...liftProp,
      },
    });
  }

  /** Stubs the slot list's scroll metrics and re-measures the fit via a window resize. */
  async function setSlotsFit(slots: Element, isFitting: boolean): Promise<void> {
    const scrollWidth = isFitting ? 300 : 900;
    Object.defineProperty(slots, 'scrollWidth', { value: scrollWidth, configurable: true });
    Object.defineProperty(slots, 'clientWidth', { value: 300, configurable: true });
    window.dispatchEvent(new window.Event('resize'));
    await nextTick();
  }

  test('without isTiltLiftEnabled there is no lift class, and every hero button carries hq-slot__hero', async () => {
    const wrapper = mountLift(undefined);
    await setSlotsFit(wrapper.find('ol.hq-slots').element, true);
    assert.equal(wrapper.find('[data-testid="play-hq-row"]').classes().includes('hq-row--tilt-lift'), false);
    const heroButtons = wrapper.findAll('[data-testid="play-hq-hero"]');
    assert.ok(heroButtons.length > 0, 'the HQ renders hero buttons');
    for (const heroButton of heroButtons) {
      assert.equal(heroButton.classes().includes('hq-slot__hero'), true);
    }
    wrapper.unmount();
  });

  test('with isTiltLiftEnabled and slots that fit, the root gains hq-row--tilt-lift', async () => {
    const wrapper = mountLift(true);
    await setSlotsFit(wrapper.find('ol.hq-slots').element, true);
    assert.equal(wrapper.find('[data-testid="play-hq-row"]').classes().includes('hq-row--tilt-lift'), true);
    wrapper.unmount();
  });

  test('with isTiltLiftEnabled and slots that scroll sideways, the lift class is absent', async () => {
    const wrapper = mountLift(true);
    await setSlotsFit(wrapper.find('ol.hq-slots').element, false);
    assert.equal(wrapper.find('[data-testid="play-hq-row"]').classes().includes('hq-row--tilt-lift'), false);
    wrapper.unmount();
  });
});
