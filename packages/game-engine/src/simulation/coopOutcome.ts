/**
 * Co-op outcome classifier (WP-452).
 *
 * classifyCoopOutcome maps a terminal per-game CoopGameRecord to one of the
 * five canonical CoopOutcomeCategory values, so the co-op win-rate harness can
 * report a loss-cause breakdown alongside the raw win rate.
 *
 * Pure and deterministic — no randomness, no I/O, no state. It reads the escape
 * threshold from ESCAPE_LIMIT (never a numeric literal) and the tie outcome
 * from the EndgameOutcome union, so a change to either does not drift this file.
 *
 * No boardgame.io imports. No registry imports. No throw.
 */

import { ESCAPE_LIMIT } from '../endgame/endgame.types.js';
import type { CoopGameRecord } from './coopWinRate.js';

/**
 * The five canonical co-op outcome categories, in classification order.
 *
 * A `readonly` closed set: `'win'` plus the four loss / inconclusive causes.
 * The drift test pins the exact members and order; adding a category requires
 * updating this array AND the classifier's branches together.
 */
export const COOP_OUTCOME_CATEGORIES = [
  'win',
  'loss-scheme-completed',
  'loss-villains-escaped',
  'loss-tie',
  'inconclusive-turn-cap',
] as const;

/** One of the five canonical co-op outcome categories. */
export type CoopOutcomeCategory = (typeof COOP_OUTCOME_CATEGORIES)[number];

/**
 * Classifies a terminal co-op game record into one CoopOutcomeCategory.
 *
 * Evaluation order (first match wins):
 *   1. heroes win → 'win'
 *   2. turn cap hit with no terminal → 'inconclusive-turn-cap'
 *   3. deck-exhaustion tie → 'loss-tie'
 *   4. scheme wins → 'loss-villains-escaped' (escape-driven heuristic) | 'loss-scheme-completed'
 *
 * @param record - the narrow per-game projection from simulateOneCoopGame.
 * @returns the canonical category for this game.
 */
export function classifyCoopOutcome(record: CoopGameRecord): CoopOutcomeCategory {
  if (record.isHeroesWin) {
    return 'win';
  }

  // why: !endgameReached means the game hit the turn cap without evaluateEndgame
  // ever returning a terminal — the bot stalled / was too slow. That is an
  // inconclusive run, NOT a loss: no scheme completed and no villains escaped,
  // the game simply never resolved. It is the epic's most actionable signal
  // (a too-passive ally), so it gets its own category rather than folding into
  // a loss bucket.
  if (!record.endgameReached) {
    return 'inconclusive-turn-cap';
  }

  if (record.endgameWinner === 'tie') {
    return 'loss-tie';
  }

  // why (loss-cause heuristic, D-24317): the generic `escapedVillains >=
  // ESCAPE_LIMIT` game-loss was RETIRED from evaluateEndgame — villain-escape
  // losses are now per-scheme (Negative Zone latches SCHEME_LOSS at 12 escaped
  // villains via an 'escaped-pile-count' resourceLossCondition, WP-509/D-24316).
  // So this is no longer a load-bearing engine invariant; it is a loss-cause
  // HEURISTIC for the WP-452 breakdown: at a 'scheme-wins' terminal a high
  // escaped-villain count almost always means an escape-driven loss (a Negative
  // Zone loss carries escapedVillains >= 12 >= ESCAPE_LIMIT). It can
  // over-attribute a non-escape scheme loss that coincidentally accrued >=
  // ESCAPE_LIMIT escapes — the same class of approximation the escape-overrun
  // proxy always carried, accepted here for the analysis-only breakdown. Read
  // the threshold from ESCAPE_LIMIT, never a literal, so it cannot drift.
  if (record.escapedVillains >= ESCAPE_LIMIT) {
    return 'loss-villains-escaped';
  }
  return 'loss-scheme-completed';
}
