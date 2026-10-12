/**
 * Operator-match bot decision record — Server Layer (WP-802 / EC-839 / D-24689 §5).
 *
 * Keeps the bot ally's recent decisions for each operator match in process
 * memory, so the operator board route can show why the bot played what it did.
 * Nothing here is persisted: not in `G`, the move log or any table, and a
 * restart loses it. It is per instance (a deploy-overlap peer that is not
 * driving the bot has an empty record).
 *
 * No timer, no clock and no I/O: both caps evict by insertion order.
 */

/** The most recent decisions kept per operator match (the oldest is dropped). */
export const OPERATOR_BOT_DECISION_CAP = 50;

/** The most operator matches kept at once (the oldest-inserted match is evicted). */
export const OPERATOR_BOT_DECISION_MATCH_CAP = 20;

/** One bot decision in an operator match. */
export interface OperatorBotDecision {
  // why: D-24697 — the play-relative turn the board and the game log show
  // (the engine's `game.turn`), not the framework `ctx.turn`.
  readonly turn: number;
  readonly seat: string;
  readonly isForced: boolean;
  readonly move: { readonly name: string; readonly args: unknown };
  readonly decisionLog: readonly string[];
  readonly legalMoveCount: number;
}

// why: a Map keeps insertion order, which is the eviction order for both caps
// (no clock). Module-level so the bot driver and the board route share it.
const decisionsByMatch = new Map<string, OperatorBotDecision[]>();

/**
 * Records one bot decision for an operator match, keeping the most recent
 * {@link OPERATOR_BOT_DECISION_CAP} decisions per match and at most
 * {@link OPERATOR_BOT_DECISION_MATCH_CAP} matches.
 *
 * @param matchId - The operator match id.
 * @param record - The decision to record.
 */
export function recordOperatorBotDecision(matchId: string, record: OperatorBotDecision): void {
  let decisions = decisionsByMatch.get(matchId);
  if (decisions === undefined) {
    decisions = [];
    decisionsByMatch.set(matchId, decisions);
    evictOldestMatches();
  }
  decisions.push(copyDecision(record));
  if (decisions.length > OPERATOR_BOT_DECISION_CAP) {
    decisions.shift();
  }
}

/**
 * Reads an operator match's recorded bot decisions, oldest first.
 *
 * @param matchId - The operator match id.
 * @returns A fresh copy of the record, or `[]` when nothing is recorded.
 */
export function readOperatorBotDecisions(matchId: string): OperatorBotDecision[] {
  const decisions = decisionsByMatch.get(matchId);
  if (decisions === undefined) {
    return [];
  }
  const copies: OperatorBotDecision[] = [];
  for (const decision of decisions) {
    copies.push(copyDecision(decision));
  }
  return copies;
}

/**
 * Evicts the oldest-inserted matches until the match cap holds.
 */
function evictOldestMatches(): void {
  while (decisionsByMatch.size > OPERATOR_BOT_DECISION_MATCH_CAP) {
    const oldestMatchId = decisionsByMatch.keys().next().value;
    if (oldestMatchId === undefined) {
      return;
    }
    decisionsByMatch.delete(oldestMatchId);
  }
}

/**
 * Copies a decision so neither the caller nor a reader can alias the record.
 *
 * @param decision - The decision to copy.
 * @returns A copy with a fresh `move` object and `decisionLog` array.
 */
function copyDecision(decision: OperatorBotDecision): OperatorBotDecision {
  return {
    turn: decision.turn,
    seat: decision.seat,
    isForced: decision.isForced,
    move: { name: decision.move.name, args: decision.move.args },
    decisionLog: [...decision.decisionLog],
    legalMoveCount: decision.legalMoveCount,
  };
}
