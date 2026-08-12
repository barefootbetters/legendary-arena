/**
 * Dodge move for the Legendary Arena game engine (WP-275 / D-24051).
 *
 * dodgeCard discards a Dodge-eligible card from the current player's hand and
 * draws one replacement card. It realizes the printed hero keyword "Dodge"
 * ("during your turn, you may discard this card from your hand to draw another
 * card"). Follows the three-step validation contract: validate args, check the
 * stage + block-all gates, mutate G via helpers.
 *
 * This is a non-core move that gates internally (same pattern as recruitHero
 * from WP-016 / revealVillainCard from WP-014A). It is NOT added to
 * CoreMoveName, CORE_MOVE_NAMES, or MOVE_ALLOWED_STAGES.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { discardFromHand } from './discardFromHand.js';
import { drawCardsIntoHand } from './drawCards.logic.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
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
import { getHooksForCard } from '../rules/heroAbility.types.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/** Arguments for the dodgeCard move. */
interface DodgeCardArgs {
  /** The ext_id of the Dodge card in the player's hand to discard. */
  cardId: string;
}

/**
 * Discards a Dodge card from the current player's hand and draws one
 * replacement card.
 *
 * Eligibility: the named card must be in the current player's hand AND carry a
 * `dodge` hook (any timing). Any ineligible call — non-dodge card, card not in
 * hand, wrong stage, or a pending block-all choice — returns silently with no
 * mutation of any kind. Moves never throw.
 *
 * "Ignore all the other text on that card" is automatically satisfied: the card
 * is discarded, never played, so its other abilities never execute — no
 * suppression logic is needed. The move never routes the dodged card through
 * playCard or executeHeroEffects.
 *
 * @param context - boardgame.io move context with G, ctx, random.
 * @param args - The ext_id of the hand card to dodge.
 */
export function dodgeCard({ G, ctx, ...context }: MoveContext, { cardId }: DodgeCardArgs): void {
  // Step 1: Validate args — a non-empty string cardId
  if (typeof cardId !== 'string' || cardId.length === 0) {
    return;
  }

  // Step 2: Stage gate (non-core move, internal gating)
  // why: D-24051 — dodging is a your-turn main-action-window action; non-core
  // moves gate internally per the recruitHero / WP-014A precedent.
  if (G.currentStage !== 'main') return;

  // why: D-24051 — block-all guard (D-24008): while a KO-a-Hero choice is pending
  // the board is frozen; dodgeCard returns with no side effects. Placed after the
  // stage gate, before any zone read/write, for board-freeze consistency.
  if (hasPendingKoHeroChoice(G)) return;
  // why: block-all guard (D-24282) — a pending Doombot scry-KO choice freezes the
  // board until the player picks which revealed card to KO.
  if (hasPendingScryKoChoice(G)) return;
  // why: block-all guard (WP-476 / D-24284) — a pending discard-to-limit choice
  // freezes the board until the current player picks which cards to discard.
  if (hasPendingDiscardChoice(G)) return;
  if (hasPendingReorderChoice(G)) return; // why: WP-479 / D-24286 block-all guard
  if (hasPendingDefeatChoice(G)) return; // why: WP-486 / D-24291 block-all guard
  // why: D-24051 — block-all guard (D-24019): optional-KO-reward choice pending;
  // the board is frozen until resolved (beside the D-24008 KO-hero check above).
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

  // Step 3: Eligibility — the card must be in the current player's hand AND carry
  // a dodge hook (read-only, timing-agnostic). pid = ctx.currentPlayer matches the
  // recruitHero precedent (zones + the log line keyed off ctx.currentPlayer).
  const pid = ctx.currentPlayer;
  const playerZones = G.playerZones[pid];
  if (!playerZones) return;
  if (!playerZones.hand.includes(cardId)) return;
  // why: the Array.isArray guard covers narrow test mocks that omit
  // G.heroAbilityHooks (getHooksForCard would otherwise iterate undefined).
  if (!Array.isArray(G.heroAbilityHooks)) return;
  const carriesDodge = getHooksForCard(G.heroAbilityHooks, cardId).some((hook) =>
    hook.keywords.includes('dodge'),
  );
  if (!carriesDodge) return;

  // Step 4: Mutate G
  // why: D-24051 — the printed "discard this card from your hand to draw another
  // card". Discard-before-draw is ordered, not incidental: pushing the dodged card
  // to discard FIRST guarantees a replacement is always drawable (the discard is
  // non-empty), so exactly one card is always drawn — in the empty-deck edge the
  // dodged card is reshuffled and drawn straight back into hand (rule-correct).
  // "Ignore all the other text on that card" is automatic: the card is discarded,
  // never played, so its other abilities never fire.
  // why: WP-498 / D-24301 — route the Dodge discard through the single
  // forced-discard chokepoint so a Dodge of a return-on-discard card fires the
  // reaction. discardFromHand returns `found`; a not-found target early-returns
  // BEFORE the reshuffle-then-draw (preserving the pre-chokepoint control flow).
  if (!discardFromHand(G, pid, cardId)) return;

  // why: D-24051 — context (the move-context rest-spread) carries random.Shuffle for
  // the empty-deck reshuffle (the same idiom drawCards uses); ctx itself has no
  // random, so passing context — not ctx — keeps the reshuffle path from throwing.
  drawCardsIntoHand(playerZones, 1, context as ShuffleProvider);

  // why: D-24051 — the log line is replay-visible and snapshotted; the format is
  // locked at this site to byte-equality (the recruitHero precedent). One push per
  // successful dodge. Never add timestamps or non-deterministic context.
  pushLog(G, 
    `Player ${ctx.currentPlayer} dodged ${formatCardRef(G.cardDisplayData, cardId)} (discarded from hand, drew 1 replacement)`,
  );
}
