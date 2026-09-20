/**
 * Table Cooperation recognition (WP-717 / D-24540) — Synergy Realization Phase 3 v1.
 *
 * `computeTableCooperation` turns the already-built `CoachMatchSummary` into a
 * deterministic, celebration-only recognition of how the table **cooperated to win**.
 * Every multi-seat Legendary match is cooperative — all seats share one outcome
 * (`heroes-win` / `scheme-wins` / `tie`) vs the Scheme + Mastermind, and per-seat Victory
 * Points are a contribution measure, not a competitive race — so this frames the shared
 * result as a team achievement and names each seat's standout co-op role (who carried the
 * combat, who assembled the most synergy, who carried the rescue) from the per-seat
 * contribution counts the summary already holds.
 *
 * Design (see WP-717 / EC-754):
 * - Pure over the summary — no `G`/`ctx`, no `ctx.random`, no I/O, no replay read, not
 *   model-authored. The engine stays the authority on the outcome (D-20105).
 * - Two enforced vocabularies: celebration (never whiff/failed/error/missed/wasted) AND
 *   cooperative (never player-vs-player — seats are teammates, the game's own
 *   "no winner/loser between teammates" rule; the intra-match analogue of Vision §23b).
 * - Display-only, off-ranking (NG-1) — never `finalScore` / PAR / grade / Victory Points.
 *
 * No `boardgame.io`, no DB, no engine import. Pure over `CoachMatchSummary`.
 */

import type { CoachMatchSummary, CoachPlayerLine } from './coach.types.js';

/** A seat's total defeated enemies (villains + henchmen + mastermind tactics). */
function seatEnemiesDefeated(seat: CoachPlayerLine): number {
  return seat.villainsDefeated + seat.henchmenDefeated + seat.mastermindTacticsDefeated;
}

/**
 * Formats a count with its singular/plural noun ("1 enemy" / "3 enemies").
 *
 * @param count - The count.
 * @param singular - The singular noun.
 * @param plural - The plural noun.
 * @returns "`<count> <noun>`".
 */
function withCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Picks the standout seat by a primary metric — **first-max-wins** over `perPlayer` order
 * (strict `>`, so a residual tie resolves to the earlier seat) — with an optional secondary
 * tie-break, or `null` when the primary metric is zero across the whole table (no standout
 * to celebrate).
 *
 * why: determinism the tests can pin. `perPlayer` is a stable order; strict `>` never
 * replaces an equal leader, so a full tie (primary equal, secondary equal or absent) always
 * yields the first such seat, and a zero-across-the-table metric yields `null` (the caller
 * omits the role line rather than celebrating nothing).
 *
 * @param perPlayer - The per-seat contribution lines.
 * @param primary - The metric to maximize.
 * @param secondary - An optional tie-break metric, applied only when the primary ties.
 * @returns The standout seat, or `null` when the primary metric is zero for every seat.
 */
function pickTopSeat(
  perPlayer: readonly CoachPlayerLine[],
  primary: (seat: CoachPlayerLine) => number,
  secondary?: (seat: CoachPlayerLine) => number,
): CoachPlayerLine | null {
  let best: CoachPlayerLine | null = null;
  let bestPrimary = 0;
  let bestSecondary = 0;
  for (const seat of perPlayer) {
    const primaryValue = primary(seat);
    // why: a zero metric is never a standout to celebrate (omit the role line).
    if (primaryValue <= 0) {
      continue;
    }
    const secondaryValue = secondary ? secondary(seat) : 0;
    if (
      best === null ||
      primaryValue > bestPrimary ||
      (primaryValue === bestPrimary && secondaryValue > bestSecondary)
    ) {
      best = seat;
      bestPrimary = primaryValue;
      bestSecondary = secondaryValue;
    }
  }
  return best;
}

/**
 * The shared-outcome team line — the co-op result framed as a team achievement.
 *
 * why: `scheme-wins` is a regroup, never blame (the celebration / two-vocabulary rule);
 * `heroes-win` names the Mastermind the table stopped (hero-vs-villain framing, allowed);
 * `tie` frames the held stand. No player-vs-player vocabulary.
 *
 * @param summary - The match summary.
 * @returns The outcome line.
 */
function outcomeLine(summary: CoachMatchSummary): string {
  if (summary.outcome === 'heroes-win') {
    return `Your table stopped ${summary.mastermind} together — a shared victory.`;
  }
  if (summary.outcome === 'scheme-wins') {
    return `${summary.scheme} won this round — regroup and run it back together.`;
  }
  return 'A hard-fought stand together — the deck ran out with the threat held off.';
}

/**
 * The combined-table achievement line, built from the non-zero shared totals, or `null`
 * when the table defeated no enemies and rescued no Bystanders.
 *
 * @param summary - The match summary.
 * @returns The combined line, or `null`.
 */
function combinedTotalLine(summary: CoachMatchSummary): string | null {
  // why: for...of, not .reduce() (.claude/rules/code-style.md) — sum the shared enemy total.
  let totalEnemies = 0;
  for (const seat of summary.perPlayer) {
    totalEnemies += seatEnemiesDefeated(seat);
  }
  const parts: string[] = [];
  if (totalEnemies > 0) {
    parts.push(`defeated ${withCount(totalEnemies, 'enemy', 'enemies')}`);
  }
  if (summary.team.bystandersRescued > 0) {
    parts.push(`rescued ${withCount(summary.team.bystandersRescued, 'Bystander', 'Bystanders')}`);
  }
  if (parts.length === 0) {
    return null;
  }
  return `Together your table ${parts.join(' and ')}.`;
}

/**
 * Computes the deterministic, celebration-only Table Cooperation recognition (WP-717 /
 * D-24540): the shared outcome as a team achievement, each seat's standout co-op role, and
 * the combined-table total. Solo / single-seat matches return just the outcome line (no
 * cross-seat roles); an all-zero table returns the outcome line alone.
 *
 * @param summary - The already-built `CoachMatchSummary` (outcome + team + perPlayer).
 * @returns The recognition lines (never empty for a well-formed summary — at least the outcome).
 */
export function computeTableCooperation(summary: CoachMatchSummary): readonly string[] {
  const lines: string[] = [outcomeLine(summary)];

  // why: cross-seat roles only make sense with ≥ 2 seats; a solo match degenerates to the
  // shared-outcome line (there is no teammate to celebrate a role against).
  if (summary.perPlayer.length <= 1) {
    return lines;
  }

  const combat = pickTopSeat(summary.perPlayer, seatEnemiesDefeated);
  if (combat !== null) {
    lines.push(
      `${combat.label} carried the combat — ${withCount(seatEnemiesDefeated(combat), 'enemy', 'enemies')} defeated.`,
    );
  }

  const synergy = pickTopSeat(
    summary.perPlayer,
    (seat) => seat.conditionalClausesAssembled,
    // why: a synergy tie breaks toward the seat that realized more attack/recruit value;
    // a full tie (value equal too) still resolves to the earlier seat via pickTopSeat.
    (seat) => seat.conditionalClausesRealizedValue,
  );
  if (synergy !== null) {
    lines.push(
      `${synergy.label} assembled the most synergy — ${withCount(synergy.conditionalClausesAssembled, 'conditional clause', 'conditional clauses')} landed.`,
    );
  }

  const rescue = pickTopSeat(summary.perPlayer, (seat) => seat.bystandersRescued);
  if (rescue !== null) {
    lines.push(
      `${rescue.label} carried the rescue — ${withCount(rescue.bystandersRescued, 'Bystander', 'Bystanders')} saved.`,
    );
  }

  const combined = combinedTotalLine(summary);
  if (combined !== null) {
    lines.push(combined);
  }

  return lines;
}
