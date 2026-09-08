/**
 * Scheme runtime state for the Legendary Arena game engine.
 *
 * SchemeState holds destination piles for resolved scheme cards.
 * Built at setup time; mutated only by revealVillainCard.
 */

import type { CardExtId } from '../state/zones.types.js';

/**
 * Runtime scheme state tracking resolved scheme-twist cards.
 *
 * Lives at G.scheme. Separate from G.schemeSetupInstructions which
 * stores the one-time setup instruction list (D-2601).
 */
export interface SchemeState {
  // why: append-only destination pile for resolved scheme-twist cards.
  // Order is chronological (insertion order); no reshuffle in MVP.
  /** Resolved scheme-twist cards — append-only, chronological. */
  twistPile: CardExtId[];

  // why: setup-time snapshot of the scheme card's abilities text from the
  // registry. Projected through UIState so the play surface can tell the
  // player what the scheme does and what happens on a Scheme Twist.
  // Optional on the G type so existing test fixtures compile without
  // modification; the builder always populates it.
  /** Scheme card ability text lines. Built at setup, read-only at runtime. */
  readonly gameText?: readonly string[];

  // why: WP-670 / D-24484 — Scheme Transform. Nine double-sided schemes flip
  // [rule:Transforms] into a "Great Old One" when a condition is met (Chthon: 5
  // Bystanders in the KO pile). The base + flip faces are SEPARATE prose-linked
  // schemes[] entries, so a hardcoded SCHEME_TRANSFORM_TARGETS map pairs them; for an
  // allowlisted scheme, setup records the flip target here so the runtime flip is a pure
  // state read.
  //
  // why: all three fields are OPTIONAL and populated ONLY for a scheme in the
  // SCHEME_TRANSFORM_TARGETS allowlist (the gameText? optional-field precedent), so a game
  // whose scheme does not transform — including the sentinel core/legacy-virus-the —
  // serializes byte-identically and NO state-hash oracle re-pins.
  /** The Great Old One scheme id this scheme flips into (transform schemes only). */
  transformTargetSchemeId?: CardExtId;
  /** The Great Old One's ability text lines — swapped into gameText on flip (transform schemes only). */
  transformTargetGameText?: readonly string[];
  /** Whether this scheme has already flipped to its Great Old One face (transform schemes only). */
  hasTransformed?: boolean;
}
