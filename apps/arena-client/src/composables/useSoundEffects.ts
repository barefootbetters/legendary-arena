/**
 * useSoundEffects.ts
 *
 * The notable-event SFX consumer (WP-412 Surface 1). It watches the
 * `UIState.notableEvents` stream shipped by WP-200 and plays the clip mapped to
 * each newly-appended event's `type` (the six `NotableGameEventType` variants).
 *
 * This is a SIBLING of `useNotableEventStream`, NOT a reuse of it: the overlay
 * stream surfaces one event at a time through a 2.5 s auto-dismiss queue (the
 * wrong shape for audio, which must fire a clip on EVERY newly-appended event
 * immediately). So this composable keeps its own append-only cursor over the
 * same stream, catches up on the first frame (no history replay), and fires per
 * event with no throttle.
 *
 * Pure presentation: it reads `UIState` only, never writes `G`/`ctx`, and adds
 * zero engine / determinism / replay footprint (per ARCHITECTURE.md).
 *
 * @see WP-412 §D "SFX consumer"
 * @see apps/arena-client/src/composables/useNotableEventStream.ts (the sibling)
 * @see DECISIONS.md D-24224 (own-cursor consumer, no overlay-style throttle)
 */

import { watch, type Ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { getAudioEngine, type AudioEngine } from '../audio/audioEngine';
import { sfxManifest } from '../audio/sfxManifest';

/**
 * Watches a UIState snapshot ref and plays one SFX clip per newly-appended
 * notable event, in `notableEvents` array order.
 *
 * @param snapshot - The arena-client UIState snapshot ref.
 * @param engine - The audio engine to play through; defaults to the module
 *   singleton. The parameter is an injectable seam for unit tests.
 */
export function useSoundEffects(
  snapshot: Ref<UIState | null>,
  engine: AudioEngine = getAudioEngine(),
): void {
  // why: own append-only cursor + caught-up flag. This consumer is a SIBLING of
  // useNotableEventStream — it deliberately does NOT reuse that composable's
  // one-at-a-time 2.5 s overlay queue. It catches the cursor up to the
  // snapshot's current length on the first valid frame (NO history replay of
  // pre-mount events), then fires exactly one clip per newly-appended event in
  // index order, immediately, with NO auto-dismiss throttle. The cursor is the
  // first `notableEvents` index this composable has not yet played; events
  // below it MUST NOT re-play on remount (the append-only array, D-20004,
  // makes cursor = length the safe high-water mark).
  let cursor = 0;
  let caughtUp = false;

  watch(
    snapshot,
    (next) => {
      // why: safe-skip a null snapshot (first-tick before a match loads) OR an
      // older engine bundle without the WP-200 notableEvents projection — no
      // throw, no play, and the cursor stays un-caught-up so a later valid
      // frame can still initialise.
      if (next === null) return;
      const events = next.notableEvents;
      if (events === undefined) return;

      // why: catch up to the current length on the first valid frame so a mount
      // against an already-populated snapshot does NOT replay consumed history
      // (a sound must not fire for events that resolved before this client
      // connected / remounted).
      if (!caughtUp) {
        cursor = events.length;
        caughtUp = true;
        return;
      }

      // why: fire one clip per newly-appended event in array order — no
      // collapsing on multi-event frames, no dropping on snapshot gaps, no
      // LIFO. The for-loop iterates positionally to honour the engine's
      // dispatch order (D-20003 appliedEffects ordering carries through).
      for (let index = cursor; index < events.length; index += 1) {
        const event = events[index];
        if (event !== undefined) {
          engine.play(sfxManifest[event.type]);
        }
      }
      cursor = events.length;
    },
    { immediate: true, deep: false },
  );
}
