/**
 * Scheme loss-progress resolution — the shared "how close is evil to winning"
 * derivation for the Legendary Arena game engine.
 *
 * Owns one copy of the rule that decides how far along a scheme's Evil-Wins
 * condition the match is: the D-24178 twist-threshold resolution order, the
 * D-24315 resourceLossCondition suppression, the condition-aware numerator, and
 * the normalized `menace` scalar + `MenaceTier` band those feed (D-24366).
 *
 * The twist dispatcher (`schemeHandlers.ts`) and the UIState menace projection
 * (`ui/uiState.build.ts`) both call into here rather than each carrying their own
 * copy — two copies of a loss rule is the drift this module exists to prevent.
 *
 * Pure: reads `gameState` and mutates nothing. No boardgame.io import. No
 * registry import. No `.reduce()`.
 */

import type { LegendaryGameState } from '../types.js';
import { SCHEME_TWIST_CONFIGS } from './schemeTwistConfigs.js';
import {
  countEscapedPileByType,
  countEscapedByConvertedOrigin,
} from './schemeResourceLoss.js';

/**
 * How close the villains are to winning, as a coarse band.
 *
 * A shared contract (D-24366 §3): the boundaries are locked once here and
 * inherited by every consumer, so a visual danger meter and an adaptive score
 * can never disagree about what "critical" means.
 */
export type MenaceTier = 'calm' | 'rising' | 'critical';

/**
 * Canonical ordered list of MenaceTier values, ascending in severity.
 *
 * Drift-checked against the `MenaceTier` union — never update one without the
 * other (`.claude/rules/code-style.md` §Drift Detection).
 */
export const MENACE_TIERS: readonly MenaceTier[] = ['calm', 'rising', 'critical'];

// why: fallback threshold ONLY — used when a scheme has no config or no
// lossThreshold override. It is deliberately arbitrary (7): a scheme's real
// twist-stack size comes from its SchemeTwistConfig.lossThreshold /
// lossThresholdByPlayerCount (D-24178). Do NOT read this as "most schemes lose at
// 7" — most core schemes have an 8-twist stack. Unconfigured schemes fall here
// until they gain a config.
export const MVP_SCHEME_TWIST_THRESHOLD = 7;

// why: D-24366 §3 — the tier boundaries are half-open on the lower bound, so a
// menace of exactly 0.34 is `rising` and exactly 0.67 is `critical`. Locked as
// named constants rather than inline literals because both this module's tests
// and every future consumer pin these exact numbers.
const RISING_TIER_FLOOR = 0.34;
const CRITICAL_TIER_FLOOR = 0.67;

/**
 * Resolves the twist-count threshold at which the doom-clock proxy loss fires.
 *
 * @param gameState - The current game state (read-only).
 * @returns The effective twist threshold for the active scheme.
 */
export function resolveTwistLossThreshold(gameState: LegendaryGameState): number {
  const config = SCHEME_TWIST_CONFIGS.get(gameState.selection.schemeId);

  // why: resolve the twist-loss threshold in priority order (D-24178):
  //   1. a per-player-count override (schemes whose printed stack varies by
  //      seat count, e.g. Super Hero Civil War: 8 at 2-3p, 5 at 4-5p) —
  //      keyed by the seat count frozen at setup (G.lobby.requiredPlayers ===
  //      ctx.numPlayers, buildInitialGameState.ts);
  //   2. the scalar lossThreshold (a fixed twist-stack size);
  //   3. the arbitrary MVP fallback (unconfigured schemes only).
  // The threshold is the scheme's twist-stack size, so a scheme never resolves a
  // twist early. NOTE: only twist-loss schemes (printed "Twist N: Evil Wins!" —
  // Portals, Cosmic Cube) truly lose at this count; the resource-loss schemes
  // use it as a doom-clock proxy until their real conditions are modeled.
  const playerCountThreshold =
    config?.lossThresholdByPlayerCount?.[String(gameState.lobby.requiredPlayers)];
  return playerCountThreshold ?? config?.lossThreshold ?? MVP_SCHEME_TWIST_THRESHOLD;
}

/**
 * Reports whether the active scheme suppresses the twist-count doom-clock proxy.
 *
 * @param gameState - The current game state (read-only).
 * @returns True when the scheme declares a real resourceLossCondition.
 */
export function isTwistLossSuppressed(gameState: LegendaryGameState): boolean {
  // why: D-24315 — when the active scheme declares a real resourceLossCondition,
  // its loss is governed by that condition (evaluated in the escape path via
  // applyEscapedPileResourceLoss), so the twist-count doom-clock proxy must not
  // also fire.
  const config = SCHEME_TWIST_CONFIGS.get(gameState.selection.schemeId);
  return config?.resourceLossCondition != null;
}

/**
 * Resolves the denominator of the active scheme's loss progress, when one exists.
 *
 * Follows the D-24366 §1 order: a resourceLossCondition carrying a numeric
 * threshold wins outright (D-24315 suppresses the twist proxy for such schemes),
 * otherwise the D-24178 twist-threshold order applies.
 *
 * @param gameState - The current game state (read-only).
 * @returns The loss denominator, or undefined when the scheme has none.
 */
export function resolveSchemeLossThreshold(
  gameState: LegendaryGameState,
): number | undefined {
  const config = SCHEME_TWIST_CONFIGS.get(gameState.selection.schemeId);
  const condition = config?.resourceLossCondition;

  if (
    condition?.kind === 'escaped-pile-count' ||
    condition?.kind === 'escaped-converted-count'
  ) {
    return condition.threshold;
  }

  // why: D-24366 §5 — a 'pile-depleted' scheme (Super Hero Civil War's heroDeck,
  // Legacy Virus's wounds) has NO fixed denominator. Its loss is "the pile
  // reached zero", and the pile's starting size is a function of player count and
  // setup, not a scheme constant. Reporting a denominator here would be inventing
  // one, so the field is omitted and menace falls back to the twist proxy below.
  if (condition?.kind === 'pile-depleted') {
    return undefined;
  }

  return resolveTwistLossThreshold(gameState);
}

/**
 * Resolves the numerator of the active scheme's loss progress.
 *
 * Condition-aware: a resourceLossCondition scheme counts the resource its own
 * Evil-Wins condition counts; every other scheme counts resolved twists.
 *
 * @param gameState - The current game state (read-only).
 * @returns The current progress toward the scheme's loss condition.
 */
export function resolveSchemeLossProgress(gameState: LegendaryGameState): number {
  const config = SCHEME_TWIST_CONFIGS.get(gameState.selection.schemeId);
  const condition = config?.resourceLossCondition;

  // why: reuses the exported counters from schemeResourceLoss.ts — the same
  // functions applyEscapedPileResourceLoss uses to decide the loss — rather than
  // re-counting the escaped pile here. A second counting copy would be free to
  // drift from the one that actually ends the game.
  if (condition?.kind === 'escaped-pile-count') {
    return countEscapedPileByType(gameState, condition.cardType);
  }
  if (condition?.kind === 'escaped-converted-count') {
    return countEscapedByConvertedOrigin(gameState, condition.origin);
  }

  // why: the twist numerator reads G.counters.schemeTwistCount, NOT
  // G.scheme.twistPile.length. The counter is the value buildGenericTwistEffects
  // compares against the threshold, so it is the one the loss actually turns on;
  // the twist pile is a zone whose length can differ mid-resolution. Menace must
  // track the loss-bearing value or it would report progress the rules disagree
  // with.
  return gameState.counters.schemeTwistCount ?? 0;
}

/**
 * Computes the normalized 0..1 progress toward the active scheme's Evil-Wins.
 *
 * @param gameState - The current game state (read-only).
 * @returns A clamped 0..1 scalar; 0 when no usable denominator exists.
 */
export function computeMenace(gameState: LegendaryGameState): number {
  // why: a 'pile-depleted' scheme projects no threshold (above), but still needs
  // a denominator to produce a meter reading — it falls back to the D-24178 twist
  // proxy, which is the doom clock those schemes already run on.
  const denominator =
    resolveSchemeLossThreshold(gameState) ?? resolveTwistLossThreshold(gameState);

  // why: guards divide-by-zero and negative configuration. A non-positive
  // denominator cannot express progress, so the honest reading is 0 rather than
  // Infinity or NaN — this projection feeds a meter and a music channel, and a
  // NaN there would render as a broken UI rather than a safe calm state.
  if (denominator <= 0) {
    return 0;
  }

  const rawProgress = resolveSchemeLossProgress(gameState) / denominator;
  if (rawProgress <= 0) {
    return 0;
  }
  if (rawProgress >= 1) {
    return 1;
  }
  return rawProgress;
}

/**
 * Maps a normalized menace scalar to its coarse tier band.
 *
 * @param menace - A 0..1 menace scalar (values outside the range are clamped by
 *   the band comparisons themselves).
 * @returns The MenaceTier for that scalar.
 */
export function menaceTierFor(menace: number): MenaceTier {
  if (menace >= CRITICAL_TIER_FLOOR) {
    return 'critical';
  }
  if (menace >= RISING_TIER_FLOOR) {
    return 'rising';
  }
  return 'calm';
}
