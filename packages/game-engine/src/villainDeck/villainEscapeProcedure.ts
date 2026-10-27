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
import { offPlayCardStats } from '../hero/splitCard.logic.js';
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
    let choice: PendingSeatChoice | undefined;
    if (entry.traitFilter !== undefined) {
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
