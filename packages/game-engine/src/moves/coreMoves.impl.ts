/**
 * Core move implementations for the Legendary Arena game engine.
 *
 * Each move follows the three-step ordering:
 *   1. Validate args (call validator from WP-008A)
 *   2. Check stage gate (call validateMoveAllowedInStage from WP-008A)
 *   3. Mutate G (via zoneOps.ts helpers)
 *
 * Moves never throw. Invalid input causes an early return (void).
 * All randomness uses ctx.random exclusively — never Math.random().
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { DrawCardsArgs, PlayCardArgs } from './coreMoves.types.js';
import { validateDrawCardsArgs, validatePlayCardArgs, validateMoveAllowedInStage } from './coreMoves.validate.js';
import { moveCardFromZone, moveAllCards } from './zoneOps.js';
import { HAND_SIZE, drawCardsIntoHand } from './drawCards.logic.js';
import { addResources } from '../economy/economy.logic.js';
import { executeHeroEffects } from '../hero/heroEffects.execute.js';
import { hasPendingKoHeroChoice } from './koHeroChoice.resolve.js';
import { hasPendingOptionalKoReward } from './optionalKoReward.resolve.js';
import { hasPendingVictoryPileCardPick } from './resolveVictoryPileCardPick.js';
import { hasPendingDrawOrEmpowered } from './drawOrEmpowered.resolve.js';
import { hasPendingReturnZeroCostDiscard } from './resolveReturnZeroCostDiscard.js';
import { formatPlayedCardLabel } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Draws the active player's start-of-turn hand, capped at HAND_SIZE and
 * guarded to once per turn.
 *
 * The start-of-turn hand is normally drawn automatically by the play-phase
 * onBegin auto-draw; this move is kept as defensive, engine-authoritative
 * protection. A direct drawCards submission (including a raw socket message)
 * is capped at HAND_SIZE and blocked after the first draw of the turn via
 * G.hasDrawnThisTurn, so the production over-draw bug cannot recur over the
 * wire. The deck-to-hand fill (with discard reshuffle on exhaustion)
 * delegates to the shared drawCardsIntoHand primitive.
 *
 * @param context - boardgame.io move context with G, events, random, playerID.
 * @param args - DrawCardsArgs payload with a count field.
 */
export function drawCards({ G, playerID, ...context }: MoveContext, args: DrawCardsArgs): void {
  // Step 1: Validate args
  const argsResult = validateDrawCardsArgs(args);
  if (!argsResult.ok) {
    return;
  }

  // Step 2: Check stage gate
  const stageResult = validateMoveAllowedInStage('drawCards', G.currentStage);
  if (!stageResult.ok) {
    return;
  }

  // why: block-all guard (D-24008) — while a KO-a-Hero choice is pending the
  // board is frozen; this move returns with no side effects. Placed immediately
  // after the stage gate, before any zone/economy access, so a blocked move
  // leaks no partial state.
  if (hasPendingKoHeroChoice(G)) {
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

  // why: once-per-turn guard — the start-of-turn draw is consumed once per turn
  // (mirrors revealVillainCard). A second drawCards submission in the same turn,
  // from any source, is a silent no-op. Card-effect draws (the hero `draw`
  // keyword) use the rule-effect path (applyDrawCards) and bypass this guard.
  // Placed before resolving zones / any reshuffle so a blocked move consumes no
  // RNG and leaves G untouched.
  if (G.hasDrawnThisTurn) {
    return;
  }

  // Step 3: Mutate G
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }

  // why: cap the draw to HAND_SIZE — the authoritative, race-free cap the
  // deleted UI scaffold could only approximate. The deck-to-hand fill with
  // reshuffle delegates to the shared drawCardsIntoHand primitive.
  const cardsToDraw = Math.min(
    args.count,
    Math.max(0, HAND_SIZE - playerZones.hand.length),
  );
  drawCardsIntoHand(playerZones, cardsToDraw, context);

  // why: the draw attempt is consumed regardless of how many cards were drawn
  // (even zero — an empty deck/discard or an already-full hand still spends the
  // turn's draw allowance), foreclosing an empty-deck retry loop.
  G.hasDrawnThisTurn = true;
}

/**
 * Shared card-play core: appends an already-resolved card to the player's
 * inPlay zone, adds its base attack/recruit economy, and fires its onPlay hero
 * effects. The caller is responsible for removing the card from its source zone
 * first (hand for playCard, faceDownCards for playFromUndercover).
 *
 * // why: WP-282 IC-282-02 — playFromUndercover must produce identical state
 * // transitions as playing the same instance from hand. Extracting the
 * // post-removal play steps into one shared function guarantees the two paths
 * // cannot drift (no behavioral fork). Both callers append to inPlay in the
 * // same order, add the same economy, and fire the same executeHeroEffects.
 *
 * @param G - The game state to mutate.
 * @param context - boardgame.io move context rest (carries random for effects).
 * @param playerID - The player playing the card.
 * @param cardId - The ext_id of the card being played (already removed from source).
 */
export function applyCardPlay(
  G: LegendaryGameState,
  context: Omit<MoveContext, 'G' | 'playerID'>,
  playerID: string,
  cardId: string,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }

  playerZones.inPlay = [...playerZones.inPlay, cardId];

  // why: MVP adds base values only; conditional bonuses are WP-023
  const cardStats = G.cardStats[cardId];
  const heroAttack = cardStats ? cardStats.attack : 0;
  const heroRecruit = cardStats ? cardStats.recruit : 0;
  G.turnEconomy = addResources(G.turnEconomy, heroAttack, heroRecruit);

  // why: WP-295 / D-24082 — surface every hero card play in the game log
  // (G.messages -> UIState.log); playCard was previously silent. WP-323 enriches
  // the raw ext-id to "{Name} ({ext-id}) — {printed effect}" via
  // formatPlayedCardLabel, resolving the name/effect from G.cardDisplayData
  // (already in scope). Emitted in the shared core so playFromUndercover is
  // covered identically. Cheap: WP-294 excluded G.messages from the
  // finalStateHash oracle (D-24081).
  pushLog(G, 
    `Player ${playerID} played ${formatPlayedCardLabel(G.cardDisplayData, cardId)}.`,
  );

  // why: hero ability effects fire immediately after play, before any
  // fight/recruit actions. This preserves "play -> generate resources -> act."
  // Hero hook economy is additive to base card stats above (WP-022).
  executeHeroEffects(G, context, playerID, cardId);
}

/**
 * Plays a card from the active player's hand into their inPlay zone.
 *
 * @param context - boardgame.io move context with G, events, random, playerID.
 * @param args - PlayCardArgs payload with a cardId field.
 */
export function playCard({ G, playerID, ...context }: MoveContext, args: PlayCardArgs): void {
  // Step 1: Validate args
  const argsResult = validatePlayCardArgs(args);
  if (!argsResult.ok) {
    return;
  }

  // Step 2: Check stage gate
  const stageResult = validateMoveAllowedInStage('playCard', G.currentStage);
  if (!stageResult.ok) {
    return;
  }

  // why: block-all guard (D-24008) — while a KO-a-Hero choice is pending the
  // board is frozen; this move returns with no side effects. Placed immediately
  // after the stage gate, before any zone/economy access.
  if (hasPendingKoHeroChoice(G)) {
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

  // Step 3: Mutate G
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }

  // why: remove the card from hand (first occurrence) with an empty target so
  // the inPlay append happens via the shared applyCardPlay core below. This
  // preserves moveCardFromZone's "remove exactly one copy" semantics for the
  // duplicate-cards case while keeping play behavior identical to
  // playFromUndercover (WP-282 IC-282-02).
  const removal = moveCardFromZone(playerZones.hand, [], args.cardId);
  if (!removal.found) {
    return;
  }
  playerZones.hand = removal.from;

  applyCardPlay(G, context, playerID, args.cardId);
}

/**
 * Ends the current player's turn by moving all cards to discard and
 * calling ctx.events.endTurn() to advance to the next player.
 *
 * @param context - boardgame.io move context with G, events, random, playerID.
 */
export function endTurn({ G, playerID, events }: MoveContext): void {
  // Step 1: Validate args (endTurn has no args — skip to stage gate)

  // Step 2: Check stage gate
  const stageResult = validateMoveAllowedInStage('endTurn', G.currentStage);
  if (!stageResult.ok) {
    return;
  }

  // why: turn cannot end while a player-choice reveal is pending; the player must
  // call resolveHeroChoice first. Guard precedes the zone sweep so a blocked turn
  // does not discard the hand (D-22002)
  if (G.pendingHeroChoice !== undefined) {
    return;
  }

  // why: turn cannot end while a KO-a-Hero choice is pending (D-24008 —
  // queue-non-empty blocks turn-end). Guard precedes the zone sweep so a
  // blocked turn does not discard the hand. Both pending systems must clear
  // before the turn ends (dual-pending coexistence with WP-220).
  if (hasPendingKoHeroChoice(G)) {
    return;
  }

  // why: turn cannot end while an optional-KO-reward choice is pending (D-24019
  // — queue-non-empty blocks turn-end). Guard precedes the zone sweep so a
  // blocked turn does not discard the hand (beside the D-24008 KO-hero check).
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

  // Step 3: Mutate G
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }

  const inPlayResult = moveAllCards(playerZones.inPlay, playerZones.discard);
  playerZones.inPlay = inPlayResult.from;
  playerZones.discard = inPlayResult.to;

  const handResult = moveAllCards(playerZones.hand, playerZones.discard);
  playerZones.hand = handResult.from;
  playerZones.discard = handResult.to;

  // why: boardgame.io manages player rotation via ctx.events.endTurn().
  // Manual player index rotation is forbidden — the framework handles
  // advancing to the next player and resetting turn state.
  events.endTurn();
}
