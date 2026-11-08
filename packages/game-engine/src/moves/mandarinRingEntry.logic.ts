/**
 * The Mandarin's Master Strike City entries (WP-875 / D-24822).
 *
 * "Master Strike: Each player chooses a Mandarin's Ring from their Victory Pile to enter the city.
 * Any player who didn't have a Ring gains a Wound instead." The strike arm
 * (`rules/mastermindHandlers.ts` `resolveMandarinStrike`) Wounds each player with no available Ring
 * and queues `{ playerID }` on G.pendingMandarinRingEntries for every other player. This opener,
 * run from the play-phase `turn.onMove` (and mirrored by the rebuilt sim / PAR / fixture loops,
 * which never run `onMove`), settles and drains that queue:
 *
 *   1. Settle: a player's first unchosen entry with no available Ring is dropped (logged); with
 *      exactly one, that Ring is chosen with no prompt; with two or more, the player must choose.
 *   2. Choose: every player who must choose answers ONE simultaneous 'mandarin-ring-entry' seat
 *      choice (each player once). The apply (`mastermind/mandarin.logic.ts`) only records the pick;
 *      the next `onMove` runs this opener again.
 *   3. Drain: once every entry is chosen, the entries leave the queue from the front, in queue
 *      order, and each chosen Ring moves from its owner's Victory Pile into the Sewers. A Villain
 *      it pushes off the Bridge escapes through the full escape procedure.
 *
 * Plain G-mutating helper, NOT a boardgame.io move. No registry import, no boardgame.io import,
 * no .reduce(). Never throws.
 */

import type { LegendaryGameState, PendingMandarinRingEntry, PendingSeatChoice, SeatChoiceOption } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ImplementationMap } from '../rules/ruleRuntime.execute.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';
import { parkSeatChoice } from './seatChoice.resolve.js';
import { hasAnyPendingChoice } from './phaseCard.js';
import { moveCardFromZone } from './zoneOps.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { pushVillainIntoCity } from '../board/city.logic.js';
import { formatCardRef, resolveCardName } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';
// why: the escape a Ring entry causes is a normal escape, so it runs the one escape procedure
// (escape counter, carried Bystanders, the owed HQ KO + Bystander discard, card-text Escape
// effects, the escape → Scheme Twist branch). This module is imported only by game.ts and the
// three rebuilt loops, so the reveal module never imports it back (no module cycle).
import { resolveVillainEscape } from '../villainDeck/villainDeck.reveal.js';
import {
  MANDARIN_RING_ENTRY_SEAT_CHOICE_KIND,
  listMandarinRingsInVictoryPile,
} from '../mastermind/mandarin.logic.js';

/**
 * Minimal boardgame.io events surface parkSeatChoice reads. Optional so a unit / sim / fixture
 * context without a live framework is a guarded no-op (the stage ride is skipped there).
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/** How a drain pass ended. */
type MandarinRingDrainResult = 'drained' | 'endgame' | 'unchosen-front';

/** One player's prompt in the Ring seat choice. */
interface MandarinRingChoiceSeat {
  seat: string;
  rings: CardExtId[];
}

/**
 * Settles, asks for, and enters the owed Mandarin's Ring City entries.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move context's boardgame.io events (for the stage ride), or undefined.
 * @param currentPlayer - The active player id (ctx.currentPlayer, or the loop's active seat).
 * @param revealContext - The reveal context an escape needs (random + ctx with the turn).
 * @param implementationMap - Handler map for the escape → Scheme Twist branch.
 */
export function openMandarinRingEntriesIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer: string | undefined,
  revealContext: RevealContext,
  implementationMap: ImplementationMap,
): void {
  while (G.pendingMandarinRingEntries !== undefined) {
    if (G.pendingMandarinRingEntries.length === 0) {
      delete G.pendingMandarinRingEntries;
      return;
    }
    // why: hasAnyPendingChoice covers an open seat choice but not pendingHeroChoice, so both are
    // checked (the escape / reveal-or-wound opener guard), and a decided match opens nothing. This
    // queue never joins hasAnyPendingChoice: it would then block its own opener.
    if (hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined) {
      return;
    }
    if (evaluateEndgame(G) !== null) {
      return;
    }
    settleMandarinRingEntries(G);
    if (G.pendingMandarinRingEntries === undefined) {
      return;
    }
    const choiceSeats = listMandarinRingChoiceSeats(G);
    if (choiceSeats.length > 0) {
      parkMandarinRingSeatChoice(G, events, choiceSeats, currentPlayer);
      return;
    }
    const drainResult = drainChosenMandarinRingEntries(G, revealContext, implementationMap);
    // why: an escape during the drain can become a Scheme Twist that reveals another Master Strike,
    // which appends new unchosen entries; they are settled in this same call (back to the wait
    // check) so a lone Ring enters now and a real choice is parked now.
    if (drainResult !== 'unchosen-front') {
      return;
    }
  }
}

/**
 * The Rings a player can still send for one queued entry: that player's Victory Pile Rings in
 * pile order, minus the Rings their earlier queued entries already chose.
 *
 * @param G - The game state (read-only).
 * @param queue - The owed entry queue.
 * @param entryIndex - The index of the entry being settled.
 * @returns The available Ring ids, in pile order.
 */
function listAvailableRingsForEntry(
  G: LegendaryGameState,
  queue: readonly PendingMandarinRingEntry[],
  entryIndex: number,
): CardExtId[] {
  const entry = queue[entryIndex]!;
  const zones = G.playerZones[entry.playerID];
  if (zones === undefined) {
    return [];
  }
  const alreadyChosen: CardExtId[] = [];
  for (let index = 0; index < entryIndex; index++) {
    const earlier = queue[index]!;
    if (earlier.playerID === entry.playerID && earlier.chosenCardId !== undefined) {
      alreadyChosen.push(earlier.chosenCardId);
    }
  }
  const available: CardExtId[] = [];
  for (const ringId of listMandarinRingsInVictoryPile(zones.victory)) {
    if (!alreadyChosen.includes(ringId)) {
      available.push(ringId);
    }
  }
  return available;
}

/**
 * Removes the entry at `entryIndex`, rebinding the queue and deleting it once it is empty.
 *
 * @param G - The game state, mutated in place.
 * @param entryIndex - The index to remove.
 */
function removeMandarinRingEntryAt(G: LegendaryGameState, entryIndex: number): void {
  const queue = G.pendingMandarinRingEntries;
  if (queue === undefined) {
    return;
  }
  const remaining: PendingMandarinRingEntry[] = [];
  for (let index = 0; index < queue.length; index++) {
    if (index !== entryIndex) {
      remaining.push(queue[index]!);
    }
  }
  if (remaining.length === 0) {
    delete G.pendingMandarinRingEntries;
    return;
  }
  G.pendingMandarinRingEntries = remaining;
}

/**
 * Runs one settle pass over each player's first unchosen entry.
 *
 * @param G - The game state, mutated in place.
 * @returns true when the pass changed anything (an entry was dropped or a Ring chosen).
 */
function settleMandarinRingEntriesOnce(G: LegendaryGameState): boolean {
  const queue = G.pendingMandarinRingEntries;
  if (queue === undefined) {
    return false;
  }
  const visitedSeats: string[] = [];
  let isChanged = false;
  for (let index = 0; index < queue.length; index++) {
    const entry = queue[index]!;
    if (entry.chosenCardId !== undefined || visitedSeats.includes(entry.playerID)) {
      continue;
    }
    visitedSeats.push(entry.playerID);
    const available = listAvailableRingsForEntry(G, queue, index);
    if (available.length === 0) {
      pushLog(G,
        `[Mandarin Master Strike] Player ${entry.playerID} no longer has a Mandarin's Ring in their Victory Pile, so none enters the City.`,
        'blocked',
      );
      // why: the queue is rebound by the removal, so the pass restarts on the new array.
      removeMandarinRingEntryAt(G, index);
      return true;
    }
    if (available.length === 1) {
      entry.chosenCardId = available[0]!;
      isChanged = true;
    }
  }
  return isChanged;
}

/**
 * Repeats the settle pass until it changes nothing.
 *
 * @param G - The game state, mutated in place.
 */
function settleMandarinRingEntries(G: LegendaryGameState): void {
  let isChanged = settleMandarinRingEntriesOnce(G);
  while (isChanged) {
    isChanged = settleMandarinRingEntriesOnce(G);
  }
}

/**
 * Lists, in queue order and each player once, the players whose first unchosen entry has two or
 * more available Rings.
 *
 * @param G - The game state (read-only).
 * @returns Each player who must choose, with their available Rings in pile order.
 */
function listMandarinRingChoiceSeats(G: LegendaryGameState): MandarinRingChoiceSeat[] {
  const queue = G.pendingMandarinRingEntries;
  const choiceSeats: MandarinRingChoiceSeat[] = [];
  if (queue === undefined) {
    return choiceSeats;
  }
  const visitedSeats: string[] = [];
  for (let index = 0; index < queue.length; index++) {
    const entry = queue[index]!;
    if (entry.chosenCardId !== undefined || visitedSeats.includes(entry.playerID)) {
      continue;
    }
    visitedSeats.push(entry.playerID);
    const available = listAvailableRingsForEntry(G, queue, index);
    if (available.length >= 2) {
      choiceSeats.push({ seat: entry.playerID, rings: available });
    }
  }
  return choiceSeats;
}

/**
 * Parks the one simultaneous Ring seat choice for every player who must choose.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move context's boardgame.io events, or undefined.
 * @param choiceSeats - The players who must choose, in queue order.
 * @param currentPlayer - The active player id, or undefined.
 */
function parkMandarinRingSeatChoice(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  choiceSeats: readonly MandarinRingChoiceSeat[],
  currentPlayer: string | undefined,
): void {
  const addressedSeats: string[] = [];
  const seatPrompts: PendingSeatChoice['seatPrompts'] = {};
  for (const choiceSeat of choiceSeats) {
    addressedSeats.push(choiceSeat.seat);
    const options: SeatChoiceOption[] = [];
    for (const ringId of choiceSeat.rings) {
      options.push({ label: resolveCardName(G.cardDisplayData, ringId), cardId: ringId });
    }
    seatPrompts[choiceSeat.seat] = { options };
    // why: the seat-choice shape has no prompt field, so each chooser is named in the log; the
    // client shows the generic "Your choice" heading over the Ring names.
    pushLog(G,
      `[Mandarin Master Strike] Player ${choiceSeat.seat} chooses which Mandarin's Ring enters the City.`,
      'neutral',
    );
  }
  const choice: PendingSeatChoice = {
    kind: MANDARIN_RING_ENTRY_SEAT_CHOICE_KIND,
    addressedSeats,
    seatPrompts,
    submissions: {},
    defaultOptionIndex: 0,
  };
  // why: D-24743 — skip the stage ride only when the active seat is the sole addressed seat; a
  // mixed ride admits the active seat too, or boardgame.io would refuse its own answer until every
  // other seat had answered.
  const isActiveSeatOnly = addressedSeats.length === 1 && addressedSeats[0] === currentPlayer;
  if (isActiveSeatOnly) {
    parkSeatChoice(G, events, choice, currentPlayer);
  } else {
    parkSeatChoice(G, events, choice);
  }
}

/**
 * Enters the chosen Rings from the front of the queue until it empties, the match is decided, or
 * the front entry is unchosen (a chained strike appended it).
 *
 * // why: D-24780 — the queue was written in turn order from the current player, so draining from
 * the front enters the Rings current player first. Each entry leaves the queue BEFORE its Ring
 * moves, so a strike its escape chains into appends behind the remaining entries and counts the
 * owed Rings exactly.
 *
 * @param G - The game state, mutated in place.
 * @param revealContext - The reveal context an escape needs.
 * @param implementationMap - Handler map for the escape → Scheme Twist branch.
 * @returns Why the drain stopped.
 */
function drainChosenMandarinRingEntries(
  G: LegendaryGameState,
  revealContext: RevealContext,
  implementationMap: ImplementationMap,
): MandarinRingDrainResult {
  while (G.pendingMandarinRingEntries !== undefined && G.pendingMandarinRingEntries.length > 0) {
    if (evaluateEndgame(G) !== null) {
      return 'endgame';
    }
    const front = G.pendingMandarinRingEntries[0]!;
    if (front.chosenCardId === undefined) {
      return 'unchosen-front';
    }
    removeMandarinRingEntryAt(G, 0);
    enterChosenMandarinRing(G, revealContext, implementationMap, front.playerID, front.chosenCardId);
  }
  if (G.pendingMandarinRingEntries !== undefined) {
    delete G.pendingMandarinRingEntries;
  }
  return 'drained';
}

/**
 * Moves one chosen Ring from its owner's Victory Pile into City space 0 (the Sewers).
 *
 * // why: D-24811 — a Ring re-entering from a Victory Pile is NOT a reveal: no Ambush and no
 * onCardRevealed hooks fire (a Ring prints no Ambush anyway). The entry runs here, not in the
 * seat-choice apply, because a pushed-out Villain's escape needs the RevealContext (the turn) and
 * the implementation map, which only the onMove opener and the rebuilt loops hold.
 *
 * @param G - The game state, mutated in place.
 * @param revealContext - The reveal context an escape needs.
 * @param implementationMap - Handler map for the escape → Scheme Twist branch.
 * @param playerID - The Ring's owner.
 * @param ringId - The chosen Ring instance.
 */
function enterChosenMandarinRing(
  G: LegendaryGameState,
  revealContext: RevealContext,
  implementationMap: ImplementationMap,
  playerID: string,
  ringId: CardExtId,
): void {
  const zones = G.playerZones[playerID];
  if (zones === undefined || !zones.victory.includes(ringId)) {
    pushLog(G,
      `[Mandarin Master Strike] Player ${playerID}'s ${formatCardRef(G.cardDisplayData, ringId)} is no longer in their Victory Pile, so it does not enter the City.`,
      'blocked',
    );
    return;
  }
  const moved = moveCardFromZone(zones.victory, [], ringId);
  zones.victory = moved.from;
  const pushResult = pushVillainIntoCity(G.city, ringId);
  G.city = pushResult.city;
  pushLog(G,
    `[Mandarin Master Strike] Player ${playerID}'s ${formatCardRef(G.cardDisplayData, ringId)} entered the City from their Victory Pile.`,
    'threat',
  );
  if (pushResult.escapedCard !== null) {
    resolveVillainEscape(G, revealContext, implementationMap, pushResult.escapedCard);
  }
}
