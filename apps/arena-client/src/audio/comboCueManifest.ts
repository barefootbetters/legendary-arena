/**
 * comboCueManifest.ts
 *
 * The tiered combo cue's tier model + clip manifest (WP-413). A hero play's
 * effects-fired count (WP-409's `UIState.game.lastPlayEffectsFired`) maps to one
 * of four tiers via `comboTierForCount`; the three audible tiers map to CC0
 * clip URLs. The escalating "combo" sting the ewiki Sound Effects design calls
 * for — bigger plays get a bigger cue.
 *
 * Audio bytes are NOT committed to git — the clips are hosted on R2 and served
 * via `images.legendary-arena.com` under the `audio/sound-effects/` prefix (the
 * ewiki hosting rule, shared with the WP-412 notable-event SFX). This module
 * carries URLs only.
 *
 * @see WP-413 §A "Combo-cue manifest + tier helper"
 * @see WP-409 / D-24221 — the `lastPlayEffectsFired` signal this scales on
 * @see DECISIONS.md D-24228 (tiered combo cue; reuses the WP-412 engine)
 */

/** The combo-cue tiers: a silent floor (`none`) plus three audible escalation levels. */
export type ComboTier = 'none' | 'small' | 'medium' | 'big';

/**
 * Maps a hero-play effects-fired count to a combo tier. The locked WP-413
 * thresholds: `<= 0 → none` (silent), `1 → small`, `2 → medium`, `>= 3 → big`.
 * A pure function — deterministic and exhaustively unit-testable.
 *
 * @param count - `UIState.game.lastPlayEffectsFired` for the most recent play.
 * @returns The tier whose clip should play (`none` ⇒ no cue).
 */
export function comboTierForCount(count: number): ComboTier {
  if (count <= 0) return 'none';
  if (count === 1) return 'small';
  if (count === 2) return 'medium';
  return 'big';
}

// why: combo clips are CC0 audio hosted on R2 and served via
// images.legendary-arena.com under the audio/sound-effects/ prefix (the ewiki
// hosting rule) — never committed to git. Clip filenames use hyphens, not
// underscores (the repo image-URL convention).
const COMBO_BASE_URL = 'https://images.legendary-arena.com/audio/sound-effects/';

/**
 * The three audible tiers → their CC0 clip URL. `'none'` is deliberately absent
 * — the consumer skips it (a zero-effect play plays no combo cue). The
 * `Record<Exclude<ComboTier, 'none'>, string>` type is a compile-time
 * exhaustiveness pin: adding an audible tier fails `vue-tsc` here until mapped,
 * and the `comboCueManifest.test.ts` drift test fails if any of the three is
 * unmapped or empty.
 */
export const comboCueManifest: Record<Exclude<ComboTier, 'none'>, string> = {
  small: `${COMBO_BASE_URL}combo-small.mp3`,
  medium: `${COMBO_BASE_URL}combo-medium.mp3`,
  big: `${COMBO_BASE_URL}combo-big.mp3`,
};
