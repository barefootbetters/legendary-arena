/**
 * Worked-calculation presentation for the competitive score (WP-584 / D-24393).
 *
 * Pure functions turning the server-returned `CompetitiveScoreBreakdown` into the
 * strings the endgame screen shows as a "worked solution" — a symbolic formula
 * line, the same formula with values substituted, the products, and the result;
 * then Final = Raw − PAR. No Vue import, so every rule is testable without
 * mounting a component (the split `vfx/menaceDisplay.ts` and `vfx/gradeDisplay.ts`
 * use).
 *
 * why (D-24393): the per-term weights shown in the formula are DERIVED from the
 * breakdown itself (product ÷ count), never hardcoded client-side — so the shown
 * formula can never drift from the engine's real weights. All values are rendered
 * VERBATIM from the breakdown (never recomputed). Numbers are the raw centesimal
 * integers the rest of the panel already shows (no ÷100 — operator choice).
 */

import type { CompetitiveScoreBreakdown } from '../lib/api/competitionApi';

// why: the true minus sign (U+2212), matching the rest of the endgame panel, so
// the arithmetic reads cleanly rather than with a hyphen.
const MINUS = '−';

// why: WP-587 — the substituted penalty term names the penalty ("7 scheme twists"),
// not a bare "(7 × 300)", per the operator ("just say 7 scheme twists, not 7
// penalties"). Singular/plural so "1 villain escaped" reads correctly.
const PENALTY_LABELS: Record<
  'villainEscaped' | 'bystanderLost' | 'schemeTwistNegative' | 'mastermindTacticUntaken' | 'scenarioSpecificPenalty',
  { readonly one: string; readonly many: string }
> = {
  villainEscaped: { one: 'villain escaped', many: 'villains escaped' },
  bystanderLost: { one: 'bystander lost', many: 'bystanders lost' },
  schemeTwistNegative: { one: 'scheme twist', many: 'scheme twists' },
  mastermindTacticUntaken: { one: 'tactic untaken', many: 'tactics untaken' },
  scenarioSpecificPenalty: { one: 'scenario penalty', many: 'scenario penalties' },
};

/** The PAR-derivation strings the endgame screen shows below the raw score. */
export interface ParDerivation {
  /** Symbolic formula, e.g. "(Escapes × 100) − (Bystanders × 200) − (VP × 10)". */
  readonly formula: string;
  /** The formula with baseline counts substituted, e.g. "(1 × 100) − (5 × 200) − (25 × 10)". */
  readonly substituted: string;
  /** The scenario baseline counts, for the "expected" givens row. */
  readonly baseline: {
    readonly escapes: number;
    readonly bystanders: number;
    readonly victoryPoints: number;
  };
}

/** The worked-calculation strings + values the endgame screen renders. */
export interface WorkedScoreCalc {
  /** "What happened" inputs, in display order. */
  readonly givens: ReadonlyArray<{ readonly label: string; readonly value: number }>;
  /** Symbolic formula, e.g. "Penalties − (Bystanders × 200) − (VP × 10)". */
  readonly formula: string;
  /** The same formula with match values substituted, e.g. "(6 scheme twists × 300) − (11 × 200) − (103 × 10)". */
  readonly substituted: string;
  /** The weighted products summed, e.g. "1800 − 2200 − 1030". */
  readonly products: string;
  /** Raw score (verbatim from the breakdown). */
  readonly rawScore: number;
  /** PAR score (verbatim). */
  readonly parScore: number;
  /**
   * Per-player split of the raw-score reward terms (WP-588): each player's own
   * victory points and rescued bystanders, summing to the team totals. Absent
   * when the breakdown carries no per-player data (records predating WP-588).
   */
  readonly perPlayer?: ReadonlyArray<{
    readonly label: string;
    readonly victoryPoints: number;
    readonly bystandersRescued: number;
  }> | undefined;
  /**
   * How PAR was derived from the scenario baseline (WP-587). Absent when the
   * breakdown carries no `parBaseline` (records persisted before WP-587) — the
   * screen then shows just the PAR value, not its derivation. Explicit `undefined`
   * in the union so `buildWorkedScoreCalc` may set it from a maybe-undefined value
   * under `exactOptionalPropertyTypes`.
   */
  readonly parDerivation?: ParDerivation | undefined;
  /** "Raw − PAR" with values substituted, e.g. "20 − (−300)". */
  readonly finalSubstituted: string;
  /** Final score (verbatim). */
  readonly finalScore: number;
}

/**
 * Derives the per-unit weight actually used, or null when it cannot be read from
 * the data (a zero count). Returns null rather than guessing, so the display
 * never shows a weight that wasn't part of the real computation.
 */
function perUnitWeight(product: number, count: number): number | null {
  if (count > 0 && product % count === 0) {
    return product / count;
  }
  return null;
}

/**
 * Formats one reward/cost term for the symbolic formula line.
 * `(Label × weight)` when the weight is derivable, else the bare label.
 */
function formulaTerm(label: string, weight: number | null): string {
  return weight === null ? label : `(${label} × ${weight})`;
}

/**
 * Formats one term for the substituted line: `(count × weight)` when derivable,
 * else the product itself (which is 0 for a zero-count term).
 */
function substitutedTerm(count: number, weight: number | null, product: number): string {
  return weight === null ? `${product}` : `(${count} × ${weight})`;
}

/**
 * Names a penalty count, e.g. "7 scheme twists" or "1 villain escaped".
 * Singular below 2 so "1 villain escaped" reads correctly.
 */
function penaltyLabel(type: keyof typeof PENALTY_LABELS, count: number): string {
  const labels = PENALTY_LABELS[type];
  return `${count} ${count === 1 ? labels.one : labels.many}`;
}

/**
 * Builds the substituted-penalty expression from the nonzero penalty events,
 * naming each penalty per WP-587, e.g. "(7 scheme twists × 300)" or
 * "(7 scheme twists × 300) + (1 villain escaped × 100)"; "0" when none fired.
 */
function penaltiesSubstituted(breakdown: CompetitiveScoreBreakdown): string {
  const counts = breakdown.inputs.penaltyEventCounts;
  const contributions = breakdown.penaltyBreakdown;
  // why: fixed order so the expansion reads the same across matches.
  const order: ReadonlyArray<keyof typeof PENALTY_LABELS> = [
    'villainEscaped',
    'bystanderLost',
    'schemeTwistNegative',
    'mastermindTacticUntaken',
    'scenarioSpecificPenalty',
  ];
  const parts: string[] = [];
  for (const type of order) {
    const count = counts[type];
    if (count > 0) {
      const weight = perUnitWeight(contributions[type], count);
      // why: name the penalty in the count position ("7 scheme twists × 300"); when
      // the per-unit weight is not derivable (should not happen for a nonzero count)
      // fall back to the bare product so a number always shows.
      parts.push(
        weight === null
          ? `${contributions[type]}`
          : `(${penaltyLabel(type, count)} × ${weight})`,
      );
    }
  }
  if (parts.length === 0) {
    return '0';
  }
  return parts.join(' + ');
}

/**
 * Formats one PAR term: `(count × weight)` when the weight is derivable from the
 * match, else `(count × <label>)` naming the weight symbolically — the PAR line
 * never fabricates a weight number that was not part of the real computation.
 */
function parTerm(count: number, weight: number | null, weightLabel: string): string {
  return weight === null ? `(${count} × ${weightLabel})` : `(${count} × ${weight})`;
}

/**
 * Builds the PAR-derivation strings from the scenario baseline, reusing the same
 * per-unit weights the raw-score formula derives (PAR uses the same config
 * weights). Returns undefined when the breakdown carries no `parBaseline`
 * (records persisted before WP-587).
 *
 * @param breakdown - The server-returned breakdown.
 * @param bystanderWeight - Per-bystander reward derived from the match (or null).
 * @param vpWeight - Per-VP reward derived from the match (or null).
 * @returns The PAR-derivation strings, or undefined when no baseline is present.
 */
function buildParDerivation(
  breakdown: CompetitiveScoreBreakdown,
  bystanderWeight: number | null,
  vpWeight: number | null,
): ParDerivation | undefined {
  const baseline = breakdown.parBaseline;
  if (baseline === undefined) {
    return undefined;
  }
  // why: PAR and the raw score share the config weights, so the escape penalty
  // weight is the same one the match's villainEscaped term used; derivable only
  // when the match itself had an escape, else shown symbolically.
  const escapeWeight = perUnitWeight(
    breakdown.penaltyBreakdown.villainEscaped,
    breakdown.inputs.penaltyEventCounts.villainEscaped,
  );

  const formula =
    `${formulaTerm('Escapes', escapeWeight)} ` +
    `${MINUS} ${formulaTerm('Bystanders', bystanderWeight)} ` +
    `${MINUS} ${formulaTerm('VP', vpWeight)}`;

  const substituted =
    `${parTerm(baseline.escapesPar, escapeWeight, 'escape penalty')} ` +
    `${MINUS} ${parTerm(baseline.bystandersPar, bystanderWeight, 'bystander reward')} ` +
    `${MINUS} ${parTerm(baseline.victoryPointsPar, vpWeight, 'VP reward')}`;

  return {
    formula,
    substituted,
    baseline: {
      escapes: baseline.escapesPar,
      bystanders: baseline.bystandersPar,
      victoryPoints: baseline.victoryPointsPar,
    },
  };
}

/**
 * Formats a value for the "− value" position, wrapping a negative in parentheses
 * so "Raw − PAR" reads "20 − (−300)" rather than "20 − −300".
 */
function subtrahend(value: number): string {
  return value < 0 ? `(${MINUS}${Math.abs(value)})` : `${value}`;
}

/**
 * Builds the per-player reward split for the report card (WP-588): each player's
 * VP and bystanders, labelled "Player N" (1-based). Returns undefined when the
 * breakdown carries no per-player data (records predating WP-588).
 *
 * @param breakdown - The server-returned breakdown.
 * @returns One row per player, or undefined when no per-player data is present.
 */
function buildPerPlayerSplit(
  breakdown: CompetitiveScoreBreakdown,
): WorkedScoreCalc['perPlayer'] {
  const perPlayer = breakdown.inputs.perPlayer;
  if (perPlayer === undefined || perPlayer.length === 0) {
    return undefined;
  }
  return perPlayer.map((contribution) => ({
    // why: boardgame.io player ids are 0-based ("0", "1"); players read "Player 1",
    // "Player 2". A non-numeric id falls back to itself rather than "Player NaN".
    label: playerLabel(contribution.playerId),
    victoryPoints: contribution.victoryPoints,
    bystandersRescued: contribution.bystandersRescued,
  }));
}

/**
 * Turns a boardgame.io player id into a 1-based "Player N" label.
 */
function playerLabel(playerId: string): string {
  const index = Number(playerId);
  return Number.isInteger(index) ? `Player ${index + 1}` : `Player ${playerId}`;
}

/**
 * Builds the full worked-calculation view model from a competitive score
 * breakdown. Formula-first: symbolic line, then substituted, then products,
 * then the result; then Final = Raw − PAR.
 *
 * @param breakdown - The server-returned score breakdown (rendered verbatim).
 * @returns The worked-calculation strings and values for the endgame screen.
 */
export function buildWorkedScoreCalc(breakdown: CompetitiveScoreBreakdown): WorkedScoreCalc {
  const inputs = breakdown.inputs;

  // why: WP-585 / D-24394 — no round-cost term (the rulebook has no round penalty;
  // Scheme Twists are its length proxy). RawScore = Penalties − rewards. "Rounds"
  // stays below as an informational given, but no longer appears in the formula.
  const bystanderWeight = perUnitWeight(
    breakdown.weightedBystanderReward,
    inputs.bystandersRescued,
  );
  const vpWeight = perUnitWeight(breakdown.weightedVictoryPointReward, inputs.victoryPoints);

  const formula =
    `Penalties ` +
    `${MINUS} ${formulaTerm('Bystanders', bystanderWeight)} ` +
    `${MINUS} ${formulaTerm('VP', vpWeight)}`;

  const substituted =
    `${penaltiesSubstituted(breakdown)} ` +
    `${MINUS} ${substitutedTerm(inputs.bystandersRescued, bystanderWeight, breakdown.weightedBystanderReward)} ` +
    `${MINUS} ${substitutedTerm(inputs.victoryPoints, vpWeight, breakdown.weightedVictoryPointReward)}`;

  const products =
    `${breakdown.weightedPenaltyTotal} ` +
    `${MINUS} ${breakdown.weightedBystanderReward} ${MINUS} ${breakdown.weightedVictoryPointReward}`;

  return {
    givens: [
      { label: 'Rounds', value: inputs.rounds },
      { label: 'Bystanders rescued', value: inputs.bystandersRescued },
      { label: 'Victory points', value: inputs.victoryPoints },
      { label: 'Villain escapes', value: inputs.penaltyEventCounts.villainEscaped },
      { label: 'Bystanders lost', value: inputs.penaltyEventCounts.bystanderLost },
      { label: 'Scheme twists', value: inputs.penaltyEventCounts.schemeTwistNegative },
    ],
    formula,
    substituted,
    products,
    rawScore: breakdown.rawScore,
    parScore: breakdown.parScore,
    perPlayer: buildPerPlayerSplit(breakdown),
    parDerivation: buildParDerivation(breakdown, bystanderWeight, vpWeight),
    finalSubstituted: `${breakdown.rawScore} ${MINUS} ${subtrahend(breakdown.parScore)}`,
    finalScore: breakdown.finalScore,
  };
}
