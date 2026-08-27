/**
 * Badge Predicates — Server Layer (WP-105)
 *
 * Pure predicate functions for evaluating per-run Tier 1 gameplay badge
 * eligibility from a `ScoreBreakdown`. No I/O, no clock reads, no
 * database access. Each predicate is a deterministic function of its
 * input — the same `ScoreBreakdown` produces the same result on every
 * call.
 *
 * Layer-boundary contract: this module imports only type definitions
 * from `@legendary-arena/game-engine`. No runtime engine imports, no
 * `boardgame.io`, no registry, no preplan, no vue-sfc-loader, no UI
 * packages, no `pg`.
 *
 * Authority: WP-105 §Scope (In) §B + §C; EC-160 §Locked Values +
 * §Guardrails; D-1004; D-0005 (anti-volume).
 */

import type {
  PenaltyEventType,
  PlayerScoringContribution,
  ScoreBreakdown,
} from '@legendary-arena/game-engine';

/**
 * Canonical list of all `PenaltyEventType` keys that must be present
 * in `penaltyBreakdown` for a valid `ScoreBreakdown`. Used by the
 * structural validation in `validateScoreBreakdownShape`.
 */
const REQUIRED_PENALTY_KEYS: readonly PenaltyEventType[] = [
  'villainEscaped',
  'bystanderLost',
  'schemeTwistNegative',
  'mastermindTacticUntaken',
  'scenarioSpecificPenalty',
];

/**
 * Validate the structural shape of a deserialized `ScoreBreakdown`
 * before badge evaluation. Throws on invalid shape so callers
 * short-circuit before predicate evaluation with corrupted data.
 *
 * Checks:
 * - `finalScore` is a number
 * - `penaltyBreakdown` is an object containing all `PenaltyEventType` keys
 * - `scoringConfigVersion` is a number
 */
export function validateScoreBreakdownShape(breakdown: unknown): asserts breakdown is ScoreBreakdown {
  if (breakdown === null || typeof breakdown !== 'object') {
    throw new Error(
      'ScoreBreakdown deserialization failed: expected an object, received ' +
        (breakdown === null ? 'null' : typeof breakdown) +
        '.',
    );
  }
  const candidate = breakdown as Record<string, unknown>;

  if (typeof candidate.finalScore !== 'number') {
    throw new Error(
      'ScoreBreakdown deserialization failed: finalScore must be a number, received ' +
        typeof candidate.finalScore +
        '.',
    );
  }

  if (typeof candidate.scoringConfigVersion !== 'number') {
    throw new Error(
      'ScoreBreakdown deserialization failed: scoringConfigVersion must be a number, received ' +
        typeof candidate.scoringConfigVersion +
        '.',
    );
  }

  if (candidate.penaltyBreakdown === null || typeof candidate.penaltyBreakdown !== 'object') {
    throw new Error(
      'ScoreBreakdown deserialization failed: penaltyBreakdown must be an object.',
    );
  }

  const penaltyBreakdown = candidate.penaltyBreakdown as Record<string, unknown>;
  for (const key of REQUIRED_PENALTY_KEYS) {
    if (typeof penaltyBreakdown[key] !== 'number') {
      throw new Error(
        `ScoreBreakdown deserialization failed: penaltyBreakdown.${key} must be a number, received ${typeof penaltyBreakdown[key]}.`,
      );
    }
  }
}

/**
 * Sub-PAR Run: `finalScore < 0`.
 */
export function isEligibleSubParRun(breakdown: ScoreBreakdown): boolean {
  return breakdown.finalScore < 0;
}

/**
 * Pristine Defense: zero villain escapes in the penalty breakdown.
 */
export function isEligiblePristineDefense(breakdown: ScoreBreakdown): boolean {
  return breakdown.penaltyBreakdown.villainEscaped === 0;
}

/**
 * Lone Defender (WP-613 Solo Mastery lane): a sub-PAR clear achieved SOLO —
 * one player facing the whole mastermind alone, strictly harder than a full
 * table. Gated on `playerCount === 1` AND the sub-PAR quality bar.
 *
 * // why: `playerCount` is `number | null` — a `null` count is UNKNOWN, never
 * treated as solo, so an unknown-count submission can never earn a solo badge.
 * The quality bar reuses `isEligibleSubParRun` so the two lanes stay in lockstep.
 */
export function isEligibleLoneDefender(
  breakdown: ScoreBreakdown,
  playerCount: number | null,
): boolean {
  return playerCount === 1 && isEligibleSubParRun(breakdown);
}

// -----------------------------------------------------------------------
// Deferred badge predicates (not shipped — comment-only stubs)
// -----------------------------------------------------------------------

// why: gameplay.master-strike-ironwall is DEFERRED. No PenaltyEventType
// tracks Master Strike resolution count. `mastermindTacticUntaken`
// tracks untaken mastermind tactics, not Master Strikes. Shipping this
// badge requires either (a) adding a `masterStrikeResolved` penalty
// event to the engine scoring pipeline, or (b) sourcing the count from
// replay event log. Either path is out of scope for WP-105.

// why: gameplay.bystander-guardian is DEFERRED. The predicate requires
// total bystanders available per scenario, which is not stored in
// `ScoreBreakdown` or `competitive_scores`. Shipping requires a
// deterministic per-ScenarioKey lookup of available bystander count
// (likely from PAR config or match setup). Approximation is not
// acceptable per D-1004.

// why: gameplay.steady-crew is DEFERRED per PROPOSAL-BADGES.md. Depends
// on a registered-party concept that does not exist on the platform.

/**
 * Evaluate which per-run Tier 1 badges a single competitive submission
 * qualifies for. Returns an array of badge key strings.
 *
 * Returns `gameplay.sub-par-run`, `gameplay.pristine-defense`, and — when the
 * run was solo (WP-613) — `gameplay.solo.lone-defender`. NEVER returns a
 * history-evaluated badge (`gameplay.multiverse-mastery`,
 * `gameplay.solo.solitaire-master`) — those belong in `evaluateHistoryBadges`.
 *
 * `playerCount` is the submitting run's player count (`number | null`, on the
 * competitive record per D-24134); only `=== 1` is solo.
 */
export function evaluatePerRunBadges(
  breakdown: ScoreBreakdown,
  playerCount: number | null,
  // why: WP-617 — the submitter's bgio seat id, resolved from the match roster by
  // the caller. Needed to find THIS player's entry in the per-player split for the
  // Vanguard badge; `null` when it could not be resolved (→ no Vanguard).
  submitterSeatId: string | null,
): string[] {
  const earned: string[] = [];

  if (isEligibleSubParRun(breakdown)) {
    earned.push('gameplay.sub-par-run');
  }

  if (isEligiblePristineDefense(breakdown)) {
    earned.push('gameplay.pristine-defense');
  }

  if (isEligibleLoneDefender(breakdown, playerCount)) {
    earned.push('gameplay.solo.lone-defender');
  }

  if (isEligibleVanguard(breakdown.inputs?.perPlayer, submitterSeatId, playerCount)) {
    earned.push('gameplay.team.vanguard');
  }

  return earned;
}

/**
 * Vanguard (WP-617): the submitting player led the table's mastermind fight —
 * their own seat defeated the STRICT-maximum mastermind tactics of a co-op table.
 * "Strict maximum" means their count is the table's highest AND at least one other
 * seat defeated fewer, so an even split (no standout) earns no one.
 *
 * // why: reads only the submitter's own entry against the per-seat split — a
 * self-award, so a player only ever earns their own badge. `perPlayer` is
 * `undefined` on pre-WP-588 records; `submitterSeatId` is `null` when the caller
 * could not resolve the seat — either yields no award.
 */
export function isEligibleVanguard(
  perPlayer: readonly PlayerScoringContribution[] | undefined,
  submitterSeatId: string | null,
  playerCount: number | null,
): boolean {
  // why: a shared/team recognition needs an actual table (≥ 2 seats) and the
  // per-seat split; a solo run or a missing split can never qualify.
  if (playerCount === null || playerCount < 2) {
    return false;
  }
  if (submitterSeatId === null || perPlayer === undefined || perPlayer.length < 2) {
    return false;
  }
  const submitter = perPlayer.find(
    (contribution) => contribution.playerId === submitterSeatId,
  );
  if (submitter === undefined) {
    return false;
  }
  let maxTactics = Number.NEGATIVE_INFINITY;
  let minTactics = Number.POSITIVE_INFINITY;
  for (const contribution of perPlayer) {
    if (contribution.mastermindTacticsDefeated > maxTactics) {
      maxTactics = contribution.mastermindTacticsDefeated;
    }
    if (contribution.mastermindTacticsDefeated < minTactics) {
      minTactics = contribution.mastermindTacticsDefeated;
    }
  }
  // why: max ≥ 1 (someone actually defeated a tactic) AND max > min (a real
  // standout — an even split, where every seat tied, awards no Vanguard).
  if (maxTactics < 1 || maxTactics === minTactics) {
    return false;
  }
  return submitter.mastermindTacticsDefeated === maxTactics;
}
