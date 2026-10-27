/**
 * Go Back in Time to Slay Heroes' Ancestors — "Purged from the Timestream" (WP-829 / D-24762).
 *
 * The Cap 75th scheme prints: "Twist: Put a Hero from the HQ next to the Scheme, 'Purged from
 * the Timestream.'" and "Special Rules: Whenever a Hero is in the HQ whose Hero Name has been
 * Purged from the Timestream, KO that Hero." Its loss ("When the Hero Deck runs out") is the
 * existing `pile-depleted` resource condition.
 *
 * Each Twist owes one Purge (the `go-back-in-time` resolver appends to
 * G.pendingTimestreamPurges). The play-phase onMove opener resolves the queue front to back,
 * waiting while another choice is open or the match is decided (the escape-opener precedent,
 * D-24656): an empty HQ → a logged no-op; one Hero → Purged with no prompt; two or more → the
 * active player picks it (a WP-684 seat choice, kind 'timestream-purge', options carrying
 * `cardId`). A Purged Hero leaves the HQ for G.purgedFromTimestream (it is not KO'd) and its
 * slot refills. The "whenever" rule is a sweep: after each Purge and after every move, every HQ
 * Hero whose Hero Name matches a Purged Hero is KO'd and its slot refilled, until none is left.
 *
 * A Hero Name is the Hero deck a card belongs to (`{set}/{hero}`, the first two segments of its
 * ext_id). Plain G-mutating helpers; no boardgame.io import, no registry, no .reduce(), never
 * throws.
 */

import type { LegendaryGameState, PendingSeatChoice, SeatChoiceOption } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { koCard } from '../board/ko.logic.js';
import { refillHqSlot } from '../board/city.logic.js';
import { parkSeatChoice } from '../moves/seatChoice.resolve.js';
import { hasAnyPendingChoice } from '../moves/phaseCard.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { applyPileDepletionResourceLoss } from './schemeResourceLoss.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef, resolveCardName } from '../log/logDisplay.js';

/** The seat-choice kind discriminant for choosing the HQ Hero to Purge. */
export const TIMESTREAM_PURGE_SEAT_CHOICE_KIND = 'timestream-purge';

/**
 * Minimal boardgame.io events surface parkSeatChoice reads. The Purge is the active player's
 * own choice, so no stage ride is needed.
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/**
 * Records one owed Purge for a Scheme Twist (the resolver's whole job).
 *
 * // why: D-24762 — the Twist resolves inside a Villain Deck reveal, where no seat choice can
 * be answered; queuing it and opening it after the move is the escape-procedure shape.
 *
 * @param G - The game state, mutated in place (queue appended, lazily created).
 * @param chooserPlayerID - The active player, who picks the Hero.
 * @param twistCardId - The Twist that owes the Purge.
 */
export function queueTimestreamPurge(
  G: LegendaryGameState,
  chooserPlayerID: string,
  twistCardId: CardExtId,
): void {
  if (G.pendingTimestreamPurges === undefined) {
    G.pendingTimestreamPurges = [];
  }
  G.pendingTimestreamPurges.push({ chooserPlayerID, twistCardId });
}

/**
 * The Hero Name of a Hero card: its Hero deck, the first two segments of its ext_id.
 *
 * @param cardId - A Hero card ext_id (`{set}/{hero}/{card}#{n}`).
 * @returns The `{set}/{hero}` Hero deck id.
 */
export function heroNameOf(cardId: CardExtId): string {
  const segments = cardId.split('/');
  return `${segments[0] ?? ''}/${segments[1] ?? ''}`;
}

/**
 * Whether a card shares its Hero Name with a Purged Hero.
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The HQ card.
 * @returns true when the card's Hero Name has been Purged from the Timestream.
 */
function isPurgedHeroName(G: LegendaryGameState, cardId: CardExtId): boolean {
  const heroName = heroNameOf(cardId);
  for (const purgedCardId of G.purgedFromTimestream ?? []) {
    if (heroNameOf(purgedCardId) === heroName) {
      return true;
    }
  }
  return false;
}

/**
 * KOs every HQ Hero whose Hero Name has been Purged, refilling each slot, until none is left.
 *
 * // why: D-24762 — "Whenever a Hero is in the HQ whose Hero Name has been Purged, KO that
 * Hero." A refill can draw another such Hero, so the scan repeats until a full pass KOs
 * nothing; each KO draws from the finite Hero Deck, so the loop ends. Runs after each Purge and
 * after every move; a no-op until something is Purged.
 *
 * @param G - The game state, mutated in place (HQ, KO pile, Hero Deck).
 * @returns The number of Heroes KO'd.
 */
export function sweepPurgedHeroesFromHq(G: LegendaryGameState): number {
  if ((G.purgedFromTimestream?.length ?? 0) === 0) {
    return 0;
  }
  let koCount = 0;
  let isPassClean = false;
  while (!isPassClean) {
    isPassClean = true;
    for (let slotIndex = 0; slotIndex < G.hq.length; slotIndex++) {
      const cardId = G.hq[slotIndex];
      if (cardId === null || cardId === undefined || !isPurgedHeroName(G, cardId)) {
        continue;
      }
      G.hq[slotIndex] = null;
      G.ko = koCard(G.ko, cardId);
      const refill = refillHqSlot(G.hq, slotIndex, G.heroDeck);
      G.hq = refill.hq;
      G.heroDeck = refill.heroDeck;
      pushLog(G, `[Go Back in Time] ${formatCardRef(G.cardDisplayData, cardId)} was KO'd from the HQ: its Hero was Purged from the Timestream.`, 'threat');
      koCount += 1;
      isPassClean = false;
    }
  }
  return koCount;
}

/**
 * Purges one HQ Hero: it leaves the HQ for the Purged list, its slot refills, and the sweep runs.
 *
 * @param G - The game state, mutated in place.
 * @param cardId - The HQ Hero to Purge.
 * @param chooserPlayerID - The player who chose it (for the log).
 * @returns false when the card is no longer in the HQ (nothing was Purged).
 */
function purgeHeroFromTimestream(G: LegendaryGameState, cardId: CardExtId, chooserPlayerID: string): boolean {
  const slotIndex = G.hq.indexOf(cardId);
  if (slotIndex === -1) {
    return false;
  }
  G.hq[slotIndex] = null;
  if (G.purgedFromTimestream === undefined) {
    G.purgedFromTimestream = [];
  }
  G.purgedFromTimestream.push(cardId);
  const refill = refillHqSlot(G.hq, slotIndex, G.heroDeck);
  G.hq = refill.hq;
  G.heroDeck = refill.heroDeck;
  pushLog(G,
    `[Go Back in Time] Player ${chooserPlayerID} Purged ${formatCardRef(G.cardDisplayData, cardId)} from the Timestream: every other card of its Hero in the HQ is now KO'd.`,
    'threat',
  );
  sweepPurgedHeroesFromHq(G);
  // why: a refill can empty the Hero Deck, the scheme's loss (D-24318); latch it on this move.
  applyPileDepletionResourceLoss(G);
  return true;
}

/**
 * Whether the opener must wait: another choice is open, or the match is already decided.
 *
 * // why: D-24762 — the escape-opener precedent (D-24656): never park a Purge on top of another
 * open choice, and never after the match ends. hasAnyPendingChoice covers G.pendingSeatChoice
 * but not G.pendingHeroChoice, so both are checked.
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
 * The HQ Heroes, in slot order.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns The occupied HQ card ids, left to right.
 */
function listHqHeroes(G: LegendaryGameState): CardExtId[] {
  const heroes: CardExtId[] = [];
  for (const cardId of G.hq) {
    if (cardId !== null && cardId !== undefined) {
      heroes.push(cardId);
    }
  }
  return heroes;
}

/**
 * Opens the front owed Purge as the active player's seat choice, resolving every Purge that
 * needs no choice (an empty HQ, or one Hero) on the way.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move context's boardgame.io events (passed through to parkSeatChoice).
 * @param currentPlayer - The active player id; the addressed seat is never stage-ridden then.
 */
export function openTimestreamPurgeSeatChoiceIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer?: string,
): void {
  const queue = G.pendingTimestreamPurges;
  if (queue === undefined || isAnotherChoiceOpenOrMatchOver(G)) {
    return;
  }
  // why: D-24762 — sweep before listing the HQ, so the pick never offers a Hero the "whenever"
  // rule is about to KO (picking one would Purge nothing). The sweep's refills can empty the
  // Hero Deck, which decides the match: then no Purge is owed any more.
  sweepPurgedHeroesFromHq(G);
  applyPileDepletionResourceLoss(G);
  if (evaluateEndgame(G) !== null) {
    return;
  }
  while (queue.length > 0) {
    const front = queue[0]!;
    const heroes = listHqHeroes(G);
    if (heroes.length >= 2) {
      parkSeatChoice(G, events, buildTimestreamPurgeChoice(G, front.chooserPlayerID, heroes), currentPlayer);
      return;
    }
    if (heroes.length === 1) {
      purgeHeroFromTimestream(G, heroes[0]!, front.chooserPlayerID);
    } else {
      pushLog(G, '[Go Back in Time] No Hero in the HQ to Purge from the Timestream.', 'neutral', front.twistCardId);
    }
    queue.shift();
  }
  delete G.pendingTimestreamPurges;
}

/**
 * Builds the one-seat choice listing each HQ Hero (label = card name and cost, `cardId` on the
 * option, the escape HQ-KO pattern).
 *
 * @param G - The game state to inspect (not mutated).
 * @param chooserPlayerID - The choosing (active) player.
 * @param heroes - The HQ Heroes, in slot order.
 * @returns The pending seat choice; the timeout default is the leftmost Hero.
 */
function buildTimestreamPurgeChoice(
  G: LegendaryGameState,
  chooserPlayerID: string,
  heroes: readonly CardExtId[],
): PendingSeatChoice {
  const options: SeatChoiceOption[] = [];
  for (const cardId of heroes) {
    const cost = G.cardStats[cardId]?.cost ?? 0;
    options.push({ label: `${resolveCardName(G.cardDisplayData, cardId)} (cost ${String(cost)})`, cardId });
  }
  return {
    kind: TIMESTREAM_PURGE_SEAT_CHOICE_KIND,
    addressedSeats: [chooserPlayerID],
    seatPrompts: { [chooserPlayerID]: { options } },
    submissions: {},
    // why: D-24762 — the Purge is mandatory ("Put a Hero from the HQ next to the Scheme"), so
    // the timeout default Purges the leftmost Hero rather than nothing.
    defaultOptionIndex: 0,
  };
}

/**
 * Applies a submitted Purge choice: the chosen HQ Hero is Purged and the front owed Purge leaves
 * the queue. The next owed Purge opens on the next onMove.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted 'timestream-purge' seat choice.
 */
export function applyTimestreamPurgeResolvedSeatChoice(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
): void {
  const queue = G.pendingTimestreamPurges;
  const seat = choice.addressedSeats[0];
  if (queue === undefined || queue.length === 0 || seat === undefined) {
    return;
  }
  const submission = choice.submissions[seat];
  const cardId = submission === undefined
    ? undefined
    : choice.seatPrompts[seat]?.options[submission.optionIndex]?.cardId;
  // why: D-24762 — the Purge is mandatory. If the chosen Hero has left the HQ, the Purge stays
  // owed and the next onMove re-opens it over the HQ as it is now, instead of being lost.
  if (cardId === undefined) {
    return;
  }
  if (!purgeHeroFromTimestream(G, cardId, seat)) {
    pushLog(G, `[Go Back in Time] ${formatCardRef(G.cardDisplayData, cardId)} is no longer in the HQ: the Purge is still owed.`, 'neutral');
    return;
  }
  queue.shift();
  if (queue.length === 0) {
    delete G.pendingTimestreamPurges;
  }
}
