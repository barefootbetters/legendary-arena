/**
 * Recruit Sidekick move + the on-play Sidekick return for the Legendary Arena
 * game engine (WP-842 / D-24776).
 *
 * recruitSidekick takes the top card of the shared Sidekick Stack
 * (`G.piles.sidekicks`) and places it in the current player's discard pile,
 * spending the Sidekick recruit cost, at most once per turn. Follows the
 * three-step validation contract: validate, check stage gate, mutate G.
 *
 * Mirrors recruitOfficer (WP-648 / D-24460), a non-core move that gates
 * internally: it is NOT added to CoreMoveName, CORE_MOVE_NAMES, or
 * MOVE_ALLOWED_STAGES, and NOT added to SIMULATION_MOVE_NAMES. It is registered
 * in game.ts and dispatchable in replay.execute so a recorded human game that
 * recruits a Sidekick replays.
 *
 * Canonical rule (Marvel Legendary Universal Rules v23, §"HQ" L727-729 and
 * "Sidekicks & Special Sidekicks" L3212-3233): recruit "Sidekicks (no more than
 * once per turn, using Recruit points) from the Sidekick stack"; "When you play
 * any Sidekick, return it to the bottom of the Sidekick Stack"; "You still
 * 'played' that Sidekick". The printed Sidekick (Secret Wars Vol. 1, cost 2):
 * "You may return this card to the Sidekick Stack. If you do, draw two cards."
 *
 * No registry imports. Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { getAvailableRecruit, markSidekickRecruited, recordSidekickReturned, spendRecruit } from '../economy/economy.logic.js';
import { SIDEKICK_EXT_ID } from '../setup/pilesInit.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { drawCardsIntoHand } from './drawCards.logic.js';
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
import { hasPendingMoveVillainChoice } from './moveVillainChoice.resolve.js';
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

/**
 * Sidekick recruit cost in Recruit points (D-24776). The authoritative value
 * lives in `G.cardStats[SIDEKICK_EXT_ID].cost` (set to 2 in
 * buildInitialGameState); this constant is the fallback for narrow test mocks
 * that omit the well-known cardStats entry — the OFFICER_RECRUIT_COST precedent.
 */
export const SIDEKICK_RECRUIT_COST = 2;

/**
 * Cards drawn when a played Sidekick returns to the Sidekick Stack ("If you do,
 * draw two cards." — the printed Secret Wars Vol. 1 Sidekick; D-24776).
 */
export const SIDEKICK_RETURN_DRAW_COUNT = 2;

/**
 * Recruits a Sidekick from the shared Sidekick Stack, at most once per turn.
 *
 * Removes the top card of `G.piles.sidekicks` and places it in the current
 * player's discard pile, spending the Sidekick recruit cost and marking this
 * turn's one Sidekick recruit as used. No-args move — all Sidekicks are
 * identical fungible tokens (SIDEKICK_EXT_ID), so there is no slot or index to
 * choose.
 *
 * @param context - boardgame.io move context with G, ctx.
 */
export function recruitSidekick({ G, ctx }: MoveContext): void {
  // Step 1: Validate — the Sidekick Stack must be non-empty.
  // why: an exhausted Stack is a silent no-op, never a throw — the deterministic
  // move contract. pile[0] is the top card (the locked supply-pile convention
  // recruitOfficer / gain-officer-current / gainWound use).
  const sidekickId = G.piles.sidekicks[0];
  if (sidekickId === null || sidekickId === undefined) {
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
  // recruit points means the recruit cannot proceed. The cost is the printed 2
  // (Secret Wars Vol. 1 Sidekick), sourced from cardStats with
  // SIDEKICK_RECRUIT_COST as the fallback (D-24776).
  const requiredCost = G.cardStats[SIDEKICK_EXT_ID]?.cost ?? SIDEKICK_RECRUIT_COST;
  const availableRecruit = getAvailableRecruit(G.turnEconomy);
  if (availableRecruit < requiredCost) {
    return;
  }

  // Step 2: Stage gate (non-core move, internal gating)
  // why: recruiting happens during the main action window; non-core moves
  // gate internally per the WP-014A / recruitHero precedent.
  if (G.currentStage !== 'main') return;

  // why: rules v23 L727-729 — Sidekicks are recruited "no more than once per turn".
  // Only this move sets the flag; a card effect that gains a Sidekick is exempt
  // (rules v23 L3216-3218) and never reads or writes it (D-24776).
  if (G.turnEconomy.hasRecruitedSidekickThisTurn === true) return;

  // why: block-all guard set — identical to recruitHero (copied verbatim from
  // recruitOfficer, WP-842). While any interactive choice is parked the board is
  // frozen; this move returns with no side effects.
  // Placed after the stage gate, before any G/zone write.
  if (hasPendingKoHeroChoice(G)) return; // D-24008
  if (hasPendingScryKoChoice(G)) return; // D-24282
  if (hasPendingMelterKoChoice(G)) return; // WP-603 / D-24413
  // why: WP-695 / D-24512 — block-all guards for the two interactive core mastermind
  // tactics (Ruthless Dictator scry-3 / Electromagnetic Bubble X-Men pick).
  if (hasPendingRuthlessDictatorChoice(G)) return;
  if (hasPendingElectromagneticBubbleChoice(G)) return;
  if (hasPendingDiscardChoice(G)) return; // WP-476 / D-24284
  if (hasPendingPutCardsOnDeckChoice(G)) return; // WP-538 / D-24347
  if (hasPendingReorderChoice(G)) return; // WP-479 / D-24286
  if (hasPendingDefeatChoice(G)) return; // WP-486 / D-24291
  if (hasPendingKoDiscardChoice(G)) return; // why: WP-693 / D-24510 block-all guard
  if (hasPendingPlayVillainTopChoice(G)) return; // why: WP-663 / D-24474 — block-all guard (Shadowed Thoughts play-villain-top choice)
  if (hasPendingOptionalKoReward(G)) return; // D-24019
  if (hasPendingSmashDiscard(G)) return; // why: WP-676 / D-24492 — block-all guard (Smash discard-for-attack choice)
  if (hasPendingPutHandOnDeckTop(G)) return; // why: WP-700 / D-24519 — block-all guard (put-a-hand-card-on-deck-top choice)
  if (hasPendingRevealTopDispose(G)) return; // why: WP-702 / D-24521 — block-all guard (reveal-top discard-or-keep choice)
  if (hasPendingRevealThreeAssign(G)) return; // why: WP-753 / D-24580 — block-all guard (reveal-three draw / discard / KO assignment)
  if (hasPendingDoOver(G)) return; // why: WP-681 / D-24498 — block-all guard (Do-Over accept/decline choice)
  if (hasPendingVictoryPileCardPick(G)) return; // D-24067
  if (hasPendingDrawOrEmpowered(G)) return;
  // why: block-all guard (WP-719 / D-24541) — a pending Covering Fire choice freezes the board.
  if (hasPendingCoveringFireChoice(G)) return;
  // why: block-all guard (WP-795 / D-24664) — a pending Spinning Cyclone move-a-Villain choice freezes the board.
  if (hasPendingMoveVillainChoice(G)) return;
  // why: block-all guard (WP-724 / D-24546) — a pending split-face "choose a side" freezes the board.
  if (hasPendingSplitFaceChoice(G)) return;
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
  // why: move the top Sidekick token from the Stack to the current player's
  // discard (slice(1) drops pile[0]), spend the recruit, mark this turn's one
  // Sidekick recruit as used, and mark the player as having acted (D-24180 bars
  // healing after a recruit).
  G.piles.sidekicks = G.piles.sidekicks.slice(1);
  zones.discard = [...zones.discard, sidekickId];
  G.turnEconomy = markSidekickRecruited(spendRecruit(G.turnEconomy, requiredCost));
  G.hasActedThisTurn = true;

  // why: replay-visible log line; the format is locked at this site (D-24776; never
  // add timestamps or non-deterministic context). G.messages is hash-excluded
  // (D-24081), so this line does not move any finalStateHash oracle.
  pushLog(G,
    `Player ${ctx.currentPlayer} recruited ${formatCardRef(G.cardDisplayData, sidekickId)} from the Sidekick Stack (spent ${String(requiredCost)} recruit; sidekicks pile: ${String(G.piles.sidekicks.length)}).`,
  );
}

/**
 * Returns a just-played Sidekick to the bottom of the Sidekick Stack and draws two
 * (WP-842 / D-24776).
 *
 * Called as the last statement of applyCardPlay, only for SIDEKICK_EXT_ID. The
 * Sidekick leaves inPlay, goes to the END of `G.piles.sidekicks` (the bottom), and
 * is recorded in `sidekicksReturnedThisTurn` so it still counts as played this
 * turn. The draw respects the draw lock and counts toward `cardsDrawn`.
 *
 * // why: D-24776 — the printed "You may return this card" is collapsed to an
 * automatic return (Jeff, 2026-10-25): a plain Sidekick has no Attack, Recruit or
 * class, so keeping it only puts a blank card back in the deck; declining is
 * dominated in every case this engine can reach.
 *
 * @param G - The game state, mutated in place.
 * @param context - The move context rest (carries random for the draw reshuffle).
 *   `unknown` because applyCardPlay's `Omit<MoveContext, 'G' | 'playerID'>` does not
 *   type-check as ShuffleProvider (the applyGrantedOutOfTime precedent).
 * @param playerID - The player who played the Sidekick.
 */
export function returnPlayedSidekick(
  G: LegendaryGameState,
  context: unknown,
  playerID: string,
): void {
  const zones = G.playerZones[playerID];
  if (!zones) {
    return;
  }
  // why: a granted Out of Time set-aside (applyGrantedOutOfTime, which runs first)
  // already moved the Sidekick out of play; only return it while it is still the
  // last inPlay entry, so the set-aside wins and nothing else in play is touched.
  if (zones.inPlay[zones.inPlay.length - 1] !== SIDEKICK_EXT_ID) {
    return;
  }

  // why: the END of the pile is the bottom (pile[0] is the top, the supply-pile
  // convention recruitSidekick reads).
  zones.inPlay = zones.inPlay.slice(0, -1);
  G.piles.sidekicks = [...G.piles.sidekicks, SIDEKICK_EXT_ID];
  G.turnEconomy = recordSidekickReturned(G.turnEconomy);

  // why: WP-731 / D-24552 — under Venompool's draw lock the return still happens
  // (it thins the deck) but nothing is drawn; logged `blocked` like heroEffectDraw.
  if (G.turnEconomy.drawsLocked === true) {
    pushLog(G,
      `Player ${playerID} returned a Sidekick to the bottom of the Sidekick Stack but can't draw — no more draws this turn.`,
      'blocked',
      SIDEKICK_EXT_ID,
    );
    return;
  }

  const handBefore = zones.hand.length;
  // why: context is narrowed to ShuffleProvider here because a deck reshuffle needs
  // random.Shuffle; the move context satisfies it structurally (the heroEffectDraw
  // precedent).
  drawCardsIntoHand(zones, SIDEKICK_RETURN_DRAW_COUNT, context as ShuffleProvider);
  const drawnCount = zones.hand.length - handBefore;
  // why: WP-665 / D-24476 + D-24732 — a card-effect draw counts toward the per-turn
  // draw total the `cardsDrawnThisTurnAtLeast` gate reads (the realized count).
  G.turnEconomy.cardsDrawn += drawnCount;
  // why: WP-434 — a full draw is `applied`; a short one (deck and discard ran dry)
  // is `partial`.
  const outcome = drawnCount === SIDEKICK_RETURN_DRAW_COUNT ? 'applied' : 'partial';
  pushLog(G,
    `Player ${playerID} returned a Sidekick to the bottom of the Sidekick Stack and drew ${String(drawnCount)} card(s).`,
    outcome,
    SIDEKICK_EXT_ID,
  );
}
