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
 * Joins achievement fragments into a natural list ("a" / "a and b" / "a, b, and c").
 *
 * why: the combined multi-role line (WP-719 / EC-757) lists a seat's achievements; up to
 * three here (combat / synergy / rescue), with an Oxford comma for three.
 *
 * @param fragments - The fragments (at least one).
 * @returns The joined list.
 */
function joinFragments(fragments: readonly string[]): string {
  if (fragments.length === 1) {
    return fragments[0]!;
  }
  if (fragments.length === 2) {
    return `${fragments[0]} and ${fragments[1]}`;
  }
  return `${fragments.slice(0, -1).join(', ')}, and ${fragments[fragments.length - 1]}`;
}

/**
 * Computes the deterministic, celebration-only Table Cooperation recognition (WP-717 /
 * D-24540, grouped per WP-719): the shared outcome as a team achievement, each seat's
 * standout co-op role (grouped by seat so a sweeping seat is named once), and the
 * combined-table total. Solo / single-seat matches return just the outcome line (no
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

  // why: the three standout role winners (unchanged pickTopSeat — deterministic
  // first-max-wins). synergy tie breaks toward the seat that realized more attack/recruit
  // value; a full tie still resolves to the earlier seat via pickTopSeat.
  const combat = pickTopSeat(summary.perPlayer, seatEnemiesDefeated);
  const synergy = pickTopSeat(
    summary.perPlayer,
    (seat) => seat.conditionalClausesAssembled,
    (seat) => seat.conditionalClausesRealizedValue,
  );
  const rescue = pickTopSeat(summary.perPlayer, (seat) => seat.bystandersRescued);

  // why: each non-null winner carries its single-role line (the specific voice, unchanged)
  // and a self-describing achievement fragment for the combined multi-role line. Built in
  // combat → synergy → rescue order so grouping preserves first-appearance.
  const roleEntries: { readonly seat: CoachPlayerLine; readonly singleLine: string; readonly fragment: string }[] = [];
  if (combat !== null) {
    const fragment = `${withCount(seatEnemiesDefeated(combat), 'enemy', 'enemies')} defeated`;
    roleEntries.push({ seat: combat, singleLine: `${combat.label} carried the combat — ${fragment}.`, fragment });
  }
  if (synergy !== null) {
    const fragment = `${withCount(synergy.conditionalClausesAssembled, 'conditional clause', 'conditional clauses')} landed`;
    roleEntries.push({ seat: synergy, singleLine: `${synergy.label} assembled the most synergy — ${fragment}.`, fragment });
  }
  if (rescue !== null) {
    const fragment = `${withCount(rescue.bystandersRescued, 'Bystander', 'Bystanders')} saved`;
    roleEntries.push({ seat: rescue, singleLine: `${rescue.label} carried the rescue — ${fragment}.`, fragment });
  }

  // why: group by seat IDENTITY (the pickTopSeat-returned CoachPlayerLine reference, keyed
  // on object identity in the Map), NOT the display label — robust against any future label
  // change at zero cost — preserving first-appearance order. One line per distinct winning
  // seat: a single-role seat keeps its specific voice; a multi-role seat combines into one
  // line ("anchored the table — ...") so a seat that sweeps is never named twice.
  const seatsInOrder: CoachPlayerLine[] = [];
  const fragmentsBySeat = new Map<CoachPlayerLine, string[]>();
  const singleLineBySeat = new Map<CoachPlayerLine, string>();
  for (const entry of roleEntries) {
    const existing = fragmentsBySeat.get(entry.seat);
    if (existing === undefined) {
      seatsInOrder.push(entry.seat);
      fragmentsBySeat.set(entry.seat, [entry.fragment]);
      singleLineBySeat.set(entry.seat, entry.singleLine);
    } else {
      existing.push(entry.fragment);
    }
  }
  for (const seat of seatsInOrder) {
    const fragments = fragmentsBySeat.get(seat)!;
    if (fragments.length === 1) {
      lines.push(singleLineBySeat.get(seat)!);
    } else {
      lines.push(`${seat.label} anchored the table — ${joinFragments(fragments)}.`);
    }
  }

  const combined = combinedTotalLine(summary);
  if (combined !== null) {
    lines.push(combined);
  }

  return lines;
}
