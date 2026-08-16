/**
 * comboVfxManifest.ts
 *
 * The tiered combo *flash*'s tier → visual model (WP-556). The visual twin of
 * the shipped audio combo cue (WP-413 / WP-425): a hero play's effects-fired
 * count (WP-409's `UIState.game.lastPlayEffectsFired`) maps to a combo tier,
 * and each audible tier maps to a particle-burst spec + the escalating
 * synergy call-out word. The flash and the audio sting ride the SAME
 * `comboTierForCount`, so a bigger chain looks and sounds bigger in lockstep.
 *
 * No visual bytes are committed — the burst is generated at runtime by
 * `canvas-confetti`; this module carries only the per-tier spec (particle
 * count, whether the tier shakes) and the call-out word.
 *
 * @see WP-556 §B "VFX tier→visual map"
 * @see apps/arena-client/src/audio/comboCueManifest.ts — the shared tier source
 * @see DECISIONS.md D-24228 / D-24246 (the shared Combo Tier Contract) + D-24365
 */

// why: import the SINGLE shared tier mapping (WP-413 / WP-425, D-24228 /
// D-24246) — there is exactly one `comboTierForCount` definition, in the audio
// manifest, and the visual flash consumes it verbatim. Re-deriving the tiers
// here would let the flash and the sting silently diverge, which the Combo
// Tier Contract forbids; a second definition is a Verification-Step-3 FAIL.
import { comboTierForCount, type ComboTier } from '../audio/comboCueManifest';

export { comboTierForCount, type ComboTier };

/** The per-tier visual spec for one audible combo tier. */
export interface ComboVfxSpec {
  /**
   * Particle count for the burst. Ascends with the tier and is capped at the
   * performance budget's 200-particle ceiling (WP-556) at the apex.
   */
  readonly particleCount: number;
  /**
   * The synergy call-out word, or `null` for a flash-only tier. `null` at
   * `small` — the WORD starts at `medium` while the FLASH starts at `small`
   * (contrast-through-restraint: a single effect is not a "synergy", so it
   * gets a spark but no word).
   */
  readonly word: string | null;
  /**
   * Whether this tier earns a screen-shake. Reserved for the peaks (`big` /
   * `legendary`); routine tiers stay subtle. The shake is additionally gated
   * at render time by `shouldRender('shake')` (off under reduced-motion / low
   * intensity).
   */
  readonly shake: boolean;
}

/**
 * The four audible tiers → their visual spec. `'none'` is deliberately absent
 * — the consumer skips it (a zero-effect play renders no flash). The
 * `Record<Exclude<ComboTier, 'none'>, ComboVfxSpec>` type is a compile-time
 * exhaustiveness pin: adding an audible tier fails `vue-tsc` here until mapped,
 * and the `comboVfxManifest.test.ts` drift test fails if any of the four is
 * unmapped. The call-out ladder wording is the WP-556 locked default:
 * `medium → Team-Up!`, `big → Unstoppable!`, `legendary → LEGENDARY!`
 * (`small` is flash-only).
 */
export const comboVfxManifest: Record<Exclude<ComboTier, 'none'>, ComboVfxSpec> = {
  small: { particleCount: 40, word: null, shake: false },
  medium: { particleCount: 90, word: 'Team-Up!', shake: false },
  big: { particleCount: 140, word: 'Unstoppable!', shake: true },
  legendary: { particleCount: 200, word: 'LEGENDARY!', shake: true },
};
