/**
 * resolveMelterKoChoice move — resolves a pending Melter Fight KO/keep choice
 * (WP-603 / D-24413; supersedes the WP-519 / D-24332 auto-resolve).
 *
 * Called by the fighting (active) player after Melter's Fight revealed every
 * player's deck top and parked a PendingMelterKoChoice carrying every revealed
 * `{ ownerPlayerID, cardId }`. The player resolves ONE revealed card per call:
 * `keep === false` KOs that card from ITS OWNER's deck top; `keep === true` leaves
 * it on top (a no-op — the reveal never removed it). Either way the resolved entry
 * is dropped from `revealedTops`; when the last one is resolved the queue front-pops.
 *
 * The payload keys on `ownerPlayerID` AND `cardId` because starter ext_ids (e.g.
 * `starting-shield-agent`) are shared across every player's deck, so `cardId` alone
 * cannot identify which deck top a decision targets.
 *
 * All invalid states are silent no-ops (moves never throw). The queue is left
 * byte-identical on every no-op so the player can resubmit — the block-all guard
 * guarantees every revealed deck top still exists while pending.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { koCard } from '../board/ko.logic.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveMelterKoChoice move.
 *
 * ownerPlayerID + cardId — identify WHICH revealed deck top the decision targets
 * (both required because starter ext_ids repeat across players' decks). Must match a
 * `{ ownerPlayerID, cardId }` entry in the front pending choice's `revealedTops`.
 * keep — true keeps the card on top (no-op); false KOs it from the owner's deck.
 */
export interface ResolveMelterKoChoiceArgs {
  ownerPlayerID: string;
  cardId: CardExtId;
  keep: boolean;
}

/**
 * Whether any Melter Fight KO/keep choice is currently pending.
 *
 * Single predicate imported by the turn-end guards (endTurn, advanceStage) and the
 * block-all action-move guards. `undefined` and `[]` both mean no pending choice
 * (mirrors hasPendingScryKoChoice, D-24007).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending-Melter-KO queue holds at least one entry.
 */
export function hasPendingMelterKoChoice(G: LegendaryGameState): boolean {
  return (G.pendingMelterKoChoices?.length ?? 0) > 0;
}

/**
 * Resolves ONE revealed card of the FRONT pending Melter KO/keep choice.
 *
 * Validate args → validate the front pending entry (playerID / choiceType) → find
 * the targeted `{ ownerPlayerID, cardId }` in the front's `revealedTops` snapshot
 * (round-trip rule) → on `keep === false` KO the card from its owner's deck (leaving
 * a failed removal a no-op with the queue intact for resubmit) → drop the resolved
 * entry from `revealedTops` → front-pop the queue when it empties. Silent no-ops:
 * empty/non-string ids; non-boolean keep; empty queue; front.playerID mismatch;
 * front.choiceType mismatch; the `{ ownerPlayerID, cardId }` not in `revealedTops`;
 * a KO whose card is absent from the owner's deck (queue intact — resubmit).
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the { ownerPlayerID, cardId, keep } decision for one revealed card.
 */
export function resolveMelterKoChoice(
  { G, playerID }: MoveContext,
  args: ResolveMelterKoChoiceArgs,
): void {
  // Step 1: Validate args — empty ids or a non-boolean keep is a no-op.
  if (typeof args.ownerPlayerID !== 'string' || args.ownerPlayerID.length === 0) { return; }
  if (typeof args.cardId !== 'string' || args.cardId.length === 0) { return; }
  if (typeof args.keep !== 'boolean') { return; }

  // Step 2: Validate the front pending entry — front-only resolution (no index in
  // the payload, so a non-front entry can never be targeted). Only the fighting
  // player who owns the choice may resolve it.
  const queue = G.pendingMelterKoChoices;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }
  if (front.choiceType !== 'melter-ko') { return; }

  // Step 3: Find the targeted revealed card in the front's snapshot (round-trip
  // rule). Match on BOTH ownerPlayerID and cardId — the client submits a pair the
  // engine projected, and only those are accepted.
  // why: an explicit for...of index scan keeps the validation boring and obviously
  // correct (code-style: no clever abstractions, no .findIndex over a predicate).
  let targetIndex = -1;
  for (let index = 0; index < front.revealedTops.length; index++) {
    const entry = front.revealedTops[index]!;
    if (entry.ownerPlayerID === args.ownerPlayerID && entry.cardId === args.cardId) {
      targetIndex = index;
      break;
    }
  }
  if (targetIndex === -1) { return; }

  // Step 4: Apply the decision. "Keep" mutates nothing (the reveal never removed the
  // card — it is already on top). "KO" removes it from the OWNER's deck top and
  // appends it to the general KO pile.
  if (!args.keep) {
    const ownerZones = G.playerZones[args.ownerPlayerID];
    if (!ownerZones) { return; }
    // why: the block-all guard froze every deck top while the choice was pending, so
    // the snapshot cannot have drifted; moveCardFromZone removes the first occurrence
    // of the ext_id from the owner's deck (its top). A not-found result is a no-op
    // that leaves the queue intact for resubmit — never a throw.
    const moveResult = moveCardFromZone(ownerZones.deck, [], args.cardId);
    if (!moveResult.found) { return; }
    ownerZones.deck = moveResult.from;
    G.ko = koCard(G.ko, args.cardId);
    // why: narrate the resolved KO so the player sees which card left which deck.
    // `G.messages` is hash-excluded (D-24081), so this adds no determinism impact.
    const koName = resolveCardName(G.cardDisplayData, args.cardId);
    pushLog(
      G,
      `Player ${playerID} KO'd ${koName} (${args.cardId}) from the top of Player ${args.ownerPlayerID}'s deck.`,
      'applied',
      args.cardId,
    );
  } else {
    // why: keep — the card stays face-up on top of its owner's deck (no mutation).
    const keptName = resolveCardName(G.cardDisplayData, args.cardId);
    pushLog(
      G,
      `Player ${playerID} kept ${keptName} (${args.cardId}) on top of Player ${args.ownerPlayerID}'s deck.`,
      'neutral',
      args.cardId,
    );
  }

  // Step 5: Drop the resolved entry from the snapshot; front-pop when it empties.
  front.revealedTops.splice(targetIndex, 1);
  if (front.revealedTops.length === 0) {
    queue.shift();
  }
}
