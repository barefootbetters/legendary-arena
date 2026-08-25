/**
 * Recruit hero move for the Legendary Arena game engine.
 *
 * recruitHero removes a hero from an HQ slot and places it in the current
 * player's discard pile. Follows the three-step validation contract:
 * validate args, check stage gate, mutate G.
 *
 * This is a non-core move that gates internally (same pattern as
 * revealVillainCard from WP-014A). It is NOT added to CoreMoveName,
 * CORE_MOVE_NAMES, or MOVE_ALLOWED_STAGES.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { getAvailableRecruit, spendRecruit } from '../economy/economy.logic.js';
import { refillHqSlot } from '../board/city.logic.js';
import { hasPendingKoHeroChoice } from './koHeroChoice.resolve.js';
import { hasPendingScryKoChoice } from './scryKoChoice.resolve.js';
import { hasPendingMelterKoChoice } from './melterKoChoice.resolve.js';
import { hasPendingDiscardChoice } from './discardChoice.resolve.js';
import { hasPendingPutCardsOnDeckChoice } from './putCardsOnDeckChoice.resolve.js';
import { hasPendingReorderChoice } from './reorderChoice.resolve.js';
import { hasPendingDefeatChoice } from './defeatChoice.resolve.js';
import { hasPendingOptionalKoReward } from './optionalKoReward.resolve.js';
import { hasPendingVictoryPileCardPick } from './resolveVictoryPileCardPick.js';
import { hasPendingDrawOrEmpowered } from './drawOrEmpowered.resolve.js';
import { hasPendingReturnZeroCostDiscard } from './resolveReturnZeroCostDiscard.js';
import { hasPendingDiscardToPlay } from './resolveDiscardToPlay.js';
import { hasPendingReturnOnDiscard } from './resolveReturnOnDiscard.js';
import { hasPendingGiveHqHeroChoice } from './giveHqHeroChoice.resolve.js';
import { hasPendingCopyPowersChoice } from './copyPowersChoice.resolve.js';
import { hasHealedThisTurn } from './healWounds.js';
import { getHooksForCard, filterHooksByTiming } from '../rules/heroAbility.types.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/** Arguments for the recruitHero move. */
interface RecruitHeroArgs {
  /** 0-based index of the HQ slot to recruit from (0-4). */
  hqIndex: number;
  // why: D-24049 — additive optional Wall-Crawl placement. When true AND the
  // recruited Hero has an onRecruit wall-crawl hook, the card is placed on top of
  // the recruiting player's OWN deck (the next-draw position) instead of the
  // discard pile. Omitted or false ⇒ today's discard placement (byte-identical).
  /** Optional: place a recruited Wall-Crawl Hero on top of your own deck. */
  toTopOfDeck?: boolean;
}

/**
 * Recruits a hero from the HQ.
 *
 * Removes the card from the specified HQ slot and places it in the
 * current player's discard pile.
 *
 * @param context - boardgame.io move context with G, ctx.
 * @param args - The HQ slot index to recruit from.
 */
export function recruitHero(
  { G, ctx }: MoveContext,
  { hqIndex, toTopOfDeck }: RecruitHeroArgs,
): void {
  // Step 1: Validate args
  if (
    typeof hqIndex !== 'number' ||
    !Number.isFinite(hqIndex) ||
    !Number.isInteger(hqIndex) ||
    hqIndex < 0 ||
    hqIndex > 4
  ) {
    return;
  }

  const cardId = G.hq[hqIndex];
  if (cardId === null || cardId === undefined) {
    return;
  }

  // why: silent failure preserves deterministic move contract — insufficient
  // recruit points means the recruit cannot proceed
  const requiredCost = G.cardStats[cardId]?.cost ?? 0;
  const availableRecruit = getAvailableRecruit(G.turnEconomy);
  if (availableRecruit < requiredCost) {
    return;
  }

  // Step 2: Stage gate (non-core move, internal gating)
  // why: recruiting happens during the main action window; non-core moves
  // gate internally per the WP-014A precedent
  if (G.currentStage !== 'main') return;

  // why: block-all guard (D-24008) — while a KO-a-Hero choice is pending the
  // board is frozen; recruitHero returns with no side effects. Placed
  // immediately after the stage gate, before any G/zone write.
  if (hasPendingKoHeroChoice(G)) return;
  // why: block-all guard (D-24282) — a pending Doombot scry-KO choice freezes the
  // board until the player picks which revealed card to KO.
  if (hasPendingScryKoChoice(G)) return;
  // why: WP-603 / D-24413 — block-all guard: a pending Melter Fight KO/keep choice
  // freezes the board until the fighting player resolves every revealed deck top.
  if (hasPendingMelterKoChoice(G)) return;
  // why: block-all guard (WP-476 / D-24284) — a pending discard-to-limit choice
  // freezes the board until the current player picks which cards to discard.
  if (hasPendingDiscardChoice(G)) return;
  if (hasPendingPutCardsOnDeckChoice(G)) return;
  if (hasPendingReorderChoice(G)) return; // why: WP-479 / D-24286 block-all guard
  if (hasPendingDefeatChoice(G)) return; // why: WP-486 / D-24291 block-all guard
  // why: block-all guard (D-24019) — optional-KO-reward choice pending; the
  // board is frozen until resolved (beside the D-24008 KO-hero check above).
  if (hasPendingOptionalKoReward(G)) return;
  // why: block-all — pendingVictoryPileCardPick must be resolved before any other action (D-24067)
  if (hasPendingVictoryPileCardPick(G)) return;
  // why: block-all — pendingDrawOrEmpowered must be resolved before any other action (D-24069)
  if (hasPendingDrawOrEmpowered(G)) return;
  // why: block-all — pendingReturnZeroCostDiscard must be resolved before any other action (D-24139)
  if (hasPendingReturnZeroCostDiscard(G)) return;
  // why: block-all — pendingDiscardToPlay must be resolved before any other action (WP-383 / D-24184)
  if (hasPendingDiscardToPlay(G)) return;
  // why: block-all — pendingReturnOnDiscard must be resolved before any other action (WP-498 / D-24301)
  if (hasPendingReturnOnDiscard(G)) return;
  // why: block-all — pendingGiveHqHeroChoice (Paibok Fight) must be resolved first (WP-532 / D-24343)
  if (hasPendingGiveHqHeroChoice(G)) return;
  // why: block-all — pendingCopyPowersChoice (Rogue's Copy Powers) must be resolved first (WP-535 / D-24345)
  if (hasPendingCopyPowersChoice(G)) return;

  // why: D-24180 — a player who used the Wound Healing ability this turn may not
  // fight or recruit for the rest of the turn (the reverse lock).
  if (hasHealedThisTurn(G)) return;

  // Step 3: Mutate G
  // why: D-24049 — the printed "Wall-Crawl" ability ("when you recruit this Hero,
  // you may put it on top of your deck") is optional and acts on the recruiting
  // player's OWN deck via their own recruit action — no hidden information, no
  // opponent interaction — so it needs no pending-choice/board-freeze guard. The
  // hook query is read-only: getHooksForCard is 2-arg (no timing param), so the
  // onRecruit wall-crawl hook is reached by filtering its result to onRecruit and
  // checking the keyword specifically (never "the first onRecruit hook"). The
  // Array.isArray guard covers narrow test mocks that omit G.heroAbilityHooks.
  const placeOnDeckTop =
    toTopOfDeck === true &&
    Array.isArray(G.heroAbilityHooks) &&
    filterHooksByTiming(getHooksForCard(G.heroAbilityHooks, cardId), 'onRecruit').some(
      (hook) => hook.keywords.includes('wall-crawl'),
    );

  // why: D-24049 — deck[0] is the next-draw position (drawFromPlayerDeck draws
  // deck[0]), so the deck-top placement uses unshift. WP-018 — economy deduction
  // lands after the placement; WP-135 — HQ slot refill lands after that. The slot
  // is vacated by refillHqSlot (which assigns null when heroDeck is empty per
  // D-13503), so we must not pre-null G.hq[hqIndex] here. When placeOnDeckTop is
  // false (toTopOfDeck falsy or no wall-crawl onRecruit hook) the discard placement
  // is byte-identical to the pre-WP-273 behavior.
  if (placeOnDeckTop) {
    G.playerZones[ctx.currentPlayer]!.deck.unshift(cardId);
  } else {
    G.playerZones[ctx.currentPlayer]!.discard.push(cardId);
  }
  G.turnEconomy = spendRecruit(G.turnEconomy, requiredCost);

  // why: D-24180 — this successful recruit marks the player as having acted this
  // turn, which bars the Wound Healing ability for the rest of the turn.
  G.hasActedThisTurn = true;

  // why: WP-135 — refill the vacated slot from G.heroDeck (FIFO via shift).
  // Empty-deck case leaves the slot null per D-13503; no auto-reshuffle of
  // recruited cards back into the deck (separate engine WP if ever needed).
  const refillResult = refillHqSlot(G.hq, hqIndex, G.heroDeck);
  G.hq = refillResult.hq;
  G.heroDeck = refillResult.heroDeck;

  // why: WP-135 — log line is replay-visible and snapshotted; format is
  // locked at this site to byte-equality. Replaces the pre-WP-135 line
  // shape from WP-016 (one push per successful recruit, not two). Never
  // add timestamps or non-deterministic context. The empty-deck branch
  // substitutes the trailing parenthetical per the §7.6 byte-locked format.
  const refillSuffix =
    refillResult.hq[hqIndex] === null
      ? '(heroDeck empty; slot left null)'
      : `(heroDeck.length: ${String(refillResult.heroDeck.length)})`;
  // why: D-24049 — append a Wall-Crawl placement note ONLY on the deck-top branch;
  // the discard branch's line is byte-identical to the pre-WP-273 WP-135 format.
  const placementNote = placeOnDeckTop ? ' (Wall-Crawl: placed on top of deck)' : '';
  pushLog(G, 
    `Player ${ctx.currentPlayer} recruited ${formatCardRef(G.cardDisplayData, cardId)}; HQ slot ${String(hqIndex)} refilled from heroDeck ${refillSuffix}${placementNote}`,
  );
}
