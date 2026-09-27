/**
 * Scheme loss-progress resolution — the shared "how close is evil to winning"
 * derivation for the Legendary Arena game engine.
 *
 * Owns one copy of the rule that decides how far along a scheme's Evil-Wins
 * condition the match is: the D-24178 twist-threshold resolution order (with the
 * D-24595 last-twist-in-the-deck fallback), the D-24315 resourceLossCondition
 * suppression (and the D-24595 compound exception), the condition-aware
 * numerator, and the normalized `menace` scalar + `MenaceTier` band those feed
 * (D-24366).
 *
 * The twist dispatcher (`schemeHandlers.ts`) and the UIState menace projection
 * (`ui/uiState.build.ts`) both call into here rather than each carrying their own
 * copy — two copies of a loss rule is the drift this module exists to prevent.
 *
 * Pure: reads `gameState` and mutates nothing. No boardgame.io import. No
 * registry import. No `.reduce()`.
 */

import type { ConvertedVillainOrigin, LegendaryGameState } from '../types.js';
import type { SchemeLossPile } from './schemeTwistConfig.types.js';
import { SCHEME_TWIST_CONFIGS } from './schemeTwistConfigs.js';
import {
  countEscapedPileByType,
  countEscapedByConvertedOrigin,
  listConditionPiles,
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
 *
 * why (D-24595): `'twists-fallback'` is distinct from `'twists'` because the
 * meter must tell players when the condition is APPROXIMATE — the last-twist
 * stand-in for a printed condition the engine does not model yet — rather than
 * a printed "Twist N: Evil Wins".
 */
export type SchemeLossKind =
  | 'hero-deck'
  | 'wound-stack'
  | 'villain-deck'
  | 'escaped-pile'
  | 'escaped-bystander'
  | 'escaped-killbot'
  | 'escaped-skrull'
  | 'twists'
  | 'twists-fallback';

/**
 * Canonical ordered list of SchemeLossKind values.
 *
 * Drift-checked against the `SchemeLossKind` union — never update one without
 * the other (`.claude/rules/code-style.md` §Drift Detection).
 */
export const SCHEME_LOSS_KINDS: readonly SchemeLossKind[] = [
  'hero-deck',
  'wound-stack',
  'villain-deck',
  'escaped-pile',
  'escaped-bystander',
  'escaped-killbot',
  'escaped-skrull',
  'twists',
  'twists-fallback',
];

// why: operator decision 2026-09-25 (D-24595) — a scheme with no printed-count
// config (and the twist half of a compound scheme) loses when the LAST Scheme
// Twist in its Villain Deck is revealed. The flat 7 this replaces
// (MVP_SCHEME_TWIST_THRESHOLD) caused false twist-7 losses on 144 schemes and
// left 25 low-twist schemes unable to lose. The count is DERIVED at read time
// from G.villainDeckCardTypes (no G field); this default applies only when that
// count is 0 — a test mock, or a scheme missing from the registry — and mirrors
// SCHEME_TWIST_COUNT in villainDeck.setup.ts, the setup default for a scheme
// that omits villainDeckTwistCount.
export const DEFAULT_SCHEME_TWIST_COUNT = 8;

// why: D-24366 §3 — the tier boundaries are half-open on the lower bound, so a
// menace of exactly 0.34 is `rising` and exactly 0.67 is `critical`. Locked as
// named constants rather than inline literals because both this module's tests
// and every future consumer pin these exact numbers.
const RISING_TIER_FLOOR = 0.34;
const CRITICAL_TIER_FLOOR = 0.67;

/**
 * One loss condition the active scheme is measured against, as a coherent
 * numerator / denominator / kind triple.
 */
export interface ActiveLossCondition {
  /** What the progress counts — the enum the client labels from. */
  kind: SchemeLossKind;
  /** The numerator: progress toward the loss. */
  progress: number;
  /** The denominator: the progress at which the scheme is lost. */
  threshold: number;
  /**
   * False only for the legacy twist proxy of a pile-depleted scheme whose setup
   * size was never captured (a pre-WP-562 recorded state); the projection then
   * omits `schemeLossThreshold`, as it always has for that state.
   */
  isThresholdReported: boolean;
}

/**
 * Counts the Scheme Twists shuffled into the Villain Deck at setup.
 *
 * why (WP-763 Assumes 1a): G.villainDeckCardTypes is written with
 * 'scheme-twist' only at setup (villainDeck.setup.ts), one uniquely-suffixed key
 * per twist copy; the one runtime write (schemeTwistResolvers.ts, Secret
 * Invasion) writes 'villain' for a Hero. So counting 'scheme-twist' values gives
 * the setup twist count at any point in the match, with no new G field.
 *
 * @param gameState - The current game state (read-only).
 * @returns The number of scheme-twist cards built into the Villain Deck.
 */
function countSetupSchemeTwists(gameState: LegendaryGameState): number {
  let twistCount = 0;
  for (const cardType of Object.values(gameState.villainDeckCardTypes)) {
    if (cardType === 'scheme-twist') {
      twistCount = twistCount + 1;
    }
  }
  return twistCount;
}

/**
 * Resolves the configured (printed) twist threshold, when the scheme has one.
 *
 * @param gameState - The current game state (read-only).
 * @returns The per-player-count or scalar threshold, or undefined.
 */
function resolveConfiguredTwistThreshold(
  gameState: LegendaryGameState,
): number | undefined {
  const config = SCHEME_TWIST_CONFIGS.get(gameState.selection.schemeId);
  const playerCountThreshold =
    config?.lossThresholdByPlayerCount?.[String(gameState.lobby.requiredPlayers)];
  return playerCountThreshold ?? config?.lossThreshold;
}

/**
 * Resolves the twist-count threshold at which the doom-clock proxy loss fires.
 *
 * @param gameState - The current game state (read-only).
 * @returns The effective twist threshold for the active scheme.
 */
export function resolveTwistLossThreshold(gameState: LegendaryGameState): number {
  // why: resolve the twist-loss threshold in priority order (D-24178 / D-24595):
  //   1. a per-player-count override (schemes whose printed stack varies by
  //      seat count, e.g. Super Hero Civil War: 8 at 2-3p, 5 at 4-5p) —
  //      keyed by the seat count frozen at setup (G.lobby.requiredPlayers ===
  //      ctx.numPlayers, buildInitialGameState.ts);
  //   2. the scalar lossThreshold (a printed "Twist N: Evil Wins", or a core
  //      resource scheme's twist-stack size);
  //   3. the D-24595 fallback — the last twist in the scheme's Villain Deck.
  // Every core scheme sets rung 1 or 2, so rung 3 never moves a core threshold.
  const configuredThreshold = resolveConfiguredTwistThreshold(gameState);
  if (configuredThreshold !== undefined) {
    return configuredThreshold;
  }
  const setupTwistCount = countSetupSchemeTwists(gameState);
  if (setupTwistCount > 0) {
    return setupTwistCount;
  }
  return DEFAULT_SCHEME_TWIST_COUNT;
}

/**
 * Reports whether the active scheme suppresses the twist-count doom-clock proxy.
 *
 * @param gameState - The current game state (read-only).
 * @returns True when the scheme declares a real resourceLossCondition and does
 *   not opt back into the twist fallback.
 */
export function isTwistLossSuppressed(gameState: LegendaryGameState): boolean {
  // why: D-24315 — when the active scheme declares a real resourceLossCondition,
  // its loss is governed by that condition (the escape path, or the per-move pile
  // check), so the twist-count doom-clock proxy must not also fire. D-24595: a
  // compound scheme (twistFallbackWithResourceLoss) keeps the proxy for its
  // unmodelled half, alongside the condition.
  const config = SCHEME_TWIST_CONFIGS.get(gameState.selection.schemeId);
  if (config?.resourceLossCondition == null) {
    return false;
  }
  return config.twistFallbackWithResourceLoss !== true;
}

/**
 * Resolves the setup size of a scheme's hero-deck / wound-stack depletion pile.
 *
 * Called once from `Game.setup()` with the two candidate pile sizes measured at
 * their build sites, so this module stays pure and setup keeps its single
 * authority over state construction. The Villain Deck is sized separately by
 * `resolveSchemeLossVillainDeckSetupSize` (D-24595), so this field — and the
 * sentinel hash that depends on it — is unchanged.
 *
 * @param schemeId - The active scheme's ext_id.
 * @param heroDeckSetupSize - Total hero cards BUILT at setup (before the HQ fill).
 * @param woundStackSetupSize - Wound stack size at setup.
 * @returns The setup size of the depletion pile, or undefined when the scheme
 *   does not lose on the hero deck or the wound stack.
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
  // both places rather than silently resolving to undefined in one. The first
  // hero-deck / wound-stack pile named wins; no configured scheme names both
  // (pinned in schemeTwistConfigs.test.ts).
  for (const pile of listConditionPiles(condition)) {
    switch (pile) {
      case 'heroDeck':
        return heroDeckSetupSize;
      case 'wounds':
        return woundStackSetupSize;
      case 'villainDeck':
        break;
    }
  }
  return undefined;
}

/**
 * Resolves the setup size of the Villain Deck, when the scheme loses on it.
 *
 * @param schemeId - The active scheme's ext_id.
 * @param villainDeckSetupSize - The Villain Deck's card count at setup.
 * @returns The setup size, or undefined when no condition names the Villain Deck.
 */
export function resolveSchemeLossVillainDeckSetupSize(
  schemeId: string,
  villainDeckSetupSize: number,
): number | undefined {
  const config = SCHEME_TWIST_CONFIGS.get(schemeId);
  const condition = config?.resourceLossCondition;
  if (condition?.kind !== 'pile-depleted') {
    return undefined;
  }
  if (!listConditionPiles(condition).includes('villainDeck')) {
    return undefined;
  }
  return villainDeckSetupSize;
}

/**
 * Reads the captured setup size of one depletion pile.
 *
 * @param gameState - The current game state (read-only).
 * @param pile - The pile to read.
 * @returns The captured setup size, or undefined when absent or non-positive.
 */
function readPileSetupSize(
  gameState: LegendaryGameState,
  pile: SchemeLossPile,
): number | undefined {
  let setupSize: number | undefined;
  switch (pile) {
    case 'heroDeck':
    case 'wounds':
      setupSize = gameState.schemeLossPileSetupSize;
      break;
    case 'villainDeck':
      setupSize = gameState.schemeLossVillainDeckSetupSize;
      break;
  }
  // why: a non-positive capture is treated as absent. A zero-sized pile is
  // already depleted at setup, so 0/0 expresses no progress — the honest
  // reading is to fall back to the twist proxy rather than divide by zero.
  if (setupSize === undefined || setupSize <= 0) {
    return undefined;
  }
  return setupSize;
}

/**
 * Maps a depletion pile to its scheme-loss kind.
 *
 * @param pile - The depletion pile.
 * @returns The kind the client labels that pile's meter from.
 */
function pileLossKind(pile: SchemeLossPile): SchemeLossKind {
  // why: an exhaustive switch, not a ternary — the two-way ternary this replaces
  // would have labelled a Villain Deck meter "Wounds" (EC-800 failure smell).
  switch (pile) {
    case 'heroDeck':
      return 'hero-deck';
    case 'wounds':
      return 'wound-stack';
    case 'villainDeck':
      return 'villain-deck';
  }
}

/**
 * Maps a converted-villain origin to its scheme-loss kind (WP-623). An explicit
 * switch, so a future `ConvertedVillainOrigin` fails to compile here rather than
 * silently mislabelling the danger meter as the wrong enemy.
 *
 * @param origin - The converted-villain origin the scheme counts against its loss.
 * @returns The origin-specific scheme-loss kind the client labels from.
 */
function escapedConvertedKind(origin: ConvertedVillainOrigin): SchemeLossKind {
  switch (origin) {
    case 'killbot':
      return 'escaped-killbot';
    case 'skrull':
      return 'escaped-skrull';
  }
}

/**
 * Builds the loss conditions the active scheme's resourceLossCondition measures.
 *
 * @param gameState - The current game state (read-only).
 * @returns Zero or more measurable resource conditions, in declaration order.
 */
function collectResourceConditions(
  gameState: LegendaryGameState,
): ActiveLossCondition[] {
  const config = SCHEME_TWIST_CONFIGS.get(gameState.selection.schemeId);
  const condition = config?.resourceLossCondition;
  const conditions: ActiveLossCondition[] = [];
  if (condition === undefined) {
    return conditions;
  }

  // why: reuses the exported counters from schemeResourceLoss.ts — the same
  // functions applyEscapedPileResourceLoss uses to decide the loss — rather than
  // re-counting the escaped pile here. A second counting copy would be free to
  // drift from the one that actually ends the game.
  if (condition.kind === 'escaped-pile-count') {
    // why: WP-612 / D-24423 — a bystander-counting escaped-pile scheme (Midtown
    // Bank Robbery) tracks BYSTANDERS carried into the escaped pile, so it gets
    // its own kind; a villain-counting one (Negative Zone) stays 'escaped-pile'.
    let kind: SchemeLossKind = 'escaped-pile';
    if (condition.cardTypes.includes('bystander')) {
      kind = 'escaped-bystander';
    }
    conditions.push({
      kind,
      progress: countEscapedPileByType(gameState, condition.cardTypes),
      threshold: condition.threshold,
      isThresholdReported: true,
    });
    return conditions;
  }
  if (condition.kind === 'escaped-converted-count') {
    // why: WP-623 / D-24434 — name the converted origin so the meter reads
    // "Killbots N/5" / "Skrulls N/5", not the generic "Escaped".
    conditions.push({
      kind: escapedConvertedKind(condition.origin),
      progress: countEscapedByConvertedOrigin(gameState, condition.origin),
      threshold: condition.threshold,
      isThresholdReported: true,
    });
    return conditions;
  }

  // why: D-24371 §1 — a 'pile-depleted' scheme measures DEPLETION: how many
  // cards are gone from the pile, against the size it started at. The remaining
  // count comes from remainingPileCount — the same mapping
  // applyPileDepletionResourceLoss uses to decide the loss. Clamped at 0 because a
  // pile can grow above its setup size (cards returning) and a negative numerator
  // would read as the villains losing ground. A pile whose setup size was never
  // captured (a pre-WP-562 state) is not measurable and is skipped.
  for (const pile of listConditionPiles(condition)) {
    const setupSize = readPileSetupSize(gameState, pile);
    if (setupSize === undefined) {
      continue;
    }
    const depleted = setupSize - remainingPileCount(gameState, pile);
    conditions.push({
      kind: pileLossKind(pile),
      progress: depleted > 0 ? depleted : 0,
      threshold: setupSize,
      isThresholdReported: true,
    });
  }
  return conditions;
}

/**
 * Normalises a condition's progress for the max-progress comparison.
 *
 * @param condition - A loss condition.
 * @returns progress / threshold, or 0 for a non-positive threshold.
 */
function normalisedProgress(condition: ActiveLossCondition): number {
  if (condition.threshold <= 0) {
    return 0;
  }
  return condition.progress / condition.threshold;
}

/**
 * Selects the loss condition the danger meter reports for the active scheme.
 *
 * The ONE place kind, threshold and progress are decided together, so
 * `computeMenace` and the projected fields can never pair one condition's
 * numerator with another's denominator (EC-800 failure smell).
 *
 * @param gameState - The current game state (read-only).
 * @returns The active loss condition.
 */
export function selectActiveLossCondition(
  gameState: LegendaryGameState,
): ActiveLossCondition {
  const candidates = collectResourceConditions(gameState);
  const configuredThreshold = resolveConfiguredTwistThreshold(gameState);

  // why: the twist numerator reads G.counters.schemeTwistCount, NOT
  // G.scheme.twistPile.length. The counter is the value buildGenericTwistEffects
  // compares against the threshold, so it is the one the loss actually turns on.
  // why (D-24595): kind 'twists' only for a configured (printed) threshold; the
  // last-twist fallback reports 'twists-fallback' so the meter can tell players
  // the condition is approximate.
  let twistKind: SchemeLossKind = 'twists';
  if (configuredThreshold === undefined) {
    twistKind = 'twists-fallback';
  }
  const twistCondition: ActiveLossCondition = {
    kind: twistKind,
    progress: gameState.counters.schemeTwistCount ?? 0,
    threshold: resolveTwistLossThreshold(gameState),
    isThresholdReported: true,
  };

  if (!isTwistLossSuppressed(gameState)) {
    candidates.push(twistCondition);
  }

  // why: D-24371 §1 legacy pair — a suppressed scheme with nothing measurable
  // (a pile-depleted scheme whose setup size predates the WP-562 capture) reads
  // the twist proxy for BOTH numerator and denominator, and omits the reported
  // threshold exactly as it did before.
  const firstCandidate = candidates[0];
  if (firstCandidate === undefined) {
    return { ...twistCondition, isThresholdReported: false };
  }

  // why: D-24595 — a multi-pile or compound scheme loses on whichever condition
  // gets there first, so the meter reports the one with the HIGHEST normalised
  // progress. Strictly greater wins and resource conditions come first, so a tie
  // goes to the pile condition (the modelled one) over the approximate twists.
  let selected = firstCandidate;
  for (const candidate of candidates) {
    if (normalisedProgress(candidate) > normalisedProgress(selected)) {
      selected = candidate;
    }
  }
  return selected;
}

/**
 * Resolves the denominator of the active scheme's loss progress, when one exists.
 *
 * @param gameState - The current game state (read-only).
 * @returns The loss denominator, or undefined for a legacy uncaptured pile state.
 */
export function resolveSchemeLossThreshold(
  gameState: LegendaryGameState,
): number | undefined {
  const active = selectActiveLossCondition(gameState);
  if (!active.isThresholdReported) {
    return undefined;
  }
  return active.threshold;
}

/**
 * Resolves what the active scheme's loss progress is counting.
 *
 * Describes the MEASUREMENT, not the config: a `pile-depleted` scheme whose
 * setup size was never captured is measuring twists, and reports a twist kind
 * so the client never labels a twist count "Heroes".
 *
 * @param gameState - The current game state (read-only).
 * @returns The kind of quantity `resolveSchemeLossProgress` is returning.
 */
export function resolveSchemeLossKind(
  gameState: LegendaryGameState,
): SchemeLossKind {
  return selectActiveLossCondition(gameState).kind;
}

/**
 * Resolves the numerator of the active scheme's loss progress.
 *
 * @param gameState - The current game state (read-only).
 * @returns The current progress toward the scheme's loss condition.
 */
export function resolveSchemeLossProgress(gameState: LegendaryGameState): number {
  return selectActiveLossCondition(gameState).progress;
}

/**
 * Computes the normalized 0..1 progress toward the active scheme's Evil-Wins.
 *
 * @param gameState - The current game state (read-only).
 * @returns A clamped 0..1 scalar; 0 when no usable denominator exists.
 */
export function computeMenace(gameState: LegendaryGameState): number {
  const active = selectActiveLossCondition(gameState);

  // why: guards divide-by-zero and negative configuration. A non-positive
  // denominator cannot express progress, so the honest reading is 0 rather than
  // Infinity or NaN — this projection feeds a meter and a music channel, and a
  // NaN there would render as a broken UI rather than a safe calm state.
  if (active.threshold <= 0) {
    return 0;
  }

  const rawProgress = active.progress / active.threshold;
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
