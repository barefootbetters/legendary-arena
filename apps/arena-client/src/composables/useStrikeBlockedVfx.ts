/**
 * useStrikeBlockedVfx.ts
 *
 * The FIRST notable-event VFX consumer (WP-647) — the shield-block beat's
 * producer. It watches the WP-200 `UIState.notableEvents` STREAM (an append-only
 * cursor, mirroring `useNotableEventStream`, NOT the scalar `useComboVfx`) and,
 * per new `strikeBlocked` event, emits one `StrikeBlockedVfxEvent` carrying the
 * `threatKind` so the `VfxOverlay` can render a Captain-America shield-block beat
 * recoloured per threat (Master Strike red / Scheme Twist purple / Ambush green).
 *
 * It emits through an injectable renderer seam (default: a module-level reactive
 * signal that `VfxOverlay` consumes) — mirroring `useComboVfx`'s injectable
 * seam. Pure presentation: it reads `UIState` only, never writes `G`/`ctx`, and
 * adds zero engine / determinism / replay footprint (the `src/vfx/` D-24365
 * exemption; sims / replays render no VFX).
 *
 * @see WP-647 §B "the consumer"
 * @see apps/arena-client/src/composables/useComboVfx.ts (the signal-seam sibling this mirrors)
 * @see apps/arena-client/src/composables/useNotableEventStream.ts (the append-only cursor this mirrors)
 * @see DECISIONS.md D-24459 (the shield-block VfxOverlay burst) + D-20104 (the re-emission gate)
 */

import { ref, watch, type Ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import type { StrikeBlockThreatKind } from '../vfx/strikeBlockedVfxManifest';

// why: re-export the NotableGameEvent alias from its single definition so the
// manifest can derive its threatKind type without either module importing the
// other's runtime surface (the alias is type-only, erased at build).
export type { NotableGameEvent } from './useNotableEventStream';

/** One shield-block VFX event: the threat class that was blocked + a monotonic id. */
export interface StrikeBlockedVfxEvent {
  /** The threat class blocked — drives ONLY the deflection-burst colours. */
  readonly threatKind: StrikeBlockThreatKind;
  /** Monotonic sequence id so the overlay re-renders even on an equal-threat repeat. */
  readonly seq: number;
}

/** Renders a shield-block event (the injectable seam). */
export type StrikeBlockedVfxRenderer = (event: StrikeBlockedVfxEvent) => void;

// why: module-level reactive signal — the default render target. `VfxOverlay`
// imports `useStrikeBlockedVfxSignal()` and watches it; a change fires the
// shield-block beat. Sharing one signal keeps the producer (this consumer,
// mounted at the PlayViewport root) and the renderer (the overlay) decoupled,
// exactly as `useComboVfx` decouples from `VfxOverlay`.
const strikeBlockedVfxSignal = ref<StrikeBlockedVfxEvent | null>(null);
let sequence = 0;

/** The shared shield-block signal `VfxOverlay` consumes. */
export function useStrikeBlockedVfxSignal(): Ref<StrikeBlockedVfxEvent | null> {
  return strikeBlockedVfxSignal;
}

/** The default renderer: publishes the event to the shared module signal. */
function publishToSignal(event: StrikeBlockedVfxEvent): void {
  strikeBlockedVfxSignal.value = event;
}

/**
 * Watches a UIState snapshot ref and emits one shield-block event per new
 * `strikeBlocked` notable event, via an append-only cursor over
 * `UIState.notableEvents`.
 *
 * @param snapshot - The arena-client UIState snapshot ref.
 * @param render - The renderer to emit through; defaults to the module signal.
 *   The parameter is an injectable seam for unit tests (a recording renderer).
 */
export function useStrikeBlockedVfx(
  snapshot: Ref<UIState | null>,
  render: StrikeBlockedVfxRenderer = publishToSignal,
): void {
  // why: append-only cursor — the first `notableEvents` index this consumer has
  // not yet ingested. Mirrors `useNotableEventStream`'s re-emission gate
  // (D-20104): a length-diff alone is insufficient (it re-fires on remount /
  // wholesale snapshot replacement), so the cursor tracks true consumption.
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
      // filtering to strikeBlocked. The cursor advances past every new event
      // (strikeBlocked or not) so non-matching events are skipped, never
      // re-examined. Note: several strikeBlocked events appended in ONE frame
      // publish to the single signal in turn; Vue flushes the watch once, so the
      // overlay renders one visible beat carrying the LAST threatKind — an
      // accepted v1 limitation matching useComboVfx (WP-647 / copilot Finding 1).
      for (let index = cursor; index < events.length; index += 1) {
        const event = events[index];
        if (event !== undefined && event.type === 'strikeBlocked') {
          sequence += 1;
          render({ threatKind: event.threatKind, seq: sequence });
        }
      }
      cursor = events.length;
    },
    { immediate: true, deep: false },
  );
}
