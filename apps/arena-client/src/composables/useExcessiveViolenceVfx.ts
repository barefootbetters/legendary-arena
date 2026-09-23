/**
 * useExcessiveViolenceVfx.ts
 *
 * The Excessive Violence beat's VFX producer (WP-746) — a notable-event stream
 * consumer that mirrors `useTransformVfx`. It watches the WP-200
 * `UIState.notableEvents` STREAM (an append-only cursor, NOT the scalar
 * `useComboVfx`) and, per new `excessiveViolenceFired` event, emits one
 * `ExcessiveViolenceVfxEvent` so the `VfxOverlay` can render a crimson/steel
 * crossed-swords slash-burst + the "EXCESSIVE VIOLENCE!" word.
 *
 * A fire has no sub-kind (unlike the shield-block's `threatKind`), so the event
 * carries only a monotonic `seq` — enough to re-trigger the overlay on a repeat
 * fire. It emits through an injectable renderer seam (default: a module-level
 * reactive signal `VfxOverlay` consumes), mirroring `useTransformVfx` /
 * `useStrikeBlockedVfx`. Pure presentation: it reads `UIState` only, never writes
 * `G`/`ctx`, and adds zero engine / determinism / replay footprint (the
 * `src/vfx/` D-24365 exemption; sims / replays render no VFX). It learns of the
 * fire ONLY from the `excessiveViolenceFired` notable event, never from the
 * WP-739 availability field.
 *
 * @see WP-746 §G "the consumer"
 * @see apps/arena-client/src/composables/useTransformVfx.ts (the seq-only notable-event-stream sibling this mirrors)
 * @see apps/arena-client/src/composables/useNotableEventStream.ts (the append-only cursor this mirrors)
 * @see DECISIONS.md D-24569 (the Excessive Violence VFX beat) + D-20104 (the re-emission gate)
 */

import { ref, watch, type Ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';

/** One Excessive Violence VFX event: just a monotonic id (a fire has no sub-kind). */
export interface ExcessiveViolenceVfxEvent {
  /** Monotonic sequence id so the overlay re-renders even on a repeat fire. */
  readonly seq: number;
}

/** Renders an Excessive Violence event (the injectable seam). */
export type ExcessiveViolenceVfxRenderer = (event: ExcessiveViolenceVfxEvent) => void;

// why: module-level reactive signal — the default render target. `VfxOverlay`
// imports `useExcessiveViolenceVfxSignal()` and watches it; a change fires the
// slash-burst beat. Sharing one signal keeps the producer (this consumer,
// mounted at the PlayViewport root) and the renderer (the overlay) decoupled,
// exactly as `useTransformVfx` decouples from `VfxOverlay`.
const excessiveViolenceVfxSignal = ref<ExcessiveViolenceVfxEvent | null>(null);
let sequence = 0;

/** The shared Excessive Violence signal `VfxOverlay` consumes. */
export function useExcessiveViolenceVfxSignal(): Ref<ExcessiveViolenceVfxEvent | null> {
  return excessiveViolenceVfxSignal;
}

/** The default renderer: publishes the event to the shared module signal. */
function publishToSignal(event: ExcessiveViolenceVfxEvent): void {
  excessiveViolenceVfxSignal.value = event;
}

/**
 * Watches a UIState snapshot ref and emits one Excessive Violence event per new
 * `excessiveViolenceFired` notable event, via an append-only cursor over
 * `UIState.notableEvents`.
 *
 * @param snapshot - The arena-client UIState snapshot ref.
 * @param render - The renderer to emit through; defaults to the module signal.
 *   The parameter is an injectable seam for unit tests (a recording renderer).
 */
export function useExcessiveViolenceVfx(
  snapshot: Ref<UIState | null>,
  render: ExcessiveViolenceVfxRenderer = publishToSignal,
): void {
  // why: append-only cursor — the first `notableEvents` index this consumer has
  // not yet ingested. Mirrors `useTransformVfx` / `useNotableEventStream`'s
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
      // filtering to excessiveViolenceFired. The cursor advances past every new
      // event (a fire or not) so non-matching events are skipped, never
      // re-examined. Several excessiveViolenceFired events appended in ONE frame
      // publish to the single signal in turn; Vue flushes the watch once, so the
      // overlay renders one visible beat — an accepted v1 limitation matching
      // useTransformVfx / useStrikeBlockedVfx.
      for (let index = cursor; index < events.length; index += 1) {
        const event = events[index];
        if (event !== undefined && event.type === 'excessiveViolenceFired') {
          sequence += 1;
          render({ seq: sequence });
        }
      }
      cursor = events.length;
    },
    { immediate: true, deep: false },
  );
}
