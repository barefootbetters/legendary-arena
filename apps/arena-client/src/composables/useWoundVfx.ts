/**
 * useWoundVfx.ts
 *
 * The "wound gained" damage-vignette consumer (WP-650) — the thematic inverse of
 * the shield-block beat (WP-647): where the shield celebrates a threat AVOIDED,
 * this fires when the local player TAKES a Wound. It watches the local seat's
 * `UIState.players[own].woundCount` and emits one wound event each time that
 * count INCREASES, so a dull-red damage vignette flashes on the play surface.
 *
 * It is the visual sibling of `useWoundCue` (the audio thud), and mirrors the
 * shipped `useComboVfx` scalar-change consumer — with two deliberate differences:
 *
 *   1. The scalar is nested per-player (`players[own].woundCount`), not top-level,
 *      so it self-selects the LOCAL seat via the `handCards !== undefined` tell
 *      (the audience filter populates `handCards` only for the viewer's own seat —
 *      the same self-selection PlayDesktop's `viewer` computed uses). A spectator /
 *      autoplay frame has no own hand and is safe-skipped.
 *   2. It fires ONLY on an INCREASE (`count > lastSeen`), because a Wound can be
 *      HEALED (the count decreases) and a heal must not flash a damage cue. It
 *      still advances `lastSeen` on a decrease so a later re-wound re-arms.
 *
 * It emits through an injectable renderer seam (default: a module-level reactive
 * signal `VfxOverlay` consumes) — mirroring `useComboVfx`. Pure presentation: it
 * reads `UIState` only, never writes `G`/`ctx`, and adds zero engine / determinism
 * / replay footprint (per ARCHITECTURE.md).
 *
 * @see apps/arena-client/src/composables/useComboVfx.ts (the scalar-change template)
 * @see apps/arena-client/src/composables/useWoundCue.ts (the audio sibling this mirrors)
 * @see DECISIONS.md D-24462 (the wound-gained damage vignette + thud) + D-24365 (the VFX determinism exemption)
 */

import { ref, watch, type Ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';

/** One wound-gained event: a monotonic id so the overlay re-renders on a repeat. */
export interface WoundVfxEvent {
  /** Monotonic sequence id so the overlay re-runs the vignette on a repeat wound. */
  readonly seq: number;
}

/** Renders a wound-gained event (the injectable seam). */
export type WoundVfxRenderer = (event: WoundVfxEvent) => void;

// why: module-level reactive signal — the default render target. `VfxOverlay`
// imports `woundVfxSignal` and watches it; a change flashes the damage vignette.
// One signal decouples the producer (this consumer, mounted at the PlayViewport
// root) from the renderer (the overlay), exactly as `useComboVfx` does.
const woundVfxSignal = ref<WoundVfxEvent | null>(null);
let sequence = 0;

/** The shared wound-gained signal `VfxOverlay` consumes. */
export function useWoundVfxSignal(): Ref<WoundVfxEvent | null> {
  return woundVfxSignal;
}

/** The default renderer: publishes the event to the shared module signal. */
function publishToSignal(event: WoundVfxEvent): void {
  woundVfxSignal.value = event;
}

/**
 * Reads the LOCAL seat's wound count from a UIState snapshot, or `null` when the
 * frame has no own seat / no projection. The local seat is the one whose
 * `handCards` is populated — the audience filter reveals a hand only to its owner.
 *
 * @param next - The UIState snapshot (may be null before a match loads).
 * @returns the local player's `woundCount`, or `null` to safe-skip this frame.
 */
function readOwnWoundCount(next: UIState | null): number | null {
  if (next === null) return null;
  const players = next.players;
  if (players === undefined) return null;
  // why: the local seat is the only player whose handCards the audience filter
  // populates (uiState.filter.ts) — the same self-selection PlayDesktop's
  // `viewer` computed uses. A spectator / autoplay frame has no own hand.
  const ownSeat = players.find((player) => player.handCards !== undefined);
  if (ownSeat === undefined) return null;
  const count = ownSeat.woundCount;
  // why: guard an older engine bundle without the woundCount projection.
  return typeof count === 'number' ? count : null;
}

/**
 * Watches a UIState snapshot ref and emits one wound-gained event each time the
 * local seat's `woundCount` increases.
 *
 * @param snapshot - The arena-client UIState snapshot ref.
 * @param render - The renderer to emit through; defaults to the module signal.
 *   The parameter is an injectable seam for unit tests (a recording renderer).
 */
export function useWoundVfx(
  snapshot: Ref<UIState | null>,
  render: WoundVfxRenderer = publishToSignal,
): void {
  // why: own last-seen wound count. Seeded on the first valid own-seat frame so a
  // mount / reconnect against an already-wounded snapshot flashes nothing for the
  // pre-mount value. Thereafter fires exactly once per INCREASE; a decrease (a
  // heal) advances lastSeen silently so the next re-wound re-arms.
  let lastSeen: number | null = null;

  watch(
    snapshot,
    (next) => {
      const count = readOwnWoundCount(next);
      // why: safe-skip a frame with no own seat / no projection — no throw, no
      // flash, and lastSeen stays un-seeded so a later valid frame initialises.
      if (count === null) return;

      // why: catch up on the first valid own-seat frame — seed lastSeen so the
      // pre-mount wound total flashes nothing.
      if (lastSeen === null) {
        lastSeen = count;
        return;
      }

      // why: fire ONLY on an increase (a new Wound landed). A heal decreases the
      // count and must not flash a damage cue — but still advance lastSeen so a
      // later re-wound (down then back up) re-arms.
      if (count > lastSeen) {
        sequence += 1;
        render({ seq: sequence });
      }
      lastSeen = count;
    },
    { immediate: true, deep: false },
  );
}
