/**
 * resolveScryKoChoice move — resolves a pending Doombot scry-KO player choice
 * (WP-470 / D-24282).
 *
 * Called by the active player after a scry-ko-own-deck effect (Doombot Legion's
 * Fight) with ≥2 cards in their deck appended a PendingScryKoChoice to
 * G.pendingScryKoChoices. The player looks at the top two revealed cards and
 * selects which one to KO; the other stays on top of the deck. This move
 * validates the selection against the front pending entry's revealed snapshot,
 * KOs the chosen card from the deck, and front-pops the queue.
 *
 * All invalid states are silent no-ops (moves never throw). The queue is left
 * byte-identical on every no-op so the player can resubmit a valid target —
 * the block-all guard guarantees the deck top (and thus a valid target) still
 * exists while pending.
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
 * Payload for the resolveScryKoChoice move.
 *
 * cardId — the ext_id to KO (must be one of the front pending entry's
 * `revealedCardIds`; the first matching occurrence in the deck is removed).
 */
export interface ResolveScryKoChoiceArgs {
  cardId: CardExtId;
}

/**
 * Whether any Doombot scry-KO choice is currently pending.
 *
 * Single predicate imported by the turn-end guards (endTurn, advanceStage) and
 * the block-all action-move guards. `undefined` and `[]` both mean no pending
 * choice (mirrors hasPendingKoHeroChoice, D-24007).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending-scry-KO queue holds at least one entry.
 */
export function hasPendingScryKoChoice(G: LegendaryGameState): boolean {
  return (G.pendingScryKoChoices?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending scry-KO choice by KOing the selected revealed card.
 *
 * Validate args → validate the front pending entry → validate the cardId is one
 * of the front's revealed snapshot → KO it from the deck (leaving the other on
 * top) → front-pop on success. Silent no-ops: empty cardId; empty queue;
 * front.playerID mismatch; front.choiceType mismatch; cardId not in the front's
 * revealedCardIds; cardId absent from the deck (queue intact — resubmit).
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the selected { cardId } to KO from the top two.
 */
export function resolveScryKoChoice({ G, playerID }: MoveContext, args: ResolveScryKoChoiceArgs): void {
  // Step 1: Validate args — empty / non-string cardId is a no-op
  if (typeof args.cardId !== 'string' || args.cardId.length === 0) { return; }

  // Step 2: Validate the front pending entry — front-only resolution (no index
  // in the payload, so a non-front entry can never be targeted)
  const queue = G.pendingScryKoChoices;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }
  if (front.choiceType !== 'scry-ko') { return; }

  // Step 3: Validate the selection against the front's revealed snapshot — the
  // chosen cardId must be one of the two cards the player was shown. This is the
  // round-trip rule: the client submits a cardId from the projected
  // revealedCards, and only those are accepted.
  // why: no .includes() over a helper — an explicit for...of keeps the validation
  // boring and obviously correct (code-style: no clever abstractions).
  let isRevealed = false;
  for (const revealedId of front.revealedCardIds) {
    if (revealedId === args.cardId) {
      isRevealed = true;
      break;
    }
  }
  if (!isRevealed) { return; }

  // Step 4: Resolve against CURRENT G — KO the chosen card from the deck. The
  // block-all guard froze the deck top while the choice was pending, so the
  // snapshot cannot have drifted. moveCardFromZone removes the FIRST occurrence
  // of the ext_id; the chosen card is one of the top two, and any earlier-index
  // occurrence has the same ext_id (KOing either copy is outcome-identical), so
  // the first occurrence is always within the looked-at window — the non-KO'd
  // revealed card is left on top in its original relative order (D-24282).
  const zones = G.playerZones[playerID];
  if (!zones) { return; }
  const moveResult = moveCardFromZone(zones.deck, [], args.cardId);
  if (!moveResult.found) {
    // why: invalid/stale target is a no-op that leaves the queue intact so the
    // player resubmits; the block-all guard guarantees the deck still holds the
    // revealed cards.
    return;
  }

  // Step 5: Mutate — shorten the deck and KO the chosen card
  zones.deck = moveResult.from;
  G.ko = koCard(G.ko, args.cardId);

  // Step 6: Narrate the resolved KO so the player sees WHICH card they KO'd. The
  // park-time line only said "look at the top two … choose one to KO". `G.messages`
  // is hash-excluded (D-24081), so this adds no determinism / sentinel impact.
  const koName = resolveCardName(G.cardDisplayData, args.cardId);
  pushLog(G, `Player ${playerID} KO'd ${koName} (${args.cardId}) from the top of their deck.`);

  // Step 7: Front-pop ONLY on success (front-pop = Array.shift)
  queue.shift();
}
