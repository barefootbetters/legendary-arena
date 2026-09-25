import '../testing/jsdom-setup';

import { describe, test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { effectScope, nextTick, ref, watch, type EffectScope, type Ref } from 'vue';
import type { UICityCard, UICityState } from '@legendary-arena/game-engine';
import {
  TARGET_CONFIRM_TIMEOUT_MS,
  useBladeTrailSignal,
  useSlashGesture,
  useSliceAngleHints,
  __resetSlashGestureSignalsForTests,
  type SlashGestureController,
  type SlashPointerSample,
} from './useSlashGesture';
import { strokeAngleDeg } from '../lib/slashGestureGeometry';

// ---------------------------------------------------------------------------
// Harness — the controller seam (WP-756 §H): effectScope, injected capture,
// stubbed rects and widths, mock.timers (setTimeout only).
// ---------------------------------------------------------------------------

/** A minimal projected City card — only extId matters to the gesture. */
function card(extId: string): UICityCard {
  return {
    extId,
    type: 'villain',
    keywords: [],
    display: { extId, name: extId, imageUrl: '', cost: 1 },
    attachedHeroes: [],
    attachedHeroDisplay: [],
    attachedBystanderCount: 0,
    fightCost: 0,
  };
}

/** A fresh City snapshot (a NEW object every call, like the wholesale store replace). */
function cityOf(extIds: (string | null)[]): UICityState {
  return {
    spaces: extIds.map((extId) => (extId === null ? null : card(extId))),
    escapedPile: [],
  };
}

/** The tile rect for engine index `i`: 80×110 tiles, 100 px apart, top 100. */
function tileRect(cityIndex: number): DOMRect {
  const left = 100 + cityIndex * 100;
  return {
    left,
    top: 100,
    width: 80,
    height: 110,
    right: left + 80,
    bottom: 210,
    x: left,
    y: 100,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Builds a row with one villain button per engine index 0..4 (rects stubbed). */
function buildRow(): HTMLElement {
  const row = document.createElement('ol');
  for (let cityIndex = 0; cityIndex < 5; cityIndex += 1) {
    const button = document.createElement('button');
    button.setAttribute('data-testid', 'play-city-villain');
    button.setAttribute('data-city-index', String(cityIndex));
    button.getBoundingClientRect = () => tileRect(cityIndex);
    row.appendChild(button);
  }
  return row;
}

/** Stubs an element's horizontal scroll metrics. */
function stubWidths(element: HTMLElement, scrollWidth: number, clientWidth: number): void {
  Object.defineProperty(element, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(element, 'clientWidth', { value: clientWidth, configurable: true });
}

interface Harness {
  controller: SlashGestureController;
  cityRef: Ref<UICityState>;
  submits: number[];
  captures: number[];
  allowed: Set<number>;
  isEnabled: Ref<boolean>;
  scope: EffectScope;
  row: HTMLElement;
}

const openScopes: EffectScope[] = [];
const mountedNodes: HTMLElement[] = [];

/** Creates a controller inside its own effectScope. */
function createHarness(
  extIds: (string | null)[],
  options: { row?: HTMLElement; isEnabled?: boolean; container?: HTMLElement } = {},
): Harness {
  const row = options.row ?? buildRow();
  const host = options.container ?? row;
  if (host.parentElement === null) {
    document.body.appendChild(host);
    mountedNodes.push(host);
  }
  const cityRef = ref(cityOf(extIds)) as Ref<UICityState>;
  const submits: number[] = [];
  const captures: number[] = [];
  const allowed = new Set<number>([0, 1, 2, 3, 4]);
  const isEnabled = ref(options.isEnabled ?? true);
  const scope = effectScope();
  openScopes.push(scope);
  const controller = scope.run(() =>
    useSlashGesture({
      rowElement: ref(row),
      city: () => cityRef.value,
      gateForCityIndex: (cityIndex) => allowed.has(cityIndex),
      submitFight: (cityIndex) => {
        submits.push(cityIndex);
      },
      isEnabled,
      capturePointer: (pointerId) => {
        captures.push(pointerId);
      },
    }),
  ) as SlashGestureController;
  return { controller, cityRef, submits, captures, allowed, isEnabled, scope, row };
}

function mouse(x: number, y: number, pointerId = 1): SlashPointerSample {
  return { x, y, pointerType: 'mouse', button: 0, pointerId };
}

function touch(x: number, y: number, pointerId = 7): SlashPointerSample {
  return { x, y, pointerType: 'touch', button: 0, pointerId };
}

function pen(x: number, y: number, pointerId = 9): SlashPointerSample {
  return { x, y, pointerType: 'pen', button: 0, pointerId };
}

/** Drives a full stroke through the given samples (down, moves…, up). */
function stroke(controller: SlashGestureController, samples: SlashPointerSample[]): void {
  const first = samples[0] as SlashPointerSample;
  controller.handlePointerDown(first);
  for (let i = 1; i < samples.length; i += 1) {
    controller.handlePointerMove(samples[i] as SlashPointerSample);
  }
  controller.handlePointerUp(samples[samples.length - 1] as SlashPointerSample);
}

// A horizontal mouse stroke at y=150 from x=60 across tiles 0 (100..180) and 1 (200..280).
const ACROSS_ZERO_AND_ONE = [mouse(60, 150), mouse(150, 150), mouse(290, 150)];
// Across tiles 0, 1 and 2 (300..380).
const ACROSS_ZERO_ONE_TWO = [mouse(60, 150), mouse(150, 150), mouse(390, 150)];
// Across tile 0 only.
const ACROSS_ZERO = [mouse(60, 150), mouse(190, 150)];

beforeEach(() => {
  __resetSlashGestureSignalsForTests();
  mock.timers.enable({ apis: ['setTimeout'] });
});

afterEach(() => {
  mock.timers.reset();
  while (openScopes.length > 0) openScopes.pop()?.stop();
  while (mountedNodes.length > 0) mountedNodes.pop()?.remove();
});

describe('useSlashGesture — taps and click suppression (WP-756 §H)', () => {
  test('a mouse press moving < 8 px never captures and never arms suppression', () => {
    const { controller, captures, submits } = createHarness(['a', 'b', null, null, null]);
    controller.handlePointerDown(mouse(60, 150));
    const result = controller.handlePointerMove(mouse(66, 150));
    controller.handlePointerUp(mouse(66, 150));
    assert.equal(result.hasStartedGesture, false);
    assert.deepEqual(captures, []);
    assert.deepEqual(submits, []);
    assert.equal(controller.shouldSuppressClick(), false);
  });

  test('a 12 px touch press on a fitting row never captures and arms nothing', () => {
    const { controller, captures } = createHarness(['a', null, null, null, null]);
    assert.equal(controller.isTouchGestureEnabled.value, true);
    controller.handlePointerDown(touch(60, 150));
    const result = controller.handlePointerMove(touch(72, 150));
    controller.handlePointerUp(touch(72, 150));
    assert.equal(result.hasStartedGesture, false);
    assert.deepEqual(captures, []);
    assert.equal(controller.shouldSuppressClick(), false);
  });

  test('a 12 px pen press behaves the same way (16 px start distance)', () => {
    const { controller, captures } = createHarness(['a', null, null, null, null]);
    controller.handlePointerDown(pen(60, 150));
    assert.equal(controller.handlePointerMove(pen(72, 150)).hasStartedGesture, false);
    controller.handlePointerUp(pen(72, 150));
    assert.deepEqual(captures, []);
  });

  test('a 12 px touch press inside a tile is a tap: no gesture, no fight, no suppression', () => {
    const { controller, submits, captures } = createHarness(['a', null, null, null, null]);
    controller.handlePointerDown(touch(140, 150));
    controller.handlePointerMove(touch(152, 150));
    controller.handlePointerUp(touch(152, 150));
    assert.deepEqual(submits, []);
    assert.deepEqual(captures, []);
    assert.equal(controller.shouldSuppressClick(), false);
  });

  test('a mouse gesture captures, arms suppression, and suppresses the next click once', () => {
    const { controller, captures } = createHarness(['a', null, null, null, null]);
    stroke(controller, ACROSS_ZERO);
    assert.deepEqual(captures, [1]);
    assert.equal(controller.shouldSuppressClick(), true);
    assert.equal(controller.shouldSuppressClick(), false);
  });

  test('a touch stroke with no trailing click never eats the next tap', () => {
    const { controller } = createHarness(['a', null, null, null, null]);
    stroke(controller, [touch(60, 150), touch(150, 150), touch(190, 150)]);
    // Cleared by the setTimeout(0) after pointerup …
    mock.timers.tick(0);
    assert.equal(controller.shouldSuppressClick(), false);
    // … and by the next pointerdown, even before that timer runs.
    stroke(controller, [touch(60, 300), touch(150, 300), touch(190, 300)]);
    controller.handlePointerDown(touch(140, 150));
    assert.equal(controller.shouldSuppressClick(), false);
  });

  test('a keydown clears an armed suppression', () => {
    const { controller } = createHarness(['a', null, null, null, null]);
    stroke(controller, ACROSS_ZERO);
    controller.handleKeyDown();
    assert.equal(controller.shouldSuppressClick(), false);
  });
});

describe('useSlashGesture — the engine-confirmed chain (WP-756 §H)', () => {
  test('two crossings: the second submits only after the first extId leaves the City', async () => {
    const { controller, cityRef, submits } = createHarness(['a', 'b', null, null, null]);
    stroke(controller, ACROSS_ZERO_AND_ONE);
    assert.deepEqual(submits, [0]);
    cityRef.value = cityOf([null, 'b', null, null, null]);
    await nextTick();
    assert.deepEqual(submits, [0, 1]);
  });

  test('after an index shift (a HYDRA insert) the next target is re-resolved by extId', async () => {
    const { controller, cityRef, submits } = createHarness(['a', 'b', null, null, null]);
    stroke(controller, ACROSS_ZERO_AND_ONE);
    cityRef.value = cityOf(['h', null, 'b', null, null]);
    await nextTick();
    assert.deepEqual(submits, [0, 2]);
  });

  test('a queued target that is gone (escaped) is skipped', async () => {
    const { controller, cityRef, submits } = createHarness(['a', 'b', null, null, null]);
    stroke(controller, ACROSS_ZERO_AND_ONE);
    cityRef.value = cityOf([null, null, null, null, null]);
    await nextTick();
    assert.deepEqual(submits, [0]);
  });

  test('a target the gate refuses before its turn is skipped', async () => {
    const { controller, cityRef, submits, allowed } = createHarness(['a', 'b', null, null, null]);
    stroke(controller, ACROSS_ZERO_AND_ONE);
    allowed.delete(1);
    cityRef.value = cityOf([null, 'b', null, null, null]);
    await nextTick();
    assert.deepEqual(submits, [0]);
  });

  test('a rejected submit skips at once (no timer) and drops its hint', async () => {
    const { controller, cityRef, submits } = createHarness(['a', 'b', null, null, null]);
    stroke(controller, ACROSS_ZERO_AND_ONE);
    assert.deepEqual(submits, [0]);
    // The next snapshot still holds 'a' — the engine rejected the fight.
    cityRef.value = cityOf(['a', 'b', null, null, null]);
    await nextTick();
    assert.deepEqual(submits, [0, 1]);
    assert.equal(useSliceAngleHints().take(0), null);
  });

  test('pending-choice sequence: A confirmed, B and C rejected — nothing more after the chain ends', async () => {
    const { controller, cityRef, submits } = createHarness(['a', 'b', 'c', null, null]);
    stroke(controller, ACROSS_ZERO_ONE_TWO);
    assert.deepEqual(submits, [0]);
    cityRef.value = cityOf([null, 'b', 'c', null, null]);
    await nextTick();
    assert.deepEqual(submits, [0, 1]);
    cityRef.value = cityOf([null, 'b', 'c', null, null]);
    await nextTick();
    assert.deepEqual(submits, [0, 1, 2]);
    cityRef.value = cityOf([null, 'b', 'c', null, null]);
    await nextTick();
    cityRef.value = cityOf([null, null, 'c', null, null]);
    await nextTick();
    mock.timers.tick(TARGET_CONFIRM_TIMEOUT_MS * 2);
    assert.deepEqual(submits, [0, 1, 2]);
    assert.equal(useSliceAngleHints().take(1), null);
    assert.equal(useSliceAngleHints().take(2), null);
  });

  test('no snapshot within 3000 ms abandons the rest, drops hints, and a late snapshot submits nothing', async () => {
    assert.ok(TARGET_CONFIRM_TIMEOUT_MS < 4000, 'the backstop stays below the 4000 ms ack window');
    assert.equal(TARGET_CONFIRM_TIMEOUT_MS, 3000);
    const { controller, cityRef, submits } = createHarness(['a', 'b', null, null, null]);
    stroke(controller, ACROSS_ZERO_AND_ONE);
    mock.timers.tick(TARGET_CONFIRM_TIMEOUT_MS - 1);
    assert.deepEqual(submits, [0]);
    mock.timers.tick(1);
    assert.equal(useSliceAngleHints().take(0), null);
    cityRef.value = cityOf([null, 'b', null, null, null]);
    await nextTick();
    assert.deepEqual(submits, [0]);
  });

  test('a new stroke during a running chain appends, and an extId in flight is not re-queued', async () => {
    const { controller, cityRef, submits } = createHarness(['a', 'b', 'c', null, null]);
    stroke(controller, ACROSS_ZERO_AND_ONE);
    assert.deepEqual(submits, [0]);
    // Second stroke re-crosses 0 (in flight) and 1 (queued), then 2 (new).
    stroke(controller, [mouse(60, 180), mouse(150, 180), mouse(390, 180)]);
    assert.deepEqual(submits, [0]);
    cityRef.value = cityOf([null, 'b', 'c', null, null]);
    await nextTick();
    cityRef.value = cityOf([null, null, 'c', null, null]);
    await nextTick();
    cityRef.value = cityOf([null, null, null, null, null]);
    await nextTick();
    assert.deepEqual(submits, [0, 1, 2]);
  });

  test('pointercancel after one completed crossing submits it and arms no suppression', () => {
    const { controller, submits } = createHarness(['a', 'b', null, null, null]);
    controller.handlePointerDown(mouse(60, 150));
    controller.handlePointerMove(mouse(190, 150));
    controller.handlePointerMove(mouse(240, 150));
    controller.handlePointerCancel(mouse(240, 150));
    assert.deepEqual(submits, [0]);
    assert.equal(controller.shouldSuppressClick(), false);
  });

  test('with the viewer not on turn (every tile refused) a stroke submits nothing', () => {
    const { controller, submits, allowed } = createHarness(['a', 'b', null, null, null]);
    allowed.clear();
    stroke(controller, ACROSS_ZERO_AND_ONE);
    assert.deepEqual(submits, []);
  });

  test('a tile click is suppressed while a chain submit is in flight; an EV click is not', async () => {
    const { controller, cityRef } = createHarness(['a', null, null, null, null]);
    controller.handlePointerDown(mouse(60, 150));
    controller.handlePointerMove(mouse(190, 150));
    controller.handlePointerCancel(mouse(190, 150));
    assert.equal(controller.shouldSuppressClick(true), true);
    assert.equal(controller.shouldSuppressClick(false), false);
    cityRef.value = cityOf([null, null, null, null, null]);
    await nextTick();
    assert.equal(controller.shouldSuppressClick(true), false);
  });

  test('a confirmed gesture fight keeps its hint for the pre-flush slice beat', async () => {
    const { controller, cityRef, scope } = createHarness(['a', null, null, null, null]);
    // A stand-in for the WP-755 beat: a default (pre-flush) watcher that takes
    // the hint for space 0 when the defeat frame lands.
    const taken: (number | null)[] = [];
    scope.run(() => {
      watch(cityRef, () => {
        taken.push(useSliceAngleHints().take(0));
      });
    });
    stroke(controller, [mouse(60, 120), mouse(220, 200)]);
    cityRef.value = cityOf([null, null, null, null, null]);
    await nextTick();
    const expected = strokeAngleDeg({ x: 100, y: 140 }, { x: 220, y: 200 });
    assert.equal(taken.length, 1);
    assert.ok(Math.abs((taken[0] ?? 0) - expected) < 1e-9, `took ${String(taken[0])}`);
  });

  test("a confirmed target's unconsumed hint is dropped post-flush; dispose drops every hint", async () => {
    const first = createHarness(['a', null, null, null, null]);
    stroke(first.controller, ACROSS_ZERO);
    first.cityRef.value = cityOf([null, null, null, null, null]);
    await nextTick();
    assert.equal(useSliceAngleHints().take(0), null);

    const second = createHarness(['a', null, null, null, null]);
    stroke(second.controller, ACROSS_ZERO);
    second.scope.stop();
    assert.equal(useSliceAngleHints().take(0), null);
  });

  test('every submit is a City index only (the row sends fightVillain({ cityIndex }))', () => {
    const { controller, submits } = createHarness(['a', null, null, null, null]);
    stroke(controller, ACROSS_ZERO);
    assert.deepEqual(submits, [0]);
    assert.equal(typeof submits[0], 'number');
  });
});

describe('useSlashGesture — pointers, setting and fit (WP-756 §H)', () => {
  test('touch and pen are ignored unless the row has the touch class', () => {
    const row = buildRow();
    stubWidths(row, 900, 300);
    const { controller, submits } = createHarness(['a', null, null, null, null], { row });
    assert.equal(controller.isTouchGestureEnabled.value, false);
    stroke(controller, [touch(60, 150), touch(150, 150), touch(190, 150)]);
    stroke(controller, [pen(60, 150), pen(150, 150), pen(190, 150)]);
    assert.deepEqual(submits, []);
    // A mouse always gets the gesture while the setting is on.
    stroke(controller, ACROSS_ZERO);
    assert.deepEqual(submits, [0]);
  });

  test('a fitting row lets a touch stroke fight', () => {
    const { controller, submits } = createHarness(['a', null, null, null, null]);
    stroke(controller, [touch(60, 150), touch(150, 150), touch(190, 150)]);
    assert.deepEqual(submits, [0]);
  });

  test('a second pointerId is ignored while a stroke is active', () => {
    const { controller, submits } = createHarness(['a', 'b', null, null, null]);
    controller.handlePointerDown(mouse(60, 150, 1));
    controller.handlePointerDown(touch(240, 300, 2));
    assert.equal(controller.handlePointerMove(touch(240, 150, 2)).hasStartedGesture, false);
    controller.handlePointerMove(mouse(190, 150, 1));
    controller.handlePointerUp(touch(290, 150, 2));
    controller.handlePointerUp(mouse(190, 150, 1));
    assert.deepEqual(submits, [0]);
  });

  test('a non-primary mouse button never starts a gesture', () => {
    const { controller, submits } = createHarness(['a', null, null, null, null]);
    controller.handlePointerDown({ ...mouse(60, 150), button: 2 });
    controller.handlePointerMove({ ...mouse(190, 150), button: 2 });
    controller.handlePointerUp({ ...mouse(190, 150), button: 2 });
    assert.deepEqual(submits, []);
  });

  test('with the setting off: no gesture, and both class refs stay false', () => {
    const { controller, submits, captures } = createHarness(['a', null, null, null, null], {
      isEnabled: false,
    });
    assert.equal(controller.isGestureEnabled.value, false);
    assert.equal(controller.isTouchGestureEnabled.value, false);
    stroke(controller, ACROSS_ZERO);
    assert.deepEqual(submits, []);
    assert.deepEqual(captures, []);
    assert.equal(controller.shouldSuppressClick(), false);
  });

  test('the fit is measured on mount', () => {
    const overflowing = buildRow();
    stubWidths(overflowing, 900, 300);
    assert.equal(
      createHarness(['a', null, null, null, null], { row: overflowing }).controller
        .isTouchGestureEnabled.value,
      false,
    );
    const fitting = buildRow();
    stubWidths(fitting, 300, 300);
    assert.equal(
      createHarness(['a', null, null, null, null], { row: fitting }).controller
        .isTouchGestureEnabled.value,
      true,
    );
  });

  test('the fit re-measures when the City content changes', async () => {
    const row = buildRow();
    stubWidths(row, 300, 300);
    const { controller, cityRef } = createHarness(['a', null, null, null, null], { row });
    assert.equal(controller.isTouchGestureEnabled.value, true);
    stubWidths(row, 900, 300);
    cityRef.value = cityOf(['a', 'b', 'c', null, null]);
    await nextTick();
    assert.equal(controller.isTouchGestureEnabled.value, false);
  });

  test('a horizontally scrolling ancestor denies the touch class; a non-scrolling one does not', () => {
    const scrollingRow = buildRow();
    const scroller = document.createElement('div');
    scroller.style.overflowX = 'auto';
    stubWidths(scroller, 900, 300);
    scroller.appendChild(scrollingRow);
    const blocked = createHarness(['a', null, null, null, null], {
      row: scrollingRow,
      container: scroller,
    });
    assert.equal(blocked.controller.isTouchGestureEnabled.value, false);

    const calmRow = buildRow();
    const calm = document.createElement('div');
    calm.style.overflowX = 'auto';
    stubWidths(calm, 300, 300);
    calm.appendChild(calmRow);
    const allowedHarness = createHarness(['a', null, null, null, null], {
      row: calmRow,
      container: calm,
    });
    assert.equal(allowedHarness.controller.isTouchGestureEnabled.value, true);
  });
});

describe('useSlashGesture — signals (WP-756 §H)', () => {
  test('trail samples are published, and the last one ends the stroke', () => {
    const { controller } = createHarness(['a', null, null, null, null]);
    const samples: boolean[] = [];
    const scope = effectScope();
    openScopes.push(scope);
    scope.run(() => {
      watch(
        useBladeTrailSignal(),
        (sample) => {
          if (sample !== null) samples.push(sample.isStrokeEnd);
        },
        { flush: 'sync' },
      );
    });
    stroke(controller, [mouse(60, 150), mouse(150, 150), mouse(190, 150), mouse(230, 150)]);
    assert.ok(samples.length >= 3, `${samples.length} samples`);
    assert.equal(samples[samples.length - 1], true);
    assert.equal(samples.filter((isEnd) => isEnd).length, 1);
  });

  test('a hint is pushed per submit, and take() is FIFO per space', () => {
    const first = createHarness(['a', null, null, null, null]);
    const second = createHarness(['b', null, null, null, null]);
    stroke(first.controller, [mouse(60, 150), mouse(190, 150)]);
    stroke(second.controller, [mouse(140, 90), mouse(140, 260)]);
    assert.equal(useSliceAngleHints().take(0), 0);
    assert.equal(useSliceAngleHints().take(0), 90);
    assert.equal(useSliceAngleHints().take(0), null);
  });
});
