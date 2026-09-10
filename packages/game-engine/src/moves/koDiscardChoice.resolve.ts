/**
 * resolveKoDiscardChoice move + the KO-from-discard eligibility predicate and
 * block-all guard (WP-693 / D-24510).
 *
 * Called by the current player after Loki's "Maniacal Tyrant" tactic Fight ("KO up
 * to four cards from your discard pile") parked a PendingKoDiscardChoice. The player
 * selects 0..min(4, discardSize) DISTINCT cards from their OWN discard; this move
 * validates the selection against the current discard, removes each chosen card from
 * discard, appends it to the global KO pile (G.ko) via koCard, and front-pops the
 * pending entry. An empty selection is the legal "KO nothing" choice.
 *
 * This is the first BOUNDED, OPTIONAL 0..N-cap multi-select resolve in the engine:
 * the exact-count siblings (resolvePutCardsOnDeckChoice, resolveReorderChoice)
 * reject any count other than their fixed `count`. It mirrors their conventions —
 * array payload, FIFO queue, front-only resolve, front-pop on success, block-all
 * guard, silent no-ops on every invalid payload with the queue left intact.
 *
 * // why: D-24510 — the payload ids must be DISTINCT (a Set) per the WP contract:
 * KO-from-discard is modeled as a set of at most `maxCount` distinct discard ids,
 * so a payload repeating an id is rejected rather than treated as two removals.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { koCard } from '../board/ko.logic.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveKoDiscardChoice move.
 *
 * cardIds — the DISTINCT discard ext_ids to KO (order irrelevant — the KO pile is a
 * set-like destination). Must be 0..maxCount ids, each distinct, each present in the
 * chooser's discard now. An empty array is the legal "KO nothing" choice.
 */
export interface ResolveKoDiscardChoiceArgs {
  cardIds: CardExtId[];
}

/**
 * Whether any KO-from-discard choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards. `undefined` and
 * `[]` both mean no pending choice (mirrors hasPendingDefeatChoice, D-24291).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending-KO-from-discard queue holds at least one entry.
 */
export function hasPendingKoDiscardChoice(G: LegendaryGameState): boolean {
  return (G.pendingKoDiscardChoices?.length ?? 0) > 0;
}

/**
 * Returns the cards eligible to be KO'd from a player's discard — the whole discard
 * pile, in current order. Recomputed fresh (no snapshot): the block-all guard freezes
 * the discard while the choice is pending, so the projection and the resolve move both
 * read the live discard and agree byte-for-byte (the round-trip rule).
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The chooser whose discard is the KO source.
 * @returns The chooser's discard cards in order, or an empty array when the player is unknown.
 */
export function getEligibleKoDiscardCards(
  G: LegendaryGameState,
  playerID: string,
): CardExtId[] {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return [];
  }
  return [...playerZones.discard];
}

/**
 * Whether the payload ids are all distinct (no repeated ext_id).
 *
 * // why: D-24510 — the KO-from-discard payload is a SET of distinct discard ids;
 * a repeated id is an invalid payload (rejected), not two removals of the same card.
 *
 * @param cardIds - The submitted ids.
 * @returns true when every id is distinct.
 */
function areIdsDistinct(cardIds: readonly CardExtId[]): boolean {
  return new Set(cardIds).size === cardIds.length;
}

/**
 * Resolves the FRONT pending KO-from-discard choice by knocking out the chosen
 * cards from the player's own discard into the global KO pile.
 *
 * Validate args → validate the front pending entry → the selection must be 0..maxCount
 * DISTINCT ids all present in the chooser's discard → remove each from discard, append
 * to G.ko → front-pop on success. Silent no-ops (queue intact — resubmit): non-array /
 * non-string ids; a repeated id; more ids than maxCount; empty queue; front.playerID
 * mismatch; front.choiceType mismatch; any id absent from the discard. An empty
 * selection is the legal "KO nothing" choice and still front-pops.
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the selected { cardIds } to KO from the discard pile.
 */
export function resolveKoDiscardChoice(
  { G, playerID }: MoveContext,
  args: ResolveKoDiscardChoiceArgs,
): void {
  // Step 1: Validate args — cardIds must be an array of non-empty strings. An EMPTY
  // array is legal here ("KO up to four" includes zero), unlike the exact-count siblings.
  if (!Array.isArray(args.cardIds)) { return; }
  for (const cardId of args.cardIds) {
    if (typeof cardId !== 'string' || cardId.length === 0) { return; }
  }
  // why: D-24510 — reject a payload repeating an id (the selection is a distinct set).
  if (!areIdsDistinct(args.cardIds)) { return; }

  // Step 2: Validate the front pending entry — front-only resolution (no index in the
  // payload, so a non-front entry can never be targeted).
  const queue = G.pendingKoDiscardChoices;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }
  if (front.choiceType !== 'ko-from-discard') { return; }

  // why: D-24510 — reject over-cap selections. The cap is the printed "up to four"
  // (front.maxCount); a selection larger than it is invalid (the discard-size clamp is
  // enforced implicitly by the in-discard presence check below).
  if (args.cardIds.length > front.maxCount) { return; }

  // Step 3: Resolve against CURRENT G — each chosen id must be present in the chooser's
  // discard now. The block-all guard freezes the discard while pending, so the discard
  // the client saw is the discard we validate against. Remove each id from a WORKING copy
  // first; if any id is absent the whole selection is invalid and we no-op with the real
  // discard untouched (queue intact — resubmit).
  const playerZones = G.playerZones[playerID];
  if (!playerZones) { return; }
  let workingDiscard = playerZones.discard;
  const chosenCards: CardExtId[] = [];
  for (const cardId of args.cardIds) {
    const moveResult = moveCardFromZone(workingDiscard, [], cardId);
    if (!moveResult.found) { return; }
    workingDiscard = moveResult.from;
    chosenCards.push(cardId);
  }

  // Step 4: Mutate — commit the validated discard and append each chosen card to the
  // global KO pile via koCard (destination-only: the card was already removed from
  // discard above, satisfying koCard's remove-before-append contract).
  playerZones.discard = workingDiscard;
  for (const cardId of chosenCards) {
    G.ko = koCard(G.ko, cardId);
  }

  // Step 5: Narrate the resolved KO. `G.messages` is hash-excluded (D-24081), so this
  // adds no determinism / sentinel impact.
  pushLog(
    G,
    `Player ${playerID} KO'd ${String(chosenCards.length)} card(s) from their discard pile (Maniacal Tyrant).`,
    'applied',
  );

  // Step 6: Front-pop ONLY on success (front-pop = Array.shift). An empty selection is a
  // successful "KO nothing" and still pops so the board unfreezes.
  queue.shift();
}
