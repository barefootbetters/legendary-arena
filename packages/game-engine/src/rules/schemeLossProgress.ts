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
  remainingPileCount,
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

/**
 * What the active scheme's loss progress is actually counting.
 *
 * why (D-24371 §3): this is an ENUM, never a label. For a meter to read
 * "Heroes 11/42" for one scheme and "Escaped 4/12" for another, something must
 * know which noun applies — and a noun is presentation. The engine ships the
 * kind; every player-facing word lives client-side in `menaceDisplay.ts`. Do
 * NOT add a label/text field here: that would put copy in `packages/` and hand
 * the client a string it must render blind, which is the boundary D-24367 §2
 * exists to hold.
 */
export type SchemeLossKind =
  | 'hero-deck'
  | 'wound-stack'
  | 'escaped-pile'
  | 'escaped-converted'
  | 'twists';

/**
 * Canonical ordered list of SchemeLossKind values.
 *
 * Drift-checked against the `SchemeLossKind` union — never update one without
 * the other (`.claude/rules/code-style.md` §Drift Detection).
 */
export const SCHEME_LOSS_KINDS: readonly SchemeLossKind[] = [
  'hero-deck',
  'wound-stack',
  'escaped-pile',
  'escaped-converted',
  'twists',
];

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
 * Resolves the setup size of a scheme's depletion-loss pile, when it has one.
 *
 * Called once from `Game.setup()` with the two candidate pile sizes measured at
 * their build sites, so this module stays pure and setup keeps its single
 * authority over state construction.
 *
 * @param schemeId - The active scheme's ext_id.
 * @param heroDeckSetupSize - Total hero cards BUILT at setup (before the HQ fill).
 * @param woundStackSetupSize - Wound stack size at setup.
 * @returns The setup size of the depletion pile, or undefined when the scheme
 *   does not lose on one.
 */
export function resolveSchemeLossPileSetupSize(
  schemeId: string,
  heroDeckSetupSize: number,
  woundStackSetupSize: number,
): number | undefined {
  const config = SCHEME_TWIST_CONFIGS.get(schemeId);
  const condition = config?.resourceLossCondition;
  if (condition?.kind !== 'pile-depleted') {
    return undefined;
  }

  // why: an explicit switch (not dynamic indexing) mirrors remainingPileCount's
  // shape, so the setup size and the live remaining count are read through two
  // exhaustive maps over the same union — a new pile member fails to compile in
  // both places rather than silently resolving to undefined in one.
  switch (condition.pile) {
    case 'heroDeck':
      return heroDeckSetupSize;
    case 'wounds':
      return woundStackSetupSize;
  }
}

/**
 * Resolves the denominator of the active scheme's loss progress, when one exists.
 *
 * Follows the D-24371 §1 order: each condition supplies its own denominator —
 * a numeric-threshold resourceLossCondition its threshold, a `pile-depleted`
 * condition its captured setup size — and only a scheme declaring no condition
 * at all falls through to the D-24178 twist-threshold order.
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

  // why: D-24371 §1 supersedes D-24366 §5. That clause reasoned a 'pile-depleted'
  // scheme has no denominator because the pile's starting size "is not a scheme
  // constant" — conflating "not in the config" with "unknowable". It IS knowable,
  // at setup, and is captured there into G.schemeLossPileSetupSize. Falling back
  // to the twist proxy shipped a Super Hero Civil War meter reading 3/7 twists
  // while its printed Evil Wins ("If the Hero Deck runs out") sat at 11 cards.
  // A state built before WP-562 carries no capture; undefined then routes both
  // this and the numerator back to the twist proxy, which is the pre-WP-562
  // reading — a coherent legacy pair, not a new invented denominator.
  if (condition?.kind === 'pile-depleted') {
    // why: guarded through hasPileSetupSize — the SAME predicate the numerator
    // and the kind resolver use. Returning the raw field here would let a 0 or
    // absent capture split the three: a 0 denominator makes computeMenace read
    // 0 (a false calm) while the numerator has already fallen back to twists.
    return hasPileSetupSize(gameState) ? gameState.schemeLossPileSetupSize : undefined;
  }

  return resolveTwistLossThreshold(gameState);
}

/**
 * Resolves what the active scheme's loss progress is counting.
 *
 * Describes the MEASUREMENT, not the config: a `pile-depleted` scheme whose
 * setup size was never captured is measuring twists, and reports `'twists'` so
 * the client never labels a twist count "Heroes".
 *
 * @param gameState - The current game state (read-only).
 * @returns The kind of quantity `resolveSchemeLossProgress` is returning.
 */
export function resolveSchemeLossKind(
  gameState: LegendaryGameState,
): SchemeLossKind {
  const config = SCHEME_TWIST_CONFIGS.get(gameState.selection.schemeId);
  const condition = config?.resourceLossCondition;

  if (condition?.kind === 'escaped-pile-count') {
    return 'escaped-pile';
  }
  if (condition?.kind === 'escaped-converted-count') {
    return 'escaped-converted';
  }
  if (condition?.kind === 'pile-depleted' && hasPileSetupSize(gameState)) {
    return condition.pile === 'heroDeck' ? 'hero-deck' : 'wound-stack';
  }
  return 'twists';
}

/**
 * Reports whether the depletion-pile setup size was captured into this state.
 *
 * @param gameState - The current game state (read-only).
 * @returns True when a usable positive setup size is present.
 */
function hasPileSetupSize(gameState: LegendaryGameState): boolean {
  // why: a non-positive capture is treated as absent. A zero-sized pile is
  // already depleted at setup, so 0/0 expresses no progress — the honest
  // reading is to fall back to the twist proxy rather than divide by zero.
  const setupSize = gameState.schemeLossPileSetupSize;
  return setupSize !== undefined && setupSize > 0;
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

  // why: D-24371 §1 — a 'pile-depleted' scheme measures DEPLETION: how many
  // cards are gone from the pile, against the size it started at. remainingPileCount
  // is imported from schemeResourceLoss.ts — the same mapping applyPileDepletionResourceLoss
  // uses to decide the loss — so the meter and the rule that ends the game read
  // one pile map. Clamped at 0 because the hero deck can grow above its setup
  // size (cards returning from a discard) and a negative numerator would read as
  // the villains losing ground.
  if (condition?.kind === 'pile-depleted' && hasPileSetupSize(gameState)) {
    const setupSize = gameState.schemeLossPileSetupSize ?? 0;
    const depleted = setupSize - remainingPileCount(gameState, condition.pile);
    return depleted > 0 ? depleted : 0;
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
  // why: the fallback now applies ONLY to a state whose depletion capture is
  // absent (a pre-WP-562 recorded state). Every scheme built by this engine
  // resolves its own denominator, and resolveSchemeLossProgress takes the same
  // branch, so numerator and denominator always describe the same quantity.
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
