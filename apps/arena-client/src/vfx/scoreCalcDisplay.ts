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

/** The worked-calculation strings + values the endgame screen renders. */
export interface WorkedScoreCalc {
  /** "What happened" inputs, in display order. */
  readonly givens: ReadonlyArray<{ readonly label: string; readonly value: number }>;
  /** Symbolic formula, e.g. "(Rounds × 50) + Penalties − (Bystanders × 200) − (VP × 10)". */
  readonly formula: string;
  /** The same formula with match values substituted, e.g. "(29 × 50) + (6 × 300) − (11 × 200) − (103 × 10)". */
  readonly substituted: string;
  /** The weighted products summed, e.g. "1450 + 1800 − 2200 − 1030". */
  readonly products: string;
  /** Raw score (verbatim from the breakdown). */
  readonly rawScore: number;
  /** PAR score (verbatim). */
  readonly parScore: number;
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
 * Builds the substituted-penalty expression from the nonzero penalty events,
 * e.g. "(6 × 300)" or "(6 × 300) + (1 × 100)"; "0" when no penalty fired.
 */
function penaltiesSubstituted(breakdown: CompetitiveScoreBreakdown): string {
  const counts = breakdown.inputs.penaltyEventCounts;
  const contributions = breakdown.penaltyBreakdown;
  // why: fixed order so the expansion reads the same across matches.
  const order: ReadonlyArray<keyof typeof counts> = [
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
      parts.push(substitutedTerm(count, weight, contributions[type]));
    }
  }
  if (parts.length === 0) {
    return '0';
  }
  return parts.join(' + ');
}

/**
 * Formats a value for the "− value" position, wrapping a negative in parentheses
 * so "Raw − PAR" reads "20 − (−300)" rather than "20 − −300".
 */
function subtrahend(value: number): string {
  return value < 0 ? `(${MINUS}${Math.abs(value)})` : `${value}`;
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

  const roundWeight = perUnitWeight(breakdown.weightedRoundCost, inputs.rounds);
  const bystanderWeight = perUnitWeight(
    breakdown.weightedBystanderReward,
    inputs.bystandersRescued,
  );
  const vpWeight = perUnitWeight(breakdown.weightedVictoryPointReward, inputs.victoryPoints);

  const formula =
    `${formulaTerm('Rounds', roundWeight)} + Penalties ` +
    `${MINUS} ${formulaTerm('Bystanders', bystanderWeight)} ` +
    `${MINUS} ${formulaTerm('VP', vpWeight)}`;

  const substituted =
    `${substitutedTerm(inputs.rounds, roundWeight, breakdown.weightedRoundCost)} ` +
    `+ ${penaltiesSubstituted(breakdown)} ` +
    `${MINUS} ${substitutedTerm(inputs.bystandersRescued, bystanderWeight, breakdown.weightedBystanderReward)} ` +
    `${MINUS} ${substitutedTerm(inputs.victoryPoints, vpWeight, breakdown.weightedVictoryPointReward)}`;

  const products =
    `${breakdown.weightedRoundCost} + ${breakdown.weightedPenaltyTotal} ` +
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
    finalSubstituted: `${breakdown.rawScore} ${MINUS} ${subtrahend(breakdown.parScore)}`,
    finalScore: breakdown.finalScore,
  };
}
