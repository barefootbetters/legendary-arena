/**
 * Playing-seat answers for an open pending seat choice (D-24744).
 *
 * `getLegalMoves` offers an outstanding addressed seat exactly one
 * `resolveSeatChoice`, at `choice.defaultOptionIndex`. That default is the
 * ABSENT-seat answer — what a disconnected or timed-out seat gets (WP-684 /
 * D-24501) — and for some kinds it is deliberately the losing one: Diving Block
 * defaults to DECLINE so an absent seat never gets a phantom free draw (WP-682 /
 * D-24499). A bot ally is a seat that is actually playing, so it answers here
 * instead: the option a present player would take.
 *
 * Kinds whose default already is the present-player answer, or whose best answer
 * is a strategy call this helper does not make, return the default unchanged:
 *   - monarchs-decree-mode: "each other player draws" — the co-op answer.
 *   - escape-hq-ko: the cheapest eligible Hero (the builder orders by cost).
 *   - return-on-discard: return the card to hand.
 *   - here-hold-this: which City Villain captures a Bystander (follow-up).
 *   - random-acts-pass-left: the card stays on the team in co-op (follow-up).
 *
 * The absent-seat default and getLegalMoves are untouched, so autoplay, the
 * simulation runner and PAR keep their D-24590 / D-24573 behaviour.
 *
 * Pure: reads G, never mutates it, never throws, no RNG. No boardgame.io
 * imports. No registry imports. No .reduce().
 */

import type { LegendaryGameState, PendingSeatChoice, SeatChoiceOption } from '../types.js';
import {
  DIVING_BLOCK_REVEAL_OPTION_INDEX,
  DIVING_BLOCK_SEAT_CHOICE_KIND,
} from '../moves/divingBlock.logic.js';
import {
  RANDOM_ACTS_DIVING_BLOCK_OPTION_INDEX,
  RANDOM_ACTS_WOUND_KIND,
} from '../moves/seatChoiceCards.js';
import {
  MONARCHS_DISCARD_KIND,
  VANISHING_ILLUSIONS_KO_KIND,
} from '../moves/seatChoiceTactics.js';
import { ESCAPE_BYSTANDER_DISCARD_KIND } from '../villainDeck/villainEscapeProcedure.js';
import { hasSeatSubmitted, isSeatAddressed } from '../moves/seatChoice.resolve.js';
import { victoryPointValueForCard } from '../economy/bloodFrenzy.logic.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';

/**
 * Returns the option index a PLAYING seat submits for the open seat choice, or
 * null when no choice is open or the seat owes no submission.
 *
 * @param G - The game state (read only).
 * @param seat - The addressed seat that owes a submission.
 * @returns The option index to submit, or null when the seat owes nothing.
 */
export function choosePlayingSeatChoiceOption(
  G: LegendaryGameState,
  seat: string,
): number | null {
  const choice = G.pendingSeatChoice;
  if (choice === undefined) {
    return null;
  }
  if (!isSeatAddressed(choice, seat) || hasSeatSubmitted(choice, seat)) {
    return null;
  }
  const options = choice.seatPrompts[seat]?.options;
  if (options === undefined || options.length === 0) {
    return null;
  }
  const chosen = chooseByKind(G, choice, seat, options);
  if (chosen === null || chosen < 0 || chosen >= options.length) {
    return clampDefault(choice, options);
  }
  return chosen;
}

/**
 * Dispatches to the kind's playing-seat answer, or null to keep the default.
 *
 * @param G - The game state (read only).
 * @param choice - The open seat choice.
 * @param seat - The addressed seat.
 * @param options - That seat's own prompt options (non-empty).
 * @returns The chosen option index, or null to fall back to the default.
 */
function chooseByKind(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  seat: string,
  options: readonly SeatChoiceOption[],
): number | null {
  if (choice.kind === DIVING_BLOCK_SEAT_CHOICE_KIND) {
    // why: D-24499 — revealing prevents the Wound and draws a card; it never costs
    // anything (Diving Block stays in hand), so a present player always reveals.
    return DIVING_BLOCK_REVEAL_OPTION_INDEX;
  }
  if (choice.kind === RANDOM_ACTS_WOUND_KIND) {
    // why: D-24678 — the Diving Block option exists only when the seat can reveal it,
    // and "draw a card instead" beats the decline default; without it, keep decline.
    if (options.length > RANDOM_ACTS_DIVING_BLOCK_OPTION_INDEX) {
      return RANDOM_ACTS_DIVING_BLOCK_OPTION_INDEX;
    }
    return null;
  }
  if (choice.kind === MONARCHS_DISCARD_KIND || choice.kind === ESCAPE_BYSTANDER_DISCARD_KIND) {
    return indexOfLeastValuableCard(G, options);
  }
  if (choice.kind === VANISHING_ILLUSIONS_KO_KIND) {
    return indexOfLowestVictoryPointCard(G, seat, options);
  }
  return null;
}

/**
 * Picks the card a player would rather lose from hand: a Wound first, otherwise
 * the lowest printed recruit cost. Ties keep the earliest option.
 *
 * // why: the default discards the FIRST hand card, which may be the best card in
 * hand. Cost is the engine's only per-card value signal outside a turn; starting
 * S.H.I.E.L.D. cards cost 0, so they go before any recruited Hero.
 *
 * @param G - The game state (read for cardStats).
 * @param options - The seat's options; each carries the hand instance in cardId.
 * @returns The option index of the least valuable card, or null when none carries a card.
 */
function indexOfLeastValuableCard(
  G: LegendaryGameState,
  options: readonly SeatChoiceOption[],
): number | null {
  let bestIndex: number | null = null;
  let bestValue = Number.POSITIVE_INFINITY;
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    const cardId = options[optionIndex]!.cardId;
    if (cardId === undefined) {
      continue;
    }
    if (cardId === WOUND_EXT_ID) {
      return optionIndex;
    }
    const cost = G.cardStats[cardId]?.cost ?? 0;
    if (cost < bestValue) {
      bestValue = cost;
      bestIndex = optionIndex;
    }
  }
  return bestIndex;
}

/**
 * Picks the Victory-Pile card worth the fewest Victory Points (scoring's own
 * per-card value). Ties keep the earliest option.
 *
 * // why: the default KOs the FIRST Victory-Pile Villain, which may be the highest
 * scoring one; the KO'd card's VP leaves the final score.
 *
 * @param G - The game state (read for victory points).
 * @param seat - The seat whose Victory Pile holds the cards.
 * @param options - The seat's options; each carries the Villain in cardId.
 * @returns The option index of the lowest-VP card, or null when none carries a card.
 */
function indexOfLowestVictoryPointCard(
  G: LegendaryGameState,
  seat: string,
  options: readonly SeatChoiceOption[],
): number | null {
  let bestIndex: number | null = null;
  let bestValue = Number.POSITIVE_INFINITY;
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    const cardId = options[optionIndex]!.cardId;
    if (cardId === undefined) {
      continue;
    }
    const victoryPoints = victoryPointValueForCard(G, seat, cardId) ?? 0;
    if (victoryPoints < bestValue) {
      bestValue = victoryPoints;
      bestIndex = optionIndex;
    }
  }
  return bestIndex;
}

/**
 * The choice's default option, clamped into the seat's option range (the same
 * clamp the timeout path applies).
 *
 * @param choice - The open seat choice.
 * @param options - The seat's options (non-empty).
 * @returns An in-range option index.
 */
function clampDefault(choice: PendingSeatChoice, options: readonly SeatChoiceOption[]): number {
  return Math.max(0, Math.min(choice.defaultOptionIndex, options.length - 1));
}
