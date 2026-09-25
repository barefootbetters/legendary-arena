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
 * @see WP-756 §B "useSlashGesture.ts"
 * @see DECISIONS.md D-24585 (the slash gesture)
 */

import { computed, onScopeDispose, ref, watch, type Ref } from 'vue';
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

  const chainQueue: CompletedCrossing[] = [];
  let inFlight: InFlightTarget | null = null;
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;

  const isRowFitting = ref(false);
  const isGestureEnabled = computed(() => isEnabled.value);
  // why: touch and pen only get the gesture while the row does not scroll
  // horizontally — on a scrolling row a finger stroke must stay a native scroll.
  // Re-measured on content change, since scrollWidth grows as villains enter.
  const isTouchGestureEnabled = computed(() => isEnabled.value && isRowFitting.value);

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

  function handlePointerDown(sample: SlashPointerSample): void {
    clearClickSuppression();
    if (!isEnabled.value) return;
    if (stroke !== null && stroke.pointerId !== sample.pointerId) return;
    if (!canPointerStartStroke(sample)) {
      stroke = null;
      return;
    }
    const downPoint = { x: sample.x, y: sample.y };
    stroke = {
      pointerId: sample.pointerId,
      pointerType: sample.pointerType,
      downPoint,
      lastPoint: downPoint,
      hasStarted: false,
      crossing: null,
    };
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
    stroke = null;
    if (!activeStroke.hasStarted) return;
    const point = { x: sample.x, y: sample.y };
    advanceStroke(activeStroke, activeStroke.lastPoint, point);
    publishTrailSample(point, true);
    armClickSuppression();
  }

  function handlePointerCancel(sample: SlashPointerSample): void {
    const activeStroke = stroke;
    if (activeStroke === null || activeStroke.pointerId !== sample.pointerId) return;
    stroke = null;
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

  // why: the adapter is attached only while the setting is on, so with it off
  // the row carries no listeners at all — byte-identical to the pre-gesture row.
  watch(
    [rowElement, isEnabled],
    ([row, isOn], _previous, onCleanup) => {
      if (row === null || !isOn) {
        stroke = null;
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
    stroke = null;
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
  };
}
