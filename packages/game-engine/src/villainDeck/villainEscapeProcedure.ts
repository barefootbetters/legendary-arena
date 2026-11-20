/**
 * The rulebook Villain escape procedure (WP-793 / D-24656).
 *
 * Rules v23 L556–L570: when a Villain escapes, in this order,
 *   1. it KOs a Hero costing 6 or less from the HQ — the player whose turn it is
 *      chooses which — and the HQ space refills from the Hero Deck;
 *   2. if it carried any Bystanders away, each player discards a card;
 *   3. its own Escape effect resolves.
 *
 * Step 3 resolves inside the move that caused the escape (`resolveVillainEscape`).
 * Steps 1–2 need player choices, and the escape site has no boardgame.io `events`, can
 * run several times in one move, and the seat-choice slot holds one choice. So the escape
 * RECORDS what it owes on the G-only FIFO `G.pendingEscapeProcedures`, and the play-phase
 * `turn.onMove` OPENS it after the move through the WP-684 seat-choice capability — the
 * Diving Block wave-opener precedent (D-24499 / D-24648). Steps 1–2 therefore resolve
 * after the triggering move: the accepted deviation recorded in D-24656 point 4.
 *
 * These are plain G-mutating helpers (the opener, the builders, the KO helper and the two
 * kind-specific applies), NOT boardgame.io moves. No registry imports, no boardgame.io
 * import, no .reduce(). Never throws.
 */

import type {
  LegendaryGameState,
  PendingEffectDiscardTraitFilter,
  PendingEscapeEffectDiscard,
  PendingEscapeProcedure,
  PendingSeatChoice,
  SeatChoiceOption,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
// why: WP-793 / D-24656 — the park entry point. seatChoice.resolve imports this module's
// applies, so the two form a runtime-safe import cycle (each references the other ONLY
// inside function bodies, never at module top level), so ESM resolves both bindings by
// call time (the divingBlock.logic.ts precedent).
import { parkSeatChoice } from '../moves/seatChoice.resolve.js';
// why: WP-793 / D-24656 — the shared pending-choice aggregate the opener waits on. A third
// runtime-safe cycle runs this module → phaseCard → seatChoice.resolve / resolveReturnOnDiscard
// / playVillainTop.resolve → (villainDeck.reveal →) this module; phaseCard holds only imports
// and functions at top level, and this module reads hasAnyPendingChoice only inside a
// function body, so ESM resolves the binding by call time (the divingBlock.logic.ts precedent).
import { hasAnyPendingChoice } from '../moves/phaseCard.js';
import { discardFromHand } from '../moves/discardFromHand.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { applyPileDepletionResourceLoss } from '../rules/schemeResourceLoss.js';
import { koCard } from '../board/ko.logic.js';
import { refillHqSlot } from '../board/city.logic.js';
import { formatCardRef, resolveCardName } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';
// why: WP-817 / D-24750 — the Escape-effect discard reuses the fight-discard cost
// predicate and formatter (one cost predicate), and labels each option with the same
// off-play cost that predicate reads.
import {
  listEligibleHandCardsByCost,
  listEligibleHandCardsByTrait,
  formatEligibleCostList,
} from '../moves/villainDefeatRequirement.logic.js';
import { offPlayCardStats, matchesGreyHeroFilter } from '../hero/splitCard.logic.js';
// why: WP-902 / D-24859 — the zero-cost filter reads a Wound as cost 0 (D-24583, a Wound has no
// stats entry); the Snapdragon draw goes through the one draw helper; Iron Maiden's Undercover
// send reuses the shared Undercover move and Hero predicate, and records an in-play send.
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { drawCardsIntoHand } from '../moves/drawCards.logic.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
// why: WP-902 / D-24859 — the heroEffects imports are read only inside function bodies, closing a
// runtime-safe cycle (this module → heroEffects.execute → … → seatChoice.resolve → this module),
// safe for the same reason as the parkSeatChoice cycle above (the L32-41 precedent).
import { moveCardUndercover, isYourHeroUndercoverCandidate } from '../hero/heroEffects.execute.js';
import { recordPlayedCardLeftPlay } from '../economy/economy.logic.js';
// why: WP-837 / D-24770 — Frost Giant Warrior's Wounds go through the Wound chokepoint.
// This closes a fourth function-body-only cycle (wounds.logic → divingBlock.logic →
// seatChoice.resolve → this module), runtime-safe for the same reason as the three above.
import { gainWoundWithOutcome } from '../board/wounds.logic.js';
// why: WP-837 / D-24770 — the one Wound option label (WP-845's reveal-or-wound prompt).
// Read only inside function bodies, so the cycle through seatChoice.resolve is safe.
import { VILLAIN_EFFECT_WOUND_OPTION_LABEL } from '../moves/revealOrWoundChoice.logic.js';
import { seatsInTurnOrderFrom } from '../turn/seatOrder.logic.js';

/** The seat-choice kind for an escape's HQ-KO pick (step 1). */
export const ESCAPE_HQ_KO_KIND = 'escape-hq-ko';

/** The seat-choice kind for an escape's every-player Bystander discard (step 2). */
export const ESCAPE_BYSTANDER_DISCARD_KIND = 'escape-bystander-discard';

/** The seat-choice kind for an owed Escape-effect cost-filtered discard (WP-817 / D-24750). */
export const ESCAPE_EFFECT_COST_DISCARD_KIND = 'escape-effect-cost-discard';

/** The seat-choice kind for an owed every-player Hero-trait discard (WP-837 / D-24770). */
export const VILLAIN_EFFECT_TRAIT_DISCARD_KIND = 'villain-effect-trait-discard';

/** The seat-choice kind for an owed every-player discard of any one hand card (WP-839 / D-24772). */
export const VILLAIN_EFFECT_ANY_CARD_DISCARD_KIND = 'villain-effect-any-card-discard';

/** The seat-choice kind for Snapdragon's every-player non-grey discard + draw (WP-902 / D-24859). */
export const VILLAIN_EFFECT_NON_GREY_DISCARD_THEN_DRAW_KIND = 'villain-effect-non-grey-discard-then-draw';

/** The seat-choice kind for Iron Maiden's mandatory non-grey Undercover send (WP-902 / D-24859). */
export const VILLAIN_EFFECT_UNDERCOVER_EACH_PLAYER_KIND = 'villain-effect-undercover-each-player';

// why: rules v23 L561 — "the escaping Villain KOs a Hero that costs 6 or less from the HQ".
// A Hero costing 7 or more is never offered or KO'd.
export const ESCAPE_HQ_KO_MAX_COST = 6;

/**
 * Minimal boardgame.io events surface the opener needs (setActivePlayers via
 * parkSeatChoice). Optional so a unit / sim / replay context without a live framework
 * is a guarded no-op (the stage ride is skipped there).
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/** One HQ Hero eligible for an escape's KO. */
interface EligibleEscapeHqHero {
  cardId: CardExtId;
  slotIndex: number;
  cost: number;
}

/**
 * Records the escape procedure an escaped Villain owes (steps 1–2), at the back of the
 * FIFO. Creates `G.pendingEscapeProcedures` lazily.
 *
 * @param G - The game state, mutated in place.
 * @param escapedCardId - The Villain that escaped.
 * @param chooserPlayerID - The player whose turn it is (chooses the HQ KO).
 * @param hasCarriedBystanders - Whether the escape carried at least one Bystander away.
 */
export function enqueueEscapeProcedure(
  G: LegendaryGameState,
  escapedCardId: CardExtId,
  chooserPlayerID: string,
  hasCarriedBystanders: boolean,
): void {
  const entry: PendingEscapeProcedure = {
    escapedCardId,
    chooserPlayerID,
    hasCarriedBystanders,
    isHqKoResolved: false,
  };
  if (G.pendingEscapeProcedures === undefined) {
    G.pendingEscapeProcedures = [];
  }
  G.pendingEscapeProcedures.push(entry);
}

/**
 * Lists the HQ Heroes an escape may KO: every non-null HQ slot whose cost is
 * `ESCAPE_HQ_KO_MAX_COST` or less, sorted cost ascending, then slot ascending.
 *
 * @param G - The game state (read only).
 * @returns The eligible Heroes in offer order.
 */
function listEligibleEscapeHqHeroes(G: LegendaryGameState): EligibleEscapeHqHero[] {
  const eligible: EligibleEscapeHqHero[] = [];
  for (let slotIndex = 0; slotIndex < G.hq.length; slotIndex++) {
    const cardId = G.hq[slotIndex];
    if (cardId === null || cardId === undefined) {
      continue;
    }
    // why: a Hero with no cardStats entry (a narrow test G) counts as cost 0, the
    // koFromHq / secretInvasion convention.
    const cost = G.cardStats[cardId]?.cost ?? 0;
    if (cost > ESCAPE_HQ_KO_MAX_COST) {
      continue;
    }
    eligible.push({ cardId, slotIndex, cost });
  }
  eligible.sort((entryA, entryB) => {
    if (entryA.cost !== entryB.cost) {
      return entryA.cost - entryB.cost;
    }
    return entryA.slotIndex - entryB.slotIndex;
  });
  return eligible;
}

/**
 * KOs one HQ Hero for an escape and refills its HQ space from the Hero Deck (an empty
 * Hero Deck leaves the space empty, D-13503). A Hero no longer in the HQ is a logged
 * no-op. A haunter stays in its HQ space when the Hero leaves (D-24587).
 *
 * @param G - The game state, mutated in place.
 * @param heroCardId - The HQ Hero to KO.
 * @param villainCardId - The escaped Villain (named in the log line).
 * @returns true when the Hero was KO'd.
 */
export function koHqHeroForEscape(
  G: LegendaryGameState,
  heroCardId: CardExtId,
  villainCardId: CardExtId,
): boolean {
  const slot = G.hq.indexOf(heroCardId);
  if (slot === -1) {
    pushLog(G,
      `Escape: ${formatCardRef(G.cardDisplayData, heroCardId)} is no longer in the HQ — nothing was KO'd.`,
    );
    return false;
  }
  // why: the koFromHq remove-then-refill template (schemeTwistResolvers.ts) — pure helpers
  // return new arrays, assigned back onto G.
  G.hq[slot] = null;
  G.ko = koCard(G.ko, heroCardId);
  const refill = refillHqSlot(G.hq, slot, G.heroDeck);
  G.hq = refill.hq;
  G.heroDeck = refill.heroDeck;
  pushLog(G,
    `Escape: ${formatCardRef(G.cardDisplayData, villainCardId)} KO'd ${formatCardRef(G.cardDisplayData, heroCardId)} from the HQ.`,
  );
  return true;
}

/**
 * Builds the step-1 HQ-KO seat choice, addressed to the escape's chooser only: one option
 * per eligible Hero, in eligibility order.
 *
 * @param G - The game state (read for card names).
 * @param chooserPlayerID - The seat that chooses.
 * @param eligible - The eligible HQ Heroes, in offer order (two or more).
 * @returns The pending HQ-KO choice.
 */
export function buildEscapeHqKoChoice(
  G: LegendaryGameState,
  chooserPlayerID: string,
  eligible: readonly EligibleEscapeHqHero[],
): PendingSeatChoice {
  const options: SeatChoiceOption[] = [];
  for (const hero of eligible) {
    options.push({
      label: `${resolveCardName(G.cardDisplayData, hero.cardId)} (cost ${String(hero.cost)})`,
      cardId: hero.cardId,
    });
  }
  return {
    kind: ESCAPE_HQ_KO_KIND,
    addressedSeats: [chooserPlayerID],
    seatPrompts: { [chooserPlayerID]: { options } },
    submissions: {},
    // why: the bot / sim + disconnect default KOs the cheapest eligible Hero (index 0) —
    // deterministic and always in range.
    defaultOptionIndex: 0,
  };
}

/**
 * Builds the step-2 Bystander discard choice, or undefined when no seat holds a card:
 * every seat with a card in hand is addressed (ascending), one option per hand card, in
 * hand order (the Monarch's Decree discard precedent, D-24511).
 *
 * @param G - The game state (read for hands + card names).
 * @returns The pending discard choice, or undefined when every hand is empty.
 */
export function buildEscapeBystanderDiscardChoice(
  G: LegendaryGameState,
): PendingSeatChoice | undefined {
  const addressedSeats: string[] = [];
  const seatPrompts: PendingSeatChoice['seatPrompts'] = {};
  for (const seat of Object.keys(G.playerZones).sort()) {
    const zones = G.playerZones[seat];
    if (!zones || zones.hand.length === 0) {
      continue;
    }
    const options: SeatChoiceOption[] = [];
    for (const cardId of zones.hand) {
      options.push({ label: resolveCardName(G.cardDisplayData, cardId), cardId });
    }
    addressedSeats.push(seat);
    seatPrompts[seat] = { options };
  }
  if (addressedSeats.length === 0) {
    return undefined;
  }
  return {
    kind: ESCAPE_BYSTANDER_DISCARD_KIND,
    addressedSeats,
    seatPrompts,
    submissions: {},
    // why: the bot / sim + disconnect default discards each seat's first hand card
    // (index 0) — deterministic and always in range.
    defaultOptionIndex: 0,
  };
}

/**
 * Opens (or resolves automatically) the next owed escape step, draining
 * `G.pendingEscapeProcedures` in escape order until a seat choice is parked, the queue
 * is empty, or the match is decided. Called from the play-phase `turn.onMove` (and its
 * sim / fixture mirrors) after every move.
 *
 * Returns at once while any pending player choice is open (`hasAnyPendingChoice`, which
 * covers an open seat choice, a return-on-discard reaction and every active-player queue
 * such as a Juggernaut Escape's hand KO) or the WP-427 `pendingHeroChoice` slot is set, so
 * a step-3 pick resolves first and prompts never stack; and once `evaluateEndgame(G)` is
 * non-null, so a decided match never parks a prompt.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move context's boardgame.io events (for the stage ride), or
 *   undefined in a unit / sim / fixture context.
 * @param currentPlayer - The active player id (ctx.currentPlayer, or the sim loop's
 *   active seat). An undefined value admits every addressed seat to the stage ride.
 */
export function openEscapeProcedureSeatChoiceIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer?: string,
): void {
  while (G.pendingEscapeProcedures !== undefined) {
    const queue = G.pendingEscapeProcedures;
    if (queue.length === 0) {
      delete G.pendingEscapeProcedures;
      break;
    }
    if (hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined) {
      return;
    }
    // why: checked at the head of EVERY iteration, not once per call — an automatic KO's
    // refill can empty the Hero Deck on a Hero-Deck scheme (applied just below), which ends
    // the match before the next step parks.
    if (evaluateEndgame(G) !== null) {
      return;
    }
    const entry = queue[0]!;
    if (!entry.isHqKoResolved) {
      if (openEscapeHqKoStep(G, events, entry, currentPlayer)) {
        return;
      }
      continue;
    }
    queue.shift();
    if (queue.length === 0) {
      delete G.pendingEscapeProcedures;
    }
    if (entry.hasCarriedBystanders && openEscapeBystanderDiscardStep(G, events, currentPlayer)) {
      return;
    }
  }
  // why: WP-817 / D-24750 — rule order: steps 1-2 of every escape first, then the owed
  // Escape-effect discards. Reached only once the escape-procedure queue is absent (every
  // early return above leaves it owed), so the effect discard never opens while a step is
  // owed or a choice is open. D-24750 amends D-24656 point 4 for this effect only: it
  // resolves after the move (and after the new Villain's Ambush), a known deviation from
  // rules v23 L573-575; every other Escape effect stays inline.
  openEscapeEffectDiscardIfNeeded(G, events, currentPlayer);
}

/**
 * Opens the next owed Escape-effect discard (Primus), draining
 * `G.pendingEscapeEffectDiscards` in escape order until a seat choice is parked, the
 * queue is empty, or the match is decided. Called only from the tail of
 * openEscapeProcedureSeatChoiceIfNeeded, after the escape-procedure queue drains.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move context's boardgame.io events, or undefined.
 * @param currentPlayer - The active player id, or undefined.
 */
export function openEscapeEffectDiscardIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer?: string,
): void {
  while (G.pendingEscapeEffectDiscards !== undefined) {
    const queue = G.pendingEscapeEffectDiscards;
    if (queue.length === 0) {
      delete G.pendingEscapeEffectDiscards;
      return;
    }
    if (hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined) {
      return;
    }
    if (evaluateEndgame(G) !== null) {
      return;
    }
    const entry = queue.shift()!;
    if (queue.length === 0) {
      delete G.pendingEscapeEffectDiscards;
    }
    // why: WP-837 / D-24770 — a trait entry (co2e Mystique / Frost Giant Warrior) builds the
    // trait discard; every other entry routes to WP-817's cost builder exactly as before.
    // why: WP-839 / D-24772 — an any-card entry (co2e Speed Demon) builds the unfiltered discard;
    // the field is presence-tested, so a trait or cost entry routes exactly as before.
    // why: WP-902 / D-24859 — Snapdragon's non-grey-discard-then-draw and Iron Maiden's
    // non-grey Undercover send ride the same FIFO, routed by presence before the shipped arms
    // (the D-24772 F3 precedent); an entry without either field routes exactly as before.
    let choice: PendingSeatChoice | undefined;
    if (entry.nonGreyHeroDiscardThenDraw !== undefined) {
      choice = buildNonGreyHeroDiscardThenDrawChoice(G, currentPlayer);
    } else if (entry.nonGreyHeroUndercover !== undefined) {
      choice = buildNonGreyHeroUndercoverChoice(G);
    } else if (entry.anyHandCard !== undefined) {
      choice = buildVillainEffectAnyCardDiscardChoice(G, entry);
    } else if (entry.traitFilter !== undefined) {
      choice = prepareVillainEffectTraitDiscardChoice(G, entry.traitFilter, currentPlayer);
    } else {
      choice = buildEscapeEffectCostDiscardChoice(G, entry);
    }
    if (choice === undefined) {
      continue;
    }
    // why: D-24656 point 3 — the step-2 ride rule verbatim: skip the stage ride only when
    // the active seat is the sole addressed seat; a mixed ride admits the active seat too.
    const isActiveSeatOnly =
      choice.addressedSeats.length === 1 && choice.addressedSeats[0] === currentPlayer;
    if (isActiveSeatOnly) {
      parkSeatChoice(G, events, choice, currentPlayer);
    } else {
      parkSeatChoice(G, events, choice);
    }
    return;
  }
}

/**
 * Builds the every-player cost-filtered discard choice for one owed Escape effect, or
 * undefined when no seat holds an eligible Hero. Every seat (ascending) with at least one
 * eligible hand card is addressed, one option per eligible card in hand order; a seat with
 * none is logged and left out.
 *
 * @param G - The game state (read for hands, costs and card names; the log is appended).
 * @param entry - The owed Escape-effect discard.
 * @returns The pending discard choice, or undefined when no seat is addressed.
 */
export function buildEscapeEffectCostDiscardChoice(
  G: LegendaryGameState,
  entry: PendingEscapeEffectDiscard,
): PendingSeatChoice | undefined {
  const costList = formatEligibleCostList(entry.eligibleCosts);
  const addressedSeats: string[] = [];
  const seatPrompts: PendingSeatChoice['seatPrompts'] = {};
  for (const seat of Object.keys(G.playerZones).sort()) {
    const eligibleCardIds = listEligibleHandCardsByCost(G, seat, entry.eligibleCosts);
    if (eligibleCardIds.length === 0) {
      pushLog(G, `Escape effect: Player ${seat} has no Hero that costs ${costList} to discard.`, 'blocked');
      continue;
    }
    const options: SeatChoiceOption[] = [];
    for (const cardId of eligibleCardIds) {
      // why: every listed card has a cost (the eligibility predicate rejected the rest).
      const cost = offPlayCardStats(G, cardId)!.cost;
      options.push({ label: `${resolveCardName(G.cardDisplayData, cardId)} (cost ${String(cost)})`, cardId });
    }
    addressedSeats.push(seat);
    seatPrompts[seat] = { options };
  }
  if (addressedSeats.length === 0) {
    return undefined;
  }
  return {
    kind: ESCAPE_EFFECT_COST_DISCARD_KIND,
    addressedSeats,
    seatPrompts,
    submissions: {},
    // why: the sim / autoplay + disconnect default discards each seat's first eligible
    // card (index 0) — deterministic and always in range.
    defaultOptionIndex: 0,
  };
}

/**
 * Prepares the every-player Hero-trait discard choice for one owed entry (WP-837 /
 * D-24770), or undefined when no seat holds an eligible Hero.
 *
 * Two passes. Pass 1 resolves every seat with no eligible Hero (logged, or — with the
 * Wound alternative — wounded now). Pass 2 builds the holders' options, so the Wound
 * supply check sees every Wound pass 1 gained.
 *
 * @param G - The game state (Wounds gained in pass 1; the log is appended).
 * @param filter - The entry's trait filter.
 * @param currentPlayer - The active player id, or undefined.
 * @returns The pending discard choice, or undefined when no seat is addressed.
 */
export function prepareVillainEffectTraitDiscardChoice(
  G: LegendaryGameState,
  filter: PendingEffectDiscardTraitFilter,
  currentPlayer?: string,
): PendingSeatChoice | undefined {
  const requirement = { kind: filter.requireKind, value: filter.requireValue };
  // why: D-24780 — pass 1 starts with the current player, then clockwise (rules v23 L2247):
  // its Wounds decide who misses the last one and the order Flying Shield Block is asked in.
  for (const seat of seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)) {
    if (listEligibleHandCardsByTrait(G, seat, requirement).length > 0) {
      continue;
    }
    resolveSeatWithNoEligibleTraitHero(G, filter, seat, currentPlayer);
  }
  const addressedSeats: string[] = [];
  const seatPrompts: PendingSeatChoice['seatPrompts'] = {};
  // why: D-24780 §6 / D-24501 — pass 2 builds one simultaneous prompt, so it stays ascending.
  for (const seat of Object.keys(G.playerZones).sort()) {
    const eligibleCardIds = listEligibleHandCardsByTrait(G, seat, requirement);
    if (eligibleCardIds.length === 0) {
      continue;
    }
    const options: SeatChoiceOption[] = [];
    for (const cardId of eligibleCardIds) {
      options.push({ label: resolveCardName(G.cardDisplayData, cardId), cardId });
    }
    // why: rules v23 L3199-3201 — a player chooses only an option they can actually do, so
    // the Wound is offered only while the supply still has one (after pass 1's Wounds).
    if (filter.hasWoundAlternative && G.piles.wounds.length > 0) {
      options.push({ label: VILLAIN_EFFECT_WOUND_OPTION_LABEL });
    }
    addressedSeats.push(seat);
    seatPrompts[seat] = { options };
  }
  if (addressedSeats.length === 0) {
    return undefined;
  }
  return {
    kind: VILLAIN_EFFECT_TRAIT_DISCARD_KIND,
    addressedSeats,
    seatPrompts,
    submissions: {},
    // why: the sim / autoplay + disconnect default discards each seat's first eligible
    // card (index 0) — deterministic and always in range.
    defaultOptionIndex: 0,
  };
}

/**
 * Resolves one seat that holds no eligible Hero for a trait discard: logs it, or — with
 * the Wound alternative — gains it a Wound through the chokepoint (D-24770).
 *
 * @param G - The game state, mutated in place.
 * @param filter - The entry's trait filter.
 * @param seat - The seat with no eligible Hero.
 * @param currentPlayer - The active player id, or undefined.
 */
function resolveSeatWithNoEligibleTraitHero(
  G: LegendaryGameState,
  filter: PendingEffectDiscardTraitFilter,
  seat: string,
  currentPlayer: string | undefined,
): void {
  const prefix = `${filter.effectLabel} effect: Player ${seat} has no ${filter.requirementLabel} Hero to discard`;
  if (!filter.hasWoundAlternative) {
    pushLog(G, `${prefix}.`, 'blocked');
    return;
  }
  // why: rules v23 L3199-3201 — a player who cannot discard must take the other option.
  const outcome = gainWoundWithOutcome(G, seat);
  if (outcome === 'no-wound') {
    pushLog(G, `${prefix}; the Wound supply is empty.`, 'blocked');
    return;
  }
  if (outcome === 'diving-block-pending') {
    pushLog(G, `${prefix} and would gain a Wound — Diving Block can prevent it.`, 'applied');
  } else {
    pushLog(G, `${prefix} and gained a Wound.`, 'applied');
  }
  countCurrentPlayerVillainWound(G, seat, currentPlayer);
}

/**
 * Adds a villain Wound to the current player's `woundsDrawn` (the UI economy counts only
 * the current player's villain Wounds, as gain-wound:each and reveal-or-wound do).
 *
 * @param G - The game state, mutated in place.
 * @param seat - The seat that gained (or may gain) the Wound.
 * @param currentPlayer - The active player id, or undefined.
 */
function countCurrentPlayerVillainWound(
  G: LegendaryGameState,
  seat: string,
  currentPlayer: string | undefined,
): void {
  if (seat === currentPlayer) {
    G.turnEconomy.woundsDrawn += 1;
  }
}

/**
 * Resolves or opens step 1 (the HQ KO) for the front escape: 0 eligible → the no-op line;
 * 1 → an automatic KO followed by the Hero-Deck depletion check; 2+ → the chooser's seat
 * choice. Marks the step resolved in every case.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move's boardgame.io events, or undefined.
 * @param entry - The front escape procedure.
 * @param currentPlayer - The active player id.
 * @returns true when a seat choice was parked (the opener must stop).
 */
function openEscapeHqKoStep(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  entry: PendingEscapeProcedure,
  currentPlayer: string | undefined,
): boolean {
  entry.isHqKoResolved = true;
  const eligible = listEligibleEscapeHqHeroes(G);
  if (eligible.length === 0) {
    pushLog(G,
      `Escape: ${formatCardRef(G.cardDisplayData, entry.escapedCardId)} KO'd nothing — no Hero in the HQ costs 6 or less.`,
    );
    return false;
  }
  if (eligible.length === 1) {
    koHqHeroForEscape(G, eligible[0]!.cardId, entry.escapedCardId);
    // why: the refill can empty the Hero Deck (Super Hero Civil War's loss, D-24318);
    // setting SCHEME_LOSS now lets the next iteration's evaluateEndgame stop the opener
    // before a queued step 2 parks.
    applyPileDepletionResourceLoss(G);
    return false;
  }
  // why: D-24648 — a one-seat choice addressed to the active player needs no stage ride;
  // they already accept moves as the currentPlayer.
  parkSeatChoice(G, events, buildEscapeHqKoChoice(G, entry.chooserPlayerID, eligible), currentPlayer);
  return true;
}

/**
 * Opens step 2 (the every-player Bystander discard) for an escape that carried
 * Bystanders, or logs the no-op line when every hand is empty.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move's boardgame.io events, or undefined.
 * @param currentPlayer - The active player id.
 * @returns true when a seat choice was parked (the opener must stop).
 */
function openEscapeBystanderDiscardStep(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer: string | undefined,
): boolean {
  const choice = buildEscapeBystanderDiscardChoice(G);
  if (choice === undefined) {
    pushLog(G, 'Escape: no player has a card to discard for the Bystanders carried away.');
    return false;
  }
  // why: D-24656 point 3 — a MIXED ride (the active seat plus others) must admit the active
  // seat too. With the D-24648 skip boardgame.io would set activePlayers to the non-active
  // seats only and reject the active seat's own discard until they all answered (autoplay
  // aborts, bot-ally faults). Skip the ride only when the active seat is the sole addressed
  // seat (the Random Acts pass-left precedent).
  const isActiveSeatOnly =
    choice.addressedSeats.length === 1 && choice.addressedSeats[0] === currentPlayer;
  if (isActiveSeatOnly) {
    parkSeatChoice(G, events, choice, currentPlayer);
  } else {
    parkSeatChoice(G, events, choice);
  }
  return true;
}

/**
 * Applies a fully-submitted HQ-KO seat choice: KOs the chosen Hero (if it is still in the
 * HQ) and refills its space. The Villain named in the log line is the front escape, which
 * stays at the front until its step 2 is opened.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted choice (kind 'escape-hq-ko').
 */
export function applyEscapeHqKo(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const seat = choice.addressedSeats[0];
  if (seat === undefined) {
    return;
  }
  const submission = choice.submissions[seat];
  const option = submission === undefined
    ? undefined
    : choice.seatPrompts[seat]?.options[submission.optionIndex];
  const heroCardId = option?.cardId;
  const front = G.pendingEscapeProcedures?.[0];
  if (heroCardId === undefined || front === undefined) {
    pushLog(G, 'Escape: the HQ KO choice no longer matches an escape — nothing was KO\'d.');
    return;
  }
  koHqHeroForEscape(G, heroCardId, front.escapedCardId);
}

/**
 * Applies a fully-submitted Bystander discard ATOMICALLY: every addressed seat, in
 * ascending id order, discards its chosen hand card through the `discardFromHand`
 * chokepoint (so return-on-discard and teleport-on-discard see a card-effect discard).
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted choice (kind 'escape-bystander-discard').
 */
export function applyEscapeBystanderDiscard(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const seatsInApplyOrder = [...choice.addressedSeats].sort();
  for (const seat of seatsInApplyOrder) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const cardId = choice.seatPrompts[seat]?.options[submission.optionIndex]?.cardId;
    if (cardId === undefined) {
      continue;
    }
    if (discardFromHand(G, seat, cardId)) {
      pushLog(G,
        `Player ${seat} discarded ${formatCardRef(G.cardDisplayData, cardId)} (Bystanders carried away).`,
        'applied',
      );
    }
  }
}

/**
 * Applies a fully-submitted Escape-effect cost discard ATOMICALLY: every addressed seat,
 * in ascending id order, discards its chosen hand card through the `discardFromHand`
 * chokepoint (WP-817 / D-24750).
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted choice (kind 'escape-effect-cost-discard').
 */
export function applyEscapeEffectCostDiscard(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const seatsInApplyOrder = [...choice.addressedSeats].sort();
  for (const seat of seatsInApplyOrder) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const cardId = choice.seatPrompts[seat]?.options[submission.optionIndex]?.cardId;
    if (cardId === undefined) {
      continue;
    }
    if (discardFromHand(G, seat, cardId)) {
      pushLog(G, `Player ${seat} discarded ${formatCardRef(G.cardDisplayData, cardId)} (Escape effect).`, 'applied');
    }
  }
}

/**
 * Records an owed every-player discard of any one hand card (WP-839 / D-24772: co2e Speed Demon's
 * push-triggered "each player discards a card"), opened after the move by the escape opener.
 *
 * @param G - The game state, mutated in place (the FIFO is created lazily).
 * @param sourceCardId - The Villain whose effect owes the discard.
 * @param effectLabel - The timing label for the log (`'Ambush'`, the only record site).
 */
export function enqueueAnyCardEffectDiscard(
  G: LegendaryGameState,
  sourceCardId: CardExtId,
  effectLabel: 'Ambush',
): void {
  // why: the BACK of the FIFO (never the front) keeps rule order: an Escape effect of a Villain the
  // charge pushed out records first and opens first (the D-24750 / D-24770 class).
  G.pendingEscapeEffectDiscards ??= [];
  G.pendingEscapeEffectDiscards.push({ escapedCardId: sourceCardId, eligibleCosts: [], anyHandCard: { effectLabel } });
}

/**
 * Builds the every-player discard choice for one owed any-card entry (WP-839 / D-24772), or
 * undefined when no seat holds a card. Every seat with a card is addressed, one option per hand
 * card in hand order; a seat with an empty hand is logged and left out.
 *
 * @param G - The game state (read for hands and names; the log is appended).
 * @param entry - The owed any-card entry.
 * @returns The pending discard choice, or undefined when no seat is addressed.
 */
export function buildVillainEffectAnyCardDiscardChoice(
  G: LegendaryGameState,
  entry: PendingEscapeEffectDiscard,
): PendingSeatChoice | undefined {
  const effectLabel = entry.anyHandCard?.effectLabel ?? 'Ambush';
  // why: WP-902 / D-24859 — Black Lotus's Ambush ("each player discards a card that costs 0")
  // reuses this any-card kind with a cost-0 filter; read `=== true` so a Speed Demon entry
  // (no zeroCostOnly) keeps its full-hand choice byte-identical (the D-24600 koHeroesOnly precedent).
  const zeroCostOnly = entry.anyHandCard?.zeroCostOnly === true;
  const addressedSeats: string[] = [];
  const seatPrompts: PendingSeatChoice['seatPrompts'] = {};
  // why: D-24780 §6 / D-24501 — the builder of one simultaneous prompt stays ascending (as WP-817's
  // cost builder); it deliberately parallels buildEscapeBystanderDiscardChoice with its own kind,
  // log label and apply (D-24772).
  for (const seat of Object.keys(G.playerZones).sort()) {
    const hand = G.playerZones[seat]?.hand ?? [];
    const eligible = zeroCostOnly ? hand.filter((cardId) => isZeroCostCard(G, cardId)) : hand;
    if (eligible.length === 0) {
      // why: the unfiltered (Speed Demon) no-eligible line is byte-identical to the shipped text;
      // the cost-0 (Black Lotus) line names the cost filter.
      const reason = zeroCostOnly ? 'has no card that costs 0 to discard' : 'has no card to discard';
      pushLog(G, `${effectLabel} effect: Player ${seat} ${reason}.`, 'blocked');
      continue;
    }
    const options: SeatChoiceOption[] = [];
    for (const cardId of eligible) {
      options.push({ label: resolveCardName(G.cardDisplayData, cardId), cardId });
    }
    addressedSeats.push(seat);
    seatPrompts[seat] = { options };
  }
  if (addressedSeats.length === 0) {
    return undefined;
  }
  return {
    kind: VILLAIN_EFFECT_ANY_CARD_DISCARD_KIND,
    addressedSeats,
    seatPrompts,
    submissions: {},
    // why: the sim / autoplay + disconnect default discards each seat's first card (index 0) —
    // deterministic and always in range.
    defaultOptionIndex: 0,
  };
}

/**
 * Applies a fully-submitted any-card discard ATOMICALLY (WP-839 / D-24772): every addressed seat
 * discards its chosen card through the `discardFromHand` chokepoint.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted choice (kind 'villain-effect-any-card-discard').
 */
export function applyVillainEffectAnyCardDiscard(G: LegendaryGameState, choice: PendingSeatChoice): void {
  // why: D-24780 §6 / D-24501 — a simultaneous seat-choice apply stays ascending, as
  // applyEscapeEffectCostDiscard does.
  const seatsInApplyOrder = [...choice.addressedSeats].sort();
  for (const seat of seatsInApplyOrder) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const cardId = choice.seatPrompts[seat]?.options[submission.optionIndex]?.cardId;
    if (cardId === undefined) {
      continue;
    }
    if (discardFromHand(G, seat, cardId)) {
      pushLog(G, `Player ${seat} discarded ${formatCardRef(G.cardDisplayData, cardId)} (Ambush effect).`, 'applied');
    }
  }
}

/**
 * Applies a fully-submitted every-player Hero-trait discard ATOMICALLY (WP-837 /
 * D-24770): an option with a card discards it through `discardFromHand`; the Wound option
 * gains a Wound through `gainWoundWithOutcome`.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted choice (kind 'villain-effect-trait-discard').
 * @param currentPlayer - The active player id, or undefined.
 */
export function applyVillainEffectTraitDiscard(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  currentPlayer?: string,
): void {
  // why: D-24780 §6 / D-24501 — a simultaneous seat-choice apply stays ascending, as
  // applyEscapeEffectCostDiscard does.
  const seatsInApplyOrder = [...choice.addressedSeats].sort();
  for (const seat of seatsInApplyOrder) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const option = choice.seatPrompts[seat]?.options[submission.optionIndex];
    if (option === undefined) {
      continue;
    }
    if (option.cardId !== undefined) {
      if (discardFromHand(G, seat, option.cardId)) {
        pushLog(G, `Player ${seat} discarded ${formatCardRef(G.cardDisplayData, option.cardId)} (Villain effect).`, 'applied');
      }
      continue;
    }
    applyChosenTraitDiscardWound(G, seat, currentPlayer);
  }
}

/**
 * Gains the Wound a seat chose instead of discarding, and narrates it (D-24770).
 *
 * @param G - The game state, mutated in place.
 * @param seat - The seat that chose the Wound.
 * @param currentPlayer - The active player id, or undefined.
 */
function applyChosenTraitDiscardWound(G: LegendaryGameState, seat: string, currentPlayer: string | undefined): void {
  const outcome = gainWoundWithOutcome(G, seat);
  if (outcome === 'no-wound') {
    pushLog(G, `Player ${seat} chose to gain a Wound, but the Wound supply is empty.`, 'blocked');
    return;
  }
  if (outcome === 'diving-block-pending') {
    pushLog(G, `Player ${seat} would gain a Wound instead of discarding — Diving Block can prevent it.`, 'applied');
  } else {
    pushLog(G, `Player ${seat} gained a Wound instead of discarding (Villain effect).`, 'applied');
  }
  countCurrentPlayerVillainWound(G, seat, currentPlayer);
}

/**
 * Whether a card costs 0 for Black Lotus's Ambush (WP-902 / D-24859).
 *
 * // why: D-24583 — a Wound reads as cost 0 (it has no stats entry, so the off-play cost would be
 * undefined); a Bystander never counts (it has no stats entry and is not a Wound).
 *
 * @param G - The game state (read-only).
 * @param cardId - The card to test.
 * @returns true when the card's off-play cost is 0, or it is a Wound.
 */
function isZeroCostCard(G: LegendaryGameState, cardId: CardExtId): boolean {
  if (cardId === WOUND_EXT_ID) {
    return true;
  }
  return offPlayCardStats(G, cardId)?.cost === 0;
}

/** One eligible non-grey Hero for an Elite Assassins every-player choice. */
interface EligibleNonGreyHero {
  cardId: CardExtId;
  cost: number;
  /** 0 = hand (listed before play on a cost tie), 1 = in play (Iron Maiden only). */
  zoneRank: number;
  /** The card's index within its own zone (ties within a zone keep zone order). */
  indexInZone: number;
}

/**
 * Sorts a seat's eligible non-grey Heroes cheapest first, ties hand-before-play then zone order
 * (WP-902 / D-24859), so option 0 is the cheapest — the default every automation takes.
 *
 * @param eligible - The seat's eligible Heroes (mutated in place by the sort).
 */
function sortEligibleNonGreyHeroes(eligible: EligibleNonGreyHero[]): void {
  eligible.sort((heroA, heroB) => {
    if (heroA.cost !== heroB.cost) {
      return heroA.cost - heroB.cost;
    }
    if (heroA.zoneRank !== heroB.zoneRank) {
      return heroA.zoneRank - heroB.zoneRank;
    }
    return heroA.indexInZone - heroB.indexInZone;
  });
}

/**
 * Builds Snapdragon's every-player non-grey-Hero discard choice (WP-902 / D-24859): every seat
 * (ascending) with a non-grey Hero in hand is addressed, one `Discard <name>` option per such
 * card, cheapest first with ties in hand order; a seat with none is logged.
 *
 * The draw ("Then each player draws a card") runs in the apply, which has the move's `{ random }`.
 * When no seat can discard, a one-option choice for the current player (else the lowest seat)
 * carries the draw so it still has a shuffle source — the opener itself never draws (it has no
 * `random`). Returns undefined only when there is no seat at all (a degenerate state that never
 * occurs in a real match); the fallback otherwise always addresses one seat.
 *
 * @param G - The game state (read for hands, costs and names; the log is appended).
 * @param currentPlayer - The active player id, or undefined.
 * @returns The pending discard choice, the one-option draw choice, or undefined with no seats.
 */
export function buildNonGreyHeroDiscardThenDrawChoice(
  G: LegendaryGameState,
  currentPlayer?: string,
): PendingSeatChoice | undefined {
  const addressedSeats: string[] = [];
  const seatPrompts: PendingSeatChoice['seatPrompts'] = {};
  for (const seat of Object.keys(G.playerZones).sort()) {
    const hand = G.playerZones[seat]?.hand ?? [];
    const eligible: EligibleNonGreyHero[] = [];
    for (let index = 0; index < hand.length; index++) {
      const cardId = hand[index]!;
      if (matchesGreyHeroFilter(G, cardId, 'non-grey')) {
        eligible.push({ cardId, cost: offPlayCardStats(G, cardId)?.cost ?? 0, zoneRank: 0, indexInZone: index });
      }
    }
    if (eligible.length === 0) {
      pushLog(G, `Ambush effect: Player ${seat} has no non-grey Hero to discard.`, 'blocked');
      continue;
    }
    sortEligibleNonGreyHeroes(eligible);
    const options: SeatChoiceOption[] = [];
    for (const hero of eligible) {
      options.push({ label: `Discard ${resolveCardName(G.cardDisplayData, hero.cardId)}`, cardId: hero.cardId });
    }
    addressedSeats.push(seat);
    seatPrompts[seat] = { options };
  }
  if (addressedSeats.length > 0) {
    return {
      kind: VILLAIN_EFFECT_NON_GREY_DISCARD_THEN_DRAW_KIND,
      addressedSeats,
      seatPrompts,
      submissions: {},
      // why: cheapest first (above), so the sim / autoplay + disconnect default (index 0) discards
      // the cheapest Hero — D-24859 point 7.
      defaultOptionIndex: 0,
    };
  }
  // why: no seat can discard, but "Then each player draws a card" still runs; park a one-option
  // choice so the apply (which holds `{ random }`) still draws. The opener never draws (no random).
  const fallbackSeat = currentPlayer ?? Object.keys(G.playerZones).sort()[0];
  if (fallbackSeat === undefined) {
    return undefined;
  }
  return {
    kind: VILLAIN_EFFECT_NON_GREY_DISCARD_THEN_DRAW_KIND,
    addressedSeats: [fallbackSeat],
    seatPrompts: { [fallbackSeat]: { options: [{ label: 'No player has a non-grey Hero to discard — each player draws a card' }] } },
    submissions: {},
    defaultOptionIndex: 0,
  };
}

/**
 * Applies Snapdragon's non-grey discard + draw ATOMICALLY (WP-902 / D-24859): every addressed seat
 * (ascending) discards its chosen Hero through `discardFromHand`, then every seat draws one card.
 *
 * The one-option fallback choice carries no `cardId`, so the discard loop is a no-op there and only
 * the draw runs. Without a shuffle context, no seat draws (a `blocked` log) — the opener never
 * reaches here with one missing.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted choice (kind 'villain-effect-non-grey-discard-then-draw').
 * @param shuffleContext - The live move's shuffle source, or undefined (timeout path).
 * @param currentPlayer - The active player id, or undefined.
 */
export function applyVillainEffectNonGreyDiscardThenDraw(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  shuffleContext: ShuffleProvider | undefined,
  currentPlayer?: string,
): void {
  // why: D-24780 §6 / D-24501 — a simultaneous seat-choice apply discards in ascending seat order.
  const seatsInApplyOrder = [...choice.addressedSeats].sort();
  for (const seat of seatsInApplyOrder) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const cardId = choice.seatPrompts[seat]?.options[submission.optionIndex]?.cardId;
    if (cardId === undefined) {
      continue;
    }
    if (discardFromHand(G, seat, cardId)) {
      pushLog(G, `Player ${seat} discarded ${formatCardRef(G.cardDisplayData, cardId)} (Ambush effect).`, 'applied');
    }
  }
  drawCardForEverySeat(G, shuffleContext, currentPlayer);
}

/**
 * "Then each player draws a card" for Snapdragon's Ambush (WP-902 / D-24859).
 *
 * // why: D-24780 — the draw runs current player first, then clockwise. D-24552 — the current
 * player's draw is skipped while `drawsLocked` is set (the D-24602 Throw from the Waterfall
 * precedent); every other seat always draws. D-24732 — the current player's `cardsDrawn` rises by
 * the cards actually drawn (the hand-length delta, never `drawCardsIntoHand`'s reshuffle-count
 * return). Without a shuffle context no seat draws (a `blocked` log); the opener never reaches here
 * with one missing.
 *
 * @param G - The game state, mutated in place.
 * @param shuffleContext - The live move's shuffle source, or undefined.
 * @param currentPlayer - The active player id, or undefined.
 */
function drawCardForEverySeat(
  G: LegendaryGameState,
  shuffleContext: ShuffleProvider | undefined,
  currentPlayer: string | undefined,
): void {
  if (shuffleContext === undefined) {
    pushLog(G, 'Ambush effect: no shuffle source is available, so no player drew a card.', 'blocked');
    return;
  }
  for (const seat of seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)) {
    const zones = G.playerZones[seat];
    if (zones === undefined) {
      continue;
    }
    if (seat === currentPlayer && G.turnEconomy.drawsLocked === true) {
      // why: D-24552 — a draw lock skips only the current player's draw; other seats still draw.
      pushLog(G, `Player ${seat} could not draw a card — drawing is locked this turn.`, 'blocked');
      continue;
    }
    const handBefore = zones.hand.length;
    drawCardsIntoHand(zones, 1, shuffleContext);
    const drawn = zones.hand.length - handBefore;
    if (seat === currentPlayer) {
      // why: D-24732 — count the cards the current player actually drew (0 when deck and discard
      // are both empty), never drawCardsIntoHand's reshuffle-count return.
      G.turnEconomy.cardsDrawn += drawn;
    }
    pushLog(G, `Player ${seat} drew ${String(drawn)} card (Ambush effect).`, 'applied');
  }
}

/**
 * Builds Iron Maiden's every-player non-grey Undercover send (WP-902 / D-24859): every seat
 * (ascending) with a non-grey Hero in hand or in play is addressed, one `Send <name> Undercover
 * (from your hand)` / `(played this turn)` option per such card, cheapest first with ties
 * hand-before-play then zone order; a seat with none is logged. No decline ("must"), so a seat
 * with a Hero always sends one. Returns undefined when no seat is addressed.
 *
 * @param G - The game state (read for hands, play, costs and names; the log is appended).
 * @returns The pending Undercover choice, or undefined when no seat is addressed.
 */
export function buildNonGreyHeroUndercoverChoice(G: LegendaryGameState): PendingSeatChoice | undefined {
  const addressedSeats: string[] = [];
  const seatPrompts: PendingSeatChoice['seatPrompts'] = {};
  for (const seat of Object.keys(G.playerZones).sort()) {
    const zones = G.playerZones[seat];
    if (zones === undefined) {
      continue;
    }
    const eligible: EligibleNonGreyHero[] = [];
    for (let index = 0; index < zones.hand.length; index++) {
      const cardId = zones.hand[index]!;
      if (matchesGreyHeroFilter(G, cardId, 'non-grey')) {
        eligible.push({ cardId, cost: offPlayCardStats(G, cardId)?.cost ?? 0, zoneRank: 0, indexInZone: index });
      }
    }
    for (let index = 0; index < zones.inPlay.length; index++) {
      const cardId = zones.inPlay[index]!;
      // why: WP-902 / D-24859 — matchesGreyHeroFilter is read over an IN-PLAY card too. Its
      // off-play view only widens a split card's classes (never narrows), so whether a card is
      // non-grey is unaffected; the cost ordering uses the same off-play cost for both zones.
      if (matchesGreyHeroFilter(G, cardId, 'non-grey')) {
        eligible.push({ cardId, cost: offPlayCardStats(G, cardId)?.cost ?? 0, zoneRank: 1, indexInZone: index });
      }
    }
    if (eligible.length === 0) {
      pushLog(G, `Ambush effect: Player ${seat} has no non-grey Hero to send Undercover.`, 'blocked');
      continue;
    }
    sortEligibleNonGreyHeroes(eligible);
    const options: SeatChoiceOption[] = [];
    for (const hero of eligible) {
      const zoneLabel = hero.zoneRank === 0 ? 'from your hand' : 'played this turn';
      options.push({
        label: `Send ${resolveCardName(G.cardDisplayData, hero.cardId)} Undercover (${zoneLabel})`,
        cardId: hero.cardId,
        sourceZone: hero.zoneRank === 0 ? 'hand' : 'inPlay',
      });
    }
    addressedSeats.push(seat);
    seatPrompts[seat] = { options };
  }
  if (addressedSeats.length === 0) {
    return undefined;
  }
  return {
    kind: VILLAIN_EFFECT_UNDERCOVER_EACH_PLAYER_KIND,
    addressedSeats,
    seatPrompts,
    submissions: {},
    // why: cheapest first (above), so the sim / autoplay + disconnect default (index 0) sends the
    // cheapest Hero — D-24859 point 7 (there is no decline; the send is mandatory).
    defaultOptionIndex: 0,
  };
}

/**
 * Applies Iron Maiden's every-player Undercover send ATOMICALLY (WP-902 / D-24859): every addressed
 * seat (ascending) sends its chosen Hero Undercover from the option's zone (+1 VP). A card no
 * longer in that zone is skipped with a `blocked` log. An in-play send is a mid-turn exit from
 * play, so it is recorded (WP-899 / D-24856, the resolveUndercoverChoice precedent).
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted choice (kind 'villain-effect-undercover-each-player').
 */
export function applyVillainEffectUndercoverEachPlayer(G: LegendaryGameState, choice: PendingSeatChoice): void {
  // why: D-24780 §6 / D-24501 — a simultaneous seat-choice apply sends in ascending seat order.
  const seatsInApplyOrder = [...choice.addressedSeats].sort();
  for (const seat of seatsInApplyOrder) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const option = choice.seatPrompts[seat]?.options[submission.optionIndex];
    const cardId = option?.cardId;
    const zones = G.playerZones[seat];
    if (option === undefined || cardId === undefined || zones === undefined) {
      continue;
    }
    if (option.sourceZone === 'inPlay') {
      if (!zones.inPlay.includes(cardId)) {
        pushLog(G, `Player ${seat} could not send ${formatCardRef(G.cardDisplayData, cardId)} Undercover — it is no longer in play.`, 'blocked');
        continue;
      }
      zones.inPlay = moveCardUndercover(G, seat, cardId, zones.inPlay);
      // why: WP-899 / D-24856 — a played card that leaves play mid-turn still counts as played this
      // turn; record the exit so the play-history gates keep seeing it (resolveUndercoverChoice).
      G.turnEconomy = recordPlayedCardLeftPlay(G.turnEconomy, cardId);
    } else {
      if (!zones.hand.includes(cardId)) {
        pushLog(G, `Player ${seat} could not send ${formatCardRef(G.cardDisplayData, cardId)} Undercover — it is no longer in their hand.`, 'blocked');
        continue;
      }
      zones.hand = moveCardUndercover(G, seat, cardId, zones.hand);
    }
    pushLog(G, `Player ${seat} sent ${formatCardRef(G.cardDisplayData, cardId)} Undercover (into the Victory Pile, +1 VP).`, 'applied');
  }
}
