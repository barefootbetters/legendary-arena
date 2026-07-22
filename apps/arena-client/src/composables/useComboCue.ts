/**
 * useComboCue.ts
 *
 * The tiered combo-cue consumer (WP-413). It watches WP-409's
 * `UIState.game.lastPlayEffectsFired` scalar and plays an escalating "combo"
 * sting through the WP-412 audio engine whenever a hero play's effects-fired
 * count changes to an audible tier.
 *
 * It reuses the WP-412 engine (`getAudioEngine()`) wholesale, so it inherits
 * that engine's autoplay-unlock arm, master mute, and master volume — no new
 * engine, no new dependency, no new control, no second channel.
 *
 * Pure presentation: it reads `UIState` only, never writes `G`/`ctx`, and adds
 * zero engine / determinism / replay footprint (per ARCHITECTURE.md).
 *
 * @see WP-413 §B "Combo-cue consumer"
 * @see apps/arena-client/src/composables/useSoundEffects.ts (the sibling consumer)
 * @see DECISIONS.md D-24228 (scalar-change consumer, WP-412-engine-reusing)
 */

import { watch, type Ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { getAudioEngine, type AudioEngine } from '../audio/audioEngine';
import { comboCueManifest, comboTierForCount } from '../audio/comboCueManifest';

/**
 * Watches a UIState snapshot ref and plays one combo-cue clip per audible
 * change of `game.lastPlayEffectsFired`.
 *
 * @param snapshot - The arena-client UIState snapshot ref.
 * @param engine - The audio engine to play through; defaults to the WP-412
 *   module singleton. The parameter is an injectable seam for unit tests.
 */
export function useComboCue(
  snapshot: Ref<UIState | null>,
  engine: AudioEngine = getAudioEngine(),
): void {
  // why: own last-seen scalar. This consumer keys off a VALUE CHANGE of the
  // scalar UIState.game.lastPlayEffectsFired (WP-409) — it is deliberately NOT
  // an append-only cursor like useSoundEffects, because the signal is a scalar
  // (overwritten per play, reset to 0 in the play-phase onBegin), not a stream.
  // It catches up on the first valid frame (seed lastSeen to the current value,
  // so no cue fires for the pre-mount value / on remount), then fires exactly
  // one clip per subsequent AUDIBLE value-change (tier !== 'none'). Two
  // consecutive same-turn plays with the SAME non-zero count coalesce to one
  // cue (the scalar does not change) — an accepted v1 limitation; the per-turn
  // reset to 0 re-arms equal-value plays across turns (3 -> 0 -> 3 fires the
  // second 3).
  let lastSeen: number | null = null;

  watch(
    snapshot,
    (next) => {
      // why: safe-skip a null snapshot (first-tick before a match loads) OR an
      // older engine bundle without WP-409's game.lastPlayEffectsFired
      // projection — no throw, no play, and lastSeen stays un-seeded so a later
      // valid frame can still initialise.
      if (next === null) return;
      const count = next.game?.lastPlayEffectsFired;
      if (count === undefined) return;

      // why: catch up on the first valid frame — seed lastSeen to the current
      // value so a mount against an already-populated snapshot plays no cue for
      // the pre-mount value.
      if (lastSeen === null) {
        lastSeen = count;
        return;
      }

      if (count !== lastSeen) {
        lastSeen = count;
        const tier = comboTierForCount(count);
        // why: a change into the silent 'none' tier (e.g. the per-turn reset to
        // 0) advances lastSeen but plays nothing; only audible tiers fire.
        if (tier !== 'none') {
          engine.play(comboCueManifest[tier]);
        }
      }
    },
    { immediate: true, deep: false },
  );
}
