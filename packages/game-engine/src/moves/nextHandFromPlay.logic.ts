/**
 * Adding a 0-cost card you played this turn to your next hand (WP-870 / D-24815).
 *
 * Mandarin's Rings Zero, The Ice Blast — "Fight: Choose a card you played this turn that costs
 * 0. When you draw a new hand of cards at the end of this turn, add that card to your hand as an
 * extra card." The villain handler appends `{ playerID, sourceCardId }` to
 * G.pendingNextHandFromPlayPicks. The play-phase onMove opener (and the rebuilt sim / PAR /
 * fixture loops, which never run onMove) then resolves the queue front to back: no eligible card
 * → a logged no-op; exactly one distinct card → recorded with no prompt; two or more → the
 * player picks through a WP-684 seat choice (kind 'next-hand-from-play'), one pick at a time.
 *
 * The pick is RECORDED, never moved: the card stays in play for the rest of the turn, goes to
 * the discard at cleanup, and comes back after the new-hand fill through the shipped D-24797
 * set-aside and the D-24512 consume (G.deferredHandInjections), the Electromagnetic Bubble's
 * path. The queue is lazily created and deleted when it drains, at turn start (game.ts onBegin
 * + applyOnBeginParity) and at game end (D-24518). Plain G-mutating helpers; no boardgame.io
 * import, no registry, no .reduce(), never throws.
 */

import type { LegendaryGameState, PendingSeatChoice, SeatChoiceOption } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
// why: WP-870 / D-24815 — runtime-safe import cycles, the outOfTimeGrant.logic.ts /
// revealOrWoundChoice.logic.ts shape: seatChoice.resolve imports this module's applier and kind
// for its dispatch while this module imports parkSeatChoice from it; and phaseCard →
// playVillainTop.resolve → villainDeck.reveal → villainEffects.execute (which imports
// queueNextHandFromPlayPick) → this module → phaseCard (hasAnyPendingChoice). Every imported
// binding is read only inside a function body, never at module top level, and this module's own
// constants are literals, so ESM resolves each binding by call time. This module never imports
// villainEffects.execute.
import { parkSeatChoice } from './seatChoice.resolve.js';
import { hasAnyPendingChoice } from './phaseCard.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef, resolveCardName } from '../log/logDisplay.js';

/** The seat-choice kind discriminant for choosing the played 0-cost card Zero adds to the next hand. */
export const NEXT_HAND_FROM_PLAY_SEAT_CHOICE_KIND = 'next-hand-from-play';

/**
 * Minimal boardgame.io events surface parkSeatChoice reads. Optional: the pick is always the
 * active player's own choice, so no stage ride is needed.
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/**
 * Records one owed next-hand pick for a defeated Zero (the villain handler's whole job).
 *
 * // why: D-24815 — the villain executor has no boardgame.io events, so it cannot park the
 * seat choice; the pick is queued here and opened by the play-phase onMove opener (the
 * D-24750 / D-24779 precedent).
 *
 * @param G - The game state, mutated in place (queue appended, lazily created).
 * @param playerID - The defeating player who picks one of their played 0-cost cards.
 * @param sourceCardId - The defeated Zero copy that owes the pick.
 */
export function queueNextHandFromPlayPick(
  G: LegendaryGameState,
  playerID: string,
  sourceCardId: CardExtId,
): void {
  // why: lazily created at the first write, never seeded, so a match without Zero serializes
  // byte-identically (no hash-oracle re-pin).
  if (G.pendingNextHandFromPlayPicks === undefined) {
    G.pendingNextHandFromPlayPicks = [];
  }
  G.pendingNextHandFromPlayPicks.push({ playerID, sourceCardId });
}

/**
 * Whether a played card costs 0 for Zero's pick.
 *
 * // why: D-24815 — a local helper, not `isZeroCostCard` (moves/resolveReturnZeroCostDiscard.ts
 * treats a missing G.cardStats entry as 0) and not the villain executor's private
 * resolveRevealedDeckTopCost (importing that executor would cycle back here). Zero's
 * eligibility is stricter on purpose: a played card with no stats entry has no known cost and is
 * not eligible (a Wound is never played, so the Wound-costs-0 rule does not arise).
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The in-play card.
 * @returns true when the card's printed cost is 0.
 */
function isPlayedCardZeroCost(G: LegendaryGameState, cardId: CardExtId): boolean {
  return G.cardStats[cardId]?.cost === 0;
}

/**
 * Counts how many times `cardId` occurs in a list.
 *
 * @param cardIds - The list to scan.
 * @param cardId - The id to count.
 * @returns The occurrence count.
 */
function countOccurrences(cardIds: readonly CardExtId[], cardId: CardExtId): number {
  let count = 0;
  for (const listedCardId of cardIds) {
    if (listedCardId === cardId) {
      count += 1;
    }
  }
  return count;
}

/**
 * The player's in-play 0-cost cards Zero may still add to the next hand, one per display name.
 *
 * // why: D-24815 — copies are counted, not ids: S.H.I.E.L.D. Agents, Troopers and Wounds share
 * one id each, so a card is eligible while its id occurs more times in play than it is already
 * recorded in G.deferredHandInjections (a second Zero can take a second Agent; a third cannot
 * take a third Agent that was never played). Options are de-duplicated by display name (three
 * Agents are one option; the first eligible instance in play order is kept).
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose cards in play are read.
 * @returns Eligible in-play card ids, one per name, in play order.
 */
function eligiblePlayedZeroCostCards(G: LegendaryGameState, playerID: string): CardExtId[] {
  const inPlay = G.playerZones[playerID]?.inPlay ?? [];
  const alreadyRecorded = G.deferredHandInjections?.[playerID] ?? [];
  const eligible: CardExtId[] = [];
  const eligibleNames: string[] = [];
  for (const cardId of inPlay) {
    if (!isPlayedCardZeroCost(G, cardId)) {
      continue;
    }
    if (countOccurrences(inPlay, cardId) <= countOccurrences(alreadyRecorded, cardId)) {
      continue;
    }
    const cardName = resolveCardName(G.cardDisplayData, cardId);
    if (eligibleNames.includes(cardName)) {
      continue;
    }
    eligibleNames.push(cardName);
    eligible.push(cardId);
  }
  return eligible;
}

/**
 * Records the chosen played card as an extra card for the player's next hand and logs it.
 *
 * // why: duplicated from rules/tacticHandlers.ts recordDeferredHandInjection rather than
 * imported: tacticHandlers imports parkSeatChoice from seatChoice.resolve, which imports this
 * module, so the import would add a cycle through a large module for a four-line lazy-init +
 * push (code-style Rule 1). The card is recorded, not moved: it stays in play until cleanup and
 * returns through the shipped D-24797 set-aside after the new-hand fill.
 *
 * @param G - The game state, mutated in place (injection map lazily created).
 * @param playerID - The player whose next hand gains the card.
 * @param cardId - The in-play card to add.
 * @param sourceCardId - The defeated Zero copy.
 */
function recordNextHandFromPlay(
  G: LegendaryGameState,
  playerID: string,
  cardId: CardExtId,
  sourceCardId: CardExtId,
): void {
  if (G.deferredHandInjections === undefined) {
    G.deferredHandInjections = {};
  }
  if (G.deferredHandInjections[playerID] === undefined) {
    G.deferredHandInjections[playerID] = [];
  }
  G.deferredHandInjections[playerID].push(cardId);
  pushLog(G,
    `Player ${playerID} will add ${formatCardRef(G.cardDisplayData, cardId)} to their next hand as an extra card (${formatCardRef(G.cardDisplayData, sourceCardId)}).`,
    'applied',
    cardId,
  );
}

/**
 * Opens the front owed pick as the active player's seat choice, resolving every pick that needs
 * no choice (no eligible card, or exactly one distinct card) on the way.
 *
 * Called from the play-phase onMove after every move (and from the rebuilt sim / PAR / fixture
 * loops at the same position). A no-op while any other choice is open or the match is decided;
 * resolves the queue front to back and stops at the first pick that needs a choice.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move context's boardgame.io events (passed through to parkSeatChoice).
 * @param currentPlayer - The active player id; the addressed seat is never stage-ridden then.
 */
export function openNextHandFromPlaySeatChoiceIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer?: string,
): void {
  const queue = G.pendingNextHandFromPlayPicks;
  if (queue === undefined || isAnotherChoiceOpenOrMatchOver(G)) {
    return;
  }
  while (queue.length > 0) {
    const front = queue[0]!;
    const eligible = eligiblePlayedZeroCostCards(G, front.playerID);
    if (eligible.length >= 2) {
      parkSeatChoice(G, events, buildNextHandFromPlayChoice(G, front.playerID, eligible), currentPlayer);
      return;
    }
    if (eligible.length === 1) {
      recordNextHandFromPlay(G, front.playerID, eligible[0]!, front.sourceCardId);
    } else {
      pushLog(G,
        `Player ${front.playerID} played no 0-cost card to add to their next hand (${formatCardRef(G.cardDisplayData, front.sourceCardId)}).`,
        'blocked',
        front.sourceCardId,
      );
    }
    queue.shift();
  }
  delete G.pendingNextHandFromPlayPicks;
}

/**
 * Whether the opener must wait: another choice is open, or the match is already decided.
 *
 * // why: D-24815 — the outOfTimeGrant.logic.ts shape: never park a pick on top of another open
 * choice (Spin's reorder or Lightning's KO-or-keep can be parked in the same fight), and never
 * after the match ends. hasAnyPendingChoice covers G.pendingSeatChoice but not
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
 * Builds the one-seat choice listing each eligible played card (label = card name, `cardId`
 * and `sourceZone: 'inPlay'` carried on the option).
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The choosing (active) player.
 * @param eligible - The eligible in-play cards, one per name, in play order.
 * @returns The pending seat choice; the timeout default is the first listed card.
 */
function buildNextHandFromPlayChoice(
  G: LegendaryGameState,
  playerID: string,
  eligible: readonly CardExtId[],
): PendingSeatChoice {
  const options: SeatChoiceOption[] = [];
  for (const cardId of eligible) {
    options.push({ label: resolveCardName(G.cardDisplayData, cardId), cardId, sourceZone: 'inPlay' });
  }
  return {
    kind: NEXT_HAND_FROM_PLAY_SEAT_CHOICE_KIND,
    addressedSeats: [playerID],
    seatPrompts: { [playerID]: { options } },
    submissions: {},
    // why: D-24815 — the pick is mandatory as printed ("Choose a card you played this turn that
    // costs 0"), so there is no decline option and the bot / timeout default takes the first card.
    defaultOptionIndex: 0,
  };
}

/**
 * Applies a submitted pick: the chosen played card is recorded for the next hand and the front
 * owed pick leaves the queue. The next owed pick opens on the next onMove.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted 'next-hand-from-play' seat choice.
 */
export function applyNextHandFromPlayResolvedSeatChoice(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
): void {
  const queue = G.pendingNextHandFromPlayPicks;
  const seat = choice.addressedSeats[0];
  if (queue === undefined || queue.length === 0 || seat === undefined) {
    return;
  }
  const front = queue[0]!;
  const submission = choice.submissions[seat];
  const cardId = submission === undefined
    ? undefined
    : choice.seatPrompts[seat]?.options[submission.optionIndex]?.cardId;
  // why: the chosen card must still be in play (the block-all guard froze the board, so it is).
  if (cardId !== undefined && G.playerZones[seat]?.inPlay.includes(cardId) === true) {
    recordNextHandFromPlay(G, seat, cardId, front.sourceCardId);
  }
  queue.shift();
  if (queue.length === 0) {
    delete G.pendingNextHandFromPlayPicks;
  }
}
