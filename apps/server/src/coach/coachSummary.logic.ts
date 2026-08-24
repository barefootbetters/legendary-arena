/**
 * Endgame AI Coach — Match Summary Assembler (WP-594 / EC-629 / D-24403)
 *
 * Turns the reduced final state + the stored score breakdown into the compact,
 * display-name-resolved `CoachMatchSummary` handed to the model. Pure and
 * side-effect-free (no I/O), so it is unit-testable without a database or a model
 * call. Every field is server-generated — no player free-text enters it, so there
 * is no prompt-injection surface (D-24403).
 *
 * The `acquiredCards` per player are the hero cards that entered that player's
 * DECK during the match: deck + hand + discard + in-play, minus the fixed
 * starting deck (8 S.H.I.E.L.D. Agents + 4 Troopers) and Wounds. The victory pile
 * (KO'd enemies + rescued bystanders) is deliberately excluded — it is not a
 * purchase. This is the input to the model's purchase critique.
 *
 * Layer-boundary contract: engine imports are the runtime-safe public surface
 * (`gradeForFinalScore`, `evaluateEndgame`, the starter/Wound ext_id constants)
 * plus types — the same surface `competition.logic.ts` already consumes. No
 * `boardgame.io`, registry, or UI import.
 *
 * Authority: WP-594 §Contract; EC-629 §Locked Values; D-24403.
 */

import {
  gradeForFinalScore,
  SHIELD_AGENT_EXT_ID,
  SHIELD_TROOPER_EXT_ID,
  WOUND_EXT_ID,
} from '@legendary-arena/game-engine';
import type {
  LegendaryGameState,
  ScoreBreakdown,
} from '@legendary-arena/game-engine';

import type {
  CoachMatchSummary,
  CoachPlayerLine,
  ResolveCardName,
} from './coach.types.js';

/** Number of S.H.I.E.L.D. Agents in every player's starting deck (engine setup). */
const STARTING_AGENTS_COUNT = 8;
/** Number of S.H.I.E.L.D. Troopers in every player's starting deck (engine setup). */
const STARTING_TROOPERS_COUNT = 4;

/**
 * Count the acquired hero cards for one player: everything in deck + hand +
 * discard + in-play, minus the fixed starting deck and Wounds. Returns a map of
 * ext_id → count (the purchase/gain multiset).
 *
 * @param zones The player's end-of-match zones.
 * @returns A map of acquired-card ext_id to how many the player holds.
 */
function countAcquiredCards(zones: LegendaryGameState['playerZones'][string]): Map<string, number> {
  const counts = new Map<string, number>();
  // why: the deck-building zones only — NOT `victory` (KO'd enemies + rescued
  // bystanders are not purchases). faceDownCards are hidden-identity plays already
  // resolved into these zones by end of match, so they are not double-counted here.
  const deckBuildingZones = [zones.deck, zones.hand, zones.discard, zones.inPlay];
  for (const zone of deckBuildingZones) {
    for (const extId of zone) {
      counts.set(extId, (counts.get(extId) ?? 0) + 1);
    }
  }
  // why: subtract the fixed starting deck (8 Agents + 4 Troopers) and remove every
  // Wound — what remains is the hero cards the player bought or gained.
  removeFromCount(counts, SHIELD_AGENT_EXT_ID, STARTING_AGENTS_COUNT);
  removeFromCount(counts, SHIELD_TROOPER_EXT_ID, STARTING_TROOPERS_COUNT);
  counts.delete(WOUND_EXT_ID);
  return counts;
}

/**
 * Decrement (and clear at zero) a count in a map — used to net out the starting
 * deck from a player's end-of-match card multiset.
 *
 * @param counts The count map to mutate.
 * @param extId The card ext_id to decrement.
 * @param amount How many to remove.
 */
function removeFromCount(counts: Map<string, number>, extId: string, amount: number): void {
  const current = counts.get(extId);
  if (current === undefined) {
    return;
  }
  const remaining = current - amount;
  if (remaining > 0) {
    counts.set(extId, remaining);
  } else {
    counts.delete(extId);
  }
}

/**
 * Render an acquired-card count map as "Display Name ×N" strings (or just the
 * name when N is 1), most-acquired first, ties broken by name for stable output.
 *
 * @param counts The acquired-card count map.
 * @param resolveCardName Resolver from ext_id to display name.
 * @returns The formatted acquired-card lines.
 */
function formatAcquiredCards(
  counts: Map<string, number>,
  resolveCardName: ResolveCardName,
): string[] {
  const entries = Array.from(counts.entries()).map(([extId, count]) => ({
    name: resolveCardName(extId),
    count,
  }));
  entries.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.name.localeCompare(right.name);
  });
  return entries.map((entry) =>
    entry.count === 1 ? entry.name : `${entry.name} ×${entry.count}`,
  );
}

/**
 * Build the per-player lines: each player's VP + rescued bystanders (from the
 * breakdown) joined with their acquired cards (from the reduced zones). Falls back
 * to a zone-only line for a player the breakdown has no per-player entry for.
 *
 * @param finalState The reduced final game state.
 * @param breakdown The stored score breakdown.
 * @param resolveCardName Resolver from ext_id to display name.
 * @returns One line per player, in seat order.
 */
function buildPerPlayerLines(
  finalState: LegendaryGameState,
  breakdown: ScoreBreakdown,
  resolveCardName: ResolveCardName,
): CoachPlayerLine[] {
  const contributionByPlayer = new Map<string, { victoryPoints: number; bystandersRescued: number }>();
  for (const contribution of breakdown.inputs.perPlayer ?? []) {
    contributionByPlayer.set(contribution.playerId, {
      victoryPoints: contribution.victoryPoints,
      bystandersRescued: contribution.bystandersRescued,
    });
  }
  const playerIds = Object.keys(finalState.playerZones).sort();
  const lines: CoachPlayerLine[] = [];
  for (const playerId of playerIds) {
    const index = Number(playerId);
    const label = Number.isInteger(index) ? `Player ${index + 1}` : `Player ${playerId}`;
    const contribution = contributionByPlayer.get(playerId);
    lines.push({
      label,
      victoryPoints: contribution?.victoryPoints ?? 0,
      bystandersRescued: contribution?.bystandersRescued ?? 0,
      acquiredCards: formatAcquiredCards(
        countAcquiredCards(finalState.playerZones[playerId]),
        resolveCardName,
      ),
    });
  }
  return lines;
}

/**
 * Resolve a list of composition ext_ids to display names.
 */
function resolveNames(extIds: readonly string[], resolveCardName: ResolveCardName): string[] {
  return extIds.map((extId) => resolveCardName(extId));
}

/**
 * Assemble the coach match summary from the reduced final state + the stored
 * score breakdown. The `outcome` is supplied by the caller (the orchestrator
 * evaluates it from the reduced state via `evaluateEndgame`, the only source that
 * distinguishes a `tie` from a win/loss); the grade from the breakdown's final
 * score.
 *
 * @param finalState The reduced final game state (loadout + zones).
 * @param breakdown The stored competitive score breakdown.
 * @param outcome The match outcome (heroes-win / scheme-wins / tie).
 * @param resolveCardName Resolver from ext_id to display name.
 * @returns The compact, name-resolved summary for the model.
 */
export function buildCoachMatchSummary(
  finalState: LegendaryGameState,
  breakdown: ScoreBreakdown,
  outcome: CoachMatchSummary['outcome'],
  resolveCardName: ResolveCardName,
): CoachMatchSummary {
  const configuration = finalState.matchConfiguration;
  const counts = breakdown.inputs.penaltyEventCounts;

  const summary: CoachMatchSummary = {
    // why: the true outcome — including a `tie` (a deck ran out with no winner),
    // which the breakdown's boolean matchLost flag cannot express. A tie was
    // previously mislabeled as a heroes-win to the model.
    outcome,
    playerCount: Object.keys(finalState.playerZones).length,
    rounds: breakdown.inputs.rounds,
    scheme: resolveCardName(configuration.schemeId),
    mastermind: resolveCardName(configuration.mastermindId),
    villainGroups: resolveNames(configuration.villainGroupIds, resolveCardName),
    henchmanGroups: resolveNames(configuration.henchmanGroupIds, resolveCardName),
    heroes: resolveNames(configuration.heroDeckIds, resolveCardName),
    rawScore: breakdown.rawScore,
    finalScore: breakdown.finalScore,
    grade: String(gradeForFinalScore(breakdown.finalScore)),
    team: {
      victoryPoints: breakdown.inputs.victoryPoints,
      bystandersRescued: breakdown.inputs.bystandersRescued,
    },
    adversity: {
      schemeTwists: counts.schemeTwistNegative,
      villainsEscaped: counts.villainEscaped,
      bystandersLost: counts.bystanderLost,
    },
    perPlayer: buildPerPlayerLines(finalState, breakdown, resolveCardName),
  };

  // why: WP-591 PAR baselines carry the expected adversity; older scored rows do
  // not, so include the "expected" block only when the baseline has it (the model
  // then reads how the shuffle compared to par; absent, it simply omits luck).
  const baseline = breakdown.parBaseline;
  if (
    baseline !== undefined &&
    baseline.schemeTwistsPar !== undefined &&
    baseline.bystandersLostPar !== undefined
  ) {
    return {
      ...summary,
      adversityExpected: {
        schemeTwists: baseline.schemeTwistsPar,
        villainsEscaped: baseline.escapesPar,
        bystandersLost: baseline.bystandersLostPar,
      },
    };
  }
  return summary;
}
