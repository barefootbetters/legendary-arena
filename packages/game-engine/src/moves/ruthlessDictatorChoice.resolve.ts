/**
 * resolveRuthlessDictatorChoice move — resolves a pending Red Skull "Ruthless
 * Dictator" scry-3 disposition choice (WP-695 / D-24512).
 *
 * Called by the defeating (active) player after Ruthless Dictator's Fight looked at
 * the top `min(3, deck.length)` of their deck and parked a PendingRuthlessDictatorChoice
 * carrying that snapshot (`revealedCardIds`) plus the disposition slots available
 * (`availableDispositions`, the locked <3 priority KO → discard → top sliced to the
 * revealed count). The player assigns ONE revealed card a disposition per call:
 *   'ko'      — KO that card from the deck top (to the general KO pile);
 *   'discard' — move that deck-top card to the player's discard pile (NOT
 *               discardFromHand — this is a deck-top card, not a hand card);
 *   'top'     — leave the card on top of the deck (a no-op; the look-at never removed it).
 * Each resolved card is dropped from `revealedCardIds` and its slot from
 * `availableDispositions`; the queue front-pops when every revealed card is resolved.
 *
 * All invalid states are silent no-ops (moves never throw). The queue is left
 * byte-identical on every no-op so the player can resubmit — the block-all guard
 * guarantees the deck top still holds the revealed cards while pending.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState, RuthlessDictatorDisposition } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { koCard } from '../board/ko.logic.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveRuthlessDictatorChoice move.
 *
 * cardId — the revealed deck-top ext_id to disposition (must be one of the front
 *   pending entry's `revealedCardIds` snapshot; the round-trip rule).
 * disposition — how to dispose of it: 'ko' | 'discard' | 'top' (must be one of the
 *   front entry's still-available `availableDispositions`).
 */
export interface ResolveRuthlessDictatorChoiceArgs {
  cardId: CardExtId;
  disposition: RuthlessDictatorDisposition;
}

// why: the closed disposition vocabulary, written out so the arg validation is a
// boring explicit membership check (no dynamic key access).
const VALID_DISPOSITIONS: readonly RuthlessDictatorDisposition[] = ['ko', 'discard', 'top'];

/**
 * Whether any Ruthless Dictator scry-3 disposition choice is currently pending.
 *
 * Single predicate imported by the turn-end guards (endTurn, advanceStage) and the
 * block-all action-move guards. `undefined` and `[]` both mean no pending choice
 * (mirrors hasPendingScryKoChoice / hasPendingMelterKoChoice, D-24007).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending-Ruthless-Dictator queue holds at least one entry.
 */
export function hasPendingRuthlessDictatorChoice(G: LegendaryGameState): boolean {
  return (G.pendingRuthlessDictatorChoices?.length ?? 0) > 0;
}

/**
 * Whether `disposition` is one of the closed 'ko' | 'discard' | 'top' vocabulary.
 *
 * @param disposition - The candidate disposition string.
 * @returns true when it is a valid RuthlessDictatorDisposition.
 */
function isValidDisposition(disposition: unknown): disposition is RuthlessDictatorDisposition {
  // why: explicit membership scan — no .includes() over a helper, keeping the
  // validation boring and obviously correct (code-style: no clever abstractions).
  for (const candidate of VALID_DISPOSITIONS) {
    if (candidate === disposition) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves ONE revealed card of the FRONT pending Ruthless Dictator choice.
 *
 * Validate args → validate the front pending entry (playerID / choiceType) → find the
 * targeted cardId in `revealedCardIds` and the disposition in `availableDispositions`
 * (round-trip rule) → apply the disposition to the deck top → drop the resolved card
 * from `revealedCardIds` and its slot from `availableDispositions` → front-pop the
 * queue when `revealedCardIds` empties. Silent no-ops: empty/non-string cardId; invalid
 * disposition; empty queue; front.playerID mismatch; front.choiceType mismatch; the
 * cardId not in `revealedCardIds`; the disposition not in `availableDispositions`; a
 * KO/discard whose card is absent from the deck (queue intact — resubmit).
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the { cardId, disposition } decision for one revealed card.
 */
export function resolveRuthlessDictatorChoice(
  { G, playerID }: MoveContext,
  args: ResolveRuthlessDictatorChoiceArgs,
): void {
  // Step 1: Validate args — empty cardId or an invalid disposition is a no-op.
  if (typeof args.cardId !== 'string' || args.cardId.length === 0) { return; }
  if (!isValidDisposition(args.disposition)) { return; }

  // Step 2: Validate the front pending entry — front-only resolution (no index in the
  // payload, so a non-front entry can never be targeted). Only the defeating player who
  // owns the choice may resolve it.
  const queue = G.pendingRuthlessDictatorChoices;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }
  if (front.choiceType !== 'ruthless-dictator') { return; }

  // Step 3: Validate the selected card against the front's revealed snapshot and the
  // disposition against the still-available slots (round-trip rule). Explicit index
  // scans, not .indexOf over predicates, keep the validation boring and correct.
  let cardIndex = -1;
  for (let index = 0; index < front.revealedCardIds.length; index++) {
    if (front.revealedCardIds[index] === args.cardId) {
      cardIndex = index;
      break;
    }
  }
  if (cardIndex === -1) { return; }

  let dispositionIndex = -1;
  for (let index = 0; index < front.availableDispositions.length; index++) {
    if (front.availableDispositions[index] === args.disposition) {
      dispositionIndex = index;
      break;
    }
  }
  if (dispositionIndex === -1) { return; }

  // Step 4: Apply the disposition against CURRENT G. The block-all guard froze the deck
  // top while pending, so the snapshot cannot have drifted; moveCardFromZone removes the
  // FIRST occurrence of the ext_id (any copy is outcome-identical, always within the
  // looked-at window). A not-found removal is a no-op leaving the queue intact for
  // resubmit — never a throw.
  const zones = G.playerZones[playerID];
  if (!zones) { return; }
  const cardName = resolveCardName(G.cardDisplayData, args.cardId);

  if (args.disposition === 'ko') {
    const moveResult = moveCardFromZone(zones.deck, [], args.cardId);
    if (!moveResult.found) { return; }
    zones.deck = moveResult.from;
    G.ko = koCard(G.ko, args.cardId);
    // why: narrate the resolved KO. `G.messages` is hash-excluded (D-24081), so this
    // adds no determinism impact.
    pushLog(G,
      `Player ${playerID} KO'd ${cardName} (${args.cardId}) from the top of their deck (Ruthless Dictator).`,
      'applied',
      args.cardId,
    );
  } else if (args.disposition === 'discard') {
    // why: "discard" here is a DECK-TOP card to the discard pile via the zone helper —
    // NOT discardFromHand (that is the hand chokepoint; it does not apply to a deck-top
    // card). WP-695 non-negotiable.
    const moveResult = moveCardFromZone(zones.deck, zones.discard, args.cardId);
    if (!moveResult.found) { return; }
    zones.deck = moveResult.from;
    zones.discard = moveResult.to;
    pushLog(G,
      `Player ${playerID} discarded ${cardName} (${args.cardId}) from the top of their deck (Ruthless Dictator).`,
      'applied',
      args.cardId,
    );
  } else {
    // why: "top" — the card stays face-up on top of its owner's deck (no mutation; the
    // look-at never removed it). Only the queue bookkeeping below records the decision.
    pushLog(G,
      `Player ${playerID} kept ${cardName} (${args.cardId}) on top of their deck (Ruthless Dictator).`,
      'neutral',
      args.cardId,
    );
  }

  // Step 5: Drop the resolved card + its used disposition slot; front-pop when the
  // revealed snapshot empties.
  front.revealedCardIds.splice(cardIndex, 1);
  front.availableDispositions.splice(dispositionIndex, 1);
  if (front.revealedCardIds.length === 0) {
    queue.shift();
  }
}
