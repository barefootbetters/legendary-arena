/**
 * victoryFinaleVfxManifest.ts
 *
 * The heroes-win victory finale's visual model — the biggest positive payoff in
 * the game (the wiki's Surface 4 endgame bloom). When the engine projects a
 * `heroes-win` outcome on `UIState.gameOver`, `useVictoryFinaleVfx` fires once and
 * this manifest supplies the celebration: a gold confetti STORM (several staggered
 * bursts, not a single pop), a gold power-bloom, and the "VICTORY!" banner.
 *
 * Forward-compatible with the Final Blow rule (WP-687): the finale fires on the
 * projected win, whichever fight produces it. Under normal rules that is the
 * fourth-Tactic defeat; once Final Blow ships, the win fires on the fifth (final)
 * blow instead — this celebration lands on it automatically, no change here.
 *
 * No visual bytes are committed — the storm is generated at runtime by
 * `canvas-confetti`; this module carries only the storm cadence, the palette, and
 * the banner word.
 *
 * @see apps/arena-client/src/vfx/transformVfxManifest.ts — the single-spec manifest precedent
 * @see apps/arena-client/src/composables/useVictoryFinaleVfx.ts — the fire-once consumer this pairs with
 * @see wiki/visual-effects.md §Surface 4 — Outcome / endgame (heroes-win victory bloom + confetti storm)
 * @see DECISIONS.md D-24365 (the WP-556 VFX foundation + the VFX determinism exemption)
 */

/** The single spec for the heroes-win finale: the confetti storm + its palette. */
export interface VictoryFinaleVfxSpec {
  /** How many staggered confetti bursts make the "storm" (a storm, not one pop). */
  readonly burstCount: number;
  /** Particles per burst — a big throw, under the WP-556 200-particle ceiling. */
  readonly burstParticleCount: number;
  /** Milliseconds between staggered bursts so the storm rolls rather than blinks. */
  readonly burstIntervalMs: number;
  /** The celebration palette — heroic gold, hero-blue, and white. */
  readonly colors: readonly string[];
}

/** The constant banner word for the heroes-win finale. */
export const VICTORY_WORD = 'VICTORY!';

/**
 * The heroes-win finale spec: three gold-and-blue bursts spaced a quarter-second
 * apart (the "confetti storm"), each 160 particles. Distinct from every other
 * effect's palette so the win reads as the game's biggest, rarest moment.
 */
export const VICTORY_FINALE_VFX: VictoryFinaleVfxSpec = {
  burstCount: 3,
  burstParticleCount: 160,
  burstIntervalMs: 260,
  colors: ['#ffd34e', '#ffe9a8', '#7ec8ff', '#ffffff'],
};
