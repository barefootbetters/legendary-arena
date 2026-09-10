/**
 * Card-specific builders + atomic appliers for the two Deadpool interactive/
 * multiplayer abilities that ride WP-684's non-active/multi-seat pending-choice
 * capability (WP-683 / D-24500):
 *
 *   - `here-hold-this` — "A Villain of your choice captures a Bystander." An
 *     ACTIVE-scoped single-seat pick (kind 'here-hold-this'); 0 City Villains →
 *     the Mastermind captures; empty Bystander supply → no-op; the pick reuses
 *     `attachBystanderToVillain`.
 *   - `random-acts` — "You may gain a Wound to your hand. Then each player passes
 *     a card from their hand to the player on their left." An active-scoped wound
 *     choice (kind 'random-acts-wound', gain-to-HAND) that CHAINS a SIMULTANEOUS
 *     MULTI-SEAT pass-left (kind 'random-acts-pass-left', `ctx.playOrder`
 *     adjacency, atomic apply).
 *
 * This module holds ONLY pure builders + state appliers (no boardgame.io import,
 * no parkSeatChoice import) so it never cycles with seatChoice.resolve.ts — that
 * module imports the appliers (to dispatch on resolve) and the pass-left builder
 * (to chain the pass after the wound). The consuming handlers
 * (heroEffects.execute.ts) import the builders + auto/mastermind helpers and the
 * park entry from seatChoice.resolve.ts. One direction only.
 *
 * No .reduce() in the apply loops. No registry imports.
 */

import type {
  LegendaryGameState,
  PendingSeatChoice,
  SeatChoiceOption,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { attachBystanderToVillain } from '../board/bystanders.logic.js';
import { gainWound } from '../board/wounds.logic.js';
import { moveCardFromZone } from './zoneOps.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';

/** Discriminant for Here, Hold This's active-scoped villain pick. */
export const HERE_HOLD_THIS_KIND = 'here-hold-this';
/** Discriminant for Random Acts' active-scoped optional gain-Wound-to-hand step. */
export const RANDOM_ACTS_WOUND_KIND = 'random-acts-wound';
/** Discriminant for Random Acts' simultaneous multi-seat pass-left step. */
export const RANDOM_ACTS_PASS_LEFT_KIND = 'random-acts-pass-left';

/** One eligible Here, Hold This target: the City space and its occupant. */
export interface HereHoldThisTarget {
  /** The City space index (ascending; a stable, block-all-frozen selector). */
  cityIndex: number;
  /** The Villain/Henchman occupying that space. */
  cardId: CardExtId;
}

/**
 * Builds the deterministic list of Here, Hold This targets — every non-empty City
 * space in ascending index order.
 *
 * Every City occupant (Villain or Henchman) can capture a Bystander, so the whole
 * occupied City is eligible (contrast defeat-with-bystander, which needs an
 * already-attached Bystander). Ascending City index is the pinned order that feeds
 * both the option list and the bot/sim default, so the pick replays identically.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns The eligible targets in ascending City-index order.
 */
export function buildHereHoldThisTargets(G: LegendaryGameState): HereHoldThisTarget[] {
  const targets: HereHoldThisTarget[] = [];
  for (let cityIndex = 0; cityIndex < G.city.length; cityIndex++) {
    const cardId = G.city[cityIndex];
    if (cardId !== null && cardId !== undefined) {
      targets.push({ cityIndex, cardId });
    }
  }
  return targets;
}

/**
 * Attaches the top-supply Bystander to the City Villain at the given space via the
 * shared `attachBystanderToVillain` helper, then logs the capture.
 *
 * An empty supply or an empty space is a deterministic no-op (never a throw).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param cityIndex - The City space whose occupant captures the Bystander.
 */
export function attachBystanderToCityVillain(G: LegendaryGameState, cityIndex: number): void {
  const villainCardId = G.city[cityIndex];
  if (villainCardId === null || villainCardId === undefined) {
    return;
  }
  if (G.piles.bystanders.length === 0) {
    // why: empty Bystander supply → nothing to capture (a clean no-op per the WP contract).
    pushLog(G, `A Villain could not capture a Bystander — the Bystander supply is empty.`, 'blocked');
    return;
  }
  const result = attachBystanderToVillain(G.piles.bystanders, villainCardId, G.attachedBystanders);
  G.piles.bystanders = result.bystandersPile;
  G.attachedBystanders = result.attachedBystanders;
  pushLog(
    G,
    `${resolveCardName(G.cardDisplayData, villainCardId)} (${villainCardId}) captured a Bystander (Here, Hold This for a Second).`,
    'applied',
  );
}

/**
 * Mastermind-captures-a-Bystander fallback for Here, Hold This when the City holds
 * NO Villains.
 *
 * // why: WP-683 / D-24500 — universal-rules-v23 §capture: when a "Villain captures
 * a Bystander" effect fires and there is no Villain in the City, the MASTERMIND
 * captures the Bystander instead. Mastermind captures live in
 * G.mastermind.attachedBystanders (the D-15401 mastermind-side store), append-only.
 * An empty supply is a clean no-op.
 *
 * @param G - Game state (mutated under Immer draft).
 */
export function captureBystanderToMastermind(G: LegendaryGameState): void {
  if (G.piles.bystanders.length === 0) {
    pushLog(G, `The Mastermind could not capture a Bystander — the Bystander supply is empty.`, 'blocked');
    return;
  }
  const bystanderCardId = G.piles.bystanders[0]!;
  G.piles.bystanders = G.piles.bystanders.slice(1);
  G.mastermind.attachedBystanders = [...(G.mastermind.attachedBystanders ?? []), bystanderCardId];
  pushLog(
    G,
    `The Mastermind captured a Bystander (Here, Hold This for a Second — no Villain in the City).`,
    'applied',
  );
}

/**
 * Builds the active-scoped single-seat pending choice for a ≥2-target Here, Hold
 * This pick. One option per City occupant, labelled by name, carrying its City
 * space index for the atomic apply.
 *
 * @param G - The game state (read for occupant display names).
 * @param playerID - The acting player (the sole addressed seat).
 * @param targets - The eligible targets (ascending City index).
 * @returns The pending choice to park.
 */
export function buildHereHoldThisChoice(
  G: LegendaryGameState,
  playerID: string,
  targets: HereHoldThisTarget[],
): PendingSeatChoice {
  const options: SeatChoiceOption[] = [];
  for (const target of targets) {
    options.push({
      label: resolveCardName(G.cardDisplayData, target.cardId),
      cityIndex: target.cityIndex,
    });
  }
  return {
    kind: HERE_HOLD_THIS_KIND,
    addressedSeats: [playerID],
    seatPrompts: { [playerID]: { options } },
    submissions: {},
    // why: the bot/sim default picks the first eligible City space (ascending index).
    defaultOptionIndex: 0,
  };
}

/**
 * Applies a fully-submitted Here, Hold This pick: the chosen City occupant captures
 * the top-supply Bystander.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (kind 'here-hold-this').
 */
export function applyHereHoldThis(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const seat = choice.addressedSeats[0];
  if (seat === undefined) {
    return;
  }
  const submission = choice.submissions[seat];
  const option = submission !== undefined ? choice.seatPrompts[seat]?.options[submission.optionIndex] : undefined;
  if (option === undefined || option.cityIndex === undefined) {
    return;
  }
  attachBystanderToCityVillain(G, option.cityIndex);
}

/**
 * Builds the active-scoped single-seat optional gain-Wound-to-hand choice for
 * Random Acts (step 1). Option 0 gains a Wound to the acting player's HAND; option
 * 1 declines.
 *
 * // why: WP-683 / D-24500 — "gain a Wound to your HAND" is a new destination
 * variant of the discard-default gain (heroEffectGainWound), so the gained Wound is
 * immediately a legal card the player can pass away in step 2.
 *
 * @param playerID - The acting player (the sole addressed seat).
 * @returns The pending wound choice to park.
 */
export function buildRandomActsWoundChoice(playerID: string): PendingSeatChoice {
  return {
    kind: RANDOM_ACTS_WOUND_KIND,
    addressedSeats: [playerID],
    seatPrompts: {
      [playerID]: { options: [{ label: 'Gain a Wound to your hand' }, { label: 'Decline' }] },
    },
    submissions: {},
    // why: the bot/sim + disconnect default DECLINES — gaining a Wound is a downside a
    // seat only opts into to dump it on a neighbour, never a default a bot should take.
    defaultOptionIndex: 1,
  };
}

/**
 * Applies a fully-submitted Random Acts wound choice: option 0 gains one Wound from
 * the shared supply into the acting player's HAND; option 1 (decline) is a no-op.
 *
 * // why: WP-683 / D-24500 — reuses the destination-agnostic gainWound helper with
 * the HAND as the destination (the discard default is unchanged for other effects).
 * woundsDrawn (the active player's KEPT-wounds economy) is NOT bumped: in a
 * multi-seat game the Wound is passed away in step 2; in solo it is kept, but not
 * "drawn" for the turn-economy meter.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (kind 'random-acts-wound').
 */
export function applyRandomActsWoundGain(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const seat = choice.addressedSeats[0];
  if (seat === undefined) {
    return;
  }
  const submission = choice.submissions[seat];
  if (submission === undefined || submission.optionIndex !== 0) {
    // why: declined (or a defensive miss) — no Wound gained.
    return;
  }
  const zones = G.playerZones[seat];
  if (!zones) {
    return;
  }
  if (G.piles.wounds.length === 0) {
    pushLog(G, `Player ${seat} could not gain a Wound — the Wound supply is empty.`, 'blocked');
    return;
  }
  const result = gainWound(G.piles.wounds, zones.hand);
  G.piles.wounds = result.woundsPile;
  zones.hand = result.playerDiscard;
  pushLog(G, `Player ${seat} gained a Wound to their hand (Random Acts of Unkindness).`, 'applied');
}

/**
 * Builds the simultaneous multi-seat pass-left choice for Random Acts (step 2), or
 * undefined when there is no cross-seat pass to make (solo, or no seat holds a card).
 *
 * Every seat that holds ≥1 card is addressed with one option per hand card; a seat
 * with an empty hand is not addressed (it passes nothing) but may still RECEIVE a
 * card from the seat on its right. `leftNeighborBySeat` records each addressed
 * seat's left neighbour — the NEXT seat in `ctx.playOrder` — precomputed here so the
 * atomic apply is ctx-free and replay-identical.
 *
 * // why: WP-683 / D-24500 — a solo game (playOrder length < 2) has no "player on
 * your left" but yourself, so the pass degenerates to a no-op and is skipped
 * (returns undefined); the optional Wound gain in step 1 already captured the only
 * observable solo effect.
 *
 * @param G - The game state (read for hands + card display names).
 * @param playOrder - The seat order (ctx.playOrder); adjacency source for "left".
 * @returns The pending pass-left choice, or undefined when no cross-seat pass applies.
 */
export function buildPassLeftChoice(
  G: LegendaryGameState,
  playOrder: readonly string[],
): PendingSeatChoice | undefined {
  if (playOrder.length < 2) {
    return undefined;
  }
  const addressedSeats: string[] = [];
  const seatPrompts: Record<string, { options: SeatChoiceOption[] }> = {};
  const leftNeighborBySeat: Record<string, string> = {};
  for (let seatIndex = 0; seatIndex < playOrder.length; seatIndex++) {
    const seat = playOrder[seatIndex]!;
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
    // why: "the player on their left" = the NEXT seat in ctx.playOrder (turn order),
    // wrapping at the end. Recorded per addressed seat so the atomic apply needs no ctx.
    leftNeighborBySeat[seat] = playOrder[(seatIndex + 1) % playOrder.length]!;
  }
  if (addressedSeats.length === 0) {
    return undefined;
  }
  return {
    kind: RANDOM_ACTS_PASS_LEFT_KIND,
    addressedSeats,
    seatPrompts,
    submissions: {},
    // why: the bot/sim + disconnect default passes each seat's FIRST hand card (index 0),
    // a deterministic, always-in-range choice.
    defaultOptionIndex: 0,
    leftNeighborBySeat,
  };
}

/**
 * Applies a fully-submitted pass-left ATOMICALLY: every addressed seat's chosen card
 * moves to the seat on its left, all removals happening before any additions.
 *
 * // why: WP-683 / D-24500 — the two-phase apply is what makes the pass SIMULTANEOUS:
 * every seat's outgoing card leaves its hand (phase 1) before any incoming card lands
 * (phase 2), so no seat's incoming card can be re-passed and no seat sees an incoming
 * card while choosing (the choice already resolved). Seats are iterated in ASCENDING
 * id order in both phases, so the resolution is byte-identical regardless of the order
 * seats submitted in (the determinism guarantee, matching the shared multi-seat apply).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (kind 'random-acts-pass-left').
 */
export function applyRandomActsPassLeft(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const seatsInApplyOrder = [...choice.addressedSeats].sort();
  const passes: { fromSeat: string; toSeat: string; cardId: CardExtId }[] = [];
  // Phase 1: remove every chosen card from its seat's hand.
  for (const seat of seatsInApplyOrder) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const option = choice.seatPrompts[seat]?.options[submission.optionIndex];
    const cardId = option?.cardId;
    const toSeat = choice.leftNeighborBySeat?.[seat];
    if (cardId === undefined || toSeat === undefined) {
      continue;
    }
    const zones = G.playerZones[seat];
    if (!zones) {
      continue;
    }
    const removal = moveCardFromZone(zones.hand, [], cardId);
    if (!removal.found) {
      continue;
    }
    zones.hand = removal.from;
    passes.push({ fromSeat: seat, toSeat, cardId });
  }
  // Phase 2: add every removed card to its destination hand.
  for (const pass of passes) {
    const destZones = G.playerZones[pass.toSeat];
    if (!destZones) {
      continue;
    }
    destZones.hand = [...destZones.hand, pass.cardId];
    pushLog(
      G,
      `Player ${pass.fromSeat} passed ${resolveCardName(G.cardDisplayData, pass.cardId)} to Player ${pass.toSeat} (Random Acts of Unkindness).`,
      'applied',
    );
  }
}

/**
 * Dispatches a fully-submitted seat choice to its card-specific atomic apply.
 *
 * Returns true when a card kind handled the apply (so the generic seat-choice logger
 * is skipped); false for the foundational 'generic' kind (and any unrecognized kind),
 * which the caller then logs generically.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice.
 * @returns Whether a card-specific apply ran.
 */
export function applySeatChoiceCard(G: LegendaryGameState, choice: PendingSeatChoice): boolean {
  if (choice.kind === HERE_HOLD_THIS_KIND) {
    applyHereHoldThis(G, choice);
    return true;
  }
  if (choice.kind === RANDOM_ACTS_WOUND_KIND) {
    applyRandomActsWoundGain(G, choice);
    return true;
  }
  if (choice.kind === RANDOM_ACTS_PASS_LEFT_KIND) {
    applyRandomActsPassLeft(G, choice);
    return true;
  }
  return false;
}
