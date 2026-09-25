/**
 * useVillainSlashVfx.ts
 *
 * The villain-slash beat's VFX producer (WP-755) — a notable-event stream
 * consumer that mirrors `useExcessiveViolenceVfx`. It watches the WP-200
 * `UIState.notableEvents` STREAM with an append-only cursor and, per new
 * `fightResolved` event (a villain or henchman defeated in the City), emits one
 * `VillainSlashVfxEvent` so the `VfxOverlay` can slice the defeated card at its
 * City space.
 *
 * It reads NO clock and NO randomness: the takedown-streak timing lives in the
 * D-24365-exempt `VfxOverlay.vue` (this file sits in `src/composables/`, outside
 * that subsurface). Pure presentation: it reads `UIState` only, never writes
 * `G`/`ctx`, and adds zero engine / determinism / replay footprint.
 *
 * @see WP-755 §C "the producer"
 * @see apps/arena-client/src/composables/useExcessiveViolenceVfx.ts (the producer this mirrors)
 * @see DECISIONS.md D-24584 (the villain-slash beat) + D-20104 (the re-emission gate)
 */

import { ref, watch, type Ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';

/** One villain-slash VFX event: where the defeat happened, who did it, and the card art. */
export interface VillainSlashVfxEvent {
  /** Monotonic sequence id so the overlay re-renders even on a repeat defeat. */
  readonly seq: number;
  /** The City space (0..4) the defeated card occupied. */
  readonly citySpace: number;
  /** The defeating player (drives the takedown streak). */
  readonly playerId: string;
  /** The defeated card's art from the prior frame, or `null` (a silhouette renders). */
  readonly imageUrl: string | null;
}

/** Renders a villain-slash event (the injectable seam). */
export type VillainSlashVfxRenderer = (event: VillainSlashVfxEvent) => void;

// why: module-level reactive signal — the default render target. `VfxOverlay`
// imports `useVillainSlashVfxSignal()` and watches it, keeping this producer
// (mounted at the PlayViewport root) and the renderer decoupled, exactly as
// `useExcessiveViolenceVfx` decouples from `VfxOverlay`.
const villainSlashVfxSignal = ref<VillainSlashVfxEvent | null>(null);
let sequence = 0;

/** The shared villain-slash signal `VfxOverlay` consumes. */
export function useVillainSlashVfxSignal(): Ref<VillainSlashVfxEvent | null> {
  return villainSlashVfxSignal;
}

/** The default renderer: publishes the event to the shared module signal. */
function publishToSignal(event: VillainSlashVfxEvent): void {
  villainSlashVfxSignal.value = event;
}

/**
 * Builds the `extId → imageUrl` map for one frame's City. An empty image URL is
 * skipped so a lookup yields `null`, never `''`.
 *
 * @param state - the frame to read.
 * @returns the map (empty when `city` / `city.spaces` is missing).
 */
function buildCityImageCache(state: UIState): Map<string, string> {
  const cache = new Map<string, string>();
  const spaces = state.city?.spaces;
  if (!Array.isArray(spaces)) return cache;
  for (const space of spaces) {
    if (space === null || space === undefined) continue;
    const imageUrl = space.display?.imageUrl;
    if (typeof imageUrl === 'string' && imageUrl.length > 0) {
      cache.set(space.extId, imageUrl);
    }
  }
  return cache;
}

/**
 * Watches a UIState snapshot ref and emits one villain-slash event per new
 * `fightResolved` notable event, via an append-only cursor over
 * `UIState.notableEvents`.
 *
 * @param snapshot - The arena-client UIState snapshot ref.
 * @param render - The renderer to emit through; defaults to the module signal.
 *   The parameter is an injectable seam for unit tests (a recording renderer).
 */
export function useVillainSlashVfx(
  snapshot: Ref<UIState | null>,
  render: VillainSlashVfxRenderer = publishToSignal,
): void {
  // why: append-only cursor (D-20104) — the first `notableEvents` index not yet
  // ingested. A length-diff alone would re-fire on remount / wholesale snapshot
  // replacement; the cursor tracks true consumption.
  let cursor = 0;
  let caughtUp = false;
  // why: the prior-frame City cache. The defeat frame has ALREADY removed the
  // card from `city.spaces` (the engine nulls the space before pushing
  // fightResolved), so the defeated card's art is only in the PREVIOUS frame.
  let priorCityImages = new Map<string, string>();

  watch(
    snapshot,
    (next) => {
      // why: safe-skip a null snapshot (before a match loads) — no throw, no beat,
      // and the cache is kept so the next valid frame still sees the last City.
      if (next === null) return;
      const events = next.notableEvents;

      if (events !== undefined) {
        if (!caughtUp) {
          // why: catch up to the snapshot's length on the first valid frame — a
          // mount / reconnect against an already-populated snapshot replays NOTHING.
          cursor = events.length;
          caughtUp = true;
        } else {
          // why: emit for the new tail in array order, filtering to fightResolved;
          // the cursor advances past every event so non-matches are never
          // re-examined. Several defeats in ONE frame publish in turn and Vue
          // flushes once — one visible beat, the accepted v1 limitation shared
          // with useExcessiveViolenceVfx.
          for (let index = cursor; index < events.length; index += 1) {
            const event = events[index];
            if (event !== undefined && event.type === 'fightResolved') {
              sequence += 1;
              render({
                seq: sequence,
                citySpace: event.citySpace,
                playerId: event.playerId,
                imageUrl: priorCityImages.get(event.cardId) ?? null,
              });
            }
          }
          cursor = events.length;
        }
      }

      // why: refresh the cache on EVERY non-null frame — including the catch-up
      // frame — and only AFTER this frame's events are processed, so the lookup
      // above always reads the frame before the defeat.
      priorCityImages = buildCityImageCache(next);
    },
    { immediate: true, deep: false },
  );
}
