/**
 * useSlashGesture.ts
 *
 * The WP-756 slash gesture: a Fruit Ninja-style stroke across the City row
 * fights every fightable villain it fully crosses, one `fightVillain` at a time.
 *
 * The composable returns a per-row controller (driven by plain pointer samples,
 * so tests drive it directly) and attaches a thin DOM adapter to the row that
 * forwards real pointer / key / click / dragstart events to it. It also owns two
 * module-level signals the `VfxOverlay` reads:
 *
 * - the **blade trail** samples (the overlay draws the trail and owns the clock);
 * - the per-City-space **angle hints**, so the WP-755 slice follows the stroke.
 *
 * Engine owns truth: the gesture submits only `fightVillain({ cityIndex })`
 * through the row's existing `onFight`, each target re-gated by the unchanged
 * `gateForCell`, and it never predicts an outcome — it reads each result from
 * the next projected City snapshot. This file reads NO clock (it sits outside
 * the D-24365 VFX subsurface); the backstop is a `setTimeout`, which schedules
 * rather than reads time.
 *
 * WP-761 adds the **long-press slash** for touch / pen on a row that scrolls
 * sideways (every phone): a press held still for 350 ms arms a stroke, and while
 * armed the row's `touchmove` is prevented so the finger slashes instead of
 * scrolling. The stroke then runs through the same crossing rule and chain.
 *
 * @see WP-756 §B "useSlashGesture.ts" / WP-761 §A "the long press"
 * @see DECISIONS.md D-24585 (the slash gesture) + D-24592 (the long-press slash)
 */

import { computed, onScopeDispose, readonly, ref, watch, type Ref } from 'vue';
import type { UICityState } from '@legendary-arena/game-engine';
import {
  advanceCrossingState,
  createCrossingState,
  distanceBetween,
  type CompletedCrossing,
  type CrossingState,
  type Point,
  type Rect,
} from '../lib/slashGestureGeometry';

// why: the per-pointer start distance. Pointer capture retargets `click`, so the
// gesture may only capture once the press has clearly become a drag. 8 px keeps
// mouse clicks clicks; touch and pen use 16 px so a sloppy tap (inside the
// browser's ~15 px tap slop) still clicks instead of starting a stroke.
const MOUSE_START_DISTANCE_PX = 8;
const TOUCH_START_DISTANCE_PX = 16;

// why: the no-frame backstop. A rejection is read from the FIRST new City
// snapshot after a submit, so this only fires when no frame arrives at all (a
// dropped move). It must stay BELOW the 4000 ms move-ack watchdog
// (MOVE_ACK_TIMEOUT_MS in bgioClient.ts): otherwise the watchdog's resync()
// frame would arrive first, read as a rejection, and trigger a late submit.
// Abandoning never submits, so nothing is ever sent late.
export const TARGET_CONFIRM_TIMEOUT_MS = 3000;

// why: WP-761 — the long press is the one scroll-safe intent signal on a row
// that scrolls: a scroll starts moving at once and a tap releases at once, so a
// finger held STILL for 350 ms means "slash". 10 px of drift before then is a
// scroll (or a sloppy tap) and abandons the arm; the browser pans on its own.
const LONG_PRESS_ARM_MS = 350;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;
// why: a short buzz confirms the arm on phones that support it; purely feedback.
const LONG_PRESS_VIBRATE_MS = 12;

// why: 1 px of slack on the fit comparison absorbs sub-pixel rounding between
// scrollWidth and clientWidth, which browsers report as integers.
const FIT_SLACK_PX = 1;

/** One pointer sample, read off a pointer event (client coordinates). */
export interface SlashPointerSample {
  x: number;
  y: number;
  pointerType: string;
  button: number;
  pointerId: number;
}

/** One blade-trail sample for the overlay. */
export interface BladeTrailSample {
  /** Monotonic id so a repeat position still publishes. */
  seq: number;
  x: number;
  y: number;
  /** True on the stroke's last sample (pointerup / pointercancel). */
  isStrokeEnd: boolean;
}

/** The options `useSlashGesture` takes. */
export interface SlashGestureOptions {
  /** The `<ol class="city-spaces">` row element. */
  rowElement: Ref<HTMLElement | null>;
  /** The current projected City (a getter, so each frame is read fresh). */
  city: () => UICityState;
  /** Whether the Fight button for this engine City index is allowed right now. */
  gateForCityIndex: (cityIndex: number) => boolean;
  /** Submits one fight — the row's existing click path. */
  submitFight: (cityIndex: number) => void;
  /** The "Slash to fight" setting. */
  isEnabled: Ref<boolean>;
  /** Captures the pointer on the row; defaults to `rowElement.setPointerCapture`. */
  capturePointer?: (pointerId: number) => void;
}

/** The per-row controller. */
export interface SlashGestureController {
  handlePointerDown: (sample: SlashPointerSample) => void;
  handlePointerMove: (sample: SlashPointerSample) => { hasStartedGesture: boolean };
  handlePointerUp: (sample: SlashPointerSample) => void;
  handlePointerCancel: (sample: SlashPointerSample) => void;
  handleKeyDown: () => void;
  /**
   * Whether a click should be swallowed: the one-shot suppression after a
   * gesture (consumed by this call), or — for a click on a villain tile only —
   * a chain submit still in flight.
   */
  shouldSuppressClick: (isVillainTileClick?: boolean) => boolean;
  isGestureEnabled: Ref<boolean>;
  isTouchGestureEnabled: Ref<boolean>;
  /** WP-761 — true while a long-press stroke is armed (binds the armed glow). */
  isLongPressArmed: Readonly<Ref<boolean>>;
  /**
   * WP-761 — the hold gate: the setting is on AND (the row does not fit OR a
   * long press is live). Binds `city-spaces--gesture-hold` and gates the
   * long-press listeners.
   */
  isLongPressHoldEnabled: Readonly<Ref<boolean>>;
  /** WP-761 — whether the row's `touchmove` must be prevented (armed only). */
  shouldPreventTouchScroll: () => boolean;
}

// ---------------------------------------------------------------------------
// Module-level signals (read by VfxOverlay)
// ---------------------------------------------------------------------------

// why: module-level signal, the same decoupling the VFX producers use — the
// gesture (inside CityRow) publishes, the overlay (at the viewport root) draws.
const bladeTrailSignal = ref<BladeTrailSample | null>(null);
let bladeTrailSequence = 0;

/** One pending angle hint for a City space. */
interface SliceAngleHint {
  extId: string;
  angleDeg: number;
}

// why: a per-City-space FIFO. Each gesture submit pushes one hint; the WP-755
// slice beat takes the oldest for its space FIRST (before any gate), and the
// chain drops a target's hint when it resolves, so no hint outlives its fight.
const sliceAngleHints = new Map<number, SliceAngleHint[]>();

/** The blade-trail signal the overlay watches. */
export function useBladeTrailSignal(): Ref<BladeTrailSample | null> {
  return bladeTrailSignal;
}

/** Removes and returns the oldest hint angle for a City space, or `null`. */
function takeSliceAngleHint(citySpace: number): number | null {
  const queue = sliceAngleHints.get(citySpace);
  if (queue === undefined || queue.length === 0) return null;
  const oldest = queue.shift();
  if (queue.length === 0) sliceAngleHints.delete(citySpace);
  return oldest === undefined ? null : oldest.angleDeg;
}

/** Appends a hint for a City space. */
function pushSliceAngleHint(citySpace: number, extId: string, angleDeg: number): void {
  const queue = sliceAngleHints.get(citySpace) ?? [];
  queue.push({ extId, angleDeg });
  sliceAngleHints.set(citySpace, queue);
}

/** Drops the hint for one card at one City space, if it is still queued. */
function dropSliceAngleHint(citySpace: number, extId: string): void {
  const queue = sliceAngleHints.get(citySpace);
  if (queue === undefined) return;
  const index = queue.findIndex((hint) => hint.extId === extId);
  if (index !== -1) queue.splice(index, 1);
  if (queue.length === 0) sliceAngleHints.delete(citySpace);
}

/** The angle-hint reader the WP-755 slice beat consumes. */
export function useSliceAngleHints(): { take: (citySpace: number) => number | null } {
  return { take: takeSliceAngleHint };
}

/** Test-only reset of both module signals. */
export function __resetSlashGestureSignalsForTests(): void {
  bladeTrailSignal.value = null;
  bladeTrailSequence = 0;
  sliceAngleHints.clear();
}

/** Publishes one trail sample. */
function publishTrailSample(point: Point, isStrokeEnd: boolean): void {
  bladeTrailSequence += 1;
  bladeTrailSignal.value = { seq: bladeTrailSequence, x: point.x, y: point.y, isStrokeEnd };
}

// ---------------------------------------------------------------------------
// Pure-ish helpers
// ---------------------------------------------------------------------------

/** The engine City index holding this card, or -1 when it is gone. */
function findCityIndexByExtId(city: UICityState, extId: string): number {
  const spaces = city.spaces;
  for (let i = 0; i < spaces.length; i += 1) {
    const card = spaces[i];
    if (card !== null && card !== undefined && card.extId === extId) return i;
  }
  return -1;
}

/** Whether a horizontally scrolling element has content wider than its box. */
function overflowsHorizontally(element: Element): boolean {
  return element.scrollWidth > element.clientWidth + FIT_SLACK_PX;
}

/** Whether the element scrolls horizontally (or is the page root, which always can). */
function isHorizontalScroller(element: Element): boolean {
  if (element === document.documentElement || element === document.body) return true;
  const overflowX = window.getComputedStyle(element).overflowX;
  return overflowX === 'auto' || overflowX === 'scroll';
}

/**
 * Whether the row fits on screen without any horizontal scrolling: the row
 * itself, every horizontally scrolling ancestor up to the root, and the
 * viewport width. Horizontal-only and independent of vertical scroll position.
 */
function measureRowFits(row: HTMLElement): boolean {
  if (overflowsHorizontally(row)) return false;
  let ancestor = row.parentElement;
  while (ancestor !== null) {
    if (isHorizontalScroller(ancestor) && overflowsHorizontally(ancestor)) return false;
    ancestor = ancestor.parentElement;
  }
  const rect = row.getBoundingClientRect();
  return rect.left >= -FIT_SLACK_PX && rect.right <= window.innerWidth + FIT_SLACK_PX;
}

/** Converts a DOM rect to the geometry `Rect`. */
function toRect(domRect: DOMRect): Rect {
  return { left: domRect.left, top: domRect.top, width: domRect.width, height: domRect.height };
}

/** Reads a pointer sample off a DOM event by field, never by the pointer-event class (jsdom lacks it). */
function sampleFromEvent(event: Event): SlashPointerSample {
  const pointer = event as Event & {
    clientX?: number;
    clientY?: number;
    pointerType?: string;
    button?: number;
    pointerId?: number;
  };
  return {
    x: pointer.clientX ?? 0,
    y: pointer.clientY ?? 0,
    pointerType: pointer.pointerType ?? 'mouse',
    button: pointer.button ?? 0,
    pointerId: pointer.pointerId ?? 1,
  };
}

// ---------------------------------------------------------------------------
// The composable
// ---------------------------------------------------------------------------

/** One in-progress stroke. */
interface ActiveStroke {
  pointerId: number;
  pointerType: string;
  downPoint: Point;
  lastPoint: Point;
  hasStarted: boolean;
  crossing: CrossingState | null;
  /** WP-761 — a long press: pending while `hasStarted` is false, armed after. */
  isLongPress: boolean;
}

/** The chain target currently submitted and awaiting its confirming snapshot. */
interface InFlightTarget {
  extId: string;
  cityIndex: number;
}

/**
 * Creates the slash-gesture controller for one City row and attaches its DOM
 * adapter. Everything is torn down when the calling scope is disposed.
 */
export function useSlashGesture(options: SlashGestureOptions): SlashGestureController {
  const { rowElement, city, gateForCityIndex, submitFight, isEnabled } = options;
  const capturePointer =
    options.capturePointer ??
    ((pointerId: number): void => {
      const row = rowElement.value;
      if (row === null || typeof row.setPointerCapture !== 'function') return;
      try {
        row.setPointerCapture(pointerId);
      } catch {
        // why: setPointerCapture throws when the pointer is no longer active
        // (released between events); the stroke still works uncaptured.
      }
    });

  let stroke: ActiveStroke | null = null;
  let isClickSuppressionArmed = false;
  let suppressionTimer: ReturnType<typeof setTimeout> | null = null;
  let armTimer: ReturnType<typeof setTimeout> | null = null;

  // why: WP-761 — `stroke` is a plain `let` mutated in place, so a `computed`
  // over it would never update. These two refs mirror it and are written ONLY
  // by syncLongPressState(), called at every point the stroke changes, so the
  // armed glow and the hold gate can never disagree with the stroke — and the
  // row can never be left unscrollable after the stroke is gone.
  const isLongPressArmedState = ref(false);
  const isLongPressLive = ref(false);

  const chainQueue: CompletedCrossing[] = [];
  let inFlight: InFlightTarget | null = null;
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;

  const isRowFitting = ref(false);
  const isGestureEnabled = computed(() => isEnabled.value);
  // why: touch and pen only get the gesture while the row does not scroll
  // horizontally — on a scrolling row a finger stroke must stay a native scroll.
  // Re-measured on content change, since scrollWidth grows as villains enter.
  const isTouchGestureEnabled = computed(() => isEnabled.value && isRowFitting.value);
  // why: WP-761 — the long-press listeners and callout CSS are needed only on a
  // row that scrolls, so a fitting row stays byte-identical to WP-756. The
  // `|| isLongPressLive` term keeps them attached while a long press is live: a
  // chain fight can make the row fit while the finger is down, and detaching
  // the listeners then would let the browser pan mid-stroke.
  const isLongPressHoldEnabled = computed(
    () => isEnabled.value && (!isRowFitting.value || isLongPressLive.value),
  );

  /** Mirrors the stroke into the two long-press refs — their ONLY writer. */
  function syncLongPressState(): void {
    isLongPressLive.value = stroke !== null && stroke.isLongPress;
    isLongPressArmedState.value = stroke !== null && stroke.isLongPress && stroke.hasStarted;
  }

  /** Whether the row's touchmove must be prevented: only while armed. */
  function shouldPreventTouchScroll(): boolean {
    return stroke !== null && stroke.isLongPress && stroke.hasStarted;
  }

  /** Stops a pending arm's timer, if any. */
  function clearArmTimer(): void {
    if (armTimer !== null) {
      clearTimeout(armTimer);
      armTimer = null;
    }
  }

  /** Ends any stroke (pending, armed or WP-756) and syncs the long-press refs. */
  function endStroke(): void {
    clearArmTimer();
    stroke = null;
    syncLongPressState();
  }

  /** Re-measures whether the row fits (drives the touch class). */
  function measureFit(): void {
    const row = rowElement.value;
    isRowFitting.value = row !== null && measureRowFits(row);
  }

  /** Clears the one-shot click suppression. */
  function clearClickSuppression(): void {
    isClickSuppressionArmed = false;
    if (suppressionTimer !== null) {
      clearTimeout(suppressionTimer);
      suppressionTimer = null;
    }
  }

  /**
   * Arms the one-shot click suppression after a completed gesture.
   *
   * why: pointer capture retargets the mouse `click` that follows the stroke's
   * pointerup, so it must be swallowed once. But a touch stroke fires no click
   * at all, so the flag is cleared on the next pointerdown / keydown and by a
   * setTimeout(0) — a mouse click dispatches in the same task as its pointerup
   * (still caught), while an armed flag can never eat a later tap.
   */
  function armClickSuppression(): void {
    clearClickSuppression();
    isClickSuppressionArmed = true;
    suppressionTimer = setTimeout(() => {
      suppressionTimer = null;
      isClickSuppressionArmed = false;
    }, 0);
  }

  /**
   * Arms the one-shot click suppression after an ARMED long-press stroke.
   *
   * why: WP-761 — once `contextmenu` is prevented a browser may still fire a
   * `click` after the long touch, and on touch that click comes from the tap
   * gesture, which can land in a LATER task than `pointerup` — a setTimeout(0)
   * clear could run first and let it through. So this path is cleared only by
   * the next `pointerdown` / `keydown`; every later tap starts with a
   * `pointerdown`, so it can never eat one.
   */
  function armClickSuppressionUntilNextInput(): void {
    clearClickSuppression();
    isClickSuppressionArmed = true;
  }

  /** The arm buzz, where the device supports it. */
  function buzzArm(): void {
    // why: navigator.vibrate is absent on iOS Safari (and in jsdom); it is
    // feature-checked and never load-bearing — the glow is the real cue.
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
      navigator.vibrate(LONG_PRESS_VIBRATE_MS);
    } catch {
      // why: some browsers throw when vibration is blocked by policy; the arm
      // must still happen, so the buzz is simply skipped.
    }
  }

  /** The fightable tiles at gesture start, with their rects (measured once). */
  function collectCandidateTiles(): { extId: string; rect: Rect }[] {
    const row = rowElement.value;
    const tiles: { extId: string; rect: Rect }[] = [];
    if (row === null) return tiles;
    const spaces = city().spaces;
    for (let cityIndex = 0; cityIndex < spaces.length; cityIndex += 1) {
      const card = spaces[cityIndex];
      if (card === null || card === undefined) continue;
      if (!gateForCityIndex(cityIndex)) continue;
      const button = row.querySelector(
        `[data-testid="play-city-villain"][data-city-index="${cityIndex}"]`,
      );
      if (button === null) continue;
      tiles.push({ extId: card.extId, rect: toRect(button.getBoundingClientRect()) });
    }
    return tiles;
  }

  // -------------------------------------------------------------------------
  // The chain
  // -------------------------------------------------------------------------

  /** Ends the in-flight target: clears its backstop and drops its hint. */
  function resolveInFlight(): void {
    if (confirmTimer !== null) {
      clearTimeout(confirmTimer);
      confirmTimer = null;
    }
    if (inFlight !== null) {
      dropSliceAngleHint(inFlight.cityIndex, inFlight.extId);
      inFlight = null;
    }
  }

  /**
   * Submits the next queued target, if nothing is in flight.
   *
   * why: the chain is keyed by extId, never by index — a fight can shift the
   * City (a HYDRA insert), push a villain out, or remove others, so each target
   * is re-resolved and re-gated right before its submit and skipped when absent
   * or refused. Submits go one at a time because two unconfirmed moves would
   * share a stale _stateID (there is no client move queue).
   */
  function pumpChain(): void {
    if (inFlight !== null) return;
    while (chainQueue.length > 0) {
      const target = chainQueue.shift();
      if (target === undefined) break;
      const cityIndex = findCityIndexByExtId(city(), target.extId);
      if (cityIndex === -1 || !gateForCityIndex(cityIndex)) continue;
      pushSliceAngleHint(cityIndex, target.extId, target.angleDeg);
      inFlight = { extId: target.extId, cityIndex };
      confirmTimer = setTimeout(abandonChain, TARGET_CONFIRM_TIMEOUT_MS);
      submitFight(cityIndex);
      return;
    }
  }

  /** The no-frame backstop: abandon everything, submit nothing. */
  function abandonChain(): void {
    confirmTimer = null;
    resolveInFlight();
    chainQueue.length = 0;
  }

  /** Appends crossings to the chain, skipping extIds already queued or in flight. */
  function enqueueCrossings(crossed: readonly CompletedCrossing[]): void {
    for (const crossing of crossed) {
      const isInFlight = inFlight !== null && inFlight.extId === crossing.extId;
      const isQueued = chainQueue.some((queued) => queued.extId === crossing.extId);
      if (isInFlight || isQueued) continue;
      chainQueue.push(crossing);
    }
    pumpChain();
  }

  // why: the first new City snapshot after a submit decides that target —
  // whether the in-flight extId has left city.spaces or not. The
  // store replaces the snapshot wholesale every frame, so this fires once per
  // frame. Gone ⇒ the engine accepted the fight (a successful fight nulls its
  // space; extIds are per-copy). Still present ⇒ the engine rejected it (a Guard,
  // Patrol, defeat requirement or open pending choice — all invisible to the
  // client gate), so the chain skips it at once instead of waiting: every
  // rejection resolves within one round-trip, so no fight ever fires after a
  // prompt closes. `flush: 'post'` runs this AFTER the pre-flush slice beat has
  // taken the hint, so the drop here is a no-op when the beat consumed it and a
  // cleanup when it did not.
  watch(
    () => city(),
    () => {
      if (inFlight === null) return;
      // Confirmed (gone) and rejected (still present) resolve the same way:
      // this target is finished, its hint is dropped, and the chain moves on.
      // The client never retries a rejected fight — the engine owns truth.
      resolveInFlight();
      pumpChain();
    },
    { flush: 'post' },
  );

  // -------------------------------------------------------------------------
  // The stroke
  // -------------------------------------------------------------------------

  /** Advances the stroke's crossing state and queues completed crossings. */
  function advanceStroke(activeStroke: ActiveStroke, from: Point, to: Point): void {
    if (activeStroke.crossing === null) return;
    const result = advanceCrossingState(activeStroke.crossing, from, to);
    activeStroke.crossing = result.state;
    if (result.crossed.length > 0) enqueueCrossings(result.crossed);
  }

  /** Whether a pointer of this type may start a stroke right now. */
  function canPointerStartStroke(sample: SlashPointerSample): boolean {
    if (sample.pointerType === 'mouse') return sample.button === 0;
    return isTouchGestureEnabled.value;
  }

  /**
   * Whether this press should start a long press (WP-761): touch or pen on a
   * row that scrolls. Decided here, at pointerdown, only — a later fit change
   * never affects a pending or armed long press.
   */
  function isLongPressEligible(sample: SlashPointerSample): boolean {
    if (sample.pointerType === 'mouse') return false;
    return !isTouchGestureEnabled.value;
  }

  function handlePointerDown(sample: SlashPointerSample): void {
    clearClickSuppression();
    if (!isEnabled.value) return;
    if (stroke !== null && stroke.pointerId !== sample.pointerId) {
      // why: a second finger during a PENDING long press is a pinch or a
      // two-finger pan, so it cancels the arm — and this pointerdown never
      // starts an arm of its own. An armed or WP-756 stroke ignores it.
      if (stroke.isLongPress && !stroke.hasStarted) endStroke();
      return;
    }
    clearArmTimer();
    const downPoint = { x: sample.x, y: sample.y };
    if (isLongPressEligible(sample)) {
      startPendingLongPress(sample, downPoint);
      return;
    }
    if (!canPointerStartStroke(sample)) {
      endStroke();
      return;
    }
    stroke = {
      pointerId: sample.pointerId,
      pointerType: sample.pointerType,
      downPoint,
      lastPoint: downPoint,
      hasStarted: false,
      crossing: null,
      isLongPress: false,
    };
    syncLongPressState();
  }

  /** Starts a pending long press: the arm fires unless the finger moves or lifts. */
  function startPendingLongPress(sample: SlashPointerSample, downPoint: Point): void {
    stroke = {
      pointerId: sample.pointerId,
      pointerType: sample.pointerType,
      downPoint,
      lastPoint: downPoint,
      hasStarted: false,
      crossing: null,
      isLongPress: true,
    };
    armTimer = setTimeout(armStroke, LONG_PRESS_ARM_MS);
    syncLongPressState();
  }

  /**
   * Arms a pending long press after 350 ms of stillness.
   *
   * why: the start distance is waived — the finger has not moved, so the stroke
   * is seeded at the press point, and the candidate tiles are measured NOW
   * (the row cannot scroll during an armed stroke, and a villain may have
   * become fightable since pointerdown). Not startGesture: that publishes two
   * trail samples and advances a segment, and here there is no segment yet.
   */
  function armStroke(): void {
    armTimer = null;
    const activeStroke = stroke;
    if (activeStroke === null || !activeStroke.isLongPress || activeStroke.hasStarted) return;
    activeStroke.hasStarted = true;
    capturePointer(activeStroke.pointerId);
    activeStroke.crossing = createCrossingState(collectCandidateTiles(), activeStroke.downPoint);
    activeStroke.lastPoint = activeStroke.downPoint;
    publishTrailSample(activeStroke.downPoint, false);
    buzzArm();
    syncLongPressState();
  }

  /**
   * Starts the gesture once the press has moved the start distance.
   *
   * why: the crossing state is created from the pointerdown point and the
   * down→current segment is advanced at once, so a tile entered during the
   * start distance is not lost.
   */
  function startGesture(activeStroke: ActiveStroke, point: Point): void {
    activeStroke.hasStarted = true;
    capturePointer(activeStroke.pointerId);
    activeStroke.crossing = createCrossingState(collectCandidateTiles(), activeStroke.downPoint);
    publishTrailSample(activeStroke.downPoint, false);
    advanceStroke(activeStroke, activeStroke.downPoint, point);
    publishTrailSample(point, false);
    activeStroke.lastPoint = point;
  }

  function handlePointerMove(sample: SlashPointerSample): { hasStartedGesture: boolean } {
    const activeStroke = stroke;
    if (activeStroke === null || activeStroke.pointerId !== sample.pointerId) {
      return { hasStartedGesture: false };
    }
    const point = { x: sample.x, y: sample.y };
    if (activeStroke.isLongPress && !activeStroke.hasStarted) {
      // A pending long press: drifting past the tolerance is a scroll (or a
      // sloppy tap) — abandon the arm and let the browser pan natively.
      if (distanceBetween(activeStroke.downPoint, point) > LONG_PRESS_MOVE_TOLERANCE_PX) {
        endStroke();
      }
      return { hasStartedGesture: false };
    }
    if (!activeStroke.hasStarted) {
      const startDistance =
        activeStroke.pointerType === 'mouse' ? MOUSE_START_DISTANCE_PX : TOUCH_START_DISTANCE_PX;
      if (distanceBetween(activeStroke.downPoint, point) < startDistance) {
        return { hasStartedGesture: false };
      }
      startGesture(activeStroke, point);
      return { hasStartedGesture: true };
    }
    advanceStroke(activeStroke, activeStroke.lastPoint, point);
    publishTrailSample(point, false);
    activeStroke.lastPoint = point;
    return { hasStartedGesture: true };
  }

  function handlePointerUp(sample: SlashPointerSample): void {
    const activeStroke = stroke;
    if (activeStroke === null || activeStroke.pointerId !== sample.pointerId) return;
    endStroke();
    if (!activeStroke.hasStarted) return;
    const point = { x: sample.x, y: sample.y };
    advanceStroke(activeStroke, activeStroke.lastPoint, point);
    publishTrailSample(point, true);
    if (activeStroke.isLongPress) {
      armClickSuppressionUntilNextInput();
    } else {
      armClickSuppression();
    }
  }

  function handlePointerCancel(sample: SlashPointerSample): void {
    const activeStroke = stroke;
    if (activeStroke === null || activeStroke.pointerId !== sample.pointerId) return;
    endStroke();
    if (!activeStroke.hasStarted) return;
    // why: a cancel (e.g. the browser taking a vertical pan under pan-y) keeps
    // the crossings already completed, ends the trail, and arms NO suppression —
    // no click follows a cancelled pointer.
    publishTrailSample(activeStroke.lastPoint, true);
  }

  function handleKeyDown(): void {
    clearClickSuppression();
  }

  function shouldSuppressClick(isVillainTileClick = false): boolean {
    if (isClickSuppressionArmed) {
      clearClickSuppression();
      return true;
    }
    // why: a manual tile click while a chain submit is unconfirmed would race it
    // on the same stale _stateID. The Excessive Violence button always passes.
    return isVillainTileClick && inFlight !== null;
  }

  // -------------------------------------------------------------------------
  // The DOM adapter
  // -------------------------------------------------------------------------

  /** Wires the row's DOM events to the controller; returns the detach function. */
  function attachAdapter(row: HTMLElement): () => void {
    const onPointerDown = (event: Event): void => handlePointerDown(sampleFromEvent(event));
    const onPointerMove = (event: Event): void => {
      handlePointerMove(sampleFromEvent(event));
    };
    const onPointerUp = (event: Event): void => handlePointerUp(sampleFromEvent(event));
    const onPointerCancel = (event: Event): void => handlePointerCancel(sampleFromEvent(event));
    const onKeyDown = (): void => handleKeyDown();
    const onClick = (event: Event): void => {
      const target = event.target as Element | null;
      const isVillainTileClick =
        target !== null &&
        typeof target.closest === 'function' &&
        target.closest('[data-testid="play-city-villain"]') !== null;
      if (shouldSuppressClick(isVillainTileClick)) {
        event.stopPropagation();
        event.preventDefault();
      }
    };
    // why: the native image drag starts below the 8 px start distance, and a
    // drag would cancel the pointer stream mid-stroke, so dragstart is prevented
    // on the row whenever the setting is on. Preventing it never cancels click.
    // WP-761: it is also what stops Android / iOS touch drag-and-drop from
    // starting after a long press on card art.
    const onDragStart = (event: Event): void => {
      event.preventDefault();
    };
    row.addEventListener('pointerdown', onPointerDown);
    row.addEventListener('pointermove', onPointerMove);
    row.addEventListener('pointerup', onPointerUp);
    row.addEventListener('pointercancel', onPointerCancel);
    row.addEventListener('keydown', onKeyDown);
    row.addEventListener('click', onClick, true);
    row.addEventListener('dragstart', onDragStart);
    return () => {
      row.removeEventListener('pointerdown', onPointerDown);
      row.removeEventListener('pointermove', onPointerMove);
      row.removeEventListener('pointerup', onPointerUp);
      row.removeEventListener('pointercancel', onPointerCancel);
      row.removeEventListener('keydown', onKeyDown);
      row.removeEventListener('click', onClick, true);
      row.removeEventListener('dragstart', onDragStart);
    };
  }

  /**
   * Ends an armed long-press stroke when the row itself loses pointer capture.
   *
   * why: when armStroke() moves capture from the touched child to the row, the
   * child fires a BUBBLING lostpointercapture — which must not kill the stroke
   * it just armed. Only a loss on the row itself, for this armed long press's
   * pointer, ends it (like pointercancel). Mouse and fitting-row strokes ignore
   * it entirely.
   */
  function handleRowLostPointerCapture(sample: SlashPointerSample, isRowTarget: boolean): void {
    if (!isRowTarget) return;
    const activeStroke = stroke;
    if (activeStroke === null || !activeStroke.isLongPress || !activeStroke.hasStarted) return;
    if (activeStroke.pointerId !== sample.pointerId) return;
    handlePointerCancel(sample);
  }

  /** Wires the long-press-only listeners to the row; returns the detach function. */
  function attachHoldListeners(row: HTMLElement): () => void {
    // why: touch-action is fixed when the touch starts, so the row cannot switch
    // to pan-y mid-touch; the only way to stop the pan is preventDefault() on a
    // cancelable touchmove BEFORE the browser starts panning — exactly the
    // held-still long-press case. Never prevented unless armed: an unarmed
    // touch must scroll natively.
    const onTouchMove = (event: Event): void => {
      if (shouldPreventTouchScroll() && event.cancelable) event.preventDefault();
    };
    // why: a long press on card art or a label raises the browser context menu
    // (Android) — swallowed while a long press is pending or armed. The iOS
    // callout is suppressed by -webkit-touch-callout on the hold class.
    const onContextMenu = (event: Event): void => {
      if (stroke !== null && stroke.isLongPress) event.preventDefault();
    };
    const onLostPointerCapture = (event: Event): void => {
      handleRowLostPointerCapture(sampleFromEvent(event), event.target === row);
    };
    // why: non-passive, or the browser may ignore preventDefault() on touchmove
    // and pan anyway.
    row.addEventListener('touchmove', onTouchMove, { passive: false });
    row.addEventListener('contextmenu', onContextMenu);
    row.addEventListener('lostpointercapture', onLostPointerCapture);
    return () => {
      row.removeEventListener('touchmove', onTouchMove);
      row.removeEventListener('contextmenu', onContextMenu);
      row.removeEventListener('lostpointercapture', onLostPointerCapture);
    };
  }

  // why: WP-761 — the long-press listeners follow the hold gate (setting on AND
  // the row does not fit OR a long press is live), so a fitting row carries
  // none of them and a live long press never loses them mid-stroke.
  watch(
    [rowElement, isLongPressHoldEnabled],
    ([row, isHoldOn], _previous, onCleanup) => {
      if (row === null || !isHoldOn) return;
      onCleanup(attachHoldListeners(row));
    },
    { immediate: true, flush: 'post' },
  );

  // why: the adapter is attached only while the setting is on, so with it off
  // the row carries no listeners at all — byte-identical to the pre-gesture row.
  watch(
    [rowElement, isEnabled],
    ([row, isOn], _previous, onCleanup) => {
      if (row === null || !isOn) {
        endStroke();
        clearClickSuppression();
        return;
      }
      const detach = attachAdapter(row);
      onCleanup(detach);
    },
    { immediate: true, flush: 'post' },
  );

  // Fit measurement: on mount (immediate), on content change, on resize.
  watch(rowElement, measureFit, { immediate: true, flush: 'post' });
  watch(() => city(), measureFit, { flush: 'post' });

  let resizeObserver: ResizeObserver | null = null;
  watch(
    rowElement,
    (row) => {
      if (resizeObserver !== null) resizeObserver.disconnect();
      resizeObserver = null;
      // why: guarded — jsdom and older browsers have no ResizeObserver; the
      // mount / content-change / window-resize triggers still apply without it.
      if (row === null || typeof ResizeObserver !== 'function') return;
      resizeObserver = new ResizeObserver(() => measureFit());
      resizeObserver.observe(row);
    },
    { immediate: true, flush: 'post' },
  );

  const onWindowResize = (): void => measureFit();
  if (typeof window !== 'undefined') window.addEventListener('resize', onWindowResize);

  onScopeDispose(() => {
    clearClickSuppression();
    resolveInFlight();
    chainQueue.length = 0;
    endStroke();
    if (resizeObserver !== null) resizeObserver.disconnect();
    resizeObserver = null;
    if (typeof window !== 'undefined') window.removeEventListener('resize', onWindowResize);
  });

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleKeyDown,
    shouldSuppressClick,
    isGestureEnabled,
    isTouchGestureEnabled,
    isLongPressArmed: readonly(isLongPressArmedState),
    isLongPressHoldEnabled: readonly(isLongPressHoldEnabled),
    shouldPreventTouchScroll,
  };
}
