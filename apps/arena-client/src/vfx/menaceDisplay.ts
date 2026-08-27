/**
 * Danger Meter presentation derivation (WP-558 / D-24367).
 *
 * Pure functions turning WP-557's projected menace signal into the numbers and
 * class names the meter renders. No Vue import, so every rule here is testable
 * without mounting a component — the same split WP-556 used for
 * `comboVfxManifest.ts`.
 *
 * These functions compute PRESENTATION ONLY. They never resolve a loss
 * threshold and never re-band a tier: the D-24366 resolution order and the
 * MenaceTier boundaries are the engine's, and duplicating either here is the
 * exact drift WP-557 existed to remove.
 */

import type { MenaceTier, SchemeLossKind } from '@legendary-arena/game-engine';

/** The projected fields the meter consumes, straight off `UIState.progress`. */
export interface MenaceSignal {
  menace?: number;
  menaceTier?: MenaceTier;
  schemeLossProgress?: number;
  schemeLossThreshold?: number;
  schemeLossKind?: SchemeLossKind;
}

// why: WP-562 / D-24371 §3 — THIS is the file the engine's `schemeLossKind` enum
// exists to feed. Every player-facing noun for a loss condition lives here and
// nowhere in `packages/`: the engine reports which condition is being measured,
// the client decides what to call it. A label field in the engine would put copy
// behind the layer boundary and hand this file a string it must render blind.
const SCHEME_LOSS_NOUNS: Record<SchemeLossKind, string> = {
  'hero-deck': 'Heroes',
  'wound-stack': 'Wounds',
  'escaped-pile': 'Escaped',
  // why: WP-612 — a bystander-counting escaped-pile scheme (Midtown Bank Robbery)
  // tracks BYSTANDERS carried into the escaped pile, so it reads "Bystanders N/8",
  // not "Escaped" — which mislabels the quantity and collides with the separate
  // raw escaped-villain count shown by EscapedPile / the HUD.
  'escaped-bystander': 'Bystanders',
  'escaped-converted': 'Escaped',
  twists: 'Twists',
};

// why: the pre-WP-562 label, kept as the fallback for a state that projects no
// kind (an older fixture, a recorded replay). "Scheme" says only "this is the
// scheme's loss progress", which is the most a labelless signal supports.
const UNKNOWN_KIND_LABEL = 'Scheme';

/**
 * Converts the 0..1 menace scalar to a bar width percentage.
 *
 * @param menace - The projected 0..1 scalar.
 * @returns A percentage clamped to 0..100.
 */
export function menaceBarPercent(menace: number): number {
  // why: NaN and Infinity are handled as DIFFERENT cases, in this order. NaN
  // means "unknown" and reads as an empty bar; Infinity means "past the top"
  // and reads as full. Collapsing both through a single `Number.isFinite`
  // guard would render an over-scale value as an empty bar — the most
  // misleading possible output for a danger readout.
  if (Number.isNaN(menace)) return 0;
  if (menace <= 0) return 0;
  if (menace >= 1) return 100;
  return menace * 100;
}

/**
 * Maps a projected tier to its CSS modifier class.
 *
 * @param tier - The tier as projected by the engine.
 * @returns The modifier class name for that tier.
 */
export function menaceTierClass(tier: MenaceTier): string {
  // why: an explicit switch rather than a template string so a future
  // MenaceTier member fails to compile here instead of silently producing an
  // unstyled class name.
  switch (tier) {
    case 'calm':
      return 'danger-meter--calm';
    case 'rising':
      return 'danger-meter--rising';
    case 'critical':
      return 'danger-meter--critical';
  }
}

/**
 * Names the quantity the meter is counting, for the player.
 *
 * @param kind - The projected loss kind, when the state carries one.
 * @returns The noun to print beside the ratio.
 */
export function menaceKindLabel(kind: SchemeLossKind | undefined): string {
  if (kind === undefined) {
    return UNKNOWN_KIND_LABEL;
  }
  return SCHEME_LOSS_NOUNS[kind];
}

/**
 * Builds the progress readout label.
 *
 * @param progress - The condition-aware numerator.
 * @param threshold - The resolved denominator, when the scheme has one.
 * @returns `"3/8"` when a denominator exists, otherwise the bare count.
 */
export function menaceRatioLabel(
  progress: number,
  threshold: number | undefined,
): string {
  // why: D-24367 §4 — never invent a denominator. Post-WP-562 every scheme built
  // by the engine resolves its own (D-24371 §1), so this branch is reached only
  // by a state that predates the depletion capture; it shows the bare count
  // rather than defaulting to 8 or 7, which is the defect WP-558 removed.
  if (threshold === undefined) {
    return `${progress}`;
  }
  return `${progress}/${threshold}`;
}

/**
 * Builds the screen-reader description of the current danger level.
 *
 * @param tier - The projected tier.
 * @param progress - The condition-aware numerator.
 * @param threshold - The resolved denominator, when one exists.
 * @param kind - The projected loss kind, when the state carries one.
 * @returns A full-sentence description for `aria-label`.
 */
export function menaceAriaText(
  tier: MenaceTier,
  progress: number,
  threshold: number | undefined,
  kind: SchemeLossKind | undefined,
): string {
  const level = describeTier(tier);
  // why: WP-562 — a sighted player reads "Heroes 31/42" off the bar, so the
  // screen-reader text names the same quantity. Without the noun the audio
  // reading is "31 of 42 toward the scheme's goal", which is the one place the
  // two surfaces would describe the state differently.
  const noun = menaceKindLabel(kind).toLowerCase();
  if (threshold === undefined) {
    return `Scheme danger: ${level}. ${progress} ${noun} toward the scheme's goal.`;
  }
  return `Scheme danger: ${level}. ${progress} of ${threshold} ${noun} toward the scheme's goal.`;
}

/**
 * Renders a tier as the word a player hears read aloud.
 *
 * @param tier - The projected tier.
 * @returns A human phrase for that tier.
 */
function describeTier(tier: MenaceTier): string {
  switch (tier) {
    case 'calm':
      return 'low';
    case 'rising':
      return 'rising';
    case 'critical':
      return 'critical';
  }
}

/**
 * Reports whether the meter has a signal to render at all.
 *
 * @param signal - The projected menace fields.
 * @returns True only when both the scalar and the tier are present.
 */
export function hasMenaceSignal(
  signal: MenaceSignal,
): signal is MenaceSignal & { menace: number; menaceTier: MenaceTier } {
  // why: D-24367 §5 — an absent signal renders NOTHING rather than a
  // zero-width "safe" bar. A hand-written fixture or a recorded replay can
  // legitimately lack these fields, and an absent measurement is not a claim
  // that the players are safe. A false calm is worse than no meter.
  return signal.menace !== undefined && signal.menaceTier !== undefined;
}
