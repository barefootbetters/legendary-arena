/**
 * resolveRevealTopDispose move — resolves a pending reveal-top discard-or-keep choice
 * (WP-702 / D-24521).
 *
 * Called by the ACTIVE player after a `reveal-top-dispose` card ("Reveal the top card
 * of your deck. Discard it or put it back.") or Hypnotic Charm's `reveal-top-dispose-others`
 * instinct clause revealed the targeted deck top(s) and parked a PendingRevealTopDispose
 * carrying every revealed `{ ownerPlayerID, cardId }`. The player resolves ONE revealed
 * card per call: `disposition === 'discard'` moves that card from ITS OWNER's deck top to
 * ITS OWNER's discard pile; `disposition === 'top'` leaves it on top (a no-op — the reveal
 * never removed it). Either way the resolved entry is dropped from `revealedTops`; when the
 * last one is resolved the queue front-pops.
 *
 * The payload keys on `ownerPlayerID` AND `cardId` because starter ext_ids (e.g.
 * `starting-shield-agent`) are shared across every player's deck, so `cardId` alone
 * cannot identify which deck top a decision targets (the Melter WP-603 precedent).
 *
 * All invalid states are silent no-ops (moves never throw). The queue is left
 * byte-identical on every no-op so the player can resubmit — the block-all guard
 * guarantees every revealed deck top still exists while pending.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState, RevealTopDisposition } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';
import { isCullableDeckTopCard } from '../villain/villainEffects.execute.js';
import { koCard } from '../board/ko.logic.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveRevealTopDispose move.
 *
 * ownerPlayerID + cardId — identify WHICH revealed deck top the decision targets
 * (both required because starter ext_ids repeat across players' decks). Must match a
 * `{ ownerPlayerID, cardId }` entry in the front pending choice's `revealedTops`.
 * disposition — 'discard' moves it to the owner's discard pile; 'top' keeps it on top (no-op);
 * 'ko' KOs it — accepted only when the targeted entry's `isKoAllowed` is true (D-24558).
 */
export interface ResolveRevealTopDisposeArgs {
  ownerPlayerID: string;
  cardId: CardExtId;
  disposition: RevealTopDisposition;
}

// why: the closed disposition vocabulary, written out so the arg validation is a
// boring explicit membership check (no dynamic key access, code-style).
const VALID_DISPOSITIONS: readonly RevealTopDisposition[] = ['discard', 'top', 'ko'];

/**
 * Whether any reveal-top discard-or-keep choice is currently pending.
 *
 * Single predicate imported by the turn-end guards (endTurn, advanceStage) and the
 * block-all action-move guards. `undefined` and `[]` both mean no pending choice
 * (mirrors hasPendingMelterKoChoice, D-24007).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending-reveal-top-dispose queue holds at least one entry.
 */
export function hasPendingRevealTopDispose(G: LegendaryGameState): boolean {
  return (G.pendingRevealTopDispose?.length ?? 0) > 0;
}

/**
 * Whether `disposition` is one of the closed 'discard' | 'top' vocabulary.
 *
 * @param disposition - The candidate disposition string.
 * @returns true when it is a valid RevealTopDisposition.
 */
function isValidDisposition(disposition: unknown): disposition is RevealTopDisposition {
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
 * Resolves ONE revealed card of the FRONT pending reveal-top discard-or-keep choice.
 *
 * Validate args → validate the front pending entry (playerID / choiceType) → find the
 * targeted `{ ownerPlayerID, cardId }` in the front's `revealedTops` snapshot (round-trip
 * rule) → apply the disposition and ALWAYS drop the resolved entry → front-pop the queue when
 * it empties. On 'discard' the revealed card moves to its owner's discard pile IFF it is still
 * that owner's live deck top; if a co-resolved same-play effect (e.g. Beast's Berserk) already
 * moved it off the top, the disposition is moot and the choice clears with a neutral log (never
 * a re-loop). 'top' keeps the card on top. The entry is dropped either way, so the block-all
 * guard can never dangle. Silent no-ops (whole move): empty/non-string ids; invalid
 * disposition; empty queue; front.playerID mismatch; front.choiceType mismatch; the
 * `{ ownerPlayerID, cardId }` not in `revealedTops`; the owner zones missing.
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the { ownerPlayerID, cardId, disposition } decision for one revealed card.
 */
export function resolveRevealTopDispose(
  { G, playerID }: MoveContext,
  args: ResolveRevealTopDisposeArgs,
): void {
  // Step 1: Validate args — empty ids or an invalid disposition is a no-op.
  if (typeof args.ownerPlayerID !== 'string' || args.ownerPlayerID.length === 0) { return; }
  if (typeof args.cardId !== 'string' || args.cardId.length === 0) { return; }
  if (!isValidDisposition(args.disposition)) { return; }

  // Step 2: Validate the front pending entry — front-only resolution (no index in the
  // payload, so a non-front entry can never be targeted). Only the active player who owns
  // the choice may resolve it.
  const queue = G.pendingRevealTopDispose;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }
  if (front.choiceType !== 'reveal-top-dispose') { return; }

  // Step 3: Find the targeted revealed card in the front's snapshot (round-trip rule).
  // Match on BOTH ownerPlayerID and cardId — the client submits a pair the engine
  // projected, and only those are accepted.
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
  // why: D-24558 — 'ko' is an OPTIONAL disposition unlocked per entry (co2e Hypnotic Charm's
  // covert clause). A 'ko' on an entry that was not unlocked is a silent no-op that leaves the
  // queue byte-identical, so the player can resubmit a legal disposition.
  if (args.disposition === 'ko' && front.revealedTops[targetIndex]!.isKoAllowed !== true) { return; }

  // Step 4: Apply the disposition. This entry is ALWAYS cleared below (Step 5) — the choice
  // resolves whether or not the card is still on top — so a revealed card a co-resolved
  // same-play effect already moved never re-loops the bot on an unresolvable move.
  //
  // "Discard" moves the revealed card to its owner's discard pile IFF it is STILL that owner's
  // live deck top. Confirming `deck[0] === cardId` guards the shared-starter case (never a
  // deeper copy of `starting-shield-agent`) AND the co-effect case: a same-play sibling ability
  // (e.g. Beast's Berserk on Calculated Rage — a `deck`→`discard` primitive that runs
  // synchronously right after this choice parked) can move the revealed card off the top before
  // the player decides. If so, the reveal-top disposition is moot — the card is already wherever
  // the co-effect put it — so we clear the choice with a neutral log instead of no-op-looping.
  // "Top" keeps the card on top (a no-op when it is still there; also moot if a co-effect moved it).
  const ownerZones = G.playerZones[args.ownerPlayerID];
  if (!ownerZones) { return; }
  const cardName = resolveCardName(G.cardDisplayData, args.cardId);
  const cardIsStillTop = ownerZones.deck.length > 0 && ownerZones.deck[0] === args.cardId;

  if (!cardIsStillTop) {
    // why: WP-702 — a co-resolved same-play effect moved the revealed card off the deck top
    // before this choice resolved (executeHeroEffects runs a card's sibling abilities
    // synchronously after a block-all park). The disposition is moot; clear it gracefully.
    // `G.messages` is hash-excluded (D-24081), so this adds no determinism impact.
    pushLog(
      G,
      `Player ${playerID}'s reveal-top choice for ${cardName} (${args.cardId}) resolved with no effect — the card had already left the top of Player ${args.ownerPlayerID}'s deck.`,
      'neutral',
      args.cardId,
    );
  } else if (args.disposition === 'ko') {
    const moveResult = moveCardFromZone(ownerZones.deck, [], args.cardId);
    // why: cardIsStillTop guarantees found; the guard keeps the move total-function-safe.
    if (moveResult.found) {
      ownerZones.deck = moveResult.from;
      G.ko = koCard(G.ko, args.cardId);
      pushLog(
        G,
        `Player ${playerID} KO'd ${cardName} (${args.cardId}) from the top of their deck (reveal-top).`,
        'applied',
        args.cardId,
      );
    }
  } else if (args.disposition === 'discard') {
    const moveResult = moveCardFromZone(ownerZones.deck, ownerZones.discard, args.cardId);
    // why: cardIsStillTop guarantees found; the guard keeps the move total-function-safe.
    if (moveResult.found) {
      ownerZones.deck = moveResult.from;
      ownerZones.discard = moveResult.to;
      pushLog(
        G,
        `Player ${playerID} discarded ${cardName} (${args.cardId}) from the top of Player ${args.ownerPlayerID}'s deck (reveal-top).`,
        'applied',
        args.cardId,
      );
    }
  } else {
    // why: "top" — the card stays face-up on top of its owner's deck (no mutation; the
    // reveal never removed it). Only the queue bookkeeping below records the decision.
    pushLog(
      G,
      `Player ${playerID} kept ${cardName} (${args.cardId}) on top of Player ${args.ownerPlayerID}'s deck (reveal-top).`,
      'neutral',
      args.cardId,
    );
  }

  // Step 5: Drop the resolved entry from the snapshot; front-pop when it empties. The entry
  // is ALWAYS dropped (the choice always resolves), so the block-all guard cannot dangle.
  front.revealedTops.splice(targetIndex, 1);
  if (front.revealedTops.length === 0) {
    queue.shift();
  }
}

/**
 * Deterministic bot/sim default disposition for a revealed deck-top card (WP-702 / D-24521).
 *
 * Mirrors the Melter WP-519 / D-24413 bot default (`keep = !isCullableDeckTopCard`): DISCARD a
 * card worth thinning — a Wound or a basic S.H.I.E.L.D. starter (`isCullableDeckTopCard`'s
 * tier-1/2 "worst-worthy" set) — and otherwise KEEP it on top ('top'). Used only by the sim/bot
 * dispatch (ai.legalMoves), so bot / replay / PAR runs resolve reveal-top-dispose cards
 * deterministically; only live human play gets the interactive prompt.
 *
 * // why: the disposition depends only on the card's identity (the cull tier), not on the owner's
 * zones — so the signature takes just the cardId (the EC's speculative (G, ownerPlayerID, cardId)
 * shape would carry two unused params, which code-style forbids; WP intent — a cull-tier default —
 * governs).
 *
 * D-24558: when the entry is KO-unlocked (`isKoAllowed`, co2e Hypnotic Charm's covert clause),
 * a cullable card is KO'd instead of discarded — thinning it out of the deck for good is
 * strictly better than cycling it through the discard pile.
 *
 * @param cardId - The revealed deck-top card's ext_id.
 * @param isKoAllowed - Whether the entry allows the optional 'ko' disposition (D-24558).
 * @returns 'ko' / 'discard' for a cullable card (by isKoAllowed), 'top' otherwise.
 */
export function selectDefaultRevealTopDisposition(
  cardId: CardExtId,
  isKoAllowed: boolean,
): RevealTopDisposition {
  if (!isCullableDeckTopCard(cardId)) {
    return 'top';
  }
  if (isKoAllowed) {
    return 'ko';
  }
  return 'discard';
}
