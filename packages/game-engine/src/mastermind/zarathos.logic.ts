/**
 * Zarathos's shared Haunt reads and his Master Strike (WP-758 / D-24588).
 *
 * Zarathos (mdns) is the first Mastermind that Haunts an HQ Hero (the WP-757 Haunt
 * substrate, D-24587). His Master Strike and all four of his Tactics make him Haunt
 * "the highest-cost unhaunted Hero in the HQ", the Tactics narrowed to a class pair.
 * While he haunts, he can't be fought (`fightMastermind`'s `isMastermindHaunting`
 * guard), so the table must exorcise that Hero before attacking him again.
 *
 * This module is the one home of the highest-cost selector, the Haunt call, the
 * "you have a Hero of class X" read and the strike. The strike arm
 * (rules/mastermindHandlers.ts) and the tactic resolvers (rules/tacticHandlers.ts)
 * both read it. It never imports either of those modules, so neither import cycles.
 *
 * Pure helpers over G: no boardgame.io import, no registry import, no .reduce(),
 * never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { hauntHqSlot, isHqSlotHaunted, isMastermindHaunting } from '../board/haunt.logic.js';
import { gainWoundWithOutcome } from '../board/wounds.logic.js';
import { cardHasClassWhenPlayed } from '../hero/sizeChanging.logic.js';
import {
  offPlayCardStats,
  offPlayCardTraits,
  playedCardIdsStillInPlay,
} from '../hero/splitCard.logic.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';
import { seatsInTurnOrderFrom } from '../turn/seatOrder.logic.js';

/** Zarathos's mastermind id (`data/sweep-fixtures/mastermind-ids.full.json`). */
export const ZARATHOS_MASTERMIND_ID = 'mdns/zarathos';

/** The log-line source name for Zarathos's Master Strike. */
const MASTER_STRIKE_SOURCE = 'Zarathos Master Strike';

/**
 * Reports whether a card outside play (in a hand or in the HQ) has any of the given
 * Hero Classes.
 *
 * // why: D-24588 — "[class A] and/or [class B] Hero" is a class OR: a Hero of
 * either class qualifies, and a dual-class Hero matching both still counts once.
 * offPlayCardTraits is the off-play view (rules v23 p.49: a Divided card counts as
 * all of its classes outside play; D-24523: both printed class slots count).
 *
 * @param G - Game state (read-only).
 * @param cardId - The card ext_id (a hand card or an HQ Hero).
 * @param classes - The class slugs, any one of which qualifies.
 * @returns true when the card's off-play classes include any of `classes`.
 */
export function offPlayCardHasAnyClass(
  G: LegendaryGameState,
  cardId: CardExtId,
  classes: readonly string[],
): boolean {
  const traits = offPlayCardTraits(G, cardId);
  if (traits === undefined) {
    return false;
  }
  if (traits.heroClass !== undefined && traits.heroClass !== null && classes.includes(traits.heroClass)) {
    return true;
  }
  return traits.heroClass2 !== undefined && traits.heroClass2 !== null && classes.includes(traits.heroClass2);
}

/**
 * Selects the HQ slot Zarathos Haunts: the highest-cost occupied, unhaunted slot,
 * optionally narrowed to Heroes of any of `classes`.
 *
 * // why: D-24588 — a cost tie goes to the LOWEST HQ index (the strict `>` below keeps
 * the first slot seen), the deterministic stand-in for the tabletop's free pick among
 * equals. Cost is the off-play printed cost (the Dominate the Weak read, D-24754).
 *
 * @param G - Game state (read-only).
 * @param classes - The tactic's class pair, or undefined for the strike (any Hero).
 * @returns The selected HQ slot index, or null when no slot qualifies.
 */
export function selectHighestCostUnhauntedHqIndex(
  G: LegendaryGameState,
  classes?: readonly string[],
): number | null {
  let selectedIndex: number | null = null;
  let selectedCost = Number.NEGATIVE_INFINITY;
  for (let hqIndex = 0; hqIndex < G.hq.length; hqIndex++) {
    const heroId = G.hq[hqIndex];
    if (heroId === null || heroId === undefined || isHqSlotHaunted(G, hqIndex)) {
      continue;
    }
    if (classes !== undefined && !offPlayCardHasAnyClass(G, heroId, classes)) {
      continue;
    }
    const heroCost = offPlayCardStats(G, heroId)?.cost ?? 0;
    if (heroCost > selectedCost) {
      selectedCost = heroCost;
      selectedIndex = hqIndex;
    }
  }
  return selectedIndex;
}

/**
 * Has Zarathos Haunt the highest-cost unhaunted HQ Hero (of `classes`, when given).
 *
 * // why: D-24588 — the double-haunt guard. While Zarathos already haunts a slot this is
 * a logged no-op, for the strike and the tactic callers alike, so there is never a
 * second `{ kind: 'mastermind' }` haunter. The strike checks it first by printed text
 * ("if Zarathos is not already haunting"); the tactics are only reachable while he is
 * not haunting (the WP-757 fight guard), so for them the guard is defence in depth.
 *
 * @param G - Game state (mutated: `G.hqHaunters`, `G.messages`).
 * @param sourceName - The printed source for the log line (strike or tactic name).
 * @param classes - The tactic's class pair, or undefined for the strike.
 * @returns true when Zarathos started haunting a slot.
 */
export function zarathosHauntHighestCost(
  G: LegendaryGameState,
  sourceName: string,
  classes?: readonly string[],
): boolean {
  if (isMastermindHaunting(G)) {
    pushLog(G, `Zarathos is already haunting a Hero, so he haunts no other (${sourceName}).`, 'neutral');
    return false;
  }
  const hqIndex = selectHighestCostUnhauntedHqIndex(G, classes);
  if (hqIndex === null) {
    pushLog(G, `No unhaunted Hero in the HQ ${describeClassFilter(classes)}to haunt; Zarathos stays in the Mastermind space (${sourceName}).`, 'blocked');
    return false;
  }
  const heroId = G.hq[hqIndex] as CardExtId;
  if (!hauntHqSlot(G, hqIndex, { kind: 'mastermind' })) {
    // why: unreachable — the selector only returns an occupied, unhaunted slot, which
    // is exactly what hauntHqSlot accepts. Logged rather than thrown (effects never throw).
    pushLog(G, `Zarathos could not haunt HQ slot ${String(hqIndex)} (${sourceName}).`, 'blocked');
    return false;
  }
  pushLog(G, `Zarathos haunts ${resolveCardName(G.cardDisplayData, heroId)} in HQ slot ${String(hqIndex)} (${sourceName}).`, 'applied');
  return true;
}

/**
 * Describes a class filter for the "no Hero to haunt" log line.
 *
 * @param classes - The class pair, or undefined.
 * @returns "" for no filter, else "of class a or b " (trailing space).
 */
function describeClassFilter(classes: readonly string[] | undefined): string {
  if (classes === undefined || classes.length === 0) {
    return '';
  }
  return `of class ${classes.join(' or ')} `;
}

/**
 * Reports whether a player "has" a Hero of any of the given classes: one in their hand
 * or one they played this turn that is still in play.
 *
 * // why: rules v23 L3439-3447 — "Heroes you have" are the cards in your hand plus the
 * cards you played this turn; the deck and discard pile do not count, nor does a played
 * card that has since left play (playedCardIdsStillInPlay). A played card's class is
 * its effective class this turn (cardHasClassWhenPlayed: printed classes plus Copy
 * Powers, D-24801); a hand card's is the off-play view (offPlayCardHasAnyClass).
 *
 * @param G - Game state (read-only).
 * @param seat - The player to inspect.
 * @param classes - The class slugs, any one of which qualifies.
 * @returns true when the player has such a Hero.
 */
export function playerHasHeroOfClasses(
  G: LegendaryGameState,
  seat: string,
  classes: readonly string[],
): boolean {
  const zones = G.playerZones[seat];
  if (!zones) {
    return false;
  }
  for (const cardId of zones.hand) {
    if (offPlayCardHasAnyClass(G, cardId, classes)) {
      return true;
    }
  }
  for (const cardId of playedCardIdsStillInPlay(G, zones.inPlay)) {
    for (const classSlug of classes) {
      if (cardHasClassWhenPlayed(G, cardId, classSlug)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Reports whether any Hero in the HQ is haunted, by a Villain or by a Mastermind.
 *
 * // why: the printed "If any Heroes in the HQ are haunted" asks about Heroes, so a
 * haunter left on an empty slot after the Hero Deck ran dry does not count.
 *
 * @param G - Game state (read-only).
 * @returns true when at least one occupied HQ slot has a haunter.
 */
export function isAnyHqHeroHaunted(G: LegendaryGameState): boolean {
  for (let hqIndex = 0; hqIndex < G.hq.length; hqIndex++) {
    const heroId = G.hq[hqIndex];
    if (heroId !== null && heroId !== undefined && isHqSlotHaunted(G, hqIndex)) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves Zarathos's Master Strike: "If any Heroes in the HQ are haunted, each player
 * gains a Wound. Then if Zarathos is not already haunting, he Haunts the highest-cost
 * unhaunted Hero in the HQ."
 *
 * // why: D-24588 — the order is load-bearing. The Wound check reads the HQ BEFORE this
 * strike haunts, so the first strike (nothing haunted yet) wounds nobody; a strike while
 * Zarathos already haunts wounds everyone and haunts nothing more.
 *
 * @param G - Game state (mutated: Wound supply, discards, `G.hqHaunters`, `G.messages`).
 * @param currentPlayer - The active player, or null in stub contexts (sorted order).
 */
export function resolveZarathosStrike(G: LegendaryGameState, currentPlayer: string | null): void {
  if (isAnyHqHeroHaunted(G)) {
    // why: rules v23 L2247 / D-24780 — each player in turn, the current player first and
    // then clockwise: the order decides who misses the last Wound in the supply and the
    // order Flying Shield Block is asked in.
    for (const seat of seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)) {
      dealStrikeWound(G, seat);
    }
  } else {
    pushLog(G, `[${MASTER_STRIKE_SOURCE}] No Hero in the HQ is haunted, so no one gains a Wound.`, 'neutral');
  }
  zarathosHauntHighestCost(G, MASTER_STRIKE_SOURCE);
}

/**
 * Gives one strike Wound to `seat` through the Wound chokepoint and logs it honestly.
 *
 * // why: WP-682 / D-24499 — gainWoundWithOutcome is the gainWoundForPlayer chokepoint
 * (Diving Block / Flying Shield Block); D-24673 — a Wound Diving Block may still return
 * is logged as "would gain".
 *
 * @param G - Game state (mutated).
 * @param seat - The player gaining the Wound.
 */
function dealStrikeWound(G: LegendaryGameState, seat: string): void {
  const outcome = gainWoundWithOutcome(G, seat);
  if (outcome === 'gained') {
    pushLog(G, `[${MASTER_STRIKE_SOURCE}] Player ${seat} gained a Wound.`, 'applied');
  } else if (outcome === 'diving-block-pending') {
    pushLog(G, `[${MASTER_STRIKE_SOURCE}] Player ${seat} would gain a Wound — Diving Block can prevent it.`, 'applied');
  } else {
    pushLog(G, `[${MASTER_STRIKE_SOURCE}] Player ${seat} gained no Wound — the Wound supply is empty.`, 'blocked');
  }
}
