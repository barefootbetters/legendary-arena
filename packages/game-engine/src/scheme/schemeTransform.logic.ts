/**
 * Scheme Transform logic (WP-670 / D-24484) — the third transform surface.
 *
 * Nine double-sided schemes across mdns / msmc / rvlt flip `[rule:Transforms]` into a
 * "Great Old One" alternate win condition once a per-scheme condition is met. Chthon
 * (Midnight Sons) is the worked example: the base scheme `ritual-sacrifice-to-summon-chthon`
 * flips into `great-old-one-chthon` once 5 Bystanders sit in the KO pile.
 *
 * Unlike masterminds (two faces in one `masterminds[]` entry), the base and flip faces are
 * SEPARATE prose-linked `schemes[]` entries, so this module carries a hardcoded allowlist +
 * pairing map. This first slice makes the flip OBSERVABLE (it swaps `G.scheme.gameText` to
 * the Great Old One's text, already projected to the client) and logs the awakening; the
 * scheme name/image swap, Chthon's destroy-the-current-player effect, and the Chthon-Wins
 * alternate win condition are honest-partial follow-ups.
 *
 * No boardgame.io imports. No .reduce() in the mutation path. Never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { SchemeState } from './schemeState.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import { pushLog } from '../log/logPush.js';

/** One transforming scheme's pairing: its Great Old One target + the flip threshold. */
interface SchemeTransformTarget {
  /** The Great Old One scheme id this scheme flips into. */
  readonly targetSchemeId: CardExtId;
  /** Number of Bystanders in the KO pile that triggers the flip. */
  readonly bystandersInKoToTransform: number;
}

// why: WP-670 / D-24484 — the base + Great Old One faces are separate `schemes[]` entries
// linked only by prose (no structured `transformOf` field), so the pairing is a hardcoded
// allowlist — the mastermind MASTERMIND_TRANSFORM_ALLOWLIST analog. The other eight Great
// Old One schemes (msmc / rvlt) and their triggers are named follow-ups; only Chthon is
// modeled this slice.
export const SCHEME_TRANSFORM_TARGETS: Readonly<Record<string, SchemeTransformTarget>> = {
  'mdns/ritual-sacrifice-to-summon-chthon': {
    targetSchemeId: 'mdns/great-old-one-chthon' as CardExtId,
    bystandersInKoToTransform: 5,
  },
};

/**
 * Flips a transforming scheme to its Great Old One face (WP-670 / D-24484).
 *
 * Sets `hasTransformed = true` and swaps `gameText` to the Great Old One's ability lines
 * (captured at setup into `transformTargetGameText`). Copy-then-override so every unrelated
 * field survives (the mastermind `transformMastermind` precedent).
 *
 * A scheme with no `transformTargetGameText` (every non-transform scheme, and a transform
 * scheme that already flipped) cannot flip, so this returns the input unchanged. Never
 * mutates the input; never throws.
 *
 * @param schemeState - Current scheme state.
 * @returns New SchemeState on the Great Old One face, or the input if it cannot flip.
 */
export function transformScheme(schemeState: SchemeState): SchemeState {
  // why: no captured target text (not an allowlisted transform scheme), or already flipped
  // → nothing to do.
  if (schemeState.transformTargetGameText === undefined || schemeState.hasTransformed === true) {
    return schemeState;
  }
  return {
    ...schemeState,
    hasTransformed: true,
    gameText: schemeState.transformTargetGameText,
  };
}

/**
 * Counts the Bystanders in the KO pile (WP-670 / D-24484).
 *
 * Uses the same Bystander predicate as the hero-condition reads: the shared
 * `BYSTANDER_EXT_ID` or a per-instance `bystander-villain-deck-*` id.
 *
 * @param ko - The KO pile (`G.ko`).
 * @returns How many of its cards are Bystanders.
 */
export function countBystandersInKo(ko: readonly CardExtId[]): number {
  let count = 0;
  for (const extId of ko) {
    // why: bystanders enter the KO pile by the shared placeholder id or a per-instance
    // villain-deck id; both are Bystanders for the Chthon flip count.
    if (extId === BYSTANDER_EXT_ID || extId.startsWith('bystander-villain-deck-')) {
      count++;
    }
  }
  return count;
}

/**
 * Per-move Scheme Transform check (WP-670 / D-24484) — called from `turn.onMove`.
 *
 * For a scheme in `SCHEME_TRANSFORM_TARGETS` that has not yet flipped, checks the flip
 * trigger (Chthon: ≥ 5 Bystanders in `G.ko`) and, when met, flips the scheme to its Great
 * Old One face (`transformScheme`) and logs that the Great Old One has awakened. A scheme
 * not in the map, or one already transformed, is an early no-op — so a non-transform game
 * (including the sentinel) reads and mutates nothing and stays byte-identical.
 *
 * HONEST-PARTIAL: the flip is observable (the Great Old One's rules text replaces the
 * scheme's, and the awakening is logged), but Chthon's destroy-the-current-player effect and
 * the Chthon-Wins alternate win condition are not modeled here.
 *
 * @param gameState - The game state; `gameState.scheme` is rebound on a flip.
 */
export function checkAndTransformScheme(gameState: LegendaryGameState): void {
  // why: defensive — a hook must never throw (architecture). Minimal test fixtures and
  // older snapshots may omit scheme / selection / ko; guard each read.
  const scheme = gameState.scheme;
  if (!scheme || !gameState.selection || !Array.isArray(gameState.ko)) {
    return;
  }
  // why: early no-op for a non-transform scheme (no captured target) or one already flipped —
  // the hot per-move path does no work and mutates nothing for the vast majority of games.
  if (scheme.transformTargetSchemeId === undefined || scheme.hasTransformed === true) {
    return;
  }
  const target = SCHEME_TRANSFORM_TARGETS[gameState.selection.schemeId];
  if (target === undefined) {
    return;
  }
  const bystandersInKo = countBystandersInKo(gameState.ko);
  if (bystandersInKo < target.bystandersInKoToTransform) {
    return;
  }
  gameState.scheme = transformScheme(scheme);
  // why: WP-434 — a realized flip is a `threat` line (the villain side just got much more
  // dangerous — the Scheme became a Great Old One). Loud and observable in the game log.
  pushLog(gameState,
    `The Great Old One awakens — ${target.bystandersInKoToTransform} Bystanders in the KO pile transform the Scheme into its Great Old One (its printed effect + win condition are not yet modeled).`,
    'threat',
  );
}
