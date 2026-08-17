/**
 * menaceMusicManifest.ts
 *
 * Maps the engine-projected `MenaceTier` to its background loop (WP-560).
 * Three independently-composed CC0 loops, crossfaded as the danger rises —
 * "horizontal re-sequencing" per D-24369 §2, chosen over vertical stem
 * layering because stems must be recorded in sync and cannot be assembled
 * from independent CC0 tracks.
 *
 * why (D-24369 §3): this module declares **no band boundaries**. It imports
 * `MenaceTier` and keys off it. The bands live once, engine-side, in
 * `schemeLossProgress.ts` (D-24366 §3) — a second table here is exactly how
 * the Danger Meter (WP-558) and this score would come to disagree about what
 * "critical" means.
 *
 * Audio bytes are NOT committed to git — the loops are hosted on R2 and served
 * via `images.legendary-arena.com` under a new `audio/music/` prefix (the
 * ewiki hosting rule, shared with the WP-412 SFX).
 *
 * @see WP-560 §Contract
 * @see DECISIONS.md D-24369 (separate music engine; horizontal re-sequencing)
 * @see DECISIONS.md D-24366 §3 (the shared MenaceTier band contract)
 */

import type { MenaceTier } from '@legendary-arena/game-engine';

// why: a NEW R2 prefix, sibling to `audio/sound-effects/`. Music is a distinct
// asset class (long loopable beds, not one-shot stings) and separating the
// prefixes keeps the upload script's content-driven directory sweep unambiguous.
const MUSIC_BASE_URL = 'https://images.legendary-arena.com/audio/music/';

/**
 * The background loop for each danger tier, ascending in intensity.
 *
 * Keyed by the full `MenaceTier` union — a `Record` rather than a partial map,
 * so a future tier member fails to compile here until it is given a loop.
 */
export const menaceMusicManifest: Record<MenaceTier, string> = {
  calm: `${MUSIC_BASE_URL}menace-calm.mp3`,
  rising: `${MUSIC_BASE_URL}menace-rising.mp3`,
  critical: `${MUSIC_BASE_URL}menace-critical.mp3`,
};

/**
 * Resolves the loop URL for a projected tier.
 *
 * @param tier - The tier as projected by the engine. Never re-derived here.
 * @returns The R2 URL of that tier's background loop.
 */
export function musicTrackForTier(tier: MenaceTier): string {
  return menaceMusicManifest[tier];
}
