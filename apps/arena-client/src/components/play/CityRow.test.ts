import '../../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import CityRow from './CityRow.vue';
import type {
  UICityCard,
  UICityState,
  UIDecksState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';
import {
  useSlashGestureSetting,
  __resetSlashGestureSettingForTests,
} from '../../composables/useSlashGestureSetting';
import { __resetSlashGestureSignalsForTests } from '../../composables/useSlashGesture';

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

function villain(extId: string, cost: number): UICityCard {
  return {
    extId,
    type: 'villain',
    keywords: [],
    display: {
      extId,
      name: extId,
      imageUrl: `https://images.legendary-arena.com/${extId}.png`,
      cost,
    },
    attachedHeroes: [],
    attachedHeroDisplay: [],
    attachedBystanderCount: 0,
    fightCost: 0,
  };
}

function fullCity(): UICityState {
  return {
    spaces: [
      villain('doom-bot', 3),
      null,
      villain('electro', 5),
      null,
      villain('thug', 2),
    ],
    escapedPile: [],
  };
}

const DECKS: UIDecksState = { villainDeckCount: 14, heroDeckCount: 0 };

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

describe('CityRow (WP-129 — extends WP-100)', () => {
  test('renders 7-cell row: escaped + 5 slots + villain deck', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-escaped-pile"]').exists(), true);
    const villains = wrapper.findAll('[data-testid="play-city-villain"]');
    const empties = wrapper.findAll('[data-testid="play-city-empty"]');
    assert.equal(villains.length + empties.length, 5);
    assert.equal(wrapper.find('[data-testid="play-city-villain-deck"]').exists(), true);
  });

  test('villain buttons render in visual left-to-right order with engine indices reversed', () => {
    // why: fullCity() has occupants at engine indices 0 (doom-bot,
    // newly entered), 2 (electro), 4 (thug, about to escape). Visually
    // these render as Bridge=engine4=thug, Rooftops=engine2=electro,
    // Sewers=engine0=doom-bot — so reading left-to-right the
    // data-city-index attributes are 4, 2, 0 (entry edge sits on the
    // right per DESIGN-BOARD-LAYOUT.md §7.1).
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    const villains = wrapper.findAll('[data-testid="play-city-villain"]');
    const indices = villains.map((b) => b.attributes('data-city-index'));
    assert.deepEqual(indices, ['4', '2', '0']);
  });

  test('clicking a villain emits fightVillain with cityIndex', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    void wrapper.findAll('[data-testid="play-city-villain"]')[1]!.trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'fightVillain');
    assert.deepEqual(calls[0]!.args, { cityIndex: 2 });
  });

  // why: WP-738 / D-24561 — the "Fight using Excessive Violence" per-villain opt-in.
  // Shown only when the availability cue is set AND the villain is affordable at
  // cost+1; submits the useExcessiveViolence intent; the normal fight is unchanged.
  test('no Excessive Violence buttons when the availability cue is absent', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    assert.equal(wrapper.findAll('[data-testid="play-city-villain-ev"]').length, 0);
  });

  test('shows an Excessive Violence button on each fightable villain affordable at cost+1', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        // why: availableAttack 9 clears cost+1 for every villain (3/5/2 → 4/6/3).
        economy: economy({ attack: 9, availableAttack: 9, excessiveViolenceAvailable: true }),
        submitMove,
      },
    });
    assert.equal(wrapper.findAll('[data-testid="play-city-villain-ev"]').length, 3);
  });

  test('the Excessive Violence button renders the crossed-swords SVG icon (not a bare glyph)', () => {
    // why: graphic fix-forward 2026-09-22 — the button previously used a bare U+2694
    // codepoint the play-surface font does not carry, so it silently collapsed to
    // text and operators missed it. Lock the inline SVG in so it cannot regress.
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9, excessiveViolenceAvailable: true }),
        submitMove,
      },
    });
    const firstEvButton = wrapper.findAll('[data-testid="play-city-villain-ev"]')[0]!;
    assert.equal(firstEvButton.find('svg.crossed-swords-icon').exists(), true);
    assert.match(firstEvButton.text(), /\+1/);
  });

  test('hides the Excessive Violence button on a villain unaffordable at cost+1', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        // why: availableAttack 3 clears cost+1 only for thug (cost 2 → needs 3);
        // doom-bot (3 → needs 4) and electro (5 → needs 6) are not EV-affordable.
        economy: economy({ attack: 3, availableAttack: 3, excessiveViolenceAvailable: true }),
        submitMove,
      },
    });
    const evButtons = wrapper.findAll('[data-testid="play-city-villain-ev"]');
    assert.equal(evButtons.length, 1);
    assert.equal(evButtons[0]!.attributes('data-city-index'), '4');
  });

  test('clicking the Excessive Violence button submits fightVillain with useExcessiveViolence', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9, excessiveViolenceAvailable: true }),
        submitMove,
      },
    });
    // why: visual order is [4, 2, 0]; index [1] is engine cityIndex 2 (electro).
    void wrapper.findAll('[data-testid="play-city-villain-ev"]')[1]!.trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'fightVillain');
    assert.deepEqual(calls[0]!.args, { cityIndex: 2, useExcessiveViolence: true });
  });

  test('the normal fight button omits useExcessiveViolence even when EV is available', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9, excessiveViolenceAvailable: true }),
        submitMove,
      },
    });
    void wrapper.findAll('[data-testid="play-city-villain"]')[1]!.trigger('click');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.args, { cityIndex: 2 });
  });

  test('disables villains with stage tooltip when currentStage is not main', () => {
    const { submitMove } = recorder();
    for (const stage of ['start', 'cleanup'] as const) {
      const wrapper = mount(CityRow, {
        props: {
          city: fullCity(),
          decks: DECKS,
          currentStage: stage,
          economy: economy({ attack: 9, availableAttack: 9 }),
          submitMove,
        },
      });
      const villains = wrapper.findAll('[data-testid="play-city-villain"]');
      for (const button of villains) {
        assert.equal(button.attributes('disabled'), '');
        assert.match(button.attributes('title')!, /Only available during the Main/);
      }
    }
  });

  test('disables villains with cost tooltip when economy is short (precedence: stage met first)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ attack: 4, availableAttack: 4 }),
        submitMove,
      },
    });
    const villains = wrapper.findAll('[data-testid="play-city-villain"]');
    // electro costs 5; available=4 → disabled with cost reason
    const electro = villains.find((b) => b.attributes('data-card-id') === 'electro');
    assert.notEqual(electro, undefined);
    assert.equal(electro!.attributes('disabled'), '');
    assert.match(electro!.attributes('title')!, /Needs 5 attack, you have 4\./);

    // doom-bot costs 3; available=4 → enabled
    const doom = villains.find((b) => b.attributes('data-card-id') === 'doom-bot');
    assert.equal(doom!.attributes('disabled'), undefined);
  });

  test('villain deck cell reflects decks.villainDeckCount', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: { villainDeckCount: 22, heroDeckCount: 0 },
        currentStage: 'main',
        economy: economy({ availableAttack: 9 }),
        submitMove,
      },
    });
    assert.match(
      wrapper.find('[data-testid="play-city-villain-deck"]').text(),
      /\[22\]/,
    );
  });
});

describe('CityRow — captured cards under villains (WP-505)', () => {
  function cityWithCaptures(): UICityState {
    return {
      spaces: [
        {
          extId: 'captor',
          type: 'villain',
          keywords: [],
          display: {
            extId: 'captor',
            name: 'Captor',
            imageUrl: 'https://images.legendary-arena.com/captor.png',
            cost: 3,
          },
          attachedHeroes: ['hero-1'],
          attachedHeroDisplay: [
            {
              extId: 'hero-1',
              name: 'Spider-Man',
              imageUrl: 'https://images.legendary-arena.com/hero-1.png',
              cost: 0,
            },
          ],
          attachedBystanderCount: 2,
          fightCost: 3,
        },
        null,
        null,
        null,
        null,
      ],
      escapedPile: [],
    };
  }

  test('renders face-up captured hero art under the villain', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: cityWithCaptures(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    const heroes = wrapper.findAll('[data-testid="play-city-captured-hero"]');
    assert.equal(heroes.length, 1);
  });

  test('renders a count-only bystander badge, never the identity', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: cityWithCaptures(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    const badge = wrapper.find('[data-testid="play-city-captured-bystanders"]');
    assert.equal(badge.exists(), true);
    // why (Jeff feedback): the badge is now a compact icon + count (no "N captured"
    // text) — assert the count shows and the full phrase lives on the aria-label.
    assert.match(badge.text(), /2/);
    assert.equal(badge.attributes('aria-label'), '2 bystanders captured');
  });

  test('renders no captured block when a villain holds nothing', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ attack: 9, availableAttack: 9 }),
        submitMove,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-city-captured"]').exists(), false);
  });
});

describe('CityRow — Dark Portal markers (WP-727 / D-24548)', () => {
  test("renders a marker on each portal'd space, including an EMPTY one", () => {
    // why: fullCity() has villains at engine indices 0/2/4 and empties at 1/3.
    // darkPortalIndices [3,4] covers one empty space (3) + one occupied (4) —
    // both must show a marker, because a Dark Portal buffs the SPACE.
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy(),
        darkPortalIndices: [3, 4],
        darkPortalBonus: 1,
        submitMove,
      },
    });
    const markers = wrapper.findAll('[data-testid="dark-portal-marker"]');
    assert.equal(markers.length, 2, "one marker per portal'd space (empty + occupied)");
    for (const marker of markers) {
      assert.match(marker.text(), /\+1/, 'shows the served +N attack');
    }
  });

  test("renders the marker over an EMPTY portal'd space", () => {
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy(),
        darkPortalIndices: [3],
        darkPortalBonus: 1,
        submitMove,
      },
    });
    assert.equal(wrapper.findAll('[data-testid="dark-portal-marker"]').length, 1);
  });

  test('renders no markers when there are no portals (non-Portals scheme default)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: fullCity(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy(),
        submitMove,
      },
    });
    assert.equal(wrapper.findAll('[data-testid="dark-portal-marker"]').length, 0);
  });
});

// ---------------------------------------------------------------------------
// WP-756 / D-24585 — the slash gesture wired through the row's DOM adapter.
// ---------------------------------------------------------------------------

/** A pointer-shaped MouseEvent (jsdom has no pointer-event class, so the fields are added). */
function pointerEvent(
  type: string,
  clientX: number,
  clientY: number,
  pointerType = 'mouse',
): MouseEvent {
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button: 0,
  });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
}

/** Stubs each villain button's rect: engine index i → an 80×110 tile at x = 100 + i·100. */
function stubVillainRects(root: Element): void {
  for (const button of Array.from(root.querySelectorAll('[data-testid="play-city-villain"]'))) {
    const cityIndex = Number(button.getAttribute('data-city-index'));
    const left = 100 + cityIndex * 100;
    (button as HTMLElement).getBoundingClientRect = () =>
      ({
        left,
        top: 100,
        width: 80,
        height: 110,
        right: left + 80,
        bottom: 210,
        x: left,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
  }
}

function mountForGesture(submitMove: SubmitMove) {
  return mount(CityRow, {
    props: {
      city: fullCity(),
      decks: DECKS,
      currentStage: 'main',
      economy: economy({ attack: 9, availableAttack: 9 }),
      submitMove,
    },
  });
}

describe('CityRow — slash gesture (WP-756)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetSlashGestureSettingForTests();
    __resetSlashGestureSignalsForTests();
  });

  test('a mouse stroke across a villain submits fightVillain({ cityIndex }) and eats the trailing click', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mountForGesture(submitMove);
    await nextTick();
    stubVillainRects(wrapper.element);
    const row = wrapper.find('ol.city-spaces').element;
    row.dispatchEvent(pointerEvent('pointerdown', 60, 150));
    row.dispatchEvent(pointerEvent('pointermove', 190, 150));
    row.dispatchEvent(pointerEvent('pointerup', 190, 150));
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'fightVillain');
    assert.deepEqual(calls[0]!.args, { cityIndex: 0 });
    // The click the browser fires after the stroke's pointerup is swallowed.
    const villainZero = wrapper.find('[data-testid="play-city-villain"][data-city-index="0"]');
    (villainZero.element as HTMLButtonElement).click();
    assert.equal(calls.length, 1);
    wrapper.unmount();
  });

  test('a plain click still fights with the gesture on', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mountForGesture(submitMove);
    await nextTick();
    await wrapper.find('[data-testid="play-city-villain"][data-city-index="2"]').trigger('click');
    assert.deepEqual(calls, [{ name: 'fightVillain', args: { cityIndex: 2 } }]);
    wrapper.unmount();
  });

  test('with the setting on: gesture classes present and dragstart is prevented', async () => {
    const { submitMove } = recorder();
    const wrapper = mountForGesture(submitMove);
    await nextTick();
    const row = wrapper.find('ol.city-spaces');
    assert.ok(row.classes().includes('city-spaces--gesture'));
    assert.ok(row.classes().includes('city-spaces--gesture-touch'));
    const drag = new window.Event('dragstart', { bubbles: true, cancelable: true });
    wrapper.find('[data-testid="play-city-villain"]').element.dispatchEvent(drag);
    assert.equal(drag.defaultPrevented, true);
    wrapper.unmount();
  });

  test('with the setting off: no gesture classes, no dragstart prevention, strokes do nothing', async () => {
    useSlashGestureSetting().setEnabled(false);
    const { calls, submitMove } = recorder();
    const wrapper = mountForGesture(submitMove);
    await nextTick();
    stubVillainRects(wrapper.element);
    const row = wrapper.find('ol.city-spaces');
    assert.equal(row.attributes('class'), 'city-spaces');
    const drag = new window.Event('dragstart', { bubbles: true, cancelable: true });
    wrapper.find('[data-testid="play-city-villain"]').element.dispatchEvent(drag);
    assert.equal(drag.defaultPrevented, false);
    row.element.dispatchEvent(pointerEvent('pointerdown', 60, 150));
    row.element.dispatchEvent(pointerEvent('pointermove', 190, 150));
    row.element.dispatchEvent(pointerEvent('pointerup', 190, 150));
    assert.equal(calls.length, 0);
    wrapper.unmount();
  });
});
