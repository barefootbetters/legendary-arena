/**
 * useTransformVfx.ts
 *
 * The transform beat's VFX producer (WP-672) — a notable-event stream consumer
 * that mirrors `useStrikeBlockedVfx`. It watches the WP-200
 * `UIState.notableEvents` STREAM (an append-only cursor, NOT the scalar
 * `useComboVfx`) and, per new `transformResolved` event, emits one
 * `TransformVfxEvent` so the `VfxOverlay` can render a gamma-green power-surge
 * beat + the "TRANSFORMED!" word.
 *
 * A transform has no sub-kind (unlike the shield-block's `threatKind`), so the
 * event carries only a monotonic `seq` — enough to re-trigger the overlay on a
 * repeat transform. It emits through an injectable renderer seam (default: a
 * module-level reactive signal `VfxOverlay` consumes), mirroring `useComboVfx` /
 * `useStrikeBlockedVfx`. Pure presentation: it reads `UIState` only, never
 * writes `G`/`ctx`, and adds zero engine / determinism / replay footprint (the
 * `src/vfx/` D-24365 exemption; sims / replays render no VFX).
 *
 * @see WP-672 §C "the consumer"
 * @see apps/arena-client/src/composables/useStrikeBlockedVfx.ts (the notable-event-stream sibling this mirrors)
 * @see apps/arena-client/src/composables/useNotableEventStream.ts (the append-only cursor this mirrors)
 * @see DECISIONS.md D-24487 (the transform VFX beat) + D-20104 (the re-emission gate)
 */

import { ref, watch, type Ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';

/** One transform VFX event: just a monotonic id (a transform has no sub-kind). */
export interface TransformVfxEvent {
  /** Monotonic sequence id so the overlay re-renders even on a repeat transform. */
  readonly seq: number;
}

/** Renders a transform event (the injectable seam). */
export type TransformVfxRenderer = (event: TransformVfxEvent) => void;

// why: module-level reactive signal — the default render target. `VfxOverlay`
// imports `useTransformVfxSignal()` and watches it; a change fires the transform
// beat. Sharing one signal keeps the producer (this consumer, mounted at the
// PlayViewport root) and the renderer (the overlay) decoupled, exactly as
// `useStrikeBlockedVfx` decouples from `VfxOverlay`.
const transformVfxSignal = ref<TransformVfxEvent | null>(null);
let sequence = 0;

/** The shared transform signal `VfxOverlay` consumes. */
export function useTransformVfxSignal(): Ref<TransformVfxEvent | null> {
  return transformVfxSignal;
}

/** The default renderer: publishes the event to the shared module signal. */
function publishToSignal(event: TransformVfxEvent): void {
  transformVfxSignal.value = event;
}

/**
 * Watches a UIState snapshot ref and emits one transform event per new
 * `transformResolved` notable event, via an append-only cursor over
 * `UIState.notableEvents`.
 *
 * @param snapshot - The arena-client UIState snapshot ref.
 * @param render - The renderer to emit through; defaults to the module signal.
 *   The parameter is an injectable seam for unit tests (a recording renderer).
 */
export function useTransformVfx(
  snapshot: Ref<UIState | null>,
  render: TransformVfxRenderer = publishToSignal,
): void {
  // why: append-only cursor — the first `notableEvents` index this consumer has
  // not yet ingested. Mirrors `useStrikeBlockedVfx` / `useNotableEventStream`'s
  // re-emission gate (D-20104): a length-diff alone is insufficient (it re-fires
  // on remount / wholesale snapshot replacement), so the cursor tracks true
  // consumption.
  let cursor = 0;
  let caughtUp = false;

  watch(
    snapshot,
    (next) => {
      // why: safe-skip a null snapshot (first tick before a match loads) OR an
      // older engine bundle without WP-200's notableEvents projection — no throw,
      // no beat, and the cursor stays un-caught-up so a later valid frame can
      // still initialise.
      if (next === null) return;
      const events = next.notableEvents;
      if (events === undefined) return;

      // why: catch up the cursor to the snapshot's length on the first valid
      // frame — the append-only re-emission gate (D-20104). A mount / reconnect
      // against an already-populated snapshot MUST replay NOTHING; notableEvents
      // is strictly append-only within a match (D-20004), so length is the safe
      // "already seen" high-water mark.
      if (!caughtUp) {
        cursor = events.length;
        caughtUp = true;
        return;
      }

      // why: emit for the new tail in array order (D-20003 dispatch order),
      // filtering to transformResolved. The cursor advances past every new event
      // (transform or not) so non-matching events are skipped, never re-examined.
      // Several transformResolved events appended in ONE frame publish to the
      // single signal in turn; Vue flushes the watch once, so the overlay renders
      // one visible beat — an accepted v1 limitation matching useStrikeBlockedVfx.
      for (let index = cursor; index < events.length; index += 1) {
        const event = events[index];
        if (event !== undefined && event.type === 'transformResolved') {
          sequence += 1;
          render({ seq: sequence });
        }
      }
      cursor = events.length;
    },
    { immediate: true, deep: false },
  );
}
