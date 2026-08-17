/**
 * useAdaptiveMusic.ts
 *
 * The adaptive danger-score consumer (WP-560). It watches WP-557's projected
 * `UIState.progress.menaceTier` and crossfades the background bed whenever the
 * tier CHANGES, so the soundtrack intensifies as the villains close in — the
 * audio twin of WP-558's Danger Meter, reading the identical projected tier.
 *
 * Pure client presentation: it reads only `UIState`, never writes `G`/`ctx`,
 * and has zero engine / determinism / replay footprint.
 *
 * @see WP-560 §Contract
 * @see DECISIONS.md D-24369 (tier-driven, change-only, stop at gameover)
 */

import { watch, type Ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import { getMusicEngine, type MusicEngine } from '../audio/musicEngine';
import { musicTrackForTier } from '../audio/menaceMusicManifest';

/**
 * Watches a UIState snapshot ref and drives the background music channel.
 *
 * @param snapshot - The arena-client UIState snapshot ref.
 * @param engine - The music engine to drive; defaults to the module singleton.
 *   The parameter is an injectable seam for unit tests.
 */
export function useAdaptiveMusic(
  snapshot: Ref<UIState | null>,
  engine: MusicEngine = getMusicEngine(),
): void {
  // why: own last-seen tier. The signal is a SCALAR that is re-projected on
  // every frame, not an event stream, so without this guard the bed would
  // restart its crossfade on every snapshot push — immediately audible as a
  // stuttering, never-settling loop. Mirrors useComboCue's last-seen scalar.
  let lastSeenTier: string | null = null;

  watch(
    snapshot,
    (next) => {
      // why: a null snapshot is the pre-match / rewound frame. Nothing plays and
      // lastSeenTier stays un-seeded, so the first real frame still starts the bed.
      if (next === null) return;

      // why: the match is over — stop the bed rather than let it play under the
      // endgame panel. The win / loss / tie resolution sting is a separate
      // Surface-4 packet (D-24369 §5), so the correct behaviour today is
      // silence, not a loop that outlives the match.
      if (next.gameOver !== undefined) {
        engine.stop();
        lastSeenTier = null;
        return;
      }

      const tier = next.progress.menaceTier;
      // why: an absent tier means the projection predates WP-557 (an old
      // fixture, a recorded replay). Silence is the honest response — the same
      // absent-signal discipline the Danger Meter applies visually.
      if (tier === undefined) return;

      // why: crossfade ONLY on a change. An unchanged tier must not re-trigger.
      if (tier === lastSeenTier) return;
      lastSeenTier = tier;

      // why: the tier is consumed VERBATIM from the projection — never
      // re-derived from `progress.menace`. The bands live once, engine-side
      // (D-24366 §3 / D-24369 §3), so the meter and this score cannot disagree.
      engine.crossfadeTo(musicTrackForTier(tier));
    },
    { immediate: true },
  );
}
