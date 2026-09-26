import '../../testing/jsdom-setup';

import { describe, test, beforeEach, afterEach, mock } from 'node:test';
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
    fightCost: cost,
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

// ---------------------------------------------------------------------------
// WP-761 / D-24592 — the long-press slash through the row's DOM adapter.
// ---------------------------------------------------------------------------

/** A cancelable, bubbling DOM event (touchmove / contextmenu need no fields). */
function cancelableEvent(type: string): Event {
  return new window.Event(type, { bubbles: true, cancelable: true });
}

/** A bubbling lostpointercapture carrying an explicit pointerId. */
function lostCaptureEvent(pointerId: number): Event {
  const event = new window.Event('lostpointercapture', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}

/** Stubs the row's scroll metrics and re-measures the fit via a window resize. */
async function setRowFits(row: Element, isFitting: boolean): Promise<void> {
  const scrollWidth = isFitting ? 300 : 900;
  Object.defineProperty(row, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(row, 'clientWidth', { value: 300, configurable: true });
  window.dispatchEvent(new window.Event('resize'));
  await nextTick();
}

/** Mounts the row, stubs villain rects, and makes the row overflow (the phone case). */
async function mountOverflowingRow(submitMove: SubmitMove) {
  const wrapper = mountForGesture(submitMove);
  await nextTick();
  stubVillainRects(wrapper.element);
  const row = wrapper.find('ol.city-spaces');
  await setRowFits(row.element, false);
  assert.equal(row.classes().includes('city-spaces--gesture-touch'), false);
  return { wrapper, row };
}

describe('CityRow — long-press slash (WP-761)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetSlashGestureSettingForTests();
    __resetSlashGestureSignalsForTests();
    mock.timers.enable({ apis: ['setTimeout'] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  test('a 350 ms touch hold arms: glow class, touchmove and contextmenu prevented', async () => {
    const { submitMove } = recorder();
    const { wrapper, row } = await mountOverflowingRow(submitMove);
    assert.ok(row.classes().includes('city-spaces--gesture-hold'));
    row.element.dispatchEvent(pointerEvent('pointerdown', 60, 150, 'touch'));
    mock.timers.tick(350);
    await nextTick();
    assert.ok(row.classes().includes('city-spaces--gesture-armed'));
    const move = cancelableEvent('touchmove');
    row.element.dispatchEvent(move);
    assert.equal(move.defaultPrevented, true);
    const menu = cancelableEvent('contextmenu');
    row.element.dispatchEvent(menu);
    assert.equal(menu.defaultPrevented, true);
    wrapper.unmount();
  });

  test('an armed touch stroke across two villains fights them in crossing order', async () => {
    const { calls, submitMove } = recorder();
    const { wrapper, row } = await mountOverflowingRow(submitMove);
    // Engine index 0 is at x 100..180 and index 2 at x 300..380.
    row.element.dispatchEvent(pointerEvent('pointerdown', 60, 150, 'touch'));
    mock.timers.tick(350);
    row.element.dispatchEvent(pointerEvent('pointermove', 190, 150, 'touch'));
    assert.deepEqual(calls, [{ name: 'fightVillain', args: { cityIndex: 0 } }]);
    await wrapper.setProps({
      city: {
        spaces: [null, null, villain('electro', 5), null, villain('thug', 2)],
        escapedPile: [],
      },
    });
    row.element.dispatchEvent(pointerEvent('pointermove', 390, 150, 'touch'));
    await nextTick();
    assert.deepEqual(calls[1], { name: 'fightVillain', args: { cityIndex: 2 } });
    wrapper.unmount();
  });

  test('without an arm a touchmove is NOT prevented (native scroll)', async () => {
    const { submitMove } = recorder();
    const { wrapper, row } = await mountOverflowingRow(submitMove);
    const idle = cancelableEvent('touchmove');
    row.element.dispatchEvent(idle);
    assert.equal(idle.defaultPrevented, false);
    row.element.dispatchEvent(pointerEvent('pointerdown', 60, 150, 'touch'));
    const pending = cancelableEvent('touchmove');
    row.element.dispatchEvent(pending);
    assert.equal(pending.defaultPrevented, false);
    wrapper.unmount();
  });

  test('a contextmenu while the long press is still pending is prevented', async () => {
    const { submitMove } = recorder();
    const { wrapper, row } = await mountOverflowingRow(submitMove);
    row.element.dispatchEvent(pointerEvent('pointerdown', 60, 150, 'touch'));
    mock.timers.tick(200);
    const menu = cancelableEvent('contextmenu');
    row.element.dispatchEvent(menu);
    assert.equal(menu.defaultPrevented, true);
    wrapper.unmount();
  });

  test('the row fitting mid-stroke keeps the hold listeners until the long press ends', async () => {
    const { submitMove } = recorder();
    const { wrapper, row } = await mountOverflowingRow(submitMove);
    row.element.dispatchEvent(pointerEvent('pointerdown', 60, 150, 'touch'));
    await setRowFits(row.element, true);
    const pendingMenu = cancelableEvent('contextmenu');
    row.element.dispatchEvent(pendingMenu);
    assert.equal(pendingMenu.defaultPrevented, true);
    mock.timers.tick(350);
    await setRowFits(row.element, true);
    assert.ok(row.classes().includes('city-spaces--gesture-armed'));
    assert.ok(row.classes().includes('city-spaces--gesture-hold'));
    const armedMove = cancelableEvent('touchmove');
    row.element.dispatchEvent(armedMove);
    assert.equal(armedMove.defaultPrevented, true);
    row.element.dispatchEvent(pointerEvent('pointerup', 60, 150, 'touch'));
    await nextTick();
    assert.equal(row.classes().includes('city-spaces--gesture-hold'), false);
    const afterMove = cancelableEvent('touchmove');
    row.element.dispatchEvent(afterMove);
    assert.equal(afterMove.defaultPrevented, false);
    wrapper.unmount();
  });

  test('on a fitting row there is no hold class and nothing is prevented', async () => {
    const { submitMove } = recorder();
    const wrapper = mountForGesture(submitMove);
    await nextTick();
    const row = wrapper.find('ol.city-spaces');
    assert.ok(row.classes().includes('city-spaces--gesture-touch'));
    assert.equal(row.classes().includes('city-spaces--gesture-hold'), false);
    const move = cancelableEvent('touchmove');
    row.element.dispatchEvent(move);
    const menu = cancelableEvent('contextmenu');
    row.element.dispatchEvent(menu);
    assert.equal(move.defaultPrevented, false);
    assert.equal(menu.defaultPrevented, false);
    wrapper.unmount();
  });

  test('lostpointercapture on the row ends the arm; one bubbling from a child tile does not', async () => {
    const { submitMove } = recorder();
    const { wrapper, row } = await mountOverflowingRow(submitMove);
    row.element.dispatchEvent(pointerEvent('pointerdown', 60, 150, 'touch'));
    mock.timers.tick(350);
    await nextTick();
    const tile = wrapper.find('[data-testid="play-city-villain"]').element;
    tile.dispatchEvent(lostCaptureEvent(1));
    await nextTick();
    assert.ok(row.classes().includes('city-spaces--gesture-armed'));
    row.element.dispatchEvent(lostCaptureEvent(1));
    await nextTick();
    assert.equal(row.classes().includes('city-spaces--gesture-armed'), false);
    wrapper.unmount();
  });

  test('setting off while armed removes the glow; re-enabled, an unarmed touchmove is not prevented', async () => {
    const { submitMove } = recorder();
    const { wrapper, row } = await mountOverflowingRow(submitMove);
    row.element.dispatchEvent(pointerEvent('pointerdown', 60, 150, 'touch'));
    mock.timers.tick(350);
    await nextTick();
    assert.ok(row.classes().includes('city-spaces--gesture-armed'));
    useSlashGestureSetting().setEnabled(false);
    await nextTick();
    assert.equal(row.classes().includes('city-spaces--gesture-armed'), false);
    useSlashGestureSetting().setEnabled(true);
    await nextTick();
    const move = cancelableEvent('touchmove');
    row.element.dispatchEvent(move);
    assert.equal(move.defaultPrevented, false);
    wrapper.unmount();
  });

  test('setting off: a 350 ms hold arms nothing and touchmove / contextmenu are not prevented', async () => {
    useSlashGestureSetting().setEnabled(false);
    const { submitMove } = recorder();
    const wrapper = mountForGesture(submitMove);
    await nextTick();
    const row = wrapper.find('ol.city-spaces');
    await setRowFits(row.element, false);
    assert.equal(row.attributes('class'), 'city-spaces');
    row.element.dispatchEvent(pointerEvent('pointerdown', 60, 150, 'touch'));
    mock.timers.tick(350);
    await nextTick();
    assert.equal(row.attributes('class'), 'city-spaces');
    const move = cancelableEvent('touchmove');
    row.element.dispatchEvent(move);
    const menu = cancelableEvent('contextmenu');
    row.element.dispatchEvent(menu);
    assert.equal(move.defaultPrevented, false);
    assert.equal(menu.defaultPrevented, false);
    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// WP-750 / D-24574 — Fight gates on the engine's projected fightCost, not the
// printed display.cost, and a Fight N badge shows the projected cost on mismatch.
// ---------------------------------------------------------------------------

/** A villain whose printed cost and engine-projected fight cost differ. */
function villainWithFightCost(extId: string, printedCost: number | null, fightCost: number): UICityCard {
  const card = villain(extId, 0);
  return {
    ...card,
    display: { ...card.display, cost: printedCost },
    fightCost,
  };
}

/**
 * A City with a Dark-Portal villain (printed 3, projected 4) at engine index 0,
 * a no-printed-attack villain (projected 0) at index 2, and a matching villain
 * (printed 2, projected 2) at index 4.
 */
function projectedCostCity(): UICityState {
  return {
    spaces: [
      villainWithFightCost('portal-villain', 3, 4),
      null,
      villainWithFightCost('attackless-villain', null, 0),
      null,
      villain('thug', 2),
    ],
    escapedPile: [],
  };
}

function mountProjected(submitMove: SubmitMove, availableAttack: number, isEvAvailable = false) {
  const evField = isEvAvailable ? { excessiveViolenceAvailable: true } : {};
  return mount(CityRow, {
    props: {
      city: projectedCostCity(),
      decks: DECKS,
      currentStage: 'main',
      economy: economy({ attack: availableAttack, availableAttack, ...evField }),
      submitMove,
    },
  });
}

describe('CityRow — projected fight cost (WP-750 / D-24574)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetSlashGestureSettingForTests();
    __resetSlashGestureSignalsForTests();
  });

  test('fightCost above printed disables Fight at printed attack, hides EV, and shows the badge', () => {
    const { submitMove } = recorder();
    const wrapper = mountProjected(submitMove, 3, true);
    const portal = wrapper.find('[data-testid="play-city-villain"][data-card-id="portal-villain"]');
    assert.equal(portal.attributes('disabled'), '');
    assert.match(portal.attributes('title')!, /Needs 4 attack, you have 3\./);
    assert.equal(
      wrapper.find('[data-testid="play-city-villain-ev"][data-city-index="0"]').exists(),
      false,
    );
    const badge = portal.find('[data-testid="play-city-fight-cost"]');
    assert.equal(badge.exists(), true);
    assert.equal(badge.text(), 'Fight 4');
  });

  test('a null printed cost with fightCost 0 is fightable and shows "Fight 0"', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mountProjected(submitMove, 0);
    const attackless = wrapper.find('[data-testid="play-city-villain"][data-card-id="attackless-villain"]');
    assert.equal(attackless.attributes('disabled'), undefined);
    assert.equal(attackless.attributes('title'), undefined);
    assert.equal(attackless.find('[data-testid="play-city-fight-cost"]').text(), 'Fight 0');
    await attackless.trigger('click');
    assert.deepEqual(calls, [{ name: 'fightVillain', args: { cityIndex: 2 } }]);
  });

  test('a villain whose fightCost equals its printed cost shows no badge', () => {
    const { submitMove } = recorder();
    const wrapper = mountProjected(submitMove, 9);
    const thug = wrapper.find('[data-testid="play-city-villain"][data-card-id="thug"]');
    assert.equal(thug.find('[data-testid="play-city-fight-cost"]').exists(), false);
    assert.equal(wrapper.findAll('[data-testid="play-city-fight-cost"]').length, 2);
  });

  test('the slash gesture fights exactly what the Fight button allows (gateForCityIndex)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mountProjected(submitMove, 3);
    await nextTick();
    stubVillainRects(wrapper.element);
    const row = wrapper.find('ol.city-spaces').element;
    // why: a stroke across engine indices 0 (portal, projected 4 > 3 attack) and
    // 2 (attackless, projected 0) — only the one the button allows is fought.
    row.dispatchEvent(pointerEvent('pointerdown', 60, 150));
    row.dispatchEvent(pointerEvent('pointermove', 390, 150));
    row.dispatchEvent(pointerEvent('pointerup', 390, 150));
    assert.deepEqual(calls, [{ name: 'fightVillain', args: { cityIndex: 2 } }]);
    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// Jeff feedback (match 25-GJ0oXBwy) — the Fight N badge is loud when it explains
// a disabled Fight: the viewer's Main stage and the projected cost is unaffordable.
// ---------------------------------------------------------------------------

describe('CityRow — louder unaffordable Fight N badge', () => {
  const UNAFFORDABLE = 'city-space__fight-cost--unaffordable';

  function badgeFor(wrapper: ReturnType<typeof mount>, cardId: string) {
    return wrapper
      .find(`[data-testid="play-city-villain"][data-card-id="${cardId}"]`)
      .find('[data-testid="play-city-fight-cost"]');
  }

  test('an unaffordable projected cost in the Main stage makes the badge loud', () => {
    const { submitMove } = recorder();
    const wrapper = mountProjected(submitMove, 3);
    assert.equal(badgeFor(wrapper, 'portal-villain').classes().includes(UNAFFORDABLE), true);
    assert.equal(badgeFor(wrapper, 'attackless-villain').classes().includes(UNAFFORDABLE), false);
  });

  test('an affordable projected cost keeps the quiet badge', () => {
    const { submitMove } = recorder();
    const wrapper = mountProjected(submitMove, 4);
    assert.equal(badgeFor(wrapper, 'portal-villain').classes().includes(UNAFFORDABLE), false);
  });

  test('outside the Main stage the badge stays quiet even when unaffordable', () => {
    const { submitMove } = recorder();
    const wrapper = mount(CityRow, {
      props: {
        city: projectedCostCity(),
        decks: DECKS,
        currentStage: 'start',
        economy: economy({ attack: 0, availableAttack: 0 }),
        submitMove,
      },
    });
    assert.equal(badgeFor(wrapper, 'portal-villain').exists(), true);
    assert.equal(badgeFor(wrapper, 'portal-villain').classes().includes(UNAFFORDABLE), false);
  });
});
