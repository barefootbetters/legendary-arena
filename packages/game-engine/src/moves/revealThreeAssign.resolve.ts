/**
 * resolveRevealThreeAssign move — resolves a pending reveal-three draw / discard / KO
 * assignment (WP-753 / D-24580).
 *
 * Called by the ACTIVE player after a `reveal-three-assign` card ("Reveal the top three
 * cards of your deck. Draw one of them, discard one, and KO one." — Crystal of Kadavus,
 * Interplanetary Visitor) snapshotted the top `min(3, deck.length)` cards of their deck and
 * parked a PendingRevealThreeAssign. The player assigns ONE revealed card a disposition per
 * call:
 *   'draw'    — move that deck-top card into the player's hand (a printed draw, so it counts
 *               toward `turnEconomy.cardsDrawn`), unless the draw lock is armed (D-24552);
 *   'discard' — move that deck-top card to the player's discard pile;
 *   'ko'      — KO that deck-top card (to the general KO pile).
 * Each resolved card is dropped from `revealedCardIds` and its slot from
 * `availableDispositions`. When `revealedCardIds` empties the entry either re-reveals a fresh
 * top three (`remainingRepeats > 0` — Crystal's "Do this ability again.") or front-pops.
 *
 * Also exports the shared top-up + snapshot step (used by the park handler AND the repeat
 * re-reveal), the block-all predicate, and the deterministic bot/sim default assignment.
 *
 * All invalid states are silent no-ops (moves never throw). The queue is left byte-identical
 * on every no-op so the player can resubmit.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type {
  LegendaryGameState,
  PendingRevealThreeAssign,
  RevealThreeAssignDisposition,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { moveCardFromZone } from './zoneOps.js';
import { reshuffleDiscardIntoDeck } from './drawCards.logic.js';
import { koCard } from '../board/ko.logic.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';
import { isCullableDeckTopCard } from '../villain/villainEffects.execute.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveRevealThreeAssign move.
 *
 * cardId — the revealed deck-top ext_id to assign (must be one of the front pending entry's
 *   `revealedCardIds` snapshot; the round-trip rule).
 * disposition — 'draw' | 'discard' | 'ko' (must be one of the front entry's still-unused
 *   `availableDispositions`).
 */
export interface ResolveRevealThreeAssignArgs {
  cardId: CardExtId;
  disposition: RevealThreeAssignDisposition;
}

/** One bot/sim assignment step: which revealed card gets which disposition. */
export interface RevealThreeAssignment {
  cardId: CardExtId;
  disposition: RevealThreeAssignDisposition;
}

// why: the printed "Reveal the top three cards of your deck." — the reveal window size.
export const REVEAL_THREE_ASSIGN_COUNT = 3;

// why: the closed disposition vocabulary, written out so the arg validation is a boring
// explicit membership check (no dynamic key access). This is also the order every fresh
// entry offers its slots in (all three, always — D-24580 short-reveal rule).
const VALID_DISPOSITIONS: readonly RevealThreeAssignDisposition[] = ['draw', 'discard', 'ko'];

/**
 * Whether any reveal-three assignment is currently pending.
 *
 * Single predicate imported by the turn-end guards (endTurn, advanceStage) and the block-all
 * action-move guards. `undefined` and `[]` both mean no pending choice (mirrors
 * hasPendingRuthlessDictatorChoice, D-24007).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending-reveal-three-assign queue holds at least one entry.
 */
export function hasPendingRevealThreeAssign(G: LegendaryGameState): boolean {
  return (G.pendingRevealThreeAssign?.length ?? 0) > 0;
}

/**
 * Builds the fresh slot list every new reveal offers: all three dispositions.
 *
 * @returns a NEW ['draw', 'discard', 'ko'] array (never aliased between entries).
 */
export function buildAllRevealThreeAssignDispositions(): RevealThreeAssignDisposition[] {
  return [...VALID_DISPOSITIONS];
}

/**
 * Reveals (SNAPSHOTS) the top three cards of a player's deck for a reveal-three assignment,
 * topping the deck up from the discard first when it holds fewer than three cards.
 *
 * // why: D-24285 — the printed text says "Reveal", so a short deck is topped up from the
 * shuffled discard before the reveal (reshuffleDiscardIntoDeck APPENDS beneath the cards
 * still on top), unlike Ruthless Dictator's "Look at" which never reshuffles. The snapshot is
 * a COPY and removes nothing; the block-all guard freezes the deck top while the choice is
 * pending and the resolve move moves each card. Shared by the park handler and the resolve
 * move's repeat re-reveal so both run exactly the same top-up + snapshot steps.
 *
 * @param G - Game state (mutated only by a possible top-up reshuffle).
 * @param playerID - The player whose deck top to reveal.
 * @param shuffleContext - ShuffleProvider for the top-up reshuffle (ctx.random).
 * @returns the revealed ext_ids in deck order (0–3 entries; empty when nothing is left).
 */
export function revealTopThreeForAssign(
  G: LegendaryGameState,
  playerID: string,
  shuffleContext: ShuffleProvider,
): CardExtId[] {
  const zones = G.playerZones[playerID];
  if (!zones) { return []; }
  if (zones.deck.length < REVEAL_THREE_ASSIGN_COUNT) {
    reshuffleDiscardIntoDeck(zones, shuffleContext);
  }
  const revealCount = Math.min(REVEAL_THREE_ASSIGN_COUNT, zones.deck.length);
  return zones.deck.slice(0, revealCount);
}

/**
 * Whether `disposition` is one of the closed 'draw' | 'discard' | 'ko' vocabulary.
 *
 * @param disposition - The candidate disposition string.
 * @returns true when it is a valid RevealThreeAssignDisposition.
 */
function isValidDisposition(disposition: unknown): disposition is RevealThreeAssignDisposition {
  // why: explicit membership scan — keeps the validation boring and obviously correct.
  for (const candidate of VALID_DISPOSITIONS) {
    if (candidate === disposition) {
      return true;
    }
  }
  return false;
}

/**
 * Finds the index of `target` in `values`, or -1 when absent.
 *
 * @param values - The array to scan.
 * @param target - The value to find.
 * @returns the first matching index, or -1.
 */
function findIndexOf<T>(values: readonly T[], target: T): number {
  for (let index = 0; index < values.length; index++) {
    if (values[index] === target) {
      return index;
    }
  }
  return -1;
}

/**
 * Whether `cardId` still sits within the revealed window at the top of the player's deck.
 *
 * // why: the block-all guard freezes the deck, but a same-play sibling ability (executeHeroEffects
 * runs a card's abilities synchronously after the park, D-24521 §6) can move a revealed card
 * before the player assigns it. Checking the top REVEAL_THREE_ASSIGN_COUNT cards (not the whole
 * deck) keeps a deeper copy of a shared starter ext_id from standing in for the moved card.
 *
 * @param deck - The player's current deck.
 * @param cardId - The revealed card to look for.
 * @returns true when the card is still in the revealed window.
 */
function isCardInRevealWindow(deck: readonly CardExtId[], cardId: CardExtId): boolean {
  const windowSize = Math.min(REVEAL_THREE_ASSIGN_COUNT, deck.length);
  for (let index = 0; index < windowSize; index++) {
    if (deck[index] === cardId) {
      return true;
    }
  }
  return false;
}

/**
 * Applies one validated disposition to a revealed card that is still in the reveal window.
 *
 * @param G - Game state (mutated).
 * @param playerID - The assigning (active) player.
 * @param cardId - The revealed card to move.
 * @param disposition - Where it goes.
 */
function applyRevealThreeDisposition(
  G: LegendaryGameState,
  playerID: string,
  cardId: CardExtId,
  disposition: RevealThreeAssignDisposition,
): void {
  const zones = G.playerZones[playerID];
  if (!zones) { return; }
  const cardName = resolveCardName(G.cardDisplayData, cardId);

  if (disposition === 'draw') {
    // why: D-24552 — Venompool's Shenanigans draw lock blocks every hero-effect draw for the
    // rest of the turn. The card stays on the deck; the draw slot is still consumed (the
    // printed assignment happened, the draw simply could not), and nothing is counted.
    if (G.turnEconomy.drawsLocked === true) {
      pushLog(G,
        `Player ${playerID} can't draw ${cardName} (${cardId}) — no more draws this turn; it stays on top of their deck (reveal three).`,
        'blocked',
        cardId,
      );
      return;
    }
    const moveResult = moveCardFromZone(zones.deck, zones.hand, cardId);
    if (!moveResult.found) { return; }
    zones.deck = moveResult.from;
    zones.hand = moveResult.to;
    // why: a printed "Draw one of them" is a realized draw, counted exactly like heroEffectDraw
    // so the `cardsDrawnThisTurnAtLeast` wait-and-see gate sees it.
    G.turnEconomy.cardsDrawn += 1;
    pushLog(G,
      `Player ${playerID} drew ${cardName} (${cardId}) from the top of their deck (reveal three).`,
      'applied',
      cardId,
    );
    return;
  }

  if (disposition === 'discard') {
    const moveResult = moveCardFromZone(zones.deck, zones.discard, cardId);
    if (!moveResult.found) { return; }
    zones.deck = moveResult.from;
    zones.discard = moveResult.to;
    pushLog(G,
      `Player ${playerID} discarded ${cardName} (${cardId}) from the top of their deck (reveal three).`,
      'applied',
      cardId,
    );
    return;
  }

  const moveResult = moveCardFromZone(zones.deck, [], cardId);
  if (!moveResult.found) { return; }
  zones.deck = moveResult.from;
  G.ko = koCard(G.ko, cardId);
  pushLog(G,
    `Player ${playerID} KO'd ${cardName} (${cardId}) from the top of their deck (reveal three).`,
    'applied',
    cardId,
  );
}

/**
 * Completes the FRONT entry once its revealed cards are all assigned: re-reveals a fresh top
 * three when a repeat is owed, otherwise front-pops.
 *
 * // why: D-24580 — the repeat re-reveal runs ONLY the top-up + snapshot steps
 * (revealTopThreeForAssign). It must never call heroEffectRevealThreeAssign: that handler bumps
 * an entry already queued for the player, which would hit this emptied front and leave an empty
 * prompt frozen on screen. An empty re-reveal (deck + discard exhausted) simply front-pops.
 *
 * @param G - Game state (mutated).
 * @param queue - The pending queue (its front is the emptied entry).
 * @param front - The emptied front entry.
 * @param shuffleContext - ShuffleProvider for the top-up reshuffle.
 */
function completeFrontEntry(
  G: LegendaryGameState,
  queue: PendingRevealThreeAssign[],
  front: PendingRevealThreeAssign,
  shuffleContext: ShuffleProvider,
): void {
  if (front.remainingRepeats <= 0) {
    queue.shift();
    return;
  }
  const revealedCardIds = revealTopThreeForAssign(G, front.playerID, shuffleContext);
  if (revealedCardIds.length === 0) {
    pushLog(G,
      `Player ${front.playerID} had no cards left to reveal for the repeat (reveal three).`,
      'blocked',
    );
    queue.shift();
    return;
  }
  queue[0] = {
    choiceType: 'reveal-three-assign',
    playerID: front.playerID,
    sourceCardId: front.sourceCardId,
    revealedCardIds,
    availableDispositions: buildAllRevealThreeAssignDispositions(),
    remainingRepeats: front.remainingRepeats - 1,
  };
  pushLog(G,
    `Player ${front.playerID} reveals the next ${String(revealedCardIds.length)} card(s) of their deck — assign draw / discard / KO again (reveal three).`,
    'neutral',
  );
}

/**
 * Resolves ONE revealed card of the FRONT pending reveal-three assignment.
 *
 * Validate args → validate the front entry (playerID / choiceType) → find the card in
 * `revealedCardIds` and the disposition in `availableDispositions` (round-trip rule) → apply
 * it (or drop a stale card whose deck position a sibling effect already changed) → splice the
 * card and the slot → when the snapshot empties, re-reveal (repeat owed) or front-pop. Silent
 * no-ops: empty/non-string cardId; invalid disposition; empty queue; front.playerID mismatch;
 * front.choiceType mismatch; cardId not revealed; disposition already used.
 *
 * @param context - boardgame.io move context with G, playerID and random.
 * @param args - the { cardId, disposition } decision for one revealed card.
 */
export function resolveRevealThreeAssign(
  { G, playerID, ...context }: MoveContext,
  args: ResolveRevealThreeAssignArgs,
): void {
  // Step 1: Validate args.
  if (typeof args.cardId !== 'string' || args.cardId.length === 0) { return; }
  if (!isValidDisposition(args.disposition)) { return; }

  // Step 2: Validate the front pending entry — only the submitting seat that owns it may resolve.
  const queue = G.pendingRevealThreeAssign;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }
  if (front.choiceType !== 'reveal-three-assign') { return; }

  // Step 3: Round-trip validation against the snapshot and the unused slots.
  const cardIndex = findIndexOf(front.revealedCardIds, args.cardId);
  if (cardIndex === -1) { return; }
  const dispositionIndex = findIndexOf(front.availableDispositions, args.disposition);
  if (dispositionIndex === -1) { return; }

  const zones = G.playerZones[playerID];
  if (!zones) { return; }

  // Step 4: Apply, or drop a stale card.
  if (isCardInRevealWindow(zones.deck, args.cardId)) {
    applyRevealThreeDisposition(G, playerID, args.cardId, args.disposition);
  } else {
    // why: a same-play sibling ability moved this revealed card before the player assigned it.
    // The assignment is moot — drop the card AND the submitted slot with a neutral log instead
    // of leaving an unresolvable entry the bot (or the player) would loop on forever.
    pushLog(G,
      `Player ${playerID}'s ${args.disposition} assignment for ${resolveCardName(G.cardDisplayData, args.cardId)} (${args.cardId}) had no effect — the card had already left the top of their deck (reveal three).`,
      'neutral',
      args.cardId,
    );
  }

  // Step 5: "Draw one, discard one, and KO one" — each card and each slot is used once.
  front.revealedCardIds.splice(cardIndex, 1);
  front.availableDispositions.splice(dispositionIndex, 1);

  // Step 6: When the snapshot empties (after an applied OR a stale step) the entry completes;
  // unused slots of a short reveal are discarded with it.
  if (front.revealedCardIds.length === 0) {
    completeFrontEntry(G, queue, front, context as unknown as ShuffleProvider);
  }
}

/**
 * Whether `disposition` is still an unused slot of the entry.
 *
 * @param entry - The pending entry.
 * @param disposition - The slot to test.
 * @returns true when the slot is still available.
 */
function hasSlot(entry: PendingRevealThreeAssign, disposition: RevealThreeAssignDisposition): boolean {
  return findIndexOf(entry.availableDispositions, disposition) !== -1;
}

/**
 * Deterministic bot/sim default for ONE step of a reveal-three assignment (WP-753 / D-24580).
 *
 * Order: when the KO slot is open and a Wound or basic S.H.I.E.L.D. starter is revealed
 * (isCullableDeckTopCard), KO it (thinning the deck for good); otherwise, when the draw slot is
 * open, draw the highest-cost revealed card (ties keep revealed order); otherwise, when the
 * discard slot is open, discard the first remaining card; otherwise KO it. Used only by the sim
 * dispatch (ai.legalMoves), so bot / replay / PAR runs resolve these cards deterministically.
 *
 * @param G - Game state (read-only; supplies cardStats for the cost read).
 * @param entry - The FRONT pending entry (non-empty revealedCardIds).
 * @returns the { cardId, disposition } step, or null when the entry has nothing left.
 */
export function selectDefaultRevealThreeAssignment(
  G: LegendaryGameState,
  entry: PendingRevealThreeAssign,
): RevealThreeAssignment | null {
  const firstCardId = entry.revealedCardIds[0];
  if (firstCardId === undefined) { return null; }

  if (hasSlot(entry, 'ko')) {
    for (const cardId of entry.revealedCardIds) {
      if (isCullableDeckTopCard(cardId)) {
        return { cardId, disposition: 'ko' };
      }
    }
  }

  if (hasSlot(entry, 'draw')) {
    let bestCardId = firstCardId;
    let bestCost = G.cardStats[firstCardId]?.cost ?? 0;
    for (const cardId of entry.revealedCardIds) {
      const cost = G.cardStats[cardId]?.cost ?? 0;
      // why: strictly greater — ties keep the earlier revealed card (deterministic order).
      if (cost > bestCost) {
        bestCardId = cardId;
        bestCost = cost;
      }
    }
    return { cardId: bestCardId, disposition: 'draw' };
  }

  if (hasSlot(entry, 'discard')) {
    return { cardId: firstCardId, disposition: 'discard' };
  }

  return { cardId: firstCardId, disposition: 'ko' };
}
