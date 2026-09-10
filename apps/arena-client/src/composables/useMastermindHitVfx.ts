/**
 * useMastermindHitVfx.ts
 *
 * The mastermind-hit beat's producer — the escalating juice for each blow a
 * player lands on the Mastermind. Every successful `fightMastermind` defeats one
 * of the Mastermind's four Tactics, and the play board projects the running total
 * as `UIState.mastermind.tacticsDefeated`. This consumer watches that count and
 * emits one hit event each time it INCREASES, carrying the new count so the
 * `VfxOverlay` can pick the escalating beat (hit 1 spark → hit 4 screen-shaking
 * impact) from `mastermindHitVfxManifest`.
 *
 * It mirrors the shipped `useWoundVfx` scalar-change consumer with two deliberate
 * differences:
 *
 *   1. The scalar is a SHARED, public board field (`mastermind.tacticsDefeated`),
 *      not a per-seat one — so it fires for EVERY viewer (mirroring the public
 *      shield-block / transform beats), never self-selecting a seat. A hit on the
 *      Mastermind is a shared-board moment everyone at the table sees.
 *   2. It fires ONLY on an INCREASE (`count > lastSeen`) — a tactics count never
 *      decreases in normal play, but the guard keeps a wholesale snapshot
 *      replacement (reconnect to a lower-count frame) from flashing a phantom hit,
 *      and it still advances `lastSeen` on any change.
 *
 * A fifth Final-Blow fight (WP-687, future) does NOT increment `tacticsDefeated`
 * — it awards the Mastermind card and fires the victory finale — so this consumer
 * covers exactly the four Tactic hits by design.
 *
 * It emits through an injectable renderer seam (default: a module-level reactive
 * signal `VfxOverlay` consumes) — mirroring `useComboVfx` / `useWoundVfx`. Pure
 * presentation: it reads `UIState` only, never writes `G`/`ctx`, and adds zero
 * engine / determinism / replay footprint (per ARCHITECTURE.md).
 *
 * @see apps/arena-client/src/composables/useWoundVfx.ts (the count-delta template this mirrors)
 * @see apps/arena-client/src/vfx/mastermindHitVfxManifest.ts (the escalating per-hit spec)
 * @see DECISIONS.md D-24365 (the WP-556 VFX foundation + the VFX determinism exemption)
 */

import { ref, watch, type Ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';

/** One mastermind-hit event: the running defeated-tactic count + a monotonic id. */
export interface MastermindHitVfxEvent {
  /** The new `tacticsDefeated` count (1..4) — drives the escalating beat tier. */
  readonly tacticsDefeated: number;
  /** Monotonic sequence id so the overlay re-renders on a repeat hit. */
  readonly seq: number;
}

/** Renders a mastermind-hit event (the injectable seam). */
export type MastermindHitVfxRenderer = (event: MastermindHitVfxEvent) => void;

// why: module-level reactive signal — the default render target. `VfxOverlay`
// imports `useMastermindHitVfxSignal()` and watches it; a change fires the
// escalating hit beat. One signal decouples the producer (this consumer, mounted
// at the PlayViewport root) from the renderer (the overlay), exactly as
// `useWoundVfx` / `useComboVfx` do.
const mastermindHitVfxSignal = ref<MastermindHitVfxEvent | null>(null);
let sequence = 0;

/** The shared mastermind-hit signal `VfxOverlay` consumes. */
export function useMastermindHitVfxSignal(): Ref<MastermindHitVfxEvent | null> {
  return mastermindHitVfxSignal;
}

/** The default renderer: publishes the event to the shared module signal. */
function publishToSignal(event: MastermindHitVfxEvent): void {
  mastermindHitVfxSignal.value = event;
}

/**
 * Reads the projected `mastermind.tacticsDefeated` from a UIState snapshot, or
 * `null` when the frame has no mastermind projection (pre-match / older bundle).
 *
 * @param next - the UIState snapshot (may be null before a match loads).
 * @returns the defeated-tactic count, or `null` to safe-skip this frame.
 */
function readTacticsDefeated(next: UIState | null): number | null {
  if (next === null) return null;
  const mastermind = next.mastermind;
  if (mastermind === undefined) return null;
  const count = mastermind.tacticsDefeated;
  // why: guard an older engine bundle without the tacticsDefeated projection.
  return typeof count === 'number' ? count : null;
}

/**
 * Watches a UIState snapshot ref and emits one mastermind-hit event each time the
 * shared `mastermind.tacticsDefeated` count increases.
 *
 * @param snapshot - the arena-client UIState snapshot ref.
 * @param render - the renderer to emit through; defaults to the module signal.
 *   The parameter is an injectable seam for unit tests (a recording renderer).
 */
export function useMastermindHitVfx(
  snapshot: Ref<UIState | null>,
  render: MastermindHitVfxRenderer = publishToSignal,
): void {
  // why: last-seen defeated-tactic count. Seeded on the first valid frame so a
  // mount / reconnect against an already-fought Mastermind flashes nothing for the
  // pre-mount count. Thereafter fires exactly once per INCREASE.
  let lastSeen: number | null = null;

  watch(
    snapshot,
    (next) => {
      const count = readTacticsDefeated(next);
      // why: safe-skip a frame with no mastermind projection — no throw, no flash,
      // and lastSeen stays un-seeded so a later valid frame initialises.
      if (count === null) return;

      // why: catch up on the first valid frame — seed lastSeen so the pre-mount
      // defeated-tactic total flashes nothing.
      if (lastSeen === null) {
        lastSeen = count;
        return;
      }

      // why: fire ONLY on an increase (a new Tactic fell). A tactics count never
      // decreases in play; the guard keeps a wholesale snapshot replacement to a
      // lower count (a reconnect frame) from flashing a phantom hit. Advance
      // lastSeen on any change so the next real hit re-arms.
      if (count > lastSeen) {
        sequence += 1;
        render({ tacticsDefeated: count, seq: sequence });
      }
      lastSeen = count;
    },
    { immediate: true, deep: false },
  );
}
