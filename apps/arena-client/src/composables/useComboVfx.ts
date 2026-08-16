/**
 * useComboVfx.ts
 *
 * The tiered combo-*flash* consumer (WP-556) — the visual mirror of the shipped
 * `useComboCue` (WP-413). It watches WP-409's
 * `UIState.game.lastPlayEffectsFired` scalar and emits one combo-flash event
 * per audible value-change, so the flash escalates with the size of a synergy
 * chain in lockstep with the audio sting (both consume the SAME
 * `comboTierForCount`).
 *
 * It emits through an injectable renderer seam (default: a module-level
 * reactive signal that `VfxOverlay` consumes) — mirroring `useComboCue`'s
 * injectable audio-engine seam. Pure presentation: it reads `UIState` only,
 * never writes `G`/`ctx`, and adds zero engine / determinism / replay footprint
 * (per ARCHITECTURE.md).
 *
 * @see WP-556 §E "Combo-flash consumer"
 * @see apps/arena-client/src/composables/useComboCue.ts (the audio sibling this mirrors)
 * @see DECISIONS.md D-24228 / D-24246 (the shared Combo Tier Contract) + D-24365
 */

import { ref, watch, type Ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { comboTierForCount, comboVfxManifest, type ComboTier } from '../vfx/comboVfxManifest';

/** One combo-flash event: the tier that fired, its call-out word (or null), and a monotonic id. */
export interface ComboVfxEvent {
  readonly tier: Exclude<ComboTier, 'none'>;
  /** The call-out word (`null` at the flash-only `small` tier). */
  readonly word: string | null;
  /** Monotonic sequence id so the overlay re-renders even on an equal-tier repeat. */
  readonly seq: number;
}

/** Renders a combo-flash event (the injectable seam). */
export type ComboVfxRenderer = (event: ComboVfxEvent) => void;

// why: module-level reactive signal — the default render target. `VfxOverlay`
// imports `comboVfxSignal` and watches it; a change fires the burst + word.
// Sharing one signal keeps the producer (this consumer, mounted at the
// PlayViewport root) and the renderer (the overlay) decoupled, exactly as the
// notableEvents stream decouples from NotableEventOverlay.
const comboVfxSignal = ref<ComboVfxEvent | null>(null);
let sequence = 0;

/** The shared combo-flash signal `VfxOverlay` consumes. */
export function useComboVfxSignal(): Ref<ComboVfxEvent | null> {
  return comboVfxSignal;
}

/** The default renderer: publishes the event to the shared module signal. */
function publishToSignal(event: ComboVfxEvent): void {
  comboVfxSignal.value = event;
}

/**
 * Watches a UIState snapshot ref and emits one combo-flash event per audible
 * change of `game.lastPlayEffectsFired`.
 *
 * @param snapshot - The arena-client UIState snapshot ref.
 * @param render - The renderer to emit through; defaults to the module signal.
 *   The parameter is an injectable seam for unit tests (a recording renderer).
 */
export function useComboVfx(
  snapshot: Ref<UIState | null>,
  render: ComboVfxRenderer = publishToSignal,
): void {
  // why: own last-seen scalar. This consumer keys off a VALUE CHANGE of the
  // scalar UIState.game.lastPlayEffectsFired (WP-409) — it is deliberately NOT
  // an append-only cursor, because the signal is a scalar (overwritten per
  // play, reset to 0 in the play-phase onBegin), not a stream. It catches up on
  // the first valid frame (seed lastSeen to the current value, so no flash
  // fires for the pre-mount value / on remount), then emits exactly one event
  // per subsequent AUDIBLE value-change (tier !== 'none'). Two consecutive
  // same-turn plays with the SAME non-zero count coalesce to one flash (the
  // scalar does not change) — an accepted v1 limitation; the per-turn reset to
  // 0 re-arms equal-value plays across turns (3 -> 0 -> 3 fires the second 3).
  let lastSeen: number | null = null;

  watch(
    snapshot,
    (next) => {
      // why: safe-skip a null snapshot (first tick before a match loads) OR an
      // older engine bundle without WP-409's game.lastPlayEffectsFired
      // projection — no throw, no flash, and lastSeen stays un-seeded so a later
      // valid frame can still initialise.
      if (next === null) return;
      const count = next.game?.lastPlayEffectsFired;
      if (count === undefined) return;

      // why: catch up on the first valid frame — seed lastSeen to the current
      // value so a mount against an already-populated snapshot flashes nothing
      // for the pre-mount value.
      if (lastSeen === null) {
        lastSeen = count;
        return;
      }

      if (count !== lastSeen) {
        lastSeen = count;
        const tier = comboTierForCount(count);
        // why: a change into the silent 'none' tier (e.g. the per-turn reset to
        // 0) advances lastSeen but flashes nothing; only audible tiers fire.
        if (tier !== 'none') {
          sequence += 1;
          render({ tier, word: comboVfxManifest[tier].word, seq: sequence });
        }
      }
    },
    { immediate: true, deep: false },
  );
}
