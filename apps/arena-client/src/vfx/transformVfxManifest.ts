/**
 * transformVfxManifest.ts
 *
 * The `transformResolved` transform beat's visual model (WP-672) — the juice
 * for a Hero base card powering up into its stronger second form (the signature
 * mechanic of the World War Hulk set), riding the WP-556 VFX foundation. When
 * the engine emits a `transformResolved` notable event, this manifest supplies
 * the gamma-green "power surge" burst palette and the constant call-out word.
 *
 * Thematically this is a hero swelling with gamma energy — the opposite register
 * from the red `mastermindStrikeResolved` "uh-oh" jolt and distinct from the
 * threat-coloured shield-block deflection. So it gets its own radioactive-green
 * palette rather than reusing any existing effect's colours.
 *
 * No visual bytes are committed — the burst is generated at runtime by
 * `canvas-confetti`; this module carries only the colour spec and the constant
 * word. Unlike `strikeBlockedVfxManifest` there is no per-variant `Record`: a
 * transform has no sub-kind, so a single spec suffices (the composable emits a
 * plain seq, not a discriminator).
 *
 * @see WP-672 §B "the manifest"
 * @see apps/arena-client/src/vfx/strikeBlockedVfxManifest.ts — the manifest precedent
 * @see DECISIONS.md D-24487 (the transformResolved event + the transform VFX beat) + D-24365 (the VFX determinism exemption)
 */

/** The single burst spec for the transform beat: the gamma-green surge colours. */
export interface TransformVfxSpec {
  /** Non-empty gamma-green palette for the power-surge burst. */
  readonly colors: readonly string[];
}

/** The constant call-out word for every transform beat. */
export const TRANSFORM_WORD = 'TRANSFORMED!';

/**
 * The transform beat's gamma-green power-surge burst palette — a radioactive
 * green core through a bright lime to a near-white edge. Distinct from every
 * other effect's colours (Master Strike red, shield-block threat colours, wound
 * dull-red, combo default multicolor) so a transform reads as its own moment.
 */
export const TRANSFORM_VFX: TransformVfxSpec = {
  colors: ['#5ee66b', '#a6ff7a', '#eaffd0'],
};
