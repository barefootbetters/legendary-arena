/**
 * endOfTurnCleanup.logic.ts
 *
 * The single end-of-turn cleanup site (WP-701 / D-24520). At the end of a
 * player's turn — the tabletop rule — that player discards their in-play cards
 * and their remaining hand, then draws a fresh hand of HAND_SIZE. Doing this at
 * END of turn (rather than the former start-of-turn `turn.onBegin` auto-draw,
 * D-10003/D-23605) restores the between-turns state: a player holds HAND_SIZE
 * cards during opponents' turns, so Master Strikes and every "each player
 * discards / reveals" effect act on real hands instead of the empty hand a
 * player was left with under the onBegin-draw model.
 *
 * This helper bundles what were two separate steps under the old model — the
 * `endTurn` move's discard sweep and the `onBegin` fill block — into one
 * function, so BOTH D-22002 turn-end paths (the `endTurn` move and the
 * `advanceStage` -> `advanceTurnStage` cleanup branch) and all three
 * bgio-bypassing harnesses run identical cleanup and replays stay consistent.
 *
 * Pure helper: no boardgame.io import, no I/O, deterministic (the draw's
 * reshuffle uses the caller's ShuffleProvider = `ctx.random`). Never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveAllCards } from './zoneOps.js';
import { HAND_SIZE, drawCardsIntoHand } from './drawCards.logic.js';
import { consumeDeferredHandInjections, setAsideDeferredHandInjections } from './deferredHandInjection.logic.js';
import { composeDeckReshuffledNarrative } from '../events/notableEvents.compose.js';
import { isRitualArtifact } from './ritualArtifact.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';
import { clearExpiredHqSizeChangingGrants } from '../hero/sizeChangingGrant.logic.js';
import { clearHqCostChanges } from '../hero/hqCostChange.logic.js';

/**
 * Moves the player's in-play Ritual Artifacts into their controlled Artifacts (WP-858 / D-24794).
 *
 * Every other in-play card is left for the discard sweep. Writes nothing when no in-play card
 * is a modeled Ritual Artifact, so a match without one never gains `G.controlledArtifacts`.
 *
 * @param G - Game state, mutated in place.
 * @param playerID - The player whose turn is ending.
 */
function keepControlledArtifacts(G: LegendaryGameState, playerID: string): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }
  // why: WP-858 / D-24794 — rules v23 p.17: "At end of turn, when you discard all the cards you
  // played that turn, the Artifacts you control stay in front of you." Only marked Ritual
  // Artifacts are kept (isRitualArtifact keys on the hook keyword); an unmarked Artifact card
  // still discards, because its ability is unmodeled and keeping it would only remove it from
  // the deck.
  const stillInPlay: CardExtId[] = [];
  for (const cardId of playerZones.inPlay) {
    if (!isRitualArtifact(G, cardId)) {
      stillInPlay.push(cardId);
      continue;
    }
    if (G.controlledArtifacts === undefined) {
      G.controlledArtifacts = {};
    }
    G.controlledArtifacts[playerID] = [...(G.controlledArtifacts[playerID] ?? []), cardId];
    pushLog(G, `Player ${playerID} keeps ${formatCardRef(G.cardDisplayData, cardId)} in front of them as an Artifact.`);
  }
  playerZones.inPlay = stillInPlay;
}

/**
 * Runs the end-of-turn cleanup for one player: discard in-play + hand, then
 * draw a fresh hand to HAND_SIZE (or the player's one-shot handSizeOverride),
 * announcing a reshuffle and consuming the override / deferred-hand injection.
 *
 * Exact order (locked, EC-738):
 *   1. Discard in-play -> discard, then hand -> discard.
 *   1b. Set the Electromagnetic Bubble card aside from the discard (D-24797), so the
 *      fill's reshuffle can neither shuffle it in nor draw it as one of the six.
 *   2. Fill hand to `handSizeOverrides?.[playerID] ?? HAND_SIZE` from the deck
 *      (reshuffling the discard on exhaustion via the ShuffleProvider).
 *   3. Push a `deckReshuffled` notable event iff a reshuffle actually occurred.
 *   4. Consume the one-shot `handSizeOverrides` entry (Doc Ock, D-24300).
 *   5. Consume the deferred hand injection (Electromagnetic Bubble, D-24512) —
 *      AFTER the fill, so the card set aside at 1b lands as the extra (seventh) card on
 *      top of the fresh hand.
 *   6. Return teleport-on-discard cards set aside this turn (D-24526).
 *   7. Delete this turn's Copy Powers copied-class / copied-team grants (D-24730).
 *   8. Drop "this turn" HQ Size-Changing grants and grants whose card left the HQ (D-24804).
 *
 * // why: D-24520 — the draw is at END of turn (this function), not the former
 * start-of-turn onBegin auto-draw, so a player holds their hand during
 * opponents' turns. hasDrawnThisTurn is NOT set here — it is an onBegin reset
 * flag guarding the scaffold `drawCards` move, meaningful only within a turn.
 *
 * @param G - Game state, mutated in place.
 * @param playerID - The player whose turn is ending (draws their own new hand).
 * @param shuffleProvider - Deterministic shuffle source (`ctx.random`), for the
 *   reshuffle-on-exhaustion inside the draw.
 */
export function applyEndOfTurnCleanup(
  G: LegendaryGameState,
  playerID: string,
  shuffleProvider: ShuffleProvider,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }
  // Step 0: keep the modeled Ritual Artifacts in front of the player.
  keepControlledArtifacts(G, playerID);

  // Step 1: discard in-play, then the remaining hand.
  const inPlayResult = moveAllCards(playerZones.inPlay, playerZones.discard);
  playerZones.inPlay = inPlayResult.from;
  playerZones.discard = inPlayResult.to;

  const handResult = moveAllCards(playerZones.hand, playerZones.discard);
  playerZones.hand = handResult.from;
  playerZones.discard = handResult.to;

  // Step 1b: set the Electromagnetic Bubble card aside before the fill.
  // why: D-24797 — the card is added "as a seventh card", never drawn. Left in the discard, a
  // short deck's reshuffle could shuffle it in and the fill draw it as one of the six, and the
  // Step 5 consume then found nothing (live match bujIOIX4wLk). Without a recorded injection
  // this lifts nothing, so every other cleanup is unchanged.
  const bubbleSetAside = setAsideDeferredHandInjections(G, playerID, playerZones);

  // Step 2: draw the new hand. // why: WP-497 / D-24300 — a tactic Fight resolver
  // (Doc Ock's "Octet of Valence Electrons") may have recorded a one-shot next-hand
  // override; fill to it, else HAND_SIZE. After the discard the hand is empty, so
  // cardsToDraw is the full fill target; the Math.max keeps it non-negative defensively.
  const fillTarget = G.handSizeOverrides?.[playerID] ?? HAND_SIZE;
  const cardsToDraw = Math.max(0, fillTarget - playerZones.hand.length);
  const reshuffleCount = drawCardsIntoHand(playerZones, cardsToDraw, shuffleProvider);

  // Step 3: announce a realized empty-deck reshuffle (WP-642 / D-24454). Minimal
  // payload, no card id. Array.isArray guard tolerates a legacy state literal that
  // predates the field.
  if (reshuffleCount > 0 && Array.isArray(G.notableEvents)) {
    G.notableEvents.push({
      type: 'deckReshuffled',
      playerId: playerID,
      narrative: composeDeckReshuffledNarrative(),
    });
  }

  // Step 4: consume the one-shot handSizeOverride (delete so it raises exactly this fill).
  if (G.handSizeOverrides?.[playerID] !== undefined) {
    delete G.handSizeOverrides[playerID];
  }

  // Step 5: consume the deferred hand injection (Electromagnetic Bubble) — after the
  // fill, adds each recorded card (set aside at Step 1b) as an extra card and clears the key.
  consumeDeferredHandInjections(G, playerID, playerZones, bubbleSetAside);

  // why: WP-705 / D-24526 — Step 6: return every teleport-on-discard card set aside this
  // turn to its OWNER's hand (Guerrilla Warfare). All-owners (not just the ending player),
  // so a card set aside during a non-active player's discard also returns now. Placed AFTER
  // the ending player's fill so their own returned card is an EXTRA on top of the fresh hand;
  // a non-active owner's return adds to their existing hand. applyEndOfTurnCleanup runs once
  // per turn-end at EVERY path (both live turn-end sub-paths + all bgio-bypassing harnesses),
  // so this single co-located drain covers them all — no per-harness replication needed.
  consumeTeleportReturns(G);

  // Step 7: end every Copy Powers copy made this turn (D-24730).
  clearCopyPowersGrants(G);

  // Step 8: end every "this turn" HQ Size-Changing grant, and drop grants whose card left the
  // HQ (WP-862 / D-24804); Shrinking Research Budget's lasting grants stay while the card does.
  clearExpiredHqSizeChangingGrants(G);
  // why: WP-868 / D-24811 — every "Heroes currently in the HQ cost N less / more this turn"
  // change ends with the turn, so the whole overlay goes at the same step.
  clearHqCostChanges(G);
}

/**
 * Deletes the turn-scoped Copy Powers grant maps (D-24730).
 *
 * // why: Copy Powers counts as the copied Hero's class and team for that one play
 * only. Both maps are keyed by card instance, so a grant left in place would follow the
 * card into its next play (live L3yPdfS179l: a Copy Powers that copied a Strength Hero
 * on turn 6 still counted as Strength when it copied a Covert Hero on turn 16). Only the
 * active player plays cards, so dropping every entry at that player's turn end clears
 * exactly this turn's copies. The keys are deleted, not emptied, so a game returns to
 * the omit-when-empty shape. The setup Size-Changing classes in cardSizeChangingClasses
 * are printed and stay.
 *
 * @param G - Game state, mutated in place.
 */
function clearCopyPowersGrants(G: LegendaryGameState): void {
  if (G.cardCopiedClasses !== undefined) {
    delete G.cardCopiedClasses;
  }
  if (G.cardCopiedTeams !== undefined) {
    delete G.cardCopiedTeams;
  }
}

/**
 * Returns every teleport-on-discard card set aside this turn to its owner's hand (WP-705 /
 * D-24526). Drains the whole G.pendingTeleportReturns queue — each card was removed from
 * discard at set-aside time (held in no zone), so it is appended directly to its owner's
 * hand as an extra card. Drain-idempotent: an empty/undefined queue is an early no-op, which
 * is what makes calling it at the single per-turn-end cleanup site correct and safe.
 *
 * // why: G-only, no ctx — both printed branches ("your turn → Teleport it" / "not your turn
 * → set aside, add at end of this turn") collapse to this one end-of-current-turn return, so
 * no turn-owner distinction is needed.
 *
 * @param G - Game state, mutated in place (cards appended to hands, queue emptied).
 */
export function consumeTeleportReturns(G: LegendaryGameState): void {
  const queue = G.pendingTeleportReturns;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  for (const entry of queue) {
    const ownerZones = G.playerZones[entry.playerID];
    if (!ownerZones) {
      continue;
    }
    ownerZones.hand = [...ownerZones.hand, entry.cardId];
  }
  G.pendingTeleportReturns = [];
}
