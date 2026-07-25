/**
 * useMoveSounds.ts
 *
 * The Surface-2 player-action-move cue (WP-421). It returns a `playMoveSound`
 * function that the client calls at the single move-dispatch chokepoint
 * (`App.vue`'s `submitMove` closure): given a `UiMoveName`, it plays the mapped
 * CC0 clip through the WP-412 audio engine the instant the move is dispatched
 * locally — immediate tactile feedback, independent of the authoritative
 * engine result.
 *
 * Unlike `useSoundEffects` (Surface 1) and `useComboCue`, this consumer does
 * NOT watch a `UIState` snapshot: a move cue must fire on the LOCAL dispatch,
 * not on a projected result frame (the result may arrive turns later, may be
 * rejected, or — for `recruitHero` — emits no notable event at all, so the
 * dispatch is the only signal). It reuses the WP-412 engine
 * (`getAudioEngine()`) wholesale, so it inherits that engine's autoplay-unlock
 * arm, master mute, and master volume — no new engine, no new dependency, no
 * new control, no second channel.
 *
 * Pure presentation: it reads no `UIState`, never writes `G`/`ctx`, and adds
 * zero engine / determinism / replay footprint (per ARCHITECTURE.md). An
 * unmapped move name is a silent no-op.
 *
 * @see WP-421 §B "Move-cue consumer"
 * @see apps/arena-client/src/composables/useComboCue.ts (the sibling consumer)
 * @see apps/arena-client/src/audio/moveSfxManifest.ts (the dispatch → clip map)
 * @see DECISIONS.md D-24241 (dispatch-keyed Surface-2 cue, WP-412-engine-reusing)
 */

import { getAudioEngine, type AudioEngine } from '../audio/audioEngine';
import { moveSfxManifest } from '../audio/moveSfxManifest';
import type { UiMoveName } from '../components/play/uiMoveName.types';

/**
 * Builds the Surface-2 move-cue player. Call the returned function with the
 * `UiMoveName` being dispatched to fire that move's tactile clip.
 *
 * @param engine - The audio engine to play through; defaults to the WP-412
 *   module singleton. The parameter is an injectable seam for unit tests.
 * @returns `playMoveSound(name)` — plays the clip mapped to `name`, or a silent
 *   no-op for a move with no Surface-2 clip (lobby / stage / resolve moves).
 */
export function useMoveSounds(
  engine: AudioEngine = getAudioEngine(),
): (name: UiMoveName) => void {
  return (name: UiMoveName): void => {
    // why: a partial manifest — most move names carry no Surface-2 clip (lobby,
    // stage plumbing, pending-choice resolves). Look up the clip and play only
    // when one exists; an unmapped name is a silent no-op, never a throw. The
    // engine applies its own unlock / mute / volume gates on top, so a cue
    // before the first user gesture is already silently swallowed there.
    const clipUrl = moveSfxManifest[name];
    if (clipUrl !== undefined) {
      engine.play(clipUrl);
    }
  };
}
