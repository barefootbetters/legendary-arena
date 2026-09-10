/**
 * Recruit S.H.I.E.L.D. Officer move for the Legendary Arena game engine.
 *
 * recruitOfficer takes the top card of the shared S.H.I.E.L.D. Officer supply
 * (`G.piles.officers`) and places it in the current player's discard pile,
 * spending the officer recruit cost. Follows the three-step validation
 * contract: validate, check stage gate, mutate G.
 *
 * Mirrors recruitHero (a non-core move that gates internally, the WP-014A
 * precedent): it is NOT added to CoreMoveName, CORE_MOVE_NAMES, or
 * MOVE_ALLOWED_STAGES. It is registered in game.ts and dispatchable in
 * replay.execute so a recorded human game that recruits an Officer replays.
 *
 * Canonical rule (Marvel Legendary Universal Rules v23, §"HQ"): "You can also
 * recruit 'S.H.I.E.L.D. Officer' Heroes from the S.H.I.E.L.D. Officer stack" —
 * for 3 Recruit, with no per-turn limit (unlike Sidekicks). The pile-mutation
 * mirrors the WP-541 `gain-officer-current` villain reward (D-24350).
 *
 * No registry imports. Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { getAvailableRecruit, spendRecruit } from '../economy/economy.logic.js';
import { SHIELD_OFFICER_EXT_ID } from '../setup/pilesInit.js';
import { hasPendingKoHeroChoice } from './koHeroChoice.resolve.js';
import { hasPendingScryKoChoice } from './scryKoChoice.resolve.js';
import { hasPendingMelterKoChoice } from './melterKoChoice.resolve.js';
import { hasPendingDiscardChoice } from './discardChoice.resolve.js';
import { hasPendingPutCardsOnDeckChoice } from './putCardsOnDeckChoice.resolve.js';
import { hasPendingKoDiscardChoice } from './koDiscardChoice.resolve.js';
import { hasPendingReorderChoice } from './reorderChoice.resolve.js';
import { hasPendingDefeatChoice } from './defeatChoice.resolve.js';
import { hasPendingOptionalKoReward } from './optionalKoReward.resolve.js';
import { hasPendingSmashDiscard } from './smashDiscard.resolve.js';
import { hasPendingDoOver } from './doOver.resolve.js';
import { hasPendingPlayVillainTopChoice } from './playVillainTop.resolve.js';
import { hasPendingVictoryPileCardPick } from './resolveVictoryPileCardPick.js';
import { hasPendingDrawOrEmpowered } from './drawOrEmpowered.resolve.js';
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

/**
 * Officer recruit cost in Recruit points (D-24460). The authoritative value
 * lives in `G.cardStats[SHIELD_OFFICER_EXT_ID].cost` (set to 3 in
 * buildInitialGameState); this constant is the fallback for narrow test mocks
 * that omit the well-known cardStats entry — the recruitHero `?? 0` precedent.
 */
export const OFFICER_RECRUIT_COST = 3;

/**
 * Gains a S.H.I.E.L.D. Officer from the shared supply into a player's HAND (WP-681 /
 * D-24498 — the Battlefield Promotion reward variant).
 *
 * Distinct from the recruitOfficer move (which spends Recruit and lands the Officer in
 * the DISCARD pile) and from the WP-541 `gain-officer-current` reward (which also lands
 * in discard): this is a card-effect FREE gain that lands the Officer in the acting
 * player's hand so it can be played the same turn. The discard-bound gains are unchanged.
 *
 * // why: D-24498 — Battlefield Promotion's "you may gain a S.H.I.E.L.D. Officer to your
 * hand." An empty Officer supply is a no-op (returns false), so the reward silently
 * no-ops rather than throwing — moves never throw.
 *
 * @param G - Game state (mutated in place under Immer draft).
 * @param playerID - The player who gains the Officer.
 * @returns true when an Officer was moved to hand; false when the supply was empty or the
 *   player's zones were missing.
 */
export function gainOfficerToHand(G: LegendaryGameState, playerID: string): boolean {
  const officerId = G.piles.officers[0];
  if (officerId === null || officerId === undefined) {
    return false;
  }
  const zones = G.playerZones[playerID];
  if (!zones) {
    return false;
  }
  // why: pile[0] is the top card (the locked supply-pile convention); slice(1) drops it.
  G.piles.officers = G.piles.officers.slice(1);
  zones.hand = [...zones.hand, officerId];
  return true;
}

/**
 * Recruits a S.H.I.E.L.D. Officer from the shared supply.
 *
 * Removes the top card of `G.piles.officers` and places it in the current
 * player's discard pile, spending the officer recruit cost. No-args move — all
 * Officers are identical fungible tokens (SHIELD_OFFICER_EXT_ID), so there is
 * no slot or index to choose.
 *
 * @param context - boardgame.io move context with G, ctx.
 */
export function recruitOfficer({ G, ctx }: MoveContext): void {
  // Step 1: Validate — the shared Officer supply must be non-empty.
  // why: an exhausted supply is a silent no-op, never a throw — the deterministic
  // move contract. pile[0] is the top card (the locked supply-pile convention
  // gain-officer-current / gainWound use).
  const officerId = G.piles.officers[0];
  if (officerId === null || officerId === undefined) {
    return;
  }

  // why: guard a missing current-player zone (narrow test mocks) before any
  // mutation — accessing `.discard` on an undefined zone would throw, and moves
  // never throw.
  const zones = G.playerZones[ctx.currentPlayer];
  if (!zones) {
    return;
  }

  // why: silent failure preserves the deterministic move contract — insufficient
  // recruit points means the recruit cannot proceed. The cost is the well-known
  // 3 (canonical core S.H.I.E.L.D. Officer / Maria Hill), sourced from cardStats
  // with OFFICER_RECRUIT_COST as the fallback (D-24460).
  const requiredCost = G.cardStats[SHIELD_OFFICER_EXT_ID]?.cost ?? OFFICER_RECRUIT_COST;
  const availableRecruit = getAvailableRecruit(G.turnEconomy);
  if (availableRecruit < requiredCost) {
    return;
  }

  // Step 2: Stage gate (non-core move, internal gating)
  // why: recruiting happens during the main action window; non-core moves
  // gate internally per the WP-014A / recruitHero precedent.
  if (G.currentStage !== 'main') return;

  // why: block-all guard set — identical to recruitHero. While any interactive
  // choice is parked the board is frozen; this move returns with no side effects.
  // Placed after the stage gate, before any G/zone write.
  if (hasPendingKoHeroChoice(G)) return; // D-24008
  if (hasPendingScryKoChoice(G)) return; // D-24282
  if (hasPendingMelterKoChoice(G)) return; // WP-603 / D-24413
  if (hasPendingDiscardChoice(G)) return; // WP-476 / D-24284
  if (hasPendingPutCardsOnDeckChoice(G)) return; // WP-538 / D-24347
  if (hasPendingReorderChoice(G)) return; // WP-479 / D-24286
  if (hasPendingDefeatChoice(G)) return; // WP-486 / D-24291
  if (hasPendingKoDiscardChoice(G)) return; // why: WP-693 / D-24510 block-all guard
  if (hasPendingPlayVillainTopChoice(G)) return; // why: WP-663 / D-24474 — block-all guard (Shadowed Thoughts play-villain-top choice)
  if (hasPendingOptionalKoReward(G)) return; // D-24019
  if (hasPendingSmashDiscard(G)) return; // why: WP-676 / D-24492 — block-all guard (Smash discard-for-attack choice)
  if (hasPendingDoOver(G)) return; // why: WP-681 / D-24498 — block-all guard (Do-Over accept/decline choice)
  if (hasPendingVictoryPileCardPick(G)) return; // D-24067
  if (hasPendingDrawOrEmpowered(G)) return;
  if (hasPendingCountScaledChoice(G)) return;
  // why: block-all — pendingUndercoverChoice must be resolved before any other action (WP-678 / D-24494)
  if (hasPendingUndercoverChoice(G)) return; // D-24069
  if (hasPendingReturnZeroCostDiscard(G)) return; // D-24139
  if (hasPendingDiscardToPlay(G)) return; // WP-383 / D-24184
  if (hasPendingReturnOnDiscard(G)) return; // WP-498 / D-24301
  if (hasPendingGiveHqHeroChoice(G)) return; // WP-532 / D-24343
  if (hasPendingCopyPowersChoice(G)) return; // WP-535 / D-24345
  if (hasPendingSeatChoice(G)) return; // why: WP-684 / D-24501 — block-all (non-active/multi-seat pending choice)

  // why: D-24180 — a player who used the Wound Healing ability this turn may not
  // fight or recruit for the rest of the turn (the reverse lock).
  if (hasHealedThisTurn(G)) return;

  // Step 3: Mutate G
  // why: move the top Officer token from the shared supply to the current
  // player's discard (slice(1) drops pile[0]), spend the recruit, and mark the
  // player as having acted (D-24180 bars healing after a recruit).
  G.piles.officers = G.piles.officers.slice(1);
  zones.discard = [...zones.discard, officerId];
  G.turnEconomy = spendRecruit(G.turnEconomy, requiredCost);
  G.hasActedThisTurn = true;

  // why: replay-visible log line; the format is locked at this site (never add
  // timestamps or non-deterministic context). G.messages is hash-excluded
  // (D-24081), so this line does not move any finalStateHash oracle.
  pushLog(G,
    `Player ${ctx.currentPlayer} recruited ${formatCardRef(G.cardDisplayData, officerId)} from the S.H.I.E.L.D. Officer supply (spent ${String(requiredCost)} recruit; officers pile: ${String(G.piles.officers.length)}).`,
  );
}
