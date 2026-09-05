/**
 * useWoundCue.ts
 *
 * The "wound gained" damage-thud consumer (WP-650) — the audio sibling of
 * `useWoundVfx` (the red vignette) and the thematic inverse of the shield-block
 * clang. It watches the local seat's `UIState.players[own].woundCount` and plays
 * a dull damage thud through the WP-412 audio engine each time that count
 * INCREASES.
 *
 * It reuses the WP-412 engine (`getAudioEngine()`) wholesale, so it inherits that
 * engine's autoplay-unlock arm, master mute (the Effect-Intensity `off` switch),
 * and master volume — no new engine, dependency, control, or channel. It mirrors
 * the shipped `useComboCue` scalar-change consumer, with the same two differences
 * as `useWoundVfx`: it self-selects the local seat via the `handCards` tell, and
 * fires ONLY on an increase (a heal decrements the count and must not thud).
 *
 * Pure presentation: it reads `UIState` only, never writes `G`/`ctx`, and adds
 * zero engine / determinism / replay footprint (per ARCHITECTURE.md).
 *
 * @see apps/arena-client/src/composables/useComboCue.ts (the scalar-change template)
 * @see apps/arena-client/src/composables/useWoundVfx.ts (the visual sibling this mirrors)
 * @see DECISIONS.md D-24462 (the wound-gained damage vignette + thud)
 */

import { watch, type Ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { getAudioEngine, type AudioEngine } from '../audio/audioEngine';
import { WOUND_GAINED_CLIP } from '../audio/woundCueManifest';

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
  // populates — the same self-selection PlayDesktop's `viewer` computed uses. A
  // spectator / autoplay frame has no own hand.
  const ownSeat = players.find((player) => player.handCards !== undefined);
  if (ownSeat === undefined) return null;
  const count = ownSeat.woundCount;
  // why: guard an older engine bundle without the woundCount projection.
  return typeof count === 'number' ? count : null;
}

/**
 * Watches a UIState snapshot ref and plays one wound-thud clip each time the
 * local seat's `woundCount` increases.
 *
 * @param snapshot - The arena-client UIState snapshot ref.
 * @param engine - The audio engine to play through; defaults to the WP-412
 *   module singleton. The parameter is an injectable seam for unit tests.
 */
export function useWoundCue(
  snapshot: Ref<UIState | null>,
  engine: AudioEngine = getAudioEngine(),
): void {
  // why: own last-seen wound count. Seeded on the first valid own-seat frame so a
  // mount / reconnect against an already-wounded snapshot plays nothing for the
  // pre-mount value. Thereafter fires exactly once per INCREASE; a decrease (a
  // heal) advances lastSeen silently so the next re-wound re-arms.
  let lastSeen: number | null = null;

  watch(
    snapshot,
    (next) => {
      const count = readOwnWoundCount(next);
      // why: safe-skip a frame with no own seat / no projection — no throw, no
      // play, and lastSeen stays un-seeded so a later valid frame initialises.
      if (count === null) return;

      // why: catch up on the first valid own-seat frame — seed lastSeen so the
      // pre-mount wound total plays nothing.
      if (lastSeen === null) {
        lastSeen = count;
        return;
      }

      // why: fire ONLY on an increase (a new Wound landed). A heal decreases the
      // count and must not thud — but still advance lastSeen so a later re-wound
      // re-arms.
      if (count > lastSeen) {
        engine.play(WOUND_GAINED_CLIP);
      }
      lastSeen = count;
    },
    { immediate: true, deep: false },
  );
}
