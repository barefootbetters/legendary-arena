/**
 * excessiveViolenceVfxManifest.ts
 *
 * The `excessiveViolenceFired` fight-overspend beat's visual model (WP-746) —
 * the juice for a Fight "using Excessive Violence" firing its enrolled EV
 * abilities (the signature overspend mechanic of the Venomverse set, WP-736),
 * riding the WP-556 VFX foundation. When the engine emits an
 * `excessiveViolenceFired` notable event, this manifest supplies the crimson /
 * steel "crossed-swords slash" burst palette, the particle count, and the
 * constant call-out word.
 *
 * Thematically this is a violent overspend — steel blades and blood — the
 * opposite register from the gamma-green transform surge, the hot amber
 * mastermind-hit ember, and the threat-coloured shield-block deflection. So it
 * gets its own crimson/steel palette rather than reusing any existing effect's
 * colours. Unlike `strikeBlockedVfxManifest` there is no per-variant `Record`:
 * the fire has no sub-kind, so a single spec suffices (the composable emits a
 * plain seq, not a discriminator) — the `transformVfxManifest` shape.
 *
 * No visual bytes are committed — the burst is generated at runtime by
 * `canvas-confetti`; this module carries only the colour spec, the particle
 * count (under the WP-556 200-particle ceiling), and the constant word.
 *
 * @see WP-746 §F "the manifest"
 * @see apps/arena-client/src/vfx/transformVfxManifest.ts — the single-spec manifest precedent
 * @see DECISIONS.md D-24569 (the excessiveViolenceFired event + the swords-burst VFX beat) + D-24365 (the VFX determinism exemption)
 */

/** The single burst spec for the Excessive Violence beat: the crossed-swords slash colours + count + blade shape. */
export interface ExcessiveViolenceVfxSpec {
  /** Non-empty crimson/steel palette for the crossed-swords slash burst. */
  readonly colors: readonly string[];
  /** How many particles the slash-burst throws — under the WP-556 200-particle ceiling. */
  readonly particleCount: number;
  /**
   * An SVG path (in a 24×24 box) for a single filled SWORD silhouette. The
   * overlay feeds this to `canvas-confetti`'s `shapeFromPath` so the particles
   * are tumbling blades, not round confetti — the difference between "a burst of
   * crimson swords" and a party popper (operator feedback 2026-09-23). If the
   * running `canvas-confetti` lacks `shapeFromPath`, the overlay falls back to
   * round particles in the same palette.
   */
  readonly shapePath: string;
  /**
   * Particle scale for the blades. Larger than the round-confetti default (1) so
   * a sword silhouette is legible at burst size.
   */
  readonly scalar: number;
}

/** The constant call-out word for every Excessive Violence beat. */
export const EXCESSIVE_VIOLENCE_WORD = 'EXCESSIVE VIOLENCE!';

/**
 * The Excessive Violence beat's crossed-swords slash burst — a deep blood
 * crimson core through a cold steel grey to a bright steel edge. The lead
 * crimson `#b3122b` is distinct from every other effect's lead colour (Master
 * Strike red `#e23046`, mastermind-hit amber `#ff9d2e`, transform gamma-green
 * `#5ee66b`, wound dull-red `#960c0c`, and the combo default multicolor) so an
 * overspend reads as its own moment — the steel greys are what set it apart from
 * the brighter Master-Strike red at a glance. `particleCount` is a lively 160, in
 * the same band as the shield (120) and transform (130) bursts and well under the
 * WP-556 200-particle ceiling (distinctness + the ceiling are test assertions).
 */
export const EXCESSIVE_VIOLENCE_VFX: ExcessiveViolenceVfxSpec = {
  colors: ['#b3122b', '#6e7b8b', '#d7dde3'],
  particleCount: 160,
  // why: a single upward sword silhouette (tip → blade → crossguard → grip →
  // pommel) in a 24×24 box — canvas-confetti's shapeFromPath fills it, so each
  // particle tumbles as a blade. Reads as flying swords, on-theme with the
  // fight-button crossed-swords icon, instead of round celebratory confetti.
  shapePath:
    'M12 2 L13 13 L16 14.5 L16 15.5 L13 15.5 L13 18.5 L12 20.5 L11 18.5 L11 15.5 L8 15.5 L8 14.5 L11 13 Z',
  // why: 1.7 makes the blade legible at burst size; the round-confetti default
  // (1) would render the sword as an unreadable speck.
  scalar: 1.7,
};
