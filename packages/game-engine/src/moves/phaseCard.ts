/**
 * Phasing move for the Legendary Arena game engine (WP-783 / D-24629).
 *
 * phaseCard swaps a Phasing card in the current player's hand with the top card
 * of their deck. It realizes the printed hero keyword "Phasing" ("During your
 * turn, if a card with Phasing is in your hand, you may swap it with the top
 * card of your deck."). Follows the move validation contract: validate args,
 * check the stage gate, check legality, mutate G via helpers, return void.
 *
 * phasingOptions is the single legality predicate, shared by this move and the
 * UIState projection (economy.phasingOptions). getLegalMoves never emits
 * phaseCard, so bots never phase.
 *
 * This is a non-core move that gates internally (the dodgeCard / healWounds
 * precedent). It is NOT added to CoreMoveName, CORE_MOVE_NAMES, or
 * MOVE_ALLOWED_STAGES.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { moveCardFromZone } from './zoneOps.js';
import { reshuffleDiscardIntoDeck } from './drawCards.logic.js';
import { hasPendingKoHeroChoice } from './koHeroChoice.resolve.js';
import { hasPendingScryKoChoice } from './scryKoChoice.resolve.js';
import { hasPendingMelterKoChoice } from './melterKoChoice.resolve.js';
import { hasPendingRuthlessDictatorChoice } from './ruthlessDictatorChoice.resolve.js';
import { hasPendingElectromagneticBubbleChoice } from './electromagneticBubbleChoice.resolve.js';
import { hasPendingDiscardChoice } from './discardChoice.resolve.js';
import { hasPendingPutCardsOnDeckChoice } from './putCardsOnDeckChoice.resolve.js';
import { hasPendingKoDiscardChoice } from './koDiscardChoice.resolve.js';
import { hasPendingReorderChoice } from './reorderChoice.resolve.js';
import { hasPendingDefeatChoice } from './defeatChoice.resolve.js';
import { hasPendingOptionalKoReward } from './optionalKoReward.resolve.js';
import { hasPendingSmashDiscard } from './smashDiscard.resolve.js';
import { hasPendingPutHandOnDeckTop } from './putHandOnDeckTop.resolve.js';
import { hasPendingRevealTopDispose } from './revealTopDispose.resolve.js';
import { hasPendingRevealThreeAssign } from './revealThreeAssign.resolve.js';
import { hasPendingDoOver } from './doOver.resolve.js';
import { hasPendingPlayVillainTopChoice } from './playVillainTop.resolve.js';
import { hasPendingVictoryPileCardPick } from './resolveVictoryPileCardPick.js';
import { hasPendingDrawOrEmpowered } from './drawOrEmpowered.resolve.js';
import { hasPendingCoveringFireChoice } from './coveringFireChoice.resolve.js';
import { hasPendingSplitFaceChoice } from './splitFaceChoice.resolve.js';
import { hasPendingCountScaledChoice } from './countScaledChoice.resolve.js';
import { hasPendingUndercoverChoice } from './undercover.resolve.js';
import { hasPendingReturnZeroCostDiscard } from './resolveReturnZeroCostDiscard.js';
import { hasPendingDiscardToPlay } from './resolveDiscardToPlay.js';
import { hasPendingReturnOnDiscard } from './resolveReturnOnDiscard.js';
import { hasPendingGiveHqHeroChoice } from './giveHqHeroChoice.resolve.js';
import { hasPendingCopyPowersChoice } from './copyPowersChoice.resolve.js';
import { hasPendingSeatChoice } from './seatChoice.resolve.js';
import { hasPendingOptionalPutBottomHQ } from './resolveOptionalPutBottomHQ.js';
import { hasPendingPutAnyNumberBottomHQ } from './resolvePutAnyNumberBottomHQ.js';
import { getHooksForCard } from '../rules/heroAbility.types.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/** Arguments for the phaseCard move. */
interface PhaseCardArgs {
  /** The ext_id of the Phasing card in the player's hand to swap onto the deck top. */
  cardId: CardExtId;
}

/**
 * Whether any pending choice is open, which freezes the board for Phasing.
 *
 * The first 29 checks are the dodgeCard block-all cluster, copied verbatim (there
 * is no shared helper; the same cluster is inlined in healWounds / recruitHero /
 * exorciseHauntedHero). The last two are the put-bottom-HQ guards.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when any pending choice is open.
 */
function hasAnyPendingChoice(G: LegendaryGameState): boolean {
  if (hasPendingKoHeroChoice(G)) return true;
  if (hasPendingScryKoChoice(G)) return true;
  if (hasPendingMelterKoChoice(G)) return true;
  if (hasPendingRuthlessDictatorChoice(G)) return true;
  if (hasPendingElectromagneticBubbleChoice(G)) return true;
  if (hasPendingDiscardChoice(G)) return true;
  if (hasPendingPutCardsOnDeckChoice(G)) return true;
  if (hasPendingReorderChoice(G)) return true;
  if (hasPendingDefeatChoice(G)) return true;
  if (hasPendingKoDiscardChoice(G)) return true;
  if (hasPendingPlayVillainTopChoice(G)) return true;
  if (hasPendingOptionalKoReward(G)) return true;
  if (hasPendingSmashDiscard(G)) return true;
  if (hasPendingPutHandOnDeckTop(G)) return true;
  if (hasPendingRevealTopDispose(G)) return true;
  if (hasPendingRevealThreeAssign(G)) return true;
  if (hasPendingDoOver(G)) return true;
  if (hasPendingVictoryPileCardPick(G)) return true;
  if (hasPendingDrawOrEmpowered(G)) return true;
  if (hasPendingCoveringFireChoice(G)) return true;
  if (hasPendingSplitFaceChoice(G)) return true;
  if (hasPendingCountScaledChoice(G)) return true;
  if (hasPendingUndercoverChoice(G)) return true;
  if (hasPendingReturnZeroCostDiscard(G)) return true;
  if (hasPendingDiscardToPlay(G)) return true;
  if (hasPendingReturnOnDiscard(G)) return true;
  if (hasPendingGiveHqHeroChoice(G)) return true;
  if (hasPendingCopyPowersChoice(G)) return true;
  if (hasPendingSeatChoice(G)) return true;
  // why: WP-783 / D-24629 — the two put-bottom-HQ guards are checked only by advanceStage
  // (game.ts) and are missing from every action move's cluster. They are added here so the
  // swap cannot run under an open HQ put-bottom choice; the gap in the other moves is out
  // of scope.
  if (hasPendingOptionalPutBottomHQ(G)) return true;
  if (hasPendingPutAnyNumberBottomHQ(G)) return true;
  return false;
}

/**
 * Lists the hand cards the given player may phase right now.
 *
 * A card is phasable when all four checks hold: the stage is `main`; no pending
 * choice is open; the card is in the player's hand and carries a `phasing` hook;
 * and the player's deck or discard pile is non-empty (something can be swapped in).
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerId - The seat whose hand is checked.
 * @returns Distinct phasable hand card ids in hand order, or [] when none.
 */
export function phasingOptions(G: LegendaryGameState, playerId: string): CardExtId[] {
  // why: WP-783 / D-24629 — this is the single legality predicate, shared by the
  // phaseCard move and the economy.phasingOptions projection, so the button the client
  // shows and the move the engine accepts can never disagree. Bots are excluded (it is not
  // consulted by getLegalMoves): a Phasing card swapped for another Phasing card can swap
  // back and forth forever, which would burn a bot's per-turn step budget (D-24038).
  // why: the `main`-only window is narrower than the printed "during your turn" on
  // purpose — the villain reveal (`start`) precedes hero actions, `cleanup` ends the turn
  // once the new hand is drawn, and pending effects resolve atomically.
  if (G.currentStage !== 'main') return [];
  if (hasAnyPendingChoice(G)) return [];
  const playerZones = G.playerZones?.[playerId];
  if (!playerZones) return [];
  if (playerZones.deck.length === 0 && playerZones.discard.length === 0) return [];
  // why: the Array.isArray guard covers narrow test mocks that omit G.heroAbilityHooks
  // (getHooksForCard would otherwise iterate undefined) — the dodgeCard precedent.
  if (!Array.isArray(G.heroAbilityHooks)) return [];

  const options: CardExtId[] = [];
  for (const cardId of playerZones.hand) {
    if (options.includes(cardId)) continue;
    const carriesPhasing = getHooksForCard(G.heroAbilityHooks, cardId).some((hook) =>
      hook.keywords.includes('phasing'),
    );
    if (carriesPhasing) {
      options.push(cardId);
    }
  }
  return options;
}

/**
 * Swaps a Phasing card in the current player's hand with the top card of their deck.
 *
 * The phased card goes on top of the deck (`deck[0]`) and the old top card is
 * appended to the end of the hand. Any ineligible call — a non-Phasing card, a
 * card not in hand, the wrong stage, a pending choice, or no card to swap in —
 * returns silently with no mutation. Moves never throw.
 *
 * @param context - boardgame.io move context with G, ctx, random.
 * @param args - The ext_id of the hand card to phase.
 */
export function phaseCard({ G, ctx, ...context }: MoveContext, { cardId }: PhaseCardArgs): void {
  // Step 1: Validate args — a non-empty string cardId
  if (typeof cardId !== 'string' || cardId.length === 0) {
    return;
  }

  // Step 2: Stage gate (non-core move, internal gating)
  if (G.currentStage !== 'main') return;

  // Step 3: Legality — the single shared predicate (stage, pending, hand, hook, zones)
  const playerId = ctx.currentPlayer;
  if (!phasingOptions(G, playerId).includes(cardId)) return;
  const playerZones = G.playerZones[playerId];
  if (!playerZones) return;

  // Step 4: Empty deck — reshuffle the discard into a new deck first.
  // why: rules v23 L254 ("Whenever your deck runs out of cards and you need more…"),
  // Jeff-confirmed 2026-09-27: swapping needs a top card, so an empty deck reforms from
  // the discard. context (the move-context rest-spread) carries random.Shuffle; ctx has
  // no random — the dodgeCard idiom. This is the move's only randomness.
  if (playerZones.deck.length === 0) {
    reshuffleDiscardIntoDeck(playerZones, context as ShuffleProvider);
  }
  const topCard = playerZones.deck[0];
  if (topCard === undefined) return;

  // Step 5: Swap — the phased card onto the deck top, the old top card into the hand.
  // why: rules v23 ~L1796 — the swap "isn't … drawing a card" (nor playing one), so it
  // writes no turnEconomy field (no draw count, no play count), ignores a draw lock
  // (drawsLocked), and fires no hook or trigger.
  const handResult = moveCardFromZone(playerZones.hand, [], cardId);
  if (!handResult.found) return;
  playerZones.hand = [...handResult.from, topCard];
  playerZones.deck = [cardId, ...playerZones.deck.slice(1)];

  // Step 6: Narrate.
  // why: G.messages is public to every seat, so the line names the phased card (the
  // putHandOnDeckTop precedent) but never the card taken into hand, which stays hidden.
  pushLog(
    G,
    `Player ${playerId} phased ${formatCardRef(G.cardDisplayData, cardId)} onto the top of their deck and took the top card into their hand.`,
  );
}
