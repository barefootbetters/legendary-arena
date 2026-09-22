/**
 * Endgame AI Coach — Model Eval Pack Types (WP-737 / EC-774 / D-24559)
 *
 * Contracts for the operator-run coach model eval: a fixed set of scenario match
 * summaries, each paired with a deterministic rubric that a candidate model's
 * report must satisfy before `COACH_MODEL` is swapped to it in production. The
 * rubric is pure string matching — no LLM judge, no I/O.
 *
 * Layer/boundary: server layer only — imports only the coach types.
 *
 * Contract file: locked once created. A change here needs a DECISIONS.md entry.
 */

import type { CoachMatchSummary } from './coach.types.js';

/**
 * The scenario categories the eval pack covers. Every category has at least one
 * scenario in `COACH_EVAL_SCENARIOS`.
 */
export type CoachEvalCategory =
  | 'baseline-win'
  | 'unlucky-loss'
  | 'lucky-win'
  | 'two-seat-contribution'
  | 'solo'
  | 'hallucination-guard'
  | 'no-purchases'
  | 'pre-par-summary'
  | 'tie'
  | 'five-players';

/** The canonical readonly array of `CoachEvalCategory` members (drift-tested). */
export const COACH_EVAL_CATEGORIES: readonly CoachEvalCategory[] = [
  'baseline-win',
  'unlucky-loss',
  'lucky-win',
  'two-seat-contribution',
  'solo',
  'hallucination-guard',
  'no-purchases',
  'pre-par-summary',
  'tie',
  'five-players',
];

/**
 * The per-scenario rubric. Both term rules use case-insensitive whole-term
 * matching across the report's headline, heroFit, purchases, and every
 * suggestion. There is no stemming: term lists enumerate inflections explicitly.
 */
export interface CoachEvalRubric {
  /**
   * Each inner list is a set of alternatives; the report must contain at least
   * one term from EVERY inner list.
   */
  readonly mustMentionAny?: readonly (readonly string[])[];
  /** Terms the report must not contain at all. */
  readonly mustNotMention?: readonly string[];
}

/** One eval scenario: a fixture match summary and the rubric its report must meet. */
export interface CoachEvalScenario {
  readonly id: string;
  readonly category: CoachEvalCategory;
  readonly description: string;
  readonly summary: CoachMatchSummary;
  readonly rubric: CoachEvalRubric;
}

/** The scored outcome of one scenario. `isPassing === (failures.length === 0)`. */
export interface CoachEvalResult {
  readonly scenarioId: string;
  readonly isPassing: boolean;
  /** Each failure is a full sentence naming the rule that failed. */
  readonly failures: readonly string[];
}

/** Totals across one eval run. */
export interface CoachEvalRunSummary {
  readonly totalCount: number;
  readonly passedCount: number;
  readonly failedCount: number;
}
