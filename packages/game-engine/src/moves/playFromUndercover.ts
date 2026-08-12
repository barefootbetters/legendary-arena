/**
 * Play a card from the face-down store (WP-282 / EC-313).
 *
 * Retrieves a card from the player's face-down store and plays it through the
 * shared applyCardPlay core — the identical pathway as hand play (inPlay append,
 * base economy, onPlay hero effects). Follows the Move Validation Contract:
 * validate args, check the stage + block-all gates, mutate G.
 *
 * Moves never throw. Invalid state causes an early return (void).
 * All randomness uses ctx.random exclusively — never Math.random().
 *
 * // IC-282-02: playFromUndercover(instanceId) must produce identical state
 * // transitions as playing that same instance from hand. Routing through the
 * // shared applyCardPlay core (not a duplicated copy) is what guarantees it.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { applyCardPlay } from './coreMoves.impl.js';
import { hasPendingKoHeroChoice } from './koHeroChoice.resolve.js';
import { hasPendingScryKoChoice } from './scryKoChoice.resolve.js';
import { hasPendingDiscardChoice } from './discardChoice.resolve.js';
import { hasPendingReorderChoice } from './reorderChoice.resolve.js';
import { hasPendingDefeatChoice } from './defeatChoice.resolve.js';
import { hasPendingOptionalKoReward } from './optionalKoReward.resolve.js';
import { hasPendingVictoryPileCardPick } from './resolveVictoryPileCardPick.js';
import { hasPendingDrawOrEmpowered } from './drawOrEmpowered.resolve.js';
import { hasPendingReturnZeroCostDiscard } from './resolveReturnZeroCostDiscard.js';
import { hasPendingDiscardToPlay } from './resolveDiscardToPlay.js';
import { hasPendingReturnOnDiscard } from './resolveReturnOnDiscard.js';
import { hasPendingGiveHqHeroChoice } from './giveHqHeroChoice.resolve.js';
import { formatPlayedCardLabel } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/** Arguments for the playFromUndercover move. */
interface PlayFromUndercoverArgs {
  /** The ext_id (instanceId) of the face-down card to play. */
  instanceId: string;
}

/**
 * Plays a card from the player's face-down store.
 *
 * Removes the card from faceDownCards (owner-validated) and plays it via the
 * shared applyCardPlay core so the resulting state transition is byte-identical
 * to playing the same instance from hand (IC-282-02). Returns silently on
 * invalid state (Move Validation Contract).
 *
 * This is a non-core move that gates internally (the dodgeCard / recruitHero
 * pattern): it is NOT in CoreMoveName / MOVE_ALLOWED_STAGES.
 *
 * @param context - boardgame.io move context with G, ctx, random.
 * @param args - The instanceId of the face-down card to play.
 */
export function playFromUndercover(
  { G, playerID, ...context }: MoveContext,
  args: PlayFromUndercoverArgs,
): void {
  // Step 1: Validate args — non-empty string instanceId
  if (typeof args.instanceId !== 'string' || args.instanceId.length === 0) {
    return;
  }

  // Step 2: Stage gate (non-core move, internal gating — the dodgeCard pattern).
  // why: playing a card is a main-action-window action; mirror playCard's
  // main-stage requirement so face-down play is legal at the same time hand play is.
  if (G.currentStage !== 'main') {
    return;
  }

  // why: block-all guard (D-24008) — while a KO-a-Hero choice is pending the
  // board is frozen; this move returns with no side effects.
  if (hasPendingKoHeroChoice(G)) {
    return;
  }
  // why: block-all guard (D-24282) — a pending Doombot scry-KO choice freezes the
  // board until the player picks which revealed card to KO.
  if (hasPendingScryKoChoice(G)) {
    return;
  }
  // why: block-all guard (WP-476 / D-24284) — a pending discard-to-limit choice
  // freezes the board until the current player picks which cards to discard.
  if (hasPendingDiscardChoice(G)) {
    return;
  }
  // why: block-all guard (WP-479 / D-24286) — a pending reveal-remainder reorder
  // freezes the board until the current player picks their deck-top order.
  if (hasPendingReorderChoice(G)) {
    return;
  }
  // why: block-all guard (WP-486 / D-24291) — a pending defeat-with-a-Bystander
  // choice freezes the board until the current player picks which target to defeat.
  if (hasPendingDefeatChoice(G)) {
    return;
  }
  // why: block-all guard (D-24019) — optional-KO-reward choice pending; the
  // board is frozen until resolved (beside the D-24008 KO-hero check above).
  if (hasPendingOptionalKoReward(G)) {
    return;
  }
  // why: block-all — pendingVictoryPileCardPick must be resolved before any other action (D-24067)
  if (hasPendingVictoryPileCardPick(G)) {
    return;
  }
  // why: block-all — pendingDrawOrEmpowered must be resolved before any other action (D-24069)
  if (hasPendingDrawOrEmpowered(G)) {
    return;
  }

  // why: block-all — pendingReturnZeroCostDiscard must be resolved before any other action (D-24139)
  if (hasPendingReturnZeroCostDiscard(G)) {
    return;
  }
  // why: block-all — pendingDiscardToPlay must be resolved before any other action (WP-383 / D-24184)
  if (hasPendingDiscardToPlay(G)) {
    return;
  }
  // why: block-all — pendingReturnOnDiscard must be resolved before any other action (WP-498 / D-24301)
  if (hasPendingReturnOnDiscard(G)) {
    return;
  }
  // why: block-all — pendingGiveHqHeroChoice (interactive give-HQ-Hero pick, Paibok Fight) must be resolved before any other action (WP-532 / D-24343)
  if (hasPendingGiveHqHeroChoice(G)) {
    return;
  }

  // Step 3: Get player zones
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }

  // Step 4: Find the face-down card by instanceId (IC-282-01: zone ref is instanceId)
  const faceDownCardIndex = playerZones.faceDownCards.findIndex(
    (card) => card.instanceId === args.instanceId,
  );
  if (faceDownCardIndex === -1) {
    // why: card not found in face-down store — silent no-op
    return;
  }

  const faceDownCard = playerZones.faceDownCards[faceDownCardIndex];
  if (!faceDownCard) {
    // why: defensive — findIndex returned a valid index, but TS narrows the
    // readonly-array element access to `T | undefined`. Never expected to fire.
    return;
  }

  // Step 5: Validate ownership (IC-282-04: only the owner may play their card)
  if (faceDownCard.ownerPlayerId !== playerID) {
    return;
  }

  // Step 6: Remove from face-down store (exactly one instance, by index)
  playerZones.faceDownCards = playerZones.faceDownCards.filter(
    (_, index) => index !== faceDownCardIndex,
  );

  // Step 7: Play via the shared core (IC-282-02 — identical to hand play).
  // why: the stored cardId is the real template identity; play it (not the
  // instanceId reference) so cardStats / hero-effect lookups resolve correctly.
  applyCardPlay(G, context, playerID, faceDownCard.cardId);

  // Step 8: Log the move (deterministic, replay-visible)
  // why: WP-323 — enrich the raw ext-id to "{Name} ({ext-id}) — {printed effect}"
  // (formatPlayedCardLabel, names from G.cardDisplayData). This is the "from
  // face-down" annotation line; applyCardPlay already logged the play above.
  pushLog(
    G,
    // why: WP-417 — empty economy clause: this is the "from face-down" ANNOTATION
    // line; applyCardPlay's own line above already reported the base attack/recruit,
    // and repeating it here would double-count the grant to a reader.
    `Player ${playerID} played ${formatPlayedCardLabel(G.cardDisplayData, faceDownCard.cardId, '')} from face-down`,
    'neutral',
    faceDownCard.cardId, // why: WP-438 — structured play identity.
  );
}
