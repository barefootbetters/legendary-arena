/**
 * Granting Man Out of Time to a Hero in hand for the turn (WP-828 / D-24761).
 *
 * Winter Soldier's 2>4 — "A Hero in your hand gains [keyword:Man Out of Time] this turn." and
 * "[hc:tech]: Another Hero in your hand gains [keyword:Man Out of Time] this turn." Each line
 * owes one grant: its `grant-out-of-time` handler appends `{ playerID, sourceCardId }` to
 * G.pendingOutOfTimeGrants. The play-phase onMove opener then resolves the queue front to
 * back: no eligible Hero → a logged no-op; exactly one → granted with no prompt; two or more
 * → the player picks through a WP-684 seat choice (kind 'out-of-time-grant'), one grant at a
 * time. A granted card is listed in G.outOfTimeGrantedThisTurn; when it is played this turn,
 * applyCardPlay sets it aside Out of Time after its abilities, through the WP-803 `out-of-time`
 * handler and its guards.
 *
 * "Another Hero" (the second line) is honored by excluding Heroes already granted this turn
 * from every grant's choices. Both queue and grant list are lazily created and deleted at
 * turn start (game.ts onBegin + applyOnBeginParity). Plain G-mutating helpers; no
 * boardgame.io import, no registry, no .reduce(), never throws.
 */

import type { LegendaryGameState, PendingSeatChoice, SeatChoiceOption } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { WOUND_EXT_ID, BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import { hasAnyPendingChoice } from './phaseCard.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { parkSeatChoice } from './seatChoice.resolve.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef, resolveCardName } from '../log/logDisplay.js';
import { executeSingleEffect } from '../hero/heroEffects.execute.js';

/** The seat-choice kind discriminant for choosing the Hero that gains Man Out of Time. */
export const OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND = 'out-of-time-grant';

/**
 * Minimal boardgame.io events surface parkSeatChoice reads. Optional: the grant is always
 * the active player's own choice, so no stage ride is needed.
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/**
 * Records one owed grant for the card's line (the `grant-out-of-time` handler's whole job).
 *
 * // why: D-24761 — the choice cannot be made inside executeHeroEffects: both 2>4 lines run in
 * the same call, and the second ("Another Hero") must exclude the first's pick. Queuing the
 * grants and resolving them one at a time after the play makes the exclusion exact.
 *
 * @param G - The game state, mutated in place (queue appended, lazily created).
 * @param playerID - The player whose hand Hero gains Man Out of Time.
 * @param sourceCardId - The card whose ability grants it.
 */
export function queueOutOfTimeGrant(
  G: LegendaryGameState,
  playerID: string,
  sourceCardId: CardExtId,
): void {
  if (G.pendingOutOfTimeGrants === undefined) {
    G.pendingOutOfTimeGrants = [];
  }
  G.pendingOutOfTimeGrants.push({ playerID, sourceCardId });
}

/**
 * The Heroes in the player's hand that may gain Man Out of Time: every hand card except a
 * Wound or a Bystander (the engine's "not a Hero" discriminant), minus cards already granted
 * this turn ("Another Hero in your hand").
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose hand is read.
 * @returns Eligible hand card ids, in hand order.
 */
function eligibleGrantHeroes(G: LegendaryGameState, playerID: string): CardExtId[] {
  const hand = G.playerZones[playerID]?.hand ?? [];
  const granted = G.outOfTimeGrantedThisTurn ?? [];
  const eligible: CardExtId[] = [];
  for (const cardId of hand) {
    if (isHeroCard(cardId) && !granted.includes(cardId) && !eligible.includes(cardId)) {
      eligible.push(cardId);
    }
  }
  return eligible;
}

/**
 * Whether a hand card is a Hero (not a Wound or a Bystander).
 *
 * @param cardId - The hand card.
 * @returns true for a Hero card.
 */
function isHeroCard(cardId: CardExtId): boolean {
  return cardId !== WOUND_EXT_ID && cardId !== BYSTANDER_EXT_ID;
}

/**
 * Grants Man Out of Time for this turn to one hand Hero and logs it.
 *
 * @param G - The game state, mutated in place (grant list appended, lazily created).
 * @param playerID - The granting player.
 * @param cardId - The hand Hero that gains Man Out of Time.
 * @param sourceCardId - The card whose ability granted it.
 */
function grantOutOfTime(
  G: LegendaryGameState,
  playerID: string,
  cardId: CardExtId,
  sourceCardId: CardExtId,
): void {
  if (G.outOfTimeGrantedThisTurn === undefined) {
    G.outOfTimeGrantedThisTurn = [];
  }
  G.outOfTimeGrantedThisTurn.push(cardId);
  pushLog(G,
    `Player ${playerID}'s ${formatCardRef(G.cardDisplayData, cardId)} gains Man Out of Time this turn (${formatCardRef(G.cardDisplayData, sourceCardId)}).`,
    'applied',
    sourceCardId,
  );
}

/**
 * Opens the front owed grant as the active player's seat choice, resolving every grant that
 * needs no choice (no eligible Hero, or exactly one) on the way.
 *
 * Called from the play-phase onMove after every move. A no-op while any other choice is open
 * or the match is decided; resolves the queue front to back and stops at the first grant that
 * needs a pick.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move context's boardgame.io events (passed through to parkSeatChoice).
 * @param currentPlayer - The active player id; the addressed seat is never stage-ridden then.
 */
export function openOutOfTimeGrantSeatChoiceIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer?: string,
): void {
  const queue = G.pendingOutOfTimeGrants;
  if (queue === undefined || isAnotherChoiceOpenOrMatchOver(G)) {
    return;
  }
  while (queue.length > 0) {
    const front = queue[0]!;
    const eligible = eligibleGrantHeroes(G, front.playerID);
    if (eligible.length >= 2) {
      parkSeatChoice(G, events, buildGrantChoice(G, front.playerID, eligible), currentPlayer);
      return;
    }
    if (eligible.length === 1) {
      grantOutOfTime(G, front.playerID, eligible[0]!, front.sourceCardId);
    } else {
      pushLog(G,
        `Player ${front.playerID} has no Hero left in hand to gain Man Out of Time (${formatCardRef(G.cardDisplayData, front.sourceCardId)}).`,
        'neutral',
        front.sourceCardId,
      );
    }
    queue.shift();
  }
  delete G.pendingOutOfTimeGrants;
}

/**
 * Whether the opener must wait: another choice is open, or the match is already decided.
 *
 * // why: D-24761 — the escape-opener precedent (villainEscapeProcedure.ts): never park a grant
 * choice on top of another open choice (Steal Abilities can queue a grant while it parks one),
 * and never after the match ends. hasAnyPendingChoice covers G.pendingSeatChoice but not
 * G.pendingHeroChoice, so both are checked.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the opener must leave the queue for a later move.
 */
function isAnotherChoiceOpenOrMatchOver(G: LegendaryGameState): boolean {
  if (G.pendingSeatChoice !== undefined || hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined) {
    return true;
  }
  return evaluateEndgame(G) !== null;
}

/**
 * Builds the one-seat choice listing each eligible hand Hero (label = card name, `cardId`
 * carried on the option, the Monarch's Decree pattern).
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The choosing (active) player.
 * @param eligible - The eligible hand Heroes, in hand order.
 * @returns The pending seat choice; the timeout default is the first listed Hero.
 */
function buildGrantChoice(
  G: LegendaryGameState,
  playerID: string,
  eligible: readonly CardExtId[],
): PendingSeatChoice {
  const options: SeatChoiceOption[] = [];
  for (const cardId of eligible) {
    options.push({ label: resolveCardName(G.cardDisplayData, cardId), cardId });
  }
  return {
    kind: OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND,
    addressedSeats: [playerID],
    seatPrompts: { [playerID]: { options } },
    submissions: {},
    // why: D-24761 — the grant is mandatory ("A Hero in your hand gains …"), so the timeout
    // default grants the first listed Hero rather than nothing.
    defaultOptionIndex: 0,
  };
}

/**
 * Applies a submitted grant choice: the chosen hand Hero gains Man Out of Time for this turn
 * and the front owed grant leaves the queue. The next owed grant opens on the next onMove.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted 'out-of-time-grant' seat choice.
 */
export function applyOutOfTimeGrantResolvedSeatChoice(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
): void {
  const queue = G.pendingOutOfTimeGrants;
  const seat = choice.addressedSeats[0];
  if (queue === undefined || queue.length === 0 || seat === undefined) {
    return;
  }
  const front = queue[0]!;
  const submission = choice.submissions[seat];
  const cardId = submission === undefined
    ? undefined
    : choice.seatPrompts[seat]?.options[submission.optionIndex]?.cardId;
  // why: the chosen card must still be in hand (the block-all guard froze the board, so it is).
  if (cardId !== undefined && G.playerZones[seat]?.hand.includes(cardId) === true) {
    grantOutOfTime(G, seat, cardId, front.sourceCardId);
  }
  queue.shift();
  if (queue.length === 0) {
    delete G.pendingOutOfTimeGrants;
  }
}

/**
 * Sets a just-played card aside Out of Time when it was granted Man Out of Time this turn.
 *
 * Called at the end of applyCardPlay, after the card's own abilities. Reuses the WP-803
 * `out-of-time` handler (through executeSingleEffect), so its guards hold. A card that already
 * went Out of Time this turn (its own printed keyword, the turn-2 replay, or an earlier copy
 * sharing its id) is skipped silently, so it is never logged twice; so is a card its own
 * ability already moved out of play (it is no longer the last card in play).
 *
 * @param G - The game state, mutated in place.
 * @param context - The move context rest (forwarded to the handler; unused by it).
 * @param playerID - The player who played the card.
 * @param cardId - The card just played.
 */
export function applyGrantedOutOfTime(
  G: LegendaryGameState,
  context: unknown,
  playerID: string,
  cardId: CardExtId,
): void {
  if (G.outOfTimeGrantedThisTurn?.includes(cardId) !== true) {
    return;
  }
  if (G.turnEconomy?.outOfTimePlayedCardIds?.includes(cardId) === true) {
    return;
  }
  const inPlay = G.playerZones[playerID]?.inPlay ?? [];
  if (inPlay[inPlay.length - 1] !== cardId) {
    return;
  }
  executeSingleEffect(G, context, playerID, cardId, { type: 'out-of-time' });
}
