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
 *   4. scheme wins → 'loss-villains-escaped' (escape overrun) | 'loss-scheme-completed'
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

  // why (load-bearing invariant): evaluateEndgame ends on the FIRST tripped
  // condition, so at a 'scheme-wins' terminal escapedVillains >= ESCAPE_LIMIT
  // iff escape-overrun was the trigger (had a lower-numbered condition tripped
  // first, the game would have ended there, before the escape count reached the
  // limit). The same-turn double-trip — SCHEME_LOSS and escape-overrun both true
  // on one turn — is a known, accepted limitation of this proxy; surfacing a
  // typed loss-cause from evaluateEndgame itself is deliberately out of scope
  // (it would touch endgame.evaluate.ts, outside this WP's allowlist). Read the
  // threshold from ESCAPE_LIMIT, never a literal, so the limit changing here is
  // impossible to drift from the engine's.
  if (record.escapedVillains >= ESCAPE_LIMIT) {
    return 'loss-villains-escaped';
  }
  return 'loss-scheme-completed';
}
