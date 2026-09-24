/**
 * Endgame AI Coach — Match Summary Assembler (WP-594 / EC-629 / D-24403)
 *
 * Turns the reduced final state + the stored score breakdown into the compact,
 * display-name-resolved `CoachMatchSummary` handed to the model. A casual
 * (unscored) match has no breakdown; `buildCasualCoachMatchSummary` builds the same
 * summary from the scoring inputs derived from the replay, minus every score field
 * (WP-751 / D-24576). Pure and side-effect-free (no I/O), so it is unit-testable
 * without a database or a model call. Every field is server-generated — no player
 * free-text enters it, so there is no prompt-injection surface (D-24403).
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
  PlayerScoringContribution,
  ScoreBreakdown,
  ScoringInputs,
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
  // bystanders are not purchases, and Undercover'd cards there are not acquisitions
  // either).
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
 * Resolve a card id from a match to its display name (D-24579). Hero cards in the
 * zones are per-copy ids (`set/hero/card#N`) that the registry name resolver does
 * not map, so the match's own setup-time `cardDisplayData` (keyed by exactly those
 * ids) is read first; anything it lacks falls back to the registry resolver.
 *
 * @param extId The card id as it appears in the match's zones.
 * @param finalState The reduced final game state (carries `cardDisplayData`).
 * @param resolveCardName The registry resolver (set-level ids, fallback).
 * @returns The card's display name, or whatever the fallback resolver returns.
 */
export function resolveMatchCardName(
  extId: string,
  finalState: LegendaryGameState,
  resolveCardName: ResolveCardName,
): string {
  // why: a reduced state from an older or partial replay may lack the table, so
  // read it defensively and fall back rather than throw.
  const displayByExtId = finalState.cardDisplayData as
    | Readonly<Record<string, { readonly name?: string }>>
    | undefined;
  const displayName = displayByExtId?.[extId]?.name;
  if (typeof displayName === 'string' && displayName !== '') {
    return displayName;
  }
  return resolveCardName(extId);
}

/**
 * The hero deck a hero card belongs to, as a display name, or `null` when the id
 * is not a `set/hero/card` hero-card id or the hero deck does not resolve.
 *
 * @param extId The card id (a copy suffix `#N` is ignored).
 * @param resolveCardName The registry resolver (maps `set/hero` deck ids).
 * @returns The hero's display name, or `null`.
 */
function heroNameForCard(extId: string, resolveCardName: ResolveCardName): string | null {
  const hashIndex = extId.indexOf('#');
  const baseExtId = hashIndex === -1 ? extId : extId.slice(0, hashIndex);
  const segments = baseExtId.split('/');
  if (segments.length !== 3) {
    return null;
  }
  const heroDeckId = `${segments[0]}/${segments[1]}`;
  const heroName = resolveCardName(heroDeckId);
  // why: the registry resolver returns its input unchanged when it has no entry.
  return heroName === heroDeckId ? null : heroName;
}

/**
 * Render an acquired-card count map as "Card Name ×N (Hero)" strings (the count
 * only when N > 1, the hero only for a hero card), most-acquired first, ties broken
 * by label for stable output. Copies of the same card (`#0`, `#2`, …) are distinct
 * ids, so counts are grouped by label, not by id (D-24579).
 *
 * @param counts The acquired-card count map, keyed by per-copy id.
 * @param finalState The reduced final game state (card display names).
 * @param resolveCardName The registry resolver (hero deck names, fallback).
 * @returns The formatted acquired-card lines.
 */
function formatAcquiredCards(
  counts: Map<string, number>,
  finalState: LegendaryGameState,
  resolveCardName: ResolveCardName,
): string[] {
  const countByLabel = new Map<string, number>();
  for (const [extId, count] of counts) {
    const cardName = resolveMatchCardName(extId, finalState, resolveCardName);
    const heroName = heroNameForCard(extId, resolveCardName);
    // why: D-24579 — name the hero beside each card so the coach knows which hero
    // a purchase came from (it misread "Perfect Teamwork" as not a Captain America
    // buy when the hero was absent).
    const label = heroName === null ? cardName : `${cardName} (${heroName})`;
    countByLabel.set(label, (countByLabel.get(label) ?? 0) + count);
  }
  const entries = Array.from(countByLabel.entries()).map(([label, count]) => ({ label, count }));
  entries.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.label.localeCompare(right.label);
  });
  return entries.map((entry) => {
    if (entry.count === 1) {
      return entry.label;
    }
    // why: keep the count beside the card name, before the hero: "Name ×2 (Hero)".
    const heroStart = entry.label.lastIndexOf(' (');
    if (heroStart === -1 || !entry.label.endsWith(')')) {
      return `${entry.label} ×${entry.count}`;
    }
    return `${entry.label.slice(0, heroStart)} ×${entry.count}${entry.label.slice(heroStart)}`;
  });
}

/**
 * Build the per-player lines: each player's VP + rescued bystanders (from the
 * scoring inputs) joined with their acquired cards (from the reduced zones). Falls
 * back to a zone-only line for a player the inputs have no per-player entry for.
 *
 * @param finalState The reduced final game state.
 * @param inputs The scoring inputs — a stored breakdown's `inputs`, or the inputs
 *   derived from the replay for a casual match (WP-751).
 * @param resolveCardName Resolver from ext_id to display name.
 * @param botSeatIds The match's bot-ally seat ids (e.g. `['1']`); `[]` when none.
 * @returns One line per player, in seat order.
 */
function buildPerPlayerLines(
  finalState: LegendaryGameState,
  inputs: ScoringInputs,
  resolveCardName: ResolveCardName,
  botSeatIds: readonly string[],
): CoachPlayerLine[] {
  const contributionByPlayer = new Map<string, PlayerScoringContribution>();
  for (const contribution of inputs.perPlayer ?? []) {
    contributionByPlayer.set(contribution.playerId, contribution);
  }
  const playerIds = Object.keys(finalState.playerZones).sort();
  const lines: CoachPlayerLine[] = [];
  for (const playerId of playerIds) {
    const index = Number(playerId);
    const label = Number.isInteger(index) ? `Player ${index + 1}` : `Player ${playerId}`;
    const contribution = contributionByPlayer.get(playerId);
    // why: WP-742 — both the bot seat ids and the playerZones keys are
    // String(seatIndex), so a string compare matches them.
    const isBotAlly = botSeatIds.includes(playerId);
    const line: CoachPlayerLine = {
      label,
      victoryPoints: contribution?.victoryPoints ?? 0,
      bystandersRescued: contribution?.bystandersRescued ?? 0,
      // why: WP-622 — default 0 when the record predates WP-616 (no per-seat
      // defeat counts); the coach then reads a seat as having defeated none,
      // which is truthful for a record that never carried the counts.
      villainsDefeated: contribution?.villainsDefeated ?? 0,
      henchmenDefeated: contribution?.henchmenDefeated ?? 0,
      mastermindTacticsDefeated: contribution?.mastermindTacticsDefeated ?? 0,
      // why: WP-708 — default 0 when the record predates WP-708 (no per-seat synergy
      // counts), the same truthful-default pattern as the WP-622 defeat counts above.
      conditionalClausesPlayed: contribution?.conditionalClausesPlayed ?? 0,
      conditionalClausesAssembled: contribution?.conditionalClausesAssembled ?? 0,
      // why: WP-709 — default 0 when the record predates WP-709 (no per-seat value
      // sums), the same truthful-default pattern as the WP-708 synergy counts above.
      conditionalClausesPotentialValue: contribution?.conditionalClausesPotentialValue ?? 0,
      conditionalClausesRealizedValue: contribution?.conditionalClausesRealizedValue ?? 0,
      isBotAlly,
    };
    // why: D-24578 — a bot-ally seat's buys are never sent, so the coach cannot
    // grade them (D-24564); every human seat keeps its acquired-card list.
    if (isBotAlly) {
      lines.push(line);
    } else {
      lines.push({
        ...line,
        acquiredCards: formatAcquiredCards(
          countAcquiredCards(finalState.playerZones[playerId]),
          finalState,
          resolveCardName,
        ),
      });
    }
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
 * @param botSeatIds The match's bot-ally seat ids (WP-742); `[]` for a human-only match.
 * @returns The compact, name-resolved summary for the model.
 */
export function buildCoachMatchSummary(
  finalState: LegendaryGameState,
  breakdown: ScoreBreakdown,
  outcome: CoachMatchSummary['outcome'],
  resolveCardName: ResolveCardName,
  botSeatIds: readonly string[],
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
      schemeTwistsFromVillainDeck: counts.schemeTwistNegative,
      villainsEscaped: counts.villainEscaped,
      bystandersLost: counts.bystanderLost,
    },
    perPlayer: buildPerPlayerLines(finalState, breakdown.inputs, resolveCardName, botSeatIds),
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
        schemeTwistsFromVillainDeck: baseline.schemeTwistsPar,
        villainsEscaped: baseline.escapesPar,
        bystandersLost: baseline.bystandersLostPar,
      },
    };
  }
  return summary;
}

/**
 * Assemble the coach match summary for a casual (unscored) match from the reduced
 * final state + the scoring inputs derived from its replay (WP-751 / D-24576).
 * Every field matches what `buildCoachMatchSummary` produces for the same inputs,
 * except that `rawScore`, `finalScore`, `grade` and `adversityExpected` are omitted.
 *
 * @param finalState The reduced final game state (loadout + zones).
 * @param inputs The scoring inputs derived from the replay (`deriveScoringInputs`).
 * @param outcome The match outcome (heroes-win / scheme-wins / tie).
 * @param resolveCardName Resolver from ext_id to display name.
 * @param botSeatIds The match's bot-ally seat ids (WP-742); `[]` for a human-only match.
 * @returns The compact, name-resolved summary for the model, with no score fields.
 */
export function buildCasualCoachMatchSummary(
  finalState: LegendaryGameState,
  inputs: ScoringInputs,
  outcome: CoachMatchSummary['outcome'],
  resolveCardName: ResolveCardName,
  botSeatIds: readonly string[],
): CoachMatchSummary {
  const configuration = finalState.matchConfiguration;
  const counts = inputs.penaltyEventCounts;

  // why: NG-1 — a casual match has no PAR artifact, so there are no scoring weights,
  // no raw/final score, no grade, and no PAR-expected adversity. Those fields are
  // left out entirely (never faked as 0 or '') so the model cannot read a score.
  return {
    outcome,
    playerCount: Object.keys(finalState.playerZones).length,
    rounds: inputs.rounds,
    scheme: resolveCardName(configuration.schemeId),
    mastermind: resolveCardName(configuration.mastermindId),
    villainGroups: resolveNames(configuration.villainGroupIds, resolveCardName),
    henchmanGroups: resolveNames(configuration.henchmanGroupIds, resolveCardName),
    heroes: resolveNames(configuration.heroDeckIds, resolveCardName),
    team: {
      victoryPoints: inputs.victoryPoints,
      bystandersRescued: inputs.bystandersRescued,
    },
    adversity: {
      schemeTwistsFromVillainDeck: counts.schemeTwistNegative,
      villainsEscaped: counts.villainEscaped,
      bystandersLost: counts.bystanderLost,
    },
    perPlayer: buildPerPlayerLines(finalState, inputs, resolveCardName, botSeatIds),
  };
}
