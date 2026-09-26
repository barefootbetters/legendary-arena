/**
 * Exorcise move for the Haunt keyword (WP-757 / D-24587).
 *
 * exorciseHauntedHero pays a Haunted Hero's cost, then KOs that Hero or gives it to a
 * chosen player's discard pile, refills the HQ slot, and releases the haunter: a
 * Villain haunter enters the City ignoring its Ambush; a Mastermind haunter returns to
 * the Mastermind space. Rulebook v23 p.27: exorcising is neither a recruit nor a
 * fight, so no recruit triggers and no Fight effects fire.
 *
 * Non-core move that gates internally (the recruitHero pattern). NOT in CoreMoveName,
 * CORE_MOVE_NAMES, or MOVE_ALLOWED_STAGES.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { getAvailableRecruit, spendRecruit } from '../economy/economy.logic.js';
import { refillHqSlot } from '../board/city.logic.js';
import { koCard } from '../board/ko.logic.js';
import { clearHqHaunter, isHqSlotHaunted } from '../board/haunt.logic.js';
import { enterCityIgnoringAmbush } from '../villainDeck/villainDeck.enterCity.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
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
import { hasHealedThisTurn } from './healWounds.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/** What happens to the exorcised Hero. */
export type ExorciseOutcome = 'ko' | 'gain';

/** Arguments for the exorciseHauntedHero move. */
export interface ExorciseHauntedHeroArgs {
  /** 0-based index of the Haunted HQ slot (0-4). */
  hqIndex: number;
  /** `'ko'` sends the Hero to the KO pile; `'gain'` gives it to `recipientPlayerId`. */
  outcome: ExorciseOutcome;
  /** For `'gain'`: the player (any seat, not only the active one) who gains the Hero. */
  recipientPlayerId?: string;
}

/**
 * Returns whether the exorcise args are well-formed against the current state: a
 * haunted, occupied HQ slot, a known outcome, and (for `'gain'`) a real recipient.
 *
 * @param G - The game state to inspect (not mutated).
 * @param args - The submitted args (untrusted payload).
 * @returns True when every argument is valid.
 */
function areExorciseArgsValid(G: LegendaryGameState, args: unknown): boolean {
  if (args === null || typeof args !== 'object') {
    return false;
  }
  const hqIndex = (args as { hqIndex?: unknown }).hqIndex;
  if (
    typeof hqIndex !== 'number' ||
    !Number.isInteger(hqIndex) ||
    hqIndex < 0 ||
    hqIndex > 4
  ) {
    return false;
  }
  const heroId = G.hq[hqIndex];
  if (heroId === null || heroId === undefined) {
    return false;
  }
  if (!isHqSlotHaunted(G, hqIndex)) {
    return false;
  }
  const outcome = (args as { outcome?: unknown }).outcome;
  if (outcome === 'ko') {
    return true;
  }
  if (outcome !== 'gain') {
    return false;
  }
  const recipientPlayerId = (args as { recipientPlayerId?: unknown }).recipientPlayerId;
  if (typeof recipientPlayerId !== 'string') {
    return false;
  }
  return G.playerZones[recipientPlayerId] !== undefined;
}

/**
 * Exorcises a Haunted Hero (WP-757 / D-24587).
 *
 * Validation order (locked by EC-794): args → cost → stage `main` → the recruitHero
 * block-all guards → the Wound Healing lock. Mutation order: spend + mark acted →
 * apply the outcome → clear the haunter → refill the slot → release the haunter.
 *
 * @param context - boardgame.io move context with G, ctx, random.
 * @param args - The Haunted HQ slot, the outcome, and the optional recipient.
 */
export function exorciseHauntedHero(
  { G, ctx, random }: MoveContext,
  args: ExorciseHauntedHeroArgs,
): void {
  // Step 1: Validate args
  if (!areExorciseArgsValid(G, args)) return;
  const hqIndex = args.hqIndex;
  const heroId = G.hq[hqIndex] as CardExtId;

  // why: D-24587 — the exorcise price is the Haunted Hero's cost, read from the same
  // authority recruitHero uses (G.cardStats). Insufficient recruit is a silent no-op.
  const requiredCost = G.cardStats[heroId]?.cost ?? 0;
  if (getAvailableRecruit(G.turnEconomy) < requiredCost) return;

  // Step 2: Stage gate (non-core move, internal gating)
  // why: exorcising spends recruit during the main action window, like recruitHero.
  if (G.currentStage !== 'main') return;

  // why: block-all guard (D-24008) — while a KO-a-Hero choice is pending the
  // board is frozen; exorciseHauntedHero returns with no side effects. Placed
  // immediately after the stage gate, before any G/zone write.
  if (hasPendingKoHeroChoice(G)) return;
  // why: block-all guard (D-24282) — a pending Doombot scry-KO choice freezes the
  // board until the player picks which revealed card to KO.
  if (hasPendingScryKoChoice(G)) return;
  // why: WP-603 / D-24413 — block-all guard: a pending Melter Fight KO/keep choice
  // freezes the board until the fighting player resolves every revealed deck top.
  if (hasPendingMelterKoChoice(G)) return;
  // why: WP-695 / D-24512 — block-all guards for the two interactive core mastermind
  // tactics (Ruthless Dictator scry-3 / Electromagnetic Bubble X-Men pick).
  if (hasPendingRuthlessDictatorChoice(G)) return;
  if (hasPendingElectromagneticBubbleChoice(G)) return;
  // why: block-all guard (WP-476 / D-24284) — a pending discard-to-limit choice
  // freezes the board until the current player picks which cards to discard.
  if (hasPendingDiscardChoice(G)) return;
  if (hasPendingPutCardsOnDeckChoice(G)) return;
  if (hasPendingReorderChoice(G)) return; // why: WP-479 / D-24286 block-all guard
  if (hasPendingDefeatChoice(G)) return; // why: WP-486 / D-24291 block-all guard
  if (hasPendingKoDiscardChoice(G)) return; // why: WP-693 / D-24510 block-all guard
  // why: block-all guard (D-24019) — optional-KO-reward choice pending; the
  // board is frozen until resolved (beside the D-24008 KO-hero check above).
  if (hasPendingPlayVillainTopChoice(G)) return; // why: WP-663 / D-24474 — block-all guard (Shadowed Thoughts play-villain-top choice)
  if (hasPendingOptionalKoReward(G)) return;
  if (hasPendingSmashDiscard(G)) return; // why: WP-676 / D-24492 — block-all guard (Smash discard-for-attack choice)
  if (hasPendingPutHandOnDeckTop(G)) return; // why: WP-700 / D-24519 — block-all guard (put-a-hand-card-on-deck-top choice)
  if (hasPendingRevealTopDispose(G)) return; // why: WP-702 / D-24521 — block-all guard (reveal-top discard-or-keep choice)
  if (hasPendingRevealThreeAssign(G)) return; // why: WP-753 / D-24580 — block-all guard (reveal-three draw / discard / KO assignment)
  if (hasPendingDoOver(G)) return; // why: WP-681 / D-24498 — block-all guard (Do-Over accept/decline choice)
  // why: block-all — pendingVictoryPileCardPick must be resolved before any other action (D-24067)
  if (hasPendingVictoryPileCardPick(G)) return;
  // why: block-all — pendingDrawOrEmpowered must be resolved before any other action (D-24069)
  if (hasPendingDrawOrEmpowered(G)) return;
  // why: block-all guard (WP-719 / D-24541) — a pending Covering Fire choice freezes the board.
  if (hasPendingCoveringFireChoice(G)) return;
  // why: block-all guard (WP-724 / D-24546) — a pending split-face "choose a side" freezes the board.
  if (hasPendingSplitFaceChoice(G)) return;
  if (hasPendingCountScaledChoice(G)) return;
  // why: block-all — pendingUndercoverChoice must be resolved before any other action (WP-678 / D-24494)
  if (hasPendingUndercoverChoice(G)) return;
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
  if (hasPendingSeatChoice(G)) return; // why: WP-684 / D-24501 — block-all (non-active/multi-seat pending choice)

  // why: D-24587 / D-24180 — exorcise spends like a recruit, so the Wound Healing
  // reverse lock applies: a player who healed this turn may not exorcise either.
  if (hasHealedThisTurn(G)) return;

  // Step 3: Mutate G
  // why: D-24587 / D-24180 — exorcise spends like a recruit: it spends through the
  // recruit path and marks the player as having acted (barring Wound Healing).
  G.turnEconomy = spendRecruit(G.turnEconomy, requiredCost);
  G.hasActedThisTurn = true;

  if (args.outcome === 'ko') {
    G.ko = koCard(G.ko, heroId);
  } else {
    // why: D-24327 — "choose a player to gain it" routes to that player's discard pile.
    // The recipient may be any seat, not only the active player.
    G.playerZones[args.recipientPlayerId as string]!.discard.push(heroId);
  }

  const haunter = clearHqHaunter(G, hqIndex);

  const refillResult = refillHqSlot(G.hq, hqIndex, G.heroDeck);
  G.hq = refillResult.hq;
  G.heroDeck = refillResult.heroDeck;

  let outcomeText = `KO'd it`;
  if (args.outcome === 'gain') {
    outcomeText = `gave it to Player ${args.recipientPlayerId as string}`;
  }
  pushLog(
    G,
    `Player ${ctx.currentPlayer} exorcised ${formatCardRef(G.cardDisplayData, heroId)} (HQ slot ${String(hqIndex)}) and ${outcomeText}.`,
    'applied',
  );

  if (haunter === null) return;
  if (haunter.kind === 'villain') {
    // why: D-24587 — exorcise is not a reveal: the Villain enters the City ignoring its
    // Ambush, and any escape it causes keeps reveal parity (enterCityIgnoringAmbush).
    enterCityIgnoringAmbush(
      G,
      { random, ctx: { currentPlayer: ctx.currentPlayer } },
      DEFAULT_IMPLEMENTATION_MAP,
      haunter.cardId,
    );
    return;
  }
  pushLog(
    G,
    `${formatCardRef(G.cardDisplayData, G.mastermind.baseCardId)} returns to the Mastermind space.`,
  );
}
