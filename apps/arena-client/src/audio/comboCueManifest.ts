/**
 * comboCueManifest.ts
 *
 * The tiered combo cue's tier model + clip manifest (WP-413, extended by
 * WP-425). A hero play's effects-fired count (WP-409's
 * `UIState.game.lastPlayEffectsFired`) maps to one of five tiers via
 * `comboTierForCount`; the four audible tiers map to CC0 clip URLs. The
 * escalating "combo" sting the ewiki Sound Effects design calls for — bigger
 * plays get a bigger cue, and a chain of five or more earns the apex
 * `LEGENDARY!` sting.
 *
 * Audio bytes are NOT committed to git — the clips are hosted on R2 and served
 * via `images.legendary-arena.com` under the `audio/sound-effects/` prefix (the
 * ewiki hosting rule, shared with the WP-412 notable-event SFX). This module
 * carries URLs only.
 *
 * @see WP-413 §A "Combo-cue manifest + tier helper"
 * @see WP-409 / D-24221 — the `lastPlayEffectsFired` signal this scales on
 * @see DECISIONS.md D-24228 (tiered combo cue; reuses the WP-412 engine)
 * @see DECISIONS.md D-24246 (WP-425 — the apex `legendary` tier: the 4th shared
 *   Combo Tier Contract boundary, consumed by the audio sting and the future
 *   visual `LEGENDARY!` call-out alike)
 */

/** The combo-cue tiers: a silent floor (`none`) plus four audible escalation levels. */
export type ComboTier = 'none' | 'small' | 'medium' | 'big' | 'legendary';

/**
 * Maps a hero-play effects-fired count to a combo tier. The locked thresholds
 * (WP-413 + WP-425 / D-24246): `<= 0 → none` (silent), `1 → small`,
 * `2 → medium`, `3–4 → big`, `>= 5 → legendary` (the apex tier). A pure
 * function — deterministic and exhaustively unit-testable.
 *
 * @param count - `UIState.game.lastPlayEffectsFired` for the most recent play.
 * @returns The tier whose clip should play (`none` ⇒ no cue).
 */
export function comboTierForCount(count: number): ComboTier {
  if (count <= 0) return 'none';
  if (count === 1) return 'small';
  if (count === 2) return 'medium';
  // why: big now covers 3–4 only; a chain of five or more effects earns the
  // apex 'legendary' tier (WP-425 / D-24246 — the 4th shared Combo Tier
  // Contract boundary, consumed identically by the audio sting and the future
  // visual LEGENDARY! call-out).
  if (count <= 4) return 'big';
  return 'legendary';
}

// why: combo clips are CC0 audio hosted on R2 and served via
// images.legendary-arena.com under the audio/sound-effects/ prefix (the ewiki
// hosting rule) — never committed to git. Clip filenames use hyphens, not
// underscores (the repo image-URL convention).
const COMBO_BASE_URL = 'https://images.legendary-arena.com/audio/sound-effects/';

/**
 * The four audible tiers → their CC0 clip URL. `'none'` is deliberately absent
 * — the consumer skips it (a zero-effect play plays no combo cue). The
 * `Record<Exclude<ComboTier, 'none'>, string>` type is a compile-time
 * exhaustiveness pin: adding an audible tier fails `vue-tsc` here until mapped,
 * and the `comboCueManifest.test.ts` drift test fails if any of the four is
 * unmapped or empty.
 */
export const comboCueManifest: Record<Exclude<ComboTier, 'none'>, string> = {
  small: `${COMBO_BASE_URL}combo-small.mp3`,
  medium: `${COMBO_BASE_URL}combo-medium.mp3`,
  big: `${COMBO_BASE_URL}combo-big.mp3`,
  legendary: `${COMBO_BASE_URL}combo-legendary.mp3`,
};
